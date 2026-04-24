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
import { locality, listing } from "../src/lib/db/schema";

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

  // ---- Listings (UPSERT on (source_platform, source_listing_id)) ----
  let inserted = 0;
  for (const item of listings) {
    const localityId = localityIdBySlug.get(item.localitySlug);
    if (!localityId) {
      console.warn(`  ⚠ skipping ${item.slug}: unknown locality ${item.localitySlug}`);
      continue;
    }

    const sourceListingId = `seed-${item.slug}`;

    await db
      .insert(listing)
      .values({
        slug: item.slug,
        title: item.title,
        description: item.description ?? null,
        bhk: item.bhk,
        rentInr: item.rentInr,
        depositInr: item.depositInr ?? null,
        areaSqft: item.areaSqft ?? null,
        floor: item.floor ?? null,
        totalFloors: item.totalFloors ?? null,
        furnishing: item.furnishing ?? null,
        availableFrom: item.availableFrom ?? null,
        location: { lat: item.lat, lng: item.lng },
        addressLine: item.addressLine ?? null,
        localityId,
        photos: item.photos,
        contactName: item.contactName ?? null,
        sourceLabel: item.sourceLabel,
        sourcePlatform: "seed",
        sourceListingId,
        firstSeenAt: new Date(),
        lastSeenAt: new Date(),
        isActive: true,
      })
      .onConflictDoUpdate({
        target: [listing.sourcePlatform, listing.sourceListingId],
        set: {
          slug: item.slug,
          title: item.title,
          description: item.description ?? null,
          rentInr: item.rentInr,
          depositInr: item.depositInr ?? null,
          areaSqft: item.areaSqft ?? null,
          floor: item.floor ?? null,
          totalFloors: item.totalFloors ?? null,
          furnishing: item.furnishing ?? null,
          availableFrom: item.availableFrom ?? null,
          location: { lat: item.lat, lng: item.lng },
          addressLine: item.addressLine ?? null,
          localityId,
          photos: item.photos,
          contactName: item.contactName ?? null,
          sourceLabel: item.sourceLabel,
          lastSeenAt: new Date(),
          isActive: true,
          updatedAt: new Date(),
        },
      });
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
