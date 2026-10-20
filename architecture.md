# Architecture

Overview of the repo. Run instructions, scripts and env vars are in [src/README.md](src/README.md); the domain is in [spec/spec.md](spec/spec.md).

## Repo layout

| Path                    | What                                                                             |
| ----------------------- | -------------------------------------------------------------------------------- |
| `spec/`                 | Product spec (Czech), list of regulations, team transcript                       |
| `knowledgebase/finreg/` | FINREG challenge briefing (slides + summary)                                     |
| `datasets/`             | Synthetic vendor data: `clients.csv`, `transactions.csv` (`;`-separated)         |
| `src/`                  | npm workspace: `backend/` (Express 5, TypeORM, Postgres) and `web/` (Next.js 16) |

## Domain

```
Regulation → Internal policy → Rule → Rule version
Client → Transaction → Transaction evaluation → 1..N rule evaluations → AML event
```

Relations (data model M3 to M5): a policy cites 0..N regulations through its legal bases, each with an optional provision `ref` (a purely internal policy cites none). A rule may have no policy. Each rule version has its own 1..N legal bases (regulation + required `ref`), not inherited from the policy. The web shows the legal basis of the running version, else of the newest one (`findRuleLegalBases`), and derives a regulation's related policies and rules from these legal bases. The live adapters map backend regulation wordings (`regulationVersionId`) to regulations, and a new manual rule cites the newest wording.

