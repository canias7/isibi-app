// full-pipeline.test.mjs — drives the SHIPPING pipeline with a stub model, so the order and the
// wiring are verified without an API key and without spending anything.
//
// The pipeline had no test. It was written when generation came first and the schema was patched in
// afterwards, and the reorder that puts the schema BEFORE any page is written is exactly the kind of
// change a trace assertion catches and a reading does not: every stage still runs, the app still
// builds, and the only observable difference is which prompt saw the tables.
//
// Run: node builder/full-pipeline.test.mjs

import { runFullPipeline } from "./full-pipeline.mjs";

let failures = 0;
const check = (name, ok, detail = "") => {
  console.log(`  ${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
};

const SCHEMA = JSON.stringify({
  tables: [
    { name: "bookings", access: "user", columns: [{ name: "customer_name", type: "text" }, { name: "status", type: "text", enum: ["pending", "confirmed"] }] },
    { name: "services", access: "display", columns: [{ name: "title", type: "text" }, { name: "price", type: "real" }] },
  ],
});

// Records every call so the ORDER can be asserted, and answers each stage plausibly.
function stub({ schemaText = SCHEMA } = {}) {
  const calls = [];
  const generate = async (system, user, maxTokens) => {
    calls.push({ system, user, maxTokens });
    if (/designing the DATABASE/.test(system)) {
      return { text: schemaText ? `===FILE: isibi.schema.json===\n${schemaText}\n` : "", usedOut: 300 };
    }
    if (/FORGOT to declare/.test(system)) {
      return { text: `===FILE: isibi.schema.json===\n${SCHEMA}\n`, usedOut: 300 };
    }
    if (/Build the OPENING/.test(user)) {
      return {
        text: "===FILE: index.html===\n<!doctype html><title>x</title>\n\n" +
          "===FILE: src/pages/Home.tsx===\nexport default function Home(){return null}\n\n" +
          "===FILE: src/pages/SignIn.tsx===\nexport default function SignIn(){return null}\n",
        usedOut: 500,
      };
    }
    return { text: "===FILE: src/pages/Bookings.tsx===\nexport default function Bookings(){return null}\n", usedOut: 200 };
  };
  return { calls, generate, build: async () => ({ ok: true, files: { "index.html": { t: "<html>" } } }) };
}

const BRIEF = "A barbershop where customers book a cut with a specific barber";
// This brief matches the booking STARTER, which ships its own schema and so skips the stage under
// test. `starter: false` forces the from-scratch path — the one the reorder is about.
const SCRATCH = { starter: false };
const stageNames = (r) => r.trace.map((s) => s.stage);

console.log("\nthe schema is decided BEFORE any page is written");
{
  const m = stub();
  const r = await runFullPipeline(BRIEF, 60000, m, SCRATCH);
  check("the build succeeded", r.ok === true, r.error ? String(r.error).slice(0, 60) : "");

  const stages = stageNames(r);
  const schemaAt = stages.indexOf("schema");
  const firstGenAt = stages.findIndex((s) => s.startsWith("generate:"));
  check("a schema stage ran", schemaAt !== -1, stages.join(" "));
  check("and it ran before the first generation step", schemaAt !== -1 && schemaAt < firstGenAt, `schema@${schemaAt} gen@${firstGenAt}`);

  // The order only matters if it changes what the page steps SEE. This is the assertion that would
  // fail if the schema were still being patched in afterwards.
  const schemaCall = m.calls.findIndex((c) => /designing the DATABASE/.test(c.system));
  const shellCall = m.calls.findIndex((c) => /Build the OPENING/.test(c.user));
  const pageCall = m.calls.findIndex((c) => /ADD /.test(c.user));
  check("the model designed the schema in its first call", schemaCall === 0, `index ${schemaCall}`);
  check("the shell step is told the database is already decided", /THE DATABASE IS ALREADY DECIDED/.test(m.calls[shellCall]?.user || ""));
  check("the shell step is NOT asked to emit a schema", !/isibi\.schema\.json` if the app needs/.test(m.calls[shellCall]?.user || ""));
  check("a page step is handed the real table names", pageCall !== -1 && /bookings/.test(m.calls[pageCall]?.user || ""));
  check("and the exact column names it must use", pageCall !== -1 && /customer_name/.test(m.calls[pageCall]?.user || ""));
}

console.log("\nthe row types exist before the pages, not after");
{
  const m = stub();
  const r = await runFullPipeline(BRIEF, 60000, m, SCRATCH);
  const types = r.files["src/lib/db-types.ts"] || "";
  check("db-types.ts was generated", Boolean(types));
  check("it carries the declared tables", /bookings/.test(types) && /services/.test(types), types.slice(0, 60));
  // An enum column becomes a literal union, which is the payoff: a page cannot write a status the
  // database will not accept, and it is caught at compile time rather than on the live site.
  check("an enum column became a literal union", /"pending"\s*\|\s*"confirmed"|'pending'\s*\|\s*'confirmed'/.test(types));
}

console.log("\nthe schema-fix repair is now the fallback, not the normal path");
{
  const m = stub();
  const r = await runFullPipeline(BRIEF, 60000, m, SCRATCH);
  const fix = r.trace.find((s) => s.stage === "schema-fix");
  check("schema-fix did not need to run", Boolean(fix?.skipped), fix?.skipped || "IT RAN");
  check("and the trace says why", /decided before the pages/.test(fix?.skipped || ""));
  check("no repair call was made", !m.calls.some((c) => /FORGOT to declare/.test(c.system)));
}

console.log("\nbut it still catches a schema stage that comes back empty");
{
  // A truncated or refused schema stage must not ship an app that calls a database it never
  // declared. The old repair path is what stops that, so it has to remain reachable.
  const m = stub({ schemaText: "" });
  const r = await runFullPipeline(BRIEF, 60000, m, SCRATCH);
  check("the empty result was recorded, not silently ignored", r.trace.some((s) => s.stage === "schema:empty"));
  check("the repair ran instead", m.calls.some((c) => /FORGOT to declare/.test(c.system)));
  check("and the app still ends up with a schema", Boolean(r.files["isibi.schema.json"]));
  check("with row types regenerated from it", /bookings/.test(r.files["src/lib/db-types.ts"] || ""));
}

console.log("\na starter already ships a schema, so nothing is spent deciding one");
{
  const m = stub();
  const r = await runFullPipeline("An online store selling coffee with a cart and checkout", 60000, m, { starter: "commerce" });
  const stage = r.trace.find((s) => s.stage === "schema");
  check("the schema stage was skipped", Boolean(stage?.skipped), stage?.skipped || "IT RAN");
  check("and it says which starter supplied it", /starter/.test(stage?.skipped || ""));
  check("no schema call was made", !m.calls.some((c) => /designing the DATABASE/.test(c.system)));
  check("the app still has the starter's schema", Boolean(r.files["isibi.schema.json"]));
}

console.log("\nthe cap still holds with a stage added in front of generation");
{
  const m = stub();
  const r = await runFullPipeline(BRIEF, 6000, m, { ...SCRATCH });
  check("spend stayed within the cap", r.spent <= r.cap, `${r.spent} / ${r.cap}`);
  check("the ledger reports it", r.withinCap === true);
}

console.log(failures ? `\n${failures} FAILED\n` : "\nall full-pipeline checks pass\n");
process.exit(failures ? 1 : 0);
