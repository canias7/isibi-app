# No emoji or checkmarks, and dashes on the request card (2026-10-13, on branch `new`)

**Status: built and tested offline on the owner's word, on a new branch
`new` cut from `main` (`fef80b9b`). Nothing merged, deployed, pressed or
spent.**

## What the owner asked

- *"i dont want checkmarks or emojis in the progress stuff neither regular
  chats unless requested"*.
- The numbers 1, 2, 3 before a request's parts replaced, chosen from rendered
  options: **E**, a dash before each part.
- The lines under a part (each with its time, the newest with a dot),
  chosen from rendered options: **4c**, a dash in place of the time, the thin
  thread between lines kept, and no dot.
- *"Open a new branch, call it new"*.

## What changed

**The card** (`public/chat.js`, `public/styles.css`):
- `progressListHTML` no longer writes the time (`progressAt` is gone) or the
  live dot; the newest line keeps its `live` class.
- `.st-req-parts` has no list numbers; each `.st-req-part` and each
  `.st-req-prog li` starts with a grey dash drawn by the stylesheet; a 1px
  thread joins the progress lines; the old left border and the dot's rule
  are gone. The build rail's live lines use the same list, so they read the
  same way.

**What our code says** (`public/chat.js`, `public/edit-poll.js`,
`builder/site-*.mjs`, 82 lines plus the escaped ones):
- every ✅, ⚠️ and ⏳ prefix in a composed reply is gone, as are ↩ (restore),
  ↻ and ⏹ (online/offline) and ⚡ (out of credits);
- `editReply` trims its result, because a look step that only joined other
  steps' sentences used to start with a lone ✅;
- **one sentence changed in words**: a placeholder build with no model
  summary used to say "⚠️ Built “X”. Tell me what to change." — the warning
  sign was the only thing saying it was not built. It now says "Your site
  didn’t finish building, so your address shows a placeholder for now. Send
  it again to try once more.";
- the logo step's "Attach the logo with the 📎 button" names the composer's
  real button: "the + button".
- **Kept**, as interface labels and not replies: the ★ pricing badge, the
  🔔/🔕 email toggle, the ▶ step chevrons. The router's internal ⚠ heading
  is never shown. Readers that strip a leading ✅ from stored replies stay,
  for replies stored before this change.

**What a model is told** (no example, no symbol in the instructions):
- the final reply (`REPLY_SYSTEM`): the line inviting ✅/⚠️ is replaced by
  "No emoji and no checkmark or warning symbols, unless they asked for them.";
- progress lines and task lines (`PROGRESS_SYSTEM`, `TASK_SYSTEM`): folded
  into the existing last line ("… with no greeting, sign-off, emoji or
  symbols unless asked"), keeping both under their concise limits (1,992 of
  2,000 and 1,164 of 1,200 characters);
- the router's chat answer (both tools share the description).
- **Not measured live**: no real model has written under these words yet.

**The canary** (`scripts/canary-additions.mjs`, `scripts/canary-ui.mjs`,
`scripts/edit-canary.mjs`): three checks read ✅/⚠️ off the screen as the
success or warning mark. With no mark, the stored replies (already checked)
decide success, and the screen must carry the failure's own sentence, or
name the table, or say something at all. The expected D1 and Test 9
replies lost their ✅.

## Tests

- **New**: `test/no-emoji-replies.test.mjs`, 4 cases. A live scanner over
  every composed string in the chat, the poll, the Worker and every builder
  module, with a named allowance list that must each still match; every
  customer-facing instruction rules emoji out and shows none; the card has
  no time, dot or number, and the stylesheet draws both dashes and the
  thread.
- **Updated**: 558 test lines in 85 files expected the symbols. Exact-text
  checks lost the symbol and kept the words. Checks that tested only the
  mark ("starts with ⚠️") now assert the text carries no pictograph. Every
  one was checked for a check that had become vacuous (`/^/`, `startsWith("")`,
  a double negation, a wrapped `assert.ok`); 3 + 3 + 12 such were found in
  the first pass and rewritten. Developer-facing ⚠ in test titles and an
  internal sweep report were restored where the first pass had stripped them.
- The router's first-build pin (`live-clarify-contract`) was re-pinned on
  purpose: all 42 request halves moved with the new description, and all 42
  reading halves were measured unchanged.
- **Sweep**: 10 mutants, 10 killed (a tick back in a chat reply, an escaped
  tick, a tick in a builder module, the reply invited to use one, the task
  rule dropped, the router rule dropped, numbers back, the line dash gone,
  the time back, the placeholder saying "Built"); the comment-only control
  survived.
- **Full suite**: `main` measured in a worktree, `10737 / 10734 / 0 / 3`;
  this branch `10741 / 10738 / 0 / 3` locally (the 4 new cases).
- **Screenshots**: real Chromium, the repo's own `public/`, supplied model
  answers (`test/progress-browser.test.mjs` with `PROGRESS_SHOTS`), sent to
  the owner in the conversation.
