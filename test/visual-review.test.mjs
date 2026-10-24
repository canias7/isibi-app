// The visual review (owner-approved idea #10, 2026-10-22): the build's model
// looks at the render check's screenshots once and fixes what looks wrong.
// Driven with supplied answers only — no model is called here.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  visualReviewOn, reviewRequest, readReview, runVisualReview, shotRoutes,
  REVIEW_TOOL, MAX_EDITS, SHOT_ROUTES, MAX_SHOT_HEIGHT,
} from "../builder/visual-review.mjs";
import { publishPages } from "../builder/publish-pages.mjs";
import { talkBuildStepFacts } from "../builder/site-progress.mjs";

const SPEC = {
  tables: [
    { name: "services", access: "display", columns: [{ name: "name", type: "text" }] },
    { name: "bookings", access: "collect", columns: [{ name: "email", type: "text" }] },
  ],
};
const SRC = `import { createFileRoute } from "@tanstack/react-router";
import { useRows } from "@/lib/rows";
export const Route = createFileRoute("/")({ component: Page });
function Page() { const { data } = useRows("services"); return <div className="p-4 mt-96">{data?.length}</div>; }`;
const PAGE = { path: "index.tsx", source: SRC };
const SHOTS = [
  { route: "/", viewport: "phone", height: 5000, png: "AAAA" },
  { route: "/", viewport: "desktop", height: 1200, png: "BBBB" },
];
const answer = (problems) => ({ content: [{ type: "tool_use", name: REVIEW_TOOL.name, input: { problems } }], usage: { input_tokens: 3000, output_tokens: 200 } });
const FIX = [{ route: "/", problem: "huge gap above the list on phone", edits: [{ old: "mt-96", new: "mt-8" }] }];

/* ------------------------------------------------------------ the switch */

test("VISUAL_REVIEW is ON unless an off word (2026-10-24)", () => {
  assert.equal(visualReviewOn({}), true);
  assert.equal(visualReviewOn(null), true);
  assert.equal(visualReviewOn({ VISUAL_REVIEW: "" }), true);
  assert.equal(visualReviewOn({ VISUAL_REVIEW: ["off"] }), true, "a non-string is not read as a word");
  for (const v of ["1", "true", "on", "yes", " ON "]) assert.equal(visualReviewOn({ VISUAL_REVIEW: v }), true, v);
  for (const v of ["0", "false", "off", "no", " OFF "]) assert.equal(visualReviewOn({ VISUAL_REVIEW: v }), false, v);
});

/* ----------------------------------------------------- the screenshots */

test("the home page and at most two others are screenshotted", () => {
  assert.equal(SHOT_ROUTES, 3);
  assert.deepEqual(shotRoutes(["/menu", "/about", "/", "/visit"]), ["/", "/menu", "/about"]);
  assert.deepEqual(shotRoutes(["/a"]), ["/a"]);
  assert.deepEqual(shotRoutes(null), []);
});

test("render-check captures shots only when asked, capped, before overlays open", () => {
  const src = fs.readFileSync(new URL("../builder/render-check.mjs", import.meta.url), "utf8");
  const shot = src.indexOf("page.screenshot({ type: \"png\", fullPage: true");
  const overlays = src.indexOf("obs.overlays = await openOverlays(page)");
  assert.ok(shot > 0 && overlays > 0, "both landmarks exist");
  assert.ok(shot < overlays, "the screenshot is taken before any overlay is opened");
  assert.ok(src.includes(", MAX_SHOT_HEIGHT))"), "the height is capped");
  assert.match(src, /const shotsOut = Array\.isArray\(opts && opts\.shots\) \? opts\.shots : null;/, "asked for, never defaulted");
  assert.equal(MAX_SHOT_HEIGHT, 4000);
});

test("the container answers shots only when the payload asks", () => {
  const src = fs.readFileSync(new URL("../builder/build-server.mjs", import.meta.url), "utf8");
  assert.match(src, /payload\.shots === true \|\| Array\.isArray\(payload\.shots\) \? \{ shots, \.\.\.\(Array\.isArray\(payload\.shots\) \? \{ shotPrefer: payload\.shots \} : \{\}\) \} : \{\}/);
  assert.match(src, /\.\.\.\(shots\.length \? \{ shots \} : \{\}\)/);
});

/* -------------------------------------------------------- the request */

