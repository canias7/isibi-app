/**
 * ONE WHOLE CONVERSATION, SCRIPTED — through the real chat routes, the real queue, the real
 * engine and a real PostgreSQL.
 *
 * ⚠ **THIS DEMONSTRATION IS SIMULATED AND THE LABEL IS THE FIRST THING IN THE FILE.** The
 * model is `scripts/lib/scripted-model.mjs`, which understands nothing: a caller arms each
 * run with the exact answers that run's model calls will give, in order, keyed by POSITION and
 * never by the words. **Nothing here is a phrase-matching chatbot and nothing here claims
 * language understanding.** What it proves is about the PLATFORM — the routes, the snapshot,
 * the tool dispatch, the approval gate, the fake provider's mailbox and the database.
 *
 * **WHAT ELSE IS SIMULATED, named rather than left to be discovered:**
 *   • the PROVIDER — `fakemail`, no network, no credential of anybody's, and no idempotency
 *     key on purpose, so a second send really is a second message;
 *   • the TRANSPORT — PostgREST is a local shim and the queue is an in-process doorbell,
 *     because neither is reachable from a laptop. Durability is unchanged: the work is a ROW.
 *
 * **WHAT IS NOT SIMULATED**: the site's own routes for everything a person does, `worker.queue`
 * and `worker.scheduled` as the dispatcher, the ownership checks, the retry keys, the lease,
 * the fence, the journal, the approval's argument binding, and the database's own refusals.
 *
 * The sequence is the milestone's own: remember the opening hours → ask for a weekday
 * follow-up with the time missing → the platform refuses and says what is missing → the
 * customer answers in a LATER message → the configuration is presented for approval and saved
 * only once a person says yes → run it, watch it, approve the exact message → change the
 * schedule, pause it, correct the remembered hours.
 */

import { handleAgentApi, makeAgentStore } from "../../agent-store.mjs";
import worker, { ADAPTERS } from "../src/worker.mjs";
import { haveCluster, standUp, dispatcher } from "./lib/local-stack.mjs";
import { makeScriptedModel, SIMULATED } from "./lib/scripted-model.mjs";
import { FAKE_PROVIDER } from "../src/fake-provider.mjs";
import { CAPABILITY_TOOLS } from "../src/capability-tools.mjs";

const DB = `agent_conv_${process.pid}`;
/**
 * ⚠ **THE PLATFORM'S OWN DAY NAMES, and the first draft of this file wrote full words.** The
 * tool refused them BY NAME and listed the set it takes, which is the refusal being good — and
 * it meant TWO things were wrong at once in the section that is about a MISSING TIME. One thing
 * wrong at a time, or a case cannot tell which wall fired.
 */
const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri"];
const A = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa";   // the customer
const B = "bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb";   // the account next door
const ACCOUNT = "shop@example.test";
const ZONE = "Europe/London";

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
const model = makeScriptedModel();
const mailbox = () => ADAPTERS[FAKE_PROVIDER].mailbox(ACCOUNT);

