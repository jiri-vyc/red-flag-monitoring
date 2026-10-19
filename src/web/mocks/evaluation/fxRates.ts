// Illustrative fixed rates for the mock only. The real backend must use official rates (open question in the spec).
const DEMO_CZK_RATES: Record<string, number> = {
  CZK: 1,
  EUR: 25,
  USD: 23,
  GBP: 29.5,
  PLN: 5.8,
  CHF: 26,
  HUF: 0.064,
  CNY: 3.2,
  RON: 5,
  SEK: 2.2,
  DKK: 3.35,
  NOK: 2.15,
  JPY: 0.155,
  KRW: 0.017,
  TRY: 0.6,
  INR: 0.27,
  CAD: 16.8,
  AUD: 15.2,
  BRL: 4.2,
  MXN: 1.2,
  SGD: 17.2,
  ZAR: 1.25,
  ISK: 0.17,
};

export function convertToCzk({ amount, currency }: { amount: number; currency: string }): number {
  const rate = DEMO_CZK_RATES[currency] ?? 1;
  return Math.round(amount * rate * 100) / 100;
}
