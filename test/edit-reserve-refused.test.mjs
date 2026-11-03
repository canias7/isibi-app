// A REFUSED RESERVATION IS NOT A FREE RUNG (2026-09-05).
//
// Found by driving the real queue consumer under fakes, not by reading: a
// queued edit whose `edit_reserve` answered `insufficient` returned 0 from the
// funnel exactly as a rung with no model call does, `reserves()` stayed at
// zero, the spine exempted the job as a free rung, `edit_may_publish` granted
// `exempt`, and the site published for nothing. A second reserve refused after
// the first had landed published too, the translation unpaid. Neither refusal
// reached a log. Reachable at any balance below a bill — which the owner's own
// account, at 5 credits against a 12-to-21-credit addon, was.
//
// So this DRIVES the consumer — `worker.queue` → runQueuedSiteEdit →
// handleRequest → the lanes → the publish spine — with every ledger RPC, the
// model and the compiler faked, and reads what the consumer asked the ledger
// and what it stored as the reply. NOTHING HERE REACHES A MODEL, A DATABASE OR
// R2. The text guards at the end pin the hops a drive cannot reach (the addon
// funnel has no driven harness yet) and the placement the drive relies on.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { randomBytes } from "node:crypto";
import { loadWorker, makeCtx } from "./fixtures/worker-harness.mjs";
import { installCompiler, dispatchEnv, isDispatchUpload, dispatchOk } from "./fixtures/cf-containers.mjs";
import { CONFIG_KEY } from "../site-config.mjs";
import { packEditJob, EDIT_JOB_PREFIX, EDIT_JOB_KIND } from "../builder/edit-job.mjs";
import { collectStrings, TRANSLATE_TOOL } from "../builder/site-translate.mjs";
import { editBrowserReply } from "../scripts/addon-sweep.mjs";

const USER = { id: "u-refused-1", email: "owner@example.com" };
const STORED_CSS = ":root{--background:oklch(100% 0 0)}\nfooter{background-color:#000}";
const STORED_LOOK = { brand: "Paperless", theme: "broadsheet", favicon: "<svg viewBox='0 0 32 32'></svg>" };
// A PAGE WITH WORDS ON IT, so the bilingual case has something to translate.
const HOME = { path: "src/routes/index.tsx", source: "export default function Home(){return <main><h1>Fresh bread every morning</h1><p>Baked before six, gone by ten.</p></main>}" };
// A SECOND PAGE NOTHING LINKS TO, so the page rung may take it away with no
// model call — the free rung of the last case.
const ABOUT = { path: "src/routes/about.tsx", source: "export default function About(){return <main><h1>About us</h1></main>}" };

function bucket(slug, pages) {
  const store = new Map([
    ["source/" + slug + "/pages.json", JSON.stringify(pages)],
    [CONFIG_KEY(slug), JSON.stringify({ look: { ...STORED_LOOK }, css: STORED_CSS })],
  ]);
  const writes = [];
  const obj = (v) => ({ text: async () => v, arrayBuffer: async () => new TextEncoder().encode(v).buffer });
  return {
    store, writes,
    async get(k) { const v = store.get(k); return v === undefined ? null : obj(v); },
    async put(k, v) { writes.push([k, String(v)]); store.set(k, String(v)); },
    async delete(k) { store.delete(k); },
    async list() { return { objects: [], truncated: false }; },
  };
}

const hex32 = () => randomBytes(16).toString("hex");

/**
 * Run ONE queued job through the real consumer.
 *
 * `reserve(seq, cost)` answers each `edit_reserve`; every other ledger RPC
 * answers as a healthy database would. `answers` maps a model tool to its
 * reply, and a tool with no answer is refused — a stub more capable than the
 * real thing hides bugs exactly like one that is less.
 */
