import {
  applyGuardrails,
  type ClientTriageCase,
  describeGuardrails,
  proposeRuleBasedTriage,
  summarizeClientMonths,
  type TriageAlert,
  type TriageProposal,
} from "../../domain/alertTriage";
import type { Client } from "../../domain/client";
import { toMonthKey } from "../../domain/features/calendar";
import { createFxRateTable } from "../../domain/features/fxRates";
import {
  type PricedTransaction,
  priceTransactionsChronologically,
} from "../../domain/features/pricedTransaction";
import type { Clock } from "../clock";
import { BusinessRuleViolationError, NotFoundError, toErrorMessage } from "../errors";
import type { EvaluationRunReadRepository } from "../evaluationRuns/evaluationRunReadRepository";
import type {
  AlertTriageLauncher,
  AlertTriageModel,
  AlertTriageRepository,
  LlmTriageRequest,
  NewAlertTriage,
  StoredTriageAlert,
  TriageInputData,
} from "./alertTriagePorts";

export type LlmTriageSummary = { triagedClients: number; failedClients: number; skippedClients: number };

export class AlertTriageUseCases {
  constructor(
    private readonly dependencies: {
      alertTriageRepository: AlertTriageRepository;
      evaluationRunReadRepository: EvaluationRunReadRepository;
      alertTriageModel: AlertTriageModel | null;
      alertTriageLauncher: AlertTriageLauncher | null;
      clock: Clock;
      llmConcurrency: number;
    },
  ) {}

  async triageRunWithRules(runId: string): Promise<number> {
    const { alertTriageRepository, clock } = this.dependencies;
    const triageCases = buildTriageCases(
      await alertTriageRepository.loadTriageInput({ runId, clientIds: null }),
    );
    const createdAt = clock();
    const triages = triageCases.flatMap((triageCase) =>
      proposeRuleBasedTriage(triageCase).map((proposal) =>
        toRuleTriage(findAlert(triageCase, proposal.amlEventId), proposal, createdAt),
      ),
    );

    await alertTriageRepository.saveRuleTriages(triages);

    return triages.length;
  }

  async retriageRunWithRules(runId: string): Promise<number> {
    await this.requireCompletedRun(runId);

    return this.triageRunWithRules(runId);
  }

  async triageClientsWithLlmNow(request: LlmTriageRequest): Promise<LlmTriageSummary> {
    this.requireLlm();
    await this.requireCompletedRun(request.runId);

    return this.triageRunWithLlm(request);
  }

  async startLlmTriage(request: LlmTriageRequest): Promise<void> {
    const launcher = this.requireLlm().launcher;

    await this.requireCompletedRun(request.runId);
    await launcher.launchLlmTriage(request);
  }

  // Clients the model already triaged are skipped, so a repeated call continues an interrupted triage.
  async triageRunWithLlm(request: LlmTriageRequest): Promise<LlmTriageSummary> {
    const { alertTriageRepository } = this.dependencies;
    const { model } = this.requireLlm();
    const [input, triagedClientIds] = await Promise.all([
      alertTriageRepository.loadTriageInput({ runId: request.runId, clientIds: request.clientIds }),
      alertTriageRepository.listClientIdsWithLlmTriage(request.runId),
    ]);
    const alreadyTriaged = new Set(triagedClientIds);
    const pendingCases = rankByPriority(buildTriageCases(input)).filter(
      ({ triageCase }) => !alreadyTriaged.has(triageCase.client.clientId),
    );
    const selectedCases = pendingCases.slice(0, request.clientLimit ?? pendingCases.length);
    let failedClients = 0;

    await runWithConcurrency(selectedCases, this.dependencies.llmConcurrency, async (entry) => {
      try {
        await this.triageClientWithLlm(request.runId, entry.triageCase, entry.proposals, model);
      } catch (error) {
        failedClients += 1;
        console.error(`[triage] client ${entry.triageCase.client.clientId} failed: ${toErrorMessage(error)}`);
      }
    });

    const summary = {
      triagedClients: selectedCases.length - failedClients,
      failedClients,
      skippedClients: alreadyTriaged.size,
    };
    console.log(`[triage] run ${request.runId} LLM triage done ${JSON.stringify(summary)}`);

    return summary;
  }

