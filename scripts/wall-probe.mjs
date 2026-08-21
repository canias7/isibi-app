// WHERE IS THE WALL, AND WHICH KIND IS IT?
//
// Four builds clustered around one ceiling on 2026-08-21 — 272s published, then
// 286s, 291s and 301s died — across two providers and two languages. So the wall
// is real, provider-independent and load-bearing, and NOTHING about it was
// known: not the number, and not whether it is the connection timing out or the
// Worker being killed.
//
// THAT DISTINCTION DECIDES THE FIX AND THE TWO FIXES ARE OPPOSITES. Streaming a
// response keeps a CONNECTION alive and does nothing if the Worker is stopped;
// moving the work off the request survives a Worker being stopped and does
// nothing if the connection is what times out. Guessing costs a ~130-credit
// build to find out.
//
// This costs NOTHING: `/api/_slow` sleeps and returns. No model call, no Neon
// project, no container, no publish, no ledger. The only thing it spends is
// wall-clock.
//
// Read it as: the last PLAIN duration that returns is the ceiling. If the same
// duration returns when STREAMED, the wall is the connection and streaming is
// the fix. If streaming dies at the same place, the Worker is being killed and
// the build has to leave the request.

import https from "node:https";

const SUPABASE_URL = process.env.SUPABASE_URL || "https://ujrqdmmtcptvimazlhom.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || "";
const ANON_KEY = process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqcnFkbW10Y3B0dmltYXpsaG9tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3ODUyNTUsImV4cCI6MjA5NDM2MTI1NX0.F-af9iC-BWTZN2hQ5cD1Keke8qXARhqPwxOgSHhNLK4";
const BASE = process.env.OWNER_BASE_URL || "https://gofarther.dev";
const EMAIL = String(process.env.OWNER_EMAIL || "").trim();

if (!EMAIL || !SERVICE_KEY) { console.error("OWNER_EMAIL and SUPABASE_SERVICE_KEY are required"); process.exit(1); }

// Same admin magic-link sign-in as build-as-owner: no password anywhere.
const svc = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "content-type": "application/json" };
const gl = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
  method: "POST", headers: svc, body: JSON.stringify({ type: "magiclink", email: EMAIL }),
});
const glBody = await gl.json().catch(() => ({}));
const tokenHash = glBody.hashed_token || (glBody.properties && glBody.properties.hashed_token);
if (!tokenHash) { console.error("could not generate a sign-in link:", gl.status); process.exit(1); }
const vr = await fetch(`${SUPABASE_URL}/auth/v1/verify`, {
  method: "POST", headers: { apikey: ANON_KEY, "content-type": "application/json" },
  body: JSON.stringify({ type: "magiclink", token_hash: tokenHash }),
});
const session = await vr.json().catch(() => ({}));
if (!session.access_token) { console.error("could not open a session:", vr.status); process.exit(1); }
console.log(`signed in as ${(session.user || {}).email}\n`);

/**
 * GET with NO client-side timeout of its own, so the only thing that can end
 * the request is the far end. `node:https` rather than fetch for the reason
 * build-as-owner records: undici gives up at 300s and that ceiling is inside the
 * range being measured, which would make the harness the thing under test.
 */
function get(path, token) {
  return new Promise((resolve) => {
    const u = new URL(BASE + path);
    const t0 = Date.now();
    let bytes = 0, firstByteAt = 0, ticks = 0;
    const req = https.request({
      hostname: u.hostname, path: u.pathname + u.search, method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    }, (res) => {
      res.on("data", (c) => {
        if (!firstByteAt) firstByteAt = Date.now() - t0;
        bytes += c.length;
        ticks += (c.toString().match(/"tick"/g) || []).length;
      });
      res.on("end", () => resolve({ ok: true, status: res.statusCode, ms: Date.now() - t0, bytes, firstByteAt, ticks }));
      res.on("error", (e) => resolve({ ok: false, why: e.code || e.message, ms: Date.now() - t0, firstByteAt, ticks }));
    });
    req.on("error", (e) => resolve({ ok: false, why: e.code || e.message, ms: Date.now() - t0, firstByteAt, ticks }));
    req.end();
  });
}

// Around the observed cluster: one comfortably under, then across it, then well
// past. 420s is deliberately beyond anything a build has ever taken — if a
// STREAMED response survives that, the ceiling is not about total duration.
const STEPS = (process.env.WALL_STEPS || "240,300,360,420").split(",").map((s) => Number(s.trim())).filter(Boolean);

const rows = [];
for (const mode of ["plain", "stream"]) {
  for (const secs of STEPS) {
    const q = `/api/_slow?ms=${secs * 1000}${mode === "stream" ? "&stream=1" : ""}`;
    process.stdout.write(`  ${mode.padEnd(6)} ${String(secs).padStart(4)}s ... `);
    const r = await get(q, session.access_token);
    const verdict = r.ok && r.status === 200 ? "RETURNED" : "DIED (" + (r.why || r.status) + ")";
    console.log(`${verdict} after ${(r.ms / 1000).toFixed(1)}s` +
      (r.firstByteAt ? ` · first byte ${(r.firstByteAt / 1000).toFixed(1)}s` : "") +
      (r.ticks ? ` · ${r.ticks} heartbeats` : ""));
    rows.push({ mode, secs, ok: r.ok && r.status === 200, ms: r.ms });
    // A mode that has already died will die at every longer duration too, and
    // each costs its full wall-clock to prove. Stop that mode there.
    if (!(r.ok && r.status === 200)) break;
  }
}

const last = (m) => rows.filter((r) => r.mode === m && r.ok).map((r) => r.secs).pop() || 0;
console.log(`\n  plain  survived up to ${last("plain")}s`);
console.log(`  stream survived up to ${last("stream")}s`);
if (last("stream") > last("plain")) {
  console.log("\n  => THE WALL IS THE CONNECTION. Streaming the build response is the fix.");
} else if (last("plain") && last("stream") && last("stream") === last("plain")) {
  console.log("\n  => STREAMING DOES NOT HELP: the Worker itself is being stopped.");
  console.log("     The build has to leave the request — kick it off and poll.");
} else {
  console.log("\n  => inconclusive; widen WALL_STEPS and re-run.");
}
