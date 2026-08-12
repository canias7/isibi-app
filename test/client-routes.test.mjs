// Every route the app calls must be one the Worker has.
//
// WHY THIS EXISTS. `public/chat.js` had an Unpublish button that POSTed
// `/api/site/unpublish`, a path with ZERO occurrences in `worker.js`. It had been
// there for months. On the 404 it told the owner "couldn't take it offline just
// now — try again", so the site stayed up and they retried forever. Its two
// neighbours in the same panel were equally absent, and the publish button posted
// `p.html`, the D1-era page format deleted 2026-07-27.
//
// NOTHING COULD SEE IT. `chat.js` is a plain script that no test imports, the
// route is a string, and a 404 from `apiFetch` is indistinguishable from
// `assertOwner` refusing a slug that is not yours — which this repo has already
// recorded as the reason the custom-domain API stayed dead through a live probe.
//
// So it is a source-read, derived at both ends, and it is a RATCHET rather than
// an allow-list: the dead set must be EXACTLY the ones below, so a new dead route
// goes red AND fixing one of these forces the list to shrink rather than quietly
// staying green.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const CHAT = fs.readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");
const WORKER = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");

/**
 * KNOWN DEAD AND TRACKED — relics of the D1 site runtime deleted 2026-07-27.
 *
 * Listed rather than hidden. Each is behind an owner panel that will report a
 * failure the moment somebody opens it, and each needs a product decision
 * (rebuild it, or take the panel away) rather than a quick route. They are NOT
 * an exemption for anything new.
 */
const KNOWN_DEAD = [
  "/api/site/collections", // the Database panel's collections card
  "/api/site/functions",   // the site-functions panel, from the deleted verb menu
  "/api/site/preview",     // posts `html` — the D1 page format
  "/api/site/scan",        // posts `p.html` — same
];

/** Comments blanked, so a comment EXPLAINING a dead route is not a finding. */
function code(src) {
  return src.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (m) => " ".repeat(m.length));
}

