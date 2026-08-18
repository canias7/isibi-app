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
  applyPictures, pictureReply, pictureUsage, runPictureEdit, readNeedsPlace,
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
  assert.match(block, /recompileAndPublish\(env, \{/, "a swap that is never published is a change the owner cannot see");
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
