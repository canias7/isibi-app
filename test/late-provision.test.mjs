// A DATABASE PROJECT IS NEVER LEFT UNTRACKED, NEVER DUPLICATED, AND NEVER
// DROPPED WHILE IT MAY BE THE SITE'S (2026-10-07, corrected the same day).
//
// The owner: *"resolve the documented late-provisioning gap so a
// database/project created before a later failure is durably associated with
// the correct site or explicitly recorded for safe reconciliation, preventing
// an automatic retry or subsequent request from silently provisioning a
// duplicate; preserve ownership checks and do not delete potentially used
// resources as cleanup."*
//
// Codex's review of the first version reproduced two defects, and both are
// reproduced here first (RACE 1, DOUBLE 1): an earlier attempt's project was
// settled against a reading of the slug's row taken BEFORE that attempt's
// claim became visible — dropped while recorded, a second project made, the
// claim lost, and the build carried on inside the project it had deleted; and
// a failed drop followed by a failed note left a project nothing tracked, so
// the next attempt made a second one. The rules now (`site-provision.mjs`):
//
//   1  every attempt is written down BEFORE its create, under an id the
//      project's own name carries, so a create whose answer was lost is found;
//   2  a project is dropped only when the slug's row names ANOTHER project —
//      the one answer a claim in flight cannot overtake;
//   3  every other unrecorded project is CLAIMED for the site, never dropped;
//   4  nothing new is made while this account's earlier attempt is unsettled;
//      another account's note is never touched;
//   5  a note is cleared only when its project is the site's, gone, being torn
//      down, or proved never made — and a failed clear is settled next time.
//
// Every case ends on the same invariant (`neverDroppedUsed`): no project the
// slug's row names was ever dropped.
//
// ⚠ Every Neon and Supabase answer here is a stand-in; nothing is provisioned.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ensureSiteBackend, ATTEMPT_LEASE_MS } from "../site-provision.mjs";
import { backendState } from "../site-backend-state.mjs";
import { failureOutcome, failureNote } from "../builder/site-add.mjs";
import { addonReplyFacts, outcomeReads } from "../builder/site-reply.mjs";
import { projectNameForSite } from "../site-db.mjs";
import { addon, USER } from "./fixtures/addon-route.mjs";

const UID = "u-owner";
const SLUG = "fold-lane";
const T0 = Date.parse("2026-10-07T12:00:00Z");
const iso = (ms) => new Date(ms).toISOString();
const connOf = (id) => "postgres://u:secret@ep-" + String(id).replace(/^pr-/, "") + ".neon.tech/neondb";
const rowOf = (id, uid = UID) => ({ uid, neon_project: id, neon_branch: "br-" + id, neon_role: "owner", neon_conn: connOf(id) });
const nameOf = (slug, attempt) => "isibi-" + slug + "-" + attempt;
/** An earlier attempt's note, as `makeProject` writes it. */
const noted = (o = {}) => ({ slug: SLUG, uid: UID, attempt: "a-old", name: nameOf(SLUG, "a-old"), why: "an earlier attempt", at: iso(T0 - 60 * 1000), ...o });

/**
 * The provisioner's world as stand-ins: `row` is the slug's `site_project`
 * row (an insert-if-absent claim, as the Worker's is), `projects` the Neon
 * projects that exist (id → name), `notes` the attempt notes (key → note),
 * `dropped` every project removed. Each dep can be told to fail; every call
 * is kept. `h.o` stays live, so a case can change the world between attempts.
 */
function harness(o = {}) {
  const calls = [];
  const state = { row: o.row === undefined ? null : o.row, notes: new Map(), projects: new Map(), dropped: [], clock: T0, teardown: new Set(o.teardown || []) };
  for (const n of o.notes || []) state.notes.set(n.attempt || n.projectId, { ...n });
  for (const [id, name] of Object.entries(o.projects || {})) state.projects.set(id, name);
  let lookups = 0, attempts = 0, made = 0;
  const deps = {
    now: () => state.clock,
    attemptId: () => (o.attemptPrefix || "a") + (++attempts),
    projectName: nameOf,
    lookupSite: async () => (o.site === undefined ? null : o.site),
    lookupProject: async () => {
      lookups++;
      calls.push("lookupProject");
      if (typeof o.lookupProject === "function") return o.lookupProject(lookups, state);
      return state.row;
    },
    createProject: async (slug, attempt) => {
      calls.push("createProject");
      const id = (o.ids || [])[made] || (made ? "pr-" + (made + 1) : "pr-1");
      made++;
      if (typeof o.create === "function") return o.create({ state, slug, attempt, id, name: nameOf(slug, attempt) });
      state.projects.set(id, nameOf(slug, attempt));
      return { projectId: id, branchId: "br-" + id, roleName: "owner", conn: connOf(id) };
    },
    dropProject: async (id) => {
      calls.push("dropProject:" + id);
      if (o.dropFails) throw new Error("drop refused");
      if (!state.projects.has(id)) throw Object.assign(new Error("neon api DELETE /projects/" + id + " failed: 404"), { status: 404 });
      state.projects.delete(id);
      state.dropped.push(id);
    },
    saveProject: async (slug, uid, proj) => {
      calls.push("saveProject:" + proj.neon_project);
      if (typeof o.saveProject === "function") return o.saveProject(state, slug, uid, proj);
      if (state.row) return { ok: true, claimed: false };
      state.row = { uid, ...proj };
      return { ok: true, claimed: true };
    },
    findProjects: async (slug, note) => {
      calls.push("find:" + note.attempt);
      if (o.findFails) throw new Error("the listing was refused");
      const name = note.name || nameOf(slug, note.attempt);
      return [...state.projects].filter(([, n]) => n === name).map(([id]) => ({ id }));
    },
    adoptProject: async (id, hint) => {
      calls.push("adopt:" + id);
      if (typeof o.onAdopt === "function") o.onAdopt(state, id);
      if (o.adoptFails) throw new Error("neon unreachable");
      if (!state.projects.has(id)) throw Object.assign(new Error("neon api GET failed: 404"), { status: 404, gone: true });
      return { projectId: id, branchId: (hint && hint.branchId) || "br-" + id, roleName: (hint && hint.roleName) || "owner", conn: connOf(id) };
    },
    tearingDown: async (id) => { calls.push("teardown?:" + id); return state.teardown.has(id); },
    createDatabase: async () => { calls.push("createDatabase"); if (o.dbFails) throw Object.assign(new Error("database refused"), { status: 500 }); return "site_x"; },
    enableAuth: async () => { calls.push("enableAuth"); if (o.authFails) throw Object.assign(new Error("auth refused"), { status: 502 }); return { info: null }; },
    enableData: async () => { calls.push("enableData"); if (o.dataFails) throw Object.assign(new Error("data api refused"), { status: 503 }); return { info: null }; },
    saveBackend: async () => { calls.push("saveBackend"); return o.backendFails ? { ok: false, detail: "no" } : { ok: true, claimed: true }; },
    connFor: (conn, db) => conn.replace(/neondb$/, db),
    dbNameFor: () => "site_x",
    warn: (m) => calls.push("warn:" + m),
    noteUnrecorded: async (slug, rec) => {
      calls.push("note:" + (rec.projectId || rec.attempt));
      if (typeof o.noteFails === "function" && o.noteFails(rec, state)) throw new Error("the bucket refused the write");
      state.notes.set(rec.attempt || rec.projectId, JSON.parse(JSON.stringify(rec)));
    },
    unrecorded: async () => {
      calls.push("list");
      if (o.notesUnreadable) throw new Error("bucket unreadable");
      if (typeof o.onList === "function") o.onList(state);
      return [...state.notes.values()].map((n) => ({ ...n }));
    },
    clearUnrecorded: async (slug, key) => {
      calls.push("clear:" + key);
      if (o.clearFails) throw new Error("the bucket refused the delete");
      state.notes.delete(key);
    },
  };
  return { deps, calls, state, o };
}
const run = (h) => ensureSiteBackend(h.deps, { slug: SLUG, uid: UID });
const fails = async (h) => { try { await run(h); } catch (e) { return e; } assert.fail("the provision did not fail"); };
const notes = (h) => [...h.state.notes.values()];
const made = (h) => h.calls.filter((c) => c === "createProject").length;
const drops = (h) => h.calls.filter((c) => c.startsWith("dropProject"));
/** THE INVARIANT: no project the slug's row names was ever dropped. */
function neverDroppedUsed(h) {
  const named = h.state.row && String(h.state.row.neon_project);
  assert.ok(!named || !h.state.dropped.includes(named), "a project the slug's row names was dropped: " + named + " — " + h.calls.join(" "));
}

