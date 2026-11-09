// CODER'S WORKER: gofarther.dev (the page and /api/coder/*), its own
// container and its own storage.
import { Container, getContainer } from "@cloudflare/containers";
import { handleCoder } from "./src/coder-routes.mjs";
import { authUser } from "./src/coder-auth.mjs";
import { corsHeaders } from "./src/coder-cors.mjs";
import { servePage } from "./src/coder-page.mjs";
import { handleSignin } from "./src/coder-signin.mjs";
import { handleEgress, EGRESS_PATH } from "./src/coder-egress.mjs";
import { handleLive, LIVE_PATH } from "./src/coder-live.mjs";
import { handleGit, GIT_PATH } from "./src/coder-git.mjs";
import { handleModel, MODEL_PATH } from "./src/coder-model-gate.mjs";
import { runMentionJobs, installationToken } from "./src/coder-mentions.mjs";
import { runReviewJobs } from "./src/coder-review.mjs";
import { runWatchedJobs, holdDecision, BUSY_PROBE_MS } from "./src/coder-watch.mjs";
import { controlKeySync } from "./src/coder-control.mjs";
import { flyOn, flyBox, runFlyMachines, dropFlyMachine, snapshotChat, cacheUsable, copyState } from "./src/coder-fly.mjs";
import { runGloopySchedules } from "./src/gloopy-schedules.mjs";

/**
 * CODER'S CONTAINER: a developer machine (Node, Python, git, build tools), one
 * per project. It gets the AI key it calls Grok with and nothing else; the
 * commands it runs never see even that (`container/coder-checks.mjs`).
 */
/** The key that locks Coder's machine's control panel (src/coder-control.mjs). */
export { controlKeySync };

export class CoderContainer extends Container {
  defaultPort = 8080;
  sleepAfter = "10m";
  constructor(ctx, env, options) {
    super(ctx, env, options);
    this.controlKey = env.CODER_TOKEN_KEY ? controlKeySync(env.CODER_TOKEN_KEY) : "";
    // No Grok key here (2026-11-07): the machine's AI calls go through the Worker (MODEL_PATH).
    this.envVars = { ...(env.CODER_MODEL ? { CODER_MODEL: env.CODER_MODEL } : {}), ...(this.controlKey ? { CODER_CONTROL_KEY: this.controlKey } : {}) };
  }
  // NEVER ASLEEP WITH WORK ON IT (2026-11-06, the old builder's way; like Claude
  // Code's cloud sessions): after 10 quiet minutes the library would stop the
  // machine; first it is asked whether a job is working or waiting to be saved
  // (its /busy), and then it stays awake. Silent, idle, or busy past its time:
  // it sleeps as before (coder-watch.mjs, holdDecision).
  async onActivityExpired() {
    if (!this.container.running) return;
    let state = null;
    try {
      const ask = this.containerFetch(new Request("http://coder/busy", { headers: this.controlKey ? { "x-coder-key": this.controlKey } : {} }), this.defaultPort);
      const r = await Promise.race([ask, new Promise((ok) => setTimeout(() => ok(null), BUSY_PROBE_MS))]);
      state = r && r.ok ? await r.json() : null;
    } catch { state = null; }
    const d = holdDecision(state);
    console.log("coder machine: " + (d.hold ? "kept awake" : "may sleep") + " (" + d.why + ")");
    if (d.hold) return;
    await this.stop();
  }
}

/**
 * CODER'S MACHINES, ONE PER CHAT: small VMs on Fly.io when switched on and set
 * up (CODER_MACHINES "fly", owner 2026-11-07: like Claude Code's), otherwise
 * Cloudflare's containers, as before. Every call to a machine carries the
 * control key (the audit, 2026-11-05).
 */
export function machinesFor(env) {
  const key = env.CODER_TOKEN_KEY ? controlKeySync(env.CODER_TOKEN_KEY) : "";
  const sign = (req) => { const r = new Request(req); if (key) r.headers.set("x-coder-key", key); return r; };
  // On Fly.io each machine has its own lock key (step 2, 2026-11-07): flyBox adds it, per machine.
  // THE ENVIRONMENT'S SAVED COPY OF ITS SETUP (2026-11-07, like Claude Code's cache): Fly.io only.
  if (flyOn(env)) return { kind: "fly", sign, container: (name) => { const box = flyBox(env, name); return { fetch: (req) => box.fetch(req) }; }, drop: (name) => dropFlyMachine(env, name), snapshot: (name) => snapshotChat(env, name), cacheUsable: (c, key) => cacheUsable(env, c, key), copyState: (c) => copyState(env, c) };
  return { kind: "cloudflare", sign, container: (name) => { const box = getContainer(env.CODER_CONTAINER, name); return { fetch: (req) => box.fetch(sign(req)) }; }, drop: async () => {} };
}

