# TM-02 Vysoce riziková jurisdikce

## Definice

Alert pro každou transakci s částkou > 10 000 CZK, kde `payer_country`, `payee_country` nebo země klienta (`country`) je na seznamu vysoce rizikových jurisdikcí (příloha nařízení (EU) 2016/1675 v platném znění + FATF black list a grey list, stav 19. 6. 2026).

**Alert:** 1 alert na transakci

**Společné konvence:** Částky v CZK (L = 1 000 EUR = 25 000 CZK). `outgoing` a `remittance` = odchozí. Sledované období = kalendářní měsíc.

## Zdroj

- **Regulace:** [Vyhláška ČNB 67/2018](../regulace/plne-zneni/vyhlaska-cnb-67-2018.md) § 9 odst. 3 písm. a) a odst. 4 písm. a); [AML zákon 253/2008](../regulace/plne-zneni/zakon-253-2008-aml.md) § 6 odst. 1 písm. h)
- **Vnitřní předpis:** [SVZ-03, Příloha 1, TM-02](../vnitrni-predpisy/svz-03-monitoring-transakci.md)

**Výsledek na datech PoC:** 0
