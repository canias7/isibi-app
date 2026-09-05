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
import { installCompiler } from "./fixtures/cf-containers.mjs";
import { CONFIG_KEY } from "../site-config.mjs";
import { packEditJob, EDIT_JOB_PREFIX, EDIT_JOB_KIND } from "../builder/edit-job.mjs";
import { collectStrings, TRANSLATE_TOOL } from "../builder/site-translate.mjs";

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
    return new Response("unavailable", { status: 503 });
  };
  const c = installCompiler();
  try {
    const worker = await loadWorker();
    const env = { SITES_BUCKET: b, ANTHROPIC_API_KEY: "test-key", XAI_API_KEY: "test-key", SUPABASE_SERVICE_KEY: "svc-test", CREDITS_MINT_SECRET: "mint-test" };
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

test("the first reserve refused as insufficient: no exempt, no gate, no compile, the customer told, the consumer refunds", async () => {
  const r = await drive({ slug: "refused-first", reserve: INSUFFICIENT, answers: CSS });
  assertStopped(r, /enough credits/);
  // AND THE FIRST REFUSAL IS THE ONE NAMED — the ledger's own word.
  assert.match(String(r.reply.msg), /wasn't published and nothing was charged/);
});

test("a LATER reserve refused after the first landed: the translation is not bought into a publish, the first reserve goes back", async () => {
  const { strings } = collectStrings([HOME]);
  assert.ok(strings.length > 0, "the fixture page carries no string to translate — the case would prove nothing");
  const r = await drive({
    slug: "refused-second", langs: ["es"],
    reserve: (s, cost) => s === 1 ? { ok: true, charged: cost, cost, balance: 1, billing: "reserved" } : INSUFFICIENT(s, cost),
    answers: { ...CSS, [TRANSLATE_TOOL.name]: { strings: strings.map((s) => "ES " + s) } },
    // Sized so each bill crosses the floor of 1, or one call and two round to
    // the same credit and a bill missing a whole call is invisible.
    usage: { pick_lanes: { input_tokens: 3000, output_tokens: 300 }, edit_site: { input_tokens: 4000, output_tokens: 400 }, [TRANSLATE_TOOL.name]: { input_tokens: 6000, output_tokens: 6000 } },
  });
  const reserves = r.rpc.filter((x) => x.fn === "edit_reserve");
  assert.equal(reserves.length, 2, "expected the rung's reserve and the translation's: " + JSON.stringify(r.fns));
  assert.equal(reserves[0].args.p_seq, 1);
  assert.equal(reserves[1].args.p_seq, 2);
  assertStopped(r, /enough credits/);
});

test("a ledger that did not answer is a refusal too, named as ours", async () => {
  const r = await drive({ slug: "refused-rpc", reserve: () => ({ ok: false, error: "rpc", status: 500 }), answers: CSS });
  assertStopped(r, /billing service didn't answer/);
});

test("a duplicate delivery's reserve — ok, charged 0, repeat — is a reserve that landed, and the publish goes through", async () => {
  const r = await drive({
    slug: "repeat-ok",
    reserve: (s, cost) => ({ ok: true, charged: 0, cost, billing: "reserved", repeat: true }),
    answers: CSS,
  });
  assert.ok(!r.fns.includes("edit_exempt"), "a landed reserve was read as a free rung");
  assert.ok(r.fns.includes("edit_may_publish") && r.fns.includes("edit_committed"), "the publish did not go through: " + JSON.stringify(r.fns));
  assert.equal(r.compiles, 1);
  assert.ok(r.finalize && r.finalize.p_ok === true);
  assert.ok(r.reply && r.reply.ok === true, JSON.stringify(r.reply));
});

test("a rung that reserved NOTHING is still a free rung: taking a page away exempts and publishes, as before", async () => {
  // The page rung's removal makes no model call and the lane picker runs only
  // for the look layer, so this job asks the ledger for nothing at all.
  const r = await drive({
    slug: "free-remove", pages: [HOME, ABOUT],
    body: { layer: "page", page: "/about", remove: true, instruction: "take the about page down" },
    reserve: () => { throw new Error("a free rung asked the ledger for a reserve"); },
  });
  assert.ok(!r.fns.includes("edit_reserve"), "the free rung reserved something: " + JSON.stringify(r.fns));
  assert.ok(r.fns.includes("edit_exempt"), "the free rung was not exempted: " + JSON.stringify(r.fns));
  const exempt = r.fns.indexOf("edit_exempt"), gate = r.fns.indexOf("edit_may_publish");
  assert.ok(gate > exempt, "the gate was asked before the exemption");
  assert.ok(r.fns.includes("edit_committed"), "the free rung's publish did not commit");
  assert.equal(r.compiles, 1);
  assert.ok(r.reply && r.reply.ok === true && Array.isArray(r.reply.removed), JSON.stringify(r.reply));
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
  const spine = blankComments(CODE.slice(at(CODE, "async function recompileAndPublish", "spine"), at(CODE, "async function siteRedirectFor", "spine end")));
  const def = at(spine, "const unbilled = () =>", "the helper");
  // THE HELPER REFUSES ON THE COUNT, never on the reserves — a refused reserve
  // and a landed one are different zeros, which is the whole change.
  const helper = spine.slice(def, spine.indexOf("\n  };", def));
  // THROUGH THE ROUTE'S READER, never the job alone (1a-iii): the flag-off
  // path hands its own ledger, and a helper that read the job would answer
  // "no job, no refusals" for it.
  assert.match(spine, /const acct = charges \|\| job;/, "the spine no longer reads the route's charges reader ahead of the job");
  assert.match(helper, /acct\.refused\(\) > 0/, "the helper does not read the refusal count");
  assert.match(spine.slice(0, def), /charges = null \}\) \{/, "the spine's signature no longer takes `charges`");
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
  const ours = at(body, "if (!pub || !pub.ours) return theirs;", "the ours test");
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
    const res = await worker.fetch(req, { SITES_BUCKET: b, ANTHROPIC_API_KEY: "test-key", XAI_API_KEY: "test-key" }, makeCtx());
    const body = await res.json().catch(() => null);
    return { status: res.status, body, compiles: c.calls.length, seen, distWrites: b.writes.filter(([k]) => k.startsWith("sites/")).length };
  } finally { c.uninstall(); globalThis.fetch = real; }
}

test("synchronous: a collect refused by the ledger stops the publish, nothing compiled, the customer told", async () => {
  const r = await syncEdit({ slug: "sync-refused", ledger: { use: (json) => json(-1), balance: 0 } });
  assert.ok(r.seen.useCredits > 0, "the ledger was never asked");
  assert.equal(r.compiles, 0, "the container compiled work the ledger refused to pay for");
  assert.equal(r.distWrites, 0);
  assert.ok(r.body && r.body.ok === false, JSON.stringify(r.body));
  assert.equal(r.body.error, "unbilled", "the refusal wears the compile's code: " + JSON.stringify(r.body));
  assert.match(String(r.body.msg || ""), /enough credits/);
});

test("synchronous: a ledger that did not answer is a refusal too, named as ours", async () => {
  const r = await syncEdit({ slug: "sync-down", ledger: { use: () => new Response("down", { status: 503 }) } });
  assert.equal(r.compiles, 0);
  assert.ok(r.body && r.body.ok === false && r.body.error === "unbilled", JSON.stringify(r.body));
  assert.match(String(r.body.msg || ""), /billing service didn't answer/);
});

test("synchronous: a collect that landed publishes exactly as before", async () => {
  const r = await syncEdit({ slug: "sync-ok", ledger: { use: (json) => json(48), balance: 50 } });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.ok(r.body && r.body.ok === true, JSON.stringify(r.body));
  assert.equal(r.compiles, 1);
  assert.ok(r.body.cost >= 1, "the landed collect is not on the reply: " + JSON.stringify(r.body));
});

// ── THE RESERVE PRECEDES THE WRITE: THE HOPS, READ (stage 1a-ii) ────────────

test("the data and rules rungs reserve through `before`, answer `unbilled` before any write, and never bill twice", () => {
  const route = blankComments(CODE.slice(at(CODE, 'if (eLayer === "data") {', "data rung"), at(CODE, 'if (eLayer === "rename") {', "rename rung")));
  for (const [who, run, cost] of [["data", "runDataEdit(", "dCost"], ["rules", "runRulesEdit(", "rCost"]]) {
    const start = at(route, run, who + " call");
    const call = route.slice(start, start + 900);
    assert.match(call, new RegExp("before: async \\(usage\\) => \\{ " + cost + " = await eCharge\\(usage\\); " + cost.replace("Cost", "Billed") + " = true; return !\\(eCharges\\.refused\\(\\) > 0\\); \\}"),
      who + ": the module is not handed a `before` that reserves and reads the route's refusals");
    // THE HOOK RESERVES, AND THE HOOK ALONE. A refusal answers before a write
    // and, on every later reply, the recorded charge is reported rather than a
    // second reserve placed under a new sequence.
    const seg = route.slice(start, route.indexOf(who === "data" ? 'if (eLayer === "rules") {' : 'if (eLayer === "rename") {', start));
    assert.match(seg, /reason === "unbilled"\) return unbilledReply\(eCharges\);/, who + ": a refused reserve does not answer `unbilledReply`");
    const bare = [...seg.matchAll(/cost: await eCharge\(/g)].length;
    assert.equal(bare, 0, who + ": " + bare + " reply still places a second charge after `before` billed");
    assert.ok(seg.includes("cost: " + cost.replace("Cost", "Billed") + " ? " + cost + " : await eCharge("), who + ": the replies do not report the hook's charge");
  }
  // AND THE MODULES ASK BEFORE THEY WRITE.
  const apply = blankComments(fs.readFileSync(new URL("../builder/site-apply.mjs", import.meta.url), "utf8"));
  const dataBefore = at(apply, 'typeof deps.before === "function"', "site-apply before");
  const dataApply = at(apply, "const applied = [], failed = [];", "site-apply apply loop");
  assert.ok(dataBefore < dataApply, "runDataEdit asks `before` after it has started writing rows");
  assert.match(apply.slice(dataBefore, dataApply), /reason: "unbilled", usage/, "a refused `before` does not answer unbilled with the usage");
  const rules = blankComments(fs.readFileSync(new URL("../builder/site-rules.mjs", import.meta.url), "utf8"));
  const rulesBefore = at(rules, 'typeof deps.before === "function"', "site-rules before");
  const rulesApply = at(rules, "await deps.apply(spec)", "site-rules apply");
  assert.ok(rulesBefore < rulesApply, "runRulesEdit asks `before` after the schema is applied");
});

test("the addon reserves the designers' spend before the schema apply, the page call as sequence 4, and stops before the look store", () => {
  const addon = blankComments(CODE.slice(at(CODE, "const aCharge = async (bill", "addon charge"), at(CODE, "const aPub = await recompileAndPublish(env, {", "addon publish")));
  const first = at(addon, "aFirst = await aCharge(pageCredits(...aDesignUsage, aSeedUsage));", "sequence #1");
  const apply = at(addon, "aMade = await applySiteSchema(adb, merged);", "the apply");
  const seed = at(addon, "aSeedUsage = aTop.usage;", "the seed net");
  assert.ok(seed < first && first < apply, "sequence #1 does not sit between the seed net and the schema apply");
  assert.match(addon.slice(first, apply), /if \(aCharges\.refused\(\) > 0\) return unbilledReply\(aCharges\);/, "a refused #1 does not stop before the DDL");
  // The job-only guard: synchronously nothing moves ahead of the work.
  const guard = addon.slice(addon.lastIndexOf("if (aJob) {", first), first);
  assert.ok(guard.length > 0 && guard.length < 80, "sequence #1 is not gated on the job alone: " + JSON.stringify(guard));
  assert.match(addon, /const aCostNow = aFirstPlaced \? aFirst : await aCharge\(/, "the pageless answer reserves a second time after #1");
  const bill = at(addon, "const aBill = aFirstPlaced ? pageCredits(aGen && aGen.usage) : pageCredits(...aDesignUsage, aGen && aGen.usage, aSeedUsage);", "the page path's bill");
  assert.match(addon.slice(bill, bill + 700), /aCharge\(aBill, 4\)/, "the page call is not reserved as sequence 4 after #1");
  const stop = at(addon, "if (aJob && aCharges.refused() > 0) return unbilledReply(aCharges);", "the page path's stop");
  const store = at(addon, "const w = await patchSiteConfig(env, ownerSlug, adb, aLookPatch);", "the look store");
  assert.ok(bill < stop && stop < store, "the page path's refusal does not stop before the look is stored");
  // The reader the spine is handed.
  const pub = CODE.slice(at(CODE, "const aPub = await recompileAndPublish(env, {", "addon publish"), at(CODE, 'aMark("publish:1", aPub && aPub.ok ? "ok" : "fail"', "addon publish end"));
  assert.match(pub, /charges: aCharges,/, "the addon's publish is not handed the route's refusals reader");
});

test("the edit route keeps a synchronous ledger, hands the spine its reader, and gives back what it collected on a refused publish", () => {
  // FROM THE DEFERRED PUBLISH, which is declared before the funnel and carries
  // the reader to the spine; the window has to start there or the carry is
  // outside it.
  const route = blankComments(CODE.slice(at(CODE, "let pendingPublish = null;", "deferred publish"), at(CODE, "const ranOk = done.filter((d) => !d.failed);", "route tail")));
  assert.ok(route.includes("const syncLedger = { refusals: [], taken: 0 };"), "the synchronous ledger is gone");
  assert.match(route, /if \(took > 0\) syncLedger\.taken \+= took; else if \(bill > 0\) syncLedger\.refusals\.push\("insufficient"\);/, "a collect that took nothing is not recorded as a refusal");
  assert.match(route, /catch \{ syncLedger\.refusals\.push\("rpc"\); return 0; \}/, "a ledger that threw is not recorded as a refusal");
  assert.match(route, /charges: eCharges \};/, "the deferred publish does not carry the route's reader");
  const fail = at(route, "if (!finalPub.ok) {", "failed publish");
  const refund = at(route, "refundCredits(env, ou.id, syncLedger.taken)", "the refund");
  assert.ok(refund > fail && refund - fail < 900, "the refund of the earlier collects does not sit inside the failed-publish branch");
  assert.match(route.slice(fail, refund), /finalPub\.error === "unbilled" && !eJob && syncLedger\.taken > 0/, "the refund is not gated on an unbilled, synchronous, collected publish");
  assert.match(route, /error: finalPub\.error === "unbilled" \? "unbilled" : "compile"/, "a refused publish still wears the compile's code");
});
