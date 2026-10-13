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

test("CR 1 — CORRECTED-ANSWER REUSE: the preparation's first design is refused and corrected; the job's first designer request and cleaner input match, so it goes straight to the recorded correction — no designer call (skipped 1, replayed 3, fresh 0), the correction lands, charged exactly what a job with no refusal is, and the refused design is in no request, staged or kept record, view or page", { timeout: 90000 }, async () => {
  const answers = [REFUSED, GOOD, GOOD_AGAIN];
  const { P, rec, view, staged } = await runShape({ design: (n) => answers[Math.min(n, answers.length) - 1] });
  partsDone(rec);
  const u = useOf(view, 1);
  assert.ok(u && u.staged === "yes", JSON.stringify(view.parts[1]));
  assert.deepEqual([u.skipped, u.replayed, u.fresh], [1, 3, 0], JSON.stringify(u));
  // SCOPED CALLS: picker, correction, writer — the skipped request asked no model.
  assert.equal(u.scoped, 3, JSON.stringify(u));
  assert.equal(designs(P).length, 2, "the job asked the designer");
  // THE CORRECTION, NOT A NEW ANSWER: GOOD_AGAIN never asked for, GOOD landed.
  assert.ok(P.page("bake-list.tsx").includes("Every Monday morning"));
  // WHAT EACH CALL WAS SHOWN, the skipped one marked as skipped (never "replayed").
  assert.deepEqual(u.marks.map((m) => [m.what, m.replayed, m.skipped === true]), [[T.adds, true, false], [T.design, false, true], [T.design, true, false], [T.pages, true, false]], JSON.stringify(u.marks));
  // THE STAGED RECORD carries the refusal's facts and no reply.
  assert.equal(staged.length, 1, "the refusal was not staged for the job");
  const st = JSON.parse(P.objects.get(staged[0]).body);
  const ref = st.calls.filter((c) => c.refusal);
  assert.equal(ref.length, 1, JSON.stringify(st.calls.map((c) => Object.keys(c))));
  assert.deepEqual(Object.keys(ref[0]).sort(), ["h", "refusal", "unusable"]);
  assert.match(ref[0].unusable, /^rejected:add:/);
  assert.equal(readPrepared(st).calls.length, 3, "picker, correction and writer");
  // THE JOB'S OWN KEPT RECORD (what a continuation would read): the refusal it
  // took, as facts with no reply.
  const keptKey = staged[0].replace(/\.json$/, ".kept.json");
  const kc = JSON.parse(P.objects.get(keptKey).body).calls;
  const kr = kc.filter((c) => c.refusal);
  assert.equal(kr.length, 1, JSON.stringify(kc.map((c) => Object.keys(c))));
  assert.ok(!Object.hasOwn(kr[0], "reply"), "the job kept a reply for a refusal it never received");
  // NOTHING OF THE REFUSED DESIGN outside the preparation's own diagnostic record.
  for (const [k, o] of P.objects) {
    if (/\/prep\/p\d+-\d+\.json$/.test(k)) continue;
    assert.ok(!REFUSED_MARKS.test(typeof o.body === "string" ? o.body : ""), "the refused design reached " + k);
  }
  assert.ok(!REFUSED_MARKS.test(JSON.stringify(view)), "the refused design reached the request's view");
  for (const f of ["bake-list.tsx", "gallery.tsx"]) assert.ok(!REFUSED_MARKS.test(P.page(f)), "the refused design reached " + f);
  // MONEY: the same run with no refusal, charged the same — the correction
  // billed once through the job, the skipped call not at all.
  const plain = await runShape({ design: () => GOOD });
  partsDone(plain.rec);
  assert.equal(P.spent(), plain.P.spent(), "charged differently from a job with no refusal");
  const refs = P.ledger.map((e) => e.ref + ":" + e.reason);
  assert.equal(new Set(refs).size, refs.length, "a charge was made twice: " + JSON.stringify(P.ledger));
});

