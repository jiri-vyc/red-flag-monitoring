import type { MigrationInterface, QueryRunner } from "typeorm";

import type { RuleCondition, RuleConditionNode, RuleDefinition } from "../../../domain/ruleDefinition";

// The sample rules R-01 to R-17 from knowledgebase/pravidla-priklady as approved, active and enabled versions,
// so the evaluation engine has something to run. Definitions follow spec/features.md section 3.
//
// base_score = 50 + priority base / 2 (rounded), with the priority base from "Tabulka P" in SVZ-03 and
// "Priorita (základ)" in SVZ-06. Every match of a rule is an alert by the policy, so with sensitivity 100 every
// match must reach the default hit threshold 50; the order of the policy priorities is kept.
// whitelist_allowed = false for rules the regulation makes mandatory: R-02, R-03 (vyhláška 67/2018 § 9 odst. 3),
// R-16 (EU high-risk third countries) and R-17 (nařízení 2023/1113 čl. 7 a 8).
// Legal bases are not seeded here: regulations and policies come from a separate seed.
const ADMIN_USER_ID = "00000000-0000-4000-8000-000000000001";
const ALL_RISK_PROFILES = ["low", "medium", "high"];
const FULL_SENSITIVITY = 100;
const SAMPLE_RULES_NOTE = "Ukázkové pravidlo z knowledgebase/pravidla-priklady, seed migrace.";

type RuleSeed = {
  code: string;
  alertType: string;
  priorityBase: number;
  isWhitelistAllowed: boolean;
  humanText: string;
  definition: RuleDefinition;
};

function compare(
  id: string,
  label: string,
  left: RuleCondition["left"],
  op: RuleCondition["op"],
  right: RuleCondition["right"],
): RuleCondition {
  return { id, label, left, op, right };
}

function group(
  id: string,
  label: string,
  match: "all" | "any",
  conditions: RuleConditionNode[],
): RuleConditionNode {
  return { id, label, match, conditions };
}

const IS_HIGHER_RISK_CLIENT = (id: string): RuleConditionNode =>
  group(id, "Klient s vyšším rizikem (high nebo PEP)", "any", [
    compare(`${id}1`, "AML rizikový profil je high", { feature: "client_risk_score" }, "=", {
      value: "high",
    }),
    compare(`${id}2`, "Klient je PEP", { feature: "client_is_pep" }, "=", { value: true }),
  ]);

