import { Badge } from "@/components/ui/badge";
import type { SourceBadge as SourceBadgeType } from "@/lib/truth/source-label";

export function SourceBadge({ badge }: { badge: SourceBadgeType }) {
  return (
    <Badge variant={badge.variant} title={explain(badge)}>
      {badge.label}
      {badge.confidencePct != null ? ` · ${badge.confidencePct}%` : null}
    </Badge>
  );
}

function explain(b: SourceBadgeType): string {
  switch (b.variant) {
    case "owner":
      return "Posted by the property owner (no brokerage).";
    case "broker":
      return "Likely posted by a broker — expect brokerage of up to one month's rent.";
    case "unknown":
      return "Couldn't verify the source. Ask on first call.";
  }
}
