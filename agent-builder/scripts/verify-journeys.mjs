/**
 * THREE COMPLETE CUSTOMER JOURNEYS — one command, one database, one run each.
 *
 * ⚠ **THIS DEMONSTRATION IS SIMULATED AND THE LABEL IS THE FIRST THING IN THE FILE.** The
 * model is `scripts/lib/scripted-model.mjs`, which understands nothing: a caller arms each run
 * with the exact answers that run's model calls will give, IN ORDER, keyed by POSITION and
 * never by the words. **Nothing here is a phrase-matching chatbot and nothing here claims
 * language understanding.** What it proves is about the PLATFORM — the routes a person's
 * screen calls, the conversation snapshot, the approval's argument binding, the queue, the
 * fake provider's mailbox and the database's own refusals.
 *
 * **WHAT ELSE IS SIMULATED, named rather than left to be discovered:**
 *   • the PROVIDER — `fakemail`, no network, no credential of anybody's, and no idempotency
 *     key on purpose, so a second send really is a second message;
 *   • the TRANSPORT — PostgREST is a local shim and the queue is an in-process doorbell,
 *     because neither is reachable from a laptop. Durability is unchanged: the work is a ROW.
 *
 * **WHAT IS NOT SIMULATED**: the site's own routes for everything a person does, `worker.queue`
 * and `worker.scheduled` as the dispatcher, the ownership checks, the retry keys, the lease,
 * the fence, the journal, the operation record, and every refusal the database makes.
 *
 * ── ⚠ WHY THIS FILE EXISTS BESIDE THE OTHERS, SAID PLAINLY ──────────────────────
 *
 * The other demonstrations are organised by MECHANISM — triggers, operations, connections,
 * approvals. A customer's journey crosses several of them, and **a sequence is a claim no
 * collection of properties makes**: each of A's steps is driven somewhere, and that says
 * nothing about whether a person can walk from one end to the other in one sitting.
 *
 * So each journey here is ONE continuous run. **Where a clause is already driven exhaustively
 * elsewhere this file drives its SPINE and says so** rather than copying the depth:
 *   • JOURNEY A's exhaustive version is `verify:conversation` (79 checks)
 *   • JOURNEY B's is `verify:send` (97) and `verify:wf` (159)
 *   • JOURNEY C is the one that is nowhere a journey — its clauses live in four files, and
 *     the distinction it names (two sessions of one account against two accounts) is
 *     asserted in none of them.
 */
import worker, { ADAPTERS } from "../src/worker.mjs";
import { handleAgentApi, makeAgentStore } from "../../agent-store.mjs";
import { haveCluster, standUp, dispatcher } from "./lib/local-stack.mjs";
import { makeScriptedModel, SIMULATED } from "./lib/scripted-model.mjs";
import { FAKE_PROVIDER } from "../src/fake-provider.mjs";
import { makeCapabilities } from "../src/capabilities.mjs";
import { CAPABILITY_TOOLS } from "../src/capability-tools.mjs";
import { argsHash } from "../src/approvals.mjs";

const DB = `agent_journey_${process.pid}`;
/** The customer, and the account next door. Two ACCOUNTS — never two sessions. */
const A = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa";
const B = "bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb";
const ACCOUNT = "workshop@example.test";
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
/** ⚠ THE MAILBOX THE WORKER ITSELF SENDS TO — the module-scoped registry `worker.queue`
 *  reaches. A check against any other mailbox proves nothing about what was sent. */
const mailbox = () => ADAPTERS[FAKE_PROVIDER].mailbox(ACCOUNT);

