import type { Regulation } from "@/features/regulations/types";

import {
  detectRegulationMetadata,
  findMatchingRegulation,
  findOverwrittenFields,
  findUndoChanges,
  pickMetadataValues,
  toMetadataFormChanges,
  toRegulationCode,
} from "./regulationMetadata";

// Headers copied from knowledgebase/regulace/plne-zneni/*.md and the wizard test excerpt of § 6 of the AML act.
const AML_ACT_HEADER = `# Zákon č. 253/2008 Sb., o některých opatřeních proti legalizaci výnosů z trestné činnosti a financování terorismu (AML zákon)

> **Znění:** aktuální znění účinné od 11. 1. 2026 (poslední novela: zákon č. 280/2025 Sb.)
> **Zdroj textu:** https://www.zakonyprolidi.cz/cs/2008-253 (verze 32)
> **Oficiální zdroj (ověření):** https://e-sbirka.gov.cz/sb/2008/253 (e-Sbírka, typ znění AKTUALNI)
> **Staženo:** 2026-10-19

---

253`;

const AML_SECTION_6_EXCERPT = `# Zákon č. 253/2008 Sb., o některých opatřeních proti legalizaci výnosů z trestné činnosti a financování terorismu (AML zákon): § 6 Podezřelý obchod

> **Výňatek pro test wizardu RedFlag.** Znění účinné od 11. 1. 2026 (poslední novela: zákon č. 280/2025 Sb.).
> **Zdroj textu:** https://www.zakonyprolidi.cz/cs/2008-253, oficiální znění https://e-sbirka.gov.cz/sb/2008/253.
> **Poznámka:** Informativní konsolidované znění. Právně závazné je znění ve Sbírce zákonů.

### § 6`;

const CNB_DECREE_HEADER = `# Vyhláška ČNB č. 67/2018 Sb., o některých požadavcích na systém vnitřních zásad, postupů a kontrolních opatření proti legalizaci výnosů z trestné činnosti a financování terorismu

> **Znění:** aktuální znění účinné od 30. 12. 2024 (poslední novela: vyhláška č. 403/2024 Sb.)
> **Zdroj textu:** https://www.zakonyprolidi.cz/cs/2018-67 (verze 4)
> **Oficiální zdroj (ověření):** https://e-sbirka.gov.cz/sb/2018/67 (e-Sbírka, typ znění AKTUALNI)`;

const AMLR_HEADER = `# Nařízení Evropského parlamentu a Rady (EU) 2024/1624 o předcházení využívání finančního systému k praní peněz nebo financování terorismu (AMLR)

> **Znění:** konsolidované znění CELEX 02024R1624-20240619, verze 000.004, včetně opravy C1 (Úř. věst. L 2026/90526, 26. 6. 2026)
> **Zdroj:** http://publications.europa.eu/resource/celex/02024R1624-20240619 (Úřad pro publikace EU, Cellar)
> **EUR-Lex:** https://eur-lex.europa.eu/legal-content/CS/TXT/?uri=CELEX:02024R1624-20240619`;

const AMLD5_HEADER = `# Směrnice Evropského parlamentu a Rady (EU) 2018/843, kterou se mění směrnice (EU) 2015/849 (AMLD5)

> **Znění:** původní znění, Úř. věst. L 156, 19. 6. 2018, s. 43 (pozměňující směrnice, sama se nekonsoliduje)
> **Zdroj:** http://publications.europa.eu/resource/celex/32018L0843 (Úřad pro publikace EU, Cellar)`;

const EBA_GUIDELINES_AMENDMENT_HEADER = `# Obecné pokyny EBA/GL/2024/01, kterými se mění obecné pokyny EBA/GL/2021/02 k rizikovým faktorům (kryptoaktiva)

> **Znění:** z 16. 1. 2024, oficiální český překlad
> **Zdroj:** https://www.eba.europa.eu/sites/default/files/2024-06/a3e89f4f/GL%20amending%20EBA%20GL%202021%2002_CS.pdf  `;

const FAU_METHODOLOGY_HEADER = `# Metodický pokyn FAÚ č. 4 – Oznámení podezřelého obchodu

> **Znění:** ze dne 26. 8. 2025, č. j. FAU-121182/2025/03, účinnost od 29. 8. 2025
> **Zdroj:** https://fau.gov.cz/assets/cs/cmsmedia/Metodick%c3%a9%20pokyny/Metodika%20%c4%8d.%204_OPO1.pdf
> **Seznam metodik FAÚ:** https://fau.gov.cz/cs/rozcestnik/legislativa-a-metodika/metodicke-pokyny-265  `;