async function drive({ slug, pages = [HOME], langs = null, body: bodyExtra = {}, reserve, answers = {}, usage = null }) {
  const id = hex32(), secret = hex32();
  const url = "https://gofarther.dev/api/site/" + slug + "/edit";
  const body = JSON.stringify({ layer: "look", page: "", remove: false, rename: "", tab: false, instruction: "make the footer white", picker: "sonnet", ...bodyExtra });
  const b = bucket(slug, pages);
  b.store.set(CONFIG_KEY(slug), JSON.stringify({ look: { ...STORED_LOOK, ...(langs ? { langs } : {}) }, css: STORED_CSS }));
  b.store.set(EDIT_JOB_PREFIX + id, JSON.stringify(packEditJob({ url, body, uid: USER.id, slug, secret, at: Date.now() })));
  const rpc = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const u = String((input && input.url) || input || "");
    const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
    const m = u.match(/\/rest\/v1\/rpc\/(edit_\w+)/);
    if (m) {
      const fn = m[1];
      let args = {};
      try { args = JSON.parse(String(init && init.body) || "{}"); } catch { args = {}; }
      delete args.p_mint;
      rpc.push({ fn, args });
      switch (fn) {
        case "edit_claim": return json({ ok: true, claimed: true, state: "claimed", billing: "none", uid: USER.id, slug, needs_review: false });
        case "edit_beat": return json({ ok: true, alive: true, state: "routing", cancel: false });
        case "edit_reserve": return json(reserve(Number(args.p_seq), Number(args.p_cost)));
        case "edit_exempt": return json({ ok: true, billing: "exempt", state: "routing" });
        case "edit_may_publish": return json({ ok: true, granted: true });
        case "edit_publish_mark": return json({ ok: true });
        case "edit_committed": return json({ ok: true });
        case "edit_finalize": return json({ ok: true, billing: "finalized", cost: 0, published: true });
        case "edit_refund": return json({ ok: true, refunded: 0, billing: "none" });
        case "edit_phase_write": return json({ ok: true });
        default: return json({ ok: false, error: "no stub for " + fn }, 500);
      }
    }
    if (u.includes("/auth/v1/user")) return json(USER);
    if (u.includes("/rest/v1/site_project")) return json([]);
    if (u.includes("/rest/v1/site_backends")) return json([{ uid: USER.id, brief: "" }]);
    if (u.includes("/v1/messages")) {
      let bj = {};
      try { bj = JSON.parse(String(init && init.body) || "{}"); } catch { bj = {}; }
      const tool = (bj.tool_choice && bj.tool_choice.name) || "";
      if (!Object.hasOwn(answers, tool)) return new Response("no stub for tool " + tool, { status: 503 });
      return json({
        stop_reason: "tool_use",
        content: [{ type: "tool_use", name: tool, input: answers[tool] }],
        usage: (usage && usage[tool]) || { input_tokens: 10, output_tokens: 5 },
      });
    }
    if (isDispatchUpload(u)) return dispatchOk();   // the publish's script upload
    return new Response("unavailable", { status: 503 });
  };
  const c = installCompiler();
  try {
    const worker = await loadWorker();
    const env = { SITES_BUCKET: b, ANTHROPIC_API_KEY: "test-key", XAI_API_KEY: "test-key", SUPABASE_SERVICE_KEY: "svc-test", CREDITS_MINT_SECRET: "mint-test", ...dispatchEnv() };
    const ctx = makeCtx();
    await worker.queue({ messages: [{ body: { kind: EDIT_JOB_KIND, id }, ack() {}, retry() {} }] }, env, ctx);
    await Promise.allSettled(ctx.pending);
    const fin = rpc.find((r) => r.fn === "edit_finalize");
    let reply = null;
    try { reply = fin && fin.args.p_result && JSON.parse(fin.args.p_result.body); } catch { reply = null; }
    return {
      fns: rpc.map((x) => x.fn), rpc, compiles: c.calls.length,
      distWrites: b.writes.filter(([k]) => k.startsWith("sites/")).length,
      finalize: fin ? fin.args : null,
      refund: rpc.find((r) => r.fn === "edit_refund") || null,
      reply,
    };
  } finally { c.uninstall(); globalThis.fetch = real; }
}

const INSUFFICIENT = (s, cost) => ({ ok: false, error: "insufficient", cost: 0, seq: s, asked: cost });
const CSS = { pick_lanes: { fields: ["css"] }, edit_site: { css: "footer{color:#fff}" } };

// ── WHAT THE CUSTOMER READS, IN THE BROWSER'S OWN WORDS (2026-09-25) ────────
//
// Run 36159773928 ("run 31") stopped exactly here: the routing call took 2 of
// a balance of 3, the edit's reserve was refused, and the screen said "…it
// wasn't published and nothing was charged". The server sentence now says
// only what happened; the money is stated by `wholeRequestNote` from what the
// two replies RECORDED. `ROUTED` is run 31's own routing reply, verbatim.
const ROUTED = { ok: true, intent: "edit", layer: "page", page: "/", cost: 2, usage: { in: 6774, out: 19, cacheRead: 512, cacheWrite: 0, model: "grok-4.6" } };
const SHORT = "That didn't go through — there aren't enough credits for it, so it wasn't published. Top up and send it again.";
const DOWN = "That didn't go through — our billing service didn't answer, so it wasn't published. Try again in a moment.";
const EDIT_FREE = " This edit cost you nothing.";
const READING_2 = " Reading your message cost 2 credits.";

