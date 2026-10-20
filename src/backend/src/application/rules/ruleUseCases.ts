import {
  canEnableRule,
  type EscalationRole,
  findActivationViolation,
  findRuleLogicViolation,
  type Rule,
  type RuleVersion,
} from "../../domain/rule";
import { recordAuditEvent } from "../audit/auditLog";
import type { Clock } from "../clock";
import { BusinessRuleViolationError, NotFoundError } from "../errors";
import { createReviewSubmission, createVersionReview, type ReviewInput } from "../versionReview";
import type { NewRule, NewRuleVersion, RuleRepository } from "./ruleRepository";

// E2: the reviewer (compliance officer) may change the escalation role; null keeps it.
export type RuleReviewInput = ReviewInput & { escalationRole: EscalationRole | null };

export class RuleUseCases {
  constructor(
    private readonly ruleRepository: RuleRepository,
    private readonly clock: Clock,
  ) {}

  // New rules start disabled: there is no approved version to run yet (M6).
  async createRule(rule: NewRule): Promise<Rule> {
    const created = await this.ruleRepository.createRule(rule);

    recordAuditEvent({
      action: "rule.created",
      entityType: "rule",
      entityId: created.id,
      actorId: null,
      payload: { code: created.code, kind: created.kind },
    });

    return created;
  }

  listRules(): Promise<Rule[]> {
    return this.ruleRepository.listRules();
  }

  async getRule(ruleId: string): Promise<Rule> {
    const rule = await this.ruleRepository.findRule(ruleId);

    if (!rule) {
      throw new NotFoundError("Rule", ruleId);
    }

    return rule;
  }

  // COMPLIANCE REVIEW: enabling, disabling and activating a version are audited in the logs with a timestamp but no
  // actor, because the API takes none yet (#5). What a run evaluated is reconstructable: each run fixes its rule
  // versions (V5).
  async enableRule(ruleId: string): Promise<Rule> {
    const rule = await this.getRule(ruleId);

    if (!canEnableRule(rule)) {
      throw new BusinessRuleViolationError(`Rule ${rule.code} has no active version to run`);
    }

    await this.ruleRepository.updateRuleEnabled(ruleId, true);
    recordAuditEvent({ action: "rule.enabled", entityType: "rule", entityId: ruleId, actorId: null });

    return this.getRule(ruleId);
  }

  async disableRule(ruleId: string): Promise<Rule> {
    await this.getRule(ruleId);
    await this.ruleRepository.updateRuleEnabled(ruleId, false);
    recordAuditEvent({ action: "rule.disabled", entityType: "rule", entityId: ruleId, actorId: null });

    return this.getRule(ruleId);
  }

  // The previously active version becomes superseded; runs keep pointing at it (V5).
  async setActiveVersion(ruleId: string, versionId: string): Promise<Rule> {
    const rule = await this.getRule(ruleId);

    if (rule.activeVersionId === versionId) {
      return rule;
    }

    const version = await this.getVersion(ruleId, versionId);
    const violation = findActivationViolation(rule, version);

    if (violation) {
      throw new BusinessRuleViolationError(violation);
    }

    await this.ruleRepository.activateVersion({
      ruleId,
      versionId,
      previousActiveVersionId: rule.activeVersionId,
    });
    recordAuditEvent({
      action: "rule.active_version_set",
      entityType: "rule",
      entityId: ruleId,
      actorId: null,
      payload: { versionId, previousActiveVersionId: rule.activeVersionId },
    });

    return this.getRule(ruleId);
  }

  async createVersion(version: NewRuleVersion): Promise<RuleVersion> {
    const rule = await this.getRule(version.ruleId);
    const logicViolation = findRuleLogicViolation(rule.kind, version);

    if (logicViolation) {
      throw new BusinessRuleViolationError(logicViolation);
    }

    // M5: the path from a hit to the regulation starts at the version's own legal basis.
    if (version.legalBases.length === 0) {
      throw new BusinessRuleViolationError("A rule version needs at least one legal basis");
    }

    const created = await this.ruleRepository.createVersion(version);

    recordAuditEvent({
      action: "rule.version_created",
      entityType: "rule",
      entityId: version.ruleId,
      actorId: created.createdBy,
      payload: { versionId: created.id, versionNo: created.versionNo, createdVia: created.createdVia },
    });

    return created;
  }

  async listVersions(ruleId: string): Promise<RuleVersion[]> {
    await this.getRule(ruleId);

    return this.ruleRepository.listVersions(ruleId);
  }

  async getVersion(ruleId: string, versionId: string): Promise<RuleVersion> {
    const version = await this.ruleRepository.findVersion(versionId);

    if (!version || version.ruleId !== ruleId) {
      throw new NotFoundError("Rule version", versionId);
    }

    return version;
  }

  async submitVersionForReview(ruleId: string, versionId: string): Promise<RuleVersion> {
    const version = await this.getVersion(ruleId, versionId);

    await this.ruleRepository.updateVersionStatus(createReviewSubmission(version));
    recordAuditEvent({
      action: "rule.version_submitted",
      entityType: "rule",
      entityId: ruleId,
      actorId: null,
      payload: { versionId },
    });

    return this.getVersion(ruleId, versionId);
  }

  // Approval does not activate the version: the active one keeps running until setActiveVersion (M6).
  async reviewVersion(ruleId: string, versionId: string, input: RuleReviewInput): Promise<RuleVersion> {
    const version = await this.getVersion(ruleId, versionId);
    const review = createVersionReview(version, input, this.clock);

    await this.ruleRepository.recordReview(versionId, { ...review, escalationRole: input.escalationRole });
    recordAuditEvent({
      action: "rule.version_reviewed",
      entityType: "rule",
      entityId: ruleId,
      actorId: input.reviewedBy,
      payload: {
        versionId,
        decision: input.decision,
        reviewComment: input.reviewComment,
        escalationRole: input.escalationRole,
      },
    });

    return this.getVersion(ruleId, versionId);
  }
}
