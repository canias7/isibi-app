// DRAFT-FIRST, THE BASICS (DF1–DF6), on main without the publish-turn work.
// Moved here from help-needed's turn-fence file when draft-first was rebuilt
// on main (2026-10-16): the draft gate on every task's activation, the
// owner's Publish of exactly the approved version, a task running at the
// click, no automatic path publishing, and the isolated preview. Driven
// through the real Worker with the model's answers supplied.
import test from "node:test";
import assert from "node:assert/strict";
import { platform, sendMessage, settle, T, call } from "./fixtures/request-flow.mjs";
import { blockNetwork } from "./fixtures/no-network.mjs";
import { installCompiler } from "./fixtures/cf-containers.mjs";
import { loadWorkerModule } from "./fixtures/worker-harness.mjs";
import { page as pageSrc } from "./fixtures/live-ask.mjs";

blockNetwork();

const slugOf = (k) => "dfb-" + k + "-" + Math.random().toString(16).slice(2, 8);
const lineId = (args, file, line) => {
  const at = String(args.messages[0].content).split("\n").find((l) => l.includes("[" + file + "] " + line));
  return Number(String(at || "-1.").split(".")[0]);
};
const until = async (cond, ms = 6000) => { const end = Date.now() + ms; while (Date.now() < end) { if (cond()) return true; await new Promise((ok) => setTimeout(ok, 10)); } return cond(); };
const editJobs = (P, key) => P.jobsOf(key).filter((j) => j.op === "edit");
const bare = (t) => (t == null ? t : String(t).replace(/\n[ \t]+$/, ""));
const POINTER = (P) => "current/" + P.slug + ".json";
/** Called, synchronously, from inside the named function: the pause lands exactly there. */
const inside = (name) => new Error().stack.includes(name);
const HOME_FROM = "Bread from the harbour, every morning.";
const TT_FROM = "Follow us on TikTok at @oldloaf";
const TT_TO = "Follow us on TikTok at @harbourloaf";
const TT_LATER = "Follow us on TikTok at @harbourloafbakery";
const HOME = pageSrc("/", "<section className=\"hero\"><h1>Harbour Loaf</h1><p>" + HOME_FROM + "</p></section>");
const VISIT = pageSrc("/visit", "<section className=\"come\"><h1>Come to the bakery</h1><p>" + TT_FROM + "</p></section>");
const PAGES2 = [{ path: "index.tsx", source: HOME }, { path: "visit.tsx", source: VISIT }];
const TIKTOK = "Change our TikTok link on the Visit page to @harbourloaf";
const TIKTOK_LATER = "Change our TikTok link on the Visit page to @harbourloafbakery";
const ROUTE_VISIT = { intent: "edit", layer: "text", page: "/visit", targets: [{ change: 0, writes: ["page:/visit"] }] };
async function finish(P, compiler) {
  await P.settle();
  assert.deepEqual(P.unexpected, [], "requests the stand-ins were not set up for");
  P.close(); compiler.uninstall();
}
/** One message, its one job delivered and run to its end. */
async function runOne(P, message) {
  const r = await sendMessage(P, { message });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  await settle(P, r.key, { rounds: 20 });
  return r;
}
async function publishedOnce(P) {
  const r = await runOne(P, TIKTOK + ".");
  const job = editJobs(P, r.key)[0];
  assert.equal(job.state, "done", "the first publish did not land: " + JSON.stringify([job.state, JSON.stringify(job.result || null).slice(0, 300)]));
  assert.ok(P.readObj(POINTER(P)), "no pointer after the first publish");
  return job;
}
function visitSite(slug, extraRoutes = [], answers = {}, opts = {}) {
  const compiler = installCompiler();
  let n = 0;
  const P = platform({
    slug, pages: PAGES2, ...opts,
    answers: {
      route: [ROUTE_VISIT, ...extraRoutes],
      [T.text]: async (args) => ({ edits: [{ id: lineId(args, "visit.tsx", n++ === 0 ? TT_FROM : TT_TO), to: n === 1 ? TT_TO : TT_LATER }] }),
      ...answers,
    },
  });
  return { P, compiler };
}

