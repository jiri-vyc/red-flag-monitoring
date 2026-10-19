import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import type { MigrationInterface, QueryRunner } from "typeorm";

// Seeds the knowledge base as the starting content of the app: every regulation full text and both sample
// internal policies, each stored 1:1 as the markdown file (one version each, M1, M8). It then links the sample
// rules from SeedSampleRules1792438575192, which leaves policies and legal bases to this seed (M4, M5).
// Resolves to <repo>/knowledgebase from both src/ and dist/, which sit at the same depth under src/backend/.
const KNOWLEDGE_BASE_DIRECTORY = path.resolve(__dirname, "../../../../../../knowledgebase");
const REGULATIONS_DIRECTORY = "regulace/plne-zneni";
const POLICIES_DIRECTORY = "vnitrni-predpisy";
// Seeded by SeedAdminUser (M12); the sample policies are approved by the demo admin.
const ADMIN_USER_ID = "00000000-0000-4000-8000-000000000001";
const CHECKED_AT = "2026-10-19T00:00:00Z";

type RegulationSeed = {
  code: string;
  title: string;
  kind: "law" | "decree" | "eu_reg" | "eu_dir" | "guidance";
  sourceUrl: string;
  versionLabel: string;
  fileName: string;
};

type PolicyLegalBasisSeed = { regulationCode: string; ref: string | null };

type PolicySeed = {
  code: string;
  title: string;
  fileName: string;
  legalBases: PolicyLegalBasisSeed[];
};

type RuleLegalBasisSeed = { regulationCode: string; ref: string };

type RuleLinkSeed = { ruleCode: string; policyCode: string; legalBases: RuleLegalBasisSeed[] };

