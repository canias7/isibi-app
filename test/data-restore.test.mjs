// PUT A SITE'S DATA BACK (2026-10-26): `builder/data-restore.mjs` with a fake
// Neon and fake databases. No network, no model.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  resolveRestoreTime, diffRows, diffTables, restoreFacts, checkExplanation, plainExplanation,
  previewRestore, confirmRestore, undoRestore, lockSite, RESTORE_WINDOW_MS, SNAPSHOT_PREFIX, cardLists,
} from "../builder/data-restore.mjs";
import { LIVE_ASK_TOOL } from "../builder/site-ask.mjs";

const NOW = Date.UTC(2026, 9, 26, 12, 0); // 2026-10-26 12:00 UTC (London is GMT after 25 Oct)
const TZ = "Europe/London";

// ── a fake site: tables keyed by branch; a fake Neon over them ─────────────
const PAST = {
  lessons: { key: ["id"], rows: [
    { id: 1, name: "Beginner guitar", price: 40 },
    { id: 2, name: "Jazz chords", price: 55 },
    { id: 3, name: "Slide basics", price: 30 },
  ] },
  bookings: { key: ["id"], rows: [{ id: 7, lesson: "Beginner guitar", email: "ann@example.com" }] },
};
const NOWT = {
  lessons: { key: ["id"], rows: [
    { id: 1, name: "Beginner guitar", price: 42 },
    { id: 3, name: "Slide basics", price: 30 },
    { id: 4, name: "Blues licks", price: 35, created_at: "2026-10-26T09:12:00Z" },
  ] },
  bookings: { key: ["id"], rows: [{ id: 7, lesson: "Beginner guitar", email: "ann@example.com" }] },
};

function fakeSite({ uid = "u1", dbs = ["site_fretwork_1"], failRestore = false, copyMissing = false } = {}) {
  const log = [];
  const state = { main: structuredClone(NOWT), branches: [{ id: "br-main", name: "main", default: true }] };
  const pastOf = new Map();
  const asTables = (t) => t; // the fake query below reads these directly
  const neon = {
    async databases(p, b) { log.push(["databases", p, b]); return dbs; },
    async pastBranch(p, b, iso) { log.push(["pastBranch", p, b, iso]); const id = "br-past-" + log.length; pastOf.set(id, structuredClone(PAST)); state.branches.push({ id, name: "restore-diff-x" }); return { branchId: id }; },
    async conn(p, b) { log.push(["conn", p, b]); return "conn:" + b; },
    async del(p, b) { log.push(["del", p, b]); state.branches = state.branches.filter((x) => x.id !== b); },
    async restore(p, b, o) {
      log.push(["restore", p, b, o]);
      if (failRestore) throw Object.assign(new Error("x"), { status: 500 });
      // Neon keeps the replaced state under preserve_under_name in the same operation.
      if (!copyMissing) state.branches.push({ id: "br-" + o.preserveName, name: o.preserveName, data: state.main });
      if (o.atIso) state.main = structuredClone(PAST);
      else state.main = state.branches.find((x) => x.id === o.sourceBranchId).data;
    },
    async branches(p) { log.push(["branches", p]); return state.branches.map(({ id, name }) => ({ id, name })); },
  };
  const tablesFor = (conn) => conn === "conn:main" ? state.main : pastOf.get(conn.slice(5));
  const query = async (conn, sql, params) => {
    const t = asTables(tablesFor(conn));
    if (/information_schema/.test(sql)) return Object.keys(t).sort().map((table_name) => ({ table_name }));
    if (/pg_index/.test(sql)) return t[params[0]].key.map((col) => ({ col }));
    const m = /FROM public\."(\w+)"/.exec(sql);
    return structuredClone(t[m[1]].rows);
  };
  const project = { uid, neon_project: "proj-site", neon_branch: "br-main" };
  return { log, state, deps: { neon, query, mainConn: "conn:main" }, project, who: { project, uid: "u1", dbName: "site_fretwork_1" } };
}

// ── the moment ──────────────────────────────────────────────────────────────
test("the moment: yesterday 6pm in the site's zone, and the window", () => {
  const r = resolveRestoreTime("yesterday 6pm", { now: NOW, tz: TZ });
  assert.equal(r.ok, true);
  assert.equal(r.iso, "2026-10-25T18:00:00.000Z"); // London is UTC+0 on 25 Oct evening
  const ny = resolveRestoreTime("yesterday 6pm", { now: NOW, tz: "America/New_York" });
  assert.equal(ny.iso, "2026-10-25T22:00:00.000Z");
  assert.equal(resolveRestoreTime("2 hours ago", { now: NOW, tz: TZ }).at, NOW - 2 * 3600000);
});

