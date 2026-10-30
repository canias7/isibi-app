// A DELETED SITE LEAVES NOTHING UNDER ITS NAME (2026-10-21, owner: "it should
// delete everything, slug, like literally everything, nothing should be up").
// The leftovers step of `deleteSiteFor` is run against a bucket holding one
// object in every place the app keeps something for a site; afterwards only the
// neighbour whose name merely starts the same may remain.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { siteScope } from "../site-media.mjs";
import { cleanChatId, CHAT_COLUMN } from "../builder/site-chat.mjs";

const src = readFileSync(new URL("../worker.js", import.meta.url), "utf8");

function bucket(keys) {
  const store = new Set(keys);
  return {
    store,
    async list({ prefix, cursor, limit = 1000 }) {
      // R2'S CURSOR MARKS A PLACE BY KEY, so deleting while paging skips nothing.
      const all = [...store].filter((k) => k.startsWith(prefix) && (!cursor || k > cursor)).sort();
      const page = all.slice(0, Math.min(limit, 2));   // tiny pages: the cursor must be followed
      const more = all.length > page.length;
      return { objects: page.map((key) => ({ key })), truncated: more, cursor: more ? page[page.length - 1] : undefined };
    },
    async delete(k) { store.delete(k); },
  };
}

test("the site delete's leftovers step removes everything kept under the site's name, and nothing of a neighbour", async () => {
  const a = src.indexOf("    let leftoversRemoved = 0;");
  const b = src.indexOf('console.error("site leftovers delete failed:", dslug, e && e.message); }', a);
  assert.ok(a > 0 && b > a, "the leftovers step moved; this test checks nothing");
  const step = src.slice(a, b) + 'console.error("site leftovers delete failed:", dslug, e && e.message); }\nreturn leftoversRemoved;';
  const run = new Function("env", "dslug", "uid", "srow", "siteScope", "cleanChatId", "CHAT_COLUMN", "chatStoreKey", "chatSharedElsewhere", "return (async () => {" + step + "})();");
  const S = "sunday-kitchen", N = "sunday-kitchen-2", U = "uid-1", C = "site_1792_abcde";
  const mine = [
    "uploads/" + S + "/loaf.jpg", "uploads/" + S + "/a.mp4", "uploads/" + S + "/b.pdf",
    "source/" + S + "/pages.json", "source/" + S + "/answer.json", "source/" + S + "/neon-unrecorded/x.json",
    "apps/" + S + "/android.apk", "apps/" + S + "/source.json", "apps/" + S + "/source/app/index.tsx",
    "app-preview/" + S + "/" + "a".repeat(32) + "/index.html", "games/" + S + "/index.html",
    "scriptpending/" + S + "/x.json", "media-sessions/site-" + S + "/s1.json", "media-parts/site-" + S + "/s1/1",
    "media-assets/site-" + S + "/loaf.json", "media-ledger/site-" + S + ".json",
    "publish-turn/" + S + ".json", "preview-up/" + S + ".json", "preview-state/" + S + ".json",
    "chat/" + U + "/" + C + ".json",
  ];
  const theirs = mine.map((k) => k.split(S).join(N)).map((k) => k.replace("chat/" + U + "/" + C, "chat/" + U + "/site_other"));
  const B = bucket([...mine, ...theirs]);
  const removed = await run({ SITES_BUCKET: B }, S, U, { uid: U, [CHAT_COLUMN]: C }, siteScope, cleanChatId, CHAT_COLUMN, (u, c) => "chat/" + u + "/" + c + ".json", async () => false);
  const left = mine.filter((k) => B.store.has(k));
  assert.deepEqual(left, [], "still kept after the delete: " + left.join(", "));
  assert.deepEqual(theirs.filter((k) => !B.store.has(k)), [], "a neighbour's things were deleted");
  assert.ok(removed >= 15, "the count of what went is not reported: " + removed);
});

test("the leftovers step runs inside the site delete, before the ownership row goes, and the chat id is read with it", () => {
  const a = src.indexOf("async function deleteSiteFor(env, uid, dslug) {");
  const b = src.indexOf("\n}\n", a);
  const body = src.slice(a, b);
  assert.ok(a > 0 && body.length > 1000, "deleteSiteFor moved");
  assert.match(body, /site_backends\?slug=eq\.\$\{encodeURIComponent\(dslug\)\}&select=uid,\$\{CHAT_COLUMN\}`/, "the chat that built the site is not read");
  const step = body.indexOf("let leftoversRemoved = 0;");
  const row = body.indexOf('site_backends?slug=eq.${encodeURIComponent(dslug)}`, { method: "DELETE"');
  assert.ok(step > 0 && row > step, "the leftovers go after the ownership row, so a failure cannot be retried");
  assert.match(body, /leftoversRemoved, projectDropped,/, "the answer does not say what went");
});
