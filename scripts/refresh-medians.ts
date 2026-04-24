/**
 * Refresh the locality_price_stats materialized view.
 * Called by Vercel Cron nightly via `/api/cron/refresh-medians`.
 */
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import postgres from "postgres";

async function main() {
  const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DIRECT_URL (or DATABASE_URL) must be set");
  }

  const client = postgres(connectionString, { prepare: false, max: 1 });
  const db = drizzle(client);

  const start = Date.now();
  try {
    await db.execute(sql`refresh materialized view concurrently locality_price_stats`);
  } catch {
    await db.execute(sql`refresh materialized view locality_price_stats`);
  }
  console.log(`✓ locality_price_stats refreshed in ${Date.now() - start}ms`);

  await client.end();
}

main().catch((e) => {
  console.error("refresh failed:", e);
  process.exit(1);
});
