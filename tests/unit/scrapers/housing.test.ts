import { describe, expect, it } from "vitest";
import { housingConfig } from "../../../scrapers/src/sources/housing";

/**
 * Against a synthetic __NEXT_DATA__ payload shaped like the known contract.
 * If Housing.com changes their internal schema, this test stays green
 * (we're testing our parser, not their response) — the real canary is
 * the CI scrape run landing zero parsed listings.
 */
function buildHtml(data: unknown): string {
  return `
    <!doctype html>
    <html><head><title>Housing</title></head>
    <body>
      <script id="__NEXT_DATA__" type="application/json">${JSON.stringify(data)}</script>
    </body></html>
  `;
}

describe("housing parser — embedded listings", () => {
  it("parses a well-formed 2BHK property", () => {
    const html = buildHtml({
      props: {
        pageProps: {
          searchData: {
            properties: [
              {
                id: "A12345",
                slug: "prestige-shantiniketan-whitefield",
                configName: "2 BHK Apartment",
                title: "Prestige Shantiniketan 2BHK",
                description: "Owner-direct, no brokerage.",
                rent: 52000,
                deposit: 200000,
                sizeSqft: 1240,
                floor: 8,
                totalFloors: 22,
                furnishing: "Semi-Furnished",
                latitude: 12.9828,
                longitude: 77.7347,
                localityName: "Whitefield",
                address: "Prestige Shantiniketan, Whitefield",
                photos: [{ url: "https://img.housing.com/x.jpg", caption: "Living room" }],
                ownerName: "Ramesh K",
                ownerMobile: "9876543210",
              },
            ],
          },
        },
      },
    });

    const parsed = housingConfig.parseIndexEmbeddedListings!(html, "https://housing.com/x");
    expect(parsed).toHaveLength(1);
    const p = parsed[0]!;
    expect(p.sourcePlatform).toBe("housing");
    expect(p.sourceListingId).toBe("A12345");
    expect(p.rentInr).toBe(52000);
    expect(p.bhk).toBe(2);
    expect(p.areaSqft).toBe(1240);
    expect(p.localityHint).toBe("Whitefield");
    expect(p.lat).toBe(12.9828);
    expect(p.lng).toBe(77.7347);
    expect(p.furnishing).toBe("semi");
    expect(p.photos).toHaveLength(1);
    expect(p.contactPhoneRaw).toBe("9876543210");
    expect(p.contactName).toBe("Ramesh K");
  });

  it("skips non-2BHK listings", () => {
    const html = buildHtml({
      props: {
        pageProps: {
          searchData: {
            properties: [{ id: "1", configName: "3 BHK", rent: 60000, localityName: "X" }],
          },
        },
      },
    });
    expect(housingConfig.parseIndexEmbeddedListings!(html, "x")).toHaveLength(0);
  });

  it("skips listings missing rent", () => {
    const html = buildHtml({
      props: {
        pageProps: {
          searchData: {
            properties: [{ id: "1", configName: "2 BHK", localityName: "X" }],
          },
        },
      },
    });
    expect(housingConfig.parseIndexEmbeddedListings!(html, "x")).toHaveLength(0);
  });

  it("returns empty on missing __NEXT_DATA__ (schema drift canary)", () => {
    expect(housingConfig.parseIndexEmbeddedListings!("<html></html>", "x")).toHaveLength(0);
  });

  it("returns empty on schema path drift", () => {
    const html = buildHtml({ props: { pageProps: { WRONG_KEY: {} } } });
    expect(housingConfig.parseIndexEmbeddedListings!(html, "x")).toHaveLength(0);
  });
});
