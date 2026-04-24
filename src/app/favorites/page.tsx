import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listFavoritesForUser } from "@/lib/db/queries/favorites";
import { ListingGrid } from "@/components/listing/ListingGrid";

export const metadata: Metadata = { title: "Favorites", robots: { index: false } };

export default async function FavoritesPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/favorites");

  const listings = await listFavoritesForUser(user.id);

  return (
    <div className="container mx-auto max-w-6xl px-4 py-6">
      <h1 className="text-2xl font-bold">Your favorites</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {listings.length === 0
          ? "Save listings from the map or detail pages to see them here."
          : `${listings.length} saved listing${listings.length === 1 ? "" : "s"}.`}
      </p>
      <div className="mt-6">
        <ListingGrid listings={listings} />
      </div>
    </div>
  );
}
