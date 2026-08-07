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
const WINDOW = 45;

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
function blockOf(i) {
  const end = Math.min(i + WINDOW, nextDispatchAfter(i));
  return LINES.slice(i, Math.max(end, i + 1)).join("\n");
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
    const stub = () => "x";
    let schema, names = [];
    for (let attempt = 0; attempt < 12; attempt++) {
      try {
        schema = new Function(...names, "return (" + literal + ")")(...names.map(() => stub));
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
