import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  extractRuleCandidatesFromPolicy,
  type PolicyDocument,
  type ReviewedRuleCandidate,
} from "../../application/extractRuleCandidates";
import { parseBedrockConfig } from "../../config";
import { BedrockRuleCandidateExtractor } from "../../infrastructure/bedrock/BedrockRuleCandidateExtractor";
import { createBedrockClient } from "../../infrastructure/bedrock/createBedrockClient";

// Demo of the "internal policy → rules" wizard step. The whole policy is sent as context (~8–10k input tokens);
// naming one rule keeps the output, which dominates the cost, short.
// Usage: npm run demo:rule-extraction -- [policy file] [rule ID], e.g. svz-06-monitoring-plateb-a-remitenci.md R-14
const POLICIES_DIRECTORY = path.resolve(__dirname, "../../../../../knowledgebase/vnitrni-predpisy");
const DEFAULT_POLICY_FILE = "svz-06-monitoring-plateb-a-remitenci.md";
const DEFAULT_RULE_ID = "R-14";

async function runDemo(): Promise<void> {
  const policyFile = process.argv[2] ?? DEFAULT_POLICY_FILE;
  const ruleId = process.argv[3] ?? DEFAULT_RULE_ID;
  const bedrockConfig = parseBedrockConfig(process.env);
  const apiKeySource = bedrockConfig.apiKey
    ? "AWS_BEARER_TOKEN_BEDROCK"
    : "short-term key from AWS credentials";
  const policy = await loadPolicyDocument(path.join(POLICIES_DIRECTORY, policyFile));

  console.log(`Model: ${bedrockConfig.modelId} (${bedrockConfig.region}), API key: ${apiKeySource}`);
  console.log(`Extracting rule ${ruleId} from "${policy.title}"…\n`);

  const client = await createBedrockClient(bedrockConfig);
  const reviewedCandidates = await extractRuleCandidatesFromPolicy({
    policy,
    ruleId,
    extractor: new BedrockRuleCandidateExtractor(client, bedrockConfig.modelId),
  });

  printReviewedCandidates(reviewedCandidates);
}

async function loadPolicyDocument(filePath: string): Promise<PolicyDocument> {
  const body = await readFile(filePath, "utf8");
  const title = body.split("\n")[0]?.replace(/^#\s*/, "").trim() || path.basename(filePath);

  return { title, body };
}

function printReviewedCandidates(reviewedCandidates: ReviewedRuleCandidate[]): void {
  console.log(`Rule candidates: ${reviewedCandidates.length}`);
  console.log(JSON.stringify(reviewedCandidates, null, 2));

  const unknownRuleIds = reviewedCandidates
    .filter((reviewed) => !reviewed.isRuleDefinedInPolicy)
    .map((reviewed) => reviewed.candidate.ruleId);

  if (unknownRuleIds.length > 0) {
    console.warn(`\n⚠ Rule IDs not defined in the policy: ${unknownRuleIds.join(", ")}`);
  }
}

runDemo().catch((error: unknown) => {
  console.error("\nRule extraction failed:");
  console.error(error);
  process.exit(1);
});
