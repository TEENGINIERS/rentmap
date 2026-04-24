/**
 * Fails fast in CI if required envs are missing or malformed.
 */
import { z } from "zod";

const required = z.object({
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  NEXT_PUBLIC_MAPBOX_TOKEN: z.string().startsWith("pk."),
  NEXT_PUBLIC_SITE_URL: z.string().url(),
  CRON_SECRET: z.string().min(16),
});

const result = required.safeParse(process.env);
if (!result.success) {
  console.error("✗ Missing or invalid env vars:");
  for (const err of result.error.errors) {
    console.error(`  - ${err.path.join(".")}: ${err.message}`);
  }
  process.exit(1);
}
console.log("✓ All required env vars present.");
