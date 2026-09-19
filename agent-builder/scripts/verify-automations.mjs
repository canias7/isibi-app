/**
 * AUTOMATIONS, END TO END, THROUGH THE ACTUAL DISPATCHER.
 *
 * A customer configures an automation; it runs — on their press and on its own schedule
 * — and the history says what each step did. Every piece below is the real one:
 *
 *   * the SITE BUILDER's routes — `handleAgentApi` out of `agent-store.mjs`, with
 *     `makeAgentStore` speaking PostgREST;
 *   * the DATABASE — a throwaway PostgreSQL with this repository's migrations applied,
 *     so the occurrence index, the deferred reference, the snapshot and every
 *     transaction are the genuine article;
 *   * ⚠ the DISPATCHER — `worker.queue` and `worker.scheduled`, the Worker's own
 *     handlers, not a runner built by hand. A doorbell rung by the route reaches the
 *     real consumer, which builds the real runner, claims through `claim_run` and routes
 *     on the claim's own `executor`. The cron handler ticks the schedule, rings what it
 *     filed, and sweeps — all three, in one call, as it does in production.
 *
 * **WHAT IS SIMULATED, IN ONE PLACE: the HTTP translation and the queue's TRANSPORT.**
 * PostgREST is `scripts/local-rest.mjs`, because writing to the hosted project needs a
 * service credential; and Cloudflare Queues is not reachable from a laptop, so the
 * binding hands a run id straight to `worker.queue`. **Durability is unchanged, because
 * the work is a ROW** — every claim, lease, fence and sweep is the database's.
 *
 * **WHAT IS NOT SIMULATED: no model, and nothing pretending to be one.** An automation
 * calls no model at all, which is this milestone's point — `runWorkflow` is the whole
 * executor and there is no provider anywhere in it.
 *
 * ⚠ NOT A STATEMENT ABOUT THE DEPLOYMENT. Nothing here has touched the hosted project.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

import { handleAgentApi, makeAgentStore } from "../../agent-store.mjs";
import worker, { AUTOMATION_CATCHUP_S } from "../src/worker.mjs";
import { localDate, weekdayOf, WEEKDAYS } from "../src/automations.mjs";
import { haveCluster, standUp, dispatcher } from "./lib/local-stack.mjs";

void path; void fileURLToPath;

const DB = `agent_auto_${process.pid}`;
const A = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa";   // one account
const B = "bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb";   // the account next door

let failed = 0;
const fails = [];
const check = (what, cond, detail = "") => {
  if (!cond) { failed++; fails.push(what + (detail ? ` — ${detail}` : "")); }
  console.log(`  ${cond ? "ok  " : "FAIL"}  ${what}${detail ? ` — ${detail}` : ""}`);
};

if (!haveCluster()) {
  // A MISSING CLUSTER IS SAID AND EXITS 0. "No database here" is not a failing product.
  console.log("No local PostgreSQL that `su postgres` can reach — nothing to verify against.");
  console.log("  start one with:  pg_ctlcluster 16 main start");
  process.exit(0);
}

const stack = await standUp({ db: DB });
const { q, rest } = stack;

try {
  // ── the site builder's routes ────────────────────────────────────────────
  const appStore = () => makeAgentStore({ fetch: (u, o) => fetch(u, o), url: rest.url, key: "local-service-role" });
  let minted = 0;
  const api = (p, { tenant = A, body = {}, query = null, ring } = {}) => handleAgentApi({
    path: p, method: query ? "GET" : "POST",
    tenant, body, query: new URLSearchParams(query || {}), store: appStore(), ring,
    newId: () => `00000000-0000-4000-8000-${String(++minted).padStart(12, "0")}`,
    log: (...a) => console.log("      [log]", ...a),
  });

  // ── ⚠ THE DISPATCHER: the Worker's own handlers ──────────────────────────
  //
  // `scripts/lib/local-stack.mjs` owns it, so the two verifications in this directory
  // cannot stand up two different stacks and both report green about different things.
  const { env, ctx, rung, delivered, deliver, drain, ring } = dispatcher({ worker, rest });
  void delivered; void deliver;

  // Today, where these automations live, and a weekday list that does and does not match.
  const ZONE = "UTC";
  const TODAY = localDate(Date.now(), ZONE);
  const DOW = weekdayOf(TODAY);
  const OTHER = WEEKDAYS.filter((d) => d !== DOW);
  const NOTE = "Unlock the back door and check the till float.";

  // ── fixtures ────────────────────────────────────────────────────────────
  q(`insert into agent.agents (id, tenant_id, name, instructions) values
       ('11111111-1111-4111-8111-111111111111','${A}','Shop','Answer about the shop.'),
       ('22222222-2222-4222-8222-222222222222','${A}','Resting','Rest.'),
       ('33333333-3333-4333-8333-333333333333','${B}','Next door','Theirs.');`);
  const AG = "11111111-1111-4111-8111-111111111111";
  const REST_AG = "22222222-2222-4222-8222-222222222222";
  const THEIR_AG = "33333333-3333-4333-8333-333333333333";

  const make = async (name, over = {}) => {
    const r = await api("/api/agent/automation-create", {
      body: {
        agent: AG, name, enabled: true, schedule: "manual", zone: ZONE,
        steps: [{ type: "weekday", days: [DOW] }, { type: "note", text: NOTE }],
        ...over,
      },
    });
    if (r.status !== 200) throw new Error(`create ${name}: ${JSON.stringify(r.body)}`);
    return r.body.id;
  };

  // ═════════════════════════════════════════════════════════════════════════
  console.log("\n1. A MANUAL RUN, THROUGH THE ACTUAL DISPATCHER");
  // ═════════════════════════════════════════════════════════════════════════
  const manual = await make("Opening check");
  check("the automation is stored with its steps", q(`select jsonb_array_length(steps) from agent.automations where id='${manual}';`) === "2");
  check("a manual automation has no next run", q(`select coalesce(next_run_at::text,'-') from agent.automations where id='${manual}';`) === "-");

  const press = await api("/api/agent/automation-run", { body: { id: manual }, ring });
  check("Run now is accepted", press.status === 200, JSON.stringify(press.body));
  check("the doorbell rang with the run the transaction answered", rung.length === 1 && rung[0] === press.body.runId);
  check("and the route says it rang", press.body.notified === true);
  // EVERYTHING IS COMMITTED BEFORE THE RESPONSE — checked by reading the database at
  // this instant, before anything has been delivered.
  const runId = press.body.runId;
  check("the execution row is committed before anything runs", q(`select count(*) from agent.automation_runs where id='${runId}';`) === "1");
  check("its work row is queued for the AUTOMATION executor",
    q(`select executor || '|' || kind || '|' || coalesce(claimed_by,'-') from agent.run_work where run_id='${runId}';`) === "automation|start|-");
  check("its steps are a SNAPSHOT, not a pointer", q(`select jsonb_array_length(steps) from agent.automation_runs where id='${runId}';`) === "2");
  check("nothing has run yet", q(`select coalesce(finished_at::text,'-') from agent.automation_runs where id='${runId}';`) === "-");

  const acked = await drain();
  check("the dispatcher delivered it", acked.length === 1 && acked[0] === runId);
  const done = q(`select run_status || '|' || (run_stop->>'reason') || '|' || (run_stop->>'result') || '|' || jsonb_array_length(outcomes)
                  from agent.automation_history where id='${runId}';`);
  check("it ran, and the note is the result", done === `stopped|done|${NOTE}|2`, done);
  check("the work row is finished and its token cleared",
    q(`select (done_at is not null)::text || '|' || coalesce(claim_token::text,'-') from agent.run_work where run_id='${runId}';`) === "true|-");
  // ⚠ RE-ANCHORED, NOT APPEASED. This asserted `started,stopped` — true while the whole
  // execution was ONE transaction, and false by design now that every completed step is
  // checkpointed through the fence before the next one starts. The PROPERTY is the one that
  // matters either way: the log opens once, closes once, and everything between it is a
  // step whose position never goes backwards.
  const kinds = q(`select string_agg(body->>'kind', ',' order by seq) from agent.run_entries where run_id='${runId}';`).split(",");
  check("the journal opens once and closes once", kinds[0] === "started" && kinds.at(-1) === "stopped" &&
    kinds.filter((k) => k === "started").length === 1 && kinds.filter((k) => k === "stopped").length === 1, kinds.join(","));
  check("and everything between them is a workflow step",
    kinds.slice(1, -1).every((k) => k === "step") && kinds.length === 4, kinds.join(","));
  // PROGRESS ONLY EVER MOVED FORWARD, read off the entries rather than off the row: the row
  // holds one number and the log holds every number it passed through.
  const marks = q(`select string_agg((body->>'step') || ':' || (body->>'mark'), ',' order by seq)
                   from agent.run_entries where run_id='${runId}' and body->>'kind'='step';`);
  check("each step's own progress is recorded, in order", marks === "1:progress,2:progress", marks);
  // NO MODEL WAS CALLED, and the log is where that is visible: an automation run has no
  // `model` entry at all, and its own run records the model as `none`.
  check("⚠ no model was called — no model entry, and the run says so",
    q(`select count(*) from agent.run_entries where run_id='${runId}' and body->>'kind'='model';`) === "0" &&
    q(`select model from agent.runs where id='${runId}';`) === "none");

  const hist = await api("/api/agent/automation-history", { query: { id: manual } });
  check("the customer's own read shows it as Done with both steps ran",
    hist.status === 200 && hist.body.executions.length === 1 &&
    hist.body.executions[0].state === "done" &&
    hist.body.executions[0].outcomes.every((o) => o.outcome === "ran"),
    JSON.stringify(hist.body.executions[0] ?? null));

  // ═════════════════════════════════════════════════════════════════════════
  console.log("\n2. A SCHEDULED RUN, THROUGH THE ACTUAL CRON HANDLER");
  // ═════════════════════════════════════════════════════════════════════════
  const daily = await make("Daily opening note", { schedule: "daily", at: "09:00" });
  const first = q(`select next_run_at::text from agent.automations where id='${daily}';`);
  check("a daily automation is given its next instant", first !== "" && Date.parse(first) > Date.now(), first);

  // DUE, THE WAY A DUE ONE REALLY LOOKS: its next instant is a minute ago.
  q(`update agent.automations set next_run_at = now() - interval '1 minute' where id='${daily}';`);
  await worker.scheduled({}, env, ctx);
  check("the cron filed it and rang the doorbell", rung.length === 1, JSON.stringify(rung));
  const schedRun = rung[0];
  const filedAs = q(`select trigger || '|' || occurrence::text from agent.automation_runs where id='${schedRun}';`);
  check("it is filed as a scheduled occurrence, keyed on the local date", filedAs === `schedule|${TODAY}`, filedAs);
  check("and its schedule has moved into the future",
    Date.parse(q(`select next_run_at::text from agent.automations where id='${daily}';`)) > Date.now());
  await drain();
  const schedDone = q(`select run_status || '|' || (run_stop->>'reason') || '|' || (run_stop->>'weekday')
                       from agent.automation_history where id='${schedRun}';`);
  check("the same workflow ran, on the same queue", schedDone === `stopped|done|${DOW}`, schedDone);
  check("⚠ a manual run and a scheduled one are the same execution shape",
    q(`select count(distinct executor) from agent.run_work where run_id in ('${runId}','${schedRun}');`) === "1");

  // ═════════════════════════════════════════════════════════════════════════
  console.log("\n3. DUPLICATE DELIVERY — at the scheduler, and at the queue");
  // ═════════════════════════════════════════════════════════════════════════
  // (a) THE SCHEDULER: the same occurrence offered twice.
  q(`update agent.automations set next_run_at = now() - interval '1 minute' where id='${daily}';`);
  await worker.scheduled({}, env, ctx);
  check("a second tick for the same occurrence files NOTHING new", rung.length === 0, JSON.stringify(rung));
  check("and there is still exactly one execution for that day",
    q(`select count(*) from agent.automation_runs where automation_id='${daily}' and occurrence='${TODAY}';`) === "1");
  check("the unique index is what refused it, so no second run exists either",
    q(`select count(*) from agent.runs r join agent.automation_runs a on a.id=r.id where a.automation_id='${daily}';`) === "1");
  rung.splice(0);

  // (b) THE QUEUE: the same run delivered again.
  const before = q(`select count(*) from agent.run_entries where run_id='${schedRun}';`);
  await deliver(schedRun);
  check("a redelivered run is not executed again",
    q(`select count(*) from agent.run_entries where run_id='${schedRun}';`) === before);
  check("and its one stopped entry is still one",
    q(`select count(*) from agent.run_entries where run_id='${schedRun}' and body->>'kind'='stopped';`) === "1");
  // THE CLAIM IS WHAT REFUSED IT — `done_at` is set, so `claim_run` takes nothing.
  check("the claim refused it rather than the executor",
    q(`select attempts from agent.run_work where run_id='${schedRun}';`) === "1");

  // ═════════════════════════════════════════════════════════════════════════
  console.log("\n4. A CONDITION THAT DOES NOT MATCH — Skipped, not Failed");
  // ═════════════════════════════════════════════════════════════════════════
  const wrongDay = await make("Sunday only", { steps: [{ type: "weekday", days: OTHER.slice(0, 2) }, { type: "note", text: NOTE }] });
  const skipPress = await api("/api/agent/automation-run", { body: { id: wrongDay }, ring });
  await drain();
  const skipped = q(`select (run_stop->>'reason') || '|' || (run_stop->>'at') from agent.automation_history where id='${skipPress.body.runId}';`);
  check("the execution ended SKIPPED, naming the step that decided", skipped === "skipped|s1", skipped);
  const outs = JSON.parse(q(`select outcomes::text from agent.automation_runs where id='${skipPress.body.runId}';`));
  check("both steps have an outcome and neither is a failure",
    outs.length === 2 && outs.every((o) => o.outcome === "skipped"), JSON.stringify(outs));
  check("⚠ and the two skips say DIFFERENT things — one decided, one never got its turn",
    outs[0].why !== outs[1].why && /isn't one of the days/.test(outs[0].why) && /earlier condition/.test(outs[1].why),
    JSON.stringify(outs.map((o) => o.why)));
  const skipRead = await api("/api/agent/automation-history", { query: { id: wrongDay } });
  check("the customer reads Skipped, and nothing anywhere says failed",
    skipRead.body.executions[0].state === "skipped" && !JSON.stringify(skipRead.body.executions[0]).includes("failed"));

  // ═════════════════════════════════════════════════════════════════════════
  console.log("\n5. DISABLING — and pausing the agent it belongs to");
  // ═════════════════════════════════════════════════════════════════════════
  const off = await api("/api/agent/automation-enable", { body: { id: manual, enabled: false } });
  // ⚠ RE-ANCHORED, NOT APPEASED: this read `off.body.automation.enabled`, which was the
  // property "it can be turned off" written as the shape of a row the route used to answer.
  // The toggle goes through `agent.set_automation_enabled` now — the function the agent's own
  // `pause_automation` calls — so the reply is that function's own `{ok, id, enabled,
  // nextRunAt}` and the property is one indirection nearer. `nextRunAt` is asserted PRESENT
  // rather than to a value, because a disable deliberately leaves the schedule where it was.
  check("it can be turned off", off.status === 200 && off.body.enabled === false
    && "nextRunAt" in off.body, JSON.stringify(off.body));
  const runsBefore = q(`select count(*) from agent.automation_runs;`);
  const refused = await api("/api/agent/automation-run", { body: { id: manual }, ring });
  check("Run now is refused with 409 and its own flag", refused.status === 409 && refused.body.disabled === true, JSON.stringify(refused.body));
  check("⚠ and NOTHING was written — no execution, no run, no work row",
    q(`select count(*) from agent.automation_runs;`) === runsBefore && rung.length === 0);
  check("turning it back on lets the same press through",
    (await api("/api/agent/automation-enable", { body: { id: manual, enabled: true } })).status === 200 &&
    (await api("/api/agent/automation-run", { body: { id: manual }, ring })).status === 200);
  await drain();

  // A DISABLED AUTOMATION IS NOT EVEN PICKED UP BY THE SCHEDULER.
  await api("/api/agent/automation-enable", { body: { id: daily, enabled: false } });
  q(`update agent.automations set next_run_at = now() - interval '1 minute' where id='${daily}';`);
  await worker.scheduled({}, env, ctx);
  check("the cron does not pick up a disabled automation at all", rung.length === 0);
  check("and its schedule was left exactly where it was",
    Date.parse(q(`select next_run_at::text from agent.automations where id='${daily}';`)) < Date.now());

  // PAUSING THE AGENT STOPS ITS AUTOMATIONS TOO.
  const onPaused = await api("/api/agent/automation-create", {
    body: { agent: REST_AG, name: "On a rest", enabled: true, schedule: "manual", zone: ZONE, steps: [{ type: "note", text: "x" }] },
  });
  q(`update agent.agents set status='paused' where id='${REST_AG}';`);
  const pausedRun = await api("/api/agent/automation-run", { body: { id: onPaused.body.id }, ring });
  check("a paused agent refuses its automations with its own flag",
    pausedRun.status === 409 && pausedRun.body.paused === true, JSON.stringify(pausedRun.body));
  check("and that wrote nothing either", rung.length === 0);
  // AND ITS SCHEDULED OCCURRENCE IS RECORDED RATHER THAN GOING SILENT.
  await api("/api/agent/automation-update", {
    body: { id: onPaused.body.id, name: "On a rest", enabled: true, schedule: "daily", at: "09:00", zone: ZONE, steps: [{ type: "note", text: "x" }] },
  });
  q(`update agent.automations set next_run_at = now() - interval '1 minute' where id='${onPaused.body.id}';`);
  await worker.scheduled({}, env, ctx);
  check("a paused agent's due occurrence is RECORDED, not skipped in silence",
    q(`select (run_stop->>'reason') from agent.automation_history where automation_id='${onPaused.body.id}';`) === "paused");
  check("and nothing was queued for it", rung.length === 0);
  check("it has no work row, so nothing will ever deliver it",
    q(`select count(*) from agent.run_work w join agent.automation_runs a on a.id=w.run_id where a.automation_id='${onPaused.body.id}';`) === "0");

  // ═════════════════════════════════════════════════════════════════════════
  console.log("\n6. ACCOUNT ISOLATION");
  // ═════════════════════════════════════════════════════════════════════════
  const theirs = q(`select count(*) from agent.automations where tenant_id='${B}';`);
  for (const [what, p, opts] of [
    ["list them", "/api/agent/automations", { query: { agent: AG } }],
    ["read the history", "/api/agent/automation-history", { query: { id: manual } }],
    ["edit it", "/api/agent/automation-update", { body: { id: manual, name: "Mine now", steps: [] } }],
    ["turn it off", "/api/agent/automation-enable", { body: { id: manual, enabled: false } }],
    ["delete it", "/api/agent/automation-delete", { body: { id: manual } }],
    ["run it", "/api/agent/automation-run", { body: { id: manual }, ring } ],
  ]) {
    const r = await api(p, { tenant: B, ...opts });
    check(`the account next door cannot ${what}`, r.status === 404, `${r.status} ${JSON.stringify(r.body)}`);
  }
  check("⚠ and nothing of A's moved", q(`select name || '|' || enabled::text from agent.automations where id='${manual}';`) === "Opening check|true");
  check("nor did B gain anything", q(`select count(*) from agent.automations where tenant_id='${B}';`) === theirs);
  check("nothing was queued on their behalf", rung.length === 0);
  // AND B'S OWN AUTOMATION IS INVISIBLE TO A, which is the other direction.
  const mine = await api("/api/agent/automation-create", {
    tenant: B, body: { agent: THEIR_AG, name: "Theirs", enabled: true, schedule: "manual", steps: [] },
  });
  check("B can make their own", mine.status === 200);
  const aList = await api("/api/agent/automations", { query: { agent: AG } });
  check("A's list holds none of B's", !aList.body.automations.some((x) => x.name === "Theirs"));

  // ═════════════════════════════════════════════════════════════════════════
  console.log("\n7. EDITING A WORKFLOW AFTER A RUN HAS BEEN ACCEPTED");
  // ═════════════════════════════════════════════════════════════════════════
  const edited = await make("Edited after acceptance", { steps: [{ type: "note", text: "the ORIGINAL note" }] });
  const inFlight = await api("/api/agent/automation-run", { body: { id: edited }, ring });
  check("a run is accepted and not yet delivered", inFlight.status === 200 && rung.length === 1);
  // THE EDIT LANDS WHILE THE WORK IS SITTING IN THE QUEUE.
  const change = await api("/api/agent/automation-update", {
    body: { id: edited, name: "Edited after acceptance", enabled: true, schedule: "manual", zone: ZONE,
            steps: [{ type: "note", text: "the REPLACEMENT note" }] },
  });
  check("the edit is accepted", change.status === 200);
  check("the definition really changed",
    q(`select steps->0->>'text' from agent.automations where id='${edited}';`) === "the REPLACEMENT note");
  check("⚠ and the accepted execution still holds the ORIGINAL",
    q(`select steps->0->>'text' from agent.automation_runs where id='${inFlight.body.runId}';`) === "the ORIGINAL note");
  await drain();
  check("⚠ SO THE RUN PRODUCED THE ORIGINAL — an edit reaches the NEXT execution, never this one",
    q(`select run_stop->>'result' from agent.automation_history where id='${inFlight.body.runId}';`) === "the ORIGINAL note");
  // AND THE NEXT ONE GETS THE EDIT, which is the other half of the same claim.
  const after = await api("/api/agent/automation-run", { body: { id: edited }, ring });
  await drain();
  check("the next execution gets the edit",
    q(`select run_stop->>'result' from agent.automation_history where id='${after.body.runId}';`) === "the REPLACEMENT note");

  // ═════════════════════════════════════════════════════════════════════════
  console.log("\n8. MISSED OCCURRENCES AFTER DOWNTIME — recorded, counted, no burst");
  // ═════════════════════════════════════════════════════════════════════════
  const stale = await make("Left alone for a week", { schedule: "daily", at: "09:00", steps: [{ type: "note", text: "x" }] });
  q(`update agent.automations set next_run_at = now() - interval '6 days' where id='${stale}';`);
  const runsWas = Number(q(`select count(*) from agent.automation_runs;`));
  await worker.scheduled({}, env, ctx);
  check("a stale occurrence is not RUN", rung.length === 0, JSON.stringify(rung));
  const missed = q(`select (run_stop->>'reason') || '|' || missed::text from agent.automation_history where automation_id='${stale}';`);
  check("it is recorded as missed, with how many went by", /^missed\|[0-9]+$/.test(missed), missed);
  check("⚠ ONE ROW, NOT ONE PER DAY — a week of downtime is not a week of rows",
    Number(q(`select count(*) from agent.automation_runs;`)) === runsWas + 1);
  check("and the schedule jumped straight to its next future occurrence",
    Date.parse(q(`select next_run_at::text from agent.automations where id='${stale}';`)) > Date.now());
  check("the catch-up window is the Worker's own constant", AUTOMATION_CATCHUP_S === 3600);

  // ═════════════════════════════════════════════════════════════════════════
  console.log("\n9. WHAT THE WHOLE RUN LEFT BEHIND");
  // ═════════════════════════════════════════════════════════════════════════
  // ⚠ COMPOSED IN JAVASCRIPT, NOT IN SQL. A `string_agg(x, ' ')` here carries a quoted
  // space through `su postgres -c psql -c '…'` — three levels of quoting — and the shell
  // ate it, which read as a broken database at the end of 64 passing checks. The query
  // answers rows; the sentence is ours.
  const tally = q(`select reason || '=' || n::text from (
      select run_stop->>'reason' as reason, count(*) as n
        from agent.automation_history group by 1) t order by 1;`)
    .split("\n").filter(Boolean).join("  ");
  console.log(`  executions by outcome: ${tally || "-"}`);
  check("every execution that was delivered is finished",
    q(`select count(*) from agent.automation_runs a join agent.run_work w on w.run_id=a.id
        where w.done_at is not null and a.finished_at is null;`) === "0");
  check("⚠ no automation run has more than one stopped entry",
    q(`select count(*) from (select run_id from agent.run_entries e join agent.automation_runs a on a.id=e.run_id
        where e.body->>'kind'='stopped' group by run_id having count(*) > 1) t;`) === "0");
  check("no execution's outcomes are longer than its own steps",
    q(`select count(*) from agent.automation_runs
        where jsonb_array_length(outcomes) > jsonb_array_length(steps);`) === "0");
  check("and attempts never went above 1 anywhere",
    q(`select coalesce(max(attempts)::text,'0') from agent.run_work w join agent.automation_runs a on a.id=w.run_id;`) === "1");
} finally {
  await stack.tearDown();
}

console.log(`\n${failed ? `${failed} FAILED` : "all checks passed"}`);
for (const f of fails) console.log(`  - ${f}`);
process.exit(failed ? 1 : 0);