// ── CODEX'S TWO REPRODUCTIONS, FIRST ───────────────────────────────────────

test("RACE 1 — AN EARLIER ATTEMPT'S CLAIM BECOMES VISIBLE BETWEEN THE FIRST LOOKUP AND THE NOTES' READ: its project is the site's and is used — never dropped, no second project made, nothing built inside a deleted project", async () => {
  const h = harness({
    notes: [noted({ projectId: "pr-old", branchId: "br-pr-old", roleName: "owner", why: "whether its row was saved could not be read back" })],
    projects: { "pr-old": nameOf(SLUG, "a-old") },
    // THE ORDERING CODEX REPRODUCED: `lookupProject` has answered "no row"; the
    // earlier attempt's claim lands before the notes are read.
    onList: (state) => { if (!state.row) state.row = rowOf("pr-old"); },
  });
  const conn = await run(h);
  assert.match(conn, /ep-old\.neon\.tech\/site_x$/, "the site was not built on the recorded project");
  assert.deepEqual(drops(h), [], "a recorded project was dropped: " + h.calls.join(" "));
  assert.equal(made(h), 0, "a second project was made over a recorded one");
  assert.equal(h.state.projects.has("pr-old"), true);
  assert.deepEqual(notes(h), [], "the settled note was left");
  neverDroppedUsed(h);
});

test("RACE 2 — THE EARLIER CLAIM LANDS AFTER THE NOTE'S OWN READ, WHILE THIS ATTEMPT CLAIMS THE SAME PROJECT: the claims converge on it — the project is used, never dropped; and when ANOTHER project's claim lands instead, ours is the one dropped, because only then can it never be named", async () => {
  const h = harness({
    notes: [noted({ projectId: "pr-old" })],
    projects: { "pr-old": nameOf(SLUG, "a-old") },
    onAdopt: (state) => { if (!state.row) state.row = rowOf("pr-old"); },
  });
  assert.match(await run(h), /ep-old/);
  assert.deepEqual(drops(h), []);
  assert.equal(made(h), 0);
  neverDroppedUsed(h);
  const other = harness({
    notes: [noted({ projectId: "pr-old" })],
    projects: { "pr-old": nameOf(SLUG, "a-old"), "pr-b": nameOf(SLUG, "a-b") },
    onAdopt: (state) => { if (!state.row) state.row = rowOf("pr-b"); },
  });
  assert.match(await run(other), /ep-b/, "the slug's recorded project was not used");
  assert.deepEqual(drops(other), ["dropProject:pr-old"]);
  assert.equal(made(other), 0);
  assert.deepEqual(notes(other), []);
  neverDroppedUsed(other);
});

test("DOUBLE 1 — A CLAIM THAT FAILS, A DROP THAT WOULD FAIL AND A NOTE THAT CANNOT BE REWRITTEN: the note written before the create still stands, the next attempt makes nothing while it is young, and after its lease the project is found by its attempt's name and claimed — never a second project", async () => {
  const h = harness({
    saveProject: () => ({ ok: false, detail: "refused" }),
    dropFails: true,
    // The attempt's own note lands; every rewrite after it is refused.
    noteFails: (rec) => !!rec.projectId,
  });
  const e = await fails(h);
  assert.deepEqual([e.stage, e.recorded], ["save_project", "unknown"]);
  assert.deepEqual(drops(h), [], "a project whose claim may still land was dropped");
  assert.deepEqual(notes(h).map((n) => [n.attempt, n.projectId, n.uid]), [["a1", undefined, UID]], "the note written before the create is gone");
  // THE NEXT ATTEMPT, AT ONCE, with the store healthy again: nothing is made.
  h.o.saveProject = undefined;
  h.o.noteFails = undefined;
  h.o.dropFails = false;
  const busy = await fails(h);
  assert.deepEqual([busy.stage, busy.reconcile], ["reconcile_project", true]);
  assert.deepEqual(busy.open.map((x) => [x.attempt, x.reason]), [["a1", "in-progress"]]);
  assert.equal(made(h), 1, "a second project was made while the first attempt's note was young");
  // AFTER THE LEASE: found by its name, claimed, used.
  h.state.clock = T0 + ATTEMPT_LEASE_MS + 1000;
  assert.match(await run(h), /ep-1\.neon\.tech\/site_x$/);
  assert.equal(made(h), 1, "a second project was made");
  assert.ok(h.calls.includes("find:a1"), "the project was not looked for by its attempt's name");
  assert.deepEqual(drops(h), []);
  assert.deepEqual(notes(h), []);
  neverDroppedUsed(h);
});

test("DOUBLE 2 — THE ATTEMPT CANNOT BE WRITTEN DOWN: nothing is made at all, and the failure says so", async () => {
  const h = harness({ noteFails: () => true });
  const e = await fails(h);
  assert.equal(e.stage, "note_attempt");
  assert.equal(e.recorded, undefined);
  assert.equal(made(h), 0, "a project was made with no record that it was being made");
  // A CALLER WITH NO NOTES AT ALL makes nothing either.
  const bare = harness();
  delete bare.deps.noteUnrecorded;
  delete bare.deps.unrecorded;
  const b = await fails(bare);
  assert.deepEqual([b.stage, b.open.map((x) => x.reason)], ["reconcile_project", ["no-notes"]]);
  assert.equal(made(bare), 0);
});

// ── A CREATE WHOSE ANSWER WAS LOST ─────────────────────────────────────────

const timeout = () => Object.assign(new Error("The operation was aborted due to timeout"), { name: "TimeoutError" });

test("LOST 1 — NEON MADE THE PROJECT AND THE ANSWER NEVER CAME: it is found at once by its attempt's name, claimed and used — one project, nothing dropped", async () => {
  const h = harness({ create: ({ state, id, name }) => { state.projects.set(id, name); throw timeout(); } });
  assert.match(await run(h), /ep-1\.neon\.tech\/site_x$/);
  assert.equal(made(h), 1);
  assert.ok(h.calls.includes("find:a1"));
  assert.deepEqual(drops(h), []);
  assert.deepEqual(notes(h), []);
  neverDroppedUsed(h);
});

test("LOST 2 — THE ANSWER NEVER CAME AND NOTHING CARRIES THE NAME YET: the outcome is unknown and said so, the note stays, the next attempt waits out the lease, then claims the project that landed — or, when none ever did, makes the one project", async () => {
  const h = harness({ create: ({ state, id, name }) => { state.late = [id, name]; throw timeout(); } });
  const e = await fails(h);
  assert.deepEqual([e.stage, e.recorded], ["create_project", "unknown"]);
  assert.deepEqual(notes(h).map((n) => [n.attempt, n.name]), [["a1", nameOf(SLUG, "a1")]]);
  h.o.create = undefined;
  const wait = await fails(h);
  assert.deepEqual(wait.open.map((x) => x.reason), ["in-progress"]);
  assert.equal(made(h), 1);
  // THE POST LANDED AFTER ALL; after the lease it is found and used.
  h.state.projects.set(...h.state.late);
  h.state.clock = T0 + ATTEMPT_LEASE_MS + 1000;
  assert.match(await run(h), /ep-1/);
  assert.equal(made(h), 1, "a second project was made over one that landed late");
  neverDroppedUsed(h);
  // AND WHEN NONE EVER LANDED: proved never made, the note cleared, one project made.
  const never = harness({ create: ({ id }) => { throw timeout(); } });
  await fails(never);
  never.o.create = undefined;
  never.state.clock = T0 + ATTEMPT_LEASE_MS + 1000;
  assert.match(await run(never), /ep-2/);
  assert.equal(made(never), 2);
  assert.equal(never.state.projects.size, 1, "more than one project stands");
  assert.deepEqual(notes(never), []);
});

