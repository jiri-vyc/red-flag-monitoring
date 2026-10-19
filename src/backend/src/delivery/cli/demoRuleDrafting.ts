import { newRulesFromPolicyJob } from "../../application/drafting/draftingJobPorts";
import { DEMO_ADMIN_USER_ID } from "../../domain/user";
import { type CliDrafting, openDrafting } from "./openDrafting";

// Demo of wizard step #2 as a drafting job: the latest version of an internal policy from the database → rule
// drafts stored as new rules with draft versions. In the API this job starts when a policy version is approved; the
// demo skips the review. The whole policy goes in (~10–15k input tokens), ~1k output tokens per rule come out.
// Usage: npm run demo:rule-drafting -- <policy code>, e.g. SVZ-07 from demo:policy-drafting
async function runDemo(cli: CliDrafting): Promise<void> {
  const policyCode = process.argv[2];

  if (!policyCode) {
    throw new Error("Usage: npm run demo:rule-drafting -- <policy code>");
  }

  const policy = (await cli.internalPolicyRepository.listPolicies()).find(({ code }) => code === policyCode);
  const versions = policy ? await cli.internalPolicyRepository.listVersions(policy.id) : [];
  const latestVersion = versions.toSorted((first, second) => second.versionNo - first.versionNo)[0];

  if (!latestVersion) {
    throw new Error(`Policy ${policyCode} has no version in the database`);
  }

  console.log(
    `Drafting rules from ${policyCode} version ${latestVersion.versionNo} (${latestVersion.status})`,
  );

  const job = await cli.runJob(
    newRulesFromPolicyJob({
      policyVersionId: latestVersion.id,
      parentJobId: null,
      createdBy: DEMO_ADMIN_USER_ID,
    }),
  );

  for (const version of job.ruleVersions) {
    const rule = await cli.ruleRepository.findRule(version.ruleId);
    const ruleVersion = await cli.ruleRepository.findVersion(version.id);

    console.log(`- ${rule?.code} (${rule?.kind}), version ${version.id} (${version.status})`);
    console.log(`  ${ruleVersion?.humanText}`);
  }
}

openDrafting()
  .then((cli) => runDemo(cli).finally(cli.close))
  .catch((error: unknown) => {
    console.error("\nRule drafting failed:");
    console.error(error);
    process.exit(1);
  });
