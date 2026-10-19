# SVZ-03 Směrnice o monitoringu transakcí a identifikaci podezřelých obchodů

| | |
| --- | --- |
| **Vychází z regulace** | **Vyhláška ČNB č. 67/2018 Sb., o některých požadavcích na systém vnitřních zásad, postupů a kontrolních opatření proti legalizaci výnosů z trestné činnosti a financování terorismu, zejména § 7, § 9 odst. 2–6, § 17, § 17a a § 18**. Plné znění: [`../regulace/plne-zneni/vyhlaska-cnb-67-2018.md`](../regulace/plne-zneni/vyhlaska-cnb-67-2018.md) |
| **Navazující předpisy** | Zákon č. 253/2008 Sb. ([`zakon-253-2008-aml.md`](../regulace/plne-zneni/zakon-253-2008-aml.md)): § 6, § 9, § 16, § 18, § 20, § 21, § 38. Dohledový benchmark ČNB č. 2/2023 ([`cnb-benchmark-2023-02-monitoring-transakci.md`](../regulace/plne-zneni/cnb-benchmark-2023-02-monitoring-transakci.md)). Metodický pokyn FAÚ č. 4 ([`fau-mp-04-oznameni-podezreleho-obchodu.md`](../regulace/plne-zneni/fau-mp-04-oznameni-podezreleho-obchodu.md)). |
| **Instituce** | [Instituce], platební instituce, povinná osoba podle § 2 odst. 1 písm. b) bodu 5 AML zákona (vzorový subjekt pro PoC) |
| **Druh předpisu** | Metodický předpis, součást systému vnitřních zásad (SVZ) podle § 21 AML zákona |
| **Verze / stav** | 0.1 / **DRAFT pro PoC** |
| **Vlastník** | Kontrolor dodržování předpisů v oblasti AML (dále „AML compliance officer“) |
| **Schvaluje** | Statutární orgán (§ 21 odst. 2 AML zákona) |
| **Účinnost** | [doplnit] |
| **Navazuje na** | SVZ-01 Rámcový systém vnitřních zásad, SVZ-02 Hodnocení rizik (§ 21a AML zákona), SVZ-04 Oznamování podezřelých obchodů |

> **Upozornění:** Vzorový předpis pro hackathonový PoC. Není právním stanoviskem ani schváleným SVZ. Hodnoty parametrů, eskalační matice a role jsou návrh. Před použitím je musí posoudit AML compliance officer a právník. Místa, která vyžadují rozhodnutí, jsou označena **[ROZHODNUTÍ]**.

---

## 1. Účel a působnost

1.1 Směrnice stanoví, jak Instituce průběžně sleduje obchodní vztahy a přezkoumává transakce klientů (§ 9 odst. 2 písm. d) AML zákona), podle jakých kritérií určuje neobvyklé obchody (§ 9 odst. 5 vyhlášky), jak alerty zpracovává a jak rozhoduje o podezřelém obchodu.

1.2 Směrnice se vztahuje na všechny klienty v obchodním vztahu a na všechny jejich transakce: příchozí platby, odchozí platby a remitence, bez ohledu na měnu a zemi. Výjimky jsou možné jen podle čl. 10 (whitelist).

1.3 Směrnice je závazná pro AML compliance officera, AML analytiky, kontaktní osobu, pověřeného člena statutárního orgánu a útvar IT, který provozuje monitorovací systém.

### 1.4 Právní základ

Hlavní předpis: **vyhláška ČNB č. 67/2018 Sb.** (dále „vyhláška“), ve spojení se zákonem č. 253/2008 Sb. (dále „AML zákon“). Při výkladu směrnice se dále vychází z dohledového benchmarku ČNB č. 2/2023 a Metodického pokynu FAÚ č. 4.