try {
  const appStore = () => makeAgentStore({ fetch: (u, o) => fetch(u, o), url: rest.url, key: "local-service-role" });
  let minted = 0;
  /**
   * ⚠ **A "BROWSER SESSION" IS AN `api` CALLER AND AN ACCOUNT IS ITS `tenant` — which is the
   * whole distinction journey C is about.** Two sessions of one account are two callers with
   * the SAME tenant; two accounts are two tenants. Nothing about a session is an identity, and
   * that is why the outcomes are opposite: independent edits from one account are both kept,
   * and the same requests from another account are refused.
   */
  const caller = (tenant) => (p, { body = {}, query = null, ring } = {}) => handleAgentApi({
    path: p, method: query ? "GET" : "POST", tenant, body,
    query: new URLSearchParams(query || {}), store: appStore(), ring,
    newId: () => `00000000-0000-4000-8000-${String(++minted).padStart(12, "0")}`, log: () => {},
  });
  const api = caller(A);

  let bell = dispatcher({ worker, rest });
  /**
   * ⚠ **EVERY DELIVERY GOES THROUGH `worker.queue` WITH THE SCRIPTED SENDER AS ITS FOURTH
   * ARGUMENT — the local-driver seam.** Cloudflare calls the handler with three, so that seam
   * is unreachable from a deployment by construction: what runs here is the REAL consumer with
   * a scripted model, never a runner assembled for the occasion.
   */
  const deliverWith = (b) => async (runId) => {
    let acked = 0;
    await worker.queue({ messages: [{ body: { runId }, ack: () => { acked++; }, retry: () => {} }] },
                       b.env, b.ctx, { send: model.send });
    return acked;
  };
  let deliver = deliverWith(bell);
  const drain = async () => { const ids = bell.rung.splice(0); for (const id of ids) await deliver(id); return ids; };
  const ring = (id) => bell.ring(id);
  const tick = () => bell.tick();

  let press = 0;
  /** One message, as a person pressing send, with that run's answers armed first. */
  const say = async (agent, words, script, who = api) => {
    model.arm(script);
    const sent = await who("/api/agent/send", { body: { id: agent, body: words, key: `press-${++press}` }, ring });
    await drain();
    return sent;
  };
  const waiting = async (agent, who = api) =>
    (await who("/api/agent/tool-approvals", { query: { agent } })).body.approvals || [];
  const autos = async (agent, who = api) =>
    (await who("/api/agent/automations", { query: { agent } })).body.automations || [];
  const execs = async (id, who = api) =>
    (await who("/api/agent/automation-history", { query: { id } })).body.executions || [];
  const memories = async (agent, who = api) =>
    (await who("/api/agent/memory", { query: { agent } })).body.memories || [];
  const answerOf = (runId) => q(`select coalesce(stop ->> 'text', '') from agent.runs where id='${runId}';`);
  const toolOf = (runId) =>
    q(`select coalesce(body ->> 'name', '(none)') from agent.run_entries
        where run_id='${runId}' and body ->> 'kind' = 'tool' order by seq desc limit 1;`);

  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\nJOURNEY A — a customer sets an agent up by talking to it, is asked for");
  console.log("            what is missing, comes back after a restart, approves, and");
  console.log("            finds it in the settings screens");
  // ═══════════════════════════════════════════════════════════════════════════
  const AG = (await api("/api/agent/create", {
    body: { name: "Workshop assistant", instructions: "Answer about the bike workshop.", zone: ZONE,
            tools: CAPABILITY_TOOLS.map((t) => t.name) },
  })).body.agent.id;
  check("A1. a person creates an agent through their own screen's route, with a zone they set",
    typeof AG === "string" && AG.length > 0);

  // ── the customer tells it something, and the settings screen shows it ───────
  const a1 = await say(AG, "We open at eight on weekdays.", [
    { tool: "remember", args: { name: "opening_hours", value: "eight on weekdays" } },
    { text: "Noted." },
  ]);
  check("A2. the agent writes the fact down", toolOf(a1.body.runId) === "remember", toolOf(a1.body.runId));
  const aMem = await memories(AG);
  check("A3. ⚠ ...and the MEMORY SETTINGS SCREEN shows it, marked as the agent's own",
    aMem.some((m) => m.key === "opening_hours" && m.value === "eight on weekdays" && m.source === "run"),
    JSON.stringify(aMem));

  // ── the ask with something missing: it asks rather than guessing ────────────
  const a2 = await say(AG, "Send me the Saturday price list every week.", [
    { text: "What time on Saturday should I send it?" },
  ]);
  check("A4. it ASKS rather than proposing something incomplete",
    /what time/i.test(answerOf(a2.body.runId)), answerOf(a2.body.runId).slice(0, 90));
  check("A5. ⚠ ...and proposed NOTHING, so there is nothing waiting for a person",
    (await waiting(AG)).length === 0 && toolOf(a2.body.runId) === "");
  check("A6. ...and nothing was created", (await autos(AG)).length === 0);

  // ── ⚠ THE RESTART ──────────────────────────────────────────────────────────
  /**
   * ⚠ **A BRAND-NEW DISPATCHER *AND* A BRAND-NEW SCRIPTED SENDER, and the second half is what
   * makes the assertion below mean anything.** Reusing the old sender leaves its record in
   * scope, so the context could have come from anywhere in this process; a fresh one has seen
   * nothing at all, so whatever reaches it came out of the DATABASE.
   */
  check("A7. the doorbell is empty before the restart — nothing is held open across it",
    bell.rung.length === 0, JSON.stringify(bell.rung));
  const after = dispatcher({ worker, rest });
  const model2 = makeScriptedModel();
  bell = after;
  deliver = async (runId) => {
    let acked = 0;
    await worker.queue({ messages: [{ body: { runId }, ack: () => { acked++; }, retry: () => {} }] },
                       after.env, after.ctx, { send: model2.send });
    return acked;
  };
  check("A8. ⚠ EVERYTHING RESTARTS — a new dispatcher and a sender that has seen nothing",
    model2.asked.length === 0, `${model2.asked.length} calls seen`);

  // ── the customer answers, in the restarted process ──────────────────────────
  model2.arm([
    { tool: "make_automation", args: { name: "Saturday price list", schedule: "weekly",
      days: ["sat"], atLocal: "10:00", steps: [{ type: "note", out: "n", text: "the price list" }] } },
    { text: "Saved and scheduled." },
  ]);
  const a3 = await api("/api/agent/send", { body: { id: AG, body: "Ten in the morning.", key: `press-${++press}` }, ring: after.ring });
  for (const id of after.rung.splice(0)) await deliver(id);

  /**
   * ⚠ **THE CONTEXT IS THE EVIDENCE, AND `prompt` COULD NOT HAVE SERVED.** A clarifying
   * question is an ASSISTANT turn: a count of user turns is satisfied by a context that
   * dropped every assistant turn, and "the last turn is the new message" is satisfied by a
   * context with nothing before it. So the assertion is about the MESSAGE LIST with its roles
   * — which is `journal.mjs` rebuilding it from the snapshot `agent.send_to_agent` wrote
   * inside its own transaction: the conversation as the database holds it, not as a process
   * remembers it.
   */
  const ctx = model2.asked[0]?.context || [];
  const at = (re, role) => ctx.findIndex((m) => m.role === role && re.test(String(m.content || "")));
  const iAsk = at(/saturday price list/i, "user");
  const iQ = at(/what time/i, "assistant");
  const iAns = at(/ten in the morning/i, "user");
  check("A9. ⚠ THE EARLIER REQUEST SURVIVED THE RESTART, as a user turn", iAsk >= 0, `${iAsk}`);
  check("A10. ⚠ ...AND THE AGENT'S OWN QUESTION, as an ASSISTANT turn", iQ >= 0, `${iQ}`);
  check("A11. ⚠ ...AND THE NEW ANSWER, as a user turn", iAns >= 0, `${iAns}`);
  check("A12. ⚠ ...IN THAT ORDER — request, then question, then answer",
    iAsk >= 0 && iQ > iAsk && iAns > iQ, `${iAsk} < ${iQ} < ${iAns}`);
  check("A13. ...and the new message is the LAST turn, which is what makes it the prompt",
    iAns === ctx.length - 1, `${iAns} of ${ctx.length}`);
  /**
   * ⚠ **AND THE COMPLETE ARGUMENTS ARE STILL THE TEST'S, ARMED BY POSITION.** A scripted
   * sender understands nothing and must never be read as evidence that it did. The causal
   * claim is the context assertion above, because carrying the conversation is the part the
   * PLATFORM is responsible for — a run that merely finishes proves the queue worked and says
   * nothing about the turns.
   */
  const wa = await waiting(AG);
  check("A14. NOW it proposes, and it holds for a person",
    wa.length === 1 && wa[0].tool === "make_automation", JSON.stringify(wa.map((r) => r.tool)));
  check("A15. ...and the configuration presented carries the time that was missing",
    wa[0]?.args?.atLocal === "10:00" && JSON.stringify(wa[0]?.args?.days) === '["sat"]',
    JSON.stringify({ at: wa[0]?.args?.atLocal, days: wa[0]?.args?.days }));
  check("A16. ⚠ ...and STILL nothing exists before the button", (await autos(AG)).length === 0);

  const aYes = await api("/api/agent/tool-approve", { body: { id: wa[0].id, verdict: "approved" }, ring: after.ring });
  check("A17. the person approves", aYes.status === 200, `${aYes.status}`);
  for (const id of after.rung.splice(0)) await deliver(id);

  // ── ⚠ AND THE JOURNEY ENDS IN THE SETTINGS SCREENS, through their own routes ─
  const aMade = (await autos(AG)).find((x) => x.name === "Saturday price list");
  check("A18. ⚠ THE AUTOMATIONS SETTINGS SCREEN SHOWS IT, complete",
    !!aMade && aMade.schedule === "weekly" && aMade.at === "10:00"
    && JSON.stringify(aMade.days) === '["sat"]' && aMade.zone === ZONE,
    JSON.stringify({ s: aMade?.schedule, at: aMade?.at, d: aMade?.days, z: aMade?.zone }));
  check("A19. ...and the fact from the first message is still on the memory screen",
    (await memories(AG)).some((m) => m.key === "opening_hours"));
  check("A20. ...and every answer in the journey was labelled simulated",
    [a1, a2, a3].every((r) => r.status === 200) && model2.asked.length >= 1
    && answerOf(a3.body.runId).includes(SIMULATED), answerOf(a3.body.runId).slice(0, 60));

  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\nJOURNEY B — an automation that does something useful: look the answer up in");
  console.log("            the business's own material, prepare it, hold for a person, send");
  console.log("            it through the connected account, and show what happened");
  // ═══════════════════════════════════════════════════════════════════════════
  const CX = (await api("/api/agent/connection-connect", {
    body: { agent: AG, provider: FAKE_PROVIDER, account: ACCOUNT, credential: "not a real one",
            scopes: ["read", "send"] },
  })).body.id;
  check("B1. a person connects an account — their door, and there is no tool for it",
    typeof CX === "string" && CX.length > 0);
  const kSaved = await api("/api/agent/knowledge-save", {
    body: { agent: AG, title: "Returns policy", body: "Bikes can be returned within 30 days with the receipt." },
  });
  check("B2. ...and saves the business's returns policy as reference material", kSaved.status === 200,
    `${kSaved.status} ${JSON.stringify(kSaved.body).slice(0, 80)}`);

  const bMade = await api("/api/agent/automation-create", {
    body: { agent: AG, name: "Answer a returns question", enabled: true, schedule: "manual", zone: ZONE,
      inputs: [{ name: "who", label: "Who it is for", required: true, type: "text" }],
      steps: [
        { type: "knowledge", query: "returns", out: "facts" },
        { type: "note", out: "reply", text: "Hello {{who}} — {{facts}}" },
        { type: "send", connection: CX, to: "{{who}}", body: "{{reply}}" },
      ] },
  });
  check("B3. the automation is saved: look it up, prepare it, send it", bMade.status === 200,
    `${bMade.status} ${JSON.stringify(bMade.body).slice(0, 120)}`);
  const BAU = bMade.body.id;

  const before = mailbox().length;
  const bRun = await api("/api/agent/automation-run", { body: { id: BAU, input: { who: "ada@example.test" } }, ring });
  check("B4. the customer presses Run and fills in who it is for", bRun.status === 200,
    `${bRun.status} ${JSON.stringify(bRun.body).slice(0, 100)}`);
  await drain();
  await tick();
  await drain();

  const bw = await waiting(AG);
  const bReq = bw.find((r) => r.tool === "send_message");
  check("B5. ⚠ IT HOLDS FOR A PERSON before anything leaves", !!bReq, JSON.stringify(bw.map((r) => r.tool)));
  check("B6. ⚠ ...and the person is shown the EXACT message, with the policy already in it",
    typeof bReq?.args?.body === "string" && bReq.args.body.includes("ada@example.test")
    && /30 days/.test(bReq.args.body), JSON.stringify(bReq?.args).slice(0, 180));
  check("B7. ⚠ ...and the MAILBOX IS EMPTY while it waits", mailbox().length === before,
    `${mailbox().length} against ${before}`);

  const shown = bReq.args.body;
  const bYes = await api("/api/agent/tool-approve", { body: { id: bReq.id, verdict: "approved" }, ring });
  check("B8. the person approves it", bYes.status === 200, `${bYes.status}`);
  await drain();
  await tick();
  await drain();

  const box = mailbox();
  check("B9. ⚠ EXACTLY ONE MESSAGE WAS SENT", box.length === before + 1, `${box.length} against ${before}`);
  check("B10. ⚠ ...and it is the message the person was shown, to the recipient they saw",
    box[box.length - 1]?.body === shown && box[box.length - 1]?.to === "ada@example.test",
    JSON.stringify(box[box.length - 1]).slice(0, 160));
  /**
   * ⚠ **A MAILBOX ENTRY IS `{id, to, body, trace}` AND CARRIES NO LABEL — checked against the
   * producer rather than guessed, because the first draft of this asserted `simulated` on the
   * entry and went red about a provider doing exactly the right thing.** The label lives where
   * a person reads it (the execution's own outcome, B12b) and the entry carries the thing only
   * the platform needs: the OPERATION'S TRACE, which is what makes a reconciliation able to
   * find this very send rather than guess at it.
   */
  check("B11. ...and it carries the operation's own trace, so a lost answer can be reconciled",
    typeof box[box.length - 1]?.trace === "string" && box[box.length - 1].trace.length > 0,
    JSON.stringify(box[box.length - 1]?.trace));

  const bHist = await execs(BAU);
  const bLast = bHist[0];
  check("B12. the history says it finished", bLast?.state === "done", JSON.stringify(bLast?.state));
  const bSend = (bLast?.outcomes || []).find((o) => o && o.type === "send");
  check("B12b. ⚠ ...and the HISTORY is where the simulated label reaches a person",
    bSend?.simulated === true, JSON.stringify(bSend).slice(0, 200));
  check("B13. ⚠ ...and says WHERE the answer came from, by source name",
    JSON.stringify(bLast?.outcomes || []).includes("Returns policy"),
    JSON.stringify(bLast?.outcomes || []).slice(0, 200));

  const bAgain = await deliver(bRun.body.runId);
  check("B14. ⚠ A REDELIVERY SENDS NOTHING MORE", mailbox().length === before + 1,
    `${mailbox().length} after a redelivery that acked ${bAgain}`);

  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\nJOURNEY C — two people in one account, and somebody from outside it");
  // ═══════════════════════════════════════════════════════════════════════════
  /**
   * ⚠ **THE DISTINCTION THIS JOURNEY IS FOR: two browser sessions of ONE account are not two
   * accounts, and the two look alike from outside.** Both are two requests about one
   * automation arriving from two places. The outcomes are OPPOSITE — one account's independent
   * edits are BOTH kept, and another account's identical request is refused — and that pair is
   * asserted side by side at the end, because neither half means much alone: "both kept" could
   * be a platform with no isolation, and "refused" could be a platform that refuses everybody.
   */
  const one = caller(A);        // browser session 1, the customer's account
  const two = caller(A);        // browser session 2, THE SAME account
  const outsider = caller(B);   // a different ACCOUNT
  check("C0. two sessions, one account — and an outsider who is a different account",
    one !== two && A !== B);

  const cMade = await one("/api/agent/automation-create", {
    body: { agent: AG, name: "Weekly summary", enabled: true, schedule: "weekly", days: ["mon"],
            at: "09:00", zone: ZONE, steps: [{ type: "note", out: "n", text: "session one wrote this" }] },
  });
  check("C1. session one saves an automation", cMade.status === 200, `${cMade.status}`);
  const CAU = cMade.body.id;
  const cRow = () => JSON.parse(q(`select json_build_object(
    'name', name, 'at', coalesce(at_local::text,'(none)'), 'days', days,
    'step', steps->0->>'text', 'enabled', enabled)::text from agent.automations where id='${CAU}';`));

  // ── C2. TWO SESSIONS, INDEPENDENT EDITS, BOTH PRESERVED ────────────────────
  /**
   * Session two changes the time and the step. Session one — whose form was drawn before any
   * of that — changes only the NAME. Both are true afterwards, which is what a PATCH buys and
   * a whole-row replace destroys.
   */
  const cT = await two("/api/agent/automation-update", { body: { id: CAU, at: "17:00" } });
  const cS = await two("/api/agent/automation-update", { body: { id: CAU, steps: [{ type: "note", out: "n", text: "session two wrote this" }] } });
  check("C2. session two's two edits land", cT.status === 200 && cS.status === 200, `${cT.status}/${cS.status}`);
  const cN = await one("/api/agent/automation-update", { body: { id: CAU, name: "Weekly summary (renamed)" } });
  check("C3. session one's name-only save is accepted", cN.status === 200, `${cN.status}`);
  check("C4. ⚠ SESSION ONE'S NAME IS STORED", cRow().name === "Weekly summary (renamed)", JSON.stringify(cRow()));
  check("C5. ⚠ ...AND SESSION TWO'S TIME SURVIVED IT", cRow().at === "17:00:00", JSON.stringify(cRow()));
  check("C6. ⚠ ...AND SESSION TWO'S STEP SURVIVED IT", cRow().step === "session two wrote this", JSON.stringify(cRow()));

  // ── C3. AN ACCEPTED RUN KEEPS WHAT IT WAS ACCEPTED WITH ────────────────────
  const cRun = await one("/api/agent/automation-run", { body: { id: CAU }, ring });
  check("C7. session one starts it", cRun.status === 200, `${cRun.status} ${JSON.stringify(cRun.body).slice(0, 90)}`);
  const snapOf = (runId) => q(`select coalesce(steps->0->>'text','(none)') from agent.automation_runs where id='${runId}';`);
  check("C8. the accepted execution holds the step as it stood", snapOf(cRun.body.runId) === "session two wrote this",
    snapOf(cRun.body.runId));
  const cEdit = await two("/api/agent/automation-update", { body: { id: CAU, steps: [{ type: "note", out: "n", text: "edited after it was accepted" }] } });
  check("C9. session two edits it AFTER that", cEdit.status === 200, `${cEdit.status}`);
  check("C10. ⚠ THE ACCEPTED EXECUTION IS UNCHANGED — it runs what it was accepted with",
    snapOf(cRun.body.runId) === "session two wrote this", snapOf(cRun.body.runId));
  check("C11. ...and the automation itself has the edit, for the NEXT run",
    cRow().step === "edited after it was accepted", JSON.stringify(cRow()));
  await drain();
  await tick();
  await drain();

  // ── C4. A LOST ANSWER, RECOVERED WITH NO DUPLICATE EFFECT ──────────────────
  /**
   * ⚠ **THIS ONE STEP IS DRIVEN BELOW THE MESSAGE LAYER, AND THE REASON IS THAT A LOST
   * JOURNAL WRITE CANNOT BE PRODUCED THROUGH A ROUTE.** The row is committed, the operation
   * record is written, and nobody wrote the entry that would have said so — which IS a pending
   * tool call. So the tool is called twice with the SAME `ctx.operation`, exactly as a
   * redelivery of that run would call it. Its exhaustive version is `verify:ops` (75 checks).
   */
  const caps = makeCapabilities({ fetch: (u, o) => fetch(u, o), url: bell.env.SUPABASE_URL, key: bell.env.SUPABASE_SERVICE_KEY })
    .forTenant(A).forAgent(AG);
  const changeTool = CAPABILITY_TOOLS.find((t) => t.name === "change_automation");
  const cArgs = { id: CAU, atLocal: "11:00" };
  const cRunId = "cccccccc-3333-4333-8333-cccccccccccc";
  const cCtx = { capabilities: caps, operation: `${cRunId}:7:0:${await argsHash(cArgs)}` };
  const cFirst = await changeTool.run(cArgs, cCtx);
  check("C12. the agent moves the time and it lands", cFirst.ok === true && cRow().at === "11:00:00",
    `${JSON.stringify(cFirst).slice(0, 90)} / ${cRow().at}`);
  // THE ANSWER IS LOST. Now somebody else moves a DIFFERENT field, so the retry's own patch
  // would come out empty — which is the shape that made the defect this record exists for.
  await two("/api/agent/automation-update", { body: { id: CAU, name: "Weekly summary (renamed again)" } });
  const cRetry = await changeTool.run(cArgs, cCtx);
  check("C13. ⚠ THE RETRY ANSWERS THE RECORDED SUCCESS, not a fresh refusal",
    cRetry.ok === true && cRetry.repeat === true && cRetry.error === undefined,
    JSON.stringify(cRetry).slice(0, 140));
  check("C14. ⚠ ...and the newer edit is UNTOUCHED — nothing happened twice",
    cRow().name === "Weekly summary (renamed again)" && cRow().at === "11:00:00", JSON.stringify(cRow()));
  check("C15. ...and exactly ONE record exists for that identity",
    q(`select count(*) from agent.operations where tenant_id='${A}' and op_key like '${cRunId}:7:0%';`) === "1");

  // ── C5. THE ACCOUNT NEXT DOOR: read, edit, approve, resume — all refused ────
  const cHeld = await one("/api/agent/automation-run", { body: { id: BAU, input: { who: "bea@example.test" } }, ring });
  await drain(); await tick(); await drain();
  const heldReq = (await waiting(AG)).find((r) => r.tool === "send_message");
  check("C16. something of this account's is waiting for a person", !!heldReq, JSON.stringify(cHeld.body).slice(0, 90));

  const oRead = await outsider("/api/agent/automations", { query: { agent: AG } });
  check("C17. ⚠ the other ACCOUNT cannot READ it",
    oRead.status === 404 || (oRead.body.automations || []).length === 0,
    `${oRead.status} ${JSON.stringify(oRead.body).slice(0, 70)}`);
  const oHist = await outsider("/api/agent/automation-history", { query: { id: CAU } });
  check("C18. ⚠ ...nor its history",
    oHist.status >= 400 || (oHist.body.executions || []).length === 0, `${oHist.status}`);
  const oEdit = await outsider("/api/agent/automation-update", { body: { id: CAU, name: "taken over" } });
  check("C19. ⚠ ...nor EDIT it", oEdit.status >= 400, `${oEdit.status} ${JSON.stringify(oEdit.body).slice(0, 70)}`);
  const oApprove = heldReq
    ? await outsider("/api/agent/tool-approve", { body: { id: heldReq.id, verdict: "approved" } })
    : { status: 0 };
  check("C20. ⚠ ...nor APPROVE what it is waiting for", oApprove.status >= 400,
    `${oApprove.status} ${JSON.stringify(oApprove.body || {}).slice(0, 70)}`);
  const oResume = await outsider("/api/agent/automation-run", { body: { id: CAU } });
  check("C21. ⚠ ...nor START OR RESUME it", oResume.status >= 400,
    `${oResume.status} ${JSON.stringify(oResume.body).slice(0, 70)}`);
  const oMem = await outsider("/api/agent/memory", { query: { agent: AG } });
  check("C22. ⚠ ...nor read what it remembers",
    oMem.status === 404 || (oMem.body.memories || []).length === 0, `${oMem.status}`);
  check("C23. ⚠ AND NOTHING THE OUTSIDER DID WROTE ANYTHING",
    cRow().name === "Weekly summary (renamed again)" && mailbox().length === before + 1,
    `${JSON.stringify(cRow().name)} / ${mailbox().length}`);

  // ── ⚠ AND THE DISTINCTION, SIDE BY SIDE, ON THE SAME REQUEST SHAPES ────────
  /**
   * ⚠ **THE SAME TWO REQUESTS, TWICE: once from two sessions of one account, once from two
   * accounts.** Opposite outcomes on identical shapes is what says the platform tells a
   * SESSION from an ACCOUNT — and each half is the other's control.
   */
  const shape = (name) => ({ id: CAU, name });
  const sameAcct = [await one("/api/agent/automation-update", { body: shape("from session one") }),
                    await two("/api/agent/automation-update", { body: shape("from session two") })];
  check("C24. ⚠ TWO SESSIONS OF ONE ACCOUNT: both requests are accepted",
    sameAcct.every((r) => r.status === 200), sameAcct.map((r) => r.status).join("/"));
  check("C25. ⚠ ...and the LAST of them is what is stored, so the second really landed",
    cRow().name === "from session two", cRow().name);
  const crossAcct = [await one("/api/agent/automation-update", { body: shape("from the owner") }),
                     await outsider("/api/agent/automation-update", { body: shape("from next door") })];
  check("C26. ⚠ TWO ACCOUNTS, THE SAME SHAPES: the owner's is accepted and the outsider's is NOT",
    crossAcct[0].status === 200 && crossAcct[1].status >= 400,
    crossAcct.map((r) => r.status).join("/"));
  check("C27. ⚠ ...and what is stored is the OWNER's, so the refusal changed nothing",
    cRow().name === "from the owner", cRow().name);

  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\nWHAT NONE OF IT DID");
  // ═══════════════════════════════════════════════════════════════════════════
  const noModel = q(`select count(*) from agent.runs r
    join agent.run_work w on w.run_id = r.id and w.executor = 'automation'
    where coalesce(r.model, 'none') <> 'none';`);
  check("no automation execution anywhere called a model", noModel === "0", `${noModel}`);
  const creds = q(`select count(*) from agent.run_entries where body::text ilike '%not a real one%';`);
  check("no credential of any kind reached the journal", creds === "0", `${creds}`);
  const tried = q(`select coalesce(max(attempts), 0) from agent.run_work;`);
  check("nothing was executed twice — `attempts` never above 1", Number(tried) <= 1, `${tried}`);
  check("every conversation answer was labelled simulated",
    model.asked.concat(model2.asked).length >= 3);

  console.log(`\n${failed === 0 ? "ALL CHECKS PASSED" : `${fails.length} FAILED`}`);
  if (failed) { for (const f of fails) console.log(`  - ${f}`); }
} finally {
  await stack.tearDown();
}
process.exit(failed === 0 ? 0 : 1);
