// SUBSTANTIVE WORK PREPARED BESIDE ANOTHER TASK'S JOB, FOR THE STEPS THAT
// BEFORE 2026-10-09 OVERLAPPED ONLY THEIR ROUTING — look, page, data (a stored
// row changed), and the add-on step (a page added; an entry added to a list).
//
// Each case is two tasks in one message, through the real request driver,
// queue consumer and routes, every model answer and every picture supplied:
// task 1 is a photograph whose PURCHASE IS HELD OPEN, and the case proves the
// other task's own model work (its lanes, its tweak, its designer and page
// writer, its row changes) was made WHILE that purchase was still held — by a
// gate the purchase waits on, which only the other task's substantive call
// opens. Then the other task's job runs and makes none of those calls again;
// nothing of it was written before its job (rows, pages, the stored look);
// each job charged once, one publish per task that publishes.
import test from "node:test";
import { tweakInput, asEdits } from "./fixtures/tweak-edits.mjs";
import assert from "node:assert/strict";
import { platform, sendMessage, deliver, settle, T } from "./fixtures/request-flow.mjs";
import { blockNetwork, unexpected } from "./fixtures/no-network.mjs";
import { installCompiler } from "./fixtures/cf-containers.mjs";
import { writtenPage } from "./fixtures/addon-route.mjs";
import { page as pageSrc } from "./fixtures/live-ask.mjs";
import { rowsDb, BAKERY_LOAVES, LOAF_COLUMNS } from "./fixtures/rows-db.mjs";
import { CONFIG_KEY } from "../site-config.mjs";
import { SOURCE_KEY, PARTS_KEY } from "./fixtures/live-ask.mjs";
import { standInTweakParser } from "../builder/site-tweak.mjs";

blockNetwork();

