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
import { leftOf } from "../builder/request.mjs";
// WHICH SPELLING OF A RULE REACHES THE FIXTURE'S PARAGRAPH, as a real Chromium
// answers it (test/integration/site-build.mjs establishes the table).
import { SPELLINGS, PARAGRAPH_JSX, RULE, STORED_SEL, WRITTEN_SEL } from "./fixtures/comment-boundary.mjs";

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
async function drive({ mode = "sync", routed, ask, pick = null, lanes = null, nav, navThrows = null, render = null, cancel = false, skew = 0, site = null, collect = null, balance = 100, creditBack = true, compileOk = true, rename = null, granted = true, fonts = null }) {
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
    // A FONT HOST, when a case supplies one (audit A20-5): `fonts(u)` answers
    // the Fontsource API and its files, or null to fall through.
    if (fonts) { const f = await fonts(u); if (f) return f; }
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
      return new Response("no stub for tool " + tool, { status: 400 });
    }
    if (isDispatchUpload(u)) return dispatchOk();
    return new Response("no stub (test fixture)", { status: 400 });
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

// A LOGO IS THE SAME WRITE ONE RUNG OVER: the mark goes into the stored look
// before the one publish, and a cancel there left it saved for the next edit.
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

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

const NAMED_ONLY = "The requested styling was already in place.";
// THE MENU STEP'S OWN ACCOUNT, SAID BESIDE THE LOOK SINCE 2026-10-03 (the
// mixed-work fixes, MW1): it repointed a link in the copy, and that was told
// nowhere when it ran beside a styling change.
const LINK_SAID = " Repointed 1 link across 1 page.";

// ── A QUOTED VALUE IS PART OF THE RULE (2026-09-26) ─────────────────────────
//
// Owner: *"Preserve meaningful whitespace and escapes inside quoted selectors,
// declarations and at-rule conditions. Normalize only where equivalence is
// established; uncertain differences should remain changed."*
//
// REPRODUCED on 933168ea, both money paths. The page carries
// `data-label="a  b"` — two spaces — and the stored sheet's rule selects it. The
// css lane, picked beside a menu change, answered the sheet back with the value
// respaced to ONE space: a selector that matches nothing. The rule key
// collapsed whitespace inside the quotes, so the working rule and the broken
// one read as the same rule — the compiler was sent `cssVerify: []`, nothing
// was judged, the edit published, and the screen said the look was updated.
//
// THE PAGE IS READ, NOT LISTED: `pageJudge` judges an attribute selector by the
// value the page's own source carries, character for character, the way a
// browser compares one — so the respaced selector is dead because the page
// says so. A class and a bare tag are read off the source the same way; any
// other selector is judged against `ON_PAGE`, as the rest of this file does.

const LABEL = "a  b";
const ON_LABEL = "[data-label=\"" + LABEL + "\"]";
const RESPACED_SEL = "[data-label=\"a b\"]";
const LABELLED = ON_LABEL + "{background:#f4e9d8}";
const RESPACED = RESPACED_SEL + "{background:#f4e9d8}";
const LABEL_PAGES = [
  { path: "index.tsx", source: page("/", "<section data-label=\"" + LABEL + "\" className=\"price\"><h2>Welcome</h2><p>Bread every morning.</p><Link to=\"/visit\">Find us</Link></section>") },
  STORED[1],
];

function pageJudge({ seen = null } = {}) {
  return (n, sent) => {
    const sheet = readCss(sent && sent.css).css;
    const looked = selectorsToJudge(sheet, sent && sent.cssVerify);
    const src = Object.values((sent && sent.files) || {}).join("\n");
    assert.ok(src.includes("data-label="), "the build carried no page source, so this judges nothing");
    const live = (s) => {
      let m = s.match(/^\[([\w-]+)="([^"]*)"\]$/);
      if (m) return src.includes(m[1] + "=\"" + m[2] + "\"");
      m = s.match(/^\.([\w-]+)$/);
      if (m) return new RegExp("className=\"(?:[^\"]*\\s)?" + m[1] + "(?:\\s[^\"]*)?\"").test(src);
      if (/^[a-z]+$/.test(s)) return src.includes("<" + s + ">") || src.includes("<" + s + " ");
      return ON_PAGE.includes(s);
    };
    const dead = looked.filter((s) => !live(s));
    if (seen) seen.push({ looked, dead });
    return { ok: true, checked: 2, pages: 1, findings: [], ...(dead.length ? { deadSelectors: dead, selectorsLooked: looked.length } : {}), landmarks: [] };
  };
}

function labelSite(mode, css = LABELLED) {
  const slug = "fail-" + mode + "-" + hex32().slice(0, 8);
  const b = bucket(slug);
  b.store.set("source/" + slug + "/pages.json", JSON.stringify(LABEL_PAGES));
  b.store.set(CONFIG_KEY(slug), JSON.stringify({ look: LOOK, css }));
  return { slug, b };
}

const sheetOf = (build) => JSON.parse(build).css;

test("the page judge reads the page: the stored rule is live and the respaced one is not", () => {
  const seen = [];
  const files = { "src/routes/index.tsx": LABEL_PAGES[0].source };
  pageJudge({ seen })(1, { css: LABELLED + "\n" + RESPACED, files });
  assert.deepEqual(seen, [{ looked: [ON_LABEL, RESPACED_SEL], dead: [RESPACED_SEL] }]);
});

