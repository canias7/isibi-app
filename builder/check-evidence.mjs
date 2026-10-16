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
 * WHAT THE BROWSER CHECK'S REPORT SAYS, AS FAR AS IT CAN BE READ (2026-10-14,
 * Codex's review at 8a000d1f: an unreadable finding was filtered out, the list
 * came back empty, and the facts called the check clean). Four outcomes, kept
 * apart:
 *   { ran: false }   no report came back, it says it did not run (`ok: false`),
 *                    or it opened no page;
 *   { ran: null }    a report is there but whether it ran cannot be read (no
 *                    readable `ok` or page count) — never "passed", never
 *                    "did not run";
 *   { ran: true, … } it ran and opened `pages`; then
 *     `findings`     each one understood: a known kind, with its page when the
 *                    page reads (a known kind on an unreadable page is kept,
 *                    without one);
 *     `unread`       how many it reported that could not be understood (an
 *                    unknown kind, not an object) — counted, never shown;
 *     `unknown`      the list itself, or its count of more, could not be read,
 *                    so whether it flagged anything (more) is not known;
 *     `more`, `cut`  past the cap; cut short (`true`), or whether it was cut
 *                    cannot be read (`null`).
 * Clean is only `ran: true` with nothing flagged, nothing unread and nothing
 * unknown. No raw text of a finding is ever carried.
 */
function browserOf(r) {
  if (r === null || r === undefined) return { ran: false };
  if (!plain(r)) return { ran: null };
  if (r.ok === false) return { ran: false };
  if (r.ok !== true) return { ran: null };
  if (r.pages === 0) return { ran: false };
  if (!Number.isInteger(r.pages) || r.pages < 1) return { ran: null };
  const found = [];
  let unread = 0;
  let unknown = false;
  if (Array.isArray(r.findings)) {
    for (const f of r.findings) {
      if (plain(f) && typeof f.kind === "string" && Object.hasOwn(FINDING_SAID, f.kind)) found.push(typeof f.route === "string" && ROUTE.test(f.route) ? { route: f.route, kind: f.kind } : { kind: f.kind });
      else unread++;
    }
  } else unknown = true;
  let more = Math.max(0, found.length - MAX_CHECK_FINDINGS);
  if (r.more !== undefined) {
    if (Number.isInteger(r.more) && r.more > 0) more += r.more;
    else if (r.more !== 0) unknown = true;
  }
  const cut = r.partial === true ? true : r.partial === undefined || r.partial === false ? undefined : null;
  return {
    ran: true, pages: r.pages, findings: found.slice(0, MAX_CHECK_FINDINGS),
    ...(more ? { more } : {}), ...(unread ? { unread } : {}), ...(unknown ? { unknown: true } : {}), ...(cut !== undefined ? { cut } : {}),
  };
}

/**
 * THE EVIDENCE, FROM WHAT THE PUBLISH ITSELF HAD: the compile's render report
 * (`render`, read whole — a clean report included, which the wire otherwise
 * drops), the version it activated, whether activation answered ok, and how
 * many of the change's style rules were checked. Never throws.
 */
export function checksOf({ render = null, version = "", published = false, cssChecked = 0, draft = false, revision = 0, preview = null } = {}) {
  const css = Number.isInteger(cssChecked) && cssChecked > 0 ? cssChecked : 0;
  const saved = draft === true && published !== true;
  return {
    compiled: true,
    browser: browserOf(render),
    ...(css ? { css } : {}),
    published: published === true,
    // SAVED AS THE SITE'S DRAFT (draft-first, 2026-10-15): not published, by
    // design, until the owner presses Publish — never a failure to publish.
    ...(saved ? { draft: true } : {}),
    // …AS WHICH REVISION, AND WHETHER ITS PREVIEW IS KNOWN UP TO DATE
    // (2026-10-16): `ready` once the preview is confirmed on the draft's
    // version, `pending` while an upload is unconfirmed (the tick finishes it).
    ...(saved && Number.isSafeInteger(revision) && revision > 0 ? { revision } : {}),
    ...(saved && (preview === "ready" || preview === "pending") ? { preview } : {}),
    ...(typeof version === "string" && VERSION.test(version) ? { version } : {}),
  };
}

