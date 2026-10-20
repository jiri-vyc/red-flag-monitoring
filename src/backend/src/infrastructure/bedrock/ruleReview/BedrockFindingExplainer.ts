import type {
  FindingExplainer,
  FindingExplanation,
  FindingExplanationContext,
  LlmAuditLog,
  LlmCallAudit,
  RuleReviewFinding,
} from "./contract";
import { findUnverifiedCitations } from "./evidenceCitations";
import {
  buildExplanationEvidence,
  createFindingExplanationUserPrompt,
  createReviewSummaryUserPrompt,
  FINDING_EXPLANATION_SYSTEM_PROMPT,
  parseExplanationOutput,
  REVIEW_SUMMARY_SYSTEM_PROMPT,
  SUBMIT_EXPLANATION_TOOL_NAME,
  submitExplanationTool,
} from "./findingExplanationPrompt";
import { mapWithConcurrency } from "./mapWithConcurrency";
import {
  callModel,
  describeError,
  findToolUses,
  type ModelClient,
  type ModelMessageParam,
  readMessageText,
  toJsonValue,
} from "./modelCall";

const MAX_EXPLANATION_OUTPUT_TOKENS = 4_000;
const MAX_SUMMARY_OUTPUT_TOKENS = 1_500;

export type BedrockFindingExplainerDependencies = {
  // Called per explain() and summarize(), so a long-running process never holds an expired short-term API key.
  createClient: () => Promise<ModelClient>;
  modelId: string;
};

export class BedrockFindingExplainer implements FindingExplainer {
  constructor(private readonly dependencies: BedrockFindingExplainerDependencies) {}

  async explain(
    findings: RuleReviewFinding[],
    context: FindingExplanationContext,
  ): Promise<Record<string, FindingExplanation>> {
    try {
      const client = await this.dependencies.createClient();
      const explanations = await mapWithConcurrency(
        findings,
        context.budget.maxConcurrentExplanations,
        async (finding) => [finding.id, await this.explainFinding(client, finding, context)] as const,
      );

      return Object.fromEntries(
        explanations.flatMap(([findingId, explanation]) => (explanation ? [[findingId, explanation]] : [])),
      );
    } catch (error) {
      context.audit.recordError(`Explanations failed: ${describeError(error)}`);
      return {};
    }
  }

  // Reads the explanations from context.report.llm, so the executor sets them before calling summarize().
  async summarize(context: FindingExplanationContext): Promise<string | null> {
    try {
      return await this.summarizeReview(await this.dependencies.createClient(), context);
    } catch (error) {
      context.audit.recordError(`Review summary failed: ${describeError(error)}`);
      return null;
    }
  }

  private async explainFinding(
    client: ModelClient,
    finding: RuleReviewFinding,
    context: FindingExplanationContext,
  ): Promise<FindingExplanation | null> {
    const evidence = buildExplanationEvidence(finding, context);
    const userMessage: ModelMessageParam = {
      role: "user",
      content: createFindingExplanationUserPrompt(evidence),
    };
    const outcome = await callModel(client, this.dependencies.modelId, {
      purpose: "explanation",
      findingId: finding.id,
      isContinuation: false,
      system: FINDING_EXPLANATION_SYSTEM_PROMPT,
      messages: [userMessage],
      newMessages: [userMessage],
      tools: [submitExplanationTool],
      toolChoice: { type: "tool", name: SUBMIT_EXPLANATION_TOOL_NAME },
      maxTokens: MAX_EXPLANATION_OUTPUT_TOKENS,
    });
    const fail = (error: string, call: LlmCallAudit = outcome.audit): null => {
      recordFailure(context.audit, call, `Finding ${finding.id}: ${error}`);
      return null;
    };

    if (!outcome.isSuccess) {
      return fail(outcome.error);
    }

    // A cut-off tool call has incomplete input, so it is rejected instead of being parsed.
    const toolUse = findToolUses(outcome.message).find(({ name }) => name === SUBMIT_EXPLANATION_TOOL_NAME);

    if (!toolUse || outcome.message.stop_reason === "max_tokens") {
      return fail(`model returned no complete explanation (stop_reason ${outcome.message.stop_reason})`);
    }

    const parsed = parseExplanationOutput(toolUse.input);
    const withToolCall = (result: unknown): LlmCallAudit => ({
      ...outcome.audit,
      toolCalls: [
        { name: toolUse.name, input: toJsonValue(toolUse.input ?? null), result: toJsonValue(result) },
      ],
    });

    if ("violation" in parsed) {
      return fail(parsed.violation, withToolCall({ error: parsed.violation }));
    }

    const unverifiedCitations = findUnverifiedCitations(parsed.output.citedEvidence, evidence);
    context.audit.recordCall(withToolCall({ unverifiedCitations }));

    return { ...parsed.output, unverifiedCitations };
  }

  private async summarizeReview(
    client: ModelClient,
    context: FindingExplanationContext,
  ): Promise<string | null> {
    const explanationSummaries = Object.fromEntries(
      Object.entries(context.report.llm.explanations).map(([findingId, { summary }]) => [findingId, summary]),
    );
    const userMessage: ModelMessageParam = {
      role: "user",
      content: createReviewSummaryUserPrompt(context.report.findings, explanationSummaries),
    };
    const outcome = await callModel(client, this.dependencies.modelId, {
      purpose: "summary",
      findingId: null,
      isContinuation: false,
      system: REVIEW_SUMMARY_SYSTEM_PROMPT,
      messages: [userMessage],
      newMessages: [userMessage],
      tools: [],
      toolChoice: { type: "auto" },
      maxTokens: MAX_SUMMARY_OUTPUT_TOKENS,
    });

    if (!outcome.isSuccess) {
      recordFailure(context.audit, outcome.audit, `Review summary: ${outcome.error}`);
      return null;
    }

    if (outcome.message.stop_reason !== "end_turn") {
      const error = `Review summary: model stopped with "${outcome.message.stop_reason}" before finishing`;
      recordFailure(context.audit, outcome.audit, error);
      return null;
    }

    context.audit.recordCall(outcome.audit);
    return readMessageText(outcome.message);
  }
}

function recordFailure(audit: LlmAuditLog, call: LlmCallAudit, error: string): void {
  audit.recordCall(call);
  audit.recordError(error);
}
