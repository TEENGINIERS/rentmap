export type Bbox = [west: number, south: number, east: number, north: number];

export function bboxToString(bbox: Bbox): string {
  return bbox.map((n) => n.toFixed(4)).join(",");
}

export function parseBbox(s: string | null): Bbox | null {
  if (!s) return null;
  const parts = s.split(",").map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return null;
  const [w, south, e, n] = parts as [number, number, number, number];
  if (w >= e || south >= n) return null;
  if (south < -90 || n > 90 || w < -180 || e > 180) return null;
  return [w, south, e, n];
}
