import { randomUUID } from "node:crypto";

import type AnthropicBedrock from "@anthropic-ai/bedrock-sdk";

import type { DraftGenerator, PolicyDraft, RuleDraft } from "../../application/drafting/draftGenerator";
import { BusinessRuleViolationError } from "../../application/errors";
import type { InternalPolicyRepository } from "../../application/internalPolicies/internalPolicyRepository";
import type { ReferenceListRepository } from "../../application/referenceLists/referenceListRepository";
import type { RegulationRepository } from "../../application/regulations/regulationRepository";
import type { RuleRepository } from "../../application/rules/ruleRepository";
import { findNextPolicyCode, findNextRuleNumber } from "../../domain/draftNumbering";
import type { InternalPolicy, InternalPolicyVersion } from "../../domain/internalPolicy";
import {
  findDefinedRuleIds,
  findMarkdownSection,
  findRegulationQuotes,
  findUnverifiedQuotes,
} from "../../domain/policyDraftReview";
import type { PolicyLegalBasis, Regulation, RegulationVersion } from "../../domain/regulation";
import { logTokenUsage, readCompleteText } from "./modelResponse";
import { createPolicyDraftingUserPrompt, POLICY_DRAFTING_SYSTEM_PROMPT } from "./policyDraftingPrompt";
import { createRuleDraftingUserPrompt, RULE_DRAFTING_SYSTEM_PROMPT } from "./ruleDraftingPrompt";
import {
  mapRuleProposalToDraft,
  parseRuleProposals,
  type RuleProposal,
  ruleProposalsJsonSchema,
} from "./ruleProposal";

// The approved policy every draft imitates in structure and tone (seeded from the knowledge base).
const EXAMPLE_POLICY_CODE = "SVZ-06";
// Czech legal text has ~2.7 characters per token (English ~4.9), so 400k characters stay under ~150k tokens.
// With the example policy (~10k), the system prompt and the output (16k) that fits the 200k-token context of
// Claude Opus 4.5 and covers every seeded regulation, the longest being AMLD6 (358k characters, 133k tokens).
// A longer regulation must be narrowed with a scope, which also keeps the cost predictable.
const MAX_REGULATION_CHARACTERS = 400_000;
// A full policy draft or all rules of a policy is ~10–12k tokens; 16k stays under the SDK limit for
// non-streaming requests.
const MAX_OUTPUT_TOKENS = 16_000;
// The drafting prompt leaves the policy number to a human; the generator fills in the next free one.
const POLICY_CODE_PLACEHOLDER = "SVZ-NN";
const UNSPECIFIED_PROVISION = "neurčeno";

export type BedrockDraftGeneratorDependencies = {
  // Called per request, so a long-running process never holds an expired short-term API key.
  createClient: () => Promise<AnthropicBedrock>;
  modelId: string;
  regulationRepository: RegulationRepository;
  internalPolicyRepository: InternalPolicyRepository;
  ruleRepository: RuleRepository;
  referenceListRepository: ReferenceListRepository;
};

type PolicyRegulation = { code: string; title: string; regulationVersionId: string };

type ModelRequest = {
  operation: string;
  system: string;
  userPrompt: string;
  outputSchema: Record<string, unknown> | null;
};

// Claude on Amazon Bedrock drafts (#1) internal policies from a regulation and (#2) rules from a policy.
export class BedrockDraftGenerator implements DraftGenerator {
  constructor(private readonly dependencies: BedrockDraftGeneratorDependencies) {}

  async draftPolicies(
    regulation: Regulation,
    version: RegulationVersion,
    scope: string | null,
  ): Promise<PolicyDraft[]> {
    const regulationText = selectRegulationText(regulation, version, scope);
    const [examplePolicy, firstRuleNumber, policyCode] = await Promise.all([
      this.loadExamplePolicy(),
      this.findNextRuleNumber(),
      this.findNextPolicyCode(),
    ]);

    const draftedBody = await this.requestText({
      operation: "draftPolicies",
      system: POLICY_DRAFTING_SYSTEM_PROMPT,
      userPrompt: createPolicyDraftingUserPrompt({
        regulation: {
          title: regulation.title,
          sourceReference: createSourceReference(regulation, version),
          body: regulationText,
        },
        scope,
        examplePolicy,
        firstRuleNumber,
      }),
      outputSchema: null,
    });
    const body = draftedBody.replaceAll(POLICY_CODE_PLACEHOLDER, policyCode);

    warnAboutUnverifiedQuotes(policyCode, body, regulationText);

    return [
      {
        code: policyCode,
        title: readPolicyTitle(body, policyCode),
        body,
        legalBases: [{ regulationVersionId: version.id, ref: scope }],
      },
    ];
  }

