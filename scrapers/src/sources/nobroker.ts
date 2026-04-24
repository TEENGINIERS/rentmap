/**
 * NoBroker parser — STUB.
 *
 * Status: scaffold only. Hardest of the four; save for last.
 *
 * Why this is the hardest:
 *   - NoBroker is a single-page app (React) — the initial HTML is shell-only.
 *     Listing data is fetched client-side from an internal API.
 *   - Cloudflare anti-bot is enabled on the listing endpoints.
 *   - The tenant tier gates contact info behind a paid subscription; we
 *     cannot scrape contact numbers without solving payment UX (and we
 *     won't — that crosses an ethical line).
 *
 * Recommended path to ship:
 *   1. Inspect the internal API in devtools. Typical endpoint:
 *        https://www.nobroker.in/api/v3/multi/property/RENT?city=bangalore&type=2BHK&...
 *      The response is JSON — skipping Playwright entirely is ideal.
 *   2. Hit that endpoint with our polite fetch. If it 403s, fall back to
 *      Playwright with a short scripted scroll to trigger XHR, and read
 *      responses via route interception.
 *   3. Contact fields: populate `contactName` from the `ownerName` field
 *      if present. Leave `contactPhoneRaw` null — we do NOT scrape
 *      phone-unlock tokens or bypass their paywall. That's both legally
 *      risky and contrary to "structurally on the tenant's side".
 *
 * Why we still scrape NoBroker at all:
 *   - 43% of Bangalore online rent search happens here (business plan §2.1).
 *   - A rental "truth map" that excludes NoBroker inventory is incomplete.
 *   - Public listing facts (rent, BHK, locality, photos) are visible
 *     without a login — those are fair game.
 */

import type { SourceConfig } from "../run";
import type { ParsedListing } from "../types";

const BASE = "https://www.nobroker.in";
const SEED_URL = `${BASE}/property/rent/bangalore/flat/2BHK`;

export const noBrokerConfig: SourceConfig = {
  platform: "nobroker",
  seedUrls: [SEED_URL],

  parseIndex(_html, _currentUrl) {
    // TODO: SPA shell returns no listings in the HTML. Replace this with
    // a direct call to the internal JSON API (see file header). For now,
    // return empty so the runner exits cleanly.
    return { listingUrls: [], nextPageUrl: null };
  },

  parseDetail(_html, _url): ParsedListing | null {
    // TODO: parse detail JSON response.
    return null;
  },
};