test("the moment: beyond one day is refused honestly, the future refused, no clock asked", () => {
  const old = resolveRestoreTime("2026-10-24 09:00", { now: NOW, tz: TZ });
  assert.equal(old.ok, false); assert.equal(old.why, "window"); assert.match(old.say, /24 hours/);
  assert.equal(resolveRestoreTime("30 hours ago", { now: NOW, tz: TZ }).why, "window");
  assert.equal(resolveRestoreTime("today at 3pm", { now: NOW, tz: TZ }).why, "future");
  const a = resolveRestoreTime("this morning", { now: NOW, tz: TZ });
  assert.equal(a.why, "ask"); assert.match(a.say, /exact time/);
  assert.equal(RESTORE_WINDOW_MS, 86400000);
});

// ── the difference ──────────────────────────────────────────────────────────
test("diff: comes back, changes back with before and after, would be lost, with times", () => {
  const d = diffRows(PAST.lessons.rows, NOWT.lessons.rows, ["id"]);
  assert.deepEqual(d.back.map((r) => r.label), ["Jazz chords"]);
  assert.deepEqual(d.change.map((r) => [r.label, r.fields]), [["Beginner guitar", [{ col: "price", now: "42", back: "40" }]]]);
  assert.deepEqual(d.lost.map((r) => r.label), ["Blues licks"]);
  assert.equal(d.lost[0].time.at, Date.parse("2026-10-26T09:12:00Z"));
  const all = diffTables(PAST, NOWT);
  assert.deepEqual(all.map((t) => t.table), ["lessons"]); // bookings did not change
});

test("diff: private details never reach the facts or the lists", () => {
  const d = diffTables({ c: { key: ["id"], rows: [{ id: 1, name: "Ann", email: "ann@example.com", phone: "+44 7700 900123" }] } }, { c: { key: ["id"], rows: [{ id: 1, name: "Ann", email: "new@example.com", phone: "+44 7700 900999" }] } });
  const text = JSON.stringify(restoreFacts(d, { said: "x", tz: TZ })) + JSON.stringify(cardLists(d, TZ));
  assert.ok(text.includes("(hidden)"));
  assert.ok(!/example\.com|7700/.test(text));
});

// ── the check ───────────────────────────────────────────────────────────────
test("check: numbers and names must be in the difference; emails refused", () => {
  const facts = restoreFacts(diffTables(PAST, NOWT), { said: "Sunday 25 October, 6:00 pm", tz: TZ });
  assert.equal(checkExplanation("Jazz chords comes back, Beginner guitar goes from 42 back to 40, and Blues licks would be lost.", facts).ok, true);
  assert.deepEqual(checkExplanation("Jazz chords comes back and 3 lessons change.", facts).bad, ["3"]);
  assert.ok(checkExplanation("We also restore \"Piano basics\".", facts).bad.includes("Piano basics"));
  assert.ok(checkExplanation("Your list gets Mandolin back.", facts).bad.includes("Mandolin"));
  assert.ok(checkExplanation("Ann (ann@example.com) booked it.", facts).bad.includes("email"));
});

// ── the flow ────────────────────────────────────────────────────────────────
test("preview: model text kept when it passes the check; the diff branch is deleted", async () => {
  const f = fakeSite();
  const r = await previewRestore({ ...f.deps, explain: async () => ({ text: "Jazz chords comes back, Beginner guitar goes from 42 back to 40, and Blues licks would be lost.", usage: [{ in: 1, out: 1 }] }) }, { ...f.who, when: "yesterday 6pm", tz: TZ, now: NOW });
  assert.equal(r.ok, true); assert.equal(r.written, "model");
  assert.deepEqual(r.lists.lost.length, 1);
  const past = f.log.find((x) => x[0] === "pastBranch");
  assert.deepEqual(past.slice(1), ["proj-site", "br-main", "2026-10-25T18:00:00.000Z"]);
  assert.ok(f.log.some((x) => x[0] === "del" && x[1] === "proj-site" && /^br-past-/.test(x[2])));
  assert.ok(!f.log.some((x) => x[0] === "restore"));
  assert.equal(f.state.branches.length, 1);
});

test("preview: a text with an invented number falls back to the plain list", async () => {
  const f = fakeSite();
  const r = await previewRestore({ ...f.deps, explain: async () => ({ text: "5 lessons come back.", usage: [] }) }, { ...f.who, when: "yesterday 6pm", tz: TZ, now: NOW });
  assert.equal(r.written, "plain"); assert.deepEqual(r.bad, ["5"]);
  assert.equal(r.text, plainExplanation(diffTables(PAST, NOWT), { said: r.said, tz: TZ }));
});

test("preview: beyond the window is refused before any Neon call", async () => {
  const f = fakeSite();
  const r = await previewRestore(f.deps, { ...f.who, when: "30 hours ago", tz: TZ, now: NOW });
  assert.equal(r.why, "window"); assert.equal(f.log.length, 0);
});

