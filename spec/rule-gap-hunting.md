# Ruleset gap hunting (návrh)

Status: **step 1a (deterministic part) built and checked locally, not on `main`**; see 6.7. Step 1b (Bedrock) runs in parallel. A triggered job that takes the active rules and looks for gaps in them. A gap is either a threshold that clients stay just under, sometimes on purpose, or behaviour no rule covers. Builds on [spec.md](spec.md), [features.md](features.md), [datovy-model.md](datovy-model.md) and the engine from #3.

## 1. Goal and boundaries

FINREG's ruleset maintenance points 5 and 6 ask us to verify that red flags are identified correctly and that the ruleset captures all relevant flags. SVZ-03 čl. 11.2 (testing just below each threshold) and čl. 11.5 (coverage of the čl. 7 indicators) put the same duty on the AML compliance officer. The internal policy otherwise focuses on client assessment. This job covers the ruleset side.

The job does two things:

1. **Finds rules that may need adjustment:** a proposed change to an existing rule, or a proposed new rule.
2. **Lists the clients that fall into each gap**, for further research. They are **not** alerts and nobody raises an alert against them. Each client comes with IDs, the transactions behind the finding and a link to the client's profile (the web's client transactions view).

Every finding is anchored to a rule, existing or proposed. Without a rule there is nothing for the officer to act on. The one exception is an `association` finding (4.1). It is anchored to the reason its seed client is high risk, and its typical outcome is a client risk re-assessment rather than a rule change.

The AML officer then decides and acts, all through flows that already exist or are already planned:

