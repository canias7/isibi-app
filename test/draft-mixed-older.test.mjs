// CODE AND HELD CHANGES SAVED BEHIND A NEWER DRAFT (2026-10-16, Codex's
// reproduction on `99021708`).
//
// An add-on that makes a page AND a table on a published site saves one draft
// revision carrying both: its code version and its held schema. If another
// task saved a newer draft first, `saveDraftRecord` used to keep the add-on's
// code in the history only and still write a revision of its held schema on
// the NEWER code — and `saveAsDraft` committed and billed the job as done.
// Publish would then have created the table with no page that uses it.
//
//   DMO1  through the real request driver and the real add-on job: the
//         add-on's first save meets a newer draft (another task's, saved
//         between its mint and its save) — it is refused `older`, nothing is
//         written to the draft, it is refunded; the part runs again ALONE, on
//         the newer draft, and is saved as one revision carrying its page and
//         its held schema ONCE; every queue message is delivered twice; then
//         Publish of that revision makes the page live and creates the table
//         exactly once, and a repeated click redoes nothing; the add-on is
//         charged once.
//   DMO2  `mintAfter`: a version always sorts after the draft's, so a re-run
//         minted by a clock behind the other isolate's still wins.
import test from "node:test";
import assert from "node:assert/strict";
import { platform, sendMessage, pump, tick, call, T } from "./fixtures/request-flow.mjs";
import { blockNetwork } from "./fixtures/no-network.mjs";
import { installCompiler } from "./fixtures/cf-containers.mjs";
import { page as pageSrc } from "./fixtures/live-ask.mjs";
import { rowsDb, BAKERY_LOAVES, LOAF_COLUMNS } from "./fixtures/rows-db.mjs";
import { writtenPage } from "./fixtures/addon-route.mjs";
import { DRAFT_KEY, HELD_KEY, mintAfter } from "../site-draft.mjs";
import { buildPrefix, STATE_DIR } from "../site-builds.mjs";

blockNetwork();

const bare = (t) => (t == null ? t : String(t).replace(/\n[ \t]+$/, ""));
const TT_FROM = "Follow us on TikTok at @oldloaf";
const TT_TO = "Follow us on TikTok at @harbourloaf";
const HOME = pageSrc("/", "<section className=\"hero\"><h1>Harbour Loaf</h1></section>");
const VISIT = pageSrc("/visit", "<section className=\"come\"><h1>Come to the bakery</h1><p>" + TT_FROM + "</p></section>");
const LOAVES = { name: "loaves", columns: [{ name: "name", type: "text" }, { name: "description", type: "text" }, { name: "price", type: "numeric" }, { name: "photo", type: "text" }], read: "public", write: "none" };
const ROUTE_TEXT = { intent: "edit", layer: "text", page: "/visit", targets: [{ change: 0, writes: ["page:/visit"] }] };
const SIGNUP = "Add a sign-up page where people leave their name and email address.";
const PAGE = (path, name) => ({ path, name, purpose: "what " + name + " is for", sections: ["a band"], components: ["section-header"] });
const said = (args) => String(args.messages[0].content);
const lineId = (args, file, line) => {
  const at = said(args).split("\n").find((l) => l.includes("[" + file + "] " + line));
  return Number(String(at || "-1.").split(".")[0]);
};

test("DMO2 A VERSION SORTS AFTER THE DRAFT'S — minted by a clock an hour behind, `mintAfter` still answers one millisecond past the draft; with no draft or an unreadable one it is the plain clock", () => {
  const draft = "01790600000000-bbbbbb";
  const behind = 1790600000000 - 3_600_000;
  const v = mintAfter(draft, behind, "zzzzzz");
  assert.equal(v, "01790600000001-zzzzzz");
  assert.ok(v > draft);
  assert.equal(mintAfter("", 1790600000000, "aaaaaa"), "01790600000000-aaaaaa");
  assert.equal(mintAfter("not-a-version", 1790600000000, "aaaaaa"), "01790600000000-aaaaaa");
  assert.equal(mintAfter(draft, 1790700000000, "cccccc"), "01790700000000-cccccc", "a clock ahead of the draft keeps its own time");
});

test("DMO3 A HELD SCHEMA THAT WAS NEVER SAVED READS AS NOTHING CHANGED — an answer carrying only its `discarded` record is `none`; the applied record still reads as partial (control)", async () => {
  const { outcomeOf } = await import("../builder/site-reply.mjs");
  assert.deepEqual(outcomeOf({ ok: false, error: "reconciled", migration: { status: "discarded", tables: ["signups"] } }), { state: "none", published: false, database: "none" });
  assert.deepEqual(outcomeOf({ ok: false, error: "reconciled", migration: { status: "applied_without_page", tables: ["signups"] } }), { state: "partial", published: false, database: "applied" });
});
