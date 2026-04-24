import "server-only";
import { sql } from "drizzle-orm";
import { db } from "../client";
import { locality } from "../schema";

export interface LocalityListItem {
  id: string;
  slug: string;
  name: string;
  lat: number;
  lng: number;
}

export interface LocalityPageData {
  id: string;
  slug: string;
  name: string;
  lat: number;
  lng: number;
  median2bhk: number | null;
  sample2bhk: number;
}

export async function listLocalities(): Promise<LocalityListItem[]> {
  const rows = await db.execute<{
    id: string;
    slug: string;
    name: string;
    lat: number;
    lng: number;
    [key: string]: unknown;
  }>(sql`
    SELECT id, slug, name,
      ST_Y(centroid::geometry) AS lat,
      ST_X(centroid::geometry) AS lng
    FROM locality
    ORDER BY name ASC
  `);
  return rows.map((r) => ({ id: r.id, slug: r.slug, name: r.name, lat: r.lat, lng: r.lng }));
}

export async function getLocalityBySlug(slug: string): Promise<LocalityPageData | null> {
  const rows = await db.execute<{
    id: string;
    slug: string;
    name: string;
    lat: number;
    lng: number;
    median_rent: number | null;
    sample_size: number | null;
    [key: string]: unknown;
  }>(sql`
    SELECT
      loc.id, loc.slug, loc.name,
      ST_Y(loc.centroid::geometry) AS lat,
      ST_X(loc.centroid::geometry) AS lng,
      stats.median_rent,
      stats.sample_size
    FROM locality loc
    LEFT JOIN locality_price_stats stats
      ON stats.locality_id = loc.id AND stats.bhk = 2
    WHERE loc.slug = ${slug}
    LIMIT 1
  `);

  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    lat: row.lat,
    lng: row.lng,
    median2bhk: row.median_rent,
    sample2bhk: row.sample_size ?? 0,
  };
}

export async function listAllLocalitySlugs(): Promise<string[]> {
  const rows = await db.select({ slug: locality.slug }).from(locality);
  return rows.map((r) => r.slug);
}
