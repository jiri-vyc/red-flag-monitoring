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

Working end to end on the deployed system: regulation → AI policy draft → human review → AI rule drafts → human approval → evaluation of all active rules → alerts escalated by role.

Next steps: LLM triage of each alert (false positive or needs review) with a written justification and a priority, evaluation of agentic rules, conflict-of-interest checks in escalation, and login with role-based permissions.

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