/**
 * The stored reply through the real composer (`editAnswer` in public/chat.js),
 * twice: with the routing reply the sending page holds, and as a watch resumed
 * after a refresh holds nothing. Refusal behaviour is part of the assertion —
 * a refusal buys nothing and retries nothing.
 */
function assertScreens(reply, httpOk, lead) {
  const held = editBrowserReply(reply, httpOk, ROUTED);
  assert.equal(held.ok, true, "the browser could not compose a reply: " + held.why);
  assert.equal(held.text, lead + EDIT_FREE + READING_2, "the page that sent the message");
  assert.deepEqual(held.actions, [], "a refusal set paid work in motion: " + JSON.stringify(held.actions));
  const resumed = editBrowserReply(reply, httpOk, undefined);
  assert.equal(resumed.ok, true, "the browser could not compose a reply: " + resumed.why);
  // No routing reply, so no routing amount and no total — and "this edit"
  // stays the subject, never the whole request.
  assert.equal(resumed.text, lead + EDIT_FREE, "a watch resumed after a refresh");
  assert.deepEqual(resumed.actions, []);
  for (const s of [held.text, resumed.text]) {
    assert.doesNotMatch(s, /nothing was charged/i, "the whole request is called free again: " + JSON.stringify(s));
    // "Not published" is not "nothing changed": a rung can write rows before
    // the reserve that refused, so this reply never makes that claim.
    assert.doesNotMatch(s, /Nothing on your site changed/, "a ledger refusal claims nothing changed: " + JSON.stringify(s));
  }
}

/** What a refused job must look like from the ledger's side. */
function assertStopped(r, sentence) {
  assert.ok(r.fns.includes("edit_reserve"), "no reserve was attempted");
  assert.ok(!r.fns.includes("edit_exempt"), "a refused job was exempted as a free rung: " + JSON.stringify(r.fns));
  assert.ok(!r.fns.includes("edit_may_publish"), "the gate was asked for a job the ledger refused: " + JSON.stringify(r.fns));
  assert.ok(!r.fns.includes("edit_committed"), "a refused job committed a publish");
  assert.equal(r.compiles, 0, "the container was asked to compile work the ledger refused to pay for");
  assert.equal(r.distWrites, 0, "files were written under sites/ for a refused job");
  assert.ok(r.finalize && r.finalize.p_ok === false, "finalize was told a refused job was an answer");
  assert.ok(r.refund && r.refund.args.p_state === "failed", "the consumer did not refund a refused job: " + JSON.stringify(r.refund));
  assert.ok(r.reply && r.reply.ok === false, "the stored reply claims success: " + JSON.stringify(r.reply));
  assert.equal(r.reply.cost, 0, "the stored reply carries a cost for work that did not ship");
  assert.match(String(r.reply.msg || ""), sentence, "the customer is not told why: " + JSON.stringify(r.reply.msg));
}

// The server's own sentence, evaluated out of worker.js as
// test/gateway-refusal.test.mjs does, so this file holds no copy of it.
function serverSentence(detail) {
  const src = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const at = src.indexOf("function compileMsg(pub, theirs");
  const end = src.indexOf("\n}\n", at);
  assert.ok(at > 0 && end > at, "compileMsg moved — rescope this");
  // eslint-disable-next-line no-new-func
  const compileMsg = new Function("roomSentence", src.slice(at, end + 2) + "\nreturn compileMsg;")((k) => "room:" + k);
  return compileMsg({ ok: false, error: "unbilled", ours: detail !== "insufficient", detail }, "");
}

test("run 31 (36159773928), reproduced through the customer's own composer: the edit and the routing are two amounts", () => {
  // Run 31's stored reply as recorded — HTTP 422 under `x-gf-edit: final`,
  // every field but `msg` verbatim — with the sentence the server now sends.
  const reply = { ok: false, error: "unbilled", cost: 0, msg: serverSentence("insufficient"), lanes: [], detail: "insufficient" };
  assertScreens(reply, false, SHORT);
  // The billing service down, on the same shape.
  assertScreens({ ...reply, detail: "rpc", msg: serverSentence("rpc") }, false, DOWN);
});

