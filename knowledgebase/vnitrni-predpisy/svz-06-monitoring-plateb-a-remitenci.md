# SVZ-06 Směrnice o monitoringu plateb a remitencí podle rizikových faktorů EBA

| | |
| --- | --- |
| **Vychází z regulace** | **Obecné pokyny EBA k rizikovým faktorům praní peněz a financování terorismu (EBA/GL/2021/02), Obecný pokyn č. 11: Odvětvový pokyn pro subjekty zabývající se poukazováním peněz (body 11.5–11.15)**. Plné znění: [`../regulace/plne-zneni/eba-gl-2021-02-rizikove-faktory.md`](../regulace/plne-zneni/eba-gl-2021-02-rizikove-faktory.md) |
| **Novely regulace** | EBA/GL/2023/03 ([`eba-gl-2023-03-novela-rizikove-faktory.md`](../regulace/plne-zneni/eba-gl-2023-03-novela-rizikove-faktory.md)) a EBA/GL/2024/01 ([`eba-gl-2024-01-novela-rizikove-faktory.md`](../regulace/plne-zneni/eba-gl-2024-01-novela-rizikove-faktory.md)) Obecný pokyn č. 11 nemění (ověřeno 2026-10-19). |
| **Navazující předpisy** | Zákon č. 253/2008 Sb. ([`zakon-253-2008-aml.md`](../regulace/plne-zneni/zakon-253-2008-aml.md)): § 6, § 9, § 18. Vyhláška ČNB č. 67/2018 Sb. ([`vyhlaska-cnb-67-2018.md`](../regulace/plne-zneni/vyhlaska-cnb-67-2018.md)): § 9 odst. 5. Nařízení (EU) 2023/1113 ([`eu-2023-1113-tfr.md`](../regulace/plne-zneni/eu-2023-1113-tfr.md)): čl. 7. |
| **Instituce** | [Instituce], platební instituce poskytující platební účty a službu poukazování peněz (remitence), povinná osoba podle § 2 odst. 1 písm. b) bodu 5 AML zákona (vzorový subjekt pro PoC) |
| **Druh předpisu** | Metodický předpis, součást systému vnitřních zásad (SVZ) podle § 21 AML zákona |
| **Verze / stav** | 0.1 / **DRAFT pro PoC**, vygenerováno AI, čeká na revizi AML compliance officerem |
| **Vlastník / schvaluje** | AML compliance officer / statutární orgán |
| **Účinnost** | [doplnit] |
| **Souvisí s** | SVZ-03 Směrnice o monitoringu transakcí ([`svz-03-monitoring-transakci.md`](svz-03-monitoring-transakci.md)), která upravuje zpracování alertů, eskalaci, lhůty a záznamy |

> **Upozornění:** Vzorový předpis pro hackathonový PoC. Není právním stanoviskem ani schváleným SVZ. Obecné pokyny EBA nejsou přímo závazné; ČNB je uplatňuje v dohledu a vyhláška vyžaduje, aby Instituce kritéria neobvyklých obchodů sama stanovila (§ 9 odst. 5 vyhlášky). Parametry označené „kalibrace“ regulace nestanoví, jde o návrh Instituce. Místa k rozhodnutí jsou označena **[ROZHODNUTÍ]**.

> **Struktura pro strojové zpracování:** Každé pravidlo monitoringu má vlastní článek s nadpisem `### Čl. N` a stejnou osnovou: Účel, Citace regulace (doslovně), Pravidlo, Datová pole, Parametry, Alert, Priorita, Validace. Citace v uvozovkách „…“ jsou doslovné úryvky z plného znění regulace. Názvy datových polí odpovídají datovému modelu nástroje pro extrakci pravidel.

---

## Část první – Obecná ustanovení

### Čl. 1 Účel a působnost

(1) Směrnice zavádí systémy sledování transakcí, které Obecný pokyn č. 11 EBA/GL/2021/02 očekává u subjektů poskytujících službu poukazování peněz, a převádí rizikové faktory z bodů 11.5–11.11 na konkrétní pravidla monitoringu.

(2) Směrnice se vztahuje na všechny transakce klientů: příchozí platby (`incoming`), odchozí platby (`outgoing`) a remitence (`remittance`).

