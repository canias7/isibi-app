// Deleting a site: the sentence that names what is lost, and the dialog that
// asks for the site's name before Delete lights (2026-10-26, owner).
//
// Its own file for the reason `site-list.js` is: `chat.js` touches `document`
// at load and can only be read, while this runs in both places — the browser
// gets `window.DeleteConfirm`, `node --test` gets the object.
//
// THE COUNTS COME FROM `GET /api/site/<slug>/delete-preview` and are said only
// as read. A database whose entries could not be counted is said so in words;
// a count that was not read is never shown as 0.
(function (root) {
  "use strict";

  /** "order_items" → "order items"; one row → "order item". */
  function plainTable(name, n) {
    var words = String(name || "").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").trim().toLowerCase();
    if (n === 1 && /[^s]s$/.test(words)) words = words.slice(0, -1);
    return words || "entries";
  }

  function list(parts) {
    if (parts.length <= 1) return parts.join("");
    return parts.slice(0, -1).join(", ") + " and " + parts[parts.length - 1];
  }

  function pagesPhrase(pages) {
    if (typeof pages !== "number" || !isFinite(pages) || pages < 0) return "its pages";
    return pages === 1 ? "1 page" : pages + " pages";
  }

  /** What the database holds, in words, or what could not be read. */
  function databasePhrase(p) {
    if (p.database === null) return "its database, if it has one (couldn't check)";
    var t = p.tables;
    if (!t || typeof t !== "object") return "its database (couldn't count its entries)";
    var names = Object.keys(t);
    var known = names.filter(function (k) { return typeof t[k] === "number" && isFinite(t[k]); });
    var unknown = names.length - known.length;
    if (!names.length) return "its database";
    if (!known.length) return "its database (couldn't count its entries)";
    var shown = known.filter(function (k) { return t[k] > 0; }).map(function (k) { return t[k] + " " + plainTable(k, t[k]); });
    if (!shown.length) return unknown ? "its database (couldn't count all its entries)" : "its database (no entries yet)";
    return "its database with " + list(shown) + (unknown ? " (couldn't count the rest)" : "");
  }

  /** The dialog's sentence for a preview answer. */
  function sentence(p) {
    p = p || {};
    var name = String(p.name || p.slug || "this site");
    if (p.database === false) {
      var pg = pagesPhrase(p.pages);
      return "This deletes " + name + " and " + (pg === "its pages" ? pg : "its " + pg) + ". Type the site name to confirm.";
    }
    return "This deletes " + name + ", " + databasePhrase(p) + ", and " + pagesPhrase(p.pages) + ". Type the site name to confirm.";
  }

  /** Delete lights only when the typed text is the site's name. */
  function matches(typed, name) {
    var a = String(typed == null ? "" : typed).trim().toLowerCase();
    var b = String(name == null ? "" : name).trim().toLowerCase();
    return a !== "" && a === b;
  }

  function escHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; });
  }

  /**
   * The dialog, in the app's own `go-confirm` look. Resolves true for Delete,
   * false for Cancel, Escape or a click outside.
   */
  function ask(doc, p) {
    var name = String((p && (p.name || p.slug)) || "");
    return new Promise(function (resolve) {
      var wrap = doc.createElement("div");
      wrap.className = "go-confirm";
      wrap.innerHTML = '<div class="go-confirm-box" role="alertdialog" aria-modal="true">' +
        '<b class="go-confirm-title">Delete “' + escHtml(name) + '”?</b>' +
        '<p class="go-confirm-text">' + escHtml(sentence(p)) + '</p>' +
        '<input type="text" class="go-confirm-input" autocomplete="off" spellcheck="false" aria-label="Site name" placeholder="' + escHtml(name) + '">' +
        '<div class="go-confirm-acts"><button type="button" class="go-confirm-no">Cancel</button>' +
        '<button type="button" class="go-confirm-yes danger" disabled>Delete site</button></div></div>';
      var input = wrap.querySelector(".go-confirm-input");
      var yes = wrap.querySelector(".go-confirm-yes");
      var done = function (v) { doc.removeEventListener("keydown", key, true); wrap.remove(); resolve(v); };
      var key = function (e) {
        if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); done(false); }
        else if (e.key === "Enter" && e.target === input && !yes.disabled) { e.preventDefault(); done(true); }
      };
      input.addEventListener("input", function () { yes.disabled = !matches(input.value, name); });
      wrap.addEventListener("click", function (e) { if (e.target === wrap) done(false); });
      wrap.querySelector(".go-confirm-no").onclick = function () { done(false); };
      yes.onclick = function () { if (!yes.disabled) done(true); };
      doc.addEventListener("keydown", key, true);
      doc.body.appendChild(wrap);
      input.focus();
    });
  }

  var api = { sentence: sentence, matches: matches, plainTable: plainTable, ask: ask };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.DeleteConfirm = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
