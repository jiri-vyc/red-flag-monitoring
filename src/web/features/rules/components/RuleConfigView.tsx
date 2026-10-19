"use client";

import type { ReactNode } from "react";

import { Badge } from "@/components/ui/Badge";
import { useI18n } from "@/i18n/I18nProvider";

import { getChangedConfigFields } from "../domain/ruleLifecycle";
import { RULE_CONFIG_FIELDS, type RuleConfig, type RuleConfigField } from "../types";
import styles from "./RuleConfig.module.css";

function SensitivityValue({ sensitivity }: { sensitivity: number }) {
  return (
    <div className={styles.sensitivity}>
      <strong>{sensitivity}</strong>
      <span className={styles.sensitivityTrack} aria-hidden="true">
        <span style={{ width: `${sensitivity}%` }} />
      </span>
    </div>
  );
}

function ConfigFieldValue({ field, config }: { field: RuleConfigField; config: RuleConfig }) {
  const { t } = useI18n();
  switch (field) {
    case "sensitivity":
      return <SensitivityValue sensitivity={config.sensitivity} />;
    case "riskProfiles":
      return (
        <div className={styles.chips}>
          {config.riskProfiles.map((riskProfile) => (
            <Badge key={riskProfile} tone="primary">
              {t.riskProfile[riskProfile]}
            </Badge>
          ))}
        </div>
      );
  }
}

function BaseScoreItem({ baseScore }: { baseScore: number }) {
  const { t } = useI18n();
  return (
    <div className={styles.configItem}>
      <span className={styles.configLabel}>{t.rules.baseScore}</span>
      <strong className={styles.baseScoreValue}>{baseScore}</strong>
      <span className={styles.baseScoreHint}>{t.rules.baseScoreHint}</span>
    </div>
  );
}

type RuleConfigViewProps = {
  config: RuleConfig;
  /** Read-only base score of the shown version; hidden when null (agentic rules or unknown). */
  baseScore?: number | null;
  /** Config of a version awaiting review; changed fields are highlighted next to the running value. */
  pendingConfig?: RuleConfig | null;
};

export function RuleConfigView({ config, baseScore = null, pendingConfig = null }: RuleConfigViewProps) {
  const { t } = useI18n();
  const changedFields = pendingConfig ? getChangedConfigFields(config, pendingConfig) : [];
  const labels: Record<RuleConfigField, ReactNode> = {
    sensitivity: t.rules.sensitivity,
    riskProfiles: t.rules.riskProfiles,
  };

  return (
    <div className={styles.configGrid}>
      {RULE_CONFIG_FIELDS.map((field) => {
        const isChanged = changedFields.includes(field);
        return (
          <div key={field} className={`${styles.configItem} ${isChanged ? styles.configItemChanged : ""}`}>
            <span className={styles.configLabel}>{labels[field]}</span>
            <ConfigFieldValue field={field} config={config} />
            {isChanged && pendingConfig && (
              <div className={styles.pendingValue}>
                <span>
                  <Badge tone="warning">{t.rules.pendingChange}</Badge>
                </span>
                <ConfigFieldValue field={field} config={pendingConfig} />
              </div>
            )}
          </div>
        );
      })}
      {baseScore !== null && <BaseScoreItem baseScore={baseScore} />}
    </div>
  );
}
