# 2026-10-24 — Per-device edits (branch `device-scope`, not merged, not deployed)

The owner's design (2026-10-24), the backlog's "Different edits per device":
one site, never a phone copy; pages adapt by screen size; three sizes like the
preview's buttons (phone, tablet, desktop); a change may target any subset and
**the default is all three**; the router decides from the customer's words,
with the preview's device as a hint (the words win), and may ask a normal
question; a scoped change may really differ (size, spacing, order, hide/show,
layout) inside the same page with responsive rules; **code enforces, model
decides**: the page is measured at the three widths before and after, a device
not asked for must be unchanged, or the change is refused through the existing
refusal path; the preview switches to the changed device and the reply's facts
say which devices changed.

Offline only: no paid run, no real model call, no live write.

## 1. The breakpoint map

`builder/device-scope.mjs` (new; on both container COPY lines):

| device  | band        | measured at | preview frame |
|---------|-------------|-------------|---------------|
| phone   | < 768px     | 375 × 812   | 412px         |
| tablet  | 768–1023px  | 860 × 1024  | 860px         |
| desktop | ≥ 1024px    | 1280 × 900  | full width    |

The kit's Tailwind v4 stylesheet declares no breakpoints, so Tailwind's
defaults stand (`md` 768, `lg` 1024). Phone and desktop are the render check's
own `VIEWPORTS`; tablet is the preview's width. A test reads all three sources
and fails if any width leaves its band, or if the kit starts declaring
breakpoints.

## 2. How the scope flows, end to end

1. **Page → router.** `public/chat.js` sends `device` (the preview's
   `siteDevice`) with `POST /api/site/route`.
