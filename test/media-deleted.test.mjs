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

  // NO REMOTE ORIGIN THE APP DOES NOT TALK TO (2026-09-12, stage 3). The policy
  // carried `fal.media`/`*.fal.media` (the generator's own render links),
  // `*.ytimg.com` and `*.cdninstagram.com`/`*.fbcdn.net` (the Media Agent's
  // thumbnails) on img-src, media-src and connect-src — and a whole `media-src`
  // directive, which existed so the composer could play a generated clip.
  //
  // DERIVED FROM WHAT `public/` ACTUALLY NAMES, never from a list of hosts to
  // forbid: every non-Supabase, non-`self` host in the policy has to appear in a
  // served script or page, or it is a standing permission with no claimant.
  // The scan names the served files rather than walking `public/`, which is
  // what kept `public/demo-hero-2/` — a frozen pre-scrub clone of the whole
  // media client, 404'd by the Worker and deleted in stage 4 — from re-admitting
  // every host it mentioned. The clone is gone; the explicit list stays, because
  // it is what makes "served" mean served rather than "on disk".
  const served = ["public/index.html", "public/chat.js", "public/auth.js", "public/confirm.js", "public/site-list.js"]
    .filter((p) => fs.existsSync(ROOT + p)).map((p) => read(p)).join("\n");
  assert.ok(served.length > 100000, `the served client read as ${served.length} characters — this scan is reading nothing`);
  // READ OFF THE RAW SOURCE WITH WHOLE-LINE COMMENTS BLANKED, not off
  // `WORKER_CODE`. `https://` CONTAINS `//`, so the file-wide blanker — which
  // strips from any `//` to end of line, and has to, because chat.js carries
  // `// Every /api/* call …` — turns every origin in this policy into
  // `https:` and this scan found zero hosts. The recorded "a blanker erases the
  // landmark the guard needs" trap; `site-style.test.mjs` lives under the same
  // rule and says so. Whole-line comments are still removed, because the prose
  // right above these directives NAMES the four origins that just left.
  const cspRaw = /const CSP = \[([\s\S]*?)\n\]\.join\("; "\);/.exec(WORKER)[1]
    .replace(/^[ \t]*\/\/[^\n]*$/gm, "");
  const hosts = [...new Set([...cspRaw.matchAll(/https:\/\/([A-Za-z0-9*.-]+)/g)].map((m) => m[1]))];
  assert.ok(hosts.length >= 2, `only ${hosts.length} remote hosts in the CSP — this scan is reading nothing`);
  for (const h of hosts) {
    // `fonts.googleapis.com` / `fonts.gstatic.com` are named by a generated
    // SITE's stylesheet rather than by ours.
    if (/^fonts\./.test(h)) continue;
    const bare = h.replace(/^\*\./, "");
    // `https://*." + SITE_ZONE` is INTERPOLATED, so the match ends at the quote
    // and `bare` comes out empty — and `served.includes("")` is true, which is a
    // silent pass rather than a skip. Named, because a host this scan cannot
    // read is a host it is not checking and that has to be visible.
    if (!bare.includes(".")) {
      assert.match(h, /^\*\.$/, `the CSP names https://${h}, which this scan cannot resolve to a host`);
      continue;
    }
    assert.ok(served.includes(bare),
      `the CSP admits https://${h} and nothing the app serves names it — a standing permission with no claimant`);
  }
  // AND `media-src` IS GONE RATHER THAN NARROWED, which is the tighter answer:
  // with no directive `default-src 'self'` governs, so a `<video>` nobody has
  // written yet is refused a remote source by default instead of inheriting a
  // permission somebody has to remember to remove.
  assert.ok(!/media-src/.test(csp),
    "media-src is back; nothing in the workspace plays audio or video, and default-src 'self' is the tighter answer");

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

