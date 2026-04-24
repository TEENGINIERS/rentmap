-- Extensions required for the schema.
create extension if not exists postgis;
create extension if not exists pgcrypto; -- gen_random_uuid

-- ---------------------------------------------------------------------------
-- locality_price_stats — median rent per (locality, bhk) for active listings.
-- Refreshed nightly via Vercel Cron (see /api/cron/refresh-medians).
--
-- Sample size < 5 → UI treats the median as unreliable and renders PRICE UNKNOWN.
-- ---------------------------------------------------------------------------
create materialized view if not exists locality_price_stats as
select
  locality_id,
  bhk,
  percentile_cont(0.5) within group (order by rent_inr)::integer as median_rent,
  percentile_cont(0.25) within group (order by rent_inr)::integer as p25_rent,
  percentile_cont(0.75) within group (order by rent_inr)::integer as p75_rent,
  count(*)::integer as sample_size,
  now() as computed_at
from listing
where is_active = true
group by locality_id, bhk;

-- unique index required to use REFRESH MATERIALIZED VIEW CONCURRENTLY
create unique index if not exists uq_locality_price_stats
  on locality_price_stats (locality_id, bhk);
