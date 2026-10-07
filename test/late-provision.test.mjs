// A DATABASE PROJECT STARTED BEFORE A LATER FAILURE IS KEPT WITH ITS SITE OR
// WRITTEN DOWN, NEVER DUPLICATED, NEVER DROPPED WHILE IT MAY BE IN USE (2026-10-07).
//
// The owner: *"resolve the documented late-provisioning gap so a
// database/project created before a later failure is durably associated with
// the correct site or explicitly recorded for safe reconciliation, preventing
// an automatic retry or subsequent request from silently provisioning a
// duplicate; preserve ownership checks and do not delete potentially used
// resources as cleanup."*
//
//   READ BACK   a claim whose answer was lost or unreadable said nothing about
//               whether its row landed, and both cleanups dropped the project
//               anyway; now the row is read back first, and a project is
//               dropped only when no row names it.
//   NOTED       where that cannot be established, or a drop fails, the project
//               is written down (never its connection string), and the next
//               attempt settles it before it makes another — or stops.
//   KEPT        every failure after the project is recorded says so
//               (`recorded`, its own stage), and the add-on's answer tells a
//               database started and kept rather than "nothing was changed".
//   OWNERSHIP   a project row another account owns is never read as this
//               site's database, and an answer that cannot be read is never
//               read as "none".
//
// ⚠ Every Neon and Supabase answer here is a stand-in; nothing is provisioned.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ensureSiteBackend } from "../site-provision.mjs";
import { backendState } from "../site-backend-state.mjs";
import { failureOutcome, failureNote } from "../builder/site-add.mjs";
import { addonReplyFacts, outcomeReads } from "../builder/site-reply.mjs";
import { addon, USER } from "./fixtures/addon-route.mjs";

const UID = "u-owner";
const MADE = { projectId: "pr-1", branchId: "br-1", roleName: "owner", conn: "postgres://u:secret@ep-1.neon.tech/neondb" };

/**
 * The provisioner's deps as fakes: `row` is the slug's `site_project` row as
 * the store holds it; each dep can be told how to behave; every call is kept.
 */
function harness(o = {}) {
  const calls = [];
  const state = { row: o.row === undefined ? null : o.row, notes: (o.notes || []).slice() };
  let lookups = 0;
  const deps = {
    lookupSite: async () => (o.site === undefined ? null : o.site),
    lookupProject: async () => {
      lookups++;
      calls.push("lookupProject");
      if (typeof o.lookupProject === "function") return o.lookupProject(lookups, state);
      return state.row;
    },
    createProject: async () => { calls.push("createProject"); if (o.createFails) throw o.createFails; return { ...MADE }; },
    dropProject: async (id) => { calls.push("dropProject:" + id); if (o.dropFails) throw new Error("drop refused"); },
    saveProject: async (slug, uid, proj) => {
      calls.push("saveProject");
      if (typeof o.saveProject === "function") return o.saveProject(state, slug, uid, proj);
      state.row = { uid, ...proj };
      return { ok: true, claimed: true };
    },
    createDatabase: async () => { calls.push("createDatabase"); if (o.dbFails) throw Object.assign(new Error("database refused"), { status: 500 }); return "site_x"; },
    enableAuth: async () => { calls.push("enableAuth"); if (o.authFails) throw Object.assign(new Error("auth refused"), { status: 502 }); return { info: null }; },
    enableData: async () => { calls.push("enableData"); if (o.dataFails) throw Object.assign(new Error("data api refused"), { status: 503 }); return { info: null }; },
    saveBackend: async () => { calls.push("saveBackend"); return o.backendFails ? { ok: false, detail: "no" } : { ok: true, claimed: true }; },
    connFor: (conn, db) => conn.replace(/neondb$/, db),
    dbNameFor: () => "site_x",
    warn: (m) => calls.push("warn:" + m),
    noteUnrecorded: async (slug, rec) => { calls.push("note:" + rec.projectId); state.notes.push(rec); },
    unrecorded: async () => { if (o.notesUnreadable) throw new Error("bucket unreadable"); return state.notes.slice(); },
    clearUnrecorded: async (slug, id) => { calls.push("clear:" + id); state.notes = state.notes.filter((n) => n.projectId !== id); },
  };
  return { deps, calls, state };
}
const run = (h) => ensureSiteBackend(h.deps, { slug: "fold-lane", uid: UID });
const fails = async (h) => { try { await run(h); } catch (e) { return e; } assert.fail("the provision did not fail"); };

