// AN ADDITION BY WHAT IT WRITES, AND ITS DATABASE MADE BESIDE ITS PAGES
// (2026-10-16, branch `codex-work-into-claude`, after Codex's review of
// `99021708`).
//
//   AB1  the plan (unit): an addition is a config or schema writer by its
//        router targets — two additions of pages overlap; an addition naming a
//        table still waits for a rules step; one naming nothing is the whole
//        site; it holds the publish turn throughout only when it writes the
//        config, or when it runs again alone after an overlap
//   AB2  through the real add-on job: the database is made BESIDE the page
//        writer — the page call is made while the project create is still
//        running — and the addition then lands, one project, charged once
//   AB2b the same with the create failing: the page writer ran, the provision
//        fails, and the answer is the provision's own (nothing published,
//        refunded) — never a page over no database
//   AB3  side by side: an addition cleared without a table (its targets name a
//        page) designs a table while another part of its request is still
//        open — refused `conflict` before anything is made, at no cost; the
//        request runs it again alone, and it lands with its table, once
import test from "node:test";
import assert from "node:assert/strict";
import { platform, sendMessage, settle, pump, tick, T } from "./fixtures/request-flow.mjs";
import { blockNetwork } from "./fixtures/no-network.mjs";
import { installCompiler } from "./fixtures/cf-containers.mjs";
import { page as pageSrc } from "./fixtures/live-ask.mjs";
import { rowsDb, BAKERY_LOAVES, LOAF_COLUMNS } from "./fixtures/rows-db.mjs";
import { writtenPage } from "./fixtures/addon-route.mjs";
import { besideConflict, holdsConfig, writesConfig, writesSchema } from "../builder/request-plan.mjs";

blockNetwork();

const SIGNUP = "Add a sign-up page where people leave their name and email address";
const PAGE = (path, name) => ({ path, name, purpose: "what " + name + " is for", sections: ["a band"], components: ["section-header"] });
const TABLE = { table: [{ table: { name: "signups", access: "collect", columns: [{ name: "name", type: "text" }] }, seed: [] }] };
const until = async (cond, ms = 6000) => { const end = Date.now() + ms; while (Date.now() < end) { if (cond()) return true; await new Promise((ok) => setTimeout(ok, 10)); } return cond(); };

// ── AB1 ─────────────────────────────────────────────────────────────────────

const addon = (writes, extra = {}) => ({ n: 0, needs: [], status: "ready", phase: "run", route: { op: "addon", intent: "addon" }, targets: { writes, reads: [] }, jobs: [], ...extra });
const step = (layer, writes) => ({ n: 1, needs: [], status: "ready", phase: "run", route: { op: "edit", layer }, targets: { writes, reads: [] }, jobs: [] });

test("AB1 AN ADDITION BY ITS TARGETS — two page additions overlap; an addition naming a table waits for a rules step and for another addition naming a table; one naming nothing is the whole site; it holds the turn throughout only when it writes the config or runs again alone", () => {
  const pageA = addon(["new-page:/sign-up"]), pageB = addon(["new-page:/gift-vouchers"]);
  assert.equal(besideConflict(pageA, pageB), false, "two additions of different pages were still kept apart");
  assert.deepEqual([writesConfig(pageA), writesSchema(pageA)], [false, false]);
  assert.equal(holdsConfig(pageA), false, "a page addition still holds the turn from its first read");
  const tableA = addon(["new-page:/sign-up", "new-data:signups"]), tableB = addon(["new-data:bookings"]);
  assert.equal(writesSchema(tableA), true);
  assert.equal(besideConflict(tableA, tableB), true, "two additions that both make tables ran side by side");
  assert.equal(besideConflict(tableA, step("rules", ["data:loaves"])), true, "an addition making a table ran beside a rules step");
  assert.equal(besideConflict(pageA, step("rules", ["data:loaves"])), false, "a page addition was kept from a rules step");
  const blank = addon([]);
  assert.equal(besideConflict(blank, pageB), true, "an addition naming nothing was not the whole site");
  assert.deepEqual([writesConfig(blank), writesSchema(blank), holdsConfig(blank)], [true, true, true]);
  const look = addon(["new-page:/sign-up", "theme"]);
  assert.equal(holdsConfig(look), true, "an addition writing the look does not hold the turn");
  assert.equal(holdsConfig(addon(["new-page:/sign-up"], { serial: true })), true, "an addition running again alone does not hold the turn");
  // A LOOK STEP IS STILL A CONFIG WRITER, AND KEEPS THE TURN.
  assert.equal(besideConflict(step("look", ["theme"]), look), true);
});

// ── AB2 ─────────────────────────────────────────────────────────────────────

function provisioning(name, pageWriter) {
  const compiler = installCompiler();
  const P = platform({
    // A DATABASE THAT ANSWERS SQL ONCE IT IS MADE (empty, as a new one is).
    slug: "ab-" + name + "-" + Math.random().toString(16).slice(2, 8), provisions: true, db: rowsDb({ tables: {} }), balance: 400,
    answers: {
      route: [{ intent: "addon" }],
      [T.adds]: { kinds: ["table", "page"] },
      "add:table": TABLE,
      "add:page": { page: [PAGE("/sign-up", "Sign up")] },
      [T.pages]: pageWriter,
    },
  });
  return { P, compiler };
}

// ── AB3 ─────────────────────────────────────────────────────────────────────

const TT_FROM = "Follow us on TikTok at @oldloaf";
const TT_TO = "Follow us on TikTok at @harbourloaf";
const TIKTOK = "Change our TikTok link on the Visit page to @harbourloaf";
const HOME = pageSrc("/", "<section className=\"hero\"><h1>Harbour Loaf</h1></section>");
const VISIT = pageSrc("/visit", "<section className=\"come\"><h1>Come to the bakery</h1><p>" + TT_FROM + "</p></section>");
const LOAVES = { name: "loaves", columns: [{ name: "name", type: "text" }, { name: "description", type: "text" }, { name: "price", type: "numeric" }, { name: "photo", type: "text" }], read: "public", write: "none" };
const lineId = (args, file, line) => {
  const at = String(args.messages[0].content).split("\n").find((l) => l.includes("[" + file + "] " + line));
  return Number(String(at || "-1.").split(".")[0]);
};