test("LOST 3 — WHEN NEON'S LISTING CANNOT BE READ, NOTHING IS CONCLUDED: the note stays and no project is made over it, however old it is; a 4xx refusal made nothing and is not looked for", async () => {
  const h = harness({ create: ({ state, id, name }) => { state.projects.set(id, name); throw timeout(); }, findFails: true });
  const e = await fails(h);
  assert.equal(e.recorded, "unknown");
  h.o.create = undefined;
  h.state.clock = T0 + ATTEMPT_LEASE_MS * 4;
  const stuck = await fails(h);
  assert.deepEqual(stuck.open.map((x) => x.reason), ["search-failed"]);
  assert.equal(made(h), 1);
  assert.equal(notes(h).length, 1);
  const refused = harness({ create: () => { throw Object.assign(new Error("neon api POST /projects failed: 422"), { status: 422 }); } });
  const r = await fails(refused);
  assert.deepEqual([r.stage, r.recorded], ["create_project", undefined]);
  assert.ok(!refused.calls.some((c) => c.startsWith("find:")), "a refusal was looked for as if it might have made something");
  assert.deepEqual(notes(refused), []);
});

test("LOST 4 — WHAT A CREATE'S ERROR ANSWER ESTABLISHES, BY HTTP'S OWN MEANINGS: a 503 made nothing; a 500 finished, so a search now settles it at once — nothing made and the next attempt free, or the project it made claimed; a 504 may still be landing, so its note waits out the lease", async () => {
  const fail = (status, lands) => ({ state, id, name }) => { if (lands) state.projects.set(id, name); throw Object.assign(new Error("neon api POST /projects failed: " + status), { status }); };
  const busy = harness({ create: fail(503) });
  const b = await fails(busy);
  assert.deepEqual([b.stage, b.recorded], ["create_project", undefined]);
  assert.ok(!busy.calls.some((c) => c.startsWith("find:")));
  assert.deepEqual(notes(busy), []);
  const finished = harness({ create: fail(500) });
  const f = await fails(finished);
  assert.deepEqual([f.stage, f.recorded], ["create_project", undefined], "a finished error with nothing made was said as unknown");
  assert.ok(finished.calls.includes("find:a1"), "the finished create was not looked for");
  assert.deepEqual(notes(finished), []);
  finished.o.create = undefined;
  assert.match(await run(finished), /ep-2/, "the next attempt was held after a finished error that made nothing");
  const madeAnyway = harness({ create: fail(500, true) });
  assert.match(await run(madeAnyway), /ep-1/, "the project a 500 made was not claimed");
  assert.equal(made(madeAnyway), 1);
  const gateway = harness({ create: fail(504) });
  const g = await fails(gateway);
  assert.equal(g.recorded, "unknown");
  gateway.o.create = undefined;
  const held = await fails(gateway);
  assert.deepEqual(held.open.map((x) => x.reason), ["in-progress"], "a create that may still be landing was not waited for");
  neverDroppedUsed(madeAnyway);
});

// ── A CLEAR THAT FAILED ────────────────────────────────────────────────────

test("CLEAR 1 — A NOTE WHOSE CLEAR FAILED IS SETTLED NEXT TIME, AT NO COST BUT A READ: its project, the site's, is kept; a project already gone settles its note; neither makes anything new", async () => {
  const h = harness({ clearFails: true, backendFails: true });
  await fails(h);
  assert.equal(notes(h).length, 1, "this case tests nothing: the clear did not fail");
  h.o.clearFails = false;
  h.o.backendFails = false;
  assert.match(await run(h), /ep-1/);
  assert.deepEqual(notes(h), []);
  assert.deepEqual(drops(h), []);
  assert.equal(made(h), 1);
  neverDroppedUsed(h);
  // A LOST RACE WHOSE CLEAR FAILED: the dropped project is gone (404), so its note just goes.
  const race = harness({ row: null, clearFails: true, saveProject: (state) => { state.row = rowOf("pr-win"); return { ok: true, claimed: false }; } });
  race.state.projects.set("pr-win", nameOf(SLUG, "a-win"));
  assert.match(await run(race), /ep-win/);
  assert.equal(notes(race).length, 1);
  race.o.clearFails = false;
  race.o.saveProject = undefined;
  assert.match(await run(race), /ep-win/);
  assert.deepEqual(notes(race), []);
  assert.equal(made(race), 1);
  neverDroppedUsed(race);
});

// ── CONCURRENT ATTEMPTS, IN CONTROLLED ORDER ───────────────────────────────

/** A gate a dep waits on, opened by the case — the interleaving is the case's, never the scheduler's. */
function gate() { let open; const p = new Promise((r) => { open = r; }); return { wait: () => p, open }; }
const tick = () => new Promise((r) => setImmediate(r));

test("CONC 1 — A SECOND ATTEMPT WHILE THE FIRST IS STILL MAKING ITS PROJECT: the second makes nothing and names the attempt in progress; the first finishes on its own project", async () => {
  const g = gate();
  const h = harness({ create: async ({ state, id, name }) => { await g.wait(); state.projects.set(id, name); return { projectId: id, branchId: "br-" + id, roleName: "owner", conn: connOf(id) }; } });
  const first = run(h);
  await tick(); await tick();
  assert.equal(made(h), 1, "this case tests nothing: the first create has not started");
  const second = await fails(h);
  assert.deepEqual(second.open.map((x) => [x.attempt, x.reason]), [["a1", "in-progress"]]);
  g.open();
  assert.match(await first, /ep-1/);
  assert.equal(made(h), 1);
  assert.equal(h.state.projects.size, 1);
  neverDroppedUsed(h);
});

test("CONC 2 — TWO ATTEMPTS THAT BOTH PASSED THE CHECK AND BOTH MADE A PROJECT: one claim lands, the other reads the row BEFORE dropping anything, drops only its own and builds on the winner's", async () => {
  const g = gate();
  let notesWritten = 0;
  const h = harness({
    // Both read the notes before either wrote its own: the first attempt's write waits for the gate.
    noteFails: () => false,
  });
  const write = h.deps.noteUnrecorded;
  h.deps.noteUnrecorded = async (slug, rec) => { if (notesWritten++ === 0) await g.wait(); return write(slug, rec); };
  const a = run(h);
  await tick(); await tick();
  const b = run(h);
  await tick(); await tick(); await tick(); await tick();
  g.open();
  const [ca, cb] = await Promise.all([a, b]);
  assert.equal(made(h), 2, "this case tests nothing: only one attempt made a project");
  assert.equal(ca, cb, "the two attempts built on different projects");
  const winner = h.state.row.neon_project;
  assert.deepEqual(drops(h).length, 1);
  assert.notEqual(drops(h)[0], "dropProject:" + winner, "the winner's project was dropped");
  assert.equal(h.state.projects.size, 1);
  assert.deepEqual(notes(h), []);
  neverDroppedUsed(h);
});

test("CONC 3 — AN ATTEMPT WHOSE CLAIM IS STILL IN FLIGHT WHILE ANOTHER CLAIMS ITS NOTED PROJECT: both converge on that one project, nothing is dropped, nothing new is made", async () => {
  const g = gate();
  let first = true;
  const h = harness({
    saveProject: async (state, slug, uid, proj) => {
      if (first) { first = false; await g.wait(); }
      if (state.row) return { ok: true, claimed: false };
      state.row = { uid, ...proj };
      return { ok: true, claimed: true };
    },
  });
  const a = run(h);
  for (let i = 0; i < 8 && !h.calls.some((c) => c.startsWith("saveProject")); i++) await tick();
  assert.equal(notes(h)[0] && notes(h)[0].projectId, "pr-1", "this case tests nothing: the note does not name the project yet");
  const cb = await run(h);
  g.open();
  const ca = await a;
  assert.equal(ca, cb);
  assert.match(ca, /ep-1/);
  assert.equal(made(h), 1);
  assert.deepEqual(drops(h), []);
  neverDroppedUsed(h);
});

// ── ACCOUNTS, TEARDOWN, AND CLAIMING AN EARLIER PROJECT ────────────────────