test("the amounts are the recorded ones: a routing cost of 1 is said as 1, and an edit cost that is not a number is not called free", () => {
  const reply = { ok: false, error: "unbilled", cost: 0, msg: serverSentence("insufficient"), lanes: [], detail: "insufficient" };
  assert.equal(editBrowserReply(reply, false, { ...ROUTED, cost: 1 }).text, SHORT + EDIT_FREE + " Reading your message cost 1 credit.");
  // A reply that recorded no cost says nothing about the edit's, rather than
  // calling it free — and with no routing reply held, says nothing at all.
  const { cost, ...uncosted } = reply;
  assert.equal(cost, 0);
  assert.equal(editBrowserReply(uncosted, false, ROUTED).text, SHORT + READING_2);
  assert.equal(editBrowserReply(uncosted, false, undefined).text, SHORT);
  // And a recorded edit cost is said as recorded.
  assert.equal(editBrowserReply({ ...reply, cost: 3 }, false, ROUTED).text, SHORT + " This edit cost 3 credits." + READING_2);
});

// ── THE HOPS A DRIVE CANNOT REACH, READ OUT OF THE SOURCE ──────────────────

const CODE = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
/** `indexOf` that refuses -1, so no assertion below is made about `slice(-1, -1)`. */
function at(src, needle, label) {
  const i = src.indexOf(needle);
  assert.ok(i > 0, `${label}: landmark gone (${needle})`);
  return i;
}
/** Whole-line comments blanked, length-preserving, so prose cannot satisfy a scan. */
const blankComments = (s) => s.replace(/^(\s*)\/\/.*$/gm, (m, lead) => lead + " ".repeat(m.length - lead.length));

test("both funnels record a refusal after the ok check and before answering 0", () => {
  for (const [label, needle, who] of [["edit", 'editRpc(env, "edit_reserve", { p_id: eJob.id', "eJob"], ["addon", 'editRpc(env, "edit_reserve", { p_id: aJob.id', "aJob"]]) {
    const start = at(CODE, needle, label + " funnel");
    const funnel = blankComments(CODE.slice(start, start + 1400));
    const okAt = at(funnel, "r.ok === true", label + " ok check");
    const note = funnel.indexOf(who + ".noteRefusal(");
    assert.ok(note > okAt, label + ": the refusal is recorded before, or without, the ok check");
    const zero = funnel.indexOf("return 0", note);
    assert.ok(zero > note, label + ": the refusal is recorded after the funnel has already answered 0");
    // WITH THE LEDGER'S OWN WORD, so the gate can say `insufficient` apart from
    // a transport failure — the two want opposite sentences.
    assert.match(funnel.slice(note, zero), /r && r\.error/, label + ": the refusal is recorded without the ledger's reason");
  }
});

test("the job context exposes the refusals beside the reserves", () => {
  const ctx = CODE.slice(at(CODE, "function makeJobCtx(", "ctx"), at(CODE, "async function editRpc", "ctx end") > 0 ? CODE.length : CODE.length);
  const body = blankComments(ctx.slice(0, 6000));
  for (const need of ["reserves: () => reserves", "noteReserve()", "refused: () => refusals.length", "refusals: () => refusals.slice()", "noteRefusal(why)"]) {
    assert.ok(body.includes(need), "the job context lost `" + need + "`");
  }
});

test("the spine asks `unbilled` three times: before the translations, before the compile, before the free-rung step and the gate", () => {
  const spine = blankComments(CODE.slice(at(CODE, "async function recompileAndPublish", "spine"), at(CODE, "async function siteOgImage", "spine end")));
  const def = at(spine, "const unbilled = () =>", "the helper");
  // THE HELPER REFUSES ON THE COUNT, never on the reserves — a refused reserve
  // and a landed one are different zeros, which is the whole change.
  const helper = spine.slice(def, spine.indexOf("\n  };", def));
  // THROUGH THE ROUTE'S READER, never the job alone (1a-iii): the flag-off
  // path hands its own ledger, and a helper that read the job would answer
  // "no job, no refusals" for it.
  assert.match(spine, /const acct = charges \|\| job;/, "the spine no longer reads the route's charges reader ahead of the job");
  assert.match(helper, /acct\.refused\(\) > 0/, "the helper does not read the refusal count");
  assert.match(spine.slice(0, def), /charges = null(?:, [^}]*)?\}\) \{/, "the spine's signature no longer takes `charges`");
  assert.match(helper, /error: "unbilled"/, "the helper's refusal is not named `unbilled`");
  assert.match(helper, /ours: why !== "insufficient"/, "a short balance is reported as ours, or a dead ledger as the customer's");
  const asks = [...spine.matchAll(/const u = unbilled\(\); if \(u\) return u;/g)].map((m) => m.index);
  assert.equal(asks.length, 3, "expected exactly three asks, found " + asks.length);
  const firstTranslate = at(spine, 'tm("translate:" + l.tag, "start"', "the translation loop");
  const compile = at(spine, "const compile = async () =>", "the compile");
  const charge = at(spine, 'tm("translate:charge"', "the translation charge");
  const exempt = at(spine, 'editRpc(env, "edit_exempt"', "the free-rung step");
  const gate = at(spine, 'editRpc(env, "edit_may_publish"', "the gate");
  assert.ok(asks[0] < firstTranslate, "the first ask sits after a translation could be bought");
  assert.ok(asks[1] > charge && asks[1] < compile, "the second ask does not sit between the translation charge and the compile");
  assert.ok(asks[2] > compile && asks[2] < exempt && exempt < gate, "the third ask does not sit before the free-rung step and the gate");
});

