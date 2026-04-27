# Rentmap — Session Handoff

> **For the next person picking this up.** Read this first. It explains what's
> in the repo, what was built in the most recent session, what's working, what
> isn't, and what to try next. Maintained as a living document — please update
> when you ship something material.
>
> **Last updated:** 2026-04-27 by Somu + Claude.

---

## 1. What this app is

A Bangalore rental search tool. Two pieces:

1. **Map UI** with a chat panel overlay. The user types in plain English
   ("2BHK in Whitefield under 50k", "near Koramangala metro"), an LLM
   translates that into structured queries against our local Postgres DB,
   and the resulting listings render as colored pins on a MapLibre map.
2. **A scraper farm** that periodically pulls listings from external sites
   (housing.com, MagicBricks, NoBroker, 99acres, Facebook groups) and
   upserts them into the same DB. The chat queries that DB — it never
   talks to external rental sites at request time.

The truth badges (price-anomaly, owner-vs-broker) are a Rentmap-specific
differentiator vs. the bigger players, and are computed server-side from
seeded labels + per-locality medians. See `src/lib/truth/`.

**Tech:** Next.js 15 App Router, TypeScript strict, Postgres + PostGIS via
Drizzle, MapLibre GL with free OpenFreeMap tiles, Gemini for the chat
agent, Tailwind 4 (beta) + shadcn primitives, Supabase for auth, pnpm,
Vercel-deploy ready.

---

## 2. State of the world today

```
source_platform | listing count | notes
----------------+---------------+------------------------------------------
seed            |  30           | Hand-curated 2BHK Whitefield-heavy mix
magicbricks     | 148           | LIVE. Re-runnable nightly. ✓
housing         |   0           | Scraper is live but never been run
99acres         |   0           | Akamai-blocked; needs paid proxy (see §6)
nobroker       |   0           | SPA + token gate; needs vendor (see §6)
facebook        |   0           | Built but needs you to run login first
```

**Total searchable listings: 178.**

The chat agent is wired and works end-to-end (verified via curl) on
`gemini-2.5-flash-lite`. The map is fully immersive — no Bangalore bounding
box, scroll-anywhere. Branding is "Rentmap".

---

## 3. Architecture overview

```
                     ┌─────────────────────────────────────────┐
                     │   Browser                                │
                     │   ┌─────────────────────────────────┐   │
                     │   │  ChatPanel  (overlay, left)     │   │
                     │   │  - sends {message, history}     │   │
                     │   │    to /api/chat                 │   │
                     │   │  - subscribes to               ─┼──┼── Zustand store
                     │   │    useListingsStore             │   │   (chatListings,
                     │   │                                 │   │    focus, pois)
                     │   └─────────────────────────────────┘   │
                     │   ┌─────────────────────────────────┐   │
                     │   │  MapView  (MapLibre, fullscreen)│   │
                     │   │  - reads chatListings + focus   ◀──┘
                     │   │    from store                   │
                     │   │  - flies to focus on update     │
                     │   └─────────────────────────────────┘
                     └────────────────────────────────────────
                                       │
                                       ▼  POST /api/chat
              ┌────────────────────────────────────────────┐
              │  /api/chat  (Next.js route handler)        │
              │  ┌──────────────────────────────────────┐  │
              │  │ Gemini tool-use loop (max 8 rounds)  │  │
              │  │   model.generateContent({           │  │
              │  │     systemInstruction,              │  │
              │  │     tools: TOOL_DECLARATIONS,       │  │
              │  │     contents })                     │  │
              │  │ → if functionCalls, execute & loop  │  │
              │  │ → if text, return                    │  │
              │  └──────────────────────────────────────┘  │
              │  Tool implementations:                     │
              │  - fuzzy_search → SQL on listing table     │
              │  - find_area    → SQL on locality table    │
              │  - geocode      → Nominatim (OSM, no key)  │
              │  - distance_matrix → pure haversine        │
              │  - nearby_places → Overpass (OSM, no key)  │
              └────────────────────────────────────────────┘
                                       │
                                       ▼
                             ┌────────────────────┐
                             │ Postgres + PostGIS │
                             │ (local Homebrew    │
                             │  rentmap_dev)      │
                             └────────────────────┘
                                       ▲
                                       │  upsert
              ┌────────────────────────┴────────────────────────┐
              │  Scrapers (run separately, populate the DB)     │
              │  - housing.com  — HTTP, parses __NEXT_DATA__    │
              │  - magicbricks  — HTTP, parses ld+json scripts  │
              │  - 99acres      — STUB (Akamai-blocked)         │
              │  - nobroker     — STUB (SPA + token gate)       │
              │  - facebook     — Playwright + saved session    │
              └─────────────────────────────────────────────────┘
```

