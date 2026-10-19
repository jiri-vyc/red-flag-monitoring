# Datový model: regulace, interní předpisy, pravidla

- **Verze:** 0.3, 2026-10-19
- **Rozsah:** regulace, interní předpisy, pravidla, referenční seznamy, whitelist. Klient, transakce, vyhodnocení, AML události a audit log sem nepatří. Model zpřesňuje [sekci 3 specifikace](spec.md#3-doménový-model).
- **Cíl:** MVP pro demo na hackathonu. Model je záměrně jednoduchý. Co chybí kvůli reálnému nasazení, uvádí [sekce Compliance poznámky](#compliance-poznámky).

## Diagram

```mermaid
erDiagram
    REGULATION ||--|{ REGULATION_VERSION : "má znění"
    REGULATION_VERSION ||--o{ POLICY_LEGAL_BASIS : "cituje"
    INTERNAL_POLICY_VERSION ||--o{ POLICY_LEGAL_BASIS : "vychází z"
    INTERNAL_POLICY ||--|{ INTERNAL_POLICY_VERSION : "má verze"
    INTERNAL_POLICY |o--o{ RULE : "zastřešuje"
    INTERNAL_POLICY_VERSION |o--o{ RULE_VERSION : "odvozena z"
    RULE ||--|{ RULE_VERSION : "má verze"
    RULE |o--o| RULE_VERSION : "active_version"
    RULE_VERSION ||--o{ RULE_LEGAL_BASIS : "právní základ"
    REGULATION_VERSION ||--o{ RULE_LEGAL_BASIS : "cituje"
    REFERENCE_LIST ||--|{ REFERENCE_LIST_VERSION : "má verze"
    REFERENCE_LIST_VERSION ||--o{ REFERENCE_LIST_ITEM : "obsahuje"
    REFERENCE_LIST }o--o{ RULE_VERSION : "používá"
    RULE ||--o{ WHITELIST_ENTRY : "výjimky"
    CLIENT ||--o{ WHITELIST_ENTRY : "je vyjmut"
    USER ||--o{ RULE_VERSION : "schválil"
    USER ||--o{ INTERNAL_POLICY_VERSION : "schválil"

    REGULATION {
        uuid id PK
        string code "AMLZ, VYHL67, BM2023"
        string title
        enum kind "law, decree, eu_reg, eu_dir, guidance"
        string source_url
        timestamp checked_at "poslední kontrola"
    }
    REGULATION_VERSION {
        uuid id PK
        uuid regulation_id FK
        string label "znění od 11. 1. 2026"
        text full_text "vložený text"
        timestamp created_at
    }
    POLICY_LEGAL_BASIS {
        uuid policy_version_id FK
        uuid regulation_version_id FK
        string ref "volitelné, např. § 21"
    }
    INTERNAL_POLICY {
        uuid id PK
        string code "SVZ-TM"
        string title
    }
    INTERNAL_POLICY_VERSION {
        uuid id PK
        uuid policy_id FK
        int version_no
        text body "markdown"
        enum status "draft … superseded"
        enum created_via "wizard, manual, reg_update"
        uuid created_by FK
        uuid reviewed_by FK
        timestamp reviewed_at
        text review_comment
    }
    RULE {
        uuid id PK
        uuid policy_id FK "nullable"
        string code "A, B-a, C"
        string alert_type
        enum kind "deterministic, agentic"
        bool enabled
        uuid active_version_id FK
        bool whitelist_allowed
    }
    RULE_VERSION {
        uuid id PK
        uuid rule_id FK
        int version_no
        uuid derived_from_policy_version_id FK "nullable"
        jsonb definition "deterministické"
        text agent_prompt "agentní"
        string agent_model_id "agentní"
        text human_text "český přepis"
        text threshold_rationale
        int base_score "0-100"
        int sensitivity "0-100"
        string_array risk_profiles "low, medium, high"
        enum status "draft … superseded"
        enum created_via "wizard, manual, reg_update"
        uuid created_by FK
        uuid reviewed_by FK
        timestamp reviewed_at
        text review_comment
    }
    RULE_LEGAL_BASIS {
        uuid rule_version_id FK
        uuid regulation_version_id FK
        string ref "§ 6 odst. 1 písm. b)"
    }
    REFERENCE_LIST {
        uuid id PK
        string code "HRTC_EU, FATF_BLACK"
        string title
    }
    REFERENCE_LIST_VERSION {
        uuid id PK
        uuid list_id FK
        int version_no
        string source_note
        timestamp created_at
    }
    REFERENCE_LIST_ITEM {
        uuid list_version_id FK
        string value "IR"
    }
    WHITELIST_ENTRY {
        uuid rule_id FK
        string client_id FK
        text reason
        uuid created_by FK
        timestamp created_at
    }
    CLIENT {
        string id PK "K000001"
    }
    USER {
        uuid id PK
    }
```

Stav verze (`status`) u předpisu i pravidla nabývá hodnot `draft`, `pending_review`, `approved`, `rejected`, `superseded`.

## Rozhodnutí

| # | Rozhodnutí | Důvod |
| --- | --- | --- |
| M1 | Regulace má **znění** (`REGULATION_VERSION`). Nové znění je nový řádek s vloženým textem. | Tlačítko „zkontrolovat aktualizace“ potřebuje poznat, která pravidla stojí na starém znění. |
| M2 | Ustanovení (paragrafy) **nejsou** samostatná entita. Odkaz na paragraf je text v poli `ref`. | Jednoduchost MVP. |
| M3 | Předpis a regulace mají vazbu **M:N** přes `POLICY_LEGAL_BASIS`. Vazba je nepovinná. | Jeden předpis vychází z více regulací. Existuje i čistě interní předpis. Mění D1. |
| M4 | Pravidlo **může** patřit pod předpis (`policy_id` je nullable). | Ruční pravidlo nemusí mít předpis. |
| M5 | Každá verze pravidla má vlastní právní základ (`RULE_LEGAL_BASIS`) s odkazem na znění regulace. Odkazy se nedědí z předpisu. | Pravidlo stojí obvykle na 1–3 paragrafech, ne na všech regulacích předpisu. |
| M6 | Pravidlo drží `enabled` a `active_version_id`. Verze drží `status`. Dokud nová verze čeká na schválení, spouští se `active_version_id`. | Řeší otázku 4 ve spec. Stavy z D10 se v UI odvodí: `update_for_review` = pravidlo má aktivní verzi a novější verzi v `pending_review`. |
| M7 | `sensitivity`, `risk_profiles` a `base_score` jsou ve verzi. Jejich změna vytvoří novou verzi. Zapnutí a vypnutí verzi nevytváří. | Změna citlivosti mění detekci, proto musí projít schválením. |
| M8 | Interní předpis je **jeden markdown text** na verzi, bez článků. | Jednoduchost MVP. |
| M9 | Referenční seznamy (HRTC EU, FATF black list, interní rizikové země) mají verze. Seznamy **nemají** schvalování. Vyhodnocení použije **poslední verzi**. | Pravidlo B na seznamech závisí. Jednoduchost MVP. |
| M10 | Katalog featur je **jen v kódu**. Z něj se generuje JSON schema pro Bedrock a slovník pro český přepis. | Featury píše vývojář a reviewují se v PR. |
| M11 | Schválení jsou **pole na verzi** předpisu a pravidla (`reviewed_by`, `reviewed_at`, `review_comment`). Jiné entity schválení nemají. | Jednoduchost MVP. |
| M12 | MVP má **jednu roli `admin`**. Systém nekontroluje 4-eyes. | Demo obslouží jeden uživatel. |
| M13 | Verze agentního pravidla drží `agent_prompt` a `agent_model_id`. Vstup, výstup a vyrenderovaný prompt LLM ukládá **vyhodnocení pravidla**. | Vyhodnocení musí jít zpětně rekonstruovat. |
| M14 | `definition` obsahuje jen logiku pravidla: `match`, `features` a `conditions`. Skóre a citlivost jsou sloupce. | Sloupce jdou filtrovat a zobrazit v UI bez parsování JSON. |
| M15 | Risk profily jsou `low`, `medium`, `high` podle sloupce `AML risk score` v datech klientů. | Data neobsahují neznámý profil. Mění D12. |
| M16 | Whitelist je dvojice pravidlo × klient s povinným `reason`. Odebrání záznam smaže a zapíše do audit logu. `whitelist_allowed = false` whitelist u pravidla zakáže. | Jednoduchost MVP. Pravidla B jsou regulatorně povinná. |
| M17 | Verze předpisu a pravidla jsou neměnné. Systém je nemaže. | Rekonstruovatelnost rozhodnutí (vyhláška 67/2018 § 18). |

## Aktualizace regulace

1. Uživatel vloží nový text regulace. Systém vytvoří nové `REGULATION_VERSION`.
2. Systém najde verze pravidel a předpisů, které přes `*_LEGAL_BASIS` odkazují na předchozí znění.
3. Pro každé dotčené pravidlo systém vytvoří novou verzi s `created_via = regulation_update` a stavem `pending_review`. Nová verze odkazuje na nové znění.

## Compliance poznámky

Před reálným nasazením je musí zkontrolovat compliance officer nebo právník:

- **Whitelist bez schválení.** Benchmark ČNB 2/2023 (kap. III.ii) vyžaduje u whitelistu odůvodnění, schválení a pravidelnou revizi.
- **Referenční seznamy bez schválení.** Změna seznamu rizikových zemí mění detekci pravidla B.
- **Jedna role bez 4-eyes.** Reálný provoz potřebuje oddělené role a zákaz schválit vlastní návrh.
- **Chybí periodická revize pravidel** (vyhláška 67/2018 § 4 odst. 4–6).
- **Poslední verze seznamu** při ex post vyhodnocení nemusí odpovídat seznamu platnému k datu transakce.
