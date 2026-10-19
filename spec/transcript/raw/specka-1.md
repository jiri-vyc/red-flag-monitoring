# Specka 1 – surový přepis (ASR)

> Strojový výstup AssemblyAI (`universal-2`, `cs`, diarizace 2 mluvčí, průměrná confidence 0.7). Needitováno. Opravená verze: [../transcript.md](../transcript.md).

**[00:02] Mluvčí A:** No takže vytváříme specifikaci pro náš Jackaton projekt. Takže ty entity jsme si říkali, že budou klient, transakce, regulace, pravidlo,

**[00:26] Mluvčí B:** předpis, Jo, interní předpis.

**[00:31] Mluvčí A:** A jako pravidlo může mít vztah buď na regulaci, anebo teoreticky na předpis. Buď je to něco tvýho, něco custom, tak tím pádem je to interní předpis a ty podle toho postavíš to pravidlo. A nebo je to něco dané zákonem, takže to je regulace, takže to je jako pravidlo čistě vzniklý z regulace.

**[01:01] Mluvčí B:** Jo. No, a teď. ...že

**[01:03] Mluvčí A:** pravidlo by bylo jako nadrazený, jenomže jako

**[01:07] Mluvčí B:** pravidlo může vzniknout pojď se regulace, nebo

**[01:10] Mluvčí A:** vzniknut pravidlo je pravidla.

**[01:13] Mluvčí B:** Bude nepřerušují, dokud tě neřekneme. Já myslím, že nebudu ti na toho skákat, protože tam můžeme řeknout, Super, tak proč jen. Máme si dohromady celou specifikaci, pak to zpracujeme na konci.

**[01:30] Mluvčí A:** Takže to je aktualizace. Čekávám, že když se nějaká regulace změní, tak se podle toho můžu aktualizovat to pravidlo. A nebo když nějaká regulace přibyde, tak ji můžu jako uživatel přidat a vytvoří se podle ní nový pravidlo. Jo, ty pravidla jsou, jako minimálně, možná více typů, ale jeden ten typ je teda deterministický, což může být, to ještě jako nejsme technicky rozhodnutý, ale může to být teoreticky třeba nějakej kus javascriptu, který se někde spustí. Takže máme nějakej jako jasnej kontrakt, jasnej kontrakt jako vstupů výstupů. Možná jsou i nějaký pravidla, který nebudeme chtít dělat deterministický, ale budou takový víc fazy a bude třeba dělat agent.

**[02:31] Mluvčí B:** Jo, to tam bude definovaný. Jo, jasně. Jo, bude to vlastně více než prompt pro toho agenta, který vám pustí s tím, že jako nad těma datama, které máš v dispozici, bude tam vlastně vůbec nedefinovaný, pravděpodobně.

**[02:53] Mluvčí A:** Tam ještě nějaká entity app, jako pak, pak třeba najisté, můžou být takový ty... Jako když tu transakci už jsme říkali, ale když nějaká transakce teda třeba neprojde tím pravidlem, tak jestli to je nějaká ameloudálost, řekněme, ne?

**[03:10] Mluvčí B:** Jo, asi ameloudálost vždycky celkové, ne? Jakože nějaký výsledek toho vyhodnocení, nebo jedno vyhodnocením.

**[03:18] Mluvčí A:** Jo, vyhodnocení, jasně.

**[03:20] Mluvčí B:** A to vyhodnocení vyhodnoceje prostě každý pravidlo. Každý pravidlo může asi může zatím mít jenom vždycky 0 z toho škála. Jakože asi teoreticky by mohly bejt do budoucna pravidla, který výstupem nemají.

**[03:35] Mluvčí A:** True false.

**[03:37] Mluvčí B:** Ale prostě může zatim mít škálu prostě jen 0 z toho.

**[03:40] Mluvčí A:** Nebo může bejt 0,1.

**[03:41] Mluvčí B:** A pak nějakej login.

**[03:48] Mluvčí A:** Trace, tak to by mohla být antita toho vyhodnocení. Jedno vyhodnocenie je ten Trace, který má vztah na transakci, má vztah na jednoho nebo více klientů možná. Teoreticky si můžou klienti mezi sebou, nebo vždycky je to jeden.

