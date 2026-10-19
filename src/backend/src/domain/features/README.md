# Features for deterministic rules

Catalogue and calculation of the features that deterministic rule conditions compare (M10, M14). Design, rule coverage and open questions: [spec/features.md](../../../../../spec/features.md).

## Flow per evaluated transaction

1. Once per run: pick an `AmountPricer` and build the PR-03 index with `createPayeeDayClientIndex(allOutgoingTransactions)`.
2. Once per client: `priceTransactionsChronologically(clientTransactions, pricer)` gives the client's history, oldest first.
3. Per transaction: `createFeatureContext({ transaction, client, clientHistory, payeeDayClientIndex })` cuts the history at the transaction (no look-ahead, F1).
4. Per rule version: `calculateFeatures({ featureIds: definition.features, context })` returns `features` (plus `tx_fx`) and `contextRefs`.
5. `evaluateRuleDefinition({ definition, features, referenceLists })` in `../ruleConditionEvaluation.ts` returns the `DeterministicTrace`. `matched` → `raw_score = base_score`.

Everything is pure; nothing here touches the database (D18). The whole PoC dataset (398k transactions, 17 sample rules) runs in about 6 s.

## Amount pricer: pick one per run

- `createFxRateAmountPricer(createFxRateTable(rates))`: ČNB rate on the transaction date, last published rate on weekends (V11). Rates are in `fx_rates`, seeded for 2025 to 2026-10-19.
- `treatAmountAsCzk`: takes `amount` as CZK. **The PoC dataset needs this.** Its `volume` is already in CZK whatever the currency says (SVZ-03, Příloha 2). With FX conversion the sample rules over-alert by orders of magnitude (TM-01 hits all 5,493 clients).

## Adding a feature

1. Add a `FeatureDefinition` to the matching file:
   - `transactionFeatures.ts`: the evaluated transaction.
   - `clientFeatures.ts`: static client data.
   - `historyFeatures.ts`: day, week, month or trailing-window aggregates.
   - `patternFeatures.ts`: multi-transaction patterns.
2. Write `label` and `description` in Czech. They feed the Czech rule text and the wizard prompt (`describeFeatureCatalog()`).
3. Look only backwards. Use `context.historyUntilTransaction`, `listTransactionsBefore` or `listTransactionsInTrailingHours`, never the full history.
4. Return the transactions you used via `toResultFromTransactions` so they end up in `context_refs`.
5. Return `null` when the value makes no sense, e.g. a payee pattern for an incoming payment. Conditions on `null` are false (F6).
6. Put fixed parameters in `thresholds.ts` (F8). Changing one changes detection without a new rule version (see the compliance notes in the spec).
7. Add a test in `calculateFeatures.test.ts`. Re-check the sample rule counts against [knowledgebase/pravidla-priklady](../../../../../knowledgebase/pravidla-priklady/README.md).

## Condition DSL (`../ruleDefinition.ts`)

- A condition node is a comparison `{ id, label, left, op, right }` or a group `{ id, label, match, conditions }`. Groups nest without limit. Ids are unique across the tree.
- Operands:
  - `{ feature }`
  - `{ value }`
  - `{ list }`: reference list code, right side only, with `in` or `not_in`.
  - `{ expr: "<number> × <feature>" }`: the only expression form.
- `findRuleDefinitionViolation` (called from `findRuleLogicViolation`) checks a definition against this catalogue when a rule version is created.
- Reference lists seeded on `main`:
  - `HRJ`: TM-02, PR-10.
  - `EEA`: PR-09.
  - `EU_HRTC`, `FATF_BLACK`, `FATF_GREY`: the parts of `HRJ`.

## Calendar

Day, week (ISO) and month keys use the Date's local fields. This matches how pg parses `transactions.ts` (timestamp without time zone). Hour windows use epoch milliseconds, so a DST switch inside a window shifts it by an hour.
