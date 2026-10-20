import type { LlmBudget } from "../../../domain/ruleReview/ruleReviewParams";
import type { LlmCallAudit } from "../../../domain/ruleReview/ruleReviewReport";

export class ExplorationBudget {
  private toolCalls = 0;
  private modelCalls = 0;
  private inputTokenCount = 0;
  private outputTokenCount = 0;
  private lastCallInputTokenCount = 0;

  constructor(
    private readonly budget: LlmBudget,
    private readonly startedAtMs: number,
    private readonly now: () => number,
  ) {}

  recordModelCall({ inputTokens, outputTokens }: Pick<LlmCallAudit, "inputTokens" | "outputTokens">): void {
    this.modelCalls += 1;
    this.inputTokenCount += inputTokens;
    this.outputTokenCount += outputTokens;
    this.lastCallInputTokenCount = inputTokens;
  }

  recordToolCall(): void {
    this.toolCalls += 1;
  }

  get modelCallCount(): number {
    return this.modelCalls;
  }

  get toolCallCount(): number {
    return this.toolCalls;
  }

  get remainingToolCalls(): number {
    return Math.max(0, this.budget.maxToolCalls - this.toolCalls);
  }

  get remainingOutputTokens(): number {
    return Math.max(0, this.budget.maxOutputTokens - this.outputTokenCount);
  }

  get remainingMs(): number {
    return Math.max(0, this.startedAtMs + this.budget.maxWallClockMs - this.now());
  }

  // The next request repeats the whole conversation, so it costs at least the last call's input tokens.
  findExhaustion(): string | null {
    if (this.remainingMs === 0) {
      return `wall clock limit of ${this.budget.maxWallClockMs / 1000} s reached`;
    }

    if (this.remainingToolCalls === 0) {
      return `tool call limit of ${this.budget.maxToolCalls} reached`;
    }

    if (this.inputTokenCount + this.lastCallInputTokenCount > this.budget.maxInputTokens) {
      return `input token limit of ${this.budget.maxInputTokens} would be exceeded by the next call`;
    }

    if (this.remainingOutputTokens === 0) {
      return `output token limit of ${this.budget.maxOutputTokens} reached`;
    }

    return null;
  }
}
