# Red Flag Monitoring

**An AML compliance copilot that turns regulation into monitoring rules you can trust, then runs them over every transaction with a full audit trail.**

Built at The FinTechers hackathon, Prague, October 2026 · Track 5: Compliance and RegTech copilots

## The problem

Every bank and payment institution must watch its transactions for money laundering (AML transaction monitoring). Two things make that hard today:

- **Rules lag behind regulation.** Laws, EU regulations, EBA guidelines and ČNB benchmarks change often and run to hundreds of pages. Compliance teams translate them by hand into internal policies, and IT translates the policies into monitoring rules. This takes months, and the link between a rule and the law that requires it gets lost.
- **Too many red flags, too little context.** A red flag is a transaction that a rule marks as possibly suspicious. Monitoring systems raise far more red flags than analysts can review, and most of them are false positives. Real cases must still reach the right person in time, and the supervisor expects every decision to be explainable.

## What we built

One system that covers the whole chain, from the legal text to the alert on an analyst's desk:

```
Regulation ──AI──▶ Internal policy ──AI──▶ Monitoring rules ──engine──▶ Red flags ──▶ Alerts, escalated by role
```

1. **Regulation in.** Paste the text or a Markdown file of any regulation. 16 Czech, EU and FATF sources are already loaded in full text: the AML Act 253/2008, CNB Decree 67/2018, AMLD/AMLR, TFR, EBA guidelines, FAÚ guidance and the CNB benchmark 2/2023.
2. **AI drafts the internal policy.** Claude Opus 4.5 on Amazon Bedrock writes a policy in Czech, in the house style of the existing policies, with every requirement tied to its legal provision.
3. **A human reviews it.** The compliance officer approves or rejects the draft. Nothing reaches production without a sign-off.
4. **AI drafts the rules.** From the approved policy the model proposes concrete monitoring rules. Each rule has a plain-language description for the compliance team and a machine-readable definition for the engine, with thresholds, legal basis, priority and the open questions the model could not answer. Rules the engine cannot express are kept as "agentic" rules for later.
5. **A human approves the rules.** Every rule is versioned. Only an approved version can run.
6. **The deterministic engine evaluates.** The active rules run over the full transaction history of July 2026: 397,853 transactions of 5,493 clients, in under a minute. Amounts are converted to CZK at the ČNB rate of the day, and high-risk jurisdictions come from versioned EU and FATF lists.
7. **Alerts go to the right role.** The engine groups red flags into AML alerts per transaction or per client and month. Each rule names the role that handles its hits: contact person, designated person, compliance officer, analyst or lawyer. Each user sees only what is escalated to them.

## Why it is more than a GPT wrapper

- **AI where it adds value, code where it must be exact.** The LLM reads regulation and writes policy and rules: slow, creative work done once. The engine that checks every transaction is plain, deterministic, tested code. No model looks at single transactions, so results are reproducible, fast and cheap.
- **A rule engine of its own.** Rules are not hardcoded. Each rule is a tree of conditions with AND/OR groups, built from a catalogue of computed features: rolling volumes, a client's Q2 baseline, flow-through, round-trip and split-payment patterns, amounts converted at the ČNB rate, etc. The features are computed per transaction from the client's history, and no data from after the transaction is used. A new or changed rule therefore runs without a code change, and its trace shows each condition with the values that decided it.
- **Structured output, validated before use.** The model answers in a strict JSON schema over a fixed catalogue of 30+ computed features. Every proposed rule is validated against the catalogue before it is saved. An invalid rule never runs: it is turned into an agentic draft with the reason attached.
- **Grounded in the source.** The model gets the exact regulation text and the existing policies and rules, so it continues the numbering, cites provisions and avoids duplicates. Quotes that do not appear in the source are flagged in the logs.

## Explainable and auditable by design