test("CR 2 — CHANGED VALIDATION CONTEXT: the refusal reaches the job but its cleaner digest is not the one the job's cleaner would judge against; the refusal is declined and the first request asked again — the model's new answer lands, nothing skipped", { timeout: 60000 }, async () => {
  const answers = [REFUSED, GOOD, GOOD_AGAIN];
  const { P, rec, view, staged } = await runShape({
    design: (n) => answers[Math.min(n, answers.length) - 1],
    restage: eachRefusal((c) => ({ ...c, refusal: { ...c.refusal, cleanIn: "0".repeat(64) } })),
  });
  partsDone(rec);
  assert.equal(staged.length, 1);
  const u = useOf(view, 1);
  assert.equal(u.skipped, 0, JSON.stringify(u));
  assert.equal(designs(P).length, 3, "the job did not ask its first request again");
  // ASKED AGAIN, THE SAME REQUEST THE PREPARATION FIRST SENT.
  assert.equal(designs(P)[2].text, designs(P)[0].text);
  assert.ok(P.page("bake-list.tsx").includes("Every Monday morning"));
  assert.ok(!REFUSED_MARKS.test(P.page("bake-list.tsx")));
});

test("CR 3 — A REJECTED CORRECTION: the preparation's correction was refused too; the job skips to the correction request — byte for byte the preparation's, with the recorded feedback — finds no usable answer for it and asks it once: no third designer call; the new answer is validated and lands; neither refused design lands", { timeout: 60000 }, async () => {
  const answers = [REFUSED, REFUSED_TOO, GOOD];
  const { P, rec, view } = await runShape({ design: (n) => answers[Math.min(n, answers.length) - 1] });
  const u = useOf(view, 1);
  assert.ok(u, JSON.stringify(view.parts[1]));
  assert.equal(u.skipped, 1, JSON.stringify(u));
  const d = designs(P);
  assert.equal(d.length, 3, "prep: refused + refused correction; job: the correction only");
  assert.equal(d[2].text, d[1].text, "the job's correction request is not the preparation's");
  partsDone(rec);
  assert.ok(P.page("bake-list.tsx").includes("Every Monday morning"));
  assert.ok(!REFUSED_MARKS.test(P.page("bake-list.tsx")));
});

test("CR 4 — OLDER RECORDS: a staged refusal written before the amendment (no facts) behaves exactly as before — the job asks its first request again, nothing skipped", { timeout: 60000 }, async () => {
  const answers = [REFUSED, GOOD, GOOD_AGAIN];
  const { P, rec, view } = await runShape({
    design: (n) => answers[Math.min(n, answers.length) - 1],
    restage: eachRefusal(({ refusal, ...rest }) => rest),
  });
  partsDone(rec);
  const u = useOf(view, 1);
  assert.equal(u.skipped, 0, JSON.stringify(u));
  assert.equal(designs(P).length, 3);
  assert.equal(designs(P)[2].text, designs(P)[0].text);
});

test("CR 4b — MALFORMED FACTS REACHING THE JOB are no facts: feedback missing — asked again, nothing skipped", { timeout: 60000 }, async () => {
  const answers = [REFUSED, GOOD, GOOD_AGAIN];
  const { P, rec, view } = await runShape({
    design: (n) => answers[Math.min(n, answers.length) - 1],
    restage: eachRefusal((c) => ({ ...c, refusal: { superseded: c.refusal.superseded, cleanIn: c.refusal.cleanIn } })),
  });
  partsDone(rec);
  assert.equal(useOf(view, 1).skipped, 0);
  assert.equal(designs(P).length, 3);
});

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

