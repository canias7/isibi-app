#!/usr/bin/env node
/**
 * AN AGENT'S TOOLS DO REAL WORK — one demonstration, end to end. `npm run verify:tools`.
 *
 * **THE MILESTONE'S OWN WORDING IS THE TEST THIS FILE HAS TO PASS: *the tools must
 * perform real backend operations when called by the stand-in model; returning canned
 * success messages does not complete this.*** So every check below reads the ROW back out
 * of PostgreSQL after the tool ran, not the sentence the tool returned. A tool that
 * answered beautifully and wrote nothing fails here.
 *
 * Every piece is the real one, and `scripts/lib/local-stack.mjs` is the only fixture:
 *
 *   * the SITE BUILDER's routes (`handleAgentApi`) for everything a person does — writing
 *     the agent, ticking its tools, saving the reference material, sending the message;
 *   * the DATABASE — a throwaway PostgreSQL with this repository's migrations applied, so
 *     the capability functions, their tenant filters and the column checks are genuine;
 *   * the DISPATCHER — `worker.queue`, the Worker's own consumer handler, which claims
 *     through `claim_run`, reads the snapshot, narrows the tools and runs the loop. **It
 *     is driven rather than replaced on purpose**: the wiring hop between a capability
 *     and the tool that uses it is exactly the kind this repository keeps paying for.
 *
 * ── ⚠ WHAT IS SIMULATED, IN ONE PLACE ────────────────────────────────────────
 *
 * The MODEL, and the transport. `makeStandIn` is not a provider: it reads the tools it
 * was offered, picks the one the request names and fills that tool's own declared schema
 * — which is what a model does with a tool — and every answer it composes is labelled
 * `[simulated]`. **No paid call is made and none can be.** PostgREST is a local shim and
 * the queue is an in-process doorbell, because neither is reachable from a laptop;
 * durability is unchanged, because the work is a ROW.
 *
 * ⚠ NOT A STATEMENT ABOUT THE DEPLOYMENT. Nothing here touches the hosted project.
 */

import { handleAgentApi, makeAgentStore } from "../../agent-store.mjs";
import worker from "../src/worker.mjs";
import { haveCluster, standUp, dispatcher } from "./lib/local-stack.mjs";
import { OFFERED_NAMES } from "../src/agents.mjs";
import { CAPABILITY_TOOLS, CONNECTION_TOOLS } from "../src/capability-tools.mjs";
import { makeCapabilities } from "../src/capabilities.mjs";
import { AUTOMATION_STEPS, MAX_WORKFLOW_STEPS, readWorkflow } from "../src/automations.mjs";
import { argsHash } from "../src/approvals.mjs";

