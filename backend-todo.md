# TODO backend

Co musí backend (`src/backend`) doplnit, aby web (`src/web`) fungoval v live režimu celý. Web v live režimu skrývá vše, co API neumí. Skryté prvky řídí `capabilities` v kontraktech služeb (`features/*/api/contract.ts`), komentář u každé hodnoty `false` odkazuje na ID z tohoto souboru. Přehled skrytých prvků je v [todo-web.md](todo-web.md), sekce „Záměrně skryté v UI (čeká na API)“.

Návrhy endpointů drží styl stávajícího API: prefix `/api`, JSON v camelCase, stránkování `limit` + `offset` (max 500), uživatel jako UUID (`createdBy`, `reviewedBy`), neměnné verze (M17). Doménové typy webu jsou v `src/web/features/*/types.ts`, DTO stávajícího API v `src/web/features/*/api/dto.ts`.

Priority: **P1** = bez toho chybí hlavní tok demo (nahrát transakce, vytvořit pravidla), **P2** = funkce je ve webu hotová na mocku a v live chybí, **P3** = výkon, pohodlí, nice-to-have.

## Přehled

| ID    | Co                                                                  | Odemkne ve webu                     | Priorita |
| ----- | ------------------------------------------------------------------- | ----------------------------------- | -------- |
| BE-01 | Nahrání CSV dávky, spuštění běhu a průběh                           | `batches.canUploadBatch`            | P1       |
| BE-02 | Wizard: zdroj regulace → draft interního předpisu                   | `wizard.isAvailable`                | P1       |
| BE-03 | Wizard: generování pravidel z předpisu (Bedrock) a dokončení review | `wizard.isAvailable`                | P1       |
| BE-04 | Generování definice deterministického pravidla z popisu             | `rules.canCreateDeterministicRule`  | P1       |
| BE-05 | Úprava draftu pravidla, nebo rozhodnutí, že verze zůstanou neměnné  | `rules.canEditDraftContent`         | P2       |
| BE-06 | Seznam klientů pro návrhy ve whitelistu                             | `rules.canSuggestWhitelistClients`  | P3       |
| BE-07 | Souhrnný endpoint pro dashboard (volitelné)                         | rychlejší dashboard                 | P3       |
| BE-08 | Popis regulace                                                      | text v detailu regulace             | P2       |
| BE-09 | Částka v CZK v seznamu transakcí běhu                               | sloupec částky v CZK                | P2       |
| BE-10 | Právní základ v detailu transakce                                   | proklik pravidlo → paragraf         | P2       |
| BE-11 | Stavy verzí interního předpisu                                      | správný stav předpisu               | P2       |
| BE-12 | Agregované endpointy s verzemi (N+1)                                | rychlost seznamů                    | P2       |
| BE-13 | Audit log                                                           | nová sekce Audit log                | P2       |
| BE-14 | AML události                                                        | nová sekce AML události             | P3       |
| BE-15 | Detail klienta                                                      | nová obrazovka klienta              | P3       |
| BE-16 | Kontrola aktualizací regulací                                       | tlačítko „Zkontrolovat aktualizace“ | P3       |
| BE-17 | Prahy a konfigurace vyhodnocení z API                               | prahy a kurzy bez demo hodnot       | P3       |

## BE-01: Nahrání CSV dávky, spuštění běhu a průběh

**Priorita:** P1. **Odemkne:** `batches.canUploadBatch` (`features/batches/api/live.ts`). Dnes je obrazovka Dávky v live režimu jen seznam běhů a tlačítko „Nahrát dávku“ na dashboardu je skryté.

Dnes jsou běhy jen ke čtení (`evaluationRunsRouter.ts`, V14) a vytváří je engine mimo API. Podle `spec/spec.md` 7.5 uživatel spouští run sám a podle `spec/datovy-model.md` V1 až V5 nahrává jen transakce.

```http
POST /api/evaluation-runs
Content-Type: multipart/form-data

file=<transactions.csv>        # středníky, UTF-8, sloupce jako datasets/transactions.csv
createdBy=<uuid>
hitThreshold=50                # nepovinné, výchozí podle V7
```

Odpověď `202 Accepted`: stejný tvar jako položka `GET /api/evaluation-runs` (`EvaluationRunListItemDto`), tedy `id`, `fileName`, `status: "importing"`, `rowsTotal`, `rowsImported`, `txProcessed`, `txPassed`, `txFlagged`, `txError`, `errorMessage`, `createdAt`, `createdBy`.

