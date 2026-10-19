import { resolveService } from "@/config/apiMode";
import { mockPoliciesService } from "@/mocks/services/policies.mock";

import type { PoliciesService } from "./contract";
import { livePoliciesService } from "./live";

export const policiesService = resolveService<PoliciesService>("policies", {
  mock: mockPoliciesService,
  live: livePoliciesService,
});
