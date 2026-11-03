// RENAMING A SITE (owner, 2026-08-29: "now the slug lane" → "yeah do the alias
// one"). The last unbuilt lane on the platform, and the one whose failure mode
// is permanent: a rename leaves the old address 301ing to the new one forever,
// so every decision here is one nobody can take back.
//
// WHAT THIS FILE IS MOSTLY ABOUT is that distinction. Everywhere else on this
// platform a wrong answer is visible and undoable, and the bias is toward
// acting. Here it inverts — twice, in two different places — and both inversions
// are asserted, because they read as timidity to anyone who does not know why.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  cleanAlias, resolveAlias, renameRows, aliasRefusal, readRename, readForget,
  RENAME_TOOL, renameRequest, ALIAS_SQL, MAX_ALIAS,
} from "../builder/site-alias.mjs";
import { LANE_FIELDS, OWN_LANES, DISPATCHED_LANES, UNBUILT_LANES, laneLayer, laneUnbuilt } from "../builder/site-lanes.mjs";
import { EDIT_LAYERS } from "../builder/route-shared.mjs";

const worker = readFileSync("worker.js", "utf8");
const bare = (s) => s.split("\n").map((l) => (/^\s*(?:\/\/|\*|\/\*)/.test(l) ? " ".repeat(l.length) : l)).join("\n");
const w = bare(worker);

/* ── a name is READ or REFUSED, never repaired ──────────────────────────── */

test("a name the customer did not ask for is refused, not tidied into existence", () => {
  // THE ARGUMENT IS THE PERMANENCE. On any other field a silent tidy-up is a
  // small rudeness. Here the result becomes an address that 301s forever, so a
  // mangled name is a mistake with no undo. The first draft of `cleanAlias`
  // stripped every unknown character and turned "déjà vu café" into `dj-vu-caf`.
  for (const mangled of ["déjà vu café", "CAFÉ", "https://x.test", "a.b", "x/y", "naïve"]) {
    assert.equal(cleanAlias(mangled), null, "`" + mangled + "` was silently rewritten instead of refused");
  }
  // THE THREE TRANSFORMS THAT ARE READING RATHER THAN REWRITING — case, outer
  // whitespace, and the separators a person types instead of a hyphen. Without
  // these the field would refuse "Sunset Shoes", which is what everybody types.
  assert.equal(cleanAlias("Sunset Shoes"), "sunset-shoes");
  assert.equal(cleanAlias("  sunset_shoes  "), "sunset-shoes");
  assert.equal(cleanAlias("a--b"), "a-b");
  // And the bounds, both ends.
  assert.equal(cleanAlias("ab"), null, "a two-character label is not a name anybody asked for");
  assert.equal(cleanAlias("x".repeat(MAX_ALIAS + 1)), null, "an over-long name is accepted");
  assert.equal(cleanAlias("-lead-"), "lead", "a hyphen that cannot begin a DNS label is not trimmed");
});

/* ── resolution: three cases, and the one that must not 404 ─────────────── */

test("a label resolves to a site, and an OLD name redirects rather than dying", () => {
  // The ordinary case, and it is every site that has never been renamed — all 47
  // of them. No row means the label IS the slug, which is what makes this
  // feature cost nothing for the sites that do not use it.
  assert.deepEqual(resolveAlias("shoeroom-1", null, null), { slug: "shoeroom-1", redirect: null });

  // The current name: serve the storage slug under it, no redirect.
  assert.deepEqual(resolveAlias("sunset-shoes", { slug: "shoeroom-1", current: true }, "sunset-shoes"),
    { slug: "shoeroom-1", redirect: null });

  // AN OLD NAME IS THE WHOLE FEATURE. Customers print addresses, put them on
  // vans, and since 2026-08-29 we generate QR CODES pointing at them — so an old
  // address that stopped working would break things nobody can reach to fix.
  assert.deepEqual(resolveAlias("shoeroom-1", { slug: "shoeroom-1", current: false }, "sunset-shoes"),
    { slug: "shoeroom-1", redirect: "sunset-shoes" });
});

test("CANNOT-TELL SERVES THE SITE — it never reads as no-such-site", () => {
  // The repo's own law: "cannot-tell must never read as nothing-there". An old
  // name whose site's CURRENT name we failed to look up still has a site behind
  // it, and a page we can serve beats a redirect we cannot build.
  assert.deepEqual(resolveAlias("shoeroom-1", { slug: "shoeroom-1", current: false }, null),
    { slug: "shoeroom-1", redirect: null });
  // …and a row that resolves to nothing usable falls back to the label, which is
  // exactly what the platform did before aliases existed.
  assert.deepEqual(resolveAlias("x-1", { slug: "", current: true }, null), { slug: "x-1", redirect: null });
  // A redirect to the name you already typed is a loop, and is refused.
  assert.deepEqual(resolveAlias("same", { slug: "same", current: false }, "same"), { slug: "same", redirect: null });
});

