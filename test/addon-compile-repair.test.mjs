// AN ADD-ON THAT DID NOT COMPILE GETS ITS IMPORTS NORMALISED AND ONE REPAIR
// ROUND (2026-10-23, live on `saltmarsh-and-sparrow`).
//
// The page writer emitted `import … from "/components/ui/section-header"`
// (no `@`), vite refused the bundle, `repairImports` matched `@/` only, and the
// add step's model repair round runs only after a SUCCESSFUL compile — so the
// route gave up. Two halves, each driven here: the deterministic rewrite of a
// misspelt alias whose target exists, and one bounded model round fed the
// compiler's message, then one more compile, through the real route.
import test from "node:test";
import assert from "node:assert/strict";
import { repairImports, aliasFor } from "../builder/page-gen.mjs";
import { pagesForError, compileRepairRound, MAX_FILES } from "../builder/compile-repair.mjs";
import { addon, writtenPage, storedPage, addedTo } from "./fixtures/addon-route.mjs";

const page = (source) => [{ path: "gallery.tsx", source }];

test("a leading-slash kit import is made @/ when the module exists", () => {
  const r = repairImports(page('import { SectionHeader } from "/components/ui/section-header";\n'));
  assert.equal(r.pages[0].source, 'import { SectionHeader } from "@/components/ui/section-header";\n');
  assert.equal(r.fixed.length, 1);
  assert.equal(r.fixed[0].from, "/components/ui/section-header");
});

test("other misspellings of the alias are normalised too, and only when the file exists", () => {
  for (const spec of ["components/ui/section-header", "~/components/ui/section-header", "@components/ui/section-header",
    "/src/components/ui/section-header", "src/components/ui/section-header", "../components/ui/section-header", "/app/src/components/ui/section-header.tsx"]) {
    assert.equal(aliasFor(spec, new Set()), "@/components/ui/section-header", spec);
  }
  // NO GUESSING: a module the kit does not have stays as written.
  assert.equal(aliasFor("/components/ui/no-such-module-zz", new Set()), null);
  const kept = repairImports(page('import { X } from "/components/ui/no-such-module-zz";\n'));
  assert.equal(kept.pages[0].source, 'import { X } from "/components/ui/no-such-module-zz";\n');
  assert.equal(kept.fixed.length, 0);
  // A correct spelling, a package and a relative file are left alone.
  assert.equal(aliasFor("@/components/ui/section-header", new Set()), null);
  assert.equal(aliasFor("react", new Set()), null);
  assert.equal(aliasFor("./local", new Set()), null);
});

test("the site's own components: rewritten only when that component exists", () => {
  const src = 'import { Band } from "/routes/-parts/band";\nimport { Ghost } from "/routes/-parts/ghost";\nimport { Near } from "./-parts/band";\n';
  const r = repairImports(page(src), { parts: [{ name: "band", source: "x" }] });
  assert.equal(r.pages[0].source,
    'import { Band } from "@/routes/-parts/band";\nimport { Ghost } from "/routes/-parts/ghost";\nimport { Near } from "./-parts/band";\n');
  // AND THE PART LIST IS WHAT DECIDES IT: none given, nothing rewritten.
  assert.equal(repairImports(page(src)).pages[0].source, src);
});

test("the repair round picks the pages the error names, among those this change wrote, at most a few", () => {
  const pages = [{ path: "a.tsx", source: "a" }, { path: "b.tsx", source: "b" }, { path: "index.tsx", source: "i" }];
  assert.deepEqual(pagesForError("error in src/routes/b.tsx: cannot resolve", pages, ["a.tsx", "b.tsx"]).map((p) => p.path), ["b.tsx"]);
  assert.deepEqual(pagesForError("unknown", pages, ["a.tsx", "b.tsx"]).map((p) => p.path), ["a.tsx", "b.tsx"]);
  // EVERY FILE THE BUILD OWNS (2026-10-24, owner: "the repair has to be everywhere"):
  // a page this change did not write is offered when the error names it.
  assert.deepEqual(pagesForError("index.tsx broke", pages, ["a.tsx"]).map((p) => p.path), ["index.tsx"]);

  const many = Array.from({ length: 9 }, (_, i) => ({ path: "p" + i + ".tsx", source: "x" }));
  assert.equal(pagesForError("", many, many.map((p) => p.path)).length, MAX_FILES);
});

test("the round does not run without the clock's room or a message, and never compiles then", async () => {
  let compiled = 0;
  const compile = async () => { compiled++; return { ok: true, files: {} }; };
  const send = async () => { throw new Error("must not be called"); };
  const pages = [{ path: "a.tsx", source: "a" }];
  assert.equal((await compileRepairRound({ error: "x", pages, touched: ["a.tsx"], send, compile, room: false })).why, "time");
  assert.equal((await compileRepairRound({ error: "", pages, touched: ["a.tsx"], send, compile })).why, "no-error");
  assert.equal(compiled, 0);
});

