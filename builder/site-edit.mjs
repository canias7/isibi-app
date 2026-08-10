// An edit changes exactly what was asked for, and nothing else.
//
// THE OWNER'S RULE (2026-08-10), and it resolves two defects that are mirror
// images of each other. Measured on the live route before this existed:
//
//   `brand` and `description` moved when NOBODY asked. Neither had a prior
//   anchor — `(designed && designed.brand) || body.brand || slug` — and the
//   client sends no brand on a revise, so a designer that had seen only the
//   words "fix the typo in the header" decided what the site was called. It
//   became the <title>, the og:title and the og:description, while the PAGES
//   kept the real name (a revise hands them back as byte-identical edits). So
//   the tab and the link preview disagreed with the page.
//
//   `theme`, `family`, `structure` and `fonts` could NOT move even when asked.
//   They were hard-anchored to the stored look on 2026-08-08 to stop "make the
//   background yellow" re-rolling a barber shop into a different site — a real
//   fix that removed the capability rather than bounding it, so "make it look
//   like a newspaper" did nothing at all to a live site.
//
// ABSENT MEANS UNCHANGED, AND NEVER "RESTATE WHAT YOU ARE KEEPING". That is the
// load-bearing decision. A model asked to return the same value unless told
// otherwise will eventually return a slightly different one, and nothing
// notices — which is exactly how the look re-rolled in the first place.
// Omission cannot drift, because there is no value to get subtly wrong. It is
// also cheaper: a one-colour edit returns one field instead of a whole design.
// `tables` and `tokens` already worked this way, and they were the only two
// layers that behaved correctly on an edit.
//
// Plain module with no I/O, like `site-ask.mjs` and `publish-pages.mjs`, so the
// whole decision is tested without a Worker, a model or a database.

/** The look/identity fields an edit may move. `tables` and `tokens` merge on their own paths. */
export const EDIT_FIELDS = ["brand", "description", "theme", "family", "structure", "fonts"];

/**
 * Nothing is required of an EDIT.
 *
 * The build tool requires brand/slug/tables/seed/description/theme/family, which
 * is right for a first build and is the direct opposite of what an edit needs:
 * a required field is one the model must answer, and answering it is what moves
 * a value nobody asked to move. Sent as the tool's `required` on an edit only,
 * so a first build is byte-identical to what it has always sent.
 */
export const EDIT_REQUIRED = [];

const str = (v) => (typeof v === "string" ? v.trim() : "");

/**
 * WHAT THE SITE IS NOW, in the user message.
 *
 * The designer was never told an edit was an edit — `brief = body.instruction`,
 * same system prompt, same required fields — so it believed it was designing a
 * site from scratch out of a fragment. It cannot tell "change this" from "this
 * is already so" without being shown the current values, and a rule to omit what
 * is unchanged is unusable if it does not know what is unchanged.
 *
 * IN THE USER MESSAGE, never the cached system or tool block: this varies per
 * site, and putting it in the cached prefix would miss the ~10,800-token cache
 * on every single build. Same reasoning as the layout directive and attachments.
 *
 * NAMES ONLY for tables — the designer needs to know what exists, and the rows
 * of a `collect` table are customer names and phone numbers.
 */
export function currentStateNote(current) {
  const c = current && typeof current === "object" ? current : {};
  const lines = [];
  const add = (label, v) => { const s = str(v); if (s) lines.push(label + ": " + s.slice(0, 300)); };
  add("name", c.brand);
  add("one-line description", c.description);
  add("theme", c.theme);
  add("family", c.family);
  add("structure", c.structure);
  const f = c.fonts && typeof c.fonts === "object" ? c.fonts : null;
  if (f && str(f.heading) && str(f.body)) lines.push("fonts: " + str(f.heading) + " for headings, " + str(f.body) + " for body");
  const tables = Array.isArray(c.tables) ? c.tables.map(str).filter(Boolean).slice(0, 24) : [];
  if (tables.length) lines.push("tables it already has: " + tables.join(", "));
  if (!lines.length) return "";
  return "\n\nTHE SITE AS IT IS NOW\n" + lines.join("\n");
}

