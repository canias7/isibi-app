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
import { READ_LEVELS, WRITE_LEVELS } from "../site-access.mjs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  REFERENCE_PAGE, REFERENCE_PAGES, UI_COMPONENTS, UI_SHORTLIST, UI_SHORTLIST_API, PAGE_RULES, SITE_PAGES_TOOL, MAX_PAGES, MANAGED_COLUMNS,
  schemaDigest, pagesPrompt, repairPrompt, validatePages, lintPages, briefForPages, ACCESS_NOTE, propsOf, UI_EXPORTS } from "../builder/page-gen.mjs";
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
  // STATED AS THE READ/WRITE PAIR, with the preset name kept beside it. This
  // pinned `access "display"`, and went red when the digest started describing
  // the two axes — a test about wording, on a change that made the digest able
  // to describe the eleven cells no preset names. The preset is still printed,
  // because it is what the schema says and what a revise reads back.
  const d = schemaDigest(SPEC);
  assert.match(d, /TABLE services — read "public", write "none" \("display"\)/);
  assert.match(d, /TABLE appointments — read "none", write "anyone" \("collect"\)/);
  assert.match(d, /never list these rows/i);
  assert.match(d, /PRIVATE PER MEMBER/, "a user-scoped table is now buildable — behind a sign-in");
  // A cell with NO preset name is described in full rather than as its nearest
  // neighbour, which would be wrong in whichever direction they differ.
  const listing = schemaDigest({ tables: [{ name: "listings", read: "public", write: "own", columns: [{ name: "title", type: "text" }] }] });
  assert.match(listing, /TABLE listings — read "public", write "own":/, "an unnamed cell borrowed a preset's name");
  assert.match(listing, /ANYONE READS IT/);
  assert.match(listing, /A SIGNED-IN MEMBER WRITES ROWS THAT BECOME THEIRS/);
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

test("a route addressed as a fragment is reported", () => {
  // THE BUG THIS RULE EXISTS FOR, live on every site built on 2026-08-09.
  // `#/book` was correct under hash history and became a no-op the moment the
  // router moved to browser history: it sets the fragment, matches no route,
  // and the page stays put. `tsc` sees a string, vite bundles it, the site
  // publishes — nothing but a click can tell.
  assert.match(lintPages(page('<a href="#/book">Book</a>'), SPEC).join(" "), /addresses a page as/);
  assert.match(lintPages(page('const CHROME = { links: [{ label: "Book", href: "#/book" }] };'), SPEC).join(" "),
    /addresses a page as/);
  // Any prop name, not just `href` — the first sweep of the exemplars keyed on
  // `href` and missed `manualHref`, `agendaHref` and a ternary. What identifies
  // this is the `#/` in the string, never what the prop is called.
  assert.match(lintPages(page('<VehicleLookup manualHref="#/book" />'), SPEC).join(" "), /addresses a page as/);
});

test("an in-page anchor is NOT reported", () => {
  // `#prices` points at an id on the same page and works perfectly. A rule that
  // refused it would push the model off a correct pattern onto a worse one, and
  // the reference pages themselves use three of them.
  assert.deepEqual(lintPages(page('<a href="#prices">Prices</a><section id="prices" />'), SPEC), []);
  assert.deepEqual(lintPages(page('const L = [{ label: "Find us", href: "#find-us" }];'), SPEC), []);
  // …nor a telephone or an external address.
  assert.deepEqual(lintPages(page('<a href="tel:+441142700000">Call</a>'), SPEC), []);
});

