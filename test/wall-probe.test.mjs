// THE `sub` MODE MUST ACTUALLY REACH SOMETHING THAT WAITS.
//
// ── WHY THIS FILE EXISTS (2026-09-01) ──────────────────────────────────────
//
// The wall probe has six modes and only one of them has never produced a
// measurement: `sub`, a Worker holding an OUTBOUND fetch open. Every run of it
// scored NOT MEASURED, because its inner fetch went to our own hostname and
// Cloudflare answers **522 in 0.0 seconds** to a Worker calling the zone it is
// itself serving. The probe was right to refuse the row; nothing was ever
// learned from it.
//
// It matters now because `sub` is the only mode shaped like the thing that
// dies. Two edits ended at 273.2s and 273.1s; an edit waits on a model call and
// then on the container and burns almost no CPU, so neither the `burn` verdict
// (cut off at 300.0s) nor `plain` (survives 420s) explains it.
//
// ── WHAT IS ASSERTED, AND WHY IT IS THE CHAIN RATHER THAN THE SPELLING ─────
//
// This repo's most-repeated own-goal is a guard pinned to a call's spelling,
// which goes red the moment an honest argument is added and reports a working
// feature as broken. So nothing here asserts an argument list. What is asserted
// is the property that made the mode vacuous for three runs: **the far end has
// to be one that waits.**
//
//   1. the `sub` branch reaches the CONTAINER, not our own zone
//   2. the container endpoint it names really exists
//   3. that endpoint replies AFTER its wait, unlike `/hold` which replies at once
//   4. the probe still refuses to score a row whose inner call did not wait
//
// Point 3 is the one that was actually wrong for three runs in a different
// disguise, and point 4 is its observer: without the refusal, a far end that
// answers instantly scores as a held subrequest — which is exactly what the
// first run reported.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const WORKER = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
const SERVER = readFileSync(new URL("../builder/build-server.mjs", import.meta.url), "utf8");
const PROBE = readFileSync(new URL("../scripts/wall-probe.mjs", import.meta.url), "utf8");

/**
 * Comments blanked, LENGTH PRESERVED so every offset below still lines up.
 *
 * NOT OPTIONAL HERE, AND THE DANGER IS THIS FILE'S OWN SUBJECT. Every source
 * region scanned below is wrapped in prose that explains the 522, names
 * `/hold`, and quotes the self-calling form — so a scan over raw text would
 * find each forbidden thing inside the paragraph arguing against it. This repo
 * has hit that trap nine-plus times, several of them inside the guard written
 * for the trap.
 */
/**
 * IT TRACKS STRINGS, AND THE FIRST DRAFT DID NOT — which broke this file on the
 * one line it was written to check. `"http://build/slowreply?ms="` contains
 * `//`, so a blanker that only looks for the two characters erased the rest of
 * that line and the test then reported, correctly by its own lights, that the
 * sub branch no longer names the endpoint. The guard flagged working code, which
 * is the failure this repo rates worse than a miss.
 *
 * Quotes, apostrophes and backticks, with backslash escapes. Regexes are NOT
 * tracked and do not need to be: a slash inside one is written `\/`, so a bare
 * `//` cannot appear there — an empty regex is a syntax error. And unlike the
 * TSX blanker that hit this a fortnight ago, these are all plain JavaScript
 * files, so an apostrophe really is a string opener here.
 */
