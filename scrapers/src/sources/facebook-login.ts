/**
 * One-time helper: log in to Facebook in a real browser, then save the
 * session cookies to disk so the headless scraper can reuse them.
 *
 * Run with: pnpm scrape:facebook:login
 *
 * The browser stays open until you've successfully logged in. We watch for
 * navigation away from /login and then save storage state.
 *
 * Security: the saved file (.fb-session.json by default) contains your
 * session cookies. Treat it like a password. .gitignore includes it.
 */
import { chromium } from "playwright";

const STORAGE_STATE_PATH = process.env.FB_STORAGE_STATE_PATH ?? ".fb-session.json";

async function main() {
  console.log("");
  console.log("Rentmap — Facebook session capture");
  console.log("------------------------------------");
  console.log(`Storage state will be saved to: ${STORAGE_STATE_PATH}`);
  console.log("");
  console.log("A Chromium window will open. Log in to Facebook normally.");
  console.log("Once you reach your home feed (or any non-login page),");
  console.log("the session will be captured automatically.");
  console.log("");

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto("https://www.facebook.com/login");

  try {
    await page.waitForURL(
      (url) => {
        const u = url.toString();
        return !u.includes("/login") && !u.includes("/recover") && !u.includes("/checkpoint");
      },
      { timeout: 0 },
    );
  } catch {
    console.error("Timed out waiting for login. Aborting.");
    await browser.close();
    process.exit(1);
  }

  console.log(`Detected post-login URL: ${page.url()}`);
  await context.storageState({ path: STORAGE_STATE_PATH });
  console.log(`Session saved to ${STORAGE_STATE_PATH}.`);
  console.log("You can now run: pnpm scrape:facebook");

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
