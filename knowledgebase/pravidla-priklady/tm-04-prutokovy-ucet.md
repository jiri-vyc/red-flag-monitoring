# TM-04 Průtokový účet

## Definice

Pro každou příchozí transakci klienta v čase t:

1. IN = součet příchozích transakcí klienta v okně (t − 24 h, t];
2. pokud IN > 100 000 CZK: OUT = součet odchozích transakcí v okně (t, t + 6 h] na účty, které nejsou účtem žádného plátce z okna IN;
3. alert, pokud OUT ≥ 0,8 × IN.

**Alert:** 1 alert na klienta a měsíc

**Společné konvence:** Částky v CZK (L = 1 000 EUR = 25 000 CZK). `outgoing` a `remittance` = odchozí. Sledované období = kalendářní měsíc.

## Zdroj

- **Regulace:** [AML zákon 253/2008](../regulace/plne-zneni/zakon-253-2008-aml.md) § 6 odst. 1 písm. a), d), f)
- **Vnitřní předpis:** [SVZ-03, Příloha 1, TM-04](../vnitrni-predpisy/svz-03-monitoring-transakci.md)

**Výsledek na datech PoC:** 16 klientů
