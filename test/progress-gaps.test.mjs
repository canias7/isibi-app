// THE PROGRESS FEATURE'S REMAINING GAPS, REPRODUCED AND CLOSED (2026-10-06).
//
// The owner, after Codex reproduced the first of them: *"a standalone partial
// result being displayed as fully finished … Derive the displayed state and
// model-written summary from the actual outcome across Edit and Add-on,
// covering partial results, clarification, handoffs and unverified outcomes;
// unverified must not select a sentence saying the requested change is
// actively happening … Close the documented race where a failed or timed-out
// progress close lets a writer commit after its last job-state check and after
// finalization … Fix makeProgress dropping a milestone when JOB_PROGRESS
// fails: retain its identity and retry automatically while appropriate …
// prevent duplicates when the first delivery landed but its response was
// lost."*
//
// Every case runs the real Worker on the stateful platform
// (`test/fixtures/request-flow.mjs`) and, where a page reads the answer, the
// real functions of public/chat.js in a VM (`test/fixtures/browser-page.mjs`)
// answered by that same Worker — so what the card shows is read off what the
// server really served, never off a body the case wrote.
//
//   OUTCOME   the card of a job found from another device, and a request
//             part, named by the job's real outcome: partial, waiting for an
//             answer, handed over, unverified, finished, not done, stopped;
//   RACE      a line committed after the job's end — its close failed — is
//             never served: not by the poll, a request's view, the list, a
//             reload or another device; a line committed while the job ran is
//             shown at once, and one whose confirmation was lost is confirmed
//             later while the job still runs;
//   RECORDER  a milestone whose delivery fails is kept, with its number, and
//             sent again on its own — no other milestone, no page — until it
//             is answered; one that landed and whose answer was lost is
//             recorded once; a refusal is not sent again; order is kept.
//
// ⚠ SUPPLIED-MODEL PROOF ONLY. Every model answer is supplied: nothing here
// shows what a real model writes, how long it takes or what it costs.
import test from "node:test";
import assert from "node:assert/strict";
import { platform, sendMessage, pump, tick, call, settle, deliver, browserBody, T, USER } from "./fixtures/request-flow.mjs";
import { installCompiler } from "./fixtures/cf-containers.mjs";
import { writtenPage } from "./fixtures/addon-route.mjs";
import util from "node:util";
import * as NU from "../scripts/narration-usage.mjs";
import { page as pageSrc } from "./fixtures/live-ask.mjs";
import { page as openPage } from "./fixtures/browser-page.mjs";
import { gatewayKey, signJobToken } from "../builder/job-gateway.mjs";
import { makeContainerEnv } from "../builder/container-env.mjs";
import { progressKey, TASK_BATCH } from "../builder/site-progress.mjs";
import { editJobOutcome } from "../builder/request.mjs";
import { readFileSync } from "node:fs";

const PAGE = (path, name) => ({ path, name, purpose: "what " + name + " is for", sections: ["a band"], components: ["section-header"] });
const GATE_MS = 20_000;
const gate = () => {
  let open, reach, timer;
  const g = { opened: new Promise((r) => { open = r; }) };
  g.reached = new Promise((r, no) => { reach = r; timer = setTimeout(() => no(new Error("the case's gate was never reached")), GATE_MS); timer.unref(); });
  g.reached.catch(() => {});
  g.open = open;
  g.reach = () => { clearTimeout(timer); reach(); };
  return g;
};
const slugOf = (k) => "pg-" + k + "-" + Math.random().toString(16).slice(2, 8);
const settleMs = (ms = 20) => new Promise((r) => setTimeout(r, ms));
let platformNow = null;
const anyTask = (m) => !!(m && m.body && m.body.kind === "edit-progress");
const isTask = (m) => anyTask(m) && !!platformNow && platformNow.jobs.has(m.body.id);
const takeTask = (P) => { const i = P.queue.findIndex((m) => anyTask(m) && P.jobs.has(m.body.id)); assert.ok(i >= 0, "no progress task was queued"); return P.queue.splice(i, 1)[0]; };
const jobMsg = (P) => { const i = P.queue.findIndex((m) => m.body && m.body.kind === "site-edit"); assert.ok(i >= 0, "no job was filed"); return P.queue.splice(i, 1)[0]; };

async function withPlatform(opts, fn) {
  const compiler = installCompiler();
  const P = platform(opts);
  platformNow = P;
  try { return await fn(P); } finally { P.close(); compiler.uninstall(); platformNow = null; }
}

// ── THE PAGE, ON ANOTHER DEVICE, ANSWERED BY THE REAL WORKER ─────────────────

