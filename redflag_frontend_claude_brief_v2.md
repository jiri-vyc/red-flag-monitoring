# RedFlag — Frontend Implementation Brief for Claude

## 0. Mandatory first step: read the repository before writing code

Before implementing anything, **inspect the repository and understand the existing product and technical context**.

Do not immediately scaffold, rename folders, introduce architecture, or start building pages.

First read:

- `README.md`
- `AGENTS.md`
- all root-level `.md` files
- `/docs`
- `/specs`
- `/documentation`
- `/product`
- `/architecture`
- `/adr`
- `/stories`
- `/requirements`
- `/notes`
- API schemas / OpenAPI / Swagger files
- Supabase migrations / SQL
- existing environment examples
- deployment configuration
- Vercel configuration
- AWS-related configuration
- Temporal workflow definitions if present
- any shared TypeScript types
- package manifests
- existing frontend code
- existing mock data
- committed issue / task descriptions relevant to the frontend

Pay special attention to the high-level RedFlag product specification if present.

Before coding, build a concise internal understanding of:

```text
What RedFlag does
Who uses it
What the MVP actually contains
What is explicitly out of MVP
What terminology the team already uses
What entities exist
What rule lifecycle exists
How transaction evaluation works
What AML events contain
What needs human approval
What API contracts already exist
What is planned for Supabase
What is planned for AWS
What belongs to the web app
```

If this brief conflicts with repository specifications, use this precedence:

```text
1. Explicit repository product specification
2. Existing architecture decisions / ADRs
3. Existing API contracts
4. Existing database contracts
5. This frontend brief
```

Do not invent alternative domain terminology when the repository already defines it.

---

# 1. Scope of this task

For now, implement **only the frontend application**.

The repository is intended to become a monorepo, but the backend / AWS worker code may be added later by other team members.

Do not create fake backend projects, empty AWS workers, or placeholder shared packages that nobody uses yet.

The repository should be ready for future expansion without overengineering today.

Target initial structure:

```text
redflag/
├── package.json
├── pnpm-workspace.yaml
├── .gitignore
├── README.md
├── AGENTS.md
├── docs/
│   └── ...
└── apps/
    └── web/
        ├── package.json
        ├── next.config.ts
        ├── tsconfig.json
        ├── components.json
        ├── .env.example
        ├── public/
        └── src/
```

Future backend applications may later be added as:

```text
apps/worker
apps/api
packages/contracts
packages/domain
packages/db
```

but **do not create them until needed**.

---

# 2. Package management

Use:

```text
pnpm workspaces
```

Root:

```text
package.json
pnpm-workspace.yaml
```

The actual frontend dependencies belong in:

```text
apps/web/package.json
```

The root package should contain only workspace-level scripts and metadata.

Example root `package.json`:

```json
{
  "name": "redflag",
  "private": true,
  "packageManager": "pnpm@10",
  "scripts": {
    "dev": "pnpm --filter @redflag/web dev",
    "build": "pnpm --filter @redflag/web build",
    "lint": "pnpm --filter @redflag/web lint",
    "typecheck": "pnpm --filter @redflag/web typecheck"
  }
}
```

Example `pnpm-workspace.yaml`:

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

`packages/*` does not need to exist yet.

Do not introduce Turborepo unless the repository already uses it or multiple deployable apps actually require it.

---

# 3. Frontend technical stack

Build the frontend using:

```text
Next.js
TypeScript
App Router
Tailwind CSS
shadcn/ui
TanStack Query
React Hook Form
Zod
Lucide
Framer Motion only where it materially improves the demo
```

Deployment target:

```text
Vercel
```

The real backend will later use a combination of:

```text
Vercel
AWS
Supabase
Amazon Bedrock
possibly Temporal / workers
```

The frontend must not depend on the backend being available during implementation.

---

# 4. Product model

RedFlag is a monitoring and AML red-flag system.

The core domain hierarchy is:

```text
Regulation
    ↓
Internal policy
    ↓
Rule
    ↓
Rule version
```

Transaction evaluation is:

```text
Client
  ↓
Transaction
  ↓
Transaction evaluation
  ↓
1..N rule evaluations
  ↓
Aggregated result
  ↓
possible AML event
```

The main product flow for the MVP is:

```text
Create/import regulation
        ↓
Create internal policy
        ↓
Generate or create rules
        ↓
Human review
        ↓
Activate rule
        ↓
Run PoC evaluation over transactions
        ↓
Inspect rule scores + trace
        ↓
Create AML events for suspicious results
        ↓
Review / prioritize
        ↓
Audit log
```

