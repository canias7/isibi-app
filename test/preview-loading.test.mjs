// THE PREVIEW BEFORE THE DRAFT IS READ (2026-10-23, live on
// `saltmarsh-and-sparrow`): `siteDraftState` starts empty, so the first paint
// pointed the frame at the live address and a never-published site flashed
// "This site isn't published yet…". Now: a neutral loading state, the last
// draft address this session saw, and never the live placeholder for a site
// whose draft is not yet previewable. Run on the real functions out of chat.js.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const SRC = fs.readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");
function region() {
  const a = SRC.indexOf("function sitePreviewSrc(");
  const endMark = "return siteDraftFrame(site) ? null : d;\n}";
  const b = SRC.indexOf(endMark, a);
  assert.ok(a > 0 && b > a, "the preview functions' landmarks are in chat.js");
  return SRC.slice(a, b + endMark.length);
}
function load({ storage = {} } = {}) {
  const store = { ...storage };
  const ctx = {
    siteDraftState: {},
    sessionStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } },
  };
  vm.createContext(ctx);
  const api = vm.runInContext(region() + "\n;({ sitePreviewSrc, sitePreviewLoading, sitePreviewPending, siteDraftFailed, siteFrameMemo })", ctx);
  return { api, ctx, store };
}
const SITE = { id: "s1", slug: "saltmarsh-and-sparrow", url: "https://saltmarsh-and-sparrow.gofarther.app/", previewV: 3 };
const DRAFT = "https://saltmarsh-and-sparrow--draft-0123456789ab.gofarther.app/";
const ready = { ok: true, enabled: true, unpublished: true, preview: DRAFT, previewState: "ready", revision: 2, state: "saved" };

test("before the draft is read the frame loads nothing and shows its loading state — never the live address", () => {
  const { api } = load();
  assert.equal(api.sitePreviewSrc(SITE, "/"), "");
  assert.equal(api.sitePreviewLoading(SITE), true);
});

test("a draft seen this session opens at once on reopen, from memory and from sessionStorage", () => {
  const { api, ctx, store } = load();
  ctx.siteDraftState[SITE.slug] = ready;
  assert.equal(api.sitePreviewSrc(SITE, "/"), DRAFT + "?v=3");
  // A NEW PAGE LOAD: the reading is gone, the session's address stands.
  delete ctx.siteDraftState[SITE.slug];
  assert.equal(api.sitePreviewSrc(SITE, "/menu"), DRAFT + "menu?v=3");
  assert.equal(api.sitePreviewLoading(SITE), false);
  const fresh = load({ storage: store });
  assert.equal(fresh.api.sitePreviewSrc(SITE, "/"), DRAFT + "?v=3", "sessionStorage did not carry the address");
});

test("once read: no draft ahead is the live address; a reading that failed falls back to it too", () => {
  const { api, ctx } = load();
  ctx.siteDraftState[SITE.slug] = { ok: true, enabled: true, unpublished: false, state: "published" };
  assert.equal(api.sitePreviewSrc(SITE, "/"), SITE.url + "?v=3");
  const b = load();
  b.api.siteDraftFailed[SITE.slug] = true;
  assert.equal(b.api.sitePreviewSrc(SITE, "/"), SITE.url + "?v=3");
});

test("a never-published site whose draft preview is not ready yet waits, never showing the live placeholder", () => {
  const { api, ctx } = load();
  ctx.siteDraftState[SITE.slug] = { ...ready, previewState: "pending", state: "unpublished" };
  assert.equal(api.sitePreviewSrc(SITE, "/"), "");
  assert.equal(api.sitePreviewLoading(SITE), true);
  // A PUBLISHED SITE'S DRAFT NOT READY: the live site is real, and shown as before.
  ctx.siteDraftState[SITE.slug] = { ...ready, previewState: "pending", state: "saved" };
  assert.equal(api.sitePreviewSrc(SITE, "/"), SITE.url + "?v=3");
});

test("the first reading repaints the workspace even when the frame's key did not move, and the frame draws its loading state", () => {
  const a = SRC.indexOf("async function loadDraftState(");
  const body = SRC.slice(a, SRC.indexOf("\n}\n", a));
  assert.match(body, /const firstRead = !Object\.prototype\.hasOwnProperty\.call\(siteDraftState, slug\);/);
  assert.match(body, /if \(firstRead && siteDraftFrameKey\(d\) === was && siteOpenId === site\.id && typeof renderSites === 'function'\) renderSites\(\);/);
  assert.match(body, /siteDraftFailed\[slug\] = true;/);
  assert.match(SRC, /\(frameLoading \? '<div class="st-frame-loading" role="status">/);
});
