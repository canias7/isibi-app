// THE HAND-OVER: what travels when a request moves from one step to another
// (2026-10-02, the whole-router audit's batch 2 — W5, W7, W8, W15, W24).
//
// Owner: *"preserve every part of a mixed request across routing conversions,
// failures, edit/add-on handoffs and escalation to a full rewrite … Use a
// consistent handoff contract across these paths, with models deciding intent
// and code validating and dispatching—no keyword rules or site-specific
// exceptions."*
//
// WORK MOVES IN FIVE PLACES, and before this each carried something different:
// the router's reader turning an edit into an add-on (it kept the held-back
// part and dropped the page and the reason), one edit step handing on to
// another (the page and the held-back part), the edit handing on to the add-on
// (the held-back part; the reason and the part of the site it could not do
// stayed in the reply), the add-on handing on to the menu editor, and the climb
// to the full rewrite (nothing at all: the whole message, held-back part
// included). One contract now, the same three things everywhere:
//
//   held    the parts put off this turn, in the customer's own words — the
//           router's, and any a step put off as the router's net. Every step it
//           reaches takes them out before anything runs (or refuses when it
//           cannot find them), never runs them, and every final reply names
//           them (`deferred`). On the wire it is `alsoAsked`: a string for one
//           part, a list for several (`heldList` in site-ask.mjs).
//   scope   the page the work is about, and the part of the site the step that
//           handed it on could not do. Every step checks the page against the
//           site's real pages.
//   reason  why it moved, from one fixed list (`HAND_REASONS`), and which step
//           it left (`HAND_FROM`). The add-on step's picker and the rewrite's
//           writer are shown it (`handOverLine`); every step records it.
//
// WHAT CODE DECIDES HERE IS ONLY THIS: whether a field is one of the fixed
// values, whether a page is one the site has, and whether a held part is in the
// message. What the customer meant is never read from their words — a model
// decided every part of it (the router, a lane picker, the add-on's picker),
// and this carries that decision to the step that acts on it.

import { EDIT_LAYERS, normalizePagePath } from "./site-ask.mjs";
import { LANE_FIELDS } from "./site-lanes.mjs";
import { ADD_KINDS } from "./site-add.mjs";

/** The steps work can leave: the router's reader, the nine edit steps, the add-on. */
export const HAND_FROM = Object.freeze(["route", ...EDIT_LAYERS, "addon"]);

/**
 * WHY WORK MOVED, and the one line the step it reaches is shown. Every reason
 * a step hands work on with is here: the router's two conversions, every
 * escalation the edit route sends (`escalate(reason, …)` in worker.js) and the
 * add-on's own hand-over and climbs. A reason not on this list is dropped,
 * never passed through: a hand-over cannot widen the list by sending one.
 */
export const HAND_REASONS = Object.freeze({
  // The router's reader (`readEdit` in site-ask.mjs).
  "page-unknown": "the router named a page the site does not have, so the change is an addition on that page",
  "route-unreadable": "the router's answer named no step that could make the change, so the whole message came here",
  // The edit route's escalations.
  addon: "the edit step was asked to add something the site does not have yet",
  build: "the change needs the whole site rebuilt",
  empty: "the edit step was given nothing to change",
  "no-source": "the site's stored pages could not be read",
  "no-backend": "the change needs the site's database, and the site has none",
  "no-meta": "the site's stored lists could not be read",
  "no-data": "the site stores no list holding what was asked about",
  "no-tables": "the change needs a list the site does not store",
  "needs-place": "a new photograph needs a place made for it on the page",
  "too-much-text": "the change touches more of the site's words than the text step rewrites",
  "no-look": "the site's design was never stored, so it can only be changed by a rewrite",
  "needs-pages": "the change needs pages written again",
  // The add-on step's own hand-over to the menu editor.
  layer: "a new item in the frame every page shares is the menu editor's",
});

/** The parts of the site a step may say it could not do: its lanes and the add-on's kinds. */
const HAND_FIELDS = Object.freeze([...new Set([...LANE_FIELDS, ...ADD_KINDS])]);

/**
 * A HAND-OVER AS IT ARRIVED, every field checked on its own: `{ from, reason,
 * field, page }` with only the fields that passed, or `null` when none did.
 *
 *   from    one of `HAND_FROM`
 *   reason  one of `HAND_REASONS`
 *   field   one of the edit steps' lanes or the add-on's kinds
 *   page    a path, in the one spelling pages are compared in — and, when the
 *           caller gives the site's pages, only one of them. A page the site
 *           does not have is left out rather than handed to a step as its
 *           scope; `page-unknown` is the one reason whose page is, by
 *           definition, not on the site, and it keeps it — the add-on step is
 *           being told which page to make.
 *
 * NOTHING IS COERCED: `String(["look"])` is "look", and a field of the wrong
 * type is absent, never turned into one of the right type.
 */
