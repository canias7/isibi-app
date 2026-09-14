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
  return new Promise((resolve, reject) => {
    const signal = init && init.signal;
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
        text += c;
        wire.chars += c.length;
        if (onData) { try { onData(text); } catch { /* the view never costs the build */ } }
      });
      res.on("end", () => {
        if (settled) return;
        settled = true;
        const status = res.statusCode || 0;
        resolve({ ok: status >= 200 && status < 300, status, text: async () => text, json: async () => JSON.parse(text) });
      });
    });
    // The flow is QUIET for the whole generation — no bytes move while the
    // provider thinks — and a quiet flow is what NAT and egress state timeouts
    // drop. Keepalives every 30s hold that state open; fetch could never ask
    // for this, node:https can.
    req.on("socket", (s) => { try { s.setKeepAlive(true, 30000); } catch { /* diagnostic comfort only */ } });
    const onAbort = () => { if (settled) return; settled = true; req.destroy(); bail(); };
    if (signal) signal.addEventListener("abort", onAbort, { once: true });
    req.on("error", (e) => { if (settled) return; settled = true; try { e.wire = wire; } catch { /* a frozen error still rejects */ } reject(e); });
    req.on("close", () => { if (signal) signal.removeEventListener("abort", onAbort); });
    req.write(payload);
    req.end();
  });
}