// ── DRAFT-FIRST PUBLISHING (owner, 2026-10-15): "only an explicit click on
// the Publish button may make changes live." With `DRAFT_FIRST=on` every
// task saves its result as the site's draft — the record, the editable copy,
// a preview under the draft script's own name — and nothing live moves; the
// owner's Publish releases exactly the version they approved.
const DRAFT = (P) => "site-drafts/" + P.slug + ".json";
const draftOf = (P) => { const t = P.readObj(DRAFT(P)); return t ? JSON.parse(bare(t)) : null; };
const liveVersion = (P) => JSON.parse(bare(P.readObj(POINTER(P)))).version;
async function draftSite(name) {
  // EACH CHANGE FROM WHAT THE LAST ONE LEFT: the TikTok line moves back and forth.
  let k = 0;
  const seq = [[TT_FROM, TT_TO], [TT_TO, TT_LATER], [TT_LATER, TT_TO], [TT_TO, TT_LATER]];
  const text = async (args) => { const [from, to] = seq[Math.min(k++, seq.length - 1)]; return { edits: [{ id: lineId(args, "visit.tsx", from), to }] }; };
  const made = visitSite(slugOf(name), [ROUTE_VISIT, ROUTE_VISIT, ROUTE_VISIT], { [T.text]: text }, { liveScripts: true });
  await publishedOnce(made.P);
  made.P.env.DRAFT_FIRST = "on";
  return { ...made, v0: liveVersion(made.P), side0: bare(made.P.readObj("sitemeta/" + made.P.slug + ".json")) };
}

test("DF1 AN EDIT SAVES A DRAFT AND PUBLISHES NOTHING — the change is in the draft, the editable copy and the preview; the pointer, the live script, the sidecar and the live marker are as they were; the job is charged as delivered and says it is not published", async () => {
  const { P, compiler, v0, side0 } = await draftSite("df1");
  try {
    const live0 = P.liveScript();
    const r = await runOne(P, TIKTOK_LATER + ".");
    const job = editJobs(P, r.key)[0];
    assert.equal(job.state, "done", JSON.stringify([job.state, JSON.stringify(job.result || null).slice(0, 300)]));
    const d = draftOf(P);
    assert.ok(d && d.version && d.version !== v0, "no draft was saved: " + JSON.stringify(d));
    assert.equal(liveVersion(P), v0, "an edit moved the pointer under draft-first");
    assert.equal(P.liveScript(), live0, "an edit uploaded the live script under draft-first");
    assert.equal(bare(P.readObj("sitemeta/" + P.slug + ".json")), side0, "an edit wrote the live sidecar under draft-first");
    assert.equal(P.previewScript(), d.version, "the draft's preview script was not uploaded under its own name");
    assert.equal(P.page("visit.tsx").includes(TT_LATER), true, "the editable copy does not hold the draft's change");
    const body = JSON.parse(job.result.body);
    assert.deepEqual([body.checks && body.checks.published, body.checks && body.checks.draft, body.checks && body.checks.version], [false, true, d.version], "the job's answer does not say the change is saved as a draft and not published: " + JSON.stringify(body.checks));
  } finally { await finish(P, compiler); }
});

