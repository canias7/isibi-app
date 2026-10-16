// CODE AND HELD CHANGES SAVED BEHIND A NEWER DRAFT (2026-10-16, Codex's
// reproduction on `99021708`).
//
// An add-on that makes a page AND a table on a published site saves one draft
// revision carrying both: its code version and its held schema. If another
// task saved a newer draft first, `saveDraftRecord` used to keep the add-on's
// code in the history only and still write a revision of its held schema on
// the NEWER code — and `saveAsDraft` committed and billed the job as done.
// Publish would then have created the table with no page that uses it.
//
//   DMO1  through the real request driver and the real add-on job: the
//         add-on's first save meets a newer draft (another task's, saved
//         between its mint and its save) — it is refused `older`, nothing is
//         written to the draft, it is refunded; the part runs again ALONE, on
//         the newer draft, and is saved as one revision carrying its page and
//         its held schema ONCE; every queue message is delivered twice; then
//         Publish of that revision makes the page live and creates the table
//         exactly once, and a repeated click redoes nothing; the add-on is
//         charged once.
//   DMO2  `mintAfter`: a version always sorts after the draft's, so a re-run
//         minted by a clock behind the other isolate's still wins.
import test from "node:test";
import assert from "node:assert/strict";
import { platform, sendMessage, pump, tick, call, T } from "./fixtures/request-flow.mjs";
import { blockNetwork } from "./fixtures/no-network.mjs";
import { installCompiler } from "./fixtures/cf-containers.mjs";
import { page as pageSrc } from "./fixtures/live-ask.mjs";
import { rowsDb, BAKERY_LOAVES, LOAF_COLUMNS } from "./fixtures/rows-db.mjs";
import { writtenPage } from "./fixtures/addon-route.mjs";
import { DRAFT_KEY, HELD_KEY, DRAFT_SIDECAR_KEY, mintAfter } from "../site-draft.mjs";
import { buildPrefix } from "../site-builds.mjs";

blockNetwork();

const bare = (t) => (t == null ? t : String(t).replace(/\n[ \t]+$/, ""));
const TT_FROM = "Follow us on TikTok at @oldloaf";
const TT_TO = "Follow us on TikTok at @harbourloaf";
const HOME = pageSrc("/", "<section className=\"hero\"><h1>Harbour Loaf</h1></section>");
const VISIT = pageSrc("/visit", "<section className=\"come\"><h1>Come to the bakery</h1><p>" + TT_FROM + "</p></section>");
const LOAVES = { name: "loaves", columns: [{ name: "name", type: "text" }, { name: "description", type: "text" }, { name: "price", type: "numeric" }, { name: "photo", type: "text" }], read: "public", write: "none" };
const ROUTE_TEXT = { intent: "edit", layer: "text", page: "/visit", targets: [{ change: 0, writes: ["page:/visit"] }] };
const SIGNUP = "Add a sign-up page where people leave their name and email address.";
const PAGE = (path, name) => ({ path, name, purpose: "what " + name + " is for", sections: ["a band"], components: ["section-header"] });
const said = (args) => String(args.messages[0].content);
const lineId = (args, file, line) => {
  const at = said(args).split("\n").find((l) => l.includes("[" + file + "] " + line));
  return Number(String(at || "-1.").split(".")[0]);
};

