# 2026-10-26: the site's signals (branch `site-signals`, from `explore-code`)

Three explore tools that said "unavailable" now answer. Not merged, not
deployed; the table is proposed, not applied. Nothing paid was run.

## What each tool answers now

- **`services`**: yes / no / not known for Stripe connected
  (`STRIPE_SECRET_KEY`), an email key (`RESEND_KEY`, `SENDGRID_KEY`,
  `POSTMARK_KEY`), `EMAIL_FROM`, spam protection (the site's own Turnstile pair;
  the platform check requested by `TURNSTILE_PLATFORM`), and a live custom
  domain. Judged by the NAMES in the site's `_secrets` (`select name from
  _secrets`; the cipher is never selected) and `site_domains` (status only).
  Cannot-tell reads "not known", never "no".
- **`logins`**: customer sign-in on/off (`auth_info` in `_meta`), the account
  count (`neon_auth.users_sync`, deleted excluded), and the number of database
  roles named in the site's access policies. Counts only; no user list.
- **`site_errors`** (renamed from `error_logs`): the site's errors from the
  last 30 days, newest first, each with its count, first and last seen,
  source, kind, page and scrubbed message, fenced as untrusted data.
- **`traffic`**: Cloudflare's own analytics (no new storage): one GraphQL
  query, dataset `httpRequestsAdaptiveGroups` at the account, filtered to the
  site's own hosts (`<slug>.gofarther.app` and its live custom domain),
  `requestSource: "eyeball"`, HTML answers only, at most 30 days; page views
  and visits per day and the top 10 pages. Cached 5 minutes. Token:
  `CF_ANALYTICS_TOKEN` if set (optional override, `-` fallback in
  `deploy.yml`), else the existing `CLOUDFLARE_API_TOKEN`. No token, a refused
  query (a token without Analytics Read) or a failure answers "unavailable: …".

## The error log

- **Table** `site_errors` (`supabase/proposed/site_errors.sql`): primary key
  (slug, fingerprint); `count`, `first_seen`, `last_seen`, `source`
  (browser|server), `route`, `kind`, `message`. RLS on, no policy, service role
  only. RPC `site_error_hit` upserts (count + 1) and, at 500 fingerprints a
  site, evicts the stalest. RPC `site_errors_prune` deletes rows unseen for 30
  days; the Worker's cron calls it once an hour. Until applied the RPCs answer
  404 and are ignored.
- **Scrubbing** (`builder/site-signals.mjs`): the explore tools' key/token
  redaction, then emails, phone numbers (7+ digits), query values and opaque
  runs of 32+ characters; 300 characters; the route is the path only.
  Fingerprint: sha256 of source, kind, route and the message with digits folded.
- **Server writers**: a data write or action through `/api/db/<slug>/data/`
  that fails with a 5xx or throws; an owner notification of a form submission
  that was not sent. Through `waitUntil`, never awaited; per isolate at most 60
  writes a site a minute and 8 in flight; drops, never queues.
- **Browser writer**: `POST /api/site-errors/<slug>` (public, listed in
  `test/api-auth.test.mjs`'s PUBLIC, now 7). Always 204, no cookie read or
  set; 4 KB cap; 10 a minute per site + IP; the slug must have a live pointer
  (`current/<slug>.json`, remembered 10 minutes); the write after the answer.
  The template's `reportSiteSignal` (in `lib/rows.ts`) sends kind, path and
  message with `credentials: "omit"`, at most 5 a page load, each once: from
  the existing error reporter (page errors, rejected promises, render errors)
  and from a failed form send (`useCreateRow`: status and code only, never the
  visitor's values). The existing `/api/db/<slug>/error` → site `_errors`
  reporter is unchanged.

## Evidence

- `test/site-signals.test.mjs` (14 cases): scrubbing, dedupe, the proposed
  SQL's cap / count / retention / grants, the recorder's bounds, the endpoint
  (stored scrubbed; made-up slug, oversize, bad path, wrong method), rate
  limit, never blocking (a hanging write), the writers' wiring, the hourly
  prune, the `site_errors` tool's fencing and lock, services and logins, the
  traffic query against a fake GraphQL endpoint (hosts, eyeball, 30 days,
  counts, cache, every "unavailable"), the browser reporter.
- Sweep: 16 mutants, 15 killed; the survivor is the Content-Length pre-check,
  redundant with `readJsonBody`'s own 4 KB cap (equivalent). The comment-only
  control survived.
- Full suite locally: 12,895 tests, 4 failed before the last fixes; after them
  the failing files pass. `test/container-room.test.mjs` fails in this worktree
  only (no `node_modules` of its own: ENOENT), before and after.
- **Container image rolls**: the Dockerfile copies the two new modules, and the
  template's `rows.ts` and `error-reporting.ts` changed (so did
  `builder/foundation-files.mjs`, regenerated). Predict the id before a merge.
