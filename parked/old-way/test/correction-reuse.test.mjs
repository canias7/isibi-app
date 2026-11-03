// PARKED (2026-11-03, park-old-way): the old-way half of test/correction-reuse.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
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
import { platform, sendMessage, settle, deliver, call, T } from "../../../test/fixtures/request-flow.mjs";
import { installCompiler } from "../../../test/fixtures/cf-containers.mjs";
import { blockNetwork } from "../../../test/fixtures/no-network.mjs";
import { pageCredits } from "../../../builder/publish-pages.mjs";
import { recorder, replayer, readPrepared, readRefusal, rejectReply, stagedRecord, valueDigest, priorRefusalOf, PriorRefusal, requestHash, REFUSAL_REQ_MAX, REFUSAL_FEEDBACK_MAX } from "../../../builder/prepared.mjs";

blockNetwork();

const SITE = JSON.parse(readFileSync(new URL("../../../docs/history/evidence/2026-10-12-run141/source-before.json", import.meta.url), "utf8"));
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

// ── CONTINUATION THROUGH THE REAL QUEUE ─────────────────────────────────────

import { page as pageSrc } from "../../../test/fixtures/live-ask.mjs";
import { writtenPage } from "../../../test/fixtures/addon-route.mjs";

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
