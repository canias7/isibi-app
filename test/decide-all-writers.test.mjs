// DECIDE-ALL (2026-10-23), the owner's rule: no fixed customer message. The
// four paths left in docs/history/2026-10-23-decide-all.md's table now reach an
// existing writer with structured facts, and the code's sentence is only the
// fallback when no line is written. Also: a revise lays the owner's own
// translated wording over its pages, and the draft media move is per project.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import * as R from "../builder/site-reply.mjs";
const { refusalFacts, editReplyFacts } = R;
const wideningFacts = (...a) => { assert.equal(typeof R.wideningFacts, "function", "wideningFacts does not exist"); return R.wideningFacts(...a); };
import { wideningAsk } from "../builder/site-rules.mjs";
import { actionFacts } from "../builder/site-progress.mjs";
const SiteMedia = createRequire(import.meta.url)("../public/site-media.js");

const W = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
const CHAT = readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");
const RULES = readFileSync(new URL("../builder/site-rules.mjs", import.meta.url), "utf8");
const texts = (facts) => facts.map((f) => f.text).join("\n");
/** The source between two landmarks, both asserted to exist first. */
function between(src, a, b) {
  const i = src.indexOf(a);
  assert.ok(i >= 0, "landmark missing: " + a);
  const j = src.indexOf(b, i + a.length);
  assert.ok(j > i, "landmark missing: " + b);
  return src.slice(i, j);
}

// ── 1. Publish refused while offline ───────────────────────────────────────
test("the offline refusal has its own facts for the talk writer, not the route's sentence", () => {
  const f = actionFacts("publish", "offline");
  assert.ok(f.length >= 1, "no facts reach the writer");
  const sentence = (W.match(/const OFFLINE_PUBLISH_REFUSAL = "([^"]+)"/) || [])[1];
  assert.ok(sentence, "the fallback sentence landmark is gone");
  assert.ok(!texts(f).includes(sentence), "the route's sentence is handed to the writer as its facts");
  assert.match(texts(f), /off the web/);
});

test("the publish route tells an offline refusal through the talk writer and answers its line as `reply`", () => {
  const route = between(W, 'const talk = actionTalk(env, ctx, { id: pbody && pbody.talk', 'if (dd && request.method === "POST")');
  assert.match(route, /actionFacts\("publish", "offline"\)/, "the offline refusal is told as a generic failure");
  assert.match(route, /reply: offlineReply/, "the written line does not reach the page");
  const talkFn = between(W, "function actionTalk(", "const PROGRESS_CLOSE_MS");
  assert.match(talkFn, /end\(facts\)[^\n]*return chain\.then/, "the talk's end does not answer the line it wrote");
  const panel = between(CHAT, "const go = box.querySelector('#spPublishDraft');", "async function siteDraftPanelRead");
  assert.match(panel, /if \(out && typeof out\.reply === 'string' && out\.reply\) \{ if \(typeof sbToast === 'function'\) sbToast\(out\.reply\); return; \}/, "the written line is not shown when present");
  const reply = panel.indexOf("out.reply");
  const error = panel.indexOf("(out && out.error)");
  assert.ok(reply > 0 && error > reply, "the Publish panel does not show the written line before the fallback");
});

// ── 2. The read-widening question ──────────────────────────────────────────
test("a widening carries who sees the table now, and the question's facts name table, now and after", () => {
  assert.match(RULES, /out\.push\(\{ table: prior\.name, read: after, from: before \}\)/, "the current access is not carried");
  const list = [{ table: "bookings", read: "public", from: "own" }];
  const r = wideningFacts(list, wideningAsk(list).options);
  assert.equal(r.skip, null);
  const t = texts(r.facts);
  assert.match(t, /bookings/); assert.match(t, /only the person who added each entry/); assert.match(t, /anyone visiting the site/);
  assert.ok(!t.includes(wideningAsk(list).text), "the code's question is handed over as the facts");
  assert.equal(wideningFacts([], []).skip, "unreadable");
});

