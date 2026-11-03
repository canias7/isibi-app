// PARKED (2026-11-03, park-old-way): the old-way half of test/model3d.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
// A 3D MODEL FOR A SITE (2026-10-22): Meshy 7.1 through fal's queue, stored in
// the site's uploads, placed on a page with the kit's Scene3D. Every network
// call here is a stub: no test ever reaches fal.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash } from "node:crypto";
import {
  MESHY_TEXT_MODEL, MESHY_IMAGE_MODEL, MODEL3D_CREDITS, MESHY_SETTINGS, textTo3dRequest, imageTo3dRequest, readModelAnswer,
  queueUrls, queueSubmit, queueStatus, runQueue, downloadCapped, placeScene3D, scene3dBlock, SCENE3D_IMPORT, model3dRef, model3dLabel,
} from "../../../builder/site-3d.mjs";
import { model3dPrice, model3dStart, model3dPoll } from "../../../builder/model3d-route.mjs";
import { handleUpload, sniffUpload, uploadKind, UPLOAD_EXTS, MODEL_FORMATS, handleUploadList } from "../../../site-uploads.mjs";
import { readRouting, LIVE_ASK_TOOL, readModel3d } from "../builder/site-ask.mjs";
import { routeOf } from "../../../builder/site-addon.mjs";

const read = (p) => fs.readFileSync(new URL("../../../" + p, import.meta.url), "utf8");

// ── the answer reader ──────────────────────────────────────────────────────

const ANSWER = {
  model_glb: { url: "https://v3.fal.media/files/a/model.glb", content_type: "model/gltf-binary" },
  model_urls: { glb: { url: "https://v3.fal.media/files/a/model.glb" }, usdz: { url: "https://v3.fal.media/files/a/model.usdz" }, fbx: { url: "https://v3.fal.media/files/a/model.fbx" } },
  thumbnail: { url: "https://v3.fal.media/files/a/thumb.png" },
  texture_urls: [{ base_color: { url: "https://v3.fal.media/files/a/base.png" } }],
  seed: 42,
};

// ── fal's queue, stubbed ───────────────────────────────────────────────────

const GLB = (n = 64) => { const b = new Uint8Array(n); b.set([0x67, 0x6c, 0x54, 0x46, 2, 0, 0, 0]); return b; };
const PNG = () => { const b = new Uint8Array(64); b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]); return b; };
const USDZ = () => { const b = new Uint8Array(64); b.set([0x50, 0x4b, 0x03, 0x04]); return b; };

function falStub({ statuses = ["IN_QUEUE", "IN_PROGRESS", "COMPLETED"], result = ANSWER, resultStatus = 200, submitStatus = 200, files = {} } = {}) {
  const calls = [];
  let i = 0;
  const id = "0b7c1d2e-3f40-4a5b-8c6d-7e8f9a0b1c2d";
  const fetch = async (url, opts = {}) => {
    calls.push({ url, method: opts.method || "GET", body: opts.body, auth: opts.headers && opts.headers.Authorization });
    const res = (status, body, headers = {}) => ({ ok: status < 300, status, headers: { get: (k) => headers[k.toLowerCase()] ?? null }, json: async () => body, arrayBuffer: async () => (body instanceof Uint8Array ? body.buffer : new ArrayBuffer(0)) });
    if (url.startsWith("https://queue.fal.run/fal-ai/meshy/v7.1/")) {
      return res(submitStatus, submitStatus < 300 ? { request_id: id, status_url: "https://queue.fal.run/fal-ai/meshy/requests/" + id + "/status", response_url: "https://queue.fal.run/fal-ai/meshy/requests/" + id } : { detail: "bad" });
    }
    if (url.endsWith("/status")) return res(200, { status: statuses[Math.min(i++, statuses.length - 1)], queue_position: 3 });
    if (url.endsWith("/cancel")) return res(200, {});
    if (url === "https://queue.fal.run/fal-ai/meshy/requests/" + id) return res(resultStatus, result);
    if (files[url]) return res(200, files[url], { "content-length": String(files[url].length) });
    return res(404, null);
  };
  return { fetch, calls, id };
}
const FILES = { [ANSWER.model_glb.url]: GLB(), [ANSWER.model_urls.usdz.url]: USDZ(), [ANSWER.thumbnail.url]: PNG() };

// ── storage: the uploads take a model, with its own type ───────────────────

