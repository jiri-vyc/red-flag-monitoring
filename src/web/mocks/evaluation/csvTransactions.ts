import type { Transaction } from "@/features/batches/types";

import { convertToCzk, hasDemoCzkRate } from "./fxRates";

export type CsvTransactionRow = {
  transactionId: string;
  clientId: string;
  /** dd.mm.yyyy */
  date: string;
  /** hh:mm:ss */
  time: string;
  volume: number;
  currency: string;
  payerCountry: string;
  payeeCountry: string;
  payerAccount: string;
  payeeAccount: string;
  transactionType: string;
};

export type ParsedTransactionsCsv = {
  rows: CsvTransactionRow[];
  fileRowCount: number;
  invalidRowCount: number;
};

export class CsvFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CsvFormatError";
  }
}

const COLUMN_HEADERS = {
  transactionId: "transaction ID",
  clientId: "client ID",
  date: "date",
  time: "time",
  volume: "volume",
  currency: "currency",
  payerCountry: "country of payer",
  payeeCountry: "country of payee",
  payerAccount: "account of payer",
  payeeAccount: "account of payee",
  transactionType: "type of transaction",
} as const;

type ColumnName = keyof typeof COLUMN_HEADERS;
type ColumnIndexes = Record<ColumnName, number>;

const BYTE_ORDER_MARK = "﻿";
const FIELD_SEPARATOR = ";";
const DATE_PATTERN = /^(\d{2})\.(\d{2})\.(\d{4})$/;
const TIME_PATTERN = /^(\d{2}):(\d{2})(?::(\d{2}))?$/;
const CURRENCY_PATTERN = /^[A-Z]{3}$/;
const DEFAULT_TIME = "00:00:00";
const DEFAULT_CURRENCY = "CZK";

/** Splits one line on semicolons, honouring double-quoted fields with "" escapes. */
export function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let currentField = "";
  let isInsideQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (isInsideQuotes && character === '"' && line[index + 1] === '"') {
      currentField += '"';
      index += 1;
    } else if (character === '"') {
      isInsideQuotes = !isInsideQuotes;
    } else if (character === FIELD_SEPARATOR && !isInsideQuotes) {
      fields.push(currentField);
      currentField = "";
    } else {
      currentField += character;
    }
  }
  fields.push(currentField);
  return fields.map((field) => field.trim());
}

function findColumnIndexes(headerFields: string[]): ColumnIndexes {
  const normalizedHeaders = headerFields.map((header) => header.toLowerCase());
  const entries = Object.entries(COLUMN_HEADERS).map(([columnName, header]) => {
    const columnIndex = normalizedHeaders.indexOf(header.toLowerCase());
    if (columnIndex === -1) {
      throw new CsvFormatError(`Missing column "${header}".`);
    }
    return [columnName, columnIndex] as const;
  });
  return Object.fromEntries(entries) as ColumnIndexes;
}

/** Accepts dd.mm.yyyy only when it names a real calendar day (rejects e.g. 31.02.). */
function isValidDate(date: string): boolean {
  const dateMatch = DATE_PATTERN.exec(date);
  if (!dateMatch) {
    return false;
  }
  const [day, month, year] = dateMatch.slice(1).map(Number);
  const parsedDate = new Date(Date.UTC(year, month - 1, day));
  return (
    parsedDate.getUTCFullYear() === year &&
    parsedDate.getUTCMonth() === month - 1 &&
    parsedDate.getUTCDate() === day
  );
}

/** Returns the time as hh:mm:ss, or null when it is not a valid 24h time. Empty input defaults to midnight. */
function normalizeTime(time: string): string | null {
  if (time === "") {
    return DEFAULT_TIME;
  }
  const timeMatch = TIME_PATTERN.exec(time);
  if (!timeMatch) {
    return null;
  }
  const [, hours, minutes, seconds = "00"] = timeMatch;
  const isInRange = Number(hours) <= 23 && Number(minutes) <= 59 && Number(seconds) <= 59;
  return isInRange ? `${hours}:${minutes}:${seconds}` : null;
}