Users and roles (issue #6): a user holds one or more of `compliance_analyst`, `compliance_officer`, `lawyer`, `contact_person` (AML zákon § 22) and `designated_person` (§ 22a). Each rule version names the role its hits are escalated to (`escalationRole`, default `contact_person`, set at version creation or changed at review). Run results read with `?role=` show only the hits escalated to that role. There is no auth: the web picks the user and active role, the backend trusts it and checks no permissions.

Rule statuses: `draft`, `pending_for_review`, `update_for_review`, `active`, `inactive`. A rule returns a score of 0–100 and a trace. The adjusted score is `score × sensitivity / 100`. Each rule version holds its content (code + Czech explanation, or agentic rule text) and its config (sensitivity, risk profiles). Any edit of content or config creates a new version that goes to review (data model M7). Evaluation always uses the running approved version, never a pending one. The client whitelist is not versioned: it lives at rule level as rule × client entries with a required reason (M16), and changes apply immediately without review. Regulatory-mandatory rules have `whitelistAllowed = false`. Each batch snapshots the whitelist together with the rule versions, so past batches stay reproducible. Whitelist approval and periodic review (CNB benchmark 2/2023) are not in the MVP and need compliance review.

## Evaluation engine (`src/backend`)

`POST /api/evaluation-runs` → `EvaluationRunUseCases.startRun` fixes the active deterministic rule versions and the latest reference lists, stores the run as `running` and hands it to an `EvaluationRunLauncher` (in the API process locally, a Lambda worker when `EVALUATION_WORKER_FUNCTION` is set). `EvaluationRunExecutor` loads clients, transactions and ČNB rates once (D18), evaluates the transactions in scope with the pure `domain/transactionEvaluator.ts` and stores them in batches of 1,000 with progress counters. Only rule results other than `pass` are stored (V16). Runs are read through `EvaluationRunQueries`.

## Drafting jobs (`src/backend`)

The wizard's LLM steps run as `drafting_jobs` rows ([spec/drafting-jobs.md](spec/drafting-jobs.md)). `POST /api/drafting-jobs` → `DraftingJobUseCases.startPolicyJob` stores pasted text as a regulation version, inserts a `pending` `policy_from_regulation` job and hands it to a `DraftingJobLauncher` (in the API process locally, the `rfm-drafting-worker` Lambda when `DRAFTING_WORKER_FUNCTION` is set). Approving a policy version stores a `rules_from_policy` job in the same transaction as the review. `DraftingJobExecutor` claims the job (`pending` → `running`, so a repeated invocation is a no-op), fetches a URL source when needed, calls the `DraftGenerator` port (`BedrockDraftGenerator` with `DRAFT_GENERATOR=bedrock`, as on the deployed worker; `DummyDraftGenerator` otherwise) and writes the drafts together with `succeeded` in one transaction. Failures end as `failed` with the error; an unfinished job older than 16 minutes is reported as `failed`. The web polls jobs every 30 s while one is in flight.

## Rule gap review (`src/backend`, iteration 1, local only)

A triggered job that finds rule thresholds clients stay just under and behaviour no rule covers ([spec/rule-gap-hunting.md](spec/rule-gap-hunting.md)). Its findings are ruleset artefacts with the affected clients for research. It never creates alerts, writes no table and changes no rule version.

- **Flow:** `POST /api/rule-reviews` → `RuleReviewUseCases.startReview` (409 while one runs) stores a `running` report document and hands it to `InProcessRuleReviewLauncher`. `RuleReviewExecutor` loads the active rule set (or an evaluation run's fixed versions) and the dataset once, then runs the stages in `RuleReviewAnalysis`: one baseline pass with the production `evaluateTransaction`, sweeps of the DSL constants from the `pass` traces, a re-run per feature parameter step, association and the SVZ-03 čl. 7 coverage matrix. It rewrites the report with progress and ends `completed` or `failed`. A report still `running` after 20 minutes is shown as failed.
- **Pure core:** `domain/ruleReview/`: relaxable parameters with the caps per type, the growth cap, repetition, trace margins, association, coverage matrix, backtest of a DSL definition, the perturbation test. Long stages are generators that yield every 5,000 transactions, so the API keeps answering while a review runs.
- **Feature parameters:** pattern features read their thresholds from `FeatureContext.parameters` (`domain/features/featureParameters.ts`), by default the values of `thresholds.ts`. Detection always runs with the defaults; only the review relaxes them. `detectionRegression.test.ts` pins per-rule hits on the full dataset and the features of a fixed sample.
- **Store:** `FileSystemRuleReviewReportStore` writes one JSON per review to `RULE_REVIEW_DIR` (default `src/backend/.rule-reviews/`, git-ignored). Finished reports are immutable. Not usable on Lambda; iteration 2 picks S3 or tables.
- **LLM ports:** `FindingExplainer` and `HypothesisExplorer` are no-ops unless `RULE_REVIEW_LLM=bedrock` (adapters from step 1b, not wired yet). The executor backtests every hypothesis itself, enforces the tool call budget and never lets a Bedrock failure fail the review.
- **CLI:** `npm run rule-review` runs the same review and writes the report; `-- --probe` prints the sensitivity and association tables with FX conversion and with volume read as CZK.

## Web (`src/web`)

Our team owns the frontend only. The backend is someone else's, and the web adapts to its API.

```
app/ (thin route pages)
  → features/<f>/components (screens)
    → features/<f>/api/hooks.ts (React Query, registers service usage)
      → service.ts: resolveService(name, { mock, live })
          → live.ts: fetch relative /api/... → Next rewrite → BACKEND_URL; responses validated with Zod
          → mocks/services/<f>.mock.ts: localStorage store (mocks/store), seed (mocks/seed)
```

- **Features:** `dashboard`, `regulations`, `policies`, `rules` (incl. `domain/ruleLifecycle.ts`, the pure state machine for statuses and versions), `batches` (CSV upload, OK / TO CHECK / ALERT buckets, transaction detail), `transactions` (client transactions), `wizard` (regulation source → policy draft → rules → review).
- **Evaluation run start and polling:** "Run evaluation" sends `POST /api/evaluation-runs` (optional scope: limit, from, to) and opens the run detail. `useBatch` and `useBatches` poll with React Query `refetchInterval` (2 s live, 400 ms mock) while a run is `processing` (`importing` or `running`) and stop once it is `completed` or `failed`.
- **Gap analysis:** the Rules page shows "Gap analysis" to roles with `canManageRules` (the compliance officer). `/rules/gap-analysis` (`features/ruleReviews`) starts a review, polls it every 2 s while `running`, lists past reviews and shows the coverage matrix, the gaps, the recalibration candidates and the association leads with links to the client's transactions. The service follows the `rules` data source; the mock serves a report from a local run (`mocks/seed/ruleReviewReport.json`).
- **Users and roles (issue #6):** `features/users` (service `users`, `GET /api/users`). `config/currentUser.ts` holds the user and active role picked in the sidebar (`CurrentUserPicker`, kept in `localStorage`); `useRolePermissions` hides actions the active role may not take. Batch queries send `?role=` and key on it, so switching the role refetches.
- **Client transactions (issue #9):** `features/transactions` (service `transactions`, `GET /api/transactions`) at `/transactions`, in the sidebar as Transactions (Transakce). The client filter, the highlighted transaction and the return path live in the URL (`transactionsPath`). A failed rule card in the transaction detail links there with the client and the evaluated transaction; the list loads pages until that transaction shows and scrolls to it.
- **Policy and regulation links:** `PolicyLink` and `RegulationLink` (rules list, rule detail, legal bases) take the name from a cheap name index (`usePolicyNames` / `useRegulationNames`, one `GET /api/internal-policies` / `GET /api/regulations` each, no versions), not from the full lists, and fall back to the ID while it loads or when the name is unknown.
- **Current policy version (BE-11):** the live adapter takes a policy's status, text, legal bases and approval from the latest version, unless that one is rejected (or superseded): then from the latest approved version, which stays in force. One rule (`findCurrentVersion` in `features/policies/domain/currentVersion.ts`) serves both the live adapter (DTOs) and the detail screen, which shows that version as current; the version history keeps every version.
- **Backend errors:** `lib/httpClient.ts` turns non-2xx responses into `ApiError`. The message carries the backend `error` and, for a 400 from request validation, its zod `issues` as `field.path: message`, so `ErrorState` and mutation errors show which field is wrong.
- **Mode selection:** `config/apiMode.ts`. `NEXT_PUBLIC_API_MODE` sets the global default (`mock`), and `NEXT_PUBLIC_API_MODE_<SVC>` overrides it per service. Live mode never falls back to mocks.
- **Mock-only code:** everything lives in `mocks/`, including the browser evaluation engine (`mocks/evaluation`) and the generation templates (`mocks/generation`).
- **i18n:** `i18n/en.ts` and `i18n/cs.ts` are typed dictionaries. The locale is stored in a cookie and read in the root layout, so the server and client render the same text. Only UI strings are translated, not data.
- **Env:** `config/env.client.ts` holds `NEXT_PUBLIC_*` only. `config/env.server.ts` holds `server-only` values (`BACKEND_URL`). Secrets go in Vercel env vars, never in `NEXT_PUBLIC_*`.
- **Styling:** CSS Modules plus tokens in `app/globals.css`. The UI is light only. The root font size is fluid (`clamp`) so the app is readable on a projector. Runtime dependencies are `lucide-react`, `@tanstack/react-query` and `zod`.

## Deployment

- **Web:** Vercel, with Root Directory `src/web`.
- **Backend:** AWS (see [src/README.md](src/README.md#deployment)).
