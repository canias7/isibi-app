// BUILD CONTENT PRESERVATION (2026-10-08): photos, briefs, clarification
// answers, sections and actions.
//
// The owner: keep the 1-page and 15-component maximums, review every other
// limit on its own, and never keep an arbitrary cut and merely warn
// afterwards — carry what the customer asked for within the real model and
// operational constraints (docs/investigations/build-limits-2026-10-08.md,
// "P3–P5, revised"). Each case drives the real code a customer's words go
// through:
//
//   briefs and answers  the build route (`driveBuild`): whole up to one
//                       message each and one request in all, refused past it
//                       before the deposit or any model — never cut to 5,000
//   first-build message the route the composer posts to (`routeCall`): the
//                       one-message policy, no longer a 2,000 prefix
//   photos              the design answer through the build route: every
//                       requested picture kept, the customer's own attached
//                       photographs all stored — no cut at two
//   sections, actions   `normalizePlan`: every line kept whole; `bandsOf`
//                       writes sections past the band count together in the
//                       last band — the same calls, nothing dropped
//   the two maximums    1 page and 15 components, unchanged
//
// The composer's own changes are driven in a real browser in
// test/build-content-browser.test.mjs.

import test from "node:test";
import assert from "node:assert/strict";
import { driveBuild, GOOD_DESIGN, BRIEF, JPEG_DATA } from "./fixtures/build-route.mjs";
import { loadWorker } from "./fixtures/worker-harness.mjs";
import { withWire, envFor, routeCall, bucket, freshSlug } from "./fixtures/live-ask.mjs";
import { normalizePlan, MAX_SECTIONS, MAX_ACTION, MAX_COMPONENTS, MAX_PAGES } from "../builder/site-plan.mjs";
import { bandsOf, MAX_BANDS } from "../builder/page-bands.mjs";
import { MAX_INPUT_CHARS, MAX_CARRIED_CHARS } from "../builder/input-budget.mjs";

const fill = (n, tail) => ("Harbour Loaf bakes overnight sourdough in Leeds and wants a page people can order from. ".repeat(Math.ceil(n / 80))).slice(0, n - tail.length) + tail;
const body = (extra = {}) => ({ brief: BRIEF, images: [], qa: [], chat: "c", ...extra });

// ── briefs and clarification answers ────────────────────────────────────────

test("a brief past the old 5,000 characters reaches the designer whole, with every answer whole", async () => {
  const END = " — and the last thing: a counter for Saturday collection.";
  const brief = fill(9000, END);
  const ANS = fill(900, " — gluten-free loaves on Fridays only.");
  const r = await driveBuild({ design: { input: GOOD_DESIGN }, body: body({ brief, qa: [{ q: "What do you bake?", a: ANS }] }) });
  assert.ok(r.seen.designer.length, "the designer was never asked: " + JSON.stringify(r.reply).slice(0, 200));
  assert.ok(r.seen.designer[0].includes("Saturday collection"), "the brief's last words were cut before the designer");
  assert.ok(r.seen.designer[0].includes("gluten-free loaves on Fridays only"), "a clarification answer was cut before the designer");
});

test("a brief past one message is refused before the deposit and before any model, with the numbers — never designed from a prefix", async () => {
  const r = await driveBuild({ design: { input: GOOD_DESIGN }, body: body({ brief: fill(MAX_INPUT_CHARS + 1, ".") }) });
  assert.equal(r.status, 422);
  assert.equal(r.reply.error, "brief-too-long");
  assert.equal(r.reply.cost, 0);
  assert.equal(r.reply.chars, MAX_INPUT_CHARS + 1);
  assert.equal(r.reply.max, MAX_INPUT_CHARS);
  assert.deepEqual(r.seen.rpc.filter((x) => x.fn === "credit_debit"), [], "a deposit was taken for a brief that was refused");
  assert.deepEqual(r.seen.tools, [], "a model was asked about a brief that was refused");
});

test("an answer past one message, or a brief and answers past one request in all, is refused the same way", async () => {
  const oneLong = await driveBuild({ design: { input: GOOD_DESIGN }, body: body({ qa: [{ q: "Anything else?", a: fill(MAX_INPUT_CHARS + 1, ".") }] }) });
  assert.equal(oneLong.status, 422);
  assert.equal(oneLong.reply.max, MAX_INPUT_CHARS);
  const each = fill(MAX_INPUT_CHARS - 10, ".");
  const tooMuch = await driveBuild({ design: { input: GOOD_DESIGN }, body: body({ brief: each, qa: [{ q: "a?", a: each }, { q: "b?", a: each }, { q: "c?", a: each }] }) });
  assert.equal(tooMuch.status, 422, "four full messages fitted into one request");
  assert.equal(tooMuch.reply.max, MAX_CARRIED_CHARS);
  assert.deepEqual(tooMuch.seen.tools, []);
  // CONTROL: at the bound, it builds.
  const atBound = await driveBuild({ design: { input: GOOD_DESIGN }, body: body({ brief: fill(MAX_INPUT_CHARS, ".") }) });
  assert.notEqual(atBound.status, 422, "a brief at the bound was refused");
  assert.ok(atBound.seen.tools.includes("design_schema"));
});

