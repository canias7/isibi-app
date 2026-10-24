// SUPPLIED TWEAK ANSWERS IN THE SHAPE THE TOOL NOW ASKS FOR (2026-10-23, idea #18).
//
// The tweak rung's tool (`write_tweak`) answers with exact `{old, new}` edits,
// not the whole file. Many route tests state a tweak's outcome as the file it
// should produce; this turns that file into the one minimal exact edit a model
// would send (the differing span, widened until its `old` occurs exactly
// once), so the fixture still says what the page becomes and the route
// receives what the tool really returns.

import { occurrences } from "../../builder/exact-edits.mjs";
import { CONTEXT_HEADING, PART_HEADING } from "../../builder/site-ask.mjs";

/** The one exact edit that turns `before` into `after`. */
export function editsFrom(before, after) {
  const b = String(before), a = String(after);
  let p = 0;
  const min = Math.min(b.length, a.length);
  while (p < min && b[p] === a[p]) p++;
  let q = 0;
  while (q < min - p && b[b.length - 1 - q] === a[a.length - 1 - q]) q++;
  let lo = p, hiB = b.length - q, hiA = a.length - q;
  while ((hiB - lo === 0 || occurrences(b, b.slice(lo, hiB)) !== 1) && (lo > 0 || hiB < b.length)) {
    if (lo > 0) lo--;
    if (hiB < b.length) { hiB++; hiA++; }
  }
  return [{ old: b.slice(lo, hiB), new: a.slice(lo, hiA) }];
}

/** The file a tweak request carries (`tweakRequest`'s user message). */
export function fileOf(req) {
  // The first message carrying the file (an OpenAI-shaped request puts the system first).
  const m = (req && Array.isArray(req.messages) ? req.messages : []).find((x) => x && typeof x.content === "string" && x.content.includes("\n\nTHE FILE ("));
  const text = m ? m.content : "";
  const at = text.indexOf("\n\nTHE FILE (");
  if (at < 0) return null;
  const nl = text.indexOf(")\n", at);
  if (nl < 0) return null;
  // The answers section a resumed request appends after the file (`withContext`) is not the file.
  // So is the whole request a part came from (`PART_HEADING`), appended the same way.
  let file = text.slice(nl + 2);
  for (const h of [CONTEXT_HEADING, PART_HEADING]) {
    const at2 = file.indexOf("\n\n" + h);
    if (at2 >= 0) file = file.slice(0, at2);
  }
  return file;
}

/** A supplied `{source}` answer as the `{edits}` the tool returns; anything else unchanged. */
export function asEdits(input, before) {
  if (!input || typeof input !== "object" || typeof input.source !== "string" || before == null) return input;
  const { source, ...rest } = input;
  // An empty `source` beside a question or a refusal carried no file.
  if (source === "") return rest;
  return { ...rest, edits: editsFrom(before, source) };
}

/** A whole reply whose tool input is turned by `asEdits` against `before`. */
export function asEditsReply(reply, before) {
  if (!reply || !Array.isArray(reply.content)) return reply;
  return { ...reply, content: reply.content.map((b) => (b && b.type === "tool_use" ? { ...b, input: asEdits(b.input, before) } : b)) };
}

/** `asEdits` with the before-file read off the request itself. */
export function tweakInput(input, req) {
  return asEdits(input, fileOf(req));
}