(3) Pravidla doplňují scénáře R-01 až R-06 ze SVZ-03. Alerty z obou směrnic se zpracovávají jedním postupem podle čl. 8 SVZ-03.

Citace regulace (bod 11.12): „měly by podniky zvážit, které systémy sledování a kontroly zavedou, aby zajistily, že odhalí pokusy o praní peněz a financování terorismu“

### Čl. 2 Datová pole

| Pole | Význam | Zdroj v datasetu |
| --- | --- | --- |
| `transaction_id` | ID transakce | transaction ID |
| `client_id` | ID klienta | client ID |
| `ts` | datum a čas transakce | date + time |
| `amount` | částka v CZK | volume (viz čl. 3 odst. 2) |
| `currency` | měna transakce | currency |
| `payer_country`, `payee_country` | země plátce a příjemce | country of payer / payee |
| `payer_account`, `payee_account` | anonymizovaný účet plátce a příjemce | account of payer / payee |
| `tx_type` | `incoming` / `outgoing` / `remittance` | type of transaction |
| `country` | země klienta | country of client |
| `contract_date`, `contract_channel` | datum a forma uzavření smlouvy (`in_person` / `distant`) | date of contract, contract concluded |
| `is_pep` | klient je PEP | PEP |
| `aml_risk_score` | `low` / `medium` / `high` | AML risk score |
| `projected_monthly_tx_count` | očekávaný měsíční počet transakcí | expected number of transactions |
| `q2_tx_count` | počet transakcí za Q2 2026 | real number of transactions in 2Q2026 |

### Čl. 3 Společná pravidla výpočtu

(1) **Směr transakce:** `incoming` je příchozí. `outgoing` a `remittance` jsou odchozí. Remitence nemá účet plátce, je hrazena mimo platební účet klienta.

(2) **Částky:** Limity v EUR se přepočítají na CZK kurzem ČNB pro den transakce. V PoC se používá 1 EUR = 25 CZK a pole `volume` se bere jako částka v CZK (viz Příloha, zjištění D1). Zkratka **L** = 1 000 EUR = 25 000 CZK.

(3) **Okna:** „klouzavé okno N dní“ = interval (t − N dní, t] kolem každé transakce. „Den“ = kalendářní den 00:00:00–23:59:59. „Týden“ = kalendářní týden podle ISO 8601.

(4) **Vyšší riziko:** Klient má vyšší riziko, pokud `aml_risk_score` = `high` nebo `is_pep` = `Y`. U takových klientů se použijí nižší limity označené „vyšší riziko“.

Citace regulace (bod 11.14): „měly by podniky uplatňovat zesílenou hloubkovou kontrolu klienta v souladu s hlavou I, včetně případného zesíleného sledování transakcí (např. zvýšení četnosti nebo nižší limity)“

(5) **Sledované období:** kalendářní měsíc (PoC: červenec 2026). Pravidla běží denně (D+1).

### Čl. 4 Přehled pravidel

| Článek | ID | Pravidlo | Bod EBA GL | Vyhodnocení | Alertů v PoC datech |
| --- | --- | --- | --- | --- | --- |
| Čl. 5 | R-07 | Řada malých plateb stejnému příjemci | 11.13 a) | deterministické | 4 klienti |
| Čl. 6 | R-08 | Opakované platby těsně pod limitem | 11.7 b) iv. | deterministické | 111 klientů |
| Čl. 7 | R-09 | Mnoho klientů platí stejnému příjemci | 11.13 b), 11.7 b) vii. | deterministické + úsudek | 31 účtů příjemce |
| Čl. 8 | R-10 | Plátci z mnoha zemí jednomu příjemci | 11.5 d) | deterministické | 35 klientů |
| Čl. 9 | R-11 | Okamžité přeposlání přijaté částky | 11.7 b) v. | deterministické | 34 klientů |
| Čl. 10 | R-12 | Kruhové platby se stejnou protistranou | 11.7 b) v. | deterministické | 33 klientů |
| Čl. 11 | R-13 | Neobvyklý nárůst počtu transakcí | 11.7 b) x. | deterministické | 280 klientů |
| Čl. 12 | R-14 | Vysoký souhrn remitencí mimo účet | 11.5 c), 11.6 a) | deterministické | 41 klientů |
| Čl. 13 | R-15 | Remitence mimo EHP od nového klienta | 11.5 b), 11.8 a) | deterministické | 17 klientů |
| Čl. 14 | R-16 | Převod z/do vysoce rizikové třetí země | 11.11 d), 11.13 e) | deterministické | 0 |
| Čl. 15 | R-17 | Příchozí platba bez údajů o plátci | 11.7 b) viii. | deterministické | 0 |

