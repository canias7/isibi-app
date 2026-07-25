// worker-generate.test.mjs — the post-generation step of the LIVE builder in worker.js.
//
// Why this exists: on 2026-07-24 REACT_RULES became "**ROUTING IS GENERATED FOR YOU — never emit
// `src/App.tsx`, `src/routes.ts`, or a router**" and the container template moved to `src/main.tsx`.
// worker.js was not updated. It still demanded `src/main.jsx` AND `src/App.jsx` before continuing,
// and it never called the scaffolds that produce the router — so the model correctly emitted pages
// and nothing else, the check failed, and EVERY live build died with "the generated project came out
// incomplete — try again". Nothing caught it because worker.js had no test over this step.
//
// The two halves are asserted separately: what the RULES tell the model to emit, and what the worker
// then requires. A regression in either one breaks the builder, and the pair is the actual contract.
//
// Run: node builder/worker-generate.test.mjs

import { REACT_RULES } from "./react-gen.mjs";
import { scaffoldRouting, scaffoldTheme, scaffoldDbTypes, scaffoldAgentsMd } from "./scaffold.mjs";
import { pickStyleFamily, getStyleFamily } from "./design-system.mjs";

let failures = 0;
const check = (name, ok, detail = "") => {
  console.log(`  ${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
};

// What a model following REACT_RULES actually returns: pages and index.html. No router, no entry.
const modelOutput = () => ({
  "index.html": "<!doctype html><title>Salon</title>",
  "src/pages/Home.tsx": "export default function Home() { return <div>home</div> }",
  "src/pages/SignIn.tsx": "export default function SignIn() { return <div>in</div> }",
  "src/pages/Bookings.tsx": "export default function Bookings() { return <div>b</div> }",
  "isibi.schema.json": JSON.stringify({ tables: [{ name: "bookings", access: "user", columns: [{ name: "at", type: "text" }] }] }),
});

// The worker's post-generation step, transcribed from worker.js. Kept in one place so the assertions
// below are about the shipped logic and not about a paraphrase of it.
function postGenerate(files, plan = null) {
  if (!files["src/App.jsx"]) {
    files = scaffoldRouting(files).files;
    const famTokens = (getStyleFamily(pickStyleFamily((plan && plan.spec && plan.spec.design_hints) || {})) || {}).tokens;
    if (famTokens) files = scaffoldTheme(files, famTokens);
    files = scaffoldDbTypes(files);
    files = scaffoldAgentsMd(files, { name: (plan && plan.spec && plan.spec.name) || "" });
  }
  const legacyShell = Boolean(files["src/App.jsx"]);
  const complete = Boolean(files["index.html"]) && (legacyShell
    ? Boolean(files["src/main.jsx"])
    : Boolean(files["src/pages/Home.tsx"] && files["src/App.tsx"]));
  return { files, complete };
}

console.log("\nthe rules and the worker must agree on what the model emits");
{
  check("REACT_RULES forbids emitting a router", /never emit `src\/App\.tsx`/.test(REACT_RULES));
  check("and tells the model routing is generated for it", /ROUTING IS GENERATED FOR YOU/.test(REACT_RULES));
  // The old check demanded these two files. This is the assertion that would have caught the outage
  // on the day it shipped: the rules forbid the router, so requiring it can only ever fail.
  check("so nothing in the rules asks for src/App.jsx", !/emit .{0,20}src\/App\.jsx/.test(REACT_RULES));
  check("or for src/main.jsx", !/emit .{0,20}src\/main\.jsx/.test(REACT_RULES));
}

console.log("\nthe old check could not pass — this is the outage, reproduced");
{
  const files = modelOutput();
  const oldCheck = Boolean(files["index.html"] && files["src/main.jsx"] && files["src/App.jsx"]);
  check("a correct generation FAILED the old completeness check", oldCheck === false);
  check("because the model never emitted src/App.jsx", !files["src/App.jsx"]);
  check("nor src/main.jsx", !files["src/main.jsx"]);
}

console.log("\nthe worker now scaffolds what the model was told not to write");
{
  const { files, complete } = postGenerate(modelOutput());
  check("the build is accepted", complete === true);
  check("a router was generated", Boolean(files["src/App.tsx"]));
  check("and it routes every page the model wrote", /Bookings/.test(files["src/App.tsx"] || ""), Object.keys(files).join(" ").slice(0, 90));
  check("a route manifest came with it", Boolean(files["src/routes.ts"]));
  check("row types were generated from the schema", /bookings/i.test(files["src/lib/db-types.ts"] || ""));
  check("and AGENTS.md travels with the app", Boolean(files["AGENTS.md"]));
}

console.log("\nthe multi-agent shell (flag-gated, older .jsx shape) still passes");
{
  // Scaffolding over this would replace a real router with an empty one — it emits no .tsx pages, so
  // scaffoldRouting would produce a router with nothing in it and the app would render blank.
  const legacy = {
    "index.html": "<!doctype html>",
    "src/main.jsx": "createRoot(...)",
    "src/App.jsx": "<Routes><Route path='/' element={<Home/>}/></Routes>",
    "src/pages/Home.jsx": "export default function Home(){return null}",
  };
  const { files, complete } = postGenerate(legacy);
  check("it is accepted", complete === true);
  check("and its own router was left alone", files["src/App.jsx"] === legacy["src/App.jsx"]);
  check("no empty .tsx router was scaffolded over it", !files["src/App.tsx"]);
}

console.log("\na genuinely incomplete generation is still rejected");
{
  check("no pages at all", postGenerate({ "index.html": "<!doctype html>" }).complete === false);
  check("pages but no index.html", postGenerate({ "src/pages/Home.tsx": "x" }).complete === false);
  // A feature page with no landing page is the one shape that looks plausible and is not: the router
  // would have no "/" route, so the site opens on a blank screen.
  check("a feature page but no Home", postGenerate({ "index.html": "<!doctype html>", "src/pages/Bookings.tsx": "x" }).complete === false);
}

console.log("\na matched starter seeds a working app before the model is called");
{
  const { matchStarter, getStarter, starterFiles } = await import("./starters.mjs");
  const match = matchStarter("A barbershop where customers book a cut with a specific barber");
  check("the brief matched a starter", Boolean(match), match ? match.id : "none");
  const seed = starterFiles(match.id);
  check("it seeds real pages for $0", Object.keys(seed).filter((f) => /^src\/pages\//.test(f)).length > 0);
  check("including a schema", Boolean(seed["isibi.schema.json"]));

  // The merge order is the whole point: the model's edit wins on the files it rewrote, and every
  // page it never mentioned survives. Getting this backwards would throw away the free app.
  const edit = { "index.html": "<!doctype html><title>Marco's</title>", "src/pages/Home.tsx": "export default function Home(){return <div>Marco's</div>}" };
  const merged = { ...seed, ...edit };
  check("the model's Home replaced the starter's", /Marco/.test(merged["src/pages/Home.tsx"]));
  const untouched = Object.keys(seed).filter((f) => /^src\/pages\//.test(f) && f !== "src/pages/Home.tsx");
  check("and the pages it did not mention survived", untouched.every((f) => merged[f] === seed[f]), `${untouched.length} page(s)`);

  const { files, complete } = postGenerate(merged);
  check("the merged app is accepted", complete === true);
  check("and every starter page is routed", untouched.every((f) => {
    const name = f.replace("src/pages/", "").replace(".tsx", "");
    return (files["src/App.tsx"] || "").includes(name);
  }), untouched.join(" "));

  const navOrder = (getStarter(match.id) || {}).navOrder || [];
  check("the starter declares a nav order", navOrder.length > 0, navOrder.join(" > "));
}

console.log("\nthe transcription above still matches the shipped worker");
{
  // A test that paraphrases the code it guards is a test that passes while the product breaks —
  // which is precisely how the original outage survived. These assertions pin the transcription to
  // worker.js, so the two cannot drift apart silently.
  const fs = await import("node:fs");
  const path = await import("node:path");
  const url = await import("node:url");
  const root = path.dirname(path.dirname(url.fileURLToPath(import.meta.url)));
  const worker = fs.readFileSync(path.join(root, "worker.js"), "utf8");
  check("worker.js scaffolds the router after generation", /files = scaffoldRouting\(files[,)]/.test(worker));
  check("and generates the row types", /files = scaffoldDbTypes\(files\)/.test(worker));
  check("guarded on the legacy shell, so multi-agent is not clobbered", /if \(!files\["src\/App\.jsx"\]\) \{/.test(worker));
  check("the completeness check accepts the generated router", /files\["src\/pages\/Home\.tsx"\] && files\["src\/App\.tsx"\]/.test(worker));
  check("and no longer demands a router the rules forbid", !/!files\["src\/main\.jsx"\] \|\| !files\["src\/App\.jsx"\]/.test(worker));
  check("the scaffolds are actually imported", /import \{ scaffoldRouting, scaffoldTheme, scaffoldDbTypes, scaffoldAgentsMd \}/.test(worker));

  // The three pieces that were harness-only until now. Each one is a single call the worker either
  // makes or does not, and each fails invisibly: no starter just means a worse app, no schema step
  // just means the old safety-net patch, wrong merge order just means the free app is discarded.
  check("the worker matches a starter", /const match = matchStarter\(brief\)/.test(worker));
  check("and seeds its files", /seedFiles = starterFiles\(starterId\)/.test(worker));
  check("merging the model's edit OVER the starter, not under it", /files = \{ \.\.\.seedFiles, \.\.\.files \}/.test(worker));
  check("an adapt step uses the revise rules, not a full rebuild", /starterId \? REACT_REVISE_RULES : REACT_RULES/.test(worker));
  check("the schema is decided before generation", /SCHEMA_FIRST_RULES/.test(worker));
  check("and handed to the generation prompt", /THE DATABASE, ALREADY DECIDED/.test(worker));
  check("the plan is computed for every build, not just under the flag", /try \{ plan = planApp\(brief\); \}/.test(worker));
  check("a starter's nav order reaches the router", /navOrder\.length \? \{ navOrder \}/.test(worker));
}

console.log(failures ? `\n${failures} FAILED\n` : "\nall worker generate-step checks pass\n");
process.exit(failures ? 1 : 0);
