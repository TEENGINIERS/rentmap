# Migrations

Source of truth: `src/lib/db/schema.ts` (Drizzle). `drizzle-kit` generates `0000_*.sql` from it.

Migrations 0001+ are **hand-written** because they contain things Drizzle can't express:
- `0001_extensions_and_matview.sql` — enables `postgis` + `pgcrypto`, creates `locality_price_stats` materialized view.
- `0002_auth_and_rls.sql` — Supabase `auth.users` trigger + RLS policies.

## Workflow

```bash
# 1. Edit src/lib/db/schema.ts
# 2. Generate SQL from diff:
pnpm db:generate
# 3. Review drizzle/0000_*.sql (and any hand-written .sql in order)
# 4. Apply:
pnpm db:migrate
```

## Order

drizzle-kit runs files alphabetically. Our hand-written migrations are numbered to fall after the generated `0000_initial.sql`:
1. `0000_*.sql` — generated table DDL
2. `0001_extensions_and_matview.sql` — postgis + matview
3. `0002_auth_and_rls.sql` — Supabase trigger + RLS

## Resetting locally

Supabase free tier: use the dashboard SQL editor → run `drop schema public cascade; create schema public;`, then re-run migrations.
