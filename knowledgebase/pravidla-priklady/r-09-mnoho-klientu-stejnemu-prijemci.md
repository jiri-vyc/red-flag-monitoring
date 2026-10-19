# R-09 Mnoho klientů platí stejnému příjemci

## Definice

Alert, pokud na jeden `payee_account` pošle během jednoho kalendářního dne odchozí transakci alespoň 40 různých klientů.

Při šetření se posoudí, zda jde o známý obchodní účet (kandidát na whitelist).

**Alert:** 1 alert na účet příjemce a den

## Zdroj

- **Regulace:** [EBA/GL/2021/02](../regulace/plne-zneni/eba-gl-2021-02-rizikove-faktory.md) Obecný pokyn č. 11, body 11.13 b) a 11.7 b) vii.
- **Vnitřní předpis:** [SVZ-06, Čl. 7](../vnitrni-predpisy/svz-06-monitoring-plateb-a-remitenci.md)
