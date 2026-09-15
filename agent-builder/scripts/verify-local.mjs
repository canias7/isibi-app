#!/usr/bin/env node
/**
 * DRIVE `verify-live.mjs` AGAINST A LOCAL STACK. `npm run verify:local`.
 *
 * **THE POINT IS THAT THE VERIFICATION SCRIPT IS ITSELF EXERCISED BEFORE ANYBODY
 * POINTS IT AT A DEPLOYMENT.** An instrument nobody has run is a claim, and this
 * repository has already paid once for a test fixture that was more capable than
 * reality. So the same script, unmodified, runs here first.
 *
 * WHAT IS REAL HERE: the Worker's own `fetch`, the real store and queue modules, the
 * real runner and its lease, a real PostgreSQL with the real migrations, and TWO
 * separate consumer processes — which is what makes a handover between consumers
 * something that actually happens rather than something described.
 *
 * WHAT DIFFERS FROM A DEPLOYMENT, stated so the local pass is not over-read:
 *   - the sign-in leg. Supabase Auth is not here, so a token is supplied directly;
 *     against a deployment the script signs in with an email and password.
 *   - the transport. There is no Cloudflare queue, so the consumers find work by
 *     sweeping the table — which is the weaker path, not the stronger one.
 *   - the clock. The lease and the beat are compressed so a handover takes seconds
 *     instead of a minute; the invariant that the grace is at least a beat is still
 *     enforced, by `consume.mjs`, which refuses to start otherwise.
 */
import { execFileSync, spawn } from "node:child_process";   // execFileSync only for psql, never for the child below
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import worker, { QUEUE_BINDING } from "../src/worker.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.resolve(HERE, "..");
const DB = `agent_verify_${process.pid}`;
const SECRET = "verify-only-local-secret";
const TENANT = "77777777-8888-9999-aaaa-bbbbbbbbbbbb";
const shq = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`;
const su = (cmd) => execFileSync("su", ["postgres", "-c", cmd], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

try { su("psql -X -tAc 'select 1'"); } catch {
  console.log("No local PostgreSQL that `su postgres` can reach — nothing to drive.");
  console.log("  start one with:  pg_ctlcluster 16 main start");
  process.exit(0);
}

console.log(`setting up ${DB} from the real migrations`);
su(`psql -X -q -d postgres -c ${shq(`drop database if exists ${DB};`)} -c ${shq(`create database ${DB};`)}`);
su(`psql -X -q -d ${DB} -c ${shq(`do $$ begin
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role; end if;
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon; end if;
end $$;
alter role authenticated nologin nobypassrls;
alter role service_role  nologin bypassrls;
alter role anon          nologin nobypassrls;`)}`);
for (const f of fs.readdirSync(path.join(DIR, "supabase", "migrations")).filter((x) => x.endsWith(".sql")).sort()) {
  const tmp = path.join("/tmp", `agent-verify-${process.pid}-${f}`);
  fs.copyFileSync(path.join(DIR, "supabase", "migrations", f), tmp);
  fs.chmodSync(tmp, 0o644);
  su(`psql -X -q -v ON_ERROR_STOP=1 -d ${DB} -f ${tmp}`);
  fs.rmSync(tmp, { force: true });
}

const { startLocalRest } = await import("./local-rest.mjs");
const rest = await startLocalRest({ db: DB });
console.log(`  local rest on ${rest.url}`);

// The API process, with an INERT queue binding: nothing here executes a run, so the
// consumers below are the only thing that can — which is what makes the handover real.
const env = {
  SUPABASE_URL: rest.url,
  SUPABASE_SERVICE_KEY: "local-service-role",
  SUPABASE_PUBLISHABLE_KEY: "local-publishable",
  SUPABASE_JWT_SECRET: SECRET,
  MODEL: "stand-in",
  [QUEUE_BINDING]: { send: async () => {} },
};
const ctx = { waitUntil: () => { throw new Error("the API process must not run work"); } };
const api = http.createServer(async (req, res) => {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const out = await worker.fetch(new Request(new URL(req.url, "http://localhost"), {
    method: req.method, headers: req.headers,
    body: req.method === "GET" ? undefined : Buffer.concat(chunks),
  }), env, ctx);
  res.writeHead(out.status, Object.fromEntries(out.headers));
  res.end(Buffer.from(await out.arrayBuffer()));
});
await new Promise((r) => api.listen(0, "127.0.0.1", r));
const apiUrl = `http://127.0.0.1:${api.address().port}`;
console.log(`  api on ${apiUrl}`);

// A token the Worker will verify with its opt-in secret. Against a deployment this
// is a real sign-in instead.
const enc = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const head = `${enc({ alg: "HS256", typ: "JWT" })}.${enc({ sub: TENANT, exp: Math.floor(Date.now() / 1000) + 7200 })}`;
const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
const token = `${head}.${Buffer.from(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(head))).toString("base64url")}`;

// TWO consumers, so one can take a run over from the other.
const consumerEnv = {
  ...process.env,
  SUPABASE_URL: rest.url, SUPABASE_SERVICE_KEY: "local-service-role",
  SUPABASE_PUBLISHABLE_KEY: "local-publishable", MODEL: "stand-in",
  POLL_MS: "500", GRACE_S: "3", LEASE_TTL_S: "8", BEAT_MS: "2000",
};
const consumers = [0, 1].map((n) => {
  const c = spawn(process.execPath, [path.join(HERE, "consume.mjs")], { env: consumerEnv, stdio: ["ignore", "pipe", "pipe"] });
  c.stdout.on("data", (d) => { for (const l of String(d).split("\n").filter(Boolean)) console.log(`  [c${n} ${c.pid}] ${l}`); });
  c.stderr.on("data", (d) => console.log(`  [c${n} stderr] ${String(d).trim()}`));
  return c;
});
console.log(`  two consumers: ${consumers.map((c) => c.pid).join(", ")}`);

let code = 1;
try {
  console.log("\n════ running scripts/verify-live.mjs, unmodified ════\n");
  // **`spawn`, NEVER `execFileSync`.** This process is also the one serving the REST
  // shim and the API, and a synchronous child BLOCKS ITS EVENT LOOP — so every
  // request the verification made timed out with no server having ever seen it, and
  // the failure read like a broken deployment rather than a blocked host. Cost one
  // run to find.
  code = await new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(HERE, "verify-live.mjs")], {
      stdio: "inherit",
      env: {
        ...process.env,
        AGENT_URL: apiUrl,
        SUPABASE_URL: rest.url,
        SUPABASE_PUBLISHABLE_KEY: "local-publishable",
        SUPABASE_SERVICE_KEY: "local-service-role",
        AGENT_USER_TOKEN: token,
        // The clock, compressed: a handover here costs seconds, not a cron tick.
        HANDOVER_MS: "120000", SETTLE_MS: "15000", POLL_MS: "1000",
      },
    });
    child.on("close", (c) => resolve(c ?? 1));
    child.on("error", () => resolve(1));
  });
} catch (e) {
  code = e.status ?? 1;
} finally {
  for (const c of consumers) { c.kill("SIGTERM"); }
  await new Promise((r) => setTimeout(r, 500));
  for (const c of consumers) { c.kill("SIGKILL"); }
  await new Promise((r) => api.close(r));
  await rest.close();
  try { su(`psql -X -q -d postgres -c ${shq(`drop database if exists ${DB};`)}`); } catch { /* best effort */ }
}
console.log(`\nverify-live.mjs exited ${code}`);
process.exit(code);
