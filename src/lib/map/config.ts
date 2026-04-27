/**
 * OpenFreeMap serves free global OSM vector tiles — no signup, no token.
 * Styles available: positron (light), bright, liberty (full).
 * We pick "positron" — low-chroma gray/beige palette lets our colored pins pop.
 *
 * If OpenFreeMap ever goes down, swappable alternatives:
 *   - https://api.maptiler.com/maps/basic/style.json?key=YOUR_KEY  (100k/mo free)
 *   - https://demotiles.maplibre.org/style.json                     (demo, low-quality)
 *   - Self-host via protomaps PMTiles
 */
export const MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/positron";

/** Bangalore city center — default map target. */
export const DEFAULT_CENTER: [number, number] = [77.5946, 12.9716];
export const DEFAULT_ZOOM = 12;

/**
 * Map is fully immersive — pan/zoom unrestricted. Listings are Bangalore-
 * focused for now, but the user can explore freely.
 */
export const MAX_BOUNDS: [[number, number], [number, number]] | undefined = undefined;

export const CLUSTER_RADIUS = 50;
export const CLUSTER_MAX_ZOOM = 14;