test("DMO1 AN ADD-ON'S PAGE AND HELD TABLE, SAVED BEHIND A NEWER DRAFT — refused `older` with nothing written and refunded; run again alone on the newer draft and saved once with both; every message delivered twice; Publish makes the page live and creates the table once; charged once", async () => {
  const compiler = installCompiler();
  const db = rowsDb({ tables: { loaves: { columns: LOAF_COLUMNS, rows: BAKERY_LOAVES, next: 12 } }, meta: { schema: JSON.stringify({ tables: [LOAVES] }) } });
  let designs = 0;
  const P = platform({
    slug: "dmo-" + Math.random().toString(16).slice(2, 8), pages: [{ path: "index.tsx", source: HOME }, { path: "visit.tsx", source: VISIT }], db, liveScripts: true, balance: 400,
    answers: {
      route: (args) => (/TikTok/.test(said(args)) ? ROUTE_TEXT : { intent: "addon" }),
      [T.text]: (args) => ({ edits: [{ id: lineId(args, "visit.tsx", TT_FROM), to: TT_TO }] }),
      [T.adds]: { kinds: ["table", "page"] },
      "add:table": () => { designs++; return { table: [{ table: { name: "signups", access: "collect", columns: [{ name: "name", type: "text" }, { name: "email", type: "text" }] }, seed: [] }] }; },
      "add:page": { page: [PAGE("/sign-up", "Sign up")] },
      [T.pages]: { pages: [writtenPage("/sign-up")] },
    },
  });
  const drive = async (key) => {
    for (let i = 0; i < 30; i++) {
      // EVERY MESSAGE DELIVERED TWICE: a duplicate delivery must change nothing.
      await pump(P, { twice: true });
      const rec = P.record(key);
      if (rec && (rec.ended || (!P.queue.length && rec.state !== "running"))) return rec;
      if (!P.queue.length) await tick(P);
    }
    return P.record(key);
  };
  const draft = () => { const t = P.readObj(DRAFT_KEY(P.slug)); return t ? JSON.parse(bare(t)) : null; };
  const live = () => { const t = P.readObj("current/" + P.slug + ".json"); return t ? JSON.parse(bare(t)).version : null; };
  const creates = () => db.writes().filter((w) => /create table[^;]*signups/i.test(w.query)).length;
  try {
    // A LIVE SITE (switch off), then the switch on.
    const r0 = await sendMessage(P, { message: "Change our TikTok link on the Visit page to @harbourloaf." });
    await drive(r0.key);
    const v0 = live();
    assert.ok(v0, "the first edit published nothing");
    const side0 = bare(P.readObj("sitemeta/" + P.slug + ".json"));
    P.env.DRAFT_FIRST = "on";

    // ANOTHER TASK'S NEWER DRAFT, saved between the add-on's mint and its
    // save: a real build (the live version's files, under a later version),
    // recorded as the draft — exactly what a save from another isolate leaves.
    let injected = null;
    P.beforePut((k) => k === DRAFT_KEY(P.slug), async (_k, body) => { try {
      const mine = JSON.parse(body);
      const newer = mintAfter(mine.version);
      for (const [key, o] of [...P.objects.entries()]) {
        if (key.startsWith(buildPrefix(P.slug, v0))) await P.bucket.put(buildPrefix(P.slug, newer) + key.slice(buildPrefix(P.slug, v0).length), o.body);
      }
      const rec = { v: 2, version: newer, build: "", base: v0, job: null, at: new Date().toISOString(), history: [], preview: mine.preview, rev: 1, revs: [{ n: 1, version: newer, at: new Date().toISOString(), job: null }], applied: 0, refs: {} };
      await P.bucket.put(DRAFT_KEY(P.slug), JSON.stringify(rec));
      injected = { newer, mine: mine.version, held: (mine.revs || []).filter((r) => r.held).map((r) => r.held) };
    } catch (e) { console.error("the injected draft could not be written", e && e.message); throw e; } });

    const r1 = await sendMessage(P, { message: SIGNUP });
    assert.equal(r1.status, 200, JSON.stringify(r1.body));
    const rec = await drive(r1.key);
    assert.ok(injected, "the add-on never saved a draft — this case tests nothing");
    assert.ok(injected.newer > injected.mine, "the injected draft is not newer");

    const addons = P.jobsOf(r1.key).filter((j) => j.op === "addon");
    assert.equal(addons.length, 2, "the part did not run exactly twice: " + JSON.stringify(addons.map((j) => [j.state, String(j.result && j.result.body).slice(0, 160)])));
    // THE FIRST TRY: refused `older`, refunded, nothing of it in the draft.
    const first = JSON.parse(addons[0].result.body);
    // REFUSED `older` AFTER THE PUBLISH GATE: the review reconcile settles it
    // (never activated, refunded) and keeps the job's own code as `was`.
    assert.ok(first.error === "older" || (first.error === "reconciled" && first.kind === "never-activated" && first.was === "older"), "the first save behind the newer draft was not refused as older: " + JSON.stringify(first).slice(0, 300));
    assert.doesNotMatch(String(first.msg), /restarting/);
    // NOTHING REACHED THE DATABASE, AND IT IS SAID SO: the held schema was
    // never saved, so neither the outcome nor the record claims a table.
    assert.deepEqual(first.outcome, { state: "none", published: false, database: "none" }, "a held schema that was never saved was told as applied: " + JSON.stringify(first.outcome));
    assert.equal(first.migration && first.migration.status, "discarded", "the migration record claims the held schema was applied: " + JSON.stringify(first.migration));
    assert.equal(addons[0].billing, "refunded", "the refused try was not refunded: " + addons[0].billing);
    // THE SECOND TRY: alone, done, charged once.
    assert.equal(rec.parts[0].status, "done", JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
    assert.deepEqual([rec.parts[0].overlapRuns, rec.parts[0].serial], [1, true]);
    assert.equal(addons[1].state, "done");
    const reserved = (id) => P.ledger.filter((e) => e.ref.startsWith(id + "#") && e.reason === "reserve").length;
    assert.ok(reserved(addons[1].id) >= 1, "the second try was not charged");
    const back = P.ledger.filter((e) => e.ref === addons[0].id && e.reason === "refund").reduce((a, e) => a + e.delta, 0);
    const took = P.ledger.filter((e) => e.ref.startsWith(addons[0].id + "#") && e.reason === "reserve").reduce((a, e) => a - e.delta, 0);
    assert.equal(back, took, "the first try was not given back in full: took " + took + ", back " + back);

    // THE DRAFT: the injected newer revision, then ONE revision of the add-on
    // on a version after it, carrying its held schema once.
    const d = draft();
    assert.equal(d.revs.length, 2, "not exactly the newer draft and the add-on's one revision: " + JSON.stringify(d.revs));
    assert.equal(d.revs[0].version, injected.newer);
    assert.ok(!d.revs[0].held, "the add-on's held changes rode the other task's newer revision");
    const mineRev = d.revs[1];
    assert.ok(mineRev.version > injected.newer, "the re-run did not save after the newer draft");
    assert.ok(mineRev.held, "the re-run's held schema was not saved with its code");
    const journal = JSON.parse(bare(P.readObj(HELD_KEY(P.slug, mineRev.held))));
    assert.equal(journal.ops.filter((o) => o.kind === "schema").length, 1, "the held schema is not in the revision exactly once: " + JSON.stringify(journal.ops.map((o) => o.kind)));
    assert.ok(P.page("sign-up.tsx"), "the add-on's page is not in the draft's editable copy");
    // THE PREVIEW'S HEAD IS THE DRAFT'S: its own sidecar written, the live one not.
    assert.ok(P.readObj(DRAFT_SIDECAR_KEY(P.slug)), "the draft's sidecar was not written");
    assert.equal(bare(P.readObj("sitemeta/" + P.slug + ".json")), side0, "the live sidecar changed before Publish");
    // NOTHING LIVE before Publish.
    assert.equal(live(), v0, "the live pointer moved before Publish");
    assert.equal(creates(), 0, "the held table was created before Publish");

    // PUBLISH THE ADD-ON'S REVISION, then again.
    const pub = await call(P, "POST", "/api/site/" + P.slug + "/publish", { revision: mineRev.n, version: mineRev.version });
    assert.equal(pub.status, 200, JSON.stringify(pub.body));
    assert.equal(live(), mineRev.version, "Publish did not make the add-on's revision live");
    assert.equal(P.liveScript(), mineRev.version);
    // THE PUBLICATION APPLIES THE HELD SCHEMA: new tables before the switch,
    // the whole schema after it (both `IF NOT EXISTS`, by design) — from the
    // one revision that carries it, never from a second copy of it.
    assert.ok(creates() >= 1, "Publish did not create the held table");
    const ddl = db.writes().length;
    const again = await call(P, "POST", "/api/site/" + P.slug + "/publish", { revision: mineRev.n, version: mineRev.version });
    assert.deepEqual([again.status, again.body.already], [200, true]);
    assert.equal(db.writes().length, ddl, "a repeated Publish wrote the database again");
    // EXACTLY ONE HELD SCHEMA IN THE DRAFT: no revision but the add-on's carries one.
    const schemaRevs = draft().revs.filter((r) => r.held && JSON.parse(bare(P.readObj(HELD_KEY(P.slug, r.held)))).ops.some((o) => o.kind === "schema"));
    assert.deepEqual(schemaRevs.map((r) => r.n), [mineRev.n], "the held schema is in more than one revision");
    assert.ok(designs >= 2, "the second try did not design afresh");
    await P.settle();
    assert.deepEqual(P.unexpected, [], "requests the stand-ins were not set up for");
  } finally { P.close(); compiler.uninstall(); }
});

test("DMO2 A VERSION SORTS AFTER THE DRAFT'S — minted by a clock an hour behind, `mintAfter` still answers one millisecond past the draft; with no draft or an unreadable one it is the plain clock", () => {
  const draft = "01790600000000-bbbbbb";
  const behind = 1790600000000 - 3_600_000;
  const v = mintAfter(draft, behind, "zzzzzz");
  assert.equal(v, "01790600000001-zzzzzz");
  assert.ok(v > draft);
  assert.equal(mintAfter("", 1790600000000, "aaaaaa"), "01790600000000-aaaaaa");
  assert.equal(mintAfter("not-a-version", 1790600000000, "aaaaaa"), "01790600000000-aaaaaa");
  assert.equal(mintAfter(draft, 1790700000000, "cccccc"), "01790700000000-cccccc", "a clock ahead of the draft keeps its own time");
});
