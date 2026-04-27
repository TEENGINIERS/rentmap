import { listListings } from "@/lib/db/queries/listings";
import { MapWithListings } from "@/components/map/MapWithListings";
import { ChatPanel } from "@/components/chat/ChatPanel";

export const revalidate = 60;
export const dynamic = "force-dynamic";

export default async function HomePage() {
  // Seed the map with whatever's in the DB. Chat results will replace this
  // as soon as the user runs a query.
  const listings = await listListings({ limit: 500 })
    .then((r) => r.listings)
    .catch(() => [] as Awaited<ReturnType<typeof listListings>>["listings"]);

  return (
    <div className="relative h-[calc(100dvh-3.5rem)] w-full">
      {/* Map fills the viewport. */}
      <div className="absolute inset-0">
        <MapWithListings initialListings={listings} />
      </div>

      {/* Chat panel — overlay, left side on desktop, full-width sheet on mobile. */}
      <div className="pointer-events-none absolute inset-0 z-10">
        <div className="pointer-events-auto absolute bottom-3 left-3 right-3 top-3 lg:bottom-4 lg:left-4 lg:right-auto lg:top-4 lg:w-[420px]">
          <ChatPanel />
        </div>
      </div>
    </div>
  );
}
