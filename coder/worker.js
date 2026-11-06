// CODER'S WORKER: gofarther.dev (the page and /api/coder/*), its own
// container and its own storage.
import { Container, getContainer } from "@cloudflare/containers";
import { handleCoder } from "./src/coder-routes.mjs";
import { authUser } from "./src/coder-auth.mjs";
import { corsHeaders } from "./src/coder-cors.mjs";
import { servePage } from "./src/coder-page.mjs";
import { handleSignin } from "./src/coder-signin.mjs";
import { handleEgress, EGRESS_PATH } from "./src/coder-egress.mjs";
import { runMentionJobs } from "./src/coder-mentions.mjs";

/**
 * CODER'S CONTAINER: a developer machine (Node, Python, git, build tools), one
 * per project. It gets the AI key it calls Grok with and nothing else; the
 * commands it runs never see even that (`container/coder-checks.mjs`).
 */
/** The key that locks Coder's machine's control panel, made from CODER_TOKEN_KEY (never the key itself). */
export function controlKeySync(tokenKey) {
  // A plain, fixed mixing (no secret leaves): FNV-1a over a label and the key, 4 rounds, hex.
  let out = "";
  for (let round = 0; round < 4; round++) {
    let h = 0x811c9dc5 ^ round;
    for (const ch of "coder-control:" + round + ":" + tokenKey) { h ^= ch.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
    out += h.toString(16).padStart(8, "0");
  }
  return out;
}

export class CoderContainer extends Container {
  defaultPort = 8080;
  sleepAfter = "10m";
  constructor(ctx, env, options) {
    super(ctx, env, options);
    this.envVars = { ...(env.XAI_API_KEY ? { XAI_API_KEY: env.XAI_API_KEY } : {}), ...(env.CODER_MODEL ? { CODER_MODEL: env.CODER_MODEL } : {}), ...(env.CODER_TOKEN_KEY ? { CODER_CONTROL_KEY: controlKeySync(env.CODER_TOKEN_KEY) } : {}) };
  }
}

export default {
  // EVERY MINUTE: @coder jobs started from GitHub comments get their answer
  // posted back when they end (coder-mentions.mjs).
  async scheduled(event, env, ctx) {
    if (env.CODER_ON !== "on") return;
    const container = (name) => { const box = getContainer(env.CODER_CONTAINER, name); const key = env.CODER_TOKEN_KEY ? controlKeySync(env.CODER_TOKEN_KEY) : ""; return { fetch: (req) => { const r = new Request(req); if (key) r.headers.set("x-coder-key", key); return box.fetch(r); } }; };
    ctx.waitUntil(runMentionJobs(env, { coder: (req, who) => handleCoder(req, env, ctx, { authUser: async () => who, container }) }).catch((e) => console.log("coder jobs: " + String((e && e.message) || e).slice(0, 200))));
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
    } else if (url.pathname.startsWith("/api/coder/")) {
      res = await handleCoder(request, env, ctx, {
        authUser: (r) => authUser(r, env),
        // Every call to Coder's machine carries the control key (the audit, 2026-11-05).
        container: (name) => { const box = getContainer(env.CODER_CONTAINER, name); const key = env.CODER_TOKEN_KEY ? controlKeySync(env.CODER_TOKEN_KEY) : ""; return { fetch: (req) => { const r = new Request(req); if (key) r.headers.set("x-coder-key", key); return box.fetch(r); } }; },
      });
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
