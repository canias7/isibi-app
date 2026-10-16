// JOBS OF ONE REQUEST SIDE BY SIDE (2026-10-15): the pure rules — which jobs
// the driver files at once (`nextStep`'s `writeMax`, `clearToWrite`), which
// steps share what their targets do not name (`besideConflict`,
// `holdsConfig`), and the publish's rebase (`rebaseFiles`). The integration
// through the real Worker is test/concurrent-writes.test.mjs.
import test from "node:test";
import assert from "node:assert/strict";
import { planParts, newRequest, nextStep, noteJobId } from "../builder/request.mjs";
import { clearToWrite, besideConflict, holdsConfig } from "../builder/request-plan.mjs";
import { rebaseFiles, readTurn, turnFree, turnRecord, TURN_TTL_MS } from "../builder/publish-turn.mjs";

const KEY = "rqbeside0000000001";
const A = "change the TikTok link on the Visit page";
const B = "change the opening line on the home page";
const C = "change the heading on the Order page";
/** A request whose parts are all routed, each to `routes[n]` with the writes `writes[n]`. */
function routed(routes, writes) {
  const words = [A, B, C].slice(0, routes.length);
  const message = words.join(", and ") + ".";
  const planned = planParts(message, { ...routes[0], alsoAsked: words.slice(1) });
  assert.equal(planned.ok, true, JSON.stringify(planned));
  const rec = newRequest({ key: KEY, uid: "u1", slug: "fold-lane", message, picker: "sonnet", accepted: routes[0], parts: planned.parts });
  rec.parts.forEach((p, n) => { p.phase = "run"; p.route = { ...routes[n] }; p.targets = { writes: writes[n], reads: [] }; p.status = "ready"; });
  return rec;
}
const text = (page) => ({ intent: "edit", layer: "text", page });
const ended = (q) => ["done", "failed", "partial", "cancelled", "not-run", "expired", "refused", "needs-rewrite"].includes(q.status);
const running = (q) => ["queued", "started", "unverified"].includes(q.status);

test("NS1 ONE AT A TIME BY DEFAULT — with no `writeMax` (the switch off) a request with two independent ready parts files exactly one job, as before, and `file` is that job", () => {
  const r = nextStep(routed([text("/visit"), text("/")], [["page:/visit"], ["page:/"]]), {}, 1);
  assert.equal(r.files.length, 1);
  assert.deepEqual(r.file, r.files[0]);
  assert.equal(r.file.n, 0);
  assert.deepEqual(r.record.parts.map((p) => p.status), ["queued", "ready"]);
});

test("NS2 INDEPENDENT PARTS SIDE BY SIDE — with `writeMax` above one, both ready parts on different pages are filed on the same step, each with its own key", () => {
  const r = nextStep(routed([text("/visit"), text("/")], [["page:/visit"], ["page:/"]]), {}, 1, { writeMax: 3 });
  assert.deepEqual(r.files.map((f) => f.n), [0, 1]);
  assert.notEqual(r.files[0].key, r.files[1].key);
  assert.deepEqual(r.record.parts.map((p) => p.status), ["queued", "queued"]);
});

test("NS3 CONFLICTING PARTS STAY IN ORDER — two changes to the same page: only the first is filed, whatever `writeMax` says", () => {
  const r = nextStep(routed([text("/"), text("/")], [["page:/"], ["page:/"]]), {}, 1, { writeMax: 3 });
  assert.deepEqual(r.files.map((f) => f.n), [0]);
});

test("NS4 BESIDE A RUNNING JOB — the first part's job is running: an independent ready part is filed beside it; a conflicting one is not; the cap counts the running job", () => {
  const start = (rec) => { const r = nextStep(rec, {}, 1); const withId = noteJobId(r.record, r.file.key, "job0000000000000a"); withId.parts[0].status = "started";
    // (The first step also claimed preparations for the other parts; a part
    // being prepared is never filed, so they are taken away here to ask only
    // the filing rule.)
    for (const p of withId.parts.slice(1)) delete p.prep;
    return withId; };
  const indep = start(routed([text("/visit"), text("/")], [["page:/visit"], ["page:/"]]));
  assert.deepEqual(nextStep(indep, {}, 2, { writeMax: 3 }).files.map((f) => f.n), [1]);
  assert.deepEqual(nextStep(indep, {}, 2, { writeMax: 1 }).files, [], "with one at a time nothing is filed beside a running job");
  const clash = start(routed([text("/"), text("/")], [["page:/"], ["page:/"]]));
  assert.deepEqual(nextStep(clash, {}, 2, { writeMax: 3 }).files, []);
  const three = start(routed([text("/visit"), text("/"), text("/order")], [["page:/visit"], ["page:/"], ["page:/order"]]));
  assert.deepEqual(nextStep(three, {}, 2, { writeMax: 2 }).files.map((f) => f.n), [1], "the cap counts the job already running");
  assert.deepEqual(nextStep(three, {}, 2, { writeMax: 3 }).files.map((f) => f.n), [1, 2]);
});

