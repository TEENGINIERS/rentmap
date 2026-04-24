import { describe, expect, it } from "vitest";
import {
  contentHash,
  hashPhone,
  normalizePhone,
  parseAreaSqft,
  parseBhk,
  parseFurnishing,
  parseRentInr,
  slugify,
} from "../../../scrapers/src/normalize";

describe("parseRentInr", () => {
  it("plain number", () => {
    expect(parseRentInr("45000")).toBe(45000);
  });
  it("with ₹ and commas", () => {
    expect(parseRentInr("₹45,000")).toBe(45000);
  });
  it("k shorthand", () => {
    expect(parseRentInr("45k")).toBe(45000);
  });
  it("lakh shorthand", () => {
    expect(parseRentInr("1.2L")).toBe(120000);
    expect(parseRentInr("1 lakh")).toBe(100000);
  });
  it("rejects garbage", () => {
    expect(parseRentInr("abc")).toBeNull();
    expect(parseRentInr("")).toBeNull();
    expect(parseRentInr(null)).toBeNull();
  });
});

describe("parseAreaSqft", () => {
  it("plain", () => {
    expect(parseAreaSqft("1200")).toBe(1200);
  });
  it("with unit", () => {
    expect(parseAreaSqft("1200 sqft")).toBe(1200);
    expect(parseAreaSqft("1200 sq ft")).toBe(1200);
  });
  it("rejects out-of-range", () => {
    expect(parseAreaSqft("5")).toBeNull();
    expect(parseAreaSqft("99999")).toBeNull();
  });
});

describe("parseBhk", () => {
  it("variants", () => {
    expect(parseBhk("2 BHK")).toBe(2);
    expect(parseBhk("3BHK")).toBe(3);
    expect(parseBhk("2 bhk apartment")).toBe(2);
  });
  it("rejects", () => {
    expect(parseBhk("studio")).toBeNull();
    expect(parseBhk("0 BHK")).toBeNull();
    expect(parseBhk("9 BHK")).toBeNull();
  });
});

describe("normalizePhone", () => {
  it("10-digit Indian mobile", () => {
    expect(normalizePhone("9876543210")).toBe("+919876543210");
  });
  it("with country code", () => {
    expect(normalizePhone("+91 98765 43210")).toBe("+919876543210");
  });
  it("rejects too short", () => {
    expect(normalizePhone("123456")).toBeNull();
  });
  it("rejects landline prefix", () => {
    expect(normalizePhone("0123456789")).toBeNull();
  });
  it("rejects empty", () => {
    expect(normalizePhone(null)).toBeNull();
  });
});

describe("hashPhone", () => {
  it("deterministic", () => {
    const a = hashPhone("+919876543210");
    const b = hashPhone("+919876543210");
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
  });
  it("different phones hash differently", () => {
    expect(hashPhone("+919876543210")).not.toBe(hashPhone("+919876543211"));
  });
});

describe("contentHash", () => {
  it("stable across order-preserving reruns", () => {
    const a = contentHash([45000, 2, 1200, "+919876543210"]);
    const b = contentHash([45000, 2, 1200, "+919876543210"]);
    expect(a).toBe(b);
  });
  it("nulls and undefineds treated as empty", () => {
    const a = contentHash([45000, null, undefined, "abc"]);
    const b = contentHash([45000, "", "", "abc"]);
    expect(a).toBe(b);
  });
});

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("HSR Layout Sector 7")).toBe("hsr-layout-sector-7");
  });
  it("strips special chars", () => {
    expect(slugify("A&B (2BHK)")).toBe("a-b-2bhk");
  });
  it("caps length", () => {
    expect(slugify("a".repeat(200))).toHaveLength(80);
  });
});

describe("parseFurnishing", () => {
  it("maps common phrases", () => {
    expect(parseFurnishing("Fully Furnished")).toBe("fully");
    expect(parseFurnishing("Semi-furnished")).toBe("semi");
    expect(parseFurnishing("Unfurnished")).toBe("unfurnished");
  });
  it("null on unknown", () => {
    expect(parseFurnishing("whatever")).toBeNull();
    expect(parseFurnishing(null)).toBeNull();
  });
});
