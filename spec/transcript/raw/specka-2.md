# Specka 2 – surový přepis (ASR)

> Strojový výstup AssemblyAI (`universal-2`, `cs`, diarizace 2 mluvčí, průměrná confidence 0.71). Needitováno. Opravená verze: [../transcript.md](../transcript.md).

**[00:00] Mluvčí A:** Která část konverzace o specce? Tak když teď se bavíme o těch pravidlech, že prostě můžou být uložené, jako věky mají být ułožené v formě, tak já si myslím, že to můžou teda být kusy javascriptu, ale současně jsme se teď bavili, že je potřeba se nějak schvalovat, asi verzovat případně a tak. Ale schvalovat to bude kdo, že jo? Právník? Asi. A ten jako nebude schvalovat JavaScript, ale mohlo by tam právě mít jako vedle sebe třeba na jedný straně ten kód a vedle toho by bylo jako summary v tom lidským jazyce.

**[00:44] Mluvčí B:** Přehu do kód.

**[00:45] Mluvčí A:** Přehu do kód. Jakože prostě Česky, jako pro dnešní případ asi Česky prostě by tam bylo To napsané tak, aby to zvládlo zkontrolovat právník, jednoduše řečeno. Ale chceme, aby to bylo deterministické, což znamená, že to bude ale uložené ve formě kódu. A prostě spoleháme na to, že to sedí.

**[01:15] Mluvčí B:** Můžou tam být uložený obojí, podle mě, i tu summary, která byla zkládána tím právníkem. protože musí jasný, co on zkválil a vedle toho ten kód, který třeba v tom procesu každá firma to může jít opšelnou, že chce dělat to code review a dneska to budou třeba dělat všichni, ale do budoucna, až těm modelům budou víc lidi věřit, tak nebudou dělat to code review vůbec. Takže ale v něm by to asi byl tulažený obojí.

**[01:41] Mluvčí A:** Takže Entita Pravedlo má verzování asi

**[01:51] Mluvčí B:** A

**[01:52] Mluvčí A:** každá ta verze toho pravidla musí být... má nějaký stavy a je potřeba ji schválit. A schváluje se teda i její kód, ale i nějaký lidský přepis, jako tady tyhle věci současně. Tak když třeba se aktualizuje ta regulace, na kterou je to pravidlo navázaní, tak musíme vydat i novou verzi toho pravidla, kde teda to musí tou review projít znova. A ještě taky mě napadá, to může být možná nejistuhé, Jako si to označí na jistosti, ale že by ty nutné pravidla mohly mít i časovou platnost. Zatím to neplatí, ale mám to tady už v systému, to by mohlo nastačit jako toggle on-off. Vázat to na datum je možná overkill, tak prostě pravidelné vypnout a zapnout. A ještě ten právník říkal to, že některý firmy se třeba chtějí whitelistovat, nevím kdo to teď říkal.

**[03:03] Mluvčí B:** Některý klienty.

**[03:03] Mluvčí A:** Někteří, to říkal ten týpek, což nebyl, že se chtějí to u některých klientů jako custom vypnout. To si myslím, že je taková jako maličkost, co by se jim mohlo líbit.

**[03:15] Mluvčí B:** Jo, takže u každého pravidla by byl lightness.

**[03:18] Mluvčí A:** Jo.

**[03:19] Mluvčí B:** Jo, to je docela dobrý. No a pak někde na dashboardu, žeho, bude prostě sekce pravidla a tam ty pravidla stejně mají stav, žeho, když tam vidíš, jestli jsou live, nebo jestli jsou třeba jako for review.

**[03:34] Mluvčí A:** Jo, jo. A ještě taky věc, o kterým on mluvil, že Jako nevím, jestli to má být přímo vždycky v tom pravidlu, ale že ty máš jako klienty rozdělený do několika kategorií. Třeba prostě jako high risk, low risk a tak. A u určitý skupiny těch, jako když máš třeba tu low risk, tak on říkal, že vlastně tě ty pravidla skoro nezajímají. Když to jsou nějaký ty prostě custom přísný pravidla něco, takže se to vlastně nemusí aplikovat úplně na všechny ty risk profile, řekněme, těch klientů. Že každá entita klienta má nějaký ten risk profile, když to nás jednodušíme a

**[04:21] Mluvčí B:** taky můžeme být neznámi, že jo, takže to nemusíme vědět ještě u nových klientů. A každé pravidla má pro jaký risk level těch klientů se to má vůbec koušet?

**[04:35] Mluvčí A:** Teoreticky to může být přímo obsah toho pravidla, že se pravidlo zní, že pokud se mlou risk, tak XY Anebo by to mohla být jako přímo nativní vazba, no. To nevím.

**[04:49] Mluvčí B:** To bych dal spíš přímo na ty entity toho pravidla, jakože nativně, pro kterých to má...

**[04:54] Mluvčí A:** U kterých je to relevantní.

**[04:56] Mluvčí B:** U kterých je to relevantní, jo. On tam ještě zmiňovali, což si myslím, že by se jim možná líbilo nějaký šoupat pro toho, jako na citlivost, jako jak moc to má vyhodnocovat, že teoreticky nějaký pravidlo Jakoby, že u těch low risk mě zajímá, dokud to není fakt úplně přemrštěný, jakože low risk prostě to překročí o 5 miliard, potom to chceš, ale jinak ne, nějakou citlivost toho pravidla.

**[05:26] Mluvčí A:** Možná to pravidlo má vždycky nějakou, ne možná každý, ale že opšinu to pravidlo má nějaký šoupátko, nějaký koeficient, který ty si můžeš s ním hejbat. Nevím, jestli ještě s ním chceš hejbat ještě ve vazbě na ten risk profile. To už možná je overkill.

**[05:49] Mluvčí B:** V MVP bych to dal, že cítivost globálně tohle je problém. A ve výsledku to zatím taky můžeme použít tak, že jenom ten výsledek, co to pravděpodobně hodí na té škále 0 a 100, tak jenom vynásobíme tu cítivost. S tím snižíme nebo zvýšíme. Nebo spíš buď snižíme, nebo necháme stejný. Je to taková otázka, jestli obojí bude 0,1 nebo jestli to bude další.

**[06:18] Mluvčí A:** Ok, tak to je část... Konec další části.

