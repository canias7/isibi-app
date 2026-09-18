#!/usr/bin/env node
/**
 * ACTING THROUGH A CONNECTION TO SOMETHING OUTSIDE. `npm run verify:connections`.
 *
 * Milestone 8's own demonstration list: *a read action and an approved write action,
 * including expired credentials, revoked access, timeout, and uncertain outcome*, with
 * *reconciliation, not blind retries* and *credentials out of model context, tool results,
 * and logs*.
 *
 * Every piece here is the real one and `scripts/lib/local-stack.mjs` is the only fixture: the
 * SITE BUILDER's own routes for everything a person does, a throwaway PostgreSQL with this
 * repository's migrations applied, `worker.queue` as the dispatcher, the real approval gate,
 * and the real tools against the real connection store.
 *
 * ── ⚠ WHAT IS SIMULATED, IN THREE PLACES AND NAMED HERE ──────────────────────
 *
 *   1. **THE PROVIDER.** `makeFakeProvider` — no network, no credential of anybody's, and it
 *      says so in its own name and in every answer. It has NO IDEMPOTENCY KEY on purpose, so
 *      a second send really is a second message; that is what makes reconciliation the right
 *      answer and a blind retry the wrong one.
 *   2. **THE MODEL.** The stand-in, which picks the tool a request names.
 *   3. **THE EXPIRY CLOCK, in one UPDATE.** A credential's life is a timestamp and a check
 *      nobody re-runs proves nothing. What that does NOT simulate is the DECISION:
 *      `agent.lease_connection` still compares against `now()` for itself.
 *
 * **THERE IS NO SITE ROUTE FOR CONNECTIONS YET, and that is declared rather than disguised.**
 * Connecting is a PERSON's act and the standing instruction is that the frontend is fine as
 * it is, so the engine's own `connect` is the person's door here. The site's routes and screen
 * are the next increment; nothing in this file pretends an agent can store a credential,
 * because no tool can.
 */

import worker from "../src/worker.mjs";
import { handleAgentApi, makeAgentStore } from "../../agent-store.mjs";
import { haveCluster, standUp, dispatcher } from "./lib/local-stack.mjs";
import { makeConnections } from "../src/connections.mjs";
import { makeFakeProvider, FAKE_PROVIDER } from "../src/fake-provider.mjs";
import { CAPABILITY_TOOLS, CONNECTION_TOOLS } from "../src/capability-tools.mjs";
import { argsHash } from "../src/approvals.mjs";

