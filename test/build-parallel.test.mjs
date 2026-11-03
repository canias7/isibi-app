// A FIRST BUILD'S INDEPENDENT WORK, RUN TOGETHER (2026-10-09, round 3).
//
// The owner asked for the missing Build capability itself, not the existing
// design graph counted as it: identify independent work inside a first build,
// run it at once where its inputs are there, wait for real dependencies, keep
// results across retries, and assemble and check the whole before it is
// published — with the existing jobs, dependency machinery and recovery, and
// the 1-page / 15-component limits unchanged.
//
// WHAT IS NEW, AND WHAT WAS THERE:
//   * existing: the design graph runs its agents concurrently by their needs
//     (P8 in test/parallel-requests.test.mjs; unchanged here);
//   * new: the photographs the design describes are a task of their own. They
//     need only the design, so they are bought BESIDE the page generation
//     instead of after it, each as the build's logical purchase (one record,
//     durable across a resume or a retry). The image step joins them: a token
//     whose purchase is in flight waits for it, one bought is reused, one the
//     writer changed is bought then. Nothing is handed on — to the resume, the
//     reply, the refund — while a purchase it began is in flight.
//
// Through the real queue consumer (design → fire → 202) and the real resume
// (images → compile → publish), with the network stood in for: the image
// service (`fal.run`, `img.test`), the container, GoTrue and the ledger.
import test from "node:test";
import assert from "node:assert/strict";
import { buildBucket, GOOD_DESIGN, BRIEF, JPEG_DATA } from "./fixtures/build-route.mjs";
import { ledger, fireInterim, finishResume } from "./fixtures/build-lifecycle.mjs";
import { resultKey, readResult } from "../builder/build-job.mjs";
import { resumeKey } from "../builder/build-resume.mjs";
import { buildReplyFacts } from "../builder/site-reply.mjs";
import { blockNetwork, unexpected, clearUnexpected, blockedFetch, noteUnexpected } from "./fixtures/no-network.mjs";
import { BUILD_USER } from "./fixtures/build-route.mjs";
import { loadWorker, loadWorkerModule, makeCtx } from "./fixtures/worker-harness.mjs";
import { progressKey } from "../builder/site-progress.mjs";
import { replayLines, afterNotMade } from "./fixtures/progress-replay.mjs";

blockNetwork();

const SLUG = GOOD_DESIGN.slug;
let seq = 0;
const newId = () => (++seq).toString(16).padStart(3, "0") + "b8c3d4e5f60718293a4b5c6d7e8f9";
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));
const JPEG = Uint8Array.from(Buffer.from(JPEG_DATA.split(",")[1], "base64"));

// A REALISTIC FIRST-BUILD REQUEST WITH SEVERAL REQUIREMENTS: four pictures the
// design names, opening hours, an order line, and the address.
const BRIEF_MANY = "Harbour Loaf, a bakery on Wharf Street in Leeds. We want a page with a photo of a loaf at dawn, our shop front, hands shaping dough and the window counter; our opening hours (Tue–Sat 7–2); a way to order loaves for Saturday collection; and our address.";
const PICS = ["a loaf at dawn", "the shop front on a wet morning", "hands shaping dough", "the window counter with bread stacked high"];
const DESIGN = Object.freeze({ ...GOOD_DESIGN, images: PICS.map((describe) => ({ page: "/", describe })) });
const pageOf = (tokens) => routeSrc(
  tokens.map((d) => '<img src="@@IMG:' + d + '@@" alt="' + d + '" />').join("") +
  "<section><h2>Opening hours</h2><p>Tue–Sat 7–2</p></section><section><h2>Order for Saturday</h2><p>Order loaves for Saturday collection.</p></section><section><h2>Find us</h2><p>Wharf Street, Leeds</p></section>");
function routeSrc(body) {
  return "import { createFileRoute } from '@tanstack/react-router';\nexport const Route = createFileRoute('/')({ component: Page });\nfunction Page() { return (<main>" + body + "</main>); }\n";
}

