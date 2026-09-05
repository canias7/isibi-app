// ACKNOWLEDGMENT LOST VERSUS SUPERSEDED (stage 3b, 2026-09-05, owner: "ok go").
//
// A job that began publishing and never recorded its commit sits in review
// with the money untouched and the site closed to edits, until a person says
// kept or refunded. Stage 7 made that decidable by comparison — the pointer,
// the live script's own stamps, the job's staged version — and this stage
// forms the verdict in `builder/site-reconcile.mjs`, reads the facts in the
// Worker, retries a lost upload from the immutable prefix, and applies the
// answer through `edit_reconcile` at three doors: the consumer the moment its
// refund answers needs-review, the sweep tick over every row under review, and
// the owner's route. The browser also says "waiting" on a deferred poll.
//
// THE DATABASE HALF — a reply stored on a row edit_reconcile just failed, a
// kept row's recovered reply readable as the route reads it — is driven by
// scripts/edit-rpc-check.sql section 22 on the live database; this file holds
// the record of that. Everything else is DRIVEN: the verdict with literal facts,
// the probe with a fake stub, the Worker's reconcile through the real module
// against a fake bucket laid out as a staged site, a fake dispatch namespace
// and stubbed RPCs, the consumer through the real queue handler, the route
// through the real router, the browser's poll module through its export. Reads
// are kept for the hops a drive cannot see, anchored on order and absence.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import { hit, loadWorker, loadWorkerModule, makeCtx } from "./fixtures/worker-harness.mjs";
import {
  reconcileVerdict, findMine, ancestry, newerVersion, reconcileReply, publicFacts,
  RECONCILE_KINDS, RECONCILE_RETRY_MAX, NEVER_LIVE_MSG, OVERTAKEN_MSG,
} from "../builder/site-reconcile.mjs";
import { probeSiteWorker } from "../builder/site-dispatch.mjs";
import { listBuilds, POINTER_KEY, buildPrefix, MANIFEST_FILE, SERVER_FILE } from "../site-builds.mjs";
import { versionId } from "../site-versions.mjs";
import { packEditJob, EDIT_JOB_KIND, EDIT_JOB_PREFIX } from "../builder/edit-job.mjs";

const require = createRequire(import.meta.url);
const P = require("../public/edit-poll.js");
const RAW = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
const CHAT = fs.readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");
const CHECK = fs.readFileSync(new URL("../scripts/edit-rpc-check.sql", import.meta.url), "utf8");
const SCRIPT = fs.readFileSync(new URL("../scripts/reconcile-check.mjs", import.meta.url), "utf8");
const YML = fs.readFileSync(new URL("../.github/workflows/reconcile-check.yml", import.meta.url), "utf8");

/** JS comments blanked, length preserved and string-aware — the recorded "prose contains the thing it forbids" trap. */
function blankJs(src) {
  let out = ""; let i = 0; let inBlock = false; let quote = "";
  while (i < src.length) {
    const c = src[i]; const nx = src[i + 1];
    if (inBlock) { if (c === "*" && nx === "/") { out += "  "; i += 2; inBlock = false; continue; } out += c === "\n" ? "\n" : " "; i++; continue; }
    if (quote) { out += c; if (c === "\\") { out += nx === undefined ? "" : nx; i += 2; continue; } if (c === quote) quote = ""; i++; continue; }
    if (c === '"' || c === "'" || c === "`") { quote = c; out += c; i++; continue; }
    if (c === "/" && nx === "*") { out += "  "; i += 2; inBlock = true; continue; }
    if (c === "/" && nx === "/") { while (i < src.length && src[i] !== "\n") { out += " "; i++; } continue; }
    out += c; i++;
  }
  return out;
}
const W = blankJs(RAW);
assert.equal(W.length, RAW.length, "the blanker changed worker.js's length");
const blankSql = (s) => s.replace(/^([ \t]*)--.*$/gm, (m) => " ".repeat(m.length));

/** The named top-level function of worker.js, bounded by the NEXT top-level declaration. */
function fnW(name) {
  let at = W.indexOf(`\nasync function ${name}(`);
  if (at < 0) at = W.indexOf(`\nfunction ${name}(`);
  if (at < 0) at = W.indexOf(`\nexport async function ${name}(`);
  assert.ok(at > 0, name + " is gone from worker.js — rescope this guard");
  const re = /\n(?:export )?(?:async )?function |\n(?:export )?(?:const|let|class) /g;
  re.lastIndex = at + 1;
  const m = re.exec(W);
  const body = W.slice(at, m ? m.index : W.length);
  assert.ok(body.length > 120, `the window on ${name} is ${body.length} characters — this guard would be vacuous`);
  return body;
}

const ID = "a1b2c3d4e5f60718293a4b5c6d7e8f90";
const ID0 = "00b2c3d4e5f60718293a4b5c6d7e8f90";
const ID3 = "c3b2c3d4e5f60718293a4b5c6d7e8f90";
const ID4 = "d4b2c3d4e5f60718293a4b5c6d7e8f90";
const ID5 = "e5b2c3d4e5f60718293a4b5c6d7e8f90";
const ID6 = "f6b2c3d4e5f60718293a4b5c6d7e8f90";
const USER = { id: "11111111-2222-4333-8444-555555555555", email: "owner@example.test" };
const ENV_KEYS = { SUPABASE_SERVICE_KEY: "svc-test", CREDITS_MINT_SECRET: "mint-test" };
const SECRET = "0123456789abcdef0123456789abcdef";
const SLUG = "fold-lane";
const V1 = versionId(1000, "aaaaaa");
const V15 = versionId(1500, "abcabc");
const V2 = versionId(2000, "bbbbbb");
const V25 = versionId(2500, "ccdd12");
const V3 = versionId(3000, "cccccc");
const B = (id, parent, job, build) => ({ id, parent, job, build });

// ── THE VERDICT, WITH LITERAL FACTS ──────────────────────────────────────────

test("versions order as strings; a job's own version is the manifest naming it, else the one carrying its build id, else nothing", () => {
  assert.equal(newerVersion(V2, V1), true);
  assert.equal(newerVersion(V1, V2), false);
  assert.equal(newerVersion(V1, V1), false);
  const builds = [B(V1, "", ID0, "b1"), B(V2, V1, ID, "b2")];
  assert.deepEqual(findMine(builds, { id: ID, build: "" }), { version: V2, build: "b2" });
  assert.deepEqual(findMine(builds, { id: ID3, build: "b1" }), { version: V1, build: "b1" }, "a row marked before the upload is found by its build id");
  assert.equal(findMine(builds, { id: ID3, build: "" }), null);
  assert.equal(findMine([null, {}, "x", { id: 7 }], { id: ID, build: "b1" }), null, "junk rows were read as builds");
  assert.equal(findMine(null, { id: ID }), null);
});

