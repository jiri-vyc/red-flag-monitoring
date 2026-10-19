import { z } from "zod";

import type { RuleDraft } from "../../application/drafting/draftGenerator";
import type { RuleLegalBasis } from "../../domain/regulation";
import {
  DEFAULT_SENSITIVITY,
  findRuleLogicViolation,
  RISK_PROFILES,
  RULE_KINDS,
  type RuleLogic,
} from "../../domain/rule";
import { calculateBaseScore } from "../../domain/rulePriority";
import { buildRuleDefinition, flatRuleDefinitionSchema } from "./flatRuleDefinition";
import { MalformedModelResponseError } from "./modelResponse";

const RULE_PARAMETER_SOURCES = ["regulation", "calibration"] as const;

const ruleProposalSchema = z.strictObject({
  code: z.string(),
  title: z.string(),
  alertType: z.string(),
  kind: z.enum(RULE_KINDS),
  isWhitelistAllowed: z.boolean(),
  humanText: z.string(),
  definition: flatRuleDefinitionSchema.nullable(),
  agentPrompt: z.string().nullable(),
  priorityBase: z.number(),
  parameters: z.array(
    z.strictObject({ name: z.string(), value: z.string(), source: z.enum(RULE_PARAMETER_SOURCES) }),
  ),
  legalBases: z.array(z.strictObject({ regulationCode: z.string(), ref: z.string() })),
  openQuestions: z.array(z.string()),
});

const ruleProposalsResponseSchema = z.strictObject({ rules: z.array(ruleProposalSchema) });

// The "$schema" meta keyword is not part of a structured-output schema, so only the schema body is sent.
export const ruleProposalsJsonSchema = Object.fromEntries(
  Object.entries(z.toJSONSchema(ruleProposalsResponseSchema)).filter(([keyword]) => keyword !== "$schema"),
);

export type RuleProposal = z.infer<typeof ruleProposalSchema>;

export function parseRuleProposals(responseText: string): RuleProposal[] {
  const parseResult = ruleProposalsResponseSchema.safeParse(parseJson(responseText));

  if (!parseResult.success) {
    throw new MalformedModelResponseError(
      `Model response does not match the schema: ${parseResult.error.message}`,
    );
  }

  return parseResult.data.rules;
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new MalformedModelResponseError("Model response is not valid JSON", { cause: error });
  }
}

export type RuleProposalContext = {
  regulationVersionIdsByCode: ReadonlyMap<string, string>;
  // Used when none of the proposal's legal bases names a known regulation; a rule version needs one (M5).
  fallbackLegalBases: RuleLegalBasis[];
  existingRuleCodes: ReadonlySet<string>;
  agentModelId: string;
  createCodeSuffix: () => string;
};

export function mapRuleProposalToDraft(proposal: RuleProposal, context: RuleProposalContext): RuleDraft {
  const deterministicLogic = proposal.kind === "deterministic" ? createDeterministicLogic(proposal) : null;
  const logicViolation =
    deterministicLogic && "violation" in deterministicLogic ? deterministicLogic.violation : null;
  // A definition the engine cannot run is kept as an agentic rule, so the reviewer still sees the proposal.
  const isDeterministic = deterministicLogic !== null && "logic" in deterministicLogic;

  return {
    code: createUniqueCode(proposal.code, context),
    alertType: proposal.alertType,
    kind: isDeterministic ? "deterministic" : "agentic",
    isWhitelistAllowed: proposal.isWhitelistAllowed,
    ...(isDeterministic ? deterministicLogic.logic : createAgenticLogic(proposal, context.agentModelId)),
    humanText: `${proposal.title}. ${proposal.humanText}`,
    thresholdRationale: createThresholdRationale(proposal, logicViolation),
    sensitivity: DEFAULT_SENSITIVITY,
    riskProfiles: [...RISK_PROFILES],
    legalBases: mapLegalBases(proposal, context),
  };
}

function createDeterministicLogic(proposal: RuleProposal): { logic: RuleLogic } | { violation: string } {
  if (proposal.definition === null) {
    return { violation: "A deterministic rule needs a definition" };
  }

  const buildResult = buildRuleDefinition(proposal.definition);

  if ("violation" in buildResult) {
    return buildResult;
  }

  const logic: RuleLogic = {
    definition: buildResult.definition,
    agentPrompt: null,
    agentModelId: null,
    baseScore: calculateBaseScore(proposal.priorityBase),
  };
  const violation = findRuleLogicViolation("deterministic", logic);

  return violation ? { violation } : { logic };
}

function createAgenticLogic(proposal: RuleProposal, agentModelId: string): RuleLogic {
  return {
    definition: null,
    agentPrompt: proposal.agentPrompt ?? proposal.humanText,
    agentModelId,
    baseScore: null,
  };
}

// Rule codes are unique. Until re-drafting creates new versions of existing rules, a clash gets a suffix.
function createUniqueCode(code: string, context: RuleProposalContext): string {
  return context.existingRuleCodes.has(code) ? `${code}-${context.createCodeSuffix()}` : code;
}

function mapLegalBases(proposal: RuleProposal, context: RuleProposalContext): RuleLegalBasis[] {
  const legalBases = proposal.legalBases.flatMap(({ regulationCode, ref }) => {
    const regulationVersionId = context.regulationVersionIdsByCode.get(regulationCode);

    return regulationVersionId === undefined ? [] : [{ regulationVersionId, ref }];
  });

  return legalBases.length > 0 ? legalBases : context.fallbackLegalBases;
}

function createThresholdRationale(proposal: RuleProposal, logicViolation: string | null): string | null {
  const parameters = proposal.parameters.map(
    ({ name, value, source }) => `${name} = ${value} (${source === "regulation" ? "regulace" : "kalibrace"})`,
  );
  const lines = [
    logicViolation ? `Návrh DSL neprošel validací (${logicViolation}), pravidlo je proto agentní.` : null,
    parameters.length > 0 ? `Parametry: ${parameters.join("; ")}.` : null,
    proposal.openQuestions.length > 0 ? `Otevřené otázky: ${proposal.openQuestions.join(" ")}` : null,
  ].filter((line): line is string => line !== null);

  return lines.length > 0 ? lines.join("\n") : null;
}
