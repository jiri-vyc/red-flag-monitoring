# TODO web

Odložené úkoly pro `src/web`. Nálezy jsou z code review první implementace (2026-10-19).

## Minor nálezy z review

- [ ] **Neznámá měna v mocku** (`mocks/evaluation/fxRates.ts`): `convertToCzk` měny mimo tabulku tiše přepočítá kurzem 1, takže prahová pravidla vyhodnotí částku špatně. Takový řádek označit jako neplatný, nebo ho dát do TO CHECK s poznámkou „neznámý kurz“. Na živém API je potřeba oficiální kurz (ČNB fixing), to je otevřená otázka pro compliance.
- [ ] **Prázdná částka** (`mocks/evaluation/csvTransactions.ts`): `Number("")` dává `0`, takže řádek projde jako transakce s nulovou částkou. Má se počítat do `invalidRowCount`.
- [ ] **Odkaz na detail transakce** (`features/batches/components/BatchTransactionList.tsx`): `detailHref` neobaluje transactionId do `encodeURIComponent`. ID se znaky `/`, `?` nebo `#` rozbije routu.
- [ ] **Duplicitní ID transakcí v jednom CSV**: vznikají duplicitní React klíče a detail vždy otevře první shodu. Duplicity odhalit při parsování.
- [ ] **`formatDate`** (`lib/format.ts`): chybí kontrola na `NaN`, jakou už má `formatDateTime`.
- [ ] **4-eyes princip** (`features/rules/domain/ruleLifecycle.ts`, `config/currentUser.ts`): autor a schvalovatel je stejný `CURRENT_USER` a draft se dá schválit napřímo bez `submit_for_review`. Pro MVP bez loginu to stačí, ale před ostrým nasazením to musí posoudit compliance (kdo smí schválit pravidlo, oddělení rolí).
- [ ] **Zablokovaný localStorage** (`mocks/store/mockDatabase.ts`): `readStorageItem` volá `getItem()` mimo try/catch. V privátním režimu nebo při SecurityError proto letí obecná `Error` místo `ApiError` typu `storage`. Aplikace nepadá, jen se ukáže jiná chyba.
- [ ] **URL regulace** (`features/wizard/sourceForm.ts`, `features/regulations/types.ts`): `z.url()` pustí i `javascript:`. Omezit protokol na http/https ve formuláři i v `regulationSchema.sourceUrl`.
- [ ] **Neexistující datum v CSV**: už opraveno (`31.02.` se odmítne). Ověřit, že stejná kontrola platí i na živém API.
- [ ] **Schválení reaktivuje vypnuté pravidlo** (`ruleLifecycle.ts`, `approveRule`): nová verze vypnutého pravidla jde do `pending_for_review` a po schválení je pravidlo vždy `active`. Rozhodnout s compliance, jestli má zůstat vypnuté, nebo jestli tlačítko má říct, že pravidlo i zapne.
- [ ] **Předvyplnění nové verze** (`RuleDetailScreen.tsx`, `NewVersionEditor`): formulář bere poslední verzi, i když je zamítnutá. Má brát běžící verzi (`findRunningVersion(rule) ?? latestVersion`), jinak se dají omylem znovu poslat zamítnuté hodnoty.
- [ ] **Konfigurace draftu**: u pravidla ve stavu `draft` (výstup wizardu) jde upravit jen obsah. Citlivost a risk profily se před prvním review změnit nedají.
- [ ] **Odkaz uvnitř `<summary>`** (`TransactionEvaluationScreen.tsx`, splněná pravidla): screen readery ho nemusí ohlásit (axe `nested-interactive`). Odkaz přesunout do rozbaleného panelu nebo vedle `<details>`.
- [ ] **Focus ring klikacího řádku** (`BatchDetail.module.css`): spoléhá na `:has()`. Bezpečnější je outline na `.rowLink:focus-visible::after`.
- [ ] **Kopírování z řádku transakce**: odkaz přes celý řádek brání označit a zkopírovat ID klienta nebo částku. Pokud to analytici potřebují, dát buňkám `position: relative; z-index: 1`.
- [ ] **Kontrakt `passedRules`**: API musí u splněných pravidel vracet celé `RuleEvaluation[]` včetně trace, jinak Zod v `live.ts` shodí detail transakce.
- [ ] **Návrhy klientů ve whitelistu** (`RuleWhitelistCard.tsx`): `datalist` bere `SEED_CLIENTS` z mocků, takže v live módu nabízí demo ID. Brát klienty z API, nebo nabídku zobrazit jen v mock módu.
- [ ] **Audit odebrání z whitelistu** (spec M16): odebrání se má zapsat do audit logu, který FE zatím nemá. Schválení a pravidelná revize výjimek (benchmark ČNB 2/2023) taky chybí a musí je posoudit compliance.
- [ ] **Načítání whitelistu u zakázaných pravidel**: `useRuleWhitelist` se volá i při `whitelistAllowed = false`. Přidat `enabled: rule.whitelistAllowed`.
- [ ] **Další rozdíly proti `spec/datovy-model.md`**: risk profil `unknown` (M15 zná jen low/medium/high), verze předpisu a M:N vazba předpis–regulace (M3), nepovinný předpis u pravidla (M4), znění regulace (M1), právní základ s `ref` u každé verze pravidla (M5), referenční seznamy (M9), `base_score` (M7), `code` a `alert_type` u pravidla.
- [x] **Starý klíč v localStorage**: opraveno. Reset i neplatná data smažou všechny klíče `redflag.mock.*`.
- [ ] **Validace mock dat** (`mockDatabase.ts`): `batches[].startedAtMs/durationMs`, obsah `ruleSnapshots`, hodnoty `ruleCheckKinds` (zatím jen `z.string()`) a řádky dávek (jen `Array.isArray`) se nevalidují. Při další změně jejich tvaru hrozí stejný pád jako u `sensitivity`.

