#!/usr/bin/env node
/**
 * ⚠ **SCRIPTED DEMONSTRATIONS — six complete scenarios, end to end. `npm run verify:integration`.**
 *
 * **THESE ARE LABELLED SCRIPTED AND THE LABEL IS THE FIRST THING IN THE FILE**, because the
 * requirement says so in as many words: *they prove execution and integration, not
 * natural-language intelligence.* What is scripted is the WORDS and, where a tool takes a
 * nested object, its ARGUMENTS. What is real is everything the words reach.
 *
 * ── WHAT IS REAL, PIECE BY PIECE ─────────────────────────────────────────────
 *
 *   * the DATABASE — a throwaway PostgreSQL with this repository's own migrations, so every
 *     constraint, trigger, lock, RLS policy and column grant is genuine;
 *   * the SITE's routes (`handleAgentApi`) for everything a person does — writing the agent,
 *     ticking its tools, pressing Run now, answering an approval;
 *   * the QUEUE and the DISPATCHER — `worker.queue` and `worker.scheduled`, the Worker's own
 *     handlers, claiming through `claim_run`, reading the snapshot, narrowing the tools;
 *   * the TOOLS — `CAPABILITY_TOOLS`, with a real capability seam over that database;
 *   * the STAND-IN model, in the loop, for every scenario where it can compose the call.
 *
 * ── WHAT IS SIMULATED, IN ONE PLACE ──────────────────────────────────────────
 *
 * The MODEL and two TRANSPORTS. `makeStandIn` reads the tools it was offered, picks the one
 * the request names and fills that tool's own declared schema; **no paid call is made and none
 * can be.** PostgREST is a local shim and Cloudflare Queues is an in-process doorbell, because
 * neither is reachable from a laptop — durability is unchanged, because the work is a ROW.
 * The provider is `makeFakeProvider`: no network, no credential of anybody's, every answer
 * labelled fake.
 *
 * ⚠ **AND WHERE THE STAND-IN STRUCTURALLY CANNOT COMPOSE A CALL, THE SECTION SAYS SO.** A
 * workflow is a list of nested objects and this stand-in fills a schema from the words of a
 * request; it cannot produce one. Those tools are called with a real `ctx` — the same
 * capability seam, the same operation identity, the same database — and the sections that need
 * the model IN the loop (the approval gate, the narrowing, the resume) drive it through a real
 * message instead. Saying which is which is the whole of being honest here.
 *
 * ⚠ NOTHING HERE TOUCHES THE HOSTED PROJECT.
 */

import { handleAgentApi, makeAgentStore } from "../../agent-store.mjs";
import worker from "../src/worker.mjs";
import { haveCluster, standUp, dispatcher } from "./lib/local-stack.mjs";
import { CAPABILITY_TOOLS } from "../src/capability-tools.mjs";
import { makeCapabilities } from "../src/capabilities.mjs";
import { makeConnections } from "../src/connections.mjs";
import { makeFakeProvider, FAKE_PROVIDER } from "../src/fake-provider.mjs";
import { argsHash } from "../src/approvals.mjs";

const DB = `agent_integration_${process.pid}`;
const A = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa";
const RUN_SEED = "77777777-7777-4777-8777-777777777777";
const CX = "cccccccc-9999-4999-8999-cccccccccccc";
const SECRET = "fake-token-do-not-use-0011";

let failed = 0;
const fails = [];
const check = (what, cond, detail = "") => {
  if (!cond) { failed++; fails.push(what + (detail ? ` — ${detail}` : "")); }
  console.log(`  ${cond ? "ok  " : "FAIL"}  ${what}${detail ? ` — ${detail}` : ""}`);
};

if (!haveCluster()) {
  console.log("No local PostgreSQL that `su postgres` can reach — nothing to verify against.");
  console.log("  start one with:  pg_ctlcluster 16 main start");
  process.exit(0);
}

console.log("\n⚠ SCRIPTED DEMONSTRATIONS. The model is a stand-in and every provider answer is fake.");
const stack = await standUp({ db: DB });
const { q, rest } = stack;

