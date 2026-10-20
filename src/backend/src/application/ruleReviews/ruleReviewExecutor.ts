import { DEFAULT_HIT_THRESHOLD } from "../../domain/evaluation";
import { toDateKey } from "../../domain/features/calendar";
import { profileFindingClients } from "../../domain/ruleReview/clientProfiles";
import { createReviewDataset } from "../../domain/ruleReview/reviewDataset";
import type {
  LlmCallAudit,
  RuleHypothesis,
  RuleReviewFinding,
  RuleReviewReport,
} from "../../domain/ruleReview/ruleReviewReport";
import type { Clock } from "../clock";
import { NotFoundError, toErrorMessage } from "../errors";
import { calculateTransactionSetDigest } from "../evaluationRuns/runScope";
import { analyzeRuleGaps } from "./ruleReviewAnalysis";
import type {
  FindingExplainer,
  FindingExplanationContext,
  HypothesisExplorer,
  RuleReviewInputRepository,
  RuleReviewReportStore,
} from "./ruleReviewPorts";
import { backtestHypothesis, createRuleReviewTools, type ToolContext } from "./ruleReviewTools";
import { collectSummaryInputNumbers, findUnverifiedNumbers } from "../../domain/ruleReview/summaryNumbers";

const PROGRESS_SAVE_INTERVAL_MS = 1000;
const MAX_NEW_RULE_CLIENTS = 50;
const UNKNOWN_FEATURE_MARKER = "is not in the feature catalogue";

export class LlmWallClockExceededError extends Error {}

type RuleReviewExecutorDependencies = {
  reportStore: RuleReviewReportStore;
  inputRepository: RuleReviewInputRepository;
  findingExplainer: FindingExplainer;
  hypothesisExplorer: HypothesisExplorer;
  clock: Clock;
};

export class RuleReviewExecutor {
  constructor(private readonly dependencies: RuleReviewExecutorDependencies) {}

  async executeReview(reviewId: string): Promise<void> {
    const { reportStore, clock } = this.dependencies;
    const report = await reportStore.find(reviewId);

    if (!report) {
      throw new NotFoundError("Rule review", reviewId);
    }

    if (report.status !== "running") {
      console.warn(`Rule review ${reviewId} is ${report.status}, skipping`);
      return;
    }

    const writer = new ReportWriter(reportStore, report);

    try {
      await this.runReview(writer);
      await writer.save({
        status: "completed",
        finishedAt: clock().toISOString(),
        progress: { stage: "completed", done: 1, total: 1 },
      });
    } catch (error) {
      await writer.save({
        status: "failed",
        finishedAt: clock().toISOString(),
        errorMessage: toErrorMessage(error),
      });

      throw error;
    }
  }

  private async runReview(writer: ReportWriter): Promise<void> {
    const { inputRepository } = this.dependencies;

    await writer.save({ progress: { stage: "loading", done: 0, total: 1 } });
    const { ruleSet, ruleVersionIds, referenceListVersionIds } = await inputRepository.loadRuleSet({
      evaluationRunId: writer.report.input.evaluationRunId,
      hitThreshold: DEFAULT_HIT_THRESHOLD,
    });
    const [ruleCatalogue, rawDataset, transactionIds] = await Promise.all([
      inputRepository.loadRuleCatalogue(ruleVersionIds),
      inputRepository.loadDataset(),
      inputRepository.listTransactionIds(),
    ]);
    await writer.save({
      input: {
        ...writer.report.input,
        ruleVersionIds,
        referenceListVersionIds,
        transactionSetDigest: calculateTransactionSetDigest(transactionIds),
      },
    });

    const dataset = createReviewDataset(rawDataset);
    const params = writer.report.params;
    const analysis = await analyzeRuleGaps({
      dataset,
      ruleSet,
      ruleLabels: new Map(ruleCatalogue.map((rule) => [rule.ruleVersionId, rule.label])),
      params,
      reportProgress: (progress) => writer.saveProgress(progress),
    });
    await writer.save({ findings: analysis.findings, coverageMatrix: analysis.coverageMatrix });

    if (params.llm.enabled) {
      await this.runLlmStages(writer, {
        report: writer.report,
        dataset,
        ruleSet,
        ruleCatalogue,
        analysis,
        params,
      });
    }
  }