function clientRoutes() {
  const c = code(CHAT);
  const out = new Set();
  // A literal path is the only shape this can check. A template with a slug in
  // it (`'/api/site/' + slug + '/edit'`) is caught by the second test below.
  for (const m of c.matchAll(/apiFetch\(\s*'(\/api\/[a-z0-9/_.-]+)/gi)) out.add(m[1]);
  return [...out].sort();
}

test("the scan finds the routes it is supposed to — it is not silently matching nothing", () => {
  const routes = clientRoutes();
  assert.ok(routes.length > 20, "found only " + routes.length + " client routes, so the pattern has stopped matching");
  assert.ok(routes.includes("/api/credits"), "a route the app definitely calls is missing from the scan");
});

test("EVERY LITERAL ROUTE THE APP CALLS EXISTS IN THE WORKER", () => {
  const dead = clientRoutes().filter((p) => !WORKER.includes(p.replace(/\/$/, "")));
  const unexpected = dead.filter((p) => !KNOWN_DEAD.includes(p));
  assert.deepEqual(unexpected, [],
    "the app calls " + unexpected.join(", ") + " and the Worker has no such route — a button that 404s and tells the owner to try again");
});

test("…and the known-dead list is a RATCHET, not a hiding place", () => {
  // A route that has been fixed must leave this list, or the list slowly stops
  // describing anything and the next dead route hides behind its length.
  const dead = clientRoutes().filter((p) => !WORKER.includes(p.replace(/\/$/, "")));
  const revived = KNOWN_DEAD.filter((p) => !dead.includes(p));
  assert.deepEqual(revived, [],
    revived.join(", ") + " now exists in the Worker — take it out of KNOWN_DEAD");
});

test("the SLUG-SCOPED owner routes the app builds by concatenation all exist", () => {
  // These never appear as a literal, so the first test cannot see them: the app
  // writes `'/api/site/' + encodeURIComponent(slug) + '/edit'`. The suffix is
  // what identifies the route, and it must be one the Worker matches.
  const c = code(CHAT);
  const suffixes = new Set();
  for (const m of c.matchAll(/'\/api\/site\/'\s*\+[^;]{0,120}?\+\s*'\/([a-z][a-z0-9/-]{0,40})'/gi)) {
    suffixes.add(m[1].split("/")[0].replace(/\?.*$/, ""));
  }
  assert.ok(suffixes.size >= 5, "found only " + suffixes.size + " slug-scoped routes, so this scan is not scanning");
  for (const suffix of suffixes) {
    // The Worker declares them as a matcher: /^\/api\/site\/([a-z0-9]…)\/edit$/
    const declared = new RegExp("\\\\/api\\\\/site\\\\/\\(\\[a-z0-9\\]\\[a-z0-9-\\]\\{0,80\\}\\)\\\\/" + suffix + "\\b");
    assert.ok(declared.test(WORKER) || WORKER.includes("/" + suffix + "$/i"),
      "the app calls /api/site/<slug>/" + suffix + " and the Worker declares no matcher for it");
  }
});

test("THE OFFLINE BUTTON IS WIRED TO THE ROUTE THAT EXISTS", () => {
  // The specific fix, held at both ends. Either half alone passes while the wire
  // is cut — which is exactly how the old one survived.
  const c = code(CHAT);
  assert.match(c, /apiFetch\('\/api\/site\/' \+ encodeURIComponent\(slug\) \+ '\/offline'/,
    "the client no longer posts to the offline route");
  assert.match(WORKER, /\\\/offline\$\/i\)/, "the Worker no longer declares the offline matcher");
  assert.ok(!/siteUnpublish|sitePublish\(/.test(c),
    "the dead publish/unpublish functions are back");
});

test("THE CLIENT RENDERS THE SERVER'S OWN REFUSAL, never a generic retry", () => {
  // The server is the only side that knows there was no saved copy to put back.
  // A generic "try again" there sends the owner round a loop that cannot
  // succeed — which is the exact failure of the button this replaces, and a
  // mutation swapping `d.msg` for a fixed string survived the whole suite.
  const c = code(CHAT);
  const from = c.indexOf("function siteSetLive(");
  assert.ok(from > 0, "siteSetLive is gone");
  const block = c.slice(from, c.indexOf("\n}", c.indexOf("}).catch(", from)));
  assert.match(block, /t: d\.msg \|\|/, "the failure branch does not render the server's message");
  assert.equal((block.match(/d\.msg/g) || []).length, 2,
    "both the success and the failure branch must prefer the server's wording");
});

test("A PUBLISHED SITE MAY FRAME THE VIDEO HOSTS ITS OWN COMPONENT USES", () => {
  // `VideoEmbed` is in the generator's component list with a documented
  // signature, so the model is actively told to use it — and it emits an iframe
  // at these two hosts. Without them the page typechecks, bundles, publishes and
  // renders NOTHING, which is this repo's signature failure shape.
  const m = /"frame-src ([^"]+)"/.exec(WORKER.slice(WORKER.indexOf("const publishedSite =")));
  assert.ok(m, "the published-site frame-src is gone");
  const policy = m[1];
  for (const host of ["https://www.youtube-nocookie.com", "https://player.vimeo.com"]) {
    assert.ok(policy.includes(host), "a site cannot frame " + host + ", so VideoEmbed renders nothing");
  }
  // …and the map hosts the same list already carried are still there, or this
  // assertion passes on a policy that traded one broken embed for another.
  for (const host of ["https://www.openstreetmap.org", "https://maps.google.com"]) {
    assert.ok(policy.includes(host), "the map hosts were dropped: " + host);
  }
});

test("the video hosts are the PRIVACY-PRESERVING ones the component chose", () => {
  // youtube-nocookie and Vimeo-with-dnt are what `video-embed.tsx` emits
  // deliberately, so a small business's site does not drop a tracking cookie on
  // somebody who never pressed play. Naming plain youtube.com here would widen
  // the policy past what the component needs AND undo that.
  const m = /"frame-src ([^"]+)"/.exec(WORKER.slice(WORKER.indexOf("const publishedSite =")));
  assert.ok(!/https:\/\/www\.youtube\.com/.test(m[1]), "the cookie-setting YouTube host is on the policy");
  const embed = fs.readFileSync(new URL("../builder/lovable/template/src/components/ui/video-embed.tsx", import.meta.url), "utf8");
  assert.match(embed, /youtube-nocookie\.com/, "the component no longer uses the host the policy allows");
  assert.match(embed, /player\.vimeo\.com/);
});

