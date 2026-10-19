# TODO backend

Co musí backend (`src/backend`) doplnit, aby web (`src/web`) fungoval v live režimu celý. Web v live režimu skrývá vše, co API neumí. Skryté prvky řídí `capabilities` v kontraktech služeb (`features/*/api/contract.ts`), komentář u každé hodnoty `false` odkazuje na ID z tohoto souboru. Přehled skrytých prvků je v [todo-web.md](todo-web.md), sekce „Záměrně skryté v UI (čeká na API)“.

Návrhy endpointů drží styl stávajícího API: prefix `/api`, JSON v camelCase, stránkování `limit` + `offset` (max 500), uživatel jako UUID (`createdBy`, `reviewedBy`), neměnné verze (M17). Doménové typy webu jsou v `src/web/features/*/types.ts`, DTO stávajícího API v `src/web/features/*/api/dto.ts`.

Priority: **P1** = bez toho chybí hlavní tok demo (nahrát transakce, vytvořit pravidla), **P2** = funkce je ve webu hotová na mocku a v live chybí, **P3** = výkon, pohodlí, nice-to-have.

## Přehled

| ID    | Co                                                                                                           | Odemkne ve webu                                 | Priorita |
| ----- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------- | -------- |
| BE-01 | Nahrání CSV dávky a engine běhu (endpoint startu běhu už existuje, vrací 501)                                | `batches.canUploadBatch`, `batches.canStartRun` | P1       |
| BE-02 | Wizard: načtení regulace z URL a generování předpisů přes Bedrock (text a MD už fungují, generátor je dummy) | `wizard.canFetchUrl`                            | P1       |
| BE-03 | Wizard: generování pravidel ze schváleného předpisu přes Bedrock (tok už funguje, generátor je dummy)        | kvalita návrhů pravidel                         | P1       |
| BE-04 | Generování definice deterministického pravidla z popisu                                                      | `rules.canCreateDeterministicRule`              | P1       |
| BE-05 | Úprava draftu pravidla, nebo rozhodnutí, že verze zůstanou neměnné                                           | `rules.canEditDraftContent`                     | P2       |
| BE-06 | Seznam klientů pro návrhy ve whitelistu                                                                      | `rules.canSuggestWhitelistClients`              | P3       |
| BE-07 | Souhrnný endpoint pro dashboard (volitelné)                                                                  | rychlejší dashboard                             | P3       |
| BE-08 | Popis regulace                                                                                               | text v detailu regulace                         | P2       |
| BE-09 | Částka v CZK v seznamu transakcí běhu                                                                        | sloupec částky v CZK                            | P2       |
| BE-10 | Právní základ v detailu transakce                                                                            | proklik pravidlo → paragraf                     | P2       |
| BE-11 | Stavy verzí interního předpisu                                                                               | správný stav předpisu                           | P2       |
| BE-12 | Agregované endpointy s verzemi (N+1)                                                                         | rychlost seznamů                                | P2       |
| BE-13 | Audit log                                                                                                    | nová sekce Audit log                            | P2       |
| BE-14 | AML události                                                                                                 | nová sekce AML události                         | P3       |
| BE-15 | Detail klienta                                                                                               | nová obrazovka klienta                          | P3       |
| BE-16 | Kontrola aktualizací regulací                                                                                | tlačítko „Zkontrolovat aktualizace“             | P3       |
| BE-17 | Prahy a konfigurace vyhodnocení z API                                                                        | prahy a kurzy bez demo hodnot                   | P3       |
| BE-18 | Atomické založení regulace, znění a návrhů předpisů                                                          | opakování průvodce po chybě                     | P2       |
| BE-19 | Návrhy pravidel po selhání generátoru při schválení předpisu                                                 | předpis nezůstane bez pravidel                  | P2       |
| BE-20 | Vytvořená pravidla v odpovědi schválení předpisu                                                             | počet návrhů bez porovnávání seznamů            | P3       |
| BE-21 | Filtr `GET /rules?policyId=`                                                                                 | méně requestů v průvodci                        | P3       |

## BE-01: Nahrání CSV dávky, spuštění běhu a průběh

**Priorita:** P1. **Odemkne:** `batches.canUploadBatch` a `batches.canStartRun` (`features/batches/api/live.ts`). Dnes je obrazovka Dávky v live režimu jen seznam běhů, dropzone, tlačítko „Spustit vyhodnocení“ a tlačítko „Nahrát dávku“ na dashboardu jsou skryté.

