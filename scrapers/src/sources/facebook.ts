/**
 * Facebook group scraper — Playwright + saved storage state.
 *
 * Why this is a special-case runner (not a SourceConfig):
 * The shared runner uses politeFetch (HTTP only). Facebook is a logged-in
 * SPA — we need a real browser with cookies. The shape of `ParsedListing`
 * is the same; only the fetch + parse path is bespoke.
 *
 * Workflow:
 *   1. `pnpm scrape:facebook:login` — opens a headed browser. You log in.
 *      Storage state (cookies) is saved to FB_STORAGE_STATE_PATH.
 *   2. `pnpm scrape:facebook` — headless browser using saved state, scrolls
 *      each FB_GROUP_URLS page, parses post text for rent/BHK/locality, upserts.
 *
 * Caveats (be aware before depending on this in production):
 *   - Facebook's HTML class names are obfuscated and rotate. We rely on
 *     stable role attributes (role="feed", role="article"). If FB changes,
 *     this breaks loudly (zero parsed posts → CI canary catches it).
 *   - FB may detect headless browsers. If so, set FB_SCRAPER_HEADLESS=false.
 *   - Scraping a group you don't belong to fails silently. Join the group first.
 *   - You are using your own account. FB ToS forbids automated scraping; the
 *     legal stance is identical to the broader scraping risk in this project
 *     (see Business_plan §6.3). Use small volumes and rotate sessions.
 */
import { chromium, type Browser, type BrowserContext, type BrowserContextOptions } from "playwright";
import { readFile } from "node:fs/promises";
import { upsertListing, closeDb } from "../persist";
import {
  finalizeStats,
  initStats,
  logLine,
  writeStats,
} from "../observability";
import {
  parseBhk,
  parseFurnishing,
  parseRentInr,
} from "../normalize";
import type { ParsedListing, ScrapeStats } from "../types";

