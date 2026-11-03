// PARKED (2026-11-03, park-old-way): the old-way half of test/addon-uncapped.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
// NO ADD-ON LIMITS (owner, 2026-10-24: "No addon limits"; earlier, 2026-09-02:
// "no limit on things that can be added").
//
// Found live on driftwood-and-daughters (2026-10-24): the add-on step's caps,
// applied per kind and independently, kept the Hire and Events pages and
// dropped the tables behind their forms, and the header/footer item asked for
// beside them was set aside twice and then lost. These guards hold:
//   1. an addition of nine pages, twelve tables and several functions keeps
//      every one, through the cleaner and through the real route, with the
//      pages written by parallel page writers (`ADD_PAGE_BATCH` a writer);
//   2. the frame asked for beside a table is handed on to the menu editor as an
//      addition in the same request (`frameHop`, `frameFollowOn`), even when its
//      words are the whole part's;
//   3. the reply promises a held entry as "its own part" only when the request
//      can carve it (`heldFacts`).
// No model is called: every answer is a stub wire.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  cleanAdd, foldAdds, mergePageBatches, pageBatchDirectives, ADD_PAGE_BATCH, UNCAPPED,
  MAX_ADDS, MAX_ADD_PAGES, MAX_ADD_COMPONENTS, MAX_ADD_TABLES, MAX_ADD_ROWS, MAX_ADD_FUNCTIONS,
  MAX_SECTIONS, MAX_OWN_PHOTOS, MAX_ADD_WORDS, MAX_ADD_MANIFEST, addRefusal, addTool,
} from "../../../builder/site-add.mjs";
import { frameFollowOn } from "../../../builder/request.mjs";
import { COMPONENT_MENU } from "../../../builder/site-plan.mjs";
import { MAX_PAGES as WRITER_KEEPS } from "../../../builder/page-gen.mjs";
import { addonReplyFacts } from "../../../builder/site-reply.mjs";
import { addon, writtenPage, storedPage } from "../../../test/fixtures/addon-route.mjs";

const W = readFileSync(new URL("../../../worker.js", import.meta.url), "utf8");
const at = (src, s, what) => { const i = src.indexOf(s); assert.ok(i >= 0, what + ": landmark " + JSON.stringify(s) + " is gone"); return i; };

const SITE = { pages: ["/"], tables: [], hasDatabase: true, kind: "site" };
const PAGES = Array.from({ length: 9 }, (_, i) => ({ path: "/p" + i, name: "Page " + i, purpose: "page " + i, sections: ["a band"], components: ["card"] }));
const TABLES = Array.from({ length: 12 }, (_, i) => ({ table: { name: "list_" + i, access: "collect", columns: [{ name: "name", type: "text" }] } }));
const FUNCTIONS = Array.from({ length: 8 }, (_, i) => ({ name: "count_" + i, returns: "void", internal: true, body: "BEGIN PERFORM 1; END;" }));

test("the route runs the page writers in parallel, one per batch, and merges them before anything reads the pages", () => {
  const g = at(W, "const aBatchGot = await Promise.all(aBatchDirs.map(", "parallel writers");
  const call = at(W, "aGen = await generateSitePages(env, briefWithLayout({", "page call");
  const merge = at(W, "aGen = mergePageBatches(aBatchGot);", "merge");
  const read = at(W, "aPagesWrote = aGen && aGen.input", "pages read");
  assert.ok(g < call && call < merge && merge < read, "the writers, their merge and the read are out of order");
});

const rec = (message) => ({ message, parts: [{ n: 0, words: message, parent: null, needs: [], held: [], source: "message", route: { op: "addon", hops: 0 } }] });
