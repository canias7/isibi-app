// WHAT THE MEDIA SIDE'S DELETION LEFT BEHIND MUST STAY GONE.
//
// Written because a mutation sweep on that deletion (2026-09-12) found six
// properties nothing asserted at all: the app's view list, the storage keys a
// retired feature leaves in a browser, and two halves of the Content-Security
// Policy. Every one of those mutants survived — not because a check was weak
// but because there was no check, which is the only kind of survivor worth
// writing a file for.
//
// Everything here is DERIVED. The views come from the app's own KNOWN_VIEWS and
// index.html's own elements; the storage keys come from the do-not-rename table
// in owner-notes; the CSP is driven rather than read. A hand-typed list of
// "things that should be gone" is a second copy of the deletion, and it would
// go stale the first time stage 3 removes one more route.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { execSync } from "node:child_process";

const ROOT = new URL("../", import.meta.url).pathname;
const read = (p) => fs.readFileSync(ROOT + p, "utf8");
const CHAT = read("public/chat.js");
const HTML = read("public/index.html");
const WORKER = read("worker.js");

// Comments blanked, length-preserved. Line comments FIRST and block openers
// only at the start of a line — chat.js carries `// Every /api/* call …`, whose
// `/*` opens a false block that eats most of the file the other way round
// (measured at 37% left; the same failure is recorded for worker.js at 46%).
const blank = (s) => s
  .replace(/\/\/[^\n]*/g, (m) => " ".repeat(m.length))
  .replace(/^[ \t]*\/\*[\s\S]*?\*\//gm, (m) => m.replace(/[^\n]/g, " "));
const CHAT_CODE = blank(CHAT);
const WORKER_CODE = blank(WORKER);
const HTML_CODE = HTML.replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, " "));

test("the app's view list and its markup are the same two views", () => {
  // THE SURVIVOR THAT BOUGHT THIS FILE: adding `viewGallery` back to
  // index.html, or a Gallery tab back to the top nav, passed every test in the
  // repo. Both are doors to a screen whose renderer was deleted — a tab that
  // paints an empty main, which is this repo's own dead-control finding wearing
  // the costume of a feature.
  const m = /const KNOWN_VIEWS = (\[[^\]]*\]);/.exec(CHAT_CODE);
  assert.ok(m, "KNOWN_VIEWS is gone — showView has no list to check against");
  const known = eval(m[1]);
  assert.deepEqual([...known].sort(), ["settings", "sites"],
    "the app claims to have views it does not: " + known.join(", "));

  // Every `.view` element the page declares, by the id convention showView uses.
  const inPage = [...HTML_CODE.matchAll(/id="view([A-Z][A-Za-z]*)"/g)]
    .map((x) => x[1].charAt(0).toLowerCase() + x[1].slice(1));
  assert.ok(inPage.length >= 1, "index.html declares no views at all — this scan is reading nothing");
  assert.deepEqual([...inPage].sort(), [...known].sort(),
    "the page's views and KNOWN_VIEWS disagree: markup has " + inPage.join(", ") + ", code knows " + known.join(", "));

  // And nothing offers to open a view that is not one of them. `data-view` is
  // how every tab, sidebar item and profile row names its destination — except
  // `home`, which showView aliases to the builder on purpose and which the
  // Back arrow still carries.
  const offered = [...new Set([...HTML_CODE.matchAll(/data-view="([A-Za-z]+)"/g)].map((x) => x[1]))];
  assert.ok(offered.length >= 1, "no control names a view — this scan is reading nothing");
  for (const v of offered) {
    assert.ok(known.includes(v) || v === "home" || v === "landing",
      `a control opens '${v}', which is neither a view this app has nor an alias showView resolves`);
  }
});

