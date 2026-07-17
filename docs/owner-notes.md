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
- **Desktop-first, no mobile** (owner, 2026-07-16): "I'm not preparing my app
  to be mobile friendly honestly." Don't build or pitch mobile layout work
  unless the owner re-opens it.

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

- **Voice/audio lane on the landing filmstrip (built + REMOVED twice, 2026-07-13):**
  a third drifting row of playable waveform tiles under the two image/video rows
  on the "Made with isibi" strip. Round 1: compact (186×76) → owner "came out
  very ugly, delete that" → reverted. Round 2: re-added bigger (300×118),
  merged, then owner said "wrong chat, delete the voice thing" → reverted off
  `main` again. **Not a design rejection the 2nd time — it was merged to the
  wrong project/chat.** Fully off `main`. If it's genuinely wanted here later,
  confirm scope with the owner first; the bigger 300×118 version is what they'd
  approved visually.

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

- **Workspace restructure — Builder is home, other views float (2026-07-15):**
  owner: "delete home and all the stuff in it, and builder will be the new home,
  all the other options will be floating logo in the screen for now." Done:
  the old **Home landing** (`viewLanding`/`renderLanding`) and the whole sidebar
  **Workspace nav** (the 6-item Home/Builder/Gallery/Products/Avatar/Media Agent
  list) were removed. The **Builder chatbox** (`viewHome`) is now the home screen
  and the only thing `enterApp` opens. The **sidebar stays slim** — chats only
  (owner picked "Keep slim sidebar for chats"). Gallery/Products/Avatar/Media
  Agent moved to a **floating logo menu, top-right** (owner picked "Top-right"):
  `#floatNav` (a `.float-logo` button under the profile pill) opens `#floatMenu`
  with the 4 `.float-item` links; `toggleFloatMenu`/`closeFloatMenu`, outside-click
  closes, picking a view closes it. `showView('landing')` now redirects to `'home'`
  so nothing that still asks for the old landing breaks (`renderLanding` is dead).
  Gallery's "Newest first" sort + Avatar's Generate/Import buttons got a 52px
  right pad so they clear the fixed float-logo lane.

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

### Video-model schema audit round 3 (2026-07-16) — 2 fixed, 6 catalogued
- **Status:** ✅ fixes shipped; the catalogued items await owner decisions
- **Reported:** 2026-07-16 — owner: "now that we checked the image models, we
  gotta check the video models." Method: fresh fal OpenAPI schema pulled for all
  **29 endpoints** across the 11 video models, diffed against worker wiring +
  chat.js UI + billing (no fal credits spent).
- **Fixed 1 (money):** Seedance's schema `duration` default is **"auto"** (model
  picks the length, up to 15s) — a duration-less submit (tampered client; the
  real UI always sends one) would render up to 15s while billing fell back to
  the 5s base (~3× undercharge, worst case ~$16 at 4K). Worker now pins
  `duration:"5"` whenever none is given, so the render always matches the bill.
  Every other family's schema default already equals its billing base — checked.
- **Fixed 2 (feature):** **Kling multi-shot now works with a start image /
  first-&-last frames.** fal takes `multi_prompt` on Kling's i2v endpoints too
  (the old code comment claimed t2v-only — the fresh schema disproved it). New
  shared `shotsApply()` gate client-side (a clip still disables shots — the o3
  edit endpoint has no multi_prompt), worker gate relaxed to the i2v endpoint,
  director's shotsCapable updated + told the sequence opens on the attached
  frame. Parity bench: all 27 existing + 4 new i2v-shot cases pass.
- **Verified clean:** every model's durations/ratios/resolutions match schema
  exactly (incl. Veo 4s/6s + 4K, Ray 21:9/3:4/4:3, Kling 3–15s, Gemini 3–10s);
  all special billing bases (Veo extend 7s / ref 8s, clip edits on measured
  length, Ray i2s + 5s lock, LipSync per-5s, OmniHuman per-sec, shot sums,
  Seedance vref 0.6×(in+out)); Seedance `generate_audio` confirmed free in
  schema text; prompt caps per family.
