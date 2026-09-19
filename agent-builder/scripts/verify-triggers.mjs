/**
 * TRIGGERS — one-off and weekly schedules, authenticated webhooks, and internal events.
 *
 * **THE DEMONSTRATION THE MILESTONE ASKED FOR, in its own words:** one-time and weekly
 * schedules, authenticated webhook endpoints, and internal events delivered through the
 * existing durable dispatcher — with event deduplication, time zones and daylight saving,
 * missed occurrences, disabled automations, paused agents and cancellation all verified, a
 * bound on recursive event chains, and an event arriving around the moment a workflow
 * starts waiting neither lost nor applied twice.
 *
 * Every piece below is the real one, and `scripts/lib/local-stack.mjs` is the only fixture:
 *
 *   * the SITE BUILDER's routes — `handleAgentApi` out of `agent-store.mjs`. A customer's
 *     own door, not a helper.
 *   * the DATABASE — a throwaway PostgreSQL with this repository's migrations applied, so
 *     the once-per-event index, the day arithmetic, the depth bound and the endpoint's own
 *     secret column are the genuine article.
 *   * the DISPATCHER — `worker.queue` and `worker.scheduled`, the Worker's own handlers,
 *     with all five cron jobs running in one call as they do in production.
 *   * the DELIVERY SURFACE — `worker.fetch` itself, so a delivery is verified by the same
 *     code an anonymous POST from a provider would meet.
 *
 * ── ⚠ DETERMINISTIC VERSUS SIMULATED, SAID PLAINLY AND IN ONE PLACE ───────────
 *
 * **NOTHING HERE IS SIMULATED AI and there is no model call anywhere in it** — an
 * automation execution has no provider, no tools and no model, and this file asserts that
 * outright. What IS simulated is the transport: PostgREST is a local shim and the queue is
 * an in-process doorbell, because neither is reachable from a laptop. Durability is
 * unchanged, because the work is a ROW.
 *
 * **AND TWO CLOCKS ARE PUSHED RATHER THAN WAITED OUT, declared rather than hidden.** A
 * schedule's `next_run_at` is moved into the past with one UPDATE, and an event's `at` is
 * set relative to a pause. What that does NOT simulate is any DECISION: `tick_automations`
 * still selects on `next_run_at <= now()`, `automation_next_run` still does its own zone
 * arithmetic, and `hear_pending_event` still compares against the pause's own `since`.
 *
 * ⚠ NOT A STATEMENT ABOUT THE DEPLOYMENT. Nothing here touches the hosted project.
 */

import { handleAgentApi, makeAgentStore } from "../../agent-store.mjs";
import worker from "../src/worker.mjs";
import { haveCluster, standUp, dispatcher } from "./lib/local-stack.mjs";
import { signDelivery, SIG_HEADER, TS_HEADER, ID_HEADER } from "../src/webhooks.mjs";

const DB = `agent_tg_${process.pid}`;
const A = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa";   // one account
const B = "bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb";   // the account next door
const AG = "11111111-1111-4111-8111-111111111111";
const THEIR_AG = "33333333-3333-4333-8333-333333333333";
const SECRET = "a-signing-secret-long-enough-for-the-column";

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

const stack = await standUp({ db: DB });
const { q, rest } = stack;