| Officer's step | How | New code |
| --- | --- | --- |
| Adjust the rule, if that is the right call | New rule version → review → activation (M11, #8). The finding pre-fills the proposal. | "Create draft version from finding" (iteration 2) |
| Re-run for the clients who fell into the gap | `POST /api/evaluation-runs` with `scope.clientIds` = the finding's clients. This already exists. | none |
| Act on the alerts | The normal alert path: `aml_events` (#13), triage (#14), decision (#17) | none |
| Re-assess the client's risk score (mainly after `association` findings) | Client assessment under the internal policy, outside this job and outside this app today | none here |

The job itself never creates `aml_events`, never triages or escalates, never writes to the mandatory CSV and never touches rule versions. The LLM decides nothing. Any rule it proposes is a draft that the compliance officer approves or rejects.

### Out of scope

The statistics chain rule evaluation → alerts raised → false positives discarded, and feeding it back to balance noise against signal. The job does not read alert outcomes or triage results, and it does not measure its own precision against them.

## 2. What we can build on (state of `main`, 2a07888)

| Building block | Where | Use here |
| --- | --- | --- |
| Pure evaluator: dataset in memory, priced client histories, no look-ahead (F1) | `domain/transactionEvaluator.ts`, `domain/features/` | Re-evaluate rules (current and relaxed) without touching the DB or the run tables. |
| The condition trace evaluates **every** condition, with numeric `left` / `right` values | `domain/ruleConditionEvaluation.ts` | Distance to firing from a `pass` trace, generic for every rule in the DSL. |
| `pass` results keep their trace in memory and are dropped only on write (V16) | `evaluationRunExecutor.ts` `toStoredEvaluation` | Near misses are not in the DB. The job recomputes them. |
| Fixed rule and list versions per run (V5), immutable runs (V14) | `run_rule_versions`, `run_reference_list_versions` | A review is tied to one evaluation run and covers exactly what ran. |
| Run scope with `clientIds` | `RunScope`, `evaluationRunsRouter.ts` | The officer's re-run (step 2) needs no new code. |
| Launcher → executor → Lambda worker | `EvaluationRunLauncher`, `DraftingJobLauncher` | Same plumbing for the new job. The deployed evaluation worker is still open (#4). |
| Bedrock rule drafting into the DSL, validated against the feature catalogue | `BedrockDraftGenerator`, `ruleDraftingPrompt.ts`, `findRuleDefinitionViolation` | Proposed new rules in a form we can backtest. |
| Rule → legal basis, and indicators Z1–Z12 in SVZ-03 čl. 7 | `rule_legal_bases`, `knowledgebase/vnitrni-predpisy/svz-03-…` | Coverage matrix. Z9 (complex payment chains) and Z11 (payments for third parties) have no scenario today. |
| Client link | `transactionsPath({ clientId })` in the web | The link from a finding to the client. |

## 3. Gaps in existing rules (near misses and evasion)

### 3.1 Relaxation caps

One percentage cap does not fit every parameter. The probe in 3.5 shows that how much a 10 % relaxation matters depends entirely on the type of parameter:

- **R-12:** stretching the 72 h window by 25 % adds 4 clients to 33.
- **R-08:** lowering the edge of the near-limit band by 5 % adds 174 clients to 111.
- **R-06:** a count of 7 cannot move by less than one payer, and that one step adds 89 clients to 16.

So the job uses **two caps**. Whichever is hit first stops the relaxation.

**1. How far a parameter may move** (cap by parameter type):

| Type | Examples | Cap | Why |
| --- | --- | --- | --- |
| Amount threshold | R-03 100k, R-04 inflow 100k, R-12/R-15 L, R-14 375k/187.5k, R-07 sum | **10 %** | SVZ-06 čl. 6 (R-08, `P02_BAND_LOW` = 0.9) already defines "just under a limit" as within 10 %, so we use the internal policy's own definition. |
| Time window | R-04 24 h / 6 h, R-11 2 h, R-12 72 h, R-07/R-08 7 days | **25 %** | Windows are calibration values ("okamžitě", "určité trvání"), and the data barely reacts to them. Evading a window means waiting a little longer, and 25 % is about one natural unit: 2 h → 2.5 h, 6 h → 7.5 h, 72 h → 90 h, 7 days → ~9 days. |
| Ratio or multiplier | R-04 0.8, R-11 0.9–1.1, R-13 F, R-05 3×, R-14 limits per risk | **10 %** | Same reasoning as amounts. R-11's lower ratio bound is very sensitive, so the growth cap stops it first. |
| Integer count | R-06 7, R-10 5/7, R-09 40, R-07/R-08 3 | **one unit**, subject to the growth cap | No smaller step exists. These thresholds sit at the 99.9th percentile (SVZ-03 Příloha 2, SVZ-06 čl. 7–8), so one unit lands in the bulk of the distribution. On the PoC data the growth cap blocks every one of them. |
| Band edge | R-08 0.9 × L | **not relaxed** | R-08 already looks for evasion just under L. Widening its band is a new rule (section 4). |
| Categorical, list, boolean | PEP, HRJ, EEA, `tx_type`, risk score, channel | **never** | We do not look for "almost PEP" or "almost a high-risk country". |
| Regulatory value (SVZ-06 marks `regulace`) | `P01_LIMIT`, `P02_LIMIT` (1,000 EUR, TFR) | Relax it to **find clients**, but propose any change only as a new rule. | SVZ-06 čl. 18: a regulatory parameter changes only when the regulation does. A stricter extra rule is allowed. |

**R-01 is excluded.** It already hits 85 % of clients, so a gap there means nothing.

**R-01 to R-04 follow FINREG rules A–C.** Proposals for them are informational for the hackathon, because the mandatory CSV keeps A–C exactly as the brief specifies them. In real use they are calibration values like the others.

**2. How much the result may grow** (growth cap):

- Stop at the last step where the clients added to the rule are at most **max(5, 25 % of the rule's current clients)** and at most **50 clients** in total.
  - The floor of 5 keeps rules with tiny bases usable (R-03 has 3 clients).
  - The ceiling of 50 is about 1 % of the client base, the same cap as for new rules in section 4.
- When a single step already breaks the growth cap, the result is not a gap but a recalibration. That belongs to the annual above-and-below-the-line review (SVZ-03 čl. 11.2), not to this job.
- In that case the job writes a `rule_adjustment` finding with no proposal: the step, the count and "growth cap exceeded". No client list.

**Rules for both caps:**

- **Steps are fine-grained:** 2.5 % for amounts and ratios, 5 % for windows, one unit for counts.
- **The job reports the smallest step that adds clients.** It does not keep relaxing just because it may.
- **Both caps are enforced in code.** An LLM may suggest which parameter to try, but the executor clamps it.
- **The cap values are a proposal** for the compliance officer to confirm **[ROZHODNUTÍ]**. They live in the review job's `params`, so every review records the caps it used.

### 3.2 Two kinds of parameter

1. **Constants in the rule definition** (the DSL: `value`, the multiplier in `k × feature`). They can be relaxed from the trace without recomputing anything. The distance to firing:
   - numeric comparison: the relative gap;
   - `all` group: the largest distance among its unmet children;
   - `any` group: the smallest.

   A `pass` within the cap for its parameter type (3.1) is a candidate, and the step it needs comes straight from the distance. **No change to production code.**
2. **Parameters fixed inside pattern features** (F8, `thresholds.ts`, e.g. R-04's 100,000 CZK minimum inflow and 24 h / 6 h windows, R-11's 2 h, R-12's 72 h, R-08's band).
   - A client who keeps the inflow at 95,000 gets `passthrough_ratio = null`, so (1) never sees them.
   - Fix: feature functions take their parameters, with defaults equal to today's constants, and the job computes the same features with relaxed parameters.
   - This is the only change to detection code. Before the refactor, a **regression test** must lock R-01 to R-17 hit counts on the full dataset and the `features` values of a fixed sample.

### 3.3 From near misses to a finding

A single near miss is noise. A finding needs **repetition** to count as a likely gap:

- the same client under the same parameter on several distinct days or in several distinct pattern instances;
- or several clients under the same parameter, which suggests the threshold rather than the client.

Evasion patterns come out of the same data:

- **Bunching:** a client's share of transactions just under a threshold, compared with their own Q2 profile.
- **Splitting:** sub-threshold payments to one payee whose sum exceeds the threshold.
- **Window hopping:** within the 25 % window cap only.
- **Counterparty rotation.**

**Finding of kind `rule_adjustment`:**

- the rule and its active version;
- the parameter, its current value and the proposed value, with the step;
- the clients who would fire at that step: IDs, number of near misses, distinct days, the transactions;
- the hits it adds, as a count (how much the rule widens, so the officer sees the cost);
- evidence: a trace excerpt per client.

### 3.4 Data probe (CSV, CZK transactions only, `volume` read as CZK)

- **No visible bunching across the whole population.**
  - 9–10k: 5,965 transactions, 10–11k: 5,057.
  - 22.5–25k: 2,350, 25–27.5k: 1,920.
  - 90–100k: 208, 100–110k: 158.
- **103 clients have at least 4 transactions in 20–22.5k.** With a median of 72 transactions per client, that is mostly the base rate.

Raw counts would flood the officer, so the repetition requirement in 3.3 is not optional. The probe ignores FX conversion (V11), so engine numbers will differ.

### 3.5 Sensitivity probe: what the caps let through

How the probe was run:

- A Python reimplementation of the rule examples in `knowledgebase/pravidla-priklady/`, with `volume` read as CZK. That is the reading the SVZ-03 Příloha 2 validation uses.
- Base counts match the README and SVZ validation: R-03 3, R-04 16, R-05 35, R-06 16, R-07 4, R-08 111, R-10 35, R-11 34, R-12 33, R-13 280, R-14 41, R-15 17. R-09 gives 30 payee accounts against 31 in the README.
- One parameter is relaxed at a time, never several together, because relaxations compound.
- The engine converts amounts with FX rates, which gives very different base counts (e.g. R-04 1,077 clients). Phase 0 recomputes the table with the engine.

| Rule | Base | Parameter (type, cap) | Added clients per step | Reach under both caps |
| --- | --- | --- | --- | --- |
| R-03 | 3 | min amount 100k (amount, 10 %) | 5 %: +0, 10 %: +1, 20 %: +2 | 10 %, **+1** |
| R-04 | 16 | min inflow 100k (amount, 10 %) | 5 %: +3, 10 %: +12, 20 %: +30 | 5 %, **+3** |
| R-04 | 16 | outflow window 6 h (window, 25 %) | 5 %: +1, 25 %: +3, 50 %: +6 | 25 %, **+3** |
| R-04 | 16 | inflow window 24 h (window, 25 %) | 10 %: +3, 20 %: +5, 25 %: +6 | 20 %, **+5** |
| R-04 | 16 | ratio 0.8 (ratio, 10 %) | 5 %: +4, 10 %: +5, 20 %: +12 | 10 %, **+5** |
| R-05 | 35 | factor 3× (multiplier, 10 %) | 5 %: +2, 10 %: +5, 20 %: +12 | 10 %, **+5** |
| R-06 | 16 | 7 payers/day (count, 1 unit) | 7 → 6: +89 | **blocked by growth** |
| R-07 | 4 | window 7 days (window, 25 %) | 5 %: +3, 25 %: +5 | 25 %, **+5** |
| R-07 | 4 | sum ≥ L (amount, 10 %) | 5 %: +1, 10 %: +2 | 10 %, **+2** |
| R-08 | 111 | band 0.9 × L (band edge) | 5 %: +174, 10 %: +398 | **not relaxed** |
| R-08 | 111 | window 7 days (window, 25 %) | 5 %: +8, 25 %: +27 | 25 %, **+27** |
| R-09 | 30 accounts | 40 clients/day (count, 1 unit) | 40 → 39: +10 accounts (+33 %) | **blocked by growth** |
| R-10 | 35 | 5 countries/day, 7/week (count, 1 unit) | 5 → 4: +129, 7 → 6: +184 | **blocked by growth** |
| R-11 | 34 | window 2 h (window, 25 %) | 10 %: +7, 20 %: +8, 25 %: +11 | 20 %, **+8** |
| R-11 | 34 | min amount L (amount, 10 %) | 5 %: +4, 10 %: +5 | 10 %, **+5** |
| R-11 | 34 | ratio band 0.9 (ratio, 10 %) | 5 %: +12 | **blocked by growth** |
| R-12 | 33 | window 72 h (window, 25 %) | 10 %: +1, 25 %: +4, 50 %: +11 | 25 %, **+4** |
| R-12 | 33 | min amount L (amount, 10 %) | 5 %: +1, 10 %: +5 | 10 %, **+5** |
| R-13 | 280 | F = 5 (multiplier, 10 %) | 5 %: +23, 10 %: +65 | 5 %, **+23** |
| R-13 | 280 | F = 3 high risk/PEP (multiplier, 10 %) | 5 %: +8, 10 %: +19 | 10 %, **+19** |
| R-14 | 41 | 375k standard (amount, 10 %) | 10 %: +4, 20 %: +17 | 10 %, **+4** |
| R-14 | 41 | 187.5k high risk/PEP (amount, 10 %) | 10 %: +4, 20 %: +7 | 10 %, **+4** |
| R-15 | 17 | min amount L (amount, 10 %) | 10 %: +2, 20 %: +8 | 10 %, **+2** |

What the table shows:

- **Under both caps every rule adds a handful of clients.** The exceptions are R-08's window (+27) and R-13 (+23 / +19), both rules with large bases. That is a list one officer can research.
- **Count thresholds and R-11's ratio band fail on the first possible step.** Relaxing them would be a recalibration, not a gap.
- **A flat 10 % would have been too loose for R-04's inflow** (+12, 75 % growth) and R-11's ratio. It would have been too tight for windows: R-12 needs 25 % to add 4 clients.

## 4. Gaps no rule covers

These findings propose a **new rule**. The relaxation caps (3.1) do not apply, because nothing is being relaxed. A backtest cap applies instead (below). The FINREG recommendation and SVZ-03 čl. 8.3 hold here too: deterministic code computes, and the LLM works over aggregates, never row by row.

| # | Source | Role |
| --- | --- | --- |
| B0 | **Coverage matrix:** čl. 7 indicators (Z1–Z12) and FATF/FAÚ indicators × active rules via legal bases. | Points at uncovered indicators (today Z9, Z11). No client data involved. |
| B1 | **Peer outliers:** client-month profiles from the feature catalogue plus a few new ones (counterparty novelty, in/out symmetry, night-time share, country diversity), compared within a peer group (decided in section 9). Clients extreme on ≥ 2 dimensions and hit by no rule. | Input for B3, not a finding on its own. |
| B2 | **Network across clients:** shared counterparty accounts, chains and cycles across clients (R-12 sees only one client), hubs. | Its own findings of kind `association` (4.1), and input for B3. This is the one thing the per-transaction engine cannot see (D18). |
| B3 | **LLM rule hypotheses (Bedrock):** gets the rule catalogue with legal bases, the uncovered indicators from B0, and aggregates and top clusters from B1/B2 with small samples (see #10). Proposes rules in the existing DSL. | Produces findings of kind `new_rule`. The loop with tools and budget is in 5.2. |

Every B3 hypothesis is **backtested deterministically** before the officer sees it:

- hit count and number of clients;
- overlap with existing rules;
- distribution across risk scores.

It is discarded automatically if:

- it fails DSL validation;
- it overlaps ≥ 80 % with an existing rule (share of its clients that an active rule already hits);
- it hits more clients than a hard cap (proposal: 1 % of clients, ~55).

**Finding of kind `new_rule`:**

- the DSL definition, a Czech description and the indicator it covers;
- the backtest;
- the matching clients with transactions and links.

Accepting it creates a draft rule version, and the officer continues as in section 1.

A hypothesis that needs a feature the catalogue does not have cannot be backtested. It is reported as `coverage_gap` with no clients: a note for a developer to add the feature (M10, PR review).

### 4.1 Guilt by association

Banks look hard for links between new clients and clients who are already high risk. A risk label also changes over time: a client who keeps triggering alerts usually gets their risk score raised. The job therefore starts from **seeds** taken as they stand when the review runs:

- `aml_risk_score = high`;
- PEP;
- clients hit by a serious rule (R-02, R-03, R-04, R-11, R-12) in the reviewed evaluation run.

The job reads hits, never triage outcomes, so it stays outside the excluded statistics loop. R-01 and R-13 are left out as seeds because they hit too many clients to mean anything.

**What the data allows.** No client pays another client directly. Client accounts are the client IDs, and every counterparty is an external `A…` account. Links can only go through **shared counterparty accounts**, and that graph is dense:

- 5,380 external accounts;
- clients per account: median 9, 90th percentile 75, 99th percentile 1,311 (merchants and other hubs).

| Link rule (seeds: 392 high risk ∪ 23 PEP ∪ 80 with serious hits = 477) | Non-seed clients linked | Linked via ≥ 2 accounts |
| --- | --- | --- |
| account used by ≤ 2 clients | 60 | 1 |
| account used by ≤ 3 clients | 192 | 5 |
| account used by ≤ 5 clients | 834 | 80 |
| account used by ≤ 10 clients | 2,735 | 931 |
| account used by ≤ 50 clients | 5,013 | 4,989 |
| money moving seed → account X → other client within 72 h, X used by ≤ 10 clients | 1 | 0 |
| the same through any account (hubs included) | 1,969 | 1,080 |

**Conclusions:**

- **Loose links make everyone associated.** Once hubs count, almost the whole client base is "linked" to a high-risk client.
- **Only links through private accounts carry information.** A private account is one used by at most 3 clients, and a client needs **at least 2** such shared accounts. That leaves **5 clients** on the PoC data, a list an officer can research.
- **No flows through intermediaries are planted in this data.** Money moving through a shared account exists only through hubs, which is noise. So the PoC can show the mechanism, but it cannot prove the strongest signal (Z9 chains, Z11 payments for third parties).

**Proposed caps** (same spirit as 3.1):

- An account counts as a link only if at most **3** clients use it.
- A client needs at least **2** distinct links.
- At most **50** clients per review.
- Flows through intermediaries (seed → X → client within 72 h, amount ≥ L) count as a strong link even when there is only one, but only through private accounts.

**Finding of kind `association`:**

- the linked client;
- the seeds with the reason each one is a seed;
- the shared accounts and the transactions;
- links to the client and the seeds.

**Possible outcomes** for the officer:

- research the client;
- re-assess their risk score (client assessment, outside this job);
- if the same pattern repeats across reviews, a `new_rule` built on a cross-client feature (e.g. "counterparty shared with a high-risk client"). It would use a run-wide index like the one R-09 uses (`payeeDayClientIndex`).

### Validation without labelled data

- The dataset has no labels, so recall cannot be measured directly.
- **Perturbation test (part of CI):** take real hits of R-04, R-11 and R-12 and nudge them just under the rule, staying inside the caps from 3.1. Then check that section 3 finds them.
- It also makes a good demo: "this is how a mule slips under rule C, and this is how the review catches it".
- This tests the detector, not alert outcomes, so it stays outside the excluded statistics loop.

## 5. Bedrock: explaining the gaps and complementing the analysis

The deterministic analysis (sections 3 and 4.1) produces the numbers. Bedrock adds two things on top. Neither changes a deterministic number, a cap or a rule. This is the part that answers "beyond a GPT wrapper": the model reasons over evidence that code computed, and code checks every claim it makes.

### 5.1 Explaining findings (L1)

**One call per finding**, plus one summary of the whole review.

**Input:**

- the rule's label and Czech text, its legal bases and the SVZ article it comes from;
- the parameter with its current and proposed value, the step and the growth numbers;
- for an `association` finding: the seeds with their reasons and the shared accounts;
- the profiles of the top ≤ 10 affected clients as aggregates (type, risk score, PEP, channel, tenure, near-miss count, minimum distance, amounts).

**Output** is structured, through a tool-use schema, written in Czech:

- `summary`: what the gap is;
- `typology`: which evasion or ML pattern it resembles, with the FAÚ/FATF indicator where one applies;
- `adjustmentConsiderations`: arguments for and against changing the rule, including the cost in added hits;
- `investigationSteps`: what to check for the listed clients;
- `citedEvidence`: a list of `{ path, value }` pointing into the finding's evidence.

**Validation:**

- Every `citedEvidence` value must equal the value at that path in the evidence.
- A citation that does not match is a warning shown in the UI, the same idea as `unverifiedQuotes` in drafting.
- The prompt forbids facts that are not in the input.

**Cost:** about 25 findings per review, at most 3 calls at a time. Model `BEDROCK_MODEL_ID`, the same client and auth as drafting (`createBedrockClient`).

### 5.2 Complementing the analysis: hypothesis loop with tools (L2, B3 in section 4)

The model gets these tools and runs a bounded loop through Converse tool use:

| Tool | Returns |
| --- | --- |
| `get_rule_catalogue()` | Active rules: code, label, Czech text, legal bases, parameters. |
| `get_feature_catalogue()` | `describeFeatureCatalog()`: what the DSL can use. |
| `get_coverage_matrix()` | B0: the čl. 7 indicators Z1–Z12 × rules. |
| `get_gap_findings()` | The deterministic findings of this review, without client lists. |
| `get_segment_profiles()` | B1 aggregates per peer group (distributions, extremes), no rows. |
| `get_counterparty_structure()` | B2 aggregates: account degrees, private-account links, flows through intermediaries. |
| `backtest_rule(definition)` | DSL validation errors, or hits, clients, overlap with each active rule, distribution by risk score and client type, and ≤ 10 sample client IDs. |

**What it produces:**

- **`new_rule` hypotheses:** at most 5. Only the ones that pass the backtest caps in section 4 survive (≤ 1 % of clients, ≤ 80 % overlap with an existing rule). Each comes with its rationale, the indicator it covers and a suggested legal basis.
- **`coverage_gap` notes:** a hypothesis needs a feature the catalogue does not have.
- **Critiques of deterministic findings,** for example "probably a calendar artefact". These are stored as comments next to the finding and change nothing in it.

**Hard budget, enforced by the executor:**

- at most 20 tool calls;
- at most 150k input and 20k output tokens;
- 5 minutes of wall clock.

When the budget runs out, the loop stops and keeps what it has.

### 5.3 Guardrails for both

- **The LLM decides nothing.** Hypotheses are proposals. A rule exists only after the compliance officer approves a version (M11).
- **The model sees aggregates and at most 10 sample client IDs per tool result, never full histories** (FINREG, SVZ-03 čl. 8.3, #10). The dataset is synthetic and has no names.
- **The calls go to Bedrock in the team account `526983806399`** with the existing drafting auth, so no data leaves the hackathon environment.
- **Audit:** every prompt, tool call, tool result, response, model ID and token count is stored in the report's `llm` section.
- **A Bedrock failure never fails the review.** The deterministic findings stand, and the report records the error.

## 6. Iteration 1: standalone, local, no migration

### 6.1 Why it must be async, and why not like drafting jobs

- **Too slow for a request:**
  - one evaluator pass over the dataset takes ~6 s in the domain and ~45 s with DB writes against local Docker;
  - the review needs one pass for the trace margins plus targeted re-runs for each feature-parameter step, about 60 of them on single rules;
  - then the Bedrock calls.
  - That is minutes. A Web Function would time out, and work after the response is not guaranteed there (#4).
- **Why not reuse drafting jobs:** they keep state in `drafting_jobs`. A new `kind` would mean a migration on an existing table, against the "touch no existing tables" goal.
- **What we do instead:** the review writes **one report document**, and the document itself carries the status. The web starts a review and polls the document.

### 6.2 Report store instead of tables

- **Port:** `RuleReviewReportStore`, with `save(report)`, `find(id)` and `list()`.
- **Locally:** `FileSystemRuleReviewReportStore` writes JSON to `RULE_REVIEW_DIR` (default `src/backend/.rule-reviews/`, git-ignored).
- **Deployed:** a file store does not work on Lambda, because its filesystem is ephemeral. Iteration 2 chooses between an S3 bucket (Object Lock covers the 10-year retention) and new tables (section 7).
- **The report is immutable once `completed` or `failed`.** While `running` it is rewritten with progress.
- **Stuck reviews:** a report still `running` after 20 minutes is shown as failed.
- **Only one review runs at a time.**

Report shape. This is the contract between the deterministic part and the Bedrock part, so both can be built at the same time:

```ts
type RuleReviewReport = {
  id: string;
  status: "running" | "completed" | "failed";
  startedAt: string;
  finishedAt: string | null;
  errorMessage: string | null;
  createdBy: string;
  engineVersion: string;
  params: { caps: RelaxationCaps; growthCap: GrowthCap; association: AssociationCaps; llm: LlmBudget };
  input: {
    ruleVersionIds: string[];
    referenceListVersionIds: string[];
    transactionSetDigest: string;
    evaluationRunId: string | null;
  };
  progress: { stage: string; done: number; total: number };
  coverageMatrix: { indicator: string; label: string; ruleCodes: string[] }[];
  findings: RuleReviewFinding[];
  llm: {
    summary: string | null;
    explanations: Record<string, FindingExplanation>;
    hypotheses: RuleHypothesis[];
    critiques: Record<string, string>;
    calls: LlmCallAudit[];
    errors: string[];
  };
};

type RuleReviewFinding = {
  id: string;
  kind: "rule_adjustment" | "new_rule" | "coverage_gap" | "association";
  rule: { ruleId: string; ruleVersionId: string; code: string; label: string } | null;
  proposal:
    | { parameter: string; parameterType: ParameterType; currentValue: number; proposedValue: number; step: number }
    | { definition: RuleDefinition }
    | null;
  growth: { baseClients: number; addedClients: number; capExceeded: boolean } | null;
  clients: {
    clientId: string;
    transactionIds: string[];
    nearMissCount: number;
    distinctDays: number;
    minDistance: number | null;
    seedLinks: { seedClientId: string; seedReasons: string[]; accounts: string[] }[];
  }[];
  evidence: Record<string, unknown>;
};
```

`findings` is written by the deterministic part. `llm` is written by the Bedrock part. Neither writes the other's section.

### 6.3 Shape in code

Everything is new. Existing code is only read or called:

```
backend/src/
  ruleReviewComposition.ts             wires the module; mounted by createApp with one app.use line
  domain/ruleReview/                   pure: margins, caps, sweeps, repetition, association, coverage matrix, backtest
  application/ruleReviews/
    ruleReviewUseCases.ts              start (202) / get / list
    ruleReviewExecutor.ts              loads the dataset once, runs the stages, saves progress, calls the LLM ports
    ruleReviewPorts.ts                 RuleReviewReportStore, RuleReviewLauncher, RuleReviewInputRepository,
                                       FindingExplainer, HypothesisExplorer
  infrastructure/ruleReviews/          FileSystemRuleReviewReportStore, InProcessRuleReviewLauncher,
                                       TypeOrmRuleReviewInputRepository (read only)
  infrastructure/bedrock/ruleReview/   BedrockFindingExplainer, BedrockHypothesisExplorer (5.1, 5.2)
  delivery/http/ruleReviewsRouter.ts
  delivery/cli/ruleReview.ts           the same review from the command line, writes the report file
```

**The LLM ports have no-op defaults:**

- `FindingExplainer.explain(findings, context) → Record<findingId, FindingExplanation>`
- `HypothesisExplorer.explore(report, tools, budget) → { hypotheses, critiques, calls }`

So the deterministic part runs and is testable without Bedrock. `RULE_REVIEW_LLM=bedrock` switches the Bedrock adapters on.

**Existing code it uses read only:**

- `createTransactionEvaluator`, `calculateFeatures`, `evaluateRuleDefinition`;
- the queries behind `EvaluationInputRepository` (active rule versions, latest reference lists, dataset);
- with `evaluationRunId`: that run's fixed versions;
- `findRuleDefinitionViolation` for backtests.

Seeds for association come from the review's own evaluation pass, not from stored `rule_evaluations`.

**The only change to existing code: feature parameters (3.2 kind 2).**

- Each pattern feature takes optional parameters, with defaults equal to today's `thresholds.ts`.
- Every caller keeps calling it as before.
- It is accepted only if the not-breaking checklist (6.6) passes.
- Without it, iteration 1 covers DSL constants only and is blind to R-04, R-11 and R-12. Those are the mule rules that matter most.

### 6.4 API

| Endpoint | What |
| --- | --- |
| `POST /api/rule-reviews` | Body `{ createdBy?, evaluationRunId?, llm?: boolean }`. Returns `202` with the `running` report, or `409` when a review is already running. |
| `GET /api/rule-reviews` | List: id, status, times, number of findings per kind. |
| `GET /api/rule-reviews/:id` | The whole report. The web polls it every 2 s while it is `running`. |

### 6.5 Web: one button, one page

- **The button:** on the Rules page header, "Gap analysis" (cs "Analýza mezer v pravidlech"). Only the `compliance_officer` role sees it (`useRolePermissions`). It opens `/rules/gap-analysis`, a static segment next to `new`.
- **The page:**
  - "Start review", progress while it runs, and the list of past reviews;
  - findings grouped by kind, each with the rule, the proposal, the growth numbers, the Bedrock explanation with any unverified citations marked, and the clients;
  - each client links to `transactionsPath({ clientId })`;
  - hypotheses with their backtest;
  - the coverage matrix.
- **What is not on the page yet:** "Create draft version" and "Re-run for these clients". They come with the officer workflow in iteration 2. Until then the page shows the client IDs to copy into an evaluation run scope.
- **Service `ruleReviews`:**
  - a live adapter on the endpoints above;
  - a mock adapter that serves a static report fixture, so the page works in mock mode and in the demo. The fixture is generated from a local run of synthetic data.
- **Existing screens change only by the button.**

### 6.6 Local only

- **Everything is developed and run locally:** backend and web via `npm run dev` from `src/`, against the local Docker Postgres.
- **No deploy, no new AWS resources, no migration on `main` or `golden`.** The only remote call is Bedrock, the same way local drafting uses it.

**Local database:**

1. **Default:** `npm run db:up && npm run migration:run` gives golden plus every migration in git. That is the same schema, dataset and sample rules R-01 to R-17 as `main`.
2. **When the review must see `main`'s real state** (rules created in the wizard, activated versions, whitelist entries, users), mirror it:
   - `pg_dump` from `main` with an IAM token: team account check and `AWS_PROFILE=hackathon`, as in `db/psql.sh`. This reads `main` and never writes to it.
   - Pipe it straight into `pg_restore` into a **separate** local database, `main_mirror`, in the Docker Postgres. No dump file outside the project.
   - Then run `update typeorm_metadata set database = current_database()` in the mirror (AGENTS.md).
   - Point `DATABASE_URL` at `main_mirror`.
   - The script goes to `db/mirror-main-local.sh` and refuses any target that is not `localhost`.
   - `main` holds synthetic and organiser data only. The user approved the local mirror on 2026-10-20 (AGENTS.md, data handling).

**Not-breaking checklist.** It must pass locally before anything is proposed for `main`, a deployment or a migration:

- `npm run lint`, `npm test` and `npm run build` pass in both workspaces.
- `git diff main` touches no entity, no migration and no existing table. `npm run migration:show` lists nothing new.
- **Regression of detection:**
  - a full local evaluation run (`POST /api/evaluation-runs`, empty scope) on `main` code and on the branch;
  - the same per-rule hit counts, and the same digest of `(transaction_id, verdict, max_score, hit_count)` over `transaction_evaluations`;
  - plus a unit test that pins the `features` of a fixed sample of transactions.
- **Smoke test:** the existing endpoints return what they did, and the existing screens render in live and mock mode.
- With `RULE_REVIEW_LLM` off, the review runs end to end without AWS credentials.

### 6.7 Iteration 1 results (step 1a, 2026-10-20)

Built locally on branch `ok/quirky-lamarr-e78e66`, against a separate local database `rule_review_1a` (golden plus every migration in git, the same rules R-01 to R-17 as `main`). No mirror of `main` was needed, so `db/mirror-main-local.sh` was not written. Nothing was committed, deployed or run against Aurora.

**Phase 0 probe on the engine** (`npm run rule-review -- --probe`, 70 s per mode):

- **Volume read as CZK reproduces the Python probe of 3.5 and 4.1.** Base counts are identical (R-03 3, R-04 16, R-05 35, R-06 16, R-07 4, R-08 111, R-10 35, R-11 34, R-12 33, R-13 280, R-14 41, R-15 17). So are nearly all per-step additions, e.g. R-04 inflow window 10 %: +3, 20 %: +5, 25 %: +6, R-12 window 25 %: +4, R-11 window 25 %: +11. The association table matches row for row (≤ 3 clients per account: 192 linked, 5 via ≥ 2 accounts).
- **With FX conversion (what the engine runs) the bases are much larger:** R-03 22, R-04 1,077, R-05 99, R-08 97, R-11 152, R-12 129, R-14 3,033, R-15 154. The growth cap's ceiling of 50 then binds instead of the 25 %.

Outcome per parameter, each relaxed alone within the caps of 3.1 (FX, the engine's reading):

| Outcome | Parameters |
| --- | --- |
| **Gap** (smallest step adds clients within the growth cap, repeated) — 18 | R-04 ratio 0.8 (2.5 %, +12); R-04 inflow window 24 h (5 %, +38), outflow window 6 h (5 %, +19), min inflow 100k (2.5 %, +35); R-05 tenure < 6 months (5 %, +22); R-07 window 7 days (5 %, +3); R-08 window 7 days (5 %, +9); R-11 window 2 h (5 %, +9), ratio 0.9 (2.5 %, +19), ratio 1.1 (2.5 %, +14); R-12 window 72 h (5 %, +12), min amount L (2.5 %, +4); R-13 a1 5× (2.5 %, +9), a2 5× (2.5 %, +3), b2 3× (2.5 %, +4); R-14 375k (2.5 %, +41), 187.5k (2.5 %, +4); R-15 tenure < 6 months (5 %, +23) |
| **Recalibration** (first step breaks the growth cap) — 6 | R-06 7 payers (+89), R-07 3 payments (+190), R-08 3 payments (+666), R-09 40 clients (+44), R-10 5 countries (+129), 7 countries (+184) |
| **Noise** (one client, one day) — 4 | R-07 sum ≥ L (regulatory), R-11 min amount L, R-13 b3, R-15 amount ≥ 25k |
| **No near miss** — 3 | R-02 (no hits at all), R-03 100k, R-05 3× |

In CZK the same split is 13 gaps, 6 recalibrations, 11 noise, 1 no near miss: the small bases of R-04 and R-12 turn their gaps into noise.

**Perturbation test** (section 4): 5 real single-hit clients each of R-04, R-11 and R-12, completing payment moved 10 % past the window. 15 of 15 leave the rule and are found again at the 10 % window step, in both readings. It runs in CI on the full dataset (`perturbation.test.ts`, ~6 s).

**Full review** (`POST /api/rule-reviews` or `npm run rule-review`, FX): 45–50 s locally (baseline pass 16 s, 11 feature-parameter sweeps ~25 s). It writes 24 `rule_adjustment` findings (18 gaps, 6 recalibrations without client lists) and 38 `association` findings. The API answers polling in under 0.8 s while a review runs. With `RULE_REVIEW_LLM` off the LLM ports are no-ops, so `new_rule` and `coverage_gap` come only from step 1b.

**Coverage matrix (B0):** Z9 and Z11 have no scenario, as expected. Z10 and Z12 are also uncovered, but they belong to investigation and to sanctions screening (SVZ-05), not to transaction monitoring.

**Cap corrections the engine data suggests** (proposals for the compliance officer, not applied; the caps live in `params` of each report):

1. **Tenure in whole months is a count, not a window.** R-05 b and R-15 d compare `client_tenure_months_*`, an integer. The 5 % window steps (6 → 6.3 → 6.6 …) give the same result up to 15 % and then jump, so the proposed value 6.3 is false precision. Treat a `months` feature as a count: one unit (6 → 7), under the growth cap. On today's data both stay gaps (+22 of allowed 24, +23 of 38).
2. **A constant shared by several conditions is one parameter.** R-13's F appears in a1 and a2 (5×), and in b2 and b3 (3×). Relaxed condition by condition, each adds less than the rule would with F relaxed (the Python probe's +23 at 5 % for F = 5, against +16 and +4 here). Relax shared constants together.
3. **R-04 as a seed is too broad under FX.** With FX conversion R-04 hits 1,077 clients (20 % of the base), so seeds grow from 477 to 1,553 and association findings from 5 to 38. Either keep R-04 out of the seeds while its base is this large, or cap a seed rule at a share of clients (e.g. 5 %).
4. **Repetition mostly rests on "several clients".** Most gap findings have clients with a single near-miss day; they pass because ≥ 3 clients share the parameter. For large bases (R-04, R-14) consider requiring ≥ 3 clients and at least one repeated client, or scaling `minClients` with the base.
5. **R-11's ratio band is not blocked at a 2.5 % step.** 3.5 called it blocked on its first (5 %) step; with the 2.5 % steps of 3.1 it adds +6 of allowed 8 (CZK) and +19 of 38 (FX).

**Not-breaking checklist (6.6), all passed locally:**

| Check | Result |
| --- | --- |
| `npm run lint`, `npm test`, `npm run build` in both workspaces | pass (backend 294 tests, web 296) |
| No entity, no migration, no existing table touched; `migration:show` lists nothing new | pass: 13 of 13 applied, none new; the new code issues no write SQL |
| Full evaluation run (empty scope) on `origin/main` code and on the branch, same database | identical: digest of `(transaction_id, verdict, max_score, hit_count)` over 397,853 transactions, digest of all 244,336 stored rule results (features, trace, context refs), per-rule hits and clients |
| Pinned features of a fixed sample and per-rule hits on the full dataset | `detectionRegression.test.ts`, baseline taken before the feature-parameter change, passes after it |
| Existing endpoints return what they did | 13 GET endpoints byte-identical on both backends; only the new `/api/rule-reviews` differs |
| Existing screens render in live and mock mode | 9 pages × 2 modes without an error state |
| Review end to end without AWS credentials, `RULE_REVIEW_LLM` off | pass (CLI run with every AWS variable unset) |

**Go / no-go:** **go** for iteration 1 as built, i.e. local use and a demo. The signal is not empty: 18 gaps, every perturbed hit found again, and the deterministic numbers match the independent Python probe. Detection is provably unchanged. Before anything goes to `main`, the user confirms these results (the gate in 8). Before a deployment, iteration 2 must replace the file store, which does not work on Lambda.

### 6.8 1b integration notes

Step 1b lives in `infrastructure/bedrock/ruleReview/` with the CLI `delivery/cli/ruleReviewLlm.ts`: `npx tsx --env-file-if-exists=.env src/delivery/cli/ruleReviewLlm.ts [report.json] [output.json]`. It runs both adapters on `fixtures/ruleReviewReport.fixture.json` with in-memory fake tools (`fixtures/`, the backtest is a hash) and writes the report with its `llm` section. What 1a wires:

- **Types.** `ruleReview/contract.ts` mirrors 1a's draft (`domain/ruleReview/*`, `application/ruleReviews/ruleReviewPorts.ts`). Swap its imports for 1a's modules and delete it. It adds three fields 1b asked 1a for:
  - `HypothesisExploration.errors`: a Bedrock failure or a budget stop in the loop;
  - `RuleHypothesis.kind` (`new_rule` | `coverage_gap`) and `missingFeature`;
  - `definition` is null for a coverage gap.
- **Switch.** With `RULE_REVIEW_LLM=bedrock`, `ruleReviewComposition.ts` uses `createBedrockRuleReviewLlm(parseBedrockConfig(env))`. It has the same `BEDROCK_*` variables and `createBedrockClient` as drafting. Without it, the no-op adapters stay.
- **Executor order.**
  1. `explain(findings, context)` and `explore(report, tools, params.llm)` can run in parallel.
  2. Then call `summarize(context)` with the explanations already set on `context.report.llm.explanations`.
  3. Explainer calls and errors arrive through `context.audit`. Append the explorer's `calls` and `errors` to them.
  4. None of these throws.
- **Discard rules.**
  - 1a's `backtestRule` sets `discardReason` (4 caps from `params.backtest`).
  - 1b also discards a backtest with a `violation` or zero clients, and anything that fails `buildRuleDefinition` or `findRuleDefinitionViolation` before the backtest runs.
  - Discarded hypotheses stay in `hypotheses` with `backtest.discardReason` set. Only the ones with `discardReason === null` count toward `maxHypotheses`.
  - The model gets the reason and may retry within the budget.
- **What 1a's data must respect.**
  - `finding.evidence` and the tool results go to the model verbatim, so they hold aggregates only. 1b clamps backtest samples to `maxSampleClientIds`, and only that.
  - Citations are checked against the document the model was given: `finding.*` (id, kind, rule, proposal, growth, clientCount, evidence), `rule.*` (catalogue entry) and `clients.<i>.*` (1a's `ClientProfile` plus `distinctDays` and `seedLinks` from the finding). An unverified citation carries an extra `reason`.
- **Audit.**
  - `inputTokens` includes cache reads and writes.
  - In the hypothesis loop, `prompt` holds `{ system | null, tools, messages }`, only what that call added. The conversation is the `hypotheses` calls in order.
- **Budget.** The loop stops gracefully and keeps partial results. The stop reason goes to `errors` as "Hypothesis loop stopped early, …".
- **Open:**
  - an npm script for the CLI;
  - `.rule-reviews/` in `.gitignore`;
  - the DSL guidance in `hypothesisPrompt.ts` repeats `ruleDraftingPrompt.ts`, so extract a shared module;
  - a hypothesis' Czech text can claim more than its DSL does (seen in the fixture run). The officer should read the definition, not only the description.

## 7. Iteration 2: persistence, officer workflow, deployment (only after confirmation)

**Starts only when the user confirms that iteration 1 does not break the app.** Then:

**Where reports live: S3 or tables.**

- **S3:**
  - a team-account bucket with Object Lock for the 10-year retention;
  - the report stays one document;
  - the officer's workflow fields go into a small table.
- **New tables:**
  - in a separate schema `rule_review`, so no existing table is touched;
  - `reviews`, `findings`, `finding_clients`;
  - officer fields: `review_status` (`open` / `investigating` / `adopted` / `dismissed`), `reviewed_by`, `reviewed_at`, `review_reason`, `adopted_rule_version_id`, and the `evaluation_run_id` of the officer's re-run;
  - an additive migration, generated against a `wip_<name>` copy.
- **Recommendation: tables.** The officer workflow queries findings by status and client, and the audit timeline (#5) joins on them.

**Officer workflow:**

- "Create draft version" from a `rule_adjustment` or `new_rule` finding. This needs a new `created_via = rule_review`, which is a CHECK change on `rule_versions`, the one existing table touched. It is deferred until #8 lands.
- "Re-run for these clients" via `scope.clientIds`.
- Review status with a required reason, written to `audit_events` once #5 lands.

**Deployment:**

- a worker Lambda in the pattern of #4 (`ruleReviewWorker.ts` in the same bundle, own concurrency);
- `LambdaRuleReviewLauncher`;
- an S3 or DB store;
- IAM for Bedrock and the store.

**Triggers:** after an evaluation run completes, and quarterly through EventBridge Scheduler (čl. 11.1).

## 8. Road

| Step | Content | Size | Parallel? |
| --- | --- | --- | --- |
| 1a | Deterministic part, local: CLI probe on the engine (FX and CZK), margins, feature parameters behind the regression check, caps and growth cap, repetition, association, coverage matrix, report store, executor, launcher, API, button and page with the fixture mock, not-breaking checklist. Write the numbers and a go/no-go into the spec ("Iteration 1 results"). | 3–4 days | starts now |
| 1b | Bedrock part, local: `BedrockFindingExplainer` (5.1) and `BedrockHypothesisExplorer` with tools and budget (5.2), built against the report contract in 6.2 and the port signatures in 6.3. Test them on a report fixture through a CLI; wire them in once 1a lands. | 2–3 days | alongside 1a |
| — | **Gate:** the user confirms the checklist results. | | |
| 2 | Iteration 2 (section 7). | 3 days | after the gate |

### Hackathon priority

- **#13 and #14 carry 65 % of the score.** This feature produces nothing for the mandatory CSV.
- **1a with the perturbation demo, plus 1b's explanation of one gap,** is the slice worth showing: the "periodically assess whether the ruleset captures all relevant flags" loop, and AI that drives deterministic tools instead of reading rows (jury criterion "beyond a GPT wrapper", 20 %).
- **Iteration 2 is post-hackathon.**

## 9. Decisions and open questions

Decided (2026-10-20):

- **Findings are ruleset artefacts.** They carry the affected clients (IDs, links) for further research and never become alerts. The officer adjusts the rule, re-runs and acts on the alerts.
- **Relaxation has two caps (3.1):** a cap per parameter type (amounts and ratios 10 %, windows 25 %, counts one unit, band edges and categorical values never), and a growth cap (added clients ≤ max(5, 25 % of the base), ≤ 50). Both are enforced in code, and their values are a proposal for the compliance officer. They started from the user's 10 % suggestion and were set against SVZ-03/06 and the data.
- **Findings are retained for 10 years**, dismissed ones too.
- **Guilt by association is in scope (4.1)**, with seeds taken as they stand when the review runs (risk score, PEP, serious rule hits), links only through private accounts and hard caps.
- **Peer groups for B1:** client type × risk score, plus the client's own Q2 profile, with a minimum group size of 50. This is accepted as enough for the PoC; the dataset has no industry (MCC).
- The statistics loop over alerts and false positives is out of scope.
- **Iteration 1 needs no entity and no migration** (section 6). It is an async job that writes one report document (a file locally). It is standalone except for one button on the Rules page and the feature-parameter change behind the regression check.
- **All development is local** until the not-breaking checklist (6.6) passes and the user confirms. The local DB is Docker from migrations, or a read-only mirror of `main` in `main_mirror`.
- **Bedrock explains the findings (5.1) and complements the analysis** through a hypothesis loop with deterministic tools (5.2). It never changes a deterministic result.

Open:

1. **Seeds for 4.1.** Should seeds also include clients whose risk score was raised recently, i.e. the changing label? That needs a history of risk scores, which the data model does not keep yet.
2. **Iteration 2 store:** S3 document or tables in their own schema (section 7)?
3. **Duplicate alerts after a re-run.** A re-run creates a separate evaluation run, so a client already alerted in the main run can get the same alert twice. Alert deduplication across runs should be decided in #13.

## 10. Compliance notes

- The LLM decides nothing. Rule proposals are drafts that the compliance officer approves or rejects (M11). Prompt, model and backtest are stored with the finding.
- The legal basis for processing is the AML Act, with retention under § 16 and SVZ-03 čl. 12.
- Findings are visible to the `compliance_officer` role only. The officer is not client facing, which addresses tipping-off (§ 38 AML Act).
- An `association` finding is a research lead, not evidence against the client. It always shows why each seed is a seed, so the officer can judge how strong the link is.
- Findings are reviewed and investigated. Rules change only through the officer's adopted versions.
