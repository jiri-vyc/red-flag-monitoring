---
title: Rozhovor ke specifikaci – red-flag-monitoring
date: 2026-10-19
language: cs
participants:
  A: člen týmu (jméno neuvedeno)
  B: člen týmu (jméno neuvedeno)
sources:
  - audio: spec/audio/Specka 1.m4a (11:46)
  - audio: spec/audio/Specka 2.m4a (06:26)
method: AssemblyAI EU, model universal-2, language_code=cs, speaker_labels, speakers_expected=2; ruční korekce
raw: spec/transcript/raw/
---

# Rozhovor ke specifikaci

## Jak číst tento přepis

- Formát: `[mm:ss] Mluvčí X:` a promluva. Časy se počítají od začátku příslušné nahrávky.
- Text je opravený strojový přepis. Opravené jsou zjevné chyby ASR, výplňová slova a přeřeky. Obsah a pořadí promluv zůstávají beze změny.
- `[?]` označuje nesrozumitelné nebo nejisté místo. `[pozn.: …]` je vysvětlivka editora, kterou mluvčí neřekl.
- Diarizace je strojová. U krátkých replik může být mluvčí zaměněný.
- „Právník“ nebo „on“ označuje přednášejícího z briefingu FINREG PARTNERS, viz [knowledgebase/finreg/README.md](../../knowledgebase/finreg/README.md).

### Opravy termínů

| ASR | Opraveno na |
| --- | --- |
| Jackaton | hackathon |
| ameloudálost | AML událost |
| vyjadnocení, výhodnocík, vhodnocení | vyhodnocení |
| Expos | ex post |
| life prevention mod | live prevention mód |
| Přehu do kód | přepis do kódu / pseudokód [?] |
| lightness | whitelist |
| šoupat, cítivost | šoupátko, citlivost |
| antita, Entita Pravedlo | entita, entita Pravidlo |

---

## Část 1 (Specka 1.m4a)

**[00:02] Mluvčí A:** Takže vytváříme specifikaci pro náš hackathonový projekt. Říkali jsme si, že entity budou: klient, transakce, regulace, pravidlo…

**[00:26] Mluvčí B:** …předpis. Interní předpis.

**[00:31] Mluvčí A:** Pravidlo může mít vztah buď na regulaci, nebo na interní předpis. Když je to něco tvého, něco custom, je to interní předpis a podle něj postavíš pravidlo. Když je to dané zákonem, je to regulace a pravidlo vzniká čistě z regulace.

**[01:01] Mluvčí B:** Jo. A teď…

**[01:03] Mluvčí A:** Pravidlo by bylo nadřazené, jenomže…

**[01:07] Mluvčí B:** Pravidlo může vzniknout buď z regulace, nebo…

**[01:10] Mluvčí A:** …[?]

**[01:13] Mluvčí B:** Nebudeme se přerušovat, dokud neřekneme. Nebudu ti do toho skákat. Dáme dohromady celou specifikaci a na konci ji zpracujeme.

**[01:30] Mluvčí A:** Další věc je aktualizace. Očekávám, že když se regulace změní, můžu podle toho aktualizovat pravidlo. A když regulace přibude, můžu ji jako uživatel přidat a vytvoří se podle ní nové pravidlo. Pravidla mají minimálně jeden, možná více typů. Jeden typ je deterministický. Technicky ještě nejsme rozhodnutí, ale může to být třeba kus JavaScriptu, který se někde spustí. Máme tedy jasný kontrakt vstupů a výstupů. Možná budou i pravidla, která nebudeme chtít dělat deterministicky. Budou víc fuzzy a bude je vyhodnocovat agent.

**[02:31] Mluvčí B:** Jasně, to tam bude definované. Bude to vlastně spíš prompt pro agenta, který se pustí nad daty, která má k dispozici. Bude to pravděpodobně méně přesně definované.

**[02:53] Mluvčí A:** Ještě nějaká další entita… Transakci už jsme říkali. Když nějaká transakce neprojde pravidlem, je to nějaká AML událost, řekněme, ne?

**[03:10] Mluvčí B:** AML událost asi vždycky celkově, ne? Jako výsledek toho vyhodnocení. Jedno vyhodnocení.

