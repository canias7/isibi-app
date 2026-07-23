// Per-project memory tests — pure extraction + injection, $0.
import { makeTally } from "./harness.mjs";
import { buildProjectMemory, mergeProjectMemory, recordDecision, addDontTouch, addPreference, memoryToPromptLine, extractRoutes, extractTables, extractComponents, extractTokens } from "../../builder/project-memory.mjs";

const t = makeTally("Project memory");

const files = {
  "index.html": '<!doctype html><html><head><title>Glow Salon</title><link href="https://fonts.googleapis.com/css2?family=Space+Grotesk&family=Inter"></head><body><div id="root"></div></body></html>',
  "src/App.jsx": "import { Routes, Route } from 'react-router-dom'\nexport default function App(){return <Routes><Route path='/' element={<Home/>}/><Route path='/pricing' element={<Pricing/>}/><Route path='/booking' element={<Booking/>}/></Routes>}",
  "src/index.css": "@tailwind base;@tailwind components;@tailwind utilities;",
  "tailwind.config.js": "export default { theme: { extend: { colors: { ink: '#08070c', accent: '#ff79c6' }, fontFamily: { display: ['Space Grotesk','sans-serif'], body: ['Inter','sans-serif'] } } } }",
  "src/components/Nav.jsx": "export default function Nav(){return null}",
  "src/pages/Home.jsx": "export default function Home(){return null}",
  "src/pages/Pricing.jsx": "export default function Pricing(){return null}",
  "src/pages/Booking.jsx": "export default function Booking(){return null}",
  "isibi.schema.json": '{"tables":[{"name":"appointments","access":"user","columns":[{"name":"service_id","type":"text"},{"name":"starts_at","type":"text"},{"name":"status","type":"text"}]},{"name":"services","access":"display","columns":[{"name":"title","type":"text"},{"name":"price","type":"integer"}]}]}',
};

// --- extractors ---
t.ok(extractRoutes(files).join(",") === "/,/pricing,/booking", "routes from App.jsx");
const tables = extractTables(files);
t.eq(tables.length, 2, "two tables from schema");
t.ok(tables[0].name === "appointments" && tables[0].columns.includes("starts_at"), "table name + columns");
t.ok(extractComponents(files).includes("Nav") && extractComponents(files).includes("Pricing"), "components from components/ + pages/");
const tok = extractTokens(files);
t.ok(tok.colors.includes("#08070c") && tok.colors.includes("#ff79c6"), "palette from tailwind config");
t.ok(tok.fonts.includes("Space Grotesk") && tok.fonts.includes("Inter"), "fonts from config + google link");

// --- buildProjectMemory assembles everything + carries accumulated context ---
let mem = buildProjectMemory(files, { decisions: ["dark studio theme"], dontTouch: ["appointments field names"] });
t.eq(mem.name, "Glow Salon", "name from <title>");
t.ok(mem.routes.length === 3 && mem.tables.length === 2, "structure captured");
t.ok(mem.decisions.includes("dark studio theme"), "accumulated decisions carried");

// --- accumulators are immutable + dedupe ---
mem = recordDecision(mem, "pink → amber accents");
mem = recordDecision(mem, "dark studio theme"); // dup
mem = addDontTouch(mem, "the booking flow");
mem = addPreference(mem, "keep copy terse");
t.eq(mem.decisions.length, 2, "decisions deduped");
t.ok(mem.dontTouch.includes("the booking flow") && mem.preferences.includes("keep copy terse"), "dont-touch + prefs recorded");

// --- merge refreshes structure but keeps accumulated context ---
const files2 = { ...files, "src/App.jsx": files["src/App.jsx"].replace("/booking", "/book-now") };
const merged = mergeProjectMemory(mem, files2);
t.ok(merged.routes.includes("/book-now") && !merged.routes.includes("/booking"), "routes refreshed from new files");
t.ok(merged.decisions.includes("pink → amber accents"), "…decisions preserved across merge");
t.ok(merged.dontTouch.includes("the booking flow"), "…dont-touch preserved across merge");

// --- memoryToPromptLine is a compact, bounded, informative block ---
const line = memoryToPromptLine(mem);
t.ok(/PROJECT MEMORY/.test(line), "has a header");
t.ok(/Routes that already exist:.*\/pricing/.test(line), "lists routes");
t.ok(/appointments\(service_id/.test(line), "lists tables + columns");
t.ok(/DO NOT change:.*booking flow/.test(line), "surfaces dont-touch");
t.ok(/palette #08070c/.test(line), "surfaces palette");
t.ok(line.length <= 1400, "…and stays bounded");

// --- empty memory → empty line (no noise) ---
t.eq(memoryToPromptLine(buildProjectMemory({}, {})), "", "empty project → empty prompt line");

t.done();
