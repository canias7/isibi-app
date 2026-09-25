# Add-on escalation: investigation and proposed correction

Implementation follow-up: see [the bounded correction](addon-escalation-correction.md).
This investigation and its standalone probe describe the **5afd5a0 baseline**;
the probe's old escalation assertions are historical, not post-fix acceptance tests.

2026-09-25 UTC. Product examined: `5afd5a0fe51e2d5f9bb6480c649cd857e2c20668`.
Branch base: `56df634c5725888e18c680313b91bb79af286fdb` (documentation only
after that product commit). Deployment 2155 is already independently verified;
this investigation neither merges nor deploys it again.

**Finding:** an explicit server escalation is not necessarily evidence that a
rewrite can resolve the condition. The add-on mixes missing prerequisites,
failed reads, unusable answers and no-ops under the same escalation contract.
Only verified missing source/design is a legitimate reconstruction case;
the picture handoff is legitimate but is not a full rewrite.

## Reason-by-reason decision

The current route emits `HTTP 200 {ok:false, escalate:true, reason, cost:0}`.
With no `layer`, the browser calls its full-rewrite fallback if it still has
the original instruction. The route's `cost:0` does not mean that the subsequent
rewrite is free. [Server exits][exits], [browser interpretation][client].

| Reason | Exact condition currently producing it | Can a rewrite resolve it? | Smallest proposed correction |
|---|---|---|---|
| `empty` | Trimmed instruction is empty. | No request to perform. The browser's missing-ask guard already prevents a rewrite; this is a wire escalation, not a demonstrated customer rewrite. | Preserve the no-ask stop; no diagnostic-contract change is needed for this correction. |
| `unconfigured` | `modelKeyMissing(env, modelsFor(picker).quick)`. | **No.** All current pickers use the same model for quick/design/pages. The rewrite cannot supply the missing provider key; it also requires an Anthropic key at entry. | Ordinary refusal with a platform-availability explanation. |
| `no-source`: truly absent | `loadSiteSourceForEdit` returns null for a missing object or stored empty array. | **Yes, reconstruction is supported**, conditional on readable remaining state and configured services. The rewrite generates pages from the brief/design with no prior-source block. It cannot restore exact lost source bytes. | Preserve escalation only when a successful, shape-valid read proves absence. |
| `no-source`: unreadable | The same wrapper returns null after a get/parse failure. A non-array JSON value is also normalized to an empty array. | **No repair.** Rewrite reads the same store and can generate without its old-page anchor. A transient recovery would be an incidental retry, not evidence a full rewrite was necessary. | Stop on failed/invalid reads. Preserve read status across the repairing source read; do not infer absence from null or parse success alone. |
| `no-meta`: truly absent design | After readable config/schema lookup, there is no usable `aLook`. A completely missing config on a frontend-only site demonstrates this. | **Yes, reconstruction is supported** when design and stylesheet really were never stored. Rewrite has a designer, merges its new design, and generates pages. This is capability traced in code, not a successful live reconstruction trial. | Retain only this verified legacy reconstruction case. A missing R2 config is not enough: first finish the legacy fallback successfully. |
| `no-meta`: existing CSS, missing look | Config is readable and has CSS, but `lookWithMarks` returns no look; `!aLook` still escalates. | Rewrite understands CSS-only sites as edits, but **does not add a capability missing from the add-on's page writer**. The design is not absent. | Stop for this narrow correction; do not call this a legacy/no-design rebuild. Making the add-on accept a thin look from CSS is a separate eligibility change, not proposed here. |
| `no-meta`: unreadable/inconsistent | Config get/parse/legacy read fails; schema/catalog parse/query fails; permission recovery fails; live tables cannot be safely reconciled. A malformed look field can also normalize to null. | **No safe repair.** Rewrite uses the same config/database, lacks the add-on's verified schema reconciliation, and catches some read failures while continuing without stored anchors. It may overwrite rather than repair. | Separate config/schema/read/recovery failures from verified absence, and return a refusal. Never label a malformed stored value as absent. |
| `no-add` | `pickAdds` did not throw but returned zero admitted kinds. `readAdds` maps missing tool data, invalid kinds and deliberate `kinds:[]` to the same list. | **Not established.** Another design call might produce something, but this response contains no affirmative classification that the request needs a broader operation. | Stop with a specific unable-to-determine-addition message. Do not buy a rewrite to compensate for an unusable classifier answer. |
| `nothing-returned` | After page validation/filtering, merge has no usable returned page and no removal. Existing model-note and unseen-page refusals have already been handled. | **Not established.** The same selected model writes the rewrite's pages. A new attempt may differ, but there is no demonstrated limitation of the add-on that rewriting every page resolves. | Refuse with a deterministic no-usable-page-change message. Keep existing explained refusals. |
| `no-change` | No added, changed or removed page remains; for example the writer returns byte-identical source. The `kept` branch is handled separately. | **No identified capability gap.** An unchanged answer does not establish that the feature exists, that it is impossible, or that all pages need rewriting. | Stop and report that no page changes were produced. |
| `too-many` | Merge helper receives more than `MAX_RETURNED` (six) usable pages. | **Not reachable in this route today:** `validatePages` caps the list to `MAX_PAGES` (also six) first. Rewrite uses the same validator, so it does not remove this ceiling. | Classify as stop if ever reached; no new feature/limit change. Do not report it as a reproduced route escalation. |
| `layer` | The sole picked kind has an `addLayerIn` target: `photo` goes to `picture`. | **Yes, a cheaper operation resolves the dispatch mismatch.** It is an edit handoff, not this full-rewrite path. | Preserve the handoff and original instruction. |

