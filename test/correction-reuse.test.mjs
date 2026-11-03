// A VALIDATED CORRECTION MADE REACHABLE (2026-10-13, correction reuse, on the
// owner's word). Run 141's Add-on preparation had its first designer answer
// refused by the cleaner and asked once more with the reason; its job then
// asked the model again, because a refused answer is never replayed (VA 0–5,
// UA 0–6) and the job's first request was exactly the refused one. The paid
// correction was unreachable.
//
// The rule is amended in scope only: a refused or cut-off ANSWER is still
// never staged, replayed, handed on, shown to a model or applied. The
// refusal's FACTS (reason, the exact feedback sent, the requirements it
// superseded, a digest of the cleaner's input) now travel with the record; a
// later job whose first request is byte for byte the refused one AND whose
// cleaner input digests the same goes straight to the correction — which is
// still answered only by an exact match and validated by that job's own
// cleaner. Anything missing, malformed or different asks the model, as before.
//
//   CR 1  corrected-answer reuse through the real Worker: the job asks the
//         designer 0 times (skipped 1, replayed 3, fresh 0); charged exactly
//         what a job with no refusal is charged; the refused design is in no
//         request, staged record, kept record, view or page.
//   CR 2  changed validation context: the staged facts' cleaner digest differs
//         — the job declines the refusal and asks the first request again.
//   CR 3  a rejected correction: the preparation's correction was refused
//         too; the job skips to the correction request, which is byte for byte
//         the preparation's, finds no usable answer for it and asks it once —
//         no third designer call.
//   CR 4  older records: a staged refusal with no facts behaves exactly as
//         before (asked again, nothing skipped).
//   CR 5  malformed facts are no facts (each field), and every reader is
//         strict; a caller that does not handle prior refusals never sees one.
//   CR 6  continuation safety: a refusal taken is kept as facts with no
//         answer; read back, re-staged and taken again under the same rule; a
//         refused answer kept for diagnosis is never in `calls`.
//   CR 7  the cleaner digest: plain JSON only, key order irrelevant, any
//         change in value a different digest; a value that is not plain JSON
//         gives "" (never matches).
//
// ⚠ SUPPLIED-MODEL PROOF ONLY: every answer is supplied, so this shows what
// the code does with an answer, never what a real model answers.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { platform, sendMessage, settle, deliver, call, T } from "./fixtures/request-flow.mjs";
import { installCompiler } from "./fixtures/cf-containers.mjs";
import { blockNetwork } from "./fixtures/no-network.mjs";
import { pageCredits } from "../builder/publish-pages.mjs";
import { recorder, replayer, readPrepared, readRefusal, rejectReply, stagedRecord, valueDigest, priorRefusalOf, PriorRefusal, requestHash, REFUSAL_REQ_MAX, REFUSAL_FEEDBACK_MAX } from "../builder/prepared.mjs";

blockNetwork();

const SITE = JSON.parse(readFileSync(new URL("../docs/history/evidence/2026-10-12-run141/source-before.json", import.meta.url), "utf8"));
const OLD_HEAD = "Photographs straight from our ovens";
const NEW_HEAD = "Fresh from our ovens";
const W_HEAD = `change the Gallery page heading '${OLD_HEAD}' to '${NEW_HEAD}'`;
const W_FAQ = "add a short questions section to the Bake List page answering 'When is the list updated?' with 'Every Monday morning.'";
const MESSAGE = W_FAQ[0].toUpperCase() + W_FAQ.slice(1) + ". And " + W_HEAD + ".";
const FAQ = { page: "/bake-list", where: "after the sign-up form", does: "answers when the bake list is updated", components: ["accordion"] };
const GOOD = { component: [FAQ] };
const GOOD_AGAIN = { component: [{ ...FAQ, does: "answers when the weekly bake list changes" }] };
// THE REFUSED DESIGN'S OWN MARK: a page no site has, and words nothing else uses.
const REFUSED = { component: [{ ...FAQ, page: "/nowhere-refused", does: "refused-design-marker" }] };
const REFUSED_TOO = { component: [{ ...FAQ, page: "/nowhere-again", does: "refused-again-marker" }] };
const REFUSED_MARKS = /nowhere-refused|refused-design-marker|nowhere-again|refused-again-marker/;
const withFaq = (src, words = "When is the list updated? Every Monday morning.") => src.replace("    </SiteChrome>", `      <section className="faq"><h2>Questions</h2><p>${words}</p></section>\n    </SiteChrome>`);

