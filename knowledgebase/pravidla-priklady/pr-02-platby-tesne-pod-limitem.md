# PR-02 Opakované platby těsně pod limitem

## Definice

Alert, pokud má klient v klouzavém okně 7 dní alespoň 3 transakce (libovolného směru) s částkou v pásmu 22 500–24 999,99 CZK (0,9 × L až pod L).

**Alert:** 1 alert na klienta a měsíc

**Společné konvence:** Částky v CZK (L = 1 000 EUR = 25 000 CZK). `outgoing` a `remittance` = odchozí. Sledované období = kalendářní měsíc.

## Zdroj

- **Regulace:** [EBA/GL/2021/02](../regulace/plne-zneni/eba-gl-2021-02-rizikove-faktory.md) Obecný pokyn č. 11, bod 11.7 b) iv.
- **Vnitřní předpis:** [SVZ-06, Čl. 6](../vnitrni-predpisy/svz-06-monitoring-plateb-a-remitenci.md)

**Výsledek na datech PoC:** 111 klientů