**[03:18] Mluvčí A:** Jo, vyhodnocení, jasně.

**[03:20] Mluvčí B:** A vyhodnocení vyhodnocuje každé pravidlo. Každé pravidlo může zatím mít jen škálu 0 až 100. Do budoucna by teoreticky mohla být pravidla, která mají jiný výstup…

**[03:35] Mluvčí A:** True/false.

**[03:37] Mluvčí B:** …ale zatím může mít jen škálu 0 až 100.

**[03:40] Mluvčí A:** Nebo 0 až 1.

**[03:41] Mluvčí B:** A pak nějaký log.

**[03:48] Mluvčí A:** Trace. To by mohla být entita vyhodnocení. Jedno vyhodnocení je trace, který má vztah na transakci a možná na jednoho nebo více klientů. Teoreticky můžou být klienti propojení mezi sebou. Nebo je to vždycky jeden?

**[04:10] Mluvčí B:** Jde o to, jestli vyhodnocení bude per klient, nebo jestli se bude pouštět hromadně nad daty. Kdyby bylo per klient, šlo by vyhodnocení na člověka z compliance. Ten chce vidět jedno vyhodnocení a mít k němu podklady.

**[04:35] Mluvčí A:** Jasně. Jednu transakci dělá vždycky jeden klient. V podkladech nebo metadatech ale teoreticky může být nalinkovaný jiný klient, pokud je náš.

**[04:47] Mluvčí B:** Jeden záznam vyhodnocení bude ale vždycky pro jednoho klienta. Compliance officer to hodnotí z pohledu: koukám se na jednoho člověka, jestli je to podezření.

**[05:04] Mluvčí A:** Spíš koukám na jednu transakci jednoho klienta. Ale jak říkali ve slidech, musím koukat na široký kontext. V entitě vyhodnocení by tedy mělo být nalinkováno co nejvíc, abys při zobrazení věděl všechny relevantní informace. Třeba které pravidla prošla, které neprošla, případně s jakým skóre.

**[05:35] Mluvčí B:** Jde o to, jak bude vyhodnocení fungovat. Jestli ho chceme spouštět po každé transakci…

**[05:45] Mluvčí A:** Nebo batchově.

**[05:48] Mluvčí B:** …a jestli ho spouštět per pravidlo. Buď máš vyhodnocení, které se vztahuje k jednomu pravidlu, nebo pustíš všechna pravidla a vyhodnotíš je nějak dohromady.

**[06:02] Mluvčí A:** Myslel jsem spíš: jedna transakce je většinou jedno vyhodnocení. Možná vždycky.

**[06:14] Mluvčí B:** Takže i kdybychom to dělali batchově, dělali bychom to pro každou transakci. Transakci vyhodnotí všechna pravidla, která se na ni vztahují [?].

**[06:25] Mluvčí A:** A z toho je jedno vyhodnocení. Když batchově zpracuješ 100 transakcí, máš 100 vyhodnocení.

**[06:33] Mluvčí B:** Jo, a každé vyhodnocení bude krát tolik, kolik máme pravidel. Když budeš mít 100 transakcí a 100 pravidel, máš 10 000.

**[06:45] Mluvčí A:** No…

**[06:48] Mluvčí B:** …nebo sto vyhodnocení.

**[06:49] Mluvčí A:** Sto vyhodnocení. Myslel jsem to tak, že vidíš, že transakce splňuje osm pravidel. Vyhodnocení obsahuje: osm z deseti pravidel prošlo, dvě neprošla, tady je jejich skóre. A k tomu máš nalinkovaný kontext. To je podle mě jedno vyhodnocení.

**[07:10] Mluvčí B:** Problém podle mě je, že ke každému vyhodnocení pravidla potřebuješ jiný kontext.

**[07:18] Mluvčí A:** Jasně.

**[07:19] Mluvčí B:** Takže může být skupina vyhodnocení a v ní jedno vyhodnocení per pravidlo, které bude mít vždycky svůj kontext.

**[07:29] Mluvčí A:** Dobře, jasně. Můžeme tomu říkat jinak, třeba „vyhodnocení pravidla“ a „vyhodnocení transakce“, aby to bylo jasné.

