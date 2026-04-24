import { listListings } from "@/lib/db/queries/listings";
import { ListingGrid } from "@/components/listing/ListingGrid";
import { MapWithListings } from "@/components/map/MapWithListings";

export const revalidate = 60;
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const listings = await listListings({ bhk: 2, limit: 500 })
    .then((r) => r.listings)
    .catch(() => [] as Awaited<ReturnType<typeof listListings>>["listings"]);

  return (
    <div className="flex flex-col lg:h-[calc(100dvh-3.5rem)] lg:flex-row">
      {/* Map: top half on mobile, right two-thirds on desktop. */}
      <section className="order-2 h-[50dvh] w-full lg:order-2 lg:h-full lg:w-2/3">
        <MapWithListings initialListings={listings} />
      </section>

      {/* List: bottom half on mobile, left one-third on desktop. */}
      <section className="order-1 w-full overflow-y-auto border-t lg:order-1 lg:w-1/3 lg:border-r lg:border-t-0">
        <div className="p-4">
          <h1 className="text-xl font-semibold">Bangalore 2BHK rentals</h1>
          <p className="text-sm text-muted-foreground">
            {listings.length} listings · <span className="text-emerald-600">green = fair</span>{" "}
            · <span className="text-red-600">red = over median</span> ·{" "}
            <span className="text-blue-600">blue = underpriced</span>
          </p>
        </div>
        <div className="p-4 pt-0">
          <ListingGrid listings={listings} />
        </div>
      </section>
    </div>
  );
}
