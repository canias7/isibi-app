/**
 * PARTIAL EDITS — the effective `(steps, inputs)` combination, on every shape of edit.
 *
 * **THE DEMONSTRATION THE MILESTONE ASKED FOR, in its own words:** an inputs-only edit
 * validated against the EXISTING steps, a steps-only edit against the CURRENT declarations,
 * a combined edit against itself; input types, defaults, required values, loops, branches
 * and references to earlier outputs all covered; omitted fields preserved with no whole-row
 * replacement from a browser's snapshot; an invalid edit refused with a useful explanation
 * and the stored automation left exactly as it was; and **two overlapping edits**, where the
 * combination that was validated is not allowed to differ from the combination written.
 *
 * ⚠ **A FAKE STORE THAT ACCEPTS A PATCH CANNOT PROVE THE LAST ONE, which is why this file
 * exists beside `test/agent-automations.test.mjs` rather than instead of it.** The
 * concurrency guarantee is `agent.patch_automation`'s compare-and-set under its own row
 * lock, and a fake that answers `{ok: true}` demonstrates the caller's arithmetic and
 * nothing about the wall. Every check below reads the ROW back out of PostgreSQL.
 *
 * Every piece is the real one, and `scripts/lib/local-stack.mjs` is the only fixture:
 *
 *   * the SITE BUILDER's route — `handleAgentApi` out of `agent-store.mjs`, a customer's
 *     own door, driven twice over as two browsers holding the same automation open.
 *   * the DATABASE — a throwaway PostgreSQL with this repository's migrations applied, so
 *     the version counter, the wholeness constraints and the locked resolution are the
 *     genuine article.
 *   * the VALIDATOR — `cleanWorkflow`, which is the door a save really goes through, and
 *     the engine's own `readWorkflow` beside it, so "the rules are shared with the
 *     executor" is a comparison rather than a claim.
 *
 * ── ⚠ WHAT IS SIMULATED, in one place ─────────────────────────────────────────
 *
 * The TRANSPORT only: PostgREST is a local shim, because it is not reachable from a laptop.
 * **There is no model call anywhere in this file and no automation is ever executed** — what
 * is under test is what may be SAVED, so nothing here needs a dispatcher, a queue or a
 * provider. No clock is pushed and no state is written behind a function's back.
 *
 * ⚠ NOT A STATEMENT ABOUT THE DEPLOYMENT. Nothing here touches the hosted project.
 */

import { handleAgentApi, makeAgentStore, cleanWorkflow, AUTOMATION_STEPS, MAX_AUTOMATION_STEPS }
  from "../../agent-store.mjs";
import { readWorkflow } from "../src/automations.mjs";
import { haveCluster, standUp } from "./lib/local-stack.mjs";