`kept` is not a full-rewrite trigger: `mergeAddonPages` supplies a refusal
message and the route returns 422 before the generic escalation. Backend lookup
unreadability already returns a 503 refusal. Model transport failures also
already return refusals. Preserve these controls.

## Traces into the rewrite

- [Repairing source read][source]: `ensureEditableState` then `loadSiteSource`
  collapses empty and failed reads. The rewrite passes that same loader's answer
  as `priorPages` at [worker.js:15949][anchor].
  [`priorPagesBlock`][prompt] returns an empty string without source; with source
  it tells the model to return every page again. This explains both genuine
  reconstruction and the risk of treating unreadability as absence.
- [Rewrite model selection][models]: `modelsFor(body.picker)` selects the design
  and page models. The current `BUILD_MODELS` quick/design/pages values match
  for every picker; the probe asserts this. [Entry gates][gates] reject missing
  platform configuration. Escalating cannot configure a missing key.
- [Rewrite edit-state read][state] reads config and stored schema, catches failure
  and can leave `editState=null`. Its `stored || storedCss` condition explicitly
  accepts a CSS-only site. The later [look read][look] similarly catches a failed
  config read before `mergeLook(priorLook, designed, ...)`. Failure to read is
  therefore not a restorative rewrite mode.
- [Add-on schema reader][schema] distinguishes empty catalog, missing metadata,
  recoverable tables and unreadable/unrecoverable state. The surrounding
  [metadata catch][meta] loses those distinctions by emitting `no-meta`.
  The rewrite's [schema union][union] uses `loadSiteSchema`, not this verified
  recovery procedure. No schema metadata plus a catalog with no application
  tables is genuinely empty and can proceed through the add-on normally.
- [Merge exits][merge], [picker reader][picker] and [validator ceiling][validator]
  provide the remaining conditions. They do not carry a positive decision to
  perform a full-site rewrite.

## Focused reproductions

Run from the repository root after `npm ci --ignore-scripts --no-audit --no-fund`:

```sh
node docs/investigations/addon-escalation-probe.mjs
```

**24 actual-route cases passed their current-behavior assertions: 19 rewrite
callback invocations, 1 picture handoff, 2 stops and 2 successes.** Cases cover:

- Source absent, empty, persistently unreadable, transiently unreadable,
  invalid JSON and invalid non-array shape.
- Config unreadable, invalid JSON, absent, CSS-only, and malformed look;
  schema query failure and invalid schema JSON.
- Empty and invalid picker kinds; zero pages, invalid pages, and unchanged pages.
- Controls: empty original ask stops; backend read failure stops; picture hands
  off; a normal addition succeeds; genuinely empty schema accepts its first table.
- Helper assertions: seven pages trip the merge bound, validation reduces them
  to six before merge, absent source omits the prior-source block, present source
  supplies it, and all current pickers share quick/design/pages model identities.

