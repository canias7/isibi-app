// THE OWNER'S PUBLISH DECISIONS (2026-10-23): the options chosen on builder
// audit findings #195, #118/#119, #219, #144, #247 and #216
// (docs/history/2026-10-23-decide-publish.md). The driven cases are in
// test/draft-first.test.mjs (DPO*, DPP*, DPR*) and test/edit-path.test.mjs
// ("audit #195"); this file holds the pure rules and the wiring each reads.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { MAX_NEW_SLUG, capNewSlug, previewLabel, rebuildGoesLive, PUBLISH_KEEP_BUILDS, publishKeeps } from "../site-draft.mjs";
import { verdictFor, drainRebuild } from "../site-rebuild.mjs";
import { siteDigest, DRAFT_FIRST_FACT } from "../builder/site-ask.mjs";
import { siteContextBlock } from "../builder/site-converse.mjs";
import { translationBatches, batchKey, stuckFor, stuckAfter, nextCache, langNote, STUCK_KEY, BATCH_MAX_STRINGS, BATCH_MAX_CHARS } from "../builder/site-translate.mjs";
import { readableJobKey, allowedJobKey } from "../builder/job-gateway.mjs";
import { siteOffline } from "../builder/site-offline.mjs";
import { driveBuild, GOOD_DESIGN, BRIEF } from "./fixtures/build-route.mjs";
import { loadWorker } from "./fixtures/worker-harness.mjs";
import { withWire as askWire, routeCall, envFor, bucket as askBucket, freshSlug } from "./fixtures/live-ask.mjs";

const WORKER = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
const blank = (s) => s.replace(/^([ \t]*)\/\/.*$/gm, (m) => " ".repeat(m.length));
const W = blank(WORKER);
const fnOf = (name) => {
  let at = W.indexOf("async function " + name + "(");
  if (at < 0) at = W.indexOf("function " + name + "(");
  assert.ok(at >= 0, name + " is gone — rescope this guard");
  const end = W.indexOf("\n}\n", at);
  assert.ok(end > at, name + " never closes");
  return W.slice(at, end);
};
const TOKEN = "0123456789ab";

// ── #247: new site names at most 43 characters ──────────────────────────────

test("#247 a new name is cut to 43 characters, and a 43-character name has a preview address", () => {
  assert.equal(MAX_NEW_SLUG, 43);
  const long = "the-cornish-bakehouse-and-tea-rooms-st-ives-and-more";
  const cut = capNewSlug(long);
  assert.ok(cut.length <= 43, cut);
  assert.ok(previewLabel(cut, TOKEN), "a capped name has no preview address");
  assert.equal(previewLabel("a".repeat(44), TOKEN), "", "the DNS limit this cap exists for moved");
  // CUT, THEN TRIMMED: a cut landing on a hyphen leaves no edge hyphen.
  assert.equal(capNewSlug("a".repeat(42) + "-bcd"), "a".repeat(42));
  assert.equal(capNewSlug("short-name"), "short-name");
});

test("#247 a customer naming a NEW site over 43 characters is refused before any money moves; the designer's own long name is cut", async () => {
  const long = "the-cornish-bakehouse-and-tea-rooms-in-st-ives"; // 46
  const r = await driveBuild({ design: { input: GOOD_DESIGN }, body: { brief: BRIEF, slug: long } });
  assert.equal(r.status, 400, JSON.stringify(r.reply));
  assert.equal(r.reply.error, "name too long");
  assert.equal(r.reply.cost, 0);
  assert.match(r.reply.msg, /at most 43 characters/);
  assert.deepEqual(r.seen.tools, [], "a model was asked before the refusal");
  assert.ok(!r.seen.rpc.some((c) => c.fn === "credit_debit"), "money moved before the refusal");
  // THE DESIGNER INVENTS A LONG NAME: the build goes on under the cut one.
  const d = await driveBuild({ design: { input: { ...GOOD_DESIGN, slug: long + "-and-tea-garden" } }, body: { brief: BRIEF } });
  const named = d.reply && d.reply.slug;
  const claimed = [...d.store.keys()].map((k) => (/^(?:config|source|builds)\/([^/.]+)/.exec(k) || [])[1]).filter(Boolean);
  const all = [named, ...claimed].filter(Boolean);
  assert.ok(all.length, "the build never named its site: " + JSON.stringify(d.reply).slice(0, 300));
  assert.ok(all.every((s) => s.length <= 43), "a new site was named over 43 characters: " + JSON.stringify(all));
});

