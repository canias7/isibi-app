#!/usr/bin/env node
/**
 * THE LONG RUN, DEMONSTRATED END TO END. `npm run demo:long`.
 *
 * WHAT IT SETS OUT TO SHOW, and each of these is checked rather than narrated:
 *
 *   1. the HTTP response comes back in well under a second;
 *   2. the work is COMMITTED before that response — the run, its prompt and its
 *      queue row are all in the database already;
 *   3. the accepting process never executes anything: its queue binding is inert;
 *   4. a SEPARATE PROCESS, which never saw the request, finds the work in the
 *      database and runs it;
 *   5. that run lasts at least sixty seconds AFTER the response returned;
 *   6. progress accumulates while it runs and is readable over the API;
 *   7. the final result is in the database when it ends.
 *
 * **WHERE IT RUNS, STATED UP FRONT: a throwaway LOCAL PostgreSQL with this
 * repository's real migrations applied, reached through a PostgREST-shaped shim.**
 * The schema, the triggers, the generated columns, the partial unique indexes and
 * the claim's conditional UPDATE are the genuine article. What is NOT proved here
 * is the hosted project, because writing to it needs a service credential this
 * demonstration does not have — run the same flow against Supabase by setting
 * SUPABASE_URL and SUPABASE_SERVICE_KEY and using `npm run serve`.
 */
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import worker, { QUEUE_BINDING } from "../src/worker.mjs";
import { SLOW_ROUNDS, SLOW_STEP_MS, SLOW_TOTAL_MS } from "../src/model-standin.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.resolve(HERE, "..");
const DB = `agent_demo_${process.pid}`;
const SECRET = "demo-only-local-secret";
const TENANT = "11111111-2222-3333-4444-555555555555";
const shq = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`;

let failed = 0;
const check = (what, cond, detail = "") => {
  if (!cond) failed++;
  console.log(`  ${cond ? "ok  " : "FAIL"}  ${what}${detail ? ` — ${detail}` : ""}`);
};
const su = (cmd) => execFileSync("su", ["postgres", "-c", cmd], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

// ── is there a cluster? ──────────────────────────────────────────────────────
try { su("psql -X -tAc 'select 1'"); } catch {
  console.log("No local PostgreSQL that `su postgres` can reach — nothing to demonstrate against.");
  console.log("  start one with:  pg_ctlcluster 16 main start");
  process.exit(0);
}

// ── a throwaway database with the real migrations ────────────────────────────
console.log(`\nsetting up ${DB} from the real migrations`);
su(`psql -X -q -d postgres -c ${shq(`drop database if exists ${DB};`)} -c ${shq(`create database ${DB};`)}`);
su(`psql -X -q -d ${DB} -c ${shq(`do $$ begin
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role; end if;
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon; end if;
end $$;
alter role authenticated nologin nobypassrls;
alter role service_role  nologin bypassrls;
alter role anon          nologin nobypassrls;`)}`);
const migrations = fs.readdirSync(path.join(DIR, "supabase", "migrations")).filter((f) => f.endsWith(".sql")).sort();
for (const f of migrations) {
  const tmp = path.join("/tmp", `agent-demo-${process.pid}-${f}`);
  fs.copyFileSync(path.join(DIR, "supabase", "migrations", f), tmp);
  fs.chmodSync(tmp, 0o644);
  su(`psql -X -q -v ON_ERROR_STOP=1 -d ${DB} -f ${tmp}`);
  fs.rmSync(tmp, { force: true });
  console.log(`  applied ${f}`);
}

const { startLocalRest } = await import("./local-rest.mjs");
const rest = await startLocalRest({ db: DB });
console.log(`  local rest on ${rest.url}`);

// ── the accepting process, WITH NO CONSUMER OF ITS OWN ───────────────────────
// **THE BINDING IS INERT ON PURPOSE.** If this process could execute the run, the
// demonstration would prove nothing about durability — it would only prove that
// `waitUntil` still works. Nothing here can run anything.
const rung = [];
const env = {
  SUPABASE_URL: rest.url,
  SUPABASE_SERVICE_KEY: "local-service-role",
  SUPABASE_PUBLISHABLE_KEY: "local-publishable",
  SUPABASE_JWT_SECRET: SECRET,
  MODEL: "stand-in",
  [QUEUE_BINDING]: { send: async (m) => { rung.push(m); } },
};
const ctx = { waitUntil: () => { throw new Error("this process must not run work in the background"); } };

const api = http.createServer(async (req, res) => {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const request = new Request(new URL(req.url, "http://localhost"), {
    method: req.method, headers: req.headers,
    body: req.method === "GET" ? undefined : Buffer.concat(chunks),
  });
  const out = await worker.fetch(request, env, ctx);
  res.writeHead(out.status, Object.fromEntries(out.headers));
  res.end(Buffer.from(await out.arrayBuffer()));
});
await new Promise((r) => api.listen(0, "127.0.0.1", r));
const apiUrl = `http://127.0.0.1:${api.address().port}`;
console.log(`  api on ${apiUrl} (its queue binding records messages and runs nothing)`);

