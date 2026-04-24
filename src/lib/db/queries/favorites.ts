import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../client";
import { favorite } from "../schema";
import type { ListingCardDTO } from "./listings";
import { computePriceBadge } from "@/lib/truth/price-anomaly";
import { computeSourceBadge } from "@/lib/truth/source-label";

type RawFavoriteRow = {
  id: string;
  slug: string;
  title: string;
  rent_inr: number;
  bhk: number;
  lat: number;
  lng: number;
  photos: Array<{ url: string; alt: string }>;
  source_label: string;
  source_confidence: number | null;
  locality_slug: string;
  locality_name: string;
  median_rent: number | null;
  sample_size: number;
  [key: string]: unknown;
};

export async function listFavoritesForUser(userId: string): Promise<ListingCardDTO[]> {
  const rows = await db.execute<RawFavoriteRow>(sql`
    SELECT
      l.id, l.slug, l.title, l.rent_inr, l.bhk,
      ST_Y(l.location::geometry) AS lat,
      ST_X(l.location::geometry) AS lng,
      l.photos, l.source_label, l.source_confidence,
      loc.slug AS locality_slug, loc.name AS locality_name,
      COALESCE(stats.median_rent, NULL) AS median_rent,
      COALESCE(stats.sample_size, 0) AS sample_size
    FROM favorite f
    JOIN listing l ON l.id = f.listing_id AND l.is_active = true
    JOIN locality loc ON loc.id = l.locality_id
    LEFT JOIN locality_price_stats stats
      ON stats.locality_id = l.locality_id AND stats.bhk = l.bhk
    WHERE f.user_id = ${userId}
    ORDER BY f.created_at DESC
  `);

  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    rentInr: row.rent_inr,
    bhk: row.bhk,
    lat: row.lat,
    lng: row.lng,
    photoUrl: row.photos[0]?.url ?? null,
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
  }));
}

export async function addFavorite(userId: string, listingId: string): Promise<void> {
  await db
    .insert(favorite)
    .values({ userId, listingId })
    .onConflictDoNothing({ target: [favorite.userId, favorite.listingId] });
}

export async function removeFavorite(userId: string, listingId: string): Promise<void> {
  await db
    .delete(favorite)
    .where(and(eq(favorite.userId, userId), eq(favorite.listingId, listingId)));
}

export async function isFavorited(userId: string, listingId: string): Promise<boolean> {
  const rows = await db
    .select({ listingId: favorite.listingId })
    .from(favorite)
    .where(and(eq(favorite.userId, userId), eq(favorite.listingId, listingId)))
    .limit(1);
  return rows.length > 0;
}
