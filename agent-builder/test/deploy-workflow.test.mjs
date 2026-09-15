/**
 * THE DEPLOY IS HELD TO THE VERSION IT UPLOADED.
 *
 * This product's deployment is one workflow file outside `agent-builder/`, and until
 * now nothing read it — which is this repository's own recorded trap: *the thing that
 * runs your guards is not itself guarded unless somebody writes it down*, and it fails
 * in the safe-looking direction, because a workflow that stops checking produces no
 * red run.
 *
 * WHAT IT COST. Run 34938312961 deployed version `e3bdf22e…`, uploaded the runtime
 * secret 1.5 s later — which MINTS A VERSION OF ITS OWN and prints no id, measured as
 * `64ac3bb4…` stamped 06:45:09.382489Z — then asked `/health` once, two seconds in, got
 * the version from the deploy BEFORE last, and reported that as "the deployed version".
 * Sixty-nine checks passed against a deployment nobody had identified.
 *
 * So there are two properties here and they are different:
 *
 *   1. the run must END holding ONE version id, printed by the last step that changes
 *      the Worker — otherwise there is nothing to hold anything to;
 *   2. `/health` must be ASKED UNTIL it answers that id, because a version reaches
 *      Cloudflare's edges over seconds and an edge asked immediately answers honestly
 *      with the version it is still running.
 *
 * Neither is a statement about YAML formatting, so each is asserted as a property of
 * the run: which step comes after which, and what the comparison is made against.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const WORKFLOW = path.resolve(DIR, "..", ".github", "workflows", "agent-deploy.yml");

/**
 * The steps, in run order, as `{ name, body }`.
 *
 * **THERE IS NO YAML PARSER HERE AND THERE IS NOT MEANT TO BE** — this package is
 * dependency-free because it runs in a Worker. So the split is anchored on the exact
 * six-space `- name:` that every step in this one file uses, and the reader PROVES
 * ITSELF ALIVE before anything is asserted about what it found: a split that silently
 * matched nothing would make every "the step does X" assertion below vacuous, which is
 * the recorded negative-assertion trap.
 *
 * Step order in the file IS run order for GitHub Actions, which is what makes an
 * ordering assertion here a claim about behaviour rather than about layout — unlike the
 * same assertion over a source file, where the code between two landmarks decides.
 */
function steps(src) {
  const out = [];
  const re = /^ {6}- (?:name|uses): (.*)$/gm;
  const hits = [...src.matchAll(re)];
  for (let i = 0; i < hits.length; i++) {
    const start = hits[i].index;
    const end = i + 1 < hits.length ? hits[i + 1].index : src.length;
    out.push({ name: hits[i][1].trim(), body: src.slice(start, end) });
  }
  return out;
}

