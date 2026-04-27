import { housingConfig } from "./housing";
import { ninetyNineAcresConfig } from "./99acres";
import { magicBricksConfig } from "./magicbricks";
import type { SourceConfig } from "../run";
import type { SourcePlatform } from "../types";

/**
 * HTTP-based sources only. Two sources have their own runners:
 *   - facebook (Playwright + saved session) → sources/facebook.ts
 *   - nobroker (Playwright + XHR sniff)     → sources/nobroker.ts
 * They're SPAs / login-walled, so the shared HTTP runner doesn't apply.
 */
export type HttpSourcePlatform = Exclude<SourcePlatform, "facebook" | "nobroker">;

export const SOURCES: Record<HttpSourcePlatform, SourceConfig> = {
  housing: housingConfig,
  "99acres": ninetyNineAcresConfig,
  magicbricks: magicBricksConfig,
};

export const ALL_PLATFORMS: HttpSourcePlatform[] = [
  "housing",
  "99acres",
  "magicbricks",
];
