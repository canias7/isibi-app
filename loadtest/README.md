# Load testing & scaling — gofarther.dev

How to check whether the app survives a crowd, and what to do about the results.

## TL;DR

- The **edge tier scales for free**: static assets + the Cloudflare Worker (`/api/*`)
  auto-scale far past 1000 concurrent users. Not the bottleneck.
- The **bottleneck is Supabase**: currently the **Free / Nano** tier
  (`max_connections = 60`, shared CPU). Data access is 100% over HTTP
  (PostgREST RPCs + GoTrue auth) — the app never opens direct Postgres connections.
- **Correctness under load is already solid** — the credit-charge, storage, and
  orchestrator races are fixed (atomic RPCs + reservation ledgers), so money and
  data stay correct no matter the concurrency. The question is *latency and
  throughput*, not corruption.

---

## 1. Running the load test (`gofarther-load.js`)

It exercises the paths that matter **without spending any generation money**
(never touches `/api/video|image|audio` or the director):

- `page` scenario — HTML + `chat.js` / `styles.css` / `studio.js` from the edge.
- `credits` scenario — `GET /api/credits` → Worker → GoTrue token verify →
  `get_credits` RPC. This is the **read path that hits your real DB + auth** —
  the actual bottleneck. It is read-only (no charge).

### Setup
1. Install k6 — <https://k6.io/docs/get-started/installation/> (`brew install k6`).
2. Grab a token — signed in on gofarther.dev, browser console:
   `JSON.parse(localStorage.zephyr_session_v1).access_token`
3. Raise the socket limit for high VU counts: `ulimit -n 250000`

### Run
```bash
# safe start — page ramps to 1000 VUs, DB path to 100
k6 run -e TOKEN=<paste-token> gofarther-load.js

# push the DB path toward 1000 once you trust it
k6 run -e TOKEN=<token> -e API_VUS=1000 gofarther-load.js

# static-only, zero DB load (no token needed)
k6 run gofarther-load.js

# point at a staging deployment instead of prod
k6 run -e BASE_URL=https://staging.example.com -e TOKEN=<token> gofarther-load.js
```
Env knobs: `PAGE_VUS` (default 1000), `API_VUS` (default 100), `RAMP` (default `1m`),
`HOLD` (default `2m`), `BASE_URL` (default `https://gofarther.dev`).

> ⚠️ This hits **production** and its live Supabase by default. It is read-only and
> spends no fal/Anthropic money, but it *is* real DB load — start at the defaults
> and `Ctrl-C` anytime. Prefer a staging deployment if you have one.

### Reading the result
The run prints a summary. What to look for as you raise `API_VUS`:
- `page p95` stays low even at 1000 → the edge tier scales. Expected.
- `credits p95` climbing + `api 429/503` appearing → **Supabase hitting its
  ceiling**. That's your answer to "would it handle 1000", and the fix is scaling
  Supabase, not code.

---

## 2. What breaks first, and why

At ~1000 concurrent interactive users the failure order is:

1. **Postgres CPU + PostgREST/GoTrue throughput** on the Nano instance. The 60
   connections are shared by PostgREST's internal pool, GoTrue, Realtime, and
   Storage; PostgREST's pool is small (~10–15). RPCs queue → latency → timeouts.
2. **Auth verification load** — every `/api/*` call verifies the JWT via GoTrue
   `/auth/v1/user`, i.e. one extra auth+DB hit per request.
3. **fal.ai / Anthropic** — external ceilings (rate limits + real money), not app
   bugs. The director already degrades gracefully (falls back to raw prompting).

The edge tier (static + Worker) does **not** break here — it scales.

---

## 3. Scaling plan (priority order)

### A. Scale up Supabase compute — the biggest lever
Move off Free/Nano to a paid compute add-on (Project → Settings → Compute; a few
minutes + a restart). Each tier raises CPU, RAM, `max_connections`, and
PostgREST/GoTrue capacity. **Small → Medium** is the likely sweet spot for 1000
interactive users *once request volume per user is reduced (B)*; go larger for
heavy sustained load. Use the k6 numbers to pick the tier.

### B. Cut DB calls per user (cheap, high-impact — do alongside A)
- **Cache `/api/credits` + `is_paid` client-side** (~30–60s TTL; refetch only
  after a generation or purchase). These are polled today — a big chunk of RPC
  volume is redundant.
- **Cache the auth verification in the Worker.** Every `/api/*` calls GoTrue to
  verify the token; cache that result per-token for a short TTL (e.g. 60s) in the
  isolate or Cloudflare Cache/KV. Removes a GoTrue round-trip per request — the
  single biggest per-request saving under load. (Trade-off: a revoked token stays
  accepted up to the TTL.)
- **Debounce chat sync** (`pushChats`/`pullChats`) — batch, don't sync per message.

### C. Re-enable the generation rate limit
The per-user generation quota is currently **off**. Under a crowd, re-enable a
daily/burst gen cap (`useQuota(request, "gen", N)` on `/api/video|image|audio`) so
1000 users can't stampede fal — protects the fal balance *and* trims the
charge-flow DB writes.

### D. Connection pooler (Supavisor) — only if you add a direct-DB backend
Not needed today: the app is HTTP-only (PostgREST/GoTrue). *If* you ever add a
serverless function or backend that connects to Postgres directly (pg driver),
use the **Supavisor transaction-mode pooler** (port 6543) — never a direct
connection, or serverless concurrency will exhaust `max_connections`.

### E. Monitor
Watch Supabase → Reports (DB CPU, connections, PostgREST/GoTrue latency) while the
k6 test runs and as real traffic grows. The k6 `429/503` rate + `credits p95` are
your early-warning signals.

---

## Bottom line
Do **A + B** and the app comfortably serves ~1000 concurrent interactive users;
**C** protects your wallet. The k6 test tells you exactly how far the current
Nano tier gets you before you scale.
