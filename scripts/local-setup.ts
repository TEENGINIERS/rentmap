/**
 * One-shot local dev bootstrap. Idempotent.
 *
 *   1. Connects to DIRECT_URL (local Postgres).
 *   2. Enables extensions (postgis, pgcrypto).
 *   3. Applies drizzle/0000_initial.sql if present, else drizzle-kit push.
 *   4. Applies drizzle/0001_extensions_and_matview.sql.
 *   5. SKIPS drizzle/0002_auth_and_rls.sql — it depends on Supabase's
 *      auth.users and auth.uid() which plain Postgres doesn't have.
 *
 * After this, `pnpm db:seed` works.
 */
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import postgres from "postgres";

async function main() {
  const conn = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!conn) {
    throw new Error("DIRECT_URL (or DATABASE_URL) must be set");
  }

  const sql = postgres(conn, { prepare: false, max: 1 });

  console.log("→ enabling extensions");
  await sql.unsafe(`CREATE EXTENSION IF NOT EXISTS postgis;`);
  await sql.unsafe(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);

  const drizzleDir = resolve(process.cwd(), "drizzle");
  const entries = await readdir(drizzleDir);
  const migrations = entries
    .filter((f) => f.endsWith(".sql"))
    .filter((f) => !f.endsWith("_auth_and_rls.sql")) // skip Supabase-specific
    .sort();

  for (const file of migrations) {
    const path = resolve(drizzleDir, file);
    const content = await readFile(path, "utf-8");
    console.log(`→ applying ${file}`);
    // Split on statement breakpoints that Drizzle emits, else run whole file.
    const statements = content.includes("--> statement-breakpoint")
      ? content.split("--> statement-breakpoint")
      : [content];
    for (const stmt of statements) {
      const trimmed = stmt.trim();
      if (!trimmed) continue;
      try {
        await sql.unsafe(trimmed);
      } catch (e) {
        const msg = (e as Error).message;
        // Ignore "already exists" — makes the script idempotent.
        if (
          msg.includes("already exists") ||
          msg.includes("duplicate key value violates")
        ) {
          continue;
        }
        console.error(`  ✗ ${file}: ${msg}`);
        throw e;
      }
    }
  }

  console.log("✓ local DB ready. Run `pnpm db:seed` next.");
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
