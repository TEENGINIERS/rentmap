/**
 * MagicBricks parser — STUB.
 *
 * Status: scaffold only.
 *
 * How to implement:
 *   1. Seed URL for 2BHK Bangalore rentals (confirm the current form):
 *        https://www.magicbricks.com/property-for-rent/residential-real-estate?bedroom=2&proptype=Multistorey-Apartment,Builder-Floor-Apartment&cityName=Bangalore
 *   2. Fetch + save to scrapers/fixtures/magicbricks-index.html.
 *   3. Inspect the card structure. MagicBricks typically returns an
 *      `mb-srp__card` structure with data-id attributes on each card.
 *   4. The detail page renders most facts as labeled rows; pick by
 *      the known labels ("Monthly Rent", "Security Deposit", "Area",
 *      "Furnishing", "Available From", etc).
 *   5. Coordinates: MagicBricks embeds lat/lng as data-* attributes on
 *      the map container. Check both the card and detail page.
 *
 * Known gotchas:
 *   - Listing URLs include a hash like `-pid-H3218192838` — use the
 *     numeric pid as sourceListingId.
 *   - MagicBricks aggressively A/B-tests layouts; parser brittleness is
 *     real. Keep each selector behind a well-named helper so a single
 *     change is localized.
 *   - Broker-posted listings are the MAJORITY here. This is a signal-rich
 *     source for the owner-vs-broker detector.
 *   - CDN caches are strong; 429s are rare at our rate (1 req / 2s).
 */

import type { SourceConfig } from "../run";
import type { ParsedListing } from "../types";

const BASE = "https://www.magicbricks.com";
const SEED_URL = `${BASE}/property-for-rent/residential-real-estate?bedroom=2&proptype=Multistorey-Apartment,Builder-Floor-Apartment&cityName=Bangalore`;

export const magicBricksConfig: SourceConfig = {
  platform: "magicbricks",
  seedUrls: [SEED_URL],

  parseIndex(_html, _currentUrl) {
    // TODO: extract card detail URLs from .mb-srp__card anchors.
    return { listingUrls: [], nextPageUrl: null };
  },

  parseDetail(_html, _url): ParsedListing | null {
    // TODO: pull labeled facts + lat/lng from map container.
    return null;
  },
};