const posInt = (n) => Number.isInteger(n) && n > 0;
/**
 * THE EVIDENCE AS AN ANSWER CARRIES IT, read strictly: anything that is not
 * exactly this shape is null — cannot-tell is never read as a check that ran,
 * nor as one that did not.
 */
export function readChecks(v) {
  if (!plain(v) || v.compiled !== true || typeof v.published !== "boolean" || !plain(v.browser)) return null;
  const b = v.browser;
  if (b.ran === true) {
    if (!posInt(b.pages) || !Array.isArray(b.findings) || b.findings.length > MAX_CHECK_FINDINGS) return null;
    if (!b.findings.every((f) => plain(f) && typeof f.kind === "string" && Object.hasOwn(FINDING_SAID, f.kind) && (f.route === undefined || (typeof f.route === "string" && ROUTE.test(f.route))))) return null;
    if (b.more !== undefined && !posInt(b.more)) return null;
    if (b.unread !== undefined && !posInt(b.unread)) return null;
    if (b.unknown !== undefined && b.unknown !== true) return null;
    if (b.cut !== undefined && b.cut !== true && b.cut !== null) return null;
  } else if (b.ran === false || b.ran === null) {
    if (Object.keys(b).length !== 1) return null;
  } else return null;
  if (v.css !== undefined && !posInt(v.css)) return null;
  if (v.draft !== undefined && !(v.draft === true && v.published === false)) return null;
  if (v.revision !== undefined && !(v.draft === true && posInt(v.revision))) return null;
  if (v.preview !== undefined && !(v.draft === true && (v.preview === "ready" || v.preview === "pending"))) return null;
  if (v.version !== undefined && !(typeof v.version === "string" && VERSION.test(v.version))) return null;
  return v;
}

/** Whether a read browser check is CLEAN: it ran, flagged nothing, and nothing it reported is unread or unknown. */
export const browserClean = (b) => !!b && b.ran === true && !b.findings.length && !b.more && !b.unread && !b.unknown;

/**
 * THE ONE SENTENCE FOR THE BROWSER CHECK, from read evidence — the final
 * reply's fact and the progress record's milestone both say this, so the two
 * can never disagree.
 */