const CNB_BENCHMARK_HEADER = `# Dohledový benchmark ČNB č. 2/2023 – K provádění kontroly klienta prostřednictvím systému k monitoringu transakcí

> **Znění:** ze dne 3. 7. 2023 (číslo 2/2023 uvedeno v samotném dokumentu)
> **Zdroj:** https://www.cnb.cz/export/sites/cnb/cs/dohled-financni-trh/dohledovy_benchmark_2023_02.pdf  `;

const FATF_HEADER = `# International Standards on Combating Money Laundering and the Financing of Terrorism & Proliferation – The FATF Recommendations

> **Znění:** Updated June 2026 (PDF vytvořeno 22. 6. 2026), 151 stran, anglický originál
> **Oficiální stránka:** https://www.fatf-gafi.org/en/publications/Fatfrecommendations/Fatf-recommendations.html
> **Zdroj PDF:** https://eurasiangroup.org/files/uploads/files/FATF_Recommendations_2026_eng.pdf (Eurasian Group, regionální orgán FATF)  `;

function createRegulation(overrides: Partial<Regulation>): Regulation {
  return {
    id: "reg-1",
    name: "Regulace",
    shortName: "REG",
    jurisdiction: "CZ",
    description: "",
    sourceUrl: "",
    version: "",
    lastCheckedAt: "",
    keyProvisions: [],
    policyIds: [],
    ruleIds: [],
    ...overrides,
  };
}

const VYHL67 = createRegulation({
  id: "reg-vyhl67",
  shortName: "VYHL67",
  name: "Vyhláška ČNB č. 67/2018 Sb., o některých požadavcích na systém vnitřních zásad, postupů a kontrolních opatření proti legalizaci výnosů z trestné činnosti a financování terorismu",
  sourceUrl: "https://e-sbirka.gov.cz/sb/2018/67",
});
const AMLR = createRegulation({
  id: "reg-amlr",
  shortName: "AMLR",
  name: "Nařízení (EU) 2024/1624",
  sourceUrl: "https://eur-lex.europa.eu/legal-content/CS/TXT/?uri=CELEX:02024R1624-20240619",
});
const AML_ACT = createRegulation({
  id: "reg-aml-act",
  shortName: "AML zákon",
  name: "Zákon č. 253/2008 Sb., o některých opatřeních proti legalizaci výnosů z trestné činnosti",
  sourceUrl: "https://www.zakonyprolidi.cz/cs/2008-253",
});

const EMPTY_METADATA_VALUES = {
  title: "",
  regulationKind: "law" as const,
  code: "",
  sourceUrl: "",
  versionLabel: "Znění k 2026-10-20",
};