The probe executes the **real server route** with the repository's fake-service
fixture, then runs the real `readRouteReply`, `readAddonReply` and `addonAnswer`
on each response. Terminal actions are counted, not sent. A setup seam is added
to the fixture **in memory**, never to product source. The fixture answers all
network requests and a fail-closed fetch guard forbids escape. No credentials,
live models, paid requests or real publishes are used. The helper assertions and
rewrite trace establish capability/limits; **no successful real-model rewrite
or new customer incident is claimed**.

The unchanged `test/addon-failure.test.mjs` previously passed **87/87** during
this investigation, including direct and queued handoff/rewrite behavior.
This new probe drives synchronous route responses into their common result
handler; it does not claim to drive the queue consumer. The initial Windows
test-harness load failed on checkout CRLF; supplying the committed LF browser
bytes let the unchanged tests pass. Those temporary file conversions were restored.

## Smallest proposed correction — not implemented

1. Classify at the existing server exit sites. Use ordinary `ok:false` refusals
   with deterministic messages for configuration, read/recovery, classifier,
   empty-output and no-op failures. The client already stops on that shape.
2. Keep only verified missing source and genuinely absent design as full-rewrite
   candidates. Carry repairing-source readability and validate stored shapes;
   keep legacy config fallback and catalog-backed schema recovery. Do not widen
   CSS-only add-on eligibility or refactor unrelated readers in this correction.
3. Preserve `photo -> picture`, genuinely empty schemas, successful additions,
   and the existing explicit refusals. Unknown reasons should stop. Focused tests
   should connect the actual server response to direct/queued client behavior;
   update old assertions that currently call an `escalate:true` response a stop.

Messages should state the known result, not promise that nothing changed on
every path: a first database can be provisioned before page generation even
though schema application is deferred. No provisioning/rollback redesign is
included. No product correction has been implemented; translation and
model-written replies remain parked. This commit contains findings and a
reproducer only, for independent review.

[exits]: https://github.com/canias7/isibi-app/blob/5afd5a0fe51e2d5f9bb6480c649cd857e2c20668/worker.js#L24854
[client]: https://github.com/canias7/isibi-app/blob/5afd5a0fe51e2d5f9bb6480c649cd857e2c20668/public/chat.js#L9977
[source]: https://github.com/canias7/isibi-app/blob/5afd5a0fe51e2d5f9bb6480c649cd857e2c20668/worker.js#L8300
[anchor]: https://github.com/canias7/isibi-app/blob/5afd5a0fe51e2d5f9bb6480c649cd857e2c20668/worker.js#L15949
[prompt]: https://github.com/canias7/isibi-app/blob/5afd5a0fe51e2d5f9bb6480c649cd857e2c20668/builder/page-gen.mjs#L2767
[models]: https://github.com/canias7/isibi-app/blob/5afd5a0fe51e2d5f9bb6480c649cd857e2c20668/worker.js#L14533
[gates]: https://github.com/canias7/isibi-app/blob/5afd5a0fe51e2d5f9bb6480c649cd857e2c20668/worker.js#L14283
[state]: https://github.com/canias7/isibi-app/blob/5afd5a0fe51e2d5f9bb6480c649cd857e2c20668/worker.js#L14840
[look]: https://github.com/canias7/isibi-app/blob/5afd5a0fe51e2d5f9bb6480c649cd857e2c20668/worker.js#L15621
[schema]: https://github.com/canias7/isibi-app/blob/5afd5a0fe51e2d5f9bb6480c649cd857e2c20668/worker.js#L5954
[meta]: https://github.com/canias7/isibi-app/blob/5afd5a0fe51e2d5f9bb6480c649cd857e2c20668/worker.js#L24920
[union]: https://github.com/canias7/isibi-app/blob/5afd5a0fe51e2d5f9bb6480c649cd857e2c20668/worker.js#L15578
[merge]: https://github.com/canias7/isibi-app/blob/5afd5a0fe51e2d5f9bb6480c649cd857e2c20668/builder/site-addon.mjs#L158
[picker]: https://github.com/canias7/isibi-app/blob/5afd5a0fe51e2d5f9bb6480c649cd857e2c20668/builder/site-add.mjs#L1300
[validator]: https://github.com/canias7/isibi-app/blob/5afd5a0fe51e2d5f9bb6480c649cd857e2c20668/builder/page-gen.mjs#L3166
