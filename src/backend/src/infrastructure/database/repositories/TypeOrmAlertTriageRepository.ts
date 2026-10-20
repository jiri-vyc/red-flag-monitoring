import { randomUUID } from "node:crypto";

import type { DataSource, EntityManager } from "typeorm";

import type {
  AlertTriageRepository,
  NewAlertTriage,
  NewTriageLlmCall,
  StoredTriageAlert,
  TriageInputData,
} from "../../../application/alertTriage/alertTriagePorts";
import type { Client } from "../../../domain/client";
import type { FxRate } from "../../../domain/features/fxRates";
import type { Transaction } from "../../../domain/transaction";

const INSERT_CHUNK_SIZE = 5_000;
const HIGH_RISK_JURISDICTION_LIST_CODE = "HRJ";

const LOAD_RUN_ALERTS = `
  -- AML events of a run with their hits: the input of the triage (#14); a null client list loads all
  SELECT e."id" AS "amlEventId", e."alert_id" AS "alertId", e."client_id" AS "clientId", r."code" AS "ruleCode",
         e."rule_version_id" AS "ruleVersionId", rv."human_text" AS "ruleText", e."alert_type" AS "alertType",
         e."transaction_id" AS "transactionId", e."period_month" AS "periodMonth", e."max_score" AS "maxScore",
         -- The definition keys its operator as "match"; only the trace calls it "logic".
         CASE WHEN rv."definition" ->> 'match' = 'any'
              THEN jsonb_array_length(rv."definition" -> 'conditions') ELSE 0 END AS "anyConditionCount",
         jsonb_agg(jsonb_build_object(
           'transactionId', te."transaction_id",
           'metConditionIds', COALESCE(jsonb_path_query_array(re."trace", '$.conditions[*] ? (@.result == true).id'),
                                       '[]'::jsonb),
           'traceSummary', re."trace" ->> 'summary'
         )) AS "hits"
  FROM "aml_events" e
  JOIN "rules" r ON r."id" = e."rule_id"
  JOIN "rule_versions" rv ON rv."id" = e."rule_version_id"
  JOIN "aml_event_hits" h ON h."aml_event_id" = e."id"
  JOIN "rule_evaluations" re ON re."id" = h."rule_evaluation_id"
  JOIN "transaction_evaluations" te ON te."id" = re."transaction_evaluation_id"
  WHERE e."run_id" = $1 AND ($2::text[] IS NULL OR e."client_id" = ANY($2::text[]))
  GROUP BY e."id", r."code", rv."id"
  ORDER BY e."client_id", e."alert_id"
`;

const LOAD_CLIENTS = `
  -- Clients with an alert in the run
  SELECT "client_id" AS "clientId", "country", to_char("contract_date", 'YYYY-MM-DD') AS "contractDate",
         "contract_channel" AS "contractChannel", "is_pep" AS "isPep", "client_type" AS "clientType",
         "projected_monthly_volume_czk" AS "projectedMonthlyVolumeCzk",
         "projected_monthly_tx_count" AS "projectedMonthlyTxCount", "q2_volume_czk" AS "q2VolumeCzk",
         "q2_tx_count" AS "q2TxCount", "q2_max_tx_czk" AS "q2MaxTxCzk", "aml_risk_score" AS "amlRiskScore"
  FROM "clients"
  WHERE "client_id" = ANY($1::text[])
`;

const LOAD_TRANSACTIONS = `
  -- Every transaction of the clients with an alert: month activity and hit amounts
  SELECT "transaction_id" AS "transactionId", "client_id" AS "clientId", "ts" AS "occurredAt", "amount",
         "currency", "payer_country" AS "payerCountry", "payee_country" AS "payeeCountry",
         "payer_account" AS "payerAccount", "payee_account" AS "payeeAccount", "tx_type" AS "transactionType",
         "counterparty_account" AS "counterpartyAccount", "counterparty_country" AS "counterpartyCountry"
  FROM "transactions"
  WHERE "client_id" = ANY($1::text[])
`;

const LOAD_FX_RATES = `
  -- ČNB rates for the CZK conversion (V11)
  SELECT "currency", to_char("rate_date", 'YYYY-MM-DD') AS "rateDate", "czk_per_unit"::float8 AS "czkPerUnit"
  FROM "fx_rates"
`;

const LOAD_HIGH_RISK_COUNTRIES = `
  -- Countries of the high-risk jurisdiction list version the run fixed (M9)
  SELECT i."value"
  FROM "run_reference_list_versions" rrlv
  JOIN "reference_list_versions" v ON v."id" = rrlv."list_version_id"
  JOIN "reference_lists" l ON l."id" = v."list_id"
  JOIN "reference_list_items" i ON i."list_version_id" = v."id"
  WHERE rrlv."run_id" = $1 AND l."code" = $2
`;