test("PROV 1 — A CLAIM WHOSE ANSWER WAS LOST BUT WHOSE ROW LANDED KEEPS ITS PROJECT: read back, found, and the site built on it — never dropped as unrecorded", async () => {
  const h = harness({ saveProject: (state, slug, uid, proj) => { state.row = { uid, ...proj }; throw new Error("the answer was lost"); } });
  const conn = await run(h);
  assert.match(conn, /ep-1\.neon\.tech\/site_x$/);
  assert.ok(!h.calls.some((c) => c.startsWith("dropProject")), "a project whose row landed was dropped: " + h.calls.join(" "));
  assert.equal(h.calls.filter((c) => c === "createProject").length, 1);
  // A ROW THAT LANDED NAMING OUR PROJECT UNDER ANOTHER ACCOUNT is never built on: its owner is read first.
  const stranger = harness({ saveProject: (state, slug, uid, proj) => { state.row = { ...proj, uid: "u-stranger", neon_project: proj.neon_project }; throw new Error("the answer was lost"); } });
  const e = await fails(stranger);
  assert.equal(e.conflict, true, "a row another account owns was built on after a lost answer");
  assert.ok(!stranger.calls.includes("createDatabase"));
});

test("PROV 2 — A CLAIM THAT FAILED AND A READ-BACK THAT FAILED: the project is not dropped, it is written down without its connection, and the failure says its recording is unknown", async () => {
  const h = harness({
    saveProject: () => ({ ok: false, detail: "gateway timeout" }),
    lookupProject: (n) => { if (n === 1) return null; throw new Error("supabase down"); },
  });
  const e = await fails(h);
  assert.deepEqual([e.stage, e.recorded], ["save_project", "unknown"]);
  assert.ok(!h.calls.some((c) => c.startsWith("dropProject")), "a project that may be recorded was dropped");
  assert.equal(h.state.notes.length, 1);
  assert.equal(h.state.notes[0].projectId, "pr-1");
  assert.equal(h.state.notes[0].uid, UID);
  assert.ok(!JSON.stringify(h.state.notes[0]).includes("secret"), "the note carries the connection string");
});

test("PROV 3 — A CLAIM THAT FAILED AND NO ROW NAMES THE PROJECT: dropped as before; when that drop fails too, it is written down rather than left to a log line", async () => {
  const ok = harness({ saveProject: () => ({ ok: false, detail: "refused" }) });
  const e = await fails(ok);
  assert.equal(e.stage, "save_project");
  assert.equal(e.recorded, undefined);
  assert.ok(ok.calls.includes("dropProject:pr-1"));
  assert.equal(ok.state.notes.length, 0);
  const stuck = harness({ saveProject: () => ({ ok: false, detail: "refused" }), dropFails: true });
  await fails(stuck);
  assert.deepEqual(stuck.state.notes.map((n) => n.projectId), ["pr-1"], "a project nothing holds was left to a log line");
  // A CREATE THAT THREW AFTER NEON MADE THE PROJECT: dropped, and when the drop fails, written down too.
  const thrown = harness({ createFails: Object.assign(new Error("waitForProject timed out"), { projectId: "pr-made" }) });
  await fails(thrown);
  assert.ok(thrown.calls.includes("dropProject:pr-made"));
  assert.equal(thrown.state.notes.length, 0, "a project that was dropped was written down");
  const leftover = harness({ createFails: Object.assign(new Error("waitForProject timed out"), { projectId: "pr-made" }), dropFails: true });
  const le = await fails(leftover);
  assert.equal(le.stage, "create_project");
  assert.deepEqual(leftover.state.notes.map((n) => [n.projectId, n.uid]), [["pr-made", UID]], "a project the create left behind was left to a log line");
});