test("CR 8 — CONTINUATION THROUGH THE REAL QUEUE: one Add-on, the page's turn first — its first design refused (the page exists) and corrected — then the component's designer asks; the paused job keeps the refusal's facts beside its reply (for diagnosis) and the correction; after the answer the next job's page designer goes straight to the kept correction (skipped 1) — the page asked twice in all, never a third time, the refused design never lands, nothing charged twice", { timeout: 60000 }, async () => {
  const HOME = pageSrc("/", "<section className=\"hero\"><h1>Harbour Loaf</h1></section>");
  const ABOUT = pageSrc("/about", "<section className=\"story\"><h1>Our story</h1><p>Since 2019.</p></section>");
  const ABOUT_WITH_FAQ = "import { createFileRoute } from '@tanstack/react-router'\n"
    + "import { Card } from '@/components/ui/card'\n"
    + "export const Route = createFileRoute('/about')({ component: Page })\n"
    + "function Page(){ return <main><section className=\"story\"><h1>Our story</h1><p>Since 2019.</p></section><section className=\"faq\"><Card><h2>Questions</h2><p>Do you deliver? Yes, on Fridays.</p></Card></section></main> }\n";
  const W_PAGE = "add a gallery page";
  const W_Q = "add a questions section to the About page";
  const GALLERY = { page: [{ path: "/gallery", name: "Gallery", purpose: "show the work", sections: ["a grid of photographs"], components: ["card"] }] };
  // REFUSED BY ITS CLEANER: the About page already exists.
  const PAGE_REFUSED = { page: [{ path: "/about", name: "refused-design-marker", purpose: "refused-design-marker", sections: ["a grid"], components: ["card"] }] };
  const Q_OK = { component: [{ page: "/about", where: "after the story", does: "answers common questions", components: ["card"] }] };
  const Q_ASK = { question: { text: "Should the questions cover delivery?", options: ["Yes", "No"] } };
  const n = { page: 0, component: 0 };
  const compiler = installCompiler();
  const P = platform({
    slug: slugOf("c"), pages: [{ path: "index.tsx", source: HOME }, { path: "about.tsx", source: ABOUT }], replies: true, balance: 400,
    answers: {
      route: { intent: "addon" },
      [T.adds]: { kinds: ["page", "component"], scopes: [{ kind: "page", words: W_PAGE, uses: [] }, { kind: "component", words: W_Q, uses: [] }] },
      "add:page": async () => { n.page++; return n.page === 1 ? PAGE_REFUSED : GALLERY; },
      "add:component": async () => { n.component++; return n.component === 1 ? Q_ASK : Q_OK; },
      [T.pages]: { pages: [writtenPage("/gallery"), { path: "src/routes/about.tsx", source: ABOUT_WITH_FAQ }] },
    },
  });
  try {
    const r = await sendMessage(P, { message: "Please " + W_PAGE + ", and " + W_Q + "." });
    const s1 = await settle(P, r.key);
    assert.equal(s1.rec.parts[0].status, "waiting", JSON.stringify(s1.rec.parts.map((p) => [p.status, p.why])));
    assert.deepEqual(n, { page: 2, component: 1 }, "the first job did not refuse and correct the page before the component asked");
    // THE PAUSED JOB'S RECORD: the refused reply kept for diagnosis WITH its
    // facts, never readable as an answer.
    const keptKeys = P.objectKeys("jobs/prepared/").filter((k) => k.endsWith(".kept.json"));
    assert.equal(keptKeys.length, 1);
    const kept = readPrepared(JSON.parse(P.readObj(keptKeys[0])));
    assert.equal(kept.refusals.length, 1, "the paused job did not keep the refusal's facts");
    assert.ok(!REFUSED_MARKS.test(JSON.stringify(kept.calls)), "the refused reply is readable as an answer");
    const q = P.question();
    assert.ok(q && q.by === "add:component", JSON.stringify(q));
    await sendMessage(P, { message: "No", ask: { id: q.id, chosen: true } });
    const s2 = await settle(P, r.key);
    assert.equal(s2.rec.parts[0].status, "done", JSON.stringify(s2.rec.parts.map((p) => [p.status, p.why])));
    assert.deepEqual(n, { page: 2, component: 2 }, "the page designer was asked again after the question");
    // THE NEXT JOB'S STAGED RECORD carries the facts and no refused content.
    for (const k of P.objectKeys("jobs/prepared/").filter((x) => /^jobs\/prepared\/[^/.]+\.json$/.test(x))) assert.ok(!REFUSED_MARKS.test(P.readObj(k)), "refused content staged at " + k);
    const uses = P.objectKeys("jobs/prepared/").filter((k) => k.endsWith(".use.json")).map((k) => JSON.parse(P.readObj(k)));
    assert.ok(uses.some((u) => u.skipped === 1), "no job reports the skip: " + JSON.stringify(uses));
    assert.ok(P.page("about.tsx").includes("Do you deliver?"));
    assert.ok(!REFUSED_MARKS.test(P.page("about.tsx")));
    const refs = P.ledger.map((e) => e.ref + ":" + e.reason);
    assert.equal(new Set(refs).size, refs.length, "a charge was made twice: " + JSON.stringify(P.ledger));
    await P.settle();
    assert.deepEqual(P.unexpected, []);
  } finally { P.close(); compiler.uninstall(); }
});

