/**
 * MagicBricks parser — LIVE.
 *
 * MagicBricks server-side renders BOTH:
 *   - script[type="application/ld+json"] containing an Apartment[] array
 *     (geo lat/lng, address.addressLocality, image, name, url with id)
 *   - one RentAction script per listing with priceSpecification.price (the
 *     rent in INR) and agent.name (lister name)
 *
 * The two arrays are 1:1 in DOM order. We zip them and emit ParsedListing
 * directly from the index page — no detail fetches needed.
 *
 * If MagicBricks ever drops the structured-data scripts, this returns []
 * (loud failure caught by the per-source CI canary).
 *
 * Most MagicBricks listings are broker-posted (mentioned in the previous
 * stub's notes); we set sourceLabel to 'unknown' here and let the v2
 * detector compute it from agent name + cross-listing patterns.
 */
import * as cheerio from "cheerio";
import type { SourceConfig } from "../run";
import type { ParsedListing } from "../types";
import { parseAreaSqft } from "../normalize";

const BASE = "https://www.magicbricks.com";
// MagicBricks robots.txt blocks /*proptype= (wildcard). Their canonical
// city-specific path is allowed and renders the same SSR ld+json.
// 2BHK Bangalore rent: bedroom=2 in the query (no proptype — that's the trap).
const SEED_URL = `${BASE}/property-for-rent-in-bangalore-pppfr?bedroom=2`;

interface MbApartment {
  "@type"?: string;
  name?: string;
  url?: string;
  "@id"?: string;
  numberOfRooms?: string | number;
  image?: string;
  geo?: { latitude?: string | number; longitude?: string | number };
  address?: { addressLocality?: string; addressRegion?: string };
}

interface MbRentAction {
  "@type"?: string;
  agent?: { "@type"?: string; name?: string };
  object?: { "@type"?: string; name?: string };
  priceSpecification?: { price?: number; priceCurrency?: string };
}

function parseLdJsonScripts($: cheerio.CheerioAPI): {
  apartments: MbApartment[];
  rentActions: MbRentAction[];
} {
  const apartments: MbApartment[] = [];
  const rentActions: MbRentAction[] = [];

  $('script[type="application/ld+json"]').each((_i, el) => {
    const text = $(el).contents().text().trim();
    if (!text) return;
    try {
      const data: unknown = JSON.parse(text);
      if (Array.isArray(data)) {
        for (const item of data) {
          if (
            typeof item === "object" &&
            item !== null &&
            (item as { "@type"?: string })["@type"] === "Apartment"
          ) {
            apartments.push(item as MbApartment);
          }
        }
      } else if (typeof data === "object" && data !== null) {
        const obj = data as { "@type"?: string };
        if (obj["@type"] === "RentAction") {
          rentActions.push(data as MbRentAction);
        }
      }
    } catch {
      // bad JSON in one script — skip silently
    }
  });

  return { apartments, rentActions };
}

function extractIdFromUrl(url: string | undefined): string | null {
  if (!url) return null;
  const m = url.match(/[&?]id=([a-zA-Z0-9]+)/);
  return m ? m[1]! : null;
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

/**
 * Heuristic: an "agent" with a 1-2 word name (Salman, Rajesh Kumar) is most
 * likely a person; anything with "broker", "consultancy", "realty", "realtor",
 * "estate", "&" or "Pvt" is a brokerage. We don't set sourceLabel here — that's
 * the v2 detector's job — but we do pass the name through as contactName so the
 * detector has signal.
 */
function toParsed(
  apt: MbApartment,
  ra: MbRentAction | undefined,
): ParsedListing | null {
  const id = extractIdFromUrl(apt.url ?? apt["@id"]);
  const url = apt.url ?? apt["@id"];
  const rentInr = ra?.priceSpecification?.price ?? null;
  const lat = num(apt.geo?.latitude);
  const lng = num(apt.geo?.longitude);
  const localityHint = str(apt.address?.addressLocality);

  if (!id || !url || !rentInr || !localityHint) return null;
  const bhkN = num(apt.numberOfRooms);
  const bhk = bhkN && bhkN >= 1 && bhkN <= 5 ? bhkN : 2;

  // RentAction.object.name often contains "...Bangalore 1240 Sqft" — try to extract.
  const areaSqft = parseAreaSqft(ra?.object?.name ?? null);
  // Building/society name: words between "in <Society>, <Locality>". Best-effort.
  const buildingMatch = ra?.object?.name?.match(/in\s+([^,]+?),\s+/);
  const buildingHint = buildingMatch?.[1]?.trim() ?? null;

  return {
    sourcePlatform: "magicbricks",
    sourceListingId: id,
    sourceUrl: url,
    title: apt.name ?? `${bhk}BHK in ${localityHint}, Bangalore`,
    description: buildingHint ? `${buildingHint}, ${localityHint}` : null,
    bhk,
    rentInr,
    depositInr: null,
    areaSqft,
    floor: null,
    totalFloors: null,
    furnishing: null,
    availableFrom: null,
    lat: lat ?? undefined,
    lng: lng ?? undefined,
    addressLine: buildingHint,
    localityHint,
    photos: apt.image ? [{ url: apt.image, alt: apt.name ?? "Listing photo" }] : [],
    contactPhoneRaw: null,
    contactName: ra?.agent?.name ?? null,
  };
}

export const magicBricksConfig: SourceConfig = {
  platform: "magicbricks",
  seedUrls: [SEED_URL],

  parseIndex(html, currentUrl) {
    // We use the embedded path; this is just the pagination signal.
    const cur = new URL(currentUrl);
    const page = Number(cur.searchParams.get("page") ?? 1);
    cur.searchParams.set("page", String(page + 1));
    // MB max ~50 pages of 2BHK Bangalore — let MAX_PAGES_PER_RUN cap us.
    return { listingUrls: [], nextPageUrl: cur.toString() };
  },

  parseIndexEmbeddedListings(html, _url): ParsedListing[] {
    const $ = cheerio.load(html);
    const { apartments, rentActions } = parseLdJsonScripts($);

    // 1:1 by DOM order. Zip; if lengths differ, emit only as far as both run.
    const n = Math.min(apartments.length, rentActions.length);
    const out: ParsedListing[] = [];
    for (let i = 0; i < n; i++) {
      const parsed = toParsed(apartments[i]!, rentActions[i]);
      if (parsed) out.push(parsed);
    }
    return out;
  },

  parseDetail(_html, _url): ParsedListing | null {
    // Not used — embedded path covers everything.
    return null;
  },
};
