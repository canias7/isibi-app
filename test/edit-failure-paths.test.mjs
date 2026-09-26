// THE EDIT'S FAILURE PATHS: WHAT A STOPPED EDIT LEAVES BEHIND, AND WHAT THE
// CUSTOMER IS TOLD IT COST (2026-09-25, the edit-path milestone).
//
// Owner: *"Review and fix the remaining failure and billing paths … Reproduce
// each suspected defect before changing it. Keep known completed work intact,
// and never turn an unreadable outcome into an automatic paid retry. Base
// billing statements on recorded ledger outcomes; don't invent refunds."*
//
// EVERY CASE IS ONE MESSAGE THROUGH THE REAL `POST /api/site/<slug>/edit`, on
// the synchronous path or on the JOB path — the real queue consumer, the real
// ledger RPC calls (faked at the wire, with a row that moves the way the real
// RPCs move it), and then the real poll route, which is what the browser reads.
// The screen is the browser's own composer (`editBrowserReply` runs
// `public/chat.js`'s `editAnswer`), handed the routing reply the page holds.
//
// ⚠ WHAT THIS FILE DOES NOT CLAIM. Every model answer is SUPPLIED, so what is
// established is the route's and the browser's handling of each answer — never
// that a real model answers that way.

import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { loadWorker, makeCtx } from "./fixtures/worker-harness.mjs";
import { installCompiler, dispatchEnv, isDispatchUpload, dispatchOk } from "./fixtures/cf-containers.mjs";
import { CONFIG_KEY } from "../site-config.mjs";
import { packEditJob, EDIT_JOB_PREFIX, EDIT_JOB_KIND } from "../builder/edit-job.mjs";
// THE TOOL NAMES COME FROM THE MODULES THAT DEFINE THEM — a hand-typed name is
// a stub that never matches.
import { pickTool, editTool } from "../builder/site-lanes.mjs";
import { NAV_TOOL } from "../builder/site-nav.mjs";
import { RENAME_TOOL } from "../builder/site-alias.mjs";
import { editBrowserReply } from "../scripts/addon-sweep.mjs";
// THE BUILD SERVICE'S OWN SELECTION OF WHAT TO JUDGE, and the room sentence the
// failed-publish formatter hands back — the product's, never a copy.
import fs from "node:fs";
import { readCss, selectorsToJudge, plainSelectors } from "../builder/site-freecss.mjs";
import { roomSentence } from "../builder/container-room.mjs";

const T = { pick: pickTool().name, lane: editTool("css").name, nav: NAV_TOOL.name };
const USER = { id: "u-failpaths-1", email: "owner@example.com" };
// WHAT THE ROUTING CALL COST, as the routing reply the page holds records it.
const ROUTED = { cost: 2 };

const page = (route, body) => "import { createFileRoute, Link } from '@tanstack/react-router'\n"
  + "export const Route = createFileRoute('" + route + "')({ component: Page })\n"
  + "function Page(){ return <main>" + body + "</main> }\n";
// A LINK IN THE COPY, so the menu rung has something to read and reaches its
// model call rather than answering "no menu" for free.
const STORED = [
  { path: "index.tsx", source: page("/", "<section><h2>Welcome</h2><p>Bread every morning.</p><Link to=\"/visit\">Find us</Link></section>") },
  { path: "visit.tsx", source: page("/visit", "<section><h2>Find us</h2><p>Quay Street.</p></section>") },
];
const LOOK = { brand: "Harbour Loaf", theme: "broadsheet" };

const hex32 = () => randomBytes(16).toString("hex");
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });

function bucket(slug) {
  const store = new Map([
    ["source/" + slug + "/pages.json", JSON.stringify(STORED)],
    ["source/" + slug + "/parts.json", JSON.stringify([])],
    [CONFIG_KEY(slug), JSON.stringify({ look: LOOK, css: "" })],
  ]);
  const obj = (v) => ({ text: async () => v, json: async () => JSON.parse(v), arrayBuffer: async () => new TextEncoder().encode(v).buffer });
  const b = {
    store,
    // A WRITE THE STORE REFUSES, the way R2 answers an outage: a case sets a
    // test on the key, and a put it answers true for throws.
    refuse: null,
    async get(k) { const v = store.get(k); return v === undefined ? null : obj(v); },
    async put(k, v) { if (b.refuse && b.refuse(k)) throw new Error("R2 put failed"); store.set(k, String(v)); },
    async delete(k) { store.delete(k); },
    async list() { return { objects: [], truncated: false }; },
    async head(k) { return store.has(k) ? { key: k } : null; },
  };
  return b;
}

/**
 * ONE MESSAGE, on either money path. `site` carries a store from an earlier
 * message, so a case can send a second one to the same site. `lanes` answers
 * the look lanes' editor in order (the correction round is its second call).
 * `render` is the build's render report, per build. `cancel` makes every
 * heartbeat answer that the customer asked to stop, and the heartbeat fire at
 * once. `skew` moves the clock forward by that much after the first build.
 */