// A QUOTED DECLARATION AND A QUOTED AT-RULE CONDITION, and nothing else moved:
// each changes the rule it belongs to, so each rule is sent to be judged. The
// check reads a rule's own selector — whether an `@scope` root exists is not
// something it reads — so what these cases hold is what is SENT.
const QUOTED_BEFORE = LABELLED + "\n.price{--currency:\"£  \"}\n@scope (" + ON_LABEL + "){p{color:#014421}}";
const QUOTED_AFTER = LABELLED + "\n.price{--currency:\"£ \"}\n@scope (" + RESPACED_SEL + "){p{color:#014421}}";
// THE SAME SHEET AS CSS READS IT — only whitespace CSS ignores added, every
// quoted value as it was.
const QUOTED_PRETTY = ON_LABEL + " {\n  background: #f4e9d8;\n}\n\n.price {\n  --currency: \"£  \";\n}\n\n/* scoped to the band */\n@scope (" + ON_LABEL + ") {\n  p {\n    color: #014421;\n  }\n}";

// ── A COMMENT IS A TOKEN BOUNDARY, NOT WHITESPACE (2026-09-26) ──────────────
//
// Owner: *"Preserve selector meaning across both readers. Do not simply delete
// every comment and concatenate tokens; that can change token boundaries. Keep
// uncertain differences classified as changed."*
//
// REPRODUCED on e49a370c, through the queued edit route. The page carries
// `<p className="a b">` and nothing inside it; the stored rule is `.a/**/.b{…}`
// — the compound `.a.b`, which reaches the paragraph — and the lane answered
// `.a .b{…}`, a descendant that reaches nothing. The rule key read the comment
// as whitespace, so the two were one rule: `cssVerify: []`, no selector judged,
// the stylesheet stored and published, and the screen said the look was
// updated. The other reader had the same defect the other way round: a working
// rule WRITTEN with a comment was handed to the judge with the comment turned
// into spaces — a descendant the page does not have.
//
// THE PAGE JUDGE READS THE BROWSER'S TABLE (`SPELLINGS`,
// test/fixtures/comment-boundary.mjs), which test/integration/site-build.mjs
// establishes in a real Chromium. A judged string the table does not hold is
// recorded as UNKNOWN and fails the case — never guessed at.

const HOURS_ASK = "Make the opening hours forest green.";
const HOURS_PAGES = [
  { path: "index.tsx", source: page("/", "<section><h2>Opening hours</h2>" + PARAGRAPH_JSX + "<Link to=\"/visit\">Find us</Link></section>") },
  STORED[1],
];
// The stored rule reaches the paragraph; the lane's rule reaches nothing.
const STORED_RULE = RULE(STORED_SEL);
const WRITTEN_RULE = RULE(WRITTEN_SEL);
const BOUNDARY = new Map(SPELLINGS.map((s) => [s.judged, s.live]));

function boundaryJudge({ seen = null } = {}) {
  return (n, sent) => {
    const sheet = readCss(sent && sent.css).css;
    const looked = selectorsToJudge(sheet, sent && sent.cssVerify);
    const src = Object.values((sent && sent.files) || {}).join("\n");
    assert.ok(src.includes(PARAGRAPH_JSX), "the build carried no page with the paragraph, so this judges nothing");
    const unknown = looked.filter((s) => !BOUNDARY.has(s));
    const dead = looked.filter((s) => BOUNDARY.get(s) !== true);
    if (seen) seen.push({ looked, dead, unknown });
    return { ok: true, checked: 2, pages: 1, findings: [], ...(dead.length ? { deadSelectors: dead, selectorsLooked: looked.length } : {}), landmarks: [] };
  };
}

function hoursSite(mode, css = STORED_RULE) {
  const slug = "fail-" + mode + "-" + hex32().slice(0, 8);
  const b = bucket(slug);
  b.store.set("source/" + slug + "/pages.json", JSON.stringify(HOURS_PAGES));
  b.store.set(CONFIG_KEY(slug), JSON.stringify({ look: LOOK, css }));
  return { slug, b };
}

test("the page judge reads the browser's table: the stored rule reaches the paragraph and the one the lane wrote does not", () => {
  const seen = [];
  const files = { "src/routes/index.tsx": HOURS_PAGES[0].source };
  boundaryJudge({ seen })(1, { css: STORED_RULE + "\n" + WRITTEN_RULE, files });
  assert.deepEqual(seen, [{ looked: [STORED_SEL, WRITTEN_SEL], dead: [WRITTEN_SEL], unknown: [] }]);
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
const LOOK_SAID = "Updated the look — the design.";
const TIMEOUT = Object.assign(new Error("The operation was aborted due to timeout"), { name: "TimeoutError" });

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
    return new Response("no stub (test fixture)", { status: 400 });
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
  assert.equal(refunded.said.text, STOPPED + " This edit cost you nothing. Reading your message cost 2 credits.");
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
  assert.equal(held.said.text, STOPPED + " Reading your message cost 2 credits.");
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

// A REFUSAL WITH NO SENTENCE — a reply stored before, or an older Worker's —
// is said in the platform's own words, then what each recorded. Driven through
// the composer alone: every refusal the route writes today carries a sentence.
test("a refusal with no sentence of its own says what the edit and the routing call recorded", () => {
  const charged = editBrowserReply({ ok: false, error: "compile", cost: 1 }, false, ROUTED);
  assert.equal(charged.text, "That edit didn't finish, so nothing was published. This edit cost 1 credit. Reading your message cost 2 credits.");
  const unknown = editBrowserReply({ ok: false, error: "compile" }, false, ROUTED);
  assert.equal(unknown.text, "That edit didn't finish, so nothing was published. Reading your message cost 2 credits.");
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
      assert.equal(r.text, "I couldn’t read the answer to that change, so I can’t tell whether it went through. Asking for it again could make the change twice.", label);
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
