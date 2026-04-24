import type { Config } from "drizzle-kit";

// For `generate` we only need the schema; `migrate`/`push` needs a URL.
const url = process.env.DIRECT_URL ?? "postgresql://__placeholder__";

export default {
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url },
  verbose: true,
  strict: true,
} satisfies Config;
