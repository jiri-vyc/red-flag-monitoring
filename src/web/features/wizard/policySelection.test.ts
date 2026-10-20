import type { Policy, PolicyVersion } from "@/features/policies/types";
import type { Regulation } from "@/features/regulations/types";

import {
  canContinueToRules,
  findPoliciesToApprove,
  isEveryDraftRejected,
  keepApprovedPolicies,
} from "./policySelection";

const POLICIES = ["policy-a", "policy-b", "policy-c"].map((id) => ({ id, versions: [] }) as unknown as Policy);

function reject(policy: Policy): Policy {
  return { ...policy, versions: [{ versionNumber: 1, state: "rejected" } as PolicyVersion] };
}

const ids = (policies: Policy[]) => policies.map((policy) => policy.id);

describe("findPoliciesToApprove", () => {
  it("approves every draft by default", () => {
    expect(ids(findPoliciesToApprove(POLICIES, [], []))).toEqual(["policy-a", "policy-b", "policy-c"]);
  });

  it("leaves out skipped drafts and those approved in an earlier attempt", () => {
    expect(ids(findPoliciesToApprove(POLICIES, ["policy-a"], ["policy-c"]))).toEqual(["policy-b"]);
  });

  it("never approves a rejected draft", () => {
    const [policyA, policyB, policyC] = POLICIES;

    expect(ids(findPoliciesToApprove([policyA!, reject(policyB!), policyC!], [], []))).toEqual([
      "policy-a",
      "policy-c",
    ]);
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

  it("cannot continue when every draft is rejected, and can when one of them is approved", () => {
    const rejectedPolicies = POLICIES.map(reject);

    expect(canContinueToRules(rejectedPolicies, [], [])).toBe(false);
    expect(canContinueToRules(rejectedPolicies.slice(1), ["policy-a"], [])).toBe(true);
  });
});

describe("isEveryDraftRejected", () => {
  it("holds only when every draft is rejected and none is approved", () => {
    const [policyA, policyB, policyC] = POLICIES;

    expect(isEveryDraftRejected(POLICIES.map(reject), [])).toBe(true);
    expect(isEveryDraftRejected([reject(policyA!), reject(policyB!), policyC!], [])).toBe(false);
    expect(isEveryDraftRejected([policyA!, reject(policyB!)], ["policy-a"])).toBe(false);
    expect(isEveryDraftRejected([], [])).toBe(false);
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