export function browserSaid(b) {
  if (b.ran === false) return "The automated check that opens the pages in a browser could not run, so nothing checked how the pages load.";
  if (b.ran === null) return "An automated check in a browser was reported, but its result could not be read, so whether it ran and what it found are not known. It is not known to be clean.";
  const opened = "An automated check opened " + (b.pages === 1 ? "the page" : b.pages + " pages") + " in a browser"
    + (b.cut === true ? " and was cut short before it finished, so not every page was checked" : b.cut === null ? "; whether it reached every page could not be read" : "");
  if (browserClean(b)) {
    return opened + (b.cut === true ? ". On the pages it reached it" : ". It") + " flagged none of what it looks for (" + listOf(LOOKS_FOR.map((k) => FINDING_SAID[k])) + "). It is automated: nobody looked at the design.";
  }
  const parts = [];
  if (b.findings.length || b.more) {
    const by = new Map();
    for (const f of b.findings) {
      const where = f.route || "a page whose address could not be read";
      if (!by.has(f.kind)) by.set(f.kind, []);
      if (!by.get(f.kind).includes(where)) by.get(f.kind).push(where);
    }
    const said = [...by].map(([k, at]) => FINDING_SAID[k] + " (" + listOf(at) + ")");
    parts.push("It flagged " + (said.length ? listOf(said) + (b.more ? ", and " + count(b.more, "more finding") + " not listed here" : "") : count(b.more, "finding") + " not listed here"));
  }
  if (b.unread) parts.push((b.unread === 1 ? "One finding it reported" : b.unread + " findings it reported") + " could not be read, so what " + (b.unread === 1 ? "it was" : "they were") + " is not known");
  if (b.unknown) parts.push(b.findings.length || b.more || b.unread ? "Part of what it found could not be read, so whether it flagged more is not known" : "What it found could not be read, so whether it flagged anything is not known");
  return opened + ". " + parts.join(". ") + (b.unread || b.unknown ? ". It is not known to be clean" : "") + ". It is automated: nobody looked at the design.";
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
  add(COMPILED_SAID);
  add(browserSaid(c.browser));
  if (c.css) add(cssSaid(c.css));
  add(c.published
    ? "Published: the new version is now the one the site's address is set to serve. Nobody opened the live address afterwards to confirm it."
    : c.draft === true
      ? draftSaid(c)
      : "Not published: the version this made is not the one the site's address serves.");
  return out;
}
export const DRAFT_SAID = "Saved as a draft: the change is in the site's draft and its preview, and the live site is unchanged until the owner presses Publish.";
/** …and while its preview is not yet confirmed on it (2026-10-16). */
export const DRAFT_PENDING_SAID = "Saved as a draft: the change is in the site's draft, and the live site is unchanged until the owner presses Publish. The preview is still being brought up to date, so for a few minutes it may show the version before this one.";
/** The draft sentence for read evidence: its revision when known, and the preview as far as it is known. */
export function draftSaid(c) {
  const base = c && c.preview === "pending" ? DRAFT_PENDING_SAID : DRAFT_SAID;
  return c && posInt(c.revision) ? base.replace("Saved as a draft:", "Saved as draft revision " + c.revision + ":") : base;
}
export const COMPILED_SAID = "The site's code compiled without errors. Compiling checks that the code fits together; it is not a look at any page.";
export const cssSaid = (n) => (n === 1 ? "The one style rule" : "Each of the " + n + " style rules") + " this change wrote was checked to match something on the page.";

/**
 * AN ANSWER STORED BEFORE THE EVIDENCE EXISTED carries only the render report,
 * and only when the check failed or found something: what it flagged, or that
 * it could not run, is said; nothing about the compile or the publish, which
 * that answer does not record.
 */
export function browserOnlyFacts(render) {
  if (render === null || render === undefined) return [];
  return [{ kind: "check", text: browserSaid(browserOf(render)) }];
}

/**
 * A RECONCILED ANSWER'S DRAFT FACTS (2026-10-16), read strictly, or null: a
 * job whose own draft revision proved its save after its answer was lost.
 * Saved, not published; the preview `ready`, `pending` or `unknown`.
 */
export function savedDraftOf(d) {
  if (!plain(d) || d.published !== false) return null;
  if (!posInt(d.revision) || !Number.isSafeInteger(d.revision)) return null;
  if (typeof d.version !== "string" || !VERSION.test(d.version)) return null;
  const preview = d.preview === "ready" || d.preview === "pending" ? d.preview : "unknown";
  return { revision: d.revision, version: d.version, preview };
}
/** The facts said for such an answer: what is known, and nothing it does not know. */
export function savedDraftFacts(d) {
  return [
    { kind: "changed", text: "Saved the change as draft revision " + d.revision + "; what it changed was not recorded, because the answer was lost after the save landed." },
    { kind: "check", text: d.preview === "ready" ? DRAFT_SAID.replace("Saved as a draft:", "Saved as draft revision " + d.revision + ":")
      : d.preview === "pending" ? DRAFT_PENDING_SAID.replace("Saved as a draft:", "Saved as draft revision " + d.revision + ":")
      : "Saved as draft revision " + d.revision + ": the live site is unchanged until the owner presses Publish. Whether the preview shows it yet is not known." },
  ];
}
