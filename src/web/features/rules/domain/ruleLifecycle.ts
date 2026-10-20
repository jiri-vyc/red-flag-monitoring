import type { RuleLegalBasis } from "@/features/regulations/types";

import {
  RULE_CONFIG_FIELDS,
  type Rule,
  type RuleConfig,
  type RuleConfigField,
  type RuleContent,
  type RuleStatus,
  type RuleVersion,
  type RuleVersionState,
} from "../types";
import type { UserRole } from "@/features/users/types";

export type RuleAction =
  "submit_for_review" | "approve" | "reject" | "activate" | "deactivate" | "create_version";

export class RuleTransitionError extends Error {
  constructor(action: RuleAction, status: RuleStatus) {
    super(`Action "${action}" is not allowed for a rule in status "${status}".`);
    this.name = "RuleTransitionError";
  }
}

type ReviewContext = { reviewer: string; now: string; escalationRole: UserRole | null };

/** A review may change the escalation role of the reviewed version (issue #6); null keeps it. */
function withEscalationRole(version: RuleVersion, escalationRole: UserRole | null): RuleVersion {
  return escalationRole === null ? version : { ...version, config: { ...version.config, escalationRole } };
}

const REVIEWABLE_STATUSES: readonly RuleStatus[] = ["draft", "pending_for_review", "update_for_review"];

export function getLatestVersion(rule: Rule): RuleVersion {
  const latestVersion = rule.versions.at(-1);
  if (!latestVersion) {
    throw new Error(`Rule ${rule.id} has no versions.`);
  }
  return latestVersion;
}

export function findRunningVersion(rule: Rule): RuleVersion | null {
  if (rule.runningVersionNumber === null) {
    return null;
  }
  return rule.versions.find((version) => version.versionNumber === rule.runningVersionNumber) ?? null;
}

/** The latest version while it still awaits review (a draft or a pending update). Never executed. */
export function findPendingVersion(rule: Rule): RuleVersion | null {
  const latestVersion = getLatestVersion(rule);
  const isUnreviewed = latestVersion.state === "draft" || latestVersion.state === "pending_review";
  return isUnreviewed ? latestVersion : null;
}

function areConfigValuesEqual(field: RuleConfigField, left: RuleConfig, right: RuleConfig): boolean {
  if (field === "sensitivity" || field === "escalationRole") {
    return left[field] === right[field];
  }
  // Order does not matter for lists: comparing sorted copies.
  const sortedLeft = [...left[field]].sort();
  const sortedRight = [...right[field]].sort();
  return (
    sortedLeft.length === sortedRight.length &&
    sortedLeft.every((value, index) => value === sortedRight[index])
  );
}

export function getChangedConfigFields(
  runningConfig: RuleConfig,
  pendingConfig: RuleConfig,
): RuleConfigField[] {
  return RULE_CONFIG_FIELDS.filter((field) => !areConfigValuesEqual(field, runningConfig, pendingConfig));
}

/** Only an approved version of an active rule runs. A rule under update review keeps running its previous approved version. */
export function isRuleExecutable(rule: Rule): boolean {
  const isRunningStatus = rule.status === "active" || rule.status === "update_for_review";
  return isRunningStatus && findRunningVersion(rule) !== null;
}

export function getAvailableRuleActions(rule: Rule): RuleAction[] {
  switch (rule.status) {
    case "draft":
      return ["submit_for_review", "approve", "reject"];
    case "pending_for_review":
    case "update_for_review":
      return ["approve", "reject"];
    case "active":
      return ["deactivate", "create_version"];
    case "inactive":
      return rule.runningVersionNumber === null ? ["create_version"] : ["activate", "create_version"];
  }
}

// A superseded version was approved before a newer one replaced it.
const EVER_APPROVED_VERSION_STATES: readonly RuleVersionState[] = ["approved", "superseded"];

/**
 * Only a rule that never had an approved version may be deleted: it never ran, so no evaluation run refers to it.
 * An approved rule keeps its audit trail and can only be switched off.
 */
export function canDeleteRule(rule: Rule): boolean {
  const hadApprovedVersion = rule.versions.some((version) =>
    EVER_APPROVED_VERSION_STATES.includes(version.state),
  );
  return rule.runningVersionNumber === null && !hadApprovedVersion;
}

function assertActionAllowed(rule: Rule, action: RuleAction): void {
  if (!getAvailableRuleActions(rule).includes(action)) {
    throw new RuleTransitionError(action, rule.status);
  }
}

