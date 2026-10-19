import type { Rule, RuleVersion } from "../../domain/rule";
import type { VersionReview } from "../../domain/versionStatus";
import { ConflictError } from "../errors";
import type { NewRule, NewRuleVersion, RuleActivation, RuleRepository } from "../rules/ruleRepository";
import type { VersionStatusChange } from "../versionReview";

// Mirrors the conditional updates of TypeOrmRuleRepository so state races show up as ConflictError.
export class InMemoryRuleRepository implements RuleRepository {
  readonly rules = new Map<string, Rule>();
  readonly versions = new Map<string, RuleVersion>();
  private nextId = 1;

  async createRule(rule: NewRule): Promise<Rule> {
    const created: Rule = {
      ...rule,
      id: this.generateId("rule"),
      isEnabled: false,
      activeVersionId: null,
      createdAt: new Date(0),
    };
    this.rules.set(created.id, created);

    return created;
  }

  async listRules(): Promise<Rule[]> {
    return [...this.rules.values()];
  }

  async findRule(ruleId: string): Promise<Rule | null> {
    return this.rules.get(ruleId) ?? null;
  }

  async updateRuleEnabled(ruleId: string, isEnabled: boolean): Promise<void> {
    this.replaceRule(ruleId, { isEnabled });
  }

  async activateVersion(activation: RuleActivation): Promise<void> {
    const rule = this.getRule(activation.ruleId);

    if (rule.activeVersionId !== activation.previousActiveVersionId) {
      throw new ConflictError("Active version changed");
    }

    this.replaceRule(rule.id, { activeVersionId: activation.versionId });

    const previous =
      activation.previousActiveVersionId && this.versions.get(activation.previousActiveVersionId);

    if (previous && previous.status === "approved") {
      this.versions.set(previous.id, { ...previous, status: "superseded" });
    }
  }

  async createVersion(version: NewRuleVersion): Promise<RuleVersion> {
    const versionNo =
      [...this.versions.values()].filter(({ ruleId }) => ruleId === version.ruleId).length + 1;
    const created: RuleVersion = {
      ...version,
      id: this.generateId("rule-version"),
      versionNo,
      createdAt: new Date(0),
      reviewedBy: null,
      reviewedAt: null,
      reviewComment: null,
    };
    this.versions.set(created.id, created);

    return created;
  }

  async listVersions(ruleId: string): Promise<RuleVersion[]> {
    return [...this.versions.values()].filter((version) => version.ruleId === ruleId);
  }

  async findVersion(versionId: string): Promise<RuleVersion | null> {
    return this.versions.get(versionId) ?? null;
  }

  async updateVersionStatus(change: VersionStatusChange): Promise<void> {
    const version = this.getVersionInStatus(change.versionId, change.fromStatus);

    this.versions.set(version.id, { ...version, status: change.toStatus });
  }

  async recordReview(versionId: string, review: VersionReview): Promise<void> {
    const version = this.getVersionInStatus(versionId, "pending_review");

    this.versions.set(versionId, {
      ...version,
      status: review.decision,
      reviewedBy: review.reviewedBy,
      reviewedAt: review.reviewedAt,
      reviewComment: review.reviewComment,
    });
  }

  private getRule(ruleId: string): Rule {
    const rule = this.rules.get(ruleId);

    if (!rule) {
      throw new Error(`Test setup: rule ${ruleId} does not exist`);
    }

    return rule;
  }

  private replaceRule(ruleId: string, changes: Partial<Rule>): void {
    this.rules.set(ruleId, { ...this.getRule(ruleId), ...changes });
  }

  private getVersionInStatus(versionId: string, status: RuleVersion["status"]): RuleVersion {
    const version = this.versions.get(versionId);

    if (!version || version.status !== status) {
      throw new ConflictError(`Version ${versionId} changed`);
    }

    return version;
  }

  private generateId(prefix: string): string {
    return `${prefix}-${this.nextId++}`;
  }
}
