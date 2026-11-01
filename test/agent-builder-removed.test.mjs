// THE AGENT BUILDER IS DELETED (2026-11-01, owner: "delete that agent build
// thing. Just, we can delete it completely."). The profile menu offers no
// "Agent builder" row, the page has no Agents view, and the Worker answers
// `/api/agent/*` with 404 like any address it does not serve.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const page = readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");

test("the profile menu no longer offers Agent builder, and the page has no Agents view", () => {
  // The observer is alive: the menu and its Settings row are still read.
  assert.match(html, /class="pp-row" data-view="settings" data-act="view"/, "the profile menu's Settings row is missing, so this read nothing");
  assert.doesNotMatch(html, /data-view="agents"/);
  assert.doesNotMatch(html, />\s*Agent builder\s*</);
  assert.doesNotMatch(html, /id="viewAgents"/);
  assert.match(page, /^const KNOWN_VIEWS = \[[^\]]*'settings'[^\]]*\];$/m, "KNOWN_VIEWS moved — re-read it");
  assert.doesNotMatch(page, /^const KNOWN_VIEWS = \[[^\]]*'agents'/m);
  assert.doesNotMatch(page, /function renderAgents\(|\/api\/agent\//);
  assert.ok(!existsSync(new URL("../agent-store.mjs", import.meta.url)), "agent-store.mjs is back");
  assert.ok(!existsSync(new URL("../agent-builder", import.meta.url)), "agent-builder/ is back");
});

test("the Worker answers /api/agent/* with 404, signed in or not", async () => {
  const { loadWorkerModule } = await import("./fixtures/worker-harness.mjs");
  const w = (await loadWorkerModule()).default;
  const ctx = { waitUntil() {}, passThroughOnException() {} };
  for (const path of ["/api/agent/list", "/api/agent/send", "/api/agent/messages?id=a", "/api/agent/automations?agent=a", "/api/agent/import"]) {
    for (const method of ["GET", "POST"]) {
      const init = { method, headers: { authorization: "Bearer x", "content-type": "application/json" } };
      if (method === "POST") init.body = "{}";
      const r = await w.fetch(new Request("https://gofarther.dev" + path, init), {}, ctx);
      assert.equal(r.status, 404, method + " " + path);
    }
  }
  // Control: a route that exists still answers something other than 404.
  const live = await w.fetch(new Request("https://gofarther.dev/api/credits", { headers: { authorization: "Bearer x" } }), {}, ctx);
  assert.notEqual(live.status, 404, "the harness answers 404 for everything, so the check above proves nothing");
});