/* ── the lane, and the group it moved out of ────────────────────────────── */

test("`slug` acts now, and nothing on the platform is unbuilt", () => {
  assert.equal(laneUnbuilt("slug"), null, "`slug` still reports as unbuilt");
  assert.equal(UNBUILT_LANES.length, 0, "a lane is unbuilt again: " + UNBUILT_LANES.join(","));
  assert.ok(DISPATCHED_LANES.includes("slug"), "`slug` no longer dispatches");
  assert.equal(laneLayer("slug"), "rename", "`slug` dispatches somewhere other than the rename rung");
  assert.ok(EDIT_LAYERS.includes("rename"), "the router cannot ask for a rename");

  // NOT AN OWN LANE, and this is the invariant that decided it: every own lane
  // but `css` is a key on the stored look, read with `priorLook[field]` and
  // written through `mergeLook`. An address is a platform record, so an own lane
  // would have its answer dropped at the merge — silently — which is the exact
  // shape `three` shipped in that same day.
  assert.ok(!OWN_LANES.includes("slug"), "`slug` acts as an own lane and its answer would be dropped at the merge");
  assert.ok(LANE_FIELDS.includes("slug"));
});

/* ── the bias inverts, and it is deliberate ─────────────────────────────── */

test("NOTHING IS GUESSED — a message with no name in it is refused", () => {
  // Every other lane biases toward acting: "a wrong build is visible and
  // undoable, a wrong ask is indistinguishable from the builder being broken."
  // A rename is neither visible-and-undoable nor cheap to get wrong, so this is
  // the second place the bias inverts, after the `pages` verb.
  assert.deepEqual(RENAME_TOOL.input_schema.required, [], "the rename tool compels a name, so a vague message gets an invented one");
  const d = RENAME_TOOL.input_schema.properties.name.description;
  assert.match(d, /ONLY IF THEY SAID ONE/, "nothing tells the model to answer nothing when no name was given");
  assert.match(d, /do not invent/i, "the model is not told to refrain from inventing a name");
  assert.match(d, /permanent/i, "the reason — that the redirect is permanent — is not stated where the model reads it");

  // …and the reader really does answer nothing.
  assert.equal(readRename({ content: [{ type: "tool_use", input: {} }] }), null);
  assert.equal(readRename({ content: [] }), null);
  assert.equal(readRename({ content: [{ type: "tool_use", input: { name: "café" } }] }), null, "a mangled name reached the caller");
  assert.equal(readRename({ content: [{ type: "tool_use", input: { name: "Sunset Shoes" } }] }), "sunset-shoes");

  // The request carries the CURRENT name, or the model cannot tell a rename from
  // a restatement of the address the site already has.
  const req = renameRequest({ message: "call it sunset shoes", current: "shoeroom-1", model: "m" });
  assert.match(String(req.messages[0].content), /shoeroom-1/, "the model is never told what the site is called now");
  assert.match(String(req.messages[0].content), /call it sunset shoes/, "the customer's own words never reach the model");
});

test("every refusal is its own sentence", () => {
  // Four different reasons needing four different next moves from the customer.
  // "That name is taken" for a name that is merely malformed sends somebody
  // hunting for a conflict that does not exist — the failure-that-cannot-name-
  // itself shape, which this repo has recorded seven times.
  const said = new Set([
    aliasRefusal("café"),
    aliasRefusal("ok-name", { same: true }),
    aliasRefusal("ok-name", { reserved: true }),
    aliasRefusal("ok-name", { taken: true }),
  ]);
  assert.equal(said.size, 4, "two refusals wear the same sentence");
  for (const s of said) assert.ok(s && s.length > 20, "a refusal with nothing in it");
  assert.equal(aliasRefusal("ok-name"), null, "a usable name is refused");
});

test("a missing table degrades to exactly today's behaviour", () => {
  // THE FEATURE SHIPS BEFORE THE TABLE EXISTS, deliberately — this repo has no
  // migration runner, so `site_aliases` is created by hand. Until it is,
  // PostgREST answers an error for an unknown relation, `aliasRowFor` answers
  // null, and `resolveAlias` reads a null row as "no alias": the label is the
  // slug, which is what the platform did before any of this.
  assert.deepEqual(resolveAlias("shoeroom-1", null, null), { slug: "shoeroom-1", redirect: null });
  // AND THE FAILURE IS NOT CACHED, or creating the table later would take five
  // minutes per isolate to take effect. The miss IS cached — that is the
  // opposite of `hostRoutes` and is the whole reason this cache exists.
  const at = w.indexOf("async function aliasRowFor(");
  assert.ok(at > 0, "the alias lookup is gone");
  const fn = w.slice(at, w.indexOf("\n}", w.indexOf("catch { return null; }", at)));
  assert.match(fn, /if \(!r\.ok\) return null;/, "a failed lookup is treated as an answer");
  assert.match(fn, /aliasRoutes\.set\(l, val\)/, "the miss is not cached, so every request on the platform pays a round trip");
});

