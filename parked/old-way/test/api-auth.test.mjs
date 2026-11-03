// PARKED (2026-11-03, park-old-way): the old-way half of test/api-auth.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
// Every /api route is behind a Supabase session — enforced, not asserted.
//
// CLAUDE.md has claimed "all /api/* require a Supabase-authenticated user" for
// months. It was never true by construction: there is no blanket gate, only the
// 404 fallthrough at the bottom of the router, so each of the 41 routes gates
// itself and a new one added without `authUser` would be world-open with nothing
// to notice. That is exactly the shape of drift site-access.mjs was built to
// kill, so this closes it the same way — by measuring the source.
//
// The exceptions are an explicit allow-list. Adding a route to it should feel
// deliberate, because it means putting something on the public internet.
import { DEVICE_WISHES_FIELD } from "../../../builder/device-scope.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
// THE SCHEMA FRAGMENTS `design_schema` COMPOSES ITSELF FROM. Bound for real in
// the shape check below, never stubbed — see `REAL` there for why.
import { SEEDS_FIELD } from "../../../builder/site-seeds.mjs";
import { PLAN_FIELDS, SHAPE_FIELD, IMAGES_FIELD, ACTION_FIELD, BEHAVIOR_FIELD, TSX_FIELD } from "../../../builder/site-plan.mjs";
import { GIF_FIELD } from "../../../builder/site-favicon.mjs";
import { QR_FIELD } from "../../../builder/site-qr.mjs";
import { FAVICON_FIELD, WORDMARK_FIELD } from "../../../builder/site-favicon.mjs";
// THE ONE SHAPE OF A TABLE (2026-09-02): `backend.tables.items` lives in its
// own module now, shared with the ADD step. Bound for real below, and read as
// text where a description of it is asserted.
import { TABLE_ITEM, FUNCTION_ITEM } from "../../../builder/site-table.mjs";
const TABLE_SRC = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "../../..", "builder", "site-table.mjs"), "utf8");
import { AUTHORED_AXES, ASKABLE as STYLE_AXES } from "../../../builder/site-style.mjs";
import { authoredFieldSchema, AXIS_DECLS } from "../../../builder/site-authored.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const SRC = fs.readFileSync(path.join(ROOT, "worker.js"), "utf8");
const LINES = SRC.split("\n");

/**
 * ONE FUNCTION'S SOURCE, bounded by the next TOP-LEVEL declaration.
 *
 * A window sized in bytes is outrun by its own subject's comments, and one
 * anchored on a NAMED neighbour is widened silently the day something is
 * declared between them — this repo has recorded both, repeatedly. Where a
 * function ENDS is a fact about that function, so it is what the bound reads.
 */
function topLevel(src, decl) {
  const from = src.indexOf(decl);
  assert.ok(from >= 0, decl + " is gone from worker.js");
  const rest = src.slice(from + decl.length);
  // A TOP-LEVEL DOC COMMENT BELONGS TO WHAT FOLLOWS IT, so the window closes at
  // `/**` as well as at the declaration. Without that, `publishPlaceholder`'s
  // window swallowed the ~2,600 characters of prose arguing for `clearPlaceholder`
  // and the size bound below failed about a function that had not changed.
  // `export default` IS A BOUNDARY TOO, added 2026-09-12 after the identical
  // reader in `safe-fetch-redirects.test.mjs` ran a window straight through
  // worker.js's handler object: it is declared near the top of the file,
  // thousands of lines above the router it calls, so the function just above it
  // swallows `export default { fetch, scheduled, queue }` whole. Nothing in
  // THIS file windows that function today — the hole is latent here and was
  // load-bearing there, which is exactly when to close it.
  const next = rest.match(/\n(?:\/\*\*|export default|(?:export )?(?:async )?(?:function|class|const|let) )/);
  return rest.slice(0, next ? next.index : rest.length);
}

