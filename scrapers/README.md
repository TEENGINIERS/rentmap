# Scrapers

v2 of Rentmap: daily ingestion of Bangalore 2BHK rental listings from public sources.

**Status**:
| Source | Status | Notes |
|---|---|---|
| `housing` | **Live** | `__NEXT_DATA__`-driven. Canonical reference implementation. |
| `99acres` | **Stub** | Scaffold + TODOs. Seed URL confirmed. |
| `magicbricks` | **Stub** | Scaffold + TODOs. |
| `nobroker` | **Stub** | SPA + Cloudflare. Plan documented inline. |

---

## Principles (non-negotiable)

1. **Polite by default.** 1 request / 2 seconds per host, single IP, identified User-Agent (`Rentmap/0.1 (+contact@rentmap.in)`), honor `robots.txt`. See `src/config.ts`.
2. **Public data only.** We do not bypass paywalls, login gates, or contact-unlock tokens. NoBroker phone numbers are gated behind a paid subscription — we will not scrape them.
3. **Idempotent writes.** UPSERT on `(source_platform, source_listing_id)` — identical to the seed loader. Reruns overwrite nothing that isn't stale.
4. **Observable.** Every run emits a JSON stats file to `scrapers/runs/` and (on CI) uploads as an artifact.
5. **Structurally on the tenant's side.** We use scraped data to help renters; we do not resell it, do not list it anywhere else, and do not let our scraping interfere with the sites' own traffic.

If any of these principles start feeling like drag, stop — the C&D risk outruns the upside (business plan §6.3).

---

## Running locally

```bash
# Prereq: .env.local with DIRECT_URL or DATABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
pnpm scrape                # all sources sequentially
pnpm scrape:housing        # one source
pnpm scrape housing 99acres  # subset
```

Each run writes `scrapers/runs/<source>-<timestamp>.json` with counters + error list. Read it to diagnose.

---

## CI / cron

`.github/workflows/scrape.yml` runs daily at **03:00 IST (21:30 UTC)** as a matrix job (one per source, `fail-fast: false`). Failures on one source do not block others.

Required GitHub Secrets:
- `DATABASE_URL` — pooled Supabase connection
- `DIRECT_URL` — direct Supabase connection
- `SUPABASE_SERVICE_ROLE_KEY` — bypasses RLS for writes

Stats artifacts retained for 30 days.

Manual trigger: Actions → scrape → Run workflow → pick source.

---

## Architecture

```
scrapers/src/
├─ index.ts                # CLI entry: tsx scrapers/src/index.ts [source...]
├─ config.ts               # rate limit, UA, max pages
├─ types.ts                # ParsedListing, ScrapeStats
├─ http.ts                 # politeFetch: per-host delay, retries, 429 handling
├─ robots.ts               # robots.txt fetch + cache + isAllowed()
├─ normalize.ts            # parseRentInr, normalizePhone, contentHash, slugify, ...
├─ persist.ts              # upsertListing() — the UPSERT contract; locality fuzzy-match
├─ observability.ts        # initStats, finalizeStats, writeStats
├─ run.ts                  # runSource(config) — the orchestration loop
└─ sources/
   ├─ index.ts             # registry: { housing, 99acres, magicbricks, nobroker }
   ├─ housing.ts           # FULL (__NEXT_DATA__)
   ├─ 99acres.ts           # STUB + TODOs
   ├─ magicbricks.ts       # STUB + TODOs
   └─ nobroker.ts          # STUB + TODOs
```

**Parser contract** (`SourceConfig` in `run.ts`):
```ts
interface SourceConfig {
  platform: SourcePlatform;
  seedUrls: string[];
  parseIndex(html, currentUrl): { listingUrls, nextPageUrl };
  parseDetail(html, url): ParsedListing | null;
  parseIndexEmbeddedListings?(html, url): ParsedListing[];  // optional fast path
}
```

Parsers are **pure** — HTML in, `ParsedListing` out. No DB, no network. Test them against HTML fixtures.

---

## Adding a new source

1. Create `scrapers/src/sources/<source>.ts`. Copy the shape from `housing.ts`.
2. Fetch a sample index + detail page with the polite UA:
   ```bash
   curl -sA "Rentmap/0.1 (+contact@rentmap.in)" "https://..." > scrapers/fixtures/<source>-index.html
   ```
3. Implement `parseIndex` first. Verify it returns N detail URLs.
4. Implement `parseDetail`. Return `null` for any listing that's:
   - Not 2BHK
   - Missing rent, locality, or a source ID
5. Register in `scrapers/src/sources/index.ts`.
6. Add to `SourcePlatform` union in `src/lib/db/schema.ts` check constraint if new (already supports the v1 four).
7. Add a `pnpm scrape:<source>` script.
8. Add a fixture test under `tests/unit/scrapers/<source>.test.ts`.
9. Run it locally. Inspect `scrapers/runs/*.json`. Iterate.

---

## Legal & ethical

- We fetch publicly-accessible pages. We do not circumvent technical access controls (no CAPTCHA solving, no login spoofing, no paid-content scraping).
- We identify ourselves with a unique User-Agent and a contact email.
- We honor `robots.txt`.
- If a site's ToS explicitly prohibits scraping and our counsel advises against, we stop — the product survives without one source; the brand does not survive a lawsuit we started by being cute.
- If we receive a C&D from any source, we pause that source immediately pending review.

"Publicly accessible data" precedents in India are thinner than in the US. We operate conservatively, not at the edge.

---

## Observability runbook

**Stats file** (`scrapers/runs/<source>-<ts>.json`):
```json
{
  "source": "housing",
  "startedAt": "2026-04-23T21:30:00Z",
  "endedAt": "2026-04-23T21:33:47Z",
  "durationMs": 227000,
  "pagesFetched": 5,
  "listingsSeen": 84,
  "listingsParsed": 76,
  "listingsUpserted": 76,
  "listingsSkippedRobots": 0,
  "rateLimited": 0,
  "errors": []
}
```

**Alert thresholds** (add to CI later):
- `listingsParsed === 0` after 2 consecutive runs → schema drift (the canary).
- `rateLimited > 0` → back off. Double `REQUEST_INTERVAL_MS` for that source.
- `errors.length / listingsSeen > 0.1` → investigate before next run.

**Manual checks**:
- `pnpm tsx -e "import('postgres').then(...)"` to spot-query new rows.
- `select source_platform, count(*) from listing where source_platform != 'seed' group by 1;`
- `select source_platform, max(last_seen_at) from listing group by 1;` — staleness per source.

---

## Out of scope for v2.0

- **Fake-photo detection** (v3). Photos stored as source URLs only.
- **Dedup across sources** (v2.2). Same listing on Housing + 99acres = two rows; dedup lands as a separate pgvector job.
- **Owner-vs-broker detector** (v2.3). `source_label` stays `'unknown'` on scraped rows until the detector lands. The hand-labeled seed rows still show their badges; scraped rows show `SOURCE UNKNOWN` and that's honest.
- **Photo hosting**. We link to source CDNs. Migration to Supabase Storage comes when (not if) sources start serving broken images to hotlinkers.
- **WhatsApp alerts / saved searches** (later ladder).

See [../rentmap-brief.md](../rentmap-brief.md) §7.2 and [../Business_plan.md](../Business_plan.md) §5.5 for the ladder.
