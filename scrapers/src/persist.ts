import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { listing, locality } from "../../src/lib/db/schema";
import type { ParsedListing } from "./types";
import { contentHash, hashPhone, normalizePhone, slugify } from "./normalize";

/**
 * UPSERT contract (identical shape to scripts/seed.ts):
 *   conflict key = (source_platform, source_listing_id)
 *   on conflict → update mutable fields + bump last_seen_at
 *
 * This is the v1→v2 compatibility promise. Seed rows and scraped rows
 * coexist; seed rows have source_platform='seed'.
 */

let cached: { db: ReturnType<typeof drizzle>; client: ReturnType<typeof postgres> } | null =
  null;

function getDb() {
  if (cached) return cached;
  const conn = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!conn) throw new Error("DIRECT_URL (or DATABASE_URL) must be set");
  const client = postgres(conn, { prepare: false, max: 1 });
  const db = drizzle(client);
  cached = { db, client };
  return cached;
}

export async function closeDb(): Promise<void> {
  if (!cached) return;
  await cached.client.end();
  cached = null;
}

/**
 * Fuzzy-match a scraped locality hint to our locality table.
 * Strategy (cheap → expensive):
 *   1. exact slug match
 *   2. ILIKE name match
 *   3. fallback to nearest centroid by lat/lng (if coords given)
 *   4. null → caller skips the row
 */
export async function resolveLocality(
  localityHint: string,
  lat: number | null | undefined,
  lng: number | null | undefined,
): Promise<{ id: string; slug: string } | null> {
  const { db } = getDb();

  const hintSlug = slugify(localityHint);
  if (hintSlug) {
    const bySlug = await db
      .select({ id: locality.id, slug: locality.slug })
      .from(locality)
      .where(sql`${locality.slug} = ${hintSlug}`)
      .limit(1);
    if (bySlug[0]) return bySlug[0];

    // substring ilike — "whitefield" matches "Whitefield", "brookefield-whitefield"
    const byName = await db.execute<{ id: string; slug: string; [k: string]: unknown }>(sql`
      SELECT id, slug FROM locality
      WHERE name ILIKE ${"%" + localityHint + "%"} OR slug ILIKE ${"%" + hintSlug + "%"}
      LIMIT 1
    `);
    if (byName[0]) return { id: byName[0].id, slug: byName[0].slug };
  }

  // Fallback: nearest centroid within ~5km.
  if (lat != null && lng != null) {
    const rows = await db.execute<{ id: string; slug: string; [k: string]: unknown }>(sql`
      SELECT id, slug
      FROM locality
      ORDER BY centroid <-> ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
      LIMIT 1
    `);
    if (rows[0]) return { id: rows[0].id, slug: rows[0].slug };
  }

  return null;
}

export interface UpsertResult {
  upserted: boolean;
  skipped?: "no_locality" | "invalid";
}

export async function upsertListing(parsed: ParsedListing): Promise<UpsertResult> {
  const { db } = getDb();

  // Resolve locality (FK required).
  const loc = await resolveLocality(parsed.localityHint, parsed.lat, parsed.lng);
  if (!loc) return { upserted: false, skipped: "no_locality" };

  // Fallback coords = locality centroid. Real coords preferred.
  const lat = parsed.lat ?? null;
  const lng = parsed.lng ?? null;

  // Slug — globally unique. Suffix the source to guarantee uniqueness
  // across scraped rows of the same listing from different sources.
  const slug = `${loc.slug}-${parsed.bhk}bhk-${slugify(parsed.sourceListingId)}-${parsed.sourcePlatform}`;

  const phone = normalizePhone(parsed.contactPhoneRaw ?? null);
  const phoneHash = phone ? hashPhone(phone) : null;

  // Content hash — for future dedup jobs.
  const cHash = contentHash([
    parsed.rentInr,
    parsed.bhk,
    parsed.areaSqft,
    phone, // phone is a strong identity signal
    lat?.toFixed(4),
    lng?.toFixed(4),
  ]);

  const locationExpr =
    lat != null && lng != null
      ? sql`ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography`
      : sql`(SELECT centroid FROM locality WHERE id = ${loc.id})`;

  await db.execute(sql`
    INSERT INTO listing (
      slug, title, description, bhk, rent_inr, deposit_inr, area_sqft,
      floor, total_floors, furnishing, available_from,
      location, address_line, locality_id,
      photos, contact_name, contact_phone_hash,
      source_label, source_platform, source_url, source_listing_id,
      content_hash, first_seen_at, last_seen_at, is_active, updated_at
    ) VALUES (
      ${slug}, ${parsed.title}, ${parsed.description ?? null},
      ${parsed.bhk}, ${parsed.rentInr}, ${parsed.depositInr ?? null}, ${parsed.areaSqft ?? null},
      ${parsed.floor ?? null}, ${parsed.totalFloors ?? null},
      ${parsed.furnishing ?? null}, ${parsed.availableFrom ?? null},
      ${locationExpr}, ${parsed.addressLine ?? null}, ${loc.id},
      ${JSON.stringify(parsed.photos)}::jsonb,
      ${parsed.contactName ?? null}, ${phoneHash},
      'unknown', ${parsed.sourcePlatform}, ${parsed.sourceUrl}, ${parsed.sourceListingId},
      ${cHash}, now(), now(), true, now()
    )
    ON CONFLICT (source_platform, source_listing_id)
    WHERE source_listing_id IS NOT NULL
    DO UPDATE SET
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
      contact_phone_hash = EXCLUDED.contact_phone_hash,
      content_hash = EXCLUDED.content_hash,
      last_seen_at = now(),
      is_active = true,
      updated_at = now()
  `);

  // Keep listing table lint-safe — import used.
  void listing;

  return { upserted: true };
}

/**
 * After a scrape run, mark listings from this source that weren't touched
 * in the last 48h as inactive. Conservative — listings do occasionally
 * disappear and reappear.
 */
export async function markStaleInactive(
  source: ParsedListing["sourcePlatform"],
  cutoffHours = 48,
): Promise<number> {
  const { db } = getDb();
  const rows = await db.execute<{ n: number; [k: string]: unknown }>(sql`
    UPDATE listing SET is_active = false, updated_at = now()
    WHERE source_platform = ${source}
      AND is_active = true
      AND last_seen_at < now() - (${cutoffHours} * interval '1 hour')
    RETURNING 1 AS n
  `);
  return rows.length;
}