| Ustanovení | Požadavek | Kde ve směrnici |
| --- | --- | --- |
| § 9 odst. 2 písm. d) AML zákona | Průběžné sledování vztahu a přezkoumávání obchodů vůči profilu klienta | čl. 6 |
| § 6 AML zákona | Znaky podezřelého obchodu | čl. 6, čl. 7 |
| § 21 odst. 5 písm. a) AML zákona | Demonstrativní výčet znaků podezřelých obchodů | čl. 7 |
| § 21 odst. 5 písm. f) AML zákona | Postup od zjištění podezřelého obchodu do oznámení, kdo obchod vyhodnocuje | čl. 8 |
| § 7 a § 9 odst. 2 písm. a) vyhlášky | Rizikový profil klienta, zesílené monitorování u vyššího rizika | čl. 5 |
| § 9 odst. 3 a 4 vyhlášky | Povinné faktory zvýšeného rizika (riziková země, PEP, neobvyklý obchod, identifikace na dálku) | čl. 5, čl. 6 |
| **§ 9 odst. 5 vyhlášky** | **Kritéria neobvyklých obchodů a postupy k jejich identifikaci** | **čl. 6, Příloha 1** |
| § 17 odst. 2 vyhlášky | Automatizované vyhledávání informací | čl. 4, čl. 6 |
| § 17a vyhlášky | Přiměřená lhůta pro šetření | čl. 8.5 |
| § 18 vyhlášky, § 16 AML zákona | Zpětná rekonstruovatelnost, uchování 10 let | čl. 8.7, čl. 12 |
| § 18 a § 20 AML zákona | Oznámení FAÚ bez zbytečného odkladu, odklad splnění příkazu | čl. 8.8 |
| § 38 AML zákona | Mlčenlivost (zákaz tipping-off) | čl. 8.9 |
| Benchmark ČNB 2/2023, kap. I–IV | Data, scénáře, thresholdy, lhůty, whitelist, uzavření alertu, AI | čl. 4, 8, 10, 11 |

## 2. Pojmy

| Pojem | Význam |
| --- | --- |
| **Transakce** | Každý záznam v transakčním logu (obchod podle § 4 odst. 1 AML zákona), včetně převodů mezi klienty Instituce. |
| **Částka v CZK** | Částka transakce přepočtená na CZK kurzem ČNB vyhlášeným pro den transakce. |
| **Směr transakce** | `incoming payment` = příchozí; `outgoing payment` = odchozí; `remittance` = **nejasný směr**. Transakce s nejasným směrem se pro scénáře sledující odchozí toky posuzuje jako odchozí. |
| **Objem klienta** | Součet částek v CZK všech transakcí klienta bez ohledu na směr (příchozí + odchozí + remitence). |
| **Denní objem** | Objem klienta za jeden kalendářní den (00:00:00–23:59:59 místního času). |
| **Očekávaný měsíční objem** | Objem deklarovaný klientem při uzavření smlouvy (pole *expected volume of transactions at the time of contract conclusion*). Jde o měsíční hodnotu (ověřeno na datech, viz Příloha 2). |
| **Průměrný denní objem Q2** | Skutečný objem klienta za 2. čtvrtletí 2026 dělený 91 kalendářními dny. |
| **Klient neaktivní v Q2** | Klient s nulovým počtem transakcí ve 2. čtvrtletí 2026. |
| **Vysoce riziková jurisdikce (HRJ)** | Země uvedená na seznamu podle čl. 4.4. |
| **PEP** | Politicky exponovaná osoba podle § 4 odst. 5 AML zákona (pole *PEP* = `Y`). |
| **Identifikace na dálku** | Uzavření smlouvy bez fyzické přítomnosti klienta (pole *contract concluded* = `distant form`), § 11 odst. 7 AML zákona. |
| **Scénář** | Pravidlo detekce s pevnou logikou a parametry podle Přílohy 1. |
| **Alert** | Výstup scénáře, který je třeba prošetřit. Každý alert je potenciálně podezřelý obchod. |
| **Triáž** | Prvotní rozhodnutí o alertu: `FP` (falešně pozitivní) nebo `REVIEW` (vyžaduje lidské šetření). |

## 3. Role a odpovědnosti

| Role | Odpovědnost |
| --- | --- |
| **Statutární orgán** | Schvaluje směrnici a její změny včetně Přílohy 1. |
| **Pověřený člen statutárního orgánu** (§ 22a AML zákona) | Dohlíží na plnění směrnice. Schvaluje alerty u PEP s výsledkem „pokračovat ve vztahu“ (§ 9 odst. 2 písm. c) vyhlášky). |
| **AML compliance officer** (§ 16 odst. 2 vyhlášky) | Vlastní směrnici, scénáře a parametry. Rozhoduje alerty s prioritou ≥ 70. Rozhoduje o podezřelém obchodu. Provádí kontrolu kvality uzavřených alertů. |
| **Kontaktní osoba** (§ 22 AML zákona) | Podává oznámení podezřelého obchodu (OPO) FAÚ. Komunikuje s FAÚ. |
| **AML analytik senior** | Šetří alerty s prioritou 40–69. Je druhým párem očí u alertů analytiků. |
| **AML analytik** | Šetří alerty s prioritou < 40. Připravuje podklady k vyšším alertům. |
| **IT / provozovatel systému** | Zajišťuje běh scénářů, kvalitu a úplnost dat, logování a uchování záznamů. |