// ── a token, signed the way a project signs one ──────────────────────────────
const b64url = (b) => Buffer.from(b).toString("base64url");
const enc = (o) => b64url(new TextEncoder().encode(JSON.stringify(o)));
const head = `${enc({ alg: "HS256", typ: "JWT" })}.${enc({ sub: TENANT, exp: Math.floor(Date.now() / 1000) + 7200 })}`;
const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
const token = `${head}.${b64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(head))))}`;
const auth = { authorization: `Bearer ${token}` };

const q = (sql) => su(`psql -X -q -t -A -d ${DB} -c ${shq(sql)}`).trim();

let consumer = null;
try {
  console.log(`\n── 1. the request ─────────────────────────────────────────────`);
  console.log(`   the slow agent waits ${SLOW_ROUNDS} × ${SLOW_STEP_MS} ms = ${SLOW_TOTAL_MS} ms of tool time`);
  const t0 = Date.now();
  const res = await fetch(`${apiUrl}/runs`, {
    method: "POST", headers: { ...auth, "content-type": "application/json" },
    body: JSON.stringify({ agent: "slow", prompt: "take your time" }),
  });
  const answeredIn = Date.now() - t0;
  const accepted = await res.json();
  const runId = accepted.runId;
  check("the request was accepted", res.status === 202, `HTTP ${res.status} ${JSON.stringify(accepted)}`);
  check(`the response came back fast (${answeredIn} ms)`, answeredIn < 1000, `${answeredIn} ms`);

  console.log(`\n── 2. it was committed BEFORE that response ───────────────────`);
  check("the run row exists", q(`select count(*) from agent.runs where id='${runId}';`) === "1");
  check("its prompt is in the log already",
    q(`select body->>'prompt' from agent.run_entries where run_id='${runId}' and seq=0;`) === "take your time");
  check("the queue row exists and is outstanding",
    q(`select (done_at is null) from agent.run_work where run_id='${runId}';`) === "t");
  check("nothing has executed yet", q(`select count(*) from agent.run_entries where run_id='${runId}';`) === "1",
    `${q(`select count(*) from agent.run_entries where run_id='${runId}';`)} entries`);
  check("the doorbell rang exactly once, carrying only a run id",
    rung.length === 1 && JSON.stringify(Object.keys(rung[0])) === '["runId"]', JSON.stringify(rung));

  console.log(`\n── 3. a separate process picks the work up off the database ───`);
  consumer = spawn(process.execPath, [path.join(HERE, "consume.mjs")], {
    env: { ...process.env, SUPABASE_URL: rest.url, SUPABASE_SERVICE_KEY: "local-service-role",
           SUPABASE_PUBLISHABLE_KEY: "local-publishable", MODEL: "stand-in", POLL_MS: "500", GRACE_S: "0" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const consumerSaid = [];
  consumer.stdout.on("data", (d) => {
    for (const line of String(d).split("\n").filter(Boolean)) {
      consumerSaid.push(line);
      console.log(`   [consumer pid ${consumer.pid}] ${line}`);
    }
  });
  consumer.stderr.on("data", (d) => console.log(`   [consumer stderr] ${String(d).trim()}`));

  console.log(`\n── 4. progress, watched over the API while it runs ────────────`);
  const seen = [];
  const started = Date.now();
  let view = null;
  while (Date.now() - started < SLOW_TOTAL_MS + 120_000) {
    view = await (await fetch(`${apiUrl}/runs/${runId}`, { headers: auth })).json();
    const at = Date.now() - t0;
    const last = seen[seen.length - 1];
    if (!last || last.steps !== view.steps || last.status !== view.status) {
      seen.push({ at, steps: view.steps, status: view.status });
      console.log(`   +${String(at).padStart(6)} ms   status=${view.status.padEnd(8)} steps=${view.steps}`);
    }
    if (view.status === "stopped") break;
    await new Promise((r) => setTimeout(r, 1500));
  }
  const finishedAt = Date.now() - t0;

  console.log(`\n── 5. what it proves ─────────────────────────────────────────`);
  check("the run finished", view?.status === "stopped", `status=${view?.status}`);
  check("it answered rather than hitting a bound", view?.stop?.reason === "answered", JSON.stringify(view?.stop));
  check(`the work lasted at least 60 s after the response (${(finishedAt / 1000).toFixed(1)} s)`,
    finishedAt >= 60_000, `${finishedAt} ms`);
  check("progress was observed moving while it ran, not just at the end",
    seen.filter((s) => s.status === "running" && s.steps > 0).length >= 3,
    `observations: ${seen.map((s) => `${s.steps}@${s.at}ms`).join(" ")}`);
  check("the steps only ever went up", seen.every((s, i) => i === 0 || s.steps >= seen[i - 1].steps));
  check(`every one of the ${SLOW_ROUNDS} stages ran`, view?.used?.toolCalls === SLOW_ROUNDS,
    `toolCalls=${view?.used?.toolCalls}`);
  check("the answer says how long it really waited", /worked through/.test(view?.text ?? ""), view?.text ?? "");

  console.log(`\n── 6. and it is in the database, not in a variable ────────────`);
  const kinds = q(`select string_agg(body->>'kind', ',' order by seq) from agent.run_entries where run_id='${runId}';`);
  const want = ["started", ...Array.from({ length: SLOW_ROUNDS }, () => "model,tool"), "model", "stopped"].join(",");
  check("the stored log holds every step and every tool result", kinds === want, `\n           got:  ${kinds}\n           want: ${want}`);
  check("the run is stopped in the database too", q(`select status from agent.runs where id='${runId}';`) === "stopped");
  check("the stored stop carries the answer",
    (q(`select stop->>'text' from agent.runs where id='${runId}';`) || "").includes("worked through"));
  check("the queue let the work go", q(`select (done_at is not null) from agent.run_work where run_id='${runId}';`) === "t");
  check("...and it is not being offered again", q(`select count(*) from agent.sweep_run_work(0, 50) as t;`) === "0");
  check("the accepting process never ran anything", rung.length === 1 && consumerSaid.some((l) => l.includes('"why":"ran"')),
    "the consumer never reported running it");

  console.log(`\n${failed === 0 ? "ALL CHECKS PASSED" : `${failed} CHECK(S) FAILED`}`);
} finally {
  if (consumer) { consumer.kill("SIGTERM"); await new Promise((r) => setTimeout(r, 300)); consumer.kill("SIGKILL"); }
  await new Promise((r) => api.close(r));
  await rest.close();
  try { su(`psql -X -q -d postgres -c ${shq(`drop database if exists ${DB};`)}`); } catch { /* best effort */ }
}
process.exit(failed === 0 ? 0 : 1);