test("PROV 4 — A CLAIM WHOSE ANSWER COULD NOT BE READ (`claimed: null`): ours when the row names it; a lost race when another project holds the slug, converged with ownership checked; written down when nothing can be established", async () => {
  const ours = harness({ saveProject: (state, slug, uid, proj) => { state.row = { uid, ...proj }; return { ok: true, claimed: null }; } });
  assert.match(await run(ours), /ep-1/);
  assert.ok(!ours.calls.some((c) => c.startsWith("dropProject")));
  const winner = { uid: UID, neon_project: "pr-winner", neon_branch: "br-w", neon_role: "owner", neon_conn: "postgres://u:w@ep-w.neon.tech/neondb" };
  const lost = harness({ saveProject: (state) => { state.row = winner; return { ok: true, claimed: null }; } });
  assert.match(await run(lost), /ep-w\.neon\.tech/);
  assert.ok(lost.calls.includes("dropProject:pr-1"), "our unrecorded project was not dropped after the race");
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
  assert.ok(!blind.calls.some((x) => x.startsWith("dropProject")));
  assert.deepEqual(blind.state.notes.map((n) => n.projectId), ["pr-1"]);
});

test("PROV 5 — AN EARLIER ATTEMPT'S UNRECORDED PROJECT IS SETTLED BEFORE ANOTHER IS MADE: removed and its note cleared, then one new project; when it cannot be removed, nothing new is made; another account's note is never touched; a note the row names is cleared; notes that cannot be read stop a create", async () => {
  const note = { projectId: "pr-old", uid: UID, why: "earlier" };
  const settled = harness({ notes: [note] });
  await run(settled);
  assert.deepEqual(settled.calls.filter((c) => /^(dropProject|clear|createProject)/.test(c)), ["dropProject:pr-old", "clear:pr-old", "createProject"]);
  const stuck = harness({ notes: [note], dropFails: true });
  const e = await fails(stuck);
  assert.deepEqual([e.stage, e.reconcile], ["reconcile_project", true]);
  assert.ok(!stuck.calls.includes("createProject"), "a second project was made over one that could not be removed");
  const other = harness({ notes: [{ projectId: "pr-theirs", uid: "u-stranger" }] });
  await run(other);
  assert.ok(!other.calls.some((c) => c.includes("pr-theirs")), "another account's note was touched");
  const recorded = harness({ notes: [{ projectId: "pr-1", uid: UID }], row: { uid: UID, neon_project: "pr-1", neon_branch: "br-1", neon_role: "owner", neon_conn: MADE.conn } });
  await run(recorded);
  assert.ok(recorded.calls.includes("clear:pr-1") && !recorded.calls.includes("dropProject:pr-1") && !recorded.calls.includes("createProject"), recorded.calls.join(" "));
  const blind = harness({ notesUnreadable: true });
  const u = await fails(blind);
  assert.equal(u.stage, "reconcile_project");
  assert.ok(!blind.calls.includes("createProject"));
  // ON THE REUSE PATH an unreadable list is said and the build goes on — nothing new is made there.
  const reuse = harness({ notesUnreadable: true, row: { uid: UID, neon_project: "pr-1", neon_branch: "br-1", neon_role: "owner", neon_conn: MADE.conn } });
  assert.match(await run(reuse), /ep-1/);
});

test("PROV 6 — EVERY FAILURE AFTER THE PROJECT IS RECORDED SAYS SO, WITH ITS OWN STAGE; a failure before it does not", async () => {
  for (const [opt, stage] of [["dbFails", "create_database"], ["authFails", "enable_auth"], ["dataFails", "enable_data_api"], ["backendFails", "save_backend"]]) {
    const h = harness({ [opt]: true });
    const e = await fails(h);
    assert.deepEqual([e.stage, e.recorded], [stage, true], opt);
    assert.ok(!h.calls.some((c) => c.startsWith("dropProject")), opt + ": a recorded project was dropped");
  }
  const early = harness({ createFails: Object.assign(new Error("neon down"), { projectId: null }) });
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
  // CONTROL: a project that was never made.
  const before = await addon("lp-none", "keep a list of breads", {
    backend: "none", provisions: true, kinds: ["table"], publishes: true, written: [],
    neonFail: /\/projects$/,
    answers: { table: { table: [{ table: { name: "breads", access: "display", columns: [{ name: "name", type: "text" }] } }] } },
  });
  assert.deepEqual([before.body.error, before.body.outcome.projectKept], ["provision", undefined]);
  assert.match(before.body.msg, /nothing was changed/);
  // THE OUTCOME'S OWN READING: a value it does not know is not read.
  assert.equal(outcomeReads({ ...failureOutcome({ projectKept: true }), projectKept: "yes" }), false);
  assert.match(failureNote(failureOutcome({ projectKept: "unknown" })), /set aside to be checked before another is made/);
});