test("#247 an EXISTING site's long name is untouched: only a certainly free name is judged", () => {
  const block = W.slice(W.indexOf("const namedSlug = cleanSlug(body.slug);"), W.indexOf("const firstBuild = !namedSlug || namedRow === null;"));
  assert.match(block, /if \(namedRow === null && namedSlug\.length > MAX_NEW_SLUG\) \{/, "the refusal judges more than a free name");
  assert.match(W, /const cleanSlug = \(v\) => [^\n]*\.slice\(0, 60\)/, "the reader of existing names was cut too");
  assert.match(W, /slug: \{ type: "string", description: "[^"]*at most 43 characters\." \}/, "the designer is not told the cap");
});

// ── #216: the router and the reply are told changes are drafts ─────────────

test("#216 under draft-first the router is told every change is a draft until Publish, and to point a typed publish at the button", () => {
  const on = siteDigest({ name: "Harbour Loaf", url: "https://h.gofarther.app", pages: ["/"], draftFirst: true });
  assert.ok(on.includes(DRAFT_FIRST_FACT), on);
  assert.match(DRAFT_FIRST_FACT, /goes live only when they press the Publish button/);
  assert.match(DRAFT_FIRST_FACT, /"publish my changes"[^.]*answer \\?"ask\\?" and tell them to press the Publish button/);
  const off = siteDigest({ name: "Harbour Loaf", url: "https://h.gofarther.app", pages: ["/"] });
  assert.ok(!off.includes("Publish button"), "told about drafts with draft-first off");
  // A TRUTHY NON-TRUE IS NOT THE SWITCH.
  assert.ok(!siteDigest({ name: "H", draftFirst: "on" }).includes("Publish button"));
  // AN EMPTY PROJECT IS STILL AN EMPTY PROJECT.
  assert.match(siteDigest({ draftFirst: true }), /brand new, empty project/);
});

test("#216 the reply's own context points a typed publish at the button", () => {
  const block = siteContextBlock({ exists: true, name: "Harbour Loaf", url: "https://h.gofarther.app", draftFirst: true, pages: [] });
  assert.match(block, /when they ask to publish or put their changes live, tell them to press the Publish button/);
});

test("#216 the route tells the router from the Worker's own switch, never the body's word", async () => {
  const worker = await loadWorker();
  for (const [on, want] of [["on", true], ["", false]]) {
    const slug = freshSlug("dp216" + (on ? "on" : "off"));
    const store = askBucket(slug);
    await askWire({ route: { intent: "ask", answer: "Press Publish." }, converse: "Press the Publish button." }, async (seen) => {
      const env = { ...envFor(store), DRAFT_FIRST: on };
      const r = await routeCall(worker, env, { slug, message: "publish my changes", extra: { site: { name: "Harbour Loaf", url: "https://" + slug + ".gofarther.app", pages: ["/"], tables: [], draftFirst: !want } } });
      assert.equal(r.status, 200, JSON.stringify(r.body));
      const asked = seen.routerAsked[0];
      assert.ok(asked, "the router was never asked");
      const told = String(asked.messages[0].content);
      assert.equal(told.includes("Publish button above their site"), want, (want ? "not told" : "told") + " about drafts: " + told.slice(0, 400));
    });
  }
});

// ── #144: the platform rebuild ──────────────────────────────────────────────

test("#144 a rebuild goes live only on a clean, online site with a live version", () => {
  const live = { version: "01790000000000-aaaaaa" };
  const clean = { version: live.version, rev: 3, applied: 3, revs: [{ n: 3, version: live.version }], history: [] };
  const ahead = { version: "01790000000001-bbbbbb", rev: 4, applied: 3, revs: [{ n: 3, version: live.version }, { n: 4, version: "01790000000001-bbbbbb" }], history: [] };
  const held = { version: live.version, rev: 4, applied: 3, revs: [{ n: 3, version: live.version }, { n: 4, version: live.version, held: "x" }], history: [] };
  assert.equal(rebuildGoesLive({ draft: null, live, offline: false }), true);
  assert.equal(rebuildGoesLive({ draft: clean, live, offline: false }), true);
  assert.equal(rebuildGoesLive({ draft: ahead, live, offline: false }), false, "a saved draft went live");
  assert.equal(rebuildGoesLive({ draft: held, live, offline: false }), false, "held changes went live");
  assert.equal(rebuildGoesLive({ draft: clean, live, offline: true }), false, "an offline site went live");
  assert.equal(rebuildGoesLive({ draft: clean, live, offline: null }), false, "cannot-tell read as online");
  assert.equal(rebuildGoesLive({ draft: null, live: null, offline: false }), false, "a site with no live version went live");
});

test("#144 a rebuild saved as a draft is done but never counted as republished", async () => {
  assert.deepEqual(verdictFor({ ok: true }), { state: "done", reason: "republished" });
  const v = verdictFor({ ok: true, draft: { version: "01790000000001-bbbbbb" } });
  assert.equal(v.state, "done");
  assert.equal(v.drafted, true);
  assert.match(v.reason, /saved as a draft/);
  const forgot = [];
  const deps = { due: async () => [{ slug: "a", attempts: 0 }, { slug: "b", attempts: 0 }], exists: async () => true, claim: async () => true,
    rebuild: async (slug) => (slug === "a" ? { ok: true } : { ok: true, draft: { version: "x" } }), forget: async (s) => { forgot.push(s); }, defer: async () => {} };
  const out = await drainRebuild(deps);
  assert.deepEqual([out.rebuilt, out.drafted], [1, 1], JSON.stringify(out));
  assert.deepEqual(forgot.sort(), ["a", "b"]);
});

test("#144 only the rebuild route asks for the live path", () => {
  const uses = [...W.matchAll(/liveWhenClean: true/g)];
  assert.equal(uses.length, 1, "liveWhenClean is passed " + uses.length + " times");
  const at = uses[0].index;
  assert.ok(W.lastIndexOf('label: "platform rebuild"', at) > at - 400, "liveWhenClean is passed by something other than the platform rebuild");
});

// ── #219: the prune at Publish ──────────────────────────────────────────────

test("#219 a Publish keeps the newest 20, the live version, the one before it and every draft", () => {
  assert.equal(PUBLISH_KEEP_BUILDS, 20);
  const v = (n) => "0179000000" + String(1000 + n) + "-v" + n;
  assert.deepEqual(publishKeeps({ version: v(1), previous: [v(2), "", null, v(2)], drafts: [v(3), v(4), "nope"] }).sort(), [v(1), v(2), v(3), v(4)].sort());
  const fn = fnOf("pruneAtPublish");
  assert.match(fn, /cap: PUBLISH_KEEP_BUILDS/);
  assert.match(fn, /if \(!drafts\) return 0;/, "an unreadable draft record still prunes");
  assert.match(fn, /String\(ptr\.version \|\| ""\) !== String\(j\.version \|\| ""\)\) return 0;/, "a pointer that moved on still prunes");
  const pub = fnOf("runPublication");
  const mark = pub.indexOf("const m = await markApplied(deps, slug");
  const prune = pub.indexOf("await pruneAtPublish(env, slug, j);");
  assert.ok(mark > 0 && prune > mark, "the prune runs before the draft is marked published");
});

// ── #118/#119: offline wins ─────────────────────────────────────────────────

test("#118 a job may read its own site's offline marker, never write it, never another site's", () => {
  assert.equal(readableJobKey("fold-lane", "site-offline/fold-lane.json"), true);
  assert.equal(readableJobKey("fold-lane", "site-offline/other.json"), false);
  assert.equal(readableJobKey("fold-lane", "site-offline/fold-lane.json", true), false);
  assert.equal(allowedJobKey("fold-lane", "0123456789abcdef0123456789abcdef", "site-offline/fold-lane.json"), false, "a job can write the offline marker");
});

test("#118/#119 every path that would make a site live asks the offline marker first", () => {
  for (const [name, needle] of [
    ["publishDraft", "if ((await offlineMarked(env, slug)) !== false) return { ok: false, status: 409, offline: true"],
    ["setAsidePublication", "if ((await offlineMarked(env, slug)) !== false) return { ok: false, status: 409, offline: true"],
    ["runPublication", "if ((await offlineMarked(env, slug)) !== false) return { ok: false, status: 409, offline: true"],
    ["runPublishRecovery", "if ((await offlineMarked(env, slug)) !== false) continue;"],
    ["runScriptPendingSweep", "if ((await offlineMarked(env, slug)) !== false) continue;"],
    ["publishPlaceholder", "if ((await offlineMarked(env, slug)) === true) return false;"],
  ]) assert.ok(fnOf(name).includes(needle), name + " does not ask the offline marker");
  // THE SWEEP ASKS BEFORE IT TAKES THE JOURNAL OVER.
  const rec = fnOf("runPublishRecovery");
  assert.ok(rec.indexOf("offlineMarked(") < rec.indexOf("const j = { ...cur.j, running: true"), "the recovery takes the journal over before asking");
  const sw = fnOf("runScriptPendingSweep");
  assert.ok(sw.indexOf("offlineMarked(") < sw.indexOf("followPointer("), "the script sweep re-uploads before asking");
});

test("#118 the offline route writes the marker before the take-down and removes it only after Back online lands", () => {
  const at = W.indexOf("const lslug = lv[1].toLowerCase();");
  assert.ok(at > 0);
  const route = W.slice(at, W.indexOf("} else if (jb) {", at));
  const put = route.indexOf("await env.SITES_BUCKET.put(offlineMarkKey(lslug)");
  const take = route.indexOf(": await takeOffline(liveDeps, { slug: lslug });");
  assert.ok(put > 0 && take > put, "the marker is not written before the take-down");
  assert.match(route, /if \(lb\.on !== false && !out\.ok\) \{ try \{ await env\.SITES_BUCKET\.delete\(offlineMarkKey\(lslug\)\)/, "a failed take-down leaves the site marked offline");
  assert.match(route, /if \(lb\.on === false && out\.ok\) \{ try \{ await env\.SITES_BUCKET\.delete\(offlineMarkKey\(lslug\)\)/, "Back online does not remove the marker, or removes it before landing");
});

test("#118 the site list: under draft-first a later build does not make an offline site read live", () => {
  const off = "2026-10-20T10:00:00.000Z";
  // THE RULE ITSELF IS UNCHANGED: a later build reads online, so the list
  // must ask the live marker for exactly those rows under draft-first.
  assert.equal(siteOffline(off, Date.parse("2026-10-21T10:00:00Z")), false);
  const list = W.slice(W.indexOf("const offlineOf = Object.create(null);"), W.indexOf("createdAt: stamp(r.created_at),"));
  assert.match(list, /if \(draftFirst\(env\) && buildRows\) \{/);
  assert.match(list, /offlineOf\[r\.slug\] = !\(await env\.SITES_BUCKET\.head\("sites\/" \+ r\.slug \+ "\/" \+ SITE_LIVE_FILE\)\)/, "the live marker is not what decides");
  assert.match(list, /catch \{ offlineOf\[r\.slug\] = null; \}/, "an unreadable marker is not cannot-tell");
  assert.match(list, /offline: Object\.hasOwn\(offlineOf, r\.slug\) \? offlineOf\[r\.slug\] : siteOffline\(/);
});

// ── #195: translation batches and remembered failures ──────────────────────

test("#195 batches keep order, respect both caps, and lose nothing", () => {
  const many = Array.from({ length: 401 }, (_, i) => "Fresh loaf " + i);
  const b = translationBatches(many);
  assert.deepEqual(b.flat(), many);
  assert.ok(b.every((x) => x.length <= BATCH_MAX_STRINGS));
  const long = Array.from({ length: 40 }, (_, i) => "x".repeat(390) + i);
  const lb = translationBatches(long);
  assert.ok(lb.length > 1, "the character cap is not applied");
  assert.ok(lb.every((x) => JSON.stringify(x).length <= BATCH_MAX_CHARS), "a batch passes the character cap");
  assert.deepEqual(translationBatches([]), []);
  // THE COUNT CAP ON ITS OWN: short strings that never reach the character cap.
  assert.deepEqual(translationBatches(Array.from({ length: 400 }, (_, i) => String(i))).map((x) => x.length), [150, 150, 100]);
  // ONE STRING OVER THE CAP STILL GOES, ALONE.
  assert.deepEqual(translationBatches(["y".repeat(BATCH_MAX_CHARS + 10)]).length, 1);
});

test("#195 a batch's key follows its words", () => {
  assert.equal(batchKey(["a", "b"]), batchKey(["a", "b"]));
  assert.notEqual(batchKey(["a", "b"]), batchKey(["a", "c"]));
  assert.notEqual(batchKey(["a", "b"]), batchKey(["b", "a"]));
});

test("#195 remembered failures are read strictly and only the non-empty kept", () => {
  assert.deepEqual([...stuckFor({ [STUCK_KEY]: { es: ["k1", 2, "k2"] } }, "es")], ["k1", "k2"]);
  assert.deepEqual([...stuckFor({ [STUCK_KEY]: { es: ["k1"] } }, "fr")], []);
  assert.deepEqual([...stuckFor({ [STUCK_KEY]: { toString: ["k1"] } }, "toString")], ["k1"]);
  assert.deepEqual([...stuckFor({}, "constructor")], []);
  assert.deepEqual(stuckAfter({ es: ["b", "a", "a"], fr: [] }), { es: ["a", "b"] });
  assert.equal(stuckAfter({ es: [] }), null);
});

test("#195 a failed batch's strings stay missing; the answered ones are cached", () => {
  const out = nextCache({}, ["a", "b", "c"], { a: "A" }, new Set(["b", "c"]));
  assert.deepEqual(out, { a: "A" });
  // A STRING ALREADY TRANSLATED KEEPS ITS TRANSLATION WHEN ITS BATCH FAILS.
  assert.deepEqual(nextCache({ b: "B" }, ["a", "b"], {}, new Set(["a", "b"])), { b: "B" });
});

test("#195 the customer is told a lasting failure will not be retried, and a passing one will", () => {
  assert.match(langNote([{ tag: "fr", ok: false, why: "stuck" }]), /I won't try those words again until you change them/);
  assert.match(langNote([{ tag: "fr", ok: false, why: "size" }]), /I won't try those words again/);
  assert.match(langNote([{ tag: "fr", ok: false, why: "call" }]), /I'll try again on your next change/);
  assert.match(langNote([{ tag: "es", ok: true, behind: 1 }]), /^1 phrase on the es pages could not be translated this time/);
});

test("#195 the batch runner charges only a usable batch and remembers only a lasting failure", () => {
  const fn = fnOf("translateMissing");
  assert.match(fn, /if \(stuck\.has\(key\)\) \{ skipped\+\+;/, "a remembered batch is asked again");
  assert.match(fn, /if \(got\.usage\) usages\.push\(got\.usage\);\n\s*return;/, "a usable batch's usage is not kept");
  assert.match(fn, /if \(LASTING_FAILURES\.has\(w\)\) nowStuck\.push\(key\);/, "a lasting failure is not remembered");
  const ts = fnOf("translateStrings");
  assert.match(ts, /if \(r && r\.stop_reason === "max_tokens"\) return \{ ok: false, why: "size"/, "a cut-off answer is not a size failure");
});
