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

test("DEEP: only when asked, on the picker's model, every token charged once under the scan's ref, source read never run", () => {
  const w = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const a = w.indexOf("} else if (sc) {");
  const body = w.slice(a, w.indexOf("} else if (sq) {", a));
  assert.match(body, /if \(scbody && scbody\.deep === true\) \{/, "the deep scan runs without being asked");
  assert.match(body, /const model = modelsFor\(scbody\.picker\)\.pages;/, "not the picker's model");
  assert.match(body, /await deepScan\(\{ send: quickSend\(env, "security"\) \}/);
  assert.match(body, /cost = pageCredits\(\.\.\.priced\);/, "the calls are not priced");
  assert.match(body, /debitCredits\(request\.headers\.get\("Authorization"\) \|\| "", cost, scref, "security", true\)/, "the scan is not charged, or not once");
  assert.match(body, /readSiteSource\(env, scslug\)/, "the deep scan does not read the site's source");
});

test("FIX IT and THE CHAT: a finding's button sends it to the builder as a message; the router's security answer starts the deep scan", async () => {
  const c = readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");
  assert.match(c, /data-secfix="/, "no Fix it button");
  assert.match(c, /const t = 'Fix this security problem on my site: ' \+ b\.getAttribute\('data-secfix'\);/);
  assert.match(c, /if \(typeof siteSend === 'function'\) siteSend\(t\);/, "Fix it does not go to the builder");
  assert.match(c, /if \(d\.intent === 'security'\) return !!slug;/, "the page refuses the router's security answer");
  assert.match(c, /if \(d\.intent === 'security' && site\.slug\) \{\n      siteSecurityDeep\(site\)/, "a security answer does not start the scan");
  assert.match(c, /body: JSON\.stringify\(\{ deep: true, picker: buildPicker, key \}\)/, "the scan is not sent the picker");
  const ask = await import("../builder/site-ask.mjs");
  assert.ok(ask.LIVE_ASK_TOOL.input_schema.properties.intent.enum.includes("security"), "the router is not offered security");
  assert.ok(!ask.ASK_TOOL.input_schema.properties.intent.enum.includes("security"), "a first build is offered a scan of a site that does not exist");
  const said = (input, o) => ask.readRouting({ content: [{ type: "tool_use", input }] }, o);
  assert.deepEqual(said({ intent: "security" }, { hasSite: true, live: true }), { intent: "security", answer: "" });
  assert.notEqual(said({ intent: "security" }, { hasSite: false }).intent, "security", "a scan with no site");
});
