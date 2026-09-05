// THE CONTAINER MUST NOT PASS ITS API KEYS TO MODEL-WRITTEN CODE.
//
// `builder/build-keys.mjs` takes the two provider keys out of `process.env` at
// startup so that every child the build service spawns — including the one that
// runs the site's own server bundle, which IS the model's `src/routes/*.tsx` —
// inherits an environment that never had them.
//
// Three kinds of check here, and each covers what the others cannot:
//
//   1. DRIVEN. A real child process, spawned after a real import, asked what it
//      can see. This is the only one that survives an ALIAS (`const e =
//      process.env` and read `e.X` later), which no source scan can follow.
//   2. SCANNED. No builder file may read a secret off `process.env` outside
//      this module. The driven check cannot see a read that happens BEFORE the
//      delete; this can.
//   3. ORDERED. `build-keys.mjs` is imported before any other builder module in
//      `build-server.mjs`, because ESM evaluates imports depth-first in source
//      order — a module listed above it would run its own top-level code, and
//      therefore any `process.env` read of its own, while the keys were still
//      there.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { takeKeys, SECRET_ENV } from "../builder/build-keys.mjs";

const BUILDER = fileURLToPath(new URL("../builder/", import.meta.url));

/** Comments blanked LENGTH-PRESERVINGLY and WHOLE-LINE ONLY.
 *
 * Whole-line, because blanking from any `//` eats the rest of a line holding a
 * URL — the own-goal this repo has recorded, and one that here would silently
 * shrink what is scanned and report a clean sweep. Length-preserving so offsets
 * stay valid against the real text. */
const blank = (src) =>
  src.split("\n").map((l) => (/^\s*(\/\/|\*|\/\*)/.test(l) ? " ".repeat(l.length) : l)).join("\n");

const builderFiles = () =>
  fs.readdirSync(BUILDER).filter((f) => f.endsWith(".mjs")).map((f) => [f, fs.readFileSync(path.join(BUILDER, f), "utf8")]);

test("takeKeys reads a usable value and removes the name either way", () => {
  const env = { ANTHROPIC_API_KEY: "sk-real", XAI_API_KEY: "xai-real", PATH: "/usr/bin" };
  const got = takeKeys(env);
  assert.deepEqual(got, { ANTHROPIC_API_KEY: "sk-real", XAI_API_KEY: "xai-real" });
  assert.equal("ANTHROPIC_API_KEY" in env, false, "the name must be GONE, not merely undefined");
  assert.equal("XAI_API_KEY" in env, false);
  assert.equal(env.PATH, "/usr/bin", "anything not on the list is untouched");
});

test("an absent, empty or non-string value is still deleted, and is not returned as a key", () => {
  // DELETED UNCONDITIONALLY. "We did not recognise it, so we left it" is the
  // wrong direction — an unrecognised value is still bytes a child can read.
  for (const bad of ["", 0, null, false, ["sk-x"], { toString: () => "sk-x" }]) {
    const env = { ANTHROPIC_API_KEY: bad };
    const got = takeKeys(env);
    assert.equal("ANTHROPIC_API_KEY" in env, false, `not deleted for ${JSON.stringify(bad)}`);
    assert.equal("ANTHROPIC_API_KEY" in got, false, `an unusable value must not be handed on: ${JSON.stringify(bad)}`);
  }
  // An empty string in particular: passed on, it produces a request with an
  // empty Authorization header, which some providers answer 200 to with
  // degraded data rather than refusing.
  assert.deepEqual(takeKeys({ XAI_API_KEY: "" }), {});
});

test("takeKeys survives an environment that has none of them", () => {
  const env = { PATH: "/usr/bin" };
  assert.deepEqual(takeKeys(env), {});
  assert.deepEqual(env, { PATH: "/usr/bin" });
  assert.deepEqual(takeKeys(null), {}, "a missing environment must not throw the build service down at startup");
});

test("DRIVEN: a child spawned after the import cannot see either key", () => {
  // The property, end to end, in real processes — the only form of this check
  // that survives an alias taken before the delete.
  const probe = `
    import { BUILD_KEYS } from ${JSON.stringify(path.join(BUILDER, "build-keys.mjs"))};
    import { spawnSync } from "node:child_process";
    const seen = [];
    // implicit inheritance (what site-ssr.mjs does), explicit spread (what
    // run-step.mjs does through build-server.mjs), and the raw OS environ block.
    for (const opts of [{}, { env: { ...process.env } }]) {
      const r = spawnSync(process.execPath, ["-e",
        "process.stdout.write(String(process.env.ANTHROPIC_API_KEY) + '|' + String(process.env.XAI_API_KEY))"],
        { ...opts, encoding: "utf8" });
      seen.push(r.stdout);
    }
    const environ = spawnSync("sh", ["-c",
      "tr '\\\\0' '\\\\n' < /proc/self/environ | grep -cE '^(ANTHROPIC|XAI)_API_KEY=' || true"], { encoding: "utf8" });
    process.stdout.write(JSON.stringify({
      children: seen,
      environHits: environ.stdout.trim(),
      held: [BUILD_KEYS.ANTHROPIC_API_KEY, BUILD_KEYS.XAI_API_KEY],
    }));
  `;
  const out = execFileSync(process.execPath, ["--input-type=module", "-e", probe], {
    encoding: "utf8",
    env: { ...process.env, ANTHROPIC_API_KEY: "sk-secret-value", XAI_API_KEY: "xai-secret-value" },
  });
  const r = JSON.parse(out);

  // The module really did receive them — without this the check below passes
  // just as well against a container that was never given a key at all, which
  // is the vacuous shape this repo keeps recording.
  assert.deepEqual(r.held, ["sk-secret-value", "xai-secret-value"], "the keys must reach the module that took them");

  for (const child of r.children) assert.equal(child, "undefined|undefined", "a spawned child could read a key");
  assert.equal(r.environHits, "0", "the key is still in the child's real environ block");
});

