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
import { attachedNames, placeAttachedPhotos, ownPhotoSentence } from "../builder/attached-photos.mjs";
import { lostBuildVerdict, LOST_SITE_MSG } from "../builder/build-lease.mjs";
import { packResume, resumeKey, attachmentsKey, genKey, RESUME_KIND } from "../builder/build-resume.mjs";
import { resultKey, jobKey, packJob, JOB_KIND } from "../builder/build-job.mjs";
import { errorCitations, salvageable, salvagePlan } from "../builder/publish-pages.mjs";
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

test("H6: a photograph the designer ties to an attached file is stored as an owner upload, and the plan points at it", async () => {
  const design = { ...GOOD_DESIGN, images: [{ page: "/", describe: "the shop front", attached: "shop.jpg" }, { page: "/", describe: "a loaf at dawn" }] };
  const r = await driveBuild({ design: { input: design }, body: body({ brief: BRIEF + " Put my photo of the shop on the home page.", images: [{ name: "shop.jpg", data: JPEG_DATA }] }) });
  const uploads = [...r.store.keys()].filter((k) => k.startsWith("uploads/harbour-loaf/"));
  assert.equal(uploads.length, 1, "the attached photograph was not stored: " + [...r.store.keys()].join(","));
  assert.match(uploads[0], /^uploads\/harbour-loaf\/[0-9a-f]{32}\.jpg$/);
  const own = r.config.look.images[0];
  assert.equal(own.src, "/u/harbour-loaf/" + uploads[0].split("/").pop(), "the plan does not point at the stored file");
  assert.equal(r.config.look.images[1].src, undefined, "a drawn photograph was given a src");
  assert.deepEqual(r.reply.ownPhotos.placed.map((p) => p.name), ["shop.jpg"]);
  assert.match(r.seen.designer[0], /THE FILES THE CUSTOMER ATTACHED[\s\S]*shop\.jpg[\s\S]*REFERENCE unless/, "the designer was not told the files by name");
});