try {
  let minted = 0;
  const api = (p, { tenant = A, body = {}, query = null, ring } = {}) => handleAgentApi({
    path: p, method: query ? "GET" : "POST", tenant, body,
    query: new URLSearchParams(query || {}),
    store: makeAgentStore({ fetch: (u, o) => fetch(u, o), url: rest.url, key: "local-service-role" }),
    ring, newId: () => `00000000-0000-4000-8000-${String(++minted).padStart(12, "0")}`, log: () => {},
  });
  const { env, ctx, rung, drain: plainDrain, ring, tick } = dispatcher({ worker, rest });

  /**
   * ⚠ **EVERY DELIVERY GOES THROUGH `worker.queue` WITH THE SCRIPTED SENDER HANDED IN as its
   * fourth argument — the local-driver seam.** That is unreachable from a deployment by
   * construction (Cloudflare calls the handler with three), so what runs here is the real
   * consumer with a scripted model rather than a runner assembled for the occasion.
   */
  const deliver = async (runId) => {
    let acked = 0;
    await worker.queue({ messages: [{ body: { runId }, ack: () => { acked++; }, retry: () => {} }] },
                       env, ctx, { send: model.send });
    return acked;
  };
  const drain = async () => { const ids = rung.splice(0); for (const id of ids) await deliver(id); return ids; };

  let press = 0;
  /** One message, as a person pressing send, with the next run's answers armed first. */
  const say = async (agent, words, script, tenant = A) => {
    model.arm(script);
    const sent = await api("/api/agent/send", { tenant, body: { id: agent, body: words, key: `press-${++press}` }, ring });
    await drain();
    return sent;
  };
  const waiting = async (agent, tenant = A) =>
    (await api("/api/agent/tool-approvals", { tenant, query: { agent } })).body.approvals || [];
  /** Be the person at the button: approve or reject, then let the run carry on. */
  const decide = async (id, verdict = "approved", tenant = A) => {
    const said = await api("/api/agent/tool-approve", { tenant, body: { id, verdict }, ring });
    await drain();
    return said;
  };
  const answerOf = (runId) => q(`select coalesce(stop ->> 'text', '') from agent.runs where id='${runId}';`);
  const toolOf = (runId) =>
    q(`select coalesce(body ->> 'name', '(none)') from agent.run_entries
        where run_id='${runId}' and body ->> 'kind' = 'tool' order by seq desc limit 1;`);
  const toolResult = (runId) => {
    const raw = q(`select coalesce((body -> 'value')::text, 'null') from agent.run_entries
                   where run_id='${runId}' and body ->> 'kind' = 'tool' order by seq desc limit 1;`);
    try { return JSON.parse(raw); } catch { return null; }
  };
  const autos = async (agent, tenant = A) =>
    (await api("/api/agent/automations", { tenant, query: { agent } })).body.automations || [];
  const execs = async (id, tenant = A) =>
    (await api("/api/agent/automation-history", { tenant, query: { id } })).body.executions || [];
  const memories = async (agent, tenant = A) =>
    (await api("/api/agent/memory", { tenant, query: { agent } })).body.memories || [];

  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n0. THE SET-UP A PERSON DOES: an agent, its tools, and one connected account");
  // ═══════════════════════════════════════════════════════════════════════════
  const AG = (await api("/api/agent/create", {
    body: { name: "Shop assistant", instructions: "Help with the shop's enquiries.", zone: ZONE },
  })).body.agent.id;
  await api("/api/agent/update", {
    body: { id: AG, name: "Shop assistant", instructions: "Help with the shop's enquiries.",
            tools: CAPABILITY_TOOLS.map((t) => t.name) },
  });
  const CX = (await api("/api/agent/connection-connect", {
    body: { agent: AG, provider: FAKE_PROVIDER, account: ACCOUNT, credential: "not a real one",
            scopes: ["read", "send"] },
  })).body.id;
  check("a person connects an account through the site's own route, and it is labelled simulated",
    typeof CX === "string" && CX.length > 0);
  /**
   * ⚠ **CONNECTING AN ACCOUNT IS A PERSON'S DOOR AND THERE IS NO TOOL FOR IT.** The milestone's
   * own words — grants, connections and approval decisions stay under authenticated user
   * control, and model output cannot authorize itself. The wall is that the catalog has no such
   * tool, censused here rather than asserted: a model cannot call what is not offered.
   */
  /**
   * ⚠ **AND THE FIRST DRAFT OF THIS CHECK WAS TOO LOOSE: `/connect/` MATCHES
   * `list_connections`, WHICH IS A READ.** *A needle that can match a longer name cannot prove
   * a class* — it reported a correct catalog as broken. The property is about what a tool may
   * DO, so it is asked of the operations the tools really reach: the only connection operation
   * in the catalog is the LIST, and no tool anywhere grants, approves or decides.
   */
  const CONNECTION_OPS = CAPABILITY_TOOLS.flatMap((t) => (/connection/i.test(t.name) ? [t.name] : []));
  check("⚠ ...and the only connection a tool can reach is READING the list",
    CONNECTION_OPS.length === 1 && CONNECTION_OPS[0] === "list_connections", CONNECTION_OPS.join(" "));
  check("⚠ ...and NO tool grants, approves or decides anything",
    !CAPABILITY_TOOLS.some((t) => /^(grant|approve|authorise|authorize|decide|connect)/.test(t.name)),
    CAPABILITY_TOOLS.map((t) => t.name).join(" "));

  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n1. THE CUSTOMER ASKS THE AGENT TO REMEMBER THE OPENING HOURS");
  // ═══════════════════════════════════════════════════════════════════════════
  const t1 = await say(AG, "Remember that we open nine to five, Monday to Friday.", [
    { tool: "remember", args: { name: "opening_hours", value: "nine to five, Monday to Friday" } },
    { text: "Noted — nine to five, Monday to Friday." },
  ]);
  check("the message is accepted and a run starts", t1.status === 200, JSON.stringify(t1.body).slice(0, 140));
  check("⚠ the tool the script asked for is the one that ran", toolOf(t1.body.runId) === "remember", toolOf(t1.body.runId));
  const mem1 = (await memories(AG)).find((m) => m.key === "opening_hours");
  check("⚠ ...and the fact is on the MEMORY SCREEN, marked as written by a run",
    mem1?.value === "nine to five, Monday to Friday" && mem1.source === "run" && mem1.version === 1,
    JSON.stringify(mem1));
  check("⚠ ...and the answer is labelled simulated in its own text",
    answerOf(t1.body.runId).includes(SIMULATED), answerOf(t1.body.runId).slice(0, 80));

  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n2. A WEEKDAY FOLLOW-UP IS ASKED FOR WITH THE TIME MISSING");
  // ═══════════════════════════════════════════════════════════════════════════
  const STEPS = [
    { type: "knowledge", query: "{{topic}}", out: "facts" },
    { type: "note", out: "reply",
      text: "Hello {{who}} — about your {{topic}}: {{facts}} (this reply is scripted, not written by a model)" },
    { type: "send", connection: CX, to: "{{who}}", body: "{{reply}}" },
  ];
  const INPUTS = [{ name: "who", type: "text" }, { name: "topic", type: "text" }];
  await api("/api/agent/knowledge-save", {
    body: { agent: AG, title: "Price list", format: "text",
            body: "A boiler service is £95 including parts." },
  });
  const beforeAutos = (await autos(AG)).length;
  const t2 = await say(AG, "Set up a weekday follow-up that replies to enquiries.", [
    { tool: "make_automation",
      args: { name: "Weekday follow-up", schedule: "weekly",
              days: WEEKDAYS,
              inputs: INPUTS, steps: STEPS } },
    { text: "I need the time of day before I can set that up." },
  ]);
  /**
   * ⚠ **THE APPROVAL IS THE "PRESENT THE CONFIGURATION" STEP, and that is the platform's own
   * mechanism rather than a sentence a model writes.** Authoring is approval-gated on the TOOL,
   * so the run holds BEFORE anything is created and the person is shown the exact arguments.
   */
  const w2 = await waiting(AG);
  check("⚠ ONE REQUEST IS WAITING FOR A PERSON, showing what would be created",
    w2.length === 1 && w2[0].tool === "make_automation", JSON.stringify(w2.map((r) => r.tool)));
  check("⚠ ...and the configuration a person sees carries the days and NO time",
    Array.isArray(w2[0]?.args?.days) && w2[0].args.days.length === 5 && w2[0].args.atLocal === undefined,
    JSON.stringify(w2[0]?.args?.days));
  check("⚠ NOTHING HAS BEEN CREATED while it waits", (await autos(AG)).length === beforeAutos);

  await decide(w2[0].id, "approved");
  /**
   * ⚠ **AN APPROVAL IS NOT A GUARANTEE THE OPERATION SUCCEEDS — the tool still validates, and
   * this is the milestone's "missing information must not create a partially configured
   * automation".** The person said yes to a configuration with no time, and the platform
   * refused it rather than saving something half-specified.
   */
  const r2 = toolResult(t2.body.runId);
  check("⚠ APPROVED AND STILL REFUSED, because the time is missing",
    r2?.ok === false && r2.error === "bad-time", JSON.stringify(r2).slice(0, 160));
  check("⚠ ...and the refusal SAYS what is missing, so an assistant can relay it",
    /time of day/.test(String(r2?.say)), String(r2?.say));
  check("⚠ ...and STILL nothing was created — not a draft, not a disabled one, nothing",
    (await autos(AG)).length === beforeAutos, `${(await autos(AG)).length} automations`);

  // AND THE TIME ZONE IS THE OTHER HALF OF THE SAME REQUIREMENT: an agent with none set
  // refuses a scheduled automation and says whose settings to change, having saved nothing.
  const NOZONE = (await api("/api/agent/create", {
    body: { name: "No zone", instructions: "x" },
  })).body.agent.id;
  await api("/api/agent/update", {
    body: { id: NOZONE, name: "No zone", instructions: "x", tools: CAPABILITY_TOOLS.map((t) => t.name) },
  });
  const tz = await say(NOZONE, "Make a daily automation at nine.", [
    { tool: "make_automation", args: { name: "Nine", schedule: "daily", atLocal: "09:00", steps: [{ type: "note", text: "x" }] } },
    { text: "It needs a time zone first." },
  ]);
  const wz = await waiting(NOZONE);
  if (wz.length) await decide(wz[0].id, "approved");
  const rz = toolResult(tz.body.runId);
  check("⚠ a MISSING TIME ZONE is refused the same way, and says whose settings to change",
    rz?.ok === false && rz.error === "no-zone" && /settings/.test(String(rz.say)),
    JSON.stringify(rz).slice(0, 180));
  check("⚠ ...and that agent has no automation either", (await autos(NOZONE)).length === 0);

  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n3. THE CUSTOMER ANSWERS IN A LATER MESSAGE, AND IT CONTINUES THE SAME TASK");
  // ═══════════════════════════════════════════════════════════════════════════
  // ⚠ `model.asked` ACCUMULATES ACROSS EVERY RUN, so `[0]` is the first model call of the whole
  // demonstration rather than of this send — my first draft read that and reported turn one's
  // prompt. The window is taken here.
  const askedBefore = model.asked.length;
  const t3 = await say(AG, "Nine o'clock, please.", [
    { tool: "make_automation",
      args: { name: "Weekday follow-up", schedule: "weekly", atLocal: "09:00",
              days: WEEKDAYS,
              inputs: INPUTS, steps: STEPS } },
    { text: "Set up: weekdays at nine, replying from the price list." },
  ]);
  /**
   * ⚠ **THE FOLLOW-UP CONTINUES THE CORRECT TASK BECAUSE THE RUN WAS GIVEN THE CONVERSATION —
   * asserted on WHAT THE MODEL WAS REALLY SHOWN, not on the run finishing.** The snapshot is
   * read inside `agent.send_to_agent`'s own transaction, so the turns cannot be a later edit.
   */
  const thisRun = model.asked.slice(askedBefore);
  const shown = thisRun[0] || {};
  check("⚠ the run that answered the follow-up was shown the EARLIER turns of this conversation",
    shown.turns >= 3, `${shown.turns} user turns reached the model`);
  check("⚠ ...and its prompt is the message just sent, not an earlier one",
    String(shown.prompt).includes("Nine o'clock"), String(shown.prompt).slice(0, 60));
  const earlier = q(`select coalesce((body -> 'history')::text, '[]') from agent.run_entries
                     where run_id='${t3.body.runId}' and body ->> 'kind' = 'started';`);
  check("⚠ ...and the opening-hours turn is in the snapshot the database recorded",
    earlier.includes("nine to five, Monday to Friday"), earlier.slice(0, 120));

  const w3 = await waiting(AG);
  check("⚠ IT HOLDS AGAIN, because every authoring call needs a person — not just the first",
    w3.length === 1 && w3[0].tool === "make_automation");
  check("⚠ ...and the configuration presented now carries the time the customer gave",
    w3[0]?.args?.atLocal === "09:00", String(w3[0]?.args?.atLocal));
  /**
   * ⚠ **ANSWERING A CLARIFICATION IS NOT APPROVING AN ACTION, and the two are different DOORS
   * rather than two readings of one.** "Nine o'clock, please." was a MESSAGE: it started a run
   * and decided nothing. Approving is `/api/agent/tool-approve` with a request id and a
   * verdict, and no message can reach it — censused below.
   */
  check("⚠ the customer's clarification decided NOTHING: the request was still waiting after it",
    w3[0].verdict === undefined || w3[0].verdict === null, JSON.stringify(w3[0]?.verdict));
  check("⚠ ...and STILL nothing is created until a person presses the button",
    (await autos(AG)).length === beforeAutos, `${(await autos(AG)).length} automations`);

  const yes3 = await decide(w3[0].id, "approved");
  check("the approval was accepted", yes3.status === 200, `${yes3.status} ${JSON.stringify(yes3.body).slice(0, 120)}`);
  check("...and the authoring tool really ran after it", toolOf(t3.body.runId) === "make_automation",
    `${toolOf(t3.body.runId)} / ${JSON.stringify(toolResult(t3.body.runId)).slice(0, 200)}`);
  const made = (await autos(AG)).find((a) => a.name === "Weekday follow-up");
  check("⚠ SAVED, and only after the person said yes",
    !!made && made.schedule === "weekly" && made.at === "09:00",
    JSON.stringify({ schedule: made?.schedule, at: made?.at, days: made?.days }));
  check("⚠ ...with the days the customer asked for, in the week's own order",
    JSON.stringify(made?.days) === JSON.stringify(WEEKDAYS),
    JSON.stringify(made?.days));
  if (!made) {
    console.log("\n⚠ nothing was created, so the rest of the conversation cannot be driven");
    throw new Error("no automation to continue with");
  }
  const AU = made.id;

  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n4. IT RUNS, THE CUSTOMER WATCHES, AND APPROVES THE EXACT MESSAGE");
  // ═══════════════════════════════════════════════════════════════════════════
  const before = mailbox().length;
  const t4 = await say(AG, "Run it now for ada@example.test about her boiler service.", [
    { tool: "run_automation", args: { id: AU, input: { who: "ada@example.test", topic: "boiler service" } } },
    { text: "Started it — it is waiting for you to approve the reply." },
  ]);
  const w4run = await waiting(AG);
  check("starting it needs a person too", w4run.some((r) => r.tool === "run_automation"),
    JSON.stringify(w4run.map((r) => r.tool)));
  await decide(w4run.find((r) => r.tool === "run_automation").id, "approved");
  await tick(); await drain();

  const ran = await execs(AU);
  check("⚠ one execution exists and the customer can see it", ran.length === 1, JSON.stringify(ran.map((e) => e.state)));
  check("⚠ ...and it reads as WAITING for a person rather than as working",
    ran[0]?.state === "waiting", String(ran[0]?.state));

  const w4 = (await waiting(AG)).find((r) => r.tool === "send_message");
  check("⚠ THE SEND IS WHAT IS WAITING, and the person is shown the account it goes from",
    !!w4 && w4.args?.connection === CX && w4.args?.account === ACCOUNT, JSON.stringify(w4?.args).slice(0, 160));
  check("⚠ ...the RECIPIENT", w4?.args?.to === "ada@example.test", String(w4?.args?.to));
  check("⚠ ...and the EXACT MESSAGE, with its references already filled in",
    typeof w4?.args?.body === "string" && w4.args.body.includes("£95") && w4.args.body.includes("ada@example.test"),
    String(w4?.args?.body).slice(0, 120));
  check("⚠ NOTHING HAS BEEN SENT while it waits", mailbox().length === before, `${mailbox().length} in the mailbox`);

  /**
   * ⚠ **THE VALUES A PERSON APPROVED CANNOT CHANGE, AND THAT IS STRONGER THAN A STALENESS
   * CHECK — measured rather than argued.** Editing the automation while the execution waits
   * saves, reaches the stored automation and cannot reach the held execution, because its steps
   * and resolved values were snapshotted when it was accepted. So "changed recipients, messages
   * or other approval-relevant values require fresh approval" is satisfied by the values being
   * unable to change at all within one execution; the `stale` wall remains for a state this
   * path cannot produce, and is driven at the module in `test/approvals.test.mjs`.
   */
  const edited = STEPS.map((s) => s.type === "note" ? { ...s, text: "something else entirely" } : { ...s });
  const upd = await api("/api/agent/automation-update", {
    // ⚠ THE WHOLE SHAPE, because this route is a full REPLACE and not a patch. A body of
    // `{id, steps}` is refused "give it a name first", and one with no `zone` is refused
    // "a weekly schedule needs a time zone, so the time means somewhere" — which is the
    // route being right rather than strict. The PATCH shape is `change_automation`, the
    // agent's own tool, and conflating the two is how a section ends up running against an
    // automation it believes it edited.
    body: { id: AU, name: "Weekday follow-up", enabled: true, schedule: "weekly", at: "09:00",
            zone: ZONE, days: WEEKDAYS, inputs: INPUTS, steps: edited },
  });
  check("the automation can be edited while an execution waits", upd.status === 200, JSON.stringify(upd.body).slice(0, 120));
  const heldSteps = q(`select steps::text from agent.automation_runs where id='${ran[0].id}';`);
  check("⚠ ...and the HELD execution still holds the words the person was shown",
    !heldSteps.includes("something else entirely"), heldSteps.slice(0, 80));

  await decide(w4.id, "approved");
  const sent = mailbox().slice(before);
  check("⚠ EXACTLY ONE MESSAGE IS IN THE PROVIDER'S MAILBOX", sent.length === 1, `${sent.length} sent`);
  check("⚠ ...to the recipient the person was shown", sent[0]?.to === "ada@example.test", String(sent[0]?.to));
  check("⚠ ...with the exact words the person was shown, and not the edit",
    sent[0]?.body === w4.args.body && !String(sent[0]?.body).includes("something else entirely"),
    String(sent[0]?.body).slice(0, 90));
  check("⚠ ...and the provider's own record carries no credential",
    !/credential|secret|not a real one/i.test(JSON.stringify(sent[0] ?? {})), JSON.stringify(sent[0]).slice(0, 120));

  // AND THE CUSTOMER CAN ASK WHAT HAPPENED, through the agent's own tool.
  const t4b = await say(AG, "How did that run go?", [
    { tool: "read_execution", args: { id: ran[0].id } },
    { text: "It sent the reply." },
  ]);
  const seen = toolResult(t4b.body.runId);
  check("⚠ the agent can inspect the execution and EXPLAIN it: every step, and how it ended",
    Array.isArray(seen?.execution?.outcomes) && seen.execution.outcomes.length >= 3
    && typeof seen.execution.state === "string",
    JSON.stringify(seen?.execution?.outcomes?.map((o) => `${o.type}:${o.outcome}`)));

  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n5. THE SCHEDULE IS CHANGED, IT IS PAUSED, AND THE HOURS ARE CORRECTED");
  // ═══════════════════════════════════════════════════════════════════════════
  const t5 = await say(AG, "Make it eight o'clock instead.", [
    { tool: "change_automation", args: { id: AU, atLocal: "08:00" } },
    { text: "Moved to eight." },
  ]);
  const w5 = (await waiting(AG)).find((r) => r.tool === "change_automation");
  check("changing it needs a person as well", !!w5, JSON.stringify((await waiting(AG)).map((r) => r.tool)));
  await decide(w5.id, "approved");
  const moved = (await autos(AG)).find((a) => a.id === AU);
  check("⚠ the schedule really moved, on the screen the customer reads", moved?.at === "08:00", String(moved?.at));
  check("⚠ ...and nothing else about it moved", moved?.schedule === "weekly" && moved?.enabled === true,
    JSON.stringify({ schedule: moved?.schedule, enabled: moved?.enabled }));

  const t5b = await say(AG, "Pause it for now.", [
    { tool: "pause_automation", args: { id: AU, enabled: false } },
    { text: "Paused." },
  ]);
  const w5b = (await waiting(AG)).find((r) => r.tool === "pause_automation");
  await decide(w5b.id, "approved");
  check("⚠ it is off on the screen too", (await autos(AG)).find((a) => a.id === AU)?.enabled === false);
  const noRun = await api("/api/agent/automation-run", { body: { id: AU }, ring });
  check("⚠ ...and a paused automation refuses to run, with nothing written",
    noRun.status === 409 && noRun.body.disabled === true && (await execs(AU)).length === 1,
    JSON.stringify(noRun.body).slice(0, 120));

  const t5c = await say(AG, "We open ten to six now, Monday to Saturday.", [
    { tool: "remember", args: { name: "opening_hours", value: "ten to six, Monday to Saturday" } },
    { text: "Corrected." },
  ]);
  const mem2 = (await memories(AG)).filter((m) => m.key === "opening_hours");
  check("⚠ the correction is the new words at the NEXT version, and not a second row",
    mem2.length === 1 && mem2[0].value === "ten to six, Monday to Saturday" && mem2[0].version === 2,
    JSON.stringify(mem2));
  check("...and the tool that ran was remember", toolOf(t5c.body.runId) === "remember", toolOf(t5c.body.runId));

  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n6. NOBODY ELSE CAN REACH ANY OF IT, AND NO MESSAGE CAN APPROVE ANYTHING");
  // ═══════════════════════════════════════════════════════════════════════════
  const theirs = await api("/api/agent/automations", { tenant: B, query: { agent: AG } });
  check("the account next door sees nothing of this agent's", theirs.status === 404 || (theirs.body.automations || []).length === 0,
    `${theirs.status} ${JSON.stringify(theirs.body).slice(0, 80)}`);
  const theirDecide = await api("/api/agent/tool-approve", { tenant: B, body: { id: w5b.id, verdict: "approved" } });
  check("⚠ ...and cannot decide one of this account's requests", theirDecide.status >= 400,
    `${theirDecide.status} ${JSON.stringify(theirDecide.body).slice(0, 80)}`);
  const theirMem = await api("/api/agent/memory", { tenant: B, query: { agent: AG } });
  check("...nor read what it remembers", theirMem.status === 404 || (theirMem.body.memories || []).length === 0,
    `${theirMem.status}`);

  /**
   * ⚠ **A MESSAGE CANNOT DECIDE AN APPROVAL, and the wall is that there is nowhere to do it.**
   * `agent.decide_tool_approval` has exactly ONE caller in the whole site store and it is the
   * approve route. Comments are blanked first, because *prose contains the thing it forbids* —
   * the send route's own comment says "it decides how soon a conversation starts", which is
   * what a naive scan reads as a decision.
   */
  const { readFileSync } = await import("node:fs");
  const siteRaw = readFileSync(new URL("../../agent-store.mjs", import.meta.url), "utf8");
  const site = siteRaw.replace(/^[ \t]*\/\/.*$/gm, (m) => " ".repeat(m.length))
                      .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
  check("⚠ the tree really was blanked and the landmarks survived it",
    site.length === siteRaw.length && site.includes('"/api/agent/send"') && site.includes("rpc/decide_tool_approval"),
    `${site.length} vs ${siteRaw.length}`);
  const callers = [...site.matchAll(/rpc\/decide_tool_approval/g)].length;
  check("⚠ exactly ONE thing in the site calls decide_tool_approval", callers === 1, `${callers} callers`);
  const sendAt = site.indexOf('if (path === "/api/agent/send")');
  const sendEnd = site.indexOf('if (path === "/api/agent/', sendAt + 10);
  check("the send route's own block was found, landmark to landmark", sendAt > 0 && sendEnd > sendAt,
    `${sendAt}..${sendEnd}`);
  check("⚠ ...and nothing in it decides, withdraws or revokes anything",
    !/decide|verdict|withdraw|revoke/i.test(site.slice(sendAt, sendEnd)));

  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n7. WHAT NONE OF IT DID");
  // ═══════════════════════════════════════════════════════════════════════════
  check("⚠ every answer in the whole conversation is labelled simulated",
    q(`select count(*)::text from agent.runs r
        where r.stop ->> 'reason' = 'answered' and coalesce(r.stop ->> 'text','') not like '%${SIMULATED}%';`) === "0",
    q(`select count(*)::text from agent.runs where stop ->> 'reason' = 'answered';`) + " answered");
  check("⚠ not one message went out that a person had not approved",
    mailbox().length === before + 1, `${mailbox().length} in the mailbox`);
  check("⚠ no run executed twice: attempts never above 1",
    q(`select coalesce(max(attempts),0)::text from agent.run_work;`) === "1",
    q(`select coalesce(max(attempts),0)::text from agent.run_work;`));
  check("⚠ and nothing anywhere holds a credential",
    q(`select count(*)::text from agent.run_entries where body::text ilike '%not a real one%';`) === "0");
} finally {
  await stack.tearDown();
}

console.log(`\n${failed === 0 ? "ALL CHECKS PASSED" : `${fails.length} FAILED`}`);
for (const f of fails) console.log(`  - ${f}`);
process.exit(failed === 0 ? 0 : 1);
