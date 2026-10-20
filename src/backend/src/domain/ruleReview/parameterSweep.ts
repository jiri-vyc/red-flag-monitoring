import type { DeterministicRunRuleVersion } from "../evaluateTransaction";
import type { RelaxableParameter, RelaxationStep } from "./relaxableParameters";
import type { GrowthCap, RelaxationCaps } from "./ruleReviewParams";
import type { FindingClient, ParameterProposal, RuleReviewFinding } from "./ruleReviewReport";

export type NearMiss = {
  clientId: string;
  transactionId: string;
  dateKey: string;
  stepIndex: number;
  distance: number;
  observedValue: number | null;
};

const MAX_TRACE_EXCERPTS = 10;

export const SWEEP_OUTCOMES = ["no_gap", "noise", "gap", "cap_exceeded"] as const;
export type SweepOutcome = (typeof SWEEP_OUTCOMES)[number];

export type ParameterSweep = {
  ruleVersion: DeterministicRunRuleVersion;
  parameter: RelaxableParameter;
  baseClients: number;
  steps: (RelaxationStep & { addedClients: number; addedHits: number })[];
  reportedStepIndex: number | null;
  outcome: SweepOutcome;
  clients: FindingClient[];
  traceExcerpts: {
    clientId: string;
    transactionId: string;
    observedValue: number | null;
    distance: number;
  }[];
};

export function calculateAllowedGrowth(baseClients: number, growthCap: GrowthCap): number {
  const relativeAllowance = Math.floor(growthCap.maxRelativeGrowth * baseClients);

  return Math.min(growthCap.maxAddedClients, Math.max(growthCap.minAddedClients, relativeAllowance));
}

export function summarizeSweep(input: {
  ruleVersion: DeterministicRunRuleVersion;
  parameter: RelaxableParameter;
  steps: RelaxationStep[];
  baseClientIds: ReadonlySet<string>;
  nearMisses: readonly NearMiss[];
  caps: RelaxationCaps;
  growthCap: GrowthCap;
}): ParameterSweep {
  const addedNearMisses = input.nearMisses.filter((nearMiss) => !input.baseClientIds.has(nearMiss.clientId));
  const firstStepByClient = findFirstStepByClient(addedNearMisses);
  const steps = input.steps.map((step, stepIndex) => ({
    ...step,
    addedClients: [...firstStepByClient.values()].filter((firstStep) => firstStep <= stepIndex).length,
    addedHits: addedNearMisses.filter((nearMiss) => nearMiss.stepIndex <= stepIndex).length,
  }));
  const reportedStepIndex = steps.findIndex((step) => step.addedClients > 0);
  const sweep = {
    ruleVersion: input.ruleVersion,
    parameter: input.parameter,
    baseClients: input.baseClientIds.size,
    steps,
  };

  if (reportedStepIndex === -1) {
    return { ...sweep, reportedStepIndex: null, outcome: "no_gap", clients: [], traceExcerpts: [] };
  }

  const addedClients = steps[reportedStepIndex]?.addedClients ?? 0;

  if (addedClients > calculateAllowedGrowth(input.baseClientIds.size, input.growthCap)) {
    return { ...sweep, reportedStepIndex, outcome: "cap_exceeded", clients: [], traceExcerpts: [] };
  }

  const reportedNearMisses = addedNearMisses.filter((nearMiss) => nearMiss.stepIndex <= reportedStepIndex);
  const clients = summarizeClients(reportedNearMisses);
  const isRepeated =
    clients.length >= input.caps.repetition.minClients ||
    clients.some((client) => client.distinctDays >= input.caps.repetition.minDistinctDays);

  return {
    ...sweep,
    reportedStepIndex,
    outcome: isRepeated ? "gap" : "noise",
    clients,
    traceExcerpts: selectTraceExcerpts(clients, reportedNearMisses),
  };
}