// ── A REAL CHANGE OF THE CLEANER'S INPUT, THE REQUEST UNCHANGED (2026-10-13) ─
//
// The job designer's cleaner reads the site's own local date (`today`, the
// past-date check); no designer request carries it. So when the site's day
// turns over between the preparation and the job, the job's first request is
// byte for byte the preparation's while what its cleaner judges is not — the
// case CR 2 could only make by rewriting the digest. Here nothing stored is
// touched: the preparation runs at 23:59 site time, the job just after
// midnight (the stand-in's own clock, which `new Date()` reads too).
//
//   CR 9   the day changes: the refusal's digest no longer matches, so it is
//          declined and the first request asked again (the same bytes). The
//          new answer — a one-time job on the preparation's day — is judged
//          against the NEW date and refused `past-date`; corrected once, the
//          job lands on a later day. Had the old refusal been used, the
//          recorded correction (the old day) would have been refused again
//          and the addition lost.
//   CR 9c  the same day: the refusal holds, the job goes straight to the
//          recorded correction and lands with it — no designer call by the
//          job.

const FN_COUNT = { name: "count_loaves", internal: true, returns: "void", body: "BEGIN PERFORM 1; END;" };
const LOAF_SPEC = { tables: [{ name: "loaves", columns: [{ name: "name", type: "text" }, { name: "description", type: "text" }, { name: "price", type: "numeric" }, { name: "photo", type: "text" }], read: "public", write: "none" }] };
const VISIT_SRC = pageSrc("/visit", "<section className=\"come\"><h1>Come to the bakery</h1><p>We are on Harbour Street.</p></section>");
const VISIT_TO = "We are on Harbour Street, by the quay.";
const JOB = (fn, on) => ({ job: [{ name: "loaf_tally", fn, on, at: "23:30" }] });
// 23:59:30 on 13 October in the site's zone (Europe/London is UTC+1 then).
const EVE = Date.UTC(2026, 9, 13, 22, 59, 30);

/** The stand-in moves `Date.now`; `new Date()` with no argument reads it too while installed. */
function dateFollowsNow() {
  const Real = globalThis.Date;
  class Clocked extends Real { constructor(...a) { if (a.length) super(...a); else super(Clocked.now()); } }
  globalThis.Date = Clocked;
  return () => { globalThis.Date = Real; };
}

