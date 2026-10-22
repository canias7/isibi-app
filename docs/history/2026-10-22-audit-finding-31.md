# Audit finding 31 (2026-10-22): the gateway's key is the Worker's alone (A16-1, A12-7)

Finding 31 of `docs/audits/2026-10-17-builder-audit.md` (fix-order batch 3, which closes A16-1 and A12-7 together). Offline; nothing spent, nothing deployed, no secret value read.

## Re-verified against the current code (`3fda8174d`)

- **Real.** `JOB_ENV_NAMES` (`builder/edit-job.mjs`) listed `SITE_SECRETS_KEY`; `jobSecrets` put it in every launch; `readLaunch` refused only `SUPABASE_SERVICE_KEY` and `CREDITS_MINT_SECRET` (`LAUNCH_NEVER`); `makeContainerEnv` copied it onto the job's env.
- The same value was the gateway's root: `gatewayKeyFor` (`worker.js`) was `gatewayKey(env.SITE_SECRETS_KEY)`, an HMAC with a fixed label, used by the gateway's `verify`, the fire's mint, the `/scope` re-mint and the job probe. `gatewayKey` and `signJobToken` are exported from the module the container imports, so a job process could mint a token for any id, site and account.
- And it is the v2 vault key: `keyMaterial(env, 2)` in `site-secrets.mjs` is `SITE_SECRETS_KEY + "|site-secrets-v2"`, which with the job's `NEON_API_KEY` opens every site's `_secrets`.
- **No job decrypts.** Every `readSecret` caller is a Worker route, the data proxy's hooks or the cron/queue: `handleCheckout`, `sendMail`, `inboundDeps`, `siteApiDeps`, `turnstileConfig`, `siteSmsSecrets`, `siteMailSecrets` and the vault route; `addSecret` only in the vault route. The container never fires a job (`JOB_RUNNER_*` are not on the list, so `fireContainerJob` answers `off` there first). So no per-job secret op was added: there is no reader for one.

## The fix (`43c5252df`)

- `builder/job-gateway.mjs`: `GATEWAY_KEY_NAMES = ["GATEWAY_SIGNING_KEY", "SITE_SECRETS_KEY"]` and `gatewaySecretOf(env)`: the dedicated `GATEWAY_SIGNING_KEY` when it holds at least 32 characters, otherwise `SITE_SECRETS_KEY` as before (same derivation and label, so tokens in flight across the deploy keep verifying), otherwise none.
- `worker.js`: `gatewayKeyFor` reads only through `gatewaySecretOf`, cached by name and secret; the runtime route's `runner` readiness reads the same.
- `builder/edit-job.mjs`: `SITE_SECRETS_KEY` off `JOB_ENV_NAMES`.
- `builder/container-job.mjs`: `LAUNCH_NEVER` adds `GATEWAY_KEY_NAMES`; a launch carrying either is refused by name.
- `.github/workflows/deploy.yml`: `GATEWAY_SIGNING_KEY` in the `secrets:` list with `|| 'not-a-key'` (optional, per `docs/deploy.md`); the placeholder is shorter than 32 characters, so it reads as unset.

**For the owner before or after deploy**: the GitHub Actions secret `GATEWAY_SIGNING_KEY` (`openssl rand -hex 32`). Optional: without it the key still derives from `SITE_SECRETS_KEY`, which no job holds any more. Adding it ends the tokens of jobs running at that moment, once; nothing stored depends on it. The container image rolls (its inputs changed).

## Tests

- New, in `test/container-job.test.mjs`:
  - through the real gateway (`worker.fetch`, `/api/job/<id>/r2`): with `GATEWAY_SIGNING_KEY` set, a token made from `SITE_SECRETS_KEY` answers 401 and one from the dedicated key 200; with the placeholder, the fallback verifies and a token made from the placeholder answers 401;
  - the fire (the queue consumer, driven): the launch's token verifies with the dedicated key and not with the old derivation; the launch carries neither name; `readLaunch` refuses each by name;
  - a guard: every name `gatewaySecretOf` reads is in `GATEWAY_KEY_NAMES`, none is in `JOB_ENV_NAMES`, a job env built from every listed name derives no key, and `gatewayKeyFor` reads only through `gatewaySecretOf`.
- Updated by name (they required the key to travel): `container-job.test.mjs` "the secrets a job carries…" and "…the consumer FIRES the job…"; `sb-gateway.test.mjs` "THE REAL CONSUMER INSIDE A CONTAINER ENV…" (its launch no longer sends the key), "a v2 launch names the Supabase origin…" (the list and the message), "the secrets list no longer carries…".
- **Red check**: the new file over `3fda8174d`'s code: 5 fail (the three new cases and the two updated ones), 18 pass.
- **Sweep**: `scripts/mutants/audit-finding-31.json` over `container-job` and `sb-gateway`: 7 of 7 killed, the comment-only control survived.
- **Full suite**: `11636 / 11630 / 3 / 3` locally. The 3 failures are not this change's: `media-verify`'s real-Chromium browser case fails the same on the base `3fda8174d` alone (10 pass / 1 fail); `no-generated-deps` failed only in the full run, its scan reaching another helper's `.claude/worktrees/` (it passes on its own); the third is a file-level failure from the same scans. `container-job` and `sb-gateway` alone: all green.
