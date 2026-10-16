// A REVISION NAMING THIS JOB CONTRADICTS "NEVER STAGED" (2026-10-16, Codex's
// review of `5eca67cb`).
//
// Codex: a text edit stopped right after its draft record landed; that
// revision's manifest removed; recovery ran; the manifest restored; recovery
// ran again. The job ended failed and refunded `never-staged`, its request
// failed and said "Ask again", and restoring the manifest changed nothing —
// while the draft stayed selected and the live site unchanged. The listing
// leaves an ABSENT manifest out (a staging that never finished), so `mine`
// was not found, and `draftVerdict` recognised a code-only revision only
// through `mine`, so the reconcile fell through to `never-staged`.
//
// The contract, one for Build, Edit and Add-on: a durable revision naming
// this job and its version is evidence that it saved. Its version's manifest
// is read on its own: naming this job proves the code; naming another job
// with held changes on the revision proves those through their journal;
// missing or unreadable is cannot-tell — unknown, recoverable, never
// refunded — until it reads. No revision of this job: `never-staged` stands.
//
//   EER1  Codex's reproduction: missing, then restored — unknown and waiting
//         (the request part too), never refunded; restored, kept as a saved
//         draft, billed once, the part done as a draft; Publish makes it live.
//   EER2  thrown reads of that manifest across passes, then a healthy read.
//   EER3  a malformed manifest, then repaired.
//   EER4  an add-on's page and held table, its manifest missing: unknown;
//         restored, kept by revision, manifest and journal; the table only by
//         Publish.
//   EER5  a dependent part waits while its prerequisite is unknown and runs
//         once it is kept — once.
//   EER6  the genuine control: stopped before any revision of this job (an
//         unrelated revision in the draft) — refunded once as never live.
//   EER7  the verdict offline: this job's manifest, another job's with and
//         without held changes, missing, unreadable, and no exact reads.
import test from "node:test";
import assert from "node:assert/strict";
import { platform, sendMessage, pump, tick, call, settle, T } from "./fixtures/request-flow.mjs";
import { blockNetwork } from "./fixtures/no-network.mjs";
import { installCompiler } from "./fixtures/cf-containers.mjs";
import { page as pageSrc } from "./fixtures/live-ask.mjs";
import { rowsDb, BAKERY_LOAVES, LOAF_COLUMNS } from "./fixtures/rows-db.mjs";
import { writtenPage } from "./fixtures/addon-route.mjs";
import { DRAFT_KEY, HELD_KEY } from "../site-draft.mjs";
import { reconcileVerdict } from "../builder/site-reconcile.mjs";

blockNetwork();

const bare = (t) => (t == null ? t : String(t).replace(/\n[ \t]+$/, ""));
const TT_FROM = "Follow us on TikTok at @oldloaf";
const TT_1 = "Follow us on TikTok at @harbourloaf";
const TT_2 = "Follow us on TikTok at @harbourbakes";
const HOME = pageSrc("/", "<section className=\"hero\"><h1>Harbour Loaf</h1></section>");
const VISIT = pageSrc("/visit", "<section className=\"come\"><h1>Come to the bakery</h1><p>" + TT_FROM + "</p></section>");
const LOAVES = { name: "loaves", columns: [{ name: "name", type: "text" }, { name: "description", type: "text" }, { name: "price", type: "numeric" }, { name: "photo", type: "text" }], read: "public", write: "none" };
const ROUTE_TEXT = { intent: "edit", layer: "text", page: "/visit", targets: [{ change: 0, writes: ["page:/visit"] }] };
const said = (args) => String(args.messages[0].content);
const textNext = (args) => {
  const at = said(args).split("\n").find((l) => l.includes("[visit.tsx] ") && l.includes("TikTok"));
  // THE FIRST EDIT PUBLISHES @harbourloaf; LATER ONES ALTERNATE, SO EACH CHANGES THE LINE.
  return { edits: [{ id: Number(String(at || "-1.").split(".")[0]), to: said(args).includes(TT_FROM) || said(args).includes(TT_2) ? TT_1 : TT_2 }] };
};
const MSG = "Change our TikTok link on the Visit page to @harbourbakes.";

