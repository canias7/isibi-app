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
import fs, { readFileSync, readdirSync } from "node:fs";

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

// ── what a docs-only commit must not do ───────────────────────────────────────

test("a docs-only commit does not deploy, and so does not pay for a build", () => {
  // The chain is push → Deploy → `build smoke`, and `build smoke` spends two
  // real model calls plus a Neon project every run. Three commits in one
  // stretch of this session touched nothing but CLAUDE.md and docs/, deployed
  // an identical Worker, and then paid for a full site build to prove it still
  // worked.
  const ignore = yml.match(/paths-ignore:\n((?:\s+-\s+.*\n)+)/);
  assert.ok(ignore, "the deploy has no paths-ignore — every docs commit pays for a build");
  const globs = ignore[1].split("\n").map((l) => (l.match(/-\s+'([^']+)'/) || [])[1]).filter(Boolean);
  assert.ok(globs.includes("**.md"), "markdown anywhere must not trigger a deploy");
  assert.ok(globs.includes("docs/**"), "docs/ must not trigger a deploy");
});

test("nothing the deploy SHIPS is a file the filter now ignores", () => {
  // THE PREMISE THE FILTER RESTS ON, asserted rather than remembered. The
  // failure it guards against is silent in the worst way: put something the
  // platform serves into a `.md` and changes to it simply stop reaching
  // production, with a green tick on every commit.
  //
  // Two ways a `.md` could really ship, and the first draft of this test
  // checked neither properly — it scanned for a quoted filename and a mutant
  // inserting `"see docs/components.md"` walked straight past it, because the
  // pattern could not cross the space. Checked at the two places it matters
  // instead of by grepping for a substring:
  //
  //   1. THE MODULE GRAPH. `worker.js` and every `site-*`/`builder/*` module it
  //      pulls in — an import is the only way a file becomes part of the
  //      bundle. (A Worker has no filesystem, so nothing can be read at
  //      runtime either.)
  //   2. THE ASSETS DIRECTORY. `wrangler.jsonc` serves `./public` wholesale, so
  //      anything in there is public even though nothing imports it.
  const roots = [new URL("../worker.js", import.meta.url)];
  for (const dir of ["..", "../builder"]) {
    const d = new URL(dir + "/", import.meta.url);
    for (const f of fs.readdirSync(d)) if (f.endsWith(".mjs")) roots.push(new URL(f, d));
  }
  assert.ok(roots.length > 20, `only ${roots.length} modules scanned — the scan broke`);
  for (const u of roots) {
    const src = readFileSync(u, "utf8");
    const bad = [...src.matchAll(/(?:from|import|require)\s*\(?\s*["'`]([^"'`]+\.md)["'`]/g)].map((m) => m[1]);
    assert.deepEqual(bad, [], `${u.pathname.split("/").pop()} imports ${bad.join(", ")} — a docs-only commit would not redeploy it`);
  }

  const conf = readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8");
  const served = (conf.match(/"directory":\s*"([^"]+)"/) || [])[1];
  assert.equal(served, "./public", "the assets directory moved — re-point this guard");
  const inPublic = fs.readdirSync(new URL("../public/", import.meta.url)).filter((f) => f.toLowerCase().endsWith(".md"));
  assert.deepEqual(inPublic, [], `public/ serves ${inPublic.join(", ")} — a docs-only commit would not redeploy it`);
});

// A DEPLOY WITHOUT THE TWO REAL BUILDS — and the marker that must not be GitHub's.
//
// `build smoke` spends two Sonnet calls, a Neon project and ~$0.40 every run.
// For a change it cannot prove anything about (a mail provider swap, a comment,
// a workflow edit) that is pure waste, so `[skip smoke]` in the commit message
// ships the deploy and skips the builds.
//
// THE DANGER IS REACHING FOR GITHUB'S OWN MARKER INSTEAD. That one suppresses
// EVERY workflow for the push — including the deploy — so the change would not
// ship at all, with a green tick and no failed run to notice. It happened here
// on 2026-07-29 from a commit message that merely explained the marker.
test("a deploy can skip the smoke builds, and not by suppressing the deploy", () => {
  const y = readFileSync(new URL("../.github/workflows/build-smoke.yml", import.meta.url), "utf8");

  const gate = (y.match(/\n\s*if: >-\n([\s\S]*?)\n\s*steps:/) || [])[1];
  assert.ok(gate, "the smoke job's gate is gone or reshaped");
  assert.match(gate, /!contains\(github\.event\.workflow_run\.head_commit\.message, '\[skip smoke\]'\)/,
    "the skip marker is not read off the deploy's own head commit");
  // The deploy-succeeded half must survive alongside it — a gate that only
  // checks the marker would smoke-test a FAILED deploy.
  assert.match(gate, /workflow_run\.conclusion == 'success'/,
    "the gate stopped requiring a successful deploy");
  // And a hand-triggered run must not be vetoable by a commit message.
  assert.match(gate, /workflow_dispatch/, "workflow_dispatch lost its exemption");

  // WHERE THE MARKER HAS TO GO, stated in the workflow because getting it wrong
  // is silent: the gate reads the DEPLOY's head commit, so on a merge that is
  // the MERGE commit and not the branch commit it came from. Put it on the
  // branch commit alone and the run happens anyway, at two real builds.
  assert.match(y, /ON A MERGE IT IS THE MERGE COMMIT/,
    "the note about where the marker must go is gone — it is the part that is easy to get wrong");

  // THE MARKER IS OURS. Every spelling GitHub itself recognises would take the
  // deploy down with the smoke run, which is the opposite of what this is for.
  for (const github of GITHUB_MARKERS) {
    assert.ok(!y.includes(github),
      `build-smoke.yml names ${github} — GitHub suppresses EVERY workflow for that push, ` +
      "so the deploy would not ship either");
  }
});

// Every spelling GitHub itself treats as "suppress every workflow for this
// push". Named once so the checks below cannot drift apart from each other.
const GITHUB_MARKERS = ["[skip ci]", "[ci skip]", "[no ci]", "[skip actions]", "[actions skip]"];

// THE SAME ESCAPE HATCH ON THE OTHER PAID WORKFLOW, and the reason it needed
// one is `worker.js`: `schema gen eval` watches it, and most commits here touch
// it for reasons that have nothing to do with the designer's prompt — a comment
// fix, a route change, a wiring fix. Each of those bought a real model call to
// re-measure something nothing moved.
test("schema gen eval can be skipped too, and reads the PUSH payload", () => {
  const y = readFileSync(new URL("../.github/workflows/schema-gen-eval.yml", import.meta.url), "utf8");
  const gate = (y.match(/\n\s*if: >-\n([\s\S]*?)\n\s*runs-on:/) || [])[1];
  assert.ok(gate, "the eval job's gate is gone or reshaped");

  // THE COPY-PASTE TRAP, and it is silent: build smoke is triggered by another
  // workflow COMPLETING, so its payload is `workflow_run.head_commit`. This one
  // is triggered by the push itself, where that path is undefined — so the
  // borrowed expression never matches and the guard reads as working while
  // every push pays.
  assert.match(gate, /!contains\(github\.event\.head_commit\.message, '\[skip smoke\]'\)/,
    "the marker must be read off the PUSH's own head commit");
  assert.ok(!/workflow_run/.test(gate),
    "workflow_run has no meaning in a push-triggered workflow — this gate would never fire");
  assert.match(gate, /workflow_dispatch/, "a hand-triggered run must not be vetoable by a commit message");
  // The gate itself must not reach for GitHub's marker — that one takes the
  // deploy down with the eval, which is the opposite of what this is for. Said
  // of the GATE and not of the file, because this workflow legitimately WRITES
  // that marker into the results commit it pushes; see the next test.
  for (const github of GITHUB_MARKERS) {
    assert.ok(!gate.includes(github), `the eval's gate names ${github}, which would suppress the deploy too`);
  }
  // AND THE GATE MUST NOT BE NEUTERED, which is the failure the assertions above
  // cannot see: `workflow_dispatch || false && !contains(…)` keeps every string
  // they match and skips the eval on EVERY push, so a paid quality check quietly
  // stops running and nothing goes red. Found by mutation. Exactly two clauses,
  // and no `false`.
  const clauses = gate.split("||").map((s) => s.trim()).filter(Boolean);
  assert.equal(clauses.length, 2, "the gate should be exactly `dispatch || !contains(...)`: " + gate.replace(/\s+/g, " "));
  assert.ok(!/\bfalse\b|&&/.test(gate), "an extra condition here can only ever skip runs that should happen");
});

// GITHUB'S MARKER MAY ONLY APPEAR IN A COMMIT A WORKFLOW WRITES.
//
// This is the check the 2026-07-29 incident earned, and it had only ever been
// applied to build-smoke.yml. It happened AGAIN on 2026-08-16, one layer out: a
// squash MERGE MESSAGE explaining why that marker is the wrong one to reach for
// contained it, GitHub scanned the whole message, and the merge landed on main
// with nothing deployed and nothing tested — a green tick and no failed run to
// notice. That half cannot be tested from here (a commit message is not in the
// tree); what this holds is the half that can be, which is that no copy sits in
// a workflow where somebody pastes it out of context.
//
// THE ONE LEGITIMATE USE IS A SELF-PUSH GUARD, and the first draft of this test
// forbade it — a false alarm on two correct files, which this repo rates worse
// than the miss. `page gen eval` and `schema gen eval` both commit their results
// to main, and main triggers Deploy, and Deploy triggers them: without the
// marker on THAT commit each re-runs itself forever, at a model call a cycle.
// Allowed on a `git commit` line and refused everywhere else.
test("GitHub's suppress-everything marker appears only in commits a workflow writes", () => {
  const dir = new URL("../.github/workflows/", import.meta.url);
  const files = readdirSync(dir).filter((f) => /\.ya?ml$/.test(f));
  assert.ok(files.length >= 10, "the workflow scan found " + files.length + " files — a scan that stops matching reports a clean repo");
  let writes = 0;
  for (const f of files) {
    for (const [i, line] of readFileSync(new URL(f, dir), "utf8").split("\n").entries()) {
      const named = GITHUB_MARKERS.filter((m) => line.includes(m));
      if (!named.length) continue;
      assert.match(line, /git commit\b/,
        `${f}:${i + 1} names ${named[0]} outside a git commit. GitHub scans COMMIT MESSAGES for these, ` +
        "and a copy sitting in prose is one somebody pastes into one — suppressing every workflow for " +
        "that push, deploy included.");
      writes++;
    }
  }
  // The two self-push guards must still be there, or a re-run loop is one edit
  // away and this test would report a clean repo either way.
  assert.ok(writes >= 2, "expected the eval workflows' self-push guards, found " + writes);
});
