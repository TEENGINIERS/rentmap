"use client";
import { useEffect, useRef, useState } from "react";
import maplibregl, { type Map, type GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { ListingCardDTO } from "@/lib/db/queries/listings";
import type { PriceVariant } from "@/lib/truth/price-anomaly";
import type { MapFocus, MapPoi } from "@/lib/store/listings-store";
import {
  CLUSTER_MAX_ZOOM,
  CLUSTER_RADIUS,
  DEFAULT_CENTER,
  DEFAULT_ZOOM,
  MAP_STYLE_URL,
  MAX_BOUNDS,
} from "@/lib/map/config";

const VARIANT_COLORS: Record<PriceVariant, string> = {
  fair: "#10b981",
  over: "#ef4444",
  under: "#3b82f6",
  unknown: "#a1a1aa",
};

const POI_COLOR: Record<string, string> = {
  metro: "#7c3aed",
  mall: "#ea580c",
  hospital: "#dc2626",
  restaurant: "#f59e0b",
  school: "#0ea5e9",
  bank: "#16a34a",
  park: "#22c55e",
};

function listingsGeoJSON(listings: ListingCardDTO[]): GeoJSON.FeatureCollection {
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

function poisGeoJSON(pois: MapPoi[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: pois.map((p) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [p.lng, p.lat] },
      properties: {
        name: p.name,
        category: p.category,
        color: POI_COLOR[p.category] ?? "#6b7280",
      },
    })),
  };
}

interface MapViewProps {
  listings: ListingCardDTO[];
  pois?: MapPoi[];
  focus?: MapFocus | null;
  onSelect?: (listingId: string) => void;
  onBboxChange?: (bbox: [number, number, number, number]) => void;
}

export function MapView({ listings, pois = [], focus, onSelect, onBboxChange }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE_URL,
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      ...(MAX_BOUNDS ? { maxBounds: MAX_BOUNDS } : {}),
    });
    mapRef.current = map;

    map.on("load", () => {
      // Listings source — clustered.
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
        layout: { "text-field": "{point_count_abbreviated}", "text-size": 12 },
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

      // POI source — separate, no clustering, smaller markers.
      map.addSource("pois", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: "poi-points",
        type: "circle",
        source: "pois",
        paint: {
          "circle-radius": 5,
          "circle-color": ["get", "color"],
          "circle-stroke-width": 1.5,
          "circle-stroke-color": "#ffffff",
          "circle-opacity": 0.85,
        },
      });
      map.addLayer({
        id: "poi-labels",
        type: "symbol",
        source: "pois",
        layout: {
          "text-field": ["get", "name"],
          "text-size": 11,
          "text-offset": [0, 1.2],
          "text-anchor": "top",
          "text-optional": true,
          "text-allow-overlap": false,
        },
        paint: {
          "text-color": "#374151",
          "text-halo-color": "#ffffff",
          "text-halo-width": 1.5,
        },
      });

      // Cluster click → zoom in.
      map.on("click", "clusters", async (e) => {
        const features = map.queryRenderedFeatures(e.point, { layers: ["clusters"] });
        const clusterId = features[0]?.properties?.cluster_id;
        if (clusterId == null) return;
        const source = map.getSource("listings") as GeoJSONSource;
        const zoom = await source.getClusterExpansionZoom(clusterId);
        const geom = features[0]!.geometry as GeoJSON.Point;
        map.easeTo({ center: geom.coordinates as [number, number], zoom });
      });

      map.on("click", "unclustered-point", (e) => {
        const f = e.features?.[0];
        const id = f?.properties?.id as string | undefined;
        if (id) onSelect?.(id);
      });

      for (const layer of ["clusters", "unclustered-point", "poi-points"]) {
        map.on("mouseenter", layer, () => (map.getCanvas().style.cursor = "pointer"));
        map.on("mouseleave", layer, () => (map.getCanvas().style.cursor = ""));
      }

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update listings source when listings change.
  useEffect(() => {
    if (!ready) return;
    const map = mapRef.current;
    if (!map) return;
    const src = map.getSource("listings") as GeoJSONSource | undefined;
    src?.setData(listingsGeoJSON(listings));
  }, [listings, ready]);

  // Update POI source.
  useEffect(() => {
    if (!ready) return;
    const map = mapRef.current;
    if (!map) return;
    const src = map.getSource("pois") as GeoJSONSource | undefined;
    src?.setData(poisGeoJSON(pois));
  }, [pois, ready]);

  // Fly to focus.
  useEffect(() => {
    if (!ready || !focus) return;
    const map = mapRef.current;
    if (!map) return;
    map.flyTo({
      center: [focus.lng, focus.lat],
      zoom: focus.zoom ?? 14,
      essential: true,
      duration: 1200,
    });
  }, [focus, ready]);

  return <div ref={containerRef} className="h-full w-full" data-testid="map" />;
}

export default MapView;
