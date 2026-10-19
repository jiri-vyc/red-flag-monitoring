import { z } from "zod";

import type { RegulationKind } from "@/features/regulations/api/dto";

import type { WizardCapabilities } from "./api/contract";
import type { DraftPoliciesInput, RegulationSource, RegulationTarget } from "./types";

export type SourceKind = RegulationSource["kind"];

export type SourceFormValues = {
  kind: SourceKind;
  file: File | null;
  url: string;
  text: string;
  /** Metadata of a new regulation; unused for a URL source and when the wizard adds a wording to an existing one. */
  code: string;
  title: string;
  regulationKind: RegulationKind;
  sourceUrl: string;
  versionLabel: string;
};

export type SourceFormField = "source" | "code" | "title" | "sourceUrl" | "versionLabel";

export type SourceFormErrorKey =
  | "validationFile"
  | "validationUrl"
  | "validationText"
  | "validationCode"
  | "validationTitle"
  | "validationSourceUrl"
  | "validationVersionLabel";

export type SourceFormErrors = Partial<Record<SourceFormField, SourceFormErrorKey>>;

type SourceCapabilities = Pick<WizardCapabilities, "canFetchUrl">;

const MIN_TEXT_LENGTH = 50;
const MARKDOWN_FILE_PATTERN = /\.(md|markdown)$/i;
// `z.url()` alone also accepts e.g. `javascript:` URLs.
const httpUrlSchema = z.url({ protocol: /^https?$/ });

export const MARKDOWN_FILE_ACCEPT = ".md,.markdown,text/markdown";

/** Every source kind is always offered; one the implementation cannot load is shown but cannot be submitted. */
export const SOURCE_KINDS: readonly SourceKind[] = ["file", "url", "text"];

export function isSourceKindSupported(kind: SourceKind, { canFetchUrl }: SourceCapabilities): boolean {
  return kind !== "url" || canFetchUrl;
}

/** A URL source carries its own metadata (derived by the implementation), so the form asks only for the URL. */
export function areRegulationFieldsShown(kind: SourceKind): boolean {
  return kind !== "url";
}

export function isHttpUrl(value: string): boolean {
  return httpUrlSchema.safeParse(value).success;
}

function buildSource(
  values: SourceFormValues,
  capabilities: SourceCapabilities,
): { source: RegulationSource } | { errorKey: SourceFormErrorKey } {
  switch (values.kind) {
    case "file":
      return values.file && MARKDOWN_FILE_PATTERN.test(values.file.name)
        ? { source: { kind: "file", file: values.file } }
        : { errorKey: "validationFile" };
    case "url": {
      const url = values.url.trim();
      return isSourceKindSupported("url", capabilities) && isHttpUrl(url)
        ? { source: { kind: "url", url } }
        : { errorKey: "validationUrl" };
    }
    case "text": {
      const text = values.text.trim();
      return text.length >= MIN_TEXT_LENGTH
        ? { source: { kind: "text", text } }
        : { errorKey: "validationText" };
    }
  }
}

function buildNewRegulation(values: SourceFormValues, errors: SourceFormErrors): RegulationTarget {
  const code = values.code.trim();
  const title = values.title.trim();
  const trimmedSourceUrl = values.sourceUrl.trim();
  const sourceUrl = trimmedSourceUrl === "" ? null : trimmedSourceUrl;
  if (code === "") {
    errors.code = "validationCode";
  }
  if (title === "") {
    errors.title = "validationTitle";
  }
  if (sourceUrl !== null && !isHttpUrl(sourceUrl)) {
    errors.sourceUrl = "validationSourceUrl";
  }
  return { kind: "new", code, title, regulationKind: values.regulationKind, sourceUrl };
}

function buildRegulationTarget(
  values: SourceFormValues,
  existingRegulationId: string | null,
  errors: SourceFormErrors,
): RegulationTarget {
  if (existingRegulationId !== null) {
    return { kind: "existing", regulationId: existingRegulationId };
  }
  return areRegulationFieldsShown(values.kind)
    ? buildNewRegulation(values, errors)
    : { kind: "fromUrl", url: values.url.trim() };
}

/** The version label field is hidden for a URL source, which then gets the default label. */
function findVersionLabel(values: SourceFormValues, defaultVersionLabel: string): string {
  return areRegulationFieldsShown(values.kind) ? values.versionLabel.trim() : defaultVersionLabel;
}

export function buildDraftPoliciesInput(
  values: SourceFormValues,
  {
    existingRegulationId,
    capabilities,
    defaultVersionLabel,
  }: { existingRegulationId: string | null; capabilities: SourceCapabilities; defaultVersionLabel: string },
): { isValid: true; input: DraftPoliciesInput } | { isValid: false; errors: SourceFormErrors } {
  const errors: SourceFormErrors = {};
  const sourceResult = buildSource(values, capabilities);
  if ("errorKey" in sourceResult) {
    errors.source = sourceResult.errorKey;
  }
  const regulation = buildRegulationTarget(values, existingRegulationId, errors);
  const versionLabel = findVersionLabel(values, defaultVersionLabel);
  if (versionLabel === "") {
    errors.versionLabel = "validationVersionLabel";
  }
  if ("errorKey" in sourceResult || Object.keys(errors).length > 0) {
    return { isValid: false, errors };
  }
  return { isValid: true, input: { source: sourceResult.source, regulation, versionLabel } };
}
