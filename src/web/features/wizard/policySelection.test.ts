import type { Policy } from "@/features/policies/types";
import type { Regulation } from "@/features/regulations/types";

import { canContinueToRules, findPoliciesToApprove, keepApprovedPolicies } from "./policySelection";

const POLICIES = ["policy-a", "policy-b", "policy-c"].map((id) => ({ id }) as Policy);

const ids = (policies: Policy[]) => policies.map((policy) => policy.id);

describe("findPoliciesToApprove", () => {
  it("approves every draft by default", () => {
    expect(ids(findPoliciesToApprove(POLICIES, [], []))).toEqual(["policy-a", "policy-b", "policy-c"]);
  });

  it("leaves out skipped drafts and those approved in an earlier attempt", () => {
    expect(ids(findPoliciesToApprove(POLICIES, ["policy-a"], ["policy-c"]))).toEqual(["policy-b"]);
  });
});

describe("canContinueToRules", () => {
  it("needs at least one selected draft while nothing is approved", () => {
    expect(canContinueToRules(POLICIES, [], ["policy-a", "policy-b", "policy-c"])).toBe(false);
    expect(canContinueToRules(POLICIES, [], ["policy-a", "policy-b"])).toBe(true);
  });

  it("continues with the already approved policies when every remaining draft is skipped", () => {
    expect(canContinueToRules(POLICIES, ["policy-a"], ["policy-b", "policy-c"])).toBe(true);
  });
});

describe("keepApprovedPolicies", () => {
  it("keeps only the approved policies of the draft", () => {
    const draft = { regulation: { id: "regulation-1" } as Regulation, policies: POLICIES };

    const approvedDraft = keepApprovedPolicies(draft, ["policy-c", "policy-a"]);

    expect(ids(approvedDraft.policies)).toEqual(["policy-a", "policy-c"]);
    expect(approvedDraft.regulation).toBe(draft.regulation);
  });
});
