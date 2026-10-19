import { z } from "zod";

import { assertUnreachable } from "@/lib/assertUnreachable";
import { requestJson } from "@/lib/httpClient";

import type { Jurisdiction } from "../types";

// Response DTOs of /api/regulations (src/backend/src/delivery/http/regulationsRouter.ts).

export const REGULATION_KINDS = ["law", "decree", "eu_reg", "eu_dir", "guidance"] as const;
export type RegulationKind = (typeof REGULATION_KINDS)[number];

// The backend has no jurisdiction; it follows from the kind of act. Guidance is mostly FATF / EBA level.
export function toJurisdiction(kind: RegulationKind): Jurisdiction {
  switch (kind) {
    case "law":
    case "decree":
      return "CZ";
    case "eu_reg":
    case "eu_dir":
      return "EU";
    case "guidance":
      return "INTL";
    default:
      return assertUnreachable(kind);
  }
}

export const regulationDtoSchema = z.object({
  id: z.string(),
  code: z.string(),
  title: z.string(),
  kind: z.enum(REGULATION_KINDS),
  sourceUrl: z.string().nullable(),
  checkedAt: z.string().nullable(),
});
export type RegulationDto = z.infer<typeof regulationDtoSchema>;

// The version list leaves out the full pasted text.
export const regulationVersionSummaryDtoSchema = z.object({
  id: z.string(),
  regulationId: z.string(),
  label: z.string(),
  createdAt: z.string(),
});
export type RegulationVersionSummaryDto = z.infer<typeof regulationVersionSummaryDtoSchema>;

export type RegulationWithVersionsDto = {
  regulation: RegulationDto;
  versions: RegulationVersionSummaryDto[];
};

const regulationPath = (regulationId: string) => `/regulations/${encodeURIComponent(regulationId)}`;

function fetchRegulationVersions(regulationId: string): Promise<RegulationVersionSummaryDto[]> {
  return requestJson({
    path: `${regulationPath(regulationId)}/versions`,
    schema: z.array(regulationVersionSummaryDtoSchema),
  });
}

export async function fetchRegulationWithVersions(regulationId: string): Promise<RegulationWithVersionsDto> {
  const [regulation, versions] = await Promise.all([
    requestJson({ path: regulationPath(regulationId), schema: regulationDtoSchema }),
    fetchRegulationVersions(regulationId),
  ]);
  return { regulation, versions };
}

export function fetchRegulationDtos(): Promise<RegulationDto[]> {
  return requestJson({ path: "/regulations", schema: z.array(regulationDtoSchema) });
}

export async function fetchRegulationsWithVersions(): Promise<RegulationWithVersionsDto[]> {
  const regulations = await fetchRegulationDtos();
  return Promise.all(
    regulations.map(async (regulation) => ({
      regulation,
      versions: await fetchRegulationVersions(regulation.id),
    })),
  );
}

/** Legal bases point at a regulation version; the web model links to the regulation itself. */
export function indexRegulationIdByVersionId(regulations: RegulationWithVersionsDto[]): Map<string, string> {
  return new Map(
    regulations.flatMap(({ versions }) => versions.map((version) => [version.id, version.regulationId])),
  );
}

/** A new legal basis cites the newest wording of the regulation (M1). */
export function indexLatestVersionIdByRegulationId(
  regulations: RegulationWithVersionsDto[],
): Map<string, string> {
  return new Map(
    regulations.flatMap(({ regulation, versions }) => {
      const latestVersion = versions
        .toSorted((left, right) => left.createdAt.localeCompare(right.createdAt))
        .at(-1);
      return latestVersion ? [[regulation.id, latestVersion.id] as const] : [];
    }),
  );
}

type LegalBasisReference<Ref> = { regulationVersionId: string; ref: Ref };

/**
 * Maps version-level legal bases to the regulations the web links to (M3, M5).
 * Two wordings of one regulation with the same ref collapse into one entry.
 */
export function toLegalBases<Ref extends string | null>(
  legalBases: LegalBasisReference<Ref>[],
  regulationIdByVersionId: Map<string, string>,
): { regulationId: string; ref: Ref }[] {
  const mappedLegalBases = legalBases.flatMap(({ regulationVersionId, ref }) => {
    const regulationId = regulationIdByVersionId.get(regulationVersionId);
    return regulationId === undefined ? [] : [{ regulationId, ref }];
  });
  const seenKeys = new Set<string>();
  return mappedLegalBases.filter(({ regulationId, ref }) => {
    const key = `${regulationId}|${ref ?? ""}`;
    if (seenKeys.has(key)) {
      return false;
    }
    seenKeys.add(key);
    return true;
  });
}
