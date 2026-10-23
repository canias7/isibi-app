// THE OWNER'S CHOSEN OPTIONS FOR AUDIT FINDINGS 20, 22, 23, 24 AND 25
// (2026-10-23; docs/history/2026-10-23-decide-media.md).
import test from "node:test";
import assert from "node:assert/strict";
import { qrCodesOnHost, qrForgetRefusal } from "../builder/site-qr-list.mjs";
import { runNavEdit, navSlots, NAV_TOOL } from "../builder/site-nav.mjs";

// ── 20 (#115, A10-4): a draft file moved into the site before the edit ─────
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { loadWorker, makeCtx } from "./fixtures/worker-harness.mjs";
import { withWire, envFor, USER } from "./fixtures/live-ask.mjs";
import { mediaBucket } from "./fixtures/r2-media.mjs";
import { MEDIA_PART_BYTES } from "../site-media.mjs";
const SiteMedia = createRequire(import.meta.url)("../public/site-media.js");
const mfix = (n) => new Uint8Array(readFileSync(new URL("./fixtures/media/" + n, import.meta.url)));
async function mcall(worker, env, method, path, { body, json } = {}) {
  const init = { method, headers: { Authorization: "Bearer some-token" } };
  if (json !== undefined) { init.body = JSON.stringify(json); init.headers["content-type"] = "application/json"; }
  if (body !== undefined) { init.body = body; init.headers["content-length"] = String(body.length); }
  const res = await worker.fetch(new Request("https://gofarther.dev" + path, init), env, makeCtx());
  let parsed = null;
  try { parsed = JSON.parse(await res.text()); } catch { parsed = null; }
  return { status: res.status, body: parsed };
}
async function mupload(worker, env, base, bytes, name) {
  const st = await mcall(worker, env, "POST", base, { json: { name, size: bytes.length, type: "" } });
  const parts = [];
  for (let n = 1; n <= st.body.parts; n++) {
    const p = await mcall(worker, env, "PUT", base + "/" + st.body.session + "/" + n, { body: bytes.subarray((n - 1) * MEDIA_PART_BYTES, n * MEDIA_PART_BYTES) });
    parts.push({ n, etag: p.body.etag });
  }
  return mcall(worker, env, "POST", base + "/" + st.body.session + "/complete", { json: { parts } });
}

test("POST /media/adopt moves the caller's draft into the site's library, and another account's site refuses", async () => {
  const worker = await loadWorker();
  const store = mediaBucket();
  const env = envFor(store);
  const slug = "adopt-site";
  let name = "";
  await withWire({}, async () => {
    const done = await mupload(worker, env, "/api/media/drafts", mfix("tone.wav"), "Jingle.wav");
    assert.equal(done.status, 201, JSON.stringify(done.body));
    name = done.body.name;
  });
  await withWire({}, async () => {
    const r = await mcall(worker, env, "POST", "/api/site/" + slug + "/media/adopt", { json: { files: [name] } });
    assert.equal(r.status, 404, "another account's site took the draft: " + JSON.stringify(r.body));
    assert.ok(store.store.has("drafts/" + USER.id + "/" + name), "the draft moved anyway");
  }, { owner: "someone-else" });
  await withWire({}, async () => {
    const r = await mcall(worker, env, "POST", "/api/site/" + slug + "/media/adopt", { json: { files: [name, "0".repeat(32) + ".mp4"] } });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.deepEqual(r.body.placed.map((f) => f.file), [name]);
    assert.match(r.body.placed[0].url, new RegExp("/u/" + slug + "/" + name));
    assert.equal(r.body.missing.length, 1, "a name the account does not hold was not said");
    assert.ok(store.store.has("uploads/" + slug + "/" + name), "the file is not in the site's library");
    assert.ok(!store.store.has("drafts/" + USER.id + "/" + name), "the draft was kept after the move");
  });
});

