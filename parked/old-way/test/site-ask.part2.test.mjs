// PARKED (2026-11-03, park-old-way): the old-way half of test/site-ask.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
// The router that lets the builder be asked a question.
//
// Before this, `siteSend` had one decision in it and every message on an
// existing site ran a full rebuild — so a question cost ~21 credits and
// rewrote the customer's site. The failure mode this file guards is the
// opposite one: a router that swallows a real build request is worse than no
// router at all, because the customer cannot tell it from the builder being
// broken.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { modelsFor } from "../../../builder/build-models.mjs";
import { ASK_TOOL, MIN_OPTIONS, MAX_OPTIONS, EDIT_LAYERS, REMOVABLE_LAYERS } from "../../../builder/route-shared.mjs";
import { MAX_INPUT_CHARS } from "../../../builder/input-budget.mjs";
import { CONVERSE_SYSTEM } from "../../../builder/site-converse.mjs";
// ⚠ `editBrowserReply`, the browser's own edit composer executed — the add
// composer answers a plausible "✅ Done." for an edit body.
import { editBrowserReply } from "../../../scripts/addon-sweep.mjs";

const SITE = { name: "Sharp Fade", url: "/s/sharp-fade/", pages: ["/", "/book"], tables: ["services", "bookings"] };

const toolReply = (input, usage) => ({
  content: [{ type: "tool_use", name: "route_message", input }],
  usage: usage || { input_tokens: 900, output_tokens: 60 },
});

test("the tool refuses to let the model invent a site", () => {
  // The one thing a wrong answer here does that a wrong build does not: state a
  // fact about the customer's own site that is not true.
  const src = fs.readFileSync(new URL("../builder/site-ask.mjs", import.meta.url), "utf8");
  assert.match(ASK_TOOL.input_schema.properties.answer.description, /never invent/i);
  assert.match(src, /Never claim the site has a page, a table, or a feature that is not named below/);
});

// ── wiring: the layers this feature has to be alive at ───────────────────────

const worker = () => fs.readFileSync(new URL("../../../worker.js", import.meta.url), "utf8");
const chat = () => fs.readFileSync(new URL("../../../public/chat.js", import.meta.url), "utf8");

test("the route exists, is auth-gated, and is reachable", () => {
  // THE FAILURE THIS PREVENTS HAS HAPPENED SIX TIMES IN THIS REPO: a feature
  // built, tested, and dead at one layer. `dm2` was the last one — a matcher
  // missing from the condition guarding its own handler, answering 404 for a
  // month while every unit test passed.
  const src = worker();
  assert.match(src, /url\.pathname === "\/api\/site\/route"/, "the route matcher is gone");
  const i = src.indexOf('url.pathname === "/api/site/route"');
  // TO A LANDMARK, NOT A BYTE COUNT. This was `slice(i, i + 2200)` and went red
  // on a correct change the moment a comment was added inside the handler — a
  // guard about character counts rather than about the handler. The block runs
  // to where the NEXT route begins, so it covers this one however it grows.
  const end = src.indexOf('url.pathname === "/api/site/react-build"', i);
  assert.ok(end > i, "could not find the end of the routing handler");
  const block = src.slice(i, end);
  assert.match(block, /await authUser\(request, env\)/, "a paid model call must not be open to the world");
  assert.match(block, /routeMessage\(/, "the matcher is there and calls nothing");
});

test("worker.js imports what it calls", () => {
  // `OWN_ZONES` was read on the first line of a function, outside every try, and
  // never imported — so every Cloudflare custom-hostname call the platform ever
  // made threw before reaching the API. node --check passes on that.
  assert.match(worker(), /import \{[^}]*routeMessage[^}]*\} from "\.\/builder\/site-ask\.mjs"/);
});

// A named declaration's body, closed on the NEXT top-level declaration whatever
// it is called (2026-09-13). Lifted out of `routeBlock` below, which had already
// been re-anchored this way once, because two windows in this file closed on
// `"function buildActiveText("` — a literal that names a NEIGHBOUR — and that
// neighbour was deleted with the pre-React activity log. A missing END landmark
// is a window that swallows the file; here the guards had an alive check and
// failed loudly rather than quietly, which is the only reason this was a red run
// and not a silent one. Deriving the end is what stops the next neighbour's
// departure being either.
const declBlock = (src, from) => {
  const i = src.indexOf(from);
  const re = /\n(?:async )?function |\nconst |\nlet /g;
  re.lastIndex = i + 1;
  const m = re.exec(src);
  const end = m ? m.index : -1;
  assert.ok(i > 0 && end > i, from + " moved — this guard now checks nothing");
  return src.slice(i, end);
};