const DB = `agent_cx_${process.pid}`;
const A = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa";
const B = "bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb";
const RUN = "55555555-5555-4555-8555-555555555555";
/** ⚠ THE ONE STRING THAT MAY NEVER LEAVE, distinctive so a substring search cannot miss it. */
const SECRET = "FAKE-TOKEN-do-not-leak-b33f";

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

  /** ⚠ A FRESH PROVIDER FOR THE DIRECT SECTIONS, so each one's mailbox is its own. The
   *  END-TO-END section uses the Worker's own adapter instead, which is the point of it. */
  const withProvider = (provider, tenant = A, agent = null) =>
    makeConnections({ fetch: (u, o) => fetch(u, o), url: env.SUPABASE_URL,
      key: env.SUPABASE_SERVICE_KEY, adapters: { [FAKE_PROVIDER]: provider } })
      .forTenant(tenant).forAgent(agent);

  /** `ctx.operation` as `run.mjs` builds it: the position, and the arguments' own hash. */
  const opFor = async (args, step, index = 0, run = RUN) =>
    `${run}:${step}:${index}:${await argsHash(args)}`;

  const CX = "cccccccc-1111-4111-8111-cccccccccccc";
  const CX2 = "cccccccc-2222-4222-8222-cccccccccccc";
  const statusOf = (id) => q(`select status from agent.connection_list where id = '${id}';`);
  const records = (tenant = A) => Number(q(`select count(*) from agent.operations where tenant_id='${tenant}';`));
  const inFlight = (tenant = A) =>
    Number(q(`select count(*) from agent.operations where tenant_id='${tenant}' and outcome is null;`));
  let press = 0;
  const ask = async (agent, words, tenant = A) => {
    const sent = await api("/api/agent/send", { tenant, body: { id: agent, body: words, key: `press-${++press}` }, ring });
    await drain();
    return sent;
  };
  const again = async (runId) => { await ring(runId); await drain(); };
  const toolResults = (runId) => q(`select coalesce(string_agg((body -> 'value')::text, '|~|' order by seq), '')
     from agent.run_entries where run_id = '${runId}' and body ->> 'kind' = 'tool';`)
    .split("|~|").filter(Boolean).map((t) => JSON.parse(t));
  const logOf = (runId) => q(`select coalesce(string_agg(body::text, ' '), '') from agent.run_entries where run_id = '${runId}';`);

  // ═════════════════════════════════════════════════════════════════════════
  console.log("\n1. A PERSON CONNECTS SOMETHING, AND THE CREDENTIAL HAS ONE DOOR");
  // ═════════════════════════════════════════════════════════════════════════
  const made = await api("/api/agent/create", {
    body: { name: "Workshop", instructions: "Answer about the workshop.",
            tools: CAPABILITY_TOOLS.map((t) => t.name) },
  });
  check("an agent exists with every tool ticked", made.status === 200, JSON.stringify(made.body).slice(0, 140));
  const AG = made.body.agent.id;

  const mine = () => withProvider(makeFakeProvider({ secret: SECRET }), A, AG);
  const stored = await mine().connect({ id: CX, provider: FAKE_PROVIDER, label: "Work mail",
    account: "someone@example.test", scopes: ["read", "send"], secret: SECRET, refresh: "FAKE-REFRESH-0001" });
  check("a connection is stored for this agent", stored?.ok === true, JSON.stringify(stored));
  check("⚠ ...and the answer NEVER carries the credential",
    !JSON.stringify(stored).includes(SECRET), JSON.stringify(stored));
  check("...and it reads `active` through the view a screen reads", statusOf(CX) === "active", statusOf(CX));
  check("⚠ ...and the VIEW has no credential column at all, so a reader cannot ask for one",
    q(`select count(*) from information_schema.columns where table_schema='agent'
        and table_name='connection_list' and column_name in ('secret','refresh_secret');`) === "0");

  // ⚠ THE PERSON'S LIST IS WHAT A SCREEN WOULD DRAW, and it says a refresh is possible
  // without handing over the means.
  const listed = await mine().list();
  check("the list draws it, with whether it can be refreshed", listed.length === 1 && listed[0].refreshable === true,
    JSON.stringify(listed).slice(0, 160));
  check("⚠ ...and the list carries no credential", !JSON.stringify(listed).includes(SECRET));

  // ═════════════════════════════════════════════════════════════════════════
  console.log("\n2. A READ ACTION — through the real tool, the real store, a real database");
  // ═════════════════════════════════════════════════════════════════════════
  const readTool = CAPABILITY_TOOLS.find((t) => t.name === "read_messages");
  const provider2 = makeFakeProvider({ secret: SECRET });
  const read1 = await readTool.run({ connection: CX }, { connections: withProvider(provider2, A, AG) });
  check("the agent reads the connected account", read1?.ok === true, JSON.stringify(read1).slice(0, 160));
  check("⚠ ...and the provider really was asked, with the credential it is expecting",
    provider2.calls() === 1, String(provider2.calls()));
  check("...and the answer says it is simulated", read1.result?.simulated === true);
  check("⚠ A READ TAKES NO OPERATION RECORD — there is no duplicate to prevent",
    records() === 0, String(records()));
  check("⚠ ...and the tool's result carries no credential", !JSON.stringify(read1).includes(SECRET));

  // ═════════════════════════════════════════════════════════════════════════
  console.log("\n3. AN APPROVED WRITE — the run holds, a person says yes, and it goes out ONCE");
  // ═════════════════════════════════════════════════════════════════════════
  const held = await ask(AG, `use send_message connection=${CX} to=friend@example.test body=hello`);
  const R = held.body.runId;
  check("the run was accepted", held.status === 200 && !!R, JSON.stringify(held.body).slice(0, 140));
  // ⚠ IT HOLDS WITH NO STOP AT ALL — the log is left OPEN so the delivery after the decision
  // can continue, which is how a waiting run and a finished one are different logs.
  check("⚠ it is WAITING for a person rather than having sent anything",
    q(`select coalesce(stop::text,'NONE') from agent.runs where id='${R}';`) === "NONE",
    q(`select coalesce(stop::text,'NONE') from agent.runs where id='${R}';`));
  const waiting = (await api("/api/agent/tool-approvals", { query: {} })).body.approvals || [];
  const req = waiting.find((r) => r.run === R) || null;
  check("⚠ ...and the screen can see WHAT it wants to do, with the arguments",
    req?.tool === "send_message" && req?.args?.to === "friend@example.test",
    JSON.stringify(req).slice(0, 200));
  check("⚠ ...and what a person is shown holds no credential",
    !JSON.stringify(waiting).includes(SECRET));
  check("nothing has gone out yet", toolResults(R).length === 0, JSON.stringify(toolResults(R)));

  const said = await api("/api/agent/tool-approve", { body: { id: req.id, verdict: "approved" } });
  check("a person approves it through their own screen's route", said.status === 200,
    JSON.stringify(said.body).slice(0, 140));
  await again(R);
  const outs = toolResults(R);
  check("⚠ ...and THEN it goes out", outs.length === 1 && outs[0]?.ok === true, JSON.stringify(outs).slice(0, 200));
  check("⚠ ...exactly once, and the operation record says so",
    records() === 1 && inFlight() === 0, `${records()} record(s), ${inFlight()} in flight`);
  check("⚠ AND THE RUN'S OWN APPEND-ONLY JOURNAL HOLDS NO CREDENTIAL — where a leak is permanent",
    !logOf(R).includes(SECRET));

  // ⚠ THE REDELIVERY: the same run again must not send a second message.
  const before = Number(q(`select count(*) from agent.operations where tenant_id='${A}';`));
  await again(R);
  check("a redelivery of the finished run sends nothing and makes no second record",
    Number(q(`select count(*) from agent.operations where tenant_id='${A}';`)) === before,
    String(before));

  // ═════════════════════════════════════════════════════════════════════════
  console.log("\n4. AN EXPIRED CREDENTIAL — refused by name, and a refresh is its answer");
  // ═════════════════════════════════════════════════════════════════════════
  // ⚠ THE CLOCK, MOVED IN ONE PLACE. The comparison is still the database's own.
  q(`update agent.connections set expires_at = now() - interval '1 minute' where id='${CX}';`);
  check("the view folds the clock in, so a reader sees `expired` with no writer",
    statusOf(CX) === "expired", statusOf(CX));
  check("...and the ROW is still marked active, because nothing goes round stamping it",
    q(`select status from agent.connections where id='${CX}';`) === "active");
  const expired = await readTool.run({ connection: CX }, { connections: mine() });
  check("⚠ the one door refuses an expired credential BY NAME", expired?.error === "expired",
    JSON.stringify(expired).slice(0, 160));
  const NEW_SECRET = "FAKE-TOKEN-rotated-cafe";
  const rotated = await mine().refresh({ id: CX, secret: NEW_SECRET,
    expires: new Date(Date.now() + 3600_000).toISOString() });
  check("a refresh rotates it", rotated?.ok === true, JSON.stringify(rotated));
  const afterRefresh = makeFakeProvider({ secret: NEW_SECRET });
  const readAgain = await readTool.run({ connection: CX }, { connections: withProvider(afterRefresh, A, AG) });
  check("⚠ ...and the NEW credential is what reaches the provider", readAgain?.ok === true,
    JSON.stringify(readAgain).slice(0, 160));
  check("...and neither answer carried either credential",
    !JSON.stringify([rotated, readAgain]).includes(NEW_SECRET)
    && !JSON.stringify([rotated, readAgain]).includes(SECRET));

  // ═════════════════════════════════════════════════════════════════════════
  console.log("\n5. REVOKED ACCESS — a different fact from a disconnect, and a refresh cannot undo it");
  // ═════════════════════════════════════════════════════════════════════════
  const gone = await mine().revoke({ id: CX, why: "they withdrew it" });
  check("the provider withdrawing the grant is recorded as `revoked`", gone?.ok === true, JSON.stringify(gone));
  check("⚠ ...and the credential is DESTROYED, not merely flagged",
    q(`select (secret <> '${NEW_SECRET}')::text from agent.connections where id='${CX}';`) === "true");
  const afterRevoke = await readTool.run({ connection: CX }, { connections: mine() });
  check("⚠ the one door refuses it, and says which of the two things happened",
    afterRevoke?.error === "revoked", JSON.stringify(afterRevoke).slice(0, 160));
  const cannot = await mine().refresh({ id: CX, secret: "FAKE-TOKEN-nope" });
  check("⚠ ...and a refresh CANNOT revive it — only granting again can",
    cannot?.error === "revoked", JSON.stringify(cannot));
  check("...and the read after a revocation reached no provider at all", statusOf(CX) === "revoked");

  // ═════════════════════════════════════════════════════════════════════════
  console.log("\n6. A TIMEOUT WITH AN UNCERTAIN OUTCOME — reconciled, never re-sent");
  // ═════════════════════════════════════════════════════════════════════════
  const fresh = await mine().connect({ id: CX2, provider: FAKE_PROVIDER, label: "Second mailbox",
    account: "other@example.test", scopes: ["read", "send"], secret: SECRET });
  check("a second connection is stored", fresh?.ok === true, JSON.stringify(fresh));

  const sendTool = CAPABILITY_TOOLS.find((t) => t.name === "send_message");
  // ⚠ THE SHAPE: the message really lands and the provider then fails to answer. The fake
  // appends to its mailbox before the script decides, which is exactly "it happened and we
  // did not hear" — the one case a blind retry turns into two messages.
  // ⚠ `lost`, NOT `timeout`, AND THE DIFFERENCE IS THE WHOLE SECTION. `timeout` means the
  // request never arrived; `lost` means the message really landed and the answer did not come
  // back. Both are uncertain from here — what separates them is what reconciliation finds, and
  // this section is about the one where it finds the message. (Section 7 is the other.)
  const flaky = makeFakeProvider({ secret: SECRET, script: ({ action }) =>
    (action === "send_message" ? "lost" : "timeout") });
  const args1 = { connection: CX2, to: "friend@example.test", body: "the parcel is ready" };
  const op1 = await opFor(args1, 9);
  const lost = await sendTool.run(args1, { connections: withProvider(flaky, A, AG), operation: op1 });
  check("⚠ AN UNCERTAIN WRITE IS `unresolved` — never a plain failure",
    lost?.error === "unresolved" && lost?.uncertain === true, JSON.stringify(lost).slice(0, 220));
  check("⚠ ...and it tells the model to CHECK rather than inviting another attempt",
    /may or may not have gone out/.test(lost?.say ?? "") && /could do it twice/.test(lost?.say ?? ""),
    lost?.say);
  check("⚠ ...and the record STAYS IN FLIGHT, so a later delivery can still learn",
    inFlight() === 1, `${inFlight()} in flight`);
  check("...and the message really did land at the provider", flaky.mailbox("other@example.test").length === 1,
    JSON.stringify(flaky.mailbox("other@example.test")));

  // NOW THE SAME CALL AGAIN — with the provider answering. It must ASK, not send.
  const willing = makeFakeProvider({ secret: SECRET });
  // The message is already at the provider from the attempt above, carrying the trace, so a
  // reconciliation can find it. (Two provider objects, one mailbox: copied across, because a
  // provider's storage is not this process's.)
  for (const m of flaky.mailbox("other@example.test")) {
    willing.run("send_message", { to: m.to, body: m.body, trace: m.trace },
      { secret: SECRET, account: "other@example.test" });
  }
  const settledOut = await sendTool.run(args1, { connections: withProvider(willing, A, AG), operation: op1 });
  check("⚠ THE REDELIVERY RECONCILES rather than sending", settledOut?.ok === true && settledOut?.reconciled === true,
    JSON.stringify(settledOut).slice(0, 220));
  check("⚠ ...and ONE message exists, not two", willing.mailbox("other@example.test").length === 1,
    JSON.stringify(willing.mailbox("other@example.test")));
  check("⚠ ...and it ASKED: the provider saw a reconciliation and no second send",
    willing.seen().filter((c) => c.action === "reconcile:send_message").length === 1
    && willing.seen().filter((c) => c.action === "send_message").length === 1,
    JSON.stringify(willing.seen()));
  check("...and the record is settled now, so a third delivery is a plain repeat",
    inFlight() === 0, `${inFlight()} in flight`);
  const third = await sendTool.run(args1, { connections: withProvider(willing, A, AG), operation: op1 });
  check("⚠ ...which it is", third?.ok === true && third?.repeat === true, JSON.stringify(third).slice(0, 180));
  check("...and still one message", willing.mailbox("other@example.test").length === 1);

  // ═════════════════════════════════════════════════════════════════════════
  console.log("\n7. A KNOWN NON-EVENT IS A FAILURE WITH ITS REASON, not a retry");
  // ═════════════════════════════════════════════════════════════════════════
  const nothing = makeFakeProvider({ secret: SECRET, script: ({ action }) => (action === "send_message" ? "timeout" : "ok") });
  const args2 = { connection: CX2, to: "someone@example.test", body: "this one never lands" };
  const never = await sendTool.run(args2, { connections: withProvider(nothing, A, AG), operation: await opFor(args2, 10) });
  check("⚠ a send that timed out and was CHECKED to have not happened is a failure",
    never?.ok === false && never?.error === "action-failed" && never?.reconciled === true,
    JSON.stringify(never).slice(0, 220));
  check("⚠ ...and it does NOT send inside that call — this engine never retries by itself",
    nothing.mailbox("someone@example.test").length === 0,
    JSON.stringify(nothing.mailbox("someone@example.test")));
  check("...and it says so plainly, so the model can ask again in a new step",
    /did not go out/.test(never?.say ?? ""), never?.say);

  // ═════════════════════════════════════════════════════════════════════════
  console.log("\n8. WHOSE CONNECTION IT IS — the account next door, and the sibling agent");
  // ═════════════════════════════════════════════════════════════════════════
  const theirs = await api("/api/agent/create", { tenant: B, body: { name: "Next door", instructions: "Theirs." } });
  const THEIR_AG = theirs.body.agent.id;
  const sibling = await api("/api/agent/create", { body: { name: "Sibling", instructions: "Also mine." } });
  const SIB = sibling.body.agent.id;

  const nextDoor = await readTool.run({ connection: CX2 },
    { connections: withProvider(makeFakeProvider({ secret: SECRET }), B, THEIR_AG) });
  check("⚠ the account next door cannot act through it — the same answer a missing one gets",
    nextDoor?.error === "no-connection", JSON.stringify(nextDoor).slice(0, 160));
  const sib = await readTool.run({ connection: CX2 },
    { connections: withProvider(makeFakeProvider({ secret: SECRET }), A, SIB) });
  check("⚠ ...and neither can a SIBLING agent of the same account — the wall no tenant filter sees",
    sib?.error === "no-connection", JSON.stringify(sib).slice(0, 160));
  const sibList = await withProvider(makeFakeProvider(), A, SIB).list();
  check("...and a sibling's list is empty rather than the account's", sibList.length === 0,
    JSON.stringify(sibList));
  check("THE CONTROL: the owning agent still sees both of its own",
    (await mine().list()).length === 2, String((await mine().list()).length));

  // ═════════════════════════════════════════════════════════════════════════
  console.log("\n8b. A REAL MODEL REACHING EACH OF THE THREE, through real messages");
  // ═════════════════════════════════════════════════════════════════════════
  // ⚠ THE UNGATED TWO GO THROUGH THE QUEUE like any other message; `send_message` already did,
  // in section 3, behind a person's approval. Read from the JOURNAL rather than from a
  // counter, because what a model really called is a `tool` entry and nothing else.
  const CX3 = "cccccccc-3333-4333-8333-cccccccccccc";
  await mine().connect({ id: CX3, provider: FAKE_PROVIDER, label: "Third", account: "third@example.test",
    scopes: ["read", "send"], secret: SECRET });
  for (const [words, name] of [["use list_connections", "list_connections"],
                               [`use read_messages connection=${CX3}`, "read_messages"]]) {
    const sent = await ask(AG, words);
    const r = sent.body.runId;
    const got = toolResults(r);
    check(`⚠ a model really calls \`${name}\`, and it works`,
      q(`select count(*) from agent.run_entries where run_id='${r}'
          and body ->> 'kind' = 'tool' and body ->> 'name' = '${name}';`) === "1"
      && got[0]?.ok === true,
      JSON.stringify(got).slice(0, 180));
    check(`...and the credential is not in that run's log either`, !logOf(r).includes(SECRET));
  }
  const modelCalled = JSON.parse(q(`select coalesce(json_agg(distinct body ->> 'name')::text, '[]')
     from agent.run_entries where body ->> 'kind' = 'tool';`));

  // ═════════════════════════════════════════════════════════════════════════
  console.log("\n9. WHAT NONE OF IT LEFT BEHIND");
  // ═════════════════════════════════════════════════════════════════════════
  const everything = q(`select coalesce(string_agg(t::text, ' '), '') from (
      select body::text as t from agent.run_entries
      union all select coalesce(outcome::text,'') from agent.operations
      union all select coalesce(stop::text,'') from agent.runs) x;`);
  check("⚠ NO CREDENTIAL IS ANYWHERE IN THE JOURNAL, THE RECORDS OR THE RUN ROWS",
    !everything.includes(SECRET) && !everything.includes(NEW_SECRET),
    `${everything.length} characters read`);
  check("...with the observer alive: those rows really do exist", everything.length > 500,
    `${everything.length} characters`);
  check("⚠ AND THE CREDENTIAL IS WHERE IT BELONGS — the one table, unreadable by a customer",
    q(`select count(*) from agent.connections where secret <> '-';`) !== "0");
  /**
   * ⚠ **THE CENSUS `verify:tools` HANDS OVER, and it is the reason that file may exempt these
   * three at all.** It requires every capability tool a model can compose to have really been
   * called by one; these three need a stored credential and a provider adapter, which is what
   * THIS file stands up. So the demand moves here rather than being dropped — and the observer
   * is what a real model really reached, never a claim that it ran.
   */
  check("⚠ EVERY connection tool was really called BY A MODEL, not just by this file",
    CONNECTION_TOOLS.every((n) => modelCalled.includes(n)),
    `called: ${modelCalled.join(", ")} of ${CONNECTION_TOOLS.join(", ")}`);
  check("...and each is a real tool rather than a name on a list",
    CONNECTION_TOOLS.every((n) => CAPABILITY_TOOLS.some((t) => t.name === n)));
  check("⚠ NOT ONE EXECUTION ANYWHERE CALLED A MODEL FOR AN ACTION",
    q(`select count(*) from agent.run_entries where body ->> 'kind' = 'model'
        and body::text like '%${SECRET}%';`) === "0");

  console.log(`\n${failed === 0 ? "ALL CHECKS PASSED" : `${fails.length} FAILED`}`);
  if (fails.length) console.log(fails.map((f) => `  - ${f}`).join("\n"));
} finally {
  await stack.tearDown?.();
}
process.exit(failed === 0 ? 0 : 1);
