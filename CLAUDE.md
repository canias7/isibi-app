# Go Farther: Coder

**gofarther.dev is now only Coder** (owner, 2026-11-05: "delete everything except
the new coder we are building"). The website builder, the site serving on
gofarther.app and every other part of the old app were deleted from this
repository on 2026-11-05. The full old tree is in git history (the commit before
"Delete the old website builder").

> **At the start of every session, read
> [`docs/owner-preferences.md`](docs/owner-preferences.md).**
> [`docs/owner-notes.md`](docs/owner-notes.md) is the owner's running log, newest
> first. Search it; don't read it whole. Add a dated, plain-English entry for
> each change.

## What is here

| Path | What it is |
|---|---|
| `coder/worker.js` | Coder's Cloudflare Worker (`gofarther-coder`): the page and `/api/coder/*` |
| `coder/public/` | The page: sign-in (`auth.js`, `app.js`), then Coder's chat (`coder.js`, `coder.css`) |
| `coder/src/` | Routes, GitHub (App sign-in, encrypted tokens, pull requests), Supabase sign-in, the page's headers |
| `coder/container/` | Coder's own container: the agent loop (Grok, tools `bash`/`ask`/`done`), safety checks, git |
| `coder/test/` | `npm test` from `coder/` |
| `.github/workflows/deploy-coder.yml` | The deploy button (pressed by the owner) |
| `.github/workflows/retire-old-app.yml` | Deletes the old builder's Workers (`isibi-app`, `gofarther-front`); runs only when the box says DELETE |

How Coder works and how GitHub is set up: `coder/README.md`.

## Rules

- **Spending:** no paid run or model call without the owner's approval. Coder
  is free while testing, and only the accounts in `CODER_USERS` may use it.
- **Presses:** the owner presses every workflow run.
- **Git:** work on the designated branch. Merge to `main` only when the owner
  says so. No pull request unless asked.
- **Live data:** stored data from the old app (R2 site files, Neon databases,
  Supabase ledger) is kept. Delete none of it without the owner's word.
- **Secrets:** never read or print a secret's value. The owner types secrets in
  themselves.
- **Never write GitHub's skip-CI marker** anywhere, not even while explaining it.
- **Show UI changes as screenshots in the chat.** The owner directs the design.
- **Every change ships with tests**, an owner-notes entry and a push.
