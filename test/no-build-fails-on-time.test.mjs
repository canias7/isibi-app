// NO BUILD FAILS ON TIME ALONE (2026-10-18, owner: "no build should ever fail,
// specially when it comes to time"), after the Harbour Loaf build: five pages,
// one model call, held as one synchronous hop inside the container and cut by
// Node's 300-second headers wall, then its fallback cut the same way —
// 300 + 300 seconds, "fetch failed".
//
//   PH1 a single page call in the container is started and polled (`/model/start`,
//       `/model/result`), never held as one long hop;
//   PH2 the direct fallback uses the job's own transport and stream;
//   LP1 a streamed call that goes silent is stopped as `IdleTimeoutError`;
//       one that keeps writing is never stopped by it;
//   PC1 a call that died for a reason that is not an answer is asked again,
//       a provider's own status is not.

import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { loadWorkerModule } from "./fixtures/worker-harness.mjs";
import { longPost } from "../builder/long-post.mjs";
import { patientCall, MODEL_CALL_TRIES, STREAM_IDLE_MS, CONTAINER_CALL_CAP_MS, BUILDER_CALL_MS } from "../builder/build-call.mjs";

/** A local build service: `/model/start` answers an id, `/model/result` the answer; every hop recorded. */
function service({ start = true, result = { ok: true, state: "done", answer: { content: [{ type: "text", text: "pages" }] } }, model = null } = {}) {
  const hops = [];
  const box = {
    fetch: async (req) => {
      const u = new URL(req.url);
      let b = {};
      try { b = JSON.parse(await req.text()); } catch { b = {}; }
      hops.push({ path: u.pathname, body: b });
      if (u.pathname === "/model/start") return start ? new Response(JSON.stringify({ ok: true, id: "g1" })) : new Response(JSON.stringify({ ok: false }), { status: 429 });
      if (u.pathname === "/model/result") return new Response(JSON.stringify(result));
      if (u.pathname === "/model") return new Response(JSON.stringify(model || { ok: false, kind: "TypeError", message: "fetch failed" }));
      return new Response("{}", { status: 404 });
    },
  };
  return { hops, binding: { local: true, idFromName: (n) => n, get: () => box } };
}

test("PH1 A SINGLE PAGE CALL IN THE CONTAINER IS STARTED AND POLLED — `/model/start` with the one request, then `/model/result`; the synchronous `/model` hop is never held; the answer comes back as the single call's", async () => {
  const { pagesHopApi } = await loadWorkerModule();
  const svc = service();
  const out = {};
  const call = pagesHopApi.containerPagesFanLocal({ SITE_BUILD_CONTAINER: svc.binding }, "harbour-loaf", out);
  const ans = await call({}, { model: "grok-4.6", messages: [] }, null);
  assert.deepEqual(ans, { content: [{ type: "text", text: "pages" }] });
  assert.equal(out.via, "container");
  const starts = svc.hops.filter((h) => h.path === "/model/start");
  assert.equal(starts.length, 1);
  assert.ok(starts[0].body.req && !starts[0].body.reqs, "the one request was not started as one");
  assert.ok(starts[0].body.callMs > BUILDER_CALL_MS, "the container call still carries the Worker's ten minutes: " + starts[0].body.callMs);
  assert.equal(starts[0].body.callMs, CONTAINER_CALL_CAP_MS);
  assert.equal(svc.hops.filter((h) => h.path === "/model").length, 0, "the call was held as one synchronous hop");
  // A FAILED ONE KEEPS THE PROVIDER'S SHAPE (status, detail, class).
  const bad = service({ result: { ok: true, state: "failed", status: 402, detail: "no credit", kind: "Error", message: "xai 402" } });
  await assert.rejects(() => pagesHopApi.containerPagesFanLocal({ SITE_BUILD_CONTAINER: bad.binding }, "s", {})({}, { model: "grok-4.6" }, null), (e) => e.status === 402 && e.detail === "no credit");
  // A SERVICE THAT WILL NOT START IT: the synchronous hop, as before.
  const old = service({ start: false, model: { ok: true, answer: { content: [] } } });
  assert.deepEqual(await pagesHopApi.containerPagesFanLocal({ SITE_BUILD_CONTAINER: old.binding }, "s", {})({}, { model: "grok-4.6" }, null), { content: [] });
  assert.ok(old.hops.some((h) => h.path === "/model"));
});

