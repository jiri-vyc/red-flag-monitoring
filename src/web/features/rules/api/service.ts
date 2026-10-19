import { resolveService, type ServiceImplementations } from "@/config/apiMode";
import { mockRulesService } from "@/mocks/services/rules.mock";

import type { RulesService } from "./contract";
import { liveRulesService } from "./live";

export const rulesImplementations: ServiceImplementations<RulesService> = {
  mock: mockRulesService,
  live: liveRulesService,
};

export const rulesService = resolveService("rules", rulesImplementations);
