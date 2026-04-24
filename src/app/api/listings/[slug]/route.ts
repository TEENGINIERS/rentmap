import { NextResponse } from "next/server";
import { getListingBySlug } from "@/lib/db/queries/listings";
import { apiError } from "@/lib/errors";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json(apiError("invalid_slug", "Invalid slug"), { status: 400 });
  }

  const listing = await getListingBySlug(slug);
  if (!listing) {
    return NextResponse.json(apiError("not_found", "Listing not found"), { status: 404 });
  }

  return NextResponse.json(listing, {
    headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" },
  });
}