describe("detectRegulationMetadata", () => {
  it("reads a Czech act from the knowledge base header", () => {
    expect(detectRegulationMetadata(AML_ACT_HEADER)).toEqual({
      title:
        "Zákon č. 253/2008 Sb., o některých opatřeních proti legalizaci výnosů z trestné činnosti a financování terorismu (AML zákon)",
      kind: "law",
      code: "AML-ZAKON",
      sourceUrl: "https://www.zakonyprolidi.cz/cs/2008-253",
      versionLabel: "Znění od 11. 1. 2026",
    });
  });

  it("reads the § 6 excerpt, taking the first URL of the source line without the trailing punctuation", () => {
    expect(detectRegulationMetadata(AML_SECTION_6_EXCERPT)).toEqual({
      title:
        "Zákon č. 253/2008 Sb., o některých opatřeních proti legalizaci výnosů z trestné činnosti a financování terorismu (AML zákon): § 6 Podezřelý obchod",
      kind: "law",
      code: "AML-ZAKON",
      sourceUrl: "https://www.zakonyprolidi.cz/cs/2008-253",
      versionLabel: "Znění od 11. 1. 2026",
    });
  });

  it("codes a decree without an abbreviation by its number", () => {
    expect(detectRegulationMetadata(CNB_DECREE_HEADER)).toMatchObject({
      kind: "decree",
      code: "V-67-2018",
      sourceUrl: "https://www.zakonyprolidi.cz/cs/2018-67",
      versionLabel: "Znění od 30. 12. 2024",
    });
  });

  it("reads EU acts and prefers the closing abbreviation to the act numbers", () => {
    expect(detectRegulationMetadata(AMLR_HEADER)).toEqual({
      title:
        "Nařízení Evropského parlamentu a Rady (EU) 2024/1624 o předcházení využívání finančního systému k praní peněz nebo financování terorismu (AMLR)",
      kind: "eu_reg",
      code: "AMLR",
      sourceUrl: "http://publications.europa.eu/resource/celex/02024R1624-20240619",
    });
    expect(detectRegulationMetadata(AMLD5_HEADER)).toMatchObject({ kind: "eu_dir", code: "AMLD5" });
  });

  it("does not take the date an act is replaced for its wording date", () => {
    const header = `${AMLD5_HEADER}\n> **Poznámka:** S účinností od 10. 7. 2027 ji nahrazuje AMLR.`;

    expect(detectRegulationMetadata(header)).not.toHaveProperty("versionLabel");
    expect(detectRegulationMetadata("# Text\nToto znění je účinné od 1. 2. 2025.").versionLabel).toBe(
      "Znění od 1. 2. 2025",
    );
  });

  it("codes guidance by the EBA reference and ignores a lower-case remark in parentheses", () => {
    expect(detectRegulationMetadata(EBA_GUIDELINES_AMENDMENT_HEADER)).toMatchObject({
      kind: "guidance",
      code: "EBA-GL-2024-01",
    });
  });

  it("recognises guidance without a code and reads the effective date of a methodology", () => {
    expect(detectRegulationMetadata(FAU_METHODOLOGY_HEADER)).toEqual({
      title: "Metodický pokyn FAÚ č. 4 – Oznámení podezřelého obchodu",
      kind: "guidance",
      sourceUrl:
        "https://fau.gov.cz/assets/cs/cmsmedia/Metodick%c3%a9%20pokyny/Metodika%20%c4%8d.%204_OPO1.pdf",
      versionLabel: "Znění od 29. 8. 2025",
    });
    expect(detectRegulationMetadata(CNB_BENCHMARK_HEADER)).toMatchObject({ kind: "guidance" });
    expect(detectRegulationMetadata(CNB_BENCHMARK_HEADER)).not.toHaveProperty("versionLabel");
  });

  it("prefers a source line to an earlier unlabelled URL", () => {
    expect(detectRegulationMetadata(FATF_HEADER)).toMatchObject({
      kind: "guidance",
      sourceUrl: "https://eurasiangroup.org/files/uploads/files/FATF_Recommendations_2026_eng.pdf",
    });
  });

  it("maps the EU act numbers, the CZ act numbers and EBA references to codes", () => {
    expect(detectRegulationMetadata("# Zákon č. 253/2008 Sb., o AML").code).toBe("Z-253-2008");
    expect(detectRegulationMetadata("# Vyhláška č. 67/2018 Sb.").code).toBe("V-67-2018");
    expect(detectRegulationMetadata("# Nařízení (EU) 2024/1624 o AML").code).toBe("EU-2024-1624");
    expect(detectRegulationMetadata("# Obecné pokyny EBA/GL/2021/02").code).toBe("EBA-GL-2021-02");
  });

  it("detects the act type from the title keywords", () => {
    const kindOf = (title: string) => detectRegulationMetadata(`# ${title}`).kind;

    expect(kindOf("Nařízení (EU) 2023/1113 o převodech")).toBe("eu_reg");
    expect(kindOf("Směrnice (EU) 2015/849")).toBe("eu_dir");
    expect(kindOf("Guidelines on ML/TF risk factors")).toBe("guidance");
    expect(kindOf("Doporučení ČNB k hodnocení rizik")).toBe("guidance");
    expect(kindOf("Metodika FAÚ č. 4")).toBe("guidance");
    expect(kindOf("Směrnice o oběhu dokumentů")).toBeUndefined();
    expect(kindOf("Nařízení vlády č. 1/2020 Sb.")).toBeUndefined();
  });

  it("takes a short first line of a plain text as the title, but not a long paragraph", () => {
    expect(detectRegulationMetadata("\n  Zákon č. 253/2008 Sb.  \n§ 1 Předmět úpravy")).toEqual({
      title: "Zákon č. 253/2008 Sb.",
      kind: "law",
      code: "Z-253-2008",
    });
    expect(detectRegulationMetadata(`${"Povinná osoba sleduje obchody. ".repeat(10)}\n§ 2`)).toEqual({});
  });

  it("reads only the header and only http(s) URLs", () => {
    const lateUrl = `# Text\n${"řádek\n".repeat(70)}Zdroj: https://example.org/late`;

    expect(detectRegulationMetadata(lateUrl)).toEqual({ title: "Text" });
    expect(detectRegulationMetadata("# Text\n> Zdroj: ftp://example.org/aml")).toEqual({ title: "Text" });
    expect(detectRegulationMetadata("")).toEqual({});
  });
});

describe("toRegulationCode", () => {
  it("makes an ASCII upper-case code with dashes", () => {
    expect(toRegulationCode(" AML zákon ")).toBe("AML-ZAKON");
    expect(toRegulationCode("EBA/GL/2021/02")).toBe("EBA-GL-2021-02");
  });
});

