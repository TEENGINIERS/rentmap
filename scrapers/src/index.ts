/**
 * Scraper CLI.
 *
 * Usage:
 *   pnpm scrape                          # all HTTP sources, sequentially
 *   pnpm scrape:housing                  # one source
 *   pnpm scrape housing 99acres          # subset
 *   pnpm scrape:facebook                 # FB groups (uses Playwright + saved session)
 */
import { runSource } from "./run";
import { ALL_PLATFORMS, SOURCES } from "./sources";
import { runFacebookScraper } from "./sources/facebook";
import type { ScrapeStats, SourcePlatform } from "./types";

const ALL_TARGETS: SourcePlatform[] = [...ALL_PLATFORMS, "facebook"];
const VALID_TARGETS = new Set<SourcePlatform>(ALL_TARGETS);

function parseArgs(argv: string[]): SourcePlatform[] {
  const args = argv.slice(2).filter(Boolean);
  if (args.length === 0) return ALL_TARGETS;
  const invalid = args.filter((a) => !VALID_TARGETS.has(a as SourcePlatform));
  if (invalid.length > 0) {
    console.error(`unknown source(s): ${invalid.join(", ")}`);
    console.error(`valid: ${ALL_TARGETS.join(", ")}`);
    process.exit(2);
  }
  return args as SourcePlatform[];
}

async function runOne(platform: SourcePlatform): Promise<ScrapeStats> {
  if (platform === "facebook") return runFacebookScraper();
  return runSource(SOURCES[platform]);
}

async function main() {
  const targets = parseArgs(process.argv);
  console.log(`running scrapers: ${targets.join(", ")}`);

  let anyFailure = false;
  for (const platform of targets) {
    try {
      const stats = await runOne(platform);
      const summary = [
        `source=${stats.source}`,
        `pages=${stats.pagesFetched}`,
        `parsed=${stats.listingsParsed}`,
        `upserted=${stats.listingsUpserted}`,
        `errors=${stats.errors.length}`,
        `duration_ms=${stats.durationMs}`,
      ].join(" ");
      console.log(summary);
      if (stats.errors.length > 0 && stats.listingsUpserted === 0) {
        anyFailure = true;
      }
    } catch (e) {
      console.error(`[${platform}] fatal:`, e);
      anyFailure = true;
    }
  }

  process.exit(anyFailure ? 1 : 0);
}

main();
