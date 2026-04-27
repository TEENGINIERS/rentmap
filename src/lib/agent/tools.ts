import "server-only";
import { Type, type FunctionDeclaration } from "@google/genai";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { computePriceBadge } from "@/lib/truth/price-anomaly";
import { computeSourceBadge } from "@/lib/truth/source-label";
import type { ListingCardDTO } from "@/lib/db/queries/listings";

// ============================================================================
// Function declarations — sent to Gemini so the model knows what tools exist.
// ============================================================================

export const TOOL_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: "fuzzy_search",
    description:
      "Search rental listings by free-text query plus optional filters (BHK, max rent, locality, geographic radius). Returns matching listings with id/title/rent/lat/lng/locality and computed price/source badges. ALWAYS call this when the user is looking for rentals.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: {
          type: Type.STRING,
          description:
            'Free-text search (e.g. "fully furnished", "owner direct", "Koramangala"). Use empty string "" if you only want filter-based search.',
        },
        bhk: {
          type: Type.INTEGER,
          description: "Filter to listings with this BHK (1..5). Omit for all.",
        },
        max_rent_inr: {
          type: Type.INTEGER,
          description: "Maximum monthly rent in INR. Omit for no cap.",
        },
        locality_slug: {
          type: Type.STRING,
          description:
            'Filter by locality slug from find_area, e.g. "koramangala". Omit for all localities.',
        },
        near_lat: {
          type: Type.NUMBER,
          description: "Center latitude for radius search.",
        },
        near_lng: {
          type: Type.NUMBER,
          description: "Center longitude for radius search.",
        },
        max_distance_km: {
          type: Type.NUMBER,
          description:
            "Maximum distance (km) from (near_lat, near_lng). Requires near_lat+near_lng. Default 5.",
        },
        limit: {
          type: Type.INTEGER,
          description: "Max results to return (1..50). Default 30.",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "geocode",
    description:
      'Convert a place name to latitude/longitude using OpenStreetMap Nominatim. Use this for unknown places, addresses, or landmarks. For known Bangalore localities, prefer find_area.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        place: {
          type: Type.STRING,
          description: 'Place name, address, or landmark (e.g. "Koramangala 5th Block", "Bangalore International Airport").',
        },
      },
      required: ["place"],
    },
  },
  {
    name: "find_area",
    description:
      "Look up a Bangalore locality from the FastFlats database. Returns centroid coordinates + slug. Use this for known neighborhoods (Koramangala, Whitefield, HSR, Indiranagar, etc.) — it is faster and more accurate than geocode for these.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING, description: "Locality name (case-insensitive, fuzzy match)." },
      },
      required: ["name"],
    },
  },
  {
    name: "distance_matrix",
    description:
      "Compute haversine distance (km, as the crow flies) from one origin to many destination points. Use to filter or rank listings by distance.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        origin: {
          type: Type.OBJECT,
          properties: {
            lat: { type: Type.NUMBER },
            lng: { type: Type.NUMBER },
          },
          required: ["lat", "lng"],
        },
        destinations: {
          type: Type.ARRAY,
          description: "Up to 50 destination points.",
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING, description: "Caller-provided identifier (e.g. listing id)." },
              lat: { type: Type.NUMBER },
              lng: { type: Type.NUMBER },
            },
            required: ["lat", "lng"],
          },
        },
      },
      required: ["origin", "destinations"],
    },
  },
  {
    name: "nearby_places",
    description:
      "Find nearby points of interest (metro stations, malls, hospitals, restaurants, schools, banks) around a coordinate using OpenStreetMap. Use to add color to a recommendation.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        lat: { type: Type.NUMBER },
        lng: { type: Type.NUMBER },
        category: {
          type: Type.STRING,
          description: "One of: metro, mall, hospital, restaurant, school, bank, park.",
        },
        radius_m: {
          type: Type.INTEGER,
          description:
            "Search radius in meters. Default 2500, max 5000. Bangalore is sprawly — use 2500-4000 for metro/mall, 1500-2000 for restaurants.",
        },
      },
      required: ["lat", "lng", "category"],
    },
  },
];

