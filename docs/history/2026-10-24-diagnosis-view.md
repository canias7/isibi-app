# 2026-10-24 — the owner's diagnosis view (branch `diagnosis-view`)

From `origin/main` `b47258f75`. Not merged, not deployed. Nothing spent.

## What changed

`worker.js` gains `GET /api/site/diagnoses?slug=<slug>`:

- Sign-in required (`authUser`, 401 otherwise); slug cleaned as the answer
  route does (400 when empty).
- Ownership as the other owner reads (`/api/site/answer`, `/api/site/source`):
  `siteOwnerBySlug(slug) === au.id`, else 404 (a 403 would tell a stranger the
  slug is taken). A non-owner causes no jobs read and no R2 read.
- One `edit_jobs` read: `select=id,op,created_at,state`, scoped to
  `uid=eq.<caller>` and `slug=eq.<slug>`, `state=in.(failed,lost)`,
  `order=created_at.desc`, `limit=20`. 502 if unreadable.
- For each row, `SITES_BUCKET.get(diagnosisKey(id))` (`jobs/<id>.diagnosis.json`,
  the key `builder/diagnose.mjs` writes). Absent or unparsable is
  `diagnosis: null`.
- Answer: `{ ok, slug, jobs: [{ id, op, created_at, state, diagnosis }] }`.
  Only those five fields are returned; nothing else from the row.
- No model call, no ledger or credit call, no write.

## Tests

`test/diagnosis-view.test.mjs`, 4 cases through the real route (stubbed
GoTrue and Supabase, in-memory bucket that refuses writes): owner reads both
jobs in order with a diagnosis and a null, and the query's scope; another
user's site 404 with no jobs or bucket read; unclaimed slug 404, signed out
401, no slug 400; an unparsable diagnosis is null. Every path's outgoing calls
are checked for no rpc/credit/ledger/model host, with a live-observer check.

## Sweep

10 mutants, 10 killed: owner check removed; owner check presence-only; uid
scope dropped; slug scope dropped; ascending order; limit 50; `select=*`;
wrong R2 key; parse error not caught; auth check removed. The comment-only
control survived.

## Full suite

`node --test "test/*.test.mjs"` in the worktree: `12739 / 12734 / 2 / 3`
(total / pass / fail / skipped). The two failures
(`canary-reopen-browser` REOPEN 1, `no-generated-deps` node_modules symlink)
fail identically with `main`'s `worker.js` in this worktree: environment only.