const DB = `agent_ed_${process.pid}`;
const A = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa";   // one account
const B = "bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb";   // the account next door
const AG = "11111111-1111-4111-8111-111111111111";
const THEIR_AG = "33333333-3333-4333-8333-333333333333";

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
  const api = (p, { tenant = A, body = {}, query = null } = {}) => handleAgentApi({
    path: p, method: query ? "GET" : "POST",
    tenant, body, query: new URLSearchParams(query || {}), store: appStore(),
    ring: async () => ({ ok: true }),
    newId: () => `00000000-0000-4000-8000-${String(++minted).padStart(12, "0")}`,
    log: () => {},
  });

  /**
   * ⚠ **ONE FINGERPRINT OF EVERYTHING AN EDIT COULD HAVE MOVED, so "the stored automation is
   * unchanged" is a comparison rather than a list somebody kept.** A field added to that
   * table and not to this expression would go unwatched, so the columns are named once and
   * the checks compare the digest — `updated_at` included, because a refused edit must not
   * have taken the lock and touched it either.
   */
  const FINGERPRINT = "name, enabled, schedule, at_local, zone, days, on_date, on_event, steps, inputs, version, updated_at";
  const mark = (id) => q(`select md5(row(${FINGERPRINT})::text) from agent.automations where id='${id}';`);
  const shape = (id) => JSON.parse(q(`select json_build_object('name',name,'version',version,
    'steps',coalesce(steps,'[]'::jsonb),'inputs',coalesce(inputs,'[]'::jsonb),
    'schedule',schedule,'at',at_local::text,'zone',zone)::text
    from agent.automations where id='${id}';`));

  q(`insert into agent.agents (id, tenant_id, name, instructions) values
       ('${AG}','${A}','Shop','Answer about the shop.'),
       ('${THEIR_AG}','${B}','Next door','Theirs.');`);

  /** An automation that declares one input and refers to it from a step. */
  const make = async (name, { inputs, steps }) => {
    const r = await api("/api/agent/automation-create", {
      body: { agent: AG, name, schedule: "manual", inputs, steps },
    });
    check(`set up: ${name} is saved`, r.status === 200 && typeof r.body.id === "string", JSON.stringify(r.body));
    return r.body.id;
  };
  const edit = (body, tenant = A) => api("/api/agent/automation-update", { tenant, body });

  // ═════════════════════════════════════════════════════════════════════════
  console.log("\n1. AN INPUTS-ONLY EDIT IS CHECKED AGAINST THE STEPS THAT ARE ALREADY THERE");
  // ═════════════════════════════════════════════════════════════════════════
  /**
   * ⚠ **THE REPRODUCTION.** A stored step refers to `{{customer}}`; an edit that names only
   * the declarations removes it. Before this round the route never asked for the stored steps
   * at all (`patchNeedsStored` was `steps && !inputs`), so the patch was accepted, written,
   * and the NEXT execution failed at step 1 for a value nothing produced — days later, on a
   * run that had already done the steps above it.
   */
  const one = await make("Greeting", {
    inputs: [{ name: "customer", label: "Who", type: "text", required: true }],
    steps: [{ type: "note", text: "Hello {{customer}}" }],
  });
  const beforeDrop = mark(one);

  const dropped = await edit({ id: one, inputs: [] });
  check("⚠ removing an input a stored step refers to is REFUSED", dropped.status === 400, JSON.stringify(dropped.body));
  check("...and the explanation names the value and the step", /customer/.test(dropped.body.error ?? "")
    && /step 1/.test(dropped.body.error ?? ""), JSON.stringify(dropped.body.error));
  check("...and the stored automation is byte-identical afterwards", mark(one) === beforeDrop);

  // A RENAME IS THE SAME SHAPE AND IS THE COMMONER ONE.
  const renamedInput = await edit({ id: one, inputs: [{ name: "client", label: "Who", type: "text", required: true }] });
  check("⚠ RENAMING that input is refused for the same reason", renamedInput.status === 400
    && /customer/.test(renamedInput.body.error ?? ""), JSON.stringify(renamedInput.body));
  check("...and still nothing was written", mark(one) === beforeDrop);

  /**
   * THE CONTROL, without which "an inputs-only edit is checked" is satisfied by a door that
   * refuses every inputs-only edit. The same shape of edit — declarations only, nothing about
   * the steps — goes through when the combination it leaves is whole.
   */
  const addedInput = await edit({
    id: one,
    inputs: [{ name: "customer", label: "Customer", type: "text", required: true },
             { name: "note", label: "Note", type: "text" }],
  });
  check("...and the CONTROL: an inputs-only edit that keeps the combination whole is saved",
    addedInput.status === 200, JSON.stringify(addedInput.body));
  const afterAdd = shape(one);
  check("...with the new declaration stored", afterAdd.inputs.length === 2
    && afterAdd.inputs.map((i) => i.name).join(",") === "customer,note", JSON.stringify(afterAdd.inputs));
  check("⚠ ...and the STEPS untouched — the validator's canonical list is never written back",
    JSON.stringify(afterAdd.steps.map((s) => s.type)) === '["note"]'
    && afterAdd.steps[0].text === "Hello {{customer}}", JSON.stringify(afterAdd.steps));
  check("...and the version moved, because what it asks for changed", afterAdd.version === 2, String(afterAdd.version));

  // ═════════════════════════════════════════════════════════════════════════
  console.log("\n2. A STEPS-ONLY EDIT IS CHECKED AGAINST THE DECLARATIONS AS THEY STAND");
  // ═════════════════════════════════════════════════════════════════════════
  const beforeSteps = mark(one);
  const strayRef = await edit({ id: one, steps: [{ type: "note", text: "Hello {{nobody}}" }] });
  check("a step referring to something nothing declares is refused", strayRef.status === 400
    && /nobody/.test(strayRef.body.error ?? ""), JSON.stringify(strayRef.body));
  check("...and nothing was written", mark(one) === beforeSteps);

  const goodSteps = await edit({
    id: one,
    steps: [{ type: "note", text: "Hi {{customer}}" }, { type: "note", text: "PS {{note}}" }],
  });
  check("...and the CONTROL: steps referring to the stored declarations are saved",
    goodSteps.status === 200, JSON.stringify(goodSteps.body));
  const afterSteps = shape(one);
  check("...with the declarations untouched", afterSteps.inputs.length === 2, JSON.stringify(afterSteps.inputs));
  check("...and the version moved again", afterSteps.version === 3, String(afterSteps.version));

  // ═════════════════════════════════════════════════════════════════════════
  console.log("\n3. AN EDIT NAMING BOTH IS CHECKED AGAINST ITSELF, AND READS NOTHING");
  // ═════════════════════════════════════════════════════════════════════════
  /**
   * ⚠ **AND THIS IS THE ONE SHAPE THAT MUST NOT FENCE.** The verdict drew on no stored value,
   * so there is nothing for a concurrent change to invalidate — fencing here would refuse an
   * edit that is self-contained, for a reason the person could do nothing about.
   */
  const both = await edit({
    id: one,
    inputs: [{ name: "who", label: "Who", type: "text", required: true }],
    steps: [{ type: "note", text: "Hello {{who}}" }],
  });
  check("an edit that names both halves is saved on its own terms", both.status === 200, JSON.stringify(both.body));
  const afterBoth = shape(one);
  check("...with both stored", afterBoth.inputs[0]?.name === "who"
    && afterBoth.steps[0]?.text === "Hello {{who}}", JSON.stringify(afterBoth));

  const bothBad = await edit({
    id: one,
    inputs: [{ name: "who", label: "Who", type: "text" }],
    steps: [{ type: "note", text: "Hello {{someone}}" }],
  });
  check("...and a self-inconsistent pair is refused", bothBad.status === 400
    && /someone/.test(bothBad.body.error ?? ""), JSON.stringify(bothBad.body));

  // ═════════════════════════════════════════════════════════════════════════
  console.log("\n4. TYPES, LOOPS, BRANCHES AND EARLIER OUTPUTS — the whole validated surface");
  // ═════════════════════════════════════════════════════════════════════════
  /**
   * ⚠ **A TYPE IS PART OF THE COMBINATION, so retyping a declared input is an inputs-only
   * edit that a stored LOOP refuses.** `repeat … each` accepts a `list` and nothing else, so
   * *"a list input a person can declare and never use"* and *"a list input they can silently
   * turn into text"* are the same defect from either end.
   */
  const looped = await make("Round each line", {
    inputs: [{ name: "lines", label: "Lines", type: "list", required: true }],
    steps: [
      { type: "repeat", mode: "each", each: "{{lines}}", as: "line" },
      { type: "note", text: "line {{line}}" },
      { type: "endrepeat" },
    ],
  });
  const beforeRetype = mark(looped);
  const retyped = await edit({ id: looped, inputs: [{ name: "lines", label: "Lines", type: "text", required: true }] });
  check("⚠ retyping a declared list to text is refused, because a stored loop goes over a list",
    retyped.status === 400 && /lines/.test(retyped.body.error ?? ""), JSON.stringify(retyped.body));
  check("...and nothing was written", mark(looped) === beforeRetype);
  check("...and the CONTROL: the same edit keeping the KIND is saved",
    (await edit({ id: looped, inputs: [{ name: "lines", label: "Every line", type: "list", required: true }] })).status === 200);

  // A BRANCH'S ARMS, AND A VALUE BOUND ONLY ON ONE OF THEM.
  const branched = await make("Only on one arm", {
    inputs: [{ name: "kind", label: "Kind", type: "text", required: true }],
    steps: [
      { type: "if", left: "{{kind}}", op: "is", right: "big" },
      { type: "knowledge", query: "{{kind}}", out: "found" },
      { type: "otherwise" },
      { type: "note", text: "small" },
      { type: "end" },
      { type: "note", text: "done" },
    ],
  });
  const armOnly = await edit({
    id: branched,
    steps: [
      { type: "if", left: "{{kind}}", op: "is", right: "big" },
      { type: "knowledge", query: "{{kind}}", out: "found" },
      { type: "otherwise" },
      { type: "note", text: "small" },
      { type: "end" },
      { type: "note", text: "saw {{found}}" },
    ],
  });
  check("⚠ a step past the branch referring to a value only ONE arm produces is refused",
    armOnly.status === 400 && /found/.test(armOnly.body.error ?? ""), JSON.stringify(armOnly.body));
  // AND A REFERENCE TO AN EARLIER STEP'S OUTPUT, ON THE ARM THAT PRODUCES IT, IS FINE.
  const insideArm = await edit({
    id: branched,
    steps: [
      { type: "if", left: "{{kind}}", op: "is", right: "big" },
      { type: "knowledge", query: "{{kind}}", out: "found" },
      { type: "note", text: "saw {{found}}" },
      { type: "otherwise" },
      { type: "note", text: "small" },
      { type: "end" },
    ],
  });
  check("...and the CONTROL: the same reference INSIDE that arm is saved",
    insideArm.status === 200, JSON.stringify(insideArm.body));

  /**
   * ⚠ **AND THE RULES ARE THE EXECUTOR'S OWN, asked as a COMPARISON rather than claimed.**
   * Neither product may import the other, so `cleanWorkflow` is a declared COPY of
   * `readWorkflow` — and comparing source could never see a divergence, because the two are
   * written differently on purpose. Every shape this section drove is put through both, with
   * the declarations the route really forwards, and the two must AGREE.
   */
  const SHAPES = [
    { inputs: [{ name: "lines", label: "L", type: "list", required: true }],
      steps: [{ type: "repeat", mode: "each", each: "{{lines}}", as: "line" }, { type: "note", text: "{{line}}" }, { type: "endrepeat" }] },
    { inputs: [{ name: "lines", label: "L", type: "text", required: true }],
      steps: [{ type: "repeat", mode: "each", each: "{{lines}}", as: "line" }, { type: "note", text: "{{line}}" }, { type: "endrepeat" }] },
    { inputs: [{ name: "kind", label: "K", type: "text", required: true }],
      steps: [{ type: "if", left: "{{kind}}", op: "is", right: "big" }, { type: "knowledge", query: "{{kind}}", out: "found" },
              { type: "otherwise" }, { type: "note", text: "s" }, { type: "end" }, { type: "note", text: "{{found}}" }] },
    { inputs: [], steps: [{ type: "note", text: "Hello {{nobody}}" }] },
    { inputs: [{ name: "who", label: "W", type: "text" }], steps: [{ type: "note", text: "Hello {{who}}" }] },
  ];
  let agreed = 0, refusals = 0;
  for (const s of SHAPES) {
    const site = cleanWorkflow(s.steps, AUTOMATION_STEPS, MAX_AUTOMATION_STEPS, s.inputs);
    const engine = readWorkflow(s.steps, { inputs: s.inputs });
    const same = Boolean(site.error) === Boolean(engine.error);
    if (site.error) refusals++;
    if (same) agreed++;
    check(`the two validators agree about ${JSON.stringify(s.steps.map((x) => x.type))}`, same,
      `site ${JSON.stringify(site.error ?? "ok")} / engine ${JSON.stringify(engine.error ?? "ok")}`);
  }
  check("...over every shape, with both verdicts really occurring — the observer",
    agreed === SHAPES.length && refusals >= 2 && refusals < SHAPES.length, `${agreed} agreed, ${refusals} refused`);

  // ═════════════════════════════════════════════════════════════════════════
  console.log("\n5. TWO OVERLAPPING EDITS — the combination written is the one that was checked");
  // ═════════════════════════════════════════════════════════════════════════
  /**
   * ⚠ **THE GUARANTEE THIS SECTION EXISTS FOR, and the only one a fake store cannot prove.**
   *
   * Browser A opens an automation and removes a declaration its stored steps do not refer to,
   * which is a legal edit against what A can see. Browser B then rewrites the steps so that
   * they DO refer to it. A's save was validated against a combination that no longer exists —
   * so writing it would leave a stored step referring to a value nothing declares, which is
   * exactly the state section 1 refuses to create in one hop.
   *
   * `agent.patch_automation` takes `p_expect_version` and compares it under its own row lock,
   * so there is no window between deciding and writing. `cleanPatch` answers the version of
   * the surface it validated, and the route sends that number and no other.
   */
  const shared = await make("Two browsers", {
    inputs: [{ name: "customer", label: "Who", type: "text", required: true },
             { name: "spare", label: "Spare", type: "text" }],
    steps: [{ type: "note", text: "Hello {{customer}}" }],
  });
  const opened = shape(shared);
  check("set up: both browsers see version 1 with two declarations",
    opened.version === 1 && opened.inputs.length === 2, JSON.stringify(opened));

  // B changes the STEPS, which is the half A's edit was checked against.
  const bWrote = await edit({ id: shared, steps: [{ type: "note", text: "Hello {{customer}} and {{spare}}" }] });
  check("browser B rewrites the steps", bWrote.status === 200, JSON.stringify(bWrote.body));
  const afterB = shape(shared);
  check("...and the version moved, because the steps changed", afterB.version === 2, String(afterB.version));
  const beforeStale = mark(shared);

  /**
   * A NOW SAVES THE EDIT IT VALIDATED AGAINST VERSION 1. The route re-reads the row before
   * validating, so what makes this the overlapping case is the FENCE and not the read: A's
   * body is the body a browser holding the old row sends, and the version it is checked
   * against is whatever the read answers at that instant.
   *
   * ⚠ **SO THE STALE HALF IS FORCED RATHER THAN RACED, and that is said out loud.** A real
   * interleaving needs B's write to land between A's read and A's write, which nothing here
   * can schedule — so `expectVersion` is handed the number A really held, through the same
   * store call the route makes, which is the state the fence exists for. The route's own
   * wiring (that it sends `cleanPatch`'s answer and no other number) is asserted by
   * `test/agent-automations.test.mjs`; what is proved HERE is the database's behaviour.
   */
  const stale = await appStore().patchAutomation(A, {
    id: shared, patch: { inputs: [{ name: "customer", label: "Who", type: "text", required: true }] },
    expectVersion: opened.version,
  });
  check("⚠ the stale write is REFUSED by the database", stale.ok !== true && stale.error === "stale",
    JSON.stringify(stale));
  check("...and it says which version it expected and which it found",
    stale.expected === opened.version && stale.version === afterB.version, JSON.stringify(stale));
  check("...and the stored automation is byte-identical afterwards", mark(shared) === beforeStale);
  check("...so the steps B wrote still refer to the declaration A tried to remove",
    shape(shared).inputs.length === 2, JSON.stringify(shape(shared).inputs));

  // AND THE SENTENCE A PERSON GETS SAYS WHAT TO DO, through the route rather than composed here.
  const staleSaid = await edit({ id: shared, inputs: [{ name: "customer", label: "Who", type: "text", required: true }] });
  check("⚠ ...and re-reading first, the same edit is now correctly REFUSED for the real reason",
    staleSaid.status === 400 && /spare/.test(staleSaid.body.error ?? ""), JSON.stringify(staleSaid.body));

  /**
   * THE CONTROL, and it is what makes the refusal above about staleness rather than about the
   * fence refusing everything: the CURRENT version goes through.
   */
  const fresh = await appStore().patchAutomation(A, {
    id: shared, patch: { name: "Renamed by A" }, expectVersion: afterB.version,
  });
  check("...and the CONTROL: the same fence with the CURRENT version goes through",
    fresh.ok === true, JSON.stringify(fresh));

  /**
   * ⚠ **AND THE OTHER HALF OF THE SURFACE HAS TO MOVE THE COUNTER TOO, which is the whole of
   * why it was widened.** The brief's own words: *the existing steps-only version counter does not
   * detect every relevant configuration change.* Browser B changes the DECLARATIONS this time and
   * A saves a STEPS-only edit validated against the old ones — the mirror of the case above, and
   * the one a counter that moved on the steps alone cannot see at all.
   *
   * MEASURED with the counter narrowed back: B's inputs change leaves the version where it was,
   * A's stale steps land, and the stored steps then refer to a declaration that is gone.
   */
  const mirror = await make("The other half", {
    inputs: [{ name: "who", label: "Who", type: "text", required: true },
             { name: "extra", label: "Extra", type: "text" }],
    steps: [{ type: "note", text: "Hello {{who}}" }],
  });
  const mirrorHeld = shape(mirror).version;
  /**
   * ⚠ **B'S EDIT NAMES THE DECLARATIONS AND NOTHING ELSE, which is what makes this case
   * DISCRIMINATE the widening.** My first draft had B rename the declaration AND its step — a
   * steps change, so the counter moved under the narrow rule too and the case proved nothing
   * about the half it was written for. Removing a declaration NO STORED STEP refers to is a
   * legal inputs-only edit and moves nothing a steps-only counter can see.
   */
  const bInputs = await edit({ id: mirror, inputs: [{ name: "who", label: "Who", type: "text", required: true }] });
  check("browser B removes a declaration nothing stored refers to — an inputs-only edit",
    bInputs.status === 200, JSON.stringify(bInputs.body));
  check("⚠ ...and the version moved, although not one step changed",
    shape(mirror).version === mirrorHeld + 1, String(shape(mirror).version));
  const beforeMirror = mark(mirror);
  /**
   * A'S STEPS WERE VALIDATED AGAINST BOTH DECLARATIONS AND REFER TO THE ONE B REMOVED. Landing
   * them would leave a stored step referring to a value nothing declares — the state section 1
   * refuses to create in one hop, arriving in two.
   */
  const staleSteps = await appStore().patchAutomation(A, {
    id: mirror, patch: { steps: [{ id: "s1", type: "note", text: "Hello {{who}} and {{extra}}" }] },
    expectVersion: mirrorHeld,
  });
  check("⚠ ...so A's steps-only edit, validated against the OLD declarations, is refused",
    staleSteps.ok !== true && staleSteps.error === "stale", JSON.stringify(staleSteps));
  check("...and the stored automation is byte-identical afterwards", mark(mirror) === beforeMirror);
  check("...so no stored step refers to the declaration B removed",
    !JSON.stringify(shape(mirror).steps).includes("extra"), JSON.stringify(shape(mirror).steps));

  /**
   * ⚠ **AND A CONCURRENT RENAME CANNOT REFUSE A VALIDATED EDIT, which is the other half of
   * choosing this counter.** `version` moves on a change of the steps or of the declarations
   * and on nothing else, so somebody renaming the automation, moving its time or changing its
   * schedule while an edit is in flight produces no refusal at all — a fence that fired on
   * those would refuse edits nobody was competing over.
   */
  const held = shape(shared).version;
  const sideways = await edit({ id: shared, name: "Renamed again", at: null, schedule: "manual" });
  check("a concurrent rename is saved", sideways.status === 200, JSON.stringify(sideways.body));
  check("⚠ ...and does NOT move the version", shape(shared).version === held, String(shape(shared).version));
  const afterSideways = await appStore().patchAutomation(A, {
    id: shared, patch: { steps: [{ type: "note", text: "Hello {{customer}} and {{spare}}" }] },
    expectVersion: held,
  });
  check("...so an edit validated before it still goes through", afterSideways.ok === true, JSON.stringify(afterSideways));

  // ═════════════════════════════════════════════════════════════════════════
  console.log("\n6. OMITTED FIELDS ARE PRESERVED, FROM THE LOCKED ROW AND NOT FROM A BROWSER");
  // ═════════════════════════════════════════════════════════════════════════
  const kept = await make("Keeps what it is not asked about", {
    inputs: [{ name: "who", label: "Who", type: "text", required: true }],
    steps: [{ type: "note", text: "Hello {{who}}" }],
  });
  await api("/api/agent/automation-update", {
    body: { id: kept, schedule: "weekly", at: "09:00", zone: "Europe/London", days: ["mon"] },
  });
  const configured = shape(kept);
  check("set up: it carries a weekly schedule, a step and a declaration",
    configured.schedule === "weekly" && configured.steps.length === 1 && configured.inputs.length === 1,
    JSON.stringify(configured));

  const justTheName = await edit({ id: kept, name: "A new name" });
  check("an edit naming only the name is saved", justTheName.status === 200, JSON.stringify(justTheName.body));
  const afterName = shape(kept);
  check("⚠ ...and every field it said nothing about is exactly as it was",
    afterName.schedule === configured.schedule && afterName.at === configured.at
    && afterName.zone === configured.zone
    && JSON.stringify(afterName.steps) === JSON.stringify(configured.steps)
    && JSON.stringify(afterName.inputs) === JSON.stringify(configured.inputs),
    JSON.stringify(afterName));
  check("...and only the name moved", afterName.name === "A new name" && afterName.version === configured.version,
    JSON.stringify(afterName));

  /**
   * ⚠ **AND AN UNRELATED EDIT MUST NOT MOVE A SCHEDULED OCCURRENCE — reproduced before the
   * migration was touched.** `agent.update_automation` recomputed `next_run_at` from NOW on every
   * save of a scheduled automation, so a rename landed on a due-but-unfiled occurrence and
   * **pushed it 7h45m into the future** (measured: `00:14:10` → `08:00:00`, `still_due` t → f),
   * with the occurrence neither filed nor recorded missed — it simply never happened. The other
   * direction pulled an occurrence that had already run back into TODAY, which the
   * once-per-occurrence index absorbs, so that half costs a wasted tick and a wrong on-screen
   * "next run" rather than a second execution.
   *
   * The instant is recomputed only when the change really asks for it: the schedule, the time,
   * the zone, the days or the date. A name, an on/off, an event binding, the steps and the
   * declarations leave it exactly where it is.
   */
  const dueAt = q(`update agent.automations set next_run_at = now() - interval '2 minutes'
    where id='${kept}' returning next_run_at::text;`);
  check("set up: its next occurrence is due and unfiled", /\d/.test(dueAt), dueAt);
  const renameWhileDue = await edit({ id: kept, name: "Renamed while due" });
  check("a rename lands while an occurrence is due", renameWhileDue.status === 200, JSON.stringify(renameWhileDue.body));
  check("⚠ ...and the occurrence is STILL DUE — an unrelated edit does not postpone it",
    q(`select next_run_at = '${dueAt}'::timestamptz and next_run_at <= now()
       from agent.automations where id='${kept}';`) === "t",
    q(`select next_run_at::text from agent.automations where id='${kept}';`));
  // AND A CHANGE THAT REALLY ASKS FOR IT DOES RECOMPUTE — the control, without which "it does
  // not move" is satisfied by a door that never computes an instant at all.
  const moved = await edit({ id: kept, schedule: "weekly", at: "23:30", zone: "Europe/London", days: ["mon", "thu"] });
  check("...and the CONTROL: changing the TIME does recompute it, into the future",
    moved.status === 200 && q(`select next_run_at > now() from agent.automations where id='${kept}';`) === "t",
    JSON.stringify(moved.body));

  /**
   * ⚠ **AND THE SAME DEFECT LIVED IN THE SIBLING — a NO-OP ENABLE deleted a due occurrence.**
   *
   * `agent.set_automation_enabled` re-arms `next_run_at` when it is asked to turn an automation
   * ON, which is right for the case it was written for: one disabled for a week has an instant a
   * week behind, and enabling it without recomputing hands the next tick an occurrence days old.
   * Its condition was `p_enabled and a.schedule <> 'manual'` — true of `enabled: true` on an
   * automation that is ALREADY on. **MEASURED before it was touched: `01:06:18` → `08:00:00`,
   * 6h54m forward, `still_due` t → f, and 0 executions and 0 history rows** — neither filed nor
   * recorded missed.
   *
   * Reachable from the agent's own `pause_automation` tool and from this route, both of which take
   * the flag from their caller rather than from what the row holds.
   */
  const dueAgain = q(`update agent.automations set next_run_at = now() - interval '2 minutes'
    where id='${kept}' returning next_run_at::text;`);
  const stillOn = q(`select enabled from agent.automations where id='${kept}';`);
  check("set up: it is on, with an occurrence due and unfiled", stillOn === "t" && /\d/.test(dueAgain), dueAgain);
  const noop = await api("/api/agent/automation-enable", { body: { id: kept, enabled: true } });
  check("a no-op enable is accepted", noop.status === 200, JSON.stringify(noop.body));
  check("⚠ ...and the occurrence is STILL DUE — nothing was off, so nothing is re-armed",
    q(`select next_run_at = '${dueAgain}'::timestamptz and next_run_at <= now()
       from agent.automations where id='${kept}';`) === "t",
    q(`select next_run_at::text from agent.automations where id='${kept}';`));
  check("...and no execution was filed and none recorded missed either",
    q(`select count(*) from agent.automation_runs where automation_id='${kept}';`) === "0"
    && q(`select count(*) from agent.automation_history where automation_id='${kept}';`) === "0");
  /**
   * ⚠ **THE CONTROL, and it is the whole reason this is a transition test rather than a
   * removal**: a REAL off→on still re-arms forward, so a long-disabled automation cannot come back
   * with a backlog. Without it, "a no-op does not move it" is satisfied by a function that has
   * stopped re-arming at all.
   */
  const offThenOn = await api("/api/agent/automation-enable", { body: { id: kept, enabled: false } });
  check("turning it off is accepted", offThenOn.status === 200, JSON.stringify(offThenOn.body));
  check("...and turning it off leaves the instant alone, because a scheduled row is whole only with one",
    q(`select next_run_at = '${dueAgain}'::timestamptz from agent.automations where id='${kept}';`) === "t");
  const backOn = await api("/api/agent/automation-enable", { body: { id: kept, enabled: true } });
  check("turning it back on is accepted", backOn.status === 200, JSON.stringify(backOn.body));
  check("⚠ ...and NOW it is re-armed into the future — the backlog argument, intact",
    q(`select next_run_at > now() from agent.automations where id='${kept}';`) === "t",
    q(`select next_run_at::text from agent.automations where id='${kept}';`));

  // AN EDIT THAT NAMES NOTHING IS REFUSED RATHER THAN WRITTEN, so a no-op cannot take the lock.
  const beforeEmpty = mark(kept);
  const empty = await edit({ id: kept });
  check("an edit that names no field is refused", empty.status === 400
    && /which fields/.test(empty.body.error ?? ""), JSON.stringify(empty.body));
  check("...and nothing was touched, `updated_at` included", mark(kept) === beforeEmpty);

  // ═════════════════════════════════════════════════════════════════════════
  console.log("\n7. THE ACCOUNT NEXT DOOR, AND WHAT NONE OF IT LEFT BEHIND");
  // ═════════════════════════════════════════════════════════════════════════
  const beforeStranger = mark(one);
  const stranger = await edit({ id: one, inputs: [] }, B);
  check("another account's edit is the missing-automation 404", stranger.status === 404, JSON.stringify(stranger.body));
  check("...and nothing was written", mark(one) === beforeStranger);
  const strangerSteps = await edit({ id: one, steps: [{ type: "note", text: "mine now" }] }, B);
  check("...and so is a steps-only edit of it", strangerSteps.status === 404, JSON.stringify(strangerSteps.body));
  check("...and still nothing was written", mark(one) === beforeStranger);

  const tally = JSON.parse(q(`select json_build_object(
    'automations', (select count(*) from agent.automations),
    'executions', (select count(*) from agent.automation_runs),
    'runs', (select count(*) from agent.runs),
    'withModel', (select count(*) from agent.runs where model is not null and model <> 'none'))::text;`));
  check("⚠ NOTHING WAS EXECUTED AND NO MODEL WAS CALLED — this file is about what may be SAVED",
    tally.executions === 0 && tally.runs === 0 && tally.withModel === 0, JSON.stringify(tally));
  console.log(`  …  ${tally.automations} automations, ${tally.executions} executions`);
} finally {
  stack.tearDown();
}

console.log(`\n${failed === 0 ? "ALL CHECKS PASSED" : `${failed} FAILED`}`);
if (failed) { console.log(fails.map((f) => `  - ${f}`).join("\n")); process.exit(1); }
