# 2026-10-24 — Per-device behaviour in the first build (branch `device-scope-build`, not merged, not deployed)

On `device-scope` (`8acc4444d`, itself on `main` `692087cde`). The owner's
extension of per-device edits (`2026-10-24-device-scope.md`) to the first
build. Offline only: no paid run, no real model call, no live write.

## What changed

1. **The layout is stored after every successful build and revise.** The
   build's compile payload asks `layout: true` (the render check already
   measures phone/desktop and visits tablet); `publishPages` carries the kept
   compile's `layout` (assigned, so a salvage keeps its own); the build path
   saves it with `saveLayout` beside the landmark map, gated on
   `out.page === "app"`. The known limit "a site's first per-size change is
   refused until one ordinary edit has stored its layout" is gone.
2. **Screen-size wishes in a description.** `design_schema` (build and
   revise tools) gains an optional `devices` field
   (`DEVICE_WISHES_FIELD`: `[{ devices, wish }]`), in the design waves'
   identity agent and the graph's `extras` agent. The designer decides; no
   keyword rule. `readDeviceWishes` keeps proper subsets with a wish (max 6);
   the route carries them as `deviceWishes` on the build args (per build,
   never on the look); `briefWithLayout({ devices })` appends
   `deviceWishesNote` after the layout directive for the single call and
   every band writer. **An unscoped build's writer requests are byte-for-byte
   unchanged** (asserted: absent, `[]` and an all-three wish give identical
   requests). The design request itself gains the optional field.
3. **Add-ons.** The router keeps `devices` on an `addon` answer too (not
   marked ignored); the routing response, the page's `siteAddon` and the
   server request's addon body carry it; the add-on route appends
   `deviceNote` to the writer's brief and passes `devices` to
   `recompileAndPublish` (it did not before, so the guard did not cover
   add-ons), and its answer carries the publish's `devices`.
4. **Reply facts.** `buildFacts({ devices })` (only for a build that went
   live) → `buildReplyFacts` adds "Screen-size wishes applied: … (phone
   only); …"; `addonReplyFacts` calls `deviceFacts` as the edit does.

## Found, kept separate (backlog)

The build path's landmark save is gated on `out.ok && out.render`, and
`publishPages` answers no `ok` on success (measured in the harness), so a
built site's landmark map is never stored.

## Tests

- `test/device-scope-build.test.mjs`, 9 cases: a whole queued build through
  the real consumer and `react-build` route with a supplied design and page
  writer answer (layout stored at all three widths; the first scoped
  comparison passes; nothing stored when nothing measured; a scoped wish
  reaches the writer with its widths and the reply facts; unscoped requests
  unchanged); the reader; add-on wiring end to end.
- Re-anchored: `device-scope.test.mjs` (an addition now keeps devices; a
  question does not), `edit-lanes.test.mjs` (`devices` is build-only, no
  lane), `written-frame-edit.test.mjs` (the call's new argument),
  `test/integration/schema-tool.mjs` scope.
- **Red check** against `origin/device-scope` with only the new
  `device-scope.mjs` copied in: 7 of 9 fail; the two controls pass.
- **Sweep**: 21 mutants, all killed after one test fix (the add-on
  "marked ignored" mutant first survived: the case read a field readRouting
  does not return; it now reads the trace and proves the observer alive);
  the comment-only control survived. Restored from saved copies; the diff's
  md5 identical before and after.
- **Full suite** (worktree, `node_modules` linked, removed before commit):
  `12487 / 12478 / 6 / 3`. One real failure (`written-frame-edit`, the
  spelling guard above, fixed and rerun green); the others were load/
  environment only and pass alone (`build-queue-wiring` 8 s timeout,
  `container-model`, `container-images`).

## Image prediction

| ref | site image | inputs/paths | app image |
|---|---|---|---|
| `origin/main` `692087cde` | `0bae00a7003bcc23` | 231 / 199 | `65022ce71e3d7274` |
| `origin/device-scope` | `c296cdfafd62d5d3` | 233 / 200 | same |
| this branch | `d39dcaea4048d0ed` | 233 / 200 | same |

A merge rolls the site build container (owner's specific go-ahead; ~20 min).

## Overlaps with the other helpers' branches

`worker.js` build path (`buildAndPublishPages`, the build payload, the
`buildFacts` calls) — first-build-uncapped, rebuild-scope, build-questions,
repair-everywhere, build-reply-bubble; the add-on route — addon-uncapped;
`site-reply.mjs` `buildReplyFacts` — build-reply-bubble, progress-voice-2;
`publish-pages.mjs` compile — repair-everywhere; `design-waves`/
`design-graph` — build-questions.

## Not shown

Which wishes a real designer reads, and whether a real writer honours them;
a paid press after merge and deploy, proposed with the owner's approval.
