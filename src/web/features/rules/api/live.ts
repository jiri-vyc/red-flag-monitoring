import { z } from "zod";

import { getCurrentUser, formatUserName } from "@/config/currentUser";
import { fetchPolicyWithVersions } from "@/features/policies/api/dto";
import {
  fetchRegulationsWithVersions,
  indexLatestVersionIdByRegulationId,
  indexRegulationIdByVersionId,
  toLegalBases,
} from "@/features/regulations/api/dto";
import type { RuleLegalBasis } from "@/features/regulations/types";
import { ApiError } from "@/lib/apiError";
import { requestJson } from "@/lib/httpClient";

import type { Rule, RuleConfig, RuleContent, RuleStatus, RuleVersion, WhitelistEntry } from "../types";
import type { RulesService } from "./contract";
import {
  BACKEND_RISK_PROFILES,
  fetchPolicyRulesWithVersions,
  fetchRuleWithVersions,
  fetchRulesWithVersions,
  findActiveVersionDto,
  findDescribingVersionDto,
  formatRuleName,
  ruleDefinitionDtoSchema,
  ruleDtoSchema,
  rulePath,
  ruleVersionDtoSchema,
  whitelistEntryDtoSchema,
  type BackendRiskProfile,
  type NewRuleVersionDto,
  type RuleDefinitionDto,
  type RuleDto,
  type RuleLegalBasisDto,
  type RuleVersionDto,
  type RuleWithVersionsDto,
  type WhitelistEntryDto,
} from "./dto";
import type { UserRole } from "@/features/users/types";

// The backend only stores the model id of an agentic rule; no engine runs it yet. Verify before real use.
const MANUAL_AGENT_MODEL_ID = "eu.anthropic.claude-sonnet-4-5-20250929-v1:0";
const MANUAL_RULE_CODE_PREFIX = "M-";
const ALERT_TYPE_MAX_LENGTH = 80;

const whitelistPath = (ruleId: string) => `${rulePath(ruleId)}/whitelist`;
const versionPath = (ruleId: string, versionId: string) =>
  `${rulePath(ruleId)}/versions/${encodeURIComponent(versionId)}`;

function throwValidation(message: string): never {
  throw new ApiError({ kind: "validation", message });
}

function throwUnsupported(message: string): never {
  throw new ApiError({ kind: "unsupported", message });
}

/** M6: the rule holds `enabled` and `active_version_id`, the versions hold the review status. */
export function deriveRuleStatus({ rule, versions }: RuleWithVersionsDto): RuleStatus {
  const latestStatus = versions.at(-1)?.status;
  const hasActiveVersion = rule.activeVersionId !== null;
  if (latestStatus === "draft" || latestStatus === "pending_review") {
    // Only an enabled rule keeps running its approved version while the update awaits review.
    if (rule.isEnabled && hasActiveVersion) {
      return "update_for_review";
    }
    return latestStatus === "draft" ? "draft" : "pending_for_review";
  }
  return rule.isEnabled && hasActiveVersion ? "active" : "inactive";
}

function toRuleContent(rule: RuleDto, version: RuleVersionDto): RuleContent {
  if (rule.kind === "agentic") {
    return { type: "agentic", ruleText: version.agentPrompt ?? version.humanText };
  }
  return {
    type: "deterministic",
    code: JSON.stringify(version.definition, null, 2),
    explanation: version.humanText,
  };
}

function toRuleVersion(
  rule: RuleDto,
  version: RuleVersionDto,
  regulationIdByVersionId: Map<string, string>,
): RuleVersion {
  return {
    versionNumber: version.versionNo,
    state: version.status,
    content: toRuleContent(rule, version),
    config: {
      sensitivity: version.sensitivity,
      riskProfiles: version.riskProfiles,
      escalationRole: version.escalationRole,
    },
    baseScore: version.baseScore,
    // The backend has no change note; the threshold rationale is the closest free-text field.
    changeNote: version.thresholdRationale ?? "",
    createdAt: version.createdAt,
    createdBy: formatUserName(version.createdBy),
    reviewedBy: version.reviewedBy === null ? null : formatUserName(version.reviewedBy),
    reviewedAt: version.reviewedAt,
    legalBases: toLegalBases(version.legalBases, regulationIdByVersionId),
  };
}

