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
| `coder/container/` | Coder's own machine: the agent loop (Grok, with its tools; it finishes by answering in words), safety checks, git, the sealed room and the admin sandbox |
| `coder/test/` | `npm test` from `coder/` |
| `coder/desktop/` | The desktop app for Mac and Windows (Electron): gofarther.dev in its own window; `npm test` from `coder/desktop/` |
| `coder/mobile/` | The phone app for iPhone and Android (Capacitor): gofarther.dev in its own app; `npm test` from `coder/mobile/` |
| `.github/workflows/build-mobile.yml` | The phone build button: Android `.apk`; iPhone built for the simulator (TestFlight needs the owner's Apple certificates) |
| `.github/workflows/build-desktop.yml` | The desktop build button: Mac `.dmg` and Windows `.exe`; tick "publish" for a public release |
| `.github/workflows/deploy-coder.yml` | The deploy button (Claude may press it when the owner says deploy) |
| `.github/workflows/list-old-stuff.yml` | Lists what is left of the old app (read-only) |
| `.github/workflows/delete-old-stuff.yml` | Deletes the old app's named Workers, sites, storage and branches (lists in `.github/old-stuff/`); runs only when the box says DELETE |

How Coder works and how GitHub is set up: `coder/README.md`.

## Rules

- **Spending:** no paid run or model call without the owner's approval. Coder
  is free while testing, and only the accounts in `CODER_USERS` may use it.
- **Presses:** Claude may run workflows itself when the owner asks (owner, 2026-11-05: "delete that rule, u can do it"). The deletion workflows still need the owner's word for each run.
- **Git:** work on the designated branch. Merge to `main` only when the owner
  says so. No pull request unless asked.
- **Live data:** stored data from the old app (R2 site files, Neon databases,
  Supabase ledger) is kept. Delete none of it without the owner's word.
- **Secrets:** never read or print a secret's value. The owner types secrets in
  themselves.
- **Never write GitHub's skip-CI marker** anywhere, not even while explaining it.
- **Show UI changes as screenshots in the chat.** The owner directs the design.
- **Test everything in the browser** (owner, 2026-11-08: "we need to test everything in the browser bro, pls, remember that"): every feature and fix is tried live on gofarther.dev in the browser, with Grok. No video recordings (owner, 2026-11-12: "for now on dont record anymore , pls"). Automated tests and checks on Claude's side are not enough on their own.
- **Every change ships with tests**, an owner-notes entry and a push.