export const REGULATION_SEEDS: RegulationSeed[] = [
  {
    code: "AMLZ",
    title:
      "Zákon č. 253/2008 Sb., o některých opatřeních proti legalizaci výnosů z trestné činnosti a financování terorismu",
    kind: "law",
    sourceUrl: "https://e-sbirka.gov.cz/sb/2008/253",
    versionLabel: "Znění účinné od 11. 1. 2026 (poslední novela 280/2025 Sb.)",
    fileName: "zakon-253-2008-aml.md",
  },
  {
    code: "VYHL67",
    title:
      "Vyhláška ČNB č. 67/2018 Sb., o některých požadavcích na systém vnitřních zásad, postupů a kontrolních opatření proti legalizaci výnosů z trestné činnosti a financování terorismu",
    kind: "decree",
    sourceUrl: "https://e-sbirka.gov.cz/sb/2018/67",
    versionLabel: "Znění účinné od 30. 12. 2024 (poslední novela 403/2024 Sb.)",
    fileName: "vyhlaska-cnb-67-2018.md",
  },
  {
    code: "FAU-MP4",
    title: "Metodický pokyn FAÚ č. 4 – Oznámení podezřelého obchodu",
    kind: "guidance",
    sourceUrl:
      "https://fau.gov.cz/assets/cs/cmsmedia/Metodick%c3%a9%20pokyny/Metodika%20%c4%8d.%204_OPO1.pdf",
    versionLabel: "Ze dne 26. 8. 2025, účinnost od 29. 8. 2025",
    fileName: "fau-mp-04-oznameni-podezreleho-obchodu.md",
  },
  {
    code: "FAU-MP9",
    title: "Metodický pokyn FAÚ č. 9 – Kontrola klienta",
    kind: "guidance",
    sourceUrl: "https://fau.gov.cz/assets/cs/cmsmedia/Metodick%c3%a9%20pokyny/mp-c-9-kontrola-klienta.pdf",
    versionLabel: "Ze dne 25. 9. 2025",
    fileName: "fau-mp-09-kontrola-klienta.md",
  },
  {
    code: "FAU-MP11",
    title: "Metodický pokyn FAÚ č. 11 – Hodnocení rizik a systém vnitřních zásad povinné osoby",
    kind: "guidance",
    sourceUrl:
      "https://fau.gov.cz/assets/cs/cmsmedia/Metodick%c3%a9%20pokyny/mp-c-11-hodnoceni-rizik-a-system-vnitrni.pdf",
    versionLabel: "Ze dne 3. 9. 2025",
    fileName: "fau-mp-11-hodnoceni-rizik-svz.md",
  },
  {
    code: "AMLR",
    title:
      "Nařízení (EU) 2024/1624 o předcházení využívání finančního systému k praní peněz nebo financování terorismu (AMLR)",
    kind: "eu_reg",
    sourceUrl: "https://eur-lex.europa.eu/legal-content/CS/TXT/?uri=CELEX:02024R1624-20240619",
    versionLabel: "Konsolidované znění 02024R1624-20240619 vč. opravy C1 z 26. 6. 2026",
    fileName: "eu-2024-1624-amlr.md",
  },
  {
    code: "AMLD",
    title:
      "Směrnice (EU) 2015/849 o předcházení využívání finančního systému k praní peněz nebo financování terorismu (AMLD)",
    kind: "eu_dir",
    sourceUrl: "https://eur-lex.europa.eu/legal-content/CS/TXT/?uri=CELEX:02015L0849-20241230",
    versionLabel: "Konsolidované znění 02015L0849-20241230",
    fileName: "eu-2015-849-amld.md",
  },
  {
    code: "AMLD5",
    title: "Směrnice (EU) 2018/843, kterou se mění směrnice (EU) 2015/849 (AMLD5)",
    kind: "eu_dir",
    sourceUrl: "https://eur-lex.europa.eu/legal-content/CS/TXT/?uri=CELEX:32018L0843",
    versionLabel: "Původní znění, Úř. věst. L 156, 19. 6. 2018",
    fileName: "eu-2018-843-amld5.md",
  },
  {
    code: "AMLD6",
    title:
      "Směrnice (EU) 2024/1640 o mechanismech, které mají členské státy zavést k předcházení využívání finančního systému k praní peněz nebo financování terorismu (AMLD6)",
    kind: "eu_dir",
    sourceUrl: "https://eur-lex.europa.eu/legal-content/CS/TXT/?uri=CELEX:32024L1640",
    versionLabel: "Původní znění, Úř. věst. L 2024/1640, 19. 6. 2024",
    fileName: "eu-2024-1640-amld6.md",
  },
  {
    code: "TFR",
    title:
      "Nařízení (EU) 2023/1113 o informacích doprovázejících převody peněžních prostředků a některých kryptoaktiv (TFR)",
    kind: "eu_reg",
    sourceUrl: "https://eur-lex.europa.eu/legal-content/CS/TXT/?uri=CELEX:32023R1113",
    versionLabel: "Původní znění, Úř. věst. L 150, 9. 6. 2023",
    fileName: "eu-2023-1113-tfr.md",
  },
  {
    code: "FATF-R",
    title: "The FATF Recommendations",
    kind: "guidance",
    sourceUrl: "https://www.fatf-gafi.org/en/publications/Fatfrecommendations/Fatf-recommendations.html",
    versionLabel: "Updated June 2026",
    fileName: "fatf-recommendations.md",
  },
  {
    code: "EBA-GL-2021-02",
    title: "Obecné pokyny EBA k rizikovým faktorům praní peněz a financování terorismu (EBA/GL/2021/02)",
    kind: "guidance",
    sourceUrl:
      "https://www.eba.europa.eu/sites/default/documents/files/document_library/Publications/Guidelines/2021/Guidelines%20on%20ML-TF%20risk%20factors%20%28revised%29%202021-02/Translations/1016921/Guidelines%20ML%20TF%20Risk%20Factors_CS.pdf",
    versionLabel: "Původní znění z 1. 3. 2021, český překlad",
    fileName: "eba-gl-2021-02-rizikove-faktory.md",
  },
  {
    code: "EBA-GL-2023-03",
    title: "Obecné pokyny EBA/GL/2023/03, kterými se mění obecné pokyny EBA/GL/2021/02",
    kind: "guidance",
    sourceUrl:
      "https://www.eba.europa.eu/sites/default/documents/files/document_library/Publications/Guidelines/2023/EBA-GL-2023-03/Tranlsations/1061436/GL%20amending%20EBA%20GL%202021%2002%20%28EBA%20GL%202023%2003%29_CS_COR.pdf",
    versionLabel: "Z 31. 3. 2023, český překlad",
    fileName: "eba-gl-2023-03-novela-rizikove-faktory.md",
  },
  {
    code: "EBA-GL-2024-01",
    title: "Obecné pokyny EBA/GL/2024/01, kterými se mění obecné pokyny EBA/GL/2021/02 (kryptoaktiva)",
    kind: "guidance",
    sourceUrl:
      "https://www.eba.europa.eu/sites/default/files/2024-06/a3e89f4f-fbf3-4bd6-9e07-35f3243555b3/GL%20amending%20EBA%20GL%202021%2002%20%28EBA%20GL%202024%2001%29_CS.pdf",
    versionLabel: "Z 16. 1. 2024, český překlad",
    fileName: "eba-gl-2024-01-novela-rizikove-faktory.md",
  },
  {
    code: "EBA-GL-2022-05",
    title:
      "Obecné pokyny EBA k úloze a povinnostem kontrolora dodržování předpisů v oblasti AML/CFT (EBA/GL/2022/05)",
    kind: "guidance",
    sourceUrl:
      "https://www.eba.europa.eu/sites/default/documents/files/document_library/Publications/Guidelines/2022/EBA-GL-2022-05%20GLs%20on%20AML%20compliance%20officers/Translations/1039057/GL%20on%20AMLCFT%20compliance%20officers%20%28EBA%20GL%202022%2005%29_CS_COR.pdf",
    versionLabel: "Z 14. 6. 2022, český překlad",
    fileName: "eba-gl-2022-05-compliance-officer.md",
  },
  {
    code: "BM2023",
    title:
      "Dohledový benchmark ČNB č. 2/2023 – K provádění kontroly klienta prostřednictvím systému k monitoringu transakcí",
    kind: "guidance",
    sourceUrl:
      "https://www.cnb.cz/export/sites/cnb/cs/dohled-financni-trh/.galleries/vykon_dohledu/dohledove_benchmarky/download/dohledovy_benchmark_2023_02.pdf",
    versionLabel: "Ze dne 3. 7. 2023",
    fileName: "cnb-benchmark-2023-02-monitoring-transakci.md",
  },
];

