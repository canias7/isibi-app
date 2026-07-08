# isibi-app

Zephyr — an AI image/video/voice generator at https://isibi.ai — dark studio design, glass panels, pink → amber accents (#ff79c6 / #ffb84d, `--split` gradient on buttons/active states) over a near-black `#08070c`, Space Grotesk wordmark. (The old LaserFlow beam on the home thread was removed 2026-07-05.) Root (`/`) opens straight into the Zephyr chatbox behind a Supabase login gate; the workspace has Home/Projects/Gallery/Studio views (single page, view-switched).

## Structure

- Static frontend in `public/` (plain HTML/CSS/JS, no framework): `index.html` (the Zephyr chatbox — the only page), shared `styles.css` + `chat.js`, `auth.js` (Supabase email/password + email-code sign-in via GoTrue fetch, session in localStorage)
- `worker.js` — Cloudflare Worker: serves assets, `/api/video` + `/api/image` + `/api/audio` (fal.ai queue, per-kind model allowlists), `/api/direct` (director via ANTHROPIC_API_KEY, tool-use for structured output — Sonnet 5 rejects prefill; effort-routed: Haiku 4.5 writes Low/Medium compose/revise prompts, Sonnet 5 handles High/Ultra/Max plus the ask/error/studio steps; the ask step also returns `needsWeb`, and when true the frontend runs a `research` step — Sonnet 5 + Anthropic `web_search_20250305`, `max_uses:4`, ~$0.01/search — that returns a factual brief + sources folded into compose via `webFacts`, so "the newest X" gets depicted as the real current thing; gated behind that judgment so most generations never search), `/api/product/scan` (server-side page fetch behind auth + the SSRF guard; `extractProduct()` parses JSON-LD schema.org Product first — name/description/image/price — then OpenGraph/Twitter → microdata → `<link image_src>` → best real `<img>` handling lazy-load/`srcset`; single image inlined as a data URI, ≤2MB, image/* only), `/api/video/poll` (proxies fal status/result so FAL_KEY stays server-side), `/api/save` (copies finished fal outputs into Supabase Storage `media` bucket using the caller's JWT). All `/api/*` require a Supabase-authenticated user (verified via GoTrue `/auth/v1/user`).
- Supabase project: fifa-tournament-hub (`ujrqdmmtcptvimazlhom`) — auth + public `media` storage bucket (INSERT-only RLS for authenticated users). Settings account controls: "Sign out on all devices" (GoTrue `logout?scope=global`) and "Delete account" (`delete_account()` RPC, SECURITY DEFINER auth-only — deletes chats/credits/usage_log/storage rows (via the `storage.allow_delete_query` GUC)/GoTrue child rows/auth user; keeps `purchases` as financial record; client wipes its storage files via the Storage API first, then every `zephyr_*` localStorage key)
- Chats persist in localStorage (`zephyr_chats_v1`, 30 chats × 80 msgs) AND sync cross-device to a Supabase `chats` table (pushChats/pullChats); media messages store the permanent Supabase Storage URL
- **Universal memory** — a **backend/system feature with NO front-end** (user's call): auto-learned creative taste, applied to EVERY generation across all chats (not per-chat). It learns from BOTH generations and plain conversation: the **ask** step (runs on every chat message) returns an evolved `memory` list that commits immediately (no approval gate — chat itself is the signal), and the **compose/revise** `write_prompt` tool also returns one that commits on approval (`pendingMemory`→`commitMemory`, mirroring the brief). Both feed compose/revise/ask via `directorContext().memory` → `memoryLine` in the worker (≤12 short durable phrases, project-specifics excluded). Stored in `zephyr_memory_v1` + a per-user `user_memory` Supabase row (items jsonb, enabled bool, RLS own-row; pushMemory/pullMemory last-writer-wins; in `delete_account` + the local wipes). Gated off for audio. **No UI at all** — the Memory floating button and its `viewMemory` "space" page were removed; the feature is entirely invisible/backend.

## Deploy

Push to `main` → GitHub Actions → Wrangler → Cloudflare Workers → isibi.ai (+ www). Secrets in GitHub Actions: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `FAL_KEY`, `ANTHROPIC_API_KEY` (uploaded to the Worker each deploy). Work happens on a feature branch, merged to `main` via PR; deploys land in ~30-40s.

## Working rules

- **Always show UI changes as screenshots in the chat** (render the page headless and send the image) — the user reviews everything visually here.
- The user directs design; don't restyle beyond what's asked.
- Don't spend fal credits or Workers AI calls on tests without asking first.

## Credits & monetization (live)

Every generation is metered in credits (1 credit = $0.008 fal cost). Postgres RPCs (all SECURITY DEFINER, auth-only): `get_credits()` / `use_credits(cost)` (grant **20** credits on first touch), `add_credits(target,amount,cents,ref,mint_key)` (anon+auth, mint-key gated, idempotent on `purchases.ref`), `is_paid()` (has-ever-purchased). Worker: `/api/credits` returns `{balance, paid}`; charge-AFTER-fal-accepts flow (readCredits → fal submit → useCredits → cancelFal on race). `/api/checkout` + `/api/stripe/webhook` exist but 501 until the three Stripe secrets are set. Free accounts (`!is_paid`) get watermarks: images burned in client-side (canvas → JPEG → `/api/save` base64 path, server rejects raw-URL image saves for free users), videos get an on-screen badge on every playback surface (chat player, gallery card, lightbox) — the FILE itself is still clean; the fal blend-video burn is designed and its CI test bench is committed (`.github/workflows/fal-wm-test.yml`, runs on pushes touching its own files) but blocked on the fal balance top-up. Pricing page = `openCredits()` (three tiers Plus/Pro/Max, rolling launch-offer countdown); top-ups = `openCredits(true)`. Output equivalences on the cards are computed from the live price tables (`estImages`/`estVideos`) so they can't drift.

## Backlog (user-triaged, do later)

- Static voice previews — **user adds the files**: drop MP3s at `public/voices/<name>.mp3`, lowercase (rachel.mp3, aria.mp3, sarah.mp3, laura.mp3, charlotte.mp3, alice.mp3, matilda.mp3, jessica.mp3, lily.mp3, roger.mp3, george.mp3, callum.mp3, liam.mp3, will.mp3, brian.mp3, daniel.mp3). The preview button already checks these before spending a TTS call.
- Gallery view is built (browse/filter/download/delete all saved media, per-message 🗑 too). Remaining monetization TODO: server-side video-file watermark burn (fal ffmpeg), Stripe activation + billing-portal ("Cancel anytime"), media bucket size/mime caps.

## Rate limits

Postgres side: `public.use_quota(p_kind, p_limit)` (SECURITY DEFINER, atomic check+log over the client-locked `usage_log` table), fail-open in the Worker if the RPC is unreachable. **Live gates (re-enabled 2026-07-07, audit fix)**: `/api/direct` → `useQuota(request, "director", 300)`/day, plus a tighter `useQuota(request, "research", 30)`/day on the web-search research step (the directly-callable, real-money one). Both 429 `daily limit reached`; every director step fails soft client-side (ask→localAsk, compose/revise→local prompt, research→no facts) so a capped user can still generate. The **generation gate stays off** (user's call, 2026-07-03) — to re-enable add `useQuota(request, "gen", 60)` back on /api/video|image|audio.

## Auth emails (live)

All auth emails (sign-in codes, confirmations, resets) go through Go Farther via the `send-email` Edge Function, wired as Supabase's Send Email hook (HTTPS, standard-webhooks signature). Secrets in Edge Functions: `GO_FARTHER_API_KEY` (gf_live_…), `SEND_EMAIL_HOOK_SECRET` (from the hook config), optional `EMAIL_FROM` (default `isibi <login@isibi.ai>`; isibi.ai is the verified sending domain). Go Farther API: POST https://lkpfeqrelvziltfwpuxi.supabase.co/functions/v1/mailer, Bearer key, `{action:"send", from, to, subject, html}`; errors 401 bad key / 404 domain / 429 daily cap. SMTP fallback exists: smtp.gofarther.dev:465, user `gofarther`, pass = API key.

## Open (not yet scheduled)

- fal balance top-up → then run the live model sweep (one cheap job per family across the 13 video + 11 image models)
- User should change their password via the sidebar "Change password" button (the temp one appeared in a chat log)
- Mobile layout (sidebar/chat history hidden below 900px)

Auth config (set 2026-07-03 via Management API): Site URL `https://isibi.ai`, redirect allow-list `https://isibi.ai/**, https://www.isibi.ai/**`, email rate limit 100/hour.
