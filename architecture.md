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

Rule statuses: `draft`, `pending_for_review`, `update_for_review`, `active`, `inactive`. A rule returns a score of 0–100 and a trace. The adjusted score is `score × sensitivity / 100`. Each rule version holds its content (code + Czech explanation, or agentic rule text) and its config (sensitivity, risk profiles). Any edit of content or config creates a new version that goes to review (data model M7). Evaluation always uses the running approved version, never a pending one. The client whitelist is not versioned: it lives at rule level as rule × client entries with a required reason (M16), and changes apply immediately without review. Regulatory-mandatory rules have `whitelistAllowed = false`. Each batch snapshots the whitelist together with the rule versions, so past batches stay reproducible. Whitelist approval and periodic review (CNB benchmark 2/2023) are not in the MVP and need compliance review.

## Evaluation engine (`src/backend`)

`POST /api/evaluation-runs` → `EvaluationRunUseCases.startRun` fixes the active deterministic rule versions and the latest reference lists, stores the run as `running` and hands it to an `EvaluationRunLauncher` (in the API process locally, a Lambda worker when `EVALUATION_WORKER_FUNCTION` is set). `EvaluationRunExecutor` loads clients, transactions and ČNB rates once (D18), evaluates the transactions in scope with the pure `domain/transactionEvaluator.ts` and stores them in batches of 1,000 with progress counters. Only rule results other than `pass` are stored (V16). Runs are read through `EvaluationRunQueries`.

## Drafting jobs (`src/backend`)

The wizard's LLM steps run as `drafting_jobs` rows ([spec/drafting-jobs.md](spec/drafting-jobs.md)). `POST /api/drafting-jobs` → `DraftingJobUseCases.startPolicyJob` stores pasted text as a regulation version, inserts a `pending` `policy_from_regulation` job and hands it to a `DraftingJobLauncher` (in the API process locally, the `rfm-drafting-worker` Lambda when `DRAFTING_WORKER_FUNCTION` is set). Approving a policy version stores a `rules_from_policy` job in the same transaction as the review. `DraftingJobExecutor` claims the job (`pending` → `running`, so a repeated invocation is a no-op), fetches a URL source when needed, calls the `DraftGenerator` port (`DummyDraftGenerator` until the Bedrock generator is wired, #1, #2) and writes the drafts together with `succeeded` in one transaction. Failures end as `failed` with the error; an unfinished job older than 16 minutes is reported as `failed`. The web polls jobs every 30 s while one is in flight.

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

- **Features:** `dashboard`, `regulations`, `policies`, `rules` (incl. `domain/ruleLifecycle.ts`, the pure state machine for statuses and versions), `batches` (CSV upload, OK / TO CHECK / ALERT buckets, transaction detail), `wizard` (regulation source → policy draft → rules → review).
- **Evaluation run start and polling:** "Run evaluation" sends `POST /api/evaluation-runs` (optional scope: limit, from, to) and opens the run detail. `useBatch` and `useBatches` poll with React Query `refetchInterval` (2 s live, 400 ms mock) while a run is `processing` (`importing` or `running`) and stop once it is `completed` or `failed`.
- **Mode selection:** `config/apiMode.ts`. `NEXT_PUBLIC_API_MODE` sets the global default (`mock`), and `NEXT_PUBLIC_API_MODE_<SVC>` overrides it per service. Live mode never falls back to mocks.
- **Mock-only code:** everything lives in `mocks/`, including the browser evaluation engine (`mocks/evaluation`) and the generation templates (`mocks/generation`).
- **i18n:** `i18n/en.ts` and `i18n/cs.ts` are typed dictionaries. The locale is stored in a cookie and read in the root layout, so the server and client render the same text. Only UI strings are translated, not data.
- **Env:** `config/env.client.ts` holds `NEXT_PUBLIC_*` only. `config/env.server.ts` holds `server-only` values (`BACKEND_URL`). Secrets go in Vercel env vars, never in `NEXT_PUBLIC_*`.
- **Styling:** CSS Modules plus tokens in `app/globals.css`. The UI is light only. The root font size is fluid (`clamp`) so the app is readable on a projector. Runtime dependencies are `lucide-react`, `@tanstack/react-query` and `zod`.

## Deployment

- **Web:** Vercel, with Root Directory `src/web`.
- **Backend:** AWS (see [src/README.md](src/README.md#deployment)).
