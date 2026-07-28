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
  "/api/db/*": "A published site's own API. Its visitors are not isibi users — a customer booking a haircut has no account here. It gates on the SITE's schema and, for member-scoped tables, on a site session (site-auth.mjs); /auth/login could not require a login.",
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
  assert.equal(Object.keys(PUBLIC).length, 3, "a new unauthenticated endpoint was added — is that intended?");
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
  const i = routes().get("/api/db/*");
  assert.match(blockOf(i), /handleSiteAuth|resolveSiteVisitor|handleSiteData/,
    "the one broad public prefix must still resolve an identity or an access level");
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
  const tool = SRC.slice(i, i + 6000);
  assert.match(tool, /A picture is a 'text' column whose value is a URL/);
  assert.match(tool, /ONLY when the brief says the VISITOR sends a picture/);
  assert.match(tool, /photo, image_url, avatar/);
});
