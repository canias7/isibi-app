// The canary harness itself.
//
// ── WHY A HARNESS GETS GUARDS ─────────────────────────────────────────────
//
// Because this one passed while testing nothing, and reported it as a pass.
//
// On 2026-09-01 the paid canary POSTed its edit with `layer: ""` and got a
// complete, clean round trip: 202 in 1.0s, queued, claimed, replayed, terminal
// in 7.9s, no errors anywhere. It had made no model call, run no lane, compiled
// nothing and published nothing — the edit route does not decide its own layer,
// `/api/site/route` does, and an edit posted without one matches none of the
// nine rungs and falls through to `escalate("layer")` for cost 0.
//
// Nothing about that run looked wrong. That is the whole reason these exist: a
// green harness proves the path it took, not the path it was meant to take, and
// the only defence is to make the harness refuse rather than to hope.
//
// SOURCE-READ, because the script signs in and spends money at import — there
// is nothing to drive. So each case is anchored on a property with both
// landmarks proved, never on an argument list.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const RAW = readFileSync(new URL("../scripts/edit-canary.mjs", import.meta.url), "utf8");

/** Comments blanked, length preserved, string-aware — see edit-poll.test.mjs. */
function blankComments(src) {
  let out = ""; let i = 0; let inBlock = false; let quote = "";
  while (i < src.length) {
    const c = src[i]; const nx = src[i + 1];
    if (inBlock) { if (c === "*" && nx === "/") { out += "  "; i += 2; inBlock = false; continue; } out += c === "\n" ? "\n" : " "; i++; continue; }
    if (quote) { out += c; if (c === "\\") { out += nx === undefined ? "" : nx; i += 2; continue; } if (c === quote) quote = ""; i++; continue; }
    if (c === '"' || c === "'" || c === "`") { quote = c; out += c; i++; continue; }
    if (c === "/" && nx === "*") { out += "  "; i += 2; inBlock = true; continue; }
    if (c === "/" && nx === "/") { while (i < src.length && src[i] !== "\n") { out += " "; i++; } continue; }
    out += c; i++;
  }
  return out;
}
const SRC = blankComments(RAW);

// NOT OPTIONAL HERE EITHER: every comment in that file explains the empty-layer
// failure, so a raw read finds `layer: ""` in prose and reports the fix as the
// bug. The "prose contains the thing it forbids" trap, tenth-odd instance.
test("the comment blanker leaves strings alone", () => {
  const sample = "const a = 'layer: \"\"'; // layer: \"\"\nconst b = 1;\n";
  const out = blankComments(sample);
  assert.ok(out.includes("'layer: \"\"'"), "the blanker ate a string");
  assert.equal(out.split("\n")[0].indexOf("//"), -1, "the blanker stopped blanking comments");
  assert.equal(out.length, sample.length, "the blanker no longer preserves offsets");
});

/** The paid half only — the free checks legitimately post an empty instruction. */
function paidHalf() {
  const at = SRC.indexOf("const before = await fetch(");
  assert.ok(at > 0, "the paid half's opening landmark is gone");
  return SRC.slice(at);
}

test("the paid edit asks the router for its layer before it spends", () => {
  const paid = paidHalf();
  const routed = paid.indexOf('"/api/site/route"');
  const posted = paid.indexOf("/edit`");
  assert.ok(routed > 0, "the canary no longer routes — it cannot know which rung to ask for");
  assert.ok(posted > 0, "the canary no longer posts an edit at all");
  assert.ok(routed < posted, "the edit is posted before the router has named a layer");
});

test("the paid edit carries every field the router decided", () => {
  const paid = paidHalf();
  const at = paid.indexOf("/edit`");
  const body = paid.slice(at, paid.indexOf("console.log", at));
  // `layer` is the one that broke; the rest are carried because a canary that
  // only forwards today's field breaks the day its instruction routes to a rung
  // that needs one of the others. `siteEdit` sends all five.
  for (const f of ["layer", "page", "remove", "rename", "tab"]) {
    assert.ok(new RegExp("\\b" + f + ":").test(body), `the edit POST drops \`${f}\``);
  }
  assert.match(body, /rd\.layer/, "the layer is not taken from the router's answer");
  // AND NOT HARDCODED. A canary that names its own layer stops testing the
  // routing hop that failed, which is the one thing it now exists to cover.
  assert.doesNotMatch(body, /layer:\s*["'](look|page|data|text|nav)["']/,
    "the canary picks its own layer instead of asking");
});

test("no layer means no spend, and it is a refusal rather than a guess", () => {
  const paid = paidHalf();
  const gate = paid.indexOf("REFUSING TO SPEND");
  const posted = paid.indexOf("/edit`");
  assert.ok(gate > 0, "the canary no longer refuses to spend without a layer");
  assert.ok(gate < posted, "the refusal comes after the edit has already been posted");
  const branch = paid.slice(paid.lastIndexOf("if (", gate), gate);
  assert.match(branch, /rd\.intent !== "edit"/, "an answer that is not an edit still buys an edit");
  assert.match(branch, /!rd\.layer/, "a missing layer still buys an edit");
  assert.match(paid.slice(gate, gate + 400), /process\.exit\(1\)/,
    "the refusal does not actually stop the run");
});

test("a terminal answer is not a pass — the edit has to have published", () => {
  const paid = paidHalf();
  // THE OTHER HALF OF THE SAME LESSON. The broken run DID reach a terminal
  // state, in 7.9 seconds, and exited 0. `done` certifies the transport; only
  // `ok: true` certifies that a rung ran, compiled and published.
  const exit = paid.lastIndexOf("process.exit(");
  assert.ok(exit > 0, "the canary no longer sets an exit code");
  const tail = paid.slice(exit);
  assert.match(tail, /published/, "the exit code no longer depends on the edit having published");
  assert.doesNotMatch(tail, /process\.exit\(done \?/,
    "a terminal answer counts as a pass again — that is what the broken run returned");
  assert.match(paid, /const published = [^;]*\.ok === true/,
    "publication is judged by something other than the reply's own ok flag");
});

test("the free checks still cost nothing, and the paid one is still opt-in", () => {
  // The four confirmations lean on `escalate("empty")`, which answers cost 0
  // before any model call — so they must keep posting an EMPTY instruction.
  const free = SRC.slice(SRC.indexOf("ZERO-COST CONFIRMATIONS"), SRC.indexOf("const before = await fetch("));
  assert.ok(free.length > 400, "the free half came out empty");
  assert.ok((free.match(/instruction: ""/g) || []).length >= 3,
    "a free check stopped sending an empty instruction, so it now costs money");
  assert.doesNotMatch(free, /api\/site\/route/,
    "the free half routes — a routing call is a real charge and this half must stay free");
  // AND SPENDING IS STILL A SWITCH, defaulting off.
  assert.match(SRC, /const SPEND = process\.env\.CANARY_SPEND === "1"/, "the spend switch is gone");
  assert.match(SRC, /if \(!SPEND\)/, "the paid half no longer checks the switch");
  assert.match(SRC, /if \(failed\)/, "the paid edit runs even when a free check failed");
});
