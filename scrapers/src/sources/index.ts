import { housingConfig } from "./housing";
import { ninetyNineAcresConfig } from "./99acres";
import { magicBricksConfig } from "./magicbricks";
import { noBrokerConfig } from "./nobroker";
import type { SourceConfig } from "../run";
import type { SourcePlatform } from "../types";

export const SOURCES: Record<SourcePlatform, SourceConfig> = {
  housing: housingConfig,
  "99acres": ninetyNineAcresConfig,
  magicbricks: magicBricksConfig,
  nobroker: noBrokerConfig,
};

export const ALL_PLATFORMS: SourcePlatform[] = [
  "housing",
  "99acres",
  "magicbricks",
  "nobroker",
];
