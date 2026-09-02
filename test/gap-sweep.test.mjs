// Guards for scripts/gap-sweep.mjs — the harness that drives the parts of the
// EDIT PATH the lane sweep cannot reach. Kept to properties, not spellings.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { CASES, chooseCases, tinyPng, tinyPngDataUrl } from "../scripts/gap-sweep.mjs";
import { CASES as LANE_CASES, confirmed } from "../scripts/lane-sweep.mjs";
import { EDIT_LAYERS } from "../builder/site-ask.mjs";
import { PAGE_VERBS } from "../builder/site-lanes.mjs";

const SRC = readFileSync(new URL("../scripts/gap-sweep.mjs", import.meta.url), "utf8");
const WF = readFileSync(new URL("../.github/workflows/lane-sweep.yml", import.meta.url), "utf8");

// ── THE CASES ARE THE GAPS, AND ONLY THE GAPS ─────────────────────────────
//
// Every `via` that posts a layer names one the edit route actually has, or the
// router. A case that posted a layer the route does not know would fall
// through to `escalate("layer")` for nothing and read as a pass — the first
// paid canary's exact failure. And nothing here is the addon route: the owner
// drew the line ("IM TALKING ABOUT THE EDIT PATH, NOT THE ADDON").
test("every case enters the edit path through a real door, and none touches the addon", () => {
  assert.ok(CASES.length >= 8, "the case table has shrunk");
  for (const c of CASES) {
    assert.ok(["route", ...EDIT_LAYERS].includes(c.via), `${c.name}: via "${c.via}" is not an edit layer or the router`);
    assert.ok(["main", "db"].includes(c.where), `${c.name}: where "${c.where}"`);
    assert.ok(["site", "reply"].includes(c.judged), `${c.name}: judged must say site or reply`);
    assert.equal(typeof c.check, "function", `${c.name}: no check`);
    assert.equal(typeof c.ask, "string", `${c.name}: no ask`);
  }
  assert.ok(!/\/addon/.test(SRC), "the harness names the addon route");
});

