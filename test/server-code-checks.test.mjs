// THE SERVER WRITER'S CHECKS (2026-10-28): a sandboxed test run, the wiring
// between pages and server code, the keys it needs, never a stand-in, the live
// error log — all said to the owner as FACTS the reply writer words, never as
// fixed sentences of ours.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dryRunServerParts, hooksIn } from "../builder/server-dryrun.mjs";
import { serverEvidence, serverFacts, keysAsked, calledFunctions, checkServerPart } from "../builder/server-code.mjs";
import { checksOf, readChecks, checkFacts } from "../builder/check-evidence.mjs";
import { loadTemplate } from "./fixtures/template-ts.mjs";

const tsPath = new URL("../builder/lovable/template/node_modules/typescript/lib/typescript.js", import.meta.url);
const ts = existsSync(tsPath) ? createRequire(import.meta.url)(tsPath.pathname) : createRequire(import.meta.url)("typescript");

const CHAT = { name: "server-chat", source: `export const hosts = ["api.openai.com"];
export default async function (request: Request, site: any) {
  const { messages } = await request.json();
  const r = await site.fetch("https://api.openai.com/v1/chat/completions", { method: "POST", headers: { authorization: "Bearer " + site.key("OPENAI_KEY") }, body: JSON.stringify({ messages }) });
  const j = await r.json();
  return Response.json({ reply: j.choices?.[0]?.message?.content || "" });
}` };

test("SC1 the test run passes good code, catches a code fault and an unlisted host, and calls nothing real", async () => {
  const parts = [
    CHAT,
    { name: "server-oops", source: `export const hosts = [];\nexport default async function () { return Response.json({ n: notDefined + 1 }); }` },
    { name: "server-text", source: `export const hosts = [];\nexport const on = ["created:bookings"];\nexport default async function (request: Request, site: any) { await site.fetch("https://api.twilio.com/x"); return new Response("ok"); }` },
    { name: "band-a", source: "export default function A(){ return null }" },
  ];
  const r = await dryRunServerParts(parts, { ts });
  assert.equal(r.ran, true);
  const by = Object.fromEntries(r.results.map((x) => [x.name, x]));
  assert.equal(Object.keys(by).length, 3, "only server parts are run");
  assert.equal(by.chat.ok, true);
  assert.deepEqual(by.chat.keys, ["OPENAI_KEY"]);
  assert.deepEqual(by.chat.calls, [{ host: "api.openai.com", method: "POST" }]);
  assert.equal(by.oops.ok, false); assert.equal(by.oops.kind, "code"); assert.match(by.oops.error, /notDefined/);
  assert.equal(by.text.ok, false); assert.match(by.text.error, /did not declare api\.twilio\.com/);
});

test("SC2 the sandbox: no environment, no files, nothing launched", async () => {
  const probe = { name: "server-probe", source: `export const hosts = [];
export default async function () {
  const out: any = {};
  try { out.env = Object.keys((globalThis as any).process.env).length; } catch { out.env = "blocked"; }
  try { (globalThis as any).process.binding("fs"); out.fs = "open"; } catch { out.fs = "blocked"; }
  try { await import("node:fs").then((fs: any) => fs.readFileSync("/etc/passwd")); out.read = "open"; } catch { out.read = "blocked"; }
  try { await import("node:child_process").then((cp: any) => cp.execSync("true")); out.exec = "open"; } catch { out.exec = "blocked"; }
  throw new Error(JSON.stringify(out));
}` };
  const r = await dryRunServerParts([probe], { ts });
  const seen = JSON.parse(r.results[0].error);
  assert.equal(seen.env, 0, "no environment");
  assert.equal(seen.read, "blocked", "no files");
  assert.equal(seen.exec, "blocked", "nothing launched");
  assert.equal(checkServerPart(probe).ok, false, "and the check refuses such code before it is ever run");
});

test("SC3 evidence: functions, hooks, callers, keys, test results, missing and refused", () => {
  const pages = [{ path: "index.tsx", source: "fetch(`/api/db/${SITE_SLUG}/fn/chat`); fetch(`/api/db/${SITE_SLUG}/fn/ghost`)" }];
  const parts = [CHAT, { name: "server-text", source: `export const hosts = ["api.twilio.com"];\nexport const on = ["created:bookings"];\nexport default async function (r: Request, site: any) { site.key("TWILIO_KEY"); return new Response("") }` }];
  const e = serverEvidence({ pages, parts, tests: { ran: true, results: [{ name: "chat", ok: true }, { name: "text", ok: false, kind: "code", error: "x is not defined" }] }, keysSet: ["OPENAI_KEY"], refused: [{ part: { name: "server-bad" }, reasons: ["reads env"] }] });
  assert.deepEqual(e.functions.map((f) => [f.name, f.called, f.test, f.hooks.join()]), [["chat", true, "passed", ""], ["text", false, "failed", "created:bookings"]]);
  assert.deepEqual(e.missing, ["ghost"]);
  assert.deepEqual(e.keys, [{ name: "OPENAI_KEY", set: true }, { name: "TWILIO_KEY", set: false }]);
  assert.deepEqual(e.refused, [{ name: "bad", reasons: ["reads env"] }]);
  assert.equal(serverEvidence({ pages, parts: [] }), null, "no server code, nothing to say");
  assert.deepEqual(keysAsked(`site.key("A_KEY"); site.hasKey('B')`), ["A_KEY", "B"]);
  assert.deepEqual([...calledFunctions([{ source: "x/fn/a-b y/fn/c" }])], ["a-b", "c"]);
  assert.deepEqual(hooksIn(`export const on = ["cron:0 9,17 * * *", "tick"]`), ["cron:0 9,17 * * *", "tick"]);
});

