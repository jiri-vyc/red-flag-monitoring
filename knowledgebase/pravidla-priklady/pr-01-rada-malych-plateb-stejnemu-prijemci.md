# PR-01 Řada malých plateb stejnému příjemci

## Definice

Alert, pokud klient v klouzavém okně 7 dní provede na stejný `payee_account` alespoň 3 odchozí transakce, každou nižší než L, a jejich součet je alespoň L.

**Alert:** 1 alert na dvojici klient–příjemce a měsíc

**Společné konvence:** Částky v CZK (L = 1 000 EUR = 25 000 CZK). `outgoing` a `remittance` = odchozí. Sledované období = kalendářní měsíc.

## Zdroj

- **Regulace:** [EBA/GL/2021/02](../regulace/plne-zneni/eba-gl-2021-02-rizikove-faktory.md) Obecný pokyn č. 11, bod 11.13 a)
- **Vnitřní předpis:** [SVZ-06, Čl. 5](../vnitrni-predpisy/svz-06-monitoring-plateb-a-remitenci.md)

**Výsledek na datech PoC:** 4 klienti
