// WHAT A PUBLISH REALLY CHECKED, KEPT ON ITS OWN ANSWER (2026-10-14).
//
// Codex's review of branch `new` at f1c6f9b0: the final reply was handed the
// checks a job ran only from its progress record (`jobChecksFor`), which is
// there only when the conversational switch is on and the record wrote, and
// which held the checks that passed and the publish but not the ones that
// could not run; a Build's reply and a combined request's were handed none.
// And the one sentence every reply did get about a check, `renderNote`'s "I
// had a look at the finished pages", reads as somebody looking at them.
//
// So the evidence is made where it happens — the publish (`recompileAndPublish`,
// and a Build's `publishPages`) — as data, and rides on the answer the route
// stores. Every final reply reads it from there: an edit's, an add-on's, a
// Build's, and each part of a combined request (scoped to that part by its own
// words). Narration that failed, was skipped, was switched off or came late
// changes none of it.
//
// FIVE THINGS, KEPT APART, each said exactly as far as it reaches:
//   compiled   the code built without errors. Not a look at any page.
//   browser    an automated check opened the pages in a browser, at the widths
//              it uses, and flagged what it looks for — or could not run, or
//              was cut short. Automated: not anybody looking at the design.
//   css        the style rules a change wrote each match something on the page.
//   published  the live pointer moved to this version and the site's script
//              went up. Not anybody opening the live address afterwards.
//   (visual review and a read of the live page are never made, and the
//   facts say so, so no reply can imply them.)

/** What each kind of finding is, in the customer's terms (the render check's own kinds). */
export const FINDING_SAID = Object.freeze({
  threw: "a page that stops with an error", logged: "an error written while a page loads", blank: "a page that shows nothing",
  slow: "a page that took longer to open than the check waits", unmet: "a page that reads something the check cannot reach, so it was not seen with real data",
  image: "an image that did not load", overflow: "a page that scrolls sideways", contrast: "text that is nearly invisible",
  seethrough: "a see-through menu or dialog",
});
/** What a clean check looked for: the kinds that are faults, not limits of the check. */
const LOOKS_FOR = Object.keys(FINDING_SAID).filter((k) => k !== "unmet" && k !== "slow");

export const MAX_CHECK_FINDINGS = 12;
const ROUTE = /^\/[^\s]{0,200}$/;
const VERSION = /^[A-Za-z0-9._-]{1,80}$/;
const plain = (v) => !!v && typeof v === "object" && !Array.isArray(v);
const count = (n, one) => n + " " + one + (n === 1 ? "" : "s");
function listOf(xs) {
  return xs.length <= 1 ? (xs[0] || "") : xs.slice(0, -1).join(", ") + " and " + xs[xs.length - 1];
}

/**
 * THE EVIDENCE, FROM WHAT THE PUBLISH ITSELF HAD: the compile's render report
 * (`render`, read whole — a clean report included, which the wire otherwise
 * drops), the version it activated, whether activation answered ok, and how
 * many of the change's style rules were checked. Never throws; a report it
 * cannot read is a browser check that did not run, never one that passed.
 */
export function checksOf({ render = null, version = "", published = false, cssChecked = 0 } = {}) {
  const r = plain(render) ? render : null;
  const pages = r && Number.isInteger(r.pages) && r.pages > 0 ? r.pages : 0;
  const ran = !!r && r.ok !== false && pages > 0;
  const all = ran && Array.isArray(r.findings) ? r.findings.filter((f) => plain(f) && Object.hasOwn(FINDING_SAID, f.kind) && typeof f.route === "string" && ROUTE.test(f.route)) : [];
  const more = (ran && Number.isInteger(r.more) && r.more > 0 ? r.more : 0) + Math.max(0, all.length - MAX_CHECK_FINDINGS);
  const css = Number.isInteger(cssChecked) && cssChecked > 0 ? cssChecked : 0;
  return {
    compiled: true,
    browser: ran
      ? { ran: true, pages, findings: all.slice(0, MAX_CHECK_FINDINGS).map((f) => ({ route: f.route, kind: f.kind })), ...(more ? { more } : {}), ...(r.partial === true ? { cut: true } : {}) }
      : { ran: false },
    ...(css ? { css } : {}),
    published: published === true,
    ...(typeof version === "string" && VERSION.test(version) ? { version } : {}),
  };
}

