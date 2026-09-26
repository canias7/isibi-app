// WHICH KIT COMPONENTS HEAD A SECTION, AND THE COPY THAT MUST NOT DRIFT.
//
// `builder/kit-headings.mjs` is DERIVED from the kit's own source — the prop
// each component always shows whole in a visible <h1>/<h2> — and the text
// guard (`page-prose.mjs`) names a section by it (2026-09-26, owner: "Resolve
// visible section headings from established kit-component behavior … Do not
// treat every arbitrary title prop as a heading"). A derivation is a copy, so
// this re-runs it and compares; `component-api.test.mjs` is the precedent.
//
// WHAT WOULD GO WRONG WITHOUT IT: somebody changes SectionHeader to show its
// title in a <p>, and the guard keeps letting a request name a section by
// words the visitor no longer sees as its heading — authority from a stale copy.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build, render, examine, UI_DIR } from "../builder/gen-kit-headings.mjs";
import { KIT_HEADINGS } from "../builder/kit-headings.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));

test("the committed table is what the generator reads off the kit today", () => {
  const committed = fs.readFileSync(path.join(here, "../builder/kit-headings.mjs"), "utf8");
  assert.equal(render(build()), committed, "builder/kit-headings.mjs is stale — run `node builder/gen-kit-headings.mjs`");
});

test("the scan covered the kit, and the table holds the headings the corpus uses", () => {
  // THE OBSERVER IS ALIVE: a scan over nothing would answer an empty table and
  // the comparison above would pass on it.
  const files = fs.readdirSync(UI_DIR).filter((f) => f.endsWith(".tsx"));
  assert.ok(files.length >= 2000, "the kit directory read as " + files.length + " files");
  const rows = Object.entries(KIT_HEADINGS).flatMap(([m, t]) => Object.entries(t).map(([c, h]) => m + ":" + c + "." + h.prop + "=" + h.tag));
  assert.ok(rows.length >= 15, "the table has shrunk to " + rows.length + " rows — re-derive it");
  for (const want of ["section-header:SectionHeader.title=h2", "page-header:PageHeader.title=h1", "cta-band:CtaBand.title=h2", "hero:Hero.title=h1"]) {
    assert.ok(rows.includes(want), "missing " + want);
  }
  for (const h of Object.values(KIT_HEADINGS).flatMap((t) => Object.values(t))) assert.match(h.tag, /^h[12]$/);
});

test("what the kit's own source says each excluded component does", () => {
  const why = (file, component) => {
    const found = examine(fs.readFileSync(path.join(UI_DIR, file), "utf8"), file).filter((r) => r.component === component);
    assert.ok(found.length, component + " shows a prop as a heading — the reason below is about it");
    return found.flatMap((r) => r.why).join("; ");
  };
  assert.match(why("dish-card.tsx", "DishCard"), /an h3 heads a card/);
  assert.match(why("story-lead.tsx", "StoryLead"), /reached through a VariableDeclaration/);
  assert.match(why("counter-services.tsx", "CounterServices"), /can return without it \(2 returns\)/);
  assert.match(why("welcome-card.tsx", "WelcomeCard"), /inside <CardContent>/);
  assert.match(why("house-rules.tsx", "HouseRules"), /shown only when rules\.length > 0/);
  // A `title` shown in no heading at all is not even a candidate.
  assert.deepEqual(examine(fs.readFileSync(path.join(UI_DIR, "callout.tsx"), "utf8")), []);
});

test("the rule, clause by clause, on components written for it", () => {
  const one = (src) => examine("export function X(" + src);
  const ok = (src) => { const r = one(src); assert.equal(r.length, 1, src); assert.deepEqual(r[0].why, [], src); return r[0]; };
  const no = (src, reason) => { const r = one(src); assert.equal(r.length, 1, src); assert.match(r[0].why.join("; "), reason, src); };
  assert.deepEqual(ok('{ title }: { title: string }) { return <div className="p-4"><h2>{title}</h2></div>; }'), { component: "X", prop: "title", tag: "h2", why: [] });
  assert.equal(ok("{ heading: label }: { heading: string }) { return <><h1>{label}</h1></>; }").prop, "heading", "the PROP, not the local name");
  ok("{ title, sub }: any) { return <div>{title && <h2>{title}</h2>}{sub}</div>; }");
  ok("{ title, actions }: any) { return <div>{(title || actions) && <header>{title && <h2>{title}</h2>}</header>}</div>; }");
  ok("{ title }: any) { const x = 1; return (<section><h2>{title}</h2></section>); }");
  no("{ title }: any) { return <h3>{title}</h3>; }", /an h3 heads a card/);
  no("{ title, show }: any) { return <div>{show && <h2>{title}</h2>}</div>; }", /shown only when show/);
  no("{ title, open }: any) { return <div>{open ? <h2>{title}</h2> : null}</div>; }", /shown only when open/);
  no("{ title }: any) { return <Wrap><h2>{title}</h2></Wrap>; }", /inside <Wrap>/);
  no("{ title, items }: any) { if (!items.length) return null; return <h2>{title}</h2>; }", /2 returns/);
  no("{ title }: any) { if (title) { return <h2>{title}</h2>; } }", /returned from inside a block/);
  no("{ title }: any) { const body = <h2>{title}</h2>; return <div>{body}</div>; }", /reached through a VariableDeclaration/);
  no('{ title }: any) { return <h2 className="sr-only">{title}</h2>; }', /hidden by class/);
  no('{ title }: any) { return <div className="hidden sm:block"><h2>{title}</h2></div>; }', /hidden by class/);
  no("{ title }: any) { return <div hidden><h2>{title}</h2></div>; }", /hidden by hidden/);
  no("{ title, ...rest }: any) { return <div {...rest}><h2>{title}</h2></div>; }", /hidden by spread/);
  ok('{ title }: any) { return <div className="overflow-hidden"><h2>{title}</h2></div>; }');
  const two = one("{ title, sub }: any) { return <div><h1>{title}</h1><h2>{sub}</h2></div>; }");
  assert.deepEqual(two.map((r) => [r.prop, r.why]), [["title", ["two of its props are headings"]], ["sub", ["two of its props are headings"]]], "which one heads the section would be a guess");
  // NOT A CANDIDATE AT ALL: the heading shows something other than the prop, whole.
  assert.deepEqual(one("{ title }: any) { return <h2>{title.toUpperCase()}</h2>; }"), []);
  assert.deepEqual(one("{ title }: any) { return <h2>Our {title}</h2>; }"), []);
  assert.deepEqual(examine("export default function X({ title }: any) { return <h2>{title}</h2>; }"), [], "a default export is not imported by name");
  assert.deepEqual(examine("function X({ title }: any) { return <h2>{title}</h2>; }"), [], "not exported");
});

test("the table ships with the text guard: the image copies it beside page-prose", () => {
  const docker = fs.readFileSync(path.join(here, "../Dockerfile"), "utf8");
  const line = docker.split("\n").find((l) => l.includes("builder/page-prose.mjs") && l.startsWith("COPY "));
  assert.ok(line, "the Dockerfile's worker COPY line carries page-prose.mjs");
  assert.ok(line.split(/\s+/).includes("builder/kit-headings.mjs"), "…and the table it imports");
  assert.ok(!docker.includes("gen-kit-headings"), "the generator is a development tool and never shipped");
});
