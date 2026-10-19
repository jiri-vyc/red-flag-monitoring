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
- Do not commit datasets, transaction records, or any real personal data (names, account numbers, national IDs, or financial records) to the repo. Use synthetic or vendor-provided datasets only.

## AWS accounts

Only these accounts may be used for this project:

| Account ID | Purpose |
| --- | --- |
| `526983806399` | Team space |
| `422928733782` | Read-only vendor datasets, S3 bucket `ai-hackathon-datasets-422928733782` |

Do not use any other AWS account. Verify the active account (`aws sts get-caller-identity`) before running AWS commands that create or change resources. Treat account `422928733782` as read-only.

## Commits

Use [Conventional Commits](https://www.conventionalcommits.org/): `type(scope): summary`, e.g. `feat(triage): add red-flag scoring prompt`, `docs: add AGENTS.md`. Common types: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `ci`.

Do not add `Co-authored-by` trailers or any other AI attribution footnotes to commit messages, pull requests, or other repo text.

## Compliance

- Outputs that support AML decisions are decision aids, not final determinations. Flag any escalation logic that would need compliance or legal review.
