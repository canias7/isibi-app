// PARKED (2026-11-03, park-old-way): the old-way half of test/job-gateway-draft.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
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
import { blockNetwork } from "../../../test/fixtures/no-network.mjs";
import { gatewayBucketFor } from "../../../test/fixtures/job-gateway-wire.mjs";
import { allowedJobKey, allowedJobPrefix, ownBuildMarker, ownAccountKey, preScopeSlug, readableJobKey } from "../../../builder/job-gateway.mjs";
import { recordKey } from "../../../builder/request.mjs";
import { turnKey } from "../../../builder/publish-turn.mjs";
import {
  DRAFT_KEY, HELD_KEY, HELD_SUM_KEY, PREVIEW_UP_KEY, PREVIEW_CLAIMS_PREFIX, PUBLISHING_KEY,
  saveAsDraft, readDraft, newHold, sealHeldRevision, unpublishedOps, markPreviewUp, readPreviewUp,
} from "../../../site-draft.mjs";
import { buildBucket, GOOD_DESIGN, BUILD_USER, BRIEF } from "../../../test/fixtures/build-route.mjs";
import { installCompiler, dispatchEnv, isDispatchUpload, dispatchOk } from "../../../test/fixtures/cf-containers.mjs";
import { loadWorkerModule, makeCtx } from "../../../test/fixtures/worker-harness.mjs";
import { makeContainerEnv, gatewayFetch } from "../../../builder/container-env.mjs";
import { jobKey, packJob, resultKey } from "../../../builder/build-job.mjs";

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

