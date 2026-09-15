#!/usr/bin/env bash
# DEPLOY THE AGENT WORKER. One command, run by hand, never by CI.
#
#   cd agent-builder && ./scripts/deploy.sh
#
# It needs `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` in the environment
# (the same two the rest of this repository deploys with) and it needs
# SUPABASE_SERVICE_KEY to have been put in FIRST — see `docs/deploy.md` for why
# the order matters on this account.
#
# NOTHING ABOUT THIS RUNS AUTOMATICALLY. The repository's own deploy workflow runs
# `wrangler deploy` at the ROOT against the root config and never reads this
# directory, so this Worker only ever ships when somebody runs this script.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$HERE/.."

# THE SAME WRANGLER THE REST OF THE REPOSITORY USES. Pinned, because a CLI that
# differs from the one the other product deploys with is a second variable nobody
# wants when something goes wrong.
WRANGLER="wrangler@4.107.0"
QUEUE="$(node -e 'const fs=require("fs");const c=JSON.parse(fs.readFileSync("wrangler.jsonc","utf8").replace(/^\s*\/\/.*$/gm,""));process.stdout.write(c.queues.producers[0].queue)')"
NAME="$(node -e 'const fs=require("fs");const c=JSON.parse(fs.readFileSync("wrangler.jsonc","utf8").replace(/^\s*\/\/.*$/gm,""));process.stdout.write(c.name)')"

for v in CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID; do
  if [ -z "${!v:-}" ]; then echo "missing $v in the environment" >&2; exit 2; fi
done

echo "── the tests, before anything ships ────────────────────────────────────"
npm test --silent

echo
echo "── the queue: $QUEUE ───────────────────────────────────────────────────"
# **THE VERDICT IS PRINTED, NOT SWALLOWED.** `queues create` fails when the queue
# already exists, which is the ordinary steady state — so `|| true` is needed. But a
# token WITHOUT the Queues edit permission fails in a way that looks identical to
# that from a silent `|| true`, and would only surface later as a Worker answering
# 503 for a binding that was never created. This is the root product's own recorded
# lesson, reused rather than re-learned.
out="$(npx --yes "$WRANGLER" queues create "$QUEUE" 2>&1 || true)"
echo "$out"
if echo "$out" | grep -qiE "created queue|already exists"; then
  echo "QUEUE OK — $QUEUE exists"
else
  echo "QUEUE NOT CONFIRMED. Do NOT continue: the Worker requires this binding and"
  echo "will answer 503 on every request without it. The likeliest cause is"
  echo "CLOUDFLARE_API_TOKEN lacking the Queues edit permission — add it at"
  echo "Cloudflare > My Profile > API Tokens."
  exit 1
fi

echo
echo "── deploy: $NAME ───────────────────────────────────────────────────────"
npx --yes "$WRANGLER" deploy -c wrangler.jsonc

echo
echo "── what shipped ────────────────────────────────────────────────────────"
npx --yes "$WRANGLER" deployments list -c wrangler.jsonc 2>&1 | head -20 || true
echo
echo "Next: verify it. See docs/deploy.md."
echo "  AGENT_URL=https://$NAME.<your-subdomain>.workers.dev \\"
echo "  AGENT_USER_EMAIL=… AGENT_USER_PASSWORD=… SUPABASE_SERVICE_KEY=… \\"
echo "  node scripts/verify-live.mjs"
