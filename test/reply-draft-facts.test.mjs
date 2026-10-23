// Audit A14-3 (and A14-4, at the end): under draft-first a page removal, a page move and a photograph
// taken off are saved to the draft (their answers carry `checks` from
// `checksOf({ draft: true, revision })`), so their facts are said of the
// draft: never "off the site" as if live, never "the old address sends
// visitors" before Publish, never a Versions rollback as the undo.
import test from "node:test";
import assert from "node:assert/strict";
import { editReplyFacts, buildReplyFacts } from "../builder/site-reply.mjs";
import { checksOf } from "../builder/check-evidence.mjs";

const drafted = checksOf({ render: { ran: false }, published: false, draft: true, revision: 5 });
const live = checksOf({ render: { ran: false }, published: true, version: "01790468089054-8btpep" });
const texts = (r) => { assert.equal(r.skip, null); return r.facts.map((f) => f.text); };

test("the draft evidence is read as a draft (observer alive)", () => {
  assert.equal(drafted.draft, true);
  assert.equal(drafted.revision, 5);
});

test("a page removal saved to the draft is said of the draft, with no published-version undo", () => {
  const t = texts(editReplyFacts({ ok: true, layer: "page", page: "/gallery", removed: ["/gallery"], cost: 0, checks: drafted }));
  const off = t.find((x) => /^Took \/gallery off the site/.test(x));
  assert.ok(off, t.join("\n"));
  assert.match(off, /in the draft; the live site still has it until the owner presses Publish/);
  assert.ok(!t.some((x) => /Every published version is kept/.test(x)), t.join("\n"));
  assert.ok(t.some((x) => /^Nothing is live yet/.test(x)), t.join("\n"));
});

test("a page move saved to the draft: the redirect is said as after Publish", () => {
  const t = texts(editReplyFacts({ ok: true, layer: "page", page: "/menu", renamedTo: "/food", cost: 0, checks: drafted }));
  const mv = t.find((x) => /^Moved \/menu to \/food/.test(x));
  assert.ok(mv, t.join("\n"));
  assert.match(mv, /in the draft; once the owner presses Publish, the old address sends visitors/);
});

test("a photograph taken off in the draft: said of the draft, undone by asking, not by a Versions rollback", () => {
  const t = texts(editReplyFacts({ ok: true, layer: "look", lookNote: "Took the photo off.", photosRemoved: 1, photosTakenOff: 1, cost: 3, checks: drafted }));
  assert.ok(t.some((x) => /^one photograph is no longer on the site in the draft; the live site still shows it/.test(x)), t.join("\n"));
  assert.ok(!t.some((x) => /Cloud → Versions/.test(x)), t.join("\n"));
  assert.ok(t.some((x) => /put the photo back” before publishing/.test(x)), t.join("\n"));
});

test("a look change with page operations, saved to a held draft, is said of the draft", () => {
  const t = texts(editReplyFacts({ ok: true, layer: "look", pageOps: [{ page: "/gallery", removed: ["/gallery"] }], cost: 2,
    draft: { published: false, held: true, revision: 6 } }));
  assert.ok(t.some((x) => /^Took \/gallery off the site in the draft/.test(x)), t.join("\n"));
});

test("CONTROL: the same answers published live keep their live wording", () => {
  const rm = texts(editReplyFacts({ ok: true, layer: "page", page: "/gallery", removed: ["/gallery"], cost: 0, checks: live }));
  assert.ok(rm.includes("Took /gallery off the site."), rm.join("\n"));
  assert.ok(rm.some((x) => /Every published version is kept/.test(x)));
  const mv = texts(editReplyFacts({ ok: true, layer: "page", page: "/menu", renamedTo: "/food", cost: 0, checks: live }));
  assert.ok(mv.includes("Moved /menu to /food; the old address sends visitors to the new one."), mv.join("\n"));
  const px = texts(editReplyFacts({ ok: true, layer: "look", lookNote: "Took the photo off.", photosRemoved: 1, photosTakenOff: 1, cost: 3, checks: live }));
  assert.ok(px.includes("one photograph is no longer on the site."), px.join("\n"));
  assert.ok(px.some((x) => /Cloud → Versions/.test(x)));
  assert.ok(!px.concat(rm, mv).some((x) => /in the draft/.test(x)));
});

// Audit A14-4: a Build saved as the draft (worker.js `buildChecks` gives it
// `checks` with draft true) is never told "the rest of the site is live" nor
// "shown on a published page".
const salvagedBuild = (checks) => ({ salvaged: ["menu.tsx"], pictures: [{ describe: "a loaf on a board", status: "made", stage: "published", page: "/" }], checks });

test("a Build saved as the draft: the salvage and picture facts are said of the draft", () => {
  const t = texts(buildReplyFacts(salvagedBuild(drafted)));
  const sv = t.find((x) => /^The page “menu” did not compile/.test(x));
  assert.ok(sv, t.join("\n"));
  assert.ok(!/the rest of the site is live/.test(sv), sv);
  assert.match(sv, /saved in the draft, and the live site is unchanged until the owner presses Publish/);
  assert.ok(t.some((x) => /^Photographs made and shown on a page of the draft/.test(x)), t.join("\n"));
  assert.ok(!t.some((x) => /shown on a published page/.test(x)), t.join("\n"));
});

test("CONTROL: a Build published live keeps its live wording", () => {
  const t = texts(buildReplyFacts(salvagedBuild(live)));
  assert.ok(t.some((x) => /^The page “menu” did not compile.*the rest of the site is live\.$/.test(x)), t.join("\n"));
  assert.ok(t.some((x) => /^Photographs made and shown on a published page/.test(x)), t.join("\n"));
});
