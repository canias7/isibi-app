// PARKED (2026-11-03, park-old-way): the old-way half of test/addon-attachments.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
// A LEGACY ADD-ON POST THAT CARRIES ATTACHMENTS, TAKEN ON AS A REQUEST WITH
// ITS FILES (2026-10-09, parallel round 8).
//
// Round 7 took an addition posted straight to `/api/site/<slug>/addon` on as a
// one-part request — except a post with attachments, which stayed a job of its
// own and kept no automatic recovery. Now the post carries its files (as the
// routing call does) and they are kept with the request through the existing
// storage (`storeRequestFiles`), so every job of the request, its questions and
// its later parts have them with no page open. A post that only SAYS files came
// with it (an older page) is taken on with that fact, and the add-on step's
// picker is told the files never arrived: it may ask for them through its own
// question, and an answer that brings them joins the request's files.
//
// Through the REAL Worker (its routes, queue consumer, request driver and
// cron, `test/fixtures/request-flow.mjs`), with the network blocked. Each case
// checks the files, the final page, the statuses, provider calls, publication
// and accounting.
//
// ⚠ SUPPLIED-MODEL, STAND-IN-SERVICE PROOF ONLY.

import test from "node:test";
import assert from "node:assert/strict";
import { platform, sendMessage, settle, tick, pump, call, browserBody, T } from "../../../test/fixtures/request-flow.mjs";
import { installCompiler } from "../../../test/fixtures/cf-containers.mjs";
import { page as pageSrc } from "../../../test/fixtures/live-ask.mjs";
import { blockNetwork, unexpected } from "../../../test/fixtures/no-network.mjs";

blockNetwork();

const slugOf = (k) => "att-" + k + "-" + Math.random().toString(16).slice(2, 8);
const statuses = (rec) => rec.parts.map((p) => p.status);
const reserveOf = (P, jobId) => P.ledger.filter((e) => e.ref.startsWith(jobId + "#") && e.reason === "reserve").map((e) => -e.delta);
const uploads = (P) => [...P.objects.keys()].filter((k) => k.startsWith("uploads/" + P.slug + "/"));
const purchases = (P) => [...P.objects.entries()].filter(([k]) => k.includes("/purchases/")).map(([, o]) => JSON.parse(o.body));
const calls = (P, tool) => P.modelLog.filter((m) => m.tool === tool).length;
const isUpload = (P) => (k) => k.startsWith("uploads/" + P.slug + "/");
const addonJobs = (P, key) => P.jobsOf(key).filter((j) => j.op === "addon");
const key32 = () => [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, "0")).join("");

const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
const PNG_BYTES = 70;
const JPG = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHSEeHx4dGhwcICQuJyAiLCMcHCg3KSwwMTQ0NB8nOT04MjwuMzQy/9k=";
const FILES = [{ name: "shopfront.png", data: PNG }, { name: "bench.jpg", data: JPG }];

const HOME = pageSrc("/", "<section className=\"hero\"><h1>Harbour Loaf</h1><p>Bread from the harbour, every morning.</p></section>");
const VISIT = pageSrc("/visit", "<section className=\"come\"><h1>Come to the bakery</h1><p>The street.</p></section>");
const PAGES = [{ path: "index.tsx", source: HOME }, { path: "visit.tsx", source: VISIT }];
const ADD = "add a gallery page with a photo of the workshop bench, in the style of the pictures I attached";
const BENCH = "the workshop bench under the window, warm afternoon light";
const TOKEN = "@@IMG:" + BENCH + "@@";
const HEAD = "import { createFileRoute } from '@tanstack/react-router'\n"
  + "import { SafeImage } from '@/components/safe-image'\n"
  + "export const Route = createFileRoute('/gallery')({ component: Page })\n";
const GALLERY = HEAD + "function Page(){ return <main><h1>Gallery</h1><SafeImage src={\"" + TOKEN + "\"} alt=\"the workshop bench\" ratio=\"4/3\" /><p>Our work, up close.</p></main> }\n";
const MARK = /"" \/\*pending-photo:([0-9a-f]{24})\*\//;
const PLACED = /<SafeImage src=\{"\/u\/[^"]+\.jpg"\} alt="the workshop bench"/;
const ASK_FILES = { text: "Your pictures didn't come through — could you attach them again?", options: ["I'll attach them", "Go ahead without them"] };
const gallery = (P) => P.page("gallery.tsx") || "";