test("JGD5 A FIRST BUILD IN ITS CONTAINER, SUPABASE THROUGH THE GATEWAY'S OWN DOOR (audit A01-1, A08-3, S1-3) — the account already holds the name the designer picks, from another chat: the build asks its chat's site and the name's owner through the gateway (its own account's rows, the existence read), moves to the next free name, claims and saves that — never a revise of the other site — and the gateway refuses nothing", async () => {
  const FIRST_PAGE = "import { createFileRoute } from '@tanstack/react-router';\nexport const Route = createFileRoute('/')({ component: Page });\nfunction Page() { return (<main><h1>Harbour Loaf</h1><p>Loaves from 7.</p></main>); }\n";
  const b = buildBucket();
  const id = [...crypto.getRandomValues(new Uint8Array(16))].map((x) => x.toString(16).padStart(2, "0")).join("");
  b.store.set(jobKey(id), JSON.stringify(packJob({ url: "https://gofarther.dev/api/site/react-build", auth: "Bearer t", body: JSON.stringify({ brief: BRIEF, images: [], qa: [], chat: "chat-bbbbbbbb", picker: "sonnet" }), uid: BUILD_USER.id, at: 1 })));
  const held = GOOD_DESIGN.slug, fresh = held + "-2";
  const faithful = {
    get: (k) => b.get(k),
    head: async (k) => { const o = await b.get(k); if (!o) return null; const { body, text, json, arrayBuffer, ...rest } = o; return rest; },
    put: async (k, v, opts) => b.put(k, v instanceof ArrayBuffer || v instanceof Uint8Array ? new TextDecoder().decode(v) : v, opts),
    delete: (k) => b.delete(k), list: (o) => b.list(o),
  };
  const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
  const sbSeen = [];
  const claims = [];
  // THE PLATFORM'S SUPABASE, as the gateway reaches it with the service key.
  const supabase = async (input, init) => {
    const u = new URL(String((input && input.url) || input || ""));
    const method = String((init && init.method) || "GET").toUpperCase();
    sbSeen.push(method + " " + u.pathname + u.search);
    const m = u.pathname.match(/\/rest\/v1\/rpc\/(\w+)/);
    if (m) {
      const args = JSON.parse(String((init && init.body) || "{}"));
      if (m[1] === "edit_handoff") return json({ ok: true, state: "claimed", owner: args.p_next, slug: args.p_slug || null, uid: BUILD_USER.id });
      if (m[1] === "build_debit" || m[1] === "credit_debit") return json({ ok: true, taken: 2, balance: 400, repeat: false });
      if (m[1] === "get_credits") return json(400);
      if (m[1] === "use_quota") return json(true);
      return json({ ok: true });
    }
    if (u.pathname.endsWith("/site_backends")) {
      if (method === "POST") { const row = JSON.parse(String(init.body)); claims.push(row.slug); return json([{ slug: row.slug, uid: BUILD_USER.id }], 201); }
      const q = (k) => (u.searchParams.get(k) || "").replace(/^eq\./, "");
      const rows = [{ slug: held, uid: BUILD_USER.id, chat_id: "chat-aaaaaaaa", neon_db: "", brief: "the other site" }, ...claims.map((s) => ({ slug: s, uid: BUILD_USER.id, chat_id: "chat-bbbbbbbb", neon_db: "", brief: BRIEF }))];
      const hit = rows.filter((r) => (!u.searchParams.has("slug") || r.slug === q("slug")) && (!u.searchParams.has("uid") || r.uid === q("uid")) && (!u.searchParams.has("chat_id") || r.chat_id === q("chat_id")));
      const sel = (u.searchParams.get("select") || "uid,neon_db,brief,slug").split(",");
      return json(hit.map((r) => Object.fromEntries(sel.map((c) => [c, r[c]]))));
    }
    if (u.pathname.endsWith("/credits")) return json([{ balance: 400 }]);
    if (u.pathname.includes("/rest/v1/")) return json([]);
    return new Response("no", { status: 503 });
  };
  const gw = await gatewayBucketFor({ bucket: faithful, id, slug: null, uid: BUILD_USER.id, owner: async (s) => (s === held || s === fresh ? BUILD_USER.id : null),
    sb: { url: "https://sb.example.co", key: "svc", mint: "m", fetch: supabase } });
  const env = makeContainerEnv({ secrets: { DRAFT_FIRST: "on", ANTHROPIC_API_KEY: "k", XAI_API_KEY: "k", NEON_API_KEY: "k", ...dispatchEnv() }, gateway: gw.gateway, sb: { url: "https://ujrqdmmtcptvimazlhom.supabase.co" }, fetch: gw.fetch, pre: true });
  const real = globalThis.fetch;
  const outside = async (input, init) => {
    const u = String((input && input.url) || input || "");
    if (u.startsWith("https://gofarther.dev/api/job/")) return gw.fetch(u, init);
    if (u.includes("/auth/v1/user")) return json(BUILD_USER);
    if (u.includes("/v1/messages")) {
      const bd = JSON.parse(String((init && init.body) || "{}"));
      if (bd.tool_choice && bd.tool_choice.name === "design_schema") return json({ stop_reason: "tool_use", content: [{ type: "tool_use", id: "t1", name: "design_schema", input: GOOD_DESIGN }], usage: { input_tokens: 100, output_tokens: 50 } });
      return new Response("stop", { status: 503 });
    }
    if (isDispatchUpload(u)) return dispatchOk();
    return new Response("no", { status: 503 });
  };
  globalThis.fetch = gatewayFetch({ gateway: gw.gateway, sbUrl: "https://ujrqdmmtcptvimazlhom.supabase.co", fetch: outside });
  const c = installCompiler({ worker: true, model: async () => ({ stop_reason: "tool_use", usage: { input_tokens: 10, output_tokens: 10 }, content: [{ type: "tool_use", id: "w1", name: "write_pages", input: { pages: [{ path: "index.tsx", source: FIRST_PAGE }], notes: "" } }] }) });
  try {
    const mod = await loadWorkerModule();
    const ctx = makeCtx();
    await mod.runContainerJob(env, ctx, { kind: "build", id, holder: "c_consumer1" });
    for (let i = 0; i < 8 && ctx.pending.length; i++) await Promise.allSettled(ctx.pending.splice(0));
  } finally { globalThis.fetch = real; c.uninstall(); }
  const refusedSb = gw.calls.filter((x) => x.status === 403 && x.path.includes("/sb/"));
  assert.ok(sbSeen.length > 0, "no Supabase call crossed the gateway's door — this case watched nothing");
  assert.ok(sbSeen.some((x) => x.includes("chat_id=eq.chat-bbbbbbbb")), "the build never asked its chat's site through the gateway");
  assert.deepEqual(refusedSb, [], "the gateway refused a Supabase call the Build needs: " + JSON.stringify(refusedSb));
  assert.deepEqual(gw.refused, [], "the wall refused a key the Build needs");
  assert.deepEqual(claims, [fresh], "the build did not move to the next free name — it would have revised the account's other site: " + JSON.stringify({ claims, answer: String(b.store.get(resultKey(id))).slice(0, 300) }));
  assert.ok(b.store.get(DRAFT_KEY(fresh)), "the build saved no draft under its fresh name");
  assert.equal(b.store.get(DRAFT_KEY(held)), undefined, "the build wrote over the account's other site's draft");
});

import { holdMedia, releaseMedia } from "../../../site-media.mjs";
import { ledgerWriteAllowed } from "../../../builder/job-gateway.mjs";
