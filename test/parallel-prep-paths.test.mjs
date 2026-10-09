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
import { installCompiler } from "./fixtures/cf-containers.mjs";
import { writtenPage } from "./fixtures/addon-route.mjs";
import { page as pageSrc } from "./fixtures/live-ask.mjs";
import { rowsDb, BAKERY_LOAVES, LOAF_COLUMNS } from "./fixtures/rows-db.mjs";

const slugOf = (k) => "pp-" + k + "-" + Math.random().toString(16).slice(2, 8);
async function withPlatform(opts, fn) {
  const compiler = installCompiler();
  const P = platform(opts);
  try { return await fn(P); } finally { P.close(); compiler.uninstall(); }
}
const calls = (P, tool) => P.modelLog.filter((m) => m.tool === tool);
/** Every stored object of the site but a request's or a job's records, by its etag. */
const siteEtags = (P) => new Map([...P.objects.entries()].filter(([k]) => !/^(requests|requests-live|jobs)\//.test(k)).map(([k, o]) => [k, o.etag]));
const changedSince = (P, was) => { const now = siteEtags(P); return [...new Set([...now.keys(), ...was.keys()])].filter((k) => now.get(k) !== was.get(k)); };
/** The site's own stored objects holding `text` — not a request's or a job's records, where a preparation keeps its answers. */
const siteObjectsWith = (P, text) => [...P.objects.entries()].filter(([k, o]) => !/^(requests|jobs)\//.test(k) && typeof o.body === "string" && o.body.includes(text)).map(([k]) => k);
const statuses = (rec) => rec.parts.map((p) => p.status);
const reserveOf = (P, jobId) => P.ledger.filter((e) => e.ref.startsWith(jobId + "#") && e.reason === "reserve").map((e) => -e.delta);

const HOME_PIC = pageSrc("/", "<section className=\"hero\"><h1>Harbour Loaf</h1><SafeImage src=\"\" alt=\"A loaf on the counter\" ratio=\"4/3\" /><p>Bread from the harbour, every morning.</p></section>");
const VISIT = pageSrc("/visit", "<section className=\"come\"><h1>Come to the bakery</h1><p>We are on Harbour Street.</p></section>");
const PAGES = [{ path: "index.tsx", source: HOME_PIC }, { path: "visit.tsx", source: VISIT }];
const PHOTO = "make a photo of a sourdough loaf for the home page";
const PICTURE = { pictures: [{ page: "index.tsx", alt: "A loaf on the counter", describe: "a sourdough loaf on a wooden counter" }] };
const PAGE = (path, name) => ({ path, name, purpose: "what " + name + " is for", sections: ["a band"], components: ["section-header"] });

const SPEC = { tables: [{ name: "loaves", columns: [{ name: "name", type: "text" }, { name: "description", type: "text" }, { name: "price", type: "numeric" }, { name: "photo", type: "text" }], read: "public", write: "none" }] };
const loavesDb = () => rowsDb({ tables: { loaves: { columns: LOAF_COLUMNS, rows: BAKERY_LOAVES, next: 12 } }, meta: { schema: JSON.stringify(SPEC) } });
const RYE = "make the Dark Rye £5.50";

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
  const firstRoute = first.kind === "data"
    ? { intent: "edit", layer: "data", alsoAsked: [other.words], targets: [{ change: 0, writes: ["data:" + (first.table || "loaves")] }, { change: 1, writes: other.writes }] }
    : { intent: "edit", layer: "picture", ...(first.page ? { page: first.page } : {}), alsoAsked: [other.words], targets: [{ change: 0, writes: ["images", ...(first.page ? ["page:" + first.page] : [])] }, { change: 1, writes: other.writes }] };
  const answers = { route: [firstRoute, other.route], choose_pictures: PICTURE, ...other.answers };
  const ft = first.table || "loaves";
  if (first.kind === "data") answers.write_row_changes = async () => { await hold(); return { changes: ft === "loaves" ? [{ table: "loaves", id: 2, values: { price: 5.5 } }] : [{ table: ft, id: 1, values: { opens: "08:00" } }] }; };
  const tool = other.marker;
  const orig = answers[tool];
  answers[tool] = async (args, n) => { markerSeen(); return typeof orig === "function" ? orig(args, n) : Array.isArray(orig) ? orig[Math.min(n, orig.length - 1)] : orig; };
  await withPlatform({
    slug, pages: PAGES, images: true, ...(db ? { db } : {}), answers,
    ...(first.kind === "photo" ? { imageWith: hold } : {}),
  }, async (P) => {
    const words = first.kind === "data" ? (first.table === "hours" ? "open the bakery at 8 on Mondays" : RYE) : PHOTO;
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
    const strict = first.kind === "data";
    const before = strict ? siteEtags(P) : null;
    await deliver(P, prep[0]);
    if (strict) assert.deepEqual(changedSince(P, before), [], "the preparation wrote to the site");
    const mid = P.record(r.key).parts[1].prep;
    if (check && check.before) await check.before(P);
    await running;
    assert.equal(opened, true, "the other task's own work was not done while the first task's job was inside its own: " + JSON.stringify(mid));
    assert.equal(mid.outcome, "ready", "the other task's step was not prepared: " + JSON.stringify(mid));
    const { rec } = await settle(P, r.key);
    assert.deepEqual(statuses(rec), ["done", "done"], JSON.stringify(rec.parts.map((p) => [p.status, p.why, p.prep && p.prep.outcome])));
    // THE SUBSTANTIVE CALL ONCE: made by the preparation, answered to the job.
    const logged = other.logged || tool;
    if (other.once !== false) assert.equal(calls(P, logged).length, 1, logged + " was not asked exactly once (the preparation's call, answered to the job)");
    assert.equal(P.imageLog.length, first.kind === "photo" ? 1 : 0);
    for (const j of P.jobsOf(r.key)) assert.ok(reserveOf(P, j.id).length <= 1, j.op + " charged more than once");
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