2. **Router.** `worker.js` passes `readDeviceHint(rb.device)` to
   `routeMessage` → `askRequest`, which adds one line to the request on a site
   that exists ("They are previewing the site on the tablet view."). The live
   tool (`LIVE_ASK_TOOL`, not a first build's) has a `devices` field: a list of
   `phone`/`tablet`/`desktop`, left out for every screen, with the hint said to
   be a hint and the existing `clarify` named for when it matters and the words
   do not say. No keyword rule: the model decides.
3. **Read.** `readRouting` (edit answers only) keeps a proper subset in
   canonical order; all three, an empty list or anything unreadable is "all"
   (an unreadable one is marked `devices-unread` in the decision). `devices`
   joins `EDIT_FIELDS`, so it is "ignored" on any other answer.
4. **Route → page.** The routing response (and a preparation's) carries
   `devices` for an edit. `siteEdit` posts it with the edit;
   `EditPoll.handOver` keeps it on a hop between steps.
5. **Server-finished requests.** `builder/request.mjs` carries it in the
   part's route (`routeOf`), on a server-side hop (`handedRoute`), and in the
   edit job body (`jobBody`).
6. **Edit route.** `eDevices = readDevices(eb.devices)`. The css lane's note
   gets `deviceNote(eDevices)` beside the landmark map and the theme; the page
   rung's tweak and its rewrite get it after the customer's words (`eAskOf`).
   An unscoped edit's requests are byte-for-byte as before (`deviceNote` is
   `""`). `pendingPublish` carries the scope to the one publish.
7. **Build service.** Every publish asks for `layout: true`;
   `build-server.mjs` hands `checkRender` an array and answers it beside
   `render`. `render-check.mjs` takes the fingerprint on the phone and desktop
   pages it already opens (before any overlay is clicked) and visits each
   route once more at the tablet width, inside the same 25-second budget.
8. **The guard** (`recompileAndPublish`, after the dead-rule check, before the
   seam and before anything is written): for a scoped change,
   `compareLayouts(stored, built.layout, devices)`. A device not asked for
   that moved, or one that cannot be compared, returns `deviceRefusal`
   (`error: "device-scope"`) — the same place and shape as `dead-css`, so the
   edit route's ordinary failed-publish path runs: nothing published, the
   stylesheet or look the lane stored put back, a job's reserve refunded,
   a synchronous edit treated exactly as a compile failure is. `compileMsg`
   says which view moved (or could not be compared) from the refusal's facts.
9. **After a write**, `source/<slug>/layout.json` is replaced with this
   publish's measurement (every publish, scoped or not), so the next scoped
   change has its "before".
10. **Facts and preview.** A scoped publish answers
    `devices: { asked, changed }`; the edit route's final answer carries it;
    `editReplyFacts` adds the note ("This change was for the phone view only.
    The tablet and desktop views were measured before and after and are
    unchanged.", and when an asked device did not move, that too) for the
    reply writer; `applyEditResult` calls `siteDeviceShow(e.devices)`, which
    switches the preview to a device the change moved (staying put when it is
    already on one), and leaves it alone for an unscoped change.

## 3. The comparison, and why

Pixels were rejected: two renders in two container runs differ for reasons
that are not the change (font hinting, image decode, an animation mid-frame),
so a pixel diff refuses good edits. A raw DOM diff was rejected the other way:
a page writer that wraps a block in `hidden md:block` adds an element at every
width while nothing a visitor sees moved.

The fingerprint (`layoutProbe`, run in the page) is **what a visitor sees at
that width**: every rendered element that shows something (its own text, an
image/svg/video/control, a background colour or image, a border), skipping
`display:none`, hidden and unrendered ones, in document order; for each, its
position and size from the **offset boxes** (which ignore transforms, so an
entrance animation is not a difference) and the styles that paint it (colour,
background, font size/weight/family, alignment, border colour). The words'
content is left out: words are one site's, shared by every device, and a
change in their length moves the boxes anyway. Each page/width gives
`{ n, digest }` (FNV-1a over the items, capped at 3,000).

Measured in a real Chromium (test cases "probe"): the same page twice gives
the same fingerprint; a phone-only `@media` rule changing a size, reversing an
order and hiding the footer moves phone alone; a tablet-only padding moves
tablet alone; a transparent wrapper moves nothing; a block shown on phone only
moves phone alone; an unscoped colour moves all three.

**Cannot-tell is never unchanged**: no stored layout, a route or a device on
one side only, or a cut-short tablet pass is `unknown`, and a scoped change
with any unknown device is refused.

## 4. Tests

`test/device-scope.test.mjs`, 20 cases: the map against the kit, the render
check and the preview's stylesheet; the reader; the comparison (pass, refuse,
count, unknown, unscoped); two real-Chromium probe cases; through the real
`POST /api/site/route` with supplied router answers (the field and the hint in
the request as sent; a subset kept, all three and garbage dropped, never on an
addition); through the real `POST /api/site/<slug>/edit` with supplied picker
and css-lane answers and a stubbed build service answering `layout` as
`build-server.mjs` does (phone-only published with the facts and the new
layout stored; desktop also moved refused as a job with the stylesheet put
back, the layout kept, nothing committed or billed; no stored before refused
as unknown; unscoped and all-three untold and unchecked); the page's two wires
and the real hand-over; `siteDeviceShow` in a VM; a server-finished request's
job body; the render check's real capture at three widths on a static page
in Chromium, and the build service's two wires. The compiler fixture (`test/fixtures/cf-containers.mjs`) gained an
optional `layout` answer.

Numbers are in §6.

## 5. Limits (NOT proven live)

- No real model has chosen `devices`; no real kit page has been measured in
  the container; no real lane has written a scoped rule. All shown with
  supplied answers and a static page in Chromium.
- **The first scoped change on an existing site is refused** (no stored
  "before"): every edit publish from this deploy on stores one, so after any
  one ordinary edit it works. The refusal says the other
  view "couldn't be compared". Builds do not go through `recompileAndPublish`,
  so a site built and never edited has no layout yet.
- A page whose content changes between renders on its own (a clock, "open
  now", a random order) would read as a change at every width and refuse a
  scoped edit. Not seen in the fixtures; recorded.
- The guard compares against the last publish's measurement, not a re-render
  of the live version; a parallel write landing between the two could read
  as a change (refused, never published wrongly).
- No redo round: a refused scoped change is told to the customer (no charge
  for a job), not retried with the measurement. The dead-rule correction round
  is the model for one if the owner wants it.
- The route-answer cache keys on the message and site, not the preview
  device, so the same message re-sent from another device reuses the answer.
- The refusal sentence is composed in `compileMsg` like the other publish
  refusals; the facts (`devices.asked/changed/unknown`) ride on the answer
  for the reply writer.
- The tablet pass adds one page load per route to every publish's render
  check (inside the existing budget; a cut tablet pass leaves tablet unknown).
- The add-on path is not scoped (the field is read on edits only).

## 6. Readings

- **Base**: rebased onto `origin/main` `692087cde` (Combine C) during the work;
  the branch is one code commit plus this record.
- **Existing guards updated for the new field** (each a deliberate re-anchor,
  dated in place): `site-apply` (the routing answer's code bound 2,600 → 2,800
  for `devices`), `canary-probes` (a probe has no preview, so `device` is not a
  field it must post; the browser's sending it is asserted), `route-decision`
  (a case reaches `devices-unread`).
- **Red check** against `origin/main` (an archive copy): the test file fails
  to load (no `builder/device-scope.mjs`); with the module copied in, 11 of 20
  cases fail (every route, page, request, render-check and service case) and
  the 9 module-only cases pass.
- **Sweep**: 33 mutants over `device-scope.mjs`, `site-ask.mjs`, `worker.js`,
  `site-reply.mjs`, `render-check.mjs`, `build-server.mjs`, `chat.js`,
  `edit-poll.js` and `request.mjs`, each restored from a saved copy: **33 of
  33 killed**; the comment-only control survived. No commit while it ran.
- **Full suite** on the rebased head (worktree, `node_modules` linked):
  `12478 / 12474 / 1 / 3`; the one failure is `no-generated-deps`'s symlink
  case (the linked `node_modules`, environment only). Before the rebase, on
  `c89732649`: `12423 / 12412 / 8 / 3`, which found the three re-anchors above,
  a request record carrying `devices: undefined` (now set only when present),
  the deferred publish's field order (`charges: eCharges` kept last) and the
  image test (the new module not yet committed).
- **Image prediction** (`containerInputs`/`imageId` over the git objects):
  `origin/main` `692087cde` → `0bae00a7003bcc23` (231 inputs, 199 paths);
  this branch → `c296cdfafd62d5d3` (233 inputs, 200 paths: `device-scope.mjs`
  joins both COPY lines; `render-check.mjs`, `build-server.mjs`, `site-ask.mjs`,
  `site-reply.mjs`, `request.mjs` and `worker.js` changed). **A merge rolls the
  site build container** (the owner's rule: only with their specific
  permission, and builds wait ~20 minutes). The app container is unchanged
  (`65022ce71e3d7274`).
- **Screenshots** (headless, the real `siteDeviceShow`, icons and
  `public/styles.css`): `shots-device/1-before-desktop.png` and
  `shots-device/2-after-phone-edit.png` in the session scratchpad.

## 7. The paid tests to propose (the owner's approval first)

On a fixture site after a merge and a deploy, and after one ordinary edit to
seed its layout; each about a look edit's cost (routing 2 + css lane 1–2):

1. "Make the headline smaller on phones only" from the desktop preview:
   expect `devices=["phone"]`, a `max-width: 767px` rule, published, the
   preview switching to phone, tablet and desktop unchanged.
2. "On tablets, put the opening hours above the menu": the page rung scoped
   to tablet.
3. A message naming no device while previewing on phone: expect no `devices`
   (all three): the hint does not override the words.
4. The refusal (another device moved) is shown offline with supplied answers;
   it needs no paid run.