test("ISO 1 — ANOTHER ACCOUNT'S NOTES, IN EVERY STATE, ARE NEVER SETTLED, CLAIMED, DROPPED OR CLEARED BY THIS ONE, AND NEVER STOP IT; a row another account owns is a conflict, and this account's own noted project is dropped only because that row names another", async () => {
  const theirs = [
    noted({ uid: "u-stranger", attempt: "s-young", name: nameOf(SLUG, "s-young"), at: iso(T0) }),
    noted({ uid: "u-stranger", attempt: "s-old", name: nameOf(SLUG, "s-old"), at: iso(T0 - ATTEMPT_LEASE_MS * 3) }),
    noted({ uid: "u-stranger", attempt: "s-known", projectId: "pr-theirs" }),
  ];
  const h = harness({ notes: theirs, projects: { "pr-theirs": nameOf(SLUG, "s-known"), "x": nameOf(SLUG, "s-old") } });
  assert.match(await run(h), /ep-1/);
  assert.ok(!h.calls.some((c) => /s-young|s-old|s-known|pr-theirs/.test(c)), "another account's note was acted on: " + h.calls.join(" "));
  assert.equal(notes(h).length, 3);
  const conflict = harness({
    notes: [noted({ projectId: "pr-old" })],
    projects: { "pr-old": nameOf(SLUG, "a-old") },
    lookupProject: (n, state) => (n === 1 ? null : rowOf("pr-theirs", "u-stranger")),
  });
  const e = await fails(conflict);
  assert.equal(e.conflict, true);
  assert.deepEqual(drops(conflict), ["dropProject:pr-old"]);
  assert.equal(made(conflict), 0);
});

test("ADOPT 1 — AN EARLIER ATTEMPT'S PROJECT NO ROW NAMES IS CLAIMED FOR THE SITE, NOT DROPPED; one already gone, or queued for teardown, settles its note and the one project is made; one that cannot be read stops the create; with a row, a noted project the row does not name is dropped", async () => {
  const adopt = harness({ notes: [noted({ projectId: "pr-old", branchId: "br-pr-old", roleName: "owner" })], projects: { "pr-old": nameOf(SLUG, "a-old") } });
  assert.match(await run(adopt), /ep-old\.neon\.tech\/site_x$/);
  assert.equal(made(adopt), 0, "a second project was made over one the site could use");
  assert.deepEqual(drops(adopt), []);
  assert.deepEqual(adopt.state.row && adopt.state.row.neon_project, "pr-old");
  assert.deepEqual(notes(adopt), []);
  const gone = harness({ notes: [noted({ projectId: "pr-old" })] });
  assert.match(await run(gone), /ep-1/);
  assert.equal(made(gone), 1);
  assert.deepEqual(notes(gone), []);
  const queued = harness({ notes: [noted({ projectId: "pr-old" })], projects: { "pr-old": nameOf(SLUG, "a-old") }, teardown: ["pr-old"] });
  assert.match(await run(queued), /ep-1/);
  assert.ok(!queued.calls.includes("adopt:pr-old") && !queued.calls.includes("saveProject:pr-old"), "a project queued for teardown was claimed");
  assert.deepEqual(drops(queued), [], "the teardown queue's project was dropped by the provisioner");
  const blind = harness({ notes: [noted({ projectId: "pr-old" })], projects: { "pr-old": nameOf(SLUG, "a-old") }, adoptFails: true });
  const e = await fails(blind);
  assert.deepEqual(e.open.map((x) => [x.projectId, x.reason]), [["pr-old", "claim-unreadable"]]);
  assert.equal(made(blind), 0);
  assert.deepEqual(drops(blind), []);
  const leftover = harness({ row: rowOf("pr-1"), notes: [noted({ projectId: "pr-old" })], projects: { "pr-old": nameOf(SLUG, "a-old"), "pr-1": nameOf(SLUG, "a1") } });
  assert.match(await run(leftover), /ep-1/);
  assert.deepEqual(drops(leftover), ["dropProject:pr-old"]);
  assert.deepEqual(notes(leftover), []);
  neverDroppedUsed(leftover);
  // ON A SITE ALREADY WHOLE, the same leftover is settled the same way, and nothing stops.
  const whole = harness({ site: { conn: "postgres://u:p@h/site_x", uid: UID }, row: rowOf("pr-1"), notes: [noted({ projectId: "pr-old" })], projects: { "pr-old": "n", "pr-1": "m" } });
  assert.equal(await run(whole), "postgres://u:p@h/site_x");
  assert.deepEqual(drops(whole), ["dropProject:pr-old"]);
  const wholeBlind = harness({ site: { conn: "postgres://u:p@h/site_x", uid: UID }, notesUnreadable: true });
  assert.equal(await run(wholeBlind), "postgres://u:p@h/site_x");
});

test("ADOPT 2 — NOTHING SAFE CAN BE CONCLUDED, SO NOTHING IS DONE: a row that cannot be read while settling is never read as \"no row\" (no claim, no drop, no create); two projects under one attempt's name are never guessed between; a noted project the slug's row names under ANOTHER account is a conflict and its note stays; a claim whose read-back names our project under another account is never built on; a noted leftover whose drop fails keeps its note", async () => {
  const unreadable = harness({
    notes: [noted({ projectId: "pr-old" })],
    projects: { "pr-old": nameOf(SLUG, "a-old") },
    lookupProject: (n) => { if (n === 1) return null; throw new Error("supabase down"); },
  });
  const u = await fails(unreadable);
  assert.deepEqual(u.open.map((x) => [x.projectId, x.reason]), [["pr-old", "row-unreadable"]]);
  assert.ok(!unreadable.calls.some((c) => c.startsWith("saveProject") || c.startsWith("adopt:")), "a project was claimed over a row nobody could read: " + unreadable.calls.join(" "));
  assert.deepEqual(drops(unreadable), []);
  assert.equal(made(unreadable), 0);
  const twins = harness({ notes: [noted({ at: iso(T0 - ATTEMPT_LEASE_MS * 2) })], projects: { "pr-x": nameOf(SLUG, "a-old"), "pr-y": nameOf(SLUG, "a-old") } });
  const t = await fails(twins);
  assert.deepEqual(t.open.map((x) => x.reason), ["several-projects"]);
  assert.ok(!twins.calls.some((c) => /adopt:|saveProject|dropProject/.test(c)), twins.calls.join(" "));
  assert.equal(made(twins), 0);
  assert.equal(notes(twins).length, 1);
  const theirsNamed = harness({
    notes: [noted({ projectId: "pr-old" })],
    projects: { "pr-old": nameOf(SLUG, "a-old") },
    lookupProject: (n) => (n === 1 ? null : rowOf("pr-old", "u-stranger")),
  });
  const tn = await fails(theirsNamed);
  assert.equal(tn.conflict, true);
  assert.equal(notes(theirsNamed).length, 1, "the note of a project another account's row names was cleared");
  assert.deepEqual(drops(theirsNamed), [], "a project a row names was dropped");
  const strangerClaim = harness({
    notes: [noted({ projectId: "pr-old" })],
    projects: { "pr-old": nameOf(SLUG, "a-old") },
    saveProject: (state, slug, uid, proj) => { state.row = { ...proj, uid: "u-stranger" }; return { ok: true, claimed: null }; },
  });
  const sc = await fails(strangerClaim);
  assert.equal(sc.conflict, true, "a claimed project another account's row holds was built on");
  assert.ok(!strangerClaim.calls.includes("createDatabase"));
  assert.equal(notes(strangerClaim).length, 1, "the note of a project another account's row holds was cleared");
  const stuck = harness({ row: rowOf("pr-1"), notes: [noted({ projectId: "pr-old" })], projects: { "pr-old": "n", "pr-1": "m" }, dropFails: true });
  assert.match(await run(stuck), /ep-1/);
  assert.deepEqual(notes(stuck).map((n) => n.projectId), ["pr-old"], "a leftover whose drop failed lost its note");
  assert.match(notes(stuck)[0].why, /removal failed/);
});

// ── THE FIRST VERSION'S CASES, KEPT WHERE THEY STILL HOLD AND CORRECTED WHERE THEY ENCODED A DROP ON "NO ROW" ──