// ISO timestamps from the backend are all UTC, so string order is time order.
function findLatestTimestamp(timestamps: (string | null)[]): string {
  return timestamps
    .filter((timestamp) => timestamp !== null)
    .reduce((latest, current) => {
      return current > latest ? current : latest;
    }, "");
}

export function toRule(
  ruleWithVersions: RuleWithVersionsDto,
  regulationIdByVersionId: Map<string, string>,
): Rule {
  const { rule, versions } = ruleWithVersions;
  const describingVersion = findDescribingVersionDto(ruleWithVersions);
  return {
    id: rule.id,
    name: formatRuleName(rule),
    description: describingVersion?.humanText ?? "",
    type: rule.kind,
    status: deriveRuleStatus(ruleWithVersions),
    // reg_update versions are system generated like wizard ones; the web model has no third origin.
    origin: versions.at(0)?.createdVia === "manual" ? "manual" : "wizard",
    policyId: rule.policyId,
    runningVersionNumber: findActiveVersionDto(ruleWithVersions)?.versionNo ?? null,
    versions: versions.map((version) => toRuleVersion(rule, version, regulationIdByVersionId)),
    whitelistAllowed: rule.isWhitelistAllowed,
    createdAt: rule.createdAt,
    updatedAt: findLatestTimestamp([
      rule.createdAt,
      ...versions.flatMap((version) => [version.createdAt, version.reviewedAt]),
    ]),
  };
}

function toWhitelistEntry(entry: WhitelistEntryDto): WhitelistEntry {
  return {
    ruleId: entry.ruleId,
    clientId: entry.clientId,
    reason: entry.reason,
    createdBy: formatUserName(entry.createdBy),
    createdAt: entry.createdAt,
  };
}

/** The web links legal bases to regulations; the backend cites a regulation wording (M1). */
function toLegalBasisDtos(
  legalBases: RuleLegalBasis[],
  latestVersionIdByRegulationId: Map<string, string>,
): RuleLegalBasisDto[] {
  const legalBasisDtos = legalBases.map(({ regulationId, ref }) => {
    const regulationVersionId = latestVersionIdByRegulationId.get(regulationId);
    if (regulationVersionId === undefined) {
      return throwValidation(`Regulation ${regulationId} has no wording to cite.`);
    }
    return { regulationVersionId, ref: ref.trim() };
  });
  // The backend rejects duplicate legal bases.
  const uniqueKeys = new Set(
    legalBasisDtos.map(({ regulationVersionId, ref }) => `${regulationVersionId}|${ref}`),
  );
  return legalBasisDtos.filter(({ regulationVersionId, ref }) =>
    uniqueKeys.delete(`${regulationVersionId}|${ref}`),
  );
}

/** M4: a rule without a policy derives from no policy version. */
async function findDerivingPolicyVersionId(policyId: string | null): Promise<string | null> {
  if (policyId === null) {
    return null;
  }
  const { versions } = await fetchPolicyWithVersions(policyId);
  const policyVersion = versions.findLast((version) => version.status === "approved") ?? versions.at(-1);
  return policyVersion?.id ?? null;
}

async function loadRegulationIndex(): Promise<Map<string, string>> {
  return indexRegulationIdByVersionId(await fetchRegulationsWithVersions());
}

async function toRules(rulesWithVersionsRequest: Promise<RuleWithVersionsDto[]>): Promise<Rule[]> {
  const [rulesWithVersions, regulationIdByVersionId] = await Promise.all([
    rulesWithVersionsRequest,
    loadRegulationIndex(),
  ]);
  // The web model needs at least one version; a rule whose first version was never saved is left out.
  return rulesWithVersions
    .filter(({ versions }) => versions.length > 0)
    .map((ruleWithVersions) => toRule(ruleWithVersions, regulationIdByVersionId));
}

