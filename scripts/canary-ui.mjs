// ── THE CANARY'S UI MODE: THE REAL APP, IN A REAL BROWSER, AS THE OWNER ─────
//
// Every other harness here posts to the API, and at most EXECUTES the browser's
// reply composer in Node (`editBrowserReply`). A customer does neither: they
// press the + button, pick a file, type into the message box, press Send and
// wait for the reply before typing the next thing. Test 4a's Part B is about
// exactly that surface — an attachment sent from the real composer, and second
// messages from one tab — so it is driven here the way a person drives it: on
// gofarther.dev, in a real Chromium, one tab, no reload.
//
// SIGNED IN WITHOUT A PASSWORD, AND WITHOUT A SECOND WAY IN. The canary already
// opens an owner session (a magic link minted with the service key and
// verified); this module plants THAT session where `auth.js` keeps one
// (`zephyr_session_v1`), for the app's own origin only, before the page's first
// script runs. The app then boots signed in through its own code path.
//
// WHAT IT REFUSES, AND WHERE. Everything that can be checked for free is
// checked before the first Send: the app opened signed in as the right
// account, the site's card opened its workspace, the composer is idle, the file
// landed in the attachment strip and the words are in the box. Without `spend`
// it stops there (a rehearsal: nothing is sent). With it, each message is sent
// only when the previous reply is on screen and the composer is idle again, and
// the scenario stops — sending nothing more — on a reply that never comes, a
// composer that stays busy, a balance it cannot read, or a spend past the
// scenario's budget.
//
// NOTHING SECRET IS RECORDED. No header is kept, auth traffic is not recorded,
// and an attached image travels into the record as its name, size and sha256.

import fs from "node:fs";
import crypto from "node:crypto";
import {
  readBoth, baselineVerdict, changeVerdict, restorePlan, restoreRow, recoverRow, rowDiff, shownVerdict, lineIsFor,
  describeRows, describeRecovery, probeBody, probeVerdict, shownLead, untouchedVerdict,
} from "./canary-rows.mjs";
import {
  markerBooking, readRulesState, rulesStartVerdict, closingVerdict, classifyBooking, insertionVerdict,
  cleanupPlan, stillMarker, deleteVerdict, cleanupVerified, censusOf, tablesOf, describeRules, bookingBodyVerdict,
  bookingGate,
} from "./canary-rules.mjs";
import { replyJobsOf, trackHeld, repliesNow, timedOut } from "./canary-replies.mjs";
import { fieldPlan, fieldBindings, formGate } from "./canary-form.mjs";

export const SESSION_KEY = "zephyr_session_v1";
// THE APP'S FIRST-RUN GREETING, KEPT AS SEEN (`WELCOME_KEY` in public/chat.js).
export const WELCOME_SEEN_KEY = "zephyr_welcome_v1";

// ── TEST 4b's D1: ONE ROW OF A LIVE SITE'S DATABASE ─────────────────────────
//
// The proposal's record of fold-lane-bakery's `loaves`, as a visitor's read
// answered it at 2026-09-27 01:31:00Z. D1 takes its own baseline immediately
// before its message and judges everything against THAT; the record is what
// that baseline is compared with (said, not refused), and what the recovery
// run compares a visitor's read with when D1's own run could not finish.
const LOAVES_RECORD = Object.freeze([
  Object.freeze({ id: 1, name: "Country White", description: "Our everyday loaf. Open crumb, thin crisp crust, a little wheat sweetness.", price: 4.8, photo: null, created_at: "2026-08-21 23:06:22" }),
  Object.freeze({ id: 2, name: "Dark Rye", description: "Dense and malty. Good with smoked fish or a sharp cheddar.", price: 5.2, photo: null, created_at: "2026-08-21 23:06:22" }),
  Object.freeze({ id: 3, name: "Seeded Wholemeal", description: "Toasted sunflower, flax and sesame through a wholemeal dough.", price: 5.4, photo: null, created_at: "2026-08-21 23:06:22" }),
  Object.freeze({ id: 4, name: "Olive & Rosemary", description: "Green olives and a handful of rosemary from the morning bunches.", price: 5.8, photo: null, created_at: "2026-08-21 23:06:23" }),
  Object.freeze({ id: 5, name: "Walnut Levain", description: "Butter walnuts folded through a long-fermented white dough.", price: 6, photo: null, created_at: "2026-08-21 23:06:23" }),
  Object.freeze({ id: 6, name: "Sea Salt Focaccia", description: "A tray bake, heavy on the oil, finished with flaky salt.", price: 4.5, photo: null, created_at: "2026-08-21 23:06:23" }),
]);

// THE ONE CHANGE, AND THE ONLY FIELD EVER WRITTEN BACK: loaves id 6 (it must
// still be the Sea Salt Focaccia), price 4.5 -> 4.6. `from`/`to` are compared
// as decimals, so a NUMERIC read back as "4.60" is 4.6. `shown` is where a
// visitor sees it: the order page's loaf list, one radio card per loaf.
const D1_ROW = Object.freeze({
  table: "loaves",
  id: 6,
  match: Object.freeze({ name: "Sea Salt Focaccia" }),
  field: "price",
  from: "4.5",
  to: "4.6",
  shown: Object.freeze({ path: "/order", sel: 'input[type="radio"]', before: "£4.50", after: "£4.60" }),
  record: LOAVES_RECORD,
});

// ── TEST 9: A FOLLOW-UP AFTER A FAILURE, IN THE SAME TAB ────────────────────
//
// fretwork-1's `lessons` as a visitor's read answered it at 2026-09-30
// 21:06:19Z, once run 80 had taken "Group of three" off (541 bytes, `0-2/3`),
// and again at 21:31:30Z, unchanged. The owner's demo-site rule (2026-09-30)
// makes the table as it stands the baseline: nothing is put back, before or
// after.
const LESSONS_RECORD = Object.freeze([
  Object.freeze({ id: 1, name: "First lesson", description: "A free 45-minute taster in Crookes. Bring a guitar if you have one; there is a spare if not.", price: 0, duration: "45 minutes", created_at: "2026-09-02 16:57:02" }),
  Object.freeze({ id: 3, name: "One-to-one", description: "A private 45-minute lesson. Beginners welcome.", price: 30, duration: "45 minutes", created_at: "2026-09-02 16:57:02" }),
  Object.freeze({ id: 4, name: "Hour one-to-one", description: "A full hour when 45 minutes is not enough.", price: 42, duration: "60 minutes", created_at: "2026-09-02 16:57:02" }),
]);

// THE SECOND MESSAGE'S ONE CHANGE: lessons id 4 (it must still be the Hour
// one-to-one), price 42 -> 45, and KEPT. `restore: false` is the owner's
// demo-site rule, so this run makes no write of its own at all: no put-back,
// and no conditional-write probe either. `shown` is where a visitor sees it:
// the price list, and the home page, which reads the same table. A line there
// reads "Hour one-to-one 60 minutes A full hour when 45 minutes is not enough.
// £42", so it is found by its whole start (`lead`), not by the name alone.
const FOLLOW_ROW = Object.freeze({
  table: "lessons",
  id: 4,
  match: Object.freeze({ name: "Hour one-to-one" }),
  field: "price",
  from: "42",
  to: "45",
  restore: false,
  shown: Object.freeze({
    path: "/prices",
    also: Object.freeze(["/"]),
    sel: "li > span",
    lead: "Hour one-to-one 60 minutes A full hour when 45 minutes is not enough.",
    before: "£42",
    after: "£45",
  }),
  record: LESSONS_RECORD,
});

// ── THE REQUEST BATCH'S ONE ROW (R2, 2026-10-03) ────────────────────────────
//
// fold-lane-bakery's `loaves` as a visitor's read answered it at
// 2026-10-03 23:53:35Z, read whole (`0-6/7`): D1's six rows as recorded, the
// focaccia back at 4.5, and the Rye & Caraway the additions batch's routing
// controls left. The press takes its own baseline immediately before its
// message, as D1 does; this is what that baseline is compared with.
const LOAVES_NOW = Object.freeze([
  ...LOAVES_RECORD,
  Object.freeze({ id: 7, name: "Rye & Caraway", description: "A light rye with toasted caraway.", price: 5, photo: null, created_at: "2026-10-01 23:52:15" }),
]);

// THE PRICE R2 CHANGES: loaves id 5 (it must still be the Walnut Levain),
// 6 -> 6.2, KEPT (`restore: false`, the owner's demo-site rule: this run makes
// no write of its own, no put-back and no conditional-write probe). `shown` is
// where a visitor sees it: the order page's radio cards, as D1 reads them.
const WALNUT_ROW = Object.freeze({
  table: "loaves",
  id: 5,
  match: Object.freeze({ name: "Walnut Levain" }),
  field: "price",
  from: "6",
  to: "6.2",
  restore: false,
  shown: Object.freeze({ path: "/order", sel: 'input[type="radio"]', before: "£6.00", after: "£6.20" }),
  record: LOAVES_NOW,
});

// ── THE RULES TEST ON lido-axes-b ───────────────────────────────────────────
//
// What the site is kept for, read at 2026-09-27 07:59:28Z with a visitor's
// GETs: the three pages on build `mt50cg7h-l19hre` with no version header, one
// stylesheet byte for byte (the comparison evidence `build-as-owner.yml` keeps
// this site for), exactly two tables, a visitor refused a read of bookings,
// and the menu's visitor read. The test starts only from here, and must leave
// the pages, the stylesheet and the stored source as they are.
const LIDO_RECORD = Object.freeze({
  at: "2026-09-27T07:59:28Z",
  build: "mt50cg7h-l19hre",
  routes: Object.freeze(["/", "/book", "/menu"]),
  tables: Object.freeze(["bookings", "menu_items"]),
  stylesheet: Object.freeze({ path: "/assets/index-glpAegzo.css", bytes: 209105, sha256: "6f7ca4bc53e559a7228609e30a400567b37aaf6c14b410c49a164274bd3aa360" }),
  menu: Object.freeze({ table: "menu_items", query: "select=*&order=id.asc", bytes: 1208, sha256: "f2b64cb26abe7c14b641f4b61d97a0c06c4246a0f5a8317aeb9206122d2e1ed8" }),
  bookingsRead: Object.freeze({ status: 403, code: "42501", message: "permission denied for table bookings" }),
});

// THE BOOKING THIS TEST MAKES, AND HOW ITS ANSWER IS READ. The marker passes
// the page's own checks and involves nobody real: a phone number in the range
// Ofcom keeps for drama, a date nobody books, and this run's id in the name.
// `closing` lists the rule fields that close a table — marking it closed, or
// taking its write access away — and either is accepted on what the job says
// it changed, what the owner's listing shows and what a real booking gets.
const RULES_SPEC = Object.freeze({
  table: "bookings",
  book: Object.freeze({ path: "/book", api: "/api/db/lido-axes-b/data/bookings" }),
  marker: Object.freeze({ name: "Canary rules", phone: "07700 900999", party_size: 2, booking_date: "2099-12-31", booking_time: "17:00" }),
  closing: Object.freeze({ fields: Object.freeze(["retired", "write"]) }),
  record: LIDO_RECORD,
});

/**
 * THE SCENARIOS, BY NAME. A form box takes a name and never a script: what is
 * sent is written here, reviewed with the code, and tied to the one site its
 * words describe — Part B's messages name that bakery's photograph and pages.
 */
