// The lane sweep: one real edit per lane, on a live site, through the queue,
// and after every one the SITE is read to see whether the lane did the one
// thing it owns.
//
// ── WHY THIS EXISTS ────────────────────────────────────────────────────────
//
// Owner, 2026-09-01: *"do all of them lane by lane and lets see how it behaves,
// if its actually doing whats supposed to do"*. Asked after the record showed
// that of twenty-one lanes, exactly one had ever run on the live Worker
// (`css`, that afternoon). The rest were asserted by reading — every lane has
// a rule, a tool, a rung — and this repo's own note says what that is worth:
// a feature that has never run has never been tested, however green the suite.
//
// ── WHAT "WORKS" MEANS HERE ────────────────────────────────────────────────
//
// Not the reply. The reply is the server's claim; the canary that spent nothing
// had a perfect reply. Each case names a PREDICATE over the live site — the
// `<html lang>`, the `<title>`, the `:root` colour block, the icon bytes, the
// QR's module set against the library's own — and reads it before and after.
// The build id must move on every claimed success and must NOT move on an
// escalate. A reply that says `ok` while the site did not change is a lie, and
// a lie stops the sweep; an honest escalate is a finding and the sweep goes on.
//
// ── ONE SHORTCUT, STATED ───────────────────────────────────────────────────
//
// Every message posts `layer: "look"` directly rather than asking
// `/api/site/route` first. `pick_lanes` runs inside the edit route above the
// dispatch, so the thing under test — does the picker name the lane, does the
// lane act — is fully exercised. What is skipped is the INTENT router (edit vs
// build vs ask), which cost 2 credits a call on Grok that day and is covered by
// the edit smoke. Twenty lanes × 2 is forty credits of nothing new.
//
// ── TWO LANES ARE HELD BACK ────────────────────────────────────────────────
//
// `slug` renames the site: the old address redirects for ever and the new one
// is claimed. `kind` is a full rebuild at ~45 credits that replaces the site.
// Both are real lanes and both are qualitatively different from "edit this",
// so they run only when named explicitly in LANES, never under `all`.
//
// ── HOW IT SIGNS IN ────────────────────────────────────────────────────────
//
// Admin magic-link, as `edit-canary.mjs` does. No password anywhere.
import https from "node:https";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const SUPABASE_URL = process.env.SUPABASE_URL || "https://ujrqdmmtcptvimazlhom.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || "";
const ANON_KEY = process.env.SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqcnFkbW10Y3B0dmltYXpsaG9tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3ODUyNTUsImV4cCI6MjA5NDM2MTI1NX0.F-af9iC-BWTZN2hQ5cD1Keke8qXARhqPwxOgSHhNLK4";
const BASE = process.env.OWNER_BASE_URL || "https://gofarther.dev";
const EMAIL = String(process.env.OWNER_EMAIL || "").trim();
const SLUG = String(process.env.SWEEP_SLUG || "").trim().toLowerCase();
// `let`: the address the sweep reads follows a rename (see `PUBLIC` in main).
// The API is still addressed by the storage slug; only where the SITE is read
// moves.
let SITE = `https://${SLUG}.gofarther.app`;
const PICKER = String(process.env.SWEEP_PICKER || "grok").trim().toLowerCase();
const BUDGET = Number(process.env.SWEEP_BUDGET || 80);
const WANT = String(process.env.SWEEP_LANES || "all").trim().toLowerCase();

/**
 * THE SWITCH, and it reads the word rather than the bytes.
 *
 * The first dispatch on 2026-09-01 died in eleven seconds: the workflow's text
 * box was submitted as `spend ` with a trailing space, and this compared the
 * raw string. Every other input here was trimmed and this one was not. A gate
 * whose job is to make sure a person MEANT it should not refuse the person who
 * meant it and typed a space — that is a refusal about the keyboard, not the
 * intent. Case is forgiven for the same reason. What is still refused is any
 * OTHER word, an empty box, and anything that is not a string.
 */
export const confirmed = (raw) => typeof raw === "string" && raw.trim().toLowerCase() === "spend";

/** `node:https` rather than fetch — undici gives up at 300s. */
function call(method, path, { body, headers, token } = {}) {
  return new Promise((resolve) => {
    const u = new URL(BASE + path);
    const t0 = Date.now();
    const req = https.request({
      hostname: u.hostname, path: u.pathname + u.search, method,
      headers: { Authorization: `Bearer ${token}`, "content-type": "application/json", ...(headers || {}) },
    }, (res) => {
      let text = "";
      res.on("data", (c) => { text += c; });
      res.on("end", () => {
        let json = null;
        try { json = JSON.parse(text); } catch { /* not JSON */ }
        resolve({ status: res.statusCode, ms: Date.now() - t0, json, text, headers: res.headers });
      });
    });
    req.on("error", (e) => resolve({ status: 0, ms: Date.now() - t0, why: e.code || e.message, headers: {} }));
    if (body !== undefined) req.write(typeof body === "string" ? body : JSON.stringify(body));
    req.end();
  });
}

/** The live site, read plainly. Returns { status, text, headers }. */
async function site(path) {
  const r = await fetch(SITE + path, { redirect: "manual", headers: { "accept-encoding": "identity" } }).catch(() => null);
  if (!r) return { status: 0, text: "", headers: new Headers() };
  return { status: r.status, text: await r.text().catch(() => ""), headers: r.headers };
}

const hex32 = () => Array.from({ length: 32 }, () => "0123456789abcdef"[Math.floor(Math.random() * 16)]).join("");
const attr = (html, re) => { const m = re.exec(html); return m ? m[1] : ""; };
const pick = (html, re) => { const m = re.exec(html); return m ? m[0] : ""; };

