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
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
// THE SCHEMA FRAGMENTS `design_schema` COMPOSES ITSELF FROM. Bound for real in
// the shape check below, never stubbed — see `REAL` there for why.
import { SEEDS_FIELD } from "../builder/site-seeds.mjs";
import { PLAN_FIELDS, SHAPE_FIELD } from "../builder/site-plan.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = fs.readFileSync(path.join(ROOT, "worker.js"), "utf8");
const LINES = SRC.split("\n");

// Routes that are deliberately reachable without a Supabase session, each with
// the reason it is safe. Anything not on this list must gate.
const PUBLIC = {
  "/api/stripe/webhook": "Stripe cannot hold a session; authenticated by HMAC over the raw body instead (stripe-webhook.mjs).",
  "/api/m/*": "Capability URL — the signed, expiring token IN the path is the credential; that is the whole point of a shareable media link.",
  "/api/stripe/site/*": "A SITE OWNER's own Stripe telling us one of their orders was paid. Separate from /api/stripe/webhook, which is isibi's own billing — different account, different signing secret, and one handler deciding whether an event mints platform credits or marks a barber shop's order is not a thing to build. Stripe cannot hold a session; what authenticates it is the HMAC over the raw body verified against THAT SITE's own webhook secret, so a signature valid for one shop proves nothing about another.",
  "/api/db/*": "A published site's own API. Its visitors are not isibi users — a customer booking a haircut has no account here. As of 2026-07-30 it is TRANSPORT ONLY: the row routes were deleted and these paths forward to the site's Neon Data API and Neon Auth, where the site's own RLS policies decide every access question. What is enforced here is a per-source rate limit and that the slug resolves to a real site.",
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
// next-match boundary collapses to zero lines where routes share a dispatch line
// (`=== "/api/video" ? ... : === "/api/image"`) and reports gated routes as open.
// A pure fixed window bleeds into the NEXT route's block and reports an open
// route as gated — which is the dangerous direction, and it happened: the
// published-site data API passed this test while calling no auth at all.
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
// SAME expression — `/api/video`, `/api/image` and `/api/audio` are three arms
// of one ternary, and the gate that covers them comes after all three. Capping
// at the very next line would give each a one-line block and call them open.
//
// The signal is the source, not the line distance. An unfinished expression ends
// in a continuation token (`?`, `:`, `||`, `&&`, `,`, `(`); a finished statement
// does not. This was a proximity test — "within 3 lines is the same decision" —
// and that had a hole big enough to walk through: an UNGATED route written on
// the line above a gated one was read as part of it and inherited its gate.
// Demonstrated by wedging `/api/backdoor` in, which the suite happily passed.
export const CONTINUES = /[?:,(]\s*$|(\|\||&&)\s*$/;
function nextDispatchAfter(i) {
  let last = i;
  for (const j of ROUTE_LINES) {
    if (j <= last) continue;
    // Same expression only if every line between them is still mid-expression.
    let joined = true;
    for (let k = last; k < j; k++) if (!CONTINUES.test(LINES[k])) { joined = false; break; }
    if (joined) { last = j; continue; }
    return j;
  }
  return Infinity;
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
const gatesWithin = (i) => /authUser\(|UNAUTHED\(|bearerUser\(/.test(blockOf(i));

test("worker.js still dispatches on /api paths the way this test reads it", () => {
  // If the router is ever restructured, every assertion below would vacuously
  // pass on an empty set. Fail loudly instead.
  assert.ok(routes().size >= 35, `only found ${routes().size} /api routes — has the router changed shape?`);
});

test("every /api route requires a Supabase session", () => {
  const open = [];
  for (const [name, line] of routes()) {
    if (name in PUBLIC) continue;
    if (!gatesWithin(line)) open.push(`${name} (worker.js:${line + 1})`);
  }
  assert.deepEqual(open, [], "these routes have no authUser/UNAUTHED near their dispatch:\n  " + open.join("\n  "));
});

test("the public allow-list is exactly what we think it is", () => {
  // A route silently DROPPING off the list is as interesting as one being added:
  // it means the endpoint moved, was renamed, or was deleted.
  const names = [...routes().keys()];
  for (const p of Object.keys(PUBLIC)) {
    assert.ok(names.includes(p), `${p} is allow-listed as public but no longer exists — remove it from PUBLIC`);
  }
  assert.equal(Object.keys(PUBLIC).length, 4, "a new unauthenticated endpoint was added — is that intended?");
});

test("the unauthenticated webhook verifies a signature instead", () => {
  const i = routes().get("/api/stripe/webhook");
  const block = LINES.slice(i, i + WINDOW).join("\n");
  assert.match(block, /verifyStripeSignature/, "the one route with no session auth must authenticate some other way");
  assert.match(block, /STRIPE_WEBHOOK_SECRET/);
});

test("a published site's API gates on a site session, not an isibi one", () => {
  // It is allow-listed as public because its visitors are not isibi users. That
  // is only acceptable while it still checks something: the site's own schema
  // for access level, and a site session for member-scoped tables.
  // Checked across EVERY /api/db dispatch rather than the first one. It used to
  // read only the first, which made the assertion depend on route ORDER — and
  // when the auth block above it was deleted the first dispatch became visitor
  // uploads and this went red for a reason that had nothing to do with gating.
  const hits = [...routes()].filter(([p2]) => p2.startsWith("/api/db"));
  assert.ok(hits.length, "no /api/db dispatch found at all");
  for (const [, line] of hits) {
    // Each name here is a function that establishes WHAT the request is for
    // before anything happens: it resolves the slug to a real site, or applies
    // the schema's access rules, or both. A dispatch that matches none of them is
    // acting on a caller-supplied slug it never checked.
    assert.match(blockOf(line), /handleVisitorUpload|loadSiteSchema|siteBackendBySlug|proxySiteService/,
      "every public /api/db dispatch must resolve the site and its access rules (worker.js:" + (line + 1) + ")");
    // And every one is rate limited. These are unauthenticated endpoints; two of
    // them reach a third party (Neon, and Better Auth through the proxy), so an
    // unlimited one is a way to spend somebody else's budget from our origin.
    assert.match(blockOf(line), /_dataLimiter|limitFor/,
      "every public /api/db dispatch must be rate limited (worker.js:" + (line + 1) + ")");
  }
});

test("the window cannot be widened into the next route's gate", () => {
  // The bug this replaced: a fixed window reached past the end of an open route
  // into a neighbouring gated one, so /api/db/* reported as gated while calling
  // no auth at all. Every block must stop at the next dispatch.
  for (const [, line] of routes()) {
    const next = nextDispatchAfter(line);
    if (!Number.isFinite(next)) continue;
    assert.ok(!blockOf(line).includes(LINES[next]),
      "a route's block must not reach the next route's dispatch (worker.js:" + (line + 1) + ")");
  }
});

test("the media proxy is gated on an opaque token, not a guessable id", () => {
  const i = routes().get("/api/m/*");
  const block = LINES.slice(i, i + WINDOW).join("\n");
  assert.match(block, /openMediaToken/, "the token IS the credential here; without it this is an open proxy");
  assert.match(block, /return new Response\("Not found", \{ status: 404 \}\)/, "an unopenable token must not fall through");
});

test("the router has a catch-all so an unmatched /api path is never served as an asset", () => {
  // Without this, a typo'd or future route would fall through to ASSETS.fetch
  // and answer 200 with the SPA shell — which reads as "endpoint exists".
  assert.match(SRC, /if \(url\.pathname\.startsWith\("\/api\/"\)\) \{\s*\n\s*return Response\.json\(\{ error: "not found" \}, \{ status: 404 \}\);/);
});

test("the scanner itself catches an ungated route written next to a gated one", () => {
  // A self-test, because this test IS the invariant — if its window bleeds into
  // a neighbouring block, an open route reads as gated and nothing anywhere
  // notices. That is not hypothetical: the proximity rule this replaced passed
  // a wedged `/api/backdoor` in exactly this position.
  const target = LINES.findIndex((l) => /url\.pathname\.startsWith\("\/api\/site\/"\)/.test(l));
  assert.ok(target > 0, "expected a /api/site/ dispatch to wedge against");

  const wedged = LINES.slice();
  wedged.splice(target, 0, '    if (url.pathname === "/api/backdoor") { return Response.json({ ok: true }); }');

  // Re-run the same analysis over the doctored source.
  const routeLines = wedged.reduce((a, l, i) => (/url\.pathname\s*(?:===\s*"\/api\/|\.startsWith\("\/api\/)/.test(l) ? a.concat(i) : a), []);
  const nextAfter = (i) => {
    let last = i;
    for (const j of routeLines) {
      if (j <= last) continue;
      let joined = true;
      for (let k = last; k < j; k++) if (!CONTINUES.test(wedged[k])) { joined = false; break; }
      if (joined) { last = j; continue; }
      return j;
    }
    return Infinity;
  };
  const block = wedged.slice(target, Math.max(Math.min(target + WINDOW, nextAfter(target)), target + 1)).join("\n");
  assert.ok(!/authUser\(|UNAUTHED\(|bearerUser\(/.test(block),
    "an ungated route adjacent to a gated one must NOT inherit its gate:\n" + block);
});

test("the schema designer is told what makes a form able to accept a file", () => {
  // Measured 2026-07-28: across seven generated sites the designer put image
  // columns on `display` tables every time and on a `collect` table never — so
  // the visitor upload path, which requires one, could not fire on a single
  // site. A feature that can never trigger is not a shipped feature.
  const i = SRC.indexOf('name: "design_schema"');
  assert.ok(i > 0, "the schema tool moved");
  // Bounded by where the tool actually ENDS, not by a magic 6000 characters.
  // Adding the `jobs` block near the top of the tool pushed the columns
  // description past that window and this went red on a change that had nothing
  // to do with it — the check was measuring a byte offset, not a fact.
  const tool = SRC.slice(i, SRC.indexOf('tool_choice: { type: "tool", name: "design_schema" }', i));
  assert.match(tool, /A picture is a 'text' column whose value is a URL/);
  assert.match(tool, /ONLY when the brief says the VISITOR sends a picture/);
  assert.match(tool, /photo, image_url, avatar/);
});

test("every tool the model is given is a schema the API will accept", () => {
  // `unique` shipped as `type:"array", items:{}` — an empty schema, meant to
  // allow two different shapes. The Anthropic API rejected the WHOLE tool for
  // it, so every build with a brief answered "the designer is busy" and the
  // builder's main path was down for three merges. Nothing in the unit suite
  // looked at the tool's shape, and the smoke test that would have caught it
  // runs after the deploy, so it lagged three PRs behind.
  //
  // Structural, not semantic: an array needs real `items`, an object needs
  // `properties`, and everything needs a `type`.
  const walk = (node, path) => {
    if (!node || typeof node !== "object") return;
    if (node.type === "array") {
      assert.ok(node.items && typeof node.items === "object" && Object.keys(node.items).length,
        `${path}: an array property needs a non-empty \`items\``);
      assert.ok(node.items.type, `${path}.items: needs a type`);
      walk(node.items, path + ".items");
    }
    if (node.type === "object" && node.properties) {
      for (const [k, v] of Object.entries(node.properties)) {
        assert.ok(v && v.type, `${path}.${k}: needs a type`);
        walk(v, path + "." + k);
      }
    }
  };

  // A NAME THAT IS ITSELF A SCHEMA GETS THE REAL THING, NEVER THE STUB — and
  // this is the FOURTH time this stand-in has been too simple, which is the
  // pattern worth naming rather than the individual fix.
  //
  // A whole sub-schema composed in another module (`seeds: SEEDS_FIELD`) reads
  // as a Proxy with no `type`, so the walk below reported "needs a type" about a
  // field that has one — a false alarm — and, had the walk been written the
  // other way round, would instead have skipped it silently. Either way
  // `design_schema.seeds` would be covered by nothing, which is precisely the
  // gap that let `unique`'s empty `items` through and took the builder's main
  // path down for three merges.
  //
  // The stub still stands in for everything else; only names that ARE schema
  // fragments are bound for real, because those are the ones this test exists
  // to inspect. A fragment added later and not listed here fails loudly on its
  // first missing `type` rather than passing quietly.
  const REAL = { SEEDS_FIELD, PLAN_FIELDS, SHAPE_FIELD };

  // Every tool definition in worker.js, found by its input_schema.
  const tools = [...SRC.matchAll(/name:\s*"([a-z_]+)",\s*\n\s*description:[\s\S]{0,400}?input_schema:\s*\{/g)];
  assert.ok(tools.length >= 1, "no tool definitions found — has worker.js changed shape?");

  // The scan is a regex over source, so it can silently stop finding a tool —
  // and a check that covers nothing passes exactly like one that covers
  // everything. Naming the tools that must be reached turns that into a failure.
  // `design_schema` is the builder's main path and the one that took it down.
  const found = tools.map((t) => t[1]);
  for (const must of ["design_schema", "write_prompt", "respond"]) {
    assert.ok(found.includes(must), `the scan no longer finds ${must} — the regex has drifted`);
  }

  const skipped = [];
  for (const t of tools) {
    const open = SRC.indexOf("{", t.index + t[0].length - 1);
    let depth = 0, end = open;
    for (let i = open; i < SRC.length; i++) {
      if (SRC[i] === "{") depth++;
      else if (SRC[i] === "}") { depth--; if (!depth) { end = i; break; } }
    }
    // Only the shape matters, but a couple of these are not plain literals:
    // `write_prompt` builds part of itself with a conditional spread
    // (`...(shotsCapable ? {…} : {})`). Any name the literal reaches for is
    // bound to `true`, so the branch that ADDS structure is the one checked —
    // that is the half with something to get wrong. Before this, such a tool
    // threw a ReferenceError and was silently skipped, so the one tool with a
    // computed schema was covered by nothing.
    const literal = SRC.slice(open, end + 1);
    // The stub is TRUTHY AND CALLABLE, not just truthy. Bound to `true`, a
    // schema that CALLS one of these names — `description: "..." +
    // familiesForPrompt()` — threw "is not a function", which is not the
    // "is not defined" shape this loop retries on, so the tool went into
    // `skipped` and design_schema was checked by nothing. Same lesson as the
    // `setTotp` fake: a stand-in less capable than the real thing hides the
    // bug rather than the bug hiding from it. A function is truthy, so the
    // conditional-spread branch this loop was built for is unchanged.
    // ARRAY-LIKE AS WELL AS CALLABLE, for the same reason it became callable:
    // `design_schema` builds its `tokens` properties with
    // `SITE_TOKEN_NAMES.map(...)`, and a plain function has no `.map` — so the
    // tool threw "is not a function", which is not the "is not defined" shape
    // this loop retries on, and the builder's main tool went back into
    // `skipped` and was checked by nothing. Third time this stub has been too
    // simple; it now stands in for a callable, a value, and a list.
    const stub = new Proxy(function () { return "x"; }, {
      apply: () => "x",
      get(target, k) {
        const arr = ["x"];
        if (k === "length") return arr.length;
        if (k === "0") return arr[0];
        if (typeof arr[k] === "function") return arr[k].bind(arr);
        if (k === Symbol.iterator) return arr[Symbol.iterator].bind(arr);
        return Reflect.get(target, k);
      },
    });
    let schema, names = [];
    for (let attempt = 0; attempt < 12; attempt++) {
      try {
        schema = new Function(...names, "return (" + literal + ")")(...names.map((n) => REAL[n] ?? stub));
        break;
      } catch (e) {
        const m = /^(\w+) is not defined$/.exec(e.message || "");
        if (!m || names.includes(m[1])) { skipped.push(`${t[1]}: ${e.message}`); break; }
        names.push(m[1]);
      }
    }
    if (!schema) { if (!skipped.length || !skipped[skipped.length - 1].startsWith(t[1])) skipped.push(`${t[1]}: unresolved`); continue; }
    walk(schema, t[1]);
  }

  // A skip is a tool nobody checked. It must be visible rather than quiet — the
  // outage this test exists for was a malformed schema in a tool exactly like
  // these, and a guard that shrugs is worse than no guard, because it reads as
  // coverage.
  assert.deepEqual(skipped, [], "tool schemas that could not be parsed, so were never checked:\n" + skipped.join("\n"));
});

test("the placeholder page describes each access level correctly", () => {
  // It is the only thing a failed build leaves the owner, and it called a
  // `collect` table "shared across visitors" — the opposite of write-only.
  // Seen on a real published fallback on 2026-07-29.
  const i = SRC.indexOf("function schemaPlaceholderPage");
  assert.ok(i > 0, "the placeholder moved");
  const body = SRC.slice(i, i + 1800);
  assert.ok(!/\? "each visitor sees only their own rows" : "shared across visitors"/.test(body),
    "the two-way label is back — collect and admin are not 'shared across visitors'");
  for (const level of ["display", "collect", "user", "feed", "admin"]) {
    assert.match(body, new RegExp("\\b" + level + ":"), "no wording for access level " + level);
  }
  assert.match(body, /only you can read it/, "a collect table must be described as write-only");
});

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
const WORKER_SRC = _rf(new URL("../worker.js", import.meta.url), "utf8");

/** The real function, lifted out of worker.js, which cannot be imported. */
const upstreamKind = (() => {
  const m = WORKER_SRC.match(/function upstreamKind\(detail\) \{[\s\S]*?\n\}/);
  assert.ok(m, "upstreamKind was not found in worker.js");
  return new Function("detail", m[0].replace(/^function upstreamKind\(detail\) \{/, "") .replace(/\n\}$/, "") + "\n");
})();

test("an upstream error type is passed through only when it is a plain token", () => {
  assert.equal(upstreamKind('{"error":{"type":"invalid_request_error","message":"x"}}').type, "invalid_request_error");
  assert.equal(upstreamKind('{"error":{"type":"rate_limit_error"}}').type, "rate_limit_error");
  // Anything that is not a bare token is DROPPED, not echoed — this must never
  // become a channel for arbitrary upstream text reaching a caller.
  assert.equal(upstreamKind('{"error":{"type":"your brief was: build me a spa for Acme"}}').type, null);
  assert.equal(upstreamKind('{"error":{"type":"<script>alert(1)</script>"}}').type, null);
  assert.equal(upstreamKind('{"error":{"type":123}}').type, null);
  assert.equal(upstreamKind("not json at all").type, null);
  assert.equal(upstreamKind(undefined).type, null);
});

test("the billing case is recognised, and nothing else is", () => {
  assert.equal(upstreamKind('{"error":{"type":"invalid_request_error","message":"Your credit balance is too low to access the Anthropic API"}}').billing, true);
  assert.equal(upstreamKind('{"error":{"type":"invalid_request_error","message":"insufficient credit"}}').billing, true);
  // A 400 about the REQUEST is not a billing failure, and saying it is would
  // send somebody to top up an account that is already funded.
  assert.equal(upstreamKind('{"error":{"type":"invalid_request_error","message":"max_tokens: must be <= 8192"}}').billing, false);
  assert.equal(upstreamKind('{"error":{"type":"overloaded_error","message":"Overloaded"}}').billing, false);
  assert.equal(upstreamKind("").billing, false);
});

test("the model's own message never reaches a caller", () => {
  // The whole reason `detail` is withheld. Whatever comes back, the only strings
  // that leave are ones this repo wrote.
  const out = upstreamKind('{"error":{"type":"invalid_request_error","message":"the brief said: Acme Dental, 42 High St"}}');
  assert.deepEqual(Object.keys(out).sort(), ["billing", "type"]);
  assert.ok(!JSON.stringify(out).includes("Acme"), JSON.stringify(out));
});

test("the page-generation catch returns the stage, not only a note", () => {
  const branch = WORKER_SRC.slice(WORKER_SRC.indexOf('console.error("page generation failed:'));
  const block = branch.slice(0, branch.indexOf("\n        }"));
  assert.match(block, /pages\.stage = "generate"/, "a thrown generator must report its stage");
  assert.match(block, /pages\.error =/, "…and why, or a total outage looks like an unusable page");
  assert.match(block, /upstreamKind\(/, "…through the sanitiser, never the raw detail");
  // `detail` may appear in exactly two places: the log line, and the argument
  // to the sanitiser. Anywhere else it is on its way to the caller. Checked by
  // removing those two and asserting nothing is left — the first version looked
  // for one specific assignment and a ternary across two lines walked past it.
  const rest = block
    .replace(/console\.error\([^;]*\);/, "")
    .replace(/upstreamKind\(e && e\.detail\)/, "");
  assert.ok(!/e\.detail/.test(rest), "the raw upstream detail must not be returned: " + rest);
});

// THE DESIGN CATCH MUST NAME THE ERROR'S CLASS, because that is the only thing
// that speaks when there was no HTTP response at all.
//
// `upstream` and `upstreamType` are both read off a response BODY, so a `fetch`
// that throws — a network fault, a DNS blip, an aborted connection, or a bug of
// ours in the same try — leaves both null and the reply says nothing about what
// happened. Measured 2026-08-12: `edit smoke` failed here twice against a Worker
// byte-identical to one that had passed eleven minutes earlier, and the response
// could not distinguish "the network dropped" from "we threw".
test("the design catch returns the error's class, and its message only for a ReferenceError", () => {
  const branch = WORKER_SRC.slice(WORKER_SRC.indexOf('console.error("schema design failed:'));
  const block = branch.slice(0, branch.indexOf("{ status: 503 }"));
  assert.ok(block.length > 200 && block.length < 4000, "the design catch was not found whole: " + block.length);
  assert.match(block, /kind: String\(\(e && e\.name\) \|\| "Error"\)/, "the class must be returned");
  // THE MESSAGE IS WITHHELD FROM EVERY CLASS BUT ONE. A provider message can
  // quote the request, and the request carries the brief. A ReferenceError's
  // message is always "<name> is not defined" — a programmer bug, never request
  // data — and it is how `OWN_ZONES` was found.
  assert.match(block, /=== "ReferenceError" \?/, "the message must be gated on the one safe class");
  // `e.message` may appear in exactly two places: the log line, and inside that
  // gate. Anywhere else it is on its way to a caller unconditionally. Removed
  // and then asserted gone, the same shape as the page-generation guard above —
  // a check for one specific spelling is walked past by a ternary.
  const rest = block
    .replace(/console\.error\([^;]*\);/, "")
    .replace(/\(e && e\.name\) === "ReferenceError" \? String\(\(e && e\.message\) \|\| ""\)\.slice\(0, \d+\) : undefined/, "");
  assert.ok(!/e\.message/.test(rest), "the raw error message must not be returned: " + rest);
  assert.ok(!/e\.detail/.test(rest.replace(/upstreamKind\(e && e\.detail\)/, "")),
    "the raw upstream detail must not be returned: " + rest);
});

// EVERY OWNER-SCOPED MATCHER MUST BE DISPATCHED, not merely gated.
//
// `/api/site/<slug>/domains` was defined, handled, and reachable by NOTHING:
// `dm2` was missing from the `if (om || mm || …)` that guards the block its
// handler lives in, so every request fell through to the router's 404. The
// whole custom-domains feature was dead — the panel called it, the Cloudflare
// zone was configured for it, and the answer was always 404.
//
// The existing gate test could not see it. It asserts each route sits behind
// `authUser`, and this one did — inside a block it could never enter. That is
// the guard watching the layer below the break, which this codebase keeps
// recording. This one runs the other way: from the matchers that EXIST to the
// condition that admits them.
//
// It is also invisible from outside: `assertOwner` answers 404 for a slug that
// is not yours, so a live probe of an undispatched route and a correctly
// refused one look identical.
test("every owner-scoped route matcher appears in the dispatch condition", () => {
  const src = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");

  // The matchers: `const <name> = url.pathname.match(/^\/api\/site\/…` — found
  // by shape rather than by a list, or this restates the thing it guards.
  const matchers = [...src.matchAll(/const (\w+) = url\.pathname\.match\(\/\^\\\/api\\\/site\\\//g)].map((m) => m[1]);
  assert.ok(matchers.length >= 7, `only found ${matchers.length} /api/site matchers — the scan broke`);
  assert.ok(matchers.includes("dm2"), "the domains matcher is gone or renamed");

  const cond = src.match(/if \(((?:\w+ \|\| )+\w+)\) \{\n\s*const ou = await authUser\(request\);/);
  assert.ok(cond, "the owner dispatch condition is gone or reshaped");
  const dispatched = new Set(cond[1].split("||").map((s) => s.trim()));

  // BOTH DIRECTIONS. The loop below walks matchers → condition, and on its own
  // it passes when the SCAN stops seeing a matcher: the count check is a floor,
  // not a census, so one dropping out simply goes unchecked. Walking
  // condition → matchers makes the scan's own coverage self-verifying, since
  // every name the condition admits must be a matcher the scan actually found.
  // Caught by mutation — renaming one matcher's `.match(` passed everything else.
  for (const name of dispatched) {
    assert.ok(matchers.includes(name),
      `the dispatch admits ${name} but the matcher scan never found it — the scan is covering less than it looks`);
  }

  for (const name of matchers) {
    // `sm` and friends that belong to other dispatches are fine — what must
    // hold is that anything HANDLED inside this block is admitted by it.
    if (!new RegExp(`if \\(${name}\\)`).test(src)) continue;
    assert.ok(dispatched.has(name),
      `${name} is handled inside the owner block but not in its dispatch condition — ` +
      `every request to that route 404s`);
  }

  // The same list appears twice, and a name in one but not the other throws a
  // TypeError on a live route instead of 404ing it.
  const slugPick = src.match(/const ownerSlug = \(((?:\w+ \|\| )+\w+)\)\[1\]/);
  assert.ok(slugPick, "ownerSlug no longer picks from the matcher list");
  assert.deepEqual(new Set(slugPick[1].split("||").map((s) => s.trim())), dispatched,
    "the dispatch condition and the ownerSlug list disagree");
});

// THE SAME BUG A THIRD TIME, ONE LAYER FURTHER OUT — and the test above could
// not see it, which is the point of adding this one.
//
// The block those matchers live in sits inside an OUTER gate. That gate used to
// carry its own list of the same routes, spelled a different way:
//
//   startsWith("/api/site/") && (includes("/rows") || includes("/members") || …)
//
// `/versions` and `/text` were added to the matchers, to the dispatch condition
// and to `ownerSlug` — all three checked above, all three green — and not to
// that list. So neither route could be reached at all: version history and free
// text editing were both dead on arrival, answering the router's bottom 404 to
// their own owner. Found by driving the deployed Worker, not by reading it,
// because from outside an undispatched route and one `assertOwner` refuses are
// the same 404.
//
// The fix is structural rather than another entry: there is now ONE list, and
// this asserts the outer gate does not become a second one. A `&&` there is not
// automatically wrong, but a path test there is, since that is the only thing
// that can narrow which routes get in.
test("the owner block's outer gate is a bare prefix, not a second route list", () => {
  const src = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");

  // Anchored on the matcher that must follow it, so this cannot drift onto some
  // other `/api/site/` prefix test elsewhere in the router.
  const gate = src.match(/\n\s*if \(([^\n]*startsWith\("\/api\/site\/"\)[^\n]*)\) \{\n\s*const om = url\.pathname\.match\(/);
  assert.ok(gate, "the owner block's outer gate is gone or reshaped");

  const cond = gate[1];
  assert.equal(cond.trim(), 'url.pathname.startsWith("/api/site/")',
    "the outer gate has grown a second condition — anything narrowing it silently " +
    "un-dispatches routes the inner condition admits, which is how /versions and " +
    "/text shipped unreachable");
  assert.ok(!/includes\(/.test(cond),
    "the outer gate names paths again — that list and the matcher list drift apart, " +
    "and the drift is invisible from outside because both answer 404");
});

// `r` IN THE OWNER BLOCK IS A `{body, status}`, NEVER A `Response`.
//
// That block ends in `return Response.json(r.body, { status: r.status })`, so a
// real Response assigned to `r` has its `.body` read as a ReadableStream. The
// domains route did exactly that: its GET answered `200 {}` and its POST threw
// into the catch as a `500` — after the row had already been inserted.
//
// Third dead layer in one feature, and the nastiest, because the DIRECT
// `return Response.json(...)` calls in the same branch were correct throughout.
// So every refusal answered properly and only the successes were broken, which
// reads like a backend problem rather than a response-shape one.
test("nothing in the owner block assigns a Response to `r`", () => {
  const src = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");

  // Anchor on the block by its terminator, so this cannot drift onto some other
  // region of the router that legitimately hands back Responses.
  const end = src.indexOf("return Response.json(r.body, { status: r.status });");
  assert.ok(end > 0, "the owner block no longer ends in `Response.json(r.body, …)` — re-anchor this test");
  const start = src.lastIndexOf("const ou = await authUser(request);", end);
  assert.ok(start > 0 && end - start > 2000, "could not locate the owner block");
  const block = src.slice(start, end);

  const bad = [...block.matchAll(/^\s*r = Response\.json\(/gm)];
  assert.deepEqual(bad.map((m) => m[0].trim()), [],
    "`r` must be a plain {body, status}; a Response here serialises as {} or throws");

  // And the scan must actually be looking at assignments, or "none found" is
  // true of an empty string as well.
  assert.ok(/^\s*r = \{ body:/m.test(block) || /r = await handleOwner/.test(block),
    "the scan found no `r =` assignments at all — it is looking at the wrong region");
});


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
    assert.match(block, /await refundFields\(schemaCost\)/, what + " keeps the customer's money on our own failure");
    assert.match(block, /\.\.\.back/, "…and must report what really stayed on the ledger, or the response asserts a refund that did not land");
  });
}

test("the schema-apply 502 scrubs what it returns", () => {
  // Its sibling one branch up already did. A Postgres or Neon error can quote
  // the statement, and the statement is built from the connection the vault
  // handed us.
  const i = WORKER_SRC.indexOf('console.error("schema apply failed:');
  const block = WORKER_SRC.slice(i, WORKER_SRC.indexOf("{ status: 502 }", i));
  assert.match(block, /scrubSecrets\(/, "the schema-apply detail must go through the scrubber");
});

// AN EXPLICIT SCHEMA SKIPS THE MODEL CALL, NOT THE AFFORDABILITY CHECK.
//
// The deposit and `buildFloor` both live inside `if (!body.schema)`, and
// provisioning runs after it either way — so anyone signed in who posted their
// own schema reached `ensureSiteBackend` with no credit check at all. What was
// free is the NEON PROJECT: a capped, billed resource, one per site, against a
// platform-wide cap of 100.
test("the explicit-schema build path still checks the balance before provisioning", () => {
  const i = WORKER_SRC.indexOf("      if (!body.schema) {");
  assert.ok(i > 0, "the schema-exempt block was not found");
  const prov = WORKER_SRC.indexOf("db = await ensureSiteBackend(", i);
  assert.ok(prov > i, "provisioning was not found after the schema block");
  const between = WORKER_SRC.slice(i, prov);
  // The `else` arm of that same `if` is the only place it can go and still be
  // on the path a schema-carrying build takes.
  assert.match(between, /\} else \{[\s\S]*readCredits\(/, "the explicit-schema path reaches provisioning with no balance read");
  assert.match(between, /need: "credits"/, "…and must refuse in the shape the client already handles");
  // FAILS CLOSED. An unreadable ledger is the shape that made this free in the
  // first place: "cannot tell" must not mean "go ahead" on the one path that
  // provisions a capped resource.
  assert.match(between, /bal === null \|\| bal < floor/, "an unreadable balance must refuse, not proceed");
});

// A GAME BUILD THAT DIES IN OUR CONTAINER GIVES THE CREDITS BACK.
//
// Both game routes collect the model charge the moment each generation returns,
// before anything compiles, and nothing gave it back — so a container drained
// mid-bundle, or one that never started ("build service returned no JSON"),
// kept 20-30 credits and delivered no game. There was no refund on ANY failure
// branch of either route, and `/api/refund` covers fal jobs only.
test("both game routes refund on a build failure and on a throw", () => {
  const marks = [...WORKER_SRC.matchAll(/ev: "error", stage: "build"/g)];
  assert.equal(marks.length, 2, "expected the build and revise routes: " + marks.length);
  for (const m of marks) {
    const block = WORKER_SRC.slice(Math.max(0, m.index - 1400), m.index + 200);
    assert.match(block, /refundCredits\(env, gu\.id, cost\)/, "a game build failure kept the charge");
  }
  const throws = [...WORKER_SRC.matchAll(/emit\(\{ ev: "error", msg: \(e && e\.status === 402\)/g)];
  assert.equal(throws.length, 2, "expected two game catch blocks: " + throws.length);
  for (const m of throws) {
    const block = WORKER_SRC.slice(Math.max(0, m.index - 700), m.index);
    assert.match(block, /refundCredits\(env, gu\.id, cost\)/, "a game throw kept the charge");
    // Never on a 402: that IS the ledger refusing, so nothing was taken and
    // "refunding" it would mint credits out of a failure to pay.
    assert.match(block, /!\(e && e\.status === 402\)/, "a 402 must not be refunded — nothing was taken");
  }
});

test("the game routes declare `cost` where their catch can see it", () => {
  // Declared inside the try, `cost` is not in scope in the catch — a
  // ReferenceError on the one path that gives a customer their credits back,
  // which is this file's own most repeated bug arriving in the fix for it.
  const runs = [...WORKER_SRC.matchAll(/const run = async \(\) => \{\n([\s\S]{0,400}?)try \{/g)];
  assert.equal(runs.length, 2, "expected two game run() blocks: " + runs.length);
  for (const m of runs) {
    assert.match(m[1], /let cost = 0;/, "`cost` must be declared before the try, or the catch cannot refund it");
  }
});

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

test("the compileMsg scan can actually fail", () => {
  // A scan that stopped matching would report a clean file forever. Driven
  // against the exact shape of the bug it was written for.
  const fake = 'msg: compileMsg(tPub, "x"),\nconst out = 1;';
  const names = [...fake.matchAll(/compileMsg\(\s*([A-Za-z_$][\w$]*)\s*,/g)].map((m) => m[1]);
  assert.deepEqual(names, ["tPub"]);
  assert.equal(/(?:const|let|var)\s+tPub\b/.test(fake), false, "the declaration check must not match a name that is only used");
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
  const i = WORKER_SRC.indexOf("const bill = pageCredits(");
  assert.ok(i > 0, "the addon bill was not found");
  const line = WORKER_SRC.slice(i, WORKER_SRC.indexOf("\n", i));
  assert.ok(!/\+\s*pageCredits\(/.test(line), "the addon adds two separately-rounded bills: " + line.trim());
  assert.match(line, /pageCredits\([^)]*,[^)]*\)/, "both usages must go through one variadic call: " + line.trim());
});

test("adding two pageCredits results really does overcharge", async () => {
  // The assertion above is about spelling; this is about why it matters, driven
  // through the real pricing module rather than restated.
  const { pageCredits } = await import("../builder/publish-pages.mjs");
  const design = { in: 500, out: 300, model: "claude-haiku-4-5" };
  const gen = { in: 2000, out: 9000, cacheRead: 27000, model: "claude-sonnet-5" };
  assert.ok(pageCredits(design) + pageCredits(gen) > pageCredits(design, gen),
    "summing rounds twice — if this ever stops being true the guard above is pointless");
  const tiny = { in: 10, out: 5, model: "claude-haiku-4-5" };
  assert.equal(pageCredits(tiny, tiny), 1, "two tiny calls are one credit together");
  assert.equal(pageCredits(tiny) + pageCredits(tiny), 2, "…and two apart, which is the double floor");
});

// A PHOTOGRAPH BOUGHT BY THE PICTURE LAYER IS BILLED.
//
// It charged `pageCredits(usage)` over model tokens only, so a generated
// photograph — $0.15 of real fal spend and ~19 credits, the exact charge the
// BUILD path applies for the identical picture — cost the customer nothing.
// Latent only while the image balance is empty; the day it is funded it is live
// money going out with nothing coming back.
test("the picture layer bills the photographs it bought", () => {
  const i = WORKER_SRC.indexOf('ok: true, layer: "picture"');
  assert.ok(i > 0, "the picture success response was not found");
  const block = WORKER_SRC.slice(Math.max(0, i - 900), WORKER_SRC.indexOf("});", i));
  assert.match(block, /images: pOut\.made\.length/, "the photographs are not priced into the bill");
  assert.match(block, /eCharge\(pOut\.usage, pImages\)/, "…and must be charged through the same one call as the tokens");
  // COUNTED FROM `made`, not from what was asked for: a photograph that failed
  // or was never affordable was never bought.
  assert.ok(!/images: pOut\.(budget|planned|changed)/.test(block), "the bill must count what was MADE, not what was wanted");
});

test("the picture layer's working balance moves as it spends", () => {
  // Read once and never decremented, the per-picture affordability check could
  // not bind across a batch: an account with 20 credits passed the same check
  // three times and bought three photographs it could afford one of.
  const i = WORKER_SRC.indexOf("const pOut = await runPictureEdit({");
  const block = WORKER_SRC.slice(Math.max(0, i - 900), WORKER_SRC.indexOf("}, { instruction: eInstruction, pages: eSrc });", i));
  assert.match(block, /let balance = await readCredits/, "a const balance can never be decremented");
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
  assert.ok(body.length > 200 && body.length < 2500, "modelDown was not found whole: " + body.length);
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

// ─────────────────────────────────────────────────────────────────────────
// THE DESIGNER SEES THE ATTACHED FILES.
//
// `attachments()` has always split the composer's files into content blocks
// (images, PDFs) and plain text, and only the PAGE call got the blocks. Text was
// folded into the brief and reached the designer; a picture or a PDF did not. So
// a café owner attaching their menu as a PDF got a menu table the model
// INVENTED — because seed rows are written by the DESIGNER, and that is the one
// call that never saw the menu.
//
// The recorded reason not to do this was that it "means paying for those tokens
// on the flat-fee schema call". That reason expired on 2026-08-08, when the fee
// became a deposit `schemaSettlement` trues up against real usage.
test("the build route hands the attached files to the designer", () => {
  assert.match(WORKER_SRC, /designSiteSchema\(env, briefWithLinks, models\.design, editState, attached\.blocks\)/,
    "the designer is still not given the attached files, so a PDF menu cannot reach the seed rows");
  // The blocks are the IMAGE/PDF pile, not the text one — text already reached
  // the designer by a different route, folded into the brief.
  assert.match(WORKER_SRC, /const attached = attachments\(body\.images\)/, "the splitter is not called");
});

test("attachments ride in the designer's user message, after the cached blocks", () => {
  // Anywhere in `system` or `tools` and every attachment is a cache MISS on
  // ~10,800 identical tokens — which costs far more than the files do. This is
  // the same placement `pagesRequest` uses and for the same measured reason.
  const i = WORKER_SRC.indexOf("async function designSiteSchema(");
  const fn = WORKER_SRC.slice(i, WORKER_SRC.indexOf("\n}\n", i));
  assert.ok(fn.length > 800, "designSiteSchema was not found whole: " + fn.length);
  const sys = fn.indexOf("system: [");
  const msg = fn.indexOf('messages: [{ role: "user"');
  assert.ok(sys > 0 && msg > sys, "the user message no longer comes after the system block");
  assert.ok(!/system: \[[\s\S]{0,400}files/.test(fn), "the files reached the cached system block");
  // BEFORE the text within that message — the order the API is documented to
  // work best in, and the order the page prompt already uses.
  assert.match(fn, /\[\.\.\.blocks, \{ type: "text", text \}\]/,
    "the files must come before the text in the user message");
});

test("a build with no attachments sends the shape it always sent", () => {
  // The content stays a plain STRING rather than a one-element array, so no
  // request that does not use the feature changes at all — the property that
  // makes this safe to add to the most expensive call on the platform.
  const i = WORKER_SRC.indexOf("async function designSiteSchema(");
  const fn = WORKER_SRC.slice(i, WORKER_SRC.indexOf("\n}\n", i));
  assert.match(fn, /blocks\.length \? \[\.\.\.blocks, \{ type: "text", text \}\] : text/,
    "an empty attachment list must fall back to a plain string");
  // And the parameter DEFAULTS to empty, so the two callers that pass nothing
  // (the look layer and the addon) are untouched.
  assert.match(WORKER_SRC, /async function designSiteSchema\(env, brief, model = modelsFor\(\)\.design, current = null, files = \[\]\)/,
    "files must default to empty, or the callers that pass none break");
});

// ─────────────────────────────────────────────────────────────────────────────
// THE WIRING FOR THE UNGUARDED-BOOKING WARNING.
//
// `unguardedBookings` is correct and tested at the leaf, which is exactly the
// state `teamScope` was in while being dead at five layers, and `budgetFor` was
// in while `worker.js` still read `revise ? 0`. This file exists because the
// Worker cannot be imported: a function can be perfect and called by nothing,
// and every unit test still passes. Asserted at three points, because any one
// of them alone passes while the wire is cut.
test("the build route computes the unguarded-booking warning and returns it", () => {
  const w = SRC;
  // 1. IMPORTED. A call to a name that was never imported is a ReferenceError on
  //    the build path — the OWN_ZONES failure, which took every custom-domain
  //    call down for days without a syntax error anywhere.
  const imp = /import \{([^}]*)\} from "\.\/site-access\.mjs"/.exec(w);
  assert.ok(imp, "the site-access import is gone");
  assert.match(imp[1], /\bunguardedBookings\b/,
    "unguardedBookings is used in worker.js and never imported — a ReferenceError on every build");

  // 2. CALLED, on the spec that is actually built. Anchored on the assignment
  //    rather than on the bare name, so a mention in a comment cannot satisfy it.
  assert.match(w, /const unguarded = unguardedBookings\(spec\)/,
    "nothing computes the warning from the normalised spec");

  // 3. RETURNED. The whole point is that the omission is visible from outside;
  //    computed and dropped is the dead-field shape that let a failed build tick
  //    every step. Bounded like its neighbours, so one broken schema cannot
  //    return an unbounded list.
  assert.match(w, /unguarded: unguarded\.length \? unguarded\.slice\(0, \d+\) : undefined/,
    "the warning is computed and never put on the response");
});

test("the designer is told how to build a slot that holds more than one person", () => {
  // The substrate could always do this — a function is SECURITY DEFINER, so it
  // writes into a table the caller cannot, and `useRpcAction` calls it from a
  // page. Nothing said so, which made capacity unreachable in practice on the
  // commonest kind of site this platform builds.
  const w = SRC;
  const at = w.indexOf('name: "design_schema"');
  const fns = w.indexOf("OPTIONAL Postgres functions", at);
  assert.ok(fns > 0, "the functions field is gone — retarget this test");
  // Windowed to the functions field by its NEXT landmark, never a byte count —
  // a window sized in bytes stops covering what it was written for the moment a
  // comment is added above it, which has happened repeatedly in this repo.
  const end = w.indexOf("RECEIVING DATA FROM ANOTHER SYSTEM", fns);
  const body = w.slice(fns, end > fns ? end : fns + 4000);
  assert.ok(body.length > 500, "the functions description was not read whole: " + body.length);

  assert.match(body, /holds more than one|capacity/i, "the capacity case is not described at all");
  // THE LOCK IS THE CORRECTNESS OF THE WHOLE PATTERN. A bare count-then-insert
  // lets two people both see the last place and both take it — the exact double
  // booking `unique` exists to prevent, reintroduced by the thing meant to
  // generalise it. A capacity paragraph without this is worse than none.
  assert.match(body, /pg_advisory_xact_lock/,
    "the capacity pattern is described without the lock, so it races on precisely the class that fills up");
  // And it must say to close the direct write path, or the function is one route
  // in among two and the open one wins.
  assert.match(body, /write: \\?"none\\?"/,
    "nothing says to close the table to direct writes, so the capacity check can be walked around");
});

test("the build route records what the designer reached for", () => {
  // `droppedFields` reads the RAW answer, and the raw answer exists in exactly
  // one place: this route, before `normalizeSchema` throws the unknown fields
  // away. Correct-and-uncalled is the state `teamScope` was in while dead at
  // five layers, and worker.js cannot be imported.
  const w = SRC;
  const imp = /import \{([^}]*)\} from "\.\/site-schema\.mjs"/.exec(w);
  assert.ok(imp, "the site-schema import is gone");
  assert.match(imp[1], /\bdroppedFields\b/,
    "droppedFields is used in worker.js and never imported — a ReferenceError on every build");

  // READ OFF THE RAW ANSWER, not off `spec`. Passing the normalised spec would
  // report nothing on every build forever, because the allow-list has already
  // removed exactly what this is looking for — a feature that cannot fail and
  // cannot ever fire.
  assert.match(w, /const reached = droppedFields\(body\.schema \|\| designed \|\| \{\}\)/,
    "the recorder is not reading the raw designer answer");
  assert.ok(!/droppedFields\(spec\)/.test(w),
    "the recorder reads the NORMALISED spec, where the dropped fields are already gone");

  assert.match(w, /reached: reached\.length \? reached : undefined/,
    "what the designer reached for is computed and never put on the response");
});