export const UI_SCENARIOS = Object.freeze({
  "4a-part-b": Object.freeze({
    site: "fold-lane-bakery",
    // Credits this scenario may spend in all (routing calls included) before
    // it sends nothing more. Part B was estimated at about 7-8.
    budget: 15,
    steps: Object.freeze([
      Object.freeze({ attach: "test/fixtures/ui-logo.png", say: "Use this picture as the logo." }),
      Object.freeze({ say: "Show more of the top of the photo of the sourdough boule cooling." }),
      Object.freeze({ say: "Move the starter page to /starter." }),
    ]),
  }),
  // TEST 4b's D1 — one row, through the real app, and back with no model call.
  // `layers` is the wall: the one edit that may leave the page is an edit at
  // the data layer; text, page, rules, look, the add-on, a build and the full
  // rewrite are aborted in the browser and recorded, so a misroute costs the
  // routing call and changes nothing. The data rung writes display rows only.
  "4b-d1-price": Object.freeze({
    site: "fold-lane-bakery",
    // Routing 1-2 and the data rung's one call, about 1.
    budget: 5,
    layers: Object.freeze(["data"]),
    // A data edit publishes nothing: no page, no version, the site stays on
    // the version its before-read saw.
    publishes: 0,
    // What the screen and the job's own stored reply must say.
    reply: "✅ Updated one entry in loaves.",
    applied: Object.freeze([Object.freeze({ table: "loaves", id: 6, columns: Object.freeze(["price"]) })]),
    row: D1_ROW,
    steps: Object.freeze([
      Object.freeze({ say: "In today's bake list, change the Sea Salt Focaccia's price to £4.60." }),
    ]),
  }),
  // D1's RECOVERY ON ITS OWN, for a run that could not finish it (a reply that
  // never came, a runner that died between the edit and the write). It sends
  // no message and opens no app: it reads the row and, with spend=yes, writes
  // the focaccia's price back to 4.5 ONLY while it reads 4.6 — that field
  // alone. With spend=no it reads and says what it would write. Free.
  "4b-d1-restore": Object.freeze({
    site: "fold-lane-bakery",
    budget: 0,
    layers: Object.freeze([]),
    publishes: 0,
    row: D1_ROW,
    steps: Object.freeze([]),
  }),
  // THE RULES TEST — one message that should close lido-axes-b's `bookings`,
  // then ONE real visitor booking through the site's own form, which must be
  // refused at the privilege check with no row added. `layers` is the wall: the
  // one edit that may leave the app is at the rules layer. The site predates
  // the versioned layout, so what "nothing published" means is read off its
  // build header, its pages, its stylesheet and its stored source.
  "4b-rules-close": Object.freeze({
    site: "lido-axes-b",
    // Routing 1-2 and the rules rung's one call, about 1.
    budget: 5,
    layers: Object.freeze(["rules"]),
    publishes: 0,
    layout: "legacy",
    rules: RULES_SPEC,
    steps: Object.freeze([
      Object.freeze({ say: "We're fully booked, so stop taking bookings on the website for now." }),
    ]),
  }),
  // TEST 5 — A PAGE TAKEN OFF THROUGH THE REAL APP; PUT BACK FOR FREE AFTER.
  // A page another page still names is refused (`mergeAddonPages`), and the
  // gallery is named by the home page's menu, so the menu goes first and the
  // page second. EACH MESSAGE HAS ITS OWN WALL: the first may leave the app
  // only as a menu edit, the second only as a page edit, so a misrouted message
  // costs its routing call and changes nothing. The recovery is the restore
  // mode, a separate free press, to the version the before-read saw.
  //
  // THE SECOND MESSAGE DEPENDS ON THE FIRST (`needs`), and since run 47 that is
  // enforced rather than hoped for: it is sent only once the first message's
  // job stored a menu success. Run 47 sent it after a menu edit that changed
  // nothing, paid its routing call, and was refused as designed. And the
  // scenario passes on what its operations did (`removal`, judged by
  // `removalVerdict`), never on how many replies came back — run 47 printed
  // "UI MODE PASSED" over two refusals.
  "5-page-remove": Object.freeze({
    site: "fold-lane-bakery",
    // Routing 1-2 for each message, the menu rung's one call about 1, and the
    // removal free (it makes no model call).
    budget: 8,
    layers: Object.freeze(["nav", "page"]),
    removal: Object.freeze({
      page: "gallery.tsx",
      route: "/gallery",
      link: Object.freeze({ label: "Gallery", href: "/gallery" }),
    }),
    steps: Object.freeze([
      Object.freeze({ say: "Take Gallery out of the menu.", layers: Object.freeze(["nav"]) }),
      Object.freeze({
        say: "Remove the gallery page.", layers: Object.freeze(["page"]),
        needs: Object.freeze({ step: 1, layer: "nav" }),
      }),
    ]),
  }),
  // TEST 9 — A FOLLOW-UP AFTER A FAILURE, IN THE SAME TAB (the owner,
  // 2026-09-30). The first message asks to take off a lesson the site does not
  // have, so the data step matches nothing: a real failure, shown on screen,
  // with the edit's own charge refunded (`fails`) — run 77's path. The second
  // is an ordinary change, sent from the same tab with no reload, and only once
  // the first has failed exactly that way and the table still reads as it did
  // before it (`needs.failed`). Both are walled to the data layer, so a
  // misrouted message costs its routing call and changes nothing. Nothing is
  // put back.
  "9-follow-up": Object.freeze({
    site: "fretwork-1",
    // Routing 1-2 for each message, the failed edit 0 once its reserve is
    // refunded, and the data edit about 1: about 5.
    budget: 8,
    layers: Object.freeze(["data"]),
    publishes: 0,
    reply: "✅ Updated one entry in lessons.",
    applied: Object.freeze([Object.freeze({ table: "lessons", id: 4, columns: Object.freeze(["price"]) })]),
    row: FOLLOW_ROW,
    steps: Object.freeze([
      Object.freeze({
        say: "We've stopped running the Weekend workshop, please take it off the price list.",
        fails: Object.freeze({ error: "no-match" }),
      }),
      Object.freeze({
        say: "Please change the Hour one-to-one's price to £45.",
        needs: Object.freeze({ step: 1, failed: "no-match" }),
      }),
    ]),
  }),
  // THE ADDITIONS BATCH (2026-10-02) — run 90's five additions, word for word,
  // through the real app in one tab, once the fix sends them to the add-on
  // step and has it deliver each one. `adds` opens the one door every other
  // scenario keeps shut — the add-on step, for this site alone — and the wall
  // still refuses everything else: a build, a rewrite, any edit that is not an
  // addition the add-on step handed over (`addition: true`, which only that
  // hand-over sets), and for the line and the photograph any edit at all. So a
  // message the router sends to an edit costs its routing call and changes
  // nothing. Each message is judged on what landed (`additionsVerdict`, in
  // canary-additions.mjs). The additions stay on the bakery afterwards (the
  // owner's decision, 2026-10-02): no restore, and no separate free
  // rehearsal — the paid press's own preflight checks the deploy and the
  // image before anything is sent, and the routing controls run first.
  "12-additions": Object.freeze({
    site: "fold-lane-bakery",
    // Routing 1.3-3 for each message; each frame item about 2 at the menu
    // editor (the add-on's own picker is not billed when it hands one over);
    // the line and the photograph about 3-10 each, one add-on bill apiece:
    // about 19-41 in all. Checked before each message, so the last one can
    // take the total past it: about 19 more if the add-on buys the photograph
    // rather than placing the site's own.
    budget: 45,
    adds: true,
    layers: Object.freeze(["nav"]),
    additions: Object.freeze({
      social: Object.freeze({ network: "instagram", host: "instagram.com", path: "/harbourloaf" }),
      menu: Object.freeze({ label: "Order", href: "/order" }),
      button: Object.freeze({ label: "Call us", tel: "01174960000" }),
      words: Object.freeze({ page: "visit.tsx", route: "/visit", says: "closed on bank holidays" }),
      photo: Object.freeze({ page: "visit.tsx", route: "/visit", about: "sourdough" }),
    }),
    steps: Object.freeze([
      Object.freeze({ say: "Add our Instagram to the footer: @harbourloaf.", layers: Object.freeze(["nav"]), hop: "nav" }),
      Object.freeze({ say: "Add Order to the menu.", layers: Object.freeze(["nav"]), hop: "nav" }),
      Object.freeze({ say: "Add a Call us button at the top that rings 0117 496 0000.", layers: Object.freeze(["nav"]), hop: "nav" }),
      Object.freeze({ say: "On the Visit page, add a line saying we're closed on bank holidays.", layers: Object.freeze([]) }),
      Object.freeze({ say: "Add a photo of our sourdough to the Visit page.", layers: Object.freeze([]) }),
    ]),
  }),
  // ── THE COMBINED REQUEST FLOW'S REAL-MODEL BATCH (2026-10-03) ─────────────
  //
  // docs/investigations/request-flow-rollout.md. Each press is one message
  // the server takes on as a request (`request: true`): the routing call
  // answers with the request, the server files and runs every part, and the
  // page follows it. In this mode the browser's wall refuses any edit or
  // add-on the page itself would post, so a press made while the switch is
  // not live costs its routing call, changes nothing and sends nothing more.
  // WHAT THE WALL CAN AND CANNOT DO HERE: what the page would post is refused
  // before it leaves; a part the SERVER files is seen only when the request
  // is read (every 3 s with the tab open, every 20 s with it closed) and is
  // then stopped through the request's own Stop — which cancels what has not
  // started and asks a running job to stop at its next gate. A fast part can
  // finish first. `layers` lists the edit layers a part may run at; `addon`
  // opens the add-on step beside them. Each press passes on what landed
  // (`requestBatchVerdict`, in canary-requests.mjs) and records, never fails
  // on, which hand-over it went through (`covers`). The changes stay on the
  // bakery (the owner's demo-site rule). The budget is the press's upper
  // estimate, checked before each message and not while a request runs.
  //
  // REQUEST MODE LIVE: one wording change, one part.
  "rq-canary": Object.freeze({
    site: "fold-lane-bakery",
    request: true,
    budget: 6,
    layers: Object.freeze(["text", "look"]),
    expect: Object.freeze({
      headings: Object.freeze([Object.freeze({ route: "/visit", from: "Come to the bakery", to: "Come and see us" })]),
    }),
    covers: Object.freeze([]),
    steps: Object.freeze([
      Object.freeze({ say: "On the Visit page, change the heading 'Come to the bakery' to 'Come and see us'." }),
    ]),
  }),
  // A MENU LINK'S WORDS (2026-10-07, after run 105): `menu` and `menuFinish`
  // carry a `label` only when the message itself asks for the link's words,
  // quoted from it in `asked`; the link must then hold them. Without one, the
  // words are the builder's, and any label linking the page does
  // (`labelFits`). None of these messages names the link's words.
  //
  // R1 — Edit and Add-on, the edit first; several operations; the page the
  // menu link needs is named after it. The new page's address is the add-on's
  // to choose, so it is found by what it says, and the menu link must point
  // at it. The page rung is allowed because it hands a new page to the add-on
  // step; nav and look for the menu link, whichever the router picks.
  "rq-1-classes": Object.freeze({
    site: "fold-lane-bakery",
    request: true,
    budget: 25,
    addon: true,
    layers: Object.freeze(["look", "text", "nav", "page"]),
    expect: Object.freeze({
      description: Object.freeze({ says: Object.freeze(["saturday", "bread", "class"]), absentBefore: "class" }),
      pages: Object.freeze([Object.freeze({ about: Object.freeze(["class"]) })]),
      menu: Object.freeze({ page: 0 }),
    }),
    covers: Object.freeze(["edit-and-addon", "several-parts", "waits-for-prerequisite"]),
    steps: Object.freeze([
      Object.freeze({
        say: "Change the site description to say we now run Saturday bread-making classes, put a link to the new Classes page in the menu, and add a Classes page that explains the classes.",
        ms: 25 * 60_000,
      }),
    ]),
  }),
  // R2 — Add-on first, then Edit; the menu link is the add-on step's to set
  // aside as a part of its own. The price is checked by the row readers, from
  // a baseline taken immediately before the message, and kept. Look is
  // allowed beside nav because the router may send the menu link through the
  // look door's menu lane, a path that reaches the same site.
  "rq-2-wholesale": Object.freeze({
    site: "fold-lane-bakery",
    request: true,
    budget: 26,
    addon: true,
    layers: Object.freeze(["data", "nav", "look", "page"]),
    row: WALNUT_ROW,
    expect: Object.freeze({
      pages: Object.freeze([Object.freeze({ about: Object.freeze(["wholesale"]) })]),
      menu: Object.freeze({ page: 0 }),
    }),
    covers: Object.freeze(["edit-and-addon", "several-parts", "addon-sets-aside"]),
    steps: Object.freeze([
      Object.freeze({
        say: "Add a Wholesale page for cafés that want to order loaves in bulk and put a link to it in the menu, then change the Walnut Levain's price to £6.20.",
        ms: 25 * 60_000,
      }),
    ]),
  }),
  // R3 — a step's question and the answer that resumes it, with the other
  // part going ahead. The first message ends once a part waits on its
  // question and the page shows it (`until: "question"`); the answer is then
  // typed into the composer, as a customer answers. If no question is asked,
  // the answer is not sent.
  "rq-3-facebook": Object.freeze({
    site: "fold-lane-bakery",
    request: true,
    budget: 13,
    addon: true,
    layers: Object.freeze(["text", "look", "nav"]),
    expect: Object.freeze({
      headings: Object.freeze([Object.freeze({ route: "/visit", from: "The shutters and the street", to: "Our shop on the street" })]),
      social: Object.freeze({ network: "facebook", host: "facebook.com", path: "/harbourloafbristol" }),
    }),
    covers: Object.freeze(["several-parts", "step-question", "answer-resumes"]),
    steps: Object.freeze([
      Object.freeze({
        say: "On the Visit page, change the heading 'The shutters and the street' to 'Our shop on the street', and add a link to our Facebook page in the footer.",
        until: "question",
        ms: 14 * 60_000,
      }),
      Object.freeze({ say: "It's facebook.com/harbourloafbristol", ms: 14 * 60_000 }),
    ]),
  }),
  // R4 — a file attached to the message and read by a later part. The live
  // logo already is ui-logo.png, so this press attaches a second picture.
  "rq-4-logo": Object.freeze({
    site: "fold-lane-bakery",
    request: true,
    budget: 8,
    layers: Object.freeze(["text", "look", "logo"]),
    expect: Object.freeze({
      headings: Object.freeze([Object.freeze({ route: "/", from: "Fed every morning since we opened", to: "Fed every morning since 2019" })]),
      logo: Object.freeze({ file: "test/fixtures/ui-logo-2.png", sha256: "38d29a0457eedf0f9778d4a9f4104d279fffe622c2f61a22e0989d92ee9d1c0e" }),
    }),
    covers: Object.freeze(["several-parts", "file-to-later-part"]),
    steps: Object.freeze([
      Object.freeze({
        attach: "test/fixtures/ui-logo-2.png",
        say: "Change the home page heading 'Fed every morning since we opened' to 'Fed every morning since 2019', and use the attached picture as our logo.",
      }),
    ]),
  }),
  // R5 — the tab closed once the server has taken the message on: the
  // request is read only through the requests list, which moves nothing,
  // until it has ended; then a new tab opens the site and must show it ended.
  "rq-5-away": Object.freeze({
    site: "fold-lane-bakery",
    request: true,
    budget: 18,
    addon: true,
    layers: Object.freeze(["text", "look"]),
    expect: Object.freeze({
      words: Object.freeze({ route: "/order", says: Object.freeze(["8pm", "night before"]) }),
      headings: Object.freeze([Object.freeze({ route: "/gallery", from: "Photographs of the bakery's work", to: "Photographs from the bakery" })]),
    }),
    covers: Object.freeze(["several-parts", "closed-tab"]),
    steps: Object.freeze([
      Object.freeze({
        say: "Add a line to the Order page saying orders close at 8pm the night before, and change the Gallery page heading 'Photographs of the bakery's work' to 'Photographs from the bakery'.",
        away: true,
        ms: 25 * 60_000,
      }),
    ]),
  }),
  // THE FOCUSED CHECK OF RUN 95's TWO FIXES (2026-10-04), before R2–R5: the
  // bakery's Classes link, which R1 left in two of its five menus, put into
  // the three that lack it — an addition finishing a link some menus already
  // carry (F1) — with its reply the model's own, written in the background
  // (F2). The link stays. Look is allowed beside nav because the router may
  // send a menu link through the look door's menu lane.
  "rq-menu-link": Object.freeze({
    site: "fold-lane-bakery",
    request: true,
    budget: 10,
    addon: true,
    layers: Object.freeze(["nav", "look"]),
    expect: Object.freeze({
      menuFinish: Object.freeze({ href: "/classes" }),
    }),
    covers: Object.freeze([]),
    steps: Object.freeze([
      Object.freeze({ say: "Put the Classes page in the menu on every page.", ms: 14 * 60_000 }),
    ]),
  }),
  // THE LIVE CHECK OF THE PAGE'S REFRESH (2026-10-05, the owner, after the
  // response-order correction passed review): *"one combined live Edit/Add-on
  // verification covering correct reply placement, preview refresh, updated
  // page/table inventory and completion with the tab closed, using existing
  // passing evidence to avoid redundant cases."* Two messages. The first is an
  // edit and an add-on that makes a page with a table of its own (its menu
  // link the builder's), sent with its tab then closed; the tab opened
  // afterwards must show it ended, and is the one the second message — a
  // heading — goes from. What R1–R5 showed live is not asked again; what is
  // judged here beside the usual checks is the page's own side, read off the
  // record (`liveChecks`): each reply with its request; the preview frame given,
  // and loading, a newer address; the new page and the new table in the
  // page's own lists; the second routing call sending, and the route telling
  // the router, every table the site has. Look and nav are allowed beside text
  // because the router may send a heading or the menu link through them; the
  // page rung because it hands a new page to the add-on step.
  "lv-reopen": Object.freeze({
    site: "fold-lane-bakery",
    request: true,
    budget: 32,
    addon: true,
    layers: Object.freeze(["text", "look", "nav", "page"]),
    expect: Object.freeze({
      headings: Object.freeze([
        Object.freeze({ route: "/visit", from: "Our shop on the street", to: "Find us on the street" }),
        Object.freeze({ route: "/gallery", from: "Photographs from the bakery", to: "Photographs from Fold Lane" }),
      ]),
      pages: Object.freeze([Object.freeze({ about: Object.freeze(["bake", "list"]) })]),
      menu: Object.freeze({ page: 0 }),
      // ONE NEW TABLE, A VISITOR'S TO SEND TO AND NOBODY'S TO READ (`collect`),
      // with a column for the email address; every other table as it was.
      tables: Object.freeze({ added: 1, pair: Object.freeze({ read: "none", write: "anyone" }), column: "email" }),
      live: true,
    }),
    covers: Object.freeze(["edit-and-addon", "several-parts", "closed-tab"]),
    steps: Object.freeze([
      Object.freeze({
        say: "Add a Bake List page where people can join our weekly bake list by leaving their name and email address, and change the Visit page heading 'Our shop on the street' to 'Find us on the street'.",
        away: true,
        ms: 20 * 60_000,
      }),
      Object.freeze({ say: "Change the Gallery page heading 'Photographs from the bakery' to 'Photographs from Fold Lane'.", ms: 8 * 60_000 }),
    ]),
  }),
  // THE RELEASE CHECK (2026-10-06, prepared, not pressed). The owner, after
  // the failure-reporting fix passed review: *"…one combined Edit/Add-on live
  // verification with the exact request, expected results and estimated
  // credit cost against the last recorded balance of 21. Include checking the
  // resulting pages and submitting any form created by that test."* ONE
  // message — an edit and an add-on that makes a page with a form and a table
  // of its own (its menu link the builder's) — judged like every request
  // press on what landed; then, beside those checks, the new page's form is
  // sent ONCE by a visitor (`submitFormInPage`) and the new table must hold
  // exactly that one entry, read by the owner's route (`formVerdict`). The
  // message names no words for the menu link, so any label linking the new
  // page does (`labelFits`, since run 105). Look and nav are allowed
  // beside text because the router may send the heading or the menu link
  // through them; the page rung because it hands a new page to the add-on
  // step. The changes and the one entry stay on the bakery (the demo-site
  // rule).
  "lv-release": Object.freeze({
    site: "fold-lane-bakery",
    request: true,
    // ABOUT 17-28, MOST LIKELY ABOUT 25: run 101's first message — the same
    // shape, a page with a form and its own table beside a heading — cost 24
    // before the add-on's requirement judgment, which adds about 1 more. The
    // press sends nothing unless the balance covers all of it (`fundsFirst`).
    budget: 30,
    fundsFirst: true,
    addon: true,
    layers: Object.freeze(["text", "look", "nav", "page"]),
    expect: Object.freeze({
      headings: Object.freeze([
        Object.freeze({ route: "/gallery", from: "Photographs from Fold Lane", to: "Photographs from our ovens" }),
      ]),
      pages: Object.freeze([Object.freeze({ about: Object.freeze(["tasting"]) })]),
      menu: Object.freeze({ page: 0 }),
      // ONE NEW TABLE, A VISITOR'S TO SEND TO AND NOBODY'S TO READ (`collect`),
      // with a column for the email address; every other table as it was.
      tables: Object.freeze({ added: 1, pair: Object.freeze({ read: "none", write: "anyone" }), column: "email" }),
      // THE NEW PAGE'S FORM, SENT ONCE BY A VISITOR, its row read back.
      form: Object.freeze({ page: 0 }),
    }),
    covers: Object.freeze(["edit-and-addon", "several-parts"]),
    steps: Object.freeze([
      Object.freeze({
        say: "Add a Tasting Evenings page where people can join the waiting list for our next tasting evening by leaving their name and email address, and change the Gallery page heading 'Photographs from Fold Lane' to 'Photographs from our ovens'.",
        ms: 20 * 60_000,
      }),
    ]),
  }),
  // THE PROGRESS LIVE CHECK (2026-10-06, prepared, not pressed). The owner,
  // after Codex confirmed the progress corrections: *"…one combined live
  // Edit/Add-on verification using the existing canary and a demo site.
  // Choose fresh changes that exercise both routes automatically, capture
  // actual first-person progress before completion, verify the published
  // results and final replies, and check recovery after closing the
  // originating tab and reopening on a fresh browser session."* ONE message,
  // fresh on the bakery: an FAQ page (the add-on; no form, no table) and the
  // Classes page's heading (an edit) no earlier press has touched. The tab
  // that sends it watches the request's card until a progress line is shown
  // while the request still runs, and is then closed; the request is read
  // through the requests list alone for a short while; and a FRESH BROWSER
  // SESSION — a new context, signed in afresh, with nothing of the first
  // tab's — opens the site, finds the request on the server and follows it to
  // its end (`away: "fresh"`). Judged like every request press on what
  // landed, and beside that on what the customer was shown
  // (`progressChecks`). The page's words are recorded, never filtered.
  "lv-progress": Object.freeze({
    site: "fold-lane-bakery",
    request: true,
    // ABOUT 16-26, MOST LIKELY ABOUT 20: run 99's R2 (a page with its menu
    // link, no form or table) cost 12 for its add-on, runs 101 and 103 (a page
    // with a form and a table) 16 and 18; the requirement judgment, newer than
    // R2, adds about 1; a heading through the text step 2; a routing call 1-3
    // and the second part's routing job 1-3. Narration is the platform's,
    // never charged. The press sends nothing unless the balance covers the
    // budget (`fundsFirst`, the estimate's top and 2 more) and is no more than
    // the hard cap (`cap`): every charge refuses rather than overdraws, so the
    // balance at the press is the most it can spend.
    budget: 28,
    fundsFirst: true,
    cap: 32,
    addon: true,
    layers: Object.freeze(["text", "look", "nav", "page"]),
    expect: Object.freeze({
      headings: Object.freeze([
        Object.freeze({ route: "/classes", from: "Spend a Saturday morning with the starter", to: "Spend a Saturday morning at the bench" }),
      ]),
      // MATCHED ON THE PAGE'S OWN ANSWERS: its menu link would carry the page's
      // name into every new page's header, so the page is found by what it says.
      pages: Object.freeze([Object.freeze({ about: Object.freeze(["keep", "store"]) })]),
      // NO WORDS FOR THE LINK: the message asks for "a link in the menu" and
      // names none, so any label linking the page does (run 105 failed only on
      // a required "FAQ" the message never asked for; `labelFits`).
      menu: Object.freeze({ page: 0 }),
      // WHAT THE CUSTOMER IS SHOWN WHILE IT RUNS, judged beside the rest.
      progress: true,
    }),
    covers: Object.freeze(["edit-and-addon", "several-parts", "progress-each-part"]),
    steps: Object.freeze([
      Object.freeze({
        say: "Add an FAQ page with a link in the menu, answering what customers ask us most: how long a sourdough loaf keeps, how best to store it, and when we're open. And change the Classes page heading 'Spend a Saturday morning with the starter' to 'Spend a Saturday morning at the bench'.",
        away: "fresh",
        ms: 25 * 60_000,
      }),
    ]),
  }),
});

// Bounds. A step is one message: its routing call, its job and its publish.
// Part A's whole edit took 220 s; the slowest page edit on record took 646 s.
export const UI_OPEN_MS = 90_000;
export const UI_ATTACH_MS = 20_000;
export const UI_START_MS = 30_000;
export const UI_STEP_MS = 12 * 60_000;
export const UI_POLL_MS = 1000;
// A MESSAGE'S OWN BOUND (`ms`, 2026-10-03) is at most this, and a scenario's
// bounds together at most UI_PRESS_MAX_MS, so a press — its preflight, its
// before- and after-reads and its messages — ends inside the workflow's 45
// minutes, with its record written, rather than being killed without one.
export const UI_STEP_MAX_MS = 30 * 60_000;
export const UI_PRESS_MAX_MS = 30 * 60_000;
// HOW OFTEN A REQUEST IS READ WHILE ITS TAB IS CLOSED (`away`): through the
// requests list, which moves nothing.
export const UI_AWAY_EVERY_MS = 20_000;
// THE LEAST TIME A REQUEST'S REPLIES GET ONCE IT HAS ENDED (2026-10-05): they
// are waited for within the message's own bound (`watchReplies`), and never
// less than this after the request ended, so a request that ends near its
// bound still gives a reply written in the background a minute. A request
// press's bounds and these floors together stay inside UI_PRESS_MAX_MS.
export const UI_REPLY_FLOOR_MS = 60_000;
// A MESSAGE WHOSE TAB IS CLOSED ONCE ITS PROGRESS SHOWS (`away: "fresh"`,
// 2026-10-06): how long the tab that sent it waits for a progress line before
// it is closed anyway, and how long the request is then left with no page
// open — read through the requests list alone — before a fresh browser
// session opens the site. Both inside the message's own bound.
export const UI_FIRST_LINE_MS = 6 * 60_000;
export const UI_FRESH_AWAY_MS = 30_000;

/**
 * WHAT A READING OF THE PAGE SAYS OF THE OPEN SITE'S PREVIEW AND LISTS
 * (`readComposerInPage`): the address its preview frame was last given, and
 * the pages and tables it keeps. Each null where the reading had none.
 */
export function pageViewOf(s) {
  if (!s || typeof s !== "object") return null;
  return {
    frame: typeof s.frame === "string" ? s.frame : null,
    pages: Array.isArray(s.pages) ? s.pages.filter((p) => typeof p === "string") : null,
    tables: Array.isArray(s.tables) ? s.tables.filter((t) => typeof t === "string") : null,
  };
}

/** A message's own time bound: its `ms` where it names one, the default otherwise, never past the cap. */
export function stepBoundMs(step, { stepMs = UI_STEP_MS, capMs = UI_STEP_MAX_MS } = {}) {
  const own = step && Number.isFinite(step.ms) && step.ms > 0 ? step.ms : stepMs;
  return Math.min(own, capMs);
}

/** The scenario a form box names, refused whole rather than guessed. */
export function readUiScenario(raw, slug) {
  const name = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (!name) return { ok: false, msg: "no scenario is named" };
  if (!Object.hasOwn(UI_SCENARIOS, name)) {
    return { ok: false, msg: `there is no scenario called "${name}" (known: ${Object.keys(UI_SCENARIOS).join(", ")})` };
  }
  const scenario = UI_SCENARIOS[name];
  if (scenario.site !== slug) {
    return { ok: false, msg: `scenario "${name}" is written for ${scenario.site}, and the site box says ${slug || "nothing"}` };
  }
  return { ok: true, name, scenario };
}

/**
 * IDLE MEANS EVERY SIGN OF IT AT ONCE: the page's own busy flag down, the Send
 * button drawn (the workspace draws Stop instead while busy), no "Working" row
 * in the thread, and a box that takes typing. Any one alone has been true of a
 * page that was still busy.
 */
export function composerReady(s) {
  return !!s && s.busy === false && s.send === true && s.sendDisabled === false && s.stop === false &&
    s.working === 0 && s.textarea === true && s.disabled === false;
}

/**
 * The replies that arrived after a send: the assistant's messages past the
 * ones already there. A REQUEST'S CARD is not a reply (2026-10-03): it is the
 * list of a request's parts and their statuses, drawn the moment the server
 * takes the message on, and the replies come after it. AND PAST THE MESSAGE
 * ITSELF (2026-10-05): the page puts an earlier request it picks up late above
 * a message already sent, so the count from before the send can fall short of
 * where the message now stands; the last one the customer sent is it.
 */
export function newReplies(beforeCount, messages) {
  const list = Array.isArray(messages) ? messages : [];
  const sent = list.reduce((k, m, i) => (m && m.who === "u" ? i : k), -1);
  return list.slice(Math.max(0, Number(beforeCount) || 0, sent + 1)).filter((m) => m && m.who === "a" && !m.busy && !m.card);
}

// ── A MESSAGE THE SERVER TAKES ON AS A REQUEST (2026-10-03) ─────────────────
//
// With the combined request flow on, the routing call answers with a request
// (`request.key`) and the page posts no edit of its own: the server files each
// part's job, the page draws the request's card and follows it, and each
// part's own reply is read through the job poll as before. So a message in
// request mode is followed until the request has ended and the page has shown
// all of it; its jobs are the request's own (every id it filed); and the wall,
// which cannot abort a job the server files, is the request's own Stop — sent
// the moment a part is routed somewhere the scenario does not allow, or waits
// for the full rewrite's go-ahead, which no scenario gives.

/** The page's own record of a message's routing call, or null. */
export function routeCallOf(network) {
  return (Array.isArray(network) ? network : []).find((e) => e && e.method === "POST" && e.path === "/api/site/route") || null;
}

/** The request a message's routing answer says the server took on, or "": read off the page's own record of that call. */
export function requestKeyOf(network) {
  const route = routeCallOf(network);
  const res = route && route.res && typeof route.res === "object" ? route.res : null;
  const k = res && res.request && typeof res.request === "object" ? res.request.key : "";
  return typeof k === "string" && /^[A-Za-z0-9_-]{16,64}$/.test(k) ? k : "";
}

/**
 * THE WALL, FOR A REQUEST: the first part routed where this message may not
 * go — another layer, the add-on step where the scenario never opens it, an
 * edit an additions scenario did not get from the add-on step — or left
 * waiting for the full rewrite's go-ahead. `{ n, why }`, or null. A part not
 * routed yet says nothing.
 */
export function requestWall(view, scenario, step) {
  const parts = view && Array.isArray(view.parts) ? view.parts : [];
  const layers = step && Array.isArray(step.layers) ? step.layers : scenario && Array.isArray(scenario.layers) ? scenario.layers : null;
  const adds = !!(scenario && scenario.adds === true);
  // THE ADD-ON STEP BESIDE THE EDIT LAYERS (`addon`, the request batch): an
  // add-on part may run, and so may an edit part at a listed layer, whether
  // the router chose it or the add-on step handed it over.
  const addon = !!(scenario && scenario.addon === true);
  for (const p of parts) {
    if (!p || typeof p !== "object") continue;
    if (p.status === "approval" || p.status === "needs-rewrite") return { n: p.n, why: "a part waits for the full rewrite's go-ahead, which no scenario gives" };
    const route = typeof p.route === "string" ? p.route : "";
    if (!route) continue;
    if (route === "addon") {
      if (!adds && !addon) return { n: p.n, why: "a part routed to the add-on step, which this scenario never asks for" };
      continue;
    }
    if (layers && !layers.includes(route)) return { n: p.n, why: `a part routed to the ${route} layer, which this scenario does not allow` };
    if (adds && p.addition !== true) return { n: p.n, why: "a part routed to an edit that is not an addition the add-on step handed over" };
  }
  return null;
}

/**
 * A STEP'S QUESTION, SHOWN (`until: "question"`): a part of this request waits
 * on a question that is not merely queued; no part is about to run or running;
 * the page keeps that very question — by the id the server gave it — as the
 * site's live one and draws its card; and every reply the request's view lists
 * so far has been shown. `{ by: "step", key, part, id, text }`, or null.
 *
 * MATCHED BY THE QUESTION'S ID, NOT BY THE REQUEST THE PAGE NOTES BESIDE IT.
 * A question drawn from its step's own reply is kept without its request and
 * part (the page's question reader, `clarifyOf`, keeps the id, the words and
 * the answers, and nothing else); one drawn from the request's card is kept
 * with them. Where the page notes them, they must be this question's.
 */
export function questionShown(view, s, key) {
  const parts = view && Array.isArray(view.parts) ? view.parts : [];
  const waiting = parts.filter((p) => p && p.status === "waiting" && p.question && typeof p.question === "object" && p.question.queued !== true);
  if (!waiting.length) return null;
  if (parts.some((p) => p && ["ready", "queued", "started"].includes(p.status))) return null;
  const ask = s && s.ask;
  if (!ask || typeof ask.id !== "string" || !ask.id || !key || s.askCard !== true) return null;
  const p = waiting.find((w) => w.question.id === ask.id);
  if (!p) return null;
  if (ask.key && ask.key !== key) return null;
  if (Number.isInteger(ask.part) && ask.part !== p.n) return null;
  const seen = s.requests && s.requests[key] && Array.isArray(s.requests[key].shown) ? s.requests[key].shown : [];
  if (!parts.every((q) => (Array.isArray(q && q.jobs) ? q.jobs : []).every((j) => seen.includes(j)))) return null;
  return { by: "step", key, part: p.n, id: ask.id, text: ask.text || String(p.question.text || "") };
}

/** Every job a request filed, part by part, in order — its routing, its runs, its hand-overs — off its own view. */
export function requestJobsOf(view) {
  return (view && Array.isArray(view.parts) ? view.parts : []).flatMap((p) => (p && Array.isArray(p.ids) ? p.ids.filter((id) => typeof id === "string" && id) : []));
}

