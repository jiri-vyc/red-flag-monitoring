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
import { COMPARISON_OPERATORS, CONDITION_LOGICS } from "../../domain/ruleDefinition";
import { calculateBaseScore } from "../../domain/rulePriority";
import { MalformedModelResponseError } from "./modelResponse";

const RULE_PARAMETER_SOURCES = ["regulation", "calibration"] as const;

const operandSchema = z.union([
  z.strictObject({ feature: z.string() }),
  z.strictObject({ expr: z.string() }),
  z.strictObject({ list: z.string() }),
  z.strictObject({ value: z.union([z.number(), z.string(), z.boolean()]) }),
]);

const conditionSchema = z.strictObject({
  id: z.string(),
  label: z.string(),
  left: operandSchema,
  op: z.enum(COMPARISON_OPERATORS),
  right: operandSchema,
});

// Groups nest at most three levels deep, as in the sample rules ("higher risk" inside a group inside a group).
// Spelling the levels out keeps the structured-output schema non-recursive.
function createConditionGroupSchema<Node extends z.ZodType>(nodeSchema: Node) {
  return z.strictObject({
    id: z.string(),
    label: z.string(),
    match: z.enum(CONDITION_LOGICS),
    conditions: z.array(nodeSchema),
  });
}

const innerGroupSchema = createConditionGroupSchema(conditionSchema);
const middleGroupSchema = createConditionGroupSchema(z.union([conditionSchema, innerGroupSchema]));
const outerGroupSchema = createConditionGroupSchema(z.union([conditionSchema, middleGroupSchema]));

const ruleDefinitionSchema = z.strictObject({
  match: z.enum(CONDITION_LOGICS),
  features: z.array(z.string()),
  conditions: z.array(z.union([conditionSchema, outerGroupSchema])),
});

const ruleProposalSchema = z.strictObject({
  code: z.string(),
  title: z.string(),
  alertType: z.string(),
  kind: z.enum(RULE_KINDS),
  isWhitelistAllowed: z.boolean(),
  humanText: z.string(),
  definition: ruleDefinitionSchema.nullable(),
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
  const proposedLogic = createProposedLogic(proposal, context.agentModelId);
  const logicViolation = findRuleLogicViolation(proposal.kind, proposedLogic);
  // A definition the engine cannot run is kept as an agentic rule, so the reviewer still sees the proposal.
  const logic = logicViolation ? createAgenticLogic(proposal, context.agentModelId) : proposedLogic;

  return {
    code: createUniqueCode(proposal.code, context),
    alertType: proposal.alertType,
    kind: logicViolation ? "agentic" : proposal.kind,
    isWhitelistAllowed: proposal.isWhitelistAllowed,
    ...logic,
    humanText: `${proposal.title}. ${proposal.humanText}`,
    thresholdRationale: createThresholdRationale(proposal, logicViolation),
    sensitivity: DEFAULT_SENSITIVITY,
    riskProfiles: [...RISK_PROFILES],
    legalBases: mapLegalBases(proposal, context),
  };
}

function createProposedLogic(proposal: RuleProposal, agentModelId: string): RuleLogic {
  if (proposal.kind === "agentic") {
    return createAgenticLogic(proposal, agentModelId);
  }

  return {
    definition: proposal.definition,
    agentPrompt: null,
    agentModelId: null,
    baseScore: calculateBaseScore(proposal.priorityBase),
  };
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
