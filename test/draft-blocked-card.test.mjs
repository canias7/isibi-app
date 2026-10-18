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
    window.confirm = () => true;
    const apiFetch = async (url, init) => { window.sent.push({ url, body: JSON.parse(init.body) }); return new Response(JSON.stringify({ ok: true, skipped: [{ stage: "inserts" }], state: { state: "published" } }), { status: 200 }); };
    ${panelSource()}
    window.siteDraftPanel = siteDraftPanel;
  ` });
  await page.evaluate((d) => window.siteDraftPanel({ slug: "fold-lane-bakery" }, d), state);
  return { b, page };
}

test("SB1 THE BLOCKED CARD NAMES THE CHANGE AND OFFERS SET ASIDE AND NOT NOW; SET ASIDE SENDS THE BLOCKED REVISION; WITHOUT A BLOCK THERE IS NO CARD", { skip: SKIP }, async () => {
  const { b, page } = await render(BLOCKED);
  try {
    const card = page.locator(".sp-blocked");
    assert.equal(await card.count(), 1, "no blocked card");
    assert.match(await card.innerText(), /1 change could not be published[\s\S]*clashes with one already on the list/);
    assert.equal(await page.locator("#spSetAside").isVisible(), true);
    assert.equal(await page.locator("#spNotNow").isVisible(), true);
    assert.match(await card.innerText(), /ask for it again in the chat/, "the card promises an edit that cannot get past the blocked change");
    assert.equal(await page.locator("#spPublishDraft").count(), 0, "the ordinary Publish button sits beside a blocked change");
    if (SHOTS) { mkdirSync(SHOTS, { recursive: true }); await page.locator(".si-card").screenshot({ path: path.join(SHOTS, "setaside-card.png") }); }
    await page.click("#spSetAside");
    await page.waitForFunction(() => window.sent.length === 1);
    assert.deepEqual(await page.evaluate(() => window.sent), [{ url: "/api/site/fold-lane-bakery/publish/set-aside", body: { revision: 3 } }]);
    assert.match((await page.evaluate(() => window.toasts)).join(" "), /1 change was set aside/);
  } finally { await b.close(); }
  // NOT NOW: the panel closes and nothing is sent.
  const e = await render(BLOCKED);
  try {
    await e.page.click("#spNotNow");
    assert.equal(await e.page.locator("#sitePubModal").count(), 0, "Not now did not close the panel");
    assert.equal(await e.page.evaluate(() => window.sent.length), 0);
  } finally { await e.b.close(); }
  // STOPPED AT ITS SWITCH, the card does not claim the pages are live.
  const u = await render({ ...BLOCKED, publication: { ...BLOCKED.publication, phase: "switching", finishing: false, checking: true } });
  try { assert.match(await u.page.locator(".sp-blocked").innerText(), /may already be live/); }
  finally { await u.b.close(); }
  // THE OBSERVER IS ALIVE: the same panel without a block has no card and its Publish button.
  const n = await render({ ...BLOCKED, state: "saved", publication: null });
  try {
    assert.equal(await n.page.locator(".sp-blocked").count(), 0);
    assert.equal(await n.page.locator("#spPublishDraft").count(), 1);
  } finally { await n.b.close(); }
});

test("SB2 DISCARD DRAFT: OFFERED ON AN UNPUBLISHED DRAFT, ASKS FIRST, SENDS TO THE DISCARD ROUTE; NEVER ON A SITE NOT YET PUBLISHED, NOR WHILE PUBLISHING", { skip: SKIP }, async () => {
  const saved = { enabled: true, state: "saved", unpublished: true, revision: 2, draft: "01790000000002-bbbbbb", neverPublished: false, publication: null };
  const { b, page } = await render(saved);
  try {
    assert.equal(await page.locator("#spDiscardDraft").isVisible(), true, "no Discard draft button");
    if (SHOTS) { mkdirSync(SHOTS, { recursive: true }); await page.locator(".si-card").screenshot({ path: path.join(SHOTS, "discard-draft.png") }); }
    await page.evaluate(() => { window.asked = 0; window.confirm = () => { window.asked++; return true; }; });
    await page.click("#spDiscardDraft");
    await page.waitForFunction(() => window.sent.length === 1);
    assert.deepEqual(await page.evaluate(() => [window.asked, window.sent[0].url]), [1, "/api/site/fold-lane-bakery/draft/discard"]);
  } finally { await b.close(); }
  // ASKED AND DECLINED: nothing sent.
  const c = await render(saved);
  try {
    await c.page.evaluate(() => { window.confirm = () => false; });
    await c.page.click("#spDiscardDraft");
    await new Promise((r) => setTimeout(r, 200));
    assert.equal(await c.page.evaluate(() => window.sent.length), 0, "a declined discard was sent");
  } finally { await c.b.close(); }
  for (const st of [{ ...saved, neverPublished: true }, { ...saved, state: "publishing" }, { ...saved, unpublished: false, revision: 0 }]) {
    const n = await render(st);
    try { assert.equal(await n.page.locator("#spDiscardDraft").count(), 0, "Discard offered for " + JSON.stringify([st.state, st.neverPublished, st.unpublished])); }
    finally { await n.b.close(); }
  }
});