/**
 * THE ROUTING EVIDENCE OF ONE MESSAGE, FROM THE REQUEST ITSELF (2026-10-03,
 * the owner: *"capture routing evidence from the actual end-to-end requests
 * instead of paying for seven separate preliminary routing probes; a prior
 * model answer does not guarantee the next one"*). What the routing call
 * answered for this very message — the part it makes and where, the parts it
 * held back and their order, whether the answer was the model's own — and the
 * request as it took the message on and as it ended: each part's words,
 * status and the route its own routing gave it. Recorded, never judged: the
 * press passes on what landed.
 */
export function routingEvidence(step) {
  const route = routeCallOf(step && step.network);
  const res = route && route.res && typeof route.res === "object" ? route.res : null;
  if (!res) return null;
  const str = (v) => (typeof v === "string" ? v : undefined);
  const d = res.decision && typeof res.decision === "object" ? res.decision : null;
  const accepted = res.request && Array.isArray(res.request.parts) ? res.request.parts : [];
  const fin = step && step.request && step.request.final && Array.isArray(step.request.final.parts) ? step.request.final.parts : [];
  return {
    intent: str(res.intent), layer: str(res.layer), page: str(res.page),
    ...(res.remove === true ? { remove: true } : {}), ...(typeof res.rename === "string" ? { rename: res.rename } : {}),
    cost: Number.isFinite(res.cost) ? res.cost : null,
    alsoAsked: typeof res.alsoAsked === "string" ? [res.alsoAsked] : Array.isArray(res.alsoAsked) ? res.alsoAsked.filter((x) => typeof x === "string") : [],
    dependsOn: Array.isArray(res.dependsOn) ? res.dependsOn : [],
    decision: d ? { source: str(d.source), reasons: Array.isArray(d.reasons) ? d.reasons : [], raw: d.raw && typeof d.raw === "object" ? d.raw : null } : null,
    ...(res.failed === true ? { failed: true } : {}),
    ...(res.resumed && typeof res.resumed === "object" ? { resumed: res.resumed } : {}),
    request: requestKeyOf(step.network) || "",
    accepted: accepted.map((p) => ({ n: p.n, words: p.words, status: p.status, ...(p.route ? { route: p.route } : {}) })),
    final: fin.map((p) => ({ n: p.n, words: p.words, status: p.status, ...(p.route ? { route: p.route } : {}), ...(p.addition ? { addition: true } : {}), ...(p.why ? { why: p.why } : {}), jobs: Array.isArray(p.ids) ? p.ids.length : 0 })),
  };
}

/**
 * THE PUBLISHES IN THE ORDER THEY WERE MADE, by their own links: each built
 * from the one before it, the first from the version the before-read saw. A
 * request runs its parts in the order their needs allow, not the order they
 * are numbered, so its jobs' publishes are put in order by walking the
 * chain; whatever does not join it is left at the end, where `chainVerdict`
 * names it.
 */
export function chainOrdered(before, published) {
  const left = (Array.isArray(published) ? published : []).slice();
  const out = [];
  let prev = before;
  for (;;) {
    const i = left.findIndex((p) => p && p.parent === prev);
    if (i < 0) break;
    const [p] = left.splice(i, 1);
    out.push(p);
    prev = p.id;
  }
  return out.concat(left);
}

/** The recovery's condition probe through the canary's own PATCH; a throw is cannot-tell. */
export async function conditionProbe(rows, spec) {
  const res = await Promise.resolve()
    .then(() => rows.patch(spec.id, probeBody(spec)))
    .catch((e) => ({ status: 0, json: { error: String((e && e.message) || e).slice(0, 200) } }));
  return probeVerdict(res);
}

/**
 * The spend so far against the scenario's budget. An unreadable balance is a
 * refusal: whether the budget is spent is then not known, and the direction
 * that costs money is the one to refuse.
 */
export function budgetRefusal({ start, now, budget }) {
  if (!(Number.isFinite(start) && start >= 0 && Number.isFinite(now) && now >= 0)) {
    return "the balance could not be read, so the spend so far is not known";
  }
  const spent = start - now;
  return spent >= budget ? `the scenario has spent ${spent} of its ${budget}-credit budget` : "";
}

/**
 * THE BALANCE AGAINST A WHOLE PRESS, BEFORE ITS FIRST MESSAGE (2026-10-06).
 * `budgetRefusal` asks what a press has spent so far; it cannot ask whether
 * the account can pay for the press at all, and a request the server has
 * taken on runs to its end whatever the balance — so a press that starts
 * short ends with a part refused for want of credits, on a live site, after
 * the rest has been paid for. A scenario that says so (`fundsFirst`) sends
 * nothing unless the balance read just before its first message covers its
 * whole budget. An unreadable balance is a refusal, as there.
 */
export function fundsRefusal({ now, budget }) {
  if (!(Number.isFinite(now) && now >= 0)) return "the balance could not be read, so whether it covers this press is not known";
  if (!(Number.isFinite(budget) && budget > 0)) return "the scenario names no budget for the balance to cover";
  return now < budget ? `the balance (${now}) does not cover this press's budget of ${budget} credits` : "";
}

/**
 * THE HARD CAP, BEFORE THE FIRST MESSAGE (2026-10-06, the owner: *"Give me …
 * the estimated credit requirement and hard spending cap"*). Every charge
 * path refuses what the balance cannot cover — the routing charge and a job's
 * reserve move nothing past it, and a build's debit takes nothing or only
 * what is there — so a press can never spend more than the balance it starts
 * with. A scenario that names a cap (`cap`) makes that its bound by sending
 * nothing while the balance is above it. None named, nothing is asked.
 */
export function capRefusal({ now, cap }) {
  if (cap === undefined || cap === null) return "";
  if (!(Number.isFinite(cap) && cap > 0)) return "the scenario's hard cap is not a number";
  if (!(Number.isFinite(now) && now >= 0)) return "the balance could not be read, so whether it is within the hard cap is not known";
  return now > cap ? `the balance (${now}) is above this press's hard cap of ${cap} credits: with no more than ${cap} in the account, the press cannot spend more` : "";
}

/**
 * WHETHER THE LIVE WORKER NARRATES, read for free before a press that judges
 * progress (`expect.progress`): the requests list carries `jobs` — this
 * owner's standalone jobs — only with progress on, and is the same answer
 * without it. Not listed, or listed without it, nothing is sent.
 */
export function progressOnRefusal(listed) {
  if (!listed || listed.status !== 200 || !listed.json || typeof listed.json !== "object") {
    return `the requests list did not answer (${listed && Number.isFinite(listed.status) ? listed.status : "no answer"}), so whether progress is on cannot be told`;
  }
  return Object.hasOwn(listed.json, "jobs") ? "" : "progress is off on the live Worker: its requests list carries no jobs";
}

/**
 * A REQUEST'S CARD AS ONE READING OF THE PAGE DREW IT (`cards`, read by
 * `readComposerInPage`), or null where the page draws none: whether the page
 * holds it ended and closed, and each part's own words as drawn, its label,
 * its lines (the newest marked live while it runs) and the lines the model
 * wrote for every state, as the page keeps them.
 */
export function progressSnapshot(s, key) {
  const card = s && s.cards && typeof s.cards === "object" && Object.hasOwn(s.cards, key) ? s.cards[key] : null;
  if (!card || !Array.isArray(card.parts)) return null;
  const shown = s.requests && s.requests[key] ? s.requests[key] : null;
  return {
    ended: card.ended === true,
    closed: !!(shown && shown.closed === true),
    parts: card.parts.map((p) => ({
      n: Number.isInteger(p && p.n) ? p.n : -1,
      status: p && typeof p.status === "string" ? p.status : "",
      words: p && typeof p.words === "string" ? p.words : "",
      label: p && typeof p.label === "string" ? p.label : "",
      lines: p && Array.isArray(p.lines) ? p.lines.filter((l) => typeof l === "string" && l) : [],
      live: p && typeof p.live === "string" ? p.live : "",
      said: p && p.said && typeof p.said === "object" ? { ...p.said } : null,
    })),
  };
}

/**
 * A PART SHOWING A PROGRESS LINE LIVE, AS IT RUNS: running (`started`), with
 * a live line that is one of its own lines. A done part's lines are kept on
 * its card and never live; they are history, not progress.
 */
export function liveOnItsPart(p) {
  return !!p && p.status === "started" && typeof p.live === "string" && p.live !== "" && Array.isArray(p.lines) && p.lines.includes(p.live);
}

/** The card's readings, kept where they changed (`progressSnapshot`), each with its time. */
export function keepSnapshot(list, snap, ms) {
  if (!snap) return false;
  const last = list.length ? list[list.length - 1] : null;
  if (last) {
    const { ms: _at, ...was } = last;
    if (JSON.stringify(was) === JSON.stringify(snap)) return false;
  }
  list.push({ ms, ...snap });
  return true;
}

/** A data URL as what can be compared without carrying it: name, bytes, sha256. */
export function imageFacts(img) {
  const name = img && typeof img.name === "string" ? img.name : "";
  const data = img && typeof img.data === "string" ? img.data : "";
  const m = /^data:([^;,]*)(;base64)?,(.*)$/s.exec(data);
  if (!m) return { name, bytes: 0, sha256: "", type: "" };
  const buf = m[2] ? Buffer.from(m[3], "base64") : Buffer.from(decodeURIComponent(m[3]), "utf8");
  return { name, type: m[1], bytes: buf.length, sha256: crypto.createHash("sha256").update(buf).digest("hex") };
}

/** A request body as recordable: parsed, with every attachment reduced to its facts. */
export function recordableRequest(raw) {
  let body;
  try { body = JSON.parse(raw); } catch { return raw ? { unparsed: String(raw).slice(0, 200) } : null; }
  if (body && Array.isArray(body.images)) body = { ...body, images: body.images.map(imageFacts) };
  return body;
}

/**
 * THE WORK A SCENARIO NEVER ASKS FOR, AND THE HARNESS REFUSES TO START.
 * Every scenario here is edits. A message the router sent to the add-on route,
 * or that fell to a build or the full rewrite, would spend money nobody
 * authorised — so such a request is aborted in the browser before it leaves,
 * and recorded. What the page then says is the harness's doing, and the record
 * says so.
 */
export function blocksPost(method, pathname, scenario) {
  if (method !== "POST") return false;
  if (pathname === "/api/site/react-build" || pathname === "/api/site/build" || pathname === "/api/site/react-revise") return true;
  // THE FULL REWRITE'S GO-AHEAD FOR A REQUEST'S PART (2026-10-03): the same
  // rewrite, started from the request's card.
  if (/^\/api\/site\/request\/[^/]+\/[^/]+\/approve$/.test(String(pathname || ""))) return true;
  // THE ADDITIONS BATCH ASKS FOR THE ADD-ON STEP (2026-10-02), and for its own
  // site's alone: every other scenario, and every other site, stays shut.
  if (scenario && scenario.adds === true && typeof scenario.site === "string" && pathname === `/api/site/${encodeURIComponent(scenario.site)}/addon`) return false;
  return /^\/api\/site\/[^/]+\/addon$/.test(pathname);
}

/**
 * THE WALL, PER SCENARIO. Every scenario refuses the work none of them asks for
 * (`blocksPost`). A scenario that names its `layers` goes further and is a
 * POSITIVE list for everything that writes: a request that is not a read may
 * leave the page only if it is the routing call, or an edit of this
 * scenario's own site at one of its layers. An edit whose layer cannot be
 * read is refused, not guessed. Returns the reason to abort, or "".
 *
 * AND PER MESSAGE, when the message being sent names its own `layers`: then
 * that message may leave the page only as its own kind of edit, so a message
 * the router sends somewhere else costs its routing call and changes nothing.
 * Before the first Send, and for a message that names none, the scenario's
 * list stands.
 */
export function wallRefusal({ method, pathname, body, scenario, step } = {}) {
  if (blocksPost(method, pathname, scenario)) return "work this scenario never asks for";
  // A REQUEST-MODE SCENARIO (`request: true`, the request batch): the server
  // files and runs every part, so an edit or add-on the page posts itself is
  // the old path — the switch not live, or the message not taken on — and is
  // refused before it leaves. The press then costs its routing call alone.
  if (scenario && scenario.request === true && method === "POST" && /^\/api\/site\/[^/]+\/(edit|addon)$/.test(String(pathname || ""))) {
    return "an edit or add-on posted by the page itself: in request mode the server runs every part";
  }
  const layers = step && Array.isArray(step.layers) ? step.layers
    : scenario && Array.isArray(scenario.layers) ? scenario.layers : null;
  if (!layers) return "";
  if (method === "GET" || method === "HEAD") return "";
  // AN ADDITION IS ROUTED LIKE ANY MESSAGE, and a line or a photograph makes
  // no edit at all, so its empty list walls the edits and not the routing call.
  const adds = !!(scenario && scenario.adds === true);
  if (method === "POST" && pathname === "/api/site/route") return layers.length || adds ? "" : "a message this scenario never sends";
  // The add-on request, which `blocksPost` let through for this site alone.
  if (adds && method === "POST" && pathname === `/api/site/${encodeURIComponent(scenario.site)}/addon`) return "";
  const m = /^\/api\/site\/([^/]+)\/edit$/.exec(String(pathname || ""));
  if (method === "POST" && m) {
    let slug = "";
    try { slug = decodeURIComponent(m[1]); } catch { slug = ""; }
    if (slug !== scenario.site) return `an edit of ${slug || "another site"}, which is not this scenario's site`;
    let layer = null;
    let addition = false;
    try {
      const b = JSON.parse(String(body || ""));
      layer = b && typeof b.layer === "string" ? b.layer : null;
      addition = !!(b && b.addition === true);
    } catch { layer = null; }
    if (layer === null) return "an edit whose layer cannot be read";
    if (!layers.includes(layer)) return `an edit at the ${layer || "(blank)"} layer, which this scenario does not allow`;
    // IN THE ADDITIONS BATCH AN EDIT IS ONLY EVER THE ADD-ON STEP'S HAND-OVER,
    // which carries the addition flag; a message the router sent straight to
    // the menu editor does not, and would be free to change what is there.
    return adds && !addition ? "an edit that is not an addition the add-on step handed over" : "";
  }
  // A REQUEST'S OWN STOP, ON THIS SITE (2026-10-03): it ends work and starts
  // none, and it is the wall's own door for a request (`requestWall`).
  const sm = /^\/api\/site\/request\/([^/]+)\/[A-Za-z0-9_-]{16,64}$/.exec(String(pathname || ""));
  if (method === "DELETE" && sm) {
    let slug = "";
    try { slug = decodeURIComponent(sm[1]); } catch { slug = ""; }
    return slug === scenario.site ? "" : `a stop of ${slug || "another site"}'s request`;
  }
  return `a ${method} this scenario never makes`;
}

/**
 * WHAT LEFT THE PAGE FOR ONE MESSAGE, against what the scenario sends: one
 * routing call carrying the words exactly, answered with one of the
 * scenario's layers, and exactly one edit at that layer carrying the same
 * words. The request bodies are the page's own, as its network listener saw
 * them — not a second copy composed here.
 */
export function requestVerdict(step, scenario) {
  const net = Array.isArray(step && step.network) ? step.network : [];
  const said = step && step.say;
  const routes = net.filter((e) => e.method === "POST" && e.path === "/api/site/route");
  const edits = net.filter((e) => e.method === "POST" && /^\/api\/site\/[^/]+\/edit$/.test(e.path));
  const route = routes[0] || null;
  const res = route && route.res && typeof route.res === "object" ? route.res : {};
  const layers = scenario && Array.isArray(scenario.layers) ? scenario.layers : [];
  const out = {
    routes: routes.length,
    routedWords: !!(route && route.req && route.req.message === said),
    routedIntent: typeof res.intent === "string" ? res.intent : "",
    routedLayer: typeof res.layer === "string" ? res.layer : "",
    routeCost: Number.isFinite(res.cost) ? res.cost : null,
    edits: edits.length,
    editLayers: edits.map((e) => (e.req && typeof e.req.layer === "string" ? e.req.layer : null)),
    editWords: edits.length > 0 && edits.every((e) => e.req && e.req.instruction === said),
  };
  // A MESSAGE THE SERVER TOOK ON AS A REQUEST (2026-10-03): the one routing
  // call carrying the words, no edit posted from the page, and the request
  // ended with every part done where the scenario allows, nothing stopped.
  const key = requestKeyOf(net);
  if (key) {
    const fin = step && step.request ? step.request.final : null;
    const parts = fin && Array.isArray(fin.parts) ? fin.parts : [];
    const allowed = (p) => !!p && typeof p.route === "string" && (p.route === "addon" ? !!(scenario && (scenario.adds || scenario.addon)) : layers.includes(p.route));
    out.request = {
      key, ended: !!(fin && fin.ended === true), state: fin ? fin.state : "",
      parts: parts.map((p) => ({ n: p.n, status: p.status, route: p.route || "", ...(p.why ? { why: p.why } : {}) })),
      wall: (step && step.request && step.request.wall) || null,
    };
    out.ok = out.routes === 1 && out.routedWords && out.edits === 0 && out.request.ended && parts.length > 0 &&
      parts.every((p) => p.status === "done" && allowed(p)) && !out.request.wall;
    return out;
  }
  out.ok = out.routes === 1 && out.routedWords && out.routedIntent === "edit" && layers.includes(out.routedLayer) &&
    out.edits === 1 && out.editWords && out.editLayers.every((l) => layers.includes(l));
  return out;
}

/**
 * THE JOB'S OWN STORED REPLY, the one the page was handed under
 * `x-gf-edit: final`: it must be the scenario's layer answering ok, naming
 * exactly the rows and columns the scenario changes, with nothing failed and
 * nothing compiled.
 */
export function storedReplyVerdict(step, scenario) {
  const fin = (Array.isArray(step && step.network) ? step.network : []).filter((e) => e.final && e.res && typeof e.res === "object");
  const r = fin.length ? fin[fin.length - 1].res : null;
  if (!r) return { ok: false, why: "no stored reply was read" };
  const layer = scenario && Array.isArray(scenario.layers) ? scenario.layers[0] : "";
  const applied = JSON.stringify(Array.isArray(r.applied) ? r.applied : null) === JSON.stringify(scenario.applied || null);
  const out = { ok: false, layer: r.layer, applied: r.applied, failed: r.failed, files: r.files, sort: r.sort, cost: r.cost };
  if (r.ok !== true) return { ...out, why: "the stored reply is not ok" };
  if (r.layer !== layer) return { ...out, why: `the stored reply is the ${r.layer} layer's` };
  if (!applied) return { ...out, why: "the stored reply names other rows or columns" };
  if (r.failed) return { ...out, why: `${r.failed} change(s) failed` };
  if (r.files !== undefined || r.sort !== undefined) return { ...out, why: "the stored reply compiled or reordered pages" };
  return { ...out, ok: true, why: "" };
}

/**
 * What each routing call the page made said it cost, message by message, read
 * off the page's own recorded answers. A call whose answer carried no readable
 * cost gives `undefined`, which `moneyVerdict` refuses rather than counts as 0.
 */
export function routeCostsOf(steps) {
  return (Array.isArray(steps) ? steps : []).flatMap((s) => (Array.isArray(s && s.network) ? s.network : [])
    .filter((e) => e.method === "POST" && e.path === "/api/site/route")
    .map((e) => (e.res && typeof e.res === "object" ? e.res.cost : undefined)));
}

/**
 * Each routing call the page made: what its answer said it cost, and the ledger
 * ref its charge is kept under when it carried a message's key — the Worker's
 * `credit_debit` under `route:<site>:<key>`, the key being the message's own
 * `idem`. A call with no key pays through the older gate, which keeps no row:
 * its ref is "".
 */
export function routeCallsOf(steps) {
  return (Array.isArray(steps) ? steps : []).flatMap((s) => (Array.isArray(s && s.network) ? s.network : [])
    .filter((e) => e.method === "POST" && e.path === "/api/site/route")
    .map((e) => {
      const q = e.req && typeof e.req === "object" ? e.req : {};
      const ref = typeof q.idem === "string" && q.idem && typeof q.slug === "string" && q.slug ? `route:${q.slug}:${q.idem}` : "";
      return { ref, cost: e.res && typeof e.res === "object" ? e.res.cost : undefined };
    }));
}

/**
 * THE MONEY, CLOSED OR NOT. The balance before the first message less the
 * balance at the end must be exactly the routing calls' own costs plus each
 * job's charge — and each job's charge must be what its own row says AND what
 * the ledger took under it, with nothing refunded. An exempt job takes no
 * ledger row, and neither does one that never reached a paid step (`none`).
 * A refunded job charged nothing: whatever its reserve took, the ledger gave
 * back, so its rows net to nothing. Anything that cannot be read is a
 * refusal, never a zero.
 */
export function moneyVerdict({ start, end, routeCosts, jobs } = {}) {
  const bad = (why, extra = {}) => ({ ok: false, why, ...extra });
  if (!(Number.isFinite(start) && start >= 0 && Number.isFinite(end) && end >= 0)) return bad("the balance could not be read at both ends");
  const costs = Array.isArray(routeCosts) ? routeCosts : [];
  if (costs.some((c) => !Number.isFinite(c) || c < 0)) return bad("a routing call's cost is not a number");
  const routing = costs.reduce((a, b) => a + b, 0);
  const jc = jobCharges(jobs);
  if (!jc.ok) return bad(jc.why);
  const edits = jc.edits;
  const spent = start - end;
  return spent === routing + edits
    ? { ok: true, why: "", spent, routing, edits }
    : bad(`the balance moved ${spent}; routing ${routing} + edits ${edits} is ${routing + edits}`, { spent, routing, edits });
}

/**
 * WHAT EACH JOB TOOK: what its own row says AND what the ledger took under it,
 * or a refusal naming the job. Shared by both money verdicts.
 */
export function jobCharges(jobs) {
  const bad = (why) => ({ ok: false, why });
  let edits = 0;
  for (const j of Array.isArray(jobs) ? jobs : []) {
    const id = (j && j.job) || "?";
    if (!j || !j.row) return bad(`job ${id} has no readable row`);
    if (!j.ledgerRead || j.ledgerRead.ok !== true || !Array.isArray(j.ledger)) return bad(`job ${id}'s ledger could not be read`);
    let debits = 0, refunds = 0;
    for (const e of j.ledger) {
      const d = Number(e && e.delta);
      if (!Number.isFinite(d)) return bad(`job ${id} has a ledger row with no amount`);
      if (d < 0) debits -= d; else refunds += d;
    }
    if (j.row.billing === "finalized") {
      if (!(Number.isSafeInteger(j.row.cost) && j.row.cost >= 0)) return bad(`job ${id}'s cost is not a whole number`);
      if (debits !== j.row.cost || refunds !== 0) return bad(`job ${id}: its row says ${j.row.cost}; the ledger took ${debits} and returned ${refunds}`);
      edits += j.row.cost;
    } else if (j.row.billing === "exempt" || j.row.billing === "none") {
      // `none` IS A JOB THAT NEVER REACHED A PAID STEP (2026-10-02): the
      // add-on step's hand-over to the menu editor reserves nothing, and its
      // row stays `none`. Settled at nothing, like an exempt job — and, like
      // one, refused if the ledger names it.
      if (j.ledger.length) return bad(`job ${id} is ${j.row.billing} and the ledger names it`);
    } else if (j.row.billing === "refunded") {
      if (debits !== refunds) return bad(`job ${id} is refunded; the ledger took ${debits} and returned ${refunds}`);
    } else {
      return bad(`job ${id} is ${j.row.billing}, not settled`);
    }
  }
  return { ok: true, why: "", edits };
}

