# 2026-10-24: one occasional next step in the final reply (idea #24, adapted)

Branch `next-step-hint`, from `progress-voice` (`a7cf4d82d`). Not merged and not deployed. Nothing paid, no model calls.

## What the owner asked for

Idea #24 ("suggested next requests", from dyad), adapted: the final-reply writer (builds, edits, add-ons, request summaries) may **sometimes** add one soft next-step suggestion as an ordinary sentence of its reply. No buttons and no list, and it is never required. **The model decides** whether to add one. No hardcoded sentences and no keyword rules.

## What changed

- `builder/site-reply.mjs`
  - `REPLY_NEXT_STEP_RULES` is added to `REPLY_SYSTEM`. A suggestion is optional and skipped more often than not. It is only made when it is grounded: something not built or not done, a new page not known to be in the menu, a related problem a fact mentions, or an unanswered part of the message. At most one. Never a list, button or option menu. None after a simple self-contained change. Never a topic under ALREADY SUGGESTED RECENTLY. The same first-person voice.
  - The older rule "never claim a next step no fact states" now names this one exception.
  - `REPLY_TOOL` has an optional `suggested` field: the topic in a few words, at most 80 characters.
  - `readReply` and `writeReply` return `suggested`. `withReplyText(body, text, suggested)` puts it on the answer, and `readReplyRecord` keeps it on a background reply's record.
  - `replyContext` takes `recent` (topics already suggested) and `offMenu` (pages to name).
  - New helpers: `suggestedOf` (strict reader, never coerces), `recentSuggestions(msgs)` (the last 3 among the last 20 messages, the builder's own messages only) and `offMenuPages(addonAnswer)` (`added` less every page a menu was reported to link: "not known to be linked", not proof of a missing link).
  - The `notBuilt` and `notDone` lists were already facts (`f`). They are unchanged, and the rules now point at them.
- `worker.js`
  - `replyAsked` reads the request's `chat`. The edit, add-on and route asks carry the caller's `uid`.
  - `recentSuggestedFor` reads the stored chat (`chat/<uid>/<chat>.json`) and returns its recent markers. It returns `[]` on any doubt.
  - `composeModelReply` passes `recent` and, for add-ons, `offMenu` to the writer, and returns `suggested`.
  - `suggested` reaches what is served on every path: inline replies (`withModelReply`), queued jobs (`keepReplyFor` → `askOfReplyFor` → `settleReply` record → serve), request summaries (`requestReply`) and builds (`narrateBuild` and its kept narration).
- `public/edit-poll.js`: when `modelReply(body)` accepts a reply, it remembers `body.suggested` by the reply's words. `EditPoll.suggestedFor(text)` gives the topic back.
- `public/chat.js`
  - `siteReplyMsg` and `siteFinishBuild` put `suggested` on the stored message. It is never drawn: the suggestion is only the reply's own sentence.
  - The edit and add-on POSTs now send `chat` (the route already did).
  - The server keeps the page's messages whole (`readChatPut`), so the marker round-trips.

## Limits

- **First builds get no repeat list**: `narrateBuild` is not handed the chat, and a first build has no earlier suggestions anyway.
- A stored chat a device has not yet written back is not read. The guard then sees fewer topics; it never sees wrong ones.
- How often the model suggests, and how well, is not measured: there have been no model calls.

## Tests

- `test/next-step-hint.test.mjs`, 8 cases:
  - the rules as properties;
  - the tool field;
  - `notBuilt` and `notDone` facts sent whole, beside the recent suggestions and the off-menu pages;
  - `offMenuPages`;
  - the marker round-trip, from a supplied writer answer to the served body, the reply record, `EditPoll`, the real `siteReplyMsg` cut from chat.js, `readChatPut`, `recentSuggestions` and the next context;
  - the recent window;
  - plain text only, using supplied answers;
  - the Worker and page wiring, read between landmarks.
- **Red on the old code**: the file fails at import, because the old module has none of the new exports.
- Sweep: 13 of 13 mutants killed (rules, context, reader, served body, record, page memory, page message, Worker wiring); the comment-only control survived.
- Two older guards were updated for intended wiring: `test/site-chat.test.mjs` (a fourth `cleanChatId(body.chat)` reader, in `replyAsked`) and `test/model-replies-routes.test.mjs` (`replyFor` now carries `uid`).

## Image prediction

The site image copies `builder/site-reply.mjs`, so a merge **rolls the image**: SiteBuildContainer `665ab9d93b9dce93` (origin/main) → `d6408655dec3f62b` (progress-voice) → `4182f2d851bd551e` (code commit `54126f6fb`), 229 inputs on each. AppBuildContainer is unchanged (`65022ce71e3d7274`). Builds should wait 15–20 minutes after such a deploy, and the deploy needs the owner's allowance.
- The affected test files (every test naming site-reply, edit-poll, `withReplyText` or `REPLY_SYSTEM`, 89 files plus the new one) are green after the change. The full suite was not run (optional for this task).
