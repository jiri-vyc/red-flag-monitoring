import type { Locale } from "@/i18n/dictionaries";

const INTL_LOCALES: Record<Locale, string> = { en: "en-GB", cs: "cs-CZ" };

/** Falls back to the raw string for unparseable dates instead of letting Intl throw RangeError. */
export function formatDateTime(isoDate: string, locale: Locale): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return isoDate;
  }
  return new Intl.DateTimeFormat(INTL_LOCALES[locale], { dateStyle: "medium", timeStyle: "short" }).format(
    date,
  );
}

export function formatTime(isoDate: string, locale: Locale): string {
  return new Intl.DateTimeFormat(INTL_LOCALES[locale], { timeStyle: "medium" }).format(new Date(isoDate));
}

/** Same fallback as formatDateTime: an empty or unparseable value is returned as is. */
export function formatDate(isoDate: string, locale: Locale): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return isoDate;
  }
  return new Intl.DateTimeFormat(INTL_LOCALES[locale], { dateStyle: "medium" }).format(date);
}

export function formatNumber(value: number, locale: Locale): string {
  return new Intl.NumberFormat(INTL_LOCALES[locale]).format(value);
}

/** Joins alternatives the way the locale does: "A or B" / "A nebo B". */
export function formatAlternatives(items: string[], locale: Locale): string {
  return new Intl.ListFormat(INTL_LOCALES[locale], { type: "disjunction" }).format(items);
}

export function formatAmount({
  amount,
  currency,
  locale,
}: {
  amount: number;
  currency: string;
  locale: Locale;
}): string {
  try {
    return new Intl.NumberFormat(INTL_LOCALES[locale], {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch (error) {
    // Intl rejects unknown currency codes with RangeError; show the plain number with the raw code instead.
    if (error instanceof RangeError) {
      return `${formatNumber(amount, locale)} ${currency}`;
    }
    throw error;
  }
}

/** A running duration as m:ss or h:mm:ss. Negative input (client clock behind the server) shows 0:00. */
export function formatElapsedTime(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, "0")}:${seconds}` : `${minutes}:${seconds}`;
}

/** A duration as "1 h 5 min", "4 min 13 s" or "8 s"; the units read the same in English and Czech. */
export function formatDuration(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.round(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts = [
    hours > 0 && `${hours} h`,
    minutes > 0 && `${minutes} min`,
    seconds > 0 && `${seconds} s`,
  ].filter((part) => part !== false);
  return parts.length > 0 ? parts.join(" ") : "0 s";
}

function findEstimatePrecisionSeconds(totalSeconds: number): number {
  if (totalSeconds < 60) {
    return 1;
  }
  return totalSeconds < 600 ? 5 : 60;
}

/**
 * An estimated duration rounded to a precision it can honestly have: whole seconds under a minute, 5 s under
 * 10 minutes, whole minutes above. At least 1 s, so an estimate never reads as zero.
 */
export function formatApproximateDuration(milliseconds: number): string {
  const totalSeconds = Math.max(1, Math.round(milliseconds / 1000));
  const precisionSeconds = findEstimatePrecisionSeconds(totalSeconds);
  return formatDuration(Math.round(totalSeconds / precisionSeconds) * precisionSeconds * 1000);
}
