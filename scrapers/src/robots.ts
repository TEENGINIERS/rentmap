import robotsParser from "robots-parser";
import { politeFetch } from "./http";
import { SCRAPER_USER_AGENT } from "./config";

type RobotsClient = ReturnType<typeof robotsParser>;

const cache = new Map<string, RobotsClient | null>();

/**
 * Fetch + cache robots.txt for a host. If unreachable, we return null and
 * skip enforcement (but log it) — robots.txt absence is not an implicit
 * allow, but we can't block on every network blip either.
 */
export async function getRobotsFor(origin: string): Promise<RobotsClient | null> {
  if (cache.has(origin)) return cache.get(origin)!;
  try {
    const { html, status } = await politeFetch(`${origin}/robots.txt`);
    if (status >= 400 || !html) {
      cache.set(origin, null);
      return null;
    }
    const client = robotsParser(`${origin}/robots.txt`, html);
    cache.set(origin, client);
    return client;
  } catch {
    cache.set(origin, null);
    return null;
  }
}

export async function isAllowed(url: string): Promise<boolean> {
  const origin = new URL(url).origin;
  const client = await getRobotsFor(origin);
  if (!client) return true; // fail-open; logged by caller
  return client.isAllowed(url, SCRAPER_USER_AGENT) ?? true;
}
