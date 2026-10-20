# Red-flag monitoring – app

npm workspace with two packages:

- `backend/` – REST API. Node.js 24, TypeScript, Express 5, TypeORM with PostgreSQL 17.
- `web/` – UI. Next.js 16 (App Router), React 19, TypeScript, CSS Modules.

Tooling: ESLint, Prettier, Jest (`ts-jest` in backend, `next/jest` + Testing Library in web).

## Run locally

Requires Docker for the local database.

```bash
cd src
npm install
cp backend/.env.example backend/.env
npm run db:up          # Postgres in Docker on localhost:5434
npm run migration:run
npm run dev
```

- Web: http://localhost:3000
- API: http://localhost:4000/api/health

`npm run migration:run` creates the `clients` and `transactions` tables and loads the organiser datasets from `../datasets/*.csv` (5,493 clients, 397,853 transactions). The load migration fails if row counts or amount sums don't match the files.

The web works without the backend (default mock mode): `npm run dev -w web` is enough for UI work and demos.

The web proxies `/api/*` to the backend, so browser code calls relative `/api/...` URLs.

### Set up AWS CLI access (once per machine)

There are no access keys, only SSO. Full guide: the organisers' "AWS Participant Guide" on Notion.

Add this to `~/.aws/config`, or run `aws configure sso` with the same values. The SSO region is `eu-north-1` on purpose; all work happens in `eu-central-1`.

```ini
[sso-session hackathon]
sso_start_url = https://d-c3676ff6eb.awsapps.com/start
sso_region = eu-north-1
sso_registration_scopes = sso:account:access

[profile hackathon]
sso_session = hackathon
sso_account_id = 526983806399
sso_role_name = ai-hackathon-TeamAdmin
region = eu-central-1
output = json

# For the Node.js backend: reuses the CLI's 12 h role credentials (see below).
[profile hackathon-sdk]
credential_process = aws configure export-credentials --profile hackathon --format process
region = eu-central-1
```

The backend uses `hackathon-sdk`, not `hackathon`. With a plain SSO profile the AWS SDK for Node.js needs the SSO access token, which expires after 1 hour, and refreshing it fails for this directory (`InvalidGrantException`). The backend then answers 500 with `Token is expired` in its log, even though the AWS CLI still works. The `credential_process` profile makes the SDK take the CLI's role credentials, which last the whole 12 h session.

Then log in and check the account. The login lasts 12 hours.

```bash
aws sso login --profile hackathon
aws sts get-caller-identity --profile hackathon   # Account must be 526983806399
```

### Against Aurora instead of Docker

The browser never talks to the database. The web proxies `/api/*` to the local backend, and the backend connects to Aurora with a fresh IAM token per connection. Only `backend/.env` changes. The backend never runs migrations on start, so pointing it at the shared `main` database doesn't change the schema.

```
browser → web (localhost:3000) → /api proxy → backend (localhost:4000) → Aurora database-1 / main
```

