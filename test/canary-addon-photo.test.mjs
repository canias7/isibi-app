// THE ADD-ON WITH A PHOTOGRAPH, PREPARED (2026-10-10, not pressed).
//
// The owner, after Codex closed the dispatch-order correction on run 119:
// *"Prepare executable scenarios that verify the generated image is actually
// placed, existing content survives the Add-on, … progress remains
// model-written, accepted work survives browser closure, and purchases and
// charges occur once."* `lv-addon-photo` is one message on the bakery: a Meet
// the Bakers page with its menu link and one photograph bought for it. These
// cases hold the scenario to that, judge the photograph's checks
// (`photoChecks`) on every way it can go wrong, and drive the press through
// the real canary driver offline.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { UI_SCENARIOS, readUiScenario, blocksPost } from "../scripts/canary-ui.mjs";
import { photoChecks, servedPhotos, photoPath, uploadsOf, newPagePhotoPaths, outcomeChecks, requestBatchVerdict, progressChecks, replyChecks } from "../scripts/canary-requests.mjs";
import { rqApp, part, view, drive, SLUG } from "./fixtures/canary-rq-app.mjs";

const ROOT = new URL("../", import.meta.url).pathname;
const SC = UI_SCENARIOS["lv-addon-photo"];
const WORDS = "Add a Meet the Bakers page with a link in the menu, introducing the three of us who bake through the night, with a photograph of us shaping loaves at the bench.";
const failed = (cs) => cs.filter((c) => !c.ok).map((c) => `${c.name}: ${c.why}`);

test("lv-addon-photo: on the bakery, in request mode, one message word for word — a new page with its menu link and one photograph — its tab closed once progress shows and followed in a fresh session, inside its budget and hard cap", () => {
  assert.ok(SC, "no lv-addon-photo scenario");
  assert.equal(SC.site, SLUG);
  assert.equal(SC.request, true);
  assert.equal(SC.addon, true);
  assert.equal(SC.fundsFirst, true);
  assert.equal(SC.budget, 45);
  assert.equal(SC.cap, 1018);
  assert.equal(SC.steps.length, 1);
  assert.equal(SC.steps[0].say, WORDS);
  assert.equal(SC.steps[0].away, "fresh");
  assert.equal(SC.expect.progress, true);
  assert.deepEqual(JSON.parse(JSON.stringify(SC.expect.pages)), [{ about: ["baker"], photo: { count: 1 } }]);
  assert.deepEqual({ ...SC.expect.menu }, { page: 0 });
  // NO ROW, NO RESTORE: the page and the photograph stay (the demo-site rule).
  assert.equal(SC.row, undefined);
  assert.equal(readUiScenario("lv-addon-photo", SLUG).ok, true);
  assert.equal(readUiScenario("lv-addon-photo", "fretwork-1").ok, false);
  assert.equal(blocksPost("POST", "/api/site/react-build", SC), true, "a build would be let through");
  // FRESH ON THE BAKERY: no other scenario asks for a page about its bakers.
  for (const [k, sc] of Object.entries(UI_SCENARIOS)) {
    if (k === "lv-addon-photo") continue;
    for (const st of sc.steps || []) assert.ok(!/Meet the Bakers|shaping loaves/i.test(st.say || ""), `${k} already asked for this`);
  }
  // THE FORM NAMES IT, with its balance window.
  const wf = fs.readFileSync(ROOT + ".github/workflows/edit-canary.yml", "utf8");
  assert.ok(wf.includes("lv-addon-photo (the Add-on with a photograph on fold-lane-bakery") && wf.includes("between 45 and 1018"), "the scenario box does not describe it");
});

// ── THE PHOTOGRAPH'S CHECKS ──────────────────────────────────────────────────

