import { cs } from "./cs";
import { en, type Dictionary } from "./en";

export const LOCALES = ["en", "cs"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE_NAME = "redflag-locale";

export const DICTIONARIES: Record<Locale, Dictionary> = { en, cs };

export function parseLocale(value: string | undefined): Locale {
  return LOCALES.find((locale) => locale === value) ?? DEFAULT_LOCALE;
}

/** Replaces {placeholder} tokens in a dictionary string. */
export function formatMessage(message: string, values: Record<string, string | number>): string {
  return message.replace(/\{(\w+)\}/g, (token, key: string) => String(values[key] ?? token));
}

export type { Dictionary };
