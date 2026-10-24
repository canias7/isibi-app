// THE VISUAL REVIEW — a model LOOKS at the built site once, before publish.
//
// Owner-approved idea #10 (2026-10-22): the render check (`render-check.mjs`)
// opens every route at two widths and reports BREAKAGE only — a thrown page, a
// blank page, an unreadable overlay. Nothing showed a model what the site
// looks like, and nothing fixed what looks wrong. This module is that wire:
// the screenshots the render check took (home plus at most two more routes, at
// phone and desktop width, height-capped) go to the build's own model with the
// pages' source, and its answer is a list of concrete visual problems, each
// with its fix as minimal exact-string edits to that page's source.
//
// PURE: no I/O. The caller hands in `send` (the build's model transport) and
// recompiles what comes back; a failed recompile keeps the original pages —
// the repair pass's rule, "never worse" (`publish-pages.mjs`).
//
// ONE PASS. There is no loop: the second look at a fix is the customer's.
//
// BEHIND A SWITCH, OFF BY DEFAULT: `VISUAL_REVIEW` read the way
// `REQUEST_FLOW` is (`request.mjs`), so a deploy with it off changes nothing.

import { tweakUsage } from "./site-tweak.mjs";
import { applyExactEdits } from "./exact-edits.mjs";
import { routeOf } from "./site-addon.mjs";
import { SHOT_ROUTES, MAX_SHOT_HEIGHT, shotRoutes } from "./site-render.mjs";

/** The switch: an affirmative word turns it on; anything else is off. */
export function visualReviewOn(env) {
  const v = env && env.VISUAL_REVIEW;
  return typeof v === "string" && ["1", "true", "on", "yes"].includes(v.trim().toLowerCase());
}

/**
 * The build repair's switch (ideas #11-#13, `site-repair.mjs`). ON BY DEFAULT
 * since 2026-10-23 (owner: a first build's page that does not compile gets
 * the repair round before the stand-in); `BUILD_REPAIR` set to 0/false/off/no
 * turns it off.
 */
export function buildRepairOn(env) {
  const v = env && env.BUILD_REPAIR;
  return !(typeof v === "string" && ["0", "false", "off", "no"].includes(v.trim().toLowerCase()));
}

export { SHOT_ROUTES, MAX_SHOT_HEIGHT, shotRoutes };
/** Edits accepted from one answer, across all pages — a sanity bound. */
export const MAX_EDITS = 16;
/** Output ceiling for the review call. */
export const REVIEW_MAX_TOKENS = 16000;
/** A page larger than this is not sent (its route is skipped, said so). */
export const MAX_REVIEW_SOURCE = 60000;

export const REVIEW_TOOL = {
  name: "report_visual_problems",
  description: "List every concrete visual problem you can see in the screenshots, each with its fix as exact edits to that page's source. An empty list means nothing looks wrong.",
  input_schema: {
    type: "object",
    properties: {
      problems: {
        type: "array",
        items: {
          type: "object",
          properties: {
            route: { type: "string", description: "The route the problem is on, exactly as labelled (e.g. \"/\")." },
            problem: { type: "string", description: "What looks wrong, where, and at which width." },
            edits: {
              type: "array",
              description: "The fix: each `old` is copied exactly from that page's source and occurs in it exactly once; `new` replaces it.",
              items: {
                type: "object",
                properties: { old: { type: "string" }, new: { type: "string" } },
                required: ["old", "new"],
              },
            },
          },
          required: ["route", "problem", "edits"],
        },
      },
    },
    required: ["problems"],
  },
};

export const REVIEW_RULES =
  "You are reviewing a website that was just built, before it is published. You are shown screenshots of its pages at phone width (375px) and desktop width (1280px), each cut at " + MAX_SHOT_HEIGHT + "px tall, and each page's source.\n\n" +
  "Look for concrete visual problems only: elements overlapping; text cut off, clipped or unreadable; very low contrast between text and its background; huge empty gaps; a page far too long; a layout that is broken at phone width; elements running off the screen; a section that looks unfinished or empty.\n\n" +
  "For each problem, give the fix as the smallest edits to that page's source: each `old` copied exactly from the source and appearing in it exactly once, and its `new`. Change layout and styling only: never change the words, the links, the data, the imports or the route. Do not report matters of taste. If nothing looks wrong, answer with an empty list.";


/** The page whose route is `route`, or null. */
function pageFor(pages, route) {
  for (const p of Array.isArray(pages) ? pages : []) {
    if (p && typeof p.path === "string" && typeof p.source === "string" && routeOf(p.path) === route) return p;
  }
  return null;
}

/** Well-formed shots only: a route, a viewport name, base64 PNG data. */
function usableShots(shots) {
  return (Array.isArray(shots) ? shots : []).filter((s) => s && typeof s.route === "string" && typeof s.viewport === "string" && typeof s.png === "string" && s.png.length > 0);
}

/**
 * The request: the build's model, the screenshots as images, each page's
 * source, and the one tool. `null` when there is nothing to look at.
 */
