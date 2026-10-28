// Finishing a password reset, and verifying an address (2026-09-03).
//
// The kit had `useRequestReset` and nothing after it: the emailed link landed
// nowhere a generated site could finish, and a member could never verify.
// What has to stay true is the CONTRACT with the auth server — the endpoint
// names and body fields Better Auth documents — because a hook posting to a
// path the server does not have fails on every generated site at once, and
// nothing here can drive the real server for free.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import { PAGE_RULES } from "../builder/page-gen.mjs";

const rows = fs.readFileSync(new URL("../builder/lovable/template/src/lib/rows.ts", import.meta.url), "utf8");
const worker = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");

function body(name, endMarker) {
  const a = rows.indexOf(`export function ${name}(`);
  assert.ok(a > 0, `${name} is not exported`);
  const b = rows.indexOf(endMarker, a);
  assert.ok(b > a, `no closing landmark after ${name}`);
  return rows.slice(a, b);
}

test("the four names the page rules teach are exported, and the rules teach them", () => {
  for (const n of ["resetToken", "useResetPassword", "useSendVerification", "useVerifyEmail", "useRequestReset"]) {
    assert.match(rows, new RegExp(`export function ${n}\\(`), n);
    assert.ok(PAGE_RULES.includes(n), `the rules never mention ${n} — a hook nobody is told about is a hook nobody calls`);
  }
  assert.match(PAGE_RULES, /BACK TO THE PAGE THAT ASKED/, "the rules do not say where the reset link lands");
  assert.match(PAGE_RULES, /never a gate on the whole site/, "verification must not lock a site");
});

test("the reset request says where the link comes back to — this page, without its query", () => {
  const src = body("useRequestReset", "export function resetToken");
  assert.match(src, /window\.location\.origin \+ window\.location\.pathname/, "the redirect carries a stale ?token= or nothing at all");
  assert.match(src, /redirectTo/);
  assert.match(src, /authUrl\("forget-password"\)/);
  assert.match(src, /typeof window === "undefined" \? undefined/, "a server render would throw on window");
});

test("the token is read off the URL, and only a token-shaped one", () => {
  const src = body("resetToken", "export function useResetPassword");
  assert.match(src, /new URLSearchParams\(window\.location\.search\)\.get\("token"\)/);
  assert.match(src, /\^\[A-Za-z0-9\._~-\]\{8,\}\$/);
  assert.match(src, /typeof window === "undefined"\) return ""/);
});

test("finishing a reset posts { newPassword, token } to reset-password", () => {
  // Better Auth: POST /reset-password { newPassword, token }. The token is the
  // URL's unless one is passed; no token is refused before the wire.
  const src = body("useResetPassword", "export function useSendVerification");
  assert.match(src, /authUrl\("reset-password"\)/);
  assert.match(src, /JSON\.stringify\(\{ newPassword: values\.newPassword, token \}\)/);
  assert.match(src, /const token = values\.token \|\| resetToken\(\);/);
  assert.match(src, /if \(!token\) throw new Error/);
});

test("verification is a CODE — the email-OTP plugin's two endpoints, with the documented fields", () => {
  // Neon's shared mail provider sends codes for verification, not links, so
  // these are the plugin's paths: send-verification-otp {email, type} and
  // verify-email {email, otp}. A slash in the path has to be admitted by the
  // proxy's matcher, which is asserted below rather than assumed.
  const send = body("useSendVerification", "export function useVerifyEmail");
  assert.match(send, /authUrl\("email-otp\/send-verification-otp"\)/);
  assert.match(send, /type: "email-verification"/);
  assert.match(send, /r\.status === 404\) throw new Error\("email codes are not switched on for this site"\)/,
    "a deployment without the plugin must say so, not 'that did not work'");
  const verify = body("useVerifyEmail", "// ── Attaching a picture");
  assert.match(verify, /authUrl\("email-otp\/verify-email"\)/);
  assert.match(verify, /JSON\.stringify\(\{ email: values\.email, otp: values\.otp \}\)/);
  assert.match(verify, /qc\.invalidateQueries\(\)/, "member.verified never refreshes after a successful code");
  assert.match(verify, /keepAuthHeaders\(r\)/);
});