test("the rules step's widening question is worded by the writer, its options kept structured", () => {
  const fn = between(W, "async function wideningQuestion(", "// ── THE SITE'S LIVE QUESTION");
  assert.match(fn, /wideningFacts\(widening, ask\.options\)/);
  assert.match(fn, /writeReply\(/);
  assert.match(fn, /\{ \.\.\.ask, text: out\.text\.trim\(\) \}/, "the options are not kept as the step's own");
  assert.match(fn, /: ask;/, "no fallback to the code's question");
  assert.match(W, /stepAsk\("rules", Array\.isArray\(rOut\.widening\)[^\n]*await wideningQuestion\(env, \{ ask: rOut\.ask, widening: rOut\.widening/, "the rules step does not reach the writer");
});

// ── 3. The draft media move ────────────────────────────────────────────────
test("a file left behind by the move is told from facts, by name and why", () => {
  const F = { out: [], add(kind, text) { this.out.push({ kind, text }); } };
  assert.equal(refusalFacts(F, { code: "media-unmoved", files: [{ name: "Jingle.wav", why: "it was no longer kept" }], moved: 1, again: "attach" }), true);
  const t = texts(F.out);
  assert.match(t, /Jingle\.wav/); assert.match(t, /no longer kept/); assert.match(t, /one other attached file/);
  assert.equal(editReplyFacts({ ok: false, error: "media-unmoved", cost: 0, unchanged: true, refusal: { code: "media-unmoved", files: [{ name: "a.mp4", why: "x" }] } }).skip, null);
});

test("the adopt route writes the reply through the edit writer, and the page shows it in place of its sentence", async () => {
  const route = between(W, "const adoptMissing = ", "} else if (mdr) {");
  assert.match(route, /code: "media-unmoved"/);
  assert.match(route, /writeModelReply\(env, "edit"/);
  const chips = [{ name: "promo.mp4", ref: "c".repeat(32) + ".mp4", draft: true, state: "done" }];
  const sent = [];
  const r = await SiteMedia.adopt("kiln", chips, async (p, b) => { sent.push(b); return { status: 200, body: { ok: true, placed: [], missing: [{ file: chips[0].ref, why: "x" }], reply: "STUB-WRITTEN" } }; }, "add my promo");
  assert.equal(r.ok, false);
  assert.equal(r.error, "STUB-WRITTEN", "the written reply does not replace the fixed sentence");
  assert.equal(sent[0].request, "add my promo", "their words do not go with the move");
  assert.match(CHAT, /SiteMedia\.adopt\(site\.slug, ready, async[\s\S]{0,300}\}, t\)\.then/, "the composer does not send its words with the move");
});

test("no fixed toast speaks for a move that landed on another project", () => {
  assert.ok(!CHAT.includes("Your files are now in that site’s library"), "the fixed toast is still there");
});

// ── 4. The fallback stays only a fallback ──────────────────────────────────
test("each fixed sentence is reached only when no written line exists", () => {
  assert.match(W, /const OFFLINE_PUBLISH_REFUSAL = /);
  assert.match(readFileSync(new URL("../public/site-media.js", import.meta.url), "utf8"), /b\.reply[\s\S]{0,200}return \{ ok: false, moved: moved, error: "I couldn/);
});

// ── a. A revise lays the owner's translated wording over its pages ─────────
test("buildAndPublishPages lays langOverrides over each language's pages, and the revise passes them", () => {
  const head = between(W, "async function buildAndPublishPages(env, {", "}) {");
  assert.match(head, /\blangOverrides\b/, "the build path takes no overrides");
  const fold = between(W, "const bStuck = {};", "const st = stuckAfter(bStuck);");
  assert.match(fold, /applyOverrides\(mergedStrings, readOverrides\(langOverrides\)\[r\.l\.tag\], strings\)/, "the overrides are not laid over the build's pages");
  assert.ok(!/langCache\[r\.l\.tag\] = laid/.test(fold), "the owner's wording was written into the cache");
  assert.match(W, /priorLangOverrides = cfg\.config\.langOverrides;/);
  assert.match(W, /langStrings: priorLangStrings, langOverrides: priorLangOverrides,/);
});

// ── b. The media move is per project ───────────────────────────────────────
test("siteMediaMoving is per project", () => {
  assert.match(CHAT, /var siteMediaMoving = new Set\(\);/);
  const send = between(CHAT, "function siteSend(", "\nfunction ");
  assert.match(send, /const owner = siteOpenId;\s*if \(siteMediaMoving\.has\(owner\)\) return;\s*siteMediaMoving\.add\(owner\);/);
  assert.match(send, /siteMediaMoving\.delete\(owner\)/);
  assert.ok(!/siteMediaMoving = (true|false)/.test(CHAT), "a page-wide flag is still written");
});