## Část druhá – Pravidla monitoringu

### Čl. 5 R-07 Řada malých plateb stejnému příjemci

**Účel:** Odhalit rozdělení větší částky na řadu menších plateb pod limitem 1 000 EUR, které mají stejného plátce i příjemce (propojené transakce).

**Citace regulace (bod 11.13 a):** „systémy pro identifikaci propojených transakcí, včetně těch, které mohou být podle jejich strategií a postupů obchodním vztahem, jako jsou systémy pro identifikaci řady transakcí nižších než 1 000 EUR, které mají stejného plátce a příjemce a určité trvání;“

**Pravidlo:** Alert vznikne, pokud klient v klouzavém okně `P01_WINDOW` provede na stejný účet příjemce (`payee_account`) alespoň `P01_MIN_COUNT` odchozích transakcí, z nichž každá je nižší než `P01_LIMIT`, a jejich součet dosáhne alespoň `P01_LIMIT`.

**Datová pole:** `client_id`, `ts`, `amount`, `tx_type`, `payee_account`

**Parametry:**

| Parametr | Hodnota | Zdroj |
| --- | --- | --- |
| `P01_LIMIT` | 1 000 EUR (25 000 CZK) | regulace (bod 11.13 a) |
| `P01_MIN_COUNT` | 3 | kalibrace |
| `P01_WINDOW` | 7 dní | kalibrace („určité trvání“) |

**Alert:** 1 alert na dvojici klient–příjemce a měsíc. Obsahuje všechny transakce řady.

**Priorita (základ):** 40

**Validace:** 4 klienti. Na stejného příjemce jde v měsíci nejvýš 4 transakce.

### Čl. 6 R-08 Opakované platby těsně pod limitem

**Účel:** Odhalit klienta, který opakovaně volí částku těsně pod limitem 1 000 EUR, aby se vyhnul požadavkům vázaným na limit (strukturování).

**Citace regulace (bod 11.7 b) iv.):** „Transakce klienta se vždy pohybují těsně pod platnými limity“

**Pravidlo:** Alert vznikne, pokud má klient v klouzavém okně `P02_WINDOW` alespoň `P02_MIN_COUNT` transakcí (libovolného směru) s částkou v pásmu ⟨`P02_BAND_LOW` × `P02_LIMIT`; `P02_LIMIT`).

**Datová pole:** `client_id`, `ts`, `amount`

**Parametry:**

| Parametr | Hodnota | Zdroj |
| --- | --- | --- |
| `P02_LIMIT` | 1 000 EUR (25 000 CZK) | regulace (bod 11.7 b) iv., limit podle předpisu o převodech peněžních prostředků) |
| `P02_BAND_LOW` | 0,9 (pásmo 22 500–24 999,99 CZK) | kalibrace |
| `P02_MIN_COUNT` | 3 | kalibrace |
| `P02_WINDOW` | 7 dní | kalibrace |

**Alert:** 1 alert na klienta a měsíc.

**Priorita (základ):** 30

**Validace:** 111 klientů (při `P02_MIN_COUNT` = 4 jen 20). V pásmu pod limitem je 3 501 transakcí, v pásmu 25 000–27 500 CZK nad limitem 2 857.

### Čl. 7 R-09 Mnoho klientů platí stejnému příjemci

**Účel:** Odhalit účet příjemce, na který během jednoho dne posílá peníze neobvykle mnoho různých klientů Instituce (sběrný účet, síť „money mules“).

**Citace regulace (bod 11.13 b):** „systémy pro zjišťování, zda jsou transakce od různých klientů určeny pro stejného příjemce;“

**Citace regulace (bod 11.7 b) vii.):** „Několik klientů podniku převádí finanční prostředky stejnému příjemci“

**Pravidlo:** Alert vznikne, pokud na jeden účet příjemce (`payee_account`) pošle během jednoho dne odchozí transakci alespoň `P03_MIN_CLIENTS` různých klientů (`client_id`).

