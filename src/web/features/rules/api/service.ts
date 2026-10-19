import { resolveService } from "@/config/apiMode";
import { mockRulesService } from "@/mocks/services/rules.mock";

import type { RulesService } from "./contract";
import { liveRulesService } from "./live";

export const rulesService = resolveService<RulesService>("rules", {
  mock: mockRulesService,
  live: liveRulesService,
});
