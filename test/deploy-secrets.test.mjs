// EVERY SECRET NAMED IN THE DEPLOY MUST BE SAFE TO BE MISSING, OR DELIBERATELY NOT.
//
// `wrangler-action` fails the ENTIRE run with "Value for secret X not found in
// environment" when a name in its `secrets:` list has an empty value. So adding
// an optional secret to that list before it exists in GitHub Actions takes the
// whole platform's deploys down — and the failure names the secret, which reads
// like a problem with that feature rather than with every merge.
//
// It happened on 2026-08-07: `DOMAIN_CONNECT_KEY` was listed the moment the
// signing work landed, the key had not been generated yet, and three consecutive
// merges to main uploaded nothing and deployed nothing while reporting a failure
// about a feature none of them touched.
//
// The rule this enforces: a listed secret is either REQUIRED — the platform
// genuinely cannot run without it, and a missing one SHOULD stop the deploy — or
// optional, in which case it needs a `||` fallback so an absent value cannot
// break everything else. Adding one now forces that choice explicitly.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const yml = readFileSync(new URL("../.github/workflows/deploy.yml", import.meta.url), "utf8");

/**
 * Secrets the platform cannot run without. A missing one here SHOULD fail the
 * deploy loudly rather than ship a Worker that half-works: no FAL_KEY is no
 * generation at all, no SUPABASE_SERVICE_KEY means the Stripe webhook cannot
 * mint credits somebody has paid for.
 *
 * Deliberately a short list. Anything not on it must tolerate being absent.
 */
const REQUIRED = new Set([
  "FAL_KEY", "ANTHROPIC_API_KEY", "GEMINI_API_KEY",
  "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "CREDITS_MINT_SECRET",
  "SUPABASE_SERVICE_KEY", "COMPOSIO_API_KEY", "NEON_API_KEY",
  "SITE_SECRETS_KEY", "CLOUDFLARE_API_TOKEN",
]);

/** The names in the action's `secrets:` block. */
function listedSecrets(src) {
  const start = src.indexOf("secrets: |");
  assert.ok(start > 0, "deploy.yml no longer has a `secrets: |` block");
  const rest = src.slice(start + "secrets: |".length);
  const out = [];
  for (const line of rest.split("\n")) {
    if (!line.trim()) continue;
    const m = line.match(/^\s+([A-Z][A-Z0-9_]*)\s*$/);
    if (!m) break; // the block ended — the next key (`env:`) is not a bare name
    out.push(m[1]);
  }
  return out;
}

/** name → the right-hand side of its `env:` entry. */
function envExpressions(src) {
  const out = new Map();
  for (const m of src.matchAll(/^\s+([A-Z][A-Z0-9_]*):\s*(\$\{\{[^\n]*\}\})\s*$/gm)) out.set(m[1], m[2]);
  return out;
}

const listed = listedSecrets(yml);
const env = envExpressions(yml);

test("the parser sees the real list, not an empty one", () => {
  // Without this every assertion below passes vacuously on a block this stopped
  // being able to read — the shape of failure this repo keeps recording.
  assert.ok(listed.length >= 10, `only found ${listed.length} listed secrets`);
  assert.ok(listed.includes("FAL_KEY") && listed.includes("DOMAIN_CONNECT_KEY"), listed.join(","));
  assert.ok(env.size >= listed.length, `only found ${env.size} env expressions`);
});

test("every listed secret has an env entry", () => {
  // A name in the list with no env entry at all is the same total failure, and
  // it is what a typo produces.
  for (const name of listed) {
    assert.ok(env.has(name), `${name} is uploaded but never given a value`);
  }
});

test("every OPTIONAL listed secret tolerates being absent", () => {
  for (const name of listed) {
    if (REQUIRED.has(name)) continue;
    const expr = env.get(name);
    assert.match(expr, /\|\|/,
      `${name} is optional but has no fallback — an unset value fails the WHOLE deploy, ` +
      `not just this feature. Add ` + "`|| '…'`" + ` or add it to REQUIRED.`);
  }
});

test("a REQUIRED secret is NOT given a fallback", () => {
  // The inverse, and it matters just as much: a fallback on a required secret
  // turns "the deploy stops" into "the platform ships with a broken credential
  // and finds out from a customer".
  for (const name of listed) {
    if (!REQUIRED.has(name)) continue;
    assert.ok(!/\|\|/.test(env.get(name)), `${name} is REQUIRED and must fail loudly, not fall back`);
  }
});

test("the Domain Connect fallback cannot be mistaken for a key", () => {
  // `rsaSigner` base64-decodes its input, so this must be something `atob`
  // refuses — then the throw is caught and the signer is null, which is exactly
  // the unset behaviour. A fallback that happened to decode would be a key that
  // signs links no provider can verify.
  const expr = env.get("DOMAIN_CONNECT_KEY");
  const fallback = expr.match(/\|\|\s*'([^']*)'/);
  assert.ok(fallback, "no literal fallback to check");
  assert.throws(() => atob(fallback[1]), "the fallback decodes as base64 — pick one that cannot");
});