export function reviewRequest({ shots, pages, model } = {}) {
  const good = usableShots(shots);
  const routes = [];
  for (const s of good) if (!routes.includes(s.route)) routes.push(s.route);
  const content = [];
  const reviewed = [];
  for (const route of routes) {
    const page = pageFor(pages, route);
    if (!page || page.source.length > MAX_REVIEW_SOURCE) continue;
    reviewed.push(route);
    for (const s of good.filter((x) => x.route === route)) {
      content.push({ type: "text", text: "SCREENSHOT: " + route + " at " + s.viewport + " width" + (Number.isFinite(s.height) && s.height > MAX_SHOT_HEIGHT ? " (the page is " + Math.round(s.height) + "px tall; cut at " + MAX_SHOT_HEIGHT + "px)" : "") });
      content.push({ type: "image", source: { type: "base64", media_type: "image/png", data: s.png } });
    }
    content.push({ type: "text", text: "THE SOURCE OF " + route + " (" + page.path + ")\n" + page.source });
  }
  if (!reviewed.length) return null;
  return {
    request: {
      ...(typeof model === "string" && model ? { model } : {}),
      max_tokens: REVIEW_MAX_TOKENS,
      system: REVIEW_RULES,
      tools: [REVIEW_TOOL],
      tool_choice: { type: "tool", name: REVIEW_TOOL.name },
      messages: [{ role: "user", content }],
    },
    reviewed,
  };
}

/**
 * Read the answer and apply it. Each problem's edits apply all or none, in
 * order, on that page's current source; an `old` that is absent or not unique
 * refuses the whole problem. Returns the pages whole (changed or not).
 */
export function readReview(reply, { pages, reviewed } = {}) {
  const list = Array.isArray(pages) ? pages : [];
  const out = { ok: false, none: false, pages: list, changed: [], fixed: [], refused: [] };
  const blocks = reply && Array.isArray(reply.content) ? reply.content : [];
  const use = blocks.find((b) => b && b.type === "tool_use");
  const input = use && use.input && typeof use.input === "object" ? use.input : null;
  if (!input || !Array.isArray(input.problems)) { out.reason = "unreadable"; return out; }
  out.ok = true;
  if (!input.problems.length) { out.none = true; return out; }
  const allowed = new Set(Array.isArray(reviewed) ? reviewed : []);
  const src = new Map();
  let edits = 0;
  for (const p of input.problems) {
    const route = p && typeof p.route === "string" ? p.route : "";
    const problem = p && typeof p.problem === "string" ? p.problem.slice(0, 300) : "";
    const refuse = (reason) => out.refused.push({ route, problem, reason });
    if (!allowed.has(route)) { refuse("not-reviewed"); continue; }
    const page = pageFor(list, route);
    if (!page) { refuse("no-page"); continue; }
    const es = Array.isArray(p.edits) ? p.edits : [];
    if (!es.length) { refuse("no-edits"); continue; }
    if (edits + es.length > MAX_EDITS) { refuse("too-many-edits"); continue; }
    let s = src.has(page.path) ? src.get(page.path) : page.source;
    const applied = applyExactEdits(s, es);
    if (!applied.ok) { refuse(applied.reason); continue; }
    s = applied.source;
    if (s === (src.has(page.path) ? src.get(page.path) : page.source)) { refuse("no-change"); continue; }
    edits += es.length;
    src.set(page.path, s);
    out.fixed.push({ route, problem });
  }
  for (const [p, s] of src) { const orig = list.find((x) => x && x.path === p); if (orig && orig.source !== s) out.changed.push(p); }
  if (out.changed.length) out.pages = list.map((p) => (p && src.has(p.path) ? { ...p, source: src.get(p.path) } : p));
  return out;
}

/**
 * The whole pass, NEVER THROWS: build the request, send it once, read it.
 * The usage rides back on every path where a call was made, so the build's
 * one `pageCredits` rounding prices it.
 */
export async function runVisualReview({ shots, pages, send, model } = {}) {
  const list = Array.isArray(pages) ? pages : [];
  const base = { pages: list, changed: [], fixed: [], refused: [], usage: null, none: false };
  if (typeof send !== "function") return { ...base, reason: "off" };
  let built;
  try { built = reviewRequest({ shots, pages: list, model }); } catch { built = null; }
  if (!built) return { ...base, reason: "nothing-to-look-at" };
  let reply;
  try { reply = await send(built.request); } catch (e) { return { ...base, reason: "send", error: String((e && e.message) || e).slice(0, 200) }; }
  const usage = tweakUsage(reply, built.request.model || (reply && reply.model) || "");
  let read;
  try { read = readReview(reply, { pages: list, reviewed: built.reviewed }); } catch { read = { ok: false, reason: "unreadable", pages: list, changed: [], fixed: [], refused: [], none: false }; }
  return { pages: read.pages, changed: read.changed, fixed: read.fixed, refused: read.refused, none: read.none, usage, reviewed: built.reviewed, ...(read.ok ? {} : { reason: read.reason }) };
}