Important:

- The MVP is **ex-post / batch detection**.
- Live transaction prevention is out of scope unless repository specs explicitly change.
- Human approval is required before generated rules become active.
- The UI must show trace / reasoning for rule evaluation.
- Every important action must be auditable.

---

# 5. Core frontend areas

The frontend should be organized around the product specification, not around a generic “fraud incident dashboard”.

Required primary areas:

```text
Dashboard
Wizard
Regulations
Internal policies
Rules
Evaluations
AML events
Clients
Transactions
Audit log
Settings
```

Suggested routes:

```text
/
  redirect -> /dashboard

/dashboard

/wizard

/regulations
/regulations/[regulationId]

/policies
/policies/[policyId]

/rules
/rules/new
/rules/[ruleId]

/evaluations
/evaluations/[evaluationId]

/aml-events
/aml-events/[eventId]

/clients/[clientId]

/transactions/[transactionId]

/audit

/settings
```

---

# 6. Recommended frontend folder structure

Use a feature-oriented structure.

```text
apps/web/src/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── dashboard/
│   ├── wizard/
│   ├── regulations/
│   ├── policies/
│   ├── rules/
│   ├── evaluations/
│   ├── aml-events/
│   ├── clients/
│   ├── transactions/
│   ├── audit/
│   └── settings/
│
├── components/
│   ├── ui/
│   └── layout/
│
├── features/
│   ├── dashboard/
│   ├── wizard/
│   ├── regulations/
│   ├── policies/
│   ├── rules/
│   ├── evaluations/
│   ├── aml-events/
│   ├── clients/
│   ├── transactions/
│   └── audit/
│
├── config/
│   ├── env.client.ts
│   └── env.server.ts
│
├── lib/
│   ├── api/
│   ├── mock/
│   └── utils/
│
├── providers/
│   ├── ApiModeProvider.tsx
│   └── QueryProvider.tsx
│
└── types/
```

Each feature may contain:

```text
components/
api/
mock/
schemas.ts
types.ts
hooks.ts
```

Do not centralize every domain into giant global folders if feature-local organization is cleaner.

---

# 7. Mandatory Mock / Live API architecture

This is a **hard requirement**.

The frontend must be fully functional before the real backend exists.

Every async feature must work through a stable service interface with two implementations:

```text
Mock implementation
Live API implementation
```

The UI must not know which implementation is active.

Do **not** write:

```ts
if (isMock) {
  ...
} else {
  ...
}
```

inside pages or product components.

Instead use:

```text
UI
↓
feature service
↓
service resolver
↓
Mock OR Live
```

Example:

```ts
export interface RulesService {
  getRules(): Promise<Rule[]>;
  getRule(id: string): Promise<Rule>;
  createRule(input: CreateRuleInput): Promise<Rule>;
  submitForReview(id: string): Promise<Rule>;
  approveRule(id: string): Promise<Rule>;
  rejectRule(id: string): Promise<Rule>;
  toggleRule(id: string, active: boolean): Promise<Rule>;
}
```

Implement:

```text
mockRulesService
liveRulesService
```

The same pattern must exist for:

```text
regulations
policies
rules
evaluations
AML events
clients
transactions
audit
dashboard
wizard generation flows
```

---

# 8. Mock mode requirements

Mock mode must be usable as the complete hackathon fallback.

It must support the full demo even if:

```text
Supabase is unavailable
AWS is unavailable
Bedrock is unavailable
Vercel backend routes are unavailable
internet connection is unstable
```

Mock mode must simulate realistic server behavior:

```text
network latency
loading states
mutations
status changes
evaluation progress
rule review
audit updates
AML event creation
errors where useful
```

Suggested normal latency:

```text
250–800 ms
```

Suggested AI/generation latency:

```text
1.5–3 seconds
```

Suggested PoC evaluation duration:

```text
3–8 seconds in demo mode
```

with visible progress.

---

# 9. Mock / Live runtime switch

Add a visible runtime switch.

Recommended location:

```text
sidebar footer
```

Display:

```text
Data source

[ Mock ] [ Live ]
```

or:

```text
● Mock API
```

The current mode must always be obvious.

Use:

```ts
type ApiMode = 'mock' | 'live';
```

Persist selection in:

```text
localStorage
```

Default:

```text
mock
```

unless configured otherwise.

