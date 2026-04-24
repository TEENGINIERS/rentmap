import { describe, expect, it } from "vitest";
import { computePriceBadge } from "@/lib/truth/price-anomaly";

describe("computePriceBadge", () => {
  const median = 50_000;
  const sampleSize = 10;

  describe("unknown variant", () => {
    it("returns unknown when sample size is below 5", () => {
      const badge = computePriceBadge({ rentInr: 50_000, medianRent: median, sampleSize: 4 });
      expect(badge.variant).toBe("unknown");
      expect(badge.label).toBe("PRICE UNKNOWN");
    });

    it("returns unknown when sample size is 0", () => {
      const badge = computePriceBadge({ rentInr: 50_000, medianRent: null, sampleSize: 0 });
      expect(badge.variant).toBe("unknown");
    });

    it("returns unknown when median is null", () => {
      const badge = computePriceBadge({ rentInr: 50_000, medianRent: null, sampleSize: 20 });
      expect(badge.variant).toBe("unknown");
    });

    it("returns unknown when median is zero (guard against division-by-zero)", () => {
      const badge = computePriceBadge({ rentInr: 50_000, medianRent: 0, sampleSize: 20 });
      expect(badge.variant).toBe("unknown");
    });

    it("returns unknown when median is negative (sanity guard)", () => {
      const badge = computePriceBadge({ rentInr: 50_000, medianRent: -100, sampleSize: 20 });
      expect(badge.variant).toBe("unknown");
    });
  });

  describe("fair variant (within ±15% default)", () => {
    it("labels exact median as fair", () => {
      const badge = computePriceBadge({ rentInr: 50_000, medianRent: median, sampleSize });
      expect(badge.variant).toBe("fair");
      expect(badge.label).toBe("FAIR PRICE");
      expect(badge.deltaInr).toBe(0);
    });

    it("labels +10% as fair", () => {
      const badge = computePriceBadge({ rentInr: 55_000, medianRent: median, sampleSize });
      expect(badge.variant).toBe("fair");
    });

    it("labels -10% as fair", () => {
      const badge = computePriceBadge({ rentInr: 45_000, medianRent: median, sampleSize });
      expect(badge.variant).toBe("fair");
    });

    it("labels exactly +15% as fair (boundary is exclusive on OVER)", () => {
      const badge = computePriceBadge({ rentInr: 57_500, medianRent: median, sampleSize });
      expect(badge.variant).toBe("fair");
    });

    it("labels exactly -15% as fair (boundary is exclusive on UNDER)", () => {
      const badge = computePriceBadge({ rentInr: 42_500, medianRent: median, sampleSize });
      expect(badge.variant).toBe("fair");
    });
  });

  describe("over variant", () => {
    it("labels +20% as over and formats delta in Xk", () => {
      const badge = computePriceBadge({ rentInr: 60_000, medianRent: median, sampleSize });
      expect(badge.variant).toBe("over");
      expect(badge.label).toBe("₹10K OVER MEDIAN");
      expect(badge.deltaInr).toBe(10_000);
    });

    it("rounds up partial thousand (ceil) so delta label never understates", () => {
      const badge = computePriceBadge({ rentInr: 59_500, medianRent: median, sampleSize });
      expect(badge.variant).toBe("over");
      expect(badge.label).toBe("₹10K OVER MEDIAN");
    });

    it("labels 2x median as massively over", () => {
      const badge = computePriceBadge({ rentInr: 100_000, medianRent: median, sampleSize });
      expect(badge.variant).toBe("over");
      expect(badge.label).toBe("₹50K OVER MEDIAN");
    });
  });

  describe("under variant", () => {
    it("labels -20% as underpriced", () => {
      const badge = computePriceBadge({ rentInr: 40_000, medianRent: median, sampleSize });
      expect(badge.variant).toBe("under");
      expect(badge.label).toBe("UNDERPRICED");
      expect(badge.deltaInr).toBe(-10_000);
    });

    it("labels -40% as underpriced (no absolute-value label)", () => {
      const badge = computePriceBadge({ rentInr: 30_000, medianRent: median, sampleSize });
      expect(badge.variant).toBe("under");
    });
  });

  describe("custom threshold", () => {
    it("respects a tighter 5% threshold", () => {
      const badge = computePriceBadge({
        rentInr: 53_000,
        medianRent: median,
        sampleSize,
        thresholdPct: 5,
      });
      expect(badge.variant).toBe("over");
    });

    it("respects a looser 30% threshold", () => {
      const badge = computePriceBadge({
        rentInr: 60_000,
        medianRent: median,
        sampleSize,
        thresholdPct: 30,
      });
      expect(badge.variant).toBe("fair");
    });
  });
});
