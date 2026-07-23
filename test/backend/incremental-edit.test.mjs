// Incremental (targeted) regeneration tests — the selection + prompt-shaping + merge are pure, so they run with a
// MOCK generate ($0). Proves a localized edit sends only the affected slice (big token savings) while global edits
// safely fall back to whole-app context.
import { makeTally } from "./harness.mjs";
import { editTokens, fileHaystack, fileSummary, fileIndex, selectEditTargets, composeEditPrompt, mergeEditedFiles, runIncrementalEdit } from "../../builder/incremental-edit.mjs";

const t = makeTally("Incremental edit");

// A small multi-page app fixture.
const files = {
  "index.html": '<!doctype html><html><head><title>Glow Salon</title></head><body><div id="root"></div><script type="module" src="/src/main.jsx"></script></body></html>',
  "src/main.jsx": "import { createRoot } from 'react-dom/client'\nimport { HashRouter } from 'react-router-dom'\nimport App from './App.jsx'\ncreateRoot(document.getElementById('root')).render(<HashRouter><App/></HashRouter>)",
  "src/App.jsx": "import { Routes, Route } from 'react-router-dom'\nimport Home from './pages/Home.jsx'\nimport Pricing from './pages/Pricing.jsx'\nimport Booking from './pages/Booking.jsx'\nexport default function App(){return <Routes><Route path='/' element={<Home/>}/><Route path='/pricing' element={<Pricing/>}/><Route path='/booking' element={<Booking/>}/></Routes>}",
  "src/index.css": "@tailwind base;@tailwind components;@tailwind utilities;",
  "src/components/Nav.jsx": "import { Link } from 'react-router-dom'\nexport default function Nav(){return <nav className='flex gap-6 p-6'>" + "<Link to='/'>Home</Link>".repeat(1) + "<Link to='/pricing'>Pricing</Link><Link to='/booking'>Booking</Link></nav>}\n" + "// layout ".repeat(60),
  // Realistic page sizes (generated pages are hundreds–thousands of chars) so the index-vs-full-source tradeoff is real.
  "src/pages/Home.jsx": "export default function Home(){return <div className='hero'><h1>Glow Salon</h1><p>Book your next appointment in seconds.</p>" + "<section className='block'>A calm, modern space for hair and skin.</section>".repeat(30) + "</div>}",
  "src/pages/Pricing.jsx": "export default function Pricing(){return <div><h1>Pricing</h1><p>Haircut $40. Color $90.</p>" + "<div className='tier'>Service tier with details and description copy.</div>".repeat(30) + "</div>}",
  "src/pages/Booking.jsx": "export default function Booking(){return <div><h1>Book</h1><form><input placeholder='name'/></form>" + "<div className='slot'>Available time slot for an appointment.</div>".repeat(30) + "</div>}",
};

// --- editTokens drops stopwords/short words ---
t.ok(editTokens("change the pricing copy please").includes("pricing"), "keeps meaningful tokens");
t.ok(!editTokens("change the pricing copy please").includes("the"), "drops stopwords");

// --- fileHaystack surfaces routes, component names, visible text ---
const hay = fileHaystack("src/pages/Pricing.jsx", files["src/pages/Pricing.jsx"]);
t.ok(hay.includes("pricing") && hay.includes("haircut"), "haystack has component + visible text");
t.ok(fileSummary("src/App.jsx", files["src/App.jsx"]).includes("/pricing"), "App summary lists routes");
t.ok(fileIndex(files).split("\n").length === Object.keys(files).length, "index has one line per file");

// --- A localized edit targets just the right page ---
let sel = selectEditTargets(files, "change the pricing prices to $50 and $100");
t.eq(sel.wholeApp, false, "localized edit is NOT whole-app");
t.ok(sel.targets.includes("src/pages/Pricing.jsx"), "…targets the Pricing page");
t.ok(!sel.targets.includes("src/pages/Booking.jsx"), "…and not unrelated pages");

// --- A global (theme) edit falls back to whole-app ---
sel = selectEditTargets(files, "change the color theme to dark green");
t.eq(sel.wholeApp, true, "theme edit → whole-app context (safe)");

// --- Gibberish / no-match falls back to whole-app rather than guessing ---
t.eq(selectEditTargets(files, "zzzqqq wobble").wholeApp, true, "no confident match → whole-app fallback");

// --- Adding a page pulls in App.jsx (routing) even though it didn't score ---
sel = selectEditTargets(files, "add a new contact page with a form");
t.ok(sel.targets.includes("src/App.jsx"), "add-a-page edit includes the router");

// --- The focused prompt is much smaller than the whole dump ---
sel = selectEditTargets(files, "change the pricing prices");
const focused = composeEditPrompt(files, "change the pricing prices", sel);
const whole = composeEditPrompt(files, "x", { wholeApp: true, targets: Object.keys(files) });
t.ok(focused.approxChars < whole.approxChars, "focused prompt is smaller than whole-app");
t.ok(/FULL FILE INDEX/.test(focused.user) && /Pricing\.jsx/.test(focused.user), "…still carries the index + the target source");
t.ok(!/Book your next appointment/.test(focused.user) || focused.user.indexOf("Booking.jsx===") === -1, "…does not inline unrelated page bodies");

// --- merge grafts changed files, distinguishing added vs changed ---
const m = mergeEditedFiles(files, { "src/pages/Pricing.jsx": "NEW", "src/pages/Contact.jsx": "ADDED" });
t.ok(m.changedPaths.includes("src/pages/Pricing.jsx"), "existing file → changed");
t.ok(m.addedPaths.includes("src/pages/Contact.jsx"), "new file → added");
t.eq(m.files["src/pages/Pricing.jsx"], "NEW", "…and the content is grafted");

// --- runIncrementalEdit end-to-end (mock generate) reports savings + changed files ---
let capturedUser = null;
const r = await runIncrementalEdit(files, "change the pricing prices to $50", {
  generate: async (sys, user) => { capturedUser = user; return { text: "===FILE: src/pages/Pricing.jsx===\nexport default function Pricing(){return <div><h1>Pricing</h1><p>Haircut $50.</p></div>}", usedIn: 4000, usedOut: 500 }; },
});
t.eq(r.ok, true, "edit succeeds");
t.eq(r.wholeApp, false, "…stayed localized");
t.ok(r.changedPaths.includes("src/pages/Pricing.jsx"), "…changed the Pricing page");
t.ok(r.files["src/pages/Pricing.jsx"].includes("$50"), "…with the new content grafted");
t.ok(r.savings.pct > 0, `…and sent less than the whole app (${r.savings.pct}% smaller)`);
t.ok(/Haircut \$40/.test(capturedUser), "the target's current source was in the prompt");

// --- A global edit through the same entry point uses whole-app context ---
const rg = await runIncrementalEdit(files, "restyle the whole site with a new dark theme", {
  generate: async () => ({ text: "===FILE: src/index.css===\n@tailwind base;", usedIn: 1, usedOut: 1 }),
});
t.eq(rg.wholeApp, true, "global edit → whole-app");
t.eq(rg.targets.length, Object.keys(files).length, "…all files in context");

// --- No file blocks returned → ok:false with a reason ---
const rb = await runIncrementalEdit(files, "change the pricing", { generate: async () => ({ text: "sorry", usedIn: 1, usedOut: 1 }) });
t.eq(rb.ok, false, "empty generation is a failure");
t.ok(/no file blocks/.test(rb.error), "…with an explanatory error");

t.done();
