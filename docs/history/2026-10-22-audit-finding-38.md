# Audit finding 38 (A21-1): the full page writer's text check reads props and data (2026-10-22)

From `docs/audits/2026-10-17-builder-audit.md`, A21-1 (high, confirmed, already
recorded in `docs/investigations/edit-text-preservation.md` and
`docs/edit-path.md` as "component prop strings not inventoried"). On branch
`audit-finding-38`, from `codex-work-into-claude` (`5ca00879`). Offline; no
paid call, no deploy, nothing pushed to `main`.

## Re-verified on current code first

The audit's own example, run against `preservePageProse` and `keepInventory`
at `5ca00879`: a home page with `<SiteChrome links={[{label:"Menu",…},
{label:"Order",href:"/order"}]}>`, an Hours section and `<CtaBand title="Order
ahead" action={{label:"Order now",href:"/order"}} />`; the message "Change the
text under ‘Hours’ to ‘Open 8 till 5.’"; the writer's answer changes the hours
and drops the Order entry and the whole band.

- `keepInventory` → `{"items":[],"unsure":[],"relabeled":[],"added":[]}` (no
  judge call).
- `preservePageProse` → `{ ok: true }`: the route would store and publish it
  and say "Updated".
- `extractText` on the same page lists `Fold Lane, Menu, Order, Hours, Open 8
  till 4., Order ahead, Order now`.

Still real.

## The fix

- **`builder/page-prose.mjs` `proseInventory`**: a string that is a prop's
  value (`title="…"`), a data object's value (`{ label: "…" }`) or an element
  of a list is now an atom (`role: "prop"`), judged by `extractText`'s own two
  rules, exported from `builder/site-text.mjs` as `proseString` (not code-
  shaped) and `codeKey` (`className`, `href`, `to`, `src`, `id`, `order`, …,
  and `name` on a DOM element). `alt` is left to the photograph guard.
- **Links by address**: an `href`/`to` in a data object or on a component is
  an atom too (`role: "link"`), identified by its address and the words of its
  own object or element (so the menu's `/order` and the band's `/order` are two
  things). `<a|Link|SiteLink href>` stays with `keepCheck`'s link inventory,
  which already asks about each such link (counting it here would refuse a
  removal the judge allowed).
- **The same permissions as every other atom**: a named section takes its
  carried words with it ("Remove the ‘Breads’ section." removes its cards); a
  quoted string can be changed or removed; "the ‘Order’ link / button / menu
  item" names that string's link; a link goes with its own words once they are
  granted, after every keep clause has narrowed the grant. Anything else lost
  is refused (`unconfirmed-target`).
- **The refusal names what would be lost**: `proseWithheldMsg(blocked)` is
  the old sentence plus "It would also have changed or removed: “Order”, the
  link to /order (Order), “Order ahead”, …". The list is read off the page,
  never the request. The route (`worker.js`, the page rung) answers it as
  before: 409 `prose-preservation`, cost 0, nothing compiled or stored.
- No keyword or fixture rule: what counts is decided by syntax position and
  `extractText`'s existing code filters.

## Tests

- `test/page-prose-carried.test.mjs` (7 cases): the audit's case refused with
  each loss named and nothing kept named; each loss alone (menu entry, band,
  a section's card data, a link's address moved); controls (the narrow
  rewrite, class/table/column changes, a reorder publish); asked-for changes
  (remove the ‘Order’ link or menu item, reword ‘Order now’, remove the
  Breads section with its cards) publish; not asked (the band's link taken
  instead of the menu's, a keep clause, a heading-only rename that drops the
  cards) refused; the refusal's words.
- `test/edit-page-keep.test.mjs`: through the real route, sync and job: the
  audit's rewrite refused at no cost with the losses named; the requested
  removal of the menu entry published. Existing assertions that the reply
  equals `PROSE_WITHHELD` now read "starts with" (the reply names the loss
  after it). One fixture corrected: the "menu board" case's after-page had
  silently dropped its own "Menu Board" menu entry, which the check now sees.
- **Red check**: on the old `page-prose.mjs` (with a stub `proseWithheldMsg`),
  the new file is 2 pass / 4 fail (controls and asked-for pass on both), and
  the two route refusal cases fail (published) while the two removal cases
  pass.
- Related files (`edit-page-keep`, `kit-headings`, `media-verify-judging`,
  `site-add`, `site-apply`, `site-text`, `site-tweak`): 476 / 476 pass.
- **Sweep** (`page-prose.mjs`, against the new file): 11 of 11 mutants killed (carried reading off, each of the three syntax positions off, code keys ignored, link identity without its words, the group grant off or widened, the link-noun strip off, the plain refusal, the bare address in the list); the comment-only control survived. The list and code-key case was added after a first pass where those two survived.
- **Full suite**: `node --test "test/*.test.mjs"`: 11,673 tests, 11,669 pass, 1 fail, 3 skipped. The one failure, `no-generated-deps` ("a node_modules of any form is ignored"), was caused by the `node_modules` symlink this worktree needed to load the parser; with it removed that file is 2 of 2.

## Limits kept

- Words computed at run time (template holes, variables) are not read, as
  before.
- Components in `-parts/` rewritten beside the page (A21-2) are a separate
  finding, not touched.
- A request that names a carried item without quoting it ("change the button
  text") is refused, asking to quote it, as the existing check does for any
  text.