// ============================================================================
// Side effects — accumulated across a single chat turn so the API can hand
// them to the client (map flies, marker updates, POI overlays).
// ============================================================================

export interface ToolSideEffects {
  listings: ListingCardDTO[];
  focus: { lat: number; lng: number; zoom?: number } | null;
  pois: Array<{ name: string; lat: number; lng: number; category: string }>;
}

export function emptySideEffects(): ToolSideEffects {
  return { listings: [], focus: null, pois: [] };
}

// Merge: listings deduped by id, focus = last-write-wins, pois appended.
export function mergeSideEffects(acc: ToolSideEffects, next: Partial<ToolSideEffects>): void {
  if (next.listings?.length) {
    const seen = new Set(acc.listings.map((l) => l.id));
    for (const l of next.listings) if (!seen.has(l.id)) acc.listings.push(l);
  }
  if (next.focus) acc.focus = next.focus;
  if (next.pois?.length) acc.pois.push(...next.pois);
}

// ============================================================================
// Tool dispatch
// ============================================================================

type ToolArgs = Record<string, unknown>;

export async function executeTool(
  name: string,
  args: ToolArgs,
): Promise<{ result: unknown; effects: Partial<ToolSideEffects> }> {
  try {
    switch (name) {
      case "fuzzy_search":
        return await execFuzzySearch(args);
      case "geocode":
        return await execGeocode(args);
      case "find_area":
        return await execFindArea(args);
      case "distance_matrix":
        return execDistanceMatrix(args);
      case "nearby_places":
        return await execNearbyPlaces(args);
      default:
        return { result: { error: `unknown tool: ${name}` }, effects: {} };
    }
  } catch (e) {
    return {
      result: { error: (e as Error).message ?? "tool failed" },
      effects: {},
    };
  }
}

// ============================================================================
// fuzzy_search — DB query
// ============================================================================

type RawRow = {
  id: string;
  slug: string;
  title: string;
  rent_inr: number;
  bhk: number;
  lat: number;
  lng: number;
  photos: Array<{ url: string; alt: string }>;
  locality_slug: string;
  locality_name: string;
  source_label: string;
  source_confidence: number | null;
  median_rent: number | null;
  sample_size: number;
  [key: string]: unknown;
};

