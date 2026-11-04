// The visitor's key and the master key (2026-11-04, owner: option A, new sites).
// Server code a visitor calls works AS THAT VISITOR (site.rows/insert/update/
// remove through the site's Data API with their own sign-in, or an anonymous
// one), so the database's own rules decide; site.sql, the full login, opens only
// for a scheduled job or hook, or after site.verify(...) proves a signature in
// the same call. Compiled from the template's own source, as the build does.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const tsLocal = new URL("../builder/lovable/template/node_modules/typescript/lib/typescript.js", import.meta.url);
const ts = fs.existsSync(tsLocal) ? createRequire(import.meta.url)(tsLocal.pathname) : createRequire(import.meta.url)("typescript");
const LIB = new URL("../builder/lovable/template/src/lib/", import.meta.url);
const js = (src) => ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const local = (src) => src.replace(/from "(\.\.?\/[^"]+?)"/g, (m, s) => (s.endsWith(".mjs") ? m : `from "${s}.js"`));

async function load() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gf-visitor-"));
  fs.mkdirSync(path.join(dir, "effects"), { recursive: true });
  for (const f of ["owner-keys", "site-sql", "site-limit"]) fs.writeFileSync(path.join(dir, f + ".js"), local(js(fs.readFileSync(new URL(f + ".ts", LIB), "utf8"))));
  fs.copyFileSync(new URL("effects/site-ssrf.mjs", LIB), path.join(dir, "effects/site-ssrf.mjs"));
  const src = local(js(fs.readFileSync(new URL("site-functions.ts", LIB), "utf8"))).replace(/import\.meta\.glob\([^)]*\)/, "{}");
  fs.writeFileSync(path.join(dir, "site-functions.js"), src);
  return import(pathToFileURL(path.join(dir, "site-functions.js")).href);
}
const ENV = { DATA_API_BASE: "https://data.example/rest/v1", AUTH_BASE: "https://auth.example", APP_CONN: "postgres://u:p@db.example/neondb", GF_KEY_PAYKEY: "whsec_0123456789abcdef" };
function net() {
  const calls = [];
  const fetcher = async (url, init = {}) => {
    calls.push({ url: String(url), method: init.method || "GET", auth: new Headers(init.headers).get("authorization"), body: init.body });
    if (String(url).endsWith("/token/anonymous")) return new Response(JSON.stringify({ token: "eyJanonymous.aaaa.bbbb" }));
    return new Response(JSON.stringify([{ id: 1 }]));
  };
  return { calls, fetcher };
}

test("a visitor's call reads and writes AS THE VISITOR: their own sign-in reaches the database", async () => {
  const { makeSite } = await load();
  const n = net();
  const req = new Request("https://s.example/api/fn", { headers: { authorization: "Bearer eyJvisitor.cccc.dddd" } });
  const site = makeSite(ENV, "s", [], n.fetcher, { visitor: req });
  await site.rows("orders", "select=id");
  await site.insert("bookings", { name: "Tom" });
  await site.update("orders", { id: 3 }, { note: "x" });
  assert.deepEqual(n.calls.map((c) => [c.method, c.url, c.auth]), [
    ["GET", "https://data.example/rest/v1/orders?select=id", "Bearer eyJvisitor.cccc.dddd"],
    ["POST", "https://data.example/rest/v1/bookings", "Bearer eyJvisitor.cccc.dddd"],
    ["PATCH", "https://data.example/rest/v1/orders?id=eq.3", "Bearer eyJvisitor.cccc.dddd"],
  ]);
});

test("a visitor who is not signed in works as the anonymous visitor, never as the owner", async () => {
  const { makeSite } = await load();
  const n = net();
  const site = makeSite(ENV, "s", [], n.fetcher, { visitor: new Request("https://s.example/api/fn") });
  await site.rows("products");
  assert.equal(n.calls.at(-1).auth, "Bearer eyJanonymous.aaaa.bbbb");
  assert.ok(!n.calls.some((c) => (c.auth || "").includes("u:p")), "the full login reached the data API");
});

test("site.sql is shut for a visitor's call, opens after a proved signature, and is open for jobs and hooks", async () => {
  const { makeSite, SQL_CLOSED } = await load();
  const visitorSite = makeSite(ENV, "s", [], net().fetcher, { visitor: new Request("https://s.example/api/fn") });
  await assert.rejects(() => visitorSite.sql("select 1"), (e) => e.message === SQL_CLOSED);
  // A wrong signature keeps it shut.
  assert.equal(await visitorSite.verify("PAYKEY", "{}", "deadbeef"), false);
  await assert.rejects(() => visitorSite.sql("select 1"), (e) => e.message === SQL_CLOSED);
  // A proved signature opens it for the rest of that call (a payment provider's "paid").
  const { createHmac } = await import("node:crypto");
  const good = createHmac("sha256", ENV.GF_KEY_PAYKEY).update('{"paid":42}').digest("hex");
  const hookSite = makeSite(ENV, "s", [], net().fetcher, { visitor: new Request("https://s.example/api/fn") });
  assert.equal(await hookSite.verify("GF_KEY_PAYKEY", '{"paid":42}', good), true, "the observer is alive: the signature proved");
  await assert.rejects(() => hookSite.sql("select 1"), (e) => e.message !== SQL_CLOSED, "a proved signature left the full login shut");
  // A trusted run (a scheduled job or hook) is open: it reaches the database call (which fails here, offline).
  const jobSite = makeSite(ENV, "s", [], net().fetcher, { trusted: true });
  await assert.rejects(() => jobSite.sql("select 1"), (e) => e.message !== SQL_CLOSED);
});

test("table and column names are checked before anything is sent", async () => {
  const { makeSite } = await load();
  const n = net();
  const site = makeSite(ENV, "s", [], n.fetcher, { visitor: new Request("https://s.example/") });
  await assert.rejects(() => site.rows("orders;drop"));
  await assert.rejects(() => site.update("orders", {}, { a: 1 }), /name the rows/);
  await assert.rejects(() => site.remove("orders", { "id or 1=1": 1 }));
  assert.equal(n.calls.length, 0);
});
