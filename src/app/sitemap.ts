import type { MetadataRoute } from "next";
import { listAllSlugsForSitemap } from "@/lib/db/queries/listings";
import { listAllLocalitySlugs } from "@/lib/db/queries/localities";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

// Regenerated at request time — sitemap reads live DB state.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base: MetadataRoute.Sitemap = [
    { url: `${siteUrl}/`, changeFrequency: "daily", priority: 1 },
  ];

  try {
    const [listingRows, localities] = await Promise.all([
      listAllSlugsForSitemap(),
      listAllLocalitySlugs(),
    ]);
    return [
      ...base,
      ...localities.map((slug) => ({
        url: `${siteUrl}/area/${slug}`,
        changeFrequency: "weekly" as const,
        priority: 0.8,
      })),
      ...listingRows.map((row) => ({
        url: `${siteUrl}/listing/${row.slug}`,
        lastModified: row.updatedAt,
        changeFrequency: "daily" as const,
        priority: 0.6,
      })),
    ];
  } catch {
    // DB unreachable — return a minimal sitemap rather than erroring the whole response.
    return base;
  }
}
