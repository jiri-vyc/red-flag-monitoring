import { z } from "zod";

import type { RegulationSource } from "./types";

export type SourceKind = RegulationSource["kind"];

export type SourceFormValues = {
  kind: SourceKind;
  file: File | null;
  url: string;
  text: string;
  regulationName: string;
};

export type SourceFormErrorKey = "validationFile" | "validationUrl" | "validationText";

const MIN_TEXT_LENGTH = 50;
const ACCEPTED_FILE_PATTERN = /\.(pdf|md|markdown)$/i;

export function buildRegulationSource(
  values: SourceFormValues,
): { isValid: true; source: RegulationSource } | { isValid: false; errorKey: SourceFormErrorKey } {
  switch (values.kind) {
    case "file":
      return values.file && ACCEPTED_FILE_PATTERN.test(values.file.name)
        ? { isValid: true, source: { kind: "file", file: values.file } }
        : { isValid: false, errorKey: "validationFile" };
    case "url":
      return z.url().safeParse(values.url.trim()).success
        ? { isValid: true, source: { kind: "url", url: values.url.trim() } }
        : { isValid: false, errorKey: "validationUrl" };
    case "text":
      return values.text.trim().length >= MIN_TEXT_LENGTH
        ? { isValid: true, source: { kind: "text", text: values.text.trim() } }
        : { isValid: false, errorKey: "validationText" };
  }
}
