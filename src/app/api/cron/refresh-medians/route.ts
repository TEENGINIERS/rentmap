import { NextResponse, type NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return NextResponse.json({ error: "forbidden" }, { status: 401 });
  }

  const start = Date.now();
  try {
    await db.execute(sql`refresh materialized view concurrently locality_price_stats`);
  } catch {
    await db.execute(sql`refresh materialized view locality_price_stats`);
  }
  return NextResponse.json({ refreshedIn: Date.now() - start });
}
