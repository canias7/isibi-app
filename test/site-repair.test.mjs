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
} from "../builder/site-repair.mjs";
import { readPage, SERIOUS } from "../builder/site-render.mjs";
import { tweakRequest, TWEAK_RULES, MAX_TWEAK_CHARS } from "../builder/site-tweak.mjs";

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
