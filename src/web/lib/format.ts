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