function blankComments(src) {
  let out = "";
  let i = 0;
  let inBlock = false;
  let quote = "";
  while (i < src.length) {
    const c = src[i];
    const nx = src[i + 1];
    if (inBlock) {
      if (c === "*" && nx === "/") { out += "  "; i += 2; inBlock = false; continue; }
      out += c === "\n" ? "\n" : " ";
      i++;
      continue;
    }
    if (quote) {
      out += c;
      if (c === "\\") { out += nx === undefined ? "" : nx; i += 2; continue; }
      if (c === quote) quote = "";
      i++;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") { quote = c; out += c; i++; continue; }
    if (c === "/" && nx === "*") { out += "  "; i += 2; inBlock = true; continue; }
    if (c === "/" && nx === "/") {
      while (i < src.length && src[i] !== "\n") { out += " "; i++; }
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

test("the comment blanker leaves a URL alone", () => {
  // THE OBSERVER FOR THE BLANKER ITSELF, because every other test in this file
  // is downstream of it and a blanker that eats code makes them all lie — in
  // the direction of reporting correct code as broken, which is worse than
  // reporting nothing.
  const sample = 'const a = "http://x/y"; // gone\nconst b = 1;\n';
  const blanked = blankComments(sample);
  assert.ok(blanked.includes('"http://x/y"'), "the blanker ate a URL it mistook for a comment");
  assert.ok(!blanked.includes("gone"), "the blanker stopped blanking comments");
  assert.equal(blanked.length, sample.length, "the blanker no longer preserves offsets");
});

const W = blankComments(WORKER);
const S = blankComments(SERVER);
const P = blankComments(PROBE);

/**
 * The source of ONE branch, from its own `if` to the next sibling's.
 *
 * WINDOWED LANDMARK TO LANDMARK, NEVER BY BYTES. A byte window in this repo is
 * outrun by the next comment somebody adds, and this file's regions are already
 * the most heavily commented in the route. Both landmarks are asserted to
 * exist before the slice is taken, because `indexOf` answering -1 gives
 * `slice(-1, -1)` — the empty string, which passes every assertion made about
 * what it does NOT contain.
 */
function branch(src, openMark, closeMark, label) {
  const a = src.indexOf(openMark);
  assert.ok(a >= 0, `${label}: the opening landmark is gone (${openMark})`);
  const b = src.indexOf(closeMark, a + openMark.length);
  assert.ok(b > a, `${label}: the closing landmark is gone (${closeMark})`);
  return src.slice(a, b);
}

test("the sub mode reaches the container, not our own zone", () => {
  const sub = branch(W, 'searchParams.get("sub") === "1"', 'searchParams.get("subself")', "sub branch");

  // THE FAR END. A container binding is the only thing in this branch that can
  // hold a socket for minutes on our own infrastructure.
  assert.ok(/SITE_BUILD_CONTAINER/.test(sub), "the sub branch no longer reaches the container binding");
  assert.ok(/slowreply/.test(sub), "the sub branch no longer names the endpoint that waits");

  // AND NOT THE THING THAT MADE IT VACUOUS. `subself` is the self-calling form
  // and it lives in its own branch now; if this one starts rebuilding our own
  // URL again the mode is back to scoring 522s.
  assert.ok(!/new URL\(url\.toString\(\)\)/.test(sub),
    "the sub branch is rebuilding our own URL again — that is the form that returns 522 in 0.0s");

  // AND NOT `/hold`, WHICH IS THE SAME MISTAKE WEARING A CONTAINER HOSTNAME.
  // It answers immediately by design, so a sub mode pointed at it would return
  // in milliseconds and be scored as a held subrequest.
  assert.ok(!/http:\/\/build\/hold/.test(sub),
    "the sub branch points at /hold, which replies at once — it would measure nothing");
});

test("the container endpoint exists and replies only after its wait", () => {
  // BOTH LANDMARKS ARE CODE. The first draft closed this window on a comment
  // heading — in a file whose comments this same test blanks — so the slice was
  // empty and the window's own guard caught it. Windowing to a neighbour's code
  // also means anything inserted between them is swallowed rather than skipped.
  const route = branch(S, '"/slowreply"', 'req.url === "/egress"', "slowreply route");

  // IT WAITS BEFORE IT ANSWERS. The whole difference from `/hold` is that the
  // response is inside the timer's callback rather than after it, so the
  // assertion is about ORDER: the send must appear after the setTimeout opens.
  const timer = route.indexOf("setTimeout");
  const reply = route.indexOf("send(res, 200");
  assert.ok(timer >= 0, "/slowreply no longer waits at all");
  assert.ok(reply > timer, "/slowreply answers before its wait — that is /hold, and it measures nothing");

  // AND IT WAITS FOR THE DURATION THE CALLER ASKED FOR. Order alone is not the
  // property: a timer of zero is still a timer, still has the reply inside it,
  // and still answers in milliseconds — the mode would be back to scoring a far
  // end that never waited. The bound `ms` is the whole request.
  assert.ok(/setTimeout\([\s\S]*?\}, ms\)/.test(route),
    "/slowreply's wait is no longer the duration the caller asked for");

  // IT REPORTS WHAT IT DID. `waitedMs` is what lets the probe tell a real hold
  // from a far end that answered instantly; without it the mode is back to
  // being scored on a status code.
  assert.ok(/waitedMs/.test(route), "/slowreply no longer reports how long it waited");

  // IT IS BOUNDED. An unbounded hold on a shared container is a denial of
  // service against every customer's build, and a ceiling that lives only in
  // the caller is one the next caller forgets.
  assert.ok(/MAX_HOLD_MS/.test(route), "/slowreply lost its ceiling");

  // AND IT DOES NOT TAKE A BUILD LANE. `/hold` takes one deliberately; this one
  // holds a socket for up to fifteen minutes, and a lane as well would starve
  // the platform to measure something that has nothing to do with lanes.
  assert.ok(!/oneAtATime/.test(route),
    "/slowreply is taking a build lane — it would starve real builds for up to fifteen minutes");
});

test("the probe still refuses to score a sub row whose inner call did not wait", () => {
  // THE OBSERVER FOR EVERYTHING ABOVE. Every assertion in this file is about
  // the far end really waiting; this is the check that would CATCH it if one
  // day it did not. Without it the other two tests guard a mechanism whose
  // failure nobody would notice — which is what happened for three runs.
  assert.ok(/mode\.startsWith\("sub"\)/.test(P),
    "the probe's did-it-wait check no longer covers both sub forms");
  assert.ok(/valid = false/.test(P), "the probe can no longer mark a row invalid");
  assert.ok(/NOT MEASURED/.test(P), "the probe lost the verdict it prints for a mode that measured nothing");

  // AND THE DEFAULT IS THE UNANSWERED QUESTION. Four modes are answered and
  // each costs up to 22 minutes of runner wall-clock to re-prove; a default
  // that re-runs them is how this probe stops being worth running.
  const dflt = /WALL_MODES \|\| "([^"]*)"/.exec(P);
  assert.ok(dflt, "the probe's default mode list is gone");
  assert.ok(dflt[1].split(",").includes("sub"), "the default no longer runs the one unanswered mode");
});

test("the self-calling form is kept, so the 522 stays reproducible", () => {
  // NOT DELETED WITH ITS REPLACEMENT. The 522 is a platform behaviour this repo
  // paid three probe runs to discover, and a mode that demonstrates it is worth
  // being able to re-run — the alternative is the next session re-deriving it
  // from a comment.
  assert.ok(/searchParams\.get\("subself"\)/.test(W), "the self-calling form was deleted rather than renamed");
  const self = branch(W, 'searchParams.get("subself") === "1"', 'searchParams.get("stream")', "subself branch");
  assert.ok(/new URL\(url\.toString\(\)\)/.test(self), "subself no longer calls our own zone, which is its whole purpose");

  // ITS OWN LABEL, ON EVERY EXIT. Both branches used to answer `mode: "sub"`,
  // so a subself row would be filed under the mode it exists to contrast with —
  // and the probe scores by mode, so a mislabelled row is not cosmetic: it is a
  // 522 counted as a container measurement.
  //
  // EVERY EXIT, AND A SWEEP IS WHY. The first draft asserted that the label
  // appeared SOMEWHERE in the branch, and this branch has two returns — a
  // mutation relabelling the success path survived, because the catch path
  // still carried the string the test was looking for. `some` where `every`
  // was meant.
  assert.deepEqual(labelsIn(self), ["subself", "subself"], "a subself exit is labelled as another mode");
});

/**
 * Every `mode:` label a branch answers with.
 *
 * THE FLOOR IS THE POINT. Asserting "no exit says `sub`" over a branch the
 * window failed to capture passes perfectly — an empty list contains no wrong
 * labels. Returning the labels and comparing the whole array means the count is
 * asserted too, so a vanished window or a deleted return fails loudly rather
 * than silently satisfying an absence.
 */
function labelsIn(src) {
  return [...src.matchAll(/mode: "([a-z]+)"/g)].map((m) => m[1]);
}

test("every exit of the container sub branch is labelled sub", () => {
  const sub = branch(W, 'searchParams.get("sub") === "1"', 'searchParams.get("subself")', "sub branch");
  // Three exits: no binding, the measurement, and the throw. All one mode.
  assert.deepEqual(labelsIn(sub), ["sub", "sub", "sub"], "a sub exit is labelled as another mode");
});