const STORAGE_STATE_PATH = process.env.FB_STORAGE_STATE_PATH ?? ".fb-session.json";
const GROUP_URLS = (process.env.FB_GROUP_URLS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const HEADLESS = process.env.FB_SCRAPER_HEADLESS !== "false";
const MAX_SCROLLS = Number(process.env.FB_MAX_SCROLLS ?? 25);
const SCROLL_DELAY_MS = 1500;

interface RawFbPost {
  postId: string;
  text: string;
  photos: string[];
  permalink: string;
}

export async function runFacebookScraper(): Promise<ScrapeStats> {
  const stats = initStats("facebook");

  if (GROUP_URLS.length === 0) {
    stats.errors.push({ message: "FB_GROUP_URLS env var is empty — set it in .env.local" });
    finalizeStats(stats);
    await writeStats(stats);
    return stats;
  }

  let storageState: object;
  try {
    storageState = JSON.parse(await readFile(STORAGE_STATE_PATH, "utf-8")) as object;
  } catch {
    stats.errors.push({
      message: `Could not read storage state at ${STORAGE_STATE_PATH}. Run 'pnpm scrape:facebook:login' first to save your session.`,
    });
    finalizeStats(stats);
    await writeStats(stats);
    return stats;
  }

  let browser: Browser | null = null;
  let context: BrowserContext | null = null;

  try {
    browser = await chromium.launch({ headless: HEADLESS });
    context = await browser.newContext({
      storageState: storageState as BrowserContextOptions["storageState"],
      viewport: { width: 1280, height: 900 },
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
    });
    const page = await context.newPage();

    for (const groupUrl of GROUP_URLS) {
      logLine(stats, `scraping ${groupUrl}`);
      stats.pagesFetched += 1;

      try {
        await page.goto(groupUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
      } catch (e) {
        stats.errors.push({ url: groupUrl, message: `goto: ${(e as Error).message}` });
        continue;
      }

      // Detect login redirect.
      if (page.url().includes("/login") || page.url().includes("/checkpoint")) {
        stats.errors.push({
          url: groupUrl,
          message: "session expired or checkpoint — re-run 'pnpm scrape:facebook:login'",
        });
        continue;
      }

      // Scroll to load more posts. FB hydrates as you scroll.
      for (let i = 0; i < MAX_SCROLLS; i++) {
        await page.evaluate(() => window.scrollBy(0, 1600));
        await page.waitForTimeout(SCROLL_DELAY_MS);
      }

      // Extract posts. We rely on role="article" inside role="feed" — this
      // has been stable across FB redesigns.
      const posts: RawFbPost[] = await page.evaluate(() => {
        const articles = document.querySelectorAll(
          'div[role="feed"] div[role="article"]',
        );
        const seen = new Set<string>();
        const out: RawFbPost[] = [];
        articles.forEach((art) => {
          const el = art as HTMLElement;
          const text = el.innerText?.slice(0, 5000) ?? "";
          if (text.length < 30) return;

          // Permalink: look for a link to /groups/<id>/posts/<id> or /permalink/.
          let permalink = "";
          let postId = "";
          const links = el.querySelectorAll<HTMLAnchorElement>('a[href*="/groups/"]');
          for (const a of Array.from(links)) {
            const href = a.href;
            const m = href.match(/\/(?:posts|permalink)\/(\d+)/);
            if (m && m[1]) {
              permalink = href.split("?")[0]!;
              postId = m[1];
              break;
            }
          }
          if (!postId || seen.has(postId)) return;
          seen.add(postId);

          const imgs = el.querySelectorAll<HTMLImageElement>('img[src*="scontent"]');
          const photos = Array.from(imgs)
            .map((i) => i.src)
            .filter((src) => src && !src.includes("emoji"))
            .slice(0, 5);

          out.push({ postId, text, photos, permalink });
        });
        return out;
      });

      logLine(stats, `extracted ${posts.length} posts from ${groupUrl}`);

      for (const post of posts) {
        stats.listingsSeen += 1;
        const parsed = parseFbPost(post);
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
// Post → ParsedListing
// ============================================================================

function parseFbPost(post: RawFbPost): ParsedListing | null {
  const text = post.text;
  const rentInr = parseRentInr(extractRentToken(text));
  const bhk = parseBhk(text);
  if (!rentInr || !bhk) return null;

  const localityHint = guessLocality(text);
  if (!localityHint) return null;

  return {
    sourcePlatform: "facebook",
    sourceListingId: post.postId,
    sourceUrl: post.permalink || `https://www.facebook.com/${post.postId}`,
    title: makeTitle(text, bhk, localityHint),
    description: text.slice(0, 1500),
    bhk,
    rentInr,
    depositInr: extractDeposit(text),
    areaSqft: null,
    floor: null,
    totalFloors: null,
    furnishing: parseFurnishing(text),
    availableFrom: null,
    addressLine: null,
    localityHint,
    photos: post.photos.map((url, i) => ({
      url,
      alt: `Facebook post photo ${i + 1}`,
    })),
    contactPhoneRaw: extractPhone(text),
    contactName: null,
  };
}

function extractRentToken(text: string): string | null {
  // Try several patterns: ₹40,000 — Rs.40000 — "rent 40k" — "monthly: 40000"
  const patterns = [
    /(?:₹|rs\.?\s*|inr\s*)([\d,]+(?:\.\d+)?\s*[klakh]?[a-z]{0,5})/i,
    /\b(?:rent|monthly)\s*[:\-]?\s*(?:₹|rs\.?\s*)?([\d,]+(?:\.\d+)?\s*k?)/i,
    /\b([\d,]+\s*k)\b/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m && m[1]) return m[1].trim();
  }
  return null;
}

function extractDeposit(text: string): number | null {
  const m = text.match(/deposit\s*[:\-]?\s*(?:₹|rs\.?\s*)?([\d,]+(?:\.\d+)?\s*k?)/i);
  if (!m) return null;
  return parseRentInr(m[1] ?? null);
}

function extractPhone(text: string): string | null {
  const m = text.match(/(?:\+?91[\s\-]?)?\b[6-9]\d{9}\b/);
  return m ? m[0] : null;
}

const KNOWN_LOCALITIES = [
  "Whitefield",
  "Koramangala",
  "Indiranagar",
  "HSR Layout",
  "HSR",
  "BTM Layout",
  "BTM",
  "JP Nagar",
  "Jayanagar",
  "Marathahalli",
  "Bellandur",
  "Sarjapur",
  "Electronic City",
  "Hebbal",
  "Yeshwanthpur",
  "Malleshwaram",
  "Rajajinagar",
  "Banashankari",
  "Bommanahalli",
  "Domlur",
  "Frazer Town",
  "Cox Town",
  "MG Road",
  "Brigade Road",
  "Ulsoor",
  "Kalyan Nagar",
  "Banaswadi",
  "Kammanahalli",
  "Vijayanagar",
  "Basavanagudi",
  "Kengeri",
  "Yelahanka",
];

function guessLocality(text: string): string | null {
  for (const loc of KNOWN_LOCALITIES) {
    const re = new RegExp(`\\b${loc.replace(/\s+/g, "[\\s\\-]?")}\\b`, "i");
    if (re.test(text)) return loc;
  }
  return null;
}

function makeTitle(text: string, bhk: number, locality: string): string {
  const firstLine = text
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.length > 5 && l.length <= 100);
  return firstLine ?? `${bhk}BHK in ${locality}`;
}
