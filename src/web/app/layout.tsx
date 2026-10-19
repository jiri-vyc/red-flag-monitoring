import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Red-flag monitoring",
  description: "AML transaction monitoring: rule evaluation, red-flag triage and escalation.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