test("the request: the build's model, both images, the source, the one forced tool", () => {
  const r = reviewRequest({ shots: SHOTS, pages: [PAGE], model: "grok-4.6" });
  assert.deepEqual(r.reviewed, ["/"]);
  const q = r.request;
  assert.equal(q.model, "grok-4.6");
  assert.deepEqual(q.tool_choice, { type: "tool", name: REVIEW_TOOL.name });
  assert.equal(q.tools.length, 1);
  const c = q.messages[0].content;
  const imgs = c.filter((b) => b.type === "image");
  assert.deepEqual(imgs.map((b) => b.source.data), ["AAAA", "BBBB"]);
  assert.ok(imgs.every((b) => b.source.type === "base64" && b.source.media_type === "image/png"));
  assert.ok(c.some((b) => b.type === "text" && b.text.includes(SRC)), "the page source is sent");
  assert.ok(c.some((b) => b.type === "text" && /5000px tall/.test(b.text)), "a cut page says how tall it really is");
  for (const w of ["overlap", "cut off", "contrast", "empty gaps", "far too long", "phone width", "off the screen", "unfinished"]) {
    assert.ok(q.system.includes(w), "the rules name: " + w);
  }
});

test("nothing to look at builds no request", () => {
  assert.equal(reviewRequest({ shots: [], pages: [PAGE] }), null);
  assert.equal(reviewRequest({ shots: SHOTS, pages: [] }), null, "no page for the shot's route");
  assert.equal(reviewRequest({ shots: [{ route: "/", viewport: "phone" }], pages: [PAGE] }), null, "a shot with no image");
});

/* ---------------------------------------------------- reading answers */

test("an empty list is none, and changes nothing", () => {
  const r = readReview(answer([]), { pages: [PAGE], reviewed: ["/"] });
  assert.equal(r.ok, true);
  assert.equal(r.none, true);
  assert.equal(r.pages[0], PAGE);
  assert.deepEqual(r.changed, []);
});

test("a fix is applied to that page", () => {
  const r = readReview(answer(FIX), { pages: [PAGE], reviewed: ["/"] });
  assert.deepEqual(r.changed, ["index.tsx"]);
  assert.equal(r.fixed.length, 1);
  assert.ok(r.pages[0].source.includes("mt-8") && !r.pages[0].source.includes("mt-96"));
});

test("an old string that is not unique refuses the whole problem", () => {
  const dup = { path: "index.tsx", source: SRC + "\n// p-4" };
  const r = readReview(answer([{ route: "/", problem: "x", edits: [{ old: "mt-96", new: "mt-8" }, { old: "p-4", new: "p-2" }] }]), { pages: [dup], reviewed: ["/"] });
  assert.deepEqual(r.changed, []);
  assert.equal(r.refused[0].reason, "old-not-unique");
  assert.equal(r.pages[0], dup, "the page is untouched — the first edit is not kept either");
});

test("an absent old string, an unreviewed route, a malformed answer are refused", () => {
  assert.equal(readReview(answer([{ route: "/", problem: "x", edits: [{ old: "nope", new: "y" }] }]), { pages: [PAGE], reviewed: ["/"] }).refused[0].reason, "old-missing");
  assert.equal(readReview(answer([{ route: "/menu", problem: "x", edits: [{ old: "mt-96", new: "y" }] }]), { pages: [PAGE], reviewed: ["/"] }).refused[0].reason, "not-reviewed");
  assert.equal(readReview(answer([{ route: "/", problem: "x", edits: [{ old: 1, new: "y" }] }]), { pages: [PAGE], reviewed: ["/"] }).refused[0].reason, "malformed");
  const u = readReview({ content: [{ type: "text", text: "looks fine" }] }, { pages: [PAGE], reviewed: ["/"] });
  assert.equal(u.ok, false);
  assert.equal(u.reason, "unreadable");
  assert.equal(u.pages[0], PAGE);
});

test("edits beyond the bound are refused", () => {
  const many = Array.from({ length: MAX_EDITS + 1 }, () => ({ old: "zz", new: "zz" }));
  const r = readReview(answer([{ route: "/", problem: "x", edits: many }]), { pages: [PAGE], reviewed: ["/"] });
  assert.equal(r.refused[0].reason, "too-many-edits");
});

/* ------------------------------------------------------------ the pass */

test("runVisualReview never throws, and keeps the usage when the call was made", async () => {
  const off = await runVisualReview({ shots: SHOTS, pages: [PAGE] });
  assert.equal(off.reason, "off");
  const boom = await runVisualReview({ shots: SHOTS, pages: [PAGE], send: async () => { throw new Error("down"); } });
  assert.equal(boom.reason, "send");
  assert.equal(boom.pages[0], PAGE);
  const ok = await runVisualReview({ shots: SHOTS, pages: [PAGE], model: "grok-4.6", send: async () => answer(FIX) });
  assert.deepEqual(ok.usage, { model: "grok-4.6", in: 3000, out: 200, cacheRead: 0, cacheWrite: 0 });
  assert.deepEqual(ok.changed, ["index.tsx"]);
});

