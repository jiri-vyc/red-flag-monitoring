import { fetchPoliciesWithVersions } from "@/features/policies/api/dto";
import { fetchRulesWithVersions, findDescribingVersionDto } from "@/features/rules/api/dto";
import { ApiError } from "@/lib/apiError";
import { toSafeSourceUrl } from "@/lib/url";

import type { Regulation } from "../types";
import type { RegulationsService } from "./contract";
import {
  fetchRegulationDtos,
  fetchRegulationWithVersions,
  fetchRegulationsWithVersions,
  toJurisdiction,
  type RegulationWithVersionsDto,
} from "./dto";

type Citation = { citingId: string; regulationVersionId: string; ref: string | null };

/** Which policies and rules cite which regulation versions, taken from their current legal bases. */
type RegulationCitations = { policyCitations: Citation[]; ruleCitations: Citation[] };

function findCitingIds(citations: Citation[], regulationVersionIds: Set<string>): string[] {
  const citingIds = citations
    .filter((citation) => regulationVersionIds.has(citation.regulationVersionId))
    .map((citation) => citation.citingId);
  return [...new Set(citingIds)];
}

function toRegulation(
  { regulation, versions }: RegulationWithVersionsDto,
  citations: RegulationCitations,
): Regulation {
  const regulationVersionIds = new Set(versions.map((version) => version.id));
  const latestVersion = versions
    .toSorted((left, right) => left.createdAt.localeCompare(right.createdAt))
    .at(-1);
  const allCitations = [...citations.policyCitations, ...citations.ruleCitations];
  // M2: provisions are not entities; the cited `ref`s are the provisions that matter for the monitoring.
  const keyProvisions = allCitations
    .filter((citation) => regulationVersionIds.has(citation.regulationVersionId))
    .map((citation) => citation.ref)
    .filter((ref) => ref !== null);
  return {
    id: regulation.id,
    name: regulation.title,
    shortName: regulation.code,
    jurisdiction: toJurisdiction(regulation.kind),
    // The backend stores the full text per version, not a summary.
    description: "",
    // The URL is rendered as a link, so anything but http(s) (e.g. `javascript:`) is dropped.
    sourceUrl: toSafeSourceUrl(regulation.sourceUrl),
    version: latestVersion?.label ?? "",
    lastCheckedAt: regulation.checkedAt ?? "",
    keyProvisions: [...new Set(keyProvisions)],
    policyIds: findCitingIds(citations.policyCitations, regulationVersionIds),
    ruleIds: findCitingIds(citations.ruleCitations, regulationVersionIds),
  };
}

async function loadCitations(): Promise<RegulationCitations> {
  const [policiesWithVersions, rulesWithVersions] = await Promise.all([
    fetchPoliciesWithVersions(),
    fetchRulesWithVersions(),
  ]);
  const policyCitations = policiesWithVersions.flatMap(({ policy, versions }) =>
    (versions.at(-1)?.legalBases ?? []).map((legalBasis) => ({ citingId: policy.id, ...legalBasis })),
  );
  const ruleCitations = rulesWithVersions.flatMap((ruleWithVersions) =>
    (findDescribingVersionDto(ruleWithVersions)?.legalBases ?? []).map((legalBasis) => ({
      citingId: ruleWithVersions.rule.id,
      ...legalBasis,
    })),
  );
  return { policyCitations, ruleCitations };
}

export const liveRegulationsService: RegulationsService = {
  capabilities: { canDeleteRegulation: false },

  async loadRegulations() {
    const [regulationsWithVersions, citations] = await Promise.all([
      fetchRegulationsWithVersions(),
      loadCitations(),
    ]);
    return regulationsWithVersions.map((regulationWithVersions) =>
      toRegulation(regulationWithVersions, citations),
    );
  },

  async loadRegulation(regulationId) {
    const [regulationWithVersions, citations] = await Promise.all([
      fetchRegulationWithVersions(regulationId),
      loadCitations(),
    ]);
    return toRegulation(regulationWithVersions, citations);
  },

  // A single request: the short name is the regulation code, as in `toRegulation`.
  async loadRegulationNames() {
    const regulations = await fetchRegulationDtos();
    return Object.fromEntries(regulations.map((regulation) => [regulation.id, regulation.code]));
  },

  // The backend has no regulation deletion endpoint yet (todo-web.md). Hidden in the UI; this is the safety net.
  deleteRegulation: () => {
    throw new ApiError({
      kind: "unsupported",
      message: "Deleting a regulation is not supported by the API yet.",
    });
  },
};
