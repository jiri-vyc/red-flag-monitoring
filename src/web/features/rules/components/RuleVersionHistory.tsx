"use client";

import { Eye, GitBranch } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import tableStyles from "@/components/ui/DataTable.module.css";
import { LegalBasisList } from "@/features/regulations/components/LegalBasisList";
import { useI18n } from "@/i18n/I18nProvider";
import { formatDateTime } from "@/lib/format";

import type { Rule, RuleVersion } from "../types";
import { VersionStateBadge } from "./RuleBadges";

type RuleVersionHistoryProps = {
  rule: Rule;
  selectedVersionNumber: number;
  onSelectVersion: (versionNumber: number) => void;
};

function VersionConfigSummary({ version }: { version: RuleVersion }) {
  const { t } = useI18n();
  const { config, baseScore } = version;
  const riskProfileLabels = config.riskProfiles.map((riskProfile) => t.riskProfile[riskProfile]).join(", ");
  return (
    <span className={tableStyles.primaryCell}>
      {t.rules.sensitivity} {config.sensitivity}
      {baseScore !== null && (
        <span className={tableStyles.secondaryText}>
          {t.rules.baseScore} {baseScore}
        </span>
      )}
      <span className={tableStyles.secondaryText}>{riskProfileLabels}</span>
    </span>
  );
}

export function RuleVersionHistory({
  rule,
  selectedVersionNumber,
  onSelectVersion,
}: RuleVersionHistoryProps) {
  const { t, locale } = useI18n();
  const versionsNewestFirst = [...rule.versions].reverse();
  return (
    <Card
      title={
        <>
          <GitBranch aria-hidden="true" />
          {t.rules.versionHistory}
        </>
      }
    >
      <div className={tableStyles.wrapper}>
        <table className={tableStyles.table}>
          <thead>
            <tr>
              <th scope="col">{t.common.version}</th>
              <th scope="col">{t.common.status}</th>
              <th scope="col">{t.rules.configColumn}</th>
              <th scope="col">{t.common.legalBasis}</th>
              <th scope="col">{t.rules.createdBy}</th>
              <th scope="col">{t.rules.approvedBy}</th>
              <th scope="col">{t.rules.changeNote}</th>
              <th scope="col">
                <span className="visually-hidden">{t.common.open}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {versionsNewestFirst.map((version) => (
              <tr key={version.versionNumber}>
                <td>
                  <strong>v{version.versionNumber}</strong>{" "}
                  {version.versionNumber === rule.runningVersionNumber && (
                    <Badge tone="success">{t.rules.runningBadge}</Badge>
                  )}
                </td>
                <td>
                  <VersionStateBadge state={version.state} />
                </td>
                <td>
                  <VersionConfigSummary version={version} />
                </td>
                <td>
                  <LegalBasisList legalBases={version.legalBases} emptyLabel={t.rules.noLegalBasis} />
                </td>
                <td>
                  <span className={tableStyles.primaryCell}>
                    {version.createdBy}
                    <span className={tableStyles.secondaryText}>
                      {formatDateTime(version.createdAt, locale)}
                    </span>
                  </span>
                </td>
                <td>
                  {version.reviewedBy && version.reviewedAt ? (
                    <span className={tableStyles.primaryCell}>
                      {version.reviewedBy}
                      <span className={tableStyles.secondaryText}>
                        {formatDateTime(version.reviewedAt, locale)}
                      </span>
                    </span>
                  ) : (
                    <span className={tableStyles.secondaryText}>{t.rules.pendingReviewer}</span>
                  )}
                </td>
                <td className={tableStyles.secondaryText}>{version.changeNote}</td>
                <td>
                  <Button
                    variant={version.versionNumber === selectedVersionNumber ? "primary" : "ghost"}
                    icon={<Eye aria-hidden="true" />}
                    aria-pressed={version.versionNumber === selectedVersionNumber}
                    onClick={() => onSelectVersion(version.versionNumber)}
                  >
                    {version.versionNumber === selectedVersionNumber ? t.rules.viewing : t.common.open}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