test("DF2 PUBLISH RELEASES EXACTLY THE APPROVED VERSION — the owner approves draft D1; a later edit saves D2 before the click; Publish D1 makes D1 live (pointer and script), D2 stays the draft, unpublished; a version never saved as a draft is refused", async () => {
  const { P, compiler, v0 } = await draftSite("df2");
  try {
    await runOne(P, TIKTOK_LATER + ".");
    const d1 = draftOf(P).version;
    // THE OWNER LOOKS AT D1 — then another change lands before they click.
    await runOne(P, TIKTOK + ".");
    const d2 = draftOf(P).version;
    assert.notEqual(d2, d1, "the later edit did not save a later draft");
    assert.equal(liveVersion(P), v0);
    const bogus = await call(P, "POST", "/api/site/" + P.slug + "/publish", { version: "01790000000000-zzzzzz" });
    assert.equal(bogus.status, 409, "a version never saved as a draft was published: " + JSON.stringify(bogus.body));
    assert.equal(liveVersion(P), v0);
    const pub = await call(P, "POST", "/api/site/" + P.slug + "/publish", { version: d1 });
    assert.equal(pub.status, 200, JSON.stringify(pub.body));
    assert.equal(liveVersion(P), d1, "Publish did not make the approved version live");
    assert.equal(P.liveScript(), d1, "the live script is not the approved version's");
    assert.equal(draftOf(P).version, d2, "the later draft was lost or published by the click");
    // A STAGED VERSION THAT WAS NEVER SAVED AS A DRAFT (the one published
    // before draft-first) is not publishable through this door.
    const old = await call(P, "POST", "/api/site/" + P.slug + "/publish", { version: v0 });
    assert.equal(old.status, 409, "a staged version never saved as a draft was published: " + JSON.stringify(old.body));
    assert.equal(liveVersion(P), d1);
    assert.equal(pub.body.state.state, "saved", "the later draft is not shown as saved and unpublished: " + JSON.stringify(pub.body.state));
    assert.equal(P.page("visit.tsx").includes(TT_TO) && !P.page("visit.tsx").includes(TT_LATER), true, "Publish rewrote the editable copy, losing the later draft");
    const st = await call(P, "GET", "/api/site/" + P.slug + "/draft");
    assert.deepEqual([st.status, st.body.state, st.body.live, st.body.draft], [200, "saved", d1, d2]);
  } finally { await finish(P, compiler); }
});

test("DF3 A TASK RUNNING AT THE CLICK IS NOT IN THE PUBLICATION — an edit is held before it saves; the owner publishes the current draft meanwhile; the held edit then completes: the live site is the approved version, the held edit's result is the new draft", async () => {
  const { P, compiler, v0 } = await draftSite("df3");
  try {
    await runOne(P, TIKTOK_LATER + ".");
    const d1 = draftOf(P).version;
    let pub = null;
    let during = null;
    P.beforePut((k) => k === DRAFT(P) && inside("saveDraftRecord"), async () => {
      during = await call(P, "GET", "/api/site/" + P.slug + "/draft");
      pub = await call(P, "POST", "/api/site/" + P.slug + "/publish", { version: d1 });
    });
    await runOne(P, TIKTOK + ".");
    assert.ok(pub, "the second edit's draft save was never held");
    assert.equal(during.body.state, "processing", "a running task was not shown as still processing: " + JSON.stringify(during.body));
    assert.equal(pub.status, 200, JSON.stringify(pub.body));
    assert.equal(liveVersion(P), d1, "the publication is not the approved version");
    assert.equal(P.liveScript(), d1);
    const d2 = draftOf(P).version;
    assert.notEqual(d2, d1, "the running edit's result did not become a later draft");
    assert.notEqual(liveVersion(P), d2, "the running edit slipped into the publication");
  } finally { await finish(P, compiler); }
});

test("DF4 NO AUTOMATIC PATH PUBLISHES — under draft-first the editable-state repair keeps the draft's editable copy (never the live version's), and the script alignment publication recovery uses only ever restores the published version", async () => {
  const { P, compiler, v0 } = await draftSite("df4");
  const { draftFirstApi } = await loadWorkerModule();
  try {
    await runOne(P, TIKTOK_LATER + ".");
    const d1 = draftOf(P).version;
    const n = P.uploads().filter((u) => !String(u.name).startsWith("draft-")).length;
    // THE REPAIR: the draft's copy is what the editable copy must match.
    const st = await P.run(() => draftFirstApi.ensureEditableState(P.env, P.slug));
    assert.equal(st.ok, true, JSON.stringify(st));
    assert.equal(P.page("visit.tsx").includes(TT_LATER), true, "the repair put the editable copy back to the live version, erasing the draft");
    // THE ALIGNMENT: it can only follow the pointer — the published version.
    const al = await P.run(() => draftFirstApi.alignScriptToPointer(P.env, P.slug));
    assert.deepEqual([al.aligned, al.version], [true, v0], JSON.stringify(al));
    assert.equal(liveVersion(P), v0);
    assert.equal(P.liveScript(), v0, "an automatic path made the draft live");
    assert.equal(P.uploads().filter((u) => !String(u.name).startsWith("draft-")).length, n, "an automatic path uploaded a live script");
    assert.notEqual(liveVersion(P), d1);
  } finally { await finish(P, compiler); }
});