async function drive({ mode = "sync", routed, ask, pick = null, lanes = null, nav, navThrows = null, render = null, cancel = false, skew = 0, site = null, collect = null, balance = 100, creditBack = true, compileOk = true, rename = null, granted = true }) {
  const slug = site ? site.slug : "fail-" + mode + "-" + hex32().slice(0, 8);
  const b = site ? site.b : bucket(slug);
  const id = hex32(), secret = hex32();
  const url = "https://gofarther.dev/api/site/" + slug + "/edit";
  const body = JSON.stringify({ layer: "look", page: "", remove: false, rename: "", tab: false, ...routed, instruction: ask, picker: "sonnet", idem: "idem" + hex32().slice(0, 20) });
  if (mode === "job") b.store.set(EDIT_JOB_PREFIX + id, JSON.stringify(packEditJob({ url, body, uid: USER.id, slug, secret, at: Date.now() })));
  const seen = { rpc: [], debits: [], credited: [], models: [], aliases: [], lanePrompts: [] };
  // THE JOB'S ROW, moved the way the real RPCs move it: a reserve holds
  // credits, a finalize with `p_ok` settles them, a refund gives them back.
  const row = { state: "routing", billing: "none", cost: 0, result: null };
  let laneN = 0;
  const real = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const u = String((input && input.url) || input || "");
    let args = {};
    try { args = JSON.parse(String((init && init.body) || "{}")); } catch { args = {}; }
    const rpc = u.match(/\/rest\/v1\/rpc\/(edit_\w+)/);
    if (rpc) {
      const fn = rpc[1];
      seen.rpc.push({ fn, args });
      switch (fn) {
        case "edit_claim": return json({ ok: true, claimed: true, state: "claimed", billing: "none", uid: USER.id, slug, needs_review: false });
        case "edit_beat": return json({ ok: true, alive: true, state: "routing", cancel });
        case "edit_reserve": row.cost += Number(args.p_cost); row.billing = "reserved"; return json({ ok: true, charged: Number(args.p_cost), cost: row.cost, billing: "reserved" });
        // THE PUBLISH GATE, which a case can refuse — the queue's own
        // bookkeeping, so the spine names it as ours (`not-granted`).
        case "edit_may_publish": return json(granted ? { ok: true, granted: true } : { ok: false, granted: false, error: "lease" });
        case "edit_publish_mark": case "edit_committed": case "edit_phase_write": return json({ ok: true });
        case "edit_finalize":
          if (args.p_result) row.result = args.p_result;
          if (args.p_ok) { row.state = "done"; if (row.billing === "reserved") row.billing = "finalized"; return json({ ok: true, billing: row.billing, cost: row.cost }); }
          return json({ ok: false, error: "not-published", state: row.state });
        case "edit_refund": {
          const was = row.billing;
          row.state = args.p_state || "failed";
          if (was === "reserved") { row.billing = "refunded"; return json({ ok: true, refunded: row.cost }); }
          return json({ ok: true, refunded: 0, billing: was });
        }
        case "edit_get": return json({ ok: true, job: id, slug, state: row.state, phase: null, cost: row.cost, billing: row.billing, result: row.result, needs_review: false, ms: 1000 });
        default: return json({ ok: false, error: "no stub for " + fn }, 500);
      }
    }
    // THE SYNCHRONOUS LEDGER. `use_credits` debits the whole bill or nothing
    // and answers -1 then; `collect(n)` says, per call, whether this one lands.
    if (u.includes("/rpc/use_credits")) {
      const n = seen.debits.length + 1;
      const took = !collect || collect(n) ? Number(args.cost) || 0 : 0;
      seen.debits.push(took);
      return json(took > 0 ? took : -1);
    }
    if (u.includes("/rpc/credit_back")) {
      if (!creditBack) return new Response("refused", { status: 503 });
      seen.credited.push(Number(args.amount) || 0);
      return new Response(null, { status: 204 });
    }
    if (u.includes("/rpc/get_credits")) return json(balance);
    if (u.includes("/auth/v1/user")) return json(USER);
    // THE OWNER'S SITE, and no other: a name the rename asks about belongs to nobody.
    if (u.includes("/rest/v1/site_backends")) return json(u.includes("slug=eq." + slug) ? [{ uid: USER.id, brief: "", neon_db: "" }] : []);
    // AN ADDRESS WRITE IS RECORDED — it is live the moment it lands.
    if (u.includes("/rest/v1/site_aliases")) {
      if (init && init.method === "POST") { seen.aliases.push(args); return new Response(null, { status: 201 }); }
      return json([]);
    }
    if (u.includes("/rest/v1/site_project")) return json([]);
    if (u.includes("/v1/messages")) {
      const tool = (args.tool_choice && args.tool_choice.name) || "";
      seen.models.push(tool);
      if (tool === T.pick && pick) return json({ stop_reason: "tool_use", content: [{ type: "tool_use", name: tool, input: pick }], usage: { input_tokens: 1000, output_tokens: 500 } });
      if (tool === T.lane && lanes) {
        // WHAT EACH LANE CALL WAS SHOWN, so a case can read what the correction
        // round asked about.
        seen.lanePrompts.push(JSON.stringify(args.messages || []));
        const a = lanes[Math.min(laneN++, lanes.length - 1)];
        // AN ERROR IN THE LIST IS A CALL THAT NEVER ANSWERED — the connection
        // dropped, or the provider timed out.
        if (a instanceof Error) throw a;
        return json({ stop_reason: "tool_use", content: [{ type: "tool_use", name: tool, input: a }], usage: { input_tokens: 300, output_tokens: 60 } });
      }
      if (tool === RENAME_TOOL.name && rename) return json({ stop_reason: "tool_use", content: [{ type: "tool_use", name: tool, input: rename }], usage: { input_tokens: 400, output_tokens: 20 } });
      if (tool === T.nav) {
        if (navThrows) throw navThrows;
        if (nav !== undefined) return json({ stop_reason: "tool_use", content: [{ type: "tool_use", name: tool, input: nav }], usage: { input_tokens: 800, output_tokens: 90 } });
      }
      return new Response("no stub for tool " + tool, { status: 503 });
    }
    if (isDispatchUpload(u)) return dispatchOk();
    return new Response("unavailable", { status: 503 });
  };
  // THE CLOCK, moved forward after the first build when a case asks: the job's
  // budget reads `Date.now`, so this is how "not enough time left" is reached.
  const realNow = Date.now;
  let skewed = 0;
  Date.now = () => realNow() + skewed;
  const report = typeof render === "function" ? (n, sent) => { const r = render(n, sent); if (n === 1 && skew) skewed = skew; return r; } : render;
  // A COMPILE THAT FAILS on every build, the way the container answers a
  // page that does not compile.
  const c = installCompiler({ ...(report ? { render: report } : {}), ...(compileOk ? {} : { ok: false, error: "src/routes/index.tsx(3,1): error TS1005: ';' expected." }) });
  const realInterval = globalThis.setInterval;
  // A CANCEL IS PICKED UP BY A HEARTBEAT, which runs on a thirty-second timer;
  // here it runs at once, so the cancel is in hand before the publish gate.
  if (cancel) globalThis.setInterval = (fn) => { fn(); return 0; };
  try {
    const worker = await loadWorker();
    const env = { SITES_BUCKET: b, ANTHROPIC_API_KEY: "test-key", XAI_API_KEY: "test-key", SUPABASE_SERVICE_KEY: "svc-test", CREDITS_MINT_SECRET: "mint-test", ...dispatchEnv() };
    const ctx = makeCtx();
    let status = 0, reply = null;
    if (mode === "job") {
      await worker.queue({ messages: [{ body: { kind: EDIT_JOB_KIND, id }, ack() {}, retry() {} }] }, env, ctx);
      await Promise.allSettled(ctx.pending);
      // WHAT THE BROWSER READS: the poll route's answer for the finished job.
      const poll = await worker.fetch(new Request("https://gofarther.dev/api/site/edit/" + id, { headers: { Authorization: "Bearer t" } }), env, makeCtx());
      status = poll.status;
      reply = await poll.json().catch(() => null);
    } else {
      const res = await worker.fetch(new Request(url, { method: "POST", headers: { "content-type": "application/json", Authorization: "Bearer t" }, body }), env, ctx);
      status = res.status;
      reply = await res.json().catch(() => null);
      await Promise.allSettled(ctx.pending);
    }
    const said = editBrowserReply(reply, status >= 200 && status < 300, ROUTED);
    const config = JSON.parse(b.store.get(CONFIG_KEY(slug)) || "{}");
    return {
      site: { slug, b }, status, reply, said, config,
      builds: c.calls.map((k) => JSON.stringify(k.body)),
      models: seen.models,
      lanePrompts: seen.lanePrompts,
      debits: seen.debits,
      credited: seen.credited,
      reserves: seen.rpc.filter((r) => r.fn === "edit_reserve").map((r) => Number(r.args.p_cost)),
      committed: seen.rpc.some((r) => r.fn === "edit_committed"),
      aliases: seen.aliases,
      row: { ...row, result: undefined },
    };
  } finally {
    c.uninstall();
    globalThis.fetch = real;
    globalThis.setInterval = realInterval;
    Date.now = realNow;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// A STOPPED EDIT PUTS BACK THE DESIGN IT WROTE
// ─────────────────────────────────────────────────────────────────────────────
//
// A rung writes its look or stylesheet into the stored config BEFORE the one
// publish. REPRODUCED on the parent: a job cancelled after the css lane wrote
// its rule answered "your site is untouched" — and the NEXT message, a name
// change, compiled with that rule in it. The live site was untouched; the
// stored design was not, and the next edit shipped it.

const CSS_ASK = "Make the header button forest green.";
const PICK_CSS = { fields: ["css"] };
const GREEN = "#014421";
const CLEAN_CSS = { css: "[data-slot=\"site-link\"]{background-color:" + GREEN + "}" };
const DEAD_CSS = { css: "header button{background-color:" + GREEN + "}" };
const STILL_DEAD = { css: "header .btn{background-color:" + GREEN + "}" };
const DEAD = { ok: true, checked: 2, pages: 1, findings: [], deadSelectors: ["header button"], selectorsLooked: 2, landmarks: [] };
const NAME_ASK = "Call the bakery Harbour Loaf Co.";

// WHAT A STOP OWES THE STORE: the design as it was before the message, and the
// next, unrelated message compiling without the stopped change in it.
async function assertPutBack(r, label) {
  assert.equal(r.config.css, "", label + ": the stopped change is still in the stored stylesheet");
  assert.deepEqual(r.config.look, LOOK, label + ": the stored look moved");
  assert.equal(r.committed, false, label + ": the stopped edit was published");
  const next = await drive({ mode: "sync", routed: { layer: "look" }, ask: NAME_ASK, pick: { fields: ["brand"] }, lanes: [{ brand: "Harbour Loaf Co" }], site: r.site });
  assert.equal(next.reply && next.reply.ok, true, label + ": the next message did not go through: " + JSON.stringify(next.reply));
  assert.equal(next.builds.length, 1, label + ": the next message did not build once");
  assert.ok(!next.builds[0].includes(GREEN), label + ": the next, unrelated edit shipped the stopped change");
}

test("a job cancelled at the publish gate puts back the stylesheet it wrote, and the next edit does not ship it", async () => {
  const r = await drive({ mode: "job", routed: { layer: "look" }, ask: CSS_ASK, pick: PICK_CSS, lanes: [CLEAN_CSS], cancel: true });
  assert.equal(r.builds.length, 0, "the cancelled edit built");
  assert.equal(r.reply && r.reply.error, "cancelled", "not the cancel: " + JSON.stringify(r.reply));
  await assertPutBack(r, "cancelled");
});

// THE RENDER CHECK IS THE BUILD SERVICE'S OWN SELECTION (`judge`, below): the
// corrected build is judged for the rule the correction wrote, which also
// points at nothing — a script answering "header button" for every build would
// no longer describe a sheet that does not have it.
test("a job whose correction still missed puts back the stylesheet it wrote, and the next edit does not ship it", async () => {
  const r = await drive({ mode: "job", routed: { layer: "look" }, ask: CSS_ASK, pick: PICK_CSS, lanes: [DEAD_CSS, STILL_DEAD], render: judge() });
  assert.equal(r.builds.length, 2, "not the build and the one correction");
  assert.equal(r.reply && r.reply.error, "unverified", "not the refused correction: " + JSON.stringify(r.reply));
  await assertPutBack(r, "unverified");
});

test("a job with no time left for the correction puts back the stylesheet it wrote, and the next edit does not ship it", async () => {
  const r = await drive({ mode: "job", routed: { layer: "look" }, ask: CSS_ASK, pick: PICK_CSS, lanes: [DEAD_CSS, STILL_DEAD], render: () => DEAD, skew: 14 * 60e3 });
  assert.equal(r.builds.length, 1, "the correction ran with no time for it");
  assert.equal(r.reply && r.reply.error, "budget", "not the time refusal: " + JSON.stringify(r.reply));
  await assertPutBack(r, "budget");
});

// A LOGO IS THE SAME WRITE ONE RUNG OVER: the mark goes into the stored look
// before the one publish, and a cancel there left it saved for the next edit.
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
test("a job cancelled at the publish gate after a logo was saved puts the logo back, and the next edit does not ship it", async () => {
  const r = await drive({ mode: "job", routed: { layer: "logo", images: [{ name: "logo.png", data: PNG }] }, ask: "Use this picture as the logo.", cancel: true });
  assert.equal(r.builds.length, 0, "the cancelled edit built");
  assert.equal(r.reply && r.reply.error, "cancelled", "not the cancel: " + JSON.stringify(r.reply));
  assert.deepEqual(r.config.look, LOOK, "the cancelled logo is still in the stored look");
  const next = await drive({ mode: "sync", routed: { layer: "look" }, ask: NAME_ASK, pick: { fields: ["brand"] }, lanes: [{ brand: "Harbour Loaf Co" }], site: r.site });
  assert.equal(next.builds.length, 1, "the next message did not build once");
  assert.ok(!next.builds[0].includes("/u/" + r.site.slug + "/"), "the next, unrelated edit shipped the cancelled logo");
});

// THE LOGO RUNG READS THE COMPOSER'S OWN ATTACHMENT (2026-09-25). The attach
// code makes `{name, data}` (test/site-entry-inventory.test.mjs asserts the edit
// POST carries exactly that), and the rung read bare strings alone: "Use this
// picture as the logo." with the picture attached came back "Attach the logo
// with the 📎 button", nothing stored and nothing built.
test("a logo attached in the composer's shape is stored and published through the edit route", async () => {
  const r = await drive({ mode: "sync", routed: { layer: "logo", images: [{ name: "logo.png", data: PNG }] }, ask: "Use this picture as the logo." });
  assert.equal(r.reply && r.reply.ok, true, "the attached logo was refused: " + JSON.stringify(r.reply));
  assert.equal(r.builds.length, 1, "the logo was not built into the site");
  const mark = r.config.look && r.config.look.wordmark;
  assert.equal(mark && mark.form, "image", "the logo was not stored as the header mark: " + JSON.stringify(r.config.look));
  assert.ok(String(mark.url).startsWith("/u/" + r.site.slug + "/"), "the logo is not the site's own upload: " + mark.url);
  assert.ok(r.builds[0].includes(mark.url), "the build does not carry the logo");
  assert.match(r.said.text, /logo in the header/, "the screen does not say the logo went up: " + r.said.text);
});

test("control: a correction that lands keeps the corrected stylesheet it published", async () => {
  const r = await drive({ mode: "job", routed: { layer: "look" }, ask: CSS_ASK, pick: PICK_CSS, lanes: [DEAD_CSS, CLEAN_CSS], render: (n) => (n === 1 ? DEAD : { ok: true, checked: 2, pages: 1, findings: [] }) });
  assert.equal(r.reply && r.reply.ok, true, "the corrected edit did not publish: " + JSON.stringify(r.reply));
  assert.equal(r.committed, true, "the corrected edit was not committed");
  assert.equal(r.config.css, CLEAN_CSS.css, "the published stylesheet was wound back under the live site");
});

// ── A PUBLISH IS HELD ONLY FOR THE RULES THIS REQUEST WROTE (2026-09-26) ────
//
// Owner: *"An unchanged stylesheet containing an old dead selector must not
// trigger an unsolicited stylesheet rewrite during an unrelated edit. Preserve
// detection of newly introduced broken selectors and legitimate corrections."*
//
// REPRODUCED on the parent, both money paths. The css hand-over (`cssCtx`) was
// made when the css lane was PICKED, before it answered, and the render check
// judged every rule in the stored sheet. So a css lane that answered the sheet
// as it stood, beside a menu change, still held the publish for the stylesheet's
// old `.newsletter-band` rule, and the correction round rewrote a stylesheet
// nobody had asked about — on a job the rewrite then failed its own check and
// the whole message, the menu change included, was refused and refunded.
//
// THE RENDER CHECK HERE IS THE BUILD SERVICE'S OWN SELECTION (`judge`): it
// judges `selectorsToJudge` over the sheet it was sent — every rule when the
// publish names none, only the named ones otherwise — and a judged selector the
// page does not have is dead. What the page has is the case's (`ON_PAGE`); which
// rules are judged is the product's. `previous: true` is a container still on
// the image before this change, which judges every rule whatever it is sent.

const STALE = ".newsletter-band{background:#f4e9d8}";
const LINK_ASK = "Keep the colours as they are, and send the Find us link to the home page.";
const LINK_TO_HOME = { pageLinks: [{ label: "Find us", to: "/" }] };
const PICK_CSS_LINK = { fields: ["css", "action"] };
// A NEW RULE THAT POINTS AT NOTHING, written beside the old one — the lane
// answers the whole sheet — and its correction.
const NEW_DEAD = STALE + "\nheader button{background-color:" + GREEN + "}";
const NEW_FIXED = STALE + "\n[data-slot=\"site-link\"]{background-color:" + GREEN + "}";
const ON_PAGE = ["[data-slot=\"site-link\"]", "[data-slot=\"cta-band\"]"];
const REPOINTED = { css: "[data-slot=\"cta-band\"]{background:#f4e9d8}" };

function judge({ previous = false, seen = null } = {}) {
  return (n, sent) => {
    const sheet = readCss(sent && sent.css).css;
    const looked = previous ? plainSelectors(sheet) : selectorsToJudge(sheet, sent && sent.cssVerify);
    const dead = looked.filter((s) => !ON_PAGE.includes(s));
    if (seen) seen.push({ looked, dead });
    return { ok: true, checked: 2, pages: 1, findings: [], ...(dead.length ? { deadSelectors: dead, selectorsLooked: 2 } : {}), landmarks: [] };
  };
}

function staleSite(mode) {
  const slug = "fail-" + mode + "-" + hex32().slice(0, 8);
  const b = bucket(slug);
  b.store.set(CONFIG_KEY(slug), JSON.stringify({ look: LOOK, css: STALE }));
  return { slug, b };
}

// WHAT A PUBLISH ASKED TO BE HELD FOR, read off the payload it sent.
const verified = (r) => r.builds.map((b) => JSON.parse(b).cssVerify);

// WHAT THE CORRECTION ROUND WAS ASKED ABOUT: the dead selectors it lists, read
// out of the second lane call — the sheet it is shown carries the old rule too,
// so only the list itself can say which rules it was asked to fix.
function correctionAsked(r) {
  const texts = [];
  const walk = (v) => { if (typeof v === "string") texts.push(v); else if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === "object") Object.values(v).forEach(walk); };
  walk(JSON.parse(r.lanePrompts[1] || "[]"));
  const all = texts.join("\n");
  const head = "opened in a browser:\n";
  const at = all.indexOf(head);
  const to = all.indexOf("\n\nThey are not typos", at);
  assert.ok(at >= 0 && to > at, "the correction round's list of dead selectors is not in its prompt");
  return all.slice(at + head.length, to).split("\n").map((l) => l.trim());
}

