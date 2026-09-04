// The repair pass: what the render check found, handed to a cheap edit.
//
// THE ONE THING THIS FILE IS REALLY FOR is the discrimination at the top — the
// render check was BLIND to a crashed route and the whole feature rests on it
// no longer being. Everything else guards the spending.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  repairBrief, repairPages, instructionFor, repairNote, REPAIR_RULES, MAX_REPAIRS,
  repairRound, repairRoundNote,
} from "../builder/site-repair.mjs";
import { readPage, SERIOUS } from "../builder/site-render.mjs";
import { tweakRequest, TWEAK_RULES, MAX_TWEAK_CHARS, TWEAK_MODEL } from "../builder/site-tweak.mjs";

const page = (path, extra = "") => ({
  path,
  source: `import { createFileRoute } from "@tanstack/react-router";\n` +
    `export const Route = createFileRoute("${path === "index.tsx" ? "/" : "/" + path.replace(/\.tsx$/, "")}")({ component: P });\n` +
    `function P() { return <div><h1>The Lido Cafe</h1><p>Coffee by the pool.</p>${extra}</div>; }\n`,
});

const crashObs = (viewport = "desktop", route = "/book") => ({
  route, viewport, text: 109, images: 0, crashed: true,
  consoleErrors: ["Error: useFormField should be used within <FormItem>"],
});

/* ─────────────────────── the signal that was missing ─────────────────────── */

test("A CRASHED ROUTE IS `threw` — and without the signal it was only `logged`", () => {
  const seen = readPage(crashObs());
  assert.equal(seen.length, 1);
  assert.equal(seen[0].kind, "threw", "a route that crashed into the error card must be SERIOUS");
  assert.ok(SERIOUS.has(seen[0].kind));
  assert.match(seen[0].detail, /useFormField/, "the console error IS the diagnosis — it must survive");

  // THE INVERSE, and it is the measurement this feature exists for. The same
  // observation with the signal absent is exactly what the check used to report
  // for `the-lido-cafe`'s /book: a `logged` finding, which is not SERIOUS, on a
  // page whose booking form was dead.
  const blind = readPage({ ...crashObs(), crashed: false });
  assert.equal(blind[0].kind, "logged");
  assert.ok(!SERIOUS.has(blind[0].kind), "the old signal was not serious — that WAS the bug");
});

test("the error card's own text is over the blank floor, which is why blank could not catch it", () => {
  // 109 characters of real copy. `BLANK_TEXT_CHARS` is 40, so the apology reads
  // as a page with content. Pinned because raising that floor is the obvious
  // wrong fix — it would flag every short but correct page.
  const notBlank = readPage({ route: "/book", viewport: "desktop", text: 109, images: 0, crashed: false });
  assert.ok(!notBlank.some((f) => f.kind === "blank"), "109 chars is not blank, and must not be made so");
});

test("the template really stamps the hook the probe looks for", () => {
  const src = readFileSync(new URL("../builder/lovable/template/src/lib/error-page.tsx", import.meta.url), "utf8");
  const code = src.replace(/^\s*\/\/.*$/gm, "");   // prose about the attribute is not the attribute
  assert.match(code, /data-slot="error-page"/, "ErrorPage lost its hook — the render check goes blind again");
});

/* ────────────────────────────── what gets fixed ──────────────────────────── */

test("only SERIOUS findings are worth paying for", () => {
  const pages = [page("index.tsx"), page("book.tsx")];
  for (const kind of ["logged", "contrast", "overflow", "image", "seethrough"]) {
    const b = repairBrief({ ok: true, findings: [{ route: "/book", viewport: "desktop", kind, detail: "x" }] }, pages);
    assert.equal(b.work.length, 0, `${kind} must not buy a model call — it is a judgement, not a dead page`);
  }
  const b = repairBrief({ ok: true, findings: readPage(crashObs()) }, pages);
  assert.equal(b.work.length, 1, "…but a crash must");
});