// The router's own body, to its closing brace rather than to a byte count.
const routeBlock = () => {
  const src = chat();
  const i = src.indexOf("function siteRoute(");
  // THE CLOSING LANDMARK IS THE NEXT TOP-LEVEL DECLARATION, not a named
  // comment hundreds of lines on. It was `// What to say when a build could
  // not run.`, which sits past siteEdit, the watcher and the resume — so the
  // window swallowed every function between them, and stage 2b's resumed
  // tail (one more `s.msgs.push`, in `resumeOpenSite`) read as siteRoute
  // pushing a third message. The recorded overlapping-window trap; the end
  // is derived from the real neighbour now, whatever its name.
  const re = /\n(?:async )?function |\nconst |\nlet /g;
  re.lastIndex = i + 1;
  const m = re.exec(src);
  const end = m ? m.index : -1;
  assert.ok(i > 0 && end > i, "siteRoute moved; this guard checks nothing");
  return src.slice(i, end);
};

// ── the chain ────────────────────────────────────────────────────────────────

test("the route passes the round through, and requires a real boolean", () => {
  const w = worker();
  const i = w.indexOf('url.pathname === "/api/site/route"');
  const block = w.slice(i, w.indexOf("cost: rCost", i));
  assert.match(block, /firstBuild: rb\.firstBuild === true/,
    "a truthy firstBuild would let any caller open the question path");
  assert.match(block, /brief: rb\.brief/);
  assert.match(block, /qa: rb\.qa/);
  // The question is returned, or the whole tier is computed and rendered by
  // nothing — the dead-field shape this repo has recorded six times. Read to the
  // NEXT ROUTE rather than to `i + 4000`: a byte window stops covering what it
  // was written for as soon as a comment is added above the line, which is this
  // repo's recurring source-guard bug and is how this one failed.
  const end = w.indexOf('url.pathname === "/api/site/react-build"', i);
  assert.ok(end > i, "could not find the end of the routing handler");
  // A SITE THAT EXISTS (2026-10-02) returns the question it kept, named by its
  // id (`rQuestion`); a first build returns the reader's own, as before.
  assert.match(w.slice(i, end), /question: routed\.intent === "clarify" \? \(rQuestion \|\| routed\.question\)/);
});

test("the BUILD route folds the answers in, and does it in one place", () => {
  const w = worker();
  // THE PROPERTY IS THAT BOTH NAMES ARRIVE, not that they arrive alone. Pinned
  // to the exact two-name list, this went red the moment an honest third import
  // (`siteDigest`, 2026-08-29) joined them — reporting that the build route
  // could no longer compose the brief, which was never true. The single most
  // repeated own-goal in this repo: assert the property, not the spelling.
  const askImport = (w.match(/^import \{([^}]*)\} from "\.\/builder\/site-ask\.mjs";$/m) || [])[1];
  assert.ok(askImport, "nothing is imported from site-ask.mjs at all — this scan has lost its subject");
  for (const name of ["routeMessage", "clarifiedBrief"]) {
    assert.ok(askImport.split(",").map((s) => s.trim()).includes(name),
      "the build route cannot compose the brief — `" + name + "` is no longer imported");
  }
  const i = w.indexOf("const brief = clarifiedBrief(");
  assert.ok(i > 0, "the build route no longer folds the answers into the brief");
  // TO THE CALL'S OWN CLOSE, not `i + 300` — and the guard directly above this
  // one says exactly that about itself, having already been bitten. This is the
  // ninth byte-sized window in this repo outrun by its own subject: the brief
  // argument grew a comment explaining that a non-string is no longer coerced
  // (the `String(["a","b"])` class, which the two readers beside it already
  // refused), and `body.qa` on the next line fell out of range.
  // THE CALL ENDS WITHOUT A CUT since 2026-10-08 (the content-preservation
  // batch): it closed with `.slice(0, 5000)`.
  const callEnd = w.indexOf("\n      );", i);
  assert.ok(callEnd > i, "the clarifiedBrief call was reshaped — rescope this");
  assert.match(w.slice(i, callEnd), /body\.qa/, "the answers never reach it");
  // ONE implementation. The composer cannot import the module, so a copy there
  // is a second version of the sentence the designer reads.
  assert.ok(!/They were asked/.test(chat()), "public/chat.js is composing the brief itself");
});

