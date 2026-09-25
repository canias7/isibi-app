# Edit-path review milestone

Base: main 38fe281d. Branch: codex/edit-path-milestone. Product correction:
37b03f01 plus the final missing-connection guard. No merge, deployment, paid request, customer-data change or demo repair.
The escalation and fallback-display corrections remain closed. Translation,
video hosting and model-written customer replies remain parked.

## Judgment

The bounded corrections are ready for independent review once required CI is
green. The edit journey has substantial deterministic evidence, but is **not
proven ready for unrestricted, unattended edits with universal preservation**.
One known preservation defect remains outside the present inventory; real model
compliance and this candidate's live model/compiler/publication chain are also
unverified. These are different categories, not interchangeable excuses.

## Actual paths and coverage

The router exposes data, text, look, page, rules, picture, logo, nav and rename.
The look picker has 21 fields: ten own fields (css, theme, brand, description,
wordmark, favicon, lang, langs, behavior, qr); purpose/components/shape/three/tsx
→ page, images → picture, action → nav, backend → rules, slug → rename;
pages uses add/remove/move verbs; kind requests reconstruction. No lane is
currently marked unbuilt. Historical comments saying slug is unimplemented are
stale: the exported map dispatches it to rename. Translation fields were only
mapped, not changed.

| Capability | Execution and established evidence | Boundary / remaining evidence |
| --- | --- | --- |
| Message, attachments, routing | siteSend → siteRoute → /api/site/route; names-only site/page/table digest, selected model, attached flag. site-ask and new browser test verify logo bytes reach logo edit and disappear from the next message. | Router receives an attachment flag, not its pixels. Only logo edit forwards attachments; arbitrary screenshot/PDF-driven page edits are not an implemented edit input path. Real routing accuracy is not proved by tool fixtures. |
| Visual/style | look picker → own fields → config → one compile/publication; page-specific changes can use tweak. edit-path checks stored values and compiler payloads; page-look/tweak controls remain in CI. | CSS source or successful compilation alone does not prove visual intent. |
| Wording | text writer receives existing pages/components; merges replacements and preserves untouched component files. edit-page-context and edit-failure drive real route and reply composer. | Large wording asks may escalate; semantic accuracy still depends on model output. |
| Layout/order | page uses quick tweak first where applicable, then full page writer; page-keep and page-protect distinguish intentional movement/removal from collateral link/component/photo loss. | Plain-text-only section loss is not covered by the current inventory; see decision below. |
| Custom components and behavior | Full writer gets current component source, look and relevant kit API; returned parts merge with untouched neighbors. edit-page-context demonstrates failed tweak → writer, compiler receives changed A and unchanged B, same bytes stored; the parent page is unchanged in the component-only control. Stored TSX rendered with React and inspected in a local browser: new hours visible, neighbor unchanged. | Supplied TSX proves plumbing and that output's rendering, not that a real model will author correct behavior. Oversized/unreadable components are withheld rather than overwritten blind. |
| Pictures/assets | picture edits existing page or component images; placement can hop to page; logo consumes attachment; existing photo preservation and removal controls run. | General attached-image replacement outside logo is unsupported on edit. Real provider selection/quality unverified here; no image generation bought. |
| Page operations | pages remove/move → page; add → addon, distinct from build. edit-path inspects actual compiled route names and retained home page. Browser removes deleted pages from picker. | New page content quality requires live model evidence. Full site kind change remains explicit reconstruction, not an edit writer. |
| Backend rows and rules | data → existing database/schema; rules → existing policies/schema; no database can hand off to text or addon as appropriate. edit-rules-backend and edit-failure exercise none/ready/incomplete/unreadable states; page-rpc-state verifies writer context. | No real database mutations. Loading/error/empty/invalid/zero states are rendered for a supplied implementation; recorded bad model output still demonstrates why prompt presence is not behavioral proof. |
| Mixed requests | merged page steps compile once; second step sees first step's changes; successful and refused steps compose a partial result and charge only ledger-recorded amounts. edit-page-once, edit-path, edit-failure. | Multi-step backend effects are not universally atomic with page publication. Do not promise whole-request rollback or no changes. |
| Queues, retries, handoffs | Direct and stored replies use same readers. Existing duplicate press, idempotency, unreadable/lost-response, next-message and ownership controls retained. New tests preserve hop marker through queue and reload; second escalation follows existing bound instead of buying another sideways edit. | Existing policy after one sideways hop can request reconstruction; this patch bounds it, not a redesign of escalation policy. No new live queue run. |
| Compile, publish, stored state | Real route fixtures capture compiler payload and storage. publish-integrity executes activation failure, conditional rollback, lease ownership and recovery; reserve-refused executes billing refusal before compile. Required site-build CI uses real TypeScript/Vite and browser runtime fixtures. | Echo compiler in route tests is not a compiler. CI reference pages are not a real model-produced edit on this deployment. Lost upload responses can need reconciliation; no blanket refund/success assertion. |
| Preview, billing, reply | Preview/state mutation precedes credit scheduling; truthful success/refusal survives redraw errors; next message and newer request controls pass. Outer routing cost is separate; pick-lane usage deduplicates across rungs; reservation/collection failure stops publication. | Billing tests stub the ledger protocol, not a fresh production-ledger proof. The synchronous scheduler exception is distinct from an ordinary later credit-fetch network failure. |

## Reproduced defects and bounded corrections

