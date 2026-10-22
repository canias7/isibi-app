// Audit finding 40 (2026-10-22): inside a container job, `getContainer(...).fetch`
// (builder/containers-shim.mjs) was Node's global fetch, undici, whose
// 300-second headers timeout cuts a compile (`/build`) or a synchronous model
// call (`/model`) that answers only when the whole job is done. The hop must
// ride `longFetch` (node:http, no headers timeout, the caller's signal the one
// bound).
//
// The real wall is 300 s; these cases scale it. Global fetch is replaced by a
// stand-in that waits a "headers limit" of 150 ms and then fails exactly as
// undici does ("fetch failed"), and the build service sends its headers only
// after 600 ms. The old shim reached the stand-in and died; the new one must
// never touch global fetch and must bring the whole answer back.
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { readFileSync } from "node:fs";
import { getContainer } from "../builder/containers-shim.mjs";
import { longFetch } from "../builder/long-post.mjs";

const HEADERS_LIMIT_MS = 150; // the test's scaled stand-in for undici's 300 s
const SLOW_HEADERS_MS = 600; // a compile that outlasts it

function slowService(delayMs) {
  const seen = [];
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      seen.push({ method: req.method, url: req.url, body, type: req.headers["content-type"] });
      setTimeout(() => {
        res.writeHead(200, { "content-type": "application/json", "x-stage": "done" });
        res.end(JSON.stringify({ ok: true, path: req.url, echo: body.length }));
      }, delayMs);
    });
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve({ server, seen, port: server.address().port })));
}

async function withWalledFetch(fn) {
  const real = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    await new Promise((r) => setTimeout(r, HEADERS_LIMIT_MS));
    throw new TypeError("fetch failed", { cause: { code: "UND_ERR_HEADERS_TIMEOUT" } });
  };
  try { return { out: await fn(), calls: () => calls }; } finally { globalThis.fetch = real; }
}

for (const path of ["/build", "/model"]) {
  test(`a job's ${path} hop that answers after the headers limit comes back whole`, async () => {
    const { server, seen, port } = await slowService(SLOW_HEADERS_MS);
    const prev = process.env.JOB_BUILD_PORT;
    process.env.JOB_BUILD_PORT = String(port);
    try {
      const payload = JSON.stringify({ files: { "a.tsx": "x".repeat(70000) }, slug: "s" });
      const { out, calls } = await withWalledFetch(async () => {
        const c = getContainer({}, "lane-ignored");
        const r = await c.fetch(new Request("http://build" + path, {
          method: "POST", headers: { "content-type": "application/json" }, body: payload,
          signal: AbortSignal.timeout(10000),
        }));
        return { status: r.status, ok: r.ok, stage: r.headers.get("x-stage"), body: JSON.parse(await r.text()) };
      });
      assert.equal(calls(), 0, "the job hop must not ride Node's global fetch");
      assert.deepEqual(out, { status: 200, ok: true, stage: "done", body: { ok: true, path, echo: payload.length } });
      assert.equal(seen.length, 1);
      assert.equal(seen[0].body, payload);
      assert.equal(seen[0].type, "application/json");
    } finally {
      if (prev === undefined) delete process.env.JOB_BUILD_PORT; else process.env.JOB_BUILD_PORT = prev;
      server.close();
    }
  });
}

test("the caller's signal is still the bound: an abort before the headers rejects with its reason", async () => {
  const { server, port } = await slowService(2000);
  try {
    const t0 = Date.now();
    await assert.rejects(
      longFetch(`http://127.0.0.1:${port}/build`, { method: "POST", body: "{}", signal: AbortSignal.timeout(200) }),
      (e) => e && e.name === "TimeoutError",
    );
    assert.ok(Date.now() - t0 < 1500, "rejected at the signal, not at the answer");
  } finally { server.close(); server.closeAllConnections(); }
});

test("a GET poll answers a real Response with status and headers", async () => {
  const { server, port } = await slowService(0);
  try {
    const r = await longFetch(`http://127.0.0.1:${port}/model/result?id=1`);
    assert.equal(r.status, 200);
    assert.equal(r.headers.get("content-type"), "application/json");
    assert.deepEqual(await r.json(), { ok: true, path: "/model/result?id=1", echo: 0 });
  } finally { server.close(); }
});

test("worker.js never imports long-post (workerd has no node:http)", () => {
  const src = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  assert.ok(src.length > 100000, "read the real worker.js");
  assert.doesNotMatch(src, /^\s*import[^;]*long-post/m);
});