test("the gaps are exactly the rungs and behaviours the lane sweep cannot reach", () => {
  const names = CASES.map((c) => c.name);
  // Rungs with no lane of their own — a message never reaches them through
  // the lane picker, so the lane table cannot cover them.
  for (const rung of ["text", "logo", "data", "rules"]) assert.ok(names.includes(rung), `no case for the ${rung} rung`);
  // The two page verbs the lane sweep only pointed at.
  for (const verb of PAGE_VERBS.filter((v) => v !== "add")) assert.ok(names.includes(verb), `no case for the page verb ${verb}`);
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

// `fretwork-1` has no database, so data, rules and backend cannot run there;
// and every page verb needs a page the site can spare, which only the site
// with three pages has.
test("each case runs on the site that can answer it", () => {
  const main = ["text", "logo", "cancel"];
  const db = ["move", "move-back", "remove", "data", "rules", "backend"];
  for (const c of CASES) {
    assert.ok(main.includes(c.name) || db.includes(c.name), `${c.name} is not placed`);
    assert.equal(c.where, main.includes(c.name) ? "main" : "db", `${c.name} is on the wrong site`);
  }
});

test("chooseCases: all, a list, punctuation forgiven, a stranger refused", () => {
  assert.deepEqual(chooseCases("all", CASES), CASES.map((c) => c.name));
  assert.deepEqual(chooseCases(" text, remove ", CASES), ["text", "remove"]);
  assert.deepEqual(chooseCases("text,move-back.", CASES), ["text", "move-back"], "a hyphen inside a name is the name; a full stop after it is not");
  assert.deepEqual(chooseCases("text., remove", CASES), ["text", "remove"], "a stray dot before the comma, which the whole-string trim cannot reach");
  // The lane harness's rule (run 16: `kind,slug.` ran `kind` alone), kept
  // identical here because the workflow feeds one input box to both.
  assert.throws(() => chooseCases(" text, remove ,nope", CASES),
    (e) => /"nope"/.test(e.message) && e.message.includes("move-back"),
    "a stranger is dropped instead of refused, or the refusal does not list the cases");
  assert.deepEqual(chooseCases("", CASES), CASES.map((c) => c.name));
});

// The stranger refuses before anything is spent — the lane harness's guard,
// on this runner. Same anchors: the chooser call inside a try that exits, on
// its own line, above the magic-link request.
test("a stranger in the cases box exits the runner before sign-in", () => {
  const main = SRC.indexOf("async function main()");
  const call = SRC.indexOf("names = chooseCases(WANT, CASES)", main);
  const signIn = SRC.indexOf("generate_link", main);
  assert.ok(main > -1 && call > -1 && signIn > -1, "landmarks moved: main, the chooser call, or the sign-in");
  assert.ok(call < signIn, "the cases are chosen after the sign-in");
  const line = SRC.slice(SRC.lastIndexOf("\n", call) + 1, SRC.indexOf("\n", call));
  assert.ok(/\btry\b/.test(line) && /\bcatch\b/.test(line) && /process\.exit\(1\)/.test(line),
    "the chooser's refusal is not caught and turned into an exit: " + line.trim());
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

// ── THE PAGE VERBS LEAVE THE SITE WHERE THEY FOUND IT ─────────────────────
test("move goes out and move-back returns; each spends only when its page is there", () => {
  const move = CASES.find((c) => c.name === "move");
  const back = CASES.find((c) => c.name === "move-back");
  assert.equal(move.from, back.to, "the pair does not return the page to its address");
  assert.equal(move.to, back.from, "the pair does not move the same page back");
  assert.equal(move.skip({ routes: ["/", "/book", "/menu"] }), "");
  assert.ok(move.skip({ routes: ["/", "/board"] }), "move should skip without /menu");
  assert.ok(move.skip({ routes: ["/", "/menu", "/board"] }), "move should skip when /board is taken");
  assert.equal(back.skip({ routes: ["/", "/book", "/board"] }), "");
  assert.ok(back.skip({ routes: ["/", "/book", "/menu"] }), "move-back should skip when nothing moved");
  assert.match(move.ask, new RegExp(`${move.from} to ${move.to}`));
  assert.match(back.ask, new RegExp(`${back.from} to ${back.to}`));
});

test("move passes only when the new address answers, the old one redirects to it, and the sitemap agrees", () => {
  const move = CASES.find((c) => c.name === "move");
  const b = { routes: ["/", "/menu"], build: "a" };
  const x = { from: "/menu", to: "/board" };
  const good = move.check(b, { routes: ["/", "/board"], build: "b" }, {}, { ...x, newStatus: 200, oldStatus: 301, oldLocation: "https://x.gofarther.app/board" });
  assert.equal(good.ok, true, good.note);
  const noRedirect = move.check(b, { routes: ["/", "/board"], build: "b" }, {}, { ...x, newStatus: 200, oldStatus: 404, oldLocation: "" });
  assert.equal(noRedirect.ok, false, "a moved page must redirect, not 404");
  const wrongTarget = move.check(b, { routes: ["/", "/board"], build: "b" }, {}, { ...x, newStatus: 200, oldStatus: 301, oldLocation: "https://x.gofarther.app/" });
  assert.equal(wrongTarget.ok, false, "a redirect to the home page is the failure `renamed` exists to prevent");
  const staleMap = move.check(b, { routes: ["/", "/menu", "/board"], build: "b" }, {}, { ...x, newStatus: 200, oldStatus: 301, oldLocation: "/board" });
  assert.equal(staleMap.ok, false, "the sitemap still lists the old address");
});

test("remove is driven to the coded refusal on a linked page, and passes only with the page still there", () => {
  const remove = CASES.find((c) => c.name === "remove");
  assert.deepEqual(remove.expectError, ["kept"], "a linked page answers `kept` — the reason mergeAddonPages gives");
  assert.equal(remove.publishes, false);
  assert.equal(remove.check({ build: "a" }, { build: "a", routes: ["/", "/book"] }, { msg: "x" }, { pageStatus: 200 }).ok, true);
  assert.equal(remove.check({ build: "a" }, { build: "b", routes: ["/"] }, { msg: "x" }, { pageStatus: 404 }).ok, false, "a refusal that removed the page is a lie");
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

test("a coded refusal gets its own word, decided before the generic escalate and failed branches", () => {
  const coded = SRC.indexOf("c.expectEscalate && c.expectEscalate.includes");
  const plainEscalate = SRC.indexOf("else if (escalated) {");
  const plainFailed = SRC.indexOf("else if (!claimedOk) {");
  assert.ok(coded > 0 && plainEscalate > coded && plainFailed > coded, "the coded-refusal branch must come before both generic branches");
  assert.match(SRC.slice(coded, plainEscalate), /"refused as coded"/);
  assert.match(SRC.slice(coded, plainEscalate), /c\.expectError\.includes\(String\(body\.error\)\)/, "a 422 refusal is not recognised by its reason");
});

// THE HARNESS WORD IS READ AS A WORD. Run 9 (2026-09-02) came through as
// `gap ` with a trailing space; the raw comparison ran the lane harness with
// no lanes named and it died in a tenth of a second — the confirm word's own
// trap, one input over. Driven for real: the selector line is lifted out of
// the workflow and run under bash with a fake `node` that prints its script.
test("the harness selector forgives whitespace and case, and any other word means lane", () => {
  const line = (WF.match(/^\s+(H=\$\(printf[^\n]*\bfi)\s*$/m) || [])[1];
  assert.ok(line, "the selector line moved — this test reads the real one");
  const dir = mkdtempSync(path.join(tmpdir(), "harness-"));
  writeFileSync(path.join(dir, "node"), "#!/bin/sh\necho \"$1\"\n", { mode: 0o755 });
  const pick = (value) => execFileSync("bash", ["-c", line], {
    env: { ...process.env, PATH: dir + ":" + process.env.PATH, SWEEP_HARNESS: value }, encoding: "utf8",
  }).trim();
  for (const v of ["gap", "gap ", " gap", "Gap", "GAP\n"]) assert.equal(pick(v), "scripts/gap-sweep.mjs", JSON.stringify(v));
  for (const v of ["lane", "", "text,logo", "gap,lane"]) assert.equal(pick(v), "scripts/lane-sweep.mjs", JSON.stringify(v));
});

test("the workflow is dispatch-only, needs the word, selects the harness by input, installs before running, and pushes only to the ref it ran from", () => {
  assert.match(WF, /^on:\n  workflow_dispatch:/m);
  assert.ok(!/\n\s*push:/.test(WF), "a push trigger would make the expensive thing the default");
  assert.match(WF, /SWEEP_CONFIRM: \$\{\{ github\.event\.inputs\.confirm \}\}/);
  assert.match(WF, /harness:\n\s+description:[^\n]*\n\s+required: false\n\s+default: 'lane'/, "the harness input must default to the lane sweep");
  // THREE HARNESSES BEHIND ONE WORD (2026-09-02): the addon sweep joined as an
  // `elif`. What this holds is that the gap word runs the gap script and the
  // default still runs the lane sweep — any number of named harnesses between
  // them is the point of the input, not a drift.
  assert.match(WF, /if \[ "\$H" = "gap" \]; then node scripts\/gap-sweep\.mjs; (?:elif \[ "\$H" = "[a-z]+" \]; then node scripts\/[a-z-]+\.mjs; )*else node scripts\/lane-sweep\.mjs; fi/, "the input does not select the harness");
  const install = WF.indexOf("npm ci"); const browser = WF.indexOf("playwright install"); const run = WF.indexOf("node scripts/gap-sweep.mjs");
  assert.ok(install > 0 && browser > install && run > browser, "install, then browser, then the sweep");
  assert.match(WF, /permissions:\n  contents: write/, "the screenshot commit needs contents: write");
  assert.match(WF, /git push origin "HEAD:\$\{\{ github\.ref_name \}\}"/, "the push must target the dispatched ref");
  assert.ok(!/HEAD:main/.test(WF), "a push to main would deploy and roll the container under the run");
  assert.match(WF, /if: always\(\)/, "the screenshots must be kept even when the sweep fails");
});
