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

  var api = { merge: merge, fromRow: fromRow, cleanSlug: cleanSlug, SITE_HOST: SITE_HOST };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.SiteList = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
