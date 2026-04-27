import type { SourcePlatform } from "./types";

/**
 * Polite-scraping defaults. Tune down (slower), never up, without reason.
 * The "why": business plan §6.3 flags C&D risk as the single most likely way
 * v2 dies. A polite UA + slow rate + robots.txt compliance is our first
 * defense and the one that doesn't cost money.
 */
export const SCRAPER_USER_AGENT =
  "Rentmap/0.1 (+https://rentmap.in/about; contact@rentmap.in)";

/** Delay between requests to the *same* host, in ms. */
export const REQUEST_INTERVAL_MS = 2000;

/** Request timeout per page. */
export const REQUEST_TIMEOUT_MS = 20_000;

/** Retries on 5xx or network errors. */
export const MAX_RETRIES = 2;

/** Hard cap on pages per source per run (prevents runaway scraping). */
export const MAX_PAGES_PER_RUN = 10;

/** Target city (v1 is Bangalore only — brief §2.3). */
export const TARGET_CITY = "bangalore";

/** Target BHK (v1 is 2BHK only — business plan §5.5). */
export const TARGET_BHK = 2;

export const SOURCE_BASE_URLS: Record<SourcePlatform, string> = {
  "99acres": "https://www.99acres.com",
  magicbricks: "https://www.magicbricks.com",
  housing: "https://housing.com",
  nobroker: "https://www.nobroker.in",
  facebook: "https://www.facebook.com",
};
