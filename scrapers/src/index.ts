/**
 * Scraper CLI.
 *
 * Usage:
 *   pnpm scrape                          # all sources, sequentially
 *   pnpm scrape:housing                  # one source
 *   pnpm scrape housing 99acres          # subset
 */
import { runSource } from "./run";
import { ALL_PLATFORMS, SOURCES } from "./sources";
import type { SourcePlatform } from "./types";

function parseArgs(argv: string[]): SourcePlatform[] {
  const args = argv.slice(2).filter(Boolean);
  if (args.length === 0) return ALL_PLATFORMS;
  const invalid = args.filter((a) => !(a in SOURCES));
  if (invalid.length > 0) {
    console.error(`unknown source(s): ${invalid.join(", ")}`);
    console.error(`valid: ${ALL_PLATFORMS.join(", ")}`);
    process.exit(2);
  }
  return args as SourcePlatform[];
}

async function main() {
  const targets = parseArgs(process.argv);
  console.log(`running scrapers: ${targets.join(", ")}`);

  let anyFailure = false;
  for (const platform of targets) {
    const cfg = SOURCES[platform];
    try {
      const stats = await runSource(cfg);
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
