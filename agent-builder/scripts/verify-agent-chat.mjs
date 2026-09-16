/**
 * THE WHOLE FLOW, END TO END, AGAINST A REAL POSTGRESQL.
 *
 * A person types a message to an agent they wrote; the server saves it and accepts a
 * run in one transaction; the existing queue and runner execute that run; the
 * conversation shows the result. Every piece below is the real one:
 *
 *   * the SITE BUILDER's own route — `handleAgentApi` out of `agent-store.mjs`, with
 *     `makeAgentStore` speaking PostgREST;
 *   * the DATABASE — a throwaway PostgreSQL with this repository's migrations
 *     applied, so the triggers, the generated columns, the partial unique indexes and
 *     the one-transaction send are the genuine article;
 *   * the ENGINE — `makeRunner`, `makeRunStore`, `makeWork`, `runAgent`, the real
 *     journal and the real registry, claiming the work through `claim_run` and writing
 *     every entry through the fence.
 *
 * **WHAT IS SIMULATED, STATED UP FRONT AND IN ONE PLACE.** Two things and no others.
 * (1) The HTTP translation: PostgREST is a local shim (`scripts/local-rest.mjs`),
 * because writing to the hosted project needs a service credential. (2) The MODEL:
 * `makeStandIn` answers instead of a provider, which is this milestone's whole point
 * — and its answers say so in their own text.
 *
 * **WHAT IS NOT SIMULATED**: the ownership check, the retry key, the queue, the
 * lease, the journal, the snapshot, the run's bounds, or the reading the screen does.
 *
 * ⚠ NOT A STATEMENT ABOUT THE DEPLOYMENT. Nothing here has touched the hosted
 * project and nothing here should be read as proving it works.
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { handleAgentApi, makeAgentStore, STANDIN_MODEL } from "../../agent-store.mjs";
import { makeRunStore } from "../src/store.mjs";
import { makeWork } from "../src/work.mjs";
import { makeRunner } from "../src/runner.mjs";
import { makeStandIn, SIMULATED } from "../src/model-standin.mjs";
import { AGENTS, AUTHORED_AGENT } from "../src/agents.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.resolve(HERE, "..");
const DB = `agent_chat_${process.pid}`;
const A = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa";   // one account
const B = "bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb";   // the account next door
const shq = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`;

let failed = 0;
const fails = [];
const check = (what, cond, detail = "") => {
  if (!cond) { failed++; fails.push(what + (detail ? ` — ${detail}` : "")); }
  console.log(`  ${cond ? "ok  " : "FAIL"}  ${what}${detail ? ` — ${detail}` : ""}`);
};
const su = (cmd) => execFileSync("su", ["postgres", "-c", cmd], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const q = (sql) => su(`psql -X -q -t -A -v ON_ERROR_STOP=1 -d ${DB} -c ${shq(sql)}`).trim();

try { su("psql -X -tAc 'select 1'"); } catch {
  // A MISSING CLUSTER IS SAID AND EXITS 0. "No database here" is not a failing flow,
  // and a nonzero exit would read as the product being broken.
  console.log("No local PostgreSQL that `su postgres` can reach — nothing to verify against.");
  console.log("  start one with:  pg_ctlcluster 16 main start");
  process.exit(0);
}

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
for (const f of fs.readdirSync(path.join(DIR, "supabase", "migrations")).filter((x) => x.endsWith(".sql")).sort()) {
  const tmp = path.join("/tmp", `agent-chat-${process.pid}-${f}`);
  fs.copyFileSync(path.join(DIR, "supabase", "migrations", f), tmp);
  fs.chmodSync(tmp, 0o644);
  su(`psql -X -q -v ON_ERROR_STOP=1 -d ${DB} -f ${tmp}`);
  fs.rmSync(tmp, { force: true });
}
console.log("  migrations applied");

const { startLocalRest } = await import("./local-rest.mjs");
const rest = await startLocalRest({ db: DB });
console.log(`  local rest on ${rest.url}`);

try {
  // ── THE SITE BUILDER'S SIDE: the real route over the real store ────────────
  const appStore = () => makeAgentStore({ fetch: (u, o) => fetch(u, o), url: rest.url, key: "local-service-role" });
  let minted = 0;
  const api = (path, { tenant = A, body = {}, query = {}, method } = {}) => handleAgentApi({
    path, method: method ?? (Object.keys(query).length ? "GET" : "POST"),
    tenant, body, query: new URLSearchParams(query), store: appStore(),
    newId: () => `00000000-0000-4000-8000-${String(++minted).padStart(12, "0")}`,
    log: (...a) => console.log("      [log]", ...a),
  });

  // ── THE ENGINE'S SIDE: the real runner over the real queue ─────────────────
  let clock = Date.now();
  const engine = (send) => {
    const store = makeRunStore({
      fetch: (u, o) => fetch(u, o), url: rest.url, key: "local-service-role", schema: "agent",
      appendEntry: (a) => work.append(a),
    });
    const work = makeWork({ fetch: (u, o) => fetch(u, o), url: rest.url, key: "local-service-role", schema: "agent" });
    return makeRunner({
      work, store, send, agents: AGENTS,
      timer: { set: () => 0, clear: () => {} },
      now: () => clock, nameWorker: () => `w-${Math.random().toString(16).slice(2, 8)}`,
      onError: () => {},
    });
  };

  console.log("\n── 1. a person writes an agent and sends it a message ──");
  const made = await api("/api/agent/create", { body: { name: "Bike shop", instructions: "Answer as a friendly bike shop. Never quote a price." } });
  check("the agent is saved", made.status === 200 && !!made.body.agent, JSON.stringify(made.body));
  const agentId = made.body.agent && made.body.agent.id;

  const one = await api("/api/agent/send", { body: { id: agentId, body: "when do you open?", key: "press-1" } });
  check("the send is accepted", one.status === 200 && one.body.ok === true, JSON.stringify(one.body));
  check("...and the work was queued", one.body.queued === true);
  check("...and it is not a repeat", one.body.repeat === false);
  const runId = one.body.runId;
  check("...and it names the run it started", !!runId, String(runId));
  check("EVERYTHING IS COMMITTED BEFORE THE ANSWER CAME BACK: the message",
    q(`select body from agent.agent_messages where run_id = '${runId}';`) === "when do you open?");
  check("...the run", q(`select count(*) from agent.runs where id = '${runId}';`) === "1");
  check("...its first journal entry",
    q(`select count(*) from agent.run_entries where run_id = '${runId}';`) === "1");
  check("...and its row on the queue",
    q(`select count(*) from agent.run_work where run_id = '${runId}' and done_at is null;`) === "1");

  console.log("\n── 2. the snapshot is the agent's, and the app could not have set it ──");
  const snap = JSON.parse(q(`select body::text from agent.run_entries where run_id = '${runId}' and seq = 0;`));
  check("the instructions are the ones the person wrote",
    snap.instructions === "Answer as a friendly bike shop. Never quote a price.", String(snap.instructions));
  check("the agent, the model and the bounds are the SERVER'S",
    snap.agent === AUTHORED_AGENT && snap.model === STANDIN_MODEL, `${snap.agent}/${snap.model}`);
  check("...and the bounds are the registry's, not a default",
    JSON.stringify(snap.limits) === JSON.stringify({ ...snap.limits, steps: AGENTS[AUTHORED_AGENT].limits.steps })
      && snap.limits.steps === AGENTS[AUTHORED_AGENT].limits.steps, JSON.stringify(snap.limits));
  check("the run knows which agent and which message asked",
    snap.authoredAgent === agentId && typeof snap.message === "string", `${snap.authoredAgent}`);
  check("a first message is given no history", JSON.stringify(snap.history) === "[]", JSON.stringify(snap.history));

  console.log("\n── 3. the conversation shows it queued, before anything runs ──");
  let thread = await api("/api/agent/messages", { query: { id: agentId } });
  check("the thread reads back", thread.status === 200 && thread.body.messages.length === 1, JSON.stringify(thread.body).slice(0, 200));
  // A CHECK THAT CANNOT BE MADE IS NOT A CHECK THAT PASSED, and it must not be a stack
  // trace about this file either: everything below reads the thread, so if the thread
  // did not come back the honest thing is to say which step failed and stop.
  if (!thread.body.messages) throw new Error("the thread did not come back, so nothing below can be checked");
  let first = thread.body.messages[0];
  check("...with the person's own words", first.text === "when do you open?");
  check("...and its run reads as queued", first.run && first.run.state === "queued", JSON.stringify(first.run));
  check("...labelled as a stand-in", first.run && first.run.simulated === true);
  check("...with nothing pretending to be an answer", first.run && first.run.text === "" && first.run.why === "");

  console.log("\n── 4. the existing queue and engine execute it ──");
  const out = await engine(makeStandIn()).deliver(runId);
  check("the runner ran it", out.why === "ran", out.error || out.why);
  check("...having claimed the work through the queue",
    q(`select attempts from agent.run_work where run_id = '${runId}';`) === "1");
  check("...and released it", q(`select done_at is not null from agent.run_work where run_id = '${runId}';`) === "t");
  check("...writing its log through the fence and nowhere else",
    Number(q(`select count(*) from agent.run_entries where run_id = '${runId}';`)) >= 3,
    q(`select string_agg(kind, ',' order by seq) from agent.run_entries where run_id = '${runId}';`));
  check("service_role cannot insert an entry directly, so the log can only have come through append_entry",
    q(`select has_table_privilege('service_role', 'agent.run_entries', 'insert')::text;`) === "false");

  console.log("\n── 5. the conversation shows the result ──");
  thread = await api("/api/agent/messages", { query: { id: agentId } });
  first = thread.body.messages[0];
  check("the run reads as answered", first.run && first.run.state === "answered", JSON.stringify(first.run).slice(0, 160));
  check("...with the words the run really produced", !!first.run.text, String(first.run.text).slice(0, 80));
  check("⚠ AND THE ANSWER SAYS IT IS NOT AN AI'S, in its own text",
    String(first.run.text).startsWith(SIMULATED), String(first.run.text).slice(0, 60));
  check("...and the chrome has the same label to draw", first.run.simulated === true);
  check("THE SNAPSHOT REACHED THE MODEL: the answer quotes the instructions back",
    String(first.run.text).includes("friendly bike shop"), String(first.run.text).slice(0, 200));
  check("...and there is no message row pretending to be the agent",
    q(`select count(*) from agent.agent_messages where role <> 'user';`) === "0");

  console.log("\n── 6. a double send is one message and one run ──");
  const twice = await Promise.all([
    api("/api/agent/send", { body: { id: agentId, body: "and on sundays?", key: "press-2" } }),
    api("/api/agent/send", { body: { id: agentId, body: "and on sundays?", key: "press-2" } }),
  ]);
  check("both presses are answered ok", twice.every((r) => r.status === 200 && r.body.ok), JSON.stringify(twice.map((r) => r.status)));
  check("...one of them says it was a repeat", twice.filter((r) => r.body.repeat).length === 1,
    JSON.stringify(twice.map((r) => r.body.repeat)));
  check("...only one of them queued anything", twice.filter((r) => r.body.queued).length === 1,
    JSON.stringify(twice.map((r) => r.body.queued)));
  check("...and they name the SAME run", twice[0].body.runId === twice[1].body.runId,
    `${twice[0].body.runId} / ${twice[1].body.runId}`);
  check("ONE MESSAGE IS STORED FOR THAT PRESS",
    q(`select count(*) from agent.agent_messages where send_key = 'press-2';`) === "1");
  check("...and the database holds exactly two runs, not three",
    q(`select count(*) from agent.runs;`) === "2", q(`select count(*) from agent.runs;`));

  console.log("\n── 7. the second run is given the first turn, answer and all ──");
  const two = twice[0].body.runId;
  const snap2 = JSON.parse(q(`select body::text from agent.run_entries where run_id = '${two}' and seq = 0;`));
  check("the history carries the earlier question", snap2.history.length === 1, JSON.stringify(snap2.history).slice(0, 120));
  check("...and the answer it got", String(snap2.history[0].agent || "").startsWith(SIMULATED),
    String(snap2.history[0].agent).slice(0, 60));
  check("...and the prompt is the new message", snap2.prompt === "and on sundays?");

  console.log("\n── 8. an edit afterwards cannot change a run already accepted ──");
  const edited = await api("/api/agent/update", { body: { id: agentId, name: "Bike shop", instructions: "Completely different now." } });
  check("the edit is saved", edited.status === 200, JSON.stringify(edited.body));
  check("⚠ the accepted run still carries the instructions it was started with",
    JSON.parse(q(`select body::text from agent.run_entries where run_id = '${two}' and seq = 0;`)).instructions
      === "Answer as a friendly bike shop. Never quote a price.");
  const third = await api("/api/agent/send", { body: { id: agentId, body: "what about bank holidays?", key: "press-3" } });
  check("...and the NEXT send carries the new ones",
    JSON.parse(q(`select body::text from agent.run_entries where run_id = '${third.body.runId}' and seq = 0;`)).instructions
      === "Completely different now.");

  console.log("\n── 9. a failed run is shown as a failure, not as silence ──");
  const dead = await engine(async () => { throw new Error("the provider fell over"); }).deliver(two);
  check("the run came back", dead.why === "ran", dead.error || dead.why);
  thread = await api("/api/agent/messages", { query: { id: agentId } });
  const failedRow = thread.body.messages.find((m) => m.run && m.run.id === two);
  check("the conversation shows it failed", failedRow && failedRow.run.state === "failed", JSON.stringify(failedRow && failedRow.run));
  check("...and names the engine's own reason", failedRow && failedRow.run.why === "call-failed", String(failedRow && failedRow.run.why));
  check("...with nothing drawn as an answer", failedRow && failedRow.run.text === "");
  check("...and the message itself is untouched", failedRow && failedRow.text === "and on sundays?");

  console.log("\n── 10. a reload mid-run needs no recovery ──");
  // The browser holds NO state about a run, so a reload is an ordinary read of a
  // conversation that happens to have work in it. Driven as the read a fresh page
  // makes: run 3 is accepted and nothing has executed it.
  thread = await api("/api/agent/messages", { query: { id: agentId } });
  const pending = thread.body.messages.find((m) => m.run && m.run.id === third.body.runId);
  check("a run nothing has touched reads as queued", pending && pending.run.state === "queued", JSON.stringify(pending && pending.run));
  check("...so a fresh page knows to keep watching, from the rows alone",
    ["queued", "working"].includes(pending && pending.run.state));
  // And once it has taken a step but not finished, it reads as working — driven by
  // executing it with a model that answers a tool call the agent cannot serve, which
  // leaves a step recorded and the run stopped. The STEP is what the screen shows.
  await engine(makeStandIn()).deliver(third.body.runId);
  thread = await api("/api/agent/messages", { query: { id: agentId } });
  const done3 = thread.body.messages.find((m) => m.run && m.run.id === third.body.runId);
  check("a finished run carries the step it reached", done3 && done3.run.step >= 1, JSON.stringify(done3 && done3.run));

  console.log("\n── 11. the account next door ──");
  const stranger = await api("/api/agent/send", { tenant: B, body: { id: agentId, body: "hello", key: "press-x" } });
  check("sending to another account's agent is NOT FOUND", stranger.status === 404, JSON.stringify(stranger.body));
  check("...and says nothing about who owns it", !JSON.stringify(stranger.body).includes(A));
  check("...and wrote no message", q(`select count(*) from agent.agent_messages where send_key = 'press-x';`) === "0");
  check("...and started no run", q(`select count(*) from agent.runs;`) === "3", q(`select count(*) from agent.runs;`));
  const hidden = await api("/api/agent/messages", { tenant: B, query: { id: agentId } });
  check("reading another account's conversation is NOT FOUND", hidden.status === 404, JSON.stringify(hidden.body));
  const mine = await api("/api/agent/list", { tenant: B, method: "GET" });
  check("...and the other account's own list is empty rather than refused",
    mine.status === 200 && mine.body.agents.length === 0, JSON.stringify(mine.body).slice(0, 120));

  console.log("\n── 12. a run already finished is not run again ──");
  const again = await engine(makeStandIn()).deliver(runId);
  check("a redelivery of a finished run does nothing", again.why === "already-finished" || again.why === "not-claimable", again.why);
  check("...and its log did not grow",
    q(`select count(*) from agent.run_entries where run_id = '${runId}' and kind = 'model';`) === "1");
} finally {
  await rest.close();
  try { su(`psql -X -q -d postgres -c ${shq(`drop database if exists ${DB};`)}`); } catch { /* best effort */ }
}

console.log(`\n${failed ? "FAILED" : "PASSED"} — ${failed} failed`);
if (failed) { console.log("FAILURES:\n" + fails.map((f) => "  - " + f).join("\n")); process.exit(1); }
