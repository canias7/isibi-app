// The page generator's deterministic half. Everything here runs without a model
// and without a container: the rules the generator is given, and the checks its
// output has to survive before anything is published.
//
// The checks matter more than they look. A page that lists a `collect` table
// typechecks, bundles, and passes every screenshot — then 403s the first time a
// visitor loads it. Catching that here is the difference between a repair pass
// and a broken published site.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  REFERENCE_PAGE, REFERENCE_PAGES, UI_COMPONENTS, UI_SHORTLIST, UI_SHORTLIST_API, PAGE_RULES, SITE_PAGES_TOOL, MAX_PAGES, MANAGED_COLUMNS,
  schemaDigest, pagesPrompt, repairPrompt, validatePages, lintPages, briefForPages, ACCESS_NOTE,
} from "../builder/page-gen.mjs";
import { COMPONENT_API, COMPONENT_TYPES } from "../builder/component-api.mjs";
import { build as buildApi, render as renderApi, extract as extractApi, buildTypes as buildTypesApi, extractTypes as extractTypesApi } from "../builder/gen-component-api.mjs";
import * as api from "../builder/page-gen.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const TEMPLATE = path.join(ROOT, "builder", "lovable", "template");

// The schema the reference page was written against.
const SPEC = {
  tables: [
    {
      name: "services", access: "display", fts: true,
      columns: [
        { name: "name", type: "text", notnull: true },
        { name: "description", type: "text" },
        { name: "price", type: "real" },
        { name: "duration_minutes", type: "integer" },
      ],
    },
    {
      name: "appointments", access: "collect",
      columns: [
        { name: "service", type: "text", notnull: true, ref: "services" },
        { name: "customer_name", type: "text", notnull: true },
        { name: "date", type: "text", notnull: true },
      ],
    },
    { name: "profiles", access: "user", columns: [{ name: "nickname", type: "text" }] },
  ],
};

// The schema the four reference pages were written against — a superset of SPEC
// above, because they demonstrate the publicView and the claim token that the
// smaller fixture deliberately lacks.
const REFERENCE_SPEC = {
  tables: [
    {
      name: "services", access: "display", fts: true,
      columns: [
        { name: "name", type: "text", notnull: true },
        { name: "description", type: "text" },
        { name: "price", type: "real" },
        { name: "duration_minutes", type: "integer" },
        { name: "image_url", type: "text" },
      ],
    },
    {
      name: "appointments", access: "collect",
      publicView: { columns: ["date", "time"] },
      columns: [
        { name: "service", type: "text", notnull: true, ref: "services" },
        { name: "customer_name", type: "text", notnull: true },
        { name: "customer_phone", type: "text" },
        { name: "date", type: "text", notnull: true },
        { name: "time", type: "text" },
        { name: "notes", type: "text" },
        { name: "claim_token", type: "text" },
      ],
    },
    { name: "profiles", access: "user", columns: [{ name: "nickname", type: "text" }] },
  ],
  // THE TWO FUNCTIONS manage.tsx CALLS. Until 2026-08-04 no schema could declare
  // one, so that reference page demonstrated a flow no generated site could have
  // — and the moment the lint learned to check function names it correctly
  // refused the reference page itself, which is the guard doing exactly its job.
  // Declared here, this is what a barber shop with a "manage your booking" link
  // actually has.
  functions: [
    { name: "booking_by_claim", args: [{ name: "tok", type: "uuid" }], returns: "setof appointments",
      body: "SELECT * FROM appointments WHERE claim_token = tok" },
    { name: "cancel_booking_by_claim", args: [{ name: "tok", type: "uuid" }], returns: "void",
      body: "DELETE FROM appointments WHERE claim_token = tok" },
  ],
};

const page = (source, p = "index.tsx") => [{ path: p, source }];

// ── the copies of things that live on disk ────────────────────────────────────
// The Worker has no filesystem, so the reference page and the component list are
// duplicated into the module. GENERATOR.md's rule is that the file wins, which is
// only enforceable if something notices when they diverge.

test("every reference page in the module is the file on disk", () => {
  // DERIVED FROM THE FOLDER, not from a list here. The first version named
  // index.tsx by hand, which meant adding a reference page silently added an
  // unguarded copy — the guard would keep passing while the new page rotted.
  const dir = path.join(TEMPLATE, "src/routes");
  const onDisk = fs.readdirSync(dir)
    .filter((f) => f.endsWith(".tsx") && f !== "__root.tsx").sort();
  assert.deepEqual(REFERENCE_PAGES.map((p) => p.path).sort(), onDisk,
    "src/routes and REFERENCE_PAGES disagree about which pages exist");
  for (const p of REFERENCE_PAGES) {
    assert.equal(p.source, fs.readFileSync(path.join(dir, p.path), "utf8"),
      `builder/page-gen.mjs has drifted from src/routes/${p.path}`);
    assert.ok(p.blurb && p.blurb.length > 10, `${p.path} has no blurb saying what it is for`);
  }
  // `REFERENCE_PAGE` is still the home page, since that is what most briefs need.
  assert.equal(REFERENCE_PAGE, REFERENCE_PAGES[0].source);
  assert.equal(REFERENCE_PAGES[0].path, "index.tsx");
});

test("every reference page is in the prompt, and each is lint-clean", () => {
  // The pages exist to be imitated, so a page the model never sees is a page
  // that cost template maintenance and bought nothing — the dead-capability
  // shape this repo has hit five times. And a reference page that would FAIL the
  // lint teaches the model to write something the lint then refuses.
  for (const p of REFERENCE_PAGES) {
    assert.ok(PAGE_RULES.includes(p.source), `${p.path} is not in the prompt`);
    assert.deepEqual(lintPages([{ path: p.path, source: p.source }], REFERENCE_SPEC), [],
      `${p.path} does not survive the lint that generated pages are held to`);
  }
});

test("the advertised ui components are the ones that exist", () => {
  const onDisk = fs.readdirSync(path.join(TEMPLATE, "src/components/ui"))
    .filter((f) => f.endsWith(".tsx")).map((f) => f.slice(0, -4)).sort();
  assert.deepEqual([...UI_COMPONENTS].sort(), onDisk);
});

test("the rules carry the reference page and the tool asks for files", () => {
  assert.ok(PAGE_RULES.includes(REFERENCE_PAGE), "the page to imitate must be in the prompt");
  assert.ok(PAGE_RULES.includes("useRows") && PAGE_RULES.includes("useCreateRow"));
  assert.equal(SITE_PAGES_TOOL.input_schema.required[0], "pages");
});

// ── the schema, as the generator is told about it ─────────────────────────────

test("the digest states what each access level permits", () => {
  const d = schemaDigest(SPEC);
  assert.match(d, /TABLE services — access "display"/);
  assert.match(d, /TABLE appointments — access "collect"/);
  assert.match(d, /never list these rows/);
  assert.match(d, /PRIVATE PER MEMBER/, "a user-scoped table is now buildable — behind a sign-in");
});

test("the digest names the columns, their types and what is required", () => {
  const d = schemaDigest(SPEC);
  assert.match(d, /name \(text, required\)/);
  assert.match(d, /price \(real\)/);
  assert.match(d, /service \(text, required, names a row in services\)/);
});

test("the digest says which columns can be ordered on, and whether search works", () => {
  const d = schemaDigest(SPEC);
  assert.match(d, /order \/ filter by: name, description, price, duration_minutes, id/);
  assert.match(d, /full-text search: yes/);
  // A collect table is write-only, so ordering and search are meaningless for it.
  assert.ok(!/order \/ filter by: service/.test(d));
});

test("no tables is said plainly rather than emitted as an empty prompt", () => {
  assert.match(schemaDigest({ tables: [] }), /no tables/);
  assert.match(pagesPrompt("a shop", { tables: [] }), /BRIEF\na shop/);
});

test("the brand reaches the prompt, so the heading matches the page title", () => {
  assert.match(pagesPrompt("a shop", SPEC, "Fold Coffee"), /THE SITE IS CALLED\nFold Coffee/);
  // Without one there is nothing to say, and an empty heading instruction is worse
  // than none — the brief already names the business.
  assert.ok(!/THE SITE IS CALLED/.test(pagesPrompt("a shop", SPEC, "  ")));
});

// ── structural validation ─────────────────────────────────────────────────────

test("a route path is normalised to a bare file under src/routes", () => {
  const v = validatePages({
    pages: [
      { path: "src/routes/index.tsx", source: 'createFileRoute("/")' },
      { path: "/menu", source: 'createFileRoute("/menu")' },
      { path: "./about.ts", source: 'createFileRoute("/about")' },
    ],
  });
  assert.deepEqual(v.pages.map((p) => p.path), ["index.tsx", "menu.tsx", "about.tsx"]);
  assert.deepEqual(v.problems, []);
});

test("a path that escapes src/routes is dropped", () => {
  const v = validatePages({ pages: [
    { path: "../../worker.js", source: 'createFileRoute("/")' },
    { path: "index.tsx", source: 'createFileRoute("/")' },
  ] });
  assert.deepEqual(v.pages.map((p) => p.path), ["index.tsx"]);
  assert.match(v.problems.join(" "), /not a route file name/);
});

test("the root layout and the generated route tree cannot be overwritten", () => {
  const v = validatePages({ pages: [
    { path: "__root.tsx", source: 'createFileRoute("/")' },
    { path: "routeTree.gen.ts", source: 'createFileRoute("/")' },
  ] });
  assert.deepEqual(v.pages, []);
});

test("a file that is not a route is rejected, not compiled", () => {
  const v = validatePages({ pages: [{ path: "index.tsx", source: "export const x = 1;" }] });
  assert.deepEqual(v.pages, []);
  assert.match(v.problems.join(" "), /does not export a Route/);
});

test("a missing home page is reported", () => {
  const v = validatePages({ pages: [{ path: "menu.tsx", source: 'createFileRoute("/menu")' }] });
  assert.equal(v.pages.length, 1);
  assert.match(v.problems.join(" "), /no index\.tsx/);
});

test("duplicates and overlong files are dropped with a reason", () => {
  const v = validatePages({ pages: [
    { path: "index.tsx", source: 'createFileRoute("/")' },
    { path: "index.tsx", source: 'createFileRoute("/") // again' },
    { path: "huge.tsx", source: 'createFileRoute("/huge")' + "x".repeat(30000) },
  ] });
  assert.deepEqual(v.pages.map((p) => p.path), ["index.tsx"]);
  assert.match(v.problems.join(" "), /written twice/);
  assert.match(v.problems.join(" "), /over 24000 characters/);
});

test("more pages than the cap are trimmed, and said to be", () => {
  const many = Array.from({ length: MAX_PAGES + 2 }, (_, i) => ({ path: `p${i}.tsx`, source: 'createFileRoute("/p")' }));
  const v = validatePages({ pages: many });
  assert.equal(v.pages.length, MAX_PAGES);
  assert.match(v.problems.join(" "), new RegExp("More than " + MAX_PAGES + " pages"));
});

test("junk in, no crash out", () => {
  for (const input of [null, undefined, {}, { pages: "nope" }, { pages: [null, 3, {}] }]) {
    assert.deepEqual(validatePages(input).pages, []);
  }
});

test("notes are carried through and clipped", () => {
  assert.equal(validatePages({ pages: [], notes: "  left out the login  " }).notes, "left out the login");
  assert.equal(validatePages({ pages: [], notes: "x".repeat(900) }).notes.length, 600);
});

// ── the checks that catch a page which compiles and still fails ───────────────

test("the reference page is clean against its own schema", () => {
  assert.deepEqual(lintPages(page(REFERENCE_PAGE), SPEC), [],
    "the page the generator is told to imitate must pass every check it is judged by");
});

// ── the lint must predict the API, not a paraphrase of it ─────────────────────
// These rules used to be written out in both site-data.mjs and page-gen.mjs, and
// had drifted: the lint claimed a read of a `feed` or `admin` table returns 403,
// which the API does not do. Reporting a defect the API would not produce is
// worse than missing one — every problem here costs a paid repair pass.

test("reading a member table without useMember is reported", () => {
  // Since visitor accounts exist, feed and admin answer 401 to a signed-out
  // caller. A page that lists one without offering a sign-in renders an error to
  // every first-time visitor and looks broken rather than locked.
  const spec = { tables: [
    { name: "posts", access: "feed", columns: [{ name: "body" }] },
    { name: "notices", access: "admin", columns: [{ name: "body" }] },
  ] };
  const p = lintPages(page('useRows("posts"); useRows("notices");'), spec);
  assert.equal(p.length, 2, JSON.stringify(p));
  assert.match(p[0], /without useMember/);
});

test("the documentation examples are gone, not merely unimported", () => {
  // The lint used to refuse `@/examples/*` because every file in that folder
  // COMPILED, so a page importing one published placeholder copy to a real
  // customer with nothing in the pipeline objecting. The folder was deleted
  // 2026-07-31 and the rule with it — which is only safe while the files are
  // actually absent. Restore them without restoring the rule and the silent
  // failure comes back, so this asserts the premise the deletion rests on
  // rather than the rule it removed.
  const dir = path.join(TEMPLATE, "src", "examples");
  assert.ok(!fs.existsSync(dir),
    "src/examples is back; it compiles, so nothing else catches an import of it — restore the lint rule in page-gen.mjs or remove the folder again");
});

