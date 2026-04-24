import "server-only";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "../client";
import { listing } from "../schema";
import { computePriceBadge, type PriceBadge } from "@/lib/truth/price-anomaly";
import { computeSourceBadge, type SourceBadge } from "@/lib/truth/source-label";

export interface ListingCardDTO {
  id: string;
  slug: string;
  title: string;
  rentInr: number;
  bhk: number;
  lat: number;
  lng: number;
  photoUrl: string | null;
  localityName: string;
  localitySlug: string;
  priceBadge: PriceBadge;
  sourceBadge: SourceBadge;
}

export interface ListingDetailDTO extends ListingCardDTO {
  description: string | null;
  depositInr: number | null;
  areaSqft: number | null;
  floor: number | null;
  totalFloors: number | null;
  furnishing: string | null;
  availableFrom: string | null;
  addressLine: string | null;
  photos: Array<{ url: string; alt: string }>;
  contactName: string | null;
}

export interface ListListingsParams {
  /** [west, south, east, north] in WGS84 degrees. */
  bbox?: [number, number, number, number];
  localitySlug?: string;
  bhk?: number;
  limit?: number;
}

// Raw row shape returned by the JOIN. Kept private to this module.
type RawListingRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  rent_inr: number;
  deposit_inr: number | null;
  area_sqft: number | null;
  floor: number | null;
  total_floors: number | null;
  furnishing: string | null;
  available_from: string | null;
  bhk: number;
  lat: number;
  lng: number;
  address_line: string | null;
  locality_slug: string;
  locality_name: string;
  photos: Array<{ url: string; alt: string }>;
  contact_name: string | null;
  source_label: string;
  source_confidence: number | null;
  median_rent: number | null;
  sample_size: number;
  [key: string]: unknown;
};

function firstPhotoUrl(photos: Array<{ url: string; alt: string }>): string | null {
  return photos[0]?.url ?? null;
}

function toCard(row: RawListingRow): ListingCardDTO {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    rentInr: row.rent_inr,
    bhk: row.bhk,
    lat: row.lat,
    lng: row.lng,
    photoUrl: firstPhotoUrl(row.photos),
    localityName: row.locality_name,
    localitySlug: row.locality_slug,
    priceBadge: computePriceBadge({
      rentInr: row.rent_inr,
      medianRent: row.median_rent,
      sampleSize: row.sample_size,
    }),
    sourceBadge: computeSourceBadge({
      sourceLabel: row.source_label,
      sourceConfidence: row.source_confidence,
    }),
  };
}

function toDetail(row: RawListingRow): ListingDetailDTO {
  return {
    ...toCard(row),
    description: row.description,
    depositInr: row.deposit_inr,
    areaSqft: row.area_sqft,
    floor: row.floor,
    totalFloors: row.total_floors,
    furnishing: row.furnishing,
    availableFrom: row.available_from,
    addressLine: row.address_line,
    photos: row.photos,
    contactName: row.contact_name,
  };
}

/**
 * Single source of truth for listing reads. Every route handler + server
 * component uses this. Badges precomputed server-side.
 */
export async function listListings(
  params: ListListingsParams = {},
): Promise<{ listings: ListingCardDTO[]; totalMatched: number }> {
  const { bbox, localitySlug, bhk, limit = 200 } = params;
  const effectiveLimit = Math.min(Math.max(limit, 1), 500);

  const conditions: ReturnType<typeof sql>[] = [sql`l.is_active = true`];

  if (bbox) {
    const [w, s, e, n] = bbox;
    conditions.push(
      sql`ST_Intersects(l.location, ST_MakeEnvelope(${w}, ${s}, ${e}, ${n}, 4326)::geography)`,
    );
  }
  if (localitySlug) {
    conditions.push(sql`loc.slug = ${localitySlug}`);
  }
  if (bhk != null) {
    conditions.push(sql`l.bhk = ${bhk}`);
  }

  const whereSql = sql.join(conditions, sql` AND `);

  const rows = await db.execute<RawListingRow>(sql`
    SELECT
      l.id, l.slug, l.title, l.description, l.rent_inr, l.deposit_inr,
      l.area_sqft, l.floor, l.total_floors, l.furnishing, l.available_from,
      l.bhk,
      ST_Y(l.location::geometry) AS lat,
      ST_X(l.location::geometry) AS lng,
      l.address_line,
      l.photos, l.contact_name, l.source_label, l.source_confidence,
      loc.slug AS locality_slug, loc.name AS locality_name,
      COALESCE(stats.median_rent, NULL) AS median_rent,
      COALESCE(stats.sample_size, 0) AS sample_size
    FROM listing l
    JOIN locality loc ON loc.id = l.locality_id
    LEFT JOIN locality_price_stats stats
      ON stats.locality_id = l.locality_id AND stats.bhk = l.bhk
    WHERE ${whereSql}
    ORDER BY l.created_at DESC
    LIMIT ${effectiveLimit}
  `);

  const listings = rows.map(toCard);
  return { listings, totalMatched: listings.length };
}

/** Fetch detail by slug. Returns null if not found or inactive. */
export async function getListingBySlug(slug: string): Promise<ListingDetailDTO | null> {
  const rows = await db.execute<RawListingRow>(sql`
    SELECT
      l.id, l.slug, l.title, l.description, l.rent_inr, l.deposit_inr,
      l.area_sqft, l.floor, l.total_floors, l.furnishing, l.available_from,
      l.bhk,
      ST_Y(l.location::geometry) AS lat,
      ST_X(l.location::geometry) AS lng,
      l.address_line,
      l.photos, l.contact_name, l.source_label, l.source_confidence,
      loc.slug AS locality_slug, loc.name AS locality_name,
      COALESCE(stats.median_rent, NULL) AS median_rent,
      COALESCE(stats.sample_size, 0) AS sample_size
    FROM listing l
    JOIN locality loc ON loc.id = l.locality_id
    LEFT JOIN locality_price_stats stats
      ON stats.locality_id = l.locality_id AND stats.bhk = l.bhk
    WHERE l.slug = ${slug} AND l.is_active = true
    LIMIT 1
  `);

  const row = rows[0];
  return row ? toDetail(row) : null;
}

/** All active listing slugs + update times — used by sitemap. */
export async function listAllSlugsForSitemap(): Promise<Array<{ slug: string; updatedAt: Date }>> {
  const rows = await db
    .select({ slug: listing.slug, updatedAt: listing.updatedAt })
    .from(listing)
    .where(eq(listing.isActive, true))
    .orderBy(desc(listing.updatedAt));
  return rows;
}