const RULE_SEEDS: RuleSeed[] = [
  {
    code: "R-01",
    alertType: "profile_mismatch",
    priorityBase: 15,
    isWhitelistAllowed: true,
    humanText:
      "Nesoulad s profilem klienta. Pravidlo zasáhne, pokud platí aspoň jedna podmínka: (a) denní objem klienta je vyšší než 0,25 × očekávaný měsíční objem; (b) denní objem klienta je vyšší než 3 × průměrný denní objem za 2Q2026; (c) transakce je vyšší než 2 × největší transakce klienta za 2Q2026. Klient bez transakcí v 2Q2026 se posuzuje jen podle (a).",
    definition: {
      match: "any",
      features: [
        "day_volume_czk",
        "client_projected_monthly_volume_czk",
        "client_q2_daily_avg_volume_czk",
        "tx_amount_czk",
        "client_q2_max_tx_czk",
      ],
      conditions: [
        compare("a", "Denní objem > 0,25 × očekávaný měsíční objem", { feature: "day_volume_czk" }, ">", {
          expr: "0.25 × client_projected_monthly_volume_czk",
        }),
        compare("b", "Denní objem > 3 × průměrný denní objem za 2Q2026", { feature: "day_volume_czk" }, ">", {
          expr: "3 × client_q2_daily_avg_volume_czk",
        }),
        compare("c", "Transakce > 2 × největší transakce za 2Q2026", { feature: "tx_amount_czk" }, ">", {
          expr: "2 × client_q2_max_tx_czk",
        }),
      ],
    },
  },
  {
    code: "R-02",
    alertType: "high_risk_jurisdiction",
    priorityBase: 60,
    isWhitelistAllowed: false,
    humanText:
      "Vysoce riziková jurisdikce. Pravidlo zasáhne každou transakci nad 10 000 CZK, u které je země plátce, země příjemce nebo země klienta na seznamu vysoce rizikových jurisdikcí (HRJ: seznam EU podle nařízení 2016/1675 a seznamy FATF).",
    definition: {
      match: "all",
      features: ["tx_amount_czk", "tx_payer_country", "tx_payee_country", "client_country"],
      conditions: [
        compare("a", "Částka > 10 000 CZK", { feature: "tx_amount_czk" }, ">", { value: 10000 }),
        group("b", "Plátce, příjemce nebo klient z HRJ", "any", [
          compare("b1", "Země plátce je v HRJ", { feature: "tx_payer_country" }, "in", { list: "HRJ" }),
          compare("b2", "Země příjemce je v HRJ", { feature: "tx_payee_country" }, "in", { list: "HRJ" }),
          compare("b3", "Země klienta je v HRJ", { feature: "client_country" }, "in", { list: "HRJ" }),
        ]),
      ],
    },
  },
  {
    code: "R-03",
    alertType: "pep_outgoing_payment",
    priorityBase: 60,
    isWhitelistAllowed: false,
    humanText:
      "Odchozí platba PEP. Pravidlo zasáhne každou odchozí platbu nebo remitenci politicky exponované osoby s částkou nad 100 000 CZK.",
    definition: {
      match: "all",
      features: ["client_is_pep", "tx_is_outgoing", "tx_amount_czk"],
      conditions: [
        compare("a", "Klient je PEP", { feature: "client_is_pep" }, "=", { value: true }),
        compare("b", "Transakce je odchozí", { feature: "tx_is_outgoing" }, "=", { value: true }),
        compare("c", "Částka > 100 000 CZK", { feature: "tx_amount_czk" }, ">", { value: 100000 }),
      ],
    },
  },
  {
    code: "R-04",
    alertType: "pass_through_account",
    priorityBase: 55,
    isWhitelistAllowed: true,
    humanText:
      "Průtokový účet. Pravidlo zasáhne odchozí platbu, která dokončí vzor: klient během 24 hodin přijme více než 100 000 CZK a do 6 hodin z toho odešle aspoň 80 % na účty, ze kterých peníze nepřišly.",
    definition: {
      match: "all",
      // IN and OUT are listed only so the trace shows the amounts behind the ratio.
      features: ["passthrough_in_24h_czk", "passthrough_out_6h_czk", "passthrough_ratio"],
      conditions: [
        compare("a", "Odesláno ≥ 80 % přijaté částky", { feature: "passthrough_ratio" }, ">=", {
          value: 0.8,
        }),
      ],
    },
  },
  {
    code: "R-05",
    alertType: "new_distant_client_turnover",
    priorityBase: 35,
    isWhitelistAllowed: true,
    humanText:
      "Nový klient identifikovaný na dálku s nadměrným obratem. Pravidlo zasáhne, pokud klient uzavřel smlouvu na dálku, k začátku měsíce trvá vztah méně než 6 měsíců a měsíční objem klienta je vyšší než 3 × očekávaný měsíční objem.",
    definition: {
      match: "all",
      features: [
        "client_contract_channel",
        "client_tenure_months_at_month_start",
        "month_volume_czk",
        "client_projected_monthly_volume_czk",
      ],
      conditions: [
        compare("a", "Smlouva uzavřena na dálku", { feature: "client_contract_channel" }, "=", {
          value: "distant",
        }),
        compare(
          "b",
          "Vztah k začátku měsíce < 6 měsíců",
          { feature: "client_tenure_months_at_month_start" },
          "<",
          { value: 6 },
        ),
        compare("c", "Měsíční objem > 3 × očekávaný měsíční objem", { feature: "month_volume_czk" }, ">", {
          expr: "3 × client_projected_monthly_volume_czk",
        }),
      ],
    },
  },
  {
    code: "R-06",
    alertType: "many_payers",
    priorityBase: 35,
    isWhitelistAllowed: true,
    humanText:
      "Neobvyklý počet plátců. Pravidlo zasáhne příchozí platbu, pokud klient ten den přijal platby od aspoň 7 různých účtů plátců.",
    definition: {
      match: "all",
      features: ["tx_type", "day_distinct_payer_accounts"],
      conditions: [
        compare("a", "Příchozí platba", { feature: "tx_type" }, "=", { value: "incoming" }),
        compare("b", "Aspoň 7 různých účtů plátců za den", { feature: "day_distinct_payer_accounts" }, ">=", {
          value: 7,
        }),
      ],
    },
  },
  {
    code: "R-07",
    alertType: "structuring_same_payee",
    priorityBase: 40,
    isWhitelistAllowed: true,
    humanText:
      "Řada malých plateb stejnému příjemci. Pravidlo zasáhne, pokud klient během 7 dní pošle stejnému příjemci aspoň 3 odchozí platby, každou pod 25 000 CZK, a jejich součet je aspoň 25 000 CZK.",
    definition: {
      match: "all",
      features: ["payee_small_out_count_7d", "payee_small_out_sum_7d_czk"],
      conditions: [
        compare(
          "a",
          "Aspoň 3 malé platby stejnému příjemci za 7 dní",
          { feature: "payee_small_out_count_7d" },
          ">=",
          { value: 3 },
        ),
        compare("b", "Součet malých plateb ≥ 25 000 CZK", { feature: "payee_small_out_sum_7d_czk" }, ">=", {
          value: 25000,
        }),
      ],
    },
  },
  {
    code: "R-08",
    alertType: "near_limit_payments",
    priorityBase: 30,
    isWhitelistAllowed: true,
    humanText:
      "Opakované platby těsně pod limitem. Pravidlo zasáhne, pokud má klient během 7 dní aspoň 3 transakce s částkou 22 500–24 999,99 CZK.",
    definition: {
      match: "all",
      features: ["near_limit_tx_count_7d"],
      conditions: [
        compare(
          "a",
          "Aspoň 3 transakce těsně pod limitem za 7 dní",
          { feature: "near_limit_tx_count_7d" },
          ">=",
          { value: 3 },
        ),
      ],
    },
  },
  {
    code: "R-09",
    alertType: "many_clients_same_payee",
    priorityBase: 30,
    isWhitelistAllowed: true,
    humanText:
      "Mnoho klientů platí stejnému příjemci. Pravidlo zasáhne odchozí platbu, pokud stejnému účtu příjemce ten den zaplatilo aspoň 40 různých klientů.",
    definition: {
      match: "all",
      features: ["payee_day_distinct_clients"],
      conditions: [
        compare(
          "a",
          "Aspoň 40 různých klientů platí příjemci za den",
          { feature: "payee_day_distinct_clients" },
          ">=",
          { value: 40 },
        ),
      ],
    },
  },
  {
    code: "R-10",
    alertType: "many_payer_countries",
    priorityBase: 35,
    isWhitelistAllowed: true,
    humanText:
      "Plátci z mnoha zemí. Pravidlo zasáhne příchozí platbu, pokud klient přijal platby od plátců z aspoň 5 různých zemí za den, nebo ze 7 různých zemí za ISO týden.",
    definition: {
      match: "all",
      features: ["tx_type", "day_distinct_payer_countries", "week_distinct_payer_countries"],
      conditions: [
        compare("a", "Příchozí platba", { feature: "tx_type" }, "=", { value: "incoming" }),
        group("b", "Mnoho zemí plátců", "any", [
          compare("b1", "Aspoň 5 zemí plátců za den", { feature: "day_distinct_payer_countries" }, ">=", {
            value: 5,
          }),
          compare(
            "b2",
            "Aspoň 7 zemí plátců za ISO týden",
            { feature: "week_distinct_payer_countries" },
            ">=",
            { value: 7 },
          ),
        ]),
      ],
    },
  },
  {
    code: "R-11",
    alertType: "quick_forwarding",
    priorityBase: 50,
    isWhitelistAllowed: true,
    humanText:
      "Okamžité přeposlání přijaté částky. Pravidlo zasáhne odchozí platbu, která do 2 hodin od příchozí platby aspoň 25 000 CZK přepošle 90–110 % přijaté částky na jiný účet, než ze kterého peníze přišly.",
    definition: {
      match: "all",
      features: ["quick_forward_match_count"],
      conditions: [
        compare(
          "a",
          "Přeposlání příchozí platby do 2 hodin",
          { feature: "quick_forward_match_count" },
          ">=",
          { value: 1 },
        ),
      ],
    },
  },
  {
    code: "R-12",
    alertType: "round_trip_payments",
    priorityBase: 40,
    isWhitelistAllowed: true,
    humanText:
      "Kruhové platby se stejnou protistranou. Pravidlo zasáhne transakci aspoň 25 000 CZK, pokud klient během předchozích 72 hodin poslal nebo přijal platbu aspoň 25 000 CZK opačným směrem se stejnou protistranou.",
    definition: {
      match: "all",
      features: ["round_trip_match_count_72h"],
      conditions: [
        compare(
          "a",
          "Platba opačným směrem se stejnou protistranou za 72 hodin",
          { feature: "round_trip_match_count_72h" },
          ">=",
          { value: 1 },
        ),
      ],
    },
  },
  {
    code: "R-13",
    alertType: "transaction_count_spike",
    priorityBase: 25,
    isWhitelistAllowed: true,
    humanText:
      "Neobvyklý nárůst počtu transakcí. Pravidlo zasáhne, pokud měsíční počet transakcí klienta překročí současně 5 × průměrný měsíční počet za 2Q2026 a 5 × očekávaný měsíční počet. U klienta s vysokým rizikem nebo PEP stačí trojnásobek. Klient bez transakcí v 2Q2026 se nevyhodnocuje.",
    definition: {
      match: "any",
      features: [
        "month_tx_count",
        "client_q2_monthly_avg_tx_count",
        "client_projected_monthly_tx_count",
        "client_risk_score",
        "client_is_pep",
      ],
      conditions: [
        group("a", "Pětinásobek obou základen", "all", [
          compare("a1", "Měsíční počet > 5 × průměr za 2Q2026", { feature: "month_tx_count" }, ">", {
            expr: "5 × client_q2_monthly_avg_tx_count",
          }),
          compare("a2", "Měsíční počet > 5 × očekávaný počet", { feature: "month_tx_count" }, ">", {
            expr: "5 × client_projected_monthly_tx_count",
          }),
        ]),
        group("b", "Trojnásobek obou základen u klienta s vyšším rizikem", "all", [
          IS_HIGHER_RISK_CLIENT("b1"),
          compare("b2", "Měsíční počet > 3 × průměr za 2Q2026", { feature: "month_tx_count" }, ">", {
            expr: "3 × client_q2_monthly_avg_tx_count",
          }),
          compare("b3", "Měsíční počet > 3 × očekávaný počet", { feature: "month_tx_count" }, ">", {
            expr: "3 × client_projected_monthly_tx_count",
          }),
        ]),
      ],
    },
  },
  {
    code: "R-14",
    alertType: "remittance_total",
    priorityBase: 40,
    isWhitelistAllowed: true,
    humanText:
      "Vysoký souhrn remitencí. Pravidlo zasáhne remitenci, pokud součet remitencí klienta za měsíc dosáhne 375 000 CZK. U klienta s vysokým rizikem nebo PEP je limit 187 500 CZK.",
    definition: {
      match: "all",
      features: ["tx_type", "month_remittance_sum_czk", "client_risk_score", "client_is_pep"],
      conditions: [
        compare("a", "Remitence", { feature: "tx_type" }, "=", { value: "remittance" }),
        group("b", "Souhrn remitencí nad limitem", "any", [
          compare(
            "b1",
            "Měsíční součet remitencí ≥ 375 000 CZK",
            { feature: "month_remittance_sum_czk" },
            ">=",
            { value: 375000 },
          ),
          group("b2", "Snížený limit u klienta s vyšším rizikem", "all", [
            IS_HIGHER_RISK_CLIENT("b2a"),
            compare(
              "b2b",
              "Měsíční součet remitencí ≥ 187 500 CZK",
              { feature: "month_remittance_sum_czk" },
              ">=",
              { value: 187500 },
            ),
          ]),
        ]),
      ],
    },
  },
  {
    code: "R-15",
    alertType: "non_eea_remittance_new_client",
    priorityBase: 35,
    isWhitelistAllowed: true,
    humanText:
      "Remitence mimo EHP od nového klienta. Pravidlo zasáhne každou remitenci aspoň 25 000 CZK do země mimo EHP, pokud ke dni transakce trvá vztah s klientem méně než 6 měsíců.",
    definition: {
      match: "all",
      features: ["tx_type", "tx_payee_country", "tx_amount_czk", "client_tenure_months_at_tx"],
      conditions: [
        compare("a", "Remitence", { feature: "tx_type" }, "=", { value: "remittance" }),
        compare("b", "Země příjemce mimo EHP", { feature: "tx_payee_country" }, "not_in", { list: "EEA" }),
        compare("c", "Částka ≥ 25 000 CZK", { feature: "tx_amount_czk" }, ">=", { value: 25000 }),
        compare("d", "Vztah ke dni transakce < 6 měsíců", { feature: "client_tenure_months_at_tx" }, "<", {
          value: 6,
        }),
      ],
    },
  },
  {
    code: "R-16",
    alertType: "high_risk_third_country",
    priorityBase: 70,
    isWhitelistAllowed: false,
    humanText:
      "Převod z nebo do vysoce rizikové třetí země. Pravidlo zasáhne každou transakci bez ohledu na částku, u které je země plátce nebo země příjemce na seznamu vysoce rizikových jurisdikcí (HRJ).",
    definition: {
      match: "any",
      features: ["tx_payer_country", "tx_payee_country"],
      conditions: [
        compare("a", "Země plátce je v HRJ", { feature: "tx_payer_country" }, "in", { list: "HRJ" }),
        compare("b", "Země příjemce je v HRJ", { feature: "tx_payee_country" }, "in", { list: "HRJ" }),
      ],
    },
  },
  {
    code: "R-17",
    alertType: "missing_payer_info",
    priorityBase: 30,
    isWhitelistAllowed: false,
    humanText:
      "Příchozí platba bez údajů o plátci. Pravidlo zasáhne každou příchozí platbu, u které chybí účet plátce nebo země plátce.",
    definition: {
      match: "all",
      features: ["tx_type", "tx_payer_info_missing"],
      conditions: [
        compare("a", "Příchozí platba", { feature: "tx_type" }, "=", { value: "incoming" }),
        compare("b", "Chybí údaje o plátci", { feature: "tx_payer_info_missing" }, "=", { value: true }),
      ],
    },
  },
];

