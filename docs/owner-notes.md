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

## Direction (2026-07-12): AI-native, Studio retired

- **Vision:** the whole platform is "talk to isibi, it makes/edits." Everything
  is chatbox-driven. Studio (the traditional iMovie editor) was the odd one out.
- **Studio DROPPED (owner: "drop the studio and the video editor thing", chose
  "pure AI, drop it all"):** removed the Studio view, sidebar nav, Studio-only
  topbar/dropdown, all `sb-*`/`studio-*` handlers, and deleted `public/studio.js`
  (~3.4k lines: shot planning, timeline, manual tools, film stitching, free
  on-device trims). **KEPT `public/ffmpeg-edit.js`** — the QR burn depends on it
  (its `sbFF*` helpers). Dead studio CSS in styles.css left in place (harmless;
  sweep later if desired).
- **AI video editing wired into the Builder (done 2026-07-12).** The pattern:
  attach a Video clip to an editing model → the worker routes to that model's
  edit endpoint (`bareEdit` flag suppresses duration/ratio/resolution for the
  prompt+video-only endpoints). Wired + fal-verified endpoints:
  - **Gemini Omni Flash** → `google/gemini-omni-flash/edit` (prompt + video_url;
    conversational swap/relight/stabilize/bg). Regional note: fal blocks editing
    uploaded videos for EEA/Switzerland/UK users.
  - **Kling o3 Pro** → `.../o3/pro/video-to-video/edit` (prompt + video_url +
    optional style `image_urls` ≤4 + keep_audio; elements/shot_type not exposed).
  - **Veo 3.1** → `fal-ai/veo3.1/extend-video` (prompt + video_url; continue/lengthen).
  - **Ray 3.2** video-to-video + **Kling LipSync** already worked.
  Each got `caps.clip:true` + an EDIT/EXTEND tag in the picker. Pricing reuses
  the model's existing per-second rate (edit endpoints belong to models already
  in VIDEO_USD) — PROVISIONAL, verify on the fal sweep. Not-in-roster editors
  still available if wanted: Happy Horse 1.0, Kling o1, VOID (object removal).

## In progress — awaiting owner sign-off (NOT merged to main)

_(empty)_

## Shipped

- **Voice lane on the marketing landing (owner request, 2026-07-13 → merged):**
  the "Made with isibi" filmstrip had two drifting rows (image/video). Added a
  **third line for audio/voice**, Wispr-Flow style — **compact waveform tiles**
  (owner picked compact over wide pills), each with a pink→amber ▶ play button,
  an animated equalizer waveform (isibi `--purple`→`--neon` gradient), and a
  label (voice name · duration). **Playable** (owner picked playable over
  decorative): click a card → its clip plays, one at a time; waveform brightens
  + speeds up while playing/hovering, drifts + pauses-on-hover like the other
  rows. Where: `public/index.html` (`.mkt-vrow`/`#mktVoice` row, 7 static
  cards), `public/styles.css` (`.mkt-vcell`/`.mkt-wave`/`@keyframes mkt-wv`),
  `public/chat.js` (`initVoiceLane()` fills the bars, clones the set for the
  seamless drift, wires click-to-play; called at boot next to
  `initDemoCarousel()`). CSP already allows `media-src 'self'`.
  - **Audio files:** cards point at `/mkt/a1.wav … a3.wav` (cycled across the 7
    cards). Those are **placeholder tones synthesized locally** (Node, zero
    credits — no offline TTS engine here) so the play buttons work now.
    **Real voices just drop in:** replace the files (or point `data-audio` at
    `/mkt/a1.mp3 …`) — one line per card in index.html. Labels are placeholders
    too (edit the `.mkt-vmeta` text).
  - **TODO when owner supplies real clips:** swap the WAVs for real voice
    samples + update the `.mkt-vmeta` labels. Owner may also want a different
    card count (currently 7).