/** The image service, stood in for: every purchase logged with when it began and ended; `hold(i)` may delay one; `refuse` answers every one as an empty balance does (403). */
function images({ hold = null, refuse = false, lost = false } = {}) {
  const log = [];
  return {
    log,
    open: () => log.filter((e) => e.end == null).length,
    over: async (u, init) => {
      if (u.startsWith("https://fal.run/")) {
        let prompt = "";
        try { prompt = JSON.parse(String((init && init.body) || "{}")).prompt || ""; } catch { prompt = ""; }
        const e = { prompt, at: Date.now(), end: null, i: log.length };
        log.push(e);
        if (hold) await hold(e);
        e.end = Date.now();
        if (refuse) return json({ detail: "User is locked. Reason: Exhausted balance." }, 403);
        if (lost) throw new TypeError("connection reset");
        return json({ images: [{ url: "https://img.test/p" + (e.i + 1) + ".jpg" }] });
      }
      if (u.startsWith("https://img.test/")) {
        const n = Number((u.match(/\/p(\d+)\.jpg/) || [])[1]) || 0;
        const bytes = new Uint8Array(JPEG.length + 2);
        bytes.set(JPEG); bytes.set([n & 255, 0x41], JPEG.length);
        return new Response(bytes, { status: 200, headers: { "content-type": "image/jpeg" } });
      }
      return null;
    },
  };
}
const uploads = (b) => [...b.store.keys()].filter((k) => k.startsWith("uploads/" + SLUG + "/"));
const purchases = (b, id) => [...b.store.entries()].filter(([k]) => k.startsWith("source/" + SLUG + "/purchases/build-" + id + "/")).map(([, v]) => JSON.parse(v));
const answerOf = (b, id) => { const raw = b.store.get(resultKey(id)); if (!raw) return null; const r = readResult(JSON.parse(raw)); return { status: r.status, body: JSON.parse(r.body) }; };
const published = (b) => { const raw = b.store.get("source/" + SLUG + "/pages.json"); return raw ? JSON.parse(raw).map((p) => p.source).join("\n") : ""; };
const urlsIn = (src) => [...src.matchAll(/\/u\/[a-z0-9-]+\/[a-z0-9]+\.jpg/g)].map((m) => m[0]);
const promptOf = (d) => new RegExp("^" + d.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

/** Every upload write to ONE photograph's key fails `times` times (the first upload key written takes them all). */
function failStoreOf(b, times) {
  const put0 = b.put.bind(b);
  let target = null;
  const seen = { failed: 0 };
  b.put = async (k, ...rest) => {
    if (k.startsWith("uploads/" + SLUG + "/") && (target === null || target === k) && seen.failed < times) { target = k; seen.failed++; throw new Error("r2 unavailable"); }
    return put0(k, ...rest);
  };
  return seen;
}

// ── THE BUILD'S LIVE LINES (round 5) ────────────────────────────────────────
//
// The progress writer and the job row, stood in for: the row names the run the
// record holds as its lease (the build still running), and the writer answers
// each fact as given, so a case reads which facts a line covered — the facts
// are the build's; the wording would be a model's.
function progressStand(b, id) {
  const written = [];
  const recOf = () => { const raw = b.store.get(progressKey(id)); return raw ? JSON.parse(raw) : null; };
  const over = async (u, init) => {
    if (u.includes("/rest/v1/edit_jobs?select=id,uid,state,lease_owner")) {
      const rec = recOf();
      return json([{ id, uid: BUILD_USER.id, state: "running", lease_owner: rec ? rec.run : "none", lease_expires_at: new Date(Date.now() + 60000).toISOString(), cancel_requested_at: null, needs_review: false, op: "build" }]);
    }
    // EITHER PROVIDER'S WIRE: the writer is the picked model's quick one.
    const anthropic = u.includes("/v1/messages");
    if (anthropic || u.includes("/v1/chat/completions")) {
      let bd = {};
      try { bd = JSON.parse(String((init && init.body) || "{}")); } catch { bd = {}; }
      const asked = (bd.tool_choice && (bd.tool_choice.name || (bd.tool_choice.function && bd.tool_choice.function.name))) || "";
      // THE CONVERSATIONAL WRITER (2026-10-13) answered the same way, its tool by its own name.
      if (asked === "write_progress" || asked === "write_update") {
        const text = (bd.messages || []).filter((m) => m && m.role === "user").map((m) => (typeof m.content === "string" ? m.content : JSON.stringify(m.content))).join("\n");
        const facts = [...text.matchAll(/^\[(f\d+)\] \(([a-z]+)\) (.*)$/gm)].map((m) => ({ id: m[1], state: m[2], text: m[3] }));
        written.push(facts);
        const input = { text: "MODEL: " + facts.map((f) => f.text).join(" "), says: facts.map((f) => ({ id: f.id, as: f.state })) };
        return json(anthropic
          ? { stop_reason: "tool_use", usage: { input_tokens: 10, output_tokens: 10 }, content: [{ type: "tool_use", id: "p1", name: asked, input }] }
          : { choices: [{ message: { content: "", tool_calls: [{ id: "c1", function: { name: asked, arguments: JSON.stringify(input) } }] }, finish_reason: "stop" }], usage: { prompt_tokens: 10, completion_tokens: 10 } });
      }
    }
    return null;
  };
  return { written, recOf, over };
}
const taskQueue = () => ({ sent: [], async send(m) { this.sent.push(m); }, async sendBatch() { throw new Error("no batch"); } });
const PROGRESS_ENV = { PROGRESS_REPLIES: "on", SUPABASE_SERVICE_KEY: "svc", CREDITS_MINT_SECRET: "m", ANTHROPIC_API_KEY: "k", XAI_API_KEY: "k" };
/** Every progress task the build queued, delivered through the real consumer until none is left — the browser plays no part. */
async function deliverProgress(b, q, stand, { install = true, env = {} } = {}) {
  for (let round = 0; round < 6; round++) {
    const tasks = q.sent.filter((m) => m && m.kind === "edit-progress");
    q.sent = q.sent.filter((m) => !(m && m.kind === "edit-progress"));
    if (!tasks.length) return;
    // WHILE A BUILD RUN IS STILL GOING (\`install: false\`), its own stand-in
    // answers — it carries this one — and is never swapped out under it.
    const prior = globalThis.fetch;
    if (install) globalThis.fetch = async (input, init) => {
      const u = String((input && input.url) || input || "");
      const r = await stand.over(u, init);
      if (r) return r;
      if (u.includes("/rest/v1/")) return json([]);
      noteUnexpected((init && init.method) || "GET", u, "build-parallel");
      return new Response("no", { status: 503 });
    };
    try {
      const worker = await loadWorker();
      const ctx = makeCtx();
      await worker.queue({ messages: tasks.map((t) => ({ body: t, ack() {}, retry() {} })) }, { ...PROGRESS_ENV, ...env, SITES_BUCKET: b, BUILD_QUEUE: q }, ctx);
      for (let i = 0; i < 8 && ctx.pending.length; i++) await Promise.allSettled(ctx.pending.splice(0));
    } finally { globalThis.fetch = install ? blockedFetch : prior; }
  }
}
async function pollBuild(b, id) {
  globalThis.fetch = async (input) => {
    const u = String((input && input.url) || input || "");
    if (u.includes("/auth/v1/user")) return json(BUILD_USER);
    if (u.includes("/rest/v1/")) return json([]);
    noteUnexpected("GET", u, "build-parallel");
    return new Response("no", { status: 503 });
  };
  try {
    const worker = await loadWorker();
    const res = await worker.fetch(new Request("https://gofarther.dev/api/site/build/" + id, { headers: { Authorization: "Bearer t" } }), { ...PROGRESS_ENV, SITES_BUCKET: b }, makeCtx());
    return { status: res.status, body: await res.json().catch(() => null) };
  } finally { globalThis.fetch = blockedFetch; }
}
const allFacts = (rec) => rec.marks.flatMap((m) => m.facts.map((f) => ({ stage: m.stage, ...f })));
/** NO PREPARATION SAID AS PUBLISHED: a fact naming publication says it is not published yet, or that the check comes before it. */
function noPublishClaim(facts) {
  for (const f of facts) {
    if (!/publish/i.test(f.text)) continue;
    assert.match(f.text, /not published|before it is published/i, "a build fact claims publication: " + f.text);
  }
  assert.ok(!facts.some((f) => f.state === "applied"), "a build fact was stated as applied: " + JSON.stringify(facts));
}

test("NET — no request in this file left the machine", () => {
  assert.deepEqual(unexpected().filter((u) => u.by === "blocked"), []);
});

void BRIEF;
void clearUnexpected;