test("the ancestry walk: on (one hop, two hops, through the pointer's own parent), off (the chain passes below ours, or a publish began with no pointer), broken (a manifest the chain needs is gone)", () => {
  const mine = { version: V1, build: "b1" };
  assert.equal(ancestry({ version: V2, parent: V1 }, mine, [B(V2, V1, null, "b2")]), "on");
  assert.equal(ancestry({ version: V3, parent: V2 }, mine, [B(V3, V2, null, "b3"), B(V2, V1, null, "b2")]), "on", "two hops");
  assert.equal(ancestry({ version: V2, parent: V1 }, mine, []), "on", "the pointer's own parent stands in for its missing manifest");
  assert.equal(ancestry({ version: V3, parent: V2 }, { version: V15, build: "x" }, [B(V3, V2, null, "b3"), B(V2, V1, null, "b2")]), "off", "the chain passed below ours without meeting it");
  assert.equal(ancestry({ version: V2, parent: "" }, mine, [B(V2, "", null, "b2")]), "off", "a publish that began with no pointer began before ours could have written one");
  assert.equal(ancestry({ version: V3, parent: V2 }, mine, []), "broken", "V2's manifest is gone and the pointer cannot stand in for it");
});

test("the verdict, rule by rule and in order: unreadable facts, nothing staged, the live script, the pointer against ours", () => {
  const builds = [B(V1, "", ID0, "b1"), B(V2, V1, ID, "b2")];
  const job = { id: ID, build: "b2" };
  const kinds = new Set();
  const v = (facts) => { const out = reconcileVerdict(facts); kinds.add(out.kind); return out; };
  // 1. an unreadable pointer or list decides nothing, even with the live script ours
  let out = v({ job, pointer: undefined, live: { build: "b2", version: V2 }, builds });
  assert.deepEqual([out.verdict, out.kind], ["unknown", "pointer-unreadable"]);
  out = v({ job, pointer: null, live: { build: "b2", version: V2 }, builds: null });
  assert.deepEqual([out.verdict, out.kind], ["unknown", "builds-unreadable"]);
  // 2. nothing of ours staged
  out = v({ job: { id: ID3, build: "" }, pointer: null, live: { build: "b1", version: V1 }, builds });
  assert.deepEqual([out.verdict, out.kind, out.mine], ["refunded", "never-staged", null]);
  out = v({ job: { id: ID3, build: "b9" }, pointer: null, live: { build: "b9", version: "" }, builds: [] });
  assert.deepEqual([out.verdict, out.kind], ["kept", "landed"], "a legacy-layout upload that landed is read off the live build id");
  out = v({ job: { id: ID3, build: "b9" }, pointer: null, live: null, builds: [] });
  assert.deepEqual([out.verdict, out.kind], ["unknown", "live-unreadable"], "a build id with no live read is not a refund");
  // 3. the live script settles a landed upload whatever the pointer says
  out = v({ job, pointer: { version: V1, build: "b1", parent: "", job: ID0 }, live: { build: "b2", version: V2 }, builds });
  assert.deepEqual([out.verdict, out.kind, out.mine], ["kept", "landed", { version: V2, build: "b2" }]);
  out = v({ job, pointer: { version: V2, build: "b2", parent: V1, job: ID }, live: { build: "b2", version: "" }, builds });
  assert.deepEqual([out.verdict, out.kind], ["kept", "landed"], "a script with no version stamp is still ours by its build id");
  out = v({ job, pointer: { version: V2, build: "b2", parent: V1, job: ID }, live: null, builds });
  assert.deepEqual([out.verdict, out.kind], ["unknown", "live-unreadable"]);
  // 4. the pointer against ours
  out = v({ job, pointer: null, live: { build: "b1", version: V1 }, builds });
  assert.deepEqual([out.verdict, out.kind], ["refunded", "never-activated"], "a staged version on a site with no pointer never activated");
  out = v({ job, pointer: { version: V2, build: "b2", parent: V1, job: ID }, live: { build: "b1", version: V1 }, builds });
  assert.deepEqual([out.verdict, out.kind], ["retry", "lost-upload"]);
  out = v({ job, pointer: { version: V2, build: "b2", parent: V1, job: ID }, live: { build: "b3", version: V3 }, builds });
  assert.deepEqual([out.verdict, out.kind], ["unknown", "live-ahead"], "a retry would put our script over a newer one");
  const later = [...builds, B(V3, V2, ID3, "b3")];
  out = v({ job, pointer: { version: V3, build: "b3", parent: V2, job: ID3 }, live: { build: "b3", version: V3 }, builds: later });
  assert.deepEqual([out.verdict, out.kind], ["kept", "superseded-built-on"]);
  const over = [...builds, B(V3, V1, ID3, "b3")];
  out = v({ job, pointer: { version: V3, build: "b3", parent: V1, job: ID3 }, live: { build: "b3", version: V3 }, builds: over });
  assert.deepEqual([out.verdict, out.kind], ["refunded", "superseded-not-built-on"]);
  out = v({ job, pointer: { version: V3, build: "b3", parent: "", job: ID3 }, live: { build: "b3", version: V3 }, builds: [...builds] });
  assert.deepEqual([out.verdict, out.kind], ["refunded", "superseded-not-built-on"], "a later publish that began with no pointer");
  out = v({ job, pointer: { version: V3, build: "b3", parent: V15, job: ID3 }, live: { build: "b3", version: V3 }, builds });
  assert.deepEqual([out.verdict, out.kind], ["refunded", "superseded-not-built-on"], "a later publish whose parent is OLDER than ours began before ours could have activated");
  out = v({ job, pointer: { version: V3, build: "b3", parent: V25, job: ID3 }, live: { build: "b3", version: V3 }, builds });
  assert.deepEqual([out.verdict, out.kind], ["unknown", "chain-broken"], "the chain needs V25's manifest — newer than ours, not listed — and cannot pass judgement without it");
  out = v({ job, pointer: { version: V1, build: "b1", parent: "", job: ID0 }, live: { build: "b1", version: V1 }, builds });
  assert.deepEqual([out.verdict, out.kind], ["refunded", "never-activated"], "the pointer never moved to ours");
  // 5. a pruned prefix is still ours when the pointer names the job
  out = v({ job: { id: ID, build: "" }, pointer: { version: V2, build: "b2", parent: V1, job: ID }, live: { build: "b2", version: V2 }, builds: [] });
  assert.deepEqual([out.verdict, out.kind, out.mine], ["kept", "landed", { version: V2, build: "b2" }]);
  // every kind met above is a named one, and the list is not a description of a smaller set
  for (const k of kinds) assert.ok(RECONCILE_KINDS.includes(k), k + " is not a named kind");
  assert.ok(kinds.size >= 10, "the matrix met only " + kinds.size + " kinds");
});

