"use client";

import { FileText, ListChecks } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Card } from "@/components/ui/Card";
import { KeyValueList } from "@/components/ui/KeyValueList";
import { Notice } from "@/components/ui/Notice";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState, QueryView } from "@/components/ui/StateViews";
import { LegalBasisList } from "@/features/regulations/components/LegalBasisList";
import { useRules } from "@/features/rules/api/hooks";
import { RuleStatusBadge, RuleTypeBadge } from "@/features/rules/components/RuleBadges";
import { formatMessage } from "@/i18n/dictionaries";
import { useI18n } from "@/i18n/I18nProvider";
import { formatDateTime } from "@/lib/format";

import { usePolicy } from "../api/hooks";
import type { Policy } from "../types";
import { PolicyOriginBadge, PolicyStatusBadge } from "./PolicyBadges";
import styles from "./PolicyDetailScreen.module.css";
import { PolicyTextEditor } from "./PolicyTextEditor";

function RelatedRules({ policy }: { policy: Policy }) {
  const { t } = useI18n();
  const rulesQuery = useRules();
  return (
    <Card
      title={
        <>
          <ListChecks aria-hidden="true" />
          {t.policies.relatedRules}
        </>
      }
    >
      <QueryView query={rulesQuery}>
        {(rules) => {
          const relatedRules = rules.filter((rule) => rule.policyId === policy.id);
          if (relatedRules.length === 0) {
            return <EmptyState message={t.policies.noRules} />;
          }
          return (
            <ul className={styles.ruleList}>
              {relatedRules.map((rule) => (
                <li key={rule.id}>
                  <Link href={`/rules/${rule.id}`}>{rule.name}</Link>
                  <span className={styles.badges}>
                    <RuleTypeBadge type={rule.type} />
                    <RuleStatusBadge status={rule.status} />
                  </span>
                </li>
              ))}
            </ul>
          );
        }}
      </QueryView>
    </Card>
  );
}

/** The backend drafts the policy's rules when it is approved; they still need their own review. */
function DraftedRulesNotice({ draftedRuleCount }: { draftedRuleCount: number }) {
  const { t } = useI18n();
  return (
    <Notice tone="ai" title={t.policies.approved}>
      {formatMessage(t.policies.draftedRules, { count: draftedRuleCount })}{" "}
      <Link href="/rules">{t.policies.reviewDraftedRules}</Link>
    </Notice>
  );
}

function PolicyDetail({ policy }: { policy: Policy }) {
  const { t, locale } = useI18n();
  const [draftedRuleCount, setDraftedRuleCount] = useState(0);
  const isDraft = policy.status === "draft";
  return (
    <>
      <PageHeader
        backLink={{ href: "/policies", label: t.policies.title }}
        title={policy.name}
        meta={
          <>
            <PolicyStatusBadge status={policy.status} />
            <PolicyOriginBadge origin={policy.origin} />
          </>
        }
      />
      {draftedRuleCount > 0 && <DraftedRulesNotice draftedRuleCount={draftedRuleCount} />}
      <Card tone={policy.origin === "generated" ? "ai" : "default"}>
        <KeyValueList
          items={[
            {
              label: t.common.legalBasis,
              value: <LegalBasisList legalBases={policy.legalBases} emptyLabel={t.policies.internalPolicy} />,
            },
            { label: t.common.updated, value: formatDateTime(policy.updatedAt, locale) },
            {
              label: t.policies.approvedBy,
              value:
                policy.approvedBy && policy.approvedAt
                  ? `${policy.approvedBy}, ${formatDateTime(policy.approvedAt, locale)}`
                  : "–",
            },
          ]}
        />
        {policy.origin === "generated" && (
          <Notice tone="ai" title={t.aiNotice.title}>
            {t.aiNotice.body}
          </Notice>
        )}
      </Card>
      <Card
        title={
          <>
            <FileText aria-hidden="true" />
            {t.policies.text}
          </>
        }
      >
        {isDraft ? (
          <>
            <Notice tone="info">{t.policies.editDraftHint}</Notice>
            <PolicyTextEditor
              key={policy.updatedAt}
              policy={policy}
              onApproved={({ draftedRuleIds }) => setDraftedRuleCount(draftedRuleIds.length)}
            />
          </>
        ) : (
          <div className={styles.text}>{policy.text}</div>
        )}
      </Card>
      <RelatedRules policy={policy} />
    </>
  );
}

export function PolicyDetailScreen({ policyId }: { policyId: string }) {
  const policyQuery = usePolicy(policyId);
  return <QueryView query={policyQuery}>{(policy) => <PolicyDetail policy={policy} />}</QueryView>;
}