/**
 * THE EVIDENCE AS AN ANSWER CARRIES IT, read strictly: anything that is not
 * exactly this shape is null — cannot-tell is never read as a check that ran,
 * nor as one that did not.
 */
export function readChecks(v) {
  if (!plain(v) || v.compiled !== true || typeof v.published !== "boolean" || !plain(v.browser)) return null;
  const b = v.browser;
  if (b.ran === true) {
    if (!Number.isInteger(b.pages) || b.pages < 1 || !Array.isArray(b.findings) || b.findings.length > MAX_CHECK_FINDINGS) return null;
    if (!b.findings.every((f) => plain(f) && Object.hasOwn(FINDING_SAID, f.kind) && typeof f.route === "string" && ROUTE.test(f.route))) return null;
    if (b.more !== undefined && !(Number.isInteger(b.more) && b.more > 0)) return null;
    if (b.cut !== undefined && b.cut !== true) return null;
  } else if (b.ran !== false) return null;
  if (v.css !== undefined && !(Number.isInteger(v.css) && v.css > 0)) return null;
  if (v.version !== undefined && !(typeof v.version === "string" && VERSION.test(v.version))) return null;
  return v;
}

/**
 * THE FINAL REPLY'S `k` FACTS, from readable evidence: `[{ kind: "check",
 * text }]`, each saying one check as far as it reached, with `scope` (a
 * request part's own words) in front so a reply of several parts can tell
 * whose check each is, and `nth` when that part published more than once.
 * THE VERSION'S ID IS NOT SAID: it stays on the evidence, where it scopes the
 * check to the build it was made on, and the customer is told whose publish
 * it was in their own words instead — an id is nothing they can use, and the
 * reply's rules keep such things out. [] for evidence that does not read.
 */
const ORD = ["", "1st", "2nd", "3rd"];
export function checkFacts(checks, { scope = "", nth = 0 } = {}) {
  const c = readChecks(checks);
  if (!c) return [];
  const which = Number.isInteger(nth) && nth > 0 ? (ORD[nth] || nth + "th") + " publish" : "";
  const at = scope ? "For " + scope + (which ? " (its " + which + ")" : "") + ": " : which ? "For its " + which + ": " : "";
  const out = [];
  const add = (text) => out.push({ kind: "check", text: at + text });
  add("The site's code compiled without errors. Compiling checks that the code fits together; it is not a look at any page.");
  const b = c.browser;
  if (b.ran !== true) {
    add("The automated check that opens the pages in a browser could not run, so nothing checked how the pages load.");
  } else {
    const opened = "An automated check opened " + (b.pages === 1 ? "the page" : b.pages + " pages") + " in a browser" + (b.cut ? " and was cut short before it finished, so not every page was checked" : "");
    if (!b.findings.length && !b.more) {
      add(opened + (b.cut ? ". On the pages it reached it" : ". It") + " flagged none of what it looks for (" + listOf(LOOKS_FOR.map((k) => FINDING_SAID[k])) + "). It is automated: nobody looked at the design.");
    } else {
      const by = new Map();
      for (const f of b.findings) { if (!by.has(f.kind)) by.set(f.kind, []); if (!by.get(f.kind).includes(f.route)) by.get(f.kind).push(f.route); }
      const said = [...by].map(([k, routes]) => FINDING_SAID[k] + " (" + listOf(routes) + ")");
      add(opened + ". It flagged " + listOf(said) + (b.more ? ", and " + count(b.more, "more finding") + " not listed here" : "") + ". It is automated: nobody looked at the design.");
    }
  }
  if (c.css) add((c.css === 1 ? "The one style rule" : "Each of the " + c.css + " style rules") + " this change wrote was checked to match something on the page.");
  add(c.published
    ? "Published: the new version is now the one the site's address is set to serve. Nobody opened the live address afterwards to confirm it."
    : "Not published: the version this made is not the one the site's address serves.");
  return out;
}

/**
 * AN ANSWER STORED BEFORE THE EVIDENCE EXISTED carries only the render report,
 * and only when the check failed or found something: what it flagged, or that
 * it could not run, is said; nothing about the compile or the publish, which
 * that answer does not record.
 */
export function browserOnlyFacts(render) {
  if (!plain(render)) return [];
  const all = checkFacts(checksOf({ render }));
  return all.length >= 2 ? [all[1]] : [];
}