test("no builder module reads a secret off process.env except build-keys.mjs", () => {
  // SCANNED, because the driven check above cannot see a read that happens
  // BEFORE the delete — a module evaluated earlier in the import graph.
  //
  // Matched as an ACCESS OFF `process.env`, never as a bare name: `build-call.mjs`
  // throws `new Error("ANTHROPIC_API_KEY is not set")` and `keysFrom` reads
  // `s.ANTHROPIC_API_KEY` off whatever object it was handed, and both are
  // correct. A bare-name scan would report those — a false alarm on correct
  // code, which this repo rates strictly worse than the miss.
  const direct = /process\s*\.\s*env\s*(?:\.\s*([A-Za-z_$][\w$]*)|\[\s*["']([^"']+)["']\s*\])/g;
  const destructured = /\{([^}]*)\}\s*=\s*process\s*\.\s*env/g;

  // EACH PATTERN PROVES ITS OWN OBSERVER IS ALIVE, against a constructed case
  // rather than against whatever the codebase happens to contain. A shared
  // count floor does not do it: the direct pattern alone clears any plausible
  // floor, so the destructured one could stop matching in silence — measured,
  // by blinding it and watching the sweep report a clean file. Which is the
  // negative-assertion failure this repo keeps recording, inside the guard
  // written to catch a leak.
  const fires = (re, s) => { re.lastIndex = 0; return re.test(s); };
  assert.ok(fires(direct, `process.env.ANTHROPIC_API_KEY`), "the direct pattern has stopped matching");
  assert.ok(fires(direct, `process.env["XAI_API_KEY"]`), "the subscript form has stopped matching");
  assert.ok(fires(destructured, `const { XAI_API_KEY } = process.env;`), "the destructuring pattern has stopped matching");

  const offenders = [];
  let scannedAccesses = 0;

  for (const [name, raw] of builderFiles()) {
    if (name === "build-keys.mjs") continue;
    const src = blank(raw);
    for (const m of src.matchAll(direct)) {
      scannedAccesses++;
      const read = m[1] || m[2];
      if (SECRET_ENV.includes(read)) offenders.push(`${name}: process.env.${read}`);
    }
    for (const m of src.matchAll(destructured)) {
      scannedAccesses++;
      for (const part of m[1].split(",")) {
        const read = part.split(":")[0].trim();
        if (SECRET_ENV.includes(read)) offenders.push(`${name}: const { ${read} } = process.env`);
      }
    }
  }

  assert.deepEqual(offenders, [], `a secret is read off process.env outside build-keys.mjs:\n  ${offenders.join("\n  ")}`);
  // A scan that silently stopped matching reports a clean sweep over nothing.
  assert.ok(scannedAccesses >= 3, `the process.env scan found only ${scannedAccesses} accesses — it has stopped matching`);
});

test("build-server.mjs imports build-keys before any other builder module", () => {
  // ORDERED. ESM evaluates imports depth-first in SOURCE ORDER, so a builder
  // module listed above this one runs its own top-level code — and any
  // `process.env` read in it — while the keys are still in the environment.
  // Nothing spawns at import time today, which is what makes the ordering
  // belt-and-braces rather than load-bearing; it is one import away from
  // mattering, which is why it is pinned rather than left to luck.
  //
  // BOTH IMPORT FORMS, and the bare one is the whole point: `build-keys.mjs` is
  // imported for its EFFECT, so it has no `from` clause — a scan written only
  // for `import … from "…"` cannot see the one import it exists to locate, and
  // would report whichever module came next as "first". That is what the first
  // draft of this did, and it went red against correct code.
  const src = blank(fs.readFileSync(path.join(BUILDER, "build-server.mjs"), "utf8"));
  const local = [...src.matchAll(/^import (?:.*? from )?"(\.\/[^"]+)"/gm)].map((m) => m[1]);
  assert.ok(local.length > 5, `only ${local.length} local imports found — this scan has stopped matching`);
  assert.ok(local.includes("./build-keys.mjs"), "the bare side-effect import form is invisible to this scan");
  assert.equal(local[0], "./build-keys.mjs", `build-keys.mjs must be the first builder import, not ${local[0]}`);
});

test("the Dockerfile ships build-keys.mjs", () => {
  // A missing COPY is not a degraded build: node throws ERR_MODULE_NOT_FOUND at
  // startup, nothing ever listens on 8080, and Cloudflare reports it as "the
  // container is not running" — two messages, one cause. `dockerfile.test.mjs`
  // walks the import graph and would catch it too; this names it, because the
  // file this one protects is the one whose absence is a SECURITY change rather
  // than an outage.
  // AT THE REPOSITORY ROOT since 2026-09-04 (the image carries the Worker's
  // module graph as the job runtime, and a context rooted at builder/ cannot
  // reach above itself), so the COPY names `builder/build-keys.mjs`.
  const df = fs.readFileSync(path.join(BUILDER, "..", "Dockerfile"), "utf8");
  assert.match(df, /\bbuilder\/build-keys\.mjs\b/, "build-keys.mjs is not COPYd into the build image");
});