// Routes that are deliberately reachable without a Supabase session, each with
// the reason it is safe. Anything not on this list must gate.
const PUBLIC = {
  "/api/stripe/webhook": "Stripe cannot hold a session; authenticated by HMAC over the raw body instead (stripe-webhook.mjs).",
  // (`/api/m/*` — the media proxy's capability URL — left this list on
  // 2026-09-12 with the route it described. It was the media side's answer to
  // a free account that could not save to the gallery: the provider's own
  // temporary render link, AES-GCM-sealed into an opaque token so the host
  // stayed off the page. The builder never had an equivalent, because a
  // photograph it buys is downloaded server-side into R2 and served from the
  // site's own origin, so there is nothing to hide and nothing to seal. It is
  // named here rather than silently dropped: the list's own guard reads a
  // DISAPPEARANCE as interesting, which is exactly right, and this says which
  // of the three reasons it was.)
  // (`/api/stripe/site/*` — a site owner's own Stripe telling us an order was
  // paid — left this list on 2026-10-29 with the prebuilt payments: a site
  // that takes payments now does it in its own server code.)
  "/api/db/*": "A published site's own API. Its visitors are not isibi users — a customer booking a haircut has no account here. As of 2026-07-30 it is TRANSPORT ONLY: the row routes were deleted and these paths forward to the site's Neon Data API and Neon Auth, where the site's own RLS policies decide every access question. What is enforced here is a per-source rate limit and that the slug resolves to a real site. Since 2026-10-28 (the site's own Worker) the platform only passes these calls to the site's own script, which answers for its own slug only, or answers 503 (republish).",
  "/api/site/genresult": "THE BUILD CONTAINER handing back the generation it was fired. It holds no Supabase session and never will — it is our own compute, reached over the queue, not a person. What authenticates it is a 128-bit token minted for ONE generation at fire time and stored in that build's resume record, travelling in a HEADER rather than the path so it stays out of logs and proxies. Knowing it authorises writing exactly one build's answer to one R2 key and nothing else; it is the same shape as a site's inbound webhook secret. An unrecognised token is 404, not 401, because the route's existence is not worth confirming to somebody probing it and a container that got the token wrong has no recovery either way.",
  "/api/site/gencode": "THE BUILD CONTAINER sending the code it is writing, while it writes it (2026-09-07). The same caller, the same credential and the same binding as genbeat one entry up — the report token in a header, the job and the generation in the body matched against the resume record — and the narrowest authority of the three: it writes a bounded tail of the generation's own output to one R2 key under `jobs/`, which the retention sweep already owns. Nothing reads that key but the build poll, and only for the record's own uid. A body that does not bind is 404, as the report and the beat are, and writes nothing.",
  "/api/site/genbeat": "THE BUILD CONTAINER renewing its build row's lease while it generates (stage 2c). The same caller as genresult with the same credential — the report token in a header — and a narrower authority: the job id and the generation id in the body are matched against the resume record the Worker wrote for that job (the token AND the generation it carries), and only then is `edit_beat` asked, under the container's own lease name, which the RPC refuses for anyone but the holder. A beat that does not bind is 404, as the report is, and writes nothing.",
};

// Every place the router dispatches on an /api path.
const ROUTE_LINES = (() => {
  const at = new Set();
  LINES.forEach((l, i) => { if (/url\.pathname\s*(?:===\s*"\/api\/|\.startsWith\("\/api\/)/.test(l)) at.add(i); });
  return [...at].sort((a, b) => a - b);
})();

function routes() {
  const found = new Map();
  LINES.forEach((l, i) => {
    const re = /url\.pathname\s*(?:===\s*"(\/api\/[^"]+)"|\.startsWith\("(\/api\/[^"]+)"\))/g;
    for (let m; (m = re.exec(l)); ) {
      const name = m[1] || m[2] + "*";
      if (!found.has(name)) found.set(name, i);
    }
  });
  return found;
}

// The window is a fixed size CAPPED at the next route dispatch on a LATER line.
//
// Both halves are load-bearing, and each was learned from a wrong answer. A pure
// next-match boundary collapses to zero lines where routes share a dispatch
// expression across several lines, and reports gated routes as open. A pure
// fixed window bleeds into the NEXT route's block and reports an open route as
// gated — which is the dangerous direction, and it happened: the published-site
// data API passed this test while calling no auth at all.
const WINDOW = 60;

// RAISED FROM 45 when the edit and addon lanes added two matchers to the
// /api/site/* block, which declares a dozen route patterns before it gates. The
// gate did not move; the declarations in front of it grew.
//
// Safe to raise because the window is CAPPED at `nextDispatchAfter` — a larger
// number cannot bleed into the next route's block, it can only reach further
// inside its own. The danger the comment above names is the cap's job, not this
// number's.

