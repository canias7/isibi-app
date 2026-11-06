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
| `src/coder-auth.mjs` | Go Farther sign-in (Supabase), the Worker's proof that both steps (password, then the emailed code) happened, the password it remembers and the count of code checks |
| `src/coder-signin.mjs` | `/api/auth/...`: the password step, the emailed code, sign-up, refresh, sign-out |
| `src/coder-page.mjs` | Serves the page with its safety headers |
| `src/coder-cors.mjs` | Only gofarther.dev may call it from another address |
| `container/` | The container image: the agent loop (one tool: `bash`), the AI call (Grok 4.7 with an effort level), the safety checks, and the service that clones, runs commands, commits and pushes |
| `test/` | `npm test` from this folder |

## How it works

1. The user signs in, then connects GitHub: Coder sends them to GitHub's own
   sign-in, and they choose which repositories Coder may use.
2. They pick a repository. That is a Coder project.
3. Each message: Coder's container clones the repository (once), works on its
   own branch `coder/<project>`, runs commands (`bash`, its only tool)
   and finishes by answering in words.
4. When a piece of work ends, Coder commits, pushes the branch and opens a
   **pull request** into the main branch. The user merges it on GitHub. Coder
   never pushes to the main branch.

**Sign-in is both steps, every time** (the audit, 2026-11-06). The password
step gives the page a 15-minute ticket and ends Supabase's own session for it;
the emailed code is only taken with that ticket. The code step gives the
session and the Worker's proof, which the page sends with every call
(`x-coder-proof`). A Supabase session without the proof gets "Sign in again."
Tickets and proofs are signed with a key made from `CODER_TOKEN_KEY`; without
it nobody can sign in.

- **The password the Worker remembers.** Anyone with the inbox alone could ask
  Supabase for a code and then set a new password there. So the first time an
  account's password passes the password step here, the Worker keeps its own
  scrambled copy (`coder/<user id>/signin-pin.json` in the bucket), and after
  that the password step wants that same password too. Coder has no page to
  change a password. **If a password is ever changed at Supabase** (the
  dashboard, a reset email), Coder refuses it with "That email and password do
  not match." until that one file is deleted; the next sign-in then remembers
  the new password. Until an account's first password step here, nothing is
  remembered for it, and the same is true right after `CODER_TOKEN_KEY` changes.
- **Wrong codes are counted.** Each email gets 5 code checks per 15 minutes,
  before Supabase is asked. Then the card says to wait and start again. A right
  code starts the count again; a new password step does not.

**The code is never stored with us.** Coder's bucket keeps the chat, the project
list and the GitHub connection (encrypted with `CODER_TOKEN_KEY`), and for
sign-in the remembered passwords (scrambled) and the code counts.

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
key is derived from the client secret during the deploy. It also signs the
sign-in proofs, so a new client secret means everyone connects GitHub and signs
in again.
