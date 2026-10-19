"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

import { DICTIONARIES, LOCALE_COOKIE_NAME, type Dictionary, type Locale } from "./dictionaries";

type I18nContextValue = { locale: Locale; t: Dictionary; changeLocale: (locale: Locale) => void };

const I18nContext = createContext<I18nContextValue | null>(null);
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

function persistLocaleCookie(locale: Locale): void {
  document.cookie = `${LOCALE_COOKIE_NAME}=${locale}; path=/; max-age=${ONE_YEAR_SECONDS}; samesite=lax`;
}

/** The initial locale comes from the cookie on the server, so server and client render the same language. */
export function I18nProvider({ initialLocale, children }: { initialLocale: Locale; children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(initialLocale);

  const changeLocale = useCallback((nextLocale: Locale) => {
    persistLocaleCookie(nextLocale);
    document.documentElement.lang = nextLocale;
    setLocale(nextLocale);
  }, []);

  const contextValue = useMemo(
    () => ({ locale, t: DICTIONARIES[locale], changeLocale }),
    [locale, changeLocale],
  );

  return <I18nContext.Provider value={contextValue}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const contextValue = useContext(I18nContext);
  if (!contextValue) {
    throw new Error("useI18n must be used inside I18nProvider.");
  }
  return contextValue;
}