**[04:10] Mluvčí B:** No, jde o to, jestli vyhodnocení bude teda per klient, anebo jestli to bude pouštět nějak veromadně nad datama, jako jestli to vyhodnocením bude per klient, což by mohlo být, jako to vyhodnoceni potom půjde na to člověka z compliance, který to bude Chce vidět jedno vyhodnocení a mít k tomu nějaký podklade.

**[04:35] Mluvčí A:** No jasně, jasně. No tak jako tu jednu transakci dělá jeden klient vždycky, ale jako v těch podkladech nebo v těch metadatech může být nalinkovaný jiný klient, teoreticky, pokud je náš.

**[04:47] Mluvčí B:** Ale to vyhodnocenie se týká vždyckych... jeden záznam vyhodnocení bude pro jednoho klienta. Jakože ten compliance officer hodnotí to z pohledu, koukám se na jednoho člověka, jestli to je podezření.

**[05:04] Mluvčí A:** No spíš koukám se na jednu transakci, která je jednoho klienta, ale jako to, co říkali v těch slidech, že musím koukat na širokej kontext. Takže... V entitě toho vyjadnocení by asi mělo být nalinkováno toho, co nejvíc, aby se potom, když to tam někde zobrazuješ, tak víš všechny ty relevantní informace. Třeba tam právě víš, jaký z těch pravidel prošly, jaký neprošly, případně z jakým scorem. Tam vidíš...

**[05:35] Mluvčí B:** No a jde o to, jestli budeš vyhodnocovat, jak bude fungovat to vhodnocení, jestli teda to chceme způjštět po každým transakci.

**[05:45] Mluvčí A:** Nebo batchově.

**[05:48] Mluvčí B:** Ale potom jako půjští stoper pravidlo. Vždycky máš vyhodnocení, který se vztahuje k jednou pravidlu, anebo máš vyhodnocení, že pustíš všechny pravidla a vyhodnotíš je nějak dohromady.

**[06:02] Mluvčí A:** To jsem spíš myslel. Vyhodnocení je jedna transakce i většinou jedno vyhodnocením. Asi nebo vždycky možná.

**[06:14] Mluvčí B:** Jo, že i kdybychom to dělali batchově, tak bychom to vyhodnili. Jakoby batchově, ale dělali bychom to pro každou transakci, protože transakci vyhodnotí všechny pravidla, které mají na motováze.

**[06:25] Mluvčí A:** A vidíte, z toho je jedno vyhodnocení. Když děláš batchově 100 transakcí, tak z toho máš 100 vyhodnoceních.

**[06:33] Mluvčí B:** No jo, a každý výhodnocík bude mít prostě, bude krát tolik, kolik máme pravidel. Takže když budeš mít 100 transakcí a 100 pravidel, tak máš 10 000.

**[06:45] Mluvčí A:** No...

**[06:48] Mluvčí B:** Sto vyhodnocení.

**[06:49] Mluvčí A:** Sto vyhodnocení, jsem z tých myslel, že ty prostě vidíš, ale tady ta transakce prostě splňuje osm, to vyhodnocení obsahuje to, že prostě, hele, osm ze seti pravidel prošli, dvě neprošli, třeba tady si jim skore. A plus tady máš nalinkovaný kontext, že to je jako by tady to je to jedno vyhodnocený, si říkám.

**[07:10] Mluvčí B:** Tam je podle mě problém, že ty potřebuješ každému vyhodnocením jako různýho pravidla a různej kontext.

**[07:18] Mluvčí A:** Jasně.

**[07:19] Mluvčí B:** Tak může být skupina vyhodnocení a pak jedno vyhodnocený pér pravidlo a to bude mít vždycky svůj kontext.

**[07:29] Mluvčí A:** Tak jo, ok. Dobře, jasně. Takže možná bychom to mohli říkat jinak. Jakože bychom to mohli říkat jako vyhodnocený pravidla a vyhodnocené transakce. Nebo jako... Aby to bylo nějak jasný.

