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

// ── EER8: A DRAFT WHOSE PUBLISHED REVISIONS WERE TRIMMED (2026-10-16) ────────
// Only published revisions are trimmed now (no count limit on unpublished
// work), and the record says when (`trimmed`). A lost job that began after the
// trimmed revisions were saved left nothing trimmed, so its absence is proof
// and the genuine refusal stands; one that began before may have been
// dropped, so it is cannot-tell and waits — never refunded on that absence.
for (const [name, began] of [["after", "began after the trimming: refunded once as never live"], ["before", "began before the trimming: cannot-tell, waiting, not refunded"]]) {
  test("EER8 " + name.toUpperCase() + " — a lost job beside a draft whose published revisions were trimmed, " + began, async () => {
    const { P, v0, done } = await bakery();
    try {
      await settle(P, (await sendMessage(P, { message: MSG })).key, { rounds: 20 });
      // THE RECORD AS RETENTION LEAVES IT after many publications: its earliest
      // revisions trimmed, the trimming's time recorded.
      const d = draftOf(P);
      const shift = 30;
      const at = name === "after" ? "2026-01-01T00:00:00.000Z" : new Date(Date.now() + 24 * 3600 * 1000).toISOString();
      const rec = { ...d, rev: d.rev + shift, applied: d.applied + shift, revs: d.revs.map((r) => ({ ...r, n: r.n + shift })), trimmed: { n: shift, at } };
      await P.run(() => P.bucket.put(DRAFT_KEY(P.slug), JSON.stringify(rec)));
      P.hangPut((k) => k.startsWith("preview-claims/" + P.slug + "/"));
      const r = await sendMessage(P, { message: "Change our TikTok link on the Visit page to @harbourloaf." });
      let hung = null;
      for (let i = 0; i < 12 && !hung; i++) { const x = await pump(P); if (x && x.hung) hung = x.hung; }
      assert.ok(hung, "the job never reached its claim");
      const job = P.jobsOf(r.key).find((j) => j.op === "edit");
      assert.equal(draftOf(P).revs.some((x) => x.job === job.id), false, "the case has a revision of its own");
      P.recover();
      await passes(P, 4);
      const b = bodyOf(P.jobs.get(job.id));
      if (name === "after") {
        assert.ok(b && ["never-staged", "never-activated"].includes(b.kind), "a job that began after the trimming was not refused on its absence: " + JSON.stringify(b).slice(0, 300));
        assert.equal(refunds(P, job.id), 1);
      } else {
        assert.equal(refunds(P, job.id), 0, "a job whose revision may have been trimmed was refunded");
        assert.ok(!b || !["never-staged", "never-activated"].includes(b.kind), "absence from a trimmed list was taken as proof: " + JSON.stringify(b).slice(0, 300));
      }
      assert.equal(live(P), v0);
    } finally { await done(); }
  });
}