/** The supplied answers; the picker's every request is kept, to read what it was told. */
const BASE = (picked, o = {}) => ({
  pages: PAGES, images: true, replies: true, balance: 400,
  answers: {
    route: [{ intent: "addon", answered: true }],
    [T.adds]: (args, n) => { picked.push(JSON.stringify(args.messages)); return typeof o.pick === "function" ? o.pick(n) : { kinds: ["page", "photo"] }; },
    "add:page": { page: [{ path: "/gallery", name: "Gallery", purpose: "show our work", sections: ["a photograph"], components: ["card"] }] },
    "add:photo": { photo: [{ page: "/gallery", describe: BENCH, name: "bench" }] },
    [T.pages]: { pages: [{ path: "src/routes/gallery.tsx", source: GALLERY }] },
  },
});

async function withPlatform(opts, fn) {
  const compiler = installCompiler();
  const P = platform(opts);
  try {
    const out = await fn(P);
    await P.settle();
    assert.deepEqual(P.unexpected, [], "requests the stand-ins were not set up for");
    return out;
  } finally { P.close(); compiler.uninstall(); }
}
const post = (P, body) => call(P, "POST", "/api/site/" + P.slug + "/addon", body);

test("AT 1 — A LEGACY ADD-ON WITH ATTACHMENTS IS TAKEN ON WITH ITS FILES: both files are kept with the request, byte for byte, through the request's own storage; the page is closed (nothing more comes from it) and the cron alone drives it; the photograph's store fails, the part is held with the files still kept, and the delayed placement fills the frame — the addition not redone, one purchase, two publishes, charged once", async () => {
  const picked = [];
  await withPlatform({ slug: slugOf("files"), ...BASE(picked) }, async (P) => {
    const idem = key32();
    const a = await post(P, { instruction: ADD, picker: "sonnet", idem, tz: "Europe/London", attached: true, images: FILES });
    assert.equal(a.status, 200, JSON.stringify(a.body));
    assert.equal(a.body.request && a.body.request.key, idem, "not taken on as a request: " + JSON.stringify(a.body));
    const rec0 = P.record(idem);
    assert.equal(rec0.files.length, 2, "the request does not hold both files: " + JSON.stringify(rec0.files));
    assert.deepEqual(rec0.files.map((f) => [f.name, f.type]), [["shopfront.png", "image/png"], ["bench.jpg", "image/jpeg"]]);
    for (const f of rec0.files) assert.ok(P.objects.has(f.key), "a file the record names is not kept: " + f.key);
    assert.equal(P.objects.get(rec0.files[0].key).body.length, PNG_BYTES);
    // THE PAGE IS CLOSED: from here only the queue and the cron.
    for (let i = 0; i < 3; i++) P.failPut(isUpload(P));
    const s1 = await settle(P, idem);
    assert.deepEqual(statuses(s1.rec), ["uncertain"], JSON.stringify(s1.rec.parts.map((p) => [p.status, p.why, p.notDone])));
    assert.equal(s1.rec.parts[0].why, "photos-pending");
    assert.match(gallery(P), MARK);
    // THE FILES ARE STILL KEPT WHILE THE PART WAITS.
    assert.deepEqual(s1.rec.files.map((f) => f.key), rec0.files.map((f) => f.key));
    for (const f of rec0.files) assert.ok(P.objects.has(f.key), "a file went while the part was held");
    // AND THE JOB WAS TOLD THE FILES ARE THERE, never that they are missing.
    const body = P.bodyOf(addonJobs(P, idem)[0].id).body;
    assert.equal(body.attached, true);
    assert.equal(body.filesMissing, undefined);
    assert.ok(!picked.join("").includes("none of the files reached the builder"));
    await tick(P);
    const s2 = await settle(P, idem);
    assert.deepEqual(statuses(s2.rec), ["done"], JSON.stringify(s2.rec.parts.map((p) => [p.status, p.why, p.notDone])));
    assert.match(gallery(P), PLACED);
    assert.equal(P.imageLog.length, 1, "bought again");
    assert.equal(purchases(P).length, 1);
    assert.equal(uploads(P).length, 1);
    assert.equal(calls(P, T.pages), 1, "the addition was written again");
    assert.equal(addonJobs(P, idem).length, 1, "the addition ran again");
    assert.equal(P.jobsOf(idem).filter((j) => j.published_at).length, 2);
    for (const j of P.jobsOf(idem)) assert.ok(reserveOf(P, j.id).length <= 1, "a job charged twice");
  });
});