function replaceLatestVersion(rule: Rule, latestVersion: RuleVersion): RuleVersion[] {
  return [...rule.versions.slice(0, -1), latestVersion];
}

export function submitRuleForReview(rule: Rule, now: string): Rule {
  assertActionAllowed(rule, "submit_for_review");
  const latestVersion: RuleVersion = { ...getLatestVersion(rule), state: "pending_review" };
  return {
    ...rule,
    status: "pending_for_review",
    versions: replaceLatestVersion(rule, latestVersion),
    updatedAt: now,
  };
}

export function approveRule(rule: Rule, { reviewer, now, escalationRole }: ReviewContext): Rule {
  assertActionAllowed(rule, "approve");
  const approvedVersion = getLatestVersion(rule);
  const versions = rule.versions.map((version): RuleVersion => {
    if (version.versionNumber === approvedVersion.versionNumber) {
      return withEscalationRole(
        { ...version, state: "approved", reviewedBy: reviewer, reviewedAt: now },
        escalationRole,
      );
    }
    return version.state === "approved" ? { ...version, state: "superseded" } : version;
  });
  return {
    ...rule,
    status: "active",
    runningVersionNumber: approvedVersion.versionNumber,
    versions,
    updatedAt: now,
  };
}

export function rejectRule(rule: Rule, { reviewer, now, escalationRole }: ReviewContext): Rule {
  assertActionAllowed(rule, "reject");
  const rejectedVersion = withEscalationRole(
    { ...getLatestVersion(rule), state: "rejected", reviewedBy: reviewer, reviewedAt: now },
    escalationRole,
  );
  // A rejected update leaves the previously approved version running; a rejected new rule is switched off.
  const nextStatus: RuleStatus = rule.status === "update_for_review" ? "active" : "inactive";
  return {
    ...rule,
    status: nextStatus,
    versions: replaceLatestVersion(rule, rejectedVersion),
    updatedAt: now,
  };
}

export function activateRule(rule: Rule, now: string): Rule {
  assertActionAllowed(rule, "activate");
  return { ...rule, status: "active", updatedAt: now };
}

export function deactivateRule(rule: Rule, now: string): Rule {
  assertActionAllowed(rule, "deactivate");
  return { ...rule, status: "inactive", updatedAt: now };
}

export function addRuleVersion(
  rule: Rule,
  {
    content,
    config,
    changeNote,
    author,
    now,
  }: { content: RuleContent; config: RuleConfig; changeNote: string; author: string; now: string },
): Rule {
  assertActionAllowed(rule, "create_version");
  // Content and config changes both create a new version; the running version stays until approval.
  const newVersion: RuleVersion = {
    versionNumber: getLatestVersion(rule).versionNumber + 1,
    state: "pending_review",
    content,
    config,
    // A new version has no base score input, so it carries over from the latest version.
    baseScore: getLatestVersion(rule).baseScore,
    changeNote,
    createdAt: now,
    createdBy: author,
    reviewedBy: null,
    reviewedAt: null,
    // Like the live adapter, a new version keeps the legal basis of the version it is based on.
    legalBases: findRuleLegalBases(rule),
  };
  const nextStatus: RuleStatus = rule.status === "active" ? "update_for_review" : "pending_for_review";
  return { ...rule, status: nextStatus, versions: [...rule.versions, newVersion], updatedAt: now };
}

export function updateDraftContent(
  rule: Rule,
  {
    content,
    config,
    baseScore,
    now,
  }: { content: RuleContent; config?: RuleConfig; baseScore?: number; now: string },
): Rule {
  const latestVersion = getLatestVersion(rule);
  const isEditable = REVIEWABLE_STATUSES.includes(rule.status) && latestVersion.state !== "approved";
  if (!isEditable) {
    throw new Error(`Rule ${rule.id} has no unapproved version to edit.`);
  }
  const editedVersion = {
    ...latestVersion,
    content,
    config: config ?? latestVersion.config,
    baseScore: baseScore ?? latestVersion.baseScore,
  };
  return { ...rule, versions: replaceLatestVersion(rule, editedVersion), updatedAt: now };
}

/** The version that describes the rule: the running one, else the newest (it awaits review or was rejected). */
export function findDescribingVersion(rule: Rule): RuleVersion {
  return findRunningVersion(rule) ?? getLatestVersion(rule);
}

/** M5: the rule's legal basis is that of the describing version, never inherited from the policy. */
export function findRuleLegalBases(rule: Rule): RuleLegalBasis[] {
  return findDescribingVersion(rule).legalBases;
}
