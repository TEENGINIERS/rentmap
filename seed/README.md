# Seed data

v1 ships with hand-curated listings instead of scraped ones. The data model here is the **exact** shape the v2 scraper will write — schema-compatible from day 1.

## Files

- `localities.json` — 30 Bangalore neighborhoods, with centroid lat/lng.
- `listings.json` — 30 2BHK listings across 5 localities (6 each).

## Loading

```bash
pnpm db:seed
```

The script is idempotent: UPSERT on `(source_platform, source_listing_id)`. Re-run it as many times as you like — safe in dev, previews, and initial prod.

## How to add a listing

1. Append an object to `listings.json`. All fields must match the `Listing` schema in `src/lib/db/schema.ts`.
2. `slug` must be globally unique (enforce `<locality>-<bhk>bhk-<building-or-area>-<shortid>`).
3. `locality_slug` must exist in `localities.json`.
4. Run `pnpm db:seed`.

## How to hand-label `sourceLabel`

**Three values allowed:** `"owner"`, `"broker"`, `"unknown"`.

**Labeling heuristics** (applied in order):

1. **Cross-reference the contact phone/name across listings.**
   - Same phone number on 3+ active listings across any platforms → `broker`.
   - Same contact name with "Properties", "Realty", "Enterprises" suffix → `broker`.
2. **Title/description explicit cues.**
   - "Owner direct", "no brokerage", "no brokers please" → `owner`.
   - "Contact our agent", "book a site visit with us" → `broker`.
3. **Source platform patterns.**
   - Posted only on NoBroker and nowhere else → often `owner` (NoBroker blocks brokers).
   - Same listing on 99acres + MagicBricks + Housing with different prices → `broker`.
4. **If ambiguous or conflicting signals, use `unknown`.** Unknown is honest. Do not guess.

**Target distribution** (matches real Bangalore market per brief §5.5):
- ~40% owner
- ~40% broker
- ~20% unknown

## Photos

v1 uses `picsum.photos` URLs as placeholders (deterministic per-seed). Do not check binary images into the repo. v2 will use real scraped photos stored in Supabase Storage.

## v2 evolution

When scrapers land, they write directly to `listing` using the same UPSERT contract:

```ts
// Scraper pseudocode
await db.insert(listing)
  .values({ sourcePlatform: "99acres", sourceListingId: externalId, ...parsed })
  .onConflictDoUpdate({
    target: [listing.sourcePlatform, listing.sourceListingId],
    set: { ...parsed, lastSeenAt: new Date() }
  });
```

No schema changes. No migration. The only thing that changes is `sourcePlatform` goes from `"seed"` to one of `"99acres" | "magicbricks" | ...` and `sourceLabel` gets written by the detector (see `src/lib/truth/README.md`).
