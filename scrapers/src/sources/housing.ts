/**
 * Housing.com parser — the canonical v2.0 source.
 *
 * Why this is the reference: Housing is built on Next.js and embeds a
 * `__NEXT_DATA__` JSON blob in every HTML response. No HTML parsing
 * required for the listing facts; we hydrate from structured data.
 *
 * Trade-off: the blob shape is internal and *can* change. We defend
 * with optional chaining, runtime shape guards, and graceful skip on
 * unrecognized entries. A CI canary job should scrape 1 page daily and
 * alert if parsed-listing count drops to zero.
 *
 * Current known schema (2026-04): listings live under
 *   props.pageProps.searchData.properties[]
 * with fields: id, configName, rent, sizeSqft, localityName, ...
 *
 * If that path breaks, this parser returns [] and the run records zero
 * parsed listings — loud failure, not silent wrong data.
 */

import * as cheerio from "cheerio";
import type { SourceConfig } from "../run";
import type { ParsedListing } from "../types";
import { parseBhk, parseFurnishing, slugify } from "../normalize";

const BASE = "https://housing.com";

// Start URL for 2BHK rental search in Bangalore. Housing uses server-side
// filters so this single URL is our seed.
const SEED_URL = `${BASE}/in/rent/searches/page-bangalore-2-bhk-res-R2d95`;

function extractNextData(html: string): unknown {
  const $ = cheerio.load(html);
  const script = $("script#__NEXT_DATA__").first().text();
  if (!script) return null;
  try {
    return JSON.parse(script);
  } catch {
    return null;
  }
}

function get<T>(o: unknown, path: (string | number)[]): T | undefined {
  let cur: unknown = o;
  for (const p of path) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string | number, unknown>)[p];
  }
  return cur as T | undefined;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/[,\s₹]/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

interface RawProperty {
  id?: string | number;
  slug?: string;
  configName?: string; // e.g. "2 BHK Apartment"
  title?: string;
  description?: string;
  rent?: number | string;
  deposit?: number | string;
  sizeSqft?: number | string;
  carpetArea?: number | string;
  floor?: number;
  totalFloors?: number;
  furnishing?: string;
  availableFrom?: string;
  latitude?: number;
  longitude?: number;
  localityName?: string;
  address?: string;
  photos?: Array<{ url?: string; caption?: string }>;
  ownerName?: string;
  ownerMobile?: string;
  ownerPhone?: string;
}

function toParsed(raw: RawProperty): ParsedListing | null {
  const id = raw.id != null ? String(raw.id) : null;
  const rent = num(raw.rent);
  const bhk = parseBhk(raw.configName ?? raw.title ?? null);
  const localityHint = str(raw.localityName);
  if (!id || !rent || !bhk || bhk !== 2 || !localityHint) return null;

  const sourceUrl = raw.slug
    ? `${BASE}/in/rent/p/${slugify(raw.slug)}-${id}`
    : `${BASE}/in/rent/id/${id}`;

  const photos: ParsedListing["photos"] = (raw.photos ?? [])
    .map((p) => ({ url: str(p.url) ?? "", alt: str(p.caption) ?? "Listing photo" }))
    .filter((p) => p.url);

  return {
    sourcePlatform: "housing",
    sourceListingId: id,
    sourceUrl,
    title: str(raw.title) ?? `${bhk}BHK in ${localityHint}`,
    description: str(raw.description) ?? null,
    bhk,
    rentInr: rent,
    depositInr: num(raw.deposit),
    areaSqft: num(raw.carpetArea) ?? num(raw.sizeSqft),
    floor: raw.floor ?? null,
    totalFloors: raw.totalFloors ?? null,
    furnishing: parseFurnishing(raw.furnishing),
    availableFrom: str(raw.availableFrom),
    lat: typeof raw.latitude === "number" ? raw.latitude : undefined,
    lng: typeof raw.longitude === "number" ? raw.longitude : undefined,
    addressLine: str(raw.address),
    localityHint,
    photos,
    contactPhoneRaw: str(raw.ownerMobile ?? raw.ownerPhone),
    contactName: str(raw.ownerName),
  };
}

export const housingConfig: SourceConfig = {
  platform: "housing",
  seedUrls: [SEED_URL],

  parseIndex(html, currentUrl) {
    // We use the embedded path for Housing — this is a fallback if the blob
    // is missing. Extract basic detail URLs from HTML.
    const $ = cheerio.load(html);
    const listingUrls = $('a[href*="/rent/p/"]')
      .map((_, a) => $(a).attr("href"))
      .get()
      .filter(Boolean)
      .map((href) => (href!.startsWith("http") ? href! : `${BASE}${href}`));

    // Pagination: look for ?page=N in HTML.
    const cur = new URL(currentUrl);
    const pageParam = cur.searchParams.get("page");
    const nextPage = pageParam ? Number(pageParam) + 1 : 2;
    cur.searchParams.set("page", String(nextPage));
    const nextPageUrl = listingUrls.length > 0 ? cur.toString() : null;

    return { listingUrls: [...new Set(listingUrls)], nextPageUrl };
  },

  parseIndexEmbeddedListings(html, _url): ParsedListing[] {
    const data = extractNextData(html);
    if (!data) return [];

    const properties = get<RawProperty[]>(data, [
      "props",
      "pageProps",
      "searchData",
      "properties",
    ]);
    if (!Array.isArray(properties)) return [];

    const out: ParsedListing[] = [];
    for (const raw of properties) {
      const parsed = toParsed(raw);
      if (parsed) out.push(parsed);
    }
    return out;
  },

  parseDetail(html, url) {
    const data = extractNextData(html);
    if (!data) return null;
    const property = get<RawProperty>(data, ["props", "pageProps", "property"]);
    if (!property) return null;
    const parsed = toParsed(property);
    if (parsed) parsed.sourceUrl = url;
    return parsed;
  },
};