const NAMED_ONLY = "✅ The requested styling was already in place.";

for (const mode of ["sync", "job"]) {
  test("an old rule that matches nothing does not hold an unrelated edit: the menu change ships in one build, the stylesheet is not rewritten, and the next edit ships the same sheet (" + mode + ")", async () => {
    const looked = [];
    // THE SECOND ANSWER IS THE REWRITE THE OLD CORRECTION ROUND STORED — the old
    // rule re-pointed at the call-to-action band. It is never asked for now; it
    // is here so a correction that did run would show in the store as well.
    const r = await drive({ mode, site: staleSite(mode), routed: { layer: "look" }, ask: LINK_ASK, pick: PICK_CSS_LINK, lanes: [{ css: STALE }, REPOINTED], nav: LINK_TO_HOME, render: judge({ seen: looked }) });
    // NO CORRECTION, ONE BUILD — the defect was a second lane call and a
    // second build for a rule this request did not write.
    assert.deepEqual(r.models, [T.pick, T.lane, T.nav], "a correction ran for a rule this request did not write");
    assert.equal(r.builds.length, 1, "not one build");
    // THE OLD RULE WAS STILL REPORTED — the container was sent no list, so it
    // judged every rule — and nothing acted on it.
    assert.deepEqual(looked, [{ looked: [".newsletter-band"], dead: [".newsletter-band"] }], "the check did not report the old rule, so this proves nothing about ignoring it");
    assert.deepEqual(verified(r), [undefined], "the publish asked to be held for rules this request did not write");
    assert.equal(r.reply && r.reply.ok, true, "the edit did not publish: " + JSON.stringify(r.reply));
    // THE MENU CHANGE IS WHAT SHIPPED, in the build and in the store.
    assert.match(r.builds[0], /<Link to=\\"\/\\">Find us<\/Link>/, "the menu change is not in the build");
    const pages = JSON.parse(r.site.b.store.get("source/" + r.site.slug + "/pages.json"));
    assert.match(pages.find((p) => p.path === "index.tsx").source, /<Link to="\/">Find us<\/Link>/, "the menu change was not stored");
    // THE STYLESHEET IS THE ONE THE SITE HAD, byte for byte, and the build carried it.
    assert.equal(r.config.css, STALE, "the stylesheet was rewritten");
    assert.deepEqual(r.config.look, LOOK, "the stored look moved");
    assert.ok(r.builds[0].includes(".newsletter-band{background:#f4e9d8}"), "the build did not carry the stored sheet");
    // THE LEDGER: the css lane and the menu call, once — nothing for a correction.
    if (mode === "sync") {
      assert.deepEqual(r.debits, [2, 1], "not the css lane and the menu call collected");
      assert.deepEqual(r.credited, [], "a refund was made");
    } else {
      assert.deepEqual(r.reserves, [2, 1], "not the css lane and the menu call reserved");
      assert.equal(r.row.billing, "finalized", "the job was not settled");
    }
    assert.equal(r.reply.cost, 3, "the reply's cost is not what the ledger holds");
    // THE SCREEN NAMES THE STYLING AND NOT THE MENU CHANGE — the look branch's
    // recorded limitation (review #9, next-task 3), not this change's to fix.
    assert.equal(r.said.text, NAMED_ONLY);
    assert.deepEqual(r.said.actions, ["refresh the credit balance"]);
    // AND THE NEXT, UNRELATED EDIT BUILDS ONCE, WITH THE SAME SHEET.
    const next = await drive({ mode: "sync", routed: { layer: "look" }, ask: NAME_ASK, pick: { fields: ["brand"] }, lanes: [{ brand: "Harbour Loaf Co" }], site: r.site, render: judge() });
    assert.equal(next.reply && next.reply.ok, true, "the next message did not go through: " + JSON.stringify(next.reply));
    assert.deepEqual(next.models, [T.pick, T.lane], "the next edit bought a correction");
    assert.equal(next.builds.length, 1, "the next message did not build once");
    assert.ok(next.builds[0].includes(".newsletter-band{background:#f4e9d8}"), "the next edit did not carry the stored sheet");
    assert.equal(next.config.css, STALE, "the next edit rewrote the stylesheet");
  });
}