/**
 * THE MONEY OF ONE PRESS, BY ITS OWN CHARGES (2026-10-04, on the owner's word:
 * the account may be in use while a press runs — another site built, another
 * edit made — and the balance's move then carries those charges too).
 *
 * The press's own charges: each routing call's answered cost — and, for a call
 * made with a message's key, the ledger's row under that key, which must have
 * taken exactly that (a second call with the same key is not charged again) —
 * plus each job's charge, its row and its ledger agreeing. They must add up,
 * and they may not be more than the balance's move. What else moved the
 * balance meanwhile is told beside them and never fails the press: the rows in
 * the ledger between the two balance reads under any other ref, and what is
 * left, which no row records. THE LIMIT, accepted by the owner: a charge this
 * press made that no ledger row records would read as someone else's.
 */
export function ownMoneyVerdict({ start, end, calls, routeRows, jobs, window } = {}) {
  const bad = (why, extra = {}) => ({ ok: false, why, ...extra });
  if (!(Number.isFinite(start) && start >= 0 && Number.isFinite(end) && end >= 0)) return bad("the balance could not be read at both ends");
  const cs = Array.isArray(calls) ? calls : [];
  if (cs.some((c) => !c || !Number.isFinite(c.cost) || c.cost < 0)) return bad("a routing call's cost is not a number");
  const jc = jobCharges(jobs);
  if (!jc.ok) return bad(jc.why);
  const keyed = new Map();
  for (const c of cs) if (c.ref && !keyed.has(c.ref)) keyed.set(c.ref, c.cost);
  let routing = cs.filter((c) => !c.ref).reduce((a, c) => a + c.cost, 0);
  if (keyed.size && !(routeRows && routeRows.ok === true && Array.isArray(routeRows.rows))) return bad("the routing calls' ledger rows could not be read");
  for (const [ref, cost] of keyed) {
    let taken = 0;
    for (const r of routeRows.rows) {
      if (!r || r.ref !== ref) continue;
      const d = Number(r.delta);
      if (!Number.isFinite(d)) return bad(`a ledger row under ${ref} has no amount`);
      taken -= d;
    }
    if (taken !== cost) return bad(`the routing call under ${ref} answered ${cost}; the ledger took ${taken}`);
    routing += cost;
  }
  const edits = jc.edits;
  const own = routing + edits;
  const spent = start - end;
  if (spent < own) return bad(`this press's own charges, routing ${routing} + jobs ${edits} = ${own}, are more than the balance's move of ${spent}`, { spent, routing, edits, own });
  const excess = spent - own;
  const jobIds = (Array.isArray(jobs) ? jobs : []).map((j) => (j && typeof j.job === "string" ? j.job : "")).filter(Boolean);
  const mine = (ref) => typeof ref === "string" && (keyed.has(ref) || jobIds.some((id) => ref.includes(id)));
  let others = null;
  if (window && window.ok === true && Array.isArray(window.rows)) {
    const rows = window.rows.filter((r) => r && !mine(r.ref));
    let recorded = 0;
    for (const r of rows) {
      const d = Number(r.delta);
      if (Number.isFinite(d)) recorded -= d;
    }
    others = { recorded, unrecorded: excess - recorded, rows: rows.map((r) => ({ id: r.id, ref: String(r.ref || ""), delta: Number(r.delta) })) };
  }
  return { ok: true, why: "", spent, routing, edits, own, excess, others };
}

/**
 * NARRATION ADDS NO CHARGE (2026-10-06, the owner: *"confirming narration
 * adds no customer charge"*), read off the own-charges verdict: the balance
 * moved by exactly this press's own routing calls and jobs, and the ledger
 * between its two balance reads holds no row under any other ref. A progress
 * line or a task's lines charged to the account would be a row the press did
 * not make, or a move its own charges do not account for. Other activity on
 * the account while the press ran makes this unprovable, and it says so
 * rather than passing.
 */
export function narrationChargeVerdict(m) {
  if (!m || m.ok !== true) return { ok: false, why: m && m.why ? m.why : "this press's own charges were not read" };
  if (!m.others) return { ok: false, why: "the ledger between the two balance reads could not be read" };
  if (m.others.rows.length) {
    return { ok: false, why: `the ledger holds ${m.others.rows.length} row(s) under other refs while the press ran (${m.others.rows.map((r) => `${String(r.ref || "").slice(0, 48)} ${r.delta}`).join(", ")}), so a charge outside this press's own cannot be ruled out` };
  }
  if (m.excess !== 0) return { ok: false, why: `the balance moved ${m.excess} more than this press's own charges, recorded under no ref` };
  return { ok: true, why: "" };
}

/** The own-charges verdict's account, for the check's detail and the log. */
export function ownMoneySaid(m) {
  if (!m || m.ok !== true) return m && m.why ? m.why : "not read";
  if (m.excess === 0) return `the balance moved ${m.spent}, exactly this press's own charges`;
  const o = m.others;
  const told = o
    ? `${o.recorded} recorded under other refs (${o.rows.map((r) => `${r.ref.slice(0, 48)} ${r.delta}`).join(", ") || "none"}), ${o.unrecorded} recorded nowhere`
    : "the ledger between the balance reads could not be read";
  return `the balance moved ${m.spent}: ${m.own} this press's own, ${m.excess} other activity on the account meanwhile — ${told}`;
}

/**
 * NOTHING PUBLISHED, from three readers that do not borrow from each other:
 * the site's own version list names no build for any job, every job's row
 * says no publish ever began, and the after-read saw the version the
 * before-read saw (the chain, with no links).
 */
export function unpublishedVerdict({ published, jobs, chain } = {}) {
  const pub = Array.isArray(published) ? published : [];
  if (pub.length) return { ok: false, why: `the version list names ${pub.length} build(s) for this scenario's jobs` };
  for (const j of Array.isArray(jobs) ? jobs : []) {
    if (!j || !j.row) return { ok: false, why: `job ${(j && j.job) || "?"} has no readable row` };
    if (j.row.publish_started_at || j.row.published_at) return { ok: false, why: `job ${j.job}'s row says a publish began` };
  }
  if (!chain || chain.verified !== true || chain.links !== 0) return { ok: false, why: `the after-read is ${chain ? chain.why : "not taken"}` };
  return { ok: true, why: "" };
}

/**
 * A FAILED MESSAGE'S EDIT CHARGE CAME BACK: its job's own row says the
 * reserve was refunded, the ledger was read, something was reserved, and the
 * rows under the job net to nothing. The routing call is billed on its own
 * and is not this job's.
 */
export function refundedVerdict(jr) {
  const id = (jr && jr.job) || "?";
  if (!jr || !jr.row) return { ok: false, why: `job ${id} has no readable row` };
  if (jr.row.billing !== "refunded") return { ok: false, why: `job ${id} is ${jr.row.billing || "unsettled"}, not refunded` };
  if (!jr.ledgerRead || jr.ledgerRead.ok !== true || !Array.isArray(jr.ledger)) return { ok: false, why: `job ${id}'s ledger could not be read` };
  let debits = 0, refunds = 0;
  for (const e of jr.ledger) {
    const d = Number(e && e.delta);
    if (!Number.isFinite(d)) return { ok: false, why: `job ${id} has a ledger row with no amount` };
    if (d < 0) debits -= d; else refunds += d;
  }
  if (!debits) return { ok: false, why: `job ${id} reserved nothing, so there was no charge to refund` };
  return debits === refunds ? { ok: true, why: "", reserved: debits, refunded: refunds }
    : { ok: false, why: `job ${id} reserved ${debits} and got ${refunds} back`, reserved: debits, refunded: refunds };
}

/**
 * THE SAME TAB: the document the run marked once the workspace opened, never
 * reloaded or replaced since. A reload or a move to another document starts a
 * new window, without the mark and with another `performance.timeOrigin`.
 */
export function sameTab(opened, now) {
  return !!(opened && now && typeof opened.mark === "string" && opened.mark.length >= 16 && now.mark === opened.mark &&
    Number.isFinite(opened.origin) && now.origin === opened.origin);
}

/** The API calls whose bodies are the evidence; everything else is recorded by status alone. */
export function recordsBody(method, pathname) {
  if (method === "POST" && pathname === "/api/site/route") return true;
  if (method === "POST" && /^\/api\/site\/[^/]+\/(edit|addon)$/.test(pathname)) return true;
  if (method === "GET" && /^\/api\/site\/edit\/[^/]+$/.test(pathname)) return true;
  return false;
}

/**
 * THE CHAIN OF PUBLISHES A SCENARIO MADE, checked link by link. Each published
 * version must have been built from the one before it — the first from the
 * version the before-read saw — and the after-read must have seen the last.
 * A job that did not publish leaves the chain where it was.
 */
export function chainVerdict({ before, published, wait, after } = {}) {
  const rows = Array.isArray(published) ? published : [];
  if (!before) return { verified: false, why: "before-unknown", target: "" };
  let prev = before;
  for (const p of rows) {
    if (!p || !p.id) return { verified: false, why: "not-listed", target: prev };
    if (p.parent !== prev) return { verified: false, why: "parent-mismatch", target: p.id, job: p.job, parent: p.parent, expected: prev };
    prev = p.id;
  }
  if (!wait || wait.kind !== "match") return { verified: false, why: wait ? wait.kind : "not-waited", target: prev };
  const pages = after && typeof after === "object" ? Object.entries(after) : [];
  const off = pages.filter(([, v]) => !v || v.version !== prev).map(([r]) => r);
  if (!pages.length) return { verified: false, why: "no-pages", target: prev };
  if (off.length) return { verified: false, why: "page-version", target: prev, off };
  return { verified: true, why: "verified", target: prev, links: rows.length };
}

// ── IN THE PAGE ─────────────────────────────────────────────────────────────
// These run inside gofarther.dev, so every free name in them is the app's own.

/** Everything the steps decide on, read in one pass. */
function readComposerInPage() {
  const ta = document.getElementById("stRevise");
  const send = document.getElementById("stSend");
  const gate = document.getElementById("authGate");
  let attached = null;
  try { attached = siteDraft(siteAttachFor).imgs.length; } catch (e) { attached = null; }
  // EACH MESSAGE'S OWN PLACE ON THE PAGE'S THREAD (2026-10-05): a reply still
  // being written holds its place with its job's id (`held.job`), drawn as the
  // waiting line (`.st-think`). The thread draws the open site's messages one
  // for one and in order, the busy row last, so the n-th drawn is the n-th
  // kept — read only while the two counts agree.
  let kept = [];
  try { const open = siteById(siteOpenId); kept = open && Array.isArray(open.msgs) ? open.msgs : []; } catch (e) { kept = []; }
  const drawn = [...document.querySelectorAll("#stThread .st-msg")];
  const aligned = drawn.filter((m) => !m.classList.contains("st-busy")).length === kept.length;
  const heldJob = (m) => {
    try {
      const h = window.EditPoll && typeof EditPoll.heldOf === "function" ? EditPoll.heldOf(m) : null;
      return h && typeof h.job === "string" ? h.job : "";
    } catch (e) { return ""; }
  };
  // THE JOB A PART'S REPLY IS MARKED WITH (2026-10-05), where the page marks
  // one: it stays when the reply settles.
  const jobMark = (m) => (m && typeof m.job === "string" ? m.job : "");
  // A REPLY'S OWN WORDS, APART FROM THE PROGRESS KEPT ABOVE THEM (2026-10-06,
  // the owner: *"fix the documented UI canary issue so final-reply checks read
  // the reply itself separately from retained progress"*). A finished job's
  // lines are drawn inside its reply's message, before the reply's words
  // (`m.prog`, `.st-prog-done`), so the message read whole began with them —
  // and a warning no longer began with its mark. Each kept block is cut once
  // from the message's own text where it stands, and its lines are read on
  // their own (`progress`). A request's card keeps its part's lines in its
  // own list, never this one.
  const keptBlocks = (m) => [...m.querySelectorAll(".st-prog-done")];
  // EACH KEPT LINE'S WORDS, without the time drawn before them (`.at`).
  const keptLine = (li) => {
    const t = String(li.innerText || li.textContent || "");
    const at = li.querySelector(".at");
    const stamp = at ? String(at.innerText || at.textContent || "") : "";
    return (stamp && t.startsWith(stamp) ? t.slice(stamp.length) : t).trim();
  };
  const keptLines = (m) => keptBlocks(m).flatMap((ul) => [...ul.querySelectorAll("li")]).map(keptLine).filter(Boolean);
  const ownText = (m) => {
    let t = String(m.innerText || m.textContent || "");
    for (const ul of keptBlocks(m)) {
      const block = String(ul.innerText || ul.textContent || "");
      const at = block ? t.indexOf(block) : -1;
      if (at >= 0) t = t.slice(0, at) + t.slice(at + block.length);
    }
    return t.replace(/⧉\s*$/, "").trim();
  };
  return {
    signedIn: !!(window.Auth && Auth.isSignedIn && Auth.isSignedIn()),
    uid: window.Auth && Auth.userId ? Auth.userId() : "",
    gate: !!gate && getComputedStyle(gate).display !== "none",
    workspace: !!ta && !!document.getElementById("stPlus"),
    busy: typeof siteBusy === "boolean" ? siteBusy : null,
    send: !!send,
    sendDisabled: send ? !!send.disabled : null,
    stop: !!document.getElementById("stStop"),
    textarea: !!ta,
    disabled: ta ? !!ta.disabled : null,
    value: ta ? ta.value : null,
    working: document.querySelectorAll("#stThread .st-busy").length,
    attached,
    strip: document.querySelectorAll("#stAttach > *").length,
    messages: drawn.map((m, i) => ({
      who: m.classList.contains("u") ? "u" : "a",
      busy: m.classList.contains("st-busy"),
      // A REQUEST'S CARD, not a reply (`newReplies`).
      card: !!m.querySelector(".st-req"),
      text: ownText(m),
      // THE PROGRESS KEPT ABOVE A FINISHED JOB'S REPLY, read apart from it.
      progress: keptLines(m),
      // A REPLY'S PLACE HELD: the waiting line drawn, and the job it is for.
      holding: !!m.querySelector(".st-think"),
      held: aligned && !m.classList.contains("st-busy") ? heldJob(kept[i]) : "",
      job: aligned && !m.classList.contains("st-busy") ? jobMark(kept[i]) : "",
    })),
    // THIS PAGE'S OWN LIFE: a reload, or a tab opened afresh, starts another.
    origin: typeof performance !== "undefined" && Number.isFinite(performance.timeOrigin) ? performance.timeOrigin : null,
    // THE PREVIEW FRAME'S ADDRESS, AND THE PAGES AND TABLES THE PAGE KEEPS FOR
    // THE OPEN SITE (2026-10-05, the live check of the page's refresh): the
    // address the frame was last given, and the two lists the next routing
    // call sends. Read only.
    frame: (() => { const f = document.getElementById("stFrame"); return f ? f.getAttribute("src") : null; })(),
    pages: (() => {
      try {
        const site = siteById(siteOpenId);
        return site && Array.isArray(site.pages) ? site.pages.map((p) => (p && typeof p.path === "string" ? p.path : "")).filter(Boolean) : null;
      } catch (e) { return null; }
    })(),
    tables: (() => {
      try {
        const site = siteById(siteOpenId);
        return site && Array.isArray(site.tables) ? site.tables.filter((t) => typeof t === "string") : null;
      } catch (e) { return null; }
    })(),
    // WHAT THE PAGE HAS SHOWN OF EACH REQUEST on the open site: ended, and
    // closed once every part's reply and the request's own are on screen —
    // and which jobs' replies it has shown so far.
    requests: (() => {
      try {
        const site = siteById(siteOpenId);
        const all = site && site.requests && typeof site.requests === "object" ? site.requests : {};
        return Object.fromEntries(Object.entries(all).map(([k, r]) => [k, {
          closed: !!(r && r.closed), ended: !!(r && r.view && r.view.ended),
          shown: r && Array.isArray(r.shown) ? r.shown.filter((j) => typeof j === "string") : [],
          // AND WHETHER IT HAS SHOWN THE REQUEST'S OWN REPLIES (its end's, a go-ahead's).
          replied: !!(r && r.replied === true),
          replies: r && Array.isArray(r.replies) ? r.replies.filter((f) => typeof f === "string") : [],
        }]));
      } catch (e) { return null; }
    })(),
    // EACH REQUEST'S CARD AS DRAWN (2026-10-06, the progress live check): its
    // parts in order, each with its own words as shown — the model's line for
    // its state once written, the customer's words until then — its label,
    // its progress lines without their times (the newest marked live while it
    // runs), and the state the page keeps for it: its status and the lines
    // the model wrote for every state. Found by the request each kept
    // message is for, only while the drawn and kept counts agree.
    cards: (() => {
      const out = {};
      try {
        const site = siteById(siteOpenId);
        const all = site && site.requests && typeof site.requests === "object" ? site.requests : {};
        const words = (x) => String((x && (x.innerText || x.textContent)) || "").trim();
        drawn.forEach((m, i) => {
          if (!aligned || m.classList.contains("st-busy")) return;
          const k = kept[i] && typeof kept[i].request === "string" ? kept[i].request : "";
          if (!k || !m.querySelector(".st-req")) return;
          const view = all[k] && all[k].view ? all[k].view : null;
          const state = view && Array.isArray(view.parts) ? view.parts : [];
          out[k] = {
            ended: !!(view && view.ended),
            parts: [...m.querySelectorAll(".st-req-part")].map((li, j) => {
              const st = state[j] || null;
              const live = li.querySelector(".st-req-prog li.live");
              return {
                n: st && Number.isInteger(st.n) ? st.n : j,
                status: st && typeof st.status === "string" ? st.status : "",
                words: words(li.querySelector(".st-req-words")),
                label: words(li.querySelector(".st-req-status")),
                lines: [...li.querySelectorAll(".st-req-prog li")].map(keptLine).filter(Boolean),
                live: live ? keptLine(live) : "",
                said: st && st.said && typeof st.said === "object" ? { ...st.said } : null,
              };
            }),
          };
        });
      } catch (e) { /* a page that draws no cards */ }
      return out;
    })(),
    // THE SITE'S LIVE QUESTION, and the request part it is for (2026-10-03):
    // what the composer's next message answers. `askCard` is its card, drawn
    // with its answers and its Cancel.
    ask: (() => {
      try {
        const site = siteById(siteOpenId);
        const q = site && site.ask;
        if (!q || typeof q.id !== "string") return null;
        const of = q.request && typeof q.request === "object" ? q.request : null;
        return { id: q.id, text: String(q.text || ""), key: of && typeof of.key === "string" ? of.key : "", part: of && Number.isInteger(of.part) ? of.part : null };
      } catch (e) { return null; }
    })(),
    askCard: !!document.querySelector("#stThread [data-ask-cancel]"),
  };
}

/** A request as the server has it, read through the page's own session (the route the page follows it by). */
async function requestViewInPage({ slug, key }) {
  try {
    const r = await apiFetch("/api/site/request/" + encodeURIComponent(slug) + "/" + encodeURIComponent(key), { method: "GET" });
    const b = await r.json().catch(() => null);
    // AND THE REQUEST'S OWN REPLY, when it has one (`replyFor`: while it
    // waits on a go-ahead, or once it has ended), with where it came from.
    const reply = b && typeof b.reply === "string" && b.reply ? { text: b.reply, source: b.replySource === "model" ? "model" : "composed", for: typeof b.replyFor === "string" ? b.replyFor : "" } : null;
    // AND, WITH NO REPLY ON IT YET, WHETHER ONE IS BEING WRITTEN OR FAILED (2026-10-05).
    const replyState = b && (b.replyState === "pending" || b.replyState === "failed") ? b.replyState : "";
    return { status: r.status, ok: !!(b && b.ok === true && b.request), request: b && b.request ? b.request : null, reply, replyState, replyFor: b && typeof b.replyFor === "string" ? b.replyFor : "" };
  } catch (e) { return { status: 0, ok: false, request: null, reply: null, replyState: "", replyFor: "" }; }
}

/** The request's own Stop, through the page's own session: nothing new starts, and a running part's job is cancelled at its next gate. */
async function stopRequestInPage({ slug, key }) {
  try {
    const r = await apiFetch("/api/site/request/" + encodeURIComponent(slug) + "/" + encodeURIComponent(key), { method: "DELETE" });
    const b = await r.json().catch(() => null);
    return { status: r.status, ok: !!(b && b.ok === true), state: b && b.request ? b.request.state : "" };
  } catch (e) { return { status: 0, ok: false, state: "" }; }
}

/**
 * A list a visitor sees, read off the SITE's own page: each matching control's
 * card as text (the order page draws one radio card per loaf). Runs in the
 * site's page, not the app's.
 */
function shownListInPage(sel) {
  return [...document.querySelectorAll(sel)].map((el) => {
    const card = el.closest("label") || el.parentElement;
    return card ? String(card.innerText || card.textContent || "").trim().replace(/\s+/g, " ") : "";
  });
}

/**
 * THE SITE'S OWN BOOKING FORM, as its page holds it: whether React has taken
 * the page over (a field filled before that is lost), and what each field
 * holds. Runs in the site's page, not the app's.
 */
function bookingFormInPage() {
  const name = document.querySelector('input[name="name"]');
  const phone = document.getElementById("phone");
  const date = document.querySelector('input[name="booking_date"]');
  const submit = document.querySelector('form button[type="submit"]');
  const live = (el) => !!el && Object.keys(el).some((k) => k.startsWith("__reactProps") || k.startsWith("__reactFiber"));
  return {
    hydrated: live(name) && live(submit),
    name: name ? name.value : null,
    phone: phone ? phone.value : null,
    date: date ? date.value : null,
    times: [...document.querySelectorAll('form button[aria-pressed="true"]')].map((b) => String(b.textContent || "").trim()),
    party: !!document.querySelector('[role="group"][aria-label="Party size"]'),
    submit: submit ? String(submit.textContent || "").trim() : null,
  };
}

/** What the page said about the booking: its pop-ups, and whether it showed the booked screen. */
function bookingOutcomeInPage() {
  const toasts = [...document.querySelectorAll("[data-sonner-toast]")].map((t) => String(t.innerText || t.textContent || "").trim()).filter(Boolean);
  const text = String((document.body && document.body.textContent) || "");
  return { toasts, success: text.includes("We've got your table") || text.includes("We’ve got your table"), form: !!document.querySelector('form button[type="submit"]') };
}