const PHOTO = "/u/fold-lane-bakery/3f9a0c1e2b4d5a6c7e8f9a0b1c2d3e4f.jpg";
const OLD = "/u/fold-lane-bakery/0a1b2c3d4e5f60718293a4b5c6d7e8f9.jpg";
const page = (route, img) => `import { createFileRoute } from "@tanstack/react-router";\nexport const Route = createFileRoute("${route}")({ component: P });\nfunction P() { return (<main><h1>Meet the bakers</h1><p>Three of us bake through the night.</p>${img ? img.map((s) => `<img src="${s}" alt="The three bakers shaping loaves at the bench" />`).join("") : ""}</main>); }\n`;
const served = (imgs) => `<html><head><meta property="og:image" content="https://fold-lane-bakery.gofarther.app${OLD}"></head><body><main><h1>Meet the bakers</h1>${imgs.map(([s, a]) => `<img src="https://fold-lane-bakery.gofarther.app${s}"${a === null ? "" : ` alt="${a}"`}>`).join("")}</main></body></html>`;
const files = (...names) => ({ ok: true, files: names.map((n) => ({ name: n, kind: /\.(jpe?g|png|webp)$/.test(n) ? "image" : "doc" })) });
const OLD_NAME = OLD.split("/").pop(), NEW_NAME = PHOTO.split("/").pop();
const good = () => ({
  found: { want: { about: ["baker"], photo: { count: 1 } }, route: "/meet-the-bakers", path: "src/routes/meet-the-bakers.tsx" },
  after: new Map([["src/routes/meet-the-bakers.tsx", page("/meet-the-bakers", [PHOTO])]]),
  served: { "/meet-the-bakers": served([[PHOTO, "The three bakers shaping loaves at the bench"]]) },
  photos: {
    uploads: { before: files(OLD_NAME, "menu.pdf"), after: files(OLD_NAME, "menu.pdf", NEW_NAME) },
    bytes: { [PHOTO]: { status: 200, type: "image/jpeg", bytes: 184_233 } },
  },
  slug: SLUG,
});

test("THE PHOTOGRAPH, BOUGHT AND PLACED: one on the new page's stored file, drawn with words describing it, its address serving an image, and the uploads gaining exactly it — every check passes", () => {
  const cs = photoChecks(good());
  assert.equal(cs.length, 4);
  assert.deepEqual(failed(cs), []);
});

test("THE PHOTOGRAPH'S FAILURES, each caught by its own check and no other: none placed, two placed, drawn without words, a dead address, a picture taken from the site's earlier ones, a second purchase stored, and uploads that could not be read", () => {
  const only = (over, re) => {
    const cs = photoChecks({ ...good(), ...over });
    const f = failed(cs);
    assert.ok(f.length >= 1, `nothing failed for ${re}`);
    assert.ok(f.some((x) => re.test(x)), `${re} did not fail: ${JSON.stringify(f)}`);
    return f;
  };
  // NO PHOTOGRAPH PLACED: the page was added without it.
  only({ after: new Map([["src/routes/meet-the-bakers.tsx", page("/meet-the-bakers", [])]]) }, /stored page shows exactly 1/);
  // TWO PLACED where one was asked for.
  only({ after: new Map([["src/routes/meet-the-bakers.tsx", page("/meet-the-bakers", [PHOTO, OLD])]]) }, /stored page shows exactly 1/);
  // DRAWN WITHOUT WORDS describing it, or not drawn at all.
  only({ served: { "/meet-the-bakers": served([[PHOTO, null]]) } }, /draws it with words/);
  only({ served: { "/meet-the-bakers": served([[PHOTO, ""]]) } }, /draws it with words/);
  only({ served: { "/meet-the-bakers": served([]) } }, /draws it with words/);
  // ITS ADDRESS DOES NOT SERVE AN IMAGE.
  for (const b of [{ status: 404, type: "text/html", bytes: 9 }, { status: 200, type: "text/html", bytes: 5000 }, { status: 200, type: "image/jpeg", bytes: 120 }, undefined]) {
    only({ photos: { ...good().photos, bytes: b ? { [PHOTO]: b } : {} } }, /address serves an image/);
  }
  // TAKEN FROM THE SITE'S EARLIER PICTURES: the page shows an old upload and nothing was bought.
  only({
    after: new Map([["src/routes/meet-the-bakers.tsx", page("/meet-the-bakers", [OLD])]]),
    served: { "/meet-the-bakers": served([[OLD, "Bread"]]) },
    photos: { uploads: { before: files(OLD_NAME), after: files(OLD_NAME) }, bytes: { [OLD]: { status: 200, type: "image/jpeg", bytes: 90_000 } } },
  }, /gained exactly 1 new image/);
  // BOUGHT TWICE: a second new image stored beside the one placed.
  only({ photos: { ...good().photos, uploads: { before: files(OLD_NAME), after: files(OLD_NAME, NEW_NAME, "9" + NEW_NAME.slice(1)) } } }, /gained exactly 1 new image/);
  // THE ONE BOUGHT IS NOT THE ONE PLACED.
  only({ photos: { ...good().photos, uploads: { before: files(OLD_NAME), after: files(OLD_NAME, "9" + NEW_NAME.slice(1)) } } }, /gained exactly 1 new image/);
  // A NEW DOCUMENT IS NOT A PHOTOGRAPH.
  only({ photos: { ...good().photos, uploads: { before: files(OLD_NAME), after: files(OLD_NAME, "notes.pdf") } } }, /gained exactly 1 new image/);
  // CANNOT-TELL NEVER READS AS A PASS.
  for (const u of [{ before: { ok: false, why: "status 503" }, after: files(NEW_NAME) }, { before: files(), after: null }, null]) {
    only({ photos: { ...good().photos, uploads: u } }, /uploads were read before and after/);
  }
  // THE NEW PAGE'S FILE WAS NOT READ.
  only({ after: new Map() }, /stored file was not read/);
});

