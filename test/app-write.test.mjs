// PHASE C (2026-10-21): an app build writes Expo screens with one `write_app`
// call, has the app builder check them, repairs once from the compiler's own
// lines, and keeps the result for the phones. The model and the container are
// stand-ins; their answers have the shapes the real ones give.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadWorkerModule } from "./fixtures/worker-harness.mjs";
const W = await loadWorkerModule();
const { writePhoneApp, setAppWait } = W.chatStoreApi;
const worker = readFileSync(new URL("../worker.js", import.meta.url), "utf8");

function bucket() {
  const m = new Map();
  return { m, async get(k) { return m.has(k) ? { text: async () => m.get(k) } : null; }, async put(k, v) { m.set(k, typeof v === "string" ? v : "bytes"); } };
}
const TABS = { path: "app/(tabs)/_layout.tsx", source: "tabs" };
const HOME = { path: "app/(tabs)/index.tsx", source: "home" };
const answer = (files) => Response.json({ type: "message", role: "assistant", stop_reason: "tool_use", content: [{ type: "tool_use", id: "t", name: "write_app", input: { files } }], usage: { input_tokens: 4000, output_tokens: 6000 } });
const realFetch = globalThis.fetch;
test.afterEach(() => { globalThis.fetch = realFetch; });

function rig(models, checks) {
  const calls = [], seen = [];
  globalThis.fetch = async (u, o) => { if (String(u).includes("anthropic")) { calls.push(JSON.parse(o.body)); return models.shift()(); } return realFetch(u, o); };
  const ns = { idFromName: (n) => n, get: () => ({ fetch: async (req) => { seen.push(JSON.parse(await req.text())); return checks.shift()(); } }) };
  return { calls, seen, env: { ANTHROPIC_API_KEY: "k", SITES_BUCKET: bucket(), APP_BUILD_CONTAINER: ns } };
}
const args = (env) => ({ slug: "loaf-1", brief: "A bakery app", brand: "Loaf", spec: { tables: [{ name: "loaves" }] }, theme: null, model: "claude-sonnet-5", budget: null });

test("written, checked, kept: the files go to the app builder and the phones get the current web version", async () => {
  const { calls, seen, env } = rig([() => answer([TABS, HOME])], [() => Response.json({ ok: true, ms: 5, files: [{ path: "index.html", data: "aGk=" }] })]);
  const out = await writePhoneApp(env, args(env));
  assert.equal(out.ok, true, JSON.stringify(out));
  assert.equal(calls.length, 1);
  assert.equal(calls[0].tool_choice.name, "write_app");
  assert.match(calls[0].system[0].text, /YOU ARE WRITING A REAL PHONE APP/);
  assert.match(calls[0].messages[0].content, /A bakery app[\s\S]*loaves/);
  assert.deepEqual(seen[0].files, [TABS, HOME]);
  assert.match(out.preview, /^\/app-preview\/loaf-1\/[a-f0-9]{32}\/$/);
  assert.ok(env.SITES_BUCKET.m.has("apps/loaf-1/preview.json"));
  assert.equal(env.SITES_BUCKET.m.get("apps/loaf-1/source/app/(tabs)/index.tsx"), "home", "the app's source is kept for its edits");
  assert.equal(out.usage.length, 1);
});

test("a typecheck failure goes back to the writer once, with the compiler's lines, and the repair is kept", async () => {
  const { calls, env } = rig(
    [() => answer([TABS, { ...HOME, source: "broken" }]), () => answer([TABS, HOME])],
    [() => Response.json({ ok: false, stage: "typecheck", errors: ["app/(tabs)/index.tsx(1,1): error TS2304: Cannot find name 'Nope'."] }), () => Response.json({ ok: true, files: [] })],
  );
  const out = await writePhoneApp(env, args(env));
  assert.equal(out.ok, true);
  assert.equal(calls.length, 2);
  const last = calls[1].messages.at(-1).content[0];
  assert.equal(last.type, "tool_result"); assert.match(last.content, /TS2304: Cannot find name 'Nope'/);
  assert.equal(out.usage.length, 2, "both calls are billed by what they spent");
});

