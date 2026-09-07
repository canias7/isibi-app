// A LANE WHOSE FIELD AN UPLOAD SHADOWS REFUSES BEFORE IT SPENDS (run 41).
//
// RUN 41 (2026-09-06) is why. The `wordmark` lane drew 612 characters of SVG on
// fretwork-1, stored it, published a whole new build, charged 2 credits and
// reported success — and the header kept the PNG it already had, because
// `writeSiteBrand` bakes a designed mark ONLY when the owner uploaded none. The
// precedence is deliberate ("a model must not outrank a person"); what was
// wrong is that the lane could not see it and billed for a change no visitor
// could ever be shown.
//
// THE GUARD THAT MATTERS IS THE DERIVATION. A hand-written `{wordmark: "logo"}`
// is a second copy of a rule that lives in the baker, and this repo's own
// recorded trap is that two copies drift silently. So the pair is read OUT of
// `build-server.mjs`'s two branches and compared both ways: a third shadowed
// field the baker grows must appear here, and this map may not name one the
// baker does not have.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { UPLOAD_SHADOWS, shadowedBy, shadowedRefusal } from "../builder/site-lanes.mjs";
import { loadWorker, makeCtx } from "./fixtures/worker-harness.mjs";
import { installCompiler, dispatchEnv, isDispatchUpload, dispatchOk } from "./fixtures/cf-containers.mjs";
import { CONFIG_KEY } from "../site-config.mjs";

const WORKER = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
const BAKER = fs.readFileSync(new URL("../builder/build-server.mjs", import.meta.url), "utf8");

/** Whole-line comments blanked, length preserved — this file's own scans forbid spellings. */
function blank(src) {
  return src.split("\n").map((l) => (/^\s*(\/\/|\*|\/\*)/.test(l) ? " ".repeat(l.length) : l)).join("\n");
}

