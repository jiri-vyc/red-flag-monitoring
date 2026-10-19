# TM-06 Neobvyklý počet plátců

## Definice

Alert, pokud klient v jednom kalendářním dni přijme příchozí platby od alespoň 7 různých účtů plátců (`payer_account`).

**Alert:** 1 alert na klienta a měsíc

**Společné konvence:** Částky v CZK (L = 1 000 EUR = 25 000 CZK). `outgoing` a `remittance` = odchozí. Sledované období = kalendářní měsíc.

## Zdroj

- **Regulace:** [AML zákon 253/2008](../regulace/plne-zneni/zakon-253-2008-aml.md) § 6 odst. 1 písm. b), f)
- **Vnitřní předpis:** [SVZ-03, Příloha 1, TM-06](../vnitrni-predpisy/svz-03-monitoring-transakci.md)

**Výsledek na datech PoC:** 16 klientů
