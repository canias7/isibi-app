// A DURABLE OBJECT CLASS THAT LEAVES THE WORKER NEEDS A `deleted_classes`
// MIGRATION, AND NOTHING ASSERTED IT UNTIL TODAY (2026-09-12).
//
// `wrangler.jsonc` has carried that rule in a COMMENT since v4 retired the two
// original builder containers, and the comment is right: Cloudflare refuses a
// deploy whose config declares a class the script no longer exports, unless a
// migration says the class was deleted on purpose. It came up a second time the
// same way — the game builder was deleted on 2026-09-12 (owner: "delete it
// too") and v6 had to be written by hand off that comment.
//
// So this is the repository's own recorded shape twice over. "THE THING THAT
// RUNS YOUR GUARDS IS NOT ITSELF GUARDED unless somebody writes it down" —
// nothing anywhere read `durable_objects` or `migrations`, and the failure is
// the whole deploy, which is the most expensive way to find out. And "a rule
// stated only in prose is a rule somebody eventually reads past": the next
// container to be retired is the one this file exists for.
//
// DERIVED, never a list of today's names: the classes come out of the config and
// out of `worker.js`'s own exports, so a container added or removed next month
// is covered by existing rather than by somebody remembering to come back here.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { stripJsonc } from "../.github/scripts/container-images.mjs";

const ROOT = new URL("../", import.meta.url).pathname;
const CFG = JSON.parse(stripJsonc(fs.readFileSync(ROOT + "wrangler.jsonc", "utf8")));
const WORKER = fs.readFileSync(ROOT + "worker.js", "utf8");

/** Every class `worker.js` exports — what Cloudflare can actually bind to. */
const exported = new Set([...WORKER.matchAll(/^export class ([A-Za-z_$][\w$]*)\b/gm)].map((m) => m[1]));
/** The classes the config binds, and the classes each migration creates or deletes. */
const bound = new Set((CFG.durable_objects?.bindings || []).map((b) => String(b.class_name)));
const migrations = CFG.migrations || [];
const created = new Map(); // class → the tag that created it
const deleted = new Map(); // class → the tag that deleted it
for (const m of migrations) {
  for (const c of m.new_sqlite_classes || []) created.set(String(c), String(m.tag));
  for (const c of m.new_classes || []) created.set(String(c), String(m.tag));
  for (const c of m.deleted_classes || []) deleted.set(String(c), String(m.tag));
}

test("the observers are alive — the config really declares bindings and migrations", () => {
  // Every assertion below walks one of these. A config that stopped declaring
  // them would make the whole file vacuous rather than red, which is the
  // recorded trap and is precisely how a deploy-breaking change would slip past.
  assert.ok(exported.size >= 1, "worker.js exports no Durable Object class at all");
  assert.ok(bound.size >= 1, "the config binds no Durable Object");
  assert.ok(migrations.length >= 1, "the config declares no migrations");
  assert.ok(created.size >= 1, "no migration has ever created a class — the history cannot be read");
});

test("every bound class is one the Worker exports, and every exported one is bound", () => {
  // A binding to a class the script does not export is the deploy failure this
  // file is about, seen from the other side; an exported class nobody binds is
  // a container that can never be reached.
  for (const c of bound) assert.ok(exported.has(c), `the config binds ${c}, which worker.js does not export — the deploy would refuse it`);
  for (const c of exported) assert.ok(bound.has(c), `worker.js exports ${c} and nothing binds it — the class is unreachable`);
});

test("a class that was created and is no longer bound has a deleted_classes migration", () => {
  // THE RULE, and the only one of these that has actually cost a deploy. v4
  // (BuildContainer, CloneBuildContainer) and v6 (GameBuildContainer) are both
  // instances; a third will be caught by this rather than by Cloudflare.
  for (const [cls, tag] of created) {
    if (bound.has(cls)) continue;
    assert.ok(deleted.has(cls),
      `${cls} was created by migration ${tag}, is no longer bound, and no migration deletes it — ` +
      "add a `deleted_classes` migration or the deploy fails");
  }
});

test("a deleted class is really gone, and the history is append-only", () => {
  for (const [cls, tag] of deleted) {
    assert.ok(!bound.has(cls), `migration ${tag} deletes ${cls} and the config still binds it`);
    assert.ok(!exported.has(cls), `migration ${tag} deletes ${cls} and worker.js still exports it`);
    // THE TAG THAT CREATED IT STAYS. Migration history is append-only —
    // Cloudflare replays it — so taking the `new_sqlite_classes` entry out
    // because "the class is gone" breaks every deploy after it. This is the
    // exact mistake the v6 comment was written to stop, asserted rather than
    // described.
    assert.ok(created.has(cls), `${cls} is deleted by ${tag} and nothing ever created it — a creating migration was taken out of the history`);
  }
  // Tags are unique and each class is created once and deleted at most once.
  const tags = migrations.map((m) => String(m.tag));
  assert.equal(new Set(tags).size, tags.length, "two migrations share a tag: " + tags.join(", "));
  const names = migrations.flatMap((m) => [...(m.new_sqlite_classes || []), ...(m.new_classes || []), ...(m.deleted_classes || [])]);
  for (const n of names) assert.equal(typeof n, "string", "a migration names something that is not a class name");
  // A class is never deleted before it is created — the order Cloudflare replays in.
  for (const [cls, delTag] of deleted) {
    assert.ok(tags.indexOf(created.get(cls)) < tags.indexOf(delTag),
      `${cls} is deleted by ${delTag} before ${created.get(cls)} creates it`);
  }
});

test("every container the config declares names a class it also binds", () => {
  // A `containers` entry whose class is not a Durable Object is a container
  // nothing can start; this is the other half of the pair the game deletion had
  // to keep in step (the container entry and the binding came off together).
  for (const c of CFG.containers || []) {
    assert.ok(bound.has(String(c.class_name)), `the container ${c.class_name} names no bound Durable Object`);
  }
});