- **Decision aid, not a decision maker.** AI only drafts. A named person approves every policy and rule version and decides every alert.
- **Every hit has a trace.** For each flagged transaction the app shows which condition fired, with the actual values, the ČNB rate used and the related transactions behind it.
- **Every rule has a legal basis.** You can follow any alert back through the rule version and the policy to the paragraph of the regulation.
- **Immutable history.** Regulations, policies and rules are versioned, never overwritten, with author, reviewer and time. Each evaluation run freezes the rule versions and reference lists it used, so past results can be reproduced.
- **Data stays in AWS.** The models run on Amazon Bedrock in the EU, inside the team's own AWS account. All access uses IAM roles, and no data goes to external AI APIs.
- **Audit log.** Every change and every AI call is recorded, see [below](#audit-log).

## Audit log

The backend records who did what, when and with which result, for every change of state and every call to the AI model:

- regulations, policies, rules and reference lists: new versions, submission for review, approval or rejection with the reviewer's comment;
- rules switched on or off, the active version changed, clients added to or removed from a rule's whitelist (a removal keeps the removed entry);
- evaluation runs: start (scope, the rule versions it froze, a hash of the evaluated transactions), completion, failure;
- AI drafting jobs and alert triage: the proposal for every alert with its priority factors, guardrails and the model's decision;
- every Bedrock call: model, tokens, duration and SHA-256 fingerprints of the prompt and the answer. The full prompts and answers are stored in the database next to the drafts and alerts they produced.

**Where it lives.** Amazon CloudWatch Logs in the team's AWS account (`eu-central-1`), log groups `/aws/lambda/web/rfm-api` (API, evaluation runs, triage) and `/aws/lambda/rfm-drafting-worker` (AI drafting), kept for 10 years (AML Act § 16). The account is not public; we show the log live in the demo.

**How to view it.** AWS console → CloudWatch → Logs Insights → Saved queries → **`rfm/audit`** → Run. It lists every event with `action`, `entityType`, `entityId`, `actorId` and `payload`, newest first. Add a line to narrow it, e.g. `| filter entityId = "<alert or rule id>"` or `| filter action like /^rule\./`. From a terminal with access to the account:

```bash
aws logs filter-log-events --region eu-central-1 --log-group-name /aws/lambda/web/rfm-api --filter-pattern '"[audit]"'
```

Each event is one line, for example:

```
[audit] action=rule.version_reviewed entity_type=rule entity_id=040cf2d7-… actor_id=00000000-… payload={"versionId":"4dc519b5-…","decision":"approved","reviewComment":"Thresholds match SVZ-03","escalationRole":null} [/audit]
```

## Built on AWS

| Layer                 | Service                                                                                   |
| --------------------- | ----------------------------------------------------------------------------------------- |
| AI drafting           | Amazon Bedrock, Claude Opus 4.5 (EU inference profile), signed with the worker's IAM role |
| Web and API           | AWS Lambda Web Functions: Next.js 16 web app and Express 5 REST API (TypeScript)          |
| Long-running AI steps | A Lambda worker runs drafting jobs in the background; the web follows their progress      |
| Data                  | Amazon Aurora PostgreSQL with IAM authentication; schema changes only through migrations  |

The backend follows a clean, layered architecture (domain, application, infrastructure, delivery). Lint and more than 400 automated tests must pass before every commit. The web runs in English and Czech.

## Deployed app

| What           | URL                                                                                                                                                        |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Web app        | https://vkdtj1g7xt7fqkkn.clq.lambda-web.eu-central-1.on.aws                                                                                                |
| API            | https://pzrs33rhnqf7x5fm.clq.lambda-web.eu-central-1.on.aws (e.g. [`/api/health`](https://pzrs33rhnqf7x5fm.clq.lambda-web.eu-central-1.on.aws/api/health)) |
| Database probe | [`/api/database-status`](https://pzrs33rhnqf7x5fm.clq.lambda-web.eu-central-1.on.aws/api/database-status)                                                  |

A quick tour:

1. **Dashboard:** the overall picture, and **Start wizard** for the regulation → policy → rules flow. An AI step can take a few minutes; you can leave the page and come back.
2. **Regulations, Internal policies, Rules:** the knowledge chain with its versions, legal bases and review status.
3. **Batches:** start an evaluation run and open its results. Open a flagged transaction to see the trace of every rule that fired.
4. **Sidebar:** switch the user and role to see how alerts are escalated to different people.

The deployment uses synthetic and organiser-provided data only. The endpoints are public and have no login, which is acceptable for this demo and nothing else.

## Status

Working end to end on the deployed system: regulation → AI policy draft → human review → AI rule drafts → human approval → evaluation of all active rules → alerts escalated by role → triage of every alert.

- **Triage and priority.** Every alert gets a priority 0–100 computed from the policy's risk factors (AML risk score, PEP, high-risk country, relationship length, several scenarios on one client, …) and a proposal: false positive or needs review, with a written reason. A rule-based proposal is made for every alert in every run. On request, Claude on Bedrock re-triages a client's alerts together and writes the reason; guardrails keep alerts the policy reserves for a human (PEP, high-risk countries, mandatory-review rules) at "needs review" whatever the model says. The model's prompt, answer, model and tokens are stored with each proposal.
- **Mandatory CSV.** The API exports one row per alert in the FINREG format (`/api/evaluation-runs/<run id>/aml-events.csv`). The person columns stay empty until escalation to a named person is done.
- **Audit log.** Every change and every AI call is recorded in CloudWatch, see [Audit log](#audit-log).

Next steps: escalation to a named person and approver with conflict-of-interest checks, alert screens in the web with the human decision and 4-eyes approval, the audit log in the database, evaluation of agentic rules, and login with role-based permissions.

Already built in the web and working on the mock data (switch "Data source" to Mock), waiting only for their API: editing rule drafts, deleting unapproved rules, policies and regulations, CSV batch upload, and the FAÚ suspicious transaction report draft. See [next-step features](architecture.md#next-step-features).

> Compliance note: the output supports AML decisions; it does not make them. Thresholds, escalation logic and the AI-drafted rules need review by a compliance officer before any real use.

## Repository

| Path                               | What                                                                    |
| ---------------------------------- | ----------------------------------------------------------------------- |
| [src/](src/README.md)              | The app: setup, local run, API, environment, deployment                 |
| [architecture.md](architecture.md) | Architecture and data flow                                              |
| [spec/](spec/)                     | Product spec, data model, feature catalogue (Czech)                     |
| [knowledgebase/](knowledgebase/)   | Challenge briefing, regulations in full text, sample policies and rules |
| [datasets/](datasets/)             | Synthetic client and transaction data from the organisers               |
| [AGENTS.md](AGENTS.md)             | Working rules for the team and AI agents                                |