/** The start screen's card for a slug: the id the app itself gave it, or "". */
function cardIdInPage(slug) {
  try {
    const all = SiteList.merge(sitesLoad(), sitesRemote, sitesRemote !== null);
    const s = all.find((x) => x && x.slug === slug);
    if (s && document.querySelector('.st-card[data-open="' + CSS.escape(s.id) + '"]')) return s.id;
  } catch (e) { /* fall through to the list's own id for a site this browser never built */ }
  return document.querySelector('.st-card[data-open="srv_' + slug + '"]') ? "srv_" + slug : "";
}

/** Marks the workspace's own document once it is open; see `sameTab`. */
function markTabInPage(token) {
  window.__canaryTab = token;
  return { mark: window.__canaryTab, origin: performance.timeOrigin, path: location.pathname };
}

/** The mark the page carries now, if any, and when its document started. */
function tabMarkInPage() {
  return { mark: typeof window.__canaryTab === "string" ? window.__canaryTab : "", origin: performance.timeOrigin, path: location.pathname };
}

// ── THE DRIVER ──────────────────────────────────────────────────────────────

/** A real Chromium: the runner's `playwright` in CI, or `playwright-core` here. */
export async function defaultLaunch() {
  let pw;
  try { pw = await import("playwright"); } catch { pw = await import("playwright-core"); }
  const chromium = pw.chromium || (pw.default && pw.default.chromium);
  return chromium.launch({ args: ["--no-sandbox"], executablePath: process.env.CHROMIUM_PATH || undefined });
}

/**
 * THE SITE AS A VISITOR SEES IT: its page opened in a context of its own (no
 * planted session, no app), every request that is not a read aborted — so the
 * look can never submit the form on it — and the list read once the target's
 * card is drawn. Returns the lines, the target's own line and the version the
 * page was served at.
 */
export async function readShownSite(browser, { url, sel, name, ms = 45_000, pollMs = 500, route = null } = {}) {
  const out = { at: new Date().toISOString(), ok: false, why: "", url, version: "", lines: [], target: "", errors: [], aborted: [] };
  let ctx = null;
  try {
    ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
    if (route) await route(ctx, "site");
    await ctx.route(() => true, async (r) => {
      const req = r.request();
      const m = req.method();
      if (m === "GET" || m === "HEAD") return r.fallback();
      const u = String(req.url());
      if (!u.includes("/cdn-cgi/")) out.aborted.push(`${m} ${u}`);
      return r.abort("blockedbyclient");
    });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => out.errors.push(String((e && e.message) || e).slice(0, 300)));
    const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: ms });
    out.version = res && typeof res.headers === "function" ? String(res.headers()["x-site-version"] || "") : "";
    const end = Date.now() + ms;
    for (;;) {
      out.lines = await page.evaluate(shownListInPage, sel).catch(() => []);
      out.target = (out.lines || []).find((l) => lineIsFor(l, name)) || "";
      if (out.target || Date.now() >= end) break;
      await new Promise((r) => setTimeout(r, pollMs));
    }
    out.ok = !!out.target;
    if (!out.ok) out.why = `the page never drew a card for ${name}`;
  } catch (e) {
    out.why = String((e && e.message) || e).slice(0, 200);
  } finally {
    if (ctx) { try { await ctx.close(); } catch { /* already gone */ } }
  }
  return out;
}

/**
 * ONE VISITOR BOOKING, THROUGH THE SITE'S OWN FORM. A context of its own (no
 * planted session: a visitor signed in to nothing), the form filled field by
 * field and "Book a table" pressed once. THE WALL: a read goes out; any other
 * write is stopped in the browser and recorded; and a booking request goes out
 * only when `submit` is set AND `bookingGate` says, BEFORE it leaves, that it
 * is the one request the test was written for: the first, exactly the marker's
 * fields and values, no query string, no `prefer` or `authorization` header.
 * Checked afterwards, a wrong payload would already have reached the database.
 * A request that is not exact is stopped, recorded with its reason, and never
 * rewritten to pass. So a rehearsal records exactly what would have been sent,
 * and whether the paid run would let it out, and sends nothing; and the paid
 * run sends that one booking and nothing else. Service workers are blocked in
 * this context, because a request a service worker handles never reaches the
 * wall. The answer is captured as the page received it.
 */
export async function bookInPage(browser, {
  origin, spec, marker, submit = false, ms = 45_000, answerMs = 30_000, settleMs = 6_000, pollMs = 250, route = null,
} = {}) {
  const api = spec.book.api;
  const out = {
    at: new Date().toISOString(), url: origin + spec.book.path, submit: submit === true,
    ready: null, filled: null, pressed: false, posts: [], response: null, failed: null, message: null,
    aborted: [], errors: [], why: "",
  };
  const onApi = (u) => { try { const x = new URL(String(u)); return x.origin === origin && x.pathname === api; } catch { return false; } };
  const sleep = (t) => new Promise((r) => setTimeout(r, t));
  let ctx = null;
  try {
    ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 }, serviceWorkers: "block" });
    if (route) await route(ctx, "visitor");
    await ctx.route(() => true, async (r) => {
      const req = r.request();
      const m = req.method();
      if (m === "GET" || m === "HEAD") return r.fallback();
      const u = String(req.url());
      if (m === "POST" && onApi(u)) {
        const raw = req.postData();
        let body = null;
        try { body = JSON.parse(raw || "null"); } catch { body = { unparsed: String(raw || "").slice(0, 200) }; }
        let headers = null;
        try { headers = await req.allHeaders(); } catch { headers = null; }
        let search = null;
        try { search = new URL(u).search; } catch { search = null; }
        // DECIDED HERE, BEFORE ANYTHING LEAVES: the one exact request, or none.
        const gate = bookingGate({ n: out.posts.length + 1, raw, search, headers, marker });
        const entry = { method: m, path: api, body, sent: false, exact: gate.ok, exactWhy: gate.why, check: gate.check };
        out.posts.push(entry);
        if (out.submit && gate.ok) { entry.sent = true; return r.fallback(); }
        entry.stopped = out.submit ? gate.why : "a rehearsal stops the booking inside the browser";
        if (out.submit && out.posts.length === 1) out.why = `the booking request was stopped in the browser and never sent — ${gate.why}`;
        return r.abort("blockedbyclient");
      }
      if (!u.includes("/cdn-cgi/")) out.aborted.push(`${m} ${u}`);
      return r.abort("blockedbyclient");
    });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => out.errors.push(String((e && e.message) || e).slice(0, 300)));
    page.on("console", (m) => { if (m.type() === "error") out.errors.push(m.text().slice(0, 300)); });
    page.on("response", async (res) => {
      const req = res.request();
      if (req.method() !== "POST" || !onApi(req.url()) || out.response) return;
      const e = { status: res.status(), text: "" };
      try { e.text = String(await res.text()).slice(0, 2000); } catch { /* a body the browser no longer holds */ }
      try { e.json = JSON.parse(e.text); } catch { /* not JSON: kept as text */ }
      out.response = e;
    });
    page.on("requestfailed", (req) => {
      if (req.method() !== "POST" || !onApi(req.url()) || out.failed) return;
      const f = typeof req.failure === "function" ? req.failure() : null;
      out.failed = (f && f.errorText) || "failed";
    });
    await page.goto(out.url, { waitUntil: "domcontentloaded", timeout: ms });
    const end = Date.now() + ms;
    for (;;) {
      out.ready = await page.evaluate(bookingFormInPage).catch(() => null);
      if (out.ready && out.ready.hydrated && out.ready.party && out.ready.submit) break;
      if (Date.now() >= end) { out.why = "the booking form never became interactive — nothing was pressed"; return out; }
      await sleep(pollMs);
    }
    const people = `${marker.party_size} ${marker.party_size === 1 ? "person" : "people"}`;
    await page.fill('input[name="name"]', marker.name);
    await page.fill("#phone", marker.phone);
    await page.click(`[role="group"][aria-label="Party size"] button[aria-label="${people}"]`);
    await page.fill('input[name="booking_date"]', marker.booking_date);
    await page.click(`form button[type="button"]:text-is("${marker.booking_time}")`);
    out.filled = await page.evaluate(bookingFormInPage).catch(() => null);
    const f = out.filled || {};
    if (f.name !== marker.name || f.phone !== marker.phone || f.date !== marker.booking_date || !(f.times || []).includes(marker.booking_time)) {
      out.why = "the form does not hold the marker booking — nothing was pressed";
      return out;
    }
    await page.click('form button[type="submit"]');
    out.pressed = true;
    // THE BOOKING REQUEST'S END: its answer, its failure, or the rehearsal's stop.
    const aEnd = Date.now() + answerMs;
    while (!(out.response || out.failed || (out.posts[0] && !out.posts[0].sent)) && Date.now() < aEnd) await sleep(pollMs);
    // THE PAGE'S OWN WORDS, once they arrive.
    const mEnd = Date.now() + settleMs;
    for (;;) {
      out.message = await page.evaluate(bookingOutcomeInPage).catch(() => null);
      if ((out.message && (out.message.toasts.length || out.message.success)) || Date.now() >= mEnd) break;
      await sleep(pollMs);
    }
    if (!out.posts.length) out.why = "the form made no booking request";
  } catch (e) {
    out.why = String((e && e.message) || e).slice(0, 200);
  } finally {
    if (ctx) { try { await ctx.close(); } catch { /* already gone */ } }
  }
  return out;
}

/**
 * THE PAGE'S ONE FORM, AS A VISITOR SEES IT: how many forms there are, whether
 * the first is live (React has attached to it and to its button), its button's
 * words, and every field with what it says it is for.
 */
function formFieldsInPage() {
  const forms = [...document.querySelectorAll("form")];
  const live = (el) => !!el && Object.keys(el).some((k) => k.startsWith("__reactProps") || k.startsWith("__reactFiber"));
  const form = forms[0] || null;
  const submit = form ? form.querySelector('button[type="submit"], input[type="submit"], button:not([type])') : null;
  const labelOf = (el) => {
    let t = "";
    if (el.id) { const l = document.querySelector(`label[for="${CSS.escape(el.id)}"]`); if (l) t = l.textContent || ""; }
    if (!t) { const l = el.closest("label"); if (l) t = l.textContent || ""; }
    return String(t || el.getAttribute("aria-label") || el.getAttribute("placeholder") || "").replace(/\s+/g, " ").trim().slice(0, 80);
  };
  const shown = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none"; };
  const fields = form ? [...form.querySelectorAll("input, textarea, select")].map((el) => ({
    tag: el.tagName.toLowerCase(), type: String(el.getAttribute("type") || "").toLowerCase(),
    name: el.getAttribute("name") || "", id: el.id || "", label: labelOf(el),
    required: el.required === true || el.getAttribute("aria-required") === "true",
    visible: shown(el), disabled: el.disabled === true,
    value: el.type === "checkbox" ? (el.checked ? "on" : "") : String(el.value || ""),
  })) : [];
  return {
    forms: forms.length, hydrated: !!form && live(form) && live(submit),
    submit: submit ? String(submit.textContent || submit.value || "").replace(/\s+/g, " ").trim() : null, fields,
  };
}

/** What the page says once its form was sent: its toasts and live regions, and whether the form is still there. */
function formOutcomeInPage() {
  const said = [...document.querySelectorAll('[role="status"], [role="alert"], [aria-live], li[data-sonner-toast]')]
    .map((el) => String(el.textContent || "").replace(/\s+/g, " ").trim()).filter(Boolean).slice(0, 6);
  const main = document.querySelector("main") || document.body;
  return { said, form: !!document.querySelector("form"), text: String((main && main.innerText) || "").replace(/\s+/g, " ").trim().slice(0, 600) };
}

/**
 * ONE VISITOR'S ENTRY, THROUGH THE FORM AN ADDITION MADE (2026-10-06). The
 * booking helper's shape (`bookInPage`) for a form nobody wrote in advance: a
 * context of its own, signed in to nothing; the page's ONE form read once it
 * is live, filled as `fieldPlan` decides and read again to be sure it holds
 * those values, and its button pressed once. BEFORE ANYTHING IS PRESSED, each
 * filled field is bound to its column of the new table (`fieldBindings`, from
 * the fields and `columns`, the owner's listing of the table); where that
 * cannot be established, nothing is pressed and `why` says it is a limitation
 * of the check. THE WALL: a read goes out; any other write is stopped and
 * recorded; the form's request goes out only when `submit` is set AND
 * `formGate` says, BEFORE it leaves, that it is the one request this check was
 * written for, each entry under its own column. A page with no form or
 * several, a field this check does not fill, or values that did not hold,
 * presses nothing. So a
 * rehearsal records what would have been sent and sends nothing, and the paid
 * press sends that one entry and nothing else. Service workers are blocked,
 * because a request a service worker handles never reaches the wall.
 */
export async function submitFormInPage(browser, {
  origin, path, api, marker, columns = null, submit = false, ms = 45_000, answerMs = 30_000, settleMs = 6_000, pollMs = 250, route = null,
} = {}) {
  const out = {
    at: new Date().toISOString(), url: origin + path, api, submit: submit === true,
    ready: null, plan: null, binding: null, filled: null, filledOk: false, pressed: false, posts: [], response: null, failed: null, message: null,
    aborted: [], errors: [], why: "",
  };
  const onApi = (u) => { try { const x = new URL(String(u)); return x.origin === origin && x.pathname === api; } catch { return false; } };
  const sleep = (t) => new Promise((r) => setTimeout(r, t));
  let ctx = null;
  try {
    ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 }, serviceWorkers: "block" });
    if (route) await route(ctx, "visitor");
    await ctx.route(() => true, async (r) => {
      const req = r.request();
      const m = req.method();
      if (m === "GET" || m === "HEAD") return r.fallback();
      const u = String(req.url());
      if (m === "POST" && onApi(u)) {
        const raw = req.postData();
        let body = null;
        try { body = JSON.parse(raw || "null"); } catch { body = { unparsed: String(raw || "").slice(0, 200) }; }
        let headers = null;
        try { headers = await req.allHeaders(); } catch { headers = null; }
        let search = null;
        try { search = new URL(u).search; } catch { search = null; }
        // DECIDED HERE, BEFORE ANYTHING LEAVES: the one exact request, or none.
        const gate = formGate({ n: out.posts.length + 1, raw, search, headers, marker, binding: out.binding });
        const entry = { method: m, path: api, body, sent: false, exact: gate.ok, exactWhy: gate.why };
        out.posts.push(entry);
        if (out.submit && gate.ok) { entry.sent = true; return r.fallback(); }
        entry.stopped = out.submit ? gate.why : "a rehearsal stops the entry inside the browser";
        if (out.submit && out.posts.length === 1) out.why = `the form's request was stopped in the browser and never sent — ${gate.why}`;
        return r.abort("blockedbyclient");
      }
      if (!u.includes("/cdn-cgi/")) out.aborted.push(`${m} ${u}`);
      return r.abort("blockedbyclient");
    });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => out.errors.push(String((e && e.message) || e).slice(0, 300)));
    page.on("console", (m) => { if (m.type() === "error") out.errors.push(m.text().slice(0, 300)); });
    page.on("response", async (res) => {
      const req = res.request();
      if (req.method() !== "POST" || !onApi(req.url()) || out.response) return;
      const e = { status: res.status(), text: "" };
      try { e.text = String(await res.text()).slice(0, 2000); } catch { /* a body the browser no longer holds */ }
      try { e.json = JSON.parse(e.text); } catch { /* not JSON: kept as text */ }
      out.response = e;
    });
    page.on("requestfailed", (req) => {
      if (req.method() !== "POST" || !onApi(req.url()) || out.failed) return;
      const f = typeof req.failure === "function" ? req.failure() : null;
      out.failed = (f && f.errorText) || "failed";
    });
    await page.goto(out.url, { waitUntil: "domcontentloaded", timeout: ms });
    const end = Date.now() + ms;
    for (;;) {
      out.ready = await page.evaluate(formFieldsInPage).catch(() => null);
      if (out.ready && out.ready.hydrated) break;
      if (Date.now() >= end) { out.why = out.ready && out.ready.forms === 0 ? "the page has no form — nothing was pressed" : "the form never became interactive — nothing was pressed"; return out; }
      await sleep(pollMs);
    }
    if (out.ready.forms !== 1) { out.why = `the page has ${out.ready.forms} forms; this check sends exactly one — nothing was pressed`; return out; }
    out.plan = fieldPlan(out.ready.fields, marker);
    if (!out.plan.ok) { out.why = out.plan.why; return out; }
    out.binding = fieldBindings(out.plan, columns);
    if (!out.binding.ok) { out.why = `verification limitation: ${out.binding.why} — nothing was pressed`; return out; }
    for (const f of out.plan.fills) {
      const el = page.locator(`form ${f.selector}`).first();
      if (f.kind === "check") await el.check();
      else await el.fill(f.value);
    }
    out.filled = await page.evaluate(formFieldsInPage).catch(() => null);
    const now = (out.filled && Array.isArray(out.filled.fields)) ? out.filled.fields : [];
    const holds = (f) => now.some((x) => (f.field.name ? x.name === f.field.name : x.id === f.field.id) && (f.kind === "check" ? x.value === "on" : x.value === f.value));
    out.filledOk = out.plan.fills.every(holds);
    if (!out.filledOk) { out.why = "the form does not hold the marker's values — nothing was pressed"; return out; }
    await page.locator('form button[type="submit"], form input[type="submit"], form button:not([type])').first().click();
    out.pressed = true;
    // THE REQUEST'S END: its answer, its failure, or the rehearsal's stop.
    const aEnd = Date.now() + answerMs;
    while (!(out.response || out.failed || (out.posts[0] && !out.posts[0].sent)) && Date.now() < aEnd) await sleep(pollMs);
    // THE PAGE'S OWN WORDS, once they arrive.
    const mEnd = Date.now() + settleMs;
    for (;;) {
      out.message = await page.evaluate(formOutcomeInPage).catch(() => null);
      if ((out.message && out.message.said.length) || Date.now() >= mEnd) break;
      await sleep(pollMs);
    }
    if (!out.posts.length) out.why = "the form made no request to the new table";
  } catch (e) {
    out.why = String((e && e.message) || e).slice(0, 200);
  } finally {
    if (ctx) { try { await ctx.close(); } catch { /* already gone */ } }
  }
  return out;
}

/** The job's own stored reply, as the page read it under `x-gf-edit: final`. */
export function finalReplyOf(step) {
  const fin = (Array.isArray(step && step.network) ? step.network : []).filter((e) => e.final && e.res && typeof e.res === "object");
  return fin.length ? fin[fin.length - 1].res : null;
}

/**
 * A MESSAGE THAT MUST FAIL, AND BE SEEN TO: its job's own stored reply is a
 * failure of the named kind that names no row and cost nothing for the edit
 * (the poll route takes that cost from the job's row: 0 once the reserve came
 * back), and the reply on screen is the app's warning carrying that reply's
 * own sentence. A success, another failure, no stored reply, or a failure the
 * page did not show is a reason, never a pass.
 */
export function failureVerdict(step, fails) {
  const fin = finalReplyOf(step);
  if (!fin) return { ok: false, why: "no stored reply was read" };
  const out = { ok: false, error: fin.error, cost: fin.cost, refunded: fin.refunded };
  if (fin.ok === true) return { ...out, why: "the message succeeded" };
  if (fin.ok !== false) return { ...out, why: "the stored reply says neither success nor failure" };
  const want = fails && typeof fails.error === "string" ? fails.error : "";
  if (!want || fin.error !== want) return { ...out, why: `it failed as ${fin.error || "nothing named"}, not as ${want || "(no failure named)"}` };
  if (Array.isArray(fin.applied) && fin.applied.length) return { ...out, why: "the failure names rows it changed" };
  if (fin.cost !== 0) return { ...out, why: `the failed edit's own cost reads ${JSON.stringify(fin.cost === undefined ? null : fin.cost)}, not 0` };
  if (typeof fin.msg !== "string" || !fin.msg.trim()) return { ...out, why: "the failure carries no sentence to show" };
  // ONE OF THE REPLIES THE MESSAGE GOT ON SCREEN is that warning: a note the
  // app draws beside it does not hide it, and a sentence drawn as anything but
  // a warning is not it.
  const screen = Array.isArray(step && step.replies) && step.replies.length ? step.replies : [step && typeof step.reply === "string" ? step.reply : ""];
  if (!screen.some((t) => typeof t === "string" && t.startsWith("⚠️") && t.includes(fin.msg))) {
    return { ...out, why: "the page did not show the failure's own sentence as a warning" };
  }
  return { ...out, ok: true, why: "" };
}

/**
 * WHETHER A MESSAGE THAT DEPENDS ON AN EARLIER ONE MAY BE SENT: only once that
 * one's job stored a success at the layer it was sent to do. Everything short
 * of that — not sent, no reply, no stored reply read, a refusal, a success at
 * another layer — is a reason, and the dependent message is not sent: its
 * routing call is billed, and on Test 5 its removal would only be refused.
 *
 * A FOLLOW-UP AFTER A FAILURE (`needs.failed`, Test 9) asks the opposite of
 * that message: it failed exactly as named and was shown failing
 * (`failureVerdict`), and the table read after it is the baseline — so the
 * second message follows a failure that changed nothing, or it is not sent.
 */
export function dependencyVerdict(steps, needs) {
  if (!needs) return { ok: true, why: "" };
  const dep = (Array.isArray(steps) ? steps : []).find((s) => s && s.n === needs.step);
  if (!dep || !dep.sent) return { ok: false, why: `message ${needs.step} was not sent` };
  if (!dep.completed) return { ok: false, why: `message ${needs.step}'s reply never came, so whether it did its work is not known` };
  const fin = finalReplyOf(dep);
  if (!fin) return { ok: false, why: `no stored reply to message ${needs.step} was read, so whether it did its work is not known` };
  if (needs.failed) {
    const f = failureVerdict(dep, { error: needs.failed });
    if (!f.ok) return { ok: false, why: `message ${needs.step} is not the failure this message follows up (${f.why})` };
    if (!dep.untouched || dep.untouched.ok !== true) {
      return { ok: false, why: `the table after message ${needs.step} is not known to be as it was (${dep.untouched ? dep.untouched.why : "not read"})` };
    }
    return { ok: true, why: "" };
  }
  if (fin.ok !== true) return { ok: false, why: `message ${needs.step} did not do its work (${fin.error || "no error named"})` };
  if (fin.layer !== needs.layer) return { ok: false, why: `message ${needs.step} succeeded at ${fin.layer || "no layer"}, not at ${needs.layer}` };
  return { ok: true, why: "" };
}

/**
 * THE EXACT CLEANUP, IF THE BOOKING WENT IN: the one new row holding every
 * marker value, read again just before it is deleted, deleted through the
 * owner route by its id, and checked. Without the owner's approval nothing is
 * deleted and the row's id is reported for them to decide.
 */
