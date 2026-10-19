# AGENTS.md – src/

Rules for the app code. Repo-wide rules are in [../AGENTS.md](../AGENTS.md); code style follows https://github.com/jiri-vyc/ai-clean-code-best-practices.

## Backend layers (`backend/src/`)

Dependencies point inward: `delivery` → `application` → `domain`. `infrastructure` implements interfaces declared in `application`.

- `domain/` must not import Express, TypeORM, AWS SDK or any other layer.
- Routers only parse/validate input, call a use case and map the result to HTTP. No business logic in routers.
- Map expected application errors to HTTP status codes in `delivery/http/errorHandler.ts` only.
- Wire dependencies by hand in `createApp` / `main.ts`. No DI container until wiring gets large.

## Web (`web/`)

- Server components by default; add `"use client"` only for interactivity.
- Browser code calls the backend via relative `/api/...` (proxied by `next.config.ts`). Server code uses `backendUrl` from `lib/config.ts`.
- Styling: CSS Modules + custom properties from `app/globals.css`. No Tailwind, no UI libraries.

## Checks before commit

`npm run lint && npm test && npm run build` from `src/` must pass. Run `npm run format` on changed files.