test("SiteMedia.adopt turns ready draft chips into library files, and refuses to send on a failed move", async () => {
  const chips = [
    { name: "promo.mp4", ref: "a".repeat(32) + ".mp4", draft: true, state: "done", url: "" },
    { name: "song.mp3", ref: "b".repeat(32) + ".mp3", draft: false, state: "done", url: "/u/s/b.mp3" },
  ];
  const sent = [];
  const ok = await SiteMedia.adopt("kiln", chips, async (path, body) => { sent.push([path, body]); return { status: 200, body: { ok: true, placed: [{ name: "promo.mp4", file: chips[0].ref, url: "/u/kiln/" + chips[0].ref }], missing: [] } }; });
  assert.equal(ok.ok, true);
  assert.deepEqual(sent, [["/api/site/kiln/media/adopt", { files: [chips[0].ref] }]]);
  assert.equal(chips[0].draft, false);
  assert.equal(chips[0].url, "/u/kiln/" + chips[0].ref);
  const c2 = [{ name: "promo.mp4", ref: "c".repeat(32) + ".mp4", draft: true, state: "done" }];
  const no = await SiteMedia.adopt("kiln", c2, async () => ({ status: 200, body: { ok: true, placed: [], missing: [{ file: c2[0].ref, why: "it was no longer kept" }] } }));
  assert.equal(no.ok, false);
  assert.match(no.error, /“promo\.mp4” \(it was no longer kept\).*nothing was sent/);
  const down = await SiteMedia.adopt("kiln", [{ name: "x.mp4", ref: "d".repeat(32) + ".mp4", draft: true, state: "done" }], async () => ({ status: 503, body: null }));
  assert.equal(down.ok, false);
});

test("the composer moves draft chips before an edit is sent", () => {
  const src = readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");
  const at = src.indexOf("function siteSend(");
  assert.ok(at > 0);
  const body = src.slice(at, src.indexOf("\nfunction ", at + 10));
  const move = body.indexOf("SiteMedia.adopt(");
  const line = body.indexOf("ready.map(mediaRefLine)");
  assert.ok(move > 0 && line > move, "the draft move does not come before the message is composed");
});

