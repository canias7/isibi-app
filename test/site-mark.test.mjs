// ONE MARK, SEVERAL FORMS (2026-09-07).
//
// Owner: *"instead of it being 3 things or 4 or 5, its gotta be one, wordmark,
// but it can be made in svg, etc etc etc"* → *"exactly yeah"*.
//
// A site's header mark was THREE fields with a precedence ladder — an uploaded
// picture in `config.logo`, a drawing in `look.wordmark`, the name in type under
// both — and the tab icon had the identical split. The precedence lived a layer
// away, in the container's baker, which is why run 41 could draw a wordmark on a
// site carrying an uploaded PNG, store it, publish a whole build, charge 2
// credits and report success for something no visitor could ever be shown.
//
// Now each mark is ONE field carrying a form. This file is the guard for the
// module that decides that, for the merge rule that replaced the ladder, and —
// at the bottom, DRIVEN through the real route — for the run-41 ask itself,
// which now simply works.
//
// THE FILE IT REPLACES. `test/upload-shadow.test.mjs` guarded the wall built for
// one morning between run 41 and this change: a free refusal whenever an upload
// stood in the way. The wall is gone (a form replaces a form), and the two
// things worth keeping from it are here — the pair DERIVED from the baker's own
// branches, and the driven route with the lane's tool COUNTED, inverted: the
// property was "the 292-second call is never made", and it is now "the call is
// made and the site really changes".
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  MARKS, MARK_FLOOR, MARK_FORMS, MARK_UPLOAD, MARK_WORDS, MARK_URL_RE,
  markUrlOk, isMark, markFloor, readMark, markOf, markUnder, markRemove,
  ownedMark, sameMark, markPayload, markWire, lookWithMarks, markWords,
} from "../builder/site-mark.mjs";
import { mergeLook, movedFields, EDIT_FIELDS, currentStateNote } from "../builder/site-edit.mjs";
import { loadWorker, makeCtx } from "./fixtures/worker-harness.mjs";
import { installCompiler, dispatchEnv, isDispatchUpload, dispatchOk } from "./fixtures/cf-containers.mjs";
import { CONFIG_KEY } from "../site-config.mjs";

const WORKER = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
const BAKER = fs.readFileSync(new URL("../builder/build-server.mjs", import.meta.url), "utf8");

/** Whole-line comments blanked, length preserved — the prose-spells-it trap. */
const blank = (src) => src.split("\n").map((l) => (/^\s*(\/\/|\*|\/\*)/.test(l) ? " ".repeat(l.length) : l)).join("\n");

const DRAWN = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 40"><text x="0" y="30">CGS</text></svg>';
const ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#332a26"/></svg>';
const UPLOAD = "/u/fretwork-1/96e1caf.png";

/* ── the pair, derived ───────────────────────────────────────────────────── */

