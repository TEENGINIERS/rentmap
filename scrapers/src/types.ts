/**
 * Parser output — the shape every source parser must return per listing.
 * Mirrors the listing table columns the scraper is responsible for; the
 * persist layer handles locality resolution + UPSERT.
 *
 * Do NOT import DB types here. Scrapers must be able to produce these
 * objects without any DB dependency (eases testing with HTML fixtures).
 */

export type SourcePlatform = "99acres" | "magicbricks" | "housing" | "nobroker";

export interface ParsedListing {
  sourcePlatform: SourcePlatform;
  /** Stable external ID from the source — used as the UPSERT conflict key. */
  sourceListingId: string;
  sourceUrl: string;

  title: string;
  description?: string | null;
  bhk: number;
  rentInr: number;
  depositInr?: number | null;
  areaSqft?: number | null;
  floor?: number | null;
  totalFloors?: number | null;
  furnishing?: "unfurnished" | "semi" | "fully" | null;
  availableFrom?: string | null;

  lat?: number;
  lng?: number;
  addressLine?: string | null;
  /**
   * Source's own locality string ("Whitefield", "HSR Layout 7 Sector").
   * The persist layer will fuzzy-match this to our `locality` table.
   */
  localityHint: string;

  photos: Array<{ url: string; alt: string }>;

  /** Raw phone string as scraped — normalized by the persist layer. */
  contactPhoneRaw?: string | null;
  contactName?: string | null;
}

export interface ScrapeStats {
  source: SourcePlatform;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  pagesFetched: number;
  listingsSeen: number;
  listingsParsed: number;
  listingsUpserted: number;
  listingsSkippedRobots: number;
  rateLimited: number;
  errors: Array<{ url?: string; message: string }>;
}
