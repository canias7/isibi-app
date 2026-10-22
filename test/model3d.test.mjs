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
} from "../builder/site-3d.mjs";
import { model3dPrice, model3dStart, model3dPoll } from "../builder/model3d-route.mjs";
import { handleUpload, sniffUpload, uploadKind, UPLOAD_EXTS, MODEL_FORMATS, handleUploadList } from "../site-uploads.mjs";
import { readRouting, LIVE_ASK_TOOL, readModel3d } from "../builder/site-ask.mjs";
import { routeOf } from "../builder/site-addon.mjs";

const read = (p) => fs.readFileSync(new URL("../" + p, import.meta.url), "utf8");

// ── the request builders and the price ─────────────────────────────────────

test("the price is $1.20 at 1 credit = $0.008: 150 credits, and the model ids are fal's", () => {
  assert.equal(MODEL3D_CREDITS, 150);
  assert.equal(MESHY_TEXT_MODEL, "fal-ai/meshy/v7.1/text-to-3d");
  assert.equal(MESHY_IMAGE_MODEL, "fal-ai/meshy/v7.1/image-to-3d");
  assert.equal(model3dRef("Fold-Lane", "abcdefgh12"), "model3d:fold-lane:abcdefgh12");
});

test("text to 3D: textured (full), smart topology under fal's 15,000 ceiling, never rigged or animated", () => {
  const r = textTo3dRequest("  a walnut   armchair ");
  assert.equal(r.model, MESHY_TEXT_MODEL);
  assert.equal(r.input.prompt, "a walnut armchair");
  assert.equal(r.input.mode, "full");
  assert.equal(r.input.model_type, "smart-topology");
  assert.ok(r.input.target_polycount > 0 && r.input.target_polycount <= 15000);
  assert.equal(r.input.enable_rigging, false);
  assert.equal(r.input.enable_animation, false);
  assert.equal(r.input.enable_pbr, false);
  assert.ok(textTo3dRequest("").error);
  assert.ok(textTo3dRequest("x".repeat(601)).error);
  assert.ok(textTo3dRequest(["a chair"]).error, "a non-string is refused, never coerced");
});

test("photo to 3D: an https image only, textures on", () => {
  const r = imageTo3dRequest("https://gofarther.dev/u/cafe/ab.png", "oak");
  assert.equal(r.model, MESHY_IMAGE_MODEL);
  assert.equal(r.input.image_url, "https://gofarther.dev/u/cafe/ab.png");
  assert.equal(r.input.should_texture, true);
  assert.equal(r.input.texture_prompt, "oak");
  assert.equal(r.input.model_type, MESHY_SETTINGS.model_type);
  assert.ok(imageTo3dRequest("http://x.test/a.png").error);
  assert.ok(imageTo3dRequest("/u/cafe/ab.png").error);
  assert.ok(imageTo3dRequest("https://user:pw@x.test/a.png").error);
});

// ── the answer reader ──────────────────────────────────────────────────────

const ANSWER = {
  model_glb: { url: "https://v3.fal.media/files/a/model.glb", content_type: "model/gltf-binary" },
  model_urls: { glb: { url: "https://v3.fal.media/files/a/model.glb" }, usdz: { url: "https://v3.fal.media/files/a/model.usdz" }, fbx: { url: "https://v3.fal.media/files/a/model.fbx" } },
  thumbnail: { url: "https://v3.fal.media/files/a/thumb.png" },
  texture_urls: [{ base_color: { url: "https://v3.fal.media/files/a/base.png" } }],
  seed: 42,
};

test("the answer: glb, usdz and thumbnail taken; a missing or non-https glb refused", () => {
  const a = readModelAnswer(ANSWER);
  assert.deepEqual(a, { ok: true, glb: ANSWER.model_glb.url, usdz: ANSWER.model_urls.usdz.url, thumbnail: ANSWER.thumbnail.url, seed: 42 });
  assert.equal(readModelAnswer({ model_urls: { glb: { url: "https://x.test/m.glb" } } }).glb, "https://x.test/m.glb");
  assert.equal(readModelAnswer({}).ok, false);
  assert.equal(readModelAnswer(null).ok, false);
  assert.equal(readModelAnswer({ model_glb: { url: "http://x.test/m.glb" } }).ok, false);
  assert.equal(readModelAnswer({ model_glb: { url: "javascript:alert(1)" } }).ok, false);
  const noExtras = readModelAnswer({ model_glb: { url: "https://x.test/m.glb" }, thumbnail: { url: "http://x.test/t.png" } });
  assert.equal(noExtras.ok, true);
  assert.equal(noExtras.thumbnail, "", "a non-https thumbnail is dropped, never refused");
});

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

