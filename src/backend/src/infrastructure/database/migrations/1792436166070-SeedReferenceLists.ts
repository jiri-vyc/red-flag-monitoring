import type { MigrationInterface, QueryRunner } from "typeorm";

// Version 1 of the reference lists the sample rules use (M9), as ISO 3166-1 alpha-2 codes, checked 2026-10-19.
// HRJ is the union from SVZ-03 čl. 4.4 used by TM-02 and PR-10; EEA is used by PR-09.
type ReferenceListSeed = { code: string; title: string; sourceNote: string; items: string[] };

const EU_HIGH_RISK_THIRD_COUNTRIES = [
  "AF",
  "AO",
  "BO",
  "CD",
  "CI",
  "CM",
  "DZ",
  "HT",
  "IR",
  "KE",
  "KP",
  "LA",
  "LB",
  "MC",
  "MM",
  "NA",
  "NP",
  "RU",
  "SS",
  "SY",
  "TT",
  "VE",
  "VG",
  "VN",
  "VU",
  "YE",
];
const FATF_CALL_FOR_ACTION = ["IR", "KP", "MM"];
const FATF_INCREASED_MONITORING = [
  "AO",
  "BA",
  "BG",
  "BO",
  "CD",
  "CI",
  "CM",
  "HT",
  "IQ",
  "KE",
  "KW",
  "LA",
  "LB",
  "MC",
  "NP",
  "PG",
  "SS",
  "SY",
  "VE",
  "VG",
  "VN",
  "YE",
];
const EEA_MEMBER_STATES = [
  "AT",
  "BE",
  "BG",
  "CY",
  "CZ",
  "DE",
  "DK",
  "EE",
  "ES",
  "FI",
  "FR",
  "GR",
  "HR",
  "HU",
  "IE",
  "IS",
  "IT",
  "LI",
  "LT",
  "LU",
  "LV",
  "MT",
  "NL",
  "NO",
  "PL",
  "PT",
  "RO",
  "SE",
  "SI",
  "SK",
];

const REFERENCE_LISTS: ReferenceListSeed[] = [
  {
    code: "EU_HRTC",
    title: "Vysoce rizikové třetí země EU (příloha nařízení 2016/1675)",
    sourceNote:
      "Konsolidované znění k 29. 1. 2026 (poslední změny 2026/46 a 2026/83), oddíly I–IV. https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:02016R1675-20260129",
    items: EU_HIGH_RISK_THIRD_COUNTRIES,
  },
  {
    code: "FATF_BLACK",
    title: "FATF: jurisdikce s výzvou k akci (black list)",
    sourceNote:
      "Stav k 19. 6. 2026. Převzato ze sekundárních zdrojů (US Treasury sb0547, amluae.com), fatf-gafi.org nebyl dostupný. Ověřit po plenárním zasedání FATF v říjnu 2026.",
    items: FATF_CALL_FOR_ACTION,
  },
  {
    code: "FATF_GREY",
    title: "FATF: jurisdikce pod zvýšeným monitoringem (grey list)",
    sourceNote:
      "Stav k 19. 6. 2026. Převzato ze sekundárních zdrojů (US Treasury sb0547, amluae.com), fatf-gafi.org nebyl dostupný. Ověřit po plenárním zasedání FATF v říjnu 2026.",
    items: FATF_INCREASED_MONITORING,
  },
  {
    code: "HRJ",
    title: "Vysoce rizikové jurisdikce (SVZ-03 čl. 4.4)",
    sourceNote: "Sjednocení EU_HRTC, FATF_BLACK a FATF_GREY, verze 1 těchto seznamů.",
    items: [
      ...new Set([...EU_HIGH_RISK_THIRD_COUNTRIES, ...FATF_CALL_FOR_ACTION, ...FATF_INCREASED_MONITORING]),
    ],
  },
  {
    code: "EEA",
    title: "Státy Evropského hospodářského prostoru",
    sourceNote: "27 členských států EU + Island, Lichtenštejnsko, Norsko. https://www.efta.int/eea",
    items: EEA_MEMBER_STATES,
  },
];

export class SeedReferenceLists1792436166070 implements MigrationInterface {
  name = "SeedReferenceLists1792436166070";

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const list of REFERENCE_LISTS) {
      await insertReferenceList(queryRunner, list);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const codes = REFERENCE_LISTS.map((list) => list.code);

    await queryRunner.query(
      `DELETE FROM "reference_list_items" WHERE "list_version_id" IN (
         SELECT "v"."id" FROM "reference_list_versions" "v"
         JOIN "reference_lists" "l" ON "l"."id" = "v"."list_id"
         WHERE "l"."code" = ANY($1)
       )`,
      [codes],
    );
    await queryRunner.query(
      `DELETE FROM "reference_list_versions" WHERE "list_id" IN (SELECT "id" FROM "reference_lists" WHERE "code" = ANY($1))`,
      [codes],
    );
    await queryRunner.query(`DELETE FROM "reference_lists" WHERE "code" = ANY($1)`, [codes]);
  }
}

async function insertReferenceList(queryRunner: QueryRunner, list: ReferenceListSeed): Promise<void> {
  const [createdList] = (await queryRunner.query(
    `INSERT INTO "reference_lists" ("code", "title") VALUES ($1, $2) RETURNING "id"`,
    [list.code, list.title],
  )) as { id: string }[];
  const [createdVersion] = (await queryRunner.query(
    `INSERT INTO "reference_list_versions" ("list_id", "version_no", "source_note") VALUES ($1, 1, $2) RETURNING "id"`,
    [createdList?.id, list.sourceNote],
  )) as { id: string }[];

  await queryRunner.query(
    `INSERT INTO "reference_list_items" ("list_version_id", "value") SELECT $1, unnest($2::text[])`,
    [createdVersion?.id, list.items],
  );
}