async function bakery({ answers = {}, db = null } = {}) {
  const compiler = installCompiler();
  const P = platform({
    slug: "eer-" + Math.random().toString(16).slice(2, 8), pages: [{ path: "index.tsx", source: HOME }, { path: "visit.tsx", source: VISIT }],
    db, liveScripts: true, balance: 400, answers: { route: ROUTE_TEXT, [T.text]: textNext, ...answers },
  });
  const r0 = await sendMessage(P, { message: "Change our TikTok link on the Visit page to @harbourloaf." });
  await settle(P, r0.key, { rounds: 20 });
  const v0 = live(P);
  assert.ok(v0);
  P.env.DRAFT_FIRST = "on";
  return { P, v0, done: async () => { await P.settle(); P.close(); compiler.uninstall(); } };
}
const live = (P) => { const t = P.readObj("current/" + P.slug + ".json"); return t ? JSON.parse(bare(t)).version : null; };
const draftOf = (P) => { const t = P.readObj(DRAFT_KEY(P.slug)); return t ? JSON.parse(bare(t)) : null; };
const manifestKey = (P, v) => "builds/" + P.slug + "/" + v + "/manifest.json";
const refunds = (P, id) => P.ledger.filter((e) => e.ref === id && e.reason === "refund").length;
const bodyOf = (j) => (j && j.result ? JSON.parse(j.result.body) : null);
/** Run to the stop, then hand back the job and its own revision. */
async function stopAfterRecord(P, key, { op = "edit" } = {}) {
  let hung = null;
  for (let i = 0; i < 12 && !hung; i++) { const x = await pump(P); if (x && x.hung) hung = x.hung; }
  assert.match(String(hung), /^put:site-drafts\//, "the job did not stop at its draft record: " + hung);
  const job = P.jobsOf(key).find((j) => j.op === op);
  const mine = draftOf(P).revs.find((x) => x.job === job.id);
  assert.ok(mine, "no revision of the job's own");
  P.recover();
  return { job, mine };
}
/** The cron, past the lease, `n` passes, each read checked. */
async function passes(P, n, each = () => {}) {
  for (let i = 0; i < n; i++) { P.advance(4 * 60 * 1000); await tick(P); await pump(P); each(i); }
}
function waiting(P, key, job, what) {
  const j = P.jobs.get(job.id);
  assert.equal(j.needs_review, true, what + ": the job left review without its evidence (" + j.state + " " + String(j.result && j.result.body).slice(0, 200) + ")");
  assert.equal(refunds(P, job.id), 0, what + ": refunded while its evidence could not be read");
  const rec = P.record(key);
  assert.notEqual(rec.parts[0].status, "failed", what + ": the request part was failed");
  assert.equal(rec.ended, false, what + ": the request ended");
}
function keptSaved(P, key, job, mine, v0) {
  const j = P.jobs.get(job.id);
  const b = bodyOf(j);
  assert.equal(j.state, "done", "not kept: " + j.state + " " + JSON.stringify(b).slice(0, 300));
  assert.equal(b.reconciled, "draft-saved");
  assert.deepEqual([b.draft.published, b.draft.revision, b.draft.version], [false, mine.n, mine.version]);
  assert.equal(j.billing, "finalized");
  assert.equal(refunds(P, job.id), 0);
  const rec = P.record(key);
  assert.equal(rec.parts[0].status, "done", JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
  assert.equal(rec.parts[0].outcome.kind, "draft");
  assert.equal(live(P), v0, "the live site moved without Publish");
}

test("EER1 CODEX'S REPRODUCTION — a text edit stopped right after its draft record, that revision's manifest MISSING: unknown and waiting, never refunded, the request not failed; restored, the next pass keeps it as a saved draft, billed once, the part done as a draft; Publish makes it live", async () => {
  const { P, v0, done } = await bakery();
  try {
    P.hangPut((k) => k === DRAFT_KEY(P.slug));
    const r = await sendMessage(P, { message: MSG });
    const { job, mine } = await stopAfterRecord(P, r.key);
    const good = P.readObj(manifestKey(P, mine.version));
    P.objects.delete(manifestKey(P, mine.version));
    await passes(P, 3);
    waiting(P, r.key, job, "missing");
    assert.equal(draftOf(P).version, mine.version, "the draft is no longer selected");
    P.writeObj(manifestKey(P, mine.version), good);
    await passes(P, 4);
    keptSaved(P, r.key, job, mine, v0);
    assert.equal(P.jobsOf(r.key).filter((j) => j.op === "edit").length, 1, "the edit ran again");
    const pub = await call(P, "POST", "/api/site/" + P.slug + "/publish", { revision: mine.n, version: mine.version });
    assert.equal(pub.status, 200, JSON.stringify(pub.body));
    assert.equal(live(P), mine.version);
  } finally { await done(); }
});

test("EER2/EER3 THROWN READS, THEN A MALFORMED MANIFEST — every pass that cannot read it leaves the job unknown and waiting; once it reads, kept as a saved draft, billed once", async () => {
  for (const kind of ["thrown", "malformed"]) {
    const { P, v0, done } = await bakery();
    try {
      P.hangPut((k) => k === DRAFT_KEY(P.slug));
      const r = await sendMessage(P, { message: MSG });
      const { job, mine } = await stopAfterRecord(P, r.key);
      const key = manifestKey(P, mine.version);
      const good = P.readObj(key);
      // THE STORE'S READS OF IT THROW (switched off below), or what it holds is not a manifest.
      let broken = kind === "thrown";
      const realGet = P.bucket.get.bind(P.bucket);
      P.bucket.get = async (k) => { if (broken && k === key) throw new Error("r2 unavailable"); return realGet(k); };
      if (kind === "malformed") P.writeObj(key, "{not json");
      await passes(P, 3);
      waiting(P, r.key, job, kind);
      // RESTORED.
      broken = false;
      if (kind === "malformed") P.writeObj(key, good);
      await passes(P, 4);
      keptSaved(P, r.key, job, mine, v0);
    } finally { await done(); }
  }
});

test("EER4 HELD CHANGES — an add-on's page and held table stopped after its record, its manifest missing: unknown, the table not created; restored, kept by its revision, its manifest and its journal; the table only by Publish, once", async () => {
  const db = rowsDb({ tables: { loaves: { columns: LOAF_COLUMNS, rows: BAKERY_LOAVES, next: 12 } }, meta: { schema: JSON.stringify({ tables: [LOAVES] }) } });
  const PAGE = { path: "/sign-up", name: "Sign up", purpose: "what Sign up is for", sections: ["a band"], components: ["section-header"] };
  const { P, v0, done } = await bakery({ db, answers: {
    route: (args) => (/sign-up/i.test(said(args)) ? { intent: "addon" } : ROUTE_TEXT),
    [T.adds]: { kinds: ["table", "page"] },
    "add:table": { table: [{ table: { name: "signups", access: "collect", columns: [{ name: "name", type: "text" }, { name: "email", type: "text" }] }, seed: [] }] },
    "add:page": { page: [PAGE] },
    [T.pages]: { pages: [writtenPage("/sign-up")] },
  } });
  const creates = () => db.writes().filter((w) => /create table[^;]*signups/i.test(w.query)).length;
  try {
    P.hangPut((k) => k === DRAFT_KEY(P.slug));
    const r = await sendMessage(P, { message: "Add a sign-up page where people leave their name and email address." });
    const { job, mine } = await stopAfterRecord(P, r.key, { op: "addon" });
    assert.ok(mine.held, "the add-on's revision carries no held change");
    const good = P.readObj(manifestKey(P, mine.version));
    P.objects.delete(manifestKey(P, mine.version));
    await passes(P, 3);
    waiting(P, r.key, job, "held, manifest missing");
    assert.equal(creates(), 0);
    P.writeObj(manifestKey(P, mine.version), good);
    await passes(P, 4);
    keptSaved(P, r.key, job, mine, v0);
    assert.ok(P.readObj(HELD_KEY(P.slug, mine.held)));
    assert.equal(creates(), 0, "the held table was created before Publish");
    const pub = await call(P, "POST", "/api/site/" + P.slug + "/publish", { revision: mine.n, version: mine.version });
    assert.equal(pub.status, 200, JSON.stringify(pub.body));
    assert.ok(creates() >= 1, "Publish did not create the held table");
  } finally { await done(); }
});

test("EER5 A DEPENDENT PART WAITS WHILE ITS PREREQUISITE IS UNKNOWN — no second job is filed while the manifest is missing; restored, the first is kept and the second runs, once", async () => {
  const ADD = "add a gallery page";
  const PAGE = { path: "/gallery", name: "Gallery", purpose: "what Gallery is for", sections: ["a band"], components: ["section-header"] };
  let routed = 0;
  const { P, v0, done } = await bakery({ answers: {
    route: (args) => (/gallery/i.test(said(args)) && routed++ === 0 ? { ...ROUTE_TEXT, alsoAsked: [ADD] } : /gallery/i.test(said(args)) ? { intent: "addon" } : ROUTE_TEXT),
    [T.adds]: { kinds: ["page"] }, "add:page": { page: [PAGE] }, [T.pages]: { pages: [writtenPage("/gallery")] },
  } });
  try {
    P.hangPut((k) => k === DRAFT_KEY(P.slug));
    const r = await sendMessage(P, { message: "Change our TikTok link on the Visit page to @harbourbakes, and " + ADD + "." });
    const { job, mine } = await stopAfterRecord(P, r.key);
    const good = P.readObj(manifestKey(P, mine.version));
    P.objects.delete(manifestKey(P, mine.version));
    await passes(P, 3, () => assert.equal(P.jobsOf(r.key).filter((j) => j.op === "addon").length, 0, "the dependent part ran while its prerequisite was unknown"));
    waiting(P, r.key, job, "dependent");
    P.writeObj(manifestKey(P, mine.version), good);
    await passes(P, 8);
    keptSaved(P, r.key, job, mine, v0);
    const addons = P.jobsOf(r.key).filter((j) => j.op === "addon");
    assert.equal(addons.length, 1, "the dependent part did not run exactly once");
    assert.deepEqual(P.record(r.key).parts.map((p) => p.status), ["done", "done"]);
    assert.equal(live(P), v0);
  } finally { await done(); }
});

test("EER6 THE GENUINE CONTROL — stopped after its publish began and BEFORE any revision of its own (another job's revision in the draft): refunded once as never live (`never-activated` / `never-staged`), the request told to ask again", async () => {
  const { P, v0, done } = await bakery();
  try {
    // ANOTHER JOB'S SAVED REVISION FIRST.
    await settle(P, (await sendMessage(P, { message: MSG })).key, { rounds: 20 });
    assert.ok(draftOf(P) && draftOf(P).revs.length >= 1);
    // THIS JOB: stopped at its preview claim, written just before its record.
    P.hangPut((k) => k.startsWith("preview-claims/" + P.slug + "/"));
    const r = await sendMessage(P, { message: "Change our TikTok link on the Visit page to @harbourloaf." });
    let hung = null;
    for (let i = 0; i < 12 && !hung; i++) { const x = await pump(P); if (x && x.hung) hung = x.hung; }
    assert.ok(hung, "the job never reached its claim");
    const job = P.jobsOf(r.key).find((j) => j.op === "edit");
    assert.equal(draftOf(P).revs.some((x) => x.job === job.id), false, "the control has a revision of its own");
    P.recover();
    await passes(P, 4);
    const j = P.jobs.get(job.id);
    const b = bodyOf(j);
    // NOTHING OF IT SAVED: refunded as never live (its version staged, no revision) — the genuine refusal.
    assert.ok(b && ["never-staged", "never-activated"].includes(b.kind), JSON.stringify(b).slice(0, 300));
    assert.match(String(b.msg), /Ask again/);
    assert.equal(refunds(P, job.id), 1);
    await passes(P, 2);
    assert.equal(refunds(P, job.id), 1, "refunded twice");
    assert.equal(live(P), v0);
  } finally { await done(); }
});

test("EER7 THE VERDICT OFFLINE — this job's manifest proves its code; another job's proves held changes only with their journal; missing or unreadable is unknown; no revision of this job is never-staged; without exact reads, the earlier rule stands", () => {
  const V = "01790000000001-aaaaaa";
  const rev = (extra = {}) => ({ n: 3, version: V, at: "x", job: "job-a", ...extra });
  const base = (revs, manifests, journals = {}) => ({ job: { id: "job-a" }, pointer: null, live: null, builds: [], buildsUnread: [], mine: null, draft: { state: "read", record: { version: V, rev: 3, revs } }, manifests, journals });
  const read = (job) => ({ state: "read", manifest: { job, files: ["x"] } });
  assert.deepEqual([reconcileVerdict(base([rev()], { [V]: read("job-a") })).verdict, reconcileVerdict(base([rev()], { [V]: read("job-a") })).kind], ["kept", "draft-saved"]);
  assert.equal(reconcileVerdict(base([rev()], { [V]: { state: "absent" } })).kind, "draft-manifest-unread");
  assert.equal(reconcileVerdict(base([rev()], { [V]: { state: "unreadable", why: "read-failed" } })).kind, "draft-manifest-unread");
  assert.equal(reconcileVerdict(base([rev()], { [V]: read("job-b") })).kind, "never-staged", "another job's version proved this job's code");
  assert.equal(reconcileVerdict(base([rev({ held: "h1" })], { [V]: read("job-b") }, { h1: true })).kind, "draft-saved", "a held-only seal on another job's version");
  assert.equal(reconcileVerdict(base([rev({ held: "h1" })], { [V]: read("job-b") }, { h1: undefined })).kind, "draft-held-unreadable");
  assert.equal(reconcileVerdict(base([{ ...rev(), job: "job-b" }], { })).kind, "never-staged", "an unrelated revision is not this job's");
  assert.equal(reconcileVerdict(base([], {})).kind, "never-staged");
  assert.equal(reconcileVerdict({ ...base([rev({ held: "h1" })], undefined, { h1: true }), manifests: undefined }).kind, "draft-saved", "the earlier rule without exact reads");
});