  async draftRules(policy: InternalPolicy, version: InternalPolicyVersion): Promise<RuleDraft[]> {
    const regulations = await this.loadPolicyRegulations(version.legalBases);

    // A rule version needs a legal basis (M5), so a purely internal policy yields no drafts.
    if (regulations.length === 0) {
      console.warn(`[bedrock] draftRules skipped: policy ${policy.code} has no legal basis`);
      return [];
    }

    const [referenceLists, existingRules] = await Promise.all([
      this.dependencies.referenceListRepository.listLists(),
      this.dependencies.ruleRepository.listRules(),
    ]);
    const responseText = await this.requestText({
      operation: "draftRules",
      system: RULE_DRAFTING_SYSTEM_PROMPT,
      userPrompt: createRuleDraftingUserPrompt({
        policy: { code: policy.code, title: policy.title, body: version.body },
        regulations,
        referenceLists,
      }),
      outputSchema: ruleProposalsJsonSchema,
    });
    const context = {
      regulationVersionIdsByCode: new Map(
        regulations.map((regulation) => [regulation.code, regulation.regulationVersionId]),
      ),
      fallbackLegalBases: version.legalBases.map(({ regulationVersionId, ref }) => ({
        regulationVersionId,
        ref: ref ?? UNSPECIFIED_PROVISION,
      })),
      existingRuleCodes: new Set(existingRules.map((rule) => rule.code)),
      agentModelId: this.dependencies.modelId,
      createCodeSuffix: () => randomUUID().slice(0, 6),
    };

    return parseProposalsOrLogExcerpt(responseText).map((proposal) =>
      mapRuleProposalToDraft(proposal, context),
    );
  }

  private async requestText(request: ModelRequest): Promise<string> {
    const client = await this.dependencies.createClient();
    const startedAt = Date.now();
    const message = await client.messages.create({
      model: this.dependencies.modelId,
      max_tokens: MAX_OUTPUT_TOKENS,
      system: request.system,
      messages: [{ role: "user", content: request.userPrompt }],
      ...(request.outputSchema && {
        output_config: { format: { type: "json_schema", schema: request.outputSchema } },
      }),
    });

    console.log(
      `[bedrock] ${request.operation} took ${formatSeconds(Date.now() - startedAt)} ` +
        `stop_reason=${message.stop_reason}`,
    );
    logTokenUsage(request.operation, this.dependencies.modelId, message.usage);

    try {
      return readCompleteText(message).trim();
    } catch (error) {
      logResponseExcerpt(request.operation, readTextOrEmpty(message));
      throw error;
    }
  }

  private async loadExamplePolicy(): Promise<{ title: string; body: string }> {
    const repository = this.dependencies.internalPolicyRepository;
    const policy = (await repository.listPolicies()).find(({ code }) => code === EXAMPLE_POLICY_CODE);
    const versions = policy ? await repository.listVersions(policy.id) : [];
    const latestVersion = versions.toSorted((first, second) => second.versionNo - first.versionNo)[0];

    if (!policy || !latestVersion) {
      throw new BusinessRuleViolationError(`Example policy ${EXAMPLE_POLICY_CODE} has no version to imitate`);
    }

    return { title: policy.title, body: latestVersion.body };
  }

  private async findNextPolicyCode(): Promise<string> {
    const policies = await this.dependencies.internalPolicyRepository.listPolicies();

    return findNextPolicyCode(policies.map(({ code }) => code));
  }

