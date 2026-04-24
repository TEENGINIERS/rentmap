import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";

export async function GET() {
  const ts = new Date().toISOString();
  try {
    await db.execute(sql`select 1`);
    return NextResponse.json({ status: "ok", db: "ok", ts });
  } catch {
    return NextResponse.json({ status: "error", db: "error", ts }, { status: 503 });
  }
}