**Stav (částečně hotovo):** `POST /api/evaluation-runs` už existuje (`evaluationRunsRouter.ts`), bez těla požadavku. `EvaluationRunUseCases.startRun` ale zatím hází `NotImplementedError`, takže endpoint vrací `501` (TODO #3). Web má live adapter hotový (`startRun` pošle `POST` a otevře běh přes `GET /api/evaluation-runs/:runId`), `httpClient.ts` mapuje `501` na chybu typu `unsupported`. Až engine poběží, stačí v `live.ts` přepnout `canStartRun` na `true`.

Zbývá:

- Engine: spustit aktivní zapnutá pravidla nad transakcemi a uložit běh (D18, V5, V14). Odpověď `201` (nebo `202`) s `id` běhu, web pak polluje `GET /api/evaluation-runs/:runId`.
- Nahrání CSV (`spec/spec.md` 7.5, `spec/datovy-model.md` V1 až V5). Návrh:

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
- `startRun` dnes nemá `createdBy`. Web ho zatím neposílá, až ho backend bude chtít, doplní se do těla požadavku.
- Volitelně `POST /api/evaluation-runs/:runId/rerun` pro nové vyhodnocení stejných transakcí s aktuálními pravidly (V2).

## BE-02: Wizard, zdroj regulace → drafty interních předpisů

**Priorita:** P1 (generátor), P2 (načtení z URL). **Odemkne:** `wizard.canFetchUrl` (`features/wizard/api/live.ts`).

**Stav (částečně hotovo):** minimální tok je na API a web ho v live režimu používá, průvodce je vidět včetně vstupů (CTA na dashboardu, „Přidat regulaci“, „Vytvořit pravidla z této regulace“):

1. `POST /api/regulations { code, title, kind, sourceUrl? }`, nebo existující regulace přes `/wizard?regulationId=`.
2. `POST /api/regulations/:regulationId/versions { label, fullText }`. Web posílá vložený text, nebo obsah souboru Markdown přečtený v prohlížeči.
3. `POST /api/regulations/:regulationId/versions/:versionId/draft-policies { createdBy }` vrátí N verzí předpisů ve stavu `draft` (`createdVia: "wizard"`). Web je ukáže všechny k úpravě, úprava se uloží jako nová verze přes `POST /api/internal-policies/:policyId/versions`.

Zbývá:

- **Generátor:** `DummyDraftGenerator.draftPolicies` vrací dva zástupné předpisy (`[DUMMY]` v názvu, `ref: "neurčeno"`). Nahradit extrakcí povinností přes Bedrock z textu znění (TODO #1), s `ref` na konkrétní paragrafy (M3). Výstup je návrh AI, musí ho schválit člověk (compliance review).
- **Načtení regulace z URL (P2):** backend regulaci z URL nenačítá. Web má v kroku Regulace záložku URL, kde uživatel zadá jen URL (bez kódu, názvu, druhu a označení znění). V live režimu je záložka vidět, ale ukáže upozornění a odeslat nejde (`canFetchUrl: false`). Mock metadata odvodí z URL sám. Backend má:
  1. stáhnout stránku nebo dokument z URL (jen `http`/`https`, limit velikosti, timeout, ochrana proti SSRF, tedy žádné interní a privátní adresy),
  2. vytáhnout z něj text znění,
  3. odvodit metadata regulace (`code`, `title`, `kind`), např. přes Bedrock, výstup je návrh AI k ověření člověkem,
  4. založit regulaci (`sourceUrl` = zadaná URL) a její znění.

  Návrh endpointu:

  ```http
  POST /api/regulations/import
  { "url": "https://eur-lex.europa.eu/eli/reg/2024/1624/oj", "createdBy": "<uuid>" }
  → 201 { "regulation": RegulationDto, "version": RegulationVersionSummaryDto }
  ```

  Web pak pokračuje stejně jako dnes: `POST /api/regulations/:regulationId/versions/:versionId/draft-policies`. Označení znění odvodí backend (např. „Načteno z URL k 2026-10-19“). Pro nové znění existující regulace z URL navrhujeme `POST /api/regulations/:regulationId/versions/import { url, label?, createdBy }` se stejnou odpovědí. Nestažitelnou nebo prázdnou stránku vracet jako `422` s popisem, aby ho web ukázal.

- Původně navržený endpoint `POST /api/wizard/policy-drafts` už není potřeba.

## BE-03: Wizard, generování pravidel z předpisu a dokončení review

**Priorita:** P1. **Odemkne:** kvalitní návrhy pravidel v průvodci (capability už není potřeba, tok funguje).

**Stav (částečně hotovo):** schválení verze předpisu (`POST /api/internal-policies/:policyId/versions/:versionId/review` s `decision: "approved"`) samo založí návrhy pravidel (`internalPolicyUseCases.reviewVersion` → `draftingUseCases.draftRules`). Každé pravidlo má první verzi `draft`, `createdVia: "wizard"`, `derivedFromPolicyVersionId` a právní základy předpisu. Web po schválení načte pravidla předpisu (`GET /api/rules` a verze) a v kroku review je schvaluje nebo zamítá stávajícími endpointy pravidel. Dokončení review odešle zbylé drafty přes `POST /api/rules/:ruleId/versions/:versionId/submit`, takže původně navržený `POST /api/wizard/policy-drafts/:policyId/finish` není potřeba.

Zbývá:

- **Generátor:** `DummyDraftGenerator.draftRules` vrací dvě zástupná deterministická pravidla (částka nad 1 000 000 CZK, `[DUMMY]` v textu). Nahradit generováním přes Bedrock s JSON schématem z katalogu featur (M10), včetně agentních pravidel (`agentPrompt`, `agentModelId`, M13) a vnořených skupin podmínek (TODO #2). Neplatnou definici backend odmítne, ne web.
- Předpis bez právního základu dnes žádná pravidla nedostane (M5). Web to v kroku review oznámí.
- Úprava draftu pravidla v kroku review potřebuje BE-05. Bez něj web tlačítko „Upravit“ skryje a zbude schválit nebo zamítnout.
- Generování běží synchronně v requestu schválení. S Bedrockem to může trvat desítky sekund, zvážit asynchronní zpracování a stav generování.

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

## BE-18: Atomické založení regulace, znění a návrhů předpisů

**Priorita:** P2. Průvodce volá tři requesty za sebou (`POST /api/regulations`, `POST .../versions`, `POST .../draft-policies`). Když selže druhý nebo třetí, v `main` zůstane regulace bez znění nebo znění bez předpisů. Opakování průvodce pak skončí `409`, protože `code` regulace je unikátní, a uživatel musí zvolit jiný kód.

Návrh: jeden endpoint, který vše provede v jedné transakci, např. `POST /api/regulations/drafts { regulation: { code, title, kind, sourceUrl } | { regulationId }, version: { label, fullText }, createdBy }` s odpovědí `{ regulation, version, policyVersions }`. Alternativa: idempotentní `POST /api/regulations`, který pro stejný `code` a stejná metadata vrátí existující regulaci.

## BE-19: Návrhy pravidel po selhání generátoru při schválení předpisu

**Priorita:** P2. `internalPolicyUseCases.reviewVersion` nejdřív uloží schválení (`recordReview`) a až pak volá `draftRules`. Když generování selže (s Bedrockem reálná možnost), request skončí `500`, ale předpis už je schválený a pravidla nevzniknou. Znovu schválit nejde (`409`) a jiný způsob, jak návrhy vytvořit, API nemá.

Návrh: schválení a založení pravidel v jedné transakci, nebo samostatný endpoint `POST /api/internal-policies/:policyId/versions/:versionId/draft-rules` pro opakované vytvoření návrhů ze schválené verze.

## BE-20: Vytvořená pravidla v odpovědi schválení předpisu

**Priorita:** P3. Odpověď schválení vrací jen verzi předpisu. Web zjišťuje, která pravidla vznikla, porovnáním `GET /api/rules` před a po schválení (`features/policies/api/live.ts`, `approvePolicy`), a podle toho ukáže hlášku s počtem návrhů. Při souběžné práci víc lidí na stejném předpisu by počet nemusel sedět.

Návrh: přidat do odpovědi `POST /api/internal-policies/:policyId/versions/:versionId/review` pole `draftedRuleVersions` (výsledek `draftRules`), nebo vracet `{ version, draftedRuleVersions }`.

## BE-21: Filtr `GET /rules?policyId=`

**Priorita:** P3. Průvodce načítá pravidla jednoho předpisu tak, že stáhne všechna pravidla a filtruje je ve webu (`fetchPolicyRulesWithVersions` v `features/rules/api/dto.ts`). Přidat filtr `policyId` (a ideálně `include=versions`, viz BE-12).
