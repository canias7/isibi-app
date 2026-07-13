/* Makes the static demo act like the real site: smooth-scroll nav, working
   FAQ accordions, a live cart counter, and a crew signup. Vanilla JS over the
   SSR markup (the original React bundle can't run off-domain-root). */
(function () {
  "use strict";
  document.documentElement.style.scrollBehavior = "smooth";

  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  // Scroll ONLY this window — scrollIntoView would also scroll the parent page
  // to bring the iframe into view (the "double move").
  var go = function (id) {
    var el = document.getElementById(id); if (!el) return;
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY, behavior: "smooth" });
  };

  // ── toast ──
  var toast = document.createElement("div");
  toast.style.cssText = "position:fixed;left:50%;bottom:28px;transform:translate(-50%,120%);background:#111;color:#fff;border:1px solid #fff;padding:12px 22px;font:700 12px/1.4 'Space Grotesk',sans-serif;letter-spacing:.12em;text-transform:uppercase;z-index:99;transition:transform .35s cubic-bezier(.2,.8,.3,1.1);max-width:88vw;text-align:center";
  document.body.appendChild(toast);
  var toastT;
  function say(msg) {
    toast.textContent = msg;
    toast.style.transform = "translate(-50%,0)";
    clearTimeout(toastT);
    toastT = setTimeout(function () { toast.style.transform = "translate(-50%,120%)"; }, 2200);
  }

  // ── nav / hero buttons → smooth scroll ──
  var MAP = { "drop 01": "drop", "lookbook": "lookbook", "manifesto": "manifesto", "faq": "faq", "shop the drop": "drop", "the manifesto": "manifesto" };
  $$("button").forEach(function (b) {
    var t = (b.textContent || "").trim().toLowerCase().replace(/\s+/g, " ");
    Object.keys(MAP).forEach(function (k) {
      if (t === k || t.indexOf(k) === 0) b.addEventListener("click", function () { go(MAP[k]); });
    });
  });

  // ── cart ──
  var count = 0;
  var cartBtn = document.querySelector('button[aria-label^="Open cart"]');
  function paintCart() {
    if (!cartBtn) return;
    cartBtn.setAttribute("aria-label", "Open cart, " + count + " items");
    // React SSR splits "[0]" into separate text nodes ("[", "0", "]") — update
    // the bare-number node, falling back to any node containing "[N]".
    var walker = document.createTreeWalker(cartBtn, NodeFilter.SHOW_TEXT);
    var n; while ((n = walker.nextNode())) {
      if (/^\s*\d+\s*$/.test(n.nodeValue)) { n.nodeValue = String(count); break; }
      if (/\[\d+\]/.test(n.nodeValue)) { n.nodeValue = n.nodeValue.replace(/\[\d+\]/, "[" + count + "]"); break; }
    }
    cartBtn.style.transition = "transform .15s"; cartBtn.style.transform = "scale(1.12)";
    setTimeout(function () { cartBtn.style.transform = ""; }, 160);
  }
  $$("button").forEach(function (b) {
    if (/add to cart/i.test(b.textContent || "")) {
      b.addEventListener("click", function (e) {
        e.stopPropagation();
        count++; paintCart();
        say("Added to cart — " + count + " item" + (count > 1 ? "s" : "") + " ✦");
      });
    }
  });
  if (cartBtn) cartBtn.addEventListener("click", function () {
    say(count ? "Cart [" + count + "] — checkout opens on the real drop" : "Cart is empty — grab a piece from Drop 01");
    if (!count) go("drop");
  });

  // ── FAQ accordions (Radix SSR markup) ──
  $$('button[aria-controls][data-state]').forEach(function (btn) {
    var region = document.getElementById(btn.getAttribute("aria-controls"));
    if (!region) return;
    btn.addEventListener("click", function () {
      var open = btn.getAttribute("data-state") === "open";
      var next = open ? "closed" : "open";
      btn.setAttribute("data-state", next);
      btn.setAttribute("aria-expanded", String(!open));
      region.setAttribute("data-state", next);
      var wrap = btn.closest("[data-state][class*='border-b']"); if (wrap) wrap.setAttribute("data-state", next);
      var item = btn.parentElement; if (item && item.hasAttribute("data-state")) item.setAttribute("data-state", next);
      if (open) { region.setAttribute("hidden", ""); }
      else {
        region.removeAttribute("hidden");
        region.style.setProperty("--radix-collapsible-content-height", region.scrollHeight + "px");
      }
    });
  });

  // ── crew signup (email form) ──
  $$("form").forEach(function (f) {
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      var inp = f.querySelector("input");
      if (inp && inp.value) { say("You're on the list — drop address hits your inbox first ✦"); inp.value = ""; }
      else if (inp) inp.focus({ preventScroll: true });
    });
  });
  // "Join the crew" buttons scroll to the signup input
  $$("button").forEach(function (b) {
    if (/join the crew/i.test(b.textContent || "")) b.addEventListener("click", function () {
      var inp = document.querySelector('input[type="email"]');
      if (!inp) return;
      var r = inp.getBoundingClientRect();
      window.scrollTo({ top: r.top + window.scrollY - (window.innerHeight - r.height) / 2, behavior: "smooth" });
      setTimeout(function () { inp.focus({ preventScroll: true }); }, 600);
    });
  });
})();
