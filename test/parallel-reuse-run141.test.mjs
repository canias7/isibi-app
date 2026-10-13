// RUN 141'S SHAPE ON RUN 141'S SITE (2026-10-12, after the isolation release).
// Live, the Add-on part's job (996afba7) replayed 1 prepared answer and asked
// 3 again, although its preparation overlapped the text part's job by 130.3 s.
// Its preparation recorded 5 calls for the step; the job made 4 (picker,
// designer, judge, writer), and the picker was the one replayed.
//
// Here the same two parts run through the real Worker on the fold-lane-bakery
// pages as they stood before run 141
// (`docs/history/evidence/2026-10-12-run141/source-before.json`), in run 141's
// order: the text part (the /gallery heading) is routed first and holds the
// Bake List addition back; the addition's preparation reads the site BEFORE the
// heading is published; its job runs AFTER. The text step is held until the
// preparation's designer has been asked, so that order is enforced, not hoped
// for.
//
//   R141 1 — an unrelated page's change (/gallery) leaves every prepared
//            answer reusable: the job replays all of them (fresh 0).
//   R141 2 — a change to the addition's own page (/bake-list) between the
//            preparation and the job invalidates exactly what reads it: the
//            writer is asked again against the page as it now is, and that
//            change is kept; the picker and designer (shown the page's
//            headline as the request was understood) are replayed.
//   R141 3 — run 141's counts: the preparation's FIRST designer answer is
//            refused by the cleaner and corrected (5 recorded calls with the
//            judge, 4 here without it). A refused answer is never replayed
//            (VA 0–5), so the job's designer is asked again; a real model's new
//            answer differs from the prepared correction, so everything built
//            on it is asked again too. The refused answer never lands.
//
// ⚠ SUPPLIED-MODEL PROOF ONLY: every answer is supplied, so this shows what
// the code does with an answer, never what a real model answers.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { platform, sendMessage, settle, deliver, call, T } from "./fixtures/request-flow.mjs";
import { installCompiler } from "./fixtures/cf-containers.mjs";
import { blockNetwork } from "./fixtures/no-network.mjs";

blockNetwork();

const SITE = JSON.parse(readFileSync(new URL("../docs/history/evidence/2026-10-12-run141/source-before.json", import.meta.url), "utf8"));
const OLD_HEAD = "Photographs straight from our ovens";
const NEW_HEAD = "Fresh from our ovens";
const W_HEAD = `change the Gallery page heading '${OLD_HEAD}' to '${NEW_HEAD}'`;
const W_FAQ = "add a short questions section to the Bake List page answering 'When is the list updated?' with 'Every Monday morning.'";
const MESSAGE = W_FAQ[0].toUpperCase() + W_FAQ.slice(1) + ". And " + W_HEAD + ".";
const FAQ_TARGETS = ["page:/bake-list", "new-component:bake-list-questions"];
const FAQ = { page: "/bake-list", where: "after the sign-up form", does: "answers when the bake list is updated", components: ["accordion"] };
const GOOD = { component: [FAQ] };
const GOOD_AGAIN = { component: [{ ...FAQ, does: "answers when the weekly bake list changes" }] };
const REFUSED = { component: [{ ...FAQ, page: "/nowhere" }] };
const BAKE_LINE = "Join the bake list";
const withFaq = (src, words = "When is the list updated? Every Monday morning.") => src.replace("    </SiteChrome>", `      <section className="faq"><h2>Questions</h2><p>${words}</p></section>\n    </SiteChrome>`);

const slugOf = (k) => "r141-" + k + "-" + Math.random().toString(16).slice(2, 8);
const lineOf = (args, words) => {
  const at = String(args.messages[0].content).split("\n").find((l) => l.includes("[gallery.tsx]") && l.includes(words));
  return Number(String(at || "-1.").split(".")[0]);
};
const viewOf = async (P, key) => { const v = await call(P, "GET", "/api/site/request/" + P.slug + "/" + key); assert.equal(v.status, 200, JSON.stringify(v.body)); return v.body.request; };
const tools = (P) => P.modelLog.map((m) => m.tool);
const count = (P, tool) => tools(P).filter((t) => t === tool).length;

