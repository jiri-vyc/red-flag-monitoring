"use client";

import {
  CircleCheck,
  CirclePause,
  CirclePlay,
  CircleX,
  GitBranch,
  Pencil,
  Send,
  Settings2,
} from "lucide-react";
import { useId, useState, type ReactNode } from "react";

import { Badge } from "@/components/ui/Badge";
import { Button, type ButtonVariant } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, fieldStyles } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { PageHeader } from "@/components/ui/PageHeader";
import { ErrorState, QueryView } from "@/components/ui/StateViews";
import { PolicyLink } from "@/features/policies/components/PolicyLink";
import { LegalBasisList } from "@/features/regulations/components/LegalBasisList";
import { useI18n } from "@/i18n/I18nProvider";

import {
  useCreateRuleVersion,
  useRule,
  useRulesCapabilities,
  useRuleTransition,
  useUpdateDraftContent,
  type RuleTransitionAction,
} from "../api/hooks";
import {
  findPendingVersion,
  findRuleLegalBases,
  findRunningVersion,
  getAvailableRuleActions,
  getChangedConfigFields,
  getLatestVersion,
} from "../domain/ruleLifecycle";
import {
  parseBaseScore,
  toRuleConfigFormValues,
  validateRuleConfigForm,
  type RuleConfigFormErrors,
  type RuleConfigFormValues,
} from "../manualRuleForm";
import { useRolePermissions } from "@/features/users/api/hooks";
import { RoleGateNotice } from "@/features/users/components/RoleGateNotice";
import { RoleGatedButton } from "@/features/users/components/RoleGatedButton";
import type { UserRole } from "@/features/users/types";

import type { Rule, RuleContent } from "../types";
import { DeleteRuleAction } from "./DeleteRuleAction";
import { RuleStatusBadge, RuleTypeBadge } from "./RuleBadges";
import { EscalationRoleSelect } from "./EscalationRoleSelect";
import configStyles from "./RuleConfig.module.css";
import { RuleConfigFields } from "./RuleConfigFields";
import { RuleConfigView } from "./RuleConfigView";
import { RuleContentEditor } from "./RuleContentEditor";
import { RuleContentView } from "./RuleContentView";
import { RejectRulePanel } from "./RejectRulePanel";
import styles from "./RuleDetailScreen.module.css";
import { RuleVersionHistory } from "./RuleVersionHistory";
import { RuleWhitelistCard } from "./RuleWhitelistCard";

const TRANSITION_BUTTONS: Record<RuleTransitionAction, { variant: ButtonVariant; icon: ReactNode }> = {
  submit_for_review: { variant: "primary", icon: <Send aria-hidden="true" /> },
  approve: { variant: "success", icon: <CircleCheck aria-hidden="true" /> },
  activate: { variant: "success", icon: <CirclePlay aria-hidden="true" /> },
  deactivate: { variant: "secondary", icon: <CirclePause aria-hidden="true" /> },
};

type EditorMode = "none" | "edit_draft" | "new_version";

function isTransitionAction(action: string): action is RuleTransitionAction {
  return action in TRANSITION_BUTTONS;
}

/**
 * Temporary fallback until issue #8 (PATCH of a draft version): while a draft can't be edited in place, the review
 * is the only place to change the escalation role, so the review offers it and sends it with the decision.
 * Once drafts are editable, the role is edited in "Edit draft" and this goes away.
 */
function isEscalationRoleSetAtReview(rule: Rule, canEditDraftContent: boolean): boolean {
  const availableActions = getAvailableRuleActions(rule);
  const isReviewable = availableActions.includes("approve") || availableActions.includes("reject");
  return isReviewable && !canEditDraftContent;
}

function ActionGroup({ title, children }: { title: string; children: ReactNode }) {
  const titleId = useId();
  return (
    <div className={styles.actionGroup} role="group" aria-labelledby={titleId}>
      <h3 id={titleId} className={styles.actionGroupTitle}>
        {title}
      </h3>
      {children}
    </div>
  );
}

/** The role picked at review while drafts can't be edited (see isEscalationRoleSetAtReview); null when not offered. */
type ReviewEscalationRole = { value: UserRole; onChange: (role: UserRole) => void } | null;