export class SeedSampleRules1792438575192 implements MigrationInterface {
  name = "SeedSampleRules1792438575192";

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const ruleSeed of RULE_SEEDS) {
      await insertActiveRule(queryRunner, ruleSeed);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const codes = RULE_SEEDS.map((ruleSeed) => ruleSeed.code);

    await queryRunner.query(
      `UPDATE "rules" SET "enabled" = false, "active_version_id" = NULL WHERE "code" = ANY($1)`,
      [codes],
    );
    await queryRunner.query(
      `DELETE FROM "rule_versions" WHERE "rule_id" IN (SELECT "id" FROM "rules" WHERE "code" = ANY($1))`,
      [codes],
    );
    await queryRunner.query(`DELETE FROM "rules" WHERE "code" = ANY($1)`, [codes]);
  }
}

async function insertActiveRule(queryRunner: QueryRunner, ruleSeed: RuleSeed): Promise<void> {
  const [createdRule] = (await queryRunner.query(
    `INSERT INTO "rules" ("code", "alert_type", "kind", "whitelist_allowed")
     VALUES ($1, $2, 'deterministic', $3) RETURNING "id"`,
    [ruleSeed.code, ruleSeed.alertType, ruleSeed.isWhitelistAllowed],
  )) as { id: string }[];
  const [createdVersion] = (await queryRunner.query(
    `INSERT INTO "rule_versions" (
       "rule_id", "version_no", "definition", "human_text", "threshold_rationale", "base_score", "sensitivity",
       "risk_profiles", "status", "created_via", "created_by", "reviewed_by", "reviewed_at", "review_comment"
     ) VALUES ($1, 1, $2, $3, $4, $5, $6, $7, 'approved', 'manual', $8, $8, now(), $9) RETURNING "id"`,
    [
      createdRule?.id,
      JSON.stringify(ruleSeed.definition),
      ruleSeed.humanText,
      `Základ priority podle vnitřního předpisu je ${ruleSeed.priorityBase}, skóre = 50 + ${ruleSeed.priorityBase} / 2.`,
      toBaseScore(ruleSeed.priorityBase),
      FULL_SENSITIVITY,
      ALL_RISK_PROFILES,
      ADMIN_USER_ID,
      SAMPLE_RULES_NOTE,
    ],
  )) as { id: string }[];

  await queryRunner.query(`UPDATE "rules" SET "active_version_id" = $2, "enabled" = true WHERE "id" = $1`, [
    createdRule?.id,
    createdVersion?.id,
  ]);
}

function toBaseScore(priorityBase: number): number {
  return 50 + Math.round(priorityBase / 2);
}