test("the one fal path the builder keeps does not put the provider's name on the wire", () => {
  // A STANDING OWNER RULE THAT OUTLIVED ITS WALL (2026-08-28: the user must
  // NEVER see "fal"). `scrubProvider` guarded the DIRECTOR's brief errors, and
  // the director left on 2026-09-12; what stayed is `genSitePhoto`, which is the
  // only fal call left in the tree and the one the owner asked for by name
  // ("leave fal for the banano pro images for the site builder").
  //
  // It throws `"photo " + status + " " + d.detail` — `detail` written by fal —
  // and `makeSitePhoto` puts that message on the wire as `images.error`. So the
  // wall was pointed at the path that is going and not at the one that stays.
  //
  // TWO HALVES, and the second is what makes the first honest: the scrubber has
  // to be there, and it has to be DRIVEN, because a regex nobody runs is a
  // claim. Driven against the sentence the throw really builds, not a made-up
  // one — derived from `genSitePhoto`'s own throw.
  const throwLine = /throw new Error\("photo " \+ r\.status \+ " " \+ String\(\(d && d\.detail\) \|\| ""\)/;
  assert.match(WORKER_CODE, throwLine,
    "genSitePhoto no longer throws the provider's own `detail` — if that changed, re-derive the sentence below");
  const at = WORKER_CODE.indexOf("async function makeSitePhoto(");
  assert.ok(at > 0, "makeSitePhoto is gone");
  const next = WORKER_CODE.slice(at + 1).match(/\n(?:\/\*\*|export default|(?:export )?(?:async )?(?:function|class|const|let) )/);
  const body = WORKER_CODE.slice(at, next ? at + 1 + next.index : WORKER_CODE.length);
  assert.ok(body.length > 400 && body.length < 4000, `makeSitePhoto's body read as ${body.length} characters`);
  assert.match(body, /error: scrubProvider\(/,
    "makeSitePhoto puts the provider's own error message on the wire unscrubbed");

  // DRIVEN. `scrubProvider` is evaluated out of worker.js — it takes a string
  // and returns one, so there is nothing to stub — and asked about the exact
  // shapes a fal failure produces, plus the two that must survive: this repo
  // shipped a scrubber that turned "false" into "the render service" once, and
  // the word-boundary rule is the whole reason this one is safe.
  const src = WORKER_CODE.slice(WORKER_CODE.indexOf("function scrubProvider(s) {"));
  const end = src.indexOf("\n}\n");
  assert.ok(end > 0, "scrubProvider's body is gone");
  const scrub = new Function(src.slice(0, end + 2) + "\nreturn scrubProvider;")();
  for (const bad of [
    "photo 402 Insufficient balance on fal.ai",
    "photo 422 https://fal.run/fal-ai/nano-banana-pro rejected the prompt",
    "photo 500 fal-ai upstream error",
    "photo 429 rate limited by fal",
  ]) {
    assert.ok(!/\bfal\b|fal\.(ai|run|media)|fal-ai/i.test(scrub(bad)), `the provider survives scrubbing: ${scrub(bad)}`);
  }
  // A URL GOES WHOLE, NOT WORD BY WORD — the property the first rule buys, and
  // the reason it is not redundant with the two narrower ones. Without it the
  // narrow rules still remove every `fal`, so nothing above fails; what comes
  // out is `https://the render service/the render service/nano-banana-pro`,
  // which still says we call an outside render service at a path shaped like a
  // model id. The sweep found this as a survivor and it was a missing
  // assertion, not a redundant wall.
  assert.equal(scrub("photo 422 https://fal.run/fal-ai/nano-banana-pro rejected the prompt"),
    "photo 422 the render service rejected the prompt",
    "a provider URL is scrubbed in pieces instead of replaced whole");
  for (const fine of ["photo 400 false positive", "the falcon perch photograph", "photo 404 not found"]) {
    assert.equal(scrub(fine), fine, `scrubbing damaged an innocent sentence: ${scrub(fine)}`);
  }

  // AND THE SENTENCE THE CUSTOMER READS NEVER QUOTES IT ANYWAY, which is the
  // belt: `imageNote` is the one composer of that sentence and uses `error`
  // only as a DISCRIMINATOR between four identical-looking placeholder
  // outcomes. Asked of the real module, so a future edit that starts quoting
  // the error fails here.
  assert.ok(!/\$\{[^}]*\berror\b[^}]*\}|\+\s*i\.error|\+\s*images\.error/.test(read("builder/site-images.mjs")),
    "imageNote has started putting the raw image error into the customer's sentence");
});

// ── stage 4: the sweep ────────────────────────────────────────────────────────

test("no credential is uploaded that nothing reads", () => {
  // COMPOSIO_API_KEY was the Media Agent's Instagram/YouTube credential, and
  // `deploy.yml` went on uploading it to the Worker for a stage after the engine
  // that read it left. An unread secret is a live credential with no consumer,
  // and it is invisible: the deploy succeeds, the binding exists, nothing calls
  // it.
  //
  // DERIVED BOTH WAYS, which is what makes this more than a line saying one name
  // is absent: every secret the workflow uploads must be read by something we
  // ship, and the scan is over the Worker's whole module graph by directory
  // rather than a list of files.
  const yml = read(".github/workflows/deploy.yml");
  const block = yml.slice(yml.indexOf("secrets: |") + "secrets: |".length);
  const uploaded = [];
  for (const line of block.split("\n")) {
    if (!line.trim()) continue;
    const m = line.match(/^\s+([A-Z][A-Z0-9_]*)\s*$/);
    if (!m) break;
    uploaded.push(m[1]);
  }
  assert.ok(uploaded.length >= 10, `the secrets block read as ${uploaded.length} names`);

  // THE SHIP SET, and the first draft of this line is the lesson: `git ls-files
  // worker.js '*.mjs' builder` answered 3,933 files, because a bare `*.mjs`
  // pathspec matches every depth — so it swept in `test/` and the kit, and the
  // absence check below then failed on the TESTS that name the credential while
  // explaining that it is gone. Prose contains the thing it forbids, for the
  // second time in one guard. Root modules and the builder's own, by depth.
  const tracked = execSync("git ls-files worker.js ':(glob)*.mjs' ':(glob)builder/*.mjs'", { cwd: ROOT, encoding: "utf8" })
    .trim().split("\n").filter(Boolean);
  assert.ok(tracked.length > 100 && tracked.length < 400,
    `${tracked.length} modules listed — the ship set is not the whole tree and is not empty`);
  const src = tracked.map((f) => read(f)).join("\n");

  // The two the Worker never reads by name are named here with their reason, so
  // this is a decision and not a hole: `DEPLOY_ID` is a `vars:` entry rather than
  // a secret and is read in builder/edit-job.mjs, and both are covered by the
  // scan below anyway — the exception list is empty on purpose.
  for (const name of uploaded) {
    assert.ok(src.includes(name),
      `${name} is uploaded to the Worker on every deploy and nothing we ship reads it`);
  }
  assert.ok(!uploaded.includes("COMPOSIO_API_KEY") && !src.includes("COMPOSIO"),
    "the Media Agent's credential is back, and the engine that read it is gone");
});

