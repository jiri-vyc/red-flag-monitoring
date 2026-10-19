# PR-05 Okamžité přeposlání přijaté částky

## Definice

Alert, pokud po příchozí transakci s částkou ≥ L klient do 2 hodin provede odchozí transakci s částkou 0,9–1,1 × přijaté částky na účet, který není účtem plátce příchozí transakce.

**Alert:** 1 alert na klienta a měsíc

**Společné konvence:** Částky v CZK (L = 1 000 EUR = 25 000 CZK). `outgoing` a `remittance` = odchozí. Sledované období = kalendářní měsíc.

## Zdroj

- **Regulace:** [EBA/GL/2021/02](../regulace/plne-zneni/eba-gl-2021-02-rizikove-faktory.md) Obecný pokyn č. 11, bod 11.7 b) v.
- **Vnitřní předpis:** [SVZ-06, Čl. 9](../vnitrni-predpisy/svz-06-monitoring-plateb-a-remitenci.md)

**Výsledek na datech PoC:** 34 klientů
