// A CONNECTOR'S QUESTION FOR THE OWNER, ON CODER'S WORKER (MCP elicitation, X1 of the recheck of 2026-11-14; the owner: "yes
// pls all of that"; the rest is in container/coder-elicit.mjs).
//
// Coder's Worker holds each connector call's MCP conversation (src/coder-mcp.mjs). When the server asks during a tool call
// (its `elicitation/create` on the call's answer stream, or on an older server's SSE stream), the request is checked as
// Claude Code's MCP client checks one, then:
//   - when the job can ask the owner (Coder's own chats: the machine asked for the call as a stream), the question goes down
//     that stream; the call's idle timer is still while it waits (Claude Code: no idle limit while a question is open, the
//     timer starting again when it closes); the machine's answer comes back with its job's pass (POST /api/coder/mcp
//     { answer }), kept a moment in the chat's storage for the call to pick up; then the server gets it;
//   - otherwise (Gloopy's calls, a connector's tools, prompts or resources read for the page, a request during `initialize`):
//     cancel, as Claude Code answers when no one can be asked.
// A server that cancels its own request (`notifications/cancelled`, which an MCP SDK server sends when its request times out)
// withdraws the card and gets no answer, as in Claude Code; a question still open when the call ends is withdrawn too, and
// the server told cancel.
import { checkElicitRequest, elicitReply, ELICIT_CAP, METHOD_NOT_FOUND, EID, ELICIT_EVENT_MAX, timedOutText } from "../container/coder-elicit.mjs";

/** How often a call waiting on the owner looks for the machine's answer. */
export const ELICIT_POLL_MS = 1000;
/** A line the Worker sends down a call's stream this often, so nothing between it and the machine takes it for dead. */
export const STREAM_BEAT_MS = 25_000;
/** Where the machine's answer waits for its call: beside the chat's other files. */
export const elicitKey = (uid, id, eid) => "coder/" + uid + "/" + id + "/elicit/" + eid + ".json";

const newEid = () => { const b = crypto.getRandomValues(new Uint8Array(24)); let s = "e"; for (const x of b) s += "abcdefghijklmnopqrstuvwxyz0123456789"[x % 36]; return s; };
const rpcKey = (rid) => typeof rid + ":" + String(rid);

/**
 * ONE MCP REQUEST'S OTHER DIRECTION: what the server sends that is not the answer awaited. `ask` ({ send(line), wait(eid,
 * signal) }): the job's stream and its answers, or null when no one can be asked. `server` and `tool`: the connector's name
 * and the tool's, for Claude Code's words when the call runs out of time while the question waits.
 *   message(m, ctx)  one message (ctx: { during: the request's method, reply(msg), hold(), release() }): a request is answered
 *                    (ping: {}; elicitation/create: checked, then asked or cancelled; anything else: "Method not found", as
 *                    the MCP SDK's client answers one it has no handler for), a notice read
 *   open()           how many questions wait now
 *   end(ctx)         the request is over: a question still open is withdrawn and the server told cancel
 */
export function serverTalk({ ask = null, server = "", tool = "", cap = ELICIT_CAP, makeId = newEid } = {}) {
  const open = new Map();
  const withdraw = (e) => { if (e.ctl.signal.aborted) return; e.ctl.abort(); if (ask) Promise.resolve(ask.send({ t: "withdraw", id: e.eid })).catch(() => {}); };
  async function handle(m, ctx) {
    if (!m || typeof m !== "object" || typeof m.method !== "string") return;
    const isRequest = typeof m.id === "string" || typeof m.id === "number";
    if (!isRequest) {
      // (A server cancelling its own question: Claude Code's client stops the dialog and sends no answer.)
      if (m.method === "notifications/cancelled" && m.params && typeof m.params === "object") {
        const k = rpcKey(m.params.requestId), e = open.get(k);
        if (e) { open.delete(k); withdraw(e); }
      } else if (m.method === "notifications/elicitation/complete" && ask && m.params && typeof m.params.elicitationId === "string") {
        await ask.send({ t: "complete", elicitationId: m.params.elicitationId.slice(0, 200) });
      }
      return;
    }
    const answer = (x) => ctx.reply({ jsonrpc: "2.0", id: m.id, ...x });
    if (m.method === "ping") return answer({ result: {} });
    if (m.method !== "elicitation/create") return answer({ error: { code: METHOD_NOT_FOUND, message: "Method not found" } });
    const chk = checkElicitRequest(m.params, cap);
    if (chk.error) return answer({ error: chk.error });
    // (No one to ask: Claude Code's "Elicitation request received during initialization" and its hosts that answer none.)
    if (!ask || ctx.during !== "tools/call") return answer({ result: { action: "cancel" } });
    const p = chk.params, mode = chk.mode;
    const q = { t: "elicit", id: makeId(), server, tool, mode, message: p.message, ...(mode === "form" ? { requestedSchema: p.requestedSchema, order: Object.keys(p.requestedSchema.properties) } : { url: p.url, elicitationId: p.elicitationId }) };
    if (JSON.stringify(q).length > ELICIT_EVENT_MAX) return answer({ result: { action: "cancel" } });
    const e = { eid: q.id, rid: m.id, ctl: new AbortController() };
    const k = rpcKey(m.id);
    open.set(k, e);
    ctx.hold();
    let got = null;
    try {
      await ask.send(q);
      got = e.ctl.signal.aborted ? null : await ask.wait(e.eid, e.ctl.signal);
    } finally { if (open.get(k) === e) open.delete(k); ctx.release(); }
    if (!got || e.ctl.signal.aborted) return;
    return answer(got.error ? { error: got.error } : { result: got.result });
  }
  return {
    message: (m, ctx) => handle(m, ctx).catch(() => {}),
    open: () => open.size,
    timedOut: (ms) => timedOutText(server, tool, ms),
    end(ctx) {
      for (const [k, e] of [...open]) {
        open.delete(k);
        withdraw(e);
        if (ctx && typeof ctx.reply === "function") Promise.resolve(ctx.reply({ jsonrpc: "2.0", id: e.rid, result: { action: "cancel" } })).catch(() => {});
      }
    },
  };
}