test("the stored reply: a kept job gets the sweep's recovered shape naming its kind; a refunded one its sentence and the amount; unknown stores nothing; the owner's facts carry no etag", () => {
  const row = { id: ID, cost: 2, artifact_build: "b2" };
  const kept = reconcileReply({ verdict: "kept", kind: "landed" }, row);
  assert.equal(kept.status, 200);
  assert.deepEqual(JSON.parse(kept.body), { ok: true, recovered: true, reconciled: "landed", job: ID, cost: 2, build: "b2" });
  assert.equal(P.isRecovered(JSON.parse(kept.body)), true, "the browser would not read a kept reply as recovered");
  const ref = reconcileReply({ verdict: "refunded", kind: "never-activated" }, row, 2);
  assert.equal(ref.status, 409);
  assert.deepEqual(JSON.parse(ref.body), { ok: false, error: "reconciled", kind: "never-activated", job: ID, refunded: 2, msg: NEVER_LIVE_MSG });
  assert.equal(JSON.parse(reconcileReply({ verdict: "refunded", kind: "superseded-not-built-on" }, row, 3).body).msg, OVERTAKEN_MSG);
  assert.equal(reconcileReply({ verdict: "unknown", kind: "live-unreadable" }, row), null);
  assert.equal(reconcileReply({ verdict: "retry", kind: "lost-upload" }, row), null);
  for (const m of [NEVER_LIVE_MSG, OVERTAKEN_MSG]) assert.match(m, /refunded/, "a refunded sentence does not say the money came back");
  const facts = publicFacts({ job: { id: ID }, pointer: { version: V2, build: "b2", parent: V1, job: ID, etag: "secret-etag" }, live: { build: "b2", version: V2 }, builds: [B(V1), B(V2)], mine: { version: V2, build: "b2" } });
  assert.deepEqual(facts, { pointer: { version: V2, build: "b2", parent: V1, job: ID }, live: { build: "b2", version: V2 }, mine: { version: V2, build: "b2" }, builds: 2 });
  assert.equal(publicFacts({ pointer: undefined, builds: null }).pointer, "unreadable");
  assert.equal(publicFacts({ pointer: undefined, builds: null }).builds, "unreadable");
});

test("the probe reads both stamps off one answer, never guesses: no binding, no name, a throwing stub, a script with no build stamp all answer null", async () => {
  const stubFor = (h) => () => ({ async fetch() { return new Response("", { status: 404, headers: h }); } });
  assert.deepEqual(await probeSiteWorker({ stubFor: stubFor({ "x-site-build": "b2", "x-site-version": V2 }), name: "s" }), { build: "b2", version: V2 });
  assert.deepEqual(await probeSiteWorker({ stubFor: stubFor({ "x-site-build": "b1" }), name: "s" }), { build: "b1", version: "" }, "a legacy script's version is empty, not missing");
  assert.equal(await probeSiteWorker({ stubFor: stubFor({}), name: "s" }), null, "no build stamp read as an answer");
  assert.equal(await probeSiteWorker({ stubFor: null, name: "s" }), null);
  assert.equal(await probeSiteWorker({ stubFor: stubFor({ "x-site-build": "b1" }), name: "" }), null);
  assert.equal(await probeSiteWorker({ stubFor: () => ({ async fetch() { throw new Error("no such script"); } }), name: "s" }), null);
  assert.equal(await probeSiteWorker({ stubFor: () => null, name: "s" }), null);
});

test("a listed build carries the job that staged it", async () => {
  const store = new Map();
  store.set(buildPrefix("cafe", V2) + MANIFEST_FILE, JSON.stringify({ version: V2, build: "b2", parent: V1, job: ID, files: ["a.js"], worker: true, at: 2000 }));
  store.set(buildPrefix("cafe", V1) + MANIFEST_FILE, JSON.stringify({ version: V1, build: "b1", parent: "", files: ["a.js"], worker: true, at: 1000 }));
  const deps = {
    list: async (p) => [...store.keys()].filter((k) => k.startsWith(p)).map((k) => ({ key: k })),
    get: async (k) => (store.has(k) ? { async text() { return store.get(k); } } : null),
  };
  const rows = await listBuilds(deps, "cafe");
  assert.deepEqual(rows.map((r) => [r.id, r.job]), [[V2, ID], [V1, null]], "a manifest's job did not reach the row, or a missing one was not null");
});

// ── THE WORKER, DRIVEN ───────────────────────────────────────────────────────

/** A bucket that lists by prefix, honours onlyIf, and remembers reads and deletes. */
function bucket(entries = {}) {
  const store = new Map(Object.entries(entries));
  const deleted = []; const gets = [];
  return {
    store, deleted, gets,
    async get(k) { gets.push(k); return store.has(k) ? { key: k, etag: "e-" + k, httpMetadata: {}, async text() { return store.get(k); }, async json() { return JSON.parse(store.get(k)); }, async arrayBuffer() { return new TextEncoder().encode(store.get(k)).buffer; } } : null; },
    async put(k, v, opts) { if (opts && opts.onlyIf && opts.onlyIf.etagMatches && opts.onlyIf.etagMatches !== "e-" + k) return null; store.set(k, typeof v === "string" ? v : String(v)); return { key: k, etag: "e-" + k }; },
    async delete(k) { deleted.push(k); store.delete(k); },
    async head(k) { return store.has(k) ? { key: k, size: 1 } : null; },
    async list({ prefix = "" } = {}) { return { objects: [...store.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key, size: 1 })), truncated: false }; },
  };
}

