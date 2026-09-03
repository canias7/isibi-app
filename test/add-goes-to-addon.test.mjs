// ADDING IS THE ADDON STEP.
//
// Owner, 2026-09-02: "add will always go in addon … but tsx does exist tho,
// is literally everything on the page, it could be changing a component, is
// changing tsx". The edit step changes what the site has; the addon step adds
// what it does not; the page's own code always exists, so a change to a
// component is an edit. Four hops carry that, and each is asserted here on the
// property rather than the spelling, comments blanked before any scan.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");

/** Length-preserving comment blanking, string-aware. See wall-probe.test.mjs. */
function blankComments(src) {
  let out = ""; let i = 0; let inBlock = false; let quote = "";
  while (i < src.length) {
    const c = src[i]; const nx = src[i + 1];
    if (inBlock) { if (c === "*" && nx === "/") { out += "  "; i += 2; inBlock = false; continue; } out += c === "\n" ? "\n" : " "; i++; continue; }
    if (quote) { out += c; if (c === "\\") { out += nx === undefined ? "" : nx; i += 2; continue; } if (c === quote) quote = ""; i++; continue; }
    if (c === '"' || c === "'" || c === "`") { quote = c; out += c; i++; continue; }
    if (c === "/" && nx === "*") { out += "  "; i += 2; inBlock = true; continue; }
    if (c === "/" && nx === "/") { while (i < src.length && src[i] !== "\n") { out += " "; i++; } continue; }
    out += c; i++;
  }
  return out;
}
const W = blankComments(read("../worker.js"));
const at = (src, needle, what) => { const i = src.indexOf(needle); assert.ok(i >= 0, `${what}: landmark "${needle}" is gone`); return i; };
/** The fields the edit path may not create, read off the list itself. */
const fieldsOf = (src) => {
  const decl = src.slice(at(src, "const ADD_ONLY_FIELDS = [", "list"), src.indexOf("];", at(src, "const ADD_ONLY_FIELDS = [", "list")));
  return [...decl.matchAll(/"([a-z]+)"/g)].map((m) => m[1]);
};

// ── 1. THE EDIT ROUTE REFUSES TO CREATE ─────────────────────────────────────
test("the edit path may not create a code or a scene the site lacks, and tsx is deliberately not on that list", () => {
  const decl = W.slice(at(W, "const ADD_ONLY_FIELDS = [", "list"), W.indexOf("];", at(W, "const ADD_ONLY_FIELDS = [", "list")));
  const fields = [...decl.matchAll(/"([a-z]+)"/g)].map((m) => m[1]);
  assert.deepEqual(fields.sort(), ["qr", "three"], "the fields the edit path may not create");
  assert.ok(!fields.includes("tsx"), "tsx is the page's own code and always exists — changing it is an edit (owner's carve-out)");
  // `hasLookField` reads a real value: not null, not "", not {}.
  const fn = W.slice(at(W, "function hasLookField(look, field) {", "helper"), at(W, "const publishSpine", "helper end") > 0 ? W.indexOf("\n}\n", at(W, "function hasLookField(look, field) {", "helper")) : 0);
  assert.match(fn, /v == null\) return false/, "a missing field must read as absent");
  assert.match(fn, /typeof v === "string"\) return v\.trim\(\) !== ""/, "an empty string must read as absent");
  assert.match(fn, /Object\.keys\(v\)\.length > 0/, "an empty object must read as absent");
});

