# isibi-app

AI agents platform at https://isibi.ai — dark studio design, neon-lime accent (#d9ff35).

## Structure

- Static frontend in `public/` (plain HTML/CSS/JS, no framework): `index.html` (agent select), `nova.html` (Nova · website builder), `zephyr.html` (Zephyr · image/video generator), shared `styles.css` + `chat.js`
- `worker.js` — Cloudflare Worker: serves assets, `/api/chat` (Workers AI, Llama with fallback list), `/api/video` + `/api/image` (fal.ai queue, per-kind model allowlists), `/api/video/poll` (proxies fal status/result so FAL_KEY stays server-side)
- Supabase project: fifa-tournament-hub (`ujrqdmmtcptvimazlhom`)

## Deploy

Push to `main` → GitHub Actions → Wrangler → Cloudflare Workers → isibi.ai (+ www). Secrets in GitHub Actions: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `FAL_KEY` (uploaded to the Worker each deploy). Work happens on a feature branch, merged to `main` via PR; deploys land in ~30-40s.

## Working rules

- **Always show UI changes as screenshots in the chat** (render the page headless and send the image) — the user reviews everything visually here.
- The user directs design; don't restyle beyond what's asked.
- Agents are fully separated: no cross-agent switching inside chat pages.
- Don't spend fal credits or Workers AI calls on tests without asking first.
