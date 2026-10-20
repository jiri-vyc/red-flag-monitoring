import type { EvaluationRun, RuleEvaluation } from "../../../domain/evaluation";
import type { EvaluationRunListItem } from "../../../application/evaluationRuns/evaluationRunReadModels";
import type { EvaluationRunEntity } from "../entities/EvaluationRunEntity";
import type { RuleEvaluationEntity } from "../entities/RuleEvaluationEntity";

export function toEvaluationRun(entity: EvaluationRunEntity): EvaluationRun {
  return { ...toEvaluationRunListItem(entity), importErrors: entity.importErrors };
}

export function toEvaluationRunListItem(entity: EvaluationRunEntity): EvaluationRunListItem {
  return {
    id: entity.id,
    status: entity.status,
    scope: entity.scope,
    fileName: entity.fileName,
    fileSha256: entity.fileSha256,
    rowsTotal: entity.rowsTotal,
    rowsImported: entity.rowsImported,
    rowsRejected: entity.rowsRejected,
    hitThreshold: entity.hitThreshold,
    engineVersion: entity.engineVersion,
    txProcessed: entity.txProcessed,
    txPassed: entity.txPassed,
    txFlagged: entity.txFlagged,
    txError: entity.txError,
    createdBy: entity.createdBy,
    createdAt: entity.createdAt,
    finishedAt: entity.finishedAt,
    errorMessage: entity.errorMessage,
  };
}

export function toRuleEvaluation(entity: RuleEvaluationEntity): RuleEvaluation {
  return {
    id: entity.id,
    transactionEvaluationId: entity.transactionEvaluationId,
    ruleVersionId: entity.ruleVersionId,
    outcome: entity.outcome,
    skipReason: entity.skipReason,
    rawScore: entity.rawScore,
    adjustedScore: entity.adjustedScore,
    features: entity.features,
    trace: entity.trace,
    contextRefs: entity.contextRefs,
    llmPrompt: entity.llmPrompt,
    llmResponse: entity.llmResponse,
    llmModelId: entity.llmModelId,
    errorMessage: entity.errorMessage,
  };
}
