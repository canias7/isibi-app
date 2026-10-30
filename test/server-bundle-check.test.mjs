// THE SITE'S SERVER CODE, ASKED THROUGH THE BUILT SITE (2026-10-30): after a
// good build each `server-<name>` part is asked once through the bundle the
// site will run, in a sandboxed child with every call, key and row faked
// (`builder/server-bundle-check.mjs`, `server-bundle-child.mjs`), and the
// answers are folded into the dry run's results.
//
// THE BUNDLE HERE IS MADE FROM THE TEMPLATE'S OWN RUNTIME: `site-functions.ts`,
// `site-row-hooks.ts` and what they import, transpiled, with the one thing vite
// does to them done by hand — `import.meta.glob` of the server parts replaced
// by the parts' modules — and an entry wiring the two routes as `server.ts`
// does. The real `vite build` of it is `test/integration/site-build.mjs`'s
// `server-request` section.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { bundleCheckServerParts, mergeBundleResults } from "../builder/server-bundle-check.mjs";

const tsLocal = new URL("../builder/lovable/template/node_modules/typescript/lib/typescript.js", import.meta.url);
const ts = fs.existsSync(tsLocal) ? createRequire(import.meta.url)(tsLocal.pathname) : createRequire(import.meta.url)("typescript");
const LIB = new URL("../builder/lovable/template/src/lib/", import.meta.url);
const js = (src) => ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const local = (src) => src.replace(/from "(\.\.?\/[^"]+?)"/g, (m, s) => (s.endsWith(".mjs") ? m : `from "${s}.js"`));

