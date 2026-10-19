# PR-09 Remitence mimo EHP od nového klienta

## Definice

Alert pro každou remitenci, kde `payee_country` není stát EHP, částka ≥ L a ke dni transakce trvá vztah s klientem méně než 6 měsíců (od `contract_date`).

**Alert:** 1 alert na transakci

**Společné konvence:** Částky v CZK (L = 1 000 EUR = 25 000 CZK). `outgoing` a `remittance` = odchozí. Sledované období = kalendářní měsíc.

## Zdroj

- **Regulace:** [EBA/GL/2021/02](../regulace/plne-zneni/eba-gl-2021-02-rizikove-faktory.md) Obecný pokyn č. 11, body 11.5 b) a 11.8 a)
- **Vnitřní předpis:** [SVZ-06, Čl. 13](../vnitrni-predpisy/svz-06-monitoring-plateb-a-remitenci.md)

**Výsledek na datech PoC:** 18 transakcí, 17 klientů