- Běh fixuje verze pravidel a referenčních seznamů při startu (V5).
- Řádek s neznámým klientem nebo neplatným datem (`31.02.`) odmítnout s popisem chyby (V1, V2). Chyby formátu vracet jako `400` s `issues`, aby je web ukázal.
- Průběh: web už dnes polluje `GET /api/evaluation-runs/:runId`, dokud je stav `importing` nebo `running`, a čte `rowsImported` a `txProcessed`. Stačí, když se tyto sloupce průběžně plní (V12). SSE není nutné.
- Volitelně `POST /api/evaluation-runs/:runId/rerun` pro nové vyhodnocení stejných transakcí s aktuálními pravidly (V2).

## BE-02: Wizard, zdroj regulace → draft interního předpisu

**Priorita:** P1. **Odemkne:** `wizard.isAvailable` spolu s BE-03 (`features/wizard/api/live.ts`). Dnes je průvodce v live režimu skrytý včetně všech vstupů (CTA na dashboardu, „Přidat regulaci“, „Vytvořit pravidla z regulace“) a `/wizard` ukazuje hlášku o nedostupnosti.

Podle `spec/spec.md` 4.2 a 7.2. Web adapter už volá tento tvar:

```http
POST /api/wizard/policy-drafts
Content-Type: multipart/form-data

regulationName=<text, nepovinné>
file=<PDF nebo MD>  |  url=<http(s) URL>  |  text=<vložený text>    # právě jedno
createdBy=<uuid>
```

Odpověď `201`: `{ regulation, policy }`.

- `regulation`: nová regulace s prvním zněním (`REGULATION_VERSION`, M1), nebo existující regulace, pokud už URL známe.
- `policy`: interní předpis s verzí `draft`, `createdVia: "wizard"`, s právními základy (`POLICY_LEGAL_BASIS`, M3) a `ref` na konkrétní paragrafy.
- Tvar může být DTO stávajícího API (`RegulationDto` + verze, `InternalPolicyDto` + verze), adapter ve webu ho namapuje stejně jako u seznamů.
- Extrakce povinností přes Bedrock. Výstup je návrh AI, musí ho schválit člověk (compliance review).
- URL omezit na `http`/`https`, velikost souboru limitovat.

## BE-03: Wizard, generování pravidel z předpisu a dokončení review

**Priorita:** P1. **Odemkne:** `wizard.isAvailable` spolu s BE-02.

```http
POST /api/wizard/policy-drafts/:policyId/rules
```

Odpověď `201`: pole nových pravidel, každé s první verzí ve stavu `draft` a `createdVia: "wizard"`. Deterministická pravidla mají `definition` (`match`, `features`, `conditions`, M14) a `humanText`, agentní `agentPrompt` a `agentModelId` (M13). Každá verze má vlastní `legalBases` s `ref` (M5) a `derivedFromPolicyVersionId`.

```http
POST /api/wizard/policy-drafts/:policyId/finish
```

Odešle k review všechny vygenerované verze, které jsou stále `draft`. Odpověď: aktualizovaná pravidla.

- Generování přes Bedrock s JSON schématem z katalogu featur (M10). Neplatnou definici backend odmítne, ne web.
- Úprava draftu pravidla v kroku review potřebuje BE-05. Bez něj web tlačítko „Upravit“ skryje a zbude schválit nebo zamítnout.

## BE-04: Generování definice deterministického pravidla z popisu

**Priorita:** P1. **Odemkne:** `rules.canCreateDeterministicRule`. Dnes ruční formulář v live režimu nabízí jen agentní pravidlo (popis se stane promptem).

Podle `spec/spec.md` 7.3 (ruční tvorba): systém z popisu vygeneruje kód a lidský přepis.

```http
POST /api/rules/generate
Content-Type: application/json

{ "kind": "deterministic", "description": "Odchozí platba PEP nad 100 000 Kč", "policyId": "<uuid>" }
```

Odpověď `200` (nic se neukládá):

```json
{
  "definition": { "match": "all", "features": [], "conditions": [] },
  "humanText": "…",
  "baseScore": 60,
  "legalBases": [{ "regulationVersionId": "<uuid>", "ref": "§ 9" }]
}
```

Web pak pravidlo uloží stávajícím `POST /api/rules` a `POST /api/rules/:ruleId/versions`. Alternativa: jeden endpoint `POST /api/rules/manual`, který pravidlo vygeneruje i uloží atomicky (řeší i nález „Ruční pravidlo bez verze“ v todo-web.md).