/** A server bundle from the template's runtime and these parts; the path of its entry. */
function makeBundle(slug, parts) {
  // World-readable, like the container's dist: from root the child runs as an
  // unprivileged user.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gf-bundle-"));
  fs.chmodSync(dir, 0o755);
  fs.mkdirSync(path.join(dir, "lib/effects"), { recursive: true });
  fs.mkdirSync(path.join(dir, "parts"));
  for (const f of ["owner-keys", "site-sql", "site-limit", "site-row-hooks"]) fs.writeFileSync(path.join(dir, "lib", f + ".js"), local(js(fs.readFileSync(new URL(f + ".ts", LIB), "utf8"))));
  fs.copyFileSync(new URL("effects/site-ssrf.mjs", LIB), path.join(dir, "lib/effects/site-ssrf.mjs"));
  const imports = parts.map((p, i) => `import * as p${i} from "../parts/${p.name}.js";`).join("\n");
  const glob = "{ " + parts.map((p, i) => `"/src/routes/-parts/${p.name}.tsx": p${i}`).join(", ") + " }";
  const fnSrc = local(js(fs.readFileSync(new URL("site-functions.ts", LIB), "utf8")));
  const globCall = /import\.meta\.glob\("\/src\/routes\/-parts\/server-\*\.tsx", \{ eager: true \}\)/;
  assert.match(fnSrc, globCall, "the glob vite replaces is where it was");
  fs.writeFileSync(path.join(dir, "lib/site-functions.js"), imports + "\n" + fnSrc.replace(globCall, () => glob));
  for (const p of parts) fs.writeFileSync(path.join(dir, "parts", p.name + ".js"), js(p.source));
  fs.writeFileSync(path.join(dir, "server.js"), `import { siteFunction } from "./lib/site-functions.js";
import { siteTick, TICK_HEADER } from "./lib/site-row-hooks.js";
const SLUG = ${JSON.stringify(slug)};
export default { async fetch(request, env) {
  const url = new URL(request.url);
  return (await siteFunction(request, env, url, SLUG)) || (await siteTick(request, env, url, SLUG, TICK_HEADER)) || new Response("Not found", { status: 404 });
} };
`);
  for (const f of fs.readdirSync(dir, { recursive: true })) fs.chmodSync(path.join(dir, f), 0o755);
  return { entry: path.join(dir, "server.js"), done: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

const PARTS = [
  { name: "server-hello", source: `export const hosts = ["api.example.com"];
export default async function (request: Request, site: SiteHelper): Promise<Response> {
  const { message } = await request.json();
  const r = await site.fetch("https://api.example.com/x", { headers: { authorization: "Bearer " + site.key("EXAMPLE_KEY") } });
  const rows = await site.sql("select 1");
  await site.files.put("last.txt", String(message));
  return Response.json({ ok: r.ok, rows: rows.length, key: site.hasKey("EXAMPLE_KEY") });
}` },
  { name: "server-big", source: `export const hosts = [];
export default async function (): Promise<Response> {
  return new Response(new Uint8Array(2_000_000), { headers: { "content-type": "application/octet-stream" } });
}` },
  { name: "server-paid", source: `export const hosts = [];
export default async function (request: Request, site: SiteHelper): Promise<Response> {
  const raw = await request.text();
  if (!(await site.verify("STRIPE_WEBHOOK_SECRET", raw, request.headers.get("stripe-signature") || ""))) return new Response("not signed", { status: 400 });
  return Response.json({ ok: true });
}` },
  { name: "server-oops", source: `export const hosts = [];
export default async function (): Promise<Response> {
  return Response.json({ n: (notDefined as any) + 1 });
}` },
  { name: "server-shaky", source: `export const hosts = [];
export default async function (request: Request): Promise<Response> {
  const { amount } = await request.json();
  if (!amount) throw new Error("no amount was sent");
  return Response.json({ amount });
}` },
  { name: "server-nightly", source: `export const hosts = [];
export const on = ["tick"];
export default async function (): Promise<Response> {
  const rows: any = null;
  return Response.json({ n: rows.length });
}` },
  { name: "server-sweep", source: `export const hosts = [];
export const on = ["tick"];
export default async function (request: Request, site: SiteHelper): Promise<Response> {
  await site.sql("delete from holds where at < now() - interval '1 hour'");
  return new Response("ok");
}` },
  { name: "server-leak", source: `export const hosts = ["api.example.com"];
export default async function (request: Request, site: SiteHelper): Promise<Response> {
  await site.fetch("https://api.example.com/x");
  await site.fetch("https://other.example/y");
  return new Response("ok");
}` },
];

test("SB1 each part is asked through the built site: its route, its helper, its limits; hooks by their own event", async () => {
  const b = makeBundle("kiln", PARTS);
  try {
    const r = await bundleCheckServerParts(b.entry, "Kiln", PARTS.concat({ name: "band-a", source: "export default function A(){ return null }" }));
    assert.equal(r.ran, true, r.why);
    const by = Object.fromEntries(r.results.map((x) => [x.name, x]));
    assert.deepEqual(Object.keys(by).sort(), ["big", "hello", "leak", "nightly", "oops", "paid", "shaky", "sweep"], "server parts only");
    assert.equal(by.hello.ok, true, by.hello.error);
    assert.equal(by.hello.status, 200);
    assert.deepEqual(by.hello.ran, ["request"]);
    assert.equal(by.big.ok, false); assert.equal(by.big.kind, "code"); assert.equal(by.big.status, 500); assert.match(by.big.error, /too large/);
    assert.equal(by.paid.ok, true, "an unsigned sample refused with 400 is not a fault"); assert.equal(by.paid.status, 400);
    assert.equal(by.oops.ok, false); assert.equal(by.oops.kind, "code"); assert.match(by.oops.error, /notDefined is not defined/);
    assert.equal(by.shaky.ok, false); assert.equal(by.shaky.kind, "input", "a stop that may be our sample is not the code's"); assert.match(by.shaky.error, /no amount/);
    assert.equal(by.leak.ok, false); assert.equal(by.leak.kind, "code"); assert.match(by.leak.error, /did not declare other\.example/);
    assert.equal(by.nightly.ok, false, "a hook's failure is read from the site's own error log"); assert.equal(by.nightly.kind, "code");
    assert.match(by.nightly.error, /Cannot read properties of null/);
    assert.deepEqual(by.nightly.ran, ["tick"]);
    assert.equal(by.sweep.ok, true, by.sweep.error); assert.deepEqual(by.sweep.ran, ["tick"]);
  } finally { b.done(); }
});

test("SB2 nothing real is reached: no network, no key, no environment, no files outside the bundle", async () => {
  const probe = { name: "server-probe", source: `export const hosts = ["api.example.com"];
export default async function (request: Request, site: SiteHelper): Promise<Response> {
  const out: any = {};
  const g: any = globalThis;
  try { out.env = Object.keys(g.process.env).length; } catch { out.env = "blocked"; }
  try { await import("node:fs").then((fs: any) => fs.readFileSync("/etc/passwd")); out.read = "open"; } catch { out.read = "blocked"; }
  try { await import("node:child_process").then((cp: any) => cp.execSync("true")); out.exec = "open"; } catch { out.exec = "blocked"; }
  const r = await site.fetch("https://api.example.com/v1", { headers: { authorization: site.key("OPENAI_KEY") } });
  out.answer = (await r.json()).id;
  const d = await g.fetch("https://example.com/");
  out.direct = (await d.json()).id;
  throw new Error("PROBE" + JSON.stringify(out));
}` };
  const b = makeBundle("kiln", [probe]);
  try {
    const r = await bundleCheckServerParts(b.entry, "kiln", [probe]);
    assert.equal(r.ran, true, r.why);
    const seen = JSON.parse(r.results[0].error.replace(/^.*?PROBE/, ""));
    assert.equal(seen.env, 0, "no environment");
    assert.equal(seen.read, "blocked", "no files");
    assert.equal(seen.exec, "blocked", "nothing launched");
    assert.equal(seen.answer, "test", "the outside service is the fake");
    assert.equal(seen.direct, "test", "a direct call reaches the fake too, never the network");
  } finally { b.done(); }
});

// A TIMEOUT OF ITS OWN: a check whose timer is gone hangs here, and a hang must
// read as a failure, not as a run that never ended (the sweep's NO TIMER).
test("SB3 it never throws: no parts, no address, a bundle that will not load, a bundle that hangs", { timeout: 30_000 }, async () => {
  assert.deepEqual(await bundleCheckServerParts("/nowhere.js", "kiln", [{ name: "band-a", source: "" }]), { ran: false, why: "none", results: [] });
  const r1 = await bundleCheckServerParts("/nowhere.js", "", PARTS.slice(0, 1));
  assert.equal(r1.ran, false); assert.match(r1.why, /no site address/);
  const r2 = await bundleCheckServerParts("/nowhere/server.js", "kiln", PARTS.slice(0, 1));
  assert.equal(r2.ran, false); assert.match(r2.why, /would not load/);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gf-hang-"));
  fs.chmodSync(dir, 0o755);
  fs.writeFileSync(path.join(dir, "server.js"), "while (true) {}\n", { mode: 0o755 });
  // The child is held here so a check that never stops it cannot keep this
  // file running: a hang must read as a failure, not as a run that never ends.
  const { spawn } = await import("node:child_process");
  let held = null;
  const spawnFn = (...a) => (held = spawn(...a));
  try {
    const r3 = await Promise.race([
      bundleCheckServerParts(path.join(dir, "server.js"), "kiln", PARTS.slice(0, 1), { timeoutMs: 1500, spawnFn }),
      new Promise((ok) => setTimeout(() => ok("still waiting after 15 s"), 15_000).unref()),
    ]);
    assert.deepEqual(r3, { ran: false, why: "timed out", results: [] });
  } finally {
    try { held && held.kill("SIGKILL"); } catch { /* gone */ }
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("SB4 folding into the dry run: a pass the built site failed takes its failure; a dry-run failure stays; the bundle's own word rides along", () => {
  const dry = { ran: true, results: [{ name: "a", ok: true, ran: ["request"] }, { name: "b", ok: false, kind: "code", error: "x is not defined" }, { name: "c", ok: true }] };
  const bundle = { ran: true, results: [{ name: "a", ok: false, kind: "code", error: "the function's answer is too large", status: 500 }, { name: "b", ok: false, kind: "input", error: "other" }, { name: "c", ok: true }] };
  const m = mergeBundleResults(dry, bundle);
  assert.deepEqual(m.results[0], { name: "a", ok: false, ran: ["request"], error: "through the built site: the function's answer is too large", kind: "code", via: "bundle", status: 500 });
  assert.deepEqual(m.results[1], dry.results[1], "the dry run's own failure names the part's fault");
  assert.deepEqual(m.results[2], dry.results[2]);
  assert.deepEqual(m.bundle, { ran: true, passed: ["c"], failed: ["a", "b"] });
  assert.equal(m.ran, true);
  assert.deepEqual(mergeBundleResults(dry, { ran: false, why: "none", results: [] }), dry, "no server parts: the dry run as it was");
  assert.deepEqual(mergeBundleResults(dry, { ran: false, why: "timed out", results: [] }), { ...dry, bundle: { ran: false, why: "timed out" } });
  const only = mergeBundleResults({ ran: false, why: "no compiler", results: [] }, bundle);
  assert.equal(only.ran, true, "the built site's answer stands when the dry run could not run");
  assert.deepEqual(only.results.map((r) => [r.name, r.ok, r.via]), [["a", false, "bundle"], ["b", false, "bundle"], ["c", true, undefined]]);
});

test("SB5 the wiring: the container asks the built site after the dry run, folds it in, and ships both files", () => {
  const src = fs.readFileSync(new URL("../builder/build-server.mjs", import.meta.url), "utf8");
  const dry = src.indexOf("serverTests = await dryRunServerParts(sp");
  const fold = src.indexOf("serverTests = mergeBundleResults(serverTests, await bundleCheckServerParts(SERVER_BUNDLE, payload.slug, sp));");
  assert.ok(dry > 0 && fold > dry, "the bundle is asked after the dry run, with the built bundle and the site's address");
  assert.match(src, /import \{ bundleCheckServerParts, mergeBundleResults \} from "\.\/server-bundle-check\.mjs";/);
  const df = fs.readFileSync(new URL("../Dockerfile", import.meta.url), "utf8");
  assert.match(df, /builder\/server-bundle-check\.mjs builder\/server-bundle-child\.mjs/);
});