function toCard(row: RawRow): ListingCardDTO {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    rentInr: row.rent_inr,
    bhk: row.bhk,
    lat: row.lat,
    lng: row.lng,
    photoUrl: row.photos?.[0]?.url ?? null,
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

async function execFuzzySearch(args: ToolArgs) {
  const query = String(args.query ?? "").trim();
  const bhk = args.bhk != null ? Number(args.bhk) : null;
  const maxRent = args.max_rent_inr != null ? Number(args.max_rent_inr) : null;
  const localitySlug = args.locality_slug != null ? String(args.locality_slug) : null;
  const nearLat = args.near_lat != null ? Number(args.near_lat) : null;
  const nearLng = args.near_lng != null ? Number(args.near_lng) : null;
  const maxDistKm =
    args.max_distance_km != null ? Number(args.max_distance_km) : nearLat != null ? 5 : null;
  const limit = Math.min(Math.max(Number(args.limit ?? 30), 1), 50);

  const conds: ReturnType<typeof sql>[] = [sql`l.is_active = true`];

  if (query.length > 0) {
    const q = `%${query}%`;
    conds.push(
      sql`(l.title ILIKE ${q} OR l.description ILIKE ${q} OR loc.name ILIKE ${q} OR l.address_line ILIKE ${q})`,
    );
  }
  if (bhk != null && bhk >= 1 && bhk <= 5) conds.push(sql`l.bhk = ${bhk}`);
  if (maxRent != null && maxRent > 0) conds.push(sql`l.rent_inr <= ${maxRent}`);
  if (localitySlug) conds.push(sql`loc.slug = ${localitySlug}`);

  let orderBy = sql`l.created_at DESC`;
  if (nearLat != null && nearLng != null) {
    const distExpr = sql`ST_Distance(l.location, ST_SetSRID(ST_MakePoint(${nearLng}, ${nearLat}), 4326)::geography)`;
    if (maxDistKm != null) conds.push(sql`${distExpr} <= ${maxDistKm * 1000}`);
    orderBy = distExpr;
  }

  const whereSql = sql.join(conds, sql` AND `);

  const rows = await db.execute<RawRow>(sql`
    SELECT
      l.id, l.slug, l.title, l.rent_inr, l.bhk,
      ST_Y(l.location::geometry) AS lat,
      ST_X(l.location::geometry) AS lng,
      l.photos,
      loc.slug AS locality_slug, loc.name AS locality_name,
      l.source_label, l.source_confidence,
      stats.median_rent, COALESCE(stats.sample_size, 0) AS sample_size
    FROM listing l
    JOIN locality loc ON loc.id = l.locality_id
    LEFT JOIN locality_price_stats stats
      ON stats.locality_id = l.locality_id AND stats.bhk = l.bhk
    WHERE ${whereSql}
    ORDER BY ${orderBy}
    LIMIT ${limit}
  `);

  const cards = rows.map(toCard);

  // Slim form for the LLM (omits photo URL, just metadata).
  const slim = cards.map((c) => ({
    id: c.id,
    slug: c.slug,
    title: c.title,
    rent_inr: c.rentInr,
    bhk: c.bhk,
    lat: c.lat,
    lng: c.lng,
    locality: c.localityName,
    locality_slug: c.localitySlug,
    price_badge: c.priceBadge.variant,
    source_badge: c.sourceBadge.variant,
  }));

  return {
    result: { count: cards.length, listings: slim },
    effects: { listings: cards },
  };
}

// ============================================================================
// geocode — Nominatim
// ============================================================================

const NOMINATIM_UA = "FastFlats/1.0 (rentmap chat agent)";

async function execGeocode(args: ToolArgs) {
  const placeRaw = String(args.place ?? "").trim();
  if (!placeRaw) return { result: { error: "place is required" }, effects: {} };

  const place = /bangalore|bengaluru/i.test(placeRaw) ? placeRaw : `${placeRaw}, Bangalore, India`;
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(place)}&format=json&limit=1&addressdetails=1`;

  const res = await fetch(url, {
    headers: { "User-Agent": NOMINATIM_UA, Accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) {
    return { result: { error: `geocode http ${res.status}` }, effects: {} };
  }
  const data = (await res.json()) as Array<{
    lat: string;
    lon: string;
    display_name: string;
    boundingbox?: [string, string, string, string];
  }>;

  const hit = data[0];
  if (!hit) return { result: { error: "no match", place }, effects: {} };

  const lat = Number(hit.lat);
  const lng = Number(hit.lon);
  return {
    result: {
      place,
      lat,
      lng,
      display_name: hit.display_name,
      bbox: hit.boundingbox?.map(Number),
    },
    effects: { focus: { lat, lng, zoom: 13 } },
  };
}

// ============================================================================
// find_area — DB locality lookup
// ============================================================================

async function execFindArea(args: ToolArgs) {
  const name = String(args.name ?? "").trim();
  if (!name) return { result: { error: "name is required" }, effects: {} };

  const rows = await db.execute<{
    id: string;
    slug: string;
    name: string;
    lat: number;
    lng: number;
    [k: string]: unknown;
  }>(sql`
    SELECT id, slug, name,
      ST_Y(centroid::geometry) AS lat,
      ST_X(centroid::geometry) AS lng
    FROM locality
    WHERE name ILIKE ${"%" + name + "%"} OR slug ILIKE ${"%" + name.toLowerCase().replace(/\s+/g, "-") + "%"}
    ORDER BY length(name) ASC
    LIMIT 5
  `);

  if (rows.length === 0) {
    return { result: { error: "no locality matched", name }, effects: {} };
  }

  const top = rows[0]!;
  return {
    result: {
      matches: rows.map((r) => ({ slug: r.slug, name: r.name, lat: r.lat, lng: r.lng })),
      best: { slug: top.slug, name: top.name, lat: top.lat, lng: top.lng },
    },
    effects: { focus: { lat: top.lat, lng: top.lng, zoom: 14 } },
  };
}

// ============================================================================
// distance_matrix — pure haversine
// ============================================================================

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371; // km
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function execDistanceMatrix(args: ToolArgs) {
  const origin = args.origin as { lat: number; lng: number } | undefined;
  const destinations = args.destinations as Array<{ id?: string; lat: number; lng: number }> | undefined;
  if (!origin || !destinations) {
    return { result: { error: "origin and destinations are required" }, effects: {} };
  }
  const distances = destinations.slice(0, 50).map((d, i) => ({
    id: d.id ?? String(i),
    distance_km: Math.round(haversineKm(origin, d) * 100) / 100,
  }));
  return { result: { distances }, effects: {} };
}

// ============================================================================
// nearby_places — Overpass API
// ============================================================================

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

const OVERPASS_FILTERS: Record<string, string> = {
  metro:
    'node["railway"="station"]["station"="subway"];node["public_transport"="station"]["station"="subway"];node["railway"="subway_entrance"]',
  mall: 'node["shop"="mall"];way["shop"="mall"]',
  hospital: 'node["amenity"="hospital"];way["amenity"="hospital"]',
  restaurant: 'node["amenity"="restaurant"]',
  school: 'node["amenity"="school"];way["amenity"="school"]',
  bank: 'node["amenity"="bank"];node["amenity"="atm"]',
  park: 'way["leisure"="park"];node["leisure"="park"]',
};

async function execNearbyPlaces(args: ToolArgs) {
  const lat = Number(args.lat);
  const lng = Number(args.lng);
  const category = String(args.category ?? "").toLowerCase();
  const radius = Math.min(Math.max(Number(args.radius_m ?? 2500), 100), 5000);

  const filter = OVERPASS_FILTERS[category];
  if (!filter) {
    return {
      result: { error: `unknown category: ${category}`, valid: Object.keys(OVERPASS_FILTERS) },
      effects: {},
    };
  }

  // Build QL: wrap each part with (around:r,lat,lng)
  const parts = filter
    .split(";")
    .map((p) => `${p}(around:${radius},${lat},${lng});`)
    .join("");
  const query = `[out:json][timeout:10];(${parts});out center 25;`;

  const res = await fetch(OVERPASS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      "User-Agent": NOMINATIM_UA,
    },
    body: `data=${encodeURIComponent(query)}`,
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) {
    return {
      result: { error: `overpass http ${res.status}` },
      effects: {},
    };
  }
  const data = (await res.json()) as {
    elements: Array<{
      id: number;
      type: string;
      lat?: number;
      lon?: number;
      center?: { lat: number; lon: number };
      tags?: Record<string, string>;
    }>;
  };

  const places = (data.elements ?? [])
    .map((el) => {
      const plat = el.lat ?? el.center?.lat;
      const plng = el.lon ?? el.center?.lon;
      const name = el.tags?.name;
      if (plat == null || plng == null || !name) return null;
      const dist = haversineKm({ lat, lng }, { lat: plat, lng: plng });
      return { name, lat: plat, lng: plng, category, distance_km: Math.round(dist * 100) / 100 };
    })
    .filter((p): p is NonNullable<typeof p> => p !== null)
    .sort((a, b) => a.distance_km - b.distance_km)
    .slice(0, 15);

  return {
    result: { count: places.length, places },
    effects: { pois: places.map(({ name, lat, lng, category }) => ({ name, lat, lng, category })) },
  };
}
