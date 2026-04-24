import type { ListingDetailDTO } from "@/lib/db/queries/listings";
import { formatRentFull } from "@/lib/utils";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  if (value == null || value === "") return null;
  return (
    <div className="flex items-baseline justify-between border-b py-2 last:border-0">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{value}</dd>
    </div>
  );
}

export function FactTable({ listing }: { listing: ListingDetailDTO }) {
  return (
    <dl className="rounded-md border bg-card p-4">
      <Row label="Monthly rent" value={formatRentFull(listing.rentInr)} />
      <Row label="Deposit" value={listing.depositInr != null ? formatRentFull(listing.depositInr) : null} />
      <Row label="Built-up area" value={listing.areaSqft != null ? `${listing.areaSqft} sqft` : null} />
      <Row
        label="Floor"
        value={
          listing.floor != null && listing.totalFloors != null
            ? `${listing.floor} of ${listing.totalFloors}`
            : listing.floor != null
              ? listing.floor
              : null
        }
      />
      <Row label="Furnishing" value={listing.furnishing?.replace(/^\w/, (c) => c.toUpperCase())} />
      <Row label="Available from" value={listing.availableFrom} />
      <Row label="Locality" value={listing.localityName} />
      <Row label="Address" value={listing.addressLine} />
    </dl>
  );
}
