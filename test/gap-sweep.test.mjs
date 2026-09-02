// Guards for scripts/gap-sweep.mjs — the harness that drives the parts of the
// edit path the lane sweep cannot reach. Kept to properties, not spellings.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import zlib from "node:zlib";
import { CASES, chooseCases, tinyPng, tinyPngDataUrl, addedRoute } from "../scripts/gap-sweep.mjs";
import { CASES as LANE_CASES, confirmed } from "../scripts/lane-sweep.mjs";
import { EDIT_LAYERS } from "../builder/site-ask.mjs";
import { PAGE_VERBS } from "../builder/site-lanes.mjs";

const SRC = readFileSync(new URL("../scripts/gap-sweep.mjs", import.meta.url), "utf8");
const WF = readFileSync(new URL("../.github/workflows/gap-sweep.yml", import.meta.url), "utf8");

// ── THE CASES ARE THE GAPS, AND ONLY THE GAPS ─────────────────────────────
//
// Every `via` that posts a layer names one the edit route actually has (or the
// two non-layer doors, the router and the addon route). A case that posted a
// layer the route does not know would fall through to `escalate("layer")` for
// nothing and read as a pass — the first paid canary's exact failure.
test("every case enters through a real door", () => {
  assert.ok(CASES.length >= 8, "the case table has shrunk");
  for (const c of CASES) {
    assert.ok(["route", "addon", ...EDIT_LAYERS].includes(c.via), `${c.name}: via "${c.via}" is not a layer, the router or the addon route`);
    assert.ok(["main", "db"].includes(c.where), `${c.name}: where "${c.where}"`);
    assert.ok(["site", "reply"].includes(c.judged), `${c.name}: judged must say site or reply`);
    assert.equal(typeof c.check, "function", `${c.name}: no check`);
    assert.ok(typeof c.ask === "string" || typeof c.ask === "function", `${c.name}: no ask`);
  }
});

test("the gaps are exactly the rungs and behaviours the lane sweep cannot reach", () => {
  const names = CASES.map((c) => c.name);
  // Rungs with no lane of their own — a message never reaches them through
  // the lane picker, so the lane table cannot cover them.
  for (const rung of ["text", "logo", "data", "rules"]) assert.ok(names.includes(rung), `no case for the ${rung} rung`);
  // The two page verbs the lane sweep only pointed at.
  for (const verb of PAGE_VERBS.filter((v) => v !== "add")) assert.ok(names.includes(verb), `no case for the page verb ${verb}`);
  // What `pages add` points at, run for real this time.
  assert.ok(names.includes("addon"), "no addon case");
  // A behaviour of the queue, not of a rung.
  const cancel = CASES.find((c) => c.name === "cancel");
  assert.ok(cancel && cancel.cancel === true, "no cancel case, or it does not cancel");
  assert.equal(CASES.filter((c) => c.cancel).length, 1, "exactly one case cancels its own job");
  // And no case duplicates a lane the lane sweep already proves on the same
  // site: `backend` appears here only because it runs on a DATABASE site.
  const laneNames = new Set(LANE_CASES.map((c) => c.lane));
  for (const c of CASES) {
    if (!laneNames.has(c.name)) continue;
    assert.equal(c.where, "db", `${c.name} is a lane the lane sweep already runs on the main site; here it must run on the db site`);
  }
});

// THE ADDON ROUTE REFUSES A SITE WITHOUT A DATABASE (`no-backend`, before any
// model call), so the addon page and the two verbs that act on it can only run
// on the database site — and the frontend-only site gets a free probe that
// records the refusal rather than a case that reads it as a failure.
test("each case runs on the site that can answer it", () => {
  const main = ["text", "logo", "cancel", "addon-nodb"];
  const db = ["addon", "move", "remove", "data", "rules", "backend"];
  for (const c of CASES) {
    assert.ok(main.includes(c.name) || db.includes(c.name), `${c.name} is not placed`);
    assert.equal(c.where, main.includes(c.name) ? "main" : "db", `${c.name} is on the wrong site`);
  }
  const probe = CASES.find((c) => c.name === "addon-nodb");
  assert.deepEqual(probe.expectEscalate, ["no-backend"], "the probe expects exactly the coded refusal");
  assert.equal(probe.publishes, false, "a refusal publishes nothing, so nothing waits for the edge");
  assert.equal(probe.check({ build: "a" }, { build: "a" }).ok, true);
  assert.equal(probe.check({ build: "a" }, { build: "b" }).ok, false, "a refusal that moved the build is a lie");
});

test("chooseCases: all, a list, and unknown names dropped", () => {
  assert.deepEqual(chooseCases("all", CASES), CASES.map((c) => c.name));
  assert.deepEqual(chooseCases(" text, remove ,nope", CASES), ["text", "remove"]);
  assert.deepEqual(chooseCases("", CASES), CASES.map((c) => c.name));
});

