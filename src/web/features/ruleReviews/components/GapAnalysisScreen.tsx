"use client";

import { ScanSearch } from "lucide-react";
import Link from "next/link";

import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import tableStyles from "@/components/ui/DataTable.module.css";
import { Notice } from "@/components/ui/Notice";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState, ErrorState, QueryView } from "@/components/ui/StateViews";
import { useRolePermissions } from "@/features/users/api/hooks";
import { RoleGateNotice } from "@/features/users/components/RoleGateNotice";
import { useI18n } from "@/i18n/I18nProvider";
import { formatDateTime } from "@/lib/format";

import { useRuleReview, useRuleReviews, useRuleReviewsCapabilities, useStartRuleReview } from "../api/hooks";
import { selectReviewId } from "../domain/findingGroups";
import type { RuleReviewStatus, RuleReviewSummary } from "../types";
import styles from "./GapAnalysis.module.css";
import { RuleReviewReportView } from "./RuleReviewReportView";

const STATUS_TONES: Record<RuleReviewStatus, BadgeTone> = {
  running: "ai",
  completed: "success",
  failed: "danger",
};

function ReviewList({ reviews, selectedId }: { reviews: RuleReviewSummary[]; selectedId: string | null }) {
  const { t, locale } = useI18n();
  if (reviews.length === 0) {
    return <EmptyState message={t.ruleReviews.noReviews} />;
  }
  return (
    <div className={tableStyles.wrapper}>
      <table className={tableStyles.table}>
        <thead>
          <tr>
            <th scope="col">{t.ruleReviews.startedAt}</th>
            <th scope="col">{t.common.status}</th>
            <th scope="col">{t.ruleReviews.findings}</th>
            <th scope="col">
              <span className="visually-hidden">{t.ruleReviews.show}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {reviews.map((review) => (
            <tr key={review.id} className={review.id === selectedId ? styles.selectedRow : undefined}>
              <td>{formatDateTime(review.startedAt, locale)}</td>
              <td>
                <Badge tone={STATUS_TONES[review.status]}>{t.ruleReviews.status[review.status]}</Badge>
              </td>
              <td className={tableStyles.secondaryText}>
                {(Object.keys(review.findingCounts) as (keyof typeof review.findingCounts)[])
                  .filter((kind) => review.findingCounts[kind] > 0)
                  .map((kind) => `${t.ruleReviews.kinds[kind]}: ${review.findingCounts[kind]}`)
                  .join(" · ") || "–"}
              </td>
              <td>
                {review.id === selectedId ? (
                  <span className={tableStyles.secondaryText}>{t.ruleReviews.showing}</span>
                ) : (
                  <Link href={`/rules/gap-analysis?review=${review.id}`}>{t.ruleReviews.show}</Link>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SelectedReview({ reviewId }: { reviewId: string }) {
  const reviewQuery = useRuleReview(reviewId);
  return <QueryView query={reviewQuery}>{(report) => <RuleReviewReportView report={report} />}</QueryView>;
}

function StartReviewButton({
  isAnyRunning,
  startReview,
}: {
  isAnyRunning: boolean;
  startReview: ReturnType<typeof useStartRuleReview>;
}) {
  const { t } = useI18n();
  return (
    <Button
      icon={<ScanSearch aria-hidden="true" />}
      disabled={isAnyRunning || startReview.isPending}
      onClick={() => startReview.mutate()}
    >
      {startReview.isPending ? t.ruleReviews.starting : t.ruleReviews.startReview}
    </Button>
  );
}

export function GapAnalysisScreen({ requestedReviewId }: { requestedReviewId: string | null }) {
  const { t } = useI18n();
  const { canManageRules } = useRolePermissions();
  const { canStartReview } = useRuleReviewsCapabilities();
  const reviewsQuery = useRuleReviews();
  const startReview = useStartRuleReview();
  const reviews = reviewsQuery.data ?? [];
  const isAnyRunning = reviews.some((review) => review.status === "running");
  const selectedId = selectReviewId(reviews, startReview.data?.id ?? requestedReviewId);

  return (
    <>
      <PageHeader
        title={t.ruleReviews.title}
        description={t.ruleReviews.subtitle}
        backLink={{ href: "/rules", label: t.ruleReviews.backToRules }}
        actions={
          canManageRules &&
          canStartReview && <StartReviewButton isAnyRunning={isAnyRunning} startReview={startReview} />
        }
      />
      {!canManageRules ? (
        <RoleGateNotice requiredRole="compliance_officer" />
      ) : (
        <div className={styles.stack}>
          <Notice tone="compliance">{t.ruleReviews.notice}</Notice>
          {startReview.isError && <ErrorState error={startReview.error} />}
          <Card title={t.ruleReviews.pastReviews}>
            <QueryView query={reviewsQuery}>
              {(loadedReviews) => <ReviewList reviews={loadedReviews} selectedId={selectedId} />}
            </QueryView>
          </Card>
          {selectedId !== null && <SelectedReview reviewId={selectedId} />}
        </div>
      )}
    </>
  );
}