Priority:

```text
localStorage
↓
NEXT_PUBLIC_API_MODE
↓
mock
```

Provide:

```text
ApiModeProvider
useApiMode()
```

Because this relies on browser storage, implement it as a client component.

---

# 10. Mock replacement strategy

Mocks are **temporary implementations of stable frontend contracts**.

They are not throwaway UI hacks.

The intended migration is:

```text
Today:
UI
↓
service
↓
mock implementation

Later:
UI
↓
same service contract
↓
live HTTP API implementation
```

The UI should require minimal or no changes when the real backend arrives.

Example:

```text
features/rules/api/
├── contract.ts
├── mock.ts
├── live.ts
├── service.ts
└── hooks.ts
```

When backend endpoints become available, only replace/complete:

```text
live.ts
```

and potentially DTO mapping.

Do not rewrite pages just because the backend became available.

---

# 11. Do not couple the frontend directly to Supabase tables

For this phase, prefer:

```text
React UI
↓
feature service
↓
HTTP API
↓
backend
↓
Supabase
```

rather than:

```text
React component
↓
Supabase table
```

The frontend should not depend on the physical database schema.

Direct browser-to-Supabase integration is allowed only if a repository specification explicitly requires it, for example:

```text
Supabase Auth
safe Realtime subscription
public browser-safe data with RLS
```

Never expose privileged Supabase credentials.

---

# 12. Mock data model

Seed realistic mock data for the MVP domain.

Suggested scale:

```text
6–10 regulations
6–12 internal policies
12–20 rules
15–30 rule versions
20–40 clients
100+ transactions
several evaluation runs
dozens of rule evaluations
8–15 AML events
20–40 audit events
```

Do not overbuild if it slows implementation.

Mock data must cover:

```text
active rules
draft rules
rules pending review
rules with update pending review
inactive rules
deterministic rules
agentic rules
multiple risk profiles
whitelisted clients
different sensitivity values
successful evaluations
high-scoring evaluations
low-scoring evaluations
AML events
false-positive-like cases
audit history
```

---

# 13. Rule lifecycle

Use the repository terminology.

```ts
type RuleStatus =
  | 'draft'
  | 'pending_for_review'
  | 'update_for_review'
  | 'active'
  | 'inactive';
```

Important behavior:

```text
draft
  -> pending_for_review
  -> active

active
  -> inactive

active rule + regulatory change
  -> new version proposed
  -> update_for_review
  -> approved
  -> new active version
```

A rule that has not passed human approval must not be shown as executable/active.

---

# 14. Rule types

Support two types:

```ts
type RuleType = 'deterministic' | 'agentic';
```

Deterministic rule:

```text
stored code
+
human-readable Czech explanation
```

Agentic rule:

```text
natural-language rule
evaluated by an LLM agent
```

Both must expose a comparable evaluation result shape:

```ts
interface RuleEvaluationResult {
  score: number; // 0-100
  adjustedScore?: number;
  trace: EvaluationTrace;
  contextRefs: string[];
}
```

---

# 15. Rule detail screen

The rule detail page should show:

```text
Rule name
Status
Type
Sensitivity
Applicable risk profiles
Whitelist
Source policy
Source regulation
Current version
Version history
Approval information
```

For deterministic rules:

```text
Human-readable explanation
Code
```

side-by-side.

For agentic rules:

```text
Natural-language rule
```

Actions where appropriate:

```text
Submit for review
Approve
Reject
Activate
Deactivate
Create new version
```

---

# 16. Rule wizard

Implement the wizard described by the product spec.

Flow:

```text
1. Enter regulation text
2. Generate internal policy draft
3. Review/edit policy draft
4. Generate rule set
5. Review rules
6. Submit / approve
```

MVP input is direct regulation text.

Do not build web scraping unless existing specifications explicitly require it.

Mock mode must simulate generation.

Example AI progress:

```text
Analyzing regulation...

✓ Extracting obligations
✓ Building internal policy
● Generating rules
○ Validating traceability
```

Generated artifacts should visibly reference the source regulation / provision.

---

# 17. Manual rule creation

Support manual creation.

Fields should include at least:

```text
Description
Source regulation / internal policy
Rule type
Whitelist clients
Sensitivity 0–100
Applicable risk profiles
```

For deterministic rules, mock generation may produce:

```text
human-readable explanation
generated code
```

For agentic rules:

```text
generated natural-language rule
```

After creation:

```text
pending_for_review
```