const slugOf = (k) => "cr-" + k + "-" + Math.random().toString(16).slice(2, 8);
const lineOf = (args, words) => {
  const at = String(args.messages[0].content).split("\n").find((l) => l.includes("[gallery.tsx]") && l.includes(words));
  return Number(String(at || "-1.").split(".")[0]);
};
const viewOf = async (P, key) => { const v = await call(P, "GET", "/api/site/request/" + P.slug + "/" + key); assert.equal(v.status, 200, JSON.stringify(v.body)); return v.body.request; };
const designs = (P) => P.modelLog.filter((m) => m.tool === T.design);
const useOf = (view, n) => (view.parts[n].prepUse || [])[0] || null;
const partsDone = (rec) => assert.deepEqual(rec.parts.map((p) => p.status), ["done", "done"], JSON.stringify(rec.parts.map((p) => [p.status, p.why])));

/**
 * Run 141's two parts (`test/parallel-reuse-run141.test.mjs`): the text part
 * first, the Add-on part prepared while the text step runs, its job after.
 * `restage(record)` may rewrite the Add-on job's staged record as it is
 * written (`jobs/prepared/<id>.json`) — how a case gives the job facts that
 * differ, are malformed, or are missing.
 */
async function runShape({ design, restage = null }) {
  const compiler = installCompiler();
  let P = null;
  let opened;
  const designerAsked = new Promise((r) => { opened = r; });
  let designN = 0;
  const staged = [];
  P = platform({
    slug: slugOf("s"), pages: SITE.pages, replies: true, balance: 400,
    answers: {
      route: (args, n) => (n === 0
        ? { intent: "edit", layer: "text", page: "/gallery", alsoAsked: [W_FAQ], targets: [{ change: 0, writes: ["page:/gallery"] }, { change: 1, writes: ["page:/bake-list", "new-component:bake-list-questions"] }] }
        : { intent: "addon" }),
      [T.text]: async (args) => {
        const met = await Promise.race([designerAsked.then(() => true), new Promise((r) => setTimeout(() => r(false), 3000))]);
        assert.ok(met, "the preparation's designer was never asked while the text step ran");
        return { edits: [{ id: lineOf(args, OLD_HEAD), to: NEW_HEAD }] };
      },
      [T.adds]: { kinds: ["component"], scopes: [{ kind: "component", words: W_FAQ, uses: [] }] },
      "add:component": () => { designN++; if (designN === 1) opened(); return design(designN); },
      [T.pages]: () => ({ pages: [{ path: "src/routes/bake-list.tsx", source: withFaq(P.page("bake-list.tsx")) }] }),
    },
  });
  const set = P.objects.set.bind(P.objects);
  P.objects.set = (k, v) => {
    if (/^jobs\/prepared\/[^/.]+\.json$/.test(k) && v && typeof v.body === "string" && v.body.includes('"refusal"')) {
      staged.push(k);
      if (restage) v = { ...v, body: JSON.stringify(restage(JSON.parse(v.body))) };
    }
    return set(k, v);
  };
  try {
    const r = await sendMessage(P, { message: MESSAGE });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const first = P.queue.splice(0);
    await Promise.all(first.map((m) => deliver(P, m)));
    const { rec } = await settle(P, r.key);
    const view = await viewOf(P, r.key);
    await P.settle();
    assert.deepEqual(P.unexpected, [], "requests the stand-ins were not set up for");
    return { P, rec, view, staged };
  } finally { P.close(); compiler.uninstall(); }
}

/** Every refusal entry of a staged record, rewritten by `f`. */
const eachRefusal = (f) => (rec) => ({ ...rec, calls: rec.calls.map((c) => (c.refusal ? f(c) : c)) });

// ── THE READERS, DIRECTLY ───────────────────────────────────────────────────

const H = "a".repeat(64);
const FACTS = { feedback: "That page does not exist. (no-page)", superseded: [{ id: "r1", need: "a questions section" }], cleanIn: "b".repeat(64) };
const reqOf = (n) => ({ model: "m", messages: [{ role: "user", content: "design " + n }], tool_choice: { type: "tool", name: "add_component" } });
const REFUSED_REPLY = { content: [{ type: "tool_use", name: "add_component", input: { secret: "refused-design-marker" } }], stop_reason: "tool_use" };

