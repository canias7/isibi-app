// Incremental (targeted) regeneration for the website builder — upgrade #4.
//
// Today a chat edit ("change the pricing section") re-sends the WHOLE app (worker.js dumps up to 120k chars) to
// the model on every turn. That's slow, expensive (~100k input tokens), and lets the model drift on files the edit
// never mentioned. This module instead: (1) picks the files an edit actually touches, (2) sends ONLY those in full
// plus a COMPACT INDEX of everything else (so the model still knows the routes/components that exist), (3) grafts
// the returned files back. Same REACT_REVISE_RULES contract, a fraction of the input.
//
// Safety: when an edit is global (theme/palette/font/"every page") or nothing matches confidently, it FALLS BACK
// to whole-app context — so it's never worse than today, only cheaper on the common case (a localized edit).
//
// WORKER-SAFE: pure string/JSON, no node:module. Generation is injected (deps.generate) so it unit-tests at $0.
import { parseGeneratedFiles, REACT_REVISE_RULES } from "./react-gen.mjs";

// Files that always exist and are structural (routing/entry/styles).
const ENTRY = "src/main.jsx", APP = "src/App.jsx", CSS = "src/index.css", TW = "tailwind.config.js", HTML = "index.html";

// Words that make an edit GLOBAL — a localized slice can't safely capture these, so use whole-app context.
const GLOBAL_HINTS = /\b(theme|palette|colou?r scheme|colou?rs?|font|fonts|typograph|typeface|dark mode|light mode|whole site|entire site|every page|all pages|across the site|site-wide|sitewide|rebrand|re-?brand|brand|logo everywhere|global|overall (look|feel|style)|redesign)\b/i;
// Words that mean the ROUTE MAP / NAV changes — pull in App.jsx (+ nav) even for a "localized" edit.
const NAV_HINTS = /\b(add (a )?(new )?page|new page|remove (the )?page|delete (the )?page|another page|route|routing|navigation|nav bar|navbar|menu|header links?|footer links?|link to)\b/i;

const STOP = new Set(("the a an and or but of to in on at for with from by as is are be it this that these those i we you my our your make change update add remove delete set turn into more less very really please can could would should want need new also just so then than about into onto over under section part bit thing page site app screen look feel style " +
  "put give show hide move keep let use using make it").split(/\s+/).filter(Boolean));

// Tokenize an instruction into meaningful lowercase words (drop stopwords + very short tokens).
export function editTokens(instruction) {
  return [...new Set(String(instruction || "").toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !STOP.has(w)))];
}