test("queue URLs are under the app, not the endpoint path", () => {
  assert.deepEqual(queueUrls(MESHY_TEXT_MODEL, "r1"), {
    status: "https://queue.fal.run/fal-ai/meshy/requests/r1/status",
    result: "https://queue.fal.run/fal-ai/meshy/requests/r1",
    cancel: "https://queue.fal.run/fal-ai/meshy/requests/r1/cancel",
  });
});

test("runQueue: submit to queue.fal.run (never fal.run), poll status, read the result", async () => {
  const st = falStub();
  let t = 0;
  const r = await runQueue({ fetch: st.fetch, sleep: async () => { t += 5000; }, now: () => t }, { key: "K", ...textTo3dRequest("a chair") });
  assert.equal(r.ok, true);
  assert.equal(r.answer.glb, ANSWER.model_glb.url);
  assert.ok(st.calls.every((c) => !c.url.startsWith("https://fal.run/")), "never the synchronous endpoint");
  assert.equal(st.calls[0].url, "https://queue.fal.run/" + MESHY_TEXT_MODEL);
  assert.equal(st.calls[0].method, "POST");
  assert.equal(st.calls[0].auth, "Key K");
  assert.equal(JSON.parse(st.calls[0].body).prompt, "a chair");
  assert.equal(st.calls.filter((c) => c.url.endsWith("/status")).length, 3);
});

test("runQueue: a bound — past maxMs it cancels and answers timeout", async () => {
  const st = falStub({ statuses: ["IN_PROGRESS"] });
  let t = 0;
  const r = await runQueue({ fetch: st.fetch, sleep: async () => { t += 5000; }, now: () => t }, { key: "K", ...textTo3dRequest("a chair"), maxMs: 20000 });
  assert.equal(r.ok, false);
  assert.equal(r.stage, "timeout");
  assert.ok(st.calls.some((c) => c.url.endsWith("/cancel") && c.method === "PUT"));
});

test("queueStatus: a failed result is failed; an unreadable status is still waiting (never refunded on a guess)", async () => {
  const st = falStub({ statuses: ["COMPLETED"], resultStatus: 422, result: { detail: "unsafe" } });
  const s = await queueSubmit({ fetch: st.fetch }, { key: "K", ...textTo3dRequest("a chair") });
  const f = await queueStatus({ fetch: st.fetch }, { key: "K", statusUrl: s.statusUrl, resultUrl: s.resultUrl });
  assert.equal(f.state, "failed");
  const w = await queueStatus({ fetch: async () => { throw new Error("net"); } }, { key: "K", statusUrl: s.statusUrl, resultUrl: s.resultUrl });
  assert.equal(w.state, "waiting");
  assert.equal(w.unread, true);
});

test("queueSubmit: a returned URL off fal's queue host is not followed", async () => {
  const fetch = async () => ({ ok: true, status: 200, json: async () => ({ request_id: "abcdefgh-1", status_url: "https://evil.test/s", response_url: "https://evil.test/r" }) });
  const s = await queueSubmit({ fetch }, { key: "K", ...textTo3dRequest("a chair") });
  assert.equal(s.statusUrl, "https://queue.fal.run/fal-ai/meshy/requests/abcdefgh-1/status");
  assert.equal(s.resultUrl, "https://queue.fal.run/fal-ai/meshy/requests/abcdefgh-1");
});