## Nitpicks

- [ ] `ruleLifecycle.ts`: `updateDraftContent` hází obecnou `Error` místo `RuleTransitionError`, takže se nepřemapuje na `ApiError` typu `validation`.
- [ ] `mockDatabase.ts`: `isMockDatabase` kontroluje jen klíče `rules` a `batches`. Při každé změně tvaru dat zvýšit verzi klíče v localStorage.
- [ ] `wizard.mock.ts`: texty generované mockem jsou natvrdo česky („RedFlag AI (návrh)“, poznámka ke změně). Jsou to data, ne UI, takže se nepřekládají. Případně sjednotit jazyk mock dat.
- [ ] `ScoreBar.tsx`: `findScoreTone` má natvrdo prahy 75 a 40, které duplikují konstanty v `mocks/evaluation/evaluateTransaction.ts`. Dát je do sdílené konfigurace mimo `mocks/`.
- [ ] `TransactionEvaluationScreen.tsx`: klíč kroku trace je `condition`, takže při stejném textu podmínky vzniknou duplicitní klíče. Přidat index.
- [ ] `TransactionEvaluationScreen.tsx`: `aria-label` u dlaždice se skóre je na `div` bez role. Přidat `role="img"` nebo visually-hidden text.
- [ ] Seznam pravidel ukazuje ve sloupcích Policy a Regulation ID (`pol-pep`, `reg-amld`) místo názvů.

## Chybějící funkce

- [ ] **Audit log**: sekce se všemi akcemi (vytvoření, úprava, schválení a zamítnutí pravidla, nová verze, vyhodnocení dávky, rozhodnutí o AML události). U každé akce kdo, kdy, co, proč a verze pravidla. Podle spec je povinný (sekce 7.7 a 8).
- [ ] **AML události**: seznam a detail (triage FP/REVIEW, priorita 0–100, odpovědná osoba, schvalovatel, stav) a export do povinného CSV podle spec sekce 6. Zpracování událostí je ve spec nice-to-have.
- [ ] **Klienti**: detail klienta s risk profilem, PEP, AML risk score, projektovanými a historickými objemy a historií transakcí. Proklik z detailu transakce.
- [ ] **Zkontrolovat aktualizace regulací**: tlačítko na dashboardu a u regulací. Pro dotčená pravidla navrhne nové verze ve stavu `update_for_review`. Mock to jen simuluje, scraping je mimo MVP.
- [ ] **Mazání dávek**: hlavně kvůli limitu localStorage v mocku (dnes se při zaplnění musí udělat reset demo dat).
- [ ] **Prahy a konfigurace vyhodnocení z API**: prahy (fail ≥ 40, alert ≥ 75), seznam vysoce rizikových zemí a kurzy jsou zatím demo hodnoty v mocku. Až je bude dodávat API, převzít je odtud.