test("one page, one call — the same crash at two widths is not two calls", () => {
  const pages = [page("index.tsx"), page("book.tsx")];
  const findings = [...readPage(crashObs("desktop")), ...readPage(crashObs("phone"))];
  const b = repairBrief({ ok: true, findings }, pages);
  assert.equal(b.work.length, 1, "deduped by page");
  // and the detail is not repeated in the instruction
  assert.equal(b.work[0].instruction.match(/useFormField/g).length, 1);
});

test("a finding for a route this build has no page for is skipped", () => {
  const b = repairBrief({ ok: true, findings: readPage(crashObs("desktop", "/ghost")) }, [page("index.tsx")]);
  assert.equal(b.work.length, 0, "there is no file to hand a model");
});

test("A CHECK THAT COULD NOT RUN BUYS NOTHING", () => {
  const pages = [page("book.tsx")];
  assert.equal(repairBrief({ ok: false, findings: readPage(crashObs()) }, pages).work.length, 0);
  assert.equal(repairBrief(null, pages).work.length, 0);
  assert.equal(repairBrief(undefined, pages).work.length, 0);
});

test("the cap is real AND what it dropped is reported", () => {
  const pages = ["a", "b", "c", "d", "e"].map((n) => page(`${n}.tsx`));
  const findings = pages.flatMap((p) => readPage(crashObs("desktop", "/" + p.path.replace(/\.tsx$/, ""))));
  const b = repairBrief({ ok: true, findings }, pages);
  assert.equal(b.work.length, MAX_REPAIRS);
  assert.equal(b.dropped, 5 - MAX_REPAIRS, "a silent cap reads as 'covered everything'");
});

/* ──────────────────────────────── the run ────────────────────────────────── */

const reply = (source) => ({ content: [{ type: "tool_use", input: { source } }], usage: { input_tokens: 10, output_tokens: 20 } });
const fixed = (p) => p.source.replace("<p>Coffee by the pool.</p>", "<div><p>Coffee by the pool.</p></div>");

test("a repair replaces ONLY the broken page's source", async () => {
  const pages = [page("index.tsx"), page("book.tsx")];
  const want = fixed(pages[1]);
  const out = await repairPages({
    report: { ok: true, findings: readPage(crashObs()) },
    pages,
    send: async () => reply(want),
  });
  assert.deepEqual(out.repaired, [{ path: "book.tsx", route: "/book" }]);
  assert.equal(out.pages[1].source, want, "the fixed page carries the new source");
  assert.equal(out.pages[0], pages[0], "every other page is the SAME OBJECT, untouched");
  assert.equal(out.usage.length, 1);
});

test("A REFUSAL LEAVES THE PAGE BYTE-IDENTICAL, and still reports what it cost", async () => {
  const pages = [page("index.tsx"), page("book.tsx")];
  const before = pages[1].source;
  for (const [what, r] of [
    ["reworded", reply(pages[1].source.replace("Coffee by the pool.", "Coffee beside the water."))],
    ["moved-route", reply(pages[1].source.replace('createFileRoute("/book")', 'createFileRoute("/booking")'))],
    ["no-change", reply(pages[1].source)],
    ["truncated", reply("tiny")],
    ["unreadable", { content: [], usage: { input_tokens: 5, output_tokens: 1 } }],
  ]) {
    const out = await repairPages({ report: { ok: true, findings: readPage(crashObs()) }, pages, send: async () => r });
    assert.equal(out.repaired.length, 0, `${what} must not be published`);
    assert.equal(out.pages[1].source, before, `${what} must leave the page exactly as it was`);
    assert.equal(out.usage.length, 1, `${what}: the call happened and is charged for`);
    assert.equal(out.refused[0].route, "/book");
  }
});

test("it NEVER throws — a build that already succeeded must publish", async () => {
  const pages = [page("book.tsx")];
  const report = { ok: true, findings: readPage(crashObs()) };
  for (const send of [
    async () => { throw new Error("provider down"); },
    async () => null,
    async () => ({ content: null }),
  ]) {
    const out = await repairPages({ report, pages, send });
    assert.equal(out.pages[0].source, pages[0].source);
    assert.equal(out.repaired.length, 0);
  }
});