for (const [mode, previous] of [["sync", false], ["job", false], ["job", true]]) {
  const on = previous ? "a container on the previous image" : "the current container";
  test("a new rule that points at nothing is held and corrected, and the correction is asked about that rule alone (" + mode + ", " + on + ")", async () => {
    const looked = [];
    const r = await drive({ mode, site: staleSite(mode), routed: { layer: "look" }, ask: CSS_ASK, pick: PICK_CSS, lanes: [{ css: NEW_DEAD }, { css: NEW_FIXED }], render: judge({ previous, seen: looked }) });
    assert.deepEqual(r.models, [T.pick, T.lane, T.lane], "not the picker, the css lane and the one correction");
    assert.equal(r.builds.length, 2, "not the build and the one rebuild");
    // THE FIRST PUBLISH ASKED TO BE HELD FOR THE NEW RULE AND NOTHING OLDER.
    assert.deepEqual(verified(r)[0], ["header button"], "the first publish did not name the rule this request wrote, or named an older one");
    // WHAT THE CONTAINER JUDGED: the new rule alone — or, on the previous image,
    // every rule, which is what the route's own filter exists for.
    assert.deepEqual(looked[0].looked, previous ? [".newsletter-band", "header button"] : ["header button"], "the container judged the wrong rules");
    // THE CORRECTION WAS ASKED ABOUT THE NEW RULE, NEVER THE OLD ONE.
    assert.deepEqual(correctionAsked(r), ["header button"], "the correction round was asked about a rule this request did not write");
    // THE SECOND PUBLISH: a job verifies the rule the correction wrote; the
    // synchronous path's second publish verifies nothing, as before.
    assert.deepEqual(verified(r)[1], mode === "job" ? ["[data-slot=\"site-link\"]"] : undefined, "the second publish was held for the wrong rules");
    assert.equal(r.reply && r.reply.ok, true, "the corrected edit did not publish: " + JSON.stringify(r.reply));
    if (mode === "job") assert.equal(r.committed, true, "the corrected edit was not committed");
    // THE CORRECTION IS WHAT IS STORED — the old rule as the model left it.
    assert.equal(r.config.css, NEW_FIXED, "the published correction was not stored");
    // THE LEDGER: the css lane once; the correction round is not billed.
    if (mode === "sync") {
      assert.deepEqual(r.debits, [2], "not the css lane alone collected");
      assert.deepEqual(r.credited, [], "a refund was made");
    } else {
      assert.deepEqual(r.reserves, [2], "not the css lane alone reserved");
      assert.equal(r.row.billing, "finalized", "the job was not settled");
    }
    assert.equal(r.reply.cost, 2, "the reply's cost is not what the ledger holds");
    assert.equal(r.said.text, LOOK_SAID);
    assert.deepEqual(r.said.actions, ["refresh the credit balance"]);
  });
}

// THE CORRECTED BUILD REFUSED BY THE STORE IS A NAMED FAILURE, NEVER THE VERIFY
// CATCH (the round's reachability, below): the first build stops at its dead
// rule before staging anything, so the corrected one is the first write under
// builds/ — and the store refuses it.
test("a synchronous edit whose corrected build cannot be stored is a named failure that puts the old stylesheet back, and the next edit does not ship the correction", async () => {
  const site = staleSite("sync");
  site.b.refuse = (k) => k.startsWith("builds/");
  const r = await drive({ mode: "sync", site, routed: { layer: "look" }, ask: CSS_ASK, pick: PICK_CSS, lanes: [{ css: NEW_DEAD }, { css: NEW_FIXED }], render: judge() });
  site.b.refuse = null;
  assert.deepEqual(r.models, [T.pick, T.lane, T.lane], "not the picker, the css lane and the one correction");
  assert.equal(r.builds.length, 2, "not the build and the one correction");
  assert.ok(r.builds[1].includes("site-link"), "the correction's sheet did not reach the second build");
  assert.equal(r.status, 422, JSON.stringify(r.reply));
  assert.equal(r.reply && r.reply.error, "compile", "not the failed publish: " + JSON.stringify(r.reply));
  // THE LEDGER: this path keeps what its rungs collected when a publish fails
  // (the correction round is not billed), and the reply's cost is exactly that.
  assert.deepEqual(r.debits, [2], "not the css lane collected");
  assert.deepEqual(r.credited, [], "a refund was made that this path does not make");
  assert.equal(r.reply.cost, 2, "the reply's cost is not what the ledger holds");
  // RESTORED, SO NOTHING ABOUT A CHANGE STILL SAVED.
  assert.equal(r.said.text, "⚠️ That didn't go through — our build service was restarting. Try again in a moment. This edit cost 2 credits. Reading your message cost 2 credits.");
  assert.deepEqual(r.said.actions, [], "a failed publish started something");
  assert.equal(r.config.css, STALE, "the stylesheet was not put back to the one the site had");
  const next = await drive({ mode: "sync", routed: { layer: "look" }, ask: NAME_ASK, pick: { fields: ["brand"] }, lanes: [{ brand: "Harbour Loaf Co" }], site: r.site, render: judge() });
  assert.equal(next.builds.length, 1, "the next message did not build once");
  assert.ok(!next.builds[0].includes("site-link"), "the next, unrelated edit shipped the correction nobody published");
});

