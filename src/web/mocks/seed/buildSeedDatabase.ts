import { createRuleSnapshots, evaluateBatchRows } from "../evaluation/batchEvaluation";
import { mapCsvRowToTransaction } from "../evaluation/csvTransactions";
import type { MockBatchRecord, MockBatchRow, MockDatabase, MockSeed } from "../store/mockDatabase";
import { SEED_POLICIES } from "./policies";
import { SEED_REGULATIONS } from "./regulations";
import { SEED_RULES } from "./rules";
import { SEED_TRANSACTIONS } from "./transactions";
import { SEED_WHITELIST_ENTRIES } from "./whitelist";

const SEED_BATCH_DEFINITIONS = [
  {
    id: "batch-seed-0701",
    fileName: "transakce_2026-07-01.csv",
    uploadedAt: "2026-10-14T08:15:00.000Z",
    from: 0,
    to: 60,
  },
  {
    id: "batch-seed-0702",
    fileName: "transakce_2026-07-02.csv",
    uploadedAt: "2026-10-16T09:40:00.000Z",
    from: 60,
    to: 110,
  },
  {
    id: "batch-seed-risk",
    fileName: "vyber_rizikovych_klientu.csv",
    uploadedAt: "2026-10-18T13:05:00.000Z",
    from: 110,
    to: 150,
  },
];

const SEED_UPLOADER = "Jana Nováková";

/** Builds the deterministic initial demo state, including pre-evaluated batches. */
export function buildSeedDatabase(): MockSeed {
  const rules = SEED_RULES.map(({ rule }) => rule);
  const ruleCheckKinds = Object.fromEntries(SEED_RULES.map(({ rule, checkKind }) => [rule.id, checkKind]));
  const whitelistEntries = SEED_WHITELIST_ENTRIES;
  const ruleSnapshots = createRuleSnapshots({ rules, ruleCheckKinds, whitelistEntries });
  const transactions = SEED_TRANSACTIONS.map(mapCsvRowToTransaction);

  const batchRows: Record<string, MockBatchRow[]> = {};
  const batches: MockBatchRecord[] = SEED_BATCH_DEFINITIONS.map((definition) => {
    const rows = evaluateBatchRows(transactions.slice(definition.from, definition.to), ruleSnapshots);
    batchRows[definition.id] = rows;
    return {
      batch: {
        id: definition.id,
        fileName: definition.fileName,
        uploadedAt: definition.uploadedAt,
        uploadedBy: SEED_UPLOADER,
        fileRowCount: rows.length,
        evaluatedRowCount: rows.length,
        activeRuleCount: ruleSnapshots.length,
        failureReason: null,
      },
      startedAtMs: 0,
      durationMs: 0,
      ruleSnapshots,
    };
  });

  const database: MockDatabase = {
    regulations: SEED_REGULATIONS,
    policies: SEED_POLICIES,
    rules,
    ruleCheckKinds,
    whitelistEntries,
    batches,
  };
  return { database, batchRows };
}