/** A site laid out as staged builds under a pointer — the shape stage 7 writes. */
function site({ slug = SLUG, pointer = null, builds = [], script = true, extra = {} } = {}) {
  const entries = { ...extra };
  for (const b of builds) {
    entries[buildPrefix(slug, b.id) + MANIFEST_FILE] = JSON.stringify({ version: b.id, kind: "build", build: b.build || "", parent: b.parent || "", job: b.job || null, files: ["index.js"], worker: script, at: 1, label: "Build" });
    entries[buildPrefix(slug, b.id) + "client/index.js"] = "// js";
    if (script) entries[buildPrefix(slug, b.id) + SERVER_FILE] = "export default {}; // " + b.id;
  }
  if (pointer) entries[POINTER_KEY(slug)] = JSON.stringify({ version: pointer.version, build: pointer.build || "", parent: pointer.parent || "", job: pointer.job || null, activatedAt: "2026-09-05T00:00:00Z" });
  return bucket(entries);
}

/** A dispatch namespace whose one script answers whatever `live.now` says — mutable, so an upload can change it. */
function namespace(live) {
  const asked = [];
  return {
    asked, live,
    get(name) {
      asked.push(name);
      return { async fetch() {
        if (!live.now) throw new Error("no such script");
        const h = { "x-site-build": live.now.build };
        if (live.now.version) h["x-site-version"] = live.now.version;
        return new Response("", { status: 404, headers: h });
      } };
    },
  };
}

/** Stub every fetch the Worker makes: GoTrue, the RPCs by name, the edit_jobs read, the owner lookup, Cloudflare's upload. */
function stubFetch({ rpcAnswers = {}, rows = null, owner = USER.id, cf = null } = {}, log) {
  const real = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const u = String((input && input.url) || input || "");
    const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
    if (u.includes("/auth/v1/user")) return json(USER);
    const m = u.match(/\/rest\/v1\/rpc\/(edit_\w+|rebuild_claim|credit_reverse|deploy_gate_\w+)/);
    if (m) {
      let args = {};
      try { args = JSON.parse(String(init && init.body) || "{}"); } catch { args = {}; }
      delete args.p_mint;
      log.push({ fn: m[1], args });
      const a = rpcAnswers[m[1]];
      if (a === undefined) return json({ ok: false, error: "no stub for " + m[1] }, 500);
      return json(typeof a === "function" ? a(args) : a);
    }
    if (u.includes("/rest/v1/edit_jobs?")) {
      log.push({ fn: "rows", query: u.slice(u.indexOf("edit_jobs?") + 10) });
      if (rows === null) return new Response("down", { status: 503 });
      return json(typeof rows === "function" ? rows(u) : rows);
    }
    if (u.includes("/rest/v1/site_backends?")) return json(owner ? [{ uid: owner }] : []);
    if (u.includes("api.cloudflare.com")) {
      log.push({ fn: "cf", method: init && init.method, url: u });
      return cf ? cf(u, init) : json({ success: false, errors: [{ code: 10000, message: "refused by the stub" }] }, 403);
    }
    if (u.includes("/rest/v1/")) return json([]);
    return new Response("unavailable", { status: 503 });
  };
  return () => { globalThis.fetch = real; };
}

const row = (over = {}) => ({
  id: ID, uid: USER.id, slug: SLUG, op: "edit", state: "failed", phase: "publishing", cost: 2, billing: "reserved",
  needs_review: true, review_note: "edit did not ship", artifact_build: "", worker_status: null,
  publish_started_at: "2026-09-05T00:00:00Z", published_at: null, result: null, updated_at: "2026-09-05T00:00:01Z", ...over,
});
const RPC_OK = {
  edit_reconcile: (a) => ({ ok: true, outcome: a.p_committed ? "kept" : "refunded", refunded: a.p_committed ? 0 : 2 }),
  edit_finalize: { ok: true },
};

async function drive(r, { pointer = null, builds = [], live, script = true, env = {}, rpcAnswers = {}, rows = null, cf = null, hint = true } = {}) {
  const b = site({ pointer, builds, script });
  const ns = live === undefined ? null : namespace({ now: live });
  const rpc = [];
  const restore = stubFetch({ rpcAnswers: { ...RPC_OK, ...rpcAnswers }, rows, cf }, rpc);
  try {
    const mod = await loadWorkerModule();
    const out = await mod.reconcileEditJob({ ...ENV_KEYS, SITES_BUCKET: b, ...(ns ? { SITE_WORKERS: ns } : {}), ...env }, r.id, hint ? r : null);
    return { out, rpc, fns: rpc.map((x) => x.fn), b, ns };
  } finally { restore(); }
}

const BUILDS = [B(V1, "", ID0, "b1"), B(V2, V1, ID, "b2")];
const OURS = { version: V2, build: "b2", parent: V1, job: ID };
const THEIRS = { version: V1, build: "b1", parent: "", job: ID0 };

test("DRIVEN — landed: the live script is the job's, so the row is kept through edit_reconcile and the recovered reply stored; a row that already holds the handler's own reply keeps it", async () => {
  const r = await drive(row(), { pointer: OURS, builds: BUILDS, live: { build: "b2", version: V2 } });
  assert.deepEqual([r.out.verdict, r.out.kind, r.out.applied], ["kept", "landed", true], JSON.stringify(r.out));
  assert.deepEqual(r.fns, ["edit_reconcile", "edit_finalize"]);
  assert.equal(r.rpc[0].args.p_id, ID);
  assert.equal(r.rpc[0].args.p_committed, true);
  assert.match(r.rpc[0].args.p_note, /^reconciled: landed/);
  assert.equal(r.rpc[1].args.p_ok, true);
  assert.deepEqual(JSON.parse(r.rpc[1].args.p_result.body), { ok: true, recovered: true, reconciled: "landed", job: ID, cost: 2, build: null });
  assert.deepEqual(r.out.facts.mine, { version: V2, build: "b2" });
  assert.equal(r.out.facts.pointer.version, V2);
  assert.equal("etag" in r.out.facts.pointer, false, "the owner's facts carry the pointer's etag");
  // the handler's own reply, which says what the change did, is left as it is
  const kept = await drive(row({ result: { status: 200, type: "application/json", body: JSON.stringify({ ok: true, changed: ["index.tsx"] }) } }), { pointer: OURS, builds: BUILDS, live: { build: "b2", version: V2 } });
  assert.deepEqual(kept.fns, ["edit_reconcile"], "a stored reply that says what the change did was overwritten with 'recovered'");
});