export function readHandOver(raw, { pages = null } = {}) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const out = {};
  if (typeof raw.from === "string" && HAND_FROM.includes(raw.from)) out.from = raw.from;
  if (typeof raw.reason === "string" && Object.hasOwn(HAND_REASONS, raw.reason)) out.reason = raw.reason;
  if (typeof raw.field === "string" && HAND_FIELDS.includes(raw.field)) out.field = raw.field;
  if (typeof raw.page === "string" && raw.page.trim()) {
    const page = normalizePagePath(raw.page);
    const known = Array.isArray(pages) ? pages.map(normalizePagePath).filter(Boolean) : null;
    if (page && (!known || known.includes(page) || out.reason === "page-unknown")) out.page = page;
  }
  return Object.keys(out).length ? out : null;
}

/**
 * THE LINE THE STEP A HAND-OVER REACHES IS SHOWN — what moved it and what it
 * is about, from the fixed list only, so nothing the customer typed and no
 * free text a model wrote ever rides it. `""` for no hand-over.
 */
export function handOverLine(ho) {
  if (!ho || typeof ho !== "object") return "";
  const from = ho.from === "route" ? "the router" : ho.from ? "the " + ho.from + " step" : "";
  const why = ho.reason && Object.hasOwn(HAND_REASONS, ho.reason) ? HAND_REASONS[ho.reason] : "";
  const parts = [];
  if (from || why) parts.push("Handed on" + (from ? " by " + from : "") + (why ? ": " + why : "") + ".");
  if (ho.field) parts.push("The part of the site: " + ho.field + ".");
  if (ho.page) parts.push("The page: " + ho.page + ".");
  return parts.join(" ");
}

/**
 * THE PARTS PUT OFF, AS THE REPLY CARRIES THEM: one string for one part (the
 * shape every reply has had since 2026-09-29), a list for several, nothing for
 * none.
 */
export function deferredOf(parts) {
  const list = Array.isArray(parts) ? parts.filter((p) => typeof p === "string" && p) : [];
  if (!list.length) return undefined;
  return list.length === 1 ? list[0] : list;
}

/**
 * EVERY FINAL REPLY NAMES WHAT WAS PUT OFF (2026-10-02, the audit's W7).
 *
 * The edit and add-on routes said it on a success only: a refusal, a failure
 * of ours or an escalation answered without it, so the part held back went
 * unmentioned whenever the part that ran did not succeed. A route ends in a
 * hundred places; this is the one place they all pass through, so no ending
 * can be missed and none added later can forget it.
 *
 * `parts` is what the route really took out of the message (`heldParts`) and
 * any part a step put off itself — read when the route ends, so a part put off
 * mid-way is included. A JSON reply gets `deferred` unless it already says it;
 * anything else (a receipt before the message was read has nothing to add)
 * passes untouched, and so does a reply whose body cannot be read.
 */
//
// AND WHAT A QUESTION'S REQUEST PUT OFF BEFORE IT (2026-10-02, `earlier`): the
// parts a request resumed from a question carried in, which are not in its
// message, so they are never taken out of it or run. Named on every reply as
// `putOff`, apart from `deferred` — a hop sends `deferred` on as the parts to
// take out of its message, and these are not there to take out.
export async function heldReport(res, parts, earlier) {
  const deferred = deferredOf(parts);
  const putOff = deferredOf(earlier);
  if ((deferred === undefined && putOff === undefined) || !res || !res.headers) return res;
  if (!String(res.headers.get("content-type") || "").includes("application/json")) return res;
  let body;
  try { body = await res.clone().json(); } catch { return res; }
  if (!body || typeof body !== "object" || Array.isArray(body)) return res;
  const out = { ...body };
  let added = false;
  if (deferred !== undefined && !Object.hasOwn(body, "deferred")) { out.deferred = deferred; added = true; }
  if (putOff !== undefined && !Object.hasOwn(body, "putOff")) { out.putOff = putOff; added = true; }
  // NOTHING TO ADD IS THE REPLY AS IT CAME — the same object, never a copy.
  if (!added) return res;
  const headers = new Headers(res.headers);
  headers.delete("content-length");
  return new Response(JSON.stringify(out), { status: res.status, headers });
}
