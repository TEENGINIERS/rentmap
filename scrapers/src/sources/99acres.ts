/**
 * 99acres parser — STUB.
 *
 * Status: scaffold only. The selectors below are best-guess based on
 * public listing pages as of the time of writing. They will need to be
 * calibrated against real fetched HTML before this goes live.
 *
 * How to implement:
 *   1. Run `curl -A "$SCRAPER_USER_AGENT" "https://www.99acres.com/rent-2-bhk-property-bangalore"`
 *      and save to scrapers/fixtures/99acres-index.html
 *   2. Open in a browser; inspect the listing card and detail page structure.
 *   3. Fill in parseIndex() to return detail URLs + next-page link.
 *   4. Fill in parseDetail() to pull: rent, bhk, area, lat/lng, locality,
 *      photos, contact. Return null if any required field is missing.
 *   5. Test against fixture:
 *        import { readFileSync } from "node:fs";
 *        const html = readFileSync("scrapers/fixtures/99acres-index.html", "utf8");
 *        const parsed = ninetyNineAcresConfig.parseIndex(html, "https://...");
 *        console.log(parsed);
 *   6. Remove the throw below and flip STATUS to "live".
 *
 * Known gotchas:
 *   - 99acres shows contact numbers only after a "View Details" tap
 *     (JS-triggered reveal). If phone hash is critical for owner/broker
 *     detection, we may need Playwright for detail pages. For v2.0, ship
 *     without phone — the detector runs on name + cross-listing titles.
 *   - URL patterns like `/2-bhk-flats-apartments-for-rent-in-bangalore-ffid-p-N`
 *     — paginate by changing `-p-N`.
 *   - Pages embed a large JSON blob at the bottom — worth checking
 *     `window.initialData` before resorting to Cheerio selectors.
 */

import type { SourceConfig } from "../run";
import type { ParsedListing } from "../types";

const BASE = "https://www.99acres.com";
const SEED_URL = `${BASE}/rent-2-bhk-property-bangalore`;

export const ninetyNineAcresConfig: SourceConfig = {
  platform: "99acres",
  seedUrls: [SEED_URL],

  parseIndex(_html, _currentUrl) {
    // TODO: extract listing detail URLs. Return empty until implemented.
    return { listingUrls: [], nextPageUrl: null };
  },

  parseDetail(_html, _url): ParsedListing | null {
    // TODO: parse rent/bhk/area/locality/photos/contact from HTML or window.initialData.
    return null;
  },
};