test("a retired feature's storage key is still cleared out of a browser", () => {
  // TWO SURVIVORS, ONE CAUSE. `brand-rename.test.mjs` asserts every name in the
  // do-not-rename table is still SOMEWHERE in the tree, which the two clear
  // lists satisfy between them — so dropping a key from ONE of them survived.
  // The property is that BOTH clear it: one runs on an account switch, the
  // other on sign-out, and a key left behind by either is a deleted feature's
  // data sitting in somebody's browser for ever.
  //
  // Derived from owner-notes' own table, so a key added or retired there is
  // covered here without an edit.
  const notes = read("docs/owner-notes.md");
  const at = notes.indexOf("## Names that must not be renamed");
  assert.ok(at > 0, "the do-not-rename table is gone — this check has no source");
  const section = notes.slice(at, notes.indexOf("\n## ", at + 1));
  const keys = [...section.matchAll(/^\| `(zephyr_[a-z_0-9]+)` \|/gm)].map((x) => x[1]);
  assert.ok(keys.length >= 4, `parsed only ${keys.length} zephyr keys from the table — has its shape changed?`);

  // The two lists, found by their own landmarks rather than by line number.
  const lists = [
    ["the account-switch wipe", "zephyr_owner_v1', uid"],
    ["sign-out", "async function doSignOut("],
  ].map(([what, near]) => {
    const i = CHAT_CODE.indexOf(near);
    assert.ok(i > 0, `${what}'s landmark is gone — nothing is being read`);
    // The clear list is the nearest `[ … ].forEach((k) => localStorage.removeItem(k))`.
    const window = what === "sign-out" ? CHAT_CODE.slice(i, i + 1200) : CHAT_CODE.slice(Math.max(0, i - 1200), i);
    const arr = /\[([^\]]*)\]\s*\n?\s*\.forEach\(\(k\) => localStorage\.removeItem\(k\)\)/.exec(window);
    assert.ok(arr, `${what} no longer clears a list of keys`);
    return [what, arr[1]];
  });

  // TWO KEYS ARE EXCLUDED, EACH FOR ITS OWN REASON, out loud rather than by a
  // looser assertion:
  //   · the SESSION key belongs to Auth. Signing a person out is
  //     `Auth.signOut()`'s job and wiping the token from under it would strand
  //     a live session, so NEITHER list may touch it.
  //   · the OWNER key records which account this browser belongs to. The
  //     account-switch wipe re-sets it to the incoming uid three lines later,
  //     so clearing it there would be a write followed by a write; sign-out has
  //     no incoming account, so sign-out is the one that must clear it.
  const SESSION = "zephyr_session_v1";
  const OWNER = "zephyr_owner_v1";
  for (const [what, body] of lists) {
    for (const k of keys) {
      if (k === SESSION) {
        assert.ok(!body.includes(k), `${what} clears ${k} — that is Auth's to remove, not ours`);
        continue;
      }
      if (k === OWNER) {
        if (what === "sign-out") {
          assert.ok(body.includes(k), "sign-out no longer forgets which account this browser belonged to");
        } else {
          assert.ok(!body.includes(k), "the account-switch wipe clears the owner key it is about to re-set");
        }
        continue;
      }
      assert.ok(body.includes(k), `${what} no longer clears ${k}, so a retired feature's data stays in the browser`);
    }
  }
});