### 3.1 Střet zájmů a čtyři oči

1. Nikdo nerozhoduje alert klienta, kterého sám získal, uzavřel s ním smlouvu, spravuje ho nebo je s ním osobně či majetkově spojen.
2. Nikdo nepřezkoumává své vlastní rozhodnutí. Schvalovatel (druhý pár očí) je vždy jiná osoba než řešitel.
3. Alert s výsledkem `REVIEW` uzavírá řešitel a schvaluje osoba alespoň o úroveň výš (§ 9 odst. 2 písm. c) vyhlášky).
4. Pokud podmínky 1–3 nelze dodržet, alert přechází na nejbližší vyšší úroveň podle eskalační matice (čl. 8.4).

## 4. Data a jejich kvalita

### 4.1 Vstupní data

| Zdroj | Pole použitá ve scénářích |
| --- | --- |
| **Transakční log** | ID transakce, ID klienta, datum, čas, částka, měna, země plátce, země příjemce, účet plátce, účet příjemce, typ transakce |
| **Klientský registr** | ID klienta, země klienta, datum a forma uzavření smlouvy, PEP, typ klienta, očekávaný objem a počet transakcí, skutečný objem, počet a maximální transakce v Q2 2026, AML risk score |
| **Parametrické seznamy** | Seznam HRJ (čl. 4.4), kurzy ČNB, whitelist (čl. 10) |

### 4.2 Kontroly kvality dat před každým během scénářů

Benchmark ČNB 2/2023 vyžaduje ověřovat datovou větu, ze které se počítají alerty (kap. I.ii a II.i). Před během proto systém ověří:

| ID | Kontrola | Při selhání |
| --- | --- | --- |
| DQ-1 | Každá transakce má ID klienta, který existuje v klientském registru. | Běh se zastaví a IT problém řeší. |
| DQ-2 | Povinná pole (datum, čas, částka, měna, typ) jsou vyplněná a ve správném formátu. | Záznam jde do fronty chyb; AML compliance officer je informován. |
| DQ-3 | Kód měny má kurz ČNB pro den transakce. | Běh se zastaví. |
| DQ-4 | Rozložení částek podle měny je věrohodné (medián částky v cizí měně po přepočtu neleží mimo pásmo 0,2–5× mediánu transakcí v CZK). | Varování AML compliance officerovi; scénáře se spustí, výsledek se označí „datová výhrada“. |
| DQ-5 | Účet plátce chybí jen u typu `remittance`. | Varování; transakce se posuzuje jako transakce s nejasným směrem. |
| DQ-6 | Klientský registr má vyplněný rizikový profil, PEP a očekávaný objem u všech klientů. | Klient bez údajů dostane pro účely prioritizace nejvyšší riziko. |

Výsledek kontrol se zaznamená ke každému běhu (čl. 12).

### 4.3 Frekvence běhu

Scénáře běží denně (D+1) nad transakcemi předchozího dne. R-05 pracuje s objemem za celý měsíc, proto se vyhodnocuje průběžně a naposledy k poslednímu dni měsíce. Dávkové generování alertů po týdnech nebo měsících je zakázáno (benchmark 2/2023, kap. III.i).

### 4.4 Seznam vysoce rizikových jurisdikcí

Seznam HRJ je sjednocení:

1. třetích zemí uvedených v příloze nařízení Komise (EU) 2016/1675 v platném znění (ověřený stav: změny nařízeními (EU) 2026/46 a 2026/83),
2. jurisdikcí podléhajících výzvě k akci FATF („black list“),
3. jurisdikcí pod zvýšeným monitoringem FATF („grey list“), zařazených z jiného důvodu podle § 9 odst. 3 písm. a) vyhlášky na základě hodnocení rizik SVZ-02.

Verze použitá v PoC: FATF k 19. 6. 2026, EU ke dni 29. 1. 2026. AML compliance officer seznam aktualizuje do 5 pracovních dnů po každém plenárním zasedání FATF nebo novele nařízení 2016/1675. Každá verze se uchová s datem platnosti. **[ROZHODNUTÍ]** zařazení grey listu FATF potvrdit v SVZ-02.