unless repository rules specify otherwise.

Use:

```text
React Hook Form
Zod
```

---

# 18. Regulations

Regulation list should show:

```text
Name
Jurisdiction
Version / last update
Last checked
Related policies
Related rules
Update status
```

Actions:

```text
Add regulation
Check updates
Open detail
```

Because live regulation scraping is outside MVP, Mock mode may simulate an update.

The frontend should not falsely imply that real-time regulatory checking exists if the live backend does not provide it.

---

# 19. Internal policies

Internal policy page should show:

```text
Name
Source regulation
Status
Text
Generated/manual origin
Related rules
Version / updated date
```

Support editing drafts before rules are generated.

---

# 20. Dashboard

Dashboard is the main entry page.

It should expose:

```text
Start rule wizard
Rules requiring review
Active rules
Regulation updates
Latest evaluation run
AML events
Audit activity
```

Suggested top metrics:

```text
Active rules
Pending reviews
Last PoC run
AML events
Regulations monitored
```

Primary actions:

```text
Create rules from regulation
Run PoC evaluation
Check regulation updates
```

---

# 21. PoC evaluation flow

This is a core demo feature.

The user manually starts a run.

Example:

```text
Run evaluation
```

The run should:

```text
process demo transactions
apply all active relevant rules
respect risk-profile applicability
respect whitelist exclusions
calculate rule scores
store/show trace
aggregate transaction result
produce AML events where applicable
```

In Mock mode simulate this deterministically.

Show visible progress:

```text
Evaluating transactions

127,450 / 400,000
32%

Active rules: 10
AML events found: 27
```

For hackathon demo data, the actual mock dataset can be much smaller while the UI may simulate realistic progress.

Do not pretend a real 400k-row backend run occurred in Mock mode. Label demo simulation appropriately if needed.

---

# 22. Evaluation result list

Show:

```text
Transaction
Client
Aggregate score
Triggered rules
AML event
Status
Run timestamp
```

Allow filters:

```text
Score range
AML event yes/no
Client risk profile
Rule triggered
```

---

# 23. Evaluation detail

The detail must make explainability obvious.

Show:

```text
Transaction
Client
Client risk profile
Transaction history context
Aggregate score
Applied rules
Skipped rules
Whitelist/risk-profile exclusions
Rule-by-rule score
Adjusted score
Trace
Context references
```

Example:

```text
Rule A — High-risk country
Score: 92
Adjusted: 83

Trace
✓ Recipient country is on configured high-risk list
✓ Client risk profile is HIGH
✓ Rule applies to HIGH profile
○ Client is not whitelisted
```

This screen is one of the strongest demo screens.

---

# 24. AML events

AML event list:

```text
Alert ID
Type
Client
Transaction
Triage
Priority
Status
Assignee
Approver
Created
```

The event detail should show:

```text
transaction
client
client history
rule results
trace
reason
priority
triage
assignment
audit trail
```

Event-processing workflow is nice-to-have if the repository still marks it as such.

Do not let nice-to-have workflow work block core MVP screens.

---

# 25. Audit log

Audit log is mandatory.

Capture / display:

```text
rule created
rule edited
rule submitted for review
rule approved
rule rejected
rule activated
rule deactivated
rule version changed
evaluation started
evaluation completed
AML event created
AML decision changed
regulation update detected
```

Each record should include:

```text
who
when
what
why
entity
rule version where relevant
```

Mock mutations must create corresponding mock audit records.

---

# 26. Clients and transaction context

Client detail should expose enough context for AML review.

Suggested fields:

```text
Client ID
Country
Client type
PEP
Risk profile
AML risk score
Projected volumes
Historical volumes
Transaction history
```

Transaction detail:

```text
Transaction ID
Client
Timestamp
Amount
Currency
Payer country
Recipient country
Type
Evaluation results
Related AML event
```

---

# 27. TanStack Query

Use TanStack Query for all server-like async data.

Examples:

```text
useDashboard()
useRegulations()
usePolicies()
useRules()
useRule(id)
useEvaluations()
useEvaluation(id)
useAmlEvents()
useAmlEvent(id)
useClient(id)
useTransaction(id)
useAuditLog()
```

Mutations:

```text
useCreateRule()
useApproveRule()
useRejectRule()
useToggleRule()
useRunEvaluation()
useCheckRegulationUpdates()
useGeneratePolicy()
useGenerateRules()
```

On successful mutations:

```text
invalidate relevant queries
show toast
update audit log
```