// ── THROUGH THE REAL ROUTE ───────────────────────────────────────────────────
const BROKEN = (() => {
  const w = writtenPage("/gallery");
  return { ...w, source: 'import { Thing } from "@/components/ui/no-such-module-zz";\n' + w.source };
})();
const FIXED = writtenPage("/gallery").source;

const run = (slug, extra) => addon(slug, "add a gallery page", {
  kinds: ["page"], publishes: true, credits: 400,
  storedPages: [storedPage("/")],
  written: [BROKEN, addedTo("/", '<p>Also see the <a href="/gallery">gallery</a>.</p>')],
  answers: { page: { page: [{ path: "/gallery", name: "Gallery", purpose: "show our work",
    sections: ["a grid of photographs"], components: ["card"] }] },
    // THE WRITER'S CORRECTION, as the tweak tool answers it.
    source: { source: FIXED } },
  compileError: "Could not resolve \"@/components/ui/no-such-module-zz\" from \"src/routes/gallery.tsx\"",
  ...extra,
});

const gallerySources = (r) => r.compiles.map((c) => {
  const files = (c.body && c.body.files) || {};
  const k = Object.keys(files).find((x) => /gallery\.tsx$/.test(x));
  return k ? files[k] : null;
});

test("a compile that failed on the code is repaired once and the addition publishes", async () => {
  const r = await run("fw-crepair-ok", { compileFailFirst: 1 });
  assert.equal(r.body && r.body.ok, true, JSON.stringify(r.body));
  assert.equal(r.compiles.length, 2, "not one failed compile and one repaired compile");
  const [first, second] = gallerySources(r);
  assert.ok(first && first.includes("no-such-module-zz"), "the first compile was not the writer's page");
  assert.ok(second && !second.includes("no-such-module-zz"), "the second compile did not carry the correction");
  // THE WRITER WAS TOLD WHAT THE COMPILER SAID.
  const asked = r.prompts.map((p) => JSON.stringify(p)).find((t) => t.includes("WHY THE PAGE DID NOT COMPILE"));
  assert.ok(asked, "no repair request was sent");
  assert.ok(asked.includes("no-such-module-zz"), "the compiler's message did not reach the writer");
});

test("a repair that still does not compile is reported as before, after at most two more compiles", async () => {
  const r = await run("fw-crepair-fail", { compileFail: true });
  assert.equal(r.body && r.body.ok, false, JSON.stringify(r.body));
  assert.equal(r.body.error, "compile");
  // ROUND TWO IS ASKED (2026-10-23, up to two rounds) and answers the same page, which is refused as no change, so nothing more compiles.
  assert.equal(r.compiles.length, 2, "the rounds are bounded");
  // A FAILED ADDITION COSTS NOTHING: the round that did not fix it is not charged.
  assert.deepEqual(r.charges, []);
});

// ── THE DATABASE WAITS FOR A COMPILE THAT PASSED (item 2) ────────────────────
//
// The provision ran beside the page writer and nothing undid it when the pages
// then failed to compile: `saltmarsh-and-sparrow` kept an orphan Neon project.
// Undoing one touches four stores on a live site, so the provision now waits
// for the seam — after a successful compile, right before the schema's apply.
const TABLE = { table: [{ table: { name: "repairs", columns: [{ name: "who", type: "text" }] } }] };
const withTable = (slug, extra) => addon(slug, "keep a list of repairs and show it", {
  backend: "none", provisions: true, kinds: ["table", "page"], publishes: true, credits: 400,
  storedPages: [storedPage("/")],
  written: [writtenPage("/repairs")],
  answers: { table: TABLE, page: { page: [{ path: "/repairs", name: "Repairs", purpose: "list repairs", sections: ["the list"], components: ["card"] }] } },
  ...extra,
});

test("an addition whose pages did not compile makes no database, and says nothing was changed", async () => {
  const r = await withTable("fw-noorphan", { compileFail: true });
  assert.equal(r.body && r.body.error, "compile", JSON.stringify(r.body).slice(0, 300));
  assert.equal(r.neonCalls.length, 0, "a database was made for pages that never compiled: " + JSON.stringify(r.neonCalls));
  assert.equal(r.body.outcome && r.body.outcome.provisioned, undefined);
  assert.equal(r.body.outcome && r.body.outcome.database, "none");
});

test("an addition whose pages compiled makes its database, and then applies its table", async () => {
  const r = await withTable("fw-provafter", {});
  assert.equal(r.body && r.body.ok, true, JSON.stringify(r.body).slice(0, 300));
  assert.ok(r.neonCalls.length > 0, "the database was never made");
  assert.ok(r.sql.some((q) => /CREATE TABLE IF NOT EXISTS "repairs"/i.test(q)), "the table was never applied");
});