test("downloadCapped: refused over the cap by declared length and by what arrives", async () => {
  const big = { ok: true, status: 200, headers: { get: () => "999" }, arrayBuffer: async () => new ArrayBuffer(999) };
  assert.equal((await downloadCapped({ fetch: async () => big }, "https://x.test/a", 100)).tooBig, true);
  const lying = { ok: true, status: 200, headers: { get: () => null }, body: new Response(new Uint8Array(500)).body };
  assert.equal((await downloadCapped({ fetch: async () => lying }, "https://x.test/a", 100)).tooBig, true);
  const fine = { ok: true, status: 200, headers: { get: () => null }, body: new Response(new Uint8Array(50)).body };
  const r = await downloadCapped({ fetch: async () => fine }, "https://x.test/a", 100);
  assert.equal(r.ok, true);
  assert.equal(r.bytes.length, 50);
  assert.equal((await downloadCapped({ fetch: async () => fine }, "http://x.test/a", 100)).ok, false);
});

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

test("a .glb is sniffed by its glTF magic and stored as model/gltf-binary; a .usdz as model/vnd.usdz+zip", async () => {
  assert.deepEqual(sniffUpload(GLB(), "x.bin"), { mime: "model/gltf-binary", ext: "glb", kind: "model" });
  assert.deepEqual(sniffUpload(USDZ(), "chair.usdz"), { mime: "model/vnd.usdz+zip", ext: "usdz", kind: "model" });
  assert.equal(sniffUpload(USDZ(), "chair.zip").ext, "zip", "a zip not named usdz stays a zip");
  assert.equal(uploadKind("ab.glb"), "model");
  assert.ok(UPLOAD_EXTS.includes("glb") && UPLOAD_EXTS.includes("usdz"));
  assert.equal(MODEL_FORMATS.glb, "model/gltf-binary");
  const { deps, puts } = bucket();
  const r = await handleUpload(deps, { slug: "cafe", uid: "u", bytes: GLB(), filename: "chair.glb" });
  assert.equal(r.status, 201);
  assert.equal(r.body.kind, "model");
  assert.match(r.body.url, /^\/u\/cafe\/[a-f0-9]+\.glb$/);
  assert.equal(puts[0].ct, "model/gltf-binary");
  const u = await handleUpload(deps, { slug: "cafe", uid: "u", bytes: USDZ(), filename: "chair.usdz" });
  assert.equal(puts[1].ct, "model/vnd.usdz+zip");
  assert.equal(u.body.kind, "model");
});

test("a model has its own allowance: 50 MB a file, and pictures do not count it", async () => {
  const { deps, objects } = bucket();
  objects.push({ key: "uploads/cafe/aa.png", size: 99_000_000 });
  const ok = await handleUpload(deps, { slug: "cafe", uid: "u", bytes: GLB(2000), filename: "m.glb" });
  assert.equal(ok.status, 201, "a full picture allowance does not refuse a model");
  const big = GLB(50_000_001);
  const r = await handleUpload(deps, { slug: "cafe", uid: "u", bytes: big, filename: "m.glb" });
  assert.equal(r.status, 413);
  const list = await handleUploadList(deps, { slug: "cafe", uid: "u" });
  assert.equal(list.body.count, 1, "the model is not counted among the pictures");
});

test("the owner's upload route lets a 50 MB model through its outer bound; /u/ serves the stored type", () => {
  const w = read("worker.js");
  assert.match(w, /cl > Math\.max\(MAX_DOC_BYTES, MAX_MODEL_BYTES\)/);
  assert.match(w, /const ct = \(head\.httpMetadata && head\.httpMetadata\.contentType\)/, "/u/ answers with the type the file was stored under");
});

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

test("placeScene3D: the band goes inside the frame, after the page's bands; the import is added once", () => {
  const block = scene3dBlock({ src: "/u/cafe/ab.glb", poster: "/u/cafe/cd.png", label: 'Chair "Oak" </x>', key: "m3abc12345" });
  const r = placeScene3D(PAGE, block);
  assert.equal(r.ok, true);
  const s = r.source;
  assert.equal(s.split(SCENE3D_IMPORT).length - 1, 1);
  assert.ok(s.indexOf("<Scene3D") > s.indexOf("<h1>Shop</h1>") && s.indexOf("<Scene3D") < s.indexOf("</SiteChrome>"));
  assert.match(s, /src=\{"\/u\/cafe\/ab\.glb"\}/);
  assert.match(s, /poster=\{"\/u\/cafe\/cd\.png"\}/);
  assert.match(s, /label=\{"Chair \\"Oak\\" <\/x>"\}/, "a label is a JS string literal, never raw JSX text");
  assert.ok(s.includes('import { SiteChrome } from "@/components/ui/site-chrome";'));
  // Everything else is unchanged.
  assert.equal(s.replace(block, "").replace(SCENE3D_IMPORT + "\n", ""), PAGE);
  const again = placeScene3D(s, block);
  assert.equal(again.source.split(SCENE3D_IMPORT).length - 1, 1, "a second model does not import twice");
  assert.equal(placeScene3D("export default 1", block).ok, false);
});

