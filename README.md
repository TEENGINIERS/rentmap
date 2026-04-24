# Rentmap

Tenant-side truth map for Bangalore 2BHK rentals. See [rentmap-brief.md](rentmap-brief.md) for the product thesis and [Business_plan.md](Business_plan.md) for the market analysis.

**v1 scope**: map + listing pages + truth badges (price anomaly + owner-vs-broker) with seeded data. No scrapers yet — schema is already future-proofed for v2.

---

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router) + TypeScript strict |
| DB | Postgres on Supabase + PostGIS + pgvector-ready |
| ORM | Drizzle |
| Auth | Supabase Auth (email magic link) |
| Map | Mapbox GL JS (clustering, vector tiles) |
| UI | Tailwind CSS 4 + shadcn-style primitives + Lucide icons |
| Observability | Vercel Analytics + Speed Insights + Sentry (optional) |
| Deploy | Vercel + Supabase |

---

## Quickstart

```bash
# 1. Install Node 22+ and enable pnpm via corepack
corepack enable pnpm
pnpm install

# 2. Provision Supabase
#    - Create a project at supabase.com (ap-south-1 / Mumbai region)
#    - SQL Editor → enable `postgis` and `pgcrypto` extensions
#    - Authentication → Providers → Email → enable magic link

# 3. Copy env template and fill in credentials
cp .env.example .env.local
# Required: DATABASE_URL, DIRECT_URL, NEXT_PUBLIC_SUPABASE_URL,
# NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY,
# NEXT_PUBLIC_MAPBOX_TOKEN, NEXT_PUBLIC_SITE_URL, CRON_SECRET

# 4. Generate + apply migrations
pnpm db:generate   # emits drizzle/0000_*.sql from the schema
pnpm db:migrate    # applies all migrations (0000..0002) in order

# 5. Seed data
pnpm db:seed       # 30 localities + 30 hand-labeled 2BHK listings

# 6. Start dev server
pnpm dev           # http://localhost:3000
```

---

## Architecture at a glance

- **SSR-first**: `/`, `/listing/[slug]`, `/area/[locality]` are server-rendered for SEO. Map is a client-only island (`next/dynamic({ ssr: false })`).
- **Truth signals are computed, never stored raw**: `src/lib/truth/price-anomaly.ts` + `src/lib/truth/source-label.ts` take DB fields and return opaque badge DTOs. v2 can swap the detector without touching UI or API.
- **Every listing read goes through `src/lib/db/queries/listings.ts`** — the single place badges are computed.
- **Seed UPSERTs on `(source_platform, source_listing_id)`** — the exact contract v2 scrapers will use. No schema churn when scrapers land.
- **RLS everywhere**: anon/authenticated get `select` on listings; `favorite` is strictly `auth.uid() = user_id`.
- **Materialized view `locality_price_stats`** refreshed nightly via Vercel Cron. Sample-size floor of 5 per `{locality, bhk}` — below that, UI shows `PRICE UNKNOWN`.

```
src/
├─ app/                  # Next.js App Router (pages + API)
│  ├─ page.tsx           # SSR grid + client map island
│  ├─ listing/[slug]/    # SSR detail, JSON-LD, OG meta
│  ├─ area/[locality]/   # SSR long-tail SEO pages
│  ├─ favorites/         # Auth-gated
│  ├─ login/             # Magic link
│  ├─ auth/callback/     # Supabase PKCE exchange
│  └─ api/               # REST handlers
├─ components/
│  ├─ map/               # Mapbox GL, clustering, dynamic import
│  ├─ listing/           # Card, Grid, Detail, Photos, Facts
│  ├─ badges/            # PriceBadge, SourceBadge
│  ├─ favorite/          # Optimistic heart
│  └─ ui/                # Button, Badge, Card, Input
└─ lib/
   ├─ db/schema.ts       # Drizzle — single source of truth
   ├─ db/queries/        # listings, localities, favorites (server-only)
   ├─ truth/             # Pure functions — the badge logic
   ├─ supabase/          # server, client, middleware wrappers
   └─ map/               # config, bbox helpers
```

---

## Commands

```bash
pnpm dev              # dev server
pnpm build            # production build
pnpm start            # production server
pnpm typecheck        # tsc --noEmit
pnpm lint             # eslint
pnpm format           # prettier --write
pnpm test             # vitest (unit)
pnpm test:e2e         # playwright (e2e)
pnpm db:generate      # generate migration from schema diff
pnpm db:migrate       # apply pending migrations
pnpm db:studio        # drizzle studio (browse DB)
pnpm db:seed          # idempotent seed loader
pnpm db:refresh-medians  # manual median refresh
```

---

## Cost (free tier at v1 scale)

| Service | Free tier | Breakpoint |
|---|---|---|
| Vercel Hobby | 100 GB-hrs fn, 1 TB bw | ~20k MAU |
| Supabase Free | 500MB DB, 50k MAU | 50k MAU |
| Mapbox | 50k map loads/mo | ~15k MAU |
| Sentry Dev | 5k errors/mo | error-rate dependent |

---

## V2 swap: how scrapers land without code churn

1. Scrape a listing from (say) 99acres.
2. Parse into the exact shape `seed/listings.json` uses.
3. `INSERT ... ON CONFLICT (source_platform, source_listing_id) DO UPDATE SET last_seen_at = now(), ...`.
4. That's it. Truth badges, API, UI all inherit the new row. No migration, no API version bump.

See [src/lib/truth/README.md](src/lib/truth/README.md) for how the owner-vs-broker **detector** replaces hand-labels in v2 without UI changes.

---

## Out of scope (v1)

Scrapers · Fake-photo detection · Building pages · NL search · WhatsApp alerts · Native app · ₹1,999 service · Admin panel · Listing-creation flow.

All deliberate — see [Business_plan.md §5.5](Business_plan.md).
