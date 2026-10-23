# 2026-10-23 — The router holds parts back by item number (`router-hold-by-item`)

Branch `router-hold-by-item`, from `origin/main` `edb9f7a30`. Not merged, not
deployed. Nothing paid, no model called, no live write.

## The problem (live, 2026-10-23 19:28 UTC, `saltmarsh-and-sparrow`)

A 20-item numbered message sent to `/api/site/route` was refused at once with
`route/held-unread`. The router held part of it back by copying words into
`alsoAsked`; it reworded them, the code could not find those words in the
message (`wordSpans`, `heldParts`), and the whole message was refused, since
running it whole would also run the part promised for later.

## The owner's fix, as built

The router names what it holds back by ITEM NUMBER, never by copied words.

1. **Items, split by code** (`messageItems`, `builder/site-ask.mjs`). A list
   (two or more lines starting with `1.` / `2)` or a bullet `-` `*` `•`) is
   split at those lines; a following line belongs to its item; words before
   the first item are not an item and stay with what runs now. Otherwise each
   line, and each sentence within a line (split after `.` `!` `?`). Fewer
   than two items: nothing is numbered and the request is byte-identical to
   before. No keyword rules.
2. **Shown to the router** (`itemsBlock`, in `askRequest`): under THEIR
   MESSAGE, a block "THEIR MESSAGE, ITEM BY ITEM" with `[n] text`. Only on a
   site that exists (`live`) and only for a message of its own, never an
   answer to a waiting question. First-build code and `ASK_TOOL` untouched.
3. **New field on the live tool** (`HELD_ITEMS`, `heldItems: integer[]` in
   `LIVE_ASK_TOOL`). The held items, in item order, are changes 1, 2, … for
   `dependsOn` and `targets`.
4. **Read as the customer's own text** (`itemsToWords`, called first thing in
   `readRouting`, which also hands the converted input to `readDecision`):
   `heldItems` becomes `alsoAsked`, each item's exact text from the message,
   so every downstream reader (the browser, `heldParts` in the edit and add-on
   routes, `planParts` in the request flow, the build climb) finds it. Nothing
   else had to change: the routes, the request flow and the replies read
   `alsoAsked` exactly as before.
   - a number that is not an item, or not an integer, is ignored
     (`items-out`); `"5"` is never coerced;
   - every item held: the first stays with the answer, the rest are later
     (`items-all-held`). **An owner decision is open here**: the brief said
     "treat as nothing to do now, existing path", but the existing path for
     "nothing left" is the same `held-unread` refusal; keeping item 1 with the
     answer was chosen so the case never refuses. Say if you want otherwise;
   - no number readable: the answer's own `alsoAsked` words, if any, are read
     as before;
   - `resolved` present (the request written out from the conversation), or
     no items shown: `heldItems` is dropped (`items-ignored`), words form as
     before.
   - new decision codes: `items-shown`, `items-held`, `items-out`,
     `items-all-held`, `items-unread`, `items-ignored`.
5. The charge is unchanged (owner: forget the charge).

## Tests (`test/router-hold-by-item.test.mjs`, 6 cases, supplied router answers through the real `/api/site/route` and request flow)

- HI1: a 20-item message, answer `heldItems: [5..20]`: part 0 runs the
  preamble and items 1–4; parts 1–16 are items 5–20 verbatim; the router was
  shown the numbered items and given `heldItems`.
- HI2: words found are held as before; a reworded copy reaches the browser
  unchanged, is not accepted as parts, and `heldParts` still refuses it.
- HI3: out-of-range and non-integer numbers ignored; unsorted and repeated
  numbers come back in item order once; all held keeps item 1; no coercion;
  through `readRouting`. HI3b: all held through the route, never refused.
- HI4: an unnumbered three-sentence message split into sentences; the held
  sentence is cut out exactly.
- HI5: one item shows no block; bullets are a list; the field is integers.

**Red check**: HI1 run against `origin/main`'s `builder/site-ask.mjs` fails
(one part, nothing held); green on the branch. **Sweep**: 12 mutants, 12
killed (`no-swap`, `no-convert`, `off-by-one`, `no-range`, `no-allheld`,
`no-sort` (killed after adding the order case), `coerce`, `no-block`,
`no-items-route`, `no-list-mode`, `no-sentences`, `no-field`); the
comment-only control survived. Restored from a saved copy each time.

**Full suite** (`node --test "test/*.test.mjs"`): `12310 / 12306 / 1 / 3` (tests / pass / fail / skipped); the one failure is the known node_modules symlink case of this checkout. A first run also failed three browser tests on page-load timeouts; they passed alone (16 of 16) and in the second full run. `test/route-decision.test.mjs` gained a case for each of the six new decision codes.

## Image

`builder/site-ask.mjs` is a container input, so the site image rolls:
`origin/main` predicts `145239c1c143183b` (226 inputs; matches deploy 2264);
the branch predicts `ce54a2e2067d1f1b` (only `builder/site-ask.mjs` changed). The app image is unchanged (`65022ce71e3d7274`).

## Not done

- No live run (each would be paid): how often a real router uses `heldItems`
  is unmeasured.
- Held parts copied from `resolved` (a request written out from the
  conversation) still use the words form.
