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
};

// Every place the router dispatches on an /api path.
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

// Deliberately a fixed window rather than "until the next route": several routes
// share a dispatch line (`=== "/api/video" ? ... : === "/api/image"`), and a
// next-match boundary collapses to zero lines there and reports a gated route as
// open. That false alarm cost a wrong answer once already.
const WINDOW = 45;
const gatesWithin = (i) => /authUser\(|UNAUTHED\(|bearerUser\(/.test(LINES.slice(i, i + WINDOW).join("\n"));

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
  assert.equal(Object.keys(PUBLIC).length, 2, "a new unauthenticated endpoint was added — is that intended?");
});

test("the unauthenticated webhook verifies a signature instead", () => {
  const i = routes().get("/api/stripe/webhook");
  const block = LINES.slice(i, i + WINDOW).join("\n");
  assert.match(block, /verifyStripeSignature/, "the one route with no session auth must authenticate some other way");
  assert.match(block, /STRIPE_WEBHOOK_SECRET/);
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
