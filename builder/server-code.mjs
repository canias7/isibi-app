// THE CHECK ON THE SITE'S OWN SERVER CODE, BEFORE IT IS PUBLISHED (2026-10-28).
//
// The model may write code for the site's own Worker: a part named
// `server-<name>` (see the template's `src/lib/site-functions.ts`). It runs
// where the owner's keys live, so it may reach the outside world and the keys
// only through the `site` helper it is handed. This refuses what would reach
// around that helper, and a page or component that imports server code into the
// visitor's browser. Read as text: a refusal names the file and the reason, and
// the part is left out of the build rather than shipped.
//
// Dependency-free: the Worker and the tests read it.

export const SERVER_PREFIX = "server-";
export const isServerPart = (p) => !!p && typeof p.name === "string" && p.name.startsWith(SERVER_PREFIX);

/** What server code may not touch, each with the reason the customer is told. */
const FORBIDDEN = [
  [/\benv\b/, "reads the Worker's settings directly (use site.key)"],
  [/\bprocess\b/, "reads process (there is none; use site.key)"],
  [/\bglobalThis\b|\bself\b\s*\.|\bwindow\b/, "reaches the global object"],
  [/\beval\s*\(|\bnew\s+Function\b|\bFunction\s*\(/, "builds code at run time"],
  [/\bimport\s*\(/, "loads code at run time"],
  [/(?<![.\w])fetch\s*\(/, "calls the internet directly (use site.fetch)"],
  [/\bXMLHttpRequest\b|\bWebSocket\b|\bEventSource\b|\bconnect\s*\(/, "opens its own connection (use site.fetch)"],
  [/\bcaches\b|\bcrypto\.subtle\.exportKey\b/, "reaches a platform store"],
  [/\bsite\s*\[/, "reaches into the site helper by name"],
  [/\.constructor\b|\b__proto__\b|\bReflect\b|\bProxy\b/, "reaches the language's internals"],
];

/** Comments and string contents blanked, so prose and text cannot trip or hide a rule. */
function codeOnly(src) {
  return String(src)
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/[^\n]*/g, " ")
    // Plain quotes only: a template literal's \${…} is code, and stays read.
    .replace(/(["'])(?:\\.|(?!\1)[^\\\n])*\1/g, '""');
}

/**
 * Check one server part. `{ ok: true }` or `{ ok: false, reasons: [...] }`.
 * Required: a default export, and `export const hosts = [...]` of plain host
 * names (it may be empty). Imports: none, except types.
 */
export function checkServerPart(part) {
  const reasons = [];
  const src = String((part && part.source) || "");
  const code = codeOnly(src);
  if (!/\bexport\s+default\b/.test(code)) reasons.push("has no default export (the function itself)");
  const hostsDecl = src.match(/export\s+const\s+hosts\s*(?::[^=]+)?=\s*\[([^\]]*)\]/);
  if (!hostsDecl) reasons.push("does not declare `export const hosts = [...]` (the addresses it calls)");
  else {
    const items = hostsDecl[1].split(",").map((s) => s.trim()).filter(Boolean);
    for (const it of items) if (!/^["'][a-z0-9.-]+\.[a-z]{2,}["']$/i.test(it)) reasons.push("lists a host that is not a plain address: " + it.slice(0, 60));
  }
  const onDecl = src.match(/export\s+const\s+on\s*(?::[^=]+)?=\s*\[([^\]]*)\]/);
  if (onDecl) {
    // QUOTED ITEMS, read as quoted (a schedule like "cron:0 9,17 * * *" has commas).
    const inner = onDecl[1];
    if (inner.replace(/(["'])[^"']*\1/g, "").replace(/[\s,]/g, "")) reasons.push("declares `on` with something other than quoted events");
    for (const it of inner.match(/(["'])[^"']*\1/g) || []) {
      if (!/^["'](?:(?:created|updated|deleted|paid):[a-z][a-z0-9_]{0,62}|tick|cron:(?:TZ=[A-Za-z_]+(?:\/[A-Za-z_+-]+){0,2}\s+)?[0-9*,/-]+(?:\s+[0-9*,/-]+){4})["']$/.test(it)) reasons.push("hooks an event that does not exist: " + it.slice(0, 60) + " (use created:<table>, updated:<table>, deleted:<table>, paid:<table>, tick, or cron:<minute> <hour> <day> <month> <weekday>)");
    }
  } else if (/export\s+const\s+on\b/.test(code)) reasons.push("declares `on` as something other than a plain list of events");
  for (const m of code.matchAll(/^\s*import\s+(?!type\b)[^;]*?from\s*["'][^"']*["']/gm)) reasons.push("imports code (`" + m[0].trim().slice(0, 60) + "`); server code imports nothing but types");
  if (/^\s*import\s*["']/m.test(code)) reasons.push("imports code for its side effects");
  for (const [re, why] of FORBIDDEN) if (re.test(code)) reasons.push(why);
  return reasons.length ? { ok: false, reasons } : { ok: true };
}

/** True when a file imports a server part (which would put it in the browser). */
export function importsServer(source) {
  return /(["'])(?:@\/routes\/-parts\/|\.\/-parts\/|\.\/)server-[a-z0-9-]+(?:\.tsx)?\1/.test(String(source || ""));
}

/**
 * Split a build's parts: the server parts that pass stay; the ones that fail are
 * left out, and any page or component importing server code is reported. The
 * problems are sentences for the reply.
 */
export function vetServerCode({ pages = [], parts = [] } = {}) {
  const problems = [];
  const kept = [];
  const failed = [];
  for (const p of parts) {
    if (!isServerPart(p)) { kept.push(p); continue; }
    const r = checkServerPart(p);
    if (r.ok) kept.push(p);
    else failed.push({ part: p, reasons: r.reasons }), problems.push("the site's server code `" + p.name + "` was left out: it " + r.reasons.join("; it ") + ".");
  }
  const browserFiles = pages.map((p) => [p.path, p.source]).concat(kept.filter((p) => !isServerPart(p)).map((p) => [p.name, p.source]));
  const leaking = browserFiles.filter(([, s]) => importsServer(s)).map(([n]) => n);
  for (const n of leaking) problems.push("`" + n + "` imports the site's server code into the visitor's browser; it must call it at /api/db/<site>/fn/<name> instead.");
  return { parts: kept, problems, leaking, failed };
}

/** What the repair call is told, beside the check's own reasons. */
export const SERVER_REPAIR_RULES = [
  "Keep exactly this shape: `export const hosts = [\"…\"]` (plain addresses it calls) and `export default async function (request: Request, site: any): Promise<Response>`.",
  "Import nothing. Never read env, process, globalThis, window or self; never call fetch directly; never eval, new Function or import().",
  "Every outside call is site.fetch(url, init) to a host in `hosts`; an owner's key goes in only as site.key(\"NAME\"); the database is site.sql(text, params).",
  "Change only what the check refused; keep everything the function does.",
].join("\n");

// ── THE EVIDENCE ABOUT THE SITE'S SERVER CODE, FOR THE REPLY (2026-10-28) ────
// The owner: messages are the model talking, never fixed sentences. So this
// is FACTS — what exists, what was tested, which keys it needs, what did not
// connect — handed to the reply writer, which says it in its own words.

/** The function names pages and components call (`/fn/<name>`). */
export function calledFunctions(files) {
  const out = new Set();
  for (const f of files || []) for (const m of String((f && f.source) || "").matchAll(/\/fn\/([a-z][a-z0-9]*(?:-[a-z0-9]+)*)/g)) out.add(m[1]);
  return out;
}

/** The keys a server part asks for, by name. */
export function keysAsked(source) {
  const out = new Set();
  for (const m of String(source || "").matchAll(/site\s*\.\s*(?:key|hasKey)\s*\(\s*["']([A-Z][A-Z0-9_]{0,63})["']\s*\)/g)) out.add(m[1]);
  return [...out];
}

const hooksOfSource = (src) => {
  const m = String(src || "").match(/export\s+const\s+on\s*(?::[^=]+)?=\s*\[([^\]]*)\]/);
  return m ? (m[1].match(/(["'])([^"']*)\1/g) || []).map((q) => q.slice(1, -1)) : [];
};

/**
 * One record of the site's server code as this publish left it, or null when
 * there is none and nothing was refused. `tests` is the container's
 * `serverTests`; `refused` is `vetServerCode(...).failed`; `keysSet`, when
 * known, the names the owner has set.
 */
export function serverEvidence({ pages = [], parts = [], tests = null, refused = [], keysSet = null, repaired = [], dropped = [], leaking = [] } = {}) {
  const server = (parts || []).filter(isServerPart);
  if (!server.length && !(refused || []).length && !(dropped || []).length && !(leaking || []).length) return null;
  const called = calledFunctions((pages || []).concat((parts || []).filter((p) => !isServerPart(p))));
  const results = new Map(((tests && tests.results) || []).map((r) => [r.name, r]));
  const fns = server.map((p) => {
    const name = p.name.replace(/^server-/, "");
    const hooks = hooksOfSource(p.source);
    const visitors = !hooks.length || /export\s+const\s+visitors\s*=\s*true/.test(String(p.source));
    const r = results.get(name);
    return {
      name, hooks, visitors, called: called.has(name), keys: keysAsked(p.source),
      test: !tests || !tests.ran ? "not run" : !r ? "not run" : r.ok ? "passed" : (r.kind === "code" ? "failed" : "unclear"),
      ...(r && !r.ok && r.error ? { error: String(r.error).slice(0, 200) } : {}),
    };
  });
  const defined = new Set(fns.map((f) => f.name));
  const keys = [...new Set(fns.flatMap((f) => f.keys))];
  return {
    functions: fns,
    missing: [...called].filter((n) => !defined.has(n)),
    keys: keys.map((k) => ({ name: k, set: Array.isArray(keysSet) ? keysSet.includes(k) : null })),
    refused: (refused || []).map((f) => ({ name: String(f.part.name).replace(/^server-/, ""), reasons: f.reasons.slice(0, 4) })),
    ...(repaired && repaired.length ? { repaired: repaired.map((n) => String(n).replace(/^server-/, "")) } : {}),
    ...(dropped && dropped.length ? { dropped: dropped.map((n) => String(n).replace(/^server-/, "")) } : {}),
    ...(leaking && leaking.length ? { leaking: leaking.slice(0, 6) } : {}),
    ...(tests && !tests.ran && tests.why !== "none" ? { untested: String(tests.why || "") } : {}),
  };
}

/** The facts for the reply writer — plain statements, never the reply itself. */
export function serverFacts(e) {
  if (!e) return [];
  const out = [];
  const say = (text) => out.push({ kind: "server", text });
  for (const f of e.functions || []) {
    const when = f.hooks.length
      ? "It runs on its own when " + f.hooks.map(hookSaid).join(", or when ") + (f.visitors && f.hooks.length ? ", and a page can call it too" : "") + "."
      : f.called ? "A page on the site calls it." : "No page or component calls it, so as it stands nothing on the site uses it.";
    say("The site has server code named \"" + f.name + "\" (it runs on the site's own server, not in the visitor's browser). " + when);
    if (f.test === "passed") say("\"" + f.name + "\" was test-run once in a sandbox before publishing, with outside services faked (nothing was sent, no key was used), and it answered without errors. The test does not prove the real outside service accepts its calls.");
    else if (f.test === "failed") say("\"" + f.name + "\" was test-run once in a sandbox before publishing and failed: " + (f.error || "an error") + ". It was published anyway, so this feature may not work until it is fixed.");
    else if (f.test === "unclear") say("\"" + f.name + "\" was test-run with made-up sample input and stopped with: " + (f.error || "an error") + ". That may only be the sample input, not a real fault.");
  }
  for (const k of e.keys || []) {
    if (k.set === true) say("The server code uses the owner's key " + k.name + ", which is already set.");
    else if (k.set === false) say("The server code needs the owner's key " + k.name + ", which is NOT set yet; until the owner adds it in the site's Keys settings, that feature will not work.");
    else say("The server code needs the owner's key " + k.name + "; if the owner has not added it in the site's Keys settings yet, that feature will not work until they do.");
  }
  for (const n of e.missing || []) say("A page calls server code named \"" + n + "\", but the site has no server code with that name, so that part of the page will not work.");
  for (const r of e.refused || []) say("Server code named \"" + r.name + "\" was not added because the safety check refused it: it " + r.reasons.join("; it ") + ".");
  for (const n of e.repaired || []) say("Server code \"" + n + "\" was refused at first and then fixed, and the fixed version passed the safety check.");
  for (const n of e.dropped || []) say("Server code \"" + n + "\" did not compile and was left out of this publish rather than replaced with an empty stand-in.");
  for (const n of e.leaking || []) say("The file \"" + n + "\" tried to bring the site's server code into the visitor's browser; server code is only reached through its address on the site's own server.");
  if (e.untested) say("The server code could not be test-run this time (" + e.untested + ").");
  return out;
}

function hookSaid(h) {
  const m = /^(created|updated|deleted|paid):(\w+)$/.exec(h);
  if (m) return ({ created: "a new entry is saved in ", updated: "an entry is changed in ", deleted: "an entry is removed from ", paid: "a payment goes through for " })[m[1]] + "\"" + m[2] + "\"";
  if (h === "tick") return "the site's clock ticks (every few minutes)";
  if (h.startsWith("cron:")) return "its schedule comes round (" + h.slice(5) + ")";
  return h;
}