## 5. Rizikový profil klienta a zesílené monitorování

5.1 Rizikový profil klienta (AML risk score `low` / `medium` / `high`) stanovuje SVZ-02 podle § 7 vyhlášky. Tato směrnice ho používá jako vstup pro prioritizaci.

5.2 Klient má vždy rizikový profil s vyšším rizikem, pokud je PEP nebo pokud je jeho zemí HRJ (§ 9 odst. 3 písm. a) a c) vyhlášky).

5.3 U klientů s vyšším rizikem se uplatní zesílené monitorování (§ 9 odst. 2 písm. a) vyhlášky): jejich alerty mají vyšší prioritu (Příloha 1, tabulka P), kratší lhůty šetření (čl. 8.5) a rozhoduje je vyšší úroveň (čl. 8.4).

5.4 Zjištění z alertu, která mění obraz o klientovi, analytik předá k aktualizaci rizikového profilu (§ 7 odst. 3 vyhlášky).

## 6. Kritéria neobvyklých obchodů a detekční scénáře

6.1 Instituce identifikuje neobvyklé obchody podle § 9 odst. 4 písm. c) a odst. 5 vyhlášky těmito scénáři. Přesná logika a parametry jsou v Příloze 1, která je nedílnou součástí směrnice.

| ID | Scénář | Typologie | Právní základ | Granularita alertu |
| --- | --- | --- | --- | --- |
| **R-01** | Nesoulad s profilem klienta | Obrat neodpovídá deklarovanému nebo historickému profilu | § 6 odst. 1 písm. b), e) AMLZ; § 9 odst. 4 písm. c) vyhl. | 1 alert / klient / měsíc |
| **R-02** | Vysoce riziková jurisdikce | Tok z/do HRJ nebo klient z HRJ | § 6 odst. 1 písm. h) AMLZ; § 9 odst. 3 písm. a), odst. 4 písm. a) vyhl. | 1 alert / transakce |
| **R-03** | Odchozí platba PEP | Vyšší odchozí tok politicky exponované osoby | § 9 odst. 3 písm. c) vyhl.; § 9a AMLZ | 1 alert / transakce |
| **R-04** | Průtokový účet | Rychlý průtok prostředků, typicky „money mule“ | § 6 odst. 1 písm. a), d), f) AMLZ | 1 alert / klient / měsíc |
| **R-05** | Nový klient identifikovaný na dálku s nadměrným obratem | Účet založený na dálku a brzy využitý nad deklarovaný rámec | § 9 odst. 4 písm. e) vyhl.; § 6 odst. 1 písm. e) AMLZ | 1 alert / klient / měsíc |
| **R-06** | Neobvyklý počet plátců | Sběrný účet, mnoho plátců za den | § 6 odst. 1 písm. b), f) AMLZ | 1 alert / klient / měsíc |

6.2 Každý alert obsahuje: ID alertu, ID scénáře, ID klienta, ID spouštějících transakcí, které podmínky se splnily a jaké hodnoty k tomu vedly, verzi parametrů a verzi seznamu HRJ.

6.3 Pokud u klienta ve stejném měsíci vznikne alert z více scénářů, systém je propojí a analytik je šetří společně („celý příběh klienta“).

6.4 Nastavení scénářů se nesmí odchýlit od Přílohy 1 bez schválené změny podle čl. 11.

## 7. Demonstrativní výčet znaků podezřelých obchodů

Výčet podle § 21 odst. 5 písm. a) AML zákona, přizpůsobený činnosti platební instituce. Znaky ve sloupci „Detekce“ označené scénářem se hledají automaticky. Ostatní znaky zaměstnanci posuzují při šetření alertu a při kontaktu s klientem.

