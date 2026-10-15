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

  /**
   * SEND ONE FILE, IN PARTS (2026-10-14). `api` is
   *   { start: (body) → Promise<{status, body}>,
   *     part: (session, n, blob) → Promise<{status, body}>,
   *     complete: (session, parts) → Promise<{status, body}>,
   *     abort: (session) → Promise }
   * and `wait(ms)` the pause between tries. A part that fails on the network
   * or with a 5xx is sent again, alone, up to `PART_TRIES` times; a refusal
   * (4xx) ends the upload at once, said as the server said it, and the
   * session is aborted so nothing half-sent is kept. `cancelled()` is asked
   * between parts. Answers `{ ok: true, file }` or `{ ok: false, error, code }`.
   */
  function upload(file, opts) {
    var api = opts.api;
    var wait = opts.wait || function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
    var progress = opts.progress || function () {};
    var cancelled = opts.cancelled || function () { return false; };
    var startBody = { name: file.name, size: file.size, type: file.type || "" };
    if (opts.replace) startBody.replace = opts.replace;
    if (opts.meta) startBody.meta = opts.meta;
    var said = function (r, fallback) {
      var b = r && r.body;
      return { ok: false, error: (b && typeof b.error === "string" && b.error) || fallback, code: (b && b.code) || "failed" };
    };
    return Promise.resolve(api.start(startBody)).then(function (r) {
      if (!r || r.status >= 300 || !r.body || typeof r.body.session !== "string") return said(r, "couldn't start that upload");
      var session = r.body.session;
      var size = Number(r.body.partBytes) || 0;
      var parts = Number(r.body.parts) || 0;
      if (!(size > 0) || !(parts > 0)) return said(null, "couldn't start that upload");
      var done = [];
      var give = function (res) { return Promise.resolve(api.abort(session)).catch(function () {}).then(function () { return res; }); };
      var sendPart = function (n, tries) {
        if (cancelled()) return give({ ok: false, error: "upload cancelled", code: "cancelled" });
        var blob = file.slice((n - 1) * size, Math.min(file.size, n * size));
        return Promise.resolve(api.part(session, n, blob)).then(function (pr) {
          if (pr && pr.status < 300 && pr.body && typeof pr.body.etag === "string") return pr;
          if (pr && pr.status >= 400 && pr.status < 500) return give(said(pr, "that part was refused"));
          throw new Error("part " + n + " failed");
        }, function (e) { throw e; }).catch(function (e) {
          if (e && e.ok === false) return e;
          if (tries + 1 >= PART_TRIES) return give({ ok: false, error: "the connection kept dropping — try again", code: "network" });
          return wait(500 * Math.pow(2, tries)).then(function () { return sendPart(n, tries + 1); });
        });
      };
      var next = function (n) {
        if (n > parts) {
          return Promise.resolve(api.complete(session, done)).then(function (cr) {
            if (cr && cr.status < 300 && cr.body && cr.body.ok) return { ok: true, file: cr.body };
            return give(said(cr, "couldn't finish that upload"));
          }, function () { return give({ ok: false, error: "couldn't finish that upload", code: "network" }); });
        }
        return sendPart(n, 0).then(function (pr) {
          if (pr && pr.ok === false) return pr;
          done.push({ n: n, etag: pr.body.etag });
          progress(Math.min(file.size, n * size), file.size);
          return next(n + 1);
        });
      };
      return next(1);
    }, function () { return { ok: false, error: "couldn't start that upload", code: "network" }; });
  }

  var api = { isMedia: isMedia, kindOf: kindOf, upload: upload, PART_TRIES: PART_TRIES };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.SiteMedia = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
