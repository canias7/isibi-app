// Which sites are yours: the server's answer, merged with this browser's.
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
    if (!slug) return null;
    var name = cleanSlug(row.name) || slug;
    return {
      id: "srv_" + slug,
      slug: slug,
      name: name,
      url: "https://" + name + SITE_HOST + "/",
      brief: str(row.brief).slice(0, 300),
      // Does this site have its own database. Read STRICTLY — the wire says
      // `db: !!r.neon_db`, a real boolean, so anything else is a shape we did
      // not send and must not be believed as a yes.
      backend: row.db === true,
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
   * MERGE. `ok` is whether the server was actually asked and answered.
   *
   * Returns newest first, by whatever the entry knows about when it last moved.
   */
  function merge(local, server, ok) {
    var mine = Array.isArray(local) ? local.slice() : [];
    if (!ok) return mine;                       // the whole safety argument, above
    var rows = Array.isArray(server) ? server : [];

    var bySlug = Object.create(null);
    // AND BY THE CHAT THAT BUILT IT. A local record's `id` IS the chat id —
    // `siteCreate` mints it per workspace — so this is the workspace a server
    // row belongs to, when the row says.
    var byChat = Object.create(null);
    for (var i = 0; i < mine.length; i++) {
      var s = mine[i] && cleanSlug(mine[i].slug);
      // `Object.hasOwn`-safe by construction: a null-prototype map cannot be
      // reached through "constructor" (the recorded truthy-prototype trap).
      if (s && !bySlug[s]) bySlug[s] = mine[i];
      var c = str(mine[i] && mine[i].id);
      if (c && !byChat[c]) byChat[c] = mine[i];
    }

    var out = [];
    var seen = Object.create(null);
    var adopted = Object.create(null);
    for (var j = 0; j < rows.length; j++) {
      var made = fromRow(rows[j]);
      if (!made || seen[made.slug]) continue;
      seen[made.slug] = true;
      // SLUG FIRST, THEN THE CHAT. The slug is the stronger match: it is what
      // the two records are actually about, and a workspace whose record
      // already carries it needs nothing else.
      //
      // THE CHAT IS THE FALLBACK, AND IT IS THE ONE THAT FIXES THE REPORTED
      // BUG. A build whose answer never came back leaves a local record with a
      // thread, a name and NO slug; the server has the site with its chat on
      // it. Matched by slug alone those are two cards — the workspace the
      // customer typed in, still looking unfinished, and the finished site
      // sitting beside it as a stranger. Matched by chat they are one, and the
      // adopted record keeps its own `id`, so the workspace stays the workspace.
      //
      // The `made.chat ?` half is a BELT behind the loop above, which refuses to
      // store an empty key — so neither wall is observable while the other
      // stands, driven both ways rather than assumed. Said out loud instead of
      // pretending a guard covers it: what it costs is nothing, and what it buys
      // is that the read stays right if the store's rule ever loosens.
      var have = bySlug[made.slug] || (made.chat ? byChat[made.chat] : null);
      // The local record WINS on everything it alone knows — the thread, the
      // name the customer typed, the stored pages — and the server wins on
      // existence and on the address, which only it can be right about.
      if (have) adopted[str(have.id)] = true;
      out.push(have ? Object.assign({}, have, {
        slug: made.slug,
        url: made.url,
        remote: true,
        name: str(have.name) || made.name,
        // EITHER SIDE SAYING YES IS A YES, and the asymmetry is the point: a
        // build that just finished sets this locally, the server list is a
        // minute stale, and no path ever takes a database away — so a
        // disagreement is the local record being AHEAD, never the server
        // correcting it. Wrong toward "no" dims a button that works; wrong
        // toward "yes" opens a Data view with nothing in it.
        backend: made.backend || have.backend === true,
        // AND THIS ONE IS THE OPPOSITE RULE, for a reason worth stating rather
        // than pattern-matching off the line above. Offline moves in BOTH
        // directions — a site goes off the web and comes back — so "either
        // side's yes" would pin it offline for ever after one press. The
        // server's answer IS the point of this field: it is the only one every
        // machine shares, and the local flag was written by whichever browser
        // last pressed the button.
        //
        // So the server wins where it can tell, and the local record stands
        // only where it said `undefined` — cannot-tell reading as "live" would
        // tell somebody their site is up while it is down, which is the one
        // mistake this field exists to prevent. Read strictly on both sides.
        offline: offlineNow(made.offline, have.offline),
        updatedAt: Math.max(Number(have.updatedAt) || 0, made.updatedAt),
      }) : made);
    }

    // A LOCAL SITE WITH NO SLUG IS A BUILD IN FLIGHT. It is not on the server
    // yet — the slug is claimed when the design lands — so dropping it would
    // make the card vanish under the customer while they watch it build.
    for (var k = 0; k < mine.length; k++) {
      if (cleanSlug(mine[k] && mine[k].slug)) continue;
      // …UNLESS THE SERVER JUST CLAIMED IT BY CHAT. Without this the record
      // adopted three lines up would ALSO be pushed here as an in-flight build,
      // and the customer would see the same workspace twice — once finished and
      // once still spinning. `adopted` is keyed by the chat id, which is the
      // only thing the two halves have in common when there is no slug.
      if (adopted[str(mine[k] && mine[k].id)]) continue;
      out.push(mine[k]);
    }

    // A local site whose slug the server did NOT list is not shown: it is gone,
    // or it belongs to another account signed in on this browser. Its local
    // record is left alone — this decides the SCREEN, never the store.
    out.sort(function (a, b) {
      return (Number(b.updatedAt) || Number(b.createdAt) || 0)
           - (Number(a.updatedAt) || Number(a.createdAt) || 0);
    });
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

  var api = {
    merge: merge, fromRow: fromRow, cleanSlug: cleanSlug, SITE_HOST: SITE_HOST,
    offlineNow: offlineNow, offlineFor: offlineFor, markOffline: markOffline,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.SiteList = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