1. Log in to AWS (see [above](#set-up-aws-cli-access-once-per-machine)): `aws sso login --profile hackathon`
2. In `backend/.env`, swap the Docker `DATABASE_URL` for the Aurora block (it's in `backend/.env.example`, commented out):

   ```dotenv
   PORT=4000
   DATABASE_AUTH=iam
   DATABASE_URL=postgres://postgres@database-1.cluster-c9m6a2a047k1.eu-central-1.rds.amazonaws.com:5432/main
   AWS_REGION=eu-central-1
   AWS_PROFILE=hackathon-sdk
   ```

   The URL has no password. The backend signs a fresh IAM token for every connection and verifies TLS. Use `wip_<name>` instead of `main` for your own copy (`../db/create-wip.sh <name>`).

3. Create `web/.env.local`. Every section is live, including the wizard and the dashboard. Do not pin the wizard to mock: it is shown only when it shares the data source with regulations, policies and rules.

   ```env
   NEXT_PUBLIC_API_MODE=live
   BACKEND_URL=http://localhost:4000
   ```

4. Start both with `npm run dev`. You don't need `npm run db:up` or `npm run migration:run`.

5. Open http://localhost:3000. The screens now read from Aurora, and the sidebar no longer shows "Mock data, not connected to API". If the sidebar's **Data source** shows Mock, this browser remembers an earlier choice: switch it to Live. Check the backend alone with `curl -s localhost:4000/api/database-status`: Aurora shows its `auroraVersion`, a local Docker Postgres shows `null`. The sidebar's **Database** panel shows the same, but it is hidden for the demo (`IS_DATABASE_STATUS_VISIBLE = false` in `web/components/layout/Sidebar.tsx`).

Things to know:

- **Restart `npm run dev` after changing `.env.local`.** `NEXT_PUBLIC_*` values are read at start/build time.
- **Writes go to `main`.** Creating, approving, whitelisting or running the wizard in the web writes to the shared team database through the API. For experiments use your own copy (`wip_<name>`, see above).
- **Migrations:** while `.env` points at `main`, every `npm run migration:*` from `src/` hits `main` too. Use `migration:run` there only to apply reviewed migrations. Never run `migration:generate` against `main`, only against your `wip_<name>` (see `../AGENTS.md`).
- **AI drafting:** the wizard's drafts come from a placeholder generator by default (titles start with `[DUMMY]`). Add `DRAFT_GENERATOR=bedrock` to `backend/.env` to draft with Claude on Amazon Bedrock. It uses the same `AWS_PROFILE`, costs Bedrock tokens, and a step can take minutes.
- **Errors:** "Token for hackathon does not exist", "Token is expired" or a 500 from `/api/database-status` means the SSO session ended: run `aws sso login --profile hackathon` and restart `npm run dev`. If it happens about an hour after login, check that `backend/.env` uses `AWS_PROFILE=hackathon-sdk`.
- **Slow first request:** the first database request can take up to 45 s while Aurora resumes.
- **Stop `npm run dev` when done.** An open connection keeps the cluster billing.
- **Switching back to Docker:** restore the Docker `DATABASE_URL` and drop `DATABASE_AUTH`.

### Connect to the database with DBeaver

The Aurora cluster `database-1` has no passwords, only short-lived IAM tokens.

1. Log in to AWS: `aws sso login --profile hackathon` (first time: [set up AWS CLI access](#set-up-aws-cli-access-once-per-machine)).
2. In DBeaver create a **PostgreSQL** connection:
   - Host: `database-1.cluster-c9m6a2a047k1.eu-central-1.rds.amazonaws.com`
   - Port: `5432`
   - Database: `main`
   - Username: `postgres`
   - "Save password": off
3. In the **Driver properties** tab set:
   - `sslmode` = `verify-full`
   - `sslfactory` = `org.postgresql.ssl.DefaultJavaSSLFactory`
4. Generate a token. This copies it to the clipboard:

   ```bash
   aws rds generate-db-auth-token --profile hackathon --region eu-central-1 --hostname database-1.cluster-c9m6a2a047k1.eu-central-1.rds.amazonaws.com --port 5432 --username postgres | pbcopy
   ```

5. Connect and paste the token as the password.

Notes:

- **Token lifetime:** a token opens new connections for 15 minutes; open sessions stay up. When DBeaver asks again, repeat step 4. If the command fails, repeat step 1.
- **Slow first connect:** the cluster auto-pauses when idle, so the first connect can take ~15 s.
- **`main` is changed only via migrations** (see `../AGENTS.md`). Treat the DBeaver connection as read-only and disconnect when done, because an open connection keeps the cluster billing.

## API

There is no auth yet (M12 in `spec/datovy-model.md`). Calls that create or review data pass the actor in the body as `createdBy` / `reviewedBy`. Users hold one or more roles (`compliance_analyst`, `compliance_officer`, `lawyer`, `contact_person`, `designated_person`, issue #6): `SeedAdminUser` creates the demo admin `00000000-0000-4000-8000-000000000001` (all roles) and `SeedDemoUsers` four synthetic users `…0002` to `…0005`. The backend does not check roles; the web picks the active role and sends it where it filters data.

| Resource             | Endpoints                                                                                                                                                                                                                                                                                                                                                                                                                            |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/regulations`       | `POST /`, `GET /`, `GET /:id`, `POST /:id/versions`, `GET /:id/versions`, `GET /:id/versions/:versionId`                                                                                                                                                                                                                                                                                                                             |
| `/internal-policies` | as regulations, plus `POST /:id/versions/:versionId/submit` and `POST /:id/versions/:versionId/review`                                                                                                                                                                                                                                                                                                                               |
| `/rules`             | as internal policies, plus `POST /:id/enable`, `POST /:id/disable`, `PUT /:id/active-version`, `GET` / `POST /:id/whitelist`, `DELETE /:id/whitelist/:clientId`                                                                                                                                                                                                                                                                      |
| `/users`             | `GET /`: users with their `roles`, sorted by name                                                                                                                                                                                                                                                                                                                                                                                    |
| `/transactions`      | `GET /?clientId=&from=&to=&limit=&offset=`: transactions newest first; `clientId` must match `K000123`, `from` / `to` are local timestamps (from inclusive, to exclusive), invalid values return 400 (issue #9)                                                                                                                                                                                                                      |
| `/reference-lists`   | `POST /`, `GET /`, `GET /:id`, `POST /:id/versions` (with `items`), `GET /:id/versions`, `GET /:id/versions/:versionId`                                                                                                                                                                                                                                                                                                              |
| `/drafting-jobs`     | `POST /` (start, see below), `GET /?status=&kind=&regulationId=&policyVersionId=&limit=&offset=`, `GET /:jobId`, `POST /:jobId/retry`                                                                                                                                                                                                                                                                                                |
| `/evaluation-runs`   | `POST /` (start a run, see below), `GET /`, `GET /:runId` (summary), `GET /:runId/transactions?verdict=&ruleVersionId=&role=&limit=&offset=`, `GET /:runId/transactions/:transactionId?role=` (detail with trace), `GET /:runId/aml-events?alertType=&clientId=&limit=&offset=` (alerts with their current `triage`, highest priority first), `GET /:runId/aml-events.csv` (mandatory FINREG CSV), `POST /:runId/triage` (see below) |
| `/aml-events`        | `GET /:id`: an alert with its rule and version, the client, the triggering transactions with their rule result, the client's other alerts in the run (issue #13), the current `triage`, every proposal in `triageHistory` (priority factors, log) and the `triageLlmCall` behind the model's proposal (issue #14)                                                                                                                    |
| `/rule-reviews`      | `POST /` (start a gap review, see below), `GET /` (summaries, newest first), `GET /:reviewId` (the whole report)                                                                                                                                                                                                                                                                                                                     |
| `/database-status`   | `GET /`: the connected database (`current_database()`, `version()`, `aurora_version()` or `null`, server address and time, latest migration, `clients` count)                                                                                                                                                                                                                                                                        |

### Evaluation runs

`POST /api/evaluation-runs` runs the active approved versions of all enabled deterministic rules over transactions that are already in the database (agentic rules are not evaluated yet). Body:

```json
{
  "createdBy": "00000000-0000-4000-8000-000000000001",
  "hitThreshold": 50,
  "scope": { "from": "2026-07-01", "to": "2026-07-08T12:00", "clientIds": ["K000001"], "limit": 1000 }
}
```

- The body is optional: `createdBy` defaults to the demo admin, `hitThreshold` to 50. An empty `scope` evaluates all ~400k transactions. `from` is inclusive, `to` exclusive, both local time like `transactions.ts`. `limit` keeps the first transactions in chronological order.
- The response is `202` with the run in status `running`. Poll `GET /:runId`: `run.txProcessed` grows in steps of 1,000 until `status` is `completed` or `failed` (`errorMessage`). The whole dataset takes ~45 s against local Docker.
- The summary has `verdictCounts`, `flaggedClientCount` and, per rule version, `hitCount` and `hitClientCount`. `GET /:runId/transactions?verdict=flagged` lists flagged transactions with `hitRules`. The detail has the trace, features (including the ČNB rate) and `contextRefs` of each hit.
- `role` (issue #6, optional) keeps only hits of rule versions escalated to that role: the list drops transactions without such a hit and `hitRules` lists only those hits; the detail leaves out other roles' hits (other outcomes stay). Without `role` everything is returned. The summary counts are not filtered.
- Only rule results other than `pass` are stored ([V16](../spec/datovy-model.md#rozhodnutí-vyhodnocení)). A passed transaction has its verdict and score, but no per-rule rows.
- Where the run executes: in the API process by default. With `EVALUATION_WORKER_FUNCTION` set, the API invokes that Lambda function asynchronously instead (`backend/src/evaluationWorker.ts`, export `handler`), because a Web Function may remove its environment after the response.
- When the transactions are evaluated, the run groups its hits into AML events (alerts) by the rule's `alertGranularity` before it turns `completed`: `transaction` makes one alert per hit transaction, `client_month` one per client and calendar month. The summary has `amlEventCount` per rule version. `POST /api/rules` accepts `alertGranularity` (default `transaction`); `SetSampleRuleAlertGranularity` sets `client_month` on R-01 and R-04 to R-14. Runs completed before the `AmlEvents` migration have no alerts; start a new run.
- The `SeedSampleRules` migration adds the sample rules R-01 to R-17 from `knowledgebase/pravidla-priklady` as active versions.

### Rule reviews (gap analysis, local only)

`POST /api/rule-reviews` starts the rule gap review of [spec/rule-gap-hunting.md](../spec/rule-gap-hunting.md) over the active rules, or over the versions an evaluation run fixed. Body, all optional: `{ "createdBy": "<user id>", "evaluationRunId": "<run id>", "llm": false }`.

- The response is `202` with the report in status `running`, `409` while another review runs. Poll `GET /:reviewId` (the web does it every 2 s): `progress` moves through `loading`, `baseline`, `feature_sweeps` and `association` until `status` is `completed` or `failed`. The whole dataset takes ~50 s against local Docker; the API stays responsive meanwhile.
- The report holds `findings` (`rule_adjustment`, `new_rule`, `coverage_gap`, `association`) with the affected clients, the `coverageMatrix` of SVZ-03 čl. 7 and the `llm` section. Findings are leads for the compliance officer, never alerts. Nothing is written to the database.
- Reports are JSON files in `RULE_REVIEW_DIR`. That does not work on Lambda, so the router is for local development until iteration 2 picks a store.
- `npm run rule-review` runs the same review from the command line and prints where the report is. `npm run rule-review -- --probe [fx|czk]` prints the sensitivity table (3.5), the association table (4.1) and the perturbation test, with FX conversion and with volume read as CZK.

### Rule escalation

Every rule version has `escalationRole` (default `contact_person`, issue #6): the role whose users handle its hits. `POST /rules/:id/versions` accepts it, and `POST /rules/:id/versions/:versionId/review` may change it together with the decision (`{ "decision": "approved", "reviewedBy": "…", "escalationRole": "designated_person" }`). It is the only version field a review can change.

### Drafting jobs

The LLM steps of the wizard run as jobs, because one step can take minutes (design: [spec/drafting-jobs.md](../spec/drafting-jobs.md)). A `policy_from_regulation` job drafts internal policy versions from a regulation; a `rules_from_policy` job drafts rule versions from an approved policy version. `POST /api/drafting-jobs` body:

```json
{
  "source": { "kind": "markdown", "content": "# Zákon č. 253/2008 Sb. …" },
  "regulation": { "code": "AML", "title": "Zákon č. 253/2008 Sb.", "kind": "law" },
  "versionLabel": "znění od 1. 1. 2026",
  "scope": "Hlava III",
  "createdBy": "00000000-0000-4000-8000-000000000001"
}
```

### Alert triage (issue #14)

- Every completed run stores a rule-based proposal per alert: priority 0–100 from table P of SVZ-03 with its factors, `FP` / `REVIEW` and a reason. For a run created before #14, `POST /api/evaluation-runs/:runId/triage {"source":"rules"}` fills them in.
- `POST /api/evaluation-runs/:runId/triage` takes exactly one of:
  - `{"clientIds":["K000001"]}`: 1 to 20 clients, triaged by Claude on Bedrock within the request; returns `{ triagedClients, failedClients, skippedClients }`. This is the entry point for a button on the alert detail.
  - `{"clientLimit":50}`: the 1 to 100 highest-priority clients the model has not triaged yet, in the background (`202`). Only one background triage per run runs at a time (`409` otherwise).
  - There is no "whole run" mode: one call per client means ~5.5k calls on the PoC run, so a full pass is a deliberate series of `clientLimit` requests, each continuing where the last stopped. A larger request is rejected with `422`, an empty body with `400`.
- Env: `ALERT_TRIAGE=bedrock` turns the model on (default `off`), `TRIAGE_MODEL_ID` (default `eu.anthropic.claude-haiku-4-5-20251001-v1:0`), `TRIAGE_CONCURRENCY` (parallel calls, default 8). Bedrock auth and region as for drafting. One client takes ~7–10 s and ~3–4k input tokens; the whole PoC run is ~5.5k clients.
- The background triage runs in the API process. On the deployed Lambda Web Function the environment can stop mid-way; repeat the request to continue.

- `source` is `{ "kind": "text" | "markdown", "content" }` or `{ "kind": "url", "url" }`. A URL must be `https` on an allowed host (EUR-Lex, e-Sbírka, zakonyprolidi.cz, ČNB, FATF); the worker fetches it, converts HTML to text and stores it as a regulation version.
- `regulation` is `{ "id" }`, new regulation metadata, or omitted for a URL: the worker then reuses the regulation with that `sourceUrl` or creates one with placeholder metadata (code `URL-<host>-<hash>`, the page title, kind `guidance`). `versionLabel`, `scope` and `createdBy` are optional.
- The response is `202` with the job in status `pending` and a `Location` header. Poll `GET /:jobId` (the web does it every 5 s while a job is in flight) until `succeeded` or `failed`. A `pending` or `running` job older than 16 minutes is reported as `failed`.
- A succeeded job lists its drafts with their current review status: `policyVersions` (`id`, `policyId`, `status`) or `ruleVersions` (`id`, `ruleId`, `status`). Rule drafts that fail validation are skipped and listed in `warnings`.
- `POST /api/internal-policies/:id/versions/:versionId/review` with `approved` stores a `rules_from_policy` job together with the review and returns it as `rulesJob` next to the version. `POST /api/regulations/:id/versions/:versionId/draft-policies` starts a job for an existing regulation version and also returns `202`.
- `POST /:jobId/retry` starts a new job with the input of a failed one (`422` otherwise). A URL that was already fetched is not fetched again.
- Where a job executes: in the API process by default. With `DRAFTING_WORKER_FUNCTION` set, the API invokes that Lambda function asynchronously (`backend/src/draftingWorker.ts`, export `handler`). The drafts come from `BedrockDraftGenerator` with `DRAFT_GENERATOR=bedrock` (the deployed worker), otherwise from `DummyDraftGenerator` (`draftingJobComposition.ts`).

Versions are immutable. A version goes `draft` → `pending_review` → `approved` / `rejected`; an approved version becomes `superseded` when a newer one replaces it (rules: on `active-version`, policies: on approval of a newer version). Errors: 400 invalid input, 404 not found, 409 state conflict or duplicate, 422 business rule or unknown reference.

## Scripts (from `src/`)

| Command               | What it does                                                         |
| --------------------- | -------------------------------------------------------------------- |
| `npm run dev`         | Backend (`tsx watch`) and web (`next dev`) together                  |
| `npm run build`       | `tsc` for backend, `next build` for web                              |
| `npm run lint`        | ESLint in both packages                                              |
| `npm test`            | Jest in both packages                                                |
| `npm run format`      | Prettier over the whole workspace                                    |
| `npm run rule-review` | Rule gap review from the CLI; `-- --probe` prints the phase 0 tables |

Run a single package with `-w`, e.g. `npm test -w backend`. Production start: `npm start -w backend`, `npm start -w web`.

## Environment variables

Copy `.env.example` to `.env` in each package if you need to override defaults. Never commit `.env`.

| Package | Variable                     | Default                 | Meaning                                                                                                                          |
| ------- | ---------------------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| backend | `PORT`                       | `4000`                  | API port                                                                                                                         |
| backend | `AWS_LAMBDA_HTTP_ENDPOINT`   | (unset)                 | Set by Lambda Web Functions as `host:port`; overrides `PORT`                                                                     |
| backend | `DATABASE_URL`               | required                | Postgres connection string; no password when `DATABASE_AUTH=iam`                                                                 |
| backend | `DATABASE_AUTH`              | `password`              | `iam` for Aurora `database-1`: fresh IAM token per connection, TLS verified                                                      |
| backend | `AWS_REGION`                 | none                    | Required with `DATABASE_AUTH=iam` (`eu-central-1`)                                                                               |
| backend | `ENGINE_VERSION`             | `local`                 | Code version stored on each evaluation run (V10); `deploy/api.sh` sets the git commit                                            |
| backend | `EVALUATION_WORKER_FUNCTION` | (unset)                 | Lambda function that executes evaluation runs; unset = in the API process. Needs `AWS_REGION`                                    |
| backend | `DRAFTING_WORKER_FUNCTION`   | (unset)                 | Lambda function that executes drafting jobs; unset = in the API process. Needs `AWS_REGION`                                      |
| backend | `RULE_REVIEW_DIR`            | `backend/.rule-reviews` | Where rule review reports are written (git-ignored)                                                                              |
| backend | `RULE_REVIEW_LLM`            | `off`                   | `bedrock` switches on the Bedrock explanations, summary and rule hypotheses of the rule review; uses the `BEDROCK_*` variables   |
| web     | `BACKEND_URL`                | `http://localhost:4000` | Server-only. Backend base URL for the `/api/*` proxy; baked into the rewrite at build time                                       |
| web     | `NEXT_PUBLIC_API_MODE`       | `mock`                  | Default data source (`mock` or `live`); the sidebar switch overrides it per browser                                              |
| web     | `NEXT_PUBLIC_API_MODE_<SVC>` | (unset)                 | Per-service override, `<SVC>` is `REGULATIONS`, `POLICIES`, `RULES`, `BATCHES`, `WIZARD`, `DASHBOARD`, `USERS` or `TRANSACTIONS` |

Web env is validated with Zod in `web/config/env.client.ts` (`NEXT_PUBLIC_*` only, inlined at build time) and `web/config/env.server.ts` (`server-only`). Future secrets (API keys) must never use the `NEXT_PUBLIC_` prefix; on AWS pass them to the Web Function with `--env` in `deploy/web.sh` (or keep them in Secrets Manager).

AWS (Bedrock) access uses the standard AWS credential chain (profile / env). No credentials in code or `.env.example`.

## Structure

```
src/
├── package.json            workspace root, shared scripts
├── docker-compose.yml      local Postgres for development
├── backend/src/
│   ├── main.ts             entry point: config + server start
│   ├── config.ts           env parsing, fails fast on invalid values
│   ├── domain/             entities and pure business rules
│   ├── application/        use cases and ports (interfaces)
│   ├── infrastructure/     TypeORM, Bedrock and file adapters
│   │   └── database/       DataSource, entities/, migrations/
│   └── delivery/http/      Express app, routers, central error handler
└── web/
    ├── app/                routes (App Router) only: thin pages that render feature screens
    ├── components/         shared UI (ui/) and the app shell with the sidebar (layout/)
    ├── config/             Zod-validated env, per-service API mode, fixed current user
    ├── features/<feature>/ regulations, policies, rules, batches, wizard, dashboard
    │   ├── types.ts        domain types + Zod schemas (also used to validate live responses)
    │   ├── api/            contract.ts (interface), live.ts, service.ts (resolver), hooks.ts (React Query)
    │   └── components/     screens and feature components
    ├── i18n/               en/cs dictionaries and the locale provider (cookie-persisted)
    ├── lib/                HTTP client, ApiError, formatting
    ├── mocks/              all mock services, seed data and the mock evaluation engine
    └── providers/          React Query, data source (api mode), i18n and mock-usage providers
```

Web routes: `/` dashboard, `/regulations[/id]`, `/policies[/id]`, `/rules`, `/rules/new`, `/rules/[id]`, `/batches`, `/batches/[id]?bucket=ok|to_check|alert`, `/batches/[id]/transactions/[transactionId]`, `/wizard[?regulationId=]`.

## Web: mock and live data

Every feature service has one contract and two implementations. The UI only uses the hooks and never knows which one runs:

```
component → features/<f>/api/hooks.ts → service.ts (resolveService) → live.ts  (fetch /api/..., Zod-validated)
                                                                     → mocks/services/<f>.mock.ts (localStorage)
```

- The global data source is switched at runtime with **Data source: Mock / Live** in the sidebar footer. `NEXT_PUBLIC_API_MODE` (default `mock`) only sets the default; the sidebar choice overrides it per browser (localStorage `redflag.apiMode`). Priority: localStorage, then env, then `mock`.
- **Mock** puts every service on mock data (full demo, all capabilities on). **Live** uses the API, except services pinned by `NEXT_PUBLIC_API_MODE_<SVC>` (e.g. `BATCHES=mock`); capabilities hide what live cannot do yet. The wizard writes regulations, policies and rules, so it is shown only when all four share one data source.
- `resolveService` returns a proxy that picks the implementation on every call, and the capability hooks read the mode from `useApiMode()` (`providers/ApiModeProvider.tsx`), so the UI never branches on the mode itself. A switch resets the React Query cache, so data of the two sources never mixes. The server renders the env default and the stored choice applies right after hydration.
- Live mode calls relative `/api/...` (proxied to `BACKEND_URL`) and fails explicitly with an error state, Retry and "Switch to mock". It never falls back to mocks on its own.
- Mock state lives in the browser's localStorage. "Reset demo data" in the sidebar restores the deterministic seed. While a screen uses a mocked service, the sidebar shows "Mock data, not connected to API". The sidebar's Database panel (`features/databaseStatus/`, hidden by `IS_DATABASE_STATUS_VISIBLE` in `components/layout/Sidebar.tsx`) has no mock and always calls `/api/database-status` when shown.
- Seed data (`mocks/seed/`) is sampled from the synthetic vendor datasets (30 clients, 150 transactions) plus regulations from `knowledgebase/regulace/seznam_regulaci.md`, 8 policies and 14 rules. Provision references and the high-risk country list are illustrative demo values.
- Batches in mock mode: the CSV is parsed and evaluated in the browser. Only the first 2,000 rows are stored (localStorage is ~5 MB); the UI shows evaluated vs. file rows. Progress is simulated (3–8 s). Score thresholds (fail ≥ 40, alert ≥ 75 after sensitivity) are demo values that need compliance review.

### Implementing a live adapter

1. Check the endpoints the backend exposes against `features/<f>/api/live.ts` (the current paths are a proposed contract, e.g. `POST /api/batches` multipart, `GET /api/batches/:id/transactions?bucket=&cursor=`).
2. If the backend DTO differs from the domain type, map it in `live.ts` only; keep `types.ts` and the UI unchanged.
3. Switch the service with `NEXT_PUBLIC_API_MODE_<SVC>=live` (or `NEXT_PUBLIC_API_MODE=live` for all) and rebuild, then select Live in the sidebar.

## Where to edit

- New API endpoint: add a router in `backend/src/delivery/http/`, mount it in `createApp.ts`. Business logic goes to `application/` and `domain/`, not into routers.
- Database schema: add or change an entity in `backend/src/infrastructure/database/entities/`, then `npm run migration:generate -- <Name>`, review the generated SQL, and run `npm run migration:run`. Allowed values for text columns (client type, transaction type, …) live in `backend/src/domain/` and feed both the entity types and their check constraints.
- New page: add a folder with `page.tsx` under `web/app/` that renders a screen from `web/features/<f>/components/`.
- New async data: extend the feature `contract.ts`, then implement it in both `live.ts` and `mocks/services/<f>.mock.ts`, and expose it via a hook in `hooks.ts` that calls `useServiceUsage`.
- UI text: add the key to `web/i18n/en.ts` and `web/i18n/cs.ts` (the type check enforces both).
- Theme (colors, spacing, radius, shadows): CSS custom properties in `web/app/globals.css`.
- Component styles: the `*.module.css` file next to the component.

## Deployment

Both apps run as AWS Lambda Web Functions in `eu-central-1`, team account `526983806399`: `rfm-api` (Express) and `rfm-web` (Next.js standalone). Each gets a public HTTPS endpoint `dev`: web https://vkdtj1g7xt7fqkkn.clq.lambda-web.eu-central-1.on.aws, API https://pzrs33rhnqf7x5fm.clq.lambda-web.eu-central-1.on.aws. The web proxies `/api/*` to the API endpoint. Scripts live in [`../deploy/`](../deploy) and need Docker, the AWS CLI with `lambda-web` and the `hackathon` SSO profile. They refuse to run against any other account or region.

```bash
cd src
npm run deploy                   # roles, then drafting worker, then API, then web
npm run deploy:roles             # rfm-api-execution, rfm-web-execution, rfm-drafting-worker-execution
npm run deploy:drafting-worker   # backend bundle → rfm-drafting-worker (classic Lambda)
npm run deploy:api               # backend bundle → rfm-api
npm run deploy:web               # web bundle → rfm-web, reads the rfm-api endpoint for BACKEND_URL
```

- Roles: least-privilege execution roles instead of the CLI's auto-created `awscli-lambdaweb-*`. Both may write their own log groups `/aws/lambda/web/<name>` and `/aws/lambda/web/<name>.local`. The API role may also `rds-db:connect` as `postgres` on `database-1` and invoke Anthropic models through the `eu.anthropic.*` inference profiles only.
- API bundle: `tsc` output plus a production-only `npm ci` in a `node:24` arm64 container. Env: `DATABASE_AUTH=iam`, `DATABASE_URL=postgres://postgres@<cluster endpoint>:5432/main` (`RFM_DATABASE=wip_<name> npm run deploy:api` for a work copy). The server listens before it touches the database; the DataSource initializes on the first request that needs it, because Web Functions require a listening server within 10 s and an Aurora resume takes ~15 s. Run `npm run migration:run` against `main` before deploying code that needs a new migration. `ALERT_TRIAGE=bedrock` and `BEDROCK_AUTH=iam` turn on the LLM alert triage (#14), signed with the execution role, which may invoke the EU Anthropic profiles.
- Drafting worker: the same backend bundle zipped into a classic Lambda `rfm-drafting-worker` (Node 24, arm64, 900 s, handler `backend/dist/draftingWorker.handler`), with no Lambda retries (a failed job is retried by the user) and up to 3 reserved concurrent executions where the account quota allows. Its role may write `/aws/lambda/rfm-drafting-worker`, connect to Aurora and invoke Anthropic models through the EU profiles. Env `DRAFT_GENERATOR=bedrock` drafts with Claude on Bedrock (`BedrockDraftGenerator`), `BEDROCK_AUTH=iam` signs the calls with the role's credentials, so the role needs no `bedrock:CallWithBearerToken`. The API gets `DRAFTING_WORKER_FUNCTION=rfm-drafting-worker` and may invoke only this function. Deploy the worker before the API.
- Web bundle: the `build` stage of `web/Dockerfile` for arm64, then `.next/standalone` plus static assets and `deploy/web/index.js`, which maps `AWS_LAMBDA_HTTP_ENDPOINT` to `HOSTNAME`/`PORT`. `BACKEND_URL` and `NEXT_PUBLIC_*` are baked in at build time, so redeploy the web after changing them or after the API endpoint changes. The deployed UI calls the real backend (`NEXT_PUBLIC_API_MODE` defaults to `live` here, unlike local dev); `NEXT_PUBLIC_API_MODE=mock npm run deploy:web` switches it to browser-only demo data.
- Endpoints are public (`ApplicationManaged` auth) and the API has no authentication yet, so it only ever points at synthetic and organiser data. The URLs stay the same across redeploys.
- Fallback: the `runtime` stage of `web/Dockerfile` is a plain container image for ECS Express.

Audit log (#5): CloudWatch Logs Insights → Saved queries → `rfm/audit` lists every `[audit]` line of the API and the drafting worker with `action`, `entityType`, `entityId`, `actorId` and `payload`. Narrow it with e.g. `| filter entityId = "<id>"` or `| filter action like /^rule\./`. `deploy:roles` creates the query and keeps those log groups 10 years (AML Act § 16), the web's 14 days.

Endpoint URLs: `aws lambda-web get-web-function-endpoint --function-name rfm-web --endpoint-name dev --query domainName --output text` (same for `rfm-api`). Logs: CloudWatch log groups `/aws/lambda/web/rfm-api` and `/aws/lambda/web/rfm-web` (`aws logs tail /aws/lambda/web/rfm-api --follow`). The runtime also writes to a sibling `<group>.local`; if the execution role can't write to it, no logs arrive in either group. `deploy:roles` creates all of them: 10-year retention for the API and drafting worker groups (audit log), 14 days for the web. A role change reaches only new environments, so redeploy afterwards (`aws lambda-web deploy --name rfm-api` with no `--code` makes a config-only revision).