/**
 * Returns an ISO 4217-shaped code the mock can convert to CZK, or null otherwise. Empty input defaults to CZK.
 * A currency without a demo rate is rejected so its amount is never converted with a made-up rate.
 */
function normalizeCurrency(currency: string): string | null {
  if (currency === "") {
    return DEFAULT_CURRENCY;
  }
  const upperCaseCurrency = currency.toUpperCase();
  const isKnownCurrency = CURRENCY_PATTERN.test(upperCaseCurrency) && hasDemoCzkRate(upperCaseCurrency);
  return isKnownCurrency ? upperCaseCurrency : null;
}

/** Returns the amount, or null when it is empty or not a finite number. Number("") would otherwise give 0. */
function parseVolume(volume: string): number | null {
  if (volume === "") {
    return null;
  }
  const parsedVolume = Number(volume.replace(",", "."));
  return Number.isFinite(parsedVolume) ? parsedVolume : null;
}

function mapFieldsToRow(fields: string[], columnIndexes: ColumnIndexes): CsvTransactionRow | null {
  const readField = (columnName: ColumnName) => fields[columnIndexes[columnName]] ?? "";
  const volume = parseVolume(readField("volume"));
  const time = normalizeTime(readField("time"));
  const currency = normalizeCurrency(readField("currency"));
  const isValid =
    readField("transactionId") !== "" && readField("clientId") !== "" && isValidDate(readField("date"));
  if (!isValid || volume === null || time === null || currency === null) {
    return null;
  }
  return {
    transactionId: readField("transactionId"),
    clientId: readField("clientId"),
    date: readField("date"),
    time,
    volume,
    currency,
    payerCountry: readField("payerCountry").toUpperCase(),
    payeeCountry: readField("payeeCountry").toUpperCase(),
    payerAccount: readField("payerAccount"),
    payeeAccount: readField("payeeAccount"),
    transactionType: readField("transactionType"),
  };
}

/**
 * Parses the vendor transaction CSV format. Only the first `maxRows` data rows are mapped; all are counted.
 * A repeated transaction ID keeps its first row; later ones count as invalid.
 */
export function parseTransactionsCsv(
  csvText: string,
  { maxRows }: { maxRows: number },
): ParsedTransactionsCsv {
  const lines = csvText.replace(BYTE_ORDER_MARK, "").split(/\r?\n/);
  const [headerLine, ...dataLines] = lines;
  if (!headerLine) {
    throw new CsvFormatError("The file is empty.");
  }
  const columnIndexes = findColumnIndexes(parseCsvLine(headerLine));
  const nonEmptyLines = dataLines.filter((line) => line.trim() !== "");

  const rows: CsvTransactionRow[] = [];
  const seenTransactionIds = new Set<string>();
  let invalidRowCount = 0;
  for (const line of nonEmptyLines.slice(0, maxRows)) {
    const row = mapFieldsToRow(parseCsvLine(line), columnIndexes);
    if (row && !seenTransactionIds.has(row.transactionId)) {
      seenTransactionIds.add(row.transactionId);
      rows.push(row);
    } else {
      invalidRowCount += 1;
    }
  }
  return { rows, fileRowCount: nonEmptyLines.length, invalidRowCount };
}

function formatBookedAt({ date, time }: { date: string; time: string }): string {
  const dateMatch = DATE_PATTERN.exec(date);
  if (!dateMatch) {
    return date;
  }
  const [, day, month, year] = dateMatch;
  return `${year}-${month}-${day}T${time}`;
}

export function mapCsvRowToTransaction(row: CsvTransactionRow): Transaction {
  return {
    transactionId: row.transactionId,
    clientId: row.clientId,
    bookedAt: formatBookedAt(row),
    amount: row.volume,
    currency: row.currency,
    amountCzk: convertToCzk({ amount: row.volume, currency: row.currency }),
    payerCountry: row.payerCountry,
    payeeCountry: row.payeeCountry,
    payerAccount: row.payerAccount,
    payeeAccount: row.payeeAccount,
    transactionType: row.transactionType,
  };
}
