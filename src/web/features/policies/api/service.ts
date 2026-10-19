import { resolveService, type ServiceImplementations } from "@/config/apiMode";
import { mockPoliciesService } from "@/mocks/services/policies.mock";

import type { PoliciesService } from "./contract";
import { livePoliciesService } from "./live";

export const policiesImplementations: ServiceImplementations<PoliciesService> = {
  mock: mockPoliciesService,
  live: livePoliciesService,
};

export const policiesService = resolveService("policies", policiesImplementations);
