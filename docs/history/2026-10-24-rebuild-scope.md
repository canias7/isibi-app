# 2026-10-24 — the full rewrite, kept only where the owner kept it (branch `rebuild-scope`)

Not merged, not deployed. Nothing spent: every model answer in every test is supplied.

## 1. The owner's decision

Keep the "revise" (the rewrite of every page) only for:

1. **a full new site description sent on a site that already exists** — unchanged, and
4. **the customer clearly asking to start over** — now only after a confirmation question
   ("this replaces your whole site, OK?"), the version before kept as a saved version they can restore.

Remove it as an automatic fallback:

2. an edit or an addition too big for the smaller steps never falls back to a whole-site rewrite;
3. a broken first build (no pages: the placeholder) is never offered a rewrite — the build is offered again.

## 2. What changed

**Server (the request's driver, `builder/request.mjs`).** `handOff` no longer answers `rewrite`:
a climb, a second edit hand-over, a hand-over to its own layer and a chain past `HOPS_MAX` answer
`split` (the part ends `failed` / `too-big`, with `split` and the step's own `splitReason`, nothing
to press, nothing charged); the add-on's `no-source` climb answers `retry-build` (the part waits
`approval` / `retry-build` with `retry: true`, and the press files the BUILD route with `retry`,
never the revise). The one way a part still reaches the rewrite's go-ahead is a routing answer of
`build`. A start-over answered yes (`confirmed`) is the go-ahead itself, recorded by the route at
once (no second button). A rewrite that stopped to ask ends `rewrite-asked`, its question kept and said.

**Router (`builder/site-ask.mjs`).** A new `startOver` field: on a site that exists, a start-over
answer must carry the router's own confirmation question; it is stored as the waiting question,
tagged `START_OVER_BY` (`route:startover`). Only an answer to THAT question with `startOver` and
`answered` comes back `build` + `confirmed`. Codes: `startover-asked`, `startover-unasked`
(no question: the call fails, nothing built), `startover-confirmed`. A plain new description is
`build` exactly as before.

**Page (`public/chat.js`, `public/edit-poll.js`).** An edit's or addition's climb no longer calls
`go()` (the revise): `EditPoll.climbSaid(ho)` says it, by its reason, and names every part put off
(the same words `alsoTail` gives a refusal). The resumed watch is the same. The go-ahead button reads
"Try building the site again" for a retry. The customer sentences:

- no pages: "Your site's first build didn't finish … Send your site's description again and I'll try the build once more."
- kind of site: "That would change what kind of site this is … ask me to start over and I'll check with you first."
- no saved design: "The quick steps need your site's saved design … ask me to start over and I'll check with you first."
- anything else: "That needs more than the quicker steps can make in one go … Send it as smaller changes, one at a time …"

**Parity: the newer machinery is the rewrite's too.**

- the design correction round (`recoverDesign`) runs on a rewrite, told `revise` and shown the stored site; a partial revise answer is whole and is not "repaired";
- the build/rewrite page writer may ask (`SITE_PAGES_TOOL_ASK`) when its caller can carry the answer (not a fired or resumed generation); the question stops the publish before anything is written or charged, the deposit goes back, and the page opens the same question round as the designer's — its answer runs the same rewrite again with the answers (`qa`);
- the file picker (idea #21) narrows what a big site's rewrite is shown (`reviseOnly`), billed on the page bill (`pickUsage`); a page not picked is named and never returnable.

## 3. Evidence

- **New tests**: `test/rebuild-scope.test.mjs`, 16 cases through the real Worker and the real page
  functions — cases (1)–(4), the start-over yes/no/other-question paths, the version before a
  start-over still listed by `/versions`, and the parity guards.
- **Red check** on `692087cde` (main of this branch): 14 of 15 fail; the (1) case passes on both, as it should.
- **Sweep** (in a copy of the tree, never in the worktree): 11 of 11 mutants killed, the comment-only
  control survived. The first pass left one survivor (the Worker's `revise: !firstBuild` wiring to
  the design correction); a wiring guard was added and kills it.
- **Re-anchored existing tests** (old behaviour reversed on the owner's decision): request-plan,
  request-flow (F3, F4, A37-1; N1–N9 now reach the go-ahead through a re-routed `build`),
  build-draft-lifecycle, request-flow-page PAGE 5, addon-failure, edit-lock, edit-reply-validation,
  handover-operations, edit-poll, site-ask, site-logo, handover-resume (cuts `designQuestion`),
  route-decision, and spelling guards in publish-pages, wiring, written-frame-edit/-links, site-apply
  (literal bound 2,600 → 2,900), build-budget (`file_pick` mapped to `generate`).
- **Full suite**: see §5.

Screenshots (headless, the real card and climb sentence):
before `before-main.png`, after `after.png` in the session's scratchpad `shots-rebuild/`.

## 4. Not done here

- **A panel row and a real server Stop for the revise** (cases 1 and 4): branch `build-panel-stop`
  (`74944d02a`) gives first builds both; it is not in this branch's base, so carrying it to the
  revise is left for when the two branches are combined.

## 5. Full suite

`12474 / 12469 / 2 / 3` locally. The two failures are this machine's, not the change's:
`media-verify`'s browser mode fails the same on the base `692087cde`, and `no-generated-deps`'
symlink case fails because this worktree's `node_modules` is a symlink (git will not look past it).
The first run (`12473 / 12450 / 20 / 3`) found the re-anchors listed in §3; all fixed.
