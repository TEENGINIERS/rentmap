/**
 * 99acres parser — STUB (HTTP-blocked).
 *
 * Status: 99acres is fronted by Akamai with an aggressive WAF. Plain HTTP
 * requests — even for /robots.txt — return "Access Denied" with no bypass
 * via headers/UA spoofing alone. Probed 2026-04-27.
 *
 * Realistic paths to ship:
 *   1. Playwright with stealth plugin (puppeteer-extra-plugin-stealth or
 *      playwright-extra) AND a residential-IP proxy (Bright Data, Oxylabs,
 *      ScraperAPI). Akamai also fingerprints TLS / browser characteristics,
 *      so residential proxy alone won't be enough.
 *   2. ScraperAPI / ScrapingBee / Apify managed actor (~$30-100/mo) — they
 *      operate the proxy + browser farm and charge per page. Best ROI for
 *      a small operation; defers maintenance burden to a vendor.
 *   3. Skip 99acres for v2 and rely on housing.com + magicbricks +
 *      nobroker + facebook for inventory coverage. 99acres has high broker
 *      density anyway; the truth-badge value is lower here.
 *
 * Until one of those is wired up, this remains a no-op (the runner exits
 * cleanly with parsed=0 and a single robots/network error in stats).
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