// ── THROUGH THE ROUTE: AN UNKNOWN RECORDING, AND THE NEXT TRY (2026-10-07) ──
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
const noteKey = (slug, id) => "source/" + slug + "/neon-unrecorded/" + id + ".json";

test("PROV 9 — THROUGH THE ADD-ON ROUTE, A CLAIM THAT FAILED AND A READ-BACK THAT FAILED: the project is kept, written down beside the site without its connection, and the answer says a database may have been started — told as facts too, never \"nothing was added\"", async () => {
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
  assert.doesNotMatch(r.body.msg, /nothing was changed|is kept, so the next try picks it up/);
  assert.ok(r.neonCalls.includes("/projects"), "no project was made — this case tests nothing: " + r.neonCalls.join(" "));
  assert.ok(!r.neonCalls.includes("/projects/pr-new"), "a project that may be recorded was dropped");
  const kept = r.store.store.get(noteKey("lp-unknown", "pr-new"));
  assert.ok(kept, "the project was not written down: " + [...r.store.store.keys()].join(" "));
  const note = JSON.parse(kept);
  assert.deepEqual([note.projectId, note.uid, note.slug], ["pr-new", USER.id, "lp-unknown"]);
  assert.doesNotMatch(kept, /postgres:|ep-new|neon_conn|"conn"/, "the note carries a connection");
  assert.match(String(r.body.coverNote || ""), /set aside to be checked before another is made/);
  const f = (addonReplyFacts({ ok: false, error: "compile", cost: 0, msg: "That didn't compile.", outcome: failureOutcome({ projectKept: "unknown" }) }).facts || []).map((x) => x.kind + ": " + x.text);
  assert.ok(f.includes("note: A database may have been started for the site; whether it was recorded could not be established, so it is set aside to be checked before another is made."), JSON.stringify(f));
  assert.ok(!f.some((t) => t.startsWith("not-done: Nothing was added.")), JSON.stringify(f));
});

test("PROV 10 — THE NEXT TRY THROUGH THE ROUTE: every note of this account's is settled first — across listing pages — and its notes cleared, before one new project is made; a note that cannot be read stops the try before anything is made", async () => {
  const seed = (store, slug, ids) => { for (const id of ids) store.store.set(noteKey(slug, id), JSON.stringify({ slug, uid: USER.id, projectId: id, why: "an earlier attempt" })); };
  const r = await addon("lp-again", "keep a list of breads", { ...PROVISIONING, setup: (env, store) => { listing(store, 1); seed(store, "lp-again", ["pr-old", "pr-older"]); } });
  assert.notEqual(r.body && r.body.error, "provision", JSON.stringify(r.body).slice(0, 400));
  const create = r.neonCalls.indexOf("/projects");
  assert.ok(create >= 0, "no project was made: " + r.neonCalls.join(" "));
  for (const id of ["pr-old", "pr-older"]) {
    const at = r.neonCalls.indexOf("/projects/" + id);
    assert.ok(at >= 0 && at < create, id + " was not settled before the new project: " + r.neonCalls.join(" "));
    assert.equal(r.store.store.get(noteKey("lp-again", id)), undefined, id + "'s note was not cleared");
  }
  assert.equal(r.neonCalls.filter((c) => c === "/projects").length, 1, "more than one project was made");
  // A NOTE THAT CANNOT BE READ is cannot-tell: nothing is made over it.
  const blind = await addon("lp-blind", "keep a list of breads", { ...PROVISIONING, setup: (env, store) => { listing(store); store.store.set(noteKey("lp-blind", "pr-x"), "{not a note"); } });
  assert.deepEqual([blind.body.error, blind.body.stage], ["provision", "reconcile_project"], JSON.stringify(blind.body).slice(0, 400));
  assert.ok(!blind.neonCalls.includes("/projects"), "a project was made over a note nobody could read");
  assert.ok(blind.store.store.get(noteKey("lp-blind", "pr-x")), "the unreadable note was removed");
});