test("the label drops the ask's verb", () => {
  assert.equal(model3dLabel("make a 3D model of our walnut armchair"), "Our walnut armchair");
  assert.equal(model3dLabel(""), "3D model");
});

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

test("estimate: the price before anything is spent, with the balance", async () => {
  const { deps, ledger, fal } = routeDeps();
  const r = await model3dPrice(deps);
  assert.equal(r.status, 200);
  assert.equal(r.body.estimate.credits, 150);
  assert.equal(r.body.balance, 500);
  assert.equal(ledger.debits.length, 0);
  assert.equal(fal.calls.length, 0);
});

test("start: debit exactly the price under model3d:<slug>:<key>, then submit to fal's queue", async () => {
  const { deps, ledger, fal } = routeDeps();
  const r = await model3dStart(deps, { slug: "cafe", body: { key: "m3abcdef1234", prompt: "make a 3D model of a walnut armchair", page: "/shop" } });
  assert.equal(r.status, 200);
  assert.equal(r.body.cost, 150);
  assert.deepEqual(ledger.debits, [{ amount: 150, ref: "model3d:cafe:m3abcdef1234" }]);
  assert.equal(fal.calls.length, 1);
  assert.equal(fal.calls[0].url, "https://queue.fal.run/" + MESHY_TEXT_MODEL);
  // The same key again is the same model: no second debit, no second submit.
  const again = await model3dStart(deps, { slug: "cafe", body: { key: "m3abcdef1234", prompt: "x" } });
  assert.equal(again.body.again, true);
  assert.equal(ledger.debits.length, 1);
  assert.equal(fal.calls.length, 1);
});

test("start: a short balance is refused by the ledger before fal is asked anything", async () => {
  const { deps, fal } = routeDeps({ debitOk: false });
  const r = await model3dStart(deps, { slug: "cafe", body: { key: "m3abcdef1234", prompt: "a chair" } });
  assert.equal(r.status, 402);
  assert.equal(r.body.cost, 0);
  assert.equal(fal.calls.length, 0);
});

test("start: switched off, or no fal key, refuses with nothing charged", async () => {
  for (const o of [{ off: true }, { falKey: "" }]) {
    const { deps, ledger, fal } = routeDeps(o);
    const r = await model3dStart(deps, { slug: "cafe", body: { key: "m3abcdef1234", prompt: "a chair" } });
    assert.ok(r.status >= 500);
    assert.equal(ledger.debits.length, 0);
    assert.equal(fal.calls.length, 0);
  }
});

test("start: fal refusing the submit reverses the debit by its ref", async () => {
  const { deps, ledger } = routeDeps({ fal: falStub({ submitStatus: 500 }) });
  const r = await model3dStart(deps, { slug: "cafe", body: { key: "m3abcdef1234", prompt: "a chair" } });
  assert.equal(r.status, 502);
  assert.deepEqual(ledger.reversals, [{ ref: "model3d:cafe:m3abcdef1234", amount: 150 }]);
  assert.equal(r.body.cost, 0);
});

test("start: a photograph is stored as the owner's upload and fal is given its public https address", async () => {
  const { deps, fal, store } = routeDeps();
  const png = "data:image/png;base64," + Buffer.from(PNG()).toString("base64");
  const r = await model3dStart(deps, { slug: "cafe", body: { key: "m3abcdef1234", image: png, prompt: "our chair" } });
  assert.equal(r.status, 200);
  const sent = JSON.parse(fal.calls[0].body);
  assert.equal(fal.calls[0].url, "https://queue.fal.run/" + MESHY_IMAGE_MODEL);
  assert.match(sent.image_url, /^https:\/\/gofarther\.dev\/u\/cafe\/[a-f0-9]+\.png$/);
  assert.equal(store.puts[0].ct, "image/png");
});

