import { readFile } from "node:fs/promises";
import path from "node:path";

import type { MigrationInterface, QueryRunner } from "typeorm";

// V11: ČNB daily rates for 2025 and 2026 up to 2026-10-19, from the yearly files at
// https://www.cnb.cz/cs/financni-trhy/devizovy-trh/kurzy-devizoveho-trhu/kurzy-devizoveho-trhu/rok.txt?rok=<year>
// converted to CZK per one unit. Resolves to <repo>/datasets from both src/ and dist/.
const FX_RATES_FILE = path.resolve(__dirname, "../../../../../../datasets/cnb-fx-rates.csv");
const EXPECTED_RATE_COUNT = 13811;

type FxRateRow = { currency: string; rateDate: string; czkPerUnit: string };

export class SeedFxRates1792436164737 implements MigrationInterface {
  name = "SeedFxRates1792436164737";

  public async up(queryRunner: QueryRunner): Promise<void> {
    const rates = parseFxRates(await readFile(FX_RATES_FILE, "utf8"));

    if (rates.length !== EXPECTED_RATE_COUNT) {
      throw new Error(`Expected ${EXPECTED_RATE_COUNT} ČNB rates in ${FX_RATES_FILE}, found ${rates.length}`);
    }

    await queryRunner.query(
      `INSERT INTO "fx_rates" ("currency", "rate_date", "czk_per_unit", "source")
       SELECT "currency", "rate_date", "czk_per_unit", 'CNB'
       FROM unnest($1::text[], $2::date[], $3::numeric[]) AS rates("currency", "rate_date", "czk_per_unit")`,
      [
        rates.map((rate) => rate.currency),
        rates.map((rate) => rate.rateDate),
        rates.map((rate) => rate.czkPerUnit),
      ],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "fx_rates" WHERE "source" = 'CNB'`);
  }
}

// Rows are "currency;rate_date;czk_per_unit" after a header line.
function parseFxRates(csv: string): FxRateRow[] {
  return csv
    .split("\n")
    .slice(1)
    .filter((line) => line.trim() !== "")
    .map((line) => {
      const [currency = "", rateDate = "", czkPerUnit = ""] = line.trim().split(";");

      return { currency, rateDate, czkPerUnit };
    });
}
