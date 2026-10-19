# Features for deterministic rules

Catalogue and calculation of the features that deterministic rule conditions compare (M10, M14). Design, rule coverage and open questions: [spec/features.md](../../../../../spec/features.md).

## Flow per evaluated transaction

1. Once per run: load `fx_rates` into `createFxRateTable(rates)` and build the R-09 index with `createPayeeDayClientIndex(allOutgoingTransactions)`.
2. Once per client: `priceTransactionsChronologically(clientTransactions, fxRateTable)` gives the client's history in CZK, oldest first.
3. Per transaction: `createFeatureContext({ transaction, client, clientHistory, payeeDayClientIndex })` cuts the history at the transaction (no look-ahead, F1).
4. Per rule version: `calculateFeatures({ featureIds: definition.features, context })` returns `features` (plus `tx_fx`) and `contextRefs`.
5. `evaluateRuleDefinition({ definition, features, referenceLists })` in `../ruleConditionEvaluation.ts` returns the `DeterministicTrace`. `matched` → `raw_score = base_score`.

Everything is pure; nothing here touches the database (D18). The whole PoC dataset (398k transactions, 17 sample rules) runs in about 6 s.

## Amounts in CZK

Amounts convert with the ČNB rate on the transaction date, or the last published rate on weekends and holidays (V11). CZK amounts are not converted.

- **Rates:** `fx_rates` holds rates for 2025 to 2026-10-19.
- **Missing rate:** `MissingFxRateError`. Record it as the rule's `error` outcome.
- **PoC data:** the team decided to keep the conversion, even though `volume` in the PoC dataset behaves like CZK already. The sample rule counts in the knowledgebase therefore do not reproduce (see [spec/features.md, section 4](../../../../../spec/features.md#4-ověření-na-poc-datech)).

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
7. Add a test in `calculateFeatures.test.ts`.

## Condition DSL (`../ruleDefinition.ts`)

- A condition node is a comparison `{ id, label, left, op, right }` or a group `{ id, label, match, conditions }`. Groups nest without limit. Ids are unique across the tree.
- Operands:
  - `{ feature }`
  - `{ value }`
  - `{ list }`: reference list code, right side only, with `in` or `not_in`.
  - `{ expr: "<number> × <feature>" }`: the only expression form.
- `findRuleDefinitionViolation` (called from `findRuleLogicViolation`) checks a definition against this catalogue when a rule version is created.
- Reference lists seeded on `main`:
  - `HRJ`: R-02, R-16.
  - `EEA`: R-15.
  - `EU_HRTC`, `FATF_BLACK`, `FATF_GREY`: the parts of `HRJ`.

## Calendar

Day, week (ISO) and month keys use the Date's local fields. This matches how pg parses `transactions.ts` (timestamp without time zone). Hour windows use epoch milliseconds, so a DST switch inside a window shifts it by an hour.
