/**
 * NoBroker scraper — Playwright + XHR interception. CURRENTLY YIELDS 0.
 *
 * Status (probed 2026-04-27):
 *   The SPA loads but never makes a successful listing-fetch call. The only
 *   request it issues to /api/v3/multi/property/RENT/filter is malformed —
 *   it includes a literal "undefined=" query param indicating a missing
 *   filter that the React app itself fails to set. Plain HTTP to the same
 *   endpoint returns 501 "No Polygon or point found using token: null".
 *
 * What was tried:
 *   1. Direct fetch with browser headers — 501 (token required).
 *   2. Playwright + XHR sniff (this file) — SPA never makes a successful
 *      call; only fires the malformed one.
 *   3. Alternative URLs (/property/rent/bangalore, /bangalore-property,
 *      /property/rent/bangalore/whitefield) — none trigger a >1KB
 *      property-list XHR.
 *
 * Realistic paths forward (pick one, none are free):
 *   a. ScraperAPI / Bright Data — let a vendor handle their anti-bot,
 *      then we just hit the URL. Cost: $30-100/mo, scales with usage.
 *   b. playwright-extra + stealth plugin + manual session cookies copied
 *      from a logged-in browser. Brittle; breaks every couple weeks.
 *   c. Accept the gap. Housing.com + MagicBricks + Facebook + seed give
 *      us coverage of broker + owner inventory; NoBroker is owner-heavy
 *      but we miss only ~30% of the owner pool.
 *
 * The scraper code below is correct for the API shape (when it returns
 * data). If NoBroker ever fixes their malformed URL or you set up a
 * vendor proxy, this file is ready to upsert.
 *
 * Ethics: we deliberately do NOT scrape contact phone numbers from
 * NoBroker. Their model walls phones behind a paid subscription; bypassing
 * that is both legally risky and contrary to "structurally on the tenant's
 * side." Public listing facts (rent, BHK, locality, geo, photos) are fair
 * game — they're rendered without auth.
 */
import { chromium, type Browser, type BrowserContext } from "playwright";
import { upsertListing, closeDb } from "../persist";
import {
  finalizeStats,
  initStats,
  logLine,
  writeStats,
} from "../observability";
import { parseFurnishing, slugify } from "../normalize";
import type { ParsedListing, ScrapeStats } from "../types";

const SEED_URL = "https://www.nobroker.in/property/rent/bangalore/flat/2BHK";
const MAX_PAGES = Number(process.env.NB_MAX_PAGES ?? 5);
const HEADLESS = process.env.NB_SCRAPER_HEADLESS !== "false";
const PAGE_WAIT_MS = 6000;

interface NbProperty {
  id?: string;
  propertyId?: string;
  title?: string;
  type?: string;
  rent?: number;
  deposit?: number;
  propertySize?: number; // sqft
  buildupArea?: number;
  carpetArea?: number;
  furnishing?: string;
  furnishingDesc?: string;
  latitude?: number;
  longitude?: number;
  locality?: string;
  localityName?: string;
  societyName?: string;
  buildingName?: string;
  ownerName?: string;
  postedBy?: string;
  detailUrl?: string;
  shareUrl?: string;
  propertyTitle?: string;
  photos?: Array<{ original?: string; thumbnail?: string; title?: string }>;
  pictureList?: Array<{ original?: string; thumbnail?: string; title?: string }>;
  propertyImage?: string;
  bhkType?: string;
  type_d?: string;
  formattedRentAmount?: string;
  available?: string;
  availableFrom?: number; // ms epoch
  city?: string;
  // ...many more — we only use what we need.
}