  private async triageClientWithLlm(
    runId: string,
    triageCase: ClientTriageCase,
    proposals: TriageProposal[],
    model: AlertTriageModel,
  ): Promise<void> {
    const result = await model.triageClient({ triageCase, proposals });
    const decisionsByAlertId = new Map(result.decisions.map((decision) => [decision.alertId, decision]));
    const createdAt = this.dependencies.clock();
    const triages = proposals.map((proposal) => {
      const alert = findAlert(triageCase, proposal.amlEventId);
      const decision = decisionsByAlertId.get(alert.alertId);

      if (!decision) {
        throw new MissingAlertDecisionError(`Model returned no decision for ${alert.alertId}`);
      }

      const { triage, isOverridden } = applyGuardrails(proposal, decision.triage);
      const reason = isOverridden
        ? `${decision.reason} [Model proposed FP; set to REVIEW because ${describeGuardrails(proposal.guardrails)}.]`
        : decision.reason;

      return {
        amlEventId: alert.amlEventId,
        source: "llm" as const,
        triage,
        priority: proposal.priority.priority,
        priorityFactors: proposal.priority.factors,
        reason,
        log: {
          ...createLogBase(alert, proposal, createdAt),
          source: "llm",
          rule_based_triage: proposal.triage,
          model_id: result.call.modelId,
          model_triage: decision.triage,
          overridden_by_guardrail: isOverridden,
          client_assessment: result.clientAssessment,
          input_tokens: result.call.inputTokens,
          output_tokens: result.call.outputTokens,
        },
      } satisfies NewAlertTriage;
    });

    await this.dependencies.alertTriageRepository.saveLlmTriages({
      call: { ...result.call, runId, clientId: triageCase.client.clientId },
      triages,
    });
  }

  private requireLlm(): { model: AlertTriageModel; launcher: AlertTriageLauncher } {
    const { alertTriageModel, alertTriageLauncher } = this.dependencies;

    if (!alertTriageModel || !alertTriageLauncher) {
      throw new BusinessRuleViolationError("LLM triage is off; set ALERT_TRIAGE=bedrock");
    }

    return { model: alertTriageModel, launcher: alertTriageLauncher };
  }

  private async requireCompletedRun(runId: string): Promise<void> {
    const run = (await this.dependencies.evaluationRunReadRepository.findRunSummary(runId))?.run;

    if (!run) {
      throw new NotFoundError("Evaluation run", runId);
    }

    if (run.status !== "completed") {
      throw new BusinessRuleViolationError(
        `Run ${runId} is ${run.status}; only a completed run can be triaged`,
      );
    }
  }
}

export class MissingAlertDecisionError extends Error {}

type RankedTriageCase = { triageCase: ClientTriageCase; proposals: TriageProposal[]; maxPriority: number };

function rankByPriority(triageCases: readonly ClientTriageCase[]): RankedTriageCase[] {
  return triageCases
    .map((triageCase) => {
      const proposals = proposeRuleBasedTriage(triageCase);
      const maxPriority = Math.max(...proposals.map(({ priority }) => priority.priority));

      return { triageCase, proposals, maxPriority };
    })
    .sort(
      (left, right) =>
        right.maxPriority - left.maxPriority ||
        left.triageCase.client.clientId.localeCompare(right.triageCase.client.clientId),
    );
}

export function buildTriageCases(input: TriageInputData): ClientTriageCase[] {
  const fxRateTable = createFxRateTable(input.fxRates);
  const clientsById = new Map(input.clients.map((client) => [client.clientId, client]));
  const transactionsByClient = groupBy(input.transactions, (transaction) => transaction.clientId);
  const alertsByClient = groupBy(input.alerts, (alert) => alert.clientId);
  const highRiskCountries = new Set(input.highRiskCountries);

  return [...alertsByClient].map(([clientId, storedAlerts]) => {
    const client = requireClient(clientsById, clientId);
    const pricedTransactions = priceTransactionsChronologically(
      transactionsByClient.get(clientId) ?? [],
      fxRateTable,
    );
    const pricedById = new Map(
      pricedTransactions.map((transaction) => [transaction.transactionId, transaction]),
    );

    return {
      client,
      alerts: storedAlerts.map((storedAlert) => toTriageAlert(storedAlert, pricedById)),
      activityByMonth: summarizeClientMonths(pricedTransactions),
      highRiskCountries,
    };
  });
}

