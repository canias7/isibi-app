#!/usr/bin/env node
/**
 * AN OPERATION HAPPENS ONCE, HOWEVER MANY TIMES IT IS DELIVERED. `npm run verify:ops`.
 *
 * ⚠ **THE DEFECT THIS DEMONSTRATES WAS REPRODUCED BEFORE ANYTHING WAS BUILT**, on these
 * migrations, through the real capability store:
 *
 *     the agent remembers  tone = formal   -> created,   v1, by run
 *     the answer is LOST   (a process dies between the commit and the journal write,
 *                           which is exactly a PENDING TOOL CALL)
 *     the person corrects  tone = casual   -> corrected, v2, by person
 *     the run is delivered again, the pending call is re-run
 *                          tone = formal   -> corrected, v3, by run
 *
 * The person's correction is gone, and the retry ANSWERED `saved: "corrected"` — it knew it
 * was changing something and nothing was looking. **Repeating an upsert is not harmless when
 * something else happened in between**, which is the reasoning `repeatable: true` rested on.
 *
 * Every piece here is the real one and `scripts/lib/local-stack.mjs` is the only fixture:
 * the SITE BUILDER's own routes for everything a person does, a throwaway PostgreSQL with
 * this repository's migrations applied, the Worker's own `queue` handler as the dispatcher,
 * and the real tools against the real capability store.
 *
 * ── ⚠ WHY MOST OF THIS DRIVES THE TOOL RATHER THAN A MESSAGE ─────────────────
 *
 * A retry is *the same tool call delivered twice*, and two deliveries of one MESSAGE cannot
 * produce one: the claim refuses the second, which is a different property proved elsewhere.
 * What a retry really is, is the loop re-running a PENDING call whose result was never
 * written — so `ctx` is built here exactly as `run.mjs` builds it (`<run>:<step>:<index>:`
 * plus the real `argsHash`) and the same call is made twice. Section 6 is the end-to-end
 * control: a real message, through the queue, leaving a record with its run on it.
 *
 * ⚠ NOTHING HERE CALLS A MODEL FOR ANYTHING THAT MATTERS, and nothing touches the hosted
 * project.
 */

import { handleAgentApi, makeAgentStore } from "../../agent-store.mjs";
import worker from "../src/worker.mjs";
import { haveCluster, standUp, dispatcher } from "./lib/local-stack.mjs";
import { CAPABILITY_TOOLS } from "../src/capability-tools.mjs";
import { makeCapabilities, CAPABILITY_WRITES, CAPABILITY_RPC } from "../src/capabilities.mjs";
import { argsHash, splitOperation } from "../src/approvals.mjs";

const DB = `agent_ops_${process.pid}`;
const A = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa";   // one account
const B = "bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb";   // the account next door
const RUN = "77777777-7777-4777-8777-777777777777";
/**
 * ⚠ THE AGENT'S ID COMES FROM THE ROUTE'S OWN ANSWER, never from a constant here. The route
 * MINTS it and ignores an id in the body — which is the route being right, since a client
 * that could choose one could point at another account's agent. Written as a constant first,
 * and every check in this file then failed `no-agent` while the create's own check passed,
 * because that one only asked for a 200.
 */