/* ------------------------------------------------- inside publishPages */

function harness(over = {}) {
  const calls = { compile: [], publish: [], stored: [], charges: [], look: [], notes: [] };
  let n = 0;
  const deps = {
    generate: async () => ({ input: { pages: [PAGE], notes: "" }, usage: { in: 1000, out: 1000, cacheRead: 0, cacheWrite: 0 } }),
    compile: async (pages) => { calls.compile.push(pages); return over.compile ? over.compile(n++) : { ok: true, files: { "index.html": { t: "<build-" + n++ + ">" } }, render: { ok: true, findings: [] }, shots: SHOTS }; },
    publish: async (dist, pages) => { calls.publish.push(dist); calls.stored.push(pages); },
    readCredits: async () => 500,
    useCredits: async (k) => { calls.charges.push(k); return k; },
    note: (s, x) => calls.notes.push([s, x || null]),
  };
  if (over.look) { deps.visualReview = (req) => { calls.look.push(req); return over.look(req); }; deps.visualModel = "grok-4.6"; }
  return { deps, calls };
}

test("FLAG OFF (no dep): no call, one compile, nothing reported", async () => {
  const { deps, calls } = harness();
  const out = await publishPages(deps, { spec: SPEC, slug: "s" });
  assert.equal(out.page, "app");
  assert.equal(calls.compile.length, 1);
  assert.equal(out.visualReview, undefined);
  assert.ok(!calls.notes.some(([s]) => s === "looking"));
});

test("a fix is recompiled, and the fixed build and source are what publish and store", async () => {
  const { deps, calls } = harness({ look: async () => answer(FIX) });
  const out = await publishPages(deps, { spec: SPEC, slug: "s" });
  assert.equal(calls.look.length, 1, "one look, no loop");
  assert.equal(calls.look[0].model, "grok-4.6", "the build's model");
  assert.equal(calls.compile.length, 2);
  assert.equal(calls.publish[0]["index.html"].t, "<build-1>");
  assert.ok(calls.stored[0].find((p) => p.path === "index.tsx").source.includes("mt-8"));
  assert.deepEqual(out.visualFixed, ["index.tsx"]);
  assert.ok(calls.notes.some(([s]) => s === "looking"), "the build talks: checking how it looks");
});

test("A FAILED RECOMPILE KEEPS THE ORIGINAL PAGE", async () => {
  const { deps, calls } = harness({
    look: async () => answer(FIX),
    compile: (i) => (i === 0 ? { ok: true, files: { "index.html": { t: "<original>" } }, render: { ok: true, findings: [] }, shots: SHOTS } : { ok: false, stage: "typecheck", error: "broke" }),
  });
  const out = await publishPages(deps, { spec: SPEC, slug: "s" });
  assert.equal(out.page, "app");
  assert.equal(calls.publish[0]["index.html"].t, "<original>");
  assert.equal(calls.stored[0].find((p) => p.path === "index.tsx").source, SRC, "the original source is stored");
  assert.equal(out.visualFixFailed, "typecheck");
  assert.equal(out.visualFixed, undefined);
});

test("none: no recompile, and the look is still charged on the build's one bill", async () => {
  const big = { content: [{ type: "tool_use", input: { problems: [] } }], usage: { input_tokens: 2000000, output_tokens: 0 } };
  const a = await publishPages(harness().deps, { spec: SPEC, slug: "s" });
  const h = harness({ look: async () => big });
  const b = await publishPages(h.deps, { spec: SPEC, slug: "s" });
  assert.equal(h.calls.compile.length, 1, "nothing to fix, no recompile");
  assert.equal(b.visualReview.none, true);
  assert.ok(b.billed > a.billed, `the look's tokens reach the bill (${a.billed} -> ${b.billed})`);
});

test("the progress line says it is checking how it looks", () => {
  const f = talkBuildStepFacts({ s: "looking", shots: 2 });
  assert.equal(f.length, 1);
  assert.match(f[0].text || JSON.stringify(f[0]), /Checking how it looks/);
});

test("the Worker wires it behind the switch, first builds and revises, and the image carries the module", () => {
  const w = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  assert.match(w, /const visualOn = visualReviewOn\(env\);/);
  assert.match(w, /shots: visualOn \|\| undefined,/);
  assert.match(w, /visualReview: visualOn \? /);
  assert.match(w, /visualModel: models\.pages,/);
  const d = fs.readFileSync(new URL("../Dockerfile", import.meta.url), "utf8");
  assert.ok(d.includes("builder/visual-review.mjs"));
});
