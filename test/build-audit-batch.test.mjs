// THE FIRST-BUILD AUDIT'S CORRECTION BATCH (2026-10-08): H1–H6, M7, L10, M1.
//
// Each finding is reproduced through the route or the shared execution
// boundary it lives on, with supplied model answers and controlled failures —
// no paid call, no container, no live data. The audit is
// docs/investigations/first-build-audit-2026-10-08.md; the record of this
// round is docs/history/2026-10-08-build-batch.md.
//
// What each group drives:
//   H4  POST /api/site/react-build with a design answer that has no tool call,
//       or one with no pages, against a valid frontend-only design
//   H3  the same route with attachments and a design that leaves `images` out
//   H6  the same route with a design that names an attached file
//   L10 the same route with a deposit whose answer is lost
//   H2  `buildLedger` (exported) and the queue consumer with an expired token
//   H1  `reconcileLostBuilds` (exported) over a lost row, three published states
//   H5  `/api/site/<slug>/text` against a marker behind the pointer, and the
//       version store's kit
//   M7  the resumed collector on a refire, with the files kept beside the record
//   M1  the salvage gate and the citation reader over the container's forms

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { driveBuild, GOOD_DESIGN, BRIEF, JPEG_DATA, BUILD_USER, buildBucket } from "./fixtures/build-route.mjs";
import { loadWorker, loadWorkerModule, makeCtx } from "./fixtures/worker-harness.mjs";
import { designUsable } from "../builder/site-plan.mjs";
import { imageBrief, imageDirective, planBudget } from "../builder/site-images.mjs";
import { mergeLook } from "../builder/site-edit.mjs";
import { placeAttachedPhotos, ownPhotoSentence, attachedFilesNote, resolveAttached } from "../builder/attached-photos.mjs";
import { attachments } from "../builder/site-context.mjs";
import { lostBuildVerdict, LOST_SITE_MSG } from "../builder/build-lease.mjs";
import { packResume, resumeKey, attachmentsKey, genKey, RESUME_KIND } from "../builder/build-resume.mjs";
import { resultKey, jobKey, packJob, JOB_KIND } from "../builder/build-job.mjs";
import { errorCitations, salvageable, salvagePlan } from "../builder/publish-pages.mjs";
import { sbDecision, SB_MARKER, BUILD_STEP_REFS } from "../builder/job-gateway.mjs";
import { stageBuild, readBuild, repairEditable, writeHead, readHead } from "../site-builds.mjs";

const W = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
const body = (extra = {}) => ({ brief: BRIEF, images: [], qa: [], chat: "c", ...extra });
const refs = (seen, fn) => seen.rpc.filter((x) => x.fn === fn).map((x) => String(x.args.p_ref || "").split(":").pop() + "/" + x.args.p_reason);

// ── H4: missing or unusable design output ───────────────────────────────────

