# R-13 Neobvyklý nárůst počtu transakcí

## Definice

Alert, pokud měsíční počet transakcí klienta současně překročí F × (`q2_tx_count` / 3) a F × `projected_monthly_tx_count`.

F = 5; F = 3 u klienta s `aml_risk_score` = high nebo `is_pep` = Y. Klient bez transakcí v Q2 se nevyhodnocuje.

**Alert:** 1 alert na klienta a měsíc

## Zdroj

- **Regulace:** [EBA/GL/2021/02](../regulace/plne-zneni/eba-gl-2021-02-rizikove-faktory.md) Obecný pokyn č. 11, body 11.7 b) x. a 11.14
- **Vnitřní předpis:** [SVZ-06, Čl. 11](../vnitrni-predpisy/svz-06-monitoring-plateb-a-remitenci.md)