function toTriageAlert(
  storedAlert: StoredTriageAlert,
  pricedById: ReadonlyMap<string, PricedTransaction>,
): TriageAlert {
  const hits = storedAlert.hits.map((storedHit) => {
    const transaction = pricedById.get(storedHit.transactionId);

    if (!transaction) {
      throw new Error(`Hit transaction ${storedHit.transactionId} of ${storedAlert.alertId} was not loaded`);
    }

    return {
      transactionId: transaction.transactionId,
      occurredAt: transaction.occurredAt,
      amountCzk: transaction.amountCzk,
      transactionType: transaction.transactionType,
      payerCountry: transaction.payerCountry,
      payeeCountry: transaction.payeeCountry,
      metConditionIds: storedHit.metConditionIds,
      traceSummary: storedHit.traceSummary,
    };
  });
  const firstHit = hits.reduce((earliest, hit) => (hit.occurredAt < earliest.occurredAt ? hit : earliest));

  return {
    amlEventId: storedAlert.amlEventId,
    alertId: storedAlert.alertId,
    ruleCode: storedAlert.ruleCode,
    ruleVersionId: storedAlert.ruleVersionId,
    ruleText: storedAlert.ruleText,
    alertType: storedAlert.alertType,
    transactionId: storedAlert.transactionId,
    periodMonth: storedAlert.periodMonth ?? toMonthKey(firstHit.occurredAt),
    maxScore: storedAlert.maxScore,
    anyConditionCount: storedAlert.anyConditionCount,
    hits,
  };
}

function toRuleTriage(alert: TriageAlert, proposal: TriageProposal, createdAt: Date): NewAlertTriage {
  return {
    amlEventId: alert.amlEventId,
    source: "rules",
    triage: proposal.triage,
    priority: proposal.priority.priority,
    priorityFactors: proposal.priority.factors,
    reason: proposal.reason,
    log: { ...createLogBase(alert, proposal, createdAt), source: "rules" },
  };
}

// The decision log of one alert (`log` in the mandatory CSV, vyhláška 67/2018 § 18).
function createLogBase(alert: TriageAlert, proposal: TriageProposal, createdAt: Date) {
  return {
    decided_at: createdAt.toISOString(),
    alert_id: alert.alertId,
    rule_code: alert.ruleCode,
    rule_version_id: alert.ruleVersionId,
    hit_count: alert.hits.length,
    triage_proposal: proposal.triage,
    priority: proposal.priority.priority,
    priority_factors: proposal.priority.factors.map(({ code, points }) => ({ code, points })),
    guardrails: proposal.guardrails,
    decision_aid_only: true,
  };
}

function findAlert(triageCase: ClientTriageCase, amlEventId: string): TriageAlert {
  const alert = triageCase.alerts.find((candidate) => candidate.amlEventId === amlEventId);

  if (!alert) {
    throw new Error(`Alert ${amlEventId} is not in the case of client ${triageCase.client.clientId}`);
  }

  return alert;
}

function requireClient(clientsById: ReadonlyMap<string, Client>, clientId: string): Client {
  const client = clientsById.get(clientId);

  if (!client) {
    throw new Error(`Client ${clientId} of an alert was not loaded`);
  }

  return client;
}

function groupBy<T>(items: readonly T[], keyOf: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();

  for (const item of items) {
    const key = keyOf(item);
    const group = groups.get(key);

    if (group) {
      group.push(item);
    } else {
      groups.set(key, [item]);
    }
  }

  return groups;
}

async function runWithConcurrency<T>(
  items: readonly T[],
  concurrency: number,
  work: (item: T) => Promise<void>,
): Promise<void> {
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (nextIndex < items.length) {
      const item = items[nextIndex];
      nextIndex += 1;

      if (item !== undefined) {
        await work(item);
      }
    }
  });

  await Promise.all(workers);
}
