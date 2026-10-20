import {
  type ClientTriageCase,
  describeGuardrails,
  describeProfileConsistency,
  formatCzk,
  INDIVIDUAL_REVIEW_PRIORITY,
  type TriageAlert,
  type TriageProposal,
} from "../../domain/alertTriage";

const SAMPLE_HITS_PER_ALERT = 5;
const RULE_TEXT_CHARACTERS = 600;
const Q2_MONTHS = 3;

export const ALERT_TRIAGE_SYSTEM_PROMPT = `You are the AI assistant of an AML analyst at a Czech regulated financial institution.
You prepare the triage of transaction-monitoring alerts under internal policy SVZ-03 čl. 8.3:

- For every alert propose "FP" (false positive: the activity is explained by the client's profile and history and
  nothing else raises suspicion) or "REVIEW" (a human must investigate).
- You do not decide. A human confirms or changes every proposal. Your reason is the basis of the decision log
  (vyhláška 67/2018 § 18), so it must be checkable.
- Ground every reason in concrete data from the input: field, value and, where useful, the policy provision.
  Never invent facts, documents or client explanations, and do not speculate about causes the data does not
  show (e.g. "seasonal business"). A reason without concrete grounds is unusable.
- See the whole story: all alerts of one client in the run are in front of you. Several scenarios, aggravating
  risk factors or a pattern across alerts (e.g. incoming funds forwarded quickly, many payers, structuring) point
  to REVIEW even when each alert alone looks minor.
- FP is right when the alert is explained by the client: volume and transaction sizes in line with the Q2 2026
  history or the projection at contract conclusion, a long relationship, low AML risk, no other scenario.
  Rule R-01 (profile mismatch) has the highest false-positive share; judge it against the client's own history.
- Alerts marked with guardrails must be REVIEW. Priority ${INDIVIDUAL_REVIEW_PRIORITY}+ does not forbid FP,
  but a human will confirm such an FP individually.
- The priority is computed deterministically from table P; do not recompute it, you may refer to it.
- Amounts are in CZK. Write each reason in English, 2 to 4 sentences, starting with the decisive grounds.
- client_assessment: one or two sentences on the client's whole story.`;

export function createAlertTriageUserPrompt(input: {
  triageCase: ClientTriageCase;
  proposals: readonly TriageProposal[];
}): string {
  const { triageCase, proposals } = input;
  const { client } = triageCase;
  const proposalsById = new Map(proposals.map((proposal) => [proposal.amlEventId, proposal]));

  const caseData = {
    client: {
      client_id: client.clientId,
      client_type: client.clientType,
      country: client.country,
      pep: client.isPep,
      aml_risk_score: client.amlRiskScore,
      contract_date: client.contractDate,
      contract_channel: client.contractChannel,
      projected_monthly_volume_czk: Math.round(Number(client.projectedMonthlyVolumeCzk)),
      projected_monthly_tx_count: client.projectedMonthlyTxCount,
      q2_2026: {
        volume_czk: Math.round(Number(client.q2VolumeCzk)),
        monthly_average_volume_czk: Math.round(Number(client.q2VolumeCzk) / Q2_MONTHS),
        tx_count: client.q2TxCount,
        monthly_average_tx_count: Math.round(client.q2TxCount / Q2_MONTHS),
        max_tx_czk: Math.round(Number(client.q2MaxTxCzk)),
      },
    },
    activity_by_month: Object.fromEntries(
      [...triageCase.activityByMonth].map(([month, activity]) => [
        month,
        {
          volume_czk: Math.round(activity.volumeCzk),
          tx_count: activity.txCount,
          max_tx_czk: Math.round(activity.maxTxCzk),
        },
      ]),
    ),
    alerts: triageCase.alerts.map((alert) =>
      describeAlert(triageCase, alert, proposalsById.get(alert.amlEventId)),
    ),
  };

  return `Triage every alert of this client. Return one decision per alert_id.\n\n${JSON.stringify(caseData, null, 2)}`;
}

function describeAlert(
  triageCase: ClientTriageCase,
  alert: TriageAlert,
  proposal: TriageProposal | undefined,
) {
  const totalHitCzk = alert.hits.reduce((sum, hit) => sum + hit.amountCzk, 0);
  const sampleHits = alert.hits
    .toSorted((left, right) => right.amountCzk - left.amountCzk)
    .slice(0, SAMPLE_HITS_PER_ALERT);

  return {
    alert_id: alert.alertId,
    rule: alert.ruleCode,
    alert_type: alert.alertType,
    rule_text: alert.ruleText.slice(0, RULE_TEXT_CHARACTERS),
    period_month: alert.periodMonth,
    hit_count: alert.hits.length,
    hit_volume_czk: formatCzk(totalHitCzk),
    profile_check: describeProfileConsistency(triageCase, alert.periodMonth).description,
    priority: proposal?.priority.priority,
    priority_factors: proposal?.priority.factors.map(({ label, points }) => `${label}: ${points}`),
    rule_based_proposal: proposal?.triage,
    guardrails: proposal && proposal.guardrails.length > 0 ? describeGuardrails(proposal.guardrails) : null,
    largest_hit_transactions: sampleHits.map((hit) => ({
      transaction_id: hit.transactionId,
      at: hit.occurredAt.toISOString(),
      type: hit.transactionType,
      amount_czk: Math.round(hit.amountCzk),
      payer_country: hit.payerCountry,
      payee_country: hit.payeeCountry,
      rule_trace: hit.traceSummary,
    })),
  };
}

export const alertTriageJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["client_assessment", "alerts"],
  properties: {
    client_assessment: { type: "string" },
    alerts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["alert_id", "triage", "reason"],
        properties: {
          alert_id: { type: "string" },
          triage: { type: "string", enum: ["FP", "REVIEW"] },
          reason: { type: "string" },
        },
      },
    },
  },
} as const;
