# AGENTS.md

Working rules for AI agents and humans on this repo. Hackathon project: AML transaction monitoring (triage and red-flag escalation), Track 5 · Compliance and RegTech copilots, FinTechers hackathon, challenge by FINREG PARTNERS.

## Stack

- AWS, primarily Amazon Bedrock. Prefer Bedrock-hosted models and AWS-native services over external APIs.
- Use the AWS CLI (`aws`) for AWS operations. Do not hardcode credentials; rely on the configured profile or environment.

## Code style
- follow strictly https://github.com/jiri-vyc/ai-clean-code-best-practices 

## Data handling (strict)

- It is strictly forbidden to move data outside the hackathon environment without explicit human authorisation. This covers uploading to third-party APIs, public repos, paste sites, external LLM endpoints, personal cloud storage, and local copies outside the project.
- Ask a human before any action that would send data beyond the hackathon environment.
- Committing datasets to the repo is allowed only if they are organiser-provided, derived from organiser-provided data, or synthetic (e.g. `datasets/`). Never commit real personal data (names, account numbers, national IDs, or financial records).

## AWS accounts

Only these accounts may be used for this project:

| Account ID | Purpose |
| --- | --- |
| `526983806399` | Team space |
| `422928733782` | Read-only vendor datasets, S3 bucket `ai-hackathon-datasets-422928733782` |

Do not use any other AWS account. Verify the active account (`aws sts get-caller-identity`) before running AWS commands that create or change resources. Treat account `422928733782` as read-only.

## Database

One Aurora PostgreSQL cluster, `database-1` (eu-central-1, Express configuration). It has a public endpoint, IAM-token auth and master user `postgres`. It holds synthetic and organiser data only. Inside it we keep separate databases, the way a microservice in a large system would have its own:

| Database | Purpose |
| --- | --- |
| `golden` | Init state built by the TypeORM baseline migrations (`InitialSchema`, `ClientsAndTransactions`, `LoadDatasets`): `clients` and `transactions` loaded from `datasets/`. Frozen (`is_template = true`, `allow_connections = false`). Never migrate, edit or unfreeze it without a human's OK. |
| `main` | Shared integration database, created from `golden`. Every later migration lands here. |
| `wip_<name>` | Disposable work copies for a person or agent. Drop them when done. |
| `postgres` | Admin only (`create database` / `drop database`). Never create objects in it. |

- Connect with `db/psql.sh <database> [psql args]`. It enforces the team account, uses `AWS_PROFILE=hackathon` and generates a fresh IAM token.
- Create a work copy with `db/create-wip.sh <name>`. It creates `wip_<name>` from `golden`, fixes TypeORM's metadata for the new name and runs pending migrations, so the copy is exactly `golden` plus migrations. Drop it with `db/psql.sh postgres -c 'drop database wip_<name>'`.
- Never copy a database with a bare `create database … template …`. TypeORM keys generated-column metadata on the database name, so a raw copy makes `migration:generate` emit a drop/re-add of `transactions.counterparty_*`. If you must, run `update typeorm_metadata set database = current_database()` in the copy.
- Point the backend or the TypeORM CLI at Aurora with `DATABASE_AUTH=iam`, `DATABASE_URL=postgres://postgres@<cluster endpoint>:5432/<database>` (no password) and `AWS_REGION=eu-central-1` (see `src/backend/.env.example`).
- Recreating `main` (drop, `create database main template golden`, metadata fix-up, `migration:run`) destroys whatever is in it. It needs a human's OK. Take a cluster snapshot first.

## Deployment

The shared deployment, the one everyone demos and tests against:

| What | URL |
| --- | --- |
| Web | https://vkdtj1g7xt7fqkkn.clq.lambda-web.eu-central-1.on.aws |
| API | https://pzrs33rhnqf7x5fm.clq.lambda-web.eu-central-1.on.aws |
| DB probe | https://pzrs33rhnqf7x5fm.clq.lambda-web.eu-central-1.on.aws/api/database-status |

- Lambda Web Functions `rfm-web` and `rfm-api` (endpoint `dev`) in `526983806399`, `eu-central-1`. The API is connected to the database `main`.
- Deploy with `npm run deploy` from `src/` (or `deploy:api`, `deploy:web`, `deploy:roles`; scripts in `deploy/`, details in [src/README.md](src/README.md#deployment)). The scripts build from the working tree, so deploy only committed `main` from a clean checkout. A deploy replaces what everyone sees.
- After a deploy, check that `/api/database-status` reports `"databaseName": "main"` and a non-null `auroraVersion`.

## Schema changes

Schema and data transforms change only through TypeORM migrations in `src/backend/src/infrastructure/database/migrations/` (rules in [src/AGENTS.md](src/AGENTS.md)). That way the change is visible to everyone, and the path from `golden` to the current `main` can be reconstructed from git plus each database's `migrations` table.

1. Change or add an entity in `src/backend/src/infrastructure/database/entities/`, then generate the migration against your `wip_<name>`: `npm run migration:generate -- <Name>` from `src/`, with the env vars above. Review the generated SQL. Hand-write data migrations with `npm run migration:create -- <Name>`. Never run ad-hoc DDL or data fixes against `main`.
2. Apply it to your `wip_<name>` with `npm run migration:run`. Then apply it to `main` by pointing `DATABASE_URL` at `main`. All pending migrations run in one transaction.
3. Commit the migration file right after applying it to `main`, in a commit of its own or together with the code that needs it.
4. Never edit, rename or delete a migration once it has been applied to `main`; write a new one.
5. Never run `migration:generate` against `main` or `golden`, only against your `wip_<name>`.

## Documentation sync

Every change to the backend or its API (new or changed endpoint, request/response shape, domain rule, data model) updates the docs in the same change:

- [architecture.md](architecture.md): the architecture and data flow.
- [backend-todo.md](backend-todo.md): mark what is done, adjust partly done items, add newly found gaps.
- [todo-web.md](todo-web.md): web tasks that follow, the table of UI features intentionally hidden until the API supports them, and the live adapter status.
- Any other affected docs: [README.md](README.md), [src/README.md](src/README.md), the specs in `spec/` when a decision changes.

A web change that starts using a new endpoint, or hides or unhides a capability, updates the same files.

## Commits

Use [Conventional Commits](https://www.conventionalcommits.org/): `type(scope): summary`, e.g. `feat(triage): add red-flag scoring prompt`, `docs: add AGENTS.md`. Common types: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `ci`.

Do not add `Co-authored-by` trailers or any other AI attribution footnotes to commit messages, pull requests, or other repo text.

## Compliance

- Outputs that support AML decisions are decision aids, not final determinations. Flag any escalation logic that would need compliance or legal review.
