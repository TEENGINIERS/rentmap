import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getListingBySlug } from "@/lib/db/queries/listings";
import { PriceBadge } from "@/components/badges/PriceBadge";
import { SourceBadge } from "@/components/badges/SourceBadge";
import { PhotoCarousel } from "@/components/listing/PhotoCarousel";
import { FactTable } from "@/components/listing/FactTable";
import { FavoriteButton } from "@/components/favorite/FavoriteButton";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isFavorited } from "@/lib/db/queries/favorites";
import { formatRentFull } from "@/lib/utils";

export const revalidate = 300;

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const { slug } = await params;
  const listing = await getListingBySlug(slug);
  if (!listing) return { title: "Not found" };
  const rent = formatRentFull(listing.rentInr);
  const title = `${listing.bhk}BHK in ${listing.localityName} for ${rent}/mo`;
  const description = `${listing.priceBadge.label} · ${listing.sourceBadge.label}. ${listing.areaSqft ? `${listing.areaSqft} sqft. ` : ""}${listing.furnishing ?? ""} · Available ${listing.availableFrom ?? "soon"}.`;
  return {
    title,
    description,
    openGraph: { title, description, type: "article" },
    alternates: { canonical: `/listing/${listing.slug}` },
  };
}

export default async function ListingDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const listing = await getListingBySlug(slug);
  if (!listing) notFound();

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const favorited = user ? await isFavorited(user.id, listing.id) : false;

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Apartment",
    name: listing.title,
    description: listing.description,
    numberOfRooms: listing.bhk,
    floorSize: listing.areaSqft ? { "@type": "QuantitativeValue", value: listing.areaSqft, unitCode: "FTK" } : undefined,
    address: {
      "@type": "PostalAddress",
      streetAddress: listing.addressLine,
      addressLocality: listing.localityName,
      addressRegion: "KA",
      addressCountry: "IN",
    },
    geo: { "@type": "GeoCoordinates", latitude: listing.lat, longitude: listing.lng },
    offers: {
      "@type": "Offer",
      price: listing.rentInr,
      priceCurrency: "INR",
      availability: "https://schema.org/InStock",
    },
  };

  return (
    <div className="container mx-auto max-w-4xl px-4 py-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <nav className="mb-4 text-sm text-muted-foreground">
        <Link href="/" className="hover:underline">Map</Link>
        {" / "}
        <Link href={`/area/${listing.localitySlug}`} className="hover:underline">
          {listing.localityName}
        </Link>
      </nav>

      <PhotoCarousel photos={listing.photos} alt={listing.title} />

      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{listing.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{listing.addressLine}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <PriceBadge badge={listing.priceBadge} />
            <SourceBadge badge={listing.sourceBadge} />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-3xl font-bold">{formatRentFull(listing.rentInr)}</div>
            <div className="text-xs text-muted-foreground">per month</div>
          </div>
          <FavoriteButton
            listingId={listing.id}
            initialFavorited={favorited}
            isSignedIn={!!user}
          />
        </div>
      </div>

      {listing.description ? (
        <div className="mt-6">
          <h2 className="mb-2 text-sm font-semibold uppercase text-muted-foreground">About</h2>
          <p className="whitespace-pre-line text-sm leading-6">{listing.description}</p>
        </div>
      ) : null}

      <div className="mt-6">
        <h2 className="mb-2 text-sm font-semibold uppercase text-muted-foreground">Details</h2>
        <FactTable listing={listing} />
      </div>

      {listing.contactName ? (
        <div className="mt-6 rounded-md border bg-muted/30 p-4 text-sm">
          <div className="font-medium">Contact</div>
          <div className="text-muted-foreground">{listing.contactName}</div>
          {listing.sourceBadge.variant === "broker" ? (
            <p className="mt-2 text-xs text-orange-600">
              Heads up: {listing.sourceBadge.label.toLowerCase()}. Ask about brokerage upfront —
              one month&apos;s rent is the typical ask.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
