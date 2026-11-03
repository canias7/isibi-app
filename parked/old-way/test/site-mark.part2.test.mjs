// PARKED (2026-11-03, park-old-way): the old-way half of test/site-mark.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
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
} from "../../../builder/site-mark.mjs";
import { mergeLook, movedFields, EDIT_FIELDS, currentStateNote } from "../../../builder/site-edit.mjs";
import { loadWorker, makeCtx } from "../../../test/fixtures/worker-harness.mjs";
import { installCompiler, dispatchEnv, isDispatchUpload, dispatchOk } from "../../../test/fixtures/cf-containers.mjs";
import { CONFIG_KEY } from "../../../site-config.mjs";

import { siteIconFrom } from "../../../builder/site-identity.mjs";

const WORKER = fs.readFileSync(new URL("../../../worker.js", import.meta.url), "utf8");
const BAKER = fs.readFileSync(new URL("../../../builder/build-server.mjs", import.meta.url), "utf8");

/** Whole-line comments blanked, length preserved — the prose-spells-it trap. */
const blank = (src) => src.split("\n").map((l) => (/^\s*(\/\/|\*|\/\*)/.test(l) ? " ".repeat(l.length) : l)).join("\n");

const DRAWN = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 40"><text x="0" y="30">CGS</text></svg>';
const ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#332a26"/></svg>';
const UPLOAD = "/u/fretwork-1/96e1caf.png";

test("the route's save answers the form it stored", () => {
  // Without this the sentence above is handed `undefined` for ever and every
  // removal claims the floor — the mutant that survived the first sweep.
  const w = blank(WORKER);
  const at = w.indexOf("save: async (patch) => {");
  assert.ok(at > 0, "the logo rung's save dep is gone");
  const body = w.slice(at, w.indexOf("\n                },", at));
  assert.match(body, /const next = url \? \{ form: "image", url \} : markRemove\(c\.config, field\);/,
    "the rung no longer computes the form it is about to store");
  assert.match(body, /\n\s+return next;\s*$/,
    "the save answers nothing, so a removal cannot say what the mark fell back to");
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
  //
  // RE-ANCHORED 2026-09-08, merging the removal verb onto this work, and the
  // spelling that moved is the OPTIONS OBJECT rather than the rule: that call
  // now carries a third option (`clear`, which lanes are removals), so a
  // pattern pinning the object's exact two-key shape reported "an uploaded mark
  // can no longer be changed" about a call that still says exactly that. The
  // property was never the object's arity — it is that THIS call, the lane
  // path's, passes `asked: true`. Matched inside the call now, with the call
  // itself asserted first so a deleted hop cannot pass as a satisfied absence.
  const laneMerge = w.match(/mergeLook\(priorLook, designed, \{\}, \{([^}]*)\}\)/);
  assert.ok(laneMerge, "the lane path's merge call is gone");
  assert.match(laneMerge[1], /\basked: true\b/,
    "the lane merge stopped saying the customer asked — an uploaded mark can no longer be changed");
  assert.match(laneMerge[1], /\binstructed: true\b/, "the lane merge stopped being instructed");

  // A NAMED REMOVAL TAKES AN UPLOADED MARK OFF — the one question the 2026-09-08
  // merge had to answer, since `asked` and `clear` arrived from two branches and
  // meet on this field.
  //
  // AND THE FIRST DRAFT OF THIS COMMENT WAS WRONG ABOUT WHY, which the merge's
  // own sweep caught: it said the wipe running FIRST is what makes it true. It
  // is not. On the lane path — the only caller that passes `clear` at all —
  // `asked: true` rides with it, and that alone disables the upload guard, so
  // the two rules never actually compete there and their ORDER is unobservable
  // from any call site the Worker makes. The mutant that swapped them survived
  // for exactly that reason, and is INERT against the product rather than a
  // guard gap.
  //
  // The order IS observable in the exported function, which is driven directly
  // and by more than the Worker, so it is driven here in the shape that shows
  // it: `clear` with NO `asked`. Both cases are asserted, because the property
  // customers have is the first and the property the function promises is the
  // second, and neither implies the other.
  const owned = { wordmark: { form: "image", url: "https://x.gofarther.app/u/logo.png" } };
  assert.equal(
    mergeLook(owned, {}, {}, { instructed: true, asked: true, clear: ["wordmark"] }).wordmark, null,
    "a named removal on the lane path left an uploaded mark standing — 'take the logo off' would answer done and change nothing");
  assert.equal(
    mergeLook(owned, {}, {}, { instructed: true, clear: ["wordmark"] }).wordmark, null,
    "the upload guard beat a named removal — the wipe must come first, or a caller that clears without asking is refused silently");
  // The control, so both of those are about the REMOVAL and not about the mark
  // guard having quietly stopped working: with nothing named, the same uploaded
  // mark is still protected from a design step that did not ask.
  assert.deepEqual(
    mergeLook(owned, { wordmark: DRAWN }, {}, { instructed: true }).wordmark, owned.wordmark,
    "the upload guard stopped protecting a mark nobody asked to change");
  // …and the design path must NOT.
  // RE-ANCHORED 2026-10-22 (combine): audit #56 folds the QR list first, so
  // the merge reads `qrFolded`; the property (no `asked`) is unchanged.
  assert.match(w, /mergeLook\(priorLook, (?:designed|qrFolded), body, \{ instructed: !!editState \}\)/,
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