test("DRIVEN — never activated: the pointer never moved to ours, so the row is refunded and the sentence stored on it; overtaken: a later publish built from before ours says so in its own words", async () => {
  const r = await drive(row(), { pointer: THEIRS, builds: BUILDS, live: { build: "b1", version: V1 } });
  assert.deepEqual([r.out.verdict, r.out.kind, r.out.applied, r.out.refunded], ["refunded", "never-activated", true, 2]);
  assert.deepEqual(r.fns, ["edit_reconcile", "edit_finalize"]);
  assert.equal(r.rpc[0].args.p_committed, false);
  assert.equal(r.rpc[1].args.p_ok, false);
  assert.deepEqual(JSON.parse(r.rpc[1].args.p_result.body), { ok: false, error: "reconciled", kind: "never-activated", job: ID, refunded: 2, msg: NEVER_LIVE_MSG });
  const over = await drive(row(), { pointer: { version: V3, build: "b3", parent: V1, job: ID3 }, builds: [...BUILDS, B(V3, V1, ID3, "b3")], live: { build: "b3", version: V3 } });
  assert.deepEqual([over.out.verdict, over.out.kind], ["refunded", "superseded-not-built-on"]);
  assert.equal(JSON.parse(over.rpc[1].args.p_result.body).msg, OVERTAKEN_MSG);
  const on = await drive(row(), { pointer: { version: V3, build: "b3", parent: V2, job: ID3 }, builds: [...BUILDS, B(V3, V2, ID3, "b3")], live: { build: "b3", version: V3 } });
  assert.deepEqual([on.out.verdict, on.out.kind, on.rpc[0].args.p_committed], ["kept", "superseded-built-on", true]);
  // A VERDICT THE RPC REFUSES (a person settled the row a moment ago) applies
  // nothing further: no reply is stored over theirs, and the answer says so.
  const lost = await drive(row(), { pointer: THEIRS, builds: BUILDS, live: { build: "b1", version: V1 }, rpcAnswers: { edit_reconcile: { ok: false, error: "not-in-review", state: "done" } } });
  assert.deepEqual([lost.out.verdict, lost.out.applied, lost.out.error, lost.fns], ["refunded", false, "not-in-review", ["edit_reconcile"]]);
});

test("DRIVEN — unknown applies nothing: no dispatch binding to read the live script, a bucket that cannot list, a row that cannot be read; and a row not under review, or a build's, is skipped before any fact is read", async () => {
  const blind = await drive(row(), { pointer: OURS, builds: BUILDS });
  assert.deepEqual([blind.out.verdict, blind.out.kind, blind.out.applied, blind.fns], ["unknown", "live-unreadable", false, []]);
  const nolist = await drive(row(), { pointer: OURS, builds: BUILDS, live: { build: "b2", version: V2 }, env: { SITES_BUCKET: { get: async () => { throw new Error("r2 down"); }, list: async () => { throw new Error("r2 down"); } } } });
  assert.deepEqual([nolist.out.verdict, nolist.out.kind, nolist.fns], ["unknown", "pointer-unreadable", []]);
  const unread = await drive(row(), { pointer: OURS, builds: BUILDS, live: { build: "b2", version: V2 }, hint: false, rows: null });
  assert.deepEqual([unread.out.verdict, unread.out.kind, unread.fns], ["unknown", "row-unreadable", ["rows"]]);
  assert.match(unread.rpc[0].query, /^id=eq\.a1b2c3d4/, "the row was not read by its id");
  const settled = await drive(row({ needs_review: false, state: "done" }), { pointer: OURS, builds: BUILDS, live: { build: "b2", version: V2 } });
  assert.deepEqual([settled.out.verdict, settled.out.kind, settled.fns, settled.b.gets], ["skip", "not-in-review", [], []]);
  const build = await drive(row({ op: "build" }), { pointer: OURS, builds: BUILDS, live: { build: "b2", version: V2 } });
  assert.deepEqual([build.out.verdict, build.out.kind, build.fns], ["skip", "build-row", []]);
});