function loadRules(): Promise<Rule[]> {
  return toRules(fetchRulesWithVersions());
}

/** The rules that implement one policy, with their versions (e.g. the drafts created by its approval). */
export function loadPolicyRules(policyId: string): Promise<Rule[]> {
  return toRules(fetchPolicyRulesWithVersions(policyId));
}

async function loadRule(ruleId: string): Promise<Rule> {
  const [ruleWithVersions, regulationIdByVersionId] = await Promise.all([
    fetchRuleWithVersions(ruleId),
    loadRegulationIndex(),
  ]);
  if (ruleWithVersions.versions.length === 0) {
    throw new ApiError({
      kind: "invalid_response",
      message: `Rule ${ruleWithVersions.rule.code} has no version yet, so it cannot be shown.`,
    });
  }
  return toRule(ruleWithVersions, regulationIdByVersionId);
}

/** The newest version while it still awaits review. Only it can be submitted, approved or rejected. */
async function findUnreviewedVersion(ruleId: string): Promise<RuleVersionDto> {
  const latestVersion = (await fetchRuleWithVersions(ruleId)).versions.at(-1);
  if (!latestVersion || (latestVersion.status !== "draft" && latestVersion.status !== "pending_review")) {
    return throwValidation("The rule has no version awaiting review.");
  }
  return latestVersion;
}

function submitVersion(ruleId: string, versionId: string): Promise<RuleVersionDto> {
  return requestJson({
    path: `${versionPath(ruleId, versionId)}/submit`,
    method: "POST",
    schema: ruleVersionDtoSchema,
  });
}

/** The backend reviews only pending versions, while the web lets a draft be approved or rejected directly. */
async function submitIfDraft(ruleId: string, version: RuleVersionDto): Promise<void> {
  if (version.status === "draft") {
    await submitVersion(ruleId, version.id);
  }
}

type ReviewDecision = (
  { decision: "approved"; comment: null } | { decision: "rejected"; comment: string }
) & {
  escalationRole: UserRole | null;
};

function reviewVersion({
  ruleId,
  versionId,
  review,
}: {
  ruleId: string;
  versionId: string;
  review: ReviewDecision;
}): Promise<RuleVersionDto> {
  return requestJson({
    path: `${versionPath(ruleId, versionId)}/review`,
    method: "POST",
    jsonBody: {
      decision: review.decision,
      reviewedBy: getCurrentUser().id,
      reviewComment: review.comment,
      escalationRole: review.escalationRole,
    },
    schema: ruleVersionDtoSchema,
  });
}

function setRuleEnabled(ruleId: string, isEnabled: boolean): Promise<RuleDto> {
  return requestJson({
    path: `${rulePath(ruleId)}/${isEnabled ? "enable" : "disable"}`,
    method: "POST",
    schema: ruleDtoSchema,
  });
}

/** M15: the backend knows only the dataset's low, medium and high profiles. */
function toBackendRiskProfiles(riskProfiles: RuleConfig["riskProfiles"]): BackendRiskProfile[] {
  const backendRiskProfiles = BACKEND_RISK_PROFILES.filter((riskProfile) =>
    riskProfiles.includes(riskProfile),
  );
  if (backendRiskProfiles.length === 0) {
    return throwValidation("Select at least one of the low, medium or high risk profiles.");
  }
  return backendRiskProfiles;
}

function parseRuleDefinition(code: string): RuleDefinitionDto {
  let parsedCode: unknown;
  try {
    parsedCode = JSON.parse(code);
  } catch {
    return throwValidation("The rule code must be a JSON rule definition.");
  }
  const parseResult = ruleDefinitionDtoSchema.safeParse(parsedCode);
  if (!parseResult.success) {
    return throwValidation(
      `The rule code is not a valid rule definition (match, features, conditions): ${z.prettifyError(parseResult.error)}`,
    );
  }
  return parseResult.data;
}

