"use client";
import { useEffect, useRef, useState } from "react";
import maplibregl, { type Map, type GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { ListingCardDTO } from "@/lib/db/queries/listings";
import type { PriceVariant } from "@/lib/truth/price-anomaly";
import {
  CLUSTER_MAX_ZOOM,
  CLUSTER_RADIUS,
  DEFAULT_CENTER,
  DEFAULT_ZOOM,
  MAP_STYLE_URL,
  MAX_BOUNDS,
} from "@/lib/map/config";

// Color-code pins by price variant — this *is* the 30-second read.
const VARIANT_COLORS: Record<PriceVariant, string> = {
  fair: "#10b981", // emerald-500
  over: "#ef4444", // red-500
  under: "#3b82f6", // blue-500
  unknown: "#a1a1aa", // zinc-400
};

function toGeoJSON(listings: ListingCardDTO[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: listings.map((l) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [l.lng, l.lat] },
      properties: {
        id: l.id,
        slug: l.slug,
        title: l.title,
        rentInr: l.rentInr,
        variant: l.priceBadge.variant,
      },
    })),
  };
}

interface MapViewProps {
  listings: ListingCardDTO[];
  onSelect?: (listingId: string) => void;
  onBboxChange?: (bbox: [number, number, number, number]) => void;
}

export function MapView({ listings, onSelect, onBboxChange }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const [ready, setReady] = useState(false);

  // Init map once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE_URL,
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      maxBounds: MAX_BOUNDS,
    });
    mapRef.current = map;

    map.on("load", () => {
      map.addSource("listings", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
        cluster: true,
        clusterMaxZoom: CLUSTER_MAX_ZOOM,
        clusterRadius: CLUSTER_RADIUS,
      });

      map.addLayer({
        id: "clusters",
        type: "circle",
        source: "listings",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": "#1f2937",
          "circle-radius": ["step", ["get", "point_count"], 16, 10, 22, 50, 28],
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      });
      map.addLayer({
        id: "cluster-count",
        type: "symbol",
        source: "listings",
        filter: ["has", "point_count"],
        layout: {
          "text-field": "{point_count_abbreviated}",
          "text-size": 12,
        },
        paint: { "text-color": "#ffffff" },
      });
      map.addLayer({
        id: "unclustered-point",
        type: "circle",
        source: "listings",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-radius": 10,
          "circle-color": [
            "match",
            ["get", "variant"],
            "fair",
            VARIANT_COLORS.fair,
            "over",
            VARIANT_COLORS.over,
            "under",
            VARIANT_COLORS.under,
            VARIANT_COLORS.unknown,
          ],
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      });

      // Cluster tap → zoom in.
      map.on("click", "clusters", async (e) => {
        const features = map.queryRenderedFeatures(e.point, { layers: ["clusters"] });
        const clusterId = features[0]?.properties?.cluster_id;
        if (clusterId == null) return;
        const source = map.getSource("listings") as GeoJSONSource;
        const zoom = await source.getClusterExpansionZoom(clusterId);
        const geom = features[0]!.geometry as GeoJSON.Point;
        map.easeTo({ center: geom.coordinates as [number, number], zoom });
      });

      // Unclustered pin tap → onSelect.
      map.on("click", "unclustered-point", (e) => {
        const f = e.features?.[0];
        const id = f?.properties?.id as string | undefined;
        if (id) onSelect?.(id);
      });

      for (const layer of ["clusters", "unclustered-point"]) {
        map.on("mouseenter", layer, () => (map.getCanvas().style.cursor = "pointer"));
        map.on("mouseleave", layer, () => (map.getCanvas().style.cursor = ""));
      }

      // Debounced bbox reporter.
      let moveTimer: ReturnType<typeof setTimeout> | null = null;
      map.on("moveend", () => {
        if (!onBboxChange) return;
        if (moveTimer) clearTimeout(moveTimer);
        moveTimer = setTimeout(() => {
          const b = map.getBounds();
          if (!b) return;
          onBboxChange([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]);
        }, 250);
      });

      setReady(true);
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // onSelect/onBboxChange intentionally omitted — stable-ref expected from parent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update source data when listings change.
  useEffect(() => {
    if (!ready) return;
    const map = mapRef.current;
    if (!map) return;
    const source = map.getSource("listings") as GeoJSONSource | undefined;
    source?.setData(toGeoJSON(listings));
  }, [listings, ready]);

  return <div ref={containerRef} className="h-full w-full" data-testid="map" />;
}

export default MapView;
