import http from "node:http";
import https from "node:https";

/**
 * THE TRANSPORT UNDER EVERY MODEL CALL MADE FROM INSIDE THE CONTAINER.
 *
 * ── WHY IT IS ITS OWN MODULE (2026-09-14) ─────────────────────────────────
 *
 * It lived in `build-server.mjs`, which is the build SERVICE — the long-lived
 * HTTP process. That was right for as long as the only model calls made in
 * this container were the service's own three (`/generate` and its repair
 * rounds), and it stopped being right the day `JOB_RUNNER_EVERYONE` went on:
 * an edit or an addon now runs `worker.js` itself in a CHILD process, and that
 * child makes the longest model call on the platform — the page call — with no
 * way to reach a function defined inside its parent.
 *
 * So it moved here, and `worker.js` NEVER imports this file: it would pull
 * `node:http` into workerd, where neither module exists. The runner puts the
 * sender on the job's env (`MODEL_SEND`) and `worker.js` reads it as an opaque
 * function, so the Worker's own bundle is byte-for-byte what it was.
 *
 * WHAT IT COST NOT TO HAVE THIS: run 45 (2026-09-14), an addon whose page call
 * died at 270,025 ms as `TypeError: fetch failed`, no status, nothing
 * published. `build-call.mjs` had recorded the same wall at 270,036 ms on
 * 2026-08-26 and FIXED it — for the service's calls only. The child was still
 * on Node's global fetch. This repository's own "a rule true because of a
 * layer below it expires when that layer moves", with the move being ours.
 */
