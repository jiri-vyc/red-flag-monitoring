"use client";

import { Plus } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import tableStyles from "@/components/ui/DataTable.module.css";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState, QueryView } from "@/components/ui/StateViews";
import { useWizardCapabilities } from "@/features/wizard/api/hooks";
import { useI18n } from "@/i18n/I18nProvider";
import { formatDate } from "@/lib/format";

import { useRegulations } from "../api/hooks";
import type { Regulation } from "../types";

function RegulationsTable({ regulations }: { regulations: Regulation[] }) {
  const { t, locale } = useI18n();
  if (regulations.length === 0) {
    return <EmptyState message={t.regulations.empty} />;
  }
  return (
    <div className={`${tableStyles.wrapper} rf-slide-up`}>
      <table className={tableStyles.table}>
        <thead>
          <tr>
            <th scope="col">{t.common.name}</th>
            <th scope="col">{t.regulations.jurisdiction}</th>
            <th scope="col">{t.regulations.version}</th>
            <th scope="col">{t.regulations.lastChecked}</th>
            <th scope="col" className={tableStyles.numeric}>
              {t.regulations.policiesCount}
            </th>
            <th scope="col" className={tableStyles.numeric}>
              {t.regulations.rulesCount}
            </th>
          </tr>
        </thead>
        <tbody>
          {regulations.map((regulation) => (
            <tr key={regulation.id}>
              <td>
                <Link href={`/regulations/${regulation.id}`} className={tableStyles.primaryCell}>
                  {regulation.shortName}
                  <span className={tableStyles.secondaryText}>{regulation.name}</span>
                </Link>
              </td>
              <td>
                <Badge tone="primary">{regulation.jurisdiction}</Badge>
              </td>
              <td className={tableStyles.secondaryText}>{regulation.version}</td>
              <td>{formatDate(regulation.lastCheckedAt, locale)}</td>
              <td className={tableStyles.numeric}>{regulation.policyIds.length}</td>
              <td className={tableStyles.numeric}>{regulation.ruleIds.length}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function RegulationsScreen() {
  const { t } = useI18n();
  const regulationsQuery = useRegulations();
  // A regulation is added only through the wizard, which generates its policy and rules.
  const { isAvailable: isWizardAvailable } = useWizardCapabilities();
  return (
    <>
      <PageHeader
        title={t.regulations.title}
        description={t.regulations.subtitle}
        actions={
          isWizardAvailable && (
            <ButtonLink href="/wizard" icon={<Plus aria-hidden="true" />}>
              {t.regulations.addRegulation}
            </ButtonLink>
          )
        }
      />
      <QueryView query={regulationsQuery}>
        {(regulations) => <RegulationsTable regulations={regulations} />}
      </QueryView>
    </>
  );
}
