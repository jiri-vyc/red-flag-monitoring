"use client";

import { Eye, GitBranch } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import tableStyles from "@/components/ui/DataTable.module.css";
import { LegalBasisList } from "@/features/regulations/components/LegalBasisList";
import { VersionStateBadge } from "@/features/rules/components/RuleBadges";
import { useI18n } from "@/i18n/I18nProvider";
import { formatDateTime } from "@/lib/format";

import type { PolicyVersion } from "../types";

type PolicyVersionHistoryProps = {
  /** Oldest first, as on the policy. */
  versions: PolicyVersion[];
  selectedVersionNumber: number;
  onSelectVersion: (versionNumber: number) => void;
};

function AuthorCell({ name, at }: { name: string; at: string | null }) {
  const { locale } = useI18n();
  return (
    <span className={tableStyles.primaryCell}>
      {name}
      {at && <span className={tableStyles.secondaryText}>{formatDateTime(at, locale)}</span>}
    </span>
  );
}

/** Issue #5 (audit trail): who created and who reviewed each wording of the policy. */
export function PolicyVersionHistory({
  versions,
  selectedVersionNumber,
  onSelectVersion,
}: PolicyVersionHistoryProps) {
  const { t } = useI18n();
  const versionsNewestFirst = versions.toReversed();
  return (
    <Card
      title={
        <>
          <GitBranch aria-hidden="true" />
          {t.policies.versionHistory}
        </>
      }
    >
      <div className={tableStyles.wrapper}>
        <table className={tableStyles.table}>
          <thead>
            <tr>
              <th scope="col">{t.common.version}</th>
              <th scope="col">{t.common.status}</th>
              <th scope="col">{t.policies.createdVia}</th>
              <th scope="col">{t.common.legalBasis}</th>
              <th scope="col">{t.policies.createdBy}</th>
              <th scope="col">{t.policies.reviewedBy}</th>
              <th scope="col">{t.policies.reviewComment}</th>
              <th scope="col">
                <span className="visually-hidden">{t.common.open}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {versionsNewestFirst.map((version) => {
              const isSelected = version.versionNumber === selectedVersionNumber;
              return (
                <tr key={version.versionNumber}>
                  <td>
                    <strong>v{version.versionNumber}</strong>
                  </td>
                  <td>
                    <VersionStateBadge state={version.state} />
                  </td>
                  <td>{t.versionOrigin[version.createdVia]}</td>
                  <td>
                    <LegalBasisList legalBases={version.legalBases} emptyLabel={t.policies.internalPolicy} />
                  </td>
                  <td>
                    <AuthorCell name={version.createdBy} at={version.createdAt} />
                  </td>
                  <td>
                    {version.reviewedBy ? (
                      <AuthorCell name={version.reviewedBy} at={version.reviewedAt} />
                    ) : (
                      <span className={tableStyles.secondaryText}>{t.policies.notReviewed}</span>
                    )}
                  </td>
                  <td className={tableStyles.secondaryText}>{version.reviewComment}</td>
                  <td>
                    <Button
                      variant={isSelected ? "primary" : "ghost"}
                      icon={<Eye aria-hidden="true" />}
                      aria-pressed={isSelected}
                      onClick={() => onSelectVersion(version.versionNumber)}
                    >
                      {isSelected ? t.policies.viewing : t.common.open}
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
