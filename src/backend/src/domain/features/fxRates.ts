// V11: amounts convert to CZK with the ČNB rate valid on the transaction date.
export const BASE_CURRENCY = "CZK";

export type FxRate = { currency: string; rateDate: string; czkPerUnit: number };

// Rates per currency, sorted by rateDate ascending.
export type FxRateTable = ReadonlyMap<string, readonly FxRate[]>;

export class MissingFxRateError extends Error {
  constructor(currency: string, date: string) {
    super(`No ČNB rate for ${currency} on or before ${date}`);
  }
}

export function createFxRateTable(rates: readonly FxRate[]): FxRateTable {
  const ratesByCurrency = new Map<string, FxRate[]>();

  for (const rate of rates) {
    const currencyRates = ratesByCurrency.get(rate.currency) ?? [];
    currencyRates.push(rate);
    ratesByCurrency.set(rate.currency, currencyRates);
  }

  for (const currencyRates of ratesByCurrency.values()) {
    currencyRates.sort((left, right) => left.rateDate.localeCompare(right.rateDate));
  }

  return ratesByCurrency;
}

// ČNB publishes rates on business days only; a weekend or holiday uses the last published rate.
export function getFxRateOnDate(table: FxRateTable, currency: string, date: string): FxRate {
  const currencyRates = table.get(currency) ?? [];
  let lastRateOnOrBefore: FxRate | null = null;

  for (const rate of currencyRates) {
    if (rate.rateDate > date) {
      break;
    }

    lastRateOnOrBefore = rate;
  }

  if (!lastRateOnOrBefore) {
    throw new MissingFxRateError(currency, date);
  }

  return lastRateOnOrBefore;
}
