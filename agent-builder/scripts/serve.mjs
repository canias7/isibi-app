#!/usr/bin/env node
/**
 * DRIVE THE WORKER'S OWN HANDLERS OVER REAL HTTP, locally. `npm run serve`.
 *
 * This is not a second implementation of anything: it imports `src/worker.mjs` and
 * calls the SAME `fetch`, the SAME `queue` and the SAME `scheduled` a deployed
 * Worker would, so what gets exercised is the real handler, the real auth, the real
 * store, the real queue functions and the real consumer.
 *
 * **WHAT IT SUBSTITUTES IS THE TRANSPORT, AND ONLY THE TRANSPORT.** Cloudflare
 * Queues is not reachable from a laptop, so the binding here is an in-process
 * doorbell that hands the run id straight to `worker.queue`. That changes nothing
 * about durability: the work is a ROW, committed before the response goes out, and
 * this doorbell is as losable as the real one — which is why the sweeper runs on a
 * timer below, exactly as the cron does in the deployment.
 *
 * Settings come from the environment, never from a file in the repository:
 *   SUPABASE_URL  SUPABASE_SERVICE_KEY  SUPABASE_PUBLISHABLE_KEY
 *   [SUPABASE_JWT_SECRET]  [MODEL]  [PORT]  [SWEEP_MS]
 *
 * THE SERVICE KEY IS READ FROM THE ENVIRONMENT AND NEVER PRINTED. The banner
 * reports each setting's LENGTH, which is enough to tell "set" from "not set" and
 * useless to anybody reading a log.
 */
import http from "node:http";
import worker, { SETTINGS, OPTIONAL, QUEUE_BINDING, missingSettings } from "../src/worker.mjs";

const PORT = Number(process.env.PORT) || 8787;
const SWEEP_MS = Number(process.env.SWEEP_MS) || 15_000;

// The in-flight background work, so the process can be asked to wait for it rather
// than exiting in the middle of a run.
const inFlight = new Set();
const track = (p) => {
  const t = Promise.resolve(p).catch((e) => console.error("  background failed:", String(e?.message ?? e)));
  inFlight.add(t);
  t.finally(() => inFlight.delete(t));
  return t;
};
const ctx = { waitUntil: track };

/**
 * The local doorbell. It RETURNS IMMEDIATELY and delivers afterwards, because the
 * whole claim being demonstrated is that the response does not wait for the work.
 */
const env = {
  ...process.env,
  [QUEUE_BINDING]: {
    send: async ({ runId }) => {
      track(Promise.resolve().then(() => worker.queue(
        { messages: [{ id: runId, body: { runId }, ack() {}, retry() {} }] }, env, ctx,
      )));
    },
  },
};

const missing = missingSettings(env);
console.log("settings:");
for (const [k, why] of Object.entries(SETTINGS)) {
  const v = process.env[k];
  console.log(`  ${k.padEnd(26)} ${v ? `set (${v.length} chars)` : "MISSING"}   — ${why}`);
}
for (const [k, why] of Object.entries(OPTIONAL)) {
  const v = process.env[k];
  console.log(`  ${k.padEnd(26)} ${v ? `set (${v.length} chars)` : "not set"}   — ${why}`);
}
console.log(`  ${"MODEL".padEnd(26)} ${process.env.MODEL ?? "stand-in (default)"}`);
console.log(`  ${"queue".padEnd(26)} in-process doorbell; the durable row is the work`);
if (missing.length) {
  console.error(`\nNot configured: ${missing.join(", ")}.`);
  console.error("Every request will answer 503 with that list. Set them and restart.");
}

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

// THE SWEEPER, on a timer, because a lost doorbell must cost latency and not work.
// `unref` so it never holds the process open on its own.
const sweeper = setInterval(() => { track(worker.scheduled({}, env, ctx)); }, SWEEP_MS);
sweeper.unref();

server.listen(PORT, () => console.log(`\nlistening on http://127.0.0.1:${PORT}  (sweeping every ${SWEEP_MS} ms)`));

const bye = async () => { clearInterval(sweeper); await Promise.allSettled([...inFlight]); server.close(); process.exit(0); };
process.on("SIGTERM", bye);
process.on("SIGINT", bye);
