/**
 * Idempotent seed loader. Safe to run repeatedly.
 *
 * UPSERT contract: `(source_platform, source_listing_id)` is the conflict key —
 * the exact shape v2 scrapers will use.
 */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import postgres from "postgres";
import { locality } from "../src/lib/db/schema";

type LocalitySeed = {
  slug: string;
  name: string;
  lat: number;
  lng: number;
};

type ListingSeed = {
  slug: string;
  title: string;
  description?: string | null;
  bhk: number;
  rentInr: number;
  depositInr?: number | null;
  areaSqft?: number | null;
  floor?: number | null;
  totalFloors?: number | null;
  furnishing?: "unfurnished" | "semi" | "fully" | null;
  availableFrom?: string | null;
  lat: number;
  lng: number;
  addressLine?: string | null;
  localitySlug: string;
  photos: Array<{ url: string; alt: string }>;
  contactName?: string | null;
  sourceLabel: "owner" | "broker" | "unknown";
};

async function main() {
  const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DIRECT_URL (or DATABASE_URL) must be set");
  }

  const client = postgres(connectionString, { prepare: false, max: 1 });
  const db = drizzle(client);

  const seedDir = resolve(process.cwd(), "seed");
  const localities: LocalitySeed[] = JSON.parse(
    await readFile(resolve(seedDir, "localities.json"), "utf-8"),
  );
  const listings: ListingSeed[] = JSON.parse(
    await readFile(resolve(seedDir, "listings.json"), "utf-8"),
  );

  console.log(`→ Seeding ${localities.length} localities, ${listings.length} listings...`);

  // ---- Localities (UPSERT on slug) ----
  for (const l of localities) {
    await db
      .insert(locality)
      .values({
        slug: l.slug,
        name: l.name,
        centroid: { lat: l.lat, lng: l.lng },
      })
      .onConflictDoUpdate({
        target: locality.slug,
        set: {
          name: l.name,
          centroid: { lat: l.lat, lng: l.lng },
        },
      });
  }
  console.log(`  ✓ ${localities.length} localities upserted`);

  // ---- Build locality slug → id map ----
  const localityRows = await db.select({ id: locality.id, slug: locality.slug }).from(locality);
  const localityIdBySlug = new Map(localityRows.map((r) => [r.slug, r.id]));

  // ---- Listings (UPSERT on (source_platform, source_listing_id) where not null) ----
  // Raw SQL because Drizzle's onConflictDoUpdate doesn't emit the WHERE clause
  // required to match a partial unique index.
  let inserted = 0;
  for (const item of listings) {
    const localityId = localityIdBySlug.get(item.localitySlug);
    if (!localityId) {
      console.warn(`  ⚠ skipping ${item.slug}: unknown locality ${item.localitySlug}`);
      continue;
    }

    const sourceListingId = `seed-${item.slug}`;
    const locationExpr = sql`ST_SetSRID(ST_MakePoint(${item.lng}, ${item.lat}), 4326)::geography`;

    await db.execute(sql`
      INSERT INTO listing (
        slug, title, description, bhk, rent_inr, deposit_inr, area_sqft,
        floor, total_floors, furnishing, available_from,
        location, address_line, locality_id,
        photos, contact_name, source_label,
        source_platform, source_listing_id,
        first_seen_at, last_seen_at, is_active, updated_at
      ) VALUES (
        ${item.slug}, ${item.title}, ${item.description ?? null},
        ${item.bhk}, ${item.rentInr}, ${item.depositInr ?? null}, ${item.areaSqft ?? null},
        ${item.floor ?? null}, ${item.totalFloors ?? null},
        ${item.furnishing ?? null}, ${item.availableFrom ?? null},
        ${locationExpr}, ${item.addressLine ?? null}, ${localityId},
        ${JSON.stringify(item.photos)}::jsonb,
        ${item.contactName ?? null}, ${item.sourceLabel},
        'seed', ${sourceListingId},
        now(), now(), true, now()
      )
      ON CONFLICT (source_platform, source_listing_id)
      WHERE source_listing_id IS NOT NULL
      DO UPDATE SET
        slug = EXCLUDED.slug,
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        rent_inr = EXCLUDED.rent_inr,
        deposit_inr = EXCLUDED.deposit_inr,
        area_sqft = EXCLUDED.area_sqft,
        floor = EXCLUDED.floor,
        total_floors = EXCLUDED.total_floors,
        furnishing = EXCLUDED.furnishing,
        available_from = EXCLUDED.available_from,
        location = EXCLUDED.location,
        address_line = EXCLUDED.address_line,
        photos = EXCLUDED.photos,
        contact_name = EXCLUDED.contact_name,
        source_label = EXCLUDED.source_label,
        last_seen_at = now(),
        is_active = true,
        updated_at = now()
    `);
    inserted += 1;
  }
  console.log(`  ✓ ${inserted} listings upserted`);

  // ---- Refresh materialized view ----
  try {
    await db.execute(sql`refresh materialized view concurrently locality_price_stats`);
    console.log(`  ✓ locality_price_stats refreshed (concurrently)`);
  } catch {
    // First-ever refresh can't be CONCURRENTLY.
    await db.execute(sql`refresh materialized view locality_price_stats`);
    console.log(`  ✓ locality_price_stats refreshed (initial)`);
  }

  // ---- Summary ----
  const stats = await db.execute<{
    locality_id: string;
    bhk: number;
    median_rent: number;
    sample_size: number;
  }>(sql`select locality_id, bhk, median_rent, sample_size from locality_price_stats order by sample_size desc`);
  console.log(`\n→ Median computed for ${stats.length} (locality, bhk) buckets:`);
  for (const r of stats.slice(0, 10)) {
    console.log(
      `  • n=${r.sample_size}, median=₹${r.median_rent.toLocaleString("en-IN")} — ${r.locality_id}`,
    );
  }

  await client.end();
  console.log("\n✓ Seed complete.");
}

main().catch((e) => {
  console.error("seed failed:", e);
  process.exit(1);
});
