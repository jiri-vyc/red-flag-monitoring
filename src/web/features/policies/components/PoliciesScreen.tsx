"use client";

import Link from "next/link";

import tableStyles from "@/components/ui/DataTable.module.css";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState, QueryView } from "@/components/ui/StateViews";
import { RegulationLink } from "@/features/regulations/components/RegulationLink";
import { useI18n } from "@/i18n/I18nProvider";
import { formatDate } from "@/lib/format";

import { usePolicies } from "../api/hooks";
import type { Policy } from "../types";
import { PolicyOriginBadge, PolicyStatusBadge } from "./PolicyBadges";

function PoliciesTable({ policies }: { policies: Policy[] }) {
  const { t, locale } = useI18n();
  if (policies.length === 0) {
    return <EmptyState message={t.policies.empty} />;
  }
  return (
    <div className={`${tableStyles.wrapper} rf-slide-up`}>
      <table className={tableStyles.table}>
        <thead>
          <tr>
            <th scope="col">{t.common.name}</th>
            <th scope="col">{t.common.sourceRegulation}</th>
            <th scope="col">{t.common.status}</th>
            <th scope="col">{t.policies.origin}</th>
            <th scope="col" className={tableStyles.numeric}>
              {t.policies.rulesCount}
            </th>
            <th scope="col">{t.common.updated}</th>
          </tr>
        </thead>
        <tbody>
          {policies.map((policy) => (
            <tr key={policy.id}>
              <td>
                <Link href={`/policies/${policy.id}`} className={tableStyles.primaryCell}>
                  {policy.name}
                  <span className={tableStyles.secondaryText}>{policy.sourceProvision}</span>
                </Link>
              </td>
              <td>
                <RegulationLink regulationId={policy.regulationId} />
              </td>
              <td>
                <PolicyStatusBadge status={policy.status} />
              </td>
              <td>
                <PolicyOriginBadge origin={policy.origin} />
              </td>
              <td className={tableStyles.numeric}>{policy.ruleIds.length}</td>
              <td>{formatDate(policy.updatedAt, locale)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PoliciesScreen() {
  const { t } = useI18n();
  const policiesQuery = usePolicies();
  return (
    <>
      <PageHeader title={t.policies.title} description={t.policies.subtitle} />
      <QueryView query={policiesQuery}>{(policies) => <PoliciesTable policies={policies} />}</QueryView>
    </>
  );
}
