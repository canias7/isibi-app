# 2026-10-30 — Four checks on the site's own server code

Branch `claude/nifty-hamilton-m8dnzw` (from `claude/nice-ramanujan-9ry8wy`).
Not merged, not deployed. No paid run, no model call, no workflow dispatch.
Follows `2026-10-28-site-server-code.md`.

## 1. The dry run's `site` has `verify` (`f95a5622`)

The branch had added `site.verify` (constant-time HMAC with an owner's key) to
the real helper, but the dry run's fake `site` lacked it, so a webhook that
called it threw a TypeError and was reported as a **code fault** (and sent to
the repair round).

- `builder/server-dryrun-child.mjs`: the fake `site` gets `verify(name,
  payload, signature, { algo, encoding })` with the real one's semantics (the
  same HMAC, the signature trimmed, both sides hashed to one length and
  compared in constant time, hex or base64, SHA-1/256/512; false for a
  non-string payload, an empty signature or a bad key name). The secret is
  made up per key name (`test-secret-<NAME>`), since no owner's key exists in
  the sandbox. The sample request is unsigned, so a checking webhook takes its
  own "not signed" branch — the honest answer; a fixed `true` would walk an
  unsigned sample into the code that trusts it.
- `builder/server-code.mjs` `keysAsked`: `site.verify("NAME", …)` now counts
  NAME among the keys a part needs (the owner is told to add the webhook
  secret).
- Test: `test/server-code-checks.test.mjs` SC9. Red on the old child (the
  webhook's `ok` was false). Sweep `scripts/mutants/dryrun-verify.json`:
  9 of 9 killed, the comment-only control survived.

## 2. `site` is typed: `SiteHelper` (`d3ae280a`)

- `builder/lovable/template/src/lib/site-functions.ts`: `export type
  SiteHelper = Site` (`makeSite`'s return type — exactly what the route hands
  the code) and `declare global { type SiteHelper = Site }`. A server part
  writes `site: SiteHelper` and still imports nothing; the name is declared in
  the one file every site's program holds (`server.ts` imports it, and the
  Download's closure follows that import).
- The writer's required shape and chatbot example (`builder/page-gen.mjs`,
  the `server` field) and `SERVER_REPAIR_RULES` (`builder/server-code.mjs`)
  use `site: SiteHelper`. `tsc` stays non-blocking; its errors are now real.
- Test: `test/site-functions.test.mjs` SF-typed — the writer's own example
  (read out of the tool) and a webhook using every helper method typecheck
  clean in the template's program; six wrong calls (`site.fecth`,
  `site.sql(42)`, `site.key(5)`, `verify` with two arguments,
  `files.put("a", 1)`, `algo: "MD5"`) are type errors. Red on the old prompts.
  Sweep `scripts/mutants/site-helper-type.json`: 5 of 5 killed, control
  survived. `test/integration/kit-typecheck.mjs` 4 of 4.

## 3. Each server function asked through the built site (`91951377`)

- New `builder/server-bundle-check.mjs` (parent) and
  `builder/server-bundle-child.mjs` (child). After a good `vite build`,
  `build-server.mjs` asks each `server-<name>` part once through
  `dist/server/server.js` — the bundle the site will run, its real route and
  real `site` helper:
  - a visitor-callable function: one POST at `/api/db/<site>/fn/<name>`;
  - a `tick` hook: the clock's own request (`POST /__gf/tick`);
  - a `created:` / `updated:` / `deleted:<table>` hook: a visitor's write to
    that table through the site's own data route.
  A hook's failure is read where the site writes it, its own error log
  (`_errors`), here the fake database. `cron:` schedules are not asked (the
  first wake only starts their count); the dry run still runs them.
- **The same safety as the dry run, not the render check's server**: the
  render check's child (`render-server-child.mjs`) answers GET only with an
  empty env, so a separate child does this. No environment, Node's permission
  model (reads of the child and the bundle's folder only), the unprivileged
  user from root, a 30 s cap. Every network call is answered inside the child
  (`globalThis.fetch` replaced before the bundle loads): outside services get
  the dry run's plausible empty answer, the database (Neon's HTTP endpoint)
  answers no rows, the Data API answers the sample row. The owner's keys are
  made-up values; files live in memory.
- A 5xx or a throw is flagged; a 4xx is a sensible answer (an unsigned
  webhook's 400 is not a fault). A code mistake or a refusal by the real route
  (an answer over its size limit, a key withheld, an undeclared host) is
  `kind: "code"`; anything else `"input"` (may be our sample).
- `mergeBundleResults` folds them into the dry run's `serverTests`: a function
  the dry run passed but the built site failed takes that failure (`via:
  "bundle"`, its status, the error prefixed "through the built site:"); a
  dry-run failure stays. `serverTests.bundle` carries `{ ran, passed, failed }`
  or `{ ran: false, why }`. So the reply's evidence and the **one existing
  repair round** in `publishPages` read it unchanged. Never a refusal.
- Shipped in the image: both files added to the `Dockerfile`'s builder `COPY`.
- Tests: `test/server-bundle-check.test.mjs` SB1–SB5, on a bundle made from
  the template's own runtime (`site-functions.ts`, `site-row-hooks.ts` and
  what they import, transpiled, with vite's one change — the
  `import.meta.glob` of the parts — done by hand); and
  `test/integration/site-build.mjs` section `server-request` (shard 3): a
  **real `vite build`** through the real build service, 8 of 8 locally — the
  size-limit case is caught only through the built site, the tick and row
  hooks through its error log. Red: the module did not exist. Sweep
  `scripts/mutants/server-bundle-check.json`: 18 of 18 killed, control
  survived (NO TIMER first survived — a hung child kept the test file alive;
  SB3 now holds the child and races a 15 s limit, and it is killed).

## 4. The safety rules for server code (`79a9c1db`)

Short rules in both writers' text — the page writer's `server` field
(`builder/page-gen.mjs`, "KEEP IT SAFE") and the agent's `SERVER_PRACTICES`
(`builder/site-agent.mjs`): check the request body (400 when wrong); a
visitor's function can be called by anyone, so trust no client-sent id, role,
price or owner flag and check per visitor; a webhook acts only when
`site.verify` is true, refuses a timestamp over 5 minutes old and records each
event id so a replay does nothing; use only the tables and columns the
schema declares; `site.fetch` can fail or time out — check `r.ok`, catch it,
answer 502 with a clear message.

- Test: `test/site-functions.test.mjs` SF-safety, each rule read in each
  writer's own text. Red before. Sweep
  `scripts/mutants/server-safety-prompt.json`: 10 of 10 killed, control
  survived.

## The full suite

Full suite (`GF_OLD_LANES=1`, as `npm test`) on `222f0bca`: `12549 / 12542 / 4 / 3`
(tests / pass / fail / skipped). The four: the shallow clone's ancestry case
(red on the starting branch too), and three tree scans (`isibi_slug` ×2, the
`node_modules` ignore case) that trip on this worktree's `node_modules`
symlink; run without it, their files pass. Two guards moved with this work and
were updated in `222f0bca`: the pinned page-writer requests (only the `server`
field's two descriptions differ, checked key by key) and the closure block's
window in `kit-closure`.
