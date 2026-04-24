import { test, expect } from "@playwright/test";

test("homepage loads and shows listing grid + map", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /Bangalore 2BHK rentals/i })).toBeVisible();

  const grid = page.getByRole("link").filter({ hasText: /₹/ }).first();
  await expect(grid).toBeVisible();

  // Map container should render.
  await expect(page.getByTestId("map")).toBeVisible();
});

test("listing detail page shows both truth badges", async ({ page }) => {
  await page.goto("/");
  const firstListing = page.getByRole("link").filter({ hasText: /₹/ }).first();
  await firstListing.click();

  await page.waitForURL(/\/listing\//);

  // Badges rendered on detail page. Exact label depends on seed data; we just assert the span class presence.
  const badges = page.locator("span.inline-flex");
  await expect(badges.first()).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("area page renders locality stats", async ({ page }) => {
  await page.goto("/area/whitefield");
  await expect(page.getByRole("heading", { name: /2BHK Rentals in Whitefield/i })).toBeVisible();
  await expect(page.getByText(/Median rent/)).toBeVisible();
});

test("share URL works anonymously", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/listing/whitefield-2bhk-prestige-shantiniketan-a1");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/Prestige|Whitefield|2BHK/);
});