// Legal bases are the "Vychází z regulace" and "Navazující předpisy" rows of each policy header (M3).
export const POLICY_SEEDS: PolicySeed[] = [
  {
    code: "SVZ-03",
    title: "Směrnice o monitoringu transakcí a identifikaci podezřelých obchodů",
    fileName: "svz-03-monitoring-transakci.md",
    legalBases: [
      { regulationCode: "VYHL67", ref: "§ 7, § 9 odst. 2–6, § 17, § 17a, § 18" },
      { regulationCode: "AMLZ", ref: "§ 6, § 9, § 16, § 18, § 20, § 21, § 38" },
      { regulationCode: "BM2023", ref: null },
      { regulationCode: "FAU-MP4", ref: null },
    ],
  },
  {
    code: "SVZ-06",
    title: "Směrnice o monitoringu plateb a remitencí podle rizikových faktorů EBA",
    fileName: "svz-06-monitoring-plateb-a-remitenci.md",
    legalBases: [
      { regulationCode: "EBA-GL-2021-02", ref: "Obecný pokyn č. 11, body 11.5–11.15" },
      { regulationCode: "AMLZ", ref: "§ 6, § 9, § 18" },
      { regulationCode: "VYHL67", ref: "§ 9 odst. 5" },
      { regulationCode: "TFR", ref: "čl. 7" },
    ],
  },
];

