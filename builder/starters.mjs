// starters.mjs — WHOLE-APP STARTERS: the layer above page recipes.
//
// Recipes tell the model what SHAPE a page should be; it still writes every page from scratch, and "from scratch"
// is where the variance and the token spend live. A starter is a COMPLETE, WORKING app already in the box —
// real pages, real useResource wiring, a real isibi.schema.json — so the model's job changes from *write a
// booking app* to *make this booking app be about Marco's barbershop*. Editing beats generating on every axis
// that matters: fewer tokens, no truncation risk, and the failure mode becomes "left something in that doesn't
// fit" instead of "invented something broken".
//
// A starter is ONLY its pages plus its schema. Routing, the nav, and the palette are already free: scaffoldRouting
// derives the router and nav links from whichever page files exist, and scaffoldTheme re-skins every component
// from the style family the planner picks. So dropping a starter into `files` gives a routed, themed, running app
// before a single token is spent.
//
// Starters are keyed to the capability BUNDLES that already exist, so one intent match drives both the backend
// capability set and the front-end starter — they can never disagree about what kind of app is being built.
// WORKER-SAFE: pure, reads only the generated data module.

import { STARTER_DATA } from "./starters.data.mjs";
import { matchBundle } from "./capability-bundles.mjs";

export const STARTER_IDS = Object.keys(STARTER_DATA);

export function listStarters() {
  return STARTER_IDS.map((id) => ({ id, ...STARTER_DATA[id].meta, fileCount: Object.keys(STARTER_DATA[id].files).length }));
}

export function getStarter(id) {
  const s = STARTER_DATA[id];
  return s ? { id, ...s.meta } : null;
}

// starterFiles(id) → a FRESH copy of the starter's file map, keyed by the path a generated app uses
// (`src/pages/Home.tsx`, `isibi.schema.json`). Copied, not shared, so a build can mutate it freely.
export function starterFiles(id) {
  const s = STARTER_DATA[id];
  return s ? { ...s.files } : {};
}

// starterPages(id) → the page names the starter already provides ("Home", "Book", …). The build uses this to
// SKIP generating those pages — that skip is where the token saving actually comes from.
export function starterPages(id) {
  const s = STARTER_DATA[id];
  return s ? [...(s.meta.pages || [])] : [];
}

// matchStarter(intent) → { id, title, score, pages } for the best-fitting starter, or null.
// Deliberately delegates to matchBundle rather than carrying its own keyword list: a second list would drift
// from the first, and then the app would get a booking BACKEND with a commerce FRONT END.
export function matchStarter(intent, opts = {}) {
  const m = matchBundle(intent, opts);
  if (!m || !STARTER_DATA[m.id]) return null;
  const meta = STARTER_DATA[m.id].meta;
  return { id: m.id, title: meta.title, score: m.score, bundle: m.id, pages: [...(meta.pages || [])] };
}

// bundleHasStarter(id) — for reporting which bundles are still generate-from-scratch.
export function bundleHasStarter(id) { return !!STARTER_DATA[id]; }

// starterBrief(id) → the block injected into the ADAPT step. It describes what the model has been handed and what
// it is allowed to change, and it is short on purpose: the code is already in the prompt, so this only has to
// carry intent, not structure.
export function starterBrief(id) {
  const s = STARTER_DATA[id];
  if (!s) return "";
  const m = s.meta;
  const pages = (m.pages || []).join(", ");
  return `STARTER: you have been given a COMPLETE, WORKING ${m.title} app (${pages}). It compiles, it is routed, ` +
    `it is themed, and every page already reads and writes its tables through useResource. Your job is to make it ` +
    `be about THIS business — not to rebuild it.\n` +
    (m.summary ? `  What it does: ${m.summary}\n` : "") +
    `  CHANGE: copy, names, imagery prompts, the service/product/section list, and any field the brief implies.\n` +
    `  KEEP: the file layout, the component choices, the useResource calls, and the table names in isibi.schema.json ` +
    `unless the brief genuinely needs a different data model.\n` +
    `  Emit ONLY the files you actually changed. A page that is already right for this business should not be re-emitted.`;
}

// coverage() — which bundles have a starter and which still generate from scratch, so the gap stays visible
// instead of being something you have to remember.
export function coverage(bundles) {
  const list = (bundles || []).map((b) => (typeof b === "string" ? b : b.id));
  return {
    withStarter: list.filter(bundleHasStarter),
    generateFromScratch: list.filter((id) => !bundleHasStarter(id)),
  };
}
