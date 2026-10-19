# red-flag-monitoring

AML transaction monitoring: triage and red-flag escalation, built for the FinTechers hackathon (Track 5 · Compliance and RegTech copilots, challenge by FINREG PARTNERS).

See [AGENTS.md](AGENTS.md) for working rules.

## Connect to the database with DBeaver

The Aurora cluster `database-1` (team AWS account, `eu-central-1`) has no passwords, only short-lived IAM tokens.

1. Log in to AWS: `aws sso login --profile hackathon`
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