// Policy and legal basis of each sample rule, from the "Zdroj" section of its file in knowledgebase/pravidla-priklady.
export const RULE_LINK_SEEDS: RuleLinkSeed[] = [
  {
    ruleCode: "R-01",
    policyCode: "SVZ-03",
    legalBases: [
      { regulationCode: "VYHL67", ref: "§ 9 odst. 4 písm. c) a odst. 5" },
      { regulationCode: "AMLZ", ref: "§ 6 odst. 1 písm. b), d), e)" },
    ],
  },
  {
    ruleCode: "R-02",
    policyCode: "SVZ-03",
    legalBases: [
      { regulationCode: "VYHL67", ref: "§ 9 odst. 3 písm. a) a odst. 4 písm. a)" },
      { regulationCode: "AMLZ", ref: "§ 6 odst. 1 písm. h)" },
    ],
  },
  {
    ruleCode: "R-03",
    policyCode: "SVZ-03",
    legalBases: [
      { regulationCode: "VYHL67", ref: "§ 9 odst. 3 písm. c)" },
      { regulationCode: "AMLZ", ref: "§ 9a" },
    ],
  },
  {
    ruleCode: "R-04",
    policyCode: "SVZ-03",
    legalBases: [{ regulationCode: "AMLZ", ref: "§ 6 odst. 1 písm. a), d), f)" }],
  },
  {
    ruleCode: "R-05",
    policyCode: "SVZ-03",
    legalBases: [
      { regulationCode: "VYHL67", ref: "§ 9 odst. 4 písm. e)" },
      { regulationCode: "AMLZ", ref: "§ 6 odst. 1 písm. e)" },
    ],
  },
  {
    ruleCode: "R-06",
    policyCode: "SVZ-03",
    legalBases: [{ regulationCode: "AMLZ", ref: "§ 6 odst. 1 písm. b), f)" }],
  },
  {
    ruleCode: "R-07",
    policyCode: "SVZ-06",
    legalBases: [{ regulationCode: "EBA-GL-2021-02", ref: "Obecný pokyn č. 11, bod 11.13 a)" }],
  },
  {
    ruleCode: "R-08",
    policyCode: "SVZ-06",
    legalBases: [{ regulationCode: "EBA-GL-2021-02", ref: "Obecný pokyn č. 11, bod 11.7 b) iv." }],
  },
  {
    ruleCode: "R-09",
    policyCode: "SVZ-06",
    legalBases: [
      { regulationCode: "EBA-GL-2021-02", ref: "Obecný pokyn č. 11, body 11.13 b) a 11.7 b) vii." },
    ],
  },
  {
    ruleCode: "R-10",
    policyCode: "SVZ-06",
    legalBases: [{ regulationCode: "EBA-GL-2021-02", ref: "Obecný pokyn č. 11, bod 11.5 d)" }],
  },
  {
    ruleCode: "R-11",
    policyCode: "SVZ-06",
    legalBases: [{ regulationCode: "EBA-GL-2021-02", ref: "Obecný pokyn č. 11, bod 11.7 b) v." }],
  },
  {
    ruleCode: "R-12",
    policyCode: "SVZ-06",
    legalBases: [{ regulationCode: "EBA-GL-2021-02", ref: "Obecný pokyn č. 11, bod 11.7 b) v." }],
  },
  {
    ruleCode: "R-13",
    policyCode: "SVZ-06",
    legalBases: [{ regulationCode: "EBA-GL-2021-02", ref: "Obecný pokyn č. 11, body 11.7 b) x. a 11.14" }],
  },
  {
    ruleCode: "R-14",
    policyCode: "SVZ-06",
    legalBases: [
      { regulationCode: "EBA-GL-2021-02", ref: "Obecný pokyn č. 11, body 11.5 c), 11.6 a) a 11.14" },
      { regulationCode: "AMLZ", ref: "§ 9 odst. 1 písm. a) bod 1" },
    ],
  },
  {
    ruleCode: "R-15",
    policyCode: "SVZ-06",
    legalBases: [{ regulationCode: "EBA-GL-2021-02", ref: "Obecný pokyn č. 11, body 11.5 b) a 11.8 a)" }],
  },
  {
    ruleCode: "R-16",
    policyCode: "SVZ-06",
    legalBases: [
      { regulationCode: "EBA-GL-2021-02", ref: "Obecný pokyn č. 11, body 11.11 d), 11.13 e) a 11.15" },
    ],
  },
  {
    ruleCode: "R-17",
    policyCode: "SVZ-06",
    legalBases: [
      { regulationCode: "EBA-GL-2021-02", ref: "Obecný pokyn č. 11, bod 11.7 b) viii." },
      { regulationCode: "TFR", ref: "čl. 7 a 8" },
    ],
  },
];

