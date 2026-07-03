# isibi-app

Zephyr — an AI image/video/voice generator at https://isibi.ai — dark studio design, glass panels, yellow + purple accents (#ffd60a / #a855f7, diagonal split gradient on buttons). Root (`/`) opens straight into the Zephyr chatbox behind a Supabase login gate; there is a single page.

## Structure

- Static frontend in `public/` (plain HTML/CSS/JS, no framework): `index.html` (the Zephyr chatbox — the only page), shared `styles.css` + `chat.js`, `auth.js` (Supabase email/password + email-code sign-in via GoTrue fetch, session in localStorage)
- `worker.js` — Cloudflare Worker: serves assets, `/api/video` + `/api/image` + `/api/audio` (fal.ai queue, per-kind model allowlists), `/api/direct` (Sonnet director via ANTHROPIC_API_KEY, tool-use for structured output — Sonnet 5 rejects prefill), `/api/video/poll` (proxies fal status/result so FAL_KEY stays server-side), `/api/save` (copies finished fal outputs into Supabase Storage `media` bucket using the caller's JWT). All `/api/*` require a Supabase-authenticated user (verified via GoTrue `/auth/v1/user`).
- Supabase project: fifa-tournament-hub (`ujrqdmmtcptvimazlhom`) — auth + public `media` storage bucket (INSERT-only RLS for authenticated users)
- Chats persist in localStorage (`zephyr_chats_v1`, 30 chats × 80 msgs); media messages store the permanent Supabase Storage URL

## Deploy

Push to `main` → GitHub Actions → Wrangler → Cloudflare Workers → isibi.ai (+ www). Secrets in GitHub Actions: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `FAL_KEY`, `ANTHROPIC_API_KEY` (uploaded to the Worker each deploy). Work happens on a feature branch, merged to `main` via PR; deploys land in ~30-40s.

## Working rules

- **Always show UI changes as screenshots in the chat** (render the page headless and send the image) — the user reviews everything visually here.
- The user directs design; don't restyle beyond what's asked.
- Don't spend fal credits or Workers AI calls on tests without asking first.

## Backlog (user-triaged, do later)

- Static voice previews — **user adds the files**: drop MP3s at `public/voices/<name>.mp3`, lowercase (rachel.mp3, aria.mp3, sarah.mp3, laura.mp3, charlotte.mp3, alice.mp3, matilda.mp3, jessica.mp3, lily.mp3, roger.mp3, george.mp3, callum.mp3, liam.mp3, will.mp3, brian.mp3, daniel.mp3). The preview button already checks these before spending a TTS call.
- Gallery page proper (browse/manage all saved media; per-message 🗑 delete exists already)

## Rate limits

**Currently disabled** (user's call, 2026-07-03). The Postgres side stays dormant and ready: `public.use_quota(kind, limit)` (SECURITY DEFINER, atomic check+log over the client-locked `usage_log` table). To re-enable, add back the two Worker gates (`useQuota(request, "gen", 60)` on generation, `useQuota(request, "director", 300)` on /api/direct → 429 `daily limit reached`); the frontend already shows a friendly message for that error.

## Auth emails (live)

All auth emails (sign-in codes, confirmations, resets) go through Go Farther via the `send-email` Edge Function, wired as Supabase's Send Email hook (HTTPS, standard-webhooks signature). Secrets in Edge Functions: `GO_FARTHER_API_KEY` (gf_live_…), `SEND_EMAIL_HOOK_SECRET` (from the hook config), optional `EMAIL_FROM` (default `isibi <login@isibi.ai>`; isibi.ai is the verified sending domain). Go Farther API: POST https://lkpfeqrelvziltfwpuxi.supabase.co/functions/v1/mailer, Bearer key, `{action:"send", from, to, subject, html}`; errors 401 bad key / 404 domain / 429 daily cap. SMTP fallback exists: smtp.gofarther.dev:465, user `gofarther`, pass = API key.

## Open (not yet scheduled)

- fal balance top-up → then run the live model sweep (one cheap job per family across the 13 video + 11 image models)
- Supabase email rate limit is 2/hour (default) — raise it in Authentication → Rate Limits now that delivery is on Go Farther
- Supabase Site URL is likely still `localhost:3000` (Authentication → URL Configuration → set to `https://isibi.ai`)
- User should change their password via the sidebar "Change password" button (the temp one appeared in a chat log)
- Mobile layout (sidebar/chat history hidden below 900px)
