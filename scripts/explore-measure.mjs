#!/usr/bin/env node
// THE FREE OFFLINE MEASURE (owner, 2026-10-26, "option b"): one step run with
// supplied model answers through the explore loop, against the same step sent
// with the site-map slice it used to carry. No model is called and nothing is
// spent; characters are counted and tokens estimated at characters / 4.
//
//   node scripts/explore-measure.mjs [site.json]
//
// `site.json` (optional): { "pages": [{path, source}], "parts": [{name, source}] },
// e.g. a site's stored `source/<slug>/pages.json` and `parts.json` joined.
// Without one, the Band-parts page of the "move the reviews" case is used.
import { readFileSync } from "node:fs";
import { siteFiles, measureExplore } from "../builder/site-explore.mjs";
import { tweakRequest } from "../builder/site-tweak.mjs";
import { buildSiteMap, siteSlice, withMapNote } from "../builder/site-map.mjs";

const arg = process.argv[2];
const site = arg ? JSON.parse(readFileSync(arg, "utf8")) : {
  pages: [{ path: "index.tsx", source: 'import Band1Hero from "@/routes/-parts/band-1-hero";\nimport Band2Lessons from "@/routes/-parts/band-2-lessons";\nimport Band3Split from "@/routes/-parts/band-3-split";\nfunction Home() {\n  return (\n    <main>\n      <Band1Hero />\n      <Band2Lessons />\n      <Band3Split />\n    </main>\n  );\n}\n' }],
  parts: [
    { name: "band-1-hero", source: "export default function Band1Hero() { return <section><h1>Driftwood</h1></section>; }" },
    { name: "band-2-lessons", source: "export default function Band2Lessons() { return <section><h2>Surf lessons</h2></section>; }" },
    { name: "band-3-split", source: "export default function Band3Split() { return <section><h2>Reviews</h2></section>; }" },
  ],
};
const page = site.pages[0];
const req = tweakRequest({ instruction: "Move the reviews section above the lessons section.", path: page.path, source: page.source });
const use = (name, input) => ({ type: "tool_use", id: name + Math.random(), name, input });
const answer = { content: [use("write_tweak", { edits: [] })], usage: {} };

const scenarios = {
  "answers at once (0 looks)": [answer],
  "one search, then answers": [{ content: [use("search", { pattern: "reviews" })] }, answer],
  "search + read, then answers": [{ content: [use("search", { pattern: "reviews" })] }, { content: [use("read_file", { path: page.path })] }, answer],
  "spends all 6 looks": [...Array.from({ length: 6 }, () => ({ content: [use("list_files", {})] })), answer],
};
const ctx = { files: siteFiles(site), tables: [] }; // as production: the database tools are offered to every exploring step
const mapped = JSON.stringify(withMapNote(req, siteSlice(buildSiteMap({ pages: site.pages, parts: site.parts }), "site"))).length;
console.log("with the map (one call):".padEnd(34), String(mapped).padStart(8), "chars ≈", Math.round(mapped / 4), "tokens");
for (const [name, answers] of Object.entries(scenarios)) {
  const m = await measureExplore({ req, ctx, answers });
  console.log((name + ":").padEnd(34), String(m.chars).padStart(8), "chars ≈", String(m.approxTokens).padStart(6), "tokens over", m.rounds, "round(s),", m.looks, "look(s)");
}