// Consecutive dispatch lines are ONE decision only when they are arms of the
// SAME expression: the gate that covers them comes after the last arm, so
// capping at the very next line would give each arm a one-line block and call
// every one of them open.
//
// The signal is the source, not the line distance. An unfinished expression ends
// in a continuation token (`?`, `:`, `||`, `&&`, `,`, `(`); a finished statement
// does not. This was a proximity test — "within 3 lines is the same decision" —
// and that had a hole big enough to walk through: an UNGATED route written on
// the line above a gated one was read as part of it and inherited its gate.
// Demonstrated by wedging `/api/backdoor` in, which the suite happily passed.
//
// THE INSTANCE THAT MOTIVATED THIS LEFT THE FILE ON 2026-09-12, and saying so
// is the point. It was `url.pathname === "/api/video" ? "video" : === "/api/image"
// ? … : === "/api/audio" ? … : null` — three arms of one ternary over one gate —
// and it went with the media side. worker.js has no multi-line dispatch
// expression today, so the JOINING branch below now fires on nothing when this
// test runs against the real source: a wall with no live case, which is exactly
// what the next session deletes as dead weight. It is kept, and it is DRIVEN
// against a synthetic three-arm ternary in its own case below, because a
// multi-arm dispatch is an ordinary thing to write and the failure when this is
// missing is silent and in the dangerous direction — gated routes reported open,
// which trains somebody to loosen the reading rather than the router.
export const CONTINUES = /[?:,(]\s*$|(\|\||&&)\s*$/;
// PARAMETERISED ON ITS LINES so the real reading can be driven over a source
// other than worker.js. It used to close over LINES and ROUTE_LINES, and the
// wedge case below therefore carried its own copy of this loop — two lists of
// the same thing, with the copy being the one every synthetic case exercised.
// One function, three callers: the real scan, the wedge, and the joining case.
export function dispatchEndAfter(lines, routeLines, i) {
  let last = i;
  for (const j of routeLines) {
    if (j <= last) continue;
    // Same expression only if every line between them is still mid-expression.
    let joined = true;
    for (let k = last; k < j; k++) if (!CONTINUES.test(lines[k])) { joined = false; break; }
    if (joined) { last = j; continue; }
    return j;
  }
  return Infinity;
}
// Where the /api dispatch lines are in whatever source is being read. Derived
// from the same pattern `ROUTE_LINES` uses, so a synthetic case cannot be read
// by a looser rule than the real one.
export function dispatchLinesOf(lines) {
  return lines.reduce((a, l, i) => (/url\.pathname\s*(?:===\s*"\/api\/|\.startsWith\("\/api\/)/.test(l) ? a.concat(i) : a), []);
}
function nextDispatchAfter(i) {
  return dispatchEndAfter(LINES, ROUTE_LINES, i);
}
/**
 * Is this line nothing but a comment?
 *
 * LINE-WISE AND CONSERVATIVE, never a whole-file blanker. worker.js is full of
 * `https://` inside strings, and a stray `/*` in one of them makes a naive
 * stripper eat 46% of the file — measured, and recorded in CLAUDE.md. Asking
 * only "does this line START as a comment" needs no string parsing and cannot
 * be wrong about code.
 */
const commentOnly = (l) => /^\s*(\/\/|\*|\/\*)/.test(l) || !l.trim();

/**
 * The code between a dispatch and its gate.
 *
 * COMMENT LINES DO NOT COUNT TOWARD THE WINDOW, and that is the point. `WINDOW`
 * was raised 45 → 60 once already for exactly this reason — its own note says
 * "the gate did not move; the declarations in front of it grew" — and a third
 * raise would be treating the symptom again. Prose in front of a gate is not
 * distance from it, so documenting a matcher must not be able to make a gated
 * route report as open.
 *
 * The comment lines are DROPPED FROM THE MATCH TOO, which closes a second hole
 * in the other direction: a comment merely MENTIONING `authUser(` would satisfy
 * this check for a route that never calls it.
 *
 * Still capped by `nextDispatchAfter`, so nothing here can bleed into the next
 * route's block — that cap is what makes the size safe, not the number.
 */
function blockOf(i) {
  const stop = Math.min(LINES.length, nextDispatchAfter(i));
  const out = [];
  let code = 0;
  for (let k = i; k < stop && code < WINDOW; k++) {
    if (commentOnly(LINES[k])) continue;
    out.push(LINES[k]);
    code++;
  }
  return out.length ? out.join("\n") : (LINES[i] || "");
}
const GATE = /authUser\(|UNAUTHED\(|bearerUser\(/;

/**
 * The gate, followed ONE HOP into a function the dispatch calls.
 *
 * WHY (2026-08-23): the build moved out of `handleRequest` into `runSiteBuild`
 * so a queue consumer could call it, and this guard immediately reported the
 * three build routes as UNAUTHENTICATED — on a change where the body was proved
 * byte-identical and `authUser` is still its very first statement. The gate did
 * not move relative to the code; the code moved relative to the dispatch.
 *
 * Raising `WINDOW` again would be the third instance of treating the symptom,
 * and it could not work here anyway: the callee is 1,900 lines away. Following
 * the call is STRICTER than a bigger window, not looser — it asks whether the
 * thing that actually runs gates, rather than whether a gate happens to be
 * nearby.
 *
 * BOUNDED DELIBERATELY. One hop only, to functions DECLARED IN worker.js, and
 * the callee must gate within the same `WINDOW` of code lines an inline handler
 * would have to — the identical standard, one level deeper. Without that last
 * rule this degrades into "some function it calls mentions authUser somewhere",
 * which is the presence-standing-in-for-a-property failure this repo keeps
 * recording.
 */
function calleeGates(block) {
  for (const m of block.matchAll(/(?<![\w$.])([a-z][\w$]*)\s*\(/g)) {
    const name = m[1];
    // Handler-shaped names only, plus a gate helper named for its refusal
    // (`operatorRefusal`, A16-7, 2026-10-23): it must still gate itself within
    // the same window, so the name only lets it be looked at.
    if (!/^(?:run|handle|do)[A-Z]|^[a-z]\w*Refusal$/.test(name)) continue;
    const at = SRC.indexOf(`async function ${name}(`);
    if (at < 0) continue;                                 // not ours, or not a function
    const line = SRC.slice(0, at).split("\n").length - 1;
    const out = [];
    let code = 0;
    for (let k = line; k < LINES.length && code < WINDOW; k++) {
      if (commentOnly(LINES[k])) continue;
      out.push(LINES[k]);
      code++;
    }
    if (GATE.test(out.join("\n"))) return true;
  }
  return false;
}
const gatesWithin = (i) => {
  const block = blockOf(i);
  return GATE.test(block) || calleeGates(block);
};

// THE ONE PLATFORM DISPATCH OF A VISITOR'S CALL (2026-10-28: the site's own
// Worker): a `url.pathname.match(/^\/api\/db\/…/)` handed to `siteAnswers`.
const VISITOR_DISPATCH = /url\.pathname\.match\(\/\^\\\/api\\\/db\\\//;
function visitorDispatch() {
  const i = LINES.findIndex((l) => VISITOR_DISPATCH.test(l));
  if (i < 0) return null;
  return { line: i, block: LINES.slice(i, i + 12).join("\n") };
}

// -------------------------------------------- what a model failure may reveal
//
// `detail` from a model API is never returned: a 400 can quote the request back,
// and the request carries the site's brief. But returning ONLY a numeric status
// meant both CI suites went red at the same minute on `upstream: 400` and the
// reason — the account that pays for the model had no balance — was logged in
// Cloudflare and discarded from every response. Forty minutes of red with
// nothing in the API to say why.
//
// `upstreamKind` is the narrow middle: the provider's error TYPE, which is a
// fixed token from a small set, plus a boolean for the one message worth
// checking. Everything else stays out.
import { readFileSync as _rf } from "node:fs";
import { buildPathFn } from "../../../test/fixtures/build-path.mjs";
const WORKER_SRC = _rf(new URL("../../../worker.js", import.meta.url), "utf8");

/** The real function, lifted out of worker.js, which cannot be imported. */
const upstreamKind = (() => {
  // `(detail, status)` since 2026-09-02: the HTTP status is the one thing a
  // refused key always carries, whatever the body says.
  const m = WORKER_SRC.match(/function upstreamKind\(detail, status\) \{[\s\S]*?\n\}/);
  assert.ok(m, "upstreamKind was not found in worker.js");
  return new Function("detail", "status", m[0].replace(/^function upstreamKind\(detail, status\) \{/, "") .replace(/\n\}$/, "") + "\n");
})();


// ─────────────────────────────────────────────────────────────────────────
// OUR FAILURE, OUR COST — on the build route's two infrastructure branches.
//
// Only the name-taken branch refunded, so a Neon outage, a dead key or a
// project quota answered 502 and KEPT the settled schema charge: 9 credits cold
// Sonnet, 15 Opus, out of a new account's grant of 20. Every sibling refusal on
// this route refunds, with the stated reason that the caller is left with
// literally nothing — which is exactly where a provisioning failure leaves them
// — and infrastructure being down is an our-fault stage by `ourFault`'s own
// list. During an outage each retry cost half a grant for nothing.
for (const [what, anchor] of [
  ["provisioning", 'console.error("site provision failed:'],
  ["the schema apply", 'console.error("schema apply failed:'],
]) {
  test("a failed " + what + " refunds the schema charge", () => {
    const i = WORKER_SRC.indexOf(anchor);
    assert.ok(i > 0, "the " + what + " catch was not found");
    const block = WORKER_SRC.slice(i, WORKER_SRC.indexOf("{ status: 502 }", i));
    assert.ok(block.length > 100 && block.length < 3000, what + " catch not found whole: " + block.length);
    // Anchored on the SPEND, not on a helper name — the refund is the thing.
    //
    // …AND THE HELPER IS NOW HOW THE SPEND HAPPENS, so "the refund is the
    // thing" is asserted through it: `refundFields` calls `refundCredits`, and
    // it exists because a bare `await refundCredits(...)` DISCARDED the boolean
    // that function was given specifically so a failed reversal stops being
    // invisible — all six refusals then answered a literal `cost: 0` while the
    // customer kept being charged up to the whole settled schema cost.
    // RE-ANCHORED 2026-09-05 (stage 1c): `refundFields()` takes no amount any
    // more — it reverses every ref this build debited, bounded by the
    // ledger's own rows, and reports what stayed. The property is the same:
    // the refusal reverses, and says what it could not give back.
    assert.match(block, /await refundFields\(\)/, what + " keeps the customer's money on our own failure");
    assert.match(block, /\.\.\.back/, "…and must report what really stayed on the ledger, or the response asserts a refund that did not land");
  });
}

// A GAME BUILD THAT DIES IN OUR CONTAINER GIVES THE CREDITS BACK.
//
// Both game routes collect the model charge the moment each generation returns,
// before anything compiles, and nothing gave it back — so a container drained
// mid-bundle, or one that never started ("build service returned no JSON"),
// kept 20-30 credits and delivered no game. There was no refund on ANY failure
// branch of either route, and `/api/refund` covers fal jobs only.


// ─────────────────────────────────────────────────────────────────────────
// EVERY `compileMsg` CALL NAMES A VARIABLE THAT EXISTS.
//
// `compileMsg(tPub, …)` shipped on the /text route's compile-failure branch and
// `tPub` appears exactly ONCE in 12,604 lines — this use. The compile result
// there is `out`; every sibling branch has its own local (`pub`, `pPub`, `aPub`,
// `cutPub`, `rPub`), which is precisely why the wrong one is easy to write. So
// the branch written to answer "that didn't compile, your site is untouched"
// threw a ReferenceError and 500'd instead, on every compile failure.
//
// The existing free-variable scanner cannot see this: it walks FORWARD from a
// declaration to a read after its block closes, and this name is declared
// nowhere at all. Same family as `vidRefN` and `du.id`, third instance.
test("every compileMsg call names a variable declared in worker.js", () => {
  const calls = [...WORKER_SRC.matchAll(/compileMsg\(\s*([A-Za-z_$][\w$]*)\s*,/g)];
  assert.ok(calls.length >= 5, "the compileMsg scan found too few calls: " + calls.length);
  const bad = [];
  for (const m of calls) {
    const name = m[1];
    // Declared SOMEWHERE in the file, as a const/let/var or a parameter of the
    // enclosing arrow — a deliberately loose test, because the failure being
    // caught is a name that exists nowhere rather than one out of scope.
    const declared = new RegExp("(?:const|let|var)\\s+" + name + "\\b").test(WORKER_SRC);
    if (!declared) bad.push(name + " (worker.js:" + (WORKER_SRC.slice(0, m.index).split("\n").length) + ")");
  }
  assert.deepEqual(bad, [], "these compileMsg calls name a variable that is never declared: " + bad.join(", "));
});

// THE ADDON BILL IS ONE VARIADIC CALL, NOT TWO ADDED.
//
// `pageCredits` takes several usages precisely so they land on one bill with ONE
// rounding and ONE 1-credit floor — its own comment says adding
// separately-rounded results "would charge twice for the rounding". The addon
// route summed two calls: measured against the real module, a typical
// Haiku-design + Sonnet-pages pair billed 20 against 19, and two tiny calls
// billed 2 against 1. Every addon on the platform overpaid.
test("the addon prices both of its calls together", () => {
  // RE-ANCHORED 2026-09-03: the bill is `aBill` now — computed once, before
  // the publish, because a queued addon RESERVES it there and a synchronous
  // one collects it after; `const bill` inside the post-publish try went with
  // that. The property is unchanged: one variadic call, never two summed.
  // RE-ANCHORED AGAIN 2026-09-05 (stage 1a-ii): the line is a conditional
  // now. Synchronously, and under a job for an addon that designed no backend
  // tier, `aBill` is still ONE variadic call over the design, the page call
  // and the seed net. A BACKEND addon under a job reserves the design and the
  // seed as sequence #1 BEFORE the DDL — it cannot know the page call's cost
  // yet — and the page call alone as #4, so it pays two roundings,
  // deliberately: the trade the translation charge made on run 39. The early
  // reserve is gated INSIDE the backend block (asserted below by brace depth),
  // so a page or a component still pays one bill.
  const i = WORKER_SRC.indexOf("const aBill = aFirstPlaced ?");
  assert.ok(i > 0, "the addon bill was not found");
  const line = WORKER_SRC.slice(i, WORKER_SRC.indexOf("\n", i));
  assert.ok(!/\+\s*pageCredits\(/.test(line), "the addon adds two separately-rounded bills: " + line.trim());
  // The path that placed nothing: every usage through one variadic call.
  assert.match(line, /: pageCredits\(\.\.\.aDesignUsage, aGen && aGen\.usage, aSeedUsage, aPick && aPick\.usage\);$/, "the unplaced path does not price every usage through one variadic call: " + line.trim());
  // The path that placed #1: the page call ALONE, never the design again.
  assert.match(line, /aFirstPlaced \? pageCredits\(aGen && aGen\.usage, aPick && aPick\.usage\) :/, "the placed path re-prices the design: " + line.trim());
  // And #1 is placed only where a backend tier was designed: inside the
  // `aBackend.length` block, before the schema apply, both within its braces.
  const first = WORKER_SRC.indexOf("aFirst = await aCharge(pageCredits(...aDesignUsage, aSeedUsage));");
  const apply = WORKER_SRC.indexOf("aMade = await applySiteSchema(adb, merged);");
  assert.ok(first > 0 && apply > first, "the early reserve is not before the schema apply");
  const gateHead = "if (aBackend.length) {";
  const gate = WORKER_SRC.lastIndexOf(gateHead, first);
  assert.ok(gate > 0, "the early reserve has no backend gate above it");
  let d = 0, close = -1;
  for (let k = gate + gateHead.length - 1; k < WORKER_SRC.length; k++) {
    if (WORKER_SRC[k] === "{") d++;
    else if (WORKER_SRC[k] === "}") { d--; if (d === 0) { close = k; break; } }
  }
  assert.ok(close > apply, "the early reserve and the schema apply are not both inside the backend block");
});

// A PHOTOGRAPH BOUGHT BY THE PICTURE LAYER IS BILLED.
//
// It charged `pageCredits(usage)` over model tokens only, so a generated
// photograph — $0.15 of real fal spend and ~19 credits, the exact charge the
// BUILD path applies for the identical picture — cost the customer nothing.
// Latent only while the image balance is empty; the day it is funded it is live
// money going out with nothing coming back.
test("the picture layer bills the photographs it bought", () => {
  // RE-ANCHORED 2026-10-09 (parallel round 5): the lane now has three success
  // responses — the placement step's two (nothing placed; photographs placed)
  // come first — so the step's own response is found by its message field,
  // and the placement's bill is held to the same rule below.
  const i = WORKER_SRC.indexOf('ok: true, layer: "picture", msg: pOut.msg');
  assert.ok(i > 0, "the picture success response was not found");
  const block = WORKER_SRC.slice(Math.max(0, i - 900), WORKER_SRC.indexOf("});", i));
  assert.match(block, /images: pOut\.made\.length/, "the photographs are not priced into the bill");
  // THE PLACEMENT STEP BILLS WHAT IT PLACED, once, and nothing when it placed nothing.
  const pl = WORKER_SRC.indexOf('ok: true, layer: "picture", placed: plPlaced.length');
  assert.ok(pl > 0, "the placement response was not found");
  const plBlock = WORKER_SRC.slice(pl, WORKER_SRC.indexOf("});", pl));
  assert.match(plBlock, /cost: await eCharge\(\[\], \{ images: plPlaced\.length \}/, "the placed photographs are not billed by count");
  const none = WORKER_SRC.indexOf('ok: true, layer: "picture", placed: 0');
  assert.ok(none > 0 && /cost: 0/.test(WORKER_SRC.slice(none, WORKER_SRC.indexOf("\n", none))), "placing nothing is not free");
  // ANCHORED ON THE PROPERTY: both parts reach ONE `eCharge`. It pinned the
  // exact argument list and went red when the publish result joined it — the
  // third thing this lane legitimately bills, since the spine's translation
  // calls are real spend the ledger never saw. `pageCredits` is variadic
  // precisely so several parts land on one bill with one rounding, so what
  // matters is that the photographs are IN that call, not their position.
  const one = block.match(/eCharge\(pOut\.usage[^)]*\)/);
  assert.ok(one, "the photographs are not charged through eCharge at all");
  assert.match(one[0], /\bpImages\b/, "…and must be charged through the same one call as the tokens");
  // COUNTED FROM `made`, not from what was asked for: a photograph that failed
  // or was never affordable was never bought.
  assert.ok(!/images: pOut\.(budget|planned|changed)/.test(block), "the bill must count what was MADE, not what was wanted");
});

test("the picture layer's working balance moves as it spends", () => {
  // Read once and never decremented, the per-picture affordability check could
  // not bind across a batch: an account with 20 credits passed the same check
  // three times and bought three photographs it could afford one of.
  //
  // ⚠ RE-ANCHORED 2026-09-23 — LANDMARK TO LANDMARK, BOTH PROVED. The window
  // was 900 BYTES above the call to an END landmark (`pages: eSrc });`) that
  // had stopped matching when the call gained `model: eQuickModel` — so
  // `slice(start, -1)` ran to the end of the file and every assertion below it
  // was searching the rest of worker.js. It went red only when a comment about
  // the rung's components pushed `let balance` past the 900: this file's own
  // byte-window trap, in both of its halves at once. The window is the picture
  // layer's own block now, from its opening to the next sibling statement after
  // the call.
  const at = WORKER_SRC.indexOf('if (eLayer === "picture") {');
  assert.ok(at >= 0, "the picture layer's block is gone, so nothing below reads it");
  const end = WORKER_SRC.indexOf("if (!pOut.ok) {", at);
  assert.ok(end > at, "the picture layer's call has no closing landmark after its opening one");
  const block = WORKER_SRC.slice(at, end);
  assert.ok(block.includes("const pOut = await runPictureEdit({"), "the window does not hold the call it is about");
  // THE PROPERTY IS `let` PLUS A REAL READ, not the spelling of the read. It
  // pinned `let balance = await readCredits` and went red when a queued edit —
  // which carries no bearer token and must read its balance by uid — added a
  // branch. The failure message even said "a const balance", which nobody had
  // written: the tell that a spelling was being asserted.
  assert.match(block, /let balance = await /, "a const balance can never be decremented");
  assert.match(block, /readCredits(For)?\(/, "the working balance is no longer read from the ledger at all");
  assert.match(block, /balance -= SITE_PHOTO_USD \/ CREDIT_USD/, "the balance must fall as photographs are bought");
  assert.match(block, /if \(made\)/, "…only for one that really landed");
});

// EVERY EDIT LANE ANSWERS OUR OWN OUTAGE THE SAME WAY.
//
// The lanes return `reason: "send"` when their model call throws, and each used
// to fold that into a flat 422 — "that change couldn't be saved, try again" for
// three of them, and "your site changed while that was being edited, send it
// again" for the text lane. Both are wrong twice over: the status blames the
// customer's request for our failure, and "try again" is the worst possible
// advice during a BILLING outage, which is the one thing nothing retries past.
//
// Derived from the lanes that can produce it, so a fifth lane cannot arrive
// with its own quiet 422.
test("every edit lane routes a model outage to the shared 503", () => {
  const lanes = [["data", "dOut"], ["text", "out"], ["rules", "rOut"], ["picture", "pOut"]];
  for (const [name, v] of lanes) {
    const re = new RegExp(v.replace("$", "\\$") + '\\.reason === "send"[^\\n]*modelDown\\(' + v + '\\.error');
    assert.match(WORKER_SRC, re, "the " + name + " lane does not hand a model outage to modelDown");
  }
  // The helper itself must carry the three things that make it worth having.
  const i = WORKER_SRC.indexOf("const modelDown = (e, what) =>");
  assert.ok(i > 0, "modelDown was not found");
  // SLICED TO THE FUNCTION'S OWN CLOSE, not to the status being asserted. A
  // first draft ended the window at `{ status: 503 }` — so a mutation changing
  // that status moved the window's END past it and every assertion still
  // matched a wider region. An anchor that moves with the thing it asserts
  // proves nothing, which is this repo's own most repeated testing bug.
  const body = WORKER_SRC.slice(i, WORKER_SRC.indexOf("\n            };", i));
  // 3,000 SINCE 2026-10-03: the helper gained the cut-answer sentence (a list
  // answer refused whole at its ceiling is ours too), still one function.
  assert.ok(body.length > 200 && body.length < 3000, "modelDown was not found whole: " + body.length);
  // 5xx, ALWAYS. The customer's request was fine; ours failed, and a 4xx tells
  // both them and any retry logic the opposite.
  assert.match(body, /\{ status: 503 \}/, "our own outage must not be reported as the caller's mistake");
  assert.ok(!/\{ status: 4\d\d \}/.test(body), "modelDown answers a 4xx: " + body.slice(-200));
  assert.match(body, /upstreamKind\(/, "…without the provider's error type, a billing outage is invisible");
  assert.match(body, /billing:/, "…and the one failure nothing retries past must be named");
  assert.match(body, /cost: 0/, "our outage is our cost");
});

test("a `send` check hands off before its lane's own refusal", () => {
  // The bug being prevented is a lane keeping its own quiet 4xx for our outage.
  // WINDOWED TO THE `return` ON THE SAME LINE, not to a byte count: the first
  // draft ran 400 characters past the check and matched the 409 in the branch
  // BELOW it, reporting a false alarm on correct code — the overlapping-window
  // bug this repo keeps recording, in the guard written to prevent a different
  // one. Each `send` check returns immediately, so anything after that return
  // belongs to a neighbour.
  const checks = [...WORKER_SRC.matchAll(/reason === "send"\)[^\n]*/g)];
  assert.ok(checks.length >= 4, "expected a send check in every lane: " + checks.length);
  for (const m of checks) {
    assert.match(m[0], /return modelDown\(/, "a send check that does not hand off: " + m[0].trim());
    assert.ok(!/status: (4\d\d)/.test(m[0]), "a model outage answered with a 4xx: " + m[0].trim());
  }
});

test("every caller hands the classifier the HTTP status, so a refused key can never read as busy again", () => {
  // The status is the one thing a 401/402/403 always carries; a caller that
  // passes only the body sends the customer "try again in a moment" for an
  // account that has run dry. Caught by a mutation sweep on 2026-09-02: one
  // call site dropped the status and no guard noticed.
  const code = WORKER_SRC.replace(/^\s*\/\/[^\n]*$/gm, (m) => " ".repeat(m.length)).replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
  const calls = [...code.matchAll(/upstreamKind\(([^)]*)\)/g)].filter((m) => !/^detail, status$/.test(m[1].trim()));
  assert.ok(calls.length >= 7, "the observer is dead: too few classifier calls found (" + calls.length + ")");
  for (const m of calls) assert.match(m[1], /e && e\.status/, "a classifier call without the status: upstreamKind(" + m[1] + ")");
});
