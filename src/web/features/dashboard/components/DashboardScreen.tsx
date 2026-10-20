"use client";

import { ArrowRight, CircleCheck, Clock, FileText, Layers, Scale, Sparkles, Upload } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { AnimatedCounter } from "@/components/ui/AnimatedCounter";
import { EmptyState, QueryView } from "@/components/ui/StateViews";
import { useBatchesCapabilities } from "@/features/batches/api/hooks";
import { batchPath } from "@/features/batches/batchPaths";
import { BucketCountsInline } from "@/features/batches/components/BucketCountsInline";
import { formatLegalBasisRefs } from "@/features/regulations/types";
import { RuleStatusBadge, RuleTypeBadge } from "@/features/rules/components/RuleBadges";
import { findRuleLegalBases } from "@/features/rules/domain/ruleLifecycle";
import { useWizardCapabilities } from "@/features/wizard/api/hooks";
import { useI18n } from "@/i18n/I18nProvider";
import { formatDateTime } from "@/lib/format";
import { RoleGatedButtonLink } from "@/features/users/components/RoleGatedButton";

import { useDashboardSummary } from "../api/hooks";
import type { DashboardSummary } from "../types";
import styles from "./DashboardScreen.module.css";

type StatTileProps = {
  href: string;
  label: string;
  value: number;
  icon: ReactNode;
  tone: "primary" | "warning" | "ai" | "success";
};

function StatTile({ href, label, value, icon, tone }: StatTileProps) {
  return (
    <Link href={href} className={`${styles.statTile} ${styles[tone]}`}>
      <span className={styles.statIcon} aria-hidden="true">
        {icon}
      </span>
      <span className={styles.statValue}>
        <AnimatedCounter value={value} />
      </span>
      <span className={styles.statLabel}>{label}</span>
    </Link>
  );
}

function WizardCallToAction() {
  const { t } = useI18n();
  return (
    <section className={`${styles.cta} rf-slide-up`}>
      <div className={styles.ctaGlow} aria-hidden="true" />
      <span className={styles.ctaIcon} aria-hidden="true">
        <Sparkles />
      </span>
      <div className={styles.ctaText}>
        <h2>{t.dashboard.ctaTitle}</h2>
        <p>{t.dashboard.ctaBody}</p>
      </div>
      <RoleGatedButtonLink
        permission="canCreateRegulation"
        href="/wizard"
        size="lg"
        icon={<Sparkles aria-hidden="true" />}
      >
        {t.dashboard.ctaButton}
      </RoleGatedButtonLink>
    </section>
  );
}

function DashboardContent({ summary }: { summary: DashboardSummary }) {
  const { t, locale } = useI18n();
  const { canUploadBatch } = useBatchesCapabilities();
  return (
    <>
      <div className={`${styles.stats} rf-stagger`}>
        <StatTile
          href="/rules"
          label={t.dashboard.activeRules}
          value={summary.activeRuleCount}
          icon={<CircleCheck />}
          tone="success"
        />
        <StatTile
          href="/rules"
          label={t.dashboard.awaitingReview}
          value={summary.rulesAwaitingReviewCount}
          icon={<Clock />}
          tone="warning"
        />
        <StatTile
          href="/regulations"
          label={t.dashboard.regulations}
          value={summary.regulationCount}
          icon={<Scale />}
          tone="primary"
        />
        <StatTile
          href="/policies"
          label={t.dashboard.policies}
          value={summary.policyCount}
          icon={<FileText />}
          tone="ai"
        />
      </div>

      <div className={styles.columns}>
        <Card
          title={
            <>
              <Layers aria-hidden="true" />
              {t.dashboard.recentBatches}
            </>
          }
          actions={
            <ButtonLink href="/batches" variant="ghost" icon={<ArrowRight aria-hidden="true" />}>
              {t.dashboard.viewAll}
            </ButtonLink>
          }
        >
          {summary.recentBatches.length === 0 ? (
            <EmptyState message={canUploadBatch ? t.dashboard.noBatches : t.dashboard.noBatchesReadOnly} />
          ) : (
            <ul className={styles.list}>
              {summary.recentBatches.map((batch) => (
                <li key={batch.id}>
                  <Link href={batchPath(batch.id)} className={styles.listItem}>
                    <span className={styles.listMain}>
                      <strong>{batch.fileName}</strong>
                      <small>{formatDateTime(batch.uploadedAt, locale)}</small>
                    </span>
                    <BucketCountsInline counts={batch.counts} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card
          title={
            <>
              <Clock aria-hidden="true" />
              {t.dashboard.rulesNeedingReview}
            </>
          }
          actions={
            <ButtonLink href="/rules" variant="ghost" icon={<ArrowRight aria-hidden="true" />}>
              {t.dashboard.viewAll}
            </ButtonLink>
          }
        >
          {summary.rulesNeedingReview.length === 0 ? (
            <EmptyState message={t.dashboard.noRulesNeedingReview} />
          ) : (
            <ul className={styles.list}>
              {summary.rulesNeedingReview.map((rule) => (
                <li key={rule.id}>
                  <Link href={`/rules/${rule.id}`} className={styles.listItem}>
                    <span className={styles.listMain}>
                      <strong>{rule.name}</strong>
                      <small>{formatLegalBasisRefs(findRuleLegalBases(rule))}</small>
                    </span>
                    <span className={styles.badges}>
                      <RuleTypeBadge type={rule.type} />
                      <RuleStatusBadge status={rule.status} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

export function DashboardScreen() {
  const { t } = useI18n();
  const summaryQuery = useDashboardSummary();
  const { canUploadBatch } = useBatchesCapabilities();
  const { isAvailable: isWizardAvailable } = useWizardCapabilities();
  return (
    <>
      <PageHeader
        title={t.dashboard.title}
        description={t.dashboard.subtitle}
        actions={
          canUploadBatch && (
            <ButtonLink href="/batches" variant="secondary" icon={<Upload aria-hidden="true" />}>
              {t.dashboard.uploadBatch}
            </ButtonLink>
          )
        }
      />
      {isWizardAvailable && <WizardCallToAction />}
      <QueryView query={summaryQuery}>{(summary) => <DashboardContent summary={summary} />}</QueryView>
    </>
  );
}
