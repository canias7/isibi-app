#!/usr/bin/env node
/**
 * EXPIRY, REVOCATION AND CANCELLATION — one demonstration, end to end.
 * `npm run verify:controls`.
 *
 * **THE REQUIREMENT IS FOUR SEPARATE THINGS AND THE WHOLE POINT IS THAT THEY STAY
 * SEPARATE**: *"Expired, rejected, or revoked approvals cannot execute. Keep accepted runs'
 * recorded configuration stable, but define explicit permission revocation separately and
 * enforce it before subsequent actions. Cancellation must stop pending work and future
 * steps, release waits, and record what already completed. Don't claim completed effects
 * were undone."*
 *
 * So the checks below are about the DIFFERENCES as much as the behaviours: a closed window
 * against a refusal, a withheld permission against an unticked one, and a cancelled run
 * against a run that was rolled back — which is the one this file is most careful about,
 * because nothing here rolls anything back.
 *
 * Every piece is the real one, and `scripts/lib/local-stack.mjs` is the only fixture:
 *
 *   * the SITE BUILDER's routes (`handleAgentApi`) for everything a person does — writing
 *     the agent, sending the message, answering, withdrawing, revoking, cancelling;
 *   * the DATABASE — a throwaway PostgreSQL with this repository's migrations applied, so
 *     every window, filter and constraint is genuine;
 *   * the DISPATCHER — `worker.queue` and `worker.scheduled`, the Worker's own handlers,
 *     which claim through `claim_run`, read the snapshot, subtract the revocations and run
 *     the loop. **Driven rather than replaced on purpose**: the live read of what has been
 *     revoked is a wiring hop, and this repository keeps paying for those.
 *
 * ── ⚠ WHAT IS SIMULATED, AND IT IS THREE THINGS ──────────────────────────────
 *
 * The MODEL (`makeStandIn`, which reads the tools it was offered and fills the named one's
 * own schema — no paid call is made and none can be), the TRANSPORT (PostgREST is a local
 * shim and the queue an in-process doorbell, because neither is reachable from a laptop;
 * durability is unchanged, because the work is a ROW), and **THE CLOCK, in exactly one
 * place and declared where it happens**: an approval window is 24 hours, so one UPDATE
 * moves `expires_at` into the past. The alternative is a check nobody re-runs. What that
 * does NOT simulate is the DECISION — every reader still compares `expires_at` against
 * `now()` itself.
 *
 * ⚠ NOT A STATEMENT ABOUT THE DEPLOYMENT. Nothing here touches the hosted project.
 */

import { handleAgentApi, makeAgentStore } from "../../agent-store.mjs";
import worker from "../src/worker.mjs";
import { haveCluster, standUp, dispatcher } from "./lib/local-stack.mjs";
import { CAPABILITY_TOOLS } from "../src/capability-tools.mjs";