const DB = `agent_tools_${process.pid}`;
const A = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa";   // one account
const B = "bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb";   // the account next door

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
  const api = (p, { tenant = A, body = {}, query = null, ring } = {}) => handleAgentApi({
    path: p, method: query ? "GET" : "POST",
    tenant, body, query: new URLSearchParams(query || {}), store: appStore(), ring,
    newId: () => `00000000-0000-4000-8000-${String(++minted).padStart(12, "0")}`,
    log: () => {},
  });
  const { env, drain, ring, tick } = dispatcher({ worker, rest });

  /** Send one message and let the consumer run it, the way a person pressing send does. */
  let press = 0;
  const ask = async (agent, words, tenant = A) => {
    const sent = await api("/api/agent/send", { tenant, body: { id: agent, body: words, key: `press-${++press}` }, ring });
    await drain();
    return sent;
  };
  /**
   * Send one message and — where the run stops for a person — BE that person.
   *
   * **EVERY HOP IS THE REAL ONE.** The run holds because `run.mjs` asked
   * `agent.request_tool_approval` through the engine's own store; what is waiting is read
   * through the SITE'S route, which is what the screen reads; the decision goes through
   * the SITE'S route, which is what the button presses; and the run comes back because
   * `agent.decide_tool_approval` called `agent.requeue_run` inside its own transaction.
   * Nothing here writes a row by hand.
   *
   * ⚠ AND IT TICKS AFTER DRAINING, which is a fact about the product rather than about
   * this script: the decision is recorded by a SQL function, and a SQL function cannot
   * ring a Cloudflare queue. The site's route rings it afterwards — that is the prompt
   * path and it is asserted below — and the SWEEPER is what makes the work durable when
   * the ring fails. Driving both is what proves the run is not stranded either way.
   */
  const decide = async (agent, runId, verdict = "approved", tenant = A, sweep = true) => {
    const waiting = await api("/api/agent/tool-approvals", { tenant, query: { agent } });
    const row = (waiting.body.approvals || []).find((r) => r.run === runId) || null;
    if (!row) return null;
    const said = await api("/api/agent/tool-approve", { tenant, body: { id: row.id, verdict }, ring });
    await drain();
    // ⚠ **THE SWEEP IS OPTIONAL BECAUSE IT RUNS EVERYTHING ELSE TOO.** A tick offers every
    // unheld work row, so a conversation that just STARTED an automation has that execution
    // run to completion before the next line — which is right for the ordinary case and makes
    // "cancel something that has not run" unreachable. Measured: the cancel came back
    // `alreadyStopped` about work this helper had finished a moment earlier.
    if (sweep) { await tick(); await drain(); }
    return { row, said: said.body, status: said.status };
  };
  /** Send, then answer whatever it stopped to ask. */
  const askOk = async (agent, words, verdict = "approved", tenant = A, sweep = true) => {
    const sent = await ask(agent, words, tenant);
    const answered = await decide(agent, sent.body.runId, verdict, tenant, sweep);
    return { ...sent, approval: answered };
  };

  /** What the run ended up saying, and which tool it really called. */
  const answer = (runId) => q(`select coalesce(stop ->> 'text', '') from agent.runs where id = '${runId}';`);
  const calledTool = (runId) =>
    q(`select coalesce(body ->> 'name', '') from agent.run_entries where run_id = '${runId}' and body ->> 'kind' = 'tool' limit 1;`);
  const toolResult = (runId) =>
    JSON.parse(q(`select coalesce((body -> 'value')::text, 'null') from agent.run_entries where run_id = '${runId}' and body ->> 'kind' = 'tool' limit 1;`));

  // ═════════════════════════════════════════════════════════════════════════
  console.log("\n1. THE CATALOG IS THE SERVER'S, AND A CUSTOMER'S TICK IS WHAT GRANTS ONE");
  // ═════════════════════════════════════════════════════════════════════════
  const TOOLS = CAPABILITY_TOOLS.map((t) => t.name);
  check("every capability tool is in the catalog a customer chooses from",
    TOOLS.every((n) => OFFERED_NAMES.includes(n)), TOOLS.join(" "));

  const made = await api("/api/agent/create", {
    body: { name: "Workshop", instructions: "Answer about the workshop.", tools: TOOLS },
  });
  check("an agent is written with those tools ticked", made.status === 200, JSON.stringify(made.body).slice(0, 160));
  const AG = made.body.agent.id;
  check("...and the ticks are on the row, in the catalog's own order",
    q(`select array_to_string(tools, ',') from agent.agents where id = '${AG}';`).split(",").length === TOOLS.length);

  // THE AGENT NEXT DOOR, which every isolation check below needs as its subject.
  const theirs = await api("/api/agent/create", {
    tenant: B, body: { name: "Next door", instructions: "Theirs.", tools: TOOLS },
  });
  const THEIR_AG = theirs.body.agent.id;
  // AND A SIBLING OF THE SAME ACCOUNT — the wall no tenant filter can see.
  const sibling = await api("/api/agent/create", { body: { name: "Sibling", instructions: "Also mine." } });
  const SIB = sibling.body.agent.id;

  // ═════════════════════════════════════════════════════════════════════════
  console.log("\n2. THE MATERIAL A PERSON SAVED IS WHAT THE AGENT SEARCHES");
  // ═════════════════════════════════════════════════════════════════════════
  const src = await api("/api/agent/knowledge-save", {
    body: {
      agent: AG, title: "Price list",
      body: "Boiler service is £95 including parts. A gutter clean is £60 for a terrace.",
    },
  });
  check("a person saves a source through their own screen's route", src.status === 200);
  const SOURCE = src.body.source.id;
  await api("/api/agent/knowledge-save", {
    tenant: B, body: { agent: THEIR_AG, title: "Their prices", body: "A boiler service next door is £200." },
  });

  const searched = await ask(AG, "use search_reference query=boiler to find what a service costs");
  const sRun = searched.body.runId;
  check("the model chose the tool the request named", calledTool(sRun) === "search_reference", calledTool(sRun));
  const sOut = toolResult(sRun);
  // ⚠ THE PASSAGE COMES OUT OF POSTGRESQL'S OWN `ts_headline`, so this is the real search
  // and not a sentence: a canned answer could not contain the price a person typed.
  check("...and it really searched, finding the passage with its source",
    sOut?.ok === true && sOut.found === 1 && /95/.test(sOut.passages[0].text) && sOut.passages[0].title === "Price list",
    JSON.stringify(sOut).slice(0, 200));
  check("⚠ ...and NOT the account next door's source, which says a different price",
    !/200/.test(JSON.stringify(sOut)));
  check("the answer is labelled simulated, in its own text", /\[simulated\]/.test(answer(sRun)));

  const listed = await ask(AG, "use list_reference");
  const lOut = toolResult(listed.body.runId);
  check("listing the sources is the real list", lOut?.ok === true && lOut.count === 1 && lOut.sources[0].title === "Price list",
    JSON.stringify(lOut).slice(0, 160));
  check("⚠ ...and the list carries no material, so a tool is not the cheap way to pull every document",
    lOut.sources.every((k) => k.body === undefined), JSON.stringify(lOut.sources[0]));

  const read = await ask(AG, `use read_reference id=${SOURCE}`);
  const rOut = toolResult(read.body.runId);
  check("reading one source whole gives the material", rOut?.ok === true && /gutter clean/.test(rOut.source.body));

  // ═════════════════════════════════════════════════════════════════════════
  console.log("\n3. ⚠ REMEMBERING IS A ROW, AND THE ROW IS WHAT IS CHECKED");
  // ═════════════════════════════════════════════════════════════════════════
  const before = q(`select count(*) from agent.agent_memory where agent_id = '${AG}';`);
  const remembered = await ask(AG, 'use remember name=preferred_tone value="short and plain"');
  const mOut = toolResult(remembered.body.runId);
  check("the tool says it saved", mOut?.ok === true && mOut.saved === "created", JSON.stringify(mOut).slice(0, 160));
  // ⚠ AND THE DATABASE SAYS SO, which is the half a canned answer cannot produce.
  check("⚠ ...and THE ROW IS THERE, with the words a person can read",
    before === "0" &&
    q(`select value from agent.agent_memory where agent_id = '${AG}' and key = 'preferred_tone';`) === "short and plain");
  check("⚠ ...recorded as having come from a RUN, which no tool argument can set",
    q(`select source from agent.agent_memory where agent_id = '${AG}' and key = 'preferred_tone';`) === "run");
  check("...and the person's own screen sees it",
    (await api("/api/agent/memory", { query: { agent: AG } })).body.memories.some((m) => m.key === "preferred_tone"));

  const seen = await ask(AG, "use list_memory");
  const seenOut = toolResult(seen.body.runId);
  check("the agent can see what it remembers, and it is the row a person would see",
    seenOut?.ok === true && seenOut.count === 1 && seenOut.memories[0].name === "preferred_tone" &&
    seenOut.memories[0].value === "short and plain", JSON.stringify(seenOut).slice(0, 180));

  const again = await ask(AG, 'use remember name=preferred_tone value="short and plain"');
  check("saving the same words again is the same fact at the same version",
    toolResult(again.body.runId)?.saved === "unchanged" &&
    q(`select version::text from agent.agent_memory where agent_id = '${AG}' and key = 'preferred_tone';`) === "1");
  const moved = await ask(AG, 'use remember name=preferred_tone value="warm and brief"');
  check("...and different words move it to version 2",
    toolResult(moved.body.runId)?.saved === "corrected" &&
    q(`select version::text from agent.agent_memory where agent_id = '${AG}' and key = 'preferred_tone';`) === "2");

  // ⚠ THE NAME IS FOLDED, NOT REFUSED, so a refusal needs a name no fold can rescue.
  // `Not_A_Name` lowercases into a perfectly good identifier — which is the product being
  // kind and was this check being wrong, measured rather than reasoned about.
  const folded = await ask(AG, "use remember name=Preferred_Style value=plain");
  check("a name in capitals is FOLDED rather than refused",
    toolResult(folded.body.runId)?.ok === true &&
    q(`select count(*) from agent.agent_memory where agent_id = '${AG}' and key = 'preferred_style';`) === "1");
  const badName = await ask(AG, 'use remember name="not a name" value=x');
  check("...and one no fold can rescue IS refused, with something to do about it",
    toolResult(badName.body.runId)?.ok === false && /lower-case/.test(toolResult(badName.body.runId).say),
    JSON.stringify(toolResult(badName.body.runId)));

  const forgot = await ask(AG, "use forget name=preferred_tone");
  check("forgetting removes the row", toolResult(forgot.body.runId)?.forgot === true &&
    q(`select count(*) from agent.agent_memory where agent_id = '${AG}' and key = 'preferred_tone';`) === "0");
  const forgotAgain = await ask(AG, "use forget name=preferred_tone");
  check("⚠ ...and forgetting what is not there SAYS SO rather than failing",
    toolResult(forgotAgain.body.runId)?.ok === true && toolResult(forgotAgain.body.runId).forgot === false);

  // ═════════════════════════════════════════════════════════════════════════
  console.log("\n4. AN AGENT CAN SEE AND CONTROL ITS OWN AUTOMATIONS");
  // ═════════════════════════════════════════════════════════════════════════
  const auto = await api("/api/agent/automation-create", {
    body: {
      agent: AG, name: "Nightly count", enabled: true, schedule: "daily", at: "23:00", zone: "Europe/London",
      steps: [{ type: "note", text: "counted" }],
    },
  });
  check("a person writes an automation", auto.status === 200, JSON.stringify(auto.body).slice(0, 160));
  const AUTO = auto.body.id;
  // ONE NEXT DOOR AND ONE ON A SIBLING, so both walls below have a real subject.
  const theirAuto = await api("/api/agent/automation-create", {
    tenant: B, body: { agent: THEIR_AG, name: "Theirs", schedule: "manual", steps: [{ type: "note", text: "x" }] },
  });
  const sibAuto = await api("/api/agent/automation-create", {
    body: { agent: SIB, name: "Sibling's", schedule: "manual", steps: [{ type: "note", text: "x" }] },
  });

  const autos = await ask(AG, "use list_automations");
  const aOut = toolResult(autos.body.runId);
  check("the agent lists its own automations", aOut?.ok === true && aOut.count === 1 && aOut.automations[0].name === "Nightly count",
    JSON.stringify(aOut).slice(0, 200));
  check("⚠ ...and NOT its sibling's, which shares an owner — the wall no tenant filter can see",
    !JSON.stringify(aOut).includes("Sibling"));
  check("...and the list counts steps rather than carrying them", aOut.automations[0].steps === 1);

  const readAuto = await ask(AG, `use read_automation id=${AUTO}`);
  check("reading one gives its steps", Array.isArray(toolResult(readAuto.body.runId)?.automation?.steps));

  const sibRead = await ask(AG, `use read_automation id=${sibAuto.body.id}`);
  check("⚠ a SIBLING's automation answers the same 'no such thing' a missing one does",
    toolResult(sibRead.body.runId)?.error === "no-automation", JSON.stringify(toolResult(sibRead.body.runId)));
  const theirRead = await ask(AG, `use read_automation id=${theirAuto.body.id}`);
  check("...and so does the account next door's", toolResult(theirRead.body.runId)?.error === "no-automation");

  // ⚠ FROM HERE ON THE RUN STOPS FOR A PERSON. `pause_automation` and `run_automation`
  // change what the account DOES outside this conversation, so both are gated in code —
  // and every check below is therefore about the WHOLE loop: the run held, a person was
  // shown the exact arguments, they pressed, and the run carried on and did the thing.
  const heldFirst = await ask(AG, `use pause_automation id=${AUTO} enabled=false`);
  check("⚠ A GATED CALL STOPS THE RUN AND NOTHING HAPPENS",
    calledTool(heldFirst.body.runId) === "" &&
    q(`select enabled::text from agent.automations where id = '${AUTO}';`) === "true",
    `tool entry: "${calledTool(heldFirst.body.runId)}"`);
  const waitingNow = await api("/api/agent/tool-approvals", { query: { agent: AG } });
  const req = (waitingNow.body.approvals || [])[0] || {};
  check("⚠ ...and THE SCREEN'S OWN ROUTE shows what is waiting, with the arguments it would run with",
    req.tool === "pause_automation" && req.args?.id === AUTO && req.args?.enabled === false,
    JSON.stringify(req).slice(0, 200));
  check("⚠ the account next door is shown nothing of it",
    ((await api("/api/agent/tool-approvals", { tenant: B })).body.approvals || []).length === 0);
  // ⚠ AND AN AGENT CANNOT ANSWER IT. There is no tool for it, so the only thing an agent
  // could do is name one — and the platform has none, which is a census rather than a
  // hope. Asked here as well as in the suite because this is the live surface.
  check("⚠ no tool this agent holds can decide an approval",
    !TOOLS.some((n) => /approv|decide|authoris|authoriz/i.test(n)), TOOLS.join(" "));

  const answered = await decide(AG, heldFirst.body.runId, "approved");
  check("a person approves it through the site's own route", answered?.status === 200 && answered?.said?.ok === true,
    JSON.stringify(answered?.said).slice(0, 160));
  check("⚠ ...and WHO DECIDED is the account, recorded by the database and not by the caller",
    q(`select coalesce(decided_by,'-') from agent.tool_approvals where id = '${req.id}';`) === A);
  check("⚠ ...and the DOORBELL RANG, so the run comes back at once rather than at the next sweep",
    answered?.said?.notified === true, JSON.stringify(answered?.said).slice(0, 160));

  const paused = { body: heldFirst.body };
  check("turning one off answers, once a person has said so", toolResult(paused.body.runId)?.ok === true,
    JSON.stringify(toolResult(paused.body.runId)).slice(0, 160));
  // ⚠ THE FLAG IN THE DATABASE, not the sentence.
  check("⚠ ...and THE ROW IS OFF", q(`select enabled::text from agent.automations where id = '${AUTO}';`) === "false");
  const resumed = await askOk(AG, `use pause_automation id=${AUTO} enabled=true`);
  check("turning it on again puts it back", toolResult(resumed.body.runId)?.ok === true &&
    q(`select enabled::text from agent.automations where id = '${AUTO}';`) === "true");
  check("⚠ ...and re-arms it FORWARD, so a spell switched off is not a backlog",
    q(`select (next_run_at > now())::text from agent.automations where id = '${AUTO}';`) === "true");
  const sibPause = await askOk(AG, `use pause_automation id=${sibAuto.body.id} enabled=false`);
  check("⚠ a sibling's automation cannot be turned off, and nothing is written",
    toolResult(sibPause.body.runId)?.ok === false &&
    q(`select enabled::text from agent.automations where id = '${sibAuto.body.id}';`) === "true");

  // ═════════════════════════════════════════════════════════════════════════
  console.log("\n5. STARTING ONE, AND WATCHING WHAT IT DID");
  // ═════════════════════════════════════════════════════════════════════════
  const wasRuns = q(`select count(*) from agent.automation_runs where automation_id = '${AUTO}';`);
  const started = await askOk(AG, `use run_automation id=${AUTO}`);
  const runOut = toolResult(started.body.runId);
  check("the tool says it started one", runOut?.ok === true, JSON.stringify(runOut).slice(0, 160));
  check("⚠ ...and AN EXECUTION ROW EXISTS that did not before",
    wasRuns === "0" && q(`select count(*) from agent.automation_runs where automation_id = '${AUTO}';`) === "1");
  // ⚠ THE CRON IS WHAT STARTS IT, and this is the durability claim rather than a
  // convenience. A tool runs inside the CONSUMER, which never produces, so there is no
  // doorbell to ring — the work is a committed ROW and `sweep_run_work` offers it with no
  // grace at all. Calling the real `scheduled` handler here is exercising exactly the
  // path a deployment uses, one tick later.
  await tick();
  await drain();
  check("⚠ ...and the CRON started it, which is what makes the work durable rather than prompt",
    q(`select count(*) from agent.automation_runs a join agent.runs r on r.id = a.id
        where a.automation_id = '${AUTO}' and r.stop ->> 'reason' is not null;`) === "1");

  const history = await ask(AG, `use list_executions automation=${AUTO}`);
  const hOut = toolResult(history.body.runId);
  check("the agent can read what its automation did", hOut?.ok === true && hOut.count === 1 &&
    hOut.executions[0].state === "done", JSON.stringify(hOut).slice(0, 200));
  const one = await ask(AG, `use read_execution id=${hOut.executions[0].id}`);
  check("...and one execution in full, with every step's outcome",
    Array.isArray(toolResult(one.body.runId)?.execution?.outcomes));
  // ⚠ **STOPPING ONE, FROM A REAL MESSAGE.** `cancel_execution` takes an id, which the
  // stand-in can fill by name, so the census below rightly requires it to be driven this way
  // rather than called directly — and it is approval-gated, so a person says yes first.
  // ⚠ NO SWEEP AFTER THE APPROVAL, so the execution is QUEUED AND UNRUN — which is the case
  // cancellation is about: the work row exists, nothing has claimed it, and a cancel has to
  // RELEASE it or the next delivery runs a stopped run.
  const toStop = await askOk(AG, `use run_automation id=${AUTO}`, "approved", A, false);
  const EXS = toolResult(toStop.body.runId)?.execution ?? "";
  check("a second execution is queued, so there is something to stop",
    /^[0-9a-f-]{36}$/.test(EXS) && q(`select coalesce(status,'-') from agent.runs where id = '${EXS}';`) !== "stopped",
    `${EXS} / ${q(`select coalesce(status,'(no row)') from agent.runs where id = '${EXS}';`)}`);
  const halted = await askOk(AG, `use cancel_execution id=${EXS} reason=wrong-one`);
  const hRes = toolResult(halted.body.runId);
  check("⚠ the agent stops an execution, and is told what had already happened",
    hRes?.ok === true && hRes.stopped === true
    && Number.isInteger(hRes.completedSteps) && Number.isInteger(hRes.completedCalls),
    JSON.stringify(hRes).slice(0, 200));
  check("⚠ ...and nothing claims it was undone", /was not undone/.test(hRes?.say ?? ""), hRes?.say);
  const hStop = q(`select coalesce(stop::text, '(no stop)') from agent.runs where id = '${EXS}';`);
  const hWork = q(`select coalesce((done_at is not null)::text, '-') || '|' || coalesce(claimed_by, '(released)')
      from agent.run_work where run_id = '${EXS}';`);
  // ⚠ **WHO, NOT WHY — because `reason` is OPTIONAL and `standInArgs` fills only the required
  // properties.** That is the stand-in being honest about what it can compose from a sentence,
  // so demanding the note here would be demanding a behaviour it does not have; what matters
  // is that the stop names the AGENT that asked, which no argument can choose.
  check("⚠ ...and the RUN says who stopped it, with the work row released",
    /"reason": ?"cancelled"/.test(hStop) && hStop.includes(`agent:${AG}`) && hWork === "true|(released)",
    `${hStop.slice(0, 150)} | work ${hWork}`);

  const sibHistory = await ask(AG, `use list_executions automation=${sibAuto.body.id}`);
  check("⚠ ...and a sibling's history is empty rather than refused, which tells a caller nothing",
    toolResult(sibHistory.body.runId)?.count === 0);

  // ═════════════════════════════════════════════════════════════════════════
  console.log("\n5b. ⚠ THE SAME CALL DELIVERED TWICE IS ONE PIECE OF WORK");
  // ═════════════════════════════════════════════════════════════════════════
  // **THIS IS WHAT `repeatable: true` ON `run_automation` RESTS ON, and until 2026-09-17
  // it rested on a claim that was false.** A process can die between a tool call and the
  // write that records its result, so a resume runs that call m5Again — and the only thing
  // that stops a m5Second run of the automation is that the tool asks for the SAME
  // execution. Its id is derived from `ctx.operation`, which is
  // `<run>:<step>:<index>:<the arguments' own hash>`.
  //
  // Driven through the REAL capability store against the real database, because what is
  // being proved is what Postgres does with the m5Second ask. `ctx` is built by hand here
  // rather than through a delivery, deliberately: two deliveries of one message is a
  // DIFFERENT property (the claim refuses the m5Second, which section 8 reads off
  // `attempts`), and it could never exercise the case where the m5First attempt's result
  // was lost.
  const m5Ops = makeCapabilities({ fetch, url: env.SUPABASE_URL, key: env.SUPABASE_SERVICE_KEY })
    .forTenant(A).forAgent(AG);
  const m5RunTool = CAPABILITY_TOOLS.find((t) => t.name === "run_automation");
  const m5CtxFor = async (args, step = 4, index = 0) =>
    ({ capabilities: m5Ops, operation: `88888888-8888-4888-8888-888888888888:${step}:${index}:${await argsHash(args)}` });

  const runsBefore = Number(q(`select count(*) from agent.automation_runs where automation_id = '${AUTO}';`));
  const m5Args1 = { id: AUTO };
  const m5First = await m5RunTool.run(m5Args1, await m5CtxFor(m5Args1));
  const m5Again = await m5RunTool.run(m5Args1, await m5CtxFor(m5Args1));
  check("the first ask starts one", m5First?.ok === true && m5First.started === true, JSON.stringify(m5First));
  check("⚠ ...and the SAME call again is answered rather than refused",
    m5Again?.ok === true, JSON.stringify(m5Again));
  check("⚠ ...says it was already started by this same request",
    m5Again.started === false && /this same request/.test(m5Again.say ?? ""), JSON.stringify(m5Again));
  check("⚠ ...naming the SAME execution", m5Again.execution === m5First.execution);
  check("⚠ ...and the database holds exactly ONE more execution, not two",
    Number(q(`select count(*) from agent.automation_runs where automation_id = '${AUTO}';`)) === runsBefore + 1);
  check("...with one run and one work row for it",
    q(`select count(*) from agent.runs where id = '${m5First.execution}';`) === "1" &&
    q(`select count(*) from agent.run_work where run_id = '${m5First.execution}';`) === "1");

  // ⚠ **THE CONTROL, AND IT IS WHAT THE ARGUMENTS BUY.** A different call at the SAME
  // position must be a different piece of work. Without the arguments in the identity this
  // would come back "already running" about the m5First automation — a genuinely different
  // request absorbed into one nobody asked for.
  //
  // It names a SECOND automation OF THIS AGENT, deliberately: the sibling's would be
  // refused `no-automation` by the agent wall, which is a different refusal and would make
  // this control pass for a reason that has nothing to do with the identity.
  const m5Second = await api("/api/agent/automation-create", {
    body: { agent: AG, name: "Also mine", schedule: "manual", steps: [{ type: "note", text: "x" }] },
  });
  check("a second automation of this agent's exists to compare against", m5Second.status === 200,
    JSON.stringify(m5Second.body).slice(0, 120));
  const m5Args2 = { id: m5Second.body.id };
  // ⚠ **MOVED TO ITS OWN POSITION — AN EXPECTATION THAT MOVED RATHER THAN BROKE.** This ran
  // at the SAME position as the first call, and the identity being what it is, that is now
  // refused `operation-mismatch` by the operation record below. Both properties are real and
  // they are different ones: THIS is "a different call derives its own execution" (what the
  // arguments buy inside the id), and the check under it is "the same slot with different
  // arguments is refused" (what the record buys on top). Reading either as the other is how
  // one of the two stops being tested.
  const m5Other = await m5RunTool.run(m5Args2, await m5CtxFor(m5Args2, 4, 1));
  check("⚠ THE CONTROL: a DIFFERENT call at its own position is its own execution",
    m5Other?.ok === true && m5Other.started === true && m5Other.execution !== m5First.execution,
    JSON.stringify(m5Other));

  // ⚠ **AND THE SAME SLOT RE-FILLED WITH ANOTHER CALL IS REFUSED, NOT SILENTLY A SECOND
  // OPERATION.** That is the requirement in as many words. The key is the POSITION and the
  // arguments' hash is a column beside it, so this arrives as the same operation asked with
  // different arguments — which no retry can explain.
  const m5RunsMid = Number(q(`select count(*) from agent.automation_runs;`));
  const m5Clash = await m5RunTool.run(m5Args2, await m5CtxFor(m5Args2, 4, 0));
  check("⚠ THE SAME SLOT WITH DIFFERENT ARGUMENTS IS REFUSED BY NAME",
    m5Clash?.ok === false && m5Clash.error === "operation-mismatch", JSON.stringify(m5Clash));
  check("⚠ ...and it started nothing at all",
    Number(q(`select count(*) from agent.automation_runs;`)) === m5RunsMid);

  // AND A DEPLOYMENT THAT CANNOT IDENTIFY THE CALL REFUSES rather than minting an id,
  // because minting is exactly the behaviour the derivation removes.
  const m5Blind = await m5RunTool.run(m5Args1, { capabilities: m5Ops });
  check("⚠ ...and with no identity at all it refuses BY NAME and starts nothing",
    m5Blind?.ok === false && m5Blind.error === "no-id" &&
    Number(q(`select count(*) from agent.automation_runs where automation_id = '${AUTO}';`)) === runsBefore + 1,
    JSON.stringify(m5Blind));
  await drain();

  // ═════════════════════════════════════════════════════════════════════════
  console.log("\n5c. WRITING A WORKFLOW — the same reader the screen's own save goes through");
  // ═════════════════════════════════════════════════════════════════════════
  // ⚠ **THE FOUR AUTHORING TOOLS ARE DRIVEN DIRECTLY, AND THE REASON IS THE STAND-IN.**
  // `make_automation` takes a LIST OF OBJECTS, and the stand-in fills a tool's declared
  // schema from the words of a request — which cannot produce a nested workflow. So the
  // steps are composed here and the tool is called with a real `ctx`, exactly as
  // section 5b does; what that cannot show is the APPROVAL GATE, which lives in the loop, so
  // the last check below drives `make_automation` through a real message instead.
  const wfListActionsTool = CAPABILITY_TOOLS.find((t) => t.name === "list_actions");
  const wfCheckTool = CAPABILITY_TOOLS.find((t) => t.name === "check_workflow");
  const wfMakeTool = CAPABILITY_TOOLS.find((t) => t.name === "make_automation");
  const wfChangeTool = CAPABILITY_TOOLS.find((t) => t.name === "change_automation");
  const wfCtx = async (args, step, index = 0) =>
    ({ capabilities: m5Ops, operation: `88888888-8888-4888-8888-888888888888:${step}:${index}:${await argsHash(args)}` });

  // ⚠ THE CATALOG IS THE PLATFORM'S OWN, and this reads it through the tool rather than
  // from the module — a tool that described a step the engine has not got would be a
  // control that answers and then fails at the first execution.
  const wfActions = await wfListActionsTool.run({}, await wfCtx({}, 20));
  check("the agent can read what a workflow may be built from",
    wfActions?.ok === true && Array.isArray(wfActions.actions) && wfActions.actions.length === AUTOMATION_STEPS.length,
    `${wfActions?.actions?.length} of ${AUTOMATION_STEPS.length}`);
  check("⚠ ...and it is the engine's OWN registry, type for type",
    JSON.stringify(wfActions.actions.map((a) => a.type)) === JSON.stringify(AUTOMATION_STEPS.map((d) => d.type)),
    wfActions.actions.map((a) => a.type).join(" "));
  check("⚠ ...with the platform's step ceiling, so a model is not told to guess it",
    wfActions.max === MAX_WORKFLOW_STEPS, String(wfActions.max));
  // ⚠ AND THE MODEL REALLY REACHES IT, through a message and the loop — it takes no
  // arguments, so this is the one authoring tool the stand-in can compose a call to, and
  // reading the catalog is the first thing an agent writing a workflow has to do.
  const wfAsked = await ask(AG, "use list_actions");
  check("⚠ ...and a model really asked for it, through the loop",
    calledTool(wfAsked.body.runId) === "list_actions", calledTool(wfAsked.body.runId));
  check("⚠ ...and got the whole catalog back",
    (toolResult(wfAsked.body.runId)?.actions ?? []).length === AUTOMATION_STEPS.length,
    String((toolResult(wfAsked.body.runId)?.actions ?? []).length));

  // ⚠ CHECKING IS FREE AND CHANGES NOTHING, which is what makes it usable as often as a
  // model needs to get a workflow right.
  const wfBadSteps = [{ type: "note", text: "Today is {{nothing}}" }];
  const wfWasAutos = Number(q(`select count(*) from agent.automations;`));
  const wfBadCheck = await wfCheckTool.run({ steps: wfBadSteps }, await wfCtx({ steps: wfBadSteps }, 21));
  check("a workflow naming a reference nothing produces is refused",
    wfBadCheck?.ok === false && wfBadCheck.error === "bad-workflow", JSON.stringify(wfBadCheck));
  check("⚠ ...with the READER'S OWN sentence, so a model is told what to fix",
    /nothing/.test(wfBadCheck.say ?? ""), wfBadCheck.say);
  const wfUnbalanced = [{ type: "if", left: "a", test: "is", right: "a" }, { type: "note", text: "x" }];
  const wfNoEnd = await wfCheckTool.run({ steps: wfUnbalanced }, await wfCtx({ steps: wfUnbalanced }, 22));
  check("a branch that does not balance is refused", wfNoEnd?.ok === false, JSON.stringify(wfNoEnd));
  const wfGoodSteps = [
    { type: "memory", key: "tone", out: "tone" },
    { type: "note", text: "The tone is {{tone}}." },
  ];
  const wfGoodCheck = await wfCheckTool.run({ steps: wfGoodSteps }, await wfCtx({ steps: wfGoodSteps }, 23));
  check("⚠ THE CONTROL: a workflow that reads goes through, and says what it produces",
    wfGoodCheck?.ok === true && wfGoodCheck.steps === 2 && wfGoodCheck.produces.includes("tone"),
    JSON.stringify(wfGoodCheck));
  check("⚠ ...and checking wrote nothing at all",
    Number(q(`select count(*) from agent.automations;`)) === wfWasAutos);

  // ⚠ SAVING IT. The steps that reach the database are `readWorkflow`'s OWN output, never
  // the model's list — and the row is read back to prove it.
  const wfMkArgs = { name: "Tone note", steps: wfGoodSteps, schedule: "manual" };
  const wfMade = await wfMakeTool.run(wfMkArgs, await wfCtx(wfMkArgs, 24));
  check("the agent creates an automation", wfMade?.ok === true && wfMade.steps === 2, JSON.stringify(wfMade));
  const wfNewAuto = q(`select coalesce(max(id::text), '') from agent.automations where tenant_id = '${A}' and name = 'Tone note';`);
  check("⚠ ...and THE ROW EXISTS, with this agent as its owner",
    wfNewAuto !== "" && q(`select agent_id from agent.automations where id = '${wfNewAuto}';`) === AG, wfNewAuto);
  // ⚠ THE STEP IDS ARE MINTED FROM THEIR POSITIONS BY `readWorkflow`, so reading them back is
  // how the row proves it holds the VALIDATED list and not the model's.
  const wfIds = () => (wfNewAuto === "" ? "(no row)"
    : q(`select jsonb_path_query_array(steps, '$[*].id')::text from agent.automations where id = '${wfNewAuto}';`));
  const wfWanted = JSON.stringify(readWorkflow(wfGoodSteps).steps.map((x) => x.id));
  check("⚠ ...holding the VALIDATED steps, with the ids `readWorkflow` itself mints",
    wfIds().replace(/\s+/g, "") === wfWanted.replace(/\s+/g, ""), `${wfIds()} vs ${wfWanted}`);
  check("⚠ ...and the agent can read back what it just wrote",
    (await (CAPABILITY_TOOLS.find((t) => t.name === "read_automation"))
      .run({ id: wfNewAuto }, await wfCtx({ id: wfNewAuto }, 25)))?.automation?.steps?.length === 2);

  // A REFUSED SAVE WRITES NOTHING — the validation is in front of the call, not beside it.
  const wfBadMake = { name: "Broken", steps: wfBadSteps };
  const wfWouldNot = await wfMakeTool.run(wfBadMake, await wfCtx(wfBadMake, 26));
  check("a create whose workflow does not read is refused whole",
    wfWouldNot?.ok === false && wfWouldNot.error === "bad-workflow", JSON.stringify(wfWouldNot));
  check("⚠ ...and no automation was made", q(`select count(*) from agent.automations where name = 'Broken';`) === "0");

  // CHANGING IT. The whole workflow is replaced, and the sibling wall is asked first.
  const wfChArgs = { id: wfNewAuto, name: "Tone note", steps: [{ type: "note", text: "Simpler." }] };
  const wfChanged = await wfChangeTool.run(wfChArgs, await wfCtx(wfChArgs, 27));
  // ⚠ RE-ANCHORED, NOT APPEASED: `change_automation` is a PATCH now, so its answer says WHICH
  // fields moved (`changed`) rather than how many steps the result has — a field that is gone
  // reads as `undefined === 1`, which is a working feature reported as broken. The property is
  // that the workflow really was among what changed, and the ROW is asserted on the next line.
  check("the agent changes its own automation", wfChanged?.ok === true
    && Array.isArray(wfChanged.changed) && wfChanged.changed.includes("steps") && wfChanged.changed.includes("name"),
    JSON.stringify(wfChanged));
  check("⚠ ...and the row holds the new workflow rather than both",
    q(`select jsonb_array_length(steps)::text from agent.automations where id = '${wfNewAuto}';`) === "1");
  const wfSibChange = { id: sibAuto.body.id, name: "Not mine", steps: [{ type: "note", text: "x" }] };
  const wfRefusedSib = await wfChangeTool.run(wfSibChange, await wfCtx(wfSibChange, 28));
  check("⚠ a SIBLING agent's automation cannot be rewritten, and nothing was written",
    wfRefusedSib?.ok === false && wfRefusedSib.error === "no-automation" &&
    q(`select name from agent.automations where id = '${sibAuto.body.id}';`) !== "Not mine",
    JSON.stringify(wfRefusedSib));

  // THE RETRY: the same create wfTwice is ONE automation, by the operation record.
  const wfTwice = await wfMakeTool.run(wfMkArgs, await wfCtx(wfMkArgs, 24));
  check("⚠ the same create delivered twice makes ONE automation",
    wfTwice?.ok === true && q(`select count(*) from agent.automations where name = 'Tone note';`) === "1",
    JSON.stringify(wfTwice));

  // ⚠ AND THE APPROVAL GATE IS THE LOOP'S, so it is proved through a real message. The
  // requirement is that scheduling or enabling persistent work follows the approval policy,
  // and the gate is on the TOOL rather than on its arguments — a gate a model could turn off
  // by writing `enabled: false` is not a gate.
  const wfGated = await ask(AG, "use make_automation name=Asked steps=[]");
  // ⚠ AN `awaiting-approval` RUN HAS NO STOP ENTRY, AND THAT IS THE PRODUCT BEING RIGHT: the
  // log is left OPEN so the delivery after somebody answers continues it. So the wall is read
  // where it really is — a pending request for THIS run, naming THIS tool — rather than from a
  // stop reason that deliberately is not there.
  check("⚠ a create through the loop STOPS for a person",
    q(`select coalesce(string_agg(tool, ','), '(none)') from agent.tool_approvals
        where run_id = '${wfGated.body.runId}' and verdict is null;`) === "make_automation",
    q(`select coalesce(string_agg(tool || '/' || coalesce(verdict, 'pending'), ','), '(none)')
        from agent.tool_approvals where run_id = '${wfGated.body.runId}';`));
  check("⚠ ...and nothing was created while it waited",
    q(`select count(*) from agent.automations where name = 'Asked';`) === "0");
  const wfLetIt = await decide(AG, wfGated.body.runId, "approved");
  check("a person approves it", wfLetIt?.said?.verdict === "approved", JSON.stringify(wfLetIt?.said).slice(0, 120));
  check("⚠ ...and only THEN does the tool run", calledTool(wfGated.body.runId) === "make_automation",
    calledTool(wfGated.body.runId));

  // ═════════════════════════════════════════════════════════════════════════
  console.log("\n6. ⚠ A TOOL NOBODY TICKED IS NOT A TOOL THIS AGENT HAS");
  // ═════════════════════════════════════════════════════════════════════════
  const plain = await api("/api/agent/create", { body: { name: "No tools", instructions: "Just talk." } });
  const PLAIN = plain.body.agent.id;
  const tried = await ask(PLAIN, "use remember name=x value=y");
  const pRun = tried.body.runId;
  check("an agent with nothing ticked calls no tool at all",
    q(`select count(*) from agent.run_entries where run_id = '${pRun}' and body ->> 'kind' = 'tool';`) === "0");
  check("...and it answers rather than failing", /\[simulated\]/.test(answer(pRun)));
  check("⚠ ...and NOTHING was remembered for it",
    q(`select count(*) from agent.agent_memory where agent_id = '${PLAIN}';`) === "0");

  // AND THE SELECTION IS A SUBSET, not all or nothing.
  const oneTool = await api("/api/agent/create", {
    body: { name: "One tool", instructions: "Just search.", tools: ["search_reference"] },
  });
  const ONE = oneTool.body.agent.id;
  const wrong = await ask(ONE, "use remember name=x value=y");
  check("⚠ an agent holding ONE tool cannot call another, whatever the request asks for",
    calledTool(wrong.body.runId) !== "remember", calledTool(wrong.body.runId) || "(none)");
  check("...and nothing was remembered for it either",
    q(`select count(*) from agent.agent_memory where agent_id = '${ONE}';`) === "0");

  // ═════════════════════════════════════════════════════════════════════════
  console.log("\n7. ⚠ THE SAME OPERATION, PROVED BY ITS OUTCOME RATHER THAN BY ITS SOURCE");
  // ═════════════════════════════════════════════════════════════════════════
  // THE MILESTONE'S WORDING IS *"using the same underlying operations as the frontend"*,
  // and the two live in different Workers with neither able to import the other. So the
  // claim cannot be made by comparing code — it is made by doing the same thing BOTH
  // WAYS and showing the rows are indistinguishable.
  const EQ = `select coalesce(string_agg(key || '=' || value || ' v' || version || ' ' || source, '|' order by key), '(none)')
                from agent.agent_memory where agent_id = '${AG}';`;
  // clear the ground so the two halves start from the same state
  q(`delete from agent.agent_memory where agent_id = '${AG}';`);

  await api("/api/agent/memory-save", { body: { agent: AG, name: "same_test", value: "one" } });
  const byPerson = q(EQ);
  q(`delete from agent.agent_memory where agent_id = '${AG}';`);
  await ask(AG, "use remember name=same_test value=one");
  const byAgent = q(EQ);
  check("⚠ a person and their agent saving one fact leave the SAME row, but for who said so",
    byPerson === "same_test=one v1 person" && byAgent === "same_test=one v1 run",
    `${byPerson}  /  ${byAgent}`);

  // AND THE CORRECTION RULE IS ONE RULE: saving the same words twice is one version,
  // whichever door it came through.
  await api("/api/agent/memory-save", { body: { agent: AG, name: "same_test", value: "one" } });
  check("...and saving the same words again is one version, through EITHER door",
    q(`select version::text from agent.agent_memory where agent_id = '${AG}' and key = 'same_test';`) === "1");
  await ask(AG, "use remember name=same_test value=two");
  await api("/api/agent/memory-save", { body: { agent: AG, name: "same_test", value: "three" } });
  check("...and each real change moves it by exactly one, through either",
    q(`select version::text from agent.agent_memory where agent_id = '${AG}' and key = 'same_test';`) === "3");

  // AND THE READS AGREE. The screen's route and the agent's tool are asked the same
  // question about the same account and must answer the same names.
  const screenSees = (await api("/api/agent/knowledge", { query: { agent: AG } })).body.sources.map((k) => k.title).sort();
  const agentSees = toolResult((await ask(AG, "use list_reference")).body.runId).sources.map((k) => k.title).sort();
  check("⚠ the screen and the agent see the same reference sources, by name",
    JSON.stringify(screenSees) === JSON.stringify(agentSees) && screenSees.length > 0,
    `${JSON.stringify(screenSees)} / ${JSON.stringify(agentSees)}`);

  const screenAutos = (await api("/api/agent/automations", { query: { agent: AG } })).body.automations.map((a) => a.name).sort();
  const agentAutos = toolResult((await ask(AG, "use list_automations")).body.runId).automations.map((a) => a.name).sort();
  check("⚠ ...and the same automations",
    JSON.stringify(screenAutos) === JSON.stringify(agentAutos) && screenAutos.length > 0,
    `${JSON.stringify(screenAutos)} / ${JSON.stringify(agentAutos)}`);

  // ═════════════════════════════════════════════════════════════════════════
  console.log("\n7b. SAYING NO, AND WHAT THAT LEAVES BEHIND");
  // ═════════════════════════════════════════════════════════════════════════
  // ⚠ THE OTHER HALF, AND APPROVING EVERYTHING DOES NOT DEMONSTRATE IT. A rejection has
  // to leave the world exactly as it was AND reach the model as something it can answer
  // from — a refusal nobody is told about is a tool that will simply be asked for again.
  const wasOn = q(`select enabled::text from agent.automations where id = '${AUTO}';`);
  const refused = await askOk(AG, `use pause_automation id=${AUTO} enabled=false`, "rejected");
  check("a refused call answers the model rather than crashing the run",
    toolResult(refused.body.runId)?.error === "rejected",
    JSON.stringify(toolResult(refused.body.runId)).slice(0, 160));
  check("⚠ ...and THE ROW IS EXACTLY AS IT WAS — the call never happened",
    q(`select enabled::text from agent.automations where id = '${AUTO}';`) === wasOn, wasOn);
  check("⚠ ...and the run FINISHED rather than being stranded",
    q(`select coalesce(stop ->> 'reason','-') from agent.runs where id = '${refused.body.runId}';`) === "answered");
  check("⚠ ...and the refusal reached the model, so it can say why",
    q(`select count(*) from agent.run_entries where run_id = '${refused.body.runId}'
        and body ->> 'kind' = 'tool' and body -> 'value' ->> 'say' like '%declined%';`) === "1");
  // ⚠ THE FIRST DECISION STANDS, driven against the live function: pressing again reads
  // the winner's answer back rather than replacing it.
  const pressedTwice = await api("/api/agent/tool-approve", { body: { id: refused.approval.row.id, verdict: "approved" } });
  check("⚠ a second press re-reads the first decision rather than overturning it",
    pressedTwice.body.repeat === true && pressedTwice.body.verdict === "rejected",
    JSON.stringify(pressedTwice.body).slice(0, 160));

  // ═════════════════════════════════════════════════════════════════════════
  console.log("\n7c. AND EVERY ONE OF THOSE REQUESTS NAMED ITS SCHEMA THE WAY PostgREST DEMANDS");
  // ═════════════════════════════════════════════════════════════════════════
  // ⚠ **THIS SECTION EXISTS BECAUSE THIS DEMONSTRATION ONCE PASSED 78 CHECKS OVER A STORE
  // THAT COULD NOT HAVE WORKED.** `Accept-Profile` is honoured on GET and HEAD only, and
  // every PostgREST RPC is a POST — so ten of the fourteen capability operations named no
  // schema at all, `read_automation` (the pre-check `pause_automation` and
  // `run_automation` each make FIRST) among them. The shim read the path and ignored the
  // headers, so it answered every one of them happily. *A stand-in more permissive than
  // the thing it stands in for hides a defect exactly as well as one that is less.*
  //
  // So the shim enforces the rule now, and this reads its refusal counter — which is a
  // NEGATIVE assertion, and therefore worth nothing until the gate is proved alive IN THIS
  // PROCESS. Both probes are below, and the second is the control: a gate that refused
  // everything would satisfy the first on its own.
  const askRest = async (method, p2, extra) => {
    const r = await fetch(`${rest.url}/rest/v1/${p2}`, {
      method,
      headers: { apikey: "local-service-role", authorization: "Bearer local-service-role", "content-type": "application/json", ...extra },
      body: method === "GET" ? undefined : "{}",
    });
    let b = null; try { b = JSON.parse(await r.text()); } catch { /* not json */ }
    return { status: r.status, code: b?.code ?? null };
  };
  const refusedBefore = rest.refusedProfiles();
  check("⚠ every request the whole demonstration made named its schema correctly",
    refusedBefore === 0, `the gate turned away ${refusedBefore}`);
  const theDefect = await askRest("POST", "rpc/read_automation", { "accept-profile": "agent" });
  check("⚠ ...and the gate is ALIVE: the old defect — the read header on a POST — is refused here",
    theDefect.status === 404 && theDefect.code === "PGRST202", `${theDefect.status} ${theDefect.code}`);
  const theControl = await askRest("POST", "rpc/read_automation", { "content-profile": "agent" });
  check("⚠ ...and it is not refusing everything: the same call with the write header passes the gate",
    theControl.code !== "PGRST202" && theControl.code !== "PGRST205", `${theControl.status} ${theControl.code}`);
  check("...so the gate turned away exactly the one request this section sent at it",
    rest.refusedProfiles() === refusedBefore + 1, `${rest.refusedProfiles()}`);

  // ═════════════════════════════════════════════════════════════════════════
  console.log("\n8. WHAT THE WHOLE RUN LEFT BEHIND");
  // ═════════════════════════════════════════════════════════════════════════
  check("every run finished", q(`select count(*) from agent.runs where stop is null;`) === "0");
  check("nothing was left claimed", q(`select count(*) from agent.run_work where done_at is null;`) === "0");
  check("⚠ no run anywhere attempted more than once",
    q(`select count(*) from agent.run_work where attempts > 1;`) === "0");
  // ⚠ THE ACCOUNT NEXT DOOR IS UNTOUCHED — measured, not assumed.
  check("⚠ the account next door has exactly what it started with, and nothing of ours",
    q(`select count(*) from agent.agent_memory where tenant_id = '${B}';`) === "0" &&
    q(`select count(*) from agent.agent_knowledge where tenant_id = '${B}';`) === "1" &&
    q(`select count(*) from agent.automations where tenant_id = '${B}';`) === "1");
  // ⚠ TWO VALUES, AND BOTH ARE RIGHT: a CONVERSATION runs on the stand-in and an
  // AUTOMATION EXECUTION has no model at all. The property is that nothing ELSE appears —
  // asserting one value would have been asserting that automations do not exist.
  const kinds = q(`select coalesce(string_agg(distinct model, ',' order by model), '-') from agent.runs;`);
  check("⚠ and no provider was reached anywhere: every run is the stand-in or has no model",
    kinds === "none,stand-in", kinds);
  check("...with the conversations on the stand-in and the automation executions on neither",
    q(`select count(*) from agent.runs where model = 'stand-in';`) !== "0" &&
    q(`select count(*) from agent.runs r join agent.automation_runs a on a.id = r.id where r.model <> 'none';`) === "0");
  // ⚠ A CENSUS, NOT A COUNT. Every tool this platform offers must really have been
  // called somewhere above — otherwise a tool added next month is demonstrated by nobody
  // and the silence reads exactly like coverage.
  const called = q(`select coalesce(string_agg(distinct body ->> 'name', ','), '') from agent.run_entries where body ->> 'kind' = 'tool';`).split(",").filter(Boolean);
  /**
   * ⚠ **THREE TOOLS CANNOT BE CALLED BY THE STAND-IN, AND THE SET IS DECLARED RATHER THAN
   * WORKED AROUND.**
   *
   * `make_automation`, `change_automation` and `check_workflow` take a LIST OF OBJECTS. The
   * stand-in fills a tool's declared schema from the words of a request — which is what makes
   * it model-LIKE rather than scripted — and it cannot compose a nested workflow from a
   * sentence. So section 5c drives those three directly against the real store, with a real
   * `ctx`, and `make_automation` is ALSO driven through a real message to prove the approval
   * gate (which lives in the loop, not in the tool).
   *
   * Naming them here is the point: a tool moved onto this list is a deliberate edit with a
   * reason, where silently widening the census to "called somehow" would let a tool nobody
   * demonstrates slip in behind it. And the assertion below still requires each of them to
   * have really run — through a direct drive, whose evidence is the ROW each one left.
   */
  const NOT_FROM_THE_STAND_IN = ["check_workflow", "make_automation", "change_automation"];
  /**
   * ⚠ **THE THREE THAT REACH OUTSIDE ARE DEMONSTRATED IN `verify:connections`, AND THE LIST
   * IS THE ENGINE'S OWN RATHER THAN TYPED HERE.** They are not on the list above — the
   * stand-in composes them perfectly well, they take strings — they are simply about
   * something this file does not stand up: a stored credential and a provider adapter.
   * Duplicating that scaffolding would be two copies of one fixture, and the copy that
   * drifts is the one deciding whether a credential can leak.
   *
   * **AND THE OTHER HALF IS NOT WEAKENED BY IT**: `verify:connections` carries the same
   * census for exactly these three, driven by a real model through real messages, so a
   * connection tool nobody demonstrates fails there instead of slipping through here.
   * `CONNECTION_TOOLS` is imported, so a name cannot be exempted by being misspelled.
   */
  const never = TOOLS.filter((n) => !called.includes(n)
    && !NOT_FROM_THE_STAND_IN.includes(n) && !CONNECTION_TOOLS.includes(n));
  check("⚠ EVERY capability tool the stand-in can compose was really called by it",
    never.length === 0, never.length ? `never called: ${never.join(", ")}` : `${called.length} of ${TOOLS.length}`);
  // ⚠ AND THE OBSERVER FOR THE OTHER THREE IS THEIR OWN EFFECT, not a claim that they ran:
  // the automation section 5c wrote, and the fact that the model really reached
  // `make_automation` once a person approved it.
  check("⚠ ...and the three the stand-in cannot compose left their own evidence",
    q(`select count(*) from agent.automations where name = 'Tone note';`) === "1" &&
    q(`select jsonb_array_length(steps)::text from agent.automations where name = 'Tone note';`) === "1" &&
    called.includes("make_automation"),
    `Tone note steps=${q(`select coalesce(max(jsonb_array_length(steps))::text, '-') from agent.automations where name = 'Tone note';`)}, model reached make_automation: ${called.includes("make_automation")}`);
  // THE LIST IS NOT A LOOPHOLE: every name on it must be a real tool, so a typo cannot
  // exempt a tool that does not exist and quietly excuse one that does.
  for (const n of NOT_FROM_THE_STAND_IN) check(`⚠ ...and "${n}" is a real tool rather than an excuse`, TOOLS.includes(n));
  for (const n of CONNECTION_TOOLS) check(`⚠ ...and "${n}" is a real tool, demonstrated in verify:connections`, TOOLS.includes(n));

  console.log(failed ? `\n${failed} FAILED:\n  ${fails.join("\n  ")}` : "\nall checks passed");
} finally {
  await stack.tearDown();
}
process.exit(failed ? 1 : 0);