test("H4: a design call that made no tool call refuses before anything else runs, and the deposit comes back", async () => {
  const r = await driveBuild({ design: { stop: "end_turn", text: "Here is a design for your bakery..." }, body: body() });
  assert.equal(r.status, 503, JSON.stringify(r.reply).slice(0, 300));
  assert.equal(r.reply.stage, "design");
  assert.deepEqual(r.reply.unusable, ["design"]);
  assert.match(r.reply.msg, /didn't send back a usable plan/);
  assert.deepEqual(refs(r.seen, "credit_debit"), ["deposit/debit"], "something other than the deposit was charged");
  assert.deepEqual(refs(r.seen, "credit_reverse"), ["deposit/design"], "the deposit was not given back");
  assert.deepEqual(r.seen.tools, ["design_schema"], "a model call ran after an unusable design");
  assert.equal(r.config, null, "a look was stored from an unusable design");
  assert.equal(r.seen.neon, 0, "a database was provisioned for an unusable design");
});

test("H4: …and so does a design with no page or no purpose, naming what was missing", async () => {
  const { pages: _p, purpose: _q, ...partial } = GOOD_DESIGN;
  const r = await driveBuild({ design: { input: partial }, body: body() });
  assert.equal(r.status, 503);
  assert.deepEqual(r.reply.unusable, ["purpose", "pages"]);
  assert.deepEqual(refs(r.seen, "credit_reverse"), ["deposit/design"]);
});

test("H4 control: a valid frontend-only design with no tables still builds — no tables is not no design", async () => {
  const r = await driveBuild({ design: { input: GOOD_DESIGN }, body: body() });
  assert.equal(r.reply.slug, "harbour-loaf", JSON.stringify(r.reply).slice(0, 300));
  assert.notEqual(r.reply.stage, "design");
  assert.ok(r.config && r.config.look && r.config.look.brand === "Harbour Loaf", "the valid design's look was not stored");
  assert.equal(r.seen.neon, 0, "a frontend-only design was given a database");
});

test("H4: designUsable judges the answer, not the database", () => {
  assert.deepEqual(designUsable(null), { ok: false, missing: ["design"] });
  assert.deepEqual(designUsable([]), { ok: false, missing: ["design"] });
  assert.equal(designUsable(GOOD_DESIGN).ok, true);
  assert.equal(designUsable({ ...GOOD_DESIGN, tables: [] }).ok, true);
  assert.deepEqual(designUsable({ slug: "x", purpose: "p", pages: [{ name: "Home" }] }).missing, ["pages"], "a page with no path counted");
  assert.deepEqual(designUsable({ purpose: "p", pages: [{ path: "/" }] }).missing, ["brand"]);
});

// ── H3: attachments are not a photograph plan ──────────────────────────────

test("H3: a design that leaves `images` out no longer stores the attachments as the look's photograph plan", async () => {
  const { images: _i, ...noImages } = GOOD_DESIGN;
  const r = await driveBuild({ design: { input: noImages }, body: body({ images: [{ name: "shop.jpg", data: JPEG_DATA }] }) });
  assert.ok(r.config, "no look was stored");
  assert.equal(r.config.look.images, null, "the browser's attachments were stored as look.images: " + JSON.stringify(r.config.look.images).slice(0, 120));
  assert.doesNotMatch(JSON.stringify(r.config), /data:image/, "a data url reached the site's config");
});

test("H3: …and the browser's empty attachment list is not \"this site has no photographs\"", async () => {
  const { images: _i, ...noImages } = GOOD_DESIGN;
  const r = await driveBuild({ design: { input: noImages }, body: body({ images: [] }) });
  assert.equal(r.config.look.images, null, "an empty attachment list zeroed the photo plan");
  assert.equal(planBudget({ pages: [{ path: "/" }], images: r.config.look.images }), 1, "the ordinary rule no longer applies");
});

test("H3: mergeLook never reads `images` from a body, on any caller", () => {
  assert.equal(mergeLook({}, {}, { images: [{ name: "a.png", data: "data:..." }] }).images, null);
  assert.equal(mergeLook({}, {}, { images: [] }).images, null);
  assert.deepEqual(mergeLook({}, { images: [] }, { images: [{ name: "a" }] }).images, [], "the designer's own empty answer stopped counting");
  assert.equal(mergeLook({}, {}, { brand: "From body" }).brand, "From body", "the body fallback stopped working for a real look field");
});

// ── H6: requested customer photos get durable references ───────────────────

test("H6: a photograph the designer ties to an attached file's id is stored as an owner upload, and the plan points at it", async () => {
  const design = { ...GOOD_DESIGN, images: [{ page: "/", describe: "the shop front", attached: "attachment-1" }, { page: "/", describe: "a loaf at dawn" }] };
  const r = await driveBuild({ design: { input: design }, body: body({ brief: BRIEF + " Put my photo of the shop on the home page.", images: [{ name: "shop.jpg", data: JPEG_DATA }] }) });
  const uploads = [...r.store.keys()].filter((k) => k.startsWith("uploads/harbour-loaf/"));
  assert.equal(uploads.length, 1, "the attached photograph was not stored: " + [...r.store.keys()].join(","));
  assert.match(uploads[0], /^uploads\/harbour-loaf\/[0-9a-f]{32}\.jpg$/);
  const own = r.config.look.images[0];
  assert.equal(own.src, "/u/harbour-loaf/" + uploads[0].split("/").pop(), "the plan does not point at the stored file");
  assert.equal(own.attached, "attachment-1", "the stored plan names the file by something other than its id");
  assert.equal(r.config.look.images[1].src, undefined, "a drawn photograph was given a src");
  assert.deepEqual(r.reply.ownPhotos.placed.map((p) => [p.id, p.name]), [["attachment-1", "shop.jpg"]]);
  assert.match(r.seen.designer[0], /THE FILES THE CUSTOMER ATTACHED[\s\S]*attachment-1 — \\"shop\.jpg\\"[\s\S]*REFERENCE unless/, "the designer was not told the files by id");
});

test("H6: an id that matches no attached image is told, never bought and never stored", async () => {
  const design = { ...GOOD_DESIGN, images: [{ page: "/", describe: "x", attached: "attachment-7" }] };
  const r = await driveBuild({ design: { input: design }, body: body({ images: [{ name: "shop.jpg", data: JPEG_DATA }] }) });
  assert.equal([...r.store.keys()].filter((k) => k.startsWith("uploads/")).length, 0);
  assert.deepEqual(r.config.look.images, [], "the unmatched entry was kept as a photograph to buy");
  assert.equal(r.reply.ownPhotos.missing[0].ref, "attachment-7");
  assert.match(r.reply.contextNote, /couldn't put attachment-7 on \/: no attached file has that id/);
});

test("H6: an attached image the designer did not name is reference — nothing is stored", async () => {
  const r = await driveBuild({ design: { input: GOOD_DESIGN }, body: body({ images: [{ name: "inspo.jpg", data: JPEG_DATA }] }) });
  assert.equal([...r.store.keys()].filter((k) => k.startsWith("uploads/")).length, 0, "a reference image was published as material");
  assert.equal(r.reply.ownPhotos, undefined);
});

test("H6: the writer is handed the stored src to copy, the budget buys only the drawn pictures, and the reply follows the outcome", () => {
  const list = [{ page: "/", describe: "the shop front", src: "/u/harbour-loaf/0123456789abcdef0123456789abcdef.jpg" }, { page: "/", describe: "a loaf at dawn" }];
  assert.equal(planBudget({ pages: [{ path: "/" }], images: list }), 1, "the customer's own photograph was counted as a purchase");
  const zero = imageDirective(imageBrief({ images: list }, 0));
  assert.match(zero, /<SafeImage src="\/u\/harbour-loaf\/0123456789abcdef0123456789abcdef\.jpg" alt="the shop front" \/>/, "a zero budget dropped the customer's own photograph");
  assert.doesNotMatch(zero, /none on this site/, "the zero form contradicted the photograph above it");
  const one = imageDirective(imageBrief({ images: list }, 1));
  assert.match(one, /src="\/u\/harbour-loaf\//);
  assert.match(one, /@@IMG:a loaf at dawn@@/);
  const facts = { placed: [{ name: "shop.jpg", page: "/" }], missing: [] };
  assert.match(ownPhotoSentence(facts, { state: "published" }), /stored with the site/);
  assert.match(ownPhotoSentence(facts, { state: "stopped" }), /didn't finish/);
  assert.doesNotMatch(ownPhotoSentence(facts, { state: "stopped" }), /went on the site/);
});

test("H6: placeAttachedPhotos stores each named file once and keeps every other entry as it was", async () => {
  const stored = [];
  const files = [{ name: "a.jpg", data: JPEG_DATA }];
  const { named } = attachments(files);
  const r = await placeAttachedPhotos(
    [{ page: "/", describe: "a", attached: "attachment-1" }, { page: "/b", describe: "b", attached: "attachment-1" }, { page: "/", describe: "drawn" }, { page: "/", describe: "kept", attached: "attachment-1", src: "/u/s/0123456789abcdef0123456789abcdef.jpg" }],
    files,
    async (name) => { stored.push(name); return { url: "/u/s/ffffffffffffffffffffffffffffffff.jpg" }; },
    { named },
  );
  assert.deepEqual(stored, ["a.jpg"], "one file was stored twice");
  assert.equal(r.images.length, 4);
  assert.equal(r.images[2].src, undefined);
  assert.equal(r.images[3].src, "/u/s/0123456789abcdef0123456789abcdef.jpg", "an earlier build's src was replaced");
  assert.deepEqual(attachments([{ name: "m.pdf", data: "data:application/pdf;base64,AAAA" }, { name: "t.txt", text: "hi" }]).named.map((f) => [f.id, f.kind]), [["attachment-1", "document"], ["attachment-2", "text"]]);
});

// ── N1: attachment identity (Codex's review of b4300a07) ───────────────────

// Two JPEGs whose bytes differ, so a test can tell which one was stored.
const JPEG_A = JPEG_DATA;
const JPEG_B = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD" + "B".repeat(64);
const LONG = "the-front-of-our-bakery-on-a-sunny-morning-in-early-spring-with-the-door-open-and-loaves".padEnd(84, "x");

async function placeBy(files, ref) {
  const { named } = attachments(files);
  const got = [];
  const r = await placeAttachedPhotos([{ page: "/", describe: "p", attached: ref }], files, async (name, bytes) => { got.push({ name, bytes: Array.from(bytes) }); return { url: "/u/s/" + String(got.length).padStart(32, "0") + ".jpg" }; }, { named });
  return { named, got, r };
}
const bytesOf = (data) => Array.from(atob(data.split(",")[1]), (c) => c.charCodeAt(0));

test("N1: two uploads sharing an 80-character prefix are two ids, each kept in full, and the second id stores the second file's bytes", async () => {
  const files = [{ name: LONG + "-1.jpg", data: JPEG_A }, { name: LONG + "-2.jpg", data: JPEG_B }];
  const { named, got, r } = await placeBy(files, "attachment-2");
  assert.deepEqual(named.map((f) => f.name), [LONG + "-1.jpg", LONG + "-2.jpg"], "a name was cut, so two files could read as one");
  assert.notEqual(named[0].name, named[1].name);
  assert.equal(got.length, 1);
  assert.deepEqual(got[0].bytes, bytesOf(JPEG_B), "the second id stored the first file's bytes");
  assert.equal(got[0].name, LONG + "-2.jpg", "the original name was not kept for display");
  assert.equal(r.images[0].attached, "attachment-2");
  assert.match(attachedFilesNote(named), new RegExp("attachment-2 — \"" + LONG + "-2\\.jpg\""));
});

test("N1: two uploads with the same name are told apart by id, and the shared name alone is refused, never guessed", async () => {
  const files = [{ name: "photo.jpg", data: JPEG_A }, { name: "photo.jpg", data: JPEG_B }];
  const second = await placeBy(files, "attachment-2");
  assert.deepEqual(second.got[0].bytes, bytesOf(JPEG_B));
  const first = await placeBy(files, "attachment-1");
  assert.deepEqual(first.got[0].bytes, bytesOf(JPEG_A));
  const byName = await placeBy(files, "photo.jpg");
  assert.equal(byName.got.length, 0, "an ambiguous name stored a file");
  assert.equal(byName.r.missing[0].reason, "more than one attached file has that name");
  assert.deepEqual(resolveAttached("photo.jp", attachments(files).named).ok, false, "a prefix resolved");
});

test("N1: a file the attachment reader refuses keeps its position, so the ids after it still name their own files", async () => {
  const huge = "data:image/jpeg;base64," + "A".repeat(8 * 1024 * 1024);
  const files = [{ name: "too-big.jpg", data: huge }, { name: "shop.jpg", data: JPEG_B }];
  const { named, got } = await placeBy(files, "attachment-2");
  assert.deepEqual(named.map((f) => f.id), ["attachment-2"], "a refused file was handed to the model");
  assert.deepEqual(got[0].bytes, bytesOf(JPEG_B));
  const none = await placeBy(files, "attachment-1");
  assert.equal(none.got.length, 0, "the refused file's id stored another file");
});

test("N1: a resumed build reads the ids it planned with from the files kept beside its record", () => {
  const blank = (s) => s.split("\n").map((l) => (/^\s*\/\//.test(l) ? "" : l)).join("\n");
  const code = blank(W);
  assert.match(code, /JSON\.stringify\(\{ v: 2, blocks: held, named: Array\.isArray\(buildArgs && buildArgs\.attachmentIds\) \? buildArgs\.attachmentIds : \[\] \}\)/, "the resume store no longer keeps the ids beside the files");
  assert.match(code, /attachmentIds: attached\.named/, "the build does not carry its ids");
  assert.match(code, /attachedFilesNote\(attached\.named\)/, "the designer is not told the ids");
  assert.match(code, /\{ named: attached\.named \}/, "placement does not resolve by the ids the designer was told");
});

// ── L10: debits whose answer was lost ──────────────────────────────────────

test("L10: a deposit whose answer was lost is reversed by ref, whatever happened to it", async () => {
  const r = await driveBuild({ design: { input: GOOD_DESIGN }, body: body(), ledger: { credit_debit: () => new Response("upstream timeout", { status: 500 }) } });
  assert.equal(r.status, 503);
  assert.deepEqual(refs(r.seen, "credit_reverse"), ["deposit/unanswered", "settle/unanswered", "pages/unanswered"],
    "a deposit that may have landed was left on the ledger");
  assert.deepEqual(r.seen.tools, [], "the design ran without a deposit");
});

test("L10: a settlement whose answer was lost is given back by a later refusal, and a failed reversal reads as short", async () => {
  // A design with a table, so the build provisions — and the Neon API is
  // down, so it refuses after the settlement. Usage large enough to settle.
  const design = { ...GOOD_DESIGN, backend: { tables: [{ name: "orders", access: "collect", columns: [{ name: "name", type: "text" }] }], seed: {} } };
  let debits = 0;
  const r = await driveBuild({
    design: { input: design }, body: body(), usage: { input_tokens: 400_000, output_tokens: 60_000 },
    ledger: {
      credit_debit: (a) => (++debits === 1 ? { ok: true, exempt: false, taken: Number(a.p_amount), balance: 500, repeat: false } : new Response("lost", { status: 500 })),
      credit_reverse: (a) => (String(a.p_ref).endsWith(":settle") ? new Response("down", { status: 500 }) : { ok: true, refunded: Number(a.p_amount) > 1000 ? 0 : Number(a.p_amount), already: 0, debited: 2, repeat: false }),
    },
  });
  assert.ok(debits >= 2, "the settlement was never attempted: " + JSON.stringify(r.reply).slice(0, 200));
  assert.ok(refs(r.seen, "credit_reverse").includes("settle/refund"), "the lost settlement was never reversed: " + refs(r.seen, "credit_reverse").join(","));
  assert.equal(r.reply.refundShort, true, "a reversal that could not be made was reported as nothing owed");
});

// ── H2: background billing without the customer's expiring token ───────────

function stubRpc(answers, seen) {
  const real = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const u = String((input && input.url) || input || "");
    const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
    const h = Object.fromEntries(Object.entries((init && init.headers) || {}).map(([k, v]) => [k.toLowerCase(), v]));
    const m = u.match(/\/rest\/v1\/rpc\/(\w+)/);
    if (m) {
      let args = {};
      try { args = JSON.parse(String((init && init.body) || "{}")); } catch { args = {}; }
      seen.push({ fn: m[1], args, auth: h.authorization || "" });
      const a = answers[m[1]];
      if (a === undefined) return json({ message: "no function" }, 404);
      return a instanceof Response ? a : json(typeof a === "function" ? a(args) : a);
    }
    if (answers.__rest) return answers.__rest(u, init) || json([]);
    return json([]);
  };
  return () => { globalThis.fetch = real; };
}

test("H2: when the ledger refuses an expired bearer, a build with its job identity debits through the service-role build_debit", async () => {
  const { buildLedger } = await loadWorkerModule();
  const seen = [];
  const restore = stubRpc({ credit_debit: new Response(JSON.stringify({ message: "JWT expired" }), { status: 401 }), build_debit: { ok: true, exempt: false, taken: 3, balance: 9, repeat: false } }, seen);
  try {
    const l = buildLedger({ SUPABASE_SERVICE_KEY: "svc", CREDITS_MINT_SECRET: "mint" }, { auth: "Bearer expired", uid: BUILD_USER.id, jobId: "a1b2c3d4e5f60718293a4b5c6d7e8f90" });
    assert.equal(l.trusted, true);
    const d = await l.debit(3, "build:a1b2c3d4e5f60718293a4b5c6d7e8f90:settle", "debit", true);
    assert.equal(d.taken, 3);
    // A QUEUED BUILD ASKS build_debit FIRST, whatever its token (2026-10-08,
    // the transactional protocol); the expired bearer is never presented.
    assert.deepEqual(seen.map((x) => x.fn), ["build_debit"]);
    const bd = seen[0];
    assert.equal(bd.args.p_uid, BUILD_USER.id);
    assert.equal(bd.args.p_id, "a1b2c3d4e5f60718293a4b5c6d7e8f90");
    assert.equal(bd.args.p_ref, "build:a1b2c3d4e5f60718293a4b5c6d7e8f90:settle", "the trusted debit is not under the same ref");
    assert.equal(bd.args.p_partial, true);
    assert.ok(bd.args.p_mint, "the mint proof was not sent");
    assert.doesNotMatch(bd.auth, /expired/, "the customer's token was presented to build_debit");
  } finally { restore(); }
});

test("H2: a live bearer bills exactly as before; build_debit not yet applied (404) leaves the bearer's refusal; a lost answer is never handed on", async () => {
  const { buildLedger } = await loadWorkerModule();
  const env = { SUPABASE_SERVICE_KEY: "svc", CREDITS_MINT_SECRET: "mint" };
  const who = { auth: "Bearer live", uid: BUILD_USER.id, jobId: "a1b2c3d4e5f60718293a4b5c6d7e8f90" };
  let seen = [];
  let restore = stubRpc({ credit_debit: { ok: true, exempt: false, taken: 2, balance: 5, repeat: false } }, seen);
  try {
    assert.equal((await buildLedger(env, who).debit(2, "build:a1b2c3d4e5f60718293a4b5c6d7e8f90:deposit")).taken, 2);
    // build_debit NOT APPLIED (404): the reviewed fallback, the live bearer.
    assert.deepEqual(seen.map((x) => x.fn), ["build_debit", "credit_debit"], "a live bearer was not used after the absent function");
  } finally { restore(); }
  seen = [];
  restore = stubRpc({ credit_debit: new Response("{}", { status: 401 }) }, seen);
  try {
    await assert.rejects(() => buildLedger(env, who).debit(2, "build:a1b2c3d4e5f60718293a4b5c6d7e8f90:deposit"), /credit_debit rpc 401/);
    assert.deepEqual(seen.map((x) => x.fn), ["build_debit", "credit_debit"], "an absent function was asked twice");
  } finally { restore(); }
  seen = [];
  restore = stubRpc({ credit_debit: new Response("timeout", { status: 504 }) }, seen);
  try {
    await assert.rejects(() => buildLedger(env, who).debit(2, "build:a1b2c3d4e5f60718293a4b5c6d7e8f90:deposit"), /504/);
    assert.deepEqual(seen.map((x) => x.fn), ["build_debit", "credit_debit"], "a debit that may have landed was charged a second way");
  } finally { restore(); }
  seen = [];
  restore = stubRpc({ credit_debit: new Response("{}", { status: 401 }), build_debit: new Response("boom", { status: 500 }) }, seen);
  try {
    await assert.rejects(() => buildLedger(env, who).debit(2, "build:a1b2c3d4e5f60718293a4b5c6d7e8f90:deposit"), /build_debit/);
  } finally { restore(); }
  // AND WITHOUT A JOB THERE IS NO TRUST: the inline path keeps the token alone.
  assert.equal(buildLedger(env, { auth: "Bearer x", uid: BUILD_USER.id }).trusted, false);
});

test("H2: the proposed build_debit only ever charges the row's own account, for the row's own refs, while the row is alive", () => {
  const sql = readFileSync(new URL("../supabase/proposed/build_debit.sql", import.meta.url), "utf8");
  assert.match(sql, /private\.mint_ok\(p_mint\)/);
  assert.match(sql, /'build:'\s*\|\|\s*p_id\s*\|\|\s*':deposit'/);
  assert.match(sql, /j\.uid\s*=\s*p_uid|j\.uid\s*<>\s*p_uid|j\.uid\s*is distinct from\s*p_uid/i);
  assert.match(sql, /'lost'.*'failed'.*'cancelled'|'lost', 'failed', 'cancelled'/s);
  assert.match(sql, /revoke all on function public\.build_debit[^;]*from public, anon, authenticated/i);
  assert.match(sql, /grant execute on function public\.build_debit[^;]*to service_role/i);
});

async function driveExpiredConsumer(rowUid, { fence = null, answer = null } = {}) {
  const id = "a1b2c3d4e5f60718293a4b5c6d7e8f90";
  const store = new Map([[jobKey(id), JSON.stringify(packJob({ url: "https://gofarther.dev/api/site/react-build", auth: "Bearer expired", body: JSON.stringify({ brief: "a coffee shop" }), uid: BUILD_USER.id, at: 1 }))]]);
  if (fence) store.set("jobs/" + id + ".fence.json", JSON.stringify(fence));
  if (answer) store.set(resultKey(id), JSON.stringify(answer));
  const b = { store, get: async (k) => (store.has(k) ? { text: async () => store.get(k), etag: "e1" } : null), put: async (k, v) => { store.set(k, String(v)); return {}; }, delete: async (k) => { store.delete(k); } };
  const real = globalThis.fetch;
  const asked = [];
  globalThis.fetch = async (input, init) => {
    const u = String((input && input.url) || input || "");
    const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
    if (u.includes("/auth/v1/user")) return json({ msg: "JWT expired" }, 401);
    const m = u.match(/\/rest\/v1\/rpc\/(edit_\w+)/);
    if (m) {
      asked.push(m[1]);
      return json({ edit_claim: { ok: true, claimed: true, state: "claimed", billing: "external", uid: BUILD_USER.id }, edit_beat: { ok: true, alive: true } }[m[1]] || { ok: true, refunded: 0, billing: "external" });
    }
    if (u.includes("/rest/v1/edit_jobs") && u.includes("id=eq." + id)) { asked.push("row"); return json([{ id, uid: rowUid, op: "build", state: "claimed" }]); }
    if (u.includes("/rest/v1/")) return json([]);
    return new Response("unavailable", { status: 503 });
  };
  try {
    const worker = await loadWorker();
    const ctx = makeCtx();
    await worker.queue({ messages: [{ body: { kind: JOB_KIND, id }, ack() {} }] }, { SUPABASE_SERVICE_KEY: "svc-test", CREDITS_MINT_SECRET: "mint-test", SITES_BUCKET: b }, ctx);
    await Promise.allSettled(ctx.pending);
    const out = store.get(resultKey(id));
    return { out: out ? JSON.parse(out) : null, asked };
  } finally { globalThis.fetch = real; }
}

test("H2: a queued build whose token expired is run as the row's own account, vouched for by the lease holder", async () => {
  const r = await driveExpiredConsumer(BUILD_USER.id);
  // No NEON_API_KEY: the build's first configuration check answers 501, which
  // is only reachable PAST the identity check. Before the fix this was 401.
  assert.ok(r.out, "no answer was stored");
  assert.equal(r.out.status, 501, "the build stopped at the identity check: " + JSON.stringify(r.out).slice(0, 200));
  assert.ok(r.asked.includes("row"), "the row's owner was never read");
});

test("H2 control: a row that names another account vouches for nobody — the expired token still answers 401", async () => {
  const r = await driveExpiredConsumer("99999999-2222-4333-8444-555555555555");
  assert.equal(r.out.status, 401, "a job was run as an account its row does not name");
});

// ── H1: lost-build recovery reconciles publication and ledger first ────────
//
// ATTRIBUTION BY EVIDENCE (Codex's review of b4300a07): a lost build is
// published only when its own fence, the pointer or a version manifest names
// its job. A pointer that moved after the build began is never enough.

const LOST_ID = "b1b2c3d4e5f60718293a4b5c6d7e8f90";
const OTHER_JOB = "e1b2c3d4e5f60718293a4b5c6d7e8f90";
const V_LATE = "01791429280760-09n7s1";
const NOW = Date.parse("2026-10-08T12:00:00Z");
const manifest = (version, { job = null, at = Date.parse("2026-10-08T11:05:00Z") } = {}) => ({ ["builds/harbour-loaf/" + version + "/manifest.json"]: JSON.stringify({ files: ["index.html"], at, job, label: "Build" }) });

async function reconcileWith({ row, rows = null, pointer, entries = {}, fenced = false, reverse = () => ({ ok: true, refunded: 2, already: 0, debited: 2, repeat: false }), store = null, now = NOW, readFails = false }) {
  const { reconcileLostBuilds } = await loadWorkerModule();
  const b = store || buildBucket();
  for (const [k, v] of Object.entries(entries)) b.store.set(k, v);
  if (fenced) b.store.set(jobKey(row.id), JSON.stringify(packJob({ url: "https://gofarther.dev/api/site/react-build", auth: "Bearer t", body: "{}", uid: row.uid, at: 1 })));
  // A WRAPPER, NOT AN ASYNC IIFE (2026-10-08): the first version assigned a
  // Promise to b.get, so every read failed and the old scan's catch-all hid it.
  if (pointer === "throws") b.get = ((orig) => async (k) => { if (k.startsWith("current/")) throw new Error("r2 down"); return orig(k); })(b.get.bind(b));
  else if (pointer) b.store.set("current/" + row.slug + ".json", JSON.stringify(pointer));
  const all = rows || [row];
  const seen = [];
  const queries = [];
  // THE ROW READS AS POSTGREST WOULD ANSWER THEM: the fresh read honours its
  // one-day window, the pending read its id list.
  const rest = (u) => {
    if (!u.includes("/rest/v1/edit_jobs")) return null;
    queries.push(u);
    if (readFails) return new Response("down", { status: 503 });
    const ids = u.match(/id=in\.\(([^)]*)\)/);
    // THE KEYSET FILTER the scan sends (2026-10-08), read as PostgREST reads it.
    const or = new URL(u).searchParams.get("or");
    const k = or && or.match(/^\(updated_at\.gt\."([^"]+)",and\(updated_at\.eq\."([^"]+)",id\.gt\."([^"]*)"\)\)$/);
    const after = (x) => !k || Date.parse(x.updated_at) > Date.parse(k[1]) || (Date.parse(x.updated_at) === Date.parse(k[1]) && x.id > k[3]);
    const out = all.filter((x) => (ids ? ids[1].split(",").includes(x.id) : true) && after(x));
    return new Response(JSON.stringify(out), { status: 200 });
  };
  const restore = stubRpc({ credit_reverse: reverse, __rest: rest }, seen);
  try {
    const out = await reconcileLostBuilds({ SUPABASE_SERVICE_KEY: "svc", CREDITS_MINT_SECRET: "mint", SITES_BUCKET: b }, { now });
    const res = b.store.get(resultKey(row.id));
    return { out, seen, queries, store: b, reversed: seen.filter((x) => x.fn === "credit_reverse").length, pending: b.store.has("recovery/pending/" + row.id), fence: b.store.has("jobs/" + row.id + ".fence.json") ? JSON.parse(b.store.get("jobs/" + row.id + ".fence.json")) : null, answer: res ? JSON.parse(JSON.parse(res).body) : null, status: res ? JSON.parse(res).status : null };
  } finally { restore(); }
}
const lostRow = (over = {}) => ({ id: LOST_ID, uid: BUILD_USER.id, slug: "harbour-loaf", op: "build", state: "lost", created_at: "2026-10-08T11:00:00Z", updated_at: "2026-10-08T11:10:00Z", ...over });

test("H1: the row's own sentence no longer claims nothing was charged", () => {
  assert.doesNotMatch(LOST_SITE_MSG, /weren't charged|not charged|nothing was charged/i);
  assert.match(LOST_SITE_MSG, /stand-in page at your address/);
});

test("H1: a lost build that never published has every one of its refs reversed, recovery holds its fence, and its answer says what came back", async () => {
  const r = await reconcileWith({ row: lostRow(), pointer: null });
  assert.deepEqual(r.seen.filter((x) => x.fn === "credit_reverse").map((x) => x.args.p_ref.split(":").pop() + "/" + x.args.p_reason), ["deposit/lost", "settle/lost", "pages/lost"]);
  assert.equal(r.fence.by, "recovery", "recovery decided without claiming the outcome first");
  assert.equal(r.answer.refunded, 6);
  assert.equal(r.answer.cost, 0);
  assert.equal(r.answer.page, "placeholder");
  assert.match(r.answer.msg, /\(6 credits\) has been returned/);
  assert.equal(r.status, 200);
  assert.equal(r.pending, false);
});

test("H1: …and recovery run again moves nothing more and does not rewrite the answer", async () => {
  const first = await reconcileWith({ row: lostRow(), pointer: null });
  first.store.store.delete(resultKey(LOST_ID)); // the browser collected it
  const again = await reconcileWith({ row: lostRow(), pointer: null, store: first.store });
  assert.equal(again.reversed, 0, "a second pass reversed again");
  assert.equal(again.answer, null, "a second pass wrote a new answer");
});

test("H1: a lost build whose activation was recorded keeps what it charged, and says the site is live", async () => {
  // THE RECORD OF A COMPLETED ACTIVATION proves it (2026-10-08, Codex's review
  // of 3308d51d); the pointer naming the job alone is "under way or done".
  const r = await reconcileWith({ row: lostRow(), pointer: { version: V_LATE, job: LOST_ID, activatedAt: "2026-10-08T11:05:00Z" }, entries: { ...manifest(V_LATE, { job: LOST_ID }), ["jobs/" + LOST_ID + ".fence.json"]: JSON.stringify({ by: "publish", published: V_LATE }) } });
  assert.equal(r.reversed, 0, "a published build was refunded");
  assert.equal(r.answer.ok, true);
  assert.equal(r.answer.page, "app");
  assert.equal(r.answer.version, V_LATE);
  assert.match(r.answer.msg, /did go live/);
});

test("N2: an unrelated edit published after the build began is not this build's publication — the build is refunded", async () => {
  const r = await reconcileWith({ row: lostRow(), pointer: { version: V_LATE, job: OTHER_JOB, activatedAt: "2026-10-08T11:30:00Z" }, entries: manifest(V_LATE, { job: OTHER_JOB, at: Date.parse("2026-10-08T11:30:00Z") }) });
  assert.equal(r.reversed, 3, "a later edit's publish was credited to the lost build");
  assert.equal(r.answer.page, "placeholder");
  assert.doesNotMatch(r.answer.msg, /did go live/);
});

test("N2: a later version that names no job (an inline edit or restore) leaves an older unfenced job unknown — pending, nothing moved; a fenced job is refunded", async () => {
  const later = { pointer: { version: V_LATE, job: null, activatedAt: "2026-10-08T11:30:00Z" }, entries: manifest(V_LATE, { job: null, at: Date.parse("2026-10-08T11:30:00Z") }) };
  const legacy = await reconcileWith({ row: lostRow(), ...later });
  assert.equal(legacy.reversed, 0, "a timestamp decided the outcome");
  assert.equal(legacy.answer, null);
  assert.equal(legacy.pending, true, "an unresolved recovery was not kept findable");
  const fenced = await reconcileWith({ row: lostRow(), ...later, fenced: true });
  assert.equal(fenced.reversed, 3, "a fenced job that recovery holds was left unknown");
  assert.equal(fenced.answer.page, "placeholder");
});

test("N2: a build that published and was then edited over is still published — its own fence names its version", async () => {
  const r = await reconcileWith({ row: lostRow(), pointer: { version: V_LATE, job: OTHER_JOB }, entries: { ["jobs/" + LOST_ID + ".fence.json"]: JSON.stringify({ by: "publish", published: "01791417187002-f821gr" }) } });
  assert.equal(r.reversed, 0, "a build whose publish was recorded was refunded after a later edit");
  assert.equal(r.answer.version, "01791417187002-f821gr");
});

test("N2: …but a version manifest naming it, with no record of its activation, is staging — unknown: nothing moved, kept pending", async () => {
  // A MANIFEST IS WRITTEN WHEN A VERSION IS STAGED (Codex's review of 3308d51d).
  const r = await reconcileWith({ row: lostRow(), pointer: { version: V_LATE, job: OTHER_JOB }, entries: { ...manifest(V_LATE, { job: OTHER_JOB }), ...manifest("01791417187002-f821gr", { job: LOST_ID }) } });
  assert.equal(r.reversed, 0);
  assert.equal(r.answer, null);
  assert.equal(r.pending, true);
});

test("N2: a publish that claimed the fence and left no record yet is unknown — nothing moved, kept pending; one that recorded its failure is refunded", async () => {
  const flight = await reconcileWith({ row: lostRow(), pointer: null, entries: { ["jobs/" + LOST_ID + ".fence.json"]: JSON.stringify({ by: "publish" }) } });
  assert.equal(flight.reversed, 0, "recovery refunded a build that may be activating");
  assert.equal(flight.pending, true);
  assert.equal(flight.fence.by, "publish", "recovery took over a fence the publish held");
  const failed = await reconcileWith({ row: lostRow(), pointer: null, entries: { ["jobs/" + LOST_ID + ".fence.json"]: JSON.stringify({ by: "publish", failed: true }) } });
  assert.equal(failed.reversed, 3);
});

test("H1: an unreadable pointer moves no money and writes no answer — kept pending, the next tick asks again", async () => {
  const r = await reconcileWith({ row: lostRow(), pointer: "throws" });
  assert.equal(r.reversed, 0);
  assert.equal(r.answer, null);
  assert.equal(r.out.unknown, 1);
  assert.equal(r.pending, true);
});

test("N2: unresolved recovery does not age out — a pending build last touched three days ago is read by id and settled", async () => {
  const old = lostRow({ created_at: "2026-10-05T11:00:00Z", updated_at: "2026-10-05T11:10:00Z" });
  const first = await reconcileWith({ row: old, pointer: "throws", now: Date.parse("2026-10-05T12:00:00Z") });
  assert.equal(first.pending, true);
  const store = buildBucket(Object.fromEntries(first.store.store));
  const later = await reconcileWith({ row: old, pointer: null, store });
  assert.ok(later.queries.some((q) => q.includes("id=in.(" + LOST_ID + ")")), "the pending build was not read by id");
  assert.equal(later.reversed, 3, "a pending build past the window was never settled");
  assert.equal(later.pending, false, "a settled build stayed pending");
  // CONTROL: the same old row with nothing pending is outside the window.
  const none = await reconcileWith({ row: old, pointer: null });
  assert.equal(none.out.checked, 0, "the one-day window no longer bounds new pickups");
});

test("H1: a reversal that cannot be made is said, kept pending, and finished by a later pass without returning twice", async () => {
  let down = true;
  const first = await reconcileWith({ row: lostRow(), pointer: null, reverse: () => (down ? new Response("down", { status: 500 }) : { ok: true, refunded: 2, already: 0, debited: 2, repeat: false }) });
  assert.equal(first.answer.refundShort, true);
  assert.match(first.answer.msg, /hasn't gone through yet/);
  assert.equal(first.pending, true);
  down = false;
  const again = await reconcileWith({ row: lostRow(), pointer: null, store: first.store, reverse: () => ({ ok: true, refunded: 2, already: 0, debited: 2, repeat: false }) });
  assert.equal(again.answer.refunded, 6);
  assert.equal(again.answer.refundShort, undefined);
  assert.equal(again.pending, false);
  const third = await reconcileWith({ row: lostRow(), pointer: null, store: again.store });
  assert.equal(third.reversed, 0, "a settled build was reversed a third time");
});

test("H1: a lost first build that never had an address answers 410, refunded", async () => {
  const r = await reconcileWith({ row: lostRow({ slug: "build:" + LOST_ID }), pointer: undefined });
  assert.equal(r.status, 410);
  assert.equal(r.answer.refunded, 6);
  assert.equal(lostBuildVerdict({ row: { slug: "build:x" } }).outcome, "not-published");
});

test("N2: lostBuildVerdict never decides by a timestamp", () => {
  const row = lostRow();
  const fence = { owner: "recovery", mine: true };
  const later = [{ id: V_LATE, at: Date.parse("2026-10-08T11:30:00Z"), job: OTHER_JOB }];
  assert.equal(lostBuildVerdict({ row, pointer: { version: V_LATE, job: OTHER_JOB }, builds: later, fence }).outcome, "not-published");
  assert.equal(lostBuildVerdict({ row, pointer: { version: V_LATE, job: null }, builds: [{ ...later[0], job: null }], fence }).outcome, "unknown");
  assert.equal(lostBuildVerdict({ row, pointer: { version: V_LATE, job: null }, builds: [{ ...later[0], job: null }], fence, fencedJob: true }).outcome, "not-published");
  assert.equal(lostBuildVerdict({ row, pointer: null, builds: [], fence: { owner: null } }).outcome, "unknown", "an unreadable fence decided");
  assert.equal(lostBuildVerdict({ row, pointer: undefined, builds: [], fence }).outcome, "unknown");
  assert.equal(lostBuildVerdict({ row, pointer: { version: V_LATE, job: OTHER_JOB }, builds: null, fence }).outcome, "unknown");
});

test("H1: the sweep runs the reconcile after the SQL sweep, every tick", () => {
  const at = W.indexOf("export async function runLostEditJobs(");
  const sweep = W.indexOf('editRpc(env, "edit_sweep_lost"', at);
  const rec = W.indexOf("await reconcileLostBuilds(env)", at);
  assert.ok(at > 0 && sweep > at && rec > sweep, "the lost-build reconcile is not run after the SQL sweep");
});

// ── N2: a late worker after recovery, duplicate delivery, and the job-state guard ──

const LATE_ID = "d1b2c3d4e5f60718293a4b5c6d7e8f90";
function rowStub(state, seen) {
  return stubRpc({
    credit_debit: { ok: true, exempt: false, taken: 2, balance: 5, repeat: false },
    // build_debit NOT APPLIED (404): the cases below drive the reviewed fallback.
    __rest: (u) => (u.includes("/rest/v1/edit_jobs") ? (state === "unread" ? new Response("down", { status: 503 }) : new Response(JSON.stringify(state ? [{ id: LATE_ID, uid: BUILD_USER.id, op: "build", state }] : []), { status: 200 })) : null),
  }, seen);
}

test("N2: a late worker after recovery claimed the outcome cannot publish — the gate refuses before the pointer, and recovery keeps the fence", async () => {
  const { buildPublishGate } = await loadWorkerModule();
  const b = buildBucket({ ["jobs/" + LATE_ID + ".fence.json"]: JSON.stringify({ by: "recovery" }) });
  const seen = [];
  const restore = rowStub("claimed", seen);
  try {
    await assert.rejects(() => buildPublishGate({ SUPABASE_SERVICE_KEY: "svc", SITES_BUCKET: b }, LATE_ID), (e) => e.recovered === true);
  } finally { restore(); }
  assert.equal(JSON.parse(b.store.get("jobs/" + LATE_ID + ".fence.json")).by, "recovery");
  assert.ok(![...b.store.keys()].some((k) => k.startsWith("current/")), "a pointer was written");
});

test("N2: …nor can one whose row the sweep already marked lost, even before recovery ran", async () => {
  const { buildPublishGate } = await loadWorkerModule();
  for (const state of ["lost", "failed", "cancelled"]) {
    const b = buildBucket();
    const restore = rowStub(state, []);
    try { await assert.rejects(() => buildPublishGate({ SUPABASE_SERVICE_KEY: "svc", SITES_BUCKET: b }, LATE_ID), (e) => e.recovered === true, state); }
    finally { restore(); }
    assert.equal(b.store.has("jobs/" + LATE_ID + ".fence.json"), false, "a dead row claimed the publish (" + state + ")");
  }
});

test("N2: a live build claims its publish, a duplicate delivery of the same job finds its own claim and goes on, and recovery then cannot refund it", async () => {
  const { buildPublishGate, claimBuildFence } = await loadWorkerModule();
  const b = buildBucket();
  const env = { SUPABASE_SERVICE_KEY: "svc", SITES_BUCKET: b };
  const restore = rowStub("claimed", []);
  try {
    assert.equal(await buildPublishGate(env, LATE_ID), true);
    assert.equal(await buildPublishGate(env, LATE_ID), true, "a duplicate delivery of the same job was refused");
    const rec = await claimBuildFence(env, LATE_ID, "recovery");
    assert.equal(rec.owner, "publish");
    assert.equal(rec.mine, false);
    assert.equal(lostBuildVerdict({ row: lostRow({ id: LATE_ID }), pointer: null, builds: [], fence: rec }).outcome, "unknown", "recovery refunded a build that holds its publish");
  } finally { restore(); }
  // A build with no job id is not fenced, and runs as it always did.
  assert.equal(await buildPublishGate(env, null), false);
});

test("N2: the build's publish passes the gate right before the pointer, records the version it put live, and a failure never erases a recorded publish", () => {
  const blank = (s) => s.split("\n").map((l) => (/^\s*\/\//.test(l) ? "" : l)).join("\n");
  const code = blank(W);
  const gate = code.indexOf("const fenced = await buildPublishGate(env, jobId);");
  const ptr = code.indexOf("before = await readPointer(buildDeps(env), slug);", gate);
  const act = code.indexOf("const act = await activateBuild(buildDeps(env), {", gate);
  assert.ok(gate > 0 && ptr > gate && act > ptr && act - gate < 400, "the gate is not the last step before activation");
  assert.match(code.slice(act, act + 4000), /if \(!act \|\| act\.ok !== true\) \{\s*if \(fenced\) await markPublishFailed\(env, jobId\);[\s\S]*?\}\s*if \(fenced\) await markPublished\(env, jobId, bVersion\);/);
});

test("N2: recovery claiming between the gate's state read and its claim still stops the publish", async () => {
  const { buildPublishGate } = await loadWorkerModule();
  // THE RACE: the state read sees no fence (recovery has not written yet);
  // recovery then claims; the gate's create-only claim finds it.
  const b = buildBucket({ ["jobs/" + LATE_ID + ".fence.json"]: JSON.stringify({ by: "recovery" }) });
  const get = b.get.bind(b);
  let hidden = 1;
  b.get = async (k) => (k === "jobs/" + LATE_ID + ".fence.json" && hidden-- > 0 ? null : get(k));
  const restore = rowStub("claimed", []);
  try { await assert.rejects(() => buildPublishGate({ SUPABASE_SERVICE_KEY: "svc", SITES_BUCKET: b }, LATE_ID), (e) => e.recovered === true); }
  finally { restore(); }
  assert.ok(hidden < 1, "the race was not driven: the state read never asked for the fence");
});

test("N2: a failed activation is recorded for recovery, but never over a publish a duplicate delivery recorded, and never on an unreadable fence", async () => {
  const { markPublishFailed, markPublished } = await loadWorkerModule();
  const key = "jobs/" + LATE_ID + ".fence.json";
  const claimed = buildBucket({ [key]: JSON.stringify({ by: "publish" }) });
  await markPublishFailed({ SITES_BUCKET: claimed }, LATE_ID);
  assert.equal(JSON.parse(claimed.store.get(key)).failed, true);
  const done = buildBucket({ [key]: JSON.stringify({ by: "publish" }) });
  await markPublished({ SITES_BUCKET: done }, LATE_ID, V_LATE);
  await markPublishFailed({ SITES_BUCKET: done }, LATE_ID);
  assert.equal(JSON.parse(done.store.get(key)).published, V_LATE, "a later failure erased the recorded publish");
  assert.notEqual(JSON.parse(done.store.get(key)).failed, true);
  const blind = buildBucket({ [key]: JSON.stringify({ by: "publish", published: V_LATE }) });
  blind.get = async () => { throw new Error("r2 down"); };
  await markPublishFailed({ SITES_BUCKET: blind }, LATE_ID);
  assert.equal(JSON.parse(blind.store.get(key)).published, V_LATE, "an unreadable fence was overwritten");
});

for (const token of ["Bearer expired", "Bearer live"]) {
  test("N2: a build job whose row is lost is charged nothing, whatever its login token (" + token + ")", async () => {
    const { buildLedger } = await loadWorkerModule();
    const seen = [];
    const restore = stubRpc({
      credit_debit: token === "Bearer expired" ? new Response(JSON.stringify({ message: "JWT expired" }), { status: 401 }) : { ok: true, exempt: false, taken: 2, balance: 5, repeat: false },
      // build_debit AS THE PROPOSED SQL ANSWERS a lost row, under its row lock.
      build_debit: { ok: false, error: "terminal", state: "lost", taken: 0 },
      __rest: (u) => (u.includes("/rest/v1/edit_jobs") ? new Response(JSON.stringify([{ id: LATE_ID, uid: BUILD_USER.id, op: "build", state: "lost" }]), { status: 200 }) : null),
    }, seen);
    try {
      await assert.rejects(() => buildLedger({ SUPABASE_SERVICE_KEY: "svc", CREDITS_MINT_SECRET: "mint" }, { auth: token, uid: BUILD_USER.id, jobId: LATE_ID }).debit(2, "build:" + LATE_ID + ":pages", "debit", true), (e) => e.jobState === "lost");
      assert.deepEqual(seen.map((x) => x.fn), ["build_debit"], "a lost job reached credit_debit");
    } finally { restore(); }
  });
}

test("N2: while build_debit is not applied, a job whose row cannot be read, or whose recovery holds the fence, is charged nothing; a live row is charged as before", async () => {
  const { buildLedger } = await loadWorkerModule();
  const who = { auth: "Bearer live", uid: BUILD_USER.id, jobId: LATE_ID };
  let seen = [];
  let restore = rowStub("unread", seen);
  try {
    await assert.rejects(() => buildLedger({ SUPABASE_SERVICE_KEY: "svc", CREDITS_MINT_SECRET: "mint" }, who).debit(2, "build:" + LATE_ID + ":settle"), (e) => !!e.jobState);
    assert.deepEqual(seen.map((x) => x.fn), ["build_debit"], "an unread job reached credit_debit");
  } finally { restore(); }
  seen = [];
  restore = rowStub("claimed", seen);
  try {
    const b = buildBucket({ ["jobs/" + LATE_ID + ".fence.json"]: JSON.stringify({ by: "recovery" }) });
    await assert.rejects(() => buildLedger({ SUPABASE_SERVICE_KEY: "svc", CREDITS_MINT_SECRET: "mint", SITES_BUCKET: b }, who).debit(2, "build:" + LATE_ID + ":pages"), (e) => e.jobState === "recovered");
    assert.deepEqual(seen.map((x) => x.fn), ["build_debit"], "a recovered job reached credit_debit");
    const ok = await buildLedger({ SUPABASE_SERVICE_KEY: "svc", CREDITS_MINT_SECRET: "mint", SITES_BUCKET: buildBucket() }, who).debit(2, "build:" + LATE_ID + ":settle");
    assert.equal(ok.taken, 2);
    assert.deepEqual(seen.map((x) => x.fn), ["build_debit", "build_debit", "credit_debit"]);
  } finally { restore(); }
});

test("N2: the queue consumer does not overwrite recovery's answer when the late worker finishes", async () => {
  const r = await driveExpiredConsumer(BUILD_USER.id, { fence: { by: "recovery" }, answer: { status: 200, body: "recovered" } });
  assert.equal(r.out.body, "recovered", "a late worker's answer replaced recovery's");
});

// ── N2: the pages debit whose answer was lost ──────────────────────────────

test("N2: a pages debit whose answer was lost is read back by ref — found is the amount taken, not found or unread is unknown, never zero", async () => {
  const { debitPagesReconciled } = await loadWorkerModule();
  const who = { auth: "Bearer live", uid: BUILD_USER.id, jobId: LATE_ID };
  const ref = "build:" + LATE_ID + ":pages";
  const run = async (events) => {
    const seen = [];
    const restore = stubRpc({
      credit_debit: new Response("upstream timeout", { status: 504 }),
      __rest: (u) => {
        if (u.includes("/rest/v1/edit_jobs")) return new Response(JSON.stringify([{ id: LATE_ID, uid: BUILD_USER.id, op: "build", state: "claimed" }]), { status: 200 });
        if (u.includes("/rest/v1/credit_events")) { seen.push(u); return events === "down" ? new Response("down", { status: 503 }) : new Response(JSON.stringify(events), { status: 200 }); }
        return null;
      },
    }, seen);
    try { return { r: await debitPagesReconciled({ SUPABASE_SERVICE_KEY: "svc", CREDITS_MINT_SECRET: "mint" }, who, 7, ref).catch((e) => e), seen }; }
    finally { restore(); }
  };
  const found = await run([{ delta: -7, reason: "debit" }]);
  assert.equal(found.r.taken, 7);
  assert.ok(found.seen.some((u) => typeof u === "string" && u.includes("ref=eq." + encodeURIComponent(ref))), "the ledger was not read by the ref");
  for (const events of [[], "down"]) {
    const { r } = await run(events);
    assert.equal(r.chargeUnknown, true, "a lost answer read as nothing charged: " + JSON.stringify(events));
  }
});


// ── H5: editable source, parts, kit and the version marker ─────────────────

function versionDeps(entries = {}) {
  const store = new Map(Object.entries(entries));
  return { store, get: async (k) => (store.has(k) ? { text: async () => store.get(k) } : null), put: async (k, v) => { store.set(k, String(v)); } };
}

test("H5: a version keeps its kit beside its pages, and a repair puts the kit back with them", async () => {
  const d = versionDeps();
  const v = "01791429280760-09n7s1";
  await stageBuild(d, { slug: "s", version: v, files: { "assets/a.js": { t: "x" } }, state: { pages: "[1]", parts: "[]", config: "{}", sidecar: "{}", kit: '[{"path":"src/components/ui/x.tsx","source":"k"}]' }, manifest: {} });
  assert.equal((await readBuild(d, "s", v)).kit, '[{"path":"src/components/ui/x.tsx","source":"k"}]');
  const r = await repairEditable(d, { slug: "s", version: v, keys: { source: "src.json", parts: "parts.json", kit: "kit.json" } });
  assert.deepEqual(r.wrote, ["source", "parts", "kit"]);
  assert.equal(d.store.get("kit.json"), '[{"path":"src/components/ui/x.tsx","source":"k"}]');
  assert.equal((await readHead(d, "s")).version, v);
});

test("H5: both publish paths mark the editable copy current only when every save landed", () => {
  const blank = (s) => s.split("\n").map((l) => (/^\s*\/\//.test(l) ? "" : l)).join("\n");
  const build = blank(W.slice(W.indexOf("sourceStored = await saveSiteSource(env, slug, pages);"), W.indexOf("await writeHead(buildDeps(env), slug, bVersion);") + 60));
  assert.ok(build.length > 100 && build.length < 3000, "the build's afterActivate window moved: " + build.length);
  assert.match(build, /editableStored = sourceStored === true && partsStored === true && kitStored === true;\s*if \(!editableStored\) \{[\s\S]*?return;\s*\}\s*await writeHead/);
  const spine = blank(W.slice(W.indexOf("const saved = { source: await saveSiteSource(env, slug, pages) };"), W.indexOf("await writeHead(buildDeps(env), slug, version);") + 60));
  assert.ok(spine.length > 100 && spine.length < 3000, "the spine's afterActivate window moved: " + spine.length);
  assert.match(spine, /if \(unsaved\.length\) \{ tm\("r2:head", "fail"[^\n]*return; \}\s*await writeHead/);
});

async function driveText({ head, stateFor }) {
  const slug = "harbour-loaf";
  const pointer = { version: "01791429280760-09n7s1", build: "", parent: "", job: null, activatedAt: "2026-10-08T11:05:00Z" };
  const entries = {
    ["current/" + slug + ".json"]: JSON.stringify(pointer),
    ["source/" + slug + ".json"]: JSON.stringify([{ path: "index.tsx", source: "export default function I(){return <h1>OLD words</h1>}" }]),
  };
  if (head) entries["state/" + slug + "/head.json"] = JSON.stringify({ version: head, at: 1 });
  if (stateFor) entries["builds/" + slug + "/" + stateFor + "/state/pages.json"] = JSON.stringify([{ path: "index.tsx", source: "export default function I(){return <h1>NEW words</h1>}" }]);
  const b = buildBucket(entries);
  const real = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const u = String((input && input.url) || input || "");
    const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
    if (u.includes("/auth/v1/user")) return json(BUILD_USER);
    if (u.includes("site_backends")) return json([{ slug, uid: BUILD_USER.id, neon_db: "" }]);
    if (u.includes("/rest/v1/")) return json([]);
    return new Response("unavailable", { status: 503 });
  };
  try {
    const worker = await loadWorker();
    const res = await worker.fetch(new Request("https://gofarther.dev/api/site/" + slug + "/text", { headers: { Authorization: "Bearer t" } }), { SITES_BUCKET: b, SUPABASE_SERVICE_KEY: "svc", CREDITS_MINT_SECRET: "m" }, makeCtx());
    return { status: res.status, json: await res.json().catch(() => null), store: b.store };
  } finally { globalThis.fetch = real; }
}

test("H5: an editable copy behind the live version is repaired before it is shown for editing", async () => {
  const r = await driveText({ head: "01791417187002-f821gr", stateFor: "01791429280760-09n7s1" });
  assert.equal(r.status, 200, JSON.stringify(r.json).slice(0, 200));
  assert.match(JSON.stringify(r.json.pages), /NEW words/, "the stale copy was served for editing");
  assert.doesNotMatch(JSON.stringify(r.json.pages), /OLD words/);
});

test("H5: …and one that cannot be repaired is reported as unconfirmed, never served as current", async () => {
  const r = await driveText({ head: "01791417187002-f821gr", stateFor: null });
  assert.equal(r.status, 503, "a stale copy was served: " + JSON.stringify(r.json).slice(0, 200));
  assert.equal(r.json.error, "source-unconfirmed");
});

test("H5: every reader that goes on to publish asks for the checked source", () => {
  const blank = (s) => s.split("\n").map((l) => (/^\s*\/\//.test(l) ? "" : l)).join("\n");
  const code = blank(W);
  assert.match(code, /const priorRead = existing \? await loadSiteSourceForEdit\(env, slug, \{ checked: true \}\) : null;/, "the revise anchor is unchecked");
  assert.match(code, /priorPages: priorRead \? priorRead\.pages : null,/);
  assert.match(code, /const rbRead = await loadSiteSourceForEdit\(env, ownerSlug, \{ checked: true \}\);/, "the platform rebuild is unchecked");
  assert.match(code, /label: "Back online"/);
  const back = code.slice(code.indexOf("recompile: async ({ slug }) => {"), code.indexOf('label: "Back online"'));
  assert.match(back, /checked: true/, "Back online recompiles an unchecked copy");
  assert.equal((code.match(/loadSiteSourceForEdit\([^)]*\)(?!\s*\{)/g) || []).filter((c) => !/checked: true/.test(c) && !/async function/.test(c)).length, 0, "an unchecked caller remains");
});

// ── M7: attachments survive a refire ───────────────────────────────────────

async function driveRefire(kept) {
  const id = "c1b2c3d4e5f60718293a4b5c6d7e8f90";
  const files = [{ type: "image", source: { type: "base64", media_type: "image/jpeg", data: "/9j/AAAA" } }];
  const design = { slug: "hearth-paper", brand: "Hearth", brief: "b", siteDescription: "d", theme: "ink-and-linen", lang: "en", langs: [], spec: { tables: [] }, plan: { pages: [{ path: "index.tsx" }] }, picker: "grok", attachments: [], attachmentsHeld: 1, attachmentsSent: 1 };
  const record = packResume({ id, auth: "", uid: BUILD_USER.id, slug: "hearth-paper", lane: "site-hearth-paper", genId: "gen-1", report: "0f1e2d3c4b5a69788796a5b4c3d2e1f0", firedAt: Date.now() - 600_000, charged: ["deposit", "schema"], looks: 3, refires: 0, steps: [], design });
  // A GENERATION THAT FAILED BEFORE IT LEFT (no status): `resumeDecision`
  // answers `refire`, the one branch that writes the pages again.
  const b = buildBucket({ [resumeKey(id)]: JSON.stringify(record), [attachmentsKey(id)]: JSON.stringify(kept(files)), [genKey("0f1e2d3c4b5a69788796a5b4c3d2e1f0")]: JSON.stringify({ state: "failed", message: "the request never left" }) });
  const got = [];
  const orig = b.get.bind(b);
  b.get = async (k) => { got.push(k); return orig(k); };
  const seen = [];
  const rows = [];
  const restore = stubRpc({ edit_claim: { ok: true, claimed: true }, edit_handoff: { ok: true }, edit_beat: { ok: true }, edit_finalize: { ok: true }, edit_refund: { ok: true }, __rest: (u, init) => { if (u.includes("site_builds")) rows.push(String((init && init.body) || "")); return null; } }, seen);
  try {
    const worker = await loadWorker();
    const ctx = makeCtx();
    await worker.queue({ messages: [{ body: { kind: RESUME_KIND, id }, ack() {}, retry() {} }] },
      { SITES_BUCKET: b, BUILD_QUEUE: { async send() {}, async sendBatch() {} }, SUPABASE_SERVICE_KEY: "svc", CREDITS_MINT_SECRET: "mint" }, ctx);
    await Promise.allSettled(ctx.pending);
  } finally { restore(); }
  return { id, got, rows, store: b.store };
}

for (const [form, kept] of [["the older list", (f) => f], ["the record with its ids", (f) => ({ v: 2, blocks: f, named: [{ id: "attachment-2", index: 1, name: "shop.jpg", kind: "image" }] })]]) test("M7: a refired build reads back the files the customer attached, for the page writer it runs again (" + form + ")", async () => {
  const { id, got, rows } = await driveRefire(kept);
  assert.ok(got.includes(attachmentsKey(id)), "a refire never read the kept files back — it ran with none: " + got.join(","));
  // AND WHAT CAME BACK IS ON THE BUILD'S OWN RECORD: sent 1, back 1.
  assert.ok(rows.some((r) => /"attachments"[^}]*"sent":1[^}]*"back":1|"n":"attachments"[^}]*"sent":1,"back":1/.test(r)), "the refire's trace does not say the files came back: " + rows.join("\n").slice(0, 400));
});

test("M7: the first invocation keeps the files beside the record, and every record delete takes them too", () => {
  const blank = (s) => s.split("\n").map((l) => (/^\s*\/\//.test(l) ? "" : l)).join("\n");
  const code = blank(W);
  assert.match(code, /await env\.SITES_BUCKET\.put\(attachmentsKey\(jobId\), JSON\.stringify\(\{ v: 2, blocks: held, named: Array\.isArray\(buildArgs && buildArgs\.attachmentIds\) \? buildArgs\.attachmentIds : \[\] \}\)\)/);
  assert.match(code, /design: \{ \.\.\.design, attachments: \[\], \.\.\.\(held\.length \? \{ attachmentsHeld, attachmentsSent: held\.length \} : \{\}\) \}/);
  const deletes = (code.match(/SITES_BUCKET\.delete\(resumeKey\((?:id|jobId)\)\)/g) || []).length;
  const kept = (code.match(/SITES_BUCKET\.delete\(attachmentsKey\((?:id|jobId)\)\)/g) || []).length;
  assert.ok(deletes >= 3);
  assert.equal(kept, deletes, "a record is deleted somewhere its kept files are not");
});

// ── M1: salvage on the container's real failure contract ───────────────────

const PAGES = [{ path: "index.tsx", source: "a" }, { path: "menu.tsx", source: "l1\nl2\nl3" }];
const VITE = {
  esbuild: "vite build\n[vite:esbuild] Transform failed with 1 error:\n/app/src/routes/menu.tsx:2:3: ERROR: Expected \";\" but found \"x\"",
  rollup: "error during build:\nsrc/routes/menu.tsx (3:9): \"Nope\" is not exported by \"src/components/ui/card.tsx\", imported by \"src/routes/menu.tsx\".",
  resolve: "[vite]: Rollup failed to resolve import \"@/lib/nope\" from \"/app/src/routes/menu.tsx\".",
};

test("M1: a page that does not bundle is salvaged — the container's `build` stage, in each of vite's forms", () => {
  for (const [form, error] of Object.entries(VITE)) {
    assert.equal(salvageable({ ok: false, stage: "build", error }), true, form + " was not salvageable");
    assert.deepEqual(salvagePlan(error, PAGES, []).stub, ["menu.tsx"], form + " did not stub the page it names");
  }
  assert.deepEqual(errorCitations(VITE.esbuild), [{ file: "src/routes/menu.tsx", line: 2, col: 3 }], "the container's working directory reached a caller");
});

test("M1: infrastructure failures are never read as a bad page", () => {
  for (const error of ["build produced no client bundle", "vite build was killed by SIGKILL — killed outright, so either the instance was stopped mid-build or it hit a resource limit (no output)", "the build service is unreachable: fetch failed", "the build service returned nothing"]) {
    assert.equal(salvageable({ ok: false, stage: "build", error }), false, "salvaged: " + error);
  }
  assert.equal(salvageable({ ok: false, stage: "build", room: "busy", error: VITE.esbuild }), false, "a build that ran out of room was salvaged");
  assert.equal(salvageable({ ok: false, stage: "routes", error: VITE.esbuild }), false, "a route-tree failure was salvaged");
});

test("M1: a failure in a kit file or on the home page is still refused, and a live page is never stubbed", () => {
  assert.match(salvagePlan("/app/src/components/ui/card.tsx:4:1: ERROR: x", PAGES, []).reason, /didn't write/);
  assert.match(salvagePlan("/app/src/routes/index.tsx:1:1: ERROR: x", PAGES, []).reason, /home page/);
  assert.deepEqual(salvagePlan(VITE.esbuild, PAGES, ["menu.tsx"]).kept, ["menu.tsx"]);
});

test("M1: the salvage call site asks the container's contract, and the service header says what it sends", () => {
  const pp = readFileSync(new URL("../builder/publish-pages.mjs", import.meta.url), "utf8");
  assert.match(pp, /if \(salvageable\(built\)\) \{/);
  assert.doesNotMatch(pp, /if \(!built\.ok && built\.stage === "typecheck"\)/);
  const server = readFileSync(new URL("../builder/build-server.mjs", import.meta.url), "utf8").split("\n").slice(0, 30).join("\n");
  assert.doesNotMatch(server, /"stage": "typecheck" \}/, "the service header still promises a typecheck failure");
  assert.match(server, /"stage": "routes"/);
});

// ── N2: the container's build debit through the gateway ─────────────────────

test("N2: the gateway admits build_debit for the job's own id, account and exact refs, and refuses another account, job or reference", () => {
  const id = "a1b2c3d4e5f60718293a4b5c6d7e8f90";
  const other = "f1b2c3d4e5f60718293a4b5c6d7e8f90";
  const who = { id, uid: BUILD_USER.id, slug: "harbour-loaf" };
  const ask = (body) => sbDecision(who, "POST", "/rest/v1/rpc/build_debit", "", JSON.stringify({ p_mint: SB_MARKER, p_amount: 2, p_partial: true, p_reason: "debit", ...body }), "real-mint");
  for (const step of ["deposit", "settle", "pages"]) {
    const ok = ask({ p_id: id, p_uid: BUILD_USER.id, p_ref: "build:" + id + ":" + step });
    assert.equal(ok.ok, true, step + " was refused: " + ok.why);
    assert.equal(JSON.parse(ok.body).p_mint, "real-mint", "the mint proof was not supplied by the gateway");
  }
  assert.equal(ask({ p_id: id, p_uid: "99999999-2222-4333-8444-555555555555", p_ref: "build:" + id + ":pages" }).why, "bind:p_uid", "another account was admitted");
  assert.equal(ask({ p_id: other, p_uid: BUILD_USER.id, p_ref: "build:" + other + ":pages" }).why, "bind:p_id", "another job was admitted");
  assert.equal(ask({ p_id: id, p_uid: BUILD_USER.id, p_ref: "build:" + other + ":pages" }).why, "bind:p_ref", "another job's ref was admitted");
  for (const ref of ["build:" + id + ":pages:2", "build:" + id, "build:" + id + ":refund", "edit:" + id + ":pages", null]) {
    assert.equal(ask({ p_id: id, p_uid: BUILD_USER.id, p_ref: ref }).ok, false, "a ref outside the job's three was admitted: " + ref);
  }
  assert.deepEqual(BUILD_STEP_REFS(id), ["build:" + id + ":deposit", "build:" + id + ":settle", "build:" + id + ":pages"]);
});

test("N2: …and the ledger read-back by ref only for the job's own account and refs", () => {
  const id = "a1b2c3d4e5f60718293a4b5c6d7e8f90";
  const who = { id, uid: BUILD_USER.id, slug: "harbour-loaf" };
  const q = (uid, ref) => "uid=eq." + uid + "&ref=eq." + encodeURIComponent(ref) + "&delta=lt.0&select=delta,reason";
  assert.equal(sbDecision(who, "GET", "/rest/v1/credit_events", q(BUILD_USER.id, "build:" + id + ":pages"), "", "m").ok, true);
  assert.equal(sbDecision(who, "GET", "/rest/v1/credit_events", q("someone-else", "build:" + id + ":pages"), "", "m").ok, false);
  assert.equal(sbDecision(who, "GET", "/rest/v1/credit_events", q(BUILD_USER.id, "build:f1b2c3d4e5f60718293a4b5c6d7e8f90:pages"), "", "m").ok, false);
  assert.equal(sbDecision(who, "GET", "/rest/v1/credit_events", "uid=eq." + BUILD_USER.id, "", "m").ok, false, "an unscoped ledger read was admitted");
  assert.equal(sbDecision(who, "POST", "/rest/v1/credit_events", "", "{}", "m").ok, false);
});