// Node's `fetch` is undici, and undici's HEADERS TIMEOUT is 300 seconds: not a
// knob on the request, not movable by an AbortSignal set longer — the headers
// timeout fires first. A non-streaming provider sends its response headers only
// when the WHOLE generation is done, and this platform's generations measure
// 333–620 seconds — so every generation fired at this container died at
// exactly 300s as `TypeError: fetch failed`, which carries no status and is
// therefore classified `no-request` upstream: refire, the same wall, stop.
// Runs 41 and 42, four attempts, four identical deaths. The Worker never hit
// it because workerd's fetch has no such ceiling — which is precisely why the
// call worked for months until stage 2 moved it into Node.
//
// The repo has paid for this ceiling once already, in the harness: `postLong`
// in `scripts/build-as-owner.mjs` exists for exactly this reason, and this is
// that pattern with the AbortSignal honoured. `node:https` has NO timeout of
// any kind unless one is asked for; the signal (the composed build budget) is
// the one bound, and its `reason` is what a rejection carries — a TimeoutError,
// so `retryHere` upstream still refuses to bill a second call for a timeout
// instead of misreading it as a request that never went out.
//
// Answers the subset of the Response shape `callBuilderModel` reads: `ok`,
// `status`, `text()`, `json()`. No `accept-encoding` is ever sent, so the body
// arrives identity-encoded and there is nothing to decompress.
export function longPost(url, init) {
  return new Promise((resolveOnce, rejectOnce) => {
    const signal = init && init.signal;
    // EVERY SETTLEMENT DISARMS BOTH WATCHERS, and only a settlement does
    // (2026-10-22, A23-2): the idle timer and the abort listener stay alive
    // until the call has an answer, whichever way it ends.
    let idle = null;
    let onAbort = null;
    const disarm = () => { if (idle) clearTimeout(idle); if (signal && onAbort) signal.removeEventListener("abort", onAbort); };
    const resolve = (v) => { disarm(); resolveOnce(v); };
    const reject = (e) => { disarm(); rejectOnce(e); };
    const onData = init && typeof init.onData === "function" ? init.onData : null;
    const bail = (e) => reject((signal && signal.reason) || e || new Error("aborted"));
    if (signal && signal.aborted) return bail();
    const u = new URL(url);
    const payload = Buffer.from(String((init && init.body) || ""), "utf8");
    let settled = false;
    // WHAT THE WIRE DID BEFORE IT DIED — when the headers arrived and how many
    // body characters had flowed — attached to a socket error, so the failure
    // log can place a death BEFORE the stream opened (a quiet-connection kill)
    // or AFTER bytes were moving (a total-lifetime cap, which streaming cannot
    // beat and the next fix would have to). Run 44's `socket hang up` at 270s
    // could not say which, and the difference is the whole next decision.
    const t0 = Date.now();
    const wire = { headersMs: -1, chars: 0 };
    // A CONNECTION GONE SILENT (2026-10-18): with `init.idleMs`, no byte for
    // that long — before the answer begins or between its chunks — stops the
    // call as an `IdleTimeoutError`, which the caller asks again. Restarted by
    // every byte, so a generation that keeps writing is never stopped by it.
    const idleMs = Number.isFinite(init && init.idleMs) && init.idleMs > 0 ? init.idleMs : 0;
    const quiet = () => {
      if (!idleMs || settled) return;
      if (idle) clearTimeout(idle);
      idle = setTimeout(() => {
        if (settled) return;
        settled = true;
        req.destroy();
        const e = new Error("the model sent nothing for " + Math.round(idleMs / 1000) + "s");
        try { Object.defineProperty(e, "name", { value: "IdleTimeoutError", configurable: true }); } catch { /* keep Error */ }
        e.wire = wire;
        reject(e);
      }, idleMs);
      if (idle && typeof idle.unref === "function") idle.unref();
    };
    // Protocol-faithful, so the harness can drive this against a plain local
    // server. Both provider endpoints are https literals in build-call.mjs —
    // no caller-chosen URL ever reaches here.
    const req = (u.protocol === "http:" ? http : https).request({
      // The port travels too — dropped, a URL naming one dials the protocol
      // default instead, which the driven test caught on its first run.
      hostname: u.hostname, port: u.port || undefined, path: u.pathname + u.search, method: (init && init.method) || "POST",
      headers: { ...((init && init.headers) || {}), "content-length": payload.length },
    }, (res) => {
      wire.headersMs = Date.now() - t0;
      quiet();
      let text = "";
      res.setEncoding("utf8");
      // `init.onData` IS WHERE "SHOW THE CODE AS IT IS WRITTEN" BEGINS. This is
      // the only place in the system that sees a generation's bytes while they
      // are still arriving: everything above it awaits the finished call, and
      // the Worker is not even on the connection. It is handed the whole answer
      // so far rather than the chunk, because the reader upstream re-reads a
      // transcript and has no use for a fragment; and it is fenced, because a
      // throw here is an unhandled rejection on the socket carrying the build.
      res.on("data", (c) => {
        quiet();
        text += c;
        wire.chars += c.length;
        if (onData) { try { onData(text); } catch { /* the view never costs the build */ } }
      });
      res.on("end", () => {
        if (idle) clearTimeout(idle);
        if (settled) return;
        settled = true;
        const status = res.statusCode || 0;
        resolve({ ok: status >= 200 && status < 300, status, text: async () => text, json: async () => JSON.parse(text) });
      });
      // A CONNECTION CUT AFTER THE HEADERS (2026-10-22, the builder audit's
      // A23-2). A peer that closes cleanly mid-body emits no `end` and no
      // request `error`, only these: without them the call never settled, the
      // signal could no longer reach it, and the site's container waited
      // behind it for about an hour. Rejected as a `ConnectionCutError`
      // carrying the wire, so the failure log reads it as a cut with bytes.
      const cut = (why) => {
        if (settled || res.complete) return;
        settled = true;
        if (idle) clearTimeout(idle);
        req.destroy();
        const e = new Error("the connection closed before the answer ended" + (why && why.message ? ": " + why.message : ""));
        try { Object.defineProperty(e, "name", { value: "ConnectionCutError", configurable: true }); } catch { /* keep Error */ }
        e.wire = wire;
        reject(e);
      };
      res.on("aborted", () => cut());
      res.on("error", (e) => cut(e));
      res.on("close", () => cut());
    });
    // The flow is QUIET for the whole generation — no bytes move while the
    // provider thinks — and a quiet flow is what NAT and egress state timeouts
    // drop. Keepalives every 30s hold that state open; fetch could never ask
    // for this, node:https can.
    req.on("socket", (s) => { try { s.setKeepAlive(true, 30000); } catch { /* diagnostic comfort only */ } });
    onAbort = () => { if (settled) return; settled = true; req.destroy(); bail(); };
    if (signal) signal.addEventListener("abort", onAbort, { once: true });
    req.on("error", (e) => { if (settled) return; settled = true; try { e.wire = wire; } catch { /* a frozen error still rejects */ } reject(e); });
    // THE REQUEST'S `close` NO LONGER DISARMS ANYTHING: it fires while the
    // response may still be open, and clearing the idle timer and the abort
    // listener there is what left a cut answer unreachable. They go when the
    // call settles, whichever way.
    req.write(payload);
    quiet();
    req.end();
  });
}

