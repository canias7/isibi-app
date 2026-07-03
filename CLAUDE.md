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

- Auto-clear attachments after a successful generation (they silently ride along on the next prompt)
- Make the compose→review step origin-aware (review card can pop into the wrong chat if the user switches while "Writing the prompt")
- Restore the generation loader when switching back to a chat with a job in flight
- Per-chat send lock instead of the global one (can't send anywhere while any generation runs)
- Storage lifecycle: DELETE policy on the `media` bucket + gallery/cleanup UI (currently INSERT-only, grows forever, 1GB free tier)
- Lightbox loading state (fullscreen video is black while buffering)
- Perf: drop per-bubble `backdrop-filter` on `.msg.agent` (long chats stack dozens of blur layers); keep blur on big surfaces only
- Static voice previews — **user adds the files**: drop MP3s at `public/voices/<name>.mp3`, lowercase (rachel.mp3, aria.mp3, sarah.mp3, laura.mp3, charlotte.mp3, alice.mp3, matilda.mp3, jessica.mp3, lily.mp3, roger.mp3, george.mp3, callum.mp3, liam.mp3, will.mp3, brian.mp3, daniel.mp3). The preview button already checks these before spending a TTS call.

## Open (not yet scheduled)

- Per-user rate limits on `/api/*` (top financial exposure once fal has balance — signups are open)
- fal balance top-up → then run the live model sweep (one cheap job per family across the 13 video + 11 image models)
- Go Farther email provider: key saved as `GO_FARTHER_API_KEY` in Edge Function secrets; blocked on their API docs URL, then deploy a Send-Email Auth Hook so sign-in codes actually deliver
- Supabase Site URL is likely still `localhost:3000` (Authentication → URL Configuration → set to `https://isibi.ai`)
- Rotate the temp password set for aniascapital@gmail.com (it appeared in a chat log); no change-password UI exists yet
- Mobile layout (sidebar/chat history hidden below 900px)
