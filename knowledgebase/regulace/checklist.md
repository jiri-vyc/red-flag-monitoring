# Checklist: plná znění regulací

Zdroj seznamu: `spec/seznam_regulaci.md`. Cíl: plné aktuální znění každého předpisu v `spec/regulace/plne-zneni/`, jeden soubor na předpis. Stav k 2026-10-19.

Kritéria pro každý soubor:

1. **Správný dokument**: číslo a název odpovídají seznamu, ověřeno v textu dokumentu.
2. **Aktuální znění**: nejnovější konsolidace nebo verze, ověřená v oficiálním zdroji.
3. **Kompletní text**: strojové porovnání všech slov zdroje s výsledným markdownem (100 % = každé slovo zdroje je v souboru).
4. **Hlavička**: zdroj, znění, datum stažení, způsob ověření, poznámky.

| # | Předpis | Soubor | Znění | Správný | Aktuální | Kompletní |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Zákon č. 253/2008 Sb. (AML zákon) | `zakon-253-2008-aml.md` | účinné od 11. 1. 2026 (novela 280/2025 Sb.) | [x] | [x] e-Sbírka: AKTUALNI | [x] 100 % proti e-Sbírce |
| 2 | Vyhláška ČNB č. 67/2018 Sb. | `vyhlaska-cnb-67-2018.md` | účinné od 30. 12. 2024 (novela 403/2024 Sb.) | [x] | [x] e-Sbírka: AKTUALNI | [x] 100 % proti e-Sbírce |
| 3 | FAÚ MP č. 4 (Oznámení podezřelého obchodu) | `fau-mp-04-oznameni-podezreleho-obchodu.md` | 26. 8. 2025, účinnost 29. 8. 2025 | [x] | [x] verze na webu FAÚ | [x] 100 % |
| 3a | FAÚ MP č. 9 (Kontrola klienta) | `fau-mp-09-kontrola-klienta.md` | 25. 9. 2025 | [x] | [x] verze na webu FAÚ | [x] 100 % |
| 3b | FAÚ MP č. 11 (Hodnocení rizik a SVZ) | `fau-mp-11-hodnoceni-rizik-svz.md` | 3. 9. 2025 | [x] | [x] verze na webu FAÚ | [x] 100 % |
| 4 | Nařízení (EU) 2024/1624 (AMLR) | `eu-2024-1624-amlr.md` | konsolidace 000.004 vč. opravy C1 z 26. 6. 2026 | [x] | [x] Cellar: bez novel | [x] 100 % |
| 5 | Směrnice (EU) 2015/849 (AMLD) | `eu-2015-849-amld.md` | konsolidace 02015L0849-20241230 (M1–M4) | [x] | [x] nejnovější konsolidace | [x] 100 %* |
| 6 | Směrnice (EU) 2018/843 (AMLD5) | `eu-2018-843-amld5.md` | původní znění (pozměňující akt) | [x] | [x] | [x] 100 % |
| 7 | Směrnice (EU) 2024/1640 (AMLD6) | `eu-2024-1640-amld6.md` | původní znění, bez novel | [x] | [x] Cellar: bez novel | [x] 100 %* |
| 8 | Nařízení (EU) 2023/1113 (TFR) | `eu-2023-1113-tfr.md` | původní znění, bez novel | [x] | [x] Cellar: bez novel | [x] 100 % |
| 9 | FATF Recommendations | `fatf-recommendations.md` | Updated June 2026 | [x] | [x] dle stránky FATF | [x] 100 % |
| 10 | EBA/GL/2021/02 (rizikové faktory) | `eba-gl-2021-02-rizikove-faktory.md` | 1. 3. 2021, CS | [x] | [x] + novely 10a, 10b | [x] 100 % |
| 10a | EBA/GL/2023/03 (novela 2021/02) | `eba-gl-2023-03-novela-rizikove-faktory.md` | 31. 3. 2023, CS | [x] | [x] | [x] 100 % |
| 10b | EBA/GL/2024/01 (novela 2021/02) | `eba-gl-2024-01-novela-rizikove-faktory.md` | 16. 1. 2024, CS | [x] | [x] | [x] 100 % |
| 11 | EBA/GL/2022/05 (compliance officer) | `eba-gl-2022-05-compliance-officer.md` | 14. 6. 2022, CS | [x] | [x] | [x] 100 % |
| 12 | Dohledový benchmark ČNB č. 2/2023 | `cnb-benchmark-2023-02-monitoring-transakci.md` | 3. 7. 2023 | [x] číslo ověřeno v PDF | [x] | [x] 100 % |

\* Rozdíl jen v zápisu horního indexu: „37 a“ → „37a“, „CO 2“ → „CO2“.

## Výjimky a omezení

- **PDF zdroje (3, 3a, 3b, 9–12):** vypuštěna jen opakovaná záhlaví a zápatí stránek (čísla stran, název dokumentu). Mřížka tabulek není zachována, obsah buněk je v odstavcích.
- **FATF (9):** web FATF blokuje automatické stahování. PDF pochází od Eurasian Group a je bajtově shodné s kopií CFATF. S originálem na fatf-gafi.org jsem ho přímo neporovnal.
- **EBA (10–10b):** EBA nevydává konsolidované znění. Aktuální stav je původní text spolu se dvěma novelami.
- **Informativní znění:** konsolidovaná znění (e-Sbírka, EUR-Lex) nejsou právně závazná. Závazné je znění ve Sbírce zákonů a v Úředním věstníku EU.
