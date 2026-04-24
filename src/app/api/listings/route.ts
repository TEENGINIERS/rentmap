import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { listListings } from "@/lib/db/queries/listings";
import { apiError } from "@/lib/errors";

const BboxSchema = z
  .string()
  .regex(/^-?\d+(\.\d+)?(,-?\d+(\.\d+)?){3}$/)
  .transform((s) => s.split(",").map(Number) as [number, number, number, number])
  .refine(([w, s, e, n]) => w < e && s < n && s >= -90 && n <= 90 && w >= -180 && e <= 180, {
    message: "Invalid bbox",
  });

const QuerySchema = z.object({
  bbox: BboxSchema.optional(),
  locality: z.string().regex(/^[a-z0-9-]+$/).optional(),
  bhk: z.coerce.number().int().min(1).max(5).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(200),
});

export async function GET(req: NextRequest) {
  const raw = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed = QuerySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(apiError("invalid_query", parsed.error.message), { status: 400 });
  }

  try {
    const result = await listListings({
      bbox: parsed.data.bbox,
      localitySlug: parsed.data.locality,
      bhk: parsed.data.bhk,
      limit: parsed.data.limit,
    });
    return NextResponse.json(result, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
    });
  } catch (e) {
    console.error("listListings failed", e);
    return NextResponse.json(apiError("internal", "Failed to fetch listings"), { status: 500 });
  }
}