test("PROV 1 — A CLAIM WHOSE ANSWER WAS LOST BUT WHOSE ROW LANDED KEEPS ITS PROJECT: read back, found, and the site built on it — never dropped as unrecorded", async () => {
  const h = harness({ saveProject: (state, slug, uid, proj) => { state.row = { uid, ...proj }; throw new Error("the answer was lost"); } });
  const conn = await run(h);
  assert.match(conn, /ep-1\.neon\.tech\/site_x$/);
  assert.deepEqual(drops(h), [], "a project whose row landed was dropped: " + h.calls.join(" "));
  assert.equal(made(h), 1);
  neverDroppedUsed(h);
  // A ROW THAT LANDED NAMING OUR PROJECT UNDER ANOTHER ACCOUNT is never built on: its owner is read first.
  const stranger = harness({ saveProject: (state, slug, uid, proj) => { state.row = { ...proj, uid: "u-stranger", neon_project: proj.neon_project }; throw new Error("the answer was lost"); } });
  const e = await fails(stranger);
  assert.equal(e.conflict, true, "a row another account owns was built on after a lost answer");
  assert.ok(!stranger.calls.includes("createDatabase"));
  assert.deepEqual(drops(stranger), [], "a project a row names was dropped");
});

test("PROV 2 — A CLAIM THAT FAILED AND A READ-BACK THAT FAILED: the project is not dropped, its note names it without its connection, and the failure says its recording is unknown", async () => {
  const h = harness({
    saveProject: () => ({ ok: false, detail: "gateway timeout" }),
    lookupProject: (n) => { if (n === 1) return null; throw new Error("supabase down"); },
  });
  const e = await fails(h);
  assert.deepEqual([e.stage, e.recorded], ["save_project", "unknown"]);
  assert.deepEqual(drops(h), [], "a project that may be recorded was dropped");
  assert.equal(notes(h).length, 1);
  assert.deepEqual([notes(h)[0].projectId, notes(h)[0].uid, notes(h)[0].attempt, notes(h)[0].name], ["pr-1", UID, "a1", nameOf(SLUG, "a1")]);
  assert.ok(!JSON.stringify(notes(h)[0]).includes("secret"), "the note carries the connection string");
});

test("PROV 3 — A CLAIM THAT FAILED AND NO ROW NAMES THE PROJECT: claimed once more, then KEPT AND NAMED ON ITS NOTE, never dropped (a failed claim may still land), and claimed by the next attempt; a create that threw after Neon made the project is dropped by the attempt that made it, inside its lease, and otherwise named for the next to claim", async () => {
  const h = harness({ saveProject: () => ({ ok: false, detail: "refused" }) });
  const e = await fails(h);
  assert.deepEqual([e.stage, e.recorded], ["save_project", "unknown"]);
  assert.deepEqual(h.calls.filter((c) => c.startsWith("saveProject")), ["saveProject:pr-1", "saveProject:pr-1"], "the claim was not made once more");
  assert.deepEqual(drops(h), [], "a project whose claim may still land was dropped");
  assert.deepEqual(notes(h).map((n) => n.projectId), ["pr-1"]);
  h.o.saveProject = undefined;
  assert.match(await run(h), /ep-1/);
  assert.equal(made(h), 1, "the next attempt made a second project over the first");
  assert.deepEqual(notes(h), []);
  neverDroppedUsed(h);
  // THE CREATE THREW AFTER NEON MADE THE PROJECT: dropped by its own attempt, the note cleared.
  const threw = ({ state, name }) => { state.projects.set("pr-made", name); throw Object.assign(new Error("waitForProject timed out"), { projectId: "pr-made" }); };
  const thrown = harness({ create: threw });
  const t = await fails(thrown);
  assert.deepEqual([t.stage, t.recorded], ["create_project", undefined]);
  assert.deepEqual(drops(thrown), ["dropProject:pr-made"]);
  assert.deepEqual(notes(thrown), []);
  // …AND WHEN THAT DROP FAILS: named on the note, said as unknown, and claimed by the next attempt.
  const leftover = harness({ create: threw, dropFails: true });
  const le = await fails(leftover);
  assert.deepEqual([le.stage, le.recorded], ["create_project", "unknown"]);
  assert.deepEqual(notes(leftover).map((n) => [n.projectId, n.uid]), [["pr-made", UID]], "a project the create left behind was left to a log line");
  leftover.o.create = undefined;
  leftover.o.dropFails = false;
  assert.match(await run(leftover), /ep-made/);
  assert.equal(made(leftover), 1);
  neverDroppedUsed(leftover);
  // …AND PAST HALF ITS LEASE, the attempt no longer drops what it made: it names it instead.
  const slow = harness({ create: ({ state, name }) => { state.clock += ATTEMPT_LEASE_MS; state.projects.set("pr-made", name); throw Object.assign(new Error("waitForProject timed out"), { projectId: "pr-made" }); } });
  await fails(slow);
  assert.deepEqual(drops(slow), [], "a project was dropped after its attempt's own window");
  assert.deepEqual(notes(slow).map((n) => n.projectId), ["pr-made"]);
});

test("PROV 4 — A CLAIM WHOSE ANSWER COULD NOT BE READ (`claimed: null`): ours when the row names it; a lost race when another project holds the slug, converged with ownership checked; written down when nothing can be established", async () => {
  const ours = harness({ saveProject: (state, slug, uid, proj) => { state.row = { uid, ...proj }; return { ok: true, claimed: null }; } });
  assert.match(await run(ours), /ep-1/);
  assert.deepEqual(drops(ours), []);
  const winner = { uid: UID, neon_project: "pr-winner", neon_branch: "br-w", neon_role: "owner", neon_conn: "postgres://u:w@ep-w.neon.tech/neondb" };
  const lost = harness({ saveProject: (state) => { state.row = winner; return { ok: true, claimed: null }; } });
  assert.match(await run(lost), /ep-w\.neon\.tech/);
  assert.deepEqual(drops(lost), ["dropProject:pr-1"], "our unrecorded project was not dropped after the race");
  neverDroppedUsed(lost);
  const theirs = harness({ saveProject: (state) => { state.row = { ...winner, uid: "u-stranger" }; return { ok: true, claimed: null }; } });
  const c = await fails(theirs);
  assert.equal(c.conflict, true, "another account's project was adopted");
  // A ROW NAMING OUR PROJECT UNDER ANOTHER ACCOUNT, after an unreadable claim: its owner is read, never assumed.
  const named = harness({ saveProject: (state, slug, uid, proj) => { state.row = { ...proj, uid: "u-stranger" }; return { ok: true, claimed: null }; } });
  const n = await fails(named);
  assert.equal(n.conflict, true, "a row another account owns was built on after an unreadable claim");
  assert.ok(!named.calls.includes("createDatabase"));
  const blind = harness({ saveProject: () => ({ ok: true, claimed: null }) });
  const b = await fails(blind);
  assert.deepEqual([b.stage, b.recorded], ["save_project", "unknown"]);
  assert.deepEqual(drops(blind), []);
  assert.deepEqual(notes(blind).map((x) => x.projectId), ["pr-1"]);
});

test("PROV 5 — NOTES THAT CANNOT BE READ STOP A CREATE AND NOTHING ELSE; a note the row names is cleared; on the reuse path an unreadable list is said and the build goes on", async () => {
  const blind = harness({ notesUnreadable: true });
  const u = await fails(blind);
  assert.deepEqual([u.stage, u.open.map((x) => x.reason)], ["reconcile_project", ["notes-unreadable"]]);
  assert.equal(made(blind), 0);
  const recorded = harness({ notes: [noted({ projectId: "pr-1" })], row: rowOf("pr-1"), projects: { "pr-1": "n" } });
  await run(recorded);
  assert.ok(recorded.calls.includes("clear:a-old") && !drops(recorded).length && !made(recorded), recorded.calls.join(" "));
  const reuse = harness({ notesUnreadable: true, row: rowOf("pr-1") });
  assert.match(await run(reuse), /ep-1/);
  // AN OLDER NOTE, keyed by its project (written before attempts had ids), is settled by the same rules.
  const older = harness({ notes: [{ slug: SLUG, uid: UID, projectId: "pr-old", why: "earlier" }], projects: { "pr-old": "n" } });
  assert.match(await run(older), /ep-old/);
  assert.ok(older.calls.includes("clear:pr-old"));
  assert.equal(made(older), 0);
});

