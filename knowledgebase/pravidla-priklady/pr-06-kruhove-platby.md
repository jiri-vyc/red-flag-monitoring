# PR-06 Kruhové platby se stejnou protistranou

## Definice

Alert, pokud klient pošle odchozí transakci na účet X a do 72 hodin (před ní nebo po ní) přijme příchozí transakci z téhož účtu X, přičemž obě transakce mají částku ≥ L.

**Alert:** 1 alert na klienta a měsíc

**Společné konvence:** Částky v CZK (L = 1 000 EUR = 25 000 CZK). `outgoing` a `remittance` = odchozí. Sledované období = kalendářní měsíc.

## Zdroj

- **Regulace:** [EBA/GL/2021/02](../regulace/plne-zneni/eba-gl-2021-02-rizikove-faktory.md) Obecný pokyn č. 11, bod 11.7 b) v.
- **Vnitřní předpis:** [SVZ-06, Čl. 10](../vnitrni-predpisy/svz-06-monitoring-plateb-a-remitenci.md)

**Výsledek na datech PoC:** 33 klientů