test("no `send` is a total no-op — every existing caller is unchanged", async () => {
  const pages = [page("book.tsx")];
  const out = await repairPages({ report: { ok: true, findings: readPage(crashObs()) }, pages });
  assert.equal(out.pages, pages, "the same array back");
  assert.equal(out.usage.length, 0, "nothing was spent");
});

test("a page too large to send cheaply is refused BY NAME rather than silently", async () => {
  const big = page("book.tsx");
  big.source = big.source + "x".repeat(MAX_TWEAK_CHARS);
  let called = 0;
  const out = await repairPages({
    report: { ok: true, findings: readPage(crashObs()) }, pages: [big],
    send: async () => { called++; return reply("x"); },
  });
  assert.equal(called, 0, "nothing is paid for a page that cannot be sent");
  assert.equal(out.refused[0].reason, "too-big");
});

/* ─────────────────────────── the prompt and the note ─────────────────────── */

test("the repair rules are their own, and are NOT the tweak lane's", () => {
  assert.notEqual(REPAIR_RULES, TWEAK_RULES);
  // TWEAK_RULES opens on a customer asking for a visual change and lists
  // `cannot` for anything that is not one — handed a crash it is an instruction
  // to refuse. That is the whole reason this constant exists.
  assert.match(TWEAK_RULES, /one visual change/i);
  assert.doesNotMatch(REPAIR_RULES, /one visual change/i);
  // The two promises the guards actually enforce have to be STATED, or the
  // model spends its answer on something that is thrown away.
  assert.match(REPAIR_RULES, /DO NOT CHANGE ANY OF THE WORDS/);
  assert.match(REPAIR_RULES, /createFileRoute/);
  // And the sentence that stops "the page looks fine to me".
  assert.match(REPAIR_RULES, /watched happening in a browser/i);
});

test("THE TWEAK LANE SENDS EXACTLY WHAT IT SENT BEFORE", () => {
  // The `rules`/`heading` parameters are additive. If a default drifted, every
  // customer tweak on the platform would quietly start using the repair prompt.
  const a = tweakRequest({ instruction: "make the heading bigger", path: "/menu", source: "x" });
  assert.equal(a.system, TWEAK_RULES);
  assert.match(a.messages[0].content, /^THE CHANGE THEY ASKED FOR\n/);
  const b = tweakRequest({ instruction: "i", path: "/p", source: "s", rules: REPAIR_RULES, heading: "WHAT WENT WRONG" });
  assert.equal(b.system, REPAIR_RULES);
  assert.match(b.messages[0].content, /^WHAT WENT WRONG\n/);
});

test("the instruction carries the detail rather than summarising it away", () => {
  const s = instructionFor(new Set(["threw"]), ["Error: useFormField should be used within <FormItem>"]);
  assert.match(s, /crashed/);
  assert.match(s, /useFormField should be used within <FormItem>/, "the detail names the fix in six words");
  assert.match(instructionFor(new Set(["blank"]), []), /nothing rendered/);
});

test("A SUCCESSFUL REPAIR IS SILENT; ONE THAT FAILED NAMES THE PAGE", () => {
  assert.equal(repairNote({ repaired: [{ path: "book.tsx", route: "/book" }], refused: [] }), "",
    "a repair is our business, not the customer's — and saying so invites them to hunt for damage");
  assert.equal(repairNote({ repaired: [], refused: [] }), "");
  assert.equal(repairNote(null), "");
  const one = repairNote({ repaired: [], refused: [{ path: "book.tsx", route: "/book" }] });
  assert.match(one, /\/book/, "a page still broken is actionable, so it is named");
});

/* ──────────── a language variant is its primary page (run 34, 2026-09-04) ─────────── */

