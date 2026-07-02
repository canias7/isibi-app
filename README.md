# isibi-app

Connected to the Supabase project **fifa-tournament-hub** (`ujrqdmmtcptvimazlhom`, eu-west-2).

- API URL: https://ujrqdmmtcptvimazlhom.supabase.co
- Dashboard: https://supabase.com/dashboard/project/ujrqdmmtcptvimazlhom

## Setup

1. Copy `.env.example` to `.env` and fill in any server-side keys.
2. To use the Supabase CLI against this project: `supabase link --project-ref ujrqdmmtcptvimazlhom`

## Deployment (Cloudflare)

Pushes to `main` deploy to Cloudflare Workers via GitHub Actions (`.github/workflows/deploy.yml`),
serving the static site in `public/` per `wrangler.jsonc`.

One-time setup — add two repository secrets in GitHub → Settings → Secrets and variables → Actions:

- `CLOUDFLARE_API_TOKEN` — create at https://dash.cloudflare.com/profile/api-tokens (use the "Edit Cloudflare Workers" template)
- `CLOUDFLARE_ACCOUNT_ID` — shown on the right side of the Workers & Pages page in the Cloudflare dashboard

Local deploys work too: `npx wrangler deploy` (after `npx wrangler login`).
