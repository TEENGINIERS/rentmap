import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  addFavorite,
  listFavoritesForUser,
  removeFavorite,
} from "@/lib/db/queries/favorites";
import { apiError } from "@/lib/errors";

const BodySchema = z.object({
  listingId: z.string().uuid(),
});

async function requireUser() {
  const supabase = await createSupabaseServerClient();
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user;
  } catch {
    return null;
  }
}

export async function GET() {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json(apiError("unauthorized", "Sign in required"), { status: 401 });
  }
  const listings = await listFavoritesForUser(user.id);
  return NextResponse.json({ listings });
}

export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json(apiError("unauthorized", "Sign in required"), { status: 401 });
  }
  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(apiError("invalid_body", "listingId is required"), { status: 400 });
  }
  await addFavorite(user.id, parsed.data.listingId);
  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json(apiError("unauthorized", "Sign in required"), { status: 401 });
  }
  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(apiError("invalid_body", "listingId is required"), { status: 400 });
  }
  await removeFavorite(user.id, parsed.data.listingId);
  return NextResponse.json({ ok: true });
}
