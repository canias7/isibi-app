# Deploying the agent builder

Its own Worker, its own queue, its own config. **Nothing here is wired into the
repository's deploy**: that workflow runs `wrangler deploy` at the root against the
root config and never reads this directory, so this can only ship when somebody
runs the commands below on purpose.

**As of this writing nothing has been deployed.** The database half is live (see
the bottom of this file); the Worker is not.

---

## 1. The one secret, and the exact command

**Everything else is already configured in `wrangler.jsonc`.** The project URL and the
publishable key are not secrets — a URL is public and a publishable key is designed
to be handed to browsers — so they are committed as plain `vars`, and the deployment
needs exactly **one** `wrangler secret put`.

```sh
cd agent-builder
wrangler secret put SUPABASE_SERVICE_KEY -c wrangler.jsonc
```

It prompts, reads the value from the terminal without echoing it, and never writes it
to disk or to your shell history. **Paste the service-role key (`eyJ…` with
`"role":"service_role"`) or an `sb_secret_…` key.** Nothing else about this Worker
needs a secret.

### ⚠ RUN IT BEFORE THE FIRST DEPLOY, NOT AFTER

**On this account a standalone `wrangler secret put` AFTER a deploy fails** with *"the
latest version of your Worker isn't currently deployed"* — Cloudflare's
versioned-deployments guard. That is not a guess: it is why the rest of this
repository uploads its secrets *inside* the deploy step rather than after it, recorded
in `.github/workflows/deploy.yml`.

So the order is:

1. `wrangler secret put SUPABASE_SERVICE_KEY -c wrangler.jsonc` — wrangler will say
   the Worker does not exist yet and offer to create it. **Say yes.** That creates the
   Worker with the secret attached and no code.
2. `./scripts/deploy.sh` — creates the queue and uploads the code.

Doing it the other way round works too, but only if you never need to *rotate* the
secret; a rotation hits the guard. If it ever does, re-deploy and then set it, or set
it and re-deploy — the order that works is secret-then-deploy.

### The settings, for reference

| name | where it lives | what it is for |
|---|---|---|
| `SUPABASE_SERVICE_KEY` | **secret** (`wrangler secret put`) | the backend writes the journal and the queue with it. It can read and write every tenant's runs, which is why it is the only secret. |
| `SUPABASE_URL` | committed var | the project's API URL |
| `SUPABASE_PUBLISHABLE_KEY` | committed var | **not a secret.** It lets Supabase Auth be *asked* whether a legacy HS256 token is genuine. It grants nothing on the `agent` schema — `anon` is revoked from every table there, checked against a real PostgreSQL. |
| `MODEL` | committed var | `stand-in`. A name the Worker does not know is refused, never defaulted. |
| `SUPABASE_JWT_SECRET` | **optional secret** | do not set it unless you want to. See below. |

`src/worker.mjs` exports `SENSITIVE`, and a test asserts nothing on that list is ever
a var in the committed config — and that everything not on it *is* set, so a deploy
from this file cannot be quietly half-configured.

### Why the JWT signing secret is optional

Asking for a project's HS256 signing secret means asking for the credential that can
**mint a token for any user**, to do a job that only needs the ability to **check**
one. The verifier does not need it:

- **This project publishes an ES256 public key** at
  `/auth/v1/.well-known/jwks.json` (measured 2026-09-15: one key, `kid`
  `87e0c19f-00be-48c1-bf46-5a5f318a0ea9`, `alg` `ES256`, and it imports into
  WebCrypto). An asymmetric token is verified **in the Worker, with no secret and
  no network call per request**. This is the preferred path and needs nothing
  configured.
- **A legacy HS256 token is checked by Supabase Auth** — `GET /auth/v1/user` with
  the token and the publishable key. Measured against this project: a genuinely
  signed token is refused for its *claims* (`missing sub claim`), and the same
  token with one character changed is refused for its *signature*, so the endpoint
  really is a signature oracle. Costs one round trip, cached for 60 s per token,
  bounded by the token's own expiry.

Set `SUPABASE_JWT_SECRET` only if you have already accepted that credential's
blast radius and want HS256 verified locally instead of over the network. Nothing
else changes when you do.

---

## 2. The queue, and the deploy

Both in one command, run by hand:

```sh
cd agent-builder
CLOUDFLARE_API_TOKEN=… CLOUDFLARE_ACCOUNT_ID=… ./scripts/deploy.sh
```

It runs the tests first, creates `agent-runs`, **prints the queue verdict loudly**,
and deploys with `wrangler@4.107.0` — the same CLI the rest of this repository
deploys with.

**The queue verdict is printed rather than swallowed because of a trap this
repository already hit:** `queues create` fails when the queue already exists, which
is the ordinary steady state, so the call needs `|| true` — and a token *without the
Queues edit permission* fails in a way that looks identical from a silent `|| true`.
It would surface later as a Worker answering 503 for a binding that was never
created. If the script prints `QUEUE NOT CONFIRMED`, add **Queues edit** to the token
at Cloudflare → My Profile → API Tokens and run it again.

**The Worker refuses to run without the binding** — a missing one is on the same
named 503 as a missing secret, because a deployment that believes it is durable and
is not is worse than one that refuses to start.

**Cloudflare Queues needs a paid Workers plan.** If that is not wanted, the
alternative is not `ctx.waitUntil` — it is a different transport behind the same
seam, because the durable part is the `agent.run_work` row and not the message.
`scripts/consume.mjs` is a worked example: it takes no messages at all and finds work
by sweeping the table.

## 3. The database

Already done, on the project the rest of this repository uses
(`ujrqdmmtcptvimazlhom`). Three migrations, all applied:

| remote version | file |
|---|---|
| `20260915015602` | `agent_runs` — the runs and the append-only journal |
| `20260915022217` | `agent_tenant_falls_back_to_subject` |
| `20260915032807` | `agent_run_work` — the durable queue |

Also already done: `agent` is in PostgREST's exposed schemas, set as an in-database
override on the `authenticator` role. If you ever need to redo that:

```sql
alter role authenticator set pgrst.db_schemas = 'public, graphql_public, agent';
notify pgrst, 'reload config';
notify pgrst, 'reload schema';   -- BOTH signals; the first alone leaves the tables invisible
```

If a fresh project is ever used instead, apply the three files in
`supabase/migrations/` in name order and then do the two `notify` lines above.

---

## 4. Verify it

One command, and it checks the four things that matter rather than describing them:

```sh
cd agent-builder
AGENT_URL=https://agent-builder-api.<your-subdomain>.workers.dev \
AGENT_USER_EMAIL=… AGENT_USER_PASSWORD=… \
SUPABASE_URL=https://ujrqdmmtcptvimazlhom.supabase.co \
SUPABASE_PUBLISHABLE_KEY=sb_publishable_icEWWZsuue5VG4ogSwFFCA_D01jLquT \
SUPABASE_SERVICE_KEY=… \
node scripts/verify-live.mjs
```

It signs in as that customer for real, and reports the deployed version, the
endpoint, every run id and every result. **It takes about eight minutes**, because
three of the runs are the 65-second stand-in and a handover between consumers costs a
beat, the sweep's grace and a cron tick.

What it checks:

1. **a real customer signs in, starts the long task, is answered 202 promptly, and
   reads progress and then the final result** — plus that the prompt was committed
   *before* the response and that the stored log matches what the API reported;
2. **one run, one execution** — two simultaneous resumes mid-run are both refused as
   `already-running` without disturbing the holder's lease; a direct second
   `claim_run` while the lease is live gets nothing; and the finished log holds
   exactly one model answer per step, so nothing ran twice;
3. **an interrupted consumer is replaced and progress is kept** — the lease is
   revoked, another consumer takes the run over, the step count never goes backwards,
   and the log holds one model answer per step with more steps than before the
   interruption, so it continued rather than restarting;
4. **a lost lease writes nothing, and an uncertain action stays blocked** — the
   `guarded` agent's tool is declared *not repeatable*; its lease is revoked while a
   tool call is in flight, and the in-flight result is **never written**, no stop is
   recorded, the pending call is visible, `problems` is empty, and asking again
   refuses again without repeating the action.

**How an interruption is produced, said plainly:** the lease is revoked with the
service key, which is exactly what the platform's own reclaim does to a consumer that
has died. What it does *not* reproduce is a consumer that dies mid-write — that needs
a real isolate killed at a chosen instant, and nothing here can do it.

**The script is itself exercised before you run it.** `npm run verify:local` runs the
same file, unmodified, against a local PostgreSQL with these migrations and two
separate consumer processes: **50 checks, 0 failed**. The legs that differ against a
deployment are the sign-in (a token is supplied directly), the transport (the
consumers sweep the table instead of taking messages — the weaker path, not the
stronger one) and the clock (compressed, with the grace-is-at-least-a-beat invariant
still enforced by `consume.mjs`, which refuses to start otherwise).

### A quick check by hand, if you prefer

```sh
# configured? An unauthenticated GET /health answers 200 either way and names what
# is missing — it never quotes a value.
curl -s https://<your-worker-url>/health | jq

# start a run as a signed-in customer
curl -s -X POST https://<your-worker-url>/runs \
  -H "authorization: Bearer <a real customer access token>" \
  -H 'content-type: application/json' \
  -d '{"agent":"slow","prompt":"take your time"}'
#    → 202 {"runId":"…","status":"queued","delivered":true}

# watch it. `steps` climbs while it runs; `status` goes running → stopped.
curl -s https://<your-worker-url>/runs/<runId> -H "authorization: Bearer <token>"
```

`slow` is the long stand-in: eight stages of eight seconds, finishing about 65
seconds after the response. `guarded` is the same shape with a non-repeatable tool.
`support` is the short one.

---

## 5. What is still not connected

- **A real model provider.** `MODELS` in `src/worker.mjs` has one entry,
  `stand-in`. A name it does not know is refused rather than defaulted, so adding a
  provider is one registry entry plus a `send` implementation — and nothing above
  it changes, because `send` is the only place a provider's wire format may appear.
- **⚠ CROSSING A CONSUMER INVOCATION'S OWN WALL-CLOCK CEILING IS UNTESTED.** The
  design answer is that the lease lapses, the cron re-offers the run, and the next
  consumer continues from the log — the same mechanism check 3 above exercises
  deliberately. But no run has actually reached that ceiling: the longest driven end
  to end is 65.6 seconds, and the verification says so in its own closing lines.
- **The service-key legs of the verification are unexercised against the hosted
  PostgREST.** Reading `agent.run_work` and revoking a lease as `service_role` has
  been proved on a real PostgreSQL and at the database level on the hosted project,
  but not over its HTTP API — because no service key has been available here. They
  will fail loudly with a named HTTP error rather than quietly if anything is wrong.
  **What HAS been confirmed on the hosted project: PostgREST's schema cache knows the
  table and all six queue functions.** Called with their real argument names they
  answer the `anon` permission wall (`permission denied for schema agent`), while a
  nonexistent function with the same argument names answers `PGRST202` — the control
  that makes that conclusive, because PGRST202 covers both "not in the cache" and
  "wrong arguments" and cannot tell them apart on its own.
