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
import assert from "node:assert/strict";
import { platform, sendMessage, deliver, settle, T } from "./fixtures/request-flow.mjs";
import { blockNetwork, unexpected } from "./fixtures/no-network.mjs";
import { installCompiler } from "./fixtures/cf-containers.mjs";
import { writtenPage } from "./fixtures/addon-route.mjs";
import { page as pageSrc } from "./fixtures/live-ask.mjs";
import { rowsDb, BAKERY_LOAVES, LOAF_COLUMNS } from "./fixtures/rows-db.mjs";

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
async function overlapCase({ slug, first = { kind: "photo", page: "/" }, other, db = null, check }) {
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

test("PATH look — a site-description lane answered while a stored row's change is being chosen; the look stored only by its own job", async () => {
  const DESC = "change the site description to say we bake overnight sourdough";
  const NEW_DESC = "Overnight sourdough from a Bristol side street.";
  const db = loavesDb();
  await overlapCase({
    slug: slugOf("look"), db, first: { kind: "data" },
    other: {
      words: DESC, writes: ["identity"], route: { intent: "edit", layer: "look" }, marker: "lane:description", logged: T.lane,
      answers: { [T.pick]: { fields: ["description"], scopes: [{ part: "description", words: DESC }] }, "lane:description": NEW_DESC },
    },
    check: {
      before: (P) => assert.deepEqual(siteObjectsWith(P, NEW_DESC), [], "the preparation stored the look"),
      after: (P) => assert.ok(siteObjectsWith(P, NEW_DESC).length > 0, "the look was not stored by its job"),
    },
  });
});

test("PATH page — the Visit page rewritten by the page writer while a stored row's change is being chosen; the page changed only by its own job", async () => {
  const WORDS = "on the Visit page, add a line saying we open at 8";
  const NEW_VISIT = VISIT.replace("<p>We are on Harbour Street.</p>", "<p>We are on Harbour Street.</p><p>Open from 8 every morning.</p>");
  const db = loavesDb();
  await overlapCase({
    slug: slugOf("page"), db, first: { kind: "data" },
    other: { words: WORDS, writes: ["page:/visit"], route: { intent: "edit", layer: "page", page: "/visit" }, marker: T.pages, answers: { [T.pages]: { pages: [{ path: "src/routes/visit.tsx", source: NEW_VISIT }] } } },
    check: {
      before: (P) => assert.ok(!P.page("visit.tsx").includes("Open from 8"), "the preparation wrote the page"),
      after: (P) => assert.ok(P.page("visit.tsx").includes("Open from 8"), "the page was not changed by its job"),
    },
  });
});

test("PATH add-on page — the addition's designer and page writer answered while a stored row's change is being chosen; the page added only by its own job", async () => {
  const db = loavesDb();
  await overlapCase({
    slug: slugOf("addp"), db, first: { kind: "data" },
    other: {
      words: "add a gallery page", writes: ["new-page:/gallery"], route: { intent: "addon" }, marker: T.pages,
      answers: { [T.adds]: { kinds: ["page"] }, "add:page": { page: [PAGE("/gallery", "Gallery")] }, [T.pages]: { pages: [writtenPage("/gallery")] } },
    },
    check: {
      before: (P) => assert.ok(!P.pages().includes("gallery.tsx"), "the preparation added the page"),
      after: (P) => { assert.ok(P.pages().includes("gallery.tsx")); assert.equal(calls(P, T.design).length, 1, "the designer was asked again"); assert.equal(calls(P, T.adds).length, 1); },
    },
  });
});

test("PATH add-on row — an entry for one stored list chosen while a row of ANOTHER list is being changed; the entry written only by its own job, once — and the two lists' changes both kept", async () => {
  const ENTRY = "add Rye & Caraway at £5.00 to the loaves";
  const SPEC2 = { tables: [SPEC.tables[0], { name: "hours", columns: [{ name: "day", type: "text" }, { name: "opens", type: "text" }], read: "public", write: "none" }] };
  const HOURS = [{ id: 1, day: "Monday", opens: "09:00", created_at: "2026-08-21 23:06:22" }];
  const db = rowsDb({ tables: { loaves: { columns: LOAF_COLUMNS, rows: BAKERY_LOAVES, next: 12 }, hours: { columns: [{ name: "id", type: "integer" }, { name: "day", type: "text" }, { name: "opens", type: "text" }, { name: "created_at", type: "timestamp with time zone" }], rows: HOURS } }, meta: { schema: JSON.stringify(SPEC2) } });
  await overlapCase({
    slug: slugOf("addr"), db, first: { kind: "data", table: "hours" },
    other: {
      words: ENTRY, writes: ["data:loaves"], route: { intent: "addon" }, marker: "add:row", logged: T.design,
      answers: { [T.adds]: { kinds: ["row"], scopes: [{ kind: "row", words: ENTRY }] }, "add:row": { row: [{ table: "loaves", values: { name: "Rye & Caraway", price: 5, description: "A light rye with toasted caraway." } }] } },
    },
    check: {
      before: () => assert.equal(db.rows("loaves").length, BAKERY_LOAVES.length, "the preparation wrote the row"),
      after: () => {
        const l = db.rows("loaves");
        assert.equal(l.length, BAKERY_LOAVES.length + 1);
        assert.equal(l.filter((x) => x.name === "Rye & Caraway").length, 1);
        assert.equal(db.rows("hours")[0].opens, "08:00", "the other list's change was lost");
      },
    },
  });
});

test("PATH data — a stored row's change chosen while the photograph is bought; the row changed only by its own job", async () => {
  const WORDS = "make the Dark Rye £5.50";
  const SPEC = { tables: [{ name: "loaves", columns: [{ name: "name", type: "text" }, { name: "description", type: "text" }, { name: "price", type: "numeric" }, { name: "photo", type: "text" }], read: "public", write: "none" }] };
  const db = rowsDb({ tables: { loaves: { columns: LOAF_COLUMNS, rows: BAKERY_LOAVES, next: 12 } }, meta: { schema: JSON.stringify(SPEC) } });
  const rye = () => db.rows("loaves").find((l) => l.id === 2);
  await overlapCase({
    slug: slugOf("data"), db,
    other: { words: WORDS, writes: ["data:loaves"], route: { intent: "edit", layer: "data" }, marker: "write_row_changes", answers: { write_row_changes: { changes: [{ table: "loaves", id: 2, values: { price: 5.5 } }] } } },
    check: {
      before: () => assert.equal(Number(rye().price), 5.2, "the preparation changed the row"),
      after: () => assert.equal(Number(rye().price), 5.5, "the row was not changed by its job"),
    },
  });
});

test("PATH rules — a table's rule chosen while the photograph is bought; nothing granted before its own job, and the schema applied by that job", async () => {
  const WORDS = "let signed-in members add loaves";
  const db = loavesDb();
  const ddl = () => db.log().filter((e) => /\b(GRANT|REVOKE|POLICY)\b/i.test(String(e.query))).length;
  await overlapCase({
    slug: slugOf("rules"), db,
    other: { words: WORDS, writes: ["data:loaves"], route: { intent: "edit", layer: "rules" }, marker: "write_table_rules", answers: { write_table_rules: { tables: [{ table: "loaves", write: "members" }] } } },
    check: {
      before: () => assert.equal(ddl(), 0, "the preparation granted or revoked something"),
      after: () => {
        assert.ok(ddl() > 0, "the rule was not applied by its job");
        const stored = db.log().filter((e) => /^INSERT INTO _meta \(k,v\) VALUES \('schema'/.test(String(e.query))).pop();
        assert.ok(stored, "the job stored no schema");
        assert.equal(JSON.parse(stored.params[0]).tables.find((t) => t.name === "loaves").write, "members", "the stored rule is not the one chosen");
      },
    },
  });
});

test("REVALIDATED — a prepared page rewrite is NOT applied when the site changed after it was prepared: the job's request differs, the page writer is asked again against the page as it now is, and the change made in between is kept", async () => {
  const WORDS = "on the Visit page, add a line saying we open at 8";
  const NEW_VISIT = VISIT.replace("<p>We are on Harbour Street.</p>", "<p>We are on Harbour Street.</p><p>Open from 8 every morning.</p>");
  const db = loavesDb();
  let writerCalls = 0;
  await overlapCase({
    slug: slugOf("stale"), db, first: { kind: "data" },
    other: {
      words: WORDS, writes: ["page:/visit"], route: { intent: "edit", layer: "page", page: "/visit" }, marker: T.pages, once: false,
      answers: { [T.pages]: (args) => { writerCalls++; const current = String(args.messages[0].content).includes("Parking round the back") ? NEW_VISIT.replace("</section>", "<p>Parking round the back.</p></section>") : NEW_VISIT; return { pages: [{ path: "src/routes/visit.tsx", source: current }] }; } },
    },
    check: {
      // SOMETHING ELSE CHANGES THE PAGE THE WRITER READS between the preparation
      // and the job: a line on the Visit page itself.
      before: (P) => {
        const k = [...P.objects.keys()].find((x) => /^source\//.test(x) || x.endsWith("/pages.json"));
        const key = k || [...P.objects.keys()].find((x) => { try { return Array.isArray(JSON.parse(P.objects.get(x).body)) && JSON.parse(P.objects.get(x).body).some((p) => p.path === "visit.tsx"); } catch { return false; } });
        const list = JSON.parse(P.objects.get(key).body);
        list.find((p) => p.path === "visit.tsx").source = list.find((p) => p.path === "visit.tsx").source.replace("</section>", "<p>Parking round the back.</p></section>");
        P.objects.set(key, { ...P.objects.get(key), body: JSON.stringify(list), etag: "changed" });
      },
      after: (P) => {
        assert.equal(writerCalls, 2, "the job applied the prepared rewrite to a site that had changed");
        assert.ok(P.page("visit.tsx").includes("Parking round the back."), "the change made in between was lost");
        assert.ok(P.page("visit.tsx").includes("Open from 8"));
      },
    },
  });
});

test("REVALIDATED control — A SIBLING PAGE'S WORDS CHANGED between the preparation and the job (the home page's line, not the Visit page): the Visit rewrite is shown only its own page's source and the other pages' NAMES, so its request is unchanged — the prepared answer is applied, the writer asked once, and the home page's change kept (2026-10-11, the validation round)", async () => {
  const WORDS = "on the Visit page, add a line saying we open at 8";
  const NEW_VISIT = VISIT.replace("<p>We are on Harbour Street.</p>", "<p>We are on Harbour Street.</p><p>Open from 8 every morning.</p>");
  const db = loavesDb();
  let writerCalls = 0;
  const shown = [];
  await overlapCase({
    slug: slugOf("sib"), db, first: { kind: "data" },
    other: {
      words: WORDS, writes: ["page:/visit"], route: { intent: "edit", layer: "page", page: "/visit" }, marker: T.pages, once: false,
      answers: { [T.pages]: (args) => { writerCalls++; shown.push(String(args.messages[0].content)); return { pages: [{ path: "src/routes/visit.tsx", source: NEW_VISIT }] }; } },
    },
    check: {
      before: (P) => {
        const key = [...P.objects.keys()].find((x) => { try { return Array.isArray(JSON.parse(P.objects.get(x).body)) && JSON.parse(P.objects.get(x).body).some((p) => p.path === "index.tsx"); } catch { return false; } });
        const list = JSON.parse(P.objects.get(key).body);
        const home = list.find((p) => p.path === "index.tsx");
        home.source = home.source.replace("Bread from the harbour, every morning.", "Bread from the harbour, baked overnight.");
        P.objects.set(key, { ...P.objects.get(key), body: JSON.stringify(list), etag: "changed" });
      },
      after: (P) => {
        assert.ok(shown.length >= 1 && !shown[0].includes("Bread from the harbour"), "the rewrite was shown a sibling page's words");
        assert.equal(writerCalls, 1, "a sibling page's words changing made the rewrite ask again");
        assert.ok(P.page("visit.tsx").includes("Open from 8"));
        assert.ok(P.page("index.tsx").includes("baked overnight"), "the sibling's change was lost");
      },
    },
  });
});

// ── THE PAGE TWEAK (2026-10-09, round 3: the recorded gap) ──────────────────

/** The file a page tweak (`write_tweak`) is shown: its prompt carries it after "THE FILE (". */
function shownFile(args) {
  const content = String((args && args.messages && args.messages[0] && args.messages[0].content) || "");
  const at = content.indexOf("\n\nTHE FILE (");
  if (at < 0) return null;
  const rest = content.slice(at + "\n\nTHE FILE (".length);
  const close = rest.indexOf(")\n");
  return { path: rest.slice(0, close), source: rest.slice(close + 2) };
}

test("PATH page tweak — the Visit page's heading made bigger by the TWEAK (the page's words kept, so not the page writer's rewrite) while a stored row's change is being chosen: nothing of the site written before its job, no rewrite ever asked for, and the tweak's answer applied once by the job", async () => {
  const WORDS = "make the heading on the Visit page bigger";
  const BIG = '<h1 className="text-5xl">Come to the bakery</h1>';
  const db = loavesDb();
  const shown = [];
  await overlapCase({
    slug: slugOf("tweak"), db, first: { kind: "data" },
    other: {
      words: WORDS, writes: ["page:/visit"], route: { intent: "edit", layer: "page", page: "/visit" }, marker: T.tweak,
      answers: { [T.tweak]: (args) => { const f = shownFile(args); shown.push(f && f.path); return { source: String(f && f.source).replace("<h1>Come to the bakery</h1>", BIG) }; } },
    },
    check: {
      before: (P) => {
        assert.ok(!P.page("visit.tsx").includes(BIG), "the preparation wrote the page");
        assert.equal(calls(P, T.tweak).length, 1, "the tweak was not made while the other task's job ran");
        assert.equal(calls(P, T.pages).length, 0, "the preparation fell through to the page writer's rewrite");
      },
      after: (P) => {
        assert.ok(P.page("visit.tsx").includes(BIG), "the page was not changed by its job");
        assert.equal((P.page("visit.tsx").match(/text-5xl/g) || []).length, 1, "the tweak was applied twice");
        assert.ok(P.page("visit.tsx").includes("We are on Harbour Street."), "the page's words were not kept");
        assert.equal(calls(P, T.pages).length, 0, "an unintended rewrite was asked for");
        assert.ok(shown.length >= 1 && shown.every((p) => /visit/.test(String(p))), "the tweak was shown another page: " + JSON.stringify(shown));
      },
    },
  });
});

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

test("GN 2 — A NAMED LOOK (the site description, `identity`) prepared while a photograph is placed on the home page: it reads the site's name, page list and its own field, never another page — its lane answered beside the photograph's job, the look stored by its own job", async () => {
  const DESC = "change the site description to say we bake overnight sourdough";
  const NEW_DESC = "Overnight sourdough from a Bristol side street.";
  await overlapCase({
    slug: slugOf("gn2"), first: { kind: "photo", page: "/" },
    other: {
      words: DESC, writes: ["identity"], route: { intent: "edit", layer: "look" }, marker: "lane:description", logged: T.lane,
      answers: { [T.pick]: { fields: ["description"], scopes: [{ part: "description", words: DESC }] }, "lane:description": NEW_DESC },
    },
    check: {
      before: (P) => assert.deepEqual(siteObjectsWith(P, NEW_DESC), [], "the preparation stored the look"),
      after: (P) => assert.ok(siteObjectsWith(P, NEW_DESC).length > 0, "the look was not stored by its job"),
    },
  });
});

test("DISCOVERED — A PART THE FIRST ROUTING NAMED NO TARGETS FOR (the site description, asked beside the home page's photograph): until its own routing names what it touches it is taken to touch the whole site; its routing — run beside the photograph's job — names `identity`, and from then its step is prepared there too, answered beside that job and stored by its own (2026-10-11, the validation round)", async () => {
  const DESC = "change the site description to say we bake overnight sourdough";
  const NEW_DESC = "Overnight sourdough from a Bristol side street.";
  await overlapCase({
    slug: slugOf("disc"), first: { kind: "photo", page: "/" },
    other: {
      words: DESC, writes: null, route: { intent: "edit", layer: "look", targets: [{ change: 0, writes: ["identity"] }] }, marker: "lane:description", logged: T.lane,
      answers: { [T.pick]: { fields: ["description"], scopes: [{ part: "description", words: DESC }] }, "lane:description": NEW_DESC },
    },
    check: {
      before: (P) => assert.deepEqual(siteObjectsWith(P, NEW_DESC), [], "the preparation stored the look"),
      after: (P, rec) => {
        assert.ok(siteObjectsWith(P, NEW_DESC).length > 0, "the look was not stored by its job");
        assert.deepEqual(rec.parts[1].targets && rec.parts[1].targets.writes, ["identity"], "the part did not take the targets its own routing named");
      },
    },
  });
});

test("GN 3 — A NAMED RULES CHANGE (`data:loaves`) prepared while a row of ANOTHER table (hours) is changed: it is shown the loaves table only (hours by name), answered beside that job, and applied by its own job — both tables' changes kept", async () => {
  const WORDS = "let signed-in members add loaves";
  const db = twoTables();
  const shown = [];
  await overlapCase({
    slug: slugOf("gn3"), db, first: { kind: "data", table: "hours" },
    other: {
      words: WORDS, writes: ["data:loaves"], route: { intent: "edit", layer: "rules" }, marker: "write_table_rules",
      answers: { write_table_rules: (args) => { shown.push(String(args.messages[0].content)); return { tables: [{ table: "loaves", write: "members" }] }; } },
    },
    check: {
      after: () => {
        assert.ok(shown.length >= 1);
        const asked = shown[0];
        const stores = asked.slice(0, asked.indexOf("NOT SHOWN"));
        assert.match(stores, /loaves/, "the rules step was not shown its own table");
        assert.ok(!/\bhours\b/.test(stores), "the rules step was shown the other table in full");
        assert.match(asked, /NOT SHOWN[\s\S]*hours/, "the other table was not named as not shown");
        const stored = db.log().filter((e) => /^INSERT INTO _meta \(k,v\) VALUES \('schema'/.test(String(e.query))).pop();
        assert.equal(JSON.parse(stored.params[0]).tables.find((t) => t.name === "loaves").write, "members");
        assert.equal(db.rows("hours")[0].opens, "08:00", "the other table's change was lost");
      },
    },
  });
});

test("GN 3b — A SCOPED RULES CHANGE THAT NEEDS ANOTHER TABLE says `needs`: it is asked again with every table, the second answer is the one applied (both calls billed), and nothing from the first is applied", async () => {
  const WORDS = "let signed-in members add loaves, the way the opening hours work";
  const db = twoTables();
  const shown = [];
  await overlapCase({
    slug: slugOf("gn3b"), db, first: { kind: "data", table: "hours" },
    other: {
      words: WORDS, writes: ["data:loaves"], route: { intent: "edit", layer: "rules" }, marker: "write_table_rules", once: false,
      answers: { write_table_rules: (args) => { const t = String(args.messages[0].content); shown.push(t); return t.includes("NOT SHOWN") ? { needs: true } : { tables: [{ table: "loaves", write: "members" }] }; } },
    },
    check: {
      after: (P) => {
        const asked = calls(P, "write_table_rules").length;
        assert.ok(asked >= 2, "the scoped answer's `needs` was not asked again with every table");
        assert.ok(shown.some((t) => !t.includes("NOT SHOWN") && /hours/.test(t)), "the second call was not shown every table");
        const stored = db.log().filter((e) => /^INSERT INTO _meta \(k,v\) VALUES \('schema'/.test(String(e.query))).pop();
        assert.equal(JSON.parse(stored.params[0]).tables.find((t) => t.name === "loaves").write, "members");
      },
    },
  });
});

test("GN 4 — A NAMED PAGE CHANGE on Visit prepared while a photograph is placed on the HOME page: its tweak is shown the Visit file only, made beside the photograph's job and applied once by its own job", async () => {
  const WORDS = "make the heading on the Visit page bigger";
  const BIG = '<h1 className="text-5xl">Come to the bakery</h1>';
  const shown = [];
  await overlapCase({
    slug: slugOf("gn4"), first: { kind: "photo", page: "/" },
    other: {
      words: WORDS, writes: ["page:/visit"], route: { intent: "edit", layer: "page", page: "/visit" }, marker: T.tweak,
      answers: { [T.tweak]: (args) => { const f = shownFile(args); shown.push(f && f.path); return { source: String(f && f.source).replace("<h1>Come to the bakery</h1>", BIG) }; } },
    },
    check: {
      before: (P) => assert.ok(!P.page("visit.tsx").includes(BIG), "the preparation wrote the page"),
      after: (P) => {
        assert.equal((P.page("visit.tsx").match(/text-5xl/g) || []).length, 1);
        assert.equal(calls(P, T.pages).length, 0);
        assert.ok(shown.every((x) => /visit/.test(String(x))), "the tweak was shown another page: " + JSON.stringify(shown));
      },
    },
  });
});

test("SCHEMA-ONLY — A TABLE ADDED AS STORAGE (the router names only `new-data:signups`, no page) is designed while the home page's photograph is bought: its designer reads the stored tables, never the pages the photograph is written into, so it does not wait for that job; the table made by its own job, once, and no page writer asked (2026-10-11, the validation round)", async () => {
  const db = loavesDb();
  await overlapCase({
    slug: slugOf("schema"), db, first: { kind: "photo", page: "/" },
    other: {
      words: "add a signups table with a name column", writes: ["new-data:signups"], route: { intent: "addon" }, marker: "add:table", logged: T.design,
      answers: { [T.adds]: { kinds: ["table"], scopes: [{ kind: "table", words: "add a signups table with a name column" }] }, "add:table": { table: [{ table: { name: "signups", read: "none", write: "none", columns: [{ name: "name", type: "text" }] }, seed: [] }] } },
    },
    check: {
      before: () => assert.equal(db.log().filter((q) => /create table[^(]*signups/i.test(q.query)).length, 0, "the preparation made the table"),
      after: (P) => {
        assert.equal(db.log().filter((q) => /create table[^(]*signups/i.test(q.query)).length, 1);
        assert.equal(calls(P, T.pages).length, 0, "a page writer was asked for a table nothing shows");
      },
    },
  });
});

// ── ROUND 11: ADDITIONS BESIDE UNRELATED EDITS, NOT ONLY BESIDE A PHOTOGRAPH ──
// The first task is a TEXT edit on the Visit page, its model answer held: it
// writes a page's words, which no new page's design, table, function, API or
// job reads. Each addition below is designed (and, with no page to write,
// finished) while that edit is held; a new page's writer — which copies the
// pages beside it — waits for the edit and is asked once, at its job.

const GALLERY = { [T.adds]: { kinds: ["page"] }, "add:page": { page: [PAGE("/gallery", "Gallery")] }, [T.pages]: { pages: [writtenPage("/gallery")] } };

test("R11 PAGE — A NEW PAGE BESIDE A HELD TEXT EDIT: its picker and designer are answered while the Visit line is being reworded (its preparation is design only); its page writer is asked once, at its job, after the edit applied — and both changes land", async () => {
  await overlapCase({
    slug: slugOf("r11p"), first: { kind: "text" },
    other: { words: "add a gallery page", writes: ["new-page:/gallery", "menu"], route: { intent: "addon" }, marker: "add:page", logged: T.design, answers: GALLERY },
    check: {
      before: (P) => {
        assert.ok(!P.pages().includes("gallery.tsx"), "the preparation added the page");
        assert.equal(calls(P, T.pages).length, 0, "the page writer was asked while the page beside it was still changing");
        assert.equal(calls(P, T.adds).length, 1, "the picker was not answered beside the edit");
      },
      after: (P) => {
        assert.ok(P.pages().includes("gallery.tsx"));
        assert.ok(P.page("visit.tsx").includes(VISIT_TO), "the text edit was lost");
        assert.equal(calls(P, T.adds).length, 1, "the picker was asked again");
        assert.equal(calls(P, T.pages).length, 1, "the page writer was not asked exactly once");
      },
    },
  });
});

test("R11 LABELS — A HEADLINE CHANGED BY AN EARLIER PART does not change the addition's request: the picker and designer still identify the Visit page by what it said when the message was read (\"Come to the bakery\"), never the edit's new words, and are asked once", async () => {
  const NEW_HEAD = "Find the bakery";
  await overlapCase({
    slug: slugOf("r11l"), first: { kind: "text", line: "Come to the bakery", to: NEW_HEAD },
    other: { words: "add a gallery page", writes: ["new-page:/gallery", "menu"], route: { intent: "addon" }, marker: "add:page", logged: T.design, answers: GALLERY },
    check: {
      after: (P) => {
        assert.ok(P.page("visit.tsx").includes(NEW_HEAD), "the heading edit was lost");
        for (const tool of [T.adds, T.design]) {
          const c = calls(P, tool);
          assert.equal(c.length, 1, tool + " was asked again");
          assert.match(c[0].text, /\/visit \("Come to the bakery"\)/, tool + " lost the page's label: identification by content is gone");
          assert.ok(!c[0].text.includes(NEW_HEAD), tool + " was shown the edit's unfinished words");
        }
        assert.ok(!calls(P, T.adds)[0].text.includes("/u/"), "the picker was shown photographs");
      },
    },
  });
});

test("R11 PAGE control — A REAL DEPENDENCY: the same addition declaring that it reads the Visit page waits for the text edit (its designer is not asked while the edit is held), then lands once", async () => {
  await overlapCase({
    slug: slugOf("r11pc"), first: { kind: "text" },
    other: { words: "add a gallery page styled like the Visit page", writes: ["new-page:/gallery", "menu"], reads: ["page:/visit"], route: { intent: "addon" }, marker: "add:page", logged: T.design, waits: true, answers: GALLERY },
    check: { after: (P) => { assert.ok(P.pages().includes("gallery.tsx")); assert.ok(P.page("visit.tsx").includes(VISIT_TO)); } },
  });
});

const FN_COUNT = { name: "count_loaves", internal: true, returns: "void", body: "BEGIN PERFORM 1; END;" };
const madeFn = (db, name) => db.log().filter((q) => new RegExp("create (or replace )?function[^(]*" + name, "i").test(q.query)).length;

test("R11 FUNCTION — A FUNCTION OVER A STORED TABLE beside a held text edit: designed while the Visit line is being reworded, made by its own job once, no page writer asked", async () => {
  const db = loavesDb();
  await overlapCase({
    slug: slugOf("r11f"), db, first: { kind: "text" },
    other: {
      words: "add a function that counts the loaves", writes: ["new-function:count_loaves"], reads: ["data:loaves"], route: { intent: "addon" }, marker: "add:function", logged: T.design,
      answers: { [T.adds]: { kinds: ["function"] }, "add:function": { function: [FN_COUNT] } },
    },
    check: {
      before: () => assert.equal(madeFn(db, "count_loaves"), 0, "the preparation made the function"),
      after: (P) => { assert.equal(madeFn(db, "count_loaves"), 1); assert.equal(calls(P, T.pages).length, 0); assert.ok(P.page("visit.tsx").includes(VISIT_TO)); },
    },
  });
});

test("R11 FUNCTION control — A REAL DEPENDENCY: a function reading the loaves table waits while an earlier part changes a loaf (its designer is not asked while that change is held), then is made once", async () => {
  const db = loavesDb();
  await overlapCase({
    slug: slugOf("r11fc"), db, first: { kind: "data" },
    other: {
      words: "add a function that counts the loaves", writes: ["new-function:count_loaves"], reads: ["data:loaves"], route: { intent: "addon" }, marker: "add:function", logged: T.design, waits: true,
      answers: { [T.adds]: { kinds: ["function"] }, "add:function": { function: [FN_COUNT] } },
    },
    check: { after: () => assert.equal(madeFn(db, "count_loaves"), 1) },
  });
});

test("R11 JOB — A SCHEDULED JOB AND ITS FUNCTION beside a held text edit: both designed while the Visit line is being reworded, registered by their own job once", async () => {
  const db = loavesDb();
  await overlapCase({
    slug: slugOf("r11j"), db, first: { kind: "text" },
    other: {
      words: "count the loaves every night", writes: ["new-function:count_loaves", "new-job:nightly_count"], reads: ["data:loaves"], route: { intent: "addon" }, marker: "add:function", logged: T.design, once: false,
      answers: { [T.adds]: { kinds: ["function", "job"] }, "add:function": { function: [FN_COUNT] }, "add:job": { job: [{ name: "nightly_count", fn: "count_loaves", everyMinutes: 1440 }] } },
    },
    check: {
      after: (P, rec) => {
        assert.equal(madeFn(db, "count_loaves"), 1);
        assert.equal(calls(P, T.design).length, 2, "a designer was asked again");
        assert.equal(calls(P, T.pages).length, 0);
        assert.ok(P.page("visit.tsx").includes(VISIT_TO));
        assert.deepEqual(statuses(rec), ["done", "done"]);
      },
    },
  });
});

test("R11 API — AN OUTSIDE CONNECTION beside a held text edit: designed while the Visit line is being reworded, added by its own job once", async () => {
  const db = loavesDb();
  await overlapCase({
    slug: slugOf("r11a"), db, first: { kind: "text" },
    other: {
      words: "add a connection that fetches our flour supplier's price list", writes: ["new-api:flour_prices"], route: { intent: "addon" }, marker: "add:api", logged: T.design, seqs: ["#1", "#4"],
      answers: { [T.adds]: { kinds: ["api"] }, "add:api": { api: [{ name: "flour_prices", url: "https://example.com/flour.json", method: "GET" }] }, [T.pages]: { pages: [{ path: "src/routes/index.tsx", source: HOME_PIC.replace("</section>", "<p>Today's flour prices, from our supplier.</p></section>") }] } },
    },
    check: {
      // A CONNECTION ALWAYS PUBLISHES, so it reaches the page writer: its
      // preparation stops before the writer while the Visit page is changing,
      // and the writer is asked once, at its job, against the edited page.
      before: (P) => assert.equal(calls(P, T.pages).length, 0, "the page writer was asked while the page beside it was still changing"),
      after: (P) => { assert.equal(calls(P, T.pages).length, 1); assert.ok(calls(P, T.pages)[0].text.includes(VISIT_TO), "the writer was not shown the Visit page as the edit left it"); assert.ok(P.page("visit.tsx").includes(VISIT_TO)); },
    },
  });
});

test("NET — no request in this file left the machine", () => {
  assert.deepEqual(unexpected().filter((u) => u.by === "blocked"), []);
});