test("PROV 6 — EVERY FAILURE AFTER THE PROJECT IS RECORDED SAYS SO, WITH ITS OWN STAGE; a failure before it does not", async () => {
  for (const [opt, stage] of [["dbFails", "create_database"], ["authFails", "enable_auth"], ["dataFails", "enable_data_api"], ["backendFails", "save_backend"]]) {
    const h = harness({ [opt]: true });
    const e = await fails(h);
    assert.deepEqual([e.stage, e.recorded], [stage, true], opt);
    assert.deepEqual(drops(h), [], opt + ": a recorded project was dropped");
    assert.deepEqual(notes(h), [], opt + ": a recorded project's note was left");
  }
  // A CREATE NEON REFUSED (a 4xx) made nothing and says nothing was kept; one
  // whose answer never came may have made one, and says so (LOST 1–3).
  const early = harness({ create: () => { throw Object.assign(new Error("neon api POST /projects failed: 403"), { status: 403, projectId: null }); } });
  const e = await fails(early);
  assert.deepEqual([e.stage, e.recorded], ["create_project", undefined]);
});

test("PROV 7 — OWNERSHIP AND CANNOT-TELL: a project row another account owns is never this site's database; the Worker's lookups throw on an answer they cannot read, and its claim says it cannot tell", () => {
  assert.equal(backendState({ site: { uid: "a", neon_db: "" }, project: { uid: "b", neon_conn: "x" } }).state, "unreadable");
  assert.equal(backendState({ site: { uid: "a", neon_db: "" }, project: { uid: "b" } }).why, "project-owner-mismatch");
  assert.equal(backendState({ site: { uid: "a", neon_db: "" }, project: { uid: "a" } }).state, "incomplete");
  const W = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const at = (needle) => { const i = W.indexOf(needle); assert.ok(i > 0, "landmark gone: " + needle); return i; };
  const proj = W.slice(at("async function siteNeonProject(env, slug) {"), at("async function siteNeonProject(env, slug) {") + 2200);
  assert.match(proj, /if \(!Array\.isArray\(rows\)\) throw/, "an unreadable project answer reads as no project");
  const detail = W.slice(at("async function siteBackendDetail(env, slug) {"), at("async function siteBackendDetail(env, slug) {") + 1400);
  assert.match(detail, /if \(!Array\.isArray\(siteRows\)\) throw/, "an unreadable site answer reads as no site");
  const claim = W.slice(at("const claim = async (table, body) => {"), at("const claim = async (table, body) => {") + 1200);
  assert.match(claim, /if \(!Array\.isArray\(rows\)\) return \{ ok: true, claimed: null \};/);
  // THE NOTE NEVER CARRIES A CONNECTION STRING.
  const put = W.slice(at("async function unrecordedPut(env, slug, rec) {"), at("async function unrecordedPut(env, slug, rec) {") + 600);
  assert.match(put, /const \{ conn, neon_conn, \.\.\.safe \} = rec \|\| \{\};/);
});

test("PROV 8 — THE ADD-ON'S ANSWER FOR A PROVISION THAT FAILED AFTER ITS PROJECT WAS RECORDED: a database started and kept, told in its outcome, its facts and its note — never \"nothing was changed\"; a failure before any project still says nothing changed", async () => {
  const r = await addon("lp-kept", "keep a list of breads", {
    backend: "none", provisions: true, kinds: ["table"], publishes: true, written: [],
    neonFail: /\/databases$/,
    answers: { table: { table: [{ table: { name: "breads", access: "display", columns: [{ name: "name", type: "text" }] } }] } },
  });
  assert.deepEqual([r.body.ok, r.body.error, r.body.stage], [false, "provision", "create_database"], JSON.stringify(r.body).slice(0, 500));
  assert.equal(r.body.outcome.projectKept, true);
  assert.ok(outcomeReads(r.body.outcome), JSON.stringify(r.body.outcome));
  assert.doesNotMatch(r.body.msg, /nothing was changed/);
  assert.match(r.body.msg, /kept, so the next try picks it up/);
  // OURS, SO ITS FIXED SENTENCE STANDS (no model reply), with the note under it.
  assert.equal(addonReplyFacts(r.body).skip, "technical");
  assert.match(String(r.body.coverNote || ""), /kept it, so the next try uses it/);
  // AND WHERE AN OUTCOME IS TOLD AS FACTS, the kept project is one, and "nothing was added" is not.
  const f = (addonReplyFacts({ ok: false, error: "compile", cost: 0, msg: "That didn't compile.", outcome: failureOutcome({ projectKept: true }) }).facts || []).map((x) => x.kind + ": " + x.text);
  assert.ok(f.includes("note: A database was started for the site and is kept, so the next try uses it rather than making another; nothing on the site uses it yet."), JSON.stringify(f));
  assert.ok(!f.some((t) => t.startsWith("not-done: Nothing was added.")), JSON.stringify(f));
  // CONTROL: a project that was never made — Neon refused the create (a 4xx).
  const before = await addon("lp-none", "keep a list of breads", {
    backend: "none", provisions: true, kinds: ["table"], publishes: true, written: [],
    neonFail: /\/projects$/, neonFailStatus: 422,
    answers: { table: { table: [{ table: { name: "breads", access: "display", columns: [{ name: "name", type: "text" }] } }] } },
  });
  assert.deepEqual([before.body.error, before.body.outcome.projectKept], ["provision", undefined]);
  assert.match(before.body.msg, /nothing was changed/);
  // …WHILE A 5xx MAY HAVE MADE ONE: when that cannot be established, it is said as unknown, never "nothing was changed".
  const maybe = await addon("lp-maybe", "keep a list of breads", {
    backend: "none", provisions: true, kinds: ["table"], publishes: true, written: [],
    neonFail: /\/projects$/,
    answers: { table: { table: [{ table: { name: "breads", access: "display", columns: [{ name: "name", type: "text" }] } }] } },
  });
  assert.deepEqual([maybe.body.error, maybe.body.outcome.projectKept], ["provision", "unknown"]);
  assert.doesNotMatch(maybe.body.msg, /nothing was changed/);
  // THE OUTCOME'S OWN READING: a value it does not know is not read.
  assert.equal(outcomeReads({ ...failureOutcome({ projectKept: true }), projectKept: "yes" }), false);
  assert.match(failureNote(failureOutcome({ projectKept: "unknown" })), /set aside to be checked before another is made/);
});

// ── THROUGH THE ROUTE (2026-10-07) ─────────────────────────────────────────
//
// The fixture's bucket answers every listing empty; these cases give it R2's
// own listing over what it stores — keys under the prefix, a page at a time —
// so the notes the route writes are the notes its next attempt reads.
function listing(bucket, size = 1000) {
  bucket.list = async ({ prefix = "", cursor } = {}) => {
    const keys = [...bucket.store.keys()].filter((k) => k.startsWith(prefix)).sort();
    const from = cursor ? Number(cursor) : 0;
    const page = keys.slice(from, from + size);
    const next = from + page.length;
    return { objects: page.map((key) => ({ key })), truncated: next < keys.length, ...(next < keys.length ? { cursor: String(next) } : {}) };
  };
}
const BREADS = { table: { table: [{ table: { name: "breads", access: "display", columns: [{ name: "name", type: "text" }] } }] } };
const PROVISIONING = { backend: "none", provisions: true, kinds: ["table"], publishes: true, written: [], answers: BREADS };
const NOTES = (slug) => "source/" + slug + "/neon-unrecorded/";
const notesIn = (store, slug) => [...store.store.keys()].filter((k) => k.startsWith(NOTES(slug))).map((k) => JSON.parse(store.store.get(k)));

/**
 * NEON AND THE SLUG'S PROJECT ROW, STATEFUL, in their own wire shapes: the
 * claim is insert-if-absent, Neon's projects carry the names the creates gave
 * them, a 404 answers for a project that does not exist. Everything else goes
 * to the fixture.
 */