// ── THE VERIFY CATCH IS NOT REACHED BY ANY FAILURE THE ROUND CAN MEET ───────
//
// The correction round runs inside a try whose catch puts the design back and
// answers `error: "verify"`. Every operation inside it handles its own failure
// before the catch could see one: `runLane` answers a send that threw as
// `failed`, `patchSiteConfig` answers a refused write as `ok: false`, and the
// second publish answers a refused store, a refused gate or a failed compile as
// a named failure (`recompileAndPublish` catches its stage, activation and
// container calls; `editRpc` never throws). `landmarkNote`, `themeNote` and the
// trace marks are pure and guard their inputs. So the catch is the defence
// against a defect in our own code, and no failure the route can meet reaches
// it — which these cases drive at each boundary rather than force a throw.
// (The corrected build's store refusal is the synchronous case above.)

test("the correction's model call failing stops the job and puts the stylesheet back, never reaching the verify catch", async () => {
  const r = await drive({ mode: "job", routed: { layer: "look" }, ask: CSS_ASK, pick: PICK_CSS, lanes: [DEAD_CSS, TIMEOUT], render: () => DEAD });
  assert.deepEqual(r.models, [T.pick, T.lane, T.lane], "not the picker, the css lane and the one correction");
  assert.equal(r.builds.length, 2, "not the build and the one rebuild");
  assert.equal(r.reply && r.reply.error, "unverified", "not the refused correction: " + JSON.stringify(r.reply));
  assert.equal(r.row.billing, "refunded", "the consumer did not refund the stopped job");
  assert.equal(r.reply.cost, 0);
  assert.equal(r.said.text, "⚠️ " + STOPPED + " This edit cost you nothing. Reading your message cost 2 credits.");
  await assertPutBack(r, "correction call failed");
});

test("the correction's stylesheet write refused stops the job and puts the stylesheet back, never reaching the verify catch", async () => {
  const slug = "fail-job-" + hex32().slice(0, 8);
  const site = { slug, b: bucket(slug) };
  // THE LANE'S WRITE LANDS, THE CORRECTION'S DOES NOT, THE RESTORE DOES.
  let puts = 0;
  site.b.refuse = (k) => k === CONFIG_KEY(slug) && ++puts === 2;
  const r = await drive({ mode: "job", site, routed: { layer: "look" }, ask: CSS_ASK, pick: PICK_CSS, lanes: [DEAD_CSS, STILL_DEAD], render: () => DEAD });
  site.b.refuse = null;
  assert.equal(puts, 3, "not the lane's write, the refused correction and the restore");
  assert.equal(r.builds.length, 2, "not the build and the one rebuild");
  assert.ok(!r.builds[1].includes("header .btn"), "the refused correction reached the rebuild");
  assert.equal(r.reply && r.reply.error, "unverified", "not the refused correction: " + JSON.stringify(r.reply));
  assert.equal(r.said.text, "⚠️ " + STOPPED + " This edit cost you nothing. Reading your message cost 2 credits.");
  await assertPutBack(r, "correction write refused");
});

test("the corrected build refused at the publish gate is a named failure that puts the stylesheet back, never reaching the verify catch", async () => {
  // THE FIRST BUILD STOPS AT ITS DEAD SELECTOR BEFORE THE GATE; THE CORRECTED
  // ONE MEETS THE GATE, AND THE GATE SAYS NO.
  const r = await drive({ mode: "job", routed: { layer: "look" }, ask: CSS_ASK, pick: PICK_CSS, lanes: [DEAD_CSS, CLEAN_CSS], render: (n) => (n === 1 ? DEAD : { ok: true, checked: 2, pages: 1, findings: [] }), granted: false });
  assert.equal(r.builds.length, 2, "not the build and the one rebuild");
  assert.equal(r.reply && r.reply.error, "compile", "not the refused publish: " + JSON.stringify(r.reply));
  assert.equal(r.row.billing, "refunded", "the consumer did not refund the refused job");
  assert.equal(r.said.text, "⚠️ That didn't go through — your change was built but couldn't be published (lease), so nothing was changed. This edit cost you nothing. Reading your message cost 2 credits.");
  await assertPutBack(r, "gate refused");
});

// ── A RESTORE THAT FAILED IS SAID BY EVERY FORMATTER (2026-09-26) ───────────
//
// Owner: *"Preserve the failed-restoration warning through every
// publish-failure formatter … the build store refuses publication, restoration
// also fails, the changed stylesheet remains saved, and the next edit ships it.
// The customer currently hears only that the build service was restarting."*
//
// REPRODUCED on the parent, both money paths: `compileMsg` answered every
// failure of ours — and the ledger's refusal — with its own sentence and
// dropped the only one that said the change was still saved. Each case below
// asserts the store (the change is still saved), the exact screen (not
// published, and still saved — never "untouched", never a rollback), the ledger
// (what each path recorded, no refund invented) and the next edit (which ships
// the saved change, exactly as the sentence warns). The controls are the same
// failures with a restore that lands.

const CLEAN_RULE = CLEAN_CSS.css;
const STILL_SAVED = " The change itself is still saved, though, so it could go out with your next edit.";

// A SITE WHOSE STORE REFUSES THE PUBLISH AND, WHEN `restore` IS "refused", THE
// RESTORE: the css lane's config write is the first and lands, the restore is
// the second.
function refusingSite(mode, { builds = true, restore = "refused" } = {}) {
  const slug = "fail-" + mode + "-" + hex32().slice(0, 8);
  const site = { slug, b: bucket(slug), puts: 0 };
  site.b.refuse = (k) => (builds && k.startsWith("builds/"))
    || (k === CONFIG_KEY(slug) && ++site.puts === 2 && restore === "refused");
  return site;
}

// THE NEXT, UNRELATED EDIT: a name change, which does not touch the stylesheet.
async function nextEdit(r) {
  const next = await drive({ mode: "sync", routed: { layer: "look" }, ask: NAME_ASK, pick: { fields: ["brand"] }, lanes: [{ brand: "Harbour Loaf Co" }], site: r.site, render: judge() });
  assert.equal(next.reply && next.reply.ok, true, "the next message did not go through: " + JSON.stringify(next.reply));
  assert.equal(next.builds.length, 1, "the next message did not build once");
  return next;
}

for (const mode of ["sync", "job"]) {
  test("a publish the store refused, whose restore was refused too, says the change is still saved — and the next edit ships it (" + mode + ")", async () => {
    const site = refusingSite(mode);
    const r = await drive({ mode, site, routed: { layer: "look" }, ask: CSS_ASK, pick: PICK_CSS, lanes: [CLEAN_CSS], render: judge() });
    site.b.refuse = null;
    assert.equal(site.puts, 2, "not the lane's write and the refused restore");
    assert.equal(r.builds.length, 1, "not the one build");
    assert.equal(r.status, 422, JSON.stringify(r.reply));
    assert.equal(r.reply && r.reply.error, "compile", "not the failed publish: " + JSON.stringify(r.reply));
    // NOT PUBLISHED: no build staged, the site's pointer never written.
    assert.deepEqual([...site.b.store.keys()].filter((k) => k.startsWith("builds/") || k.startsWith("current/")), [], "something was published");
    assert.equal(r.committed, false, "the failed edit was committed");
    // STILL SAVED: the store holds the change the restore could not take back.
    assert.equal(r.config.css, CLEAN_RULE, "the stored stylesheet is not the change the restore failed to take back");
    // THE LEDGER, AS EACH PATH RECORDED IT — no refund the ledger does not show.
    if (mode === "sync") {
      assert.deepEqual(r.debits, [2], "not the css lane collected");
      assert.deepEqual(r.credited, [], "a refund was made that this path does not make");
      assert.equal(r.reply.cost, 2, "the reply's cost is not what the ledger holds");
    } else {
      assert.deepEqual(r.reserves, [2], "not the css lane reserved");
      assert.equal(r.row.billing, "refunded", "the consumer did not refund the failed job");
      assert.equal(r.reply.cost, 0, "the poll route reported a refunded job's reserve as its cost");
    }
    assert.equal(r.said.text, "⚠️ That didn't go through — our build service was restarting. Try again in a moment." + STILL_SAVED
      + (mode === "sync" ? " This edit cost 2 credits." : " This edit cost you nothing.") + " Reading your message cost 2 credits.");
    assert.doesNotMatch(r.said.text, /untouched|nothing was changed|put back|rolled back|undone/, "the screen claims a rollback that did not happen");
    assert.deepEqual(r.said.actions, [], "a failed publish started something");
    // AND THE NEXT EDIT SHIPS IT, which is what the sentence warns of.
    const next = await nextEdit(r);
    assert.ok(next.builds[0].includes(GREEN), "the saved change did not go out with the next edit — the warning would be false");
  });

  test("control: the same refused publish with a restore that lands says nothing is saved, and the next edit does not ship it (" + mode + ")", async () => {
    const site = refusingSite(mode, { restore: "lands" });
    const r = await drive({ mode, site, routed: { layer: "look" }, ask: CSS_ASK, pick: PICK_CSS, lanes: [CLEAN_CSS], render: judge() });
    site.b.refuse = null;
    assert.equal(site.puts, 2, "not the lane's write and the restore");
    assert.equal(r.status, 422, JSON.stringify(r.reply));
    assert.equal(r.config.css, "", "the restore did not put the stylesheet back");
    assert.equal(r.said.text, "⚠️ That didn't go through — our build service was restarting. Try again in a moment."
      + (mode === "sync" ? " This edit cost 2 credits." : " This edit cost you nothing.") + " Reading your message cost 2 credits.");
    const next = await nextEdit(r);
    assert.ok(!next.builds[0].includes(GREEN), "the next, unrelated edit shipped a change the restore took back");
  });
}

