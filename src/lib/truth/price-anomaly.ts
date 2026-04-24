/**
 * Price anomaly — the cheapest, highest-RICE truth signal (business plan §5.2 rank 1).
 *
 * Pure. Deterministic. Server-evaluated inside the listings query, never client-side.
 * Result is the `priceBadge` field on the API DTO — clients render opaque labels.
 *
 * Evolution (v2): the constant 15% threshold becomes per-locality p25/p75 bounds from
 * `locality_price_stats`. API shape is unchanged; swap the function body.
 */

export type PriceVariant = "fair" | "over" | "under" | "unknown";

export interface PriceBadge {
  variant: PriceVariant;
  label: string;
  deltaInr: number;
  deltaPct: number;
  sampleSize: number;
}

export interface PriceAnomalyInput {
  rentInr: number;
  medianRent: number | null;
  sampleSize: number;
  thresholdPct?: number;
}

const DEFAULT_THRESHOLD_PCT = 15;
const MIN_SAMPLE_SIZE = 5;

export function computePriceBadge(input: PriceAnomalyInput): PriceBadge {
  const { rentInr, medianRent, sampleSize, thresholdPct = DEFAULT_THRESHOLD_PCT } = input;

  if (sampleSize < MIN_SAMPLE_SIZE || medianRent == null || medianRent <= 0) {
    return {
      variant: "unknown",
      label: "PRICE UNKNOWN",
      deltaInr: 0,
      deltaPct: 0,
      sampleSize,
    };
  }

  const deltaInr = rentInr - medianRent;
  const deltaPct = (deltaInr / medianRent) * 100;

  if (deltaPct > thresholdPct) {
    const deltaK = Math.ceil(deltaInr / 1000);
    return {
      variant: "over",
      label: `₹${deltaK}K OVER MEDIAN`,
      deltaInr,
      deltaPct,
      sampleSize,
    };
  }

  if (deltaPct < -thresholdPct) {
    return {
      variant: "under",
      label: "UNDERPRICED",
      deltaInr,
      deltaPct,
      sampleSize,
    };
  }

  return {
    variant: "fair",
    label: "FAIR PRICE",
    deltaInr,
    deltaPct,
    sampleSize,
  };
}