| # | Znak | Zdroj | Detekce |
| --- | --- | --- | --- |
| Z1 | Klient během dne nebo několika dnů provede nápadně více operací nebo objemu, než je pro něj obvyklé. | § 6 odst. 1 písm. b) AMLZ | R-01 (b) |
| Z2 | Prostředky zjevně neodpovídají deklarovanému rozsahu činnosti nebo majetkovým poměrům klienta. | § 6 odst. 1 písm. e) AMLZ | R-01 (a), R-05 |
| Z3 | Neobvykle objemná jednotlivá transakce oproti dosavadní historii. | § 6 odst. 1 písm. d) AMLZ; § 9 odst. 4 písm. c) vyhl. | R-01 (c) |
| Z4 | Přijaté prostředky klient bezprostředně posílá dál na jiné účty. | § 6 odst. 1 písm. a) AMLZ (obdobně) | R-04 |
| Z5 | Účet je využíván v rozporu s deklarovaným účelem (např. sběrný účet mnoha plátců). | § 6 odst. 1 písm. f) AMLZ | R-06 |
| Z6 | Transakce souvisí se zemí, která nedostatečně uplatňuje opatření proti praní peněz. | § 6 odst. 1 písm. h) AMLZ | R-02 |
| Z7 | Významný odchozí tok PEP bez zřejmého vztahu k známému zdroji majetku. | § 9 odst. 2 písm. f) AMLZ | R-03 |
| Z8 | Krátce po založení na dálku je účet využit výrazně nad deklarovaný rámec. | § 9 odst. 4 písm. e) vyhl. | R-05 |
| Z9 | Převody bez zřejmého ekonomického důvodu, složité řetězce plateb. | § 6 odst. 1 písm. d) AMLZ | šetření |
| Z10 | Klient odmítá doložit účel nebo zdroj prostředků, nebo uvádí nepravdivé údaje. | § 6 odst. 1 písm. i), j) AMLZ | šetření |
| Z11 | Činnosti, které mohou zastřít totožnost klienta nebo skutečného majitele (platby za třetí osoby). | § 6 odst. 1 písm. g) AMLZ | šetření |
| Z12 | Účastníkem je osoba na sankčním seznamu. Obchod je podezřelý **vždy**. | § 6 odst. 2 AMLZ | sankční screening (SVZ-05) |

## 8. Zpracování alertu

### 8.1 Životní cyklus

Vygenerování → prioritizace → triáž → šetření → rozhodnutí → schválení → uzavření (případně OPO). Lhůty běží od vygenerování alertu, ne od jeho otevření (benchmark 2/2023, kap. III.i).

### 8.2 Prioritizace

Systém každému alertu přidělí prioritu 0–100 podle tabulky P v Příloze 1. Alerty se šetří v pořadí od nejvyšší priority.

### 8.3 Triáž a využití AI

1. Návrh triáže (`FP` / `REVIEW`), prioritu a zdůvodnění může připravit AI asistent. Vychází jen z údajů alertu, profilu klienta, historie klienta a této směrnice.
2. AI asistent nerozhoduje. Každý návrh potvrdí nebo změní člověk podle eskalační matice. Změnu odůvodní.
3. Každý návrh AI musí uvést konkrétní důvody (údaj, hodnota, ustanovení směrnice). Návrh bez důvodů se nepoužije (benchmark 2/2023, kap. IV).
4. Alert s prioritou ≥ 40 nelze uzavřít jako `FP` bez individuálního posouzení člověkem.
5. Alerty s prioritou < 40 a návrhem `FP` může analytik uzavřít hromadně, pokud u každého zůstane zdůvodnění. AML compliance officer měsíčně zkontroluje vzorek alespoň 10 % takto uzavřených alertů. **[ROZHODNUTÍ]** potvrdit přípustnost hromadného uzavírání.

### 8.4 Eskalační matice

**[ROZHODNUTÍ]** Nahradit eskalační maticí poskytnutou FINREG, až bude k dispozici.

| Situace | Řešitel (rozhoduje) | Schvalovatel (4 oči) |
| --- | --- | --- |
| Priorita < 40 | AML analytik | AML analytik senior |
| Priorita 40–69 | AML analytik senior | AML compliance officer |
| Priorita ≥ 70 | AML compliance officer | Pověřený člen statutárního orgánu |
| Jakýkoli alert klienta PEP | AML compliance officer | Pověřený člen statutárního orgánu |
| Rozhodnutí o podání OPO | AML compliance officer | – (OPO podává kontaktní osoba) |
| Střet zájmů řešitele | o úroveň výš | o úroveň výš |

### 8.5 Lhůty (§ 17a vyhlášky)

| Priorita | Zahájení šetření | Uzavření alertu |
| --- | --- | --- |
| ≥ 70 | týž pracovní den | do 2 pracovních dnů |
| 40–69 | do 2 pracovních dnů | do 5 pracovních dnů |
| < 40 | do 5 pracovních dnů | do 10 pracovních dnů |

Prodloužení je možné jen z objektivního důvodu (např. čekání na doklady od klienta). Důvod a vynaložené úsilí se zaznamenají. Celková doba šetření nepřesáhne 30 kalendářních dnů od vygenerování alertu.

