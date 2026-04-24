import { describe, expect, it } from "vitest";
import { bboxToString, parseBbox } from "@/lib/map/bbox";

describe("bbox", () => {
  it("round-trips a valid bbox", () => {
    const bbox = bboxToString([77.55, 12.9, 77.75, 13.05]);
    expect(parseBbox(bbox)).toEqual([77.55, 12.9, 77.75, 13.05]);
  });

  it("rejects null", () => {
    expect(parseBbox(null)).toBeNull();
  });

  it("rejects wrong arity", () => {
    expect(parseBbox("1,2,3")).toBeNull();
  });

  it("rejects non-numeric", () => {
    expect(parseBbox("a,b,c,d")).toBeNull();
  });

  it("rejects inverted W/E", () => {
    expect(parseBbox("77.8,12.9,77.5,13.0")).toBeNull();
  });

  it("rejects out-of-range lat", () => {
    expect(parseBbox("77.5,95,77.8,96")).toBeNull();
  });
});