  // A Bedrock failure must never fail the review (spec 5.3).
  private async runLlmStages(writer: ReportWriter, toolContext: ToolContext): Promise<void> {
    const calls: LlmCallAudit[] = [];
    const errors: string[] = [];
    const saveLlm = (changes: Partial<RuleReviewReport["llm"]>) =>
      writer.save({ llm: { ...writer.report.llm, ...changes, calls: [...calls], errors: [...errors] } });

    await writer.save({ progress: { stage: "explanations", done: 0, total: 1 } });
    const explanations = await this.runSafely(errors, () =>
      this.dependencies.findingExplainer.explain(
        writer.report.findings,
        this.createExplanationContext(writer.report, toolContext, calls, errors),
      ),
    );
    await saveLlm({ explanations: explanations ?? {} });
    // summarize reads the explanations from context.report, so it gets the report saved above.
    const summary = await this.runSafely(errors, () =>
      this.dependencies.findingExplainer.summarize(
        this.createExplanationContext(writer.report, toolContext, calls, errors),
      ),
    );
    await saveLlm({
      summary,
      summaryUnverifiedNumbers: summary
        ? findUnverifiedNumbers(
            summary,
            collectSummaryInputNumbers({
              findings: writer.report.findings,
              explanationSummaries: Object.values(writer.report.llm.explanations).map(
                (explanation) => explanation.summary,
              ),
            }),
          )
        : [],
    });

    await writer.save({ progress: { stage: "hypotheses", done: 0, total: 1 } });
    const exploration = await this.runSafely(errors, () =>
      withTimeout(
        this.dependencies.hypothesisExplorer.explore(
          writer.report,
          createRuleReviewTools({ ...toolContext, report: writer.report }),
          toolContext.params.llm,
        ),
        toolContext.params.llm.maxWallClockMs,
      ),
    );
    calls.push(...(exploration?.calls ?? []));
    errors.push(...(exploration?.errors ?? []));
    const checked = await Promise.all(
      (exploration?.hypotheses ?? []).map((hypothesis) => this.backtest(toolContext, hypothesis)),
    );
    const newRuleFindings = checked
      .flatMap(({ finding }) => (finding?.kind === "new_rule" ? [finding] : []))
      .slice(0, toolContext.params.llm.maxHypotheses);
    const coverageGapFindings = checked.flatMap(({ finding }) =>
      finding?.kind === "coverage_gap" ? [finding] : [],
    );

    await writer.save({ findings: [...writer.report.findings, ...newRuleFindings, ...coverageGapFindings] });
    await saveLlm({
      hypotheses: checked.map(({ hypothesis }) => hypothesis),
      critiques: exploration?.critiques ?? {},
    });
  }

  private createExplanationContext(
    report: RuleReviewReport,
    toolContext: ToolContext,
    calls: LlmCallAudit[],
    errors: string[],
  ): FindingExplanationContext {
    const asOfDateKey = toDateKey(this.dependencies.clock());

    return {
      report,
      ruleCatalogue: toolContext.ruleCatalogue,
      clientProfilesByFindingId: Object.fromEntries(
        report.findings.map((finding) => [
          finding.id,
          profileFindingClients(finding.clients, toolContext.dataset, asOfDateKey),
        ]),
      ),
      budget: toolContext.params.llm,
      audit: { recordCall: (call) => calls.push(call), recordError: (message) => errors.push(message) },
    };
  }

  // Re-run on purpose: the model's own backtest is not trusted (spec 4).
  private async backtest(
    toolContext: ToolContext,
    hypothesis: RuleHypothesis,
  ): Promise<{ hypothesis: RuleHypothesis; finding: RuleReviewFinding | null }> {
    if (hypothesis.kind === "coverage_gap" || hypothesis.definition === null) {
      const gap = { ...hypothesis, backtest: null };

      return {
        hypothesis: gap,
        finding:
          hypothesis.kind === "coverage_gap" ? toHypothesisFinding(gap, "coverage_gap", new Map()) : null,
      };
    }

    const { backtest, transactionIdsByClientId } = await backtestHypothesis(
      toolContext,
      hypothesis.definition,
    );
    const checked = { ...hypothesis, backtest };

    if (backtest.violation?.includes(UNKNOWN_FEATURE_MARKER)) {
      return { hypothesis: checked, finding: toHypothesisFinding(checked, "coverage_gap", new Map()) };
    }

    return {
      hypothesis: checked,
      finding:
        backtest.discardReason === null
          ? toHypothesisFinding(checked, "new_rule", transactionIdsByClientId)
          : null,
    };
  }

  private async runSafely<T>(errors: string[], call: () => Promise<T>): Promise<T | null> {
    try {
      return await call();
    } catch (error) {
      errors.push(toErrorMessage(error));

      return null;
    }
  }
}

class ReportWriter {
  private lastSavedAt = 0;

  constructor(
    private readonly reportStore: RuleReviewReportStore,
    public report: RuleReviewReport,
  ) {}

  async save(changes: Partial<RuleReviewReport>): Promise<void> {
    this.report = { ...this.report, ...changes };
    this.lastSavedAt = Date.now();
    await this.reportStore.save(this.report);
  }

  async saveProgress(progress: RuleReviewReport["progress"]): Promise<void> {
    const isNewStage = progress.stage !== this.report.progress.stage;
    this.report = { ...this.report, progress };

    if (isNewStage || Date.now() - this.lastSavedAt >= PROGRESS_SAVE_INTERVAL_MS) {
      await this.save({});
    }
  }
}

function toHypothesisFinding(
  hypothesis: RuleHypothesis,
  kind: "new_rule" | "coverage_gap",
  transactionIdsByClientId: ReadonlyMap<string, string[]>,
): RuleReviewFinding {
  const clients = [...transactionIdsByClientId]
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(0, MAX_NEW_RULE_CLIENTS)
    .map(([clientId, transactionIds]) => ({
      clientId,
      transactionIds,
      nearMissCount: 0,
      distinctDays: 0,
      minDistance: null,
      seedLinks: [],
    }));

  return {
    id: `${kind}:${hypothesis.id}`,
    kind,
    rule: null,
    proposal: hypothesis.definition ? { definition: hypothesis.definition } : null,
    growth:
      kind === "new_rule"
        ? { baseClients: 0, addedClients: hypothesis.backtest?.clientCount ?? 0, capExceeded: false }
        : null,
    clients,
    evidence: {
      descriptionCs: hypothesis.descriptionCs,
      missingFeature: hypothesis.missingFeature,
      indicator: hypothesis.indicator,
      suggestedLegalBasis: hypothesis.suggestedLegalBasis,
      rationale: hypothesis.rationale,
      backtest: hypothesis.backtest,
    },
  };
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(
      () => reject(new LlmWallClockExceededError(`LLM wall clock of ${timeoutMs} ms exceeded`)),
      timeoutMs,
    );
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
