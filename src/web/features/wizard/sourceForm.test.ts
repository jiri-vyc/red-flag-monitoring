import {
  areRegulationFieldsShown,
  buildDraftPoliciesInput,
  isSourceKindSupported,
  SOURCE_KINDS,
  type SourceFormValues,
} from "./sourceForm";

const LIVE_CAPABILITIES = { canFetchUrl: false };
const MOCK_CAPABILITIES = { canFetchUrl: true };
const DEFAULT_VERSION_LABEL = "Znění k 2026-10-19";
const REGULATION_URL = "https://eur-lex.europa.eu/eli/reg/2024/1624/oj";

const VALUES: SourceFormValues = {
  kind: "text",
  file: null,
  url: "",
  text: "§ 1 Povinná osoba průběžně sleduje obchodní vztahy a transakce svých klientů.",
  code: " AMLZ ",
  title: "Zákon o AML",
  regulationKind: "law",
  sourceUrl: "",
  versionLabel: "Znění 2026",
};

const NEW_REGULATION = {
  existingRegulationId: null,
  capabilities: LIVE_CAPABILITIES,
  defaultVersionLabel: DEFAULT_VERSION_LABEL,
};
const NEW_MOCK_REGULATION = { ...NEW_REGULATION, capabilities: MOCK_CAPABILITIES };

describe("source form", () => {
  it("offers every source kind, but a URL can be submitted only where it can be loaded", () => {
    expect(SOURCE_KINDS).toEqual(["file", "url", "text"]);
    expect(isSourceKindSupported("url", LIVE_CAPABILITIES)).toBe(false);
    expect(isSourceKindSupported("url", MOCK_CAPABILITIES)).toBe(true);
    expect(isSourceKindSupported("file", LIVE_CAPABILITIES)).toBe(true);
    expect(isSourceKindSupported("text", LIVE_CAPABILITIES)).toBe(true);
  });

  it("asks for the regulation metadata only for a file and pasted text", () => {
    expect(areRegulationFieldsShown("file")).toBe(true);
    expect(areRegulationFieldsShown("text")).toBe(true);
    expect(areRegulationFieldsShown("url")).toBe(false);
  });

  it("builds a new regulation from the trimmed metadata, without a source URL when it is empty", () => {
    expect(buildDraftPoliciesInput(VALUES, NEW_REGULATION)).toEqual({
      isValid: true,
      input: {
        source: { kind: "text", text: VALUES.text },
        regulation: {
          kind: "new",
          code: "AMLZ",
          title: "Zákon o AML",
          regulationKind: "law",
          sourceUrl: null,
        },
        versionLabel: "Znění 2026",
      },
    });
  });

  it("requires the metadata of a new regulation and an http(s) source URL", () => {
    const result = buildDraftPoliciesInput(
      { ...VALUES, code: "", title: " ", sourceUrl: "javascript:alert(1)", versionLabel: "" },
      NEW_REGULATION,
    );

    expect(result).toEqual({
      isValid: false,
      errors: {
        code: "validationCode",
        title: "validationTitle",
        sourceUrl: "validationSourceUrl",
        versionLabel: "validationVersionLabel",
      },
    });
  });

  it("needs no metadata when it adds a wording to an existing regulation", () => {
    const result = buildDraftPoliciesInput(
      { ...VALUES, code: "", title: "" },
      { ...NEW_REGULATION, existingRegulationId: "reg-1" },
    );

    expect(result).toMatchObject({
      isValid: true,
      input: { regulation: { kind: "existing", regulationId: "reg-1" } },
    });
  });

  it("accepts only a Markdown file", () => {
    const fileValues = (name: string) => ({ ...VALUES, kind: "file" as const, file: new File(["x"], name) });

    expect(buildDraftPoliciesInput(fileValues("aml.pdf"), NEW_MOCK_REGULATION)).toEqual({
      isValid: false,
      errors: { source: "validationFile" },
    });
    expect(buildDraftPoliciesInput(fileValues("aml.md"), NEW_REGULATION).isValid).toBe(true);
    expect(buildDraftPoliciesInput(fileValues("AML.markdown"), NEW_REGULATION).isValid).toBe(true);
  });

  it("derives a new regulation from a URL alone, ignoring the hidden metadata fields", () => {
    const result = buildDraftPoliciesInput(
      { ...VALUES, kind: "url", url: ` ${REGULATION_URL} `, code: "", title: "", versionLabel: "" },
      NEW_MOCK_REGULATION,
    );

    expect(result).toEqual({
      isValid: true,
      input: {
        source: { kind: "url", url: REGULATION_URL },
        regulation: { kind: "fromUrl", url: REGULATION_URL },
        versionLabel: DEFAULT_VERSION_LABEL,
      },
    });
  });

  it("adds a URL wording to an existing regulation", () => {
    const result = buildDraftPoliciesInput(
      { ...VALUES, kind: "url", url: REGULATION_URL },
      { ...NEW_MOCK_REGULATION, existingRegulationId: "reg-1" },
    );

    expect(result).toMatchObject({
      isValid: true,
      input: { regulation: { kind: "existing", regulationId: "reg-1" } },
    });
  });

  it("rejects a URL that is not http(s), and any URL where it cannot be loaded", () => {
    expect(
      buildDraftPoliciesInput({ ...VALUES, kind: "url", url: "ftp://x.cz" }, NEW_MOCK_REGULATION),
    ).toEqual({ isValid: false, errors: { source: "validationUrl" } });
    expect(buildDraftPoliciesInput({ ...VALUES, kind: "url", url: REGULATION_URL }, NEW_REGULATION)).toEqual({
      isValid: false,
      errors: { source: "validationUrl" },
    });
  });
});