test("DF5 THE DRAFT'S PREVIEW — its address serves the draft script with the preview header, a wrong token is 404, and a live address never forwards the preview header to a live script", async () => {
  const { P, compiler } = await draftSite("df5");
  try {
    await runOne(P, TIKTOK_LATER + ".");
    const d = draftOf(P);
    assert.match(d.preview, /^[0-9a-f]{12}$/);
    const { default: worker } = await import("../worker.js");
    const get = (host, path, headers = {}) => P.run(() => worker.fetch(new Request("https://" + host + path, { headers }), P.env, { waitUntil() {}, passThroughOnException() {} }));
    const ok = await get(P.slug + "--draft-" + d.preview + ".gofarther.app", "/visit");
    assert.equal(ok.status, 200);
    assert.equal(ok.headers.get("x-robots-tag"), "noindex");
    const last = P.dispatched().at(-1);
    assert.deepEqual([last.name, last.preview], ["draft-" + P.slug, "1"], "the preview did not reach the draft script with its header");
    const bad = await get(P.slug + "--draft-000000000000.gofarther.app", "/visit");
    assert.equal(bad.status, 404, "a wrong preview token was served");
    await get(P.slug + ".gofarther.app", "/visit", { "x-site-preview": "1" });
    const liveHit = P.dispatched().filter((x) => x.name === "site-" + P.slug).at(-1);
    assert.ok(liveHit, "the live address dispatched nothing — the observer is dead");
    assert.equal(liveHit.preview, null, "a visitor's preview header reached the live script");
  } finally { await finish(P, compiler); }
});

test("DF6 EVERY ACTIVATION A TASK REACHES CARRIES THE DRAFT GATE — of the activation call sites, only the owner's Publish (its phased runner, runPublication, called by publishDraft and the recovery sweep alone) and the owner's version restore (restoreVersion) activate without `asDraft`; the edit/add-on publication and the build pass it", async () => {
  const fs = await import("node:fs");
  const src = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const sites = [...src.matchAll(/await activateBuild\(/g)].map((m) => {
    const fn = src.lastIndexOf("\nasync function ", m.index);
    const name = /\nasync function ([A-Za-z0-9_]+)/.exec(src.slice(fn, fn + 80))[1];
    const call = src.slice(m.index, src.indexOf("\n  });", m.index) > 0 ? src.indexOf("});", m.index) : m.index + 400);
    return { name, gated: /asDraft: toDraft \? saveAsDraft : null,/.test(call) };
  });
  assert.equal(sites.length, 4, "the activation call sites moved — rescope this: " + JSON.stringify(sites));
  const ungated = sites.filter((x) => !x.gated).map((x) => x.name).sort();
  assert.deepEqual(ungated, ["restoreVersion", "runPublication"], "an activation a task reaches is not behind the draft gate: " + JSON.stringify(sites));
  // THE RUNNER IS REACHED FROM THE OWNER'S CLICK AND THE SWEEP THAT FINISHES IT, NOTHING ELSE.
  const callers = [...src.matchAll(/await runPublication\(/g)].map((m) => {
    const fn = src.lastIndexOf("\nasync function ", m.index);
    return /\nasync function ([A-Za-z0-9_]+)/.exec(src.slice(fn, fn + 80))[1];
  });
  assert.deepEqual([...new Set(callers)].sort(), ["publishDraft", "runPublishRecovery"], "the publication runner has another caller: " + JSON.stringify(callers));
  for (const x of sites.filter((y) => y.gated)) assert.ok(["recompileAndPublish", "buildAndPublishPages"].includes(x.name), x.name);
});
