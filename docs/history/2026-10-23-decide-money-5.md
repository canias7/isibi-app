# 2026-10-23 — decide-money-5: a reused request key is answered from the kept answer (A13-1, #125)

Branch `decide-money-5`, from `origin/main` `a8fbfe876`. Offline only: nothing
paid, no model call, no live write. Not merged or deployed.

## The finding

Audit A13-1 (`docs/audits/2026-10-17-builder-audit.md`; options in
`docs/history/2026-10-23-r1-g2.md`): a site's message sent with its key
(`idem`) is charged under `route:<slug>:<key>` through `credit_debit`, and a
repeat of that ref takes nothing. Only accepted edits and additions were
answered without a model. A conversation, a question back, or any other
unaccepted outcome sent again under the same key asked the router (and the
conversation model, and the reply writer) again, for free.

## The owner's choice (1), as built

`worker.js`, `/api/site/route`:

- **Kept**: when a key applies (`rKey`'s own conditions: not a part's routing
  job, REQUEST_FLOW and EDIT_ASYNC on for this owner and site, a site that
  exists, a well-formed key), a model answered (`routed.usage`), the outcome is
  not a failure and was not accepted as a request, the answer **as served**
  (after `withModelReply`, so with its reply text) is written to
  `SITE_API_CACHE` under `route-answer:<slug>:<key>`, with the account, a
  SHA-256 digest of `[uid, slug, message, ask]`, the time, the status and the
  exact body. Expiry: `ROUTE_ANSWER_TTL_S` = 86,400 s, as KV's
  `expirationTtl` and checked again on read.
- **Replayed**: before the balance read, any model and the reply writer, the
  same account with the same key and the same digest is answered with the kept
  body byte for byte and its status. No model call, no debit.
- **Same key, other words** (same account, digest differs): refused 409
  `key-reused`, `cost: 0`, no model call — as `site-idem.mjs` treats a key
  whose body digest differs as no replay.
- **Unreadable** (KV throws, or a record of the wrong shape): no answer; the
  route runs exactly as before. **No KV binding**: nothing is read or kept,
  and no extra await is added (the request-flow fixture has no KV, and its I2
  case's call-order stub depends on the timing).
- Accepted requests keep their own duplicate path (`loadRequest`), unchanged.
- The ledger ref, the request body sent to the router and the canary's reader
  are unchanged.

## Limits (kept, not widened)

- KV is eventually consistent: a repeat that reaches another location within
  about a minute can miss the kept answer and run as before (the ledger still
  takes nothing twice). Two tabs at once both route, as today.
- A replayed `clarify` hands back the question as first asked; if another
  message closed it since, answering it is refused as stale at no cost.
- Another account under the same slug and key is not replayed and runs as
  before; `credit_debit`'s repeat lookup is still not scoped to the uid
  (the audit's other suggestion, separate).
- The 409 `key-reused` reply relies on the page showing `msg`; the page mints
  a key per message, so it should not arise from the page.

## Tests

`test/route-answer-replay.test.mjs` (3 cases, the real Worker over
`test/fixtures/request-flow.mjs` with a KV stand-in):

1. same key + same message → one routing call, one `route` ledger row (-1),
   no money moved by the repeat, identical bodies, one KV write with
   `expirationTtl` 86,400;
2. same key + different message → not the kept body, 409 `key-reused`,
   cost 0, still one routing call;
3. unreadable store (KV throws) and a garbled record → the normal call runs
   and charges.

**Red check** on `a8fbfe876`'s `worker.js`: cases 1 and 2 fail, case 3 passes
(it guards today's behaviour). **Sweep** (restored from a saved copy each
time): 5 of 5 killed — digest check forced true, store skipped, body-type
validation removed, expiry removed, replay disabled; the comment-only control
survived. (The validation mutant first survived: the garbled record failed on
its uid as well; the case now carries the right uid so only the body type
stops it.)

Affected files green: `request-flow`, `route-*`, `router-*`,
`live-clarify-*` (pinned hashes unchanged), `conversation-route`,
`model-replies-routes`, `held-route-scope`, `ask-router-display`,
`site-route-failure`, `canary-route`, `credit-debit`, `site-idem*`,
`acceptance-spend-bound`: 474 / 474 / 0. Also `container-runtime`,
`site-apis`, `brand-rename`, `media-deleted`, `deploy-secrets`,
`merge-triggers`: 112 / 112 / 0. A full-suite run here hit the 590 s limit
before finishing; of what ran, the only failures were the node_modules-ignore
case (the linked `node_modules`, removed before commit) and
`draft-blocked-card`'s SB1, which passes alone on both the old and new code.