export function toSweepFinding(
  sweep: ParameterSweep,
  ruleLabel: string,
  relaxedDefinition: (stepIndex: number) => RuleReviewFinding["proposal"],
): RuleReviewFinding | null {
  if (sweep.reportedStepIndex === null || (sweep.outcome !== "gap" && sweep.outcome !== "cap_exceeded")) {
    return null;
  }

  const reportedStep = sweep.steps[sweep.reportedStepIndex];

  if (!reportedStep) {
    return null;
  }

  const { ruleVersion, parameter } = sweep;
  const isCapExceeded = sweep.outcome === "cap_exceeded";
  const parameterProposal: ParameterProposal = {
    parameter: parameter.key,
    parameterType: parameter.parameterType,
    currentValue: parameter.currentValue,
    proposedValue: reportedStep.value,
    step: reportedStep.step,
  };

  return {
    id: `${ruleVersion.ruleCode}:${parameter.key}`,
    kind: parameter.isRegulatory && !isCapExceeded ? "new_rule" : "rule_adjustment",
    rule: {
      ruleId: ruleVersion.ruleId,
      ruleVersionId: ruleVersion.ruleVersionId,
      code: ruleVersion.ruleCode,
      label: ruleLabel,
    },
    proposal: selectProposal({ isCapExceeded, parameter, parameterProposal, relaxedDefinition, sweep }),
    growth: {
      baseClients: sweep.baseClients,
      addedClients: reportedStep.addedClients,
      capExceeded: isCapExceeded,
    },
    clients: sweep.clients,
    evidence: {
      parameter: parameterProposal,
      parameterLabel: parameter.label,
      parameterSource: parameter.source,
      isRegulatory: parameter.isRegulatory,
      addedHits: reportedStep.addedHits,
      addedClientsByStep: sweep.steps.map(({ step, value, addedClients, addedHits }) => ({
        step,
        value,
        addedClients,
        addedHits,
      })),
      traceExcerpts: sweep.traceExcerpts,
      ...(isCapExceeded ? { reason: "growth cap exceeded" } : {}),
    },
  };
}

function selectProposal(input: {
  isCapExceeded: boolean;
  parameter: RelaxableParameter;
  parameterProposal: ParameterProposal;
  relaxedDefinition: (stepIndex: number) => RuleReviewFinding["proposal"];
  sweep: ParameterSweep;
}): RuleReviewFinding["proposal"] {
  if (input.isCapExceeded) {
    return null;
  }

  if (input.parameter.isRegulatory && input.sweep.reportedStepIndex !== null) {
    return input.relaxedDefinition(input.sweep.reportedStepIndex);
  }

  return input.parameterProposal;
}

function selectTraceExcerpts(
  clients: FindingClient[],
  nearMisses: readonly NearMiss[],
): ParameterSweep["traceExcerpts"] {
  return clients.slice(0, MAX_TRACE_EXCERPTS).flatMap((client) => {
    const closest = nearMisses
      .filter((nearMiss) => nearMiss.clientId === client.clientId)
      .sort((left, right) => left.distance - right.distance)[0];

    return closest
      ? [
          {
            clientId: closest.clientId,
            transactionId: closest.transactionId,
            observedValue: closest.observedValue,
            distance: closest.distance,
          },
        ]
      : [];
  });
}

function findFirstStepByClient(nearMisses: readonly NearMiss[]): Map<string, number> {
  const firstStepByClient = new Map<string, number>();

  for (const nearMiss of nearMisses) {
    const firstStep = firstStepByClient.get(nearMiss.clientId);

    if (firstStep === undefined || nearMiss.stepIndex < firstStep) {
      firstStepByClient.set(nearMiss.clientId, nearMiss.stepIndex);
    }
  }

  return firstStepByClient;
}

function summarizeClients(nearMisses: readonly NearMiss[]): FindingClient[] {
  const nearMissesByClient = new Map<string, NearMiss[]>();

  for (const nearMiss of nearMisses) {
    nearMissesByClient.set(nearMiss.clientId, [
      ...(nearMissesByClient.get(nearMiss.clientId) ?? []),
      nearMiss,
    ]);
  }

  return [...nearMissesByClient]
    .map(([clientId, clientNearMisses]) => ({
      clientId,
      transactionIds: clientNearMisses.map((nearMiss) => nearMiss.transactionId),
      nearMissCount: clientNearMisses.length,
      distinctDays: new Set(clientNearMisses.map((nearMiss) => nearMiss.dateKey)).size,
      minDistance: Math.min(...clientNearMisses.map((nearMiss) => nearMiss.distance)),
      seedLinks: [],
    }))
    .sort(
      (left, right) =>
        right.distinctDays - left.distinctDays ||
        (left.minDistance ?? 0) - (right.minDistance ?? 0) ||
        left.clientId.localeCompare(right.clientId),
    );
}
