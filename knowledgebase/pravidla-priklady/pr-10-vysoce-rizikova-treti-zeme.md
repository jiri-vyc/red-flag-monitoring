# PR-10 Převod z/do vysoce rizikové třetí země

## Definice

Alert pro každou transakci bez ohledu na částku, kde `payer_country` nebo `payee_country` je na seznamu vysoce rizikových třetích zemí (stejný seznam jako TM-02).

**Alert:** 1 alert na transakci

**Společné konvence:** Částky v CZK (L = 1 000 EUR = 25 000 CZK). `outgoing` a `remittance` = odchozí. Sledované období = kalendářní měsíc.

## Zdroj

- **Regulace:** [EBA/GL/2021/02](../regulace/plne-zneni/eba-gl-2021-02-rizikove-faktory.md) Obecný pokyn č. 11, body 11.11 d), 11.13 e) a 11.15
- **Vnitřní předpis:** [SVZ-06, Čl. 14](../vnitrni-predpisy/svz-06-monitoring-plateb-a-remitenci.md)

**Výsledek na datech PoC:** 0