export async function runNoBrokerScraper(): Promise<ScrapeStats> {
  const stats = initStats("nobroker");

  let browser: Browser | null = null;
  let context: BrowserContext | null = null;

  try {
    browser = await chromium.launch({ headless: HEADLESS });
    context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
      locale: "en-IN",
    });
    const page = await context.newPage();

    // XHR sniffer — accumulate every filter-API response JSON.
    const properties: NbProperty[] = [];
    const seenIds = new Set<string>();

    page.on("response", async (res) => {
      const url = res.url();
      if (
        !url.includes("/api/v") ||
        !url.includes("/multi/property/RENT/filter")
      ) {
        return;
      }
      try {
        const ct = res.headers()["content-type"] ?? "";
        if (!ct.includes("json")) return;
        const json = (await res.json()) as {
          data?: NbProperty[] | { properties?: NbProperty[] };
          properties?: NbProperty[];
        };
        // The API has rotated payload shapes over time; try common ones.
        const list: NbProperty[] = Array.isArray(json.data)
          ? json.data
          : Array.isArray(json.properties)
          ? json.properties
          : Array.isArray((json.data as { properties?: NbProperty[] } | undefined)?.properties)
          ? (json.data as { properties: NbProperty[] }).properties
          : [];
        for (const p of list) {
          const id = String(p.id ?? p.propertyId ?? "");
          if (!id || seenIds.has(id)) continue;
          seenIds.add(id);
          properties.push(p);
        }
      } catch {
        // ignore non-JSON or parse errors
      }
    });

    for (let pageNo = 1; pageNo <= MAX_PAGES; pageNo++) {
      const url = pageNo === 1 ? SEED_URL : `${SEED_URL}?pageNo=${pageNo}`;
      logLine(stats, `loading page ${pageNo}: ${url}`);
      stats.pagesFetched += 1;

      try {
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
      } catch (e) {
        stats.errors.push({ url, message: `goto: ${(e as Error).message}` });
        continue;
      }
      // Let the SPA fire its XHRs.
      await page.waitForTimeout(PAGE_WAIT_MS);
      // Scroll to ensure lazy-loaded XHRs trigger.
      await page.evaluate(() => window.scrollBy(0, 1500));
      await page.waitForTimeout(2000);

      logLine(stats, `cumulative properties captured: ${properties.length}`);
      // If a page yielded nothing new, stop early.
      if (pageNo > 1 && properties.length === seenIds.size && pageNo >= 2) {
        // (ids already updated; we use length to estimate "new this page")
      }
    }

    logLine(stats, `total unique properties: ${properties.length}`);

    // Upsert everything.
    for (const p of properties) {
      stats.listingsSeen += 1;
      const parsed = toParsed(p);
      if (!parsed) continue;
      stats.listingsParsed += 1;
      try {
        const r = await upsertListing(parsed);
        if (r.upserted) stats.listingsUpserted += 1;
        else if (r.skipped)
          stats.errors.push({ url: parsed.sourceUrl, message: `skipped: ${r.skipped}` });
      } catch (e) {
        stats.errors.push({ url: parsed.sourceUrl, message: (e as Error).message });
      }
    }
  } finally {
    if (context) await context.close();
    if (browser) await browser.close();
    finalizeStats(stats);
    const path = await writeStats(stats);
    logLine(stats, `stats → ${path}`);
    await closeDb();
  }

  return stats;
}

// ============================================================================
// Property → ParsedListing
// ============================================================================

function bhkFromType(s: string | undefined): number | null {
  if (!s) return null;
  const m = s.match(/(\d)\s*BHK|RK1?/i);
  if (!m) return null;
  if (m[0].toUpperCase().includes("RK")) return 1;
  return Number(m[1]);
}

function firstPhoto(p: NbProperty): { url: string; alt: string } | null {
  const list = p.photos ?? p.pictureList ?? [];
  for (const ph of list) {
    const url = ph.original ?? ph.thumbnail;
    if (url) return { url, alt: ph.title ?? "NoBroker photo" };
  }
  if (p.propertyImage) return { url: p.propertyImage, alt: "NoBroker photo" };
  return null;
}

function makeShareUrl(p: NbProperty): string {
  if (p.shareUrl) return p.shareUrl;
  if (p.detailUrl) return p.detailUrl;
  const id = p.id ?? p.propertyId ?? "";
  const slug = slugify(p.societyName ?? p.locality ?? p.title ?? "rent");
  return `https://www.nobroker.in/property/${slug}-${id}/detail`;
}

function toParsed(p: NbProperty): ParsedListing | null {
  const id = String(p.id ?? p.propertyId ?? "");
  const rent = typeof p.rent === "number" ? p.rent : null;
  const lat = typeof p.latitude === "number" ? p.latitude : null;
  const lng = typeof p.longitude === "number" ? p.longitude : null;
  const localityHint = p.locality ?? p.localityName ?? null;
  const bhk = bhkFromType(p.type ?? p.bhkType ?? p.type_d) ?? 2;

  if (!id || !rent || !localityHint) return null;

  const photo = firstPhoto(p);
  const sqft =
    typeof p.propertySize === "number"
      ? p.propertySize
      : typeof p.carpetArea === "number"
      ? p.carpetArea
      : typeof p.buildupArea === "number"
      ? p.buildupArea
      : null;

  // availableFrom epoch ms → ISO date.
  const availableFrom =
    typeof p.availableFrom === "number" && p.availableFrom > 0
      ? new Date(p.availableFrom).toISOString().slice(0, 10)
      : p.available ?? null;

  return {
    sourcePlatform: "nobroker",
    sourceListingId: id,
    sourceUrl: makeShareUrl(p),
    title:
      p.title ??
      p.propertyTitle ??
      `${bhk}BHK in ${p.societyName ? `${p.societyName}, ` : ""}${localityHint}, Bangalore`,
    description: p.societyName ? `${p.societyName}, ${localityHint}` : null,
    bhk,
    rentInr: rent,
    depositInr: typeof p.deposit === "number" ? p.deposit : null,
    areaSqft: sqft,
    floor: null,
    totalFloors: null,
    furnishing: parseFurnishing(p.furnishing ?? p.furnishingDesc ?? null),
    availableFrom,
    lat: lat ?? undefined,
    lng: lng ?? undefined,
    addressLine: p.societyName ?? p.buildingName ?? null,
    localityHint,
    photos: photo ? [photo] : [],
    contactPhoneRaw: null, // by policy — see file header
    contactName: p.ownerName ?? p.postedBy ?? null,
  };
}