function bucket() {
  const objects = [];
  const puts = [];
  const deps = {
    gate: async () => ({}),
    hash: async (b) => createHash("sha256").update(b).digest("hex"),
    list: async () => objects,
    put: async (key, bytes, ct) => { puts.push({ key, ct, size: bytes.length }); objects.push({ key, size: bytes.length }); },
    remove: async () => {},
  };
  return { deps, puts, objects };
}

// ── on the page ────────────────────────────────────────────────────────────

const PAGE = `import { createFileRoute } from "@tanstack/react-router";
import {
  Button,
} from "@/components/ui/button";
import { SiteChrome } from "@/components/ui/site-chrome";

export const Route = createFileRoute("/shop")({ component: Shop });

function Shop() {
  return (
    <SiteChrome {...CHROME}>
      <section className="mx-auto max-w-6xl px-6"><h1>Shop</h1></section>
    </SiteChrome>
  );
}
`;

// ── the route, end to end with stubs ───────────────────────────────────────

function routeDeps({ balance = 500, debitOk = true, fal = falStub({ files: FILES }), pages = [{ path: "shop.tsx", source: PAGE }, { path: "index.tsx", source: PAGE.replace("/shop", "/") }], off = false, falKey = "FK" } = {}) {
  const store = bucket();
  const records = new Map();
  let etagN = 0;
  const ledger = { debits: [], reversals: [], published: [] };
  const deps = {
    falKey, off, origin: "https://gofarther.dev", now: () => 1000,
    fetch: (u, o) => fal.fetch(u, o),
    readRecord: async (k) => (records.has(k) ? { rec: JSON.parse(records.get(k).body), etag: records.get(k).etag } : null),
    writeRecord: async (k, rec, etag) => {
      if (etag && (!records.has(k) || records.get(k).etag !== etag)) return { ok: false };
      const e = "e" + ++etagN; records.set(k, { body: JSON.stringify(rec), etag: e }); return { ok: true, etag: e };
    },
    debit: async (amount, ref) => { ledger.debits.push({ amount, ref }); return debitOk ? { ok: true, taken: amount, balance: balance - amount } : { ok: false, taken: 0, balance: 12 }; },
    reverse: async (ref, amount) => { ledger.reversals.push({ ref, amount }); return { ok: true, refunded: amount }; },
    balance: async () => balance,
    storeFile: async (name, bytes) => { const r = await handleUpload(store.deps, { slug: "cafe", uid: "", bytes, filename: name }); return r.status < 300 ? { url: r.body.url, kind: r.body.kind } : { error: r.body.error }; },
    loadPages: async () => ({ ok: true, pages }),
    publish: async (p, label) => { ledger.published.push({ pages: p, label }); return { ok: true, draft: true }; },
    routeOf,
  };
  return { deps, store, ledger, records, fal };
}

// ── the router: a typed field, never a keyword rule ─────────────────────────

const use = (input) => ({ content: [{ type: "tool_use", name: "route_message", input }] });

test("a supplied router answer with model3d reaches the routing result; one without does not invent it", () => {
  const opts = { live: true, hasSite: true, pages: ["/", "/shop"] };
  const r = readRouting(use({ intent: "addon", model3d: { from: "words", subject: "a walnut armchair", page: "/shop" } }), opts);
  assert.equal(r.intent, "addon");
  assert.deepEqual(r.model3d, { from: "words", subject: "a walnut armchair", page: "/shop" });
  const p = readRouting(use({ intent: "addon", model3d: { from: "photo", subject: "this chair" } }), opts);
  assert.deepEqual(p.model3d, { from: "photo", subject: "this chair", page: "/" });
  const plain = readRouting(use({ intent: "addon" }), opts);
  assert.equal(plain.model3d, undefined);
  const trace = { reasons: [] };
  const bad = readRouting(use({ intent: "addon", model3d: { from: "magic", subject: "x" } }), { ...opts, trace });
  assert.equal(bad.intent, "addon", "an unreadable 3D answer leaves the addition as it was");
  assert.equal(bad.model3d, undefined);
  assert.ok(trace.reasons.includes("model3d-unread"));
  const edit = readRouting(use({ intent: "edit", layer: "look", model3d: { from: "words", subject: "x" } }), opts);
  assert.equal(edit.model3d, undefined, "only an addition carries it");
  assert.equal(readModel3d({ from: "words", subject: "x", page: "/nope" }, { pages: ["/"] }).page, "/");
});

// ── the shared talk (2026-10-22): the route's lines into the site's talk record ──

const TALK = "0123456789abcdef0123456789abcdef";
function talkDeps(opts) {
  const r = routeDeps(opts);
  const said = [];
  r.deps.talk = async (id, text, end) => { said.push({ id, text, end }); };
  return { ...r, said };
}
