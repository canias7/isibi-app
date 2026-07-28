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
  REFERENCE_PAGE, UI_COMPONENTS, PAGE_RULES, SITE_PAGES_TOOL, MAX_PAGES, MANAGED_COLUMNS,
  schemaDigest, pagesPrompt, repairPrompt, validatePages, lintPages, briefForPages,
} from "../builder/page-gen.mjs";

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

const page = (source, p = "index.tsx") => [{ path: p, source }];

// ── the copies of things that live on disk ────────────────────────────────────
// The Worker has no filesystem, so the reference page and the component list are
// duplicated into the module. GENERATOR.md's rule is that the file wins, which is
// only enforceable if something notices when they diverge.

test("the reference page in the module is the reference page on disk", () => {
  const disk = fs.readFileSync(path.join(TEMPLATE, "src/routes/index.tsx"), "utf8");
  assert.equal(REFERENCE_PAGE, disk,
    "builder/page-gen.mjs has drifted from src/routes/index.tsx — copy the file over REFERENCE_PAGE");
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