async function dayTurns({ midnight, jobAnswers }) {
  const { rowsDb, BAKERY_LOAVES, LOAF_COLUMNS } = await import("./fixtures/rows-db.mjs");
  const restoreDate = dateFollowsNow();
  const compiler = installCompiler();
  const db = rowsDb({ tables: { loaves: { columns: LOAF_COLUMNS, rows: BAKERY_LOAVES, next: 12 } }, meta: { schema: JSON.stringify(LOAF_SPEC) } });
  let seen; const jobAsked = new Promise((ok) => { seen = ok; });
  const jobReqs = [];
  const jobMsgs = [];
  let fnN = 0;
  let fnReq = null;
  let pickReq = null;
  // EVERY DISTINCT REQUEST PRICED DIFFERENTLY (and large), so the charge says
  // exactly which calls were billed: a skipped call, a refused preparation
  // answer or a call billed twice would each change the sum.
  const price = new Map();
  const usageFor = (tool, args) => {
    const key = tool + "\u0000" + JSON.stringify(args.messages);
    if (!price.has(key)) price.set(key, { input_tokens: 40000 * (price.size + 1), output_tokens: 9000 * (price.size + 1), model: args.model });
    const { model, ...u } = price.get(key);
    return u;
  };
  const priced = (tool, msgs) => { const v = price.get(tool + "\u0000" + msgs); assert.ok(v, "no priced call for " + tool); return { in: v.input_tokens, out: v.output_tokens, cacheRead: 0, cacheWrite: 0, model: v.model }; };
  const P = platform({
    slug: slugOf("d"), db, balance: 100000, usageFor,
    pages: [{ path: "index.tsx", source: pageSrc("/", "<section className=\"hero\"><h1>Harbour Loaf</h1></section>") }, { path: "visit.tsx", source: VISIT_SRC }],
    answers: {
      route: [
        { intent: "edit", layer: "text", page: "/visit", alsoAsked: ["keep a one-time tally of the loaves"], targets: [{ change: 0, writes: ["page:/visit"] }, { change: 1, writes: ["new-function:count_loaves", "new-job:loaf_tally"], reads: ["data:loaves"] }] },
        { intent: "addon" },
      ],
      [T.text]: async (args) => {
        await Promise.race([jobAsked, new Promise((ok) => setTimeout(ok, 4000))]);
        const at = String(args.messages[0].content).split("\n").find((l) => l.includes("[visit.tsx] We are on Harbour Street."));
        return { edits: [{ id: Number(String(at || "-1.").split(".")[0]), to: VISIT_TO }] };
      },
      [T.adds]: (args) => { pickReq = JSON.stringify(args.messages); return { kinds: ["function", "job"] }; },
      "add:function": (args) => { fnN++; fnReq = JSON.stringify(args.messages); return { function: [FN_COUNT] }; },
      "add:job": (args) => { jobReqs.push(String(args.messages[0].content)); jobMsgs.push(JSON.stringify(args.messages)); seen(); return jobAnswers[Math.min(jobReqs.length, jobAnswers.length) - 1]; },
    },
  });
  try {
    P.advance(EVE - Date.now());
    const r = await sendMessage(P, { message: "On the Visit page, say we are on Harbour Street by the quay, and keep a one-time tally of the loaves.", tz: "Europe/London" });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const prep = P.queue.filter((m) => m.body.kind === "request-prep");
    const jobs = P.queue.filter((m) => m.body.kind !== "request-prep");
    assert.equal(prep.length, 1, "the addition was not claimed for preparation");
    P.queue.splice(0);
    const running = deliver(P, jobs[0]);
    await deliver(P, prep[0]);
    const prepDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());
    // MIDNIGHT IN THE SITE'S ZONE, between the preparation and the job — 40 s
    // on the clock, well inside every lease.
    if (midnight) P.advance(40000);
    const jobDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());
    await running;
    const { rec } = await settle(P, r.key);
    const view = await viewOf(P, r.key);
    await P.settle();
    assert.deepEqual(P.unexpected, [], "requests the stand-ins were not set up for");
    // WHAT THE ADD-ON JOB WAS CHARGED, net of any refund, from the ledger.
    const addon = P.jobsOf(r.key).find((j) => j.op === "addon");
    assert.ok(addon, "no add-on job: " + JSON.stringify(P.jobsOf(r.key).map((j) => j.op)));
    const charged = -P.ledger.filter((e) => typeof e.ref === "string" && e.ref.startsWith(addon.id + "#")).reduce((n, e) => n + e.delta, 0);
    const bill = { pick: () => priced(T.adds, pickReq), fn: () => priced(T.design, fnReq), job: (i) => priced(T.design, jobMsgs[i]) };
    return { P, db, rec, view, jobReqs, fnN, prepDay, jobDay, charged, bill };
  } finally { P.close(); compiler.uninstall(); restoreDate(); }
}

const J_BAD = JOB("count_bread", "2026-10-13");
const J_13 = JOB("count_loaves", "2026-10-13");
const J_15 = JOB("count_loaves", "2026-10-15");
const jobDates = (db) => db.log().map((q) => String(q.query) + " " + JSON.stringify(q.params || [])).filter((t) => /loaf_tally/.test(t)).join("\n");

