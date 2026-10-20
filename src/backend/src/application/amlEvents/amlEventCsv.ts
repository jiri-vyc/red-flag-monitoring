import type { AmlEventCsvRow } from "./amlEventReadModels";

// Column order of the mandatory FINREG output (knowledgebase/finreg/README.md, slide 09).
const CSV_COLUMNS = [
  "alert_id",
  "alert_type",
  "client_id",
  "transaction_id",
  "triage",
  "priority",
  "executive_role",
  "executive_person",
  "approver",
  "reason",
  "log",
] as const;

export function formatAmlEventsCsv(rows: readonly AmlEventCsvRow[]): string {
  const lines = rows.map((row) =>
    [
      row.alertId,
      row.alertType,
      row.clientId,
      row.transactionId,
      row.triage,
      row.priority,
      null,
      null,
      null,
      row.reason,
      row.log === null ? null : JSON.stringify(row.log),
    ]
      .map(toCsvField)
      .join(","),
  );

  return [CSV_COLUMNS.join(","), ...lines].join("\r\n") + "\r\n";
}

function toCsvField(value: string | number | null): string {
  if (value === null) {
    return "";
  }

  const text = String(value);

  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
