"use client";

import { useQueryClient } from "@tanstack/react-query";
import {
  Database,
  FileText,
  Flag,
  Layers,
  LayoutDashboard,
  ListChecks,
  RotateCcw,
  Scale,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { isAnyServiceMocked } from "@/config/apiMode";
import { CURRENT_USER } from "@/config/currentUser";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { DatabaseStatusPanel } from "@/features/databaseStatus/components/DatabaseStatusPanel";
import { useI18n } from "@/i18n/I18nProvider";
import type { Locale } from "@/i18n/dictionaries";
import { resetMockDatabase } from "@/mocks/store/mockDatabase";
import { useMockedServicesInUse } from "@/providers/MockUsageProvider";

import styles from "./Sidebar.module.css";

const NAVIGATION_ITEMS = [
  { href: "/", labelKey: "dashboard", Icon: LayoutDashboard },
  { href: "/regulations", labelKey: "regulations", Icon: Scale },
  { href: "/policies", labelKey: "policies", Icon: FileText },
  { href: "/rules", labelKey: "rules", Icon: ListChecks },
  { href: "/batches", labelKey: "batches", Icon: Layers },
] as const;

const LOCALE_OPTIONS: { value: Locale; label: string }[] = [
  { value: "en", label: "EN" },
  { value: "cs", label: "CZ" },
];

function isNavigationItemActive(itemHref: string, pathname: string): boolean {
  return itemHref === "/" ? pathname === "/" : pathname.startsWith(itemHref);
}

function MockDataPanel() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const mockedServicesInUse = useMockedServicesInUse();
  const [isResetDone, setIsResetDone] = useState(false);

  const resetDemoData = () => {
    if (!window.confirm(t.sidebar.resetConfirm)) {
      return;
    }
    resetMockDatabase();
    void queryClient.resetQueries();
    setIsResetDone(true);
    window.setTimeout(() => setIsResetDone(false), 2500);
  };

  return (
    <div className={styles.mockPanel}>
      {mockedServicesInUse.length > 0 && (
        <div className={styles.mockIndicator} role="status">
          <Database aria-hidden="true" />
          <div>
            <strong>{t.sidebar.mockIndicator}</strong>
            <p>{t.sidebar.mockIndicatorHint}</p>
          </div>
        </div>
      )}
      <button type="button" className={styles.resetButton} onClick={resetDemoData}>
        <RotateCcw aria-hidden="true" />
        {isResetDone ? t.sidebar.resetDone : t.sidebar.resetDemoData}
      </button>
    </div>
  );
}

export function Sidebar() {
  const { t, locale, changeLocale } = useI18n();
  const pathname = usePathname();

  return (
    <aside className={styles.sidebar}>
      <Link href="/" className={styles.brand}>
        <span className={styles.brandMark} aria-hidden="true">
          <Flag />
        </span>
        <span>
          <strong>{t.app.name}</strong>
          <small>{t.app.tagline}</small>
        </span>
      </Link>

      <nav aria-label={t.nav.mainNavigation} className={styles.navigation}>
        <ul>
          {NAVIGATION_ITEMS.map(({ href, labelKey, Icon }) => {
            const isActive = isNavigationItemActive(href, pathname);
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={`${styles.navLink} ${isActive ? styles.navLinkActive : ""}`}
                  aria-current={isActive ? "page" : undefined}
                >
                  <Icon aria-hidden="true" />
                  {t.nav[labelKey]}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className={styles.footer}>
        <DatabaseStatusPanel />
        {isAnyServiceMocked() && <MockDataPanel />}
        <div className={styles.footerRow}>
          <span className={styles.footerLabel}>{t.sidebar.language}</span>
          <SegmentedControl
            label={t.sidebar.language}
            options={LOCALE_OPTIONS}
            value={locale}
            onChange={changeLocale}
          />
        </div>
        <div className={styles.user}>
          <span className={styles.avatar} aria-hidden="true">
            <UserRound />
          </span>
          <span>
            <small>{t.sidebar.currentUser}</small>
            <strong>{CURRENT_USER.name}</strong>
            <small>{CURRENT_USER.role}</small>
          </span>
        </div>
      </div>
    </aside>
  );
}
