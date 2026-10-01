// The canary's add-on press (2026-10-01): what it posts when the press expects
// the add-on step, and how it reads the answer.
//
// WHY. The owner's rule is "Add will always go in addon", and the canary could
// not press an addition: its one paid request refused any routing answer that
// was not an edit with a layer (Test 11's preparation). So an addition — the
// `row` kind adding one entry to a list the site already stores — could only
// be shown by a person typing into the app.
//
// OPT-IN, BY THE ROUTE BOX ALONE. A press posts to the add-on route only when
// its expected route says `intent=addon` AND the router answered `addon`; every
// other press is refused or posted exactly as before. The expectation is
// checked by `canary-route.mjs` like any other, so an answer that is not the
// add-on step is refused before anything is posted. Nothing here knows a site,
// a table or a sentence.
//
// Its own module because the script spends money at top level and cannot be
// imported by a test — `canary-watch.mjs`'s reason.

/** Whether this press expects the add-on step: the route box's own `intent`. */
export function expectsAddon(expect) {
  return !!(expect && typeof expect === "object" && expect.intent === "addon");
}

/**
 * THE ADD-ON POST, AS THE BROWSER SENDS IT (`siteAddon` in `public/chat.js`):
 * the instruction, a retry key minted once for this request, the zone, and
 * what the router held back. No model is named, so the route uses the
 * platform's default, as the edit POST beside it does.
 */
export function addonBody({ instruction, idem, tz, alsoAsked } = {}) {
  return {
    instruction: String(instruction || ""),
    idem: String(idem || ""),
    tz: typeof tz === "string" && tz ? tz : undefined,
    alsoAsked: typeof alsoAsked === "string" && alsoAsked ? alsoAsked : undefined,
  };
}

/** The page paths an answer wrote — added, changed or removed. Empty for an entry-only addition. */
export function addonPages(body) {
  const b = body && typeof body === "object" ? body : {};
  const list = (k) => (Array.isArray(b[k]) ? b[k] : []).filter((x) => typeof x === "string" && x);
  return [...list("added"), ...list("changed"), ...list("removed")];
}

/**
 * Did the addition PUBLISH? Only an `ok` answer that wrote a page did. An
 * entry-only addition (the `row` kind) and a pageless one (a job, an internal
 * function) publish nothing, so the after-read must find every page still at
 * the version the before-read saw.
 */
export function addonPublished(body) {
  return !!(body && body.ok === true && addonPages(body).length > 0);
}

/** The entries the database saved, as the log prints them: `loaves #12 “Rye & Caraway”`. */
export function savedSaid(body) {
  const rows = body && Array.isArray(body.rows) ? body.rows : [];
  return rows.filter((r) => r && typeof r.table === "string" && r.table)
    .map((r) => r.table + (Number.isSafeInteger(r.id) ? " #" + r.id : "") + (typeof r.label === "string" && r.label ? " “" + r.label + "”" : ""))
    .join(", ");
}

/**
 * AN ANSWER THAT IS ENTRIES ONLY — the `row` kind and nothing beside it. Its
 * whole claim is the entries it saved; it writes no page.
 */
export function entriesOnly(body) {
  return !!(body && Array.isArray(body.kinds) && body.kinds.length === 1 && body.kinds[0] === "row");
}

/**
 * EVERY ENTRY THE ANSWER SAYS IT SAVED, AS SAVED: a non-empty `rows` whose
 * every item names its table and carries the row the database stored. An
 * empty list, a missing one, or any item that is not a saved entry is not.
 */
export function savedEntries(body) {
  const rows = body && Array.isArray(body.rows) ? body.rows : [];
  const good = rows.filter((r) => r && typeof r === "object" && typeof r.table === "string" && r.table
    && r.row && typeof r.row === "object" && !Array.isArray(r.row));
  return rows.length > 0 && good.length === rows.length;
}

/**
 * THE VERDICT ON THE ADD-ON PRESS: `{ pass, line }`, from the answer AND the
 * after-read.
 *
 * THREE THINGS MUST HOLD, and the first that does not is the line:
 *
 *   1. THE STEP ANSWERED OK. A terminal answer is not a pass, the edit press's
 *      own lesson.
 *   2. AN ENTRIES-ONLY ANSWER NAMES EVERY ENTRY IT SAVED (2026-10-01, the review
 *      of f6532d66): a "success" for the `row` kind with no saved entry in it
 *      claims an addition it cannot show, whatever its words say.
 *   3. THE AFTER-READ VERIFIED (`afterReadVerdict`, passed in as
 *      `{ verified, sentence }`): every page read at the version the answer
 *      implies — the before-read's for one that published nothing, the job's
 *      own for one that did. Until that review the press printed the verdict
 *      and exited 0 whatever it said; an after-read that did not verify means
 *      the comparison is not about this job, and that is not a pass.
 *
 * A pageless addition that verified — a job, an internal function — passes as
 * before. What it did is stated beside the verdict: the entries saved, the
 * pages written.
 */
export function addonVerdict(body, after) {
  if (!body || typeof body !== "object") return { pass: false, line: "CANARY FAILED: the add-on step left no stored answer to read." };
  if (body.ok !== true) {
    const why = typeof body.error === "string" && body.error ? body.error : (typeof body.reason === "string" ? body.reason : "no reason");
    return { pass: false, line: `CANARY FAILED: the add-on step answered ${JSON.stringify(why)}${typeof body.msg === "string" && body.msg ? " — " + body.msg : ""}. This is a completed round trip that added nothing. Do not read it as a pass.` };
  }
  const saved = savedSaid(body);
  const pages = addonPages(body);
  const what = `${saved ? "saved " + saved : "no entry saved"}; ${pages.length ? "pages written: " + pages.join(", ") : "no page published"}${body.repeat === true ? "; a repeat of a request already saved" : ""}; cost=${body.cost ?? "?"}`;
  if (entriesOnly(body) && !savedEntries(body)) {
    return { pass: false, line: `CANARY FAILED: the add-on step answered ok for an entry and reported no saved entry it can show — ${what}. An addition that names nothing it saved is not a pass.` };
  }
  const a = after && typeof after === "object" ? after : null;
  if (!a || a.verified !== true) {
    const said = a && typeof a.sentence === "string" && a.sentence ? a.sentence : "UNVERIFIED — no after-read verdict was given";
    return { pass: false, line: `CANARY FAILED: the add-on step answered ok — ${what} — but the after-read did not verify: ${said}. The comparison is not about this job; do not read it as a pass.` };
  }
  return { pass: true, line: `CANARY PASSED: the add-on step answered ok — ${what}` };
}