type RuleLogicDto = Pick<
  NewRuleVersionDto,
  "definition" | "agentPrompt" | "agentModelId" | "baseScore" | "humanText"
>;

/** Content edits replace the rule logic; the score and model stay those of the version it is based on. */
function toRuleLogic(content: RuleContent, baseVersion: RuleVersionDto): RuleLogicDto {
  if (content.type === "agentic") {
    return {
      definition: null,
      agentPrompt: content.ruleText,
      agentModelId: baseVersion.agentModelId,
      baseScore: null,
      humanText: baseVersion.humanText,
    };
  }
  return {
    definition: parseRuleDefinition(content.code),
    agentPrompt: null,
    agentModelId: null,
    baseScore: baseVersion.baseScore,
    humanText: content.explanation,
  };
}

function createVersion(ruleId: string, version: NewRuleVersionDto): Promise<RuleVersionDto> {
  return requestJson({
    path: `${rulePath(ruleId)}/versions`,
    method: "POST",
    jsonBody: version,
    schema: ruleVersionDtoSchema,
  });
}

function createManualRuleCode(): string {
  return `${MANUAL_RULE_CODE_PREFIX}${Date.now().toString(36).toUpperCase()}`;
}

function toAlertType(description: string): string {
  const firstLine = description.trim().split("\n")[0] ?? "";
  return firstLine.slice(0, ALERT_TYPE_MAX_LENGTH);
}