- **Public marketing landing (2026-07-12, redesigned 2026-07-13, owner approved
  "main" 2026-07-13 → merged):** logged-out
  visitors see a marketing page BEFORE the auth gate (owner picked option 1).
  In-page `#marketing` section (no new URLs / Worker routing / Supabase redirect
  changes). Boot: signed-in → `enterApp`; logged-out → `showMarketing()`; CTAs
  (`data-mkt`) → `openAuthFrom()` opens the gate; gate "← Back" (`#authHome`) →
  back to landing. **Design = Morphic style** (owner: "i kinda want it like that
  one" → https://godly.design/site/morphic/): dark cinematic, compact
  left-aligned hero ("Generate the impossible."), filmstrip of output under the
  hero, two-tone section headings (bold white line + muted grey line), model
  ticker, Home-screen replica + 3 captions, preset card rail, six "acts"
  feature grid, Plus/Pro/Max pricing, giant "Your premiere starts tonight."
  close, ghost "isibi" wordmark in the footer — all in isibi's pink→amber.
  **Media slots (owner will supply the images/videos):** drop files at
  `public/mkt/f1.jpg` … `f14.jpg` (filmstrip: row 1 = f1–f7, row 2 = f8–f14,
  16:9, ~600px wide is plenty) and `public/mkt/p1.jpg` … `p8.jpg` (preset
  cards, 16:10). Styled placeholder gradients show until a file lands — no
  code change needed to swap them in. Videos: say the word and specific
  filmstrip cells get wired to `<video>` (files as `/mkt/f{n}.mp4`).

- **Auth is a popup now (owner request, 2026-07-13):** the full-screen sign-in
  page (login-bg video background) is gone. Sign up / sign in open as a centered
  modal OVER the marketing landing (dimmed + blurred backdrop). Closes via ✕
  (top-right, was "← Back"), backdrop click, or Esc — all return to the landing
  (Esc ignored for signed-in users so a mid-session re-auth can't be dismissed).
  Gate hidden by default (inline display:none, like #marketing) so it can't
  flash at boot. login-bg.jpg/.webm/.mp4 files kept in the repo (unused by auth).

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
- **What:** A composer on the Home page (same panel style as the Builder's),
  docked at the BOTTOM (owner: "put it on the bottom" — sticky, pins low on
  short pages, stays in view over a scrolling grid). Typing + Enter/send starts
  a FRESH chat, switches to the Builder, and fires the message through the
  normal send path (orchestrator included) — the user lands mid-conversation.
- **Preset cards re-wired (2026-07-12, supersedes the display-only interim):**
  clicking a card pins it as a removable amber CHIP in the Home chatbox
  (reference: a "3D object generation ×" pill the owner showed) + switches mode
  to the card's kind. The user types just their idea; on send the preset's
  prompt rides along as "Creative direction — follow this preset: …" for the
  director. × unpins; chip clears after send and on view re-render. Sending
  with only a chip (no typed idea) sends the raw preset prompt.
- **Cards fully wired (owner: "actual thing behind the screen", 2026-07-12):**
  every one of the 19 presets is now a real RIG — a director-grade prompt
  (rewritten, ~70-100 words each, craft language + guardrails) PLUS a pinned
  model/ratio/duration/resolution matched to MODELS.md strengths (e.g. UGC
  testimonial → Seedance 2.0 · 9:16 · 10s; Sale announcement → GPT Image 2 ·
  1:1; Floating product → Ray 3.2 · 1:1 · 5s; Epic establishing → Veo 3.1).
  `applyPresetRig()` applies it at send time, validating every value against
  the model's real options so a stale rig can't produce an invalid job.
- **Two new Marketing cards (owner's references, 2026-07-12):**
  (1) **Product Animation** — exploded-view rig: components separate in
  synchronized suspension, camera drifts through, parts reassemble into the
  hero shot (reference: a camera-lens exploded-view card the owner liked).
  (2) **From product URL** (`urlScan: true`) — pin chip, paste a store link,
  send: `lpGo` scans it via the existing `/api/product/scan`, the product's
  image auto-attaches as the start image, its name/price/desc feed the
  director, and the ad preset runs 9:16. Chip shows "Reading the page…"
  during the scan; bad links keep the text and explain in the placeholder.
- **QR burned into product-URL videos (owner request, 2026-07-12):** videos
  generated in a "From product URL" chat get a scannable QR (→ the product
  page) burned into the bottom-right corner BEFORE saving — real pixels, so
  downloads/re-shares carry the link forever. Pipeline: vendored MIT
  `qrcode-generator` (`public/vendor/qrcode.js`, CSP-safe) → `qrPngFor()`
  canvas PNG → `sbFFQr()` in ffmpeg-edit.js (on-device ffmpeg overlay via
  scale2ref at ~22% of video height, same encode args as the caption burner) →
  base64 `/api/save` (Studio-film path, 29 MB cap). `chat.productUrl` marks
  the chat at send; the burn hooks the delivery loop and falls back to the
  normal unburned save on ANY failure (free tier/no storage → temp link, no
  QR — burned copies can't persist without gallery storage). Untested against
  a real render (fal balance) — verify in the sweep.
- **Conversational QR control (owner request, 2026-07-12):** the user can now
  direct the QR in plain chat — "put a qr code from second 3 to 4", "add a QR to
  <url> for the last 3 seconds", "qr at the end", "no qr". `parseQrDirective()`
  (client-side) extracts want/remove, URL (falls back to `chat.productUrl`), and
  a timing window (from-to / last-N / first-N / at-the-end / at-the-start / at-
  second-N, resolved against the clip `duration`), and returns a CLEANED message
  (QR clause + URL stripped) so "qr code" never enters the generation prompt.
  `send()` stashes it on `chat.qr`; the burn step honors it (timed window via
  ffmpeg `enable=between(t,a,b)` in `sbFFQr`), product-URL auto-burn is the
  fallback, `off` suppresses. Model-agnostic (post-process on whatever mp4 fal
  returns — Seedance/Veo/Ray all identical). Want-but-no-URL → asks for the link.
  Parser unit-tested; timed burn verified in ffmpeg only by construction (live
  render pending fal balance).
- **QR position by voice (owner request, 2026-07-12):** the user can also say
  where — "qr top-left", "bottom-left corner", "center". `parseQrDirective`
  returns `pos` (tl/tr/bl/br/c); `sbFFQr` maps it to the overlay x:y (default
  bottom-right). `send()` MERGES a new directive onto the prior `chat.qr` so a
  follow-up tweak ("move it top-left") keeps the earlier url/timing. Matters for
  social: bottom-right collides with Reels/TikTok action buttons, so bottom-left
  or top is the clean spot on 9:16.
- **QR is BURNED CLIENT-SIDE, not by the model or server:** the generation model
  (Seedance/Veo/Ray) never sees "QR" — the instruction is stripped from the
  prompt. The Worker only proxies fal + saves. The QR is stamped in the user's
  BROWSER via on-device ffmpeg (ffmpeg.wasm) after the video returns, then the
  burned copy is uploaded to save. Fully model-agnostic.
- **⚠ Model picks are PROVISIONAL:** owner said (2026-07-12) they will dictate
  the right model per preset later — treat the current assignments as
  placeholders and expect a revision pass when the owner provides their list.

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
