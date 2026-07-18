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

### Website builder — real EDGE FUNCTIONS (Path A, 2026-07-18)
- **Status:** ✅ SHIPPED to main + deployed + live-tested 2026-07-18 (owner said
  "deploy and run test"). Every property verified on production (results below).
- **The decision (why Path A):** the owner wanted the model to build "edge
  functions" like Lovable (describe backend logic in chat → model builds it →
  appears in the Cloud panel → runs live). Walked the owner through the real
  fork: the moment the model writes *arbitrary code*, something has to RUN it,
  and it can't be our Worker (would run with our service key + all-user data).
  Three paths — **A: declared function-specs on the shared backend we already
  own** (≈$0, no per-site infra, nothing to sandbox); **B: a Supabase project
  per site** (true Lovable parity but a compute cost *per published site*, worst
  shape for a product with lots of free sites); **C: Cloudflare Workers for
  Platforms** (multi-tenant, cheap-at-rest, but a ~$25/mo enterprise add-on).
  Owner picked **A** ("do the shared") — and it's not throwaway: the spec layer
  + Cloud UI are exactly what B/C would sit behind later, so a single site can
  graduate to its own house when a paying customer actually needs arbitrary code.
  Scoping brief artifact: https://claude.ai/code/artifact/cf61e9f8-ffdc-4a9e-96f1-0fb1e0db02b9
- **How it works:** the model emits a bounded **function SPEC** (a trigger→steps
  recipe), never code. The generator declares one as
  `<script type="application/isibi-fn" data-name="X">{"steps":[…]}</script>` in
  <head> and calls it from the site JS via `POST /api/site/fn {slug,fn,input}`.
  The Worker interprets the spec against primitives we already own. Actions:
  **read** (a public collection), **save** (to a collection), **fetch** (an
  external HTTPS API, SSRF-guarded via the existing `safeFetch`), **respond**
  (JSON back to the browser). Templating: `{{input.x}}`, `{{steps.<as>.<path>}}`,
  and `{{secret.NAME}}`. **Secret isolation is the safety core:** `{{secret.*}}`
  resolves ONLY inside a fetch request (server-side) — in respond/save it
  collapses to "", so a plaintext key can never be echoed to a visitor or written
  to a public collection (verified with a hostile-respond test). Hard bounds:
  ≤8 steps, ≤2 fetch/run, 8s per network op, 32 KB response reads, plus a
  per-slug in-isolate rate limit. No credit charge (bounded, like /api/site/form).
- **Where:**
  - `worker.js`: `decryptSecret`, the interpreter (`runSiteFunction` +
    `normalizeFnSpec`/`extractSiteFunctions`/`resolveStr`/`loadSiteSecrets`/
    `persistSiteFunctions`/`fnRateOk`), endpoints `POST /api/site/fn` (public
    runtime) + `GET/DELETE /api/site/functions` (owner). Build/revise extract +
    persist declared blocks and STRIP them from the hosted HTML (spec never
    ships publicly). SITE_RULES gained the EDGE FUNCTIONS protocol (+never-fake).
  - `public/chat.js` + `styles.css`: Cloud → **Edge functions** card is live;
    `siteFunctions()` modal lists each function's trigger + step-flow, with delete.
  - Supabase: `site_functions` table (owner-scoped RLS, mirrors `site_secrets`).
    **Also patched `delete_account()`** to clear every `site_*` owner table
    (secrets/collections/functions/submissions/domains/visitor accounts) — those
    were ALL orphaning on account deletion before (pre-existing gap; CLAUDE.md
    says deletion is a full wipe). `published_sites` + `site_hits` + the R2 site
    files are still NOT wiped on deletion — separate follow-up (R2 can't be
    reached from Postgres; needs a Worker/client purge).
- **Live test (2026-07-18, all pass, throwaway data cleaned up after):**
  respond+input templating ✓ · save→read→count (records landed, count flows) ✓ ·
  external fetch from the deployed Worker (GitHub zen, 200) ✓ · **SSRF block** —
  a fetch at the cloud-metadata IP (169.254.169.254) returns status 0 / empty,
  safeFetch refused it ✓ · unknown fn → 404 ✓ · **secret injection** — a real
  vault secret decrypts on the Worker and lands in the outbound header the echo
  service reflects ✓ · **secret isolation** — the same secret returned BLANK when
  a function tried to leak it via respond ✓ · **encrypted at rest**
  (`leaks_plaintext:false`) ✓. Local: 16/16 logic tests + encrypt/decrypt
  round-trip ✓. (Test note: `site_collections.owner_id` has an FK to auth.users,
  so a save only works under a real owner — always true for real functions.)
- **Known v1.1 nits (not blocking):**
  1. Template paths don't span hyphens — `{{steps.h.body.headers.x-secret}}`
     won't resolve a hyphenated JSON key (regex is `[a-zA-Z0-9_.]`). Rare (most
     API fields are snake/camelCase); widen the charset to include `-` when we
     next touch it. Everything non-hyphenated resolves fine.
  2. No pause/enable toggle in the panel yet (delete works; `enabled` flips only
     in the DB). Add a toggle if wanted.
  3. `email` action deliberately not shipped — decide the abuse posture first.
- **Still NOT wiped on account deletion (follow-up):** `published_sites` +
  `site_hits` + the R2 site files. R2 can't be reached from Postgres, so it needs
  a Worker/client purge on delete. The site_* owner tables ARE now wiped.

### Website builder — DETECT & FIX errors (2026-07-18)
- **Status:** ✅ shipped to main + deployed. The Lovable feature the owner
  singled out (image 9: "app detects errors, click fix, it fixes").
- **What:** the live preview now watches the built site for REAL runtime bugs —
  uncaught JS errors + unhandled promise rejections — via an error shim injected
  into the preview blob (`sitePreviewSrc`, preview-ONLY; published pages never
  carry it). The shim `postMessage`s each error to the workspace, which shows a
  red "N issues detected · Fix with AI · ×" chip at the bottom-left of the
  preview. One click sends the exact error messages through the normal revise
  flow ("find the root cause and fix it, changing as little else as possible"),
  so it snapshots history + swaps the page like any edit. Errors reset on every
  page (re)load; the badge repaints in place (never re-renders the iframe, which
  would re-trigger). Charge = a normal revise.
- **Where:** `public/chat.js` (`sitePreviewErrs`/`collectPreviewErr`/
  `paintPreviewErrBadge`, the errShim in `sitePreviewSrc`, the message listener,
  the `#stFixBar` markup + handlers), `public/styles.css` (`.st-fixbar`).
- **Low false-positive by design:** generated sites load no external scripts
  (SITE_RULES bans CDN JS) and maps are nested iframes (their errors don't bubble
  to the preview's onerror), so essentially every caught error is a real bug in
  the site's own inline JS. Verified end-to-end headless: a page calling an
  undefined function on load → error caught through the sandboxed cross-origin
  iframe → badge appears "1 issue detected".
- **Distinct from `siteErr`:** that card is for a GENERATION failure (the build
  call itself broke). This chip is for a successfully-built page that misbehaves.
- **Blank-preview follow-up (2026-07-18, owner hit it live):** owner built a
  real-estate site; the **thumbnail rendered fine but the workspace preview was
  black**. Root cause: the card thumbnail uses `srcdoc sandbox=""` (scripts OFF)
  so it shows the raw HTML; the main preview runs scripts, and the site's own JS
  hid all content on load (scroll-reveal) then broke → black. Two fixes shipped:
  (1) **generator never-blank rule** in SITE_RULES — content MUST render with CSS
  alone, JS enhancement only, animations degrade to visible, try/catch around
  risky JS (fixes NEW builds). (2) **blank-detection in the preview shim** — after
  load it checks whether anything is actually visible in the viewport (via
  `Element.checkVisibility({opacityProperty})`, which sees through ancestor
  opacity); if the DOM has content but nothing shows, it reports a synthetic
  "page renders blank" so the Fix chip appears even when no error was thrown.
  Verified headless: fires on wrapper-hidden pages + throws; no false positives
  on healthy or dark-hero designs. Existing sites built before this need a
  refresh + Fix chip (or a revise) since the rule only governs new builds.

### Website builder — function TRIGGERS: webhook + scheduled (2026-07-18)
- **Status:** ✅ shipped to main + deployed + live-tested. Owner picked this from
  the "more technical, like edge functions" backlog.
- **What:** edge functions gained two triggers beyond the site's own JS calling
  `/api/site/fn`:
  1. **Webhook** — `POST https://isibi.ai/api/site/hook/<slug>/<name>`; the
     ENTIRE POST body becomes the function's `input` (so Stripe/Zapier/etc. post
     their native payload). Shares the load+run path with `/api/site/fn`
     (`invokeSiteFunctionByName`). Same bounds + per-slug rate limit. The Cloud →
     Edge functions panel shows each function's copyable webhook URL.
  2. **Scheduled** — spec `"schedule":{"everyMinutes":N}` (clamped 5…43200). Runs
     on the EXISTING 2-min cron (`scheduled()` → `runScheduledSiteFunctions`),
     input `{scheduled:true}`. `schedule_minutes` + `last_run` columns on
     site_functions; last_run is stamped BEFORE running so a slow job can't
     double-fire; a 30s grace keeps a 2-min tick from skipping an hourly job.
     Panel shows an amber Hourly/Daily/Every-Nm badge.
- **Where:** worker.js (`invokeSiteFunctionByName`, `runScheduledSiteFunctions`,
  the `/api/site/hook/` route, `scheduled()` hook, normalizeFnSpec schedule
  parse, persist writes schedule_minutes, functions GET returns it, SITE_RULES
  TRIGGERS paragraph), chat.js/styles.css (`fn-sch` badge + `fn-hook` URL row +
  copy). Migration `site_functions_scheduling`.
- **Live test (throwaway data, cleaned up):** webhook — POSTed
  `{event:"payment.succeeded",data:{amount:4999}}` → function got it, nested
  `{{input.data.amount}}` resolved to 4999 ✓; unknown fn → 404 ✓. Scheduled —
  a 5-min function fired on the real cron (`cron_runs:1`, `last_run` stamped),
  did not double-fire ✓.
- **Next backlog (owner's picks):** FILE UPLOADS (visitor uploads → R2 →
  collection URL) is the next build. Queryable DB was DECLINED for now — the
  model does client-side filter/sort/search in the site's own JS for typical
  sites (<100 records); only build server-side query if a collection outgrows
  the 100-record fetch cap.

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

### Veo's clip row renamed "Extend clip" (2026-07-16)
- Owner's call. Per-model title via #titleClip (like titleImage): /veo/ →
  "Extend clip"; every other family keeps "Video clip" — on Ray / Kling o3 /
  Gemini the same row means EDIT the clip, and on Seedance it's a motion
  reference, so a global rename would have lied there.

### Video-mode "Image" row renamed "Image to video" (2026-07-16)
- Owner's call, same naming sweep as Edit image / Extend clip. Image mode
  keeps "Edit image".

### Veo attach rows fully exclusive (2026-07-16)
- **Owner:** "the 4 of them can't be activated at the same time" — right in
  spirit, but the UI allowed staging several and the worker's routing
  silently ignored the losers (refs > extend > first/last > image).
- **Enforced, Veo only:** the clip now joins the existing image/flf/ref
  exclusivity web in BOTH directions (attach a clip → the other rows clear;
  attach anything else → the staged clip clears). Other families keep their
  legitimate combos: Ray v2v + start image/keyframes, Kling o3 edit +
  refs/elements, Seedance clip-as-reference.
- Verified headless in all directions + Ray combo intact.

### Veo extend caps fixed against the live schema (2026-07-16)
- Checked every Veo cap against fal's OpenAPI schemas: durations (4s/6s/8s),
  resolutions, ratios, ref 8s lock, extend 7s output — all matched. Two
  fixes from the sweep:
  1. Extend INPUT cap was 8s, which blocked re-extending an already-extended
     video. fal allows extending up to 30s total → input cap is now 23s
     (30 − the fixed 7s output). Billing unchanged (extends bill 7s output).
  2. New aspect pre-check on extend inputs: the schema requires a 16:9 or
     9:16 clip; a square clip used to die at fal after the wait+refund, now
     it's bounced at attach with the reason (5% tolerance for encoder
     rounding like 1920×1088).

### Exact errors surfaced to users (2026-07-16)
- **Owner:** "make sure you show users the exact error." Two paths were
  swallowing detail (the 422-rejection path already quoted fal verbatim):
  1. Submit-time failures (friendlyFail) bucketed everything into canned
     lines with the raw error console-only → now the friendly line carries
     fal's exact detail appended: … (exact error: "duration: must be one of
     4s, 6s, 8s"). Quota/balance/unknown-model lines stay clean (no useful
     upstream detail there).
  2. Mid-render FAILED/ERROR showed a generic "couldn't finish" → the client
     now fetches the failed job's response payload and quotes fal's reason:
     ⚠️ The model couldn't finish — exact error: "…" + the refund note.
- Verified headless on both paths (validation detail + a FAILED render with
  a codec error), refunds intact.

### Attached clips show a real thumbnail (2026-07-16)
- **Owner (Veo test #1):** the Extend clip slot showed a generic "🎬 clip"
  chip. Now readClipMeta captures the clip's first frame (seek → canvas →
  jpeg) after validation passes and the slot renders it full-width like the
  image slots, with a small 🎬+duration tag (duration hidden when the file
  doesn't report one — recorded webms often don't). The <video> src is
  released only after capture (it used to be cleared before, which would
  have blocked seeking). Chip stays as the placeholder while capturing.
- CSS: clip slot joined the 190px thumbnail group; its fixed 96px chip-era
  height became min-height so the card grows around the frame.