/**
 * THE SAME TRANSPORT, ANSWERING A REAL `Response` (2026-10-22, audit finding 40).
 *
 * `longPost` answers the four things a model call reads. A hop from a job to
 * the build service next door (`containers-shim.mjs`: the compile `/build`,
 * the synchronous `/model`, `/model/start` and its polls) is read by
 * `worker.js` as a whole `Response` (`status`, `ok`, `headers`, `text()`,
 * `json()`, a body stream), so this hands back exactly that, built over
 * `node:http`, with NO headers timeout and no body timeout. The caller's
 * `AbortSignal` is the one bound, and its `reason` is what a rejection
 * carries, as `longPost`'s does.
 *
 * Why it exists: inside a job the shim called Node's global fetch (undici),
 * whose 300-second headers timeout fires before any signal set longer. The
 * build service answers `/build` and `/model` only when the whole compile or
 * generation is done, so a compile over 300 s inside a job died as
 * `TypeError: fetch failed`: the wall `longPost` was written for, on the one
 * hop it did not cover.
 */
export function longFetch(url, init = {}) {
  return new Promise((resolve, reject) => {
    const signal = init.signal || null;
    const bail = () => reject((signal && signal.reason) || new Error("aborted"));
    if (signal && signal.aborted) return bail();
    const u = new URL(url);
    const method = String(init.method || "GET").toUpperCase();
    const body = init.body == null ? null : Buffer.from(init.body);
    const headers = {};
    for (const [k, v] of new Headers(init.headers || {})) headers[k] = v;
    if (body) headers["content-length"] = String(body.length);
    let settled = false;
    const req = (u.protocol === "https:" ? https : http).request({
      hostname: u.hostname, port: u.port || undefined, path: u.pathname + u.search, method, headers,
    }, (res) => {
      if (settled) { res.destroy(); return; }
      settled = true;
      const out = new Headers();
      for (const [k, v] of Object.entries(res.headers)) {
        if (Array.isArray(v)) for (const x of v) out.append(k, x); else if (v != null) out.set(k, String(v));
      }
      const status = res.statusCode || 0;
      const empty = status === 204 || status === 304 || method === "HEAD";
      if (empty) { res.resume(); resolve(new Response(null, { status, statusText: res.statusMessage || "", headers: out })); return; }
      const stream = new ReadableStream({
        start(ctrl) {
          res.on("data", (c) => ctrl.enqueue(new Uint8Array(c)));
          res.on("end", () => { try { ctrl.close(); } catch { /* already closed */ } });
          res.on("error", (e) => { try { ctrl.error((signal && signal.aborted && signal.reason) || e); } catch { /* already errored */ } });
        },
        cancel() { res.destroy(); },
      });
      resolve(new Response(stream, { status, statusText: res.statusMessage || "", headers: out }));
    });
    // A quiet connection for the length of a compile: keepalives hold NAT and
    // egress state open, as `longPost` does.
    req.on("socket", (s) => { try { s.setKeepAlive(true, 30000); } catch { /* comfort only */ } });
    const onAbort = () => { if (!settled) { settled = true; bail(); } req.destroy(); };
    if (signal) signal.addEventListener("abort", onAbort, { once: true });
    req.on("error", (e) => { if (settled) return; settled = true; reject(e); });
    req.on("close", () => { if (signal) signal.removeEventListener("abort", onAbort); });
    if (body) req.write(body);
    req.end();
  });
}

