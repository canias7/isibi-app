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

## Parked (owner said hold — do not build until re-opened)

- **Home preset system (2026-07-12):** the 8-preset lineup (Blitz Motion +
  Bag Drop / Morning Ritual / Street Take / Perfect Loop / Retro Rewind /
  Shelf Wars / Week One) is ON HOLD per the owner — "forget about them for
  now." Keep the assets: Blitz Motion has an owner-approved sample prompt
  (Tropical Elixir style, 12s 9:16, @image_1 product reference, 10-cut
  choreography, ends on readable-label packshot) and a model pick
  (Seedance 2.0 · 12s · 9:16 · 1080p). Presets = director instruction
  templates (fixed choreography skeleton + product description/world filled
  from the attached image). Home cards stay display-only (PR #349) meanwhile.

- **Declined (2026-07-12):** Luma **Reframe** (video + Photon image outpaint-to-new-ratio,
  on fal) — offered, owner said no. Don't re-pitch unless they bring it up.
  Runway integration also discussed: not on fal (needs its own API pipeline) — neither
  added nor declined, just informed.

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

### Added Luma Ray 3.2 to the video roster (owner request, 2026-07-12)
- **Status:** ✅ done
- **Where:** `worker.js` (allowlist, VIDEO_USD, isRay field handling),
  `public/chat.js` (MODEL_OPTS, menu row, providerOf, VIDEO_PRICE), `docs/MODELS.md`
- **What:** fal endpoint `luma/agent/ray/v3.2/text-to-video` (+ `/image-to-video`
  via the standard suffix swap). 5s/10s ("Ns" string), 540p/720p/1080p, six
  ratios, image + first-&-last frames (`image_url`/`end_image_url`), no
  reference mode, no audio. fal pricing → per-sec: 540p $0.10 · 720p $0.20 ·
  1080p $0.40 (t2v rates used for both paths — never undercharge). HDR/EXR and
  keyframes exist on the API but are NOT exposed yet (HDR doubles cost).
- **Untested on a real render** — fal balance still empty; verify on the live
  sweep when topped up.
- **HDR toggle added (owner request):** Settings panel shows an "HDR · 2× price"
  Off/On section for models with `opts.hdr` (Ray only). Guardrails both ways:
  turning HDR on bumps 540p→720p and 10s→5s; picking 540p/10s turns HDR off.
  Price quote doubles live; worker validates independently (`wantHdr` — wrong
  combos are neither sent to fal nor charged) and `creditCost` bills 2×.
- **Loop / EXR / video-to-video added (owner: "add all of those", 2026-07-12):**
  (1) **Seamless loop** — free Off/On in Settings; 5s SDR only, exclusive with
  HDR, dropped server-side alongside end frames/keyframes. (2) **EXR** — the
  HDR section is now Off / On·2× / On+EXR·3×; sidecar link is delivered as a
  chat message after the render (fal links expire in days). (3) **Video-to-video**
  — attaching a Video clip on Ray routes to `/video-to-video` (re-render the
  clip); "Clip edit mode" section: Auto (auto_controls) or adhere/flex/reimagine
  (sent at mid intensity `_2`); keyframes may combine; no aspect_ratio (source
  framing wins); billed at its own higher rates (`v2s`: 540p $0.144 · 720p
  $0.216 · 1080p $0.432 per sec) in both quote and charge. Granular v2v
  `controls` (pose/depth/face/trajectory) exist on fal but are folded into
  Auto for v1.
- **Keyframes added (owner request, full 64):** new "Keyframes" attach row,
  Ray-only (`caps.kf: 64`) — up to 64 images, numbered tiles in a 2-up grid,
  attach order = playback order, mutually exclusive with the other image inputs.
  Worker rides the i2v endpoint: `keyframes` + `keyframe_indexes` spaced evenly
  across the clip (24fps: 0–120 for 5s, 0–240 for 10s). No timeline UI yet —
  even spacing is the v1; a drag-to-time timeline is the future upgrade
  (pairs with the preset system). No extra charge (fal bills by video length).

### Builder: reference images must be visibly defined as @Image1, @Image2…
- **Status:** ✅ done
- **Reported:** 2026-07-11
- **Where:** `public/chat.js` `renderRefList()` / `showApInfo()`; `public/styles.css` `.slot-tag`
- **What:** For models that take reference images, the owner wants the chat to
  define them as @image1 etc. The backend already did (director writes the tags
  into Seedance prompts; worker appends "Feature @Image1…" to raw prompts and
  strips dangling tags) — but the UI never told the USER the tags exist.
- **Fix:** Each reference thumbnail now wears an @ImageN badge, and the ref-row
  tooltip teaches the syntax. First pass was Seedance-only; owner directed it to
  apply to ALL reference-capable models — so badges show wherever a Reference
  row exists, and the worker translates @ImageN → "reference image N" for
  tagless families (Veo) instead of stripping, keeping the sentence intact. The
  director is likewise told user-cited @ImageN on Veo means that reference.
- **In the chat too:** sending a message with references now drops a thumbnail
  strip under the user bubble (right-aligned), each thumb tagged @ImageN — the
  thread records which image each cited tag pointed at. Thumbs are downscaled
  (≤168px JPEG) before persisting so the localStorage chat budget + Supabase
  chat sync stay small; strip type is `{t:'refs', imgs:[…]}` in chat msgs.
- **In the chatbox too:** while references are attached, the composer shows one
  clickable @ImageN chip per image (micro-thumbnail + tag); tapping inserts the
  tag at the cursor (`renderRefChips`/`insertAtCursor`).

### Media Agent: wide panel on EVERY tab (superseded the Videos-only widening)
- **Status:** ✅ done
- **Reported:** 2026-07-11
- **Where:** `public/styles.css` `.ma-page` / `.ytg` / `.grid`
- **What:** First pass widened only YouTube → Videos (PR #352). Owner then said
  every tab — including all Instagram tabs — should use that wide size.
- **Fix:** `.ma-page` is now always 1420px max (the `.wide` toggle was removed);
  YouTube videos run 4-up (~332px cards, same as the old 2-up/720px), IG posts
  run 6-up (~215px tiles, same as the old 3-up). Column counts step down on
  narrower windows so cards keep their size. (PR #___)
- **Preference:** grids scale by ADDING COLUMNS, never by growing cards.

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

### Home page got a chatbox (owner request, 2026-07-12)
- **Status:** ✅ done
- **Where:** `public/chat.js` `renderLanding()`; `public/styles.css` `.lp-compose`
- **What:** A composer sits under the Home greeting (same panel style as the
  Builder's). Typing + Enter/send starts a FRESH chat, switches to the Builder,
  and fires the message through the normal send path (orchestrator included) —
  the user lands mid-conversation, not on a prefilled input. Hint line says
  "Starts a fresh chat in the Builder." Preset cards below stay display-only.

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
