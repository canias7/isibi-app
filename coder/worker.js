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
import { runMentionJobs } from "./src/coder-mentions.mjs";
import { runWatchedJobs, holdDecision, BUSY_PROBE_MS } from "./src/coder-watch.mjs";
import { controlKeySync } from "./src/coder-control.mjs";
import { flyOn, flyBox, runFlyMachines, dropFlyMachine } from "./src/coder-fly.mjs";

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
    this.envVars = { ...(env.XAI_API_KEY ? { XAI_API_KEY: env.XAI_API_KEY } : {}), ...(env.CODER_MODEL ? { CODER_MODEL: env.CODER_MODEL } : {}), ...(this.controlKey ? { CODER_CONTROL_KEY: this.controlKey } : {}) };
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
  if (flyOn(env)) return { kind: "fly", sign, container: (name) => { const box = flyBox(env, name); return { fetch: (req) => box.fetch(sign(req)) }; }, drop: (name) => dropFlyMachine(env, name) };
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
    const coder = (req, who) => handleCoder(req, env, ctx, { authUser: async () => who, container: m.container, dropMachine: m.drop });
    ctx.waitUntil(runMentionJobs(env, { coder }).catch((e) => console.log("coder jobs: " + String((e && e.message) || e).slice(0, 200))));
    ctx.waitUntil(runWatchedJobs(env, { coder }).catch((e) => console.log("coder watch: " + String((e && e.message) || e).slice(0, 200))));
    // FLY.IO (2026-11-07): machines with nothing to do for 10 minutes are stopped, old ones removed.
    if (m.kind === "fly") ctx.waitUntil(runFlyMachines(env, { sign: m.sign }).catch((e) => console.log("coder fly: " + String((e && e.message) || e).slice(0, 200))));
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
    } else if (url.pathname === LIVE_PATH) {
      // THE CHAT SAVED AS IT GOES (2026-11-06, like Claude Code): a job's own pass, not a user.
      res = await handleLive(request, env);
    } else if (url.pathname.startsWith("/api/coder/")) {
      const m = machinesFor(env);
      res = await handleCoder(request, env, ctx, { authUser: (r) => authUser(r, env), container: m.container, dropMachine: m.drop });
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