test("NS5 A PART THAT NEEDS ANOTHER IS NOT FILED BESIDE IT — the model said part 1 rests on part 0: with `writeMax` 3 only part 0 is filed, and part 1 is blocked", () => {
  const rec = routed([text("/visit"), text("/")], [["page:/visit"], ["page:/"]]);
  rec.parts[1].needs = [0];
  const r = nextStep(rec, {}, 1, { writeMax: 3 });
  assert.deepEqual(r.files.map((f) => f.n), [0]);
  assert.equal(r.record.parts[1].status, "blocked");
});

test("BC1 SHARED STORES THE TARGETS DO NOT NAME — two steps that both rewrite the config (a look and a logo, a look and an addition naming the look) or both the schema (rules and an addition naming a table) conflict on disjoint targets; an addition is judged by its targets (2026-10-16), so one naming only a page conflicts with neither; a text change beside an addition does not", () => {
  const part = (route, writes) => ({ phase: "run", route, targets: { writes, reads: [] } });
  const look = part({ intent: "edit", layer: "look", page: "/visit" }, ["page:/visit"]);
  const addon = part({ intent: "addon", op: "addon" }, ["new-page:/gifts"]);
  const rules = part({ intent: "edit", layer: "rules" }, ["data:bookings"]);
  const words = part(text("/"), ["page:/"]);
  const logo = part({ intent: "edit", layer: "logo" }, []);
  const addonLook = part({ intent: "addon", op: "addon" }, ["new-page:/gifts", "theme"]);
  const addonTable = part({ intent: "addon", op: "addon" }, ["new-page:/gifts", "new-data:gifts"]);
  const addonBlank = part({ intent: "addon", op: "addon" }, []);
  assert.equal(besideConflict(look, addonLook), true, "two config writers");
  assert.equal(besideConflict(look, logo), true, "two config writers");
  assert.equal(besideConflict(rules, addonTable), true, "two schema writers");
  assert.equal(besideConflict(look, addonBlank), true, "an addition naming nothing is the whole site");
  // AN ADDITION BY ITS TARGETS (2026-10-16): a page alone is neither store;
  // one that turns out to need more is refused at that write and runs alone.
  assert.equal(besideConflict(look, addon), false, "a page addition kept from a look on another page");
  assert.equal(besideConflict(rules, addon), false, "a page addition kept from a rules step");
  assert.equal(besideConflict(words, addon), false, "a text change and an addition on other pages");
  assert.equal(besideConflict(words, look), false, "a text change and a look on another page");
  assert.equal(besideConflict(words, part(text("/"), ["page:/"])), true, "the same page");
  assert.equal(holdsConfig(look), true);
  assert.equal(holdsConfig(addon), false, "a page addition holds the turn from its first read");
  assert.equal(holdsConfig(addonLook), true);
  assert.equal(holdsConfig(logo), true);
  assert.equal(holdsConfig(words), false);
  assert.equal(holdsConfig({ phase: "route", route: null, targets: { writes: ["theme"], reads: [] } }), false, "a routing writes nothing");
});

test("CTW1 THE ORDER AND THE RUNNING JOBS — a write waits for an earlier unfinished part it conflicts with, and for any running one; a routing waits only for what feeds its page list; a running routing holds no write back", () => {
  const mk = (n, at, phase, route, writes, status = "ready") => ({ n, at, phase, route, targets: { writes, reads: [] }, status, needs: [], jobs: [] });
  // Part 1 (page /) later in the order than part 0 (same page), not running.
  let parts = [mk(0, 0, "run", text("/"), ["page:/"]), mk(1, 1, "run", text("/"), ["page:/"])];
  assert.equal(clearToWrite(parts, 1, ended, running), false);
  parts[0].status = "done";
  assert.equal(clearToWrite(parts, 1, ended, running), true);
  // A running part LATER in the order still holds back a conflicting write.
  parts = [mk(0, 0, "run", text("/"), ["page:/"]), mk(1, 1, "run", { intent: "edit", layer: "nav" }, ["menu"], "started")];
  parts[0].targets.writes = ["menu"];
  assert.equal(clearToWrite(parts, 0, ended, running), false);
  // A routing beside a job writing a page: free; beside one creating a page: waits.
  parts = [mk(0, 0, "run", text("/"), ["page:/"], "started"), mk(1, 1, "route", null, ["page:/x"])];
  assert.equal(clearToWrite(parts, 1, ended, running), true);
  parts[0].targets.writes = ["new-page:/gifts"]; parts[0].route = { intent: "addon", op: "addon" };
  assert.equal(clearToWrite(parts, 1, ended, running), false);
  // A running routing never holds a write back.
  parts = [mk(0, 0, "route", null, [], "started"), mk(1, 1, "run", text("/"), ["page:/"])];
  parts[0].at = 2;
  assert.equal(clearToWrite(parts, 1, ended, running), true);
});