test("the route hands `answering` to the router, strictly", () => {
  // WHERE THE FIX CAN DIE SILENTLY. `readRouting` is unit-tested and correct;
  // worker.js cannot be imported, so nothing else notices if the flag simply
  // never arrives. That is the shape this repo has recorded six times — every
  // layer right but one, and the one is quiet.
  const w = worker();
  const i = w.indexOf("await routeMessage(");
  assert.ok(i > 0, "the routing call is gone");
  // TO A LANDMARK, not a byte count — a window sized in characters stops
  // covering what it was written for the moment a comment is added above the
  // line, which is this repo's recurring source-guard bug. The call ends at the
  // `);` that closes it.
  const end = w.indexOf("\n      );", i);
  assert.ok(end > i, "could not find the end of the routing call");
  const call = w.slice(i, end);
  assert.match(call, /qa: rb\.qa/, "this is not the call it was written for");
  assert.match(call, /answering:\s*rb\.answering === true/,
    "the answer flag never reaches routeMessage");
  assert.match(call, /picked:\s*rb\.picked === true/,
    "the pressed-answer flag never reaches routeMessage, so a button press can still be answered with prose");
});

test("the route no longer hands `attached` to the router: a file does not make talk work (2026-10-14)", () => {
  const w = worker();
  const i = w.indexOf("await routeMessage(");
  assert.ok(i > 0, "the routing call is gone");
  const end = w.indexOf("\n      );", i);
  assert.ok(end > i, "could not find the end of the routing call");
  const call = w.slice(i, end).replace(/^\s*\/\/.*$/gm, "");
  assert.match(call, /qa: rb\.qa/, "this is not the call it was written for");
  assert.doesNotMatch(call, /attached:/, "the attachment flag reaches the router again, which turns talk about a file into work");
  assert.match(call, /history: rb\.history/, "the conversation never reaches the router");
});