test("poll: waiting, then done — the .glb, .usdz and poster stored with their types, Scene3D placed, published, cost named", async () => {
  const fal = falStub({ statuses: ["IN_PROGRESS", "COMPLETED"], files: FILES });
  const { deps, store, ledger } = routeDeps({ fal });
  await model3dStart(deps, { slug: "cafe", body: { key: "m3abcdef1234", prompt: "make a 3D model of a walnut armchair", page: "/shop" } });
  const w = await model3dPoll(deps, { slug: "cafe", key: "m3abcdef1234" });
  assert.equal(w.body.state, "waiting");
  const d = await model3dPoll(deps, { slug: "cafe", key: "m3abcdef1234" });
  assert.equal(d.body.state, "done");
  assert.equal(d.body.placed, true);
  assert.equal(d.body.cost, 150);
  assert.match(d.body.reply, /150 credits/);
  assert.deepEqual(store.puts.map((p) => p.ct), ["model/gltf-binary", "model/vnd.usdz+zip", "image/png"]);
  assert.equal(ledger.published.length, 1);
  const shop = ledger.published[0].pages.find((p) => p.path === "shop.tsx").source;
  assert.ok(shop.includes(SCENE3D_IMPORT));
  assert.ok(shop.includes('src={"' + d.body.glb + '"}'));
  assert.ok(shop.includes('poster={"' + d.body.poster + '"}'));
  assert.ok(!shop.includes("fal.media"), "the page points at our stored copy, never fal's expiring address");
  assert.equal(ledger.published[0].pages.find((p) => p.path === "index.tsx").source, PAGE.replace("/shop", "/"), "other pages untouched");
  assert.equal(ledger.reversals.length, 0);
  // Asked again, it is answered from the record: nothing downloaded or published twice.
  const n = fal.calls.length;
  const again = await model3dPoll(deps, { slug: "cafe", key: "m3abcdef1234" });
  assert.equal(again.body.state, "done");
  assert.equal(fal.calls.length, n);
  assert.equal(ledger.published.length, 1);
});

test("poll: a failed generation is reversed in full, once", async () => {
  const fal = falStub({ statuses: ["COMPLETED"], resultStatus: 422, result: { detail: "unsafe prompt" } });
  const { deps, ledger } = routeDeps({ fal });
  await model3dStart(deps, { slug: "cafe", body: { key: "m3abcdef1234", prompt: "a chair" } });
  const f = await model3dPoll(deps, { slug: "cafe", key: "m3abcdef1234" });
  assert.equal(f.body.state, "failed");
  assert.equal(f.body.cost, 0);
  assert.match(f.body.reply, /150 credits are back/);
  await model3dPoll(deps, { slug: "cafe", key: "m3abcdef1234" });
  assert.deepEqual(ledger.reversals, [{ ref: "model3d:cafe:m3abcdef1234", amount: 150 }]);
});

test("poll: a model file that is not glTF is not stored, and the debit is reversed", async () => {
  const fal = falStub({ statuses: ["COMPLETED"], files: { ...FILES, [ANSWER.model_glb.url]: PNG() } });
  const { deps, ledger } = routeDeps({ fal });
  await model3dStart(deps, { slug: "cafe", body: { key: "m3abcdef1234", prompt: "a chair" } });
  const f = await model3dPoll(deps, { slug: "cafe", key: "m3abcdef1234" });
  assert.equal(f.body.state, "failed");
  assert.equal(ledger.reversals.length, 1);
});

test("poll: a page that cannot take it keeps the model (made and charged) and says so", async () => {
  const fal = falStub({ statuses: ["COMPLETED"], files: FILES });
  const { deps, ledger } = routeDeps({ fal, pages: [{ path: "index.tsx", source: "export default 1" }] });
  await model3dStart(deps, { slug: "cafe", body: { key: "m3abcdef1234", prompt: "a chair" } });
  const d = await model3dPoll(deps, { slug: "cafe", key: "m3abcdef1234" });
  assert.equal(d.body.state, "done");
  assert.equal(d.body.placed, false);
  assert.match(d.body.reply, /couldn.t place it/);
  assert.equal(ledger.published.length, 0);
  assert.equal(ledger.reversals.length, 0);
});

