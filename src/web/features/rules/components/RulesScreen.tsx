"use client";

import { Plus, ScanSearch } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import tableStyles from "@/components/ui/DataTable.module.css";
import { PageHeader } from "@/components/ui/PageHeader";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { EmptyState, QueryView } from "@/components/ui/StateViews";
import { PolicyLink } from "@/features/policies/components/PolicyLink";
import { LegalBasisList } from "@/features/regulations/components/LegalBasisList";
import { useI18n } from "@/i18n/I18nProvider";
import { RoleGatedButtonLink } from "@/features/users/components/RoleGatedButton";

import { useRules, useRulesCapabilities } from "../api/hooks";
import { findDescribingVersion } from "../domain/ruleLifecycle";
import { RULE_STATUSES, type Rule, type RuleStatus } from "../types";
import { RuleStatusBadge, RuleTypeBadge } from "./RuleBadges";
import styles from "./RulesScreen.module.css";

type StatusFilter = RuleStatus | "all";

/** The running version's sensitivity; rules that never ran show the proposed value of their latest version. */
function getDisplayedSensitivity(rule: Rule): number {
  return findDescribingVersion(rule).config.sensitivity;
}

function RulesTable({ rules }: { rules: Rule[] }) {
  const { t } = useI18n();
  if (rules.length === 0) {
    return <EmptyState message={t.rules.empty} />;
  }
  return (
    <div className={`${tableStyles.wrapper} rf-slide-up`}>
      <table className={tableStyles.table}>
        <thead>
          <tr>
            <th scope="col">{t.common.name}</th>
            <th scope="col">{t.common.type}</th>
            <th scope="col">{t.common.status}</th>
            <th scope="col" className={tableStyles.numeric}>
              {t.rules.sensitivity}
            </th>
            <th scope="col">{t.rules.policy}</th>
            <th scope="col">{t.rules.regulation}</th>
            <th scope="col">{t.rules.runningVersion}</th>
          </tr>
        </thead>
        <tbody>
          {rules.map((rule) => (
            <tr key={rule.id}>
              <td>
                <Link href={`/rules/${rule.id}`} className={tableStyles.primaryCell}>
                  {rule.name}
                </Link>
              </td>
              <td>
                <RuleTypeBadge type={rule.type} />
              </td>
              <td>
                <RuleStatusBadge status={rule.status} />
              </td>
              <td className={tableStyles.numeric}>{getDisplayedSensitivity(rule)}</td>
              <td>
                {rule.policyId === null ? (
                  <span className={tableStyles.secondaryText}>{t.rules.noPolicy}</span>
                ) : (
                  <PolicyLink policyId={rule.policyId} />
                )}
              </td>
              <td>
                <LegalBasisList
                  legalBases={findDescribingVersion(rule).legalBases}
                  emptyLabel={t.rules.noLegalBasis}
                />
              </td>
              <td className={tableStyles.secondaryText}>
                {rule.runningVersionNumber === null
                  ? t.rules.noRunningVersion
                  : `v${rule.runningVersionNumber}`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FilteredRules({ rules }: { rules: Rule[] }) {
  const { t } = useI18n();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const countByStatus = (status: RuleStatus) => rules.filter((rule) => rule.status === status).length;
  const filterOptions = [
    { value: "all" as const, label: `${t.common.all} (${rules.length})` },
    ...RULE_STATUSES.map((status) => ({
      value: status,
      label: `${t.ruleStatus[status]} (${countByStatus(status)})`,
    })),
  ];
  const visibleRules = statusFilter === "all" ? rules : rules.filter((rule) => rule.status === statusFilter);

  return (
    <>
      <div className={styles.filters}>
        <SegmentedControl<StatusFilter>
          label={t.rules.filterByStatus}
          options={filterOptions}
          value={statusFilter}
          onChange={setStatusFilter}
        />
      </div>
      <RulesTable rules={visibleRules} />
    </>
  );
}

export function RulesScreen() {
  const { t } = useI18n();
  const rulesQuery = useRules();
  const { canCreateDeterministicRule, canCreateAgenticRule } = useRulesCapabilities();
  return (
    <>
      <PageHeader
        title={t.rules.title}
        description={t.rules.subtitle}
        actions={
          <>
            <RoleGatedButtonLink
              permission="canManageRules"
              href="/rules/gap-analysis"
              variant="secondary"
              icon={<ScanSearch aria-hidden="true" />}
            >
              {t.rules.gapAnalysis}
            </RoleGatedButtonLink>
            {(canCreateDeterministicRule || canCreateAgenticRule) && (
              <RoleGatedButtonLink
                permission="canManageRules"
                href="/rules/new"
                icon={<Plus aria-hidden="true" />}
              >
                {t.rules.newRule}
              </RoleGatedButtonLink>
            )}
          </>
        }
      />
      <QueryView query={rulesQuery}>{(rules) => <FilteredRules rules={rules} />}</QueryView>
    </>
  );
}