test("reading a member table WITH useMember is fine", () => {
  const spec = { tables: [{ name: "posts", access: "feed", columns: [{ name: "body" }] }] };
  assert.deepEqual(lintPages(page('const { data: me } = useMember(); useRows("posts");'), spec), []);
});

test("writing to a member table without a member is reported", () => {
  // Since accounts exist, a feed write by someone signed IN is exactly what the
  // level is for. What is wrong is a form with no sign-in behind it.
  const spec = { tables: [{ name: "posts", access: "feed", columns: [{ name: "body" }] }] };
  const p = lintPages(page('useCreateRow("posts");'), spec);
  assert.equal(p.length, 1, JSON.stringify(p));
  assert.match(p[0], /without useMember/);
  assert.deepEqual(lintPages(page('const { data: me } = useMember(); useCreateRow("posts");'), spec), []);
});

test("a user table needs a member, and says so", () => {
  const p = lintPages(page('useRows("profiles"); useCreateRow("profiles");'), SPEC).join(" ");
  assert.match(p, /useMember/, "should say what to do, not just that it is refused");
});

test("the lint's access rules ARE the API's — same module, not a copy", async () => {
  const api = await import("../site-access.mjs");
  // If these ever diverge the lint starts reporting defects the API would not
  // produce, which is exactly the drift this module was extracted to prevent.
  for (const level of api.ACCESS_LEVELS) {
    const spec = { tables: [{ name: "t", access: level, columns: [{ name: "c" }] }] };
    // Anonymous: exactly what canRead/canWriteAccess say.
    assert.equal(lintPages(page('useRows("t");'), spec).length === 0, api.canReadAccess(level),
      `anonymous read of a "${level}" table: lint and API must agree`);
    assert.equal(lintPages(page('useCreateRow("t");'), spec).length === 0, api.canWriteAccess(level),
      `anonymous write to a "${level}" table: lint and API must agree`);
    // `canMemberWrite`, NOT `needsMember` — AND THIS ASSERTION IS WHY THE BUG
    // SURVIVED. `needsMember` is true for `admin`, so this line required the lint
    // to stay SILENT about an admin form: it pinned the defect in place and went
    // green every run. admin is granted SELECT and nothing else, so that form
    // published and then refused its own administrator.
    const wroteAsMember = lintPages(page('const { data: me } = useMember(); useCreateRow("t");'), spec);
    assert.equal(wroteAsMember.length === 0, api.canWriteAccess(level) || api.canMemberWrite(level),
      `signed-in write to a "${level}" table: ${JSON.stringify(wroteAsMember)}`);
    // Editing follows the same split, and was checked against no table at all.
    const editedAsMember = lintPages(page('const { data: me } = useMember(); useUpdateRow("t");'), spec);
    assert.equal(editedAsMember.length === 0, api.canMemberWrite(level),
      `signed-in edit of a "${level}" table: ${JSON.stringify(editedAsMember)}`);
    // With a member in the page, the three member levels become reachable and
    // the two anonymous levels are unchanged — the lint must track that too, or
    // it forbids the pages this whole feature exists to allow.
    const withMember = lintPages(page('const { data: me } = useMember(); useRows("t");'), spec);
    assert.equal(withMember.length === 0, api.canReadAccess(level) || api.needsMember(level),
      `signed-in read of a "${level}" table: ${JSON.stringify(withMember)}`);
  }
});

test("the managed-column list is the API's, not a second copy of it", async () => {
  const api = await import("../site-access.mjs");
  assert.deepEqual(MANAGED_COLUMNS, api.MANAGED_COLUMNS);
  // And the rules the model reads name every one of them.
  for (const col of api.MANAGED_COLUMNS) assert.ok(PAGE_RULES.includes(col), `rules omit ${col}`);
});

test("listing a collect table is caught — the API returns 403", () => {
  const p = lintPages(page('const a = useRows<Row>("appointments");\n' + 'createFileRoute("/")'), SPEC);
  assert.equal(p.length, 1);
  assert.match(p[0], /access "collect" — reading it returns 403/);
});

test("submitting to a display table is caught", () => {
  const p = lintPages(page('const c = useCreateRow("services");'), SPEC);
  assert.match(p.join(" "), /access "display" — writing to it returns 403/);
});

test("a table that was never declared is caught on read and on write", () => {
  const p = lintPages(page('useRows("reviews"); useCreateRow("orders");'), SPEC);
  assert.match(p.join(" "), /reads table "reviews", which the schema does not declare/);
  assert.match(p.join(" "), /writes to table "orders", which the schema does not declare/);
});

test("a page that reaches for fetch is caught", () => {
  assert.match(lintPages(page('const r = await fetch("/api/db/x");'), SPEC).join(" "), /calls fetch directly/);
});

test("refetch is not fetch", () => {
  assert.deepEqual(lintPages(page("services.refetch(); void queryClient.refetchQueries();"), SPEC), []);
});

test("fetch named only in a comment is not reported", () => {
  assert.deepEqual(lintPages(page("// never call fetch( here\n/* nor fetch( here */"), SPEC), []);
});

test("editing without a member, or without a member table, is reported", () => {
  // PATCH and DELETE work as of 2026-07-28, but only on a member's OWN rows. So
  // an edit UI with no session has nothing to scope by (401), and a schema with
  // no member table has no editable row at all — `collect` and `display` rows
  // have no owner.
  const spec = { tables: [{ name: "mine", access: "user", columns: [{ name: "body" }] }] };
  const noMember = lintPages(page('useRows("mine"); useUpdateRow("mine");'), spec);
  assert.ok(noMember.some((x) => /edits "mine" without useMember/.test(x)), JSON.stringify(noMember));

  // A COMPUTED table name still gets the blunt check. The per-table loop cannot
  // resolve it, and dropping the old rules outright would have made an unresolved
  // call silently lint-clean — a smaller version of the hole being closed.
  const computed = lintPages(page('const t = "mine"; useRows("mine"); useUpdateRow(t);'), spec);
  assert.ok(computed.some((x) => /useUpdateRow\/useDeleteRow without useMember/.test(x)), JSON.stringify(computed));

  assert.deepEqual(
    lintPages(page('const { data: me } = useMember(); useRows("mine"); useUpdateRow("mine"); useDeleteRow("mine");'), spec),
    [], "a signed-in member editing their own rows is exactly what the level is for");

  // NAMED, not merely "this schema has no member table". The per-table rule says
  // which table and why, which is what the page's author has to act on — and it
  // fires on a schema that DOES have member tables too, where the old blunt check
  // was silent because it only ever asked whether any member table existed.
  const displayOnly = { tables: [{ name: "menu", access: "display", columns: [{ name: "title" }] }] };
  const p2 = lintPages(page('const { data: me } = useMember(); useRows("menu"); useDeleteRow("menu");'), displayOnly);
  assert.ok(p2.some((x) => /edits "menu".*access "display".*403/.test(x)), JSON.stringify(p2));

  // The case the old rule could not see at all: a schema WITH a member table,
  // and a page editing the display one beside it.
  const mixed = { tables: [
    { name: "mine", access: "user", columns: [{ name: "body" }] },
    { name: "menu", access: "display", columns: [{ name: "title" }] },
  ] };
  const p3 = lintPages(page('const { data: me } = useMember(); useRows("menu"); useUpdateRow("menu");'), mixed);
  assert.ok(p3.some((x) => /edits "menu".*403/.test(x)), JSON.stringify(p3));

  // And an `admin` table, which is granted SELECT and nothing else.
  const adminSpec = { tables: [{ name: "notices", access: "admin", columns: [{ name: "body" }] }] };
  const p4 = lintPages(page('const { data: me } = useMember(); useRows("notices"); useCreateRow("notices");'), adminSpec);
  assert.ok(p4.some((x) => /submits to "notices".*403/.test(x)), JSON.stringify(p4));
});

