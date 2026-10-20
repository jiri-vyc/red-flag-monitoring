import type {
  HypothesisExploration,
  HypothesisExplorer,
  LlmBudget,
  LlmCallAudit,
  RuleReviewReport,
  RuleReviewTools,
} from "./contract";
import { ExplorationBudget } from "./explorationBudget";
import { createHypothesisSystemPrompt, HYPOTHESIS_TOOLS, HYPOTHESIS_USER_PROMPT } from "./hypothesisPrompt";
import { HypothesisToolSession, type ToolExecution } from "./HypothesisToolSession";
import {
  callModel,
  describeError,
  findToolUses,
  type ModelClient,
  type ModelMessageParam,
  toAssistantMessage,
  toJsonValue,
  type ToolUseBlock,
} from "./modelCall";

// Per turn; the whole loop is capped by LlmBudget.maxOutputTokens.
const MAX_TURN_OUTPUT_TOKENS = 4_000;

export type BedrockHypothesisExplorerDependencies = {
  createClient: () => Promise<ModelClient>;
  modelId: string;
  now: () => number;
};

type LoopOutcome = { calls: LlmCallAudit[]; errors: string[] };

type ExecutedToolCall = { toolUse: ToolUseBlock; execution: ToolExecution };

export class BedrockHypothesisExplorer implements HypothesisExplorer {
  constructor(private readonly dependencies: BedrockHypothesisExplorerDependencies) {}

  async explore(
    report: RuleReviewReport,
    tools: RuleReviewTools,
    budget: LlmBudget,
  ): Promise<HypothesisExploration> {
    const session = new HypothesisToolSession(report, tools, budget);
    const system = createHypothesisSystemPrompt(budget, report.params.backtest);
    const { calls, errors } = await this.runLoopSafely(session, system, budget);

    return { hypotheses: session.getHypotheses(), critiques: session.getCritiques(), calls, errors };
  }

  private async runLoopSafely(
    session: HypothesisToolSession,
    system: string,
    budget: LlmBudget,
  ): Promise<LoopOutcome> {
    try {
      return await this.runLoop(await this.dependencies.createClient(), session, system, budget);
    } catch (error) {
      return { calls: [], errors: [`Hypothesis loop failed: ${describeError(error)}`] };
    }
  }

  private async runLoop(
    client: ModelClient,
    session: HypothesisToolSession,
    system: string,
    budget: LlmBudget,
  ): Promise<LoopOutcome> {
    const tracker = new ExplorationBudget(budget, this.dependencies.now(), this.dependencies.now);
    const firstMessage: ModelMessageParam = { role: "user", content: HYPOTHESIS_USER_PROMPT };
    const messages: ModelMessageParam[] = [firstMessage];
    const calls: LlmCallAudit[] = [];
    let newMessages: ModelMessageParam[] = [firstMessage];
    let isContinuation = false;

    for (;;) {
      const exhaustion = tracker.findExhaustion();

      if (exhaustion !== null) {
        return { calls, errors: [describeBudgetStop(exhaustion)] };
      }

      const outcome = await callModel(client, this.dependencies.modelId, {
        purpose: "hypotheses",
        findingId: null,
        isContinuation,
        system,
        messages: [...messages],
        newMessages,
        tools: HYPOTHESIS_TOOLS,
        toolChoice: { type: "auto" },
        maxTokens: Math.min(MAX_TURN_OUTPUT_TOKENS, tracker.remainingOutputTokens),
        signal: AbortSignal.timeout(tracker.remainingMs),
      });

      if (!outcome.isSuccess) {
        calls.push(outcome.audit);
        const stopReason = tracker.remainingMs === 0 ? describeBudgetStop("wall clock limit reached") : null;

        return { calls, errors: [stopReason ?? `Hypothesis loop: ${outcome.error}`] };
      }

      tracker.recordModelCall(outcome.audit);

      const toolUses = findToolUses(outcome.message);

      if (outcome.message.stop_reason === "max_tokens") {
        calls.push(outcome.audit);
        return {
          calls,
          errors: [describeBudgetStop("the model's answer was cut off by the output token limit")],
        };
      }

      if (toolUses.length === 0) {
        calls.push(outcome.audit);
        return { calls, errors: [] };
      }

      const executedToolCalls = await this.executeToolCallsWithinBudget(toolUses, session, tracker);
      calls.push({ ...outcome.audit, toolCalls: executedToolCalls.map(toToolCallAudit) });

      if (executedToolCalls.length < toolUses.length) {
        return { calls, errors: [describeBudgetStop(tracker.findExhaustion() ?? "budget reached")] };
      }

      const toolResultMessage = createToolResultMessage(executedToolCalls);
      messages.push(toAssistantMessage(outcome.message), toolResultMessage);
      newMessages = [toolResultMessage];
      isContinuation = true;
    }
  }

  private async executeToolCallsWithinBudget(
    toolUses: ToolUseBlock[],
    session: HypothesisToolSession,
    tracker: ExplorationBudget,
  ): Promise<ExecutedToolCall[]> {
    const executedToolCalls: ExecutedToolCall[] = [];

    for (const toolUse of toolUses) {
      if (tracker.remainingToolCalls === 0 || tracker.remainingMs === 0) {
        break;
      }

      tracker.recordToolCall();
      executedToolCalls.push({ toolUse, execution: await session.executeTool(toolUse) });
    }

    return executedToolCalls;
  }
}

function createToolResultMessage(executedToolCalls: ExecutedToolCall[]): ModelMessageParam {
  return {
    role: "user",
    content: executedToolCalls.map(({ toolUse, execution }) => ({
      type: "tool_result",
      tool_use_id: toolUse.id,
      content: JSON.stringify(execution.result),
      is_error: execution.isError,
    })),
  };
}

function toToolCallAudit({ toolUse, execution }: ExecutedToolCall): LlmCallAudit["toolCalls"][number] {
  return { name: toolUse.name, input: toJsonValue(toolUse.input ?? null), result: execution.result };
}

function describeBudgetStop(reason: string): string {
  return `Hypothesis loop stopped early, partial results kept: ${reason}`;
}