test("two failures stop, keep nothing, and report every call's usage", async () => {
  const fail = () => Response.json({ ok: false, stage: "typecheck", errors: ["x.tsx(1,1): error TS1: no"] });
  const { env } = rig([() => answer([TABS]), () => answer([TABS])], [fail, fail]);
  const out = await writePhoneApp(env, args(env));
  assert.equal(out.ok, false); assert.equal(out.stage, "check"); assert.equal(out.usage.length, 2);
  assert.ok(!env.SITES_BUCKET.m.has("apps/loaf-1/preview.json"));
});

test("an answer that writes the kit itself is refused before any check", async () => {
  const { seen, env } = rig([() => answer([TABS, { path: "components/app/button.tsx", source: "x" }])], []);
  const out = await writePhoneApp(env, args(env));
  assert.equal(out.ok, false); assert.match(out.error, /not a file/); assert.equal(seen.length, 0);
});

test("THE BUILD: an app project takes the app writer after the design, bills what it spent by ref, refunds on failure, and publishes no website", () => {
  const at = worker.indexOf('      if (surface === "app") {\n        const seeds');
  const pagesAt = worker.indexOf('      let pages = { page: "placeholder"');
  assert.ok(at > 0 && pagesAt > at, "the branch sits before the site's pages");
  const br = worker.slice(at, pagesAt);
  assert.match(br, /writePhoneApp\(env, \{ slug, brief, brand, spec, theme, model: models\.pages, budget, say, auth \}\)/);
  assert.match(br, /ledger\.debit\(spent, debitRef\("pages"\), "debit", true\)/);
  assert.match(br, /const back = await refundFields\(\);/);
  assert.match(br, /page: "app", surface: "app", appPreview: app\.preview/);
  assert.doesNotMatch(br, /publishPlaceholder|buildAndPublishPages/);
  assert.match(readFileSync(new URL("../public/chat.js", import.meta.url), "utf8"), /if \(d\.surface === 'app' && typeof d\.appPreview === 'string'/);
});

test("INSIDE THE SITE CONTAINER (no app builder binding): the build asks the Worker's own preview route with the owner's sign-in", async () => {
  const calls = [], posted = [];
  globalThis.fetch = async (u, o) => {
    u = String(u);
    if (u.includes("anthropic")) { calls.push(1); return answer([TABS, HOME]); }
    if (u === "https://gofarther.dev/api/site/loaf-1/app/preview") { posted.push({ auth: o.headers.Authorization, body: JSON.parse(o.body) }); return Response.json({ ok: true, preview: "/app-preview/loaf-1/" + "a".repeat(32) + "/" }); }
    return realFetch(u, o);
  };
  const env = { ANTHROPIC_API_KEY: "k", SITES_BUCKET: bucket() };
  const out = await writePhoneApp(env, { ...args(env), auth: "Bearer owner" });
  assert.equal(out.ok, true, JSON.stringify(out));
  assert.equal(posted.length, 1); assert.equal(posted[0].auth, "Bearer owner");
  assert.deepEqual(posted[0].body.files, [TABS, HOME]);
  assert.equal(out.preview, "/app-preview/loaf-1/" + "a".repeat(32) + "/");
  assert.ok(env.SITES_BUCKET.m.has("apps/loaf-1/source.json"), "the source manifest is kept for the Android build");
  const noAuth = await writePhoneApp({ ANTHROPIC_API_KEY: "k", SITES_BUCKET: bucket() }, { ...args(env), auth: "" });
  assert.equal(noAuth.ok, false); assert.match(noAuth.error, /cannot be reached/, "no sign-in is said at once, never ten minutes of busy");
});