### 8.6 Šetření

Řešitel vždy posoudí:

1. profil klienta: typ, země, rizikový profil, PEP, forma a datum uzavření smlouvy, deklarovaný objem;
2. historii klienta: Q2 2026 a předchozí alerty;
3. spouštějící transakce a jejich protistrany a země;
4. ostatní alerty klienta ve stejném období;
5. vysvětlení a doklady od klienta, pokud je třeba si je vyžádat (§ 9 odst. 7 AML zákona). Při tom nesmí klienta upozornit na šetření (čl. 8.9).

U alertů R-02 až R-05 řešitel vždy zkoumá pozadí a účel obchodu (§ 9 odst. 6 vyhlášky).

### 8.7 Uzavření a záznam (rekonstruovatelnost)

Každý uzavřený alert obsahuje:

| Pole | Obsah |
| --- | --- |
| `triage` | `FP` / `REVIEW` |
| `priority` | 0–100 a rozpad faktorů |
| `decision` | uzavřeno bez dalších opatření / zesílená kontrola / aktualizace rizikového profilu / odmítnutí obchodu nebo ukončení vztahu / OPO |
| `reason` | konkrétní zdůvodnění: proč byla podezřelost vyloučena nebo potvrzena. Text „OK“ nebo „bez nálezu“ bez vysvětlení nestačí. |
| `executive_role`, `executive_person` | kdo rozhodl |
| `approver` | kdo schválil |
| `ai_proposal` | návrh AI asistenta a zda se od něj člověk odchýlil |
| `log` | časové razítko každého kroku: vygenerování, otevření, rozhodnutí, schválení |

### 8.8 Podezřelý obchod

1. Pokud řešitel dojde k závěru, že jde o podezřelý obchod podle § 6 AML zákona, předá věc AML compliance officerovi bez zbytečného odkladu, nejpozději týž pracovní den.
2. AML compliance officer rozhodne a kontaktní osoba podá OPO FAÚ **bez zbytečného odkladu**. Interní cíl je 2 pracovní dny od závěru o podezřelosti. Podle MP FAÚ č. 4 musí být lhůta vždy kratší než 5 kalendářních dnů.
3. Hrozí-li nebezpečí z prodlení, podává se OPO **neprodleně** a Instituce zváží odklad splnění příkazu klienta o 24 hodin podle § 20 AML zákona.
4. Obsah OPO se řídí § 18 odst. 2 AML zákona a postupem SVZ-04.

### 8.9 Mlčenlivost

O alertu, šetření a OPO se nesmí informovat klient ani třetí osoby (§ 38 AML zákona). Dotazy na klienta se formulují jako běžná kontrola klienta.

## 9. Spolupráce s ostatními částmi SVZ

Výsledky šetření slouží jako vstup pro aktualizaci rizikového profilu klienta (SVZ-02), sankční screening (SVZ-05) a oznamování (SVZ-04).

## 10. Whitelist

1. Vyřadit klienta nebo jeho účet z jednoho konkrétního scénáře lze jen individuálně. Plošné vyřazení skupin klientů je zakázáno.
2. Whitelist navrhuje analytik s odůvodněním (proč scénář u klienta opakovaně generuje FP a proč riziko neroste). Schvaluje AML compliance officer.
3. Klient s vyšším rizikovým profilem, PEP nebo klient z HRJ nelze zařadit na whitelist pro scénáře R-02 až R-04.
4. Každé zařazení platí nejdéle 12 měsíců. AML compliance officer ho čtvrtletně přezkoumá.
5. Zařazení, přezkum a vyřazení se zaznamenávají (benchmark 2/2023, kap. III.ii).

## 11. Kalibrace a přezkum scénářů

1. AML compliance officer alespoň **čtvrtletně** vyhodnotí každý scénář: počet alertů, podíl FP, počet OPO, rozložení podle rizikového profilu.
2. Alespoň **jednou ročně** a vždy při změně produktu, klientského portfolia nebo hodnocení rizik provede testování nad prahem i pod prahem (above/below the line) a navrhne úpravu parametrů.
3. Parametry musí odpovídat skutečnému profilu klientů. Limit nesmí být nastaven tak, že ho reálné transakce segmentu nemohou dosáhnout (benchmark 2/2023, kap. II.i).
4. Změnu parametrů v Příloze 1 schvaluje statutární orgán na návrh AML compliance officera. Každá verze Přílohy 1 se uchová s datem platnosti a odůvodněním.
5. Při každém přezkumu se ověří, zda scénáře pokrývají všechny relevantní znaky z čl. 7 a rizika ze SVZ-02.

