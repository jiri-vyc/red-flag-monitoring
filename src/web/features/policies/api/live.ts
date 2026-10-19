import { z } from "zod";

import { requestJson } from "@/lib/httpClient";

import { policySchema } from "../types";
import type { PoliciesService } from "./contract";

const policyPath = (policyId: string) => `/policies/${encodeURIComponent(policyId)}`;

export const livePoliciesService: PoliciesService = {
  loadPolicies: () => requestJson({ path: "/policies", schema: z.array(policySchema) }),
  loadPolicy: (policyId) => requestJson({ path: policyPath(policyId), schema: policySchema }),
  updatePolicyText: ({ policyId, text }) =>
    requestJson({ path: policyPath(policyId), method: "PATCH", jsonBody: { text }, schema: policySchema }),
  approvePolicy: ({ policyId, approvedBy }) =>
    requestJson({
      path: `${policyPath(policyId)}/approve`,
      method: "POST",
      jsonBody: { approvedBy },
      schema: policySchema,
    }),
};