try {
  const appStore = () => makeAgentStore({ fetch: (u, o) => fetch(u, o), url: rest.url, key: "local-service-role" });
  let minted = 0;
  /**
   * ⚠ **THE DOORBELL IS WIRED BY DEFAULT, because a deployed Worker always holds the
   * binding — and the first draft of this file left it out.** Every press then answered
   * `notified: false`, nothing reached the in-process queue, and each execution waited for
   * the cron's sweeper instead: the checks READ A ROW THAT HAD NOT RUN YET and reported
   * four correct behaviours as broken. *A harness less capable than the deployment hides a
   * defect exactly as well as one that is more* — here it manufactured one.
   */
  const api = (p, { tenant = A, body = {}, query = null, ring: bell = ring } = {}) => handleAgentApi({
    path: p, method: query ? "GET" : "POST",
    tenant, body, query: new URLSearchParams(query || {}), store: appStore(), ring: bell,
    newId: () => `00000000-0000-4000-8000-${String(++minted).padStart(12, "0")}`,
    log: () => {},
  });
  const { rung, drain, tick, ring } = dispatcher({ worker, rest });

  const outcomes = (runId) => JSON.parse(q(`select coalesce(outcomes::text,'[]') from agent.automation_runs where id='${runId}';`));
  const execsOf = (autoId) => JSON.parse(q(
    `select coalesce(json_agg(json_build_object('id',id,'trigger',trigger,'occurrence',occurrence,
       'event_id',event_id,'finished',finished_at is not null) order by created_at)::text,'[]')
       from agent.automation_runs where automation_id='${autoId}';`));
  const due = (autoId) => q(`update agent.automations set next_run_at = now() - interval '1 minute' where id='${autoId}';`);

  q(`insert into agent.agents (id, tenant_id, name, instructions) values
       ('${AG}','${A}','Shop','Answer about the shop.'),
       ('${THEIR_AG}','${B}','Next door','Theirs.');`);

  // ═════════════════════════════════════════════════════════════════════════
  console.log("\n1. A WEEKLY SCHEDULE, SAVED THROUGH THE CUSTOMER'S OWN ROUTE");
  // ═════════════════════════════════════════════════════════════════════════
  const wk = await api("/api/agent/automation-create", {
    body: {
      agent: AG, name: "Mondays and Fridays", enabled: true,
      schedule: "weekly", at: "09:00", zone: "Europe/London", days: ["fri", "mon"],
      steps: [{ type: "note", text: "the weekly round" }],
    },
  });
  check("a weekly automation is saved", wk.status === 200 && typeof wk.body.id === "string", JSON.stringify(wk.body));
  const wkId = wk.body.id;
  const stored = JSON.parse(q(`select json_build_object('schedule',schedule,'days',days,'at',at_local::text,'zone',zone,
    'next', to_char(next_run_at at time zone 'Europe/London','Dy HH24:MI'))::text
    from agent.automations where id='${wkId}';`));
  check("...with its days in the week's own order, not the order they were ticked",
    JSON.stringify(stored.days) === '["mon","fri"]', JSON.stringify(stored.days));
  // ⚠ THE NEXT INSTANT IS `automation_next_run`'S AND NOT `automation_next_at`'S. The old one
  // answers the next occurrence of a DAILY time, so a weekly schedule would be filed every
  // single day — which is what the new function exists to stop. What proves it is that the
  // instant really lands on a chosen day, in the automation's own zone and at its own time.
  check("⚠ ...and its next instant is on one of the days it names, at the time it names",
    /^(Mon|Fri) 09:00$/.test(stored.next), stored.next);

  const bad = await api("/api/agent/automation-create", {
    body: { agent: AG, name: "No days", schedule: "weekly", at: "09:00", zone: "UTC", days: [], steps: [{ type: "note", text: "x" }] },
  });
  check("a weekly schedule with no days is refused, because it would never come due",
    bad.status === 400 && /at least one day/.test(bad.body.error ?? ""), JSON.stringify(bad.body));
  const junkDay = await api("/api/agent/automation-create", {
    body: { agent: AG, name: "Funday", schedule: "weekly", at: "09:00", zone: "UTC", days: ["mon", "funday"], steps: [{ type: "note", text: "x" }] },
  });
  check("...and a day nothing recognises is refused BY NAME rather than dropped",
    junkDay.status === 400 && /funday/.test(junkDay.body.error ?? ""), JSON.stringify(junkDay.body));

  // ⚠ DAYLIGHT SAVING, IN THE DATABASE'S OWN ARITHMETIC. The same local time is a different
  // instant in summer and in winter, with the row unchanged — which is the whole reason the
  // zone is stored rather than an offset.
  const summer = q(`select to_char(agent.automation_next_run('weekly','09:00'::time,'Europe/London',
    array['mon']::text[], null, '2026-07-01 00:00:00+00'::timestamptz) at time zone 'UTC','HH24:MI');`);
  const winter = q(`select to_char(agent.automation_next_run('weekly','09:00'::time,'Europe/London',
    array['mon']::text[], null, '2026-12-01 00:00:00+00'::timestamptz) at time zone 'UTC','HH24:MI');`);
  check("⚠ nine o'clock London is 08:00Z in summer and 09:00Z in winter, from one stored row",
    summer === "08:00" && winter === "09:00", `${summer} / ${winter}`);

  // ═════════════════════════════════════════════════════════════════════════
  console.log("\n2. A ONE-OFF SCHEDULE, AND WHAT MAKES IT ONE-OFF");
  // ═════════════════════════════════════════════════════════════════════════
  const once = await api("/api/agent/automation-create", {
    body: {
      agent: AG, name: "One report", enabled: true,
      schedule: "once", at: "09:00", zone: "UTC", on_date: "2099-12-25",
      steps: [{ type: "note", text: "the one report" }],
    },
  });
  check("a one-off automation is saved", once.status === 200, JSON.stringify(once.body));
  const onceId = once.body.id;
  check("...and its instant is that day in its own zone",
    q(`select to_char(next_run_at at time zone 'UTC','YYYY-MM-DD HH24:MI') from agent.automations where id='${onceId}';`)
      === "2099-12-25 09:00");
  const feb30 = await api("/api/agent/automation-create", {
    body: { agent: AG, name: "Never", schedule: "once", at: "09:00", zone: "UTC", on_date: "2026-02-30", steps: [{ type: "note", text: "x" }] },
  });
  // ⚠ A REAL CALENDAR DAY AND NOT JUST A SHAPE: `2026-02-30` matches `YYYY-MM-DD` and is not
  // a day, and `new Date("2026-02-30")` rolls forward to March — which would store a day
  // nobody chose.
  check("⚠ a date that is not a day in the calendar is refused rather than rolled forward",
    feb30.status === 400 && /isn't a day in the calendar/.test(feb30.body.error ?? ""), JSON.stringify(feb30.body));

  // IT FIRES ONCE AND HAS NO NEXT INSTANT AFTERWARDS, which is the whole of what `once` means.
  q(`update agent.automations set on_date = current_date, at_local = '00:01'::time,
       next_run_at = now() - interval '1 minute' where id='${onceId}';`);
  await tick();
  await drain();
  const ranOnce = execsOf(onceId);
  check("a one-off fires", ranOnce.length === 1 && ranOnce[0].finished, JSON.stringify(ranOnce));
  check("⚠ ...and has no next instant afterwards, so it is never due again",
    q(`select next_run_at is null from agent.automations where id='${onceId}';`) === "t");
  await tick();
  await drain();
  check("...proved by a second tick filing nothing for it", execsOf(onceId).length === 1);

  // ═════════════════════════════════════════════════════════════════════════
  console.log("\n3. AN AUTHENTICATED WEBHOOK, THROUGH `worker.fetch` ITSELF");
  // ═════════════════════════════════════════════════════════════════════════
  const listens = await api("/api/agent/automation-create", {
    body: {
      agent: AG, name: "On a payment", enabled: true, schedule: "manual", zone: "UTC",
      on_event: "order.paid",
      steps: [{ type: "note", text: "a payment landed" }],
    },
  });
  check("an automation may listen for an event while still being run by hand", listens.status === 200, JSON.stringify(listens.body));
  const evAuto = listens.body.id;

  const WH = "44444444-4444-4444-8444-444444444444";
  const made = JSON.parse(q(`select agent.create_webhook('${A}','${AG}','${WH}','Payments','order.paid','${SECRET}')::text;`));
  check("an endpoint is created", made.ok === true, JSON.stringify(made));
  // ⚠ THE SECRET HAS EXACTLY ONE READER, and the list is not it — so it is not a redaction
  // somebody has to remember: the column is simply not in that projection.
  check("⚠ the list of endpoints never carries the secret",
    !q(`select agent.list_webhooks('${A}','${AG}')::text;`).includes(SECRET));

  const env = {
    SUPABASE_URL: rest.url, SUPABASE_SERVICE_KEY: "local-service-role",
    SUPABASE_PUBLISHABLE_KEY: "local-anon", MODEL: "stand-in", AGENT_SCHEMA: "agent",
    RUN_QUEUE: { send: async (m) => { rung.push(m); } },
  };
  const deliver = async (payload, { secret = SECRET, at = Date.now(), id = WH, delivery = null } = {}) => {
    const raw = JSON.stringify(payload);
    const ts = String(at);
    const headers = { [SIG_HEADER]: await signDelivery(secret, ts, raw), [TS_HEADER]: ts };
    if (delivery) headers[ID_HEADER] = delivery;
    const res = await worker.fetch(new Request(`https://x/deliver/${id}`, { method: "POST", body: raw, headers }), env, { waitUntil() {} });
    return { status: res.status, body: await res.json().catch(() => null) };
  };

  /**
   * ⚠ **THE ACCOUNT COMES FROM THE VERIFIED ENDPOINT, NEVER FROM THE PAYLOAD — and the body
   * below says otherwise in three different ways.** A delivery is anonymous text from
   * outside, so a `tenant` in it is a claim and not an identity; the endpoint's own row
   * carries the account, and the signature is what proves the row applies.
   */
  const forged = await deliver({ amount: 42, tenant: B, tenant_id: B, name: "evil.event" }, { delivery: "dlv-1" });
  check("a signed delivery is accepted, 202", forged.status === 202, JSON.stringify(forged.body));
  const ev = JSON.parse(q(`select coalesce(json_agg(json_build_object('id',id,'tenant',tenant_id,'name',name,
    'source',source,'key',event_key,'payload',payload)::json)::text,'[]') from agent.events;`));
  check("⚠ ...and the event belongs to the ENDPOINT's account, not the one the body claimed",
    ev.length === 1 && ev[0].tenant === A, JSON.stringify(ev));
  check("⚠ ...and its NAME is the endpoint's too, not the one the body claimed",
    ev[0].name === "order.paid", JSON.stringify(ev[0].name));
  check("...and the body reached the payload and nowhere else",
    ev[0].payload.amount === 42 && ev[0].payload.tenant === B, JSON.stringify(ev[0].payload));
  check("...and it is recorded as having come from a webhook", ev[0].source === "webhook");

  // EVERY REFUSAL, AND THEY ALL SAY THE SAME THING ON THE WIRE — naming the cause would turn
  // this into an oracle for probing endpoint ids and secrets.
  const sentences = new Set();
  for (const [what, promise] of [
    ["a wrong secret", deliver({ a: 1 }, { secret: "the-wrong-secret-of-the-right-length-x" })],
    ["a stale timestamp", deliver({ a: 1 }, { at: Date.now() - 20 * 60 * 1000 })],
    ["a timestamp far in the future", deliver({ a: 1 }, { at: Date.now() + 20 * 60 * 1000 })],
    ["an endpoint that does not exist", deliver({ a: 1 }, { id: "55555555-5555-4555-8555-555555555555" })],
  ]) {
    const r = await promise;
    check(`${what} is refused 401`, r.status === 401, JSON.stringify(r));
    sentences.add(JSON.stringify(r.body));
  }
  check("⚠ ...and all four say the SAME thing, so the route is not an oracle", sentences.size === 1,
    JSON.stringify([...sentences]));
  // AND AN UNSIGNED DELIVERY IS REFUSED WITHOUT THE DATABASE BEING ASKED ANYTHING AT ALL.
  const unsigned = await worker.fetch(new Request(`https://x/deliver/${WH}`, { method: "POST", body: "{}" }), env, { waitUntil() {} });
  check("an unsigned delivery is refused", unsigned.status === 401);

  // A RETRY IS ONE EVENT, which is what the delivery key is for.
  const again = await deliver({ amount: 42, tenant: B, tenant_id: B, name: "evil.event" }, { delivery: "dlv-1" });
  check("⚠ the same delivery sent twice is ONE event, and the second says so",
    again.status === 202 && again.body.repeat === true, JSON.stringify(again.body));
  check("...and there is still exactly one event", q(`select count(*) from agent.events;`) === "1");

  // ═════════════════════════════════════════════════════════════════════════
  console.log("\n4. THE EVENT REACHES THE AUTOMATION, THROUGH THE EXISTING DISPATCHER");
  // ═════════════════════════════════════════════════════════════════════════
  await tick();
  const filed = execsOf(evAuto);
  check("the cron's event job files an execution for the automation that listens",
    filed.length === 1 && filed[0].trigger === "event", JSON.stringify(filed));
  check("...and it carries the event it came from", filed[0].event_id === ev[0].id);
  check("...and the event is stamped handled", q(`select handled_at is not null from agent.events where id='${ev[0].id}';`) === "t");
  await drain();
  check("...and the execution really runs", execsOf(evAuto)[0].finished === true, JSON.stringify(outcomes(filed[0].id)));
  check("⚠ ...with NO MODEL ANYWHERE IN IT",
    q(`select coalesce(model,'none') from agent.runs where id='${filed[0].id}';`) === "none");

  await tick();
  await drain();
  check("⚠ a second tick files nothing, because the stamp is the gate", execsOf(evAuto).length === 1);

  // ── 4b. AN UNRELATED EDIT DOES NOT STOP IT LISTENING ───────────────────────
  /**
   * ⚠ **THE BROWSER'S SAVE IS A FULL REPLACE, AND IT CARRIED NO EVENT.** The form has no
   * control for one, so its body was `name · enabled · schedule · at · zone · steps · inputs`
   * and `update_automation` assigns `on_event = p_on_event` — so **renaming an automation that
   * listens stopped it listening**, with nothing anywhere saying so. The browser now carries the
   * stored binding forward (`AGENT_FORM_KEEPS` in `public/chat.js`); this is the same body
   * arriving at the real route, and then the event really being sent again.
   *
   * THE STORED COLUMN IS NOT THE CLAIM. "It still listens" is a claim about what an event DOES,
   * so the column is read and then an event is delivered and the execution is watched to the end.
   */
  const editBody = {
    id: evAuto, name: "On a payment, renamed", enabled: true,
    schedule: "manual", at: "09:00", zone: "UTC", inputs: [],
    steps: [{ type: "note", text: "a payment landed" }],
  };
  const kept = await api("/api/agent/automation-update", { body: { ...editBody, on_event: "order.paid" } });
  check("an unrelated edit saves", kept.status === 200, JSON.stringify(kept.body));
  check("...the name really changed, so the edit was not a no-op",
    q(`select name from agent.automations where id='${evAuto}';`) === "On a payment, renamed");
  check("⚠ ...and the event binding is still there",
    q(`select coalesce(on_event,'(none)') from agent.automations where id='${evAuto}';`) === "order.paid");

  const after = await deliver({ amount: 43 }, { delivery: "dlv-after-edit" });
  check("a second payment is accepted", after.status === 202, JSON.stringify(after.body));
  await tick();
  await drain();
  const ran = execsOf(evAuto);
  check("⚠ ...AND THE EVENT STILL TRIGGERS THE AUTOMATION after the edit",
    ran.length === 2 && ran[1].trigger === "event" && ran[1].finished === true, JSON.stringify(ran));

  /**
   * ⚠ **THE CONTROL, AND WITHOUT IT THE CHECK ABOVE IS SATISFIED BY AN EVENT THAT WOULD FIRE
   * WHATEVER THE SAVE DID.** This is the PRE-FIX body — byte for byte what the form sent before
   * `AGENT_FORM_KEEPS` existed — so it measures the defect rather than describing it: the
   * binding goes, and the next payment reaches nothing.
   */
  const dropped = await api("/api/agent/automation-update", { body: editBody });
  check("the pre-fix body saves too, which is why this was silent", dropped.status === 200, JSON.stringify(dropped.body));
  check("⚠ ...and it CLEARS the binding — the defect, measured",
    q(`select coalesce(on_event,'(none)') from agent.automations where id='${evAuto}';`) === "(none)");
  const orphan = await deliver({ amount: 44 }, { delivery: "dlv-after-drop" });
  check("a third payment is still accepted by the endpoint", orphan.status === 202, JSON.stringify(orphan.body));
  await tick();
  await drain();
  check("⚠ ...and reaches NOTHING, because the automation stopped listening",
    execsOf(evAuto).length === 2, JSON.stringify(execsOf(evAuto)));

  // PUT IT BACK, so the sections below read the automation this one found rather than the one
  // the control broke.
  await api("/api/agent/automation-update", { body: { ...editBody, on_event: "order.paid" } });
  check("the binding is restored for the sections below",
    q(`select coalesce(on_event,'(none)') from agent.automations where id='${evAuto}';`) === "order.paid");

  // ═════════════════════════════════════════════════════════════════════════
  console.log("\n5. AN EVENT WAIT, AND THE ARRIVAL RACE BOTH WAYS ROUND");
  // ═════════════════════════════════════════════════════════════════════════
  const waits = await api("/api/agent/automation-create", {
    body: {
      agent: AG, name: "Wait for the courier", enabled: true, schedule: "manual", zone: "UTC",
      steps: [
        { type: "event", name: "order.shipped", out: "it" },
        { type: "note", text: "shipped: {{it}}" },
      ],
    },
  });
  check("a workflow that waits for an event is saved", waits.status === 200, JSON.stringify(waits.body));
  const waitAuto = waits.body.id;
  const started = await api("/api/agent/automation-run", { body: { id: waitAuto } });
  check("it is started by hand", started.status === 200, JSON.stringify(started.body));
  await drain();
  const suspended = JSON.parse(q(`select json_build_object('kind',waiting->>'kind','name',waiting->>'name',
    'since', waiting->>'since','done', (select done_at is not null from agent.run_work w where w.run_id = ar.id))::text
    from agent.automation_runs ar where automation_id='${waitAuto}';`));
  check("⚠ it suspends on the event, and its worker is RELEASED", suspended.kind === "event" && suspended.done === true,
    JSON.stringify(suspended));
  check("...and the pause records when it began, which is what bounds the wait",
    typeof suspended.since === "string" && suspended.since !== "", JSON.stringify(suspended.since));

  /**
   * ⚠ **TWO DIFFERENT QUESTIONS, AND THE FIRST DRAFT OF THIS SECTION CONFLATED THEM.**
   *
   * `agent.dispatch_events` delivers every event that has not been dispatched yet to
   * whoever is waiting, and it compares no clocks at all — correctly: an event is NEWS
   * until it is stamped `handled_at`, and that stamp is the once-only gate. An assertion
   * that the dispatcher ignores an OLD undelivered event was simply wrong about the
   * product, and it measured the dispatcher doing its job.
   *
   * `agent.hear_pending_event` is the other half, and it is the one the clock bounds. It
   * looks at events that were ALREADY dispatched while nobody was waiting, and without a
   * bound a pause would consume any event of that name from last week. So the pause's own
   * `since` is what separates the two arms below, and each is the other's control.
   */

  // ── THE BOUND: already dispatched, and BEFORE this pause began ──────────────
  const boundAuto = (await api("/api/agent/automation-create", {
    body: {
      agent: AG, name: "Not this one", enabled: true, schedule: "manual", zone: "UTC",
      steps: [{ type: "event", name: "order.filed" }, { type: "note", text: "filed" }],
    },
  })).body.id;
  q(`select agent.emit_event('${A}','${AG}','66666666-6666-4666-8666-666666666601','order.filed',
       '{"who":"nobody"}'::jsonb,'person');`);
  await tick();                                        // dispatched with nobody waiting
  check("an event with nobody waiting for it is dispatched and reaches nothing",
    q(`select handled_at is not null from agent.events where id='66666666-6666-4666-8666-666666666601';`) === "t");
  const boundRun = (await api("/api/agent/automation-run", { body: { id: boundAuto } })).body.runId;
  await drain();
  check("⚠ ...and a pause that begins AFTERWARDS does not consume it",
    q(`select coalesce(heard::text,'{}') from agent.automation_runs where id='${boundRun}';`) === "{}",
    q(`select coalesce(heard::text,'{}') from agent.automation_runs where id='${boundRun}';`));
  check("...so it is still waiting, which is what a workflow asked to wait should do",
    q(`select waiting->>'kind' from agent.automation_runs where id='${boundRun}';`) === "event");

  // ── AN UNDISPATCHED EVENT REACHES THE PAUSE THROUGH THE DISPATCHER ──────────
  q(`select agent.emit_event('${A}','${AG}','66666666-6666-4666-8666-666666666602','order.shipped',
       '{"who":"dpd"}'::jsonb,'person');`);
  await tick();
  const heard = JSON.parse(q(`select heard::text from agent.automation_runs where automation_id='${waitAuto}';`));
  check("an event after the pause IS heard, under the step that was waiting",
    heard.s1?.name === "order.shipped" && heard.s1?.event_id === "66666666-6666-4666-8666-666666666602",
    JSON.stringify(heard));
  check("⚠ ...and the work row is BACK ON THE QUEUE, or the event reaches nobody",
    q(`select done_at is null from agent.run_work where run_id='${started.body.runId}';`) === "t");
  await drain();
  const finished = outcomes(started.body.runId);
  check("...and the run carries on, with the payload bound to the name it declared",
    finished.length === 2 && finished[1].result === 'shipped: {"who":"dpd"}', JSON.stringify(finished));
  // ⚠ AND NOTHING RAN TWICE, which is the property a `heard` applied twice would break.
  check("⚠ ...and nothing ran twice: one outcome per step", finished.length === 2, JSON.stringify(finished));

  // ── THE RACE: already dispatched, and AFTER this pause began ────────────────
  const raceAuto = (await api("/api/agent/automation-create", {
    body: {
      agent: AG, name: "The race", enabled: true, schedule: "manual", zone: "UTC",
      steps: [{ type: "event", name: "order.refunded" }, { type: "note", text: "refunded" }],
    },
  })).body.id;
  q(`select agent.emit_event('${A}','${AG}','66666666-6666-4666-8666-666666666603','order.refunded','{}'::jsonb,'person');`);
  await tick();                                        // dispatched with nobody waiting
  check("the racing event is dispatched before anything waits for it",
    q(`select handled_at is not null from agent.events where id='66666666-6666-4666-8666-666666666603';`) === "t");
  // ⚠ ITS `at` IS MOVED JUST AHEAD, which is the sub-millisecond window standing in for
  // itself: the race is an event arriving BETWEEN the step being reached and the pause being
  // visible, and no test can interleave those. **The DECISION is not simulated** —
  // `hear_pending_event` still compares the event's own `at` against the pause's `since`,
  // and the arm above is that comparison answering the other way.
  q(`update agent.events set at = now() + interval '2 seconds' where id='66666666-6666-4666-8666-666666666603';`);
  const raceRun = (await api("/api/agent/automation-run", { body: { id: raceAuto } })).body.runId;
  await drain();
  const caught = JSON.parse(q(`select heard::text from agent.automation_runs where id='${raceRun}';`));
  check("⚠ THE RACE: an event that got there first is heard when the pause is recorded",
    caught.s1?.name === "order.refunded", JSON.stringify(caught));
  check("⚠ ...and that hearing put the work back too",
    q(`select done_at is null from agent.run_work where run_id='${raceRun}';`) === "t");
  // ⚠ A TICK, NOT A DRAIN — and that is the production path rather than a convenience.
  // `hear_pending_event` runs inside the pause's OWN transaction and rings nothing (a SQL
  // function cannot reach a queue binding), so what puts the work back in front of a
  // consumer is the sweeper. The cost is one tick, which is what the runner's own note says.
  await tick();
  await drain();
  check("...so the run carries on rather than waiting for an event that already happened",
    q(`select finished_at is not null from agent.automation_runs where id='${raceRun}';`) === "t");

  // ═════════════════════════════════════════════════════════════════════════
  console.log("\n6. A CHAIN OF EVENTS IS BOUNDED");
  // ═════════════════════════════════════════════════════════════════════════
  const deepRun = q(`select id from agent.automation_runs where automation_id='${evAuto}' limit 1;`);
  q(`update agent.automation_runs set event_depth = 4 where id='${deepRun}';`);
  const tooDeep = JSON.parse(q(`select agent.emit_event('${A}','${AG}',gen_random_uuid(),'loop.step',
    '{}'::jsonb,'run',null,'${deepRun}')::text;`));
  check("⚠ an event emitted from a run at the bound is refused BY NAME", tooDeep.error === "too-deep",
    JSON.stringify(tooDeep));
  q(`update agent.automation_runs set event_depth = 1 where id='${deepRun}';`);
  const roomLeft = JSON.parse(q(`select agent.emit_event('${A}','${AG}',gen_random_uuid(),'loop.step',
    '{}'::jsonb,'run',null,'${deepRun}')::text;`));
  check("THE CONTROL: with depth left, the same emit is accepted and says how deep it is",
    roomLeft.ok === true && roomLeft.depth === 2, JSON.stringify(roomLeft));

  // ═════════════════════════════════════════════════════════════════════════
  console.log("\n7. DISABLED, PAUSED, CANCELLED, AND THE ACCOUNT NEXT DOOR");
  // ═════════════════════════════════════════════════════════════════════════
  const offAuto = (await api("/api/agent/automation-create", {
    body: {
      agent: AG, name: "Switched off", enabled: false, schedule: "manual", zone: "UTC",
      on_event: "order.paid", steps: [{ type: "note", text: "never" }],
    },
  })).body.id;
  q(`select agent.emit_event('${A}','${AG}','66666666-6666-4666-8666-666666666604','order.paid','{}'::jsonb,'person');`);
  await tick();
  check("⚠ a DISABLED automation is not filed by an event, and nothing is written for it",
    execsOf(offAuto).length === 0, JSON.stringify(execsOf(offAuto)));

  const before = execsOf(evAuto).length;
  await api("/api/agent/update", { body: { id: AG, name: "Shop", instructions: "Answer about the shop.", status: "paused" } });
  // ⚠ THE PRECONDITION IS ASSERTED, or this check passes for a reason that has nothing to do
  // with the pause: an agent that never paused takes no new work if the event never landed.
  check("the agent really is paused first",
    q(`select status from agent.agents where id='${AG}';`) === "paused");
  q(`select agent.emit_event('${A}','${AG}','66666666-6666-4666-8666-666666666605','order.paid','{}'::jsonb,'person');`);
  await tick();
  const whilePaused = execsOf(evAuto).length;
  check("⚠ a PAUSED agent takes no new work from an event either", whilePaused === before,
    `${whilePaused} executions, ${before} before`);
  await api("/api/agent/update", { body: { id: AG, name: "Shop", instructions: "Answer about the shop.", status: "active" } });

  // A CANCELLED EXECUTION IS NOT WOKEN BY ITS EVENT. Nothing is un-done — what is asserted is
  // that a run somebody stopped stays stopped.
  const cancelAuto = (await api("/api/agent/automation-create", {
    body: {
      agent: AG, name: "Stopped part way", enabled: true, schedule: "manual", zone: "UTC",
      steps: [{ type: "event", name: "order.late" }, { type: "note", text: "late" }],
    },
  })).body.id;
  const cancelRun = (await api("/api/agent/automation-run", { body: { id: cancelAuto } })).body.runId;
  await drain();
  // ⚠ `p_tenant` FIRST, THEN THE RUN — and the answer is ASSERTED rather than fired and
  // forgotten. The first draft had the two the other way round, so the call was refused
  // (a run id is not a tenant) and the two checks under it failed about a cancellation that
  // never happened. *A refused call must be its own failure, not somebody else's.*
  const stopped = JSON.parse(q(`select agent.cancel_run('${A}','${cancelRun}','${A}','changed my mind')::text;`));
  check("the execution really is cancelled first", stopped.ok === true, JSON.stringify(stopped));
  q(`select agent.emit_event('${A}','${AG}','66666666-6666-4666-8666-666666666606','order.late','{}'::jsonb,'person');`);
  await tick();
  check("⚠ a CANCELLED execution is not woken by the event it was waiting for",
    q(`select coalesce(heard::text,'{}') from agent.automation_runs where id='${cancelRun}';`) === "{}");
  check("...and it stays finished", q(`select finished_at is not null from agent.automation_runs where id='${cancelRun}';`) === "t");

  // THE ACCOUNT NEXT DOOR. An event of theirs reaches nothing of ours, and an endpoint of
  // ours is not theirs to delete.
  q(`select agent.emit_event('${B}','${THEIR_AG}','66666666-6666-4666-8666-666666666607','order.paid','{}'::jsonb,'person');`);
  const beforeTheirs = execsOf(evAuto).length;
  await tick();
  check("⚠ another account's event of the same name reaches nothing of ours",
    execsOf(evAuto).length === beforeTheirs, `${execsOf(evAuto).length} vs ${beforeTheirs}`);
  check("...and their account cannot delete our endpoint",
    JSON.parse(q(`select agent.delete_webhook('${B}','${WH}')::text;`)).error === "no-webhook");

  // ═════════════════════════════════════════════════════════════════════════
  console.log("\n8. MISSED OCCURRENCES, AND WHAT THE WEEKLY SCHEDULE DOES AFTER DOWNTIME");
  // ═════════════════════════════════════════════════════════════════════════
  // A WEEK BEHIND: one record, counted, and no burst — the same guarantee the daily schedule
  // has, on a schedule whose occurrences are not one a day.
  q(`update agent.automations set next_run_at = now() - interval '9 days' where id='${wkId}';`);
  const ticked = await tick();
  // ⚠ READ FROM THE VIEW'S OWN COLUMNS: the reason is projected off the RUN's stop
  // (`run_stop`) and the count is `missed`. There is no `detail` column, which the first
  // draft of this asked for — a column invented from a guess about a shape.
  const missed = JSON.parse(q(`select coalesce(json_agg(json_build_object('reason',run_stop->>'reason',
    'occurrences',missed::text)::json)::text,'[]') from agent.automation_history
    where automation_id='${wkId}';`));
  check("⚠ a weekly schedule a week behind produces ONE record, not a burst",
    missed.length === 1 && missed[0].reason === "missed", JSON.stringify(missed));
  check("...and its next instant is in the FUTURE, on one of its own days",
    q(`select next_run_at > now() from agent.automations where id='${wkId}';`) === "t");
  check("...and it counts as one occurrence, because a week of Mondays and Fridays is not seven days",
    missed[0].occurrences === "1", JSON.stringify(missed[0]));
  void ticked;

  // ═════════════════════════════════════════════════════════════════════════
  console.log("\n9. WHAT IT ALL LEFT BEHIND");
  // ═════════════════════════════════════════════════════════════════════════
  const tally = JSON.parse(q(`select json_build_object(
    'events', (select count(*) from agent.events),
    'undispatched', (select count(*) from agent.events where handled_at is null),
    'executions', (select count(*) from agent.automation_runs),
    'unfinished', (select count(*) from agent.automation_runs where finished_at is null),
    'models', (select count(distinct coalesce(model,'none')) from agent.runs),
    'withModel', (select count(*) from agent.runs where model is not null and model <> 'none'))::text;`));
  check("every event was dispatched", tally.undispatched === 0, JSON.stringify(tally));
  check("⚠ NOT ONE EXECUTION ANYWHERE CALLED A MODEL", tally.withModel === 0, JSON.stringify(tally));
  console.log(`  …  ${tally.events} events, ${tally.executions} executions, ${tally.unfinished} still open`);
} finally {
  stack.tearDown();
}

console.log(`\n${failed === 0 ? "ALL CHECKS PASSED" : `${failed} FAILED`}`);
if (failed) { console.log(fails.map((f) => `  - ${f}`).join("\n")); process.exit(1); }
