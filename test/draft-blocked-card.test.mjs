// THE BLOCKED CARD (2026-10-18, audit batch 2, step 9), in a real Chromium:
// the Publish panel's own function, run on the app's own stylesheet, shown a
// draft state whose publication is blocked on one held change. It says which
// change and why, offers Set aside and Edit, and Set aside sends the blocked
// revision to the set-aside route; with nothing blocked the card is not there.
//
// A screenshot goes to $CONTENT_SHOTS when it is set.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";

const PUB = new URL("../public/", import.meta.url).pathname;
const EXE = "/opt/pw-browsers/chromium";
let chromium = null;
try { ({ chromium } = await import("playwright-core")); } catch { chromium = null; }
const SKIP = !(chromium && existsSync(EXE)) && "no browser here (playwright-core and Chromium are not installed)";
const SHOTS = process.env.CONTENT_SHOTS || "";

/** `siteDraftPanel`, landmark to landmark, both landmarks proven present first. */
function panelSource() {
  const src = readFileSync(PUB + "chat.js", "utf8");
  const a = src.indexOf("function siteDraftPanel(site, d) {");
  const b = src.indexOf("function sitePublishPanel(site) {");
  assert.ok(a > 0 && b > a, "the panel's landmarks are not where they were");
  return src.slice(a, b);
}

const BLOCKED = {
  enabled: true, state: "publishing", unpublished: true, revision: 3, draft: "01790000000003-cccccc", neverPublished: false,
  publication: { revision: 3, phase: "switched", running: false, finishing: true, checking: false, error: "inserts: x", blocked: { stage: "inserts", why: "a held entry clashes with one already on the list" } },
};

async function render(state) {
  const b = await chromium.launch({ executablePath: EXE });
  const page = await (await b.newContext({ viewport: { width: 760, height: 620 } })).newPage();
  await page.setContent("<!doctype html><html><head><style>" + readFileSync(PUB + "styles.css", "utf8") + "</style></head><body><textarea id=\"stRevise\"></textarea></body></html>");
  await page.addScriptTag({ content: `
    window.sent = []; window.toasts = [];
    const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
    const siteChipUrl = ({ slug }) => slug + ".gofarther.app";
    const siteDraftState = {}; const paintDraftChip = () => {}; const siteDraftFrameKey = () => ""; const siteDraftFollow = () => {};
    const sbToast = (t) => window.toasts.push(t);
    const apiFetch = async (url, init) => { window.sent.push({ url, body: JSON.parse(init.body) }); return new Response(JSON.stringify({ ok: true, skipped: [{ stage: "inserts" }], state: { state: "published" } }), { status: 200 }); };
    ${panelSource()}
    window.siteDraftPanel = siteDraftPanel;
  ` });
  await page.evaluate((d) => window.siteDraftPanel({ slug: "fold-lane-bakery" }, d), state);
  return { b, page };
}

test("SB1 THE BLOCKED CARD NAMES THE CHANGE AND OFFERS SET ASIDE AND EDIT; SET ASIDE SENDS THE BLOCKED REVISION; WITHOUT A BLOCK THERE IS NO CARD", { skip: SKIP }, async () => {
  const { b, page } = await render(BLOCKED);
  try {
    const card = page.locator(".sp-blocked");
    assert.equal(await card.count(), 1, "no blocked card");
    assert.match(await card.innerText(), /1 change could not be published[\s\S]*clashes with one already on the list/);
    assert.equal(await page.locator("#spSetAside").isVisible(), true);
    assert.equal(await page.locator("#spEditBlocked").isVisible(), true);
    assert.equal(await page.locator("#spPublishDraft").count(), 0, "the ordinary Publish button sits beside a blocked change");
    if (SHOTS) { mkdirSync(SHOTS, { recursive: true }); await page.locator(".si-card").screenshot({ path: path.join(SHOTS, "setaside-card.png") }); }
    await page.click("#spSetAside");
    await page.waitForFunction(() => window.sent.length === 1);
    assert.deepEqual(await page.evaluate(() => window.sent), [{ url: "/api/site/fold-lane-bakery/publish/set-aside", body: { revision: 3 } }]);
    assert.match((await page.evaluate(() => window.toasts)).join(" "), /1 change was set aside/);
  } finally { await b.close(); }
  // EDIT: the panel closes and the chat box has the focus.
  const e = await render(BLOCKED);
  try {
    await e.page.click("#spEditBlocked");
    assert.equal(await e.page.locator("#sitePubModal").count(), 0, "Edit did not close the panel");
    assert.equal(await e.page.evaluate(() => document.activeElement && document.activeElement.id), "stRevise");
  } finally { await e.b.close(); }
  // THE OBSERVER IS ALIVE: the same panel without a block has no card and its Publish button.
  const n = await render({ ...BLOCKED, state: "saved", publication: null });
  try {
    assert.equal(await n.page.locator(".sp-blocked").count(), 0);
    assert.equal(await n.page.locator("#spPublishDraft").count(), 1);
  } finally { await n.b.close(); }
});
