// A CONNECTION CUT AFTER THE HEADERS SETTLES THE CALL (2026-10-22, the
// builder audit's A23-2).
//
// `longPost` settled only on the response's `end`, the request's `error` or the
// signal. A server that sends its headers and part of the body and then closes
// the connection cleanly emits neither `end` nor a request `error`, and the
// request's `close` removed the abort listener and the idle timer — so the
// promise never settled, its own timeout could no longer reach it, and the
// site's container waited behind it for about an hour. Driven here against a
// real local server: with a signal, without one, and with the idle timer.

import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { longPost } from "../builder/long-post.mjs";

// Headers, one chunk, then a clean close before the chunked body ends.
async function cutServer() {
  const server = http.createServer((req, res) => {
    req.resume();
    req.on("end", () => {
      res.writeHead(200, { "content-type": "text/event-stream" });
      res.write("data: {\"partial\":true}\n\n");
      setTimeout(() => res.socket.end(), 50);
    });
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  return { server, url: "http://127.0.0.1:" + server.address().port + "/v1" };
}

// Settled within `ms`, or "pending".
async function within(p, ms) {
  let t;
  const timer = new Promise((r) => { t = setTimeout(() => r({ pending: true }), ms); });
  try {
    return await Promise.race([p.then((v) => ({ value: v }), (e) => ({ error: e })), timer]);
  } finally { clearTimeout(t); }
}

for (const [label, init] of [
  ["with no signal and no idle timer", {}],
  ["with a signal far in the future", { signal: AbortSignal.timeout(60000) }],
  ["with an idle timer far in the future", { idleMs: 60000 }],
]) {
  test("a connection closed after the headers rejects, carrying the wire, " + label, async () => {
    const { server, url } = await cutServer();
    try {
      const out = await within(longPost(url, { body: "{}", ...init }), 3000);
      assert.ok(!out.pending, "the call never settled after its connection was cut");
      assert.ok(out.error, "a cut answer resolved as if it were whole: " + JSON.stringify(out.value && out.value.status));
      assert.equal(out.error.name, "ConnectionCutError", "not classified as a cut: " + out.error.name + " " + out.error.message);
      assert.ok(out.error.wire && out.error.wire.headersMs >= 0, "the wire does not say the headers had arrived");
      assert.ok(out.error.wire.chars > 0, "the wire does not say bytes had flowed");
    } finally { server.close(); }
  });
}

test("a cut call disarms its abort listener when it settles, not before", async () => {
  const { server, url } = await cutServer();
  const ac = new AbortController();
  const removed = [];
  const orig = ac.signal.removeEventListener.bind(ac.signal);
  ac.signal.removeEventListener = (type, fn) => { removed.push(type); return orig(type, fn); };
  try {
    const out = await within(longPost(url, { body: "{}", signal: ac.signal }), 3000);
    assert.ok(out.error, "the cut call did not reject");
    assert.deepEqual(removed, ["abort"], "the abort listener was not removed exactly once on settling");
  } finally { server.close(); }
});

test("control: a whole answer still resolves, once", async () => {
  const server = http.createServer((req, res) => { req.resume(); req.on("end", () => { res.writeHead(200); res.end("{\"ok\":1}"); }); });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  try {
    const out = await within(longPost("http://127.0.0.1:" + server.address().port + "/", { body: "{}", idleMs: 60000, signal: AbortSignal.timeout(60000) }), 3000);
    assert.ok(out.value, "a whole answer did not resolve: " + (out.error && out.error.message));
    assert.equal(out.value.status, 200);
    assert.deepEqual(await out.value.json(), { ok: 1 });
  } finally { server.close(); }
});
