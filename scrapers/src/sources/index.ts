import { housingConfig } from "./housing";
import { ninetyNineAcresConfig } from "./99acres";
import { magicBricksConfig } from "./magicbricks";
import { noBrokerConfig } from "./nobroker";
import type { SourceConfig } from "../run";
import type { SourcePlatform } from "../types";

/**
 * HTTP-based sources only. Facebook has its own runner (see sources/facebook.ts)
 * because it requires Playwright + a logged-in session, not raw HTTP.
 */
export type HttpSourcePlatform = Exclude<SourcePlatform, "facebook">;

export const SOURCES: Record<HttpSourcePlatform, SourceConfig> = {
  housing: housingConfig,
  "99acres": ninetyNineAcresConfig,
  magicbricks: magicBricksConfig,
  nobroker: noBrokerConfig,
};

export const ALL_PLATFORMS: HttpSourcePlatform[] = [
  "housing",
  "99acres",
  "magicbricks",
  "nobroker",
];