let AG = null;

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
  const { env, drain, ring } = dispatcher({ worker, rest });

  /** A capability store, scoped the way the runner scopes one. A FRESH one per call where
   *  the point is that nothing is remembered in this process. */
  const caps = (tenant = A, agent = AG) =>
    makeCapabilities({ fetch: (u, o) => fetch(u, o), url: env.SUPABASE_URL, key: env.SUPABASE_SERVICE_KEY })
      .forTenant(tenant).forAgent(agent);

  /** `ctx` as `run.mjs` builds it: the position, and the arguments' own hash. */
  const ctxFor = async (args, step, index = 0, run = RUN, tenant = A, agent = AG) =>
    ({ capabilities: caps(tenant, agent), operation: `${run}:${step}:${index}:${await argsHash(args)}` });
  const toolNamed = (n) => CAPABILITY_TOOLS.find((t) => t.name === n);

  const memory = (key = "tone", tenant = A, agent = AG) =>
    q(`select coalesce(max(value || '/v' || version || '/' || source), '(none)') from agent.agent_memory
        where tenant_id='${tenant}' and agent_id='${agent}' and key='${key}';`);
  const records = (tenant = A) =>
    Number(q(`select count(*) from agent.operations where tenant_id='${tenant}';`));

  // ═════════════════════════════════════════════════════════════════════════
  console.log("\n1. THE REPRODUCTION — a retry must not overwrite a newer change");
  // ═════════════════════════════════════════════════════════════════════════
  const made = await api("/api/agent/create", { body: { name: "Workshop", instructions: "Answer about the workshop.", tools: ["remember", "forget", "pause_automation", "run_automation"] } });
  AG = made.body?.agent?.id ?? null;
  check("an agent exists, with the writing tools ticked", made.status === 200 && AG !== null,
    JSON.stringify(made.body).slice(0, 120));

  const remember = toolNamed("remember");
  const formal = { name: "tone", value: "formal" };
  const first = await remember.run(formal, await ctxFor(formal, 1));
  check("the agent remembers a fact", first?.ok === true, JSON.stringify(first));
  check("⚠ ...and THE ROW SAYS SO", memory() === "formal/v1/run", memory());

  // THE ANSWER IS LOST. Nothing has to be simulated: the row is committed and the journal
  // holds a model answer with no tool result, which IS a pending call.

  // The person corrects it, through the route their own screen calls — genuinely different
  // code from the agent's door, which is the whole point of the case.
  const fixed = await api("/api/agent/memory-save", { body: { agent: AG, name: "tone", value: "casual" } });
  check("the person corrects it through their own screen's route", fixed.status === 200,
    JSON.stringify(fixed.body).slice(0, 120));
  check("⚠ ...and the row is theirs now", memory() === "casual/v2/person", memory());

  // The run is delivered again and the pending call is re-run — the SAME call, which is
  // what makes it a retry rather than a new request.
  const again = await remember.run(formal, await ctxFor(formal, 1));
  check("the interrupted run resumes and the call answers", again?.ok === true, JSON.stringify(again));
  check("⚠ THE CORRECTION SURVIVED — the retry wrote nothing", memory() === "casual/v2/person", memory());
  check("⚠ ...and it was ANSWERED AS A REPEAT rather than reported as new work",
    again?.repeat === true, JSON.stringify(again));
  // ⚠ THE ANSWER IS THE FIRST ATTEMPT'S, VERBATIM, and that is deliberate: it is a
  // historical fact about what that call did, not a reading of the row as it stands now.
  check("⚠ ...and the answer is what the FIRST attempt answered, not what the row says now",
    again.saved === first.saved && again.memory?.version === first.memory?.version,
    `${JSON.stringify(again.saved)} / v${again.memory?.version}`);
  check("...and exactly one operation record exists for the agent's call",
    records() === 1, String(records()));

  // ═════════════════════════════════════════════════════════════════════════
  console.log("\n2. THE SAME SLOT WITH DIFFERENT ARGUMENTS IS REFUSED, NEVER A SECOND OPERATION");
  // ═════════════════════════════════════════════════════════════════════════
  // The requirement in as many words. The KEY is the position and the arguments' hash is a
  // column beside it — folded into the key, two different argument sets would be two
  // different keys and therefore two separate operations, silently.
  const breezy = { name: "tone", value: "breezy" };
  const clash = await remember.run(breezy, await ctxFor(breezy, 1));   // same step, other args
  check("a different call in the same slot is refused BY NAME",
    clash?.ok === false && clash.error === "operation-mismatch", JSON.stringify(clash));
  check("⚠ ...and it wrote nothing", memory() === "casual/v2/person", memory());
  check("⚠ ...and made no second record", records() === 1, String(records()));
  // THE CONTROL: the same different call at its OWN position really does work, or the
  // refusal above could be about anything.
  const ownSlot = await remember.run(breezy, await ctxFor(breezy, 2));
  check("⚠ THE CONTROL: the same call at its own position goes through",
    ownSlot?.ok === true && memory() === "breezy/v3/run", `${JSON.stringify(ownSlot)} / ${memory()}`);

  // ═════════════════════════════════════════════════════════════════════════
  console.log("\n3. DELETION AND RECREATION — a stale forget must not take the new one");
  // ═════════════════════════════════════════════════════════════════════════
  const forget = toolNamed("forget");
  const gone = { name: "tone" };
  const dropped = await forget.run(gone, await ctxFor(gone, 3));
  check("the agent forgets it", dropped?.ok === true && dropped.forgot === true, JSON.stringify(dropped));
  check("⚠ ...and the row is gone", memory() === "(none)", memory());
  const back = await api("/api/agent/memory-save", { body: { agent: AG, name: "tone", value: "warm" } });
  check("the person writes it again", back.status === 200 && memory() === "warm/v1/person", memory());
  // ⚠ THE STALE FORGET. Without the record this deletes the fact somebody just wrote, and
  // `forget` is declared repeatable on the same "the end state is the same" reasoning.
  const staleForget = await forget.run(gone, await ctxFor(gone, 3));
  check("the stale forget is answered as a repeat", staleForget?.repeat === true, JSON.stringify(staleForget));
  check("⚠ ...AND THE RECREATED FACT IS STILL THERE", memory() === "warm/v1/person", memory());

  // ═════════════════════════════════════════════════════════════════════════
  console.log("\n4. CONCURRENT RETRIES — two deliveries at once, one piece of work");
  // ═════════════════════════════════════════════════════════════════════════
  // ⚠ THE RACE IS THE DATABASE'S TO SETTLE, and it is settled by the primary key: both
  // deliveries can read `fresh`, both do the work, one wins the insert and the LOSER'S
  // WHOLE TRANSACTION ROLLS BACK — so exactly one of them changes anything, and the loser
  // then answers the winner's recorded outcome.
  const pace = { name: "pace", value: "unhurried" };
  const ctxA = await ctxFor(pace, 4);
  const ctxB = await ctxFor(pace, 4);
  const [r1, r2] = await Promise.all([remember.run(pace, ctxA), remember.run(pace, ctxB)]);
  check("both answers came back ok", r1?.ok === true && r2?.ok === true,
    `${JSON.stringify(r1?.ok)} / ${JSON.stringify(r2?.ok)}`);
  check("⚠ ...and they AGREE about what happened",
    r1.memory?.version === r2.memory?.version && r1.saved === r2.saved,
    `v${r1.memory?.version} ${r1.saved} / v${r2.memory?.version} ${r2.saved}`);
  check("⚠ ...the fact was written ONCE — version 1, not 2",
    memory("pace") === "unhurried/v1/run", memory("pace"));
  check("⚠ ...and there is exactly ONE record for that position",
    Number(q(`select count(*) from agent.operations where tenant_id='${A}' and op_key='${splitOperation(ctxA.operation).key}';`)) === 1);
  check("...and exactly one of the two was told it was a repeat",
    (r1.repeat === true) !== (r2.repeat === true), `${r1.repeat} / ${r2.repeat}`);

  // ═════════════════════════════════════════════════════════════════════════
  console.log("\n5. A RESTART — the record is in the database, not in this process");
  // ═════════════════════════════════════════════════════════════════════════
  // A fresh capability store with no memory of anything, which is what a new isolate, a new
  // consumer or a deploy leaves behind. If the deduplication lived in this process it would
  // write again here.
  const restartArgs = { name: "bench", value: "the long one by the window" };
  const beforeRestart = await remember.run(restartArgs, await ctxFor(restartArgs, 5));
  check("a fact is written before the restart", beforeRestart?.ok === true && memory("bench") !== "(none)", memory("bench"));
  const meddle = await api("/api/agent/memory-save", { body: { agent: AG, name: "bench", value: "the short one" } });
  check("somebody changes it while nothing is running", meddle.status === 200 && memory("bench") === "the short one/v2/person", memory("bench"));
  // A WHOLLY NEW STORE — `ctxFor` builds one per call, so this is a different object with a
  // different socket and nothing carried over.
  const afterRestart = await remember.run(restartArgs, await ctxFor(restartArgs, 5));
  check("the same call after the restart is a repeat", afterRestart?.repeat === true, JSON.stringify(afterRestart));
  check("⚠ ...and the newer value stands", memory("bench") === "the short one/v2/person", memory("bench"));

  // ═════════════════════════════════════════════════════════════════════════
  console.log("\n6. END TO END — a real message, through the queue, leaves a record");
  // ═════════════════════════════════════════════════════════════════════════
  // The control that says none of the above is an artefact of building `ctx` by hand: a
  // person sends a message, the doorbell rings, the Worker's own consumer claims it, the
  // loop dispatches the tool, and the record carries THAT run's id.
  const before = records();
  const sent = await api("/api/agent/send", {
    body: { id: AG, body: "use remember name=kettle value=on the middle shelf", key: "press-1" }, ring,
  });
  check("the message is accepted", sent.status === 200, JSON.stringify(sent.body).slice(0, 120));
  await drain();
  check("⚠ the tool really ran through the dispatcher", memory("kettle") !== "(none)", memory("kettle"));
  check("⚠ ...and it left an operation record", records() === before + 1, `${before} -> ${records()}`);
  const forRun = q(`select coalesce(string_agg(action || '@' || coalesce(run_id::text, '(no run)'), ', '), '(none)')
                     from agent.operations where tenant_id='${A}' and run_id = '${sent.body.runId}';`);
  check("⚠ ...whose run is the run that made it", forRun.includes(`save_memory@${sent.body.runId}`), forRun);
  check("⚠ ...and its key is that run's own position, not something invented",
    q(`select op_key from agent.operations where tenant_id='${A}' and run_id='${sent.body.runId}';`)
      .startsWith(`${sent.body.runId}:`));

  // ═════════════════════════════════════════════════════════════════════════
  console.log("\n7. EVERY WRITE, NOT JUST MEMORY — a census over the six");
  // ═════════════════════════════════════════════════════════════════════════
  const auto = await api("/api/agent/automation-create", {
    body: { agent: AG, name: "Nightly", schedule: "manual", steps: [{ type: "note", text: "x" }] },
  });
  check("an automation exists to act on", auto.status === 200, JSON.stringify(auto.body).slice(0, 120));
  const AUTO = auto.body.id;

  const pause = toolNamed("pause_automation");
  const off = { id: AUTO, enabled: false };
  const p1 = await pause.run(off, await ctxFor(off, 7));
  check("turning one off works", p1?.ok === true && q(`select enabled::text from agent.automations where id='${AUTO}';`) === "false",
    JSON.stringify(p1));
  // Somebody turns it back on, and THEN the stale call arrives again.
  const on = await api("/api/agent/automation-enable", { body: { id: AUTO, enabled: true } });
  check("a person turns it back on", on.status === 200 && q(`select enabled::text from agent.automations where id='${AUTO}';`) === "true");
  const p2 = await pause.run(off, await ctxFor(off, 7));
  check("⚠ the stale pause is a repeat and does NOT turn it off again",
    p2?.repeat === true && q(`select enabled::text from agent.automations where id='${AUTO}';`) === "true",
    `${JSON.stringify(p2)} / enabled=${q(`select enabled::text from agent.automations where id='${AUTO}';`)}`);

  const start = toolNamed("run_automation");
  const go = { id: AUTO };
  const runsBefore = Number(q(`select count(*) from agent.automation_runs;`));
  const s1 = await start.run(go, await ctxFor(go, 8));
  const s2 = await start.run(go, await ctxFor(go, 8));
  check("starting one twice makes ONE execution",
    s1?.ok === true && s2?.ok === true &&
    Number(q(`select count(*) from agent.automation_runs;`)) === runsBefore + 1,
    `${runsBefore} -> ${q(`select count(*) from agent.automation_runs;`)}`);
  check("⚠ ...and the second is told so", s2?.repeat === true || s2?.started === false, JSON.stringify(s2));

  // ⚠ A CENSUS, so a write added next month cannot go undemonstrated in silence. It reads
  // the records the section really left and requires one per write this file exercised.
  const seen = new Set(q(`select coalesce(string_agg(distinct action, ','), '') from agent.operations where tenant_id='${A}';`).split(",").filter(Boolean));
  const exercised = ["save_memory", "delete_memory", "set_automation_enabled", "accept_automation_run"];
  for (const a of exercised) check(`⚠ ${a} went through its operation record`, seen.has(a), [...seen].join(", "));
  const notYet = CAPABILITY_WRITES.map((w) => CAPABILITY_RPC[w]).filter((f) => !exercised.includes(f));
  check("⚠ ...and the writes this file does NOT exercise are named rather than forgotten",
    notYet.every((f) => !seen.has(f)), `not driven here: ${notYet.join(", ") || "(none)"}`);

  // ═════════════════════════════════════════════════════════════════════════
  console.log("\n8. THE RECORD IS THE ACCOUNT'S — one key, two accounts, two operations");
  // ═════════════════════════════════════════════════════════════════════════
  const theirs = await api("/api/agent/create", {
    tenant: B, body: { name: "Theirs", instructions: "x", tools: ["remember"] },
  });
  check("the account next door has an agent", theirs.status === 200 && !!theirs.body?.agent?.id,
    JSON.stringify(theirs.body).slice(0, 100));
  const shared = { name: "tone", value: "theirs" };
  // THE SAME op_key, in another account. The primary key is `(tenant_id, op_key)`, so this
  // is a different operation — and must be, or one account's retry would answer another's.
  const mine = await remember.run(shared, await ctxFor(shared, 9));
  const yours = await remember.run(shared, await ctxFor(shared, 9, 0, RUN, B, theirs.body.agent.id));
  check("both accounts' calls went through", mine?.ok === true && yours?.ok === true,
    `${JSON.stringify(mine?.ok)} / ${JSON.stringify(yours?.ok)}`);
  check("⚠ neither was read as the other's repeat", mine?.repeat !== true && yours?.repeat !== true,
    `${mine?.repeat} / ${yours?.repeat}`);
  check("⚠ ...and each account holds its own record for that key",
    Number(q(`select count(*) from agent.operations where op_key='${splitOperation((await ctxFor(shared, 9)).operation).key}';`)) === 2);
  check("⚠ ...and the account next door can see nothing of ours",
    records(B) === 1, String(records(B)));

  // ═════════════════════════════════════════════════════════════════════════
  console.log("\n10. AN EDIT WHOSE ANSWER WAS LOST — the case the record is FOR");
  // ═════════════════════════════════════════════════════════════════════════
  /**
   * ⚠ **REPRODUCED BEFORE IT WAS FIXED, through this same path**: `change_automation` moved a
   * daily automation from 09:00 to 10:00, the answer was lost, and the retry of the SAME
   * operation read the stored row, found 10:00 already there, computed an empty patch and
   * answered `nothing-asked` — never reaching `patch_automation_once`, which was holding
   * `{ok: true, version: 1, next_run_at: …}` for exactly that identity.
   *
   * **THE NARROW FIX WAS TEMPTING AND IS NOT WHAT SHIPPED.** Only the EMPTY patch was broken
   * — a non-empty one reaches the wrapper, which answers the record itself, measured. But
   * whether the patch comes out empty depends on WHICH FIELD somebody else moved in between:
   * change the time and the retry's patch is non-empty and correct; change the NAME and the
   * retry's patch is empty again and the defect is back. So the record is asked once, above
   * every decision made from the row.
   *
   * A SECOND AGENT, with the authoring tools and a zone, so sections 1–9 keep the agent they
   * were written against.
   */
  const r8MadeB = await api("/api/agent/create", { body: {
    name: "Scheduler", instructions: "Look after the automations.",
    tools: ["make_automation", "change_automation"], zone: "Europe/London" } });
  const r8AG2 = r8MadeB.body?.agent?.id ?? null;
  check("a second agent exists, with a zone a person set", r8MadeB.status === 200 && r8AG2 !== null,
    JSON.stringify(r8MadeB.body).slice(0, 120));

  const r8Change = toolNamed("change_automation");
  const r8MakeAuto = toolNamed("make_automation");
  const r8AtOf = (id) => q(`select coalesce(at_local::text, '(none)') from agent.automations where id='${id}';`);
  const r8NameOf = (id) => q(`select coalesce(name, '(none)') from agent.automations where id='${id}';`);
  const r8Autos = () => Number(q(`select count(*) from agent.automations where agent_id='${r8AG2}';`));

  const r8Plan = { name: "Morning note", schedule: "daily", atLocal: "09:00",
    steps: [{ type: "note", out: "n", text: "good morning" }] };
  const r8Born = await r8MakeAuto.run(r8Plan, await ctxFor(r8Plan, 40, 0, RUN, A, r8AG2));
  const r8AU = r8Born.automation ?? null;
  check("an automation runs daily at 09:00", r8Born.ok === true && r8AtOf(r8AU).startsWith("09:00"),
    `${JSON.stringify(r8Born).slice(0, 90)} / ${r8AtOf(r8AU)}`);

  // ── 1. a successful edit, its answer lost, then the retry ────────────────
  const r8ToTen = { id: r8AU, atLocal: "10:00" };
  const r8Ctx10 = await ctxFor(r8ToTen, 41, 0, RUN, A, r8AG2);
  const r8First10 = await r8Change.run(r8ToTen, r8Ctx10);
  check("the edit moves it to 10:00", r8First10.ok === true && r8AtOf(r8AU).startsWith("10:00"),
    `${JSON.stringify(r8First10).slice(0, 110)} / ${r8AtOf(r8AU)}`);
  // THE ANSWER IS LOST. There is nothing to simulate: the row is committed, the record is
  // written, and nobody wrote the journal entry that would have said so.
  const r8Retry10 = await r8Change.run(r8ToTen, r8Ctx10);
  check("⚠ THE RETRY ANSWERS THE RECORDED SUCCESS, not `nothing-asked`",
    r8Retry10.ok === true && r8Retry10.repeat === true && r8Retry10.error === undefined,
    JSON.stringify(r8Retry10).slice(0, 150));
  check("...and it answers the FIRST attempt's version and next run",
    r8Retry10.version === r8First10.version && r8Retry10.nextRunAt === r8First10.nextRunAt,
    `${r8Retry10.version}/${r8Retry10.nextRunAt} against ${r8First10.version}/${r8First10.nextRunAt}`);
  check("...and `changed` is absent, because the record does not hold it",
    r8Retry10.changed === undefined, JSON.stringify(r8Retry10.changed));
  check("...and exactly ONE record exists for that identity",
    q(`select count(*) from agent.operations where tenant_id='${A}' and op_key='${splitOperation(r8Ctx10.operation).key}';`) === "1");

  // ── 2. somebody else edits it in between ────────────────────────────────
  /**
   * ⚠ **THE FIELD SOMEBODY ELSE MOVES IS THE NAME, DELIBERATELY.** Moving the TIME makes the
   * retry's patch non-empty, and the wrapper would have caught that on its own — so a case
   * written that way passes against the defect. A name change leaves the retry's patch EMPTY
   * (the time it wants is already there), which is exactly the shape that was broken.
   */
  const r8Renamed = await api("/api/agent/automation-update", { body: {
    id: r8AU, name: "Morning note (theirs)", schedule: "daily", at: "10:00", zone: "Europe/London",
    steps: [{ type: "note", out: "n", text: "good morning" }] } });
  check("a person renames it, through their own route", r8Renamed.status === 200 &&
    r8NameOf(r8AU) === "Morning note (theirs)", `${r8Renamed.status} / ${r8NameOf(r8AU)}`);
  const r8RetryAfter = await r8Change.run(r8ToTen, r8Ctx10);
  check("⚠ THE RETRY STILL ANSWERS THE RECORD", r8RetryAfter.ok === true && r8RetryAfter.repeat === true,
    JSON.stringify(r8RetryAfter).slice(0, 130));
  check("⚠ ...AND THE NEWER EDIT SURVIVES IT", r8NameOf(r8AU) === "Morning note (theirs)", r8NameOf(r8AU));
  check("...with the time still where this operation left it", r8AtOf(r8AU).startsWith("10:00"), r8AtOf(r8AU));

  // ── 3. a recorded failure stays a failure ───────────────────────────────
  /**
   * ⚠ **THE FIRST DRAFT OF THE FIX GOT THIS WRONG, and it is why the mapping is shared.** The
   * wrapper records whatever the plain function answered — a refusal included — so a record
   * proves the work HAPPENED and not that it succeeded. Reading every repeat as `ok: true`
   * would launder *"that edit named something an automation does not have"* into *"done"* on
   * the second delivery.
   */
  const r8Bad = { id: r8AU, name: "" };
  const r8CtxBad = await ctxFor(r8Bad, 42, 0, RUN, A, r8AG2);
  const r8FirstBad = await r8Change.run(r8Bad, r8CtxBad);
  check("an edit the database refuses comes back refused", r8FirstBad.ok === false,
    JSON.stringify(r8FirstBad).slice(0, 120));
  const r8RecordedBad = q(`select coalesce(outcome::text, '(none)') from agent.operations
                          where tenant_id='${A}' and op_key='${splitOperation(r8CtxBad.operation).key}';`);
  const r8RetryBad = await r8Change.run(r8Bad, r8CtxBad);
  check("⚠ AND ITS RETRY IS STILL A REFUSAL, never a success",
    r8RetryBad.ok === false && r8RetryBad.error === r8FirstBad.error,
    `${JSON.stringify(r8RetryBad).slice(0, 120)} / recorded ${r8RecordedBad.slice(0, 80)}`);

  // ── 4. the same identity, different arguments ───────────────────────────
  /**
   * The identity is `<run>:<step>:<index>:<the arguments' own hash>`, and `operation_check`
   * compares the action AND the hash — so a slot re-used for a different call is a MISMATCH
   * rather than that call's own operation. Built by hand here, because `run.mjs` cannot
   * produce it: it hashes the arguments it is sending.
   */
  const r8Other = { id: r8AU, atLocal: "12:00" };
  const r8Reused = { capabilities: caps(A, r8AG2),
    operation: `${RUN}:41:0:${await argsHash(r8Other)}` };
  const r8Clash = await r8Change.run(r8Other, r8Reused);
  /**
   * ⚠ **ASSERTED ON THE TOOL'S OWN SENTENCE, because the wrapper refuses this too and the
   * error alone cannot tell them apart.** `patch_automation_once` compares the action and the
   * hash inside its transaction, so with the tool's check deleted this still comes back
   * `operation-mismatch` — measured. The tool's refusal NAMES the action the key was recorded
   * for and the wrapper's does not, which is what makes the case about the wall being tested.
   *
   * **AND THE TOOL'S CHECK IS NOT REDUNDANT, which is why it stays**: the patch here happens
   * to be non-empty, so the wrapper is reached. A reused slot whose patch comes out EMPTY —
   * the first call recorded a rename, the second asks for a time the row already has — never
   * reaches the wrapper at all, and would answer `nothing-asked` about a slot that belongs to
   * another request.
   */
  check("⚠ AN IDENTITY REUSED WITH DIFFERENT ARGUMENTS IS REFUSED",
    r8Clash.ok === false && r8Clash.error === "operation-mismatch" &&
    String(r8Clash.say).includes("patch_automation"), JSON.stringify(r8Clash).slice(0, 140));
  check("...and nothing was changed by it", r8AtOf(r8AU).startsWith("10:00"), r8AtOf(r8AU));

  // ── 5. a genuinely empty NEW request ───────────────────────────────────
  /**
   * ⚠ **THE DISTINCTION THE REQUIREMENT ASKS FOR: an empty new call and a retry of completed
   * work must not collapse into one answer.** A fresh identity naming nothing is still
   * `nothing-asked` — it cost a person an approval, so answering "done" about nothing is the
   * dead control again.
   */
  const r8Nothing = { id: r8AU, atLocal: "10:00" };
  const r8Empty = await r8Change.run(r8Nothing, await ctxFor(r8Nothing, 43, 0, RUN, A, r8AG2));
  check("⚠ A GENUINELY EMPTY NEW REQUEST IS STILL `nothing-asked`",
    r8Empty.ok === false && r8Empty.error === "nothing-asked", JSON.stringify(r8Empty).slice(0, 130));
  check("...and it wrote no record, because nothing was done",
    q(`select count(*) from agent.operations where tenant_id='${A}' and op_key='${RUN}:43:0';`) === "0");
  check("...and the automation is untouched", r8Autos() === 1 && r8AtOf(r8AU).startsWith("10:00"));

  // ── the same class, one tool over ───────────────────────────────────────
  /**
   * ⚠ **`make_automation` HAD THE SAME SHAPE and it is fixed with the same reader.** Its one
   * refusal that depends on something a person can change is `zoneFor`, which READS the
   * account's settings — so clearing the zone between two deliveries would answer `no-zone`
   * about an automation that already exists.
   */
  const r8Plan2 = { name: "Evening note", schedule: "daily", atLocal: "18:00",
    steps: [{ type: "note", out: "n", text: "good evening" }] };
  const r8CtxP2 = await ctxFor(r8Plan2, 44, 0, RUN, A, r8AG2);
  const r8Born2 = await r8MakeAuto.run(r8Plan2, r8CtxP2);
  check("a second automation is created", r8Born2.ok === true && r8Autos() === 2,
    JSON.stringify(r8Born2).slice(0, 110));
  const r8Cleared = await api("/api/agent/update", { body: {
    id: r8AG2, name: "Scheduler", instructions: "Look after the automations.", zone: null } });
  /**
   * ⚠ **ASSERTED AS SQL NULL, not merely as "not a usable zone".** The local shim wrote the
   * STRING `'null'` here (`lit(null)` is `String(null)`), which `agent.zone_is_usable` reads as
   * a zone it does not know — so the tool would have refused `no-zone` for the RIGHT reason
   * from the wrong state, and the case would have passed while the setting was neither set nor
   * cleared. `zone is null` is the only reading that tells the two apart.
   */
  check("a person then clears the account's time zone", r8Cleared.status === 200 &&
    q(`select case when zone is null then 'cleared' else 'still ' || quote_literal(zone) end
        from agent.agents where id='${r8AG2}';`) === "cleared",
    q(`select coalesce(quote_literal(zone), 'NULL') from agent.agents where id='${r8AG2}';`));
  const r8RetryBorn = await r8MakeAuto.run(r8Plan2, r8CtxP2);
  check("⚠ THE RETRY ANSWERS THE RECORD RATHER THAN `no-zone`",
    r8RetryBorn.ok === true && r8RetryBorn.repeat === true && r8RetryBorn.automation === r8Born2.automation,
    JSON.stringify(r8RetryBorn).slice(0, 140));
  check("...and no second automation was made", r8Autos() === 2, String(r8Autos()));

  // ═════════════════════════════════════════════════════════════════════════
  console.log("\n9. WHAT NONE OF IT LEFT BEHIND");
  // ═════════════════════════════════════════════════════════════════════════
  check("no run is still claimed", q(`select count(*) from agent.run_work where claimed_by is not null and done_at is null;`) === "0");
  check("⚠ no operation record has a null outcome — a claim and its answer are one commit",
    q(`select count(*) from agent.operations where outcome is null;`) === "0");
  check("⚠ every record names an action the store really has",
    q(`select coalesce(string_agg(distinct action, ','), '') from agent.operations;`)
      .split(",").filter(Boolean).every((a) => CAPABILITY_WRITES.some((w) => CAPABILITY_RPC[w] === a)));
  check("⚠ and no provider was reached anywhere",
    q(`select coalesce(string_agg(distinct coalesce(model, 'none'), ','), '(none)') from agent.runs;`)
      .split(",").every((m) => m === "none" || m === "stand-in"));
} finally {
  await stack.tearDown();
}

console.log("");
if (failed) { console.log(`FAILED — ${failed}`); for (const f of fails) console.log(`  - ${f}`); process.exit(1); }
console.log("all checks passed");
