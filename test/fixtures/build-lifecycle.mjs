// THE BUILD JOB'S REAL LIFECYCLE, DRIVEN OFFLINE (2026-10-08, Codex's review
// of `deb1fee5`). Shared by the delivery and content tests:
//
//   fireInterim   the producer's envelope (`packJob`) consumed by the real
//                 queue consumer, which designs (a supplied design answer),
//                 fires the generation at a container stand-in that accepts
//                 it, and stores its real 202 `stage: "resuming"` answer
//   finishResume  the real resume (`RESUME_KIND`) with a finished generation
//                 stored: it writes the build's own final answer
//   ledger        `credit_reverse` as the applied SQL answers it — a
//                 stand-in, NOT a database
//
// Only the network is faked (GoTrue, the ledger RPCs, Anthropic, the
// container); R2 is `buildBucket`.

import { BUILD_USER, GOOD_DESIGN, BRIEF } from "./build-route.mjs";
import { loadWorker, makeCtx } from "./worker-harness.mjs";
import { installCompiler, dispatchEnv, isDispatchUpload, dispatchOk } from "./cf-containers.mjs";
import { jobKey, packJob, JOB_KIND } from "../../builder/build-job.mjs";
import { resumeKey, genKey, RESUME_KIND } from "../../builder/build-resume.mjs";

const SLUG = GOOD_DESIGN.slug;
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });

/** credit_reverse as the applied SQL answers it, shared by the build and recovery: per ref, never more than the debit in all. */
export function ledger() {
  const given = new Map();
  const seenReason = new Map();
  const calls = [];
  return {
    calls,
    given,
    total: () => [...given.values()].reduce((a, b) => a + b, 0),
    answer(a) {
      calls.push(a.p_ref + "|" + a.p_reason);
      const before = given.get(a.p_ref) || 0;
      const key = a.p_ref + "|" + a.p_reason;
      if (seenReason.has(key)) return { ok: true, refunded: 0, debited: 2, already: before, repeat: true };
      seenReason.set(key, true);
      const asked = Number(a.p_amount);
      const now = Math.max(0, Math.min(Number.isFinite(asked) && asked > 0 ? asked : 2, 2 - before));
      given.set(a.p_ref, before + now);
      return { ok: true, refunded: now, already: before, debited: 2, repeat: false };
    },
  };
}

const container = { idFromName: (n) => n, get: () => ({ fetch: async () => json({ ok: true, id: "gen-1" }) }) };
const queue = () => ({ sent: [], async send(m) { this.sent.push(m); }, async sendBatch() { throw new Error("no batch"); } });

/** THE REAL CONSUMER, run to its end: it designs, fires the generation and stores its real 202. Nobody collects it (the browser is closed). */
/**
 * A linked page answered by the stand-in network: `links` maps a hostname to
 * the text its page carries.
 */
function linkAnswer(links, u) {
  let host = "";
  try { host = new URL(u).hostname; } catch { return null; }
  if (!links || !Object.hasOwn(links, host)) return null;
  return new Response("<html><head><title>" + host + "</title></head><body><p>" + links[host] + "</p></body></html>", { status: 200, headers: { "content-type": "text/html" } });
}

/**
 * THE REPLY WRITER, STOOD IN FOR (never a paid call). With `reply` a string,
 * it answers the forced `write_reply` tool covering every fact id it was
 * sent; otherwise the provider is down (503). Every request is recorded in
 * `seen` so a case can read what the writer was told.
 */
function replyAnswer(reply, seen, init) {
  const bd = JSON.parse(String((init && init.body) || "{}"));
  if (!(bd.tool_choice && bd.tool_choice.name === "write_reply")) return null;
  const text = JSON.stringify(bd.messages || "");
  seen.push(text);
  if (typeof reply !== "string") return new Response("provider down", { status: 503 });
  const ids = [...text.matchAll(/\[([a-z0-9-]+)\]/g)].map((m) => m[1]);
  return json({ stop_reason: "tool_use", usage: { input_tokens: 10, output_tokens: 10 }, content: [{ type: "tool_use", id: "r1", name: "write_reply", input: { reply, covers: [...new Set(ids)] } }] });
}