/**
 * Run 141's two parts. `design(n)` answers the designer's n-th call; `between`
 * runs inside the text step, after the preparation's designer has been asked
 * and before the heading is written (so before either publish and before the
 * addition's job).
 */
async function runShape({ design, between = null, faqTargets = FAQ_TARGETS, meet = true }) {
  const compiler = installCompiler();
  let P = null;
  let opened;
  const designerAsked = new Promise((r) => { opened = r; });
  const seen = { galleryAtFirstDesign: null };
  let designN = 0;
  let betweenDone = false;
  P = platform({
    slug: slugOf("s"), pages: SITE.pages, replies: true, balance: 400,
    answers: {
      route: (args, n) => (n === 0
        ? { intent: "edit", layer: "text", page: "/gallery", alsoAsked: [W_FAQ], targets: [{ change: 0, writes: ["page:/gallery"] }, { change: 1, writes: faqTargets }] }
        : { intent: "addon" }),
      [T.text]: async (args) => {
        if (meet) {
          const met = await Promise.race([designerAsked.then(() => true), new Promise((r) => setTimeout(() => r(false), 3000))]);
          assert.ok(met, "the preparation's designer was never asked while the text step ran");
        }
        // AFTER THE HEADING IS PUBLISHED and before the addition's job: the
        // write a case makes in between (never inside the text job, whose own
        // commit would race it).
        if (between) (async () => {
          for (let i = 0; i < 2000 && !P.page("gallery.tsx").includes(NEW_HEAD); i++) await new Promise((r) => setTimeout(r, 2));
          await between(P);
          betweenDone = true;
        })();
        return { edits: [{ id: lineOf(args, OLD_HEAD), to: NEW_HEAD }] };
      },
      [T.adds]: { kinds: ["component"], scopes: [{ kind: "component", words: W_FAQ, uses: [] }] },
      "add:component": () => {
        designN++;
        if (designN === 1) { seen.galleryAtFirstDesign = P.page("gallery.tsx"); opened(); }
        return design(designN);
      },
      // THE WRITER BUILDS ON THE PAGE AS IT IS STORED NOW, as a model shown it would.
      [T.pages]: () => ({ pages: [{ path: "src/routes/bake-list.tsx", source: withFaq(P.page("bake-list.tsx")) }] }),
    },
  });
  try {
    const r = await sendMessage(P, { message: MESSAGE });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const first = P.queue.splice(0);
    await Promise.all(first.map((m) => deliver(P, m)));
    const { rec } = await settle(P, r.key);
    const view = await viewOf(P, r.key);
    await P.settle();
    if (between) assert.ok(betweenDone, "the write in between never ran");
    assert.deepEqual(P.unexpected, [], "requests the stand-ins were not set up for");
    return { P, rec, view, seen };
  } finally { P.close(); compiler.uninstall(); }
}