const f = (path, source) => ({ path, source });
test("RB1 THE REBASE — each of the job's own changes onto the site as it is now; what it did not change taken as stored now; the same change on both sides kept once; additions and removals on either side; a file both changed differently is a conflict", () => {
  const base = [f("a.tsx", "A0"), f("b.tsx", "B0"), f("c.tsx", "C0")];
  // mine changed a; another job changed b and added d.
  let r = rebaseFiles(base, [f("a.tsx", "A1"), f("b.tsx", "B0"), f("c.tsx", "C0")], [f("a.tsx", "A0"), f("b.tsx", "B1"), f("c.tsx", "C0"), f("d.tsx", "D1")]);
  assert.equal(r.ok, true);
  assert.deepEqual(r.files.map((x) => x.path + "=" + x.source), ["a.tsx=A1", "b.tsx=B1", "c.tsx=C0", "d.tsx=D1"]);
  assert.deepEqual(r.took, ["a.tsx"]);
  assert.deepEqual(r.kept.sort(), ["b.tsx", "d.tsx"]);
  // mine added e and removed c; the other removed b.
  r = rebaseFiles(base, [f("a.tsx", "A0"), f("b.tsx", "B0"), f("e.tsx", "E1")], [f("a.tsx", "A0"), f("c.tsx", "C0")]);
  assert.equal(r.ok, true);
  assert.deepEqual(r.files.map((x) => x.path), ["a.tsx", "e.tsx"]);
  // both made the same change: no conflict.
  r = rebaseFiles(base, [f("a.tsx", "A1"), f("b.tsx", "B0"), f("c.tsx", "C0")], [f("a.tsx", "A1"), f("b.tsx", "B0"), f("c.tsx", "C0")]);
  assert.equal(r.ok, true);
  assert.deepEqual(r.files.map((x) => x.source), ["A1", "B0", "C0"]);
  // both changed a differently; both added f differently; mine changed what the other removed.
  assert.deepEqual(rebaseFiles(base, [f("a.tsx", "A1"), f("b.tsx", "B0"), f("c.tsx", "C0")], [f("a.tsx", "A2"), f("b.tsx", "B0"), f("c.tsx", "C0")]), { ok: false, conflicts: ["a.tsx"] });
  assert.deepEqual(rebaseFiles(base, [...base, f("f.tsx", "F1")], [...base, f("f.tsx", "F2")]), { ok: false, conflicts: ["f.tsx"] });
  assert.deepEqual(rebaseFiles(base, [f("a.tsx", "A0"), f("b.tsx", "B9"), f("c.tsx", "C0")], [f("a.tsx", "A0"), f("c.tsx", "C0")]), { ok: false, conflicts: ["b.tsx"] });
  // components are keyed by name.
  r = rebaseFiles([{ name: "Faq", source: "x" }], [{ name: "Faq", source: "x" }, { name: "Note", source: "n" }], [{ name: "Faq", source: "y" }], { key: "name" });
  assert.deepEqual(r.files, [{ name: "Faq", source: "y" }, { name: "Note", source: "n" }]);
});

test("RB2 NOTHING UNREADABLE IS READ AS EMPTY — a list that is not a list, an entry without a string path or source, or one path twice is refused, never rebased", () => {
  const ok = [f("a.tsx", "A0")];
  for (const bad of [null, "x", [null], [{ path: "", source: "s" }], [{ path: "a.tsx", source: 3 }], [f("a.tsx", "1"), f("a.tsx", "2")]]) {
    assert.equal(rebaseFiles(bad, ok, ok).ok, false, JSON.stringify(bad));
    assert.equal(rebaseFiles(ok, bad, ok).ok, false, JSON.stringify(bad));
    assert.equal(rebaseFiles(ok, ok, bad).ok, false, JSON.stringify(bad));
  }
});

test("TN1 THE TURN — free when nothing is stored, when it is the asker's own, or when it lapsed; held otherwise; an object that does not read as a turn is held until its own age lapses, never read as free", () => {
  const now = 1_000_000;
  const t = turnRecord("job:a:o1", now, "a");
  const stored = (rec, uploadedAt = now) => ({ turn: readTurn(JSON.stringify(rec)), uploadedAt });
  assert.equal(turnFree(null, "job:b:o2", now), true);
  assert.equal(turnFree(stored(t), "job:a:o1", now + 1), true, "the holder's own");
  assert.equal(turnFree(stored(t), "job:b:o2", now + 1), false, "held by another");
  assert.equal(turnFree(stored(t), "job:b:o2", now + TURN_TTL_MS + 1), true, "lapsed");
  assert.equal(turnFree(stored({ ...t, until: 0 }), "job:b:o2", now), true, "given back");
  assert.equal(readTurn("not json"), null);
  assert.equal(turnFree({ turn: null, uploadedAt: new Date(now) }, "job:b:o2", now + 5), false, "an unreadable turn is not free");
  assert.equal(turnFree({ turn: null, uploadedAt: new Date(now) }, "job:b:o2", now + TURN_TTL_MS + 5), true, "until its own age lapses");
  assert.equal(turnFree({ turn: null }, "job:b:o2", now), false, "an unreadable turn with no age is never free");
});