test("AT 2 — THE SAME POST AGAIN (a lost answer, a second tab): the same request, its files written once — no second copy, no second addition, no second purchase", async () => {
  const picked = [];
  await withPlatform({ slug: slugOf("twice"), ...BASE(picked) }, async (P) => {
    const idem = key32();
    const body = { instruction: ADD, picker: "sonnet", idem, tz: "Europe/London", attached: true, images: FILES };
    await post(P, body);
    const filesBefore = [...P.objects.keys()].filter((k) => k.includes("/files/")).sort();
    assert.equal(filesBefore.length, 2, JSON.stringify(filesBefore));
    const again = await post(P, body);
    assert.equal(again.body.duplicate, true, JSON.stringify(again.body));
    assert.equal(again.body.request.key, idem);
    assert.deepEqual([...P.objects.keys()].filter((k) => k.includes("/files/")).sort(), filesBefore, "the files were written a second time");
    const s = await settle(P, idem);
    assert.deepEqual(statuses(s.rec), ["done"], JSON.stringify(s.rec.parts.map((p) => [p.status, p.why])));
    assert.equal(addonJobs(P, idem).length, 1);
    assert.equal(calls(P, T.pages), 1);
    assert.equal(P.imageLog.length, 1);
  });
});

test("AT 3 — A POST THAT SAYS FILES CAME WITH IT AND CARRIES NONE (an older page): taken on with that fact kept; the picker is told the files never arrived and asks for them through its own question; the part waits on it, the page closed; the answer brings the files, which join the request's; the part resumes with them and is told nothing is missing; the delayed photograph is placed once", async () => {
  const picked = [];
  await withPlatform({ slug: slugOf("ask"), ...BASE(picked, { pick: (n) => (n === 0 ? { question: ASK_FILES } : { kinds: ["page", "photo"] }) }) }, async (P) => {
    const idem = key32();
    const a = await post(P, { instruction: ADD, picker: "sonnet", idem, tz: "Europe/London", attached: true });
    assert.equal(a.body.request && a.body.request.key, idem, JSON.stringify(a.body));
    const rec0 = P.record(idem);
    assert.equal(rec0.attached, true, "the fact that files were sent was lost");
    assert.deepEqual(rec0.files, []);
    const s1 = await settle(P, idem);
    assert.deepEqual(statuses(s1.rec), ["waiting"], JSON.stringify(s1.rec.parts.map((p) => [p.status, p.why])));
    const job1 = P.bodyOf(addonJobs(P, idem)[0].id).body;
    assert.equal(job1.filesMissing, true, "the step was not told the files are missing");
    assert.match(picked[0], /none of the files reached the builder/);
    // THE QUESTION IS THE MODEL'S OWN, ON THE REQUEST'S PART.
    const q = P.question();
    assert.equal(q.status, "pending");
    assert.equal(q.requestKey, idem);
    assert.equal(q.part, 0);
    assert.equal(q.question.text, ASK_FILES.text);
    assert.equal(calls(P, T.pages), 0, "the addition ran before its files were asked for");
    assert.equal(P.imageLog.length, 0);
    // THE ANSWER, WITH THE FILES.
    const ans = await sendMessage(P, { message: "Here they are", ask: { id: q.id, chosen: false }, images: FILES });
    assert.equal(ans.status, 200, JSON.stringify(ans.body));
    assert.deepEqual(ans.body.resumed, { key: idem, part: 0 });
    const rec1 = P.record(idem);
    assert.equal(rec1.files.length, 2, "the answer's files did not join the request: " + JSON.stringify(rec1.files));
    for (const f of rec1.files) assert.ok(P.objects.has(f.key));
    for (let i = 0; i < 3; i++) P.failPut(isUpload(P));
    const s2 = await settle(P, idem);
    assert.deepEqual(statuses(s2.rec), ["uncertain"], JSON.stringify(s2.rec.parts.map((p) => [p.status, p.why])));
    const job2 = P.bodyOf(addonJobs(P, idem)[1].id).body;
    assert.equal(job2.filesMissing, undefined, "the resumed step was told files are missing though the request holds them");
    assert.ok(!picked[1].includes("none of the files reached the builder"));
    for (const f of rec1.files) assert.ok(P.objects.has(f.key), "a file went while the part was held");
    await tick(P);
    const s3 = await settle(P, idem);
    assert.deepEqual(statuses(s3.rec), ["done"], JSON.stringify(s3.rec.parts.map((p) => [p.status, p.why])));
    assert.match(gallery(P), PLACED);
    assert.equal(calls(P, T.pages), 1, "the addition was written twice");
    assert.equal(P.imageLog.length, 1, "bought again");
    assert.equal(purchases(P).length, 1);
  });
});