/** A page load that knows nothing of the site's work, every request answered by the platform's own Worker. */
function device(P, { polls = true } = {}) {
  return openPage({
    site: { id: "origin-1", slug: P.slug, react: true, name: "Harbour Loaf", url: "https://" + P.slug + ".gofarther.app/", pages: [{ path: "/" }], msgs: [] },
    timers: true,
    answer: (url, method, body) => {
      // A POLL THAT NEVER ANSWERS (`polls: false`): the card as the list alone drew it.
      if (!polls && url.startsWith("/api/site/edit/")) return null;
      return call(P, method, url, body).then((r) => ({ status: r.status, body: r.body, headers: r.headers ? Object.fromEntries(r.headers) : {} }));
    },
  });
}
const pageSettle = async (p, until, rounds = 200) => { for (let i = 0; i < rounds && !until(); i++) await settleMs(5); };
const unesc = (t) => String(t == null ? "" : t).replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
/** The progress lines in a piece of the page's markup, in order. */
const linesIn = (html) => [...((String(html).match(/<ul class="st-req-prog[^"]*">(.*?)<\/ul>/) || [])[1] || "").matchAll(/<li(?: class="live")?>([^<]*)<\/li>/g)].map((m) => unesc(m[1]));
/** A found job's card as the page draws it: its line (or words), its fixed label, its lines. */
function cardOf(p, job) {
  const html = p.ctx.siteJobCardHTML({ jobCard: job }, p.s);
  return {
    html,
    words: unesc((html.match(/<span class="st-req-words">(.*?)<\/span>/) || [])[1]),
    label: unesc((html.match(/<span class="st-req-status">(.*?)<\/span>/) || [])[1]),
    lines: linesIn(html),
  };
}
/** A request's card, part by part: each one's line (or words) and its fixed label. */
function partsOf(p, key) {
  const html = p.ctx.siteRequestHTML({ request: key }, p.s);
  return [...html.matchAll(/<li class="st-req-part[^"]*"><span class="st-req-words">(.*?)<\/span><span class="st-req-status">(.*?)<\/span>/g)].map((m) => ({ words: unesc(m[1]), label: unesc(m[2]) }));
}

/** What the page posts for a decision, filed as the page files it, under a key of its own. */
async function filePage(P, d, instruction, idem) {
  const site = { slug: P.slug, name: "Harbour Loaf", react: true, pages: [{ path: "/" }, { path: "/visit" }], msgs: [] };
  const posted = browserBody(site, d, instruction);
  // A PAGE-FILED JOB: with the request flow on, an addition posted straight to
  // the route is taken on as a request (round 7), so the page's own post is made
  // with it off for this one call, as the route files a job of its own then.
  const was = P.env.REQUEST_FLOW;
  if (d.intent === "addon") P.env.REQUEST_FLOW = "off";
  let filed;
  try { filed = await call(P, "POST", posted.url, { ...posted.body, idem }); } finally { P.env.REQUEST_FLOW = was; }
  assert.ok([200, 202].includes(filed.status), JSON.stringify(filed.body));
  assert.ok(filed.body && typeof filed.body.job === "string", "the page's post filed no job: " + JSON.stringify(filed.body));
  return filed.body.job;
}

// A MENU ON TWO PAGES, for the add-on that sets a menu link aside (request-flow's M4).
const NAV = (items) => "<SiteHeader links={[" + items.map(([l, h]) => "{ label: \"" + l + "\", href: \"" + h + "\" }").join(", ") + "]} />";
const NAV_PAGES = [
  { path: "index.tsx", source: pageSrc("/", NAV([["Home", "/"], ["Visit", "/visit"]]) + "<section className=\"hero\"><h1>Harbour Loaf</h1><p>Bread from the harbour.</p></section>") },
  { path: "visit.tsx", source: pageSrc("/visit", NAV([["Home", "/"], ["Visit", "/visit"]]) + "<section className=\"come\"><h1>Come to the bakery</h1><p>The street.</p></section>") },
];
const GALLERY_LINK = "Add a gallery page and put a link to it in the menu";
const DESC = "Change the site description to say we bake overnight sourdough";
const QD = { text: "Which word should lead — overnight or slow?", options: ["Overnight", "Slow"] };
const OPEN = "Change the opening line on the home page to say we open at 8";
const LINE_FROM = "Bread from the harbour, every morning.";
const textAnswer = (to) => (args) => {
  const lines = String(args.messages[0].content).split("\n");
  const at = lines.find((l) => l.includes("[index.tsx] " + LINE_FROM));
  return { edits: [{ id: Number(String(at || "-1.").split(".")[0]), to }] };
};
/** The supplied task-lines writer's line for a state, as the fixture marks it. */
const said = (state, words) => "(" + state + ") " + words;

// ─────────────────────────────────────────────────────────────────────────────
// OUTCOME — THE CARD SAYS WHAT REALLY HAPPENED
// ─────────────────────────────────────────────────────────────────────────────

test("OUTCOME 0 — THE RULE, ONE ROW AT A TIME: held for review before anything else; queued or running from the row; stopped from the row or the answer; no answer is not done; a hand-over is a hand-over; a success that asked is waiting, one that named work left undone or put a part off is partial; a question or a refusal that asks is waiting; anything else not done", () => {
  const row = (state, body, x = {}) => ({ state, billing: "finalized", result: body === undefined ? null : { status: x.status || 200, body: JSON.stringify(body) }, ...x });
  const cases = [
    [row("failed", { ok: true }, { needs_review: true }), "edit", "unverified"],
    [row("editing", undefined, { needs_review: true }), "edit", "unverified"],
    [row("queued"), "edit", "queued"],
    [row("editing"), "edit", "running"],
    [row("publishing"), "addon", "running"],
    [row("cancelled"), "edit", "cancelled"],
    [row("failed", { ok: false, error: "cancelled" }), "edit", "cancelled"],
    [row("failed", { ok: false, error: "x", detail: "cancelled" }), "edit", "cancelled"],
    [row("lost", undefined, { billing: "refunded" }), "edit", "failed"],
    [row("failed", { ok: false, error: "stale" }, { billing: "refunded" }), "edit", "failed"],
    [row("done", undefined), "edit", "done"],
    [row("done", { ok: false, escalate: true, layer: "text" }), "edit", "handoff"],
    [row("done", { ok: false, escalate: true }), "addon", "handoff"],
    [row("done", { ok: true, recovered: true }), "edit", "done"],
    [row("done", { ok: true, clarify: { id: "q1", text: "Which one?" } }), "edit", "waiting"],
    [row("done", { ok: true, partial: [{ page: "/visit", layer: "picture", error: "no-photo" }] }), "edit", "partial"],
    [row("done", { ok: true, deferred: ["make the footer darker"] }), "edit", "partial"],
    [row("done", { ok: true, notAdded: [{ name: "Gallery link", why: "left-out" }] }), "addon", "partial"],
    [row("done", { ok: true, notAdded: [{ name: "Gallery link", why: "left-out" }] }), "edit", "done"],
    [row("done", { ok: true }), "addon", "done"],
    [row("failed", { ok: false, error: "clarify", clarify: { id: "q2", text: "Which page?" } }), "edit", "waiting"],
    [row("failed", { ok: false, error: "no-match", clarify: { id: "q3", text: "Did you mean the hour lesson?" } }), "edit", "waiting"],
    [row("failed", { ok: false, error: "no-match", msg: "No such row." }), "edit", "failed"],
    [row("failed", { ok: true }, { status: 503 }), "edit", "failed"],
  ];
  for (const [r, op, want] of cases) assert.equal(editJobOutcome(r, op), want, JSON.stringify({ state: r.state, review: r.needs_review, op, body: r.result && r.result.body }));
  for (const bad of [null, undefined, "done", {}, { state: 7 }, { state: "mystery" }]) assert.equal(editJobOutcome(bad, "edit"), null, JSON.stringify(bad));
});

// ─────────────────────────────────────────────────────────────────────────────
// RACE — NO LINE AFTER THE FINAL REPLY, EVEN WHEN THE JOB'S CLOSE FAILS
// ─────────────────────────────────────────────────────────────────────────────

/** An add-on whose page designer waits on `g`: the job holds there, its first milestone recorded. */
const heldAddon = (g) => ({
  route: [{ intent: "addon" }], [T.adds]: { kinds: ["page"] },
  "add:page": async () => { g.reach(); await g.opened; return { page: [PAGE("/gallery", "Gallery")] }; },
  [T.pages]: { pages: [writtenPage("/gallery")] },
});
const isClose = (job) => (k, body) => k === progressKey(job) && (() => { try { return JSON.parse(String(body)).closed !== null; } catch { return false; } })();

// ─────────────────────────────────────────────────────────────────────────────
// RECORDER — A MILESTONE WHOSE DELIVERY FAILS IS KEPT AND SENT AGAIN
// ─────────────────────────────────────────────────────────────────────────────

/**
 * THE JOB RUN AS THE CONTAINER RUNS IT: its recorder writes through the
 * gateway's /progress under the job's own token (`makeContainerEnv`), and
 * `fault(body, n)` decides what the network does with each call — `throw`
 * before it reaches the Worker, `lose` its answer after the Worker took it,
 * or answer with a status of its own.
 */
async function viaContainer(P, job, fault) {
  P.env.SITE_SECRETS_KEY = "platform-secret";
  const gk = await gatewayKey("platform-secret");
  const tok = await signJobToken({ id: job, slug: P.slug, uid: USER.id, exp: Math.floor(Date.now() / 1000) + 600 }, gk);
  const sent = [];
  const env = makeContainerEnv({
    gateway: { url: "https://gofarther.dev/api/job/" + job, token: tok },
    fetch: async (url, init) => {
      const body = JSON.parse(init.body);
      const n = sent.filter((b) => b.op === body.op && b.seq === body.seq).length;
      sent.push(body);
      const how = fault(body, n);
      if (how === "throw") throw new TypeError("fetch failed");
      if (Number.isInteger(how)) return new Response(JSON.stringify({ error: "x" }), { status: how });
      const res = await call(P, "POST", new URL(url).pathname, body, init.headers.authorization);
      if (how === "lose") throw new TypeError("network connection lost");
      return new Response(JSON.stringify(res.body || {}), { status: res.status });
    },
  });
  P.env.JOB_PROGRESS = env.JOB_PROGRESS;
  return sent;
}
const until = async (cond, ms = 6000) => { const end = Date.now() + ms; while (!cond() && Date.now() < end) await settleMs(10); return cond(); };