**[07:49] Mluvčí B:** Jo, jako run vyhodnocení pro danou transakci v daném čase. Ještě jde o to, jestli chceme každou transakci vyhodnocovat vždy jen jednou.

**[08:03] Mluvčí A:** Zatím bych to postavil tak, že každou vyhodnotíš jednou. To musíš udělat tak jako tak. Na batching se to dá optimalizovat potom. Teď máme CSV se 400 000 transakcemi. Hlídal bych, abychom těch 400 000 transakcí zvládli naší věcí projet. Předčasnou optimalizaci bych nedělal.

**[08:38] Mluvčí B:** Jo. Minimální kontext, který potřebuješ vždycky, je klient a jeho historie. Kdybychom to dělali batchově, můžeme třeba jednou za hodinu vzít transakce, které za tu hodinu danému uživateli přibyly. Klienta vezmeš jednou, protože stejně bereš celou jeho historii. Pravidla budou prohledávat celou historii. Stejně koukáš, jestli tohle nevybočuje, nebo jestli nevybočuje nějaká transakce z minulosti.

**[09:13] Mluvčí A:** Ale když vezmeš jen těch deset nových k vyhodnocení, půjdeš asi one by one, ne? Protože máme vyhodnocení pro transakce.

**[09:28] Mluvčí B:** To je pravda.

**[09:29] Mluvčí A:** Nemáš jedno vyhodnocení pro deset transakcí.

**[09:34] Mluvčí B:** Mohli bychom to udělat i tak, že bys měl vyhodnocení víceméně ke klientovi. Bylo by to vyhodnocení daného klienta v daném čase…

**[09:47] Mluvčí A:** Asi záleží, jak na to koukají banky.

**[09:49] Mluvčí B:** …nad celou jeho historií.

**[09:51] Mluvčí A:** V kontextu historie to bereš určitě vždycky, to je jasné. Ale když bance něco vyskočí a tým má něco checknout, mám pocit, že on [pozn.: přednášející z briefingu] hodně mluvil o jedné transakci. Schválit, nebo neschválit jednu transakci. Ne schválit, nebo neschválit to, co klient dělal včera.

**[10:19] Mluvčí B:** Jasně, to jsou ty dva módy. Nevím, jestli tam budou oba. Buď live prevention mód, kdy pošleš každou transakci ke schválení. Nebo zpětná detekce anomálií.

**[10:37] Mluvčí A:** Taky říkal, že standard je to dělat ex post. Někdo se to už ale snaží dělat just in time, nebo jak je ten správný výraz. To je možná směr inovace, nebo to, co se dnes chce.

**[11:01] Mluvčí B:** Já chci obojí. Ex post je asi jednodušší a nemusíš tolik řešit výkon. To ale teď stejně řešit nemusíme, takže můžeme dělat obojí, podle toho, jak se rozhodneme. Jde o to, aby se nic nezapomnělo, třeba když člověk za hodinu udělá 100 transakcí.

**[11:26] Mluvčí A:** Chápu. Pro našich pár hodin bych to ale vůbec nebral jako omezení.

**[11:37] Mluvčí B:** Tak to nechám, první část.

**[11:43] Mluvčí A:** Konec první části specky.

---

## Část 2 (Specka 2.m4a)

**[00:00] Mluvčí A:** Další část konverzace o specce. Bavíme se o pravidlech a o tom, v jaké formě mají být uložená. Myslím si, že to můžou být kusy JavaScriptu. Současně jsme se ale bavili, že je potřeba je nějak schvalovat a případně verzovat. Kdo je bude schvalovat? Právník, asi. Ten ale nebude schvalovat JavaScript. Mohlo by tam být vedle sebe na jedné straně kód a vedle něj summary v lidském jazyce.

**[00:44] Mluvčí B:** Přepis do kódu [?].

**[00:45] Mluvčí A:** Přepis do kódu. Pro dnešní případ česky, napsané tak, aby to zvládl zkontrolovat právník, jednoduše řečeno. Chceme ale, aby to bylo deterministické. Proto to bude uložené ve formě kódu a spoléháme na to, že kód odpovídá popisu.

