"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

import { I18nProvider } from "@/i18n/I18nProvider";
import type { Locale } from "@/i18n/dictionaries";

import { ApiModeProvider } from "./ApiModeProvider";
import { MockUsageProvider } from "./MockUsageProvider";

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      // Failures surface immediately with a Retry action instead of silent background retries.
      queries: { retry: false, refetchOnWindowFocus: false, staleTime: 10_000 },
      mutations: { retry: false },
    },
  });
}

export function AppProviders({ initialLocale, children }: { initialLocale: Locale; children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);
  return (
    <QueryClientProvider client={queryClient}>
      <ApiModeProvider>
        <I18nProvider initialLocale={initialLocale}>
          <MockUsageProvider>{children}</MockUsageProvider>
        </I18nProvider>
      </ApiModeProvider>
    </QueryClientProvider>
  );
}