// DECIDE-ALL (2026-10-23): with one busy state per project (#138), the owner
// can open another project while the move is out. The words are then not sent
// (they belong to the project the files moved into), and that must be said,
// not dropped without a word.
test("a move that lands after the owner opened another project says the message was not sent", () => {
  const src = readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");
  const at = src.indexOf("function siteSend(");
  assert.ok(at > 0);
  const body = src.slice(at, src.indexOf("\nfunction ", at + 10));
  const move = body.indexOf("SiteMedia.adopt(");
  assert.ok(move > 0, "the draft move is gone");
  const after = body.slice(move, body.indexOf("return;\n    }", move));
  const resend = after.indexOf("siteOpenId === owner");
  assert.ok(resend > 0, "the resend is no longer tied to the project the files moved into");
  assert.match(after.slice(resend), /else[\s\S]{0,80}sbToast\(/, "a move landing on another open project drops the message without a word");
});

// ── 22 (#162, A25-1): a photo attached to a message is stored and offered first
import { jobBody } from "../builder/request.mjs";
import { storeAttachedPhotos, attachedFirst } from "../builder/attached-photos.mjs";
import { pictureRequest } from "../builder/site-picture.mjs";
import { attachments } from "../builder/site-context.mjs";
const PNG = "data:image/png;base64,iVBORw0KGgo=";

test("a picture part's job carries the request's photos, as a logo part's does; a text part's does not", () => {
  const body = (layer) => {
    const rec = { key: "rqk", slug: "s", picker: "sonnet", message: "use this photo for the hero", files: [PNG], digest: { pages: ["/"] },
      parts: [{ n: 0, words: "use this photo for the hero", route: { intent: "edit", op: "edit", layer }, jobs: [], held: [], needs: [] }] };
    return jobBody(rec, 0, "run", "k", { files: rec.files }).body;
  };
  assert.deepEqual(body("picture").images, [PNG]);
  assert.deepEqual(body("logo").images, [PNG]);
  assert.equal(body("text").images, undefined);
});

test("the attached photo is stored as the owner's upload and listed first, marked, to the picture step", async () => {
  const named = attachments([PNG]).named;
  const stored = [];
  const r = await storeAttachedPhotos([PNG], named, async (name, bytes) => { stored.push([name, bytes.length]); return { url: "/u/kiln/" + "f".repeat(32) + ".png" }; });
  assert.equal(stored.length, 1, "the attached photo was not stored");
  assert.deepEqual(r.files.map((f) => [f.name, f.attached]), [["f".repeat(32) + ".png", true]]);
  const lib = attachedFirst(r.files, [{ name: "a".repeat(32) + ".jpg", url: "/u/kiln/a.jpg" }, { name: "f".repeat(32) + ".png", url: "/u/kiln/f.png" }]);
  assert.deepEqual(lib.map((f) => f.name), ["f".repeat(32) + ".png", "a".repeat(32) + ".jpg"]);
  const shown = pictureRequest({ instruction: "use this photo", slots: [{ page: "/", alt: "the shop" }], library: [{ name: "a.jpg", url: "/u/a.jpg" }, ...r.files] }).messages[0].content;
  const att = shown.indexOf("f".repeat(32) + ".png");
  assert.ok(att > 0 && att < shown.indexOf("a.jpg"), "the attached photo is not listed first");
  assert.match(shown, /ATTACHED TO THIS MESSAGE/);
  const bad = await storeAttachedPhotos([PNG], named, async () => ({ error: "too big" }));
  assert.deepEqual(bad.missing.map((m) => m.reason), ["too big"]);
});

test("the picture rung stores the message's photos and puts them first in its library", () => {
  const src = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const at = src.indexOf('if (eLayer === "picture") {');
  assert.ok(at > 0);
  const end = src.indexOf("runPictureEdit({", at);
  const lib = src.indexOf("library: async () => {", end);
  assert.ok(end > 0 && lib > 0);
  assert.match(src.slice(at, end), /storeAttachedPhotos\(/, "the rung does not store the attached photos");
  assert.match(src.slice(lib, lib + 1200), /attachedFirst\(picAttached\.files,/, "the library does not list them first");
});

// ── 23 (#168, A26-4): a logo attached to the first build goes in the header ─
import { driveBuild, GOOD_DESIGN, BRIEF, JPEG_DATA } from "./fixtures/build-route.mjs";
import { ownLogoSentence } from "../builder/attached-photos.mjs";
const buildBody = (extra = {}) => ({ brief: BRIEF, images: [], qa: [], chat: "c", ...extra });

test("the design names the attached logo; it is stored and the header mark is its image", async () => {
  const r = await driveBuild({ design: { input: { ...GOOD_DESIGN, logo: "attachment-1" } }, body: buildBody({ brief: BRIEF + " Use the attached logo.", images: [{ name: "logo.jpg", data: JPEG_DATA }] }) });
  const uploads = [...r.store.keys()].filter((k) => k.startsWith("uploads/harbour-loaf/"));
  assert.equal(uploads.length, 1, "the logo was not stored");
  assert.deepEqual(r.config.look.wordmark, { form: "image", url: "/u/harbour-loaf/" + uploads[0].split("/").pop() });
  assert.match(r.reply.contextNote || "", /Your logo logo\.jpg is in the header/);
});

test("a named logo that cannot be found tells the customer to send it now as a logo change", async () => {
  const r = await driveBuild({ design: { input: { ...GOOD_DESIGN, logo: "attachment-4" } }, body: buildBody({ images: [{ name: "logo.jpg", data: JPEG_DATA }] }) });
  assert.notEqual(r.config.look.wordmark && r.config.look.wordmark.form, "image");
  assert.match(r.reply.contextNote || "", /send it again now as a logo change/);
});

test("the design tool offers the logo field, and no logo named stores nothing", async () => {
  const r = await driveBuild({ design: { input: GOOD_DESIGN }, body: buildBody({ images: [{ name: "inspo.jpg", data: JPEG_DATA }] }) });
  assert.equal([...r.store.keys()].filter((k) => k.startsWith("uploads/")).length, 0);
  assert.equal(ownLogoSentence(null), "");
  const src = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  assert.match(src, /\n {6}logo: \{\n {8}type: "string",/, "the design tool has no logo field");
});

// ── 24 (#173, A27-7): a menu change about one page applies only there ───────
const navPage = (p, links) => ({
  path: "src/routes/" + p,
  source: `import { SiteChrome } from "@/components/ui/site-chrome";\nexport default function P() {\n  return (\n    <SiteChrome name="Kiln" links={[${links}]}>\n      <h1>Hello</h1>\n    </SiteChrome>\n  );\n}\n`,
});
const NAV_ROUTES = ["/", "/menu", "/status"];
const FULL = `{ label: "Home", href: "/" }, { label: "Menu", href: "/menu" }, { label: "Status", href: "/status" }`;
const navSays = (input) => ({ send: async () => ({ content: [{ type: "tool_use", input }], usage: { input_tokens: 1, output_tokens: 1 } }) });
const menuOf = (pages, file) => navSlots(pages.filter((p) => p.path.endsWith(file)))[0].items.map((i) => i.label);

test("the menu tool offers a per-page option and no longer says it is one menu everywhere", () => {
  const p = NAV_TOOL.input_schema.properties.menuPages;
  assert.ok(p && p.type === "array", "the menu tool has no per-page option");
  assert.doesNotMatch(NAV_TOOL.description, /same menu on every page/);
});

test("a removal scoped to one page takes the item off that page's menu only", async () => {
  const pages = [navPage("index.tsx", FULL), navPage("menu.tsx", FULL), navPage("status.tsx", FULL)];
  const r = await runNavEdit(navSays({ links: [{ label: "Menu", href: "/menu" }, { label: "Status", href: "/status" }], menuPages: ["/status"] }),
    { instruction: "On the status page, take Home out of the menu.", pages, routes: NAV_ROUTES });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual(r.changed, ["src/routes/status.tsx"]);
  assert.deepEqual(menuOf(r.pages, "status.tsx"), ["Menu", "Status"]);
  assert.deepEqual(menuOf(r.pages, "menu.tsx"), ["Home", "Menu", "Status"]);
});

test("an unscoped removal still changes every page's menu", async () => {
  const pages = [navPage("menu.tsx", FULL), navPage("status.tsx", FULL)];
  const r = await runNavEdit(navSays({ links: [{ label: "Menu", href: "/menu" }, { label: "Status", href: "/status" }] }),
    { instruction: "Take Home out of the menu.", pages, routes: NAV_ROUTES });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.changed.length, 2);
});

test("a scope naming a page the site does not have refuses by name and changes nothing", async () => {
  const pages = [navPage("menu.tsx", FULL), navPage("status.tsx", FULL)];
  const r = await runNavEdit(navSays({ links: [{ label: "Menu", href: "/menu" }], menuPages: ["/gallery"] }),
    { instruction: "x", pages, routes: NAV_ROUTES });
  assert.equal(r.ok, false);
  assert.match(r.msg, /no \/gallery page/);
});

// ── 25 (#189, A31-1): the codes that open an address about to be forgotten ──
test("qrCodesOnHost finds only web codes on exactly the forgotten host", () => {
  const qr = [
    { name: "a", points: "https://old-name.gofarther.app/gallery", label: "A" },
    { name: "b", points: "https://OLD-NAME.gofarther.app/", label: "B" },
    { name: "c", points: "https://new-name.gofarther.app/", label: "C" },
    { name: "d", points: "tel:+44123", label: "D" },
    { name: "e", points: "https://x.old-name.gofarther.app/", label: "E" },
  ];
  assert.deepEqual(qrCodesOnHost(qr, "old-name.gofarther.app").map((c) => c.name), ["a", "b"]);
  assert.deepEqual(qrCodesOnHost(qr, ""), []);
  assert.deepEqual(qrCodesOnHost(null, "old-name.gofarther.app"), []);
  const one = qrForgetRefusal("old-name.gofarther.app", [qr[0]]);
  assert.match(one, /the `a` code on your site still opens that address, so it would stop working/);
  const two = qrForgetRefusal("old-name.gofarther.app", [qr[0], qr[1]]);
  assert.match(two, /the `a` and `b` codes on your site still open that address, so they would stop working/);
});
