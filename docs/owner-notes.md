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

### YouTube Videos tab: 4 cards per row (panel widened, card size unchanged)
- **Status:** ✅ done
- **Reported:** 2026-07-11
- **Where:** `public/styles.css` `.ma-page.wide` / `.ytg`; `public/chat.js` `renderSection()`
- **What:** Owner wants the Videos grid 4-across without changing card size —
  i.e. widen the space, not the cards.
- **Fix:** `renderSection()` toggles `.wide` on `.ma-page` only for
  YouTube → Videos (other tabs keep the 720px panel). Wide panel caps at
  1420px = 4 × ~332px cards; steps down to 3/2 columns on narrower windows so
  card size stays steady. (PR #___)

### YouTube Videos tab: deleted-video tombstones shown + no thumbnails on real videos
- **Status:** ✅ fixed
- **Reported:** 2026-07-11
- **Where:** `worker.js` — `youtubeVideos()` (~line 1180) + the CSP `img-src` (~line 382)
- **What:** (1) The Videos tab listed "Deleted video" placeholder cards (YouTube
  keeps tombstones for deleted uploads in the channel list). (2) Real videos
  showed empty boxes instead of thumbnails. (3) Owner also wants thumbs at full
  quality.
- **Cause:** (1) No tombstone filter. (2) The Content-Security-Policy `img-src`
  didn't include `i.ytimg.com`, so the browser silently refused every YouTube
  thumbnail (same would bite Instagram post thumbs via `cdninstagram/fbcdn`).
  (3) Worker picked the 320px `medium` thumb first.
- **Fix:** Filter tombstones server-side (title "Deleted video" AND no
  thumbnails, so a legit video with that name survives); add
  `*.ytimg.com`, `*.cdninstagram.com`, `*.fbcdn.net` to `img-src`; pick the
  largest thumb available (maxres → standard → high → medium → default). (PR #___)

### White scrollbar after "Settings" tab in Media Agent panel
- **Status:** ✅ fixed
- **Reported:** 2026-07-11
- **Where:** `public/styles.css` `.sec-tabs` (~line 995)
- **What:** A white browser scrollbar stub painted right after the Settings tab
  on the Media Agent panel (Windows Chrome default scrollbar on the dark theme).
- **Cause:** `.sec-tabs` sets `overflow-x: auto`; per CSS rules that makes
  `overflow-y` compute to auto too, and the tab buttons overflow the strip by a
  couple px → browser painted a tiny default (white) vertical scrollbar.
- **Fix:** `overflow-y: hidden` + hidden scrollbars on `.sec-tabs` (same idiom
  as `.studio-thread`); tabs still scroll by wheel/touch if they overflow. (PR #___)

### Home-page preset cards must not hand off to the Builder (interim)
- **Status:** ✅ done (interim behavior)
- **Reported:** 2026-07-11
- **Where:** `public/chat.js` `renderPresetsInto()` / `usePreset()` (~line 934)
- **What:** Clicking a starter card on Home ("Product hero ad", "UGC testimonial"…)
  switched to the Builder with the preset prompt loaded. Owner wants generation to
  eventually happen ON the Home page itself; until that's built, cards shouldn't
  navigate anywhere.
- **Fix:** Unwired the card click (cards are display-only for now). `usePreset()`
  kept intact for the future generate-on-Home flow. (PR #___)
- **TODO later:** build generate-in-place on Home and re-wire the cards to it.

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
