import Link from "next/link";
import { Card } from "@/components/ui/card";
import { PriceBadge } from "@/components/badges/PriceBadge";
import { SourceBadge } from "@/components/badges/SourceBadge";
import { formatRentFull } from "@/lib/utils";
import type { ListingCardDTO } from "@/lib/db/queries/listings";

export function ListingCard({ listing }: { listing: ListingCardDTO }) {
  return (
    <Link href={`/listing/${listing.slug}`} className="group block">
      <Card className="overflow-hidden transition-shadow hover:shadow-md">
        <div className="relative aspect-[4/3] w-full bg-muted">
          {listing.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={listing.photoUrl}
              alt={listing.title}
              loading="lazy"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
              No photo
            </div>
          )}
        </div>
        <div className="p-4">
          <div className="mb-2 flex flex-wrap gap-1.5">
            <PriceBadge badge={listing.priceBadge} />
            <SourceBadge badge={listing.sourceBadge} />
          </div>
          <div className="text-lg font-semibold">{formatRentFull(listing.rentInr)}/mo</div>
          <h3 className="mt-1 line-clamp-2 text-sm font-medium">{listing.title}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{listing.localityName}</p>
        </div>
      </Card>
    </Link>
  );
}