// ── ROUND 9: EVERY FILE MUST READ, OR NONE IS KEPT AS IF IT WERE ALL ─────────
//
// Codex's reproduction: a valid file beside `data:image/png;base64,AAAAA` was
// taken on as a request holding ONE file — the second matched the data-URL
// pattern, failed to decode, and was skipped by the store without a word.
const BROKEN = { name: "broken.png", data: "data:image/png;base64,AAAAA" };
const filesKept = (P) => [...P.objects.keys()].filter((k) => k.includes("/files/"));
const b64Of = (d) => d.slice(d.indexOf(",") + 1).replace(/\s+/g, "");

test("AT 11 — CLARIFICATION RESUBMISSION: an answer that brings a file that does not read is refused whole before anything runs or is charged — no file joins, the question stays open, the routing model is not asked; the same answer sent again with files that read resumes the part with them, and the delayed photograph is placed once", async () => {
  const picked = [];
  await withPlatform({ slug: slugOf("resubmit"), ...BASE(picked, { pick: (n) => (n === 0 ? { question: ASK_FILES } : { kinds: ["page", "photo"] }) }) }, async (P) => {
    const idem = key32();
    await post(P, { instruction: ADD, picker: "sonnet", idem, tz: "Europe/London", attached: true });
    await settle(P, idem);
    const q = P.question();
    assert.equal(q.requestKey, idem);
    const routes = calls(P, T.route), ledger = P.ledger.length;
    const bad = await sendMessage(P, { message: "Here they are", ask: { id: q.id, chosen: false }, images: [FILES[0], BROKEN] });
    assert.equal(bad.status, 422, JSON.stringify(bad.body));
    assert.equal(bad.body.error, "answer-files-unreadable");
    assert.deepEqual(bad.body.unreadable, ["broken.png"]);
    assert.equal(bad.body.cost, 0);
    assert.equal(P.question().status, "pending", "the question was closed by an answer that was refused");
    assert.deepEqual(P.record(idem).files, [], "a file joined from a refused answer");
    assert.deepEqual(filesKept(P), []);
    assert.equal(calls(P, T.route), routes, "the routing model was asked for a refused answer");
    assert.equal(P.ledger.length, ledger, "something was charged for a refused answer");
    const ok = await sendMessage(P, { message: "Here they are", ask: { id: q.id, chosen: false }, images: FILES });
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    assert.deepEqual(ok.body.resumed, { key: idem, part: 0 });
    assert.equal(P.record(idem).files.length, 2);
    for (let i = 0; i < 3; i++) P.failPut(isUpload(P));
    await settle(P, idem);
    await tick(P);
    const s = await settle(P, idem);
    assert.deepEqual(statuses(s.rec), ["done"], JSON.stringify(s.rec.parts.map((p) => [p.status, p.why])));
    assert.match(gallery(P), PLACED);
    assert.equal(calls(P, T.pages), 1);
    assert.equal(P.imageLog.length, 1);
  });
});

test("AT 12 — THE ROUTER'S OWN ACCEPTANCE KEEPS THE SAME RULE: a message whose file does not read is not taken on as a request that would hold fewer files — it is answered as before, with no request and nothing kept", async () => {
  await withPlatform({ slug: slugOf("routed"), ...BASE([]) }, async (P) => {
    const r = await sendMessage(P, { message: ADD, images: [FILES[0], BROKEN] });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.intent, "addon");
    assert.equal(r.body.request, undefined, "taken on as a request that lost a file");
    // DECLINED, NOT FAILED: answered as before, never the store-failure answer
    // that asks the page to send the message again.
    assert.notEqual(r.body.failed, true, "the acceptance failed instead of declining: " + JSON.stringify(r.body));
    assert.equal(P.record(r.key), null);
    assert.deepEqual(filesKept(P), []);
  });
});