test("A CRASH ON /es/gear IS gear.tsx's — and only for the site's OWN prefixes", () => {
  const pages = [page("index.tsx"), page("gear.tsx")];
  // Run 34's report, as the reply carried it: the variants threw, the primary
  // route was not in the (partial) report at all.
  const findings = [
    ...readPage(crashObs("phone", "/es/gear")),
    ...readPage(crashObs("phone", "/fr/gear")),
    ...readPage(crashObs("phone", "/es")),
  ];
  const b = repairBrief({ ok: true, findings }, pages, { prefixes: ["es", "fr"] });
  assert.deepEqual(b.work.map((w) => w.path).sort(), ["gear.tsx", "index.tsx"], "the variant's crash reaches the primary file");
  assert.equal(b.work.find((w) => w.path === "gear.tsx").route, "/gear", "the route handed to the model is the primary one");
  assert.equal(b.work.find((w) => w.path === "gear.tsx").instruction.match(/useFormField/g).length, 1, "two variants of one crash are one sentence");
  // NOT A PREFIX THIS SITE HAS: `/de/gear` on a site with no German is nobody's
  // page, exactly as before.
  assert.equal(repairBrief({ ok: true, findings: readPage(crashObs("phone", "/de/gear")) }, pages, { prefixes: ["es"] }).work.length, 0);
  // AND WITHOUT PREFIXES the reading is what it always was — the build's
  // callers are unchanged.
  assert.equal(repairBrief({ ok: true, findings }, pages).work.length, 0);
  // A prefix handed with slashes around it still matches.
  assert.equal(repairBrief({ ok: true, findings }, pages, { prefixes: ["/es/"] }).work.length, 2);
  // The primary route itself is untouched by the stripping.
  assert.equal(repairBrief({ ok: true, findings: readPage(crashObs("desktop", "/gear")) }, pages, { prefixes: ["es"] }).work[0].path, "gear.tsx");
});

test("the picked model reaches the request; the build's default when none is named", async () => {
  const pages = [page("book.tsx")];
  const seen = [];
  const send = async (req) => { seen.push(req.model); return reply(fixed(pages[0])); };
  await repairPages({ report: { ok: true, findings: readPage(crashObs()) }, pages, send, model: "sentinel-quick" });
  await repairPages({ report: { ok: true, findings: readPage(crashObs()) }, pages, send });
  assert.deepEqual(seen, ["sentinel-quick", TWEAK_MODEL]);
});

/* ──────────── the round on the publish spine (owner, 2026-09-04) ─────────── */

const crashedReport = (route = "/book") => ({ ok: true, findings: readPage(crashObs("desktop", route)) });

test("repairRound: no report, a clean report, and no room each answer by name and spend NOTHING", async () => {
  const pages = [page("book.tsx")];
  let sent = 0, compiled = 0;
  const send = async () => { sent++; return reply(fixed(pages[0])); };
  const compile = async () => { compiled++; return { ok: true, files: {} }; };
  assert.equal((await repairRound({ report: null, pages, send, compile })).why, "no-report");
  assert.equal((await repairRound({ report: { ok: false, findings: readPage(crashObs()) }, pages, send, compile })).why, "no-report");
  assert.equal((await repairRound({ report: { ok: true, findings: [] }, pages, send, compile })).why, "clean");
  const time = await repairRound({ report: crashedReport(), pages, send, compile, room: false });
  assert.equal(time.ran, false);
  assert.equal(time.why, "time");
  assert.deepEqual(time.routes, ["/book"], "a round there was no time for names the page it would have fixed");
  assert.equal(sent + compiled, 0, "an answer that did not run spent nothing");
  // No deps is not a crash either.
  assert.equal((await repairRound({ report: crashedReport(), pages })).why, "no-deps");
});

