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
import { runLogoEdit } from "../builder/site-logo.mjs";
import { siteIconFrom } from "../../../builder/site-identity.mjs";

const WORKER = fs.readFileSync(new URL("../../../worker.js", import.meta.url), "utf8");
const BAKER = fs.readFileSync(new URL("../../../builder/build-server.mjs", import.meta.url), "utf8");

/** Whole-line comments blanked, length preserved — the prose-spells-it trap. */
const blank = (src) => src.split("\n").map((l) => (/^\s*(\/\/|\*|\/\*)/.test(l) ? " ".repeat(l.length) : l)).join("\n");

const DRAWN = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 40"><text x="0" y="30">CGS</text></svg>';
const ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#332a26"/></svg>';
const UPLOAD = "/u/fretwork-1/96e1caf.png";

/* ── the removal's sentence ──────────────────────────────────────────────── */

test("A REMOVAL SAYS WHAT THE MARK FELL BACK TO, asked rather than assumed", async () => {
  // This file used to promise the floor unconditionally — "the header shows your
  // name again" — which is a sentence about a site nobody had looked at. With one
  // field per mark, what a removal reveals is whatever form is LEFT, and on a
  // site still carrying the old pair that is the drawing the upload was hiding.
  //
  // THE WHOLE CHAIN IS DRIVEN, because three separate mutants survived a sweep
  // that only read it: the rung throwing the stored form away, the sentence
  // ignoring it, and the route's save answering nothing at all.
  const runs = [];
  const run = (left) => runLogoEdit({
    save: async (patch) => { runs.push(patch); return left; },
    publish: async () => ({ ok: true, files: 3 }),
  }, { remove: true });

  const revealed = await run({ form: "svg", svg: readMark("wordmark", DRAWN).svg });
  assert.equal(revealed.ok, true);
  assert.match(revealed.msg, /drawn wordmark/,
    "a removal that revealed a drawing told the customer their name is in type: " + revealed.msg);
  assert.deepEqual(revealed.left, { form: "svg", svg: readMark("wordmark", DRAWN).svg },
    "the rung threw away the form the store answered with");

  const floored = await run({ form: "text" });
  assert.match(floored.msg, /name in type/, floored.msg);
  const icon = await runLogoEdit({
    save: async () => ({ form: "initials" }), publish: async () => ({ ok: true, files: 3 }),
  }, { remove: true, tab: true });
  assert.match(icon.msg, /tab icon off/);
  assert.match(icon.msg, /initials/, icon.msg);

  // A DEP THAT ANSWERS NOTHING gets the floor's wording, which is what this
  // always said — so an older caller is not made worse, only a knowing one better.
  const quiet = await run(undefined);
  assert.match(quiet.msg, /name in type/);
  // …and the rung still clears the slot the module chose.
  assert.deepEqual(runs[0], { logo: "" });
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