function world(store, { projects = {}, row = null, teardown = [] } = {}) {
  listing(store);
  const inner = globalThis.fetch;
  const w = { row, projects: new Map(Object.entries(projects)), teardown: new Set(teardown), calls: [], seq: 0 };
  const json = (v, status = 200) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });
  globalThis.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input.url;
    const method = String((init && init.method) || "GET").toUpperCase();
    if (url.includes("/rest/v1/site_project")) {
      if (method === "POST") {
        const b = JSON.parse(String(init.body || "{}"));
        w.calls.push("claim " + b.neon_project);
        if (w.row) return json([], 201);
        w.row = { uid: b.uid, neon_project: b.neon_project, neon_branch: b.neon_branch, neon_role: b.neon_role, neon_conn: b.neon_conn };
        return json([{ slug: b.slug }], 201);
      }
      return json(w.row ? [w.row] : []);
    }
    if (url.includes("/rest/v1/neon_teardown")) {
      const id = decodeURIComponent((url.match(/project_id=eq\.([^&]+)/) || [])[1] || "");
      return json(w.teardown.has(id) ? [{ id: 1 }] : []);
    }
    if (url.includes("console.neon.tech/api/v2")) {
      const api = url.split("/api/v2")[1];
      const path = api.split("?")[0];
      w.calls.push(method + " " + path);
      let m;
      if (method === "POST" && path === "/projects") {
        const name = JSON.parse(String(init.body || "{}")).project.name;
        const id = "pr-new" + (w.seq++ || "");
        w.projects.set(id, name);
        return json({ project: { id, name }, branch: { id: "br-" + id }, roles: [{ name: "owner" }], connection_uris: [{ connection_uri: "postgres://u:p@ep-" + id + ".neon.tech/neondb" }] }, 201);
      }
      if (method === "GET" && path === "/projects") {
        const want = new URLSearchParams(api.split("?")[1] || "").get("search") || "";
        return json({ projects: [...w.projects].filter(([, n]) => n.includes(want)).map(([id, name]) => ({ id, name })), pagination: {} });
      }
      if ((m = path.match(/^\/projects\/([^/]+)$/)) && method === "DELETE") {
        if (!w.projects.has(m[1])) return json({ message: "not found" }, 404);
        w.projects.delete(m[1]);
        return json({ project: { id: m[1] } });
      }
      if ((m = path.match(/^\/projects\/([^/]+)\/branches$/)) && method === "GET") return w.projects.has(m[1]) ? json({ branches: [{ id: "br-" + m[1], default: true }] }) : json({ message: "not found" }, 404);
      if ((m = path.match(/^\/projects\/([^/]+)\/branches\/[^/]+\/databases$/)) && method === "GET") return w.projects.has(m[1]) ? json({ databases: [{ name: "neondb", owner_name: "owner" }] }) : json({ message: "not found" }, 404);
      if ((m = path.match(/^\/projects\/([^/]+)\/connection_uri$/))) return w.projects.has(m[1]) ? json({ uri: "postgres://u:p@ep-" + m[1] + ".neon.tech/neondb" }) : json({ message: "not found" }, 404);
    }
    return inner(input, init);
  };
  return w;
}

