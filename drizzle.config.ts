import type { Config } from "drizzle-kit";

if (!process.env.DIRECT_URL) {
  throw new Error("DIRECT_URL must be set for drizzle-kit");
}

export default {
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DIRECT_URL,
  },
  verbose: true,
  strict: true,
} satisfies Config;