test("the table the code expects is written down", () => {
  // No migration runner here, so the schema and the code that reads it are two
  // copies of one fact. This is the thinnest rope between them.
  for (const col of ["alias", "slug", "uid", "current"]) {
    assert.match(ALIAS_SQL, new RegExp("\\b" + col + "\\b"), "`" + col + "` is read by the code and absent from the schema");
  }
  // ONE CURRENT NAME PER SITE, ENFORCED BY POSTGRES. Two rows claiming to be a
  // site's live address is a state no application check survives concurrency,
  // and it would present as the address flapping between two names.
  assert.match(ALIAS_SQL, /unique index[\s\S]*on site_aliases \(slug\) where current/,
    "nothing stops a site having two current addresses");
});

/* ── forgetting an old name (owner, 2026-09-02: "i want that") ─────────── */

test("a forgotten storage name is GONE, and only when its site answers to another name", () => {
  // No row, and the site this label names now lives under a different name:
  // the demoted row a rename wrote was deleted, and nothing else can tell this
  // label from a never-renamed site. Gone — not served, not redirected.
  assert.deepEqual(resolveAlias("fretwork-1", null, "crookes-guitar"), { slug: null, redirect: null, gone: true });
  // A never-renamed site: its current name IS the label. Served, as ever.
  assert.deepEqual(resolveAlias("shoeroom-1", null, "shoeroom-1"), { slug: "shoeroom-1", redirect: null });
  // Cannot tell (the lookup failed, or answered nothing): served, never gone.
  assert.deepEqual(resolveAlias("shoeroom-1", null, null), { slug: "shoeroom-1", redirect: null });
  assert.deepEqual(resolveAlias("shoeroom-1", null, ""), { slug: "shoeroom-1", redirect: null });
  // A row still present is never gone: current serves, old redirects.
  assert.equal(resolveAlias("fretwork-1", { slug: "fretwork-1", current: false }, "crookes-guitar").gone, undefined);
  assert.equal(resolveAlias("crookes-guitar", { slug: "fretwork-1", current: true }, null).gone, undefined);
});

test("the address tool can forget, the reader reads it, and the model is shown the old names", () => {
  const p = RENAME_TOOL.input_schema.properties;
  assert.ok(p.forget && p.forget.type === "string", "the tool has no way to say which old address to forget");
  assert.match(p.forget.description, /INSTEAD of `name`/, "the tool does not say a forget and a rename are one or the other");
  assert.match(p.forget.description, /free for anyone/i, "the permanence — the name is free for anyone — is not stated where the model reads it");
  assert.deepEqual(RENAME_TOOL.input_schema.required, [], "the tool compels an answer");
  assert.equal(readForget({ content: [{ type: "tool_use", input: { forget: "Crookes Guitar" } }] }), "crookes-guitar");
  assert.equal(readForget({ content: [{ type: "tool_use", input: { forget: "café" } }] }), null, "a mangled name reached the caller");
  assert.equal(readForget({ content: [{ type: "tool_use", input: {} }] }), null);
  assert.equal(readRename({ content: [{ type: "tool_use", input: { forget: "x-y-z" } }] }), null, "a forget was read as a new name");
  const req = renameRequest({ message: "drop the old one", current: "crookes-guitar", former: ["fretwork-1"], model: "m" });
  assert.match(String(req.messages[0].content), /old addresses[^\n]*`fretwork-1`/, "the model is not shown the site's old names");
  const none = renameRequest({ message: "drop the old one", current: "shoeroom-1", former: [], model: "m" });
  assert.match(String(none.messages[0].content), /no old addresses/, "a site with no old names is not said to have none");
  // The two refusals a forget can meet are their own sentences — unlike each
  // other, and unlike the rename's.
  const said = new Set([
    aliasRefusal("ok-name", { live: true }), aliasRefusal("ok-name", { stranger: true }),
    aliasRefusal("ok-name", { taken: true }), aliasRefusal("ok-name", { same: true }),
  ]);
  assert.equal(said.size, 4, "two refusals wear the same sentence");
});
