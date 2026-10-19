import { DEMO_ADMIN_USER_ID } from "../../domain/user";
import { type CliDrafting, openDrafting } from "./openDrafting";

// Demo of wizard step #1 as a drafting job: a regulation version from the database → internal policy draft stored
// as a new policy with a draft version. One model call: the scoped regulation and the example policy go in
// (~15–20k input tokens), a full policy draft comes out (~10–12k output tokens).
// Usage: npm run demo:policy-drafting -- [regulation code] [scope heading, or "-" for the whole text]
const DEFAULT_REGULATION_CODE = "EBA-GL-2021-02";
const DEFAULT_SCOPE = "Obecný pokyn č. 9";
const WHOLE_REGULATION_SCOPE = "-";

async function runDemo(cli: CliDrafting): Promise<void> {
  const regulationCode = process.argv[2] ?? DEFAULT_REGULATION_CODE;
  const scopeArgument = process.argv[3] ?? DEFAULT_SCOPE;
  const scope = scopeArgument === WHOLE_REGULATION_SCOPE ? null : scopeArgument;
  const { regulationId, regulationVersionId } = await findLatestRegulationVersion(cli, regulationCode);

  console.log(`Drafting an internal policy from ${regulationCode}, scope: ${scope ?? "whole text"}`);

  const job = await cli.runJob({
    kind: "policy_from_regulation",
    parentJobId: null,
    sourceKind: "text",
    sourceUrl: null,
    scope,
    versionLabel: null,
    regulationId,
    regulationVersionId,
    policyVersionId: null,
    createdBy: DEMO_ADMIN_USER_ID,
  });

  for (const version of job.policyVersions) {
    const policy = await cli.internalPolicyRepository.findPolicy(version.policyId);

    console.log(`Stored ${policy?.code} "${policy?.title}", version ${version.id} (${version.status})`);
    console.log(`  next step: npm run demo:rule-drafting -- ${policy?.code}`);
  }
}

async function findLatestRegulationVersion(
  cli: CliDrafting,
  regulationCode: string,
): Promise<{ regulationId: string; regulationVersionId: string }> {
  const regulation = (await cli.regulationRepository.listRegulations()).find(
    ({ code }) => code === regulationCode,
  );

  if (!regulation) {
    throw new Error(`Regulation ${regulationCode} is not in the database`);
  }

  const versions = await cli.regulationRepository.listVersions(regulation.id);
  const latestVersion = versions.toSorted(
    (first, second) => second.createdAt.getTime() - first.createdAt.getTime(),
  )[0];

  if (!latestVersion) {
    throw new Error(`Regulation ${regulationCode} has no version`);
  }

  return { regulationId: regulation.id, regulationVersionId: latestVersion.id };
}

openDrafting()
  .then((cli) => runDemo(cli).finally(cli.close))
  .catch((error: unknown) => {
    console.error("\nPolicy drafting failed:");
    console.error(error);
    process.exit(1);
  });
