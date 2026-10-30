// THE KEY CARD (2026-10-30, owner: "when the model says add key, in the chat I
// want a server thing that pulls up and collects the key, WITHOUT THE MODEL
// TOUCHING IT").
//
// A reply that carries `needKeys` (names only) shows a card in the chat with
// one password box per key. Save POSTs each value to the owner's own keys
// route, `/api/site/<slug>/secrets`, and nowhere else: the value is never put
// in the chat store, a message, localStorage, a log or the next request to the
// builder. The card keeps it only in its own input, cleared once saved.
//
// Its own file, like edit-poll.js, so the decisions run under node --test.
(function (root) {
  "use strict";

  // The site-secrets rule (`normalizeSecretName` in site-secrets.mjs), copied
  // because a classic script cannot import it; test/key-card.test.mjs compares them.
  function keyName(name) {
    var n = String(name == null ? "" : name).trim().toUpperCase().replace(/[\s-]+/g, "_");
    return /^[A-Z][A-Z0-9_]{0,63}$/.test(n) ? n : null;
  }

  var MAX = 8;
  function clip(v) { return typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, 160) : ""; }

  /** A reply's `needKeys`, validated: names that pass the rule, deduplicated, at most 8. */
  function needKeys(list) {
    var out = [];
    (Array.isArray(list) ? list : []).forEach(function (k) {
      var name = k && typeof k.name === "string" ? keyName(k.name) : null;
      if (!name || out.length >= MAX || out.some(function (o) { return o.name === name; })) return;
      out.push({ name: name, service: clip(k.service), why: clip(k.why) });
    });
    return out;
  }

  // WHAT A PASTED KEY LOOKS LIKE. Prefix, then a run of key characters long
  // enough that ordinary words ("re_do") do not match. Each names the key it
  // most likely is, so the card can offer that name.
  var SHAPES = [
    [/\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{10,}/g, function (m) { return m.charAt(0) === "r" ? "STRIPE_RESTRICTED_KEY" : "STRIPE_SECRET_KEY"; }, "Stripe"],
    [/\bwhsec_[A-Za-z0-9+/=]{10,}/g, function () { return "STRIPE_WEBHOOK_SECRET"; }, "Stripe"],
    [/\bre_[A-Za-z0-9_]{12,}/g, function () { return "RESEND_API_KEY"; }, "Resend"],
    [/\bsk-(?:proj-|ant-)?[A-Za-z0-9_-]{20,}/g, function (m) { return /^sk-ant-/.test(m) ? "ANTHROPIC_API_KEY" : "OPENAI_API_KEY"; }, ""],
    [/\bSG\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}/g, function () { return "SENDGRID_API_KEY"; }, "SendGrid"],
    [/\bxox[abposr]-[A-Za-z0-9-]{10,}/g, function () { return "SLACK_TOKEN"; }, "Slack"],
    [/\bgh[pousr]_[A-Za-z0-9]{20,}/g, function () { return "GITHUB_TOKEN"; }, "GitHub"],
    [/\bAKIA[0-9A-Z]{16}\b/g, function () { return "AWS_ACCESS_KEY_ID"; }, "AWS"],
    [/\bAC[0-9a-f]{32}\b/g, function () { return "TWILIO_ACCOUNT_SID"; }, "Twilio"],
  ];

  /** The key-shaped runs in a message, each with the name it most likely is. Never logged. */
  function keyShaped(text) {
    var t = typeof text === "string" ? text : "";
    var found = [];
    SHAPES.forEach(function (s) {
      var re = new RegExp(s[0].source, "g"), m;
      while ((m = re.exec(t))) found.push({ at: m.index, end: m.index + m[0].length, name: s[1](m[0]), service: s[2], value: m[0] });
    });
    found.sort(function (a, b) { return a.at - b.at; });
    return found.filter(function (f, i) { return !found.slice(0, i).some(function (g) { return f.at < g.end; }); });
  }

  /** The message with every key-shaped run taken out. */
  function withoutKeys(text) {
    var t = typeof text === "string" ? text : "";
    var cut = keyShaped(t);
    for (var i = cut.length - 1; i >= 0; i--) t = t.slice(0, cut[i].at) + t.slice(cut[i].end);
    return t.replace(/[ \t]{2,}/g, " ").trim();
  }

  /** What one save sends: the route and the body. The ONLY place a value goes. */
  function saveRequest(slug, name, value) {
    return { url: "/api/site/" + encodeURIComponent(String(slug || "")) + "/secrets", init: { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name, value: value }) } };
  }

  var api = { keyName: keyName, needKeys: needKeys, keyShaped: keyShaped, withoutKeys: withoutKeys, saveRequest: saveRequest, MAX: MAX };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.KeyCard = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
