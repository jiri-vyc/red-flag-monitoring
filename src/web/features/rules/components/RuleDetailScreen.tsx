"use client";

import {
  ArrowRight,
  CircleCheck,
  CirclePause,
  CirclePlay,
  CircleX,
  GitBranch,
  Pencil,
  Send,
  Settings2,
} from "lucide-react";
import { useState, type ReactNode } from "react";

import { Badge } from "@/components/ui/Badge";
import { Button, type ButtonVariant } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, fieldStyles } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { PageHeader } from "@/components/ui/PageHeader";
import { ErrorState, QueryView } from "@/components/ui/StateViews";
import { PolicyLink } from "@/features/policies/components/PolicyLink";
import { RegulationLink } from "@/features/regulations/components/RegulationLink";
import { useI18n } from "@/i18n/I18nProvider";

import {
  useCreateRuleVersion,
  useRule,
  useRuleTransition,
  useUpdateDraftContent,
  type RuleTransitionAction,
} from "../api/hooks";
import {
  findPendingVersion,
  findRunningVersion,
  getAvailableRuleActions,
  getChangedConfigFields,
  getLatestVersion,
} from "../domain/ruleLifecycle";
import {
  toRuleConfigFormValues,
  validateRuleConfigForm,
  type RuleConfigFormErrors,
  type RuleConfigFormValues,
} from "../manualRuleForm";
import type { Rule, RuleContent } from "../types";
import { RuleStatusBadge, RuleTypeBadge } from "./RuleBadges";
import configStyles from "./RuleConfig.module.css";
import { RuleConfigFields } from "./RuleConfigFields";
import { RuleConfigView } from "./RuleConfigView";
import { RuleContentEditor } from "./RuleContentEditor";
import { RuleContentView } from "./RuleContentView";
import styles from "./RuleDetailScreen.module.css";
import { RuleVersionHistory } from "./RuleVersionHistory";
import { RuleWhitelistCard } from "./RuleWhitelistCard";

const TRANSITION_BUTTONS: Record<RuleTransitionAction, { variant: ButtonVariant; icon: ReactNode }> = {
  submit_for_review: { variant: "primary", icon: <Send aria-hidden="true" /> },
  approve: { variant: "success", icon: <CircleCheck aria-hidden="true" /> },
  reject: { variant: "danger", icon: <CircleX aria-hidden="true" /> },
  activate: { variant: "success", icon: <CirclePlay aria-hidden="true" /> },
  deactivate: { variant: "secondary", icon: <CirclePause aria-hidden="true" /> },
};

type EditorMode = "none" | "edit_draft" | "new_version";

function isTransitionAction(action: string): action is RuleTransitionAction {
  return action in TRANSITION_BUTTONS;
}

function RuleActions({ rule, onOpenEditor }: { rule: Rule; onOpenEditor: (mode: EditorMode) => void }) {
  const { t } = useI18n();
  const transitionMutation = useRuleTransition();
  const availableActions = getAvailableRuleActions(rule);
  const canEditDraft = rule.status === "draft";

  return (
    <div className={styles.actions}>
      <div className={styles.actionButtons}>
        {availableActions.filter(isTransitionAction).map((action) => (
          <Button
            key={action}
            variant={TRANSITION_BUTTONS[action].variant}
            icon={TRANSITION_BUTTONS[action].icon}
            disabled={transitionMutation.isPending}
            onClick={() => transitionMutation.mutate({ ruleId: rule.id, action })}
          >
            {t.rules.action[action]}
          </Button>
        ))}
        {canEditDraft && (
          <Button
            variant="secondary"
            icon={<Pencil aria-hidden="true" />}
            onClick={() => onOpenEditor("edit_draft")}
          >
            {t.rules.editDraft}
          </Button>
        )}
        {availableActions.includes("create_version") && (
          <Button
            variant="secondary"
            icon={<GitBranch aria-hidden="true" />}
            onClick={() => onOpenEditor("new_version")}
          >
            {t.rules.action.create_version}
          </Button>
        )}
      </div>
      {transitionMutation.isSuccess && (
        <p className={styles.successNote} role="status">
          {t.rules.actionDone}
        </p>
      )}
      {transitionMutation.error && <ErrorState error={transitionMutation.error} />}
    </div>
  );
}