test("the switch is the lane sweep's, so one word arms both harnesses the same way", () => {
  assert.match(SRC, /import \{ confirmed \} from "\.\/lane-sweep\.mjs"/);
  assert.equal(confirmed("spend"), true);
  assert.equal(confirmed("Spend "), true);
  assert.equal(confirmed("yes"), false);
});

// ── THE LOGO ATTACHMENT IS A REAL PICTURE ─────────────────────────────────
//
// `site-logo.mjs` sniffs the bytes and refuses svg; a data URL that is not a
// raster the sniffer knows would make the case fail for the harness's reason
// rather than the lane's. So the PNG is checked the way a decoder reads it:
// signature, IHDR dimensions, and an IDAT that inflates to the right length.
test("tinyPng is a well-formed RGB PNG of the stated size", () => {
  const png = tinyPng(96, 32);
  assert.deepEqual([...png.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.equal(png.subarray(12, 16).toString("ascii"), "IHDR");
  assert.equal(png.readUInt32BE(16), 96);
  assert.equal(png.readUInt32BE(20), 32);
  assert.equal(png[24], 8, "bit depth");
  assert.equal(png[25], 2, "colour type RGB");
  // Walk the chunks to IDAT and inflate it: one filter byte per row plus RGB.
  let off = 8; let idat = null;
  while (off < png.length) {
    const len = png.readUInt32BE(off); const type = png.subarray(off + 4, off + 8).toString("ascii");
    if (type === "IDAT") idat = png.subarray(off + 8, off + 8 + len);
    off += 12 + len;
  }
  assert.ok(idat, "no IDAT");
  assert.equal(zlib.inflateSync(idat).length, (96 * 3 + 1) * 32);
  assert.match(tinyPngDataUrl(), /^data:image\/png;base64,[A-Za-z0-9+/=]+$/);
  assert.ok(tinyPngDataUrl().length < 2_000_000, "under the lane's 2 MB bound");
  const logo = CASES.find((c) => c.name === "logo");
  assert.deepEqual(Object.keys(logo.body({})), ["images"], "the logo case attaches through `images`, the field the edit route reads");
});

// ── THE PAGE VERBS DEPEND ON THE ADDON HAVING RUN, AND SAY SO ─────────────
test("move needs the page the addon added and remove needs /times; neither spends without one", () => {
  const move = CASES.find((c) => c.name === "move");
  const remove = CASES.find((c) => c.name === "remove");
  assert.ok(move.skip({ routes: ["/", "/menu"] }, { added: "" }), "move should skip when the addon added nothing");
  assert.ok(move.skip({ routes: ["/", "/menu"] }, { added: "/hours" }), "move should skip when the added page is not on the site");
  assert.equal(move.skip({ routes: ["/", "/hours"] }, { added: "/hours" }), "");
  assert.equal(move.ask({ routes: ["/", "/hours"] }, { added: "/hours" }), "Move the page at /hours to /times");
  assert.ok(remove.skip({ routes: ["/", "/hours"] }), "remove should skip with no /times");
  assert.equal(remove.skip({ routes: ["/", "/times"] }), "");
  assert.equal(addedRoute({ routes: ["/", "/menu"] }, { routes: ["/", "/menu", "/hours"] }), "/hours");
  assert.equal(addedRoute({ routes: ["/"] }, { routes: ["/", "/a", "/b"] }), "", "two new routes is not one added page");
  const addon = CASES.find((c) => c.name === "addon");
  assert.ok(addon.skip({ routes: ["/", "/hours"] }), "the addon must not add a second hours page");
  assert.equal(addon.skip({ routes: ["/", "/book", "/menu"] }), "");
});

// ── THE CHECKS READ THE SITE ──────────────────────────────────────────────
test("move passes only when the new address answers, the old one redirects to it, and the sitemap agrees", () => {
  const move = CASES.find((c) => c.name === "move");
  const b = { routes: ["/", "/hours"], build: "a" };
  const good = move.check(b, { routes: ["/", "/times"], build: "b" }, {}, { from: "/hours", newStatus: 200, oldStatus: 301, oldLocation: "https://x.gofarther.app/times" });
  assert.equal(good.ok, true, good.note);
  const noRedirect = move.check(b, { routes: ["/", "/times"], build: "b" }, {}, { from: "/hours", newStatus: 200, oldStatus: 404, oldLocation: "" });
  assert.equal(noRedirect.ok, false, "a moved page must redirect, not 404");
  const staleMap = move.check(b, { routes: ["/", "/hours", "/times"], build: "b" }, {}, { from: "/hours", newStatus: 200, oldStatus: 301, oldLocation: "/times" });
  assert.equal(staleMap.ok, false, "the sitemap still lists the old address");
});

test("the runner carries the added route from the addon case to the verbs, and gives a coded refusal its own word", () => {
  assert.match(SRC, /const ctx = \{ added: "" \};/, "no shared ctx");
  assert.match(SRC, /ctx\.added = target/, "the addon case does not record what it added");
  assert.match(SRC, /c\.skip\(before, ctx\)/, "skip does not see ctx");
  assert.match(SRC, /c\.ask\(before, ctx\)/, "ask does not see ctx");
  const branch = SRC.indexOf("else if (escalated && c.expectEscalate");
  const plain = SRC.indexOf("else if (escalated) {");
  assert.ok(branch > 0 && plain > branch, "the expected-refusal branch must come before the plain escalate branch");
  assert.match(SRC.slice(branch, plain), /"refused as coded"/);
});

test("the data case demands the row through the site's own API and, with a browser, on the rendered menu", () => {
  const data = CASES.find((c) => c.name === "data");
  const b = { build: "a" }, a = { build: "a" };
  assert.equal(data.check(b, a, {}, { rows: [{ name: "Cortado", price: 2.8, category: "Coffee" }], menuText: "Coffee Cortado £2.80" }).ok, true);
  assert.equal(data.check(b, a, {}, { rows: [{ name: "Cortado" }], menuText: "Coffee Flat white" }).ok, false, "served by the API but not drawn is not a pass");
  assert.equal(data.check(b, a, {}, { rows: [{ name: "Cortado" }], menuText: null }).ok, true, "no browser: the API row alone decides, and the note says so");
  assert.equal(data.check(b, a, {}, { rows: [], menuText: "Cortado" }).ok, false);
  assert.equal(data.check(b, { build: "b" }, {}, { rows: [{ name: "Cortado" }], menuText: null }).ok, false, "a data edit must not republish");
});

test("the cancel case passes only on a cancelled job and an unmoved build", () => {
  const cancel = CASES.find((c) => c.name === "cancel");
  assert.equal(cancel.check({ build: "a" }, { build: "a" }, {}, { state: "cancelled" }).ok, true);
  assert.equal(cancel.check({ build: "a" }, { build: "b" }, {}, { state: "cancelled" }).ok, false, "cancelled and published is the worst outcome");
  assert.equal(cancel.check({ build: "a" }, { build: "a" }, {}, { state: "done" }).ok, false);
});

// ── THE RUNNER ────────────────────────────────────────────────────────────
test("the runner DELETEs a cancel case only after the job is claimed, and only once", () => {
  const loop = SRC.slice(SRC.indexOf("for (let i = 0; i < 200; i++)"), SRC.indexOf("const wall = (Date.now() - t0) / 1000"));
  assert.ok(loop.length > 200, "the poll loop landmarks moved");
  const del = loop.indexOf('call("DELETE"');
  assert.ok(del > 0, "no DELETE in the poll loop");
  const gate = loop.slice(0, del).lastIndexOf("if (c.cancel && !cancelledAt && st && st !== \"queued\"");
  assert.ok(gate > 0 && gate < del, "the DELETE is not gated on a claimed status and a single send");
  assert.match(loop, /cancelledAt = Date\.now\(\)/, "the cancel is not recorded as sent");
});

test("every edit POST carries an idem key, and the db site's synchronous answer is read as the reply", () => {
  assert.match(SRC, /idem: hex32\(\)/, "no idem key on the edit POST");
  assert.match(SRC, /let reply = p;/, "a synchronous answer must start out as the reply");
  assert.match(SRC, /synchronous answer/, "the synchronous shape is not announced");
});

test("a claimed publish waits for the edge before the site is read", () => {
  const wait = SRC.indexOf("if (c.publishes && body.ok === true)");
  const read = SRC.indexOf("const after = await snapshot(slug);");
  assert.ok(wait > 0 && read > wait, "the edge wait is missing or sits after the after-snapshot");
  assert.match(SRC.slice(wait, read), /x-site-build/, "the wait does not watch the build id");
});

test("the workflow is dispatch-only, needs the word, installs before running, and pushes only to the ref it ran from", () => {
  assert.match(WF, /^on:\n  workflow_dispatch:/m);
  assert.ok(!/\n\s*push:/.test(WF), "a push trigger would make the expensive thing the default");
  assert.match(WF, /SWEEP_CONFIRM: \$\{\{ github\.event\.inputs\.confirm \}\}/);
  const install = WF.indexOf("npm ci"); const run = WF.indexOf("node scripts/gap-sweep.mjs");
  assert.ok(install > 0 && run > install, "the install must come before the sweep");
  assert.match(WF, /permissions:\n  contents: write/, "the screenshot commit needs contents: write");
  assert.match(WF, /git push origin "HEAD:\$\{\{ github\.ref_name \}\}"/, "the push must target the dispatched ref");
  assert.ok(!/HEAD:main/.test(WF), "a push to main would deploy and roll the container under the run");
  assert.match(WF, /if: always\(\)/, "the screenshots must be kept even when the sweep fails");
});
