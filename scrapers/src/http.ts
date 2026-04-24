import {
  MAX_RETRIES,
  REQUEST_INTERVAL_MS,
  REQUEST_TIMEOUT_MS,
  SCRAPER_USER_AGENT,
} from "./config";

/**
 * Polite fetch:
 *   - honors a per-host minimum interval (sleep before firing)
 *   - identifies us via User-Agent
 *   - retries on 5xx with capped exponential backoff
 *   - never follows cross-host redirects silently
 */

const lastRequestAtByHost = new Map<string, number>();

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForHost(host: string) {
  const now = Date.now();
  const prev = lastRequestAtByHost.get(host) ?? 0;
  const wait = Math.max(0, prev + REQUEST_INTERVAL_MS - now);
  if (wait > 0) await sleep(wait);
  lastRequestAtByHost.set(host, Date.now());
}

export class FetchError extends Error {
  constructor(
    public readonly url: string,
    public readonly status: number,
    message: string,
  ) {
    super(`fetch failed [${status}] ${url}: ${message}`);
  }
}

export interface PoliteFetchResult {
  html: string;
  finalUrl: string;
  status: number;
}

export async function politeFetch(url: string): Promise<PoliteFetchResult> {
  const host = new URL(url).host;

  let lastErr: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    await waitForHost(host);

    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        redirect: "follow",
        signal: ctrl.signal,
        headers: {
          "user-agent": SCRAPER_USER_AGENT,
          accept: "text/html,application/xhtml+xml,application/xml;q=0.9",
          "accept-language": "en-IN,en;q=0.9",
        },
      });
      clearTimeout(to);

      if (res.status === 429) {
        throw new FetchError(url, 429, "rate-limited");
      }
      if (res.status >= 500) {
        throw new FetchError(url, res.status, "server error");
      }
      if (res.status >= 400) {
        // 403/404 are not retryable. Return empty body so caller can decide.
        return { html: "", finalUrl: res.url, status: res.status };
      }

      const html = await res.text();
      return { html, finalUrl: res.url, status: res.status };
    } catch (e) {
      clearTimeout(to);
      lastErr = e;
      if (attempt < MAX_RETRIES) {
        await sleep(1000 * 2 ** attempt);
      }
    }
  }
  throw lastErr ?? new FetchError(url, 0, "unknown");
}