/** Shows the config evaluations run with, and highlights fields a version awaiting review would change. */
function RuleConfiguration({ rule }: { rule: Rule }) {
  const { t } = useI18n();
  const runningVersion = findRunningVersion(rule);
  const pendingVersion = findPendingVersion(rule);
  const hasPendingConfigChange =
    runningVersion !== null &&
    pendingVersion !== null &&
    getChangedConfigFields(runningVersion.config, pendingVersion.config).length > 0;

  return (
    <Card
      title={
        <>
          <Settings2 aria-hidden="true" />
          {runningVersion
            ? `${t.rules.configuration} (v${runningVersion.versionNumber})`
            : `${t.rules.proposedConfiguration} (v${getLatestVersion(rule).versionNumber})`}
        </>
      }
      actions={
        hasPendingConfigChange &&
        pendingVersion && (
          <Badge tone="warning">{`${t.rules.pendingChange}: v${pendingVersion.versionNumber}`}</Badge>
        )
      }
    >
      {runningVersion ? (
        <RuleConfigView config={runningVersion.config} pendingConfig={pendingVersion?.config ?? null} />
      ) : (
        <RuleConfigView config={getLatestVersion(rule).config} />
      )}
      {hasPendingConfigChange && <Notice tone="info">{t.rules.pendingConfigNote}</Notice>}
      <Notice tone="compliance">{t.compliance.suppressionWarning}</Notice>
    </Card>
  );
}

function RuleSourceChain({ rule }: { rule: Rule }) {
  const { t } = useI18n();
  return (
    <div className={styles.sourceChain} aria-label={t.rules.sourceChain}>
      <RegulationLink regulationId={rule.regulationId} />
      <ArrowRight aria-hidden="true" />
      <PolicyLink policyId={rule.policyId} />
      <ArrowRight aria-hidden="true" />
      <span className={styles.provision}>{rule.sourceProvision}</span>
    </div>
  );
}

/** Any edit of content or config becomes a new version that goes to review; it is prefilled from the latest version. */
function NewVersionEditor({ rule, onClose }: { rule: Rule; onClose: () => void }) {
  const { t } = useI18n();
  const createVersionMutation = useCreateRuleVersion();
  const latestVersion = getLatestVersion(rule);
  const [changeNote, setChangeNote] = useState("");
  const [configValues, setConfigValues] = useState<RuleConfigFormValues>(() =>
    toRuleConfigFormValues(latestVersion.config),
  );
  const [configErrors, setConfigErrors] = useState<RuleConfigFormErrors>({});

  const updateConfigValues = (changes: Partial<RuleConfigFormValues>) =>
    setConfigValues((current) => ({ ...current, ...changes }));
  const submitVersion = (content: RuleContent) => {
    const configResult = validateRuleConfigForm(configValues);
    if (!configResult.isValid) {
      setConfigErrors(configResult.errors);
      return;
    }
    setConfigErrors({});
    createVersionMutation.mutate(
      { ruleId: rule.id, content, config: configResult.input, changeNote },
      { onSuccess: onClose },
    );
  };

  return (
    <Card title={t.rules.newVersionTitle}>
      <Notice tone="info">{t.rules.newVersionHint}</Notice>
      <RuleContentEditor
        idPrefix="rule-new-version"
        initialContent={latestVersion.content}
        submitLabel={t.rules.createVersion}
        isSubmitting={createVersionMutation.isPending}
        onSubmit={submitVersion}
        onCancel={onClose}
      >
        <RuleConfigFields
          idPrefix="rule-new-version"
          values={configValues}
          errors={configErrors}
          onChange={updateConfigValues}
        />
        <Field label={t.rules.changeNote} htmlFor="rule-change-note">
          <input
            id="rule-change-note"
            className={fieldStyles.input}
            value={changeNote}
            onChange={(event) => setChangeNote(event.target.value)}
          />
        </Field>
      </RuleContentEditor>
      {createVersionMutation.error && <ErrorState error={createVersionMutation.error} />}
    </Card>
  );
}

