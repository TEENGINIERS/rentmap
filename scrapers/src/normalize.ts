import { createHash } from "node:crypto";

/**
 * Shared, pure normalization helpers. Tested. No network.
 */

/** Parse "₹45,000", "45k", "45000", "₹1.2 L" → rupees (int). Returns null on garbage. */
export function parseRentInr(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[₹,\s]/g, "").toLowerCase();
  const lakhMatch = cleaned.match(/^(\d+(?:\.\d+)?)l(?:akh)?s?$/);
  if (lakhMatch) return Math.round(Number(lakhMatch[1]) * 100_000);
  const kMatch = cleaned.match(/^(\d+(?:\.\d+)?)k$/);
  if (kMatch) return Math.round(Number(kMatch[1]) * 1000);
  const plain = Number(cleaned);
  if (Number.isFinite(plain) && plain > 0) return Math.round(plain);
  return null;
}

/** Parse "1200 sq ft" / "1200 sqft" / "1200" → int sqft. */
export function parseAreaSqft(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const m = raw.toLowerCase().replace(/[,\s]/g, "").match(/(\d+)(?:sqft|sq\.?ft|sq)?/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 50 && n < 10_000 ? n : null;
}

/** Parse "2 BHK" / "2BHK" / "3 bhk" → 2. */
export function parseBhk(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const m = raw.toLowerCase().match(/(\d)\s*bhk/);
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 1 && n <= 5 ? n : null;
}

/**
 * Normalize a phone number to E.164-ish (+91…). Returns null if the input
 * doesn't contain 10 digits.
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D+/g, "");
  if (digits.length < 10) return null;
  const last10 = digits.slice(-10);
  if (!/^[6-9]\d{9}$/.test(last10)) return null; // Indian mobile prefixes
  return `+91${last10}`;
}

/** SHA256 hex of normalized phone. Used for cross-listing frequency detection. */
export function hashPhone(phone: string): string {
  return createHash("sha256").update(phone).digest("hex");
}

/** Content hash for dedup — stable across reruns. */
export function contentHash(parts: Array<string | number | null | undefined>): string {
  const canonical = parts.map((p) => (p == null ? "" : String(p).trim().toLowerCase())).join("|");
  return createHash("sha256").update(canonical).digest("hex");
}

/** Slugify any string for URLs. */
export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Furnishing text → enum. */
export function parseFurnishing(raw: string | null | undefined): "unfurnished" | "semi" | "fully" | null {
  if (!raw) return null;
  const s = raw.toLowerCase();
  if (s.includes("fully")) return "fully";
  if (s.includes("semi")) return "semi";
  if (s.includes("unfurn")) return "unfurnished";
  return null;
}
