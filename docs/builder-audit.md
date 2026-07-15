# Builder Audit — 2026-07-15

Full review of the Builder page and its money path: generation/polling flow,
credits lifecycle, UI/price accuracy, and defensive robustness of the `/api/*`
endpoints it calls. Findings are deduped across reviewers and ranked. Status
key: 🔴 open · 🟡 in progress · ✅ fixed.

## Verified solid (coverage, so the list below is exceptions, not the whole picture)
- **Render output escaping** — chat messages, director replies, review cards,
  worker/fal error strings all render via `textContent`/`createTextNode`, and
  media via `createElement` + DOM `.src`; a stored non-URL value can't become an
  active link. No HTML-injection path found into the Builder.
- **Stripe minting** — raw-body HMAC (constant-time, rotation, ±300s, size cap);
  top-ups mint only on `checkout.session.completed`+paid, memberships only on
  `invoice.paid`; idempotent on `purchases.ref`; `add_credits`/`set_plan`/
  `refund_charge` are `service_role`-only (verified on the live DB).
- **Charge flow** — charge-after-fal-accepts, atomic `use_credits`, `cancelFal`
  on the balance race; fails closed for generations.
- **Most billing inputs are server-authoritative** — model allowlist, price
  tables, `num` (1–4), `duration`/`quality` bounds, and OmniHuman/LipSync audio
  length re-parsed from the file header. `/api/save` host-pinned to fal.media
  with magic-byte + size checks.

---

## HIGH

### H1 — A paused, still-rendering (paid) job is dropped when a new generation starts in the same chat
`public/chat.js` — `pauseGen` keeps the localStorage resume record but frees
`activeGens`, so the chat is immediately reusable; the next generation's
`jobRecord`/`endGen` rewrites records filtered by `chatId`, erasing the paused
job. After a 10-minute timeout ("the app will pick it back up automatically"),
a natural retry in the same chat makes the first render unrecoverable. **This is
part of why the earlier successful render never returned to the app.** Fix: key
resume records so a new run can't evict an unfinished one; block/redirect a
retry while a chat still has a live record.

### H2 — A charged render is orphaned if the submit response is lost
`public/chat.js` — the resume record is written only after the `/api/*` response
parses; the worker charges before returning. A dropped response (mobile blip)
lands in the generic `catch` ("Network hiccup — try again") with no record, no
status URL, and no refund path. Fix: client idempotency key recorded before the
request so a retry can't double-charge and the job can be recovered/refunded.

### H3 — `delete_account()` removes purchase records
Live DB — `purchases.user_id` cascades on `auth.users` delete, so account
deletion erases financial history, against the documented "purchases kept as a
record" rule. Fix: FK `ON DELETE SET NULL` (or archive before delete).

---

## MEDIUM

- ✅ **M1 — Ray + keyframes: quote ≠ charge.** FIXED — worker rate tier now
  follows the image-to-video endpoint (keyframes included); only the 5s force
  excludes keyframes. Quote and charge verified equal (✦300 both sides for
  1080p/10s). Also fixed the related **price-tag staleness**: attaching/removing
  a start image, first/last frame, reference, or keyframe now reprices the tag
  (previously only clips did), so Ray's tier switch can't leave a stale quote.
- **M2 — LipSync clip length trusted from the client.** `clipDuration` is used
  for billing without a server-side measure (the audio path next to it measures
  the real length). Add a server-side clip-length derive/floor.
- **M3 — `/api/direct` charges before it validates.** Empty prompt (400), hit
  research quota (429), and upstream failures (502) all occur after the debit
  with no refund. Move the charge after validation, or refund on 4xx/5xx.
- **M4 — `/api/video/poll` path is unconstrained.** Only the host is pinned; the
  path isn't limited to `/requests/<id>/status` like `/api/cancel` and
  `/api/refund`. Tighten to the same shape.
- **M5 — Refund path has no client-side claim gate.** Two tabs resuming the same
  record both call refund on failure; correctness rests entirely on the DB RPC
  being idempotent. **Action: confirm `refund_charge` consumes/flags the row.**
- **M6 — `useCredits` timeout-after-commit.** If the debit commits but the reply
  is lost, the job is cancelled but no `gen_charges` row exists, so it can't be
  refunded. Record intent before/with the debit.
- **M7 — Auto-mode composes against live mode/model.** Plan mode re-pins the
  composed mode before generating; Auto submits with whatever the composer shows
  now, so a mode/model flip mid-compose bills the wrong kind. Capture at compose.
- **M8 — `readClipMeta` has no stale-attach guard.** A late metadata callback
  from clip A can stamp its dims/duration onto clip B (peers `measureAttachedImage`
  and `normalizeClipFps` both guard). Add the same token/identity check.
- **M9 — `claimDelivery` is a non-atomic read-modify-write.** Two tabs finishing
  within milliseconds can both deliver+save one job. Best-effort, narrow window.
- **M10 — Documented `director` 300/day quota isn't in the code.** Per-call
  metering may supersede it; either restore it or correct the docs.

## LOW
- Cancel-during-submit of an already-started job returns silently with the job
  charged and still running (only "Cancelled" shown).
- Single-shot refund right after cancel can race fal's status transition.
- Plan-card approval bypasses send-time clip/audio validation (attachments
  swapped while the card sat go unvalidated → charge → 422 → auto-refund).
- `measureAttachedImage` writes `imgMeta` before its replaced-while-loading guard.
- Delivery claim is stamped before save completes; an exception after it can
  make every resume re-pause, abandoning a paid render after 4 tries.
- `jobsWrite` caps at 8 records — a 9th concurrent chat drops the oldest live one.
- `/api/cancel` has no ownership binding (needs the target UUID).
- Self-cancel-then-refund can leave fal billing us for an in-progress job.
- No Stripe `charge.refunded`/`dispute` handling (refunded buyer keeps credits +
  permanent paid status).
- `/api/billing/cancel` matches Stripe customers by email (weak join key).
- `invoice.paid` mints full credits even on a $0/discounted invoice.
- LipSync send-price shows the 10s-max quote and never re-quotes after the clip's
  real (shorter) duration resolves (billing itself is correct/lower).
- Unknown-`quality` default differs (worker → max tier, client → 720p); latent,
  not reachable in normal use.

## Hygiene / INFO
- Dead add-on RPCs from removed features remain (`set_orchestrator`,
  `set_video_editor`, `orchestrator_reserve`, `video_editor_gate/status`, and
  `orchestrator_plan`/`video_editor_plan`) — some anon-callable (mint-gated).
  Drop them.
- Broad default INSERT/UPDATE/DELETE grants to anon/authenticated sit on
  `gen_charges`/`storage_reservations`/`user_plan` (only RLS deny-all protects
  them today) — REVOKE for defense in depth.
- `use_quota` is count-then-insert without a lock (a burst can slightly exceed a
  daily cap).
- Supabase access+refresh tokens in localStorage (standard, but raises the stakes
  on the escaping discipline above).
- CLAUDE.md stale: `add_credits` is `service_role`-only now (not anon+auth), and
  the `director` quota claim (M10).

---

## Recommended fix order
1. **H1 + H2** — the render-loss pair (directly hit the owner this week).
2. **M1** — Ray+keyframes quote/charge mismatch (pure pricing, already scoped).
3. **M5** — confirm `refund_charge` idempotency on the live DB (verify, then note).
4. **H3** — the purchases-cascade FK (one-line, compliance).
5. Remaining MED (M2/M3/M4/M6–M9), then LOW/hygiene, one at a time.