test("the wall sits at the picker, before any step is planned, and names the addon's own layer", () => {
  // AT THE PICKER, NOT IN THE LOOK STEP. The first draft sat after the look
  // step's `no-look` check — and a dispatched lane (`three` → page) never
  // runs the look step, so "add a 3D scene" walked straight past it. The
  // only place every picked field passes is between the picker's answer and
  // the plan built from it.
  const picker = at(W, "let pickedFields = [];", "picker");
  const picked = W.indexOf("pickedFields = picked.fields;", picker);
  const plan = W.indexOf("const acting = pickedFields.filter", picker);
  assert.ok(picked > picker && plan > picked, "the picker's landmarks moved");
  const branch = W.slice(picked, plan);
  const wall = branch.indexOf("for (const f of ADD_ONLY_FIELDS)");
  assert.ok(wall > 0, "the wall is not between the picker's answer and the plan");
  const body = branch.slice(wall, branch.indexOf("}", wall));
  assert.match(body, /pickedFields\.includes\(f\)/, "the wall is not keyed on the lane having been picked");
  assert.match(body, /!hasLookField\(wallLook, f\)/, "the wall is not keyed on the stored look lacking the field");
  assert.match(body, /escalate\("addon", \{[^}]*layer: "addon"/, "the escalate does not name the addon layer, so the client falls to the revise");
  // FAILS OPEN: a config that could not be read lets the lane run and say
  // `no-meta` itself, rather than refusing on a guess.
  const gate = branch.slice(branch.indexOf("let wallLook = null;"), wall);
  assert.match(gate, /if \(wallLook\)/, "an unreadable config must not fire the wall");
  assert.match(gate, /catch \{ wallLook = null; \}/, "a throwing config read must not fire the wall");
  // "EXISTS" IS READ OFF THE SITE, NOT ONLY THE STORED LOOK. Run 12
  // (2026-09-02) sent an edit of fretwork-1's 3D pick to the addon step:
  // the page rung had drawn it in sweep five and stores no design field.
  // Each field names the mark it leaves in the page source, and the wall
  // consults the pages before refusing.
  assert.match(body, /!onPage/, "the wall does not consult the page source before refusing");
  const ev = W.slice(at(W, "const ADD_EVIDENCE = {", "evidence"), W.indexOf("};", at(W, "const ADD_EVIDENCE = {", "evidence")));
  for (const f of fieldsOf(W)) assert.match(ev, new RegExp("\\b" + f + ": /"), "no page-source mark for " + f);
  assert.match(ev, /SITE_QR/, "a placed code's binding is not the qr mark");
  assert.match(ev, /react-three\\\/fiber|<Canvas/, "a fiber canvas is not the three mark");
  // On the loop body itself, never a byte window — the comment above the
  // check is longer than any window a first draft would pick.
  assert.match(body, /ADD_EVIDENCE\[f\]\.test\(String\(\(p && p\.source\) \|\| ""\)\)/, "the mark is not tested against every stored page");
  // The pages verb's `add` names the layer the same way.
  assert.match(W, /escalate\("addon", \{ field: "pages", verb: pv\.verb, layer: "addon" \}\)/, "a page addition does not name the addon layer");
});

// ── 2. THE CLIENT HOPS TO THE ADDON RUNG ────────────────────────────────────
test("the browser runs the addon route on that answer, with the same sentence", () => {
  const chat = blankComments(read("../public/chat.js"));
  const fn = chat.slice(at(chat, "function escalatedEdit(e, o) {", "escalatedEdit"), at(chat, "function watchEditJob", "next"));
  const addon = fn.indexOf("if (act === 'addon') {");
  const hop = fn.indexOf("if (act === 'hop') {");
  assert.ok(addon > 0 && hop > addon, "the addon answer is not handled before the hop");
  assert.match(fn.slice(addon, hop), /siteAddon\(o\.site, o\.instruction, o\.origin, o\.finish, o\.fallback, o\.d\)/, "the addon is not run with the customer's own sentence and fallback");
  // The decision lives in the module a test can drive, not in chat.js.
  const poll = blankComments(read("../public/edit-poll.js"));
  const dec = poll.slice(at(poll, "function escalateAction(e, o) {", "decision"), at(poll, "var api = {", "api"));
  assert.match(dec, /if \(named === "addon"\) return "addon";/, "the poll module does not answer addon for a server-named addon layer");
  assert.ok(dec.indexOf('return "lost"') < dec.indexOf('return "addon"'), "a lost ask must be decided before the addon hop");
});

// ── 3. THE ADDON STEP KEEPS WHAT IT DESIGNS ─────────────────────────────────
test("the addon merges the designed look, tells the page call the bindings, stores just before the publish and reverts on failure", () => {
  const b = W.slice(at(W, "if (ad) {", "addon"), at(W, "if (tx) {", "addon end"));
  const merged = b.indexOf("const aMerged = mergeLook(aLook, aDesigned, {}, { instructed: true });");
  const gen = b.indexOf("aGen = await generateSitePages(env, briefWithLayout({");
  assert.ok(merged > 0 && gen > merged, "the designed look is not merged before the page call");
  assert.match(b.slice(gen, b.indexOf("}), aSpec", gen)), /qr: aMerged\.qr, three: aMerged\.three/, "the page call is not told the bindings the addon made");
  assert.match(b, /const aNextCss = aCssAsk\.usable \? aCssAsk\.css : aCss;/, "an unusable css answer strips the stored sheet");
  // STORED AFTER EVERY REFUSAL AND BEFORE THE PUBLISH, so a refused addon
  // leaves the site as it was and the container bakes the new mark.
  const store = b.indexOf("await patchSiteConfig(env, ownerSlug, adb, aLookPatch)");
  const climb = b.indexOf("if (!aMerge.ok) return aEscalate(aMerge.reason");
  const publish = b.indexOf("const aPub = await recompileAndPublish(env, {");
  assert.ok(store > 0 && climb > 0 && publish > 0, "a landmark is gone");
  assert.ok(climb < store && store < publish, "the look must be stored after the last refusal and before the publish");
  // GATED ON THERE BEING A PATCH — the condition itself, not the call's
  // position: a sweep gated the call off with `if (false)` and the call was
  // still exactly where this looked for it.
  assert.match(b.slice(b.lastIndexOf("if (", store), store), /^if \(aLookPatch\) \{/, "the store is not gated on the designed look having moved");
  // REVERTED ON THE ONE FAILURE AFTER IT, gated on the store having happened.
  const fail = b.indexOf("if (!aPub.ok) {", publish);
  const revert = b.indexOf("patchSiteConfig(env, ownerSlug, adb, { look: aLook, css: aCss })", fail);
  assert.ok(fail > 0 && revert > fail && revert < b.indexOf("return Response.json", fail), "a failed publish does not put the old look back before answering");
  assert.match(b.slice(b.lastIndexOf("if (", revert), revert), /^if \(aStored\) \{/, "the revert is not gated on the look having been stored");
  // PARTS RIDE THE PUBLISH, and the reply says what was added.
  assert.match(b.slice(publish, b.indexOf("});", publish)), /parts: aParts \|\| undefined/, "the addon's parts are not handed to the spine");
  assert.match(b, /mergeParts\(await loadSiteParts\(env, ownerSlug\), aValid\.parts\)/, "the addon's parts are not merged over the stored ones");
  assert.match(b, /moved: aLookMoved,/, "the reply does not say which design fields the addon gave the site");
});

// ── 4. THE BACKEND IS THE ADDON'S TOO (owner, 2026-09-03) ───────────────────
test("the router is told a database function, an outside service and a scheduled job are additions, and that a first one makes the database", () => {
  // "the build step doesnt have backend so its gonna be on the addon step if
  // needed … if customer touches it then neon db is created". The router's
  // wording is the front door: a reminder the day before that reads as an
  // edit lands on a rung that cannot make it. Read out of the router's own
  // source with comments blanked — the comment above the sentence quotes it.
  // The description is a double-quoted JS string, so the quotes around the
  // intent names are escaped in the source — the landmarks carry the backslash.
  const ask = blankComments(read("../builder/site-ask.mjs"));
  const addon = at(ask, '\\"addon\\" — ADDING SOMETHING THE SITE DOES NOT HAVE YET.', "the addon description");
  const edit = ask.indexOf('\\"edit\\" is for what the site ALREADY HAS, changed', addon);
  assert.ok(edit > addon, "the edit sentence no longer follows the addon description");
  const body = ask.slice(addon, edit);
  assert.match(body, /ANYTHING THE SITE'S DATABASE HAS TO DO THAT IT DOES NOT DO YET/, "the router is not told the backend is an addition");
  assert.match(body, /database function/, "a function is not named");
  assert.match(body, /read live from an outside service/, "an outside connection is not named");
  assert.match(body, /ON A TIMER/, "a scheduled job is not named");
  assert.match(body, /A site with no database gets one the first time any of these is added/, "the router is not told a first touch makes the database");
});