// ── WHAT THE SITE LOOKS LIKE, in the terms the lanes change ────────────────
async function snapshot() {
  const home = await site("/");
  const html = home.text;
  const sheetHref = attr(html, /href="(\/assets\/[^"]+\.css)"/);
  const sheet = sheetHref ? (await site(sheetHref)).text : "";
  const icon = await site(attr(html, /<link rel="icon" href="([^"]+)"/) || "/icon.svg");
  const qr = await site("/qr.svg");
  const logoFile = await site("/logo.svg");
  const sitemap = await site("/sitemap.xml");
  return {
    build: home.headers.get("x-site-build") || "",
    status: home.status,
    html,
    lang: attr(html, /<html[^>]*\blang="([^"]*)"/),
    dir: attr(html, /<html[^>]*\bdir="([^"]*)"/),
    title: attr(html, /<title>([^<]*)<\/title>/),
    description: attr(html, /<meta name="description" content="([^"]*)"/),
    ogTitle: attr(html, /property="og:title" content="([^"]*)"/),
    locales: [...html.matchAll(/og:locale(?::alternate)?" content="([^"]*)"/g)].map((m) => m[1]),
    root: pick(sheet, /:root\{[^}]*\}/),
    sheetLen: sheet.length,
    headerHtml: pick(html, /<header[\s\S]*?<\/header>/),
    headerText: pick(html, /<header[\s\S]*?<\/header>/).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
    headerLink: pick(html, /<a[^>]*data-slot="site-link"[^>]*>[\s\S]*?<\/a>/),
    // THE HEADER'S CALL-TO-ACTION BY POSITION, NOT BY SLOT: the last anchor in
    // the header that is not a language switch, as its words and its href. The
    // seventh sweep's action lane pointed the button at "/", which the router
    // renders as an active Link with no `site-link` slot, so `headerLink` above
    // read "" and the verdict blamed the wrong thing.
    cta: (() => {
      const h = pick(html, /<header[\s\S]*?<\/header>/);
      const as = [...String(h || "").matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].filter((m) => !/\blang=/.test(m[1]));
      const m = as[as.length - 1];
      return m ? { text: m[2].replace(/<[^>]+>/g, "").trim(), href: ((/\bhref="([^"]*)"/.exec(m[1]) || [])[1] || "") } : { text: "", href: "" };
    })(),
    // THE BRAND LINK, the first anchor in the header: plain text, an <img> of a
    // drawn mark served as a file, or an inline <svg>. The wordmark lane bakes
    // its drawing to /logo.svg and references it by path, exactly as the
    // favicon and the QR are - so a check for an inline <svg> reads a working
    // lane as broken, which is what the fourth sweep did.
    brandLink: pick(pick(html, /<header[\s\S]*?<\/header>/), /<a[^>]*>[\s\S]*?<\/a>/),
    heroAlt: attr(html, /data-slot="safe-image"[\s\S]{0,600}?alt="([^"]*)"/) || attr(html, /alt="([^"]*)"[\s\S]{0,600}?data-slot="safe-image"/),
    slots: [...html.matchAll(/data-slot="([a-z-]+)"/g)].map((m) => m[1]),
    canvas: /<canvas\b/.test(html),
    icon: icon.status === 200 ? icon.text : "",
    qr: qr.status === 200 ? qr.text : "",
    // THE DRAWN MARK'S OWN BYTES: the wordmark lane's second run is judged by
    // the file changing, since the brand link already carries a mark.
    logo: logoFile.status === 200 ? logoFile.text : "",
    routes: [...sitemap.text.matchAll(/<loc>[^<]*?(\/[^<]*)<\/loc>/g)].map((m) => m[1].replace(/^https?:\/\/[^/]+/, "")),
  };
}

// ── THE QR, DECODED AGAINST THE LIBRARY ────────────────────────────────────
//
// `qrSvg` emits one <path> of horizontal runs. Re-derive the dark modules from
// it and compare with what the library says the payload SHOULD produce — the
// only ground truth short of a camera, and the same check site-marks.test uses.
function qrModules(svg) {
  const vb = /viewBox="0 0 (\d+) (\d+)"/.exec(svg);
  const d = /<path[^>]*\sd="([^"]+)"/.exec(svg);
  if (!vb || !d) return null;
  const set = new Set();
  for (const m of d[1].matchAll(/M(\d+)[ ,](\d+)h(\d+)/g)) {
    const x = Number(m[1]), y = Number(m[2]), w = Number(m[3]);
    for (let i = 0; i < w; i++) set.add((x + i) + "," + y);
  }
  return { size: Number(vb[1]), set };
}
function qrMatches(svg, candidates) {
  const got = qrModules(svg);
  if (!got) return { ok: false, why: "unparsed" };
  let qrcode;
  try { qrcode = require("qrcode-generator"); } catch { return { ok: false, why: "no library" }; }
  for (const text of candidates) {
    for (let type = 1; type <= 10; type++) {
      let q;
      try { q = qrcode(type, "M"); q.addData(text); q.make(); } catch { continue; }
      const n = q.getModuleCount();
      const quiet = (got.size - n) / 2;
      if (!Number.isInteger(quiet) || quiet < 0) continue;
      const exp = new Set();
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) exp.add((c + quiet) + "," + (r + quiet));
      if (exp.size === got.set.size && [...exp].every((k) => got.set.has(k))) return { ok: true, text, type };
    }
  }
  return { ok: false, why: "no candidate payload produced these modules" };
}