// A PAGE THAT DID NOT COMPILE — the compile's own sentence, the one arm the
// route writes itself — with the restore refused too.
test("a change that did not compile, whose restore was refused too, says the live site did not change and the change is still saved (sync)", async () => {
  const site = refusingSite("sync", { builds: false });
  const r = await drive({ mode: "sync", site, routed: { layer: "look" }, ask: CSS_ASK, pick: PICK_CSS, lanes: [CLEAN_CSS], compileOk: false });
  site.b.refuse = null;
  assert.equal(site.puts, 2, "not the lane's write and the refused restore");
  assert.equal(r.status, 422, JSON.stringify(r.reply));
  assert.equal(r.config.css, CLEAN_RULE, "the change the restore failed to take back is not still saved");
  assert.deepEqual(r.debits, [2], "not the css lane collected");
  assert.deepEqual(r.credited, [], "a refund was made that this path does not make");
  assert.equal(r.said.text, "⚠️ That didn't compile, so your live site wasn't changed." + STILL_SAVED + " This edit cost 2 credits. Reading your message cost 2 credits.");
});

// THE SAME FACT THROUGH TWO OTHER FORMATTERS: the queue's publish gate refusing
// the build (`compileMsg`'s `not-granted` arm), and a cancel at the gate
// (`editStopped`, which already said it).
test("a publish refused at the gate, whose restore was refused too, says the change is still saved and the live site did not change (job)", async () => {
  const site = refusingSite("job", { builds: false });
  const r = await drive({ mode: "job", site, routed: { layer: "look" }, ask: CSS_ASK, pick: PICK_CSS, lanes: [CLEAN_CSS], render: judge(), granted: false });
  site.b.refuse = null;
  assert.equal(site.puts, 2, "not the lane's write and the refused restore");
  assert.equal(r.reply && r.reply.error, "compile", "not the refused publish: " + JSON.stringify(r.reply));
  assert.equal(r.config.css, CLEAN_RULE, "the change the restore failed to take back is not still saved");
  assert.equal(r.row.billing, "refunded", "the consumer did not refund the refused job");
  assert.equal(r.said.text, "⚠️ That didn't go through — your change was built but couldn't be published (lease), so your live site wasn't changed." + STILL_SAVED + " This edit cost you nothing. Reading your message cost 2 credits.");
  const next = await nextEdit(r);
  assert.ok(next.builds[0].includes(GREEN), "the saved change did not go out with the next edit");
});

test("a job cancelled at the publish gate, whose restore was refused too, says the change is still saved (job)", async () => {
  const site = refusingSite("job", { builds: false });
  const r = await drive({ mode: "job", site, routed: { layer: "look" }, ask: CSS_ASK, pick: PICK_CSS, lanes: [CLEAN_CSS], cancel: true });
  site.b.refuse = null;
  assert.equal(site.puts, 2, "not the lane's write and the refused restore");
  assert.equal(r.builds.length, 0, "the cancelled edit built");
  assert.equal(r.reply && r.reply.error, "cancelled", "not the cancel: " + JSON.stringify(r.reply));
  assert.equal(r.config.css, CLEAN_RULE, "the change the restore failed to take back is not still saved");
  assert.equal(r.row.billing, "refunded", "the consumer did not refund the cancelled job");
  assert.equal(r.said.text, "⚠️ I stopped that edit before anything was published." + STILL_SAVED + " This edit cost you nothing. Reading your message cost 2 credits.");
  const next = await nextEdit(r);
  assert.ok(next.builds[0].includes(GREEN), "the saved change did not go out with the next edit");
});