export class SeedRegulationsAndPolicies1792440000000 implements MigrationInterface {
  name = "SeedRegulationsAndPolicies1792440000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const regulation of REGULATION_SEEDS) {
      await insertRegulation(queryRunner, regulation);
    }

    for (const policy of POLICY_SEEDS) {
      await insertPolicy(queryRunner, policy);
    }

    for (const ruleLink of RULE_LINK_SEEDS) {
      await linkRule(queryRunner, ruleLink);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const policyCodes = POLICY_SEEDS.map((policy) => policy.code);
    const regulationCodes = REGULATION_SEEDS.map((regulation) => regulation.code);
    const policyIds = `SELECT "id" FROM "internal_policies" WHERE "code" = ANY($1)`;
    const regulationVersionIds = `SELECT "v"."id" FROM "regulation_versions" "v"
       JOIN "regulations" "r" ON "r"."id" = "v"."regulation_id" WHERE "r"."code" = ANY($1)`;

    // Unlinks the sample rules first; the rules themselves belong to SeedSampleRules.
    await queryRunner.query(
      `DELETE FROM "rule_legal_bases" WHERE "regulation_version_id" IN (${regulationVersionIds})`,
      [regulationCodes],
    );
    await queryRunner.query(
      `UPDATE "rule_versions" SET "derived_from_policy_version_id" = NULL
       WHERE "derived_from_policy_version_id" IN (
         SELECT "id" FROM "internal_policy_versions" WHERE "policy_id" IN (${policyIds})
       )`,
      [policyCodes],
    );
    await queryRunner.query(`UPDATE "rules" SET "policy_id" = NULL WHERE "policy_id" IN (${policyIds})`, [
      policyCodes,
    ]);

    await queryRunner.query(
      `DELETE FROM "policy_legal_bases" WHERE "policy_version_id" IN (
         SELECT "v"."id" FROM "internal_policy_versions" "v"
         JOIN "internal_policies" "p" ON "p"."id" = "v"."policy_id"
         WHERE "p"."code" = ANY($1)
       )`,
      [policyCodes],
    );
    await queryRunner.query(
      `DELETE FROM "internal_policy_versions" WHERE "policy_id" IN (SELECT "id" FROM "internal_policies" WHERE "code" = ANY($1))`,
      [policyCodes],
    );
    await queryRunner.query(`DELETE FROM "internal_policies" WHERE "code" = ANY($1)`, [policyCodes]);
    await queryRunner.query(
      `DELETE FROM "regulation_versions" WHERE "regulation_id" IN (SELECT "id" FROM "regulations" WHERE "code" = ANY($1))`,
      [regulationCodes],
    );
    await queryRunner.query(`DELETE FROM "regulations" WHERE "code" = ANY($1)`, [regulationCodes]);
  }
}

async function insertRegulation(queryRunner: QueryRunner, regulation: RegulationSeed): Promise<void> {
  const fullText = await readKnowledgeBaseFile(REGULATIONS_DIRECTORY, regulation.fileName);
  const [createdRegulation] = (await queryRunner.query(
    `INSERT INTO "regulations" ("code", "title", "kind", "source_url", "checked_at")
     VALUES ($1, $2, $3, $4, $5) RETURNING "id"`,
    [regulation.code, regulation.title, regulation.kind, regulation.sourceUrl, CHECKED_AT],
  )) as { id: string }[];
  const [createdVersion] = (await queryRunner.query(
    `INSERT INTO "regulation_versions" ("regulation_id", "label", "full_text")
     VALUES ($1, $2, $3) RETURNING md5("full_text") AS "storedMd5"`,
    [createdRegulation?.id, regulation.versionLabel, fullText],
  )) as { storedMd5: string }[];

  assertStoredVerbatim(regulation.fileName, fullText, createdVersion?.storedMd5);
}

