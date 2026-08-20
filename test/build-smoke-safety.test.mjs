// `build smoke` CAN NOW RUN AS A REAL ACCOUNT, AND ITS TEARDOWN DELETES USERS.
//
// The owner's call: a new account cannot finish a cold first build (`buildFloor`
// reached 20 against a 20-credit grant, and the routing call spends 1 before the
// gate), and the answer is NOT to raise the grant — it is to run the smoke test
// as a real account with its own credits.
//
// That points a run whose `finally` block ends with
// `DELETE /auth/v1/admin/users/<id>` at somebody's actual account. That call
// cascades: chats, credits, purchases, storage rows, every `user_site_project`
// record. There is no undo and no warning, and the failure is silent in the
// worst way — the run passes, reports green, and the account is gone.
//
// So the gate is a PROPERTY OF THE SOURCE, asserted here, rather than a rule
// somebody has to remember while editing a 1400-line integration script. Every
// check below is derived from the file: it finds the destructive calls rather
// than being told where they are, so a third one added later is covered without
// anybody updating this test.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const SRC = fs.readFileSync(new URL("./integration/build-smoke.mjs", import.meta.url), "utf8");

// Comments blanked LENGTH-PRESERVINGLY, because every index below is compared
// against the real text. This file's own prose names the calls it is protecting
// (`DELETE /auth/v1/admin/users/<id>` appears in three comments in the script),
// so scanning the raw source finds the explanation and calls it a call site —
// the absence-guard-matches-its-own-comment failure this repo has recorded four
// times. Blanking rather than removing keeps the offsets valid.
const CODE = SRC.replace(/\/\/[^\n]*/g, (m) => " ".repeat(m.length));

const all = (hay, needle) => {
  const out = [];
  for (let i = hay.indexOf(needle); i !== -1; i = hay.indexOf(needle, i + 1)) out.push(i);
  return out;
};

// The one gate. Found by text so the tests below can locate its body, and
// asserted to exist exactly once — two gates are two things that can disagree
// about what "this run made the user" means.
const GATE = "if (userId && createdUser) {";

test("the destructive teardown sits behind exactly one gate", () => {
  const at = all(CODE, GATE);
  assert.equal(at.length, 1,
    `expected exactly one \`${GATE}\`, found ${at.length}`);
});

// ── everything that reaches the account BY ID, found rather than listed ─────
//
// Every Supabase URL in the script that interpolates `${userId}` — the two that
// exist today (the admin user delete and the `user_site_project` wipe) and any
// third somebody writes tomorrow. Derived, so a new one is covered without
// anybody remembering this file; the named floor below is what stops the scan
// silently matching nothing and reporting a clean sweep.
const byUserId = () =>
  [...CODE.matchAll(/\$\{SUPABASE_URL\}\/[^`\n]*\$\{userId\}[^`\n]*/g)].map((m) => ({
    what: m[0].slice(0, 80), at: m.index,
  }));

test("the scan still sees the calls it was written for", () => {
  // A regex that stops matching reports a clean file, which is the reassuring
  // way to say nothing was checked. Both known shapes must be found.
  const found = byUserId().map((f) => f.what).join(" | ");
  assert.ok(/auth\/v1\/admin\/users/.test(found),
    `the admin user delete is not being scanned — found: ${found}`);
  assert.ok(/user_site_project\?uid=eq\./.test(found),
    `the project-record wipe is not being scanned — found: ${found}`);
});

test("every call that names the user by id is inside the gate's block", () => {
  const gate = CODE.indexOf(GATE);
  assert.ok(gate > 0, "the gate is missing entirely");
  const bodyStart = gate + GATE.length;

  const calls = byUserId();
  assert.ok(calls.length >= 2, `expected at least two, found ${calls.length}`);

  for (const { what, at } of calls) {
    assert.ok(at > bodyStart,
      `\`${what}\` runs BEFORE the gate — it would fire for a supplied account`);

    // …and the block has not closed in between. The gate's body is indented
    // four spaces, so a line whose first non-space character is `}` at two
    // spaces or fewer is the block ending. This is what a mutation moving the
    // call one line past the closing brace trips on — being "after the gate" is
    // not the same as being "inside it".
    assert.ok(!/\n {0,2}\}/.test(CODE.slice(bodyStart, at)),
      `\`${what}\` is after the gate but OUTSIDE its block — it would fire for a supplied account`);
  }
});

// ── the gate's own value cannot come from configuration ─────────────────────

