# AGENTS.md – src/

Rules for the app code. Repo-wide rules are in [../AGENTS.md](../AGENTS.md); code style follows https://github.com/jiri-vyc/ai-clean-code-best-practices.

## Backend layers (`backend/src/`)

Dependencies point inward: `delivery` → `application` → `domain`. `infrastructure` implements interfaces declared in `application`.

- `domain/` must not import Express, TypeORM, AWS SDK or any other layer.
- Routers only parse/validate input, call a use case and map the result to HTTP. No business logic in routers.
- Map expected application errors to HTTP status codes in `delivery/http/errorHandler.ts` only.
- Database: PostgreSQL via TypeORM. `synchronize` is off; every schema change is a migration in `infrastructure/database/migrations/`. Never edit a migration that is already on `main`, add a new one.
- TypeORM entities live in `infrastructure/database/entities/` and are mapped to domain types in repositories. They must not be imported from `domain/` or `application/`.
- Wire dependencies by hand in `createApp` / `main.ts`. No DI container until wiring gets large.

## Rule evaluation

Hackathon shortcut, see [spec D18](../spec/spec.md#2-klíčová-rozhodnutí).

- One transaction triggers one evaluation. Deterministic rule checkers are pure functions of the transaction, the client, the client's transaction history and the rule config. They never query the database.
- The evaluation use case loads the client's whole transaction history into memory once, or takes it from the caller, and passes the same history to every rule. Don't add per-rule windowed SQL, streaming or pagination; the dataset has at most 107 transactions per client.
- The history is every transaction of the client in the database at run time ([V4](../spec/datovy-model.md#rozhodnutí-vyhodnocení)), including ones after the evaluated transaction. Rules that must not look ahead filter by `occurredAt` themselves.
- The run engine: `application/evaluationRuns/` (`EvaluationRunUseCases.startRun`, `EvaluationRunExecutor`) on top of the pure `domain/transactionEvaluator.ts` and `domain/evaluateTransaction.ts`. Rule results with outcome `pass` are not stored (V16).
- Deterministic rules compare features from the catalogue in `backend/src/domain/features/`. Read its [README](backend/src/domain/features/README.md) before adding a feature or wiring the evaluation use case.

## Web (`web/`)

- Server components by default; add `"use client"` only for interactivity.
- Browser code calls the backend via relative `/api/...` (proxied by `next.config.ts`). Server code reads `serverEnv` from `config/env.server.ts`.
- Styling: CSS Modules + custom properties from `app/globals.css`. No Tailwind, no UI libraries.

## Checks before commit

`npm run lint && npm test && npm run build` from `src/` must pass. Run `npm run format` on changed files.
