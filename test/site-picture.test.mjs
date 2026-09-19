// The `picture` layer — change a photograph on a page that already exists.
//
// The property under test throughout: a photograph is put in the slot somebody
// MEANT, and nowhere else. Every guard below exists because the alternative is a
// picture of the wrong thing on a real business's home page, which is worse than
// the change not happening.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  PICTURE_MODEL, PICTURE_TOOL, MAX_SLOTS, MAX_PICTURE_OPS, MAX_DESCRIBE,
  imageSlots, isEmptySlot, pictureDigest, pictureRequest, readPictures,
  applyPictures, pictureReply, pictureUsage, runPictureEdit, readNeedsPlace, newEmptySlots,
  listFrames, newListFrames, MAX_LIST_FRAMES, codeOnly,
} from "../builder/site-picture.mjs";

const HOME = {
  path: "index.tsx",
  source:
    'import { SafeImage } from "@/components/ui/safe-image";\n' +
    '<SafeImage src={null} alt="The row of chairs, Saturday morning" ratio="4/3" />\n' +
    '<SafeImage src="https://gofarther.dev/u/s/old.jpg" alt="Shopfront at dusk" ratio="1/1" />\n' +
    '{LIST.map((s) => <SafeImage key={s.a} src={null} alt={s.alt} ratio="1/1" />)}\n' +
    '<img src="" alt="The team" />\n',
};
const WORK = { path: "work.tsx", source: '<SafeImage src={null} alt="Shopfront at dusk" ratio="1/1" />\n' };
const PAGES = [HOME, WORK];
const LIB = [{ name: "shop-front.jpg", url: "https://gofarther.dev/u/s/shop-front.jpg" }];

const said = (pictures) => ({ content: [{ type: "tool_use", name: "choose_pictures", input: { pictures } }] });
const slotFor = (page, alt) => imageSlots(PAGES).find((s) => s.page === page && s.alt === alt);

// ── finding the slots ───────────────────────────────────────────────────────

test("every picture with a literal description is found, on both tags", () => {
  const s = imageSlots([HOME]);
  assert.deepEqual(s.map((x) => x.alt),
    ["The row of chairs, Saturday morning", "Shopfront at dusk", "The team"]);
  assert.deepEqual(s.map((x) => x.tag), ["SafeImage", "SafeImage", "img"]);
});