- Pro `kind: "agentic"` stejný endpoint vrátí `agentPrompt` a `agentModelId`. Dnes web posílá placeholder modelu `eu.anthropic.claude-sonnet-4-5-20250929-v1:0`, backend má určit skutečný model.

## BE-05: Úprava draftu pravidla, nebo rozhodnutí o neměnných verzích

**Priorita:** P2. **Odemkne:** `rules.canEditDraftContent` (tlačítko „Upravit koncept“ v detailu pravidla a „Upravit“ v review kroku wizardu).

M17 říká, že verze jsou neměnné. Tým musí rozhodnout jednu z variant:

1. **Úprava jen pro `draft`:** verze ve stavu `draft` ještě nikdo nereviewoval, takže její změna nenaruší rekonstruovatelnost.

   ```http
   PATCH /api/rules/:ruleId/versions/:versionId
   { "definition": {…} | null, "agentPrompt": "…" | null, "humanText": "…" }
   ```

   Povolit jen pro `status = "draft"`, jinak `409`. Odpověď: `RuleVersionDto`.

2. **Verze zůstanou neměnné:** pak web capability nechá `false` napořád, tlačítko odstraní a draft se opravuje zamítnutím a novou verzí (`POST /api/rules/:ruleId/versions`, to už funguje). Rozhodnutí zapsat do `spec/datovy-model.md`.

## BE-06: Seznam klientů pro návrhy ve whitelistu

**Priorita:** P3. **Odemkne:** `rules.canSuggestWhitelistClients`. Dnes v live režimu pole „ID klienta“ nenabízí žádné návrhy (mock nabízí demo klienty ze seedu).

```http
GET /api/clients?query=K0000&limit=20
```

Odpověď: `{ items: [{ clientId, country, amlRiskScore, isPep }], total, limit, offset }`. Stejný tvar jako `client` v detailu transakce.

## BE-07: Souhrnný endpoint pro dashboard (volitelné)

**Priorita:** P3. Dashboard v live režimu už funguje: web ho skládá z live endpointů (`features/dashboard/api/live.ts`): `GET /api/rules` a verze každého pravidla (kvůli odvozeným stavům), `GET /api/regulations` a verze každé regulace (index právního základu pravidel), `GET /api/internal-policies` (jen počet) a `GET /api/evaluation-runs`. Pro N pravidel a M regulací je to 5 + N + M requestů, `GET /api/regulations` jde dvakrát (počet a index v adapteru pravidel), viz BE-12.

```http
GET /api/dashboard
```

Odpověď ve tvaru `DashboardSummary` (`features/dashboard/types.ts`): `activeRuleCount`, `rulesAwaitingReviewCount`, `regulationCount`, `policyCount`, `recentBatches` (poslední 3 běhy jako v `GET /api/evaluation-runs`), `rulesNeedingReview` (pravidla ve stavu `pending_for_review` a `update_for_review`). Pokud vznikne BE-12, tento endpoint není potřeba.

## BE-08: Popis regulace

**Priorita:** P2. Detail regulace v live režimu nemá popis (`description` je prázdné), backend ukládá jen plné znění verze (M1).

Přidat do `REGULATION` pole `summary` (text, nullable) a vracet ho v `GET /api/regulations` i `GET /api/regulations/:regulationId`. Wizard (BE-02) ho může vyplnit z vygenerovaného shrnutí.

## BE-09: Částka v CZK v seznamu transakcí běhu

**Priorita:** P2. Seznam transakcí běhu nezná částku v CZK, web ji umí zjistit jen v detailu z featury `amount_czk`.

Do položek `GET /api/evaluation-runs/:runId/transactions` přidat `amountCzk` (number) a `fxRate` (kurz ČNB k datu transakce, V11). Stejná pole přidat do `transaction` v detailu transakce, aby web nemusel hledat featuru.

## BE-10: Právní základ v detailu transakce

**Priorita:** P2. Detail transakce u pravidla neukazuje, z jakého paragrafu pravidlo vychází (`spec/spec.md` 7.5 bod 4 a 7.7, `spec/datovy-model.md` „Cesta k regulaci“).

Do `ruleEvaluations[].ruleVersion` v `GET /api/evaluation-runs/:runId/transactions/:transactionId` přidat `legalBases: [{ regulationId, regulationCode, regulationVersionId, ref }]` podle verze pravidla použité v běhu.

## BE-11: Stavy verzí interního předpisu

