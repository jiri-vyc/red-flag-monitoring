// Calendar keys use the Date's local fields. Column `transactions.ts` is a timestamp without time zone, which
// the pg driver parses as local time, so local fields give back the stored wall-clock value (F2).
export const MILLISECONDS_PER_HOUR = 60 * 60 * 1000;
export const MILLISECONDS_PER_DAY = 24 * MILLISECONDS_PER_HOUR;

const DAYS_PER_WEEK = 7;
const THURSDAY = 4;

export function toDateKey(date: Date): string {
  return [date.getFullYear(), padTwoDigits(date.getMonth() + 1), padTwoDigits(date.getDate())].join("-");
}

export function toMonthKey(date: Date): string {
  return [date.getFullYear(), padTwoDigits(date.getMonth() + 1)].join("-");
}

export function toMonthStartDateKey(date: Date): string {
  return `${toMonthKey(date)}-01`;
}

// ISO 8601 week, e.g. "2026-W27". The week belongs to the year of its Thursday.
export function toIsoWeekKey(date: Date): string {
  const isoWeekday = date.getDay() === 0 ? DAYS_PER_WEEK : date.getDay();
  const thursday = new Date(date.getFullYear(), date.getMonth(), date.getDate() + THURSDAY - isoWeekday);
  const firstOfYear = new Date(thursday.getFullYear(), 0, 1);
  const dayOfYear = Math.round((thursday.getTime() - firstOfYear.getTime()) / MILLISECONDS_PER_DAY);
  const week = Math.floor(dayOfYear / DAYS_PER_WEEK) + 1;

  return `${thursday.getFullYear()}-W${padTwoDigits(week)}`;
}

// Whole months from `fromDateKey` to `toDateKey`, both "YYYY-MM-DD"; a month counts once its day is reached.
export function calculateFullMonthsBetween(fromDateKey: string, toDateKeyValue: string): number {
  const from = parseDateKey(fromDateKey);
  const to = parseDateKey(toDateKeyValue);
  const monthDifference = (to.year - from.year) * 12 + (to.month - from.month);

  return to.day < from.day ? monthDifference - 1 : monthDifference;
}

function parseDateKey(dateKey: string): { year: number; month: number; day: number } {
  const [year, month, day] = dateKey.split("-").map(Number);

  return { year: year ?? 0, month: month ?? 0, day: day ?? 0 };
}

function padTwoDigits(value: number): string {
  return String(value).padStart(2, "0");
}
