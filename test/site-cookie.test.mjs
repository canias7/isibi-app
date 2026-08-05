import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { rescopeCookie } from "../site-cookie.mjs";

const IN = "better-auth.session_token=abc123; Domain=ep-x.neon.tech; Path=/; HttpOnly; Secure; SameSite=Lax";

test("the cookie is pinned to ONE site's prefix", () => {
  // THE SECURITY ONE. Every published site is served from the same origin, so a
  // cookie at `Path=/` is sent to every OTHER site on isibi.ai — one barber
  // shop's customer session travelling to a stranger's site, by construction and
  // not by mistake.
  const out = rescopeCookie(IN, "/api/db/cafe/");
  assert.ok(out.includes("Path=/api/db/cafe/"), out);
  assert.equal((out.match(/Path=/gi) || []).length, 1, "two Path attributes: the browser takes the last one");
  assert.ok(!/Path=\/;/.test(out), "the original Path=/ survived");
});

test("Domain is stripped, or the browser drops the cookie entirely", () => {
  // It names the AUTH SERVER'S host. Arriving from isibi.ai a browser refuses a
  // cookie for a domain it is not on — silently — so the session would die at
  // birth and every later call would look signed out.
  const out = rescopeCookie(IN, "/api/db/cafe/");
  assert.ok(!/domain=/i.test(out), out);
});

test("everything the auth server decided about its own credential is kept", () => {
  // HttpOnly, Secure and SameSite are the session owner's choices. A proxy that
  // rewrites them is overruling the thing that issued the credential.
  const out = rescopeCookie(IN, "/api/db/cafe/");
  for (const attr of ["HttpOnly", "Secure", "SameSite=Lax"]) {
    assert.ok(out.includes(attr), `${attr} was dropped: ${out}`);
  }
  assert.ok(out.startsWith("better-auth.session_token=abc123"), out);
});

test("nothing in, nothing out", () => {
  assert.equal(rescopeCookie(null, "/p/"), null);
  assert.equal(rescopeCookie("", "/p/"), null);
  assert.equal(rescopeCookie(undefined, "/p/"), null);
  // A header with no `name=value` is not a cookie; passing it on would put a
  // malformed one in front of a browser for no gain.
  assert.equal(rescopeCookie("HttpOnly; Secure", "/p/"), null);
  assert.equal(rescopeCookie("=novalue", "/p/"), null);
});

test("the proxy forwards the cookie IN and rescopes it OUT", () => {
  // Both halves, or the session only works in one direction. Measured: sign-in
  // sets it, every later call must send it back, and get-session only answers
  // with the Data API's JWT once it recognises a session.
  const w = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  assert.match(w, /"content-type", "authorization", "accept", "prefer", "cookie"/,
    "the request never carries the cookie, so every call looks signed out");
  assert.match(w, /rescopeCookie\(r\.headers\.get\("set-cookie"\), "\/api\/db\/" \+ slug \+ "\/"\)/,
    "the response drops the cookie, so a session can never be established");
});