export async function rulesCleanup(io, r, spec) {
  const x = { plan: cleanupPlan(r.before.census, r.after.census, r.marker) };
  if (x.plan.act !== "delete") return x;
  if (!(r.allow && r.allow.cleanup === true)) {
    x.skipped = `NOT APPROVED: row ${x.plan.id} holds this run's booking and is left for the owner to decide`;
    return x;
  }
  x.recheck = stillMarker(await Promise.resolve().then(() => io.newest()).catch(() => null), x.plan.id, r.marker);
  if (!x.recheck.ok) return x;
  const res = await Promise.resolve().then(() => io.del(x.plan.id)).catch((e) => ({ status: 0, json: { error: String((e && e.message) || e).slice(0, 200) } }));
  x.deleted = deleteVerdict(res, x.plan.id);
  if (!x.deleted.ok) return x;
  const [t, n] = await Promise.all([
    Promise.resolve().then(() => io.tables()).catch(() => null),
    Promise.resolve().then(() => io.newest()).catch(() => null),
  ]);
  x.final = censusOf(tablesOf(t), n, spec);
  x.verified = cleanupVerified(r.before.census, x.final, r.marker, x.deleted.soft);
  return x;
}

/**
 * Drive one scenario. Every dependency that touches the world is handed in, so
 * a test can drive the same code with a browser whose API answers are supplied.
 *   base        the app's origin (https://gofarther.dev)
 *   session     the GoTrue session the canary opened (access, refresh, user)
 *   slug        the site the scenario is written for
 *   scenario    a value from UI_SCENARIOS
 *   spend       false = rehearse up to the first Send and stop
 *   balanceNow  () => Promise<number>, -1 when unreadable
 *   evid        a directory for screenshots
 *   launch      () => Promise<Browser>
 *   route       optional (context) => Promise, to answer requests in tests
 */