test("the rules tell the model the path form, not just the lint", () => {
  // A lint that refuses something the rules never mention teaches by rejection:
  // the model writes the habit, gets told off, and the problem shows on a site
  // that published anyway. Saying it up front costs a few tokens in a block
  // that rides in the prompt cache.
  assert.match(PAGE_RULES, /NEVER address a page as/);
  assert.match(PAGE_RULES, /location\.hash/, "the imperative form is not mentioned");
  assert.match(PAGE_RULES, /#prices/, "the rules must say an in-page anchor is still fine");
});

test("the chrome routes its links instead of anchoring them", () => {
  // Both files render a `links` array, and a bare `<a href={l.href}>` in either
  // is a full page load to the SERVER root — which on `/s/<slug>/` is the
  // platform, not the site. `SiteLink` is what makes one value correct at every
  // mount. The click test in test/integration/site-routing.mjs proves the
  // header for real; this catches the footer too, which no click test reaches,
  // and it runs in the unit suite where a regression shows up in seconds.
  for (const f of ["site-header.tsx", "site-footer.tsx"]) {
    const src = fs.readFileSync(path.join(TEMPLATE, "src/components/ui", f), "utf8");
    assert.match(src, /<SiteLink/, f + " no longer routes its links");
    assert.doesNotMatch(src, /<a\s[^>]*href=\{l\.href\}/,
      f + " renders a nav link as a bare anchor, which reloads to the server root");
  }
  // …and the wordmark, which is its own element and was the original `#/`.
  const hdr = fs.readFileSync(path.join(TEMPLATE, "src/components/ui/site-header.tsx"), "utf8");
  assert.match(hdr, /<SiteLink href="\/" className="font-semibold/, "the brand link is not routed");
});

test("SiteLink refuses to route a protocol-relative address", () => {
  // `//evil.example` STARTS WITH A SLASH and is another origin — the one shape a
  // naive `startsWith("/")` internal check gets wrong, and the same trap
  // `safeNext` records for OAuth returns. Read from the component's source
  // because the alternative is mounting React to assert one boolean; the
  // behaviour either side of it is covered by the click test in
  // test/integration/site-routing.mjs, which drives a real browser.
  //
  // ANCHORED ON THE PROPERTY, NOT ON THE VARIABLE NAME. This read `href.` and
  // went red on a correct change: `href` is typed `string` and still arrives
  // undefined from a database row (Row's index signature), so the component now
  // reads it through a local that is guaranteed to be a string — at which point
  // a guard naming `href` was a test about spelling. The backreference is what
  // makes it exact: both halves must interrogate the SAME value, or one could
  // check `to` while the other checks something else entirely.
  const src = fs.readFileSync(path.join(TEMPLATE, "src/components/ui/site-header.tsx"), "utf8");
  const i = src.indexOf("const internal =");
  assert.ok(i > 0, "SiteLink's internal check is gone");
  const line = src.slice(i, src.indexOf("\n", i));
  assert.match(line, /^const internal =\s*([A-Za-z_$][\w$]*)\.startsWith\("\/"\)\s*&&\s*!\s*\1\.startsWith\("\/\/"\)/,
    "a protocol-relative address would be routed as an internal path: " + line);
});

test("navigating by assigning location.hash is reported", () => {
  // The same navigation written imperatively, one assignment from the rule
  // above and failing identically. Without it the model reads the href rule and
  // reaches for this instead.
  assert.match(lintPages(page('onSelect={() => { location.hash = "/book"; }}'), SPEC).join(" "),
    /assigning location\.hash/);
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

test("the rules tell the model what an image column is, and to draw it with SafeImage", () => {
  // Uploads land as a URL in a plain text column, and the owner fills those in
  // AFTER the build — so on a fresh site the value is empty and a bare
  // <img src=""> is a broken icon on every card.
  //
  // THIS RULE USED TO TEACH THE MANUAL GUARD, and asserting the guard's wording
  // is what kept it there. `safe-image.tsx` was written specifically to make
  // forgetting impossible ("GENERATOR.md rule 7 exists entirely because of
  // this... this makes forgetting impossible instead") and the rules went on
  // teaching the thing it replaced, so the component was in the kit and unused.
  // The assertion is the invariant now rather than the sentence: point at the
  // component, and do not tell the model to reach for a bare <img>.
  assert.match(PAGE_RULES, /A COLUMN NAMED FOR A PICTURE HOLDS A URL STRING/);
  assert.match(PAGE_RULES, /\/u\/<slug>\//, "and where those URLs come from");
  assert.match(PAGE_RULES, /EVERY PICTURE IS `<SafeImage>`, NEVER A BARE `<img>`/);
  assert.match(PAGE_RULES, /designed placeholder when there is not/,
    "say what an absent src actually does, or the model still writes its own guard");
  assert.ok(!/<img src=\{row\./.test(PAGE_RULES),
    "the rules must not still hand the model a bare <img> to copy for a picture column");
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
  // An optional `(` between the `&` and the `Omit`, because the argument is a
  // UNION now — the columns bare, or nested under `values`. The property being
  // guarded is unchanged and holds in both branches: `id` is omitted from
  // `Partial<T>` before it is intersected, so RowId is never narrowed back to
  // `number`. Pinning the exact spelling failed a correct signature written a
  // different way, which this test's own comment already warns about one
  // assertion up.
  assert.ok(/Omit<Partial<T>, "id"> & \{ id: RowId \}/.test(rows) ||
            /\{ id: RowId \} & \(?Omit<Partial<T>, "id">/.test(rows),
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
  // TWO SHAPES ARE FINE and the variable name is DERIVED, not spelled out here:
  // the body may be posted inline, or held in a const first (which is what the
  // Builder picker needed — the usage has to be stamped with the model that was
  // actually sent). What must not happen is building one request and posting a
  // different one, so the const form is followed through to the stringify.
  const held = gen.match(/const\s+(\w+)\s*=\s*pagesRequest\(/);
  if (held) {
    assert.ok(gen.includes("JSON.stringify(" + held[1] + ")"),
      "generateSitePages builds a request with pagesRequest and then posts something else");
  } else {
    assert.match(gen, /JSON\.stringify\(pagesRequest\(/, "generateSitePages must use pagesRequest");
  }
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
  // DERIVED AT BOTH ENDS, and the comment this replaces was measurably wrong.
  // It said backticked `useThing(` was "how the rules always cite a hook" and
  // scanned for exactly that — which covered 12 of them and silently skipped
  // FIVE REAL @/lib/rows HOOKS the rules tell the model to import, including
  // `useCreateRow`, the single most-used hook on every generated site. Rename or
  // remove one of those and the rules would still name it, every page would fail
  // tsc, and this guard would have stayed green.
  //
  // Two sources now, and neither is a hand list. Every name the rules IMPORT
  // from @/lib/rows in a worked example — unambiguous and complete. Plus every
  // backticked call in the prose, minus the names the rules import from
  // somewhere else, so React's useState and the router's useNavigate exclude
  // themselves rather than being remembered.
  const importedFrom = (mod) => new Set([...PAGE_RULES.matchAll(/import\s*\{([^}]*)\}\s*from\s*"([^"]+)"/g)]
    .filter((m) => m[2] === mod)
    .flatMap((m) => m[1].split(",").map((n) => n.trim().replace(/^type\s+/, "")))
    .filter(Boolean));
  const ours = importedFrom("@/lib/rows");
  const foreign = new Set([...PAGE_RULES.matchAll(/import\s*\{([^}]*)\}\s*from\s*"([^"]+)"/g)]
    .filter((m) => m[2] !== "@/lib/rows")
    .flatMap((m) => m[1].split(",").map((n) => n.trim().replace(/^type\s+/, "")))
    .filter(Boolean));
  // A GENERIC DEFEATS A PATTERN WRITTEN FOR THE NON-GENERIC CASE, which this
  // repo has now recorded four times — and the reference page really does write
  // `useRows<Service>(`. Latent here today; closed anyway, since the cost is one
  // optional group and the failure is silent.
  // ANY BACKTICKED HOOK NAME, WITH OR WITHOUT A CALL. Requiring the paren left
  // `useUpdateRow`, `useDeleteRow` and `useCheckout` uncovered — the rules name
  // them in prose, not in a worked call. The backtick is this file's own
  // convention for "this is a real identifier", and widening to it was MEASURED
  // safe first: all 16 names it admits are exported by rows.ts today, so it
  // adds coverage without adding a false alarm.
  // BACKTICKED NAMES *AND* EVERY CALL IN A WORKED EXAMPLE. `useUploadFile` is
  // shown only inside a ```tsx block — the strongest signal there is, since that
  // is the model being shown the call — and neither the backtick scan nor the
  // import scan reached it.
  //
  // NOT PRECEDED BY A DOT: `Route.useParams()` and `Route.useSearch()` are
  // methods on the route object rather than hooks anybody imports, and they were
  // the only two false positives when this was measured. Excluding the dot takes
  // the list to 18 names, ALL of which rows.ts exports today.
  const cited = [...new Set([
    ...[...PAGE_RULES.matchAll(/`(use[A-Z]\w+)/g)].map((m) => m[1]),
    ...[...PAGE_RULES.matchAll(/(^|[^.\w])(use[A-Z]\w+)\s*(?:<[^>]*>)?\s*\(/gm)].map((m) => m[2]),
  ])].filter((n) => !foreign.has(n));
  const named = [...new Set([...ours, ...cited])].filter((n) => /^use[A-Z]/.test(n));
  assert.ok(ours.size >= 5, "the rules no longer show a worked import from @/lib/rows — re-derive this guard");
  assert.ok(named.length >= 16, "expected the rules to cite several hooks, found " + named.length);
  for (const must of ["useCreateRow", "useUpdateRow", "useDeleteRow", "useUploadFile", "useCheckout"]) {
    assert.ok(named.includes(must),
      must + " is named by the rules and was NOT covered before this guard was rewritten — it must stay covered");
  }
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
  // TO THE NEXT LANDMARK, NOT 900 BYTES. Written `.slice(0, 900)` this went red
  // the moment a comment was added inside the function — the window stopped
  // reaching the header it exists to check, which is this repo's most repeated
  // test bug and is a false alarm rather than a caught regression.
  const at = rows.indexOf("export function useUpdateRow");
  const end = rows.indexOf("export function useDeleteRow", at);
  assert.ok(at > 0 && end > at, "useUpdateRow or its sibling was renamed — the window is empty");
  const update = rows.slice(at, end);
  assert.match(update, /return=representation/,
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
  //
  // A TRAILING `[]` IS NOT BEING CUT OFF, it is the type. This asserted
  // `endsWith("}")`, which is a description of the shapes that existed when it
  // was written rather than of the property it names — and it went red on the
  // fix for `QuoteFiles`, an array recorded as one of its items. What must hold
  // is that the braces are balanced and nothing was truncated mid-object.
  // A LIST ALIAS IS THE OTHER LEGAL SHAPE. `WeekHours = DaySpans[]` carries the
  // one fact a signature cannot — how many — and it has no braces at all, so a
  // blanket `startsWith("{")` refuses the thing that was added to fix a real
  // gap. It has to RESOLVE, though: an alias pointing at a name recorded nowhere
  // leaves the model exactly where it started, reading a name it cannot look up.
  let aliases = 0;
  for (const [mod, types] of Object.entries(COMPONENT_TYPES)) {
    for (const [name, body] of Object.entries(types)) {
      const alias = /^([A-Z][A-Za-z0-9]*)\[\]$/.exec(body);
      if (alias) {
        aliases++;
        assert.ok(types[alias[1]],
          `${mod}.${name} is an alias to ${alias[1]}, whose shape is recorded nowhere: ${body}`);
        continue;
      }
      assert.ok(body.startsWith("{"), `${name} does not start with a shape: ${body}`);
      assert.ok(/\}(\[\])*$/.test(body), `${name} was cut off: ${body}`);
      const opens = (body.match(/\{/g) || []).length, closes = (body.match(/\}/g) || []).length;
      assert.equal(opens, closes, `${name} has unbalanced braces: ${body}`);
    }
  }
  // Or the alias branch above is a rule about nothing and the resolve check is
  // vacuous — the shape this repo keeps recording as a guard that passes for the
  // wrong reason.
  assert.ok(aliases > 0, "no list alias is recorded — the alias branch checks nothing");
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
  //
  // THE `minItems: 1` THAT USED TO BE ASSERTED HERE IS GONE, and removing it was
  // the fix for a different bug measured on 2026-08-11: this one tool serves a
  // build, a revise, an addon and a one-page edit, and it OBLIGED every one of
  // them to return at least one page. A pure deletion has none — so "remove the
  // gallery page" could not be expressed, and the model answered the only way the
  // schema allowed, by rewriting the whole site. Two attempts to fix that with
  // prompt wording failed, because the schema was overruling the words.
  //
  // The protection it provided is NOT lost: `publishPages` already tells the four
  // empty outcomes apart by name — no tool call, no `pages` key, an empty list,
  // and pages with no code — and refuses each. That separation is asserted in
  // `test/publish-pages.test.mjs`; this is the pointer to it, because a reader
  // finding the constraint gone needs to know where it went.
  const pages = SITE_PAGES_TOOL.input_schema.properties.pages;
  assert.equal(pages.minItems, undefined, "a deletion cannot be expressed while this is set");
  assert.deepEqual(SITE_PAGES_TOOL.input_schema.required, ["pages"], "the key itself must still be required");
  // And the description has to say when an empty list is legitimate, or the
  // model has a field it is allowed to use and no idea when.
  assert.match(pages.description, /EMPTY list only when/i, "nothing tells the model when none is right");
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

test("THE PAID GATE RESOLVES THE PAIR — a write-none menu is not told to submit itself", () => {
  // 2026-08-14 audit, confirmed by executing this function. normalizeSchema
  // stamps access:"collect" on every pair-declared table, so the raw-string
  // gate printed "PAID: NO — submit it with useCreateRow" for {read:"public",
  // write:"none"} DIRECTLY UNDER the pair note saying "no form, no
  // useCreateRow" — a prompt that both forbids and prescribes the form.
  const spec = { tables: [
    { name: "services", access: "collect", read: "public", write: "none", columns: [{ name: "name" }] },
  ] };
  const d = schemaDigest(spec);
  // The FORBIDDING mention in the pair note stays; the PRESCRIPTIVE sentence
  // must not appear.
  assert.equal(/PAID: NO/.test(d), false, "a write-none table is told it is an ordinary form: " + d);
  assert.equal(/Submit it with useCreateRow/.test(d), false, "the digest prescribes the form the pair note forbids");
  // The write question is still ANSWERED — the header states the resolved
  // pair and its note — so the absent PAID line is not an unanswered
  // question, which is the publicView failure this digest exists to prevent.
  assert.match(d, /write "none"/);
  assert.match(d, /no form, no useCreateRow/);
});

test("…and a payable table is warned off useCreateRow WHATEVER access it wears", () => {
  // The other direction of the same gate: the payment is the fact that
  // decides, not the preset name — a payable table wearing `user` never got
  // its do-NOT-useCreateRow warning at all.
  const d = schemaDigest({ tables: [
    { name: "products", access: "display", columns: [{ name: "name" }, { name: "price" }] },
    { name: "orders", access: "user", payment: { from: "products", price: "price", currency: "gbp" }, columns: [{ name: "email" }] },
  ] });
  assert.match(d, /PAID: YES/);
  assert.match(d, /Do NOT call useCreateRow/);
  assert.match(d, /useCheckout\("orders"\)/);
});

test("LINT: the write gate resolves the pair — the blind spot and the false alarm, both directions", () => {
  // One token (`canWriteAccess(t.access)` → `canWriteAccess(t)`), both
  // directions confirmed by execution (2026-08-14 audit). The CRIT-D fix
  // updated accessLabel and every neighbouring check to pass the table, and
  // stopped one expression short of this gate.
  const spec = { tables: [
    { name: "services", access: "collect", read: "public", write: "none", columns: [{ name: "name" }] },
    { name: "wall", access: "display", write: "anyone", columns: [{ name: "msg" }] },
  ] };
  // The blind spot: a form against a write-none pair passed CLEAN — a form
  // that 403s for every visitor on a published site, the exact class this
  // lint documents itself as existing for.
  const bad = lintPages(page('const c = useCreateRow("services");'), spec);
  assert.equal(bad.length, 1, JSON.stringify(bad));
  assert.match(bad[0], /403/);
  // The false alarm: a legal write against display+write:anyone was flagged,
  // with the flag's own message printing the correctly-resolved label. This
  // repo's own bar says the false-alarm direction is the worse one.
  assert.deepEqual(lintPages(page('const c = useCreateRow("wall");'), spec), []);
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
  // ANCHORED ON THE WORDS, NOT THE RULE NUMBER, and proved non-empty before it
  // is read. Written `indexOf("14. A TABLE MARKED")`, inserting a rule above it
  // moved both anchors to 15 and 16, `indexOf` answered -1 twice, `slice(-1,-1)`
  // returned the empty string, and this test looped over nothing and PASSED —
  // the vacuous-window failure, caused by my own renumbering, with the whole
  // suite green. A number in an anchor is a fact about ordering that a later
  // edit changes without meaning to.
  const from = PAGE_RULES.indexOf("A TABLE MARKED");
  const to = PAGE_RULES.indexOf("NO EXPLANATORY COMMENTS");
  assert.ok(from > 0 && to > from, "the paid-table rule or the one after it moved — window is empty");
  const example = PAGE_RULES.slice(from, to);
  assert.ok(example.length > 400, "the window collapsed — it is " + example.length + " chars");
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

test("the prompt notes the attachments and otherwise stays out of the way", async () => {
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

  // THE SECOND CLAUSE IS THE ONE THAT EARNS ITS PLACE. Everything else here the
  // model gets from the message; what it cannot get is which of this prompt's
  // TWO "references" wins. The attachment is about THEIR business and the trade
  // exemplar is a generic shape, so a tie broken the other way makes the
  // attachment decorative. Asserted in both directions — the sentence, and the
  // ordering it depends on, since "the attachment wins" read AFTER the example
  // is a rule about something the model has already copied.
  const { FAMILY_EXEMPLARS } = await import("../builder/family-exemplars.mjs");
  const [anyFamily] = Object.keys(FAMILY_EXEMPLARS);
  const withExample = api.pagesPrompt("a cafe", SPEC, "Cafe", anyFamily, 1);
  for (const anchor of ["the attachment wins", "A SITE OF THIS TRADE"]) {
    assert.ok(withExample.includes(anchor), "missing anchor, so the ordering check is vacuous: " + anchor);
  }
  assert.ok(withExample.indexOf("the attachment wins") < withExample.indexOf("A SITE OF THIS TRADE"),
    "the precedence clause reads after the example it takes precedence over");

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

// ── a revise is an EDIT, not a rewrite ───────────────────────────────────────

test("the generator is shown the site as it stands, and told to edit it", async () => {
  // THE OTHER HALF OF "changing pages changes the stuff inside the site".
  // `pagesRequest` was handed the brief and the schema and never the pages, and
  // the container wipes `src/routes` before each build — so a revise rewrote
  // every page from nothing. It stayed on topic, because the brief anchors it,
  // and the words were different every time.
  const { priorPagesBlock, pagesRequest } = await import("../builder/page-gen.mjs");
  const pages = [{ path: "index.tsx", source: "export const A = 1;" },
                 { path: "menu.tsx", source: "export const B = 2;" }];
  const b = priorPagesBlock(pages);
  assert.match(b, /THE SITE AS IT STANDS/);
  assert.match(b, /BYTE-IDENTICAL/, "it must say what NOT to change, not merely show the pages");
  assert.match(b, /export const A = 1;/, "the actual source must be there");
  assert.match(b, /export const B = 2;/);
  assert.match(b, /do not return it/i, "removing a page has to be expressible");

  const req = pagesRequest({ brief: "x", spec: { tables: [] }, brand: "B", priorPages: pages });
  const text = typeof req.messages[0].content === "string"
    ? req.messages[0].content : req.messages[0].content.at(-1).text;
  assert.match(text, /THE SITE AS IT STANDS/, "the block must reach the request");
});

test("a first build sends nothing extra, so that path is unchanged", async () => {
  const { priorPagesBlock } = await import("../builder/page-gen.mjs");
  for (const v of [null, undefined, [], [{}], [{ path: "a.tsx" }], [{ path: "a.tsx", source: "  " }]]) {
    assert.equal(priorPagesBlock(v), "", JSON.stringify(v));
  }
});

test("the site to EDIT comes after the site to COPY", () => {
  // Two references that can disagree: the trade exemplar is a shape to follow
  // and the prior source is this customer's actual site. Read in the other
  // order the model treats its own site as one more example to draw from.
  const src = fs.readFileSync(new URL("../builder/page-gen.mjs", import.meta.url), "utf8");
  const fn = src.slice(src.indexOf("export function pagesPrompt"), src.indexOf("// A route path the container will accept"));
  const example = fn.indexOf("A SITE OF THIS TRADE, DONE WELL");
  // ANCHORED ON THE CALL, NOT ITS ARGUMENT LIST. This read
  // `priorPagesBlock(priorPages)` and went red the day the block learned a
  // second parameter — a test about word order failing a change that was
  // correct, which this repo keeps recording. What it protects is the ORDER.
  const prior = fn.indexOf("priorPagesBlock(");
  assert.ok(example > 0, "the exemplar block is gone — this assertion cannot hold vacuously");
  assert.ok(prior > 0, "pagesPrompt no longer appends the prior source at all");
  assert.ok(prior > example, "the prior source must be appended last");
});

test("a site too large to show degrades instead of blowing the prompt", async () => {
  const { priorPagesBlock } = await import("../builder/page-gen.mjs");
  const huge = [{ path: "index.tsx", source: "x".repeat(200000) }];
  const b = priorPagesBlock(huge);
  assert.ok(b.length < 1000, "it must not inline a 200k-character page");
  assert.match(b, /index\.tsx/, "…but it must still name the pages");
  assert.ok(!b.includes("x".repeat(1000)), "and it must not include the source");
});

test("the source that produced a build is stored, and read back on a revise", () => {
  // A CHAIN. The publish writes it, the route reads it, and the read is gated on
  // this being a revise — any link missing and the generator is back to writing
  // every page from the brief while every test still passes.
  const worker = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  assert.match(worker, /publish: async \(dist, pages\)/, "publish must receive the source");
  assert.match(worker, /await saveSiteSource\(env, slug, pages\);/, "…and store it");
  assert.match(worker, /priorPages: priorBrief \? await loadSiteSource\(env, slug\) : null/,
    "…and a revise must read it back");
  assert.match(worker, /pagesRequest\(\{[^}]*priorPages[^}]*\}\)/, "…and it must reach the model call");
  // NOT under `sites/`, which is what `/s/<slug>/` serves — a site's own TSX is
  // not something to hand to its visitors.
  assert.match(worker, /const SOURCE_KEY = \(slug\) => "source\//);
});

test("an item type drawn through SafeImage carries fallbackSeed", () => {
  // THE MOST COMMON COMPILE ERROR THE GENERATOR MAKES, measured across the
  // page-gen eval: `'fallbackSeed' does not exist in type 'Shot'`, usually three
  // at a time in one file, and each one costs the customer the whole site — the
  // page is refused, the placeholder publishes, and they are charged.
  //
  // The model was RIGHT. `fallbackSeed` is a real `SafeImage` prop, it is in the
  // prompt, and every one of these items is drawn BY a `SafeImage`. The type
  // just did not carry it. Derived over the kit rather than listing the three
  // components known today, so a fourth picture type cannot reintroduce it.
  const dir = path.join(TEMPLATE, "src/components/ui");
  const missing = [];
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".tsx"))) {
    const src = fs.readFileSync(path.join(dir, f), "utf8");
    if (!src.includes("<SafeImage")) continue;
    // The exported item type this component maps over, if it declares one.
    for (const m of src.matchAll(/export type ([A-Z][A-Za-z]*) = \{([^}]*)\}/g)) {
      const [, name, body] = m;
      // Only types that actually hold a picture — a `Column` or a `SortOption`
      // rendered nearby is not one of these.
      if (!/\b(src|image|photo|cover|thumbnail)\??\s*:/.test(body)) continue;
      if (!/fallbackSeed/.test(body)) missing.push(f + " → " + name);
    }
  }
  assert.deepEqual(missing, [],
    "these picture types are drawn through SafeImage but cannot be given a fallbackSeed, " +
    "so the generator passing one — which it does — refuses to compile");
});

test("the guard above is looking at the right thing", () => {
  // It passes vacuously if the scan finds no picture types at all, which is what
  // a broken regex would do. Three are known today.
  const dir = path.join(TEMPLATE, "src/components/ui");
  let found = 0;
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".tsx"))) {
    const src = fs.readFileSync(path.join(dir, f), "utf8");
    if (!src.includes("<SafeImage")) continue;
    for (const m of src.matchAll(/export type ([A-Z][A-Za-z]*) = \{([^}]*)\}/g)) {
      if (/\b(src|image|photo|cover|thumbnail)\??\s*:/.test(m[2])) found++;
    }
  }
  assert.ok(found >= 3, "the picture-type scan found only " + found + " — it has stopped matching");
});

test("the prompt tells the model the field exists", () => {
  // Carrying it on the type is half. If the resolved shape in the prompt still
  // says otherwise the model has no reason to use it, and the fix is invisible.
  assert.match(PAGE_RULES, /Shot = \{[^}]*fallbackSeed/,
    "the generator is still shown a Shot without fallbackSeed");
});

test("an import of a member the module does not export is refused", () => {
  // THE EXACT BUILD THAT FAILED, 2026-08-09: `import { FaqAccordion } from
  // "@/components/ui/faq"`. The module is real, the member never was — so the
  // old check (does the FILE exist) passed it, tsc refused it, and the customer
  // paid for a placeholder. TS2305 is one of the three commonest failures.
  const p = lintPages(page('import { FaqAccordion } from "@/components/ui/faq";'), SPEC);
  assert.match(p.join(" "), /does not export it/);
  assert.match(p.join(" "), /Faq\b/, "the message must name what the module DOES export");
});

test("a correct import, an alias and a type import all pass", () => {
  // The cost of getting this wrong is teaching the model away from a real
  // component, so every legitimate shape has to survive it.
  assert.deepEqual(lintPages(page('import { Faq } from "@/components/ui/faq";'), SPEC), []);
  assert.deepEqual(lintPages(page('import { Gallery, type Shot } from "@/components/ui/gallery";'), SPEC), []);
  assert.deepEqual(lintPages(page('import type { QA } from "@/components/ui/faq";'), SPEC), []);
  assert.deepEqual(lintPages(page('import { Faq as Questions } from "@/components/ui/faq";'), SPEC), []);
  // A module exporting several: all of them are legitimate.
  assert.deepEqual(lintPages(page('import { PageMain, PageNav } from "@/components/ui/landmark";'), SPEC), []);
});

test("a module with no known export list is skipped, not guessed at", () => {
  // A false alarm here is worse than a miss: it teaches the model away from a
  // component that is perfectly real.
  assert.deepEqual(lintPages(page('import { Whatever } from "@/components/ui/button";'), SPEC).filter((x) => /does not export it/.test(x)), []);
});

test("A LOWERCASE HELPER IS NEVER REFUSED — the export list only covers components", () => {
  // FOUND 2026-08-14, and it was live from the day this check shipped. The list
  // is derived from COMPONENT_API, whose extractor matches
  // `export function Name({ … })` — a destructured props object, i.e. a
  // COMPONENT — and then harvests names with /[A-Z][A-Za-z0-9]*\(/. So a
  // lowercase helper exported beside a component is invisible to it TWICE, and
  // an import of one was reported as a member the module does not have.
  //
  // Driven over the REAL KIT rather than a fixture, because the point is how
  // many legitimate imports this refused. Every module here is one a page can
  // import from today.
  const dir = new URL("../builder/lovable/template/src/components/ui/", import.meta.url);
  const helpers = [];
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".tsx"))) {
    const src = fs.readFileSync(new URL(f, dir), "utf8");
    for (const m of src.matchAll(/export (?:function|const) ([a-z][A-Za-z0-9]*)/g)) {
      helpers.push({ mod: f.replace(/\.tsx$/, ""), name: m[1] });
    }
  }
  // A SCAN THAT SILENTLY STOPPED MATCHING would report a clean kit and prove
  // nothing — the vacuous-guard failure this repo keeps recording.
  assert.ok(helpers.length > 50,
    "the helper scan found only " + helpers.length + " — it has stopped matching the kit");

  const flagged = [];
  for (const h of helpers) {
    const out = lintPages(page('import { ' + h.name + ' } from "@/components/ui/' + h.mod + '";'), SPEC)
      .filter((x) => /does not export it/.test(x));
    if (out.length) flagged.push(h.mod + "." + h.name);
  }
  assert.deepEqual(flagged, [],
    "the lint refuses " + flagged.length + " REAL kit helpers, e.g. " + flagged.slice(0, 5).join(", ") +
    " — every one teaches the model away from something that exists");

  // And the thing rule 18 actually tells the model to write.
  assert.deepEqual(
    lintPages(page('import { SeoJsonLd, localBusinessJsonLd } from "@/components/ui/seo-jsonld";'), SPEC),
    [], "a page obeying rule 18 exactly is reported as broken");
});

test("…and an invented COMPONENT name is still refused", () => {
  // The narrowing must not cost the FaqAccordion protection: an invented
  // component name is capital-initial by React's own rule, so it stays in
  // range. Asserted beside the fix, because a narrowing that quietly disabled
  // the whole check would pass the test above perfectly.
  const p = lintPages(page('import { SeoJsonLdCard } from "@/components/ui/seo-jsonld";'), SPEC);
  assert.match(p.join(" "), /does not export it/,
    "the narrowing disabled the check it was meant to keep");
});

test("the naming law and its exceptions are in the prompt", () => {
  // The lint reports; it does not block publishing, so it cannot save the build
  // on its own. What stops the error happening is the model knowing the rule.
  assert.match(PAGE_RULES, /THE EXPORT NAME IS THE FILE NAME IN PascalCase/);
  assert.match(PAGE_RULES, /FaqAccordion/, "the measured case is what makes it concrete");
  // The exceptions are DERIVED, so a new odd-named component appears here
  // without anybody remembering to add it.
  assert.match(PAGE_RULES, /landmark → PageMain/, "the underivable names are not listed");
});

test("the rules say a category column is not alphabetical", () => {
  // Measured on a real published site: a pizzeria's menu came out Dessert,
  // Pizza, Starters — pudding at the top — because the page ordered by the
  // category column and `order` sorts by the VALUE. Not a crash, not a compile
  // error, and nothing in the pipeline can see it; the only guard is the model
  // knowing.
  assert.match(PAGE_RULES, /A CATEGORY IS NOT ALPHABETICAL/);
  // The worked example is the measured case, so the model reads the actual
  // wrong answer rather than an abstraction.
  assert.match(PAGE_RULES, /Dessert, Pizza, Starters/);
  // AND THE LEFTOVER RULE, which is the part that stops the fix creating a
  // worse bug: a hardcoded section list silently drops any row whose category
  // is not in it, so a dish the owner adds later is invisible.
  const from = PAGE_RULES.indexOf("A CATEGORY IS NOT ALPHABETICAL");
  const to = PAGE_RULES.indexOf("A TABLE MARKED");
  assert.ok(from > 0 && to > from, "the category rule or the one after it moved — window is empty");
  const rule = PAGE_RULES.slice(from, to);
  assert.ok(rule.length > 400, "the window collapsed — it is " + rule.length + " chars");
  assert.match(rule, /must still appear/, "nothing tells it not to drop uncategorised rows");
});

test("the rules are numbered 1..N with no gaps and no duplicates", () => {
  // Cheap, derived, and it catches the mistake actually made while inserting the
  // category rule: renumbering by hand left TWO rule 15s for a moment, and
  // nothing would have said so. A duplicate reads to the model as one rule
  // overwriting another, and a gap reads as a rule that was removed.
  const nums = [...PAGE_RULES.matchAll(/^(\d+)\. [A-Z]/gm)].map((m) => Number(m[1]));
  assert.ok(nums.length >= 10, "the rule scan found only " + nums.length + " — it stopped matching");
  assert.deepEqual(nums, nums.map((_, i) => i + 1),
    "the rules are numbered " + nums.join(",") + " — expected 1.." + nums.length);
});

/**
 * Every element in the kit that FLOATS over page content and paints itself with
 * `token`. Both tests below ask through this one function: two copies of the
 * predicate is how the scan and the proof-it-fires drift apart, and then the
 * proof passes against a scan that has stopped matching anything.
 *
 * WHAT IT DELIBERATELY DOES NOT SEE: an unpositioned element that floats only
 * because its PARENT is positioned — `loading-overlay`'s chip sits inside an
 * `absolute inset-0` wrapper and was fixed by hand. Catching those needs to
 * follow the JSX tree, and every cheap approximation of it flags each of the
 * many correct children of an absolute container. A narrow check with a stated
 * hole beats a broad one nobody trusts.
 */
function floatingPanelsPaintedWithThePageToken(token) {
  const kit = path.join(import.meta.dirname, "..", "builder", "lovable", "template", "src", "components", "ui");
  const out = [];
  for (const f of fs.readdirSync(kit).filter((n) => n.endsWith(".tsx"))) {
    // Blank comments rather than delete them, so the line numbers reported here
    // are the real ones — and so the paragraph explaining this rule is not a hit.
    const code = fs.readFileSync(path.join(kit, f), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
      .replace(/^\s*\/\/.*$/gm, "");
    const lines = code.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (!lines[i].includes(token)) continue;
      // `sticky` is IN the page flow — headers and pinned table columns are
      // painted with the page token on purpose, and always were.
      if (/\bsticky\b/.test(lines[i])) continue;
      // An explicit alpha is a deliberate scrim over an image (`/60`, `/85`),
      // not a panel that was meant to be opaque.
      if (new RegExp(token.replace(/[-/]/g, "\\$&") + "\\/\\d").test(lines[i])) continue;
      // Only this element's own class list: a wrapped `cn(...)` string counts,
      // a sibling element's does not.
      const win = [lines[i]];
      for (let j = i + 1; j < Math.min(lines.length, i + 3); j++) {
        if (lines[j].includes("<")) break;          // a new element begins
        win.push(lines[j]);
        if (lines[j].includes(">")) break;          // this one closed
      }
      const cls = win.join(" ");
      // Positioned, with or without a responsive prefix (`md:absolute`) — OR
      // `pointer-events-auto`, which is only ever written on the surface INSIDE
      // a `pointer-events-none` floating layer: that is how a toast or a nudge
      // floats without swallowing clicks on the page beneath. Both instances in
      // the kit (`toast-stack`, `nudge-bubble`) are positioned by a parent, so
      // nothing about their own class list says they float.
      const positioned = /(?:^|[\s"'`])(?:[a-z]+:)?(?:fixed|absolute)\b/.test(cls)
        || /\bpointer-events-auto\b/.test(cls);
      if (!positioned) continue;
      // Casting a shadow is what separates a panel from the things CORRECTLY
      // painted with the page token: a 1px divider drawn to look like a seam, a
      // full-bleed veil over a photo, and the page root itself. `shadow-none`
      // is not a shadow, and matching it flags an ordinary sidebar input.
      if (!/\bshadow(-|\b)/.test(cls) || /\bshadow-none\b/.test(cls)) continue;
      out.push(f + ":" + (i + 1) + "  " + lines[i].trim().slice(0, 90));
    }
  }
  return out;
}

test("no label is tied to a control by a hardcoded id", () => {
  // An `id` written as a literal is the same id on EVERY instance, so a page
  // rendering the component twice — an enquiry form and a newsletter sign-up,
  // billing and delivery addresses, anything inside a `.map()` — gives every
  // field a duplicate, and `<label for>` resolves to the FIRST match. The second
  // form's labels then focus the first form's inputs.
  //
  // Measured before the fix by rendering `ContactForm` and `ShareInvite` twice
  // each: 61 literal ids across 39 files, and the render came back with
  // duplicates. `useId()` is what makes one per instance.
  //
  // ONLY THE LABEL-BOUND ONES. `id="main"` on a skip-link target is a page
  // landmark and is meant to be a fixed name, and `name="_gotcha"` in the
  // honeypot is a server contract — that one keeps its literal NAME and takes a
  // generated id, which is the distinction this rule turns on.
  const kit = path.join(import.meta.dirname, "..", "builder", "lovable", "template", "src", "components", "ui");
  const literal = [];
  for (const f of fs.readdirSync(kit).filter((n) => n.endsWith(".tsx"))) {
    const src = fs.readFileSync(path.join(kit, f), "utf8");
    for (const m of src.matchAll(/ id="([A-Za-z][A-Za-z0-9_-]*)"/g)) {
      if (new RegExp('htmlFor="' + m[1].replace(/[-]/g, "\\$&") + '"').test(src)) {
        literal.push(f + '  id="' + m[1] + '"');
      }
    }
  }
  assert.deepEqual(literal, [],
    "these collide when the component is rendered twice on one page — use useId():\n  "
      + literal.join("\n  "));
});

test("a date value read on the local clock is parsed with toDate", () => {
  // A bare `YYYY-MM-DD` is UTC midnight by spec, and `getDate()` /
  // `toLocaleDateString()` are local — so west of Greenwich the value is the
  // PREVIOUS DAY. Measured in New York: `2026-03-04` rendered as March 3.
  // A Postgres `date` column holds exactly that shape.
  //
  // INVISIBLE FROM THE UK, where the platform is: UTC midnight and local
  // midnight are the same instant in winter and an hour apart in summer, never
  // a different day. That is why 78 call sites across 52 files had it.
  //
  // Scoped to files that actually READ on the local clock, and to an argument
  // shaped like a value rather than an expression — `new Date(Date.now() + ms)`
  // and `new Date(y, m, d)` cannot receive a date string and are left alone.
  const kit = path.join(import.meta.dirname, "..", "builder", "lovable", "template", "src", "components", "ui");
  const raw = [];
  for (const f of fs.readdirSync(kit).filter((n) => n.endsWith(".tsx"))) {
    const code = fs.readFileSync(path.join(kit, f), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
      .replace(/^\s*\/\/.*$/gm, "");
    if (!/getDate\(\)|getDay\(\)|getMonth\(\)|getFullYear\(\)|getHours\(\)|toLocale(Date|Time)?String/.test(code)) continue;
    for (const m of code.matchAll(/new Date\(([^)]*)\)/g)) {
      const arg = m[1].trim();
      if (!arg || arg.includes(",") || /[+\-*/]/.test(arg) || /^[\d_]+$/.test(arg)) continue;
      if (!/^[A-Za-z_$][\w$.?[\]]*$/.test(arg)) continue;
      // ALREADY A DATE. `const deadline = new Date(start)` where `start` came
      // from `toDate(...)` is a CLONE, not a parse, and cloning is the one
      // honest use of the constructor left in these files. Derived from the
      // binding rather than allow-listed by file and line, which would go stale
      // the first time somebody added a line above it.
      if (new RegExp("(?:const|let)\\s+" + arg.replace(/[.?[\]]/g, "\\$&") + "\\s*=\\s*toDate\\(").test(code)) continue;
      raw.push(f + ":" + (code.slice(0, m.index).split("\n").length) + "  new Date(" + arg + ")");
    }
  }
  assert.deepEqual(raw, [],
    "these show the previous day west of Greenwich — parse with toDate():\n  " + raw.join("\n  "));
});

test("money in minor units is never divided by a hardcoded 100", () => {
  // Eighteen components wrote `.format(m / 100)` with `currency` as a free-form
  // prop, so every zero-decimal currency displayed at a HUNDREDTH of its value
  // — ¥1,200 as ¥12 — and the three-decimal ones at ten times.
  // `site-payments.mjs` records the same constant on the CHARGING path: "a
  // hardcoded x100 charges a hundred times the price."
  //
  // Scoped to a CURRENCY formatter on purpose. `/ 100` is also how a percentage
  // is turned into a fraction, which is correct and appears in these same files
  // — `discount-input` and `split-tender` each carry one of each — so a blanket
  // ban on the constant would flag correct arithmetic.
  const kit = path.join(import.meta.dirname, "..", "builder", "lovable", "template", "src", "components", "ui");
  const offenders = [];
  for (const f of fs.readdirSync(kit).filter((n) => n.endsWith(".tsx"))) {
    const code = fs.readFileSync(path.join(kit, f), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
      .replace(/^\s*\/\/.*$/gm, "");
    code.split("\n").forEach((line, i) => {
      if (/style:\s*"currency"[\s\S]*\.format\([^)]*\/\s*10{2,}\s*\)/.test(line)) {
        offenders.push(f + ":" + (i + 1) + "  " + line.trim().slice(0, 90));
      }
    });
  }
  assert.deepEqual(offenders, [],
    "these show a zero-decimal currency at a hundredth of its value — use formatMinor():\n  "
      + offenders.join("\n  "));
});

test("no effect depends on a callback PROP", () => {
  // An inline `onDone={() => …}` is a NEW function on every parent render, so a
  // callback in a dependency array re-runs the effect every time anything above
  // the component re-renders. What that costs depends on the body, and in this
  // kit it cost real behaviour: `typewriter` opened with `setN(0)` and restarted
  // its typing from the first character; `snackbar`, `toast-stack` and
  // `progress-toast` re-armed their auto-dismiss timeouts, so a toast could sit
  // on the page indefinitely; `blocking-overlay` re-armed the timer that reveals
  // its Cancel button, on an overlay whose parent is re-rendering by definition.
  //
  // The component cannot know whether its caller memoised the function, so the
  // answer is always the same: hold the latest one in a ref and call through it.
  // `click-outside`, `infinite-sentinel` and `key-sequence` already did.
  // Where only the PRESENCE of the callback matters, a `!!fn` boolean is the
  // honest dependency — that is `blocking-overlay`.
  const kit = path.join(import.meta.dirname, "..", "builder", "lovable", "template", "src", "components", "ui");
  const offenders = [];
  for (const f of fs.readdirSync(kit).filter((n) => n.endsWith(".tsx"))) {
    const code = fs.readFileSync(path.join(kit, f), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
      .replace(/^\s*\/\/.*$/gm, "");
    // PROPS ONLY. An internal `const onSelect = React.useCallback(…)` is stable
    // by construction and belongs in the deps — `carousel` has exactly that, and
    // a rule matching every `on*` identifier accused it of the opposite of what
    // it does. The names are collected from the destructuring patterns, so what
    // is flagged is a function the CALLER hands in.
    const props = new Set();
    for (const m of code.matchAll(/(?:export )?function \w+\s*\(\s*\{([^}]*)\}/g)) {
      for (const part of m[1].split(",")) {
        const name = (part.match(/^\s*(?:\.\.\.)?([A-Za-z_$][\w$]*)/) || [])[1];
        if (name) props.add(name);
      }
    }
    // A POSITIONAL parameter is caller-supplied too, and a hook is where they
    // turn up: `useCommandShortcut(onOpen: () => void)` re-bound a document
    // keydown listener on every render of whatever called it. Reading only
    // destructured props missed that entirely.
    for (const m of code.matchAll(/(?:export )?function \w+\s*\(\s*([A-Za-z_$][\w$]*)\s*:/g)) props.add(m[1]);
    code.split("\n").forEach((line, i) => {
      // The closing line of a hook's dependency array.
      const m = line.match(/^\s*\}, \[([^\]]*)\]/);
      if (!m) return;
      for (const dep of m[1].split(",").map((d) => d.trim())) {
        if (/^on[A-Z][A-Za-z0-9]*$/.test(dep) && props.has(dep)) {
          offenders.push(f + ":" + (i + 1) + "  depends on " + dep);
        }
      }
    });
  }
  assert.deepEqual(offenders, [],
    "these re-run whenever the parent re-renders, because an inline callback is a new function each time:\n  "
      + offenders.join("\n  "));
});

test("nothing in the kit puts an unsanitised value into the DOM as HTML", () => {
  // `rich-text` assigned its `defaultValue` prop straight to `.innerHTML`, and
  // the signature says `defaultValue?: string` — which reads exactly like an
  // `<input defaultValue>`. React makes you type `dangerouslySetInnerHTML` so
  // the danger is visible at the call site; assigning `.innerHTML` by hand is
  // the same act with the warning removed, and `markdown-preview` in this kit
  // refuses to do it in as many words.
  //
  // Proven by execution, not by reading: mounted in a real browser with
  // `<img src=x onerror=…>` as the prop, the handler FIRED. On a generated site
  // that value is a row a visitor typed, opened by the owner in an editor.
  const kit = path.join(import.meta.dirname, "..", "builder", "lovable", "template", "src", "components", "ui");
  const raw = [];
  const undocumented = [];
  // Two `dangerouslySetInnerHTML` uses are deliberate and both are reasoned in
  // their own source. This is a REVIEW GATE rather than a scan: a third one is
  // a decision somebody should have to make on purpose.
  const ALLOWED_DANGEROUS = new Set(["chart.tsx", "seo-jsonld.tsx"]);
  for (const f of fs.readdirSync(kit).filter((n) => n.endsWith(".tsx"))) {
    const src = fs.readFileSync(path.join(kit, f), "utf8");
    const code = src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " ")).replace(/^\s*\/\/.*$/gm, "");
    for (const m of code.matchAll(/\.innerHTML\s*=\s*([A-Za-z_$][\w$]*)/g)) {
      // The assigned name must be the OUTPUT of the cleaner, in this same file.
      if (!new RegExp("(?:const|let)\\s+" + m[1] + "\\s*=\\s*cleanEditorHtml\\(").test(code)) {
        raw.push(f + ": .innerHTML = " + m[1] + " — not the output of cleanEditorHtml()");
      }
    }
    if (/dangerouslySetInnerHTML/.test(code) && !ALLOWED_DANGEROUS.has(f)) undocumented.push(f);
  }
  assert.deepEqual(raw, [],
    "these put a value into the DOM as HTML without cleaning it:\n  " + raw.join("\n  "));
  assert.deepEqual(undocumented, [],
    "new dangerouslySetInnerHTML — is the value author-written (chart config) or could a " +
    "visitor reach it? Say which in the source, then add it here:\n  " + undocumented.join("\n  "));
});

/**
 * Every MODAL SURFACE painted with `token`.
 *
 * A second rule rather than a widening of the first, because the property is
 * different and so is the evidence for it. The first asks whether an element
 * POSITIONS itself over the page; three real dialogs do not — the full-bleed
 * wrapper is positioned and the surface is a plain `relative` child of it, so
 * a same-element check cannot see any of them. `role="dialog"` says what the
 * element IS, which is the thing that actually decides this: whatever a modal
 * is layered over, you must not be able to read the page through it.
 *
 * An indentation-based ancestor walk was tried first and is not what this is.
 * It misses `modal-stack`, whose wrapper `className` sits at the SAME
 * indentation as the child it wraps, and it flagged a hairline divider and a
 * tab chip that are both correct.
 */
function dialogSurfacesPaintedWithThePageToken(token) {
  const kit = path.join(import.meta.dirname, "..", "builder", "lovable", "template", "src", "components", "ui");
  const out = new Set();
  for (const f of fs.readdirSync(kit).filter((n) => n.endsWith(".tsx"))) {
    const lines = fs.readFileSync(path.join(kit, f), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
      .replace(/^\s*\/\/.*$/gm, "")
      .split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (!/role="dialog"|aria-modal/.test(lines[i])) continue;
      // The dialog's own tag AND the panel just inside it.
      for (let j = i; j < Math.min(lines.length, i + 16); j++) {
        if (!lines[j].includes(token)) continue;
        if (new RegExp(token.replace(/[-/]/g, "\\$&") + "\\/\\d").test(lines[j])) continue;
        out.add(f + ":" + (j + 1) + "  " + lines[j].trim().slice(0, 90));
        break;
      }
    }
  }
  return [...out];
}

/**
 * Every place a file turns one of its OWN `React.ReactNode` props into a string
 * with `String()`, ignoring the sites that narrow with `typeof x === "string"`
 * first — those are the correct form and flagging them teaches the fix away.
 *
 * Returns `file:line  [field]  source` so a failure names the prop, not just
 * the file. Takes the source map so a fixture can be driven through it.
 */
function reactNodesStringified(sources) {
  const out = [];
  for (const [f, src] of sources) {
    const fields = new Set();
    for (const m of src.matchAll(/([A-Za-z_]\w*)\s*\??\s*:\s*React\.ReactNode/g)) fields.add(m[1]);
    if (!fields.size) continue;
    // ONE HOP THROUGH A LOCAL, because a mutation walked straight past the scan
    // without it: `const a = f.before ?? ""` and then `String(a)` is the same
    // bug wearing a different name, and it is how the code reads once somebody
    // pulls a repeated expression out. A local built by `labelText` or already
    // narrowed to a string is NOT added — those are the correct forms, and
    // flagging them teaches the fix away.
    for (const m of src.matchAll(/\b(?:const|let)\s+([A-Za-z_]\w*)\s*=\s*([^;\n]+)/g)) {
      const [, name, rhs] = m;
      if (/labelText\s*\(|typeof\s|String\s*\(/.test(rhs)) continue;
      if ([...fields].some((f) => new RegExp("\\b" + f + "\\b").test(rhs))) fields.add(name);
    }
    // A TYPE PREDICATE IS THE LANGUAGE'S OWN WAY OF SAYING "NARROWED", and a
    // scan that ignores one reports correct code. `isText(a) && isText(b) ? …`
    // is not a stringified node — after that guard TypeScript knows `a` is
    // `string | number`. There are four of these in the whole kit, so honouring
    // them is narrow rather than a licence.
    const predicates = [];
    for (const m of src.matchAll(/(?:const\s+([A-Za-z_]\w*)\s*=\s*(?:<[^>]*>)?\([^)]*\)|function\s+([A-Za-z_]\w*)\s*\([^)]*\))\s*:\s*\w+ is /g)) {
      predicates.push(m[1] || m[2]);
    }
    src.split("\n").forEach((ln, i) => {
      if (/^\s*(\/\/|\*|\/\*)/.test(ln)) return;
      for (const fld of fields) {
        // One level of nested parens inside the call, or `String(at.get(x)?.label)`
        // — a real offender — walks straight past a `[^()]*` body.
        if (!new RegExp("String\\((?:[^()]|\\([^()]*\\))*\\b" + fld + "\\b").test(ln)) continue;
        if (new RegExp("typeof\\s+[^;]*\\b" + fld + "\\b[^;]*===\\s*\"string\"").test(ln)) continue;
        if (predicates.some((p) => new RegExp("\\b" + p + "\\(\\s*" + fld + "\\s*\\)").test(ln))) continue;
        out.push(`${f}:${i + 1}  [${fld}]  ${ln.trim().slice(0, 110)}`);
      }
    });
  }
  return out;
}

const UI_SOURCES = fs.readdirSync(path.join(TEMPLATE, "src/components/ui"))
  .filter((f) => f.endsWith(".tsx"))
  .map((f) => [f, fs.readFileSync(path.join(TEMPLATE, "src/components/ui", f), "utf8")]);

test("no ReactNode prop is turned into a string with String()", () => {
  // `String(<span>Boxes</span>)` is "[object Object]", and a prop typed
  // `React.ReactNode` is an invitation to pass exactly that. Fourteen sites had
  // it. Most were accessible names on icon buttons — the only name those have —
  // but the expensive one was `compare-table`, which used it to decide whether a
  // field had CHANGED: two completely different elements compared equal, so the
  // row was hidden from a diff whose own doc calls it an "are you sure?" screen.
  //
  // THIS IS A SOURCE READ BECAUSE THE RENDER PASS CANNOT SEE IT.
  // `test/integration/kit-render.mjs` checks the HTML for "[object Object]" and
  // walked past all three of the last ones found: its synthesised props are not
  // self-consistent, so `at.get(e.from)` finds no node and the `?? e.from`
  // fallback hides it — and compare-table's bug makes the page render LESS, not
  // wrong, so there is no bad string in the output to find. Two checks, two
  // blind spots, and neither is the other's.
  const offenders = reactNodesStringified(UI_SOURCES);
  assert.deepEqual(offenders, [],
    "these render \"[object Object]\" the moment a caller passes JSX:\n  " + offenders.join("\n  "));
});

test("…and that scan can see one, and does not skip the guarded form", () => {
  // A scan that has stopped matching reports a clean kit — this repo's most
  // repeated own-goal. Driven over a fixture rather than over the kit, because
  // the kit is now clean and a check whose only evidence is an empty list is
  // evidence of nothing.
  const found = reactNodesStringified([["fixture.tsx", `
    export function F({ label, title, note, tag }: { label: React.ReactNode; title: React.ReactNode; note: React.ReactNode; tag: React.ReactNode }) {
      const isText = (v: React.ReactNode): v is string | number => typeof v === "string";
      const a = String(label);
      const b = String(rows.get(k)?.title ?? "");
      const hop = note ?? "";
      const c = String(hop);
      const ok1 = typeof label === "string" ? label : "";
      const ok2 = isText(tag) ? String(tag) : "";
      const ok3 = String(labelText(tag));
      return <p aria-label={a + b + c + ok1 + ok2 + ok3} />;
    }`]]);
  assert.equal(found.length, 3, "the scan saw " + found.length + " of the 3 offenders: " + found.join(" | "));
  assert.ok(found.some((h) => h.includes("[label]")), "a bare String(prop) is not seen");
  assert.ok(found.some((h) => h.includes("[title]")), "String() with a nested call inside is not seen");
  // A MUTATION WALKED PAST THE SCAN THROUGH EXACTLY THIS. Pulling the value into
  // a local is how the code reads once a repeated expression is factored out,
  // and a name-based scan follows it or it does not cover the shape people write.
  assert.ok(found.some((h) => h.includes("[hop]")), "a ReactNode reaching String() through a local is not seen");
  assert.ok(!found.some((h) => h.includes("typeof label")), "the typeof-narrowed form is flagged, which teaches the fix away");
  assert.ok(!found.some((h) => h.includes("isText(tag)")), "a type-predicate narrow is flagged — that IS the correct form");
  assert.ok(!found.some((h) => h.includes("labelText(tag)")), "String(labelText(x)) is flagged, and it is already text");
});

/** Every JSX tag in a file, in order, with its full attribute text. Walks brace
 *  depth so a nested `onKeyDown={(e) => { … }}` does not end the tag early — the
 *  first version of this scan stopped at the first `>` and reported two
 *  components for a handler that is written on the very element it was reading. */
function jsxTags(src) {
  const s = src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
               .replace(/\/\/[^\n]*/g, (m) => " ".repeat(m.length));
  const out = [];
  for (let i = 0; i < s.length; i++) {
    if (s[i] !== "<") continue;
    const m = /^<(\/?)([A-Za-z][\w.]*)/.exec(s.slice(i, i + 40));
    if (!m) continue;
    let j = i + m[0].length, d = 0, q = null;
    for (; j < s.length; j++) {
      const c = s[j];
      if (q) { if (c === q && s[j - 1] !== "\\") q = null; continue; }
      if (c === '"' || c === "'" || c === "`") { q = c; continue; }
      if (c === "{") d++; else if (c === "}") d--;
      else if (c === ">" && d === 0) break;
    }
    const attrs = s.slice(i + m[0].length, j);
    out.push({ close: m[1] === "/", name: m[2], attrs, self: attrs.trimEnd().endsWith("/"),
               line: s.slice(0, i).split("\n").length });
    i = j;
  }
  return out;
}

const IS_BUTTON = (t) => t.name === "button" || (t.name === "Button" && !/\basChild\b/.test(t.attrs));
const IS_OPTION = (t) => /role="option"/.test(t.attrs);
const INTERACTIVE = (t) =>
  /^(button|a|input|select|textarea)$/.test(t.name) || IS_BUTTON(t) ||
  /role="(button|link|checkbox|switch|tab|option|menuitem|radio)"/.test(t.attrs);

/** Interactive content nested inside some container it may not be in. */
function interactiveInside(sources, isContainer) {
  const out = [];
  for (const [f, src] of sources) {
    const stack = [];
    for (const t of jsxTags(src)) {
      if (t.close) { for (let k = stack.length - 1; k >= 0; k--) if (stack[k].name === t.name) { stack.length = k; break; } continue; }
      const outer = stack.find(isContainer);
      if (outer && INTERACTIVE(t)) out.push(`${f}:${t.line}  <${t.name}> inside the <${outer.name}> on line ${outer.line}`);
      if (!t.self) stack.push(t);
    }
  }
  return out;
}
const interactiveInsideAButton = (sources) => interactiveInside(sources, IS_BUTTON);

test("nothing focusable is nested inside a role=\"option\"", () => {
  // An option is CHOSEN THROUGH THE THING THAT OWNS FOCUS — a combobox input
  // announcing it with `aria-activedescendant`, or the listbox itself under a
  // roving tabindex. A focusable control inside one is not allowed, and the
  // practical cost is that Tab walks through the whole popup instead of leaving
  // the field: eight components wrapped every option in a `<button>`, so a
  // 24-typeface list was 24 tab stops.
  //
  // Their own `onMouseDown` + `preventDefault` said the buttons were never
  // meant to take focus — it exists to stop focus leaving the input — so they
  // were tabbable purely by accident.
  const offenders = interactiveInside(UI_SOURCES, IS_OPTION);
  assert.deepEqual(offenders, [], "focusable content inside an option:\n  " + offenders.join("\n  "));
});

/**
 * A listbox that handles its OWN arrow keys, and how its options can be reached.
 *
 * Two correct answers and no third: roving tabindex, where one option is
 * `tabIndex={0}` and arrows move the zero; or `aria-activedescendant`, where
 * focus stays on an input and the active option is named by id. A listbox with
 * neither is operable by mouse only.
 *
 * Scoped to files that own their keys, because most of these listboxes are
 * driven by a caller's input and correctly have no keyboard model of their own.
 */
function listboxesWithNoWayIn(sources) {
  const out = [];
  for (const [f, src] of sources) {
    if (!/role="listbox"/.test(src)) continue;
    if (!/onKeyDown/.test(src) || !/ArrowDown/.test(src)) continue;
    if (/aria-activedescendant/.test(src)) continue;
    // A roving tab stop: some option's tabIndex expression can produce 0.
    const roving = jsxTags(src).some((t) => /role="option"/.test(t.attrs) && /tabIndex=\{[^}]*\b0\b/.test(t.attrs));
    if (!roving) out.push(f);
  }
  return out;
}

test("a listbox that owns its arrow keys can be reached by a keyboard", () => {
  // `font-picker` is why this exists. Converting its options from nested
  // `<button>`s to real `role="option"` rows is right, and doing it without a
  // roving tab stop would have left a list nothing can focus at all — mouse
  // only, silently, with every other check in this repo still green. A mutation
  // setting every row to `tabIndex={-1}` survived the whole suite until this.
  const offenders = listboxesWithNoWayIn(UI_SOURCES);
  assert.deepEqual(offenders, [], "these listboxes handle arrow keys and nothing can focus them:\n  " + offenders.join("\n  "));
  // And the scan must still SEE the self-driving listboxes, or it is passing
  // because its filter stopped matching anything.
  const owning = UI_SOURCES.filter(([, s]) => /role="listbox"/.test(s) && /ArrowDown/.test(s));
  assert.ok(owning.length >= 2, "only " + owning.length + " listboxes own their keys — the scan filtered everything out");
});

test("…and that reachability scan can see a listbox with no way in", () => {
  const roving = `<ul role="listbox" onKeyDown={(e) => { if (e.key === "ArrowDown") move(1); }}>
      <li role="option" tabIndex={i === at ? 0 : -1}>a</li></ul>`;
  assert.deepEqual(listboxesWithNoWayIn([["ok.tsx", roving]]), [], "a roving tab stop is flagged, which is the correct pattern");
  assert.deepEqual(listboxesWithNoWayIn([["bad.tsx", roving.replace("i === at ? 0 : -1", "-1")]]), ["bad.tsx"],
    "a listbox whose every option is tabIndex={-1} is not seen");
  const activedesc = `<input aria-activedescendant={id} onKeyDown={(e) => { if (e.key === "ArrowDown") next(); }} />
      <ul role="listbox"><li role="option">a</li></ul>`;
  assert.deepEqual(listboxesWithNoWayIn([["ok2.tsx", activedesc]]), [], "aria-activedescendant is flagged, which is the other correct pattern");
});

test("…and that option scan can see one, and does not flag the option itself", () => {
  const found = interactiveInside([["fixture.tsx", `
    <ul role="listbox">
      <li role="option"><button type="button">nope</button></li>
      <li role="option" tabIndex={0} onClick={pick}><span>fine — the option IS the control</span></li>
      <li role="option"><a href="/x">also nope</a></li>
    </ul>`]], IS_OPTION);
  assert.equal(found.length, 2, "the scan saw " + found.length + " of the 2: " + found.join(" | "));
  assert.ok(found.some((h) => h.includes("<button>")) && found.some((h) => h.includes("<a>")),
    "the scan misses one of the two shapes: " + found.join(" | "));
});

test("nothing interactive is nested inside a button", () => {
  // `<button>`'s content model forbids interactive content, and the kit broke it
  // twice: `drop-zone` put its `<input type="file">` inside the button that
  // opens it, and `multi-select` put a `role="button"` remove control inside the
  // trigger. It matters more here than in an ordinary React app because this
  // template PRERENDERS every route — the invalid markup is in the HTML a
  // browser parses, not only in a tree script builds.
  //
  // The ARIA half is the one that bit: a control nested inside another control
  // is announced as something operable, and `multi-select`'s could not be
  // reached by any keyboard or screen-reader user at all.
  const offenders = interactiveInsideAButton(UI_SOURCES);
  assert.deepEqual(offenders, [], "interactive content inside a button:\n  " + offenders.join("\n  "));
});

test("…and that nesting scan can see one, through a wrapper and a role alike", () => {
  const found = interactiveInsideAButton([["fixture.tsx", `
    <div>
      <button type="button"><input type="file" /></button>
      <Button><span role="button" onClick={(e) => { e.stopPropagation(); }}>x</span></Button>
      <Button asChild><a href="/ok">fine</a></Button>
      <button type="button"><span>plain</span></button>
      <li role="option"><button type="button">also fine here</button></li>
    </div>`]]);
  assert.equal(found.length, 2, "the scan saw " + found.length + " of the 2: " + found.join(" | "));
  assert.ok(found.some((h) => h.includes("<input>")), "a form control inside a button is not seen");
  assert.ok(found.some((h) => h.includes("<span>")), "an interactive ROLE inside a button is not seen");
  // `asChild` hands the props to the child, so the wrapper is not the button —
  // flagging it would refuse the kit's own correct link-styled-as-button idiom.
  assert.ok(!found.some((h) => h.includes("<a>")), "asChild is treated as a real button");
});

test("a date is never turned into an ISO attribute without a guard", () => {
  // `new Date(x).toISOString()` throws RangeError on an unparseable value, DURING
  // RENDER, so the error boundary takes the whole page rather than one
  // timestamp — and `Row`'s index signature means `at={row.collected_at}`
  // typechecks against any column at all. Forty sites had it.
  //
  // V8's parser is why it survived: it reads "Sample 0" as the year 2000, so
  // even a test feeding a component nonsense gets a valid Date most of the time
  // and the crash appears only for whichever nonsense happens not to parse.
  // THE RULE IS ABOUT WHERE THE CONVERSION HAPPENS, not about which date it is:
  // `.toISOString()` may not appear inside a `dateTime` attribute. Anything
  // computed there has, by construction, not been checked — and the alternative
  // shapes are already in the kit and already correct: `dateTime={isoAttr(x)}`,
  // or a `const iso` computed once and rendered behind a ternary.
  //
  // A draft that judged a LOCAL by whether its file contained a NaN check went
  // through three roundsn of tuning and still cried wolf on `iso ? <time
  // dateTime={iso}>`, which is right. A rule being tuned to its corpus is a rule
  // about the corpus.
  const sites = [], bad = [];
  for (const [f, src] of UI_SOURCES) {
    src.split("\n").forEach((ln, i) => {
      if (/^\s*(\/\/|\*)/.test(ln)) return;
      for (const m of ln.matchAll(/dateTime=\{([^}]*)\}/g)) {
        sites.push(`${f}:${i + 1}`);
        // `date-format.tsx` is the one exemption and it earns it by returning
        // early on an unreadable date — it is where the guard lives, so it
        // cannot be asked to call the helper built out of it.
        if (f === "date-format.tsx") continue;
        if (/\.toISOString\(\)/.test(m[1])) bad.push(`${f}:${i + 1}  ${ln.trim().slice(0, 100)}`);
      }
    });
  }
  assert.deepEqual(bad, [], "these throw on a date they cannot read — use isoAttr():\n  " + bad.join("\n  "));
  assert.ok(sites.length > 0, "nothing in the kit renders a <time dateTime> — the scan is asserting nothing");
  const df = UI_SOURCES.find(([f]) => f === "date-format.tsx");
  assert.ok(df && /Number\.isNaN\(d\.getTime\(\)\)/.test(df[1]),
    "date-format.tsx is exempt because it guards, and that guard is gone");
});

test("a <time> never wraps a DateFormat, which is already a <time>", () => {
  // `DateFormat` renders its OWN `<time dateTime>`, so
  // `<time dateTime={…}><DateFormat/></time>` emitted a time inside a time —
  // measured in the rendered output, 35 sites. Worse than redundant: the outer
  // used `new Date()` and the inner uses `toDate()`, which disagree about a
  // bare `YYYY-MM-DD` by the local UTC offset, so the two nested elements
  // carried two different machine-readable instants for one date.
  const bad = [];
  for (const [f, src] of UI_SOURCES) {
    for (const m of src.matchAll(/<time[^>]*>\s*<DateFormat/g)) {
      bad.push(`${f}:${src.slice(0, m.index).split("\n").length}`);
    }
  }
  assert.deepEqual(bad, [], "a <time> wrapping a <DateFormat>:\n  " + bad.join("\n  "));
  assert.ok(UI_SOURCES.some(([f]) => f === "date-format.tsx"), "DateFormat is gone — this rule is about nothing");
});

test("no MODAL SURFACE paints itself with the page-root token", () => {
  // Found 2026-08-12 while fixing the floating-panel class above: four
  // `role="dialog"` surfaces were on `--background`, which 449 of the 500
  // themes re-emit with alpha. A dialog is the worst possible thing to be able
  // to read the page through, and shadcn's own `dialog`/`alert-dialog` in this
  // same kit have used `bg-popover` throughout.
  const offenders = dialogSurfacesPaintedWithThePageToken("bg-background");
  assert.deepEqual(offenders, [],
    "a visitor can read the page through these dialogs:\n  " + offenders.join("\n  "));
});

test("…and the dialog check can see one, and is not just matching nothing", () => {
  // A rule that has stopped matching reports a clean kit. Reading the SAME
  // predicate back for the token the correct dialogs use proves it still finds
  // dialog surfaces at all — 14 of them, including the four just fixed.
  const correct = dialogSurfacesPaintedWithThePageToken("bg-popover");
  assert.ok(correct.length >= 10,
    "the dialog scan found only " + correct.length + " surfaces — it has stopped matching");
  for (const f of ["modal-stack.tsx", "filter-drawer.tsx", "shortcut-overlay.tsx", "guided-step.tsx"]) {
    assert.ok(correct.some((c) => c.startsWith(f)), "the scan no longer sees " + f);
  }
});

test("no FLOATING panel paints itself with the page-root token", () => {
  // A theme with a decorative backdrop re-emits `--background` at 35% alpha on
  // purpose — every generated page's root div carries `bg-background`, and an
  // opaque token would hide the wash the theme paints on the body. Correct for
  // the ROOT, and wrong for anything floating over it: measured live on a
  // published site, the mobile menu rendered see-through with the page's own
  // headings legible through the panel.
  //
  // DERIVED, not a list of the four known today: a fifth overlay added later
  // would inherit the same bug, and upstream shadcn says `bg-background` on all
  // of them, so a component refresh is the likely way it comes back.
  //
  // IT CAME BACK, and this predicate is the second attempt (2026-08-12). The
  // first asked for `fixed` AND `z-\d` ON ONE LINE, which is a description of
  // the four it was written for rather than of the bug. Eleven components had
  // reintroduced it and it saw none of them, in three different ways:
  //   - `absolute` panels (rich-tooltip, share-sheet, whats-new-dot, slide-over,
  //     snap-carousel, node-graph) — a tooltip floats every bit as much as a
  //     sheet, and `fixed` was never the property that mattered;
  //   - `fixed` panels whose stacking is in `style={{ zIndex }}` rather than a
  //     class (drawer-stack, sheet-stack), so no `z-N` was ever on the line;
  //   - a class list that WRAPS, carrying `md:absolute` onto the next string
  //     inside the same `cn(...)` (mega-menu).
  // Measured at the time: 449 of the 500 themes re-emit `--background` with
  // alpha, 295 of them at 0.35. Assert the property, not the spelling.
  const offenders = floatingPanelsPaintedWithThePageToken("bg-background");
  assert.deepEqual(offenders, [],
    "these float over the page and would be translucent on a backdrop theme:\n  " + offenders.join("\n  "));
});

test("…and the check can actually see a violation — in all three shapes it once missed", () => {
  // The scan returning [] is worth something only if it would find one. Reading
  // the kit back for `bg-popover` puts the ELEVEN fixed components in front of
  // the predicate exactly as they were when they were broken, so this cannot
  // rot into a check on a hand-typed string that no longer resembles the bug.
  const caught = floatingPanelsPaintedWithThePageToken("bg-popover").join("\n");
  for (const [file, shape] of [
    ["rich-tooltip.tsx", "an `absolute` panel"],
    ["drawer-stack.tsx", "a `fixed` panel whose zIndex is in style={{}}"],
    ["mega-menu.tsx", "a class list that wraps onto the next line"],
  ]) {
    assert.ok(caught.includes(file), "the predicate stopped seeing " + shape + " (" + file + ")");
  }
});

test("the rules show an UPDATE call, not just the hook's name", () => {
  // `useUpdateRow` was named ONCE in the whole prompt with no worked example,
  // while `useCreateRow` had nine — so the shape was guessed, and the guess
  // (`{ id, values: {...} }`, natural because create takes the columns bare) was
  // the top remaining compile error: `values` read as a column name, four times
  // in five eval runs.
  assert.match(PAGE_RULES, /update\.mutate\(\{ id: deal\.id, stage: "won" \}/,
    "the rules still do not show what an edit call looks like");
  // Both shapes really are accepted, so telling the model about the second one
  // is not a lie. Asserted against the template's own signature.
  const rows = fs.readFileSync(path.join(import.meta.dirname, "..", "builder", "lovable", "template", "src", "lib", "rows.ts"), "utf8");
  assert.match(rows, /export type UpdateArg<T> = \{ id: RowId \} & \(Omit<Partial<T>, "id"> \| \{ values: Omit<Partial<T>, "id"> \}\)/,
    "the rules promise a nested `values` the hook does not accept");
  assert.match(rows, /mutationFn: \(arg: UpdateArg<T>\)/, "useUpdateRow no longer takes both shapes");
});

/* ------------------------- a prop the component does not take */

test("the lint catches a prop invented on a component it CAN see", () => {
  // The failure the eval actually records. Every recorded compile error was on a
  // component whose signature was in the prompt — `render` on a `Column`,
  // `title` on an `Activity` — not on one the model could not see. Caught here
  // it costs nothing; caught by `tsc` it costs the page.
  const page = (body) => ({ path: "p.tsx", source:
    'import { createFileRoute } from "@tanstack/react-router";\n' +
    'export const Route = createFileRoute("/")({ component: P });\n' + body });
  const hits = (body) => lintPages([page(body)], { tables: [] })
    .filter((x) => /not part of that shape|does not take/.test(x));

  assert.equal(hits('import { SafeImage } from "@/components/ui/safe-image";\nfunction P(){ return <SafeImage src="/x" caption="no" />; }').length, 1,
    "a wrong JSX attribute is not caught");
  assert.equal(hits('import { DataTable } from "@/components/ui/data-table";\nfunction P(){ return <DataTable columns={[{ key:"a", header:"A", render:(r:any)=>r.x }]} rows={[]} />; }').length, 1,
    "a wrong key inside a prop's object is not caught");
  assert.equal(hits('import { ActivityFeed } from "@/components/ui/activity-feed";\nfunction P(){ return <ActivityFeed items={[{ who:"a", what:"b", at:"c", title:"x" }]} />; }').length, 1,
    "a wrong key in an Activity is not caught");
});

test("…and never flags a correct page", () => {
  // THE MEASUREMENT THAT DECIDES WHETHER THIS LINT CAN EXIST. A rule that cries
  // wolf teaches the model away from components that are perfectly real, which
  // is worse than the miss it prevents. Driven over every reference page and
  // every family exemplar — 328 known-good pages, the same corpus the model
  // learns the kit from.
  //
  // Getting here took five separate fixes, every one of them a false alarm on a
  // page that was right: a second copy of the splitter that never got the `=>`
  // guard (121 pages), a module documenting one of its several exports (55), the
  // innermost braces read as the item (24), prose inside strings scanned as code
  // (14), and a nested element's props read as the outer one's (1).
  const roots = [
    path.join(import.meta.dirname, "..", "builder", "lovable", "template", "src", "family-pages"),
    path.join(import.meta.dirname, "..", "builder", "lovable", "template", "src", "routes"),
  ];
  const files = [];
  const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p); else if (e.name.endsWith(".tsx") && e.name !== "__root.tsx") files.push(p);
  } };
  for (const r of roots) if (fs.existsSync(r)) walk(r);
  assert.ok(files.length > 300, "the corpus scan found only " + files.length + " pages — it has drifted");
  // JUDGED BY ROOT, and the split is required rather than tidy.
  //
  // A family exemplar is presentational by design — `family-pages.test.mjs`
  // asserts none of them imports `@/lib/rows` or calls `fetch` — so `{tables: []}`
  // is the TRUTHFUL spec for one and every rule's answer about it is meaningful.
  // The reference pages are wired to data, so the same empty spec makes them
  // report table-not-declared for tables that really exist; their unfiltered
  // coverage lives at the REFERENCE_SPEC sweep near the top of this file, which
  // is the only spec that makes them honest.
  //
  // So the 324 exemplars go through the WHOLE lint. Filtering to the rule family
  // a test was written for is how ~18 of the ~20 rules ended up swept by nothing
  // — and the first unfiltered run found 4 pages flagged for
  // `import { X, type Y }`, the idiom these very exemplars teach.
  const fam = [];
  const bad = [];
  for (const f of files) {
    const all = lintPages([{ path: "x.tsx", source: fs.readFileSync(f, "utf8") }], { tables: [] });
    const where = f.includes("family-pages") ? fam : bad;
    const out = where === fam ? all : all.filter((x) => /not part of that shape|does not take/.test(x));
    if (out.length) where.push(path.basename(path.dirname(f)) + "/" + path.basename(f) + ": " + out[0]);
  }
  assert.deepEqual(bad, [], "the prop lint flags known-good pages:\n  " + bad.slice(0, 8).join("\n  "));
  assert.deepEqual(fam, [], "the FULL lint flags known-good family exemplars:\n  " + fam.slice(0, 8).join("\n  "));
});

test("a TYPE import is not judged against the export list", () => {
  // MEASURED: this was the entire output of the full lint over the 324 family
  // exemplars — 4 pages, all correct, all this shape. `UI_EXPORTS` records value
  // exports plus only the shapes `extractTypes` kept, so it has no opinion about
  // a string union; stripping the `type ` and judging the name anyway is the
  // guess the skip-an-unknown-module rule beside it exists to refuse.
  //
  // Driven with a REAL pair off the kit, so the case cannot rot into fiction.
  const ui = path.join(import.meta.dirname, "..", "builder", "lovable", "template", "src", "components", "ui", "rsvp-buttons.tsx");
  const kit = fs.readFileSync(ui, "utf8");
  assert.match(kit, /export type Rsvp\b/, "rsvp-buttons no longer exports the type this case is built on");
  assert.match(kit, /export function RsvpButtons\b/, "rsvp-buttons no longer exports the component this case is built on");

  const lint = (src) => lintPages([{ path: "x.tsx", source: src }], { tables: [] })
    .filter((x) => /does not export it/.test(x));

  assert.deepEqual(lint('import { RsvpButtons, type Rsvp } from "@/components/ui/rsvp-buttons";'), [],
    "an inline type specifier is judged against a list that does not know the kit's unions");
  assert.deepEqual(lint('import type { Rsvp } from "@/components/ui/rsvp-buttons";'), [],
    "a whole-clause type import is judged against a list that does not know the kit's unions");

  // AND `type` IS NOT A PASSWORD. Skipping type specifiers was the first fix and
  // is strictly worse: an invented type is a real TS2305, and with an honest
  // export list it is catchable. Measured, the skip also changed no answer —
  // dropping the `type ` strip made the name fail the capital-initial test one
  // line down, so it was inert protection reading as real.
  assert.equal(lint('import { RsvpButtons, type Invented } from "@/components/ui/rsvp-buttons";').length, 1,
    "an invented TYPE is not caught — the rule is skipping instead of judging");
  assert.equal(lint('import type { Invented } from "@/components/ui/rsvp-buttons";').length, 1,
    "an invented type in a whole-clause import is not caught");

  // AND THE UN-PREFIXED FORM IS CLEAN TOO, which is a fact about the EXPORT LIST
  // rather than about this rule. `verbatimModuleSyntax` is false in the template
  // (builder/lovable/template/tsconfig.json), so `import { RsvpButtons, Rsvp }`
  // compiles — and skipping only the `type`-prefixed form would still have
  // refused it, on 30 modules whose one exported type is a string union that
  // `COMPONENT_TYPES` drops by design. `COMPONENT_TYPE_NAMES` is what makes the
  // list honest; without it this line reports and the message lists the exports
  // without the name it just refused.
  assert.deepEqual(lint('import { RsvpButtons, Rsvp } from "@/components/ui/rsvp-buttons";'), [],
    "a union type imported without the keyword is refused — UI_EXPORTS does not know the kit's type exports");
  assert.deepEqual(lint('import { DateEnquiry, DateStatus } from "@/components/ui/date-enquiry";'), [],
    "same, on the module the gap was measured against");

  // AND THE PROTECTION IS UNTOUCHED — the failure this rule was written for.
  assert.equal(lint('import { FaqAccordion } from "@/components/ui/faq";').length, 1,
    "an invented component name is no longer caught");
  assert.equal(lint('import { DateEnquiry, Invented } from "@/components/ui/date-enquiry";').length, 1,
    "an invented name beside a real one is no longer caught");
});

test("UI_EXPORTS knows every type the kit exports, not only the shaped ones", () => {
  // DERIVED FROM THE KIT, both directions, because the failure it prevents is
  // silent: a name missing here is a false alarm on a page that compiles, and
  // the message helpfully lists the exports without the one it just refused.
  //
  // `COMPONENT_TYPES` cannot answer this on its own — `extractTypes` walks braces
  // and keeps only object shapes, so a string union has no entry. Asserted as a
  // sweep rather than as a list of the 30 known today, so a 31st union added
  // tomorrow is covered without anybody remembering this file.
  const dir = path.join(import.meta.dirname, "..", "builder", "lovable", "template", "src", "components", "ui");
  const gaps = [];
  let seen = 0;
  for (const f of fs.readdirSync(dir).filter((n) => n.endsWith(".tsx"))) {
    const mod = f.replace(/\.tsx$/, "");
    const known = UI_EXPORTS[mod];
    if (!known) continue;
    for (const m of fs.readFileSync(path.join(dir, f), "utf8").matchAll(/^export\s+(?:type|interface)\s+([A-Z][A-Za-z0-9]*)/gm)) {
      seen++;
      if (!known.has(m[1])) gaps.push(mod + "." + m[1]);
    }
  }
  // A scan that silently stopped matching would report a perfect kit.
  assert.ok(seen > 300, `only ${seen} exported types found across the kit — the scan has drifted`);
  assert.deepEqual(gaps, [], "UI_EXPORTS does not know these exported types, so importing one is falsely refused:\n  " + gaps.slice(0, 10).join("\n  "));
});

test("aria-* and data-* are DOM passthrough, never a signature miss", () => {
  // These reach the DOM through the component's rest props and are in no
  // signature, so judging them against one flags the accessibility attributes a
  // good page carries — punishing exactly the pages we want more of. Measured
  // without the guard: `aria-hidden` and `data-testid` on a correct <SafeImage>
  // both report. The 328-page corpus did not hold this, so it is driven here.
  const src = 'import { createFileRoute } from "@tanstack/react-router";\n' +
    'import { SafeImage } from "@/components/ui/safe-image";\n' +
    'export const Route = createFileRoute("/")({ component: P });\n' +
    'function P(){ return <SafeImage src="/x" aria-hidden="true" data-testid="hero" />; }';
  const hits = (s) => lintPages([{ path: "p.tsx", source: s }], { tables: [] })
    .filter((x) => /not part of that shape|does not take/.test(x));
  assert.deepEqual(hits(src), [], "aria-*/data-* are being judged against the signature");
  // …and an invented attribute on the same element still reports, so the above
  // is not passing on a lint that has stopped reading attributes at all.
  assert.equal(hits(src.replace('data-testid="hero"', 'caption="no"')).length, 1,
    "the passthrough case passes because nothing is checked, not because the guard held");
});

test("`=>` is not a closing bracket, and the case that proves it is in a PAGE", () => {
  // `(row: T) => React.ReactNode` drove the depth negative, so every field after
  // a function-typed one was lost — and a field the reader cannot see is a FALSE
  // ALARM on correct code, which is the one thing this lint must never produce.
  //
  // WHERE THE PROOF HAD TO COME FROM IS THE POINT. Removing the guard changes
  // the extracted props of ZERO of the 2,017 kit components (measured), because
  // `Math.max(0, d - 1)` absorbs the negative depth whenever the arrow sits at
  // the top of a shape — which is where every un-truncated kit signature puts
  // it. So the whole 328-page corpus stayed green and the mutant read as inert.
  // It is not: a PAGE can nest an arrow one brace deeper than any signature
  // does, and there the clamp does not save it. Driven with exactly that.
  const page = (body) => ({ path: "p.tsx", source:
    'import { createFileRoute } from "@tanstack/react-router";\n' +
    'import { ActivityFeed } from "@/components/ui/activity-feed";\n' +
    'export const Route = createFileRoute("/")({ component: P });\n' + body });
  const hits = (body) => lintPages([page(body)], { tables: [] })
    .filter((x) => /not part of that shape|does not take/.test(x));

  // An object-valued field holding an arrow. Every key here is real; without the
  // guard the depth drops to 0 at the `>` and the comma after it splits the
  // item, so `tz` — a key of the INNER object — is judged against Activity.
  assert.deepEqual(hits('function P(){ return <ActivityFeed items={[{ who:"a", what:"b", at:{ on:(x)=>x, tz:"UTC" } }]} />; }'), [],
    "an arrow nested inside a field's object breaks the depth count");
  // …and the same page with a genuinely wrong key still reports, so the
  // assertion above is not passing on a lint that has stopped looking.
  assert.equal(hits('function P(){ return <ActivityFeed items={[{ who:"a", what:"b", at:{ on:(x)=>x }, title:"t" }]} />; }').length, 1,
    "the clean case passes because the lint went quiet, not because the guard held");
});

test("a spread makes the lint SKIP, in both places it can appear", () => {
  // A spread can supply ANYTHING, so there is no honest answer about which
  // props or keys are present — and the whole justification for this lint is
  // that it never cries wolf. Two separate guards, because a spread lands in
  // two different places and a mutation proved neither was held: `{...props}`
  // on the element, and `...base` inside the object handed to a prop. Each is
  // driven with a case the lint WOULD otherwise flag, so a passing assertion
  // means the guard fired rather than that the page happened to be clean.
  const page = (body) => ({ path: "p.tsx", source:
    'import { createFileRoute } from "@tanstack/react-router";\n' +
    'export const Route = createFileRoute("/")({ component: P });\n' + body });
  const hits = (body) => lintPages([page(body)], { tables: [] })
    .filter((x) => /not part of that shape|does not take/.test(x));

  const attrSpread = 'import { SafeImage } from "@/components/ui/safe-image";\n' +
    'function P(){ return <SafeImage src="/x" {...rest} caption="no" />; }';
  assert.equal(hits(attrSpread).length, 0, "an element carrying {...} must not have its attributes judged");
  assert.equal(hits(attrSpread.replace(" {...rest}", "")).length, 1,
    "the spread case passes because the page is clean, not because the guard fired");

  const keySpread = 'import { ActivityFeed } from "@/components/ui/activity-feed";\n' +
    'function P(){ return <ActivityFeed items={[{ ...base, title:"x" }]} />; }';
  assert.equal(hits(keySpread).length, 0, "an object containing a spread must not have its keys judged");
  assert.equal(hits(keySpread.replace(" ...base,", "")).length, 1,
    "the key-spread case passes because the object is clean, not because the guard fired");
});

test("an unreadable signature makes the lint SKIP, never guess", () => {
  // `gen-component-api` elides a long nested type with an ellipsis, which leaves
  // an unbalanced brace — so the prop list looks complete and is not. 15 of 2,032
  // components are in that state, and on one of them a correct page was reported
  // as wrong. Skipping is the only safe answer.
  const withEllipsis = Object.entries(COMPONENT_API).find(([, v]) => String(v).includes("…"));
  assert.ok(withEllipsis, "no component has a truncated signature — this guard now checks nothing");
  assert.equal(propsOf(withEllipsis[0]), null, "a truncated signature must not yield a partial prop list");
  // …and a component with a whole signature still answers.
  assert.ok((propsOf("safe-image") || []).includes("fallbackSeed"));
});

test("the designer can DECLARE the pair, or the whole grid is unreachable", () => {
  // THE HALF THAT MAKES IT A FEATURE. The policy layer can express all sixteen
  // cells; if the designer's tool has no slot for them, none of it can ever be
  // asked for — which is precisely the state 14 other schema features are in,
  // fully built and reachable by nothing. Asserted at BOTH ends, because the
  // substrate and the vocabulary are in different files and either alone is a
  // dead feature wearing the other's clothes.
  const w = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const at = w.indexOf('name: "design_schema"');
  assert.ok(at > 0, "the designer's tool is gone");
  const tool = w.slice(at, at + 36000);
  for (const [field, values] of [["read", READ_LEVELS], ["write", WRITE_LEVELS]]) {
    assert.match(tool, new RegExp("\\n\\s+" + field + ": \\{"), "the designer cannot declare " + field);
    for (const v of values) {
      assert.ok(tool.includes('"' + v + '"'), field + " cannot be set to " + v);
    }
  }
  // AND THE CASE IT WAS BUILT FOR IS NAMED. The five presets were each described
  // accurately and the missing combination was described nowhere, so the
  // designer had no reason to reach for it — the same failure as `publicView`,
  // whose description named only the booking slot.
  assert.match(tool, /USE 'public' WITH write 'own' FOR ANYTHING VISITORS POST AND OTHER VISITORS BROWSE/,
    "the one combination with no shorthand is not pointed at, so it will not be used");
  assert.match(tool, /marketplace/i);
  // …and the five shorthands still say what they are, or this trades one gap
  // for another.
  assert.match(tool, /'display' = anyone reads it, nobody writes/);
});

test("only what is reachable end to end is declarable", () => {
  // EXPOSED ONLY WHAT IS REACHABLE END TO END. `sequence` creates a column
  // nothing stamps, `audit` and `history` build tables the Worker reads in zero
  // places, and `version` is a lock the client never sends back. Offering any
  // of those would be the dead-feature trap one layer up — a slot that looks
  // like a capability and does nothing.
  //
  // `checks` MOVED LISTS ON 2026-08-16, and that is this test working rather
  // than this test being wrong: it pinned "copied into _meta and emits no DDL
  // at all", which was true when it was written and stopped being true when the
  // constraint tier landed. `computed` and `transitions` joined it — a
  // generated column and a BEFORE UPDATE trigger — and `searchWeights` now
  // weights the tsvector document it was always stored beside.
  const w = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const tool = w.slice(w.indexOf('name: "design_schema"'), w.indexOf('name: "design_schema"') + 40000);
  for (const f of ["oncePerUser", "enforceRefs", "expires", "scheduled",
                   "checks", "computed", "transitions", "searchWeights", "defaultSort"]) {
    assert.match(tool, new RegExp("\\n\\s+" + f + ": \\{"), f + " is not declarable, so no site can have it");
  }
  for (const f of ["sequence", "audit", "history", "version",
                   // STILL DEAD, EACH FOR ITS OWN REASON, and none of them is
                   // "nobody got round to it". `mask` and `fieldRoles` name OUR
                   // roles, which Postgres does not have, and the Worker left
                   // the read and write paths when reads moved to the Data API.
                   // `sla`, `roundRobin` and `assignBy` are the named-verb class
                   // the 2026-07-30 direction rules out — the model writes those
                   // as `functions`. `formulas` is `computed` with arithmetic,
                   // and two fields for one job is how they drift apart.
                   // `currency` would bake a static FX table into a column that
                   // is wrong within a day; live rates are what `apis` is for.
                   // `geo` is two column names and no distance query to use them.
                   // `teamRead` needs a manager hierarchy on `neon_auth."user"`,
                   // a table Neon owns and we cannot add a column to.
                   "mask", "fieldRoles", "sla", "roundRobin", "assignBy",
                   "formulas", "currency", "geo", "teamRead"]) {
    assert.doesNotMatch(tool, new RegExp("\\n\\s+" + f + ": \\{"),
      f + " is offered but is not reachable end to end — check it stamps/reads/sends before exposing it");
  }
});

test("a site nobody can read says so ONCE, as a fact about the whole schema", () => {
  // THE FAILURE THIS EXISTS FOR cost a customer a whole site. A marketplace came
  // back with `events` private per member, `bookings` write-only and `reviews`
  // members-only — every table described perfectly, and not one visitor able to
  // see a single listing. The generator had no home page it could honestly write
  // and returned NOTHING; the failure surfaced two steps later at
  // `stage: validate` with a message that named none of this.
  //
  // No per-table line can say it, because it is a property of the SET.
  const shut = schemaDigest({ tables: [
    { name: "events", access: "user", columns: [{ name: "title", type: "text" }] },
    { name: "bookings", access: "collect", columns: [{ name: "email", type: "text" }] },
    { name: "reviews", access: "feed", columns: [{ name: "rating", type: "int" }] },
  ] });
  assert.match(shut, /NOTHING ON THIS SITE IS READABLE BY A SIGNED-OUT VISITOR/);
  assert.match(shut, /offers a sign-in/, "it states the fact without saying what to build instead");
  assert.equal((shut.match(/NOTHING ON THIS SITE/g) || []).length, 1, "said more than once");

  // A STATEMENT OF FACT, NOT A RULE — which is what makes it safe. A site with
  // ONE public table must stay quiet, or every ordinary business site carries a
  // paragraph telling it not to build the page it should be building.
  const open = schemaDigest({ tables: [
    { name: "menu", access: "display", columns: [{ name: "dish", type: "text" }] },
    { name: "bookings", access: "collect", columns: [{ name: "email", type: "text" }] },
  ] });
  assert.doesNotMatch(open, /NOTHING ON THIS SITE/, "a site with a public table was told it has none");

  // …and a publicView is what makes a private table browsable, so it counts.
  // Missing this would tell a correctly-built marketplace it cannot be built —
  // the exact instruction that would stop it working.
  const projected = schemaDigest({ tables: [
    { name: "events", access: "user", publicView: { columns: ["title"] }, columns: [{ name: "title", type: "text" }] },
  ] });
  assert.doesNotMatch(projected, /NOTHING ON THIS SITE/, "a publicView was not counted as readable");

  // The new read/write pair reaches it too, not only the preset names.
  const pair = schemaDigest({ tables: [{ name: "listings", read: "public", write: "own", columns: [{ name: "t", type: "text" }] }] });
  assert.doesNotMatch(pair, /NOTHING ON THIS SITE/, "a pair-declared public table was not counted");

  // An empty schema says nothing — there is no site to describe, and the
  // digest already has its own wording for that.
  assert.doesNotMatch(schemaDigest({ tables: [] }), /NOTHING ON THIS SITE/);
});

// ── a page may not name a colour ─────────────────────────────────────────────
//
// The reason is a feature rather than a preference. A site's colours come from
// its theme and its per-site token patch, both applied by the CONTAINER — so a
// page that writes `bg-amber-400` is unreachable by either, and "make the
// background yellow" moves the token, reports success and changes nothing. That
// is the edit lane's `look` layer silently doing nothing.

test("the colour rules do not fire on a single page of the corpus the model learns from", async () => {
  // THE ONLY MEASUREMENT THAT DECIDES WHETHER THIS RULE CAN EXIST. A lint that
  // cries wolf teaches the model away from something perfectly correct, which is
  // strictly worse than the miss it prevents. Driven over all 329 pages — the 4
  // reference pages and 324 family exemplars — and it has to be ZERO.
  const { lintPages } = await import("../builder/page-gen.mjs");
  const root = new URL("../builder/lovable/template/src/", import.meta.url);
  const files = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = new URL(e.name + (e.isDirectory() ? "/" : ""), dir);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".tsx")) files.push(p);
    }
  };
  walk(new URL("family-pages/", root));
  walk(new URL("routes/", root));
  assert.ok(files.length > 300, "only found " + files.length + " corpus pages — the scan broke");
  const pages = files.map((f) => ({ path: f.pathname, source: fs.readFileSync(f, "utf8") }));
  const colour = lintPages(pages, { tables: [] }).filter((p) => /colour|color/i.test(p));
  assert.deepEqual(colour, [], "the colour rules false-alarm on pages we wrote ourselves");
});

test("each colour shape is caught, and each near-miss is left alone", async () => {
  const { lintPages } = await import("../builder/page-gen.mjs");
  const wrap = (cls) => ({
    path: "index.tsx",
    source: 'import {createFileRoute} from "x";\nexport const Route = createFileRoute("/")({});\n' +
      'export default function P(){return <div className="' + cls + '">hi</div>;}',
  });
  const colourOf = (cls) => lintPages([wrap(cls)], { tables: [] }).filter((p) => /colour|color/i.test(p));

  for (const bad of ["bg-amber-400", "text-red-600", "border-slate-200", "ring-blue-500", "from-pink-50", "divide-gray-100"]) {
    assert.equal(colourOf(bad).length, 1, "must flag the literal class " + bad);
  }
  for (const bad of ["bg-[#ff0000]", "text-[rgb(255,0,0)]", "border-[hsl(0,100%,50%)]", "bg-[oklch(0.7_0.2_40)]"]) {
    assert.equal(colourOf(bad).length, 1, "must flag the fixed colour " + bad);
  }

  // THE NEAR-MISSES, and every one of them is real in the corpus or in the kit.
  for (const ok of [
    "bg-background text-foreground",     // the tokens themselves
    "bg-muted/40 text-muted-foreground",
    "bg-primary hover:bg-primary/90",
    "text-[0.7rem] text-[11px]",         // an arbitrary SIZE, which the corpus uses
    "grid-cols-2 gap-4 md:gap-6",        // numbers that are not colours
    "border-2 rounded-xl shadow-sm",
    "bg-cover bg-center",                // bg- utilities that name no colour
    "text-sm font-medium tracking-tight",
  ]) {
    assert.deepEqual(colourOf(ok), [], "must NOT flag: " + ok);
  }
});

test("a three-digit hex is left alone, because an in-page anchor looks exactly like one", async () => {
  // MEASURED: the corpus really does contain `href="#add"`, `#123` and `#125`.
  // Flagging those would teach the model away from an anchor that is correct,
  // which costs more than the miss — so six or eight digits only.
  const { lintPages } = await import("../builder/page-gen.mjs");
  const page = (body) => ({
    path: "index.tsx",
    source: 'import {createFileRoute} from "x";\nexport const Route = createFileRoute("/")({});\n' +
      "export default function P(){return " + body + ";}",
  });
  const colourOf = (body) => lintPages([page(body)], { tables: [] }).filter((p) => /colour|color/i.test(p));
  assert.deepEqual(colourOf('<a href="#add">Add</a>'), [], "an in-page anchor is not a colour");
  assert.deepEqual(colourOf('<a href="#prices">Prices</a>'), []);
  assert.equal(colourOf('<div style={{ color: "#ff0000" }} />').length, 1, "a six-digit hex IS a colour");
  assert.equal(colourOf('<div style={{ color: "#ff0000ff" }} />').length, 1, "an eight-digit hex IS a colour");
});

test("one page reports the colour problem once, not once per occurrence", async () => {
  // A page with forty literal classes would otherwise bury every other problem
  // the lint found, and the fix is the same sentence either way.
  const { lintPages } = await import("../builder/page-gen.mjs");
  const many = Array.from({ length: 12 }, (_, i) => "bg-red-" + (100 + i * 100)).join(" ");
  const out = lintPages([{
    path: "index.tsx",
    source: 'import {createFileRoute} from "x";\nexport const Route = createFileRoute("/")({});\n' +
      'export default function P(){return <div className="' + many + '">hi</div>;}',
  }], { tables: [] }).filter((p) => /colour|color/i.test(p));
  assert.equal(out.length, 1);
});

test("the rules give the REASON a page may not name a colour, not just the ban", async () => {
  // A lint problem does not block publishing, so what actually stops this is the
  // model knowing the law. The rules already said "breaks dark mode", which is
  // true and is now the weaker half: since the edit lane shipped, a hardcoded
  // colour is one the OWNER can never change.
  const { PAGE_RULES } = await import("../builder/page-gen.mjs");
  assert.match(PAGE_RULES, /NEVER a literal colour/);
  assert.match(PAGE_RULES, /never change/i, "the rules must say what it costs the owner, not only that it is banned");
  // All three shapes named, so the model is not left inferring that only the
  // Tailwind palette counts.
  for (const shape of ["bg-slate-900", "text-red-600", "bg-[#1a1a1a]", "hex in a style prop"]) {
    assert.ok(PAGE_RULES.includes(shape), "the rules do not name the shape: " + shape);
  }
});

// ─────────────────────────────────────────────────────────────────────────
// A CUSTOMER CAN CHANGE THEIR BOOKING, NOT ONLY CANCEL IT.
//
// The claim link could read and cancel — `PATCH` was an honest 405 — so "move my
// Tuesday cut to Thursday" meant cancelling and rebooking, typing everything in
// again. On a table with `unique` or `noOverlap` that gives the slot up BEFORE
// the new one is secured, so a customer can lose the only appointment they had
// while trying to move it by an hour.
//
// The engine could always do this: a declared function takes `tok` plus whatever
// arguments it likes. Three links were missing — no client hook, the designer was
// never told to declare a third function, and the reference page never showed
// one. Each is asserted separately, because this repo has recorded a feature dead
// at ONE silent link six times and every one looked fine from both ends.
test("the amend hook exists, is cited, and is shown", () => {
  const rows = fs.readFileSync(path.join(TEMPLATE, "src", "lib", "rows.ts"), "utf8");

  // 1. It exists, and takes a FUNCTION NAME like its two siblings — a page
  //    calling it with a table name reaches an endpoint that is not there.
  assert.match(rows, /export function useAmendClaim\(fn: string\)/,
    "useAmendClaim is missing from the template, or does not take the function name");
  // 2. It carries the token AND the caller's fields. Sending only `tok` is what
  //    `useCancelClaim` already does; without values this is that hook again.
  assert.match(rows, /values: Record<string, unknown>/, "useAmendClaim takes no values, so it cannot change anything");
  // 3. THE TOKEN WINS OVER THE CALLER'S FIELDS. Asserted by EVALUATING the real
  //    expression rather than matching its spelling — the first draft of this
  //    pinned `{ tok: claim, ...values }` and called it the protection, which is
  //    exactly backwards: a later property wins in an object literal, so that
  //    order lets `values.tok` replace the token proving who is asking. A
  //    spelling assertion cannot tell those two apart; running it can.
  const amendFn = rows.slice(rows.indexOf("export function useAmendClaim"));
  const amendBody = amendFn.slice(0, amendFn.indexOf("\n}"));
  assert.ok(amendBody.length > 100 && amendBody.length < 2000, "useAmendClaim was not read whole: " + amendBody.length);
  const literal = amendBody.match(/JSON\.stringify\((\{[^}]*\})\)/);
  assert.ok(literal, "useAmendClaim no longer builds its body from an object literal — check this by hand");
  const build = new Function("claim", "values", "return " + literal[1]);
  assert.equal(build("MINE", { date: "Thu" }).tok, "MINE", "the token does not reach the request at all");
  assert.equal(build("MINE", { tok: "SOMEONE ELSE", date: "Thu" }).tok, "MINE",
    "the caller's fields are written over the token, so a page could send someone else's tok");
  assert.equal(build("MINE", { date: "Thu" }).date, "Thu", "the caller's fields never reach the function");

  // 4. RULE 10 names it — windowed, because the reference page below ALSO
  //    contains the string, so a bare `PAGE_RULES` match passes via the page
  //    even when the rule itself has lost it. Found by mutation: swapping the
  //    citation out of rule 10 left this green. The neighbour-satisfies-the-
  //    assertion failure, which this repo keeps recording.
  const rule10 = PAGE_RULES.slice(PAGE_RULES.indexOf("10. GIVE THE VISITOR THEIR SUBMISSION BACK"));
  const r10 = rule10.slice(0, rule10.indexOf("\n11."));
  assert.ok(r10.length > 200 && r10.length < 4000, "rule 10 was not found whole: " + r10.length);
  assert.match(r10, /useAmendClaim/, "rule 10 never mentions the amend hook");
  assert.match(r10, /values:/, "rule 10 does not show the call shape, so the model invents one");
  // 5. …and SHOW it. A rule the model is told but never shown is one it
  //    satisfies by inventing a shape, which is why there are four reference
  //    pages rather than one.
  const manage = REFERENCE_PAGES.find((p) => p.path === "manage.tsx");
  assert.ok(manage, "the manage reference page is gone");
  assert.match(manage.source, /useAmendClaim\(/, "the manage page names the hook but never calls it");
  assert.match(manage.source, /values: \{/, "the manage page never demonstrates passing values");
});

test("the designer is told to declare the amend function", () => {
  // Without this the hook is real, the page knows how to call it, and no schema
  // ever declares the function it needs — the dead-at-one-link shape again, at
  // the only layer that can create one.
  const tool = fs.readFileSync(path.join(ROOT, "worker.js"), "utf8");
  const i = tool.indexOf("OPTIONAL Postgres functions this site needs");
  assert.ok(i > 0, "the functions description was not found");
  const desc = tool.slice(i, tool.indexOf("RECEIVING DATA FROM ANOTHER SYSTEM", i));
  assert.ok(desc.length > 200, "the functions description was not found whole: " + desc.length);
  assert.match(desc, /THIRD/, "the designer is not told to declare a third, amend function");
  assert.match(desc, /UPDATE \.\.\. WHERE claim_token = tok/, "…and is not told what its body does");
  // The REASON, not just the instruction: this repo's own lesson is that a rule
  // whose reason is stated survives an edit that a bare rule does not.
  // THE CONSEQUENCE, NOT THE ALTERNATIVE'S NAME. This matched "cancel and
  // rebook" alone, so a mutation deleting the clause that says WHY that is bad
  // left it green — the reason is the half that survives an edit, and it was
  // the half nothing held.
  assert.match(desc, /cancel and rebook/i, "the alternative is not named");
  assert.match(desc, /giving up the slot before/i,
    "the COST of cancel-and-rebook is unstated, so the rule is one edit from being dropped");
});

// ─────────────────────────────────────────────────────────────────────────────
// EVERY PAGE NEEDS ITS OWN `<h1>`, and the rules have to say so.
//
// Added 2026-08-13 after a real site shipped `/work` carrying the HOME page's
// `<title>`. The platform derives a sub-page's title and share card from its
// `<h1>` at publish time, and only 11 of the kit's ~2,000 components render one
// against 49 that render an `<h2>` — so a page assembled from sections has none
// and silently inherits the site's name.
//
// `site-meta.mjs` now falls back to `<h2>`, which fixes every existing site on
// its next publish and is the load-bearing half. This rule is the other half,
// and it is worth having on its own account: a document whose top heading is an
// `<h2>` is malformed for a screen reader, which no title fallback repairs.
//
// Asserted because a prompt rule nobody holds is one a later edit drops without
// anybody noticing — proved by mutation, where deleting it changed nothing.

test("the rules require one h1 per page, and say why the section header is not it", () => {
  assert.match(PAGE_RULES, /EVERY PAGE HAS EXACTLY ONE .?<h1>/,
    "the rules no longer require a per-page h1 — a section-built page will inherit the site title");
  const from = PAGE_RULES.indexOf("EVERY PAGE HAS EXACTLY ONE");
  const win = PAGE_RULES.slice(from, PAGE_RULES.indexOf("A TABLE MARKED", from));
  assert.ok(win.length > 200, "the h1 rule's window is empty — the anchor moved");
  // The distinction that makes it actionable. Without it the model is told to
  // add an h1 and has no idea why its SectionHeader does not count.
  assert.match(win, /SectionHeader/, "the rule does not name the component that is NOT a page heading");
  assert.match(win, /PageHeader|CollectionHeader|Hero/, "the rule names no component that DOES render an h1");
  // Both reasons, because the accessibility one holds even if the title
  // derivation is changed or removed later.
  assert.match(win, /screen reader/i, "the rule gives no accessibility reason");
  assert.match(win, /title|share/i, "the rule does not say the title is derived from it");
});

// ─────────────────────────────────────────────────────────────────────────────
// PARTIAL VALIDATE AND THE SITE IT CANNOT SEE. Found by the 2026-08-13 audit and
// reproduced with this module: the dangling-link rewrite judged links against
// only the pages POSTED, and the edit/addon lanes post only what the model
// returned — so a one-page edit with a correct <Link to="/book"> published with
// the link pointed at "/", and problems[] told the customer their live booking
// page did not exist. A false report AND a silently broken CTA, on the cheap
// lanes specifically built to touch one page.

const EDIT_PAGE = {
  pages: [{ path: "manage.tsx", source: 'import { createFileRoute, Link } from "@tanstack/react-router";\nexport const Route = createFileRoute("/manage")({ component: M });\nfunction M() { return <div><Link to="/book">Back to booking</Link><Link to="/nowhere">gone</Link></div>; }\n' }],
};

test("partial validate keeps links into the site's OWN live pages", () => {
  const v = validatePages(structuredClone(EDIT_PAGE), { partial: true, knownRoutes: ["/", "/book", "/work"] });
  assert.match(v.pages[0].source, /to="\/book"/, "a correct link into an unchanged live page was rewritten");
  assert.ok(!v.problems.some((p) => /\/book/.test(p)), "a live page was reported as nonexistent: " + JSON.stringify(v.problems));
  // And a link to a route that exists NOWHERE — posted or stored — is still
  // caught, or the fix traded a false alarm for a dead build.
  assert.match(v.pages[0].source, /to="\/">gone/, "a genuinely dangling link stopped being rewritten");
  assert.ok(v.problems.some((p) => /\/nowhere/.test(p)), "the genuinely dangling link went unreported");
});

test("partial validate with NO knownRoutes does not judge links at all", () => {
  // Rewriting on a guess is what broke working pages. Without the site's routes
  // the rewrite cannot tell live from dangling, so it must leave the source
  // alone — a genuinely dangling link is still refused downstream, because the
  // lanes compile changed pages together with the stored site and TanStack's
  // route union makes it a type error.
  const v = validatePages(structuredClone(EDIT_PAGE), { partial: true });
  assert.match(v.pages[0].source, /to="\/book"/, "a link was rewritten with nothing to judge it against");
  assert.match(v.pages[0].source, /to="\/nowhere"/, "a link was rewritten with nothing to judge it against");
  assert.ok(!v.problems.some((p) => /linked to and do not exist/.test(p)),
    "a dangling-link problem was reported from a partial view that cannot know");
});

test("the full build's rewrite is unchanged by the knownRoutes option", () => {
  const v = validatePages(structuredClone(EDIT_PAGE));
  assert.match(v.pages[0].source, /to="\/">Back to booking/, "the full-build rewrite of a dangling link stopped working");
});

test("both partial lanes hand validate the stored site's routes", () => {
  // The module fix is nothing if the lanes do not pass what they know — the
  // wiring layer, this repo's most-recorded failure. Both call sites must carry
  // knownRoutes derived from their stored-page list.
  // Windowed, not regex-matched to the closing paren: a first draft used
  // `[^;]*?\)` and the match ended at the `)` inside `(eSrc || [])`, cutting the
  // window short of the very line it asserts — a guard that could only fail.
  const worker = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const wins = [];
  for (let i = worker.indexOf("validatePages("); i >= 0; i = worker.indexOf("validatePages(", i + 1)) {
    const win = worker.slice(i, i + 400);
    if (/partial:\s*true/.test(win)) wins.push(win);
  }
  assert.equal(wins.length, 2, "expected the two partial lanes, found " + wins.length);
  for (const c of wins) {
    assert.match(c, /knownRoutes:/, "a partial lane calls validate without the site's own routes:\n" + c.slice(0, 200));
    assert.match(c, /routeOf\(/, "knownRoutes is not derived from the stored pages:\n" + c.slice(0, 200));
  }
});

// ── A LINK WRITTEN AS A PLAIN ANCHOR ────────────────────────────────────────
//
// The dangling-link rewrite covers `to=`/`to:` only — the TYPED forms, where a
// route that does not exist is a TS2322 and the build dies. A plain
// `<a href="/quote">` compiles, bundles and publishes, and lands the visitor on
// the router's not-found page. Nobody gets a signal: not the owner, not us.

test("a href to a page that was never written is REPORTED", () => {
  const p = (path, body) => ({ path, source:
    'import { createFileRoute } from "@tanstack/react-router";\n' +
    'export const Route = createFileRoute("/x")({});\n' +
    "function P() { return <div>" + (body || "") + "</div>; }" });
  const dead = (body, extra = []) => validatePages({ pages: [p("index.tsx", body), ...extra] })
    .problems.filter((x) => x.includes("not found"));

  assert.equal(dead('<a href="/quote">Get a quote</a>').length, 1);
  assert.match(dead('<a href="/quote">x</a>')[0], /\/quote/);
  assert.deepEqual(dead('<a href="/book">Book</a>', [p("book.tsx")]), [], "a live route was called dead");
});

test("…and REPORTED rather than rewritten, unlike the typed form", () => {
  // The asymmetry is deliberate. The `to=` rewrite exists because the
  // alternative is losing the whole site to a failed compile; there is no build
  // to save here. And an href may legitimately hold a non-route path, where a
  // wrong exemption in a REWRITE breaks a working link and a wrong exemption in
  // a REPORT costs one noisy sentence.
  const src = 'import { createFileRoute } from "@tanstack/react-router";\n' +
    'export const Route = createFileRoute("/x")({});\n' +
    'function P() { return <a href="/quote">x</a>; }';
  const out = validatePages({ pages: [{ path: "index.tsx", source: src }] });
  assert.match(out.pages[0].source, /href="\/quote"/, "the href was rewritten — a typed-form remedy on an untyped link");
});

test("the exemptions hold, because a wrong one breaks a working link", () => {
  const p = (path, body) => ({ path, source:
    'import { createFileRoute } from "@tanstack/react-router";\n' +
    'export const Route = createFileRoute("/x")({});\n' +
    "function P() { return <div>" + (body || "") + "</div>; }" });
  const dead = (body, extra = []) => validatePages({ pages: [p("index.tsx", body), ...extra] })
    .problems.filter((x) => x.includes("not found"));

  for (const [what, body] of [
    ["an upload", '<a href="/u/slug/menu.pdf">Menu</a>'],
    ["the data API", '<a href="/api/db/x/data/y">x</a>'],
    ["the internal mount", '<a href="/s/other/">x</a>'],
    ["a published file", '<a href="/sitemap.xml">map</a>'],
    ["an external link", '<a href="https://instagram.com/x">IG</a>'],
    ["an in-page anchor", '<a href="#prices">Prices</a>'],
  ]) {
    assert.deepEqual(dead(body), [], what + " was reported as a dead page link");
  }
  // The query and the fragment are not part of the route, and a trailing slash
  // is the same address.
  assert.deepEqual(dead('<a href="/book?svc=cut#top">Book</a>', [p("book.tsx")]), []);
  assert.deepEqual(dead('<a href="/book/">Book</a>', [p("book.tsx")]), []);
});

test("ZERO FALSE ALARMS ON THE CORPUS THE MODEL COPIES — measured, not assumed", () => {
  // THE MEASUREMENT THAT DECIDES WHETHER THIS CHECK CAN EXIST. A rule that cries
  // wolf teaches the model away from an idiom that is perfectly correct, which
  // is strictly worse than the miss it prevents — the same bar `lintPages` had
  // to clear over its 328 pages.
  //
  // Driven through the REAL `validatePages`, one family at a time, exactly as if
  // the model had returned that family's pages. 500 route hrefs across 324
  // exemplar files, and this must stay at zero.
  const base = path.join(import.meta.dirname, "../builder/lovable/template/src/family-pages");
  const fams = fs.readdirSync(base).filter((n) => fs.statSync(path.join(base, n)).isDirectory());
  assert.ok(fams.length >= 90, "only " + fams.length + " families found — the scan stopped working");
  let hrefs = 0;
  const flagged = [];
  for (const fam of fams) {
    const d = path.join(base, fam);
    const files = fs.readdirSync(d).filter((n) => n.endsWith(".tsx"));
    const pages = files.map((n) => ({ path: n, source: fs.readFileSync(path.join(d, n), "utf8") }));
    for (const p of pages) hrefs += (p.source.match(/\bhref\s*=\s*["']\//g) || []).length;
    for (const x of validatePages({ pages }).problems) if (x.includes("not found")) flagged.push(fam + ": " + x);
  }
  assert.ok(hrefs >= 400, "only " + hrefs + " route hrefs in the corpus — this stopped being the dominant idiom, " +
    "so the zero below no longer means what it says");
  assert.deepEqual(flagged, [], "the dead-link check fires on the house style itself");
});

test("validatePages asks the SHARED route mapping, not a fifth private copy", () => {
  // This file kept its own, and the class of bug it produced has been found here
  // TWICE: `menu/index.tsx` derived as `/menu/index`, and `about.team.tsx` as
  // `/about.team` where TanStack routes it at `/about/team`. Both are shapes
  // `cleanPath`'s SAFE_PATH admits, so both are reachable output.
  //
  // The dot case got WORSE when the container and the published manifest were
  // corrected to the real mapping (2026-08-14): before that every reader agreed
  // on the wrong answer, and afterwards a `<Link to="/about/team">` that
  // `tsr generate` really accepts was the one this rewrote away.
  const src = fs.readFileSync(new URL("../builder/page-gen.mjs", import.meta.url), "utf8");
  assert.match(src, /import \{ routeOf \} from "\.\/site-addon\.mjs"/, "the shared mapping is not imported");
  assert.ok(!/const routeOf = \(path\) =>/.test(src), "a private copy of the mapping is back");

  // DRIVEN, both shapes, because an import that is never called reads the same.
  const p = (path, body) => ({ path, source:
    'import { createFileRoute, Link } from "@tanstack/react-router";\n' +
    'export const Route = createFileRoute("/x")({});\n' +
    "function P() { return <div>" + (body || "") + "</div>; }" });
  for (const [file, route] of [["about.team.tsx", "/about/team"], ["menu/index.tsx", "/menu"]]) {
    const out = validatePages({ pages: [p("index.tsx", '<Link to="' + route + '">go</Link>'), p(file)] });
    assert.deepEqual(out.problems, [], file + " -> " + route + " was called dangling");
    assert.match(out.pages[0].source, new RegExp('to="' + route + '"'),
      "a correct link to " + route + " was rewritten to the home page");
  }
});

test("A PARTIAL SET WITH NO KNOWN ROUTES DOES NOT JUDGE AN HREF EITHER", () => {
  // The exact failure `canJudge` was added for, one link idiom over. The edit
  // and addon lanes return only what the model WROTE, so every unchanged page
  // of the site reads as nonexistent — reproduced by the 2026-08-13 audit for
  // `to=`, where a one-page edit's correct `<Link to="/book">` was rewritten and
  // problems[] told the customer their live booking page did not exist.
  //
  // For an href it would be a false problem on EVERY cheap edit, since
  // PAGE_RULES teaches in-body links and the exemplars are full of them. A
  // genuinely dead href still cannot hide: the lanes compile the changed pages
  // together with the stored site.
  const one = { pages: [{ path: "manage.tsx", source:
    'import { createFileRoute } from "@tanstack/react-router";\n' +
    'export const Route = createFileRoute("/manage")({});\n' +
    'function P() { return <a href="/book">Book</a>; }' }] };
  const blind = validatePages(one, { partial: true });
  assert.deepEqual(blind.problems.filter((x) => x.includes("not found")), [],
    "a partial set with no knownRoutes judged an href on a guess — every cheap edit gains a false problem");

  // …and WITH the site's routes it judges properly, in both directions.
  assert.deepEqual(validatePages(one, { partial: true, knownRoutes: ["/", "/book"] })
    .problems.filter((x) => x.includes("not found")), []);
  assert.equal(validatePages(one, { partial: true, knownRoutes: ["/"] })
    .problems.filter((x) => x.includes("not found")).length, 1,
    "with the site's real routes in hand a genuinely dead href must still be reported");
});

test("the export-name rule states a count it can still count", async () => {
  // A STALE NUMBER IN THE HIGHEST-LEVERAGE PROMPT ON THE PLATFORM. Rule 3 said
  // "That holds for 2,026 of the 2,042 modules" as prose — written once, never
  // re-measured — directly above a DERIVED list of the exceptions. So the list
  // was correct and the sentence introducing it was two kit generations out of
  // date, in a document read by a model rather than by somebody who might notice.
  //
  // Both halves come from one expression now. This asserts they still agree with
  // the kit, which is the only thing that makes the sentence worth printing.
  const { UI_EXPORT_EXCEPTIONS } = await import("../builder/page-gen.mjs");
  const total = Object.keys(UI_EXPORTS).length;
  const m = PAGE_RULES.match(/That holds for ([\d,]+) of the ([\d,]+) modules/);
  assert.ok(m, "the export-name rule no longer states a count — rescope this");
  const [, deducible, stated] = m.map((x) => String(x).replace(/,/g, ""));
  assert.equal(Number(stated), total, "the prompt's module count disagrees with the kit");
  assert.equal(Number(deducible), total - UI_EXPORT_EXCEPTIONS.length,
    "the prompt's deducible count disagrees with the exceptions listed beside it");

  // THE EXCEPTIONS LIST IS THE OTHER HALF and must be the same set — a count that
  // agrees with a list nobody printed is a different lie. Every module named as
  // an exception must really not export its own PascalCase name, and every module
  // that does must be absent.
  assert.ok(UI_EXPORT_EXCEPTIONS.length > 0 && UI_EXPORT_EXCEPTIONS.length < total / 10,
    `${UI_EXPORT_EXCEPTIONS.length} exceptions — the derivation has stopped discriminating`);
  const named = new Set(UI_EXPORT_EXCEPTIONS.map(([mod]) => mod));
  for (const [mod, names] of Object.entries(UI_EXPORTS)) {
    const pascal = mod.replace(/(^|-)([a-z0-9])/g, (_, __, c) => c.toUpperCase());
    assert.equal(named.has(mod), !names.has(pascal), mod + " is on the wrong side of the exception list");
  }
  for (const [mod] of UI_EXPORT_EXCEPTIONS) {
    assert.ok(PAGE_RULES.includes(mod + " →"), mod + " is an exception the prompt never names");
  }
});

test("the digest says a table sends elsewhere, and stays silent when it does not", () => {
  const T = (webhooks) => ({ tables: [{ name: "bookings", access: "collect", columns: [{ name: "who", type: "text" }], ...(webhooks === undefined ? {} : { webhooks }) }] });

  // SILENT WHEN OFF, unlike `usePublicRows` which prints YES *and* NO. Nothing
  // on a page changes because a table emits, so a "WEBHOOKS: NO" on every table
  // of every site is cached prompt saying nothing anybody acts on.
  assert.doesNotMatch(schemaDigest(T(undefined)), /SENDS ELSEWHERE/,
    "a table with no webhooks must not be described as sending anywhere");
  assert.doesNotMatch(schemaDigest(T(null)), /SENDS ELSEWHERE/, "and neither must an explicit off");

  // THE POINT OF SAYING IT AT ALL: stop the model hand-rolling a notification
  // for something the platform already does after the write.
  const all = schemaDigest(T(true));
  assert.match(all, /SENDS ELSEWHERE/, "`true` must be stated");
  for (const a of ["created", "updated", "deleted"]) {
    assert.ok(all.includes(a), "`true` must name " + a);
  }
  assert.match(all, /do not build any notification/i, "and must say not to rebuild it");

  const one = schemaDigest(T(["created"]));
  assert.match(one, /SENDS ELSEWHERE: this table already posts .* on created\./,
    "a narrowed list must name only what it declared");
  assert.ok(!/updated/.test(one.split("SENDS ELSEWHERE")[1] || ""), "and must not claim events it does not emit");
});
