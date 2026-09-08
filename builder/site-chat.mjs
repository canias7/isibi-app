// WHICH CHAT A SITE BELONGS TO.
//
// Owner, 2026-09-08: "the problem is that is the build gotta stay in that chat,
// not make a new one" → "yeah it should per project type thing right?" → and,
// on the sites that were already loose, "idc abut past stuff, but lets fix
// anything fro future stuff".
//
// THE ID ALREADY EXISTS AND WAS NEVER SENT. `siteCreate` in `public/chat.js`
// mints `site_<epoch-ms>_<5 base36>` per workspace and threads it through every
// call as `origin` — `siteRoute`, `reactSend`, `siteFinishBuild`,
// `applyEditResult` all take it. The server has never seen it. Sending it is
// the whole change; everything here is the shape rule and the two readers that
// need to agree about it.
//
// IT IS CALLED THE CHAT, NOT THE PROJECT, AND THAT IS DELIBERATE. The plan said
// `project_id`; `project` already means a NEON project in this repository —
// `site_project` is a table, `siteNeonProject` is a reader, and the column
// would have sat directly beside `neon_db` on `site_backends`. A reader meeting
// `project_id` there would reasonably take it for the Neon project's id, which
// is the "two names for two different things" hazard rather than the recorded
// "two lists of one thing", and just as silent. `chat_id` is what the owner
// actually said and cannot be confused with anything else here.
//
// So there are three names for one value, each right where it is: the browser's
// `origin` (the workspace a message came from), the wire's `chat`, and
// Postgres's `chat_id`. This module owns the last two.
//
// DEPENDENCY-FREE: the Worker reads it, and so could the container.

/**
 * The column on `site_backends`, spelled ONCE.
 *
 * Two writers (`claimSiteSlug` for a frontend-only build, `saveBackend` for one
 * with a database), one reader for the short-circuit and one for the list. A
 * literal at each would be five copies of a column name — the recorded "two
 * lists of the same thing", where the drift is a build that binds nothing and
 * says nothing.
 */
export const CHAT_COLUMN = "chat_id";

/**
 * What may be stored as a chat id.
 *
 * BOUNDED, NOT PINNED TO TODAY'S MINT. The obvious rule is the mint's own shape
 * — `site_` then digits then five base36 — and it is the wrong one: the mint
 * lives in `public/chat.js`, which the Worker cannot import, so pinning its
 * prefix here means a future mint that drops or changes `site_` stops binding
 * SILENTLY. Builds would keep working and simply stop belonging to their chat,
 * which is this repository's most-recorded failure shape wearing a new hat.
 *
 * So the rule is what a safe identifier is, and a guard DERIVES the real mint
 * out of `chat.js` and asserts it passes — the drift is caught in the suite
 * rather than in production.
 *
 * The floor is 8 because a one-character id is not a mint's output and would
 * collide across chats by accident; the ceiling is 64 because it is a database
 * column and a client sends it.
 */
export const CHAT_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;

/**
 * The chat id on a request, or `""`.
 *
 * REFUSES, NEVER COERCES. `String(["a"])` is `"a"` — shipped as a real bug
 * three times here, on a role, an access level and a language — and this value
 * decides which site a customer is answered with, so a coerced one would bind a
 * site to a chat that does not exist.
 *
 * `""` is the honest answer for anything unusable, and every caller reads it as
 * "this build has no chat", which is exactly what every build did before this
 * existed. That is what keeps an older browser, a harness and a curl working.
 */
export function cleanChatId(v) {
  if (typeof v !== "string") return "";
  const s = v.trim();
  return CHAT_ID_RE.test(s) ? s : "";
}