test("the auth proxy admits the plugin's slashed paths, and nothing wider", async () => {
  // (2026-10-28: the site's own Worker) The platform's one visitor matcher hands
  // `/api/db/<slug>/auth/…` to the site, and the site's own `ownAuth` forwards
  // it to its auth server. Both are held to the plugin's slashed paths.
  const line = worker.split("\n").find((l) => l.includes("const vm = url.pathname.match(") && l.includes("auth"));
  assert.ok(line, "the visitor matcher moved");
  const lit = line.match(/match\((\/.*\/i)\);/);
  assert.ok(lit, "the matcher is no longer a literal");
  const re = new RegExp(lit[1].slice(1, -2), "i");
  const PATHS = ["reset-password", "email-otp/send-verification-otp", "email-otp/verify-email", "forget-password", "get-session"];
  for (const p of PATHS) {
    const m = `/api/db/cafe-1/auth/${p}`.match(re);
    assert.ok(m && m[1] === "cafe-1", p);
  }
  assert.equal("/api/db/cafe-1/auth/../data/x".match(re), null, "a path that climbs is refused");

  // The site's own handler, cut out by landmark (server.ts imports Start, which
  // is not installed here) and run for real.
  const src = fs.readFileSync(new URL("../builder/lovable/template/src/server.ts", import.meta.url), "utf8");
  const a = src.indexOf("export async function ownAuth("), b = src.indexOf("\n}\n", a) + 3;
  assert.ok(a > 0 && b > a, "ownAuth moved");
  const cookie = fs.readFileSync(new URL("../site-cookie.mjs", import.meta.url), "utf8");
  // The site's own limiter (lib/site-limit.ts), real, beside it.
  const lim = fs.readFileSync(new URL("../builder/lovable/template/src/lib/site-limit.ts", import.meta.url), "utf8").replace(/^export /gm, "");
  const js = ts.transpileModule(cookie + "\n" + lim + "\nconst SITE_SLUG = 'cafe-1';\n" + src.slice(a, b),
    { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  const { ownAuth } = await import("data:text/javascript," + encodeURIComponent(js));
  const seen = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (u) => { seen.push(String(u)); return new Response("{}", { status: 200 }); };
  try {
    const env = { AUTH_BASE: "https://ep-1.auth.neon.tech/auth", SITE_TABLES: "[]" };
    for (const p of PATHS) {
      const url = new URL(`https://cafe-1.gofarther.app/api/db/cafe-1/auth/${p}`);
      const r = await ownAuth(new Request(url, { method: "POST", body: "{}" }), env, url);
      assert.equal(r && r.status, 200, p);
      assert.equal(seen.at(-1), env.AUTH_BASE + "/" + p, p);
    }
    // A URL normalises `..` away, so the climb is handed over as a raw path.
    const climb = { pathname: "/api/db/cafe-1/auth/../data/x", search: "" };
    assert.equal(await ownAuth(new Request("https://cafe-1.gofarther.app/x", { method: "POST", body: "{}" }), env, climb), null, "a path that climbs is refused");
    assert.equal(seen.length, PATHS.length, "the climb reached the auth server");
  } finally { globalThis.fetch = real; }
});

test("every endpoint the kit cites is one the free smoke drives", () => {
  // The same derivation test/member-smoke.test.mjs makes, repeated here so a
  // failure names the flow this file is about rather than the smoke in general.
  const smoke = fs.readFileSync(new URL("./integration/member-smoke.mjs", import.meta.url), "utf8");
  for (const ep of ["reset-password", "email-otp/send-verification-otp", "email-otp/verify-email"]) {
    assert.ok(smoke.includes(`auth("${ep}"`), `the smoke never drives ${ep}`);
  }
  assert.match(smoke, /a reset with a made-up token is refused/);
  assert.match(smoke, /a wrong verification code is refused/);
});
