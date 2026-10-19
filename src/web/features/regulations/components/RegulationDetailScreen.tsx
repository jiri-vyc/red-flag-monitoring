"use client";

import { ExternalLink, FileText, ListChecks, Sparkles } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { KeyValueList } from "@/components/ui/KeyValueList";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState, QueryView } from "@/components/ui/StateViews";
import { usePolicies } from "@/features/policies/api/hooks";
import { PolicyStatusBadge } from "@/features/policies/components/PolicyBadges";
import { useRules } from "@/features/rules/api/hooks";
import { RuleStatusBadge } from "@/features/rules/components/RuleBadges";
import { useI18n } from "@/i18n/I18nProvider";
import { formatDateTime } from "@/lib/format";

import { useRegulation } from "../api/hooks";
import type { Regulation } from "../types";
import styles from "./RegulationDetailScreen.module.css";

function RelatedPolicies({ regulation }: { regulation: Regulation }) {
  const { t } = useI18n();
  const policiesQuery = usePolicies();
  return (
    <Card
      title={
        <>
          <FileText aria-hidden="true" />
          {t.regulations.relatedPolicies}
        </>
      }
    >
      <QueryView query={policiesQuery}>
        {(policies) => {
          const relatedPolicies = policies.filter((policy) => regulation.policyIds.includes(policy.id));
          if (relatedPolicies.length === 0) {
            return <EmptyState message={t.regulations.noPolicies} />;
          }
          return (
            <ul className={styles.linkList}>
              {relatedPolicies.map((policy) => (
                <li key={policy.id}>
                  <Link href={`/policies/${policy.id}`}>{policy.name}</Link>
                  <PolicyStatusBadge status={policy.status} />
                </li>
              ))}
            </ul>
          );
        }}
      </QueryView>
    </Card>
  );
}

function RelatedRules({ regulation }: { regulation: Regulation }) {
  const { t } = useI18n();
  const rulesQuery = useRules();
  return (
    <Card
      title={
        <>
          <ListChecks aria-hidden="true" />
          {t.regulations.relatedRules}
        </>
      }
    >
      <QueryView query={rulesQuery}>
        {(rules) => {
          const relatedRules = rules.filter((rule) => regulation.ruleIds.includes(rule.id));
          if (relatedRules.length === 0) {
            return <EmptyState message={t.regulations.noRules} />;
          }
          return (
            <ul className={styles.linkList}>
              {relatedRules.map((rule) => (
                <li key={rule.id}>
                  <Link href={`/rules/${rule.id}`}>{rule.name}</Link>
                  <RuleStatusBadge status={rule.status} />
                </li>
              ))}
            </ul>
          );
        }}
      </QueryView>
    </Card>
  );
}

function RegulationDetail({ regulation }: { regulation: Regulation }) {
  const { t, locale } = useI18n();
  return (
    <>
      <PageHeader
        backLink={{ href: "/regulations", label: t.regulations.title }}
        title={regulation.shortName}
        meta={<Badge tone="primary">{t.jurisdiction[regulation.jurisdiction]}</Badge>}
        description={regulation.name}
        actions={
          <ButtonLink href={`/wizard?regulationId=${regulation.id}`} icon={<Sparkles aria-hidden="true" />}>
            {t.regulations.createRules}
          </ButtonLink>
        }
      />
      <Card>
        <p className={styles.description}>{regulation.description}</p>
        <KeyValueList
          items={[
            { label: t.regulations.version, value: regulation.version },
            { label: t.regulations.lastChecked, value: formatDateTime(regulation.lastCheckedAt, locale) },
            {
              label: t.regulations.source,
              value: regulation.sourceUrl ? (
                <a href={regulation.sourceUrl} target="_blank" rel="noreferrer" className={styles.sourceLink}>
                  {t.regulations.openSource}
                  <ExternalLink aria-hidden="true" />
                </a>
              ) : (
                t.regulations.noSource
              ),
            },
          ]}
        />
        <div className={styles.provisions}>
          <h3>{t.regulations.keyProvisions}</h3>
          <ul>
            {regulation.keyProvisions.map((provision) => (
              <li key={provision}>{provision}</li>
            ))}
          </ul>
        </div>
      </Card>
      <div className={styles.columns}>
        <RelatedPolicies regulation={regulation} />
        <RelatedRules regulation={regulation} />
      </div>
    </>
  );
}

export function RegulationDetailScreen({ regulationId }: { regulationId: string }) {
  const regulationQuery = useRegulation(regulationId);
  return (
    <QueryView query={regulationQuery}>
      {(regulation) => <RegulationDetail regulation={regulation} />}
    </QueryView>
  );
}
