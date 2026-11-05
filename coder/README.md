# Coder

A developer agent that works through a Linux terminal, built as **its own app**,
apart from the website builder (owner, 2026-11-05: "put all this in a different
folder", "make a different workers .js", "build your own container"). The code it
works on lives in **each user's own GitHub** (owner: "the code goes through their
GitHub account").

| Path | What it is |
|---|---|
| `worker.js` | Coder's own Cloudflare Worker, at `coder.gofarther.dev` |
| `wrangler.jsonc` | Its own config: name `gofarther-coder`, its own container and bucket |
| `src/coder-routes.mjs` | Its addresses (`/api/coder/...`): GitHub, projects, message, follow, stop |
| `src/coder-github.mjs` | Sign in with GitHub, the user's token (encrypted), repositories, pull requests |
| `src/coder-auth.mjs` | Go Farther sign-in (the same Supabase accounts as the builder) |
| `src/coder-cors.mjs` | Only the builder's page may call it from a browser |
| `container/` | Its own container image: the agent loop, the AI call, the safety checks, and the service that clones, runs commands, commits and pushes |
| `test/` | Its tests: `npm test` from this folder |

## How it works

1. The user connects GitHub: Coder sends them to GitHub's own sign-in, and they
   choose which repositories Coder may use.
2. They pick a repository. That is a Coder project.
3. Each message: Coder's container clones the repository (once), works on its
   own branch `coder/<project>`, runs commands (`bash`), asks with buttons (`ask`)
   and finishes (`done`).
4. When a piece of work ends, Coder commits, pushes the branch and opens a
   **pull request** into the main branch. The user merges it on GitHub. Coder never
   pushes to the main branch.

**The code is never stored with us.** Coder's bucket keeps the chat, the project
list and the GitHub connection (encrypted with `CODER_TOKEN_KEY`).

**The AI never sees the GitHub token.** Git runs in the service, as root, with
the token only in its own environment; every command the AI runs is started as
the unprivileged `dev` user, with no secrets in its environment. The token is
never written into the repository's settings.

**Off by default:** `CODER_ON` is `"off"`; every `/api/coder/` address answers
404 until it is `"on"`. Free while testing: nothing is charged.

## Setting up the GitHub App (the owner, once, about 10 minutes)

1. On GitHub: **Settings → Developer settings → GitHub Apps → New GitHub App**.
2. **Name:** `Go Farther Coder` (or any free name). **Homepage URL:** `https://gofarther.dev`.
3. **Callback URL:** `https://coder.gofarther.dev/api/coder/github/callback`.
   Tick **Expire user authorization tokens** (on by default).
   Tick **Request user authorization (OAuth) during installation**.
4. **Webhook:** untick **Active** (Coder does not use webhooks).
5. **Repository permissions:** **Contents: Read and write**, **Pull requests:
   Read and write**, **Metadata: Read-only** (always on). Nothing else.
6. **Where can this GitHub App be installed?** → **Any account** (so your users
   can install it on their own GitHub).
7. Create it. On its page note the **Client ID** and the app's short name in its
   public link (`github.com/apps/<short-name>`), then **Generate a new client secret**.
8. Fill in `coder/wrangler.jsonc`: `GITHUB_APP_CLIENT_ID` and `GITHUB_APP_SLUG`.
9. Save the secrets (they are typed into the terminal, never into chat or a file):

```
npx wrangler secret put GITHUB_APP_CLIENT_SECRET
openssl rand -base64 32 | npx wrangler secret put CODER_TOKEN_KEY
```

## Deploy (by hand, from this folder, only on the owner's word)

```
npx wrangler r2 bucket create gofarther-coder
npx wrangler secret put XAI_API_KEY
npx wrangler deploy
```

Nothing in the website builder's `worker.js`, `wrangler.jsonc`, `Dockerfile` or
deploy workflow mentions Coder (checked by `test/coder.test.mjs`, CD12).
