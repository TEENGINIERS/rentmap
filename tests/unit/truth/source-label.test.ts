import { describe, expect, it } from "vitest";
import { computeSourceBadge } from "@/lib/truth/source-label";

describe("computeSourceBadge", () => {
  describe("v1 behavior (sourceConfidence null)", () => {
    it("owner → OWNER-POSTED", () => {
      const badge = computeSourceBadge({ sourceLabel: "owner", sourceConfidence: null });
      expect(badge.variant).toBe("owner");
      expect(badge.label).toBe("OWNER-POSTED");
      expect(badge.confidencePct).toBeNull();
    });

    it("broker → LIKELY BROKER", () => {
      const badge = computeSourceBadge({ sourceLabel: "broker", sourceConfidence: null });
      expect(badge.variant).toBe("broker");
      expect(badge.label).toBe("LIKELY BROKER");
    });

    it("unknown → SOURCE UNKNOWN", () => {
      const badge = computeSourceBadge({ sourceLabel: "unknown", sourceConfidence: null });
      expect(badge.variant).toBe("unknown");
      expect(badge.label).toBe("SOURCE UNKNOWN");
    });

    it("garbage label → unknown (defensive)", () => {
      const badge = computeSourceBadge({ sourceLabel: "foobar", sourceConfidence: null });
      expect(badge.variant).toBe("unknown");
    });
  });

  describe("v2 behavior (sourceConfidence set)", () => {
    it("high-confidence owner passes through", () => {
      const badge = computeSourceBadge({ sourceLabel: "owner", sourceConfidence: 0.95 });
      expect(badge.variant).toBe("owner");
      expect(badge.confidencePct).toBe(95);
    });

    it("low-confidence owner coerces to unknown", () => {
      const badge = computeSourceBadge({ sourceLabel: "owner", sourceConfidence: 0.5 });
      expect(badge.variant).toBe("unknown");
    });

    it("exactly 0.7 passes through (boundary)", () => {
      const badge = computeSourceBadge({ sourceLabel: "broker", sourceConfidence: 0.7 });
      expect(badge.variant).toBe("broker");
    });

    it("just below 0.7 coerces", () => {
      const badge = computeSourceBadge({ sourceLabel: "broker", sourceConfidence: 0.69 });
      expect(badge.variant).toBe("unknown");
    });
  });
});