**Datová pole:** `client_id`, `ts`, `tx_type`, `payee_account`

**Parametry:**

| Parametr | Hodnota | Zdroj |
| --- | --- | --- |
| `P03_MIN_CLIENTS` | 40 | kalibrace (nad 99,9. percentilem = 38) |

**Alert:** 1 alert na účet příjemce a den. Obsahuje seznam klientů a transakcí. Při šetření se posoudí, zda jde o známý obchodní účet (dodavatel energií, e-shop). Takový účet lze po schválení zařadit na whitelist podle čl. 10 SVZ-03. Tato část vyžaduje úsudek.

**Priorita (základ):** 30

**Validace:** 31 účtů příjemce, všechny tuzemské (`ACZ…`). **[ROZHODNUTÍ]** Alert není vázán na jednoho klienta; pro výstupní CSV se uvede klient s nejvyšší částkou na daný účet.

### Čl. 8 R-10 Plátci z mnoha zemí jednomu příjemci

**Účel:** Odhalit klienta, kterému posílají peníze plátci z mnoha různých zemí.

**Citace regulace (bod 11.5 d):** „převody jsou prováděny jedním nebo více plátci v různých zemích místnímu příjemci.“

**Pravidlo:** Alert vznikne, pokud klient přijme příchozí transakce (`incoming`) od plátců z alespoň `P04_DAY_COUNTRIES` různých zemí (`payer_country`) během jednoho dne, **nebo** z alespoň `P04_WEEK_COUNTRIES` různých zemí během jednoho týdne.

**Datová pole:** `client_id`, `ts`, `tx_type`, `payer_country`

**Parametry:**

| Parametr | Hodnota | Zdroj |
| --- | --- | --- |
| `P04_DAY_COUNTRIES` | 5 | kalibrace (99,9. percentil = 4) |
| `P04_WEEK_COUNTRIES` | 7 | kalibrace (99,9. percentil = 7) |

**Alert:** 1 alert na klienta a měsíc.

**Priorita (základ):** 35

**Validace:** 35 klientů (denní podmínka 4, týdenní 32).

### Čl. 9 R-11 Okamžité přeposlání přijaté částky

**Účel:** Odhalit klienta, který přijatou částku obratem pošle dál jinému příjemci (průtokový účet).

**Citace regulace (bod 11.7 b) v.):** „Klient využívá služby neobvyklým způsobem, například odesílá peníze sobě samému nebo přijímá peníze poslané jím samotným nebo odesílá peníze okamžitě po jejich obdržení.“

**Pravidlo:** Alert vznikne, pokud po příchozí transakci s částkou alespoň `P05_MIN_AMOUNT` klient do `P05_WINDOW` provede odchozí transakci s částkou v rozmezí `P05_RATIO_LOW`–`P05_RATIO_HIGH` přijaté částky na účet, který není účtem plátce příchozí transakce.

**Datová pole:** `client_id`, `ts`, `amount`, `tx_type`, `payer_account`, `payee_account`

**Parametry:**

| Parametr | Hodnota | Zdroj |
| --- | --- | --- |
| `P05_MIN_AMOUNT` | 1 000 EUR (25 000 CZK) | kalibrace |
| `P05_WINDOW` | 2 hodiny | kalibrace („okamžitě“) |
| `P05_RATIO_LOW` / `P05_RATIO_HIGH` | 0,9 / 1,1 | kalibrace |

**Alert:** 1 alert na klienta a měsíc. Obsahuje všechny dvojice příchozí–odchozí transakce.

**Priorita (základ):** 50

**Validace:** 34 klientů (37 dvojic). Při okně 1 hodina 18 klientů. Rozdíl oproti R-04 v SVZ-03: R-11 páruje jednotlivou platbu s jednotlivou platbou podobné výše, R-04 sčítá toky v oknech 24 h / 6 h.

### Čl. 10 R-12 Kruhové platby se stejnou protistranou

**Účel:** Odhalit klienta, který posílá peníze na účet a z téhož účtu je v krátké době dostává zpět (kruhový tok, posílání peněz „sobě samému“).