## 12. Záznamy a uchovávání

Alerty, podklady šetření, rozhodnutí, verze parametrů, verze seznamu HRJ, výsledky kontrol kvality dat a záznamy o whitelistu se uchovávají **10 let** od ukončení obchodního vztahu (§ 16 AML zákona). Záznamy umožní zjistit, kdo, kdy, na základě čeho a s jakým výsledkem jednal (§ 18 odst. 3 vyhlášky).

## 13. Závěrečná ustanovení

13.1 Směrnici AML compliance officer přezkoumá nejméně jednou ročně a vždy při změně AML zákona, vyhlášky nebo hodnocení rizik.

13.2 Změnu SVZ oznámí Instituce FAÚ do 30 dnů od přijetí (§ 21 odst. 8 AML zákona).

13.3 Od 10. 7. 2027 se použije nařízení (EU) 2024/1624 (AMLR). Směrnici je třeba do té doby přezkoumat podle AMLR. **[ROZHODNUTÍ]**

---

## Příloha 1: Parametry a logika scénářů (verze 0.1)

Společná pravidla:

- Všechny částky v CZK (čl. 2). Objem klienta = součet bez ohledu na směr.
- Sledované období = kalendářní měsíc (PoC: červenec 2026).
- Referenční profil: očekávaný měsíční objem ze smlouvy a skutečné údaje za Q2 2026 z klientského registru.

### R-01 Nesoulad s profilem klienta

Alert, pokud v období nastane **alespoň jedna** podmínka:

| Podmínka | Logika | Parametr |
| --- | --- | --- |
| (a) | denní objem klienta > `P_A1` × očekávaný měsíční objem | `P_A1` = 0,25 |
| (b) | denní objem klienta > `P_A2` × (skutečný objem Q2 / 91) | `P_A2` = 3 |
| (c) | jednotlivá transakce > `P_A3` × maximální transakce Q2 | `P_A3` = 2 |

U klienta neaktivního v Q2 se vyhodnocuje jen podmínka (a). Alert uvádí všechny splněné podmínky, dny a transakce.

### R-02 Vysoce riziková jurisdikce

Alert pro každou transakci s částkou > `P_B1`, kde země plátce, země příjemce **nebo** země klienta je na seznamu HRJ (čl. 4.4).

| Parametr | Hodnota |
| --- | --- |
| `P_B1` | 10 000 CZK |

### R-03 Odchozí platba PEP

Alert pro každou transakci klienta s PEP = `Y`, která je odchozí nebo má nejasný směr a částka > `P_B2`.

| Parametr | Hodnota |
| --- | --- |
| `P_B2` | 100 000 CZK |

### R-04 Průtokový účet

Pro každou příchozí transakci klienta v čase *t* (kotva):

1. `IN` = součet příchozích transakcí klienta v okně (*t* − `P_C1`, *t*].
2. Pokud `IN` > `P_C2`: `OUT` = součet odchozích transakcí a transakcí s nejasným směrem v okně (*t*, *t* + `P_C3`], jejichž účet příjemce **není** účtem žádného z plátců v okně `IN`.
3. Alert, pokud `OUT` ≥ `P_C4` × `IN`.

Jeden alert na klienta a měsíc. Uvádí všechna okna, která podmínku splnila.

| Parametr | Hodnota |
| --- | --- |
| `P_C1` | 24 h |
| `P_C2` | 100 000 CZK |
| `P_C3` | 6 h |
| `P_C4` | 0,8 |

### R-05 Nový klient identifikovaný na dálku s nadměrným obratem

Alert, pokud současně platí:

1. smlouva uzavřena na dálku (`distant form`),
2. ke dni začátku období trvá vztah méně než `P_D1`,
3. objem klienta za období > `P_D2` × očekávaný měsíční objem.

| Parametr | Hodnota |
| --- | --- |
| `P_D1` | 6 měsíců |
| `P_D2` | 3 |

### R-06 Neobvyklý počet plátců

Alert, pokud klient v jednom kalendářním dni přijme platby od alespoň `P_F1` různých účtů plátců.

| Parametr | Hodnota |
| --- | --- |
| `P_F1` | 7 (nad 99,9. percentilem pozorovaného rozložení, viz Příloha 2) |

### Tabulka P: prioritizace (0–100)