test("PROV 9 — THROUGH THE ADD-ON ROUTE, A CLAIM THAT FAILED AND A READ-BACK THAT FAILED: the project is kept, its attempt's note beside the site names it without its connection, and the answer says a database may have been started — without promising that trying again fixes it", async () => {
  const r = await addon("lp-unknown", "keep a list of breads", {
    ...PROVISIONING,
    setup: (env, store) => {
      listing(store);
      const inner = globalThis.fetch;
      let claimed = false;
      globalThis.fetch = async (input, init) => {
        const url = typeof input === "string" ? input : input.url;
        const method = String((init && init.method) || "GET").toUpperCase();
        if (url.includes("/rest/v1/site_project")) {
          if (method === "POST") { claimed = true; return new Response("upstream timeout", { status: 504 }); }
          if (claimed) return new Response("unavailable", { status: 503 });
        }
        return inner(input, init);
      };
    },
  });
  assert.deepEqual([r.body.ok, r.body.error, r.body.stage], [false, "provision", "save_project"], JSON.stringify(r.body).slice(0, 500));
  assert.equal(r.body.outcome.projectKept, "unknown");
  assert.ok(outcomeReads(r.body.outcome), JSON.stringify(r.body.outcome));
  assert.match(r.body.msg, /may have been started, and it's set aside to be checked before another is made/);
  assert.doesNotMatch(r.body.msg, /nothing was changed|is kept, so the next try picks it up|Try again in a few minutes/);
  assert.ok(r.neonCalls.includes("/projects"), "no project was made — this case tests nothing: " + r.neonCalls.join(" "));
  assert.ok(!r.neonCalls.includes("/projects/pr-new"), "a project that may be recorded was dropped");
  const kept = notesIn(r.store, "lp-unknown");
  assert.equal(kept.length, 1, "the attempt was not written down: " + [...r.store.store.keys()].join(" "));
  assert.deepEqual([kept[0].projectId, kept[0].uid, kept[0].slug], ["pr-new", USER.id, "lp-unknown"]);
  assert.equal(kept[0].name, projectNameForSite("lp-unknown", kept[0].attempt), "the note does not carry the name its project was made under");
  assert.doesNotMatch(JSON.stringify(kept[0]), /postgres:|ep-new|neon_conn|"conn"/, "the note carries a connection");
  assert.match(String(r.body.coverNote || ""), /set aside to be checked before another is made/);
});

test("PROV 10 — THE NEXT TRY THROUGH THE ROUTE: this account's earlier project is CLAIMED for the site, read from Neon — never dropped, nothing new made; another noted project, named by no row while the site's row names the first, is dropped; every note cleared, across listing pages; a note that cannot be read stops the try before anything is made", async () => {
  let w;
  const seed = (store, slug, ids) => { for (const id of ids) store.store.set(NOTES(slug) + id + ".json", JSON.stringify({ slug, uid: USER.id, projectId: id, why: "an earlier attempt" })); };
  const r = await addon("lp-again", "keep a list of breads", { ...PROVISIONING, setup: (env, store) => { w = world(store, { projects: { "pr-old": "isibi-lp-again-1", "pr-older": "isibi-lp-again-2" } }); listing(store, 1); seed(store, "lp-again", ["pr-old", "pr-older"]); } });
  assert.notEqual(r.body && r.body.error, "provision", JSON.stringify(r.body).slice(0, 400));
  assert.ok(!w.calls.includes("POST /projects"), "a new project was made over one the site could use: " + w.calls.join(" "));
  assert.equal(w.row && w.row.neon_project, "pr-old", "the earlier project was not claimed for the site");
  assert.ok(w.calls.includes("GET /projects/pr-old/connection_uri"), "the claimed project's connection was not read from Neon");
  assert.ok(w.calls.includes("DELETE /projects/pr-older"), "the project no row can name was not dropped: " + w.calls.join(" "));
  assert.ok(!w.calls.includes("DELETE /projects/pr-old"), "the claimed project was dropped");
  assert.deepEqual(notesIn(r.store, "lp-again"), [], "a settled note was left");
  // A NOTE THAT CANNOT BE READ is cannot-tell: nothing is made over it.
  const blind = await addon("lp-blind", "keep a list of breads", { ...PROVISIONING, setup: (env, store) => { listing(store); store.store.set(NOTES("lp-blind") + "pr-x.json", "{not a note"); } });
  assert.deepEqual([blind.body.error, blind.body.stage], ["provision", "reconcile_project"], JSON.stringify(blind.body).slice(0, 400));
  assert.ok(!blind.neonCalls.includes("/projects"), "a project was made over a note nobody could read");
  assert.ok(blind.store.store.get(NOTES("lp-blind") + "pr-x.json"), "the unreadable note was removed");
});

test("PROV 11 — THROUGH THE ROUTE, AN EARLIER TRY STILL MAKING ITS PROJECT: nothing is made, the note is untouched, and the answer says an earlier database has to be checked — never \"Try again in a few minutes\"; a clean first try writes its attempt down, makes one project under the attempt's name, and clears the note", async () => {
  const young = { slug: "lp-busy", uid: USER.id, attempt: "abc123", name: projectNameForSite("lp-busy", "abc123"), why: "a database project is being made for the site", at: new Date().toISOString() };
  let w;
  const r = await addon("lp-busy", "keep a list of breads", { ...PROVISIONING, setup: (env, store) => { w = world(store); store.store.set(NOTES("lp-busy") + "abc123.json", JSON.stringify(young)); } });
  assert.deepEqual([r.body.error, r.body.stage], ["provision", "reconcile_project"], JSON.stringify(r.body).slice(0, 400));
  assert.ok(!w.calls.includes("POST /projects"), "a project was made while an earlier try was making one");
  assert.match(r.body.msg, /still has to be checked before another is made/);
  assert.match(r.body.msg, /None was made this time/);
  assert.doesNotMatch(r.body.msg, /Try again in a few minutes/);
  assert.match(String(r.body.detail || ""), /in-progress/);
  assert.deepEqual(notesIn(r.store, "lp-busy"), [young]);
  // A CLEAN FIRST TRY: the attempt written down before the create, the project named with it, the note gone after.
  let w2;
  let noteBeforeCreate = null;
  const ok = await addon("lp-clean", "keep a list of breads", {
    ...PROVISIONING,
    setup: (env, store) => {
      w2 = world(store);
      const f = globalThis.fetch;
      globalThis.fetch = async (input, init) => {
        const url = typeof input === "string" ? input : input.url;
        if (url.includes("console.neon.tech/api/v2/projects") && String((init && init.method) || "GET").toUpperCase() === "POST" && noteBeforeCreate === null) noteBeforeCreate = notesIn(store, "lp-clean");
        return f(input, init);
      };
    },
  });
  assert.notEqual(ok.body && ok.body.error, "provision", JSON.stringify(ok.body).slice(0, 400));
  assert.equal((noteBeforeCreate || []).length, 1, "the attempt was not written down before the create");
  assert.equal([...w2.projects.values()][0], noteBeforeCreate[0].name, "the project was not made under the attempt's name");
  assert.deepEqual(notesIn(ok.store, "lp-clean"), [], "the settled note was left");
});

test("PROV 12 — THROUGH THE ROUTE, A CREATE NEON ANSWERED 504 AFTER MAKING THE PROJECT: found at once by its attempt's name in Neon's own listing, its connection read from Neon, claimed, and the provision finishes — one project; a noted project the teardown queue holds is never claimed", async () => {
  let w;
  const r = await addon("lp-lost", "keep a list of breads", {
    ...PROVISIONING,
    setup: (env, store) => {
      w = world(store);
      const f = globalThis.fetch;
      globalThis.fetch = async (input, init) => {
        const url = typeof input === "string" ? input : input.url;
        if (/console\.neon\.tech\/api\/v2\/projects$/.test(url) && String((init && init.method) || "GET").toUpperCase() === "POST") {
          const res = await f(input, init);
          await res.text();
          return new Response("gateway timeout", { status: 504 });
        }
        return f(input, init);
      };
    },
  });
  assert.notEqual(r.body && r.body.error, "provision", JSON.stringify([r.body.stage, r.body.detail, w.calls]));
  assert.equal(w.projects.size, 1, "more than one project stands: " + [...w.projects.keys()].join(" "));
  const [id, name] = [...w.projects][0];
  assert.ok(w.calls.includes("GET /projects"), "the project was not looked for by its name: " + w.calls.join(" "));
  assert.match(name, /^isibi-lp-lost-[0-9a-f]{12}$/, "the project's name does not carry its attempt");
  assert.equal(w.row && w.row.neon_project, id, "the project the create made was not claimed for the site");
  assert.ok(w.calls.includes("GET /projects/" + id + "/connection_uri"));
  assert.deepEqual(notesIn(r.store, "lp-lost"), []);
  // THE TEARDOWN QUEUE HOLDS IT: never claimed; its note settled; one new project made.
  let t;
  const torn = await addon("lp-torn", "keep a list of breads", { ...PROVISIONING, setup: (env, store) => { t = world(store, { projects: { "pr-gone": "isibi-lp-torn-x" }, teardown: ["pr-gone"] }); store.store.set(NOTES("lp-torn") + "pr-gone.json", JSON.stringify({ slug: "lp-torn", uid: USER.id, projectId: "pr-gone", why: "an earlier attempt" })); } });
  assert.notEqual(torn.body && torn.body.error, "provision", JSON.stringify(torn.body).slice(0, 400));
  assert.ok(!t.calls.includes("claim pr-gone") && !t.calls.includes("GET /projects/pr-gone/connection_uri"), "a project queued for teardown was claimed: " + t.calls.join(" "));
  assert.ok(t.calls.includes("POST /projects"));
  assert.notEqual(t.row && t.row.neon_project, "pr-gone");
  assert.deepEqual(notesIn(torn.store, "lp-torn"), []);
});

// ── THE NEON HELPERS, ON NEON'S OWN SHAPES ─────────────────────────────────

test("NAME 1 — THE PROJECT'S NAME CARRIES ITS ATTEMPT AND STAYS IN BOUNDS; the search matches the exact name only, follows pages, and throws rather than answer \"none\" when it cannot tell; a project Neon answers 404 for is gone", async () => {
  const { findSiteProjects, siteProjectDetails, _resetNeonOrgCache } = await import("../site-db.mjs");
  assert.equal(projectNameForSite("fold-lane"), "isibi-fold-lane");
  assert.equal(projectNameForSite("fold-lane", "a1b2c3"), "isibi-fold-lane-a1b2c3");
  const long = projectNameForSite("x".repeat(80), "a1b2c3d4e5f6");
  assert.ok(long.length <= 60 && long.endsWith("-a1b2c3d4e5f6"), long);
  const real = globalThis.fetch;
  const env = { NEON_API_KEY: "k" };
  try {
    _resetNeonOrgCache();
    const pages = [];
    globalThis.fetch = async (input) => {
      const url = typeof input === "string" ? input : input.url;
      if (url.endsWith("/users/me/organizations")) return new Response(JSON.stringify({ organizations: [{ id: "org-1" }] }), { status: 200 });
      const q = new URL(url).searchParams;
      pages.push([q.get("cursor") || "", q.get("org_id")]);
      if (!q.get("cursor")) return new Response(JSON.stringify({ projects: Array.from({ length: 400 }, (_, i) => ({ id: "p" + i, name: i === 3 ? "isibi-a-1" : "isibi-a-1-other" })), pagination: { cursor: "c1" } }), { status: 200 });
      return new Response(JSON.stringify({ projects: [{ id: "late", name: "isibi-a-1" }], pagination: { cursor: "c2" } }), { status: 200 });
    };
    assert.deepEqual((await findSiteProjects(env, "isibi-a-1")).map((p) => p.id), ["p3", "late"]);
    assert.deepEqual(pages, [["", "org-1"], ["c1", "org-1"]]);
    globalThis.fetch = async () => new Response("bad gateway", { status: 502 });
    await assert.rejects(findSiteProjects(env, "isibi-a-1"), /failed: 502/);
    globalThis.fetch = async () => new Response(JSON.stringify({ nope: true }), { status: 200 });
    await assert.rejects(findSiteProjects(env, "isibi-a-1"), /unexpected response/);
    // THE ORG COULD NOT BE ESTABLISHED THIS CALL: no listing in the wrong home.
    _resetNeonOrgCache();
    globalThis.fetch = async () => new Response("down", { status: 503 });
    await assert.rejects(findSiteProjects(env, "isibi-a-1"), /organisation could not be established/);
    globalThis.fetch = async () => new Response(JSON.stringify({ message: "not found" }), { status: 404 });
    const e = await siteProjectDetails(env, "pr-x").catch((x) => x);
    assert.equal(e.gone, true);
    globalThis.fetch = async (input) => {
      const url = typeof input === "string" ? input : input.url;
      if (url.includes("/branches/br-9/databases")) return new Response(JSON.stringify({ databases: [{ name: "neondb", owner_name: "neondb_owner" }, { name: "site_x", owner_name: "neondb_owner" }] }), { status: 200 });
      if (url.includes("/branches")) return new Response(JSON.stringify({ branches: [{ id: "br-8" }, { id: "br-9", default: true }] }), { status: 200 });
      if (url.includes("/connection_uri")) { const q = new URL(url).searchParams; return new Response(JSON.stringify({ uri: "postgres://" + q.get("role_name") + ":pw@ep/" + q.get("database_name") + "?b=" + q.get("branch_id") }), { status: 200 }); }
      return new Response("{}", { status: 500 });
    };
    assert.deepEqual(await siteProjectDetails(env, "pr-9"), { projectId: "pr-9", branchId: "br-9", roleName: "neondb_owner", conn: "postgres://neondb_owner:pw@ep/neondb?b=br-9" });
  } finally { globalThis.fetch = real; _resetNeonOrgCache(); }
});