test("repairRound: a fix that compiles is what ships — the second build and the fixed pages", async () => {
  const pages = [page("index.tsx"), page("book.tsx")];
  const want = fixed(pages[1]);
  const compiled = [];
  const out = await repairRound({
    report: crashedReport(), pages,
    send: async () => reply(want),
    compile: async (list) => { compiled.push(list); return { ok: true, files: { "index.html": { t: "<build-2>" } }, render: { ok: true, findings: [] } }; },
  });
  assert.equal(out.ran, true);
  assert.deepEqual(out.repaired, ["/book"]);
  assert.equal(compiled.length, 1, "the fixed list was compiled once");
  assert.equal(compiled[0][1].source, want, "…and it was the FIXED source that was compiled");
  assert.equal(out.built.files["index.html"].t, "<build-2>", "the second build is what the spine ships");
  assert.equal(out.pages[1].source, want, "…and the fixed pages are what it stores");
  assert.equal(out.pages[0], pages[0], "the untouched page is the same object");
  assert.equal(out.usage.length, 1, "the call is charged for");
});

test("repairRound: a fix that does not compile ships the ORIGINAL, says so, and still charges the call", async () => {
  const pages = [page("book.tsx")];
  const out = await repairRound({
    report: crashedReport(), pages,
    send: async () => reply(fixed(pages[0])),
    compile: async () => ({ ok: false, stage: "typecheck", error: "the repair broke it" }),
  });
  assert.equal(out.ran, true);
  assert.equal(out.built, null, "a broken repair must never replace a build that worked");
  assert.equal(out.pages, null, "…nor be stored for the next revise to inherit");
  assert.equal(out.failed, "typecheck", "and the stage is named");
  assert.deepEqual(out.repaired, ["/book"], "the model did answer — that is what was compiled and refused");
  assert.equal(out.usage.length, 1);
});

test("repairRound: a refused fix compiles nothing; a throwing send or compile never escapes", async () => {
  const pages = [page("book.tsx")];
  let compiled = 0;
  const refused = await repairRound({
    report: crashedReport(), pages,
    send: async () => reply(pages[0].source.replace("Coffee by the pool.", "Coffee beside the water.")),
    compile: async () => { compiled++; return { ok: true, files: {} }; },
  });
  assert.equal(refused.ran, true);
  assert.equal(refused.built, null);
  assert.equal(refused.failed, "refused");
  assert.equal(compiled, 0, "nothing to compile when every fix was refused");
  assert.equal(refused.usage.length, 1, "the refused call still cost");
  for (const bad of [
    { send: async () => { throw new Error("provider down"); }, compile: async () => ({ ok: true, files: {} }) },
    { send: async () => reply(fixed(pages[0])), compile: async () => { throw new Error("container gone"); } },
  ]) {
    const out = await repairRound({ report: crashedReport(), pages, ...bad });
    assert.equal(out.ran, true);
    assert.equal(out.built, null, "the original build stands");
  }
});

test("repairRoundNote: quiet on a fix that held; a fix there was no time for, or that did not hold, is said with the page", () => {
  assert.equal(repairRoundNote(null), "");
  assert.equal(repairRoundNote({ ran: false, why: "clean" }), "");
  assert.equal(repairRoundNote({ ran: false, why: "no-report" }), "");
  assert.equal(repairRoundNote({ ran: true, built: { files: {} }, repaired: ["/gear"], refused: [] }), "",
    "a page that needed a second pass and got one is our business");
  const time = repairRoundNote({ ran: false, why: "time", routes: ["/gear"] });
  assert.match(time, /\/gear/);
  assert.match(time, /published as it is/);
  assert.match(time, /time/);
  const held = repairRoundNote({ ran: true, built: null, failed: "typecheck", repaired: ["/gear"], refused: [] });
  assert.match(held, /\/gear/);
  assert.match(held, /didn't hold/);
  assert.match(held, /published as it was/);
  const refusedOnly = repairRoundNote({ ran: true, built: null, failed: "refused", repaired: [], refused: [{ route: "/gear", reason: "reworded" }] });
  assert.match(refusedOnly, /\/gear/);
  // A fix that held beside a page that stayed broken names the stuck one.
  const mixed = repairRoundNote({ ran: true, built: { files: {} }, repaired: ["/gear"], refused: [{ route: "/prices", reason: "cannot" }] });
  assert.match(mixed, /\/prices/);
  assert.doesNotMatch(mixed, /\/gear/);
});