test("the media side's own files and workflows are gone from the tree", () => {
  // ASKED OF GIT, never of the filesystem — the recorded rule. A `readdirSync`
  // answers about the machine it runs on, and a generated or untracked leftover
  // would read as present on one machine and absent in CI.
  //
  // WHAT WENT, and every one of these was measured unreferenced before the cut
  // rather than recognised by name: `public/demo-hero-2/` (a frozen pre-scrub
  // clone of the whole media client, 404'd by the Worker and still naming the
  // provider), `public/avatars/` (80 parts for the avatar builder), the two
  // orchestrator/video-editor badges, the watermark PNG, the login-screen video
  // backgrounds, the fal watermark test bench and its workflow, and the Media
  // Agent's own document.
  const tracked = execSync("git ls-files", { cwd: ROOT, encoding: "utf8" }).trim().split("\n");
  assert.ok(tracked.length > 500, `git lists only ${tracked.length} files — this scan is reading nothing`);
  const gone = [
    "public/demo-hero-2/", "public/avatars/", "public/img/badge-",
    "public/wm-badge.png", "public/login-bg.",
    ".github/workflows/fal-wm-test.yml", ".github/scripts/fal-wm-test.mjs",
    "docs/media-agent.md",
  ];
  for (const p of gone) {
    const hit = tracked.filter((f) => f.startsWith(p));
    assert.deepEqual(hit, [], `${p} is tracked again: ${hit.join(", ")}`);
  }
  // AND THE WALL WENT WITH ITS SUBJECT: the Worker refused `/demo-hero*` because
  // those files existed. With them gone the asset tail 404s the path on its own,
  // and `assets` declares no `not_found_handling` — checked, because a
  // single-page-application setting there would make this wall load-bearing.
  // READ OFF THE BLANKED SOURCE: the comment left where the wall stood says
  // which path it used to refuse, so a raw read fails on the note explaining
  // the deletion. The landmark is asserted to have survived the blanking first,
  // or an absence check over an empty string passes for the wrong reason.
  assert.ok(WORKER_CODE.includes("env.ASSETS.fetch(request)"), "the asset tail is gone — this scan is misreading the Worker");
  assert.ok(!/demo-hero/.test(WORKER_CODE), "the snapshot wall is back with nothing to refuse");
  assert.ok(!/not_found_handling/.test(read("wrangler.jsonc")),
    "assets now declares not_found_handling, so `/demo-hero*` may serve the app shell — re-read that wall");
});

test("the free-tier watermark went, and the paid flag it read did not", () => {
  // `wmBadge` put a "✦ gofarther.dev" mark over video players for accounts known
  // free, and `refreshVideoBadges` ran on EVERY credits answer over
  // `.msg.video, .wm-spot` — the chat thread's clip bubbles, the gallery cards
  // and the lightbox, all three deleted in stage 2b. A live call over a document
  // that cannot hold what it is looking for.
  assert.ok(!/wmBadge|refreshVideoBadges|wm-spot/.test(CHAT_CODE),
    "the on-screen watermark is back, and the three views it painted over are not");

  // THE HALF THAT MUST NOT GO WITH IT, and this is the case's real job: the
  // deletion touched the paid flag's neighbourhood, and that flag is membership,
  // which the owner asked to leave exactly as it is. Its three readers are the
  // account badge, the free-credits greeting and the start screen's plan pill —
  // DERIVED by counting, so losing one fails here even if the flag survives.
  const reads = [...CHAT_CODE.matchAll(/\b(isPaid|paidKnown)\b/g)].length;
  assert.ok(reads >= 8, `the paid flag is read ${reads} times — a membership reader went with the watermark`);
  assert.match(CHAT_CODE, /paidKnown && isPaid\) return 'Member'/, "the account badge stopped reading the paid flag");
  assert.match(CHAT_CODE, /if \(isPaid\) return;/, "the free-credits greeting stopped reading the paid flag");
  assert.match(CHAT_CODE, /isPaid \? ' paid' : ''/, "the start screen's plan pill stopped reading the paid flag");
});