try {
  const appStore = () => makeAgentStore({ fetch: (u, o) => fetch(u, o), url: rest.url, key: "local-service-role" });
  let minted = 0;
  const api = (p, { tenant = A, body = {}, query = null, ring } = {}) => handleAgentApi({
    path: p, method: query ? "GET" : "POST",
    tenant, body, query: new URLSearchParams(query || {}), store: appStore(), ring,
    newId: () => `00000000-0000-4000-8000-${String(++minted).padStart(12, "0")}`,
    log: () => {},
  });
  const { env, drain, ring, tick, rung } = dispatcher({ worker, rest });

  /** A tool called with a real `ctx`: the real seam, a real identity, the real database. */
  let step = 0;
  const ctxFor = async (args) =>
    ({ capabilities: can, operation: `${RUN_SEED}:${++step}:0:${await argsHash(args)}` });
  const call = async (name, args) =>
    CAPABILITY_TOOLS.find((t) => t.name === name).run(args, await ctxFor(args));

  /** Send one message and let the real consumer run it, the way a person pressing send does. */
  let press = 0;
  const ask = async (agent, words) => {
    const sent = await api("/api/agent/send", { body: { id: agent, body: words, key: `press-${++press}` }, ring });
    await drain();
    return sent;
  };
  const answered = (runId) => q(`select coalesce(stop ->> 'text', '') from agent.runs where id = '${runId}';`);
  const calledTools = (runId) =>
    q(`select coalesce(string_agg(body ->> 'name', ',' order by seq), '') from agent.run_entries
        where run_id = '${runId}' and body ->> 'kind' = 'tool';`);
  const toolResults = (runId) =>
    q(`select coalesce(string_agg((body -> 'value')::text, '|~|' order by seq), '') from agent.run_entries
        where run_id = '${runId}' and body ->> 'kind' = 'tool';`)
      .split("|~|").filter(Boolean).map((t) => JSON.parse(t));

  // ═════════════════════════════════════════════════════════════════════════
  console.log("\n1. A DISABLED, SCHEDULED WORKFLOW WITH INPUTS — written by a tool");
  // ═════════════════════════════════════════════════════════════════════════
  //
  // ⚠ **THE ZONE IS SET BY A PERSON FIRST, and that order is the demonstration.** A tool
  // cannot choose a time zone — see `zoneFor` — so an agent with none refuses a scheduled
  // automation and says where to set it. This presses the settings form's own route.
  const made = await api("/api/agent/create", {
    body: { name: "Workshop", instructions: "Look after the workshop's routines.",
            tools: CAPABILITY_TOOLS.map((t) => t.name) },
  });
  const AG = made.body.agent.id;
  check("an agent exists with every tool ticked", made.status === 200, JSON.stringify(made.body).slice(0, 120));
  check("⚠ ...and it has NO time zone, which is the honest default",
    made.body.agent.zone === null, JSON.stringify(made.body.agent.zone));

  const can = makeCapabilities({ fetch: (u, o) => fetch(u, o), url: rest.url, key: "local-service-role" })
    .forTenant(A).forAgent(AG);

  const STEPS = [
    { type: "note", text: "Reminder for {{customer}}: your bike is due on {{due}}." },
    { type: "if", left: "{{customer}}", op: "is", right: "nobody" },
    { type: "note", text: "skipped" },
    { type: "end" },
  ];
  const INPUTS = [
    { name: "customer", type: "text", label: "Who it is for", required: true },
    { name: "due", type: "text", label: "When it is due" },
  ];

  // ⚠ REFUSED FIRST, because a refusal that nobody demonstrated is a refusal nobody has seen.
  const noZone = await call("make_automation",
    { name: "Reminders", steps: STEPS, inputs: INPUTS, schedule: "daily", atLocal: "08:30", enabled: false });
  check("⚠ a scheduled automation is REFUSED while the account has no time zone",
    noZone.ok === false && noZone.error === "no-zone", JSON.stringify(noZone).slice(0, 170));
  check("...and it says where to set one, and that nothing was saved",
    /settings/i.test(noZone.say) && /[Nn]othing has been saved/.test(noZone.say), noZone.say);
  check("...and NOTHING was written", q(`select count(*) from agent.automations;`) === "0");

  const zoned = await api("/api/agent/update", {
    body: { id: AG, name: "Workshop", instructions: "Look after the workshop's routines.",
            zone: "Europe/London" },
  });
  check("a person sets the time zone on the settings form", zoned.status === 200 && zoned.body.agent.zone === "Europe/London",
    JSON.stringify(zoned.body.agent?.zone));

  // ⚠ CHECKED BEFORE IT IS SAVED, through the tool a model would use — and the declarations go
  // with the steps, or `{{customer}}` is refused by the very check that is supposed to help.
  const checked = await call("check_workflow", { steps: STEPS, inputs: INPUTS });
  check("the workflow checks out, with its declarations",
    checked.ok === true && checked.steps === 4, JSON.stringify(checked).slice(0, 160));
  check("⚠ ...and the SAME workflow without them is refused, which is why they had to be carried",
    (await call("check_workflow", { steps: STEPS })).ok === false);

  const wrote = await call("make_automation",
    { name: "Reminders", steps: STEPS, inputs: INPUTS, schedule: "daily", atLocal: "08:30", enabled: false });
  check("⚠ a DISABLED, SCHEDULED automation with two inputs is created by the tool",
    wrote.ok === true, JSON.stringify(wrote).slice(0, 200));
  const AUTO = wrote.automation;
  const shape = () => q(`select enabled::text || ' | ' || schedule || ' | ' || coalesce(at_local::text, '-')
      || ' | ' || coalesce(zone, '-') || ' | ' || jsonb_array_length(inputs)::text || ' inputs | '
      || jsonb_array_length(steps)::text || ' steps | v' || version::text
      || ' | ' || case when next_run_at is null then 'no-instant' else 'armed' end
      from agent.automations where id = '${AUTO}';`);
  check("...and the ROW says so, with the zone a person set and an instant the database computed",
    shape() === "false | daily | 08:30:00 | Europe/London | 2 inputs | 4 steps | v1 | armed", shape());
  check("⚠ ...and the instant is 08:30 in LONDON, not in UTC",
    q(`select to_char(next_run_at at time zone 'Europe/London', 'HH24:MI') from agent.automations where id = '${AUTO}';`) === "08:30");
  // ⚠ AND A DISABLED AUTOMATION IS NOT DUE, whatever its instant says — the tick reads the flag.
  check("⚠ ...and being disabled, no tick will fire it",
    q(`select count(*) from agent.automations where id = '${AUTO}' and enabled and next_run_at <= now();`) === "0");

  // ═════════════════════════════════════════════════════════════════════════
  console.log("\n2. A PERSON APPROVES THE ACTIVATION — the model asks, the run holds, somebody says yes");
  // ═════════════════════════════════════════════════════════════════════════
  //
  // ⚠ **THE MODEL IS IN THE LOOP HERE, and that is the point of this section.** `pause_automation`
  // takes an id and a flag, which the stand-in CAN fill from the words of a request — so the
  // whole chain is real: a message through the site's route, the queue, the loop, the approval
  // request written by `run.mjs`, the screen's own list, the person's press, and the resume.
  // ⚠ **`name=value` IS HOW THE STAND-IN FILLS A DECLARED PROPERTY, and it is scripted on
  // purpose.** `standInArgs` reads the request for each required property by name and cannot
  // invent an identifier — an automation's id names a real row. So the WORDS are scripted and
  // everything they reach is real; written as prose the model filled `id` with the whole
  // sentence, which is what the schema-driven fallback does and is honest about.
  const asked = await ask(AG, `use pause_automation id=${AUTO} enabled=true`);
  const RUN2 = asked.body.runId;
  check("the message is accepted and a run starts", asked.status === 200 && !!RUN2, JSON.stringify(asked.body).slice(0, 120));
  check("⚠ THE RUN HOLDS — it did not do it and it did not fail",
    q(`select status from agent.runs where id = '${RUN2}';`) === "running"
    && q(`select count(*) from agent.tool_approvals where run_id = '${RUN2}' and verdict is null;`) === "1",
    q(`select status from agent.runs where id = '${RUN2}';`));
  check("⚠ ...and the automation is STILL OFF, so nothing happened while nobody had answered",
    q(`select enabled::text from agent.automations where id = '${AUTO}';`) === "false");

  const waiting = await api("/api/agent/tool-approvals", { query: { agent: AG } });
  const req = (waiting.body.approvals || []).find((r) => r.run === RUN2) ?? null;
  check("the screen's own list shows what is being asked, with the arguments",
    !!req && req.tool === "pause_automation" && req.args?.id === AUTO && req.args?.enabled === true,
    JSON.stringify(req?.args));

  const said = await api("/api/agent/tool-approve", { body: { id: req.id, verdict: "approved" }, ring });
  check("a person approves it through the site's own route", said.status === 200, JSON.stringify(said.body).slice(0, 120));
  await drain(); await tick(); await drain();
  check("⚠ ...and ONLY THEN does the tool run — the automation is on",
    q(`select enabled::text from agent.automations where id = '${AUTO}';`) === "true",
    q(`select enabled::text from agent.automations where id = '${AUTO}';`));
  check("...the run called exactly the tool that was approved", calledTools(RUN2) === "pause_automation",
    calledTools(RUN2));
  check("...and it finished with something to say", /\[simulated\]/.test(answered(RUN2)), answered(RUN2).slice(0, 100));
  // ⚠ AND ENABLING RE-ARMED THE INSTANT FORWARD, which is what stops a long-disabled
  // automation coming back with a backlog. Read as a comparison, not as a literal.
  check("⚠ ...and its next instant was re-armed forward, not left where it was",
    q(`select (next_run_at > now())::text from agent.automations where id = '${AUTO}';`) === "true");

  // ═════════════════════════════════════════════════════════════════════════
  console.log("\n3. IT RUNS: a branch, a wait, a RESTART, and no duplicate effects");
  // ═════════════════════════════════════════════════════════════════════════
  //
  // A second automation, because this one has to stop in the middle: a note, a loop over a
  // declared list, an approval, and a note after it. Composed here (a nested list) and written
  // by the real tool.
  const LOOPY = [
    { type: "note", text: "Starting for {{customer}}.", out: "opened" },
    { type: "repeat", mode: "each", each: "{{lines}}", as: "line" },
    { type: "note", text: "item {{line}}" },
    { type: "endrepeat" },
    { type: "approval", ask: "Send the summary?", hours: 24, on_timeout: "reject" },
    { type: "note", text: "Sent for {{customer}}." },
  ];
  const loopMade = await call("make_automation", {
    name: "Summaries", steps: LOOPY,
    inputs: [{ name: "customer", type: "text", required: true }, { name: "lines", type: "list" }],
  });
  check("an automation with a loop and an approval is written by the tool", loopMade.ok === true,
    JSON.stringify(loopMade).slice(0, 180));
  const AUTO3 = loopMade.automation;

  const started = await call("run_automation", { id: AUTO3, input: { customer: "Ada", lines: ["a", "b", "c"] } });
  check("the tool starts it, with the values it was given", started.ok === true && !!started.execution,
    JSON.stringify(started).slice(0, 160));
  // ⚠ A PRECONDITION EVERY LATER READ RESTS ON, NAMED HERE. Without it an execution that was
  // never started reaches a query as the string "undefined" and psql's uuid error is what a
  // reader sees — a failure about the wrong layer, and the rest of the file never runs.
  if (!started.execution) throw new Error(`section 3 cannot continue: ${JSON.stringify(started)}`);
  const EX3 = started.execution;
  check("⚠ the input is SNAPSHOTTED on the execution, not read live",
    q(`select (input ->> 'customer') || '/' || (input -> 'lines')::text from agent.automation_runs where id = '${EX3}';`)
      === 'Ada/["a", "b", "c"]');
  // ⚠ **AND THE LIST IS STORED AS A REAL LIST, which is the whole of what a loop can go
  // through.** Every answer used to be read as a string, so a declared list held `"a,b,c"`
  // and `repeat … each` refused it at run time as *"not a list"* — a control nobody could
  // use, at either end. See the entry in this product's own notes.
  check("⚠ ...and a declared LIST is stored as a list, never as its own text",
    q(`select jsonb_typeof(vars -> 'lines') || '/' || (vars -> 'lines')::text from agent.automation_runs where id = '${EX3}';`)
      === 'array/["a", "b", "c"]');

  const outcomes = () => JSON.parse(q(`select coalesce(outcomes::text, '[]') from agent.automation_runs where id = '${EX3}';`));
  const ran = () => outcomes().filter((o) => o.outcome === "ran").length;
  // ⚠ **A TOOL-STARTED EXECUTION WAITS FOR THE CRON, and the demonstration says so rather
  // than hiding it behind a drain.** A tool runs INSIDE the consumer, and the consumer never
  // produces — its configuration asks for the project and not for a queue binding — so
  // nothing rings. The work is a ROW before the tool returns, which is why waiting is free:
  // `accept_automation_run` commits the execution and its work row together, and
  // `sweep_run_work` offers an unheld row with no grace at all.
  check("⚠ nothing has run yet, because a tool cannot ring the queue from inside the consumer",
    outcomes().length === 0 && rung.length === 0, `${outcomes().length} outcomes, ${rung.length} rung`);
  await tick(); await drain();
  check("⚠ IT IS WAITING at the approval, having run the loop",
    q(`select (waiting ->> 'kind') from agent.automation_runs where id = '${EX3}';`) === "approval",
    q(`select coalesce(waiting::text, '(not waiting)') from agent.automation_runs where id = '${EX3}';`));
  const loopRan = ran();
  check("...and the loop really went round three times, once per line",
    outcomes().filter((o) => o.outcome === "ran" && /item [abc]/.test(o.result ?? "")).length === 3,
    JSON.stringify(outcomes().map((o) => o.result).filter(Boolean)));
  check("⚠ THE WORKER IS RELEASED AND THE DOORBELL IS EMPTY — nothing is held open",
    q(`select coalesce(claimed_by, '-') || '|' || (done_at is not null)::text from agent.run_work where run_id = '${EX3}';`) === "-|true"
    && rung.length === 0);

  // ⚠ **THE RESTART: A BRAND-NEW DISPATCHER, with its own env and no memory of anything.**
  // Nothing about this execution exists outside the database — which the empty doorbell above
  // already showed — so a second process resuming it is the path a deploy leaves behind.
  const after = dispatcher({ worker, rest });
  await after.deliver(EX3);
  check("⚠ A DELIVERY TO A NEW PROCESS WHILE IT WAITS CHANGES NOTHING",
    ran() === loopRan && q(`select (waiting ->> 'kind') from agent.automation_runs where id = '${EX3}';`) === "approval",
    `${ran()} ran, was ${loopRan}`);
  await after.tick(); await after.drain();
  check("⚠ ...and a cron tick does not wake it either, because nobody has answered",
    ran() === loopRan && q(`select (waiting ->> 'kind') from agent.automation_runs where id = '${EX3}';`) === "approval");

  // ⚠ WHICH STEP IS BEING ANSWERED COMES FROM THE WAITING ROW, never from a guess. The
  // suspended step's id is what `decide_automation_approval` matches on, so an answer for one
  // pause can never be read as the answer to another — and an outcome's own key is `id`, not
  // `step`, which is what this line first read.
  const at = q(`select (waiting ->> 'step') from agent.automation_runs where id = '${EX3}';`);
  check("...and the row itself says which step is waiting", /^s\d+$/.test(at), at);
  const decided = await api("/api/agent/automation-approve", {
    body: { run: EX3, step: at, verdict: "approved", note: "looks right" }, ring: after.ring,
  });
  check("a NEW process records the person's decision", decided.status === 200 && decided.body.verdict === "approved",
    JSON.stringify(decided.body).slice(0, 140));
  await after.drain();
  const fin3 = q(`select coalesce(finished_at::text, '-') from agent.automation_runs where id = '${EX3}';`);
  check("⚠ IT FINISHES, and the step after the approval really ran",
    fin3 !== "-" && outcomes().some((o) => o.outcome === "ran" && /Sent for Ada/.test(o.result ?? "")),
    `finished_at ${fin3}; ${JSON.stringify(outcomes().map((o) => o.result ?? o.outcome))}`);

  // ⚠ **NO DUPLICATE EFFECTS — asserted as a COUNT PER OUTCOME KEY, which is the only shape
  // that can see one.** Each step appears exactly once, so a redelivery that re-ran a
  // committed step would be two entries under one id — and a step inside a loop carries its
  // round in that id, which is why three rounds are three keys rather than one counted thrice.
  const perStep = {};
  for (const o of outcomes()) perStep[o.id] = (perStep[o.id] ?? 0) + 1;
  const twice = Object.entries(perStep).filter(([, n]) => n > 1);
  check("⚠ NOT ONE STEP RAN TWICE, across two processes and three deliveries",
    twice.length === 0, JSON.stringify(twice));
  check("...and the loop's three rounds are three entries of ONE step, which is how a loop looks",
    outcomes().filter((o) => /item [abc]/.test(o.result ?? "")).length === 3);

  // ═════════════════════════════════════════════════════════════════════════
  console.log("\n4. AN EDIT REACHES THE NEXT RUN AND CAN NEVER REACH AN ACCEPTED ONE");
  // ═════════════════════════════════════════════════════════════════════════
  const before4 = q(`select jsonb_array_length(steps)::text from agent.automation_runs where id = '${EX3}';`);
  const edited = await call("change_automation", {
    id: AUTO3, name: "Summaries (shorter)",
    steps: [{ type: "note", text: "One line for {{customer}}." }],
  });
  check("the tool edits the saved workflow", edited.ok === true, JSON.stringify(edited).slice(0, 180));
  check("⚠ ...and says what it changed, which is the name and the steps and nothing else",
    JSON.stringify(edited.changed) === JSON.stringify(["name", "steps"]), JSON.stringify(edited.changed));
  check("the automation now holds one step",
    q(`select jsonb_array_length(steps)::text from agent.automations where id = '${AUTO3}';`) === "1");
  check("⚠ AND THE ACCEPTED EXECUTION'S SNAPSHOT IS UNTOUCHED — it still holds the six it ran",
    q(`select jsonb_array_length(steps)::text from agent.automation_runs where id = '${EX3}';`) === before4,
    `${q(`select jsonb_array_length(steps)::text from agent.automation_runs where id = '${EX3}';`)} vs ${before4}`);
  check("⚠ ...and the inputs it was NOT asked about are still declared",
    q(`select jsonb_array_length(inputs)::text from agent.automations where id = '${AUTO3}';`) === "2");
  check("⚠ ...and the version moved, because the STEPS moved",
    Number(q(`select version::text from agent.automations where id = '${AUTO3}';`)) === 2);
  // ⚠ AND A GUARDED EDIT AGAINST THE OLD VERSION IS REFUSED, which is the stale-read wall.
  const stale = await call("change_automation", { id: AUTO3, name: "Nope", ifVersion: 1 });
  check("⚠ an edit fenced on the version it READ is refused, naming the one it has",
    stale.ok === false && stale.error === "stale" && stale.version === 2, JSON.stringify(stale).slice(0, 180));
  check("...and that refusal changed nothing",
    q(`select name from agent.automations where id = '${AUTO3}';`) === "Summaries (shorter)");

  // ═════════════════════════════════════════════════════════════════════════
  console.log("\n5. STOPPING WORK: what had run stays run, and nothing runs after");
  // ═════════════════════════════════════════════════════════════════════════
  const again = await call("run_automation", { id: AUTO3, input: { customer: "Grace" } });
  const EX5 = again.execution;
  check("a second execution starts from the EDITED workflow", again.ok === true
    && q(`select jsonb_array_length(steps)::text from agent.automation_runs where id = '${EX5}';`) === "1",
    JSON.stringify(again).slice(0, 140));
  // ⚠ STOPPED BEFORE IT IS DELIVERED, which is the case that matters: the work row exists and
  // nothing has claimed it. A cancel has to release it, or the next delivery runs a stopped run.
  const stopped = await call("cancel_execution", { id: EX5, reason: "asked for the wrong customer" });
  check("⚠ the tool stops it, and SAYS what had already happened rather than undoing it",
    stopped.ok === true && stopped.stopped === true
    && Number.isInteger(stopped.completedSteps) && Number.isInteger(stopped.completedCalls),
    JSON.stringify(stopped).slice(0, 220));
  check("...and its sentence does not claim anything was undone",
    /was not undone/.test(stopped.say), stopped.say);
  check("the run's own journal says who stopped it and why",
    q(`select (stop ->> 'reason') || ' / ' || (stop ->> 'cancelledBy') || ' / ' || (stop ->> 'note')
        from agent.runs where id = '${EX5}';`) === `cancelled / agent:${AG} / asked for the wrong customer`);
  check("⚠ ...and the work row is RELEASED and done, so nothing will be delivered again",
    q(`select coalesce(claimed_by, '-') || '|' || (done_at is not null)::text from agent.run_work where run_id = '${EX5}';`) === "-|true");

  // ⚠ **AND SUBSEQUENT ACTIONS REALLY STOP — driven, not assumed.** A delivery and a cron tick
  // after the stop, then the outcomes read again: a cancelled run that resumed would be the
  // whole point of this section failing.
  const stoppedOutcomes = q(`select coalesce(outcomes::text, '[]') from agent.automation_runs where id = '${EX5}';`);
  await after.deliver(EX5);
  await after.tick(); await after.drain();
  check("⚠ A DELIVERY AND A TICK AFTER THE STOP RUN NOTHING",
    q(`select coalesce(outcomes::text, '[]') from agent.automation_runs where id = '${EX5}';`) === stoppedOutcomes
    && q(`select status from agent.runs where id = '${EX5}';`) === "stopped",
    q(`select status from agent.runs where id = '${EX5}';`));
  const twiceStopped = await call("cancel_execution", { id: EX5 });
  check("⚠ ...and stopping it again answers what it really ended as, rather than stopping it twice",
    twiceStopped.ok === true && twiceStopped.alreadyStopped === true && twiceStopped.stopped === false,
    JSON.stringify(twiceStopped).slice(0, 200));

  // ═════════════════════════════════════════════════════════════════════════
  console.log("\n6. AN OUTBOUND WRITE: successful, refused and uncertain — each RETRIED");
  // ═════════════════════════════════════════════════════════════════════════
  //
  // ⚠ **THE PROVIDER IS FAKE AND EVERY ANSWER SAYS SO.** What is real is the lease, the
  // operation record, the settle and the answer the model is shown. `trace` is what a
  // reconciliation matches on, and the connection's credential never leaves the database.
  const via = (provider) => makeConnections({
    fetch: (u, o) => fetch(u, o), url: env.SUPABASE_URL, key: env.SUPABASE_SERVICE_KEY,
    adapters: { [FAKE_PROVIDER]: provider },
  }).forTenant(A).forAgent(AG);
  const stored = await via(makeFakeProvider({ secret: SECRET })).connect({
    id: CX, provider: FAKE_PROVIDER, label: "Workshop mail", account: "shop@example.test",
    scopes: ["read", "send"], secret: SECRET, refresh: "fake-refresh-0011" });
  check("a person connects something, and the answer carries no credential",
    stored?.ok === true && !JSON.stringify(stored).includes(SECRET), JSON.stringify(stored).slice(0, 140));

  const sendTool = CAPABILITY_TOOLS.find((t) => t.name === "send_message");
  const opFor = async (args, n) => `${RUN_SEED}:${80 + n}:0:${await argsHash(args)}`;
  /**
   * ⚠ **FIVE SHAPES, AND THE THREE UNCERTAIN ONES ARE THREE DIFFERENT EVENTS.**
   *
   * `timeout` means the request never arrived — nothing happened. `lost` means the work
   * HAPPENED and the answer went missing. **From the caller's side those two are
   * indistinguishable, which is the point**: what separates them is what a RECONCILIATION
   * finds, and that is the whole of *"uncertain writes need reconciliation, not blind
   * retries"*. The fifth is a provider that cannot say either way — the one case where
   * `unresolved` is the honest end of it.
   *
   * ⚠ **AND THE RECONCILIATION HAPPENS ON THE FIRST ATTEMPT, not on the retry** — measured,
   * after writing this section the other way round. `perform` catches an uncertain throw and
   * asks the provider immediately, because the message may be at the provider NOW and nobody
   * is going to ask later. The retry then reads the RECORD. So `reconciled` is a field of the
   * first answer, and only a record still IN FLIGHT makes a retry reconcile.
   */
  const CANNOT_SAY = "the provider could not say";
  const shapes = [
    { what: "SUCCEEDS", to: "ok@example.test", n: 1, mk: () => makeFakeProvider({ secret: SECRET }) },
    { what: "is REFUSED", to: "no@example.test", n: 2,
      mk: () => makeFakeProvider({ secret: SECRET,
        script: ({ action }) => (action === "send_message" ? "refused" : "ok") }) },
    { what: "is UNCERTAIN and never arrived", to: "gone@example.test", n: 3,
      mk: () => makeFakeProvider({ secret: SECRET,
        script: ({ action }) => (action === "send_message" ? "timeout" : "ok") }) },
    { what: "is UNCERTAIN and really landed", to: "landed@example.test", n: 4,
      mk: () => makeFakeProvider({ secret: SECRET,
        script: ({ action }) => (action === "send_message" ? "lost" : "ok") }) },
    // ⚠ **A PROVIDER THAT CANNOT SAY EITHER WAY**, which is the only shape that leaves an
    // answer genuinely unresolved. It is the fake with its `reconcile` replaced by one that
    // answers `known: false` — a real provider whose payload carries no marker behaves
    // exactly so, and this repository's own note records that nothing had ever driven it.
    { what: "is UNCERTAIN and unknowable", to: "silent@example.test", n: 5, unknowable: true,
      mk: () => {
        const base = makeFakeProvider({ secret: SECRET,
          script: ({ action }) => (action === "send_message" ? "lost" : "ok") });
        return Object.freeze({ ...base,
          reconcile: (act, args, lease) => {
            base.reconcile(act, { ...args, trace: undefined }, lease);
            return { simulated: true, known: false, why: CANNOT_SAY };
          } });
      } },
  ];
  for (const t of shapes) {
    const args = { connection: CX, to: t.to, body: "your bike is ready" };
    const op = await opFor(args, t.n);
    // ⚠ **THE KEY ENDS AT THE POSITION — the hash is a COLUMN, not part of it.** This read
    // was `like '%:85:0:%'`, which matches nothing, so `q` answered the empty string and the
    // check passed or failed for a reason that had nothing to do with the record: **a dead
    // observer**. `rows()` is what proves it alive, and it is asserted rather than assumed.
    const where = `tenant_id = '${A}' and op_key like '%:${80 + t.n}:0'`;
    const rows = () => q(`select count(*) from agent.operations where ${where};`);
    const inFlight = () => q(`select coalesce(outcome::text, '(in flight)') from agent.operations where ${where};`);

    const p1 = t.mk();
    const first = await sendTool.run(args, { connections: via(p1), operation: op });
    const sent1 = p1.seen().filter((c) => c.action === "send_message").length;
    const checked1 = p1.seen().filter((c) => c.action === "reconcile:send_message").length;
    // ⚠ **READ BEFORE ANY RETRY, because a retry can SETTLE it.** Asked afterwards this says
    // what the reconciliation concluded, which is a different fact wearing the same query —
    // the first draft of this section asked it there and reported the product as broken.
    const held = inFlight();
    check(`a write that ${t.what}: its operation really was recorded`, rows() === "1", `${rows()} row(s)`);

    // ⚠ THE RETRY USES A WILLING PROVIDER, so "nothing was sent again" is a claim about the
    // RECORD rather than about a provider that would have refused anyway.
    const p2 = t.unknowable ? t.mk() : makeFakeProvider({ secret: SECRET });
    const retry = await sendTool.run(args, { connections: via(p2), operation: op });
    const sent2 = p2.seen().filter((c) => c.action === "send_message").length;
    const checked2 = p2.seen().filter((c) => c.action === "reconcile:send_message").length;

    // WHAT EVERY SHAPE HAS IN COMMON, and it is the guarantee: the provider is asked to send
    // ONCE, and a retry of the same call never asks it again, whatever it then answers.
    check(`a write that ${t.what}: the provider was asked to send exactly once`, sent1 === 1,
      `${sent1} send(s), first: ${JSON.stringify(first).slice(0, 140)}`);
    check("⚠ ...and the RETRY NEVER SENT AGAIN, however it answered", sent2 === 0,
      JSON.stringify(p2.seen().map((c) => c.action)));

    if (t.n === 1) {
      check("a write that SUCCEEDS answers ok, and nothing was checked after the fact",
        first.ok === true && checked1 === 0, JSON.stringify(first).slice(0, 150));
      check("⚠ ...and the RETRY answers ok as a REPEAT, out of the record rather than the provider",
        retry.ok === true && retry.repeat === true && checked2 === 0, JSON.stringify(retry).slice(0, 180));
    } else if (t.n === 2) {
      // ⚠ A DEFINITE REFUSAL IS NOT UNCERTAIN, so it is settled at once and never reconciled.
      check("a write that is REFUSED answers a failure, with no reconciliation at all",
        first.ok === false && first.error === "action-failed" && checked1 === 0,
        JSON.stringify(first).slice(0, 150));
      // ⚠ **THE DEFECT THIS SECTION EXISTS FOR.** The retry used to answer `ok: true, "already
      // done"` about a message that never went out.
      check("⚠ ...and the RETRY IS STILL A FAILURE, carrying the recorded reason",
        retry.ok === false && retry.error === "action-failed" && retry.recorded === "refused",
        JSON.stringify(retry).slice(0, 190));
      check("⚠ ...and its sentence does not claim the work happened",
        !/had already been done/.test(retry.say), retry.say);
      check("⚠ ...and a settled failure is read from the record, never re-checked at the provider",
        checked2 === 0, `${checked2} reconciliation(s)`);
    } else if (t.n === 3) {
      // ⚠ **RECONCILED ON THE SPOT, AND IT FINDS NOTHING**: nothing arrived, so the answer is a
      // failure the model can act on — and its next attempt is a new step with its own identity,
      // because this engine never retries a call by itself.
      check("a write that is UNCERTAIN is CHECKED rather than guessed at",
        checked1 === 1 && first.reconciled === true, JSON.stringify(first).slice(0, 170));
      check("⚠ ...and finding nothing settles it as a FAILURE, said plainly",
        first.ok === false && first.error === "action-failed" && /had not happened/.test(first.why ?? ""),
        JSON.stringify(first).slice(0, 190));
      check("⚠ ...and the record is settled, so the retry reads it rather than asking again",
        held !== "(in flight)" && checked2 === 0 && retry.recorded === "not-done",
        `${held} | ${JSON.stringify(retry).slice(0, 140)}`);
    } else if (t.n === 4) {
      // ⚠ **THE SAME UNCERTAINTY, THE OPPOSITE FINDING** — and this is the one reading a blind
      // retry could never produce without sending a second message.
      check("a write whose answer was LOST is checked, and FOUND",
        checked1 === 1 && first.ok === true && first.reconciled === true,
        JSON.stringify(first).slice(0, 170));
      check("⚠ ...and it is reported as the success it really was, not as a failure",
        /had gone out/.test(first.say ?? ""), first.say);
      check("⚠ ...and the retry is a REPEAT out of the record, with nothing sent and nothing asked",
        retry.ok === true && retry.repeat === true && checked2 === 0, JSON.stringify(retry).slice(0, 160));
    } else {
      // ⚠ **NOBODY CAN TELL, AND THAT IS ITS OWN ANSWER.** `unresolved` is not a kind of
      // failure: `action-failed` says the work did not happen, this says nobody knows. They
      // invite opposite next moves — one invites doing it again, the other invites CHECKING
      // first — and recording an unknown as a failure is a claim nothing here is entitled to
      // make. The message really IS at the provider in this arm, which is why that matters.
      check("a write nobody can resolve answers UNRESOLVED, never a failure",
        first.ok === false && first.error === "unresolved" && first.uncertain === true && checked1 === 1,
        JSON.stringify(first).slice(0, 190));
      check("⚠ ...and its sentence tells the model to CHECK rather than to ask again",
        /check at/.test(first.say ?? "") && /twice/.test(first.say ?? ""), first.say);
      check("⚠ ...and its record was left IN FLIGHT, so evidence can still settle it",
        held === "(in flight)", held);
      check("⚠ ...and the RETRY RECONCILES rather than sending — and is still honest about not knowing",
        checked2 === 1 && retry.error === "unresolved" && retry.uncertain === true,
        JSON.stringify(retry).slice(0, 190));
      check("⚠ ...and it is STILL in flight afterwards, because nothing settled it",
        inFlight() === "(in flight)", inFlight());
    }
  }
  // ⚠ AND EVERY ONE OF THEM REALLY WENT THROUGH A RECORD, so "a retry is absorbed" is a fact
  // about rows rather than about this script's own bookkeeping.
  check(`${shapes.length} writes, ${shapes.length} records — and not one of them a second send`,
    Number(q(`select count(*) from agent.operations where tenant_id = '${A}' and action = 'fakemail_send_message';`)) === shapes.length,
    q(`select count(*) from agent.operations where tenant_id = '${A}' and action = 'fakemail_send_message';`));

  // ═════════════════════════════════════════════════════════════════════════
  console.log("\n7. WHAT NONE OF IT LEFT BEHIND");
  // ═════════════════════════════════════════════════════════════════════════
  const everything = q(`select coalesce(string_agg(t, ' '), '') from (
      select body::text as t from agent.run_entries
      union all select coalesce(outcome::text, '') from agent.operations
      union all select coalesce(stop::text, '') from agent.runs
      union all select coalesce(outcomes::text, '') from agent.automation_runs) x;`);
  check("⚠ NO CREDENTIAL IS ANYWHERE IN THE JOURNAL, THE RECORDS OR THE RUNS",
    !everything.includes(SECRET) && !everything.includes("fake-refresh-0011"),
    `${everything.length} characters read`);
  check("...with the observer alive: those rows really do exist", everything.length > 2000,
    `${everything.length} characters`);
  check("⚠ AND NOT ONE MODEL CALL WAS MADE FOR AN AUTOMATION — they execute, they do not converse",
    q(`select coalesce(string_agg(distinct r.model, ','), '(none)') from agent.runs r
        join agent.automation_runs ar on ar.id = r.id;`) === "none",
    q(`select coalesce(string_agg(distinct r.model, ','), '(none)') from agent.runs r
        join agent.automation_runs ar on ar.id = r.id;`));
  check("⚠ ...and every conversation that DID call a model called the stand-in, labelled",
    q(`select coalesce(string_agg(distinct model, ','), '(none)') from agent.runs
        where id not in (select id from agent.automation_runs);`) === "stand-in");
} finally {
  await stack.tearDown();
}

console.log(failed ? `\n${failed} FAILED\n${fails.map((f) => "  - " + f).join("\n")}` : "\nALL CHECKS PASSED");
process.exit(failed ? 1 : 0);