// fileHaystack(path, src) — a lowercase "searchable" blob for a file: its path/name, component/symbol names, and
// visible text (headings, string literals, JSX text). Used to score an edit against the file.
export function fileHaystack(path, src) {
  const s = String(src || "");
  const parts = [path.toLowerCase().replace(/[^a-z0-9]+/g, " ")];
  // Exported/declared component + function names.
  for (const m of s.matchAll(/(?:function|const|class)\s+([A-Z][A-Za-z0-9]+)/g)) parts.push(m[1]);
  // Route paths.
  for (const m of s.matchAll(/path=["'`]([^"'`]+)["'`]/g)) parts.push(m[1]);
  // Visible text between tags + quoted string literals (rough but effective).
  for (const m of s.matchAll(/>([^<>{}\n]{2,80})</g)) parts.push(m[1]);
  for (const m of s.matchAll(/["'`]([^"'`\n]{3,60})["'`]/g)) parts.push(m[1]);
  return parts.join(" ").toLowerCase();
}

// A short label for a file, for the index the model sees (so it knows what exists without the full source).
export function fileSummary(path, src) {
  const s = String(src || "");
  if (path === APP) {
    const routes = [...s.matchAll(/path=["'`]([^"'`]+)["'`]/g)].map((m) => m[1]);
    return "router; routes: " + (routes.length ? routes.join(", ") : "(none found)");
  }
  const comp = (s.match(/export default function\s+([A-Za-z0-9]+)/) || s.match(/(?:function|const)\s+([A-Z][A-Za-z0-9]+)/) || [])[1];
  const heading = (s.match(/<h1[^>]*>([^<]{2,60})</i) || s.match(/<h2[^>]*>([^<]{2,60})</i) || [])[1];
  return [comp && ("component " + comp), heading && ('"' + heading.trim() + '"')].filter(Boolean).join(" — ") || "(file)";
}

// fileIndex(files) — one compact line per file: path + a short summary. Small enough to send every edit.
export function fileIndex(files) {
  return Object.keys(files).sort().map((p) => "- " + p + " — " + fileSummary(p, files[p])).join("\n");
}

// selectEditTargets(files, instruction) — which files this edit should regenerate.
//   → { wholeApp, targets:[paths], scores:{path:score}, reason }
export function selectEditTargets(files, instruction, opts = {}) {
  const paths = Object.keys(files);
  const maxTargets = opts.maxTargets || 4;
  // Global edits (theme/palette/font/whole-site) → whole-app context; a slice can't capture them safely.
  if (GLOBAL_HINTS.test(instruction || "")) return { wholeApp: true, targets: paths, scores: {}, reason: "global edit (theme/site-wide)" };

  const toks = editTokens(instruction);
  if (!toks.length) return { wholeApp: true, targets: paths, scores: {}, reason: "no matchable keywords" };

  // Score each non-structural file by how many instruction tokens appear in its haystack (name hits weigh more).
  const scores = {};
  for (const p of paths) {
    if (p === ENTRY) continue; // main.jsx is boilerplate; never the target of a content edit
    const hay = fileHaystack(p, files[p]);
    const nameHay = p.toLowerCase();
    let score = 0;
    for (const t of toks) { if (nameHay.includes(t)) score += 3; else if (hay.includes(t)) score += 1; }
    if (score > 0) scores[p] = score;
  }
  const ranked = Object.keys(scores).sort((a, b) => scores[b] - scores[a]);
  if (!ranked.length) return { wholeApp: true, targets: paths, scores, reason: "nothing matched confidently" };

  const targets = ranked.slice(0, maxTargets);
  // A route/nav edit needs App.jsx (and any nav-ish component) even if it didn't score.
  const navEdit = NAV_HINTS.test(instruction || "");
  if ((navEdit || targets.some((p) => p.startsWith("src/pages/"))) && files[APP] && !targets.includes(APP)) targets.push(APP);
  if (navEdit) for (const p of paths) if (/nav|header|footer|menu|sidebar/i.test(p) && !targets.includes(p)) targets.push(p);
  return { wholeApp: false, targets, scores, reason: "matched " + ranked.length + " file(s)" };
}

// composeEditPrompt(...) — the focused user message. wholeApp → the full dump (today's behavior). Otherwise: a
// compact index of ALL files + FULL source of just the targets, so the model edits the slice with full awareness.
export function composeEditPrompt(files, instruction, sel, opts = {}) {
  const cap = opts.cap || 120000;
  if (sel.wholeApp) {
    const dump = Object.entries(files).map(([p, s]) => "===FILE: " + p + "===\n" + s).join("\n\n").slice(0, cap);
    return { user: "Current project files:\n\n" + dump + "\n\nCHANGE REQUEST:\n" + instruction + "\n\nReturn only the changed file blocks.", wholeApp: true, targets: Object.keys(files), approxChars: Math.min(dump.length, cap) };
  }
  const index = fileIndex(files);
  const targetsDump = sel.targets.map((p) => "===FILE: " + p + "===\n" + files[p]).join("\n\n").slice(0, cap);
  const user =
    "You are editing an existing project. Here is the FULL FILE INDEX (paths + a one-line summary each) so you know every page, route, and component that exists:\n\n" + index +
    "\n\nYou may edit ONLY the files below (their full source follows). You may also ADD a new `src/pages/*.jsx` or `src/components/*.jsx` file, and update `src/App.jsx` to route to it.\n\n" + targetsDump +
    "\n\nCHANGE REQUEST:\n" + instruction +
    "\n\nReturn ONLY the changed file blocks (in full), in the `===FILE: path===` format. Do not touch files outside the editable set unless you are adding a new page/component or updating routing.";
  // Guard: on a small app the index + instructions can cost more than just dumping everything. Never send MORE
  // than whole-app context — if focused isn't smaller, fall back (whole-app is strictly safer for the model too).
  const wholeDump = Object.entries(files).map(([p, s]) => "===FILE: " + p + "===\n" + s).join("\n\n").slice(0, cap);
  const wholeUser = "Current project files:\n\n" + wholeDump + "\n\nCHANGE REQUEST:\n" + instruction + "\n\nReturn only the changed file blocks.";
  if (user.length >= wholeUser.length) return { user: wholeUser, wholeApp: true, targets: Object.keys(files), approxChars: wholeUser.length, reason: "focused not smaller — whole-app" };
  return { user, wholeApp: false, targets: sel.targets, approxChars: user.length };
}

// mergeEditedFiles(files, changed) — graft changed files back; report which paths changed/added.
export function mergeEditedFiles(files, changed) {
  const next = { ...files };
  const changedPaths = [], addedPaths = [];
  for (const [p, v] of Object.entries(changed)) {
    if (p === "isibi.schema.json") { next[p] = v; changedPaths.push(p); continue; }
    if (!(p in next)) addedPaths.push(p); else changedPaths.push(p);
    next[p] = v;
  }
  return { files: next, changedPaths, addedPaths };
}

// runIncrementalEdit(files, instruction, deps) — one targeted edit end-to-end with an injected generate().
//   deps: { generate(system,user)->{text,usedIn,usedOut}, rules?, maxTargets?, cap? }
//   → { ok, wholeApp, targets, changedPaths, addedPaths, files, savings:{fullChars,sentChars,pct}, tokens, error? }
export async function runIncrementalEdit(files, instruction, deps = {}) {
  const out = { ok: false, wholeApp: false, targets: [], changedPaths: [], addedPaths: [], files, tokens: { in: 0, out: 0 } };
  try {
    const sel = selectEditTargets(files, instruction, deps);
    const prompt = composeEditPrompt(files, instruction, sel, deps);
    out.wholeApp = prompt.wholeApp; out.targets = prompt.targets;
    const fullChars = Object.values(files).reduce((n, s) => n + String(s).length, 0);
    out.savings = { fullChars, sentChars: prompt.approxChars, pct: fullChars ? Math.round((1 - prompt.approxChars / fullChars) * 100) : 0 };
    const g = await deps.generate(deps.rules || REACT_REVISE_RULES, prompt.user);
    out.tokens = { in: g.usedIn || 0, out: g.usedOut || 0 };
    const changed = parseGeneratedFiles(g.text || "");
    if (!Object.keys(changed).length) { out.error = "no file blocks returned"; return out; }
    const merged = mergeEditedFiles(files, changed);
    out.files = merged.files; out.changedPaths = merged.changedPaths; out.addedPaths = merged.addedPaths;
    out.ok = true;
  } catch (e) { out.error = String(e && e.message || e).slice(0, 200); }
  return out;
}
