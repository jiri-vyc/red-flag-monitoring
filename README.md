# red-flag-monitoring

AML transaction monitoring: triage and red-flag escalation, built for the FinTechers hackathon (Track 5 · Compliance and RegTech copilots, challenge by FINREG PARTNERS).

See [AGENTS.md](AGENTS.md) for working rules.

## Deployed app

| What           | URL                                                                                                                                                        |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Web (frontend) | https://vkdtj1g7xt7fqkkn.clq.lambda-web.eu-central-1.on.aws                                                                                                |
| API (backend)  | https://pzrs33rhnqf7x5fm.clq.lambda-web.eu-central-1.on.aws (e.g. [`/api/health`](https://pzrs33rhnqf7x5fm.clq.lambda-web.eu-central-1.on.aws/api/health)) |
| Database probe | [`/api/database-status`](https://pzrs33rhnqf7x5fm.clq.lambda-web.eu-central-1.on.aws/api/database-status), also the Database panel in the web sidebar      |

Both run as AWS Lambda Web Functions (`rfm-web`, `rfm-api`) in the team account `526983806399`, `eu-central-1`. The API uses the Aurora database `main`. The web proxies `/api/*` to the API and calls the real backend (`NEXT_PUBLIC_API_MODE=live`). The URLs stay the same across redeploys. Both endpoints are public and have no authentication, so use synthetic and organiser data only. To deploy, see [src/README.md](src/README.md#deployment).

## Set up AWS CLI access (once per machine)

There are no access keys, only SSO. Full guide: the organisers' "AWS Participant Guide" on Notion.

Add this to `~/.aws/config`, or run `aws configure sso` with the same values. The SSO region is `eu-north-1` on purpose; all work happens in `eu-central-1`.

```ini
[sso-session hackathon]
sso_start_url = https://d-c3676ff6eb.awsapps.com/start
sso_region = eu-north-1
sso_registration_scopes = sso:account:access

[profile hackathon]
sso_session = hackathon
sso_account_id = 526983806399
sso_role_name = ai-hackathon-TeamAdmin
region = eu-central-1
output = json

# For the Node.js backend: reuses the CLI's 12 h role credentials (see below).
[profile hackathon-sdk]
credential_process = aws configure export-credentials --profile hackathon --format process
region = eu-central-1
```

The backend uses `hackathon-sdk`, not `hackathon`. With a plain SSO profile the AWS SDK for Node.js needs the SSO access token, which expires after 1 hour, and refreshing it fails for this directory (`InvalidGrantException`). The backend then answers 500 with `Token is expired` in its log, even though the AWS CLI still works. The `credential_process` profile makes the SDK take the CLI's role credentials, which last the whole 12 h session.

Then log in and check the account. The login lasts 12 hours.

```bash
aws sso login --profile hackathon
aws sts get-caller-identity --profile hackathon   # Account must be 526983806399
```

## Run the web locally against the Aurora database

The browser never talks to the database. The web proxies `/api/*` to the local backend, and the backend connects to Aurora `main` with a fresh IAM token per connection.

```
browser → web (localhost:3000) → /api proxy → backend (localhost:4000) → Aurora database-1 / main
```

1. Log in to AWS (see above): `aws sso login --profile hackathon`
2. Create `src/backend/.env`:

   ```env
   PORT=4000
   DATABASE_AUTH=iam
   DATABASE_URL=postgres://postgres@database-1.cluster-c9m6a2a047k1.eu-central-1.rds.amazonaws.com:5432/main
   AWS_REGION=eu-central-1
   AWS_PROFILE=hackathon-sdk
   ```

3. Create `src/web/.env.local`. Every section is live, including the wizard (regulation text or a Markdown file, policy drafts, rule drafts created on policy approval) and the dashboard, which the web composes from the rules, regulations, internal policies and evaluation runs endpoints. Do not pin the wizard to mock: it is shown only when it shares the data source with regulations, policies and rules.

   ```env
   NEXT_PUBLIC_API_MODE=live
   BACKEND_URL=http://localhost:4000
   ```

4. Start both from `src/`:

   ```bash
   npm install
   npm run dev
   ```

5. Open http://localhost:3000. Dashboard, Regulations, Internal policies, Rules and Batches now read from Aurora, and the sidebar no longer shows "Mock data, not connected to API". If the sidebar's **Data source** shows Mock, this browser remembers an earlier choice: switch it to Live. Check the backend alone with `curl localhost:4000/api/rules`.

Notes:

- **Restart `npm run dev` after changing `.env.local`.** `NEXT_PUBLIC_*` values are read at start/build time.
- **Data source switch.** `NEXT_PUBLIC_API_MODE` only sets the default. The **Data source: Mock / Live** switch in the sidebar footer overrides it per browser (kept in localStorage) without a rebuild. Mock runs the whole web on browser demo data, including features the API does not have yet (CSV upload, starting an evaluation run, loading a regulation from a URL in the wizard, draft editing). Live uses the API with the env per-service overrides. A live error screen offers Retry and "Switch to mock"; the web never switches on its own.
- **Writes go to `main`.** Creating, approving, whitelisting or running the wizard in the web writes to the shared team database through the API. For experiments use your own copy: `db/create-wip.sh <name>`, then point `DATABASE_URL` at `wip_<name>`.
- **Not in the API yet:** CSV batch upload, loading a regulation from a URL in the wizard, draft editing and deterministic rule generation. In live mode the web hides or disables them (see the capabilities in `todo-web.md` and the backend plan in `backend-todo.md`). The wizard's policy and rule drafts come from a placeholder generator on the backend for now (titles start with `[DUMMY]`). A blue dot in the sidebar marks sections on mock data. Without `.env.local` the web runs fully on browser mock data and needs no backend.
- **Errors:** "Token for hackathon does not exist", "Token is expired" or a 500 from `/api/database-status` (the sidebar shows "Database unreachable") means the SSO session ended: run `aws sso login --profile hackathon` and restart `npm run dev`. If it happens about an hour after login, check that `src/backend/.env` uses `AWS_PROFILE=hackathon-sdk`. The first request after idle can take ~15 s while the cluster resumes.
- **Stop `npm run dev` when done.** An open connection keeps the cluster billing.

## Connect to the database with DBeaver

The Aurora cluster `database-1` (team AWS account, `eu-central-1`) has no passwords, only short-lived IAM tokens.

1. Log in to AWS: `aws sso login --profile hackathon` (first time: [set up AWS CLI access](#set-up-aws-cli-access-once-per-machine))
2. In DBeaver create a **PostgreSQL** connection:
   - Host: `database-1.cluster-c9m6a2a047k1.eu-central-1.rds.amazonaws.com`
   - Port: `5432`
   - Database: `main`
   - Username: `postgres`
   - "Save password": off
3. In the **Driver properties** tab set:
   - `sslmode` = `verify-full`
   - `sslfactory` = `org.postgresql.ssl.DefaultJavaSSLFactory`
4. Generate a token. This copies it to the clipboard:

   ```bash
   aws rds generate-db-auth-token --profile hackathon --region eu-central-1 --hostname database-1.cluster-c9m6a2a047k1.eu-central-1.rds.amazonaws.com --port 5432 --username postgres | pbcopy
   ```

5. Connect and paste the token as the password.

Notes:

- **Token lifetime:** a token opens new connections for 15 minutes; open sessions stay up. When DBeaver asks again, repeat step 4. If the command fails, repeat step 1.
- **Slow first connect:** the cluster auto-pauses when idle, so the first connect can take ~15 s.
- **`main` is changed only via migrations** (see AGENTS.md). Treat the DBeaver connection as read-only and disconnect when done, because an open connection keeps the cluster billing.
