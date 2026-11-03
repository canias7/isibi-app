// PARKED (2026-11-03, park-old-way): the old-way half of test/app-builder.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
// The Android app builder (2026-10-20, owner: "yea separate container for the
// app"): its own container class and image, the request it reads, the names it
// writes into the Android project, and the Worker's owner-only route, driven
// end to end with a stand-in container.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readBuild, capacitorConfig, nativeNames, appIdFor } from "../../../app-builder/app-config.mjs";
import { loadWorkerModule } from "../../../test/fixtures/worker-harness.mjs";
const W = await loadWorkerModule();
const worker = W.default, api = W.chatStoreApi;

function bucket(seed = {}) {
  const m = new Map(Object.entries(seed).map(([k, v]) => [k, typeof v === "string" ? new TextEncoder().encode(v) : v]));
  return {
    m,
    async get(k) { const v = m.get(k); return v ? { body: new Blob([v]).stream(), arrayBuffer: async () => v.buffer.slice(v.byteOffset, v.byteOffset + v.byteLength), text: async () => new TextDecoder().decode(v), etag: "e" } : null; },
    async put(k, body) { m.set(k, new Uint8Array(body instanceof ArrayBuffer ? body : await new Response(body).arrayBuffer())); return { etag: "e" }; },
    async list({ prefix }) { return { objects: [...m.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })), truncated: false }; },
    async delete(k) { m.delete(k); },
  };
}

const realFetch = globalThis.fetch;
test.afterEach(() => { globalThis.fetch = realFetch; });
const signIn = (uid, owner) => { globalThis.fetch = async (u, o) => { u = String(u); if (u.includes("/auth/v1/user")) return new Response(JSON.stringify({ id: uid }), { status: 200 }); if (u.includes("/rest/v1/site_backends")) return new Response(JSON.stringify(owner ? [{ uid: owner }] : []), { status: 200 }); return realFetch(u, o); }; };
function containerNs(answer) {
  const seen = [];
  return { seen, idFromName: (n) => n, get: (id) => ({ fetch: async (req) => { seen.push({ id, url: req.url, body: JSON.parse(await req.text()) }); return answer(); } }) };
}
const call = (env, method, slug, body, tok = "t") => worker.fetch(new Request("https://gofarther.dev/api/site/" + slug + "/app/android", {
  method, headers: { ...(tok ? { Authorization: "Bearer " + tok } : {}), "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}),
}), env, { waitUntil() {}, passThroughOnException() {} });

// ── WAITING ITS TURN, THE ROUTER'S "app", THE PICKER (2026-10-20, owner: "3 and it has to be through model calls") ──
import { readRouting, ASK_TOOL, LIVE_ASK_TOOL, APPS_OPEN } from "../builder/site-ask.mjs";

test("ROUTER: while apps are parked, \"app\" is never offered or taken; opened, it is one of its answers with the phone named", () => {
  const said = (input, o) => readRouting({ content: [{ type: "tool_use", input }] }, o);
  assert.ok(!ASK_TOOL.input_schema.properties.intent.enum.includes("app") && !ASK_TOOL.input_schema.properties.platform, "a first build's tool is unchanged: there is no site to make an app of");
  if (!APPS_OPEN) {
    assert.ok(!LIVE_ASK_TOOL.input_schema.properties.intent.enum.includes("app"), "parked: the router is not offered \"app\"");
    assert.ok(!LIVE_ASK_TOOL.input_schema.properties.platform, "parked: no phone to name");
    assert.doesNotMatch(LIVE_ASK_TOOL.input_schema.properties.intent.description, /"app" — they want/);
    assert.notEqual(said({ intent: "app", platform: "ios" }, { hasSite: true, live: true }).intent, "app", "parked: an \"app\" answer is never taken");
    return;
  }
  assert.ok(LIVE_ASK_TOOL.input_schema.properties.intent.enum.includes("app"));
  assert.deepEqual(LIVE_ASK_TOOL.input_schema.properties.platform.enum, ["android", "ios"]);
  assert.match(LIVE_ASK_TOOL.input_schema.properties.intent.description, /"app" — they want the site that ALREADY EXISTS made into a phone app/);
  assert.deepEqual(said({ intent: "app", platform: "ios" }, { hasSite: true, live: true }), { intent: "app", platform: "ios", answer: "" });
  assert.equal(said({ intent: "app" }, { hasSite: true }).platform, "android", "Android when no phone was named");
  assert.equal(said({ intent: "app", platform: "windows" }, { hasSite: true }).platform, "android", "a phone off the list is never passed on");
  assert.equal(said({ intent: "app", platform: "android" }, { hasSite: false }).intent, "build", "with no site, there is a website to build first");
});