// ── the route's place in the Worker: owner only ────────────────────────────

test("the Worker: /model3d is an owner route — dispatched in the owner block and gated by assertOwner before any work", () => {
  const w = read("worker.js");
  assert.match(w, /const m3d = url\.pathname\.match\(\/\^\\\/api\\\/site\\\/\(\[a-z0-9\]\[a-z0-9-\]\{0,80\}\)\\\/model3d\$\/i\);/);
  // RE-ANCHORED 2026-10-22 (combine): the security route `sc` sits beside it.
  assert.match(w, /\|\| sq \|\| (?:sc \|\| )?qu \|\| m3d\) \{/);
  assert.match(w, /\|\| sq \|\| (?:sc \|\| )?qu \|\| m3d\)\[1\]\.toLowerCase\(\)/);
  const at = w.indexOf("if (m3d) {");
  assert.ok(at > 0);
  const body = w.slice(at, w.indexOf("if (qu) {", at));
  const gate = body.indexOf("assertOwner(ownerDeps, ownerSlug, ou.id)");
  assert.ok(gate > 0, "assertOwner is called");
  for (const work of ["model3dPrice(", "model3dPoll(", "model3dStart("]) assert.ok(body.indexOf(work) > gate, work + " runs only after the owner gate");
  // The replay grant is only for the edit, addon and rebuild routes: never this one.
  assert.match(w, /const eReplay = \(ed \|\| ad \|\| rb\) \?/);
  // The deps: the platform key, the ledger by ref, the owner's own upload caps.
  assert.match(w, /falKey: env\.FAL_KEY \|\| ""/);
  assert.match(w, /debit: \(amount, ref\) => debitCredits\(auth, amount, ref, "model3d", false\)/);
  assert.match(w, /reverse: \(ref, amount\) => reverseCredits\(env, uid, ref, "model3d-refund", amount\)/);
});

// ── the router: a typed field, never a keyword rule ─────────────────────────

const use = (input) => ({ content: [{ type: "tool_use", name: "route_message", input }] });

test("the router's tool offers a typed model3d field beside intent addon", () => {
  const f = LIVE_ASK_TOOL.input_schema.properties.model3d;
  assert.ok(f && f.type === "object");
  assert.deepEqual(f.properties.from.enum, ["words", "photo"]);
  assert.deepEqual(f.required, ["from", "subject"]);
});

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

test("the routing reply forwards model3d to the page (the wiring layer)", () => {
  const w = read("worker.js");
  assert.equal((w.match(/model3d: routed\.intent === "addon" && routed\.model3d \? routed\.model3d : undefined,/g) || []).length, 2);
});

// ── the browser: the price confirmation before anything is spent ───────────

test("chat.js: a model3d answer shows the price first; only the Make it button starts the paid POST", () => {
  const c = read("public/chat.js");
  const route = c.indexOf("return siteModel3dOffer(site, d.model3d, origin, finish, sendImgs);");
  assert.ok(route > 0 && route < c.indexOf("if (d.intent === 'addon' && site.slug) return siteAddon("), "the offer is checked before the ordinary addition");
  const offer = c.slice(c.indexOf("async function siteModel3dOffer("), c.indexOf("function siteModel3dHTML("));
  assert.ok(offer.includes("/model3d?estimate=1"));
  assert.ok(!/method: 'POST'/.test(offer), "the offer never spends");
  const go = c.slice(c.indexOf("async function siteModel3dGo("), c.indexOf("// The middle rung: add a page or a table"));
  assert.ok(/method: 'POST'/.test(go));
  assert.ok(go.includes("Making your 3D model"));
  assert.equal((c.match(/siteModel3dGo\(/g) || []).length, 2, "defined once, called once — from the button");
  assert.ok(c.includes("closest('[data-m3d-go]')"));
  assert.ok(c.includes("siteModel3dHTML(m, site)"));
});

test("the page writer: Scene3D with a stored model only where they asked, still almost never on its own", () => {
  const p = read("builder/page-gen.mjs");
  assert.match(p, /3D IS AVAILABLE AND IS ALMOST NEVER RIGHT/);
  assert.match(p, /A 3D MODEL THE SITE ALREADY HAS/);
  assert.match(p, /never on your own initiative/);
});