**Priorita:** P2. Web model předpisu zná jen `draft` a `approved`, live adapter bere jen poslední verzi. Když je v1 `approved` a v2 `rejected`, předpis se ukáže jako draft.

Do `GET /api/internal-policies` a `GET /api/internal-policies/:policyId` přidat `currentApprovedVersionId` (nebo celé `currentApprovedVersion`) a `latestVersionStatus`. Web pak rozšíří model o `pending_review` a `rejected`. Zamítnutí předpisu web zatím nemá; až vznikne, musí stejně jako u pravidla posílat povinný `reviewComment` (`POST /api/internal-policies/:policyId/versions/:versionId/review`, to už existuje).

## BE-12: Agregované endpointy s verzemi (N+1)

**Priorita:** P2. Web načítá u regulací, předpisů a pravidel každou položku s verzemi zvlášť. Při studeném startu Aurory a větším objemu je to pomalé, dashboard a seznamy volají totéž opakovaně.

```http
GET /api/rules?include=versions
GET /api/internal-policies?include=versions
GET /api/regulations?include=versions
```

Odpověď: `{ items: [{ rule, versions }] }` (resp. `policy` nebo `regulation`), stejný tvar jako dnešní kombinace detailu a `/versions`. Stránkování `limit` + `offset`.

## BE-13: Audit log

**Priorita:** P2. Podle `spec/spec.md` 7.7 a 8 je audit povinný: kdo, kdy, co, proč a jaká verze pravidla. Web sekci zatím nemá (todo-web.md, „Chybějící funkce“).

```http
GET /api/audit-events?entityType=rule&entityId=<uuid>&actor=<uuid>&from=<iso>&to=<iso>&limit=50&offset=0
```

Položka: `{ id, occurredAt, actor, action, entityType, entityId, entityVersionId, reason, details }`. Akce minimálně: vytvoření pravidla a verze, submit, schválení, zamítnutí (s komentářem), zapnutí a vypnutí, změna aktivní verze, přidání a odebrání z whitelistu (M16), změna předpisu, spuštění běhu. Záznam zapisuje backend při každé akci, web nic nezapisuje.

## BE-14: AML události

**Priorita:** P3 (nice-to-have podle `spec/spec.md` 7.6). V MVP AML událost nevzniká (V13).

```http
GET   /api/aml-events?status=&assignee=&limit=&offset=
GET   /api/aml-events/:eventId
PATCH /api/aml-events/:eventId          { triage: "FP" | "REVIEW", priority: 0-100, assignee, approver, status, reason }
GET   /api/evaluation-runs/:runId/export.csv
```

Export ve formátu povinného CSV podle `spec/spec.md` sekce 6. Rozhodnutí o události se zapisuje do audit logu (BE-13). Kdo smí rozhodnout a schválit (střet zájmů, 4-eyes) musí posoudit compliance.

## BE-15: Detail klienta

**Priorita:** P3. Podle `spec/spec.md` 7.5 bod 4: transakce, klient, jeho historie a výsledky pravidel.

```http
GET /api/clients/:clientId
GET /api/clients/:clientId/transactions?limit=&offset=
```

Odpověď detailu: `{ clientId, country, amlRiskScore, isPep, projectedVolumes, historicalVolumes }`. Web pak přidá proklik z detailu transakce.

## BE-16: Kontrola aktualizací regulací

**Priorita:** P3. Podle `spec/spec.md` 7.4 a `spec/datovy-model.md` „Aktualizace regulace“ a M1.

```http
POST /api/regulations/check-updates
POST /api/regulations/:regulationId/check-update
```

Odpověď: `{ checkedAt, updates: [{ regulationId, newRegulationVersionId, affectedRuleIds, proposedRuleVersionIds }] }`. Pro dotčená pravidla backend založí nové verze `pending_review` s `createdVia: "reg_update"`, v UI se ukážou jako `update_for_review`. Scraping zdrojů je mimo MVP, stačí ruční vložení nového znění přes `POST /api/regulations/:regulationId/versions` a tento endpoint na diff.

## BE-17: Prahy a konfigurace vyhodnocení z API

**Priorita:** P3. Prahy (fail ≥ 40, alert ≥ 75), seznam rizikových zemí a kurzy jsou ve webu demo hodnoty v mocku.

```http
GET /api/evaluation-config
```

Odpověď: `{ hitThreshold, alertThreshold, highRiskCountryListVersionId, fxSource }`. Hodnoty prahů musí schválit compliance.