test("a delete that answers 'already gone' clears the card instead of asking for a retry", () => {
  // THE SAME FAILURE THIS FILE WAS WRITTEN FOR, one layer along: a button whose
  // only outcome is "try again in a moment" on a call that can never succeed.
  // The backend row IS the ownership record, so a site already taken down has no
  // row and `DELETE /api/site/<slug>` answers 404 — forever. The card told the
  // owner it was "still live", which was untrue, and no amount of retrying could
  // clear it. Measured live 2026-08-12 on `pulse-fitness`: no row in
  // `site_backends`, the subdomain answering 404, the card unremovable.
  const del = CHAT.slice(CHAT.indexOf("data-del"));
  const block = del.slice(0, del.indexOf("function siteCreate"));
  assert.ok(block.includes("/api/site/"), "the delete button no longer calls the real route — rescope this");
  // CARVED INTO THE THREE BRANCHES, because a window measured in characters
  // runs straight into the next one: a first draft asserted `alert(` within 400
  // chars of the 404 check and passed with that alert DELETED, satisfied by the
  // 403 branch's alert below it. Three of four mutants survived that way. Each
  // branch is now bounded by the next condition, so nothing is proved by its
  // neighbour.
  const i404 = block.indexOf("dr.status === 404");
  const i403 = block.indexOf("dr.status === 403");
  const iFail = block.indexOf("!dr || !dr.ok");
  assert.ok(i404 > 0, "an already-gone site still fails the delete, so its card can never be removed");
  assert.ok(i403 > i404, "a site owned by another account is no longer told apart from one already gone");
  assert.ok(iFail > i403, "a real failure no longer keeps the card, so a live site can be dropped from the list");

  // ALREADY GONE: says so, and does NOT return — falling through is what clears
  // the card. "We took your site down" and "there was nothing left of it" are
  // different facts, and the 2026-08-08 bug was a client that dropped the record
  // on a 404 without telling anybody.
  const gone = block.slice(i404, i403);
  assert.match(gone, /alert\(/, "the card is cleared silently, which is how a failed takedown reads as a successful one");
  assert.doesNotMatch(gone, /\breturn;/, "it still bails out, so the card survives the one status that means it should not");

  // NOT YOURS: says so, and DOES return. Clearing the card here would hide an
  // ownership bug rather than report one.
  const theirs = block.slice(i403, iFail);
  assert.match(theirs, /alert\(/, "another account's site is dropped with no explanation");
  assert.match(theirs, /\breturn;/, "another account's site is silently dropped from the list");

  // A REAL FAILURE: says so, and DOES return, which is the behaviour that was
  // already right and must survive the change above it.
  const failed = block.slice(iFail, iFail + 400);
  assert.match(failed, /alert\([\s\S]*?\breturn;/, "a failed takedown no longer keeps the site in the list to retry");
});

// ─────────────────────────────────────────────────────────────────────────
// A CARD THAT IS "OFF" WHILE ITS ROUTE IS LIVE.
//
// `DEAD_PANELS` forces a Cloud card to render an Off badge and strips its click
// handler, which is the honest thing to do for a panel whose backend went with
// the D1 runtime. The failure is the OTHER direction: `versions` stayed in that
// list for four days after the archive, the 10-version retention and
// `POST /api/site/<slug>/versions/restore` all shipped and `siteVersions` was
// rewired to call them. So the whole rollback feature was live end to end on
// the server and unreachable in the product — and the comment four lines above
// the list says to flip a name out the moment its route exists again.
//
// Derived from the route table rather than a list of names: any panel disabled
// while the Worker really answers for it is the same bug.
//
// SPELLED THE WAY worker.js SPELLS IT. These routes are regex literals there,
// so every slash is written `\/` — a pattern with bare slashes matches nothing
// and the whole check passes vacuously. That is what the not-vacuous test below
// is for.
const PANEL_ROUTES = {
  versions: /\\\/versions\(/,
  security: /\\\/events\$/,
  functions: /\\\/functions\$/,
  emails: /\\\/emails\$/,
};

test("no Cloud panel is switched off while its route is live", () => {
  const block = CHAT.slice(CHAT.indexOf("const DEAD_PANELS = {"));
  const list = block.slice(0, block.indexOf("};"));
  assert.ok(list.length > 40 && list.length < 1200, "DEAD_PANELS was not found whole: " + list.length);
  const off = [...list.matchAll(/^\s*([a-z]+):\s*'/gm)].map((m) => m[1]);
  assert.ok(off.length, "the DEAD_PANELS scan matched nothing — it cannot report a stale entry");
  for (const name of off) {
    const re = PANEL_ROUTES[name];
    // A panel nobody has mapped is not asserted about — the alternative is a
    // false alarm on a card whose route genuinely does not exist, which teaches
    // people to delete the check.
    if (!re) continue;
    assert.ok(!re.test(WORKER),
      "the " + name + " panel is disabled but worker.js answers its route — flip it out of DEAD_PANELS");
  }
});

test("the panel-route map is not vacuous", () => {
  // The check above passes trivially if every regex stopped matching. At least
  // one mapped panel must have a route in the Worker today — `versions` does,
  // which is the whole reason this test exists.
  const live = Object.entries(PANEL_ROUTES).filter(([, re]) => re.test(WORKER)).map(([n]) => n);
  assert.ok(live.includes("versions"), "the versions route vanished from worker.js: " + JSON.stringify(live));
});

// EVERY CLICKABLE CLOUD CARD HAS SOMEWHERE TO GO.
//
// The Members card was clickable, promised "Accounts that sign up in your app",
// and fell through the `data-cloud` dispatch to `else siteInbox(site)` — the
// form-submissions modal — while the server implemented list, role, suspend,
// reinstate and remove. Nothing could see it: a card with no branch does not
// error, it opens the wrong thing.
test("every cloud card name has a branch in the dispatch", () => {
  const dispatch = CHAT.slice(CHAT.indexOf("view.querySelectorAll('[data-cloud]')"));
  const body = dispatch.slice(0, dispatch.indexOf("  });"));
  assert.ok(body.includes("else siteInbox"), "the cloud dispatch was not found whole");
  const handled = new Set([...body.matchAll(/dataset\.cloud === '([a-z]+)'/g)].map((m) => m[1]));
  assert.ok(handled.size >= 8, "the dispatch scan found too few branches: " + handled.size);

  // The card rows carry their name as the 5th element of a literal array.
  const cardsBlock = CHAT.slice(CHAT.indexOf("const cards = ["));
  const cards = cardsBlock.slice(0, cardsBlock.indexOf("\n  ];"));
  // The card's dispatch name is the LAST element of each row literal.
  const named = [...cards.matchAll(/,\s*'([a-z]+)'\s*\],/g)].map((m) => m[1]);
  assert.ok(named.length >= 8, "the card scan found too few cards: " + named.length);

  // A DISABLED CARD NEEDS NO BRANCH — it is never clickable, which is the whole
  // point of `DEAD_PANELS`. The bug is a card that IS clickable and lands on the
  // fallback, which is what the Members card did while promising member
  // accounts. Read from the same list the check above reads, so the two cannot
  // disagree about which cards are switched off.
  const deadBlock = CHAT.slice(CHAT.indexOf("const DEAD_PANELS = {"));
  const dead = new Set([...deadBlock.slice(0, deadBlock.indexOf("};")).matchAll(/^\s*([a-z]+):\s*'/gm)].map((m) => m[1]));
  assert.ok(dead.size, "the DEAD_PANELS scan matched nothing, so every card would be treated as live");

  // `inbox` is the deliberate fallback — everything else that is live must be named.
  const missing = named.filter((n) => !handled.has(n) && n !== "inbox" && !dead.has(n));
  assert.deepEqual(missing, [], "these cards are clickable and open the fallback modal instead of their own panel: " + missing.join(", "));

  // AND THE CHECK MUST BE ABLE TO FAIL: at least one live card has to be in the
  // scan, or an exemption list that swallowed everything would read as green.
  assert.ok(named.some((n) => !dead.has(n) && n !== "inbox"), "every card was exempted — this check proves nothing");
  assert.ok(handled.has("members"), "the Members card lost its branch again");
});

// ─────────────────────────────────────────────────────────────────────────
// THE CLIENT AND THE LANES MUST AGREE ABOUT WHAT A PAGE PATH LOOKS LIKE.
//
// `sitePathOf` anchored on `^src/routes/` while the edit and addon lanes return
// the BARE stored path (`gallery.tsx`) — `cleanPath` strips the prefix on the
// way in and the container puts it back. So every added/changed/removed/kept
// path mapped to '' and was filtered away: new pages never entered the page
// picker, deleted pages never left it, and the replies named no pages at all.
// `routeOf` in site-addon.mjs was fixed for exactly this and this copy was not
// — the FIFTH instance of one shape being read by code anchored on the other.
//
// Driven through the REAL producer, not a hand-written fixture: two fixtures
// agree with each other and with neither. `validatePages` decides the stored
// path, `routeOf` reads it back on the server, and `sitePathOf` reads it back in
// the browser — all three have to answer the same thing.
test("sitePathOf reads both path shapes, like routeOf", async () => {
  const { routeOf } = await import("../builder/site-addon.mjs");

  // Lifted out of chat.js, which no test can import.
  const m = CHAT.match(/function sitePathOf\(file\) \{[\s\S]*?\n\}/);
  assert.ok(m, "sitePathOf was not found in chat.js");
  const sitePathOf = new Function("return " + m[0])();

  for (const bare of ["index.tsx", "gallery.tsx", "shop/index.tsx", "shop/item.tsx"]) {
    const prefixed = "src/routes/" + bare;
    const want = routeOf(bare);
    assert.ok(want, "routeOf could not read the stored shape " + bare);
    assert.equal(sitePathOf(bare), want, "the client dropped the stored shape " + bare);
    assert.equal(sitePathOf(prefixed), want, "the client dropped the build shape " + prefixed);
  }
  // Still refuses what is not a page, or the picker fills with junk.
  assert.equal(sitePathOf(""), "");
  assert.equal(sitePathOf("styles.css"), "");
});

// THE SERVER'S OWN 402 SENTENCE IS THE ONE THAT NAMES THE FREE WAY OUT.
//
// `buildFloor` answers with the floor, the balance and "switch the Builder to
// Sonnet 5" — its comment says naming the cheaper picker is the point, because
// topping up "is not the only way out and is the less useful one". The client
// discarded it and printed a generic top-up prompt, sending somebody to buy
// credits instead of flipping a control back.
test("the build 402 prefers the server's message", () => {
  const i = CHAT.indexOf("r.status === 402 || (d && d.need === 'credits')");
  assert.ok(i > 0, "the 402 branch was not found");
  const branch = CHAT.slice(i, CHAT.indexOf("} else if", i + 10));
  assert.match(branch, /d\.msg/, "the 402 branch must render the server's own sentence");
  assert.match(branch, /\|\|/, "…with a fallback, for the 402s that carry no message");
});

// A REACT SITE'S RESTORE GOES TO THE SERVER, NEVER TO localStorage.
//
// `siteRestore` rewrites the local page-stub list and prints "↩ Restored to: …".
// For a React site that is a lie the customer cannot see through: the preview
// iframe loads the LIVE url, so it shows the build they were trying to undo
// while the message says it worked — and `s.pages` is replaced with an older
// build's stubs, desyncing the page picker from what is published. `siteSnap`
// runs on every successful react build, so the rail was populated on every
// React site and the button reachable on all of them.
//
// This is the failure the 2026-08-08 work recorded as fixed, still live one
// button over. There is ONE thing that restores a published site and this must
// hand off to it.
test("siteRestore sends a React site to the real restore", () => {
  const m = CHAT.match(/function siteRestore\(id, idx\) \{[\s\S]*?\n\}/);
  assert.ok(m, "siteRestore was not found");
  const body = m[0];
  const hand = body.indexOf("siteVersions(");
  assert.ok(hand > 0, "a React site must be handed to siteVersions, not restored locally");
  // BEFORE anything is written, or it lies and then also corrupts the local
  // page list on the way out.
  const write = body.indexOf("s.pages =");
  assert.ok(write > 0, "the local restore was not found — has this been rewritten?");
  assert.ok(hand < write, "the React hand-off must come before the local rewrite");
  assert.match(body.slice(0, hand + 40), /s\.react/, "the hand-off must be gated on the site being a React one");
});

// WHOSE ROWS THESE ARE IS THE SERVER'S ANSWER, NOT A NAME RE-DERIVED HERE.
//
// `canAdd` compared the access string against 'user'/'feed'. Since the
// read/write axes landed, a table declared as a pair (`{read:"own",
// write:"own"}`) is stamped "collect" and matches neither — so the owner was
// offered "+ Add" on exactly the tables where the API answers 409. The write
// axis is resolved once in site-access.mjs and sent as `memberRows`; a second
// copy of that rule in the browser is a second thing that can disagree with it.
test("the Data panel asks memberRows, not the access name", () => {
  const i = CHAT.indexOf("const canAdd = ");
  assert.ok(i > 0, "canAdd was not found");
  const line = CHAT.slice(i, CHAT.indexOf("\n", i));
  assert.match(line, /memberRows/, "canAdd must use the server's own answer: " + line.trim());
  assert.ok(!/access !== '(user|feed)'/.test(line), "canAdd re-derives from the access name: " + line.trim());
});
