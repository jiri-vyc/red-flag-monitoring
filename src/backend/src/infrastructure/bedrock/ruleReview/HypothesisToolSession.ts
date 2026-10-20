import type { z } from "zod";

import type { JsonValue } from "../../../domain/json";
import type { RuleDefinition } from "../../../domain/ruleDefinition";
import { findRuleDefinitionViolation } from "../../../domain/ruleDefinitionValidation";
import { buildRuleDefinition, type FlatRuleDefinition } from "../flatRuleDefinition";
import type { LlmBudget, RuleBacktest, RuleHypothesis, RuleReviewReport, RuleReviewTools } from "./contract";
import {
  addCritiqueInputSchema,
  backtestRuleInputSchema,
  HYPOTHESIS_TOOL_NAMES,
  proposeHypothesisInputSchema,
  reportCoverageGapInputSchema,
} from "./hypothesisPrompt";
import { findDiscardReason, limitSampleClientIds } from "./hypothesisScreening";
import { describeError, toJsonValue, type ToolUseBlock } from "./modelCall";

export type ToolExecution = { result: JsonValue; isError: boolean };

type ToolHandler = (input: unknown) => Promise<ToolExecution>;

type DefinitionBacktest =
  | { isValid: true; definition: RuleDefinition; backtest: RuleBacktest }
  | { isValid: false; violation: string };

export class HypothesisToolSession {
  private readonly hypotheses: RuleHypothesis[] = [];
  private readonly critiques = new Map<string, string[]>();
  private readonly handlers: Record<string, ToolHandler>;

  constructor(
    private readonly report: RuleReviewReport,
    private readonly tools: RuleReviewTools,
    private readonly budget: LlmBudget,
  ) {
    this.handlers = {
      [HYPOTHESIS_TOOL_NAMES.getRuleCatalogue]: async () => succeed(await this.tools.getRuleCatalogue()),
      [HYPOTHESIS_TOOL_NAMES.getFeatureCatalogue]: async () =>
        succeed(await this.tools.getFeatureCatalogue()),
      [HYPOTHESIS_TOOL_NAMES.getCoverageMatrix]: async () => succeed(await this.tools.getCoverageMatrix()),
      [HYPOTHESIS_TOOL_NAMES.getGapFindings]: async () => succeed(await this.tools.getGapFindings()),
      [HYPOTHESIS_TOOL_NAMES.getSegmentProfiles]: async () => succeed(await this.tools.getSegmentProfiles()),
      [HYPOTHESIS_TOOL_NAMES.getCounterpartyStructure]: async () =>
        succeed(await this.tools.getCounterpartyStructure()),
      [HYPOTHESIS_TOOL_NAMES.backtestRule]: (input) =>
        withParsedInput(backtestRuleInputSchema, input, async ({ definition }) =>
          succeed(describeBacktest(await this.backtestFlatDefinition(definition))),
        ),
      [HYPOTHESIS_TOOL_NAMES.proposeHypothesis]: (input) =>
        withParsedInput(proposeHypothesisInputSchema, input, (proposal) => this.proposeHypothesis(proposal)),
      [HYPOTHESIS_TOOL_NAMES.reportCoverageGap]: (input) =>
        withParsedInput(reportCoverageGapInputSchema, input, async (gap) => this.recordCoverageGap(gap)),
      [HYPOTHESIS_TOOL_NAMES.addCritique]: (input) =>
        withParsedInput(addCritiqueInputSchema, input, async (critique) => this.addCritique(critique)),
    };
  }

  async executeTool(toolUse: ToolUseBlock): Promise<ToolExecution> {
    const handler = this.handlers[toolUse.name];

    if (!handler) {
      return fail(`Unknown tool ${toolUse.name}`);
    }

    try {
      return await handler(toolUse.input);
    } catch (error) {
      return fail(`Tool ${toolUse.name} failed: ${describeError(error)}`);
    }
  }

  // Discarded new rules are kept too, with backtest.discardReason set, so the officer sees what was tried.
  getHypotheses(): RuleHypothesis[] {
    return [...this.hypotheses];
  }

  getCritiques(): Record<string, string> {
    return Object.fromEntries(
      [...this.critiques].map(([findingId, comments]) => [findingId, comments.join("\n\n")]),
    );
  }

