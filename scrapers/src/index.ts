/**
 * Scraper CLI.
 *
 * Usage:
 *   pnpm scrape                          # all sources, sequentially
 *   pnpm scrape:housing                  # one source
 *   pnpm scrape housing 99acres          # subset
 *   pnpm scrape:nobroker                 # NoBroker (Playwright + XHR sniff)
 *   pnpm scrape:facebook                 # FB groups (Playwright + saved session)
 */
import { runSource } from "./run";
import { ALL_PLATFORMS, SOURCES, type HttpSourcePlatform } from "./sources";
import { runFacebookScraper } from "./sources/facebook";
import { runNoBrokerScraper } from "./sources/nobroker";
import type { ScrapeStats, SourcePlatform } from "./types";

const ALL_TARGETS: SourcePlatform[] = [...ALL_PLATFORMS, "nobroker", "facebook"];
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
  if (platform === "nobroker") return runNoBrokerScraper();
  return runSource(SOURCES[platform as HttpSourcePlatform]);
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
