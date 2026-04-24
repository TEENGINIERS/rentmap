import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getLocalityBySlug, listAllLocalitySlugs } from "@/lib/db/queries/localities";
import { listListings } from "@/lib/db/queries/listings";
import { ListingGrid } from "@/components/listing/ListingGrid";
import { formatRentFull } from "@/lib/utils";

export const revalidate = 300;

export async function generateStaticParams() {
  try {
    const slugs = await listAllLocalitySlugs();
    return slugs.map((locality) => ({ locality }));
  } catch {
    // DB unreachable at build time (e.g. CI without DB). Pages render on-demand.
    return [];
  }
}

export async function generateMetadata(
  { params }: { params: Promise<{ locality: string }> },
): Promise<Metadata> {
  const { locality } = await params;
  const area = await getLocalityBySlug(locality);
  if (!area) return { title: "Area not found" };
  const medianStr = area.median2bhk ? formatRentFull(area.median2bhk) : null;
  return {
    title: `2BHK Rentals in ${area.name}`,
    description: medianStr
      ? `Median 2BHK rent in ${area.name}: ${medianStr}/mo across ${area.sample2bhk} active listings. Every listing tagged owner or broker.`
      : `2BHK rentals in ${area.name}, Bangalore. Every listing tagged owner or broker.`,
    alternates: { canonical: `/area/${area.slug}` },
  };
}

export default async function AreaPage({ params }: { params: Promise<{ locality: string }> }) {
  const { locality } = await params;
  const area = await getLocalityBySlug(locality);
  if (!area) notFound();

  const { listings } = await listListings({ localitySlug: area.slug, bhk: 2, limit: 100 });
  const owners = listings.filter((l) => l.sourceBadge.variant === "owner");

  return (
    <div className="container mx-auto max-w-6xl px-4 py-6">
      <nav className="mb-4 text-sm text-muted-foreground">
        <Link href="/" className="hover:underline">Map</Link>
        {" / "}
        <span>{area.name}</span>
      </nav>

      <h1 className="text-3xl font-bold">2BHK Rentals in {area.name}</h1>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          label="Median rent (2BHK)"
          value={area.median2bhk ? formatRentFull(area.median2bhk) : "—"}
          sub={area.median2bhk ? `across ${area.sample2bhk} listings` : "not enough data yet"}
        />
        <StatCard label="Active listings" value={String(listings.length)} sub="on Rentmap" />
        <StatCard
          label="Owner-posted"
          value={String(owners.length)}
          sub={`${Math.round((owners.length / Math.max(listings.length, 1)) * 100)}% of total`}
        />
      </div>

      <section className="mt-8">
        <h2 className="mb-4 text-xl font-semibold">Available now</h2>
        <ListingGrid listings={listings} />
      </section>

      {owners.length > 0 ? (
        <section className="mt-10">
          <h2 className="mb-4 text-xl font-semibold">Posted by owners (no brokerage)</h2>
          <ListingGrid listings={owners} />
        </section>
      ) : null}
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-md border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}