| Before | After and evidence |
| --- | --- |
| Queued sideways handoff forgot handedOff, permitting another sideways operation unlike direct response. Reload lost it too. | Persist a strict boolean in the job record and pass it to the shared reader. edit-lock covers direct control, queued second escalation, reload, busy/lock ownership and next message. |
| Queued edit/addon refusal redraw escaped an unhandled rejection after the outcome was recorded. | Guard the terminal finish at the watcher boundary. Both refusal cases keep one sentence, release and accept the next message. This is an escaped display error, not failed publication. |
| Synchronous credit-scheduling error prevented preview invalidation after known success. | Apply published browser state first. Both edit/addon tests assert preview version increments and next message works. Existing double-display and ordinary-success redraw controls remain. |
| Terminal job credit scheduling could throw before finish and strand the browser request. | Contain scheduling failure and still report terminal outcome. Removing the guard makes the focused regression fail with the credit-refresh exception; restored guard passes with redraw failure too. |
| Missing source plus unreadable config still authorized full rewrite on EDIT (the closed ADDON fix did not cover it). Recovery outcome could be discarded. | Edit opts into checked recovery/strict source loading. Before no-source reconstruction, read remaining backend/config/parts/schema. Real-route cases cover config read/malformed data, backend read after ownership, recorded database without a usable connection, malformed source, parts read and failed recovery (throw and returned false). No model/debit/compile/rewrite on stops. Normal absent-source reconstruction remains a control. |

Recovery failures do not promise nothing changed: recovery may have written
state. Routing may already have cost credits. The added refusal explicitly
stops reconstruction without claiming the whole customer request was free.

## Evidence and validation

- 449 focused tests passed: edit-lock, edit-result-display, edit-poll,
  addon-failure, edit-failure, edit-page-context, edit-page-once,
  edit-page-protect, edit-page-keep, edit-page-rpc-state, edit-path,
  addon-queue and site-busy.
- 18 targeted publication/billing cases passed (reserve-refused and
  publish-integrity); 15 routing/input/logo cases passed.
- Local browser at 127.0.0.1 displayed real React-rendered stored output from
  the actual route fixture: “Nine until six, Tuesday to Saturday” and unchanged
  “Eleven Bridge Street, by the weir.” This is isolated rendered component
  markup, not the complete deployed template or interactive backend behavior.
- Initial CI on 37b03f01 found two obsolete source-shape guards (watcher
  argument list and bare source-read census). Updated them to require the new
  marker and checked reader, retaining the repairing-reader property.
- Some older source-scan tests assume LF and some navigation corpus tests use
  URL.pathname as a filesystem path (C:/C:/ on Windows). Those local harness
  failures are not product evidence. Required Linux CI covers those unchanged
  cases; only harness reads needed for this milestone were normalized.
- Required unit CI runs on the final candidate; site-build CI runs on c505d646,
  whose product/image inputs are identical to the final test/document-only commit. The earlier site-build run was
  superseded after a regression exposed a recorded database with no resolvable
  connection bypassing schema validation. That one-condition guard and its test
  are included. Results and run links are recorded in the delivery report.
  No repeated deployment checks.

## Known defect requiring a separate preservation decision

The existing edit-page-keep test “OPEN, AND OUTSIDE THE INVENTORY” supplies a
writer answer that drops the unrelated Opening hours section. It publishes and
reports success. This is a reproduced product limitation, NOT just a missing
live test. The present inventory identifies links and custom component use,
not every arbitrary JSX text section. Other explicit limit tests show a model
judge can misread “keep” or “except” even when its quote genuinely occurs.

A blanket text-difference refusal would break legitimate wording changes and
section rewrites; heading equality alone would confuse renaming with deletion.
A reliable extension needs a section/content identity and authorization design
across movement, rewording and deletion. That is broader than a bounded patch to
the existing inventory. Proposed decision: add explicit section-level ownership
and preservation contracts before claiming arbitrary full-writer edits preserve
all unrelated content. No architectural rewrite or new capability was started.

Unsupported/parked: general attachment-reference page editing; retired GIF
editing; translation, video hosting and model-written replies. Unverified:
real model adherence, live visual/interactive correctness and live billing of
these edits. Ordinary missing live observations are not labeled product defects.

## Smallest useful live evidence plan — prepared, NOT dispatched

Use an owner-approved disposable clone with a known availability component,
existing bookings_on_day integer API, Opening hours and map sections. Snapshot
pages, parts, config, rendered output and balance first. No new schema/API or
permissions. Keep requests on the same chosen model. Estimates are rough
planning allowances from recorded ~3-credit tweak/~10-credit writer behavior,
plus routing; not fixed prices, spend authorization or a retry budget.

1. “In the availability card, show ‘Checking…’ while loading and ‘Unavailable’
   for an error or a non-integer/negative answer. Zero bookings must still show
   six places. Keep the day picker working and leave Opening hours, the map,
   their links and all other components unchanged.” Estimate 10–20 credits.
   Accept: actual writer receives existing source/API schema; queued completion
   publishes one intended component change; neighbors match snapshots; exercise
   day selection and loading/error/zero/invalid responses in a local replay of
   the actual generated component; reply matches the published outcome and
   ledger delta equals routing plus edit charge.
2. “Move Opening hours above the map. Keep every word, link, form, picture and
   component behavior unchanged.” Estimate 3–6 credits. Accept: correct order
   visibly rendered, all content/actions retained, quick tweak succeeds or one
   justified full-writer fallback occurs, no duplicate publication/charge,
   second customer message finishes normally after request 1.

Total estimate 13–26 credits, potentially higher for model/context/correction
usage. Neither is free. Existing deterministic failure/retry checks can run
free and need no paid failure replay. Stop on an unexpected outcome; no automatic
paid retry. These two observations would add model and live-chain evidence, not
prove universal preservation or erase the known inventory limitation.