**[07:49] Mluvčí B:** No jo, nějakej jako run toho vyhodnocení pro tu transakci v tom daném čase. Taky jde o to, jestli chceme vyhodnocovat. Transakci každou vždy jednou.

**[08:03] Mluvčí A:** Já bych to možná zatím stavil tak, že vyhodnocuješ každou jednou. Že to musíš udělat tak jako tak, podle mě. A potom se to dá zoptimalizovat na ten batching, si myslím. Že my teď máme CSV 400 000 takhle. Koukal bych se na to, abychom zvládli potom projet tou naší věcí, třeba těch 400 000 transakcí, ale jako celý ten, celý ten, jako vždycky potřebuješ, Nebo nevím, jako nedělal bych prostě předčesný optimal, nebo co, když to tak řeknu.

**[08:38] Mluvčí B:** Jo, ale jako my bysme teoreticky, tyhle děláš stejně vždycky, minimální kontext, který ke všemu potřebuješ, je ten klient, jo, a jeho historie. Takže kdybychom to dělali batchově, tak můžeme třeba prostě jednou za hodinu, no, a prostě jednom, který přibydou za tu hodinu jakože nějaký transakce tady toho uživatele. Tak ho vezmeš jednou, že jo? Protože stejně bereš celou jeho historii. A ty pravidla budou hledat celý tý historii. Stejně koukej, jestli tohle nevybočuje nějak. Nebo jestli nějaká transakce minulosti nevybočuje nějak.

**[09:13] Mluvčí A:** Ale když si vezmeš jenom těch deset novej, na vyhodnocení, tak asi poješ one by one, ne? Vezmeš ok, tak... musí teďka zkontrolovat tu... Protože jste měli to vyhodnocení pro transakce, takže jako...

**[09:28] Mluvčí B:** No, to je pravda, no.

**[09:29] Mluvčí A:** Ty nemáš jakože jedno vyhodnocení pro deset transakce, no.

**[09:34] Mluvčí B:** Asi by jsme to mohli udělat i tak jako tak, že jo? By jsi měl vyhodnocený prostě... Vyhodnocení jakoby ke klientovi víceméně. A bylo by tam jenom vyhodnocením tady toho klienta tady v tom čase.

**[09:47] Mluvčí A:** Asi záleží, jak na to koukají ty banky, no.

**[09:49] Mluvčí B:** Co je celá jeho historie, jo.

**[09:51] Mluvčí A:** Jestli ty banky... No, to jako určitě vždycky bereš v kontekste historie, to je jasný, ale jestli oni jako, když jim tam někde něco vyskočí, nějaký tým tomu člověku, že má něco checknout, tak já mám pocit, že on o tom hodně mluvil, jako o... jako i jedný vždycký transakci, no. Jako schválit, neschválit jednu transakci, ne jakože... Schválit, neschválit to, co on dělal včera.

**[10:19] Mluvčí B:** No jasně, to jsou právě ty dva mody a to nevím, jestli to tam nějak bude mít, jakože, buď ten life prevention mod, nebo něco, jakože to pošliš každý transakci, jako jestli máš schválit, nebo ne. A nebo potom nějakou spětnou detekci anomálí, jako...

**[10:37] Mluvčí A:** On trošku taky říkal, že všichni to dělají ex post, to je standard, ale že někdo už se to snaží dělat just in time, nebo jak je ten správný výraz a to je možná ten Jako směr inovace, ne? Nebo že to je to, co dneska se chce možná? Nevím.

**[11:01] Mluvčí B:** Mně se chce obojí, protože zase právě to Expos bylo asi jednodušší a nemusíš tam tolik brát ohled na nějaký výkon, což my ale stejně teď nemusíme vracet, takže můžeme dělat obojí, nebo jak si to rozmyslíme. Jde o to, aby se to fakt nezaspomnělo, třeba když ten člověk udělá za tu hodinu tých, kterých se akcí 100.

**[11:26] Mluvčí A:** Jako chápu, ale to bych možná vůbec nebral tady pro těch nášich pár hodin jako vůbec omezení.

**[11:37] Mluvčí B:** Tak nechám první.

**[11:43] Mluvčí A:** Tak konec první fáze z Pecky.