test("a first build's message past the old 2,000 is asked about whole; one past one message is refused at no cost", async () => {
  const worker = await loadWorker();
  const END = " — and they asked for a Saturday counter.";
  const LONG = fill(6000, END);
  {
    const slug = freshSlug("fb-long");
    await withWire({ route: { intent: "build" } }, async (seen) => {
      const r = await routeCall(worker, envFor(bucket(slug)), { slug, message: LONG, firstBuild: true, hasSite: false });
      assert.notEqual(r.status, 422, JSON.stringify(r.body).slice(0, 200));
      const told = JSON.stringify(seen.inputs) + JSON.stringify(seen.routerAsked);
      assert.ok(told.includes("Saturday counter"), "a first build's message was cut before the model that asks about it");
    }, { slug });
  }
  {
    const slug = freshSlug("fb-past");
    await withWire({ route: { intent: "build" } }, async (seen) => {
      const r = await routeCall(worker, envFor(bucket(slug)), { slug, message: fill(MAX_INPUT_CHARS + 1, "."), firstBuild: true, hasSite: false });
      assert.equal(r.status, 422);
      assert.equal(r.body.error, "message-too-long");
      assert.equal(r.body.cost, 0);
      assert.deepEqual(seen.calls, [], "a model was asked about a first build past the bound");
      assert.deepEqual(seen.debits, []);
    }, { slug });
  }
});

// ── photos ─────────────────────────────────────────────────────────────────

test("every requested photograph is kept in the plan, and all three of the customer's own attached photos are stored and placed — no cut at two", async () => {
  const design = {
    ...GOOD_DESIGN,
    images: [
      { page: "/", describe: "the shop front", attached: "attachment-1" },
      { page: "/", describe: "the bread counter", attached: "attachment-2" },
      { page: "/", describe: "the bakers at dawn", attached: "attachment-3" },
      { page: "/", describe: "a loaf on a board" },
      { page: "/", describe: "flour in the morning light" },
    ],
  };
  const three = [1, 2, 3].map((n) => ({ name: "photo-" + n + ".jpg", data: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD" + String.fromCharCode(64 + n).repeat(64) }));
  const r = await driveBuild({ design: { input: design }, body: body({ brief: BRIEF + " Put my three photos on the home page.", images: three }) });
  const uploads = [...r.store.keys()].filter((k) => k.startsWith("uploads/harbour-loaf/"));
  assert.equal(uploads.length, 3, "an attached photograph past the second was not stored: " + uploads.join(","));
  const imgs = r.config.look.images;
  assert.equal(imgs.length, 5, "a requested picture was dropped from the plan: " + JSON.stringify(imgs));
  assert.deepEqual(imgs.filter((i) => i.src).map((i) => i.attached), ["attachment-1", "attachment-2", "attachment-3"]);
  assert.deepEqual(r.reply.ownPhotos.placed.map((p) => p.id), ["attachment-1", "attachment-2", "attachment-3"]);
  assert.ok(JPEG_DATA);
});

test("the plan keeps every picture the designer asked for, past the old two", () => {
  const p = normalizePlan({ ...GOOD_DESIGN, images: Array.from({ length: 7 }, (_, i) => ({ page: "/", describe: "picture " + i })) });
  assert.equal(p.images.length, 7, "pictures past two were dropped before anything counted them");
});

// ── sections and actions ───────────────────────────────────────────────────

test("every section and every action is kept whole — past the old 8, 120, 3 and 80 — and the owner's two maximums stand", () => {
  const sec = Array.from({ length: 12 }, (_, i) => "band " + i + ": " + "a hero with the counter photograph, two columns, the order button on the right ".repeat(3).trim());
  const act = Array.from({ length: 5 }, (_, i) => "Order a sourdough loaf for collection on day " + i + " from the counter on the harbour road, paid at the door");
  const p = normalizePlan({ ...GOOD_DESIGN, shape: [{ path: "/", sections: sec }], action: act, components: Array.from({ length: 40 }, (_, i) => "comp-" + i), pages: [{ path: "/", name: "Home" }, { path: "/more", name: "More" }] });
  assert.ok(sec.length > MAX_SECTIONS && sec[0].length > 120 && act.length > MAX_ACTION && act[0].length > 80, "the fixture no longer exceeds the old bounds");
  assert.deepEqual(p.shape[0].sections, sec, "a section was dropped or cut");
  assert.deepEqual(p.action, act, "an action was dropped or cut");
  assert.equal(p.components.length, 15);
  assert.equal(MAX_COMPONENTS, 15);
  assert.equal(p.pages.length, 1);
  assert.equal(MAX_PAGES, 1);
});

test("sections past the band count are written together in the last band — the same number of writers, every section in a brief", () => {
  const sec = Array.from({ length: 12 }, (_, i) => "section number " + i + " with its own words");
  const bands = bandsOf([{ path: "/", sections: sec }], "/");
  assert.equal(bands.length, MAX_BANDS, "more writers were run than the band count");
  for (const s of sec) assert.ok(bands.some((b) => b.includes(s)), "a section reached no writer: " + s);
  assert.deepEqual(bands.slice(0, MAX_BANDS - 1), sec.slice(0, MAX_BANDS - 1));
  // CONTROL: at or under the band count, unchanged.
  assert.deepEqual(bandsOf([{ path: "/", sections: sec.slice(0, 5) }], "/"), sec.slice(0, 5));
  assert.deepEqual(bandsOf([{ path: "/", sections: sec.slice(0, MAX_BANDS) }], "/"), sec.slice(0, MAX_BANDS));
});