const DB = `agent_controls_${process.pid}`;
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
  const first = dispatcher({ worker, rest });
  const { drain, ring, tick } = first;

  let press = 0;
  /** Send one message and let the consumer run it, the way a person pressing send does. */
  const ask = async (agent, words, tenant = A) => {
    const sent = await api("/api/agent/send", { tenant, body: { id: agent, body: words, key: `press-${++press}` }, ring });
    await drain();
    return sent;
  };
  /** Deliver the run again, exactly as a redelivery or the sweeper's re-ring would. */
  const again = async (runId) => { await ring(runId); await drain(); };
  /** What is waiting for a person, read through the SITE'S own route — what the screen reads. */
  const waitingOn = async (runId, tenant = A) =>
    ((await api("/api/agent/tool-approvals", { tenant, query: {} })).body.approvals || [])
      .find((r) => r.run === runId) || null;

  const status = (runId) => q(`select status from agent.runs where id = '${runId}';`);
  const stopOf = (runId) => JSON.parse(q(`select coalesce(stop::text, 'null') from agent.runs where id = '${runId}';`));
  const answer = (runId) => q(`select coalesce(stop ->> 'text', '') from agent.runs where id = '${runId}';`);
  const toolResults = (runId) => q(`select coalesce(string_agg((body -> 'value')::text, '|~|' order by seq), '')
     from agent.run_entries where run_id = '${runId}' and body ->> 'kind' = 'tool';`)
    .split("|~|").filter(Boolean).map((t) => JSON.parse(t));
  const ranTool = (runId) => q(`select count(*) from agent.run_entries
     where run_id = '${runId}' and body ->> 'kind' = 'tool' and (body -> 'value' -> 'ok')::text = 'true';`);
  /**
   * ⚠ THE CLOCK, MOVED IN ONE PLACE AND NOWHERE ELSE. A window is 24 hours and a check
   * nobody re-runs proves nothing; what this does not touch is the comparison, which every
   * reader still makes against `now()` for itself.
   */
  const closeTheWindow = (runId) => q(`update agent.tool_approvals set expires_at = now() - interval '1 minute'
     where run_id = '${runId}' and verdict is null returning 1;`);

  const TOOLS = CAPABILITY_TOOLS.map((t) => t.name);

  // ═════════════════════════════════════════════════════════════════════════
  console.log("\n1. AN AGENT, ITS AUTOMATION, AND THE ACCOUNT NEXT DOOR");
  // ═════════════════════════════════════════════════════════════════════════
  const made = await api("/api/agent/create", {
    body: { name: "Workshop", instructions: "Answer about the workshop.", tools: TOOLS },
  });
  check("an agent is written with every tool ticked", made.status === 200, JSON.stringify(made.body).slice(0, 160));
  const AG = made.body.agent.id;
  const auto = await api("/api/agent/automation-create", {
    body: { agent: AG, name: "Nightly", steps: [{ type: "note", text: "went round" }], schedule: "manual", enabled: true },
  });
  check("...and an automation for its gated tools to act on", auto.status === 200, JSON.stringify(auto.body).slice(0, 160));
  const AUTO = auto.body.id;

  const theirs = await api("/api/agent/create", {
    tenant: B, body: { name: "Next door", instructions: "Theirs.", tools: TOOLS },
  });
  const THEIR_AG = theirs.body.agent.id;

  // ═════════════════════════════════════════════════════════════════════════
  console.log("\n2. ⚠ A WINDOW THAT CLOSES: NOBODY ANSWERED, SO NOTHING WAS DECIDED");
  // ═════════════════════════════════════════════════════════════════════════
  const held = await ask(AG, `use pause_automation id=${AUTO} enabled=false`);
  const R_EXP = held.body.runId;
  // ⚠ A HOLDING RUN HAS **NO STOP ENTRY AT ALL**, deliberately — the log is left OPEN so the
  // delivery after the decision resumes from it — so "it is holding" is read as a run with no
  // stop and a request waiting, never off `stop`. `stop ->> 'reason'` is null here and a check
  // written against it would report the design as a defect.
  check("a gated call holds the run and puts a request to a person",
    status(R_EXP) === "running" && stopOf(R_EXP) === null && (await waitingOn(R_EXP)) !== null,
    `${status(R_EXP)} ${JSON.stringify(stopOf(R_EXP))}`);
  check("...and the request carries a window to answer in",
    q(`select (expires_at is not null)::text from agent.tool_approvals where run_id = '${R_EXP}';`) === "true");
  check("...and nothing has run", ranTool(R_EXP) === "0");

  check("the window closes", closeTheWindow(R_EXP) === "1");
  // ⚠ THE SCREEN STOPS OFFERING IT, because a closed window is not waiting for anybody —
  // and `decide_tool_approval` really does refuse it, so the screen and the wall agree.
  check("⚠ an expired request is no longer offered as something to answer",
    (await waitingOn(R_EXP)) === null);
  // ⚠ **A PLAIN REDELIVERY IS NOT ENOUGH, AND THAT IS THE FINDING THIS SECTION BOUGHT.** A run
  // waiting for a person has its work row marked DONE — there is nothing to redeliver until
  // somebody answers — and `decide_tool_approval` is what puts it back. Nobody deciding means
  // nothing putting it back: MEASURED, a ring answered `not-claimable` and the run sat reading
  // as `running` for ever with a refusal that was correct and unreachable. The cron's fourth
  // job is what ends it, so the check drives the cron rather than a ring.
  const beforeSweep = await ring(R_EXP).then(() => drain());
  check("⚠ a plain redelivery does NOTHING — the work row is done, which is why a sweep is needed",
    status(R_EXP) === "running" && stopOf(R_EXP) === null,
    `${status(R_EXP)} after ${beforeSweep.length} delivery`);
  await tick();
  await drain();
  const expOut = toolResults(R_EXP);
  check("⚠ the run FINISHES rather than holding for ever — a closed window is an answer",
    stopOf(R_EXP)?.reason === "answered" && status(R_EXP) === "stopped", JSON.stringify(stopOf(R_EXP)));
  check("⚠ ...and the call did NOT run", ranTool(R_EXP) === "0" && expOut.length === 1 && expOut[0].ok === false,
    JSON.stringify(expOut).slice(0, 200));
  check("⚠ ...and the MODEL IS TOLD the window closed, not that somebody said no",
    expOut[0].error === "expired" && /asked again/.test(expOut[0].say) && !/declined/.test(expOut[0].say),
    expOut[0].say);
  check("the answer the customer reads is labelled simulated", /\[simulated\]/.test(answer(R_EXP)));
  // ⚠ AND THE PERSON COMING BACK THE NEXT MORNING CANNOT APPROVE IT. This is the requirement
  // in as many words, through the route a button really presses.
  const lateId = q(`select id::text from agent.tool_approvals where run_id = '${R_EXP}';`);
  const late = await api("/api/agent/tool-approve", { body: { id: lateId, verdict: "approved" }, ring });
  check("⚠ an expired request cannot be approved afterwards, through the real route",
    late.status !== 200, `${late.status} ${JSON.stringify(late.body).slice(0, 120)}`);
  check("...and the row is still undecided, because expiry is the CLOCK's answer and not a verdict",
    q(`select coalesce(verdict, 'NULL') from agent.tool_approvals where run_id = '${R_EXP}';`) === "NULL");
  // ⚠ **AND IT SAYS WHY, WHICH IS WHAT THIS CHECK USED TO ASSERT THE OPPOSITE OF.** It demanded
  // a 404 — *"that request isn't waiting any more"* — which is FALSE of an expired request: it is
  // still there, and the window closed. `agent.decide_tool_approval` has answered three distinct
  // refusals all along (`no-request`, `expired`, `revoked-permission`) and the route collapsed
  // them, so a person who missed the deadline and a person guessing an id read the same sentence.
  // Re-anchored onto the property rather than the status: it cannot be approved, AND it names
  // which of the three it was, AND the two are distinguishable from each other.
  check("⚠ ...and the refusal NAMES the closed window rather than saying the request is gone",
    late.status === 409 && late.body.expired === true && /answered that in time/.test(late.body.error) &&
    !/isn't waiting any more/.test(late.body.error),
    `${late.status} ${JSON.stringify(late.body).slice(0, 200)}`);
  check("⚠ ...and it says what to do instead, which a person can act on",
    /ask the agent for it again/.test(late.body.error), late.body.error);
  // THE CONTROL, and it is what makes the sentence above mean anything: an id that is not a
  // request of this account's is still the 404 it should be, with no `expired` flag on it.
  const guessed = await api("/api/agent/tool-approve", {
    body: { id: "dddddddd-9999-4999-8999-dddddddddddd", verdict: "approved" }, ring,
  });
  check("⚠ ...while an id nobody owns is still NOT FOUND, never forbidden and never expired",
    guessed.status === 404 && guessed.body.expired === undefined &&
    /isn't waiting any more/.test(guessed.body.error),
    `${guessed.status} ${JSON.stringify(guessed.body).slice(0, 160)}`);

  // ⚠ **AND THE THIRD REFUSAL, WHICH ONLY A RACE CAN PRODUCE THROUGH THE ROUTES.**
  // `revoke_agent_tool` withdraws every pending request for the tool, and `decide_tool_approval`
  // asks the repeat check FIRST — so a press after a revocation answers the WITHDRAWAL, and
  // `revoked-permission` is the declared second wall for the row a revocation RACED. The state
  // is produced by putting the revocation in as the OWNER, which is what the race leaves behind;
  // that is the one thing simulated here, and it is the state rather than the decision.
  const raced = await ask(AG, `use pause_automation id=${AUTO} enabled=false`);
  const racedRow = await waitingOn(raced.body.runId);
  check("a request is waiting with its tool still permitted", racedRow !== null);
  q(`insert into agent.tool_revocations (tenant_id, agent_id, tool, revoked_by)
       values ('${A}', '${AG}', 'pause_automation', '${A}');`);
  const blocked = await api("/api/agent/tool-approve", { body: { id: racedRow.id, verdict: "approved" }, ring });
  check("⚠ a call whose permission has gone cannot be approved, and the refusal says SO",
    blocked.status === 409 && blocked.body.revoked === true &&
    /permission for that was taken away/.test(blocked.body.error),
    `${blocked.status} ${JSON.stringify(blocked.body).slice(0, 200)}`);
  check("⚠ ...and it names the tool, because the remedy is to restore THAT one",
    blocked.body.tool === "pause_automation", JSON.stringify(blocked.body.tool));
  check("⚠ ...and the three refusals really are three sentences a person can tell apart",
    new Set([late.body.error, guessed.body.error, blocked.body.error]).size === 3);
  check("...and nothing was decided on that row either",
    q(`select coalesce(verdict, 'NULL') from agent.tool_approvals where id = '${racedRow.id}';`) === "NULL");
  // AND THE STATE IS PUT BACK, because the sections below need that tool. A revocation put in by
  // hand comes out by hand: the route would be a second act this section is not about.
  q(`delete from agent.tool_revocations where agent_id = '${AG}' and tool = 'pause_automation';`);
  check("the permission is put back for the sections below",
    q(`select count(*) from agent.tool_revocations where agent_id = '${AG}';`) === "0");

  // ═════════════════════════════════════════════════════════════════════════
  console.log("\n3. ⚠ WITHDRAWING ONE REQUEST IS NOT REJECTING IT");
  // ═════════════════════════════════════════════════════════════════════════
  const w = await ask(AG, `use pause_automation id=${AUTO} enabled=false`);
  const R_W = w.body.runId;
  const wRow = await waitingOn(R_W);
  check("a second gated call is waiting", wRow !== null);
  const took = await api("/api/agent/tool-withdraw", { body: { id: wRow.id, note: "asked by mistake" }, ring });
  check("a person takes the request back, without deciding it", took.status === 200 && took.body.withdrawn === true,
    JSON.stringify(took.body).slice(0, 160));
  check("...and the run was rung, so nothing waits for the sweeper", took.body.notified === true);
  await drain();
  const wOut = toolResults(R_W);
  check("⚠ the run carries on and the call did not happen",
    stopOf(R_W)?.reason === "answered" && ranTool(R_W) === "0", JSON.stringify(stopOf(R_W)));
  check("⚠ ...and the model is told the AUTHORITY was withdrawn, not that a person declined",
    wOut[0]?.error === "revoked" && /withdrawn/.test(wOut[0].say) && !/declined/.test(wOut[0].say),
    wOut[0]?.say);
  // ⚠ AND PRESSING APPROVE AFTERWARDS DOES NOT APPROVE IT — it answers the withdrawal, which
  // is the decision that stands. A 404 was the first draft's guess and the product is right:
  // *the first decision stands*, the withdrawal was one, and a person who presses late is told
  // whose answer it was rather than being shown their own. Two facts, two answers: an EXPIRED
  // request is a 409 naming the closed window (nothing was decided at all — section 2), a
  // withdrawn one is this.
  const pressedLate = await api("/api/agent/tool-approve", { body: { id: wRow.id, verdict: "approved" }, ring });
  check("⚠ ...and pressing approve afterwards answers the WITHDRAWAL rather than approving it",
    pressedLate.status === 200 && pressedLate.body.repeat === true && pressedLate.body.verdict === "revoked",
    `${pressedLate.status} ${JSON.stringify(pressedLate.body).slice(0, 160)}`);
  check("...and the call still never ran", ranTool(R_W) === "0");
  // ⚠ THREE REFUSALS, THREE SENTENCES, all three read off real runs. If any two shared a
  // sentence a customer could not tell why their agent stopped short.
  const rej = await ask(AG, `use pause_automation id=${AUTO} enabled=false`);
  const rejRow = await waitingOn(rej.body.runId);
  await api("/api/agent/tool-approve", { body: { id: rejRow.id, verdict: "rejected", note: "not tonight" }, ring });
  await drain();
  const rejOut = toolResults(rej.body.runId);
  check("⚠ a rejection says a PERSON declined it, and carries their words",
    rejOut[0]?.error === "rejected" && /not tonight/.test(rejOut[0].say), rejOut[0]?.say);
  check("⚠ ...so the three refusals really are three different sentences",
    new Set([expOut[0].say, wOut[0].say, rejOut[0].say]).size === 3);

  // ═════════════════════════════════════════════════════════════════════════
  console.log("\n4. ⚠ TAKING A TOOL AWAY — ENFORCED BEFORE THE NEXT ACTION OF A RUN ALREADY GOING");
  // ═════════════════════════════════════════════════════════════════════════
  const live = await ask(AG, `use pause_automation id=${AUTO} enabled=false`);
  const R_REV = live.body.runId;
  check("a run is waiting for a person again", (await waitingOn(R_REV)) !== null);
  // ⚠ `ring` IS HANDED IN, because this route really does ring: it has just answered a waiting
  // request instead of a person, so the run it answered has to be delivered. The first draft
  // omitted it and read `notified: 0` — the route being right about a caller that gave it no
  // doorbell, which is the honest failure a missing argument should produce.
  const gone = await api("/api/agent/tool-revoke", {
    body: { agent: AG, tool: "pause_automation", note: "not this agent" }, ring,
  });
  check("a person takes the tool away through their own route", gone.status === 200, JSON.stringify(gone.body).slice(0, 160));
  check("⚠ ...and it says the waiting request was taken back with it",
    gone.body.withdrew >= 1 && /taken back/.test(gone.body.say), JSON.stringify(gone.body).slice(0, 200));
  check("⚠ the request really is withdrawn, so nobody can approve a call that may not happen",
    q(`select verdict from agent.tool_approvals where run_id = '${R_REV}';`) === "revoked" &&
    (await waitingOn(R_REV)) === null);
  // ⚠ **AND THE RUN IS PUT BACK AND RUNG — MEASURED, AFTER IT WAS NOT.** The revocation has
  // answered that request instead of a person, so the run's work row has to be un-done or the
  // run waits for ever for a decision nobody can make. The first draft of `revoke_agent_tool`
  // withdrew the request and left the row: the run sat reading as `running` with nothing on
  // any screen. This is the same defect as the expiry sweep's, reached by a button.
  // ⚠ IT WITHDREW TWO, not one: `R_EXP`'s request is still undecided (nobody ever answered it
  // and expiry is not a verdict), so a revocation of that tool answers that one too. Correct,
  // and worth asserting as a `>=` rather than pinning a number this file's own earlier
  // sections decide.
  check("⚠ ...and every run it answered was put back and rung, rather than left stranded",
    gone.body.withdrew >= 1 && gone.body.notified === gone.body.withdrew,
    JSON.stringify(gone.body).slice(0, 200));
  check("the screen can read which tools are withheld",
    (await api("/api/agent/revoked-tools", { query: { agent: AG } })).body.revoked.join(",") === "pause_automation");

  await drain();
  const revOut = toolResults(R_REV);
  check("⚠ the run finishes and the withdrawn call never ran",
    stopOf(R_REV)?.reason === "answered" && ranTool(R_REV) === "0", JSON.stringify(stopOf(R_REV)));
  check("...and the model is told why", revOut[0]?.ok === false && /withdrawn/.test(revOut[0].say), revOut[0]?.say);

  // ⚠ AND THE NEXT RUN IS NOT EVEN OFFERED IT. Read off what the model was really handed.
  const after = await ask(AG, `use pause_automation id=${AUTO} enabled=false`);
  const R_AFTER = after.body.runId;
  const offered = JSON.parse(q(`select coalesce((body -> 'tools')::text, 'null') from agent.run_entries
     where run_id = '${R_AFTER}' and body ->> 'kind' = 'started';`));
  check("⚠ the SNAPSHOT still records the tool, because the tick was never changed",
    Array.isArray(offered) && offered.includes("pause_automation"), JSON.stringify(offered));
  // ⚠ ASKED ABOUT THE REVOKED TOOL BY NAME, not about whether ANY tool ran. The model is
  // offered the rest of the catalog and picks something else — which is the product being
  // right — so `ranTool === 0` was the first draft's mistake and would have been red for a
  // run behaving perfectly.
  const calledNames = q(`select coalesce(string_agg(body ->> 'name', ','), '') from agent.run_entries
     where run_id = '${R_AFTER}' and body ->> 'kind' = 'tool';`);
  check("⚠ ...and yet the run could not use it — the revocation is read LIVE, past the snapshot",
    !calledNames.split(",").includes("pause_automation") &&
    q(`select count(*) from agent.tool_approvals where run_id = '${R_AFTER}';`) === "0",
    `called: ${calledNames || "nothing"}`);
  check("⚠ ...and the tool was not even DESCRIBED to the model, so no plan was wasted on it",
    !JSON.parse(q(`select coalesce((body -> 'tools')::text, '[]') from agent.run_entries
       where run_id = '${R_AFTER}' and body ->> 'kind' = 'model' limit 1;`) || "[]")
      .some?.((t) => t?.name === "pause_automation"), "the model entry carries no tool list to read");

  // ⚠ **THE DISTINCTION THE REQUIREMENT ASKS FOR, SIDE BY SIDE AND IN ONE PLACE.** Unticking
  // a tool is a statement about what the NEXT run is accepted with, and must not reach a run
  // already going; revoking is a statement about what must stop, and must. Two acts, two
  // readers — and this is the only check in the file that can tell them apart.
  const untickRun = await ask(AG, `use run_automation id=${AUTO}`);
  const R_TICK = untickRun.body.runId;
  check("a run is waiting for a person on a tool nobody has revoked", (await waitingOn(R_TICK)) !== null);
  const unticked = await api("/api/agent/update", {
    body: { id: AG, name: "Workshop", instructions: "Answer about the workshop.",
            tools: TOOLS.filter((t) => t !== "run_automation") },
  });
  check("the person UNTICKS that tool in the settings form", unticked.status === 200 &&
    !q(`select array_to_string(tools, ',') from agent.agents where id = '${AG}';`).split(",").includes("run_automation"));
  const tickApproval = await waitingOn(R_TICK);
  check("⚠ unticking does NOT withdraw what was waiting — it is not a revocation",
    tickApproval !== null, JSON.stringify(tickApproval));
  await api("/api/agent/tool-approve", { body: { id: tickApproval.id, verdict: "approved" }, ring });
  await drain();
  check("⚠ ...and the run already accepted STILL RAN IT, from its own stable snapshot",
    ranTool(R_TICK) === "1" && stopOf(R_TICK)?.reason === "answered",
    `${ranTool(R_TICK)} ${JSON.stringify(stopOf(R_TICK))}`);
  check("⚠ ...while the REVOKED tool's run did not, on the same account, in the same database",
    ranTool(R_REV) === "0");

  // ⚠ AND THE TICK GOES BACK ON, because the section below needs that tool and an unticked one
  // is not a revoked one — which is the very distinction just proved. Without this the
  // stand-in is offered a different tool, picks it, and the cancellation section would be
  // about a run that finished on its own: MEASURED, it chose `list_reference` and answered.
  check("the tick is put back for the sections below",
    (await api("/api/agent/update", {
      body: { id: AG, name: "Workshop", instructions: "Answer about the workshop.", tools: TOOLS },
    })).status === 200 &&
    q(`select array_to_string(tools, ',') from agent.agents where id = '${AG}';`).split(",").includes("run_automation"));

  // ── LIFTING IT ────────────────────────────────────────────────────────────
  const back = await api("/api/agent/tool-restore", { body: { agent: AG, tool: "pause_automation" } });
  check("a revocation can be lifted", back.status === 200 && back.body.lifted === true, JSON.stringify(back.body).slice(0, 160));
  check("⚠ ...and the requests it withdrew STAY withdrawn — nobody is asked a question twice",
    q(`select verdict from agent.tool_approvals where run_id = '${R_REV}';`) === "revoked" &&
    /stays withdrawn/.test(back.body.say));
  const worksAgain = await ask(AG, `use pause_automation id=${AUTO} enabled=false`);
  check("...and the tool can be asked for again", (await waitingOn(worksAgain.body.runId)) !== null);

  // ── THE REFUSALS ──────────────────────────────────────────────────────────
  check("a tool no tool is called is refused by name, not stored",
    (await api("/api/agent/tool-revoke", { body: { agent: AG, tool: "teleport" } })).status === 400 &&
    q(`select count(*) from agent.tool_revocations where agent_id = '${AG}';`) === "0");
  check("⚠ the account next door cannot take a tool away from this agent, and gets the missing-agent answer",
    (await api("/api/agent/tool-revoke", { tenant: B, body: { agent: AG, tool: "remember" } })).status === 404 &&
    q(`select count(*) from agent.tool_revocations where agent_id = '${AG}';`) === "0");
  check("...nor read what is revoked for it",
    (await api("/api/agent/revoked-tools", { tenant: B, query: { agent: AG } })).status === 404);

  // ═════════════════════════════════════════════════════════════════════════
  console.log("\n5. ⚠ CANCELLING A RUN: THE WORK STOPS AND WHAT RAN STAYS RUN");
  // ═════════════════════════════════════════════════════════════════════════
  const doomed = await ask(AG, `use run_automation id=${AUTO}`);
  const R_CAN = doomed.body.runId;
  // ⚠ IT HAS ALREADY DONE SOMETHING: one model call, and this run is holding on a second
  // gated call — so "what already completed" is a real number rather than zero.
  check("a run is part way through and waiting for a person",
    status(R_CAN) === "running" && stopOf(R_CAN) === null && (await waitingOn(R_CAN)) !== null &&
    Number(q(`select count(*) from agent.run_entries where run_id = '${R_CAN}' and body ->> 'kind' = 'model';`)) >= 1,
    `${status(R_CAN)} ${JSON.stringify(stopOf(R_CAN))}`);
  const stopped = await api("/api/agent/run-cancel", { body: { run: R_CAN, reason: "changed my mind" } });
  check("a person stops it through their own route", stopped.status === 200, JSON.stringify(stopped.body).slice(0, 200));
  // ⚠ **IT SAYS WHAT HAD ALREADY COMPLETED AND DOES NOT CLAIM IT WAS UNDONE.** The one
  // sentence this whole feature must get right.
  check("⚠ ...and it reports what had already completed",
    stopped.body.completedSteps >= 1, JSON.stringify(stopped.body).slice(0, 200));
  check("⚠ ...and says plainly that nothing already done was undone",
    /was not undone/.test(stopped.body.say), stopped.body.say);
  check("⚠ exactly one stop entry, naming the cancellation and who asked for it",
    q(`select count(*) from agent.run_entries where run_id = '${R_CAN}' and body ->> 'kind' = 'stopped';`) === "1" &&
    stopOf(R_CAN)?.reason === "cancelled" && stopOf(R_CAN)?.cancelledBy === A,
    JSON.stringify(stopOf(R_CAN)));
  check("⚠ the run reads as stopped, which is the LOG's own projection", status(R_CAN) === "stopped");
  check("⚠ PENDING WORK STOPS: the work row is released and marked done",
    q(`select (claimed_by is null and claim_token is null and done_at is not null)::text
         from agent.run_work where run_id = '${R_CAN}';`) === "true");
  check("⚠ and nothing is left on somebody's screen to answer",
    (await waitingOn(R_CAN)) === null &&
    q(`select verdict from agent.tool_approvals where run_id = '${R_CAN}';`) === "revoked");
  // ⚠ AND A DELIVERY AFTERWARDS DOES NOTHING — which is the half that says FUTURE STEPS stop
  // rather than merely that a row was marked.
  const entriesBefore = q(`select count(*) from agent.run_entries where run_id = '${R_CAN}';`);
  await again(R_CAN);
  await tick();
  await drain();
  check("⚠ a delivery after the cancellation adds nothing and runs nothing",
    q(`select count(*) from agent.run_entries where run_id = '${R_CAN}';`) === entriesBefore &&
    ranTool(R_CAN) === "0", `${entriesBefore} -> ${q(`select count(*) from agent.run_entries where run_id = '${R_CAN}';`)}`);
  const twice = await api("/api/agent/run-cancel", { body: { run: R_CAN, reason: "again" } });
  check("⚠ cancelling twice answers what really happened and writes no second ending",
    twice.status === 200 && twice.body.repeat === true && twice.body.alreadyStopped === true &&
    q(`select count(*) from agent.run_entries where run_id = '${R_CAN}' and body ->> 'kind' = 'stopped';`) === "1",
    JSON.stringify(twice.body).slice(0, 200));
  check("...and the first cancellation's words are the ones that stand",
    stopOf(R_CAN)?.note === "changed my mind");
  check("⚠ another account cannot stop this run, and is told there is no such run of theirs",
    (await api("/api/agent/run-cancel", { tenant: B, body: { run: R_CAN } })).status === 404);
  check("a finished run is not cancelled into something else",
    (await api("/api/agent/run-cancel", { body: { run: R_EXP } })).body.alreadyStopped === true &&
    stopOf(R_EXP)?.reason === "answered");

  // ── A SUSPENDED AUTOMATION ────────────────────────────────────────────────
  // ⚠ "RELEASE WAITS" IS ITS OWN REQUIREMENT AND ITS OWN CHECK: an execution suspended on a
  // wait has no work row to release, so the only thing that stops the resume tick waking it
  // is the wait being cleared.
  const waiter = await api("/api/agent/automation-create", {
    body: { agent: AG, name: "Waits", schedule: "manual", enabled: true,
            steps: [{ type: "wait", mode: "for", minutes: 30 }, { type: "note", text: "after" }] },
  });
  check("an automation that waits", waiter.status === 200, JSON.stringify(waiter.body).slice(0, 160));
  const ranWait = await api("/api/agent/automation-run", { body: { id: waiter.body.id }, ring });
  check("...is started", ranWait.status === 200, JSON.stringify(ranWait.body).slice(0, 160));
  await drain();
  // ⚠ `runId`, NOT `id`: the route answers the AUTOMATION's id as `id` and the execution's as
  // `runId`, and an execution is what is being cancelled. Read off the route rather than guessed.
  const W_RUN = ranWait.body.runId;
  check("...and is suspended on its wait",
    q(`select (waiting is not null and wait_until is not null)::text from agent.automation_runs where id = '${W_RUN}';`) === "true",
    String(W_RUN));
  const stoppedWait = await api("/api/agent/run-cancel", { body: { run: W_RUN, reason: "no longer needed" } });
  check("⚠ cancelling it RELEASES THE WAIT, so nothing wakes it later",
    stoppedWait.status === 200 && stoppedWait.body.releasedWait === true &&
    q(`select (waiting is null and wait_until is null and finished_at is not null)::text
         from agent.automation_runs where id = '${W_RUN}';`) === "true",
    JSON.stringify(stoppedWait.body).slice(0, 200));
  /**
   * ⚠ AND THE CRON CANNOT WAKE IT — for a reason STRONGER than "this tick did not".
   *
   * `resume_due_automations` selects on `waiting is not null and wait_until <= now()`, and the
   * cancellation cleared BOTH. The first draft of this check tried to push `wait_until` into
   * the past to prove the tick ignores it — and `automation_runs_wait_is_whole` REFUSED the
   * update, because a deadline with nothing waiting on it is not a state this table admits.
   * That refusal is the better evidence: a cancelled execution cannot be put back into the
   * selectable state at all, so the guarantee is the constraint's rather than the tick's.
   */
  const wEntries = q(`select count(*) from agent.run_entries where run_id = '${W_RUN}';`);
  let halfRestored = "it was ALLOWED";
  try {
    q(`update agent.automation_runs set wait_until = now() - interval '1 hour' where id = '${W_RUN}';`);
  } catch (e) { halfRestored = String(e?.stderr ?? e?.message ?? e); }
  check("⚠ a cancelled execution cannot be given back a deadline without a wait — the table refuses it",
    /automation_runs_wait_is_whole/.test(halfRestored), halfRestored.split("\n")[0].slice(0, 140));
  await tick();
  await drain();
  check("⚠ ...and the resume tick adds nothing to it",
    q(`select count(*) from agent.run_entries where run_id = '${W_RUN}';`) === wEntries,
    `${wEntries} entries`);

  // ═════════════════════════════════════════════════════════════════════════
  console.log("\n6. ⚠ A RESTART KEEPS A PENDING APPROVAL, AND SOMEBODY ELSE'S PROCESS ANSWERS IT");
  // ═════════════════════════════════════════════════════════════════════════
  // ⚠ **THE MILESTONE NAMES THIS AND NOTHING DEMONSTRATED IT FOR A TOOL CALL.** A workflow
  // step's approval survives a restart (`verify:wf`'s interruption matrix walks every
  // boundary) and a clarification does (`verify:conversation`), and the one a person meets
  // most — the banner above the message box — did not. It is a ROW, so it ought to be free;
  // *ought to be* is what this section replaces with a measurement.
  const surv = await ask(AG, `use pause_automation id=${AUTO} enabled=false`);
  const R_BOOT = surv.body.runId;
  const beforeBoot = await waitingOn(R_BOOT);
  check("a gated call is waiting for a person", beforeBoot !== null);
  check("...and nothing has run", ranTool(R_BOOT) === "0");

  // ⚠ **A BRAND-NEW DISPATCHER AND A BRAND-NEW STORE, which is what makes the assertion mean
  // anything.** Reusing the old ones leaves their memory in scope and the answer could have
  // come from anywhere; a fresh pair has seen nothing, so whatever the person is shown came
  // out of the database. The old doorbell is asserted EMPTY first — nothing is held open
  // across the restart, which is the property a deploy really has.
  // ⚠ **THIS CHECK ASSERTED NOTHING IN ITS FIRST DRAFT** — it read `stack.rungHas?.(…)`, a
  // method nothing has, so `!undefined` was `true` whatever the state was. *A negative
  // assertion is only worth what its observer is worth.* It reads the old doorbell's own
  // queue now, and the drain in `ask` above is what emptied it.
  check("⚠ the old process is holding nothing for this run — nothing is carried across the restart",
    Array.isArray(first.rung) && !first.rung.includes(R_BOOT), JSON.stringify(first.rung));
  const boot = dispatcher({ worker, rest });
  const apiAfter = (path, { tenant = A, body = {}, query = null, ring: r } = {}) => handleAgentApi({
    path, method: query ? "GET" : "POST",
    tenant, body, query: new URLSearchParams(query || {}),
    store: makeAgentStore({ fetch: (u, o) => fetch(u, o), url: rest.url, key: "local-service-role" }),
    ring: r, newId: () => `00000000-0000-4000-8000-${String(++minted).padStart(12, "0")}`, log: () => {},
  });
  const afterBoot = ((await apiAfter("/api/agent/tool-approvals", { query: {} })).body.approvals || [])
    .find((x) => x.run === R_BOOT) || null;
  check("⚠ the new process reads the SAME request waiting, out of the database",
    afterBoot !== null && afterBoot.id === beforeBoot.id, JSON.stringify(afterBoot));
  check("⚠ ...with the same arguments, so what is approved is what was proposed before the restart",
    JSON.stringify(afterBoot.args) === JSON.stringify(beforeBoot.args), JSON.stringify(afterBoot.args));
  check("⚠ ...and with its deadline, which is the field a person needs and the reader used to drop",
    typeof afterBoot.expiresAt === "string" && afterBoot.expiresAt === beforeBoot.expiresAt,
    String(afterBoot.expiresAt));

  const pressedAfter = await apiAfter("/api/agent/tool-approve",
    { body: { id: afterBoot.id, verdict: "approved" }, ring: boot.ring });
  check("a person approves it in the new process", pressedAfter.status === 200 &&
    pressedAfter.body.repeat === false, JSON.stringify(pressedAfter.body).slice(0, 160));
  await boot.drain();
  check("⚠ ...and the call runs, from the log alone — nothing was lost to the restart",
    ranTool(R_BOOT) === "1" && stopOf(R_BOOT)?.reason === "answered",
    `${ranTool(R_BOOT)} ${JSON.stringify(stopOf(R_BOOT))}`);
  check("⚠ ...exactly once, which is what `attempts` can say and a sentence cannot",
    q(`select count(*) from agent.run_entries where run_id = '${R_BOOT}'
         and body ->> 'kind' = 'tool';`) === "1");

  // ═════════════════════════════════════════════════════════════════════════
  console.log("\n7. WHAT ALL OF THAT LEFT BEHIND");
  // ═════════════════════════════════════════════════════════════════════════
  check("⚠ no run is left claimed by a worker that has gone",
    q(`select count(*) from agent.run_work where claimed_by is not null and done_at is null;`) === "0");
  /**
   * ⚠ **NO RUN IS LEFT WORKING WITH NOTHING TO WORK ON — and the check has to allow the one
   * honest exception.** A run really waiting for a person IS still running, and that is what
   * the screen's banner is for. What must never happen is a run reading as `running` with
   * nothing on anybody's screen and no work row to claim, which is exactly the shape both
   * defects in this round produced. So the census asks for that, not for "everything stopped"
   * — the first draft did, and was red about a run behaving correctly.
   */
  const stranded = q(`select coalesce(string_agg(r.id::text, ' '), '') from agent.runs r
     where r.status = 'running'
       and not exists (select 1 from agent.tool_approvals a
                        where a.run_id = r.id and a.verdict is null
                          and (a.expires_at is null or a.expires_at > now()))
       and not exists (select 1 from agent.run_work w where w.run_id = r.id and w.done_at is null)
       and not exists (select 1 from agent.automation_runs ar
                        where ar.id = r.id and ar.waiting is not null);`);
  check("⚠ no run is left reading as working with nothing to work on and nobody able to answer",
    stranded === "", stranded);
  const waiting = q(`select count(*) from agent.runs where status = 'running';`);
  check("...and the runs that ARE still running are the ones a person can still answer",
    Number(waiting) >= 1 &&
    q(`select count(*) from agent.runs r where r.status = 'running'
        and exists (select 1 from agent.tool_approvals a where a.run_id = r.id and a.verdict is null
                     and (a.expires_at is null or a.expires_at > now()));`) === waiting, waiting);
  check("⚠ not one execution anywhere called a model other than the stand-in",
    q(`select count(*) from agent.runs where model is not null and model not in ('stand-in', 'none');`) === "0");
  check("the account next door still has exactly what it started with",
    q(`select count(*) from agent.tool_revocations where tenant_id = '${B}';`) === "0" &&
    q(`select count(*) from agent.agents where tenant_id = '${B}';`) === "1");
  // ⚠ AND THE PROFILE GATE TURNED NOTHING AWAY, which is the negative half of M6: every
  // request in this whole run named its schema by the header its own METHOD implies.
  check("⚠ every request named its schema correctly — the shim refused none of them",
    rest.refusedProfiles() === 0, String(rest.refusedProfiles()));
  void THEIR_AG;
} finally {
  await stack.tearDown();
}

console.log(`\n${failed === 0 ? "ALL CHECKS PASSED" : `${failed} FAILED`}`);
if (failed) { console.log(fails.map((f) => `  - ${f}`).join("\n")); process.exit(1); }
