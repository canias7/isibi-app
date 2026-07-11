# Owner Notes

Running record kept for the owner (aniascapital@gmail.com). Two purposes:
1. **Bug log** — things the owner found broken or not-as-wanted, tracked to resolution.
2. **How the owner likes things done** — durable preferences/patterns so a fresh
   session doesn't have to relearn them.

Future sessions: **read this file at the start.** Update it as bugs are reported
and fixed, and add a preference line whenever the owner signals one.

---

## How the owner likes things done

- Explanations in **plain English**, not jargon dumps. Walk things "layer by
  layer" when touring the code.
- Show UI changes as **screenshots** in chat (owner reviews visually).
- Small, surgical changes — don't restyle or refactor beyond what's asked.
- One thing at a time. Owner prefers reviewing/fixing bugs one-by-one over big batches.
- Ship flow: change → commit → open PR → squash-merge to `main` (auto-deploys).

---

## Bug log

_Status key: 🔴 open · 🟡 in progress · ✅ fixed_

<!-- Newest first. Template:
### <short title>
- **Status:** 🔴 open
- **Reported:** <date>
- **Where:** <page / file:line>
- **What:** <plain-English description of the bug>
- **Fix:** <what was done, once fixed> (PR #___)
-->

### Attachments cleared when switching to a non-supporting model — NOT a bug (owner's call)
- **Status:** ✅ working as intended — do not change
- **Reported:** 2026-07-11
- **Where:** `public/chat.js` `updateAttachVisibility()` (~line 384)
- **What:** Attach an image → switch to a model without image support → switch
  back: the image is gone. The code deliberately deletes incompatible
  attachments on model switch (rather than hiding them) so a stale attachment
  can never be silently sent to a model that can't use it (send code doesn't
  gate by caps).
- **Decision:** Owner reviewed 2026-07-11 and prefers this behavior. Leave as is.

### Messages leak across all chats — thread never repaints on switch
- **Status:** ✅ fixed
- **Reported:** 2026-07-11
- **Where:** `public/chat.js` — duplicate `renderThread` (1592 + 5112)
- **What:** Typing in one chat showed the same messages in every chat. Each chat's
  stored `msgs` were actually separate; the bug was that switching chats never
  redrew the thread, so the screen stayed frozen on the last chat's messages.
- **Cause:** Two top-level functions were both named `renderThread` — the real
  chat one (1592) and an unrelated Media Agent Instagram-DM one (5112). JS lets
  the last declaration win, so every chat-thread repaint call actually hit the
  DM version, which no-ops when there's no DM panel (`#maDmThread` missing).
- **Fix:** Renamed the Media Agent DM function (and its single caller) to
  `renderDmThread`, freeing `renderThread` to be the real chat repaint again. (PR #348)