// EVERY ARM OF THE FAILED-PUBLISH SENTENCE, the function itself: the one the
// route runs, cut out of worker.js and handed the real `roomSentence`. With the
// restore failed each arm keeps its own account of what went wrong, says the
// LIVE site did not change where it used to say nothing did, and ends with the
// one sentence; with the restore landed each arm is what it was.
test("every arm of the failed-publish sentence says the change is still saved when the restore failed, and none calls the site untouched", () => {
  const src = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const note = src.match(/\nconst KEPT_CHANGE_NOTE = ("[^"\n]+");\n/);
  assert.ok(note, "the one sentence for a change still saved is gone");
  assert.equal(JSON.parse(note[1]), STILL_SAVED, "the sentence the screens assert is not the one the route says");
  const fn = src.match(/\nfunction compileMsg\(pub, theirs, landed = false, kept = false\) \{\n[\s\S]*?\n\}\n/);
  assert.ok(fn, "compileMsg is gone, or no longer takes the kept state");
  const compileMsg = new Function("roomSentence", "KEPT_CHANGE_NOTE", fn[0] + "\nreturn compileMsg;")(roomSentence, STILL_SAVED);
  const ARMS = [
    { error: "unbilled", detail: "insufficient" }, { error: "unbilled", detail: "down" },
    { error: "compile", ours: false },
    { error: "not-granted", ours: true, detail: "lease" },
    { error: "not-served", ours: true },
    { error: "lease-lost", ours: true },
    { error: "compile", ours: true, code: "forbidden", key: "builds/x/1/client/a.js" },
    { error: "compile", ours: true, room: "full" }, { error: "compile", ours: true, room: "rate" }, { error: "compile", ours: true, room: "start" },
    { error: "compile", ours: true, timedOut: true },
    { error: "read", ours: true },
    { error: "compile", ours: true },
  ];
  const THEIRS = "That didn't compile, so your live site wasn't changed.";
  for (const pub of ARMS) {
    for (const landed of [false, true]) {
      const plain = compileMsg(pub, THEIRS, landed, false);
      const kept = compileMsg(pub, THEIRS, landed, true);
      const at = JSON.stringify(pub) + " landed=" + landed;
      assert.ok(!plain.includes("still saved"), at + ": a restore that landed was said to have left the change saved");
      assert.ok(kept.endsWith(STILL_SAVED), at + ": a failed restore is not said: " + kept);
      assert.doesNotMatch(kept, /nothing was changed|untouched/, at + ": a failed restore still calls the site untouched");
      // THE ARM'S OWN ACCOUNT IS KEPT: the same sentence, with "nothing was
      // changed" narrowed to the live site.
      assert.equal(kept.slice(0, -STILL_SAVED.length), plain.replace("so nothing was changed", "so your live site wasn't changed"), at + ": the arm's own sentence moved");
    }
  }
  // AND A TRUTHY VALUE THAT IS NOT `true` CLAIMS NOTHING IS SAVED — the
  // `landed` rule, one argument over.
  assert.ok(!compileMsg({ error: "compile", ours: true }, THEIRS, false, 1).includes("still saved"), "a truthy non-true value claimed a change is saved");
});

// ─────────────────────────────────────────────────────────────────────────────
// WHAT A REFUSED OR STOPPED EDIT COST, FROM WHAT EACH PATH RECORDED
// ─────────────────────────────────────────────────────────────────────────────
//
// REPRODUCED on the parent, both money paths. A rung that refuses AFTER its
// model call answered bills that call (`cost: await eCharge(...)`): the menu
// rung reading nothing it could act on collected 1 on the synchronous path and
// reserved 1 on a job — whose consumer then refunded it. The screen said the
// rung's sentence and nothing else on both, so neither the charge that stood
// nor the refund that landed was said; and beside a change that shipped, the
// refused step's charge stood with the screen silent. Every failure sentence
// the server wrote claimed "nothing was charged", false of every request, the
// routing call being a charge nothing refunds. Now the sentences say what
// happened, and the browser states the edit's cost from the reply — the
// synchronous path's collections, or on a job the row's record after the
// consumer's refund — beside the routing reply's.

const MENU_ASK = "Rename the Shop menu item to Store.";
const MENU_REFUSED = "I couldn't work out what the menu should be. Tell me what to add, take out or move.";
const BOTH_ASK = "Make the footer navy and rename the Shop menu item to Store.";
const NAVY = { css: "footer { background: navy; }" };
const LOOK_SAID = "✅ Updated the look — the design. The stylesheet sets none of the kit's own colour variables, so the site renders on the default palette.";
const TIMEOUT = Object.assign(new Error("The operation was aborted due to timeout"), { name: "TimeoutError" });

for (const mode of ["sync", "job"]) {
  test("a refusal charged after its model call says what the edit cost, from what the " + (mode === "job" ? "job's row settled" : "ledger collected") + " (" + mode + ")", async () => {
    const r = await drive({ mode, routed: { layer: "nav" }, ask: MENU_ASK, nav: {} });
    assert.equal(r.status, 422, JSON.stringify(r.reply));
    assert.equal(r.reply.error, "no-menu", "not the menu rung's refusal: " + JSON.stringify(r.reply));
    assert.deepEqual(r.models, [T.nav], "the menu rung's model call did not run");
    assert.equal(r.builds.length, 0, "a refusal built something");
    if (mode === "job") {
      // RESERVED, THEN GIVEN BACK BY THE CONSUMER — and the reply the browser
      // reads says so, where the stored one still carried the reserve.
      assert.deepEqual(r.reserves, [1], "the model call was not reserved");
      assert.equal(r.row.billing, "refunded", "the consumer did not refund the refused job");
      assert.equal(r.reply.cost, 0, "the poll route reported a refunded job's reserve as its cost");
      assert.equal(r.reply.refunded, 1, "the poll route did not report the refund the row recorded");
      assert.equal(r.said.text, "⚠️ " + MENU_REFUSED + " This edit cost you nothing. Reading your message cost 2 credits.");
    } else {
      // COLLECTED, and nothing on this path gives a refusal's charge back.
      assert.deepEqual(r.debits, [1], "the model call was not collected");
      assert.equal(r.reply.cost, 1, "the reply does not report what was collected");
      assert.equal(r.said.text, "⚠️ " + MENU_REFUSED + " This edit cost 1 credit. Reading your message cost 2 credits.");
    }
    assert.deepEqual(r.said.actions, [], "a refusal started something");
  });

  test("a step refused after its model call, beside a change that shipped, says what that step still cost (" + mode + ")", async () => {
    const r = await drive({ mode, routed: { layer: "look" }, ask: BOTH_ASK, pick: { fields: ["css", "action"] }, lanes: [NAVY], nav: {} });
    assert.equal(r.status, 200, JSON.stringify(r.reply));
    assert.equal(r.builds.length, 1, "the change that shipped did not build once");
    assert.equal(r.committed, mode === "job", "the job did not commit what it published");
    // THE REFUSED STEP'S OWN CHARGE, on its own entry and in the bill.
    assert.equal(r.reply.partial && r.reply.partial.length, 1, JSON.stringify(r.reply.partial));
    assert.equal(r.reply.partial[0].error, "no-menu");
    assert.equal(r.reply.partial[0].cost, 1, "the refused step's charge is not on its entry");
    assert.deepEqual(mode === "job" ? r.reserves : r.debits, [2, 1], "not the css change and the menu rung's call");
    assert.equal(r.reply.cost, 3, "the reply's cost is not what the ledger took");
    assert.equal(r.said.text, LOOK_SAID + " ⚠️ " + MENU_REFUSED + " That part still cost 1 credit.");
    assert.deepEqual(r.said.actions, ["refresh the credit balance"]);
  });

  test("a step whose model call timed out, beside a change that shipped, claims nothing about money (" + mode + ")", async () => {
    const r = await drive({ mode, routed: { layer: "look" }, ask: BOTH_ASK, pick: { fields: ["css", "action"] }, lanes: [NAVY], navThrows: TIMEOUT });
    assert.equal(r.status, 200, JSON.stringify(r.reply));
    assert.equal(r.builds.length, 1, "the change that shipped did not build once");
    // IT SAID "…this is on us, and nothing was charged" beside a css change
    // that had cost 2. The step itself took nothing, so nothing is said of it.
    assert.equal(r.reply.partial && r.reply.partial.length, 1, JSON.stringify(r.reply.partial));
    assert.equal(r.reply.partial[0].cost, undefined, "a step that took nothing reports a cost");
    assert.deepEqual(mode === "job" ? r.reserves : r.debits, [2], "the timed-out step was charged");
    assert.equal(r.said.text, LOOK_SAID + " ⚠️ That took longer than we allow ourselves to wait — this is on us.");
  });
}

/**
 * THE POLL ROUTE ALONE, over a row the case writes: what the browser reads for
 * a finished job. The row is `edit_get`'s own shape.
 */
async function poll(row) {
  const id = hex32();
  const real = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const u = String((input && input.url) || input || "");
    if (u.includes("/rest/v1/rpc/edit_get")) return json({ ok: true, job: id, slug: "fail-poll", phase: null, needs_review: false, ms: 1000, ...row });
    if (u.includes("/auth/v1/user")) return json(USER);
    if (u.includes("/rest/v1/site_backends")) return json([{ uid: USER.id, brief: "", neon_db: "" }]);
    return new Response("unavailable", { status: 503 });
  };
  try {
    const worker = await loadWorker();
    const env = { SUPABASE_SERVICE_KEY: "svc-test", CREDITS_MINT_SECRET: "mint-test" };
    const res = await worker.fetch(new Request("https://gofarther.dev/api/site/edit/" + id, { headers: { Authorization: "Bearer t" } }), env, makeCtx());
    const text = await res.text();
    let reply = null;
    try { reply = JSON.parse(text); } catch { reply = null; }
    return { status: res.status, text, reply, said: reply ? editBrowserReply(reply, res.ok, ROUTED) : null };
  } finally {
    globalThis.fetch = real;
  }
}

const STOPPED = "My correction still wouldn't have shown up on your page, so nothing was published.";
const stoppedResult = (cost) => ({ status: 503, type: "application/json", body: JSON.stringify({ ok: false, error: "unverified", cost, msg: STOPPED }) });

test("the poll route reports a finished job's cost from its row, and claims none the row does not settle", async () => {
  // REFUNDED: the reply was stored holding the reserve, and the row says it
  // came back — so the edit cost nothing, and the amount given back is said.
  const refunded = await poll({ state: "failed", billing: "refunded", cost: 2, result: stoppedResult(2) });
  assert.equal(refunded.status, 503);
  assert.equal(refunded.reply.cost, 0, "a refunded job's reserve was reported as its cost");
  assert.equal(refunded.reply.refunded, 2, "the refund the row recorded was not reported");
  assert.equal(refunded.said.text, "⚠️ " + STOPPED + " This edit cost you nothing. Reading your message cost 2 credits.");
  // NOTHING TAKEN, whatever the stored reply held.
  for (const billing of ["none", "exempt"]) {
    const r = await poll({ state: "failed", billing, cost: 0, result: stoppedResult(2) });
    assert.equal(r.reply.cost, 0, billing + ": a job that took nothing reported a cost");
    assert.equal(r.reply.refunded, undefined, billing + ": a refund was reported that the row does not record");
  }
  // NOT SETTLED — a refund that did not land, or a job held for review: the
  // row cannot say, so the edit's cost is not claimed either way.
  const held = await poll({ state: "failed", billing: "reserved", cost: 2, needs_review: true, result: stoppedResult(2) });
  assert.equal("cost" in held.reply, false, "an unsettled job's cost was claimed: " + held.text);
  assert.equal(held.said.text, "⚠️ " + STOPPED + " Reading your message cost 2 credits.");
  // A PUBLISHED JOB'S REPLY IS HANDED BACK BYTE FOR BYTE, whatever the row
  // holds — the row's cost differs from the reply's here so that a rewrite is
  // visible, where re-serialising an equal value would not be.
  const shipped = JSON.stringify({ ok: true, layer: "look", cost: 3, lanes: ["css"] });
  const done = await poll({ state: "done", billing: "finalized", cost: 4, result: { status: 200, type: "application/json", body: shipped } });
  assert.equal(done.text, shipped, "a published job's reply was rewritten");
  // A STORED BODY THAT IS NOT A JSON OBJECT IS HANDED BACK AS IT IS.
  const odd = await poll({ state: "failed", billing: "refunded", cost: 2, result: { status: 503, type: "text/plain", body: "not json" } });
  assert.equal(odd.text, "not json", "a body that is not JSON was rewritten");
  // AND A FINISHED JOB WITH NO STORED REPLY answers its state with the same cost.
  const lost = await poll({ state: "lost", billing: "refunded", cost: 2, result: null });
  assert.equal(lost.status, 202);
  assert.equal(lost.reply.cost, 0, "a lost job's refunded reserve was reported as its cost");
  const lostHeld = await poll({ state: "lost", billing: "reserved", cost: 2, result: null });
  assert.equal("cost" in lostHeld.reply, false, "an unsettled lost job's cost was claimed");
  // A RUNNING JOB STILL ANSWERS WHAT IT HOLDS SO FAR.
  const running = await poll({ state: "routing", billing: "reserved", cost: 2, result: null });
  assert.equal(running.reply.cost, 2, "a running job's held cost is no longer reported");
});