test("THE READERS: a photograph's address read from any origin, a served page's photographs with their words (the link preview not counted), the owner's upload list strictly, and the addresses to read the bytes of — only the pages the press added", () => {
  assert.equal(photoPath(`https://fold-lane-bakery.gofarther.app${PHOTO}?v=2`, SLUG), PHOTO);
  assert.equal(photoPath(PHOTO, SLUG), PHOTO);
  assert.equal(photoPath("/u/other-site/x.jpg", SLUG), "");
  assert.equal(photoPath(["/u/fold-lane-bakery/x.jpg"], SLUG), "", "a non-string was coerced");
  assert.deepEqual(servedPhotos(served([[PHOTO, "Bakers &amp; loaves"], [OLD, null]]), SLUG), [{ path: PHOTO, alt: "Bakers & loaves" }, { path: OLD, alt: "" }]);
  assert.deepEqual(uploadsOf({ status: 200, json: { files: [{ name: "a.jpg", kind: "image" }, { name: "b.pdf", kind: "doc" }, { kind: "image" }] } }), { ok: true, files: [{ name: "a.jpg", kind: "image" }, { name: "b.pdf", kind: "doc" }] });
  assert.equal(uploadsOf({ status: 401, json: {} }).ok, false);
  assert.equal(uploadsOf({ status: 200, json: {} }).ok, false);
  assert.equal(uploadsOf(null).ok, false);
  const before = { source: { pages: [{ path: "src/routes/index.tsx", source: page("/", [OLD]) }] }, render: { "/": {} } };
  const after = { source: { pages: [...before.source.pages, { path: "src/routes/meet-the-bakers.tsx", source: page("/meet-the-bakers", [PHOTO]) }] }, render: { "/": {}, "/meet-the-bakers": {} } };
  assert.deepEqual(newPagePhotoPaths({ before, after, served: { "/": served([[OLD, "x"]]), "/meet-the-bakers": served([[PHOTO, "x"]]) }, slug: SLUG }), [PHOTO]);
});

