import {
  CsvFormatError,
  mapCsvRowToTransaction,
  parseCsvLine,
  parseTransactionsCsv,
} from "./csvTransactions";

const HEADER =
  "﻿transaction ID;client ID;date;time;volume;currency;country of payer;country of payee;account of payer;account of payee;type of transaction";

describe("parseTransactionsCsv", () => {
  it("parses rows of the vendor format including the byte order mark", () => {
    const csvText = `${HEADER}\r\nTX1;K1;01.07.2026;00:02:04;19889.43;EUR;CZ;AT;;AAT00116;remittance\r\n`;

    const parsed = parseTransactionsCsv(csvText, { maxRows: 10 });

    expect(parsed.fileRowCount).toBe(1);
    expect(parsed.rows[0]).toMatchObject({ transactionId: "TX1", volume: 19889.43, payeeCountry: "AT" });
  });

  it("counts all rows but maps only up to the cap", () => {
    const dataLines = ["TX1", "TX2", "TX3"].map(
      (id) => `${id};K1;01.07.2026;10:00:00;1;CZK;CZ;CZ;a;b;incoming payment`,
    );

    const parsed = parseTransactionsCsv([HEADER, ...dataLines].join("\n"), { maxRows: 2 });

    expect(parsed.fileRowCount).toBe(3);
    expect(parsed.rows).toHaveLength(2);
  });

  it("counts malformed rows as invalid", () => {
    const csvText = `${HEADER}\nTX1;K1;2026-07-01;10:00:00;abc;CZK;CZ;CZ;a;b;x`;

    expect(parseTransactionsCsv(csvText, { maxRows: 10 }).invalidRowCount).toBe(1);
  });

  it("normalizes hh:mm time to hh:mm:ss", () => {
    const csvText = `${HEADER}\nTX1;K1;01.07.2026;09:05;1;czk;CZ;CZ;a;b;x`;

    expect(parseTransactionsCsv(csvText, { maxRows: 10 }).rows[0]).toMatchObject({
      time: "09:05:00",
      currency: "CZK",
    });
  });

  it.each([
    ["an unpadded time", "01.07.2026;9:05:00;CZK"],
    ["an out-of-range time", "01.07.2026;25:00:00;CZK"],
    ["a time without separators", "01.07.2026;0905;CZK"],
    ["a non-ISO currency", "01.07.2026;10:00:00;Kč"],
    ["an impossible date", "31.02.2026;10:00:00;CZK"],
    ["a currency without a demo rate", "01.07.2026;10:00:00;XYZ"],
  ])("counts a row with %s as invalid", (_label, dateTimeCurrency) => {
    const [date, time, currency] = dateTimeCurrency.split(";");
    const csvText = `${HEADER}\nTX1;K1;${date};${time};1;${currency};CZ;CZ;a;b;x`;

    const parsed = parseTransactionsCsv(csvText, { maxRows: 10 });

    expect(parsed.rows).toHaveLength(0);
    expect(parsed.invalidRowCount).toBe(1);
  });

  it("counts a row with an empty amount as invalid instead of a zero amount", () => {
    const csvText = `${HEADER}\nTX1;K1;01.07.2026;10:00:00; ;CZK;CZ;CZ;a;b;x`;

    const parsed = parseTransactionsCsv(csvText, { maxRows: 10 });

    expect(parsed.rows).toHaveLength(0);
    expect(parsed.invalidRowCount).toBe(1);
  });

  it("keeps the first row of a repeated transaction ID and counts the rest as invalid", () => {
    const dataLines = ["TX1;100", "TX2;200", "TX1;300", "TX1;400"].map((idAndVolume) => {
      const [id, volume] = idAndVolume.split(";");
      return `${id};K1;01.07.2026;10:00:00;${volume};CZK;CZ;CZ;a;b;x`;
    });

    const parsed = parseTransactionsCsv([HEADER, ...dataLines].join("\n"), { maxRows: 10 });

    expect(parsed.rows.map((row) => [row.transactionId, row.volume])).toEqual([
      ["TX1", 100],
      ["TX2", 200],
    ]);
    expect(parsed.invalidRowCount).toBe(2);
  });

  it("fails when a required column is missing", () => {
    expect(() => parseTransactionsCsv("transaction ID;client ID\nTX1;K1", { maxRows: 10 })).toThrow(
      CsvFormatError,
    );
  });
});

describe("parseCsvLine", () => {
  it("keeps semicolons inside quoted fields", () => {
    expect(parseCsvLine('a;"b;c";"d ""e"""')).toEqual(["a", "b;c", 'd "e"']);
  });
});

describe("mapCsvRowToTransaction", () => {
  it("converts the date to ISO order and the amount to CZK", () => {
    const transaction = mapCsvRowToTransaction({
      transactionId: "TX1",
      clientId: "K1",
      date: "05.07.2026",
      time: "08:30:00",
      volume: 100,
      currency: "EUR",
      payerCountry: "CZ",
      payeeCountry: "AT",
      payerAccount: "",
      payeeAccount: "",
      transactionType: "remittance",
    });

    expect(transaction.bookedAt).toBe("2026-07-05T08:30:00");
    expect(transaction.amountCzk).toBe(2500);
  });

  it("refuses a currency without a demo rate instead of converting it 1:1", () => {
    expect(() =>
      mapCsvRowToTransaction({
        transactionId: "TX1",
        clientId: "K1",
        date: "05.07.2026",
        time: "08:30:00",
        volume: 100,
        currency: "XYZ",
        payerCountry: "CZ",
        payeeCountry: "AT",
        payerAccount: "",
        payeeAccount: "",
        transactionType: "remittance",
      }),
    ).toThrow("XYZ");
  });
});
