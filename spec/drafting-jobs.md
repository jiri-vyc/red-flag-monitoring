# Drafting jobs: regulation → policy draft → rule drafts (návrh)

Status: **implemented**. Jobs, API, worker Lambda and deploy scripts are in place; the deployed worker drafts with `BedrockDraftGenerator` (#1, #2, see [Handover](#handover-to-the-bedrock-generator)). Extends [spec.md §4.2, §7.2](spec.md) and [datovy-model.md](datovy-model.md).

## Related issues

- **#1** (regulation → policy drafts) and **#2** (policy approval → rule drafts): this design is the async plumbing both need. The LLM half is `BedrockDraftGenerator` behind the `DraftGenerator` port (`DRAFT_GENERATOR=bedrock`); the worker calls it.
- **#2** asks what happens when generation fails after the approval is written. Here: the approval and the `rules_from_policy` job are inserted in one transaction, a failure ends as a `failed` job, and `POST /api/drafting-jobs/:id/retry` regenerates.
- **#1** keeps `POST /api/regulations/:regulationId/versions/:versionId/draft-policies` as the entry point. Here it becomes an alias that returns `202` with a job (see [API](#api)).
- **#3** (evaluation engine, Filip, `67806b0`): out of scope, but it already solved the same problem for evaluation runs: `EvaluationRunLauncher` port, `InProcessEvaluationRunLauncher` / `LambdaEvaluationRunLauncher`, worker entry point `evaluationWorker.ts`, composition in `evaluationRunComposition.ts`, `EVALUATION_WORKER_FUNCTION`. The drafting worker below copies that pattern and its names.

## Problem

Both LLM steps are too slow for a synchronous HTTP request. A full policy draft is 10–12k output tokens on Opus, non-streaming (`BedrockDraftGenerator`), i.e. minutes. Before drafting jobs:

- `POST /api/regulations/:id/versions/:versionId/draft-policies` and the approve branch of `POST /api/internal-policies/:id/versions/:vid/review` call the generator inline (Filip's stub, `DummyDraftGenerator`).
- Jiri's Bedrock drafter and rule extractor run only from the CLI.
- Radek's live wizard (`3f62af6`, `src/web/features/wizard/api/live.ts`) creates the regulation and its version through the existing endpoints, then calls `draft-policies` and expects `InternalPolicyVersion[]` in the response. Switching that endpoint to `202` broke `liveWizardService.draftPolicies`; the web wizard was moved to drafting jobs in the same change.
- A Lambda Web Function freezes once it has responded, so "respond, then keep working" in the API process is not reliable.

## Flow

```mermaid
sequenceDiagram
    participant FE as Web
    participant API as rfm-api (Web Function)
    participant DB as Aurora main
    participant W as drafting worker (Lambda, 15 min)
    participant BR as Bedrock

    FE->>API: POST /api/drafting-jobs {source: text|markdown|url}
    API->>DB: insert regulation (+ version for text/markdown), drafting_job(pending)
    API-)W: Invoke(InvocationType=Event, {jobId})
    API-->>FE: 202 {id, status: pending}
    W->>DB: claim job (pending → running)
    W->>BR: draft internal policy
    W->>DB: tx: policy + version(draft, wizard) + legal bases, job → succeeded
    loop every 30 s while any job is pending/running, or on manual refresh
        FE->>API: GET /api/drafting-jobs?status=pending,running
    end
    FE->>API: edit policy (new draft version), submit, review(approved)
    API->>DB: review + drafting_job(rules_from_policy, pending)
    API-)W: Invoke(Event, {jobId})
    API-->>FE: 200 {...version, rulesJob: {id, status: pending}}
    W->>BR: extract rule candidates → DSL definitions
    W->>DB: tx: rules + versions(draft) + legal bases, job → succeeded
    FE->>API: rule review (existing /submit, /review)
```

Human gates (policy approval, rule approval) stay on the **versions** (M11, `versionStatus.ts`). A job only tracks the machine step. No version is ever activated by a job (spec §11).

## Data model: `drafting_jobs`

One row per LLM step, migration `DraftingJobs1792441120965`.

| Column                                    | Type            | Notes                                                                                          |
| ----------------------------------------- | --------------- | ---------------------------------------------------------------------------------------------- |
| `id`                                      | uuid PK         |                                                                                                |
| `kind`                                    | text CHECK      | `policy_from_regulation`, `rules_from_policy`                                                  |
| `status`                                  | text CHECK      | `pending`, `running`, `succeeded`, `failed`                                                    |
| `parent_job_id`                           | uuid FK NULL    | rules job → the policy job that drafted the policy, so the web can show one request end to end |
| `source_kind`                             | text NULL CHECK | `text`, `markdown`, `url`; set exactly for `policy_from_regulation`                            |
| `source_url`                              | text NULL       | set exactly when `source_kind = 'url'`                                                         |
| `scope`                                   | text NULL       | optional heading to narrow the regulation, passed to `DraftGenerator.draftPolicies`            |
| `version_label`                           | text NULL       | label for the regulation version a URL job creates; defaults to „Načteno z URL k <date>“       |
| `regulation_id`                           | uuid FK NULL    | null only for a URL job without a regulation, until the worker resolves it                     |
| `regulation_version_id`                   | uuid FK NULL    | set at insert for text/markdown (CHECK), by the worker after fetching a URL                    |
| `policy_version_id`                       | uuid FK NULL    | input of `rules_from_policy` (CHECK)                                                           |
| `drafted_policy_version_ids`              | uuid[]          | output of `policy_from_regulation` (1..N policies)                                             |
| `drafted_rule_version_ids`                | uuid[]          | output of `rules_from_policy`                                                                  |
| `warnings`                                | jsonb           | e.g. rule drafts skipped because they failed validation                                        |
| `error_message`                           | text NULL       | set exactly when `failed` (CHECK)                                                              |
| `attempts`                                | int DEFAULT 0   | incremented by the claim                                                                       |
| `created_by`                              | uuid FK users   |                                                                                                |
| `created_at`, `started_at`, `finished_at` | timestamptz     | `finished_at` set exactly when `succeeded` or `failed` (CHECK)                                 |

Indexes: `created_at`, `status`, `regulation_id`, `policy_version_id`, `parent_job_id`.

The raw regulation text lives in `regulation_versions.full_text` (M1), not on the job. The job and the worker payload carry only ids, which keeps the async invoke payload far below Lambda's limit.

Not built yet: `model_id`, `input_tokens`, `output_tokens` for audit and cost. They need the generator to report usage, see [Handover](#handover-to-the-bedrock-generator).

### Status transitions

`pending → running → succeeded | failed`. Nothing else.

- **Claim**: `update drafting_jobs set status='running', started_at=…, attempts=attempts+1 where id=$1 and status='pending'`. Zero rows → another delivery already has it; exit. Covers Lambda's at-least-once async delivery.
- **Finish**: drafts and `status='succeeded'` in **one transaction**, conditional on `running`. A job failed in the meantime rolls its drafts back.
- **Timeout**: a `pending` or `running` job whose `started_at` (or `created_at`) is 16 minutes old is reported as `failed` on read, and status filters match the reported status (lazy, no sweeper, the row is unchanged). The worker's own timeout is 15 min.
- **Retry**: `POST /api/drafting-jobs/:id/retry` on a `failed` job inserts a **new** job with the same inputs. Jobs are not rerun in place, so each attempt keeps its own error. A URL already fetched is reused, not fetched again. Lambda's built-in async retries are set to 0.

## API

All under `/api/drafting-jobs`. Same 202 + polling pattern as evaluation runs.

```http
POST /api/drafting-jobs
Content-Type: application/json

{
  "source": { "kind": "text" | "markdown", "content": "…" }
          | { "kind": "url", "url": "https://…" },
  "regulation": { "id": "<uuid>" } | { "code": "…", "title": "…", "kind": "law|decree|eu_reg|eu_dir|guidance", "sourceUrl": null } | null,
  "versionLabel": "znění od 1. 1. 2026" | null,
  "scope": "Hlava III" | null,
  "createdBy": "<uuid, defaults to the demo admin>"
}
```

`202 Accepted`, `Location: /api/drafting-jobs/:id`, body = the job with `status: "pending"`.

- A `.md` file is read in the browser and sent as `markdown`. No multipart; PDF stays out of scope (spec §9).
- `regulation` is required for text and markdown. For a URL it may be omitted: the worker reuses the regulation with that `sourceUrl`, or creates one with placeholder metadata (code `URL-<host>-<hash>`, the page title, kind `guidance`) that a human corrects.
- Errors happen synchronously, before any job exists: `400` invalid body, `409` duplicate regulation code, `422` URL outside the allowlist.

```http
GET /api/drafting-jobs?status=pending,running&kind=policy_from_regulation&regulationId=…&policyVersionId=…&limit=50&offset=0
GET /api/drafting-jobs/:id
POST /api/drafting-jobs/:id/retry
```

The list is `{ items, total, limit, offset }`, newest first. `status` and `kind` take comma-separated lists. Retry returns `202` with the new job, `422` for a job that has not failed.

Job:

```json
{
  "id": "…",
  "kind": "policy_from_regulation",
  "status": "succeeded",
  "parentJobId": null,
  "sourceKind": "url",
  "sourceUrl": "https://www.zakonyprolidi.cz/cs/2008-253",
  "scope": null,
  "versionLabel": null,
  "regulationId": "…",
  "regulationVersionId": "…",
  "policyVersionId": null,
  "policyVersions": [{ "id": "…", "policyId": "…", "status": "draft" }],
  "ruleVersions": [],
  "warnings": [],
  "errorMessage": null,
  "attempts": 1,
  "createdBy": "…",
  "createdAt": "…",
  "startedAt": "…",
  "finishedAt": "…"
}
```

`policyVersions[].status` and `ruleVersions[].status` come from a join, so the web sees from one list call which drafts still wait for review.

### Web refresh

A job runs for minutes, up to 15. The web does not need second-level freshness.

- The list query refetches every **30 s**, and only while at least one listed job is `pending` or `running` (`refetchInterval` as a function, like `useBatch` in `features/batches/api/hooks.ts`). With nothing in flight it stops.
- A refresh button next to the list, like `DatabaseStatusPanel`, calls `refetch()` and spins while `isFetching`.
- The web invalidates the list right after its own `POST` (new job, retry, approval), so the new `pending` row shows without waiting.
- Refetch on window focus for this query only, so a user coming back after 10 minutes sees the result at once.

Changed endpoints:

- `POST /api/internal-policies/:id/versions/:vid/review` with `approved`: records the review and inserts a `rules_from_policy` job in the same transaction, then launches it. The response is the version plus `rulesJob`. The inline `draftRules` call is gone.
- `POST /api/regulations/:id/versions/:versionId/draft-policies` (the #1 entry point) is a thin alias: it creates a `policy_from_regulation` job for an existing regulation version and returns `202` with the `DraftingJobDto`.

## Worker

Mirrors Filip's evaluation worker (`evaluationWorker.ts`, `LambdaEvaluationRunLauncher`):

- Classic Lambda `rfm-drafting-worker` (Node 24, arm64, 900 s, 1 GB, reserved concurrency 3 where the account allows) built from the same backend bundle, entry point `backend/src/draftingWorker.ts`. Event payload `{ jobId }`. Wiring in `draftingJobComposition.ts`, shared by `main.ts` and the worker.
- Ports in `application/drafting/draftingJobPorts.ts`: `DraftingJobRepository`, `DraftingJobLauncher`, `RegulationSourceFetcher`, plus the existing `DraftGenerator`. `DraftingJobExecutor.executeJob(jobId)` does the claim, the generator call and the final transaction; `DraftingJobUseCases` creates, lists, retries and launches jobs.
- `DraftingJobLauncher` implementations:
  - `LambdaDraftingJobLauncher`: `InvocationType=Event`. Used when `DRAFTING_WORKER_FUNCTION` is set.
  - `InProcessDraftingJobLauncher`: runs the executor in the local backend. Local dev and tests need no Lambda.
- If the launch fails after the insert, the job is marked `failed` right away and returned as such, so it never stays `pending` and an already committed approval still gets a response.
- The evaluation worker has no deploy script yet. Sharing one worker Lambda (`{ type, id }`) stays an option to decide with Filip.

### `policy_from_regulation`

1. For `url`: fetch (`HttpRegulationSourceFetcher`), convert HTML to text (`htmlToText`), resolve or create the regulation, insert `regulation_versions` and set `regulation_id` and `regulation_version_id` on the job.
2. `BedrockDraftGenerator.draftPolicies`. Example policy SVZ-06 from the database. Decided: the optional `scope` narrows the text to one heading; without it the whole text is used up to 400 000 characters (~150k tokens of Czech, covers every seeded regulation), longer text fails the job with a request to set a scope.
3. Map the result to `internal_policies` + `internal_policy_versions` (`status=draft`, `created_via=wizard`) + `policy_legal_bases` on the source regulation version, `ref` = the scope or `null` for the whole regulation. The cited provisions are quoted verbatim in the policy body.
4. Planned: store `unverifiedQuotes` in `warnings`. The web shows them in the review.

### `rules_from_policy`

1. `BedrockDraftGenerator.draftRules` on the approved policy version. Input per #2: the version body, its legal bases, `describeFeatureCatalog()` and the reference lists.
2. One Bedrock call returns the rules with the DSL definition (`match`, `features`, `conditions`, M14) over the feature catalogue (M10), written flat to stay within the Bedrock structured-output limits and rebuilt by `buildRuleDefinition`. A definition that fails validation is stored as an agentic rule with the reason in `threshold_rationale`. The executor already skips drafts that fail `findRuleLogicViolation` or have no legal basis and lists them in `warnings`. Candidates without a deterministic mapping become agentic versions (`agent_prompt`, `agent_model_id`, M13).
3. Insert `rules` (`enabled=false`) + `rule_versions` (`status=draft`, `derived_from_policy_version_id`) + `rule_legal_bases` (M5; `ref` required).

## Infrastructure

- `deploy/drafting-worker.sh` (`npm run deploy:drafting-worker`) builds the backend bundle (shared with `api.sh` via `build_backend_bundle` in `deploy/common.sh`), creates or updates the function, sets the async invoke config and tries to reserve concurrency. `deploy/all.sh` deploys it before the API.
- `deploy/roles.sh`: `rfm-drafting-worker-execution` with logs on `/aws/lambda/rfm-drafting-worker`, `rds-db:connect` and `bedrock:InvokeModel` on the `eu.anthropic.*` profiles. `rfm-api-execution` gets `lambda:InvokeFunction` on the worker only.
- `deploy/api.sh` sets `DRAFTING_WORKER_FUNCTION=rfm-drafting-worker`.
- Async invoke config: `MaximumRetryAttempts=0`, `MaximumEventAgeInSeconds=900`.
- No SQS or Step Functions. One async invoke per job is enough at hackathon scale; the job row is the queue.

## Handover to the Bedrock generator

The cutoff of this change is the worker. The Bedrock part plugs in behind one port:

- Implement `DraftGenerator` (`application/drafting/draftGenerator.ts`): `draftPolicies(regulation, version, scope)` and `draftRules(policy, version)`, and swap `DummyDraftGenerator` in `createDraftingJobExecutor` (`draftingJobComposition.ts`). Nothing else in the flow changes.
- On Lambda, use the role's SigV4 credentials, not the bearer API key path in `createBedrockClient.ts`. The roles do not grant `bedrock:CallWithBearerToken`.
- To surface `unverifiedQuotes`, open questions or token usage, extend the generator's return type; the executor passes warnings to `completePolicyJob` / `completeRulesJob`. Token usage columns need a new migration.
- A Bedrock call must finish well within 15 minutes including the fetch and the final write, or the job times out.

## Security and compliance

- **URL fetch (SSRF):** `https` only, host allowlist (`eur-lex.europa.eu`, `e-sbirka.gov.cz`, `zakonyprolidi.cz`, `cnb.cz`, `fatf-gafi.org`), no redirects off the list, 10 s timeout, 5 MB cap. Runs in the worker, not the API.
- **Prompt injection:** fetched or pasted text is data inside the prompt. Every output is a draft that a human must approve; no job can enable a rule or approve a version.
- **Audit:** timing, attempts and errors on the job; model id, token counts and prompt version still to add (see Handover). Versions are immutable (M17), so the job + version pair reconstructs who generated what from which regulation text.
- **Compliance review needed:** whether an LLM-drafted internal policy is acceptable as a starting point for the AML zákon § 21 document, and who signs it off (M12 has only `admin`, no 4-eyes).

## Open questions

1. Does the team keep the existing review endpoint triggering rule drafting automatically, or add an explicit "generate rules" action after approval?
2. One policy per regulation, or several? #1 and Filip's `DraftGenerator.draftPolicies` expect 1..N; Jiri's drafter returns one.
3. Where do `examplePolicy` and `firstRuleNumber` for the drafter come from in the API flow?
4. Is `GET` polling enough for the web, or does `AiProgress` want step-level progress (`output.progress`)?
   - **Answer (web, 2026-10-19):** `GET` polling of the job status is enough. The web polls `GET /api/drafting-jobs/:id` every ~2 s, the same way it polls evaluation runs, and stops on `succeeded` or `failed`. While a job is `pending`/`running` it shows an indeterminate progress ring. On `failed` it shows `error` and a Retry button (`POST /:id/retry`).
   - Step-level progress is optional and can come later. If the worker adds it, a shape the web can map 1:1 to `AiProgress` steps would be `output.progress: [{ step: "extract_obligations" | "draft_policy" | "draft_rules" | "validate_citations", status: "pending" | "running" | "done" }]`. Without it, the web falls back to the indeterminate ring.
   - Two requests to the backend:
     - Return the created entity IDs in a `succeeded` job (`output.policyVersionIds` / `output.ruleIds`), so the web does not have to diff lists.
     - Keep `rulesJob` in the policy review response, so the web can start polling right away.
   - **Implemented (drafting jobs):** the web polls every 30 s while a job is `pending` or `running`, not every ~2 s, because one step runs for minutes; a refresh button and refetch on window focus cover the rest. The created IDs are in the job as `policyVersions` / `ruleVersions` (with their review status), and the review response keeps `rulesJob`. Step-level progress is not built.
5. Placeholder metadata for a URL regulation: good enough, or should the worker derive `code`, `title` and `kind` via Bedrock?
