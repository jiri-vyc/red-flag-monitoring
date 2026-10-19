# Red-flag monitoring – app

npm workspace with two packages:

- `backend/` – REST API. Node.js 24, TypeScript, Express 5. TypeORM is installed but not wired yet: no database for now.
- `web/` – UI. Next.js 16 (App Router), React 19, TypeScript, CSS Modules.

Tooling: ESLint, Prettier, Jest (`ts-jest` in backend, `next/jest` + Testing Library in web).

## Run locally

```bash
cd src
npm install
npm run dev
```

- Web: http://localhost:3000
- API: http://localhost:4000/api/health

The web proxies `/api/*` to the backend, so browser code calls relative `/api/...` URLs.

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

| Package | Variable      | Default                 | Meaning                                                       |
| ------- | ------------- | ----------------------- | ------------------------------------------------------------- |
| backend | `PORT`        | `4000`                  | API port                                                      |
| web     | `BACKEND_URL` | `http://localhost:4000` | Backend base URL for server components and the `/api/*` proxy |

AWS (Bedrock) access uses the standard AWS credential chain (profile / env). No credentials in code or `.env.example`.

## Structure

```
src/
├── package.json            workspace root, shared scripts
├── backend/src/
│   ├── main.ts             entry point: config + server start
│   ├── config.ts           env parsing, fails fast on invalid values
│   ├── domain/             entities and pure business rules
│   ├── application/        use cases and ports (interfaces)
│   ├── infrastructure/     TypeORM, Bedrock and file adapters
│   └── delivery/http/      Express app, routers, central error handler
└── web/
    ├── app/                routes (App Router), global styles
    ├── components/         reusable UI components + their CSS Modules
    └── lib/                config and backend API calls
```

## Where to edit

- New API endpoint: add a router in `backend/src/delivery/http/`, mount it in `createApp.ts`. Business logic goes to `application/` and `domain/`, not into routers.
- New page: add a folder with `page.tsx` under `web/app/`.
- Theme (colors, spacing, radius, shadows): CSS custom properties in `web/app/globals.css`.
- Component styles: the `*.module.css` file next to the component.

## Deployment

- Web: deploy `src/web` to Vercel (set Root Directory to `src/web`) and set `BACKEND_URL` to the deployed API.
- Backend: long-running Node server; within the AWS stack (see root `AGENTS.md`), e.g. App Runner, ECS or Lambda behind API Gateway. `npm run build -w backend` then `node dist/main.js`.
