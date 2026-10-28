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
