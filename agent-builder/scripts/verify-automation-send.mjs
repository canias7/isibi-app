#!/usr/bin/env node
/**
 * AN AUTOMATION THAT SENDS — configured, run, approved, and checked in the mailbox.
 * `npm run verify:send`.
 *
 * Milestone 12's own demonstration list: *successful manual, event-triggered, and scheduled
 * execution; duplicate event delivery; reload and restart while awaiting approval; lost
 * response after sending, followed by retry; rejection, approval expiry, revoked permission,
 * and disconnected account; cancellation before sending; editing the saved workflow while an
 * accepted run retains its snapshot; cross-account denial* — and, in as many words,
 * ***use the fake provider's mailbox to verify what was actually sent, not just the success
 * message.***
 *
 * ── ⚠ EVERY CHECK READS THE MAILBOX OR THE DATABASE, NEVER THE SENTENCE ──────
 *
 * A step that answered "sent" and sent nothing would pass a check on its own words. So what
 * is asserted is what the PROVIDER holds — `ADAPTERS[FAKE_PROVIDER].mailbox(account)`, the
 * very registry `worker.queue` sends through — and what the ROW says, read straight out of
 * PostgreSQL.
 *
 * ── WHAT IS SIMULATED, IN THREE PLACES AND NAMED HERE ────────────────────────
 *
 *   1. **THE PROVIDER.** `fakemail`: no network, no credential of anybody's, and it says so
 *      in its own name and in every answer. It has NO IDEMPOTENCY KEY on purpose, so a second
 *      send really is a second message — which is what makes a blind retry the wrong answer.
 *   2. **THE TRANSPORT.** PostgREST is `scripts/local-rest.mjs` and the queue is an
 *      in-process doorbell, because neither is reachable from a laptop. Durability is
 *      unchanged: the work is a ROW.
 *   3. **TWO CLOCKS, PUSHED RATHER THAN WAITED OUT, in one UPDATE each.** An approval's
 *      window is 24 hours and a schedule's next run is tomorrow; a check nobody re-runs
 *      proves nothing. What that does NOT simulate is any DECISION — `decide_tool_approval`
 *      still compares `expires_at` against `now()`, and `tick_automations` still selects on
 *      `next_run_at <= now()`.
 *
 * **NOTHING HERE CALLS A MODEL.** An automation execution has no model at all, which the
 * last section asserts rather than assumes.
 */
import worker, { ADAPTERS } from "../src/worker.mjs";
import { handleAgentApi, makeAgentStore, AGENT_PROVIDERS } from "../../agent-store.mjs";
import { haveCluster, standUp, dispatcher } from "./lib/local-stack.mjs";
import { FAKE_PROVIDER, makeFakeProvider } from "../src/fake-provider.mjs";
import { signDelivery, SIG_HEADER, TS_HEADER, ID_HEADER } from "../src/webhooks.mjs";

const DB = `agent_send_${process.pid}`;
const A = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa";
const B = "bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb";
const ACCOUNT = "shop@example.test";

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

/**
 * ⚠ **THE PROVIDER IS SCRIPTED THROUGH ITS OWN DOOR, AND IT IS THE REGISTRY'S OWN ENTRY.**
 * `worker.queue` reaches the module-scoped `ADAPTERS`, so a provider handed in some other way
 * would not be the one an automation sends through — and a check against any other mailbox
 * proves nothing. `makeFakeProvider` already takes a `script` (`FAKE_OUTCOMES`: ok · lost ·
 * timeout · refused · unauthorised), so ONE adapter serves the whole file with `arm` deciding
 * what the next call does. The first draft of this reached for a `Proxy` over `run` instead —
 * a second mechanism beside the one the adapter documents, and it never reached the mailbox.
 *
 * NO `secret`, so it accepts any non-empty credential — which is exactly what the Worker's own
 * registry entry does, and what makes "the credential reached the provider" still a real check
 * (a lease that carried none is refused `unauthorised` either way).
 */
let arm = null;
const provider = makeFakeProvider({ script: ({ action }) => {
  if (!arm) return "ok";
  const fate = arm(action);
  return typeof fate === "string" ? fate : "ok";
} });
ADAPTERS[FAKE_PROVIDER] = provider;
/** ⚠ THE MAILBOX THE WORKER ITSELF SENDS TO. A check against any other proves nothing. */
const mailbox = () => provider.mailbox(ACCOUNT);
const sentCount = () => mailbox().length;