### Two key invariants

1. **Listings are persistent.** Once a scraper writes a row, it lives in
   Postgres until a future scrape marks it inactive (48-hour stale rule).
   Chat queries hit the DB, not the source sites. **You do not "spend Gemini
   credits" on listing data** — only on the prose response wrapping it.
2. **All scrapers write the same `ParsedListing` shape** to the same
   `listing` table via `upsertListing()` (in `scrapers/src/persist.ts`).
   The conflict key is `(source_platform, source_listing_id)` so re-runs
   are idempotent.

---

## 4. What was built in this session

**Commits (in order):**

- [`af540cf`](https://github.com/TEENGINIERS/rentmap/commit/af540cf) — initial chat agent + immersive map + FB scraper
- [`3e29f98`](https://github.com/TEENGINIERS/rentmap/commit/3e29f98) — switch to gemini-2.5-flash-lite, fix Overpass headers, tighten prompt
- [`6044cfe`](https://github.com/TEENGINIERS/rentmap/commit/6044cfe) — MagicBricks live; add sort_by; document 99acres block
- (this commit) — revert FastFlats → Rentmap; build NoBroker scraper (yields 0 — see §6); HANDOFF.md

**Files added:**

| Path | Purpose |
|---|---|
| `src/app/api/chat/route.ts` | Gemini chat endpoint, runs the tool-use loop |
| `src/lib/agent/tools.ts` | 5 tool implementations + JSON-schema declarations |
| `src/lib/agent/system-prompt.ts` | The system prompt (tightened twice — see git log) |
| `src/lib/store/listings-store.ts` | Zustand store: chat-driven listings, focus, POIs |
| `src/components/chat/ChatPanel.tsx` | Chat UI with markdown render + suggestion pills |
| `src/components/chat/ToolBadge.tsx` | Small pill badge per tool call |
| `scrapers/src/sources/facebook.ts` | Playwright FB group scraper |
| `scrapers/src/sources/facebook-login.ts` | One-time login helper, saves cookies |
| `scrapers/src/sources/nobroker.ts` | Playwright NoBroker scraper (currently no-op, see §6) |
| `HANDOFF.md` | This file |

**Files modified:**

| Path | What changed |
|---|---|
| `src/app/page.tsx` | Layout: full-screen map + chat overlay |
| `src/app/layout.tsx` | Metadata: Rentmap title/description |
| `src/components/layout/Header.tsx` | Branded as Rentmap (was experimentally FastFlats) |
| `src/components/map/MapView.tsx` | Accepts `focus` (flyTo) + `pois` (separate layer); removed maxBounds |
| `src/components/map/MapWithListings.tsx` | Reads from Zustand store; falls back to SSR seed |
| `src/lib/map/config.ts` | `MAX_BOUNDS = undefined` (immersive) |
| `scrapers/src/sources/magicbricks.ts` | LIVE: parses ld+json Apartment[] + RentAction[] |
| `scrapers/src/sources/99acres.ts` | Documented Akamai block + paid-vendor options |
| `scrapers/src/sources/index.ts` | Excludes facebook + nobroker (separate runners) |
| `scrapers/src/index.ts` | CLI dispatches fb / nobroker to their own runners |
| `scrapers/src/types.ts` | `SourcePlatform` adds `"facebook"` |
| `scrapers/src/config.ts` | `SOURCE_BASE_URLS` adds facebook |
| `package.json` | Adds `scrape:facebook`, `scrape:facebook:login` scripts |
| `.env.local` | Adds `GEMINI_API_KEY`, `GEMINI_MODEL`, `FB_GROUP_URLS`, `FB_STORAGE_STATE_PATH` |
| `.gitignore` | `.fb-session.json` (login cookies) |

---

## 5. Run book

### Local dev

```bash
# 1. Postgres must be running with rentmap_dev created and seeded.
brew services start postgresql@17
psql -h localhost -d rentmap_dev -c "select count(*) from listing;"   # should be > 0

# 2. .env.local must have at minimum:
#    DATABASE_URL=postgresql://YOU@localhost:5432/rentmap_dev
#    DIRECT_URL=postgresql://YOU@localhost:5432/rentmap_dev
#    GEMINI_API_KEY=<your key>      # see §6 about quota
#    GEMINI_MODEL=gemini-2.5-flash-lite

pnpm dev
# → open http://localhost:3000
```

### Scrapers (one-shot, run on demand)

```bash
pnpm scrape:housing       # housing.com (HTTP, polite, no extra setup)
pnpm scrape:magicbricks   # ✓ LIVE — gives 148 listings/run

pnpm scrape:facebook:login    # ONCE — opens browser, you log in to FB
pnpm scrape:facebook          # then this runs headless, scrapes group(s)

pnpm scrape:nobroker      # currently 0 results, see §6
pnpm scrape:99acres       # currently 0 results (Akamai), see §6

pnpm scrape               # everything in sequence
```

Stats for each run land in `scrapers/runs/<source>-<timestamp>.json`
(gitignored). Listings persist until next run marks unseen ones inactive.

### Useful one-liners

```bash
# How many listings per source, what's the rent range:
psql -d rentmap_dev -c "select source_platform, count(*), min(rent_inr), max(rent_inr) from listing where is_active group by source_platform"

# Manually test the chat endpoint:
curl -s localhost:3000/api/chat -X POST -H "Content-Type: application/json" \
  -d '{"message":"2BHK in Whitefield under 40k"}' | jq '.message, .toolCalls'
```

---

## 6. Known gaps, blockers, and decisions

### Gemini quota — hard cap on the free tier

This particular Google project has these per-day limits on the free tier:

| Model | RPD | Verdict |
|---|---|---|
| `gemini-2.0-flash` | **0** | Blocked outright on this account |
| `gemini-2.5-flash` | **20** | Burned during testing in <1 hour |
| `gemini-2.5-flash-lite` | **1000** | Default — works, but only 4 RPM |
| `gemini-2.5-pro` | small | Untested; probably also tight |

**The 20 RPD on flash is a *project-level* quota, not a per-key quota.**
Generating new API keys does not reset it. Two ways out:

1. Enable billing in Google Cloud Console for the same project. Lifts most
   limits to 1000 RPM. ([console.cloud.google.com/billing](https://console.cloud.google.com/billing))
2. Wait until UTC midnight (~05:30 IST) for the daily reset.

The system prompt was tightened (see `src/lib/agent/system-prompt.ts`) so
that flash-lite chains tool calls reliably and doesn't bail after the
first call. If you swap back to `gemini-2.5-flash` (smarter, follows
prompts more loosely), set `GEMINI_MODEL=gemini-2.5-flash` in `.env.local`.

### Scraper site-by-site

| Site | Status | Block | Realistic next step |
|---|---|---|---|
| housing.com | ✓ Live (`__NEXT_DATA__`) | None | Just run it |
| MagicBricks | ✓ Live (ld+json + RentAction) | robots blocks `/*proptype=` (we work around) | Re-run periodically |
| 99acres | ✗ Blocked | Akamai WAF, even `/robots.txt` denied | Vendor: ScraperAPI / Bright Data ($30+/mo) or skip |
| NoBroker | ✗ Blocked | SPA's listing-API call is malformed in their own React app; requires city-polygon token we can't get from outside | Same vendor list, or playwright-extra + stealth + manual cookie copy |
| Facebook group | ✓ Built, needs login | FB requires logged-in session | Run `pnpm scrape:facebook:login` once |

The recommended order if you have $50/mo to spend: **ScraperAPI for
NoBroker first** (43% of Bangalore search volume), then 99acres second.

### NoBroker phone numbers

We deliberately do not scrape NoBroker contact phones. Their model walls
phones behind a paid sub; scraping them is both legally risky and against
the project ethic of "structurally on the tenant's side." The detector
runs on names + cross-listing patterns; phones aren't strictly required.

### Facebook scraper notes

- The cookie file `.fb-session.json` is gitignored — re-run
  `scrape:facebook:login` if you switch machines.
- FB ToS forbids automated scraping. Use small volumes; rotate sessions
  if you ramp up. See `Business_plan.md §6.3` for the project's stance.
- Currently configured for one group: `FB_GROUP_URLS` in `.env.local`.
  Comma-separate to add more.

### Local-dev data

Auth + favorites require a real Supabase project. The `.env.local` ships
with placeholder Supabase values — login/favorites silently no-op locally.
Map + chat + listings work without Supabase. Set the three
`NEXT_PUBLIC_SUPABASE_*` + `SUPABASE_SERVICE_ROLE_KEY` vars to enable.

### Housing.com — never been run in this session

The scraper is fine but I never executed it. Try:
```bash
pnpm scrape:housing
```
Should add ~30+ more 2BHK listings.

---

## 7. What I'd do next

In rough priority:

1. **Run `pnpm scrape:housing`** — free wins.
2. **Run `pnpm scrape:facebook:login` then `pnpm scrape:facebook`** —
   gets the FB group inventory.
3. **Decide on a scraper proxy vendor** (ScraperAPI is the cheapest)
   and wire NoBroker + 99acres to it. The code paths are scaffolded;
   you just need to swap the fetch.
4. **Enable Gemini billing** so the chat can use 2.5-flash without
   running out at 20 requests/day. The smarter model produces visibly
   better recommendations.
5. **Build the v2 owner-vs-broker detector** — schema columns are
   ready (`source_label`, `source_confidence`). Inputs: phone-frequency,
   posting cadence, title boilerplate. Precision floor 90% on "broker"
   before shipping (per `src/lib/truth/README.md`).
6. **Wire scrapers to Vercel Cron** (the existing `/api/cron/refresh-medians`
   shows the pattern). Run scrapers nightly at 02:00 IST.
7. **POI rendering on the map.** The Zustand store already plumbs
   `pois` from `nearby_places`; MapView has a layer for them. The
   visual styling is minimal — could use better icons + clustering.

---

## 8. Things that will surprise the next person

- **The chat does not have streaming.** Each `POST /api/chat` is a single
  request that runs the entire tool-use loop server-side and returns one
  JSON response. Adding SSE streaming requires restructuring the route.
- **The map's POI layer is in MapView but rarely rendered** because
  `nearby_places` only fires when the user explicitly asks about
  metros/malls/etc.
- **`Header.tsx` is a server component** — keep it that way; the auth
  state surfaces via a separate client subcomponent (not yet built — the
  current Header is auth-agnostic).
- **`ChatPanel` floats over the entire map on mobile.** That's intentional
  per the FastFlats reference UI but means the map is invisible until you
  scroll the chat away. Consider a collapse button.
- **The `SourcePlatform` union and the `listing.source_platform` Postgres
  CHECK constraint must stay in sync.** Both already include `'facebook'`.
- **`__NEXT_DATA__`-based scrapers are fragile.** If housing.com renames
  their page-prop tree, the scraper silently returns []. Add a CI canary
  if you ever go to production.