test("the deletion path reaches the route and calls no model", () => {
  const w = fs.readFileSync(new URL("../../../worker.js", import.meta.url), "utf8");
  const at = w.indexOf('if (eLayer === "page") {');
  assert.ok(at > 0, "the page layer moved");
  const branch = w.slice(at, w.indexOf('const eModels = modelsFor(', at));
  // `eRemove`, NOT `eb.remove` DIRECTLY (2026-08-29). The flag is read once at
  // the top of the route. The property is unchanged and is asserted in both
  // halves: the body is still `=== true` and nothing merely truthy, and the
  // branch still gates on it.
  //
  // RE-ANCHORED 2026-09-23: `const`, no longer a `let` the front door SETS.
  // The `pages` lane's verb rides on its own step, and `runLayer` takes the
  // STEP's verb under this same name — so the branch below reads the removal of
  // the step it is running and nothing wider (`test/edit-page-verb.test.mjs`).
  // AND NOT ON A HAND-OVER (2026-10-02, the whole-router audit's W1): the
  // removal is the router's word for the step it chose, so a request the
  // browser marks `handedOff` never carries it to the step it was handed to
  // (driven in `handover-route.test.mjs`).
  assert.match(w, /const eRemove = !eHanded && !!\(eb && eb\.remove === true\);/,
    "the route no longer reads the removal off the body, or reads it loosely");
  assert.match(branch, /if \(eRemove\) \{/, "the page branch never reads the removal");
  assert.match(branch, /mergeAddonPages\(eSrc, \[\], \[target\.path\]\)/,
    "the removal does not go through the merge that holds the guards");
  // THE WHOLE POINT: it returns before the model call. If `generateSitePages`
  // appears above the merge, the cheap path is not cheap.
  assert.equal(/generateSitePages/.test(branch), false,
    "a deletion still pays for page generation");
  assert.match(branch, /cost: 0/, "a deletion that generated nothing must not be billed as if it had");
  // And the client sends it as a real boolean, or something truthy on the wire
  // takes a page away.
  const chat = fs.readFileSync(new URL("../../../public/chat.js", import.meta.url), "utf8");
  assert.match(chat, /remove: d\.remove === true/, "the client never sends it, or sends it loosely");
  // AND THE CUSTOMER IS TOLD THE PAGE WENT — DRIVEN, since 2026-09-23. This
  // matched the old composer's spelling (`'✅ Took ' + (gone…`); a removal is
  // said through `pageOpsSaid` now, which the page branch and the multi-step
  // reply share. The property is the sentence, so the real composer is run on
  // the removal rung's own reply shape (`page`, `removed`, `cost: 0`).
  const said = editBrowserReply({ ok: true, layer: "page", page: "/gallery", removed: ["gallery.tsx"], cost: 0 }, true);
  assert.equal(said.ok, true, said.why);
  assert.match(said.text, /^Took \/gallery off the site\./, "the customer is not told the page went");
});

// EVERY FIELD `readEdit` READS MUST REACH THE ROUTE — derived from the FUNCTION'S
// SOURCE, not from inputs somebody remembered to drive.
//
// The sweep below it drives `readEdit` and collects the keys it RETURNS, which
// is derived at one end and hand-listed at the other: it drove `{}` and
// `{remove: true}`, so a field the model can send and nobody thought to pass in
// never appears in the result and the guard stays green. `rename` went straight
// through it. Reading the function for `input.<name>` cannot miss one, because
// the read is the thing that makes the field exist at all.
test("every field readEdit READS off the model is forwarded by the route", () => {
  const src = fs.readFileSync(new URL("../builder/site-ask.mjs", import.meta.url), "utf8");
  const body = src.slice(src.indexOf("export function readEdit"));
  const fn = body.slice(0, body.indexOf("\n}\n"));
  assert.ok(fn.length > 200, "the readEdit window is empty — the anchor moved");
  const read = new Set([...fn.matchAll(/\binput\.([a-zA-Z][\w$]*)/g)].map((m) => m[1]));
  assert.ok(read.has("rename") && read.has("remove") && read.has("page"),
    "the scan sees no fields at all — readEdit changed shape, rescope this");
  const worker = fs.readFileSync(new URL("../../../worker.js", import.meta.url), "utf8");
  const resp = worker.slice(worker.indexOf("intent: routed.intent,"));
  const window = resp.slice(0, resp.indexOf("usage: routed.usage"));
  for (const field of read) {
    assert.match(window, new RegExp("\\b" + field + ":\\s*routed\\."),
      `readEdit reads \`${field}\` off the model and the route never sends it — the edit lane cannot act on it`);
  }
});

test("THE PAGE BRANCH ACTUALLY MOVES THE PAGE, and spends no model call doing it", () => {
  // The layer below every test above. `renameRoute` was written, committed,
  // tested and had ZERO CALLERS — correct and unreachable — which is the exact
  // failure this guard exists to make impossible to repeat.
  const worker = fs.readFileSync(new URL("../../../worker.js", import.meta.url), "utf8");
  assert.match(worker, /import \{[^}]*\brenameRoute\b[^}]*\} from "\.\/builder\/site-apply\.mjs"/,
    "renameRoute is used without being imported — a ReferenceError on the edit path");
  const at = worker.indexOf("const wantRename =");
  assert.ok(at > 0, "the rename branch is gone from the page layer");
  // BOUNDED BY THE BRANCH'S OWN CLOSING BRACE, not by whatever happens to come
  // next. This ran to `const eDb = await siteBackendBySlug` — a landmark far
  // below — so the cheap tweak rung inserted between the two landed INSIDE the
  // window and the "a rename makes no model call" assertion went red about a
  // model call in a different branch. That is this repo's most-repeated
  // own-goal, and the fix is a window that cannot be outrun by an insertion.
  const branch = (() => {
    const open = worker.indexOf("if (wantRename) {", at);
    if (open < 0) return "";
    let depth = 0;
    for (let i = worker.indexOf("{", open); i < worker.length; i++) {
      if (worker[i] === "{") depth++;
      else if (worker[i] === "}" && --depth === 0) return worker.slice(at, i + 1);
    }
    return "";
  })();
  assert.ok(branch.length > 200, "the rename window is empty — the anchor moved");
  // …and it really did stop before the next thing, or the bound proves nothing.
  // ⚠ THE NEEDLE IS THE CALL, NOT ITS DECLARATION, AND IT IS PROVED PRESENT
  // BELOW THE BRANCH FIRST (2026-09-22). This read `const eDb = await
  // siteBackendBySlug`; when that line became `let eDb` the needle matched
  // nothing anywhere in the file, and this negative went on passing about a
  // string that no longer existed — the absence of an observer, read as a pass.
  const next = "siteRowConn(env, ownerSlug)";
  assert.ok(worker.indexOf(next, at) > at,
    "the backend read below the rename branch is gone, so the bound below proves nothing");
  assert.ok(!branch.includes(next),
    "the rename window still runs past the branch it is meant to bound");
  assert.match(branch, /renameRoute\(eSrc, wantRoute, wantRename, routeOf\)/,
    "the branch never calls the renamer");
  // THE REDIRECT PAIR IS THE POINT. Without it the publish sees a delete plus an
  // add and 301s the old address to the home page — the customer's indexed links
  // land on the wrong page, which is the whole reason renameRoute returns one.
  assert.match(branch, /renamed: rn\.redirect/,
    "the move publishes without its redirect pair — the old address 301s to home");
  // AND IT IS FREE. A path is not prose: the router has already resolved which
  // page and where it is going, so there is nothing for a model to work out —
  // the same argument the deletion branch above it makes.
  assert.ok(!/generateSitePages|anthropicMessages/.test(branch),
    "the rename branch makes a model call — a path needs no generation");
  assert.match(branch, /cost: 0/, "a rename is billed as though something was generated");
});