export const liveRulesService: RulesService = {
  capabilities: {
    canEditDraftContent: false,
    canCreateDeterministicRule: false,
    canCreateAgenticRule: true,
    canSuggestWhitelistClients: false,
    canDeleteRule: false,
  },

  loadRules,
  loadRule,

  // The backend does not generate rule logic: the description becomes the prompt of an agentic rule.
  // The deterministic option is hidden in the UI; this check is the safety net.
  async createManualRule({
    description,
    policyId,
    type,
    sensitivity,
    riskProfiles,
    escalationRole,
    legalBases,
  }) {
    if (type === "deterministic") {
      return throwUnsupported(
        "Generating a deterministic rule definition from a description is not supported by the API yet.",
      );
    }
    const backendRiskProfiles = toBackendRiskProfiles(riskProfiles);
    // M5: the backend rejects a rule version without a legal basis, so it is checked before the rule is created.
    if (legalBases.length === 0) {
      return throwValidation("A rule needs at least one legal basis with a provision reference.");
    }
    const [regulationsWithVersions, derivedFromPolicyVersionId] = await Promise.all([
      fetchRegulationsWithVersions(),
      findDerivingPolicyVersionId(policyId),
    ]);
    const legalBasisDtos = toLegalBasisDtos(
      legalBases,
      indexLatestVersionIdByRegulationId(regulationsWithVersions),
    );
    const rule = await requestJson({
      path: "/rules",
      method: "POST",
      jsonBody: {
        policyId,
        code: createManualRuleCode(),
        alertType: toAlertType(description),
        kind: "agentic",
        isWhitelistAllowed: true,
      },
      schema: ruleDtoSchema,
    });
    await createVersion(rule.id, {
      status: "pending_review",
      createdVia: "manual",
      createdBy: getCurrentUser().id,
      derivedFromPolicyVersionId,
      definition: null,
      agentPrompt: description.trim(),
      agentModelId: MANUAL_AGENT_MODEL_ID,
      humanText: description.trim(),
      thresholdRationale: null,
      baseScore: null,
      sensitivity,
      riskProfiles: backendRiskProfiles,
      escalationRole,
      legalBases: legalBasisDtos,
    });
    return loadRule(rule.id);
  },

  async submitRuleForReview(ruleId) {
    const version = await findUnreviewedVersion(ruleId);
    if (version.status !== "draft") {
      return throwValidation("The rule version is already waiting for review.");
    }
    await submitVersion(ruleId, version.id);
    return loadRule(ruleId);
  },

  // Backend approval does not activate the version (M6); the web approve also makes it the running version.
  // Only a brand-new rule gets enabled here: a rule an analyst switched off stays off after an update is approved.
  async approveRule({ ruleId, escalationRole }) {
    const ruleBeforeApproval = await requestJson({ path: rulePath(ruleId), schema: ruleDtoSchema });
    const version = await findUnreviewedVersion(ruleId);
    await submitIfDraft(ruleId, version);
    await reviewVersion({
      ruleId,
      versionId: version.id,
      review: { decision: "approved", comment: null, escalationRole },
    });
    await requestJson({
      path: `${rulePath(ruleId)}/active-version`,
      method: "PUT",
      jsonBody: { versionId: version.id },
      schema: ruleDtoSchema,
    });
    if (ruleBeforeApproval.activeVersionId === null) {
      await setRuleEnabled(ruleId, true);
    }
    return loadRule(ruleId);
  },

  // The backend requires the reason of every rejection and stores it as the version's review comment.
  async rejectRule({ ruleId, comment, escalationRole }) {
    const trimmedComment = comment.trim();
    if (trimmedComment === "") {
      return throwValidation("A rejection needs a reason.");
    }
    const version = await findUnreviewedVersion(ruleId);
    await submitIfDraft(ruleId, version);
    await reviewVersion({
      ruleId,
      versionId: version.id,
      review: { decision: "rejected", comment: trimmedComment, escalationRole },
    });
    return loadRule(ruleId);
  },

  async activateRule(ruleId) {
    await setRuleEnabled(ruleId, true);
    return loadRule(ruleId);
  },

  async deactivateRule(ruleId) {
    await setRuleEnabled(ruleId, false);
    return loadRule(ruleId);
  },

  async createRuleVersion({ ruleId, content, config, changeNote }) {
    const ruleWithVersions = await fetchRuleWithVersions(ruleId);
    const baseVersion = findDescribingVersionDto(ruleWithVersions);
    if (!baseVersion) {
      return throwValidation("The rule has no version to base a new one on.");
    }
    await createVersion(ruleId, {
      status: "pending_review",
      createdVia: "manual",
      createdBy: getCurrentUser().id,
      derivedFromPolicyVersionId: baseVersion.derivedFromPolicyVersionId,
      ...toRuleLogic(content, baseVersion),
      thresholdRationale: changeNote.trim() || null,
      sensitivity: config.sensitivity,
      riskProfiles: toBackendRiskProfiles(config.riskProfiles),
      escalationRole: config.escalationRole,
      legalBases: baseVersion.legalBases,
    });
    return loadRule(ruleId);
  },

  // Issue #8 adds PATCH /api/rules/:ruleId/versions/:versionId for a draft version. Until then the edit is hidden in
  // the UI and this is the safety net. With #8, map content like toRuleLogic and config like createRuleVersion
  // (sensitivity, riskProfiles, escalationRole) into the PATCH body.
  updateDraftContent: () =>
    throwUnsupported(
      "Editing a saved rule version is not supported by the API (versions are immutable). Reject it and create a new version.",
    ),

  // The backend has no rule deletion endpoint yet (todo-web.md). Hidden in the UI; this is the safety net.
  deleteRule: () => throwUnsupported("Deleting a rule is not supported by the API yet."),

  getWhitelist: async (ruleId) => {
    const entries = await requestJson({
      path: whitelistPath(ruleId),
      schema: z.array(whitelistEntryDtoSchema),
    });
    return entries.map(toWhitelistEntry);
  },

  addWhitelistEntry: async ({ ruleId, clientId, reason }) => {
    const entry = await requestJson({
      path: whitelistPath(ruleId),
      method: "POST",
      jsonBody: { clientId, reason, createdBy: getCurrentUser().id },
      schema: whitelistEntryDtoSchema,
    });
    return toWhitelistEntry(entry);
  },

  removeWhitelistEntry: async ({ ruleId, clientId }) => {
    // 204 without a body.
    await requestJson({
      path: `${whitelistPath(ruleId)}/${encodeURIComponent(clientId)}`,
      method: "DELETE",
      schema: z.unknown(),
    });
  },
};