**Citace regulace (bod 11.7 b) v.):** „Klient využívá služby neobvyklým způsobem, například odesílá peníze sobě samému nebo přijímá peníze poslané jím samotným nebo odesílá peníze okamžitě po jejich obdržení.“

**Pravidlo:** Alert vznikne, pokud klient provede odchozí transakci na účet X a do `P06_WINDOW` (před ní nebo po ní) přijme příchozí transakci z téhož účtu X, přičemž obě transakce mají částku alespoň `P06_MIN_AMOUNT`.

**Datová pole:** `client_id`, `ts`, `amount`, `tx_type`, `payer_account`, `payee_account`

**Parametry:**

| Parametr | Hodnota | Zdroj |
| --- | --- | --- |
| `P06_WINDOW` | 72 hodin | kalibrace |
| `P06_MIN_AMOUNT` | 1 000 EUR (25 000 CZK) | kalibrace |

**Alert:** 1 alert na klienta a měsíc.

**Priorita (základ):** 40

**Validace:** 33 klientů. Bez podmínky `P06_MIN_AMOUNT` by alert mělo 2 475 klientů, proto je limit nutný.

### Čl. 11 R-13 Neobvyklý nárůst počtu transakcí

**Účel:** Odhalit klienta, jehož počet transakcí výrazně vzrostl proti historii i proti tomu, co deklaroval.

**Citace regulace (bod 11.7 b) x.):** „Zvýšení objemu nebo počtu transakcí nesouvisí s obvyklým způsobem, jako je převod mzdy nebo kulturní oslavy.“

**Pravidlo:** Alert vznikne, pokud počet transakcí klienta za měsíc současně překročí:

1. `P07_FACTOR` × průměrný měsíční počet transakcí za Q2 (`q2_tx_count` / 3) **a**
2. `P07_FACTOR` × očekávaný měsíční počet transakcí (`projected_monthly_tx_count`).

Klient bez transakcí v Q2 se tímto pravidlem nevyhodnocuje (pokrývá ho R-01 v SVZ-03).

**Datová pole:** `client_id`, `transaction_id`, `ts`, `q2_tx_count`, `projected_monthly_tx_count`, `aml_risk_score`, `is_pep`

**Parametry:**

| Parametr | Hodnota | Zdroj |
| --- | --- | --- |
| `P07_FACTOR` | 5 (standardní riziko), 3 (vyšší riziko) | kalibrace; nižší limit u vyššího rizika podle bodu 11.14 |

**Alert:** 1 alert na klienta a měsíc. Uvádí oba poměry.

**Priorita (základ):** 25

**Validace:** 280 klientů (234 při jednotném faktoru 5). Volumový nárůst sleduje R-01 v SVZ-03; R-13 sleduje počet transakcí.

### Čl. 12 R-14 Vysoký souhrn remitencí mimo účet

**Účel:** Odhalit klienta, který za měsíc pošle remitencemi (bez platebního účtu, tedy bez snižujícího faktoru 11.6 a) vysokou celkovou částku.

**Citace regulace (bod 11.5 c):** „transakce je prováděna hotovostně nebo je financována s využitím anonymních elektronických peněz“

**Citace regulace (bod 11.6 a):** „finanční prostředky použité při převodu pocházejí z účtu vedeného na jméno plátce u úvěrové nebo finanční instituce v EHP.“

**Pravidlo:** Alert vznikne, pokud součet částek remitencí (`tx_type` = `remittance`) klienta za měsíc dosáhne alespoň `P08_MONTHLY_SUM`.

**Datová pole:** `client_id`, `ts`, `amount`, `tx_type`, `payer_account`, `aml_risk_score`, `is_pep`

**Parametry:**

| Parametr | Hodnota | Zdroj |
| --- | --- | --- |
| `P08_MONTHLY_SUM` | 15 000 EUR (375 000 CZK) standardní riziko; 7 500 EUR (187 500 CZK) vyšší riziko | kalibrace; 15 000 EUR odpovídá limitu kontroly klienta v § 9 odst. 1 písm. a) bodu 1 AML zákona; nižší limit podle bodu 11.14 |

**Alert:** 1 alert na klienta a měsíc.

**Priorita (základ):** 40

**Validace:** 41 klientů (17 z nich s vyšším rizikem). Všechny remitence v datech (39 715) nemají účet plátce. **[ROZHODNUTÍ]** Ověřit, zda remitence v datech skutečně nejsou hrazeny z účtu.