  // Counts rules already stored and rules defined only in policy versions, so two drafts never share an ID.
  private async findNextRuleNumber(): Promise<number> {
    const repository = this.dependencies.internalPolicyRepository;
    const [rules, policies] = await Promise.all([
      this.dependencies.ruleRepository.listRules(),
      repository.listPolicies(),
    ]);
    const policyVersions = await Promise.all(policies.map(({ id }) => repository.listVersions(id)));
    const policyRuleIds = policyVersions.flat().flatMap(({ body }) => findDefinedRuleIds(body));

    return findNextRuleNumber([...rules.map(({ code }) => code), ...policyRuleIds]);
  }

  private async loadPolicyRegulations(legalBases: PolicyLegalBasis[]): Promise<PolicyRegulation[]> {
    const repository = this.dependencies.regulationRepository;
    const versionIds = [...new Set(legalBases.map(({ regulationVersionId }) => regulationVersionId))];
    const regulations = await Promise.all(
      versionIds.map(async (regulationVersionId) => {
        const version = await repository.findVersion(regulationVersionId);
        const regulation = version ? await repository.findRegulation(version.regulationId) : null;

        return regulation ? [{ code: regulation.code, title: regulation.title, regulationVersionId }] : [];
      }),
    );

    return regulations.flat();
  }
}

// Without the model output, a malformed or cut-off response cannot be debugged except by paying for a rerun.
const RESPONSE_EXCERPT_CHARACTERS = 500;

function parseProposalsOrLogExcerpt(responseText: string): RuleProposal[] {
  try {
    return parseRuleProposals(responseText);
  } catch (error) {
    logResponseExcerpt("draftRules", responseText);
    throw error;
  }
}

function logResponseExcerpt(operation: string, responseText: string): void {
  const head = responseText.slice(0, RESPONSE_EXCERPT_CHARACTERS);
  const tail =
    responseText.length > 2 * RESPONSE_EXCERPT_CHARACTERS
      ? responseText.slice(-RESPONSE_EXCERPT_CHARACTERS)
      : responseText.slice(RESPONSE_EXCERPT_CHARACTERS);

  console.error(
    `[bedrock] ${operation} returned an unusable response (${responseText.length} characters).\n` +
      `--- start ---\n${head}\n--- end ---\n${tail}`,
  );
}

function readTextOrEmpty(message: { content: ReadonlyArray<{ type: string; text?: string }> }): string {
  return message.content.find((block) => block.type === "text")?.text ?? "";
}

function formatSeconds(milliseconds: number): string {
  return `${(milliseconds / 1000).toFixed(1)}s`;
}

function selectRegulationText(
  regulation: Regulation,
  version: RegulationVersion,
  scope: string | null,
): string {
  const text = scope === null ? version.fullText : findMarkdownSection(version.fullText, scope);

  if (text === null) {
    throw new BusinessRuleViolationError(
      `Regulation ${regulation.code} has no heading containing "${scope}"`,
    );
  }

  if (text.length > MAX_REGULATION_CHARACTERS) {
    throw new BusinessRuleViolationError(
      `The selected text of ${regulation.code} has ${text.length} characters, more than ${MAX_REGULATION_CHARACTERS}. ` +
        "Narrow it with a scope, e.g. one chapter or guideline.",
    );
  }

  return text;
}

function createSourceReference(regulation: Regulation, version: RegulationVersion): string {
  const label = `${regulation.code}, ${version.label}`;

  return regulation.sourceUrl ? `[${label}](${regulation.sourceUrl})` : label;
}

// "# SVZ-07 Směrnice o …" → "Směrnice o …", matching the titles of the seeded policies.
function readPolicyTitle(body: string, policyCode: string): string {
  const heading = body.split("\n").find((line) => line.startsWith("# ")) ?? "";
  const title = heading.replace(/^#\s*/, "").replace(policyCode, "").trim();

  return title || policyCode;
}

// Quotes must be verbatim from the regulation; the reviewer has to check the ones that are not.
function warnAboutUnverifiedQuotes(policyCode: string, body: string, regulationText: string): void {
  const quotes = findRegulationQuotes(body);
  const unverifiedQuotes = findUnverifiedQuotes(quotes, regulationText);

  if (unverifiedQuotes.length > 0) {
    console.warn(
      `[bedrock] ${policyCode}: ${unverifiedQuotes.length} of ${quotes.length} regulation quotes are not verbatim`,
    );
  }
}
