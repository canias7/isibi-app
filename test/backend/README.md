# Offline backend harness

Runs the **real** `worker.js` fetch handler against an in-memory SQLite database, so the
per-site backend routes (`/api/db/<slug>/…` and `/api/site/backend/…`) can be exercised
end-to-end with no Cloudflare/Supabase access and no spend.

How it works:
- `resolve.mjs` + `register.mjs` — an ESM loader that stubs the two native/wasm deps the
  worker imports (`@cf-wasm/photon`, `@cloudflare/containers`) so it imports under plain
  Node unmodified.
- `harness.mjs` — installs a `globalThis.fetch` mock that backs Cloudflare D1 with
  in-memory `node:sqlite`, plus the `site_backends` slug→uuid ledger and owner auth. Also
  exports a small client (`ensure`, `schema`, `signup`, `login`, `get/post/patch/del`) and
  an assertion tally.

Run a batch test (Node ≥ 22 for `node:sqlite`):

```sh
node --import ./test/backend/register.mjs test/backend/batch16.test.mjs
```

This is a fast pre-flight quality gate — the authoritative check is still a live pass
against a real deployed test backend before merging to `main`.
