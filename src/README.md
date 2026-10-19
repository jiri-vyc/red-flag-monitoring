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

### Against Aurora instead of Docker

Only the backend talks to the database, so only `backend/.env` changes. The backend never runs migrations on start, so pointing it at the shared `main` database doesn't change the schema.

1. Sign in to the team account and check that it is `526983806399`:

   ```bash
   aws sso login --sso-session hackathon
   AWS_PROFILE=hackathon aws sts get-caller-identity --query Account --output text
   ```

2. In `backend/.env`, swap the Docker `DATABASE_URL` for the Aurora block (it's in `backend/.env.example`, commented out):

   ```dotenv
   DATABASE_AUTH=iam
   DATABASE_URL=postgres://postgres@database-1.cluster-c9m6a2a047k1.eu-central-1.rds.amazonaws.com:5432/main
   AWS_REGION=eu-central-1
   AWS_PROFILE=hackathon
   ```

   The URL has no password. The backend signs a fresh IAM token for every connection and verifies TLS. Use `wip_<name>` instead of `main` for your own copy (`../db/create-wip.sh <name>`).

3. Start it with `npm run dev`. You don't need `npm run db:up` or `npm run migration:run`.

4. Check it. The **Database** panel in the sidebar should show `Aurora PostgreSQL <version>`, the database name, the `clients` row count (5,493), the latest applied migration and the server time of the check. Click the refresh icon to query again. Or call the endpoint directly:

   ```bash
   curl -s localhost:4000/api/database-status
   ```

   A local Docker Postgres shows `PostgreSQL <version>, not Aurora`. A red "Database unreachable" means the backend or the database didn't answer.

Things to know:

- **Migrations:** while `.env` points at `main`, every `npm run migration:*` from `src/` hits `main` too. Use `migration:run` there only to apply reviewed migrations. Never run `migration:generate` against `main`, only against your `wip_<name>` (see `../AGENTS.md`).
- **Slow first request:** the first database request can take up to 45 s while Aurora resumes. An expired SSO session shows up as a 500 on the first request that needs the database. Run `aws sso login` again.
- **Mock screens:** the screens stay on mock data until you set `NEXT_PUBLIC_API_MODE=live` in `web/.env.local` (see [Web: mock and live data](#web-mock-and-live-data)). The Database panel always calls the backend.
- **Switching back to Docker:** restore the Docker `DATABASE_URL` and drop `DATABASE_AUTH`.

## API

There is no auth yet (M12 in `spec/datovy-model.md`). Calls that create or review data pass the actor in the body as `createdBy` / `reviewedBy`; the `SeedAdminUser` migration creates the single admin `00000000-0000-4000-8000-000000000001`.

| Resource             | Endpoints                                                                                                                                                                                             |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/regulations`       | `POST /`, `GET /`, `GET /:id`, `POST /:id/versions`, `GET /:id/versions`, `GET /:id/versions/:versionId`                                                                                              |
| `/internal-policies` | as regulations, plus `POST /:id/versions/:versionId/submit` and `POST /:id/versions/:versionId/review`                                                                                                |
| `/rules`             | as internal policies, plus `POST /:id/enable`, `POST /:id/disable`, `PUT /:id/active-version`, `GET` / `POST /:id/whitelist`, `DELETE /:id/whitelist/:clientId`                                       |
| `/reference-lists`   | `POST /`, `GET /`, `GET /:id`, `POST /:id/versions` (with `items`), `GET /:id/versions`, `GET /:id/versions/:versionId`                                                                               |
| `/evaluation-runs`   | `POST /` (start a run, see below), `GET /`, `GET /:runId` (summary), `GET /:runId/transactions?verdict=&ruleVersionId=&limit=&offset=`, `GET /:runId/transactions/:transactionId` (detail with trace) |
| `/database-status`   | `GET /`: the connected database (`current_database()`, `version()`, `aurora_version()` or `null`, server address and time, latest migration, `clients` count)                                         |

### Evaluation runs

`POST /api/evaluation-runs` runs the active approved versions of all enabled deterministic rules over transactions that are already in the database (agentic rules are not evaluated yet). Body:

```json
{
  "createdBy": "00000000-0000-4000-8000-000000000001",
  "hitThreshold": 50,
  "scope": { "from": "2026-07-01", "to": "2026-07-08T12:00", "clientIds": ["K000001"], "limit": 1000 }
}
```

- Everything except `createdBy` is optional. An empty `scope` evaluates all ~400k transactions. `from` is inclusive, `to` exclusive, both local time like `transactions.ts`. `limit` keeps the first transactions in chronological order.
- The response is `202` with the run in status `running`. Poll `GET /:runId`: `run.txProcessed` grows in steps of 1,000 until `status` is `completed` or `failed` (`errorMessage`). The whole dataset takes ~45 s against local Docker.
- The summary has `verdictCounts`, `flaggedClientCount` and, per rule version, `hitCount` and `hitClientCount`. `GET /:runId/transactions?verdict=flagged` lists flagged transactions with `hitRules`. The detail has the trace, features (including the ČNB rate) and `contextRefs` of each hit.
- Only rule results other than `pass` are stored ([V16](../spec/datovy-model.md#rozhodnutí-vyhodnocení)). A passed transaction has its verdict and score, but no per-rule rows.
- Where the run executes: in the API process by default. With `EVALUATION_WORKER_FUNCTION` set, the API invokes that Lambda function asynchronously instead (`backend/src/evaluationWorker.ts`, export `handler`), because a Web Function may remove its environment after the response.
- The `SeedSampleRules` migration adds the sample rules R-01 to R-17 from `knowledgebase/pravidla-priklady` as active versions.

Versions are immutable. A version goes `draft` → `pending_review` → `approved` / `rejected`; an approved version becomes `superseded` when a newer one replaces it (rules: on `active-version`, policies: on approval of a newer version). Errors: 400 invalid input, 404 not found, 409 state conflict or duplicate, 422 business rule or unknown reference.

## Scripts (from `src/`)

| Command          | What it does                                        |
| ---------------- | --------------------------------------------------- |
| `npm run dev`    | Backend (`tsx watch`) and web (`next dev`) together |
| `npm run build`  | `tsc` for backend, `next build` for web             |
| `npm run lint`   | ESLint in both packages                             |
| `npm test`       | Jest in both packages                               |
| `npm run format` | Prettier over the whole workspace                   |

Run a single package with `-w`, e.g. `npm test -w backend`. Production start: `npm start -w backend`, `npm start -w web`.

## Environment variables

Copy `.env.example` to `.env` in each package if you need to override defaults. Never commit `.env`.

| Package | Variable                     | Default                 | Meaning                                                                                                 |
| ------- | ---------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------- |
| backend | `PORT`                       | `4000`                  | API port                                                                                                |
| backend | `AWS_LAMBDA_HTTP_ENDPOINT`   | (unset)                 | Set by Lambda Web Functions as `host:port`; overrides `PORT`                                            |
| backend | `DATABASE_URL`               | required                | Postgres connection string; no password when `DATABASE_AUTH=iam`                                        |
| backend | `DATABASE_AUTH`              | `password`              | `iam` for Aurora `database-1`: fresh IAM token per connection, TLS verified                             |
| backend | `AWS_REGION`                 | none                    | Required with `DATABASE_AUTH=iam` (`eu-central-1`)                                                      |
| backend | `ENGINE_VERSION`             | `local`                 | Code version stored on each evaluation run (V10); `deploy/api.sh` sets the git commit                   |
| backend | `EVALUATION_WORKER_FUNCTION` | (unset)                 | Lambda function that executes evaluation runs; unset = in the API process. Needs `AWS_REGION`           |
| web     | `BACKEND_URL`                | `http://localhost:4000` | Server-only. Backend base URL for the `/api/*` proxy; baked into the rewrite at build time              |
| web     | `NEXT_PUBLIC_API_MODE`       | `mock`                  | Default data source (`mock` or `live`); the sidebar switch overrides it per browser                     |
| web     | `NEXT_PUBLIC_API_MODE_<SVC>` | (unset)                 | Per-service override, `<SVC>` is `REGULATIONS`, `POLICIES`, `RULES`, `BATCHES`, `WIZARD` or `DASHBOARD` |

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
- Mock state lives in the browser's localStorage. "Reset demo data" in the sidebar restores the deterministic seed. While a screen uses a mocked service, the sidebar shows "Mock data, not connected to API". The sidebar's Database panel (`features/databaseStatus/`) has no mock and always calls `/api/database-status`.
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
npm run deploy          # roles, then API, then web
npm run deploy:roles    # rfm-api-execution, rfm-web-execution
npm run deploy:api      # backend bundle → rfm-api
npm run deploy:web      # web bundle → rfm-web, reads the rfm-api endpoint for BACKEND_URL
```

- Roles: least-privilege execution roles instead of the CLI's auto-created `awscli-lambdaweb-*`. Both may write their own log groups `/aws/lambda/web/<name>` and `/aws/lambda/web/<name>.local`. The API role may also `rds-db:connect` as `postgres` on `database-1` and invoke Anthropic models through the `eu.anthropic.*` inference profiles only.
- API bundle: `tsc` output plus a production-only `npm ci` in a `node:24` arm64 container. Env: `DATABASE_AUTH=iam`, `DATABASE_URL=postgres://postgres@<cluster endpoint>:5432/main` (`RFM_DATABASE=wip_<name> npm run deploy:api` for a work copy). The server listens before it touches the database; the DataSource initializes on the first request that needs it, because Web Functions require a listening server within 10 s and an Aurora resume takes ~15 s. Run `npm run migration:run` against `main` before deploying code that needs a new migration.
- Web bundle: the `build` stage of `web/Dockerfile` for arm64, then `.next/standalone` plus static assets and `deploy/web/index.js`, which maps `AWS_LAMBDA_HTTP_ENDPOINT` to `HOSTNAME`/`PORT`. `BACKEND_URL` and `NEXT_PUBLIC_*` are baked in at build time, so redeploy the web after changing them or after the API endpoint changes. The deployed UI calls the real backend (`NEXT_PUBLIC_API_MODE` defaults to `live` here, unlike local dev); `NEXT_PUBLIC_API_MODE=mock npm run deploy:web` switches it to browser-only demo data.
- Endpoints are public (`ApplicationManaged` auth) and the API has no authentication yet, so it only ever points at synthetic and organiser data.
- Fallback: the `runtime` stage of `web/Dockerfile` is a plain container image for ECS Express.

Endpoint URLs: `aws lambda-web get-web-function-endpoint --function-name rfm-web --endpoint-name dev --query domainName --output text` (same for `rfm-api`). Logs: CloudWatch log groups `/aws/lambda/web/rfm-api` and `/aws/lambda/web/rfm-web` (`aws logs tail /aws/lambda/web/rfm-api --follow`). The runtime also writes to a sibling `<group>.local`; if the execution role can't write to it, no logs arrive in either group. `deploy:roles` creates all four with 14-day retention. A role change reaches only new environments, so redeploy afterwards (`aws lambda-web deploy --name rfm-api` with no `--code` makes a config-only revision).
