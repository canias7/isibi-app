// READ THE CONTAINER'S OWN WORDS OUT OF WORKERS LOGS — the one witness a
// session cannot reach.
//
// WHY THIS EXISTS: runs 41-44 each lost a fired generation as `no-request`, and
// every theory about WHY had to be argued from outside — the platform kill, the
// rollout lag, undici's 300s headers wall — because the only thing that saw the
// failure was the container's stderr, and a session holds no Cloudflare token.
// Observability has retained those lines since 2026-08-26 (7 days,
// head_sampling_rate 1); CI's own CLOUDFLARE_API_TOKEN can query them. This
// prints them, raw, newest last.
//
// FREE AND READ-ONLY. One POST to the telemetry query endpoint with
// `dry: true`, which Cloudflare documents as "executes the query without
// persisting the results". No container is started, nothing is charged, and
// the query is bounded (LOG_HOURS ≤ 168 — the retention window — LIMIT 900).
//
// THE API SHAPE COMES FROM CLOUDFLARE'S OWN SDK, not from memory: the
// `cloudflare` npm package's `telemetry.query()` POSTs
// `/accounts/{id}/workers/observability/telemetry/query` with
// `{queryId, timeframe:{from,to}, view, limit, parameters:{filters:[...]}}` and
// answers `{result:{events:{events:[...]}}}` for the events view. Verified
// against the installed package rather than the docs pages, which do not spell
// the endpoint at all.
//
// A REFUSAL NAMES THE SCOPE. Cloudflare answers a missing PERMISSION with the
// same "Authentication error" a bad token gets (error 10000 — the saas-setup
// lesson), so the failure line says what to add rather than leaving the reader
// to diff two identical-looking errors.
const TOKEN = process.env.CLOUDFLARE_API_TOKEN || "";
const ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID || "";
const HOURS = Math.min(168, Math.max(1, Number(process.env.LOG_HOURS) || 5));
// Optional substring filter on the message. Empty means everything — which is
// the right default for a diagnostic whose whole point is not guessing what
// the interesting line looks like before reading it.
const NEEDLE = String(process.env.LOG_NEEDLE || "");

function fail(msg) { console.error("FAIL: " + msg); process.exit(1); }
if (!TOKEN) fail("CLOUDFLARE_API_TOKEN is not set");
if (!ACCOUNT) fail("CLOUDFLARE_ACCOUNT_ID is not set");

const now = Date.now();
const body = {
  queryId: "container-logs-probe",
  timeframe: { from: now - HOURS * 3600 * 1000, to: now },
  view: "events",
  limit: 900,
  dry: true,
  parameters: {
    datasets: [],
    filters: NEEDLE
      ? [{ key: "$metadata.message", operation: "includes", value: NEEDLE, type: "string" }]
      : [],
  },
};

const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/workers/observability/telemetry/query`, {
  method: "POST",
  headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/json" },
  body: JSON.stringify(body),
  signal: AbortSignal.timeout(60000),
});
const text = await r.text();
if (!r.ok) {
  console.error("query answered", r.status, text.slice(0, 600));
  if (r.status === 403 || /authentication/i.test(text)) {
    console.error("If the token is otherwise good, it is missing the observability READ scope —");
    console.error("add 'Workers Observability: Read' (or 'Account Analytics: Read') to CLOUDFLARE_API_TOKEN.");
  }
  process.exit(1);
}

let j;
try { j = JSON.parse(text); } catch { fail("the query answered 200 with a body that is not JSON: " + text.slice(0, 300)); }
const evs = (j && j.result && j.result.events && j.result.events.events) || [];
console.log(`events in the last ${HOURS}h${NEEDLE ? ` matching ${JSON.stringify(NEEDLE)}` : ""}: ${evs.length}` +
  (j.result && j.result.events && Number.isFinite(j.result.events.count) ? ` (of ${j.result.events.count} total)` : ""));
if (!evs.length) {
  // An empty answer is a real answer only if the query ran — print the run's
  // own status so "nothing logged" and "the query found nothing because it is
  // aimed wrong" stop being one line.
  console.log("run status:", JSON.stringify((j.result && j.result.run && j.result.run.status) || j.result && j.result.run || "unknown").slice(0, 200));
  process.exit(0);
}
// The first event RAW, once — so if the field names ever differ from the SDK's
// claim, the reader sees the true shape instead of a page of `undefined`.
console.log("first event, raw:", JSON.stringify(evs[0]).slice(0, 700));
console.log("---");
const rows = evs.map((e) => {
  const m = (e && e.$metadata) || {};
  const ts = Number(e && (e.timestamp || m.timestamp)) || 0;
  return { ts, line: `${ts ? new Date(ts).toISOString() : "?"} [${m.service || "?"}${m.origin ? "/" + m.origin : ""}] ${String(m.message || m.error || JSON.stringify(e).slice(0, 200)).slice(0, 400)}` };
}).sort((a, b) => a.ts - b.ts);
for (const row of rows) console.log(row.line);