**[01:15] Mluvčí B:** Podle mě tam může být uložené obojí: summary, kterou schválil právník, protože musí být jasné, co schválil, a vedle toho kód. Code review může být v procesu volitelné, každá firma si zvolí. Dnes ho budou dělat asi všichni. Do budoucna, až budou lidé modelům víc věřit, ho dělat nebudou vůbec. Uložené by ale bylo obojí.

**[01:41] Mluvčí A:** Takže entita Pravidlo má asi verzování…

**[01:51] Mluvčí B:** A…

**[01:52] Mluvčí A:** …a každá verze pravidla má nějaké stavy a je potřeba ji schválit. Schvaluje se kód i lidský popis současně. Když se aktualizuje regulace, na kterou je pravidlo navázané, musíme vydat novou verzi pravidla a ta musí znovu projít review. Ještě mě napadá, a to je možná nejisté, označ si to jako nejistotu: pravidla by mohla mít časovou platnost. „Zatím neplatí, ale už to mám v systému.“ To by mohl stačit toggle on/off. Vázat to na datum je možná overkill. Pravidlo prostě vypneš a zapneš. A ještě právník říkal, že některé firmy se chtějí whitelistovat. Nevím, kdo to teď říkal.

**[03:03] Mluvčí B:** Některé klienty.

**[03:03] Mluvčí A:** Některé klienty. Říkal to ten druhý přednášející [?]: u některých klientů chtějí pravidlo custom vypnout. To je podle mě maličkost, která by se jim mohla líbit.

**[03:15] Mluvčí B:** Takže u každého pravidla by byl whitelist.

**[03:18] Mluvčí A:** Jo.

**[03:19] Mluvčí B:** To je docela dobré. Na dashboardu pak bude sekce Pravidla a pravidla tam mají stav. Vidíš, jestli jsou live, nebo třeba for review.

**[03:34] Mluvčí A:** Jo. Ještě jedna věc, o které mluvil. Nevím, jestli to má být přímo v pravidle. Klienty máš rozdělené do několika kategorií, třeba high risk, low risk a tak. Říkal, že u low risk klientů tě některá pravidla skoro nezajímají, třeba custom přísná pravidla. Pravidlo se tedy nemusí aplikovat na všechny risk profily klientů. Zjednodušeně: každá entita klienta má risk profil.

**[04:21] Mluvčí B:** Risk profil může být i neznámý, to u nových klientů ještě nemusíme vědět. A každé pravidlo má určeno, pro jaký risk level klientů se má vůbec spouštět?

**[04:35] Mluvčí A:** Teoreticky to může být přímo obsah pravidla: „pokud je klient low risk, tak XY“. Nebo by to mohla být nativní vazba. To nevím.

**[04:49] Mluvčí B:** Dal bych to spíš nativně přímo na entitu pravidla: pro které klienty…

**[04:54] Mluvčí A:** …je to relevantní.

**[04:56] Mluvčí B:** …je to relevantní, jo. Ještě zmiňovali něco, co by se jim možná líbilo: nějaké šoupátko pro citlivost, jak přísně má pravidlo vyhodnocovat. U low risk klienta mě pravidlo zajímá, až když je to fakt přemrštěné. Když low risk klient limit překročí o 5 miliard, chceš to vidět, jinak ne. Prostě citlivost pravidla.

**[05:26] Mluvčí A:** Možná má pravidlo vždycky nějaké šoupátko. Ne každé, ale volitelně má pravidlo koeficient, se kterým můžeš hýbat. Nevím, jestli s ním chceš hýbat ještě ve vazbě na risk profil. To už je možná overkill.

**[05:49] Mluvčí B:** V MVP bych dal citlivost globálně. Ve výsledku ji zatím můžeme použít tak, že výsledek pravidla na škále 0 až 100 vynásobíme citlivostí. Tím skóre snížíme nebo zvýšíme. Nebo spíš buď snížíme, nebo necháme stejné. Otázka je, jestli citlivost bude v rozsahu 0 až 1, nebo i víc.

**[06:18] Mluvčí A:** Konec další části.
