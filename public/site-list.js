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
    for (var i = 0; i < mine.length; i++) {
      var s = mine[i] && cleanSlug(mine[i].slug);
      // `Object.hasOwn`-safe by construction: a null-prototype map cannot be
      // reached through "constructor" (the recorded truthy-prototype trap).
      if (s && !bySlug[s]) bySlug[s] = mine[i];
    }

    var out = [];
    var seen = Object.create(null);
    for (var j = 0; j < rows.length; j++) {
      var made = fromRow(rows[j]);
      if (!made || seen[made.slug]) continue;
      seen[made.slug] = true;
      var have = bySlug[made.slug];
      // The local record WINS on everything it alone knows — the thread, the
      // name the customer typed, the stored pages — and the server wins on
      // existence and on the address, which only it can be right about.
      out.push(have ? Object.assign({}, have, {
        slug: made.slug,
        url: made.url,
        remote: true,
        name: str(have.name) || made.name,
        updatedAt: Math.max(Number(have.updatedAt) || 0, made.updatedAt),
      }) : made);
    }

    // A LOCAL SITE WITH NO SLUG IS A BUILD IN FLIGHT. It is not on the server
    // yet — the slug is claimed when the design lands — so dropping it would
    // make the card vanish under the customer while they watch it build.
    for (var k = 0; k < mine.length; k++) {
      if (!cleanSlug(mine[k] && mine[k].slug)) out.push(mine[k]);
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
