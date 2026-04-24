/**
 * Owner-vs-broker badge — business plan §5.2 rank 2 (the signature uncopyable signal).
 *
 * v1: reads hand-labeled `source_label` column verbatim. `sourceConfidence` ignored.
 * v2: detector writes both fields. If confidence < 0.7, coerce to `unknown`. No UI change.
 *
 * This is a pure mapping; if the business rule changes, it changes in one place.
 */

export type SourceVariant = "owner" | "broker" | "unknown";

export interface SourceBadge {
  variant: SourceVariant;
  label: string;
  /** v2-only: shown as small tooltip. null in v1. */
  confidencePct: number | null;
}

export interface SourceLabelInput {
  sourceLabel: string;
  sourceConfidence: number | null;
}

const V2_CONFIDENCE_FLOOR = 0.7;

export function computeSourceBadge(input: SourceLabelInput): SourceBadge {
  const { sourceLabel, sourceConfidence } = input;

  // v2 guard (inert in v1 where sourceConfidence is always null).
  let effectiveLabel: SourceVariant;
  if (sourceLabel === "owner" || sourceLabel === "broker") {
    effectiveLabel =
      sourceConfidence != null && sourceConfidence < V2_CONFIDENCE_FLOOR
        ? "unknown"
        : sourceLabel;
  } else {
    effectiveLabel = "unknown";
  }

  const confidencePct =
    sourceConfidence != null ? Math.round(sourceConfidence * 100) : null;

  switch (effectiveLabel) {
    case "owner":
      return { variant: "owner", label: "OWNER-POSTED", confidencePct };
    case "broker":
      return { variant: "broker", label: "LIKELY BROKER", confidencePct };
    case "unknown":
      return { variant: "unknown", label: "SOURCE UNKNOWN", confidencePct };
  }
}