/** Changes to the rule (edit draft, new version, delete) and, until issue #8, the role sent with the review. */
function RuleActionsCard({
  rule,
  reviewEscalationRole,
  onOpenEditor,
}: {
  rule: Rule;
  reviewEscalationRole: ReviewEscalationRole;
  onOpenEditor: (mode: EditorMode) => void;
}) {
  const { t } = useI18n();
  const { canEditDraftContent, canDeleteRule: isDeleteSupported } = useRulesCapabilities();
  const { canManageRules } = useRolePermissions();
  const escalationSelectId = useId();
  const canEditDraft = rule.status === "draft" && canEditDraftContent;
  const canCreateVersion = getAvailableRuleActions(rule).includes("create_version");
  // DeleteRuleAction renders (possibly as a blocked button) whenever the API supports deleting.
  const canOpenEditor = canEditDraft || canCreateVersion;
  const hasChangeActions = canOpenEditor || isDeleteSupported;

  if (!canManageRules) {
    // The only role notice for rule actions: the review card is not rendered for non-managers.
    return (
      <Card title={t.rules.actions}>
        <RoleGateNotice permission="canManageRules" />
      </Card>
    );
  }
  if (!hasChangeActions && reviewEscalationRole === null) {
    return null;
  }

  return (
    <Card title={t.rules.actions}>
      <div className={styles.actions}>
        {reviewEscalationRole && (
          <EscalationRoleSelect
            id={escalationSelectId}
            value={reviewEscalationRole.value}
            onChange={reviewEscalationRole.onChange}
          />
        )}
        {hasChangeActions && (
          <ActionGroup title={t.rules.changeActions}>
            {canOpenEditor && (
              <div className={styles.actionButtons}>
                {canEditDraft && (
                  <Button
                    variant="secondary"
                    icon={<Pencil aria-hidden="true" />}
                    onClick={() => onOpenEditor("edit_draft")}
                  >
                    {t.rules.editDraft}
                  </Button>
                )}
                {canCreateVersion && (
                  <Button
                    variant="secondary"
                    icon={<GitBranch aria-hidden="true" />}
                    onClick={() => onOpenEditor("new_version")}
                  >
                    {t.rules.action.create_version}
                  </Button>
                )}
              </div>
            )}
            <DeleteRuleAction rule={rule} />
          </ActionGroup>
        )}
      </div>
    </Card>
  );
}

/** Status transitions and the review decision; rendered only when the rule has one of them. */
function RuleReviewCard({ rule, escalationRole }: { rule: Rule; escalationRole: UserRole | null }) {
  const { t } = useI18n();
  const transitionMutation = useRuleTransition();
  const { canManageRules } = useRolePermissions();
  const [isRejecting, setIsRejecting] = useState(false);
  const [isRejectDone, setIsRejectDone] = useState(false);
  const availableActions = getAvailableRuleActions(rule);
  const transitionActions = availableActions.filter(isTransitionAction);
  const canReject = availableActions.includes("reject");
  const isBusy = transitionMutation.isPending || isRejecting;
  const isDecisionDone = transitionMutation.isSuccess || isRejectDone;
  const hasReviewActions = transitionActions.length > 0 || canReject;

  // The card stays for its confirmation even when the decision left no review action (a rejected new rule).
  if (!canManageRules || (!hasReviewActions && !isDecisionDone)) {
    return null;
  }

  return (
    <Card title={t.rules.reviewActions}>
      <div className={styles.actions}>
        {hasReviewActions && (
          <div className={styles.actionButtons}>
            {transitionActions.map((action) => (
              <Button
                key={action}
                variant={TRANSITION_BUTTONS[action].variant}
                icon={TRANSITION_BUTTONS[action].icon}
                disabled={isBusy}
                onClick={() => {
                  setIsRejectDone(false);
                  transitionMutation.mutate({
                    ruleId: rule.id,
                    action,
                    escalationRole: action === "approve" ? escalationRole : null,
                  });
                }}
              >
                {t.rules.action[action]}
              </Button>
            ))}
            {canReject && (
              <Button
                variant="danger"
                icon={<CircleX aria-hidden="true" />}
                disabled={isBusy}
                onClick={() => {
                  transitionMutation.reset();
                  setIsRejectDone(false);
                  setIsRejecting(true);
                }}
              >
                {t.rules.action.reject}
              </Button>
            )}
          </div>
        )}
        {isRejecting && (
          <RejectRulePanel
            ruleId={rule.id}
            escalationRole={escalationRole}
            onCancel={() => setIsRejecting(false)}
            onRejected={() => {
              setIsRejecting(false);
              setIsRejectDone(true);
            }}
          />
        )}
        {isDecisionDone && (
          <p className={styles.successNote} role="status">
            {t.rules.actionDone}
          </p>
        )}
        {transitionMutation.error && <ErrorState error={transitionMutation.error} />}
      </div>
    </Card>
  );
}