test("THE RUN ENDS HOLDING ONE VERSION ID, printed by the last thing that changes the Worker", () => {
  const src = fs.readFileSync(WORKFLOW, "utf8");
  const list = steps(src);
  // The observer, first. Ten-plus steps and the names below present exactly once each.
  assert.ok(list.length >= 10, `the step reader found ${list.length} steps, so every assertion below would be vacuous`);

  const at = (needle) => {
    const found = list.filter((s) => s.name.includes(needle));
    assert.equal(found.length, 1, `"${needle}" names ${found.length} steps, not 1 — the guard cannot tell which`);
    return list.indexOf(found[0]);
  };
  const deploy = at("deploy the agent Worker");
  const secret = at("upload the one agent runtime secret");
  const redeploy = at("re-deploy, so the code and the secret are one version");
  const wait = at("wait for THIS version to answer");
  const verify = at("verify the deployment");

  // **A DEPLOY IS THE LAST THING THAT CHANGES THE WORKER.** `secret put` mints a
  // version; if it were last, the id this run reports could never be the one serving.
  assert.ok(secret > deploy, "the secret is uploaded before the Worker exists");
  assert.ok(redeploy > secret, "the re-deploy does not come after the secret, so the secret's own version would serve");
  assert.ok(wait > redeploy && verify > wait,
    "the wait and the verification do not both follow the version they are about");

  // Nothing between the re-deploy and the verification may touch the Worker again, or
  // the id stops being the serving one for the same reason it did before.
  for (const s of list.slice(redeploy + 1)) {
    assert.doesNotMatch(s.body, /wrangler@[\d.]+ (deploy|secret|versions|deployments)\b/,
      `"${s.name}" changes the Worker after the version this run verifies was minted`);
  }

  // **THE ID IS READ FROM THE STEP THAT CREATED IT, and carried by its own output.**
  // A hop nobody listed is a hop nobody guards: this is the one that was missing.
  const minted = list[redeploy].body;
  assert.match(minted, /version=\$ver" >> "\$GITHUB_OUTPUT"/, "the re-deploy does not export the version it read");
  assert.match(minted, /if \[ -z "\$ver" \]/, "a deploy that printed no version id is accepted");
  assert.match(minted, /exit 1/, "a deploy with no readable version does not stop the run");

  // **THE READERS' ID IS DERIVED FROM THE MINTING STEP'S, never written out here.** Two
  // copies of one name is how a rename reaches one side only — and the id is matched to
  // END OF LINE, because a sweep mutant renaming it `serving_` survived a plain
  // substring match: *a needle that can match a longer name cannot prove a class.*
  const declared = minted.match(/^ {8}id: (\S+)$/m);
  assert.ok(declared, "the re-deploy publishes no step id, so nothing downstream can read its version");
  const mintedId = declared[1];
  for (const i of [wait, verify]) {
    assert.ok(list[i].body.includes(`EXPECT_VERSION: \${{ steps.${mintedId}.outputs.version }}`),
      `"${list[i].name}" is not handed the version step "${mintedId}" minted`);
  }

  // **THE MINTING STEP RUNS WHENEVER THE DEPLOY DOES.** Gated differently — or off — it
  // would leave the readers comparing against an empty string, which is the same
  // unverified deployment wearing a green run. Taken from the deploy step rather than
  // written out, so the two conditions cannot drift apart.
  const cond = (body) => (body.match(/^ {8}if: (.+)$/m) ?? [])[1];
  assert.ok(cond(list[deploy].body), "the deploy step has no condition to compare against");
  assert.equal(cond(minted), cond(list[deploy].body),
    "the step that mints the version is not gated exactly as the deploy is");
});

test("`/health` IS ASKED UNTIL IT ANSWERS THIS VERSION, and a run that never sees it FAILS", () => {
  const src = fs.readFileSync(WORKFLOW, "utf8");
  const wait = steps(src).find((s) => s.name.includes("wait for THIS version to answer"));
  assert.ok(wait, "the wait step is gone");

  // It LOOPS, and the loop's exit is the match — not `ok:true`, which the PREVIOUS
  // deployment answers just as truthfully. That substitution is the whole defect.
  // **A FLOOR ON THE LOOP, not merely "a number".** `seq 1 \d+` is satisfied by
  // `seq 1 1`, which is one read wearing a loop's shape — a sweep mutant did exactly
  // that and survived. The bound and the sleep are read together, because what has to
  // outlast propagation is their PRODUCT: a version took over a minute to appear on the
  // edge this repository measured, so the window is held at three minutes or more.
  const bound = Number((wait.body.match(/for i in \$\(seq 1 (\d+)\)/) ?? [])[1]);
  const napS = Number((wait.body.match(/^ {12}sleep (\d+)$/m) ?? [])[1]);
  assert.ok(Number.isInteger(bound) && bound >= 2,
    `the wait makes ${bound} attempt(s), so one read decides again`);
  assert.ok(Number.isInteger(napS) && napS >= 1, "the wait does not pause between attempts");
  assert.ok(bound * napS >= 180, `the wait gives up after ${bound * napS}s, which is inside propagation`);
  assert.match(wait.body, /\[ "\$got" = "\$EXPECT_VERSION" \]/,
    "the loop does not compare the version served with the version deployed");
  assert.match(wait.body, /&&\s*\[ "\$ok" != "0" \]/, "the loop stopped requiring a configured deployment");
  // A loop that falls through must fail the run. A wait that gives up quietly is worse
  // than no wait: it would hand the verification an unknown version and call it green.
  const tail = wait.body.slice(wait.body.lastIndexOf("done"));
  assert.ok(tail.includes("exit 1"), "the wait step exits 0 when the version never appears");
  assert.match(tail, /never reported/i, "the failure does not say what it was waiting for");
});

test("THE VERIFICATION ASSERTS THE VERSION RATHER THAN ECHOING IT", () => {
  // The defect was not a missing value — the version was printed, correctly, all
  // along. It was that printing it read exactly like verifying it. So the property is
  // that the expectation reaches a `check(`, whose failure is counted.
  const src = fs.readFileSync(path.join(DIR, "scripts", "verify-live.mjs"), "utf8");
  assert.match(src, /const EXPECT_VERSION = \(env\.EXPECT_VERSION \?\? ""\)\.trim\(\);/,
    "verify-live no longer reads the expected version");

  const at = src.indexOf("if (EXPECT_VERSION) {");
  assert.ok(at > 0, "verify-live does not act on the expected version at all");
  const block = src.slice(at, src.indexOf("\n}", at));
  assert.match(block, /check\(/, "the expected version is used somewhere other than a counted check");

  // **THE COMPARISON IS ASSERTED WHERE IT IS MADE, ONCE.** A sweep mutant that replaced
  // the condition with `true` survived this assertion when the same expression also
  // appeared in the check's message: the needle found the copy. It is one `versionOk`
  // now, so the condition and the spelling cannot part company.
  assert.match(src, /const versionOk = healthBody\.version === EXPECT_VERSION;/,
    "the version comparison is not made in one place");
  assert.match(block, /check\("the version serving is the one this run deployed", versionOk,/,
    "the check is passed something other than that one comparison");

  // An UNSET expectation is a legitimate state (a hand run), and must say so rather
  // than pass quietly — a check that cannot be made is not a check that passed.
  const other = src.slice(src.indexOf("} else {", at), src.indexOf("\n}", src.indexOf("} else {", at)));
  assert.match(other, /not set/, "an unset expectation is silent, so a missing hop reads as a pass");

  // And the cacheability is asserted too: it is the OTHER explanation for a stale
  // version, and the only one a reader can rule out from its own side.
  assert.match(src, /check\("\/health forbids caching", \/no-store\/i\.test\(cacheControl\)/,
    "the caching check is passed something other than the header it read");
});

/**
 * DRIVING IT, WHICH IS WHAT THE SWEEP ASKED FOR.
 *
 * The three assertions above read the script. That was enough to catch a check being
 * DELETED and not enough to catch one being made VACUOUS: two mutants that replaced a
 * condition with `true` survived every source read, because the words were all still
 * there. **A guard that reads an instrument is not a guard that ran it.**
 *
 * So `verify-live.mjs` is executed, against a stub that answers `/health` and nothing
 * else. Only check 0 is being observed — the script goes on to fail against the stub,
 * which is why the child is stopped as soon as its answer is on stdout rather than
 * waited out.
 */
const CHECK_0_LAST = "/health forbids caching";

async function runCheck0({ version, expect, cacheControl }) {
  const body = JSON.stringify({
    ok: true, service: "agent-builder-api", version, tag: null,
    deployedAt: "2026-09-15T00:00:00Z", model: "stand-in", modelKnown: true,
    schema: "agent", agents: ["support", "slow", "guarded"], missing: [],
  });
  const server = http.createServer((req, res) => {
    if (req.url.startsWith("/health")) {
      res.writeHead(200, { "content-type": "application/json", ...(cacheControl ? { "cache-control": cacheControl } : {}) });
      res.end(body);
      return;
    }
    res.writeHead(500, { "content-type": "application/json" });
    res.end('{"error":"the stub only answers /health"}');
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const url = `http://127.0.0.1:${server.address().port}`;
  // A token the script can DECODE for its tenant; it is never verified here, because
  // nothing in check 0 verifies it — the stub is not Supabase.
  const enc = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const token = `${enc({ alg: "HS256", typ: "JWT" })}.${enc({ sub: "11111111-2222-3333-4444-555555555555" })}.x`;
  try {
    return await new Promise((resolve) => {
      const child = spawn(process.execPath, [path.join(DIR, "scripts", "verify-live.mjs")], {
        env: {
          ...process.env, AGENT_URL: url, SUPABASE_URL: url,
          SUPABASE_SERVICE_KEY: "stub", SUPABASE_PUBLISHABLE_KEY: "stub",
          AGENT_USER_TOKEN: token, EXPECT_VERSION: expect ?? "",
          HANDOVER_MS: "1000", SETTLE_MS: "1000", POLL_MS: "100", MIN_LONG_MS: "1",
        },
        stdio: ["ignore", "pipe", "pipe"],
      });
      let out = "";
      const settle = () => { child.kill("SIGKILL"); resolve(out); };
      child.stdout.on("data", (d) => { out += String(d); if (out.includes(CHECK_0_LAST)) settle(); });
      child.stderr.on("data", (d) => { out += String(d); });
      child.on("close", () => resolve(out));
      child.on("error", () => resolve(out));
    });
  } finally {
    await new Promise((r) => server.close(r));
  }
}

test("DRIVEN: the version check really fails on the wrong version, and the caching check on a cacheable answer", async () => {
  const line = (out, what) => {
    const hit = out.split("\n").find((l) => l.includes(what));
    assert.ok(hit, `the script printed no line for "${what}" — stdout was:\n${out}`);
    return hit;
  };

  // MATCHING — the positive control, without which a check wired to always FAIL would
  // satisfy every assertion below.
  const good = await runCheck0({ version: "v-same", expect: "v-same", cacheControl: "no-store" });
  assert.match(line(good, "the version serving is the one this run deployed"), /^ {2}ok /,
    "a matching version did not pass, so the negative cases below prove nothing");
  assert.match(line(good, CHECK_0_LAST), /^ {2}ok /, "a no-store answer did not pass");

  // DIFFERENT — the case that was reported as the deployed version for a whole run.
  const wrong = await runCheck0({ version: "v-serving", expect: "v-deployed", cacheControl: "no-store" });
  assert.match(line(wrong, "the version serving is the one this run deployed"), /^ {2}FAIL/,
    "a version other than the one deployed was accepted");
  assert.match(line(wrong, "the version serving is the one this run deployed"), /v-serving/,
    "the failure does not say which version answered");
  assert.match(line(wrong, "the version serving is the one this run deployed"), /v-deployed/,
    "the failure does not say which version was expected");

  // CACHEABLE — no directive at all, which is what the route used to send.
  const cacheable = await runCheck0({ version: "v-same", expect: "v-same", cacheControl: "" });
  assert.match(line(cacheable, CHECK_0_LAST), /^ {2}FAIL/, "a cacheable /health was accepted");

  // UNSET — it must SAY it verified nothing rather than count a pass.
  const unset = await runCheck0({ version: "v-whatever", expect: "", cacheControl: "no-store" });
  assert.ok(!unset.includes("the version serving is the one this run deployed"),
    "with no expectation the script still claims to have checked the version");
  assert.match(line(unset, "EXPECT_VERSION is not set"), /reported, not verified/,
    "with no expectation the script says nothing about what it could not check");
});

/**
 * A STEP THAT PIPES MUST NOT REPORT `tee`'s STATUS.
 *
 * **FOUND BY THE OTHER PRODUCT, ON THE MERGE.** `test/repair-workflows.test.mjs` at the
 * repository root guards its own repair workflows for this, and the moment the two trees
 * were merged it read this file — which did not exist when that guard was written — and
 * named four lines. One of them mattered a great deal: the queue step's whole verdict is
 * a pipeline's exit status, and under GitHub's UNSPECIFIED Linux shell (`bash -e {0}`,
 * `set -e` with no `pipefail`) a pipeline reports its LAST command's status, so
 * `queues info … | tee` reported TEE's — 0, whatever wrangler did. That step exists
 * because the version before it matched wrangler's WORDING and failed a deploy on a
 * guessed string; the pipe then handed its replacement a constant.
 *
 * **MEASURED, not recalled** (and the same two lines this test drives):
 *   bash -e         → `if false | tee /dev/null` takes the TRUE branch
 *   bash -eo pipefail → it takes the false branch
 *
 * The second property is the one the root guard does not name, and `pipefail` is what
 * creates it: with pipefail on, `v=$(… | grep nomatch | head -1)` fails the assignment
 * and `set -e` kills the step, so a named refusal underneath it becomes unreachable and
 * a deploy with no readable URL or version dies saying nothing. Measured the same way.
 */
const PIPEFAIL_ARGV = {
  // GitHub's documented defaults. `""` is a step that names no shell. Kept here rather
  // than imported because this package has no dependency on the root product's tests —
  // two copies of one table is a real cost, and the DRIVE below is what stops this one
  // drifting into a lie: each row is executed, so a wrong row fails its own case.
  "": ["--noprofile", "--norc", "-e"],
  bash: ["--noprofile", "--norc", "-eo", "pipefail"],
};

test("DRIVEN: the shells behave the way this file claims, and every piping step declares one that does", () => {
  // The two rows, executed. Without this the rest is a spelling check.
  const asks = (shell) => spawnSync("bash", [...PIPEFAIL_ARGV[shell], "-c",
    'if false | tee /dev/null; then echo swallowed; else echo kept; fi'], { encoding: "utf8" }).stdout.trim();
  assert.equal(asks(""), "swallowed", "an unspecified shell no longer swallows a pipeline's failure — re-read the whole file");
  assert.equal(asks("bash"), "kept", "the declared shell does not preserve a pipeline's failure");

  const src = fs.readFileSync(WORKFLOW, "utf8");
  const list = steps(src);
  assert.ok(list.length >= 10, `the step reader found ${list.length} steps`);

  // Every step whose body pipes into tee, and what shell it declares.
  const piping = list.filter((st) => /\|\s*tee\b/.test(st.body));
  assert.ok(piping.length >= 1, "no step pipes into tee any more — this guard has no subject and should be re-read, not deleted");
  for (const st of piping) {
    const shell = (st.body.match(/^ {8}shell: (\S+)$/m) ?? ["", ""])[1];
    assert.ok(Object.hasOwn(PIPEFAIL_ARGV, shell),
      `"${st.name}" pipes into tee under shell "${shell}", which this guard has no row for — add the row and check what it DOES`);
    assert.equal(asks(shell), "kept",
      `"${st.name}" pipes into tee under a shell that reports tee's status, so its verdict is a constant`);
  }
});

test("DRIVEN: a refusal under `pipefail` is still reachable when its grep matches nothing", () => {
  // pipefail is what makes this a question at all, so it is asked under pipefail.
  const run = (script) => spawnSync("bash", [...PIPEFAIL_ARGV.bash, "-c", script], { encoding: "utf8" });
  const reached = (script) => run(script).stdout.includes("REFUSED");

  // The shape without the guard, and the shape with it — so the case proves the fix is
  // what makes the difference rather than asserting it.
  assert.equal(reached('v=$(echo x | grep zzz | head -1); if [ -z "$v" ]; then echo REFUSED; fi'), false,
    "a non-matching grep no longer kills the step — re-read this file rather than trusting it");
  assert.equal(reached('v=$(echo x | grep zzz | head -1 || true); if [ -z "$v" ]; then echo REFUSED; fi'), true,
    "`|| true` did not keep the refusal reachable");

  // And every extraction in the workflow that FEEDS such a refusal carries it.
  const src = fs.readFileSync(WORKFLOW, "utf8");
  for (const st of steps(src)) {
    for (const m of st.body.matchAll(/^ {10}(url|ver)=\$\((.+)\)$/gm)) {
      const [line, name, inner] = m;
      if (!new RegExp(`\\[ -z "\\$${name}" \\]`).test(st.body)) continue;   // no refusal reads it
      assert.match(inner, /\|\| true$/,
        `"${st.name}" extracts $${name} through a pipe whose failure kills the step, so the \`[ -z "$${name}" ]\` refusal below it can never run: ${line.trim()}`);
    }
  }
});