test("THE PRESS'S VERDICT CARRIES THEM: through outcomeChecks and requestBatchVerdict, a new page that asks for a photograph is judged on it beside everything else; a page that asks for none gets no photograph checks", () => {
  const home = page("/", [OLD]);
  const before = { complete: true, source: { pages: [{ path: "src/routes/index.tsx", source: home }], parts: [] }, render: { "/": { status: 200, headings: [] } }, stored: { ok: true, description: "d" } };
  const after = { complete: true, source: { pages: [{ path: "src/routes/index.tsx", source: home }, { path: "src/routes/meet-the-bakers.tsx", source: page("/meet-the-bakers", [PHOTO]) }], parts: [] }, render: { "/": { status: 200, headings: [] }, "/meet-the-bakers": { status: 200, headings: [] } }, stored: { ok: true, description: "d" } };
  const sv = { "/": served([[OLD, "Bread"]]), "/meet-the-bakers": served([[PHOTO, "The three bakers shaping loaves"]]).replace("<h1>", "<h1>Meet the bakers ") };
  const spec = { expect: { pages: [{ about: ["baker"], photo: { count: 1 } }] } };
  const o = outcomeChecks({ spec, before, after, served: sv, beforeServed: { "/": sv["/"] }, tables: {}, slug: SLUG, photos: good().photos });
  const photoNames = o.checks.filter((c) => /photograph|draws it with words|serves an image|uploads/.test(c.name));
  assert.equal(photoNames.length, 4, JSON.stringify(o.checks.map((c) => c.name)));
  assert.deepEqual(failed(photoNames), []);
  assert.ok(o.checks.some((c) => /every stored page is byte for byte/.test(c.name) && c.ok), "the existing pages were not held byte for byte");
  // THROUGH THE PRESS'S VERDICT, the same four.
  const v = requestBatchVerdict({ spec: { ...spec, steps: [] }, steps: [], before, after, served: sv, beforeServed: { "/": sv["/"] }, tables: {}, slug: SLUG, photos: good().photos });
  const through = v.checks.filter((c) => /photograph|draws it with words|serves an image|uploads/.test(c.name));
  assert.equal(through.length, 4);
  assert.deepEqual(failed(through), [], "the press's readings did not reach the photograph's checks");
  // NO PHOTOGRAPH ASKED FOR, NONE JUDGED.
  const none = outcomeChecks({ spec: { expect: { pages: [{ about: ["baker"] }] } }, before, after, served: sv, beforeServed: { "/": sv["/"] }, tables: {}, slug: SLUG });
  assert.equal(none.checks.filter((c) => /serves an image|uploads gained/.test(c.name)).length, 0);
  // AN EXISTING PAGE THAT CHANGED is still caught beside a passing photograph.
  const moved = { ...after, source: { ...after.source, pages: [{ path: "src/routes/index.tsx", source: home.replace("Three of us", "Two of us") }, after.source.pages[1]] } };
  const om = outcomeChecks({ spec, before, after: moved, served: sv, beforeServed: { "/": sv["/"] }, tables: {}, slug: SLUG, photos: good().photos });
  assert.ok(om.checks.some((c) => /every stored page is byte for byte/.test(c.name) && !c.ok), "a changed existing page passed");
});

test("THE PRESS'S READINGS, IN ORDER: the uploads are read before the message is sent, and after it the uploads again and the bytes at each photograph the new pages show, handed to the verdict", () => {
  const src = fs.readFileSync(ROOT + "scripts/edit-canary.mjs", "utf8");
  const at = (s) => { const i = src.indexOf(s); assert.ok(i >= 0, `landmark missing: ${s}`); return i; };
  const before = at("const uploadsBefore = PHOTO_PAGES ? uploadsOf(await call(\"GET\", `/api/site/${encodeURIComponent(CANARY)}/uploads`))");
  const send = at("const ui = await runUi({");
  const bytes = at("for (const path of newPagePhotoPaths({ before: BEFORE, after, served, slug: CANARY }))");
  const afterUp = at("photos = { uploads: { before: uploadsBefore, after: uploadsOf(await call(\"GET\", `/api/site/${encodeURIComponent(CANARY)}/uploads`)) }, bytes };");
  const verdict = at("frameLoads: ui.frameLoads || [], photos,");
  assert.ok(before < send && send < bytes && bytes < afterUp && afterUp < verdict, "the readings are out of order");
});