test("DRIVEN — a lost upload is retried from the immutable prefix: the staged script goes to the site's name, the live script is asked again, and only a script that now answers ours is kept; a refusal stays unknown and is capped per isolate; no credentials or no staged script retry nothing", async () => {
  // the retry lands: Cloudflare accepts the PUT and the script starts answering ours
  let ns;
  const cfOk = (u) => { ns.live.now = { build: "b2", version: V2 }; assert.match(u, /\/workers\/dispatch\/namespaces\/[^/]+\/scripts\//, "the upload did not go to the dispatch namespace"); return new Response(JSON.stringify({ success: true, result: {} }), { status: 200, headers: { "content-type": "application/json" } }); };
  const creds = { SITE_WORKERS_API_ACCOUNT: "acct", CLOUDFLARE_API_TOKEN: "tok" };
  {
    const b = site({ pointer: OURS, builds: BUILDS });
    ns = namespace({ now: { build: "b1", version: V1 } });
    const rpc = [];
    const restore = stubFetch({ rpcAnswers: RPC_OK, cf: cfOk }, rpc);
    try {
      const mod = await loadWorkerModule();
      const out = await mod.reconcileEditJob({ ...ENV_KEYS, ...creds, SITES_BUCKET: b, SITE_WORKERS: ns }, ID, row());
      assert.deepEqual([out.verdict, out.kind, out.applied], ["kept", "upload-retried", true], JSON.stringify(out));
      assert.deepEqual(rpc.map((x) => x.fn), ["cf", "edit_reconcile", "edit_finalize"], "the upload did not precede the verdict, or the verdict was not applied");
      assert.equal(rpc[0].method, "PUT");
      assert.equal(rpc[1].args.p_committed, true);
      assert.match(rpc[1].args.p_note, /^reconciled: upload-retried/);
      assert.equal(JSON.parse(rpc[2].args.p_result.body).reconciled, "upload-retried");
    } finally { restore(); }
  }
  // the retry is refused: unknown, nothing applied — and after RECONCILE_RETRY_MAX refusals this isolate stops asking
  for (let i = 1; i <= RECONCILE_RETRY_MAX + 1; i++) {
    const r = await drive(row({ id: ID4 }), { pointer: { ...OURS, job: ID4 }, builds: [B(V1, "", ID0, "b1"), B(V2, V1, ID4, "b2")], live: { build: "b1", version: V1 }, env: creds });
    if (i <= RECONCILE_RETRY_MAX) assert.deepEqual([r.out.verdict, r.out.kind, r.fns], ["unknown", "upload-refused", ["cf"]], "try " + i);
    else assert.deepEqual([r.out.verdict, r.out.kind, r.fns], ["unknown", "retry-exhausted", []], "the cap did not hold");
  }
  // the upload is accepted and the live script STILL answers the old version:
  // unknown, said, nothing applied — an accepted PUT is not a serving script
  {
    const b = site({ pointer: { ...OURS, job: ID6 }, builds: [B(V1, "", ID0, "b1"), B(V2, V1, ID6, "b2")] });
    const ns2 = namespace({ now: { build: "b1", version: V1 } });
    const rpc = [];
    const restore = stubFetch({ rpcAnswers: RPC_OK, cf: () => new Response(JSON.stringify({ success: true, result: {} }), { status: 200, headers: { "content-type": "application/json" } }) }, rpc);
    try {
      const mod = await loadWorkerModule();
      const out = await mod.reconcileEditJob({ ...ENV_KEYS, ...creds, SITES_BUCKET: b, SITE_WORKERS: ns2 }, ID6, row({ id: ID6 }));
      assert.deepEqual([out.verdict, out.kind, out.applied], ["unknown", "upload-not-serving", false], JSON.stringify(out));
      assert.deepEqual(rpc.map((x) => x.fn), ["cf"], "a script that does not serve was kept, or the upload was skipped");
    } finally { restore(); }
  }
  // no credentials: nothing uploaded; no staged script: nothing uploaded
  const nocreds = await drive(row({ id: ID5 }), { pointer: { ...OURS, job: ID5 }, builds: [B(V1, "", ID0, "b1"), B(V2, V1, ID5, "b2")], live: { build: "b1", version: V1 } });
  assert.deepEqual([nocreds.out.verdict, nocreds.out.kind, nocreds.fns], ["unknown", "no-dispatch", []]);
  const noscript = await drive(row({ id: ID3 }), { pointer: { ...OURS, job: ID3 }, builds: [B(V1, "", ID0, "b1"), B(V2, V1, ID3, "b2")], live: { build: "b1", version: V1 }, script: false, env: creds });
  assert.deepEqual([noscript.out.verdict, noscript.out.kind, noscript.fns], ["unknown", "no-script-staged", []]);
});

async function driveConsumer(refundAnswer) {
  const b = bucket({ [EDIT_JOB_PREFIX + ID]: JSON.stringify(packEditJob({ url: "https://gofarther.dev/api/site/" + SLUG + "/edit", body: JSON.stringify({ layer: "look", instruction: "x" }), uid: USER.id, slug: SLUG, secret: SECRET, at: Date.now() })) });
  const rpc = [];
  const restore = stubFetch({
    rpcAnswers: {
      edit_claim: { ok: true, claimed: true, state: "claimed", uid: USER.id, slug: SLUG }, edit_beat: { ok: true, alive: true },
      edit_finalize: { ok: false, error: "not-published" }, edit_refund: refundAnswer,
      edit_phase_write: { ok: true }, edit_handoff: { ok: true }, ...RPC_OK,
    },
    rows: [row()],
  }, rpc);
  try {
    const worker = await loadWorker();
    const ctx = makeCtx();
    await worker.queue({ messages: [{ body: { kind: EDIT_JOB_KIND, id: ID }, ack() {} }] }, { ...ENV_KEYS, SITES_BUCKET: b, BUILD_QUEUE: { async send() {} } }, ctx);
    await Promise.allSettled(ctx.pending);
    return { rpc, fns: rpc.map((x) => x.fn) };
  } finally { restore(); }
}

test("DRIVEN — the consumer's door: a refund the RPC routes to review is reconciled at once, the row read by its id and the verdict applied, all inside the same delivery; a refund that lands is not", async () => {
  const r = await driveConsumer({ ok: false, error: "needs-review", refunded: 0 });
  const refundAt = r.fns.indexOf("edit_refund");
  const recAt = r.fns.indexOf("edit_reconcile");
  assert.ok(refundAt >= 0, "the consumer never refunded: " + r.fns.join(","));
  assert.ok(recAt > refundAt, "the reconcile did not follow the refund: " + r.fns.join(","));
  const read = r.rpc.find((x) => x.fn === "rows");
  assert.ok(read && /^id=eq\./.test(read.query), "the row was not read by its id before the verdict");
  assert.equal(r.rpc[recAt].args.p_committed, false, "nothing was staged, so the verdict is a refund");
  assert.match(r.rpc[recAt].args.p_note, /never-staged/);
  // A REFUND THAT LANDED — publishing never began — has nothing to reconcile.
  const plain = await driveConsumer({ ok: true, refunded: 2 });
  assert.ok(plain.fns.includes("edit_refund"), "the consumer never refunded: " + plain.fns.join(","));
  assert.equal(plain.fns.includes("edit_reconcile"), false, "a refund that landed was reconciled");
  assert.equal(plain.fns.includes("rows"), false, "a refund that landed read the row");
});

test("DRIVEN — the sweep's door: every row under review is read and reconciled, a build's row skipped, and the tick says what it did", async () => {
  const mod = await loadWorkerModule();
  const b = site({ pointer: THEIRS, builds: BUILDS });
  const ns = namespace({ now: { build: "b1", version: V1 } });
  const rpc = [];
  const restore = stubFetch({ rpcAnswers: RPC_OK, rows: [row(), row({ id: ID3, op: "build", slug: "build:" + ID3 })] }, rpc);
  const said = [];
  const realLog = console.log;
  console.log = (...a) => { said.push(a.join(" ")); };
  try {
    await mod.runReviewReconcile({ ...ENV_KEYS, SITES_BUCKET: b, SITE_WORKERS: ns });
  } finally { console.log = realLog; restore(); }
  assert.match(rpc[0].query, /needs_review=eq\.true/, "the sweep did not ask for the rows under review");
  assert.deepEqual(rpc.filter((x) => x.fn === "edit_reconcile").map((x) => [x.args.p_id, x.args.p_committed]), [[ID, false]], "the edit row was not reconciled exactly once, or the build row was");
  assert.ok(said.some((l) => /review reconcile: .*"refunded":1.*"skipped":1/.test(l)), "the tick did not say what it did: " + said.join(" | "));
  // nothing under review: one read, nothing said, nothing applied
  const rpc2 = [];
  const restore2 = stubFetch({ rpcAnswers: RPC_OK, rows: [] }, rpc2);
  try { await mod.runReviewReconcile({ ...ENV_KEYS, SITES_BUCKET: b, SITE_WORKERS: ns }); } finally { restore2(); }
  assert.deepEqual(rpc2.map((x) => x.fn), ["rows"]);
});

test("DRIVEN — the owner's route: signed out is 401, a stranger's site is 404, the owner reads the rows under review with the facts and the verdict DRY, applies with apply=1, a bad job id is 400, an unreadable table is 503, and another owner's row on the site is not shown", async () => {
  const b = site({ pointer: OURS, builds: BUILDS });
  const ns = namespace({ now: { build: "b2", version: V2 } });
  const env = { ...ENV_KEYS, SITES_BUCKET: b, SITE_WORKERS: ns };
  const auth = { authorization: "Bearer t" };
  const rpc = [];
  let restore = stubFetch({ rpcAnswers: RPC_OK, rows: (u) => (u.includes("id=eq.") && !u.includes("id=eq." + ID) ? [] : [row({ artifact_build: "b2" }), row({ id: ID3, uid: "22222222-2222-4333-8444-555555555555" })]) }, rpc);
  try {
    assert.equal((await hit("/api/site/reconcile?slug=" + SLUG, { env })).status, 401);
    assert.equal((await hit("/api/site/reconcile?slug=" + SLUG + "&job=nope", { env, headers: auth })).status, 400);
    const dry = await hit("/api/site/reconcile?slug=" + SLUG, { env, headers: auth });
    assert.equal(dry.status, 200, dry.text);
    assert.equal(dry.json.applied, false);
    assert.equal(dry.json.rows.length, 1, "another owner's row was shown, or the owner's was not: " + dry.text);
    assert.deepEqual([dry.json.rows[0].job, dry.json.rows[0].verdict, dry.json.rows[0].kind, dry.json.rows[0].applied], [ID, "kept", "landed", false]);
    assert.deepEqual(dry.json.rows[0].facts.live, { build: "b2", version: V2 });
    assert.equal(dry.json.rows[0].facts.pointer.version, V2);
    assert.deepEqual(rpc.filter((x) => x.fn !== "rows"), [], "a dry read applied something");
    const applied = await hit("/api/site/reconcile?slug=" + SLUG + "&job=" + ID + "&apply=1", { env, headers: auth });
    assert.equal(applied.status, 200, applied.text);
    assert.deepEqual([applied.json.applied, applied.json.rows[0].verdict, applied.json.rows[0].applied], [true, "kept", true]);
    assert.deepEqual(rpc.filter((x) => x.fn !== "rows").map((x) => x.fn), ["edit_reconcile", "edit_finalize"]);
    assert.match(rpc.find((x) => x.fn === "rows" && x.query.includes("id=eq.")).query, new RegExp("id=eq\\." + ID + "&slug=eq\\." + SLUG + "&needs_review=eq\\.true"), "the named job was not read under its site and the review flag");
  } finally { restore(); }
  // ITS OWN SLUG: the owner lookup memoizes per slug for five minutes, so the
  // stranger's site must not be the one the owner just read.
  restore = stubFetch({ rpcAnswers: RPC_OK, rows: [row()], owner: "33333333-2222-4333-8444-555555555555" }, []);
  try { assert.equal((await hit("/api/site/reconcile?slug=stranger-lane", { env, headers: auth })).status, 404); } finally { restore(); }
  restore = stubFetch({ rpcAnswers: RPC_OK, rows: null }, []);
  try { assert.equal((await hit("/api/site/reconcile?slug=" + SLUG, { env, headers: auth })).status, 503); } finally { restore(); }
});

// ── THE HOPS A DRIVE CANNOT SEE, READ ────────────────────────────────────────

test("the hops: every refund site in the consumer is followed by the reconcile, the sweep tick reconciles after the stale sweep, the route checks ownership before it reads and filters by uid, the retry is capped before it reads the prefix and re-probes after the upload, a kept row keeps the handler's reply", () => {
  const consumer = fnW("runQueuedSiteEdit");
  // FIVE REFUND SITES, TWO KINDS. The two before the replay ("request object
  // missing", "stored request did not match") refund a job that never began
  // publishing, which the RPC never routes to review; the three after it can
  // meet a row that did, and each keeps the answer and reconciles on it.
  const refunds = consumer.split("\n").filter((l) => /editRpc\(env, "edit_refund"/.test(l));
  const early = refunds.filter((l) => /request object missing|stored request did not match/.test(l));
  const late = refunds.filter((l) => !/request object missing|stored request did not match/.test(l));
  assert.equal(early.length, 2, "the pre-run refund sites moved: " + early.length);
  assert.equal(late.length, 3, "the publish-time refund sites moved: " + late.length);
  for (const l of late) assert.match(l, /const refund = await editRpc\(env, "edit_refund"/, "a refund's answer is not kept: " + l.trim());
  assert.equal((consumer.match(/await reconcileAfterRefund\(env, id, refund\);/g) || []).length, 3, "a publish-time refund site is not followed by the reconcile");
  const after = fnW("reconcileAfterRefund");
  assert.match(after, /refund\.error !== "needs-review"\) return;/, "the reconcile runs on an answer that is not needs-review");
  const lost = fnW("runLostEditJobs");
  const stale = lost.indexOf("await runStaleEditJobs(env);");
  const review = lost.indexOf("await runReviewReconcile(env);");
  assert.ok(stale > 0 && review > stale, "the sweep tick does not reconcile the review rows after the stale sweep");
  const route = W.slice(W.indexOf('url.pathname === "/api/site/reconcile"'), W.indexOf('url.pathname === "/api/site/reach"'));
  assert.ok(route.length > 500 && route.length < 6000, "the route's window is off: " + route.length);
  const own = route.indexOf("siteOwnerBySlug(rslug, env)");
  const read = route.indexOf("readEditRows(env,");
  assert.ok(own > 0 && read > own, "the route reads the rows before it has checked the site is the caller's");
  assert.match(route, /if \(String\(row\.uid \|\| ""\) !== ru\.id\) continue;/, "another owner's row on the site is reconciled or shown");
  assert.match(route, /url\.searchParams\.get\("apply"\) === "1"/, "apply is read as anything truthy");
  assert.match(route, /needs_review=eq\.true/, "the route reads rows that are not under review");
  const retry = fnW("retryLostUpload");
  const cap = retry.indexOf("RECONCILE_RETRY_MAX");
  const readAt = retry.indexOf("readBuild(");
  assert.ok(cap > 0 && readAt > cap, "the cap is asked after the prefix is read");
  assert.match(retry, /putSiteWorker\(env, slug, \{ ok: true, code: staged\.worker/, "the retry does not upload the staged script as the publish would");
  assert.ok(retry.indexOf("probeSiteWorker(") > retry.indexOf("putSiteWorker("), "the live script is not asked again after the upload");
  const apply = fnW("applyReconcile");
  assert.match(apply, /if \(!\(out\.verdict === "kept" && hasReply\)\) \{\s+await editRpc\(env, "edit_finalize"/, "a kept row's own reply is overwritten, or a refunded row's sentence is not stored");
  assert.match(apply, /p_committed: out\.verdict === "kept"/);
  const facts = fnW("reconcileFacts");
  assert.match(facts, /readPointer\(deps, slug\)/, "the facts read the pointer through the serve path's cache");
  assert.doesNotMatch(facts, /sitePointer\(/, "the facts read the pointer through the serve path's 30 s cache");
  assert.match(facts, /catch \{ pointer = undefined; \}/, "an unreadable pointer reads as no pointer");
});

test("the script reads by default and applies only on an affirmative word; the workflow is dispatch-only and hands the three inputs through", () => {
  assert.match(SCRIPT, /const APPLY = \/\^\(1\|on\|yes\|true\)\$\/i\.test\(String\(process\.env\.RECONCILE_APPLY \|\| ""\)\.trim\(\)\);/, "the apply flag is read as anything truthy");
  assert.match(SCRIPT, /if \(APPLY\) q\.set\("apply", "1"\);/, "the script applies without the flag");
  assert.match(SCRIPT, /\/api\/site\/reconcile\?/, "the script does not call the route");
  assert.doesNotMatch(SCRIPT, /\/rest\/v1\/edit_jobs/, "the script reads the table itself instead of the owner's route");
  assert.doesNotMatch(YML, /^\s+push:/m, "the workflow runs on a push");
  assert.match(YML, /workflow_dispatch:/);
  for (const k of ["OWNER_SLUG: ${{ github.event.inputs.slug }}", "RECONCILE_JOB: ${{ github.event.inputs.job }}", "RECONCILE_APPLY: ${{ github.event.inputs.apply }}", "run: node scripts/reconcile-check.mjs"]) assert.ok(YML.includes(k), "the workflow lost: " + k);
  assert.match(YML, /apply:\s+description:[^\n]*\n\s+required: false\n\s+type: boolean\n\s+default: false/, "apply is not a boolean input defaulting to off");
});

test("the check drives the reply after a verdict: section 22 seeds a mid-publish review row each on its own slug, keeps one with the money standing and its recovered reply readable, refunds the other with the sentence stored on the failed row, refuses a second verdict — and the whole script's stamp is after the run", () => {
  // THE SECTION HEADERS ARE COMMENT LINES, so the boundaries are found on the
  // raw text and the body read blanked — every assertion inside REQUIRES a
  // spelling, none forbids one, so nothing here can be fooled by prose.
  const at = CHECK.indexOf("22. A RECONCILE STORES THE CUSTOMER'S REPLY");
  const prev = CHECK.indexOf("21. THE DEPLOY GATE AND THE STALE SWEEP");
  assert.ok(at > prev && prev > 0, "section 22 is missing or before section 21");
  const s = blankSql(CHECK.slice(at, CHECK.indexOf("update private.mint set key_hash = keep;", at)));
  for (const f of ["FAIL 100 ", "FAIL 100b", "FAIL 100c", "FAIL 100d", "FAIL 100e", "FAIL 101 ", "FAIL 101b", "FAIL 101c", "FAIL 101d", "FAIL 101e", "FAIL 102 "]) assert.ok(s.includes(f), "section 22 lost " + f);
  assert.match(s, /edit_create\(j26, u, slug \|\| '-r1'/, "the kept row is not on its own slug");
  assert.match(s, /edit_create\(j27, u, slug \|\| '-r2'/, "the refunded row is not on its own slug");
  const order = ["edit_publish_mark(j26", "edit_refund(j26", "edit_reconcile(j26, true", "edit_finalize(j26", "FAIL 100d", "FAIL 100e", "edit_reconcile(j27, false", "edit_finalize(j27", "FAIL 101c", "FAIL 101d", "FAIL 101e", "edit_reconcile(j27, true", "FAIL 102"];
  let last = -1;
  for (const o of order) { const i = s.indexOf(o); assert.ok(i > last, o + " is out of order or missing"); last = i; }
  assert.match(s, /if st <> 'done' or bl <> 'finalized' or nr or b1 <> b0 then raise exception 'FAIL 100d/, "the kept row's money or state is not read");
  assert.match(s, /if st <> 'failed' or bl <> 'refunded' or nr or b1 <> b0 \+ 3 then raise exception 'FAIL 101d/, "the refunded row's money is not read");
  assert.match(s, /\(c1::jsonb->>'recovered'\) <> 'true'/, "the kept reply is not read as the route reads it");
  assert.match(s, /\(c1::jsonb->>'error'\) <> 'reconciled'/, "the refunded reply is not read off the failed row");
  assert.match(s, /ok_count := ok_count \+ 11;/, "section 22's count moved: re-count its FAILs");
  assert.match(CHECK, /\(stage 3b\): ALL 176 CHECKS PASSED/, "the header does not carry stage 3b's run — stamp it AFTER the run, then re-run this guard");
  assert.match(CHECK, /j26 text := 'e_'/);
  assert.match(CHECK, /j27 text := 'e_'/);
});

test("the browser: a deferred poll says waiting, in the poll module's own sentence, and the live steps paint it in place of Thinking", () => {
  assert.equal(P.waitingMessage({ ok: true, status: "queued", waiting: true }), "Waiting — your site is busy with another change, or the platform is being updated. This will carry on by itself.");
  for (const b of [{ ok: true, status: "queued" }, { waiting: false }, { waiting: "yes" }, null, undefined, "waiting"]) assert.equal(P.waitingMessage(b), "", JSON.stringify(b));
  const w = CHAT.slice(CHAT.indexOf("function watchEditJob("), CHAT.indexOf("function cancelEditJob("));
  const wait = w.slice(w.indexOf("if (read.act === 'wait') {"), w.indexOf("if (read.act === 'reply')"));
  assert.match(wait, /const waitNote = EditPoll\.waitingMessage\(e\);/, "the wait branch does not ask the poll module");
  assert.match(wait, /siteBuild\.waitNote = waitNote; paintReactLive\(\);/, "the sentence is not painted");
  assert.match(wait, /siteOpenId === origin/, "a wait on another site's job repaints this one");
  const live = CHAT.slice(CHAT.indexOf("function reactLiveStepsHTML("), CHAT.indexOf("function paintReactLive("));
  assert.match(live, /sb\.rphase === 'thinking'\) return '<div class="st-steps st-steps-live"><div class="st-think"><i><\/i>' \+ \(sb\.waitNote \? esc\(sb\.waitNote\) : 'Thinking'\)/, "the thinking line does not carry the waiting sentence, escaped");
});
