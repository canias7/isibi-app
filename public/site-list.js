// Which projects are yours: the server's answer (2026-10-30: no merging).
//
// ── WHY THIS IS ITS OWN FILE ───────────────────────────────────────────────
//
// The same reason `edit-poll.js` is: `chat.js` touches `document` at load and
// can only ever be asserted by READING it, and every decision here is one a
// wrong answer costs a customer sight of a real site — or shows them one that
// is not theirs. So it lives in a file that runs in both places: the browser
// gets a global, `node --test` gets an object it can drive with literal rows.
//
// ── WHAT WAS WRONG ─────────────────────────────────────────────────────────
//
// The start screen listed `localStorage` and nothing else, and `sitesSave`
// keeps `slice(0, 20)`. Measured 2026-09-07: the owner's account holds 51
// sites in `site_backends`, so that screen could show at most twenty of them,
// only in the browser that built them, and none at all after clearing site
// data or on a phone. The sites were live and paid for and simply invisible.
//
// ── THE RULE, AND WHICH WAY IT FAILS ───────────────────────────────────────
//
// The SERVER decides which sites exist; the LOCAL record supplies what the
// server does not have — the thread, the name the customer typed, the stored
// page HTML a legacy thumbnail draws from.
//
// And the one that matters: **a server list we could not read is not an empty
// server list.** A failed fetch, a signed-out visitor, an outage — each answers
// `ok: false`, and then this returns the local list untouched, which is exactly
// the screen that shipped before this file existed. Cannot-tell must never read
// as nothing-there; here the cost of getting that backwards is a customer
// opening the app during a blip and finding every site they own gone.
(function (root) {
  "use strict";

  // A site the server named but this browser has never seen still needs the
  // fields the grid reads. Kept deliberately small: everything here is derived
  // from the row, so there is no second copy of a site's identity to drift.
  var SITE_HOST = ".gofarther.app";

  function str(v) {
    // `String(["a"])` is `"a"` — the recorded coercion trap. Refuse a non-string
    // rather than coerce one, or a one-element array becomes a slug.
    return typeof v === "string" ? v : "";
  }

  function cleanSlug(v) {
    var s = str(v).toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 60);
    return s.replace(/^-+|-+$/g, "");
  }

  /**
   * THE WIRE'S THREE ANSWERS ABOUT BEING OFF THE WEB, kept apart. Spelled ONCE
   * so a reader cannot drift from `fromRow`'s.
   *
   * `true` off, `false` up, `undefined` the server could not tell — which it
   * says when the build read it compares the switch against failed. Anything
   * else is a shape we did not send and is never believed as either.
   */
  function readOffline(v) {
    return v === true ? true : (v === false ? false : undefined);
  }

  /**
   * THE WIRE'S THREE ANSWERS ABOUT A DATABASE (Lane 1c, 2026-09-30).
   *
   * `true` there is one, `false` there is none, and `null` the server could
   * not tell — which it says when the lookup behind the answer failed. A
   * lookup that failed must never read as "no database": the card would tell
   * the owner their site has none, which is the claim the server just refused
   * to make. Anything else is a shape we did not send and is believed as
   * neither.
   */
  function readDb(v) {
    return v === true ? true : (v === false ? false : null);
  }

  /**
   * ONE SERVER ROW → the shape the grid already reads.
   *
   * `name` is the site's CURRENT public address, which is not always its
   * storage slug — a renamed site answers at its alias, and showing the storage
   * name would print an address the customer no longer uses. `url` is built
   * from the same value so the card's thumbnail and the name can never disagree.
   */
  function fromRow(row) {
    if (!row || typeof row !== "object") return null;
    var slug = cleanSlug(row.slug);
    // A PROJECT NOT BUILT YET HAS NO ADDRESS (2026-10-30): it is its chat on
    // the server, and its `id` is that chat. Anything else needs a slug.
    var rid = str(row.id);
    var chatId = str(row.chat);
    if (!slug) {
      if (!/^[A-Za-z0-9_-]{4,80}$/.test(rid) || rid !== chatId) return null;
      var t0 = str(row.title).trim().slice(0, 80);
      var u = {
        id: rid, slug: "", chat: chatId, name: t0 || (row.surface === "app" ? "New app" : "New website"), title: t0,
        url: "", brief: str(row.brief).slice(0, 300), backend: false, offline: false, state: "unbuilt",
        createdAt: Number(row.createdAt) || 0, updatedAt: Number(row.updatedAt) || Number(row.createdAt) || 0,
        react: true, remote: true, msgs: []
      };
      if (row.surface === "app") u.surface = "app";
      return u;
    }
    var name = cleanSlug(row.name) || slug;
    // THE SITE'S OWN NAME, AS EVERY DEVICE SEES IT (2026-10-21): "The Table",
    // kept by the server; the address name when it has none.
    var title = str(row.title).trim().slice(0, 80);
    return {
      // THE SERVER'S ID FOR THE PROJECT: its chat, else `srv_<slug>`.
      id: /^[A-Za-z0-9_-]{4,80}$/.test(rid) ? rid : (/^[A-Za-z0-9_-]{4,80}$/.test(chatId) ? chatId : "srv_" + slug),
      state: "built",
      slug: slug,
      name: title || name,
      title: title,
      url: "https://" + name + SITE_HOST + "/",
      brief: str(row.brief).slice(0, 300),
      // Does this site have its own database. Read STRICTLY, and in THREE:
      // `true`, `false`, or `null` for "the server could not tell" (`readDb`).
      // Nothing but a real true is a yes, and nothing but a real false is a no.
      backend: readDb(row.db),
      // WHICH CHAT BUILT IT (2026-09-08). Carried so `merge` can put a site
      // back into the workspace that asked for it; `""` for every site built
      // before the binding existed, and for any built without one.
      chat: str(row.chat),
      // IS IT OFF THE WEB (2026-09-08, owner: "fix the offline flag on the
      // server too"). Until this, the only record of that switch was in the
      // browser that pressed it, so a site taken down on a laptop read as live
      // on a phone and the panel showed the wrong one of its two faces.
      //
      // THREE ANSWERS, KEPT APART. `true` off, `false` up, and `undefined` for
      // "the server could not tell" — which it says when the build read it
      // compares against failed. Read STRICTLY, so a shape we did not send is
      // never believed as either; the merge below decides what to do with each.
      offline: readOffline(row.offline),
      createdAt: Number(row.createdAt) || 0,
      updatedAt: Number(row.updatedAt) || Number(row.createdAt) || 0,
      // Every site the builder publishes is a React site; the grid uses this
      // to decide whether the card's iframe may run scripts.
      react: true,
      remote: true,
      msgs: [],
    };
  }

  /**
   * THE PROJECTS PAGE'S CARDS: THE SERVER'S LIST, AND NOTHING ELSE (2026-10-30).
   *
   * Owner: "the projects page shows the SERVER's list. The browser keeps a copy
   * only to paint instantly, and replaces it with the server's list as soon as
   * it answers." So there is no merging any more: every card is one server row,
   * keyed by the row's own `id` (the project's chat, or `srv_<slug>` for a site
   * built before chats were bound) - never an id this browser made up.
   *
   * `local` is this browser's working copy of each project (its thread, the
   * name typed, the stored pages a thumbnail can draw). It is ATTACHED to the
   * row it belongs to - by the row's id, its chat, then its slug - and never
   * adds a card of its own, with one exception: a record this browser made that
   * has not reached the server yet (`srv !== true`, no address) is drawn and
   * marked `localOnly`, so nobody's work vanishes while it is being saved up.
   *
   * `rows` null means the server has never answered (and no copy is cached):
   * only those unsaved records are drawn. `gone` holds slugs and ids deleted in
   * this page's life, never drawn again from a list read before the delete.
   *
   * Newest first, by the server's own time.
   */
  function projects(rows, local, gone) {
    var isGone = function (v) {
      if (!v || !gone) return false;
      return typeof gone.has === "function" ? gone.has(v) : (Array.isArray(gone) && gone.indexOf(v) !== -1);
    };
    var mine = Array.isArray(local) ? local.filter(function (m) { return m && typeof m === "object"; }) : [];
    var byId = Object.create(null);
    var bySlug = Object.create(null);
    for (var i = 0; i < mine.length; i++) {
      var id0 = str(mine[i].id);
      if (id0 && !byId[id0]) byId[id0] = mine[i];
      var s0 = cleanSlug(mine[i].slug);
      if (s0 && !bySlug[s0]) bySlug[s0] = mine[i];
    }
    var out = [];
    var used = new Set();
    var seen = Object.create(null);
    var list = Array.isArray(rows) ? rows : [];
    for (var j = 0; j < list.length; j++) {
      var made = fromRow(list[j]);
      if (!made || seen[made.id] || isGone(made.id) || (made.slug && isGone(made.slug))) continue;
      seen[made.id] = true;
      var have = byId[made.id] || (made.chat && byId[made.chat]) || (made.slug && bySlug[made.slug]) || null;
      if (have && used.has(have)) have = null;       // one record, one card
      if (have) used.add(have);
      if (!have) { out.push(made); continue; }
      var slug = made.slug || cleanSlug(have.slug);
      out.push(Object.assign({}, have, {
        id: made.id,
        localId: str(have.id),
        chat: made.chat,
        slug: slug,
        url: made.slug ? made.url : str(have.url),
        remote: true,
        state: made.state,
        name: made.title || (made.slug ? (have.name && have.name !== "New website" ? str(have.name) : made.name) : (str(have.name) || made.name)),
        brief: made.brief || str(have.brief),
        // A DATABASE IS NEVER TAKEN AWAY: a build that just made one says yes
        // here a minute before the list does; the server's cannot-tell stays.
        backend: (made.backend === true || have.backend === true) ? true : made.backend,
        offline: offlineNow(made.offline, have.offline),
        updatedAt: made.updatedAt || Number(have.updatedAt) || 0
      }));
    }
    for (var k = 0; k < mine.length; k++) {
      var m = mine[k];
      if (used.has(m) || m.srv === true || cleanSlug(m.slug) || isGone(str(m.id))) continue;
      out.push(Object.assign({}, m, { localOnly: true }));
    }
    out.sort(function (a, b) {
      return (Number(b.updatedAt) || Number(b.createdAt) || 0)
           - (Number(a.updatedAt) || Number(a.createdAt) || 0);
    });
    return out;
  }

  /**
   * THE RECORDS THIS BROWSER HOLDS FOR PROJECTS THE SERVER NO LONGER HAS: a
   * project deleted on another device. Only when the server's answer is
   * `complete`, only records the server confirmed once (`srv`) before the list
   * was asked for (`srvAt < askedAt`), so a project made a moment ago is never
   * taken for one deleted. Returns their ids; the caller drops them.
   */
  function deletedElsewhere(rows, local, complete, askedAt) {
    if (complete !== true || !Array.isArray(rows) || !Array.isArray(local)) return [];
    var ids = Object.create(null);
    var slugs = Object.create(null);
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (!r || typeof r !== "object") continue;
      if (str(r.id)) ids[str(r.id)] = true;
      if (str(r.chat)) ids[str(r.chat)] = true;
      if (cleanSlug(r.slug)) slugs[cleanSlug(r.slug)] = true;
    }
    var out = [];
    for (var j = 0; j < local.length; j++) {
      var m = local[j];
      if (!m || m.srv !== true || !(Number(m.srvAt) < Number(askedAt))) continue;
      if (ids[str(m.id)] || (cleanSlug(m.slug) && slugs[cleanSlug(m.slug)])) continue;
      out.push(str(m.id));
    }
    return out;
  }

  /**
   * IS THIS SITE OFF THE WEB — THE RULE, IN ONE PLACE.
   *
   * `said` is the server's three-valued answer for this site; `local` is the
   * flag `siteSetLive` wrote in this browser.
   *
   * THE SERVER WINS WHERE IT CAN TELL, and that is the opposite of the `backend`
   * rule in `merge` — worth stating rather than pattern-matching, because the
   * two sit three lines apart. A database is never taken away, so a
   * disagreement there is always the local record being ahead and either side's
   * yes is a yes. Offline moves in BOTH directions, so the same rule would pin
   * a site off the web for ever after one press. And it is the server's answer
   * that this whole field exists for: it is the only one every machine shares,
   * where the local flag was written by whichever browser last pressed.
   *
   * THE LOCAL FLAG STANDS ONLY ON `undefined` — cannot-tell reading as "live"
   * would tell somebody their site is up while it is down, on the one field
   * whose whole job is to say which.
   */
  function offlineNow(said, local) {
    var s = readOffline(said);
    return s === undefined ? local === true : s;
  }

  /**
   * THE SAME ANSWER, FOR ONE SITE, asked by whatever is about to show it.
   *
   * `sitePublishPanel` reads the LOCAL record — `siteById` searches
   * localStorage and nothing else — so without this the server's answer would
   * reach the grid, be preferred there, and never reach the one screen that
   * actually draws the two faces. That is this repository's recorded wiring
   * trap: a value forwarded and read by one consumer of two.
   *
   * It shares `offlineNow` with `merge` rather than repeating the comparison,
   * so the panel and the card can never disagree about a site.
   */
  function offlineFor(rows, site) {
    var want = cleanSlug(site && site.slug);
    var said;
    if (want && Array.isArray(rows)) {
      for (var i = 0; i < rows.length; i++) {
        var r = rows[i];
        if (r && typeof r === "object" && cleanSlug(r.slug) === want) { said = r.offline; break; }
      }
    }
    return offlineNow(said, site && site.offline);
  }

  /**
   * RECORD, IN THE CACHED COPY OF THE SERVER'S ANSWER, WHAT THE SERVER JUST SAID.
   *
   * `siteSetLive` writes the local record the moment its POST comes back ok, and
   * the server list is cached for a minute — so without this the merge above
   * would spend that minute preferring a row read BEFORE the press over a switch
   * that has already landed, and the panel would show the face the press just
   * changed. The rule that makes the server authoritative is what makes this
   * necessary; they are one decision.
   *
   * It invents nothing: the switch answered `ok`, so the row's own answer IS
   * what is written here. A NEW array comes back and the caller's rows are never
   * mutated, since a render already reading them must not see a list change
   * under it. A slug that is not a usable one leaves every row alone rather than
   * matching a first row by accident.
   */
  function markOffline(rows, slug, off) {
    if (!Array.isArray(rows)) return rows;
    var want = cleanSlug(slug);
    if (!want) return rows;
    return rows.map(function (r) {
      if (!r || typeof r !== "object" || cleanSlug(r.slug) !== want) return r;
      // `fromRow` reads this strictly, so it is written strictly.
      return Object.assign({}, r, { offline: off === true });
    });
  }

  /**
   * WHAT A CARD'S THUMBNAIL SHOWS (2026-10-30), in one place so a re-render
   * and the first paint cannot disagree. `draft` is the draft preview's
   * address when one has been read ready ("" or absent when not), `home` the
   * stored page's HTML. A draft that is ahead wins; then the live address;
   * then the stored HTML; and a card with none of them is `empty` — drawn as
   * a placeholder rather than a blank white frame.
   */
  function cardThumb(site, draft, home) {
    if (!site || typeof site !== "object") return { kind: "empty" };
    if (typeof draft === "string" && draft && site.slug) return { kind: "src", value: draft };
    if (site.react && typeof site.url === "string" && site.url) return { kind: "src", value: site.url };
    if (typeof home === "string" && home) return { kind: "srcdoc", value: home };
    return { kind: "empty" };
  }

  var api = {
    cardThumb: cardThumb,
    projects: projects, deletedElsewhere: deletedElsewhere, fromRow: fromRow, cleanSlug: cleanSlug, SITE_HOST: SITE_HOST, readDb: readDb,
    offlineNow: offlineNow, offlineFor: offlineFor, markOffline: markOffline,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.SiteList = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
