# AML zákon jako baseline pro monitoring transakcí

- **Datum rešerše:** 2026-10-19
- **Účel:** určit, co z českého AML práva přímo plyne pro návrh a správu pravidel monitoringu transakcí. Není to obecný výklad AML.
- **Status:** rešerše pro návrh systému, ne právní stanovisko. Viz [sekci 15](#15-compliance-poznámka).

## Zdroje a znění

| Zkratka | Předpis / dokument | Znění, ke kterému text platí | Odkaz |
| --- | --- | --- | --- |
| `AMLZ` | Zákon č. 253/2008 Sb., o některých opatřeních proti legalizaci výnosů z trestné činnosti a financování terorismu | Aktuální znění od **11. 1. 2026** (verze 32, poslední novela 280/2025 Sb.). Ověřeno v e-Sbírce i na zakonyprolidi.cz k 2026-10-19. | [e-Sbírka](https://e-sbirka.gov.cz/sb/2008/253), [zakonyprolidi.cz](https://www.zakonyprolidi.cz/cs/2008-253) |
| `VYHL` | Vyhláška ČNB č. 67/2018 Sb., o některých požadavcích na systém vnitřních zásad… | Aktuální znění od **30. 12. 2024** (ve znění 235/2021 Sb., 108/2024 Sb., 403/2024 Sb.). Ověřeno v e-Sbírce. | [e-Sbírka](https://e-sbirka.gov.cz/sb/2018/67), [zakonyprolidi.cz](https://www.zakonyprolidi.cz/cs/2018-67) |
| `BM` | ČNB, Dohledový benchmark č. 2/2023 – K provádění kontroly klienta prostřednictvím systému k monitoringu transakcí | Datum vydání 3. 7. 2023 | [PDF](https://www.cnb.cz/export/sites/cnb/cs/dohled-financni-trh/.galleries/vykon_dohledu/dohledove_benchmarky/download/dohledovy_benchmark_2023_02.pdf) |
| `MP4` | FAÚ, Metodický pokyn č. 4 – Oznámení podezřelého obchodu, č. j. FAU-121182/2025/03 | Účinnost od 29. 8. 2025 | [PDF](https://fau.gov.cz/assets/cs/cmsmedia/Metodick%c3%a9%20pokyny/Metodika%20%c4%8d.%204_OPO1.pdf) |
| `MP7` | FAÚ, Metodický pokyn č. 7 – Opatření vůči PEP, č. j. FAU-57065/2024/03 | Právní stav k 17. 7. 2024 | [PDF](https://fau.gov.cz/assets/cs/cmsmedia/Metodick%c3%a9%20pokyny/mp-c-7-opatreni-vuci-pep-vnitrostatni-se.pdf) |
| `MP9` | FAÚ, Metodický pokyn č. 9 – Kontrola klienta, č. j. FAU-160768/2025/03 | Ze dne 25. 9. 2025, právní stav k 18. 9. 2025 | [PDF](https://fau.gov.cz/assets/cs/cmsmedia/Metodick%c3%a9%20pokyny/mp-c-9-kontrola-klienta.pdf) |
| `MP11` | FAÚ, Metodický pokyn č. 11 – Hodnocení rizik a systém vnitřních zásad, č. j. FAU-150849/2025/03 | Ze dne 3. 9. 2025, právní stav k 1. 7. 2025. Určen hlavně nefinančnímu sektoru. | [PDF](https://fau.gov.cz/assets/cs/cmsmedia/Metodick%c3%a9%20pokyny/mp-c-11-hodnoceni-rizik-a-system-vnitrni.pdf) |
| `ZPMS` | Zákon č. 69/2006 Sb., o provádění mezinárodních sankcí | Aktuální znění od 1. 1. 2026 | [zakonyprolidi.cz](https://www.zakonyprolidi.cz/cs/2006-69) |
| `ZOPH` | Zákon č. 254/2004 Sb., o omezení plateb v hotovosti | Aktuální znění od 1. 7. 2017 | [zakonyprolidi.cz](https://www.zakonyprolidi.cz/cs/2004-254) |
| `AMLR` | Nařízení (EU) 2024/1624 | Úř. věst. L, 2024/1624; použije se od 10. 7. 2027 | [EUR-Lex](https://eur-lex.europa.eu/eli/reg/2024/1624/oj/ces) |
| `HRTC` | Nařízení Komise v přenesené pravomoci (EU) 2016/1675 (seznam vysoce rizikových třetích zemí) | Poslední změny 2026/83 a 2026/46, obě vyhlášeny 9. 1. 2026 | [2016/1675](https://eur-lex.europa.eu/eli/reg_del/2016/1675/oj), [2026/83](https://eur-lex.europa.eu/eli/reg_del/2026/83/oj), [2026/46](https://eur-lex.europa.eu/eli/reg_del/2026/46/oj) |

Odkazy na paragrafy vedou na kotvy zakonyprolidi.cz (formát `#p6-1-b`). Závazné je znění v e-Sbírce.

### Novelizace AML zákona 2024–2026

| Novela | Účinnost (verze znění) | Co mění z pohledu monitoringu |
| --- | --- | --- |
| 1/2024 Sb. (digitální služby) | 20. 1. 2024 | Bez přímého dopadu na monitoring. |
| **107/2024 Sb.** | 1. 5. 2024; jedno ustanovení (§ 25 odst. 8) od 1. 1. 2025 | Zavádí pojem **„země původu“** (dnes [§ 4 odst. 15](https://www.zakonyprolidi.cz/cs/2008-253#p4-15)) místo „usazení“ v § 9 a § 9a. Přidává [§ 9b](https://www.zakonyprolidi.cz/cs/2008-253#p9b) (neprovedení kontroly kvůli riziku zmaření šetření) a povinné oznámení podle [§ 18 odst. 1 věty 4](https://www.zakonyprolidi.cz/cs/2008-253#p18-1) a [§ 18 odst. 7](https://www.zakonyprolidi.cz/cs/2008-253#p18-7). Mění § 21 odst. 8 (oznamování SVZ). |
| **280/2024 Sb.** | 30. 12. 2024 | Adaptace na TFR (EU) 2023/1113 a MiCA: kryptoaktiva, poskytovatelé služeb s kryptoaktivy. Pro platební transakce bez přímého dopadu. |
| 32/2025 Sb. (digitalizace finančního trhu) | 15. 2. 2025 | Bez přímého dopadu na monitoring (neověřeno do detailu). |
| 169/2025 Sb., 218/2025 Sb. | 1. 7. 2025 | Související změny (lobbing, správa daní). Bez přímého dopadu (neověřeno do detailu). |
| 265/2025 Sb. (kybernetická bezpečnost) | 1. 11. 2025 | Výjimka z mlčenlivosti pro NÚKIB v § 39 odst. 1. |
| 280/2025 Sb. (finanční trh) | 11. 1. 2026 | Výjimka z mlčenlivosti pro orgán obezřetnostního dohledu v § 39 odst. 1 písm. r). |

Vyhláška 67/2018 Sb. byla novelizována vyhláškou **108/2024 Sb.** (účinnost 1. 5. 2024): § 9 odst. 3 písm. a) a odst. 4 písm. a) nově výslovně zahrnují země z „black listu“ FATF (výzva k akci) a obchody, jejichž předmět s vysoce rizikovou zemí jinak souvisí ([MP9](https://fau.gov.cz/assets/cs/cmsmedia/Metodick%c3%a9%20pokyny/mp-c-9-kontrola-klienta.pdf), s. 15). Vyhláška **403/2024 Sb.** (30. 12. 2024) doplnila mj. odkaz na pokyny AMLA (§ 4 odst. 2).

Nový český předpis k adaptaci na AMLR jsem v primárních zdrojích nenašel. **Neověřeno.**

## 1. TL;DR – co musí ruleset minimálně umět

1. **Porovnat každou transakci s profilem klienta.** Zákon ukládá průběžně sledovat obchodní vztah a přezkoumávat všechny obchody vůči tomu, co instituce o klientovi ví ([§ 9 odst. 2 písm. d)](https://www.zakonyprolidi.cz/cs/2008-253#p9-2-d)). Platí i pro interní převody ([BM](https://www.cnb.cz/export/sites/cnb/cs/dohled-financni-trh/.galleries/vykon_dohledu/dohledove_benchmarky/download/dohledovy_benchmark_2023_02.pdf), kap. II.ii). → pravidla typu A.
2. **Pokrýt detekovatelné znaky z [§ 6 odst. 1](https://www.zakonyprolidi.cz/cs/2008-253#p6-1)**: nápadně více operací, neobvykle objemné obchody, nepoměr k majetku nebo podnikání, rychlé přeposílání prostředků, osoby z rizikových států. Výčet znaků musí být v systému vnitřních zásad ([§ 21 odst. 5 písm. a)](https://www.zakonyprolidi.cz/cs/2008-253#p21-5-a)).
3. **Vždy označit povinné spouštěče zesílené kontroly** bez ohledu na částku: PEP, klient se zemí původu ve vysoce rizikové třetí zemi, obchod související s vysoce rizikovou třetí zemí ([§ 9a odst. 2](https://www.zakonyprolidi.cz/cs/2008-253#p9a-2)). U obchodu s rizikovou zemí zákon vyžaduje opatření **před** jeho uskutečněním. → pravidla typu B.
4. **Vést verzovaný seznam vysoce rizikových zemí**: EU 2016/1675 (aktuálně ve znění 2026/83 a 2026/46) + „black list“ FATF ([VYHL § 9 odst. 3 písm. a)](https://www.zakonyprolidi.cz/cs/2018-67#p9-3-a)) + interní rozšíření.
5. **Zachytit strukturování.** Související plnění se pro účely zákona sčítají ([§ 54 odst. 4](https://www.zakonyprolidi.cz/cs/2008-253#p54-4)). Částky v EUR se přepočítávají kurzem ČNB pro daný den ([§ 54 odst. 3](https://www.zakonyprolidi.cz/cs/2008-253#p54-3)).
6. **Mít prahy zdůvodněné a segmentované.** Zákon pro monitoring nestanoví číselné prahy. Instituce je nastaví sama a musí je odůvodnit, ideálně interním analytickým dokumentem ([BM](https://www.cnb.cz/export/sites/cnb/cs/dohled-financni-trh/.galleries/vykon_dohledu/dohledove_benchmarky/download/dohledovy_benchmark_2023_02.pdf), kap. I.ii, pozn. 16). Kritéria „neobvyklého obchodu“ musí být v SVZ ([VYHL § 9 odst. 5](https://www.zakonyprolidi.cz/cs/2018-67#p9-5)).
7. **Řídit životní cyklus alertu s lhůtami.** Lhůta pro šetření se určuje vnitřním předpisem ([VYHL § 17a](https://www.zakonyprolidi.cz/cs/2018-67#p17a)) a běží od vygenerování alertu. Alert se uzavírá s odůvodněním. Oznámení FAÚ se podává bez zbytečného odkladu, podle FAÚ za méně než 5 kalendářních dnů ([MP4](https://fau.gov.cz/assets/cs/cmsmedia/Metodick%c3%a9%20pokyny/Metodika%20%c4%8d.%204_OPO1.pdf), s. 7).
8. **Řídit whitelist jako výjimku.** Jen individuální klienti nebo účty, s odůvodněním, schválením a pravidelnou revizí ([BM](https://www.cnb.cz/export/sites/cnb/cs/dohled-financni-trh/.galleries/vykon_dohledu/dohledove_benchmarky/download/dohledovy_benchmark_2023_02.pdf), kap. III.ii). Plošné vyřazení skupin klientů není přípustné.
9. **Zajistit zpětnou rekonstruovatelnost** každého rozhodnutí: kdo, kdy, co, na základě čeho a proč ([VYHL § 18](https://www.zakonyprolidi.cz/cs/2018-67#p18)). Záznamy se uchovávají 10 let ([§ 16](https://www.zakonyprolidi.cz/cs/2008-253#p16)). Přístup k alertům a oznámením musí respektovat mlčenlivost ([§ 38](https://www.zakonyprolidi.cz/cs/2008-253#p38)).
10. **Umožnit ruční přepsání automatického rizikového skóre** ([VYHL § 7 odst. 4](https://www.zakonyprolidi.cz/cs/2018-67#p7-4)). U AI musí být rozhodnutí vysvětlitelné a model kalibrovatelný a zdokumentovaný ([BM](https://www.cnb.cz/export/sites/cnb/cs/dohled-financni-trh/.galleries/vykon_dohledu/dohledove_benchmarky/download/dohledovy_benchmark_2023_02.pdf), kap. IV).

## 2. Podezřelý obchod (§ 6)

**Ustanovení:** [§ 6 odst. 1](https://www.zakonyprolidi.cz/cs/2008-253#p6-1) (definice a demonstrativní výčet písm. a)–j)), [§ 6 odst. 2](https://www.zakonyprolidi.cz/cs/2008-253#p6-2) (obligatorní podezřelý obchod).

**Parafráze:**

- Podezřelý obchod je obchod za okolností, které vyvolávají podezření na legalizaci výnosů nebo financování terorismu. Patří sem i „jiná skutečnost“, která by takovému podezření mohla nasvědčovat. NSS potvrdil široký výklad ([MP4](https://fau.gov.cz/assets/cs/cmsmedia/Metodick%c3%a9%20pokyny/Metodika%20%c4%8d.%204_OPO1.pdf), s. 5).
- Výčet v odst. 1 je demonstrativní (fakultativní znaky). Instituce musí ve svém SVZ uvést **podrobný** výčet znaků, které odpovídají její činnosti ([§ 21 odst. 5 písm. a)](https://www.zakonyprolidi.cz/cs/2008-253#p21-5-a); [MP11](https://fau.gov.cz/assets/cs/cmsmedia/Metodick%c3%a9%20pokyny/mp-c-11-hodnoceni-rizik-a-system-vnitrni.pdf), s. 14–15).
- Obchod je podezřelý **vždy**, pokud se týká osoby nebo zboží či služeb pod mezinárodními sankcemi (odst. 2).
- Obchodem je jakékoli nakládání s majetkem klienta, včetně převodu mezi účty téhož klienta ([§ 4 odst. 1](https://www.zakonyprolidi.cz/cs/2008-253#p4-1); [BM](https://www.cnb.cz/export/sites/cnb/cs/dohled-financni-trh/.galleries/vykon_dohledu/dohledove_benchmarky/download/dohledovy_benchmark_2023_02.pdf), kap. II.ii; [MP4](https://fau.gov.cz/assets/cs/cmsmedia/Metodick%c3%a9%20pokyny/Metodika%20%c4%8d.%204_OPO1.pdf), pozn. 5).
- FAÚ uvádí, že instituce má při vyhodnocení přihlížet zejména k charakteru obchodu a chování klienta, k obvyklým obchodům klienta a k rizikovému profilu ([MP4](https://fau.gov.cz/assets/cs/cmsmedia/Metodick%c3%a9%20pokyny/Metodika%20%c4%8d.%204_OPO1.pdf), s. 6).

| Písm. | Znak (parafráze) | Kandidát pravidla | Detekovatelné z našich dat |
| --- | --- | --- | --- |
| [a)](https://www.zakonyprolidi.cz/cs/2008-253#p6-1-a) | Výběry nebo převody bezprostředně po hotovostních vkladech | `R04` | Částečně: jen pokud typ transakce rozlišuje hotovost |
| [b)](https://www.zakonyprolidi.cz/cs/2008-253#p6-1-b) | Během dne nebo navazujících dnů nápadně více peněžních operací než obvykle | `R01` | Ano |
| [c)](https://www.zakonyprolidi.cz/cs/2008-253#p6-1-c) | Počet účtů klienta v nepoměru k podnikání nebo majetku | `R06` | Částečně |
| [d)](https://www.zakonyprolidi.cz/cs/2008-253#p6-1-d) | Převody bez ekonomického důvodu; složité nebo neobvykle objemné obchody | `R02`, `R05`, `R18` | Objem ano; ekonomický důvod ne |
| [e)](https://www.zakonyprolidi.cz/cs/2008-253#p6-1-e) | Prostředky neodpovídají podnikání nebo majetkovým poměrům | `R03` | Částečně: máme projektovaný objem, nemáme příjmy ani majetek |
| [f)](https://www.zakonyprolidi.cz/cs/2008-253#p6-1-f) | Účet využíván v rozporu s účelem | `R05`, `R19` | Částečně |
| [g)](https://www.zakonyprolidi.cz/cs/2008-253#p6-1-g) | Činnosti zastírající totožnost klienta nebo skutečného majitele | `R17` | Ne |
| [h)](https://www.zakonyprolidi.cz/cs/2008-253#p6-1-h) | Klient nebo skutečný majitel ze státu, který neuplatňuje AML opatření | `R07` | Částečně: máme zemi klienta, nemáme skutečného majitele |
| [i)](https://www.zakonyprolidi.cz/cs/2008-253#p6-1-i) | Pochybnosti o pravdivosti identifikačních údajů | `R17` | Ne |
| [j)](https://www.zakonyprolidi.cz/cs/2008-253#p6-1-j) | Klient odmítá kontrolu nebo údaje o osobě, za kterou jedná | `R17` | Ne |
| [odst. 2](https://www.zakonyprolidi.cz/cs/2008-253#p6-2) | Osoba, zboží nebo služba pod mezinárodními sankcemi | `R15` | Ne: data jsou anonymizovaná |

**Dopad na pravidla:**

- Ruleset **musí** pokrýt znaky b), d) a e). Ty jdou detekovat deterministicky z transakčního a klientského logu.
- Znaky g), i), j) jsou procesní (KYC). Ruleset nad transakcemi je nezachytí. Systém je **může** převzít jako vstupní flag klienta, pokud ho KYC proces dodá.
- Ruleset **musí** mít u každého pravidla odkaz na konkrétní písmeno § 6. Odpovídá to požadavku spec, aby pravidlo odkazovalo na ustanovení regulace.
- Výčet znaků v interním předpisu **musí** být konkrétnější než zákon (MP11). Ruleset slouží jako jeho technická podoba.

## 3. Definice relevantní pro pravidla

| Pojem | Ustanovení | Parafráze | Dopad na pravidla |
| --- | --- | --- | --- |
| Obchod | [§ 4 odst. 1](https://www.zakonyprolidi.cz/cs/2008-253#p4-1) | Každé jednání instituce s jinou osobou, které směřuje k nakládání s jejím majetkem nebo k poskytnutí služby. Směr (od klienta / ke klientovi) nerozhoduje. | Monitorovat příchozí i odchozí transakce a interní převody. Převody mezi účty téhož klienta lze vyřadit jen na základě RBA a s odůvodněním (BM, kap. II.ii). |
| Obchodní vztah | [§ 4 odst. 2](https://www.zakonyprolidi.cz/cs/2008-253#p4-2), [§ 54 odst. 7](https://www.zakonyprolidi.cz/cs/2008-253#p54-7) | Vztah, u kterého je při vzniku zřejmé, že bude trvající nebo opakovaný. Smlouva o účtu je obchodním vztahem vždy. | Naši klienti jsou v obchodním vztahu. Platí pro ně průběžné sledování (§ 9 odst. 1 písm. c), odst. 2 písm. d)). |
| Skutečný majitel | [§ 4 odst. 4](https://www.zakonyprolidi.cz/cs/2008-253#p4-4) | Skutečný majitel podle zákona o evidenci skutečných majitelů, **nebo** fyzická osoba, za kterou se obchod provádí („skutečný majitel transakce“, BM pozn. 26). | Data nemají skutečného majitele. Pravidla na zemi nebo PEP status skutečného majitele nejdou implementovat. |
| Politicky exponovaná osoba (PEP) | [§ 4 odst. 5](https://www.zakonyprolidi.cz/cs/2008-253#p4-5) | Fyzická osoba, která **je nebo byla** ve významné veřejné funkci celostátního nebo regionálního významu (v ČR, jiném státě, orgánu EU, mezinárodní organizaci). Patří sem i osoby blízké, společníci a skuteční majitelé stejné právnické osoby a osoby v blízkém podnikatelském vztahu. Vnitrostátní seznam funkcí PEP vede FAÚ v [MP7](https://fau.gov.cz/assets/cs/cmsmedia/Metodick%c3%a9%20pokyny/mp-c-7-opatreni-vuci-pep-vnitrostatni-se.pdf). | Pravidla musí brát PEP flag jako povinný spouštěč zesílené kontroly. Data mají jen ano/ne. Chybí datum ukončení funkce a typ vazby (přímý / odvozený PEP). |
| Trvání statusu PEP | [§ 54 odst. 8](https://www.zakonyprolidi.cz/cs/2008-253#p54-8) | Opatření vůči PEP platí ještě nejméně 12 měsíců po skončení funkce, a dokud instituce na základě hodnocení rizik nevyloučí riziko specifické pro PEP. Platí i pro klienta, jehož skutečným majitelem je PEP. | PEP flag v datech by měl mít datum platnosti. Ukončení statusu PEP je rozhodnutí s odůvodněním do audit logu. |
| Třetí země | [§ 4 odst. 14](https://www.zakonyprolidi.cz/cs/2008-253#p4-14) | Stát mimo EU a EHP. | Číselník zemí musí rozlišovat EU/EHP a třetí země. |
| Země původu | [§ 4 odst. 15](https://www.zakonyprolidi.cz/cs/2008-253#p4-15) | U fyzické osoby **každý** stát občanství, pobytu nebo bydliště delšího než 1 rok. U FOP navíc stát sídla. U právnické osoby stát sídla a každý stát pobočky nebo provozovny. | Data mají jen jednu zemi klienta. Pravidlo „klient z rizikové země“ je proto jen částečné. |
| Vysoce riziková třetí země | [§ 9 odst. 1 písm. a) bod 3](https://www.zakonyprolidi.cz/cs/2008-253#p9-1-a-3), [VYHL § 9 odst. 3 písm. a)](https://www.zakonyprolidi.cz/cs/2018-67#p9-3-a) | Třetí země, kterou je třeba považovat za vysoce rizikovou na základě nařízení EU 2016/1675 **nebo z jiného důvodu**. Vyhláška výslovně přidává země, které FATF označil jako „high-risk jurisdictions subject to a call for action“. FAÚ považuje seznamy EU a FATF (black i grey list) za minimální standard; instituce je může rozšířit ([MP9](https://fau.gov.cz/assets/cs/cmsmedia/Metodick%c3%a9%20pokyny/mp-c-9-kontrola-klienta.pdf), s. 14–15). | Seznam musí být verzovaný (zdroj, datum účinnosti). Vyhodnocení musí uložit verzi seznamu, se kterou běželo. |

**Aktuální stav seznamu EU (2016/1675):**

- Bod I (země s politickým závazkem a akčním plánem FATF) nahrazen nařízením [2026/83](https://eur-lex.europa.eu/eli/reg_del/2026/83/oj) ze dne 4. 12. 2025. Obsahuje 23 zemí: Afghánistán, Alžírsko, Angola, Bolívie, Britské Panenské ostrovy, Kamerun, Pobřeží slonoviny, Demokratická republika Kongo, Haiti, Keňa, Laos, Libanon, Monako, Myanmar/Barma, Namibie, Nepál, Jižní Súdán, Sýrie, Trinidad a Tobago, Vanuatu, Venezuela, Vietnam, Jemen.
- Nový bod IV (země s pozastaveným členstvím ve FATF) doplněn nařízením [2026/46](https://eur-lex.europa.eu/eli/reg_del/2026/46/oj) ze dne 3. 12. 2025: Ruská federace.
- Obě nařízení byla vyhlášena 9. 1. 2026 a vstupují v platnost 20. dnem po vyhlášení, tj. 29. 1. 2026.
- Obsah bodů II a III (podle sekundárních zdrojů KLDR a Írán) jsem z primárního zdroje **neověřil**.

## 4. Limity a prahy v zákoně

| Práh | Ustanovení | Parafráze | Dopad na pravidla |
| --- | --- | --- | --- |
| 1 000 EUR – identifikace | [§ 7 odst. 1](https://www.zakonyprolidi.cz/cs/2008-253#p7-1), [§ 7 odst. 4](https://www.zakonyprolidi.cz/cs/2008-253#p7-4) | Identifikace nejpozději, když je zřejmé, že obchod překročí 1 000 EUR. Instituce může podle hodnocení rizik stanovit nižší hodnotu. Vždy při podezřelém obchodu a vzniku obchodního vztahu (odst. 2). | U klientů v obchodním vztahu bez přímého dopadu. Relevantní pro strukturování (`R10`). |
| 15 000 EUR – kontrola klienta mimo obchodní vztah | [§ 9 odst. 1 písm. a) bod 1](https://www.zakonyprolidi.cz/cs/2008-253#p9-1-a-1), [§ 9 odst. 5](https://www.zakonyprolidi.cz/cs/2008-253#p9-5) | Kontrola klienta před obchodem mimo obchodní vztah od 15 000 EUR. Instituce může podle hodnocení rizik stanovit nižší hodnotu. | Pro jednorázové obchody. Pro naše klienty v obchodním vztahu platí průběžné sledování bez prahu. |
| Bez prahu – PEP a vysoce riziková třetí země | [§ 9 odst. 1 písm. a) body 2 a 3](https://www.zakonyprolidi.cz/cs/2008-253#p9-1-a), [§ 9a odst. 2](https://www.zakonyprolidi.cz/cs/2008-253#p9a-2) | Kontrola a zesílená kontrola se uplatní bez ohledu na částku. | Prahy pravidla B (10 000 Kč, 100 000 Kč) jsou volba FINREG. Zákon je nestanoví. Viz [otevřené otázky](#14-otevřené-otázky--co-ověřit-s-právníkem). |
| 1 000 EUR – převod peněžních prostředků | [§ 9 odst. 1 písm. a) bod 6](https://www.zakonyprolidi.cz/cs/2008-253#p9-1-a-6), [§ 14](https://www.zakonyprolidi.cz/cs/2008-253#p14) | Kontrola klienta u převodu od 1 000 EUR mimo obchodní vztah. Výjimka z TFR pro tuzemské platby za zboží nebo služby do 1 000 EUR. | Pro naše klienty bez přímého dopadu. |
| Přepočet EUR | [§ 54 odst. 3](https://www.zakonyprolidi.cz/cs/2008-253#p54-3) | Částka v EUR = hodnota v jakékoli měně podle kurzu ČNB platného pro den plnění povinnosti; jinak kurz předchozího dne. | Pravidla s prahem v EUR musí použít denní kurz ČNB. Odpovídá na otevřenou otázku FX v [README challenge](../finreg/README.md#open-questions-for-our-implementation). |
| Sčítání souvisejících plnění | [§ 54 odst. 4](https://www.zakonyprolidi.cz/cs/2008-253#p54-4) | Je-li obchod rozdělen na více souvisejících plnění, hodnotou obchodu je jejich součet. | Pravidla s prahem musí agregovat související transakce (`R10`). Jinak je lze obejít dělením. |
| 270 000 Kč – platba v hotovosti | [ZOPH § 4 odst. 1](https://www.zakonyprolidi.cz/cs/2004-254#p4-1) | Platbu nad 270 000 Kč musí poskytovatel platby provést bezhotovostně. | Indikátor pro hotovostní transakce (`R16`), pokud typ transakce hotovost rozlišuje. |
| 10 000 EUR – přeshraniční převoz hotovosti | [§ 41](https://www.zakonyprolidi.cz/cs/2008-253#p41) | Oznamovací povinnost fyzické osoby vůči celnímu úřadu. | Bez dopadu na ruleset instituce. |
| 150 / 250 / 2 500 EUR – výjimky pro e-peníze a mobilní platby | [§ 13a](https://www.zakonyprolidi.cz/cs/2008-253#p13a) | Výjimka z identifikace a kontroly. I tak musí instituce transakce sledovat tak, aby zjistila podezřelý obchod (odst. 4). | Bez dopadu, pokud nepracujeme s e-penězi. |

**Dopad na pravidla:** zákon neobsahuje číselné prahy pro detekci neobvyklých transakcí v obchodním vztahu. Prahy pravidel A–C jsou rozhodnutí instituce (zde FINREG). Každý práh **musí** mít v interním předpisu nebo v analytickém podkladu odůvodnění ([BM](https://www.cnb.cz/export/sites/cnb/cs/dohled-financni-trh/.galleries/vykon_dohledu/dohledove_benchmarky/download/dohledovy_benchmark_2023_02.pdf), pozn. 16).

## 5. Kontrola klienta a zesílená kontrola (§ 9, § 9a)

**Ustanovení:** [§ 9](https://www.zakonyprolidi.cz/cs/2008-253#p9), [§ 9a](https://www.zakonyprolidi.cz/cs/2008-253#p9a), [§ 9b](https://www.zakonyprolidi.cz/cs/2008-253#p9b), [§ 15](https://www.zakonyprolidi.cz/cs/2008-253#p15), [VYHL § 9](https://www.zakonyprolidi.cz/cs/2018-67#p9), [MP9](https://fau.gov.cz/assets/cs/cmsmedia/Metodick%c3%a9%20pokyny/mp-c-9-kontrola-klienta.pdf), část třetí.

**Parafráze:**

- **Kdy vždy zesílená kontrola** ([§ 9a odst. 2](https://www.zakonyprolidi.cz/cs/2008-253#p9a-2)):
  - a) při vzniku a v průběhu vztahu s osobou se zemí původu ve vysoce rizikové třetí zemi,
  - b) **před** uskutečněním obchodu souvisejícího s vysoce rizikovou třetí zemí,
  - c) před obchodem nebo při uzavírání vztahu s PEP.
- **Kdy zesílená kontrola podle hodnocení rizik:** pokud klient, obchod nebo vztah představuje zvýšené riziko ([§ 9a odst. 1](https://www.zakonyprolidi.cz/cs/2008-253#p9a-1)).
- **Vyhláška – profil s vyšším rizikem vždy** ([VYHL § 9 odst. 3](https://www.zakonyprolidi.cz/cs/2018-67#p9-3)): země původu klienta, jednající osoby nebo skutečného majitele je vysoce riziková; sankční seznam; PEP; neprůhledná vlastnická struktura; klient nejedná na svůj účet; PO bez ekonomické činnosti; zastřený skutečný majitel.
- **Vyhláška – zesílená kontrola vždy** ([VYHL § 9 odst. 4](https://www.zakonyprolidi.cz/cs/2018-67#p9-4)):
  - a) předmět obchodu jde z nebo do vysoce rizikové třetí země, nebo s ní jinak souvisí,
  - b) rizikový předmět činnosti PO,
  - c) **neobvykle složitý nebo objemný obchod, neobvyklý způsob obchodování, obchod bez zřejmého ekonomického účelu, chování neodpovídající dosavadnímu průběhu vztahu**,
  - d) protiprávní jednání klienta za posledních 5 let,
  - e) první identifikace na dálku podle [§ 11 odst. 7](https://www.zakonyprolidi.cz/cs/2008-253#p11-7), pokud nejde o nízkorizikový produkt.
- **Kritéria neobvyklosti:** instituce musí v SVZ stanovit kritéria pro situace podle odst. 4 písm. c) a zavést pravidla a postupy k jejich identifikaci ([VYHL § 9 odst. 5](https://www.zakonyprolidi.cz/cs/2018-67#p9-5)). Při jejich zjištění vždy zkoumá pozadí a účel obchodu ([VYHL § 9 odst. 6](https://www.zakonyprolidi.cz/cs/2018-67#p9-6)).
- **Opatření zesílené kontroly** ([§ 9a odst. 3](https://www.zakonyprolidi.cz/cs/2008-253#p9a-3), [VYHL § 9 odst. 2](https://www.zakonyprolidi.cz/cs/2018-67#p9-2)): další informace o zdroji prostředků, ověření z více zdrojů, **pravidelné a zesílené sledování vztahu a obchodů**, souhlas člena statutárního orgánu nebo pověřené osoby, schválení zaměstnancem o úroveň výš, omezení produktů.
- **Minimální rozsah** ([§ 9a odst. 4](https://www.zakonyprolidi.cz/cs/2008-253#p9a-4)): u rizikové země alespoň opatření písm. a)–d) a f); u PEP alespoň zdroj prostředků, zesílené sledování a souhlas vedení.
- **PEP a původ prostředků:** instituce neuskuteční obchod s PEP, pokud nezná původ prostředků ([§ 15 odst. 2](https://www.zakonyprolidi.cz/cs/2008-253#p15-2)).
- **Ex ante u rizikových zemí:** FAÚ uvádí, že plošný ex post monitoring transakcí s rizikovými zeměmi s týdenní frekvencí nestačí, protože zákon vyžaduje prověření před obchodem. Ex ante lze splnit tak, že instituce předem zjistí od klienta očekávané transakce s rizikovou zemí; ex post monitoring pak odhaluje odchylky ([MP9](https://fau.gov.cz/assets/cs/cmsmedia/Metodick%c3%a9%20pokyny/mp-c-9-kontrola-klienta.pdf), s. 27–28).
- **Zesílené sledování** = typicky častější monitoring rizikového klienta s nižšími limity ([BM](https://www.cnb.cz/export/sites/cnb/cs/dohled-financni-trh/.galleries/vykon_dohledu/dohledove_benchmarky/download/dohledovy_benchmark_2023_02.pdf), kap. I.i).

**Dopad na pravidla (typ B):**

- Pravidla pro PEP a vysoce rizikové země jsou **regulatorně povinná**. Systém je **nesmí** dovolit vypnout ani obejít whitelistem bez schválení compliance a odůvodnění. Zjednodušenou kontrolu nelze použít, jsou-li splněny podmínky zesílené kontroly ([§ 13 odst. 1 písm. c)](https://www.zakonyprolidi.cz/cs/2008-253#p13-1-c)). Whitelist je podle BM forma zjednodušené kontroly. Z toho dovozuji, že whitelist u PEP a rizikových zemí není přípustný. **Ověřit s právníkem.**
- Pravidlo B(a) by mělo kontrolovat zemi plátce, příjemce **i** klienta. Zákon spojuje povinnost s „obchodem souvisejícím“ se zemí, ne s částkou.
- Pravidlo B(b) by podle zákona mělo pokrýt všechny obchody PEP. Práh 100 000 Kč a omezení na odchozí platby jsou rozhodnutí RBA. Musí být odůvodněná.
- „Riziková“ verze profilu (`high`) by měla aktivovat přísnější varianty pravidel A (nižší prahy). Odpovídá to atributu „platné risk profily“ v [spec 4.4](../../spec/spec.md#44-konfigurace-pravidla).
- Forma uzavření smlouvy na dálku (§ 11 odst. 7) je povinný faktor zvýšeného rizika (VYHL § 9 odst. 4 písm. e)). Má vstoupit do priority a profilu.
- MVP v režimu ex post nesplní požadavek § 9a odst. 2 písm. b) na prověření **před** obchodem. Výstup systému je proto doplněk, ne náhrada ex ante kontroly.

## 6. Průběžné sledování obchodního vztahu

**Ustanovení:** [§ 9 odst. 1 písm. c)](https://www.zakonyprolidi.cz/cs/2008-253#p9-1-c), [§ 9 odst. 2 písm. d) a e)](https://www.zakonyprolidi.cz/cs/2008-253#p9-2-d), [§ 9 odst. 3 a 4](https://www.zakonyprolidi.cz/cs/2008-253#p9-3), [§ 8 odst. 9](https://www.zakonyprolidi.cz/cs/2008-253#p8-9), [§ 18 odst. 1 věta 1](https://www.zakonyprolidi.cz/cs/2008-253#p18-1), [VYHL § 6–8](https://www.zakonyprolidi.cz/cs/2018-67#p6), [VYHL § 17](https://www.zakonyprolidi.cz/cs/2018-67#p17), [BM](https://www.cnb.cz/export/sites/cnb/cs/dohled-financni-trh/.galleries/vykon_dohledu/dohledove_benchmarky/download/dohledovy_benchmark_2023_02.pdf), [MP9](https://fau.gov.cz/assets/cs/cmsmedia/Metodick%c3%a9%20pokyny/mp-c-9-kontrola-klienta.pdf) kap. V.

**Parafráze:**

- Kontrola klienta zahrnuje průběžné sledování vztahu a přezkoumávání obchodů. Cílem je zjistit, zda obchody odpovídají tomu, co instituce ví o klientovi, jeho podnikání a rizikovém profilu (§ 9 odst. 2 písm. d)). Patří sem i přezkoumání zdrojů prostředků (písm. e)).
- Rozsah sledování závisí na typu klienta, vztahu, produktu a obchodu. Instituce musí přiměřenost rozsahu doložit dozoru (§ 9 odst. 3). Zohlední rizikové faktory z hodnocení rizik (§ 9 odst. 4).
- Instituce sama vyhodnocuje dostupné informace a zjišťuje podezřelé obchody (§ 18 odst. 1 věta 1). Soudy dovodily, že se nemůže vyvinit tím, že obchod nevyhodnotila, ač měla a mohla ([MP4](https://fau.gov.cz/assets/cs/cmsmedia/Metodick%c3%a9%20pokyny/Metodika%20%c4%8d.%204_OPO1.pdf), s. 6).
- FAÚ: přezkoumávat se musí **všechny** obchody ve vztahu. Monitoring má zachytit odchylky od dřívějšího chování klienta, od údajů z uzavření smlouvy, od chování typově obdobných klientů a od hodnocení rizik. Má zachytit i obchody rizikové kvůli protistraně ([MP9](https://fau.gov.cz/assets/cs/cmsmedia/Metodick%c3%a9%20pokyny/mp-c-9-kontrola-klienta.pdf), s. 19).
- Instituce stanoví rizikový profil klienta. Určí faktory, jejich váhy a vzájemné vztahy ([VYHL § 6](https://www.zakonyprolidi.cz/cs/2018-67#p6), [§ 7 odst. 1–2](https://www.zakonyprolidi.cz/cs/2018-67#p7-1)). Profil zohledňuje i probíhající a provedené obchody ([VYHL § 7 odst. 6](https://www.zakonyprolidi.cz/cs/2018-67#p7-6)). Mezi faktory patří mj. země, kam nebo odkud jde předmět obchodu (písm. e)), chování klienta (písm. j)) a způsob první identifikace (písm. p)).
- Profil se pravidelně aktualizuje v maximálních intervalech podle rizika. Instituce zaznamená posouzení i tehdy, když nic nemění ([VYHL § 7 odst. 3](https://www.zakonyprolidi.cz/cs/2018-67#p7-3)).
- Automaticky generované hodnocení rizikovosti klienta musí jít v odůvodněných případech změnit ([VYHL § 7 odst. 4](https://www.zakonyprolidi.cz/cs/2018-67#p7-4)).
- Vyhledávání informací musí být automatizované, ledaže je to nepřiměřené velikosti instituce ([VYHL § 17 odst. 2](https://www.zakonyprolidi.cz/cs/2018-67#p17-2)). Osoba, která podezření vyhodnocuje, musí mít přístup ke všem potřebným informacím ([VYHL § 17 odst. 1](https://www.zakonyprolidi.cz/cs/2018-67#p17-1)).
- ČNB považuje za nedostatečné, pokud monitoring u klientů typu nebankovní finanční instituce neporovnává očekávané a skutečné objemy a počty transakcí ([BM](https://www.cnb.cz/export/sites/cnb/cs/dohled-financni-trh/.galleries/vykon_dohledu/dohledove_benchmarky/download/dohledovy_benchmark_2023_02.pdf), kap. II.iii).

**Dopad na pravidla (typ A):**

- Pravidla A(a)–(c) přímo naplňují § 9 odst. 2 písm. d): porovnání s projektovaným objemem z uzavření smlouvy a s historií Q2.
- Ruleset **by měl** sledovat i **počet** transakcí, ne jen objem. Zákon zmiňuje „nápadně více peněžních operací“ (§ 6 odst. 1 písm. b)) a klientský log obsahuje projektovaný i skutečný počet.
- Pravidla **by měla** porovnávat klienta i s jeho segmentem (typ klienta FO/FOP/PO). ČNB považuje jednotný limit napříč segmenty za neobezřetný.
- Kontext vyhodnocení „klient + celá historie“ ([spec D6](../../spec/spec.md#2-klíčová-rozhodnutí)) odpovídá požadavku VYHL § 17 odst. 1.
- AML risk score klienta z dat je vstup, ne výstup. Pokud ho systém bude přepočítávat, **musí** umožnit ruční přepsání s odůvodněním (VYHL § 7 odst. 4).

## 7. Oznámení podezřelého obchodu, mlčenlivost, odklad (§ 18, § 20, § 38)

**Ustanovení:** [§ 18](https://www.zakonyprolidi.cz/cs/2008-253#p18), [§ 19](https://www.zakonyprolidi.cz/cs/2008-253#p19), [§ 20](https://www.zakonyprolidi.cz/cs/2008-253#p20), [§ 21 odst. 5 písm. f), h), i)](https://www.zakonyprolidi.cz/cs/2008-253#p21-5-f), [§ 38](https://www.zakonyprolidi.cz/cs/2008-253#p38), [§ 43](https://www.zakonyprolidi.cz/cs/2008-253#p43), [VYHL § 17a](https://www.zakonyprolidi.cz/cs/2018-67#p17a), [MP4](https://fau.gov.cz/assets/cs/cmsmedia/Metodick%c3%a9%20pokyny/Metodika%20%c4%8d.%204_OPO1.pdf), [BM](https://www.cnb.cz/export/sites/cnb/cs/dohled-financni-trh/.galleries/vykon_dohledu/dohledove_benchmarky/download/dohledovy_benchmark_2023_02.pdf) kap. III.

**Parafráze:**

- **Lhůta oznámení:** podezřelý obchod se oznamuje FAÚ bez zbytečného odkladu. Hrozí-li nebezpečí z prodlení, neprodleně (§ 18 odst. 1). FAÚ vykládá „bez zbytečného odkladu“ jako velmi krátkou lhůtu, podle důvodové zprávy kratší než 5 kalendářních dnů. „Neprodleně“ je ještě kratší ([MP4](https://fau.gov.cz/assets/cs/cmsmedia/Metodick%c3%a9%20pokyny/Metodika%20%c4%8d.%204_OPO1.pdf), s. 7).
- **Lhůta šetření:** instituce určí ve vnitřním předpisu přiměřenou lhůtu pro šetření. Lhůta běží od okamžiku, kdy instituce získala informaci zakládající možné podezření ([VYHL § 17a](https://www.zakonyprolidi.cz/cs/2018-67#p17a)). FAÚ i ČNB vážou počátek na **vygenerování alertu**, ne na jeho otevření ([MP4](https://fau.gov.cz/assets/cs/cmsmedia/Metodick%c3%a9%20pokyny/Metodika%20%c4%8d.%204_OPO1.pdf), s. 8; BM kap. III.i).
- **Orientační lhůty ČNB** (BM kap. III.i): alert ze scénáře nad denní nebo týdenní historií zpracovat bezodkladně, nejvýše v řádu dnů. Alert ze scénáře nad týdny až měsíci zpracovat do měsíce. Překážky musí být v záznamu šetření.
- **Neobezřetné podle ČNB:** generování alertů v dávkách po týdnech až 30 dnech, i když je podmínka scénáře splněna dříve; lhůty šetření v desítkách až stovkách dní.
- **Obsah oznámení** (§ 18 odst. 2, 5–7; MP4 s. 8–10): identifikace dotčených osob, podstatné okolnosti, čím je obchod podezřelý, čísla účtů, informace o provedení nebo odložení obchodu, přílohy. Oznámení **nesmí** uvádět zaměstnance, který obchod zjistil (§ 18 odst. 3). Oznámení je povinné vždy, když instituce neprovedla kontrolu podle § 9b písm. a) (§ 18 odst. 1 věta 4).
- **Forma:** písemně, elektronicky se zajištěnou důvěrností nebo doporučeným dopisem (§ 19). FAÚ přijímá MoneyWeb, elektronický formulář FAÚ nebo datovou schránku. E-mail nelze použít (MP4 s. 12).
- **SVZ musí popsat** postup od zjištění podezřelého obchodu po doručení oznámení tak, aby byla dodržena lhůta, a určit osoby, které podezřelý obchod vyhodnocují (§ 21 odst. 5 písm. f)).
- **Odklad splnění příkazu** (§ 20): hrozí-li zmaření zajištění výnosu, instituce provede příkaz nejdříve 24 hodin od přijetí oznámení FAÚ a majetek zajistí. FAÚ může odklad prodloužit o další 2 pracovní dny nebo nařídit odklad či zajištění až na 3 pracovní dny. Podá-li FAÚ trestní oznámení, odklad se prodlužuje o 3 pracovní dny. SVZ musí obsahovat technická a personální opatření k provedení odkladu (§ 21 odst. 5 písm. h), i)).
- **Mlčenlivost** (§ 38): instituce a její zaměstnanci zachovávají mlčenlivost o oznámení, šetření a úkonech FAÚ. Povinnost trvá i po skončení pracovního vztahu a platí pro každého, kdo se o skutečnostech dozví. Porušení je přestupek s pokutou do 200 000 Kč, při ztížení zajištění výnosu do 1 000 000 Kč (§ 43 odst. 4, 5).
- **Neuskutečnění obchodu** (§ 15): instituce odmítne obchod nebo ukončí vztah, pokud nelze provést kontrolu klienta nebo má pochybnosti o pravdivosti informací. ČNB upozorňuje, že šetření alertu často kombinuje § 15 a § 18 (BM pozn. 38).

**Dopad na eskalaci a lhůty AML událostí:**

- AML událost **musí** mít časové razítko vygenerování. SLA šetření se počítá od něj, ne od přiřazení řešiteli.
- Systém **by měl** mít SLA podle typu pravidla: pravidla nad denní historií (A, B, C) v řádu dnů; pravidla nad delší historií do měsíce. Konkrétní hodnoty musí stanovit interní předpis (VYHL § 17a).
- Batch generování alertů jednou za týden nebo měsíc je podle ČNB neobezřetné. Ex post režim MVP ([spec D7](../../spec/spec.md#2-klíčová-rozhodnutí)) **by měl** generovat alert hned po zpracování dat, nejlépe denně.
- Stav AML události **by měl** obsahovat i krok „rozhodnutí o oznámení FAÚ“ a „oznámení podáno“ s časem. Interval mezi rozhodnutím o podezřelosti a podáním musí být kratší než 5 kalendářních dnů.
- Export pro oznámení FAÚ **nesmí** obsahovat identitu zaměstnance, který obchod zjistil. Audit log ji obsahovat může a musí (VYHL § 18).
- AML události a jejich odůvodnění podléhají mlčenlivosti. Přístup **musí** být role-based podle principu need-to-know (BM kap. II.v). Systém **nesmí** klientovi zobrazit nebo zaslat nic, co by prozradilo alert nebo oznámení.
- Odklad podle § 20 vyžaduje zásah před provedením platby. MVP v režimu ex post ho neumožní. Je to argument pro live prevention mimo MVP.

## 8. Systém vnitřních zásad, hodnocení rizik, odpovědné osoby, uchovávání (§ 16, § 21, § 21a, § 22, § 22a, vyhláška)

**Ustanovení:** [§ 21](https://www.zakonyprolidi.cz/cs/2008-253#p21), [§ 21a](https://www.zakonyprolidi.cz/cs/2008-253#p21a), [příloha č. 2](https://www.zakonyprolidi.cz/cs/2008-253) (konec předpisu), [§ 22](https://www.zakonyprolidi.cz/cs/2008-253#p22), [§ 22a](https://www.zakonyprolidi.cz/cs/2008-253#p22a), [§ 23](https://www.zakonyprolidi.cz/cs/2008-253#p23), [§ 16](https://www.zakonyprolidi.cz/cs/2008-253#p16), [VYHL § 4, 5, 16, 18–21](https://www.zakonyprolidi.cz/cs/2018-67).

**Parafráze:**

- **SVZ:** instituce písemně vypracuje systém vnitřních zásad do 60 dnů od vzniku povinnosti. Součástí je písemné hodnocení rizik. **SVZ i hodnocení rizik schvaluje statutární orgán.** Instituce SVZ průběžně aktualizuje (§ 21 odst. 2).
- **Obsah SVZ s vazbou na monitoring** (§ 21 odst. 5): podrobný výčet znaků podezřelých obchodů (a); rozpoznání PEP a sankcionovaných osob (b); postupy kontroly klienta podle rizika (c); metody posuzování a řízení rizik a vnitřní kontroly (d); postup od zjištění podezřelého obchodu po oznámení a určení vyhodnocujících osob (f); opatření pro odklad (h, i).
- **Vnitřní kontrola:** kontrola dodržování předpisů a prověřování účinnosti postupů. Je-li to opodstatněné, nezávislý útvar podřízený statutárnímu orgánu (§ 21 odst. 6 písm. a)).
- **Oznámení SVZ:** platební instituce a další vyjmenované instituce oznámí FAÚ znění SVZ do 60 dnů a změny s vyznačením do 30 dnů od přijetí. Instituce podle § 2 odst. 1 písm. b) bodů 1–4 oznamují ČNB (§ 21 odst. 8).
- **Hodnocení rizik** (§ 21a): zohlední NRA, nadnárodní hodnocení, rizikové faktory z přílohy č. 2 a další informace. Pravidelně se aktualizuje, zejména před novými produkty a technologiemi (odst. 3). Příloha č. 2 mj. uvádí: obchod bez osobní přítomnosti (bod 2 písm. c)), příchozí platby od neznámých nebo nespřízněných třetích osob (bod 2 písm. d)), geografická rizika (bod 3).
- **Vyhláška – správa vnitřních předpisů** (VYHL § 4):
  - instituce zavede postupy pro vypracování, přijetí, změnu a zavádění vnitřních předpisů (odst. 1),
  - určí minimální intervaly revize (odst. 4),
  - posoudí a případně aktualizuje předpisy bez zbytečného odkladu při změně hodnocení rizik, obchodní činnosti, právních předpisů nebo NRA (odst. 5),
  - **vždy zaznamená výsledek posouzení a jeho důvody** (odst. 6),
  - podle potřeby aktualizuje rizikové profily klientů (odst. 7).
- **Vyhláška – hodnocení rizik** (VYHL § 5): zohlední metodiky ČNB a FAÚ a informace z kontroly klientů; zaznamená použité postupy a důvody závěrů.
- **Kontaktní osoba** (§ 22): konkrétní zaměstnanec nebo člen statutárního orgánu pro oznamování a styk s FAÚ. Instituce oznámí FAÚ údaje o ní do 30 dnů, změny do 15 dnů. U finanční instituce jí nesmí být (bez opodstatnění) člen statutárního orgánu, zaměstnanec odpovědný za uzavírání nebo vypořádání obchodů, ani osoba z vnitřního auditu (odst. 4, 5).
- **Pověřená osoba** (§ 22a): člen statutárního orgánu písemně pověřený zajištěním plnění AML povinností, do 60 dnů.
- **Kontrolor dodržování předpisů:** vyhláška vyžaduje tuto pozici, ledaže to není přiměřené rozsahu podnikání ([VYHL § 16 odst. 2](https://www.zakonyprolidi.cz/cs/2018-67#p16-2)).
- **Hodnotící zpráva** ([VYHL § 19–21](https://www.zakonyprolidi.cz/cs/2018-67#p19)): nejméně jednou za 12 měsíců posoudí účinnost postupů, nedostatky a opatření. Obsahuje statistiku oznámení podezřelých obchodů. Schvaluje ji alespoň pověřená osoba. Vypracuje se do konce 4. měsíce po období. Statutární orgán ji projedná ve stejné lhůtě. Uchovává se 5 let.
- **Uchovávání** (§ 16): 10 let od obchodu mimo vztah nebo od ukončení vztahu. Týká se mj. záznamů o krocích kontroly klienta, **záznamů o postupu při stanovení rizikového profilu a při posouzení skutečností souvisejících s oznámením podezřelého obchodu** (odst. 1 písm. e), f)) a údajů o obchodech (odst. 2). Lhůta běží od 1. dne měsíce po posledním známém úkonu obchodu (odst. 5). Způsob uchování musí zajistit průkaznost obchodů a postupů (odst. 3).
- **Zpětná rekonstruovatelnost** ([VYHL § 18](https://www.zakonyprolidi.cz/cs/2018-67#p18)): schvalovací, rozhodovací a kontrolní procesy včetně důvodů, odpovědností, podkladů a posouzení souvisejících s oznámením musí jít zpětně rekonstruovat. Záznam musí ukázat, koho se úkon týká, kdo a kdy ho provedl, s jakým výsledkem, na základě jakých podkladů a důvodů, a kdy a kdo vložil podklad do dokumentace.
- **Školení** (§ 23): nejméně jednou za 12 měsíců; obsah zahrnuje typologie a znaky podezřelých obchodů; evidence 5 let.

**Dopad na audit log a schvalování pravidel:**

- Zákon nestanoví, kdo schvaluje jednotlivé pravidlo. Schvaluje SVZ jako celek (statutární orgán). ČNB považuje detailní nastavení scénářů a prahů za součást SVZ ([BM](https://www.cnb.cz/export/sites/cnb/cs/dohled-financni-trh/.galleries/vykon_dohledu/dohledove_benchmarky/download/dohledovy_benchmark_2023_02.pdf), pozn. 15). Schvalovací workflow pravidel ([spec 4.3](../../spec/spec.md#43-stavy-verze-a-schválení)) **musí** mít v SVZ delegaci: kdo smí schválit pravidlo a kdy jde změna statutárnímu orgánu.
- Změna pravidla může být změnou SVZ, kterou je nutné oznámit FAÚ do 30 dnů (§ 21 odst. 8). **Ověřit s právníkem.**
- Tlačítko „zkontrolovat aktualizace regulací“ ([spec 4.3](../../spec/spec.md#43-stavy-verze-a-schválení)) naplňuje VYHL § 4 odst. 5 písm. d). Systém **musí** zapsat výsledek kontroly a důvody i tehdy, když aktualizace není potřeba (VYHL § 4 odst. 6).
- Pravidlo **by mělo** mít atribut „interval revize“ a datum poslední revize (VYHL § 4 odst. 4).
- Audit log **musí** pro každé vyhodnocení, změnu pravidla, schválení a rozhodnutí obsahovat: aktéra, čas, cílovou entitu, výsledek, podklady (verze pravidla, verze seznamů, kontext dat) a odůvodnění (VYHL § 18 odst. 3).
- Retence audit logu a AML událostí **musí** být nejméně 10 let od ukončení vztahu s klientem (§ 16 odst. 1 písm. f)). Mazání po lhůtě je povinné (§ 16 odst. 5).
- Eskalační matice **musí** respektovat § 22 odst. 5: kontaktní osoba nesmí být zaměstnanec odpovědný za uzavírání obchodů. Podpora principu „nikdo nereviduje vlastní klienty“ (FINREG).
- Systém **by měl** poskytnout statistiky pro hodnotící zprávu: počty alertů podle pravidel, podíl FP, počty oznámení, dodržení lhůt (VYHL § 19 odst. 3).

## 9. Požadavky na automatizovaný monitoring (vyhláška, benchmark ČNB 2/2023)

Benchmark se primárně týká bank. ČNB uvádí, že ho lze přiměřeně aplikovat i na další subjekty finančního trhu ([BM](https://www.cnb.cz/export/sites/cnb/cs/dohled-financni-trh/.galleries/vykon_dohledu/dohledove_benchmarky/download/dohledovy_benchmark_2023_02.pdf), s. 1). Benchmark není právní předpis. Popisuje, co ČNB při kontrole považuje za neobezřetné.

| Oblast | Zdroj | Požadavek nebo očekávání (parafráze) | Dopad na náš návrh |
| --- | --- | --- | --- |
| Metodika monitoringu | BM kap. I.ii | Předpisy musí popsat: vyhodnocování scénářů, stanovení prahů, aktualizaci parametrických seznamů (země, produkty, platební kódy), ověřování vstupních dat, šetření a prioritizaci alertů, whitelisting. Zastřešující AML předpis má odkazovat na metodiku monitoringu. | Každé pravidlo potřebuje lidský přepis + odůvodnění prahu. Seznamy zemí a typů transakcí jsou verzované konfigurační entity. |
| Zdůvodnění prahů | BM pozn. 16 | Doporučen interní analytický dokument, který odůvodní nastavení limitů. Příklad neobezřetnosti: maximum transakce FO za rok 1 000 000 Kč a limit scénáře 5 000 000 Kč. Limity mají zohlednit segment klienta a údaje od klienta. | Verze pravidla **by měla** obsahovat pole „odůvodnění prahu“ a odkaz na analýzu dat. |
| Efektivita scénářů | BM kap. II.i | Průběžné, včasné a kvalitní vyhodnocování efektivity scénářů a parametrů podle aktuálních rizik. Scénáře mají reflektovat standardy a vlastní praxi. | Statistiky FP/REVIEW per pravidlo a verze; podklad pro revizi a novou verzi. |
| Jednotný limit ve skupině | BM kap. II.i | Jednotný limit pro všechny entity skupiny bez lokálních specifik je neobezřetný. | Citlivost a prahy **by měly** jít nastavit per segment. Globální koeficient citlivosti v MVP ([spec D13](../../spec/spec.md#2-klíčová-rozhodnutí)) je na hraně. |
| Kvalita dat | BM kap. I.ii, II.i | Data pro monitoring musí být platná, správná a úplná. Datové chyby vznikají už při vstupní kontrole klienta. | Validace vstupních dat před vyhodnocením; záznam o chybějících údajích do trace. |
| Interní převody | BM kap. II.ii | Plošné vyřazení interních převodů je neobezřetné. Vyřadit lze jen vybrané typy s nízkým rizikem na základě RBA. | Pravidla **nesmí** plošně ignorovat transakce mezi klienty instituce. |
| Lhůty alertů | BM kap. III.i, VYHL § 17a | Lhůta šetření běží od vygenerování alertu. Viz [sekci 7](#7-oznámení-podezřelého-obchodu-mlčenlivost-odklad--18--20--38). | SLA na AML událost. |
| Prioritizace | BM kap. III.ii | Metodika priorit: šetření začíná u klientů a transakcí s vyšším rizikem. I nízkorizikové alerty mají lhůtu. | Priorita 0–100 podle challenge naplňuje tento požadavek. |
| Ad hoc posouzení | BM kap. III.ii | Šetření založené na ad hoc subjektivním posouzení bez metodiky je nedostatečné. Odchylka od metodiky musí být určitelná a rekonstruovatelná. | Triage LLM **musí** mít psanou metodiku (prompt + kritéria) verzovanou stejně jako pravidla. |
| Whitelist | BM kap. III.ii, pozn. 42–45 | Whitelist je přípustný v mezích zjednodušené kontroly (§ 13). Jen individuální klienti nebo účty, ne plošně skupiny. Vyžaduje metodiku, odůvodnění, schválení odpovídající riziku, pravidelnou revizi a rekonstruovatelnost. Nastavení v aplikaci samo nestačí. | Whitelist ([spec D11](../../spec/spec.md#2-klíčová-rozhodnutí)) **musí** mít per záznam: odůvodnění, schvalovatele, datum, datum příští revize, audit log. |
| Uzavření alertu | BM kap. III.iii | Uzavření musí uvést, zda a proč byla podezřelost vyloučena, a další opatření. Poznámka „OK“ bez vysvětlení je typický nedostatek. | Pole `reason` a `log` ve výstupním CSV naplňují tento požadavek. |
| IS/IT a změnové řízení | BM kap. II.v | Rekonstruovatelnost nasazení nových verzí a funkcí včetně generování alertů, zapínání a vypínání funkcí, změn přístupových práv. Požadavky specifikuje, testuje a akceptuje business owner AML. Zálohy nebo archiv musí umožnit rekonstruovat alerty k určitému okamžiku včetně historie zpracování. Need-to-know a oddělení neslučitelných rolí. | Stav `active` / `inactive` a každé přepnutí do audit logu. Vyhodnocení musí odkazovat na neměnnou verzi pravidla. |
| Externí zdroje | BM kap. II.v | Integrace s externími databázemi, typicky sankční seznamy. | Sankční screening je samostatný modul. |
| AI | BM kap. IV | Ověřit kvalitu učících dat; vysvětlitelnost a rekonstruovatelnost rozhodnutí AI; průběžná kalibrace; projektová dokumentace; řešení předpojatosti; transparentnost, ne „black box“. ČNB zmiňuje i plně automatizované šetření alertů, která jsou následně verifikována. | LLM triage **musí** ukládat odůvodnění, vstupní kontext a verzi modelu a promptu. Automatické `FP` **by měl** člověk aspoň výběrově verifikovat. |
| Automatické vyhledávání | VYHL § 17 odst. 2 | Vyhledávání informací automatizovaně, pokud to není nepřiměřené. | Detail vyhodnocení s historií klienta. |
| Přepsání skóre | VYHL § 7 odst. 4 | Automatické hodnocení rizikovosti klienta musí jít změnit. | Override risk profilu s odůvodněním a audit logem. |

## 10. Sankční seznamy a mezinárodní sankce

**Ustanovení:** [§ 6 odst. 2](https://www.zakonyprolidi.cz/cs/2008-253#p6-2), [§ 8 odst. 8](https://www.zakonyprolidi.cz/cs/2008-253#p8-8), [§ 9 odst. 2 písm. b), c)](https://www.zakonyprolidi.cz/cs/2008-253#p9-2-b), [§ 21 odst. 5 písm. b)](https://www.zakonyprolidi.cz/cs/2008-253#p21-5-b), [VYHL § 9 odst. 3 písm. b)](https://www.zakonyprolidi.cz/cs/2018-67#p9-3-b), [VYHL § 12](https://www.zakonyprolidi.cz/cs/2018-67#p12), [ZPMS § 10, § 11](https://www.zakonyprolidi.cz/cs/2006-69#p10).

**Parafráze:**

- Obchod s osobou nebo zbožím pod mezinárodními sankcemi je vždy podezřelý (§ 6 odst. 2).
- Instituce zjišťuje sankční status klienta, jednající osoby, skutečného majitele a osob ve struktuře (§ 8 odst. 8, § 9 odst. 2 písm. b), c)). Shoda znamená vždy profil s vyšším rizikem (VYHL § 9 odst. 3 písm. b)).
- Podle ZPMS musí ten, kdo zjistí sankcionovaný majetek, bez zbytečného odkladu informovat FAÚ (§ 10) a s majetkem nenakládat (§ 11).
- ČNB řadí kontrolu proti sankčním seznamům mezi typologie prováděné ex ante (BM pozn. 37). Sankční mapa EU nesmí být jediným zdrojem ([MP11](https://fau.gov.cz/assets/cs/cmsmedia/Metodick%c3%a9%20pokyny/mp-c-11-hodnoceni-rizik-a-system-vnitrni.pdf), s. 31–32).

**Dopad na pravidla:** sankční screening patří do AML baseline, ale je to samostatná kontrola nad jmény a identifikátory, ne pravidlo nad transakčními vzory. Nad anonymizovanými daty challenge ho nelze provést. V ruleset systému ho **můžeme** reprezentovat jako externí vstup (flag „sanctions hit“) s maximální prioritou. Zákon č. 1/2023 Sb. (sankční zákon), který uvádí BM, jsem v této rešerši nezpracoval.

## 11. AMLR a seznam rizikových zemí (kontext od 10. 7. 2027)

- **Použitelnost:** od 10. 7. 2027 ([AMLR čl. 90](https://eur-lex.europa.eu/eli/reg/2024/1624/oj/ces)).
- **Crowdfunding:** poskytovatelé služeb skupinového financování podle nařízení (EU) 2020/1503 budou výslovně povinnými osobami ([AMLR čl. 3 bod 3 písm. h)](https://eur-lex.europa.eu/eli/reg/2024/1624/oj/ces)). Současný § 2 AML zákona je výslovně neuvádí.
- **Průběžné sledování** ([čl. 26 odst. 1](https://eur-lex.europa.eu/eli/reg/2024/1624/oj/ces)): sledování transakcí vůči informacím o klientovi, jeho činnosti a rizikovém profilu a podle potřeby i vůči původu a místu určení prostředků. Pokrývá všechny produkty klienta.
- **Aktualizace údajů o klientovi** (čl. 26 odst. 2): nejvýše po 1 roce u rizikovějších klientů a po 5 letech u ostatních. Pravidelné ověřování sankčního statusu (čl. 26 odst. 4).
- **Prahy kontroly klienta** (čl. 19): příležitostné transakce od 10 000 EUR včetně souvisejících transakcí (odst. 1 písm. b)); převody finančních prostředků od 1 000 EUR (odst. 2).
- **Oznamování** ([čl. 69](https://eur-lex.europa.eu/eli/reg/2024/1624/oj/ces)): neprodleně; oznamují se i pokusy a podezření z nemožnosti provést kontrolu. Na žádost FIU odpověď do 5 pracovních dnů, v naléhavých případech i pod 24 hodin. Podezření se má zakládat mj. na vazbě mezi více transakcemi a souladu s informacemi z kontroly klienta (odst. 2).
- **Uchovávání** ([čl. 77](https://eur-lex.europa.eu/eli/reg/2024/1624/oj/ces)): **5 let**, výslovně včetně záznamů o posouzeních podle čl. 69 odst. 2, **i když nevedla k oznámení**. Záznamy nesmí být upravovány. Po 5 letech se osobní údaje vymažou (odst. 3). Oproti 10 letům podle § 16 AML zákona je to zkrácení.
- **Hotovost** ([čl. 80](https://eur-lex.europa.eu/eli/reg/2024/1624/oj/ces)): limit 10 000 EUR pro platby za zboží a služby. Nižší národní limity zůstávají. Český limit 270 000 Kč odpovídá při kurzu 24–25 Kč/EUR přibližně 10 800–11 250 EUR, tedy není nižší. Vztah obou limitů je nutné ověřit.
- **Vysoce rizikové země** (čl. 29–31) a zesílená kontrola (čl. 34); PEP (čl. 42–46, včetně osob, které přestávají být PEP, čl. 45); compliance manager a compliance officer (čl. 11).
- **Seznam 2016/1675** se dnes vydává podle směrnice (EU) 2015/849. Po 10. 7. 2027 bude Komise identifikovat země podle čl. 29–31 AMLR. Verzovaný seznam zemí v našem systému musí unést změnu zdroje.

**Dopad na pravidla:** model pravidel a audit logu navrhujeme tak, aby šel přepnout z 10leté retence (AML zákon) na 5letou (AMLR) a aby uchovával i uzavřené alerty bez oznámení. Pravidla typu A zůstávají stejná, AMLR je výslovně požaduje.

## 12. Kandidáti pravidel z § 6 a dalších ustanovení

Data: transakce (ID, klient, datum a čas, částka, měna, země plátce a příjemce, anonymizovaná čísla účtů, typ) a klient (země, datum a forma uzavření smlouvy, PEP, typ FO/FOP/PO, projektovaný objem a počet, Q2 objem / počet / max, AML risk score).

| ID | Zdroj | Popis | Potřebná data / featury | Detekovatelné | Poznámka, mapování A–C |
| --- | --- | --- | --- | --- | --- |
| `R01` | § 6 odst. 1 písm. b) | Nápadně více transakcí za den nebo za 2–3 navazující dny, než je pro klienta obvyklé | počet transakcí za den a klouzavé okno; Q2 počet / 91 dní; projektovaný počet | Ano | Doplněk A. A měří objem, `R01` počet. |
| `R02` | § 6 odst. 1 písm. d); VYHL § 9 odst. 4 písm. c) | Neobvykle objemná jednotlivá transakce vůči historii klienta | částka v CZK; Q2 max | Ano | = **A(c)** (> 2× max Q2) |
| `R03` | § 6 odst. 1 písm. e); § 9 odst. 2 písm. d) | Denní nebo měsíční objem neodpovídá projektovanému objemu nebo historii | denní objem in+out v CZK; projektovaný měsíční objem; Q2 objem / 91 | Částečně: chybí příjem a majetek | = **A(a)** (> 25 % projektovaného měsíčního objemu) a **A(b)** (> 3× průměru Q2) |
| `R04` | § 6 odst. 1 písm. a) | Výběr nebo převod brzy po hotovostním vkladu | typ transakce (hotovost / bezhotovost), směr, čas | Částečně: jen pokud `typ` rozlišuje hotovost | Analogie C pro hotovost |
| `R05` | § 6 odst. 1 písm. d), f); příloha 2 bod 2 písm. d) | Průtokový účet: příchozí > 100 000 Kč za 24 h a do 6 h odchozí ≥ 80 % na jiný účet než plátce | čas, směr, částka, anonymizovaný účet plátce a příjemce | Ano | = **C** |
| `R06` | § 6 odst. 1 písm. c) | Klient používá nepoměrně mnoho vlastních účtů | počet různých účtů klienta (strana klienta v transakcích) | Částečně: nutné ověřit sémantiku anonymizovaných účtů | Nové |
| `R07` | § 6 odst. 1 písm. h); § 9a odst. 2 písm. a); VYHL § 9 odst. 3 písm. a) | Klient se zemí původu ve vysoce rizikové třetí zemi | země klienta; verzovaný seznam HRTC | Částečně: jen jedna země, chybí skutečný majitel | = **B(a)** (část „země klienta“). Zákon nestanoví částku. |
| `R08` | § 9a odst. 2 písm. b); VYHL § 9 odst. 4 písm. a) | Transakce související s vysoce rizikovou třetí zemí (plátce nebo příjemce) | země plátce a příjemce; seznam HRTC; částka | Ano | = **B(a)** (> 10 000 Kč je volba FINREG). Zákon vyžaduje ex ante. |
| `R09` | § 9a odst. 2 písm. c); § 9 odst. 2 písm. f); § 15 odst. 2; VYHL § 9 odst. 3 písm. c) | Transakce PEP klienta | PEP flag; směr; částka | Ano | = **B(b)** (odchozí > 100 000 Kč je volba FINREG). Zákon pokrývá všechny obchody PEP. |
| `R10` | § 54 odst. 4; § 7 odst. 4; § 9 odst. 5 | Strukturování: více souvisejících transakcí těsně pod prahem (interním nebo pravidla B) v krátkém okně | částka, čas, protistrana; prahy | Ano | Chrání pravidla B a C před obcházením. |
| `R11` | Příloha 2 bod 2 písm. d) | Příchozí platby od mnoha různých plátců (fan-in), neobvyklé pro klienta | počet různých účtů plátce za okno; typ klienta | Ano (spřízněnost neznáme) | Typický mule vzor, doplněk C. |
| `R12` | VYHL § 9 odst. 4 písm. c); VYHL § 7 odst. 2 písm. j) | Chování neodpovídá dosavadnímu průběhu: aktivita po neaktivitě; nový vztah s vysokým objemem | Q2 aktivita; datum uzavření smlouvy; objem červenec | Ano | = **A** pro klienty neaktivní v Q2 (porovnání jen s projekcí). |
| `R13` | VYHL § 9 odst. 4 písm. e); příloha 2 bod 2 písm. c) | Klient identifikovaný na dálku nebo bez fyzické přítomnosti | forma uzavření smlouvy | Ano | Faktor priority a profilu, ne samostatný alert. Zákon u § 11 odst. 7 vyžaduje zesílenou kontrolu. |
| `R14` | VYHL § 7 odst. 2 písm. e); příloha 2 bod 3 | Geografické riziko protistrany mimo seznam HRTC (sankcionované země, korupce, interní seznam) | země plátce a příjemce; interní seznam rizikových zemí | Částečně: potřeba interní seznam | Rozšíření B, nižší váha. |
| `R15` | § 6 odst. 2; § 8 odst. 8; VYHL § 12; ZPMS | Shoda se sankčním seznamem | jména a identifikátory osob | Ne: data jsou anonymizovaná | Samostatný screening modul, externí flag. |
| `R16` | ZOPH § 4 odst. 1 | Hotovostní platba nad 270 000 Kč | typ transakce, částka v CZK | Částečně: jen pokud `typ` rozlišuje hotovost | Indikátor. |
| `R17` | § 6 odst. 1 písm. g), i), j) | Zastírání totožnosti, pochybné ID údaje, odmítnutí kontroly | KYC události | Ne | Externí vstup z KYC procesu. |
| `R18` | § 6 odst. 1 písm. d) | Převody bez zjevného ekonomického důvodu: round-tripping (peníze se vrací stejné protistraně), opakované FX bez důvodu | protistrany, měna, časová posloupnost | Částečně | Kandidát na agentní pravidlo. |
| `R19` | § 6 odst. 1 písm. f) | Účet využíván v rozporu s účelem: FO s obraty a počtem protistran typickými pro podnikání | typ klienta; počet protistran; objem; případně MCC | Částečně | Kandidát na agentní pravidlo. |
| `R20` | § 9 odst. 2 písm. d); VYHL § 9 odst. 4 písm. c) | Kombinace více slabých signálů u jednoho klienta (více alertů, různá pravidla) | výsledky ostatních pravidel; risk score | Ano | Odpovídá FINREG „several flags on the same client“. Agregace, ne detekce. |

## 13. Procesní požadavky na správu pravidel

| ID | Požadavek | Ustanovení | Typ | Dopad na systém |
| --- | --- | --- | --- | --- |
| `P01` | Ruleset je součástí SVZ jako podrobný výčet znaků a metodika monitoringu. | § 21 odst. 5 písm. a); BM kap. I.ii, pozn. 15 | Zákon / BM | Export ruleset s lidskými přepisy jako příloha SVZ. |
| `P02` | SVZ a hodnocení rizik schvaluje statutární orgán. | § 21 odst. 2 | Zákon | Delegace schvalování pravidel musí být popsaná v SVZ. |
| `P03` | Změny SVZ se oznamují FAÚ (u bank a investičních firem ČNB) do 30 dnů od přijetí. | § 21 odst. 8 | Zákon | Ověřit, zda nová verze pravidla je změnou SVZ. Pokud ano, systém má hlídat lhůtu. |
| `P04` | Postupy pro vypracování, přijetí, změnu a zavedení vnitřních předpisů. | VYHL § 4 odst. 1 | Vyhláška | Stavový model pravidla (`draft` → `pending_for_review` → `active`). |
| `P05` | Minimální intervaly revize; revize při změně předpisů, NRA, strategie nebo hodnocení rizik; záznam výsledku a důvodů i bez změny. | VYHL § 4 odst. 4–6 | Vyhláška | Datum příští revize per pravidlo; log „zkontrolováno, beze změny, důvod“. |
| `P06` | Kritéria neobvyklého obchodu jsou stanovena v SVZ. | VYHL § 9 odst. 5 | Vyhláška | Pravidla A s lidským přepisem prahů. |
| `P07` | Odůvodnění prahů, segmentace podle typu klienta. | BM kap. I.ii, pozn. 16; kap. II.i | BM | Pole „odůvodnění prahu“ ve verzi pravidla. |
| `P08` | Průběžné vyhodnocování efektivity scénářů. | BM kap. II.i; VYHL § 19 odst. 1 písm. a) | BM / vyhláška | Metriky per pravidlo a verze (počty alertů, FP, REVIEW, oznámení). |
| `P09` | Aktualizace parametrických seznamů (země, typy transakcí). | BM kap. I.ii; § 9 odst. 1 písm. a) bod 3 | BM / zákon | Verzované seznamy s datem účinnosti a zdrojem. |
| `P10` | Ověřování úplnosti a správnosti vstupních dat. | BM kap. I.ii, II.i | BM | Validace dat, chyby v trace. |
| `P11` | Whitelist jen individuálně, s odůvodněním, schválením a pravidelnou revizí; žádné plošné vyřazení. | BM kap. III.ii; § 13 | BM / zákon | Whitelist záznam = odůvodnění + schvalovatel + datum revize + audit. Zákaz pro povinná pravidla B (ověřit). |
| `P12` | Interní převody nevyřazovat plošně. | BM kap. II.ii; § 4 odst. 1 | BM / zákon | Pravidla zahrnují transakce mezi klienty instituce. |
| `P13` | Lhůta pro šetření v interním předpisu; běží od vygenerování alertu; alerty se negenerují v pozdních dávkách. | VYHL § 17a; BM kap. III.i; MP4 s. 8 | Vyhláška / BM | SLA na AML událost od `created_at`. |
| `P14` | Prioritizace alertů podle RBA. | BM kap. III.ii | BM | Priorita 0–100. |
| `P15` | Uzavření alertu s odůvodněním a navazujícím opatřením. | BM kap. III.iii; § 16 odst. 1 písm. f) | BM / zákon | `reason` + `log` povinné; nelze uzavřít bez odůvodnění. |
| `P16` | Oznámení FAÚ bez zbytečného odkladu (< 5 kalendářních dnů), postup popsaný v SVZ, určené osoby. | § 18 odst. 1; § 21 odst. 5 písm. f); MP4 s. 7 | Zákon / FAÚ | Stav „oznámení FAÚ“ s lhůtou; role kontaktní osoby. |
| `P17` | Zpětná rekonstruovatelnost: kdo, kdy, co, výsledek, podklady, důvody. | VYHL § 18; § 16 odst. 3 | Vyhláška / zákon | Neměnný audit log; vyhodnocení odkazuje na verzi pravidla, seznamů a dat. |
| `P18` | Uchovávání 10 let od ukončení vztahu; pak výmaz. | § 16 odst. 1, 2, 5 | Zákon | Retenční politika; od 10. 7. 2027 ověřit přechod na 5 let (AMLR čl. 77). |
| `P19` | Rekonstruovatelnost IS/IT: verze, zapnutí a vypnutí funkcí, přístupová práva; rekonstrukce alertů k danému okamžiku. | BM kap. II.v | BM | Log změn stavu pravidla a konfigurace; snapshot verzí. |
| `P20` | Need-to-know a oddělení neslučitelných rolí; mlčenlivost. | BM kap. II.v; § 38 | BM / zákon | RBAC; omezený přístup k AML událostem. |
| `P21` | Kontaktní osoba nezávislá na obchodě a vnitřním auditu; pověřená osoba ze statutárního orgánu. | § 22 odst. 4–5; § 22a | Zákon | Role v entitě User; vazba na eskalační matici. |
| `P22` | Souhlas statutárního orgánu nebo pověřené osoby u zesílené kontroly; schválení o úroveň výš. | § 9a odst. 3 písm. d); VYHL § 9 odst. 2 písm. c) | Zákon / vyhláška | Eskalace B alertů na vyšší úroveň. |
| `P23` | Ruční přepsání automatického rizikového hodnocení. | VYHL § 7 odst. 4 | Vyhláška | Override s odůvodněním. |
| `P24` | AI: kvalita dat, vysvětlitelnost, kalibrace, dokumentace, řešení předpojatosti. | BM kap. IV | BM | Verzovaný prompt a model; trace odůvodnění; dokumentace. |
| `P25` | Roční hodnotící zpráva se statistikou oznámení; schvaluje pověřená osoba; uchování 5 let. | VYHL § 19–21 | Vyhláška | Report z dat systému. |
| `P26` | Školení o znacích podezřelých obchodů jednou za 12 měsíců; evidence 5 let. | § 23 | Zákon | Lidské přepisy pravidel jako školicí materiál (návrh). |

## 14. Otevřené otázky / co ověřit s právníkem

1. **Status povinné osoby.** Současný § 2 AML zákona výslovně neuvádí poskytovatele služeb skupinového financování. AMLR je od 10. 7. 2027 uvádí (čl. 3 bod 3 písm. h)). Podle jakého písmene § 2 je povinnou osobou konkrétní instituce (platební instituce, investiční služby apod.)? Vztahuje se na ni vyhláška 67/2018 (instituce podle § 3 odst. 1 písm. a) vyhlášky pod dohledem ČNB)?
2. **Ex post vs. ex ante.** § 9a odst. 2 písm. b) vyžaduje zesílenou kontrolu před obchodem s rizikovou zemí. § 20 a sankční screening předpokládají zásah před platbou. Stačí ex post monitoring s ex ante KYC informacemi podle MP9, nebo je nutná live kontrola?
3. **Whitelist u povinných pravidel.** Lze whitelistovat klienta z pravidel PEP a rizikových zemí? Dovozuji, že ne (§ 13 odst. 1 písm. c) + BM kap. III.ii).
4. **Automatické `FP`.** Je přípustné uzavřít alert jako `FP` bez lidského rozhodnutí? BM zmiňuje automatizované šetření „následně verifikované“. Jaká míra verifikace (100 %, vzorek)?
5. **Prahy pravidla B.** Zákon váže zesílenou kontrolu u PEP a rizikových zemí na každý obchod. Jak odůvodnit prahy 10 000 Kč a 100 000 Kč a omezení B(b) na odchozí platby?
6. **Definice vysoce rizikové země.** Zahrnout jen EU 2016/1675 + FATF call for action (vyhláška), nebo i FATF grey list a interní seznam? Kdy se nová verze seznamu EU začne uplatňovat v systému?
7. **Země původu.** Data mají jednu zemi klienta. Jak řešit § 4 odst. 15 (více zemí původu, skutečný majitel)?
8. **PEP po skončení funkce.** Data nemají datum ukončení funkce. Jak aplikovat § 54 odst. 8?
9. **Změna pravidla = změna SVZ?** Spouští nová verze pravidla oznamovací povinnost podle § 21 odst. 8? Kdo smí schvalovat pravidla, pokud SVZ schvaluje statutární orgán?
10. **LLM generované předpisy a pravidla (wizard).** Jaké minimální lidské schválení a dokumentaci vyžaduje SVZ, aby generovaný obsah mohl být jeho součástí?
11. **Lhůta šetření.** Jakou lhůtu podle VYHL § 17a stanovit pro jednotlivé typy pravidel (dny pro A–C)?
12. **Retence.** 10 let podle § 16 vs. 5 let podle AMLR čl. 77 a GDPR. Který režim použít pro záznamy vzniklé před 10. 7. 2027?
13. **FX přepočet.** § 54 odst. 3 určuje kurz ČNB pro prahy v EUR. Použít stejný kurz pro přepočet všech transakcí na CZK?
14. **Hotovostní limit.** Platí po 10. 7. 2027 český limit 270 000 Kč, nebo limit 10 000 EUR podle AMLR čl. 80?
15. **Sankční zákon 1/2023 Sb.** Neprověřeno. Má dopad na screening?
16. **Česká adaptace AMLR.** Připravuje se nový AML zákon nebo novela? V primárních zdrojích jsem nic nenašel.

### Neověřeno z primárního zdroje

- Obsah bodů II a III přílohy nařízení 2016/1675 (podle sekundárních zdrojů KLDR a Írán).
- Aktuální obsah seznamů FATF (black list, grey list).
- Detailní obsah novel 32/2025, 169/2025 a 218/2025 Sb. ve vztahu k AML zákonu.
- Existence návrhu českého adaptačního zákona k AMLR.
- Zákon č. 1/2023 Sb. (sankční zákon).
- MP4 uvádí v hlavičce datum 26. 8. 2025 a v přehledu verzí 15. 8. 2025. Účinnost 29. 8. 2025. Rozpor jsem neřešil.
- BM cituje vyhlášku „č. 253/2021 Sb.“; e-Sbírka uvádí novelu vyhlášky 67/2018 jako 235/2021 Sb. Jde zřejmě o překlep v BM.
- [README challenge](../finreg/README.md#regulatory-sources) uvádí zmocnění vyhlášky jako § 21 odst. 9. V aktuálním znění je to [§ 21 odst. 10](https://www.zakonyprolidi.cz/cs/2008-253#p21-10).

## 15. Compliance poznámka

Dokument je rešerše pro návrh systému, ne právní stanovisko. Parafráze ustanovení nenahrazují jejich znění. Závěry označené jako „dovozuji“ nebo „ověřit“ jsou interpretace autora rešerše. Dokument **musí** před použitím pro reálné nastavení monitoringu zkontrolovat compliance officer a právník. Výstupy systému jsou podkladem pro rozhodnutí, ne finální AML určení.
