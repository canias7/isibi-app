// Sending a video or audio file to the site's library, in parts.
//
// ── WHY THIS IS ITS OWN FILE ───────────────────────────────────────────────
//
// The decisions in an upload — what counts as media, how a file is cut into
// the parts the server expects, what is sent again after a dropped
// connection and what is given up — are the ones a wrong answer costs a
// customer their file or their time, so they live in a file `node --test`
// can drive with a fake network, as `edit-poll.js` does. The browser gets a
// global (`SiteMedia`); the test gets the same object.
(function (root) {
  "use strict";

  /** What the server takes, by name and type, before any byte is read (the server reads the bytes). */
  var MEDIA_EXT = /\.(mp4|m4v|webm|mov|mp3|m4a|aac|wav|ogg|oga|opus|flac)$/i;
  function isMedia(file) {
    if (!file) return false;
    var t = String(file.type || "");
    return /^(video|audio)\//.test(t) || MEDIA_EXT.test(String(file.name || ""));
  }
  function kindOf(file) {
    var t = String(file && file.type || "");
    if (/^video\//.test(t)) return "video";
    if (/^audio\//.test(t)) return "audio";
    return /\.(mp4|m4v|webm|mov)$/i.test(String(file && file.name || "")) ? "video" : "audio";
  }

  /** How many times one part is sent before the upload is given up. */
  var PART_TRIES = 4;
  /** How many times an unknown outcome is asked about before it is left "not confirmed yet". */
  var CHECK_TRIES = 5;
  /** How long a record of an upload is kept in the browser: the server keeps its own for a day. */
  var RECORD_MS = 24 * 60 * 60 * 1000;

  /**
   * WHICH FILE THIS IS, FOR THIS LIBRARY (2026-10-15): the place it goes, what
   * it replaces, and the file as the browser knows it — name, size and when it
   * was last changed. The same file attached again after a reload finds the
   * upload it already made.
   */
  function fingerprint(file, base, replace) {
    return [String(base || ""), String(replace || ""), String(file && file.name || ""), Number(file && file.size) || 0, Number(file && file.lastModified) || 0].join("|");
  }

  /**
   * A RECORD OF EACH UPLOAD, kept by the page (`store`: get/put/drop by
   * fingerprint; the browser's own storage in `chat.js`, a Map in a test). It
   * holds only the session's id and what it made — never the bytes — and is
   * how a lost answer, a reconnect or a reload comes back to the same upload
   * rather than starting a second one.
   */
  function recorder(store, fp, now) {
    var ok = store && typeof store.get === "function";
    return {
      get: function () { if (!ok) return null; try { var r = store.get(fp); return r && typeof r.sid === "string" && !(r.at + RECORD_MS < now()) ? r : null; } catch (e) { return null; } },
      put: function (r) { if (ok) { try { store.put(fp, r); } catch (e) { /* only a convenience */ } } },
      drop: function () { if (ok) { try { store.drop(fp); } catch (e) { /* only a convenience */ } } },
    };
  }

  /**
   * WHAT BECAME OF AN UPLOAD WHOSE ANSWER WAS LOST: asked of the server, again
   * after a pause when the asking fails too. Answers
   *   { state: "done", file }          — it finished; the file is there
   *   { state: "open", have, etags, parts, partBytes } — still open: these parts are in
   *   { state: "gone" }               — expired or cancelled; nothing was kept
   *   { state: "removed" }            — it finished, but the file has since been deleted or moved
   *   { state: "replaced" }           — it finished, but its address now holds a newer file
   *   { state: "unknown" }            — could not find out (never "failed")
   * A finished upload is `done` only while its file is still there and still
   * the one it made (the server checks, 2026-10-15): a receipt is history,
   * never proof the file exists now.
   */
  function check(api, session, wait, tries) {
    var n = tries == null ? CHECK_TRIES : tries;
    var ask = function (i) {
      return Promise.resolve().then(function () { return api.status(session); }).then(function (r) {
        if (r && r.status === 404) return { state: "gone" };
        if (r && r.status < 300 && r.body && r.body.state === "done" && r.body.file) return { state: "done", file: r.body.file };
        if (r && r.status < 300 && r.body && (r.body.state === "removed" || r.body.state === "replaced")) return { state: r.body.state };
        if (r && r.status < 300 && r.body && r.body.state === "open") return { state: "open", have: r.body.have || [], etags: r.body.etags || [], parts: Number(r.body.parts) || 0, partBytes: Number(r.body.partBytes) || 0 };
        throw new Error("status unreadable");
      }).catch(function () {
        if (i + 1 >= n) return { state: "unknown" };
        return wait(500 * Math.pow(2, i)).then(function () { return ask(i + 1); });
      });
    };
    return ask(0);
  }

  /**
   * SEND ONE FILE, IN PARTS (2026-10-14; 2026-10-15). `api` is
   *   { start: (body) → Promise<{status, body}>,
   *     part: (session, n, blob) → Promise<{status, body}>,
   *     complete: (session, parts) → Promise<{status, body}>,
   *     status: (session) → Promise<{status, body}>,
   *     abort: (session) → Promise }
   * and `wait(ms)` the pause between tries. A part that fails on the network
   * or with a 5xx is sent again, alone, up to `PART_TRIES` times; a refusal
   * (4xx) ends the upload at once, said as the server said it, and the
   * session is aborted so nothing half-sent is kept. `cancelled()` is asked
   * between parts.
   *
   * AN ANSWER THAT DOES NOT COME BACK IS NOT A FAILURE (2026-10-15, Codex's
   * review of `7ca339d1`): finishing used to call the upload failed — and
   * abort it — when the answer to `complete` was lost, though the file had
   * been saved. Now a lost or unclear answer is asked about (`status`): a
   * finished upload is taken as finished, an open one is finished again (only
   * the parts the server does not hold are sent), and when even that cannot
   * be found out the answer is `{ ok: false, uncertain: true }` — never
   * "failed", never aborted, and the record is kept so a later check (or the
   * same file attached again) comes back to it. With a `store`, a file sent
   * before — this session or before a reload — is not sent again: a finished
   * upload is reused, an open one resumed.
   *
   * Answers `{ ok: true, file, reused?, recovered? }`, `{ ok: false, error, code }`,
   * or `{ ok: false, uncertain: true, session, error, code: "unconfirmed" }`.
   */
  function upload(file, opts) {
    var api = opts.api;
    var wait = opts.wait || function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
    var progress = opts.progress || function () {};
    var cancelled = opts.cancelled || function () { return false; };
    var now = opts.now || function () { return Date.now(); };
    var rec = recorder(opts.store, fingerprint(file, opts.base, opts.replace), now);
    var startBody = { name: file.name, size: file.size, type: file.type || "" };
    if (opts.replace) startBody.replace = opts.replace;
    if (opts.meta) startBody.meta = opts.meta;
    var said = function (r, fallback) {
      var b = r && r.body;
      return { ok: false, error: (b && typeof b.error === "string" && b.error) || fallback, code: (b && b.code) || "failed" };
    };
    var unsure = function (session) {
      return { ok: false, uncertain: true, session: session, code: "unconfirmed", error: "couldn’t confirm the upload finished yet — it will be checked again" };
    };
    // A REPLACEMENT HELD IN THE DRAFT (audit A15-1, 2026-10-23): the start
    // answered `replacesInDraft`, and only the answer to `complete` holds it
    // (the server pairs it there; a status read never does). Such an upload
    // is finished only by an answer that says `held`: a lost or unclear end
    // is said as not saved to the draft, never "Replaced", and no record of it
    // is kept, so pressing again sends the file again and holds it.
    var holding = false;
    var notHeld = function () {
      rec.drop();
      return { ok: false, code: "draft", error: "couldn\u2019t confirm the new file was saved to your draft \u2014 check the list, or replace the file again" };
    };
    var finished = function (file, extra) {
      if (holding && !(file && file.held === true)) return notHeld();
      rec.put({ sid: extra.session, at: now(), state: "done", file: file });
      var out = { ok: true, file: file };
      if (extra.reused) out.reused = true;
      if (extra.recovered) out.recovered = true;
      return out;
    };

    // ── ONE UPLOAD, FROM WHEREVER IT STANDS ──
    // How many times an unclear end has been asked about, across every resume
    // of this one upload: it ends "not confirmed yet", never in a loop.
    var settles = 0;
    var run = function (session, size, parts, have) {
      var done = [];
      var held = {};
      (have || []).forEach(function (p) { if (p && p.n) held[p.n] = p.etag; });
      var give = function (res) { rec.drop(); return Promise.resolve(api.abort(session)).catch(function () {}).then(function () { return res; }); };
      var sendPart = function (n, tries) {
        if (cancelled()) return give({ ok: false, error: "upload cancelled", code: "cancelled" });
        var blob = file.slice((n - 1) * size, Math.min(file.size, n * size));
        return Promise.resolve(api.part(session, n, blob)).then(function (pr) {
          if (pr && pr.status < 300 && pr.body && typeof pr.body.etag === "string") return pr;
          // FINISHED ALREADY — a part sent again after a lost answer: no abort.
          if (pr && pr.status === 409 && pr.body && pr.body.code === "done") return { finishedAlready: true };
          if (pr && pr.status >= 400 && pr.status < 500) return give(said(pr, "that part was refused"));
          throw new Error("part " + n + " failed");
        }, function (e) { throw e; }).catch(function (e) {
          if (e && (e.ok === false || e.finishedAlready)) return e;
          if (tries + 1 >= PART_TRIES) return give({ ok: false, error: "the connection kept dropping — try again", code: "network" });
          return wait(500 * Math.pow(2, tries)).then(function () { return sendPart(n, tries + 1); });
        });
      };
      // AN UNCLEAR END IS ASKED ABOUT, never taken as a failure.
      var settle = function (round) {
        if (holding) return Promise.resolve(notHeld());
        return check(api, session, wait).then(function (c) {
          if (c.state === "done") return finished(c.file, { session: session, recovered: true });
          if (c.state === "gone") { rec.drop(); return { ok: false, error: "that upload expired before it finished — send the file again", code: "no_session" }; }
          if (c.state === "removed" || c.state === "replaced") { rec.drop(); return { ok: false, error: c.state === "removed" ? "that file was deleted before its upload could be confirmed — send it again" : "that file was replaced before its upload could be confirmed — send it again", code: c.state }; }
          if (c.state === "open" && ++settles <= 2) {
            var hv = c.have.map(function (n, i) { return { n: n, etag: c.etags[i] }; });
            return run(session, size, parts, hv);
          }
          return unsure(session);
        });
      };
      var finish = function (round) {
        var list = done.slice();
        Object.keys(held).forEach(function (n) { if (!list.some(function (p) { return p.n === +n; })) list.push({ n: +n, etag: held[n] }); });
        list.sort(function (a, b) { return a.n - b.n; });
        return Promise.resolve().then(function () { return api.complete(session, list); }).then(function (cr) {
          if (cr && cr.status < 300 && cr.body && cr.body.ok) {
            var f = {}; Object.keys(cr.body).forEach(function (k) { if (k !== "ok" && k !== "again") f[k] = cr.body[k]; });
            return finished(f, { session: session, recovered: !!cr.body.again });
          }
          // SOME PARTS NEED SENDING AGAIN, by number: sent, then finished again.
          if (cr && cr.status === 400 && cr.body && cr.body.code === "parts_missing" && Array.isArray(cr.body.missing) && round < 2) {
            var again = cr.body.missing.filter(function (n) { return Number.isInteger(n) && n >= 1 && n <= parts; });
            if (again.length) {
              again.forEach(function (n) { delete held[n]; done = done.filter(function (p) { return p.n !== n; }); });
              var resend = function (i) {
                if (i >= again.length) return finish(round + 1);
                return sendPart(again[i], 0).then(function (pr) {
                  if (pr && pr.ok === false) return pr;
                  if (pr && pr.finishedAlready) return settle(round + 1);
                  done.push({ n: again[i], etag: pr.body.etag });
                  return resend(i + 1);
                });
              };
              return resend(0);
            }
          }
          if (cr && cr.status === 404) return settle(round);
          // A CLEAR REFUSAL (a 4xx) IS SAID; anything else is asked about.
          if (cr && cr.status >= 400 && cr.status < 500) { rec.drop(); return said(cr, "couldn't finish that upload"); }
          return settle(round);
        }, function () { return settle(round); });
      };
      var next = function (n) {
        if (n > parts) return finish(0);
        if (held[n]) { progress(Math.min(file.size, n * size), file.size); return next(n + 1); }
        return sendPart(n, 0).then(function (pr) {
          if (pr && pr.ok === false) return pr;
          if (pr && pr.finishedAlready) return settle(0);
          done.push({ n: n, etag: pr.body.etag });
          progress(Math.min(file.size, n * size), file.size);
          return next(n + 1);
        });
      };
      return next(1);
    };

    var begin = function () {
      return Promise.resolve(api.start(startBody)).then(function (r) {
        if (!r || r.status >= 300 || !r.body || typeof r.body.session !== "string") return said(r, "couldn't start that upload");
        var session = r.body.session;
        var size = Number(r.body.partBytes) || 0;
        var parts = Number(r.body.parts) || 0;
        if (!(size > 0) || !(parts > 0)) return said(null, "couldn't start that upload");
        holding = typeof r.body.replacesInDraft === "string" && !!r.body.replacesInDraft;
        rec.put({ sid: session, at: now(), state: "open", holding: holding || undefined });
        return run(session, size, parts, []);
      }, function () { return { ok: false, error: "couldn't start that upload", code: "network" }; });
    };

    // ── THIS FILE WAS SENT BEFORE: reuse what it made, or carry on ──
    // Reused only while the server says its file is still there and still the
    // one this upload made. Deleted, moved or replaced since: the record is
    // dropped and the file is sent again as a new file — never the missing
    // one, and never a replacement's bytes in place of the original.
    var prior = rec.get();
    if (!prior) return begin();
    // A HELD REPLACEMENT IS NEVER REUSED FROM A RECORD: what finished it was
    // the hold, which a status read cannot show (audit A15-1).
    if (opts.replace && prior.state === "done") { rec.drop(); return begin(); }
    holding = prior.holding === true;
    return check(api, prior.sid, wait, 2).then(function (c) {
      if (c.state === "done") return finished(c.file, { session: prior.sid, reused: true });
      if (c.state === "open" && c.parts > 0 && c.partBytes > 0) {
        return run(prior.sid, c.partBytes, c.parts, c.have.map(function (n, i) { return { n: n, etag: c.etags[i] }; }));
      }
      if (c.state === "unknown") return unsure(prior.sid);
      rec.drop();
      return begin();
    });
  }

  /**
   * ASK AGAIN ABOUT AN UPLOAD LEFT "not confirmed yet" — after a pause, a
   * reconnect or a reload. `{ ok: true, file }`, `{ ok: false, gone: true }`,
   * or `{ ok: false, uncertain: true }`; it never sends a byte.
   */
  function confirm(session, opts) {
    var wait = opts.wait || function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
    return check(opts.api, session, wait).then(function (c) {
      if (c.state === "done") return { ok: true, file: c.file };
      if (c.state === "gone" || c.state === "removed" || c.state === "replaced") return { ok: false, gone: true, why: c.state };
      return { ok: false, uncertain: true, open: c.state === "open" };
    });
  }

  /**
   * DRAFT FILES INTO A SITE THAT NOW EXISTS (audit A10-4, #115; owner,
   * 2026-10-23). A file attached before the site existed is kept for the
   * account; when the message goes as an edit, it is moved into the site's
   * library first (`POST /api/site/<slug>/media/adopt`) and named with its
   * library address. `adopt(slug, chips, post)` moves every ready draft chip;
   * `post(path, body)` answers `{ status, body }`. It answers `{ ok: true }`
   * with each moved chip now a library file, or `{ ok: false, error }` with
   * the sentence to show and nothing sent; a chip that was moved stays moved.
   */
  function adopt(slug, chips, post) {
    var drafts = (chips || []).filter(function (c) { return c && c.draft && c.state === "done" && c.ref; });
    if (!drafts.length) return Promise.resolve({ ok: true, moved: 0 });
    var path = "/api/site/" + encodeURIComponent(slug) + "/media/adopt";
    return Promise.resolve().then(function () {
      return post(path, { files: drafts.map(function (c) { return c.ref; }) });
    }).then(function (r) {
      var b = (r && r.body) || {};
      if (!r || r.status !== 200 || b.ok !== true) {
        return { ok: false, error: "I couldn’t move your file into this site’s library just now, so nothing was sent — try again in a moment." };
      }
      var placed = Array.isArray(b.placed) ? b.placed : [];
      var moved = 0;
      drafts.forEach(function (c) {
        var p = placed.filter(function (f) { return f && f.file === c.ref; })[0];
        if (p) { c.draft = false; c.url = p.url || ""; c.base = "/api/site/" + encodeURIComponent(slug) + "/media"; moved++; }
      });
      var left = drafts.filter(function (c) { return c.draft; });
      if (left.length) {
        var miss = Array.isArray(b.missing) ? b.missing : [];
        var said = left.map(function (c) {
          var m = miss.filter(function (x) { return x && x.file === c.ref; })[0];
          return "“" + c.name + "”" + (m && m.why ? " (" + m.why + ")" : "");
        }).join(", ");
        return { ok: false, moved: moved, error: "I couldn’t move " + said + " into this site’s library, so nothing was sent — attach " + (left.length > 1 ? "them" : "it") + " again." };
      }
      return { ok: true, moved: moved };
    }, function () {
      return { ok: false, error: "I couldn’t move your file into this site’s library just now, so nothing was sent — try again in a moment." };
    });
  }

  var api = { isMedia: isMedia, kindOf: kindOf, upload: upload, confirm: confirm, adopt: adopt, fingerprint: fingerprint, PART_TRIES: PART_TRIES, CHECK_TRIES: CHECK_TRIES, RECORD_MS: RECORD_MS };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.SiteMedia = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