### Čl. 13 R-15 Remitence mimo EHP od nového klienta

**Účel:** Odhalit nového klienta, který brzy po uzavření smlouvy posílá vyšší remitence do zemí mimo EHP.

**Citace regulace (bod 11.5 b):** „produkt nebo služba má celosvětový dosah;“

**Citace regulace (bod 11.8 a):** „Klient je dlouholetým klientem podniku, jehož chování v minulosti nevyvolávalo podezření“

**Pravidlo:** Alert vznikne pro každou remitenci, pro kterou současně platí:

1. `payee_country` není členským státem EHP,
2. `amount` ≥ `P09_MIN_AMOUNT`,
3. vztah s klientem trvá ke dni transakce méně než `P09_MAX_TENURE` (od `contract_date`).

**Datová pole:** `transaction_id`, `client_id`, `ts`, `amount`, `tx_type`, `payee_country`, `contract_date`, `contract_channel`

**Parametry:**

| Parametr | Hodnota | Zdroj |
| --- | --- | --- |
| `P09_MIN_AMOUNT` | 1 000 EUR (25 000 CZK) | kalibrace |
| `P09_MAX_TENURE` | 6 měsíců | kalibrace (opak dlouholetého klienta podle bodu 11.8 a) |
| Seznam EHP | 27 států EU + Island, Lichtenštejnsko, Norsko | regulace (EHP) |

**Alert:** 1 alert na transakci.

**Priorita (základ):** 35; +5, pokud `contract_channel` = `distant` (bod 11.9 c).

**Validace:** 18 transakcí u 17 klientů. Remitencí mimo EHP je celkem 4 493, z toho 180 nad limitem.

### Čl. 14 R-16 Převod z/do vysoce rizikové třetí země

**Účel:** Odhalit převod, jehož plátce nebo příjemce se nachází ve vysoce rizikové třetí zemi.

**Citace regulace (bod 11.13 e):** „systému umožňující identifikovat, zda je převod uskutečňován do vysoce rizikové třetí země nebo obdržen z vysoce rizikové třetí země; a“

**Citace regulace (bod 11.11 d):** „Plátce nebo příjemce se nachází ve vysoce rizikové třetí zemi.“

**Pravidlo:** Alert vznikne pro každou transakci (bez ohledu na částku), kde `payer_country` nebo `payee_country` je na seznamu vysoce rizikových třetích zemí podle čl. 4.4 SVZ-03.

**Datová pole:** `transaction_id`, `client_id`, `payer_country`, `payee_country`

**Parametry:**

| Parametr | Hodnota | Zdroj |
| --- | --- | --- |
| Seznam zemí | nařízení (EU) 2016/1675 v platném znění + FATF (stav 19. 6. 2026) | regulace |
| Minimální částka | žádná | regulace (bod 11.13 e) limit nestanoví) |

**Alert:** 1 alert na transakci. Vždy se uplatní zesílená kontrola klienta (bod 11.15).

**Priorita (základ):** 70

**Validace:** 0. Žádná z 33 zemí v datech není na seznamu. Na rozdíl od R-02 (SVZ-03, limit 10 000 CZK) nemá pravidlo žádný limit částky.

### Čl. 15 R-17 Příchozí platba bez údajů o plátci

**Účel:** Odhalit příchozí převod, u kterého chybí údaje o plátci, které musí převod doprovázet.

**Citace regulace (bod 11.7 b) viii.):** „Příchozí transakce není doplněna o požadované informace o plátci nebo příjemci.“

**Pravidlo:** Alert vznikne pro každou příchozí transakci (`incoming`), u které chybí `payer_account` nebo `payer_country`.

**Datová pole:** `transaction_id`, `client_id`, `tx_type`, `payer_account`, `payer_country`

**Parametry:** žádné.

**Alert:** 1 alert na transakci. Postup při chybějících údajích (odmítnutí, pozastavení, vyžádání údajů) se řídí čl. 8 nařízení (EU) 2023/1113.

**Priorita (základ):** 30

**Validace:** 0. Všech 170 986 příchozích plateb má účet i zemi plátce.

## Část třetí – Priorita a zpracování

### Čl. 16 Výpočet priority

