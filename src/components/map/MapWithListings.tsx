"use client";
import dynamic from "next/dynamic";
import useSWR from "swr";
import { useMemo, useState } from "react";
import { MapSkeleton } from "./MapSkeleton";
import { bboxToString, type Bbox } from "@/lib/map/bbox";
import type { ListingCardDTO } from "@/lib/db/queries/listings";

const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => <MapSkeleton />,
});

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error("fetch failed");
  return res.json() as Promise<{ listings: ListingCardDTO[] }>;
};

export function MapWithListings({ initialListings }: { initialListings: ListingCardDTO[] }) {
  const [bbox, setBbox] = useState<Bbox | null>(null);

  const key = bbox ? `/api/listings?bbox=${bboxToString(bbox)}&limit=500` : null;
  const { data } = useSWR(key, fetcher, {
    keepPreviousData: true,
    dedupingInterval: 500,
  });

  const listings = useMemo(
    () => data?.listings ?? initialListings,
    [data, initialListings],
  );

  return (
    <MapView
      listings={listings}
      onBboxChange={setBbox}
      onSelect={(id) => {
        const l = listings.find((x) => x.id === id);
        if (l) window.location.href = `/listing/${l.slug}`;
      }}
    />
  );
}