test("PH2 THE DIRECT FALLBACK USES THE JOB'S OWN TRANSPORT AND STREAM — never a bare call, which inside the container is Node's fetch, cut at 300 seconds", async () => {
  const { pagesHopApi } = await loadWorkerModule();
  const svc = service(); // `/model` answers a TypeError: the hop failed, safe to make the call here
  const sent = [];
  const send = async (url, init) => { sent.push({ url, init }); return { ok: false, status: 500, text: async () => "boom" }; };
  const call = pagesHopApi.containerPagesCall({ SITE_BUILD_CONTAINER: svc.binding, MODEL_SEND: send, MODEL_STREAM: true }, "s", {});
  await assert.rejects(() => call({ xai: "k" }, { model: "grok-4.6", messages: [{ role: "user", content: "x" }] }, null), /xai 500/);
  assert.equal(sent.length, 1, "the fallback did not use the job's own sender");
  assert.equal(JSON.parse(sent[0].init.body).stream, true, "the fallback did not stream");
  assert.equal(sent[0].init.idleMs, STREAM_IDLE_MS, "the fallback is not judged by its silence");
});

/** A local server: `plan` is a list of `[delayMs, chunk]`, then it ends. */
function server(plan) {
  return new Promise((resolve) => {
    const s = http.createServer(async (req, res) => {
      req.resume();
      res.writeHead(200, { "content-type": "text/plain" });
      for (const [ms, chunk] of plan) { await new Promise((r) => setTimeout(r, ms)); if (res.destroyed) return; res.write(chunk); }
      res.end();
    });
    s.listen(0, "127.0.0.1", () => resolve(s));
  });
}

test("LP1 A STREAM THAT GOES SILENT IS STOPPED AS `IdleTimeoutError`; ONE THAT KEEPS WRITING IS NEVER STOPPED BY IT, HOWEVER LONG IT RUNS", async () => {
  const quietS = await server([[10, "a"], [600, "b"]]);
  try {
    const t0 = Date.now();
    await assert.rejects(() => longPost("http://127.0.0.1:" + quietS.address().port + "/", { body: "{}", idleMs: 150 }), (e) => e.name === "IdleTimeoutError" && e.wire && e.wire.chars === 1);
    assert.ok(Date.now() - t0 < 500, "the silence was not caught at its limit");
  } finally { quietS.close(); }
  const busy = await server(Array.from({ length: 12 }, () => [60, "x"]));
  try {
    const r = await longPost("http://127.0.0.1:" + busy.address().port + "/", { body: "{}", idleMs: 150 });
    assert.equal(await r.text(), "x".repeat(12), "a call that kept writing (720ms > 150ms) was stopped");
  } finally { busy.close(); }
  // WITHOUT `idleMs`, NOTHING CHANGES.
  const slow = await server([[300, "z"]]);
  try { assert.equal(await (await longPost("http://127.0.0.1:" + slow.address().port + "/", { body: "{}" })).text(), "z"); }
  finally { slow.close(); }
});

test("PC1 A CALL THAT DIED FOR A REASON THAT IS NOT AN ANSWER IS ASKED AGAIN, UP TO ITS TRIES; A PROVIDER'S OWN STATUS IS THROWN AT ONCE", async () => {
  let n = 0;
  assert.equal(await patientCall(async () => { n++; if (n < 3) throw Object.assign(new Error("silent"), { name: "IdleTimeoutError" }); return "pages"; }), "pages");
  assert.equal(n, 3);
  let m = 0;
  await assert.rejects(() => patientCall(async () => { m++; throw new TypeError("fetch failed"); }), /fetch failed/);
  assert.equal(m, MODEL_CALL_TRIES);
  let k = 0;
  await assert.rejects(() => patientCall(async () => { k++; throw Object.assign(new Error("xai 402"), { status: 402 }); }), /402/);
  assert.equal(k, 1, "a provider's own answer was asked again");
  assert.ok(MODEL_CALL_TRIES >= 2 && STREAM_IDLE_MS >= 60000 && CONTAINER_CALL_CAP_MS > BUILDER_CALL_MS);
});