Priorita = základ scénáře + součet modifikátorů, nejvýš 100. Při více alertech u klienta se počítá nejvyšší základ.

| Položka | Body |
| --- | --- |
| Základ R-02, R-03 | 60 |
| Základ R-04 | 55 |
| Základ R-05, R-06 | 35 |
| Základ R-01 | 15 |
| AML risk score `high` / `medium` | +20 / +10 |
| PEP | +15 |
| Klient nebo protistrana z HRJ | +15 |
| Identifikace na dálku | +5 |
| Vztah kratší než 12 měsíců | +5 |
| Každý další scénář u stejného klienta v období | +10 |
| R-01: splněny všechny tři podmínky (a), (b), (c) | +10 |
| Objem klienta za období > 5 × očekávaný měsíční objem | +10 |

**[ROZHODNUTÍ]** Váhy jsou výchozí návrh. Je nutné je sladit s hodnocením rizik SVZ-02.

---

## Příloha 2: Validace na datech PoC

Stav k 2026-10-19. Data: `datasets/transactions.csv` (397 853 transakcí, 1.–31. 7. 2026) a `datasets/clients.csv` (5 493 klientů). Výpočet nad daty proběhl lokálně v hackathonovém prostředí.

### Zjištění o datech

| Zjištění | Dopad na směrnici |
| --- | --- |
| Skutečný objem Q2 je mediánově 3,36× očekávaný objem ze smlouvy (≈ 3 měsíce). | Očekávaný objem je **měsíční** (čl. 2). |
| Medián částky je téměř stejný ve všech 23 měnách (2 616–3 868), i u HUF, JPY a KRW. Po přepočtu kurzem by měl každý klient (5 493/5 493) transakci nad 2× maxima Q2. | Pole *volume* se chová jako částka **již v CZK**. Validace proto počítá s *volume* jako s CZK. Zachytí to kontrola DQ-4. **[ROZHODNUTÍ]** potvrdit s FINREG. |
| `remittance` (39 715 transakcí) nemá účet plátce, země plátce = země klienta, příjemce je vždy jiný účet. | Remitence = nejasný směr, pro odchozí scénáře jako odchozí (čl. 2). |
| Žádná země v datech (33 zemí) není na seznamu FATF k 19. 6. 2026 ani na seznamu EU. | R-02 v PoC datech nedává žádný alert. Scénář zůstává, protože ho vyžaduje § 9 odst. 3 a 4 vyhlášky. |
| 23 klientů PEP, 1 500 klientů s identifikací na dálku, 392 klientů s rizikem `high`. | Vstupy pro R-03, R-05 a prioritizaci jsou k dispozici. |

### Počty alertů (parametry verze 0.1)

| Scénář | Alertů | Poznámka |
| --- | --- | --- |
| R-01 | 4 669 klientů (85 %) | (a) 3 040, (b) 4 620, (c) 1 008 (jediný klient neaktivní v Q2, K005492, je zachycen podmínkou (a)). Odpovídá pravidlu A od FINREG („nejvíc alertů, nejvyšší podíl FP“). Hlavní úlohou je triáž. |
| R-02 | 0 | Žádná země z HRJ v datech. |
| R-03 | 4 transakce / 3 klienti | |
| R-04 | 16 klientů | Interpretace oken podle Přílohy 1. |
| R-05 | 36 klientů | Ze 103 klientů na dálku se vztahem < 6 měsíců. |
| R-06 | 16 klientů | 99. percentil = 4 plátci/den, 99,9. percentil = 5, maximum = 8. |

### Citlivost R-01 (pro kalibraci podle čl. 11)

| Varianta | Klientů |
| --- | --- |
| (a) denní objem > 0,5× / 1× očekávaného měsíčního | 1 549 / 487 |
| (b) denní objem > 5× / 10× průměru Q2 | 3 694 / 2 230 |
| (c) transakce > 3× / 5× maxima Q2 | 283 / 42 |

### Zvažované a nezařazené scénáře

| Scénář | Důvod nezařazení |
| --- | --- |
| Strukturování těsně pod limitem (≥ 2 transakce 90–100 tis. CZK do 24 h) | 0 zásahů v datech |
| Kulaté částky (násobky 1 000 CZK) | 1 transakce, bez vypovídací hodnoty |

Scénáře R-01 až R-04 parametricky odpovídají pravidlům A–C ze zadání FINREG. R-05 a R-06 jsou další red flags.
