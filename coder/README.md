# Coder

A developer agent that works through a Linux terminal, built as **its own app**,
apart from the website builder (owner, 2026-11-05: "put all this in a different
folder", "make a different workers .js", "build your own container").

| Path | What it is |
|---|---|
| `worker.js` | Coder's own Cloudflare Worker, at `coder.gofarther.dev` |
| `wrangler.jsonc` | Its own config: name `gofarther-coder`, its own container and bucket |
| `src/coder-routes.mjs` | Its addresses (`/api/coder/...`): projects, message, follow, stop, download |
| `src/coder-auth.mjs` | Sign-in check (the same Supabase accounts as the builder) |
| `src/coder-cors.mjs` | Only the builder's page may call it from a browser |
| `src/coder-zip.mjs` | The project as a .zip |
| `container/` | Its own container image: the agent loop, the AI call, the safety checks, and the service that runs commands |
| `test/` | Its tests: `npm test` from this folder |

**The agent** has three tools: `bash` (run one command), `ask` (one question with
buttons) and `done` (finish). Everything else is ordinary Linux commands.

**Off by default:** `CODER_ON` is `"off"` in `wrangler.jsonc`; every `/api/coder/`
address answers 404 until it is `"on"`. Free while testing: nothing is charged.

**Deploy** (by hand, from this folder, only on the owner's word):

```
npx wrangler r2 bucket create gofarther-coder
npx wrangler secret put XAI_API_KEY
npx wrangler deploy
```

Nothing in the website builder's `worker.js`, `wrangler.jsonc`, `Dockerfile` or
deploy workflow mentions Coder (checked by `test/coder.test.mjs`, CD12).
