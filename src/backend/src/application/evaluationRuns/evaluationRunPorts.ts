import type { EvaluationRun, RunScope } from "../../domain/evaluation";
import type { RunRuleSet } from "../../domain/evaluateTransaction";
import type { EvaluatedTransaction, EvaluationDataset } from "../../domain/transactionEvaluator";

// Read side of the run input: what to evaluate and what to evaluate it with.
export interface EvaluationInputRepository {
  // Active approved versions of enabled deterministic rules. Agentic rules are not evaluated yet (#3).
  listRunnableRuleVersionIds(): Promise<string[]>;
  // M9: the latest version of every reference list.
  listLatestReferenceListVersionIds(): Promise<string[]>;
  // IDs of the transactions in scope, ordered by (ts, transaction_id).
  listScopedTransactionIds(scope: RunScope): Promise<string[]>;
  loadDataset(): Promise<EvaluationDataset>;
}

export type NewEvaluationRun = {
  scope: RunScope;
  fileName: string;
  fileSha256: string;
  transactionCount: number;
  hitThreshold: number;
  engineVersion: string;
  createdBy: string;
  ruleVersionIds: string[];
  referenceListVersionIds: string[];
};

// One evaluated transaction as stored: `ruleEvaluations` leaves out `pass` results (storage policy in
// EvaluationRunExecutor).
export type StoredTransactionEvaluation = EvaluatedTransaction & { sourceRowNo: number };

export type RunFailure = { runId: string; errorMessage: string; finishedAt: Date };

export interface EvaluationRunRepository {
  // Stores the run as `running` together with the fixed rule and reference list versions (V5).
  createRun(run: NewEvaluationRun): Promise<EvaluationRun>;
  findRun(runId: string): Promise<EvaluationRun | null>;
  // The fixed rule versions, their reference list items and the current whitelist of their rules.
  loadRunRuleSet(input: { runId: string; hitThreshold: number }): Promise<RunRuleSet>;
  // Inserts the evaluations and adds them to the run's progress counters in one transaction.
  appendTransactionEvaluations(input: {
    runId: string;
    evaluations: StoredTransactionEvaluation[];
  }): Promise<void>;
  markRunCompleted(input: { runId: string; finishedAt: Date }): Promise<void>;
  markRunFailed(failure: RunFailure): Promise<void>;
}

// Starts executing a created run somewhere: in this process or in a separate worker.
export interface EvaluationRunLauncher {
  launchRun(runId: string): Promise<void>;
}
