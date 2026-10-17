// A CONTAINER JOB'S DRAFT, THROUGH THE REAL GATEWAY (2026-10-16, Codex's
// review of `668ebc87`).
//
// Codex reproduced every container job's draft failing at the wall: the job's
// own `site-drafts/<slug>.json`, `site-drafts/<slug>/held/<id>.json`,
// `site-drafts/<slug>/held-sum.json` and `preview-up/<slug>.json` all answered
// 403 through `GatewayBucket` → `gatewayHandler`, so `saveAsDraft` returned
// "draft: gateway get 403", `hold.flush` failed and `markPreviewUp` answered
// false. Every case here goes through the real shim and the real handler.
//   JGD1 the wall, by rule: exactly the job's own draft records — the record,
//        a journal by its 24-hex id, the cumulative record, the preview's
//        confirmation, a script note by its UUID; never another site's (a
//        name that merely starts the same included), never a pre-scoped
//        job's, never the publication's journal, never a malformed id
//   JGD2 a save through the gateway: the draft record, the held journal, the
//        cumulative record and the preview's confirmation are written; the
//        live pointer is untouched; conditional writes keep their meaning
//        across the wire (a create-only write over an existing object and a
//        write on a stale etag both answer null, never overwrite)
//   JGD3 another site's records through the same token: 403, nothing written
//   JGD4 a Build after scoping: pre-scoped, its site's draft is refused; the
//        scope op re-mints the token for a free name (a taken one is refused);
//        then the Build's own resume saves revision 1 as a draft through the
//        gateway — no pointer, the preview confirmed, nothing refused
//   JGD5 a malformed cumulative record through the gateway: the first read
//        recovers every unpublished op from the journals and replaces the
//        record on its etag; the next read uses it — no journal read — and
//        holds the same ops
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { blockNetwork } from "./fixtures/no-network.mjs";
import { gatewayBucketFor } from "./fixtures/job-gateway-wire.mjs";
import { allowedJobKey, allowedJobPrefix, ownBuildMarker, preScopeSlug } from "../builder/job-gateway.mjs";
import {
  DRAFT_KEY, HELD_KEY, HELD_SUM_KEY, PREVIEW_UP_KEY, PREVIEW_CLAIMS_PREFIX, PUBLISHING_KEY,
  saveAsDraft, readDraft, newHold, sealHeldRevision, unpublishedOps, markPreviewUp, readPreviewUp,
} from "../site-draft.mjs";
import { buildBucket, GOOD_DESIGN, BUILD_USER, BRIEF } from "./fixtures/build-route.mjs";
import { installCompiler, dispatchEnv, isDispatchUpload, dispatchOk } from "./fixtures/cf-containers.mjs";
import { loadWorkerModule, makeCtx } from "./fixtures/worker-harness.mjs";
import { makeContainerEnv } from "../builder/container-env.mjs";
import { jobKey, packJob, resultKey } from "../builder/build-job.mjs";

blockNetwork();

const SLUG = "fold-lane";
const ID = "a1b2c3d4e5f60718293a4b5c6d7e8f90";
const V0 = "01790000000000-aaaaaa", V1 = "01790000000001-bbbbbb";
const J24 = "0123456789abcdef01234567";

