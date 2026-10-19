# Testing

All commands run from `src/`.

| Command               | What                                                                |
| --------------------- | ------------------------------------------------------------------- |
| `npm test`            | Jest in both packages                                               |
| `npm test -w web`     | Web only (`next/jest`, jsdom, Testing Library)                      |
| `npm test -w backend` | Backend only (`ts-jest`, supertest)                                 |
| `npm run lint`        | ESLint in both packages                                             |
| `npm run build`       | `tsc` (backend) and `next build` (web); also the type check for web |

Before a commit, `npm run lint && npm test && npm run build` must pass (see [src/AGENTS.md](src/AGENTS.md)).

## Web tests

Tests sit next to the code as `*.test.ts(x)`. The `@/` import alias maps to `src/web/`.

- `features/rules/domain/ruleLifecycle.test.ts`: rule status transitions and versioning.
- `mocks/evaluation/csvTransactions.test.ts`: CSV parsing and row validation (date, time, currency).

Focus tests on pure logic: domain state machines, parsers and mappers. Screens are checked manually in `npm run dev -w web` with mock data. Use "Reset demo data" in the sidebar to get back to the deterministic seed.

## Backend tests

Tests sit next to the code in `backend/src/` (e.g. `config.test.ts`, `delivery/http/createApp.test.ts`, which uses supertest).