/**
 * The rule, stated to the model in the terms the merge actually implements.
 *
 * The three sentences do different jobs and none is decoration. The first says
 * omission is the mechanism. The second kills the restatement habit explicitly,
 * because a model's instinct on a structured tool is to fill the fields in. The
 * third names the case that caused the original bug — a colour change — and
 * says what a correct answer to it looks like, because that is the one this has
 * to get right or it reopens what anchoring was introduced to fix.
 */
export const EDIT_RULE =
  "\n\nTHIS IS AN EDIT, NOT A NEW SITE\n" +
  "Return ONLY the fields this change actually asks you to alter. Omit every other field — an omitted field keeps " +
  "exactly what the site has now, and that is how you say \"leave it alone\".\n" +
  "DO NOT RESTATE A VALUE TO KEEP IT. Naming the theme it already has achieves nothing, and naming a DIFFERENT one " +
  "re-themes the entire site — so if the change is not about the look, return no theme, no family, no structure and " +
  "no fonts at all. The same for the name and the description: leave them out unless this change is about them.\n" +
  "A change to a colour is `tokens` and nothing else. A change to the wording is neither — the pages are edited " +
  "elsewhere, so return no tables and no seed for it. Only declare a table when this change genuinely needs one " +
  "stored, and then declare only that table; the ones it already has are kept for you.";

/**
 * Stored-unless-named, for the six fields an edit may move.
 *
 * `instructed` IS A SAFETY INTERLOCK, NOT A FLAG FOR TIDINESS. The new
 * precedence — the designer's answer beating the stored value — is only sound
 * because the designer was TOLD to omit what it is keeping. If that instruction
 * did not reach it (no current state could be read, a first build, an older
 * caller), the model is answering the way it always did, and preferring that
 * answer would re-roll the look on every edit. So without `instructed` this
 * keeps the previous precedence exactly: stored first.
 *
 * The direction of the failure is the point. Being wrong toward "stored" costs
 * an edit that does not take effect, which the customer can see and say again.
 * Being wrong toward "designed" silently re-themes a live site.
 */
export function mergeLook(prior, designed, body, { instructed = false } = {}) {
  const p = prior && typeof prior === "object" ? prior : {};
  const d = designed && typeof designed === "object" ? designed : {};
  const b = body && typeof body === "object" ? body : {};
  const out = {};
  for (const k of EDIT_FIELDS) {
    const order = instructed ? [d[k], p[k], b[k]] : [p[k], d[k], b[k]];
    out[k] = order.find((v) => hasValue(v)) ?? null;
  }
  return out;
}

/**
 * What counts as NAMED.
 *
 * An empty string and an empty object are how a model says nothing while
 * appearing to answer, and treating either as a value is how "" becomes the
 * site's name. `fonts` is the object case: `{}` and `{heading:"x"}` are both
 * absent, because a half pair reaching the build silently defaults the other
 * face — the same reason `themeFontPair` refuses one.
 */
export function hasValue(v) {
  if (v == null) return false;
  if (typeof v === "string") return v.trim() !== "";
  if (typeof v === "object") {
    if (Array.isArray(v)) return v.length > 0;
    const h = typeof v.heading === "string" ? v.heading.trim() : "";
    const b = typeof v.body === "string" ? v.body.trim() : "";
    if ("heading" in v || "body" in v) return !!(h && b);
    return Object.keys(v).length > 0;
  }
  return true;
}

/**
 * Which of the six an edit actually moved — for the reply and for the trace.
 *
 * A customer who asks for one thing and gets four changed has no way to see
 * that from the site alone, and neither has anybody reading a log. Compares the
 * merged result against what was stored, so it reports what CHANGED rather than
 * what the model happened to mention.
 */
export function movedFields(prior, merged) {
  const p = prior && typeof prior === "object" ? prior : {};
  const m = merged && typeof merged === "object" ? merged : {};
  return EDIT_FIELDS.filter((k) => {
    const a = p[k], b = m[k];
    if (!hasValue(a) && !hasValue(b)) return false;
    return JSON.stringify(a ?? null) !== JSON.stringify(b ?? null);
  });
}
