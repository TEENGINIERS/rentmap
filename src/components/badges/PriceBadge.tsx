import { Badge } from "@/components/ui/badge";
import type { PriceBadge as PriceBadgeType } from "@/lib/truth/price-anomaly";

export function PriceBadge({ badge }: { badge: PriceBadgeType }) {
  return (
    <Badge variant={badge.variant} title={explain(badge)}>
      {badge.label}
    </Badge>
  );
}

function explain(b: PriceBadgeType): string {
  switch (b.variant) {
    case "fair":
      return `Within ±15% of the locality median across ${b.sampleSize} listings.`;
    case "over":
      return `₹${b.deltaInr.toLocaleString("en-IN")} above locality median (n=${b.sampleSize}).`;
    case "under":
      return `${Math.abs(Math.round(b.deltaPct))}% below median — verify why.`;
    case "unknown":
      return "Not enough listings in this locality to compute a reliable median yet.";
  }
}
