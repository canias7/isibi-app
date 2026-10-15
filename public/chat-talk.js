// The conversation: what the page sends of it, and how a reply is drawn.
//
// ── WHY THIS IS ITS OWN FILE ───────────────────────────────────────────────
//
// `chat.js` cannot be imported by a test, so the two decisions here — which of
// a project's messages go to the server as its conversation, and how a reply's
// small Markdown becomes HTML without letting anything else through — live in
// a file that runs in both places, as `edit-poll.js` does. The browser gets a
// global (`ChatTalk`); `node --test` gets the same object.
(function (root) {
  "use strict";

  /** How much of a project's thread is sent with a message (the server windows it again). */
  var HISTORY_TURNS = 30;
  var HISTORY_TURN_CHARS = 4000;

  /**
   * THE CONVERSATION SO FAR, AS THE SERVER READS IT (2026-10-14): this
   * project's own messages — never another project's — oldest first, each
   * `{ role: "user"|"assistant", text }`. The message being sent is left out
   * (it goes as the message), and so is a reply still being written, which
   * holds no words yet. A question we asked is sent with the answers offered,
   * because "the second one" means one of them.
   *
   * WHAT IS CUT HERE IS SAID, NOT HIDDEN (2026-10-15, Codex's review of
   * `7ca339d1`): a turn longer than `HISTORY_TURN_CHARS` keeps its start and
   * carries `full`, its whole length, and when earlier turns are dropped to
   * keep the last `HISTORY_TURNS` the list opens with `{ omitted: n }`. The
   * server checks both and tells the models, so a cut message is never read
   * as the whole of it.
   */
  function historyWire(msgs, current) {
    var list = Array.isArray(msgs) ? msgs.slice() : [];
    var now = typeof current === "string" ? current.trim() : "";
    // THE MESSAGE BEING SENT is already on the thread: it is the last of the
    // owner's, and it goes as the message, not as history.
    for (var i = list.length - 1; i >= 0; i--) {
      var m = list[i];
      if (m && m.r === "u") {
        if (now && typeof m.t === "string" && m.t.trim() === now) list.splice(i, 1);
        break;
      }
    }
    var out = [];
    for (var j = 0; j < list.length; j++) {
      var x = list[j];
      if (!x || typeof x !== "object" || typeof x.t !== "string") continue;
      if (x.held) continue;
      var text = x.t.trim();
      if (x.r === "a" && Array.isArray(x.opts) && x.opts.length) {
        var opts = x.opts.filter(function (o) { return typeof o === "string" && o; });
        if (opts.length) text += (text ? "\n" : "") + "(Answers offered: " + opts.join(" / ") + ")";
      }
      if (!text) continue;
      var turn = { role: x.r === "u" ? "user" : "assistant", text: text.slice(0, HISTORY_TURN_CHARS) };
      if (text.length > HISTORY_TURN_CHARS) turn.full = text.length;
      out.push(turn);
    }
    var dropped = Math.max(0, out.length - HISTORY_TURNS);
    var kept = out.slice(-HISTORY_TURNS);
    return dropped ? [{ omitted: dropped }].concat(kept) : kept;
  }

  /** What a file in the composer is, by name only — the reply is told it was not shown its contents. */
  function fileWire(files) {
    return (Array.isArray(files) ? files : []).filter(function (f) { return f && typeof f.name === "string" && f.name; })
      .slice(0, 12).map(function (f) {
        var t = typeof f.type === "string" ? f.type : "";
        var kind = /^image\//.test(t) ? "image" : /^video\//.test(t) || f.kind === "video" ? "video" : /^audio\//.test(t) || f.kind === "audio" ? "audio" : t === "application/pdf" ? "PDF" : f.text !== undefined ? "text" : "file";
        return { name: f.name.slice(0, 200), kind: kind };
      });
  }

  function escHTML(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;";
    });
  }

  /**
   * ONE LINE OF A REPLY, ESCAPED FIRST and then given its few inline marks:
   * `code`, **bold**, [text](https://…) and bare https links. Everything is
   * escaped before any mark is read, so no tag the model writes reaches the
   * page; a link is made only to an http or https address.
   */
  function inline(s) {
    var codes = [];
    var t = escHTML(s).replace(/`([^`\n]+)`/g, function (_, c) { codes.push(c); return "\u0000" + (codes.length - 1) + "\u0000"; });
    t = t.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
    var links = [];
    t = t.replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g, function (_, label, href) {
      links.push('<a href="' + href + '" target="_blank" rel="noopener">' + label + "</a>");
      return "\u0001" + (links.length - 1) + "\u0001";
    });
    t = t.replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)\]])/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
    t = t.replace(/\u0001(\d+)\u0001/g, function (_, n) { return links[Number(n)]; });
    return t.replace(/\u0000(\d+)\u0000/g, function (_, n) { return "<code>" + codes[Number(n)] + "</code>"; });
  }

  /**
   * A REPLY'S SMALL MARKDOWN AS HTML (2026-10-14): headings (#, ##, ###, drawn
   * as one small heading size), bulleted and numbered lists, paragraphs, and
   * the inline marks above. Nothing else is read: a table, an image or HTML
   * comes out as the text it was.
   */
  function markdownHTML(text) {
    var lines = String(text == null ? "" : text).replace(/\r\n?/g, "\n").split("\n");
    var out = [];
    var para = [];
    var list = null;
    function flushPara() { if (para.length) { out.push("<p>" + para.map(inline).join("<br>") + "</p>"); para = []; } }
    function flushList() { if (list) { out.push("<" + list.tag + ">" + list.items.map(function (i) { return "<li>" + inline(i) + "</li>"; }).join("") + "</" + list.tag + ">"); list = null; } }
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var h = /^\s{0,3}(#{1,3})\s+(.+?)\s*#*\s*$/.exec(line);
      var ul = /^\s{0,3}[-*•]\s+(.+)$/.exec(line);
      var ol = /^\s{0,3}(\d{1,3})[.)]\s+(.+)$/.exec(line);
      if (!line.trim()) { flushPara(); flushList(); continue; }
      if (h) { flushPara(); flushList(); out.push('<p class="md-h">' + inline(h[2]) + "</p>"); continue; }
      if (ul || ol) {
        flushPara();
        var tag = ul ? "ul" : "ol";
        if (!list || list.tag !== tag) { flushList(); list = { tag: tag, items: [] }; }
        list.items.push(ul ? ul[1] : ol[2]);
        continue;
      }
      if (list && /^\s{2,}\S/.test(line)) { list.items[list.items.length - 1] += " " + line.trim(); continue; }
      flushList();
      para.push(line);
    }
    flushPara();
    flushList();
    return '<div class="md">' + out.join("") + "</div>";
  }

  var api = {
    historyWire: historyWire,
    fileWire: fileWire,
    markdownHTML: markdownHTML,
    HISTORY_TURNS: HISTORY_TURNS,
    HISTORY_TURN_CHARS: HISTORY_TURN_CHARS,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.ChatTalk = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
