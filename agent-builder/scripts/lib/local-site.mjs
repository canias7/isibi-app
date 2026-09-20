/**
 * THE SITE, SERVED LOCALLY, SO A REAL BROWSER CAN DRIVE IT.
 *
 * `local-stack.mjs` stands up the database and the engine's handlers; `serve.mjs` puts the
 * ENGINE's Worker on a port. Neither serves the half a PERSON touches — `public/index.html`,
 * `public/styles.css`, `public/chat.js` and the site Worker's own `/api/agent/*` block. So
 * every verification until now has been ROUTE-level: it proves what a request does and says
 * nothing about whether a browser can make that request by pressing the thing on screen.
 *
 * This is that missing half, and it is deliberately thin: the two things it owns are
 * STATIC FILES and the `/api/agent/*` dispatch, and the dispatch is a transcription of
 * `worker.js`'s own block rather than a second implementation of it — the real
 * `AGENT_ROUTES` membership test, the real `AGENT_POST_ROUTES` body rule, the real
 * `agentBodyMax` allowance, the real `handleAgentApi`, the real `makeAgentStore`.
 *
 * ── ⚠ WHAT IS SIMULATED, ALL OF IT, NAMED HERE ──────────────────────────────────
 *
 *   1. **AUTH, AND ONLY THE TOKEN→TENANT STEP OF IT.** `worker.js` calls `authUser`, which
 *      verifies the bearer against GoTrue over the network. There is no GoTrue on a laptop
 *      and no account of anybody's, so a token is looked up in a Map the caller supplies.
 *      **What that substitutes is the PROOF that a token belongs to an account; what it does
 *      NOT substitute is anything the tenant then does** — every filter, every ownership
 *      refusal and every 404 below it is the real one, which is the whole point of handing
 *      two different tokens to two browser contexts.
 *   2. **PostgREST** is `scripts/local-rest.mjs`, for the reason `local-stack.mjs` gives.
 *   3. **The queue** is an in-process doorbell, for the reason `local-stack.mjs` gives.
 *
 * **WHAT IS NOT SIMULATED**: the page, the stylesheet, the client script, the route
 * membership test, the body bound, the handler, the store, the tenant filter, the
 * database and every refusal it makes.
 *
 * ⚠ **IT NEVER TOUCHES THE HOSTED PROJECT AND HOLDS NO CREDENTIAL.** The key handed to the
 * store is the literal `local-service-role`, which is what the shim expects and what
 * nothing else would accept.
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
/** The site repository's root — two levels up from `agent-builder/scripts/lib`. */
export const SITE_ROOT = path.resolve(HERE, "..", "..", "..");

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".json": "application/json; charset=utf-8",
  ".woff2": "font/woff2",
  ".mp3": "audio/mpeg",
  ".txt": "text/plain; charset=utf-8",
};

/**
 * Stand the site up.
 *
 * @param {object} o
 * @param {{url: string}} o.rest    the PostgREST shim `local-stack` returned
 * @param {(runId: string) => Promise<void>|void} [o.ring]  the engine's doorbell, or null
 * @param {Map<string,string>} o.tokens  bearer → tenant uuid. THE SIMULATED STEP.
 * @param {(...a: unknown[]) => void} [o.log]
 */
export async function startLocalSite({ rest, ring = null, tokens, log = () => {} } = {}) {
  if (!rest?.url) throw new TypeError("startLocalSite: rest.url is required");
  if (!(tokens instanceof Map)) throw new TypeError("startLocalSite: tokens must be a Map");

  // Imported HERE rather than at module scope so this file can be loaded for its
  // SITE_ROOT alone without pulling the site's store in.
  const store = await import(path.join(SITE_ROOT, "agent-store.mjs"));
  const { handleAgentApi, makeAgentStore, AGENT_ROUTES, AGENT_POST_ROUTES, agentBodyMax } = store;

  const pub = path.join(SITE_ROOT, "public");
  /** Every request this server answered, so a check can assert which routes a PRESS reached. */
  const seen = [];

  const json = (res, status, body) => {
    const out = Buffer.from(JSON.stringify(body));
    res.writeHead(status, { "content-type": "application/json; charset=utf-8", "content-length": out.length });
    res.end(out);
  };

  const server = http.createServer(async (req, res) => {
    let url;
    try { url = new URL(req.url || "/", "http://127.0.0.1"); }
    catch { json(res, 400, { error: "bad url" }); return; }
    const pathname = url.pathname;

    // ── THE AGENT BUILDER'S STORE, the way `worker.js` dispatches it ──────────
    if (Object.hasOwn(AGENT_ROUTES, pathname)) {
      seen.push({ path: pathname, method: req.method });
      // ⚠ THE ONE SIMULATED STEP. `worker.js` has `authUser(request)` here.
      const bearer = /^Bearer (.+)$/.exec(req.headers.authorization || "")?.[1];
      const tenant = bearer ? tokens.get(bearer) : undefined;
      if (!tenant) { json(res, 401, { error: "sign in first" }); return; }

      let body = {};
      if (AGENT_POST_ROUTES.includes(pathname)) {
        const max = agentBodyMax(pathname) ?? 64 * 1024;
        const chunks = [];
        let n = 0;
        for await (const c of req) {
          n += c.length;
          if (n > max) { json(res, 413, { error: "that's too big to send" }); return; }
          chunks.push(c);
        }
        const raw = chunks.length ? Buffer.concat(chunks).toString("utf8") : "";
        if (raw) {
          try { body = JSON.parse(raw); }
          catch { json(res, 400, { error: "that wasn't readable as JSON" }); return; }
        }
        if (!body || typeof body !== "object" || Array.isArray(body)) { json(res, 400, { error: "that wasn't an object" }); return; }
      }

      let answer;
      try {
        answer = await handleAgentApi({
          path: pathname,
          method: req.method,
          query: url.searchParams,
          body,
          tenant,
          store: makeAgentStore({ fetch: (u, o) => fetch(u, o), url: rest.url, key: "local-service-role" }),
          ring,
          log: (...a) => log("  store:", ...a),
        });
      } catch (e) {
        log("  handler threw:", String(e?.stack ?? e));
        json(res, 500, { error: "internal error" });
        return;
      }
      if (!answer) { json(res, 500, { error: "that isn't wired up" }); return; }
      json(res, answer.status, answer.body);
      return;
    }

    // ── EVERYTHING ELSE IS A FILE OUT OF `public/`, byte for byte ─────────────
    if (req.method !== "GET" && req.method !== "HEAD") { json(res, 405, { error: "no" }); return; }
    const rel = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
    const file = path.join(pub, rel);
    // Fenced: a served path may not climb out of `public/`.
    if (!file.startsWith(pub + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      res.end("not here");
      return;
    }
    const buf = fs.readFileSync(file);
    res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream", "content-length": buf.length });
    res.end(req.method === "HEAD" ? undefined : buf);
  });

  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const origin = `http://127.0.0.1:${server.address().port}`;

  return {
    origin,
    seen,
    /** What this server was asked for since the last `sinceRoutes()`. */
    sinceRoutes() { return seen.splice(0); },
    async close() {
      // `closeAllConnections` because `close()` WAITS for open sockets, and a page
      // that is still open holds one — the recorded trap, met here on purpose.
      server.closeAllConnections?.();
      await new Promise((r) => server.close(r));
    },
  };
}
