# Audit: site mail, texts and webhooks (2026-10-22)

Findings A12-1, A12-2 and A12-4 from `docs/audits/2026-10-17-builder-audit.md`
(A30-1 and A30-3 are the same problems), on the owner's word. One commit each,
on `worktree-agent-abfeb229d73e7a1ba`. Offline: no paid call, no real email,
text or webhook sent, no deploy, no push to `main`. Every sender is still the
owner's own key from the site's Secrets; `env.EMAIL` is untouched.

Each finding was re-read against the current code first, and each still stood.

## Step 1 — one shared row step (A12-1, A30-3)

- **Finding, confirmed.** The owner's email, the confirmation, the text and the
  webhook were called only inside `proxySiteService`. An order is inserted by
  `handleCheckout` and marked paid by `/api/stripe/site/<slug>`, neither of
  which passes through the proxy, so a shop's declared receipt and webhook
  never fired. A booking made through a function (`data/rpc/<fn>`) reads its
  table as `rpc` and fired nothing either.
- **Fix.** New `site-row-effects.mjs` `runRowEffects(deps, {def, action, row,
  submission})`; `worker.js` `siteRowEffects` hands it the four senders and is
  now their only caller. Called by:
  - the proxy, for every 2xx write (`created`/`updated`/`deleted`; a POST is a
    submission);
  - `handleCheckout`, after its INSERT: `created` for the webhook only — the
    order is pending and the customer may never pay;
  - the Stripe paid flip, now `UPDATE … RETURNING *`: the stored row,
    `updated`, as a submission (owner email, receipt, text). A repeated event
    returns no row, so nothing fires twice.
- **Remaining (backlog).** A function declares no table it writes, so a row a
  function inserts still runs no side effect. The design prompt's capacity
  paragraph and the `confirm`/`sms`/`webhooks` tool text now say so;
  `tableParts` claims no confirm, sms or webhooks on a `write: "none"` table
  (and claims `notify` on a card-paid one); `PART_SAYS` says a paid table's
  email and receipt come when the order is paid.
- **Tests.** `test/site-row-effects.test.mjs` (7). Four spelling guards
  retargeted to the shared step (`notify-wiring` ×2, `site-features-reachable`,
  `site-idem`). Red check on the code before: 4 of 7 fail (the 3 that pass test
  the new module alone).

## Step 2 — the new row's id (A12-2, A30-1)

- **Finding, confirmed.** The kit's insert asks for nothing back (a collect
  table has no SELECT), so PostgREST answers 201 empty and the senders got the
  visitor's fields, never `id`. `confirm:{fn}` and `sms:{fn}` refused every time
  ("no row id to build from"); a webhook's `data` had no id. A function-form
  body went to the provider as raw HTML.
- **Fix.** `resolveCreatedRow`: the upstream answer when it carries an id,
  otherwise the stored row read on the OWNER connection (`storedRowQuery`:
  `SELECT * … WHERE <every declared scalar column sent> ORDER BY id DESC LIMIT
  1`), otherwise what was sent. `Prefer: return=headers-only` was not used: its
  Location header needs SELECT on the key under RLS, which would refuse the
  insert. Limit, stated: two identical submissions in the same instant both
  resolve to the newer row. `sanitizeMailHtml` keeps text and bare formatting
  tags (no attributes, links, images, scripts or styles); `sendConfirmation`
  applies it to the function form's body.
- **Tests.** `test/site-row-id.test.mjs` (6): the empty-201 flow through
  `resolveCreatedRow` into `sendConfirmation`, `sendSms` and the webhook step,
  the SQL's column filter, the fallbacks, the proxy's wiring, the sanitiser.
  `test/site-mail.test.mjs`'s function case now takes its row from that flow
  instead of a hand-made `{id: 42}`. Red check: the file fails to load on the
  previous step; with the new module, the wiring and sanitising cases fail.

## Step 3 — email setup lives in Secrets (A12-4)

- **Finding, confirmed.** `siteEmails` said "name it e.g. RESEND_KEY", "wires
  the send as an edge function", promised welcome emails on signup and order
  receipts, and never named EMAIL_FROM, which every sender requires. A job with
  a key and no EMAIL_FROM reported "no email provider key in Secrets".
- **First fix** (`52d065bd`): the panel rewritten as a checklist like Payments.
  **Superseded the same day by the owner**: "all the keys go into the secrets,
  so you can delete the emails box".
- **Fix as it stands** (`93f0db0b`). The Emails card, its `data-cloud` opener,
  its Off note and `siteEmails` are removed (and the now-unused `auxLive`). The
  Secrets panel shows one email line above the list, from the listing's NAMES
  only (`mailLine`): the exact names `RESEND_KEY`, `SENDGRID_KEY` or
  `POSTMARK_KEY`, and `EMAIL_FROM` on a domain verified with that provider;
  "Email is set up" when both are there, a warning naming the missing half
  otherwise. The job's `credentials` answers `{missing: "EMAIL_FROM"}` and
  `runJob` reports "no EMAIL_FROM in Secrets (the address your site sends
  from)" (kept from the first fix).
- **Screenshots** (headless Chromium, the real panel code and `styles.css`):
  `emails-panel.png` (the Secrets panel, a Stripe key and RESEND_KEY, no
  EMAIL_FROM), `secrets-email-ready.png`, `secrets-email-empty.png`, in the
  session scratchpad.
- **Tests.** `test/secrets-email.test.mjs` (5): the card and its promises
  gone, the names, the three states, the panel's wiring, the job reason.
  `site-share.test.mjs`'s window end re-anchored to `sitePayments`. Red: the
  landmarks do not exist before.

## Sweep and suite

- **Image.** `Dockerfile`'s worker tree now carries `site-row-effects.mjs`
  (`dockerfile.test.mjs` caught it). The container image's inputs change, so
  the next deploy rolls the image.
- **Sweep.** `scripts/mutants/audit-mail.json`: 15 of 15 killed, the
  comment-only control survived.
- **Full suite** (`node --test "test/*.test.mjs"`, before the Dockerfile fix):
  `11651 / 11644 / 4 / 3`. One was the Dockerfile (fixed, 21/21 after). The
  other three are not this change: `container-room` needed `node_modules`
  linked into the worktree (passes once linked); `media-verify`'s browser mode
  fails on the base commit too (PUT /api/site/account-state from the page);
  `request-flow-page` failed under load and passes alone.