export default {
  // EVERY MINUTE: @coder jobs started from GitHub comments get their answer
  // posted back when they end (coder-mentions.mjs), and every running job is
  // kept awake and saved when it ends, with or without an open tab, like
  // Claude Code (coder-watch.mjs).
  async scheduled(event, env, ctx) {
    if (env.CODER_ON !== "on") return;
    const m = machinesFor(env);
    const coder = (req, who) => handleCoder(req, env, ctx, { authUser: async () => who, container: m.container, dropMachine: m.drop, snapshot: m.snapshot, cacheUsable: m.cacheUsable, copyState: m.copyState });
    const work = [];
    const job = (p) => { work.push(p); ctx.waitUntil(p); };
    job(runMentionJobs(env, { coder }).catch((e) => console.log("coder jobs: " + String((e && e.message) || e).slice(0, 200))));
    job(runWatchedJobs(env, { coder }).catch((e) => console.log("coder watch: " + String((e && e.message) || e).slice(0, 200))));
    // GLOOPY'S SCHEDULES (2026-11-09): the runs that are due start now, each as a message for that person's Gloopy.
    job(runGloopySchedules(env, { coder }).catch((e) => console.log("gloopy schedules: " + String((e && e.message) || e).slice(0, 200))));
    // CODE REVIEW (owner item 11, like Claude Code's): the reviews GitHub's news asked for, as Coder's app.
    job(runReviewJobs(env, { token: (i) => installationToken(env, i) }).catch((e) => console.log("coder review: " + String((e && e.message) || e).slice(0, 200))));
    // FLY.IO (2026-11-07): machines with nothing to do for 10 minutes are stopped, old ones removed.
    if (m.kind === "fly") job(runFlyMachines(env).catch((e) => console.log("coder fly: " + String((e && e.message) || e).slice(0, 200))));
    // ALL OF IT AWAITED (live test, 2026-11-07): Cloudflare waits for what this returns, up to 15
    // minutes, and a GitHub job's start can take minutes (its machine first fetching Coder's image).
    await Promise.all(work);
  },
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const cors = corsHeaders(request, env);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    let res;
    if (url.pathname.startsWith("/api/auth/")) {
      res = await handleSignin(request, env);
    } else if (url.pathname === EGRESS_PATH) {
      // KEYS ADDED HERE, never on the machine (2026-11-06, like Claude Code): a job's pass, not a user.
      res = await handleEgress(request, env);
    } else if (url.pathname.startsWith(GIT_PATH)) {
      // YOUR GITHUB LOGIN STAYS HERE (2026-11-07, like Claude Code): the machine's git, with its job's pass.
      res = await handleGit(request, env);
    } else if (url.pathname === MODEL_PATH) {
      // YOUR GROK KEY STAYS HERE (2026-11-07, like Claude Code): the machine's AI calls, with its job's pass.
      res = await handleModel(request, env);
    } else if (url.pathname === LIVE_PATH) {
      // THE CHAT SAVED AS IT GOES (2026-11-06, like Claude Code): a job's own pass, not a user.
      res = await handleLive(request, env, { waitUntil: (p) => ctx.waitUntil(p) });
    } else if (url.pathname.startsWith("/api/coder/")) {
      const m = machinesFor(env);
      res = await handleCoder(request, env, ctx, { authUser: (r) => authUser(r, env), container: m.container, dropMachine: m.drop, snapshot: m.snapshot, cacheUsable: m.cacheUsable, copyState: m.copyState });
    } else if (url.pathname === "/health") {
      res = Response.json({ ok: true, service: "coder", on: env.CODER_ON === "on" });
    } else if (env.ASSETS && (request.method === "GET" || request.method === "HEAD")) {
      // THE APP ITSELF (2026-11-05: gofarther.dev is now only Coder): the page,
      // its scripts and styles, from public/. Any other path gets the page.
      res = await servePage(request, env);
    } else res = Response.json({ error: "not found" }, { status: 404 });
    const out = new Response(res.body, res);
    for (const [k, v] of Object.entries(cors)) out.headers.set(k, v);
    return out;
  },
};
