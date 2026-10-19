import { deriveRegulationFromUrl } from "./policyGeneration";

describe("deriveRegulationFromUrl", () => {
  it("derives the metadata of an EU regulation from its EUR-Lex URL", () => {
    expect(deriveRegulationFromUrl("https://eur-lex.europa.eu/eli/reg/2024/1624/oj")).toEqual({
      kind: "new",
      code: "eur-lex.europa.eu/oj",
      title: "eur-lex.europa.eu/oj",
      regulationKind: "eu_reg",
      sourceUrl: "https://eur-lex.europa.eu/eli/reg/2024/1624/oj",
    });
  });

  it("treats other URLs as a national act and shortens a long code", () => {
    const regulation = deriveRegulationFromUrl("https://www.zakonyprolidi.cz/cs/2008-253-o-aml-opatrenich");

    expect(regulation.regulationKind).toBe("law");
    expect(regulation.title).toBe("www.zakonyprolidi.cz/2008-253-o-aml-opatrenich");
    expect(regulation.code).toHaveLength(27);
    expect(regulation.code.endsWith("…")).toBe(true);
  });
});