test("THE PAIR IS THE BAKER'S OWN, in both directions", () => {
  // A hand-written `{wordmark: "logo"}` is a second copy of a rule that lives in
  // `writeSiteBrand`, and this repo's recorded trap is that two copies drift in
  // silence. So the pair is read OUT of the baker's two branches and compared
  // both ways: a third mark the baker grows must appear here, and this map may
  // not name one the baker does not have.
  //
  // AND THE BAKER'S LADDER IS STILL THERE ON PURPOSE. It re-validates whatever
  // it is handed, because it also serves hand-written payloads and survives
  // version skew. What changed is that the Worker resolves the form first and
  // sends only ONE half of each pair, so the ladder can never fire — see the
  // projection test below, which is what stops this being a dead precedence
  // rotting in place.
  const b = blank(BAKER);
  assert.ok(/if\s*\(\s*!logoValue\s*\)\s*\{/.test(b), "the baker stopped gating the wordmark on the uploaded logo");
  assert.ok(/if\s*\(\s*!icon\s*\)\s*\{/.test(b), "the baker stopped gating the favicon on the uploaded icon");
  const wmBody = b.slice(b.indexOf("if (!logoValue) {"), b.indexOf("\n  }", b.indexOf("if (!logoValue) {")));
  assert.match(wmBody, /readWordmark\(/, "the !logoValue branch no longer draws the wordmark");
  const fvBody = b.slice(b.indexOf("if (!icon) {"), b.indexOf("\n  }", b.indexOf("if (!icon) {")));
  assert.match(fvBody, /cleanFavicon\(/, "the !icon branch no longer draws the favicon");

  assert.deepEqual(MARK_UPLOAD, { wordmark: "logo", favicon: "icon" },
    "MARK_UPLOAD no longer matches the baker's two branches");
  assert.deepEqual([...MARKS], Object.keys(MARK_UPLOAD), "a mark with no upload key, or an upload key for no mark");
  for (const f of MARKS) {
    assert.ok(MARK_FLOOR[f], f + " has no floor, so a site with nothing stored resolves to nothing");
    assert.ok(MARK_WORDS[f], f + " has no customer-facing word");
    assert.ok(MARK_FORMS[f].includes("image") && MARK_FORMS[f].includes("svg") && MARK_FORMS[f].includes(MARK_FLOOR[f]),
      f + " cannot take all three forms");
  }
  // EVERY MARK IS AN EDIT FIELD, or the merge drops it and a mark set today is
  // gone by the next colour change. This is the invariant that INVERTED with
  // this change: the marks used to be kept OFF the look for exactly that reason.
  for (const f of MARKS) assert.ok(EDIT_FIELDS.includes(f), f + " is not on EDIT_FIELDS");
});

/* ── reading one value ───────────────────────────────────────────────────── */

test("readMark takes the new shape and the old one, and refuses everything else", () => {
  assert.deepEqual(readMark("wordmark", { form: "text" }), { form: "text" });
  assert.deepEqual(readMark("favicon", { form: "initials" }), { form: "initials" });
  assert.deepEqual(readMark("wordmark", { form: "image", url: UPLOAD }), { form: "image", url: UPLOAD });
  assert.equal(readMark("wordmark", { form: "svg", svg: DRAWN }).form, "svg");
  // THE LEGACY SHAPE, which is what every live site holds today.
  assert.deepEqual(readMark("wordmark", "text"), { form: "text" }, "the old `text` answer stopped reading");
  assert.equal(readMark("wordmark", DRAWN).form, "svg", "an old drawn wordmark stopped reading");
  assert.equal(readMark("favicon", ICON).form, "svg", "an old drawn favicon stopped reading");
  // `text` is the WORDMARK's floor and the favicon never had one, so a favicon
  // holding the literal string is a document that does not parse, not a choice.
  assert.equal(readMark("favicon", "text"), null, "`text` is not a favicon answer");
  // Refusals.
  for (const bad of [null, undefined, "", "   ", 7, [], ["text"], { form: "gif" }, { form: "image" },
                     { form: "image", url: "javascript:x" }, { form: "svg" }, { form: "svg", svg: "<svg onload=x>" }]) {
    assert.equal(readMark("wordmark", bad), null, "accepted " + JSON.stringify(bad));
  }
  // `{}["constructor"]` is truthy — the recorded trap, asked with `hasOwn`.
  assert.equal(readMark("wordmark", { form: "constructor" }), null);
  assert.equal(readMark("wordmark", Object.create({ form: "text" })), null, "a form read off the prototype");
  assert.equal(readMark("nonsense", { form: "text" }), null, "a field that is not a mark");
  // `String(["a"])` is `"a"` — refused, never coerced.
  assert.equal(readMark("wordmark", { form: "image", url: [UPLOAD] }), null);
});

test("a drawing is re-validated, so a stored document that is no longer acceptable reads as no mark", () => {
  // The readers rewrite the `<svg>` element (width/height baked off the
  // viewBox), so a valid answer never comes back byte-identical — which is why
  // every comparison in this file goes through `sameMark` rather than `===`.
  const got = readMark("wordmark", DRAWN);
  assert.match(got.svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="160" height="40"/,
    "the wordmark is not sized from its own viewBox — the header constrains by height");
  assert.match(readMark("favicon", ICON).svg, /width="64" height="64"/, "the favicon is not forced square");
  assert.equal(readMark("wordmark", '<svg viewBox="0 0 10 10"><script>x</script></svg>'), null);
});

/* ── the fold ────────────────────────────────────────────────────────────── */

test("THE FOLD KEEPS THE OLD PRECEDENCE EXACTLY — fretwork-1's own shape", () => {
  // The site run 41 ran on: an uploaded PNG in `config.logo` since run 16, and
  // the wordmark the lane drew stored under it in `look.wordmark`. What it
  // SERVES is the upload, and the fold has to answer that or the next publish
  // takes a customer's own logo off.
  const live = { logo: UPLOAD, look: { brand: "Crookes Guitar School", wordmark: DRAWN } };
  assert.deepEqual(markOf(live, "wordmark"), { form: "image", url: UPLOAD },
    "the fold inverted the ladder — this publishes the drawn mark over the owner's uploaded logo");
  assert.equal(markUnder(live, "wordmark").form, "svg", "what the upload is hiding is not readable");
  // The drawing alone, and the floor.
  assert.equal(markOf({ look: { wordmark: DRAWN } }, "wordmark").form, "svg");
  assert.deepEqual(markOf({ look: { wordmark: "text" } }, "wordmark"), { form: "text" });
  assert.deepEqual(markOf({}, "wordmark"), { form: "text" }, "a site with nothing resolves to nothing");
  assert.deepEqual(markOf({}, "favicon"), { form: "initials" });
  assert.deepEqual(markOf(null, "wordmark"), { form: "text" }, "an unreadable config is not a crash");
  // A FORM ALREADY WRITTEN STOPS THE FOLD, so a mark set through the new door is
  // never overruled by an upload key the old one left behind.
  assert.deepEqual(markOf({ logo: UPLOAD, look: { wordmark: { form: "text" } } }, "wordmark"), { form: "text" });
  // …and an UNREADABLE form falls through to the old pair rather than to the
  // floor: cannot-tell must never read as nothing-there.
  assert.deepEqual(markOf({ logo: UPLOAD, look: { wordmark: { form: "gif" } } }, "wordmark"),
    { form: "image", url: UPLOAD });
  assert.equal(markUnder({ look: { wordmark: { form: "image", url: UPLOAD } } }, "wordmark"), null,
    "a site on the new shape has something under its one value");
});

test("a removal drops the top form: the drawing on a legacy site, the floor otherwise", () => {
  const legacy = { logo: UPLOAD, look: { wordmark: DRAWN } };
  assert.equal(markRemove(legacy, "wordmark").form, "svg",
    "taking the upload off a legacy site does not reveal the drawing the ladder was hiding");
  assert.deepEqual(markRemove({ look: { wordmark: { form: "image", url: UPLOAD } } }, "wordmark"), { form: "text" },
    "with one field there is nothing under the value — a removal must fall to the floor");
  assert.deepEqual(markRemove({ icon: UPLOAD, look: {} }, "favicon"), { form: "initials" });
  assert.deepEqual(markRemove(null, "wordmark"), { form: "text" }, "an unreadable config is not a crash");
});

test("ownedMark IS the image form, in both directions", () => {
  // The one question the old precedence was really asking. It is DERIVED from
  // the form because the two are the same fact: a model cannot mint an upload
  // URL, and an uploaded SVG is refused, so `image` is exactly "a person sent
  // us a file". Asserted over every form rather than by naming one, so a fourth
  // form has to decide this deliberately.
  for (const f of MARKS) {
    for (const form of MARK_FORMS[f]) {
      assert.equal(ownedMark({ form }), form === "image",
        "`" + form + "` on " + f + " answers the wrong side of a-model-must-not-outrank-a-person");
    }
  }
  assert.equal(ownedMark(null), false);
  assert.equal(ownedMark({}), false);
});

test("lookWithMarks resolves both marks and leaves nothing-stored as nothing", () => {
  const out = lookWithMarks({ logo: UPLOAD, look: { brand: "CGS", theme: "broadsheet", wordmark: DRAWN } });
  assert.equal(out.brand, "CGS", "the other look keys did not survive");
  assert.equal(out.theme, "broadsheet");
  assert.deepEqual(out.wordmark, { form: "image", url: UPLOAD });
  assert.deepEqual(out.favicon, { form: "initials" });
  // NOTHING STORED STAYS NOTHING. `markOf` never answers null, so an
  // unconditional spread turns a site with no look into a truthy object — and
  // the edit path's "a site may have a stylesheet and a thin look" gate keys on
  // `!priorLook`. The first cut did exactly that and stopped refusing a site
  // with neither a look nor a stylesheet.
  assert.equal(lookWithMarks({}), undefined, "an absent look became an object");
  assert.equal(lookWithMarks({ look: null }), null);
  // …but a site whose ONLY stored thing is an upload still resolves.
  assert.deepEqual(lookWithMarks({ logo: UPLOAD }).wordmark, { form: "image", url: UPLOAD });
});

/* ── the wire ────────────────────────────────────────────────────────────── */

test("THE PROJECTION SENDS ONE HALF OF EACH PAIR, so the baker's ladder can never fire", () => {
  // The container keeps its own precedence as a belt (it takes hand-written
  // payloads and survives version skew). This is what stops that belt being a
  // dead gate rotting in place: exactly one of `logo`/`wordmark` and one of
  // `icon`/`favicon` is ever a value on the wire.
  const cases = [
    [{ logo: UPLOAD }, "wordmark", { logo: UPLOAD, wordmark: undefined }],
    [{ look: { wordmark: "text" } }, "wordmark", { logo: "", wordmark: "text" }],
    [{}, "favicon", { icon: "", favicon: undefined }],
    [{ icon: UPLOAD }, "favicon", { icon: UPLOAD, favicon: undefined }],
  ];
  for (const [config, field, want] of cases) {
    assert.deepEqual(markPayload(field, markOf(config, field)), want, JSON.stringify(config));
  }
  const drawn = markPayload("wordmark", markOf({ look: { wordmark: DRAWN } }, "wordmark"));
  assert.equal(drawn.logo, "", "a drawn wordmark also sends an upload — the baker's ladder would decide");
  assert.match(drawn.wordmark, /<svg/);
  // ALL FOUR FIELDS, ALWAYS. Every one of them has been the site of a "read
  // here and never put on the wire" bug, because the container rewrites
  // `public/` and `site-brand.ts` from pristine copies on every build.
  assert.deepEqual(Object.keys(markWire({ logo: UPLOAD, icon: UPLOAD })).sort(),
    ["favicon", "icon", "logo", "wordmark"]);
  const wire = markWire({ logo: UPLOAD, look: { favicon: ICON } });
  assert.equal(wire.logo, UPLOAD);
  assert.equal(wire.wordmark, undefined, "both halves of the header pair are values");
  assert.equal(wire.icon, "");
  assert.match(wire.favicon, /<svg/);
});

test("the customer's word for each form, per mark", () => {
  assert.match(markWords("wordmark", { form: "image" }), /logo you sent/);
  assert.match(markWords("favicon", { form: "image" }), /icon you sent/);
  assert.match(markWords("wordmark", { form: "text" }), /name in type/);
  assert.match(markWords("favicon", { form: "initials" }), /initials/);
  assert.notEqual(markWords("wordmark", { form: "svg" }), markWords("favicon", { form: "svg" }),
    "one sentence for both marks — a customer cannot tell which was changed");
  assert.ok(markWords("wordmark", null), "a missing mark has no words at all");
});

/* ── the merge, which is where the ladder went ───────────────────────────── */

test("A MODEL MUST NOT OUTRANK A PERSON — a volunteered mark leaves an uploaded one alone", () => {
  // The owner's rule, 2026-08-28, moved out of the container and into the merge.
  // A DESIGN STEP answers every field whether or not anybody mentioned it, so a
  // rebuild must not redraw somebody's uploaded logo away — run 16 is that case,
  // and only the baker's precedence saved it.
  const owned = { wordmark: { form: "image", url: UPLOAD }, favicon: { form: "image", url: UPLOAD } };
  const volunteered = mergeLook(owned, { wordmark: DRAWN, favicon: ICON }, null, { instructed: true });
  assert.deepEqual(volunteered.wordmark, owned.wordmark, "a rebuild redrew the owner's uploaded logo away");
  assert.deepEqual(volunteered.favicon, owned.favicon, "a rebuild redrew the owner's uploaded icon away");
  // …AND AN EDIT LANE REPLACES, which is the whole of run 41's fix: asking for a
  // new wordmark is asking for a new wordmark, even over a picture.
  const asked = mergeLook(owned, { wordmark: DRAWN }, null, { instructed: true, asked: true });
  assert.equal(asked.wordmark.form, "svg", "a lane the customer named could not replace an uploaded mark");
  assert.ok(sameMark(asked.wordmark, readMark("wordmark", DRAWN)));
  assert.deepEqual(asked.favicon, owned.favicon, "a wordmark ask moved the tab icon too");
  // THE DEFAULT PROTECTS. Being wrong toward "keep the person's file" costs an
  // edit that does not take effect and can be said again; being wrong toward
  // "replace" silently deletes artwork somebody uploaded.
  assert.deepEqual(mergeLook(owned, { wordmark: DRAWN }, null, {}).wordmark, owned.wordmark,
    "a caller that forgets the flag overwrites an upload");
  // And a mark that is NOT owned is replaced either way.
  const drawnPrior = { wordmark: readMark("wordmark", DRAWN) };
  const other = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 50"><text x="1" y="40">XYZ</text></svg>';
  assert.ok(sameMark(mergeLook(drawnPrior, { wordmark: other }, null, { instructed: true }).wordmark,
    readMark("wordmark", other)), "a design step could not replace a mark the model itself drew");
});

test("the merge normalises to a form, and an absent mark stays absent", () => {
  assert.deepEqual(mergeLook({}, { wordmark: "text" }, null, { instructed: true }).wordmark, { form: "text" });
  assert.equal(mergeLook({ wordmark: DRAWN }, {}, null, { instructed: true }).wordmark.form, "svg");
  // NULL IS NOT THE FLOOR. Normalising an absent mark into `{form:"text"}` made
  // `movedFields` report "the header logo changed" on the first edit of every
  // site that had never had one.
  assert.equal(mergeLook({}, {}, null, { instructed: true }).wordmark, null);
  assert.deepEqual(movedFields(mergeLook({}, {}, null, {}), mergeLook({}, {}, null, {})), []);
  // A LEGACY STRING AND ITS FORM ARE THE SAME MARK, so a site whose stored value
  // has not been normalised yet does not read as having changed.
  const prior = lookWithMarks({ look: { wordmark: DRAWN } });
  const merged = mergeLook(prior, {}, null, { instructed: true });
  assert.deepEqual(movedFields(prior, merged), [], "canonicalising a stored mark reads as a change");
});

test("the current-state note says which form, and prints a drawing whole", () => {
  assert.match(currentStateNote({ wordmark: { form: "image", url: UPLOAD } }), /uploaded/,
    "the note does not say the header carries a picture — the gap run 41 paid for");
  assert.match(currentStateNote({ favicon: { form: "image", url: UPLOAD } }), /uploaded/);
  const kept = readMark("wordmark", DRAWN).svg;
  assert.ok(currentStateNote({ wordmark: DRAWN }).includes(kept), "the note truncated or dropped a drawn mark");
  assert.match(currentStateNote({ wordmark: { form: "text" } }), /name in type/);
  assert.match(currentStateNote({ favicon: { form: "initials" } }), /initials/);
  // AND IT NEVER LEAKS THE UPLOAD'S ADDRESS to the model — there is nothing it
  // could do with one, and a URL in the note is a URL a model will echo.
  assert.ok(!currentStateNote({ wordmark: { form: "image", url: UPLOAD } }).includes(UPLOAD));
});

/* ── the Worker's hops ───────────────────────────────────────────────────── */

test("every publish path projects the marks, and every editing reader resolves them", () => {
  const w = blank(WORKER);
  assert.match(w, /marks = markWire\(cfg\.config\);/, "the spine does not project the marks");
  assert.match(w, /\.\.\.markWire\(\{ look \}\),/, "the build args do not project the marks off the merged look");
  // The four editing readers: the spine's own look, the build/revise path, the
  // lane path, the addon path. `lookWithMarks` is what puts an uploaded mark
  // where `mergeLook` can see it, which is what the `asked` rule needs.
  const folds = [...w.matchAll(/lookWithMarks\(/g)];
  assert.ok(folds.length >= 4, "only " + folds.length + " fold sites — an editing reader stopped resolving the marks");
  assert.match(w, /priorLook = lookWithMarks\(cfg\.config\);/, "the build path does not resolve the marks");
  assert.match(w, /aLook = lookWithMarks\(cfg\.config\);/, "the addon path does not resolve the marks");
  // The lane path is the one that must REPLACE.
  assert.match(w, /mergeLook\(priorLook, designed, \{\}, \{ instructed: true, asked: true \}\)/,
    "the lane merge stopped saying the customer asked — an uploaded mark can no longer be changed");
  // …and the design path must NOT.
  assert.match(w, /mergeLook\(priorLook, designed, body, \{ instructed: !!editState \}\)/,
    "the design merge started claiming the customer asked — a rebuild would wipe an uploaded logo");
});

test("the shadow wall is gone, and the observer proving that is alive", () => {
  // A negative assertion has to prove it is looking at something — `[].every()`
  // is `true`. So the picker block is found first and its size floored.
  const w = blank(WORKER);
  const at = w.indexOf('editTrace.mark("pick_lanes", picked.failed');
  const end = w.indexOf("const acting = pickedFields.filter((f) => OWN_LANES.includes(f));", at);
  assert.ok(at > 0 && end > at + 1000, "the picker block moved — rescope this guard");
  const block = w.slice(at, end);
  assert.ok(!/shadowedBy\(|shadowedRefusal\(/.test(block),
    "the shadow wall is back — a form replacing a form needs no wall, and this one charged nothing but refused the change");
  // The ADDON wall beside it is untouched: adding a thing the site lacks is
  // still the addon step's job.
  assert.match(block, /ADD_ONLY_FIELDS/, "the addon wall went with the shadow wall");
});

/* ── and the whole thing, driven ─────────────────────────────────────────── */
//
// Every case above the line reads or drives a module. This half runs the REAL
// edit route with the lane's tool COUNTED, because a source read certifies at
// the layer below the break — the trap that let run 41 happen with a green
// suite. The property is not that a refusal is gone; it is that the call is
// made and the site's stored mark really becomes the drawing.

const USER = { id: "u-mark-1", email: "owner@example.com" };
const HOME = { path: "src/routes/index.tsx", source: "export default function Home(){return <main><h1>Crookes Guitar School</h1></main>}" };
const LOOK = { brand: "Crookes Guitar School", theme: "broadsheet" };

async function syncEdit({ slug, config, instruction, fields }) {
  const store = new Map([
    ["source/" + slug + "/pages.json", JSON.stringify([HOME])],
    [CONFIG_KEY(slug), JSON.stringify(config)],
  ]);
  const writes = [];
  const obj = (v) => ({ text: async () => v, arrayBuffer: async () => new TextEncoder().encode(v).buffer });
  const b = {
    store, writes,
    async get(k) { const v = store.get(k); return v === undefined ? null : obj(v); },
    async put(k, v) { writes.push([k, String(v)]); store.set(k, String(v)); },
    async delete(k) { store.delete(k); },
    async list() { return { objects: [], truncated: false }; },
  };
  const tools = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const u = String((input && input.url) || input || "");
    const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
    if (u.includes("/auth/v1/user")) return json(USER);
    if (u.includes("/rpc/use_credits")) return json(50);
    if (u.includes("/rpc/get_credits")) return json(50);
    if (u.includes("/rest/v1/site_project")) return json([]);
    if (u.includes("/rest/v1/site_backends")) return json([{ uid: USER.id, brief: "" }]);
    if (u.includes("/v1/messages")) {
      let bj = {};
      try { bj = JSON.parse(String(init && init.body) || "{}"); } catch { bj = {}; }
      const tool = (bj.tool_choice && bj.tool_choice.name) || "";
      tools.push(tool);
      // ANSWERED PER FIELD, because each lane's tool has ONE property and an
      // answer naming a different field is no answer at all — the lane
      // escalates `no-change` and the case silently stops testing what it
      // says it does.
      const LANE_ANSWER = { wordmark: { wordmark: DRAWN }, favicon: { favicon: ICON }, description: { description: "Guitar lessons in Crookes, Sheffield." } };
      const answer = tool === "pick_lanes" ? { fields }
        : tool === "edit_site" ? LANE_ANSWER[fields[0]] || null
        : null;
      if (!answer) return new Response("no stub for tool " + tool, { status: 503 });
      return json({ stop_reason: "tool_use", content: [{ type: "tool_use", name: tool, input: answer }], usage: { input_tokens: 10, output_tokens: 5 } });
    }
    if (isDispatchUpload(u)) return dispatchOk();
    return new Response("unavailable", { status: 503 });
  };
  const c = installCompiler();
  try {
    const worker = await loadWorker();
    const req = new Request("https://gofarther.dev/api/site/" + slug + "/edit", {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: "Bearer some-token" },
      body: JSON.stringify({ layer: "look", page: "", remove: false, rename: "", tab: false, instruction, picker: "sonnet" }),
    });
    const res = await worker.fetch(req, { SITES_BUCKET: b, ANTHROPIC_API_KEY: "test-key", XAI_API_KEY: "test-key", ...dispatchEnv() }, makeCtx());
    const cfgText = store.get(CONFIG_KEY(slug));
    return {
      status: res.status, body: await res.json().catch(() => null), tools,
      // THE PAYLOAD AS THE CONTAINER RECEIVED IT — the compiler stub records
      // `{url, body}` per call, and `/build` is the only one that matters here.
      compiles: c.calls.length,
      payloads: c.calls.filter((x) => x && String(x.url).includes("/build")).map((x) => x.body || {}),
      stored: cfgText ? JSON.parse(cfgText) : null,
    };
  } finally { c.uninstall(); globalThis.fetch = real; }
}

test("DRIVEN: run 41's ask — a wordmark over an uploaded logo now RUNS and lands", async () => {
  const r = await syncEdit({
    slug: "mark-logo",
    config: { look: { ...LOOK }, logo: "/u/mark-logo/abc123.png" },
    instruction: "Redraw the header wordmark as the letters CGS in a bold serif",
    fields: ["wordmark"],
  });
  // THE CALL IS MADE. For one morning a wall refused this for free; the fix is
  // that there is nothing left to refuse.
  assert.ok(r.tools.includes("edit_site"),
    "the wordmark lane did not run — an uploaded logo still blocks it: " + JSON.stringify(r.body));
  assert.notEqual(r.status, 422, "the ask was refused: " + JSON.stringify(r.body));
  // AND THE SITE REALLY CHANGES. Run 41's whole defect was that the stored mark
  // moved and the page could not show it, so the stored form AND the wire are
  // both read.
  assert.equal(r.stored.look.wordmark.form, "svg", "the drawn wordmark was not stored as the site's mark");
  assert.ok(r.compiles > 0, "nothing was compiled");
  const p = r.payloads[r.payloads.length - 1];
  assert.match(String(p.wordmark || ""), /<svg/, "the container was not sent the new wordmark");
  assert.equal(p.logo, "", "the container was sent the upload as well — its own ladder would keep the picture");
});

test("DRIVEN: the favicon twin — an uploaded icon does not block a drawn one", async () => {
  const r = await syncEdit({
    slug: "mark-icon",
    config: { look: { ...LOOK }, icon: "/u/mark-icon/def456.png" },
    instruction: "Draw a new favicon, a plectrum",
    fields: ["favicon"],
  });
  assert.ok(r.tools.includes("edit_site"), "the favicon lane did not run: " + JSON.stringify(r.body));
  assert.equal(r.stored.look.favicon.form, "svg");
  const p = r.payloads[r.payloads.length - 1];
  assert.equal(p.icon, "", "the container was sent the uploaded icon beside the drawn one");
  assert.match(String(p.favicon || ""), /<svg/);
});

test("THE CONTROL — a site with no upload behaves exactly as it did", async () => {
  // Without this, a change that simply ignored the stored mark entirely would
  // pass every case above.
  const r = await syncEdit({
    slug: "mark-none",
    config: { look: { ...LOOK } },
    instruction: "Redraw the header wordmark as the letters CGS in a bold serif",
    fields: ["wordmark"],
  });
  assert.ok(r.tools.includes("edit_site"));
  assert.equal(r.stored.look.wordmark.form, "svg");
  assert.equal(r.payloads[r.payloads.length - 1].logo, "");
});

test("THE OTHER CONTROL — an unrelated lane never touches the marks", async () => {
  const r = await syncEdit({
    slug: "mark-desc",
    config: { look: { ...LOOK }, logo: "/u/mark-desc/abc.png" },
    instruction: "change the one-line description",
    fields: ["description"],
  });
  assert.ok(r.tools.includes("edit_site"), "the description lane was refused: " + JSON.stringify(r.body));
  assert.equal(r.stored.look.description, "Guitar lessons in Crookes, Sheffield.", "the lane did not land");
  // The uploaded logo is still what the site wears, and the container is still
  // sent it — the "anything a build bakes must be sent by the spine too" rule.
  assert.equal(markOf(r.stored, "wordmark").form, "image", "a colour change moved the header mark");
  assert.equal(r.payloads[r.payloads.length - 1].logo, "/u/mark-desc/abc.png",
    "an unrelated edit stopped sending the uploaded logo — the next publish takes it off");
});
