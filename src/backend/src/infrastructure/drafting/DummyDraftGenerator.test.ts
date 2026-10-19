import { DraftingJobExecutor } from "../../application/drafting/draftingJobExecutor";
import {
  newRulesFromPolicyJob,
  type RegulationSourceFetcher,
} from "../../application/drafting/draftingJobPorts";
import { InMemoryDraftingJobRepository } from "../../application/testing/InMemoryDraftingJobRepository";
import { InMemoryInternalPolicyRepository } from "../../application/testing/InMemoryInternalPolicyRepository";
import { InMemoryRegulationRepository } from "../../application/testing/InMemoryRegulationRepository";
import { InMemoryRuleRepository } from "../../application/testing/InMemoryRuleRepository";
import { ADMIN_ID, fixedClock, REVIEWED_AT } from "../../application/testing/fixtures";
import type { PolicyLegalBasis } from "../../domain/regulation";
import { DummyDraftGenerator } from "./DummyDraftGenerator";

async function runRulesJob(legalBases: PolicyLegalBasis[]) {
  const internalPolicyRepository = new InMemoryInternalPolicyRepository();
  const ruleRepository = new InMemoryRuleRepository();
  const draftingJobRepository = new InMemoryDraftingJobRepository(
    internalPolicyRepository,
    ruleRepository,
    REVIEWED_AT,
  );
  const executor = new DraftingJobExecutor({
    draftingJobRepository,
    draftGenerator: new DummyDraftGenerator(),
    regulationRepository: new InMemoryRegulationRepository(),
    internalPolicyRepository,
    regulationSourceFetcher: {} as RegulationSourceFetcher,
    clock: fixedClock,
  });
  const policy = await internalPolicyRepository.createPolicy({
    code: "SVZ-TM",
    title: "Monitoring transakcí",
  });
  const policyVersion = await internalPolicyRepository.createVersion({
    policyId: policy.id,
    body: "# Monitoring",
    status: "approved",
    createdVia: "manual",
    createdBy: ADMIN_ID,
    legalBases,
  });
  const job = await draftingJobRepository.createJob(
    newRulesFromPolicyJob({ policyVersionId: policyVersion.id, parentJobId: null, createdBy: ADMIN_ID }),
  );

  await executor.executeJob(job.id);

  return { finishedJob: await draftingJobRepository.findJob(job.id), ruleRepository };
}

describe("DummyDraftGenerator in a rules_from_policy job", () => {
  it("drafts rule versions that pass rule validation and keep the policy's legal bases", async () => {
    const { finishedJob, ruleRepository } = await runRulesJob([
      { regulationVersionId: "regulation-version-1", ref: "§ 21" },
    ]);

    expect(finishedJob).toEqual(expect.objectContaining({ status: "succeeded", warnings: [] }));
    expect(finishedJob?.ruleVersions).toHaveLength(2);
    expect([...ruleRepository.versions.values()]).toEqual(
      [...ruleRepository.versions.values()].map(() =>
        expect.objectContaining({
          legalBases: [{ regulationVersionId: "regulation-version-1", ref: "§ 21" }],
        }),
      ),
    );
  });

  it("drafts no rules from a policy without a legal basis", async () => {
    const { finishedJob } = await runRulesJob([]);

    expect(finishedJob).toEqual(expect.objectContaining({ status: "succeeded", ruleVersions: [] }));
  });
});