// ── THE CASES ──────────────────────────────────────────────────────────────
//
// One per lane. `ask` is what a customer would type. `expect` is the lane the
// picker must name. `check(before, after, reply)` answers { ok, note } about the
// SITE. `mayEscalate` names an escalate that is the CORRECT answer on this site,
// which is a pass with a note, not a failure. `held` marks the two that never
// run under `all`.
export const CASES = [
  { lane: "css", ask: "Make the big heading at the top of the page dark red",
    check: (b, a) => ({ ok: a.build !== b.build && a.sheetLen !== b.sheetLen, note: `sheet ${b.sheetLen}→${a.sheetLen} bytes` }) },
  // NOIR, NOT LETTERPRESS. The first sweep asked for letterpress and the server
  // answered `no-change` in 22 seconds for nothing: the site already had it.
  // An honest refusal and a wasted lane. The theme name is not readable off
  // the served page, so the ask names one far from the paper-and-serif look
  // this site was built with.
  { lane: "theme", ask: "Switch the whole site to the noir theme",
    check: (b, a) => ({ ok: a.root && a.root !== b.root, note: a.root === b.root ? ":root colours unchanged" : ":root colours changed" }) },
  { lane: "brand", ask: 'Rename the business to "Crookes Guitar School"',
    check: (b, a) => ({ ok: /Crookes Guitar School/.test(a.title) && /Crookes Guitar School/.test(a.ogTitle), note: `title "${a.title}"` }) },
  { lane: "description", ask: "Change the site description to: Beginner guitar lessons in Crookes, Sheffield. First lesson free.",
    check: (b, a) => ({ ok: a.description !== b.description && /Crookes/.test(a.description), note: `description "${a.description.slice(0, 80)}"` }) },
  // REDRAWN, NOT DRAWN: the fourth sweep gave the header a mark, so a second
  // ask has to change the mark, and the evidence is the served /logo.svg
  // itself - the brand link looks identical before and after.
  { lane: "wordmark", ask: 'Redraw the header wordmark as the letters "CGS" in a bold serif, black on transparent',
    check: (b, a) => {
      const mark = (l) => /<img[^>]*src="\/logo\.svg"/.test(l) || /<svg/.test(l);
      const drawn = /<svg/.test(a.logo);
      return { ok: mark(a.brandLink) && drawn && a.logo !== b.logo,
               note: `brand link ${mark(a.brandLink) ? "carries a mark" : "is plain text"}; /logo.svg ${b.logo.length}→${a.logo.length} bytes${a.logo === b.logo ? " (UNCHANGED)" : ""}` };
    } },
  { lane: "favicon", ask: "Change the tab icon to a simple dark green circle with a white letter G in the middle",
    check: (b, a) => ({ ok: a.icon && a.icon !== b.icon && /<svg/.test(a.icon), note: a.icon === b.icon ? "icon bytes unchanged" : `icon changed (${a.icon.length} bytes)` }) },
  { lane: "lang", ask: "Set the site's language to Welsh",
    check: (b, a) => ({ ok: a.lang === "cy", note: `<html lang="${a.lang}" dir="${a.dir}">` }) },
  // JUDGED BY WHAT A VISITOR GETS, not by the head. The first sweep called this
  // lane a liar: it had added both languages — `/fr` and `/es` answered 200 and
  // the header grew a switch reading Cymraeg · Français · Español — while the
  // check read `og:locale:alternate` tags and found one of two. That is a
  // real, separate defect in the head pack (filed), and a check that judges a
  // lane by a different feature's bug is a false alarm, which this repo rates
  // worse than a miss.
  { lane: "langs", ask: "Also offer the site in French and Spanish",
    check: (b, a) => {
      const sw = a.slots.includes("lang-switch") && !b.slots.includes("lang-switch");
      const names = /Fran[cç]ais/.test(a.headerText) && /Espa[nñ]ol/.test(a.headerText);
      return { ok: sw && names, note: `lang-switch ${sw ? "added" : "absent"}; header "${a.headerText.slice(0, 80)}"; head alternates ${JSON.stringify(a.locales)}` };
    } },
  // NOT THE HEADER BUTTON. The first ask ("press the button, open the
  // dialler") read as the button's link and went to the nav rung; a behaviour
  // about another control is unambiguous.
  { lane: "behavior", ask: "When someone opens one FAQ question, close any other question that is open",
    // RECORDED, NOT RENDERED — the field decides and stores, nothing generates
    // from it yet (owner's call). The only observable is the server saying the
    // stored look moved, plus the build moving because a look edit republishes.
    check: (b, a, r) => ({ ok: Array.isArray(r.moved) && r.moved.includes("behavior"), note: `moved ${JSON.stringify(r.moved)} (recorded only; nothing renders from behavior yet)` }) },
  // AN EDIT OF THE CODE THE SITE HAS. "Add a QR code…" was the fifth sweep's
  // ask, and it is an ADDON now (owner, 2026-09-02: "add will always go in
  // addon") — the edit path refuses to create one and the site has carried a
  // code since that sweep. So this asks for the one thing the lane still owns
  // on such a site: the caption, with the destination left alone.
  { lane: "qr", ask: 'Change the QR code\'s caption to "Scan to ring and book"',
    // SERVED IS NOT SHOWN. The fifth sweep's code decoded perfectly and the page
    // referenced it zero times - the lane bakes the file and nothing places the
    // figure (filed, fixed). The check demands all three: the file still decodes
    // to the number, the page points at it, and the new caption is on the page.
    check: (b, a) => {
      if (!a.qr) return { ok: false, note: "/qr.svg is not served" };
      const m = qrMatches(a.qr, ["tel:01144960123", "tel:+441144960123", "tel:0114 496 0123", "tel:+44 114 496 0123", "TEL:01144960123", "TEL:+441144960123"]);
      const shown = /qr\.svg/.test(a.html);
      const captioned = /Scan to ring and book/.test(a.html);
      return { ok: m.ok && shown && captioned, note: (m.ok ? `QR decodes to ${m.text}` : `QR served but ${m.why}`) + (shown ? "; page shows it" : "; PAGE DOES NOT REFERENCE IT") + (captioned ? "; new caption on the page" : "; CAPTION UNCHANGED") };
    } },
  // BOTH HALVES NAMED. The seventh sweep's rung changed the words and sent
  // the button from `tel:+441144960123` to "/" (the digest had called a
  // computed button absent — fixed), and run 12's ask about the words alone
  // was honestly "already so" with the link still "/". So this ask names the
  // link as well, and the check reads both off the header's call-to-action:
  // the words asked for AND a dial link to that number, in any of the
  // spellings a model writes a UK number in.
  { lane: "action", ask: 'Change the button at the top to say "Book a free lesson" and make it ring 0114 496 0123',
    check: (b, a) => {
      const href = String((a.cta && a.cta.href) || "");
      const dials = /^tel:(\+44|0)\s?114\s?496\s?0123$/i.test(href.replace(/[\s()-]/g, "").replace(/^tel:\+44\s?0/i, "tel:+44"));
      return {
        ok: /Book a free lesson/i.test(a.cta.text) && dials,
        note: `button "${a.cta.text}" -> ${href || "nothing"}${dials ? "" : " (NOT the dial link)"}${b.cta && b.cta.href !== href ? ` (was ${b.cta.href || "nothing"})` : ""}`,
      };
    } },
  { lane: "images", ask: "Change the main photo to a close-up of a hand pressing a chord on a guitar fretboard",
    check: (b, a) => ({ ok: a.heroAlt && a.heroAlt !== b.heroAlt && /fretboard|chord|hand/i.test(a.heroAlt), note: `alt "${a.heroAlt.slice(0, 90)}"` }) },
  { lane: "backend", ask: "Only let signed-in members see the price list",
    // A SITE WITH NO DATABASE cannot enforce a rule in Postgres, and the honest
    // answer is a refusal, not a pretend. That refusal IS the pass here.
    mayEscalate: ["no-backend", "no-meta", "no-db", "rules"],
    check: (b, a) => ({ ok: a.build === b.build, note: "no database on this site — an honest escalate with the build untouched is correct" }) },
  // AN EDIT OF THE PAGE'S OWN CODE. "Add a small custom component…" was the
  // ask through the sixth sweep; adding is the ADDON step now (owner,
  // 2026-09-02), and `tsx` stays an edit because the page's code always exists
  // ("tsx does exist, it is literally everything on the page, it could be
  // changing a component"). fretwork-1 has carried `-parts/chord-diagram`
  // since sweep eight, so this changes that component and reads the change
  // off the page, where the part's markup renders.
  { lane: "tsx", ask: 'Change the chord diagram component so the word "Fingering" appears above every diagram\'s grid',
    check: (b, a, r) => {
      const words = (s) => (s.replace(/<[^>]+>/g, " ").match(/\bFingering\b/g) || []).length;
      return { ok: a.build !== b.build && words(a.html) > 0 && words(a.html) > words(b.html),
               note: `files ${r.files ?? "?"}; "Fingering" ${words(b.html)}→${words(a.html)} on the page` };
    } },
  // AN EDIT OF THE SCENE THE SITE HAS (the 3D pick from sweep five). Motion is
  // not observable headless, so this reads the two things that are: the canvas
  // is still there, and the page's code moved on a real publish.
  // A PART-ONLY CHANGE REPORTS `changed: []` AND `files: 25`. Run 14
  // (2026-09-02) published the slower pick — the scene is a component, the
  // page file came back byte-identical — and this check, keyed on the page
  // list alone, called a real publish a lie and stopped the run. Any of the
  // three signs of a publish counts, the same rule the edge wait uses.
  { lane: "three", ask: "Make the 3D guitar pick spin half as fast",
    check: (b, a, r) => {
      const changed = Array.isArray(r.changed) && r.changed.length > 0;
      const shipped = changed || Number(r.files) > 0 || a.html !== b.html;
      return { ok: !!a.canvas && !!b.canvas && a.build !== b.build && shipped,
               note: `canvas ${a.canvas ? "kept" : "GONE"}; ${changed ? "changed " + JSON.stringify(r.changed) : Number(r.files) > 0 ? "files " + r.files + " (component only)" : "html " + (a.html !== b.html ? "moved" : "unchanged")} (motion is not observable headless)` };
    } },
  { lane: "shape", ask: "Move the price list so it sits above the numbered steps",
    check: (b, a) => {
      const order = (s) => [s.slots.indexOf("price-list"), s.slots.indexOf("steps")];
      const [bp, bs] = order(b); const [ap, as] = order(a);
      return { ok: ap >= 0 && as >= 0 && ap < as && !(bp >= 0 && bs >= 0 && bp < bs), note: `price-list/steps order before ${bp}/${bs}, after ${ap}/${as}` };
    } },
  // A CHANGE OF COMPONENT, not an addition. "Add an FAQ accordion…" (sweeps
  // five and six) is an addon ask now; the site has the accordion, so this
  // swaps it for another kit component and reads the swap off the slots.
  { lane: "components", ask: "Replace the FAQ accordion with a plain two-column list of the same questions and answers",
    check: (b, a) => ({ ok: a.build !== b.build && b.slots.some((s) => /accordion/.test(s)) && !a.slots.some((s) => /accordion/.test(s)) && /question|lesson/i.test(a.html.replace(/<[^>]+>/g, " ")),
                        note: `accordion ${a.slots.some((s) => /accordion/.test(s)) ? "STILL THERE" : "gone"}; slots now ${JSON.stringify(a.slots.filter((s) => !b.slots.includes(s)))}` }) },
  { lane: "purpose", ask: "Make the page about group lessons for adults rather than one-to-one",
    check: (b, a) => ({ ok: a.build !== b.build && a.html !== b.html && /group/i.test(a.description + a.html.replace(/<[^>]+>/g, " ").slice(0, 4000)), note: "page rewritten toward groups" }) },
  { lane: "pages", ask: "Add a pricing page",
    check: (b, a) => ({ ok: a.routes.some((r) => /pric/i.test(r)) && !b.routes.some((r) => /pric/i.test(r)), note: `routes ${JSON.stringify(a.routes)}` }) },
  // HELD BACK. Real lanes, never under `all`.
  // VERIFIED ON BOTH ADDRESSES: the new one answers, the old one redirects to
  // it. The after-snapshot of the old address is the redirect itself, so the
  // check reads its own two fetches (`x.newStatus`, `x.oldStatus`,
  // `x.oldLocation`), filled by the runner.
  { lane: "slug", held: "renames the site: the old address redirects for ever and the new one is claimed", ask: 'Change the site address to "crookes-guitar"', newSlug: "crookes-guitar",
    // RE-RUNNABLE: the runner flips the target to whichever name the site does
    // not have now — a site already answering at crookes-guitar is asked back
    // to its storage name — because the lane refuses a rename to the name the
    // site already has, and one proof must not put the lane beyond a second.
    flip: (publicName, slug) => (publicName === "crookes-guitar" ? slug : "crookes-guitar"),
    askFor: (name) => `Change the site address to "${name}"`,
    // THE HEAD FOLLOWS THE ADDRESS, OR IT IS NOT A RENAME (run 17, 2026-09-02):
    // both addresses answered the right way while the canonical at the new one
    // still named the old — the alias was live and the sidecar was not.
    // `x.newCanonical` is the canonical link read at the new address.
    check: (b, a, r, x) => ({ ok: x.newStatus === 200 && x.oldStatus >= 300 && x.oldStatus < 400
        && String(x.oldLocation || "").startsWith(`https://${x.newSlug}.gofarther.app/`)
        && String(x.newCanonical || "") === `https://${x.newSlug}.gofarther.app/`,
      note: `${x.newSlug}.gofarther.app answers ${x.newStatus ?? "?"}, canonical ${x.newCanonical || "(none)"}; the old address answers ${x.oldStatus ?? "?"}${x.oldLocation ? " → " + x.oldLocation : ""}` }) },
  // `kind` ESCALATES TO A BUILD, and the client follows it to the rebuild
  // route; so does the runner (`hop: "build"`), which is the only way to see
  // whether the site that comes back is the tool that was asked for.
  { lane: "kind", held: "a full rebuild at ~45 credits that replaces the site", ask: "Turn this into a booking tool rather than a shopfront", hop: "build",
    check: (b, a, r, x) => ({ ok: a.build !== b.build && a.html !== b.html && x.rebuilt === true,
      note: `rebuild ${x.rebuilt ? "published" : "did not publish"}; title "${a.title}"; slots ${JSON.stringify(a.slots.slice(0, 8))}` }) },
];