describe("findMatchingRegulation", () => {
  const regulations = [AML_ACT, AMLR, VYHL67];

  it("matches by code, ignoring case and separators", () => {
    expect(findMatchingRegulation({ code: "amlr" }, regulations)).toBe(AMLR);
    expect(findMatchingRegulation({ code: "AML-ZAKON" }, regulations)).toBe(AML_ACT);
  });

  it("matches by the source URL, ignoring the scheme, www and a trailing slash", () => {
    expect(findMatchingRegulation({ sourceUrl: "http://zakonyprolidi.cz/cs/2008-253/" }, regulations)).toBe(
      AML_ACT,
    );
  });

  it("matches the CNB decree by its title", () => {
    expect(findMatchingRegulation(detectRegulationMetadata(CNB_DECREE_HEADER), regulations)).toBe(VYHL67);
  });

  it("returns null without a match", () => {
    expect(findMatchingRegulation(detectRegulationMetadata(FATF_HEADER), regulations)).toBeNull();
    expect(findMatchingRegulation({}, regulations)).toBeNull();
  });
});

describe("filling the form from the detected metadata", () => {
  const detected = detectRegulationMetadata(CNB_DECREE_HEADER);

  it("fills every detected field of a new regulation, but only the version label of an existing one", () => {
    expect(toMetadataFormChanges(detected, { isNewRegulation: true })).toEqual({
      title: detected.title,
      regulationKind: "decree",
      code: "V-67-2018",
      sourceUrl: "https://www.zakonyprolidi.cz/cs/2018-67",
      versionLabel: "Znění od 30. 12. 2024",
    });
    expect(toMetadataFormChanges(detected, { isNewRegulation: false })).toEqual({
      versionLabel: "Znění od 30. 12. 2024",
    });
    expect(toMetadataFormChanges({ title: "Text" }, { isNewRegulation: true })).toEqual({ title: "Text" });
  });

  it("reports only the fields with an own value that differs", () => {
    const changes = toMetadataFormChanges(detected, { isNewRegulation: true });

    expect(findOverwrittenFields(EMPTY_METADATA_VALUES, changes, EMPTY_METADATA_VALUES)).toEqual([]);
    expect(
      findOverwrittenFields(
        {
          ...EMPTY_METADATA_VALUES,
          code: "VYHL",
          sourceUrl: changes.sourceUrl ?? "",
          regulationKind: "eu_reg",
        },
        changes,
        EMPTY_METADATA_VALUES,
      ),
    ).toEqual(["regulationKind", "code"]);
  });

  it("keeps the previous values of the filled fields for an undo", () => {
    expect(
      pickMetadataValues({ ...EMPTY_METADATA_VALUES, code: "OLD" }, { code: "NEW", versionLabel: "Znění" }),
    ).toEqual({ code: "OLD", versionLabel: EMPTY_METADATA_VALUES.versionLabel });
  });
});

describe("findUndoChanges", () => {
  it("restores only the fields that still hold the filled value", () => {
    const fill = {
      previousValues: { code: "", title: "", versionLabel: "Znění k 2026-10-20" },
      filledValues: { code: "V-67-2018", title: "Vyhláška", versionLabel: "Znění od 30. 12. 2024" },
    };
    const values = {
      ...EMPTY_METADATA_VALUES,
      code: "VYHL67",
      title: "Vyhláška",
      versionLabel: "Znění od 30. 12. 2024",
    };

    expect(findUndoChanges(values, fill)).toEqual({ title: "", versionLabel: "Znění k 2026-10-20" });
  });
});

describe("detectRegulationMetadata performance", () => {
  const ONE_MEGABYTE = 1024 * 1024;
  const PATHOLOGICAL_TEXTS = {
    "wording without a date": `# Text\n${"znění účinné od ".repeat(ONE_MEGABYTE / 16)}`,
    "one huge line": "znění ".repeat(ONE_MEGABYTE / 6),
    "trailing punctuation in a URL": `Zdroj: https://example.org/${".".repeat(ONE_MEGABYTE)}x`,
    "punctuation and spaces": `# ${". ,".repeat(ONE_MEGABYTE / 3)}x`,
    "unclosed parentheses": `# ${"(A".repeat(ONE_MEGABYTE / 2)}`,
  };

  it.each(Object.entries(PATHOLOGICAL_TEXTS))("handles 1 MB of %s in under 100 ms", (_name, text) => {
    const startedAt = performance.now();
    const detected = detectRegulationMetadata(text);
    findMatchingRegulation(detected, [createRegulation({ name: `${" .".repeat(ONE_MEGABYTE / 2)}x` })]);

    expect(performance.now() - startedAt).toBeLessThan(100);
  });
});