test("CR 9 — A REAL CHANGE OF THE CLEANER'S INPUT: the site's day turns over between the preparation and the job; the job's first designer request is byte for byte the preparation's, but its cleaner's date is new — the old refusal is declined, the request asked fresh, the new answer judged against the new date (refused past-date) and corrected once; the job lands on the later day, nothing of the old answer or the old day lands, and the counts and charges are the calls really made", { timeout: 60000 }, async () => {
  const { P, db, rec, view, jobReqs, fnN, prepDay, jobDay, charged, bill } = await dayTurns({ midnight: true, jobAnswers: [J_BAD, J_13, J_13, J_15] });
  assert.deepEqual([prepDay, jobDay], ["2026-10-13", "2026-10-14"], "the clock did not turn the site's day between the preparation and the job");
  assert.deepEqual(rec.parts.map((p) => p.status), ["done", "done"], JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
  // FOUR job-designer calls: the preparation's two, the job's fresh first
  // request and its one correction. The function designer once (replayed).
  assert.equal(jobReqs.length, 4, "job designer calls");
  assert.equal(fnN, 1, "the function designer was asked again");
  // THE REQUEST DID NOT CHANGE — only what the cleaner judges did.
  assert.equal(jobReqs[2], jobReqs[0], "the job's first request differs from the preparation's (the case would not test the digest)");
  // JUDGED AGAINST THE NEW DATE: the job's correction carries the past-date reason.
  assert.match(jobReqs[3], /past-date/, "the fresh answer was not refused against the new day");
  assert.match(jobReqs[1], /no-job-fn/);
  const u = useOf(view, 1);
  assert.ok(u && u.staged === "yes", JSON.stringify(view.parts[1]));
  assert.deepEqual({ skipped: u.skipped, fresh: u.fresh, replayed: u.replayed }, { skipped: 0, fresh: 2, replayed: 2 }, JSON.stringify(u));
  // THE NEW STATE: the job is registered for the 15th, never the 13th.
  const reg = jobDates(db);
  assert.match(reg, /2026-10-15/, "the corrected job was not registered: " + reg);
  assert.doesNotMatch(reg, /2026-10-13/, "the old day reached the site: " + reg);
  assert.doesNotMatch(reg, /count_bread/);
  assert.ok(P.page("visit.tsx").includes(VISIT_TO));
  const refs = P.ledger.map((e) => e.ref + ":" + e.reason);
  assert.equal(new Set(refs).size, refs.length, "a charge was made twice: " + JSON.stringify(P.ledger));
  // CHARGED FOR THE CALLS THE JOB REALLY USED: the picker and the function
  // (replayed, billed as any replay), its own fresh first request (refused,
  // billed — real work) and its correction. Never the preparation's refused
  // answer or its correction, which nothing used.
  assert.equal(charged, pageCredits(bill.pick(), bill.fn(), bill.job(2), bill.job(3)), "the add-on job's charge is not the calls it used");
  // …AND THE CHECK CAN TELL: billing the preparation's correction as well would differ.
  assert.notEqual(pageCredits(bill.pick(), bill.fn(), bill.job(1), bill.job(2), bill.job(3)), charged);
});

test("CR 9c — CONTROL, THE SAME DAY: nothing the cleaner judges changed, so the job goes straight to the recorded correction — no job-designer call by the job (skipped 1), it lands as prepared, and it is charged exactly what it used", { timeout: 60000 }, async () => {
  const { P, db, rec, view, jobReqs, fnN, prepDay, jobDay, charged, bill } = await dayTurns({ midnight: false, jobAnswers: [J_BAD, J_13, J_15, J_15] });
  assert.deepEqual([prepDay, jobDay], ["2026-10-13", "2026-10-13"]);
  assert.deepEqual(rec.parts.map((p) => p.status), ["done", "done"], JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
  assert.equal(jobReqs.length, 2, "the job asked the job designer");
  assert.equal(fnN, 1);
  const u = useOf(view, 1);
  assert.deepEqual({ skipped: u.skipped, fresh: u.fresh, replayed: u.replayed }, { skipped: 1, fresh: 0, replayed: 3 }, JSON.stringify(u));
  const reg = jobDates(db);
  assert.match(reg, /2026-10-13/, "the recorded correction did not land: " + reg);
  assert.doesNotMatch(reg, /2026-10-15|count_bread/);
  const refs = P.ledger.map((e) => e.ref + ":" + e.reason);
  assert.equal(new Set(refs).size, refs.length, "a charge was made twice: " + JSON.stringify(P.ledger));
  // CHARGED FOR WHAT IT USED: picker, function and the recorded correction,
  // all replayed — never the skipped first request (no model asked), never
  // the preparation's refused answer.
  assert.equal(charged, pageCredits(bill.pick(), bill.fn(), bill.job(1)), "the add-on job's charge is not the calls it used");
  // …AND THE CHECK CAN TELL: billing the skipped (refused) first request too would differ.
  assert.notEqual(pageCredits(bill.pick(), bill.fn(), bill.job(0), bill.job(1)), charged);
});
