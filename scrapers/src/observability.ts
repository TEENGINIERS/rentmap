import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { ScrapeStats } from "./types";

export function initStats(source: ScrapeStats["source"]): ScrapeStats {
  return {
    source,
    startedAt: new Date().toISOString(),
    endedAt: "",
    durationMs: 0,
    pagesFetched: 0,
    listingsSeen: 0,
    listingsParsed: 0,
    listingsUpserted: 0,
    listingsSkippedRobots: 0,
    rateLimited: 0,
    errors: [],
  };
}

export function finalizeStats(stats: ScrapeStats): ScrapeStats {
  stats.endedAt = new Date().toISOString();
  stats.durationMs = Date.parse(stats.endedAt) - Date.parse(stats.startedAt);
  return stats;
}

export async function writeStats(stats: ScrapeStats): Promise<string> {
  const dir = resolve(process.cwd(), "scrapers", "runs");
  await mkdir(dir, { recursive: true });
  const ts = stats.startedAt.replace(/[:.]/g, "-");
  const path = resolve(dir, `${stats.source}-${ts}.json`);
  await writeFile(path, JSON.stringify(stats, null, 2));
  return path;
}

export function logLine(stats: ScrapeStats, message: string): void {
  // Stderr so stdout stays parseable if wrapped.
  process.stderr.write(`[${stats.source}] ${message}\n`);
}