/** The machine's answer to question `key`, once it is there (taken out of storage), or null when `signal` ends the wait first. */
export async function pollAnswer(bucket, key, signal, { every = ELICIT_POLL_MS } = {}) {
  const nap = (ms) => new Promise((ok) => { const t = setTimeout(ok, ms); if (signal) signal.addEventListener("abort", () => { clearTimeout(t); ok(); }, { once: true }); });
  for (;;) {
    if (signal && signal.aborted) return null;
    let o = null;
    try { o = await bucket.get(key); } catch { o = null; }
    if (o) {
      let v = null;
      try { v = JSON.parse(await o.text()); } catch { v = null; }
      try { await bucket.delete(key); } catch { /* left to be overwritten */ }
      if (v && (v.result || v.error)) return v;
    }
    await nap(every);
  }
}

/**
 * THE MACHINE'S ANSWER TO A QUESTION (POST /api/coder/mcp { answer: { id, result } | { id, error } }, its job's pass checked
 * by handleMcp): checked again as Claude Code's client checks one, and kept for its call. → { ok } or { error }.
 */
export async function keepAnswer(bucket, uid, id, a) {
  if (!a || typeof a !== "object" || !EID.test(String(a.id || ""))) return { error: "that answer could not be read" };
  if (JSON.stringify(a).length > 300_000) return { error: "that answer is too large" };
  let v;
  if (a.error && typeof a.error === "object") {
    if (!Number.isInteger(a.error.code) || typeof a.error.message !== "string") return { error: "that answer could not be read" };
    v = { error: { code: a.error.code, message: a.error.message.slice(0, 500) } };
  } else v = elicitReply(a.result);
  await bucket.put(elicitKey(uid, id, a.id), JSON.stringify(v), { httpMetadata: { contentType: "application/json" } });
  return { ok: true };
}

/**
 * A CONNECTOR CALL AS A STREAM FOR THE MACHINE (one JSON object a line): `run(send)` makes the call, sending its questions as
 * they come; its answer is the last line, `{ t: "result", text, isError, images? }`. A `{ t: "wait" }` line goes every
 * STREAM_BEAT_MS meanwhile.
 */
export function streamedCall(run, { beatMs = STREAM_BEAT_MS } = {}) {
  const { readable, writable } = new TransformStream();
  const w = writable.getWriter(), enc = new TextEncoder();
  let live = true;
  const send = async (o) => { if (!live) return; try { await w.write(enc.encode(JSON.stringify(o) + "\n")); } catch { live = false; } };
  const beat = setInterval(() => { send({ t: "wait" }); }, beatMs);
  (async () => {
    let r;
    try { r = await run(send); } catch (e) { r = { text: "error: " + String((e && e.message) || e).slice(0, 300), isError: true }; }
    clearInterval(beat);
    await send({ t: "result", ...r });
    live = false;
    try { await w.close(); } catch { /* the machine went away */ }
  })();
  return new Response(readable, { status: 200, headers: { "content-type": "application/x-ndjson", "cache-control": "no-store" } });
}
