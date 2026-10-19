# R-05 Nový klient identifikovaný na dálku s nadměrným obratem

## Definice

Alert, pokud současně platí:

1. `contract_channel` = distant;
2. ke dni začátku měsíce trvá vztah méně než 6 měsíců (od `contract_date`);
3. měsíční objem klienta > 3 × očekávaný měsíční objem.

**Alert:** 1 alert na klienta a měsíc

## Zdroj

- **Regulace:** [Vyhláška ČNB 67/2018](../regulace/plne-zneni/vyhlaska-cnb-67-2018.md) § 9 odst. 4 písm. e); [AML zákon 253/2008](../regulace/plne-zneni/zakon-253-2008-aml.md) § 6 odst. 1 písm. e)
- **Vnitřní předpis:** [SVZ-03, Příloha 1, R-05](../vnitrni-predpisy/svz-03-monitoring-transakci.md)
