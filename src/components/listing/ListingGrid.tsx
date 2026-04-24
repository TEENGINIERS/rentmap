import { ListingCard } from "./ListingCard";
import type { ListingCardDTO } from "@/lib/db/queries/listings";

export function ListingGrid({ listings }: { listings: ListingCardDTO[] }) {
  if (listings.length === 0) {
    return (
      <div className="flex min-h-[200px] items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
        No listings in view. Try zooming out.
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {listings.map((l) => (
        <ListingCard key={l.id} listing={l} />
      ))}
    </div>
  );
}