test("createdUser is set only from having created a user", () => {
  // Every assignment to `createdUser`, declaration included. The property that
  // matters is the RIGHT-HAND SIDE: a gate computed from an environment
  // variable answers "was a real account configured", which is the opposite
  // question, and a mis-set secret would then delete the account it was pointed
  // at. Only "the admin create returned an id" is an honest answer.
  const assigns = [...CODE.matchAll(/createdUser\s*=\s*([^;\n]+)/g)].map((m) => m[1].trim());
  assert.ok(assigns.length >= 2,
    `expected a declaration and at least one assignment, found ${assigns.length}`);

  for (const rhs of assigns) {
    assert.ok(!/\benv\b|SUPPLIED|useSupplied/.test(rhs),
      `createdUser is assigned from configuration (\`${rhs}\`) — it must come from having made the user`);
  }
  // And it starts false, so a path that never reaches the create cannot delete.
  assert.ok(/let createdUser = false;/.test(CODE),
    "createdUser must start false — an unset gate that defaults open is not a gate");
  // The honest source: the id the admin create handed back.
  assert.ok(assigns.some((rhs) => /userId/.test(rhs)),
    "nothing assigns createdUser from the created user's id");
});

// ── a supplied account's ledger is never written ────────────────────────────

test("the ledger is written in exactly one place, and it refuses a supplied account", () => {
  // THE WRITES SET THE BALANCE, THEY DO NOT ADD TO IT. There are two top-ups in
  // the run — one to clear the build floor, one to pay for the revise — and
  // `balance: 60` against a real account holding 500 credits is a deduction of
  // 440, not a top-up. A guard at each call site is two copies of one rule, and
  // the direction that drifts in is a customer's ledger.
  const fund = all(CODE, "/rest/v1/credits");
  assert.equal(fund.length, 1,
    `expected ONE ledger write, found ${fund.length} — every top-up must go through fundAccount`);

  const fn = CODE.indexOf("async function fundAccount(");
  assert.ok(fn > 0 && fn < fund[0], "the ledger write is not inside fundAccount");

  // The refusal comes FIRST and RETURNS. Anything else — a flag checked after
  // the fetch, a log without a return — writes the balance anyway.
  const guard = CODE.indexOf("if (useSupplied) {", fn);
  assert.ok(guard > fn && guard < fund[0],
    "fundAccount does not check useSupplied before writing");
  const ret = CODE.indexOf("return;", guard);
  assert.ok(ret > guard && ret < fund[0],
    "the supplied-account branch does not return before the write");
});

test("both top-ups go through the one funded path", () => {
  // The single-write assertion above is what forbids a top-up written any other
  // way; this is the other half — that the run still HAS its two top-ups, so
  // the check above cannot be satisfied by deleting the funding entirely and
  // reporting a clean sweep on a run that can no longer build.
  const calls = all(CODE, "await fundAccount(");
  assert.ok(calls.length >= 2,
    `expected at least two funded steps, found ${calls.length}`);
});

test("a supplied account needs both halves of the credential", () => {
  // Half-set (an email with no password) must read as NOT supplied, so the run
  // creates and deletes a throwaway rather than signing in as nobody and then
  // reaching a teardown with a real id in hand.
  const m = CODE.match(/const useSupplied = ([^;\n]+)/);
  assert.ok(m, "useSupplied is not derived in one place");
  assert.ok(/SUPPLIED_EMAIL\s*&&\s*SUPPLIED_PASSWORD/.test(m[1]),
    `useSupplied must require both halves, got \`${m[1].trim()}\``);
});

// ── the feature is reachable from CI ────────────────────────────────────────

test("the workflow passes both halves of the supplied credential", () => {
  // The wiring layer, which this repo has recorded a dozen features dying in:
  // the script can read the pair perfectly and CI can pass neither, so the run
  // silently keeps creating throwaway accounts that cannot afford a build.
  //
  // Derived from the SUPPLIED_* constants specifically, not from every SMOKE_*
  // the script reads. `SMOKE_SKIP_JOURNEY` is a local escape hatch with a
  // documented default and is deliberately NOT in CI — flagging it would be a
  // false alarm on correct code, which this repo rates worse than the miss. The
  // set that must reach the workflow is the one that decides `useSupplied`.
  const wf = fs.readFileSync(new URL("../.github/workflows/build-smoke.yml", import.meta.url), "utf8");
  const names = [...new Set(
    [...CODE.matchAll(/const SUPPLIED_[A-Z_]+\s*=[^\n]*\benv\.(SMOKE_[A-Z_]+)/g)].map((m) => m[1]),
  )];
  assert.ok(names.length >= 2,
    `expected the credential to be read from at least two SMOKE_* names, found ${names}`);

  for (const n of names) {
    assert.ok(new RegExp(`^\\s*${n}:`, "m").test(wf),
      `${n} is read by the script and never passed by the workflow`);
  }
});