// ── THE PRESS, DRIVEN OFFLINE THROUGH THE REAL CANARY DRIVER ─────────────────

const KEY = "lvphot" + "0".repeat(17) + "1";
const SAID = { planned: "I'll add a Meet the Bakers page.", doing: "I'm adding your Meet the Bakers page now.", waiting: "I need an answer before I add the page.", unconfirmed: "I tried to add the page, but can't tell yet whether it went through.", done: "I've added your Meet the Bakers page.", partial: "I've added part of the page.", notdone: "I couldn't add the page." };
const L1 = "I've worked out the Meet the Bakers page, and I'm having the photograph of you at the bench made.";
const L2 = "The photograph is ready and on the page; I'm putting the page on your site.";
const run = (lines, state = "started", extra = {}) => view(KEY, [part(0, "Add a Meet the Bakers page …", state, { route: "addon", ids: ["b1"], said: SAID, ...(lines.length ? { progress: lines } : {}), ...extra })], state === "done" ? { ended: true } : {});
const VIEWS = [run([]), run([]), run([{ n: 0, ms: 4000, text: L1 }]), run([{ n: 0, ms: 4000, text: L1 }, { n: 1, ms: 80000, text: L2 }]), run([{ n: 0, ms: 4000, text: L1 }, { n: 1, ms: 80000, text: L2 }], "done", { jobs: ["b1"] })];
const FRESH = { access_token: "fresh-token", refresh_token: "fresh-r", expires_at: 2_000_000_000, user: { id: "22175f41-6fbf-49d7-b039-a65078a0141c" } };
const app = () => rqApp({
  progress: true, fresh: true,
  replies: { b1: { ok: true, msg: "✅ Done.", reply: "I've added a Meet the Bakers page with a photograph of the three of you at the bench, and a link to it in the menu.", replySource: "model" } },
  send: () => ({ request: { key: KEY, views: VIEWS }, route: { intent: "addon" } }),
});
const listed = (h) => async () => { const r = await h.requestsNow(); return { ...r, json: { ...r.json, jobs: [] } }; };

test("END TO END, OFFLINE: the message is sent once; its first progress line is read in the sending tab while it runs; that tab is closed; a fresh session signed in afresh follows it to its end; the model's lines and reply are what the customer is shown — and every progress and reply check passes", async () => {
  const h = app();
  const rec = await drive(h, SC, { requestsNow: listed(h), freshSession: async () => FRESH, balanceNow: async () => 990, firstLineMs: 2_000, freshAwayMs: 5, stepMs: 4_000, stepCapMs: 4_000 });
  assert.equal(rec.stopped, null, JSON.stringify(rec.stopped));
  assert.equal(rec.sent, 1);
  const s = rec.steps[0];
  assert.equal(s.mode, "fresh");
  assert.equal(s.fresh.first.line, L1);
  assert.equal(s.fresh.closedRunning, true);
  assert.equal(h.tabs[0].closed, true, "the sending tab was not closed");
  assert.equal(s.fresh.reopened.newSession, true);
  assert.equal(s.fresh.reopened.sameAccount, true);
  assert.deepEqual(failed(progressChecks({ steps: rec.steps })), []);
  assert.deepEqual(failed(replyChecks(rec.steps)), []);
  assert.equal(h.calls.filter((c) => /click #stSend/.test(c)).length, 1, "the message was not sent exactly once");
});

test("THE PREFLIGHT: below the budget of 45 or above the hard cap of 1018, the message is typed and not sent — no routing call, nothing charged", async () => {
  for (const [bal, re] of [[44, /does not cover this press's budget of 45/], [1019, /above this press's hard cap of 1018/]]) {
    const h = app();
    const rec = await drive(h, SC, { requestsNow: listed(h), freshSession: async () => FRESH, balanceNow: async () => bal });
    assert.equal(rec.sent, 0);
    assert.match(rec.stopped.msg, re);
    assert.ok(!h.calls.some((c) => /click #stSend/.test(c)), "the message was sent");
  }
});
