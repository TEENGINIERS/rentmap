import { politeFetch } from "./http";
import { isAllowed } from "./robots";
import { upsertListing, markStaleInactive, closeDb } from "./persist";
import {
  finalizeStats,
  initStats,
  logLine,
  writeStats,
} from "./observability";
import { MAX_PAGES_PER_RUN } from "./config";
import type { ParsedListing, ScrapeStats, SourcePlatform } from "./types";

/**
 * SourceConfig — the contract each parser implements.
 *
 * We deliberately isolate parsing (pure HTML → ParsedListing) from
 * orchestration (fetch, politeness, retries, UPSERT, stats). Test parsers
 * against fixtures with no DB or network.
 */
export interface SourceConfig {
  platform: SourcePlatform;
  /** Entry point(s) — the listing-discovery pages for 2BHK Bangalore. */
  seedUrls: string[];

  /**
   * Given the HTML of a discovery page, return:
   *   - listingUrls: fully-qualified URLs of detail pages to visit
   *   - nextPageUrl: the next page of results, or null if done
   */
  parseIndex(html: string, currentUrl: string): {
    listingUrls: string[];
    nextPageUrl: string | null;
  };

  /**
   * Given the HTML of a detail page, return a ParsedListing — or null
   * if this listing is unusable (wrong BHK, missing rent, etc).
   */
  parseDetail(html: string, url: string): ParsedListing | null;

  /**
   * Optional: some sources surface full listings in the index HTML itself
   * (Housing.com's __NEXT_DATA__). If set, the runner skips detail-page
   * fetches for the URLs this returns.
   */
  parseIndexEmbeddedListings?(html: string, url: string): ParsedListing[];
}

export async function runSource(cfg: SourceConfig): Promise<ScrapeStats> {
  const stats = initStats(cfg.platform);

  try {
    const seen = new Set<string>();
    const detailQueue: string[] = [];
    let nextPage: string | null = cfg.seedUrls[0] ?? null;
    let pages = 0;

    while (nextPage && pages < MAX_PAGES_PER_RUN) {
      if (!(await isAllowed(nextPage))) {
        stats.listingsSkippedRobots += 1;
        logLine(stats, `robots disallows ${nextPage}`);
        break;
      }

      let res;
      try {
        res = await politeFetch(nextPage);
      } catch (e) {
        stats.errors.push({ url: nextPage, message: (e as Error).message });
        break;
      }
      pages += 1;
      stats.pagesFetched += 1;

      if (res.status >= 400) {
        stats.errors.push({ url: nextPage, message: `status ${res.status}` });
        if (res.status === 429) stats.rateLimited += 1;
        break;
      }

      // Embedded-listings fast path (Housing.com).
      if (cfg.parseIndexEmbeddedListings) {
        const embedded = cfg.parseIndexEmbeddedListings(res.html, res.finalUrl);
        for (const parsed of embedded) {
          stats.listingsSeen += 1;
          stats.listingsParsed += 1;
          await upsertOne(parsed, stats);
        }
      } else {
        const { listingUrls, nextPageUrl } = cfg.parseIndex(res.html, res.finalUrl);
        for (const u of listingUrls) {
          if (!seen.has(u)) {
            seen.add(u);
            detailQueue.push(u);
          }
        }
        nextPage = nextPageUrl;
        continue;
      }

      // If embedded path, we still advance pagination from index.
      const { nextPageUrl } = cfg.parseIndex(res.html, res.finalUrl);
      nextPage = nextPageUrl;
    }

    // Visit detail pages (only when not using embedded path).
    for (const url of detailQueue) {
      stats.listingsSeen += 1;
      if (!(await isAllowed(url))) {
        stats.listingsSkippedRobots += 1;
        continue;
      }
      let res;
      try {
        res = await politeFetch(url);
      } catch (e) {
        stats.errors.push({ url, message: (e as Error).message });
        continue;
      }
      if (res.status >= 400) {
        stats.errors.push({ url, message: `status ${res.status}` });
        if (res.status === 429) stats.rateLimited += 1;
        continue;
      }
      const parsed = cfg.parseDetail(res.html, res.finalUrl);
      if (!parsed) continue;
      stats.listingsParsed += 1;
      await upsertOne(parsed, stats);
    }

    // Mark stale-inactive: if we successfully scraped anything this run,
    // fade listings we haven't seen for 48h.
    if (stats.listingsUpserted > 0) {
      const staled = await markStaleInactive(cfg.platform, 48);
      logLine(stats, `marked ${staled} stale listings inactive`);
    }
  } finally {
    finalizeStats(stats);
    const path = await writeStats(stats);
    logLine(stats, `stats → ${path}`);
    await closeDb();
  }

  return stats;
}

async function upsertOne(parsed: ParsedListing, stats: ScrapeStats): Promise<void> {
  try {
    const result = await upsertListing(parsed);
    if (result.upserted) stats.listingsUpserted += 1;
    else if (result.skipped) {
      stats.errors.push({ url: parsed.sourceUrl, message: `skipped: ${result.skipped}` });
    }
  } catch (e) {
    stats.errors.push({ url: parsed.sourceUrl, message: (e as Error).message });
  }
}
