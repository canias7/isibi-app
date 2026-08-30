// The rename of 2026-08-30: the product is "Go Farther" everywhere a person can
// read it, and is STILL "isibi" everywhere a machine already wrote it down.
//
// Both halves matter, and the second is the one that needs a test. A future
// session — or a search-and-replace run by someone tidying up — will see the
// leftovers and finish the job. This file is why they must not, with the
// consequence written next to each one.
//
// It also pins the trap that makes a naive replace catastrophic: the literal
// substring "isibi" sits inside the ordinary word "visibility" (v-ISIBI-lity),
// about a hundred times. A case-insensitive replace of "isibi" corrupts every
// one of them, and the corruption compiles as far as the first render.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { parseSchemaSpec } from "../site-schema.mjs";

const ROOT = path.join(import.meta.dirname, "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

// Each entry: the file, the exact string, and what breaks in the real world if
// it changes. The "why" is the point of the test — a bare list of strings would
// be re-deleted by the next person who reads it as leftovers.
const LOAD_BEARING = [
  ["site-meta.mjs", '<!--isibi:meta-->',
    "the fence is already inside the HTML of every published customer site in R2; " +
    "rename the reader and the platform can no longer find any existing site's metadata"],
  ["site-rls.mjs", 'export const POLICY_PREFIX = "isibi_"',
    "every RLS policy in every customer's live Neon database is named with this prefix; " +
    "rename it and the next migration writes policies that do not replace the old ones"],
  ["site-payments.mjs", "isibi_slug",
    "Stripe PaymentIntents already in flight carry this metadata key; " +
    "rename it and their webhooks can no longer be matched to an order"],
  ["worker.js", 'sha256hex(ip + "|" + slug + "|isibi-analytics-v1")',
    "this string is salt in a hash; change it and every returning visitor gets a new id, " +
    "splitting the analytics of every site at the moment of the deploy"],
  ["worker.js", '"Idempotency-Key": `isibi-${slug}-${table.name}-${orderId}`',
    "Stripe deduplicates retries by this key; change it and a retried payment that was " +
    "already taken is charged a second time"],
  ["worker.js", '"isibi-sites"',
    "the R2 bucket every published site is served out of; point at another name and " +
    "every customer site 404s"],
  ["wrangler.jsonc", '"name": "isibi-app"',
    "the deployed Cloudflare Worker script's name; renaming it deploys a NEW worker and " +
    "orphans the live one, with its routes, secrets and bindings"],
  ["wrangler.jsonc", '"bucket_name": "isibi-sites"',
    "same bucket, from the binding side"],
];

for (const [file, token, why] of LOAD_BEARING) {
  test(`${file} keeps ${token.slice(0, 42)}… — ${why.slice(0, 58)}…`, () => {
    assert.ok(read(file).includes(token),
      `${file} no longer contains ${JSON.stringify(token)}.\n\n` +
      `This was NOT left behind by accident. ${why}.\n\n` +
      `If the rename really has to reach this string, it needs a migration, not an edit.`);
  });
}

test("the schema parser still accepts the pre-rename filename", () => {
  // The one token the rename DID reach on a customer-visible surface, and it
  // only reached it because the parser was widened first. A build whose output
  // still carries isibi.schema.json must keep parsing: read as "no such file"
  // it does not fail loudly — it reads as a site that declared no database, and
  // the build quietly provisions nothing.
  //
  // Driven through the real function rather than by reading its regex out of
  // the source: the first version of this scraped the pattern with /\/[^/]+\//
  // and stopped at the first escaped slash inside it, reporting a parser that
  // was right there as missing. Behaviour is the property; the spelling is not.
  const spec = { tables: [{ name: "orders", fields: [] }] };
  for (const name of ["isibi.schema.json", "gofarther.schema.json", "src/gofarther.schema.json"]) {
    const files = { [name]: JSON.stringify(spec), "index.html": "<!doctype html>" };
    assert.deepEqual(parseSchemaSpec(files), spec, name + " must still be recognised");
    assert.equal(name in files, false, name + " must be stripped, never shipped as an asset");
  }
  assert.equal(parseSchemaSpec({ "notgofarther.schema.json": "{}" }), null,
    "a longer filename must not match");
  assert.equal(parseSchemaSpec({ "index.html": "x" }), null,
    "a build that declares no database must still answer null");
});

test("a naive replace has not eaten the word 'visibility'", () => {
  // The reason the sweep was done by hand. `sed s/isibi/gofarther/gI` over this
  // tree rewrites ~107 occurrences of visibility/Visibility/VISIBILITY into
  // nonsense, and most of them are in CSS, where nothing throws — the page just
  // stops hiding things.
  let count = 0;
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (["node_modules", ".git", "dist"].includes(e.name)) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) { walk(full); continue; }
      if (!/\.(js|mjs|ts|tsx|css|html)$/.test(e.name)) continue;
      count += (fs.readFileSync(full, "utf8").match(/visibility/gi) || []).length;
    }
  };
  walk(ROOT);
  assert.ok(count > 60,
    "only " + count + " occurrences of 'visibility' left in the tree — a case-insensitive " +
    "replace of 'isibi' rewrites that word, and this is what it looks like afterwards");
});

test("nothing a customer reads still says isibi or Zephyr", () => {
  // Scoped to what actually ships to a person: the app's own pages and scripts,
  // the installed-PWA manifest, and the README that is copied into every
  // exported customer project. Storage keys are excluded by the filter below —
  // they are data, and the test after this one says why.
  const surfaces = [
    "public/index.html", "public/confirm.html", "public/privacy.html",
    "public/terms.html", "public/data-deletion.html", "public/site.webmanifest",
    "public/chat.js", "public/auth.js", "public/styles.css",
    "builder/lovable/template/README.md",
  ];
  for (const f of surfaces) {
    const src = read(f)
      // persisted keys are data, not copy. The `*` matters: chat.js clears our
      // storage with startsWith('zephyr_'), a bare prefix with nothing after
      // the underscore, and a `+` here reported that line as customer-facing
      // copy — a guard going red for something nobody did.
      .replace(/zephyr[_-][A-Za-z0-9_]*/gi, "")
      .replace(/[A-Za-z]isibi|isibi[a-z]/g, "");  // visibility and friends
    for (const word of ["isibi", "Isibi", "ISIBI", "zephyr", "Zephyr", "ZEPHYR"]) {
      assert.equal(src.includes(word), false,
        f + " still shows a customer the word " + JSON.stringify(word));
    }
  }
});

test("the browser storage keys are still the old ones", () => {
  // The other half of the rename that must NOT happen. These name state sitting
  // in a live user's browser right now — their session, their chats, their
  // memory, their saved avatars. Renaming the keys does not migrate that state,
  // it orphans it: every signed-in customer is signed out and their history
  // looks deleted.
  // Read across every script that owns one: the session key lives in auth.js
  // and confirm.js, not chat.js, and looking in one file reported a key that
  // is right there as deleted.
  const scripts = fs.readdirSync(path.join(ROOT, "public"))
    .filter((f) => f.endsWith(".js"))
    .map((f) => read("public/" + f)).join("\n");
  for (const key of ["zephyr_session_v1", "zephyr_chats_v1", "zephyr_memory_v1",
                     "zephyr_avatars_v1", "zephyr_owner_v1"]) {
    assert.ok(scripts.includes(key),
      key + " is gone. If that was a rename, every existing user has just been signed " +
      "out and had their history orphaned — it needs a read-old-write-new migration first.");
  }
});