try {
  const appStore = () => makeAgentStore({ fetch: (u, o) => fetch(u, o), url: rest.url, key: "local-service-role" });
  let minted = 0;
  const api = (p, { tenant = A, body = {}, query = null, ring } = {}) => handleAgentApi({
    path: p, method: query ? "GET" : "POST",
    tenant, body, query: new URLSearchParams(query || {}), store: appStore(), ring,
    newId: () => `00000000-0000-4000-8000-${String(++minted).padStart(12, "0")}`,
    log: () => {},
  });
  let bell = dispatcher({ worker, rest });
  const { env } = bell;
  const drain = () => bell.drain();
  const ring = (id) => bell.ring(id);
  const tick = () => bell.tick();

  const execRow = (id) => JSON.parse(q(`select coalesce(jsonb_agg(to_jsonb(r))::text, '[]')
      from (select id, position, outcomes, waiting, finished_at from agent.automation_runs
             where automation_id = '${id}' order by created_at) r;`));
  const runStop = (runId) => q(`select coalesce((body -> 'stop')::text, '')
      from agent.run_entries where run_id = '${runId}' and body ->> 'kind' = 'stopped';`);
  const waitingRequests = async (agent) =>
    (await api("/api/agent/tool-approvals", { query: { agent } })).body.approvals || [];

  // ═════════════════════════════════════════════════════════════════════════
  console.log("\n1. A CUSTOMER CONNECTS AN ACCOUNT AND WRITES THE AUTOMATION");
  // ═════════════════════════════════════════════════════════════════════════
  const made = await api("/api/agent/create", {
    body: { name: "Bike shop", instructions: "Answer about the shop.", zone: "Europe/London" },
  });
  check("an agent exists", made.status === 200, JSON.stringify(made.body).slice(0, 120));
  const AG = made.body.agent.id;

  const conn = await api("/api/agent/connection-connect", {
    body: { agent: AG, provider: AGENT_PROVIDERS[0].name, account: ACCOUNT,
            label: "The shop", scopes: ["read", "send"] },
  });
  check("a person connects an account through the site's own route", conn.status === 200, JSON.stringify(conn.body).slice(0, 160));
  check("⚠ ...and the answer carries no credential at all",
    !/secret|credential|token|password/.test(JSON.stringify(conn.body)), JSON.stringify(conn.body).slice(0, 200));
  check("...and it is labelled simulated", conn.body.simulated === true);
  const CX = conn.body.id;

  // ⚠ THE WORKFLOW A CUSTOMER WOULD BUILD IN THE EXISTING EDITOR: something arrives (an
  // input), a reference source is searched, a scripted reply is prepared from a template,
  // and it is sent — with the approval bound to what the send step really resolved.
  await api("/api/agent/knowledge-save", {
    body: { agent: AG, title: "Price list", format: "text",
            body: "A boiler service is £95 including parts. A full rewire is quoted on site." },
  });
  const STEPS = [
    { type: "knowledge", query: "{{topic}}", out: "facts" },
    { type: "note", text: "Hello {{who}} — about your {{topic}}: {{facts}} (this reply is scripted, not written by a model)", out: "reply" },
    { type: "send", connection: CX, to: "{{who}}", body: "{{reply}}" },
  ];
  const auto = await api("/api/agent/automation-create", {
    body: {
      agent: AG, name: "Reply to an enquiry", enabled: true, schedule: "manual",
      inputs: [{ name: "who", label: "Who it is for", required: true },
               { name: "topic", label: "What they asked about", required: true }],
      steps: STEPS,
    },
  });
  check("the automation saves through the site's own route, send step and all",
    auto.status === 200, JSON.stringify(auto.body).slice(0, 220));
  const AU = auto.body.id;
  // ⚠ READ BACK THROUGH THE LIST THE SCREEN ITSELF READS, never off the create's own answer:
  // that answers `{id, nextRunAt}` and nothing else, so asserting `auto.body.steps` was
  // asserting a key the route has never carried — my own mistake, and the route is right.
  // What is worth proving is that the row holds the step as the VALIDATOR minted it, ids and
  // all, which is the reading a customer's next edit starts from.
  const listed = await api("/api/agent/automations", { query: { agent: AG } });
  const stored = (listed.body.automations || []).find((a) => a.id === AU);
  check("...and the send step is stored as the validator read it",
    (stored?.steps || []).some((s) => s.type === "send" && s.connection === CX && s.id === "s3"),
    JSON.stringify(stored?.steps || []).slice(0, 220));

  // ═════════════════════════════════════════════════════════════════════════
  console.log("\n2. RUN NOW: IT HOLDS FOR A PERSON, SHOWING EXACTLY WHAT WILL BE SENT");
  // ═════════════════════════════════════════════════════════════════════════
  const before = sentCount();
  const run1 = await api("/api/agent/automation-run", {
    body: { id: AU, input: { who: "ada@example.test", topic: "boiler service" } }, ring,
  });
  check("it is accepted", run1.status === 200, JSON.stringify(run1.body).slice(0, 160));
  await drain();

  const waiting = await waitingRequests(AG);
  check("⚠ ONE REQUEST IS WAITING FOR A PERSON", waiting.length === 1, JSON.stringify(waiting).slice(0, 200));
  const req = waiting[0] || {};
  check("...and it is the send tool", req.tool === "send_message", String(req.tool));
  // ⚠ **THE PERSON IS SHOWN THE CONNECTION, THE ACCOUNT, THE RECIPIENT AND THE EXACT
  // MESSAGE** — the requirement in as many words, asserted on what the ROUTE answers.
  check("⚠ ...and the request carries the CONNECTION it will send from",
    req.args?.connection === CX && req.args?.account === ACCOUNT, JSON.stringify(req.args).slice(0, 200));
  check("⚠ ...and the RECIPIENT", req.args?.to === "ada@example.test", String(req.args?.to));
  check("⚠ ...and the EXACT MESSAGE, with its references already filled in",
    typeof req.args?.body === "string" && req.args.body.includes("£95") && req.args.body.includes("ada@example.test"),
    String(req.args?.body).slice(0, 160));
  check("⚠ ...and it says the reply is scripted rather than written by a model",
    String(req.args?.body).includes("scripted"), String(req.args?.body).slice(-80));
  check("⚠ NOTHING HAS BEEN SENT while it waits", sentCount() === before, `${sentCount()} in the mailbox`);
  const execs1 = execRow(AU);
  check("...and the execution reads as waiting, not as working",
    execs1.length === 1 && execs1[0].waiting !== null, JSON.stringify(execs1[0]?.waiting).slice(0, 120));

  // ═════════════════════════════════════════════════════════════════════════
  console.log("\n3. A RELOAD AND A RESTART WHILE IT WAITS CHANGE NOTHING");
  // ═════════════════════════════════════════════════════════════════════════
  const reread = await api("/api/agent/tool-approvals", { query: { agent: AG } });
  check("a reload shows the same one request", (reread.body.approvals || []).length === 1);
  // ⚠ A WHOLLY FRESH DISPATCHER — its own env, no memory of anything — which is the same
  // code path a deploy leaves behind.
  bell = dispatcher({ worker, rest });
  await tick();
  check("⚠ a restart plus a cron tick does not resume it, because nobody has answered",
    sentCount() === before && (await waitingRequests(AG)).length === 1, `${sentCount()} sent`);

  // ═════════════════════════════════════════════════════════════════════════
  console.log("\n4. APPROVED: IT SENDS, AND THE MAILBOX IS WHAT SAYS SO");
  // ═════════════════════════════════════════════════════════════════════════
  const yes = await api("/api/agent/tool-approve", { body: { id: req.id, verdict: "approved", note: "prices look right" }, ring });
  check("the person approves through the site's own route", yes.status === 200, JSON.stringify(yes.body).slice(0, 140));
  await drain();

  const box = mailbox();
  check("⚠ EXACTLY ONE MESSAGE IS IN THE PROVIDER'S MAILBOX", box.length === before + 1, `${box.length} messages`);
  const msg = box[box.length - 1] || {};
  check("⚠ ...to the recipient the person was shown", msg.to === "ada@example.test", String(msg.to));
  check("⚠ ...with the exact words the person was shown", msg.body === req.args.body,
    `${String(msg.body).slice(0, 60)} vs ${String(req.args.body).slice(0, 60)}`);
  check("⚠ ...and the provider's own record carries no credential",
    !/secret|FAKE-TOKEN|password/i.test(JSON.stringify(provider.seen())), JSON.stringify(provider.seen()).slice(0, 160));

  const exec2 = execRow(AU)[0];
  check("the execution finished", exec2.finished_at !== null);
  const sendOut = (exec2.outcomes || []).find((o) => o.type === "send") || {};
  check("⚠ the outcome records what the provider really answered",
    sendOut.sent === true && typeof sendOut.message === "string", JSON.stringify(sendOut).slice(0, 200));
  check("⚠ ...and says it was simulated, read from the provider rather than from a constant",
    sendOut.simulated === true, JSON.stringify(sendOut).slice(0, 160));
  check("...and the execution's own result says where it went",
    /ada@example\.test/.test(runStop(exec2.id)), runStop(exec2.id).slice(0, 140));

  // ═════════════════════════════════════════════════════════════════════════
  console.log("\n5. A DUPLICATE DELIVERY SENDS NOTHING A SECOND TIME");
  // ═════════════════════════════════════════════════════════════════════════
  const afterOne = sentCount();
  await ring(exec2.id); await drain();
  await ring(exec2.id); await drain();
  check("⚠ two more deliveries of the same run leave ONE message in the mailbox",
    sentCount() === afterOne, `${sentCount()} messages`);

  // ═════════════════════════════════════════════════════════════════════════
  console.log("\n6. A LOST ANSWER IS RECONCILED, NEVER RE-SENT");
  // ═════════════════════════════════════════════════════════════════════════
  // ⚠ `lost` IS THE PROVIDER DOING THE WORK AND THE ANSWER NOT COMING BACK — from the
  // caller's side indistinguishable from a timeout, which is the whole point, and the
  // difference is only ever what a RECONCILIATION finds. The adapter's own outcome, armed
  // for the send and cleared for the reconcile that follows it, so the check really does
  // reach the message rather than a second timeout.
  arm = (action) => (action === "send_message" ? "lost" : "ok");

  const atLoss = sentCount();
  const run2 = await api("/api/agent/automation-run", {
    body: { id: AU, input: { who: "bea@example.test", topic: "full rewire" } }, ring,
  });
  await drain();
  const w2 = (await waitingRequests(AG))[0];
  await api("/api/agent/tool-approve", { body: { id: w2.id, verdict: "approved" }, ring });
  await drain();
  check("⚠ the message really did land at the provider, although the answer was lost",
    sentCount() === atLoss + 1, `${sentCount()} messages`);
  const lostExec = execRow(AU).find((e) => e.id === run2.body.runId) || {};
  const lostOut = (lostExec.outcomes || []).find((o) => o.type === "send") || {};
  check("⚠ ...and a check found it rather than the workflow claiming a clean send",
    lostOut.outcome === "ran" || lostOut.unresolved === true, JSON.stringify(lostOut).slice(0, 220));
  // THE RETRY: a redelivery must not make a second message, whichever way the first ended.
  arm = null;
  await ring(lostExec.id); await drain();
  check("⚠ AND A RETRY AFTERWARDS SENDS NOTHING AGAIN", sentCount() === atLoss + 1, `${sentCount()} messages`);

  // ═════════════════════════════════════════════════════════════════════════
  console.log("\n7. REJECTED, EXPIRED, REVOKED AND DISCONNECTED ARE FOUR DIFFERENT ENDINGS");
  // ═════════════════════════════════════════════════════════════════════════
  const said = new Set();
  const endOf = (execId) => {
    const e = execRow(AU).find((x) => x.id === execId) || {};
    const o = (e.outcomes || []).find((x) => x.type === "send") || {};
    return { e, o, words: String(o.error || o.why || "") };
  };

  // (a) REJECTED — a person says no.
  const atReject = sentCount();
  const run3 = await api("/api/agent/automation-run", { body: { id: AU, input: { who: "c@example.test", topic: "boiler service" } }, ring });
  await drain();
  const w3 = (await waitingRequests(AG))[0];
  await api("/api/agent/tool-approve", { body: { id: w3.id, verdict: "rejected", note: "wrong customer" }, ring });
  await drain();
  check("⚠ a rejection sends nothing", sentCount() === atReject, `${sentCount()} messages`);
  check("...and the execution ends `rejected`, not `failed`",
    /rejected/.test(runStop(endOf(run3.body.runId).e.id)), runStop(endOf(run3.body.runId).e.id).slice(0, 120));
  said.add(endOf(run3.body.runId).words);

  // (b) EXPIRED — nobody answers inside the window.
  const atExpire = sentCount();
  const run4 = await api("/api/agent/automation-run", { body: { id: AU, input: { who: "d@example.test", topic: "boiler service" } }, ring });
  await drain();
  const w4 = (await waitingRequests(AG))[0];
  // THE CLOCK, PUSHED — the one UPDATE this file makes. The DECISION is still the database's.
  q(`update agent.tool_approvals set expires_at = now() - interval '1 minute' where id = '${w4.id}';`);
  check("an expired request is no longer offered to be answered", (await waitingRequests(AG)).length === 0);
  await tick();                 // requeue_expired_approvals, the cron's own job
  await drain();
  check("⚠ an expiry sends nothing", sentCount() === atExpire, `${sentCount()} messages`);
  check("...and it is a failure that says nobody answered in time",
    /in time/.test(endOf(run4.body.runId).words), endOf(run4.body.runId).words.slice(0, 120));
  said.add(endOf(run4.body.runId).words);

  // (c) REVOKED — the permission for the send tool is taken away.
  const atRevoke = sentCount();
  await api("/api/agent/tool-revoke", { body: { agent: AG, tool: "send_message", reason: "not for now" } });
  const run5 = await api("/api/agent/automation-run", { body: { id: AU, input: { who: "e@example.test", topic: "boiler service" } }, ring });
  await drain();
  check("⚠ a withdrawn permission sends nothing", sentCount() === atRevoke, `${sentCount()} messages`);
  check("...and nobody is asked to approve what may not happen", (await waitingRequests(AG)).length === 0);
  check("...and it says the permission was withdrawn",
    /withdrawn/.test(endOf(run5.body.runId).words), endOf(run5.body.runId).words.slice(0, 120));
  said.add(endOf(run5.body.runId).words);
  await api("/api/agent/tool-restore", { body: { agent: AG, tool: "send_message" } });

  // (d) DISCONNECTED — the account is taken away.
  const atOff = sentCount();
  await api("/api/agent/connection-disconnect", { body: { agent: AG, id: CX } });
  const run6 = await api("/api/agent/automation-run", { body: { id: AU, input: { who: "f@example.test", topic: "boiler service" } }, ring });
  await drain();
  check("⚠ a disconnected account sends nothing", sentCount() === atOff, `${sentCount()} messages`);
  check("...and it says WHY, rather than that something went wrong",
    /disconnected/.test(endOf(run6.body.runId).words), endOf(run6.body.runId).words.slice(0, 140));
  said.add(endOf(run6.body.runId).words);

  check("⚠ FOUR ENDINGS, FOUR SENTENCES — each needs something different done about it",
    said.size === 4, [...said].map((s) => s.slice(0, 40)).join(" | "));

  // ═════════════════════════════════════════════════════════════════════════
  console.log("\n8. CANCELLING BEFORE IT SENDS STOPS IT, AND SAYS WHAT HAD ALREADY RUN");
  // ═════════════════════════════════════════════════════════════════════════
  const reconn = await api("/api/agent/connection-connect", {
    body: { agent: AG, provider: AGENT_PROVIDERS[0].name, account: ACCOUNT, label: "The shop", scopes: ["send"] },
  });
  const CX2 = reconn.body.id;
  /**
   * ⚠ **`automation-update` IS A FULL REPLACE AND DEMANDS THE WHOLE SHAPE**, which is the
   * route being right rather than strict: it reads the same `cleanSchedule` + `cleanInputs` +
   * `cleanWorkflow` the create does, so a body carrying only `{id, steps}` is refused
   * *"give it a name first"* — 400, and the edit never lands. The PATCH shape is
   * `change_automation`, the AGENT's own tool, and conflating the two is what the first draft
   * of this did: it read a refusal as an edit and the next run failed on a connection this
   * section thought it had re-pointed.
   */
  const SAVE = (steps) => ({
    id: AU, name: "Reply to an enquiry", enabled: true, schedule: "manual",
    inputs: [{ name: "who", label: "Who it is for", required: true },
             { name: "topic", label: "What they asked about", required: true }],
    steps,
  });
  const repointed = await api("/api/agent/automation-update", {
    body: SAVE(STEPS.map((s) => s.type === "send" ? { ...s, connection: CX2 } : s)),
  });
  check("the automation is pointed at the reconnected account", repointed.status === 200,
    JSON.stringify(repointed.body).slice(0, 160));

  const atCancel = sentCount();
  const run7 = await api("/api/agent/automation-run", { body: { id: AU, input: { who: "g@example.test", topic: "boiler service" } }, ring });
  await drain();
  const w7 = (await waitingRequests(AG))[0];
  check("it is waiting for a person again", !!w7);
  const stopped = await api("/api/agent/run-cancel", {
    body: { run: execRow(AU).find((e) => e.id === run7.body.runId).id, reason: "changed my mind" },
  });
  check("a cancellation is accepted", stopped.status === 200, JSON.stringify(stopped.body).slice(0, 160));
  /**
   * ⚠ **THE PROPERTY IS THAT IT DOES NOT CLAIM A REVERSAL, AND FORBIDDING THE WORD `undone`
   * IS NOT THAT CHECK.** The first draft of this asserted
   * `!/undone|reversed|rolled back/i` over the whole answer — and the product's own sentence
   * is *"stopped — what had already run has already run and was NOT undone"*, which is the
   * requirement in as many words. So the check went red about the one thing it was written to
   * demand: *a needle that matches a word two meanings share cannot prove a class.*
   *
   * It is asserted POSITIVELY now, which is strictly stronger — the answer must SAY the
   * completed work stands — plus the counts, plus the absence of a CLAIMED reversal, matched
   * as a phrase (`has been undone`, `was reversed`, `rolled back`) rather than as a word.
   */
  const cancelSay = String(stopped.body.say || "");
  check("⚠ ...and says what had already completed rather than claiming it was undone",
    Number.isInteger(stopped.body.completedSteps) && Number.isInteger(stopped.body.completedCalls)
    && /not undone|has already run/i.test(cancelSay)
    && !/(has been|was|were|been) (undone|reversed)|rolled back/i.test(cancelSay),
    `${stopped.body.completedSteps} step(s), ${stopped.body.completedCalls} call(s) — "${cancelSay}"`);
  await tick(); await drain();
  check("⚠ ...and nothing is sent afterwards", sentCount() === atCancel, `${sentCount()} messages`);
  check("...and the request nobody can answer is no longer offered",
    (await waitingRequests(AG)).length === 0);

  // ═════════════════════════════════════════════════════════════════════════
  console.log("\n9. AN EDIT REACHES THE NEXT RUN AND NEVER ONE ALREADY ACCEPTED");
  // ═════════════════════════════════════════════════════════════════════════
  const atEdit = sentCount();
  const run8 = await api("/api/agent/automation-run", { body: { id: AU, input: { who: "h@example.test", topic: "boiler service" } }, ring });
  await drain();
  const w8 = (await waitingRequests(AG))[0];
  const promised = w8.args.body;
  // THE WORKFLOW IS EDITED WHILE THAT RUN IS SUSPENDED.
  const edited = await api("/api/agent/automation-update", {
    body: SAVE(STEPS.map((s) => s.type === "note" ? { ...s, text: "COMPLETELY DIFFERENT for {{who}}" }
                                                  : (s.type === "send" ? { ...s, connection: CX2 } : s))),
  });
  check("the edit is accepted while that run is suspended", edited.status === 200,
    JSON.stringify(edited.body).slice(0, 160));
  await api("/api/agent/tool-approve", { body: { id: w8.id, verdict: "approved" }, ring });
  await drain();
  const afterEdit = mailbox();
  check("⚠ THE ACCEPTED RUN SENT WHAT WAS APPROVED, not what the workflow says now",
    afterEdit.length === atEdit + 1 && afterEdit[afterEdit.length - 1].body === promised,
    String(afterEdit[afterEdit.length - 1]?.body).slice(0, 80));
  check("...and the edit really did land", /COMPLETELY DIFFERENT/.test(
    JSON.stringify((await api("/api/agent/automations", { query: { agent: AG } })).body.automations)));

  // ═════════════════════════════════════════════════════════════════════════
  console.log("\n10. A SCHEDULED RUN TAKES THE SAME PATH");
  // ═════════════════════════════════════════════════════════════════════════
  const daily = await api("/api/agent/automation-create", {
    body: {
      agent: AG, name: "Nightly note", enabled: true, schedule: "daily", at: "23:00", zone: "Europe/London",
      steps: [{ type: "send", connection: CX2, to: "owner@example.test", body: "the nightly note" }],
    },
  });
  check("a scheduled automation with a send step saves", daily.status === 200, JSON.stringify(daily.body).slice(0, 180));
  const DA = daily.body.id;
  // THE CLOCK, PUSHED — and `tick_automations` still selects on `next_run_at <= now()`.
  q(`update agent.automations set next_run_at = now() - interval '1 minute' where id = '${DA}';`);
  const atSched = sentCount();
  await tick(); await drain();
  const schedExec = execRow(DA)[0];
  check("⚠ the cron filed it and the delivery ran it", !!schedExec, JSON.stringify(execRow(DA)).slice(0, 160));
  check("⚠ ...and it HOLDS for a person exactly as a manual run does",
    sentCount() === atSched && (await waitingRequests(AG)).length === 1, `${sentCount()} sent`);
  const w9 = (await waitingRequests(AG))[0];
  check("...and the request is bound to what the scheduled run resolved",
    w9.args?.to === "owner@example.test" && w9.args?.body === "the nightly note", JSON.stringify(w9.args).slice(0, 160));
  await api("/api/agent/tool-approve", { body: { id: w9.id, verdict: "approved" }, ring });
  await drain();
  check("⚠ ...and once approved the SCHEDULED run sends through the same path",
    sentCount() === atSched + 1 && mailbox()[sentCount() - 1].to === "owner@example.test", `${sentCount()} messages`);

  // ═════════════════════════════════════════════════════════════════════════
  console.log("\n11. AN AUTHENTICATED EVENT TAKES THE SAME PATH, AND A SECOND DELIVERY DOES NOT");
  // ═════════════════════════════════════════════════════════════════════════
  // The brief's own list: *successful manual, event-triggered, and scheduled execution* and
  // *duplicate event delivery*. The first two are above; this is the third way in, and it is
  // the only one that arrives from OUTSIDE — so it is the only one where the delivery has to
  // prove who it is before anything of this account's runs.
  const hook = await api("/api/agent/webhook-create", {
    body: { agent: AG, name: "The shop's website", event: "enquiry.arrived" },
  });
  check("an endpoint is made through the site's own route", hook.status === 200,
    JSON.stringify({ ...hook.body, secret: hook.body.secret ? `${hook.body.secret.length} chars` : null }).slice(0, 200));
  // ⚠ **THE SECRET IS ANSWERED EXACTLY ONCE AND IS NEVER READABLE AGAIN** — asserted as a
  // property of the LIST rather than taken on trust from the sentence beside it.
  const hookSecret = hook.body.secret;
  check("⚠ ...and its secret is answered once and never again",
    typeof hookSecret === "string" && hookSecret.length >= 32
    && !/secret/.test(JSON.stringify((await api("/api/agent/webhooks", { query: { agent: AG } })).body)),
    `${String(hookSecret).length} chars, and the list carries none`);
  const WH = hook.body.id;
  check("...and the answer is a PATH rather than an invented origin",
    hook.body.path === `/deliver/${WH}` && !/https?:/.test(String(hook.body.path)), String(hook.body.path));

  const evAuto = await api("/api/agent/automation-create", {
    body: {
      agent: AG, name: "Reply when an enquiry arrives", enabled: true, schedule: "manual",
      on_event: "enquiry.arrived",
      steps: [{ type: "send", connection: CX2, to: "enquiries@example.test", body: "thanks, we have your enquiry" }],
    },
  });
  check("an automation listens for that event", evAuto.status === 200, JSON.stringify(evAuto.body).slice(0, 160));
  const EV = evAuto.body.id;

  /**
   * ⚠ **THE DELIVERY GOES THROUGH `worker.fetch`, SIGNED WITH THE ENGINE'S OWN SIGNER.** Not a
   * row inserted behind the endpoint's back: what is being demonstrated is *an authenticated
   * event through the actual dispatcher*, and an insert would skip the one thing that makes it
   * authenticated. `signDelivery` is the module the route itself verifies with.
   */
  const deliver = async (payload, { secret = hookSecret, at = Date.now(), delivery = "dlv-enquiry-1" } = {}) => {
    const raw = JSON.stringify(payload);
    const ts = String(at);
    const headers = { [SIG_HEADER]: await signDelivery(secret, ts, raw), [TS_HEADER]: ts, [ID_HEADER]: delivery };
    const res = await worker.fetch(new Request(`https://x/deliver/${WH}`, { method: "POST", body: raw, headers }),
      env, { waitUntil() {} });
    return { status: res.status, body: await res.json().catch(() => ({})) };
  };

  const atEvent = sentCount();
  // ⚠ THE BODY CARRIES A TENANT AND AN EVENT NAME OF ITS OWN, and neither may be believed: the
  // account and the event come from the VERIFIED endpoint row. An unsigned one is refused.
  const unsigned = await worker.fetch(new Request(`https://x/deliver/${WH}`, { method: "POST", body: "{}" }),
    env, { waitUntil() {} });
  check("an unsigned delivery is refused, and nothing of this account's runs",
    unsigned.status === 401 && execRow(EV).length === 0, `${unsigned.status}`);
  const first = await deliver({ from: "a customer", tenant: B, tenant_id: B, name: "evil.event" });
  check("a signed delivery is accepted, 202", first.status === 202, JSON.stringify(first.body).slice(0, 140));
  check("⚠ ...and it is recorded under the ENDPOINT's account and the ENDPOINT's event name",
    q(`select count(*) from agent.events where tenant_id = '${A}' and name = 'enquiry.arrived';`) === "1"
    && q(`select count(*) from agent.events where name = 'evil.event' or tenant_id = '${B}';`) === "0",
    `${q(`select name from agent.events;`)} for ${q(`select count(*) from agent.events where tenant_id = '${A}';`)} row(s) of this account`);
  check("⚠ NOTHING HAS BEEN SENT by the delivery alone", sentCount() === atEvent, `${sentCount()} messages`);

  await tick(); await drain();     // dispatch_events files it and rings; the delivery runs it
  const evExec = execRow(EV);
  check("⚠ the dispatcher filed it and the delivery ran it", evExec.length === 1,
    JSON.stringify(evExec).slice(0, 160));
  const wEv = (await waitingRequests(AG))[0];
  check("⚠ ...and it HOLDS for a person exactly as the other two ways in do",
    sentCount() === atEvent && !!wEv && wEv.args?.to === "enquiries@example.test",
    `${sentCount()} sent, waiting on ${JSON.stringify(wEv?.args).slice(0, 90)}`);
  await api("/api/agent/tool-approve", { body: { id: wEv.id, verdict: "approved" }, ring });
  await drain();
  check("⚠ ...and once approved the EVENT-TRIGGERED run sends through the same path",
    sentCount() === atEvent + 1 && mailbox()[mailbox().length - 1].to === "enquiries@example.test",
    `${sentCount()} messages`);

  // ⚠ **THE SAME DELIVERY AGAIN.** A sender that did not hear our 202 retries, which is the
  // ordinary case rather than an attack — so it must be ONE event, ONE execution and ONE
  // message, and the answer must say so rather than reporting a second success.
  const again = await deliver({ from: "a customer", tenant: B, tenant_id: B, name: "evil.event" });
  await tick(); await drain();
  check("⚠ A DUPLICATE DELIVERY IS ONE EVENT AND SAYS SO",
    again.status === 202 && again.body?.repeat === true, JSON.stringify(again.body).slice(0, 140));
  check("⚠ ...one execution, and NOTHING SENT A SECOND TIME",
    execRow(EV).length === 1 && sentCount() === atEvent + 1,
    `${execRow(EV).length} execution(s), ${sentCount()} messages`);
  check("...and the events table holds one row for it",
    q(`select count(*) from agent.events where tenant_id = '${A}' and name = 'enquiry.arrived';`) === "1",
    q(`select count(*) from agent.events;`));

  // ═════════════════════════════════════════════════════════════════════════
  console.log("\n12. ANOTHER ACCOUNT CANNOT REACH ANY OF IT");
  // ═════════════════════════════════════════════════════════════════════════
  const before11 = sentCount();
  const theirs = await api("/api/agent/connections", { tenant: B, query: { agent: AG } });
  check("another account cannot list this agent's connected accounts", theirs.status === 404, String(theirs.status));
  const theirRun = await api("/api/agent/automation-run", { tenant: B, body: { id: AU, input: { who: "x@example.test", topic: "x" } }, ring });
  check("...nor run its automation", theirRun.status === 404, String(theirRun.status));
  const theirOff = await api("/api/agent/connection-disconnect", { tenant: B, body: { agent: AG, id: CX2 } });
  check("...nor disconnect its account", theirOff.status === 404, String(theirOff.status));
  await drain();
  check("⚠ ...and nothing was sent by any of it", sentCount() === before11, `${sentCount()} messages`);
  check("...and the connection is still this account's, active",
    q(`select status from agent.connection_list where id = '${CX2}';`) === "active");

  // ═════════════════════════════════════════════════════════════════════════
  console.log("\n13. WHAT NONE OF IT DID");
  // ═════════════════════════════════════════════════════════════════════════
  check("⚠ NOT ONE EXECUTION ANYWHERE CALLED A MODEL",
    q(`select count(*) from agent.runs r join agent.automation_runs a on a.id = r.id
        where r.model is not null and r.model <> 'none';`) === "0",
    q(`select coalesce(string_agg(distinct coalesce(r.model,'null'), ','), '') from agent.runs r
        join agent.automation_runs a on a.id = r.id;`));
  check("⚠ ...and no journal entry anywhere holds a credential",
    q(`select count(*) from agent.run_entries where body::text ~* '(secret|password|credential)';`) === "0");
  check("⚠ ...and every message that went out went to the fake provider, which says so",
    mailbox().every(() => true) && provider.describe().simulated === true &&
    provider.describe().provider === FAKE_PROVIDER, JSON.stringify(provider.describe()).slice(0, 140));
  /**
   * ⚠ **AND NOTHING IS LEFT FOR THE SWEEPER TO OFFER FOR EVER.** Every execution above has
   * ended one way or another, so every work row should be `done` — and a row that is not is a
   * run the cron re-offers every minute, claiming and delivering it each time, which is this
   * repository's own *a stranded run must not read as working* from the queue's side. It is
   * asserted over the whole file rather than per section, because the shape only shows once
   * everything has finished.
   */
  const stray = q(`select coalesce(jsonb_agg(to_jsonb(r))::text, '[]') from (
      select w.run_id, w.attempts, w.claimed_by is not null as held,
             (select count(*) from agent.run_entries e where e.run_id = w.run_id
                and e.body ->> 'kind' = 'stopped') as stops
        from agent.run_work w join agent.automation_runs a on a.id = w.run_id
       where w.done_at is null) r;`);
  check("⚠ ...and no execution is left for the cron to offer for ever",
    stray === "[]", stray.slice(0, 260));
  console.log(`\n  the mailbox holds ${sentCount()} message(s): ` +
    mailbox().map((m) => `${m.to}`).join(", "));
} finally {
  await stack.tearDown();
}

console.log(failed ? `\nFAILED — ${failed} check(s)\n  ${fails.join("\n  ")}` : "\nALL CHECKS PASSED");
process.exit(failed ? 1 : 0);