const slugOf = (k) => "pp-" + k + "-" + Math.random().toString(16).slice(2, 8);
async function withPlatform(opts, fn) {
  const compiler = installCompiler();
  const P = platform(opts);
  // (2026-10-09, round 4) the case ends once its background work settled
  // with the stand-ins in place, and asked for nothing they were not set up for.
  try { const out = await fn(P); await P.settle(); assert.deepEqual(P.unexpected, [], "requests the stand-ins were not set up for"); return out; } finally { P.close(); compiler.uninstall(); }
}
const calls = (P, tool) => P.modelLog.filter((m) => m.tool === tool);
/** Every stored object of the site but a request's or a job's records, by its etag. */
const siteEtags = (P) => new Map([...P.objects.entries()].filter(([k]) => !/^(requests|requests-live|jobs)\//.test(k)).map(([k, o]) => [k, o.etag]));
const changedSince = (P, was) => { const now = siteEtags(P); return [...new Set([...now.keys(), ...was.keys()])].filter((k) => now.get(k) !== was.get(k)); };
/** The site's own stored objects holding `text` — not a request's or a job's records, where a preparation keeps its answers. */
const siteObjectsWith = (P, text) => [...P.objects.entries()].filter(([k, o]) => !/^(requests|jobs)\//.test(k) && typeof o.body === "string" && o.body.includes(text)).map(([k]) => k);
const statuses = (rec) => rec.parts.map((p) => p.status);

const HOME_PIC = pageSrc("/", "<section className=\"hero\"><h1>Harbour Loaf</h1><SafeImage src=\"\" alt=\"A loaf on the counter\" ratio=\"4/3\" /><p>Bread from the harbour, every morning.</p></section>");
const VISIT = pageSrc("/visit", "<section className=\"come\"><h1>Come to the bakery</h1><p>We are on Harbour Street.</p></section>");
const PAGES = [{ path: "index.tsx", source: HOME_PIC }, { path: "visit.tsx", source: VISIT }];
const PHOTO = "make a photo of a sourdough loaf for the home page";
const PICTURE = { pictures: [{ page: "index.tsx", alt: "A loaf on the counter", describe: "a sourdough loaf on a wooden counter" }] };
const PAGE = (path, name) => ({ path, name, purpose: "what " + name + " is for", sections: ["a band"], components: ["section-header"] });

const SPEC = { tables: [{ name: "loaves", columns: [{ name: "name", type: "text" }, { name: "description", type: "text" }, { name: "price", type: "numeric" }, { name: "photo", type: "text" }], read: "public", write: "none" }] };
const loavesDb = () => rowsDb({ tables: { loaves: { columns: LOAF_COLUMNS, rows: BAKERY_LOAVES, next: 12 } }, meta: { schema: JSON.stringify(SPEC) } });
const RYE = "make the Dark Rye £5.50";
const VISIT_LINE = "We are on Harbour Street.";
const VISIT_TO = "We are on Harbour Street, by the quay.";
const TEXT_WORDS = "on the Visit page, say we are on Harbour Street by the quay";
const lineId = (args, file, line) => {
  const at = String(args.messages[0].content).split("\n").find((l) => l.includes("[" + file + "] " + line));
  return Number(String(at || "-1.").split(".")[0]);
};

/**
 * ONE CASE. `first` is the task whose job runs first and is HELD inside its
 * own work: `photo` (its purchase held; `page` names its page, or none) or
 * `data` (its row-change call held). `other` is the second task: its words,
 * the router's answer for it, the targets named for it, its answers, and
 * `marker`, the tool whose call is its substantive work. The held work waits
 * for that call (or 4 s). `check.before` runs after the preparation and before
 * the other task's job; `check.after` once the request has ended.
 */
async function overlapCase({ slug, first = { kind: "photo", page: "/" }, other, db = null, check, env = null }) {
  let markerSeen = null;
  const seen = new Promise((ok) => { markerSeen = ok; });
  let opened = null;
  const hold = async () => { opened = await Promise.race([seen.then(() => true), new Promise((ok) => setTimeout(() => ok(false), 4000))]); };
  const otherReads = other.reads ? { reads: other.reads } : {};
  const firstRoute = first.kind === "text"
    ? { intent: "edit", layer: "text", page: "/visit", alsoAsked: [other.words], targets: [{ change: 0, writes: ["page:/visit"] }, ...(other.writes ? [{ change: 1, writes: other.writes, ...otherReads }] : [])] }
    : first.kind === "data"
    ? { intent: "edit", layer: "data", alsoAsked: [other.words], targets: [{ change: 0, writes: ["data:" + (first.table || "loaves")] }, ...(other.writes ? [{ change: 1, writes: other.writes, ...otherReads }] : [])] }
    : { intent: "edit", layer: "picture", ...(first.page ? { page: first.page } : {}), alsoAsked: [other.words], targets: [{ change: 0, writes: ["images", ...(first.page ? ["page:" + first.page] : [])] }, ...(other.writes ? [{ change: 1, writes: other.writes, ...otherReads }] : [])] };
  const answers = { route: [firstRoute, other.route], choose_pictures: PICTURE, ...other.answers };
  const ft = first.table || "loaves";
  // A HELD TEXT EDIT (round 11): the Visit line reworded, its model answer held.
  if (first.kind === "text") answers[T.text] = async (args) => { await hold(); return { edits: [{ id: lineId(args, "visit.tsx", first.line || VISIT_LINE), to: first.to || VISIT_TO }] }; };
  if (first.kind === "data") answers.write_row_changes = async () => { await hold(); return { changes: ft === "loaves" ? [{ table: "loaves", id: 2, values: { price: 5.5 } }] : [{ table: ft, id: 1, values: { opens: "08:00" } }] }; };
  const tool = other.marker;
  const orig = answers[tool];
  answers[tool] = async (args, n) => { markerSeen(); return typeof orig === "function" ? orig(args, n) : Array.isArray(orig) ? orig[Math.min(n, orig.length - 1)] : orig; };
  await withPlatform({
    slug, pages: PAGES, images: true, ...(db ? { db } : {}), answers,
    ...(first.kind === "photo" ? { imageWith: hold } : {}),
  }, async (P) => {
    if (check && check.setup) await check.setup(P);
    if (env) Object.assign(P.env, env);
    const words = first.kind === "text" ? TEXT_WORDS : first.kind === "data" ? (first.table === "hours" ? "open the bakery at 8 on Mondays" : RYE) : PHOTO;
    const r = await sendMessage(P, { message: words + ", and " + other.words + "." });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const prep = P.queue.filter((m) => m.body.kind === "request-prep");
    const jobs = P.queue.filter((m) => m.body.kind !== "request-prep");
    assert.equal(prep.length, 1, "the other task was not claimed for preparation");
    P.queue.splice(0);
    const running = deliver(P, jobs[0]);
    await new Promise((ok) => setTimeout(ok, 50));
    // NOTHING OF THE SITE WRITTEN BY THE PREPARATION: with a first task that
    // writes no stored object (a row change), every object of the site but a
    // request's or a job's records is exactly as it was — not written and
    // put back, not written at all.
    // (A held text edit is released by the other task's call and publishes
    // the Visit page while the preparation is still running, so its cases
    // check what the preparation wrote in `check.before`.)
    if (check && check.midway) await check.midway(P);
    const strict = first.kind === "data";
    const before = strict ? siteEtags(P) : null;
    await deliver(P, prep[0]);
    if (strict) assert.deepEqual(changedSince(P, before), [], "the preparation wrote to the site");
    const mid = P.record(r.key).parts[1].prep;
    if (check && check.before) await check.before(P);
    await running;
    // A REAL DEPENDENCY (`other.waits`): the other task's own work is NOT done
    // while the first task's job is inside its own — the hold runs out.
    if (other.waits) assert.equal(opened, false, "the other task's work was done before what it reads was written: " + JSON.stringify(mid));
    else assert.equal(opened, true, "the other task's own work was not done while the first task's job was inside its own: " + JSON.stringify(mid));
    if (other.prepared !== false && !other.waits) assert.equal(mid.outcome, "ready", "the other task's step was not prepared: " + JSON.stringify(mid));
    const { rec } = await settle(P, r.key);
    assert.deepEqual(statuses(rec), ["done", "done"], JSON.stringify(rec.parts.map((p) => [p.status, p.why, p.prep && p.prep.outcome])));
    // THE SUBSTANTIVE CALL ONCE: made by the preparation, answered to the job.
    const logged = other.logged || tool;
    if (other.once !== false) assert.equal(calls(P, logged).length, 1, logged + " was not asked exactly once (the preparation's call, answered to the job)");
    assert.equal(P.imageLog.length, first.kind === "photo" ? 1 : 0);
    // Each job charged once — or, where the route bills in stages (`other.seqs`:
    // an addition that applies a schema and then publishes takes #1 before the
    // apply and #4 after the publish), each stage once.
    for (const j of P.jobsOf(r.key)) {
      const rows = P.ledger.filter((e) => e.ref.startsWith(j.id + "#") && e.reason === "reserve").map((e) => e.ref.slice(e.ref.indexOf("#")));
      if (other.seqs && j.op === "addon") assert.deepEqual(rows, other.seqs, "the addition's stages were not each charged once");
      else assert.ok(rows.length <= 1, j.op + " charged more than once: " + JSON.stringify(rows));
    }
    if (check && check.after) await check.after(P, rec, r);
  });
}

// ── THE PAGE TWEAK (2026-10-09, round 3: the recorded gap) ──────────────────

/** The file a page tweak (`write_tweak`) is shown: its prompt carries it after "THE FILE (". */
function shownFile(args) {
  const content = String((args && args.messages && args.messages[0] && args.messages[0].content) || "");
  const at = content.indexOf("\n\nTHE FILE (");
  if (at < 0) return null;
  const rest = content.slice(at + "\n\nTHE FILE (".length);
  const close = rest.indexOf(")\n");
  // THE FILE ENDS WHERE THE REQUEST'S CONTEXT BEGINS (2026-10-22, A03-5): the
  // prompt appends "THE WHOLE REQUEST THIS PART CAME FROM" after the file, and
  // a stub that echoed it answered a page that does not parse — which the
  // tweak's syntax check now (rightly) sends to the rewrite.
  let source = rest.slice(close + 2);
  const ctx = source.indexOf("\n\n\nTHE WHOLE REQUEST THIS PART CAME FROM");
  if (ctx >= 0) source = source.slice(0, ctx);
  return { path: rest.slice(0, close), source };
}

// ── NAMED LOOK, RULES AND PAGE CHANGES CONSUME THEIR OWN INPUTS (2026-10-11,
//    the generality round) ────────────────────────────────────────────────────
//
// Beside a first task that writes ANOTHER page or table, each is prepared while
// that task's job runs — it waited before, planned as reading every page or
// every table — and its job replays the prepared answer exactly.

const twoTables = () => {
  const SPEC2 = { tables: [SPEC.tables[0], { name: "hours", columns: [{ name: "day", type: "text" }, { name: "opens", type: "text" }], read: "public", write: "none" }] };
  const HOURS = [{ id: 1, day: "Monday", opens: "09:00", created_at: "2026-08-21 23:06:22" }];
  return rowsDb({ tables: { loaves: { columns: LOAF_COLUMNS, rows: BAKERY_LOAVES, next: 12 }, hours: { columns: [{ name: "id", type: "integer" }, { name: "day", type: "text" }, { name: "opens", type: "text" }, { name: "created_at", type: "timestamp with time zone" }], rows: HOURS } }, meta: { schema: JSON.stringify(SPEC2) } });
};

// ── ROUND 11: ADDITIONS BESIDE UNRELATED EDITS, NOT ONLY BESIDE A PHOTOGRAPH ──
// The first task is a TEXT edit on the Visit page, its model answer held: it
// writes a page's words, which no new page's design, table or function
// reads. Each addition below is designed (and, with no page to write,
// finished) while that edit is held; a new page's writer — which copies the
// pages beside it — waits for the edit and is asked once, at its job.

const GALLERY = { [T.adds]: { kinds: ["page"] }, "add:page": { page: [PAGE("/gallery", "Gallery")] }, [T.pages]: { pages: [writtenPage("/gallery")] } };

const FN_COUNT = { name: "count_loaves", internal: true, returns: "void", body: "BEGIN PERFORM 1; END;" };
const madeFn = (db, name) => db.log().filter((q) => new RegExp("create (or replace )?function[^(]*" + name, "i").test(q.query)).length;

test("NET — no request in this file left the machine", () => {
  assert.deepEqual(unexpected().filter((u) => u.by === "blocked"), []);
});
