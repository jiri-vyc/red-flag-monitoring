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

Alerts (issue #13, [V18–V20](spec/datovy-model.md#rozhodnutí-vyhodnocení)): after a run's transactions are stored, its hits are grouped into `aml_events` by the rule's `alert_granularity`: one event per hit transaction (`transaction`, rule B) or per client and calendar month (`client_month`, rules A and C). `aml_event_hits` links every hit to exactly one event. The `alert_id` is readable and unique within the run (`R-02-TX000012345`, `R-01-K000123-2026-07`). An event is a decision aid, not an AML determination; triage and priority come with #14.

Relations (data model M3 to M5): a policy cites 0..N regulations through its legal bases, each with an optional provision `ref` (a purely internal policy cites none). A rule may have no policy. Each rule version has its own 1..N legal bases (regulation + required `ref`), not inherited from the policy. The web shows the legal basis of the running version, else of the newest one (`findRuleLegalBases`), and derives a regulation's related policies and rules from these legal bases. The live adapters map backend regulation wordings (`regulationVersionId`) to regulations, and a new manual rule cites the newest wording.

Users and roles (issue #6): a user holds one or more of `compliance_analyst`, `compliance_officer`, `lawyer`, `contact_person` (AML zákon § 22) and `designated_person` (§ 22a). Each rule version names the role its hits are escalated to (`escalationRole`, default `contact_person`, set at version creation or changed at review). Run results read with `?role=` show only the hits escalated to that role. There is no auth: the web picks the user and active role, the backend trusts it and checks no permissions.

Rule statuses: `draft`, `pending_for_review`, `update_for_review`, `active`, `inactive`. A rule returns a score of 0–100 and a trace. The adjusted score is `score × sensitivity / 100`. Each rule version holds its content (code + Czech explanation, or agentic rule text) and its config (sensitivity, risk profiles). Any edit of content or config creates a new version that goes to review (data model M7). Evaluation always uses the running approved version, never a pending one. The client whitelist is not versioned: it lives at rule level as rule × client entries with a required reason (M16), and changes apply immediately without review. Regulatory-mandatory rules have `whitelistAllowed = false`. Each batch snapshots the whitelist together with the rule versions, so past batches stay reproducible. Whitelist approval and periodic review (CNB benchmark 2/2023) are not in the MVP and need compliance review.

## Evaluation engine (`src/backend`)

`POST /api/evaluation-runs` → `EvaluationRunUseCases.startRun` fixes the active deterministic rule versions and the latest reference lists, stores the run as `running` and hands it to an `EvaluationRunLauncher` (in the API process locally, a Lambda worker when `EVALUATION_WORKER_FUNCTION` is set). `EvaluationRunExecutor` loads clients, transactions and ČNB rates once (D18), evaluates the transactions in scope with the pure `domain/transactionEvaluator.ts` and stores them in batches of 1,000 with progress counters. Only rule results other than `pass` are stored (V16). It then loads the run's stored hits, groups them with the pure `domain/amlEvent.ts` (`groupRuleHitsIntoAmlEvents`) and writes the AML events through `AmlEventRepository` in one transaction before it marks the run `completed` (~7 s for the whole dataset locally). Runs are read through `EvaluationRunQueries`, their AML events through `AmlEventQueries`.

## Drafting jobs (`src/backend`)

The wizard's LLM steps run as `drafting_jobs` rows ([spec/drafting-jobs.md](spec/drafting-jobs.md)). `POST /api/drafting-jobs` → `DraftingJobUseCases.startPolicyJob` stores pasted text as a regulation version, inserts a `pending` `policy_from_regulation` job and hands it to a `DraftingJobLauncher` (in the API process locally, the `rfm-drafting-worker` Lambda when `DRAFTING_WORKER_FUNCTION` is set). Approving a policy version stores a `rules_from_policy` job in the same transaction as the review. `DraftingJobExecutor` claims the job (`pending` → `running`, so a repeated invocation is a no-op), fetches a URL source when needed, calls the `DraftGenerator` port (`BedrockDraftGenerator` with `DRAFT_GENERATOR=bedrock`, as on the deployed worker; `DummyDraftGenerator` otherwise) and writes the drafts together with `succeeded` in one transaction. Failures end as `failed` with the error; an unfinished job older than 16 minutes is reported as `failed`. The web polls jobs every 30 s while one is in flight.

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
