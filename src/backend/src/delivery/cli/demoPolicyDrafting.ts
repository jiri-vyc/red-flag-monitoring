import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  draftInternalPolicyFromRegulation,
  type RegulationDocument,
  type ReviewedPolicyDraft,
} from "../../application/draftInternalPolicy";
import type { PolicyDocument } from "../../application/extractRuleCandidates";
import { parseBedrockConfig } from "../../config";
import { BedrockInternalPolicyDrafter } from "../../infrastructure/bedrock/BedrockInternalPolicyDrafter";
import { createBedrockClient } from "../../infrastructure/bedrock/createBedrockClient";

// Demo of the "regulation → internal policy" wizard step. One call: the scoped regulation and the example policy
// go in (~15–20k input tokens), a full policy draft comes out (~10–12k output tokens).
// Usage: npm run demo:policy-drafting -- [regulation file] [scope heading or "-" for the whole text] [first rule number]
// e.g. npm run demo:policy-drafting -- eba-gl-2021-02-rizikove-faktory.md "Obecný pokyn č. 9" 18
// The draft is saved to knowledgebase/vnitrni-predpisy/navrhy/, ready for:
// npm run demo:rule-extraction -- navrhy/<draft file> <rule ID>
const KNOWLEDGE_BASE_DIRECTORY = path.resolve(__dirname, "../../../../../knowledgebase");
const REGULATIONS_DIRECTORY = path.join(KNOWLEDGE_BASE_DIRECTORY, "regulace/plne-zneni");
const POLICIES_DIRECTORY = path.join(KNOWLEDGE_BASE_DIRECTORY, "vnitrni-predpisy");
const DRAFTS_DIRECTORY = path.join(POLICIES_DIRECTORY, "navrhy");
const EXAMPLE_POLICY_FILE = "svz-06-monitoring-plateb-a-remitenci.md";
const DEFAULT_REGULATION_FILE = "eba-gl-2021-02-rizikove-faktory.md";
const DEFAULT_SCOPE = "Obecný pokyn č. 9";
const WHOLE_REGULATION_SCOPE = "-";
// SVZ-03 and SVZ-06 already use R-01 to R-17.
const DEFAULT_FIRST_RULE_NUMBER = 18;

async function runDemo(): Promise<void> {
  const regulationFile = process.argv[2] ?? DEFAULT_REGULATION_FILE;
  const scopeArgument = process.argv[3] ?? DEFAULT_SCOPE;
  const scope = scopeArgument === WHOLE_REGULATION_SCOPE ? null : scopeArgument;
  const firstRuleNumber = Number(process.argv[4] ?? DEFAULT_FIRST_RULE_NUMBER);
  const bedrockConfig = parseBedrockConfig(process.env);
  const apiKeySource = bedrockConfig.apiKey
    ? "AWS_BEARER_TOKEN_BEDROCK"
    : "short-term key from AWS credentials";
  const regulation = await loadRegulationDocument(regulationFile);
  const examplePolicy = await loadPolicyDocument(path.join(POLICIES_DIRECTORY, EXAMPLE_POLICY_FILE));

  console.log(`Model: ${bedrockConfig.modelId} (${bedrockConfig.region}), API key: ${apiKeySource}`);
  console.log(`Drafting an internal policy from "${regulation.title}", scope: ${scope ?? "whole text"}…\n`);

  const client = await createBedrockClient(bedrockConfig);
  const draft = await draftInternalPolicyFromRegulation({
    regulation,
    scope,
    examplePolicy,
    firstRuleNumber,
    drafter: new BedrockInternalPolicyDrafter(client, bedrockConfig.modelId),
  });
  const draftPath = await saveDraft(draft, regulationFile, scope);

  printReview(draft, draftPath);
}

async function loadRegulationDocument(regulationFile: string): Promise<RegulationDocument> {
  const body = await readFile(path.join(REGULATIONS_DIRECTORY, regulationFile), "utf8");

  return {
    title: readTitle(body, regulationFile),
    // Relative to the drafts directory, so the link in the draft header resolves.
    sourceReference: `../../regulace/plne-zneni/${regulationFile}`,
    body,
  };
}

async function loadPolicyDocument(filePath: string): Promise<PolicyDocument> {
  const body = await readFile(filePath, "utf8");

  return { title: readTitle(body, path.basename(filePath)), body };
}

function readTitle(markdown: string, fallback: string): string {
  return markdown.split("\n")[0]?.replace(/^#\s*/, "").trim() || fallback;
}

async function saveDraft(
  draft: ReviewedPolicyDraft,
  regulationFile: string,
  scope: string | null,
): Promise<string> {
  const scopeSuffix = scope === null ? "" : `-${slugify(scope)}`;
  const draftPath = path.join(DRAFTS_DIRECTORY, `navrh-${path.parse(regulationFile).name}${scopeSuffix}.md`);

  await mkdir(DRAFTS_DIRECTORY, { recursive: true });
  await writeFile(draftPath, `${draft.body}\n`, "utf8");

  return draftPath;
}

function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function printReview(draft: ReviewedPolicyDraft, draftPath: string): void {
  console.log(`Draft saved to ${path.relative(process.cwd(), draftPath)}`);
  console.log(`Rules: ${draft.ruleIds.length} (${draft.ruleIds.join(", ")})`);
  console.log(
    `Regulation quotes: ${draft.regulationQuoteCount}, unverified: ${draft.unverifiedQuotes.length}`,
  );

  for (const quote of draft.unverifiedQuotes) {
    console.warn(`⚠ Quote not found verbatim in the regulation: „${quote}“`);
  }
}

runDemo().catch((error: unknown) => {
  console.error("\nPolicy drafting failed:");
  console.error(error);
  process.exit(1);
});