// THE NAMES ARE CHECKED, NOT FILTERED (2026-09-02, run 16). The dispatch box
// said `kind,slug.` — a full stop after the last name — and this function
// dropped the name it did not know without a word, so the run was `kind`
// alone: the rebuild happened, the rename never did, and the log read as a
// complete pass. A name that is not a lane is now a refusal, thrown here and
// printed by the runner before sign-in, naming the stranger and the lanes
// there are. Punctuation at either end of a name is forgiven, since `slug.`
// can only mean `slug`; a name typed twice runs once. The one input that
// costs nothing to get wrong is the one that decides what the money buys.
export function chooseLanes(want, cases) {
  const trim = (s) => s.replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, "");
  const w = trim(String(want || "all").trim().toLowerCase());
  if (!w || w === "all") return cases.filter((c) => !c.held).map((c) => c.lane);
  const names = [...new Set(w.split(/[\s,;]+/).map(trim).filter(Boolean))];
  const known = cases.map((c) => c.lane);
  const strangers = names.filter((n) => !known.includes(n));
  if (strangers.length) throw new Error(`not a lane: ${strangers.map((s) => `"${s}"`).join(", ")} — the lanes are ${known.join(", ")}`);
  return names;
}

// ── RUN ────────────────────────────────────────────────────────────────────
async function main() {
  if (!confirmed(process.env.SWEEP_CONFIRM)) { console.error("SWEEP_CONFIRM must be the word `spend` — this harness costs real credits on a live site."); process.exit(1); }
  if (!EMAIL || !SERVICE_KEY || !SLUG) { console.error("OWNER_EMAIL, SUPABASE_SERVICE_KEY and SWEEP_SLUG are required"); process.exit(1); }
  // A stranger in the list refuses HERE, before the sign-in and the balance
  // read: nothing spent, and the log says which name was wrong.
  let lanes;
  try { lanes = chooseLanes(WANT, CASES); } catch (e) { console.error(String(e && e.message)); process.exit(1); }
  if (!lanes.length) { console.error("no lanes selected"); process.exit(1); }

  const svc = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "content-type": "application/json" };
  const gl = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, { method: "POST", headers: svc, body: JSON.stringify({ type: "magiclink", email: EMAIL }) });
  const glBody = await gl.json().catch(() => ({}));
  const hashed = glBody.hashed_token || (glBody.properties && glBody.properties.hashed_token);
  if (!hashed) { console.error("could not generate a sign-in link:", gl.status); process.exit(1); }
  const vr = await fetch(`${SUPABASE_URL}/auth/v1/verify`, { method: "POST", headers: { apikey: ANON_KEY, "content-type": "application/json" }, body: JSON.stringify({ type: "magiclink", token_hash: hashed }) });
  const session = await vr.json().catch(() => ({}));
  const TOKEN = session.access_token; const UID = (session.user || {}).id || "";
  if (!TOKEN) { console.error("could not open a session:", vr.status); process.exit(1); }
  const balance = () => fetch(`${SUPABASE_URL}/rest/v1/credits?user_id=eq.${UID}&select=balance`, { headers: svc })
    .then((r) => r.json()).then((r) => Number((r[0] || {}).balance || 0)).catch(() => -1);

  console.log(`signed in as ${(session.user || {}).email}  site=${SLUG}  picker=${PICKER}  budget=${BUDGET}`);
  console.log(`lanes: ${lanes.join(", ")}\n`);
  const start = await balance();
  console.log(`balance at start: ${start}\n`);

  const results = [];
  // THE ADDRESS THE SITE ANSWERS AT NOW (run 17, 2026-09-02). A renamed site
  // 301s from its storage name, and every read here is `redirect: "manual"`
  // so an old address's redirect can be SEEN — which would read the renamed
  // site itself as "does not answer 200". So that one hop is followed ONCE,
  // here, and the sweep reads the site where it lives. `PUBLIC` is the name
  // the rename case flips away from.
  let PUBLIC = SLUG;
  {
    const r = await fetch(SITE + "/", { redirect: "manual" }).catch(() => null);
    const loc = r && r.status >= 300 && r.status < 400 ? String(r.headers.get("location") || "") : "";
    const m = /^https:\/\/([a-z0-9-]+)\.gofarther\.app\//.exec(loc);
    if (m && m[1] !== SLUG) { PUBLIC = m[1]; SITE = `https://${PUBLIC}.gofarther.app`; console.log(`${SLUG} answers at ${PUBLIC}.gofarther.app now (the storage name redirects there)\n`); }
  }
  let before = await snapshot();
  if (before.status !== 200) { console.error(`the site does not answer 200 (${before.status}) — nothing to sweep against`); process.exit(1); }
  console.log(`site is up, build ${before.build}, lang=${before.lang}, title="${before.title}"\n`);

  for (const lane of lanes) {
    const c = CASES.find((x) => x.lane === lane);
    const spent = start - (await balance());
    if (spent > BUDGET) { console.log(`BUDGET EXHAUSTED (${spent} > ${BUDGET}) — stopping before ${lane}`); break; }
    // THE RENAME'S TARGET IS CHOSEN AT RUN TIME — whichever name the site does
    // not have now — so the lane can be proven again after it has run once.
    const newSlug = typeof c.flip === "function" ? c.flip(PUBLIC, SLUG) : c.newSlug;
    const ask = typeof c.askFor === "function" ? c.askFor(newSlug) : c.ask;
    console.log(`━━ ${lane}  "${ask}"`);
    const bal0 = await balance();
    const t0 = Date.now();
    const p = await call("POST", `/api/site/${encodeURIComponent(SLUG)}/edit`,
      { token: TOKEN, body: { instruction: ask, layer: "look", page: "", remove: false, rename: "", tab: false, picker: PICKER, idem: hex32() } });
    let reply = p; let job = "";
    if (p.status === 202 && p.json && p.json.job) {
      job = p.json.job;
      console.log(`   queued ${job} in ${(p.ms / 1000).toFixed(1)}s`);
      reply = null;
      for (let i = 0; i < 200; i++) {
        await new Promise((r) => setTimeout(r, 5000));
        const q = await call("GET", `/api/site/edit/${job}`, { token: TOKEN });
        if (q.status === 404) { reply = q; break; }
        if ((q.headers["x-gf-edit"] || "") === "final") { reply = q; break; }
        if (q.json && ["failed", "cancelled", "lost"].includes(q.json.status)) { reply = q; break; }
        if (i % 6 === 0 && q.json) console.log(`   ${String(Math.round((Date.now() - t0) / 1000)).padStart(4)}s  ${q.json.status || "?"}${q.json.phase ? " / " + q.json.phase : ""}`);
      }
    } else {
      console.log(`   synchronous answer ${p.status} in ${(p.ms / 1000).toFixed(1)}s (the site is not on the async allowlist?)`);
    }
    let body = (reply && reply.json) || {};
    const extra = {};
    // ── THE BUILD HOP ───────────────────────────────────────────────────
    //
    // `kind` answers escalate:build, and the chatbox follows that to the
    // rebuild route. The runner does the same, once, and only for the case
    // that says so: a queued rebuild watched to its end, then the site read.
    if (c.hop === "build" && body.escalate === true && body.reason === "build") {
      const rb = await call("POST", "/api/site/react-revise", { token: TOKEN, body: { slug: SLUG, instruction: c.ask, images: [], picker: PICKER } });
      const bjob = rb.json && (rb.json.job || rb.json.id);
      console.log(`   escalated to build; rebuild ${rb.status} ${bjob ? "job " + bjob : rb.text.slice(0, 120)}`);
      if (bjob) {
        let last = null;
        for (let i = 0; i < 150; i++) {
          await new Promise((r) => setTimeout(r, 10000));
          const q = await call("GET", `/api/site/build/${bjob}`, { token: TOKEN });
          if (q.status !== 202) { last = q; break; }
          if (i % 6 === 0) console.log(`   ${String(Math.round((Date.now() - t0) / 1000)).padStart(4)}s  build pending${q.json && q.json.flight ? " / " + JSON.stringify(q.json.flight).slice(0, 80) : ""}`);
        }
        if (last) { body = { ...(last.json || {}), ok: !!(last.json && last.json.ok === true), hopped: "build" }; extra.rebuilt = body.ok === true; console.log(`   rebuild answered ${last.status}: ${last.text.slice(0, 200)}`); }
        else { body = { ok: false, error: "build-watch", hopped: "build" }; }
      } else { body = { ok: false, error: "build-post", detail: rb.text.slice(0, 200), hopped: "build" }; }
    }
    const wall = (Date.now() - t0) / 1000;
    const bal1 = await balance();
    const cost = bal0 - bal1;
    // THE EDGE IS NOT THE DATABASE. The stored reply is handed back the instant
    // finalize runs, and `worker:put` has answered 200 by then - but the new
    // script takes some seconds to be what every edge serves. The third sweep
    // read the site in that window, saw the old build id and the old colours,
    // and called the theme lane a liar for a change that was live a moment
    // later. So a claimed success WAITS for the build id to move, bounded; an
    // escalate or an already-so must NOT move it, and is read at once.
    // A PUBLISH IS CLAIMED BY ANY OF THREE FIELDS. `moved` is the look lanes'
    // list; the nav rung reports `changed` and the qr placement step reports
    // neither, only `files`. The seventh sweep read `qr` and `action` before
    // the edge had the new build, because the wait was gated on `moved` alone,
    // and called a placed code "already so" and a changed button a lie.
    // A MISSING ID IS NOT A MOVED ID. Run 13 (2026-09-02) called a correct
    // `action` edit a lie ten seconds after it published: one probe came back
    // without the header (a failed fetch, or an edge mid-swap), "" is never
    // equal to the old id, the wait broke at once, and the snapshot read the
    // old build. The break needs a REAL id that differs — and the snapshot
    // that follows must show that same id, or it is re-taken: two requests a
    // second apart can land on two edges, one still on the previous script.
    let seen = "";
    if (body.ok === true && ((Array.isArray(body.moved) && body.moved.length) || (Array.isArray(body.changed) && body.changed.length) || Number(body.files) > 0 || body.hopped === "build")) {
      const t1 = Date.now();
      while (Date.now() - t1 < 90000) {
        const probe = await site("/");
        const id = probe.headers.get("x-site-build") || "";
        if (id && id !== before.build) { seen = id; break; }
        await new Promise((r) => setTimeout(r, 5000));
      }
    }
    // A RENAME MOVES THE ADDRESS, NOT THE BUILD (2026-09-02): the head is
    // patched in R2 and nothing compiles, so the build id is the one thing
    // that must NOT move — `c.newSlug` left the gate above for that reason
    // (it would spin the full bound for an id that never moves). What is
    // waited for is the new address answering with its own canonical — the
    // alias cache on another isolate can lag the row by a moment — bounded
    // the same way. From then on the site is read at its new name.
    // BOTH ADDRESSES, AND UP TO THE ALIAS CACHE'S LIFETIME (run 19,
    // 2026-09-02): the new address answered with its own canonical within
    // twenty seconds, and the OLD one still served the site — an edge holding
    // the alias row it cached before the rename keeps serving it for up to
    // five minutes (`aliasRoutes`, 300 s per isolate), and only the lane's own
    // isolate forgets at once. This wait watched the new address alone and
    // called a correct rename a lie. It holds until the new address answers
    // 200 with its canonical AND the old one redirects to it, bounded a
    // little past that lifetime.
    if (body.ok === true && c.newSlug) {
      const tR = Date.now();
      while (Date.now() - tR < 330000) {
        const nu = await fetch(`https://${newSlug}.gofarther.app/`, { redirect: "manual" }).catch(() => null);
        const html = nu && nu.status === 200 ? await nu.text().catch(() => "") : "";
        const headOk = attr(html, /<link rel="canonical" href="([^"]*)"/) === `https://${newSlug}.gofarther.app/`;
        const old = await fetch(`https://${PUBLIC}.gofarther.app/`, { redirect: "manual" }).catch(() => null);
        const oldOk = !!old && old.status >= 300 && old.status < 400 && String(old.headers.get("location") || "").startsWith(`https://${newSlug}.gofarther.app/`);
        if (headOk && oldOk) break;
        await new Promise((r) => setTimeout(r, 5000));
      }
      SITE = `https://${newSlug}.gofarther.app`;
    }
    let after = await snapshot();
    for (let i = 0; seen && after.build !== seen && i < 6; i++) {
      await new Promise((r) => setTimeout(r, 5000));
      after = await snapshot();
    }
    // THE RENAME'S EVIDENCE: both addresses, read plainly — the old one by the
    // name the site had when this lane began, since SITE has moved on.
    if (c.newSlug) {
      const nu = await fetch(`https://${newSlug}.gofarther.app/`, { redirect: "manual" }).catch(() => null);
      const old = await fetch(`https://${PUBLIC}.gofarther.app/`, { redirect: "manual" }).catch(() => null);
      extra.newSlug = newSlug;
      extra.newStatus = nu ? nu.status : 0; extra.oldStatus = old ? old.status : 0; extra.oldLocation = old ? (old.headers.get("location") || "") : "";
      // THE HEAD AT THE NEW ADDRESS (run 17): the alias can be live while the
      // canonical still names the old name, and only this line can tell.
      extra.newCanonical = nu && nu.status === 200 ? attr(await nu.text().catch(() => ""), /<link rel="canonical" href="([^"]*)"/) : "";
      if (body.ok === true) PUBLIC = newSlug;
    }
    const claimedOk = body.ok === true;
    const escalated = body.escalate === true;
    const named = Array.isArray(body.lanes) ? body.lanes : [];
    let verdict, note;
    if (!reply) { verdict = "NO ANSWER"; note = "the job did not finish inside the watch"; }
    else if (body.review === true || (body.error === "needs-review")) { verdict = "NEEDS REVIEW"; note = "stopping — do not retry"; }
    else if (escalated && c.mayEscalate && c.mayEscalate.includes(String(body.reason))) {
      const chk = c.check(before, after, body);
      verdict = chk.ok && after.build === before.build ? "ok (honest refusal)" : "LIE"; note = `escalate ${body.reason}; ${chk.note}`;
    }
    else if (escalated) { verdict = "escalated"; note = `reason ${body.reason}${after.build !== before.build ? " — AND THE BUILD MOVED, which an escalate must never do" : ""}`; if (after.build !== before.build) verdict = "LIE"; }
    // `detail` IS THE DIAGNOSIS. The first sweep printed "422 compile" for two
    // lanes whose real answers were "aborted due to timeout" and a container
    // replying `Container …` in plain text — a container being recycled onto a
    // new image under the sweep, because a push to main rolls it. The
    // customer-facing `msg` collapsed both into "didn't compile", which is the
    // recorded failure-that-cannot-name-itself; the honest half was in `detail`
    // the whole time and this line did not print it.
    // "YOU ALREADY HAVE THAT" IS AN HONEST ANSWER, and the second sweep stopped
    // on it: the css lane answered ok with a lookNote, moved nothing, published
    // nothing, and this read "ok but the build did not move" as a lie. The
    // server composes that sentence precisely because it knows the difference
    // between already-so and could-not-do; the harness has to honour it.
    // AND NOT WHEN ANYTHING SHIPPED. The qr lane's look step answers "already
    // so" for a code the site already stores, and the page step that follows
    // it publishes 25 files to place it; the lookNote alone is the first step's
    // sentence, not the message's outcome.
    else if (claimedOk && typeof body.lookNote === "string" && !(Array.isArray(body.moved) && body.moved.length) && !(Array.isArray(body.changed) && body.changed.length) && !(Number(body.files) > 0) && after.build === before.build) {
      verdict = "ok (already so)"; note = body.lookNote;
    }
    else if (!claimedOk) { verdict = "failed"; note = `${reply.status} ${String(body.error || "")} — ${String(body.detail || body.msg || reply.text || "").slice(0, 200)}`; }
    // A RENAME IS JUDGED ON ITS ADDRESSES AND ITS HEAD, WITH THE BUILD UNMOVED:
    // nothing compiles, so the generic rule below — which reads an unmoved
    // build as a lie — would call every correct rename a liar.
    else if (c.newSlug) {
      const chk = c.check(before, after, body, extra);
      const still = after.build === before.build;
      verdict = chk.ok && still ? "ok" : "LIE"; note = chk.note + (still ? "" : " — AND THE BUILD MOVED, which a rename must not do");
    }
    else {
      const chk = c.check(before, after, body, extra);
      const moved = after.build !== before.build;
      if (chk.ok && moved) { verdict = "ok"; note = chk.note; }
      else if (!moved) { verdict = "LIE"; note = `reply says ok but the build did not move; ${chk.note}`; }
      else { verdict = "LIE"; note = `reply says ok, build moved, but the lane's own change is not on the site; ${chk.note}`; }
    }
    const pickedRight = !named.length || named.includes(lane);
    console.log(`   picker named ${JSON.stringify(named)}${pickedRight ? "" : "  ← NOT " + lane}  layer=${body.layer || "-"}  cost=${cost}  ${wall.toFixed(0)}s  build ${before.build}→${after.build}`);
    console.log(`   ${verdict.toUpperCase()}: ${note}\n`);
    results.push({ lane, named, layer: body.layer || "", verdict, note, cost, wall: Math.round(wall), job, build: after.build, pickedRight });
    if (verdict === "LIE" || verdict === "NEEDS REVIEW" || verdict === "NO ANSWER") { console.log(`STOPPING on ${lane}: ${verdict}`); break; }
    before = after;
  }

  const end = await balance();
  console.log("\n══ SUMMARY ══");
  console.log("lane".padEnd(12) + "named".padEnd(22) + "layer".padEnd(9) + "cost".padEnd(6) + "s".padEnd(6) + "verdict");
  for (const r of results) console.log(r.lane.padEnd(12) + JSON.stringify(r.named).padEnd(22) + r.layer.padEnd(9) + String(r.cost).padEnd(6) + String(r.wall).padEnd(6) + r.verdict + (r.pickedRight ? "" : "  (picker named the wrong lane)"));
  console.log(`\nbalance ${start} → ${end}  (spent ${start - end})`);
  console.log(`\n${JSON.stringify(results)}`);
  // A FAILED LANE IS A RED RUN (run 17, 2026-09-02): the slug lane's job was
  // lost and refunded, the verdict said "failed", and the run ended green —
  // the owner reads the colour, and green said the rename had worked.
  const bad = results.filter((r) => /LIE|NEEDS REVIEW|NO ANSWER|^failed$/.test(r.verdict));
  process.exit(bad.length ? 1 : 0);
}

// Importable for its CASES without running: the test reads the table.
if (process.argv[1] && /lane-sweep\.mjs$/.test(process.argv[1])) main();
