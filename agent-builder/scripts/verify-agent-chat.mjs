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
import { AGENTS, AUTHORED_AGENT, OFFERED_NAMES } from "../src/agents.mjs";

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
  const api = (path, { tenant = A, body = {}, query = {}, method, ring } = {}) => handleAgentApi({
    path, method: method ?? (Object.keys(query).length ? "GET" : "POST"),
    tenant, body, query: new URLSearchParams(query), store: appStore(), ring,
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
  // ── 13. THE DOORBELL ───────────────────────────────────────────────────────
  //
  // Everything above delivered runs BY HAND, which proves the engine and says nothing
  // about how soon a real conversation starts. Until this shipped, nothing told the
  // engine at all: the run sat committed until that product's own minute-by-minute
  // sweep noticed it. Here the RING is the only trigger — no sweep, no cron, no
  // hand-written deliver — so what is measured is the chain a customer waits on.
  console.log("\n\u2500\u2500 13. the doorbell: the engine is told the moment the send commits \u2500\u2500");
  const rung = [];
  const ran = [];
  const bell = async (id) => { rung.push(id); ran.push(await engine(makeStandIn()).deliver(id)); };
  const t0 = Date.now();
  const rangSend = await api("/api/agent/send",
    { body: { id: agentId, body: "are you open on sunday?", key: "press-ring" }, ring: bell });
  const startMs = Date.now() - t0;
  check("the send is accepted and says the engine was told",
    rangSend.status === 200 && rangSend.body.ok === true && rangSend.body.notified === true,
    JSON.stringify(rangSend.body).slice(0, 200));
  check("...and the run it rang is the run it named",
    rung.length === 1 && rung[0] === rangSend.body.runId, JSON.stringify(rung));
  check("...and that one delivery ran it", ran.length === 1 && ran[0] && ran[0].ran === true,
    JSON.stringify(ran[0]));
  const rangThread = await api("/api/agent/messages", { query: { id: agentId } });
  const rangRow = rangThread.body.messages.find((m) => m.id === rangSend.body.message.id);
  check("...so the conversation is answered with nothing having swept",
    rangRow && rangRow.run && rangRow.run.state === "answered", JSON.stringify(rangRow && rangRow.run));
  check("...and the answer is still labelled as a simulation",
    rangRow && rangRow.run.simulated === true && /\[simulated\]/.test(rangRow.run.text || ""),
    String(rangRow && rangRow.run.text).slice(0, 80));
  console.log(`      send \u2192 started \u2192 answered in ${startMs} ms, locally, with no sweep involved`);

  // AND A DOORBELL THAT FAILS LEAVES THE WORK EXACTLY WHERE IT WAS. This is the
  // recovery path: the row is committed, `notified` says nobody was told, and the run
  // is still there for the engine's own sweep to find — late, never lost.
  const deaf = await api("/api/agent/send",
    { body: { id: agentId, body: "and on bank holidays?", key: "press-deaf" },
      ring: async () => { throw new Error("queue unavailable"); } });
  check("a send whose doorbell fails still succeeds", deaf.status === 200 && deaf.body.ok === true,
    JSON.stringify(deaf.body).slice(0, 160));
  check("...and says so rather than claiming the engine was told", deaf.body.notified === false,
    String(deaf.body.notified));
  check("...and the work is still on the queue for the sweep to find",
    q(`select count(*) from agent.run_work where run_id = '${deaf.body.runId}' and done_at is null;`) === "1");
  const swept = await engine(makeStandIn()).deliver(deaf.body.runId);
  check("...and it runs when something finally picks it up", swept.ran === true, JSON.stringify(swept));

  // ── 14. THE SETTINGS SURVIVE A RELOAD, AND ARE ONE ACCOUNT'S ───────────────
  //
  // Everything above is about a message. This is about what a person CONFIGURES,
  // and it is checked the way somebody would: save it, read it back the way a fresh
  // page does, and ask the other account what it can see.
  console.log("\n── 14. the settings are stored, re-read and one account's ──");
  const kit = await api("/api/agent/list", { method: "GET" });
  check("the list answers a catalog of tools the platform really has",
    Array.isArray(kit.body.tools) && kit.body.tools.length === OFFERED_NAMES.length
      && kit.body.tools.every((t) => OFFERED_NAMES.includes(t.name)),
    JSON.stringify(kit.body.tools));
  const tool = kit.body.tools[0].name;

  const saved = await api("/api/agent/update", {
    body: { id: agentId, name: "Bike shop", instructions: "Completely different now.",
            status: "paused", tools: [tool] },
  });
  check("the settings save", saved.status === 200 && saved.body.ok === true, JSON.stringify(saved.body).slice(0, 200));
  check("...and the answer carries them back", saved.body.agent.status === "paused"
    && JSON.stringify(saved.body.agent.tools) === JSON.stringify([tool]), JSON.stringify(saved.body.agent));
  // A RELOAD IS AN ORDINARY LIST READ — the browser holds no state about a saved
  // agent, so this is exactly what a fresh page does.
  const reread = await api("/api/agent/list", { method: "GET" });
  const myRow = reread.body.agents.find((a) => a.id === agentId);
  check("a reload reads the pause back", myRow && myRow.status === "paused", JSON.stringify(myRow));
  check("...and the selection with it", myRow && JSON.stringify(myRow.tools) === JSON.stringify([tool]),
    JSON.stringify(myRow && myRow.tools));
  check("...and the database holds what the wire said",
    q(`select status || '|' || array_to_string(tools, ',') from agent.agents where id = '${agentId}';`)
      === `paused|${tool}`);

  // THE OTHER ACCOUNT CANNOT SEE IT OR CHANGE IT, and the two answers are the SAME
  // 404 — so a stranger cannot even confirm the agent exists.
  const peek = await api("/api/agent/list", { tenant: B, method: "GET" });
  check("the account next door does not see it",
    !peek.body.agents.some((a) => a.id === agentId), JSON.stringify(peek.body.agents.map((a) => a.id)));
  const theirs = await api("/api/agent/update", {
    tenant: B, body: { id: agentId, name: "Mine now", instructions: "Do as I say.", status: "active", tools: [] },
  });
  check("...and cannot change its settings", theirs.status === 404, JSON.stringify(theirs.body));
  check("...with nothing altered by the attempt",
    q(`select status || '|' || name from agent.agents where id = '${agentId}';`) === "paused|Bike shop");

  // ── 15. A PAUSED AGENT REFUSES NEW WORK AND CANCELS NOTHING ────────────────
  console.log("\n── 15. paused: no new work, and nothing already asked for is cancelled ──");
  const before = q(`select count(*) from agent.agent_messages where agent_id = '${agentId}';`);
  // COUNTED BEFORE AND AFTER, never "nothing in the last two seconds" — every run
  // this file has already made was seconds ago, so a time window answers the wrong
  // question and fails on a correct refusal.
  const runsBefore = q(`select count(*) from agent.runs where tenant_id = '${A}';`);
  const refusedSend = await api("/api/agent/send",
    { body: { id: agentId, body: "are you there?", key: "press-paused" } });
  check("the send is refused", refusedSend.status === 409, JSON.stringify(refusedSend.body));
  check("...and says which thing is wrong", refusedSend.body.paused === true, JSON.stringify(refusedSend.body));
  check("...with no message stored",
    q(`select count(*) from agent.agent_messages where agent_id = '${agentId}';`) === before);
  check("...and no run accepted",
    q(`select count(*) from agent.runs where tenant_id = '${A}';`) === runsBefore, runsBefore);
  // THE CONVERSATION IS PRESERVED — a pause is not a delete and not a clear.
  const stillThere = await api("/api/agent/messages", { query: { id: agentId } });
  check("the conversation is all still there",
    stillThere.status === 200 && String(stillThere.body.messages.length) === before,
    `${stillThere.body.messages.length} of ${before}`);
  check("...with its answers intact",
    stillThere.body.messages.some((m) => m.run && m.run.state === "answered"));

  // AND A RUN ACCEPTED BEFORE THE PAUSE STILL RUNS. Pausing blocks new work; it is
  // not a cancellation, so work somebody already asked for finishes.
  await api("/api/agent/update", { body: { id: agentId, name: "Bike shop", instructions: "Completely different now.", status: "active", tools: [] } });
  const inflight = await api("/api/agent/send", { body: { id: agentId, body: "one last thing?", key: "press-inflight" } });
  check("a send while active is accepted", inflight.status === 200, JSON.stringify(inflight.body).slice(0, 160));
  await api("/api/agent/update", { body: { id: agentId, name: "Bike shop", instructions: "Completely different now.", status: "paused", tools: [] } });
  const finished = await engine(makeStandIn()).deliver(inflight.body.runId);
  check("⚠ and pausing while it is queued does not stop it running", finished.ran === true, JSON.stringify(finished));
  const afterPause = await api("/api/agent/messages", { query: { id: agentId } });
  const lastRow = afterPause.body.messages.find((m) => m.id === inflight.body.message.id);
  check("...so it is answered rather than cancelled",
    lastRow && lastRow.run && lastRow.run.state === "answered", JSON.stringify(lastRow && lastRow.run));

  // ── 16. A TOOL RUNS ONLY IF IT WAS SELECTED ───────────────────────────────
  //
  // The whole point of the permission, end to end: the stand-in chooses what to do
  // from the tools it is OFFERED, so which tools reach it is visible in the answer
  // it gives — no reading of the journal required.
  console.log("\n── 16. an unselected tool cannot run, and a selected one does ──");
  await api("/api/agent/update", { body: { id: agentId, name: "Bike shop", instructions: "Completely different now.", status: "active", tools: [] } });
  const without = await api("/api/agent/send", { body: { id: agentId, body: "nothing ticked", key: "press-notool" } });
  check("the run records an EMPTY selection rather than no selection",
    q(`select body -> 'tools' from agent.run_entries where run_id = '${without.body.runId}' and seq = 0;`) === "[]");
  await engine(makeStandIn()).deliver(without.body.runId);
  const noToolThread = await api("/api/agent/messages", { query: { id: agentId } });
  const noToolRow = noToolThread.body.messages.find((m) => m.id === without.body.message.id);
  check("...and the answer used no tool at all",
    noToolRow && noToolRow.run.state === "answered" && !/It used the/.test(noToolRow.run.text || ""),
    String(noToolRow && noToolRow.run.text).slice(0, 120));

  await api("/api/agent/update", { body: { id: agentId, name: "Bike shop", instructions: "Completely different now.", status: "active", tools: [tool] } });
  const withTool = await api("/api/agent/send", { body: { id: agentId, body: "ticked one", key: "press-tool" } });
  check("a selection reaches the run's own record",
    q(`select body -> 'tools' from agent.run_entries where run_id = '${withTool.body.runId}' and seq = 0;`)
      === JSON.stringify([tool]));
  // ⚠ AND THE EDIT AFTERWARDS CANNOT REACH IT. The selection is taken off the LOG on
  // every delivery, so unticking it between the accept and the run changes what the
  // NEXT run may call and never what this one may call.
  await api("/api/agent/update", { body: { id: agentId, name: "Bike shop", instructions: "Completely different now.", status: "active", tools: [] } });
  const usedIt = await engine(makeStandIn()).deliver(withTool.body.runId);
  check("the run with a tool runs", usedIt.ran === true, JSON.stringify(usedIt));
  const toolThread = await api("/api/agent/messages", { query: { id: agentId } });
  const toolRow = toolThread.body.messages.find((m) => m.id === withTool.body.message.id);
  check("⚠ ...and it really called the tool, though the setting was taken away first",
    toolRow && toolRow.run.state === "answered" && new RegExp(`It used the ${tool} tool`).test(toolRow.run.text || ""),
    String(toolRow && toolRow.run.text).slice(0, 200));
  check("...and its answer is still labelled a simulation",
    toolRow && toolRow.run.simulated === true && /\[simulated\]/.test(toolRow.run.text || ""),
    String(toolRow && toolRow.run.text).slice(0, 60));
  check("...and the tool really ran, which the journal is the only witness to",
    q(`select count(*) from agent.run_entries where run_id = '${withTool.body.runId}' and body ->> 'kind' = 'tool' and body ->> 'name' = '${tool}';`) === "1");

  // THE REFUSAL, from the other direction: a name the platform has no tool for is
  // turned away at the route rather than stored and silently ignored.
  const madeUp = await api("/api/agent/update",
    { body: { id: agentId, name: "Bike shop", instructions: "Completely different now.", tools: ["shell"] } });
  check("a tool the platform has not got is refused by name", madeUp.status === 400, JSON.stringify(madeUp.body));
  check("...and nothing was stored",
    q(`select coalesce(array_length(tools,1),0)::text from agent.agents where id = '${agentId}';`) === "0");

  // ── 17. AN AGENT CREATED PAUSED IS PAUSED ─────────────────────────────────
  //
  // ⚠ EVERY CHECK ABOVE PAUSES AN AGENT THAT ALREADY EXISTS, which is the layer
  // below the break: the form draws a Paused control for a NEW agent, and the create
  // route used to drop what it answered. The agent came back active and the tick was
  // the only thing claiming otherwise — a dead control that ANSWERS, wrongly.
  console.log("\n── 17. an agent created paused stays paused, refuses, and accepts once active ──");
  const bornPaused = await api("/api/agent/create",
    { body: { name: "Asleep", instructions: "Rest until somebody wakes you.", status: "paused", tools: [tool] } });
  check("a create that names a pause is accepted", bornPaused.status === 200, JSON.stringify(bornPaused.body).slice(0, 200));
  const sleeper = bornPaused.body.agent && bornPaused.body.agent.id;
  check("...and the answer says it is paused",
    bornPaused.body.agent && bornPaused.body.agent.status === "paused", JSON.stringify(bornPaused.body.agent));
  check("...and the DATABASE says so, which is the only thing a reload reads",
    q(`select status from agent.agents where id = '${sleeper}';`) === "paused");
  // A RELOAD IS AN ORDINARY LIST READ — the browser holds no state about a saved
  // agent, so this is exactly what a fresh page does.
  const afterReload = await api("/api/agent/list", { method: "GET" });
  const sleeperRow = afterReload.body.agents.find((a) => a.id === sleeper);
  check("⚠ a reload still finds it paused", sleeperRow && sleeperRow.status === "paused", JSON.stringify(sleeperRow));
  check("...with the selection it was created with",
    sleeperRow && JSON.stringify(sleeperRow.tools) === JSON.stringify([tool]), JSON.stringify(sleeperRow && sleeperRow.tools));

  // IT REFUSES NEW WORK, AND THE REFUSAL WRITES NOTHING — which is what lets the
  // browser keep the typed words AND the retry key, so the next press after a
  // resume is the SAME press rather than a second message.
  const sleeperRuns = q(`select count(*) from agent.runs where tenant_id = '${A}';`);
  const knocked = await api("/api/agent/send",
    { body: { id: sleeper, body: "typed while it was asleep", key: "press-born-paused" } });
  check("it refuses new work", knocked.status === 409 && knocked.body.paused === true, JSON.stringify(knocked.body));
  check("...having written no message",
    q(`select count(*) from agent.agent_messages where agent_id = '${sleeper}';`) === "0");
  check("...and accepted no run",
    q(`select count(*) from agent.runs where tenant_id = '${A}';`) === sleeperRuns, sleeperRuns);

  // ...AND ACCEPTS WORK ONCE IT IS ACTIVATED, under the SAME key the refusal kept —
  // which is the whole point of writing nothing: the press that was refused is the
  // press that now lands, rather than a duplicate beside it.
  const woken = await api("/api/agent/update",
    { body: { id: sleeper, name: "Asleep", instructions: "Rest until somebody wakes you.", status: "active" } });
  check("it can be activated", woken.status === 200 && woken.body.agent.status === "active", JSON.stringify(woken.body.agent));
  const accepted = await api("/api/agent/send",
    { body: { id: sleeper, body: "typed while it was asleep", key: "press-born-paused" } });
  check("⚠ and the SAME press now lands", accepted.status === 200, JSON.stringify(accepted.body).slice(0, 200));
  check("...as one message, not two",
    q(`select count(*) from agent.agent_messages where agent_id = '${sleeper}';`) === "1");
  const ranAfter = await engine(makeStandIn()).deliver(accepted.body.runId);
  check("...and the work really runs", ranAfter.ran === true, JSON.stringify(ranAfter));
  const wokenThread = await api("/api/agent/messages", { query: { id: sleeper } });
  const wokenRow = wokenThread.body.messages.find((m) => m.id === accepted.body.message.id);
  check("...and is answered", wokenRow && wokenRow.run && wokenRow.run.state === "answered",
    JSON.stringify(wokenRow && wokenRow.run));

  // THE CONTROL, without which "created paused" proves nothing about the create: an
  // agent created with NO status at all is ACTIVE, decided by the column's own
  // default rather than by anything this route writes.
  const bornActive = await api("/api/agent/create",
    { body: { name: "Awake", instructions: "Answer straight away." } });
  check("an agent created with no status is active",
    bornActive.status === 200 && bornActive.body.agent.status === "active", JSON.stringify(bornActive.body.agent));
  check("...in the database too",
    q(`select status from agent.agents where id = '${bornActive.body.agent.id}';`) === "active");
  const straightAway = await api("/api/agent/send",
    { body: { id: bornActive.body.agent.id, body: "hello", key: "press-born-active" } });
  check("...and it takes work immediately", straightAway.status === 200, JSON.stringify(straightAway.body).slice(0, 160));

  // AND A STATUS IT CANNOT READ IS A REFUSAL ON A CREATE TOO, not a default — the
  // same reader as the update, so the two cannot disagree about what may be stored.
  const madeUpStatus = await api("/api/agent/create",
    { body: { name: "Junk", instructions: "Whatever.", status: "asleep" } });
  check("a status the platform cannot read is refused on a create",
    madeUpStatus.status === 400 && /active or paused/i.test(madeUpStatus.body.error || ""), JSON.stringify(madeUpStatus.body));
  check("...with no agent made",
    q(`select count(*) from agent.agents where name = 'Junk' and tenant_id = '${A}';`) === "0");

  // ── 18. WHAT A RUN IS REALLY DOING ────────────────────────────────────────
  //
  // ⚠ **ONE WORD WAS DOING FIVE JOBS AND THE REQUIREMENT NAMES THE WORST OF THEM.**
  // `agent.runs.status` is `new | running | stopped`, and this reader turned `running` into
  // `working` — so a run really thinking, a run waiting for a person, and a run NOTHING WILL
  // EVER DELIVER AGAIN all read as *working*, for ever. The three below are driven through
  // the SITE's own conversation route, because that is the reader a customer gets.
  console.log("\n── 18. waiting, unresolved and cancelled read as themselves ──");
  const stAgent = (await api("/api/agent/create",
    { body: { name: "States", instructions: "Say what you are doing.", tools: [tool] } })).body.agent.id;

  // ── WAITING: a request a person can still answer. A run in this state has its work row
  // marked DONE — there is nothing to redeliver until somebody answers — which is exactly
  // why it used to read as *working* with no way to tell.
  const asking = await api("/api/agent/send", { body: { id: stAgent, body: "waiting on a person", key: "st-wait" } });
  q(`insert into agent.run_entries (run_id, seq, body) values ('${asking.body.runId}', 1,
       '{"kind":"model","at":2,"step":1,"text":"","toolCalls":[{"id":"c0","name":"${tool}","args":{}}]}'::jsonb);`);
  const askedFor = q(`select agent.request_tool_approval('${A}','${asking.body.runId}','${stAgent}',1,0,
    '${tool}','{}'::jsonb,'vh1') ->> 'id';`);
  const waitRow = async () => (await api("/api/agent/messages", { query: { id: stAgent } }))
    .body.messages.find((m) => m.id === asking.body.message.id);
  let row = await waitRow();
  check("a run waiting for a person reads WAITING, not working",
    row && row.run.state === "waiting", JSON.stringify(row && row.run));
  check("...and it says how many calls are waiting, because one and four are different things",
    row && row.run.open === 1, JSON.stringify(row && row.run));

  // ⚠ AND A WINDOW THAT CLOSES MOVES IT — the same run, the same log, nobody having touched
  // it. This is the state the requirement names: *a stranded run must not appear to be
  // actively working forever.* Nobody can answer that request any more, so the run is not
  // waiting for a person; its call is simply unresolved.
  q(`update agent.tool_approvals set expires_at = now() - interval '1 minute' where id = '${askedFor}';`);
  row = await waitRow();
  check("⚠ once the window closes the SAME run reads UNRESOLVED rather than waiting",
    row && row.run.state === "unresolved", JSON.stringify(row && row.run));
  check("...still naming the call nobody answered", row && row.run.open === 1, JSON.stringify(row && row.run));
  // THE CONTROL that makes both of those about the approval rather than about the log:
  // putting the window back puts the run back in the waiting state.
  q(`update agent.tool_approvals set expires_at = now() + interval '1 hour' where id = '${askedFor}';`);
  check("...and back inside its window it waits again",
    (await waitRow()).run.state === "waiting");

  // ── AND AN ORDINARY RUN IS STILL `working`, which is what makes the two above mean
  // something rather than being a reader that says "unresolved" about everything.
  const busy = await api("/api/agent/send", { body: { id: stAgent, body: "ordinary work", key: "st-busy" } });
  q(`insert into agent.run_entries (run_id, seq, body) values
       ('${busy.body.runId}', 1, '{"kind":"model","at":2,"step":1,"text":"","toolCalls":[{"id":"c0","name":"${tool}","args":{}}]}'::jsonb),
       ('${busy.body.runId}', 2, '{"kind":"tool","at":3,"step":1,"index":0,"name":"${tool}","ms":1,"ok":true}'::jsonb);`);
  const busyRow = (await api("/api/agent/messages", { query: { id: stAgent } }))
    .body.messages.find((m) => m.id === busy.body.message.id);
  check("a run whose batch was answered is still WORKING",
    busyRow && busyRow.run.state === "working", JSON.stringify(busyRow && busyRow.run));
  check("...and says nothing about open calls, rather than sending a zero to be drawn",
    busyRow && busyRow.run.open === undefined, JSON.stringify(busyRow && busyRow.run));

  // ── CANCELLED: somebody stopped it. NOT a failure — nothing went wrong — and the counts
  // are the one honest thing to say about it. *Don't claim completed effects were undone.*
  // The field is `run`, as every other route here names it — read off the route rather than
  // guessed: the first draft sent `runId` and was answered `which run?`, correctly.
  const stopped = await api("/api/agent/run-cancel",
    { body: { run: busy.body.runId, reason: "changed my mind" } });
  check("the cancellation is accepted and says nothing was undone",
    stopped.status === 200 && /was not undone/.test(stopped.body.say || ""), JSON.stringify(stopped.body));
  const goneRow = (await api("/api/agent/messages", { query: { id: stAgent } }))
    .body.messages.find((m) => m.id === busy.body.message.id);
  check("⚠ a run somebody stopped reads CANCELLED, never failed",
    goneRow && goneRow.run.state === "cancelled", JSON.stringify(goneRow && goneRow.run));
  check("...naming who stopped it and how far it got",
    goneRow && goneRow.run.by === A && goneRow.run.completedSteps === 1 && goneRow.run.completedCalls === 1,
    JSON.stringify(goneRow && goneRow.run));
  check("...and carrying their words rather than a sentence of ours",
    goneRow && goneRow.run.note === "changed my mind", JSON.stringify(goneRow && goneRow.run));
  // AND NOTHING WILL DELIVER IT AGAIN, which is the half a state word cannot carry.
  check("...with its work released so nothing is delivered again",
    q(`select (done_at is not null)::text from agent.run_work where run_id = '${busy.body.runId}';`) === "true");

  // ⚠ AND `queued` IS STILL TOLD FROM `working` BY THE STEP, which is the distinction that
  // was already here and must survive: `status` reads `running` from the instant a run is
  // accepted, because the accepting transaction writes the `started` entry.
  const fresh = await api("/api/agent/send", { body: { id: stAgent, body: "not started yet", key: "st-fresh" } });
  const freshRow = (await api("/api/agent/messages", { query: { id: stAgent } }))
    .body.messages.find((m) => m.id === fresh.body.message.id);
  check("a run accepted and not yet worked on still reads QUEUED",
    freshRow && freshRow.run.state === "queued", JSON.stringify(freshRow && freshRow.run));
  check("...and the database really says `running`, so the step is what tells them apart",
    q(`select status from agent.runs where id = '${fresh.body.runId}';`) === "running");

} finally {
  await rest.close();
  try { su(`psql -X -q -d postgres -c ${shq(`drop database if exists ${DB};`)}`); } catch { /* best effort */ }
}

console.log(`\n${failed ? "FAILED" : "PASSED"} — ${failed} failed`);
if (failed) { console.log("FAILURES:\n" + fails.map((f) => "  - " + f).join("\n")); process.exit(1); }
