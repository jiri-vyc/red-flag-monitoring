# R-14 Vysoký souhrn remitencí mimo účet

## Definice

Alert, pokud součet remitencí (`tx_type` = remittance) klienta za měsíc ≥ 375 000 CZK (15 000 EUR).

U klienta s `aml_risk_score` = high nebo `is_pep` = Y je limit 187 500 CZK (7 500 EUR).

**Alert:** 1 alert na klienta a měsíc

## Zdroj

- **Regulace:** [EBA/GL/2021/02](../regulace/plne-zneni/eba-gl-2021-02-rizikove-faktory.md) Obecný pokyn č. 11, body 11.5 c), 11.6 a) a 11.14; [AML zákon 253/2008](../regulace/plne-zneni/zakon-253-2008-aml.md) § 9 odst. 1 písm. a) bod 1
- **Vnitřní předpis:** [SVZ-06, Čl. 12](../vnitrni-predpisy/svz-06-monitoring-plateb-a-remitenci.md)
