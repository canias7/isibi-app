// A PROJECT HAS AN ADDRESS (2026-09-09).
//
// Owner, holding up `lovable.dev/projects/<uuid>`: "or something with id, look
// at lovable for example" → "build it".
//
// Before this the app had NO router — zero pushState, zero popstate — so every
// screen was a div inside one page and the address bar never moved. A site's
// workspace could not be linked, bookmarked, opened in a second tab, or backed
// out of; Back left the app entirely.
//
// WHAT THESE GUARD, and each is a way the feature ships looking right and is
// wrong: the two copies of the URL pattern drifting (the browser pushes an
// address the server 404s — which works until a reload, so nobody sees it); a
// navigation that changes the screen and not the URL (invisible, since the
// screen is correct); a pop that pushes (Back becomes a trap); the boot reading
// localStorage in preference to the path (every pasted link lands wherever that
// browser was last, which is exactly what an address must not do).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const chat = read("../public/chat.js");
const worker = read("../worker.js");

// Whole-line comments blanked, length preserved. Both files explain this
// feature at length and name every spelling these scans forbid — the recorded
// "prose contains the thing it forbids", which has bitten guards written for
// exactly this kind of change.
const bare = (s) => s.split("\n").map((l) => (/^\s*\/\//.test(l) ? " ".repeat(l.length) : l)).join("\n");

const patternIn = (src, what) => {
  const m = /const PROJECT_PATH = (\/\^.*\/);/.exec(src);
  assert.ok(m, "PROJECT_PATH is gone from " + what);
  return m[1];
};

// ── THE PATTERN ─────────────────────────────────────────────────────────────

test("ONE rule, two files: the browser's pattern and the Worker's are identical", () => {
  // THE DRIFT HERE IS SILENT AND WORSE THAN A CRASH. The browser decides what
  // to push and the Worker decides what to serve; if they disagree, the app
  // pushes an address that works — until the customer reloads or shares it, and
  // then it is a 404 on a project that exists. Compared as SOURCE TEXT, so a
  // difference in either direction fails, and neither can be quietly widened.
  assert.equal(patternIn(chat, "public/chat.js"), patternIn(worker, "worker.js"),
    "the two PROJECT_PATH patterns have drifted — the browser would push addresses the Worker 404s");
});

test("DRIVEN: the pattern admits a project address and refuses everything else", () => {
  const re = new RegExp(patternIn(worker, "worker.js").slice(1, -1));
  // The list, and one project — including a trailing slash, which a browser
  // will happily produce and which must not read as a different address.
  for (const p of ["/projects", "/projects/", "/projects/site_1784380035480_w53jb",
                   "/projects/a752aa91-f060-4593-8326-c526b7cc7d5d"])
    assert.ok(re.test(p), p + " must be a project address");
  // NOT a project address, and the last three are the ones that matter: the id
  // charset admits no slash and no dot, so nothing here can climb toward
  // another asset or name a file.
  for (const p of ["/", "/privacy", "/projectsX", "/projects/a/b", "/projects/../etc", "/projects/x.js"])
    assert.ok(!re.test(p), p + " must NOT be a project address");
});

// ── THE READER, DRIVEN ──────────────────────────────────────────────────────

// The real functions, evaluated out of chat.js with `location` and `history`
// handed in — preview-frame's technique. Reading the source would certify the
// layer below the break; what matters is what these ANSWER and what they do to
// history.
function loadRouter(pathname) {
  const cut = (head) => {
    const at = chat.indexOf(head);
    assert.ok(at > 0, head + " is gone from chat.js");
    const end = chat.indexOf("\n}", at);
    assert.ok(end > at, head + " has no end");
    return chat.slice(at, end + 2);
  };
  const pAt = chat.indexOf("const PROJECT_PATH = ");
  assert.ok(pAt > 0, "PROJECT_PATH is gone from chat.js");
  const pEnd = chat.indexOf("\n", pAt);
  const calls = [];
  const loc = { pathname };
  const history = {
    pushState: (s, t, p) => { calls.push(["push", p]); loc.pathname = p; },
    replaceState: (s, t, p) => { calls.push(["replace", p]); loc.pathname = p; },
  };
  // WHAT WAS ON SCREEN AT EACH DRAW, not merely that one happened. `renderSites`
  // reads `siteOpenId` off the module, so recording the id the router held when
  // it drew is the only way to tell "drew the project" from "drew, then set the
  // project" — the second paints the list and leaves it there.
  const drawn = [];
  let api = null;
  const fn = new Function("location", "history", "renderSites", "state",
    chat.slice(pAt, pEnd) + "\n" +
    "let siteOpenId = null;\n" +
    cut("function projectFromPath(") + "\n" +
    cut("function openProject(") + "\n" +
    "return { projectFromPath, openProject, id: () => siteOpenId };");
  api = fn(loc, history, () => drawn.push(api ? api.id() : "<drew before it could be asked>"), {});
  return { api, calls, loc, drawn };
}

test("DRIVEN: the path has THREE answers, and the third is why it is not a boolean", () => {
  // `undefined` — not a project address at all. This is the answer that keeps
  // every ordinary page load from navigating to the sites screen, and folding
  // it into `null` (the LIST) is the mistake it exists to prevent.
  assert.equal(loadRouter("/").api.projectFromPath(), undefined);
  assert.equal(loadRouter("/privacy").api.projectFromPath(), undefined);
  // `null` — the project list.
  assert.equal(loadRouter("/projects").api.projectFromPath(), null);
  assert.equal(loadRouter("/projects/").api.projectFromPath(), null);
  // A project.
  assert.equal(loadRouter("/projects/site_1784380035480_w53jb").api.projectFromPath(),
    "site_1784380035480_w53jb");
});

test("DRIVEN: opening a project moves the URL, and going back to the list moves it back", () => {
  const r = loadRouter("/projects");
  r.api.openProject("site_1_abcde", "push");
  assert.equal(r.api.id(), "site_1_abcde", "the state did not move");
  assert.deepEqual(r.calls.at(-1), ["push", "/projects/site_1_abcde"], "the URL did not move");
  r.api.openProject(null, "push");
  assert.deepEqual(r.calls.at(-1), ["push", "/projects"], "the list has no address");
});

test("DRIVEN: opening a project RE-DRAWS, and draws the project it just opened", () => {
  // THE HALF THAT IS EASY TO FORGET TO ASSERT, and a sweep is what found it
  // missing here: every other case in this file checks the state and the
  // address, and both of those move perfectly well with the re-draw deleted.
  // What is left is an address bar that changes while the screen does not —
  // the inverse of the defect the whole feature exists to fix, and it is the
  // pop that makes it a real failure: Back would move the URL and leave the
  // customer looking at the project they meant to leave.
  const r = loadRouter("/projects");
  r.api.openProject("site_1_abcde", "push");
  assert.deepEqual(r.drawn, ["site_1_abcde"],
    "opening a project did not re-draw the screen (or drew before it knew which project)");
  r.api.openProject(null, "push");
  assert.deepEqual(r.drawn, ["site_1_abcde", null], "going back to the list did not re-draw");
  // A pop has nothing else that could repaint: no click handler ran, no other
  // code path is involved. If openProject does not draw, Back does nothing.
  const p = loadRouter("/projects/site_9_zzzzz");
  p.api.openProject("site_9_zzzzz", "none");
  assert.deepEqual(p.drawn, ["site_9_zzzzz"], "a Back press moved the address and not the screen");
});

test("DRIVEN: a push to the address we are already on REPLACES, so Back is never a no-op", () => {
  // Re-opening the project that is already open — the Data button on the open
  // site, a re-render — would otherwise stack identical entries, and Back would
  // appear dead for as many presses as the screen was re-entered.
  const r = loadRouter("/projects/site_1_abcde");
  r.api.openProject("site_1_abcde", "push");
  assert.equal(r.calls.at(-1)[0], "replace", "an identical address was pushed as a new entry");
});

test("DRIVEN: 'none' touches history at all — which is what stops Back becoming a trap", () => {
  // popstate lands on an entry that is ALREADY in history. Pushing there adds a
  // second copy of it, so the next Back returns to the same screen, for ever.
  const r = loadRouter("/projects/site_9_zzzzz");
  r.api.openProject("site_9_zzzzz", "none");
  assert.equal(r.calls.length, 0, "a popstate navigation wrote to history");
  assert.equal(r.api.id(), "site_9_zzzzz", "the state still has to move on a pop");
  // …and 'replace' corrects the address without adding an entry.
  const r2 = loadRouter("/projects/dead");
  r2.api.openProject(null, "replace");
  assert.deepEqual(r2.calls, [["replace", "/projects"]]);
});

// ── THE WIRING ──────────────────────────────────────────────────────────────

test("openProject is the ONE way a project opens — every navigation goes through it", () => {
  // THE RECORDED TRAP THIS AVOIDS: pushing from each call site is how the fifth
  // one added later forgets, and a forgotten push is invisible — the screen is
  // right and only the address is stale. Counted rather than listed, so a new
  // navigation cannot be added without either using the function or failing here.
  const src = bare(chat);
  // `=(?!=)` and not `=\s*`: the loose form counts `===` and `!==` as well, and
  // this variable is COMPARED all over the file — a dozen matches for four
  // assignments, which reads as a wiring failure that is not there. A counter
  // whose first draft cried wolf is worse than none.
  const writes = [...src.matchAll(/(?<![\w.!<>=])siteOpenId\s*=(?!=)/g)].length;
  assert.equal(writes, 4,
    "siteOpenId is assigned " + writes + " times; expected 4 — its own `let`, the write " +
    "inside openProject, the repair in renderSites, and the boot. A fifth is a navigation " +
    "that changed the screen without moving the address.");
  // And the four navigations really do call it, each named.
  for (const [what, needle] of [
    ["a card click", "openProject(rec.id, 'push')"],
    ["a new build", "openProject(id, 'push')"],
    ["the Back arrow", "openProject(null, 'push')"],
  ]) assert.ok(src.includes(needle), what + " does not go through openProject: " + needle);
  // The Data button opens a project too, and it is the one that also sets the
  // stage — so it is asserted as a PAIR, in order, or it would open the site on
  // whatever view was last.
  const dataAt = src.indexOf("siteView = 'data';");
  assert.ok(dataAt > 0, "the Data button no longer names its view");
  assert.match(src.slice(dataAt, dataAt + 120), /openProject\(rec\.id, 'push'\)/,
    "the Data button sets the view but does not route");
});

test("Back and Forward move a screen: popstate is listened for, and it does NOT push", () => {
  const src = bare(chat);
  const at = src.indexOf("addEventListener('popstate'");
  assert.ok(at > 0, "nothing listens for popstate — Back still leaves the app");
  const body = src.slice(at, at + 400);
  assert.match(body, /projectFromPath\(\)/, "the pop does not re-read the path");
  assert.match(body, /'none'/, "the pop does not use the history-neutral mode");
  assert.ok(!/pushState/.test(body), "the pop writes to history — Back would never escape");
  // A pop to a non-project URL is another view's business, and must be left alone.
  assert.match(body, /=== undefined\) return/, "a pop away from /projects is not let through");
});

// ── THE BOOT, DRIVEN ────────────────────────────────────────────────────────

// The real boot block, cut out of chat.js and RUN. A positional guard is not
// enough here and a sweep proved it: `if (false) { … }` leaves every landmark
// in the file exactly where it was, so a check that reads their order passes
// over a boot that ignores the address entirely — every pasted link landing
// wherever that browser happened to be last, which is the one thing an address
// must not do. Landmark to landmark, the closing one searched FROM the opening
// one and both asserted (the recorded window traps).
function loadBoot(pathname, storedView) {
  // RE-ANCHORED 2026-09-12, NOT APPEASED. Both landmarks moved when the media
  // side was deleted and home became the builder: the remembered view now
  // defaults to 'sites' rather than 'home', and the unknown-view fallback moved
  // OUT of the boot and INTO showView — where it belongs, since a stale
  // localStorage value can reach showView by other doors too. The boot's own
  // property is unchanged and is what this drives: the address beats the
  // remembered view, and only when there is one. The fallback has its own case
  // below, driving showView, because this block's showView is a stub.
  const at = chat.indexOf("let lastView = 'sites';");
  assert.ok(at > 0, "the boot no longer starts from a remembered view");
  const endAt = chat.indexOf("showView(lastView);", at);
  assert.ok(endAt > at, "the boot no longer shows a view after choosing one");
  const body = chat.slice(at, chat.indexOf("\n", endAt));
  const shown = [];
  // `siteOpenId` is a module variable in chat.js; declared here so the block's
  // own assignment lands somewhere a test can read rather than on the global.
  const fn = new Function("projectFromPath", "localStorage", "VIEW_KEY", "showView",
    "let siteOpenId = null;\n" + body + "\nreturn siteOpenId;");
  const id = fn(() => (pathname === undefined ? undefined : pathname),
    { getItem: () => storedView }, "zephyr_view_v1", (v) => shown.push(v));
  return { id, shown, body };
}

test("DRIVEN: the boot lets the ADDRESS beat the remembered view — and only when there is one", () => {
  // A pasted link, in a browser that was last on the gallery. The link wins.
  const link = loadBoot("site_1784380035480_w53jb", "gallery");
  assert.deepEqual(link.shown, ["sites"],
    "a pasted project link landed on the remembered view instead of the project");
  assert.equal(link.id, "site_1784380035480_w53jb", "the boot named the screen but opened no project");
  // THE CONTROL, without which a boot that simply always showed the sites
  // screen would pass everything above: an ordinary page load still lands on
  // whatever this browser was last looking at.
  const plain = loadBoot(undefined, "gallery");
  assert.deepEqual(plain.shown, ["gallery"], "an ordinary page load was dragged to the sites screen");
  assert.equal(plain.id, null, "an ordinary page load opened a project");
  // /projects itself is the list: the sites screen, with nothing open.
  const list = loadBoot(null, "gallery");
  assert.deepEqual(list.shown, ["sites"], "/projects did not land on the sites screen");
  assert.equal(list.id, null, "/projects opened a project");
  // And the boot passes the remembered value through as it read it — the
  // fallback is showView's now, driven in the case below.
  assert.deepEqual(loadBoot(undefined, "not-a-view").shown, ["not-a-view"]);
});

test("DRIVEN: a remembered view the app no longer has lands on the builder", () => {
  // THE CASE THE MEDIA DELETION CREATED, and it is the one an ordinary customer
  // hits: their browser remembers 'gallery' from yesterday, that view does not
  // exist today, and `document.getElementById('viewGallery')` answers null — so
  // without a fallback showView would clear every view's `active` class, add it
  // to nothing, and paint an empty main. A refresh-proof preference is exactly
  // the kind of value that outlives the thing it names.
  //
  // Driven rather than read: the fallback is one `if` and the recorded trap is
  // that `if (false)` leaves every landmark where a positional guard looks for
  // it.
  const src = bare(chat);
  const at = src.indexOf("function showView(name) {");
  assert.ok(at > 0, "showView is gone");
  const end = src.indexOf("\n}", at);
  assert.ok(end > at, "showView is unterminated");
  const body = src.slice(src.indexOf("{", at) + 1, end);
  const known = /const KNOWN_VIEWS = (\[[^\]]*\])/.exec(src);
  assert.ok(known, "KNOWN_VIEWS is gone — showView has nothing to fall back from");
  const views = eval(known[1]);
  assert.ok(views.length >= 1 && views.includes("sites"), "the builder is not a known view: " + views.join(", "));

  const run = (name) => {
    const stored = [];
    const el = () => null;                 // no view element for anything
    const fn = new Function("name", "KNOWN_VIEWS", "VIEW_KEY", "localStorage", "document", "renderSites",
      "renderSettings", "body", body + "\nreturn name;");
    return { landed: fn(name, views, "zephyr_view_v1",
      { setItem: (k, v) => stored.push(v) },
      { querySelectorAll: () => [], getElementById: el, body: { classList: { toggle: () => {} } } },
      () => {}, () => {}, null), stored };
  };
  for (const gone of ["gallery", "avatar", "mediaAgent", "integrations", "home", "landing", "", "__proto__"]) {
    assert.equal(run(gone).landed, "sites", `a remembered '${gone}' did not land on the builder`);
  }
  // THE CONTROL: a view the app really has is NOT rewritten. Without it a
  // showView that always answered 'sites' would pass everything above, and
  // Settings would be unreachable.
  assert.equal(run("settings").landed, "settings", "an existing view was dragged to the builder");
  // And what it remembers is what it landed on, never the value it was handed.
  assert.deepEqual(run("gallery").stored, ["sites"], "the boot would remember a view it did not show");
});

