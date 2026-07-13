/* Makes the vendored Seaward demo act real: contained smooth-scroll nav +
   CTA feedback. Vanilla JS over the SSR markup (the React bundle can't run
   off domain-root). Scrolls only this window — never the parent page. */
(function () {
  "use strict";
  document.documentElement.style.scrollBehavior = "smooth";
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  // toast
  var toast = document.createElement("div");
  toast.style.cssText = "position:fixed;left:50%;bottom:26px;transform:translate(-50%,140%);background:rgba(6,22,33,.94);color:#eaf6ff;border:1px solid rgba(255,255,255,.25);padding:12px 22px;font:600 13px/1.4 system-ui,sans-serif;letter-spacing:.02em;border-radius:10px;z-index:99;transition:transform .35s cubic-bezier(.2,.8,.3,1.1);max-width:88vw;text-align:center;backdrop-filter:blur(8px)";
  document.body.appendChild(toast);
  var tT;
  function say(m) { toast.textContent = m; toast.style.transform = "translate(-50%,0)"; clearTimeout(tT); tT = setTimeout(function () { toast.style.transform = "translate(-50%,140%)"; }, 2400); }

  // scroll only THIS window (no parent double-move)
  function toEl(el) { if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY, behavior: "smooth" }); }

  // intercept every in-page anchor; scroll to the target if it exists, else no-op
  $$('a[href^="#"]').forEach(function (a) {
    a.addEventListener("click", function (e) {
      e.preventDefault();
      var id = a.getAttribute("href").slice(1);
      if (id) { var t = document.getElementById(id); if (t) return toEl(t); }
      // hash-only links (About, Careers…) — pulse to top so it feels responsive
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });

  // CTA buttons → contextual confirmation
  var CTA = [
    [/request access/i, "Access requested — the crew will reach out within a day ✦"],
    [/book a briefing/i, "Briefing booked — check your inbox for the calendar hold ✦"],
    [/talk to sales/i, "We'll be in touch — a specialist is on the way ✦"],
    [/watch film/i, "Rolling the film… (full cut opens on the real platform) ✦"],
    [/sign in/i, "Sign-in opens on the live platform ✦"],
  ];
  $$("button").forEach(function (b) {
    var t = (b.textContent || "").trim();
    var hit = null;
    for (var i = 0; i < CTA.length; i++) { if (CTA[i][0].test(t)) { hit = CTA[i][1]; break; } }
    if (hit) b.addEventListener("click", function () { say(hit); });
  });
})();