test("CR 5 — STRICT FACTS, AND ONLY FOR A CALLER THAT HANDLES THEM: every malformed field gives no facts; a refusal recorded with bad facts carries none; a cut-off reply never carries facts; a replayer caller that did not declare it handles prior refusals makes its call as before", async () => {
  assert.deepEqual(readRefusal(FACTS), FACTS);
  for (const bad of [null, [], "x", { ...FACTS, extra: 1 }, { ...FACTS, feedback: "" }, { ...FACTS, feedback: 3 }, { ...FACTS, feedback: "x".repeat(REFUSAL_FEEDBACK_MAX + 1) },
    { ...FACTS, cleanIn: "B".repeat(64) }, { ...FACTS, cleanIn: "b".repeat(63) }, { ...FACTS, superseded: {} }, { ...FACTS, superseded: [1] }, { ...FACTS, superseded: [[]] },
    { ...FACTS, superseded: Array.from({ length: REFUSAL_REQ_MAX + 1 }, () => ({})) }, { feedback: FACTS.feedback, cleanIn: FACTS.cleanIn }]) {
    assert.equal(readRefusal(bad), null, JSON.stringify(bad).slice(0, 120));
  }
  // A COPY: changing what was read changes nothing kept.
  const got = readRefusal(FACTS); got.superseded[0].id = "x"; assert.equal(FACTS.superseded[0].id, "r1");

  const rec = recorder();
  const replies = [structuredClone(REFUSED_REPLY), structuredClone(REFUSED_REPLY), { content: [{ type: "tool_use", name: "add_component", input: {} }], stop_reason: "max_tokens" }];
  const send = rec.wrap(async () => replies.shift());
  const a = await send(reqOf(1)); rejectReply(a, "add:no-page", FACTS);
  const b = await send(reqOf(2)); rejectReply(b, "add:no-page", { ...FACTS, cleanIn: "nope" });
  const c = await send(reqOf(3)); rejectReply(c, "add:no-page", FACTS);
  const stored = JSON.parse(JSON.stringify({ calls: rec.calls }));
  assert.deepEqual(stored.calls.map((x) => [x.unusable, !!x.refusal]), [["rejected:add:no-page", true], ["rejected:add:no-page", false], ["unfinished:max_tokens", false]]);
  const back = readPrepared(stored);
  assert.deepEqual(back.calls, [], "a refused or cut-off reply was readable as an answer");
  assert.equal(back.refusals.length, 1);
  assert.deepEqual(Object.keys(back.refusals[0]).sort(), ["cleanIn", "feedback", "h", "superseded", "why"]);
  assert.equal(back.refusals[0].why, "add:no-page");
  assert.ok(!REFUSED_MARKS.test(JSON.stringify(back.refusals)), "the refused answer rode with its facts");

  // A FORGED OR TAMPERED RECORD: facts beside a cut-off verdict are not a refusal's facts.
  assert.deepEqual(readPrepared({ calls: [{ h: H, unusable: "unfinished:max_tokens", refusal: FACTS }] }).refusals, []);
  // A CALLER THAT DOES NOT HANDLE PRIOR REFUSALS: the call is made, counted
  // fresh — with a usable answer beside the refusal, so its request IS
  // fingerprinted and still never meets the refusal.
  const usable = { h: await requestHash(reqOf(7)), reply: { content: [], stop_reason: "end_turn" } };
  const rp = replayer({ calls: [...stagedRecord(back).calls, usable] });
  let made = 0;
  const plain = rp.wrap(async () => { made++; return { content: [] }; });
  await plain(reqOf(1));
  assert.equal(made, 1);
  assert.deepEqual(rp.used(), { calls: 0, rebased: 0, images: 0, missed: 1 });
  assert.equal(rp.skips(), 0);
  // …AND ONE THAT DOES: thrown, never a reply; once; nothing counted until taken.
  const handles = rp.wrap(async () => { made++; return { content: [] }; }, { refusals: true });
  const e = await handles(reqOf(1)).then(() => null, (x) => x);
  assert.ok(priorRefusalOf(e) && e instanceof PriorRefusal, String(e));
  assert.equal(made, 1, "a call was made for a prior refusal");
  assert.equal(rp.skips(), 0);
  assert.deepEqual(e.take(), { why: "add:no-page", ...FACTS });
  assert.equal(e.take(), null, "taken twice");
  assert.equal(rp.skips(), 1);
  // SPENT: the same request again is a call.
  await handles(reqOf(1));
  assert.equal(made, 2);
  // A DIFFERENT REQUEST never meets the refusal.
  await handles(reqOf(9));
  assert.equal(made, 3);
  // A RECORD HOLDING ONLY A REFUSAL (staged for a job whose preparation kept
  // no usable answer): the handling caller still meets it.
  const lone = replayer(stagedRecord(back));
  const e3 = await lone.wrap(async () => { made++; return {}; }, { refusals: true })(reqOf(1)).then(() => null, (x) => x);
  assert.ok(priorRefusalOf(e3), "a refusal alone in its record was never met");
  assert.equal(made, 3);
});