async function insertPolicy(queryRunner: QueryRunner, policy: PolicySeed): Promise<void> {
  const body = await readKnowledgeBaseFile(POLICIES_DIRECTORY, policy.fileName);
  const [createdPolicy] = (await queryRunner.query(
    `INSERT INTO "internal_policies" ("code", "title") VALUES ($1, $2) RETURNING "id"`,
    [policy.code, policy.title],
  )) as { id: string }[];
  const [createdVersion] = (await queryRunner.query(
    `INSERT INTO "internal_policy_versions"
       ("policy_id", "version_no", "body", "status", "created_via", "created_by", "reviewed_by", "reviewed_at", "review_comment")
     VALUES ($1, 1, $2, 'approved', 'manual', $3, $3, now(), $4)
     RETURNING "id", md5("body") AS "storedMd5"`,
    [createdPolicy?.id, body, ADMIN_USER_ID, "Vzorový předpis z knowledge base, nahrán seed migrací."],
  )) as { id: string; storedMd5: string }[];

  assertStoredVerbatim(policy.fileName, body, createdVersion?.storedMd5);

  for (const legalBasis of policy.legalBases) {
    await queryRunner.query(
      `INSERT INTO "policy_legal_bases" ("policy_version_id", "regulation_version_id", "ref")
       SELECT $1, "v"."id", $3
       FROM "regulation_versions" "v" JOIN "regulations" "r" ON "r"."id" = "v"."regulation_id"
       WHERE "r"."code" = $2`,
      [createdVersion?.id, legalBasis.regulationCode, legalBasis.ref],
    );
  }
}

// Links a sample rule to its policy and adds the legal basis of its first version. A rule that is not in the
// database (e.g. its seed was reverted) is skipped. Only empty links are filled, nothing set by a user changes.
async function linkRule(queryRunner: QueryRunner, ruleLink: RuleLinkSeed): Promise<void> {
  await queryRunner.query(
    `UPDATE "rules" SET "policy_id" = "p"."id"
     FROM "internal_policies" "p"
     WHERE "rules"."code" = $1 AND "p"."code" = $2 AND "rules"."policy_id" IS NULL`,
    [ruleLink.ruleCode, ruleLink.policyCode],
  );
  // The seeded first version was derived from the policy's first version; the rules seed could not link it.
  await queryRunner.query(
    `UPDATE "rule_versions" SET "derived_from_policy_version_id" = "pv"."id"
     FROM "rules" "r", "internal_policy_versions" "pv", "internal_policies" "p"
     WHERE "rule_versions"."rule_id" = "r"."id" AND "rule_versions"."version_no" = 1
       AND "rule_versions"."derived_from_policy_version_id" IS NULL
       AND "r"."code" = $1 AND "p"."code" = $2 AND "pv"."policy_id" = "p"."id" AND "pv"."version_no" = 1`,
    [ruleLink.ruleCode, ruleLink.policyCode],
  );

  for (const legalBasis of ruleLink.legalBases) {
    await queryRunner.query(
      `INSERT INTO "rule_legal_bases" ("rule_version_id", "regulation_version_id", "ref")
       SELECT "rv"."id", "v"."id", $3
       FROM "rule_versions" "rv"
       JOIN "rules" "r" ON "r"."id" = "rv"."rule_id"
       CROSS JOIN "regulation_versions" "v"
       JOIN "regulations" "reg" ON "reg"."id" = "v"."regulation_id"
       WHERE "r"."code" = $1 AND "rv"."version_no" = 1 AND "reg"."code" = $2`,
      [ruleLink.ruleCode, legalBasis.regulationCode, legalBasis.ref],
    );
  }
}

async function readKnowledgeBaseFile(directory: string, fileName: string): Promise<string> {
  const filePath = path.join(KNOWLEDGE_BASE_DIRECTORY, directory, fileName);

  try {
    return await readFile(filePath, "utf8");
  } catch (cause) {
    throw new Error(`Knowledge base file not found: ${filePath}`, { cause });
  }
}

// The seed must store the markdown 1:1; a mismatch means an encoding or driver problem, so the migration fails.
function assertStoredVerbatim(fileName: string, text: string, storedMd5: string | undefined): void {
  const fileMd5 = createHash("md5").update(text, "utf8").digest("hex");

  if (storedMd5 !== fileMd5) {
    throw new Error(`${fileName} was not stored verbatim (md5 ${storedMd5} in DB, ${fileMd5} in file)`);
  }
}