// A REFUND IS SAID ONLY WHEN IT LANDED. On the synchronous path a later collect
// the ledger refused stops the publish, and the earlier collects are handed
// back — and the reply said `cost: 0` whether or not they came back, the
// failed refund only logged. REPRODUCED on the parent: with `credit_back`
// refused the screen said "This edit cost you nothing" over 2 credits kept.
for (const landed of [true, false]) {
  test("a refused collect after one that landed: the reply's cost is what the refund " + (landed ? "gave back" : "could not give back") + " (sync)", async () => {
    const r = await drive({ mode: "sync", routed: { layer: "look" }, ask: BOTH_ASK, pick: { fields: ["css", "action"] }, lanes: [NAVY], nav: {}, collect: (n) => n === 1, balance: 0, creditBack: landed });
    assert.equal(r.status, 422, JSON.stringify(r.reply));
    assert.equal(r.reply.error, "unbilled", "not the ledger's refusal: " + JSON.stringify(r.reply));
    assert.equal(r.builds.length, 0, "a refused publish compiled");
    assert.deepEqual(r.debits, [2, 0], "not the css change collected and the menu rung's call refused");
    assert.deepEqual(r.credited, landed ? [2] : [], "the refund of the earlier collect is not what the ledger answered");
    assert.equal(r.reply.cost, landed ? 0 : 2, "the reply's cost is not what the ledger still holds");
    assert.equal(r.said.text, "⚠️ That didn't go through — there aren't enough credits for it, so it wasn't published. Top up and send it again."
      + (landed ? " This edit cost you nothing." : " This edit cost 2 credits.") + " Reading your message cost 2 credits.");
  });
}

// A REFUSAL WITH NO SENTENCE — a reply stored before, or an older Worker's —
// is said in the platform's own words, then what each recorded. Driven through
// the composer alone: every refusal the route writes today carries a sentence.
test("a refusal with no sentence of its own says what the edit and the routing call recorded", () => {
  const charged = editBrowserReply({ ok: false, error: "compile", cost: 1 }, false, ROUTED);
  assert.equal(charged.text, "⚠️ That edit didn't finish, so nothing was published. This edit cost 1 credit. Reading your message cost 2 credits.");
  const unknown = editBrowserReply({ ok: false, error: "compile" }, false, ROUTED);
  assert.equal(unknown.text, "⚠️ That edit didn't finish, so nothing was published. Reading your message cost 2 credits.");
  assert.deepEqual(charged.actions, [], "a refusal started something");
});

// AN UNKNOWN OUTCOME DOES NOT SEND THE CUSTOMER TO A PREVIEW THAT CANNOT SETTLE
// IT (2026-09-25). The not-knowing sentence ended "Check the preview before
// asking for it again" for every layer. REPRODUCED on the parent through the
// composer: a data edit and a rules edit whose answer could not be read, whose
// reply was a receipt where an outcome belonged, or whose escalate came at a
// 503 were each told to check a preview that shows neither a row nor a rule.
test("an edit whose outcome is unknown is told the risk of asking again, never to check the preview", () => {
  for (const layer of ["data", "rules", "look", "text"]) {
    for (const [reply, ok] of [[null, true], [{ ok: true, job: "j1", status: "queued" }, true], [{ ok: false, escalate: true, layer: "text" }, false]]) {
      const r = editBrowserReply(reply, ok, { ok: true, intent: "edit", layer, cost: 2 });
      const label = layer + " " + JSON.stringify(reply);
      assert.equal(r.text, "⚠️ I couldn’t read the answer to that change, so I can’t tell whether it went through. Asking for it again could make the change twice.", label);
      assert.doesNotMatch(r.text, /preview/i, label + ": sent to the preview");
      assert.deepEqual(r.actions, [], label + ": started something");
    }
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// A FAILED PUBLISH DOES NOT CALL A CHANGE THAT ALREADY WENT THROUGH UNTOUCHED
// ─────────────────────────────────────────────────────────────────────────────
//
// An address, a saved row and a table rule are live the moment their rung
// writes them; only the one publish at the end can fail. REPRODUCED on the
// parent through the route: a new address beside a css change that did not
// compile answered "That didn't compile, so your site is untouched" — with the
// alias rows written and the site answering at its new name — on both paths.

const RENAME_ASK = "Make the footer navy and change the address to harbour-bread.";
const HOST = "harbour-bread.gofarther.app";

for (const mode of ["sync", "job"]) {
  test("a new address that went through beside a publish that failed is said, not called untouched (" + mode + ")", async () => {
    const r = await drive({ mode, routed: { layer: "look" }, ask: RENAME_ASK, pick: { fields: ["css", "slug"] }, lanes: [NAVY], rename: { name: "harbour-bread" }, compileOk: false });
    assert.equal(r.status, 422, JSON.stringify(r.reply));
    assert.equal(r.reply.error, "compile", "not the failed publish: " + JSON.stringify(r.reply));
    // THE ADDRESS REALLY MOVED, and nothing puts it back.
    assert.deepEqual(r.aliases.map((a) => [a.alias, a.current]), [[r.site.slug, false], ["harbour-bread", true]], "the address was not written");
    assert.equal(r.committed, false, "the failed publish was committed");
    assert.equal(r.said.text, "⚠️ That didn't compile, so the rest of it wasn't published. Part of it did go through, though: your site is now at "
      + HOST + ", and the old address sends people there."
      + (mode === "job" ? " This edit cost you nothing." : " This edit cost 3 credits.") + " Reading your message cost 2 credits.");
    assert.doesNotMatch(r.said.text, /untouched|nothing was changed/, "a change that went through is called untouched");
  });
}

test("a failure of ours beside an address that went through says the rest was not published, never that nothing changed (job)", async () => {
  const r = await drive({ mode: "job", routed: { layer: "look" }, ask: RENAME_ASK, pick: { fields: ["css", "slug"] }, lanes: [NAVY], rename: { name: "harbour-bread" }, granted: false });
  assert.equal(r.reply && r.reply.error, "compile", "not the refused publish: " + JSON.stringify(r.reply));
  assert.equal(r.said.text, "⚠️ That didn't go through — your change was built but couldn't be published (lease), so the rest of it wasn't published. "
    + "Part of it did go through, though: your site is now at " + HOST + ", and the old address sends people there. This edit cost you nothing. Reading your message cost 2 credits.");
});

test("a stopped job names the address it had already moved (job)", async () => {
  const r = await drive({ mode: "job", routed: { layer: "look" }, ask: RENAME_ASK, pick: { fields: ["css", "slug"] }, lanes: [NAVY], rename: { name: "harbour-bread" }, cancel: true });
  assert.equal(r.reply && r.reply.error, "cancelled", "not the cancel: " + JSON.stringify(r.reply));
  assert.equal(r.builds.length, 0, "the cancelled edit built");
  assert.deepEqual(r.aliases.map((a) => a.alias), [r.site.slug, "harbour-bread"], "the address was not written before the cancel");
  assert.equal(r.said.text, "⚠️ I stopped that edit before anything was published. Part of it did go through, though: your site is now at "
    + HOST + ", and the old address sends people there. This edit cost you nothing. Reading your message cost 2 credits.");
});

test("control: a failed publish with nothing gone through beside it still says the site is untouched", async () => {
  for (const mode of ["sync", "job"]) {
    const r = await drive({ mode, routed: { layer: "look" }, ask: CSS_ASK, pick: PICK_CSS, lanes: [CLEAN_CSS], compileOk: false });
    assert.equal(r.reply.error, "compile", mode + ": " + JSON.stringify(r.reply));
    assert.deepEqual(r.aliases, [], mode + ": an address was written");
    assert.match(r.said.text, /^⚠️ That didn't compile, so your site is untouched\. /, mode + ": " + r.said.text);
    assert.doesNotMatch(r.said.text, /Part of it did go through/, mode + ": a change is said to have gone through");
  }
});