export async function runUi(opts) {
  const {
    base, session, slug, scenario, spend, balanceNow, evid,
    launch = defaultLaunch, route = null, log = console.log,
    openMs = UI_OPEN_MS, attachMs = UI_ATTACH_MS, startMs = UI_START_MS, stepMs = UI_STEP_MS, pollMs = UI_POLL_MS,
    // How long an answer's own network entry gets to land before a step's
    // share of the record is taken: the listener reads the body after the page
    // has already drawn the reply.
    settleMs = 1500,
    // HOW OFTEN A REQUEST'S OWN VIEW IS READ while a message the server took
    // on is followed (each read moves the request on, as the page's do).
    viewEveryMs = 3000,
    // A SCENARIO THAT CHANGES A ROW (`scenario.row`) is handed the canary's
    // own readers: `rows = { owner, pub, patch }` — the owner route's read,
    // the visitor route's read and the owner route's PATCH — and the site's
    // origin, where the page a visitor sees it on lives.
    rows = null, siteOrigin = "", shownMs = 45_000,
    // THE RULES TEST (`scenario.rules`) is handed its readers and its one
    // write: `rules = { tables, newest, secrets, stamp, menu, bookingsRead,
    // surface, del }` (see `readRulesState`; `del` is the owner route's DELETE,
    // used only by the exact cleanup), the owner's approvals from the form, and
    // this run's id, which goes into the marker booking's name.
    rules: rulesIo = null, allow = null, runId = "", bookMs = 45_000, answerMs = 30_000, bookSettleMs = 6_000,
    root = new URL("../", import.meta.url).pathname,
    // A MESSAGE'S OWN BOUND (`step.ms`) never past this (`stepBoundMs`).
    stepCapMs = UI_STEP_MAX_MS,
    // A MESSAGE SENT WITH ITS TAB THEN CLOSED (`step.away`) is read through
    // the canary's own session, never a page: `requestsNow()` answers the
    // requests list (`GET /api/site/requests/<slug>`, which moves nothing) as
    // `{ status, json }`, and `stopNow(key)` is the request's own Stop
    // (`DELETE /api/site/request/<slug>/<key>`), sent only when a part is
    // routed where the message may not go. Read every `awayEveryMs`.
    requestsNow = null, stopNow = null, awayEveryMs = UI_AWAY_EVERY_MS,
    // THE LEAST TIME A REQUEST'S REPLIES GET ONCE IT HAS ENDED (`watchReplies`).
    replyFloorMs = UI_REPLY_FLOOR_MS,
    // A MESSAGE WHOSE TAB IS CLOSED ONCE ITS PROGRESS SHOWS (`away: "fresh"`):
    // `freshSession()` signs the canary's account in afresh — a second session,
    // as another device's — for the fresh browser session that opens the site
    // afterwards; `firstLineMs` and `freshAwayMs` bound the two waits.
    freshSession = null, firstLineMs = UI_FIRST_LINE_MS, freshAwayMs = UI_FRESH_AWAY_MS,
  } = opts;
  const origin = new URL(base).origin;
  const t0 = Date.now();
  const rec = {
    at: new Date(t0).toISOString(), base: origin, slug, spend: spend === true,
    opened: null, card: "", steps: [], stopped: null, sent: 0, blocked: [],
    network: [], consoleErrors: [], pageErrors: [], balance: { start: null, end: null, startAt: null, endAt: null },
  };
  const stop = (at, msg) => { rec.stopped = { at, msg }; log(`  STOPPED at ${at}: ${msg}`); };
  // The message being sent, for the wall: none before the first Send.
  let current = null;
  const spec = scenario && scenario.row ? scenario.row : null;
  if (spec) {
    rec.row = { spec, shown: {} };
    if (!rows || typeof rows.owner !== "function" || typeof rows.pub !== "function" || typeof rows.patch !== "function" || !siteOrigin) {
      stop("open", "this scenario checks a database row and was not handed the row readers — nothing was sent or written");
      return rec;
    }
  }
  // A ROW THIS RUN KEEPS (`restore: false`, the owner's demo-site rule) IS
  // NEVER WRITTEN BY IT. Its PATCH is swapped here for a refusal that sends
  // nothing and is counted, so no path below — the probe, the recovery, or
  // anything added later — can reach the owner route's write.
  const rowIo = spec && spec.restore === false
    ? { ...rows, patch: async () => { rec.row.writes = (rec.row.writes || 0) + 1; throw new Error("this run keeps the row and makes no write"); } }
    : rows;
  const rspec = scenario && scenario.rules ? scenario.rules : null;
  if (rspec) {
    rec.rules = {
      spec: rspec, site: slug, marker: markerBooking(rspec.marker, runId || `local-${t0}`),
      allow: allow && allow.ok === true ? allow : { ok: true, cleanup: false, sends: [], words: [] },
    };
    const need = ["tables", "newest", "secrets", "stamp", "menu", "bookingsRead", "surface", "del"];
    if (!rulesIo || need.some((k) => typeof rulesIo[k] !== "function") || !siteOrigin) {
      stop("open", "this scenario tests the rules rung and was not handed its readers — nothing was sent or written");
      return rec;
    }
  }
  // The visitor's booking, in a tab of its own: a dry run presses the button
  // and stops the request in the browser; the paid run sends it once.
  const book = (submit) => bookInPage(browser, {
    origin: siteOrigin, spec: rspec, marker: rec.rules.marker, submit,
    ms: bookMs, answerMs, settleMs: bookSettleMs, pollMs: Math.max(pollMs, 50), route,
  });
  const shot = async (page, name) => {
    if (!evid) return "";
    fs.mkdirSync(evid, { recursive: true });
    const file = `${evid}/${name}.png`;
    try { await page.screenshot({ path: file }); return file; } catch { return ""; }
  };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const until = async (page, test, ms) => {
    const end = Date.now() + ms;
    let s = null;
    for (;;) {
      try { s = await page.evaluate(readComposerInPage); } catch { s = null; }
      if (s && test(s)) return { ok: true, s };
      if (Date.now() >= end) return { ok: false, s };
      await sleep(pollMs);
    }
  };

  // THE APP'S CONTEXT, set once the browser is open; and, while a message's
  // tab is closed (`away`), where any read of a request's own route made in
  // it is recorded — there must be none.
  let context = null;
  let awayCalls = null;
  // A REQUEST BEING FOLLOWED, its record on the message: every view read
  // (`trail`, the statuses each time they changed), the wall, the Stop, the
  // last view and the request's own reply.
  const newFollow = (key) => ({ key, views: 0, wall: null, stop: null, final: null, trail: [], reply: null });
  const noteView = (r, view) => {
    r.request.views++;
    r.request.final = view;
    const parts = (Array.isArray(view.parts) ? view.parts : []).map((p) => [p.n, p.status]);
    const last = r.request.trail[r.request.trail.length - 1];
    if (!last || JSON.stringify(last.parts) !== JSON.stringify(parts)) r.request.trail.push({ ms: Date.now() - (r.sentAt || t0), parts });
  };
  const wallHit = (r, key, hit) => {
    r.request.wall = hit;
    rec.blocked.push({ ms: Date.now() - t0, method: "STOP", path: `request ${key} part ${hit.n}`, why: hit.why });
    log(`  BLOCKED request ${key}, part ${hit.n}: ${hit.why} — the request is stopped`);
  };
  // EVERY PAGE THE RUN OPENS IS WATCHED THE SAME WAY: its console, its
  // errors, and every API answer it gets (`recordsBody`).
  // AND EVERY ADDRESS ITS PREVIEW FRAME LOADS (2026-10-05): a request to the
  // site's own origin carrying the preview's `v`, by the tab that made it (the
  // run's first tab is 1, a tab opened after a closed-tab message 2).
  const siteHost = (() => { try { return siteOrigin ? new URL(siteOrigin).origin : ""; } catch { return ""; } })();
  rec.frameLoads = [];
  let tabsWatched = 0;
  const watch = (pg) => {
    const tab = ++tabsWatched;
    pg.on("request", (req) => {
      let u = null;
      try { u = new URL(req.url()); } catch { return; }
      if (siteHost && u.origin === siteHost && u.searchParams.has("v")) rec.frameLoads.push({ ms: Date.now() - t0, tab, path: u.pathname + u.search });
    });
    pg.on("console", (m) => { if (m.type() === "error") rec.consoleErrors.push(m.text().slice(0, 300)); });
    pg.on("pageerror", (e) => rec.pageErrors.push(String((e && e.message) || e).slice(0, 300)));
    pg.on("response", async (res) => {
      const req = res.request();
      const url = req.url();
      if (!url.startsWith(origin + "/api/")) return;
      const u = new URL(url);
      const e = { ms: Date.now() - t0, method: req.method(), path: u.pathname + u.search, status: res.status() };
      if (res.headers()["x-gf-edit"] === "final") e.final = true;
      if (recordsBody(req.method(), u.pathname)) {
        if (req.method() === "POST") e.req = recordableRequest(req.postData());
        // A poll is recorded in full only when it is the answer; every other
        // poll is a status line, or the record is mostly "still running".
        if (req.method() === "POST" || e.final || e.status >= 400) {
          try { const txt = await res.text(); try { e.res = JSON.parse(txt); } catch { e.res = txt.slice(0, 400); } } catch { /* a body the browser no longer holds */ }
        }
      }
      rec.network.push(e);
    });
  };
  // ── OPEN THE APP, SIGNED IN, AND THE SITE'S WORKSPACE ─────────────────
  // `{ ok, why, shot, opened, card }`: a tab the run can type into, or the
  // reason it is not one. The run's first tab, and the tab a message sent
  // with its tab closed (`away`) is read in afterwards.
  const openWorkspace = async (pg) => {
    const out = { ok: false, why: "", shot: true, opened: null, card: "" };
    await pg.goto(origin + "/projects", { waitUntil: "domcontentloaded", timeout: openMs });
    const signed = await until(pg, (s) => s.gate || (s.signedIn && !!s.uid), openMs);
    const want = (session.user && session.user.id) || "";
    out.opened = { signedIn: !!(signed.s && signed.s.signedIn), uid: signed.s ? signed.s.uid : "", gate: !!(signed.s && signed.s.gate) };
    if (out.opened.gate) return { ...out, why: "the app asked to sign in, so the planted session was refused — nothing was sent" };
    if (!signed.ok || !out.opened.signedIn) return { ...out, why: "the app did not open signed in — nothing was sent" };
    if (!want || out.opened.uid !== want) return { ...out, shot: false, why: `the app is signed in as ${out.opened.uid || "nobody"}, not the canary's account — nothing was sent` };
    const cardEnd = Date.now() + openMs;
    let card = "";
    while (!card && Date.now() < cardEnd) {
      card = await pg.evaluate(cardIdInPage, slug).catch(() => "");
      if (card) break;
      const g = await pg.evaluate(readComposerInPage).catch(() => null);
      if (g && g.gate) return { ...out, why: "the app asked to sign in, so the planted session was refused — nothing was sent" };
      await sleep(pollMs);
    }
    out.card = card;
    if (!card) return { ...out, why: `the start screen never showed ${slug}'s card — nothing was sent` };
    await pg.click(`.st-card[data-open="${card}"] .st-card-name`);
    const ws = await until(pg, (s) => s.workspace, openMs);
    if (!ws.ok) return { ...out, why: "the site's workspace never opened — nothing was sent" };
    const idle = await until(pg, composerReady, openMs);
    if (!idle.ok) return { ...out, why: "the workspace opened busy and never became idle — nothing was sent" };
    return { ...out, ok: true, shot: false };
  };

  // ONE WAIT FOR EITHER KIND OF MESSAGE (2026-10-03): an ordinary message is
  // done at its first reply with an idle composer; one the server took on as
  // a request (its routing answer names one) once the request has ended and
  // the page has shown all of it — its parts walled as they are routed, by the
  // request's own Stop.
  const followStep = async (page, { before, netFrom, step, r, ms }) => {
    const end = Date.now() + ms;
    let s = null, key = "", view = null, lastLook = 0;
    for (;;) {
      try { s = await page.evaluate(readComposerInPage); } catch { s = null; }
      if (!key) key = requestKeyOf(rec.network.slice(netFrom));
      if (key) {
        if (!r.request) r.request = newFollow(key);
        if (Date.now() - lastLook >= viewEveryMs || !view) {
          lastLook = Date.now();
          const v = await page.evaluate(requestViewInPage, { slug, key }).catch(() => null);
          if (v && v.ok && v.request) { view = v.request; noteView(r, view); if (v.reply) r.request.reply = v.reply; }
        }
        const hit = view && !r.request.wall ? requestWall(view, scenario, step) : null;
        if (hit) {
          wallHit(r, key, hit);
          r.request.stop = await page.evaluate(stopRequestInPage, { slug, key }).catch(() => ({ status: 0, ok: false, state: "" }));
          view = null;
        }
        const shown = s && s.requests ? s.requests[key] : null;
        // A MESSAGE THAT ENDS ON A STEP'S QUESTION (`until: "question"`): one
        // part waits on it, nothing else is about to run or running, the page
        // has shown every reply so far and draws the question's card for that
        // part — so the next message is its answer.
        if (step.until === "question" && s && composerReady(s) && view && !view.ended && !r.request.wall) {
          const q = questionShown(view, s, key);
          if (q) { r.question = q; return { ok: true, s }; }
        }
        if (s && composerReady(s) && view && view.ended === true && shown && shown.closed === true) return { ok: true, s };
      } else if (step.until === "question" && s && composerReady(s) && s.ask && !s.ask.key && s.askCard) {
        // THE ROUTER'S OWN QUESTION, with no request opened: another valid
        // path, recorded as such. The answer is then routed whole.
        const route = routeCallOf(rec.network.slice(netFrom));
        if (route && route.res && route.res.intent === "clarify") {
          r.question = { by: "router", key: "", part: null, id: s.ask.id, text: s.ask.text };
          return { ok: true, s };
        }
      } else if (s && composerReady(s) && newReplies(before, s.messages).length > 0) return { ok: true, s };
      if (Date.now() >= end) return { ok: false, s };
      await sleep(pollMs);
    }
  };

  // EVERY CONTEXT THE RUN OPENS IS PREPARED THE SAME WAY (2026-10-06): its
  // test route, the closed-tab watch, the wall and the planted session — the
  // run's own, or one signed in afresh for a fresh browser session
  // (`away: "fresh"`), which holds nothing else of the first tab's.
  const prepareContext = async (ctx, sess) => {
    if (route) await route(ctx);
    // ANY READ OF A REQUEST'S OWN ROUTE, from any page of the run's browser,
    // while a message's tab is closed (`away`): none is expected, since no
    // page is open, and one would mean the request was moved on by a page.
    if (typeof ctx.on === "function") {
      ctx.on("request", (req) => {
        if (!awayCalls) return;
        let u = null;
        try { u = new URL(req.url()); } catch { return; }
        if (u.origin === origin && u.pathname.startsWith("/api/site/request/")) awayCalls.push({ ms: Date.now() - t0, method: req.method(), path: u.pathname });
      });
    }
    // Registered after any test route, so it is asked first; anything it does
    // not refuse falls back to that route, or to the network. It sees every API
    // call the app makes, because a scenario that names its layers refuses
    // every write that is not its own (`wallRefusal`). `current` is the
    // message being sent, set just before its Send, so a message that names
    // its own layers is walled to them.
    await ctx.route((u) => u.origin === origin && u.pathname.startsWith("/api/"), async (r) => {
      const req = r.request();
      const u = new URL(req.url());
      const why = wallRefusal({
        method: req.method(), pathname: u.pathname,
        body: typeof req.postData === "function" ? req.postData() : null, scenario, step: current,
      });
      if (!why) return r.fallback();
      rec.blocked.push({ ms: Date.now() - t0, method: req.method(), path: u.pathname, why });
      log(`  BLOCKED ${req.method()} ${u.pathname}: ${why}`);
      return r.abort("blockedbyclient");
    });
    // THE OWNER'S SESSION, PLANTED FOR THE APP'S ORIGIN AND NO OTHER. The same
    // script runs in the workspace's preview frame, which is the customer
    // site's origin — and a session written there would hand the owner's token
    // to that site's scripts. Written once: the app refreshes and rotates it.
    //
    // AND THE FIRST-RUN GREETING, MARKED AS SEEN, as a returning owner's browser
    // holds it. On a fresh browser, `maybeShowWelcome` covers the page with a
    // modal whenever an unpaid account's balance is 1 to 20 and no site is
    // stored locally. This context is always fresh, so from a balance of 20
    // down the modal took the site card's click: Test 9's local proof, at a
    // balance of 10, stopped there, and every earlier UI run had more than 20.
    // It greets; no edit passes through it. Only for the app's origin, and
    // never over a value the page already holds.
    await ctx.addInitScript(({ o, key, value, seen }) => {
      try {
        if (location.origin !== o) return;
        if (!localStorage.getItem(key)) localStorage.setItem(key, value);
        if (!localStorage.getItem(seen)) localStorage.setItem(seen, "1");
      } catch (e) { /* a frame with no storage */ }
    }, {
      o: origin, key: SESSION_KEY, seen: WELCOME_SEEN_KEY, value: JSON.stringify({
        access_token: sess.access_token,
        refresh_token: sess.refresh_token,
        expires_at: sess.expires_at ? sess.expires_at * 1000 : Date.now() + (sess.expires_in || 3600) * 1000,
        user: sess.user || null,
      }),
    });
  };

  // ── A MESSAGE SENT, THEN ITS TAB CLOSED (`away`, 2026-10-03) ────────────
  // Once the routing answer names the request and the page has drawn its
  // card, the tab is closed. From then on nothing but the requests list is
  // read — through the canary's own session, never a page, and every
  // `awayEveryMs` — so the request is moved on by the server alone (its jobs'
  // ends and the two-minute sweep). A part routed where the message may not
  // go is stopped through the request's own Stop. Once the list shows the
  // request ended, a new tab opens the site, and must show it ended: every
  // part with its reply, the request closed.
  const followAway = async (page, { before, netFrom, step, r, ms }) => {
    const end = Date.now() + ms;
    const a = r.away = { closed: false, ended: false, reads: 0, calls: [], list: [], endedMs: null, reopened: null };
    let s = null, key = "";
    for (;;) {
      try { s = await page.evaluate(readComposerInPage); } catch { s = null; }
      if (!key) key = requestKeyOf(rec.network.slice(netFrom));
      if (key && s && s.requests && s.requests[key]) break;
      if (Date.now() >= end) return { ok: false, s, page, why: key ? "the page never drew the request's card" : "the routing answer named no request, so there was nothing to leave running" };
      await sleep(pollMs);
    }
    r.request = newFollow(key);
    if (typeof requestsNow !== "function" || typeof stopNow !== "function") {
      return { ok: false, s, page, why: "this run was not handed the requests list and the Stop, so the tab is not closed" };
    }
    awayCalls = a.calls;
    await Promise.resolve().then(() => page.close()).catch(() => {});
    a.closed = true;
    const closedAt = Date.now();
    log(`  away: the tab is closed; request ${key} is read through the requests list alone`);
    let view = null;
    for (;;) {
      const res = await Promise.resolve().then(() => requestsNow()).catch(() => null);
      a.reads++;
      const list = res && res.status === 200 && res.json && Array.isArray(res.json.requests) ? res.json.requests : null;
      view = list ? list.find((q) => q && q.key === key) || null : null;
      a.list.push({ ms: Date.now() - closedAt, status: res ? res.status : 0, found: !!view, ...(view ? { state: view.state, ended: view.ended === true } : {}) });
      if (view) noteView(r, view);
      const hit = view && !r.request.wall ? requestWall(view, scenario, step) : null;
      if (hit) {
        wallHit(r, key, hit);
        const st = await Promise.resolve().then(() => stopNow(key)).catch(() => null);
        r.request.stop = { status: st ? st.status : 0, ok: !!(st && st.json && st.json.ok === true), state: st && st.json && st.json.request ? st.json.request.state : "" };
      }
      if (view && view.ended === true) { a.ended = true; a.endedMs = Date.now() - closedAt; break; }
      if (Date.now() >= end) break;
      await sleep(awayEveryMs);
    }
    awayCalls = null;
    // THE TAB OPENED AFTERWARDS, in the same browser: the page's own record
    // of the request is there, and the page follows it to its end.
    const next = await context.newPage();
    watch(next);
    // ITS NUMBER AMONG THE RUN'S TABS, for its own first address (2026-10-05):
    // the address its frame first asked for is the one it opened at — before
    // the page's first look at the site's requests could move anything — and
    // it is the baseline this message's preview is judged against
    // (`liveChecks`). Run 101 judged it against the first tab's address read
    // before the send, which that tab had itself moved since.
    const reTab = tabsWatched;
    const firstFrame = () => { const f = rec.frameLoads.find((x) => x && x.tab === reTab); return f ? f.path : null; };
    const opened = await openWorkspace(next);
    if (!opened.ok) {
      a.reopened = { ok: false, closed: false, why: opened.why.replace(/ — nothing was sent$/, "") };
      return { ok: false, s: null, page: next, why: `the tab opened afterwards: ${a.reopened.why}` };
    }
    const shownEnd = Date.now() + Math.max(openMs, 60_000);
    for (;;) {
      try { s = await next.evaluate(readComposerInPage); } catch { s = null; }
      const shown = s && s.requests ? s.requests[key] : null;
      if (s && composerReady(s) && shown && shown.closed === true) break;
      if (Date.now() >= shownEnd) { a.reopened = { ok: true, closed: false, why: "the reopened page never showed the request closed", frameTab: reTab, firstFrame: firstFrame() }; return { ok: false, s, page: next, why: a.reopened.why }; }
      await sleep(pollMs);
    }
    a.reopened = { ok: true, closed: true, why: "", tab: await next.evaluate(tabMarkInPage).catch(() => null), frameTab: reTab, firstFrame: firstFrame() };
    return { ok: a.ended, s, page: next, why: a.ended ? "" : "the request had not ended when the time ran out" };
  };

  // ── A MESSAGE WHOSE TAB IS CLOSED ONCE ITS PROGRESS SHOWS (`away: "fresh"`,
  // 2026-10-06) ────────────────────────────────────────────────────────────
  // The owner: *"capture actual first-person progress before completion …
  // and check recovery after closing the originating tab and reopening on a
  // fresh browser session."* The tab that sent the message watches the
  // request's card, keeping each change of what it draws (`progressSnapshot`),
  // until a progress line is shown while the request still runs — or the
  // request ends, or `firstLineMs` passes — and is then closed. The request is
  // read through the requests list alone for `freshAwayMs`: no page is open,
  // and any read of its own route then is recorded (there must be none). Then
  // a FRESH BROWSER SESSION — a new context, signed in afresh through
  // `freshSession`, holding nothing of the first tab's — opens the site. Its
  // page must find the request on the server and draw its card, and it is
  // followed, each change kept, until it shows the request closed: every
  // part's reply on screen. A part routed where the message may not go is
  // stopped through the request's own Stop, as for `away`.
  const followFresh = async (page, { netFrom, step, r, ms }) => {
    const end = Date.now() + ms;
    const f = r.fresh = {
      first: null, before: [], closed: false, closedRunning: null, closedMs: null,
      away: { reads: 0, calls: [], list: [], ended: false }, reopened: null, after: [],
    };
    const at = () => Date.now() - (r.sentAt || t0);
    let s = null, key = "";
    for (;;) {
      try { s = await page.evaluate(readComposerInPage); } catch { s = null; }
      if (!key) key = requestKeyOf(rec.network.slice(netFrom));
      if (key && s && s.requests && s.requests[key]) break;
      if (Date.now() >= end) return { ok: false, s, page, why: key ? "the page never drew the request's card" : "the routing answer named no request, so there was nothing to leave running" };
      await sleep(pollMs);
    }
    r.request = newFollow(key);
    if (typeof requestsNow !== "function" || typeof stopNow !== "function" || typeof freshSession !== "function") {
      return { ok: false, s, page, why: "this run was not handed the requests list, the Stop and a second sign-in, so the tab is not closed" };
    }
    // THE CARD IN THE TAB THAT SENT IT, until a line shows LIVE ON ITS OWN
    // RUNNING PART while the request runs (2026-10-06, Codex's reproduction: a
    // done part's lines, kept on its card while another part waited, were
    // taken as the first line, and every check passed with no live line ever
    // seen). The page marks the newest line live only on a part that is
    // running (`progressListHTML`), so a kept line is never one.
    const lineEnd = Math.min(end, Date.now() + firstLineMs);
    let snap = null;
    for (;;) {
      snap = progressSnapshot(s, key);
      keepSnapshot(f.before, snap, at());
      const lit = snap && !snap.ended ? snap.parts.find(liveOnItsPart) : null;
      if (lit) { f.first = { ms: at(), part: lit.n, status: lit.status, line: lit.live }; break; }
      if ((snap && snap.ended) || Date.now() >= lineEnd) break;
      await sleep(pollMs);
      try { s = await page.evaluate(readComposerInPage); } catch { s = null; }
    }
    // CLOSED, as a customer closes it: nothing of this tab's moves the request on now.
    f.closedRunning = !!(snap && !snap.ended);
    awayCalls = f.away.calls;
    await Promise.resolve().then(() => page.close()).catch(() => {});
    f.closed = true;
    f.closedMs = at();
    const closedAt = Date.now();
    log(`  fresh: the tab is closed ${f.first ? `${Math.round(f.first.ms / 1000)} s after the send, a progress line shown` : "with no progress line shown"}; request ${key} is read through the requests list alone`);
    for (;;) {
      const res = await Promise.resolve().then(() => requestsNow()).catch(() => null);
      f.away.reads++;
      const list = res && res.status === 200 && res.json && Array.isArray(res.json.requests) ? res.json.requests : null;
      const view = list ? list.find((q) => q && q.key === key) || null : null;
      const lines = view ? (Array.isArray(view.parts) ? view.parts : []).reduce((n, p) => n + (p && Array.isArray(p.progress) ? p.progress.length : 0), 0) : 0;
      f.away.list.push({ ms: Date.now() - closedAt, status: res ? res.status : 0, found: !!view, ...(view ? { state: view.state, ended: view.ended === true, lines } : {}) });
      if (view) noteView(r, view);
      const hit = view && !r.request.wall ? requestWall(view, scenario, step) : null;
      if (hit) {
        wallHit(r, key, hit);
        const st = await Promise.resolve().then(() => stopNow(key)).catch(() => null);
        r.request.stop = { status: st ? st.status : 0, ok: !!(st && st.json && st.json.ok === true), state: st && st.json && st.json.request ? st.json.request.state : "" };
      }
      if (view && view.ended === true) { f.away.ended = true; break; }
      if (Date.now() - closedAt >= freshAwayMs || Date.now() >= end) break;
      await sleep(awayEveryMs);
    }
    awayCalls = null;
    // THE FRESH BROWSER SESSION: the canary's account signed in afresh, in a
    // context of its own.
    let fresh = null;
    try { fresh = await freshSession(); } catch { fresh = null; }
    if (!fresh || typeof fresh.access_token !== "string" || !fresh.access_token) {
      f.reopened = { ok: false, found: false, closed: false, why: "a second session could not be opened" };
      return { ok: false, s: null, page, why: "the fresh browser session could not sign in" };
    }
    f.reopened = {
      ok: false, found: false, closed: false, why: "",
      sameAccount: !!(fresh.user && session.user && fresh.user.id === session.user.id),
      newSession: fresh.access_token !== session.access_token,
    };
    const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await prepareContext(ctx2, fresh);
    const next = await ctx2.newPage();
    watch(next);
    const opened = await openWorkspace(next);
    if (!opened.ok) {
      f.reopened.why = opened.why.replace(/ — nothing was sent$/, "");
      return { ok: false, s: null, page: next, why: `the fresh browser session: ${f.reopened.why}` };
    }
    f.reopened.ok = true;
    for (;;) {
      try { s = await next.evaluate(readComposerInPage); } catch { s = null; }
      const snap2 = progressSnapshot(s, key);
      if (snap2) f.reopened.found = true;
      keepSnapshot(f.after, snap2, at());
      const shownHere = s && s.requests ? s.requests[key] : null;
      if (s && composerReady(s) && shownHere && shownHere.closed === true) { f.reopened.closed = true; break; }
      if (Date.now() >= end) {
        f.reopened.why = f.reopened.found ? "the fresh session never showed the request closed" : "the fresh session never drew the request's card";
        return { ok: false, s, page: next, why: f.reopened.why };
      }
      await sleep(pollMs);
    }
    f.reopened.tab = await next.evaluate(tabMarkInPage).catch(() => null);
    return { ok: true, s, page: next, why: "" };
  };

  // ── THE CURRENT REQUEST'S REPLIES, SETTLED AND ON SCREEN (2026-10-05) ────
  // A request's end is not its replies' end: since deploy 2183 the page closes
  // a request once each part's outcome is applied, while a part's reply may
  // still be written in the background, its place held on the thread by the
  // job's id (run 97 judged one 8 s after its job ended, still `pending`). So
  // once a message's request has ended — or stopped on a step's question, or
  // been shown ended by the tab opened afterwards — its own jobs' replies are
  // waited for on the page that shows them, each read off its own job
  // (`repliesNow`), until every one is written or has failed for good and is
  // on screen, or the time runs out: the message's own bound, and never less
  // than `replyFloorMs` after the request ended. The request's own reply, when
  // one is owed, likewise. Nothing else on the thread is waited for or
  // counted: another request's replies, wherever the page draws them, neither
  // hold this up nor stand in for it.
  const watchReplies = async (page, r, { key, earlier, end }) => {
    const began = Date.now();
    let slots = { tab: null, at: {} };
    let s = null;
    let view = r.request && r.request.final ? r.request.final : null;
    let own = null;
    let lastLook = 0;
    let now = null;
    for (;;) {
      // THE REQUEST AS IT STANDS, for its jobs and its own reply.
      if (!lastLook || Date.now() - lastLook >= viewEveryMs) {
        lastLook = Date.now();
        const v = await page.evaluate(requestViewInPage, { slug, key }).catch(() => null);
        if (v && v.ok && v.request) {
          view = v.request;
          noteView(r, view);
          own = v.reply ? { text: v.reply.text, source: v.reply.source, for: v.reply.for } : v.replyState ? { state: v.replyState, for: v.replyFor || "" } : null;
          if (v.reply) r.request.reply = v.reply;
        }
      }
      try { s = await page.evaluate(readComposerInPage); } catch { s = null; }
      slots = trackHeld(slots, s);
      now = repliesNow({ jobs: replyJobsOf(view, earlier), network: rec.network, s, slots, key, request: own });
      if (now.settled) break;
      if (Date.now() >= end) { now = timedOut(now); break; }
      await sleep(pollMs);
    }
    return { s, watch: { ms: Date.now() - began, timedOut: !now.settled, jobs: now.jobs, request: now.request, attributed: now.attributed } };
  };

  const browser = await launch();
  // The visitor's page, read in a context of its own. The verdict against the
  // first reading is the caller's: what it must show changes from step to step.
  // A LINE IS FOUND BY ITS WHOLE START where the page draws more than the name
  // before the price (`shownLead`), and any page that shows the row (the spec's
  // `also`) is read the same way as its own.
  const shown = (path = spec.shown.path) => readShownSite(browser, {
    url: siteOrigin + path, sel: spec.shown.sel, name: shownLead(spec),
    ms: shownMs, pollMs: Math.max(pollMs, 250), route,
  });
  try {
    // ── A RECOVERY RUN: NO APP, NO MESSAGE, ONE FIELD AT MOST ──────────────
    // A row scenario with no steps is D1's recovery on its own. It never opens
    // the app and never sends anything; `spend` decides whether its one write
    // is made or only described.
    if (spec && !scenario.steps.length) {
      rec.balance.start = await balanceNow();
      const before = rec.row.shown.before = await shown();
      // Whether the write would be conditional is asked first, with a write no
      // row can meet; a Worker that cannot enforce it is never sent the real one.
      rec.row.capability = await conditionProbe(rowIo, spec);
      rec.row.recovery = await recoverRow({ spec, record: spec.record, readers: rowIo, patch: rowIo.patch, write: spend === true && rec.row.capability.ok });
      if (rec.row.recovery.sent) {
        const now = rec.row.shown.afterRestore = await shown();
        now.verdict = before.ok && now.ok ? shownVerdict(before.lines, now.lines, spec, spec.shown.before) : { ok: false, why: now.ok ? "no-before" : now.why };
      }
      if (!spend) stop("rehearsal", "spend is not yes: the recovery was read and decided, and nothing was written");
      else if (!rec.row.capability.ok) stop("condition", `${rec.row.capability.detail || rec.row.capability.why} — nothing was written`);
      rec.balance.end = await balanceNow();
      return rec;
    }
    context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await prepareContext(context, session);
    let page = await context.newPage();
    watch(page);

    // ── OPEN THE APP, SIGNED IN, AND THE SITE'S WORKSPACE ─────────────────
    const o = await openWorkspace(page);
    rec.opened = o.opened;
    rec.card = o.card;
    if (!o.ok) { stop("open", o.why); if (o.shot) await shot(page, "ui-open"); return rec; }
    // THE TAB, MARKED ONCE IT IS OPEN: every message goes from this document,
    // and each reply is read in it (`sameTab`).
    rec.tab = await page.evaluate(markTabInPage, crypto.randomBytes(12).toString("hex")).catch(() => null);
    // WHEN EACH END WAS READ, so the ledger between them can be read too: what
    // else moved the balance while this press ran (`ownMoneyVerdict`).
    rec.balance.startAt = new Date().toISOString();
    rec.balance.start = await balanceNow();
    await shot(page, "ui-open");

    // ── ONE MESSAGE AT A TIME ─────────────────────────────────────────────
    for (const [i, step] of scenario.steps.entries()) {
      const n = i + 1;
      const r = { n, say: step.say, attach: step.attach || null };
      // HOW THIS MESSAGE ENDS (2026-10-03): on a step's question
      // (`until: "question"`), with its tab closed (`away`), or as any other.
      // OR WITH ITS TAB CLOSED ONCE ITS PROGRESS SHOWS, READ AFTERWARDS IN A
      // FRESH BROWSER SESSION (`away: "fresh"`, 2026-10-06).
      r.mode = step.until === "question" ? "question" : step.away === "fresh" ? "fresh" : step.away === true ? "away" : "";
      r.boundMs = stepBoundMs(step, { stepMs, capMs: stepCapMs });
      rec.steps.push(r);
      // A MESSAGE THAT DEPENDS ON AN EARLIER ONE is sent only once that one
      // really did its work — never typed, never sent, never billed otherwise.
      if (step.needs) {
        r.dependency = dependencyVerdict(rec.steps, step.needs);
        if (!r.dependency.ok) { stop(`step ${n}`, `${r.dependency.why} — message ${n} depends on it and is NOT sent`); break; }
      }
      const pre = await until(page, composerReady, pollMs);
      if (!pre.ok) { stop(`step ${n}`, "the composer is not idle, so nothing more is sent"); break; }
      if (step.attach) {
        const file = new URL(step.attach, "file://" + root).pathname;
        const bytes = fs.readFileSync(file);
        r.file = { path: step.attach, bytes: bytes.length, sha256: crypto.createHash("sha256").update(bytes).digest("hex") };
        const [chooser] = await Promise.all([page.waitForEvent("filechooser", { timeout: attachMs }), page.click("#stPlus")]);
        await chooser.setFiles(file);
        const landed = await until(page, (s) => s.attached === 1 && s.strip >= 1, attachMs);
        r.attached = landed.ok;
        if (!landed.ok) { stop(`step ${n}`, "the file never landed in the attachment strip — nothing was sent"); await shot(page, `ui-step-${n}`); break; }
      }
      await page.fill("#stRevise", step.say);
      const typed = await page.evaluate(readComposerInPage);
      if (typed.value !== step.say) { stop(`step ${n}`, "the words did not land in the message box — nothing was sent"); break; }
      // THE PREVIEW AND THE LISTS AS THE PAGE HAD THEM BEFORE THE SEND (`pageViewOf`).
      r.typed = pageViewOf(typed);
      // ── THE FRESH BASELINE, IMMEDIATELY BEFORE THE FIRST MESSAGE ──────────
      // The condition probe first, then the page a visitor sees, then both
      // database readers last, so nothing but the budget's balance read stands
      // between the baseline and the Send. It is where the test must start: the
      // target row must be the one named and read exactly `from` on both
      // readers, and the page must show it at `shown.before` — or nothing is
      // sent.
      if (spec && n === 1) {
        // FIRST, WHETHER THE RECOVERY CAN BE CONDITIONAL AT ALL — asked with a
        // write no row can meet, so it changes nothing. A Worker that cannot
        // enforce a write's condition could not put the value back safely, so
        // a paid run is never sent on one; a rehearsal reports it. A run that
        // keeps the row writes nothing, so it asks nothing.
        if (spec.restore !== false) rec.row.capability = await conditionProbe(rowIo, spec);
        const before = rec.row.shown.before = await shown();
        before.verdict = before.ok && before.target.includes(spec.shown.before) ? { ok: true } : { ok: false, why: before.ok ? "wrong-price" : before.why };
        // EVERY OTHER PAGE THAT SHOWS THE ROW, read the same way, and before the
        // database readers, so those stay the last thing before the Send.
        const alsoPaths = Array.isArray(spec.shown.also) ? spec.shown.also : [];
        if (alsoPaths.length) rec.row.also = [];
        for (const path of alsoPaths) {
          const b = await shown(path);
          b.verdict = b.ok && b.target.includes(spec.shown.before) ? { ok: true } : { ok: false, why: b.ok ? "wrong-price" : b.why };
          rec.row.also.push({ path, before: b });
        }
        rec.row.baseline = await readBoth(rowIo);
        rec.row.baselineVerdict = baselineVerdict(rec.row.baseline, spec);
        if (rec.row.baseline.pub.ok) {
          const d = rowDiff(spec.record, rec.row.baseline.pub.rows);
          rec.row.record = { same: !d.changed.length && !d.added.length && !d.gone.length, diff: d };
        }
        if (!rec.row.baselineVerdict.ok) {
          stop("baseline", `the row is not where this test starts (${rec.row.baselineVerdict.why}${rec.row.baselineVerdict.detail ? ": " + rec.row.baselineVerdict.detail : ""}) — nothing was sent`);
          break;
        }
        if (!before.verdict.ok) { stop("baseline", `the ${spec.shown.path} page does not show ${spec.match.name} at ${spec.shown.before} (${before.verdict.why}) — nothing was sent`); break; }
        const off = (rec.row.also || []).find((v) => !v.before.verdict.ok);
        if (off) { stop("baseline", `the ${off.path} page does not show ${spec.match.name} at ${spec.shown.before} (${off.before.verdict.why}) — nothing was sent`); break; }
        if (spec.restore !== false) {
          // What the recovery would write against this baseline, decided now:
          // with nothing sent it must be nothing at all.
          rec.row.planAtBaseline = restorePlan(rec.row.baseline.owner.rows, spec, rec.row.baselineVerdict.raw);
          if (spend && !rec.row.capability.ok) {
            stop("condition", `${rec.row.capability.detail || rec.row.capability.why} — nothing was sent`);
            break;
          }
        }
      }
      // ── THE RULES TEST'S STARTING POINT, IMMEDIATELY BEFORE THE MESSAGE ────
      // The owner's view, the secret names, the notification stamp, a
      // visitor's reads and the site's surface, all read now; the paid press
      // sends nothing unless every one is where the test was written to start
      // and every send a booking could set off is approved. A rehearsal then
      // presses "Book a table" once in a tab whose wall stops the request, and
      // reads the owner's view again to show nothing moved.
      if (rspec && n === 1) {
        rec.rules.before = await readRulesState(rulesIo, rspec);
        rec.rules.start = rulesStartVerdict(rec.rules.before, rspec, rec.rules.allow);
        if (!spend) {
          rec.rules.dry = await book(false);
          const [t, nw] = await Promise.all([
            Promise.resolve().then(() => rulesIo.tables()).catch(() => null),
            Promise.resolve().then(() => rulesIo.newest()).catch(() => null),
          ]);
          rec.rules.dryAfter = censusOf(tablesOf(t), nw, rspec);
        } else if (!rec.rules.start.ok) {
          stop("start", `the site is not where this test starts (${rec.rules.start.why}) — nothing was sent`);
          break;
        }
      }
      if (!spend) {
        await shot(page, `ui-step-${n}-rehearsal`);
        stop("rehearsal", `spend is not yes: message ${n} is typed${step.attach ? " with its file attached" : ""} and NOT sent`);
        break;
      }
      const bal = await balanceNow();
      r.balanceBefore = bal;
      const over = budgetRefusal({ start: rec.balance.start, now: bal, budget: scenario.budget });
      if (over) { stop(`step ${n}`, `${over} — nothing more is sent`); break; }
      const short = n === 1 && scenario.fundsFirst === true ? fundsRefusal({ now: bal, budget: scenario.budget }) : "";
      if (short) { stop(`step ${n}`, `${short} — nothing is sent`); break; }
      // THE HARD CAP (2026-10-06): no more in the account than the press may spend.
      const capped = n === 1 ? capRefusal({ now: bal, cap: scenario.cap }) : "";
      if (capped) { stop(`step ${n}`, `${capped} — nothing is sent`); break; }
      // A PRESS THAT JUDGES WHAT IS SHOWN WHILE THE WORK RUNS sends nothing to a
      // Worker that does not narrate (`progressOnRefusal`, read for free).
      if (n === 1 && scenario.expect && scenario.expect.progress === true) {
        const listed = typeof requestsNow === "function" ? await Promise.resolve().then(() => requestsNow()).catch(() => null) : null;
        const off = progressOnRefusal(listed);
        r.progressOn = !off;
        if (off) { stop(`step ${n}`, `${off} — nothing is sent`); break; }
      }
      // A LATER MESSAGE GOES FROM THE TAB THE RUN OPENED, or not at all: a page
      // that reloaded or left since would make it a first message somewhere
      // else, whatever it says.
      if (n > 1) {
        r.tabAtSend = await page.evaluate(tabMarkInPage).catch(() => null);
        if (!sameTab(rec.tab, r.tabAtSend)) {
          stop(`step ${n}`, `the page is no longer the tab the run opened (it reloaded or left), so message ${n} is NOT sent`);
          break;
        }
      }

      const before = typed.messages.length;
      const netFrom = rec.network.length;
      const sentAt = r.sentAt = Date.now();
      current = step;
      await page.click("#stSend");
      rec.sent++;
      r.sent = true;
      const started = await until(page, (s) => s.busy === true || s.stop || newReplies(before, s.messages).length > 0 || !!requestKeyOf(rec.network.slice(netFrom)), startMs);
      r.startedMs = started.ok ? Date.now() - sentAt : null;
      const done = r.mode === "away"
        ? await followAway(page, { before, netFrom, step, r, ms: r.boundMs })
        : r.mode === "fresh"
          ? await followFresh(page, { netFrom, step, r, ms: r.boundMs })
          : await followStep(page, { before, netFrom, step, r, ms: r.boundMs });
      // THE TAB A CLOSED-TAB MESSAGE IS READ IN is the one opened afterwards.
      if (done.page) page = done.page;
      // AND A LATER MESSAGE GOES FROM THAT TAB (2026-10-05, the live check of
      // the page's refresh): once a closed-tab message has been shown ended in
      // the tab opened afterwards, that tab is marked as the run's, and every
      // later message must go from it, never reloaded or left since
      // (`sameTab`). The first tab's mark stays on the record (`tabs`).
      if ((r.mode === "away" || r.mode === "fresh") && done.ok && i + 1 < scenario.steps.length) {
        rec.tabs = [rec.tab];
        rec.tab = await page.evaluate(markTabInPage, crypto.randomBytes(12).toString("hex")).catch(() => null);
        rec.tabs.push(rec.tab);
      }
      r.ms = Date.now() - sentAt;
      // A REQUEST'S OWN REPLIES, SETTLED AND ON SCREEN, before anything is
      // judged or sent next (2026-10-05; `watchReplies`). The jobs an earlier
      // message of the same request was judged on are not waited for again.
      if (done.ok && r.request && r.request.key) {
        const earlier = new Set(rec.steps.filter((x) => x !== r).flatMap((x) => (x.replyWatch && Array.isArray(x.replyWatch.jobs) ? x.replyWatch.jobs.map((j) => j.job) : [])));
        const w = await watchReplies(page, r, { key: r.request.key, earlier, end: Math.max(sentAt + r.boundMs, Date.now() + replyFloorMs) });
        r.replyWatch = w.watch;
        if (w.s) done.s = w.s;
      }
      await sleep(settleMs);
      const after = done.s || (await page.evaluate(readComposerInPage).catch(() => null));
      // AND AS THE PAGE HAS THEM ONCE THE MESSAGE IS DONE: in the tab opened
      // afterwards, for a message sent with its tab closed.
      r.view = pageViewOf(after);
      if (r.replyWatch) {
        // THE MESSAGE'S OWN REPLIES ON SCREEN, in the thread's order — and,
        // kept apart, every other reply drawn after the message (another
        // request's): none is, since each request's replies go with it
        // (2026-10-05; the live check judges it, `liveChecks`).
        const msgs = after && Array.isArray(after.messages) ? after.messages : [];
        const mine = new Set(r.replyWatch.attributed);
        r.replies = r.replyWatch.attributed.map((i) => (msgs[i] ? msgs[i].text : "")).filter(Boolean);
        let from = -1;
        msgs.forEach((m, i) => { if (m && m.who === "u" && m.text === step.say) from = i; });
        r.otherReplies = msgs.filter((m, i) => i > (from >= 0 ? from : before - 1) && m && m.who === "a" && !m.card && !m.busy && !m.holding && !mine.has(i)).map((m) => m.text);
        // THE THREAD AS IT STANDS, by who said each line and the job a reply is
        // marked with, and where this message is on it (`liveChecks`).
        r.at = from;
        r.thread = msgs.map((m) => ({ who: m && m.who === "u" ? "u" : "a", card: !!(m && m.card), job: m && typeof m.job === "string" ? m.job : "", text: String((m && m.text) || "").slice(0, 80) }));
      } else {
        r.replies = after ? newReplies(before, after.messages).map((m) => m.text) : [];
      }
      r.reply = r.replies.join("\n");
      r.composer = after ? { busy: after.busy, send: after.send, sendDisabled: after.sendDisabled, stop: after.stop, working: after.working, disabled: after.disabled, value: after.value } : null;
      r.network = rec.network.slice(netFrom);
      // EVERY JOB THE MESSAGE FILED, IN ORDER. An edit the route hands to
      // another layer is a second edit request with a job of its own, and
      // following only the first would read the chain and the money short.
      // A REQUEST'S are the server's, every one its own view names — and a
      // later message of the same request (an answer) names only the jobs an
      // earlier message did not, so no job is read, or charged, twice.
      const earlier = new Set(rec.steps.filter((x) => x !== r).flatMap((x) => (Array.isArray(x.jobs) ? x.jobs : [])));
      r.jobs = r.request ? requestJobsOf(r.request.final).filter((id) => !earlier.has(id)) : r.network
        .filter((e) => e.method === "POST" && /\/(edit|addon)$/.test(e.path) && e.res && typeof e.res.job === "string" && e.res.job)
        .map((e) => e.res.job);
      r.job = r.jobs[0] || "";
      r.routing = routingEvidence(r);
      r.completed = done.ok;
      if (!done.ok) {
        await shot(page, `ui-step-${n}`);
        const mins = Math.max(1, Math.round(r.boundMs / 60000));
        stop(`step ${n}`, done.why
          ? `${done.why} — the outcome is unknown, and nothing more is sent`
          : `no reply with an idle composer inside ${mins} minute${mins === 1 ? "" : "s"} — the outcome is unknown, and nothing more is sent`);
        break;
      }
      // USABLE, NOT MERELY DRAWN: the box takes typing and Send is live.
      await page.fill("#stRevise", "x");
      const probe = await page.evaluate(readComposerInPage);
      r.usable = probe.value === "x" && composerReady(probe);
      await page.fill("#stRevise", "");
      r.balanceAfter = await balanceNow();
      r.tab = await page.evaluate(tabMarkInPage).catch(() => null);
      r.sameTab = sameTab(rec.tab, r.tab);
      // A MESSAGE THAT MUST FAIL is judged at once, and the table is read
      // against the baseline before anything else is sent: a failure that
      // changed something is not the one a follow-up is sent after.
      if (step.fails) r.failure = failureVerdict(r, step.fails);
      if (spec && step.fails && rec.row.baseline) {
        r.rowsAfter = await readBoth(rowIo);
        r.untouched = untouchedVerdict(rec.row.baseline, r.rowsAfter);
      }
      await shot(page, `ui-step-${n}`);
      log(`  step ${n} (${Math.round(r.ms / 1000)} s): ${r.reply.split("\n")[0].slice(0, 160)}  | composer ${r.usable ? "usable again" : "NOT usable"}${r.job ? `  | job ${r.job}` : ""}`);
      // A REQUEST-MODE SCENARIO'S MESSAGE MUST BE TAKEN ON AS A REQUEST (or,
      // for one that ends on a question, may meet the router's own question).
      // One that was not went the old way, which the wall refused: the switch
      // is not live, or the message was answered another way, and nothing more
      // is sent.
      if (scenario.request === true && !r.request && !(r.question && r.question.by === "router")) {
        stop(`step ${n}`, `message ${n} was not taken on as a request (the switch is not live, or it was answered another way) — nothing more is sent`);
        break;
      }
      // A MESSAGE WHOSE NEXT ONE ANSWERS ITS QUESTION, which never came (the
      // request ended without asking): that answer would be a new message
      // about nothing, so it is not sent.
      if (r.mode === "question" && !r.question) {
        stop(`step ${n}`, `message ${n} ended without the question message ${n + 1} answers — message ${n + 1} is NOT sent`);
        break;
      }
    }
    // ── WHAT THE MESSAGE DID TO THE ROW, AND PUTTING IT BACK ───────────────
    // Only once every message that was sent has its reply on screen: the job
    // behind a reply has finished, so its write, if any, has landed. A reply
    // that never came leaves the outcome unknown, and writing then could race
    // the job — so nothing is written, and the recovery run is named instead.
    if (spec && rec.row.baseline && spend) {
      const sentSteps = rec.steps.filter((s) => s.sent);
      if (!sentSteps.length) {
        rec.row.restore = { skipped: "nothing was sent, so there is nothing to put back" };
      } else if (!sentSteps.every((s) => s.completed)) {
        rec.row.restore = { skipped: spec.restore === false
          ? "a reply never came, so what the edit did is not known yet — and nothing is written either way: this run keeps the row"
          : `a reply never came, so whether the edit wrote the row is not known yet — once its job has finished, run the recovery scenario, which writes ${spec.field} back only if it reads ${spec.to}` };
      } else {
        const base = rec.row.baseline;
        const after = rec.row.after = await readBoth(rowIo);
        rec.row.change = after.owner.ok ? changeVerdict(base.owner.rows, after.owner.rows, spec) : null;
        rec.row.visitorChange = after.pub.ok ? changeVerdict(base.pub.rows, after.pub.rows, spec) : null;
        const edited = rec.row.shown.afterEdit = await shown();
        edited.verdict = rec.row.shown.before.ok && edited.ok
          ? shownVerdict(rec.row.shown.before.lines, edited.lines, spec, spec.shown.after)
          : { ok: false, why: edited.ok ? "no-before" : edited.why };
        for (const v of rec.row.also || []) {
          const e = v.afterEdit = await shown(v.path);
          e.verdict = v.before.ok && e.ok ? shownVerdict(v.before.lines, e.lines, spec, spec.shown.after) : { ok: false, why: e.ok ? "no-before" : e.why };
        }
        if (spec.restore === false) {
          rec.row.restore = { skipped: "no recovery: this run keeps what the message changed (the owner's demo-site rule, 2026-09-30)" };
          log(`  row: ${rec.row.change ? (rec.row.change.exact ? "the one expected change" : "NOT exactly the expected change") : "UNREADABLE after the edit"}; kept, no recovery`);
        } else {
          rec.row.restore = await restoreRow({ spec, base, after, readers: rowIo, patch: rowIo.patch });
          const back = rec.row.shown.afterRestore = await shown();
          const same = JSON.stringify(back.lines) === JSON.stringify(rec.row.shown.before.lines);
          back.verdict = back.ok && same ? { ok: true, exact: true } : { ok: false, why: back.ok ? "differs-from-before" : back.why };
          log(`  row: ${rec.row.change ? (rec.row.change.exact ? "the one expected change" : "NOT exactly the expected change") : "UNREADABLE after the edit"}; recovery ${rec.row.restore.plan ? rec.row.restore.plan.act : "-"}${rec.row.restore.verdict ? (rec.row.restore.verdict.restored ? ", restored" : ", NOT restored") : ""}`);
        }
      }
    }
    // ── THE RULES TEST: WAS IT CLOSED, AND DOES A REAL BOOKING GET REFUSED ──
    // Only once the message's reply is on screen, so the job has finished. The
    // booking is submitted only when the job's own stored reply is a rules
    // success that closed the table by a supported way and the owner's listing
    // agrees; otherwise nothing is submitted. Then the owner's view is read
    // again, and a row carrying this run's marker — if the rule failed — is
    // deleted only with the owner's approval, and only that row.
    if (rspec && rec.rules.before && spend) {
      const sentSteps = rec.steps.filter((s) => s.sent);
      if (!sentSteps.length) {
        rec.rules.booking = { skipped: "nothing was sent" };
      } else if (!sentSteps.every((s) => s.completed)) {
        rec.rules.booking = { skipped: "a reply never came, so whether the rule changed is not known — no booking was submitted" };
      } else {
        const t = await Promise.resolve().then(() => rulesIo.tables()).catch(() => null);
        rec.rules.closing = closingVerdict({ stored: finalReplyOf(sentSteps[0]), before: rec.rules.before.tables, after: tablesOf(t), spec: rspec });
        if (!rec.rules.closing.ok) {
          rec.rules.booking = { skipped: `the reply is not a rules success that closed ${rspec.table} (${rec.rules.closing.why}), so no booking was submitted` };
        } else {
          const b = rec.rules.booking = await book(true);
          const first = b.posts[0];
          // A booking stopped in the tab never reached the database: nothing
          // was tested, so it is inconclusive, never read off the browser's
          // own "blocked" failure as though the site had answered.
          rec.rules.bookingVerdict = !(b.pressed && first)
            ? { verdict: "inconclusive", why: b.why || "no booking request was made" }
            : first.sent !== true
              ? { verdict: "inconclusive", why: `the booking was never sent: ${first.stopped || "it was stopped in the browser"}` }
              : classifyBooking(b.response || { failed: b.failed }, rspec);
        }
        rec.rules.after = await readRulesState(rulesIo, rspec, { secrets: false });
        rec.rules.insertion = insertionVerdict(rec.rules.before.census, rec.rules.after.census, rec.rules.marker);
        if (rec.rules.insertion.readable && rec.rules.insertion.markers.length) {
          rec.rules.cleanup = await rulesCleanup(rulesIo, rec.rules, rspec);
        }
        log(`  rules: ${rec.rules.closing.ok ? "closed by " + rec.rules.closing.method : "NOT CLOSED"}; booking ${rec.rules.bookingVerdict ? rec.rules.bookingVerdict.verdict.toUpperCase() : "not submitted"}; rows ${rec.rules.insertion.readable ? (rec.rules.insertion.ok ? "none added" : rec.rules.insertion.why) : "UNREADABLE"}`);
      }
    }
    rec.balance.end = await balanceNow();
    rec.balance.endAt = new Date().toISOString();
    return rec;
  } finally {
    await browser.close().catch(() => {});
  }
}

