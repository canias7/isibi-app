#!/usr/bin/env node
/**
 * DRIVE THE WORKER'S OWN HANDLER OVER REAL HTTP, locally. `npm run serve`.
 *
 * This is not a second implementation of anything: it imports `src/worker.mjs`
 * and calls the SAME `fetch` a deployed Worker would, so what gets exercised is
 * the real handler, the real auth, the real store and the real Supabase project.
 * The only thing it substitutes is Cloudflare's `ctx.waitUntil`, and it
 * substitutes it with something that behaves the same way in the way that matters:
 * THE RESPONSE GOES OUT FIRST AND THE WORK CARRIES ON AFTER IT.
 *
 * Settings come from the environment, never from a file in the repository:
 *   SUPABASE_URL  SUPABASE_SERVICE_KEY  SUPABASE_JWT_SECRET  [MODEL] [PORT]
 *
 * THE SERVICE KEY IS READ FROM THE ENVIRONMENT AND NEVER PRINTED. The banner
 * reports each setting's LENGTH, which is enough to tell "set" from "not set" and
 * useless to anybody reading a log.
 */
import http from "node:http";
import worker from "../src/worker.mjs";
import { SETTINGS, missingSettings } from "../src/worker.mjs";

const PORT = Number(process.env.PORT) || 8787;
const env = { ...process.env };

const missing = missingSettings(env);
console.log("settings:");
for (const [k, why] of Object.entries(SETTINGS)) {
  const v = env[k];
  console.log(`  ${k.padEnd(22)} ${v ? `set (${v.length} chars)` : "MISSING"}   — ${why}`);
}
console.log(`  ${"MODEL".padEnd(22)} ${env.MODEL ?? "stand-in (default)"}`);
if (missing.length) {
  console.error(`\nNot configured: ${missing.join(", ")}.`);
  console.error("Every request will answer 503 with that list. Set them and restart.");
}

// The in-flight background work, so the process can be asked to wait for it
// rather than exiting in the middle of a run.
const inFlight = new Set();
const ctx = {
  waitUntil(p) {
    const t = Promise.resolve(p).catch((e) => console.error("dispatch failed:", String(e?.message ?? e)));
    inFlight.add(t);
    t.finally(() => inFlight.delete(t));
  },
};

const server = http.createServer(async (req, res) => {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  const request = new Request(new URL(req.url, `http://localhost:${PORT}`), {
    method: req.method,
    headers: req.headers,
    body: req.method === "GET" || req.method === "HEAD" ? undefined : body,
  });

  let out;
  try {
    out = await worker.fetch(request, env, ctx);
  } catch (e) {
    console.error("handler threw:", e);
    out = new Response(JSON.stringify({ error: "internal error" }), { status: 500, headers: { "content-type": "application/json" } });
  }
  res.writeHead(out.status, Object.fromEntries(out.headers));
  res.end(Buffer.from(await out.arrayBuffer()));
  console.log(`${req.method} ${req.url} -> ${out.status}`);
});

server.listen(PORT, () => console.log(`\nlistening on http://127.0.0.1:${PORT}`));

process.on("SIGTERM", async () => { await Promise.allSettled([...inFlight]); server.close(); process.exit(0); });
process.on("SIGINT", async () => { await Promise.allSettled([...inFlight]); server.close(); process.exit(0); });