test("compileMsg names a refused ledger before it tests `ours`, and tells a short balance apart from a dead ledger", () => {
  const start = at(CODE, "function compileMsg(", "compileMsg");
  const body = blankComments(CODE.slice(start, CODE.indexOf("\n}\n", start)));
  const unbilled = at(body, 'pub.error === "unbilled"', "the unbilled branch");
  // THE TEST ITSELF, not how it returns (2026-09-26): every arm now returns
  // through `said(...)`, which adds the sentence for a change still saved.
  const ours = at(body, "if (!pub || !pub.ours)", "the ours test");
  assert.ok(unbilled < ours, "the unbilled branch sits after the ours test, so a short balance falls to the rung's own sentence");
  const branch = body.slice(unbilled, ours);
  assert.match(branch, /pub\.detail === "insufficient"/, "the branch does not read the ledger's reason");
  assert.match(branch, /enough credits/, "a short balance is not named");
  assert.match(branch, /billing service didn't answer/, "a dead ledger is not named");
  assert.doesNotMatch(branch, /nothing was changed/, "the sentence claims nothing was changed, which a rung that writes rows before it reserves cannot promise");
});

// ── THE SYNCHRONOUS PATH, DRIVEN (2026-09-05, stage 1a-iii) ─────────────────
//
// With the flag off the route collects at each rung instead of reserving, and
// a collect that takes nothing against a positive bill used to be "never fail
// an edit over the ledger": the work shipped and the reply said cost 0. Driven
// through `worker.fetch` with the ledger stubbed: `use_credits` answering -1
// and `get_credits` answering 0 is the ledger refusing; a 503 is the ledger
// silent.

const TOKEN = "Bearer some-token";

async function syncEdit({ slug, ledger, answers = CSS }) {
  const b = bucket(slug, [HOME]);
  const seen = { useCredits: 0, getCredits: 0 };
  const real = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const u = String((input && input.url) || input || "");
    const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
    if (u.includes("/auth/v1/user")) return json(USER);
    if (u.includes("/rpc/use_credits")) { seen.useCredits++; return ledger.use(json); }
    if (u.includes("/rpc/get_credits")) { seen.getCredits++; return json(ledger.balance || 0); }
    if (u.includes("/rest/v1/site_project")) return json([]);
    if (u.includes("/rest/v1/site_backends")) return json([{ uid: USER.id, brief: "" }]);
    if (u.includes("/v1/messages")) {
      let bj = {};
      try { bj = JSON.parse(String(init && init.body) || "{}"); } catch { bj = {}; }
      const tool = (bj.tool_choice && bj.tool_choice.name) || "";
      if (!Object.hasOwn(answers, tool)) return new Response("no stub for tool " + tool, { status: 503 });
      return json({ stop_reason: "tool_use", content: [{ type: "tool_use", name: tool, input: answers[tool] }], usage: { input_tokens: 10, output_tokens: 5 } });
    }
    if (isDispatchUpload(u)) return dispatchOk();   // the publish's script upload
    return new Response("unavailable", { status: 503 });
  };
  const c = installCompiler();
  try {
    const worker = await loadWorker();
    const req = new Request("https://gofarther.dev/api/site/" + slug + "/edit", {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: TOKEN },
      body: JSON.stringify({ layer: "look", page: "", remove: false, rename: "", tab: false, instruction: "make the footer white", picker: "sonnet" }),
    });
    const res = await worker.fetch(req, { SITES_BUCKET: b, ANTHROPIC_API_KEY: "test-key", XAI_API_KEY: "test-key", ...dispatchEnv() }, makeCtx());
    const body = await res.json().catch(() => null);
    return { status: res.status, body, compiles: c.calls.length, seen, distWrites: b.writes.filter(([k]) => k.startsWith("sites/")).length };
  } finally { c.uninstall(); globalThis.fetch = real; }
}
