import type { DataSource } from "typeorm";

import type { Client } from "../../../domain/client";
import type { RunScope } from "../../../domain/evaluation";
import type { FxRate } from "../../../domain/features/fxRates";
import type { Transaction } from "../../../domain/transaction";
import type { EvaluationDataset } from "../../../domain/transactionEvaluator";
import type { EvaluationInputRepository } from "../../../application/evaluationRuns/evaluationRunPorts";

const LIST_RUNNABLE_RULE_VERSION_IDS = `
  -- Active approved versions of enabled deterministic rules: the rule set of a new run (V5)
  SELECT rv."id"
  FROM "rules" r
  JOIN "rule_versions" rv ON rv."id" = r."active_version_id"
  WHERE r."enabled" AND r."kind" = 'deterministic' AND rv."status" = 'approved'
  ORDER BY r."code"
`;

const LIST_LATEST_REFERENCE_LIST_VERSION_IDS = `
  -- Latest version of every reference list (M9)
  SELECT DISTINCT ON ("list_id") "id"
  FROM "reference_list_versions"
  ORDER BY "list_id", "version_no" DESC
`;

const LIST_SCOPED_TRANSACTION_IDS = `
  -- Transactions a run evaluates, in chronological order; a null parameter does not filter
  SELECT "transaction_id" AS "transactionId"
  FROM "transactions"
  WHERE ($1::timestamp IS NULL OR "ts" >= $1::timestamp)
    AND ($2::timestamp IS NULL OR "ts" < $2::timestamp)
    AND ($3::text[] IS NULL OR "client_id" = ANY($3::text[]))
  ORDER BY "ts", "transaction_id"
  LIMIT $4
`;

// Aliases match the domain types, so rows need no mapping. Dates go out as text because pg parses `date`
// into a JavaScript Date at local midnight.
const LOAD_CLIENTS = `
  -- All clients, the static part of the feature context
  SELECT "client_id" AS "clientId", "country", to_char("contract_date", 'YYYY-MM-DD') AS "contractDate",
         "contract_channel" AS "contractChannel", "is_pep" AS "isPep", "client_type" AS "clientType",
         "projected_monthly_volume_czk" AS "projectedMonthlyVolumeCzk",
         "projected_monthly_tx_count" AS "projectedMonthlyTxCount", "q2_volume_czk" AS "q2VolumeCzk",
         "q2_tx_count" AS "q2TxCount", "q2_max_tx_czk" AS "q2MaxTxCzk", "aml_risk_score" AS "amlRiskScore"
  FROM "clients"
`;

const LOAD_TRANSACTIONS = `
  -- All transactions: client histories (V4) and the payee × day index of PR-03
  SELECT "transaction_id" AS "transactionId", "client_id" AS "clientId", "ts" AS "occurredAt", "amount",
         "currency", "payer_country" AS "payerCountry", "payee_country" AS "payeeCountry",
         "payer_account" AS "payerAccount", "payee_account" AS "payeeAccount", "tx_type" AS "transactionType",
         "counterparty_account" AS "counterpartyAccount", "counterparty_country" AS "counterpartyCountry"
  FROM "transactions"
`;

const LOAD_FX_RATES = `
  -- ČNB rates for the CZK conversion (V11)
  SELECT "currency", to_char("rate_date", 'YYYY-MM-DD') AS "rateDate", "czk_per_unit"::float8 AS "czkPerUnit"
  FROM "fx_rates"
`;

export class TypeOrmEvaluationInputRepository implements EvaluationInputRepository {
  constructor(private readonly dataSource: DataSource) {}

  async listRunnableRuleVersionIds(): Promise<string[]> {
    const rows = await this.dataSource.query<{ id: string }[]>(LIST_RUNNABLE_RULE_VERSION_IDS);

    return rows.map((row) => row.id);
  }

  async listLatestReferenceListVersionIds(): Promise<string[]> {
    const rows = await this.dataSource.query<{ id: string }[]>(LIST_LATEST_REFERENCE_LIST_VERSION_IDS);

    return rows.map((row) => row.id);
  }

  async listScopedTransactionIds(scope: RunScope): Promise<string[]> {
    const rows = await this.dataSource.query<{ transactionId: string }[]>(LIST_SCOPED_TRANSACTION_IDS, [
      scope.from,
      scope.to,
      scope.clientIds,
      scope.limit,
    ]);

    return rows.map((row) => row.transactionId);
  }

  async loadDataset(): Promise<EvaluationDataset> {
    const [clients, transactions, fxRates] = await Promise.all([
      this.dataSource.query<Client[]>(LOAD_CLIENTS),
      this.dataSource.query<Transaction[]>(LOAD_TRANSACTIONS),
      this.dataSource.query<FxRate[]>(LOAD_FX_RATES),
    ]);

    return { clients, transactions, fxRates };
  }
}