const partsDone = (rec) => assert.deepEqual(rec.parts.map((p) => p.status), ["done", "done"], JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
const useOf = (view, n) => (view.parts[n].prepUse || [])[0] || null;

test("R141 1 — AN UNRELATED PAGE'S CHANGE KEEPS PREPARED WORK: the Bake List addition is prepared while /gallery still reads the old heading, the heading is published, then the addition's job replays every prepared answer (fresh 0); both pages land, nothing asked twice", { timeout: 60000 }, async () => {
  const { P, rec, view, seen } = await runShape({ design: () => GOOD });
  partsDone(rec);
  assert.ok(seen.galleryAtFirstDesign.includes(OLD_HEAD) && !seen.galleryAtFirstDesign.includes(NEW_HEAD), "the preparation did not read the site before the heading changed");
  assert.ok(P.page("gallery.tsx").includes(NEW_HEAD), "the heading did not land");
  assert.ok(P.page("bake-list.tsx").includes("Every Monday morning"), "the questions section did not land");
  assert.ok(P.page("bake-list.tsx").includes(BAKE_LINE), "the Bake List lost its own content");
  const u = useOf(view, 1);
  assert.ok(u && u.staged === "yes", JSON.stringify(view.parts[1]));
  assert.equal(u.fresh, 0, "an answer prepared before an unrelated page changed was asked again: " + JSON.stringify(u));
  assert.equal(u.replayed, 3, "picker, designer and writer were not all replayed: " + JSON.stringify(u));
  // SCOPED, AND SAID SO: the part's page scope covered the picker, the designer
  // and the writer — live, job 996afba7 reported `scoped 0` although its trace
  // marked the scope (`scope:?`, pages 1).
  assert.equal(u.scoped, 3, "the Add-on's scoped calls were not counted: " + JSON.stringify(u));
  assert.equal(u.needs, 0, JSON.stringify(u));
  assert.equal(count(P, T.adds), 1);
  assert.equal(count(P, T.design), 1);
  assert.equal(count(P, T.pages), 1);
  const refs = P.ledger.map((e) => e.ref);
  assert.equal(new Set(refs).size, refs.length, "a charge was made twice: " + JSON.stringify(P.ledger));
});

test("R141 2 — A CHANGE TO THE ADDITION'S OWN PAGE INVALIDATES WHAT READS IT: /bake-list changes between the preparation and the job (a write no plan declared); the writer is asked again against the page as it now is and that change is kept; the picker and designer, which never read the page's source, are replayed", { timeout: 60000 }, async () => {
  const { P, rec, view } = await runShape({
    design: () => GOOD,
    between: async (Pl) => {
      const key = "source/" + Pl.slug + "/pages.json";
      const pages = JSON.parse(Pl.objects.get(key).body).map((p) => (p.path === "bake-list.tsx" ? { ...p, source: p.source.replace(BAKE_LINE, "Join the weekly bake list") } : p));
      Pl.objects.set(key, { ...Pl.objects.get(key), body: JSON.stringify(pages), etag: "e-between" });
    },
  });
  partsDone(rec);
  const u = useOf(view, 1);
  assert.ok(u && u.staged === "yes", JSON.stringify(view.parts[1]));
  assert.ok(u.fresh >= 1, "the writer, whose page changed, was replayed from the stale preparation: " + JSON.stringify(u));
  assert.equal(u.replayed, 2, "only the picker and the designer may be replayed: " + JSON.stringify(u));
  assert.equal(count(P, T.pages), 2, "the writer was not asked again");
  assert.ok(P.page("bake-list.tsx").includes("Join the weekly bake list"), "the change made in between was lost");
  assert.ok(P.page("bake-list.tsx").includes("Every Monday morning"), "the questions section did not land");
});

test("R141 3 — RUN 141'S COUNTS: the preparation's first designer answer is refused and corrected; the refused answer is never replayed, so the job's designer is asked again, and a new answer from the model makes the writer's input new too — 1 replayed (the picker), the rest asked again; the refused page never lands", { timeout: 60000 }, async () => {
  const answers = [REFUSED, GOOD, GOOD_AGAIN];
  const { P, rec, view } = await runShape({ design: (n) => answers[Math.min(n, answers.length) - 1] });
  partsDone(rec);
  assert.equal(view.parts[1].prepRun.step.calls, 4, "the preparation did not record picker, refused design, correction and writer: " + JSON.stringify(view.parts[1].prepRun));
  const u = useOf(view, 1);
  assert.ok(u && u.staged === "yes", JSON.stringify(view.parts[1]));
  assert.equal(u.replayed, 1, JSON.stringify(u));
  assert.equal(u.fresh, 2, JSON.stringify(u));
  assert.equal(count(P, T.design), 3, "prep: refused + correction; job: one new answer");
  assert.ok(!P.page("bake-list.tsx").includes("/nowhere"));
  assert.ok(P.page("bake-list.tsx").includes("Every Monday morning"));
});

test("R141 4 — CONTROL: the same addition with no page scope (its writes reach the whole site) counts no scoped call", { timeout: 60000 }, async () => {
  const { rec, view } = await runShape({ design: () => GOOD, faqTargets: ["site"], meet: false });
  partsDone(rec);
  const u = useOf(view, 1);
  assert.ok(u, JSON.stringify(view.parts[1]));
  assert.equal(u.scoped, 0, "an unscoped Add-on reported scoped calls: " + JSON.stringify(u));
});