function DraftEditor({ rule, onClose }: { rule: Rule; onClose: () => void }) {
  const { t } = useI18n();
  const updateDraftMutation = useUpdateDraftContent();
  return (
    <Card title={t.rules.editDraft}>
      <RuleContentEditor
        idPrefix="rule-draft"
        initialContent={getLatestVersion(rule).content}
        submitLabel={t.rules.saveDraft}
        isSubmitting={updateDraftMutation.isPending}
        onSubmit={(content) =>
          updateDraftMutation.mutate({ ruleId: rule.id, content }, { onSuccess: onClose })
        }
        onCancel={onClose}
      />
      {updateDraftMutation.error && <ErrorState error={updateDraftMutation.error} />}
    </Card>
  );
}

function RuleDetail({ rule }: { rule: Rule }) {
  const { t } = useI18n();
  const [editorMode, setEditorMode] = useState<EditorMode>("none");
  const [selectedVersionNumber, setSelectedVersionNumber] = useState<number | null>(null);
  const latestVersion = getLatestVersion(rule);
  const selectedVersion =
    rule.versions.find((version) => version.versionNumber === selectedVersionNumber) ?? latestVersion;
  const closeEditor = () => setEditorMode("none");

  return (
    <>
      <PageHeader
        backLink={{ href: "/rules", label: t.rules.title }}
        title={rule.name}
        meta={
          <>
            <RuleStatusBadge status={rule.status} />
            <RuleTypeBadge type={rule.type} />
            <Badge>
              {t.rules.runningVersion}:{" "}
              {rule.runningVersionNumber === null
                ? t.rules.noRunningVersion
                : `v${rule.runningVersionNumber}`}
            </Badge>
          </>
        }
        description={rule.description}
      />
      <RuleSourceChain rule={rule} />
      {rule.status === "update_for_review" && <Notice tone="info">{t.rules.updateReviewNote}</Notice>}
      {rule.runningVersionNumber === null && <Notice tone="compliance">{t.rules.notExecutableNote}</Notice>}
      <RuleConfiguration rule={rule} />
      <RuleWhitelistCard rule={rule} />

      <Card title={t.rules.actions}>
        <RuleActions rule={rule} onOpenEditor={setEditorMode} />
      </Card>

      {editorMode === "new_version" && <NewVersionEditor rule={rule} onClose={closeEditor} />}
      {editorMode === "edit_draft" && <DraftEditor rule={rule} onClose={closeEditor} />}

      <Card
        tone="ai"
        title={`${t.common.version} ${selectedVersion.versionNumber}`}
        actions={
          selectedVersion.versionNumber === rule.runningVersionNumber && (
            <Badge tone="success">{t.rules.runningBadge}</Badge>
          )
        }
      >
        <RuleContentView content={selectedVersion.content} />
        <div>
          <h3 className={configStyles.sectionTitle}>{t.rules.versionConfiguration}</h3>
          <RuleConfigView config={selectedVersion.config} />
        </div>
        <Notice tone="ai" title={t.aiNotice.title}>
          {t.aiNotice.body}
        </Notice>
      </Card>

      <RuleVersionHistory
        rule={rule}
        selectedVersionNumber={selectedVersion.versionNumber}
        onSelectVersion={setSelectedVersionNumber}
      />
    </>
  );
}

export function RuleDetailScreen({ ruleId }: { ruleId: string }) {
  const ruleQuery = useRule(ruleId);
  return <QueryView query={ruleQuery}>{(rule) => <RuleDetail rule={rule} />}</QueryView>;
}