// ── the charge assertion measures, it does not assume ───────────────────────

test("the charge check compares against a balance read before the build", () => {
  // It compared to the literal 20 (the free grant), then to the funding
  // constant. Both are numbers this run chose, so neither says anything about
  // an account whose balance is the owner's business.
  assert.ok(/const startBalance = /.test(CODE),
    "no before-the-build reading is captured");
  assert.ok(/bd\.balance < startBalance/.test(CODE),
    "the charge assertion does not compare against the before reading");

  // AND IT IS TAKEN AFTER THE ROUTING CALLS. Those cost a credit each, so a
  // reading captured at sign-in falls whether or not the build charges
  // anything and the assertion passes vacuously — which is the exact failure
  // mode this check exists for.
  const routing = CODE.lastIndexOf("the two briefs were routed differently");
  const read = CODE.indexOf("const startBalance = ");
  assert.ok(routing > 0 && read > routing,
    "startBalance is read before the routing calls, so the charge check would pass vacuously");
});

// EVERY `SMOKE_` SWITCH READS `process.env`, NOT THE `env` OBJECT.
//
// `env` in that file is deliberately NEON-ONLY — `{ NEON_API_KEY: … }` — so
// `env.SMOKE_ANYTHING` is `undefined`, always, silently. Measured live
// 2026-08-19: `SMOKE_NO_FAMILY` and `SMOKE_KEEP_SITE` were both set in the
// workflow, printed in the job's own env block, and both read as false. The
// experiment did not run and the site was deleted anyway.
//
// AND IT WAS ALREADY TRUE OF `SMOKE_EMAIL`/`SMOKE_PASSWORD`, which is the
// expensive half: `useSupplied` could never be true, so `build smoke` has
// ALWAYS created a throwaway account rather than running as the real one the
// workflow's own comment says it uses. A switch that silently does nothing is
// worse than one that is missing — the workflow shows it set and the run
// behaves as though it were not.
test("every SMOKE_ switch reads process.env, not the Neon-only `env`", () => {
  const src = CODE;
  // `\benv\.` MATCHES INSIDE `process.env.` — the word boundary sits between
  // the dot and the `e`, so the first draft of this guard reported every
  // correct read as a bug. The lookbehind is what discriminates.
  const bad = [...src.matchAll(/(?<!process\.)\benv\.(SMOKE_[A-Z_]+)/g)].map((m) => m[1]);
  assert.deepEqual(bad, [],
    `these read the Neon-only env object and are therefore always undefined: ${bad.join(", ")}`);
  // THE FLOOR, so a scan that stopped matching cannot report a clean file.
  const good = [...src.matchAll(/process\.env\.(SMOKE_[A-Z_]+)/g)].map((m) => m[1]);
  assert.ok(good.length >= 6, `only found ${good.length} SMOKE_ reads — the scan is broken`);
  // NAMED SWITCHES, so a scan that matched six other things still proves these
  // three specifically are read the right way. `SMOKE_NO_FAMILY` stood here and
  // was removed with the families on 2026-08-20 — its whole job was suppressing
  // a layout family, and there are none.
  for (const n of ["SMOKE_EMAIL", "SMOKE_KEEP_SITE", "SMOKE_SKIP_JOURNEY"]) {
    assert.ok(good.includes(n), `${n} is no longer read from process.env`);
  }
});

// A SCREENSHOT MUST BE OF THE PAGE IT SAYS IT IS.
//
// `smoke-site.png` is captioned `live at <site>/` and is the picture anybody
// asking "what did the builder make" gets shown. The go-home before it used to
// hang off `formRoute` being set — so on a run where NO form was found, the
// walk's last page was shot and captioned as the home page. Measured
// 2026-08-20: the artifact was `/manage`, reading "This page needs the link
// from your confirmation", presented as the site's front page.
//
// The comment above that block already called this class of thing a small lie
// that costs a round of confusion. It was right and gated on the wrong
// condition, which is why the property is asserted here rather than left to
// the comment.
//
// SOURCE-READ BECAUSE NOTHING ELSE CAN SEE IT: the script talks to a deployed
// Worker, so no unit test runs it, and the only other signal is looking at an
// artifact from a run that already cost a real build.
function goesHomeBeforeSiteShot(src) {
  const shot = src.indexOf('path: "smoke-site.png"');
  if (shot < 0) return "the smoke-site.png screenshot is gone — re-point this guard";
  const gate = src.indexOf('if (formRoute && formRoute !== "index") {');
  if (gate < 0) return "the form-page screenshot block is gone — re-point this guard";
  // Walk to the end of that block, so "after the gate" means after it CLOSES
  // rather than merely later in the file.
  let depth = 0, close = -1;
  for (let i = src.indexOf("{", gate); i < shot; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}" && --depth === 0) { close = i; break; }
  }
  if (close < 0) return "could not find the end of the form-page block";
  return /await pg\.goto\(SITE\b/.test(src.slice(close, shot))
    ? null
    : "the site screenshot is taken without returning home first — it will show whichever page the form walk ended on";
}

