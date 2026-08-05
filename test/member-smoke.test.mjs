// The member-tier smoke test must stay free, and must drive the endpoints the
// CLIENT actually calls.
//
// Both are easy to lose silently. A test that drifts from `@/lib/rows` proves
// the auth server works and says nothing about whether a generated site can sign
// anybody in — which is the entire question. And the run is free only because
// two model calls are skipped; nothing about the file makes that obvious a year
// from now.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const smoke = fs.readFileSync(new URL("./integration/member-smoke.mjs", import.meta.url), "utf8");
const rows = fs.readFileSync(new URL("../builder/lovable/template/src/lib/rows.ts", import.meta.url), "utf8");

test("it drives every auth endpoint the client calls, and no invented ones", () => {
  // DERIVED FROM rows.ts, not listed here. Naming them by hand means adding a
  // hook silently adds an untested endpoint — the dead-capability shape this
  // repo has hit six times.
  const cited = new Set();
  for (const m of rows.matchAll(/useAuthAction\("([^"]+)"\)/g)) cited.add(m[1]);
  for (const m of rows.matchAll(/authUrl\("([^"]+)"\)/g)) cited.add(m[1]);
  assert.ok(cited.size >= 4, `only ${cited.size} auth endpoints found in rows.ts — the scan stopped working`);
  for (const action of cited) {
    assert.ok(smoke.includes('"' + action + '"') || smoke.includes("auth(\"" + action + "\""),
      `the client calls "${action}" and the smoke test never does`);
  }
});

test("the token check is the CLIENT'S extractor, not a guess at the shape", () => {
  // CLAUDE.md's own open item: "confirming the bearer token the client stores is
  // the same session.token the resolver looks up — the one seam only a real
  // sign-in proves." Reading the token differently from the client would prove
  // the server works and leave that seam exactly as unproven as before.
  const clientForm = /o\?\.token \?\? o\?\.session\?\.token/.test(rows);
  assert.ok(clientForm, "rows.ts changed how it reads a token — update the smoke test to match");
  assert.match(smoke, /d\.token \?\? \(d\.session && d\.session\.token\)/,
    "the smoke test reads the token its own way, so it is not testing what a page would store");
});

test("it stays FREE, and says so as an assertion rather than a comment", () => {
  // The build route's two model calls are conditional — an explicit schema skips
  // the designer, no brief skips page generation. `cost` is
  // `(designed ? SITE_BUILD_FEE : 0) + pages.cost`, so zero is the proof that
  // neither fired. A comment claiming the run is free is worth nothing; a failed
  // check when it stops being free is worth the whole test.
  assert.match(smoke, /ok\("NO model credits were spent", d\.cost === 0/,
    "nothing stops this test from quietly starting to spend money");
  assert.ok(!/brief:/.test(smoke), "a brief was added, which turns page generation back on");
  assert.match(smoke, /schema: SCHEMA/, "the schema is no longer sent, so the designer runs");
});

test("every access level is exercised, or the gap just moves", () => {
  // The reason this test exists is that three levels had no coverage. Declaring
  // a table per level and then only reading two of them recreates the gap with a
  // green tick over it.
  for (const level of ["display", "collect", "user", "feed", "admin"]) {
    assert.ok(smoke.includes('access: "' + level + '"'), `no table declares access "${level}"`);
  }
  // A second member is the whole point of an own-rows check: every naive
  // implementation looks correct with one account in the database.
  assert.match(smoke, /does NOT see another member's private rows/);
  assert.match(smoke, /a feed row IS visible to every signed-in member/,
    "without the opposite level, 'own rows' passing proves only that reads are scoped somewhere");
});

test("it cleans up the billed resources it created", () => {
  // A Neon project is capped and billed and its only record is a Supabase row
  // that cascades with the user, so an abandoned one is invisible forever.
  const fin = smoke.indexOf("} finally {");
  assert.ok(fin > 0, "a thrown assertion would leak the project and the user");
  const cleanup = smoke.slice(fin);
  assert.match(cleanup, /method: "DELETE", headers: \{ Authorization: `Bearer \$\{jwt\}` \}/);
  assert.match(cleanup, /admin\/users\/\$\{userId\}/);
  // REACHED, not merely present. `} finally { if (false)` left both calls in the
  // file and disabled them, and a check for their text passed — the mutant that
  // survived the first version of this test. Nothing may gate the block before
  // the first thing it has to do.
  const head = cleanup.slice(0, cleanup.indexOf("if (slug && jwt)"));
  assert.ok(!/\bif\s*\(/.test(head),
    "something gates the cleanup block, so a failing run can leak a billed Neon project");
});

test("the proxy SETS Origin rather than forwarding what a caller sent", () => {
  // MEASURED LIVE 2026-08-04, first run of member smoke: every signup answered
  // `400 MISSING_ORIGIN`. The proxy's header allow-list is about COOKIES — it
  // exists so isibi.ai's cookies never reach a third party — and it dropped
  // `Origin`, which is not a cookie. No generated site could sign anybody up.
  //
  // SET, not forwarded: this endpoint is public, so forwarding trusts an
  // attacker-chosen value into Better Auth's trusted-origins check. The request
  // really does originate from this Worker.
  const w = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  assert.match(w, /headers\.set\("origin", url\.origin\)/,
    "the auth proxy does not set Origin, so signup answers MISSING_ORIGIN");
  assert.ok(!/for \(const h of \[[^\]]*"origin"/.test(w),
    "Origin is being FORWARDED from the caller — on a public endpoint that is attacker-chosen");
});

test("sign-out sends a body, or the auth server refuses it as 415", () => {
  // The client posted with neither a content-type nor a body, and the failure is
  // swallowed by design (the local token is cleared either way) — so the page
  // believed it had signed out while the session stayed live for anyone holding
  // the token.
  const rowsSrc = fs.readFileSync(new URL("../builder/lovable/template/src/lib/rows.ts", import.meta.url), "utf8");
  const at = rowsSrc.indexOf('authUrl("sign-out")');
  assert.ok(at > 0, "sign-out is no longer called");
  const call = rowsSrc.slice(at, at + 260);
  assert.match(call, /"content-type": "application\/json"/, "no content-type: the server answers 415");
  assert.match(call, /body: "\{\}"/, "no body: the server answers 415");
});

test("the proxy passes back BOTH auth headers, or member accounts cannot work", () => {
  // Neither token is in a response body, and the proxy returned only
  // content-type and content-range — so a page could sign somebody in and then
  // had no way to act as them. Confirmed against both vendors' docs after being
  // measured live:
  //   set-auth-token — Better Auth's bearer plugin; what get-session accepts
  //   set-auth-jwt   — Neon's Data API; what every member read and write needs
  const w = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  for (const h of ["set-auth-token", "set-auth-jwt"]) {
    assert.match(w, new RegExp('r\\.headers\\.get\\("' + h + '"\\)'),
      `the proxy strips ${h}, so the client can never obtain it`);
  }
});

test("the client keeps the two tokens APART and sends the right one to each", () => {
  // One value for the auth server, a different one for the Data API. Using
  // either in the other's place is a silent failure: a null session, or
  // `400 not a valid JWT encoding`.
  const rowsSrc = fs.readFileSync(new URL("../builder/lovable/template/src/lib/rows.ts", import.meta.url), "utf8");
  assert.match(rowsSrc, /const JWT_KEY = \(\) => `site_jwt_\$\{siteSlug\(\)\}`/, "there is only one token store");
  assert.match(rowsSrc, /set-auth-token/, "the bearer token is still read from the body");
  assert.match(rowsSrc, /set-auth-jwt/, "the JWT is never captured");

  // `send` is the DATA path and must use the JWT.
  const at = rowsSrc.indexOf("async function send<T>");
  assert.ok(at > 0, "send() was renamed");
  assert.match(rowsSrc.slice(at, at + 500), /const token = getJwt\(\)/,
    "data calls carry the auth token, which the Data API refuses as not-a-JWT");

  // Signing out has to drop BOTH, or the next visitor on a shared machine
  // inherits a live JWT.
  // Sliced to the function's real END, not a guessed number of characters — a
  // 900-char window fell short of the line it was looking for and reported a
  // bug that was not there.
  const out = rowsSrc.indexOf("export function useLogout");
  const outEnd = rowsSrc.indexOf("\nexport ", out + 10);
  assert.ok(out > 0 && outEnd > out, "useLogout was renamed");
  assert.match(rowsSrc.slice(out, outEnd), /setJwt\(null\)/, "sign-out leaves the JWT behind");
});

test("the smoke test reads the tokens from the headers, not from a body", () => {
  const smokeSrc = fs.readFileSync(new URL("./integration/member-smoke.mjs", import.meta.url), "utf8");
  assert.match(smokeSrc, /su\.headers\.get\("set-auth-token"\)/);
  assert.match(smokeSrc, /sess\.headers\.get\("set-auth-jwt"\)/);
  // A JWT is three dot-separated segments and a bearer token is not — which is
  // the entire reason the two are kept apart.
  assert.match(smokeSrc, /dataTok\.split\("\."\)\.length === 3 && dataTok !== sessTok/,
    "nothing checks the JWT is actually a JWT, which is how this bug looked fine");
});