/** The edit of a draft's configuration from its card, or why it is missing while the API can't save it (issue #8). */
function useDraftConfigurationEdit(rule: Rule) {
  const { canEditDraftContent } = useRulesCapabilities();
  const { canManageRules } = useRolePermissions();
  const isDraft = rule.status === "draft";
  return {
    canEdit: isDraft && canEditDraftContent,
    isUnavailableInApi: isDraft && !canEditDraftContent && canManageRules,
  };
}

/** Shows the config evaluations run with, and highlights fields a version awaiting review would change. */
function RuleConfiguration({ rule, onEditDraft }: { rule: Rule; onEditDraft: () => void }) {
  const { t } = useI18n();
  const draftEdit = useDraftConfigurationEdit(rule);
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
        <>
          {hasPendingConfigChange && pendingVersion && (
            <Badge tone="warning">{`${t.rules.pendingChange}: v${pendingVersion.versionNumber}`}</Badge>
          )}
          {draftEdit.canEdit && (
            <RoleGatedButton
              permission="canManageRules"
              variant="secondary"
              icon={<Pencil aria-hidden="true" />}
              onClick={onEditDraft}
            >
              {t.common.edit}
            </RoleGatedButton>
          )}
        </>
      }
    >
      {runningVersion ? (
        <RuleConfigView
          config={runningVersion.config}
          baseScore={runningVersion.baseScore}
          pendingConfig={pendingVersion?.config ?? null}
        />
      ) : (
        <RuleConfigView config={getLatestVersion(rule).config} baseScore={getLatestVersion(rule).baseScore} />
      )}
      {hasPendingConfigChange && <Notice tone="info">{t.rules.pendingConfigNote}</Notice>}
      {draftEdit.isUnavailableInApi && <p className={styles.mutedHint}>{t.rules.editDraftUnavailable}</p>}
      <Notice tone="compliance">{t.compliance.suppressionWarning}</Notice>
    </Card>
  );
}