test("CR 6 — CONTINUATION SAFETY: a refusal taken through a job's keeping recorder is kept as facts with NO answer; read back it is a refusal again and never an answer; re-staged, a later job's handling caller meets it under the same rule; a refused reply the job itself kept for diagnosis stays out of `calls`", async () => {
  const prep = { calls: [{ h: await requestHash(reqOf(1)), unusable: "rejected:add:no-page", refusal: FACTS }, { h: await requestHash(reqOf(2)), reply: { content: [{ type: "tool_use", name: "add_component", input: { ok: 1 } }], stop_reason: "tool_use" } }] };
  const keep = recorder();
  const rp = replayer(prep);
  const send = keep.wrap(rp.wrap(async () => { throw new Error("no model in this test"); }, { refusals: true }));
  const e = await send(reqOf(1)).then(() => null, (x) => x);
  assert.ok(priorRefusalOf(e));
  assert.equal(keep.calls.length, 0, "kept before it was taken");
  e.take();
  const correction = await keep.wrap(rp.wrap(async () => { throw new Error("no model"); }))(reqOf(2));
  assert.deepEqual(correction.content[0].input, { ok: 1 });
  const kept = JSON.parse(JSON.stringify({ calls: keep.calls }));
  assert.deepEqual(kept.calls.map((c) => Object.keys(c).sort()), [["h", "refusal", "unusable"], ["h", "reply"]]);
  const back = readPrepared(kept);
  assert.equal(back.calls.length, 1);
  assert.equal(back.refusals.length, 1);
  const next = replayer(stagedRecord(back));
  const e2 = await next.wrap(async () => ({}), { refusals: true })(reqOf(1)).then(() => null, (x) => x);
  assert.deepEqual(e2.take(), { why: "add:no-page", ...FACTS });
  // A REFUSED REPLY THE JOB KEPT (made fresh, refused by its own cleaner): in
  // the record for diagnosis, never in `calls`; its facts usable, its content not.
  const keep2 = recorder();
  const r = await keep2.wrap(async () => structuredClone(REFUSED_REPLY))(reqOf(1));
  rejectReply(r, "add:no-page", FACTS);
  const k2 = readPrepared(JSON.parse(JSON.stringify({ calls: keep2.calls })));
  assert.deepEqual(k2.calls, []);
  assert.equal(k2.refusals.length, 1);
  assert.ok(!REFUSED_MARKS.test(JSON.stringify(stagedRecord(k2))), "the refused content was staged");
});

test("CR 7 — THE CLEANER DIGEST: plain JSON only; key order does not matter, any value does; anything not plain JSON gives \"\" and \"\" is never taken as a match", async () => {
  const a = await valueDigest({ site: { pages: ["/a", "/b"], spec: { x: 1 } }, today: "2026-10-13" });
  assert.match(a, /^[0-9a-f]{64}$/);
  assert.equal(await valueDigest({ today: "2026-10-13", site: { spec: { x: 1 }, pages: ["/a", "/b"] } }), a);
  assert.notEqual(await valueDigest({ site: { pages: ["/b", "/a"], spec: { x: 1 } }, today: "2026-10-13" }), a);
  assert.notEqual(await valueDigest({ site: { pages: ["/a", "/b"], spec: { x: 1 } }, today: "2026-10-14" }), a);
  for (const bad of [{ m: new Map([["a", 1]]) }, { s: new Set([1]) }, { f() {} }, { n: NaN }, { d: new Date(0) }]) assert.equal(await valueDigest(bad), "", Object.keys(bad)[0]);
  // A FACT WITH "" FOR ITS DIGEST IS NO FACT.
  assert.equal(readRefusal({ ...FACTS, cleanIn: "" }), null);
});

// ── CONTINUATION THROUGH THE REAL QUEUE ─────────────────────────────────────

import { page as pageSrc } from "./fixtures/live-ask.mjs";
import { writtenPage } from "./fixtures/addon-route.mjs";
