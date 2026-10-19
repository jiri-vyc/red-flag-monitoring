# Katalog featur pro deterministická pravidla

- **Verze:** 0.2, 2026-10-19. Implementováno v `src/backend/src/domain/features/` ([README pro vývojáře a agenty](../src/backend/src/domain/features/README.md)).
- **Zdroj:** příklady pravidel v [knowledgebase/pravidla-priklady](../knowledgebase/pravidla-priklady/README.md) (TM-01 až TM-06, PR-01 až PR-11).
- **Navazuje na:** [M10, M14](datovy-model.md#rozhodnutí-pravidla), [V4, V8, V11](datovy-model.md#rozhodnutí-vyhodnocení), [D18](spec.md#2-klíčová-rozhodnutí).

Featura je pojmenovaná hodnota, kterou engine spočítá pro jednu vyhodnocovanou transakci z transakce, klienta a historie klienta v paměti. Podmínky v `definition.conditions` porovnávají featury s konstantami, výrazy a referenčními seznamy. Katalog je jen v kódu (M10).

## 1. Společná pravidla výpočtu

| #   | Pravidlo                                                                                                                                                                                                                                         | Důvod                                                                                                                                     |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| F1  | **Bez pohledu dopředu.** Každá featura se počítá k okamžiku vyhodnocované transakce `t`. Použije jen transakce s `(occurred_at, transaction_id) <= (t, id)`. Okna jsou tvaru `(t − Δ, t]`.                                                       | Historie obsahuje i pozdější transakce (V4). Zásah padne na transakci, která vzor dokončila. Stejná sémantika půjde použít v live režimu. |
| F2  | Měsíc, den a ISO týden jsou kalendářní hranice podle hodnoty `ts` tak, jak je uložená (`TIMESTAMP` bez časového pásma = místní čas z CSV). Engine časové pásmo nepřevádí. „Měsíční“ a „denní“ featury jsou tedy _month-to-date_ a _day-to-date_. | Pravidla mluví o kalendářním měsíci a dni. Převod pásma by posunul transakce kolem půlnoci do jiného dne.                                 |
| F3  | Částky jsou v CZK přes kurz ČNB k datu transakce, o víkendu a svátku přes poslední vyhlášený kurz (V11). Použitý kurz se ukládá do `features` jako `tx_fx`. Platí i pro PoC data, viz [sekce 4](#4-ověření-na-poc-datech).                       | Trace musí jít přečíst bez přepočtu.                                                                                                      |
| F4  | „Odchozí“ = `outgoing` nebo `remittance`. „Příchozí“ = `incoming`. Protistrana = `counterparty_account` / `counterparty_country` (generované sloupce).                                                                                           | Společné konvence příkladů.                                                                                                               |
| F5  | L = 25 000 CZK (1 000 EUR) je **pevný parametr kódu**.                                                                                                                                                                                           | Konvence příkladů.                                                                                                                        |
| F6  | Featura bez smysluplné hodnoty vrátí `null` (např. Q2 baseline u klienta bez transakcí v Q2). Porovnání s `null` je vždy `false` a trace to ukáže.                                                                                               | Pokrývá „klient bez Q2 se posuzuje jen podle (a)“ (TM-01) a „nevyhodnocuje se“ (PR-07).                                                   |
| F7  | Featura nad historií vrací vedle hodnoty i ID použitých transakcí. Engine je sloučí do `context_refs` (V8).                                                                                                                                      | Vysvětlitelnost zásahu.                                                                                                                   |
| F8  | Vzorová featura (sekce 2.4) má **pevné parametry** v kódu (okno, pásmo, L). Pravidlo porovnává jen její výsledek.                                                                                                                                | DSL podmínek zůstane jednoduchý. Změna parametru = změna kódu + PR review (M10).                                                          |

Záznam v katalogu: `id`, `label` (česky, pro lidský přepis), `type` (`number`, `string`, `boolean`, `string[]`), `unit` (`CZK`, `count`, `months`, `ratio`), `nullable`, `description`, výpočet `(ctx) → { value, refs }`. Z katalogu se generuje JSON schema pro Bedrock a slovník pro český přepis.

## 2. Seznam featur

### 2.1 Vyhodnocovaná transakce

| Featura                 | Typ              | Popis                                                                                 | Pravidla                                       |
| ----------------------- | ---------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `tx_amount_czk`         | number, CZK      | Částka transakce v CZK.                                                               | TM-01 c, TM-02, TM-03, PR-09                   |
| `tx_type`               | string           | `outgoing`, `incoming`, `remittance`.                                                 | PR-08, PR-09, PR-11, všechna (omezení na směr) |
| `tx_is_outgoing`        | boolean          | `outgoing` nebo `remittance`.                                                         | TM-03                                          |
| `tx_payer_country`      | string, nullable | Země plátce.                                                                          | TM-02, PR-10                                   |
| `tx_payee_country`      | string           | Země příjemce.                                                                        | TM-02, PR-09, PR-10                            |
| `tx_payer_info_missing` | boolean          | Chybí `payer_account` nebo `payer_country`.                                           | PR-11                                          |
| `tx_fx`                 | objekt           | Použitý kurz (`currency`, `rate_date`, `czk_per_unit`). Jen do trace, ne do podmínek. | všechna s částkou                              |

### 2.2 Klient (statické údaje)

| Featura                               | Typ                     | Popis                                                     | Pravidla            |
| ------------------------------------- | ----------------------- | --------------------------------------------------------- | ------------------- |
| `client_country`                      | string                  | Země klienta.                                             | TM-02               |
| `client_is_pep`                       | boolean                 | PEP.                                                      | TM-03, PR-07, PR-08 |
| `client_risk_score`                   | string                  | `low`, `medium`, `high`.                                  | PR-07, PR-08        |
| `client_contract_channel`             | string                  | `in_person`, `distant`.                                   | TM-05               |
| `client_tenure_months_at_tx`          | number, months          | Celé měsíce od `contract_date` ke dni transakce.          | PR-09               |
| `client_tenure_months_at_month_start` | number, months          | Celé měsíce od `contract_date` k 1. dni měsíce transakce. | TM-05               |
| `client_projected_monthly_volume_czk` | number, CZK             | Očekávaný měsíční objem.                                  | TM-01 a, TM-05      |
| `client_projected_monthly_tx_count`   | number, count           | Očekávaný měsíční počet transakcí.                        | PR-07               |
| `client_q2_daily_avg_volume_czk`      | number, CZK, nullable   | `q2_volume_czk / 91`. `null`, když `q2_tx_count = 0`.     | TM-01 b             |
| `client_q2_monthly_avg_tx_count`      | number, count, nullable | `q2_tx_count / 3`. `null`, když `q2_tx_count = 0`.        | PR-07               |
| `client_q2_max_tx_czk`                | number, CZK, nullable   | Maximální transakce v Q2. `null`, když `q2_tx_count = 0`. | TM-01 c             |

Průměry Q2 jsou samostatné featury, aby výraz v podmínce zůstal jen `k × featura` (bez dělení).

### 2.3 Agregace historie klienta (okna končí v `t`)

| Featura                         | Typ           | Okno a filtr                                                | Pravidla   |
| ------------------------------- | ------------- | ----------------------------------------------------------- | ---------- |
| `day_volume_czk`                | number, CZK   | Den `t`, všechny směry, součet.                             | TM-01 a, b |
| `month_volume_czk`              | number, CZK   | Měsíc `t`, všechny směry, součet.                           | TM-05      |
| `month_tx_count`                | number, count | Měsíc `t`, všechny směry, počet.                            | PR-07      |
| `month_remittance_sum_czk`      | number, CZK   | Měsíc `t`, `remittance`, součet.                            | PR-08      |
| `day_distinct_payer_accounts`   | number, count | Den `t`, příchozí, počet různých `payer_account`.           | TM-06      |
| `day_distinct_payer_countries`  | number, count | Den `t`, příchozí, počet různých `payer_country`.           | PR-04      |
| `week_distinct_payer_countries` | number, count | ISO týden `t`, příchozí, počet různých `payer_country`.     | PR-04      |
| `near_limit_tx_count_7d`        | number, count | `(t − 7 d, t]`, všechny směry, částka 22 500–24 999,99 CZK. | PR-02      |

### 2.4 Vzorové featury (pevné parametry v kódu)

| Featura                      | Typ                     | Výpočet                                                                                                                                                                                              | Pravidla |
| ---------------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `payee_small_out_count_7d`   | number, count, nullable | Jen pro odchozí `t`. Odchozí na `payee_account` transakce `t` v `(t − 7 d, t]` s částkou < L.                                                                                                        | PR-01    |
| `payee_small_out_sum_7d_czk` | number, CZK, nullable   | Součet stejné množiny.                                                                                                                                                                               | PR-01    |
| `quick_forward_match_count`  | number, count, nullable | Jen pro odchozí `t`. Příchozí transakce v `[t − 2 h, t)` s částkou ≥ L, pro které platí `0,9 ≤ částka t / částka příchozí ≤ 1,1` a `payee_account` transakce `t` ≠ `payer_account` příchozí.         | PR-05    |
| `round_trip_match_count_72h` | number, count, nullable | Jen pro `t` s částkou ≥ L. Transakce opačného směru se stejným `counterparty_account` v `[t − 72 h, t)` s částkou ≥ L. Okno „před i po“ z PR-06 pokrývá F1: zásah padne na druhou transakci dvojice. | PR-06    |
| `passthrough_in_24h_czk`     | number, CZK, nullable   | Jen pro odchozí `t`. Kotva = příchozí transakce `a` v `[t − 6 h, t)`, kde IN = příchozí v `(a − 24 h, a]` > 100 000 CZK. Vrací IN kotvy s nejvyšším poměrem OUT / IN.                                | TM-04    |
| `passthrough_out_6h_czk`     | number, CZK, nullable   | OUT stejné kotvy = odchozí v `(a, t]` na účty, které nejsou `payer_account` žádné transakce z IN.                                                                                                    | TM-04    |
| `passthrough_ratio`          | number, ratio, nullable | OUT / IN stejné kotvy.                                                                                                                                                                               | TM-04    |
| `payee_day_distinct_clients` | number, count           | **Mimo historii klienta, viz otázka 1.** Den `t`, odchozí na `payee_account` transakce `t` od všech klientů, počet různých klientů.                                                                  | PR-03    |

## 3. Pokrytí příkladů

Zápis podmínek: `all[…]` = všechny, `any[…]` = aspoň jedna, `in HRJ` = referenční seznam (`HRJ` = vysoce rizikové jurisdikce podle SVZ-03 čl. 4.4, `EEA` = státy EHP).

| Pravidlo | Podmínky nad featurami                                                                                                                                                                                                                                                                         |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TM-01    | `any[day_volume_czk > 0,25 × client_projected_monthly_volume_czk, day_volume_czk > 3 × client_q2_daily_avg_volume_czk, tx_amount_czk > 2 × client_q2_max_tx_czk]`                                                                                                                              |
| TM-02    | `all[tx_amount_czk > 10 000, any[tx_payer_country in HRJ, tx_payee_country in HRJ, client_country in HRJ]]`                                                                                                                                                                                    |
| TM-03    | `all[client_is_pep = true, tx_is_outgoing = true, tx_amount_czk > 100 000]`                                                                                                                                                                                                                    |
| TM-04    | `passthrough_ratio >= 0,8`                                                                                                                                                                                                                                                                     |
| TM-05    | `all[client_contract_channel = distant, client_tenure_months_at_month_start < 6, month_volume_czk > 3 × client_projected_monthly_volume_czk]`                                                                                                                                                  |
| TM-06    | `all[tx_type = incoming, day_distinct_payer_accounts >= 7]`                                                                                                                                                                                                                                    |
| PR-01    | `all[payee_small_out_count_7d >= 3, payee_small_out_sum_7d_czk >= 25 000]`                                                                                                                                                                                                                     |
| PR-02    | `near_limit_tx_count_7d >= 3`                                                                                                                                                                                                                                                                  |
| PR-03    | `payee_day_distinct_clients >= 40`                                                                                                                                                                                                                                                             |
| PR-04    | `all[tx_type = incoming, any[day_distinct_payer_countries >= 5, week_distinct_payer_countries >= 7]]`                                                                                                                                                                                          |
| PR-05    | `quick_forward_match_count >= 1`                                                                                                                                                                                                                                                               |
| PR-06    | `round_trip_match_count_72h >= 1`                                                                                                                                                                                                                                                              |
| PR-07    | `any[all[month_tx_count > 5 × client_q2_monthly_avg_tx_count, month_tx_count > 5 × client_projected_monthly_tx_count], all[any[client_risk_score = high, client_is_pep = true], month_tx_count > 3 × client_q2_monthly_avg_tx_count, month_tx_count > 3 × client_projected_monthly_tx_count]]` |
| PR-08    | `all[tx_type = remittance, any[month_remittance_sum_czk >= 375 000, all[any[client_risk_score = high, client_is_pep = true], month_remittance_sum_czk >= 187 500]]]`                                                                                                                           |
| PR-09    | `all[tx_type = remittance, tx_payee_country not_in EEA, tx_amount_czk >= 25 000, client_tenure_months_at_tx < 6]`                                                                                                                                                                              |
| PR-10    | `any[tx_payer_country in HRJ, tx_payee_country in HRJ]`                                                                                                                                                                                                                                        |
| PR-11    | `all[tx_type = incoming, tx_payer_info_missing = true]`                                                                                                                                                                                                                                        |

Podmínka na `tx_type` u pravidel s kumulativní featurou omezí zásahy na transakce, které vzor mohou dokončit. Bez ní by např. PR-04 zasáhlo i odchozí platbu po splnění podmínky.

## 4. Ověření na PoC datech

Všech 17 pravidel ze sekce 3 jsme spustili nad celým datasetem (397 853 transakcí, ~6 s). Pole `volume` se v PoC datech chová jako částka už v CZK: medián je stejný ve všech 23 měnách ([SVZ-03, Příloha 2](../knowledgebase/vnitrni-predpisy/svz-03-monitoring-transakci.md)). Engine přesto přepočítává kurzem ČNB (R6), proto se počty u pravidel s částkou liší od README příkladů.

| Pravidlo | README            | Kurz ČNB (engine)   | `volume` jako CZK |
| -------- | ----------------- | ------------------- | ----------------- |
| TM-01    | 4 669 klientů     | 5 493 klientů       | 4 669             |
| TM-03    | 4 tx, 3 klienti   | 112 tx, 22 klientů  | 4 tx, 3 klienti   |
| TM-04    | 16 klientů        | 1 077 klientů       | 16                |
| TM-05    | 36 klientů        | 99 klientů          | 35                |
| PR-02    | 111 klientů       | 97 klientů          | 111               |
| PR-05    | 34 klientů        | 152 klientů         | 34                |
| PR-06    | 33 klientů        | 129 klientů         | 33                |
| PR-08    | 41 klientů        | 3 033 klientů       | 41                |
| PR-09    | 18 tx, 17 klientů | 202 tx, 154 klientů | 18 tx, 17 klientů |

Ostatní pravidla nezávisí na částce a dávají stejný výsledek jako README: TM-02 0, TM-06 16 klientů, PR-01 4, PR-03 31 účtů příjemce, PR-04 35, PR-07 280, PR-10 0, PR-11 0.

- **Sloupec „`volume` jako CZK“** ověřuje logiku featur a DSL: odpovídá README kromě TM-05. Tam rozdíl dělá klient se smlouvou z 31. 12. 2025. K 1. 7. 2026 má 6 celých kalendářních měsíců vztahu, ale jen 182 dní. Referenční výpočet zřejmě počítal ve dnech, engine počítá celé měsíce.
- **F1 (bez pohledu dopředu)** u TM-04 a PR-06 dává stejnou množinu klientů jako znění předpisu.

## 5. Rozhodnutí z review

| #   | Rozhodnutí                                                                                                                                                              |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | DSL podporuje vnořené skupiny podmínek (`{ id, label, match, conditions }`) a výraz jen ve tvaru `<číslo> × <featura>`.                                                 |
| R2  | Featury mají pevné parametry v kódu (F8). Parametrizace featur je mimo MVP.                                                                                             |
| R3  | PR-03: engine na začátku běhu postaví v paměti index `payee_account × den → platby` ze všech odchozích transakcí v DB a předá ho v kontextu. Pravidla se do DB neptají. |
| R4  | Kurzy ČNB 2025–2026 a referenční seznamy `EU_HRTC`, `FATF_BLACK`, `FATF_GREY`, `HRJ` a `EEA` plní seed migrace. Jsou aplikované na `main`.                              |
| R5  | Den, týden a měsíc se počítají z `ts` bez převodu časového pásma (F2).                                                                                                  |
| R6  | Částky se vždy přepočítávají kurzem ČNB (V11), i u PoC dat. Počty zásahů proto nesedí s README příkladů.                                                                |

Zbývá rozhodnout:

- **Seznamy FATF** jsou převzaté ze sekundárních zdrojů (stav 19. 6. 2026), protože fatf-gafi.org nebyl dostupný. Po plenárním zasedání FATF v říjnu 2026 je potřeba přidat novou verzi seznamu.
- **Granularita alertů.** Zásah padne na každou transakci od splnění podmínky do konce období. Sloučení do alertu „1 na klienta a měsíc“ patří do agregace událostí ([otázka 5 ve spec](spec.md#10-otevřené-otázky)).

## 6. Compliance poznámky

- **F1 (bez pohledu dopředu)** mění tvar TM-04 a PR-06 oproti textu předpisu. Množina klientů se zásahem je na PoC datech stejná, zásah ale padne na jinou transakci.
- **Přepočet PoC dat kurzem** dává mnohem víc zásahů než validace v SVZ-03 (např. TM-01 u všech klientů). Validace v SVZ-03 počítá `volume` jako CZK a čeká na potvrzení od FINREG. Kontrola DQ-4 v SVZ-03 tento stav hlásí jako „datovou výhradu“.
- **Seznamy FATF ze sekundárních zdrojů** je potřeba před nasazením ověřit proti fatf-gafi.org.
- **Pevné parametry ve vzorových featurách** (L, okna, pásmo 0,9–1,1) nejsou ve verzi pravidla. Jejich změna v kódu změní detekci bez nové verze pravidla. Zachytí ji jen `engine_version` (V10). Před nasazením je potřeba rozhodnout, zda parametry patří do verze pravidla a do schválení.
