# Deploying the agent builder

Its own Worker, its own queue, its own config. **Nothing here is wired into the
repository's deploy**: that workflow runs `wrangler deploy` at the root against the
root config and never reads this directory, so this can only ship when somebody
runs the commands below on purpose.

**As of this writing nothing has been deployed.** The database half is live (see
the bottom of this file); the Worker is not.

---

## 1. The secrets and settings, by exact name

Three settings are required. **One of them is not a secret, and one that used to be
required is now optional** — both worth reading before you paste anything.

| name | kind | what it is for |
|---|---|---|
| `SUPABASE_URL` | secret (not sensitive, but keep it with the others) | the project's API URL, e.g. `https://ujrqdmmtcptvimazlhom.supabase.co` |
| `SUPABASE_SERVICE_KEY` | **secret — the sensitive one** | the service-role key (legacy `eyJ…`) or a `sb_secret_…` key. The backend writes the journal and the queue with it. It must never reach a browser. |
| `SUPABASE_PUBLISHABLE_KEY` | **not a secret** | the publishable key (`sb_publishable_…`) or the legacy `anon` key. It is what lets Supabase Auth be asked whether a legacy HS256 token is genuine. Safe to expose; kept as a secret only so all the settings live in one place. |
| `SUPABASE_JWT_SECRET` | **OPTIONAL** | do not set it unless you want to. See below. |

### Why the JWT signing secret is optional now

Asking for a project's HS256 signing secret means asking for the credential that
can **mint a token for any user**, to do a job that only needs the ability to
**check** one. The verifier does not need it:

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

### Putting them in

```sh
cd agent-builder
wrangler secret put SUPABASE_URL               -c wrangler.jsonc
wrangler secret put SUPABASE_SERVICE_KEY       -c wrangler.jsonc
wrangler secret put SUPABASE_PUBLISHABLE_KEY   -c wrangler.jsonc
# optional, and only if you want the local HS256 fast path:
# wrangler secret put SUPABASE_JWT_SECRET      -c wrangler.jsonc
```

**A missing setting is a named 503 on every request**, listing the names and never
a value. That is deliberate: an uncaught throw is answered by Cloudflare in HTML,
and a caller doing `.json()` learns nothing.

---

## 2. The queue

The Worker refuses to run without it — a missing binding is on the same 503 as a
missing secret, because a deployment that believes it is durable and is not is
worse than one that refuses to start.

```sh
wrangler queues create agent-runs
```

The binding is `RUN_QUEUE` and the queue is `agent-runs`; both are in
`wrangler.jsonc`, and `test/worker.test.mjs` reads that file and compares the
binding name against the Worker's own `QUEUE_BINDING`, so the two cannot drift.

**Cloudflare Queues needs a paid Workers plan.** If that is not wanted, the
alternative is not `ctx.waitUntil` — it is a different transport behind the same
seam, because the durable part is the `agent.run_work` row and not the message.
`scripts/consume.mjs` is a worked example: it takes no messages at all and finds
work by sweeping the table.

---

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

## 4. Deploy

```sh
cd agent-builder
wrangler deploy -c wrangler.jsonc
```

That publishes `agent-builder-api` with the producer binding, the consumer, and the
every-minute cron that sweeps dropped work.

### Check it, in this order

```sh
# 1. configured? An unauthenticated request should be 401 — NOT 503.
curl -si https://<your-worker-url>/runs | head -1
#    503 with {"error":"not configured: …"} names exactly what is missing.

# 2. start a run as a signed-in customer
curl -s -X POST https://<your-worker-url>/runs \
  -H "authorization: Bearer <a real customer access token>" \
  -H 'content-type: application/json' \
  -d '{"agent":"slow","prompt":"take your time"}'
#    → 202 {"runId":"…","status":"queued","delivered":true}

# 3. watch it. `steps` climbs while it runs; `status` goes running → stopped.
curl -s https://<your-worker-url>/runs/<runId> -H "authorization: Bearer <token>"
```

`agent: "slow"` is the long-running stand-in: eight stages of eight seconds, so it
finishes about 65 seconds after the response came back. `agent: "support"` is the
short one.

---

## 5. What is still not connected

- **A real model provider.** `MODELS` in `src/worker.mjs` has one entry,
  `stand-in`. A name it does not know is refused rather than defaulted, so adding a
  provider is one registry entry plus a `send` implementation — and nothing above
  it changes, because `send` is the only place a provider's wire format may appear.
- **Nothing is deployed.** No Worker, no queue, no route, no domain.
- **A run longer than one consumer invocation** works by being resumed rather than
  by running longer: the lease lapses, the cron re-offers it, and the next consumer
  continues from the log. That is the design, but it has not been measured against a
  real invocation ceiling — the longest run driven end to end is 65 seconds.