test("DRIVEN: the CSP grants no wasm permission, and the demo frame's relaxation still matches", () => {
  // TWO MORE SURVIVORS. `'wasm-unsafe-eval'` was in `script-src` for exactly one
  // thing — the in-browser video editor, self-hosted under /vendor/ffmpeg — and
  // both it and its 11 MB of vendored wasm were deleted. A standing permission
  // with no claimant is the kind of leftover a policy must not accumulate.
  //
  // The second half is worse, and is why this is DRIVEN rather than read: the
  // demo frame's policy is built by `.replace()` off the main one, and its
  // needle named the token that was just removed. A `.replace` whose needle has
  // moved changes nothing and reports nothing — so the demo frame would have
  // quietly lost its `unsafe-inline` and rendered without its inline styles.
  // READ AS TEXT, NOT EVALUATED: several directives interpolate real bindings
  // (the Supabase origin, the analytics host), so the array is not a value a
  // test can construct. What matters is the SPELLING, which is also exactly
  // what the `.replace` needles below have to agree with.
  const m = /const CSP = \[([\s\S]*?)\n\]\.join\("; "\);/.exec(WORKER_CODE);
  assert.ok(m, "the CSP array is gone or has been reshaped");
  const csp = m[1];
  assert.ok(csp.length > 200, `the CSP body read as ${csp.length} characters — this scan is reading nothing`);
  assert.ok(csp.includes("script-src 'self'"), "script-src no longer names 'self' — the policy moved");
  assert.ok(!/wasm-unsafe-eval/.test(csp),
    "the CSP still grants 'wasm-unsafe-eval', and nothing in the app compiles WebAssembly any more");
  assert.ok(!/[^-]unsafe-eval'/.test(csp), "the CSP grants JS eval()");

  // The two relaxations, applied the way the Worker applies them, against the
  // CSP the Worker really builds.
  const rel = /const demoCSP = CSP\n((?:\s+\.replace\([^\n]*\n)+)/.exec(WORKER_CODE);
  assert.ok(rel, "the demo frame no longer relaxes the policy");
  const pairs = [...rel[1].matchAll(/\.replace\("([^"]*)", "([^"]*)"\)/g)];
  assert.ok(pairs.length >= 2, `found ${pairs.length} relaxations — expected the frame-ancestors one and the inline one`);
  let demo = csp;
  for (const [, from, to] of pairs) {
    assert.ok(demo.includes(from),
      `the demo CSP replaces ${JSON.stringify(from)}, which the policy does not contain — a silent no-op`);
    demo = demo.replace(from, to);
  }
  assert.notEqual(demo, csp, "the demo policy came out identical to the strict one");
  assert.ok(demo.includes("frame-ancestors 'self'"), "the demo frame cannot be framed by the workspace");
  // ASKED OF THE script-src ENTRY, NOT OF THE WHOLE POLICY. Read as text the
  // entries are newline-separated, so a `script-src[^;]*'unsafe-inline'` match
  // runs straight past the end of the directive and finds style-src's — which
  // is a legitimate `unsafe-inline` and made the control below pass on a policy
  // that had nothing wrong with it. The recorded flat-scan-where-depth-matters
  // trap, one punctuation mark over.
  const scriptSrc = (x) => {
    const line = x.split("\n").map((l) => l.trim()).find((l) => l.includes("script-src"));
    assert.ok(line, "no script-src entry in: " + x.slice(0, 120));
    return line;
  };
  assert.ok(scriptSrc(demo).includes("'unsafe-inline'"), "the demo frame lost its inline-style permission");
  // THE CONTROL: the relaxation is the DEMO's alone. The strict policy a real
  // visitor gets must not carry either.
  assert.ok(!scriptSrc(csp).includes("'unsafe-inline'"), "the strict policy allows inline script");
  assert.ok(csp.includes("frame-ancestors 'none'"), "the strict policy lets anyone frame the app");
});

test("the deleted editor's files are gone from the tree, and nothing asks for them", () => {
  // The script tag coming back was killed by an existing guard; the FILES being
  // gone was not asserted anywhere, and a tag pointing at a missing file is a
  // 404 on every page load.
  const tracked = new Set(
    execSync("git ls-files public", { cwd: ROOT, encoding: "utf8" }).trim().split("\n"),
  );
  assert.ok(tracked.size > 5, `git lists only ${tracked.size} files under public/ — this scan is reading nothing`);
  for (const f of [...tracked]) {
    assert.ok(!/ffmpeg/i.test(f), `${f} is still tracked, and the in-browser video editor was deleted`);
  }
  assert.ok(!HTML.includes("ffmpeg"), "index.html still asks for the deleted video editor");
  assert.ok(!CHAT_CODE.includes("sbFF"), "chat.js still calls into the deleted video editor");
});