test("THE PAIR IS THE BAKER'S OWN, in both directions", () => {
  const b = blank(BAKER);
  // The two branches, each named by the guard it opens with and the field it
  // then writes. Read as a property — "the designed X is written only when the
  // uploaded Y is absent" — rather than as a spelling of either line.
  const wordmarkGuarded = /if\s*\(\s*!logoValue\s*\)\s*\{/.test(b);
  const faviconGuarded = /if\s*\(\s*!icon\s*\)\s*\{/.test(b);
  assert.ok(wordmarkGuarded, "the baker stopped gating the wordmark on the uploaded logo — re-derive UPLOAD_SHADOWS");
  assert.ok(faviconGuarded, "the baker stopped gating the favicon on the uploaded icon — re-derive UPLOAD_SHADOWS");

  // Each branch really writes the field this map claims it does, so the pair is
  // anchored on the WRITE and not only on the guard above it.
  const wmAt = b.indexOf("if (!logoValue) {");
  const wmBody = b.slice(wmAt, b.indexOf("\n  }", wmAt));
  assert.match(wmBody, /readWordmark\(/, "the !logoValue branch no longer draws the wordmark");
  const fvAt = b.indexOf("if (!icon) {");
  const fvBody = b.slice(fvAt, b.indexOf("\n  }", fvAt));
  assert.match(fvBody, /cleanFavicon\(/, "the !icon branch no longer draws the favicon");

  assert.deepEqual(UPLOAD_SHADOWS, { wordmark: "logo", favicon: "icon" },
    "UPLOAD_SHADOWS no longer matches the baker's two branches");
});

test("shadowedBy answers only for a shadowed field, and never off the prototype", () => {
  assert.equal(shadowedBy("wordmark"), "logo");
  assert.equal(shadowedBy("favicon"), "icon");
  assert.equal(shadowedBy("css"), "");
  assert.equal(shadowedBy("theme"), "");
  // `X["constructor"]` is truthy — the recorded trap, shipped three times here.
  assert.equal(shadowedBy("constructor"), "");
  assert.equal(shadowedBy("toString"), "");
  assert.equal(shadowedBy("__proto__"), "");
});

test("THE SENTENCE NAMES THE UPLOAD, SAYS NOTHING WAS CHARGED, AND OFFERS A REAL WAY THROUGH", () => {
  const wm = shadowedRefusal("wordmark");
  assert.match(wm, /logo you uploaded/, "the sentence does not name what is in the way");
  assert.match(wm, /header/, "the sentence does not say where");
  assert.match(wm, /weren't charged/, "the sentence does not say the refusal was free");
  assert.match(wm, /take the logo off/, "the sentence does not offer the way through");
  assert.doesNotMatch(wm, /favicon|tab icon/, "the wordmark sentence talks about the icon");

  const fv = shadowedRefusal("favicon");
  assert.match(fv, /icon you uploaded/);
  assert.match(fv, /tab icon/, "the favicon sentence does not say where");
  assert.match(fv, /take the icon off/);
  assert.doesNotMatch(fv, /header/, "the favicon sentence talks about the header");

  assert.equal(shadowedRefusal("css"), "", "a field nothing shadows must have no sentence");
});

test("THE OFFER IS ONE THE PRODUCT CAN KEEP — the logo rung really removes", () => {
  // The recorded trap is a hint promising a mechanism nobody built (the qr
  // lane's "also taking it off the site"). This sentence offers a removal, so
  // the removal has to exist: `runLogoEdit` takes `remove` and acts on it.
  const logo = fs.readFileSync(new URL("../builder/site-logo.mjs", import.meta.url), "utf8");
  assert.match(logo, /export async function runLogoEdit\([^)]*\{[^)]*remove/,
    "runLogoEdit stopped taking `remove` — the refusal sentence now promises something that is gone");
  assert.match(blank(logo), /if\s*\(\s*remove\s*===\s*true\s*\)/,
    "runLogoEdit no longer acts on `remove`");
  // And the edit route still hands it in, or the customer's second sentence
  // reaches a rung that ignores it.
  assert.match(WORKER, /remove:\s*eb\s*&&\s*eb\.remove\s*===\s*true/,
    "the edit route stopped handing `remove` to the logo rung");
});

test("THE WALL IS AT THE PICKER, BEFORE ANY LANE RUNS", () => {
  const b = blank(WORKER);
  const pickOk = b.indexOf('editTrace.mark("pick_lanes", picked.failed');
  const wall = b.indexOf("const up = shadowedBy(f);");
  const acting = b.indexOf("const acting = pickedFields.filter((f) => OWN_LANES.includes(f));");
  assert.ok(pickOk > 0 && wall > 0 && acting > 0, "a landmark moved — rescope this guard");
  assert.ok(wall > pickOk, "the wall runs before the picker has answered");
  assert.ok(wall < acting, "the wall runs AFTER the lanes are queued — it must refuse before any lane is bought");
});

test("A CONFIG THAT COULD NOT BE READ LETS THE LANE RUN", () => {
  const b = blank(WORKER);
  const at = b.indexOf("const up = shadowedBy(f);");
  const open = b.lastIndexOf("if (wallConfig) {", at);
  assert.ok(open > 0 && open < at, "the wall is no longer gated on a config that was actually read");
  // The catch must null it rather than leaving a partial object behind.
  assert.match(b, /catch\s*\{\s*wallConfig\s*=\s*null;\s*wallLook\s*=\s*null;\s*\}/,
    "a failed config read no longer clears wallConfig — cannot-tell would read as an upload being present");
});

test("A CLEARED UPLOAD IS NOT AN UPLOAD — empty string must not refuse", () => {
  const b = blank(WORKER);
  const at = b.indexOf("const held = wallConfig[up];");
  assert.ok(at > 0, "the wall's read moved — rescope this guard");
  const cond = b.slice(at, at + 260);
  assert.match(cond, /typeof held === "string" && held\.trim\(\)/,
    "the wall reads the upload by truthiness — the logo rung CLEARS by writing \"\", which would then refuse for ever");
});

test("the refusal is free, terminal, and carries the sentence", () => {
  const b = blank(WORKER);
  const at = b.indexOf("const up = shadowedBy(f);");
  const end = b.indexOf("\n              }", at);
  assert.ok(at > 0 && end > at, "the wall moved — rescope this guard");
  const body = b.slice(at, end);
  assert.match(body, /cost:\s*0/, "the refusal charges for a change it refused to make");
  assert.match(body, /msg:\s*shadowedRefusal\(f\)/, "the refusal does not carry the customer's sentence");
  assert.match(body, /status:\s*422/, "the refusal is not a 422");
  assert.doesNotMatch(body, /escalate\(/,
    "the refusal escalates — this is a sentence, not a climb: the rung above cannot show the mark either");
});

// ── AND THE SAME WALL, DRIVEN ──────────────────────────────────────────────
//
// Every case above reads source, which certifies at the layer below the break
// — this repo's own recorded trap, and the one that let run 41 happen with a
// green suite. So the wall is also RUN, through the real route, with the lane's
// tool stubbed and COUNTED: the property that matters is not that the refusal
// exists but that the 292-second call is the thing never made.
const USER = { id: "u-shadow-1", email: "owner@example.com" };
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
      const answer = tool === "pick_lanes" ? { fields }
        : tool === "edit_site" ? { wordmark: { svg: "<svg viewBox='0 0 120 40'><text>CGS</text></svg>" } }
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
    return { status: res.status, body: await res.json().catch(() => null), tools, compiles: c.calls.length, writes: writes.length };
  } finally { c.uninstall(); globalThis.fetch = real; }
}

test("DRIVEN: a wordmark ask on a site with an uploaded logo is refused free, and the lane never runs", async () => {
  const r = await syncEdit({
    slug: "shadow-logo",
    config: { look: { ...LOOK }, logo: "/u/shadow-logo/abc123.png" },
    instruction: "Redraw the header wordmark as the letters CGS in a bold serif",
    fields: ["wordmark"],
  });
  assert.equal(r.status, 422, "the refusal is not a 422: " + JSON.stringify(r.body));
  assert.equal(r.body && r.body.ok, false);
  assert.equal(r.body && r.body.cost, 0, "run 41's 2 credits are still being charged");
  assert.match(String((r.body && r.body.msg) || ""), /logo you uploaded/, "the customer is not told what is in the way");
  // THE POINT OF THE WHOLE CHANGE: the expensive call is the one not made.
  assert.ok(!r.tools.includes("edit_site"),
    "the wordmark lane RAN — this is run 41 again, 292 seconds and a credit for a change nobody can see");
  assert.equal(r.compiles, 0, "a container compiled for a change that cannot be shown");
  assert.equal(r.writes, 0, "the site was written to");
});

test("DRIVEN: the favicon has the same wall — an uploaded icon refuses it free", async () => {
  const r = await syncEdit({
    slug: "shadow-icon",
    config: { look: { ...LOOK }, icon: "/u/shadow-icon/def456.png" },
    instruction: "Draw a new favicon, a plectrum",
    fields: ["favicon"],
  });
  assert.equal(r.status, 422, JSON.stringify(r.body));
  assert.equal(r.body && r.body.cost, 0);
  assert.match(String((r.body && r.body.msg) || ""), /icon you uploaded/);
  assert.ok(!r.tools.includes("edit_site"), "the favicon lane ran behind an uploaded icon");
});

test("THE CONTROL — with no upload the lane runs exactly as before", async () => {
  // Without this the wall could refuse everything and every case above would
  // still pass. A site with no logo must reach the lane.
  const r = await syncEdit({
    slug: "shadow-none",
    config: { look: { ...LOOK } },
    instruction: "Redraw the header wordmark as the letters CGS in a bold serif",
    fields: ["wordmark"],
  });
  assert.ok(r.tools.includes("edit_site"),
    "the wall refuses a site that has NO upload — every wordmark edit on the platform is now dead: " + JSON.stringify(r.body));
  assert.notEqual(r.status, 422, "a site with no upload was refused: " + JSON.stringify(r.body));
});

test("THE OTHER CONTROL — a cleared upload is not an upload", async () => {
  // The logo rung clears by writing "", so the key is present and empty. That
  // must read as no upload, or a customer who removed their logo can never ask
  // for a wordmark again.
  const r = await syncEdit({
    slug: "shadow-cleared",
    config: { look: { ...LOOK }, logo: "" },
    instruction: "Redraw the header wordmark as the letters CGS in a bold serif",
    fields: ["wordmark"],
  });
  assert.ok(r.tools.includes("edit_site"),
    "an empty logo string read as an upload — a cleared logo locks the wordmark lane out for ever");
});

test("a lane nothing shadows is untouched by the wall", async () => {
  const r = await syncEdit({
    slug: "shadow-css",
    config: { look: { ...LOOK }, logo: "/u/shadow-css/abc.png" },
    instruction: "make the footer white",
    fields: ["css"],
  });
  assert.ok(r.tools.includes("edit_site"), "the css lane was refused behind an uploaded logo: " + JSON.stringify(r.body));
});
