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

Rule statuses: `draft`, `pending_for_review`, `update_for_review`, `active`, `inactive`. A rule returns a score of 0–100 and a trace. The adjusted score is `score × sensitivity / 100`. Each rule version holds its content (code + Czech explanation, or agentic rule text) and its config (sensitivity, risk profiles). Any edit of content or config creates a new version that goes to review (data model M7). Evaluation always uses the running approved version, never a pending one. The client whitelist is not versioned: it lives at rule level as rule × client entries with a required reason (M16), and changes apply immediately without review. Regulatory-mandatory rules have `whitelistAllowed = false`. Each batch snapshots the whitelist together with the rule versions, so past batches stay reproducible. Whitelist approval and periodic review (CNB benchmark 2/2023) are not in the MVP and need compliance review.

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
- **Mode selection:** `config/apiMode.ts`. `NEXT_PUBLIC_API_MODE` sets the global default (`mock`), and `NEXT_PUBLIC_API_MODE_<SVC>` overrides it per service. Live mode never falls back to mocks.
- **Mock-only code:** everything lives in `mocks/`, including the browser evaluation engine (`mocks/evaluation`) and the generation templates (`mocks/generation`).
- **i18n:** `i18n/en.ts` and `i18n/cs.ts` are typed dictionaries. The locale is stored in a cookie and read in the root layout, so the server and client render the same text. Only UI strings are translated, not data.
- **Env:** `config/env.client.ts` holds `NEXT_PUBLIC_*` only. `config/env.server.ts` holds `server-only` values (`BACKEND_URL`). Secrets go in Vercel env vars, never in `NEXT_PUBLIC_*`.
- **Styling:** CSS Modules plus tokens in `app/globals.css`. The UI is light only. The root font size is fluid (`clamp`) so the app is readable on a projector. Runtime dependencies are `lucide-react`, `@tanstack/react-query` and `zod`.

## Deployment

- **Web:** Vercel, with Root Directory `src/web`.
- **Backend:** AWS (see [src/README.md](src/README.md#deployment)).