/** M4, M5: the policy is optional and the legal basis belongs to the running (else newest) version. */
function RuleSourceChain({ rule }: { rule: Rule }) {
  const { t } = useI18n();
  return (
    <div className={styles.sourceChain} aria-label={t.rules.sourceChain}>
      <span className={styles.sourceLabel}>{t.common.legalBasis}</span>
      <LegalBasisList legalBases={findRuleLegalBases(rule)} emptyLabel={t.rules.noLegalBasis} />
      <span className={styles.sourceLabel}>{t.rules.policy}</span>
      {rule.policyId === null ? (
        <span className={styles.noPolicy}>{t.rules.noPolicy}</span>
      ) : (
        <PolicyLink policyId={rule.policyId} />
      )}
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

/** Like the backend, only a deterministic rule has a base score; an agentic one has none. */
function BaseScoreField({
  value,
  hasError,
  onChange,
}: {
  value: string;
  hasError: boolean;
  onChange: (value: string) => void;
}) {
  const { t } = useI18n();
  const inputId = "rule-draft-base-score";
  return (
    <Field
      label={t.rules.baseScore}
      htmlFor={inputId}
      hint={t.rules.baseScoreHint}
      error={hasError ? t.ruleForm.validationBaseScore : null}
    >
      <input
        id={inputId}
        type="number"
        min={0}
        max={100}
        step={1}
        className={fieldStyles.input}
        value={value}
        aria-invalid={hasError}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  );
}

/** Edits the unreviewed version in place: content, config and base score, prefilled from that version. */
function DraftEditor({ rule, onClose }: { rule: Rule; onClose: () => void }) {
  const { t } = useI18n();
  const updateDraftMutation = useUpdateDraftContent();
  const draftVersion = getLatestVersion(rule);
  const hasBaseScore = draftVersion.content.type === "deterministic";
  const [configValues, setConfigValues] = useState<RuleConfigFormValues>(() =>
    toRuleConfigFormValues(draftVersion.config),
  );
  const [configErrors, setConfigErrors] = useState<RuleConfigFormErrors>({});
  const [baseScoreValue, setBaseScoreValue] = useState(() => draftVersion.baseScore?.toString() ?? "");
  const [hasBaseScoreError, setHasBaseScoreError] = useState(false);

  const updateConfigValues = (changes: Partial<RuleConfigFormValues>) =>
    setConfigValues((current) => ({ ...current, ...changes }));
  const saveDraft = (content: RuleContent) => {
    const configResult = validateRuleConfigForm(configValues);
    const baseScore = hasBaseScore ? parseBaseScore(baseScoreValue) : null;
    const isBaseScoreInvalid = hasBaseScore && baseScore === null;
    setConfigErrors(configResult.isValid ? {} : configResult.errors);
    setHasBaseScoreError(isBaseScoreInvalid);
    if (!configResult.isValid || isBaseScoreInvalid) {
      return;
    }
    updateDraftMutation.mutate(
      {
        ruleId: rule.id,
        content,
        config: configResult.input,
        ...(baseScore !== null && { baseScore }),
      },
      { onSuccess: onClose },
    );
  };

  return (
    <Card title={t.rules.editDraft}>
      <RuleContentEditor
        idPrefix="rule-draft"
        initialContent={draftVersion.content}
        submitLabel={t.rules.saveDraft}
        isSubmitting={updateDraftMutation.isPending}
        onSubmit={saveDraft}
        onCancel={onClose}
      >
        <RuleConfigFields
          idPrefix="rule-draft"
          values={configValues}
          errors={configErrors}
          onChange={updateConfigValues}
        />
        {hasBaseScore && (
          <BaseScoreField value={baseScoreValue} hasError={hasBaseScoreError} onChange={setBaseScoreValue} />
        )}
      </RuleContentEditor>
      {updateDraftMutation.error && <ErrorState error={updateDraftMutation.error} />}
    </Card>
  );
}

function RuleDetail({ rule, returnPath }: { rule: Rule; returnPath: string | null }) {
  const { t } = useI18n();
  const [editorMode, setEditorMode] = useState<EditorMode>("none");
  const [selectedVersionNumber, setSelectedVersionNumber] = useState<number | null>(null);
  const { canEditDraftContent } = useRulesCapabilities();
  const latestVersion = getLatestVersion(rule);
  // Shared by the select (actions card) and the decision (review card).
  // The pick belongs to one version: a refetch that brings a newer version starts again from that version's role.
  const [pickedRole, setPickedRole] = useState({
    versionNumber: latestVersion.versionNumber,
    role: latestVersion.config.escalationRole,
  });
  const escalationRole =
    pickedRole.versionNumber === latestVersion.versionNumber
      ? pickedRole.role
      : latestVersion.config.escalationRole;
  const setEscalationRole = (role: UserRole) =>
    setPickedRole({ versionNumber: latestVersion.versionNumber, role });
  const isRoleSetAtReview = isEscalationRoleSetAtReview(rule, canEditDraftContent);
  const selectedVersion =
    rule.versions.find((version) => version.versionNumber === selectedVersionNumber) ?? latestVersion;
  const closeEditor = () => setEditorMode("none");

  return (
    <>
      <PageHeader
        backLink={
          returnPath === null
            ? { href: "/rules", label: t.rules.title }
            : { href: returnPath, label: t.rules.backToTransaction }
        }
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
      <RuleConfiguration rule={rule} onEditDraft={() => setEditorMode("edit_draft")} />
      <RuleWhitelistCard rule={rule} />

      <RuleActionsCard
        rule={rule}
        reviewEscalationRole={
          isRoleSetAtReview ? { value: escalationRole, onChange: setEscalationRole } : null
        }
        onOpenEditor={setEditorMode}
      />

      {editorMode === "new_version" && <NewVersionEditor rule={rule} onClose={closeEditor} />}
      {editorMode === "edit_draft" && <DraftEditor rule={rule} onClose={closeEditor} />}

      {/* Null keeps the version's role, set at its creation or in the draft edit. */}
      <RuleReviewCard rule={rule} escalationRole={isRoleSetAtReview ? escalationRole : null} />

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
          <RuleConfigView config={selectedVersion.config} baseScore={selectedVersion.baseScore} />
        </div>
        <div>
          <h3 className={configStyles.sectionTitle}>{t.rules.legalBasisOfVersion}</h3>
          <LegalBasisList legalBases={selectedVersion.legalBases} emptyLabel={t.rules.noLegalBasis} />
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

// returnPath is a vetted internal path (see lib/returnPath.ts), set when the detail was opened from a transaction.
export function RuleDetailScreen({ ruleId, returnPath }: { ruleId: string; returnPath: string | null }) {
  const ruleQuery = useRule(ruleId);
  return (
    <QueryView query={ruleQuery}>{(rule) => <RuleDetail rule={rule} returnPath={returnPath} />}</QueryView>
  );
}