test("a ui component that does not exist is caught", () => {
  const p = lintPages(page('import { useToast } from "@/components/ui/use-toast";'), SPEC);
  assert.match(p.join(" "), /use-toast", which does not exist/);
  assert.deepEqual(lintPages(page('import { Button } from "@/components/ui/button";'), SPEC), []);
});

test("mixing in TanStack Form is caught — shadcn's inputs would not validate", () => {
  const p = lintPages(page('import { useForm } from "@tanstack/react-form";'), SPEC);
  assert.match(p.join(" "), /only speak to react-hook-form/);
});

test("every problem names the file it is in", () => {
  const p = lintPages([{ path: "menu.tsx", source: 'useRows("appointments");' }], SPEC);
  assert.match(p[0], /^menu\.tsx: /);
});

test("the same problem in one file is reported once", () => {
  const p = lintPages(page('useRows("appointments"); useRows("appointments");'), SPEC);
  assert.equal(p.length, 1);
});

// ── the repair turn ───────────────────────────────────────────────────────────

test("the repair prompt carries the files, the problems and the schema", () => {
  const r = repairPrompt("a barber shop", SPEC, page("const x = 1;"), ["index.tsx: calls fetch directly"], "Chop");
  assert.match(r, /THE SITE IS CALLED\nChop/);
  assert.match(r, /=== src\/routes\/index\.tsx ===/);
  assert.match(r, /- index\.tsx: calls fetch directly/);
  assert.match(r, /TABLE services/);
  assert.match(r, /a barber shop/);
  assert.match(r, /COMPLETE set of route files/);
});

test("the digest describes columns whether they are objects or names", () => {
  // Two shapes are live. normalizeSchema produces rich objects; the schema
  // persisted in a site's own `_meta` stores plain NAMES. Filtering on `c.name`
  // dropped every string, so a spec read back from _meta described each table as
  // having no columns — and the generator wrote pages that said exactly that.
  // Shipped for one deploy on 2026-07-28; every site built in that window came
  // out with "declared with no columns" in its notes.
  const rich = schemaDigest({ tables: [{ name: "menu", access: "display", columns: [{ name: "title", type: "text" }, { name: "price", type: "real" }] }] });
  assert.match(rich, /title \(text\)/);
  assert.match(rich, /price \(real\)/);

  const names = schemaDigest({ tables: [{ name: "menu", access: "display", columns: ["title", "price"] }] });
  assert.match(names, /title/, "a name-only column must still be described: " + names);
  assert.match(names, /price/);
  assert.ok(!/columns: \(none\)/.test(names), "this is the exact string the broken build emitted: " + names);
});

test("a display table's filter list survives the name-only shape too", () => {
  // The generator is told what it may order and filter by. With strings dropped
  // that list collapsed to just "id", so pages could not sort or filter at all.
  const d = schemaDigest({ tables: [{ name: "menu", access: "display", columns: ["title", "price"] }] });
  assert.match(d, /order \/ filter by: title, price, id/);
});

test("a genuinely empty table still reads as empty", () => {
  const d = schemaDigest({ tables: [{ name: "t", access: "display", columns: [] }] });
  assert.match(d, /columns: \(none\)/);
});

// ──────────────────────────────────────────────── what a revise tells the model
//
// A revise sends {slug, instruction}, so the generator's whole knowledge of the
// site used to be one line like "add a gallery" — and since it rewrites every
// page each time, a working barber shop came back as a page listing a gallery
// and nothing else. The merged schema fixed the tables; this is the intent.

test("a first build sends the brief unchanged", () => {
  assert.equal(briefForPages({ brief: "a barber shop in Lisbon" }), "a barber shop in Lisbon");
  assert.equal(briefForPages({ brief: "a barber shop", priorBrief: "" }), "a barber shop");
});

test("a revise carries the original brief AND the instruction", () => {
  const out = briefForPages({ brief: "add a gallery", priorBrief: "a barber shop in Lisbon" });
  assert.match(out, /a barber shop in Lisbon/, "without this the site is rewritten as a gallery");
  assert.match(out, /add a gallery/);
  assert.match(out, /WHAT TO CHANGE NOW/, "and the two must be distinguishable");
  assert.ok(out.indexOf("a barber shop") < out.indexOf("add a gallery"), "original first, change last");
});

test("it says to keep what the original asked for", () => {
  // The failure mode is subtraction, not addition: the model has the old brief
  // and still drops half of it because the instruction only mentions one thing.
  assert.match(briefForPages({ brief: "add a gallery", priorBrief: "a barber shop" }), /keep everything/i);
});

test("a repeated brief is not doubled up", () => {
  // Sending the same brief again is a rebuild, not a change.
  assert.equal(briefForPages({ brief: "a barber shop", priorBrief: "a barber shop" }), "a barber shop");
  assert.equal(briefForPages({ brief: " a barber shop ", priorBrief: "a barber shop" }), "a barber shop");
});

test("a schema-only build with no instruction falls back to the stored brief", () => {
  assert.equal(briefForPages({ brief: "", priorBrief: "a barber shop" }), "a barber shop");
  assert.equal(briefForPages({ priorBrief: "a barber shop" }), "a barber shop");
});

test("nothing at all is an empty string, not a crash or the word undefined", () => {
  assert.equal(briefForPages(), "");
  assert.equal(briefForPages({}), "");
  assert.equal(briefForPages({ brief: null, priorBrief: undefined }), "");
});

test("the rules tell the model what an image column is, and to guard it", () => {
  // Uploads land as a URL in a plain text column, so a page renders them with a
  // bare <img>. The guard is the part that matters: the owner fills these in
  // AFTER the build, so on a fresh site the value is empty and an unguarded
  // <img src=""> is a broken image on every card.
  assert.match(PAGE_RULES, /A COLUMN NAMED FOR A PICTURE HOLDS A URL STRING/);
  assert.match(PAGE_RULES, /\/u\/<slug>\//, "and where those URLs come from");
  assert.match(PAGE_RULES, /ALWAYS GUARD IT/);
  assert.match(PAGE_RULES, /placeholder box,\s+never a broken one/, "an image or a box, never <img src=\"\">");
});

test("the rules tell the model how a visitor attaches a picture", () => {
  // Upload first, submit the URL as an ordinary text field. The row write stays
  // plain JSON — a model reaching for multipart would produce a form that 400s.
  assert.match(PAGE_RULES, /useUploadFile/);
  // The rules text wraps, so anything asserted across a line break needs \s+.
  assert.match(PAGE_RULES, /only when its table declares an image\s+column/i);
  assert.match(PAGE_RULES, /still plain JSON/);
  assert.match(PAGE_RULES, /SVG is refused/);
  assert.match(PAGE_RULES, /2 MB/, "say the cap next to the control, not after the pick");
});

test("the upload hook the rules name really exists in the template", () => {
  // A rule that names an export the template does not have is a rule that
  // produces code which does not compile.
  const rows = fs.readFileSync(path.join(TEMPLATE, "src", "lib", "rows.ts"), "utf8");
  for (const fn of ["useUploadFile", "uploadFile"]) {
    assert.match(rows, new RegExp("export (async )?function " + fn), fn);
  }
});

test("the rules tell the model how a booking page shows a taken slot", () => {
  // A collect table cannot be read — that is the point of it — so without this
  // the model has no way to grey out a time somebody already booked, and every
  // generated booking form lets two people pick the same one.
  assert.match(PAGE_RULES, /usePublicRows/);
  assert.match(PAGE_RULES, /WHICH SLOTS ARE TAKEN/);
  assert.match(PAGE_RULES, /never a name or an email/);
  const rows = fs.readFileSync(path.join(TEMPLATE, "src", "lib", "rows.ts"), "utf8");
  assert.match(rows, /export function usePublicRows/, "a rule naming an export the template lacks produces code that does not compile");
});

test("a public projection is typed as having no id, because it has none", () => {
  // `usePublicRows` was `<T extends Row>`, and `Row` requires `id: number` — the
  // one field a publicView can NEVER carry, since the schema engine refuses
  // `id` and `owner_id` in a projection. So an honest type was a compile error
  // and the only type that compiled was a lie that left `row.id` undefined, and
  // therefore a React key of `undefined` on every row. Measured live
  // 2026-07-29: TS2344, the page refused, the whole site published as the
  // placeholder.
  const rows = fs.readFileSync(path.join(TEMPLATE, "src", "lib", "rows.ts"), "utf8");
  assert.match(rows, /export type PublicRow/, "the projection needs a type of its own");
  assert.ok(!/export function usePublicRows<T extends Row/.test(rows),
    "usePublicRows must not demand a field the projection cannot contain");
  assert.match(rows, /export function usePublicRows<T = PublicRow>/);
  // And the model has to be told, or it writes `Row & {…}` and keys on id.
  assert.match(PAGE_RULES, /These rows have NO `id`/);
  assert.match(PAGE_RULES, /PublicRow/);
});

test("no hook constrains its row type to Row, because an interface never satisfies it", () => {
  // `Row` intersects `Record<string, unknown>`, and an INTERFACE gets no implicit
  // index signature where a type alias does. So `<T extends Row>` refused this:
  //
  //     interface Booking { id: number; starts_at: string }
  //     useRows<Booking>("bookings")     // TS2344
  //
  // Every field present, an `id`, and refused — on a keyword that has nothing to
  // do with the data. Measured live 2026-08-04 on a real build:
  // `index.tsx(57,25) TS2344 'PublicBooking'`, page refused, site published as
  // the placeholder. It also refused a caller who typed only the columns they
  // render, which is ordinary and honest.
  //
  // DERIVED, not a list of four names: it scans every exported hook, so one
  // added later is covered without anyone remembering this. `Row` stays as the
  // DEFAULT — that is what makes an unannotated `useRows("menu")` usable.
  const rows = fs.readFileSync(path.join(TEMPLATE, "src", "lib", "rows.ts"), "utf8");
  const hooks = [...rows.matchAll(/export function (use\w+)\s*<([^>]*)>\s*\(/g)];
  assert.ok(hooks.length >= 5, `only ${hooks.length} generic hooks found — the scan stopped working`);
  const constrained = hooks.filter(([, , params]) => /\bextends\s+Row\b/.test(params));
  assert.deepEqual(constrained.map(([, name]) => name), [],
    "these demand a type an interface can never be, so an ordinary row declaration is TS2344");
  // The positive half: the scan passing on a file with no hooks left proves nothing.
  for (const h of ["useRows", "useRow", "useCreateRow", "useUpdateRow"]) {
    assert.match(rows, new RegExp("export function " + h + "<T = Row>"),
      h + " must still DEFAULT to Row — that is what makes an unannotated call usable");
  }
});

test("the schema engine really does refuse id in a projection", () => {
  // The premise the type rests on. If this ever changed, PublicRow would be
  // wrong in the other direction and nothing else would say so.
  const schema = fs.readFileSync(path.join(ROOT, "site-schema.mjs"), "utf8");
  assert.match(schema, /c !== "owner_id" && c !== "id"/,
    "publicView must still strip id and owner_id — PublicRow is typed on that");
});

test("the rules tell the model to hand back the claim, and the hooks exist", () => {
  // The token is issued exactly once, in the response to the insert. A page that
  // drops it strands that booking forever — nobody but the site owner can ever
  // reach it again — so the model has to be told, and told what to do with it.
  assert.match(PAGE_RULES, /claim/);
  assert.match(PAGE_RULES, /useClaimedRow/);
  assert.match(PAGE_RULES, /useCancelClaim/);
  const rows = fs.readFileSync(path.join(TEMPLATE, "src", "lib", "rows.ts"), "utf8");
  for (const fn of ["useClaimedRow", "useCancelClaim"]) {
    assert.match(rows, new RegExp("export function " + fn), fn + " is named by the rules but missing from the template");
  }
  // The token is no longer a field our API mints and types. As of 2026-07-30 it is a
  // column the SCHEMA declares and a `SECURITY DEFINER` function opens, so what has
  // to hold is that both hooks take a FUNCTION NAME — a page calling them with a
  // table name reaches an endpoint that does not exist.
  assert.match(rows, /useClaimedRow<T = Row>\(fn: string/, "useClaimedRow must take the function name");
  assert.match(rows, /useCancelClaim\(fn: string\)/, "useCancelClaim must take the function name");
  assert.match(PAGE_RULES, /FUNCTION NAME the schema/, "the rules must say so, or the model passes a table");
});

test("the rules describe member tables as they actually behave", () => {
  // They said a `user` table returns 403 and told the model to LEAVE member
  // tables out — text written before visitor accounts existed, sitting under a
  // heading that says "this is not a matter of taste". It would have stopped
  // the generator ever building a sign-in page.
  assert.ok(!/leave it out rather than build against it/.test(PAGE_RULES),
    "the rules must not tell the model to skip member tables");
  assert.match(PAGE_RULES, /PRIVATE PER MEMBER/);
  assert.match(PAGE_RULES, /signed out, both return 401/i, "signed out is 401, not 403");
});

test("the rules and ACCESS_NOTE agree about every access level", () => {
  // Two descriptions of the same rule in one prompt is how they drifted apart
  // the first time.
  for (const level of ["user", "feed", "admin"]) {
    assert.ok(ACCESS_NOTE[level], level);
  }
  // "SHARED, ROLE-WRITABLE" is gone: admin is granted SELECT and nothing else, so
  // describing it as writable-by-a-role was a promise about the deleted Worker
  // data API, which is the only thing that ever checked `writeRoles`.
  assert.ok(!PAGE_RULES.includes("ROLE-WRITABLE"), "the rules still call admin writable");
  for (const phrase of ["PRIVATE PER MEMBER", "SHARED, MEMBER-AUTHORED", "SHARED, READ-ONLY FROM THE SITE"]) {
    assert.ok(PAGE_RULES.includes(phrase), "rule 2 must match ACCESS_NOTE: " + phrase);
    assert.ok(Object.values(ACCESS_NOTE).some((v) => v.includes(phrase)), phrase);
  }
});



test("the rules no longer claim uploads are impossible", () => {
  // Rule 8 tells the model a form MAY accept an image; this section used to say
  // there was no route for one. A prompt that contradicts itself gets obeyed
  // unpredictably.
  assert.ok(!/No file or image upload/.test(PAGE_RULES));
  assert.match(PAGE_RULES, /uploadFile|useUploadFile/);
});

// ------------------------------------------------- publicView, stated not guessed
//
// Rule 9 tells the model not to call `usePublicRows` on a table with no public
// view — a rule it could not follow, because nothing in the digest said which
// tables have one. Measured live 2026-07-29: the generator worked out that
// `bookings` had none, could not build the taken-slots hint, and the whole site
// came out as the PLACEHOLDER over one optional enhancement.

const PV_SPEC = {
  tables: [
    {
      name: "bookings", access: "collect",
      columns: [{ name: "slot_date", type: "text" }, { name: "customer_name", type: "text" }],
      publicView: { columns: ["slot_date"], where: [], limit: 500 },
    },
    { name: "enquiries", access: "collect", columns: [{ name: "message", type: "text" }] },
  ],
};

test("the digest says, per table, whether usePublicRows works", () => {
  const d = schemaDigest(PV_SPEC);
  assert.match(d, /bookings[\s\S]*?usePublicRows: YES/, "a table with a public view says so");
  assert.match(d, /usePublicRows: YES — anyone may read slot_date/, "...and names exactly what it publishes");
  assert.match(d, /enquiries[\s\S]*?usePublicRows: NO/, "and one without says THAT");
  // Never the PII column, or the digest itself invites the leak the projection exists to prevent.
  assert.ok(!/usePublicRows: YES[^\n]*customer_name/.test(d), "the digest must not advertise a column the view excludes");
});

test("a `display` table is not told about public views at all", () => {
  // It is readable by anyone already; the line would be noise on every table
  // that has no use for it.
  assert.ok(!/usePublicRows/.test(schemaDigest(SPEC).split("TABLE appointments")[0]));
});

test("an EMPTY publicView reads as none", () => {
  // The runtime answers 404 for this shape, so the digest must not promise it.
  for (const pv of [{ columns: [] }, {}, null, { columns: "slot_date" }]) {
    const spec = { tables: [{ name: "bookings", access: "collect", columns: [{ name: "slot_date" }], publicView: pv }] };
    assert.match(schemaDigest(spec), /usePublicRows: NO/, JSON.stringify(pv));
  }
});

test("the lint refuses a public read of a table with no public view", () => {
  // The exact 404 the smoke test's site would have served.
  const p = lintPages(page('usePublicRows("enquiries");'), PV_SPEC);
  assert.equal(p.length, 1);
  assert.match(p[0], /enquiries/);
  assert.match(p[0], /404/);
  assert.match(p[0], /without the taken-slots hint/, "and says what to do instead, or the repair pass has nothing to act on");
});

test("the lint allows a public read of a table that declares one", () => {
  assert.deepEqual(lintPages(page('usePublicRows("bookings");'), PV_SPEC), []);
});

test("the lint still catches a public read of a table that does not exist", () => {
  const p = lintPages(page('usePublicRows("nope");'), PV_SPEC);
  assert.equal(p.length, 1);
  assert.match(p[0], /does not declare/);
});

test("the lint and everything that enforces access ask ONE question about public views", () => {
  // Two copies of this rule is a copy that drifts, and the drift ships as a site
  // whose form is dead: the lint passes the page, the API answers 404.
  //
  // The enforcing side was site-data.mjs, deleted 2026-07-30 when the data routes
  // moved to Neon's Data API. So the list is DERIVED — every file that mentions a
  // public view must reach for the shared helper rather than restate it — instead
  // of naming files, which is what made this test go red on a deletion that had
  // nothing to do with the invariant.
  const access = fs.readFileSync(path.join(ROOT, "site-access.mjs"), "utf8");
  assert.match(access, /export function hasPublicView/, "the shared rule lives in the leaf module");

  const candidates = fs.readdirSync(ROOT).filter((f) => /^site-.*\.mjs$/.test(f) && f !== "site-access.mjs")
    .map((f) => [f, fs.readFileSync(path.join(ROOT, f), "utf8")])
    .concat([["builder/page-gen.mjs", fs.readFileSync(path.join(ROOT, "builder", "page-gen.mjs"), "utf8")]]);
  const users = candidates.filter(([, src]) => /publicView/.test(src));
  assert.ok(users.length, "nothing mentions publicView — this test is watching nothing");
  // Blank the comments before looking. This fired on a comment that merely
  // QUOTED the rule while explaining why the code no longer restates it —
  // the recurring failure in this repo, and the fix is always the same: scan
  // code, never prose. Blanked rather than deleted so offsets do not shift.
  const code = (s) => s.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (m) => m.replace(/[^\n]/g, " "));
  for (const [name, src] of users) {
    assert.ok(!/Array\.isArray\(pv\.columns\)/.test(code(src)), name + " keeps its own copy of the rule");
  }
});

test("no hook demands a bare `number` for a row id", () => {
  // Every id a page has arrives from the URL, and a router hands those over as
  // STRINGS. Typing the argument `number` meant no page that edits, deletes or
  // manages a row could compile — three separate TS errors in one production
  // build on 2026-07-29, and the whole site published as the placeholder each
  // time. `number` coming out, `string | number` going in.
  const rows = fs.readFileSync(path.join(TEMPLATE, "src", "lib", "rows.ts"), "utf8");
  assert.match(rows, /export type RowId = string \| number/);

  // Selected by BEHAVIOUR, not by name: any hook that puts an id into a row URL
  // is one the generator reaches with a route param. Matching on the name is
  // what let the first version of this guard pass while two hooks were still
  // wrong — `\bRow\b` never matches inside `useDeleteRow`.
  // Comments are stripped first: this file EXPLAINS the number/string asymmetry,
  // and prose about `id?: number` is not a signature. The same trap the
  // initSiteAuth guard hit.
  const blocks = rows.replace(/^\s*\/\/.*$/gm, "").split(/\nexport function /).slice(1);
  const offenders = [];
  let checked = 0;
  for (const b of blocks) {
    const name = b.slice(0, b.indexOf("(")).replace(/<.*/, "");
    // Any TABLE-scoped hook that accepts an id. Not "id in a path segment":
    // `useRow` passes it as a query string, and selecting on the path shape
    // silently skipped it. The passkey and identity hooks take an id too, but
    // theirs comes from a list response and never from a URL — they use
    // `authUrl`, not `base(table)`, so this excludes them by construction.
    if (!/\bbase\(table\)/.test(b) || !/\bid\b/.test(b)) continue;
    checked++;
    if (/\bid\??: number\b/.test(b)) offenders.push(name);
  }
  assert.ok(checked >= 4, "the scan found only " + checked + " id-in-URL hooks — it has drifted");
  assert.deepEqual(offenders, [], "these take a row id as a bare number: " + offenders.join(", "));

  // `Partial<T>` carries `id?: number` from Row, so intersecting narrows RowId
  // straight back to number unless the id is omitted first. That was the third
  // production error, still failing after the other signatures were widened.
  // Either order — an intersection is commutative, and the first version of this
  // check demanded one spelling, so a correct signature written the other way round
  // failed a test about type semantics on a question of word order.
  assert.ok(/Omit<Partial<T>, "id"> & \{ id: RowId \}/.test(rows) ||
            /\{ id: RowId \} & Omit<Partial<T>, "id">/.test(rows),
    "useUpdateRow must omit `id` from Partial<T> before widening it — Partial<T> carries " +
    "`id?: number` from Row, so intersecting narrows RowId straight back to number");
});

test("the rules make the manage page conditional on the schema declaring it", () => {
  // This used to assert that the rules taught the guarded shape of an optional
  // `claim` field, because destructuring it as required failed `tsc` and published
  // the placeholder. The field is gone: a claim is a column the schema declares and
  // a function opens, so the failure mode moved. Now the page is only buildable when
  // those functions exist, and a model that builds it regardless writes calls to
  // endpoints that are not there.
  assert.match(PAGE_RULES, /Only build the manage page if the schema actually declares/);
  assert.match(PAGE_RULES, /Never annotate a mutation callback's parameter/,
    "the contravariance rule still applies and cost three builds");
});


test("the Worker and the eval issue the SAME generation request", () => {
  // The eval exists to tune the generator. If it built its own request body, it
  // would be tuning a different prompt from the one production runs and every
  // conclusion drawn from it would be about nothing.
  const worker = fs.readFileSync(path.join(ROOT, "worker.js"), "utf8");
  const gen = worker.slice(worker.indexOf("async function generateSitePages"), worker.indexOf("function schemaPlaceholderPage"));
  assert.match(gen, /JSON\.stringify\(pagesRequest\(/, "generateSitePages must use pagesRequest");
  assert.ok(!/model:\s*"claude-/.test(gen), "the model must come from pagesRequest, not be restated here");
  assert.ok(!/tool_choice/.test(gen), "the tool choice must come from pagesRequest");
  const evalSrc = fs.readFileSync(path.join(ROOT, "test", "integration", "page-gen-eval.mjs"), "utf8");
  assert.match(evalSrc, /JSON\.stringify\(pagesRequest\(/, "the eval must use it too");
  assert.ok(!/model:\s*"claude-/.test(evalSrc), "the eval must not restate the model");
});

test("pagesRequest carries the budget and the tool", () => {
  const req = api.pagesRequest({ brief: "a cafe", spec: SPEC, brand: "Cafe" });
  assert.equal(req.model, "claude-sonnet-5");
  assert.equal(req.max_tokens, api.SITE_PAGES_MAX_TOKENS);
  assert.equal(req.tool_choice.name, "write_pages");
  assert.equal(req.tools[0], api.SITE_PAGES_TOOL);
  assert.equal(req.system[0].text, api.PAGE_RULES);
  assert.equal(req.messages.length, 1);
});

test("there is ONE model call a build — nothing can ask for a repair", () => {
  // The repair pass was removed 2026-08-04 because output is 80% of what a build
  // costs and a repair is a second whole generation. Held on the SOURCE, because
  // the ways it comes back are all invisible to a behavioural test: a `fix` key
  // quietly re-honoured by pagesRequest, or publish-pages calling generate twice.
  const req = api.pagesRequest({ brief: "a cafe", spec: SPEC, brand: "Cafe", fix: { pages: [{ path: "index.tsx", source: "x" }], problems: ["boom"] } });
  assert.equal(req.messages[0].content, api.pagesPrompt("a cafe", SPEC, "Cafe"),
    "a stray fix argument must be inert, not silently revive the repair prompt");

  const gen = fs.readFileSync(new URL("../builder/page-gen.mjs", import.meta.url), "utf8");
  const request = gen.slice(gen.indexOf("export function pagesRequest"));
  assert.ok(!/repairPrompt/.test(request.slice(0, request.indexOf("\n}"))),
    "pagesRequest must not reach for repairPrompt");

  // And the spender. `repairPrompt` still EXISTS, deliberately — it is one
  // decision away from mattering again — so "is it defined" proves nothing and
  // the real invariant is that publish-pages calls generate exactly once.
  const pub = fs.readFileSync(new URL("../builder/publish-pages.mjs", import.meta.url), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
  const calls = pub.match(/deps\.generate\s*\(/g) || [];
  assert.equal(calls.length, 1, `publish-pages calls generate ${calls.length} times; a build is one call`);
  assert.ok(!/deps\.generate\s*\(\s*[^)]/.test(pub), "and it passes no fix argument");
});

test("the system block is cached, and nothing variable is inside it", () => {
  // PAGE_RULES is ~7,000 tokens that are byte-identical on every generation, so
  // it is the whole reason a build's input cost is what it is. Dropping the
  // cache_control is invisible — every build still succeeds, it just silently
  // costs 7x again — which is exactly the class of regression a test has to hold.
  const a = api.pagesRequest({ brief: "a cafe", spec: SPEC, brand: "Cafe" });
  assert.ok(Array.isArray(a.system), "system must be a block array, or cache_control has nowhere to live");
  assert.deepEqual(a.system[0].cache_control, { type: "ephemeral" });

  // A cache entry is keyed on the BYTES. If anything brief-, schema- or
  // brand-specific leaked into the system block it would differ per build and
  // never hit — so this asserts two very different requests produce a
  // byte-identical cached prefix. Mutation-checked by interpolating the brand
  // into PAGE_RULES, which fails here and passes every other test in the file.
  const b = api.pagesRequest({ brief: "a barber in Liverpool", spec: { tables: [] }, brand: "Sharp Fade" });
  assert.equal(a.system[0].text, b.system[0].text, "the cached block must not vary between builds");
  assert.notEqual(a.messages[0].content, b.messages[0].content, "the variable half belongs in the user turn");

  // The repair pass re-sends the same block within the same build, which is the
  // one guaranteed hit — it is also the call that matters most, since a repair
  // only happens on a build that already went wrong.
  const fix = api.pagesRequest({ brief: "a cafe", spec: SPEC, brand: "Cafe",
    fix: { pages: [{ path: "index.tsx", source: "x" }], problems: ["boom"] } });
  assert.equal(fix.system[0].text, a.system[0].text);
  assert.deepEqual(fix.system[0].cache_control, { type: "ephemeral" });
});

test("no list hook hands back an envelope", () => {
  // `useSessions` returned `{ sessions }` while every other list hook unwrapped via
  // `select`, and the generator called `.map` straight onto it in ALL THREE eval
  // samples — reasonably, since nothing else behaved that way.
  //
  // The direction reversed on 2026-07-30: Neon's Data API answers a list with the
  // ARRAY itself, so there is no envelope to unwrap and the invariant is that
  // nobody re-introduces one. Same failure, opposite implementation, so the test is
  // rewritten rather than deleted.
  const rows = fs.readFileSync(path.join(TEMPLATE, "src", "lib", "rows.ts"), "utf8");
  const src = rows.replace(/^\s*\/\/.*$/gm, "");
  const hooks = [...src.matchAll(/export function (use\w*Rows)\b/g)].map((m) => m[1]);
  assert.ok(hooks.length >= 2, "expected at least useRows and usePublicRows, got " + hooks.join(","));
  for (const hook of hooks) {
    const i2 = src.indexOf("export function " + hook);
    const block = src.slice(i2, src.indexOf("\n}", i2));
    // A typed array in, a typed array out. `send<{ rows: T[] }>` or a `.then(r =>
    // r.something)` is the shape that bit us.
    assert.match(block, /send<T\[\]>/, hook + " must ask for an array, not an envelope: " + block);
    assert.ok(!/\.then\(\(r\) => r\.\w+\)/.test(block), hook + " unwraps an envelope it should not have: " + block);
    assert.match(block, /useQuery<T\[\]>/, hook + " must be typed as returning the array");
  }
});


test("the rules forbid annotating a mutation callback's parameter", () => {
  // TanStack's callback takes four arguments and its types are contravariant, so
  // a hand-written annotation is refused even when it looks right. Three build
  // failures came from exactly this.
  assert.match(PAGE_RULES, /Never annotate a mutation callback's parameter/);
});





// Every hook the rules name must actually exist in the template.
//
// The version of this test that was deleted on 2026-07-30 listed eleven hook
// names by hand, so it only guarded the eleven somebody had remembered — and it
// had to be deleted rather than fixed when the auth layer went. This one DERIVES
// the list from the prompt, which means it covers whatever the rules happen to
// mention today and cannot fall out of date.
//
// The failure it prevents: the model is told to import something that is not
// there, `tsc` refuses the page, the one repair pass fails the same way, and the
// site publishes as the placeholder. That has happened for exactly this reason
// more than once.
test("every hook the rules name is exported by the template", () => {
  const rows = fs.readFileSync(path.join(TEMPLATE, "src", "lib", "rows.ts"), "utf8");
  const exported = new Set(
    [...rows.matchAll(/export (?:async )?function (\w+)/g)].map((m) => m[1])
      .concat([...rows.matchAll(/export const (\w+)/g)].map((m) => m[1])),
  );
  // Backticked `useThing(` in the prose — how the rules always cite a hook.
  const named = [...new Set([...PAGE_RULES.matchAll(/`(use[A-Z]\w+)\(/g)].map((m) => m[1]))];
  assert.ok(named.length >= 4, "expected the rules to cite several hooks, found " + named.length);
  const missing = named.filter((n) => !exported.has(n));
  assert.deepEqual(missing, [],
    "the rules name " + missing.join(", ") + " and @/lib/rows does not export it — " +
    "the model is being told to import something that is not there, so tsc refuses the page " +
    "and the site publishes as the placeholder");
});

// Every ui component the RULES cite must exist — the other direction.
//
// The list-vs-disk guard above catches a component added to the template and not
// offered to the model. It does not catch the reverse: prose in the rules naming
// `@/components/ui/something` that was never installed. A mutation proved that
// gap — renaming a cited component in the rules passed the whole suite.
//
// Same failure as the hook guard: the model is told to import something absent,
// `tsc` refuses the page, the one repair pass fails identically, and the site
// publishes as the placeholder.
test("every ui component the rules cite is one the template has", () => {
  const cited = [...new Set(
    [...PAGE_RULES.matchAll(/@\/components\/ui\/([a-z0-9-]+)/g)].map((m) => m[1]),
  )];
  assert.ok(cited.length >= 2, "expected the rules to cite some components by path, found " + cited.length);
  const missing = cited.filter((c) => !UI_COMPONENTS.includes(c));
  assert.deepEqual(missing, [],
    "the rules point the model at " + missing.join(", ") + ", which the template does not have");
});

// What the registry ships and we deliberately do not take.
//
// The template was 12 components behind the registry until 2026-07-30, found by
// diffing against ui.shadcn.com/r/index.json rather than by reading the docs
// sidebar — which had already proved unreliable, listing `combobox` and
// `native-select` as though they were installable when neither has a new-york
// build at all.
//
// This pins the ONE we can install and refuse, because "we forgot it" and "we
// decided against it" look identical in a list of names a year later.
test("toast is left out on purpose, because sonner is already here", () => {
  // Both installed would give the model two ways to raise a toast, and it would
  // pick inconsistently between pages of the same site. shadcn's own docs treat
  // toast as superseded.
  assert.ok(UI_COMPONENTS.includes("sonner"), "sonner is the one we use");
  assert.ok(!UI_COMPONENTS.includes("toast"),
    "toast duplicates sonner — if it is ever added, the rules must say which to use");
  assert.match(PAGE_RULES, /toast\.(success|error)/,
    "and the rules must actually teach the sonner API, or neither is reachable");
});

// ── the eval sends what production sends ────────────────────────────────────
//
// The harness composed its own user turn and posted `{files}` to the build
// service, so it sampled the generator with NO family directive, NO theme and
// NO fonts: 447 characters where production sends 1,508, rendered on the bare
// template. Every number it reported described a pipeline the platform does not
// run, which is the one failure a measurement cannot survive.

test("briefWithLayout appends the family's directive, and never a null", () => {
  const withFam = api.briefWithLayout({ brief: "A yoga studio.", family: "salon" });
  assert.match(withFam, /^A yoga studio\.\n\n/);
  assert.match(withFam, /LAYOUT — /);

  // layoutDirective answers null for an unknown family or structure, and
  // interpolating that appends the literal word "null" and LOSES the layout.
  for (const args of [
    { brief: "A yoga studio." },
    { brief: "A yoga studio.", family: "not-a-family" },
    { brief: "A yoga studio.", family: "salon", structure: "not-a-structure" },
  ]) {
    const out = api.briefWithLayout(args);
    assert.equal(out, "A yoga studio.", JSON.stringify(args));
    assert.ok(!/null/.test(out), "a null directive must not reach the brief");
  }
});

test("worker.js and the eval both compose the brief through briefWithLayout", () => {
  // Derived at BOTH ends. Asserting only that the eval calls it would pass on a
  // worker that still composed its own, which is the drift this replaces.
  for (const f of ["../worker.js", "./integration/page-gen-eval.mjs"]) {
    const src = fs.readFileSync(new URL(f, import.meta.url), "utf8")
      .replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (m) => m.replace(/[^\n]/g, " "));
    assert.match(src, /briefWithLayout\(/, `${f} must compose the brief through the shared function`);
    assert.ok(!/layoutDirective\s*\(/.test(src), `${f} must not build the directive itself`);
  }
});

test("the eval posts a theme, fonts and a title to the build service", () => {
  // COMMENTS BLANKED FIRST. The comment above that body names theme/fonts/title
  // in order to explain them, so a raw scan is satisfied by the explanation —
  // caught by mutation: stripping the whole post down to `{files}` passed. Third
  // time this exact shape has bitten in one sitting; blank, never delete, so
  // offsets stay valid.
  const src = fs.readFileSync(new URL("./integration/page-gen-eval.mjs", import.meta.url), "utf8")
    .replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (m) => m.replace(/[^\n]/g, " "));
  const body = src.slice(src.indexOf("async function compile"), src.indexOf("const shapeOf"));
  assert.ok(body.length > 100, "the guard must actually be looking at the function");
  // Asserted on what the POST BODY carries, not on the function generally.
  const post = (body.match(/JSON\.stringify\(\{[^}]*\}/) || [""])[0];
  for (const key of ["theme", "fonts", "title"]) {
    assert.match(post, new RegExp("\\b" + key + "\\b"),
      `the build post must carry ${key}, or every sample renders on the bare template`);
  }
});

test("the eval's family, theme and fonts are real ones", async () => {
  // A name that does not resolve fails SILENTLY — the build falls back to the
  // default and the sample looks fine. Caught exactly this way while writing it:
  // the first theme I picked did not exist.
  // EVERY SCENARIO, not the one that used to be a top-level constant. The eval
  // samples three site shapes now, each with its own family, theme and font
  // pair — so there are three of each to get wrong, and the failure mode is
  // unchanged: a name that does not resolve falls back to the default and the
  // sample looks fine.
  const src = fs.readFileSync(new URL("./integration/page-gen-eval.mjs", import.meta.url), "utf8");
  const [layouts, themes, fonts] = await Promise.all([
    import("../builder/site-layouts.mjs"),
    import("../builder/site-theme-registry.mjs"),
    import("../builder/site-fonts.mjs"),
  ]);

  const block = src.slice(src.indexOf("const SCENARIOS = ["), src.indexOf("for (const sc of SCENARIOS)"));
  assert.ok(block.length > 200, "the SCENARIOS block is gone — retarget this test");
  const scenarios = [...block.matchAll(
    /key: "([^"]+)",\s*family: "([^"]+)",\s*theme: "([^"]+)",\s*fonts: \{ heading: "([^"]+)", body: "([^"]+)" \}/g,
  )];
  assert.ok(scenarios.length >= 2,
    `only ${scenarios.length} scenario(s) parsed — the eval measures one shape again, or the scan broke`);

  for (const [, key, family, theme, heading, body] of scenarios) {
    assert.ok(layouts.READY_FAMILIES.includes(family), `${key}: family ${family} is not a ready family`);
    assert.ok(layouts.layoutDirective(family, {}), `${key}: ${family} produces no directive`);
    assert.ok(themes.resolveTheme(theme), `${key}: theme ${theme} does not resolve`);
    const pair = fonts.resolvePair({ heading, body });
    assert.deepEqual(pair.notes || [], [], `${key}: fonts fell back: ${JSON.stringify(pair.notes)}`);
  }
});

test("a run that never reached the model cannot publish a compile rate", () => {
  // Measured 2026-08-04: the Anthropic account ran out of credit, all three
  // samples threw `400 credit balance is too low`, and the eval wrote
  // "**0/3 compiled**" into the repo — which reads, permanently, as "the
  // generator cannot build any of these shapes". It also wiped the previous run's
  // saved pages on the way, so the last real measurement was destroyed by an
  // outage.
  //
  // Same failure the Worker learned one layer down, where a provider outage and
  // the model writing an unusable page came back indistinguishable.
  const src = fs.readFileSync(new URL("./integration/page-gen-eval.mjs", import.meta.url), "utf8");
  const code = src.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (m) => m.replace(/[^\n]/g, " "));

  assert.match(code, /reachedModel = true/, "nothing records that a sample got an answer");
  // The bail must come BEFORE the report is written, or it reports and then bails.
  const bail = code.indexOf("if (!reachedModel)");
  const write = code.indexOf("PAGE-GEN.md");
  assert.ok(bail > 0, "no outage branch");
  assert.ok(bail < write, "the outage check runs after the report is written, so the zero is published anyway");

  // And the wipe must be lazy, or the evidence is gone before the run finds out.
  assert.ok(!/rmSync\(path\.join\(ROOT, "docs", "auth-audit", "pages"\)/.test(code),
    "the pages directory is still wiped up front, so an outage destroys the last real samples");
  assert.match(code, /if \(!wiped\)/, "the lazy wipe is gone");
});

test("the eval's shapes exercise DIFFERENT access levels", () => {
  // Three briefs that all produce the same schema shape would cost three times
  // as much and measure the same thing once. The point of the extra spend is
  // coverage: a menu-only site has no form and no members, an internal tool
  // needs a signed-in member on every page, and only the booking one has a
  // publicView. Asserted so a later edit cannot quietly collapse them.
  const src = fs.readFileSync(new URL("./integration/page-gen-eval.mjs", import.meta.url), "utf8");
  const block = src.slice(src.indexOf("const SCENARIOS = ["), src.indexOf("for (const sc of SCENARIOS)"));
  const perShape = block.split(/key: "/).slice(1).map((chunk) => {
    const key = chunk.slice(0, chunk.indexOf('"'));
    return { key, levels: new Set([...chunk.matchAll(/access: "(\w+)"/g)].map((m) => m[1])) };
  });
  const signature = (s2) => [...s2.levels].sort().join("+");
  const seen = new Set(perShape.map(signature));
  assert.equal(seen.size, perShape.length,
    "two shapes declare the same access levels, so one of them is paid for and measures nothing: " +
    JSON.stringify(perShape.map((s2) => `${s2.key}=${signature(s2)}`)));
  // And the specific coverage the shapes were chosen for.
  assert.ok(perShape.some((s2) => s2.levels.has("collect")), "no shape has a form to submit");
  assert.ok(perShape.some((s2) => s2.levels.size === 1 && s2.levels.has("display")),
    "no display-only shape — the brochure site is most of what this platform builds");
  assert.ok(/teamScope: true/.test(block), "no shape exercises teamScope");
  assert.ok(/publicView:/.test(block), "no shape exercises publicView");
});

// ── the family's reference page as a worked example ─────────────────────────
//
// Until 2026-08-04 the model had never seen one and could not: a Worker has no
// filesystem, src/family-pages was read by test files only, and PAGE_RULES never
// mentioned it. 100 reference apps, typechecked, rendered, guarded — and
// reachable by nothing, which is the shape the 27 blocks and 196 examples were
// deleted for. These are wired instead.

test("every ready family has a baked exemplar", async () => {
  const [layouts, ex] = await Promise.all([
    import("../builder/site-layouts.mjs"),
    import("../builder/family-exemplars.mjs"),
  ]);
  for (const f of layouts.READY_FAMILIES) {
    assert.ok(ex.FAMILY_EXEMPLARS[f], `${f} is offered to the designer with no worked example behind it`);
  }
  assert.ok(layouts.READY_FAMILIES.length >= 90, "the family list collapsed");
});

test("the baked exemplar has not drifted from the file on disk", async () => {
  // Same guarantee PAGE_RULES' copy of the barber page has. A note that
  // disagrees with the file is worse than no note, and this one is 2,300 tokens
  // of it on every build.
  const ex = await import("../builder/family-exemplars.mjs");
  const dir = path.join(import.meta.dirname, "../builder/lovable/template/src/family-pages");
  const strip = (src) => src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^[ \t]*\/\/[^\n]*\n/gm, "")
    .replace(/[ \t]+\/\/[^\n]*$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  let checked = 0;
  for (const [family, baked] of Object.entries(ex.FAMILY_EXEMPLARS)) {
    const file = path.join(dir, family, "index.tsx");
    assert.ok(fs.existsSync(file), `${family} has a baked exemplar and no file`);
    assert.equal(baked, strip(fs.readFileSync(file, "utf8")),
      `${family}'s exemplar is stale — re-run builder/gen-family-exemplars.mjs`);
    checked++;
  }
  assert.ok(checked >= 90, `only ${checked} exemplars checked`);
});

test("the exemplar rides in the USER turn and the cached block never varies", () => {
  // THE EXPENSIVE ONE. A cache entry is keyed on the bytes, so an exemplar that
  // varies per family inside the system block would make the cached prefix
  // differ on every build and never hit — $0.0082 becomes $0.1019, thirteen
  // times, measured. Asserted across two DIFFERENT families, because comparing
  // a request to itself proves nothing.
  const spec = { tables: [{ name: "bookings", access: "collect", columns: ["name"] }] };
  const salon = api.pagesRequest({ brief: "a studio", spec, brand: "A", family: "salon" });
  const store = api.pagesRequest({ brief: "a shop", spec, brand: "B", family: "store" });
  const none = api.pagesRequest({ brief: "a studio", spec, brand: "A" });

  assert.equal(salon.system[0].text, store.system[0].text, "the cached block must not vary by family");
  assert.equal(salon.system[0].text, none.system[0].text, "nor between having a family and not");
  assert.deepEqual(salon.system[0].cache_control, { type: "ephemeral" });

  const body = salon.messages[0].content;
  assert.ok(body.includes(api.familyExemplar("salon")), "the salon exemplar must reach the user turn");
  assert.ok(!salon.system[0].text.includes(api.familyExemplar("salon")), "and must NOT be in the cached block");
  assert.notEqual(body, store.messages[0].content, "two families must not produce the same user turn");
});

test("an unknown family costs nothing rather than throwing", () => {
  const spec = { tables: [] };
  for (const family of [undefined, null, "", "not-a-family"]) {
    const r = api.pagesRequest({ brief: "a shop", spec, brand: "A", family });
    assert.ok(r.messages[0].content.length < 2000, `${family} produced an exemplar`);
  }
  assert.equal(api.familyExemplar("not-a-family"), null);
});

test("the exemplar is framed so its CONTENT is not copied", () => {
  // The deleted examples tier shipped a real customer's page reading "Our
  // flagship product combines cutting-edge technology with sleek design." The
  // example is a shape to follow, and saying so is the only thing standing
  // between this and that.
  const spec = { tables: [{ name: "bookings", access: "collect", columns: ["name"] }] };
  const body = api.pagesRequest({ brief: "a studio", spec, brand: "A", family: "salon" }).messages[0].content;
  assert.match(body, /DIFFERENT business/i, "the example must be framed as another business");
  assert.match(body, /Copy none of its words/i, "it must say not to copy the content");
  // Order matters: the schema is a constraint, the example a shape. Read first,
  // an example invites reproducing its tables.
  assert.ok(body.indexOf("THE SCHEMA THAT EXISTS") < body.indexOf("A SITE OF THIS TRADE"),
    "the schema must come before the example");
});

test("worker.js and the eval both pass the family to pagesRequest", () => {
  for (const f of ["../worker.js", "./integration/page-gen-eval.mjs"]) {
    const src = fs.readFileSync(new URL(f, import.meta.url), "utf8")
      .replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (m) => m.replace(/[^\n]/g, " "));
    assert.match(src, /pagesRequest\(\{[^}]*\bfamily\b[^}]*\}\)/s,
      `${f} does not pass the family, so no build of it ever gets an example`);
  }
});

// ── A write-only table cannot hand the row back ─────────────────────────────

test("useCreateRow does NOT ask PostgREST to return the inserted row", () => {
  // THE BUG THIS PINS REFUSED EVERY SUBMISSION ON EVERY SITE. Measured live
  // 2026-08-04: a generated barber shop's booking form answered 403 to its own
  // customer, while the reads beside it answered 200 — so the site looked up.
  //
  // `collect` is write-only by design: an INSERT policy and grant, and NO SELECT
  // policy or grant, so a stranger can never list other people's phone numbers.
  // `Prefer: return=representation` makes PostgREST run `INSERT … RETURNING`,
  // and RETURNING needs SELECT. The one header that made a confirmation screen
  // possible is the one that made the insert impossible.
  const rows = fs.readFileSync(new URL("../builder/lovable/template/src/lib/rows.ts", import.meta.url), "utf8");
  const create = rows.slice(rows.indexOf("export function useCreateRow"), rows.indexOf("export function useUpdateRow"));
  assert.ok(create.length > 100, "useCreateRow was renamed — this guard now checks nothing");
  assert.ok(!/return=representation/.test(create),
    "useCreateRow asks for the row back, which 403s on every collect table");

  // …and the sibling KEEPS it, which is not an inconsistency: PATCH is only ever
  // granted on user/feed tables, where the caller does have SELECT. Asserted so
  // that "fix the 403" cannot be applied with a blanket find-and-replace.
  const update = rows.slice(rows.indexOf("export function useUpdateRow"));
  assert.match(update.slice(0, 900), /return=representation/,
    "useUpdateRow lost the header too — an edit form now cannot show what it saved");
});

test("the rules never tell the model the insert resolves to a row", () => {
  // The rules said `useCreateRow` resolves to the created ROW and to read a claim
  // token off it — advertised at the prompt layer, refused by the database. The
  // same shape as publicView: declarable, documented, and impossible.
  const claims = [/useCreateRow\` resolves to the created ROW/, /read the token off the/];
  for (const re of claims) {
    assert.ok(!re.test(PAGE_RULES), `the rules still promise the created row: ${re}`);
  }
  assert.match(PAGE_RULES, /useCreateRow\` RESOLVES TO NOTHING/,
    "nothing tells the model it gets nothing back, so it will keep reading data.claim_token");
});

// ── A link to a page that does not exist ────────────────────────────────────

test("a link to a page that was never written is pointed at home, not left dead", () => {
  // MEASURED LIVE 2026-08-04. TanStack generates a UNION of the routes that
  // exist, so `<Link to="/account">` with no account.tsx is TS2322 — the compile
  // fails and the WHOLE site publishes as the placeholder. One href costs every
  // page.
  const mk = (path, body) => ({ path, source:
    'import { createFileRoute, Link } from "@tanstack/react-router";\n' +
    'export const Route = createFileRoute("/")({ component: P });\n' +
    "function P(){ return <div>" + body + "</div>; }" });
  const v = validatePages({ pages: [
    mk("index.tsx", '<Link to="/book">Book</Link><Link to="/account">Account</Link>'),
    mk("book.tsx", '<Link to="/">Home</Link>'),
  ] });
  assert.equal(v.pages.length, 2);
  // The live link is untouched…
  assert.match(v.pages[0].source, /to="\/book"/, "a real route was rewritten");
  // …and the dead one goes home rather than nowhere.
  assert.ok(!/\/account/.test(v.pages[0].source), v.pages[0].source);
  assert.ok(v.problems.some((x) => /\/account/.test(x)), "the rewrite happened silently: " + JSON.stringify(v.problems));
});

test("and the same fix covers the page CAP, which is how it was found", () => {
  // The model wrote SEVEN pages, the cap kept six, and the one dropped was the
  // one two others linked to. A cap that removes a page while leaving links to
  // it is a guaranteed failure, not a risk.
  const mk = (path, body = "") => ({ path, source:
    'import { createFileRoute, Link } from "@tanstack/react-router";\n' +
    'export const Route = createFileRoute("/")({ component: P });\n' +
    "function P(){ return <div>" + body + "</div>; }" });
  const many = [
    mk("index.tsx", '<Link to="/account">Account</Link>'),
    mk("a.tsx"), mk("b.tsx"), mk("c.tsx"), mk("d.tsx"), mk("e.tsx"),
    mk("account.tsx"),   // the 7th — dropped by the cap
  ];
  const v = validatePages({ pages: many });
  assert.equal(v.pages.length, MAX_PAGES);
  assert.ok(!v.pages.some((p) => p.path === "account.tsx"), "the cap did not drop anything");
  assert.ok(!/\/account/.test(v.pages[0].source), "the link to the dropped page survived and will not compile");
});

test("a navigate({to}) target is covered too, not just <Link>", () => {
  const src = 'import { createFileRoute } from "@tanstack/react-router";\n' +
    'export const Route = createFileRoute("/")({ component: P });\n' +
    'function P(){ const n = useNavigate(); n({ to: "/ghost" }); return null; }';
  const v = validatePages({ pages: [{ path: "index.tsx", source: src }] });
  assert.ok(!/ghost/.test(v.pages[0].source), v.pages[0].source);
});

// ── The props the model was guessing ────────────────────────────────────────

test("every shortlisted component's props are STATED, not left to a guess", () => {
  // Measured 2026-08-04 on one CRM sample: a `badge` prop that does not exist, a
  // `subtitle` that is really `description`, an `id` on a row type that has none,
  // and `"error"` for a state whose values are success/warning/danger/neutral/
  // quiet. Four compile errors, one root cause — 282 names and no signatures —
  // and the whole site published as its data model.
  const listed = UI_SHORTLIST.filter((n) => COMPONENT_API[n]);
  assert.ok(listed.length > 250, `only ${listed.length} of the shortlist have a signature`);
  for (const n of listed.slice(0, 40)) {
    assert.ok(PAGE_RULES.includes(n + " — " + COMPONENT_API[n]),
      `${n} is offered to the model with no props`);
  }
});

test("a string-literal union is never truncated — a half-shown enum is worse than none", () => {
  // `shortType` capped every type at 46 characters, so StatusBadge arrived as
  // `"success" | "warning" | "danger" | "neutral…`. The generator wrote "error",
  // which is a reasonable guess at what the ellipsis hid and is not a member.
  // A trimmed union reads as authoritative while hiding the value you needed.
  const enums = Object.values(COMPONENT_API).filter((v) => /\?\s*:\s*"/.test(v) || /:\s*"/.test(v));
  assert.ok(enums.length > 20, "no string-union props found — the scan stopped working");
  const cut = enums.filter((v) => /"[^"]*…/.test(v) && !/…"/.test(v));
  assert.deepEqual(cut, [], "these unions are truncated mid-value");
  // The one that caused it, spelled out.
  assert.equal(COMPONENT_API["status-badge"],
    'StatusBadge(state?: "success" | "warning" | "danger" | "neutral" | "quiet" = "neutral", children: React.ReactNode)');
});

test("component-api.mjs is what the generator produces right now", () => {
  // A DERIVED FILE THAT NOBODY REGENERATES IS A LIE THAT COMPILES. The
  // signatures are extracted from the kit's source and committed, so they go
  // stale two ways: a component's props change, or — as happened today — the
  // EXTRACTOR changes and the committed output still carries the old shape.
  //
  // `shortType` was fixed so a string-literal union is never truncated. Without
  // this check, forgetting to re-run the generator would leave every enum in the
  // prompt still cut off mid-union while the fix sat in the source looking done.
  const fresh = renderApi(buildApi());
  const onDisk = fs.readFileSync(new URL("../builder/component-api.mjs", import.meta.url), "utf8");
  assert.equal(fresh, onDisk,
    "builder/component-api.mjs is stale — run `node builder/gen-component-api.mjs`");
});

test("a signature that names a type also shows that type's SHAPE", () => {
  // `ActivityFeed(items: Activity[], …)` names a type the model cannot see. It
  // passed `{title, description}[]` where Activity is `{who, what, at, avatar?}`
  // — one error, and the only thing between the booking sample and a pass.
  const line = UI_SHORTLIST_API().split("\n").find((l) => l.includes("activity-feed"));
  assert.ok(line, "activity-feed left the shortlist — pick another component with a named type");
  assert.match(line, /where Activity = \{ who: string/, line);
});

test("and the shape comes from THAT component's file, not a name lookup", () => {
  // TWO components in this kit export a type called `Activity` and they are
  // different shapes. A flat name -> shape map collapsed them, last one winning,
  // so the prompt would have carried the wrong fields for one of them. A wrong
  // type is worse than none: it looks authoritative, exactly like the truncated
  // enum did earlier the same day.
  const a = COMPONENT_TYPES["activity-feed"];
  const b = COMPONENT_TYPES["facility-status"];
  assert.ok(a && a.Activity, "activity-feed lost its type");
  assert.ok(b && b.Activity, "facility-status lost its type");
  assert.notEqual(a.Activity, b.Activity, "the two Activity types collapsed into one");
  assert.match(a.Activity, /who: string/);
  assert.match(b.Activity, /state\?*:/);
});

test("a type is read with balanced braces, not up to the first semicolon", () => {
  // These are object literals whose fields are semicolon-separated, so a lazy
  // match returns `Activity = { who: string` and looks like it worked.
  for (const [, types] of Object.entries(COMPONENT_TYPES)) {
    for (const [name, body] of Object.entries(types)) {
      assert.ok(body.startsWith("{") && body.endsWith("}"), `${name} was cut off: ${body}`);
    }
  }
});

test("Row and PublicRow agree that a column value is a SCALAR", () => {
  // `PublicRow` was fixed on 2026-08-04 and `Row` was not, though the reasoning
  // written under PublicRow applies to both word for word — it even names "the
  // Row constraint" as the same class while Row itself still said `unknown`.
  //
  // With `unknown`, `useRows<Row>("posts")` types every field `unknown`, so
  // `<li>{row.title}</li>` is TS2322 and handing `row.created_at` to anything
  // expecting `string | number | Date` fails the same way. Measured: the
  // generator got the field NAMES exactly right and still failed on `at: unknown`
  // alone — the only error between the booking sample and a pass.
  const src = fs.readFileSync(new URL("../builder/lovable/template/src/lib/rows.ts", import.meta.url), "utf8");
  const scalar = "string | number | boolean | null";
  // `Row` is a LITERAL index signature rather than `Record<…> & {…}` — an
  // intersection cannot carry an optional property, because the member type is
  // intersected with the index signature's and `updated_at?: string` collapses
  // to plain `string`, claiming a column that only exists behind `timestamps`.
  assert.match(src, new RegExp("export type Row = \\{\\s*\\[column: string\\]: " + scalar.replace(/[|\\{}()[\]^$+*?.]/g, "\\$&")),
    "Row's values are back to `unknown`, so an ordinary page cannot render one");
  assert.ok(src.includes("export type PublicRow = Record<string, " + scalar + ">"),
    "PublicRow drifted from Row — they describe the same scalars");
  // The `| undefined` is there BECAUSE of the optional column and for no other
  // reason: TypeScript requires an index signature to admit the optional
  // property's type. If that column ever goes, so should this — asserted as an
  // implication rather than as a fact, or it becomes a licence to widen.
  const rowDecl = src.slice(src.indexOf("export type Row = "), src.indexOf("export type RowId"));
  assert.equal(/\| undefined;/.test(rowDecl), /\w+\?: /.test(rowDecl),
    "Row admits undefined with no optional column to justify it, or the reverse");
});

test("Row names created_at, and the schema engine really does always add it", () => {
  // The one column a page reads that the model's own `type Deal = Row & {…}`
  // cannot narrow: a declared column gets a type in that intersection, a
  // platform-managed one is left on the index signature as
  // `string | number | boolean | null`. Handing it to anything wanting
  // `string | number | Date` is TS2322 — measured live 2026-08-05, and the CRM
  // sample published as the placeholder over it.
  const src = fs.readFileSync(new URL("../builder/lovable/template/src/lib/rows.ts", import.meta.url), "utf8");
  assert.match(src, /created_at: string;/, "Row must name it, or no page can render a date");
  // NON-OPTIONAL is a claim about site-schema.mjs, so it is checked there.
  // `updated_at` sits behind the `timestamps` flag and `created_at` does not —
  // typing them the same way would be wrong in one direction or the other.
  assert.ok(!/created_at\?: /.test(src), "optional would give `string | undefined`, which fails the same way");
  const engine = fs.readFileSync(new URL("../site-schema.mjs", import.meta.url), "utf8");
  const created = engine.match(/^\s*(.*)cols\.push\((['"`])"created_at" TEXT/m);
  assert.ok(created, "site-schema.mjs no longer adds created_at at all");
  assert.equal(created[1].trim(), "", "created_at became conditional, so `created_at: string` in rows.ts is now a lie");
  assert.match(engine, /if \(t\.timestamps \|\| t\.sync\) cols\.push\('"updated_at"/,
    "updated_at is the conditional one — if that ever changes, so must the type above");
  // And the two are typed to MATCH that asymmetry: `created_at` is present on
  // every table so it is required, `updated_at` only behind a flag so it is
  // optional. Typing them the same way is wrong in one direction or the other —
  // required, it claims a column half the tables do not have; absent, the model
  // gets `string | number | boolean` out of `deal.updated_at ?? deal.created_at`
  // and the page is refused, which is what happened on 2026-08-05.
  assert.match(src, /updated_at\?: string;/, "updated_at must be OPTIONAL, matching the flag it sits behind");
});

test("a component's prop shape is printed, never collapsed to `object`", () => {
  // THE SAME FAILURE AS THE TRUNCATED STRING UNION, one type-kind over. An
  // inline object literal names the exact properties a caller must write, and
  // `object` reads as "any object" — measured live 2026-08-05,
  // `BulkActions(actions: object[])` was called with `{label, onClick}` against
  // `{label, onSelect, destructive?}`. TS2353, page refused.
  //
  // Worse than the union was, because there is nowhere else to look it up:
  // COMPONENT_TYPES only resolves `export type` names.
  const all = Object.values(COMPONENT_API).join(" ");
  assert.ok(!/:\s*object[,)\]]/.test(all), "a prop is still typed `object`: " + (all.match(/\w+\??:\s*object[,)\]]/) || [])[0]);
  assert.ok(!/:\s*object\[\]/.test(all), "a prop is still typed `object[]`");
  assert.match(COMPONENT_API["bulk-actions"], /onSelect/, "the prop the generator guessed wrong must now be stated");
  // A function's parameters are a contract too — `(next: string) => void` and
  // `(id: number, done: boolean) => void` are not interchangeable.
  assert.ok(!/:\s*function[,)]/.test(all), "a callback prop is still typed `function`");
});

test("a shape too long to print keeps its property NAMES", () => {
  // Between `object` and the full type there is a third answer, and it is most
  // of the value: a caller who knows the keys writes a call that compiles.
  // Driven through the real extractor rather than asserted on the output, so a
  // kit with no shape over the limit cannot make this pass vacuously.
  const long = Array.from({ length: 14 }, (_, i) => `field${i}: string`).join("; ");
  const [found] = extractApi(`export function Big({ rows }: { rows: { ${long} }[]; }) { return null; }`);
  assert.ok(found, "the extractor stopped seeing the component");
  const sig = found.props.join(", ");
  assert.ok(!/object/.test(sig), "a shape over the limit must not fall back to `object`: " + sig);
  assert.match(sig, /rows: \{ field0; field1;/, sig);
  assert.ok(!/field0: string/.test(sig), "over the limit the types are dropped, not kept: " + sig);
  assert.match(sig, /\}\[\]$/, "an array of the shape must stay an array: " + sig);
  // And UNDER the limit the full type survives, or the rule above is just the
  // old collapse with different words.
  const [small] = extractApi(`export function Small({ a }: { a: { label: string; onSelect: () => void; destructive?: boolean }[]; }) { return null; }`);
  assert.match(small.props.join(""), /label: string; onSelect: \(\) => void/, small.props.join(""));
});

// ── a row id is a number and a route param is a string ───────────────────────

test("comparing a row id to a route param is caught", () => {
  // NOT MERELY A TYPE ERROR. `4 === "4"` is false, so if this ever stopped being
  // refused by tsc it would become a manage page that answers "not found" for
  // every real row. Measured live 2026-08-05 in a CRM sample.
  const p = lintPages(page('const { id } = Route.useSearch(); const d = rows.find((r) => r.id === id);'), SPEC);
  assert.equal(p.length, 1, JSON.stringify(p));
  assert.match(p[0], /route param is a string while a row id is a number/);
  assert.match(p[0], /String\(r\.id\)/, "the message must name the fix: " + p[0]);
  // Either way round.
  assert.equal(lintPages(page('const { id } = Route.useParams(); const d = rows.find((r) => id === r.id);'), SPEC).length, 1);
  // And the object form of the binding, not only the destructured one.
  assert.equal(lintPages(page('const sp = Route.useSearch(); const d = rows.find((r) => r.id === sp.id);'), SPEC).length, 1);
});

test("and the correct spelling is silent", () => {
  assert.deepEqual(lintPages(page('const { id } = Route.useSearch(); const d = rows.find((r) => String(r.id) === id);'), SPEC), []);
  // `useRow(TABLE, id)` with the raw string is CORRECT — every hook takes
  // `string | number` — so a rule that pushed the model to Number() would be
  // teaching a bug.
  assert.deepEqual(lintPages(page(`const { id } = Route.useParams(); useRows("services");`), SPEC), []);
});

test("a comparison against something that is NOT a param is left alone", () => {
  // `d.id === selectedId` against a numeric state is correct code, and a lint
  // that flagged it would be one the model learns to ignore. Scoped to
  // identifiers this file actually binds from a param hook.
  assert.deepEqual(lintPages(page('const { q } = Route.useSearch(); const hit = d.id === selectedId;'), SPEC), []);
  // With no param hook at all, the rule cannot fire.
  assert.deepEqual(lintPages(page('const hit = d.id === other;'), SPEC), []);
  // TWO PARAMS COMPARED TO EACH OTHER are both strings and perfectly equal-able.
  // Found by mutation: without the `!isParam` half of the id test, one param's
  // `.id` reads as a row id and this is reported as impossible.
  assert.deepEqual(lintPages(page('const a = Route.useParams(); const b = Route.useSearch(); const same = a.id === b.id;'), SPEC), []);
});

test("an id put INTO a route without String() is caught", () => {
  const link = lintPages(page('<Link to="/r/$id" params={{ id: row.id }} />'), SPEC);
  assert.equal(link.length, 1, JSON.stringify(link));
  assert.match(link[0], /String\(row\.id\)/);
  assert.equal(lintPages(page('navigate({ to: "/record", search: { id: d.id } })'), SPEC).length, 1);
  // Blanked rather than matched around, so whitespace inside the call cannot
  // evade it.
  assert.deepEqual(lintPages(page('<Link to="/r/$id" params={{ id: String( row.id ) }} />'), SPEC), []);
  assert.deepEqual(lintPages(page('navigate({ to: "/record", search: { id: String(d.id) } })'), SPEC), []);
  // A search param that is not an id is not this rule's business.
  assert.deepEqual(lintPages(page('<Link to="/book" search={{ service: row.title }} />'), SPEC), []);
});

test("no component with typed props is silently skipped by the extractor", () => {
  // `UI_SHORTLIST_API` does `if (!sig) continue`, so a component the extractor
  // cannot parse simply is not described — no error, no gap in the list, nothing
  // to notice. Measured live 2026-08-05: `data-table`'s
  // `<T extends Record<string, unknown>>` defeated the match (the class stopped
  // at the FIRST `>`), the model was given no signature, guessed `data=` where
  // the prop is `rows=`, and with `T` unable to infer every
  // `cell: (row: Deal) => …` became a contravariance error. **Eight of that
  // sample's nine errors, from one absent entry.** `template-fill` was the
  // second, found the same way.
  //
  // Derived from the files rather than from a list: any `export function X({…}:
  // {` in the ui folder is a prop-driven component and must be described. The
  // shadcn primitives take standard HTML props elsewhere and destructure nothing
  // here, so they do not match and are correctly absent.
  const dir = path.join(ROOT, "builder/lovable/template/src/components/ui");
  const missing = [];
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".tsx"))) {
    const src = fs.readFileSync(path.join(dir, file), "utf8");
    // The annotation is what makes it extractable at all; a component whose
    // props are typed elsewhere is skipped on purpose and has no shape to print.
    const ann = src.match(/export function \w+[\s\S]{0,200}?\}\s*:\s*\{([\s\S]{0,900}?)\}\s*\)/);
    if (!ann) continue;
    // And one whose ONLY prop is `className` is correctly absent: the extractor
    // drops that everywhere, because all 2,000 take it and the rules say so once
    // instead of two thousand times. Derived from the file rather than from the
    // extractor, or this guard would be asking the thing under test whether it
    // worked.
    const names = [...ann[1].matchAll(/(?:^|[;{\n])\s*(\w+)\??\s*:/g)].map((x) => x[1]);
    if (!names.some((n) => n !== "className")) continue;
    const slug = file.replace(/\.tsx$/, "");
    if (!COMPONENT_API[slug]) missing.push(slug);
  }
  assert.deepEqual(missing, [], "these have typed props and no signature in the prompt: " + missing.join(", "));
});

test("the extractor reads a generic with a nested constraint", () => {
  // The regression itself, driven rather than asserted on the output — so this
  // still fails if the kit ever loses its only nested generic.
  const [found] = extractApi('export function Grid<T extends Record<string, unknown>>({ rows, empty }: { rows: T[]; empty?: string; }) { return null; }');
  assert.ok(found, "a nested generic still hides the component");
  assert.equal(found.name, "Grid");
  assert.match(found.props.join(", "), /rows: T\[\]/);
  // And the plain forms it already handled must keep working.
  assert.ok(extractApi('export function A<T>({ x }: { x: T; }) { return null; }')[0]);
  assert.ok(extractApi('export function B({ x }: { x: string; }) { return null; }')[0]);
});

test("a named type with a generic parameter still resolves to its shape", () => {
  // THE SAME CLASS AS THE COMPONENT REGEX, one layer over and found the moment
  // that one was fixed: `export type Column<T> = ` never matched, so `Column`
  // had no shape, so `DataTable(columns: Column<T>[], …)` stopped at a name the
  // model could not see — and it wrote `render:` where the prop is `cell:`.
  // Measured live 2026-08-05. `sortable-list`'s `SortOption<T>` was hidden the
  // same way.
  //
  // A signature that stops at a type NAME is the failure `COMPONENT_TYPES`
  // exists to prevent; a name it cannot resolve is that failure wearing a fix.
  assert.ok(COMPONENT_TYPES["data-table"] && COMPONENT_TYPES["data-table"].Column,
    "Column<T> is cited by DataTable's signature and has no shape");
  assert.match(COMPONENT_TYPES["data-table"].Column, /cell\?: \(row: T\) => React\.ReactNode/,
    "the prop the generator guessed wrong must be the one stated");
  // Driven through the real builder as well, so this still fails if the kit ever
  // loses its only generic exported type.
  const types = buildTypesApi();
  assert.ok(types["data-table"] && types["data-table"].Column, "the generated file and the builder disagree");
  // And a default containing `=` must not end the parameter list early.
  assert.ok(COMPONENT_TYPES["sortable-list"] && COMPONENT_TYPES["sortable-list"].SortOption);
});

test("a generic DEFAULT does not end the type-parameter list early", () => {
  // FOUND BY MUTATION, on my own new code: swapping the generic pattern for
  // `<[^=]*?>` passed the entire suite, because no component in the kit declares
  // a default. A guard that can only see today's files restates the kit rather
  // than the rule — so `extractTypes` takes a source, the way `extract` always
  // has, and the rule is driven directly.
  const withDefault = extractTypesApi('export type Slot<T = Row> = { at: string; row: T };');
  assert.ok(withDefault.Slot, "a default containing `=` swallowed the match");
  assert.match(withDefault.Slot, /at: string; row: T/);
  // The plain and single-parameter forms must keep working.
  assert.ok(extractTypesApi('export type Plain = { a: string };').Plain);
  assert.ok(extractTypesApi('export type Gen<T> = { a: T };').Gen);
  // A nested constraint too, matching what the kit actually has.
  assert.ok(extractTypesApi('export type Col<T extends Record<string, unknown>> = { key: string; get: (r: T) => string };').Col);
  // And a bare alias still says nothing worth the tokens.
  assert.ok(!extractTypesApi('export type Alias = string | number;').Alias);
});

test("the tool cannot be called with an empty page list", () => {
  // `required: ["pages"]` only demands the KEY exists — `{"pages": []}` satisfies
  // it perfectly, and that is exactly what came back on a real build: 68 seconds,
  // 23 credits charged, a placeholder published. The most expensive possible
  // outcome, because it costs what a working site costs and delivers nothing.
  const pages = SITE_PAGES_TOOL.input_schema.properties.pages;
  assert.equal(pages.minItems, 1, "an empty array is a legal call without this");
  assert.deepEqual(SITE_PAGES_TOOL.input_schema.required, ["pages"], "and the key itself must still be required");
  // NO ceiling, deliberately. The cap lives in validatePages, which keeps the
  // first MAX_PAGES and rewrites any link to one it dropped — a working site
  // minus a page. A schema ceiling would make a model that wanted more produce
  // an INVALID call, which is the empty-array failure this guards against.
  assert.equal(pages.maxItems, undefined,
    "a maxItems here turns 'too many pages' into 'no pages', which is the worse failure");
  // The description has to say it too: the schema is a constraint, the
  // description is what the model reads while deciding.
  assert.match(pages.description, /At least one/i);
});

// ── paid tables ──────────────────────────────────────────────────────────────
//
// The failure class this lint exists for: it typechecks, it bundles, and it
// 403s at a real customer holding a card. A paid table has NO public insert —
// that missing grant is the whole reason a price cannot be forged — so
// useCreateRow on one is refused by Postgres at the moment somebody buys.

const PAID_SPEC = {
  tables: [
    { name: "products", access: "display", columns: [{ name: "name" }, { name: "price" }] },
    { name: "orders", access: "collect", payment: { from: "products", price: "price", currency: "gbp" }, columns: [{ name: "customer_name" }, { name: "email" }] },
    { name: "enquiries", access: "collect", columns: [{ name: "email" }] },
  ],
};

test("the digest states PAID for every collect table, yes or no", () => {
  // Never omitted. An absent line reads as an omission rather than an answer —
  // which is precisely how a site came out as the placeholder when publicView
  // was declarable, enforced, and unmentioned here.
  const d = schemaDigest(PAID_SPEC);
  assert.match(d, /PAID: YES/);
  assert.match(d, /PAID: NO/);
  assert.equal((d.match(/PAID: /g) || []).length, 2, "one line per collect table, and none for a display table");
});

test("the digest names the catalogue and the currency, so the model cannot guess them", () => {
  const d = schemaDigest(PAID_SPEC);
  assert.match(d, /priced in GBP/);
  assert.match(d, /from products/);
  assert.match(d, /useCheckout\("orders"\)/);
});

test("LINT: useCreateRow on a paid table is refused", () => {
  const out = lintPages(page('const c = useCreateRow("orders");'), PAID_SPEC);
  assert.equal(out.length, 1, JSON.stringify(out));
  assert.match(out[0], /PAID/);
  assert.match(out[0], /useCheckout\("orders"\)/);
});

test("...and useCreateRow on an ORDINARY collect table is fine", () => {
  // Or every contact form on the platform gets flagged.
  assert.deepEqual(lintPages(page('const c = useCreateRow("enquiries");'), PAID_SPEC), []);
});

test("LINT: useCheckout on a table that takes no payment is refused", () => {
  // The route answers 404 for it, so the button would simply never work.
  const out = lintPages(page('const c = useCheckout("enquiries");'), PAID_SPEC);
  assert.equal(out.length, 1, JSON.stringify(out));
  assert.match(out[0], /declares no payment/);
});

test("LINT: useCheckout on a table the schema never declared is refused", () => {
  const out = lintPages(page('const c = useCheckout("baskets");'), PAID_SPEC);
  assert.equal(out.length, 1, JSON.stringify(out));
  assert.match(out[0], /does not declare/);
});

test("...and useCheckout on the paid table passes", () => {
  assert.deepEqual(lintPages(page('const c = useCheckout("orders");'), PAID_SPEC), []);
});

test("the rule tells the model to send only id and qty", () => {
  // The one sentence that stops a page posting a total. If it ever goes, the
  // server still refuses — but the model would write a checkout that looks
  // right and silently has its price ignored, which is worse to debug.
  assert.ok(PAGE_RULES.includes("and NOTHING else per line — no price, no total, no currency"));
  assert.match(PAGE_RULES, /is for DISPLAY only and is never sent/);
});

test("the rule says the return id is NOT proof of payment", () => {
  // Anyone can type ?paid=7. A page that shows an order's contents from it is
  // a way to read somebody else's order.
  assert.match(PAGE_RULES, /NOT proof of payment/);
});

test("rule 14's example cites components that REALLY EXIST, with the right casing", () => {
  // Written as `money(total, "GBP")` first. The kit exports `Money`, a
  // component taking {amount, currency} — so the example the model is told to
  // copy was TS2724, the page refused, the site published as the placeholder.
  // Caught by compiling it, which is the only thing that could have.
  const example = PAGE_RULES.slice(PAGE_RULES.indexOf("14. A TABLE MARKED"), PAGE_RULES.indexOf("15. NO EXPLANATORY"));
  const kitDir = path.join(import.meta.dirname, "..", "builder", "lovable", "template", "src", "components", "ui");
  // `[\s/]` and not `>`, or `useRows<Product>` matches as a JSX tag — it is a
  // generic type parameter, and the guard went looking for product.tsx.
  for (const name of new Set([...example.matchAll(/<([A-Z]\w+)[\s/]/g)].map((m) => m[1]))) {
    const file = name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase() + ".tsx";
    const src = fs.readFileSync(path.join(kitDir, file), "utf8");
    assert.ok(new RegExp("export (?:function|const) " + name + "\\b").test(src),
      name + " is cited by rule 14 but " + file + " does not export it");
  }
  // And the lower-case call form must not come back.
  assert.equal(/\bmoney\s*\(/.test(example), false, "the kit exports Money, a component — not a money() function");
});

// ── The attach button ──────────────────────────────────────────────────────
//
// It shipped dead. The composer collected up to three images and posted them on
// every build and revise, and the route read them zero times — so a control with
// a tooltip promising "a logo or reference image" did nothing at all, and the
// obvious way to say "make it look like this" was equally dead.

const IMG = (n) => ({ type: "image", source: { type: "base64", media_type: "image/png", data: "AAA" + n } });
const PDF = { type: "document", source: { type: "base64", media_type: "application/pdf", data: "PDF" } };

test("with no images the content stays a plain string", () => {
  // Not cosmetic. Every existing caller and test sees a string here, so a
  // feature nobody used must not change the request shape of every build that
  // does not use it.
  const req = api.pagesRequest({ brief: "a cafe", spec: SPEC, brand: "Cafe" });
  assert.equal(typeof req.messages[0].content, "string");
  // ...and an empty or junk array is the same as none.
  for (const attachments of [[], null, undefined, [null, false]]) {
    assert.equal(typeof api.pagesRequest({ brief: "a cafe", spec: SPEC, brand: "Cafe", attachments }).messages[0].content, "string");
  }
});

test("attached images ride in the user message, before the text", () => {
  const req = api.pagesRequest({ brief: "a cafe", spec: SPEC, brand: "Cafe", attachments: [IMG(1), IMG(2)] });
  const content = req.messages[0].content;
  assert.ok(Array.isArray(content), "images did not reach the request at all");
  assert.deepEqual(content.slice(0, 2), [IMG(1), IMG(2)]);
  assert.equal(content[2].type, "text");
  assert.equal(content.length, 3);
});

test("images do NOT touch the cached blocks", () => {
  // The system block is ~27,000 tokens and is cached on its bytes. Putting an
  // attachment anywhere in `system` or `tools` would make every build with an
  // image a cache miss on all of it — costing far more than the pictures do.
  const bare = api.pagesRequest({ brief: "a cafe", spec: SPEC, brand: "Cafe" });
  const withImgs = api.pagesRequest({ brief: "a cafe", spec: SPEC, brand: "Cafe", attachments: [IMG(1)] });
  assert.deepEqual(withImgs.system, bare.system, "the cached system block changed when an image was attached");
  assert.deepEqual(withImgs.tools, bare.tools, "the cached tool block changed when an image was attached");
  assert.deepEqual(withImgs.tool_choice, bare.tool_choice);
});

test("the prompt notes the attachments and otherwise stays out of the way", () => {
  // TWO CLAUSES, and it shrank twice to get there. The first draft assigned a
  // purpose per file type; the second explained at length how to work the
  // purpose out — which is teaching the model something it already knows. An
  // attachment in a conversation is an ordinary thing and the person attaching
  // it says what it is for.
  const none = api.pagesPrompt("a cafe", SPEC, "Cafe");
  const one = api.pagesPrompt("a cafe", SPEC, "Cafe", null, 1);
  const two = api.pagesPrompt("a cafe", SPEC, "Cafe", null, 2);
  assert.ok(!/WHAT THE USER ATTACHED/.test(none), "the note appears with nothing attached");
  assert.match(one, /1 file, above this text/);
  assert.match(two, /2 files, above this text/);
  assert.match(one, /part of what they are asking for/);

  // The size is the assertion. Anything longer is the version that had to come
  // out — and a length check is the only thing that catches guidance creeping
  // back in one well-meaning sentence at a time.
  const note = one.split("WHAT THE USER ATTACHED")[1].split("\n\nA SITE OF")[0].trim();
  assert.ok(note.length < 220, "the attachment note has grown back: " + note.length + " chars\n" + note);
  assert.ok(note.split("\n").length <= 2, "the note is a paragraph again, not a line");
});

test("it never prescribes a purpose, and never names a file format", () => {
  // The same PDF is the customer's own price list or a competitor's brochure,
  // and only the brief distinguishes them — so a rule keyed to the extension
  // gets one of the two wrong every time.
  const note = api.pagesPrompt("a cafe", SPEC, "Cafe", null, 1)
    .split("WHAT THE USER ATTACHED")[1].split("\n\nA SITE OF")[0];
  assert.ok(!/\bPDF\b|\.pdf|\bJPEG\b|\bPNG\b|screenshot|logo|brand mark/i.test(note),
    "the note prescribes by file kind again: " + note);
  // ...and it does not ask for seeding, which this step cannot do: `write_pages`
  // takes route files and nothing else, so seeds come from the designer.
  assert.ok(!/seed/i.test(note), "the note asks page generation to seed, which it cannot do");
});

test("with the brief silent, nothing extra is said about it", () => {
  // Deliberately no fallback rule. The earlier version explained how to judge
  // "whose material is this", which is exactly the kind of reasoning the model
  // does unprompted.
  const note = api.pagesPrompt("a cafe", SPEC, "Cafe", null, 1)
    .split("WHAT THE USER ATTACHED")[1].split("\n\nA SITE OF")[0];
  assert.ok(!/If the brief does not say/.test(note));
});

test("a document block rides in the message exactly as an image does", () => {
  const withPdf = api.pagesRequest({ brief: "a cafe", spec: SPEC, brand: "Cafe", attachments: [PDF] });
  assert.deepEqual(withPdf.messages[0].content[0], PDF);
  assert.equal(withPdf.messages[0].content[1].type, "text");
});

test("the count is a count, whatever it is handed", () => {
  for (const bad of [-3, "2", 1.7, NaN, null, undefined, {}]) {
    assert.doesNotThrow(() => api.pagesPrompt("a cafe", SPEC, "Cafe", null, bad));
  }
  assert.ok(!/WHAT THE USER ATTACHED/.test(api.pagesPrompt("a cafe", SPEC, "Cafe", null, -3)));
  assert.match(api.pagesPrompt("a cafe", SPEC, "Cafe", null, "2"), /2 files, above this text/);
});

test("the images the caller validated are the ones the model gets", () => {
  // The chain from the request body to the model call. Asserted here because
  // every link in it was dead for the whole life of the React engine. The
  // validator itself lives in builder/site-context.mjs and is tested by
  // RUNNING it — this only holds the wiring between the two.
  const gen = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  assert.match(gen, /const attached = attachments\(body\.images\)/, "the route never sorts body.images");
  assert.match(gen, /attachments: attached\.blocks/, "the validated blocks never reach buildAndPublishPages");
  assert.match(gen, /pagesRequest\(\{[^}]*\battachments\b[^}]*\}\)/s, "pagesRequest is not given the attachments");
  assert.match(gen, /\battachments\b[^\n]*from "\.\/builder\/site-context\.mjs"/, "attachments is not imported");
});

// ── The reply the customer reads ───────────────────────────────────────────
//
// `notes` has been written by the model and thrown away by the client since the
// React engine shipped: returned on every response, rendered by nothing. So
// every build has paid for prose nobody read. It is the chat reply now, which
// costs no extra call and about 0.07 credits of extra output.

test("the tool asks for a reply to the customer, not a list of omissions", () => {
  const notes = api.SITE_PAGES_TOOL.input_schema.properties.notes;
  assert.equal(notes.type, "string");
  assert.match(notes.description, /What you built, for the person who asked/);
  assert.match(notes.description, /shown to them as the reply/, "the model must know this is user-facing");
  // Length is controlled by the description, because that is the only lever
  // that costs nothing — a longer reply is billed per token at 5x input.
  assert.match(notes.description, /two or three sentences/i);
  assert.match(notes.description, /no markdown/i, "the chat renders text, not markdown");
});

test("the summary survives validation and reaches the caller", () => {
  const v = api.validatePages({ pages: [{ path: "index.tsx", source: "x" }], notes: "  Built you three pages.  " });
  assert.equal(v.notes, "Built you three pages.");
  // Bounded, because it is model-written text riding in a response.
  const long = api.validatePages({ pages: [{ path: "index.tsx", source: "x" }], notes: "z".repeat(2000) });
  assert.ok(long.notes.length <= 600, "an unbounded summary can be any length the model likes");
  // Junk never becomes a reply.
  for (const bad of [undefined, null, 7, {}, []]) {
    assert.equal(api.validatePages({ pages: [{ path: "index.tsx", source: "x" }], notes: bad }).notes, "");
  }
});

test("the client renders it, and stops claiming a site it did not build", () => {
  // A placeholder build answers ok:true WITH a slug, so the old canned line said
  // '✅ Built “X”. Tell me what to change.' over the data-model fallback —
  // claiming a site that does not exist. `page` is the only field that can tell
  // them apart.
  const chat = fs.readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");
  assert.match(chat, /d\.notes/, "the client never reads the summary");
  assert.match(chat, /d\.page !== 'placeholder'/, "the client cannot tell a built site from a fallback");
  assert.match(chat, /built \? '✅ ' : '⚠️ '/, "a fallback is still marked as a success");
  // The canned line is the fallback for when the model wrote nothing, not the
  // default — otherwise the summary is dead again in a different way.
  assert.match(chat, /said \|\| canned/);
});