---

# 28. Live API behavior

The real backend contract may not exist yet.

Define stable frontend domain types and isolate live DTO mapping.

Do not spread guessed backend shapes across components.

Use:

```text
backend DTO
↓
live adapter
↓
frontend domain model
↓
components
```

If an endpoint is not implemented yet, the Live implementation should fail explicitly.

Do not silently return mock data from Live mode.

---

# 29. Live API failure

If Live mode cannot reach the backend, show a useful error:

```text
Live API unavailable

Could not connect to the configured backend.

[ Retry ]
[ Switch to Mock ]
```

The user must explicitly choose Mock mode.

Never silently present mock data as live data.

---

# 30. Demo controls

Visible only in Mock mode.

Add a discreet demo panel with:

```text
Reset demo data
Simulate regulation update
Run demo evaluation
Simulate API error
```

The most important action:

```text
Reset demo data
```

must restore a deterministic initial state.

The presenter must be able to repeat the demo reliably.

---

# 31. Recommended mock demo flow

The full demo must work without backend availability.

Recommended flow:

```text
1. Open dashboard
2. Show regulations / active rules
3. Open wizard
4. Paste regulation text
5. Generate internal policy
6. Generate deterministic + agentic rules
7. Review rule human explanation vs code/text
8. Approve one or more rules
9. Return to dashboard
10. Start PoC evaluation
11. Show progress
12. Open suspicious transaction
13. Show rule scores + trace
14. Show resulting AML event
15. Open audit log
```

Optional second flow:

```text
1. Simulate regulation update
2. Show affected rule
3. Create new version
4. Put it into update_for_review
5. Approve update
6. Show audit entry
```

---

# 32. Visual direction

Use a light fintech / enterprise UI.

Do NOT make it:

```text
cyberpunk
black neon
gaming interface
crypto dashboard
generic chatbot
hacker terminal
```

It SHOULD feel like:

```text
serious financial institution software
modern AML/compliance platform
B2B SaaS
AI-assisted analyst tooling
```

Recommended palette:

```text
Background        #F7F9FC
Surface           #FFFFFF
Border            #E5E7EB
Primary text      #111827
Secondary text    #6B7280
Primary           #2563EB
Success           #16A34A
Warning           #D97706
Danger            #DC2626
```

Use restrained blue/indigo accents for AI-generated content.

Use red/amber only when they carry semantic meaning.

---

# 33. High-tech feel

Create a modern feel through:

```text
progressive evaluation states
live-looking progress indicators
AI generation status
trace visualization
side-by-side human vs machine rule view
confidence / score visualizations
timeline/audit views
smooth but subtle transitions
```

Do not rely on dark mode or neon effects.

---

# 34. Layout

Desktop-first.

Persistent left sidebar.

Suggested navigation:

```text
RedFlag

Dashboard
Wizard
Regulations
Policies
Rules
Evaluations
AML events
Clients
Audit log

----------------

Data source
Mock API

Settings
```

Top bar:

```text
Page title
breadcrumbs
search
notifications
current user
```

Use a fake current user if auth is not implemented.

Example:

```text
Jane Doe
AML Analyst
```

Authentication is out of scope unless repository specs already require it.

---

# 35. Secrets and environment configuration

All real private API keys must be managed using **Vercel Environment Variables / Secrets**.

Do not commit real credentials.

Create:

```text
apps/web/.env.example
```

Example:

```env
NEXT_PUBLIC_API_MODE=mock
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001/api

NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

SUPABASE_SERVICE_ROLE_KEY=
AWS_API_BASE_URL=
AWS_API_KEY=
BEDROCK_PROXY_API_KEY=
```

Important:

```text
NEXT_PUBLIC_* = browser visible
everything else = server only
```

Never expose:

```text
SUPABASE_SERVICE_ROLE_KEY
AWS_API_KEY
BEDROCK_PROXY_API_KEY
```

to client components.

---

# 36. Environment modules

Centralize env access.

Create:

```text
src/config/env.client.ts
src/config/env.server.ts
```

Use Zod validation.

`env.server.ts` must include:

```ts
import 'server-only';
```

Do not read `process.env` throughout arbitrary components.

---

# 37. Vercel secrets

Assume real deployment values are configured in:

```text
Vercel
→ Project
→ Settings
→ Environment Variables
```

Support:

```text
Development
Preview
Production
```

The repository must not contain production credentials.