export async function fireInterim(b, id, led, { design = GOOD_DESIGN, brief = BRIEF, links = null } = {}) {
  b.store.set(jobKey(id), JSON.stringify(packJob({ url: "https://gofarther.dev/api/site/react-build", auth: "Bearer t", body: JSON.stringify({ brief, images: [], qa: [], chat: "c", picker: "sonnet" }), uid: BUILD_USER.id, at: 1 })));
  let claimedSite = false;
  const real = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const u = String((input && input.url) || input || "");
    if (u.includes("/auth/v1/user")) return json(BUILD_USER);
    const m = u.match(/\/rest\/v1\/rpc\/(\w+)/);
    if (m) {
      const args = JSON.parse(String((init && init.body) || "{}"));
      if (m[1] === "edit_claim") return json({ ok: true, claimed: true, state: "claimed", billing: "external", uid: BUILD_USER.id, slug: "build:x", needs_review: false });
      if (m[1] === "build_debit") return json({ ok: true, taken: 2, balance: 400, repeat: false });
      if (m[1] === "credit_reverse") return json(led.answer(args));
      if (m[1] === "get_credits") return json(400);
      if (m[1] === "use_quota") return json(true);
      return json({ ok: true });
    }
    if (u.includes("/rest/v1/site_backends")) {
      if (String((init && init.method) || "GET").toUpperCase() === "POST") { claimedSite = true; return json([{ slug: "x", uid: BUILD_USER.id }], 201); }
      return json(claimedSite ? [{ uid: BUILD_USER.id, neon_db: "", brief: BRIEF }] : []);
    }
    if (u.includes("/v1/messages")) {
      const bd = JSON.parse(String((init && init.body) || "{}"));
      // `design: null` — a designer that answered no plan, so the build ends
      // before it fires, on its own terminal answer.
      if (bd.tool_choice && bd.tool_choice.name === "design_schema") {
        if (design === null) return json({ stop_reason: "end_turn", content: [{ type: "text", text: "Here is a design." }], usage: { input_tokens: 100, output_tokens: 50 } });
        return json({ stop_reason: "tool_use", content: [{ type: "tool_use", id: "t1", name: "design_schema", input: design }], usage: { input_tokens: 100, output_tokens: 50 } });
      }
      return new Response("stop", { status: 503 });
    }
    { const l = linkAnswer(links, u); if (l) return l; }
    if (u.includes("/rest/v1/")) return json([]);
    return new Response("no", { status: 503 });
  };
  const q = queue();
  try {
    const worker = await loadWorker();
    const ctx = makeCtx();
    await worker.queue({ messages: [{ body: { kind: JOB_KIND, id }, ack() {}, retry() {} }] }, { SUPABASE_SERVICE_KEY: "svc", CREDITS_MINT_SECRET: "m", ANTHROPIC_API_KEY: "k", XAI_API_KEY: "k", NEON_API_KEY: "k", SITES_BUCKET: b, SITE_BUILD_CONTAINER: container, BUILD_QUEUE: q }, ctx);
    await Promise.allSettled(ctx.pending);
  } finally { globalThis.fetch = real; }
  return q;
}

/** THE REAL RESUME of that build, finishing with a stored generation: it writes the build's own final answer. */
export async function finishResume(b, id, led, { credits = null, source = null, reply = undefined, env: extraEnv = {}, seen = [] } = {}) {
  const rec = JSON.parse(b.store.get(resumeKey(id)));
  // THE GENERATION'S ANSWER: the plain shape the collector has always taken
  // (no page it can use — the build ends on its own refusal), or, with a
  // `source`, the page writer's real tool answer, so the build publishes.
  const answer = source == null
    ? { pages: [{ path: "index.tsx", source: "export default function I(){return null}" }] }
    : { stop_reason: "tool_use", usage: { input_tokens: 10, output_tokens: 10 }, content: [{ type: "tool_use", id: "w1", name: "write_pages", input: { pages: [{ path: "index.tsx", source }], notes: "" } }] };
  b.store.set(genKey(rec.report), JSON.stringify({ state: "done", answer }));
  const real = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const u = String((input && input.url) || input || "");
    if (u.includes("/auth/v1/user")) return json(BUILD_USER);
    const m = u.match(/\/rest\/v1\/rpc\/(\w+)/);
    if (m) {
      const args = JSON.parse(String((init && init.body) || "{}"));
      if (m[1] === "edit_claim") return json({ ok: true, claimed: true, job: { id, uid: BUILD_USER.id, slug: SLUG } });
      if (m[1] === "edit_handoff") return json({ ok: true, uid: BUILD_USER.id, slug: SLUG });
      if (m[1] === "credit_reverse") return json(led.answer(args));
      if (credits != null && m[1] === "get_credits") return json(credits);
      if (credits != null && (m[1] === "use_credits" || m[1] === "credit_debit")) return json({ ok: true, taken: Number(args.p_amount) || 0, balance: credits, repeat: false });
      return json({ ok: true });
    }
    if (u.includes("/v1/messages")) { const r = replyAnswer(reply, seen, init); if (r) return r; }
    if (isDispatchUpload(u)) return dispatchOk();
    if (u.includes("/rest/v1/")) return json([]);
    return new Response("no", { status: 503 });
  };
  const c = installCompiler({ worker: true });
  try {
    const worker = await loadWorker();
    const ctx = makeCtx();
    await worker.queue({ messages: [{ body: { kind: RESUME_KIND, id }, ack() {}, retry() {} }] }, { SUPABASE_SERVICE_KEY: "svc", CREDITS_MINT_SECRET: "m", ...dispatchEnv(), SITES_BUCKET: b, SITE_BUILD_CONTAINER: {}, BUILD_QUEUE: queue(), ...extraEnv }, ctx);
    await Promise.allSettled(ctx.pending);
  } finally { globalThis.fetch = real; c.uninstall(); }
}

