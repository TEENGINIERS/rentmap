import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

declare global {
  // eslint-disable-next-line no-var
  var __rentmap_pg__: ReturnType<typeof postgres> | undefined;
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required");
}

const sql =
  globalThis.__rentmap_pg__ ??
  postgres(connectionString, {
    prepare: false,
    max: 10,
    idle_timeout: 20,
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__rentmap_pg__ = sql;
}

export const db = drizzle(sql, { schema });
export { schema };