test("SC4 the facts reach the reply writer through the checks, as facts, and are strict", () => {
  const e = serverEvidence({ pages: [], parts: [CHAT], tests: { ran: true, results: [{ name: "chat", ok: false, kind: "code", error: "boom" }] } });
  const c = checksOf({ published: true, server: e });
  assert.ok(readChecks(c));
  const texts = checkFacts(c).map((f) => f.text);
  assert.ok(texts.some((t) => /server code named "chat"/.test(t)));
  assert.ok(texts.some((t) => /test-run .* failed: boom/.test(t)));
  assert.ok(texts.some((t) => /OPENAI_KEY/.test(t) && /Keys settings/.test(t)));
  assert.ok(texts.some((t) => /No page or component calls it/.test(t)));
  assert.equal(readChecks({ ...c, server: { functions: "x" } }), null, "malformed evidence is unreadable");
  assert.equal(serverFacts(null).length, 0);
});

test("SC5 publishPages: a test-run fault goes back once, server code is never stubbed, refusals are facts not fixed lines", () => {
  const pub = readFileSync(new URL("../builder/publish-pages.mjs", import.meta.url), "utf8");
  const a = pub.indexOf("const serverRepairedNow = [];");
  const b = pub.indexOf("if (salvageable(built))", a);
  assert.ok(a > 0 && b > a);
  const block = pub.slice(a, b);
  assert.match(block, /r\.kind === "code"/);
  assert.match(block, /if \(second && second\.ok\) \{\n\s*built = second;\n\s*v\.parts = sitePartsForBuild;\n\s*for \(const u of pendingUsage\) repairUsage\.push\(u\);/);
  assert.match(block, /\} else sitePartsForBuild = before;/);
  assert.match(pub, /badParts\.has\(p\.name\) && !String\(p\.name\)\.startsWith\(SERVER_PREFIX\) \? \{ \.\.\.p, source: partStandIn/);
  assert.match(pub, /sitePartsForBuild = sitePartsForBuild\.filter\(\(p\) => !serverBad\.includes\(p\.name\)\)/);
  assert.match(pub, /out\.server = serverEvidence\(\{ pages, parts: sitePartsForBuild, tests: built && built\.serverTests/);
  assert.doesNotMatch(pub, /v\.problems\.concat\(vetted\.problems/, "no fixed refusal lines");
});

test("SC6 the container runs the test after a good build; the Worker carries the evidence on every publish", () => {
  const bs = readFileSync(new URL("../builder/build-server.mjs", import.meta.url), "utf8");
  assert.match(bs, /serverTests = await dryRunServerParts\(sp, tsc \? \{ ts: tsc \} : \{\}\)/);
  assert.match(bs, /\.\.\.\(serverTests \? \{ serverTests \} : \{\}\)/);
  const w = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  assert.equal((w.match(/typeErrors: pages\.typeErrors, server: pages\.server/g) || []).length, 2);
  assert.match(w, /server: serverEvidence\(\{ pages: Array\.isArray\(pages\) \? pages : \[\], parts: Array\.isArray\(siteParts\) \? siteParts : \[\], tests: built\.serverTests/);
  const df = readFileSync(new URL("../Dockerfile", import.meta.url), "utf8");
  assert.match(df, /builder\/server-dryrun\.mjs builder\/server-dryrun-child\.mjs/);
});

test("SC7 a live failure is written to the site's own error log, without the key", async () => {
  const fns = readFileSync(new URL("../builder/lovable/template/src/lib/site-functions.ts", import.meta.url), "utf8");
  assert.match(fns, /await logFnError\(env, m\[2\], "answering a visitor", msg\)/);
  assert.match(fns, /logFnError\(env, nameOf\(m, mods\), "on " \+ event/);
  assert.match(fns, /logFnError\(env, nameOf\(m, mods\), "on its schedule"/);
  const { logFnError } = await loadTemplate("lib/site-functions.ts");
  await logFnError({}, "x", "y", "z"); // no database: nothing, no throw
});

test("SC8 the check refuses reaching the language's internals", () => {
  for (const s of ["({}).constructor.constructor('x')", "Reflect.get(site,'fetch')", "new Proxy({}, {})", "({}).__proto__"]) {
    assert.equal(checkServerPart({ name: "server-x", source: `export const hosts = [];\nexport default async function () { ${s}; return new Response("") }` }).ok, false, s);
  }
});
