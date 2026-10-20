import { createDraftingJobDto } from "./api/draftingJobDtoFixture";
import { toDraftingJob, type DraftingJobDto } from "./api/dto";
import { findWizardRunJobId } from "./types";

const createJob = (overrides: Partial<DraftingJobDto>) => toDraftingJob(createDraftingJobDto(overrides));
const DRAFTED_POLICY = [{ id: "pv-a", policyId: "policy-a", status: "draft" as const }];

describe("findWizardRunJobId", () => {
  it("resumes a policy job while it runs or still has a policy draft", () => {
    expect(findWizardRunJobId(createJob({ id: "job-policy", status: "running" }))).toBe("job-policy");
    expect(
      findWizardRunJobId(
        createJob({ id: "job-policy", status: "succeeded", policyVersions: DRAFTED_POLICY }),
      ),
    ).toBe("job-policy");
  });

  it("offers no resume for a finished policy job whose drafts were all deleted", () => {
    const policyJob = createJob({ id: "job-policy", status: "succeeded", policyVersions: DRAFTED_POLICY });

    expect(findWizardRunJobId({ ...policyJob, policyIds: [] })).toBeNull();
  });

  it("resumes a rules job through the wizard run that started it", () => {
    expect(findWizardRunJobId(createJob({ kind: "rules_from_policy", parentJobId: "job-policy" }))).toBe(
      "job-policy",
    );
    expect(findWizardRunJobId(createJob({ kind: "rules_from_policy", parentJobId: null }))).toBeNull();
  });
});