(1) Priorita alertu = základ pravidla (čl. 5–15) + modifikátory, nejvýš 100.

| Modifikátor | Body | Zdroj |
| --- | --- | --- |
| `aml_risk_score` = `high` / `medium` | +20 / +10 | bod 11.14 |
| `is_pep` = `Y` | +15 | § 9 odst. 3 písm. c) vyhlášky |
| `contract_channel` = `distant` | +5 | bod 11.9 c) |
| vztah kratší než 12 měsíců | +5 | bod 11.8 a) (opačně) |
| vztah delší než 5 let bez předchozího alertu | −10 | bod 11.8 a) |
| každé další pravidlo u téhož klienta v měsíci | +10 | čl. 6.3 SVZ-03 |

Citace regulace (bod 11.9 c): „Služba je poskytována zcela on-line bez adekvátních bezpečnostních opatření.“

(2) **[ROZHODNUTÍ]** Váhy sladit s tabulkou P v SVZ-03 a s hodnocením rizik SVZ-02.

### Čl. 17 Zpracování alertů

Triáž, eskalace, čtyři oči, střet zájmů, lhůty, záznam, whitelist a oznámení podezřelého obchodu se řídí čl. 3, 8 a 10 SVZ-03. Pravidla R-09 a R-16 vyžadují individuální posouzení člověkem; alert z nich nelze uzavřít hromadně.

### Čl. 18 Kalibrace

Parametry označené „kalibrace“ přezkoumá AML compliance officer čtvrtletně podle čl. 11 SVZ-03. Parametry označené „regulace“ lze změnit jen při změně regulace.

---

## Příloha: Validace na datech PoC

Stav k 2026-10-19. Data: `datasets/transactions.csv` (397 853 transakcí, 1.–31. 7. 2026) a `datasets/clients.csv` (5 493 klientů). Výpočet proběhl lokálně v hackathonovém prostředí.

### Zjištění o datech

| ID | Zjištění | Dopad |
| --- | --- | --- |
| D1 | Medián částky je téměř stejný ve všech 23 měnách. Pole `volume` se chová jako částka již v CZK. | Validace bere `volume` jako CZK, limit L = 25 000 CZK. **[ROZHODNUTÍ]** potvrdit s FINREG. |
| D2 | Účty protistran tvoří sdílený pool (5 138 účtů příjemců odchozích plateb, 4 699 účtů plátců příchozích plateb). Na jeden účet příjemce posílá za měsíc mediánově 7 klientů, na 1 % účtů přes 750. | R-09 musí pracovat s denním oknem a vysokým prahem. |
| D3 | Remitence nemají účet plátce, země plátce = země klienta. | Remitence = odchozí převod mimo platební účet (čl. 3 odst. 1, R-14). |
| D4 | Žádná země v datech není vysoce riziková třetí země. | R-16 dává 0 alertů. |
| D5 | Všechny příchozí platby mají účet a zemi plátce. | R-17 dává 0 alertů; slouží jako kontrola úplnosti dat podle nařízení (EU) 2023/1113. |

### Zvažovaná a nezařazená pravidla

| Pravidlo | Bod EBA GL | Důvod nezařazení |
| --- | --- | --- |
| Měna, kterou nepoužívá země klienta ani příjemce (mimo EUR a USD) | 11.7 b) iii. | 0 zásahů v datech |
| Řada malých plateb stejnému příjemci s oknem 30 dní | 11.13 a) | 49 klientů, ale okno 7 dní lépe odpovídá „určitému trvání“; ponecháno jako varianta kalibrace |

### Pokrytí bodu 11.13 (systémy, které musí podnik zavést)

| Bod | Systém | Pravidlo |
| --- | --- | --- |
| 11.13 a) | propojené transakce pod 1 000 EUR | R-07, R-08 |
| 11.13 b) | transakce různých klientů stejnému příjemci | R-09 |
| 11.13 c) | zdroj a místo určení prostředků | R-10, R-14, R-15 (země a forma financování) |
| 11.13 d) | vysledování platebního řetězce | mimo rozsah dat (dataset neobsahuje zprostředkovatele) |
| 11.13 e) | převody z/do vysoce rizikové třetí země | R-16 |
| 11.13 f) | jen oprávněné subjekty v řetězci | mimo rozsah dat |
