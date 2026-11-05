// CODER'S WORKER: gofarther.dev (the page and /api/coder/*), its own
// container and its own storage.
import { Container, getContainer } from "@cloudflare/containers";
import { handleCoder } from "./src/coder-routes.mjs";
import { authUser } from "./src/coder-auth.mjs";
import { corsHeaders } from "./src/coder-cors.mjs";
import { servePage } from "./src/coder-page.mjs";
import { handleSignin } from "./src/coder-signin.mjs";

/**
 * CODER'S CONTAINER: a developer machine (Node, Python, git, build tools), one
 * per project. It gets the AI key it calls Grok with and nothing else; the
 * commands it runs never see even that (`container/coder-checks.mjs`).
 */
export class CoderContainer extends Container {
  defaultPort = 8080;
  sleepAfter = "10m";
  constructor(ctx, env, options) {
    super(ctx, env, options);
    this.envVars = { ...(env.XAI_API_KEY ? { XAI_API_KEY: env.XAI_API_KEY } : {}), ...(env.CODER_MODEL ? { CODER_MODEL: env.CODER_MODEL } : {}) };
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const cors = corsHeaders(request, env);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    let res;
    if (url.pathname.startsWith("/api/auth/")) {
      res = await handleSignin(request, env);
    } else if (url.pathname.startsWith("/api/coder/")) {
      res = await handleCoder(request, env, ctx, {
        authUser: (r) => authUser(r, env),
        container: (name) => getContainer(env.CODER_CONTAINER, name),
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
