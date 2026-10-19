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

export function formatDate(isoDate: string, locale: Locale): string {
  return new Intl.DateTimeFormat(INTL_LOCALES[locale], { dateStyle: "medium" }).format(new Date(isoDate));
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