  private async backtestFlatDefinition(flatDefinition: FlatRuleDefinition): Promise<DefinitionBacktest> {
    const buildResult = buildRuleDefinition(flatDefinition);

    if ("violation" in buildResult) {
      return { isValid: false, violation: buildResult.violation };
    }

    const violation = findRuleDefinitionViolation(buildResult.definition);

    if (violation) {
      return { isValid: false, violation };
    }

    const backtest = await this.tools.backtestRule(buildResult.definition);
    const discardReason = findDiscardReason(backtest);

    return {
      isValid: true,
      definition: buildResult.definition,
      backtest: { ...limitSampleClientIds(backtest, this.budget.maxSampleClientIds), discardReason },
    };
  }

  private async proposeHypothesis(
    proposal: z.infer<typeof proposeHypothesisInputSchema>,
  ): Promise<ToolExecution> {
    if (this.countAcceptedHypotheses() >= this.budget.maxHypotheses) {
      return fail(
        `The limit of ${this.budget.maxHypotheses} accepted hypotheses is reached; finish instead.`,
      );
    }

    const result = await this.backtestFlatDefinition(proposal.definition);

    if (!result.isValid) {
      return succeed({ status: "rejected", reason: `DSL validation failed: ${result.violation}` });
    }

    const hypothesis: RuleHypothesis = {
      id: this.createHypothesisId(),
      kind: "new_rule",
      definition: result.definition,
      missingFeature: null,
      descriptionCs: proposal.descriptionCs,
      indicator: proposal.indicator,
      suggestedLegalBasis: proposal.suggestedLegalBasis,
      rationale: proposal.rationale,
      backtest: result.backtest,
    };
    this.hypotheses.push(hypothesis);
    const status = result.backtest.discardReason === null ? "accepted" : "rejected";

    return succeed({
      status,
      hypothesisId: hypothesis.id,
      reason: result.backtest.discardReason,
      backtest: result.backtest,
    });
  }

  private recordCoverageGap(gap: z.infer<typeof reportCoverageGapInputSchema>): ToolExecution {
    if (this.hypotheses.filter(({ kind }) => kind === "coverage_gap").length >= this.budget.maxHypotheses) {
      return fail(`The limit of ${this.budget.maxHypotheses} coverage gaps is reached.`);
    }

    const coverageGap: RuleHypothesis = {
      id: this.createHypothesisId(),
      kind: "coverage_gap",
      definition: null,
      missingFeature: gap.missingFeature,
      descriptionCs: gap.descriptionCs,
      indicator: gap.indicator,
      suggestedLegalBasis: null,
      rationale: gap.rationale,
      backtest: null,
    };
    this.hypotheses.push(coverageGap);

    return succeed({ status: "recorded", hypothesisId: coverageGap.id });
  }

  private addCritique({ findingId, comment }: z.infer<typeof addCritiqueInputSchema>): ToolExecution {
    if (!this.report.findings.some(({ id }) => id === findingId)) {
      return fail(`Finding ${findingId} is not part of this review`);
    }

    this.critiques.set(findingId, [...(this.critiques.get(findingId) ?? []), comment]);

    return succeed({ status: "recorded", findingId });
  }

  private countAcceptedHypotheses(): number {
    return this.hypotheses.filter(
      ({ kind, backtest }) => kind === "new_rule" && backtest?.discardReason === null,
    ).length;
  }

  private createHypothesisId(): string {
    return `H-${this.hypotheses.length + 1}`;
  }
}

function describeBacktest(result: DefinitionBacktest): unknown {
  return result.isValid ? result.backtest : { violation: `DSL validation failed: ${result.violation}` };
}

async function withParsedInput<Schema extends z.ZodType>(
  schema: Schema,
  input: unknown,
  handle: (parsedInput: z.infer<Schema>) => Promise<ToolExecution>,
): Promise<ToolExecution> {
  const parseResult = schema.safeParse(input);

  return parseResult.success
    ? handle(parseResult.data)
    : fail(`Input does not match the tool schema: ${parseResult.error.message}`);
}

function succeed(result: unknown): ToolExecution {
  return { result: toJsonValue(result), isError: false };
}

function fail(message: string): ToolExecution {
  return { result: { error: message }, isError: true };
}
