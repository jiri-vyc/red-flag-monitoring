import type { EscalationRole, Rule, RuleVersion } from "../../domain/rule";
import type { VersionReview } from "../../domain/versionStatus";
import type { VersionStatusChange } from "../versionReview";

export type NewRule = Pick<Rule, "policyId" | "code" | "alertType" | "kind" | "isWhitelistAllowed">;
export type NewRuleVersion = Omit<
  RuleVersion,
  "id" | "versionNo" | "createdAt" | "reviewedBy" | "reviewedAt" | "reviewComment"
>;

// E2: a review may also change the escalation role; null keeps the version's current one.
export type RuleVersionReview = VersionReview & { escalationRole: EscalationRole | null };

// Applied in one transaction. The update is skipped with a ConflictError when the rule's active version is
// no longer `previousActiveVersionId`.
export type RuleActivation = {
  ruleId: string;
  versionId: string;
  previousActiveVersionId: string | null;
};

export interface RuleRepository {
  createRule(rule: NewRule): Promise<Rule>;
  listRules(): Promise<Rule[]>;
  findRule(ruleId: string): Promise<Rule | null>;
  updateRuleEnabled(ruleId: string, isEnabled: boolean): Promise<void>;
  activateVersion(activation: RuleActivation): Promise<void>;
  // Assigns the next version_no of the rule.
  createVersion(version: NewRuleVersion): Promise<RuleVersion>;
  listVersions(ruleId: string): Promise<RuleVersion[]>;
  findVersion(versionId: string): Promise<RuleVersion | null>;
  updateVersionStatus(change: VersionStatusChange): Promise<void>;
  recordReview(versionId: string, review: RuleVersionReview): Promise<void>;
}