test("the boot sets the open project BEFORE it draws", () => {
  // The one thing the drive above cannot see, because its showView is a stub:
  // the real showView('sites') renders immediately and reads siteOpenId, so
  // setting it afterwards paints the list and leaves the project unopened.
  // BLANKED FIRST, and the first draft of this case was red because it was not:
  // the block's own comment explains that the id is set before showView and
  // spells `showView('sites')` while doing so, three lines ABOVE the assignment
  // — so a raw scan found the draw first and reported correct code as broken.
  // The recorded "prose contains the thing it forbids", in a guard written for
  // this change.
  const body = bare(loadBoot(undefined, "home").body);
  const sets = body.indexOf("siteOpenId = bootProject");
  const shows = body.indexOf("showView(");
  assert.ok(sets > 0, "the boot no longer opens the project it read");
  assert.ok(shows > 0 && sets < shows, "the boot draws before it knows which project is open");
});

test("an id that names nothing corrects the address instead of leaving it lying", () => {
  // A link to a deleted project, or one belonging to another account. The list
  // is the right screen; a URL still naming the dead id is not.
  const src = bare(chat);
  const at = src.indexOf("if (siteOpenId && PROJECT_PATH.test(location.pathname))");
  assert.ok(at > 0, "the repair no longer corrects the URL");
  const body = src.slice(at, at + 200);
  assert.match(body, /replaceState/, "the repair does not correct the address");
  assert.ok(!/pushState/.test(body), "the repair pushes — a dead link would cost a Back press");
});

// ── THE SERVER ──────────────────────────────────────────────────────────────

test("the Worker serves the app for a project address, before the asset handler 404s it", () => {
  const src = bare(worker);
  const route = src.indexOf("if (PROJECT_PATH.test(url.pathname))");
  assert.ok(route > 0, "the Worker has no project route — every /projects URL is a 404");
  assert.match(src.slice(route, route + 200), /ASSETS\.fetch\(new URL\("\/", request\.url\)\)/,
    "the project route does not hand back the app's own shell");
  // ORDER IS THE WHOLE THING: the bare `ASSETS.fetch(request)` below would 404
  // a path with no file behind it, so a route placed after it never runs.
  const fallthrough = src.indexOf("return env.ASSETS.fetch(request);", route);
  assert.ok(fallthrough > route,
    "the project route sits after the asset fallthrough, where it can never run");
  // And it must not be mistaken for an API miss on the way down.
  const apiMiss = src.indexOf('if (url.pathname.startsWith("/api/"))');
  assert.ok(apiMiss > 0 && apiMiss < route, "the /api miss no longer precedes the project route");
});