const LIST_CLIENT_IDS_WITH_LLM_TRIAGE = `
  -- Clients of a run the model already triaged
  SELECT DISTINCT "client_id" AS "clientId" FROM "alert_triage_llm_calls" WHERE "run_id" = $1
`;

const INSERT_LLM_CALL = `
  -- One Bedrock triage call for one client
  INSERT INTO "alert_triage_llm_calls" (
    "id", "run_id", "client_id", "model_id", "system_prompt", "user_prompt", "response", "input_tokens",
    "output_tokens", "duration_ms"
  ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
`;

const INSERT_TRIAGES = `
  -- Triage proposals; an alert keeps its first proposal per source
  INSERT INTO "aml_event_triages" (
    "aml_event_id", "source", "triage", "priority", "priority_factors", "reason", "log", "llm_call_id"
  )
  SELECT batch."aml_event_id", batch."source", batch."triage", batch."priority", batch."priority_factors",
         batch."reason", batch."log", $8
  FROM unnest($1::uuid[], $2::text[], $3::text[], $4::int[], $5::jsonb[], $6::text[], $7::jsonb[])
    AS batch("aml_event_id", "source", "triage", "priority", "priority_factors", "reason", "log")
  ON CONFLICT ("aml_event_id", "source") DO NOTHING
`;

export class TypeOrmAlertTriageRepository implements AlertTriageRepository {
  constructor(private readonly dataSource: DataSource) {}

  async loadTriageInput(input: { runId: string; clientIds: string[] | null }): Promise<TriageInputData> {
    const [alerts, fxRates, highRiskRows] = await Promise.all([
      this.dataSource.query<StoredTriageAlert[]>(LOAD_RUN_ALERTS, [input.runId, input.clientIds]),
      this.dataSource.query<FxRate[]>(LOAD_FX_RATES),
      this.dataSource.query<{ value: string }[]>(LOAD_HIGH_RISK_COUNTRIES, [
        input.runId,
        HIGH_RISK_JURISDICTION_LIST_CODE,
      ]),
    ]);
    const clientIds = [...new Set(alerts.map((alert) => alert.clientId))];
    const [clients, transactions] = await Promise.all([
      this.dataSource.query<Client[]>(LOAD_CLIENTS, [clientIds]),
      this.dataSource.query<Transaction[]>(LOAD_TRANSACTIONS, [clientIds]),
    ]);

    return {
      alerts,
      clients,
      transactions,
      fxRates,
      highRiskCountries: highRiskRows.map((row) => row.value),
    };
  }

  async listClientIdsWithLlmTriage(runId: string): Promise<string[]> {
    const rows = await this.dataSource.query<{ clientId: string }[]>(LIST_CLIENT_IDS_WITH_LLM_TRIAGE, [
      runId,
    ]);

    return rows.map((row) => row.clientId);
  }

  saveRuleTriages(triages: NewAlertTriage[]): Promise<void> {
    return this.dataSource.transaction(async (manager) => {
      for (let offset = 0; offset < triages.length; offset += INSERT_CHUNK_SIZE) {
        await insertTriages(manager, triages.slice(offset, offset + INSERT_CHUNK_SIZE), null);
      }
    });
  }

  saveLlmTriages(input: { call: NewTriageLlmCall; triages: NewAlertTriage[] }): Promise<void> {
    const { call } = input;
    const callId = randomUUID();

    return this.dataSource.transaction(async (manager) => {
      await manager.query(INSERT_LLM_CALL, [
        callId,
        call.runId,
        call.clientId,
        call.modelId,
        call.systemPrompt,
        call.userPrompt,
        JSON.stringify(call.response),
        call.inputTokens,
        call.outputTokens,
        call.durationMs,
      ]);
      await insertTriages(manager, input.triages, callId);
    });
  }
}

async function insertTriages(manager: EntityManager, triages: NewAlertTriage[], llmCallId: string | null) {
  await manager.query(INSERT_TRIAGES, [
    triages.map((triage) => triage.amlEventId),
    triages.map((triage) => triage.source),
    triages.map((triage) => triage.triage),
    triages.map((triage) => triage.priority),
    triages.map((triage) => JSON.stringify(triage.priorityFactors)),
    triages.map((triage) => triage.reason),
    triages.map((triage) => JSON.stringify(triage.log)),
    llmCallId,
  ]);
}
