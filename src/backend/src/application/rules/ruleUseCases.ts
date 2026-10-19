import {
  canEnableRule,
  findActivationViolation,
  findRuleLogicViolation,
  type Rule,
  type RuleVersion,
} from "../../domain/rule";
import type { Clock } from "../clock";
import { BusinessRuleViolationError, NotFoundError } from "../errors";
import { createReviewSubmission, createVersionReview, type ReviewInput } from "../versionReview";
import type { NewRule, NewRuleVersion, RuleRepository } from "./ruleRepository";

export class RuleUseCases {
  constructor(
    private readonly ruleRepository: RuleRepository,
    private readonly clock: Clock,
  ) {}

  // New rules start disabled: there is no approved version to run yet (M6).
  createRule(rule: NewRule): Promise<Rule> {
    return this.ruleRepository.createRule(rule);
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

  async enableRule(ruleId: string): Promise<Rule> {
    const rule = await this.getRule(ruleId);

    if (!canEnableRule(rule)) {
      throw new BusinessRuleViolationError(`Rule ${rule.code} has no active version to run`);
    }

    await this.ruleRepository.updateRuleEnabled(ruleId, true);

    return this.getRule(ruleId);
  }

  async disableRule(ruleId: string): Promise<Rule> {
    await this.getRule(ruleId);
    await this.ruleRepository.updateRuleEnabled(ruleId, false);

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

    return this.ruleRepository.createVersion(version);
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

    return this.getVersion(ruleId, versionId);
  }

  // Approval does not activate the version: the active one keeps running until setActiveVersion (M6).
  async reviewVersion(ruleId: string, versionId: string, input: ReviewInput): Promise<RuleVersion> {
    const version = await this.getVersion(ruleId, versionId);
    const review = createVersionReview(version, input, this.clock);

    await this.ruleRepository.recordReview(versionId, review);

    return this.getVersion(ruleId, versionId);
  }
}