test("site lock: another owner's row, a shared project, no project", async () => {
  const other = fakeSite({ uid: "someone-else" });
  assert.equal((await previewRestore(other.deps, { ...other.who, project: other.project, when: "yesterday 6pm", tz: TZ, now: NOW })).why, "not-owner");
  assert.equal(other.log.length, 0);
  const shared = fakeSite({ dbs: ["site_fretwork_1", "site_other_2"] });
  assert.equal((await confirmRestore(shared.deps, { ...shared.who, at: "2026-10-25T18:00:00Z", typed: "restore", now: NOW })).why, "shared-project");
  assert.ok(!shared.log.some((x) => x[0] === "restore"));
  assert.equal((await lockSite(shared.deps.neon, { project: null, uid: "u1", dbName: "x" })).why, "no-project");
});

test("confirm: refused on the server unless \"restore\" is typed", async () => {
  for (const typed of ["", "yes", "restor", undefined]) {
    const f = fakeSite();
    const r = await confirmRestore(f.deps, { ...f.who, at: "2026-10-25T18:00:00Z", typed, now: NOW });
    assert.equal(r.why, "confirm-required"); assert.equal(f.log.length, 0);
  }
  const f = fakeSite();
  assert.equal((await confirmRestore(f.deps, { ...f.who, at: "2026-10-24T09:00:00Z", typed: "restore", now: NOW })).why, "window");
});

test("confirm: the copy is kept by the restore itself, then found; restored data verified; diff branch gone", async () => {
  const f = fakeSite();
  const r = await confirmRestore(f.deps, { ...f.who, at: "2026-10-25T18:00:00Z", typed: " Restore ", tz: TZ, now: NOW });
  assert.equal(r.ok, true); assert.equal(r.kept, true); assert.equal(r.verified, true);
  const rs = f.log.filter((x) => x[0] === "restore");
  assert.equal(rs.length, 1);
  assert.equal(rs[0][1], "proj-site"); assert.equal(rs[0][2], "br-main");
  assert.ok(rs[0][3].preserveName.startsWith(SNAPSHOT_PREFIX));
  assert.equal(rs[0][3].atIso, "2026-10-25T18:00:00.000Z");
  assert.deepEqual(f.state.main, PAST);
  assert.ok(f.state.branches.some((b) => b.name === r.snapshot));
  assert.ok(!f.state.branches.some((b) => b.name === "restore-diff-x"));
  assert.match(r.say, /undo the restore/);
});

test("undo: puts the before-restore copy back, keeping the restored state too", async () => {
  const f = fakeSite();
  await confirmRestore(f.deps, { ...f.who, at: "2026-10-25T18:00:00Z", typed: "restore", now: NOW });
  assert.equal((await undoRestore(f.deps, { ...f.who, typed: "" })).why, "confirm-required");
  const u = await undoRestore(f.deps, { ...f.who, typed: "undo", now: NOW + 60000 });
  assert.equal(u.ok, true); assert.ok(u.from.startsWith(SNAPSHOT_PREFIX));
  assert.deepEqual(f.state.main, NOWT);
  const last = f.log.filter((x) => x[0] === "restore").pop();
  assert.ok(last[3].preserveName && !last[3].atIso);
  const none = fakeSite();
  assert.equal((await undoRestore(none.deps, { ...none.who, typed: "undo" })).why, "no-copy");
});

test("confirm: a copy Neon did not keep is said plainly, never claimed", async () => {
  const f = fakeSite({ copyMissing: true });
  const r = await confirmRestore(f.deps, { ...f.who, at: "2026-10-25T18:00:00Z", typed: "restore", now: NOW });
  assert.equal(r.kept, false); assert.doesNotMatch(r.say, /undo the restore/); assert.match(r.say, /can't promise an undo/);
});

test("a failed restore says nothing changed and leaves no diff branch", async () => {
  const f = fakeSite({ failRestore: true });
  const r = await confirmRestore(f.deps, { ...f.who, at: "2026-10-25T18:00:00Z", typed: "restore", now: NOW });
  assert.equal(r.ok, false); assert.match(r.say, /Nothing was changed/);
  assert.equal(f.state.branches.length, 1);
});

// ── the wiring ──────────────────────────────────────────────────────────────
test("wiring: the router offers restore; Neon's restore always carries preserve_under_name; the worker and page call it", () => {
  const p = LIVE_ASK_TOOL.input_schema.properties;
  assert.ok(p.intent.enum.includes("restore")); assert.ok(p.restoreWhen && p.restoreUndo);
  const db = readFileSync(new URL("../site-db.mjs", import.meta.url), "utf8");
  const i = db.indexOf("export async function restoreBranch"); assert.ok(i > 0);
  const body = db.slice(i, db.indexOf("\n}\n", i));
  assert.match(body, /if \(!preserveName\) throw/);
  assert.match(body, /preserve_under_name: String\(preserveName\)/);
  const w = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  assert.match(w, /\/data-restore\$\/i\)/);
  assert.match(w, /confirmRestore\(rdeps, \{ \.\.\.who, at: body\.at, typed: body\.typed/);
  const c = readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");
  assert.ok(c.includes("A copy of your data as it is now is saved first, so this can be undone."));
  assert.match(c, /data-restore-go="' \+ k \+ '" disabled>/);
});