If a private AWS endpoint requires a secret, use a server-side Next.js route handler or existing backend/BFF.

Never send private AWS credentials to the browser.

---

# 38. `.gitignore`

Ensure local secret files are ignored.

At minimum:

```gitignore
.env
.env.local
.env.development.local
.env.test.local
.env.production.local
```

Keep:

```text
.env.example
```

committed.

---

# 39. shadcn/ui

Use shadcn/ui for common primitives.

Likely useful:

```text
Button
Card
Badge
Table
Tabs
Dialog
Sheet
DropdownMenu
Tooltip
Progress
Skeleton
Alert
Switch
Separator
Input
Textarea
Select
Command
Slider
Sonner / Toast
```

Product-specific components should live under features.

---

# 40. Accessibility

Ensure:

```text
visible keyboard focus
semantic tables
form labels
accessible dialogs
status text in addition to color
sufficient contrast
buttons with labels
```

---

# 41. Loading, empty and error states

All major async pages need:

```text
loading
empty
error
```

Use skeletons for lists and dashboard data.

Use explicit progress UI for:

```text
rule generation
regulation checks
PoC evaluation
```

---

# 42. Avoid overengineering

Prioritize:

```text
working demo
stable mock architecture
clean API boundary
visual polish
clear AML workflow
traceability
auditability
```

Avoid spending hackathon time on:

```text
microfrontends
Redux without a real need
premature shared packages
complex infra abstraction
large test suites
perfect DDD
unused AWS scaffolding
unused database abstractions
```

---

# 43. Backend integration later

The frontend must be intentionally designed so backend integration is incremental.

When real backend endpoints arrive:

```text
1. Keep frontend domain models stable
2. Implement live adapters
3. Map backend DTOs into frontend models
4. Point Live mode to real endpoints
5. Validate responses
6. Remove mock usage from production mode
```

Do not delete Mock mode.

Mock mode remains valuable for:

```text
demo fallback
development
UI work
testing
offline presentation
```

Mocks should therefore remain maintained, but **Live mode must never transparently use them**.

---

# 44. Future monorepo expansion

When backend code is later added, expected direction may be:

```text
redflag/
├── apps/
│   ├── web/
│   └── worker/
│
└── packages/
    ├── contracts/
    ├── domain/
    └── db/
```

Do not perform this extraction prematurely.

When a second consumer exists, shared Zod API contracts are a good candidate for:

```text
packages/contracts
```

Until then keep frontend types inside `apps/web`.

---

# 45. README requirements

Create/update README with:

```text
What RedFlag is
Current frontend scope
Repository structure
How to install
How to run
How to build
How Mock / Live mode works
How to reset mock demo data
Environment variables
Vercel secrets
How live API adapters should be implemented
How backend code can later be added to the monorepo
Main demo flow
```

---

# 46. Build checks

Before finishing run:

```bash
pnpm build
pnpm lint
pnpm typecheck
```

Fix:

```text
TypeScript errors
lint errors
hydration errors
invalid client/server imports
broken routes
broken mock/live switching
```

---

# 47. Definition of Done

The frontend is done when:

- repository context and specifications were read first
- only the frontend app was added unless backend code already existed
- repo is monorepo-ready
- Next.js + TypeScript + App Router are used
- Tailwind and shadcn are configured
- Mock / Live mode exists
- Mock is the safe default
- selected mode persists across refresh
- the full primary demo works with Mock mode only
- mock data supports real domain concepts from the spec
- pages do not directly branch between mock and live implementations
- stable service interfaces exist
- Live adapters are separate
- backend can replace mocks without rewriting UI
- Live mode never silently falls back to mocks
- rule wizard works
- manual rule creation works
- rule review works
- rule states work
- PoC evaluation works in Mock mode
- evaluation detail exposes scores and trace
- AML events are visible
- audit log is visible and updated by mock mutations
- secrets are not committed
- `.env.example` exists
- private environment variables remain server-only
- README documents integration points
- build passes
- lint passes
- typecheck passes

---

# 48. Final instruction

You are expected to **implement the frontend**, not merely describe it.

Start by reading the repository and specifications.

Then build the smallest robust architecture that:

```text
works today with mocks
looks polished enough for the hackathon
matches the actual RedFlag domain
can switch to real APIs later
does not expose secrets
does not prematurely build backend infrastructure
```

The most important architectural principle is:

> The frontend must be fully demoable with mock services today, while the real backend can be plugged in later by replacing live service adapters rather than rewriting the UI.
