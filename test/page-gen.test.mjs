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
  REFERENCE_PAGE, REFERENCE_PAGES, UI_COMPONENTS, PAGE_RULES, SITE_PAGES_TOOL, MAX_PAGES, MANAGED_COLUMNS,
  schemaDigest, pagesPrompt, repairPrompt, validatePages, lintPages, briefForPages, ACCESS_NOTE,
} from "../builder/page-gen.mjs";
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
    const wroteAsMember = lintPages(page('const { data: me } = useMember(); useCreateRow("t");'), spec);
    assert.equal(wroteAsMember.length === 0, api.canWriteAccess(level) || api.needsMember(level),
      `signed-in write to a "${level}" table: ${JSON.stringify(wroteAsMember)}`);
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
  assert.ok(noMember.some((x) => /useUpdateRow\/useDeleteRow without useMember/.test(x)), JSON.stringify(noMember));

  assert.deepEqual(
    lintPages(page('const { data: me } = useMember(); useRows("mine"); useUpdateRow("mine"); useDeleteRow("mine");'), spec),
    [], "a signed-in member editing their own rows is exactly what the level is for");

  const displayOnly = { tables: [{ name: "menu", access: "display", columns: [{ name: "title" }] }] };
  const p2 = lintPages(page('const { data: me } = useMember(); useRows("menu"); useDeleteRow("menu");'), displayOnly);
  assert.ok(p2.some((x) => /no member table/.test(x)), JSON.stringify(p2));
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
  for (const phrase of ["PRIVATE PER MEMBER", "SHARED, MEMBER-AUTHORED", "SHARED, ROLE-WRITABLE"]) {
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