### Staged attachments survive refresh (2026-07-16, every model)
- **Owner:** "when I refresh the page it loses the attached stuff."
  stagedByChat was in-memory only (the old comment said "too big for
  localStorage" — a clip data URI can be 25MB+).
- **Built:** each chat's staged snapshot mirrors into IndexedDB
  (zephyr_staged_v1): written debounced 400ms from a one-time wrap around
  the attach renderers (renderAttach/ExtraImages/RefList/ElList/KfList/
  MaskState — so every attach, clear, exclusivity eviction, and thumbnail
  capture persists), hydrated at boot (enterApp) and on chat switch, row
  deleted when a send consumes the inputs / the chat is deleted / snapshot
  empties, whole DB cleared on sign-out and account-switch wipes.
- Covers ALL slots: image/avatar/audio/clip (incl. the new thumbnail +
  clipMeta), first/last, refs, elements, keyframes, inpaint mask, extras,
  and the audio waveform state.
- Verified headless: stage → reload → restored (counter intact); clear →
  reload → stays empty.

### Staged stashes expire after 7 days + boot GC (2026-07-16)
- Follow-up hardening on the refresh persistence (owner's go-ahead): every
  persisted stash is timestamped; hydrate refuses (and deletes) anything
  older than 7 days so a weeks-old forgotten photo can never silently ride
  along on — and re-route — a fresh send. A boot sweep also garbage-collects
  expired rows and rows whose chat no longer exists, so forgotten 25MB clips
  don't sit in the browser forever.

### Wordmark → back to the landing page (2026-07-16)
- Owner's ask: the top-left isibi logo now returns to the marketing landing
  in its signed-in form (goLanding → enterLandingAuthed + showMarketing):
  profile pill stays live top-right, the landing chatbox re-enters the
  studio, and the app keeps all its state behind the inert shell (verified:
  staged refs survive the round-trip). Previously the logo just went to the
  Builder view.

### Landing loops resume on wordmark return (2026-07-16)
- Owner: "the moving frames are not moving" when returning via the logo — the
  browser pauses the landing's autoplay video loops while it's hidden and
  never resumes them (only a fresh load autoplays). showMarketing now
  re-kicks any paused video in the landing on every show. Same page as
  always — it just looked like a new static one because of the frozen loops.

## ═══ SESSION RECAP: image-model testing → Veo testing (2026-07-16/17) ═══
One-place index of the stretch from the GPT/Nano settings testing through
the Veo live-test prep. Detailed entries for each item are above; commit
hashes for archaeology.

**Image models (GPT Image 2 + Nano Banana Pro):**
- Price audit: owner's 8 Nano + GPT screenshots verified, then ALL 264
  ratio×quality×size×count combos swept through estimatePrice() — all match
  fal's sheet; totals ceil'd once, same as the worker charges. (no code)
- GPT resolution row locked while ratio=auto with a note (abe4979) — then
  superseded by the next two:
- 1K deleted from the GPT picker (fal bills 1K/2K identically → strictly
  worse; 2K default now) (bffc52c)
- 'auto' ratio deleted from GPT (asked with the edits-reframe tradeoff
  spelled out; picker is 1:1/16:9/9:16/4:3/3:4, default 1:1; every run
  sends explicit dims and bills the real tier) (fdad16f)
- Charge audit: worker's real creditCost extracted and compared to the UI
  quote on all 120 GPT combos + a captured wire body — identical; tamper
  edges (bad quality/size/num, stale auto) all fail safe. (no code)
- Renamed "Image to image" → "Edit image" (row, tooltips, director wording)
  (03c68ca)

**Veo 3.1 + 3.1 Fast prep:**
- Full price table built + verified against fal's LIVE pages (720p/1080p
  same bracket, 4k up; audio-off discounts; margins: ~36% membership /
  ~43% top-up per credit after the $0.008 fal basis). All 216 UI combos
  (model×ratio×res×dur×sound×path incl. the 8s ref lock and 7s extend
  lock) match the worker's charge. (no code)
- Manual Sound On/Off toggle for Veo/Seedance/Kling v3+o3 — Off bills fal's
  audio-off rate, chip shows "Silent", manual beats director (08ee13d)
- "Extend clip" rename (Veo only — Ray/o3/Gemini keep "Video clip", theirs
  means edit) (353917c); "Image to video" rename in video mode (6368eaa)
- Veo's 4 attach rows made strictly mutually exclusive, both directions;
  other families keep their real combos (3686612)
- Extend caps fixed vs the live OpenAPI schema: input cap 8s→23s (chained
  extends up to fal's 30s ceiling now work), plus an instant 16:9|9:16
  aspect pre-check at attach (1597313)
- Exact fal errors now shown to users on EVERY failure path (submit-time,
  mid-render FAILED, 422 rejects) with refund notes (8fcf044)

**In-app fixes found while testing:**
- Clip attach slot shows the video's real first frame + duration tag
  instead of a generic chip (18240ce)
- Staged attachments survive page refresh — IndexedDB per chat, all slots
  on all models (2c93346); hardened with 7-day expiry + boot GC so a stale
  stash never ambushes a send and clips don't hoard disk (93d97cf)
- Wordmark → the signed-in landing page (same page as post-signin, no new
  page) (6c6ecd6); landing's autoplay loops resume on return (62578e6)

**Live Veo tests:** A1 exclusivity ✓ · A2 square-clip aspect bounce ✓ ·
next: A3 free price-flips, then B4 (first paid run, ✦50) onward per the
checklist in the chat.

### Veo duration picker locks on fixed-length runs (2026-07-17)
- **Owner (test A3):** with a reference attached the duration snapped to 8s
  but the picker still let you choose other seconds while the price
  (rightly) never moved — billing was already fixed at 8s on both sides,
  the picker was just lying. Same latent issue on extend (+7s fixed).
- **Fix:** with refs or an extend clip staged on Veo the Duration chips dim
  + go inert with a note ("Reference runs always render 8s…" / "Extending
  always adds 7s…"); refs snap the value to 8s, extend's summary chip reads
  "+7s"; clicks are ignored while locked (pickSetting guard). Unlocks the
  moment the attachment clears; synced from updateSendPrice so every
  attach/model change re-evaluates. Seedance refs stay unlocked (no fixed
  length there).

### @Image chips become a mention picker (2026-07-17)
- **Owner:** the @Image1 chip bar auto-appeared in the composer the moment a
  reference was attached — "don't make it appear… only when I go @".
- Now it's mention-style: hidden by default; typing an @token in the prompt
  (input/keyup/click/focus all re-evaluate the caret) pops the staged
  refs/elements/@Video1 as chips; clicking one REPLACES the partial "@im…"
  with the full tag plus a trailing space (which also closes the picker);
  typing @ again reopens it. The @ImageN badges on the attach-panel
  thumbnails stay — they're how you know which number is which.

### fal balance pre-flight + honest queue status (2026-07-17)
- **Found live by the owner:** fal balance went NEGATIVE mid-testing; fal
  still ACCEPTED the image-to-video job and left it queued forever — the
  user gets charged isibi credits for a render that never runs.
- **Worker:** new falBalanceUSD() (official Platform API: GET
  api.fal.ai/v1/account/billing, cached 60s/isolate). Every generation
  submit now pre-flights it: balance < $0.50 → 503 "generations are briefly
  paused… (you were not charged)" BEFORE any charge. Fails open on unknown
  (endpoint down or FAL_KEY not admin-scoped) so monitoring can never block
  paying users. NOTE: if FAL_KEY lacks billing scope the gate silently does
  nothing — verify while the balance is negative: a submit should bounce
  instantly with the paused message; if it queues instead, mint an
  admin-scoped key.
- **Client:** friendlyFail maps the 503 to a clean no-charge message, and a
  job stuck IN_QUEUE >2.5min swaps the eternal "#0…" for an honest "Still
  queued on fal — unusually backed up… you'll see the exact error and get
  your credits back."
- The stuck job from the discovery: it stays resumable (boot-resume record);
  once fal is topped up it should finish and deliver, or fail with the
  exact error + refund.

### Balance-gate message reworded (2026-07-17)
- Owner's wording call: the pre-flight refusal now reads "Our generation
  servers are temporarily down — we're working on it. Check back soon; you
  were not charged." (server + client matched; old "briefly paused" text
  still recognized by the client for cache-skew).

### Error-message audit + no more silent render loss (2026-07-17)
- Full sweep of every user-facing failure message (catalog in the chat log).
  One red finding fixed immediately, per the owner's "renders can't get
  paused": boot-resume used to DROP a job record after 4 failed re-attach
  attempts — a paid render vanishing silently. finishDeadJob now resolves
  terminally: fal says COMPLETED → delivery retried each boot until it
  lands; otherwise → requestRefund (server re-verifies with fal) + a chat
  message with the refund amount, or an apology when fal actually ran it.
- Clarified: fal never pauses renders — "paused" was only ever our tab's
  polling; this closes the one path where re-attaching gave up.
- Remaining smaller gaps (queued): refund-failure goes unmentioned in the
  failure message; voice-preview errors are silent; gallery-delete failures
  silently restore the card; sync failures have no persistent-breakage
  signal; avatar-gen timeout path unverified; attach errors mix alert()/
  chat/toast styles.

### fal never appears in user-facing text (2026-07-17, owner's rule)
- Standing rule going forward: users must never learn we run on fal.
- Rewrote the six messages that named it (render no longer available /
  keeps going "on our servers" / still queued / timed out / "The model
  rejected this render" / balance-exhausted now reads as the servers-down
  notice), and every quoted exact-error is scrubbed first: provider URLs
  removed, standalone fal tokens → "the render service" (word-boundary
  safe — false/falcon survive).
- Known residual (not user-visible in the UI, only devtools): the network
  tab shows queue.fal.run inside /api/video/poll?url=… params. Hiding that
  needs worker-side request-id mapping — flagged as optional hardening.

### Safari blank video cards fixed (2026-07-17)
- **Owner:** some gallery items only render when the mouse passes over them.
  Cause: Safari doesn't PAINT a metadata-loaded video's first frame until a
  decode is forced — our hover-play was the force, so poster-less video
  cards sat blank until hover. Images were fine (thumbnails).
- Fix: on loadedmetadata, seek 1ms in (the standard Safari nudge) — forces
  the first frame to paint without playing. Applied to gallery cards
  (poster-less only) and chat-thread players. Note: headless verify clamps
  the seek to 0 because route stubs can't serve byte ranges — real storage
  does (proved earlier with the audio-card seek against a range server).

## 📋 AUDIT LIST (owner-flagged, DO LATER — not yet built)
- ~~Attach pickers must ALL offer both sources~~ — ✅ BUILT 2026-07-17 (see
  entry below). Original note: in video mode
  the pickers (Reference to video, Extend clip, First & last frame, image
  slot, characters/keyframes…) go STRAIGHT to the device file dialog — no
  "isibi gallery / Your device" source menu like image mode's Edit-image/
  Reference rows have (openImgSrc). Owner: "make sure for every picker it
  asks for both — check every single model." Sweep EVERY attach slot on
  EVERY model (13 video + 2 image + audio): each should open the source
  chooser (gallery + device; avatar where it makes sense; kind-filtered —
  video slots list gallery VIDEOS, audio slots gallery audio). Videos in
  the gallery picker will need video thumbnails in the grid.
- (Also queued from the error-message audit: refund-failure unmentioned;
  voice-preview fails silent; gallery-delete failure silently restores the
  card; persistent sync breakage has no signal; avatar-gen timeout path
  unverified; attach errors mix alert()/chat/toast styles.)

### AI error-explainer leaked fal (2026-07-17, caught live by the owner)
- The orchestrator's error step wrote "You've hit your balance limit on Fal
  — head to fal.ai/dashboard/billing…" straight into a user chat. The
  provider scrub covered canned messages + quoted errors but not the
  AI-written explanation.
- Fixed both ends: the error step's system prompt now forbids naming any
  backend provider or pointing to external dashboards (balance problems =
  "generations are briefly paused, check back soon"), AND the client scrubs
  the explainer's reply through scrubProvider before display.
- Context of the failure itself: a submit was rejected for balance right
  after the top-up — if it recurs with balance present, check fal's
  dashboard for a separate SPENDING-LIMIT setting.

### Video references: director now sees (and uses) ALL of them (2026-07-17)
- **Owner's E11 test:** 3 refs attached on Veo Fast, open prompt → the
  composed prompt described ONLY the truck. Cause: in video mode
  directorImage() sent just refList[0] (the "start image" slot logic), so
  the director literally couldn't see refs 2-3; all 3 still went to fal but
  a prompt that never cites a ref gives it ~no influence.
- **Fix (mirrors the image-mode default-to-all rule):**
  - Client: reference runs send EVERY ref (≤9, downscaled) + imageCount.
  - Worker: imageCount accepted for video; new video multiImgLine — labels
    Image 1..N, LOOK at each, write ONE scene citing @Image1…@ImageN, USE
    EVERY reference unless the user's own words exclude one; ask-step +
    context lines updated (no more "a start image" claim on ref runs).
  - Existing plumbing handles the rest: @ImageN tags bind natively on
    Seedance/Kling o3 and translate to "reference image N" for Veo.
- Verified headless: compose wire carries images[3] + imageCount 3, kind
  video. Owner should re-run the 3-ref test live after deploy.

### Universal source chooser on every attach slot (2026-07-17)
- **Owner (hit it live during Veo testing):** video-mode pickers went
  straight to the device dialog. Now EVERY media slot (image-to-video,
  end frame, first/last, references, characters, keyframes, extend clip,
  audio — every model) opens the source menu: isibi gallery + Your device,
  with Avatar added on image slots when avatars exist.
- Kind-aware library: the clip slot lists gallery VIDEOS (video tiles with
  the first-frame nudge), audio slots list gallery AUDIO (♪ tiles), image
  slots the image thumbnails. Multi-slots (refs/characters/keyframes) get
  the multi-select Add bar capped at the remaining room.
- A gallery pick is fetched into a File and pushed through the SAME hidden-
  input change path as a device pick — so every existing validation (size
  caps, magic bytes, Veo exclusivity, clip thumbnail + fps conform, billing
  measurement) applies identically. Gallery-header ⤒ Import stays a direct
  dialog on purpose.
- Verified headless: ref slot multi-picks 2 gallery images through the full
  conform pipeline; clip slot lists video tiles; menus per slot correct.

### Platform errors can no longer be blamed on the user (2026-07-17)
- **Owner's screenshot:** a render failed and the chat said "Your account
  has run out of credits" — while the owner had ✦867. The raw failure was
  the render provider's OWN balance lock (see below); the AI error-explainer
  saw the word "balance" and invented a story about the USER's credits.
- **Fix, two layers:**
  - chat.js: known platform-side errors (briefly paused / servers
    temporarily down / exhausted balance / user is locked) now BYPASS the
    AI explainer entirely and get the deterministic friendlyFail message
    ("our render servers…", never "your account").
  - worker.js error-step prompt: explicitly forbidden from claiming the
    user's account/credits/balance ran out unless the raw error literally
    says "not enough credits" — platform balance problems are OUR
    infrastructure, not the user's.
- **Root cause of the failure itself (owner asked "I have $8 in fal, so
  what happened?"):** the provider LOCKS an account whose balance goes
  negative, and there's a KNOWN BUG where the lock doesn't always auto-clear
  after topping back up (fal-ai/fal issue #922 — "Account locked despite
  positive balance"). Our balance went negative during testing, was
  recharged to $8, but the lock lingered and a submit bounced with
  "User is locked. Reason: Exhausted balance." It usually clears on its
  own shortly; if it sticks, fal support has to release it manually.
- Verified headless: platform-flavored job errors never call /api/direct
  (explainer skipped), the delivered chat message is the canned
  servers-down text with no provider name.

### Director flow survives chat switches (2026-07-17)
- **Owner hit it live:** attached a clip for extend, orchestrator started
  "writing the prompt", they switched chats — and the flow died silently.
  Every stage of the director pipeline had a "user left, stop here" guard
  that THREW AWAY the finished work.
- **Fix:** the pipeline snapshots the origin chat's composer state (kind,
  attachments, context, last prompt) before its first AI call and keeps
  going in the background on that snapshot. If the user is still away when
  the prompt is finished, it's persisted into the ORIGIN chat as an
  approval card — switching back shows it priced and ready to run. This
  applies in BOTH Plan and Auto mode: Auto deliberately does NOT fire a
  billed generation while another chat's composer state is live on screen;
  the card is the safe landing.
- Typing indicators only ever show in the origin thread; nothing pops into
  the chat the user switched to. Rerun/revise follow-ups still require
  staying on the chat (they anchor to its live last-prompt).
- Verified headless both ways: switch-away mid-compose → review card
  persisted + renders on return, no generation fired, other chat clean;
  stay-put in Auto → generates immediately as before.

### Chatbox settings are authoritative — director's sound override removed (2026-07-17)
- **Owner rule (stated while planning the G14 test):** "the orchestrator has
  no power to change anything that's set on the chatbox." Generations run
  with exactly what the chatbox shows — sound toggle, duration, resolution,
  ratio — the director's words never silently change a setting (or a price).
- Sound was the ONE chatbox setting the director could override (an
  earlier design: "make it silent" in words → extras.sound=false → cheaper
  render without touching the toggle). Removed on all three layers:
  client ignores a director sound flag (sanitizeExtras strips it, including
  from review cards saved before the rule), the gen request only ever
  carries the toggle's value, and the worker's write_prompt tool no longer
  even offers the model a sound field.
- Instead the ASK step now tells the user: silent video = flip the Sound
  switch in the settings (and that it costs less) — then proceeds with the
  creative request. The director advises about settings; it never drives them.
- Everything else in extras stays director-drivable on purpose — negative
  prompt, Kling cfg/auto-cuts, Seedance bitrate, Ray controls, voice
  delivery — none of those have chatbox controls and all are price-neutral.
- Verified headless: compose returning sound:false → price quote unchanged
  and job body carries no sound flag (toggle on) / sound:false (toggle off).

### Content-filter rejections: auto-reword offer + filter-aware composer (2026-07-17)
- **Owner's 4 AM tentacle saga:** Veo 422'd the "guy with tentacles falls"
  extend three times, even after the composer softened the wording. Two
  real gaps + one hard lesson:
  - Gap 1: the auto-reword (error step's fixedPrompt) only ran on SUBMIT
    failures — a rejection on the poll/result path (where content-filter
    422s actually land) showed the canned message and stopped. Now those
    paths call offerReword(): after the deterministic message (exact error
    + refund, unchanged), the director quietly rewords the prompt and an
    approval card lands in the origin chat — "approve to try again".
    Applied on both the FAILED-status and 4xx-result paths, video+image,
    only when the error is content-filter-flavored.
  - Gap 2: the COMPOSER was writing filter-bait ("grotesque… wet, slimy…
    grafted"). The video prompt-writer now has a craft rule: strict content
    checkers reject whole renders on trigger words — phrase visceral/impact
    ideas neutrally or comedically.
  - The lesson: on an EXTEND, the checker also scans the SOURCE CLIP's
    frames. The tentacle-man clip itself is what kept tripping it — no
    wording passes. That's a provider-side hard block, not an app bug;
    the refunds fired correctly every time (3 × ✦132 back).
- Verified headless: 422-with-checker-detail on the result path → exact-
  error message + refund note, then the reword lead-in + approval card
  (persisted + rendered), error step called once.

### Extends get their own continuation writer (2026-07-17)
- **Owner's screenshot:** an approved extend prompt re-narrated the ENTIRE
  source clip (the tentacle grafting, the slide, the landing — all footage
  that already exists) and closed with "for the 8s clip" on a +7s extend.
  Result quality was "a little buggy" — re-describing makes the model try
  to REPLAY events that already happened, which is exactly what glitchy,
  morphing extensions look like.
- Cause: the worker had no extend writer — a Veo clip attach fell into the
  video-to-video EDIT branch (restyle language, "state the change to the
  footage"), and the ask/context lines called it an edit with
  "clip length: 8s" from the duration picker.
- Fix (worker, new `veoExtend` split alongside `clipIsSeedanceRef`):
  - Dedicated continuation-writer compose branch: describe ONLY the new 7
    seconds, open from the final frame's exact state, 1-2 new beats, same
    tone/camera/style unless the user changes them, never re-narrate the
    clip, never state a total length; content-checker-safe phrasing.
  - Context lines: "this run EXTENDS the attached clip by a fixed 7
    seconds" replaces "clip length: Ns"; ask step describes the clip as an
    extend (+7s), not an edit; revise's overstuffed-fix says "7s extension".
- Kling o3 / Ray clip edits keep the edit writer; Seedance @Video1 keeps
  the reference writer — this only splits Veo extends out.

### Veo 3.1 Lite added (2026-07-17)
- Owner spotted fal's new budget tier and asked for it. Third Veo variant in
  the group flyout: "Veo 3.1 Lite · Google · cheapest · audio".
- Schema-verified: ONLY t2v + i2v endpoints (no extend / first-&-last /
  reference rows), 4/6/8s, 720p/1080p (no 4k), 16:9|9:16, generate_audio.
- Pricing (verified verbatim on fal's page): 720p $0.05/s sound · $0.03
  silent; 1080p $0.08/s · $0.05 silent. UNLIKE Standard/Fast, 1080p costs
  more than 720p — the resolution picker moves the price on this tier.
  Credits at 8s: ✦50 (720p) / ✦30 silent / ✦80 (1080p) / ✦50 silent.
- Verified headless: in the Veo flyout, all four price points, res list has
  no 4k, only the Image-to-video attach row renders. Untested live (pennies
  when the owner wants: one ✦50 t2v).

### fal-balance probe + admin key (2026-07-17, the "plenty of money" mystery)
- The 4:48 AM refusal investigation, concluded: the worker's FAL_KEY was
  API-scoped and could NOT read billing (probe returned null) — so the
  low-balance guard had never fired (fails open on null by design), and the
  502s were fal REJECTING submits at the door with money visible ($4.95) —
  fal's lock-flap bug (fal-ai/fal#922), same as yesterday.
- Owner created an ADMIN-scoped key and updated the FAL_KEY GitHub secret;
  after redeploy the probe reads the live balance (usd 4.95, guard armed).
- New owner-only endpoint GET /api/fal-balance (allowlisted to the owner's
  two emails), cache-busted, returns {usd, note}. Console one-liner:
  await (await apiFetch('/api/fal-balance')).json()
- If the lock-flap recurs with balance present: fal support ticket, or a
  small $1-5 top-up often re-triggers the unlock.

### Veo Lite: first-&-last row added (2026-07-17)
- Owner swept fal's Veo catalog (13 endpoints) against ours right after the
  Lite launch and caught the one gap: veo3.1/lite/first-last-frame-to-video
  exists (fal's docs search had hidden it). caps.flf flipped on — rows,
  exclusivity and the worker's generic endpoint build all apply unchanged.
  Lite still genuinely lacks extend + reference. Verified headless: Lite
  shows exactly Image-to-video + First & last frame rows.

### Ray 3.2 catalog sweep: Reframe wired + keyframes cleared + 30s clip cap (2026-07-17)
- Owner swept fal's Ray catalog (4 endpoints). t2v/i2v/v2v were wired;
  **Reframe** (generative outpaint to a NEW aspect ratio) was missing — now
  built with zero new UI: attach a clip on Ray, pick a DIFFERENT ratio in
  settings → the run routes to .../reframe; keep the clip's own ratio →
  plain v2v edit as before. On clip attach the ratio picker SNAPS to the
  clip's native aspect, so reframe is always an explicit user choice
  (chatbox-is-boss rule); a ratio-section note explains the switch, and
  the duration picker locks (reframe keeps the source length).
- Pricing (verified on fal's page; billed per started SOURCE second, 30s
  schema cap): 540p $0.06/s · 720p $0.12/s · 1080p $0.36/s → r2s tier in
  both price tables; worker bills from its own byte-measured clip length
  (tamper-proof), no HDR billing on reframe. Ray clips now cap at 30s on
  attach (reframe's schema limit; v2v documents none).
- Director: reframe runs get a dedicated rule — describe ONLY what fills
  the newly revealed canvas, never edits to the footage.
- The owner's "keyframes not wired" report checked out fine headless: the
  + opens the gallery/device chooser on-screen and keyframes ride the body
  → worker → fal i2v with spaced indexes (stale tab suspected).
- Verified headless end-to-end: native ratio → v2v ✦135; flip to 9:16 →
  reframe ✦45 (3s clip · 720p), duration locked, note shown, body carries
  reframe:true + ratio. Live test pending (needs fal balance).

### OmniHuman removed (2026-07-17, owner's call)
- Both tiers (1.0 + 1.5) pulled everywhere: model picker + group flyout,
  MODEL_OPTS, audio caps, both price tables, worker allowlist,
  PROMPTLESS_VIDEO, and the portrait+voice endpoint branch. Kling LipSync
  keeps the entire audio-length billing pipeline (byte-measured, ≤30s) —
  only the omnihuman half of its gate was dropped. The generic audioPerSec
  price mechanism stays (unused) for the next audio-billed model.
- A user whose saved composer still points at OmniHuman degrades safely:
  no rows, no price, and a send answers "that model isn't available — pick
  another from the menu."
- Verified headless: 13 video models listed (no OmniHuman anywhere), no
  page errors, LipSync rows intact (clip + audio).

### Catalog sweeps: Seedance ✓ 9/9 · Gemini has a missing endpoint (2026-07-17)
- Seedance: all 9 fal endpoints covered (t2v/i2v/reference × Std/Fast/Mini).
  CAPABILITY gap inside reference: fal takes up to 3 VIDEO refs + 3 AUDIO
  refs; we wire one @Video1 + one audio. Multi video/audio refs = UI (list
  slots) + @VideoN/@AudioN tags + billing basis for multiple clips — noted
  for the owner to green-light, not built.
- Gemini Omni Flash: t2v/i2v/edit wired; **reference-to-video MISSING**
  (schema: prompt + image_urls, inline <IMAGE_REF_0> role tags, 16:9|9:16,
  3-10s; pricing not on the API page — needs the model page check before
  wiring).

### Gemini Omni Flash reference-to-video wired (2026-07-17)
- The missing 4th Gemini endpoint (owner's catalog sweep). References row
  (≤6 — fal documents no cap; ours) with @ImageN badges; the worker
  translates our 1-based @ImageN into Gemini's NATIVE 0-based <IMAGE_REF_N>
  tags (dangling/off-modality tags dropped), and untagged raw prompts get
  every ref cited automatically. Despite the catalog copy, the schema takes
  image refs ONLY (no video/audio params — verified 2026-07-17).
- Pricing: same ~$0.13/s def rate as Gemini t2v (verified on the model
  page) — the existing price entry covers it, ✦130 at 8s.
- Clip ↔ refs are mutually exclusive on Gemini (its edit endpoint takes no
  refs, its ref endpoint no clip) — same both-directions clearing as Veo.
- Verified headless: row 0/6, price, exclusivity both ways, tag badges,
  body carries refs; worker branch mirrors Veo/Kling-o3 routing.

### Seedance multi video/audio references (@Video1-3 / @Audio1-3) (2026-07-17)
- Owner green-lit closing the capability gap from the catalog sweep. Slot #1
  stays the normal clip/audio attach (ALL existing validation untouched);
  Seedance-only "+" tiles add up to 2 more of each, enforcing fal's caps at
  attach: videos MP4/MOV, each ~480-720p area band, combined 2-15s, ≤50MB
  total; audios combined ≤15s, ≤15MB per file. Extras aren't auto-downscaled
  (slot #1 is) — out-of-band ones bounce with the fix instructions.
- Chips: typing @ offers @Video1..N and (new) @Audio1..N; tags reconcile in
  the worker as before (dangling ones dropped, raw prompts get all @VideoN
  cited). Director context announces the counts so composed prompts cite
  every reference.
- Billing: the 0.6× (input + output) seconds basis now uses the COMBINED
  byte-measured input seconds, server-side; ANY unmeasurable clip → the 15s
  never-undercharge max. Worker validates combined size/duration (400s),
  stages each extra on fal storage.
- Persistence: extras ride the per-chat staged snapshots (memory + the
  refresh-proof IndexedDB mirror) and clear when slot #1 drops or the model
  switches away from Seedance.
- Verified headless end-to-end (real files through the real file inputs);
  the combined-duration bounce branch is code-reviewed but its headless run
  hit webm metadata flakiness — worth one live poke when convenient.

### Ray 3.2 removed (2026-07-17, owner's call: "overrated")
- Pulled from the picker, MODEL_OPTS, CLIP_LIMITS, both price tables, and
  the worker allowlist. The "Floating product" landing example re-stamped
  onto Seedance 2.0. A stale saved Ray selection degrades to the
  unknown-model message like OmniHuman's did.
- What went with it (noted before removal, owner confirmed anyway): the
  Reframe outpaint built this morning, the cheapest i2v tier in the app,
  keyframes (≤64), HDR/EXR, per-signal edit controls.
- Ray-only machinery (keyframes row + lists, HDR/loop pickers, edit dial,
  reframe helpers, worker isRay routing/billing) left DORMANT in code —
  unreachable behind the allowlist / caps, flagged with comments — so a
  future Ray/Luma return is a re-wire, not a rebuild. The kf/vx staged-
  snapshot fields stay tolerated in restoreStaged.
- Verified headless: 12 video models, no Ray anywhere user-facing, stale
  selection safe, LipSync rows intact, no page errors.

### Lite first-&-last 422 + NEW VERIFICATION STANDARD (2026-07-17)
- **Owner hit it live (and rightly called it out):** a 4s first-&-last run
  on Lite bounced twice with 422 "duration: Input should be '8s'" (refunds
  fired correctly both times). Root cause: fal's DOCS pages list a 4s/6s/8s
  duration enum for endpoints where the LIVE validation disagrees.
- **New standard (owner's rule: "check fal first, detail by detail"):**
  endpoints are verified against fal's machine OpenAPI schema
  (fal.ai/api/openapi/queue/openapi.json?endpoint_id=…) — the same source
  their live validation runs on — never just the rendered docs page.
- Machine-schema audit of everything shipped today:
  - Lite t2v: duration enum 4s/6s/8s ✓ (all free)
  - Lite i2v: duration enum 4s/6s/8s ✓ (all free — first fix over-locked
    it; corrected)
  - Lite first-&-last: duration CONST "8s" → picker locks to 8s (the veo
    ref-lock mechanism, note included), worker forces "8s" and bills 8.
  - Gemini reference-to-video: image_urls REQUIRED, maxItems 10 → our cap
    raised 6→10 (was a guess); prompt cap 20k matches.
  - Seedance reference (all 3 tiers): video_urls/audio_urls arrays
    confirmed; our 3/3/9 caps and Mini's no-bitrate/no-1080p handling all
    match the machine schema.
- Verified headless: Lite t2v/i2v free at 4s (✦25), flf locked (✦50, note,
  snap), Gemini cap 10.

### Full machine-schema audit: all 33 endpoints, one billing fix (2026-07-17)
- Following the Lite flf lesson, every wired endpoint (Veo Std/Fast/Lite ×
  their sub-endpoints, Seedance ×6, Kling ×12, Gemini ×3, LipSync ×2) was
  pulled from fal's OpenAPI and compared field-by-field against our
  pickers, forces and billing.
- CLEAN: everything except one finding. Notably Std/Fast first-&-last are
  genuinely 4s/6s/8s-free (only Lite's is const 8s); Seedance's 4s minimum
  matches our picker; Kling o3's audio-off default, missing i2v aspect, and
  3-15s enums all match; both reference endpoints are const 8s (already
  forced); LipSync's required fields match.
- FIXED — extend overbilling at 4k: Veo extend-video (Std + Fast) has
  resolution CONST 720p (output is always 720p; we never sent resolution —
  correct) but billing used the PICKED tier: 4k selected + extend charged
  ✦525 for a $2.80 render. Both quote and charge now use the 720p tier on
  extends regardless of the picker.

### Tiered Veo picker rows (owner's reference design, 2026-07-17)
- Owner sent a reference screenshot: per-variant rows with the provider
  logo, a gold max-resolution badge (monitor icon + 4K/1080p) and a colored
  tier pill — PREMIUM (purple) / CLASSIC (blue) / BASIC (teal), check on
  the active pick. Built as a `tier` field on MODEL_LISTS entries: tiered
  rows swap their note-tags and generic chips for the badge pair; untiered
  rows render exactly as before. Applied to the three Veo variants; any
  family can adopt it by adding tier fields.

### Tier design extended: multicolor Google G + Seedance tiers (2026-07-17)
- Owner's follow-up references: the Veo rows now use Google's official
  multicolor G (logos/google.svg was a white mono glyph), and Seedance got
  the same tier treatment — Standard PREMIUM 4K · Fast CLASSIC 720p ·
  Mini BASIC 720p. Res badges derive from each model's real caps.

### Picker polish round (2026-07-17)
- Active-variant chips removed from all three grouped rows (Veo/Seedance/
  Kling) — owner's call; the flyout ✓ carries the selection.
- LATER (owner: "i will do kling and gemini later"): tier badges for the
  Kling five and Gemini — waiting on the owner's tier labels; one-line
  `tier:` field per entry when they come.

### Extend locks the resolution picker to 720p (2026-07-17)
- Owner caught the UI half of the extend-resolution finding: billing was
  fixed to the 720p tier this morning but the picker still offered
  1080p/4k on extend runs. With a clip attached on Veo the resolution
  section now locks to 720p (snap + note, same mechanism as the duration
  lock), and unlocks when the clip is removed.

### LATER — Seedance price re-verification (owner, 2026-07-17)
- fal's Seedance endpoint pages don't show cost cards, so today's money
  sweep couldn't cross-check the family the way Veo was checked. Our
  stored rates (per second, no audio discount): Std 480p $0.14 · 720p
  $0.304 · 1080p $0.682 · 4k $1.59; Fast $0.135/$0.242; Mini
  $0.0725/$0.155; video-ref runs 0.6× rate × (combined input + output
  seconds). These predate the machine-schema standard — when fal surfaces
  pricing (pricing page, or one cheap live run checked against the fal
  dashboard charge), reconcile against these numbers.
- Also open from the Veo sweep: whether Fast REFERENCE at 4k bills the 4k
  tier (Std's card says yes for Std; Fast's card is written flat). We
  charge the 4k tier — house-safe; one live 4k Fast ref settles it.

### Veo money audit COMPLETE — owner-verified (2026-07-17)
- The owner walked every fal cost card across all 13 Veo endpoints
  (Std/Fast/Lite × t2v, i2v, first-&-last, reference, extend where they
  exist) against our quotes: every one matches to the credit, including
  the 8s locks (references, Lite flf), the 7s/720p extend consts, and
  Lite's resolution-dependent pricing. Also confirmed: fal's docs cite
  impossible example durations ("5 second video") on enums that don't
  include 5s — schema remains the only trustworthy source.
- Open niche question stands: Fast reference at 4k (tier vs flat billing).

### Veo expected-credits reference (owner: front-end check pending)
The owner will verify these on the frontend later — every combo the app
should quote AND charge:

Veo 3.1 (Standard) — t2v / i2v / first-&-last (4s · 6s · 8s):
  720p/1080p sound  ✦200 · ✦300 · ✦400
  720p/1080p silent ✦100 · ✦150 · ✦200
  4K sound          ✦300 · ✦450 · ✦600
  4K silent         ✦150 · ✦225 · ✦300
  Reference (8s lock): ✦400 / ✦200 · 4K ✦600 / ✦400
  Extend (+7s, 720p pin): ✦350 / ✦175

Veo 3.1 Fast — t2v / i2v / first-&-last (4s · 6s · 8s):
  720p/1080p sound  ✦75 · ✦113 · ✦150
  720p/1080p silent ✦50 · ✦75  · ✦100
  4K sound          ✦175 · ✦263 · ✦350
  4K silent         ✦150 · ✦225 · ✦300
  Reference (8s lock): ✦150 / ✦100 · 4K ✦350 / ✦300 (tier-vs-flat open)
  Extend (+7s, 720p pin): ✦132 / ✦88

Veo 3.1 Lite — t2v / i2v (4s · 6s · 8s):
  720p sound  ✦25 · ✦38 · ✦50     720p silent  ✦15 · ✦23 · ✦30
  1080p sound ✦40 · ✦60 · ✦80     1080p silent ✦25 · ✦38 · ✦50
  First-&-last (8s lock): 720p ✦50 / ✦30 · 1080p ✦80 / ✦50
  (No reference / extend / 4K on Lite.)

Fractional-looking cells are correct ceilings (✦113 = $0.90, ✦263 =
$2.10, ✦38 = $0.30, ✦23 = $0.18) — rounding is always up.

### First-&-last merged into the Image-to-video row (owner's design, 2026-07-17)
- Owner (after seeing fal's Seedance form): ONE "Image to video" row with
  the start slot + an optional "End frame · optional" slot, replacing the
  separate First-&-last row — applied across every video model that had
  both (Veo ×3, Seedance ×3, Kling ×4). Row header counts n/2.
- Zero rewiring risk by design: the slots are a re-skin over the proven
  ffirst/flast machinery. Filling the end slot silently converts
  image→ffirst (+flast); removing the end demotes back to a plain start;
  clearing the start drops the pair. The worker, Veo's flf endpoints,
  Lite's 8s lock, pricing and director context all see the exact same
  states as before (verified headless: body sends first+last, lite8 lock
  fires, demotion/promotion both ways, counter 2/2).
- The rowFlf DOM stays (hidden) — no model shows it anymore.

### Seedance: one combined "Reference to video n/12" row (owner's design, 2026-07-17)
- Owner: instead of three separate rows (Audio 0/3 · Video clip 0/3 ·
  Reference 0/9), Seedance now shows ONE "Reference to video" row counting
  n/12 (fal's cross-modal total), with three labeled groups inside —
  IMAGES n/9, VIDEOS n/3, AUDIO n/3.
- Zero-rewire implementation: the existing controls (clip slot, @Video2-3
  tiles, audio slot, @Audio2-3 tiles) are RELOCATED into the groups when a
  Seedance model is selected, and moved back for every other model — same
  ids, handlers, validators; LipSync's rows verified intact round-trip.
- NEW enforcement fal always had but our split rows never checked: ≤12
  files TOTAL across modalities (9+3+3=15 possible) — attach-time toast
  client-side + a 400 guard in the worker.
- Verified headless: rows hidden/relocated, header 4/12 with mixed refs,
  labels track per-modality, LipSync round-trip clean, no page errors.

### Reference row groups → 3-icon modality toggles (owner refined, 2026-07-17)
- Owner's follow-up on the combined row: instead of three stacked labeled
  sections, the row now has a segmented switcher of three icon tabs (image
  / video / audio, each carrying its n/cap count, active tab in the split
  gradient) showing ONE modality's slots at a time. Default tab: images.
  Non-Seedance models keep the plain image group with the tabs hidden.
- Verified headless: tabs render/switch/count correctly, only-one-group
  visibility, Veo fallback intact, no page errors.

### Reference-tab polish: waveform bleed + clip label (owner caught, 2026-07-17)
- Relocating the audio/clip controls out of their rows detached them from
  their #rowAudio/#rowClip-scoped CSS — the empty audio slot's waveform
  rendered unstyled and bled across the tabs. Every scoped selector now
  has a #srAudGroup/#srVidGroup twin, so both slots keep their exact old
  styling wherever they live. The clip tile also reads "+ Video" inside
  the Reference row (it's a reference there, not the old Video-clip row).

### Reference caps now visible up front (owner asked, 2026-07-17)
- The fal limits used to surface only as bounce toasts on violation; each
  reference tab now shows its caps line permanently: images "up to 9 ·
  @Image1… · 12 files max total", videos "up to 3 · MP4/MOV · 2-15s
  combined · near 480-720p", audio "up to 3 · MP3/WAV · 15s combined ·
  needs an image or video ref too". Mini's schema verbatim-confirmed
  identical to Std/Fast (incl. the 12-file total).

### Caps: no UI text, loud rejection instead (owner reversed, 2026-07-17)
- The just-added per-tab caps hint was removed same-day (owner: "don't put
  the cap there — whenever it exceeds, just reject it and tell the user
  why"). Every cap on Seedance + Veo attach flows now rejects with the
  reason; the previously SILENT count-cap drops got toasts: over-cap ref
  images (Veo "capped at 3", Seedance "capped at 9"), 4th video ref, 4th
  audio ref. The existing loud checks (combined duration/size/format/
  12-total/pixel band/clip validation) were already compliant.

### OVERNIGHT PLATFORM AUDIT (2026-07-17, owner asleep — findings only, nothing fixed)
Scope: full frontend click-through headless (Media Agent skipped, no
generations), attach/settings/price sweep across all 17 models, staged-
persistence reload test, and a scripted diff of every wired endpoint
against fal's machine schemas.

FINDINGS (to fix when owner says so):
1. Landing filmstrip 404 spam — /mkt/f1…f14.jpg don't exist, so every
   landing view fires ~14 failed requests (console noise, wasted
   round-trips). Known backlog item ("user adds the files") but worth
   either dropping placeholder files or gating the strip until they exist.
2. CLAUDE.md drift — it still describes the floating logo menu
   (#floatNav/#floatMenu, toggleFloatMenu); the app actually uses the
   Gallery/Avatar/Media Agent TOP BAR now. Doc-only fix.
3. (Standing, already noted) Seedance Fast/Mini + reference price cards
   unverified; Fast-reference-at-4k tier question; 0.6× video-ref billing
   basis pending one live check.

PASSED CLEAN (notable):
- Zero page errors anywhere; zero broken handlers; no generation attempts
  leaked from the audit itself.
- Every duration×resolution×sound price combo on all 12 video models
  quotes non-empty; image + audio pricing fine.
- Machine-schema diff across all wired endpoints: every picker value
  inside fal's enums, no unsurfaced fal capability. (After today's fixes.)
- Chats new/switch/delete/search, sidebar, orchestrator toggle, effort
  menu, mention chips show/hide, credits overlay (tiers + storage caps +
  close), gallery grid/audio card/import box/storage bar, lightbox
  open/close, landing round-trip via logo, profile controls present.
- Merged Image-to-video pair, reference extras (@Video2-3/@Audio2-3), and
  refs all survive a REAL page reload via the staged IndexedDB mirror.
- Stale model ids (removed OmniHuman/Ray) degrade without errors.
- fal admin-key note: the key lives in Worker secrets (not readable from
  the dev box) — deep checks ran against fal's public machine-schema API;
  the owner-only /api/fal-balance probe remains the live-balance window.

### DEEP MULTI-AGENT AUDIT (2026-07-17 overnight, findings only — NOTHING fixed)
159 agents · 10 dimensions · every finding double-verified by adversarial skeptics.
74 raw → 61 CONFIRMED (survived both skeptics) · 9 plausible · 4 refuted.
Breakdown: 9 high · 19 medium · 33 low. Full evidence per finding below.


#### HIGH (9)
- **worker.js:2244** <billing-parity> — Veo extend with the Sound toggle off is billed at the audio-off (aoff) discount, but generate_audio:false is never sent to the extend endpoint (bareEdit excludes it) — the render is produced with audio at fal's audio-on price while the user is charged roughly half of it.
  - evidence: worker.js:2244 only applies the silent flag when !bareEdit: `else if (soundOff && !bareEdit && (isSeedance || isKlingV3 || isVeo)) input.generate_audio = false;` — Veo extend sets bareEdit=true (worker.js:2050-2054), so the request never asks for a silent render. Yet worker.js:2460 passes `soundOff` to creditCost unconditionally, and creditCost (worker.js:227) then picks the aoff tier: Veo extend bills aoff 720p $0.20/s x 7s = $1.40 (175 credits) instead of the audio-on $0.40/s x 7s = $2.80 (350 credits) the render actually costs. Same for fal-ai/veo3.1/fast ($0.10 vs $0.15/s). The client quot
- **public/chat.js:304** <state-machine> — Merged Image-to-video row: the image<->ffirst promote/demote conversion is dead code, so attaching the End frame silently deletes the start image and strands an invisible `flast` that skews pricing and rides the send as a start-less `last` frame.
  - evidence: Image kinds take the readImageConformed path and `return` at line 307, so the conversion written for them at lines 338-352 (`kind === 'flast' && mergedFlf() && !attachments.ffirst && attachments.image` -> promote image to ffirst) sits inside the clip/audio-only `reader.onload` (line 309, gated by `kind === 'clip' || kind === 'audio'` at 287) and can never run. The live flast path instead hits line 304 `clearImageInputsExcept('flf')`, which nulls `attachments.image` (line 1585). Repro on any merged model (Veo 3.1 x3, Seedance x3, Kling v3/o3 — all have `caps.image`+`caps.flf`, lines 33/40/67/74
- **worker.js:2814** <error-paths> — Stripe webhook swallows set_plan failure: a paid membership's storage tier/plan silently never activates, and Stripe is told the delivery succeeded so it never retries
  - evidence: In the invoice.paid handler, add_credits failure correctly returns 500 so Stripe retries (line 2799), but the set_plan call (lines 2804-2813) is wrapped in `try {...} catch {} // credits already granted; a plan-set hiccup shouldn't fail the webhook` and the handler then returns `Response.json({ received: true })` (200). If set_plan fails (Supabase blip, 10s timeout), the user has just paid $24.99-$99.99 for a membership whose gallery-storage benefit (user_plan tier + plan_until) is never recorded — /api/storage returns cap 0, every save 402s with reason 'free', and the UI tells this paying cus
- **public/chat.js:7314** <error-paths> — Avatar generation poll loop never checks for terminal fal failure and never refunds: a FAILED job leaves the user staring at a spinner for the full 5 minutes, then shows 'Timed out' with the credit silently kept
  - evidence: acGenerate's poll loop (lines 7314-7318) is `while (Date.now() < deadline) { ... if (state === 'COMPLETED') break; await sleep(3500) }` — unlike the main flow (pollAndDeliver line 5260, which breaks on FAILED/ERROR/CANCELED, fetches the exact error, and calls requestRefund at 5272) and even the voice preview (line 2634), there is no FAILED/ERROR/CANCELED check. A fal-side failure spins the 'Creating your avatar… this takes a few seconds' stage for 5 full minutes, then fails as 'Timed out — please try again' (7319) with no reason. requestRefund is never called anywhere in acGenerate (grep confi
- **public/chat.js:7327** <error-paths> — Avatar creation silently persists an expiring temporary fal URL when the gallery save fails or is blocked — the avatar (and its cross-device sync copy) rots dead within days with no warning
  - evidence: `try { const saved = await saveOutput(url, 'image'); if (saved && saved.url) finalUrl = saved.url; } catch (e) {}` then the avatar is persisted with `image: finalUrl` (7332) — on any save failure or 402 block, finalUrl stays the temporary fal URL. For EVERY free account this is the guaranteed path (cap 0 → 402 reason 'free', trySave returns {url:null, block:'free'}), yet unlike the chat flow — which explicitly delivers 'ℹ️ Saving to your gallery is a paid feature — this one is a temporary link' (line 5415) — the avatar flow says nothing. Worse, saveAvatars → touchAssets → pushAssets syncs the 
- **worker.js:3587** <director-prompts> — The user-facing ask step is handed the raw fal-branded model id ('target model: fal-ai/...') with no provider-nondisclosure instruction - only the error step forbids naming fal - so a user asking 'which model will you use?' can get 'fal-ai/kling-video/...' streamed back verbatim, violating the never-show-fal rule.
  - evidence: worker.js:3587 pushes 'target model: ' + genModel into ctxBits, and the ask system prompt appends Context: ctxLine at worker.js:3673. Model ids literally contain the provider name (chat.js:48 'fal-ai/kling-video/v3/pro/text-to-video', chat.js:60 'fal-ai/veo3.1', defaults 'fal-ai/nano-banana-pro' and 'fal-ai/elevenlabs/tts/eleven-v3'). The never-name-provider rule exists ONLY in the error step (worker.js:3689 'NEVER name any backend provider... (fal, fal.ai, replicate, etc.)'); ask/compose/revise carry no such rule, the ask reply streams straight into the chat (chat.js:5764, stream: true), and 
- **worker.js:2159** <director-prompts> — Tag-protocol mismatch on Kling o3 clip edits with style refs: refLine tells the director to cite @Image1..@Image4 tags, but the reconciler only counts image tags on reference-to-video endpoints, so on the /video-to-video/edit endpoint every @ImageN is stripped - producing a mangled paid edit instruction with the uploaded refs left uncited.
  - evidence: refLine (worker.js:3621-3623) matches /seedance|kling-video\/o3/ whenever refCount>0 - the client sends refCount unconditionally when refs exist (chat.js:5642), including with a clip attached - and the video edit-writer template includes refLine (worker.js:3720), so the director writes @ImageN tags into o3 edit instructions. The o3 edit path routes to model.replace('/text-to-video','/video-to-video/edit') and attaches refs as input.image_urls (worker.js:2042-2048), but the reconciler sets isRefEndpoint = endpoint.includes('/reference-to-video') (worker.js:2159) so imgN=0, falling into the else
- **public/chat.js:6082** <ux-deadends> — Plan-mode review card's 'Generate ✦N' price is frozen at card-build time and is never re-quoted when the user changes model/duration/resolution/sound afterwards — and on re-render it prices with the CURRENT composer mode instead of the card's own mode, so the quote can be wildly wrong while approval charges the real (different) amount.
  - evidence: buildReviewCard sets the price once: `allow.textContent = 'Generate ' + (estimatePrice(m === 'audio' ? prompt : undefined, shots, extras && extras.sound) || '✦')` (chat.js:6082). estimatePrice branches on the GLOBAL `mode`/`model`/`duration`/`quality` (chat.js:4480-4572), and nothing repaints the thread on a settings change — setMode (chat.js:2227-2241) and every Settings pick call only buildOptMenus/updateSendPrice, never renderThread (renderThread is only called on chat switch/boot/sync, chat.js:3374). Reachable path A (stale quote): Plan mode → send request → card shows e.g. 'Generate ✦63' 
- **public/chat.js:5371** <refresh-resume> — Refresh during the save/deliver phase silently strands a completed, charged render for up to 1 hour: the delivery claim is taken by the now-dead tab, and the boot-resume that hits the claimed key bumps tries, pauses with autoResume=false, and shows NO message.
  - evidence: pollAndDeliver claims delivery (line 5371 claimDelivery(statusUrl)) BEFORE the save phase — which can run for minutes (saveOutput retries, burnImageWatermark, saveVideoWithQr's ffmpeg burn, lines 5379-5411) — and only clears the record at endGen (5413). If the tab dies in that window, the claim (keyed by TAB_ID, blocking for 3600e3 ms per claimAt check at line 4065) belongs to a dead tab. On the next boot, resumeOne re-polls, sees COMPLETED, fetches the result, then line 5371 returns false → `jobBumpTries(origin); pauseGen(origin, false); return;` — no deliverAgent call, no scheduleResume (aut

#### MEDIUM (19)
- **public/chat.js:4550** <billing-parity> — Gemini clip-edit quote uses the browser-measured clip duration, but the worker can only byte-measure mp4/mov — any other container (e.g. webm) makes clipSecondsReal 0 and bills the 30s maximum, so the user sees a quote for the real length and is charged up to ~6x more.
  - evidence: Client quote (chat.js:4548-4550): `clipEditSecs = Math.min(clipEditMax, Math.ceil((clipMeta && clipMeta.dur) || clipEditMax))` — browsers decode webm fine, so a 5s webm quotes 0.13*5 = $0.65 (82 credits). Worker: videoDurationFromDataUri (worker.js:270-279) parses only mp4/mov moov/mvhd, so a webm clip yields clipSecondsReal=0 and worker.js:2418 bills the max: `Math.min(clipEditMax, Math.ceil(clipSecondsReal || clipEditMax))` = 30s -> 0.13*30 = $3.90 (488 credits). CLIP_LIMITS has no format restriction for Gemini (chat.js:442, only maxDur:30; the o3 edit is protected by its mp4/mov formats lis
- **public/chat.js:4978** <provider-leak> — Error-step output is only half-scrubbed: data.reply goes through scrubProvider but data.prompt (fixedPrompt, written by Claude from the RAW fal error) is rendered into review cards unscrubbed — in explainFailure and offerReword.
  - evidence: Line 4977 scrubs the reply ('deliverAgent(origin, scrubProvider(data.reply))' with a comment noting a real fal-naming leak slipped through 2026-07-17), but line 4978 'if (data.prompt ...) reviewPrompt(data.prompt)' and offerReword lines 5002-5003 'saveToChat(origin, { t: "review", prompt: String(data.prompt) ... }); threadAppend(buildReviewCard(String(data.prompt), kind))' display the model-authored prompt with no scrub. The error step's input is the verbatim upstream error (worker.js:3770 'Raw error: ${errText}', up to 700 chars including fal hostnames), so the same incident class that alread
- **public/chat.js:8420** <dom-consistency> — Media Agent chat (agent Q&A) is fully orphaned: agentRenderThread targets #maThread, which no HTML or JS template creates, and agentSend is only reachable from buttons agentRenderThread itself renders — the whole feature (AGENT_SUGGESTIONS, /api/social/agent call) is unreachable dead code.
  - evidence: chat.js:8420 `const thread = document.getElementById('maThread'); if (!thread) return;` — grep for maThread across public/ finds a producer only in the unused demo folder public/demo-hero-2/chat.js:6109, never in public/index.html or public/chat.js templates. renderMediaAgent (chat.js:7393) builds only #appSwitch/#appMain, and renderSection (chat.js:7473+) routes to analytics/posts/dms/comments/autoreply with no agent-chat section. agentRenderThread is called only from agentSend (8446, 8461), and agentSend only from the .ma-suggest buttons agentRenderThread renders (8428) — a closed loop with 
- **public/chat.js:670** <state-machine> — awDecode has no swap/identity guard (unlike readClipMeta line 372 and measureAttachedImage line 592): a slow decode of a replaced or cleared audio clip stamps the OLD clip's awDur/awPeaks onto current state, which can wrongly auto-reject the newly attached valid audio and mis-quote lip-sync pricing.
  - evidence: awDecode (lines 654-686) unconditionally sets `awPeaks`/`awDur = audio.duration` (669-670) and then runs `audioIssue()` (678) with no check that `attachments.audio` still equals the dataUrl it was decoding — the exact guard readClipMeta uses (`attachments.clip !== dataUri`, line 372). Race: attach clip A (e.g. 70s, over Kling LipSync's 60s cap), immediately re-pick valid clip B; onAttach resets awDur=0/awDecoding=true (line 316, whose comment states the invariant: 'a send in this window must not bill the old length') and starts decode B, but decode A (decodeAudioData of a large mp3 takes secon
- **public/chat.js:5427** <state-machine> — Post-delivery 'inputs were consumed' cleanup clears attachments/extraImages/refList/elList but omits kfList, vxList and axList (and leaves clipMeta set), so Ray keyframes silently ride the NEXT prompt at the i2v price tier, and Seedance leaves orphaned @Video2-3/@Audio2-3 entries whose debounced persist immediately resurrects the state the code just deleted from IndexedDB.
  - evidence: Lines 5426-5436: only `attachments` keys, `extraImages`, `refList`, `elList` are cleared. Leftovers: (a) kfList — next send in the same chat posts `keyframes: kfList.slice()` (5097) and prices as startImg (4523) even though the comment at 5421 says inputs must not 'ride the next prompt'; (b) vxList/axList survive with slot #1 (`attachments.clip`/`attachments.audio`) now null — an impossible state the attach flow prevents (clearAttach lines 874-875 drops extras with slot #1): renderVxList still paints tagged @Video2-3 slots with no @Video1, srTotal (1722-1725) counts them against the 12-file ca
- **public/chat.js:295** <state-machine> — Async image-attach callbacks are neither slot- nor chat-scoped: a slow readImageConformed resolving after a chat switch writes the old chat's image into the NEW chat's staged attachments (cross-chat leak into the next send), and on quick same-slot re-picks the last-RESOLVED file wins over the last-attached one.
  - evidence: onAttach's `.then` (293-306) does `attachments[kind] = uri` with no guard; readImageConformed is multi-second for oversized files (>8MB triggers Image decode + iterative canvas re-encodes, lines 261-275 — the code's own comment says 15-25MB PNGs from the app's 4K outputs are the normal case). switchChat (3634-3648) is freely clickable meanwhile and runs restoreStaged for the new chat — the late resolve then lands the previous chat's image into the live `attachments` of the new chat, gets picked up by the debounced stashStaged under the new chat's id, and rides its next generation. The list att
- **public/chat.js:4280** <error-paths> — retryPendingSaves silently drops queued gallery saves after the chat explicitly promised 'It'll land there on its own' — the media stays on a temp URL that expires, with no follow-up message
  - evidence: When a mid-session save fails transiently, the user is told '⏳ Still saving this to your gallery — big files can take a minute. It'll land there on its own.' (5418). But in retryPendingSaves: line 4276 `if (Date.now() - (p.at || 0) > 6 * 24 * 3600e3) continue;` silently discards saves older than 6 days, and line 4280 `else if (block) { /* paid gate (free/full) — retrying won't help, drop it */ }` silently discards a save that later hits the 402 gate (plan lapsed or cap filled between generation and retry). In both cases the chat message keeps its temporary fal URL, which expires — a paid rende
- **public/chat.js:9468** <error-paths> — galleryDelete removes the card from the UI before the server operation and surfaces nothing on failure — both the unlist path (catch {}) and the hard-delete path (Auth.storageDelete result ignored) fail silently
  - evidence: Line 9446 `el.remove()` runs before any network call. Referenced path: the /api/media/unlist POST is in `try {...} catch {}` (9448-9468) and a non-ok response leaves j null so nothing happens — the code's own comment admits 'the card comes back on the next gallery load', but the user is shown a successful delete now and a resurrected card later with no explanation; sbToast (9172) exists and is unused here. Unreferenced path (9471): `try { await Auth.storageDelete(m[1]); } catch {}` — auth.js:182-190 shows storageDelete returns res.ok, and this boolean is ignored, so a failed DELETE (expired to
- **public/chat.js:5575** <error-paths> — pushAssets (avatar cross-device sync) never checks the response and never requeues on failure — a 4xx (expired token, RLS) or network error silently loses the sync, unlike pushChats which requeues both
  - evidence: pushAssets wraps its upsert in `try { await fetch(ASSETS_ENDPOINT...) } catch {}` (5569-5580) with no `res.ok` check and no retry/requeue — contrast pushChats, which on !up.ok re-adds ids to syncDirty and calls scheduleSync (3234) and requeues on network error (3244-3248). A single failed push means avatars edited on device A never reach device B until the NEXT avatar edit happens to fire touchAssets; worse, the LWW timestamp (assetsAt, already bumped at 5543) makes device A also ignore the stale server row on future pulls (5597), so the divergence is permanent and invisible. pushMemory (5504-
- **worker.js:2445** <worker-routes> — GPT Image 2 2K/4K billing guard for 'auto' ratio is dead code — a request with ratio absent or 'auto' plus size '4K' is billed the 4K tier ($0.41) while no explicit dimensions are ever sent, so fal renders/bills the ~1K default (~$0.22): a ~2x overcharge the code explicitly says must not happen.
  - evidence: Line 2445: `gptSize: gptSize && ratio === "auto" ? "1K" : gptSize` — but `ratio` (lines 1875-1878) is validated by `/^\d{1,2}:\d{1,2}$/` and is otherwise null, so it can NEVER equal the string "auto"; body.ratio='auto' yields ratio=null. With ratio null, line 2357-2359 `gptSizePx(ratio, gptSize)` returns null (no image_size sent) and the generic ratio branch at 2298 is skipped, yet the un-downgraded gptSize ('2K'/'4K') still reaches creditCost → GPT_PRICE['4K'] (line 109-115). The comment at 2443-2444 states "At 'auto' ratio there are no explicit dimensions — 2K/4K can't apply, so they must no
- **worker.js:4276** <worker-routes> — /api/import/fetch AI-rescue path ignores useCredits' -1 insufficient-balance return: on a race the ✦3 lookup runs without ever debiting, every failure path then mints +3 credits the user never paid via creditBack, and on success the client pill is sent balance:-1.
  - evidence: Lines 4275-4277: `let newBalance = null; try { newBalance = await useCredits(auth, AI_CR); } catch {...}` — only the throw (ledger down) is handled. Per the function contract (worker.js:384-385, "Returns the new balance, or -1 when the balance is too low"), a concurrent spend between the readCredits pre-check (4272-4274) and this debit returns -1, which is never checked. Contrast the generation route, which checks `if (!(balanceAfter >= 0))` and cancels (4524-4527). Consequences: (a) the paid Sonnet+web_search lookup runs with no charge; (b) `refund()` (4278) / `creditBack(env, user.id, 3)` (4
- **worker.js:4394** <worker-routes> — /api/save — the route that legitimately receives the largest client payloads (up to ~40MB base64 video) — has no tooLargeBody backstop: request.json() buffers and parses an arbitrarily large body before any size check runs.
  - evidence: Lines 4390-4396: `if (url.pathname === "/api/save" ...) { const user = await authUser(request); ... body = await request.json(); }` with no Content-Length guard; the per-kind caps (b64.length > 40_000_000 at 4414, 20M at 4430, 12M at 4448) apply only AFTER the whole body is buffered and JSON-parsed. Every other body-heavy route has the backstop: generation 100MB (line 1696), /api/direct 60MB (line 3318), stripe webhook 256KB (line 2713) — tooLargeBody (line 804) returns a clean 413 by Content-Length. An authed user posting a near-plan-limit body (Workers allows 100-500MB) forces full buffering
- **worker.js:3746** <director-prompts> — multiImgLine (the multi-reference image guidance including the useImages selection protocol) is spliced only into the image-EDIT compose branch, where it can never render because the client makes an edit base and reference images mutually exclusive - and its text even contradicts that branch's own header ('there is no edit base' inside 'this is an EDIT'). The actual multi-reference image compose branch gets no multi-image guidance at all, and the video variant of multiImgLine is used in no template.
  - evidence: multiImgLine is defined at worker.js:3607-3611 and used ONLY at worker.js:3746, inside the branch gated on kind==='image' && hasImage (worker.js:3740). chat.js:1022-1028 ('either ONE edit base or references, never both'; line 1028 clears extraImages when attachments.image is set in image mode) means imageCount>1 implies hasImage=false, so the branch condition and imageCount>1 never coexist - the guidance is dead. The from-scratch image branch (worker.js:3748-3758) that actually handles multi-reference runs includes no multiImgLine, leaving only the ctx bit (worker.js:3592) and the useImages to
- **worker.js:3624** <director-prompts> — Gemini reference-to-video runs get the tagless-family refLine ('refer to it naturally... not by tag') even though Gemini binds references natively via tags - the worker translates @ImageN into Gemini's <IMAGE_REF_N> form - so the director is steered away from the only binding mechanism; per-ref placement is lost and binding degrades to the generic appended 'Feature @Image1, @Image2.' fallback clause.
  - evidence: refLine's tag branch regex is /seedance|kling-video\/o3/ (worker.js:3622), so 'google/gemini-omni-flash' falls to the else branch (worker.js:3624) instructing natural wording like 'the subject from reference image N', not tags. But the reconciler's Gemini branch (worker.js:2171-2177) translates @ImageN to 0-based <IMAGE_REF_N> - the native binding per chat.js:55-57 ('bound as native <IMAGE_REF_N> tags - the worker translates our @ImageN') - and only literal @ImageN is translated; the phrase 'reference image 2' is never converted. With no tags in the director's prompt, worker.js:2030-2031 appen
- **public/chat.js:6103** <ux-deadends> — Approving a multi-shot Plan card after switching to a non-Kling video model silently drops the whole shot list — the user approves a numbered shot breakdown but gets a single plain render with no notice that the plan changed.
  - evidence: The card renders the shot list (chat.js:6066-6076, gated by `shotsApply(model)` evaluated at BUILD time, chat.js:6052) and its approve handler passes the captured shots to `generateMedia(prompt, { announce:false, shots, extras })` (chat.js:6103). generateMedia re-gates with the CURRENT model: `const genShots = (kind === 'video' && shotsApply(model) && sanitizeShots(opts.shots)) || null` (chat.js:5049) — shotsApply (chat.js:5702) is Kling-only. Reachable path: Plan mode on Kling o3 → ask for a montage → card shows 'Here's the shot list — approve to run it' with N shots → open the model menu, pi
- **public/chat.js:9255** <ux-deadends> — Gallery import-from-link with a non-URL string is a silent no-op: the only feedback is written to the input's placeholder, which is invisible while the typed text is still in the box.
  - evidence: importGalleryUrl: `if (!m) { if (inp) inp.placeholder = 'That needs a full link (https://…)'; return; }` (chat.js:9254-9255) — the input's value is not cleared, and an HTML placeholder only renders when the field is empty, so the message never shows. Reachable path: floating logo menu → Gallery → paste/type anything without 'https://' (e.g. 'molly's suds detergent' or 'www.example.com/photo.jpg' — the regex at chat.js:9254 requires the scheme) into #galImportUrl → press Enter (KEYDOWN_ACTIONS 'gal-import-url', chat.js:9620) or click the '→ ✦3' button → the function returns before disabling any
- **public/chat.js:4300** <refresh-resume> — finishDeadJob's 'keep retrying DELIVERY each boot (tries pinned below the cap)' is false: resumeJobs deletes dead records from localStorage (jobsWrite(live)) before finishDeadJob runs, and resumeOne({...j, tries:3}) never re-persists the record — so the final delivery attempt is in-memory only and any interruption loses the completed paid render permanently and silently.
  - evidence: Line 4298-4300: `const dead = jobs.filter((j) => (j.tries || 0) >= 4); jobsWrite(live);` — dead records are removed from storage. finishDeadJob's COMPLETED branch (line 4318) then calls `resumeOne({ ...j, tries: 3 })` with the comment 'keep retrying DELIVERY each boot … until the file actually lands', but nothing writes the record back (jobRecord is only called in generateMedia and recoverJob). If that attempt fails — network pause path calls jobBumpTries/pauseGen→scheduleResume, both of which operate on jobsLoad() where the record no longer exists (scheduleResume's find at 4384 returns nothin
- **public/chat.js:4385** <refresh-resume> — scheduleResume requires rec.statusUrl, so a provisional (idem-only) record from a reply lost mid-submit is never recovered in-session — the user is told 'checking whether that render went through…' but no check runs until the next full page reload or a manual re-send.
  - evidence: generateMedia's catch (line 5198) delivers '⚠️ Connection dropped — checking whether that render went through…' and calls pauseGen(origin), whose autoResume path calls scheduleResume (line 4031). But scheduleResume (line 4385) is `if (rec && rec.statusUrl) resumeOne(rec);` — the provisional record written at line 5080 has an idem and NO statusUrl, so the timer fires and does nothing. resumeOne itself handles the idem-only case correctly (line 4341 → recoverJob), so the filter is the only blocker. The maybe-charged job (worker charges after fal accepts) sits unrecovered — and its loader gone — 
- **public/chat.js:5034** <refresh-resume> — A record whose tries reach 4 mid-session (via the 45s scheduleResume cycle) stalls silently after the app promised auto-pickup, and a new send in that chat then overwrites the dead record (the pending check filters tries<4), so the charged render never reaches finishDeadJob's refund/notice at next boot.
  - evidence: Each failed in-session resume bumps tries (e.g. lines 5234, 5299, 5446) and re-schedules; after the 4th failure scheduleResume's `(j.tries || 0) < 4` filter (line 4384) finds nothing, so the render — whose last user-visible message was 'the app will pick it back up automatically' — silently stops being retried until a reload triggers finishDeadJob. If instead the user sends a new generation in that chat first, generateMedia's guard `jobsLoad().find((j) => j.chatId === origin && (j.statusUrl || j.idem) && (j.tries || 0) < 4)` (line 5034) skips the dead record and jobRecord at line 5080 (which r

#### LOW (33)
- **public/chat.js:4501** <billing-parity> — Audio (TTS) quote caps the billed character count at 2,000 but the worker charges up to 4,000 characters — a director-composed voice script between 2,000-4,000 chars (plan-mode approval bypasses the 2,000-char send guard) is quoted at up to half what is charged.
  - evidence: Client quote (chat.js:4501): `const chars = Math.min(2000, raw.trim().length)` with the comment 'Match the server's cap', and the send() guard (chat.js:6147-6152) claims 'Voice is capped at 2,000 characters server-side'. But the worker slices the prompt at 4000 (worker.js:1706), sends the full text to ElevenLabs with no 2000 cap (worker.js:1909 `input.text = prompt` — only the LipSync text mode slices at 2000, worker.js:1942), and charges `chars: prompt.length` (worker.js:2440), i.e. up to 4000 chars. The plan-mode review card prices via estimatePrice(prompt) (chat.js:6082) and its approve han
- **worker.js:2445** <billing-parity> — The GPT Image 2 'auto'-ratio billing demotion is dead code: ratio is regex-normalized to null before the check, so `ratio === "auto"` can never be true — a request with ratio 'auto' plus size 2K/4K is billed the 2K/4K tier while no dimensions are sent and the render comes out 1K-class (4K high: 52 credits charged for a ~$0.21 render).
  - evidence: worker.js:1875-1878 normalizes ratio with `/^\d{1,2}:\d{1,2}$/` — 'auto' fails and ratio becomes null. worker.js:2445 then evaluates `gptSize: gptSize && ratio === "auto" ? "1K" : gptSize` — never true, so gptSize stays '4K'; meanwhile gptSizePx(null, ...) (worker.js:2358, regex at 120-121) returns null, so no explicit width/height is sent and the image renders at the schema-default 1K class. Charge: GPT_PRICE 4K high $0.41 = 52 credits vs real fal cost ~$0.211 and vs the client quote which prices 'auto' as 1K (chat.js:4485: `GPT_PRICE[ratio === 'auto' ? '1K' : gptSize]` = 29 credits). Current
- **public/chat.js:5919** <provider-leak> — Director replies outside the error step bypass scrubProvider: the ask-step reply (deliverAgent(origin, res.reply)), its live-streamed deltas, and the Media Agent reply are all rendered unscrubbed, despite the 4974 comment framing scrubbing as defense-in-depth for AI output.
  - evidence: chat.js:5919 'if (res.reply) deliverAgent(origin, res.reply);' and the SSE delta path at 5789 'if (ev.d && onDelta) onDelta(ev.d);' render Claude output with no scrub; chat.js:8456 'agentMsgs.push({ role: "assistant", content: d.reply })' does the same for the Media Agent. These steps normally never see fal error text (low probability), but the codebase's own stance after the 2026-07-17 incident is 'scrub AI output anyway' (comment at 4974-4976) and only explainFailure actually does.
- **public/chat.js:8308** <dom-consistency> — renderPublish is dead code: its only call site is inside itself (the platform-tab click it wires), so it can never run — the live YouTube/Instagram composers (openYtComposer/openPostComposer) build the #maPublish markup inline and duplicate it.
  - evidence: grep for renderPublish finds exactly two references: the definition (chat.js:8308) and the recursive call from its own tab buttons (chat.js:8343 `b.onclick = () => { ... renderPublish(); }`). The #maPublish container it targets is created only by openYtComposer (chat.js:7653) and openPostComposer (chat.js:7830), both of which render their own complete publish UI and never invoke renderPublish.
- **public/styles.css:2052** <dom-consistency> — `.sb-toast` is defined three times with conflicting rules: a #sbToasts-scoped variant using .in/.prog modifiers that no JS ever creates or toggles (styles.css:1715-1728), and two competing fixed-position .show toasts (2052-2061 vs 2869-2877, z-index 120 vs 400) where only the last block effectively wins for the live sbToast().
  - evidence: styles.css:1715 `#sbToasts { position: fixed; ... }` — 'sbToasts' appears nowhere in chat.js or index.html, and no JS adds class 'in' or 'prog' to a toast (grep confirms). styles.css:2052 and 2869 both declare `.sb-toast { position: fixed; left: 50%; bottom: ...; opacity: 0 }` + `.sb-toast.show` with different z-index/background/padding; the only creator is sbToast() (chat.js:9172-9184, className 'sb-toast', toggles 'show'), so the 2052 block is shadowed dead weight — edits to it silently do nothing.
- **public/chat.js:3510** <state-machine> — awPlayer is not invalidated on chat switch: restoreStaged swaps awPeaks/awName/awDur to the new chat's staged audio but leaves awPlayer bound to the previous chat's clip, so the play button plays the WRONG chat's audio (and a clip playing at switch time keeps playing over the new chat).
  - evidence: restoreStaged (3501-3518) restores awDur/awPeaks/awName/awSize/awType (3510-3511) and re-renders via renderAttach('audio') (3514), but renderAudioSlot only pauses/nulls awPlayer in its EMPTY branch (762) — when the incoming chat has its own staged audio, the 'has' branch (749-758) keeps the stale player. awToggle (732-746) then sees `awPlayer` non-null and calls `awPlayer.play()` on the previous chat's Audio element while the slot shows the current chat's filename, duration, and waveform. Repro: stage audio X in chat A, press play (or just play/pause once), switch to chat B which has audio Y s
- **public/chat.js:3679** <state-machine> — deleteChat of the active chat calls restoreStaged on the fallback chat but never hydrateStaged, so that chat's refresh-persisted staged attachments don't appear — and the empty in-memory stash created on the next switch-out then deletes the IndexedDB record for good.
  - evidence: Line 3677-3680: `if (wasActive) { applyComposerState(...); restoreStaged(chatStore.active); }` — no hydrateStaged, unlike switchChat (3644-3645) and boot (6560). If the fallback chat had staged inputs persisted before a refresh and hasn't been visited this session (no stagedByChat entry), restoreStaged renders an empty panel over a DB record that still holds them. Worse, the next switchChat AWAY from it runs stashStaged (3638, creating an empty in-memory snapshot) and `stagedDbPut(outId, null)` (3640, since stagedHasContent is false), permanently destroying the persisted stash; hydrateStaged o
- **public/chat.js:9053** <error-paths> — Gallery server-list fetch failure is indistinguishable from an empty gallery: a fresh device with /api/gallery down shows 'Nothing here yet — everything you generate lands in your gallery' to a paying user whose media exists
  - evidence: loadServerGallery (9053-9061) swallows both non-ok responses and thrown errors (`catch {}`), leaving serverGallery null. galleryItems then falls back to the chat-derived local view (9087) — reasonable on the originating device, but on a new device/browser (no local chats yet, pullChats may also have failed silently at 3271) the grid renders empty and renderGallery shows the definitive-sounding empty state at 9323 ('Nothing here yet…') with no 'couldn't load your gallery — retry' distinction. sbToast exists and could disambiguate. The same-device fallback behavior itself is a deliberate, commen
- **public/chat.js:2641** <error-paths> — Voice preview failure surfaces only as a bare '⚠' glyph for 1.6 seconds — no reason, no toast, and the spent TTS credit is never refund-requested even when fal reports FAILED
  - evidence: previewVoice's catch (2641-2643) sets `btn.textContent = '⚠'` then restores '▶' after 1600ms — that is the entire failure surface for a paid action (/api/audio charges credits; the 402/insufficient-credits case also lands here with no explanation). The loop does detect terminal fal states (line 2634 breaks on FAILED/ERROR/CANCELED) and job.status_url is in scope, but unlike every generation path it never calls requestRefund, so a fal-confirmed-failed preview quietly keeps the charge. Owner-notes 1181 lists 'voice-preview errors are silent' as queued — confirmed, with the refund omission as the
- **worker.js:3170** <worker-routes> — /api/social/comment/reply is the only social WRITE endpoint with no useQuota gate — unlimited public Instagram comment posts per day — and its catch leaks raw exception text to the client.
  - evidence: Lines 3170-3187: after auth + COMPOSIO_API_KEY check the route goes straight to composioExecute — no `useQuota` call. Sibling write routes are gated: /api/social/dm/send `useQuota(request, "dm", 200)` (line 3063), /api/social/publish `useQuota(request, "publish", 30)` (line 3084); even the read routes carry `analytics` 120/day. Each call is a metered Composio execution against Meta's ~750/hr comment-reply cap (docs/media-agent.md line 68), so an abusive/looping client can burn the Composio meter and the user's Meta rate limit unbounded. Additionally line 3185 returns `String((e && e.message) |
- **worker.js:4116** <worker-routes> — /api/cancel and /api/video/poll validate only the fal URL shape, not ownership — any authenticated user who obtains another user's status_url can poll or cancel that user's queued render.
  - evidence: Lines 4116-4134 (/api/cancel) and 4575-4594 (/api/video/poll): both check `authUser(request)` and a `^https://queue\.fal\.run/...` regex, then execute with the server FAL_KEY; neither cross-checks the request_id against the caller's gen_charges rows (which exist and carry user_id — used by /api/refund at 4183-4192 and the idempotency lookup at 1728-1731). Request ids are unguessable UUIDs delivered only to the owning client, and a maliciously cancelled job is refundable via the client's CANCELED flow (public/chat.js:5260-5272), so exposure is low — but the pattern diverges from /api/refund, wh
- **worker.js:4225** <worker-routes> — /api/import/fetch's free path has no quota or rate limit — any authenticated user gets an unmetered server-side fetch proxy (up to ~29MB returned as base64 per call, unlimited calls/day); only the paid AI-rescue branch is quota'd (scanai 20/day).
  - evidence: Lines 4206-4252: after authUser the route safeFetches the user URL and (for HTML) walks image candidates with retries, returning base64 media to the client — the only useQuota call in the route is inside the AI branch (line 4268, `useQuota(request, "scanai", 20)`). SSRF is well guarded (safeFetch/hostIsBlocked, lines 756-793) and sizes are capped (MAXES line 4222, readCapped), but a scripted client can invoke it in a tight loop as a free CORS-bypass/download proxy, burning Worker CPU and egress. CLAUDE.md documents the scanai quota but no gate exists on the clean-fetch path; every comparably a
- **worker.js:3966** <worker-routes> — Documented director model routing diverges from code: CLAUDE.md says "Sonnet 5 handles High/Ultra/Max plus the ask/error/studio steps", but /api/direct routes ask/error/studio (and Low/Medium compose/revise) to Haiku 4.5.
  - evidence: Lines 3966-3969: `const dirModel = (step === "compose" || step === "revise") && (effort === "high" || effort === "ultra" || effort === "max") ? "claude-sonnet-5" : "claude-haiku-4-5";` — so ask, error, and studio always run Haiku (the in-code comment at 3960-3965 describes this as an A/B-verified split; research alone still runs Sonnet, line 3417). CLAUDE.md's /api/direct description says Sonnet handles "the ask/error/studio steps", and no owner-notes entry records the switch (grep for haiku/A-B in docs/owner-notes.md returns nothing). Billing is consistent with the cheaper model (orchestrator
- **worker.js:3633** <director-prompts> — vidRefLine always describes a single video reference 'labelled @Video1' even when 2-3 Seedance video refs are attached, contradicting the ctx line in the same prompt ('cite them as @Video1...@Video3'); since Seedance only uses references the prompt cites and the auto-append fallback fires only when NO tag is present, @Video2/@Video3 are likely to go uncited and be silently ignored.
  - evidence: worker.js:3633-3635: vidRefLine is gated only on clipIsSeedanceRef and hardcodes 'a VIDEO clip as a reference (labelled @Video1)... weave @Video1 into the prompt', with no vidRefN plural form. The same composed prompt's ctx line (worker.js:3595-3597) says 'N video clips ARE attached as references - cite them as @Video1...@VideoN' when vidRefN>1 (client sends 1+vxList.length, chat.js:5638). Seedance ignores uncited refs (worker.js:1990: 'Seedance only uses a reference the prompt CITES') and the tag-append fallback (worker.js:1995) only triggers when the prompt contains no @Image/@Video tag at a
- **worker.js:3504** <director-prompts> — Stale comment above the director-knobs block still claims 'sound' is a director-driven knob ('the AI sets these from the user's words... generate_audio / o3-edit keep_audio'), contradicting the current design: the write_prompt tool schema has no sound field, the ask prompt declares sound controlled ONLY by the user's toggle, and the client explicitly ignores any director sound value.
  - evidence: worker.js:3503-3506 comment: 'Director-driven knobs (owner's call: the AI sets these from the user's words, no new UI). sound: families with an audio-track switch (generate_audio / o3-edit keep_audio).' But the write_prompt schema (worker.js:3880-3943) exposes negative/cfg/bitrate/controls/tune/shots/useImages and no sound field; the ask SOUND rule (worker.js:3669) says the audio track 'is controlled ONLY by the user's Sound toggle... you cannot change it'; and chat.js:5667-5669 ('a director-returned sound:false is IGNORED', owner rule 2026-07-17) plus chat.js:5111 ('chatbox toggle only - neve
- **CLAUDE.md:6** <dead-drift> — Doc drift: CLAUDE.md describes navigation as a floating logo menu (#floatNav/#floatMenu, .float-logo/.float-item, toggleFloatMenu) — none of that exists; navigation is now top tabs plus a profile-pop menu, and two views (Integrations, Settings) are undocumented.
  - evidence: grep for floatNav|floatMenu|float-logo|float-item|toggleFloatMenu across public/ and worker.js returns zero hits (styles.css included). Actual mechanism: public/index.html lines 220-224 have .top-tab buttons data-view=gallery/avatar/mediaAgent plus a #topBack button, and index.html lines 210-211 put Integrations/Settings in the profile pop. public/chat.js showView() (line 9485) handles 'integrations' and 'settings' views (lines 9501-9502) and KNOWN_VIEWS at chat.js:6556 is ['home','gallery','avatar','mediaAgent','integrations','settings']. docs/owner-notes.md lines 95-99 repeat the same stale 
- **CLAUDE.md:11** <dead-drift> — Doc drift: CLAUDE.md says 'Sonnet 5 handles High/Ultra/Max plus the ask/error/studio steps' — in code Sonnet is used ONLY for High/Ultra/Max compose/revise; ask, error and studio run on Haiku.
  - evidence: worker.js:3966-3969: const dirModel = (step === "compose" || step === "revise") && (effort === "high" || effort === "ultra" || effort === "max") ? "claude-sonnet-5" : "claude-haiku-4-5"; with the comment at 3960-3964: 'Sonnet earns its price ONLY on High/Ultra/Max creative prompt-writing (compose/revise). Everything else runs on Haiku — the routing/classification ask step ..., the low-stakes error/studio steps'. orchestratorCostMicros (worker.js:952-958) also prices ask/error/studio as Haiku.
- **CLAUDE.md:47** <dead-drift> — Doc drift: CLAUDE.md's live-sweep line says '13 video + 11 image models'; the current allowlists have 12 video endpoints and only 2 image models, and the 2026-07-17 removals of Ray 3.2 and OmniHuman are not reflected anywhere in CLAUDE.md.
  - evidence: worker.js:6-22 VIDEO_MODELS contains 12 entries (3 Seedance, 2 Kling v3, Gemini, veo3.1 + fast + lite, 2 Kling o3, LipSync) with the in-code note '(Ray 3.2 removed 2026-07-17, owner's call...)'; worker.js:31-34 IMAGE_MODELS is just fal-ai/nano-banana-pro and openai/gpt-image-2. chat.js MODEL_OPTS (line 42) matches: 12 video picker entries, comments noting 'OmniHuman 1.0/1.5 were removed 2026-07-17'. CLAUDE.md never mentions veo3.1/lite either.
- **worker.js:3323** <dead-drift> — Dead code: /api/direct still accepts and fully implements the 'studio' director step (Studio was removed 2026-07-12) — no client code ever sends step:'studio', and CLAUDE.md line 11 still lists it as a live step.
  - evidence: worker.js:3323 let step = ["compose", "revise", "error", "studio", "research"].includes(body.step) ...; worker.js:3674-3688 carries the full 'You are isibi, the director of a shot-based video studio...' system prompt; orchestratorCostMicros comment (worker.js:946, 957) still prices the studio step. grep "'studio'" in public/chat.js returns zero hits — the only step values the client sends are error/ask/revise/compose/research (chat.js:4966, 4993, 5764, 5826, 5852, 6006). The step remains directly callable by any authed user (charges 0.5 credits, runs a Haiku call) for a feature that no longer 
- **public/chat.js:8746** <dead-drift> — Dead code: enterCrt() (8746), hideCrt() (8757) and crtNoSignal() (8881) are never called, and all three reference DOM ids that no longer exist in index.html (#crtSelect, #crtNote).
  - evidence: grep counts across public/*.js, index.html, worker.js show each name appears exactly once (its definition). enterCrt/hideCrt do getElementById('crtSelect') and crtNoSignal does getElementById('crtNote') — neither id exists in public/index.html (grep returns nothing; the CRT markup only has crtScreen/crtMenu/crtChatbox/crtLandInput). These are leftovers from the earlier 'CRT shown right after sign-in' design; the header comment at 8739-8743 still describes that flow (and a 'VHF knob' that has no markup), while the real flow is initCrt() at 8633 ('the CRT is now the landing itself'). paintCrt's 
- **public/chat.js:4777** <dead-drift> — Dead code: the membership 'output equivalence' helpers IMG_CR, VID_CR, roundTo, estImages, estVideos (chat.js 4777-4781) are defined but never used anywhere.
  - evidence: grep -c: IMG_CR appears 2× (definition + use inside estImages), VID_CR 2×, roundTo 3× (definition + the two est* bodies), and estImages/estVideos each appear exactly once (their own definitions) across chat.js/index.html/worker.js — nothing calls estImages/estVideos, so the whole 4777-4781 block is unreachable. The comment above it (4773-4776) also still says 'AI is the separate Orchestrator add-on now', contradicting the add-on's removal on 2026-07-14 (CLAUDE.md Credits section).
- **public/chat.js:4812** <dead-drift> — Doc drift in code: openCredits() header comment still describes it as 'Focused upsell for the AI Orchestrator add-on ($19.99/mo, at cost)' — the add-on was removed 2026-07-14 and openCredits is now the Plus/Pro/Max pricing page.
  - evidence: chat.js:4812-4813 '// Focused upsell for the AI Orchestrator add-on ($19.99/mo, at cost). Opened // from the locked Orchestrator switch and the pricing page's add-on band.' immediately above function openCredits(topupsOnly) which builds the membership overlay (MEMBERSHIPS at 4782 = Plus/Pro/Max $24.99/$49.99/$99.99). CLAUDE.md line 29 confirms 'The Orchestrator + Video Editor $19.99/mo add-ons were removed 2026-07-14' and 'Pricing page = openCredits()'. Neither the locked switch nor the add-on band exists (grep 'orch-up' in chat.js/index.html: zero hits).
- **public/styles.css:1643** <dead-drift> — Dead CSS: the removed sidebar workspace nav's rules (.side-nav, .nav-dd-* dropdown, .nav-ico/.nav-gal/.nav-proj/.nav-studio, .side-user/.side-foot/.side-email cluster) match nothing in the DOM or JS.
  - evidence: styles.css 1643-1680 defines .side-nav and the .nav-dd/.nav-dd-btn/.nav-dd-menu/.nav-dd-item/.nav-dd-sep/.nav-dd-account family; grep for 'side-nav', 'nav-dd', 'side-user', 'side-foot' across index.html/chat.js/auth.js returns zero hits (no dynamic construction of these prefixes either). The 6-item Workspace nav was removed 2026-07-15 (owner-notes 'Workspace restructure'), which documented removing the nav but not that its CSS was left behind — unlike the Studio CSS, which owner-notes explicitly records as intentionally kept.
- **public/styles.css:3424** <dead-drift> — Dead CSS: the removed Orchestrator/add-on upsell styles (.orch-up-* at 3424-3443, .addon-* at ~3348-3360, plus .up-modelbox/.up-mchip/.up-mrow etc.) have no matching markup or JS.
  - evidence: styles.css:3424 '.orch-up { text-align: left; ... }' through .orch-up-feat (3435) and styles.css:3348+ .addon-eyebrow/.addon-env/.addon-env-row etc.; grep for 'orch-up' and 'addon-' across index.html/chat.js/auth.js returns zero hits (checked for dynamic prefix construction too — none). These styled the $19.99/mo add-on upsell UI removed 2026-07-14.
- **public/styles.css:4298** <dead-drift> — Dead CSS: CRT 'set' prop rules — .crt-hud/.crt-rec (4298-4302), .crt-panel/.crt-plate (4329-4338), .crt-dial*/.crt-knob* (4340-4352), .crt-laurel, .crt-power — match nothing; the current CRT landing markup has no side panel, knobs, or HUD.
  - evidence: grep 'crt-panel|crt-knob|crt-dial|crt-hud|crt-plate|crt-power|crt-rec|crt-laurel|crtl-note' in public/index.html exits 1 (no matches); index.html's CRT block (lines 33-113) only contains crt-screen/crt-glass/crt-scan/crt-topbar/crt-crest/crt-menu/crt-stage/crt-inbox/crt-chatbox/crt-legal. chat.js builds no crt-knob elements either — its comment at 8742 ('The VHF knob turns with the channel') is stale along with the CSS.
- **public/styles.css:3511** <dead-drift> — Dead CSS: a large block of the replaced Morphic-style marketing landing survives — ~150 of the 314 .mkt-* rules (e.g. .mkt-hero 3511, .mkt-strip 3539, .mkt-pricing/.mkt-plan-*, .mkt-presets, .mkt-final, .mkt-foot-*) plus old Home-landing rules .lp-card/.lp-rec* (2448) match nothing; owner-notes still presents the Morphic design as the shipped landing.
  - evidence: An automated cross-reference of every class selector in styles.css against index.html + all JS flagged ~150 mkt-* classes and lp-card/lp-rec/lp-recent as unmatched (dynamic-construction check done: chat.js only builds 'mkt-c'+n cells and 'mb-p'+n slots, which were excluded). The live landing is the CRT variant (index.html:33 <div id="marketing" class="mkt mkt-crt">) with none of the hero/filmstrip-strip/pricing/footer sections. docs/owner-notes.md lines 103-121 ('Public marketing landing ... Design = Morphic style ... hero, filmstrip, model ticker, preset card rail, six acts feature grid, Plus
- **CLAUDE.md:29** <dead-drift> — Doc drift (minor): CLAUDE.md says "trySave treats 402 as terminal (lastSaveBlock)" — the identifier lastSaveBlock no longer exists; the 402-terminal behavior lives in trySave's returned block field.
  - evidence: grep 'lastSaveBlock' in public/chat.js returns zero hits. The actual mechanism: chat.js:4083 comment 'block is the non-transient 402 reason (free = paid-only, full = cap hit)' and trySave (4086) at 4095-4097 parses the 402 reason and returns it as block — behavior matches the doc, only the named identifier is stale.
- **public/chat.js:2597** <ux-deadends> — While a live TTS voice preview is generating (up to 90s), every other voice's ▶ button — and re-clicks of the same one — silently no-op: the `previewing` guard returns before any UI change on the clicked control.
  - evidence: previewVoice: `if (previewing) return;` (chat.js:2597) runs BEFORE `btn.disabled = true; btn.textContent = '…'` (chat.js:2600-2601), so a second click on any uncached voice does nothing visible. Compounding it, the control is a `<span class="set-voicebtn">` (chat.js:2742), so even the active button's `btn.disabled = true` is acknowledged as a no-op in the code's own comment (chat.js:2584: 'the preview control is a <span>, so btn.disabled is a no-op') — every ▶ stays visually clickable throughout. Reachable path: Settings panel → Voice section → click ▶ on voice A (no static /voices/*.mp3 files
- **public/chat.js:6114** <ux-deadends> — Denying (or approving) one review card wipes EVERY persisted review card in the chat — a second pending card (e.g. the auto-reword offer after a content-filter failure) silently vanishes on the next thread repaint or reload without the user ever acting on it.
  - evidence: clearReviews filters all review messages indiscriminately: `c.msgs = c.msgs.filter((mm) => mm.t !== 'review')` (chat.js:6111-6116), and it's called from both deny (chat.js:6083) and approve (chat.js:6091). Two cards can coexist in one chat: a content-filter kill posts a reworded-prompt review card via offerReword → saveToChat({t:'review',…}) (chat.js:5001-5003), and a subsequent Plan-mode message pushes a second one via reviewPrompt (chat.js:6124). Reachable path: Plan mode → render fails on the content filter → '✍️ …reworded to pass… Approve to try again:' card appears → user instead types a 
- **public/chat.js:5144** <refresh-resume> — Cancel-mid-submit's late response handler calls jobClear(origin) unconditionally by chatId — if the user cancelled and immediately started a NEW generation in the same chat, the old submit's late reply wipes the new run's job record, stripping the new charged run's refresh protection.
  - evidence: Line 5143-5144: `if (!alive()) { jobClear(origin); // cancelled mid-submit — drop the provisional…`. jobClear (line 4045) filters only on chatId, not on the run's idem. cancelGen deletes the chat from activeGens synchronously, so a new generateMedia can start and write its own record (provisional at 5080, or full record at 5188) while the old fetch is still resolving; when the old reply lands, !alive() is true (myGen differs) and jobClear removes whichever record is current — the NEW run's. The new run keeps working in-memory, but a refresh or dropped reply during it now loses the charged rend
- **public/chat.js:4043** <refresh-resume> — jobsWrite caps the job store at 8 records (slice(-8)) with no notice or refund for the dropped one — the 9th concurrently-outstanding paused/in-flight job silently evicts the oldest paid render's only recovery record.
  - evidence: Line 4043: `function jobsWrite(list) { try { localStorage.setItem(JOBS_KEY, JSON.stringify(list.slice(-8))); } catch {} }`. Records are one-per-chat and persist across sessions until terminal (paused jobs live for days across boots, bounded only by tries<4). A user running generations across many chats — or accumulating paused records during an outage — pushes the oldest record off the end silently: no finishDeadJob resolution, no refund attempt, no message, contradicting the 'every render must end visibly' rule (line 4302-4305). An explicit eviction that routes through finishDeadJob would pre
- **public/chat.js:4326** <refresh-resume> — finishDeadJob never attempts idem-based recovery for a dead provisional record (idem but no statusUrl): a job that WAS charged (reply lost, then 4 transient recovery failures) ends with no refund attempt and only an apologetic message, even though the worker's gen_charges lookup could have produced its statusUrl.
  - evidence: Line 4326: `const refunded = j.statusUrl ? await requestRefund(j.statusUrl) : 0;` — for an idem-only record the refund is skipped entirely and the user gets '…if credits were taken for it, use the same prompt to run it again' (line 4330), i.e. pay again. recoverJob (line 4358) shows the worker can resolve idem → status_url/response_url via the recover re-POST (worker.js:1726 gen_charges lookup), but finishDeadJob doesn't use it before giving up, so a charged-but-reply-lost job whose recovery hit 4 transient errors (each `catch { jobBumpTries }` at line 4375) is neither delivered nor refunded.
- **public/chat.js:6589** <refresh-resume> — doSignOut wipes JOBS_KEY and SAVES_KEY unconditionally — signing out while a charged render is paused/in-flight permanently discards its recovery record with no cancel, refund attempt, or notice, even when the same account signs back in.
  - evidence: Line 6588-6591 removes JOBS_KEY and SAVES_KEY (and the account-switch wipe at 6524 does the same). Unlike deleteChat (line 3651-3658), which cancels the active gen and refunds before jobClear, sign-out does neither: an in-flight job keeps running on fal (already charged under the charge-after-accepts flow) and its only client-side record is destroyed, so post-re-sign-in boot resume finds nothing and finishDeadJob never runs. The privacy wipe is intentional for a *different* next account, but for the common same-account sign-out/sign-in it silently loses a paid render; resolving or refunding ou

#### PLAUSIBLE (one skeptic refuted — worth a look, 9)
- worker.js:2508 <provider-leak> [medium] — briefErr passes raw upstream fal error text to the client unscrubbed on submit failure ({error:"submit failed", detail: briefErr(data)}); the worker has no scrubProvider equivalent, so provider hiding
- public/chat.js:3831 <provider-leak> [medium] — Temporary fal.media links delivered to save-blocked users surface the provider domain outside devtools: downloadMedia's fallback opens the raw fal.media URL in a new tab (address bar), and the media m
- worker.js:3675 <director-prompts> [medium] — The studio step's system prompt still sells the removed Studio UI: it tells users about an Export button that stitches shots on-device, export_style transitions, and free on-device trim/speed/reframe/
- worker.js:773 <security> [low] — SSRF guard never resolves DNS, so a public hostname pointing at a private IP is not blocked (DNS rebinding)
- worker.js:4581 <provider-leak> [low] — KNOWN/by-design exposure, noted per instructions: /api/video/poll?url=, /api/cancel and /api/refund carry full queue.fal.run URLs in request params/bodies, and the /api/video response returns fal stat
- public/chat.js:8746 <dom-consistency> [low] — Post-sign-in CRT selector remnants reference ids that exist nowhere: enterCrt looks for #crtSelect (never created, and enterCrt itself is never called), crtNoSignal for #crtNote, and the LIVE paintCrt
- public/chat.js:2508 <dom-consistency> [low] — The entire preset-chip subsystem (PRESET_CATS data, renderPresetsInto, usePreset, renderLpChip, applyPresetRig, ~200 lines) anchors to #lpInput/#lpChipHost/#lpHint, which are created only inside dead 
- public/chat.js:8973 <dom-consistency> [low] — initLeadHero references #leadPh and #leadWord, which exist in no HTML file; the function is itself uncalled (replaced by initCrtStage), so it is dead code whose type() closure would throw on the missi
- worker.js:4596 <worker-routes> [low] — Wrong-method requests to every /api/* route fall through to the static asset handler and return a 404 (asset not found) instead of 405 — e.g. GET /api/save or POST /api/credits gets an HTML-ish 404, a

### 9 HIGH audit findings FIXED (2026-07-17)
All nine high-severity findings from the deep multi-agent audit, fixed +
verified (client fixes headless, worker fixes by logic read):
- H1 (worker) Veo/Fast extend + Sound OFF now sends generate_audio:false on
  the extend endpoint (it accepts it despite bareEdit) — the render is
  silent, matching the audio-off charge. No more ~50% undercharge.
- H2 (client) Merged End-frame pairing was DEAD (lived in the clip/audio
  onload; image files return earlier). Moved into the readImageConformed
  branch — the ONLY place image kinds resolve. Verified: real file-input
  pairing image→ffirst+flast, counter 2/2, demote on end-remove.
- H3 (worker) Stripe invoice.paid now returns 500 if set_plan fails
  (add_credits is idempotent on ref, so Stripe's retry is safe) — paid
  memberships can't silently miss their storage tier.
- H4 (client) Avatar poll now handles FAILED/ERROR/CANCELED with the exact
  error + requestRefund, and refunds on timeout too (no resume machinery).
- H5 (client) Avatar save-block (free/full/error) now toasts that it's a
  temporary link instead of silently persisting/syncing a rotting fal URL.
- H6 (worker) Ask step no longer gets the raw fal model id — a friendly
  label map ("Kling o3 Pro" etc.) feeds the director, plus an explicit
  provider-nondisclosure rule in the ask prompt.
- H7 (worker) Kling o3 clip-edit @ImageN tags preserved — the reconciler
  now counts refs from the payload arrays (image_urls/video_urls/audio_urls)
  instead of the endpoint name, so o3 edits keep their style-ref tags.
- H8 (client) Plan review card price re-quotes live on every settings
  change (matches what approval charges), and a user mode switch drops the
  now-irrelevant card from thread + store. Verified headless.
- H9 (client) Refresh-during-save no longer strands a charged render: a
  delivery claim from a dead tab (different TAB_ID, >40s old) is taken over
  on the next resume tick, and the yield path reschedules instead of
  pausing dead.

### 18 MEDIUM audit findings FIXED (2026-07-17)
All mediums except the 2 Media-Agent ones (skipped per owner). Ray treated
as removed (keyframe remnants cleared defensively, not revived):
- Money: webm clip-edit quote now matches the worker's max-bill for
  unmeasurable containers; GPT auto-ratio 2K/4K demotion keyed off `!ratio`
  (the `=== "auto"` guard was dead → ~2× overcharge); import AI-rescue now
  aborts on use_credits -1 instead of proceeding + minting a false refund.
- Silent failures now surfaced: retryPendingSaves tells the origin chat when
  a queued save's temp link finally expires; galleryDelete restores the card
  + toasts on server failure (no phantom delete); pushAssets requeues on a
  rejected upsert (avatar sync).
- State machine: awDecode swap-guard (slow decode can't stamp the old clip);
  post-send cleanup now clears vxList/axList/kfList/clipMeta (extras no
  longer ride the next prompt at the wrong tier); async image-attach bails
  if the user switched chats mid-conform (no cross-chat leak).
- Worker: /api/save got a content-length backstop (~56MB) before json().
- Director prompts: multiImgLine moved to the references branch (it was in
  the edit branch where it can never render); Gemini refs now get the
  TAGGED guidance (it binds @ImageN natively via <IMAGE_REF_N>).
- UX: approving a Kling shot-list card after switching to a non-Kling model
  now warns instead of silently rendering a single clip; import-from-link
  with a non-URL toasts.
- Resume: finishDeadJob re-persists a bounded (dtries≤3) delivery retry so
  "retry each boot" is real; scheduleResume recovers idem-only provisional
  records in-session and resolves a mid-session tries-cap terminally
  (deliver or refund+message) instead of stalling.

### LOW audit findings — behavioral fixes + doc drift (2026-07-17)
FIXED (behavioral):
- Audio bills on chars ACTUALLY spoken (min(2000, len)) — a 2-4k plan-mode
  script no longer bills above the 2000-char quote.
- Voice-preview failure now refunds the TTS credit + toasts a reason
  (was a bare "⚠" glyph, credit silently kept).
- Denying/approving one review card clears ONLY that card — a second
  pending card (e.g. the content-filter reword offer) survives.
- awPlayer torn down on chat switch — the play button no longer plays the
  previous chat's audio.
- Sign-out now best-effort refunds any in-flight/paused charged render
  before wiping the local recovery records.
- /api/import/fetch free path is now rate-limited (useQuota "import" 120/day)
  — was an unmetered ~29MB server-side fetch relay.
- GPT auto-ratio overcharge (same dead guard as the medium) — fixed.
- Dead-code island removed: IMG_CR/VID_CR/roundTo/estImages/estVideos.
- openCredits header comment corrected (no longer the removed $19.99 add-on).
- CLAUDE.md drift corrected: nav (top tabs + profile menu, not floating
  logo), model routing (ask/error on Haiku; studio dead), model counts
  (12 video + 2 image; Ray/OmniHuman removed), trySave `block` field.

DEFERRED (deliberate — inert or near-unexploitable; sweeping risks the live
app for ~zero runtime benefit):
- Dead JS functions enterCrt/hideCrt/crtNoSignal + renderPublish (Media
  Agent) — never called; live only if some path invokes them (it doesn't).
  Left in place; they cost nothing at runtime and sit in the delicate
  landing/Media-Agent code.
- Dead CSS blocks (old sidebar nav, orchestrator upsell, CRT knobs, stale
  .mkt-*) and the triple .sb-toast (cascade already resolves to the correct
  z-index-400 block; toast is now load-bearing, so not touching it).
- worker `studio` director step — inert (no client sends step:'studio');
  removing risks the big director prompt ternary for no behavior change.
- /api/cancel + /api/video/poll ownership: the fal request IDs are random
  unguessable UUIDs only ever returned to the submitting client, so this is
  near-unexploitable; a proper per-user job→user map is an invasive change
  better done deliberately, not autonomously overnight.
SKIPPED per owner: the 2 Media-Agent findings (orphaned #maThread chat,
/api/social/comment/reply quota).

## 2026-07-17 — Provider-leak scrub (the two real "plausible" findings)

Standing owner rule (absolute): the user must NEVER see "fal" anywhere — not
in any error, anywhere. Two audit findings that survived as "plausible" were
in fact real leaks of the render service's name/host; fixed both:

- worker.js `briefErr()` returned upstream error text verbatim to the client
  (`{error:"submit failed", detail: briefErr(data)}`). Added a worker-side
  `scrubProvider()` (mirrors the frontend one — strips provider URLs, maps
  standalone `fal`/`fal-ai`/`fal.{ai,run,media}` tokens → "the render
  service"; `\bfal\b` never matches inside false/falcon) and routed every
  `briefErr` return through it.
- chat.js `downloadMedia()` catch-fallback did `window.open(rawUrl)` on a
  cross-origin fetch failure — for a temp-delivered (save-blocked) render
  that raw URL is the provider host, so the address bar would show it.
  Now only window.open our OWN hosts (blob:/data:/isibi.ai/supabase.co);
  any other host fails with an sbToast instead of exposing the URL.
- Also aligned the frontend `scrubProvider` with the worker's by adding the
  `fal-ai` whole-token rule (was leaving a "-ai" residue).

Verified headless: page loads clean, scrub kills "fal" in a sample host+token
string, provider host blocked from window.open, supabase/isibi hosts pass.

Latent (NOT fixed — unreachable): chat.js:5455 delivers `out.exr_file.url`
(a raw render-service URL) in chat. Only fires for `luma/` models, which
were all removed with Ray 3.2 — no luma entry remains in the picker, so the
branch is dead. Left untouched (editing dead code buys nothing). If a
luma/HDR model is ever re-added, route the EXR through trySave (own-host
permanent URL) instead of printing the raw link.

Defense-in-depth (NOT fixed — near-zero probability, not an error path):
the ask-step streamed deltas (chat.js onDelta) and the Media Agent reply
render Claude's conversational output unscrubbed. The final ask reply IS
scrubbed (chat.js:5046). These are model prose, not upstream error text,
so provider leakage is near-impossible; Media Agent is out of scope per
owner. Noted for completeness.

## 2026-07-17 — Ray 3.2: full dormant-code removal ("make sure everything from ray3.2 is gone")

Ray was delisted 2026-07-17 (no `luma/` model in either allowlist), but a large
dormant subsystem stayed behind gated on `model.startsWith('luma/')` — which no
model satisfies. Confirmed each piece was Ray-EXCLUSIVE (no live model declares
`hdr`/`loop`/`keyframes`/`controls`/`v2v` caps; Kling o3 + Gemini clip-edits use
their own branches) before excising it all:

- **chat.js:** removed `kfList` + the whole keyframes subsystem (kfCap/onAttachKf/
  removeKf/renderKfList), `hdrOn`/`exrOn`/`loopOn`/`editMode` globals + their
  Settings sections/pickSetting handlers/constraint-web/summary, `rayReframe`/
  `snapRayRatio`/`RATIO_NUMS`, the reframe duration-lock + ratio notes in
  veoDurLock/syncDurLock, the Luma badge (`/^luma\//`) + 'Luma' family filter,
  the HDR/reframe/keyframes/isRayI2V price branches, and the keyframes/reframe/
  controls/hdr/exr/loop/editMode fields from the /api/video payload,
  composerState, staging, and directorContext.
- **worker.js:** removed `sanitizeRayControls`/RayEditControls, the `isRay` decl +
  all three isRay routing branches (reframe / v2v / keyframes), `wantHdr`/
  `wantExr`/`wantLoop`, the `kfs` keyframes intake, `isRayV2V`, the HDR/EXR/loop
  input fields, the Ray i2s/r2s billing (isRayImgEndpoint/isRayStart5s/isReframeEp/
  reframeSecs), the luma prompt-cap, and the director's isReframeRun/rayCtlCapable
  (reframe prompt block, ctxBit, controls schema + parse). `creditCost` lost its
  `hdr/exr/i2v/reframe` params (no model has i2s/r2s tiers). NB: the MP4-box-parser
  `hdr` local and the Nano/Studio `reframe` (aspect re-crop) are unrelated — kept.
- **index.html:** removed `#rowKf` + `#fileKf`. **styles.css:** removed `#rowKf`
  selectors. **CLAUDE.md:** updated the removal note.

Verified headless: every remaining model (3 Veo · 3 Seedance · 3 Kling text +
LipSync · Gemini · 2 image · audio) builds its menu/opts/attach-panel/price with
zero page errors; Ray globals (`kfList`/`hdrOn`/`editMode`/`rayReframe`) are
undefined; `#rowKf`/`#fileKf` gone from the DOM; Kling o3 v2v price still
computes. Screenshot: Veo settings show only Aspect/Resolution/Duration/Sound;
attach rows are Image-to-video/Extend-clip/Reference — no Keyframes/HDR/Loop.

## 2026-07-17 — Media Agent: "Schedule post" tab (Instagram, FRONTEND ONLY)

New section tab in the Instagram Media Agent workspace, between Posts and DMs.
Owner asked to build the frontend now, backend later.

- Composer (reuses the .ma-publish publish-composer look): Media (device file →
  LOCAL preview only, no /api/save upload; or paste a public URL), Type
  (image/reel), Caption, and a `datetime-local` "When" picker (defaults ~1h out).
  A "Preview · not published yet" flag makes the not-live status explicit.
- "Schedule post" validates media + a FUTURE datetime, then appends a record to
  a per-browser queue in localStorage (`zephyr_ig_scheduled_v1`, capped 100).
- Queue cards: thumb (downscaled 400px for images, 🎬/🖼 icon otherwise),
  caption (or italic "No caption"), IMAGE/REEL pill, 📅 date·time, a gradient
  SCHEDULED status pill, and an × remove.
- NOTHING publishes — no backend call anywhere in this tab. Wiring the actual
  scheduled publish (Composio create-post fired at `when`, server-side queue +
  persistence, media upload to a public URL) is the pending next step.

Code: IG_SECTIONS + renderSection dispatch + renderSchedule/schPickFile/
schSubmit/schRemove/loadScheduled/saveScheduled in chat.js; `.sch-*` styles in
styles.css. Verified headless: tab renders, schedules, persists to localStorage,
counts, and removes with zero page errors (screenshotted composer + queue).

Follow-up (same day): the Schedule composer now also offers "🖼 From gallery"
— generalized openPubGalleryPicker to take an onPick callback (defaults to the
Posts composer's pubSelectMedia) and added schSelectGalleryMedia, which stages
the picked hosted URL (image URL doubles as the queue thumb; video uses its
poster) + sets the type + shows a preview with a REEL badge. Still frontend-only
(gallery URLs are already-hosted client-side; no new backend). Verified headless:
picker lists, selects image+video, queues, persists — no page errors.

Follow-up (same day): the Schedule post tab now shows ONLY the composer — the
queue list + "N scheduled" count + "Queue" header were removed (owner: "under
schedule post dont put anything"). Scheduling still persists to localStorage
and now confirms inline ("Scheduled for <date>.") then resets the composer for
the next post. Removed schRemove + the unused .sch-* queue CSS.

Follow-up (same day): the Schedule post tab is now TWO COLUMNS — composer on the
left, a month calendar on the right (owner: "on the right side put now a
calendar there with the posts there that are scheduled"). The calendar reads the
local queue, marks days that have posts (pink tint + up to 2 time chips + "+N"),
rings today, has prev/next month nav, and a click on a day opens that day's list
below the grid (thumb/icon · caption · time·type · remove ×). Scheduling jumps
the calendar to the new post's month + selects its day so it shows immediately.
Still frontend-only. New code: paintSchCal/schDayPanel/schPostsByDay/schRemovePost
+ helpers in chat.js; .sch-wrap/.sch-left/.sch-right/.scal-* in styles.css.

Follow-up (same day): calendar day cells now show the POST THUMBNAIL — each chip
is [thumb][compact time] (e.g. red image + "9am"); a video with no poster falls
back to a 🎬/🖼 icon. Added schTimeShort() for the tight chips (day-panel keeps
the full "9:00 AM"). Verified headless: real thumb data-URLs render as chip
backgrounds, icon fallback for no-thumb.

## 2026-07-18 — Builder buttons: "Outline" language (owner pick)

Explored 10 design directions in artifact mockups (5 recolors, then 5 button
languages on the untouched pink→amber palette). Owner picked **Outline**:
the gradient moves from fills to borders. Applied to styles.css (late block
so it wins the earlier fills):
- .send → hollow, 1.5px pink→amber gradient ring (padding-box/border-box
  trick), soft pink glow; hover deepens interior + glow; disabled keeps the
  ring, no glow (earlier box-shadow:none still applies).
- .send-price → gradient TEXT (background-clip:text), no more filled pill.
- .mode-btn.active → outlined with the gradient ring instead of the gradient
  fill; all .mode-btn carry a transparent 1px border so widths never shift.
Colors untouched. Verified headless on the real app (full screen + composer
close-up), no page errors. The mkt marketing composer reuses these classes
and inherits the same look — consistent by design.

## 2026-07-18 — Gemini edit: EEA/UK/Switzerland friendly error

The fal schema for google/gemini-omni-flash/edit states editing uploaded
videos is NOT available in the EEA, Switzerland or the UK (also: "voice
editing is not supported", and Google's own tip — simple prompts + "Keep
everything else the same." — which our edit-writer already follows). Added
region-rejection detection in BOTH failure surfaces (friendlyFail + the
terminal-4xx poll branch): a blocked EU/UK/CH user now gets "the model maker
blocks it in the EU, UK and Switzerland — pick a Kling o3 model for clip
edits instead" plus the refund note, instead of a raw validation shrug.
Verified headless: fires on the schema's exact wording; content-filter and
validation branches unaffected; no provider named.

Follow-up: owner — no model suggestion in the regional error. Both messages
now state only the cause ("the model maker blocks it in the EU, UK and
Switzerland") + the refund note; the "pick Kling o3 instead" line is gone.

## 2026-07-18 — Website Builder: standalone view, FRONTEND ONLY (v1)

The landing's "WEBSITE / MOBILE APP" channel becomes a real product surface.
Owner's calls: SEPARATE UI (not a chatbox mode) — the only thing it shares
with the media builder is the ✦ credit ledger; V1 = generate + preview +
iterate (no hosting); engine will be Opus + Gemini (owner supplies the Gemini
key later) through the same credit system — BUILD THE FRONTEND NOW.

Built: a "Websites" top-bar tab → viewSites.
- Start screen: brief textarea + "Build it ✦25" (Outline-language button) +
  a grid of saved projects (live srcdoc thumbnails, delete).
- Workspace: left chat rail (thread + "Update site ✦10" revise composer),
  right preview stage with desktop/tablet/phone viewport toggles + Download
  HTML (Blob a[download]). Back → project list.
- Projects persist in localStorage (zephyr_sites_v1, 20 projects × 200KB html
  × last 40 msgs). NOTHING calls any API yet — Generate renders a clearly
  labeled SAMPLE single-file page (CSS-only, prompt-derived accent hue) so
  the loop is testable; flags read "engine hooks up next".
- Engine-phase notes: (1) preview iframes are srcdoc + fully sandboxed and
  inherit the app CSP — inline styles OK, inline <script> BLOCKED, so
  JS-bearing generated sites need a serving route with a relaxed CSP (the
  /mkt/demo* pattern) or a sandbox/CSP rework; (2) credit_back caps refunds
  at 10 credits/call — a ✦25 site fee needs a loop or a raised cap on the
  refund path; (3) UI never names the engine/providers (checked in tests).
- Landing's WEBSITE option stays data-live="0" until the engine is real.

Verified headless end to end: create→build→revise→device toggles→download
enabled→back→thumbnail card→reopen→delete, zero page errors (the sandboxed
preview correctly blocks storage access from inside). Screenshots reviewed.

Follow-up (owner correction): the Websites TAB was wrong — the builder is a
separate product whose ONLY door is the landing's WEBSITE / MOBILE APP
channel. Changes: (1) top-bar Websites tab REMOVED; (2) selecting the WEBSITE
channel on the landing (or typing a brief there and hitting Enter) points the
boot view at 'sites' and routes through auth into the standalone builder —
the typed text arrives as the first site brief (pendingSiteBrief, consumed by
enterApp; never a media prompt); (3) while the sites view is open a body
class (in-sites) hides ALL studio chrome — chats sidebar, Gallery/Avatar/
Media-Agent tabs, the Back arrow — only the profile bubble (shared account/
credits surface) remains; leaving via profile→Settings etc. restores the
chrome; (4) backing out of the auth popup clears the brief and resets the
boot view to home so the next login doesn't land in sites by accident.
OPEN QUESTION for owner: a signed-in user who leaves the sites view has no
way back in (signed-in visits skip the landing) — decide later whether the
account menu gets a "Websites" row or the landing stays reachable signed-in.
Verified headless: landing→channel→brief→auth→standalone builder with chrome
hidden; exit restores chrome; no Websites tab anywhere; zero page errors.

Follow-up (owner reference: Lovable screenshot): the Websites workspace now
MIRRORS Lovable's anatomy, skinned in isibi dark + pink→amber —
- top bar: ← back · project name + "Previewing last saved version" ·
  centered ◉ Preview pill + "Homepage" + refresh · devices, ⤓ download,
  Share, Publish (Share/Publish are visual-only: sbToast "publishing arrives
  with the build engine"; Publish disabled until a build exists);
- left rail: session date stamp + SAMPLE ENGINE flag, Lovable-style messages
  (grey right-aligned user bubbles, plain agent text with a working copy ⧉
  action), "Ask isibi…" composer with + (inert), Build ▾ selector chip,
  gradient ✦ price, round gradient-ring send;
- right: the preview dominating in one rounded shadowed card;
- start screen: centered hero "What are we building?" (Lovable-home style).
All flows re-verified headless (create/build/revise/devices/download/list/
reopen/delete), zero page errors.

BACKLOG (owner, 2026-07-18 — do NOT build yet): Website Builder "Publish"
hosting. Owner is considering a GitHub-repo-per-generated-site model (Pages).
Alternative pitched: Cloudflare-native hosting (Workers static assets / R2
under isibi.ai subdomains — no third-party coupling, instant deploys, own
domain). Decide when the engine phase starts. No work authorized yet.

ENGINE PLAN (owner, 2026-07-18 — for the Website Builder engine phase):
owner's call on models: "Gemini is better at design, Claude better at backend/
architecture." Agreed pipeline: (1) build ✦25 = Claude-cheap spec → Gemini
visual generation → Claude hardening (semantics/a11y/SEO/form wiring);
(2) revision ✦10 = route by intent (visual → Gemini, functional → Claude)
via a cheap classifier, same pattern as the director's effort routing.
Opus reserved for heavy architecture; Gemini Pro on the visual pass keeps
✦25/✦10 margins healthy. Needs GEMINI key from owner (pending) — not built.

ENGINE PLAN amendment (owner, 2026-07-18): Claude side is OPUS ONLY — no
Haiku/Sonnet anywhere in the Website Builder (owner's explicit call). Cost
consequence: a full build runs ~$0.55-0.65 (Opus spec + Gemini visual +
Opus hardening), so ✦25 would lose money → reprice at engine time (working
range ✦50-75 build / ✦15-25 revision; pin from real token measurements).
Pure-visual revisions route to Gemini alone (no Claude call at all); the
revision-intent router must NOT be Haiku/Sonnet — use a keyword heuristic
or Gemini Flash.

Follow-up: GEMINI_API_KEY (already in the GitHub secrets vault, owner
confirmed the exact name) is now wired into deploy.yml — uploads to the
Worker on every deploy alongside FAL/ANTHROPIC/etc. Unused until the engine
lands. Model pinned by live docs check (ai.google.dev, 2026-07-18): Google's
flagship is **Gemini 3.1 Pro** (`gemini-3.1-pro-preview`) — that's the
design-pass model per the owner's "their best LLM" call; re-verify the id
at wiring time (preview ids rotate; fall back to the newest stable Pro).
NOTE: if the deploy fails on the secret upload, the vault name doesn't
match GEMINI_API_KEY exactly — check the Actions log.

## 2026-07-18 — WEBSITE BUILDER ENGINE WIRED (owner: "engine time")

The builder is REAL now. Worker route POST /api/site (before /api/direct):
- Models: design pass = Gemini 3.1 Pro (`gemini-3.1-pro-preview`, verified
  as Google's flagship on ai.google.dev same day); engineering pass =
  Opus (`claude-opus-4-8`). NO Haiku/Sonnet anywhere (owner's call).
- build (✦60): Gemini designs the full single-file site from the brief →
  Opus hardens (semantics/a11y/responsive/SEO, design preserved verbatim);
  a hardening glitch ships the draft rather than failing the paid build.
- revise (✦20): keyword-routed — functional/correctness instructions → Opus,
  visual → Gemini alone. Router is a regex, deliberately not a model call.
- Money: `useQuota("site", 40)`/day BEFORE the charge; `use_credits` up
  front (402 → not enough, cost in body); EVERY terminal failure refunds the
  full fee via a credit_back LOOP (RPC caps 10/call → 6 calls for ✦60).
  ✦60/✦20 are the owner-approved range midpoints; token counts are logged
  (console: "site design tokens" / "site build tokens") — tune from real
  usage. Errors to the client are provider-neutral ("build failed").
- Single-file contract enforced in both prompts: no external resources,
  inline CSS/JS only, responsive 360px+, semantic + SEO meta, forms inert
  (action="#") until hosting/backends land.
- CSP: added `frame-src 'self' blob:` — the preview now renders from a Blob
  URL in a sandbox="allow-scripts" iframe (opaque origin, no app access);
  srcdoc would inherit the app CSP and kill generated sites' own JS.
Frontend: siteSend calls the real engine (first message = build, later =
revise), busy state holds ~1-2 min, replies cover ok/402/429/501/refund,
✦ pill refreshes after every call; prices now ✦60/✦20 everywhere; SAMPLE
machinery deleted; hero flag now "Beta"; localStorage html cap 400KB.
Verified headless with a mocked /api/site: build→blob preview (scripts
sandbox-run), revise request carries current html, 402 + refund messages,
no provider names anywhere. REAL end-to-end needs a live build (keys only
exist on the Worker) — owner runs the first one.
KNOWN EDGE (accepted, same exposure as /api/direct): a connection drop
after the server charged but before the response lands loses the fee with
no auto-retry — revisit with idempotency keys if it ever bites.

## 2026-07-18 — Audit round-2 fixes: BILLING batch (money)

- **Delete account now cancels Stripe FIRST** (chat.js delete handler): calls
  /api/billing/cancel {confirm,immediate} while still authed, then deletes.
  If cancel genuinely fails (502 cancel_failed / network), the delete is
  ABORTED with a message — fails safe (never orphan a live subscription on a
  deleted account = "billed forever"). 501 (payments off) / active:false /
  cancelled:true all proceed. Fixes the HIGH.
- **/api/billing/cancel cancels ALL live subs, added `immediate` mode**
  (worker): collects every live subscription across the caller's customers
  (was: first only) so a duplicate-buy can't leave one billing; immediate=true
  DELETEs each now (used by account deletion), else cancel_at_period_end each.
- **Duplicate-membership guard in /api/checkout** (worker): a plan checkout
  now 409s if the caller already has any live subscription (top-ups exempt);
  fails OPEN if Stripe is unreachable so a first-time buyer is never blocked.
  Client shows the 409 reason in the pricing modal. Fixes the HIGH.
- **TTS undercharge fixed** (worker): input.text is now sliced to 2,000 chars
  — the SAME cap billing uses (was sending up to 4,000 uncut → fal billed us
  up to 2× the charge). Fixes the HIGH.
NOTE: the delete→cancel Stripe path is logic/syntax-verified + fail-safe by
construction; a real-Stripe smoke test (delete a test account that has a live
sub, confirm the sub ends) is worth doing once with a throwaway account.

## 2026-07-18 — Audit round-2 fixes: DATA-LOSS batch

- **Transient media error no longer deletes the message** (buildMedia
  el.onerror): a media element error fires on offline / Supabase 5xx / flaky
  connection too — the old code spliced the message AND synced the deletion,
  permanent loss for a blip. Now it collapses to a "hiccup" note and only
  self-heals (drop + sync) when a Range-GET probe returns a real 404/410;
  offline or any other status keeps the message. Verified headless.
- **zephyr_assets_at_v1 wiped on sign-out AND account-switch** + the in-memory
  `assetsAt` reset to 0 in both paths. Was surviving → the next account's
  pullAssets bailed (remoteAt <= stale clock) and a first edit clobbered their
  server avatars. Fixes the (3 duplicate) HIGH findings.
- **Mid-session re-auth account switch** (finishAuth): a 401 pops the gate via
  showAuthGate() directly (authEntry stays 'stay') → routed to the landing,
  skipping enterApp's account-switch wipe → previous account's chats/avatars
  shown and synced under the NEW account. finishAuth now forces enterApp()
  (full reset) whenever the authed uid != stored owner. Fixes the HIGH.

## 2026-07-18 — Audit round-2 fixes: REFUND / JOB-RECOVERY batch

- **Avatar renders now survive a refresh** (chat.js): the charged render is
  registered in JOBS_KEY under a reserved '__avatar__' key at submit and
  cleared in `finally`. If a refresh/tab-close skips the finally, boot-resume
  (resumeJobs → resumeAvatarJob) recovers it: fal COMPLETED → save the avatar;
  stuck/failed → cancel + refund. The sign-out sweep already refunds any
  pending job (avatar included). Fixes the HIGH (lost credits on refresh).
- **finishDeadJob cancels before refunding** (chat.js): a job wedged IN_QUEUE
  forever is never terminal, so /api/refund couldn't credit it. New
  cancelThenRefund() cancels first (→ CANCELED) so the refund lands. finishDeadJob
  now uses it. Fixes the HIGH.
- **recoverJob no longer destroys the record on a lookup blip** (worker): the
  idem-recovery gen_charges lookup now returns a retryable 503 when it FAILS
  (not-ok/throws/unparseable) — only a SUCCESSFUL lookup that finds no charge
  row falls through to the no-prompt 400 that tells the client to drop the
  record. The client already treats 503 as transient (bumpTries). Fixes the
  HIGH (a transient DB failure was destroying the only recovery record for a
  possibly-charged job).
Verified headless: avatar recover-on-complete + cancel-then-refund-when-stuck,
finishDeadJob cancel-before-refund, all green.

## 2026-07-18 — Audit round-2 fixes: import overcharge + remaining leak flagged

- **Import AI-rescue no longer charges users who can't save** (worker
  /api/import/fetch): before charging ✦3 for the paid image lookup, it now
  checks storageStatus — a cap-0 user (free/lapsed/top-up-only) gets the
  402 {reason:"free"} upgrade block UNCHARGED, instead of paying ✦3 for an
  image the subsequent /api/save would 402 on anyway. Fails open (ledger
  unreachable → proceed) so a real member is never wrongly blocked. Fixes HIGH.

## 2026-07-18 — demo-hero clones: deleted 1 & 3, kept 2 + closed the serve gap

- Owner reviewed all three demo-hero* clones (screenshots) and chose:
  **delete demo-hero (archived landing) + demo-hero-3 (CRT landing), keep
  demo-hero-2** (the full current-app clone — auth.js/chat.js/index.html/
  styles.css) as the design reference.
- **Caught a bug in the prior route guard**: the `448a211` block used
  `/^\/demo-hero(\/|$)/i`, which only matched the bare `/demo-hero` — the
  numbered dirs `/demo-hero-2/` and `/demo-hero-3/` slipped through and were
  STILL BEING SERVED LIVE. demo-hero-2 is the pre-scrub clone (207 "fal"
  mentions in its chat.js), so the leaky one was exactly the one still exposed.
  Widened to `/^\/demo-hero(-\d+)?(\/|$)/i` so every numbered variant 404s.
  demo-hero-2 now stays in the repo as reference but is never served.

## 2026-07-18 — Free-tier video/audio leak CLOSED: same-origin stream proxy (owner picked "a")

- Owner chose option (a): build the streaming proxy, accept the bandwidth.
- **Worker**: two new routes.
  - `POST /api/media-token` (auth'd) — AES-GCM-seals a provider media URL into
    an opaque token. Key is SHA-256(FAL_KEY + "|media-proxy-v1") — no new secret
    to provision. Token = base64url(iv‖ciphertext) of `{u,e}` (url + 7-day
    expiry). Only provider-host URLs seal (regex-gated); returns 400 otherwise.
  - `GET /api/m/<token>` (NO auth — a <video> src carries no Authorization
    header, so the encrypted token IS the capability; only URLs the server
    itself sealed will decrypt). Forwards Range for seeking; streams `up.body`
    same-origin; passes back ONLY a safe header allowlist (content-type/length/
    range, accept-ranges, last-modified, etag) so no provider-identifying header
    leaks. Tampered/expired/wrong-host tokens → 404.
- **Client**: `proxyMediaUrl(u)` mints the token and returns `/api/m/<token>`;
  wired into BOTH temp-link paths in buildMedia — the free/full `block` path and
  the transient `saveFailed` path (video/audio only; images already ride a
  data: URL via the client watermark). Retries the mint 2× (same-origin+authed,
  so effectively always succeeds); only a total failure falls back to the raw
  link (playback beats a broken card). Pending-save records now carry `disp`
  (the shown proxy src) alongside the raw url, so the eventual permanent-URL
  swap + expiry warning still find the right message. downloadMedia now accepts
  same-origin `/api/m/` paths.
- Net: a free-tier / over-cap video or audio render is delivered on a same-
  origin src — right-click "copy address" and devtools both show isibi.ai, never
  the provider. Cost: Worker egress for every free-tier temp-link play (accepted).

REMAINING MINOR LEAK (not yet fixed — flag):
- **EXR sidecar link** (chat.js ~5341) is delivered as a raw provider URL inside
  a plain-text "download it soon" chat line (pro HDR frame data). It's a text
  download link, not a player src, but it still spells out the provider host.
  Lower priority (niche pro feature) but violates the same rule — proxy or drop
  it in a later pass. → DONE 2026-07-18: dropped the EXR block entirely (dead
  code since the Ray/HDR pipeline was excised — no model returns exr_file).

## 2026-07-18 — Audit re-verification pass + 2 remaining fixes

- Re-verified the 19 confirmed MEDIUM findings (+ leak/security) from the Jul-17
  audit against CURRENT code (line numbers had drifted). Result: the vast
  majority were ALREADY FIXED by later work — all money mediums (webm clip 30s
  overcharge → clipMeasurable guard; GPT 4K auto → 1K bill; import-rescue -1 →
  402 guard; /api/save tooLargeBody backstop), the two state-machine races
  (awDecode identity guard, onAttach chat-scope guard), pushAssets requeue, the
  director-prompt mismatches (multiImgLine now in from-scratch branch, gemini in
  the tag branch), plan-card shot-drop (now warns), gallery non-URL (sbToast),
  and the whole refresh/resume cluster (finishDeadJob re-persist + dtries cap,
  scheduleResume idem recovery + terminal tries>=4 resolve, error-step prompt
  scrub). Genuinely still-open, now FIXED this pass:
  - **Provider-leak (chat.js): ask reply + SSE deltas + Media-Agent reply were
    rendered UNSCRUBBED** (only the error step got scrubbed 2026-07-17). Fixed
    at the source: directorAsk now returns scrubProvider(reply) on both the
    streaming and non-streaming paths, onDelta scrubs each delta, and the
    Media-Agent reply is scrubbed. Closes the absolute never-name-the-provider
    rule for the conversational paths.
  - **galleryDelete hard-delete swallowed a non-throwing failure**: storageDelete
    returns res.ok (false on 4xx/expired token) without throwing, but the code
    set ok=true regardless → phantom delete that reappears on next load with no
    message. Now captures the boolean → toast + card restored on failure.
- LEFT ALONE (per owner's "skip Media Agent"): the orphaned Media-Agent
  agent-chat (#maThread/agentRenderThread/agentSend/AGENT_SUGGESTIONS) is
  confirmed unreachable dead code — harmless, can delete on the owner's word.
- Bounded residual (not a regression): a new send in the ~45s window after a job
  hits tries==4 can still clobber the dead record before finishDeadJob refunds —
  down from permanent silent loss to a narrow race. Noted, not urgent.

## 2026-07-18 — Low-severity re-verify pass (33 low + 9 plausible)

Re-verified all 42 low/plausible audit findings against current code. The large
majority were ALREADY FIXED by later work (audio 2000-char billing parity, GPT
auto-ratio demotion, director leak scrub, awPlayer teardown on chat switch,
voice-preview refund, clearReviews per-card, sign-out refund, quota on the free
import path, all the CLAUDE.md doc-drift lines, dead helper blocks, etc.).

Fixed this batch (real-value opens):
- **deleteChat didn't hydrateStaged** — deleting the active chat left the
  fallback chat's refresh-persisted staged inputs hidden (switchChat + boot both
  hydrate; deleteChat didn't). Added hydrateStaged, mirroring switchChat.
- **Gallery load-failure looked like an empty gallery** — a failed /api/gallery
  fetch left serverGallery null and showed "Nothing here yet" on a device that
  DOES have saved media. Added a galleryLoadFailed flag → "Couldn't load your
  gallery just now — check your connection and reopen it."
- **`studio` director step** removed from the /api/direct allowlist (Studio was
  deleted; no client sends it) so a stray step:"studio" falls back to "ask"
  instead of reaching the dead studio branch.
- **vidRefLine only cited @Video1** for multi-clip Seedance reference runs (the
  ctx line already pluralized) — extra staged clips went uncited/inert. Now
  pluralizes to @Video1…@VideoN when >1.
- Stale "sound is director-driven" comment corrected (sound follows the user's
  toggle only, owner rule 2026-07-17).

Still OPEN, deliberately deferred (see the audit report):
- **Pure dead code / dead CSS** (renderPublish, enterCrt/hideCrt/crtNoSignal,
  initLeadHero, preset-chip/renderLanding block, 4 dead CSS blocks, triple
  .sb-toast) — cosmetic only, zero user impact; a bulk-deletion sweep in the
  live app carries more regression risk than value. Do as a dedicated cleanup
  when desired.
- **Refresh/resume money-edges** (jobsWrite slice(-8) silent eviction; finishDeadJob
  no idem recovery/refund for provisional records; cancel-then-new-send jobClear
  scoped by chatId) — narrow charged-render edge cases in the resume machinery;
  worth doing but they touch the just-reworked resume code, so batching them
  carefully & separately.
- **Infra/security decisions**: SSRF DNS-rebinding (no trivial Workers fix),
  /api/cancel+poll ownership check (adds a DB round-trip to a hot path), /api/*
  wrong-method → 404 not 405 (cosmetic).
- **Media Agent** comment-reply route (missing quota + raw error string) — LEFT
  per owner's "skip Media Agent".

## 2026-07-18 — Audit buckets 2 & 3 (resume-edges + infra), and what's deferred

Bucket 2 — resume/refund edges:
- **Cancel-mid-submit now clears ONLY its own record** (jobClearByIdem) instead
  of the whole chat — a new run started in the same chat after a cancel keeps
  its refresh protection.
- **finishDeadJob now attempts an idem recovery** for provisional (idem-only,
  no statusUrl) records before the refund/apology — a charged render whose submit
  reply was lost can be recovered + delivered instead of only apologized for.
- **jobs cap raised 8→24**: routing an evicted record through finishDeadJob would
  wrongly CANCEL a still-live render, so a bigger buffer is the safe mitigation
  for the (already rare) silent-eviction edge.

Bucket 3 — infra:
- **Unmatched /api/* now returns JSON 404** instead of falling through to the
  static asset handler (which served the app's HTML shell to API callers).

Bucket 1 — dead code (done in the prior commit): removed ~320 lines of dead
landing/preset/CRT JS. renderPublish left (Media Agent, standing rule).

DELIBERATELY DEFERRED (with reasons — these are NOT clear wins):
- **Dead CSS** (sidebar-nav / addon / crt-knob / mkt-hero blocks): 100% inert
  unused selectors, but they're scattered and interleaved with LIVE rules
  (.mkt-cell/.mkt-c*/.lp-panel used by the live CRT landing via string-concat
  class names). Excising them risks the live landing for zero user benefit. Do
  as a dedicated, screenshot-verified cleanup if ever wanted.
- **/api/cancel + /api/video/poll ownership check**: a strict gen_charges
  ownership gate would RACE the charge-after-accept write (the row often doesn't
  exist yet when a mid-submit cancel fires) and 403 legitimate cancels; the op
  is already gated by an unguessable fal request-id (very low exposure). Not
  worth breaking real cancels + a DB round-trip on the hot poll path.
- **SSRF DNS-rebinding in safeFetch**: no clean Cloudflare Workers fix (no DNS
  primitive; would need a DoH pre-resolve adding latency to every import). Impact
  is also lower on Workers (no cloud-metadata service to reach) and the literal-IP
  guard covers the common case. Behind auth + quota. Left as documented residual.
- **Media Agent comment-reply route** (missing quota + raw error string): left
  per owner's "skip Media Agent".

## 2026-07-18 — FOUC fix: app shell flashed behind the landing on refresh

Owner noticed: refreshing the landing briefly flashed the app UI (top-bar
tabs / chatbox) for a frame. Cause: `.shell` (the app) had no display:none —
it was only made `inert` behind the landing — while `#marketing`/`#authGate`
start hidden. So on a fresh load the shell painted for one frame before
showMarketing() ran. Fix: `.shell` now starts `style="display:none"` in the
HTML and enterApp() reveals it (`shell.style.display=''`) — the single authed
entry point. Logged-out never calls enterApp, so the shell never paints on the
landing. Verified headless: logged-out, .shell=none from DOM-ready, marketing=flex.

## 2026-07-18 — Website Builder: Opus pass removed, Gemini-only

Owner funded the Gemini key and called it: drop the Opus hardening/architecture
pass — the Website Builder engine is now **Gemini-only** (gemini-3.1-pro-preview).
- build: ONE Gemini pass that both designs AND engineers the site (the old
  Opus-hardening requirements — semantics, 360/768/1200 responsive, a11y, robust
  JS — are folded into the Gemini build prompt).
- revise: all instructions (visual OR functional) go to Gemini; the keyword
  functional/visual routing to Opus is gone.
- Removed SITE_OPUS_MODEL + opusCall; /api/site now needs only GEMINI_API_KEY
  (ANTHROPIC_API_KEY still required elsewhere for /api/direct).
- Pricing UNCHANGED for now (build ✦60 / revise ✦20). Charge timing is already
  correct: credits are only taken when the user clicks Build AFTER typing a brief
  (the /api/site call), never on page load or an empty box — the ✦60 is just the
  price label. NOTE: with Opus gone the real per-build cost dropped a lot, so the
  ✦60/✦20 price is now high-margin — pending owner decision on whether to lower.

## 2026-07-18 — Website Builder: metered billing + send button (no flat fee)

Owner: make it a send button; credits drawn automatically from the REAL cost now
that we have the Gemini key. Done:
- **UI**: "Build it ✦60" → "Build it ↑" (send button, no price). Workspace
  composer ✦20/✦60 chip removed (the ↑ send stays). Hint now: "Credits are based
  on what each build actually uses — and refunded if it fails." Success message
  shows the actual charge, e.g. "(✦13 used)".
- **Billing (worker /api/site)**: metered on real Gemini tokens. Pricing pinned
  from Google's page — gemini-3.1-pro-preview: $2/M in · $12/M out (≤200k-token
  prompts; $4/$18 above), output billed INCLUDING thinking tokens. 1 credit =
  $0.008. Flow: reserve the MAX this call could cost (known input chars/4 + the
  24576 output cap) via use_credits so work is never unpaid → run → refund down
  to the measured usage (usageMetadata: promptTokenCount + candidatesTokenCount +
  thoughtsTokenCount). Full reserve refunded on failure. Response carries the
  actual `cost` + net `balance`; token+credit line is console-logged per call.
- Net effect: a typical build (~8k output) now costs ~13 credits instead of the
  old flat 60 — users usually pay LESS, and always exactly what it cost.

## 2026-07-18 — Website Builder engine → gemini-3.5-flash (fixes the 429)

The 3.1-pro-PREVIEW model 429'd at Paid Tier 1 (preview models get near-zero
quota until the account tiers up — a Google-side limit, not billing; owner's key
IS paid/active). Switched to **gemini-3.5-flash** — the current GA flagship, so
full Tier-1 quota + latest model. Metering repriced to its rate: $1.50/M in,
$9/M out (flat, thinking incl.). Thinking set to "low" (3.5-flash defaults to
medium; thinkingConfig.thinkingLevel is the right field — validated because the
3.1 call reached 429, i.e. passed request validation, not 400). Everything else
(reserve→refund metering, send button, refunds) unchanged. A typical build now
lands around ~9 credits.

## TODO (owner-flagged 2026-07-18) — Website Builder refund is off
- Owner noticed the credit REFUND in the Website Builder came back wrong (net
  balance didn't fully restore on a failed/refunded build — e.g. reserve ✦37
  but balance dropped ~✦17). Suspect: the metered reserve→refund model leans on
  credit_back, which is designed for SMALL (≤10/call) orchestrator reversals and
  may cap/guard total reversal — so a big reserve refund is partial. Revisit the
  billing model: likely switch from "reserve max + credit_back the overage" to
  charging the ACTUAL cost once (use_credits after the call, with a balance
  pre-check) so no large reversal is ever needed. Deferred per owner — fix later.

## 2026-07-18 — Website Builder QUALITY jump (owner: "looks like AI slop")
Three levers, all in /api/site:
- **Real fonts**: SITE_RULES now ALLOWS Google Fonts (<link> to fonts.googleapis.com)
  — the ONLY external resource permitted (still no CDN scripts/frameworks, no
  external images: CSS art + inline SVG only). System-font-only was a big part of
  the generic look. Loads fine in the blob-URL preview (opaque origin, no CSP) and
  in the exported site.
- **Design-director prompt**: build system prompt rewritten as an award-studio
  lead designer with an explicit anti-AI-slop rulebook (distinctive art direction,
  typography as identity, chosen neutrals + restrained accent, editorial/asymmetric
  layout, CSS depth+motion, real on-brand copy) + a list of slop tells to avoid.
- **Thinking**: build now runs at thinkingLevel "high" (design reasoning is where
  quality comes from); revise stays "low" (surgical, cheap). MAX_OUT_TOK 32768→60000
  for room. A high-thinking build now runs ~30-35 credits (metered, still refunded
  to actual); revisions stay cheap.

## 2026-07-18 — Website Builder: REAL image generation (Nano Banana Pro) + billing rewrite
Closes the Lovable gap (they generate photos; now so do we — with our own models):
- **Design pass** emits <img data-gen="<art-directed photo prompt>" data-ar="16:9"> (no
  src) for the hero + up to 4 key visuals; SITE_RULES + build prompt teach the protocol.
- **Server-side pipeline** (worker helpers genOneSiteImage/storeSiteImage/injectSiteImages):
  generate each with Nano Banana Pro via fal's SYNC endpoint (fal.run/fal-ai/nano-banana-pro,
  2K), download → upload to the user's Supabase storage (media/<uid>/site/), swap the real
  hosted URL into the HTML. Generated in PARALLEL. Failures fall back to a gradient data-URI
  placeholder (build never breaks). Cap SITE_MAX_IMAGES=4.
- **Billing rewritten to CHARGE-AFTER-SUCCESS** (fixes the refund undercount the owner flagged):
  no more reserve→credit_back. Flow: readCredits pre-check (≥ worst-case Gemini) → build →
  charge measured Gemini cost → generate images capped to what the remaining balance affords
  → charge per generated image ($0.15=19cr each). Nothing is charged before success, so a
  failure needs NO refund. Response reports actual total cost + net balance.
- Cost: a full build now ≈ Gemini (~25-35cr, high thinking) + up to 4×19 = ~75cr images ≈
  100-110 credits (~$0.85) when it uses the full image budget; fewer images → less. Revisions
  stay cheap (low thinking, usually no new images).
- NOTE: latency is now ~1.5-2.5 min/build (high-thinking Gemini + parallel image gen). If
  Cloudflare/edge ever times out the long request, move /api/site to an async job (return a
  token, poll) — watch for it.

## 2026-07-18 — Website Builder: REAL multi-page (owner: the page switcher should work)
The "Homepage" picker was a placeholder; now it's real multi-page.
- **Engine = two-phase** (worker /api/site build): (1) a PLAN pass (high thinking)
  returns JSON {pages:[{path,name,purpose}], design:"<shared design system: palette
  hexes, Google Font pairing, nav, footer, voice, motifs>"} — decides how many pages
  the brief justifies (1 for a landing, up to 5); (2) each page generated in PARALLEL
  against that shared design system + a nav linking all pages, so the site reads as one
  brand. Images: site-wide budget (SITE_MAX_IMAGES=6) distributed across pages.
  Response: {pages:[{path,name,html}], design}. Revise targets the ACTIVE page (body
  carries html+path+design) → {html, path}. Token metering now ACCUMULATES across all
  the calls; charge-after-success unchanged.
- **Client**: site model = pages[] + active + design (legacy single-`html` sites read as
  one Home page, migrated on first revise). Workspace top-bar picker (st-pagepick) lists
  pages and switches the active one; preview + download + reload follow the active page;
  sub-label shows "N pages". Preview nav: a shim injected into each page intercepts
  internal "/path" link clicks and postMessages the parent (bindSiteNav) to switch the
  picker — so clicking the site's own nav navigates the preview.
- Cost/latency scale with page count (each page = its own high-thinking Gemini pass +
  images). A multi-page build can run several minutes; if the edge ever times out the
  long request, move /api/site to an async job (noted).

## 2026-07-18 — Website Builder: make buttons/forms actually WORK (owner: theirs work, ours didn't)
Our sites looked great but were static — dead buttons, inert forms. Fixed:
- **Engine**: SITE_RULES now mandates working interactions — every CTA/nav link uses
  href="#id" and smooth-scrolls to a section id; mobile menu + tabs/accordions/sliders
  genuinely function; FORMS preventDefault and show an inline success state ("You're on
  the list ✓") since there's no backend yet (never a real-submit, never a dead form); no
  placeholder "#" links. (Replaced the old "forms use action=# inert" rule.)
- **Preview sandbox** widened allow-scripts → "allow-scripts allow-forms allow-popups" so
  the wired forms/links actually run in the preview iframe (was allow-scripts only, which
  blocked form behavior).
- CAUGHT A SELF-INFLICTED BUG mid-edit: a stray backslash made the SITE_RULES string
  close as \"; (escaped) → it was swallowing following code. Fixed; verified the runtime
  value (2034 chars, clean close).

## 2026-07-18 — HOSTING milestone 1: Publish live to R2 (isibi.ai/s/<slug>)
Owner set up the Cloudflare side: R2 bucket `isibi-sites` created; the isibi-app
build token already had Workers R2 Storage:Edit + SSL&Certificates:Edit (so custom
domains are covered later too).
- **wrangler.jsonc**: R2 binding SITES_BUCKET → isibi-sites.
- **DB** (Supabase): published_sites (owner, slug, pages[{path,key}], RLS own-row) +
  site_domains (for custom domains next). Applied via MCP.
- **Worker**: POST /api/site/publish — writes each page to R2 (sites/<slug>/<page>.html),
  rewrites internal <a> nav links to the /s/<slug>/ prefix (so multi-page nav works
  live), upserts the published_sites row under the caller's JWT; republish reuses the
  slug. Serve route: GET /s/<slug>/<page> streams the HTML from R2 (60s cache).
  harden() gives /s/ a PERMISSIVE website CSP (own inline style/script + Google Fonts +
  Supabase images; still no external scripts) instead of the strict app policy.
- **Client**: Publish button → sitePublish() posts the pages, drops the live URL in the
  thread (linkified) + a toast; button flips to "Republish"; Share copies the live link.
  site.liveUrl/published persisted.
NEXT: custom domains (Cloudflare for SaaS) — needs the for-SaaS enablement + fallback
origin in the dashboard, then /api/site/domain to create custom_hostnames + serve by Host.

## 2026-07-18 — HOSTING milestone 2: real forms backend
Generated-site forms now actually save, and the owner reads them.
- **DB**: site_form_submissions (published_site_id, user_id, slug, form, data jsonb).
  RLS: owner-only SELECT; NO insert policy — only the service-role Worker inserts.
- **Worker**: POST /api/site/form (PUBLIC, anonymous) — caps payload (≤30 fields,
  values ≤2k), honeypot (_hp) drops bots, validates the slug against published_sites,
  inserts via the service key. Fails SOFT (always ok:true) + CORS (*) + OPTIONS preflight
  so it works from a live site (and later custom domains). GET /api/site/submissions
  (authed) returns the owner's submissions via their JWT (RLS-scoped).
- **Engine**: SITE_RULES forms now fire-and-forget POST to /api/site/form with
  {slug:(from /s/<slug> in the URL), form, data} + a hidden _hp honeypot, then show the
  success state. In the preview (no /s/ slug) it just no-ops → shows success, stores nothing.
- **Client**: published sites get a 📥 Inbox button in the workspace top bar → siteInbox()
  modal lists submissions (form name, fields, timestamp), newest first. site.slug stored on publish.

## 2026-07-18 — HOSTING milestone 3: real visitor-auth backend (+ live-map fix)
Stress-tested the builder with "user login" + "live map" (checkout deferred by owner).
Findings: map degraded HONESTLY to a real OpenStreetMap iframe (good) but our publish
CSP had no frame-src so it broke on /s/; login was FAKED (ungated /dashboard, "simulation
API" — it did NOT transmit the password though). Owner's call: build the REAL auth backend.
- **DB**: site_users (published_site_id, owner_id→auth.users cascade, slug, email citext,
  password_hash, created_at, last_login_at; unique (published_site_id,email)). RLS: owner
  SELECT only (auth.uid()=owner_id); NO write policy — only the service-role Worker writes.
  Cascades on site delete AND account delete.
- **Worker (brains, storage=Supabase)**: PBKDF2 (100k, SHA-256, 16-byte salt) hashing +
  HMAC-SHA256 signed stateless session tokens (30d), signing key derived from
  SUPABASE_SERVICE_KEY (no new secret). Endpoints:
  · POST /api/site/auth/signup {slug,email,password} → hash+insert, returns {ok,token,email}
  · POST /api/site/auth/login → verify (constant-time), returns {ok,token,email}
  · GET  /api/site/auth/me (Bearer) → validates token for member-page guards
  · GET  /api/site/members?slug= (owner JWT, RLS) → the site's sign-ups
  Validation: email regex, password 8–200, dup→friendly error, honeypot, empty-slug→
  "not published yet". Unit-tested crypto (12/12) + live e2e (signup/login/wrong-pw/me/
  tamper/dup/bad-email/short-pw/bad-slug all correct; DB confirmed pbkdf2, no plaintext).
- **Engine (SITE_RULES)**: wires login/signup/member-pages to the real endpoints (store
  token in localStorage zephyr_site_auth_<slug>, guard member pages via /me, real logout,
  show the member's REAL email); NEVER-FAKE guardrail (no pretend login, no ungated
  dashboard, no password field posting to the form inbox, honest degrade). LIVE-MAP protocol:
  real OSM iframe embed for address/find-us (the one allowed iframe). Publish CSP now allows
  frame-src for OSM + Google Maps.
- **Client**: published sites get a 👥 Members button next to 📥 Inbox → siteMembers() modal
  (email, joined, last login).
- **Note**: accounts work on the PUBLISHED site (real slug), not the in-builder preview —
  same as forms. Member-page gating is client-side (standard for static sites); the accounts/
  passwords/sessions themselves are fully real + server-side. Deployed 4ef7096.

## 2026-07-18 — Preview parity: real identity on BUILD (not just publish)
Owner asked why auth only worked on the public URL (Lovable's preview works). Answer:
our preview is an isolated blob iframe with no site identity until publish. Fix: give
every site a real identity the moment it's built.
- **Worker /api/site build**: after the pages are built it mints (or reuses by site_id)
  a slug and inserts a DRAFT published_sites row (pages stay off R2 — a draft isn't
  publicly served, publish still does that), returns {slug}. The row existing is what
  /api/site/auth + /api/site/form validate against, so accounts/forms work in preview.
- **SITE_RULES**: generated sites now define siteSlug() (reads window.__SITE_SLUG__ first,
  else the /s/<slug> path) + a throw-safe `store` helper (try/catch localStorage → in-mem
  fallback, so it never crashes in the sandboxed preview). Forms + auth use them.
- **Client**: build sends siteId + stores the returned draft slug; sitePreviewSrc injects
  window.__SITE_SLUG__ into the blob preview (runs before the site's JS); 📥 Inbox + 👥
  Members now show as soon as the site has a slug (draft), not only after publish.
- **Note/limit**: signup/login/forms/maps now work in the preview (real backend calls,
  real accounts — visible in Members). Full logged-in navigation ACROSS member pages still
  needs the live URL (the sandbox can't persist a session across blob page-swaps); on the
  published /s/<slug> it all works. True in-preview session nav would need a separate preview
  origin (ties to the deferred custom-domain work).

## 2026-07-18 — Website Builder workspace: Lovable-style chrome + wired Analytics/History
Reskinned the workspace to mirror Lovable (owner reference), then wired two for real.
- **View tabs**: Preview / Code / More. Code = page file list + read-only HTML (line
  numbers, per-page download). More = Analytics / Cloud / Security / SEO sub-nav.
- **History rail** (⟲): lists every version; **Restore** rolls back (snapshots current
  first so it's undoable). Snapshots stored in site.history (cap 8) in localStorage;
  sitesSave drops history first if storage is tight so current state always persists.
- **Publish panel**: live URL / visibility / visitors / Republish / Copy (Unpublish soon).
- **"Try to fix"** error card over the preview on a failed build/revise → re-runs a fix.
- **Icons**: all workspace emoji replaced with a monochrome inline-SVG set (currentColor).
- **Analytics WIRED (real)**: site_hits table + site_analytics() RPC (owner-scoped).
  Worker logs one hit per served /s/<slug> page (ctx.waitUntil, bots skipped, IP hashed
  → distinct-hash = visitors). GET /api/site/analytics. Panel shows real Visitors/Page
  views/Views-per-visit + 7-day bar chart. Live-tested: 5 browser hits logged, Googlebot
  skipped, RPC returned the right totals, ownership guard rejects non-owned slugs.
- Still visual-only (full features, not quick wires): Cloud Database/Emails/Secrets/Edge,
  Security scan, SEO→head-tag injection, Unpublish.

## 2026-07-18 — Wired: Unpublish, live Cloud cards, Opus security scan
- **Unpublish** (real): POST /api/site/unpublish deletes the site's R2 objects
  (live pages 404) but KEEPS the published_sites row + slug, so Republish (reuses
  slug by site_id) restores the SAME URL and members/submissions survive. Wired to
  the Publish panel's Unpublish button. Live-tested: 200 → 404 → republish same slug 200.
- **Cloud cards**: Members / Submissions cards clickable → open the real Members /
  Inbox panels (when the site has a slug).
- **Security scan (REAL — Opus 4.8)**: POST /api/site/scan sends the generated code
  to claude-opus-4-8 with a report_findings tool; returns structured findings
  {severity, title, detail, page}; charged 8 credits ONLY on success (402 if short).
  Panel: "Deep security scan · Run scan" → severity-coloured issue cards, or
  "No issues found". Live-tested on a planted-vuln page: found all 4 (critical
  hardcoded key, high XSS via location.hash, high http:// mixed content, low
  target=_blank tabnabbing) with correct severities; charged 8 credits.
- Still genuine backend PRODUCTS (not wires), left "Soon": Cloud Database / Emails /
  Secrets / Edge functions, and SEO→head-tag injection (owner said skip SEO for now).

## 2026-07-18 — Wired: Cloud → Database (collections)
Public, displayable data store the generated site both writes and reads — for
dynamic content (testimonials/reviews, menus, guestbooks, listings). Forms stay
the PRIVATE inbox; collections are PUBLIC by design.
- **DB**: site_collections (published_site_id/owner_id/slug/collection/data jsonb).
  RLS owner read+delete; service-key writes; FK cascade on site/account delete.
- **Worker**: POST /api/site/data (anon, fail-soft, honeypot drops bots — check is on
  data._hp not just body, fixed in testing; ≤500 records/collection cap) ·
  GET /api/site/data?slug=&collection= (PUBLIC read, newest-first, cap 100) ·
  GET /api/site/collections?slug= (owner list, RLS).
- **SITE_RULES**: collections protocol — save via /api/site/data {slug,collection,data}
  + _hp honeypot; render by GET on load; PUBLIC + newest-first.
- **Client**: Cloud → Database card is Live + opens a modal grouping records by
  collection (owner view). Reuses the si-modal styling.
- Live-tested: 2 reviews saved + read back publicly, owner list grouped by collection,
  bot honeypot dropped (0 records after the fix).
- Remaining Cloud "Soon" (real products, not wires): Emails, Secrets, Edge functions.

## 2026-07-18 — Wired: Cloud → Secrets (encrypted vault)
Owner-managed secrets vault — same contract as Lovable's Secrets page.
- **DB**: site_secrets (owner_id/slug/name unique, value_encrypted, timestamps).
  RLS owner read+delete; service-key encrypted writes; FK cascade.
- **Crypto**: AES-GCM, key derived from SUPABASE_SERVICE_KEY (siteSecretKey/encryptSecret).
  Values encrypted before storage; NEVER returned (list = name + timestamps only;
  rotate = re-POST; delete). No decrypt path yet — consumed server-side by Edge
  functions (the next build).
- **Worker**: POST (verify slug ownership → encrypt → upsert on owner_id,slug,name) /
  GET (names only) / DELETE /api/site/secrets (owner JWT + RLS).
- **Client**: Cloud → Secrets card live → vault modal (add name/value, list w/ dates,
  delete). Reuses si-modal.
- Live-tested: add → stored AES-GCM (leaks_plaintext=false) → list returns no value →
  rotate updates the row → delete removes it. (First POST 404'd on edge-propagation lag,
  fine a second later.)
- Remaining Cloud "Soon": Emails, Edge functions (Edge functions = the consumer that
  reads these secrets server-side).
