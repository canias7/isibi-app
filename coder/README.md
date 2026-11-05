# Coder

gofarther.dev. A developer agent that works through a Linux terminal on the
code in **each user's own GitHub**.

| Path | What it is |
|---|---|
| `worker.js` | The Cloudflare Worker (`gofarther-coder`): the page and `/api/coder/*` |
| `wrangler.jsonc` | Its config: addresses, container, bucket, settings |
| `public/` | The page: sign-in (`auth.js`, `app.js`), the tabs (Coder, Gloopy agent), Coder's chat (`coder.js`, `coder.css`) |
| `src/coder-routes.mjs` | `/api/coder/...`: GitHub, projects, message, follow, stop |
| `src/coder-github.mjs` | Sign in with GitHub, the user's token (encrypted), repositories, pull requests |
| `src/coder-auth.mjs` | Go Farther sign-in (Supabase) |
| `src/coder-page.mjs` | Serves the page with its safety headers |
| `src/coder-cors.mjs` | Only gofarther.dev may call it from another address |
| `container/` | The container image: the agent loop, the AI call (Grok 4.7 with an effort level), the safety checks, and the service that clones, runs commands, commits and pushes |
| `test/` | `npm test` from this folder |

## How it works

1. The user signs in, then connects GitHub: Coder sends them to GitHub's own
   sign-in, and they choose which repositories Coder may use.
2. They pick a repository. That is a Coder project.
3. Each message: Coder's container clones the repository (once), works on its
   own branch `coder/<project>`, runs commands (`bash`), asks with buttons (`ask`)
   and finishes (`done`).
4. When a piece of work ends, Coder commits, pushes the branch and opens a
   **pull request** into the main branch. The user merges it on GitHub. Coder
   never pushes to the main branch.

**The code is never stored with us.** Coder's bucket keeps the chat, the project
list and the GitHub connection (encrypted with `CODER_TOKEN_KEY`).

**The AI never sees the GitHub token.** Git runs in the service, as root, with
the token only in its own environment. Every command the AI runs is started as
the unprivileged `dev` user, with no secrets in its environment. The token is
never written into the repository's settings.

**While testing:** only the accounts in `CODER_USERS` may use it, and nothing is
charged. `CODER_ON` `"off"` makes every `/api/coder/` address answer 404.

## The GitHub App

Registered: **gofarther-coder** (Client ID `Iv23li7CSEGqBSxEqQU7`), callback
`https://coder.gofarther.dev/api/coder/github/callback`, permissions Contents and
Pull requests (read and write) and Metadata (read), installable by any account.

## Deploy

The **deploy coder** button (`.github/workflows/deploy-coder.yml`), pressed by
the owner. It needs these GitHub secrets: `CLOUDFLARE_API_TOKEN`,
`CLOUDFLARE_ACCOUNT_ID`, `XAI_API_KEY`, `CODER_GITHUB_CLIENT_SECRET`. The token
key is derived from the client secret during the deploy.