test("the site screenshot is taken on the home page, unconditionally", () => {
  assert.equal(goesHomeBeforeSiteShot(CODE), null);
});

test("the screenshot guard fires when the go-home is put back inside the gate", () => {
  // Driven over a mutant rather than asserted on the source: a guard that found
  // nothing would pass the test above forever. This reproduces the exact shape
  // that shipped — the goto living inside the `if`, so it runs only when a form
  // was found.
  const mutant = CODE.replace(
    /(if \(formRoute && formRoute !== "index"\) \{\n)([\s\S]*?)(\n      \}\n)/,
    "$1$2\n        await pg.goto(SITE, { waitUntil: \"networkidle\", timeout: 45000 });$3");
  assert.notEqual(mutant, CODE, "the anchor this mutation needs is gone — re-point it");
  const stripped = mutant.replace(/\n      await pg\.goto\(SITE, \{ waitUntil: "networkidle", timeout: 45000 \}\)\.catch\(\(\) => \{\}\);/, "");
  assert.notEqual(stripped, mutant, "the unconditional goto this mutation removes is gone — re-point it");
  assert.match(String(goesHomeBeforeSiteShot(stripped)), /without returning home/);
});

// EVERY ROUTE GETS THE ERROR CHECKS, NOT JUST THE HOME PAGE.
//
// `pageErrors` and `consoleErrors` fill for the life of the page and keep
// filling as the form walk navigates — and the two assertions that read them
// run ABOVE the walk. So everything /book threw was captured and then never
// looked at. Measured 2026-08-20: /book rendered its own content with zero
// inputs, zero buttons and no data call, and "the page is thin" and "the page
// is erroring" produced an identical log line. One build is 38 credits, so a
// run that cannot separate those costs another one.
//
// ASSERTED ON THE CONDITION, not on the message. A mutation to `true` leaves
// every string in place and passed a first sweep — the shape this repo has
// recorded more than once.
test("the form walk checks the other routes for errors, and asserts on the count", () => {
  assert.match(CODE, /ok\("no other page of the site threw or logged an error",\s*\n?\s*routeErrors\.length === 0/,
    "the per-route error assertion is gone or no longer reads the count it collected");

  // DERIVED FROM BOTH SOURCES, because checking only one leaves the other
  // silently uncovered: a page that THROWS and a page that logs an error are
  // different failures and both reach the customer.
  for (const src of ["pageErrors", "consoleErrors"]) {
    assert.match(CODE, new RegExp("routeErrors\\.push\\([^)]*\\)[\\s\\S]{0,200}?" + src + "\\.slice\\(|" + src + "\\.slice\\([\\s\\S]{0,200}?routeErrors\\.push"),
      `route errors are not collected from ${src} — that half of the failure is invisible`);
  }

  // THE EDGE BEACON STAYS EXCLUDED HERE TOO. Cloudflare injects it on this zone
  // and the home page's check already separates it; counting it per route would
  // make every run red for something no customer site can control.
  //
  // ANCHORED ON THE CONSOLE LOOP, not on a byte window. The first draft was
  // `routeErrors[\s\S]{0,400}cloudflareinsights` and went red against correct
  // code, because the comment explaining the collection pushed the two apart —
  // the window-sized-in-bytes own-goal this repo has recorded several times,
  // committed here in the guard written to prevent a different one.
  // AND THE HOSTNAME IS MATCHED WITHOUT ITS `.com`, because the thing being
  // searched for IS A REGEX IN THE SOURCE: the file contains
  // `cloudflareinsights\.com`, backslash and all, so a guard written with `\.`
  // looks for a dot that is not there. Second own-goal in this one assertion.
  assert.match(CODE, /consoleErrors\.slice\([^)]*\)\)\s*\{[\s\S]*?cloudflareinsights/,
    "the per-route console check no longer excludes the edge-injected beacon — every run will be red");
});
