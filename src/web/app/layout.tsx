import type { Metadata } from "next";
import { cookies } from "next/headers";

import { AppShell } from "@/components/layout/AppShell";
import { LOCALE_COOKIE_NAME, parseLocale } from "@/i18n/dictionaries";
import { AppProviders } from "@/providers/AppProviders";

import "./globals.css";

export const metadata: Metadata = {
  title: "RedFlag – AML monitoring",
  description: "AML transaction monitoring: rules from regulations, batch evaluation and red-flag triage.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const cookieStore = await cookies();
  const initialLocale = parseLocale(cookieStore.get(LOCALE_COOKIE_NAME)?.value);

  return (
    <html lang={initialLocale}>
      <body>
        <AppProviders initialLocale={initialLocale}>
          <AppShell>{children}</AppShell>
        </AppProviders>
      </body>
    </html>
  );
}