test("H6: a name that matches no attached image is told, never bought and never stored", async () => {
  const design = { ...GOOD_DESIGN, images: [{ page: "/", describe: "x", attached: "nope.jpg" }] };
  const r = await driveBuild({ design: { input: design }, body: body({ images: [{ name: "shop.jpg", data: JPEG_DATA }] }) });
  assert.equal([...r.store.keys()].filter((k) => k.startsWith("uploads/")).length, 0);
  assert.deepEqual(r.config.look.images, [], "the unmatched entry was kept as a photograph to buy");
  assert.equal(r.reply.ownPhotos.missing[0].name, "nope.jpg");
  assert.match(r.reply.contextNote, /couldn't put nope\.jpg on \//);
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
  const r = await placeAttachedPhotos(
    [{ page: "/", describe: "a", attached: "a.jpg" }, { page: "/b", describe: "b", attached: "a.jpg" }, { page: "/", describe: "drawn" }, { page: "/", describe: "kept", attached: "a.jpg", src: "/u/s/0123456789abcdef0123456789abcdef.jpg" }],
    [{ name: "a.jpg", data: JPEG_DATA }],
    async (name) => { stored.push(name); return { url: "/u/s/ffffffffffffffffffffffffffffffff.jpg" }; },
  );
  assert.deepEqual(stored, ["a.jpg"], "one file was stored twice");
  assert.equal(r.images.length, 4);
  assert.equal(r.images[2].src, undefined);
  assert.equal(r.images[3].src, "/u/s/0123456789abcdef0123456789abcdef.jpg", "an earlier build's src was replaced");
  assert.deepEqual(attachedNames([{ name: "m.pdf", data: "data:application/pdf;base64,AAAA" }, { name: "t.txt", text: "hi" }]).map((f) => f.kind), ["document", "text"]);
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
    assert.deepEqual(seen.map((x) => x.fn), ["credit_debit", "build_debit"]);
    const bd = seen[1];
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
    assert.deepEqual(seen.map((x) => x.fn), ["credit_debit"], "a live bearer was not used, or build_debit ran beside it");
  } finally { restore(); }
  seen = [];
  restore = stubRpc({ credit_debit: new Response("{}", { status: 401 }) }, seen);
  try {
    await assert.rejects(() => buildLedger(env, who).debit(2, "build:a1b2c3d4e5f60718293a4b5c6d7e8f90:deposit"), /credit_debit rpc 401/);
    assert.deepEqual(seen.map((x) => x.fn), ["credit_debit", "build_debit"]);
  } finally { restore(); }
  seen = [];
  restore = stubRpc({ credit_debit: new Response("timeout", { status: 504 }) }, seen);
  try {
    await assert.rejects(() => buildLedger(env, who).debit(2, "build:a1b2c3d4e5f60718293a4b5c6d7e8f90:deposit"), /504/);
    assert.deepEqual(seen.map((x) => x.fn), ["credit_debit"], "a debit that may have landed was charged a second way");
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

async function driveExpiredConsumer(rowUid) {
  const id = "a1b2c3d4e5f60718293a4b5c6d7e8f90";
  const store = new Map([[jobKey(id), JSON.stringify(packJob({ url: "https://gofarther.dev/api/site/react-build", auth: "Bearer expired", body: JSON.stringify({ brief: "a coffee shop" }), uid: BUILD_USER.id, at: 1 }))]]);
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

const LOST_ID = "b1b2c3d4e5f60718293a4b5c6d7e8f90";
async function reconcileWith({ row, pointer, reverse = () => ({ ok: true, refunded: 2, already: 0, debited: 2, repeat: false }), store = null }) {
  const { reconcileLostBuilds } = await loadWorkerModule();
  const b = store || buildBucket();
  if (pointer === "throws") b.get = (async (orig) => async (k) => { if (k.startsWith("current/")) throw new Error("r2 down"); return orig(k); })(b.get.bind(b));
  else if (pointer) b.store.set("current/" + row.slug + ".json", JSON.stringify(pointer));
  const seen = [];
  const restore = stubRpc({ credit_reverse: reverse, __rest: (u) => (u.includes("/rest/v1/edit_jobs") ? new Response(JSON.stringify([row]), { status: 200 }) : null) }, seen);
  try {
    const out = await reconcileLostBuilds({ SUPABASE_SERVICE_KEY: "svc", CREDITS_MINT_SECRET: "mint", SITES_BUCKET: b }, { now: Date.parse("2026-10-08T12:00:00Z") });
    const res = b.store.get(resultKey(row.id));
    return { out, seen, store: b, answer: res ? JSON.parse(JSON.parse(res).body) : null, status: res ? JSON.parse(res).status : null };
  } finally { restore(); }
}
const lostRow = (over = {}) => ({ id: LOST_ID, uid: BUILD_USER.id, slug: "harbour-loaf", op: "build", state: "lost", created_at: "2026-10-08T11:00:00Z", updated_at: "2026-10-08T11:10:00Z", ...over });

test("H1: the row's own sentence no longer claims nothing was charged", () => {
  assert.doesNotMatch(LOST_SITE_MSG, /weren't charged|not charged|nothing was charged/i);
  assert.match(LOST_SITE_MSG, /stand-in page at your address/);
});

test("H1: a lost build that never published has every one of its refs reversed, and its answer says what came back", async () => {
  const r = await reconcileWith({ row: lostRow(), pointer: null });
  assert.deepEqual(r.seen.filter((x) => x.fn === "credit_reverse").map((x) => x.args.p_ref.split(":").pop() + "/" + x.args.p_reason), ["deposit/lost", "settle/lost", "pages/lost"]);
  assert.equal(r.answer.refunded, 6);
  assert.equal(r.answer.cost, 0);
  assert.equal(r.answer.page, "placeholder");
  assert.match(r.answer.msg, /\(6 credits\) has been returned/);
  assert.equal(r.status, 200);
});

test("H1: …and recovery run again moves nothing more and does not rewrite the answer", async () => {
  const first = await reconcileWith({ row: lostRow(), pointer: null });
  first.store.store.delete(resultKey(LOST_ID)); // the browser collected it
  const again = await reconcileWith({ row: lostRow(), pointer: null, store: first.store });
  assert.equal(again.seen.filter((x) => x.fn === "credit_reverse").length, 0, "a second pass reversed again");
  assert.equal(again.answer, null, "a second pass wrote a new answer");
});

test("H1: a lost build whose site went live keeps what it charged, and says the site is live", async () => {
  const r = await reconcileWith({ row: lostRow(), pointer: { version: "01791429280760-09n7s1", activatedAt: "2026-10-08T11:05:00Z" } });
  assert.equal(r.seen.filter((x) => x.fn === "credit_reverse").length, 0, "a published build was refunded");
  assert.equal(r.answer.ok, true);
  assert.equal(r.answer.page, "app");
  assert.match(r.answer.msg, /did go live/);
});

test("H1: a pointer older than the build is not this build's publish — the attempt is refunded", async () => {
  const r = await reconcileWith({ row: lostRow(), pointer: { version: "01791429280760-09n7s1", activatedAt: "2026-10-01T09:00:00Z" } });
  assert.equal(r.seen.filter((x) => x.fn === "credit_reverse").length, 3);
  assert.equal(r.answer.page, "placeholder");
});

test("H1: an unreadable pointer moves no money and writes no answer — the next tick asks again", async () => {
  const r = await reconcileWith({ row: lostRow(), pointer: "throws" });
  assert.equal(r.seen.filter((x) => x.fn === "credit_reverse").length, 0);
  assert.equal(r.answer, null);
  assert.equal(r.out.unknown, 1);
});

test("H1: a reversal that cannot be made is said, left open, and finished by a later pass without returning twice", async () => {
  let down = true;
  const first = await reconcileWith({ row: lostRow(), pointer: null, reverse: () => (down ? new Response("down", { status: 500 }) : { ok: true, refunded: 2, already: 0, debited: 2, repeat: false }) });
  assert.equal(first.answer.refundShort, true);
  assert.match(first.answer.msg, /hasn't gone through yet/);
  down = false;
  const again = await reconcileWith({ row: lostRow(), pointer: null, store: first.store, reverse: () => ({ ok: true, refunded: 2, already: 0, debited: 2, repeat: false }) });
  assert.equal(again.answer.refunded, 6);
  assert.equal(again.answer.refundShort, undefined);
  const third = await reconcileWith({ row: lostRow(), pointer: null, store: again.store });
  assert.equal(third.seen.filter((x) => x.fn === "credit_reverse").length, 0, "a settled build was reversed a third time");
});

test("H1: a lost first build that never had an address answers 410, refunded", async () => {
  const r = await reconcileWith({ row: lostRow({ slug: "build:" + LOST_ID }), pointer: undefined });
  assert.equal(r.status, 410);
  assert.equal(r.answer.refunded, 6);
  assert.equal(lostBuildVerdict({ row: { slug: "build:x" } }).outcome, "not-published");
});

test("H1: the sweep runs the reconcile after the SQL sweep, every tick", () => {
  const at = W.indexOf("export async function runLostEditJobs(");
  const sweep = W.indexOf('editRpc(env, "edit_sweep_lost"', at);
  const rec = W.indexOf("await reconcileLostBuilds(env)", at);
  assert.ok(at > 0 && sweep > at && rec > sweep, "the lost-build reconcile is not run after the SQL sweep");
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

test("M7: a refired build reads back the files the customer attached, for the page writer it runs again", async () => {
  const id = "c1b2c3d4e5f60718293a4b5c6d7e8f90";
  const files = [{ type: "image", source: { type: "base64", media_type: "image/jpeg", data: "/9j/AAAA" } }];
  const design = { slug: "hearth-paper", brand: "Hearth", brief: "b", siteDescription: "d", theme: "ink-and-linen", lang: "en", langs: [], spec: { tables: [] }, plan: { pages: [{ path: "index.tsx" }] }, picker: "grok", attachments: [], attachmentsHeld: 1, attachmentsSent: 1 };
  const record = packResume({ id, auth: "", uid: BUILD_USER.id, slug: "hearth-paper", lane: "site-hearth-paper", genId: "gen-1", report: "0f1e2d3c4b5a69788796a5b4c3d2e1f0", firedAt: Date.now() - 600_000, charged: ["deposit", "schema"], looks: 3, refires: 0, steps: [], design });
  // A GENERATION THAT FAILED BEFORE IT LEFT (no status): `resumeDecision`
  // answers `refire`, the one branch that writes the pages again.
  const b = buildBucket({ [resumeKey(id)]: JSON.stringify(record), [attachmentsKey(id)]: JSON.stringify(files), [genKey("0f1e2d3c4b5a69788796a5b4c3d2e1f0")]: JSON.stringify({ state: "failed", message: "the request never left" }) });
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
  assert.ok(got.includes(attachmentsKey(id)), "a refire never read the kept files back — it ran with none: " + got.join(","));
  // AND WHAT CAME BACK IS ON THE BUILD'S OWN RECORD: sent 1, back 1.
  assert.ok(rows.some((r) => /"attachments"[^}]*"sent":1[^}]*"back":1|"n":"attachments"[^}]*"sent":1,"back":1/.test(r)), "the refire's trace does not say the files came back: " + rows.join("\n").slice(0, 400));
});

test("M7: the first invocation keeps the files beside the record, and every record delete takes them too", () => {
  const blank = (s) => s.split("\n").map((l) => (/^\s*\/\//.test(l) ? "" : l)).join("\n");
  const code = blank(W);
  assert.match(code, /await env\.SITES_BUCKET\.put\(attachmentsKey\(jobId\), JSON\.stringify\(held\)\)/);
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