/** A bucket as R2 behaves for these calls: etags, both conditions, `head`, bytes or text, a listing. */
function r2() {
  const m = new Map();
  const etagOf = (b) => createHash("md5").update(b).digest("hex");
  const bytes = async (v) => (v instanceof Uint8Array ? new Uint8Array(v) : v instanceof ArrayBuffer ? new Uint8Array(v) : typeof v === "string" ? new TextEncoder().encode(v) : v && typeof v.getReader === "function" ? new Uint8Array(await new Response(v).arrayBuffer()) : new Uint8Array(0));
  const obj = (k, o, withBody) => ({
    key: k, etag: o.etag, httpEtag: '"' + o.etag + '"', size: o.b.length, uploaded: new Date(o.at), httpMetadata: { ...o.http }, customMetadata: { ...o.meta },
    ...(withBody ? { body: new Response(o.b.slice()).body, text: async () => new TextDecoder().decode(o.b), arrayBuffer: async () => o.b.slice().buffer } : {}),
  });
  let at = Date.now();
  return {
    m, gets: [],
    async get(k) { this.gets.push(k); const o = m.get(k); return o ? obj(k, o, true) : null; },
    async head(k) { const o = m.get(k); return o ? obj(k, o, false) : null; },
    async put(k, v, opts = {}) {
      const c = opts.onlyIf || {};
      const cur = m.get(k);
      if (c.etagDoesNotMatch === "*" && cur) return null;
      if (typeof c.etagMatches === "string" && (!cur || cur.etag !== c.etagMatches.replace(/"/g, ""))) return null;
      const b = await bytes(v);
      m.set(k, { b, etag: etagOf(Buffer.concat([Buffer.from(b), Buffer.from(String(++at))])), at, http: opts.httpMetadata || {}, meta: opts.customMetadata || {} });
      return obj(k, m.get(k), false);
    },
    async delete(k) { for (const x of Array.isArray(k) ? k : [k]) m.delete(x); },
    async list({ prefix = "" } = {}) { return { objects: [...m.keys()].filter((k) => k.startsWith(prefix)).sort().map((k) => obj(k, m.get(k), false)), truncated: false }; },
    text(k) { const o = m.get(k); return o ? new TextDecoder().decode(o.b) : null; },
  };
}
/** The draft functions' storage over a bucket, as the Worker's `buildDeps` is: a create-only write is conditional on what stands. */
function depsOver(b) {
  return {
    put: (k, body, ct, onlyIf) => b.put(k, body, { httpMetadata: { contentType: ct || "application/octet-stream" }, ...(onlyIf ? { onlyIf } : {}) }),
    get: (k) => b.get(k),
    list: async (prefix) => (await b.list({ prefix })).objects,
    remove: (k) => b.delete(k),
  };
}

test("JGD1 THE WALL, BY RULE — exactly the job's own draft records; never another site's, a pre-scoped job's, the publication's journal, or a malformed key", () => {
  const own = [DRAFT_KEY(SLUG), HELD_KEY(SLUG, J24), HELD_SUM_KEY(SLUG), PREVIEW_UP_KEY(SLUG), PREVIEW_CLAIMS_PREFIX(SLUG) + "0179060000000-abcdef012345.json", "scriptpending/" + SLUG + "/0f8fad5b-d9cb-469f-a165-70867728950e.json"];
  for (const k of own) assert.equal(allowedJobKey(SLUG, ID, k), true, "the job may not touch its own " + k);
  const refused = [
    DRAFT_KEY("fold-lane-2"), HELD_KEY("fold-lane-2", J24), HELD_SUM_KEY("fold-lane-2"), PREVIEW_UP_KEY("fold-lane-2"),
    "site-drafts/fold-lane-2.json", "site-drafts/fold.json", "site-drafts/" + SLUG + "/held/" + J24.slice(1) + ".json", "site-drafts/" + SLUG + "/held/" + J24.toUpperCase() + ".json",
    "site-drafts/" + SLUG + "/held/" + J24 + ".json.bak", "site-drafts/" + SLUG + "/held/x/" + J24 + ".json", "site-drafts/" + SLUG + "/held/../" + SLUG + ".json",
    "site-drafts/" + SLUG + "/replacing/abc.json", "site-drafts/" + SLUG + "/other.json", PUBLISHING_KEY(SLUG), "site-publishing/" + SLUG + "/x.json",
    "preview-up/" + SLUG + "-2.json", "scriptpending/" + SLUG + "/not-a-uuid.json", "scriptpending/fold-lane-2/0f8fad5b-d9cb-469f-a165-70867728950e.json", "scriptpending/" + SLUG + ".json",
  ];
  for (const k of refused) assert.equal(allowedJobKey(SLUG, ID, k), false, "the wall let through " + k);
  // A PRE-SCOPED JOB (a first build with no name yet) has no site's records at all.
  for (const k of own) assert.equal(allowedJobKey(preScopeSlug(ID), ID, k, true), false, "a pre-scoped job may touch " + k);
  assert.equal(allowedJobKey(preScopeSlug(ID), ID, DRAFT_KEY(preScopeSlug(ID)), true), false);
  // A BUILD'S OWN MARKER: this job's id under its token's own uid, nothing else.
  const who = { id: ID, slug: SLUG, uid: "u-owner-1" };
  assert.equal(ownBuildMarker(who, "builds-live/u-owner-1/" + ID + ".json"), true);
  assert.equal(ownBuildMarker(who, "builds-live/u-owner-1/" + ID + ".done.json"), true);
  for (const k of ["builds-live/u-other/" + ID + ".json", "builds-live/u-owner-1/b" + ID.slice(1) + ".json", "builds-live/u-owner-1/chat-x.json", "builds-live/u-owner-1/" + ID + ".json.x", "builds-live/u-owner-1/"]) assert.equal(ownBuildMarker(who, k), false, "a job may touch " + k);
  assert.equal(ownBuildMarker({ id: ID, slug: SLUG }, "builds-live/undefined/" + ID + ".json"), false, "a token with no uid opened a marker");
  // LISTING: its own site's notes and claims; nobody else's, never the roots.
  assert.equal(allowedJobPrefix(SLUG, ID, "scriptpending/" + SLUG + "/"), true);
  assert.equal(allowedJobPrefix(SLUG, ID, PREVIEW_CLAIMS_PREFIX(SLUG)), true);
  for (const p of ["scriptpending/", "scriptpending/fold-lane-2/", "site-drafts/", "site-drafts/" + SLUG + "/", "preview-up/", "preview-claims/"]) assert.equal(allowedJobPrefix(SLUG, ID, p), false, "a job may list " + p);
});

test("JGD2 A SAVE THROUGH THE GATEWAY — the draft record, the held journal, the cumulative record and the preview's confirmation are written; the live pointer is not; conditional writes keep their meaning across the wire", async () => {
  const b = r2();
  await b.put("current/" + SLUG + ".json", JSON.stringify({ version: V0 }));
  const pointer0 = b.text("current/" + SLUG + ".json");
  const gw = await gatewayBucketFor({ bucket: b, id: ID, slug: SLUG });
  const deps = depsOver(gw.bucket);
  // HELD CHANGES, FLUSHED AND SEALED AS A JOB DOES.
  const h = newHold(deps, SLUG);
  h.add({ kind: "row", table: "loaves", op: "insert", values: { name: "Spelt" } });
  const held = await h.flush();
  assert.ok(held && held.id, "the journal could not be written through the gateway");
  const sealed = await sealHeldRevision(deps, SLUG, { held, liveVersion: V0 });
  assert.equal(sealed.ok, true, JSON.stringify(sealed));
  // A CODE SAVE WITH ITS PREVIEW, confirmed and recorded.
  let uploaded = null;
  const saved = await saveAsDraft(deps, { slug: SLUG, version: V1, base: V0, job: ID, preview: async (rec) => { uploaded = rec.version; return { ok: true }; }, repreview: async () => ({ ok: true }) });
  assert.equal(saved.ok, true, "the save failed through the gateway: " + JSON.stringify(saved).slice(0, 300));
  assert.deepEqual([uploaded, saved.previewed && saved.previewed.ok], [V1, true], JSON.stringify(saved.previewed));
  assert.deepEqual(gw.refused, [], "the wall refused a key the save needs");
  // WRITTEN, AS STORED.
  const d = JSON.parse(b.text(DRAFT_KEY(SLUG)));
  assert.deepEqual([d.version, d.rev, d.revs[0].held], [V1, 2, held.id]);
  assert.ok(b.text(HELD_KEY(SLUG, held.id)), "the journal is not stored");
  assert.equal(JSON.parse(b.text(HELD_SUM_KEY(SLUG))).entries[0].held, held.id, "the cumulative record was not written through the gateway");
  assert.equal(JSON.parse(b.text(PREVIEW_UP_KEY(SLUG))).version, V1, "the preview's confirmation was not recorded through the gateway");
  assert.equal(await markPreviewUp(deps, SLUG, V1), true);
  assert.equal(b.text("current/" + SLUG + ".json"), pointer0, "the live pointer moved");
  // CONDITIONAL WRITES ACROSS THE WIRE: create-only over an existing object, and a stale etag.
  const journalBefore = b.text(HELD_KEY(SLUG, held.id));
  assert.equal(await deps.put(HELD_KEY(SLUG, held.id), "{}", "application/json", { etagDoesNotMatch: "*" }), null, "a create-only write overwrote an existing journal");
  assert.equal(b.text(HELD_KEY(SLUG, held.id)), journalBefore);
  const draftBefore = b.text(DRAFT_KEY(SLUG));
  assert.equal(await deps.put(DRAFT_KEY(SLUG), "{}", "application/json", { etagMatches: "not-the-etag" }), null, "a write on a stale etag overwrote the draft");
  assert.equal(b.text(DRAFT_KEY(SLUG)), draftBefore);
  assert.ok(gw.calls.some((c) => c.status === 412), "no conditional refusal crossed the wire");
});

test("JGD3 ANOTHER SITE'S RECORDS, THROUGH THE SAME TOKEN — every one 403, nothing written", async () => {
  const b = r2();
  const gw = await gatewayBucketFor({ bucket: b, id: ID, slug: SLUG });
  for (const k of [DRAFT_KEY("fold-lane-2"), HELD_KEY("fold-lane-2", J24), HELD_SUM_KEY("fold-lane-2"), PREVIEW_UP_KEY("fold-lane-2"), PUBLISHING_KEY(SLUG)]) {
    await assert.rejects(gw.bucket.put(k, "{}"), (e) => e && e.status === 403, "a write to " + k + " was not refused");
    await assert.rejects(gw.bucket.get(k), (e) => e && e.status === 403, "a read of " + k + " was not refused");
  }
  assert.equal(b.m.size, 0, "something was written");
  assert.equal(gw.refused.length, 10);
});

test("JGD4 A BUILD AFTER SCOPING, IN ITS CONTAINER — pre-scoped, its site's draft is refused and a taken name is refused by the scope op; then a whole Build run by the container's runner (`runContainerJob`, the env `makeContainerEnv` makes, storage through the gateway) names its site mid-build through the scope op and saves revision 1 as a draft: no pointer, the preview confirmed, nothing refused", async () => {
  // THE PRE-SCOPED TOKEN: nothing of any site, and the scope op refuses a stranger's name.
  const b0 = r2();
  const pre = await gatewayBucketFor({ bucket: b0, id: ID, slug: null, owner: async (s) => (s === "taken-name" ? "someone-else" : null) });
  await assert.rejects(pre.bucket.get(DRAFT_KEY(SLUG)), (e) => e && e.status === 403);
  await assert.rejects(pre.bucket.put(PREVIEW_UP_KEY(SLUG), "{}"), (e) => e && e.status === 403);
  const taken = await pre.rescope("taken-name");
  assert.deepEqual([taken.ok, taken.status, taken.body && taken.body.error], [false, 403, "taken"]);
  assert.equal((await pre.rescope(SLUG)).ok, true);
  assert.equal(await pre.bucket.get(DRAFT_KEY(SLUG)), null, "after scoping, its own site's draft is still refused");
  await assert.rejects(pre.bucket.get(DRAFT_KEY("fold-lane-2")), (e) => e && e.status === 403, "scoping opened another site");

  // A WHOLE BUILD IN ITS CONTAINER.
  const FIRST_PAGE = "import { createFileRoute } from '@tanstack/react-router';\nexport const Route = createFileRoute('/')({ component: Page });\nfunction Page() { return (<main><h1>Harbour Loaf</h1><p>Loaves from 7.</p></main>); }\n";
  const b = buildBucket();
  const id = [...crypto.getRandomValues(new Uint8Array(16))].map((x) => x.toString(16).padStart(2, "0")).join("");
  b.store.set(jobKey(id), JSON.stringify(packJob({ url: "https://gofarther.dev/api/site/react-build", auth: "Bearer t", body: JSON.stringify({ brief: BRIEF, images: [], qa: [], chat: "c", picker: "sonnet" }), uid: BUILD_USER.id, at: 1 })));
  const slug = GOOD_DESIGN.slug;
  // AN R2-FAITHFUL VIEW OF THE BUILD'S BUCKET (bytes as text, `head`), for the gateway to stand on.
  const faithful = {
    get: (k) => b.get(k),
    head: async (k) => { const o = await b.get(k); if (!o) return null; const { body, text, json, arrayBuffer, ...rest } = o; return rest; },
    put: async (k, v, opts) => b.put(k, v instanceof ArrayBuffer || v instanceof Uint8Array ? new TextDecoder().decode(v) : v, opts),
    delete: (k) => b.delete(k), list: (o) => b.list(o),
  };
  const gw = await gatewayBucketFor({ bucket: faithful, id, slug: null, uid: BUILD_USER.id });
  const env = makeContainerEnv({ secrets: { DRAFT_FIRST: "on", ANTHROPIC_API_KEY: "k", XAI_API_KEY: "k", NEON_API_KEY: "k", ...dispatchEnv() }, gateway: gw.gateway, fetch: gw.fetch, pre: true });
  // THE PLATFORM'S SUPABASE, stood in directly (the gateway's own `/sb` door is not what this case reads).
  env.SUPABASE_SERVICE_KEY = "svc"; env.CREDITS_MINT_SECRET = "m";
  const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
  let claimed = false;
  const real = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const u = String((input && input.url) || input || "");
    if (u.includes("/auth/v1/user")) return json(BUILD_USER);
    const m = u.match(/\/rest\/v1\/rpc\/(\w+)/);
    if (m) {
      const args = JSON.parse(String((init && init.body) || "{}"));
      if (m[1] === "edit_handoff") return json({ ok: true, state: "claimed", owner: args.p_next, slug: args.p_slug || null, uid: BUILD_USER.id });
      if (m[1] === "build_debit" || m[1] === "credit_debit") return json({ ok: true, taken: 2, balance: 400, repeat: false });
      if (m[1] === "get_credits") return json(400);
      if (m[1] === "use_quota") return json(true);
      return json({ ok: true });
    }
    if (u.includes("/rest/v1/site_backends")) {
      if (String((init && init.method) || "GET").toUpperCase() === "POST") { claimed = true; return json([{ slug, uid: BUILD_USER.id }], 201); }
      return json(claimed ? [{ uid: BUILD_USER.id, neon_db: "", brief: BRIEF }] : []);
    }
    if (u.includes("/v1/messages")) {
      const bd = JSON.parse(String((init && init.body) || "{}"));
      if (bd.tool_choice && bd.tool_choice.name === "design_schema") return json({ stop_reason: "tool_use", content: [{ type: "tool_use", id: "t1", name: "design_schema", input: GOOD_DESIGN }], usage: { input_tokens: 100, output_tokens: 50 } });
      return new Response("stop", { status: 503 });
    }
    if (isDispatchUpload(u)) return dispatchOk();
    if (u.includes("/rest/v1/")) return json([]);
    return new Response("no", { status: 503 });
  };
  const c = installCompiler({ worker: true, model: async () => ({ stop_reason: "tool_use", usage: { input_tokens: 10, output_tokens: 10 }, content: [{ type: "tool_use", id: "w1", name: "write_pages", input: { pages: [{ path: "index.tsx", source: FIRST_PAGE }], notes: "" } }] }) });
  try {
    const mod = await loadWorkerModule();
    const ctx = makeCtx();
    await mod.runContainerJob(env, ctx, { kind: "build", id, holder: "c_consumer1" });
    for (let i = 0; i < 8 && ctx.pending.length; i++) await Promise.allSettled(ctx.pending.splice(0));
  } finally { globalThis.fetch = real; c.uninstall(); }
  const answer = b.store.get(resultKey(id));
  assert.ok(gw.calls.length > 0, "the build made no storage call through the gateway — this case watched nothing");
  assert.deepEqual(gw.refused, [], "the wall refused a key the Build needs");
  assert.ok(gw.calls.some((x) => x.path.endsWith("/scope") && x.status === 200), "the build never named its site through the scope op");
  assert.equal(b.store.has("current/" + slug + ".json"), false, "a Build under draft-first moved the pointer");
  const draftText = b.store.get(DRAFT_KEY(slug));
  assert.ok(draftText, "the Build saved no draft through the gateway: " + String(answer).slice(0, 400));
  const d = JSON.parse(draftText);
  assert.deepEqual([d.rev, d.applied], [1, 0], "the Build did not save revision 1 as an unpublished draft");
  assert.equal(JSON.parse(b.store.get(PREVIEW_UP_KEY(slug))).version, d.version, "the Build's preview was not confirmed through the gateway");
});

test("JGD5 A MALFORMED CUMULATIVE RECORD, THROUGH THE GATEWAY — the first read recovers every unpublished op from the journals and replaces the record on its etag; the next read uses it, with no journal read, and holds the same ops", async () => {
  const b = r2();
  const gw = await gatewayBucketFor({ bucket: b, id: ID, slug: SLUG });
  const deps = depsOver(gw.bucket);
  for (let i = 1; i <= 100; i++) {
    const h = newHold(deps, SLUG);
    h.add({ kind: "row", table: "loaves", op: "insert", values: { name: "Loaf " + i } });
    assert.equal((await sealHeldRevision(deps, SLUG, { held: await h.flush(), liveVersion: V0 })).ok, true);
  }
  // THE RECORD GOES BAD (a truncated write, a hand edit): an object that will not parse.
  await b.put(HELD_SUM_KEY(SLUG), "{\"v\":1,\"entries\":[");
  const { draft } = await readDraft(deps, SLUG);
  const journals = (from) => b.gets.slice(from).filter((k) => k.includes("/held/")).length;
  let g = b.gets.length;
  const first = await unpublishedOps(deps, SLUG, draft);
  assert.equal(first.length, 100);
  assert.deepEqual(first.map((o) => o.values.name), Array.from({ length: 100 }, (_, i) => "Loaf " + (i + 1)), "an unpublished op was lost in the recovery");
  assert.equal(journals(g), 100, "the first read did not recover from the journals");
  const repaired = JSON.parse(b.text(HELD_SUM_KEY(SLUG)));
  assert.equal(repaired.entries.length, 100, "the malformed record was not replaced");
  g = b.gets.length;
  const second = await unpublishedOps(deps, SLUG, draft);
  assert.deepEqual(second, first, "the repaired record does not hold the same ops");
  assert.equal(journals(g), 0, "the next read did not use the repaired record");
  assert.deepEqual(gw.refused, []);
});