test("A MAPPED PICTURE IS SKIPPED — one element rendering many is not one slot", () => {
  // `<SafeImage alt={s.alt} />` inside a map has no single span to replace and
  // no sentence to match against. Changing it means changing the data it maps
  // over, which is a page edit; half-doing it here is the failure.
  assert.ok(!imageSlots([HOME]).some((s) => /\{/.test(s.alt)));
  assert.equal(imageSlots([HOME]).length, 3, "the mapped one is the fourth SafeImage in the file");
});

test("an empty slot is told apart from a filled one", () => {
  const s = imageSlots([HOME]);
  assert.equal(isEmptySlot(s[0]), true, "src={null}");
  assert.equal(isEmptySlot(s[1]), false, "a real URL");
  assert.equal(isEmptySlot(s[2]), true, 'src=""');
});

test("a `>` inside the description does not end the element early", () => {
  const s = imageSlots([{ path: "p.tsx", source: '<SafeImage src={null} alt="Before > after" ratio="1/1" />' }]);
  assert.equal(s.length, 1);
  assert.equal(s[0].alt, "Before > after");
});

test("a picture with no description at all is not addressable", () => {
  assert.deepEqual(imageSlots([{ path: "p.tsx", source: '<SafeImage src={null} ratio="1/1" />' }]), []);
});

test("a picture bound to an expression is recorded as one rather than skipped", () => {
  const s = imageSlots([{ path: "p.tsx", source: '<SafeImage src={row.photo} alt="A dish" />' }]);
  assert.equal(s.length, 1);
  assert.equal(s[0].expr, true);
  assert.equal(isEmptySlot(s[0]), false, "it is bound to something, so it is not an empty slot");
});

test("the scan is bounded, and stops rather than returning a contact sheet", () => {
  const many = { path: "p.tsx", source: Array.from({ length: MAX_SLOTS + 20 }, (_, i) => `<SafeImage src={null} alt="p${i}" />`).join("\n") };
  assert.equal(imageSlots([many]).length, MAX_SLOTS);
});

test("a page with no source is skipped rather than throwing", () => {
  assert.deepEqual(imageSlots([null, { path: "x" }, "y"]), []);
});

// ── what the model is shown and may ask for ─────────────────────────────────

test("the digest names the page, the description, and which slots are empty", () => {
  const d = pictureDigest(imageSlots(PAGES), LIB);
  assert.match(d, /PAGE index\.tsx/);
  assert.match(d, /"The row of chairs, Saturday morning"\s+\(empty/);
  assert.ok(!/"Shopfront at dusk"\s+\(empty/.test(d.split("PAGE work.tsx")[0]), "a filled slot is not called empty");
  assert.match(d, /shop-front\.jpg/);
});

test("a site with no uploads says so rather than showing an empty heading", () => {
  assert.match(pictureDigest(imageSlots(PAGES), []), /UPLOADED\n {2}\(none yet\)/);
});

test("THE TOOL PREFERS THE OWNER'S OWN PHOTOGRAPH, and says why", () => {
  const p = PICTURE_TOOL.input_schema.properties.pictures.items.properties;
  assert.match(p.file.description, /PREFER THIS/);
  assert.match(p.describe.description, /costs the owner real money/i);
  assert.match(PICTURE_TOOL.input_schema.properties.pictures.description, /EMPTY ARRAY/);
});

test("the request forces the tool and carries the instruction", () => {
  const r = pictureRequest({ instruction: "use my shop photo for the chairs", slots: imageSlots(PAGES), library: LIB });
  assert.equal(r.model, PICTURE_MODEL);
  assert.deepEqual(r.tool_choice, { type: "tool", name: "choose_pictures" });
  assert.match(r.messages[0].content, /use my shop photo/);
});

// ── reading the answer ──────────────────────────────────────────────────────

test("A SLOT IS MATCHED ON PAGE AND DESCRIPTION, never description alone", () => {
  // Both pages carry "Shopfront at dusk". Matching on the alt alone would change
  // whichever the scan found first — on a page nobody mentioned.
  const got = readPictures(said([{ page: "work.tsx", alt: "Shopfront at dusk", file: "shop-front.jpg" }]), imageSlots(PAGES), LIB);
  assert.equal(got.length, 1);
  assert.equal(got[0].slot.page, "work.tsx");
});

test("a description the site does not have is dropped", () => {
  assert.deepEqual(readPictures(said([{ page: "index.tsx", alt: "A picture nobody wrote", file: "shop-front.jpg" }]), imageSlots(PAGES), LIB), []);
});

test("AN UPLOADED FILE MUST BE ONE THE OWNER REALLY HAS", () => {
  // An invented name becomes a URL under their own uploads prefix, which
  // publishes a broken image — the one outcome SafeImage cannot draw around.
  const got = readPictures(said([{ page: "index.tsx", alt: "The team", file: "not-a-file.jpg" }]), imageSlots(PAGES), LIB);
  assert.deepEqual(got, [], "with no description either, there is nothing to do");
});

test("a made picture needs a description, and an empty one is not sent", () => {
  const ok = readPictures(said([{ page: "index.tsx", alt: "The team", describe: "the four of us outside the shop" }]), imageSlots(PAGES), LIB);
  assert.equal(ok[0].describe, "the four of us outside the shop");
  const empty = readPictures(said([{ page: "index.tsx", alt: "The team", describe: "   " }]), imageSlots(PAGES), LIB);
  assert.deepEqual(empty, [], "$0.15 to find out what an image model does with no prompt");
});

test("a description is clipped rather than sent whole", () => {
  const got = readPictures(said([{ page: "index.tsx", alt: "The team", describe: "x".repeat(MAX_DESCRIBE + 200) }]), imageSlots(PAGES), LIB);
  assert.equal(got[0].describe.length, MAX_DESCRIBE);
});

test("clearing a picture is expressible and beats a description", () => {
  const got = readPictures(said([{ page: "index.tsx", alt: "The team", clear: true, describe: "something" }]), imageSlots(PAGES), LIB);
  assert.equal(got[0].clear, true);
  assert.equal(got[0].describe, undefined);
});

test("the same slot twice is one change", () => {
  const got = readPictures(said([
    { page: "index.tsx", alt: "The team", file: "shop-front.jpg" },
    { page: "index.tsx", alt: "The team", describe: "something else" },
  ]), imageSlots(PAGES), LIB);
  assert.equal(got.length, 1);
});

test("more changes than the cap are cut, not the whole batch dropped", () => {
  const many = { path: "p.tsx", source: Array.from({ length: MAX_PICTURE_OPS + 4 }, (_, i) => `<SafeImage src={null} alt="p${i}" />`).join("\n") };
  const slots = imageSlots([many]);
  const got = readPictures(said(slots.map((s) => ({ page: s.page, alt: s.alt, describe: "x" }))), slots, []);
  assert.equal(got.length, MAX_PICTURE_OPS);
});

test("no tool call reads as no changes, never as a throw", () => {
  assert.deepEqual(readPictures({ content: [{ type: "text", text: "ok" }] }, imageSlots(PAGES), LIB), []);
  assert.deepEqual(readPictures(null, imageSlots(PAGES), LIB), []);
});

// ── the swap ────────────────────────────────────────────────────────────────

test("an empty expression slot becomes a real quoted src", () => {
  const { pages } = applyPictures(PAGES, [{ slot: slotFor("index.tsx", "The row of chairs, Saturday morning"), url: "https://x/a.jpg" }]);
  assert.match(pages[0].source, /<SafeImage src="https:\/\/x\/a\.jpg" alt="The row of chairs/);
  assert.ok(!/src=\{/.test(pages[0].source.split("\n")[1]), "src={https://…} is not valid TSX");
});

test("a filled slot is replaced in place", () => {
  const { pages } = applyPictures(PAGES, [{ slot: slotFor("index.tsx", "Shopfront at dusk"), url: "https://x/b.jpg" }]);
  assert.match(pages[0].source, /src="https:\/\/x\/b\.jpg" alt="Shopfront at dusk"/);
  assert.ok(!pages[0].source.includes("old.jpg"));
});

test("TWO CHANGES ON ONE PAGE BOTH LAND — applied back to front", () => {
  // Each replacement changes the file's length, so applied in order the second
  // offset lands wherever the text has moved to, silently, mid-attribute.
  const { pages, changed } = applyPictures(PAGES, [
    { slot: slotFor("index.tsx", "The row of chairs, Saturday morning"), url: "https://x/one.jpg" },
    { slot: slotFor("index.tsx", "The team"), url: "https://x/two.jpg" },
  ]);
  assert.match(pages[0].source, /src="https:\/\/x\/one\.jpg" alt="The row of chairs/);
  assert.match(pages[0].source, /<img src="https:\/\/x\/two\.jpg" alt="The team"/);
  assert.deepEqual(changed, ["index.tsx"]);
});

test("a page nobody changed comes back byte-identical", () => {
  const { pages } = applyPictures(PAGES, [{ slot: slotFor("index.tsx", "The team"), url: "https://x/a.jpg" }]);
  assert.equal(pages.find((p) => p.path === "work.tsx").source, WORK.source);
});

test("the swap does not mutate the pages it was handed", () => {
  const before = HOME.source;
  applyPictures(PAGES, [{ slot: slotFor("index.tsx", "The team"), url: "https://x/a.jpg" }]);
  assert.equal(HOME.source, before);
});

test("a URL carrying a quote cannot break out of the attribute", () => {
  const { pages } = applyPictures(PAGES, [{ slot: slotFor("index.tsx", "The team"), url: 'a" onError="alert(1)' }]);
  assert.ok(!/onError="alert/.test(pages[0].source.replace(/\\"/g, "")), "the value is JSON-encoded, so a quote is escaped");
});

test("clearing writes an empty src rather than removing the attribute", () => {
  const { pages } = applyPictures(PAGES, [{ slot: slotFor("index.tsx", "Shopfront at dusk"), url: "" }]);
  assert.match(pages[0].source, /src="" alt="Shopfront at dusk"/);
});

// ── the reply ───────────────────────────────────────────────────────────────

test("the reply names the picture, because the owner cannot see a src", () => {
  const msg = pictureReply({ used: [{ slot: { alt: "Shopfront at dusk" } }] });
  assert.match(msg, /Shopfront at dusk/);
  assert.match(msg, /your own photograph/);
});

test("A PICTURE THAT COULD NOT BE MADE IS SAID OUT LOUD", () => {
  // An unchanged slot looks identical to one nobody asked about, and the owner
  // has to know before they go looking for the change.
  const msg = pictureReply({ used: [{ slot: { alt: "A" } }], failed: 2 });
  assert.match(msg, /2 pictures couldn't be made/);
  assert.match(msg, /unchanged/);
});

test("nothing matched says so without a tick", () => {
  const msg = pictureReply({});
  assert.ok(!msg.includes("✅"));
  assert.match(msg, /couldn't match/);
});

// ── the whole layer ─────────────────────────────────────────────────────────

const fake = (pictures, { library = LIB, generate } = {}) => {
  const seen = { generated: [] };
  const deps = {
    send: async () => ({ ...said(pictures), usage: { input_tokens: 800, output_tokens: 40 } }),
    library: async () => library,
    ...(generate === undefined ? {} : { generate: async (d) => { seen.generated.push(d); return generate; } }),
  };
  return { deps, seen };
};

test("the owner's own photograph goes on, with no image model involved at all", async () => {
  const { deps } = fake([{ page: "index.tsx", alt: "The team", file: "shop-front.jpg" }]);
  const r = await runPictureEdit(deps, { instruction: "use my shop photo for the team picture", pages: PAGES });
  assert.equal(r.ok, true);
  assert.equal(r.used.length, 1);
  assert.equal(r.made.length, 0);
  assert.equal(deps.generate, undefined, "the free path must not need a generator to exist");
  assert.match(r.pages.find((p) => p.path === "index.tsx").source, /src="https:\/\/gofarther\.dev\/u\/s\/shop-front\.jpg" alt="The team"/);
});

test("a made picture is generated and swapped in", async () => {
  const { deps, seen } = fake([{ page: "index.tsx", alt: "The team", describe: "the four of us outside" }], { generate: "https://x/new.jpg" });
  const r = await runPictureEdit(deps, { instruction: "make a picture of the team", pages: PAGES });
  assert.equal(r.ok, true);
  assert.deepEqual(seen.generated, ["the four of us outside"]);
  assert.equal(r.made.length, 1);
});

test("A PICTURE THAT CANNOT BE MADE LEAVES ITS SLOT AND THE OTHERS STILL CHANGE", async () => {
  // Refusing the whole batch means an owner who asked for one uploaded
  // photograph and one made one gets neither.
  const { deps } = fake([
    { page: "index.tsx", alt: "The team", file: "shop-front.jpg" },
    { page: "work.tsx", alt: "Shopfront at dusk", describe: "the front at dusk" },
  ], { generate: null });
  const r = await runPictureEdit(deps, { instruction: "both please", pages: PAGES });
  assert.equal(r.ok, true);
  assert.equal(r.used.length, 1);
  assert.equal(r.failed, 1);
  assert.match(r.msg, /couldn't be made/);
});

test("with no generator at all, a described picture fails softly and says so", async () => {
  const { deps } = fake([{ page: "index.tsx", alt: "The team", describe: "anything" }]);
  const r = await runPictureEdit(deps, { instruction: "make one", pages: PAGES });
  assert.equal(r.ok, false);
  assert.equal(r.reason, "nothing-made");
  assert.equal(r.failed, 1);
  assert.match(r.msg, /couldn't be made/);
});

test("a site with no picture slots escalates — a page change really might be meant", async () => {
  const { deps, seen } = fake([]);
  const r = await runPictureEdit(deps, { instruction: "change the photo", pages: [{ path: "p.tsx", source: "no pictures here" }] });
  assert.equal(r.escalate, true);
  assert.equal(r.reason, "no-slots");
  assert.equal(seen.generated.length, 0);
});

test("a model that matched no slot does NOT escalate — the rungs above cannot swap a photo either", async () => {
  const { deps } = fake([]);
  const r = await runPictureEdit(deps, { instruction: "make it blue", pages: PAGES });
  assert.equal(r.ok, false);
  assert.equal(r.escalate, false);
  assert.equal(r.reason, "no-match");
  assert.ok(String(r.msg || "").trim().length > 0, "the customer is told something");
});

test("an unreadable upload library is not a failure — the site still has slots", async () => {
  const deps = {
    send: async () => ({ ...said([{ page: "index.tsx", alt: "The team", describe: "x" }]), usage: {} }),
    library: async () => { throw new Error("R2 down"); },
    generate: async () => "https://x/a.jpg",
  };
  const r = await runPictureEdit(deps, { instruction: "make one", pages: PAGES });
  assert.equal(r.ok, true);
});

test("a send that throws does not escalate", async () => {
  const r = await runPictureEdit({ send: async () => { throw new Error("503"); }, library: async () => [] },
    { instruction: "x", pages: PAGES });
  assert.equal(r.escalate, false);
  assert.equal(r.reason, "send");
});

test("usage is the four token kinds, priced from the one table", () => {
  const u = pictureUsage({ usage: { input_tokens: 1, output_tokens: 2, cache_read_input_tokens: 3, cache_creation_input_tokens: 4 } });
  assert.deepEqual(u, { in: 1, out: 2, cacheRead: 3, cacheWrite: 4, model: PICTURE_MODEL });
});

// ── the layer's own definition ──────────────────────────────────────────────

test("THE LAYER CANNOT REACH THE SCHEMA OR THE PAGE GENERATOR", () => {
  const src = fs.readFileSync(new URL("../builder/site-picture.mjs", import.meta.url), "utf8");
  for (const forbidden of ["applySiteSchema", "seedSiteRows", "generateSitePages", "pagesRequest"]) {
    assert.ok(!src.includes(forbidden), "the picture layer must not be able to reach " + forbidden);
  }
});

// ── the gaps a mutation sweep found ─────────────────────────────────────────

test("a `>` inside a BRACED expression does not end the element early either", () => {
  // The quote check catches `alt="a > b"`; this is the other half — a comparison
  // inside a JSX expression attribute, which a depth-blind scan reads as the end
  // of the tag and then finds no `alt` at all.
  const s = imageSlots([{ path: "p.tsx", source: '<SafeImage src={null} ratio={w > h ? "4/3" : "1/1"} alt="A wide one" />' }]);
  assert.equal(s.length, 1, "the scan stopped inside the braces and lost the description");
  assert.equal(s[0].alt, "A wide one");
});

test("THE PICTURE BRANCH PUBLISHES, and prices a made picture before making it", () => {
  // Neither is visible to a unit test: `worker.js` cannot be imported, so a
  // branch that swaps the source and never publishes reports success while the
  // live site is unchanged, and one that skips the affordability check calls a
  // paid image model on an empty balance.
  const w = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const from = w.indexOf('if (eLayer === "picture") {');
  assert.ok(from > 0, "the picture branch is gone or moved");
  const rest = [...w.matchAll(/if \(eLayer === "[a-z]+"\) \{/g)].map((m) => m.index).filter((i) => i > from);
  const block = w.slice(from, rest.length ? rest[0] : from + 6000);
  // `publishStep` since 2026-08-29 — the edit route's branches hand their pages
  // to a deferring wrapper so the spine runs ONCE per message (owner: "if the
  // act was 2 things then 1 publish"). The property is unchanged: this branch
  // still hands its pages to the publish path.
  assert.match(block, /publishStep\(env, \{/, "a swap that is never published is a change the owner cannot see");
  assert.match(block, /imagesAffordable\(1, \{ balance/, "a made picture must be priced against the real balance first");
  // AGAINST THE WHOLE FILE, not the branch — the import is at the top, and
  // asserting it inside a window that starts at the branch can only ever fail.
  assert.match(w, /import \{[^}]*runPictureEdit[^}]*\} from "\.\/builder\/site-picture\.mjs"/,
    "a call to a name that was never imported is a ReferenceError on the edit path");
});

test("uploadFileName is the inverse of uploadKey, derived from both", async () => {
  const { uploadKey, uploadFileName } = await import("../site-uploads.mjs");
  for (const name of ["abc123.jpg", "0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f.webp"]) {
    assert.equal(uploadFileName(uploadKey("some-slug", name)), name,
      "a name that does not survive the round trip becomes a broken image on a real page");
  }
  assert.equal(uploadFileName(""), "");
});

// ── NOWHERE TO PUT IT: the handoff to the page layer ────────────────────────
//
// This lane fills a slot that already exists, so "add a photo to the about
// page" — on a page with none — was a REFUSAL: the one shape of picture request
// the layer's own description advertises and the code cannot do. It hands
// SIDEWAYS to `page` (one page, one model call) rather than up the ladder,
// which rewrites every page of the site to add one picture.

const REPLY = (input) => ({ content: [{ type: "tool_use", name: "choose_pictures", input }] });
const SLOTS = [
  { page: "src/routes/index.tsx", alt: "The row of chairs" },
  { page: "src/routes/book.tsx", alt: "The shopfront" },
];

test("a page with no slot is handed to the page layer, not refused", () => {
  assert.equal(readNeedsPlace(REPLY({ pictures: [], needsPlace: "/about" }), SLOTS), "/about");
});

test("A PAGE THAT ALREADY HAS SLOTS IS REFUSED, which is what stops every miss becoming a paid edit", () => {
  // A model that matched nothing AND named a page it was shown slots for has
  // contradicted itself; the honest reading is "I could not tell which of
  // these", which is the cheap refusal rather than a page rewrite.
  //
  // THE CASES ARE ROUTES, AND THE FIRST DRAFT'S WERE FILE PATHS. A slot's
  // `page` is `src/routes/index.tsx` and `needsPlace` is `/`, so comparing them
  // raw compares two different things and the check could never fire — but the
  // tests reached it through `startsWith("/")`, which had already refused every
  // file path they used. One guard masking another: the mutant survived, the
  // suite was green, and the bug was real. Discriminating cases are routes.
  for (const p of ["/", "/book", "  /BOOK  "]) {
    assert.equal(readNeedsPlace(REPLY({ pictures: [], needsPlace: p }), SLOTS), null,
      "a page with slots was sent for a page rewrite: " + JSON.stringify(p));
  }
  // And a route the site really does not have still hands off, or the fix above
  // would read as "refuse everything", which is the old behaviour wearing a fix.
  assert.equal(readNeedsPlace(REPLY({ pictures: [], needsPlace: "/about" }), SLOTS), "/about");
});

test("anything that is not a path is refused", () => {
  // The value decides which page a MODEL CALL is spent rewriting, so a heading
  // or an invented shape must not reach it.
  for (const junk of [undefined, null, "", "   ", "about", "About us", 7, {}, ["/about"], true]) {
    assert.equal(readNeedsPlace(REPLY({ pictures: [], needsPlace: junk }), SLOTS), null,
      "junk reached the page layer: " + JSON.stringify(junk));
  }
  assert.equal(readNeedsPlace({ content: [] }, SLOTS), null, "a reply with no tool call");
  assert.equal(readNeedsPlace(null, SLOTS), null);
});

test("with no slots at all there is nothing to compare against, so it stays an escalation", () => {
  // `runPictureEdit` returns before this on an empty site — asserted so the
  // reader cannot conclude the two paths disagree.
  assert.equal(readNeedsPlace(REPLY({ pictures: [], needsPlace: "/about" }), []), null);
});

test("THE HANDOFF NAMES THE LAYER AND THE PAGE, and does not fire on an ordinary miss", async () => {
  const deps = (input) => ({
    send: async () => REPLY(input),
    library: async () => [],
    generate: async () => null,
  });
  const pages = [{ path: "src/routes/index.tsx", source: '<SafeImage src="" alt="The row of chairs" />' }];

  const handed = await runPictureEdit(deps({ pictures: [], needsPlace: "/about" }), { instruction: "add a photo to the about page", pages });
  assert.equal(handed.ok, false);
  assert.equal(handed.escalate, true, "a page with no slot must not be a dead-end refusal");
  assert.equal(handed.layer, "page", "the handoff must name the lane that can insert one");
  assert.equal(handed.page, "/about");

  // AND THE ORDINARY MISS IS UNCHANGED — a mistyped swap must not buy a page
  // rewrite, which is the cost of getting this wrong in the other direction.
  const missed = await runPictureEdit(deps({ pictures: [] }), { instruction: "change the one of the chairs", pages });
  assert.equal(missed.escalate, false, "an honest no became a paid page edit");
  assert.equal(missed.reason, "no-match");
  assert.ok(!missed.layer, "an ordinary miss must name no layer");
});

test("THE ROUTE FORWARDS THE HANDOFF, and the layer that decides it is the module", () => {
  // The wiring layer, where this repo has recorded twelve dead features. The
  // module can name a lane perfectly and the route can drop it, and from the
  // customer's side that is indistinguishable from the model never naming one.
  const worker = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const at = worker.indexOf('if (eLayer === "picture")');
  assert.ok(at > 0, "the picture branch is gone — rescope this");
  const branch = worker.slice(at, worker.indexOf("const pPub = await recompileAndPublish", at));
  assert.ok(branch.length > 400, "the picture window is empty — the anchor moved");
  assert.match(branch, /escalate\(pOut\.reason, pOut\.layer \? \{ layer: pOut\.layer, page: pOut\.page \} : undefined\)/,
    "the route drops the handoff — a page with no slot goes to the full revise instead of one page");
});

// ── A KIT COMPONENT CARRYING ITS PICTURE AS PROPS ─────────────────────────
//
// `<HeroSplit image={null} imageAlt="…" />` draws through SafeImage from props,
// which the scanner did not see — so "change the main photo" on a site whose
// main photo is exactly that answered `no-slots` (lane sweep, 2026-09-01,
// twice). Measured over the corpus after the change: 18 component slots found
// (Figure 16, MediaObject 2) beside the 188 element ones, and no page lost a
// slot it had.
test("a component with image/imageAlt or src/alt props is a picture slot", () => {
  const hero = { path: "index.tsx", source: `export default function P() {\n  return (\n    <HeroSplit title="Lessons" image={null} imageAlt="An acoustic guitar resting on a wooden chair" />\n  );\n}\n` };
  const slots = imageSlots([hero]);
  assert.equal(slots.length, 1);
  assert.equal(slots[0].tag, "HeroSplit");
  assert.equal(slots[0].alt, "An acoustic guitar resting on a wooden chair");
  assert.equal(slots[0].expr, true);
  assert.equal(isEmptySlot(slots[0]), true, "image={null} is an empty slot waiting to be filled");
  assert.equal(slots[0].focusBound, true, "a component slot cannot be reframed — focus is SafeImage's own prop");
  const fig = { path: "a.tsx", source: `<Figure src="https://x/y.jpg" alt="The workshop" caption="Us" />` };
  const f = imageSlots([fig]);
  assert.equal(f.length, 1); assert.equal(f[0].tag, "Figure"); assert.equal(f[0].value, "https://x/y.jpg"); assert.equal(f[0].quoted, true);
  // A component with an alt-looking prop and no picture prop is not a slot.
  assert.deepEqual(imageSlots([{ path: "b.tsx", source: `<Quote alt="x" text="y" />` }]), []);
  // And a bound picture is recorded as bound, not offered as empty.
  const bound = imageSlots([{ path: "c.tsx", source: `<HeroSplit image={row.photo} imageAlt="A chair" />` }]);
  assert.equal(bound.length, 1); assert.equal(isEmptySlot(bound[0]), false);
});

test("a picture chosen for a component slot is written into the prop, expression or string", () => {
  const hero = { path: "index.tsx", source: `<HeroSplit image={null} imageAlt="A guitar" />` };
  const [slot] = imageSlots([hero]);
  const out = applyPictures([hero], [{ slot, url: "https://cdn/x.jpg" }]);
  assert.equal(out.pages[0].source, `<HeroSplit image="https://cdn/x.jpg" imageAlt="A guitar" />`);
  const fig = { path: "a.tsx", source: `<Figure src="old.jpg" alt="The workshop" />` };
  const [fs2] = imageSlots([fig]);
  assert.equal(applyPictures([fig], [{ slot: fs2, url: "new.jpg" }]).pages[0].source, `<Figure src="new.jpg" alt="The workshop" />`);
});

// ─────────────────────────────────────────────────────────────────────────────
// HOW MANY EMPTY PICTURE FRAMES A CHANGE ADDED (2026-09-17)
//
// `countImageSlots` counts `@@IMG:` TOKENS and answers the same question for a
// BUILD. Its own comment says why it exists — *"a NEW page that wants one
// publishes with a placeholder and, until this, said nothing about it"* — and
// the addon's directive forbids tokens, so on the one path that ADDS pages it
// has always answered 0 and the customer's sentence never fired.
// ─────────────────────────────────────────────────────────────────────────────
const PG = (path, ...imgs) => ({ path, source: "function C(){ return <main>" + imgs.join("") + "</main> }" });
const EMPTY = (alt) => '<SafeImage src="" alt="' + alt + '" />';
const FULL = (alt) => '<SafeImage src="/u/fw/x.jpg" alt="' + alt + '" />';

test("newEmptySlots counts the frames a change added, and only those", () => {
  // A NEW PAGE: no before, so every empty frame on it is one this change made.
  assert.equal(newEmptySlots(
    [PG("src/routes/index.tsx", FULL("a"))],
    [PG("src/routes/index.tsx", FULL("a")), PG("src/routes/gallery.tsx", EMPTY("b"), EMPTY("c"))],
  ), 2, "a new page's empty frames were not counted");

  // AND THE CONTROL THAT MAKES THAT NUMBER MEAN SOMETHING: a page the change
  // did not touch contributes nothing, however many empty frames it carries.
  // Without this, "count the empty frames" and "count the ones we added" are
  // the same assertion, and the wrong one reads to a customer as "your change
  // made these".
  assert.equal(newEmptySlots(
    [PG("src/routes/index.tsx", EMPTY("a"), EMPTY("b"))],
    [PG("src/routes/index.tsx", EMPTY("a"), EMPTY("b"))],
  ), 0, "an untouched page's existing frames were reported as new");

  // A CHANGED page counts its INCREASE, not its total.
  assert.equal(newEmptySlots(
    [PG("src/routes/index.tsx", EMPTY("a"))],
    [PG("src/routes/index.tsx", EMPTY("a"), EMPTY("b"))],
  ), 1, "a changed page reported its total rather than what it gained");

  // A FILL SOMEWHERE ELSE MUST NOT OFFSET A NEW ONE. Summing signed deltas
  // reports 0 over a site that really does have a new empty frame on it.
  assert.equal(newEmptySlots(
    [PG("src/routes/index.tsx", EMPTY("a"))],
    [PG("src/routes/index.tsx", FULL("a")), PG("src/routes/gallery.tsx", EMPTY("b"))],
  ), 1, "filling one frame cancelled out a new one");

  // …AND THE ASSERTION ABOVE CANNOT REACH THE CLAMP, which is why this one is
  // here. Filling a page's ONLY frame takes that page out of the `after` map
  // entirely, so the loop never visits it and there is no negative to clamp —
  // MEASURED: the unclamped sum passes every other assertion in this case. The
  // shape that arms it is a page that KEEPS an empty frame while losing
  // another: signed, (1 − 2) + (1 − 0) is 0 over a site with a real new space.
  assert.equal(newEmptySlots(
    [PG("src/routes/index.tsx", EMPTY("a"), EMPTY("b"))],
    [PG("src/routes/index.tsx", EMPTY("a"), FULL("b")), PG("src/routes/gallery.tsx", EMPTY("c"))],
  ), 1, "a page that filled one of two frames cancelled out another page's new one");

  // A NEW PAGE'S FILLED FRAME IS NOT A SPACE. Without this, "count the empty
  // frames" and "count every frame" are the same assertion on every fixture
  // above, because no page in them gains a picture — measured, the whole case
  // passes with `isEmptySlot` never asked.
  assert.equal(newEmptySlots([], [PG("src/routes/gallery.tsx", FULL("a"), EMPTY("b"))]), 1,
    "a filled frame on a new page was reported as a space the customer can fill");

  // AND A `src`-LESS ELEMENT IS NOT A FRAME ANYBODY CAN FILL — `imageSlots`
  // rewrites a `src` attribute, so an element without one is invisible to the
  // rung this count exists to hand over to. Counting it would promise a space
  // the picture step cannot use.
  assert.equal(newEmptySlots([], [PG("src/routes/gallery.tsx", '<SafeImage alt="b" />')]), 0,
    "a src-less SafeImage was counted as a fillable frame");
  // …with the control that the same page WITH an empty src is counted, so the
  // assertion above is about the src and not about the page.
  assert.equal(newEmptySlots([], [PG("src/routes/gallery.tsx", EMPTY("b"))]), 1,
    "the control failed: an empty-src frame was not counted either");

  // JUNK IS 0, never a throw: this rides a reply the customer reads.
  assert.equal(newEmptySlots(null, undefined), 0, "a junk argument was not 0");

  // ⚠ AND IT WALKS THE AFTER ALONE — asserted here because a line in the ADDON
  // ROUTE rests on it (2026-09-17). That route hands this
  // `imageSources(aMerge.pages, aParts || aPartsRead.parts)`, and the `||` is
  // what makes the AFTER *the whole site as this change leaves it* rather than
  // *what the model handed back*. Today the two are numerically identical
  // BECAUSE of this property: a file present in the BEFORE and absent from the
  // AFTER contributes nothing, exactly as an unchanged one contributes
  // `count - count`.
  //
  // MEASURED through the route over seven shapes, byte-identical either way —
  // so that line has no observable mutant, and a sweep reads it as a survivor
  // for ever. This is its reader instead: the day removals start counting, the
  // route's `||` stops being inert and goes from documentation to a wall, and
  // whoever moves this line finds out here rather than in a customer's reply.
  assert.equal(newEmptySlots([PG("src/routes/gallery.tsx", EMPTY("a"), EMPTY("b"))], []), 0,
    "a file that left the AFTER was counted, so the addon route's `|| aPartsRead.parts` is no longer inert");
  assert.equal(newEmptySlots([PG("src/routes/gallery.tsx", EMPTY("a"))], [PG("src/routes/index.tsx", FULL("c"))]), 0,
    "a file absent from the AFTER contributed, so the addon route's AFTER expression now changes the answer");
});

// ─────────────────────────────────────────────────────────────────────────────
// A PICTURE A PAGE DRAWS FROM A LIST IN ITS OWN SOURCE (2026-09-19)
//
// Owner, after run 51: *"Fix the mismatch between the gallery's seven empty
// frames and the reply's 'one photo space.'"*
// ─────────────────────────────────────────────────────────────────────────────

/** The two kit components that take one — read off their own prop types. */
const KIT_LIST = (items) =>
  '<Gallery className="mt-10" items={[\n' + items.map((i) => "    " + i + ",\n").join("") + "  ]} />";

test("a list of pictures is counted, and an element is left to imageSlots", () => {
  // THE REAL SHAPE, written back from the bundle run 51 published: one
  // addressable `<SafeImage src="">` and a six-entry `Gallery`. `1 + 6 = 7` is
  // what a browser measured on that page (`role="img"` ×7, `<img>` ×0).
  const page = {
    path: "gallery.tsx",
    source: 'function Page(){ return (<main>\n'
      + '  <SafeImage src="" alt="Harbour Loaf interior in warm morning light" ratio="16/9" />\n'
      + KIT_LIST([
        '{ alt: "A crusty country loaf on the cooling rack", caption: "Country loaf", fallbackSeed: "loaf-country" }',
        '{ alt: "Seeded sourdough on a wooden board", caption: "Seeded sourdough" }',
        '{ alt: "Flour-dusted bannetons", caption: "Bannetons" }',
        '{ alt: "A dark rye loaf", caption: "Dark rye" }',
        '{ alt: "Batards stacked after the bake", caption: "Batards" }',
        '{ alt: "The brick oven", caption: "The oven" }',
      ])
      + "\n</main>) }",
  };
  const frames = listFrames([page]);
  assert.equal(frames.length, 6, "the list entries were not read: " + JSON.stringify(frames.map((f) => f.alt)));
  assert.ok(frames.every((f) => f.empty), "a list entry with no picture was not read as empty");
  assert.equal(frames[0].page, "gallery.tsx", "a frame does not carry the page it is on");
  // THE DIVISION IS THE POINT: `imageSlots` sees the element and NOT the list,
  // which is its contract (a `src` span to replace and a literal `alt` to match)
  // and is why this reader exists rather than that one being widened.
  assert.equal(imageSlots([page]).length, 1, "imageSlots reached into the list");
  assert.equal(newEmptySlots([], [page]) + newListFrames([], [page]).n, 7, "1 + 6 is not 7");
});

test("a list entry that really carries a picture is not an empty frame", () => {
  // THE OTHER DIRECTION, and it has NO case in the 100-site corpus: measured,
  // all 320 list frames there are empty (254 `src: null`, 66 with no key), so
  // without this the `empty` test is a branch nothing drives. (254 of the 320
  // are `src: null` and 66 carry no key at all; both are the same empty frame.)
  const page = {
    path: "gallery.tsx",
    source: KIT_LIST([
      '{ src: "/u/fw/abc.jpg", alt: "The oven", caption: "The oven" }',
      '{ src: null, alt: "Bannetons", caption: "Bannetons" }',
      '{ alt: "Dark rye", caption: "Dark rye" }',
    ]),
  };
  const frames = listFrames([page]);
  assert.equal(frames.length, 3);
  assert.deepEqual(frames.map((f) => f.empty), [false, true, true],
    "`src: null` and a missing key are the same empty frame; a real url is not");
  assert.equal(newListFrames([], [page]).n, 2);
});

test("a computed alt is a row, not a picture somebody wrote — and its count is unknowable", () => {
  // MEASURED over the corpus: exactly ONE page of 324 carries this, and it is
  // `items={HOUSES.filter(...).map((x) => ({ alt: `${x.name}, ${x.where}` }))}`
  // — a list whose LENGTH is decided at runtime, so no reader of the source can
  // say how many frames it draws. Refusing it is the same rule `imageSlots`
  // states at its head, and it is the one place this count is a floor rather
  // than the truth; the limit is stated rather than papered over.
  const page = {
    path: "houses.tsx",
    source: "<Gallery items={HOUSES.map((x) => ({ alt: `${x.name}, ${x.where}`, caption: `${x.name}` }))} />",
  };
  assert.deepEqual(listFrames([page]), [], "a data-driven list was counted as a known number of frames");
});

test("the frame count is per page and only the increase, like the slot count", () => {
  const was = { path: "gallery.tsx", source: KIT_LIST(['{ alt: "One" }', '{ alt: "Two" }']) };
  const now = { path: "gallery.tsx", source: KIT_LIST(['{ alt: "One" }', '{ alt: "Two" }', '{ alt: "Three" }']) };
  assert.equal(newListFrames([was], [now]).n, 1, "a page that gained one frame reported something else");
  assert.equal(newListFrames([was], [was]).n, 0, "an untouched page reported its existing frames as new");
  // NEGATIVE NEVER SUBTRACTS — a page that LOST frames must not offset another
  // page that really gained one.
  const other = { path: "index.tsx", source: KIT_LIST(['{ alt: "New" }']) };
  assert.equal(newListFrames([now], [was, other]).n, 1, "a removal offset a real addition");
});

test("a comment is not a picture space, whichever way it is written", () => {
  // ⚠ THE REPRODUCTION (owner, 2026-09-19): *"Don't report arbitrary source
  // objects as visible picture spaces. Comments currently count."* All three
  // shapes a generated page really carries were driven before the fix and each
  // counted — a customer told their page has a picture space in it because a
  // comment mentions one. A comment is the one part of a file that cannot
  // render, so this is not a heuristic.
  const one = (source) => listFrames([{ path: "p.tsx", source }]);
  const HIDDEN = [
    ["a line comment", 'const x = 1;\n// { alt: "a stray note", src: null }\nexport default x;'],
    ["a block comment", '/* items={[{ alt: "an old idea", src: null }]} */\nconst y = 2;'],
    ["a jsdoc example", '/**\n * { alt: "example", src: null }\n */\nconst z = 3;'],
  ];
  for (const [what, source] of HIDDEN) {
    assert.deepEqual(one(source), [], what + " was counted as a picture space a visitor can see");
  }
  // ── AND THE TWO CONTROLS ARE THE POINT, because a comment stripper written
  // the obvious way breaks a page rather than a comment. Both are shapes this
  // repository has paid for once already, one in each direction.
  //
  // A `//` INSIDE A STRING is every `href="https://…"` on every page there is;
  // a comment-first pass reads it as a comment and blanks the rest of the line,
  // taking a real frame with it.
  assert.equal(one('const u = "https://x.test/a"; const a = [{ alt: "Real", src: null }];').length, 1,
    "a URL in a string was read as a comment and ate the frame beside it");
  // A `/*` INSIDE A LINE COMMENT is this file's own recorded trap: read as a
  // block opener it runs to the next `*/`, which may be thousands of
  // characters away or absent altogether.
  assert.equal(one('// see /* the old shape\nconst a = [{ alt: "Real", src: null }];').length, 1,
    "a block opener inside a line comment swallowed the code below it");
  // AND A FRAME IN PLAIN CODE STILL READS, so "blank everything" cannot pass.
  assert.equal(one('const a = [{ alt: "Real", src: null }];').length, 1, "the reader stopped seeing plain code");
});

test("a key may be quoted, and a filled entry is never an empty space", () => {
  // ⚠ THE REPRODUCTION (owner, 2026-09-19): *"a filled entry with a quoted
  // `\"src\"` key reads as empty."* MEASURED before the fix: a photograph the
  // owner paid for came back `value: "", empty: true` and was offered to the
  // customer as a space nothing can fill. `OBJ_START` already admitted a quoted
  // key, so the object was FOUND and read by a grammar that could not see its
  // keys — which is why the failure was a wrong number rather than a missing
  // one.
  const one = (source) => listFrames([{ path: "p.tsx", source }])[0];
  const URL = "/u/s/abc.jpg";
  for (const [what, k] of [["double-quoted", '"src"'], ["single-quoted", "'src'"], ["bare (the control)", "src"]]) {
    const f = one('const a = [{ alt: "A loaf", ' + k + ': "' + URL + '" }];');
    assert.equal(f.value, URL, what + " src was not read at all: " + JSON.stringify(f));
    assert.equal(f.empty, false, what + " src read as an empty picture space: " + JSON.stringify(f));
  }
  // THE MIRROR, and it fails the other way: a quoted `alt` was missed
  // ALTOGETHER, so the entry vanished from the count instead of misreading.
  const q = one('const a = [{ "alt": "A loaf", src: null }];');
  assert.equal(q && q.alt, "A loaf", "a quoted alt key was not found: " + JSON.stringify(q));
  assert.equal(q.empty, true, "an entry with no picture read as filled");
  // AND THE CHARACTER BEFORE THE KEY IS STILL THE WALL — a quote belongs to the
  // key, and widening the class to admit one makes any name ending in `src` a
  // `src`. ⚠ `image_src` IS THE SHAPE THAT DISCRIMINATES AND `dataSrc` IS NOT:
  // a sweep survivor measured it — `dataSrc` carries a CAPITAL S, so the
  // lowercase needle never matches it and the case that used it was vacuous.
  // Both are kept, the second declared, because the camel-case one is the
  // shape a model really writes and it must go on reading clean.
  assert.equal(one('const a = [{ alt: "A loaf", image_src: "' + URL + '" }];').value, "",
    "a snake_case key ending in `src` was read as `src`");
  assert.equal(one('const a = [{ alt: "A loaf", dataSrc: "' + URL + '" }];').value, "",
    "a camelCase key ending in `Src` was read as `src`");
});

test("the comment scan blanks rather than deletes, and keeps its own shape", () => {
  // ⚠ THE PROPERTY HAS NO READER INSIDE THE MODULE, which is why it is
  // exported and asserted here: every scan downstream works on the blanked
  // copy, so nothing there can tell blanking from deleting — and a scan that
  // deletes gives back offsets that cannot be read against the file anybody is
  // looking at. Two sweep survivors are what said so.
  const src = ['const a = 1; // { alt: "x" }', "/* two", "   lines */", "const b = 2;"].join("\n");
  const out = codeOnly(src);
  assert.equal(out.length, src.length, "the blanking moved every offset after a comment");
  assert.equal(out.split("\n").length, src.split("\n").length, "a blanked comment lost its newlines");
  // ⚠ AND THE MASKED COPY KEEPS BOTH TOO (2026-09-19), which is what makes the
  // two views usable at ONE offset: `listFrames` matches braces against the
  // masked copy and reads the body out of the plain one. An escape is two
  // characters in and two out; a newline inside a masked template survives as
  // itself. Measured against shapes that carry all three.
  const strs = [
    'const t = "a \\" b";',
    "const u = 'plain';",
    "const v = `two",
    "lines`;",
    'const a = [{ alt: "Real", src: null }];',
  ].join("\n");
  for (const [what, masked] of [["plain", codeOnly(strs)], ["masked", codeOnly(strs, true)]]) {
    assert.equal(masked.length, strs.length, what + " moved every offset after a string");
    assert.equal(masked.split("\n").length, strs.split("\n").length, what + " lost a newline inside a string");
  }
  assert.equal(codeOnly(strs, true).includes("Real"), false, "a string's contents survived the masking");
  assert.equal(codeOnly(strs).includes("Real"), true, "the plain copy lost the value a frame is read from");
  assert.equal(out.includes("alt"), false, "a line comment survived the blanking");
  assert.equal(out.includes("lines"), false, "a block comment survived the blanking");
  assert.match(out, /const a = 1;/, "code before a comment was blanked with it");
  assert.match(out, /const b = 2;/, "code after a comment was blanked with it");
  // AN UNTERMINATED BLOCK COMMENT RUNS TO THE END OF THE FILE, because that is
  // what it really means — stopping at its own opener would read everything
  // after it as code, which is the defect wearing a subtler hat.
  const open = ['/* { alt: "never closed", src: null }', "const c = 3;"].join("\n");
  assert.equal(codeOnly(open).trim(), "", "an unterminated block comment let its body count");
  assert.deepEqual(listFrames([{ path: "p.tsx", source: open }]), [],
    "an object inside an unterminated comment was counted as a picture space");
  // AND AN ESCAPED QUOTE DOES NOT END ITS STRING. Without this the rest of the
  // line reads as code and a `//` in it opens a comment over real source.
  const esc = 'const t = "a \\" b // not a comment"; const a = [{ alt: "Real", src: null }];';
  assert.equal(listFrames([{ path: "p.tsx", source: esc }]).length, 1,
    "an escaped quote ended its string and the frame beside it vanished");
});

test("only an array written where it renders puts a number on the page", () => {
  // ⚠ RE-ANCHORED 2026-09-19, NOT APPEASED, and the expectations below MOVED
  // rather than broke. This case has always been *"a frame whose number the
  // browser decides contributes no number"*; what changed is how that is
  // decided. Owner: *"An unused image array and an array filtered to zero still
  // report visible picture spaces. A literal object is not proof that it
  // renders… Don't keep adding individual runtime-method exceptions."*
  //
  // The old rule looked backward for `.map` / `.flatMap` / `Array.from`, and it
  // was written as a list because a list is what a deny-list is. Its structural
  // failure is measurable: a generated page declares its array at the top of the
  // file and maps it two hundred lines below, so **over the whole corpus that
  // deny-list caught ZERO of the 23 runtime-decided frames**. The positive rule
  // catches all 23 and names no method at all.
  const one = (source) => listFrames([{ path: "p.tsx", source }])[0];
  // ── THE TWO THE OWNER REPORTED, which the deny-list let through as exact ──
  const UNUSED = 'const SHOTS = [{ alt: "the bench", src: null }, { alt: "a loaf", src: null }];\n'
    + "export default function P() { return <main><h1>Fold Lane</h1></main>; }";
  const FILTERED = 'const SHOTS = [{ alt: "the bench", src: null, featured: false }];\n'
    + "export default function P() { return <Gallery items={SHOTS.filter((s) => s.featured)} />; }";
  for (const [what, source] of [
    ["an array nothing on the page renders", UNUSED],
    ["an array filtered to zero at runtime", FILTERED],
    // …AND THE FOUR THE DENY-LIST DID CATCH, which must still contribute none.
    [".map over an unknown array", 'const a = SHOTS.map((s) => ({ alt: "Bread", src: null }));'],
    ["a flatMap", 'const a = GROUPS.flatMap((g) => ({ alt: "Bread", src: null }));'],
    ["a literal array inside a map callback", 'const a = ROWS.map((r) => ({ shots: [{ alt: "Bread", src: null }] }));'],
    ["Array.from", 'const a = Array.from({ length: 6 }, () => ({ alt: "Bread", src: null }));'],
    // …AND THE THREE A DENY-LIST WOULD HAVE HAD TO GROW A NAME FOR — every one
    // sits inside a prop's expression container, and not one of them says how
    // many frames the page draws. They are why the rule asks whether the array
    // is the prop's WHOLE value rather than merely what the entry sits in, and
    // all three were found by probing the first cut rather than by reading it.
    ["a ternary choosing an array", '<Gallery items={on ? A : [{ alt: "Bread", src: null }]} />'],
    ["a spread beside a literal", '<Gallery items={[...A, { alt: "one", src: null }]} />'],
    ["a number taken off an array", '<Gallery n={[{ alt: "one", src: null }].length} />'],
    ["a call returning an array", '<Gallery items={pick({ alt: "Bread", src: null })} />'],
    // ⚠ AND AN ARRAY HANDED TO A CALL — a sweep survivor, because every other
    // shape here reaches its second encloser as a `{` and these reach a `(`.
    // The array is written down and what the call does with it is not.
    ["an array handed to a call in a prop", '<Gallery items={pick([{ alt: "one", src: null }])} />'],
    ["an array built in a memo", 'const s = useMemo(() => [{ alt: "one", src: null }], []);'],
    ["an array down a call chain", 'const s = wrap(fn([{ alt: "one", src: null }]));'],
    ["an array inside an object in a prop", '<Gallery cfg={{ items: [{ alt: "one", src: null }] }} />'],
  ]) {
    const f = one(source);
    assert.ok(f, what + " produced no frame at all, so the case proves nothing");
    assert.equal(f.counted, false, what + " was counted as an exact number of frames");
  }
  // ── THE CONTROL: an array written where it renders ────────────────────────
  //
  // ⚠ THE OLD CONTROL WAS A BARE `const` ARRAY AND IS NOW ONE OF THE REFUSALS
  // ABOVE — that is the correction, not a regression: a `const` is exactly the
  // shape the owner reported, and whether it reaches the page unmodified is not
  // something this can see. **297 of the corpus's 320 frames are in the shape
  // below**, so the narrowing costs no real page its number.
  const lit = listFrames([{ path: "p.tsx", source: '<Gallery items={[{ alt: "one", src: null }, { alt: "two", src: null }]} />' }]);
  assert.equal(lit.length, 2);
  assert.equal(lit.every((f) => f.counted), true, "an array written into a prop was called uncertain: " + JSON.stringify(lit));
  // AND THE THREE WALLS INSIDE THAT RULE, each its own refusal: the attribute
  // name, the `=`, and the array. Without the first two a bare JSX expression
  // container — which is every list a page maps over — would read as a prop.
  for (const [what, source] of [
    ["a JSX expression that is not a prop", '<div>{[{ alt: "one", src: null }]}</div>'],
    ["an arrow body that happens to be an array", 'const f = () => [{ alt: "one", src: null }];'],
  ]) {
    const f = one(source);
    assert.ok(f, what + " produced no frame at all, so the case proves nothing");
    assert.equal(f.counted, false, what + " was read as an array written where it renders");
  }
  // AND WHITESPACE IS NOT ONE OF THOSE WALLS: a generated page writes its
  // gallery over several lines, and the corpus's 297 are mostly that shape.
  const wide = listFrames([{ path: "p.tsx", source: "<Gallery\n  items={[\n    { alt: \"one\", src: null },\n    { alt: \"two\", src: null },\n  ]}\n/>" }]);
  assert.equal(wide.length, 2);
  assert.equal(wide.every((f) => f.counted), true, "a gallery written over several lines lost its number");
  // …AND AN ELLIPSIS INSIDE A CAPTION IS A CAPTION, because the spread test
  // reads the masked copy where a string's contents are gone.
  assert.equal(one('<Gallery items={[{ alt: "one", caption: "a loaf...", src: null }]} />').counted, true,
    "an ellipsis inside a caption was read as a spread");
  // …AND THE PAIR THE ROUTE READS. `n` is what is really established and `more`
  // says separately that the page draws some from data, so an uncertain gallery
  // alone contributes NO number and the customer hears no figure at all.
  const page = (source) => [{ path: "gallery.tsx", source }];
  assert.deepEqual(newListFrames([], page('<Gallery items={[{ alt: "one", src: null }, { alt: "two", src: null }]} />')),
    { n: 2, more: false });
  for (const [what, source] of [["the unused array", UNUSED], ["the filtered array", FILTERED]]) {
    assert.deepEqual(newListFrames([], page(source)), { n: 0, more: true },
      what + " was reported as a number of visible picture spaces");
  }
  // BOTH AT ONCE: the established ones are counted and the rest is said.
  assert.deepEqual(newListFrames([], page([
    '<Gallery items={[{ alt: "one", src: null }, { alt: "two", src: null }]} />',
    'const b = SHOTS.map((s) => ({ alt: "Bread", src: null }));',
  ].join("\n"))), { n: 2, more: true });
  // AND A PAGE THAT GAINED NOTHING SETS NO FLAG, however its own frames are
  // written: the question is about THIS change's number, not about the site.
  const mapped = page('const a = SHOTS.map((s) => ({ alt: "Bread", src: null }));');
  assert.deepEqual(newListFrames(mapped, mapped), { n: 0, more: false },
    "an untouched uncertain gallery made another page's count a floor");
  // AND THE BOUND IS UNCERTAINTY, NEVER A NUMBER. A counted entry sits at most
  // 815 characters from its own `items={` across the whole corpus; past the
  // bound the walk gives up, and giving up must read as "cannot establish".
  const far = '<Gallery items={[' + '{ alt: "pad", src: null }, '.repeat(120) + '{ alt: "last", src: null }]} />';
  const tail = listFrames([{ path: "p.tsx", source: far }]).at(-1);
  assert.equal(tail.alt, "last");
  assert.equal(tail.counted, false, "a frame past the lookback bound was given a number anyway");
});

test("what is not an object literal with a written alt is not a frame", () => {
  // THE FALSE-ALARM WALL, and the corpus is what sizes it: 320 of these exist
  // across 100 sites and every one is a picture entry, so the rule is `alt`
  // and the refusals below are what keep it that narrow.
  const shapes = [
    ["a JSX expression brace", "<div className={cx('a')}>{rows.length}</div>"],
    ["an object with no alt", "<StatsBand items={[{ value: '4', label: 'Houses' }]} />"],
    ["a nested object", "<Thing cfg={{ alt: 'x', inner: { deep: 1 } }} />"],
    ["a prop attribute", '<SafeImage src="" alt="An element, not an entry" />'],
    ["a sentence about alt", "// the alt: \"is what identifies a slot\""],
  ];
  for (const [what, source] of shapes) {
    assert.deepEqual(listFrames([{ path: "p.tsx", source }]), [], what + " was read as a picture frame");
  }
  // …AND THE SHAPE IT MUST STILL FIND, so the five above are refusals rather
  // than the reader being switched off.
  assert.equal(listFrames([{ path: "p.tsx", source: "items={[{ alt: 'A loaf', caption: 'Loaf' }]}" }]).length, 1);
});

test("an object written inside a string is an example, not a picture", () => {
  // ⚠ Owner, 2026-09-19: *"A quoted example containing an object also counts as
  // a picture. Exclude strings and unused examples."* A page that DESCRIBES the
  // shape — a placeholder, a helper's doc line, a copy-me sample in a prop —
  // has an object literal inside a string literal, and the reader counted it as
  // a space on the page. Nothing renders from it.
  for (const [what, source] of [
    ["a double-quoted example", 'const hint = "each item is { alt: \\"A loaf\\", caption: \\"Loaf\\" }";'],
    ["a single-quoted example", "const hint = 'each item is { alt: \"A loaf\" }';"],
    ["a template example", "const hint = `each item is { alt: \"A loaf\" }`;"],
  ]) {
    assert.deepEqual(listFrames([{ path: "p.tsx", source }]), [], what + " was counted as a picture space");
  }
  // ⚠ AND THE CONTROL THAT COST 29 REAL FRAMES ACROSS 6 OF 100 CORPUS SITES.
  // The first cut of the string masking read a JSX prose apostrophe as a string
  // OPENER — `somebody else's` — and swallowed the rest of the file, so a real
  // gallery below it vanished. A quote straight after a word character is
  // prose, not a string. Only the corpus measurement caught it: a false
  // all-clear is worse than a false alarm, and this one was silent.
  const prose = [
    "function Page(){ return (<main>",
    "  <p>Bread somebody else's oven can't make, in the baker's own words</p>",
    '  <Gallery items={[{ alt: "A crusty country loaf" }, { alt: "Seeded sourdough" }]} />',
    "</main>) }",
  ].join("\n");
  assert.equal(listFrames([{ path: "p.tsx", source: prose }]).length, 2,
    "an apostrophe in prose swallowed the gallery under it");
  // …AND A URL INSIDE A STRING IS NOT A COMMENT. Without the string scan the
  // `//` in `https://` opens one and everything after it is blanked, which is
  // the same loss through a different door.
  const url = 'const u = "https://example.com/a"; const a = [{ alt: "A loaf" }];';
  assert.equal(listFrames([{ path: "p.tsx", source: url }]).length, 1,
    "a `//` inside a URL blanked the source after it");
});

test("the reader refuses a page it cannot read, and bounds what it returns", () => {
  assert.deepEqual(listFrames(null), []);
  assert.deepEqual(listFrames([null, { path: 1, source: "{ alt: 'x' }" }, { path: "p.tsx", source: null }]), []);
  // AN UNTERMINATED OBJECT IS NOT ONE. A source cut mid-literal must answer
  // nothing rather than running to the end of the file.
  assert.deepEqual(listFrames([{ path: "p.tsx", source: '{ alt: "never closed"' }]), []);
  // THE CAP, read from the product rather than typed.
  const many = Array.from({ length: MAX_LIST_FRAMES + 20 }, (_, i) => `{ alt: "Shot ${i}" }`);
  assert.equal(listFrames([{ path: "p.tsx", source: KIT_LIST(many) }]).length, MAX_LIST_FRAMES);
  // …AND AN OBJECT TOO LONG TO BE A PICTURE ENTRY IS NOT ONE. A gallery item is
  // short by construction, so `MAX_OBJ_CHARS` is the shape test rather than a
  // performance bound: measured, without it a 5,000-character flat object
  // carrying an `alt` reads as a frame. Fail-closed is the right direction —
  // nothing that long is a picture somebody wrote into a list.
  const huge = `{ note: "${"x".repeat(5000)}", alt: "Far away", caption: "C" }`;
  assert.deepEqual(listFrames([{ path: "p.tsx", source: KIT_LIST([huge]) }]), [],
    "an object too long to be a picture entry was counted as one");
});

test("an escaped quote inside an alt does not lose the frame after it", () => {
  // MEASURED: without the escape test in the scanner, `alt: "a 3\" length"`
  // ends the string early and the object boundary shifts — the FIRST frame is
  // lost entirely and only the second survives (2 frames against 1). A trade
  // measurement is exactly where this shows up (`a 3" length of pipe`).
  const src = KIT_LIST([
    String.raw`{ alt: "a 3\" length of pipe", caption: "Pipe" }`,
    '{ alt: "Second", caption: "B" }',
  ]);
  const frames = listFrames([{ path: "p.tsx", source: src }]);
  assert.equal(frames.length, 2, "a frame was lost to an escaped quote: " + JSON.stringify(frames.map((f) => f.alt)));
  assert.equal(frames[1].alt, "Second", "the second entry's own alt was mis-read");
  // AND THE VALUE ITSELF IS CUT AT THE ESCAPE, which is `literalKey`'s own
  // double-quote rule and is honest rather than a defect: this reader COUNTS
  // frames, and the alt it carries is a label. Asserted so the day it changes
  // is deliberate.
  assert.equal(frames[0].alt, "a 3\\", "the alt's own truncation moved without anybody deciding to");
});

// A REAL TWO-ENTRY GALLERY, written where it renders — the ordinary shape, and
// its one reader is the key-set assertion at the end of the case below. It is
// declared HERE rather than beside that assertion because a `const` read from
// above its own line is this repository's recorded temporal-dead-zone trap, and
// "the test callback runs after the module finishes evaluating" is a reason
// that holds today and is not one worth resting on.
const LIST_SHAPE_PAGE =
  'export default function P() {\n' +
  '  return <Gallery items={[{ alt: "the bench", src: null }, { alt: "the window", src: null }]} />;\n' +
  '}\n';

test("the whole corpus reads clean: every list frame empty, and the counted split held", () => {
  // THE FALSE-ALARM RATE, measured against the real corpus rather than argued:
  // 320 frames in 60 of 324 page files, and NOT ONE carries a picture. That is
  // the scale of what no reader on this platform has ever counted, and it is
  // why run 51's six are the ordinary case rather than a curiosity.
  const dir = new URL("./fixtures/corpus/", import.meta.url);
  const pages = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const at = new URL(e.name + (e.isDirectory() ? "/" : ""), d);
      if (e.isDirectory()) walk(at);
      else if (/\.(tsx|jsx)$/.test(e.name)) pages.push({ path: at.pathname, source: fs.readFileSync(at, "utf8") });
    }
  };
  walk(dir);
  assert.ok(pages.length > 300, "the corpus did not load — this case measures nothing");
  // ⚠ ONE PAGE AT A TIME, AND THAT IS NOT A STYLE CHOICE. `listFrames` caps its
  // answer at MAX_LIST_FRAMES (200), so handing it all 324 pages at once reads
  // 200 frames in 36 files — the cap, wearing the corpus's name. Per page the
  // cap is never reached and the sum is the real one. Measured both ways.
  let frames = 0, filled = 0, files = 0, counted = 0;
  for (const p of pages) {
    const f = listFrames([p]);
    if (f.length) files++;
    frames += f.length;
    filled += f.filter((x) => !x.empty).length;
    counted += f.filter((x) => x.counted).length;
  }
  assert.equal(frames, 320, "the corpus frame count moved — re-measure before moving this number");
  assert.equal(files, 60, "the number of pages carrying one moved");
  assert.equal(filled, 0, "a corpus list frame carries a picture — the 'all empty' measurement is stale");
  // ⚠ AND THE FALSE-ALARM RATE OF THE COMMENT AND QUOTED-KEY FIXES IS ZERO,
  // measured the only way it can be: every generated page the platform has,
  // read before and after. Blanking comments and admitting a quoted key changed
  // NO page's reading — 320/60/0 on both sides — so they fire on the shapes
  // that were wrong and on nothing else.
  //
  // ⚠ THE SPLIT IS ASSERTED, AND THE FIELD IT READS IS `counted` — 2026-09-19,
  // and this line spent a commit reading a field that no longer exists. It was
  // `runtime += f.filter((x) => x.runtime).length` with `assert.equal(runtime,
  // 0)` under it, written when the flag was a NEGATIVE deny-list; the rename to
  // the positive `counted` left the filter reading `x.runtime`, which is
  // `undefined` on every frame the reader can emit. MEASURED: 0 of the 320
  // carry that key at all, so the assertion was true for every possible corpus
  // and would have passed with `writtenWhereItRenders` deleted, inverted, or
  // returning garbage. *A negative assertion must prove its observer is alive*,
  // in the one case that reads this flag over real pages.
  //
  // BOTH NUMBERS ARE ASSERTED AND BOTH ARE NON-ZERO, which is what keeps the
  // observer alive in both directions: 297 proves the flag can be true and 23
  // proves it can be false. A rule that counted everything, or nothing, is red
  // rather than silently turning every exact count into a floor — or every
  // floor into a number the page does not draw.
  assert.equal(counted, 297, "the corpus's established-count split moved — re-measure before moving this number");
  assert.equal(frames - counted, 23, "the corpus's uncertain count moved — these are the runtime-decided galleries");
  // ⚠ AND THE KEY SET IS PINNED, which is the guard for the defect above rather
  // than a second copy of it. The rename went unseen because every assertion
  // here reads a frame property BY NAME, and a name that no longer exists reads
  // as `undefined` rather than as an error — where `shownPhotos`' own cases
  // compare the whole object and would have gone red on the same move. One
  // `deepEqual` of the key set gives a frame the same protection: rename, add
  // or drop a field and this is red at one place, with the name that moved in
  // the message.
  const made = listFrames([{ path: "p.tsx", source: LIST_SHAPE_PAGE }]);
  assert.equal(made.length, 2, "the shape fixture drew no frames, so the key set below is asserted over nothing");
  assert.deepEqual(Object.keys(made[0]), ["page", "alt", "value", "empty", "counted"],
    "a frame's fields moved — every assertion in this file reads them BY NAME, so re-anchor them all: " +
    JSON.stringify(Object.keys(made[0])));
});
