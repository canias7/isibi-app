// THE QUICK SECURITY CHECK (2026-10-21, phase A of the security scan).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { quickChecks, accessPair } from "../site-security.mjs";

const ids = (r) => r.findings.map((f) => f.id);

test("a list of people's details that anyone can read is serious; a public menu is not", () => {
  const r = quickChecks({ tables: [
    { name: "bookings", access: "display", columns: ["name", "email", "phone"] },
    { name: "loaves", access: "display", columns: ["title", "price", "notes"] },
    { name: "enquiries", access: "collect", columns: ["email", "message"] },
  ], spamProtected: true, files: [] });
  assert.deepEqual(ids(r), ["open-private:bookings"]);
  assert.equal(r.findings[0].severity, "high");
  assert.match(r.findings[0].why, /email, phone/);
});

test("a public list anyone can write into, and forms without bot protection, are found; protected forms pass", () => {
  const t = [{ name: "guestbook", access: "read public / write anyone", columns: ["message"] }];
  assert.deepEqual(ids(quickChecks({ tables: t, spamProtected: false })), ["open-write:guestbook", "no-spam-protection"]);
  const ok = quickChecks({ tables: [{ name: "enquiries", access: "collect", columns: ["message"] }], spamProtected: true });
  assert.deepEqual(ids(ok), []);
  assert.ok(ok.passed.some((p) => /protected from bots/.test(p)));
  assert.deepEqual(ids(quickChecks({ tables: [{ name: "enquiries", access: "collect", columns: [] }], spamProtected: null })), [], "cannot-tell is not a finding");
});

test("secret keys in the published code are found by kind, once each; a publishable key is not", () => {
  const files = [
    { path: "assets/index.js", text: "const k='sk_live_" + "a".repeat(24) + "'; const p='pk_live_" + "b".repeat(24) + "';" },
    { path: "assets/other.js", text: "fetch(x,{headers:{a:'sk_live_" + "c".repeat(24) + "'}}); const db='postgres://u:secret@host/db';" },
  ];
  const r = quickChecks({ files });
  assert.deepEqual(ids(r), ["secret-in-code:a live Stripe secret key", "secret-in-code:a database connection with its password"]);
  assert.equal(r.findings[0].where, "assets/index.js");
  assert.ok(quickChecks({ files: [{ path: "a.js", text: "pk_live_" + "x".repeat(30) }] }).passed.some((p) => /No secret keys/.test(p)));
});

test("the most serious come first, and an unreadable access label is never read as open", () => {
  const r = quickChecks({ tables: [
    { name: "guestbook", access: "read public / write anyone", columns: ["email"] },
  ], spamProtected: false });
  assert.deepEqual(r.findings.map((f) => f.severity), ["high", "medium", "low"]);
  assert.equal(accessPair("read sideways / write anyone"), null);
  assert.deepEqual(accessPair("collect"), { read: "none", write: "anyone" });
});

test("the route runs the checks for the owner only, keeps the report on the server, and the delete removes it", () => {
  const w = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const a = w.indexOf("} else if (sc) {");
  const body = w.slice(a, w.indexOf("} else if (sq) {", a));
  assert.ok(a > 0 && body.length > 500, "the security route is gone");
  assert.match(body, /await assertOwner\(ownerDeps, scslug, ou\.id\)/, "it runs for anyone");
  assert.match(body, /quickChecks\(\{ tables, spamProtected, files \}\)/);
  assert.match(body, /"security\/" \+ scslug \+ "\/latest\.json"/);
  assert.match(w, /"security\/" \+ dslug \+ "\/",/, "a deleted site keeps its security report");
  const c = readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");
  assert.match(c, /if \(siteView === 'more' && siteMoreTab === 'security' && site\.slug\) loadSiteSecurity\(site\);/, "the panel is never filled");
  assert.ok(!/id="secScan" disabled>Run scan/.test(c), "the switched-off card is back");
});