/** The account a person reads: each message, its reply, the composer, the money. */
export function describeUi(rec) {
  const out = [];
  const recovery = !!(rec.row && rec.row.recovery);
  out.push(recovery
    ? `UI MODE — a row recovery on site ${rec.slug}, no app and no message, ${rec.spend ? "WRITES" : "a dry run (nothing written)"}`
    : `UI MODE — ${rec.base}, site ${rec.slug}, ${rec.spend ? "PAID" : "rehearsal (nothing sent)"}`);
  if (!recovery) out.push(`  opened: ${rec.opened ? `signed in ${rec.opened.signedIn} as ${rec.opened.uid || "?"}${rec.opened.gate ? ", SIGN-IN GATE SHOWN" : ""}` : "no"}  card ${rec.card || "(none)"}`);
  for (const s of rec.steps) {
    out.push(`  ${s.n}. "${s.say}"${s.attach ? `  [attached ${s.attach}${s.file ? `, ${s.file.bytes} b, sha256 ${s.file.sha256.slice(0, 16)}` : ""}${s.attached === false ? ", DID NOT LAND" : ""}]` : ""}`);
    if (!s.sent) { out.push(s.dependency && !s.dependency.ok ? `     not sent: ${s.dependency.why}` : "     not sent"); continue; }
    out.push(`     reply (${Math.round((s.ms || 0) / 1000)} s): ${s.reply ? s.reply.replace(/\n/g, " / ") : "(none)"}`);
    out.push(`     composer after: ${s.usable ? "usable again (took typing, Send live)" : "NOT usable"}  ${JSON.stringify(s.composer)}`);
    const route = (s.network || []).find((e) => e.path === "/api/site/route" && e.res);
    if (route) out.push(`     routed: ${route.status} ${JSON.stringify({ intent: route.res.intent, layer: route.res.layer, page: route.res.page, cost: route.res.cost })}  attached=${route.req && route.req.attached}`);
    for (const post of (s.network || []).filter((e) => e.method === "POST" && /\/(edit|addon)$/.test(e.path))) {
      const job = post.res && typeof post.res.job === "string" ? post.res.job : "";
      out.push(`     ${post.path} -> ${post.status}${post.req && post.req.layer ? ` layer ${post.req.layer}` : ""}${job ? ` job ${job}` : ""}${post.req && post.req.images ? `  images ${JSON.stringify(post.req.images)}` : ""}`);
    }
    if (s.request) {
      const f = s.request.final;
      out.push(`     request ${s.request.key}: ${f ? `${f.state}${f.ended ? ", ended" : ", NOT ended"} — ${(f.parts || []).map((p) => `${p.n}:${p.status}${p.route ? "@" + p.route : ""}`).join(" ")}` : "its view was never read"}  jobs ${(s.jobs || []).join(", ") || "none"}`);
      if (s.request.wall) out.push(`     STOPPED BY THE WALL at part ${s.request.wall.n}: ${s.request.wall.why} (stop ${s.request.stop ? s.request.stop.status + " " + (s.request.stop.state || "") : "not answered"})`);
    }
    // ITS OWN REPLIES, WATCHED TO THEIR END (`watchReplies`).
    if (s.replyWatch) {
      const w = s.replyWatch;
      const said = (j) => `${j.job} ${j.state}${j.state === "question" ? (j.asked ? ", on screen" : ", NOT on screen") : j.holding ? ", still held on screen" : j.shown ? ", on screen" : ", NOT on screen"}` +
        `${Number.isFinite(j.pendingMs) ? ` (pending at ${Math.round(j.pendingMs / 1000)} s${Number.isFinite(j.settledMs) ? `, settled at ${Math.round(j.settledMs / 1000)} s` : ""})` : ""}`;
      out.push(`     replies, watched ${Math.round((w.ms || 0) / 1000)} s after the request${w.timedOut ? " — THE TIME RAN OUT" : ""}: ${(w.jobs || []).map(said).join("; ") || "none owed"}` +
        `${w.request ? `; the request's own: ${w.request.state}${w.request.shown ? ", on screen" : ""}` : ""}`);
      if (Array.isArray(s.otherReplies) && s.otherReplies.length) out.push(`     also drawn after the message, not this request's (judged by the live check alone): ${s.otherReplies.length}`);
    }
    // THE ROUTING EVIDENCE, FROM THIS VERY MESSAGE (`routingEvidence`).
    if (s.routing) {
      const g = s.routing;
      const d = g.decision || {};
      out.push(`     routing: ${g.intent || "?"}${g.layer ? "/" + g.layer : ""}${g.page ? " " + g.page : ""} (${d.source || "source unread"}${d.raw ? ", the model said " + JSON.stringify(d.raw) : ""})` +
        `${g.alsoAsked.length ? `; held back ${JSON.stringify(g.alsoAsked)}` : ""}${g.dependsOn.length ? `; order ${JSON.stringify(g.dependsOn)}` : ""}${g.resumed ? `; resumes ${JSON.stringify(g.resumed)}` : ""}`);
      if (g.final.length) out.push(`     parts: ${g.final.map((p) => `${p.n} "${String(p.words || "").slice(0, 60)}" ${p.status}${p.route ? "@" + p.route : ""}${p.addition ? " (handed over by the add-on step)" : ""}`).join("; ")}`);
    }
    if (s.question) out.push(`     question (${s.question.by === "router" ? "the router's own, no request opened" : `part ${s.question.part}'s, from its step`}): ${JSON.stringify(s.question.text)}`);
    else if (s.mode === "question") out.push("     NO QUESTION was asked");
    if (s.away) {
      const a = s.away;
      out.push(`     away: tab ${a.closed ? "closed" : "NOT closed"}; the requests list read ${a.reads} time(s)` +
        `${a.ended ? `; ended ${Math.round((a.endedMs || 0) / 1000)} s after the tab closed` : "; NOT ended while away"}` +
        `; reads of the request's own route while away: ${Array.isArray(a.calls) ? a.calls.length : "unwatched"}` +
        `; the tab opened afterwards ${a.reopened ? (a.reopened.closed ? "showed it ended" : "did NOT show it ended (" + a.reopened.why + ")") : "was never opened"}` +
        // ITS OWN FIRST ADDRESS, the baseline its preview is judged against (2026-10-05).
        (a.reopened && a.reopened.firstFrame !== undefined ? `; its preview first asked for ${a.reopened.firstFrame || "nothing that was seen"}` : ""));
    }
    // A MESSAGE READ AFTERWARDS IN A FRESH BROWSER SESSION (`away: "fresh"`,
    // 2026-10-06): the first line and when, the close, the list while no page
    // was open, the fresh session, and every distinct line and part's words
    // the customer was shown — written out whole, as the model wrote them.
    if (s.fresh) {
      const f = s.fresh;
      const sec = (ms) => `${Math.round((Number(ms) || 0) / 1000)} s`;
      out.push(`     progress: ${f.first ? `first line on screen ${sec(f.first.ms)} after the send, part ${f.first.part} (${f.first.status}): ${JSON.stringify(f.first.line)}` : "NO line was on screen before the tab closed"}`);
      out.push(`     fresh: the sending tab ${f.closed ? `closed ${sec(f.closedMs)} after the send, the request ${f.closedRunning ? "still running" : "ALREADY ENDED"}` : "NOT closed"}` +
        `; the requests list read ${f.away.reads} time(s) with no page open${f.away.ended ? " (it ended meanwhile)" : ""}; reads of the request's own route then: ${f.away.calls.length}` +
        `; the fresh session ${f.reopened ? (!f.reopened.ok ? `did NOT open (${f.reopened.why})` : `${f.reopened.found ? "found its card" : "NEVER drew its card"}${f.reopened.closed ? " and showed it closed" : ` (${f.reopened.why || "not closed"})`}; a new session for the same account: ${f.reopened.newSession && f.reopened.sameAccount ? "yes" : "NO"}`) : "was never opened"}`);
      const seen = [];
      for (const [where, list] of [["sending tab", f.before], ["fresh session", f.after]]) {
        for (const snap of Array.isArray(list) ? list : []) {
          for (const p of snap.parts || []) {
            for (const l of p.lines || []) if (!seen.some((x) => x.part === p.n && x.line === l)) seen.push({ where, ms: snap.ms, part: p.n, line: l });
            const shown = `words ${p.status} ${p.words}`;
            if (p.words && !seen.some((x) => x.part === p.n && x.line === shown)) seen.push({ where, ms: snap.ms, part: p.n, line: shown });
          }
        }
      }
      for (const x of seen) out.push(`       ${sec(x.ms).padStart(6)}  part ${x.part}  ${x.where.padEnd(13)}  ${x.line.startsWith("words ") ? "shown as: " + x.line.slice(6) : "line: " + x.line}`);
    }
    // THE PREVIEW AND THE PAGE'S OWN LISTS, BEFORE THE SEND AND ONCE DONE (2026-10-05).
    if (s.typed || s.view) {
      const t = s.typed || {}, v = s.view || {};
      const list = (l) => (Array.isArray(l) ? l.join(", ") || "none" : "unread");
      out.push(`     preview ${t.frame || "unread"} -> ${v.frame || "unread"}; the page's pages: ${list(v.pages)}; its tables: ${list(v.tables)}`);
    }
    const fin = (s.network || []).filter((e) => e.final);
    if (fin.length) out.push(`     final reply: ${fin[fin.length - 1].status} ${JSON.stringify(fin[fin.length - 1].res).slice(0, 400)}`);
    if (s.failure) out.push(`     failure: ${s.failure.ok ? `${s.failure.error}, shown as a warning, the edit's own cost ${s.failure.cost}` : "NOT the failure this message must be — " + s.failure.why}`);
    if (s.untouched) out.push(`     the table after it: ${s.untouched.ok ? "the baseline, on both readers, byte for byte" : "NOT the baseline — " + s.untouched.why + (s.untouched.detail ? ": " + s.untouched.detail : "")}`);
    if (s.tabAtSend || s.tab) out.push(`     tab: ${s.tabAtSend ? (sameTab(rec.tab, s.tabAtSend) ? "sent from the tab the run opened" : "NOT the tab the run opened at the send") + "; " : ""}${s.sameTab ? "the reply read in that same tab, never reloaded" : "the reply NOT read in the tab the run opened"}`);
    if (Number.isFinite(s.balanceBefore) && Number.isFinite(s.balanceAfter)) out.push(`     balance ${s.balanceBefore} -> ${s.balanceAfter}`);
  }
  for (const b of rec.blocked || []) out.push(`  BLOCKED ${b.method} ${b.path}: ${b.why || "the page tried to start work this scenario never asks for"}`);
  if (Array.isArray(rec.frameLoads) && rec.frameLoads.length) out.push(`  preview loads: ${rec.frameLoads.map((f) => `tab ${f.tab} ${f.path}`).join("; ")}`);
  if (rec.row && rec.row.spec) {
    out.push(rec.row.recovery ? describeRecovery(rec.row.recovery, rec.row.spec, { write: rec.spend, capability: rec.row.capability }) : describeRows(rec.row, rec.row.spec));
    if (rec.row.recovery) {
      for (const [k, label] of [["before", "before  "], ["afterRestore", "restored"]]) {
        const sh = rec.row.shown && rec.row.shown[k];
        if (sh) out.push(`  shown      ${label}  ${sh.ok ? sh.url + " (" + (sh.version || "?") + "): " + sh.target : "UNREADABLE (" + sh.why + ")"}${sh.verdict ? (sh.verdict.ok ? "  ok" : "  FAIL " + sh.verdict.why) : ""}`);
      }
    }
  }
  if (rec.rules) out.push(describeRules(rec.rules));
  if (rec.stopped) out.push(`  STOPPED at ${rec.stopped.at}: ${rec.stopped.msg}`);
  out.push(recovery
    ? `  balance ${rec.balance.start} -> ${rec.balance.end}`
    : `  sent ${rec.sent} of ${rec.steps.length ? rec.steps.length : 0} reached; balance ${rec.balance.start} -> ${rec.balance.end}`);
  out.push(`  console errors ${rec.consoleErrors.length}, page errors ${rec.pageErrors.length}`);
  return out.join("\n");
}