- **Round-3b (same day, owner: "add that stuff"): four knobs wired**, all
  director-driven (no new UI), all price-neutral, all riding the existing
  extras rail (sanitizeExtras → body → worker re-validates):
  1. ✅ **Seedance `bitrate_mode:"high"`** (full+fast; mini's schema lacks it) —
     fal's pricing page has NO bitrate dimension (checked 2026-07-16), so it's a
     free bigger-file/higher-quality encode. Director sets it when the user asks
     for max quality / a crisp master.
  2. ✅ **Kling `shot_type:"intelligent"`** — the model auto-directs the cut
     structure; set when the user asks the model to decide the cuts. Suppressed
     next to an explicit shot list and on the o3 edit endpoint.
  3. ✅ **Kling v3 `cfg_scale` 0–1** — prompt-adherence dial ("follow it
     exactly" ~0.8 / "go loose" ~0.2). o3 has no such field — gated off there.
  4. ✅ **Ray v2v per-signal `controls`** (pose/depth/normals/trajectory/face,
     each with its dial) — set when the user says what to keep/free on a clip
     re-render ("keep my face, loosen the camera"). Precedence: controls >
     edit-strength dial > auto_controls (fal rejects combos; exactly one sent).
     `sanitizeRayControls()` shared by /api/direct and /api/video.
  - 20-case functional test on the new sanitizers/gates + full 31-case price
    parity bench: all pass.
- **Round-3c (same day, owner: "pretty sure there are still missing stuff"):
  the owner was right — a CATALOG probe (not just param-diffing endpoints we
  already used) found 12 unwired endpoints; all wired:**
  1. ✅ **Veo 3.1 Fast** — the whole family (t2v/i2v/first-last/reference/
     extend), ~2.7× cheaper than full Veo ($0.15/s audio-on, $0.10 off;
     4k $0.35/$0.30). New picker entry; all generic Veo code paths apply.
  2. ✅ **Kling o3 Standard** — cheaper o3 (t2v/i2v/reference/edit; $0.112/s
     audio-on, $0.084 off, edit $0.126/s). New picker entry.
  3. ✅ **Kling o3 reference-to-video (pro + standard)** — ≤4 reference images
     bound as native **@Image1–4 prompt tags** (Seedance-style), optional
     start/end frames, shot-lists allowed. o3 models now have caps.ref:4; the
     director cites tags (and inside shot prompts); same per-second rate as t2v.
  4. ✅ **OmniHuman v1.5** — $0.16/s, 720p/1080p picker (billed the same),
     optional typed text guides motion/emotion. New picker entry next to v1.
  5. ✅ **Kling LipSync text-to-video** — attach a clip and just TYPE the words
     (no audio upload): Kling voices them itself. Curated 7-voice English picker
     (Narrator default; the schema's other ~39 voices are Chinese — skipped).
     Same per-5s input-clip billing as the audio mode.
  - Parity: 9 new cases + all 31 existing pass. Voice section reuses the audio
    voices UI (labels + preview suppressed for Kling ids).
  - **Probed and confirmed NOT to exist** (so nobody re-hunts): Kling v3
    v2v-edit/elements-endpoint/effects, o3 motion-control, Gemini omni non-flash
    tiers, Seedance pro/first-last/v2v, Ray ref/extend/modify, OmniHuman multi.
  - **Found but NOT wired:** `o3/pro/video-to-video/reference` (re-render a clip
    WITH reference images, $0.168/s output) — its `duration` input is nullable
    with undocumented output-length semantics; billing it blind risks under-
    charging. Needs one cheap live job when the fal balance lands. Clip+refs
    meanwhile still works via the o3 edit endpoint (image_urls).
- **Round-3d (2026-07-16, owner: "Kling elements + bitrate sanity check"):**
  - ✅ **Kling character elements SHIPPED (v1)** — a new **Characters** attach
    row on all four Kling models (o3 pro/std, v3 pro/std): up to 4 characters,
    each ONE frontal image, badged **@Element1–4** with tap-to-cite chips in
    the composer (same rail as @ImageN). Identity holds across the video.
    Routing: o3 + characters (no clip) → reference-to-video (characters and
    style refs can combine, start/end frames ride along) · o3 + clip →
    edit endpoint (fal caps characters+refs at 4 COMBINED — characters get the
    slots first, pre-send guard blocks over-cap) · v3 → i2v only, so a start
    image is REQUIRED (friendly pre-send message points at o3 otherwise).
    Director cites @ElementN (incl. inside shot prompts) and can see the first
    character image. @ElementN tag hygiene mirrors @ImageN (dangling dropped).
    Price-neutral (elements are an input on already-priced endpoints).
    10-case routing/hygiene test + full 40-case parity bench pass.
    **v2 later (if wanted):** per-character angle shots (fal takes 1–3
    `reference_image_urls` per element) — needs a per-slot "+ angles" UI.
  - 🟡 **Seedance bitrate_mode billing** — three independent FREE signals say
    high bitrate is not billed (pricing page has no bitrate dimension; the
    token formula h×w×dur×24/1024 has no bitrate term; web sweep finds zero
    mention). Final 100% = one live job, folded into the fal-balance live sweep.
- **Still NOT wired (deliberate):**
  1. **Veo `seed` + `safety_tolerance` (1–6)** — defaults kept: seed has no
     reproducibility story in the chat flow; safety_tolerance is a policy knob.
  - Seedance "auto" duration as a UI pick: skipped on purpose — can't price an
    unknown output length.

### Model-wide fal input-validation audit (2026-07-14) — most fixed, 2 deferred
- **Status:** ✅ main gaps fixed; two low-risk items intentionally deferred (below)
- **Reported:** 2026-07-14 — after a v2v edit 422'd ~50× (root cause: clip was 15.10s, over Kling's strict **15.05s** cap; our attach check had a 0.5s grace so it slipped through). Owner: "check that now for every model."
- **Where:** every video/image/audio endpoint. Audited each against its live fal OpenAPI schema (`fal.ai/api/openapi/queue/openapi.json?endpoint_id=<id>`).
- **What / Fixed:**
  - Clip duration tolerance now matches fal's exactly (0.05s, was 0.5s) — `CLIP_LIMITS`/`clipIssue` in chat.js.
  - **Veo reference-to-video** locks duration to `"8s"`; we were sending the user's 4/6/8 → 422. Worker now forces `"8s"` for that endpoint.
  - **Audio limits** added (`AUDIO_LIMITS`/`audioIssue`, chat.js): Kling LipSync (.mp3 ≤5MB 2-60s), OmniHuman (≤30s), Seedance ref audio (MP3/WAV ≤15MB ≤15s) — validated at attach + send.
  - **Ray prompt cap** was defaulting to 20000 on t2v/i2v; real cap is 6000 (all `luma/`). Worker clamp fixed.
  - Clips are staged to **fal storage** (hosted URL) before submit (`falUpload`, worker) — data URIs worked for the duration probe, but hosted URLs are universally accepted and keep request bodies small.
  - fal's exact rejection reason is now surfaced in chat (`falErrorDetail`) + auto-refund on any terminal 4xx.
- **Confirmed already-correct:** Kling v3 `start_image_url`; Veo `first_frame_url`/`last_frame_url`; Seedance fast/mini 480p/720p tiers; Ray v2v & Gemini edit have no clip limits; Kling prompt cap 2500.
- **Formerly-deferred items — BUILT 2026-07-14 (owner: "sure do that"):**
  1. **fps auto-conform** — `sbFFProbeFps`/`sbFFFps` (ffmpeg-edit.js) probe the attached clip's real fps via the on-device engine; `normalizeClipFps()` (chat.js) re-encodes out-of-range clips to the nearest bound (e.g. 23.98 → 24 for Kling o3) automatically, free, with a chat note. Runs at attach + on model switch.
  2. **Image dimension checks** — `imgMeta`/`imageAttachIssue()` measure every image slot (image/end/first/last) and bounce Kling-bound images under 300×300 or outside aspect 0.40–2.50 at attach, re-checked on model switch.
  3. Also: image models' min prompt length (nano-banana-pro = 3 chars) guarded in raw mode.

### Pricing audit — fal bills per ENDPOINT, not per model (2026-07-15)
- **Status:** ✅ fixed
- **Reported:** owner noticed the successful Kling o3 v2v edit billed **$2.52** on fal while the app charged 263 credits ($2.10) — the edit endpoint bills $0.168/s, a 20% premium over t2v's $0.14/s. Root cause of the class: price tables keyed rates by MODEL while fal prices each ENDPOINT separately. Swept all 31 endpoints' pricing pages.
- **Fixed (both `VIDEO_USD`/`VIDEO_PRICE` worker+client tables):**
  - Kling o3 v2v edit → own `v2s` rate $0.168/s (15s edit now quotes/charges 315 credits).
  - **Veo extend** outputs a const 7s clip → billed at 7s regardless of the duration picker ($2.80/350 credits, audio-on rate).
  - **Ray i2v** is priced BELOW t2v (5s 720p $0.30 vs $1.00) and 10s is unavailable from a start image → new `i2s` tier + duration forced to 5s (was overcharging ~3×).
  - **Kling LipSync** bills the INPUT VIDEO's seconds rolled up to 5s steps ($0.014/s) — we billed per audio seconds (could undercharge 10×). Now billed from the client-measured clip length (clamped 2–10s; unknown bills the 10s max).
  - **gpt-image-2** is token-billed; High 1024² ≈ $0.211 → flat rate raised $0.12 → $0.22.
  - Seedance per-second nudges: std 720p 0.304 / 1080p 0.682; fast 480p 0.135 / 720p 0.242; mini 480p 0.0725.
- **Verified correct:** Veo tiers (audio-on rates), Ray t2v/v2v + HDR 2×/EXR 3×, Gemini ~0.13/s, Kling t2v/i2v all tiers, nano-banana $0.15 (4K would be 2× — we only render 1K), all ElevenLabs rates.
- **Lesson recorded:** any new model/endpoint must have BOTH its input schema AND its pricing page checked before wiring (they differ per endpoint under the same model name).

### delete_account() can leave orphaned usage_log rows + storage objects (FOR AUDIT)
- **Status:** 🟡 one-time cleanup done 2026-07-14; root fix deferred (owner: "later, just note it for audits")
- **Reported:** 2026-07-14 (owner deleted their `aniascristian@gmail.com` test account and asked to verify)
- **Where:** Postgres `public.delete_account()` — its `delete from usage_log` and the storage clause `owner=uid`; also the client Delete-account flow in `public/chat.js`.
- **What:** Audit after the deletion found the auth user + identity, chats, credits, user_memory, user_plan, video_editor_plan, and all GoTrue child rows (sessions/refresh_tokens/identities) GONE — but **3 `usage_log` rows** and **1 storage object** (`media/test/hello.txt`, owner = the deleted uid `144474c8-bb38-4ffc-a867-d9fb54c31bcd`) were left behind. No `purchases` existed (those are intentionally KEPT as a financial record anyway).
- **Cleanup done:** deleted the 3 usage_log rows; deleted the storage object using the same `storage.allow_delete_query` GUC that `delete_account` uses (direct `DELETE FROM storage.objects` is blocked by the `storage.protect_delete()` trigger). Re-verified: **0 orphans anywhere.**
- **Likely cause:** the account was probably removed OUTSIDE the app's `delete_account()` RPC (e.g. straight from the Supabase dashboard) — cascade FKs then clear chats/credits/etc., but `usage_log` and `storage.objects` don't auto-cascade so they orphan. If instead the app's own "Delete account" button was used and these still leaked, `delete_account()` has a real gap (its usage_log delete + `owner=uid` storage clause should have caught both).
- **Reusable audit (run for any deleted account / general sweep):** for a given uid, or generally, count rows whose owner is NOT in `auth.users` across: `usage_log`, `storage.objects` (bucket `media`, by `owner`), `chats`, `credits`, `user_memory`, `user_plan`, `video_editor_plan`, `auth.sessions`, `auth.refresh_tokens`, `auth.identities`. All should be **0**. (`purchases` orphans are expected/OK.)
- **Fix (deferred, owner said later):** harden `delete_account()` (or add ON DELETE CASCADE / a cleanup trigger) so `usage_log` + `storage.objects` are always cleared regardless of deletion path; optionally a periodic orphan-sweep job.

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

### Model capabilities wired up — @Video refs, Kling shot-lists, Gemini i2v, GPT ratio fix
- **Status:** ✅ shipped
- **Reported:** 2026-07-15 — owner: "add everything a model supports … lock in."
- **What (four things, after auditing every model's live fal schema):**
  1. **Seedance `@Video1` reference** — you can now drop a video clip alongside
     your image refs on Seedance (all 3 tiers) → it rides into reference-to-video
     as `video_urls` (@Video1), a motion/subject reference for a fresh scene. New
     clip slot on Seedance + a `@Video1` composer chip. Priced at t2v rates (a
     reference, not a re-render). Mini also gained reference-to-video (its old
     "no ref endpoint" note was stale — verified on fal).
  2. **Kling `multi_prompt` shot-lists** — Kling o3/v3 t2v can render a CUT
     sequence of distinct shots in one video. Director-driven (AI-native, no new
     knobs): the composer returns a `shots` array [{prompt, duration}] when you
     ask for a montage/multi-beat sequence; the Plan card shows the shot
     breakdown. Billed on the SUM of shot seconds at the model rate (quote ==
     charge, float-verified). Only on pure t2v (nothing attached).
  3. **Gemini image-to-video** — a whole fal endpoint we never wired. Gemini now
     has a start-frame (image) slot → `google/gemini-omni-flash/image-to-video`.
  4. **Bug fix: GPT Image 2 aspect ratio** — it has no `aspect_ratio` field
     (sizes via `image_size`), so a picked ratio was silently dropped and every
     render came out landscape 4:3. Now maps ratio → `image_size` enum.
- **Where:** `worker.js` (routing/billing/compose tool), `public/chat.js` (caps,
  clip/audio limits, chips, shots threading, pricing), `public/styles.css`.
- **Deferred on purpose (need fal cost-deltas or lower value):** `generate_audio`
  toggle (enabling audio where it's OFF by default — e.g. Kling o3 — risks
  undercharging until we verify fal's delta; most models already default audio
  ON, priced in), image quality/resolution tiers (nano-banana 2K/4K, gpt-image-2
  `quality` — price levers, need repricing), Kling "elements" character mode
  (@Element multi-angle consistency — bigger feature), ElevenLabs voice tuning
  (stability/style/speed — no price impact, marginal). All catalogued from the
  per-model schema audit.

### Round-2 audit (owner asked: "check the missing stuff again, check credits too") — 33 confirmed findings, fixed 2026-07-15
- **Status:** ✅ fixed (the fix batch below); rest documented
- **Money bugs found & fixed (quote == charge re-verified, 27-case parity test):**
  1. **Kling o3 was billing audio-ON ($0.14/s) for SILENT renders** — o3's
     `generate_audio` defaults false (every other family: true). Fix: o3 t2v/i2v
     now send `generate_audio:true` — the video you pay for has sound.
  2. **o3/Gemini clip edits billed the duration PICKER; fal bills the CLIP's
     length** (the owner's $2.52 15s edit proved it — we'd charged for 5s).
     Fix: bill the clip's server-measured length (o3 ≤15s; Gemini capped at 30s
     — our product cap, attach-validated).
  3. **Veo reference-to-video always renders 8s but billed the 4/6s pick** —
     fix: bill 8s (both sides).
  4. **Seedance @Video reference pricing** — fal prices video input at 0.6×rate
     over (input+output) seconds; we billed flat t2v × output. Fixed to the
     0.6×(in+out) basis (covers both readings of fal's page; relax later if a
     live job bills less).
  5. **Auto-mode multi-shot could show ✦79 and charge ✦788** — Auto now posts
     "🎬 Multi-shot: N shots · Xs total — ✦YYY" in the chat before billing
     (Plan card was already exact).
  6. **/api/direct kept the fee when the AI call failed** — every terminal
     failure path (fetch error, upstream !ok, no tool output, stream break,
     research come-up-empty) now reverses the fee via a new `credit_back(target,
     amount)` RPC (SECURITY DEFINER, **service_role-only EXECUTE, ≤10 credits
     per call** — worker-authorized only, not client-callable).
  7. **gen_charges insert was fire-and-forget** — a failed insert after a
     dropped reply made a charged render unrecoverable AND unrefundable. Now
     awaited with one retry before responding.
  8. **Compose could truncate a big multi-shot answer** (max_tokens 4000, and
     thinking shares the budget) → user paid, got local fallback. Raised to 8000.
  9. Phantom Seedance-fast 1080p price tier deleted (no such tier on fal).
- **Free upgrades wired:** nano-banana now renders **2K** (same $0.15 as 1K on
  fal — verified; 4K is 2× and stays unwired). Veo `auto_fix:true` normalized on
  all Veo endpoints (i2v defaulted false → content-policy trips failed instead
  of self-healing).
- **Director-driven knobs wired (owner's call: AI sets them, no new UI):**
  - **"silent/no sound"** → `sound:false` → `generate_audio:false` (Seedance/
    Kling/Veo; o3-edit `keep_audio:false`) — AND bills the cheaper audio-off
    tier where fal has one (Veo halves; v3 pro 0.112, v3 std 0.084, o3 0.112).
  - **"no people / avoid text"** → `negative` → `negative_prompt` on Kling v3
    (APPENDED to fal's quality-guard default, never replacing it) and Veo.
  - **"say it slower / more expressive"** → ElevenLabs `speed`/`stability`/
    `style` (v3 model: stability only). Price-neutral.
  - All ride the same pending→review-card→generateMedia lifecycle as shots.
- **Seedance @Video clip band:** fal caps reference clips at ~0.41-0.93MP pixel
  AREA (1280×720 fits; 1080p doesn't). Attach now auto-downscales oversized
  clips on-device for free (`sbFFScale`, same pattern as the fps conform);
  under-480p clips are rejected with the reason.
- **nano-banana full ratio list** (3:2, 2:3, 4:5, 5:4, 21:9 added — per-model
  `IMAGE_RATIOS`; GPT Image 2 keeps its 5 mappable presets).
- **Round-1 wiring re-verified correct** by schema re-fetch: multi_prompt rules
  (prompt omitted when shots sent — v3 requires that), Gemini integer duration,
  GPT image_size enum values, no cross-endpoint leaks (gates proven).
- **Known exposures documented, NOT charged for yet (need one live job each to
  verify):** Kling v3 "voice control" third price tier ($0.196/$0.154 —
  trigger mechanism unknown, possibly dialogue in prompt); whether fal's
  multi-shot total length == sum of shot durations; Gemini /edit regional
  restriction (EEA/CH/UK) possibly binding on the fal account; Seedance
  bitrate_mode. **Add all four to the fal-balance live sweep list.**
- **Deliberately skipped (reasons on file, don't re-flag):** Kling v3
  `cfg_scale` (no reliable user-language signal), Veo `safety_tolerance`
  (moderation dial, platform decision), `seed` (rerun means fresh sample),
  Seedance duration/aspect "auto" (unbillable/low value), nano `sync_mode` +
  `output_format`, Kling **elements** mode (character consistency — real
  feature, deferred to its own pass: needs elements↔image_urls live testing
  and the voice_id half trips the voice-control price tier).

### Post-round-2 free checks (2026-07-15, same day)
- **Supabase security advisors run:** one real WARN actioned — the six dead
  add-on RPCs from the removed Orchestrator/Video-Editor products
  (`orchestrator_status` was ANON-callable) are now **dropped** from the live DB
  (migration `drop_dead_addon_rpcs`; zero code references, verified incl. the
  demo copies). Remaining WARNs are by-design (auth-callable credits/storage
  RPCs; deny-all RLS tables). One recommendation for the owner: enable
  **leaked-password protection** (HaveIBeenPwned check) in Supabase Auth
  settings — one toggle, dashboard or Management API.
- **`sbFFScale` verified headless in a real browser engine:** a 1920×1080 H.264
  clip conformed to 1278×718 (917,604 px — inside Seedance's reference band),
  16:9 preserved, even dims, audio intact, duration intact; output re-probed
  with native ffmpeg. (Headless note: plain Chromium has no H.264 *decoder*, so
  in-browser playback of the result can't be asserted there — real
  Chrome/Safari decode it fine.)
- **Still not live-tested (needs fal credit, owner's go):** the four sweep
  items above + first real runs of multi-shot / @Video ref / Gemini i2v /
  silent-flag billing.

### Gallery no longer loses saved media when a chat is deleted (2026-07-15)
- **Bug the owner hit:** saved a dog image, later deleted the chat it was in,
  and it vanished from the Gallery — but Storage still showed 1.2 MB used.
- **Root cause:** `galleryItems()` rebuilt the whole gallery by scanning
  `chatStore.chats[].msgs[]` for media messages. So a saved file only showed if
  a chat message still pointed at it — delete the chat, lose the card, and the
  file is orphaned in storage (still billed against the quota). "Save to
  gallery" was really just "a media message exists in a chat."
- **Fix:** the Gallery now reads what's ACTUALLY in the caller's storage.
  - New RPC `list_media()` (SECURITY DEFINER, auth-only, mirrors
    `storage_status()`'s `media/<uid>/` prefix scope) → returns each object's
    name/size/created_at.
  - New `GET /api/gallery` → maps rows to `{url, kind (from extension), size,
    at (parsed from the `<ms>-` filename)}`.
  - `galleryItems()` now merges: **storage is authoritative for existence**;
    chat messages only overlay prompt/poster when the originating chat still
    exists. A file whose chat was deleted still shows (no prompt). Falls back to
    the old chat-derived view if `/api/gallery` hasn't loaded / failed.
  - `galleryDelete` still removes the file + chat msg, and now also drops it
    from the storage-list cache. `refreshGallery()` fetches on gallery open.
- **Recovers the owner's dog automatically** (it was always in storage —
  `1216004` bytes, matches the 1.2 MB the bar showed). Also fixes the orphaned-
  storage class of bug for everyone, cross-device.
- Still open (documented, from the round-3 audit, NOT yet fixed): Stripe
  chargeback handling, the auto-reply prompt-injection surface, `delete_account`
  not clearing `gen_charges`, the jobs-record cap, and the CSP nit.

### Images no longer "render again" on every refresh (2026-07-16)
- **Owner's report:** every refresh, images anywhere (chat, gallery, avatars)
  visibly re-render / paint top-down. "Is that normal, or can it just appear
  there."
- **Two causes, both fixed:**
  1. `/api/save` uploaded to Supabase Storage with NO cache-control header →
     the browser re-downloaded every multi-MB original on every refresh.
     Filenames are unique (`<ms>-…`) and files immutable, so uploads now send
     `cache-control: max-age=31536000` — after first view, media comes from
     the browser cache instantly. **Only NEWLY saved files get this** —
     already-uploaded objects keep their old metadata (would need a re-copy
     migration to backfill; not done, old files just stay slower).
  2. Big JPEGs paint top-down while downloading. All saved-media `<img>`s
     (chat `buildMedia`, gallery grid, avatar cards + creator result) now use
     `.img-fade`/`.img-ready`: invisible until fully loaded, then a 0.22s
     fade-in — images appear whole, never half-painted. Plus
     `decoding=async` + `loading=lazy`.
- Headless-verified on all three surfaces (fade class applies, ready fires,
  no page errors). Product thumbs skipped on purpose — they're inline data
  URIs (instant already).

### Avatar page went invisible — CSP vs inline handlers (2026-07-16)
- **Owner's report:** "AVATAR NEVER RENDERED" — blank card where the avatar
  thumbnail should be, right after the fade-in deploy.
- **Root cause (mine):** the avatar fade was wired with an inline
  `onload="..."` attribute. The worker's CSP has NO 'unsafe-inline' for
  scripts, so in production the handler never ran → `.img-fade` stayed at
  opacity 0 forever. The headless test passed because the local test server
  didn't send the CSP header.
- **Fixes:** avatar thumbs + creator result rewired via addEventListener
  (the app's convention); also killed the only other inline handler
  (`onerror="this.remove()"` on Builder preview photos — silently dead under
  CSP too). **Harness lesson, applied:** the fade test server now sends the
  production `script-src` so an inline-handler regression fails locally.

### Gallery delete no longer touches the chat (and vice versa) (2026-07-16)
- **Owner's call:** deleting from the gallery must not remove the chat copy;
  deleting from a chat must not remove the gallery copy (that half already
  worked). Confirm text was literally "Delete this from your gallery and its
  chat?" — no more.
- **Mechanics** (one stored file, reference-counted by location):
  - Gallery delete, file still shown in a chat → new `POST /api/media/unlist`
    MOVES it to `media/<uid>/chat/<file>` (service key — bucket RLS has no
    UPDATE policy; caller's own top-level prefix strictly enforced), client
    rewrites every referencing chat message to the new URL. Still counts
    against the storage cap (the file exists). `/api/gallery` filters
    `<uid>/chat/` out of the listing; the chat-scan fallbacks + picker skip
    chat-only URLs too. If the move fails, nothing is deleted (card comes
    back; a chat message is never left broken).
  - Gallery delete, nothing references it → hard delete (frees space), as before.
  - Chat delete of a chat-only file's LAST reference → hard delete (it's
    invisible everywhere by then). Same sweep when deleting a whole chat.
  - `storageWipeOwn` (account deletion) now also sweeps the `chat/` subfolder.
- **Known edge:** another device whose chat sync hasn't pulled the rewritten
  URL yet can 404 the old URL and self-heal-remove the message before syncing.
  Narrow window; accepted.

### Product scan: pictureless products fixed (2026-07-16)
- **Owner's report:** "PRODUCT IS NOT CACHING IT" — Molly's Suds product card
  saved with a name but the 📦 placeholder. Balance dropped exactly 3 credits
  → it was the AI lookup path (walled Walmart listing).
- **Why images went missing:**
  1. AI path: web_search returns TEXT — Claude's "direct image links" are
     often stale or guessed, so all candidates 403/404'd → name, no image.
  2. Normal path: only ONE extracted image was tried, and stores like Shopify
     burst-throttle (429) a second hit from the same egress right after the
     page fetch → single candidate dies, no picture.
- **Fixes (worker):** `extractProduct` now returns `images` (≤4 deduped
  candidates, priority order); shared `inlineImageDataUri()` helper retries
  once on 429/5xx (1.2s backoff); normal path walks all candidates. AI path:
  `report_product` gains `page_urls` (≤2 alternate product PAGES, brand site
  first, never the blocked store) — when every direct image link fails, the
  worker scans those pages with the normal extractor and inlines from there
  (brand sites rarely wall robots; verified mollyssuds.com serves isibiBot
  fine, image is 80KB). Prompt also tells Claude image URLs must be ones it
  actually SAW, not guessed paths.
- Owner's existing pictureless card: remove + re-run the lookup (or scan the
  brand-site link directly — free path, no wall).

### AI lookup returned the AMAZON LOGO as the product photo (2026-07-16)
- **Owner's screenshot:** Molly's Suds card wearing the Amazon smile logo.
- **Chain of failure:** the new rescue-pages path → Claude offered an
  amazon.com page (despite "never the blocked store") → Amazon 200s its
  captcha wall → extractor's og:image on that page IS the Amazon logo →
  junk filter only covered the last-resort <img> scan, not og:image → logo
  inlined as "the product".
- **Guards added (worker):** `JUNK_IMG_RE` (logo/sprite/icon/captcha/…) now
  filters EVERY candidate — extractor's og/JSON-LD list AND Claude's direct
  links; `WALL_RE` hoisted + applied to rescue pages (skip walled pages
  outright); rescue-page title must share ≥1 real word with the product
  name; hard host blocklist on rescue pages (amazon/walmart/target/bestbuy/
  costco/samsclub/homedepot/lowes) since they all wall robots; prompt now
  names those stores as forbidden page_urls.
- Unit-tested: real Shopify page keeps all 4 candidates; a mock Amazon
  captcha page yields ZERO candidates and trips WALL_RE.

### Orchestrator edited image 1 when told "image 5" + fake transparency (2026-07-16)
- **Owner caught both live.** "EDIT IMAGE 5, TRANSPARENT BACKGROUND" → the
  plan confidently described IMAGE 1's content ("the woman, white tee, cream
  jeans"), and the render came back with a fake grey CHECKERBOARD painted
  into the pixels.
- **Cause 1 (wrong image):** `directorImage()` sent the director ONLY the
  main image — with 5 attached it literally couldn't see 2-5, so any "image
  N" request got planned against image 1 while parroting the user's words.
  Fix: it now sends ALL attached images in panel order (downscaled by count:
  1024px ≤2 imgs / 640px ≤6 / 512px above, ≤14, ~12M char server cap), the
  worker labels each block "Image 1"…"Image N", and ask/compose prompts say
  to LOOK at the named one, never assume the first. Verified headless: 5
  color-coded canvases come through in exact order.
- **Cause 2 (fake transparency):** no model in the lineup can output real
  alpha (checked NBP + GPT Image 2 fal schemas — no background param;
  Gemini-family can't do alpha at all). New TRANSPARENCY LIMIT line in the
  ask + compose/edit prompts: say it's not possible, steer to a clean solid
  white (or user-picked solid) background instead.
- **Proper follow-up (not built):** fal hosts dedicated background-removal
  models (BiRefNet / rembg, ~cents) that return REAL alpha PNGs — wiring one
  as a "remove background" edit path would make this an honest yes. Needs
  the fal balance + owner's go.

### "Codes not sending" — was Sign UP with an existing account (2026-07-16)
- Owner hit Sign Up with an already-registered email → GoTrue's
  anti-enumeration returns 200 + a FAKE user (empty `identities`) and sends
  NO email → the UI went to "check your email" and nothing ever came.
- Verified the pipeline is healthy end-to-end while diagnosing: hook fires,
  send-email function 200s, Go Farther mailer up (401 unauth = alive), and a
  live /otp test invoked the function fine.
- **Fix:** `Auth.signUp` now detects the empty-identities response and throws
  "That account already exists — sign in instead." — shown on the form
  instead of the dead-end code screen. (Server keeps its anti-enumeration;
  this is client-side UX only.)
- NB the send-email hook returns 200 BEFORE the background Go Farther send
  (5s hook deadline) — a mailer failure is invisible to GoTrue by design;
  it lands in the edge function's console logs only.

### Avatars + products now follow the account (2026-07-16)
- **Owner's find:** avatars/products showed on the PC but not the laptop —
  they were localStorage-only ("stored locally for now").
- **Built:** `user_assets` table (avatars jsonb, products jsonb, updated_at;
  RLS own-row select/insert/update; FK cascade → account deletion cleans it).
  Client mirrors the memory sync: saveAvatars/saveProducts → touchAssets →
  debounced pushAssets upsert; pullAssets at boot with whole-object
  last-writer-wins. Images compacted to ≤800px JPEG q.82 before push (small
  ones and hosted URLs pass through untouched; scheme-filtered on pull) — the
  device that created an asset keeps its full-res copy until another device
  edits the collection, so worst case the OTHER device generates from an
  800px product photo.
- Headless-verified: remote row adopted at boot, local edit pushes with
  merge-duplicates, an older remote never clobbers newer local.

### 14-image edit refused by Gemini → director now sends only the images it uses (2026-07-16)
- **Owner's test:** "EDIT IMAGE 10, ADD A WHITE BACKGROUND" with 14 attached →
  the plan targeted image 10 CORRECTLY (numbering fix works), but fal 422'd:
  "Could not generate images with the given prompts and images." $0 charged,
  auto-refund worked. fal request log: "error validating the input", 2.27s.
- **Two causes addressed:**
  1. All 14 images went as inline data URIs — a huge request, and one stray
     attachment (the batch included a Messi photo — real-person content) can
     get the WHOLE render refused by Gemini even when untouched.
  2. New `useImages` field on the compose/revise tool: the director lists the
     panel numbers the prompt actually uses, in reference order; the client
     sends ONLY those (positions in the prompt refer to that selection).
     Worker safety net: >4 images or >5MB inline → stage data URIs on fal
     storage (falUpload, per-image fallback to inline) before submitting.
- Verified headless: useImages [3,1] of three attached → body carries exactly
  3rd-as-main + 1st-as-extra. Retest the 14-image edit live.

### Products feature removed entirely (2026-07-16)
- **Owner's call:** "I DONT THINK PRODUCT SHOULD A THING BRO" — the whole
  Products library is gone: the page/tab, URL scanner + AI lookup, the
  "Generate ad" flow, the Product picker source, and the Home "From product
  URL" preset (it depended on the deleted `/api/product/scan` endpoint).
- **Worker:** `/api/product/scan` route + its helper stack removed
  (extractProduct, safeFetch + SSRF guard, inlineImageDataUri, etc.).
- **Client:** all renderProducts/scan/create code out; `user_assets` sync is
  avatars-only now (`?select=avatars`); the `products` column in `user_assets`
  is orphaned but harmless. `zephyr_products_v1` stays in the wipe lists so
  account deletion / sign-out still clears the legacy key on old devices.
- **Kept on purpose:** `downscaleImage` (avatar import), QR-burn (still fires
  from any URL typed in a message — only the preset's auto-stamp of
  `chat.productUrl` is gone; old chats with a stored productUrl still burn),
  the "Product" preset CATEGORY on Home (pack shot / floating product / macro
  — those are creative presets, not the library), and the `.pr-head`/`.pr-or`/
  `.pr-manual` header CSS (the Avatar page uses that pattern). A new `avUid()`
  replaces the deleted `prUid()` for avatar IDs.

### Gallery import: device files + paste-a-link (2026-07-16)
- **Owner's ask:** "WE NEED TO ADD LIKE AN IMPORT THING IN GALLERY" + "ADD THE
  FETCH THING IN GALLERY" ("same thing we had for product" — the URL box).
- **Built (gallery header, right side):** an ⤒ Import button (device pick,
  multi-file, ≤12 per batch, image/video/audio with 8.5/29/14 MB caps) and an
  import-from-link box with the gradient → go button. Both go through the
  normal `/api/save` gates: no plan → pricing sheet client-side / 402
  server-side, GB cap enforced, magic-byte validation, free-user watermark
  path untouched.
- **Worker:** new `/api/import/fetch` — server-side fetch of the pasted URL
  (the product scanner's SSRF guard + safeFetch resurrected for it); a direct
  media link returns base64+kind, an HTML page gets one hop to its og:image /
  twitter:image / link image_src. `/api/save` gained an audio base64 branch
  (MP3/WAV/OGG/M4A by magic bytes, ≤20M chars) so audio imports work.
- **Found while wiring it: `sbToast` never existed.** Three call sites were
  guarded with `typeof sbToast === 'function'` — the storage-full avatar
  warning and friends have been silently vanishing. Defined it (bottom-center
  glass toast, 5s); import errors use it too.
- Headless-verified: 3-kind batch posts base64 per file, oversized file
  skipped with a toast, 402 stops the batch after one request, cap-0 click
  opens pricing instead of the file picker, link flow pipes fetch→save and
  clears the box, junk input never leaves the page, server errors toast.

### Import-from-link: Walmart fix + the ✦3 AI rescue (2026-07-16)
- **Owner's report:** Walmart link → "no image found on that page" ("FIX THE
  FETCH THING"), then "MAKE SURE YOU CHARGE THE 3 CREDITS PLS".
- **Why it failed:** Walmart's PerimeterX wall returns 200 with a "Robot or
  human?" page — no og:image — and the v1 fetch used a bot-ish UA with only a
  basic og/twitter regex.
- **Fixed (worker, /api/import/fetch):** Chrome UA + Accept-Language on every
  fetch; the product scanner's full extraction stack ported back as
  `pageImageCandidates` (JSON-LD any-@type → og/twitter → microdata → link
  image_src → lazy-load/srcset <img> scan), candidates tried in order with a
  429/5xx retry + page Referer; wall detection checked only AFTER extraction
  comes up empty (v1 checked first and false-positived on Wikipedia, which
  mentions "captcha" in its head scripts).
- **AI rescue (the 3 credits):** when the free path still comes up dry, the
  route auto-falls-back to the product scanner's escape hatch — Sonnet 5 +
  web_search (max 2) identifies the product/subject and returns direct CDN
  image links + up to 2 alternate open pages (brand site first, never the
  big-box walls), each tried through the SSRF guard. ✦3 charged up front,
  refunded on EVERY failure path (lookup fail, no image sticks, oversize,
  wrong type), `scanai` quota 20/day. Clean fetches still charge nothing.
  Response carries `balance`; the client repaints the credit pill. The go
  button now reads "→ ✦3" (worst-case price up front, old product-box style).
- Live-tested extraction: Wikipedia → real image (was false-walled in v1),
  Walmart + IMDb → wall detected, would route to the AI rescue. 11 unit tests
  on pageImageCandidates against the shipped code. NOT live-tested: the paid
  Claude lookup itself (real money — needs an owner test with a Walmart link).

### Gallery audio cards redesigned + scroll-lag fix (2026-07-16)
- **Owner:** "FOR THE AUDIOS … I NEED BETTER DESIGN" + "FEELS KINDA LAGGY
  SCROLLING UP AND DOWN ON THAT PAGE, WHY?"
- **Audio cards:** native `<audio controls>` rows (grey browser chrome, dead
  0:00/0:00) replaced with a custom card — pink→amber equalizer bars that
  dance while playing, gradient round play/pause, seekable progress track,
  tabular time. Playing one card pauses the rest (`buildAudioCard`, gallery
  only for now; the chat's audio messages still use the native player — ask
  before touching those).
- **The lag:** every card on the page stayed fully live — a dozen `<video>`
  elements each holding a decoder + full-res originals painting off-screen.
  Fix: `content-visibility: auto` + `contain-intrinsic-size` on `.g-item`,
  so the browser skips layout/paint/decode for cards outside the viewport.
- Headless-verified: cards render (no native controls), duration paints,
  exclusive playback, content-visibility computed 'auto'. Seek verified
  against a range-serving audio server (Playwright's route stub can't serve
  ranges — Chromium clamps seeks to 0 on it; real Supabase storage serves
  ranges fine).

### Gallery scroll lag round 2: real thumbnails (2026-07-16)
- **Owner:** still "feels slow" scrolling the gallery after content-visibility.
- **Root cause:** the grid was downloading + decoding multi-MB FULL-RES
  originals at ~300px card size (one sampled PNG: 1.6MB, 1179×2556).
- **Fix:** Supabase image transformations are ENABLED on this project
  (verified live) — grid cards now load
  `render/image/public/media/…?width=560&height=350&resize=cover&quality=75&format=webp`
  (same sampled image: 14KB, >100× lighter). Lightbox + downloads still use
  the original file. Any transform error (oversized file, plan change) falls
  back per-image to the original URL. The gallery/avatar picker grid uses the
  same thumbs for display while picking still attaches the original.
- **Billing note:** Supabase counts UNIQUE origin images transformed (cached
  variants are free after the first). Pro plan includes 100 origin
  images/month, then $5 per 1000 — trivial at current volume, keep in mind at
  scale.
- Headless-verified: grid uses render URLs, 400 → per-image fallback to the
  original, videos/data-URIs untouched, lightbox opens the original.

### GPT resolution row locks on auto ratio (2026-07-16)
- **Owner's find:** "when I switch resolutions the price doesn't change, only
  quality" — all their test shots were on `auto` ratio, where the resolution
  picker did NOTHING (no size is sent to OpenAI at auto since a pixel size
  implies a shape; billing is the 1K tier by design, owner's earlier call).
- **Fix:** the RESOLUTION row now dims + blocks clicks while ratio is `auto`,
  with a note ("On auto ratio the model picks the size — billed as 1K.
  Choose a ratio to set resolution"); it unlocks live when a concrete ratio
  is picked. The settings chip also stops showing a size at auto (was
  "auto · high · 4K" — misleading).
- Verified: lock/unlock toggles with ratio picks, price flips ✦29 (auto,
  1K tier) ↔ ✦52 (16:9 · high · 4K), summary chip drops the size at auto.
- Price audit the same session: ALL 264 GPT+Nano combos (ratio × quality ×
  size × 1-4 images) swept through estimatePrice() — every one matches the
  fal sheet; totals are ceil'd once (not per image), same as the worker
  charges.

### GPT 1K resolution removed from the picker (2026-07-16)
- **Owner:** "1K and 2K cost the same — then delete 1K." Correct read: fal
  bills GPT Image 2's 1K and 2K identically (per quality tier), so 1K was a
  strictly-worse pick. The picker is now 2K/4K with 2K the default — same as
  Nano's row.
- Client-only change; the worker still accepts '1K' from stale cached
  clients (same price), and a stale saved per-model gptSize of '1K' falls
  back to 2K on model pick. The settings chip hides the 2K default.

### GPT 'auto' ratio removed (2026-07-16, owner's call)
- "DELETE THE AUTO THING" — asked with the tradeoff spelled out (auto kept a
  source photo's shape on edits; without it a concrete ratio reframes), owner
  chose full removal. GPT's ratio picker is now 1:1 / 16:9 / 9:16 / 4:3 / 3:4,
  default 1:1; every run sends explicit dimensions and bills the real tier.
  **Edits now reframe the source to the picked ratio** — if a user complains
  about portrait photos coming back square, this is why; the fix is picking
  9:16 before editing (or revisiting an edits-keep-shape behavior).
- The auto-only machinery went with it: the resolution-row lock + note
  (lived one deploy, abe4979), and the summary-chip auto guard. A stale saved
  ratio of 'auto' falls back to 1:1; the worker still accepts 'auto' from
  stale clients. Nano keeps its 'auto' (different semantics, no billing
  quirk).

### Manual Sound on/off toggle (2026-07-16)
- **Owner (testing Veo):** "THERE'S NO OPTION TO HAVE AUDIO ON AND OFF" —
  silent renders only existed via the director inferring them from the
  user's words. Added a Sound On/Off section to the settings panel for the
  sound-capable families (SOUND_MODELS_RE = seedance | kling v3/o3 | veo —
  mirrors the worker's gate).
- Off sends `sound:false` (the existing worker path: generate_audio=false +
  the aoff billing rate where fal lists one — Veo, Seedance, Kling v3; o3
  has no discount, just silence). The manual toggle wins over the director's
  inference; the chip shows "· Silent"; per-chat composer state persists it;
  non-capable models never see the toggle and reset it to On.
- Verified: Veo Fast 8s 720p ✦150→✦100 and Veo 4k ✦600→✦400 on toggle, wire
  body carries sound:false, Sora shows no section.

### "Image to image" → "Edit image" (2026-07-16)
- Owner's call: users think in verbs. The single-slot row on GPT + Nano is
  now titled "Edit image" (video mode keeps plain "Image"); the row tooltip,
  the reference-row tooltip's either/or line, and the DIRECTOR's routing
  hint (the reference-images block in the worker) all use the same words.
