# TM-01 Nesoulad s profilem klienta

## Definice

Alert, pokud v měsíci platí aspoň jedna podmínka:

- (a) denní objem klienta (součet všech transakcí bez ohledu na směr) > 0,25 × očekávaný měsíční objem (`projected_monthly_volume_czk`);
- (b) denní objem klienta > 3 × (`q2_volume_czk` / 91);
- (c) jednotlivá transakce > 2 × `q2_max_tx_czk`.

Klient bez transakcí v Q2 se posuzuje jen podle (a).

**Alert:** 1 alert na klienta a měsíc

**Společné konvence:** Částky v CZK (L = 1 000 EUR = 25 000 CZK). `outgoing` a `remittance` = odchozí. Sledované období = kalendářní měsíc.

## Zdroj

- **Regulace:** [Vyhláška ČNB 67/2018](../regulace/plne-zneni/vyhlaska-cnb-67-2018.md) § 9 odst. 4 písm. c) a odst. 5; [AML zákon 253/2008](../regulace/plne-zneni/zakon-253-2008-aml.md) § 6 odst. 1 písm. b), d), e)
- **Vnitřní předpis:** [SVZ-03, Příloha 1, TM-01](../vnitrni-predpisy/svz-03-monitoring-transakci.md)

**Výsledek na datech PoC:** 4 669 klientů
