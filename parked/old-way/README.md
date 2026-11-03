# The old way, parked

On 2026-11-03 the owner said: *"Just put it in a parked file that we won't
use."* This folder holds the old way of handling a customer's message, taken
out of the live code on the branch `park-old-way`, from commit `014a7cd31`
(the tip of `claude/nice-ramanujan-9ry8wy`; live `main` was `ad0be63bb`).

**Nothing imports this folder.** `worker.js`, the live `builder/` modules and
`public/` do not load anything from `parked/`. It is not a container image
input, the Worker bundle does not include it, and the unit suite
(`test/*.test.mjs`) does not run its tests. It is kept so the old code and its
tests can be read, or brought back, without digging through git history. The
full old files are also in git: `git show 014a7cd31:worker.js`,
`git show 014a7cd31:builder/site-ask.mjs`, and so on.

## What the old way was

Before the site agent (2026-10-28, always on since then), a message about a
site went through several steps:

1. **The router** (`routeMessage` in `builder/site-ask.mjs`). One cheap model
   call read the message and the site's summary and answered with one
   **layer**: `text`, `data`, `rules`, `look`, `picture`, `logo`, `nav`, `page`
   or `addon`. It could hold part of a message back for later (`alsoAsked`),
   ask the customer a question (**clarify**), or answer a question in words
   (**converse**).
2. **The lanes.** Each layer had its own step in the edit route: cheap text
   rewrites, a row editor for data, a rules editor, a look editor, picture
   swaps and removals, the logo, the menu editor, whole-page rewrites, and
   the add-on step with its requirement report. Each step cost what its kind
   of change cost.
3. **The escalation ladder** (`builder/edit-failure.mjs`). When a cheap step
   could not do a change, it climbed to the next one, cheapest first, only
   where that climb was classified.
4. **The per-part replies.** Each part of a request had its own reply,
   written from the request's facts.

Since 2026-10-28 one site agent takes every message whole, and since
2026-11-02 no router call is made at all. The old steps ran only in the unit
suite, under `GF_OLD_LANES=1`. That switch is gone now: the test script is
plain `node --test "test/*.test.mjs"`, and `GF_OLD_LANES` is ignored.

## What each file holds

| File | What it is |
|---|---|
| `worker-old-steps.mjs` | The old code taken out of `worker.js`. The edit route's old steps (the lanes' picker, every layer, the one publish per message, the merged reply), the add-on route's old steps (the requirement report, the designer, the backend writes, the row step), the router call and its scoped re-ask in `/api/site/route`, a part's step prepared ahead of its job, the per-part request reply, and the module-level helpers and route locals only those steps used. Each route piece is kept word for word inside a function named after it, so the file still parses (`node --check`). It is **not runnable**: the pieces read the route's own variables, which are not here. The list of what they imported from `builder/` is at the top, as a comment. |
| `builder/site-ask.mjs` | The router: its prompt, tools, site digest, scope, held-back parts and the model call. The pieces the live code still reads moved, unchanged, to `builder/route-shared.mjs`; this file imports them from there and exports them again, so it has the same 93 exports as before. |
| `builder/site-logo.mjs` | The logo lane. The agent uses `set_logo`. |
| `builder/part-keep.mjs` | The component text guard of the old page rung. |
| `builder/requirement-retry.mjs` | The add-on step's one more page pass for a missing requirement. |
| `builder/content-evidence.mjs` | The add-on step's evidence of what a change added to a page. |
| `test/` | The old way's tests, moved out of `test/` (whole files, or the old half of a file whose other half still tests live code). Their relative paths were rewritten to point back at the repository from here. Many read `worker.js` text that is no longer there, so they would fail if run; they are kept for reading. |

## What stayed live, and why

- **`builder/route-shared.mjs`**: what the live code still reads from the old
  router module: the waiting question's shape (`readAsk`, `usableAsk`), the
  routing answer's shape (`routeDecision`, `routeFailure`, used by the
  new-project turn and `agentRouted`), the edit layers' names
  (`EDIT_LAYERS`, which a part's record still carries), the context, held and
  word-span helpers the request engine and the question store use.
- **The question store** (`builder/clarify.mjs`), **the request engine**
  (`builder/request.mjs`), **the reply writer** and **`site-converse.mjs`**:
  the agent path still calls them.
- **The lane modules that live code still calls** (`site-text`, `site-lanes`,
  `site-add`, `edit-failure`, `site-edit`, `site-rules`, `site-rows` and the
  rest): each is still imported by `worker.js` for something the agent path,
  the build or a route still runs (for example the cheap text try before the
  agent, the add-on route's failure shapes, the row helpers). Only code that
  no live path reaches was moved.
- **`builder/page-prose.mjs` and `builder/kit-headings.mjs`**: no longer
  imported by the Worker, but the kit-headings generator and its checks use
  them, so they stay in `builder/`.
- **`public/chat.js`** is unchanged. Its reply wording functions (`editReply`,
  `addonReplyText` and the rest) read every edit and add-on answer, the
  agent's included, so none of them can be shown to be old-only by reading
  the code.
- **`scripts/canary-route.mjs` and `scripts/canary-probes.mjs`** read the
  router's names, so they import this folder's `builder/site-ask.mjs`. They
  are workflow scripts, not live code.

## Bringing it back

Nothing here is wired in. To bring a piece back, take it from git at
`014a7cd31` (the exact file), not from the fragments here.
