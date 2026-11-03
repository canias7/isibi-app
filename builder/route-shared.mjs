// THE ROUTING PIECES THE LIVE CODE STILL USES (2026-11-03, park-old-way).
// The router itself (`routeMessage`, its prompt, digest and scope) is parked in
// parked/old-way/builder/site-ask.mjs. What the agent path, the request engine,
// the question store and the replies still read came out of that file
// unchanged and lives here: the waiting-question shape (`readAsk`,
// `usableAsk`), the routing answer shapes (`routeDecision`, `routeFailure`),
// the edit layers' names, the context and held-back helpers, and the word
// spans. Nothing here calls a model.
import { DEVICES_FIELD } from "./device-scope.mjs";
import { MAX_INPUT_CHARS, MAX_CARRIED_CHARS } from "./input-budget.mjs";
import { isXaiModel } from "./model-xai.mjs";


/**
 * A FIRST BUILD'S QUESTION: two to four answers, the words at most
 * `MAX_QUESTION_CHARS` and each answer `MAX_OPTION_CHARS` (`readQuestion`, the
 * build's own reader, unchanged). `MAX_OPTIONS` is also what every question's
 * tool TELLS a model to offer at most (the guidance, kept). A question on a
 * site that exists is never cut to these and never loses an answer
 * (`readAsk`, 2026-10-03).
 */
export const MIN_OPTIONS = 2;
export const MAX_OPTIONS = 4;

/**
 * The three things an edit can be, and they are three because they cost three
 * different amounts and touch three different files.
 *
 * `data`   — the content the site STORES: a price, a menu item, an opening time.
 *            The cheapest of all — rows are read at runtime, so nothing is even
 *            recompiled. Found by audit: those words are not in the page source,
 *            so before this layer existed the commonest request a small business
 *            has fell through all three rungs and changed nothing.
 * `text`   — the words only. No page model call at all; the strings are lifted
 *            out of the stored source and put back.
 * `look`   — colour, theme, fonts, corners, the name, the description, the
 *            declared language. The designer already knows how to do this
 *            without regenerating a single page, which is the whole saving.
 * `page`   — one existing page's structure. One page through the pages model
 *            rather than all of them.
 * `logo`   — the business's own artwork at the top of every page. The
 *            ATTACHMENT is which picture, so nothing has to be matched and no
 *            model writes a line; the URL is read at compile time.
 *
 * An unrecognised layer is not a fourth option, it is a routing failure, and it
 * goes UP the ladder like every other one.
 */
// `rename` JOINED 2026-08-29 — a site's address, which is a platform record and
// not a value on the look, so it is a rung of its own rather than an edit lane.
export const EDIT_LAYERS = ["data", "text", "look", "page", "rules", "picture", "logo", "nav", "rename"];

/**
 * The layers where "take it away" is a thing a customer can ask for.
 *
 * Named rather than left implicit because `remove` is read once for every layer
 * and it must not leak to the ones that have no removal path — a `data` edit
 * carrying `remove: true` would be a flag nothing acts on, which is how this
 * repo's dead features start. The tool schema's own `remove` description names
 * exactly these two, and a test holds the two lists together.
 */
export const REMOVABLE_LAYERS = ["page", "logo", "picture", "nav"];

/**
 * OF THOSE, THE TWO WHOSE OWN RUNG ANSWERS THE FLAG.
 *
 * `page` deletes the whole page; `logo` takes the mark off. Both are cheap,
 * both work, and both have been measured — so a removal that lands on either
 * is answered where it lands and must NOT be re-routed.
 *
 * The other removable layers have no removal of their own: `picture` swaps and
 * reframes, `nav` rewrites. A removal there opens the lane door instead
 * (`eLooking` in worker.js), where `pick_lanes` names the field, `mergeLook`
 * clears what is stored, and the ask still reaches the same rung.
 *
 * ── WHY `page` IS NOT ON THIS WIDENING, AND MUST NEVER BE ──────────────────
 *
 * Four removable lanes dispatch to `page` (`components`, `shape`, `three`,
 * `tsx`), so it looks like the layer that most needs the flag. It is the one
 * layer that must not have it widened: `remove` on `page` means DELETE THE
 * WHOLE PAGE — measured three times, and the field's own description spends a
 * paragraph making that unmissable. Widen it to mean "take something off" and
 * "take the 3D scene off the home page" deletes the home page. Those four
 * reach the lane door by the LAYER answer instead (the `look` clause in the
 * layer description), never by this flag.
 */
export const OWN_REMOVAL_LAYERS = ["page", "logo"];

/**
 * THE LAYERS A REMOVAL OPENS THE LANE DOOR FROM — derived, never listed.
 *
 * `REMOVABLE_LAYERS` less the two that answer the flag themselves, which is the
 * whole rule and is therefore worth computing rather than writing down: a third
 * layer added to either list moves this one with it.
 *
 * IT IS THE POSITIVE HALF THAT MATTERS, and a guard found out why. The door in
 * `worker.js` first asked only `!OWN_REMOVAL_LAYERS.includes(layer)` — and the
 * route reads `remove` off the REQUEST BODY, not off `readEdit`'s answer, so a
 * hand-made POST of `{layer: "data", remove: true}` opened it. `data` deletes
 * its own rows; sending one into the lane picker finds no lane. Asking this
 * list instead means the door opens for exactly the layers the flag is read
 * for, whoever sent it.
 */
export const DOOR_LAYERS = REMOVABLE_LAYERS.filter((l) => !OWN_REMOVAL_LAYERS.includes(l));

export const ASK_TOOL = {
  name: "route_message",
  description: "Say whether this message is asking for a change to the site or asking a question, answer it if it is a question, and ask for the one thing you most need to know if this is a first build and the brief leaves it open.",
  input_schema: {
    type: "object",
    properties: {
      intent: {
        type: "string",
        enum: ["build", "ask", "clarify", "edit", "addon"],
        description:
          "\"ask\" if the message is conversation rather than a request for work: a question, a greeting, a thank-you, an " +
          "idea or plan they are thinking through, a request for suggestions or a comparison, talk about files they attached, " +
          "or a side question while one of ours waits — anything that does not ask for a change to be made now. Talking " +
          "about a change (\"what would a booking page need?\", \"should I add a gallery?\") is not asking for it. " +
          "When it is genuinely both — a question AND a change — answer with the work, because the reply says what was done " +
          "anyway and the customer would rather have the work than the explanation.\n" +
          "NEVER ANSWER \"ask\" TO CHECK THAT THEY MEANT IT. A request to take something away — a page, a section, a row, " +
          "the logo — is an instruction, not an opening bid, and answering it with \"are you sure?\" is the single worst " +
          "thing you can do here: there is no yes button, so it reads as the builder refusing to work. Every change is " +
          "archived and every one can be undone by saying so, which is what makes acting the safe choice. Do the work.\n\n" +
          "\"clarify\" when you are told below that this is a first build with questions remaining, the message describes a " +
          "site to build, AND the answer would change what gets built. Only two things do that: what the business actually " +
          "IS, and what visitors DO on the site. If the brief already answers both, say \"build\" even with questions left — " +
          "a question whose answer changes nothing costs them a minute and they came here to see a site. Never on a change " +
          "to a site that already exists.\n\n" +
          "THE OTHER THREE ARE WORK, AND WHICH ONE DEPENDS ENTIRELY ON WHETHER THE SITE ALREADY EXISTS. You are told below.\n" +
          "\"build\" — there is no site yet and they are describing one to make. On a site that ALREADY EXISTS, use this only " +
          "when they want the whole thing thrown away and remade as something else: a different business, a different purpose. " +
          "It is the most expensive answer there is and it rewrites every page, so it is never the answer to a change.\n" +
          "\"edit\" — changing something the site ALREADY HAS. Different wording, a different colour or theme or font, a " +
          "section of an existing page laid out differently, something taken away.\n" +
          "TAKING A WHOLE PAGE OFF THE SITE IS AN EDIT — \"remove the gallery page\", \"we don't need the about page any " +
          "more\" — with layer \"page\", that page named, and `remove` true. It is not an \"addon\" and it is certainly " +
          "not a question.\n" +
          // ADDING IS THE ADDON STEP — owner, 2026-09-02: "add will always go in
          // addon". This used to say the opposite ("sounds like an addon and is
          // an EDIT"), drawing the line at the PAGE: a section on an existing
          // page was an edit. The owner's line is at the THING: does what they
          // name exist on the site now? The one carve-out is the owner's too —
          // the page's own code always exists, so changing a component is an
          // edit ("tsx does exist, it is literally everything on the page").
          "\"addon\" — ADDING SOMETHING THE SITE DOES NOT HAVE YET. A page it has no page for, a table it needs to STORE " +
          "something it has no table for, or a section, a QR code, a 3D scene, a form or a map on a page. The page " +
          "existing does not make it an edit: \"Add a testimonials section to the home page\" is an addon, because the " +
          "section does not exist yet. SOMETHING THE SITE DOES that it does not do yet is an addition too — text the " +
          "owner when someone books, a chatbot on the owner's AI key, payments through PayPal, a daily reminder, a " +
          "limit on bookings: the site's own server code is written for it.\n" +
          // ── THE FRAME, A LINE OF WORDS AND A PHOTOGRAPH ARE ADDITIONS TOO (2026-10-02) ──
          //
          // Run 90 (A1–A5): a footer link, a menu link, a header button, a line
          // on a page and a photograph on a page, each asked for as an
          // addition, all came back `edit` — because the `nav`, `picture` and
          // `page` clauses below gave additions as their own examples, against
          // this clause and the tie-break. The owner: *"Make the router
          // consistently treat new menu links, footer links, header buttons,
          // page text and photos as additions."* The add-on step now delivers
          // each one (`frame`, `words`, `photo` in `site-add.mjs`), so it is
          // said here, at the tie-break, under `edit`, and in each layer that
          // used to claim it — the four places a model reading downwards meets.
          "A NEW ITEM IN THE FRAME EVERY PAGE SHARES IS AN ADDITION TOO, and so are NEW WORDS and a NEW PHOTOGRAPH on a " +
          "page: a link added to the menu, a social or small-print link added to the footer, a contact detail added at " +
          "the bottom, a button added at the top, a line or a sentence added to a page, and a photograph added to a page " +
          "— even one that shows some already — are all \"addon\". \"Put Gallery in the menu\", \"add our Facebook " +
          "at the bottom\", \"add a Book now button at the top\", \"add a line about parking to the contact page\" " +
          "and \"put a photo of the team on the about page\" are each an addon: the menu, the footer, the header and " +
          "the page exist, and the link, the button, the line and the photograph do not.\n" +
          // ── A NEW ENTRY IN A LIST THE SITE ALREADY KEEPS IS AN ADDITION (owner, 2026-10-01) ──
          //
          // Run 86 (Test 11): a new entry for a list the site stores came back
          // `edit` + `data`. Nothing here said where a new row goes, and three
          // sentences pointed at `data`: the tie-break below asked whether "the
          // thing they name" exists, and the list did; the data clause said to
          // prefer it for "one row of something the site lists"; and the
          // system's cost rule said to pick the cheapest answer. The owner:
          // *"Adding a NEW record to an existing table/list must select addon.
          // The parent list already existing does not make the new item an
          // edit."* Said for every kind of list, never by a table's name or a
          // word in the message, and said four times: here, at the tie-break,
          // in the data clause and in the system's cost rule, because a model
          // reading downwards meets whichever one its candidate answer is.
          // Changing or deleting an entry that exists stays `edit` + `data`.
          "A NEW ENTRY IN A LIST THE SITE ALREADY KEEPS IS AN ADDITION TOO: a new product, service, dish, class, event " +
          "or team member is a new row in a table the site already has. The list existing does not make it an edit, " +
          "for the same reason: \"add a new service to our list\" and \"put our new apprentice on the team page\" are " +
          "both \"addon\", because that entry does not exist yet.\n" +
          // THE BACKEND IS THE ADDON'S TOO (owner, 2026-09-03): a first build
          // sends none of it, so every function, outside connection and
          // scheduled job a site gets is added after the build — and the
          // first of any of them on a site with no database makes one.
          "SO IS ANYTHING THE SITE'S DATABASE HAS TO DO THAT IT DOES NOT DO YET: a lookup or a cancel a page needs " +
          "(a database function), something read live from an outside service — an exchange rate, a courier's " +
          "slots, the weather — or something that happens ON A TIMER with nobody there: a reminder the day before, " +
          "a weekly digest, clearing out old records. A site with no database gets one the first time any of these is added.\n" +
          "\"edit\" is for what the site ALREADY HAS, changed, moved or taken away: its words, colours, stylesheet, the " +
          "button and the menu items it has, the pictures it shows, languages, what a control does — and its own code. " +
          "Changing a component is an edit, because the page's code always exists. A NEW link, button, line or " +
          "photograph put beside the ones it has is not an edit.\n\n" +
          "THE QUESTION THAT SEPARATES EDIT FROM ADDON: does the thing they name exist on the site now? It does — " +
          "\"edit\". It does not — \"addon\". ASK IT OF THE THING ITSELF, NEVER OF WHAT IT GOES INTO: a new entry in a " +
          "list the site already keeps does not exist yet, so it is \"addon\" however long the list has been there, " +
          "just as a new section on an existing page is — and so is a new link in the menu or the footer, a new button " +
          "at the top, a new line of words and a new photograph on a page, whatever each one goes into. Changing an " +
          "entry that is already there, or taking one off, is \"edit\". So is changing or taking off a link, a " +
          "button, the words or a photograph the site already has. A page the site does not have, or a table it does " +
          "not have, is always " +
          "\"addon\". The pages and tables it has are listed above.\n" +
          // THE TIE-BREAK HAD ONE FALSE CLAUSE IN IT, and it cost the deletion
          // twice. Measured live: with "taking a page off is an edit" added
          // above, `Remove the gallery page` stopped answering "ask" and started
          // answering "addon" — because the LAST sentence of this description is
          // the strongest instruction in it, and it said addon can do everything
          // an edit can. For a removal that is simply untrue: no addon can take
          // a page off a site, so the answer costs a real page-generation call
          // and ends `no-change`, which reads to the customer as being ignored.
          // The exception has to sit AT the tie-break, not eight lines above it.
          "WHEN YOU CANNOT TELL, ANSWER \"addon\" — it can do everything an edit can EXCEPT take something away.\n" +
          "A REMOVAL IS NEVER AN ADDON. Nothing in that lane can delete a page or a section, so sending a removal there " +
          "spends a full page-generation call and changes nothing at all. If they are asking for something to GO, it is " +
          "an \"edit\", every time, even when you are unsure of anything else about it.",
      },
      // ── WORK THIS TURN CANNOT DO, NEVER "ONE CHANGE PER TURN" (2026-09-29) ──
      //
      // This said "One change happens per turn", and the edit route has run
      // several steps from one message since 2026-08-29. Run 52 (Test 6) was
      // the cost: "change the default description … then, on the Visit page
      // only, put the band above …" came back `look` with the Visit move in
      // here, and the reply both did the description and asked for the move
      // to be sent again. The rule is now what the route can really do, and
      // a part named here is HELD BACK: the browser posts it and the edit and
      // add-on routes take it out of the message before anything runs
      // (`heldBack`, below), so it is never also run this turn.
      // ON A SITE THAT EXISTS THIS IS A LIST (2026-10-03, `LIVE_ASK_TOOL`): a
      // first build is sent this field exactly as it was.
      alsoAsked: {
        type: "string",
        description:
          "A SECOND REQUEST THIS TURN CANNOT CARRY OUT — in their own words, copied EXACTLY from their message so " +
          "they can send it straight back. Whatever you put here is held back: it is taken out of what is done this " +
          "turn, and they are asked to send it next.\n" +
          "ALMOST ALWAYS LEAVE THIS OUT. Two things said about ONE change is still one change: \"make the background " +
          "yellow and the corners rounder\" is a single look edit, \"put Book first and drop Prices\" is a single " +
          "menu edit, and \"change the phone number in the header and the footer\" is one wording edit in two places.\n" +
          "SEVERAL CHANGES ARE ONE TURN WHEN YOUR ANSWER CAN MAKE THEM ALL. \"look\" is worked out part by part and " +
          "each change is made where it belongs — the site's colours, fonts, name and description, a section or a " +
          // LOOK'S REACH IS WHAT THE CLOSING RULE OF `layer` READS, so it names
          // no row: the look door has no lane that deletes one (2026-09-30).
          "band on any page, a photograph, the menu and the button, what the site enforces, its web address, " +
          "taking something off (but not a row the site stores: that is \"data\"). Each as the site already has it: " +
          "a NEW menu link, button, line of words or photograph is an addition, which \"look\" does not make. So " +
          "\"change our description, and " +
          "on the visit page move the order band up\" is " +
          "ONE \"look\" answer with nothing here, and so is \"make the headings green and swap the two sections on " +
          "the gallery page\".\n" +
          "PUT A SECOND REQUEST HERE ONLY WHEN IT NEEDS SOMETHING YOUR ANSWER CANNOT DO THIS TURN: something to ADD " +
          "that the site does not have yet beside a change (\"make the background yellow and add a booking form\" " +
          "is a \"look\" answer holding \"add a booking form\"), a change beside an addition when you answered " +
          "\"addon\", or a change to what the site's lists hold (\"data\") or to the exact words on a page " +
          "(\"text\") beside a change of another kind.\n" +
          // "WHEN YOU ANSWERED look" WAS THE GAP (run 63, 2026-09-29): a message
          // answered by another layer first could still put off a part `look`
          // would have made beside it. What decides is whether one answer can
          // make the whole message, on every page it is on (the rule closing
          // `layer`), never which layer the first change suggested.
          "NEVER for a detail, a reason or a restatement of the change you are doing, and never for a part one answer " +
          "can make along with everything else they asked: give that answer, whatever the first change was (the last " +
          "paragraph of `layer` says which). Being wrong here holds back work they asked for. When in doubt, say " +
          "nothing.",
      },
      layer: {
        type: "string",
        enum: EDIT_LAYERS,
        description:
          "Only when intent is \"edit\", and required for one. Which part of the site the change lives in.\n" +
          "\"data\" — the content the site STORES and shows in a list: a price, a menu item, a service, an opening " +
          "time, a team member. ASK YOURSELF WHETHER IT IS ONE OF MANY — a price sits in a price list, a dish sits on " +
          "a menu, and those live in the site's database rather than being written into the page. This is the " +
          "cheapest and fastest thing the builder can do, so prefer it whenever the thing being changed is a row " +
          "the site already stores. A NEW ENTRY IS NOT THIS LAYER: adding one to any of those lists is intent " +
          "\"addon\", not an edit, however cheap this layer is and however long the list has been there. The tables " +
          "it has are named above.\n" +
          // ── A ROW TAKEN OFF IS THIS LAYER TOO (2026-09-30) ───────────────────
          //
          // `look`'s removal clause claimed EVERY removal ("whatever the
          // something is"), a whole page its one exception, while this clause
          // claimed one row of a list — so "take that entry off the list" had
          // two answers, and on the look door no lane deletes a row (`backend`
          // is the rules rung). The data step deletes one itself (the row's
          // `remove`, `DATA_TOOL`). Said here AND at `look`'s exceptions,
          // because a model reading downwards meets whichever clause its
          // candidate answer is. A NEW ROW IS NOT THIS LAYER (owner,
          // 2026-10-01): it is the add-on step's, said in this clause's
          // opening line, at `intent`'s tie-break and in the system's cost
          // rule; the history is at `intent`'s addon clause.
          "TAKING AN EXISTING ROW OFF ONE OF THOSE LISTS IS THIS LAYER TOO: when an entry the site stores should no " +
          "longer be there, its row is deleted from the table that holds it, and every page showing that list stops " +
          "showing it.\n" +
          // ── A LIST SORTED SITE-WIDE IS THIS LAYER; ONE NAMED PAGE IS `page` (2026-09-30, decision 2b) ──
          //
          // A list's order is written in PAGE CODE — the `{ order, dir }` of the
          // page's `useRows` call — and the data step's sort lane (`DATA_TOOL`'s
          // `order`, `applySort`) rewrites that call on EVERY page reading the
          // table. Nothing here pointed at it: this clause named rows, `page`
          // named "lay a list out differently", and the same sentence could land
          // on either. The owner decided it, with a scope correction: *"Use the
          // existing data-sort lane for site-wide sorting by an existing column.
          // Requests limited to one page should use the existing page editor
          // while the data sorter remains site-wide. Do not add the proposed
          // 'whatever page they saw it' rule. Different pages may intentionally
          // use different orders."* A sort limited to one named page is `page`
          // (said there too). A hand-placed entry is no sort, and nothing here
          // says where it goes.
          //
          // ⚠ "NOT LIMITED TO ONE PAGE" IS NOT "ACROSS THE SITE" (the owner's
          // correction, 2026-10-01): *"Use data-sort when the requested change
          // applies across the site. Keep a one-page request on the page editor.
          // A request limited to a selected group of pages must preserve that
          // selection; never expand it to every page showing the table."* The
          // first wording sent here every sort "not limited to one page", two
          // pages of three included, and the sort lane has no page scope — so
          // the page they left out was re-sorted too. This layer is now the
          // answer only for the whole site (said, or no page named); a selection
          // is a change on each page in it, and the field's closing rule decides
          // it, unchanged. On `look` each change is made on its own page, and no
          // lane on that door reaches the sorter (`laneLayer`).
          "SORTING ONE OF THOSE LISTS ACROSS THE WHOLE SITE IS THIS LAYER TOO: when they want a list in order of " +
          "something every entry already has — cheapest first, A to Z, newest at the top — everywhere it is shown " +
          "(they say so, or they name no page), it is re-sorted on every page that shows it, all at once. THIS LAYER " +
          "CANNOT LEAVE A PAGE OUT, so it is never the answer when they limit the sort to some of the pages that show " +
          "the list: ONE page they name is \"page\", and several pages they name, or every page but the ones they " +
          "exclude, is a change on each of those pages and on no other, which the last paragraph of this field " +
          "decides. A page they left out keeps its order: different pages may show the same list in different " +
          "orders. Placing one entry by hand (\"put that one first\") is not a sort.\n" +
          "\"text\" — ONLY the words change and nothing else: a heading, a sentence, a button label, a phone number, an " +
          "address, a price written on the page. Nothing moves and nothing changes colour. This is the cheapest thing the " +
          "builder can do, so prefer it whenever it is honestly true.\n" +
          // ── WHAT THIS LAYER REACHES THAT "nav" DOES NOT (2026-10-23, fix-edit-flow) ──
          //
          // Live on saltmarsh-and-sparrow: "make the Book a table button say X"
          // (a button in the home page's hero) and "change Saturday's opening
          // hours" (a timetable written into the page, no tables) were both
          // answered "nav", whose editor reaches only the frame — the header's
          // menu and its one button, the footer's details — and changed
          // nothing. Said by reach, not by word: what each editor can touch.
          "THIS LAYER REACHES EVERY WORD WRITTEN INSIDE A PAGE'S OWN SECTIONS — a button's label in a page's hero or " +
          "a section, a timetable, a price list or opening hours written into the page itself (not stored rows: the " +
          "tables the site has are named above, and with none every list is written into its page). Rewording any of " +
          "that is this layer even when it is a button or opening hours: the menu layer, nav, reaches only the frame shared by " +
          "every page (the header's menu and its one button, the footer's details), so it cannot change words a page " +
          "section carries.\n" +
          "WORDS THAT ARE NOT ON THE PAGE YET ARE NOT THIS LAYER: a line, a sentence or a paragraph ADDED to a page is " +
          "intent \"addon\". This layer rewords what is already there.\n" +
          "\"look\" — colour, theme, fonts, how round the corners are, the TAB ICON (the favicon — \"make the tab " +
          "icon a scissors\" is this layer; the designer redraws the mark, no page changes), the LOGO when no file is " +
          "attached (\"draw us a logo\", \"just use our name as the logo\" — the designer draws or sets text; a logo they " +
          "ATTACH is the logo layer), the site's name, its one-line description, and " +
          "WHAT LANGUAGE ITS PAGES ARE DECLARED TO BE IN. Anything about how the site LOOKS rather than what it says " +
          "or where things sit. (The declared language is a fact about the site, not a translation — \"this site is in " +
          "Spanish, stop telling browsers it's English\" belongs here; \"translate the whole site into Spanish\" is a " +
          "rewrite and belongs further up.)\n" +
          "DARK OR LIGHT IS THIS LAYER TOO — \"make the whole site dark\", \"I want it on black\", \"put it back to " +
          "light\". It is a colour change like any other here: the stylesheet is rewritten, no page is.\n" +
          "A COLOUR OR A TYPEFACE CAN BE FOR ONE PAGE — \"make the booking page darker\", \"the about page should " +
          "feel calmer\", \"give the menu page a warm background\", \"the menu page should be in something " +
          "handwritten\", \"use a serif on the about page\". Still this layer and still cheap; it is the same look " +
          "change scoped to the page they named. (Corners and spacing are the SITE's and cannot be scoped to a " +
          "page, so a request to change one page's corners is not this.)\n" +
          // ── AND IT IS WHERE A REMOVAL IS WORKED OUT ─────────────────────────
          //
          // `look` is the front door to the twenty-one lanes: `pick_lanes` runs
          // there and DISPATCHES — a section to the page rung, a photograph to
          // the picture rung, the button to nav. So naming this layer for a
          // removal is not a claim that the change is a colour change; it is
          // how the ask reaches the rung that can make it AND clears whatever
          // the site has stored about the thing, which the rung alone cannot do.
          //
          // The four that most need it (`components`, `shape`, `three`, `tsx`)
          // all dispatch to `page`, and the `remove` flag cannot carry them:
          // that flag on `page` deletes the WHOLE page. This clause is the only
          // way they arrive. If it is read past, the ask still lands on the
          // rung it names and does its best — today's behaviour, not a failure.
          "TAKING SOMETHING OFF THE SITE IS THIS LAYER, whatever the something is — \"take the 3D thing off\", " +
          "\"drop the testimonials band\", \"remove the chord diagrams\", \"get rid of the QR code\", \"take the " +
          "photo out\", \"the accordion shouldn't open on click any more\", \"stop offering it in French\". This is " +
          "where a removal is worked out and sent to whatever part of the site holds the thing, so answer \"look\" " +
          "and say what should go; you do not have to know which part that is.\n" +
          // THE SECOND EXCEPTION (2026-09-30): a stored row. Both exceptions come
          // before the sentence that gives this layer everything else, so
          // "anything else" is read with both of them already said.
          "THE FIRST EXCEPTION IS A WHOLE PAGE. \"Remove the gallery page\", \"we don't need the about page any more\" " +
          "is layer \"page\" with `remove` — a page is deleted there and nowhere else.\n" +
          "THE SECOND IS A ROW THE SITE STORES. An existing entry taken off one of the lists kept in the tables named " +
          "above is layer \"data\" — its row is deleted there and nowhere else.\n" +
          "Taking a SECTION, a picture, a band or anything else OFF a page that stays is this layer.\n" +
          "WHEN THEY SAY WHICH PAGE IT IS ON, NAME IT IN `page` — for a colour, a section, a band or a scene alike. " +
          "Without it, a change to a section is made on the home page.\n" +
          "SEVERAL CHANGES IN ONE MESSAGE ARE STILL ONE \"look\" ANSWER — the site's description and a band on the " +
          "visit page, a section on one page and a section on another — and each is made where it belongs. When " +
          "they are not all on ONE page, leave `page` out: each change is placed on its own page.\n" +
          "\"rules\" — WHAT THE SITE DOES WITH WHAT PEOPLE SUBMIT, rather than anything on a page. Who may see an " +
          "entry and who may add one (\"let people browse the listings without signing in\", \"close the booking " +
          "form\"), whether the customer gets an email or a text when they submit, and what the site refuses (\"don't " +
          "let two people book the same slot\", \"only twenty places\", \"one review per customer\"). NOTHING A " +
          "VISITOR CAN SEE CHANGES, which is why it is nearly free. If the ask ALSO needs something new on a page — " +
          "a button, a form field — that is \"addon\", not this.\n" +
          // ── ⚠ ENFORCEMENT AGAINST DISPLAY, AND IT IS NOT A WORD LIST ────────
          //
          // This description used to end "so prefer it whenever the change is
          // honestly about behaviour rather than appearance", which is false in
          // a way that is easy to read past: a component on a page has
          // BEHAVIOUR too. It counts, it filters, it subtracts, it decides what
          // to say when a number is zero — and every one of those is a change
          // to a file a page writer edits, not to anything Postgres enforces.
          //
          // MEASURED: run 12 (2026-09-21) asked for a change to what a stored
          // component DISPLAYS from a count it already receives, and this layer
          // answered — then met a site whose backend reference was missing and
          // stopped the whole message for 2 credits with nothing published.
          //
          // The line is WHAT MUST CHANGE, never which nouns the sentence uses.
          // "Bookings", "capacity", "places" and "slots" appear on both sides
          // of it, so matching on them is how a display change is routed into
          // the database.
          "⚠ THE LINE IS ENFORCEMENT AGAINST DISPLAY, AND THE WORDS IN THE MESSAGE DO NOT DECIDE IT. \"Bookings\", " +
          "\"capacity\", \"places\", \"slots\" and \"limit\" turn up in BOTH kinds of ask, so ignore them and ask " +
          "what actually has to change.\n" +
          "IT IS THIS LAYER WHEN THE SITE MUST START ACCEPTING OR REFUSING SOMETHING DIFFERENT — \"reject bookings " +
          "after six places are taken\", \"stop taking orders once we're full\", \"don't let anyone book twice\". " +
          "The database is what has to change; a visitor who submits gets a different answer than before.\n" +
          "IT IS \"page\" WHEN AN EXISTING PART OF THE SITE MUST CALCULATE OR SHOW SOMETHING DIFFERENTLY FROM DATA " +
          "IT IS ALREADY GIVEN — \"show six minus the booking count\", \"say how many places are left instead of how " +
          "many are taken\", \"show the count as a bar\". Nothing about what the site ACCEPTS changes; a section on " +
          "a page does its arithmetic differently. That is a file a page writer edits, and it is NOT this layer " +
          "however much the sentence sounds like a rule.\n" +
          "\"picture\" — A PHOTOGRAPH A PAGE ALREADY SHOWS, or an empty picture frame it already has: swapping one for " +
          "another, filling the empty frame, taking one off, or CHANGING WHICH PART OF IT YOU SEE. \"Use my own photo " +
          "of the shop instead\", \"the picture of the chairs is wrong\", \"put a real photo in the empty frame on the " +
          "about page\". This is about the IMAGE ITSELF and never about the words beside it or where it sits on the " +
          "page.\n" +
          "A PHOTOGRAPH ADDED TO A PAGE IS NOT THIS LAYER — \"put a photo of the team on the about page\", \"add " +
          "another picture of the shop to the home page\": a new photograph is intent \"addon\", even on a page that " +
          "shows some already.\n" +
          "A PICTURE THAT IS CUT OFF IS THIS LAYER, AND IT COSTS NOTHING — \"his head is chopped off\", \"you " +
          "can't see the sign\", \"it's cropping the top\", \"show more of the left\". It moves the crop of the " +
          "photograph that is already there rather than buying a new one, so it is free and it is nearly always " +
          "what they meant.\n" +
          "\"logo\" — THE BUSINESS'S OWN LOGO, which goes at the top of every page and is not a photograph on one. " +
          "\"here's my logo\", \"this is our logo, put it in the header\", \"use this as the logo\", \"my logo goes " +
          "top left\" — nearly always with a picture attached, because the attachment IS which picture they mean. " +
          "Answer this for taking it OFF as well (\"drop the logo\", \"just the name is fine\"), with `remove` true " +
          "and no attachment expected. THE WORD \"LOGO\" IS THE SIGNAL and it is a strong one: a picture attached to " +
          "a message about the header, the top of the site, or the brand mark is this and not \"picture\".\n" +
          "\"nav\" — THE SAME-ON-EVERY-PAGE FRAME: the menu, the one button beside it, and the contact details at " +
          "the BOTTOM of every page. IT REACHES NOTHING INSIDE A PAGE'S OWN SECTIONS: a button, a timetable or opening " +
          "hours a page section carries are that page's words (\"text\", or \"look\" with other changes), even when " +
          "the frame has something with a similar name.\n" +
          "THE FOOTER'S DETAILS — the phone number, email address, postal address and opening line a visitor " +
          "scrolls to the bottom for. \"Our number at the bottom is wrong\", \"the address is wrong, we've moved\", " +
          "\"the opening hours have changed\", \"take the opening times off\". It is the same block on every page, so " +
          "it changes everywhere at once and costs almost nothing.\n" +
          "A FULL DAY-BY-DAY TIMETABLE IS NOT THIS — that is rows the site stores, so it is \"data\". This is the " +
          "one line at the bottom (\"Tue–Sun 12–10\"). Hours or a timetable WRITTEN INTO A PAGE'S OWN SECTION, with no " +
          "table storing them, are that page's words: \"text\".\n" +
          "THE SOCIAL ICONS AND THE SMALL PRINT are here too — \"our Instagram link goes to the old account\", \"the " +
          "Privacy link in the small print is broken\", \"take the Twitter icon off\". Same block, same page-wide " +
          "change, same near-zero cost.\n" +
          "AND HOW THE FRAME ITSELF SITS — \"centre our logo\", \"put the name in the middle\", \"run the header " +
          "right across the screen\", \"the top bar shouldn't follow me as I scroll\". That is WHERE the bar's " +
          "parts go and how wide it runs; its COLOURS, corners and typefaces are \"look\", not this.\n" +
          "THE MENU — which items are in it, what order they come in, taking one out. \"Put Book first\", \"rename " +
          "Pricing to Prices in the menu\", \"take Pricing out of the nav\", \"the menu should be Home, Services, " +
          "Contact\".\n" +
          "THE FRAME'S BUTTON — the one beside the menu in the header, on every page — what it says AND where it goes. A button inside a page's own section (a hero, a band) is not this one: its label is \"text\". \"Change the Book button to Get a quote\", \"make the button " +
          "call us instead\", \"point the button at the contact page\", \"drop the button\". " +
          "A phone number belongs here: for a trade whose customers ring rather than book, that button IS the site's " +
          "whole purpose.\n" +
          // ADDING TO THE FRAME IS THE ADD-ON'S (2026-10-02), whose `frame` kind
          // hands it straight back here as an addition, so the menu editor still
          // does it — held to adding, which a plain edit of this layer is not.
          "ADDING TO THE FRAME IS NOT AN EDIT: a NEW menu link, a NEW social or small-print link, a NEW contact detail " +
          "or a NEW button is intent \"addon\" — it is added here, on every page, by the add-on step, without changing " +
          "anything the frame already has. A menu they want REWRITTEN as a whole list, in the order they give, is " +
          "still this layer.\n" +
          "LINKS WRITTEN INTO THE PAGES belong here too — \"the Send an enquiry link should go to the contact " +
          "page\", \"make Read more point at the blog\". Every link on the site with those words moves at once, on " +
          "every page carrying one, which is the part no other lane can do.\n" +
          "The menu and the button are the same on every page, so this changes all of them at once and is nearly " +
          "free.\n" +
          "IT ONLY EVER POINTS AT PAGES THE SITE ALREADY HAS. \"Add a gallery to the menu\" when there is no gallery " +
          "page is an \"addon\" — the page has to exist before anything can link to it. The pages it has are listed " +
          "above.\n" +
          "\"page\" — the arrangement of ONE existing page: move a section, take one out, lay a list out differently. " +
          "Name it in `page`. Something NEW on the page — a section, a line of words, a photograph — is intent " +
          "\"addon\", not this layer.\n" +
          // ── A LIST'S ORDER ON ONE NAMED PAGE IS THIS LAYER (2026-09-30, decision 2b) ──
          //
          // The other half of the sort sentence under `data`, said here too for
          // the reason every paired clause in this field is: a model reading
          // downwards meets whichever clause its candidate answer is. This layer
          // edits the one file named and leaves the others as they are, which is
          // the point when the owner limits a sort to one page (*"Different
          // pages may intentionally use different orders"*). Its last sentence
          // said "not limited to one page" is `data`, the broad phrase the owner
          // corrected (2026-10-01): only the whole site is `data`, and a
          // selection of several pages is left to the closing rule.
          "THE ORDER OF A LIST ON ONE PAGE THEY NAME IS THIS LAYER TOO — \"on the services page, show the cheapest " +
          "first\": only that page's list is re-sorted, and every other page that shows the same list keeps its own " +
          "order. Across the whole site the same sort is \"data\". On SEVERAL pages they name it is neither — this " +
          "layer edits one page, and \"data\" cannot leave a page out — so the last paragraph of this field decides " +
          "it, and a page they left out is never re-sorted.\n" +
          // ── A SECTION'S OWN ARITHMETIC IS THIS LAYER ────────────────────────
          //
          // The other half of the enforcement/display line stated under
          // "rules". It is said in BOTH places on purpose: a model reading
          // downwards meets whichever description its candidate answer is, and
          // one of the two sentences is always the one that would have caught
          // the mistake. Run 12 read the `rules` description and stopped.
          "WHAT A SECTION CALCULATES OR SHOWS FROM DATA IT ALREADY RECEIVES IS THIS LAYER — \"show six minus the " +
          "booking count\", \"say how many are left rather than how many are taken\", \"round the total up\", " +
          "\"show nothing instead of zero\". A part of a page counts, subtracts and decides what to say; changing " +
          "that is changing a file, and it is this layer even when the sentence is all about bookings, places or " +
          "capacity. It is \"rules\" ONLY if the site must start ACCEPTING or REFUSING something different.\n" +
          "THIS IS ALSO WHERE A PAGE IS DELETED. \"Remove the gallery page\" is this layer, that page in `page`, and " +
          "`remove` true — not a rewrite of the site and not a question back. Deleting costs almost nothing precisely " +
          "because it comes here.\n" +
          // ── WHERE A CHANGE ON SEVERAL PAGES GOES (reconciled 2026-09-29) ─────
          //
          // This sent it to "addon", written before the frame's details were
          // `nav`'s and before `look` placed each change on its own page (its
          // scoped page steps, deploy 2166). It now points at the rule that
          // closes this field, which asks which answer can make the change on
          // every page it lands on.
          // THE EXAMPLE IS A CHANGE (2026-10-02): "put the phone number in the
          // footer" reads as adding one, which is the add-on's now.
          "ONE PAGE, AND ONLY ONE. If the change is meant to land on several — \"change the phone number in the footer " +
          "of every page\" — this is NOT the layer for it: it edits the single page you name and leaves the rest " +
          "exactly as they are, so the site would end up disagreeing with itself. The answer for those is whichever " +
          "can make the change on every page it lands on, as the last paragraph of this field says.\n" +
          // THIS CLAUSE USED TO SEND EVERY MENU CHANGE TO THE ADDON LANE, by
          // name: "add the gallery to the menu everywhere" was its own worked
          // example of something to answer "addon" for. That was correct while
          // nothing could edit a menu — the nav is a separate copy in every page
          // file, so it really did need a lane that touches them all. With the
          // `nav` layer there it is a ~27-credit page-generation call to move one
          // word, and the example has to point at the cheap lane or the layer is
          // reachable by nothing.
          // ⚠ AND "NOT addon" WENT (2026-10-02): a NEW menu link is the add-on
          // step's now, which hands it back to `nav` held to adding. What stays
          // true is that a change to the menu it has is never this layer.
          "A CHANGE TO THE MENU IT HAS IS \"nav\", NOT THIS. It lands on every page and costs almost nothing; a new " +
          "item in it is an addition.\n" +
          "\"rename\" — THE SITE'S WEB ADDRESS, and nothing else: the word in <name>.gofarther.app. Pick it when " +
          "they ask to rename the site, move it, or have it at a different address. NOT for changing the business's " +
          "NAME as it reads in the header — that is the name on the page and it is a look change; a site can be " +
          "called \"Sunset Shoes\" and live at shoeroom-1, and plenty do. The old address keeps working and sends " +
          "people to the new one, so this is safe to pick when they plainly asked for it — and only then. ALSO " +
          "\"rename\" when they want an OLD address to stop working after a rename (\"forget the old address\", " +
          "\"drop crookes-guitar\", \"stop the old name working\").\n" +
          // ── ONE ANSWER FOR THE WHOLE MESSAGE, AND IT IS THE LAST WORD HERE (2026-09-29) ──
          //
          // Run 63 (Test 8): a menu item taken out and a band moved on another
          // page, in one message, came back `nav` with `remove` and the move in
          // `alsoAsked`. The first change was answered by its own clause ("A
          // MENU CHANGE IS nav", `remove` for a menu item), and the second was
          // then held back as something THAT answer could not do. `look` could
          // make both, and its clause says several changes are one answer, but
          // every clause above reads as the whole rule when a message leads
          // with its kind. So the choice is stated once, last, over every
          // change asked and every page it is on: a layer other than `look` is
          // the answer when it can make all of it (a single change stays as
          // cheap as it was); otherwise `look`, when its scoped steps can; and
          // only what no one answer can make with the rest is held back.
          //
          // ⚠ BY TARGETS, NEVER BY KIND (the owner's review, the same day). The
          // first wording made a layer the answer "when every change they ask
          // for is its kind", but two layout changes on two pages are one kind
          // and `page` edits one page. What decides is whether a route can make
          // every change on every page it is on. `look` places each change on
          // its own page, so that pair is `look`. A mix no one route can make
          // keeps its answer and its hold, so not every mix goes to `look`.
          "ONE ANSWER FOR THE WHOLE MESSAGE, CHOSEN AFTER READING EVERY CHANGE THEY ASK FOR AND WHERE EACH ONE IS — " +
          "NEVER FROM THE FIRST CHANGE ALONE. A layer other than \"look\" is the answer when it can make all of them, " +
          "on every page each one is on. When none can, answer \"look\" if it can make them all (what it reaches is " +
          "listed under `alsoAsked`), and hold nothing back: it makes each change on its own page, so changes on " +
          "different pages are one \"look\" answer even when they are all of one kind. Hold a change back only when " +
          "no one answer can make it with the rest.",
      },
      page: {
        type: "string",
        // ── AND FOR `look`, THE PAGE THEY SAID (2026-09-23) ─────────────────
        //
        // This read "Only when layer is page", and `readEdit` agreed by
        // returning before it looked — so "move the market times up on the
        // gallery page", answered `look` (the lanes dispatch a section change
        // to the page rung), reached the edit route with no page and was made
        // on the HOME page. The routing reply, the browser and the dispatcher
        // all forwarded a page already; this field was the only thing that
        // could not carry one. Reproduced through the real route, the real
        // browser POST and the real edit route: `test/edit-page-target.test.mjs`.
        description:
          "When layer is \"page\": the route path of the page being changed, copied EXACTLY from the list of pages " +
          "above — \"/\" for the home page, \"/menu\", \"/book\". If the change is about a page that is not in that list, the " +
          "site does not have it yet and the intent is \"addon\", not \"edit\".\n" +
          "When layer is \"look\": the page they SAID the change is on, copied the same way — \"move the market times up " +
          "on the gallery page\" and \"take the 3D thing off the gallery page\" are both \"/gallery\". Leave it out when " +
          "they named no page, for a change to the whole site, and when the message asks for changes on MORE THAN ONE " +
          "page or for the whole site AND a page — each change is then placed on its own page. Never guess one: the " +
          "page named here is the page that gets changed.\n" +
          "For every other layer, leave it out.",
      },
      remove: {
        type: "boolean",
        description:
          "For layer \"page\": true when they are asking for that page to be TAKEN AWAY — \"remove the gallery " +
          "page\", \"we don't need the about page any more\", \"delete /prices\".\n" +
          "ONLY WHEN THEY PLAINLY MEAN DELETE THE WHOLE PAGE. Changing what is on a page, taking a SECTION off it, or " +
          "emptying it out are all ordinary page edits — leave this out for those, because setting it there " +
          "takes a page off their site.\n" +
          // THE LAST SENTENCE OF A FIELD IS THE STRONGEST ONE IN IT, and this
          // clause used to end on "getting it wrong the other way takes a page
          // off their site" — a warning against the action, as the final word.
          // Measured live 2026-08-12, on a run where everything else was right:
          // `intent=edit layer=page page=/gallery remove=undefined`, against the
          // message "Remove the gallery page" and this field's own first example.
          // The model picked the lane, the layer and the page, and declined the
          // boolean. So the closing word is now what happens if it is omitted,
          // which is the failure the customer actually sees. Same fix that moved
          // the addon tie-break an hour earlier.
          "WITHOUT THIS FIELD THE PAGE STAYS. Layer \"page\" on its own is an ordinary edit, so if they have said the " +
          "page should GO and you leave this out, nothing is deleted and they are told the change was made. When they " +
          "have asked for a page to be gone, set it.\n" +
          "For layer \"logo\": true when they want the logo TAKEN OFF and the header to go back to showing the " +
          "business name — \"drop the logo\", \"remove our logo\", \"just the name is fine\". A message that ATTACHES " +
          "a picture is never a removal.\n" +
          "For layer \"picture\": true when a photograph should GO rather than change — \"take the photo of the shop " +
          "off\", \"we don't want a picture there\". For layer \"nav\": true when a menu item, a footer link or the " +
          "header's button should GO — \"drop the button\", \"take Pricing out of the menu\".",
      },
      tab: {
        type: "boolean",
        description:
          "Only when layer is \"logo\". True when the picture is for the BROWSER TAB rather than the header — " +
          "\"this is our favicon\", \"use this as the tab icon\", \"the little icon in the tab\", \"put this on the " +
          "bookmark\". The words \"favicon\", \"tab\" and \"bookmark\" are the signal, and each is a strong one.\n" +
          "LEAVE IT OUT FOR AN ORDINARY LOGO. \"Here's my logo\" means the header, which is where a logo is read at " +
          "a size that makes it legible; a wide wordmark shrunk into a 16-pixel tab is a smear, so sending one there " +
          "on a guess gives them a worse tab than the initials they had.\n" +
          "It also works with `remove` — \"take the favicon off\" is both fields, and puts the tab back to the mark " +
          "drawn from the business's initials.",
      },
      rename: {
        type: "string",
        description:
          "For layer \"page\" ONLY: the NEW ADDRESS they want that page to have, when the ask is about its address " +
          "rather than its contents — \"move the gallery to /work\", \"the services page should be at /what-we-do\", " +
          "\"change /about-us to /about\". Name the page they mean in `page` as usual, and put the new path here, " +
          "starting with a slash: \"/work\".\n" +
          "AN ADDRESS IS NOT A HEADING, and this is the distinction that decides the field. \"Call that page Services " +
          "instead of What We Do\" is about the WORDS ON IT — that is an ordinary page edit and this stays empty. Only " +
          "use this when they are talking about the URL, the address, the link, or where the page lives.\n" +
          "LEAVE IT OUT UNLESS THEY ASKED. Moving a page changes every link to it and leaves a redirect behind, so " +
          "setting this when they only wanted different wording changes the address of a page they were happy with.",
      },
      // "MAKE MY SITE LIKE MY OLD ONE" (ideas #25/#26, 2026-10-22): the router
      // decides, by this typed field, whether a first build rebuilds the site
      // the customer has now; never a keyword rule. The Worker fetches the
      // address only after `readImportSite` (site-import.mjs) finds it public
      // and written in the message itself.
      importSite: {
        type: "string",
        description:
          "Only when intent is \"build\": when the customer asks for the website they ALREADY HAVE to be rebuilt, " +
          "copied, moved over or remade here, and gives its address, that address exactly as they wrote it. Their words, " +
          "pages, contact details, colours, fonts, logo and photographs are then read from it. Leave it out when an " +
          "address is only an example of a look they like, a competitor, or a page to read facts from.",
      },
      answer: {
        type: "string",
        description:
          "Only when intent is \"ask\": the gist of your reply, in a sentence or two. The reply they read is written " +
          "separately from this, with the whole conversation and their site in view and the room an explanation or a " +
          "plan needs; this is its starting point, and what they are shown only if that reply cannot be written. " +
          "ANSWER WHAT THEY ACTUALLY SAID — a greeting is not a thank-you, and neither is a question about what you can " +
          "do — and never reach for a stock opening line. Never invent a fact about their site: if you do not know, say " +
          "so. No emoji and no checkmark or warning symbols, unless they asked for them.",
      },
      resolved: {
        type: "string",
        description:
          "Only for work (\"build\", \"edit\" or \"addon\"), and only when their message leans on the conversation " +
          "shown above it — \"do that\", \"yes, the second one\", \"add what we talked about\", \"use the wording you " +
          "suggested\" — so that it does not say on its own what to do. Write the request out in full, in their terms, " +
          "so that someone who never saw the conversation would do exactly what they agreed to: name the page, the " +
          "words, the feature. Take only what the conversation really says; never add anything they did not ask for. " +
          "When you write this, any part you hold back (`alsoAsked`) is copied from this text. Leave it out whenever " +
          "their message already says everything. NEVER write it from a part of the conversation marked as not " +
          "shown: when what they agreed to is in such a part, or you cannot find it in what is shown, leave this out, " +
          "answer \"ask\", and ask them to say again what they would like done.\n" +
          "WHAT TO WRITE FOR THE COMMON FOLLOW-UPS: \"use the second idea\" — the second item of the most recent " +
          "numbered or bulleted list in the conversation, copied out (its words, not \"idea two\"); \"keep that style\" " +
          "or \"same as before\" — the colours, fonts, wording or layout the conversation actually named, spelled out; " +
          "\"do that on every page\" — the change, then every page by its address from the site's page list below. When " +
          "two things in the conversation fit equally (two lists, two styles, two earlier changes), it is not yours to " +
          "pick: answer \"ask\" and say what is unclear in `unclear`.",
      },
      unclear: {
        type: "string",
        description:
          "Only when intent is \"ask\" BECAUSE their message leans on something you cannot pin down: it could mean two " +
          "or more things in the conversation, or what it points at is not shown or cannot be found. Name in a few words " +
          "what is unclear and, when you can see them, the candidates — \"which list: the headline ideas or the colour " +
          "ideas\", \"the earlier style is in a part of the conversation not shown\". The reply they read then asks them " +
          "one focused question about exactly this. Leave it out for every other \"ask\": a question, an idea, a remark " +
          "or a plan they are thinking through is not unclear.",
      },
      question: {
        type: "object",
        description:
          "Only when intent is \"clarify\". ONE question — the single most useful thing you do not know — with the answers as " +
          "options they can click. Ask about what changes the SITE: whether visitors book, order, or just get in touch; whether " +
          "customers need their own accounts; what the place should feel like. Do not ask for facts that can simply be typed in " +
          "later, like an address or opening hours, and never ask something the brief already told you.\n" +
          "WHAT THE BUSINESS IS COMES FIRST, ahead of every other question. If the brief does not say the TRADE, that is your " +
          "first question and nothing else is close: \"Book classes\" could be a gym, a pottery studio, a driving school or a " +
          "yoga room, and those are four different sites — different pages, different words, different pictures. Measured live " +
          "2026-08-09: from exactly that brief the questions asked were about logins and then about the mood, and after both " +
          "were answered the trade was still unknown. Everything else hangs off this one, so asking it second is asking it too " +
          "late.",
        properties: {
          text: {
            type: "string",
            description:
              "TWO SHORT SENTENCES, and the first one is why this reads as a conversation rather than a form: pick up what " +
              "they just told you in a few words, then ask. \"A barber shop in Leeds, nice one. What do you want people to " +
              "be able to do on it?\" — not \"What do you want visitors to your site to do?\", which is a form field with a " +
              "question mark on it. Plain, warm, no apology and no preamble about why you are asking.\n" +
              "DO NOT LIST THE OPTIONS IN THE SENTENCE. They are rendered as buttons directly underneath it, so " +
              "\"Sleek and modern, welcoming, or hardcore?\" says everything twice and spends the length on the half " +
              "nobody reads. Ask the question; let the buttons be the answers.",
          },
          options: {
            type: "array",
            minItems: MIN_OPTIONS,
            maxItems: MAX_OPTIONS,
            items: { type: "string" },
            description:
              "Two to four answers THEY might give, each a few words on a button — \"Book a time slot\", \"Send an enquiry\", " +
              "\"Just phone and address\". Each one is a thing the CUSTOMER would say back to you, never your own next " +
              "sentence: \"Tell me more and I'll ask again\" is you talking, not an answer, and it renders as a button that " +
              "means nothing when pressed. Under 40 characters each — anything longer is a sentence rather than an answer.\n" +
              "IF YOU CANNOT NAME TWO OR THREE CONCRETE ANSWERS, THE QUESTION IS THE WRONG ONE. \"What does your business " +
              "do?\" is open-ended and has no options, so it is not a clarify at all — answer \"ask\" and invite them to tell " +
              "you, in a sentence. Only ask here what has a small, nameable set of answers.",
          },
        },
        required: ["text", "options"],
      },
    },
    required: ["intent"],
  },
};

// ── THE ROUTER'S TOOL ON A SITE THAT EXISTS (2026-10-02) ───────────────────
//
// Owner: *"Let the router ask a targeted question when missing information
// materially affects which path, target, or operation to choose, instead of
// converting clarification into add-on work"*, and *"preserve current
// first-build behavior"*. So a first build is sent `ASK_TOOL` exactly as it was,
// byte for byte, and a site that exists is sent this: the same tool with the
// first build's question clause swapped for one about choosing among answers,
// a question whose answers are optional (a typed answer is always taken), and
// one more field, `answered`, read only when a question is waiting.
//
// SINCE 2026-10-25 (router-b1) the live tool's `intent`, `alsoAsked`,
// `layer`, `page` and `remove` are its own compact rules (below), no longer
// `ASK_TOOL`'s text with clauses swapped; the first build's are untouched.
const LIVE_CLARIFY =
  "\"clarify\" — ONE QUESTION BACK INSTEAD OF WORK, only when you are told below that a question may be asked, and " +
  "only when a detail they left out decides your answer here: whether it is a change or an addition, which page or " +
  "which part of the site, or what should happen to it — and neither their message nor the site described above " +
  "settles it. Ask about what decides YOUR answer; a detail inside a page is for the step that does the work, which " +
  "sees the page and asks for itself if it must. Never to check that they meant it, never for something you can see " +
  "above, never for a choice the work can make sensibly on its own. When the message is clear, answer with the work.\n\n";

// ── THE LIVE ROUTER'S RULES, ONE OF EACH (2026-10-25, router-b1) ─────────────
//
// The router audit (`docs/audits/2026-10-25-router-audit.md`) found the live
// tool's rules grown one run at a time: the edit/addon line said five times
// (and again in six layers), three tie-breaks pulling three ways ("answer
// addon", "ask them", the system's "pick the cheapest"), removals claimed by
// `look`, `picture` and `nav` at once, the several-changes rule in three
// wordings, and frame additions split between `nav`, `addon` and `look`. A
// site that exists is now sent ONE rule for each, here, written for it alone;
// a first build is still sent `ASK_TOOL` and `SYSTEM` byte for byte (the
// owner: *"preserve current first-build behavior"*). Every guarded behaviour
// keeps a sentence:
//   - edit/addon: one test, asked of the thing itself, answered from the site
//     inventory (`route-inventory.mjs`), in `intent` only;
//   - one tie-break: the inventory first; a question where one may be asked;
//     `addon` where questions are closed; cost never decides;
//   - a removal has one owner by what holds it: a whole page `page`+`remove`,
//     a stored row `data`, a frame item or the logo `nav`/`logo`+`remove`, and
//     anything else on a page that stays `look`;
//   - a new item in the frame is `edit` + `nav` (the frame step), not `addon`;
//   - the several-changes rule once, closing `layer`.
const LIVE_INTENT =
  "\"ask\" if the message is conversation rather than a request for work: a question, a greeting, a thank-you, an " +
  "idea or plan they are thinking through, a request for suggestions or a comparison, talk about files they attached, " +
  "or a side question while one of ours waits. Talking about a change (\"should I add a gallery?\") is not asking for " +
  "it. When it is genuinely both a question AND a change, answer with the work.\n" +
  "NEVER ANSWER \"ask\" TO CHECK THAT THEY MEANT IT. A request to take something away is an instruction: there is no " +
  "yes button, so \"are you sure?\" reads as the builder refusing to work. Every change is archived and can be undone. " +
  "Do the work.\n\n" +
  LIVE_CLARIFY +
  "\"build\" — only when they want this whole site thrown away and remade as something else. It rewrites every page, so " +
  "it is never the answer to a change.\n" +
  "\"edit\" — something the site ALREADY HAS, changed, moved, reworded, restyled or taken away — and a new item in the " +
  "frame every page shares (a menu link, a footer link, a contact detail, the header button), which layer \"nav\" adds " +
  "on every page. Taking a whole page off is an edit: layer \"page\", that page, `remove` true.\n" +
  "\"addon\" — something the site DOES NOT HAVE YET: a page or a table it lacks; a section, form, map, QR code or 3D " +
  "scene on a page; a new line of words or a new photograph on a page, even one that has some; a new entry in a list " +
  "it keeps (a product, service, dish, class, event, team member: the list existing does not make the entry exist); " +
  "or something its database must newly do (a lookup or a cancel a page needs, something read live from an outside " +
  "service, something on a timer). A site with no database gets one with the first of these.\n" +
  "EDIT OR ADDON IS ONE TEST, ASKED OF THE THING ITSELF AND NEVER OF WHAT IT GOES INTO, AND ANSWERED FROM THE SITE " +
  "INVENTORY ABOVE: is it there now? Yes — \"edit\". No — \"addon\". A working feature on a page that exists (taking " +
  "bookings or orders, a sign-up) is there only when the inventory shows it: a form on that page writing to a table " +
  "for it. When it does not, it is \"addon\" with that page as its target and the form as a new-component — never a " +
  "new entry in a list. Changing a component is an edit: the page's code always exists.\n" +
  "WHEN THE INVENTORY STILL CANNOT SETTLE IT, ask them (\"clarify\") where a question may be asked (said below); where " +
  "questions are closed, answer \"addon\". Cost never decides between edit and addon.\n" +
  "A REMOVAL IS NEVER AN ADDON: nothing in that lane can delete anything. If they want something to GO, it is \"edit\", " +
  "even when you are unsure of anything else.";

// ── AN ADDON ANSWER EDITS NOTHING (2026-10-26, the owner's combined test) ──
//
// Live, driftwood-and-daughters-5: six requests (hours, an email, a hire
// form, two menu items, who sees hire requests, a footer phone) were answered
// "addon" with nothing held back, and five were dropped. This rule had said
// "almost always leave this out" and "several changes one answer can make are
// one turn" ahead of the addon hold, so a model that thought addon could make
// it all held nothing. Now the addon case comes first and says what an addon
// cannot make: anything already on the site, or an addition elsewhere.
const LIVE_ALSO_RULE =
  "WHEN YOUR ANSWER IS \"addon\": it adds new things to ONE target (one page, one table or the frame) and edits " +
  "nothing. Put here, one entry each, EVERY change to something the site already has (an opening time, an email, a " +
  "phone number, a price, words, a layout) and EVERY addition to a different target. Several additions are one " +
  "\"addon\" answer only when they go on the same target.\n" +
  "WHEN YOUR ANSWER IS AN EDIT: two things said about ONE change are one change (\"make the background yellow and " +
  "the corners rounder\", \"put Book first and drop Prices\", \"change the phone number in the header and the " +
  "footer\"), and several edits one answer can make are one turn: the closing rule of `layer` says which answer. " +
  "Put here only what that answer cannot make this turn: something to add beside a change (\"make the background " +
  "yellow and add a booking form\" is a \"look\" answer holding \"add a booking form\"), or a change to stored rows " +
  "(\"data\") or to a page's exact words (\"text\") beside a change of another kind.\n" +
  "Never a detail, a reason or a restatement of a request already in your answer.";

const LIVE_LAYER =
  "Only when intent is \"edit\", and required for one. Which part of the site the change lives in; the site inventory " +
  "above says what each page, table and the frame hold.\n" +
  "\"data\" — the rows the site STORES in its tables and shows as a list: a price, a dish, a service, an opening time, " +
  "a team member. The cheapest step: prefer it whenever the thing changed is a stored row. It also deletes an existing " +
  "row taken off a list (every page showing it stops), and sorts a list by something every entry has (cheapest first, " +
  "A to Z) ACROSS THE WHOLE SITE, when they say so or name no page. It cannot leave a page out: a sort on one page they " +
  "name is \"page\", and on several pages they name the closing rule decides. Placing one entry by hand is not a sort. " +
  "A NEW entry is intent \"addon\".\n" +
  "\"text\" — ONLY the words change: a heading, a sentence, a button label, a phone number, a price or opening hours " +
  "written into a page's own sections (not stored rows). It reaches every word inside a page's sections, a button in a " +
  "hero included, which \"nav\" cannot. Words not on the page yet are intent \"addon\".\n" +
  "\"look\" — how the site LOOKS: colour, theme, dark or light, fonts, corners, the tab icon (favicon), a logo drawn or " +
  "set as text when no file is attached, the site's name and one-line description, and the language its pages are " +
  "declared in (not a translation). A colour or typeface can be for one page they name; corners and spacing are the " +
  "whole site's.\n" +
  "IT IS ALSO WHERE A REMOVAL IS WORKED OUT for anything taken off a page that stays: a section, a band, a photograph, " +
  "a 3D scene, a QR code, a behaviour (\"the accordion shouldn't open on click any more\"), a language offered. Answer " +
  "\"look\" and say what should go; you need not know which part holds it. Three removals have their own owner " +
  "instead: a whole page (\"page\" with `remove`), a row the site stores (\"data\"), and an item of the frame or the " +
  "logo (\"nav\" or \"logo\" with `remove`).\n" +
  "\"rules\" — what the site DOES with what people submit, nothing a visitor sees: who may see or add an entry, whether " +
  "an email or a text goes out, what is refused (\"don't let two people book the same slot\", \"only twenty places\", " +
  "\"close the booking form\"). THE LINE IS ENFORCEMENT AGAINST DISPLAY, AND WORDS LIKE BOOKINGS, CAPACITY, PLACES OR " +
  "LIMIT DO NOT DECIDE IT: \"rules\" when the site must start ACCEPTING or REFUSING something different; \"page\" when " +
  "a part of a page must CALCULATE OR SHOW differently from data it already gets (\"show six minus the booking " +
  "count\", \"show nothing instead of zero\"). If something new must also appear on a page, it is \"addon\".\n" +
  "\"picture\" — a photograph a page ALREADY shows, or its empty frame: swap it, fill the frame, or change which part " +
  "you see (\"his head is chopped off\", \"show more of the left\" — free, it moves the crop). The image itself, never " +
  "the words beside it. A new photograph is intent \"addon\"; taking one off is \"look\".\n" +
  "\"logo\" — the business's own logo at the top of every page, nearly always with a picture attached: the word " +
  "\"logo\" is a strong signal, and an attached picture for the header or the brand mark is this, not \"picture\". " +
  "Taking it off (\"just the name is fine\") is this with `remove`.\n" +
  "\"nav\" — THE FRAME EVERY PAGE SHARES, and nothing inside a page's own sections: the menu (its items, their order " +
  "and names, a whole list rewritten), the header's one button (its words and where it goes; a phone number suits a " +
  "trade whose customers ring), the footer's details (phone, email, address, the one opening line — a full timetable " +
  "is stored rows or a page's words), social icons and small print, how the header sits (centred, full width, not " +
  "following the scroll; its colours are \"look\"), and links written into the pages (every link with those words " +
  "moves at once). IT ADDS TO THE FRAME AS WELL AS CHANGING IT: a new menu link, footer link, contact detail or header " +
  "button is this layer. It points only at pages the site has: a link to a page it lacks is \"addon\", the page first. " +
  "Taking an item off is this with `remove`. It changes every page at once and is nearly free.\n" +
  "\"page\" — the arrangement of ONE existing page, named in `page`: move a section, lay a list out differently, a " +
  "list's order on that page alone, what a section calculates or shows. It edits that one page and leaves the rest as " +
  "they are, so a change meant for several pages is not this (the closing rule decides). Something new on the page is " +
  "intent \"addon\". IT IS ALSO WHERE A PAGE IS DELETED: that page in `page`, `remove` true.\n" +
  "\"rename\" — THE SITE'S WEB ADDRESS only, the word in <name>.gofarther.app: when they plainly ask to rename or move " +
  "the site, or to stop an old address working (\"forget the old address\"). Never the business's name in the header, " +
  "which is \"look\".\n" +
  "ONE ANSWER FOR THE WHOLE MESSAGE, CHOSEN AFTER READING EVERY CHANGE THEY ASK FOR AND WHERE EACH ONE IS — NEVER FROM " +
  "THE FIRST CHANGE ALONE. A layer other than \"look\" is the answer when it can make all of them, on every page each " +
  "one is on. When none can, answer \"look\" if it can make them all, and hold nothing back: it reaches the site's " +
  "colours, fonts, name and description, a section or band on any page, a photograph, the menu and the button as they " +
  "are, what the site enforces, its web address, and taking something off (not a stored row), and it makes each change " +
  "on its own page, so changes on different pages are one \"look\" answer even when they are all of one kind (leave " +
  "`page` out then). Hold a change back only when no one answer can make it with the rest.";

const LIVE_PAGE =
  "When layer is \"page\": the route path of the page, copied EXACTLY from the pages above (\"/\" for the home page). " +
  "A page that is not there does not exist yet: the intent is \"addon\".\n" +
  "When layer is \"look\": the page they SAID the change is on, copied the same way. Leave it out when they named none, " +
  "for the whole site, and when the changes are on more than one page. Never guess one: the page named here is the " +
  "page that gets changed.\n" +
  "For every other layer, leave it out.";

const LIVE_REMOVE =
  "For layer \"page\": true ONLY when they plainly want that whole page TAKEN AWAY (\"remove the gallery page\", " +
  "\"delete /prices\"). Taking a section off a page is not this.\n" +
  "For layer \"logo\": true when they want the logo taken off and the name shown instead; a message that ATTACHES a " +
  "picture is never a removal.\n" +
  "For layer \"nav\": true when a menu item, a footer link or the header's button should GO.\n" +
  "WITHOUT THIS FIELD NOTHING IS TAKEN AWAY: when they have asked for a page, the logo or a frame item to be gone, set it.";

// ── SEVERAL PARTS HELD BACK, ON A SITE THAT EXISTS (2026-10-03) ────────────
//
// Owner: *"Support multiple distinct deferred passages through the existing
// handoff mechanism, validating that their words belong to the request and
// ensuring they do not accidentally execute this turn."* One string held one
// part, so a message asking for an addition AND a wording change beside a
// styling change held the addition and lost the other (the mixed-work audit's
// MW3). The hand-over already carried a list; on a site that exists the router
// now gives one — each entry copied word for word, found in the message and
// taken out by every route before anything runs (`heldParts`), a list that
// cannot be read refused, never run. A first build keeps its own field.
//
// DERIVED, NEVER WRITTEN TWICE: the first sentence is swapped, found exactly
// once or the module fails to load, and every other clause is `ASK_TOOL`'s.
const FIRST_ALSO_AT =
  "A SECOND REQUEST THIS TURN CANNOT CARRY OUT — in their own words, copied EXACTLY from their message so " +
  "they can send it straight back. Whatever you put here is held back: it is taken out of what is done this " +
  "turn, and they are asked to send it next.\n";
// ── HELD BACK IS NOT DROPPED (2026-10-03, the combined request flow) ────────
//
// Owner: *"one user message can request multiple edits and additions, and all
// accepted parts are remembered and processed without the user resending
// them or keeping the browser open."* A part held back here is kept on the
// server as a part of the request and run after this answer, routed then
// against the site as it is (`builder/request.mjs`). Where that flow is not on
// (a browser that sent no message key, the synchronous path), the customer is
// still told the part and sends it. The sentence says what is true in both:
// the part is taken out of this answer and handled as a request of its own.
const LIVE_ALSO_AT =
  "EACH SEPARATE REQUEST THIS TURN CANNOT CARRY OUT, one entry for each — in their own words, copied EXACTLY " +
  "from their message. Whatever you put here is held back from your answer: it is taken out of what your " +
  "answer does, and handled after it as a request of its own.\n";
function liveAlsoAsked() {
  const d = ASK_TOOL.input_schema.properties.alsoAsked.description;
  const at = d.indexOf(FIRST_ALSO_AT);
  if (at !== 0 || d.indexOf(FIRST_ALSO_AT, at + 1) >= 0) throw new Error("site-ask: the held-back field's first sentence was not found exactly once");
  return { type: "array", items: { type: "string" }, description: LIVE_ALSO_AT + LIVE_ALSO_RULE };
}

// ── WHAT IS HELD BACK, NAMED BY ITEM NUMBER (2026-10-23, the owner) ─────────
//
// Live, saltmarsh-and-sparrow, a 20-item numbered message: the router held
// part back by copying words into `alsoAsked`, reworded them, and the route
// could not find them in the message (`route/held-unread`), so the whole
// message was refused. Owner: the router names what to hold back by ITEM
// NUMBER, not by copying words. The message is split into items by code
// (`messageItems`), shown to the router numbered, and the numbers it answers
// with are turned back into the customer's own text (`itemsToWords`), so a
// part held back by number is always found. The words form is still read.
export const HELD_ITEMS = {
  type: "array",
  items: { type: "integer" },
  description:
    "ONLY WHEN THEIR MESSAGE IS ALSO SHOWN ITEM BY ITEM (\"THEIR MESSAGE, ITEM BY ITEM\" below it). Name each item " +
    "your answer holds back by its number in brackets, instead of copying its words into alsoAsked: [5] is 5. " +
    "The same rule as alsoAsked decides what is held back — almost always nothing. When you use this, leave " +
    "alsoAsked out; the items held back, in item order, are the changes numbered 1, 2 and so on in dependsOn and " +
    "targets. Never hold back every item: at least one is what your answer makes.",
};

/**
 * THE ITEMS OF A MESSAGE, split by code, never by a model (2026-10-23).
 * `[{ n, text }]`, `n` from 1, each `text` the customer's own characters as
 * they stand in the message. A list (two or more lines that start with a
 * number and `.` or `)`, or a bullet) is split at those lines, a line that
 * follows one belonging to it; any words before the first are not an item
 * (they stay with whatever runs). Otherwise lines, and sentences within them.
 * Fewer than two items is `[]`: nothing to number.
 */
const ITEM_LINE = /^[ \t]*(?:\d{1,3}[.)]|[-*•])[ \t]+\S/;
export function messageItems(message) {
  if (typeof message !== "string") return [];
  const lines = message.split(/\r?\n/);
  if (lines.filter((l) => ITEM_LINE.test(l)).length >= 2) {
    const groups = [];
    let cur = null;
    for (const l of lines) {
      if (ITEM_LINE.test(l)) { if (cur) groups.push(cur); cur = [l]; }
      else if (cur) cur.push(l);
    }
    if (cur) groups.push(cur);
    const items = groups.map((c) => c.join("\n").trim()).filter((t) => WORD_CHAR.test(t));
    return items.length >= 2 ? items.map((text, i) => ({ n: i + 1, text })) : [];
  }
  const sentences = [];
  for (const l of lines) {
    for (const t of l.split(/(?<=[.!?])\s+/u)) if (WORD_CHAR.test(t)) sentences.push(t.trim());
  }
  return sentences.length >= 2 ? sentences.map((text, i) => ({ n: i + 1, text })) : [];
}

// ── WHICH CHANGE NEEDS WHICH, SAID BY THE MODEL (2026-10-03) ────────────────
//
// Owner: *"Explain how multiple dependent operations are ordered even when the
// user mentions prerequisites later in the sentence; let the model identify
// those relationships, with code enforcing execution state, rather than
// assuming textual order or inventing keyword rules."* The router names the
// relations; `readDepends` checks them and `builder/request.mjs` decides what
// may run. Where words sit in the message is never a dependency.
const DEPENDS_ON = {
  type: "array",
  description:
    "ONLY WHEN ONE CHANGE THEY ASK FOR NEEDS ANOTHER ONE MADE FIRST, wherever each comes in their message. Number " +
    "the changes like this: 0 is the change your answer makes; 1 is the first entry of alsoAsked, 2 the second, " +
    "and so on. For each change that has to wait, give one entry: `change` is its number, `after` the numbers of " +
    "the changes it needs done first. A change needs another ONLY when it truly uses something that other change " +
    "creates and the site does not have yet — a link to the page it makes, a row in the table it makes. Being in the " +
    "same message, being on the same page, coming later in their words, or touching the same part of the site is not " +
    "needing: changes that would each work on their own need nothing. When the change your answer makes is the one that needs another, " +
    "say so with change 0: it then waits until that one is done. Leave this out when no change needs another.",
  items: {
    type: "object",
    properties: {
      change: { type: "integer", description: "The number of the change that has to wait." },
      after: { type: "array", items: { type: "integer" }, description: "The numbers of the changes it needs done first." },
    },
    required: ["change", "after"],
  },
};

// ── WHAT EACH CHANGE TOUCHES, SAID BY THE MODEL (2026-10-08, the parallel-
// tasks batch) ──────────────────────────────────────────────────────────────
//
// Owner: *"The model should identify the requested tasks, their targets and
// dependencies using the full message, files and earlier answers; code should
// validate and enforce that plan."* Changes that touch nothing in common may
// be prepared side by side; two that reach the same page, the same shared
// part of the site or the same table are applied one after the other, however
// unrelated their wording sounds. The vocabulary is the site's own resources,
// read and checked by `readTargets` (builder/request-plan.mjs); a change with
// nothing readable is taken to touch the whole site.
const TARGETS = {
  type: "array",
  description:
    "WHAT EACH CHANGE TOUCHES, numbered as in dependsOn (0 the change your answer makes, 1 the first entry of " +
    "alsoAsked, and so on). For each change, `writes` lists what it changes and `reads` what it only refers to " +
    "without changing (a link points at a page; a row belongs to a table). Use only these, with this site's own " +
    "page paths and table names: page:/path (an existing page's content), new-page:/path (a page this change " +
    "creates), menu (the site's shared navigation), header, footer, theme (colours, fonts and the site-wide look), " +
    "identity (the site's name, description, logo or icon), data:table (a table's rows or columns), new-data:table " +
    "(a table this change creates), component:Name, new-component:Name, function:name, new-function:name (a stored " +
    "function this change creates), api:name, new-api:name (an outside connection it creates), job:name, new-job:name " +
    "(a schedule it creates), and site when a change can reach anything. " +
    "A form, section or working feature added to a page that already exists also names what it creates beside " +
    "page:/path: new-component:Name for the form or section, new-data:table for a table it needs that the site " +
    "has not got, data:table for an existing table it writes. page:/path alone means only that page's content changes. " +
    // WHAT EXISTS IS NEVER NEW (2026-10-25, router-b1): the audit's p1–p4 named
    // new-component: for features the site already had; the inventory shows them.
    "A form, section or table the site inventory already shows is never new-: name it as it is. " +
    "Name every shared part a change reaches, even when its words do not mention it. Leave a change out only when " +
    "you cannot tell what it touches.",
  items: {
    type: "object",
    properties: {
      change: { type: "integer", description: "The change's number." },
      writes: { type: "array", items: { type: "string" }, description: "What it changes." },
      reads: { type: "array", items: { type: "string" }, description: "What it refers to without changing." },
    },
    required: ["change", "writes"],
  },
};

/** The live tool's sixth answer: the site made into a phone app. */
const LIVE_APP_CLAUSE =
  "\"app\" — they want the site that ALREADY EXISTS made into a phone app: \"make this an Android app\", \"can I get " +
  "an app version for my customers\", \"put it on iPhone\". Set `platform`: \"ios\" when they name an iPhone, iPad or " +
  "Apple, otherwise \"android\". It changes nothing on the site. Talking about an app (\"would an app help me?\") is " +
  "\"ask\".";
/**
 * PHONE APPS ARE PARKED (2026-10-21, owner: "customer cant access it yet, we
 * are gonna open a different branch later"). While false the router is never
 * offered "app" and never answers it; the branch that opens apps sets it true.
 */
export const APPS_OPEN = false;
/** The live tool's security answer (2026-10-21, the security scan's phase D). */
const LIVE_SECURITY_CLAUSE =
  "\"security\" — they want their site that ALREADY EXISTS checked for security problems: \"is my site secure?\", " +
  "\"scan my CRM for security holes\", \"check if anyone can see my customers' details\". It runs a security scan and changes " +
  "nothing on the site. Asking HOW to make something secure, or asking to ADD a login or a rule, is not this: that is a change.";

/**
 * A 3D MODEL THEY ASKED FOR (2026-10-22, the owner: Meshy 7.1 through fal,
 * shown by the kit's Scene3D). A typed field beside intent "addon" — never a
 * keyword rule: the router says the request is for a 3D model, made from
 * their words or from a photograph they attached, and which page shows it.
 * The page then shows the price and asks before anything is spent.
 */
export const MODEL3D_FIELD = {
  type: "object",
  description:
    "Only with intent \"addon\", and only when they ask for a 3D MODEL to be made: a turnable 3D object of " +
    "something (\"add a 3D model of our armchair\", \"make this photo 3D\" with a photo attached). Leave it out " +
    "for anything else, including 3D-looking styling, a 3D effect on words or a picture they only want shown.",
  properties: {
    from: {
      type: "string",
      enum: ["words", "photo"],
      description: "\"photo\" when they attached a photograph and want THAT made 3D; otherwise \"words\".",
    },
    subject: {
      type: "string",
      description: "What the model is of, in a short phrase from their message (\"a walnut armchair with green cushions\").",
    },
    page: {
      type: "string",
      description: "The path of the page it goes on (\"/\", \"/shop\"), from the pages listed above; \"/\" when they name none.",
    },
  },
  required: ["from", "subject"],
};
// ── "START OVER" (owner, 2026-10-24) ──────────────────────────────────────
// Read only with intent "build" on a site that exists. The question that goes
// with it is the model's own, in `question`, with its answers as options.
/** Who asked the start-over question, as the stored question records it (`packAsk`'s `by`). */
export const START_OVER_BY = "route:startover";
const START_OVER_FIELD = {
  type: "boolean",
  description:
    "Only with intent \"build\" on a site that already exists. true when they ask to START OVER or REDESIGN EVERYTHING " +
    "(\"scrap it and start again\", \"redo the whole site\") without describing the new site in full; then also write " +
    "`question`: one plain question, in their language, saying this replaces their whole site (every page is written " +
    "again; the site as it is now is kept as a saved version they can restore) and asking whether to go ahead, with " +
    "two short options — one to go ahead, one to keep the site as it is. Nothing is rewritten until they answer yes. " +
    "When their message ANSWERS that question with yes, answer \"build\" with `startOver` true again. Leave it out " +
    "(or false) when the message is itself a full description of the site to make: that is rebuilt as described.",
};

export const LIVE_ASK_TOOL = {
  name: ASK_TOOL.name,
  description: "Say whether this message is asking for a change to the site or asking a question, answer it if it is a question, and ask for the one detail you need when what they want cannot be decided without it.",
  input_schema: {
    ...ASK_TOOL.input_schema,
    properties: {
      ...ASK_TOOL.input_schema.properties,
      // A PHONE APP OF THE SITE (2026-10-20, owner: "it has to be through model
      // calls"): a sixth answer, offered only here, on a site that exists, so a
      // first build's tool and request stay exactly as they were.
      ...(APPS_OPEN ? {
        intent: { ...ASK_TOOL.input_schema.properties.intent, enum: [...ASK_TOOL.input_schema.properties.intent.enum, "app", "security"], description: LIVE_INTENT + "\n\n" + LIVE_APP_CLAUSE + "\n\n" + LIVE_SECURITY_CLAUSE },
        platform: {
          type: "string",
          enum: ["android", "ios"],
          description: "Only with intent \"app\": \"ios\" when they name an iPhone, iPad or Apple, otherwise \"android\".",
        },
      } : { intent: { ...ASK_TOOL.input_schema.properties.intent, enum: [...ASK_TOOL.input_schema.properties.intent.enum, "security"], description: LIVE_INTENT + "\n\n" + LIVE_SECURITY_CLAUSE } }),
      layer: { ...ASK_TOOL.input_schema.properties.layer, description: LIVE_LAYER },
      page: { ...ASK_TOOL.input_schema.properties.page, description: LIVE_PAGE },
      remove: { ...ASK_TOOL.input_schema.properties.remove, description: LIVE_REMOVE },
      alsoAsked: liveAlsoAsked(),
      heldItems: HELD_ITEMS,
      dependsOn: DEPENDS_ON,
      targets: TARGETS,
      model3d: MODEL3D_FIELD,
      // WHICH SCREEN SIZES A CHANGE IS FOR (2026-10-24, per-device edits).
      devices: DEVICES_FIELD,
      startOver: START_OVER_FIELD,
      question: {
        type: "object",
        description: "Only when intent is \"clarify\", or \"build\" with `startOver` true. ONE short question, written to them, naming the one detail you need — or, for `startOver`, asking whether to replace their whole site.",
        properties: {
          text: { type: "string", description: "The question, in one or two short, plain sentences." },
          options: {
            type: "array",
            maxItems: MAX_OPTIONS,
            items: { type: "string" },
            description:
              "Up to four short answers they might give, each a few words, when the answer is one of a few things you " +
              "can name from their message or the site above. Leave it out when it is not: they can always type their own.",
          },
        },
        required: ["text"],
      },
      answered: {
        type: "boolean",
        description:
          "Only when you are told below that their last request is waiting on an answer. true when their message " +
          "answers the question they were asked; false when it asks for something else instead, or when it is a side " +
          "question or a remark (\"wait, can you also do bookings?\") — then answer \"ask\", and the question stays " +
          "waiting for their answer. Everything else you decide is for what you are answering: with true, their last " +
          "request with the answer taken into account; with false, the new message alone.",
      },
    },
  },
};

/**
 * THE ROUTER'S OWN WORDS FOR ONE LAYER — the line its tool opens that layer
 * with, read out of `ASK_TOOL` rather than written a second time.
 *
 * Asked by the lane picker on the router's removal door (`site-lanes.mjs`,
 * 2026-09-28): the picker is told which change the router already routed, and
 * the sentence that says so is the one the router itself was given when it
 * chose that layer. A second description would be a second copy of the same
 * thing, and the copy that drifts is the one nobody reads again.
 *
 * `""` FOR ANYTHING IT CANNOT FIND EXACTLY ONCE — a layer the tool does not
 * have, or a description reworded so its line no longer opens with the layer's
 * quoted name. The caller then names the layer without a description, which is
 * vaguer and never wrong.
 */
export function layerLine(layer) {
  if (typeof layer !== "string" || !EDIT_LAYERS.includes(layer)) return "";
  // THE LIVE TOOL'S WORDS (2026-10-25, router-b1): a layer is only ever chosen
  // on a site that exists, and the lane picker is told what that router read.
  const desc = String(LIVE_ASK_TOOL.input_schema.properties.layer.description || "");
  const open = "\"" + layer + "\" — ";
  const lines = desc.split("\n").filter((l) => l.startsWith(open));
  return lines.length === 1 ? lines[0].slice(open.length).trim() : "";
}

// ── WHERE A ROUTING ANSWER CAME FROM (the router audit, 2026-10-02) ─────────
//
// THE ROUTE'S ANSWER AND THE MODEL'S ANSWER ARE NOT THE SAME THING, and the
// reply could not say which it was. Several unusable answers become `addon`
// on a live site, fields the model filled are dropped or rewritten, and two
// rules decide without asking the model at all, and each of them left the
// reply looking exactly like a model that chose it. Test 11's run 88 is the
// case that made it matter: the route answered `addon`, the saved row was
// exactly right, and nothing on the wire could show whether the model had
// chosen it (the audit's R3).
//
// SO EVERY BRANCH THAT DECIDES WITHOUT THE MODEL, REPLACES ITS ANSWER, OR
// CHANGES A PART OF IT, NAMES ITSELF, from this one fixed list. `kind` sorts
// them:
//   rule      no model was asked; the answer is the rule's
//   fallback  the call failed, or the model's answer could not be used, and
//             the fallback answer was given instead
//   changed   the model's answer was used, with a part dropped or rewritten
//   context   what the model was shown was cut or filled in; its answer is
//             its own
// A reply's `source` follows from its codes: any `rule` makes it "rule", else
// any `fallback` makes it "fallback", else it is "model".
//
// REPORTING ONLY. Nothing here changes what any branch does: the readers
// return exactly what they returned before, and record into a trace only when
// a caller hands them one. And nothing of the customer's text or the model's
// free text is ever in a decision: codes from this list, and the model's own
// intent and layer read only from their own fixed lists.
export const ROUTE_REASONS = Object.freeze({
  "no-message": Object.freeze({ kind: "rule", what: "the message was empty, so no model was asked" }),
  "no-credits": Object.freeze({ kind: "rule", what: "the balance read zero, so no model was asked" }),
  "agent": Object.freeze({ kind: "rule", what: "no router: the site agent takes the whole message, so no routing model was asked (2026-11-02)" }),
  "request-failed": Object.freeze({ kind: "fallback", what: "the routing request could not be built" }),
  "send-failed": Object.freeze({ kind: "fallback", what: "the routing call failed" }),
  "no-tool-call": Object.freeze({ kind: "fallback", what: "the model's reply held no routing answer" }),
  "model3d-unread": Object.freeze({ kind: "changed", what: "a 3D model answer that could not be read was left out; the add-on step runs as before" }),
  "devices-unread": Object.freeze({ kind: "changed", what: "a screen-size answer that could not be read was left out; the change is for every screen" }),
  "intent-unknown": Object.freeze({ kind: "fallback", what: "the answer named no intent, or one that is not among the five" }),
  "clarify-closed": Object.freeze({ kind: "fallback", what: "a question back, when no question may be asked" }),
  "clarify-unreadable": Object.freeze({ kind: "fallback", what: "a question back with no usable question" }),
  // 2026-10-24, addon-existing (`builder/addon-existing.mjs`).
  "addon-existing": Object.freeze({ kind: "changed", what: "an add-on whose every target the site already has, so the page step edits that page" }),
  "clarify-part": Object.freeze({ kind: "changed", what: "a question for a part of a request already charged, so the obvious choice ran instead of asking" }),
  // A SITE THAT EXISTS (2026-10-02): a question asked where none can be kept
  // fails the call — never shown with nothing waiting for an answer; a reply
  // to a waiting question that did not say whether it answers it is a failure
  // of the answer, never read either way; and the flag on a message with no
  // question waiting is left out. A question the request already asked is
  // never put to the customer as if new: the model is asked again with its
  // answer in front of it (`clarify-reused`), and one that still asks it is
  // kept with a note naming the answer that did not settle it
  // (`clarify-again`) — the owner's second review, replacing the two endings
  // that stopped the request there.
  "clarify-unkeepable": Object.freeze({ kind: "fallback", what: "a question back where no question can be kept, a failure of the answer" }),
  // "START OVER" ON A SITE THAT EXISTS (owner, 2026-10-24): never the rewrite
  // on the first message. The router's own question is asked first; only an
  // answer to that question that says yes is the rewrite; a start-over with no
  // question it can show fails the call, never runs.
  "startover-asked": Object.freeze({ kind: "changed", what: "a request to start over: its confirmation question is asked before anything is rewritten" }),
  "startover-confirmed": Object.freeze({ kind: "context", what: "the answer to the start-over question said yes, so the rewrite may run" }),
  "startover-unasked": Object.freeze({ kind: "fallback", what: "a request to start over with no confirmation question that can be shown, a failure of the answer" }),
  "clarify-reused": Object.freeze({ kind: "context", what: "a question back the request had already asked, so the model was asked again with that answer in front of it" }),
  "clarify-again": Object.freeze({ kind: "changed", what: "the model asked again what it had been answered, shown the answer: kept with a note naming the answer that did not settle it, and never sent again on our own at the repeated-question threshold or past the total-answer limit" }),
  "answered-unread": Object.freeze({ kind: "fallback", what: "a reply to a waiting question that did not say whether it answers it" }),
  "answered-ignored": Object.freeze({ kind: "changed", what: "an answer flag on a message with no question waiting, left out" }),
  "work-without-site": Object.freeze({ kind: "fallback", what: "an edit or an add-on, with no site to change" }),
  "ask-empty": Object.freeze({ kind: "fallback", what: "a reply with nothing to say" }),
  // NARROWED 2026-10-14: an answer they picked from our options only. A typed
  // reply and a file no longer close "ask" off (`readDecision`).
  "ask-while-answering": Object.freeze({ kind: "fallback", what: "a reply to an answer they picked from our own question's options" }),
  "layer-missing": Object.freeze({ kind: "fallback", what: "an edit naming no step" }),
  "layer-unknown": Object.freeze({ kind: "fallback", what: "an edit naming a step that is not among the nine" }),
  "page-missing": Object.freeze({ kind: "fallback", what: "a page edit naming no readable page" }),
  "page-unknown": Object.freeze({ kind: "fallback", what: "a page edit naming a page the site was not said to have" }),
  "page-normalized": Object.freeze({ kind: "changed", what: "the page was rewritten to its usual spelling" }),
  "page-unreadable": Object.freeze({ kind: "changed", what: "a look edit's page could not be read as a path, so it was left out" }),
  "page-unchecked": Object.freeze({ kind: "changed", what: "a page edit's page was not checked: no page list was sent" }),
  "page-ignored": Object.freeze({ kind: "changed", what: "a page on a step that takes none, left out" }),
  "remove-not-true": Object.freeze({ kind: "changed", what: "a removal flag that was not exactly true, left out" }),
  "remove-ignored": Object.freeze({ kind: "changed", what: "a removal flag on a step with no removal of its own, left out" }),
  "tab-not-true": Object.freeze({ kind: "changed", what: "a browser-tab flag that was not exactly true, left out" }),
  "tab-ignored": Object.freeze({ kind: "changed", what: "a browser-tab flag on a step other than the logo, left out" }),
  "rename-with-remove": Object.freeze({ kind: "changed", what: "a new address beside a removal, left out (the removal wins)" }),
  "rename-not-path": Object.freeze({ kind: "changed", what: "a new address that is not a path, left out" }),
  "rename-same-page": Object.freeze({ kind: "changed", what: "a new address that is the page's own, left out" }),
  "rename-normalized": Object.freeze({ kind: "changed", what: "the new address was rewritten to its usual spelling" }),
  "rename-ignored": Object.freeze({ kind: "changed", what: "a new address on a step other than the page step, left out" }),
  "edit-fields-ignored": Object.freeze({ kind: "changed", what: "an edit's fields on an answer that is not an edit, left out" }),
  "also-not-text": Object.freeze({ kind: "changed", what: "a held-back part that was not text, left out" }),
  "also-too-long": Object.freeze({ kind: "changed", what: "a held-back part longer than any message, left out" }),
  // SEVERAL PARTS HELD BACK (2026-10-03): the router gave a list, each part its
  // own entry, carried as the hand-over's list and taken out by every route.
  "also-several": Object.freeze({ kind: "context", what: "several separate parts were held back, each its own entry" }),
  // HELD BACK BY ITEM NUMBER (2026-10-23, `itemsToWords`).
  "items-shown": Object.freeze({ kind: "context", what: "the message was shown to the router item by item" }),
  "items-held": Object.freeze({ kind: "context", what: "items were held back by number, taken as the customer's own text" }),
  "items-out": Object.freeze({ kind: "changed", what: "a held-back item number that is not an item, ignored" }),
  "items-all-held": Object.freeze({ kind: "changed", what: "every item was held back; the first stays with the answer" }),
  "items-unread": Object.freeze({ kind: "changed", what: "held-back item numbers that could not be read, left out" }),
  "items-ignored": Object.freeze({ kind: "changed", what: "held-back item numbers with no items shown, left out" }),
  // WHICH CHANGE NEEDS WHICH (2026-10-03, `readDepends`): named by the model,
  // or unreadable and left out whole — the parts then carry no stated order.
  "depends-named": Object.freeze({ kind: "context", what: "the answer said which changes need others done first" }),
  "depends-unread": Object.freeze({ kind: "changed", what: "which changes need others could not be read whole, so no order was taken from it" }),
  "also-ignored": Object.freeze({ kind: "changed", what: "a held-back part on an answer that carries none, left out" }),
  "also-dropped": Object.freeze({ kind: "changed", what: "a held-back part beside an edit answer that could not be used, left out: the step it falls to gets the whole message" }),
  "answer-ignored": Object.freeze({ kind: "changed", what: "reply text on an answer that is not a reply, left out" }),
  "question-ignored": Object.freeze({ kind: "changed", what: "a question on an answer that is not a question back, left out" }),
  "question-clipped": Object.freeze({ kind: "changed", what: "the question's text was shortened" }),
  "options-changed": Object.freeze({ kind: "changed", what: "the question's options were shortened, deduplicated or cut" }),
  // A FIRST BUILD'S MESSAGE AND BRIEF ONLY (2026-10-03): a site that exists is
  // shown its message whole, and every page it has (`pages-filled` when the
  // route read them itself); `pages-cut` is gone with the 24-page cut.
  "message-cut": Object.freeze({ kind: "context", what: "the router was shown only the first 2,000 characters of a first build's message" }),
  "brief-cut": Object.freeze({ kind: "context", what: "the router was shown only the brief's first 2,000 characters" }),
  "pages-filled": Object.freeze({ kind: "context", what: "the route listed the site's own pages, read from what it publishes" }),
  "page-unverified": Object.freeze({ kind: "changed", what: "a page edit naming a page missing from a list the route could not confirm was complete, kept as an edit for the edit step to check against the site" }),
  // A ROUTING ANSWER CUT OFF AT ITS OWN CEILING IS NO ANSWER (2026-10-03): half
  // a held-back part, or a page cut mid-word, is never acted on.
  "answer-cut": Object.freeze({ kind: "fallback", what: "the routing answer was cut off at its length limit, a failure of the answer" }),
  "tables-cut": Object.freeze({ kind: "context", what: "the router was shown fewer table names than were sent" }),
  "tables-filled": Object.freeze({ kind: "context", what: "the route filled in the site's own table names" }),
  // A SITE READ TO HAVE NO TABLES (2026-10-05, the owner's review): told so in
  // words, never left to look like a site whose tables are unknown.
  "tables-none": Object.freeze({ kind: "context", what: "the route read the site's own tables and found none, and the router was told so" }),
  // THE CONVERSATION (2026-10-14): shown in its small window, cut, and a
  // request the model wrote out from it — or one it gave where none is read.
  "history-shown": Object.freeze({ kind: "context", what: "the router was shown the conversation's most recent messages" }),
  "history-cut": Object.freeze({ kind: "context", what: "the router was shown only part of the conversation the page sent" }),
  "resolved": Object.freeze({ kind: "context", what: "the work was written out in full from the conversation, and runs in place of the message's own words" }),
  "resolved-unread": Object.freeze({ kind: "changed", what: "a written-out request that was not text or was too long, left out: the message's own words run" }),
  "resolved-ignored": Object.freeze({ kind: "changed", what: "a written-out request on an answer that is not work, or with no conversation shown, left out" }),
  // A REFERENCE IT COULD NOT PIN DOWN (2026-10-15, the conversation batch):
  // carried to the reply so it asks one focused question about exactly it.
  "unclear": Object.freeze({ kind: "context", what: "the message leans on something that could not be pinned down, named for the reply's one focused question" }),
  "unclear-unread": Object.freeze({ kind: "changed", what: "a note of what is unclear that was not text or was too long, left out" }),
  "unclear-ignored": Object.freeze({ kind: "changed", what: "a note of what is unclear on an answer that is not \"ask\", left out" }),
});

/** The router's intents, read from its own tool so the two cannot drift. */
const ROUTE_INTENTS = LIVE_ASK_TOOL.input_schema.properties.intent.enum;

/** A name the model gave, read only from its own fixed list: "none" when it gave none, "other" when it gave something else. */
function rawName(v, list) {
  if (v === undefined || v === null || v === "") return "none";
  return typeof v === "string" && list.includes(v) ? v : "other";
}

/**
 * The decision a route reports: its source, its reason codes in the order they
 * applied, and, when a model answered at all, the intent and layer it named.
 *
 * A CODE NOT ON THE LIST IS DROPPED, so a caller cannot widen the list by
 * passing one; a code named twice is kept once. `input` is the model's own
 * routing answer (an empty object when its reply held none) or undefined when
 * no model answered: a rule decided, or the call itself failed.
 */
export function routeDecision(reasons, input) {
  const codes = [];
  for (const c of Array.isArray(reasons) ? reasons : []) {
    if (typeof c === "string" && Object.hasOwn(ROUTE_REASONS, c) && !codes.includes(c)) codes.push(c);
  }
  const has = (kind) => codes.some((c) => ROUTE_REASONS[c].kind === kind);
  const decision = { source: has("rule") ? "rule" : has("fallback") ? "fallback" : "model", reasons: codes };
  if (input !== undefined) {
    const i = input && typeof input === "object" ? input : {};
    decision.raw = { intent: rawName(i.intent, ROUTE_INTENTS), layer: rawName(i.layer, EDIT_LAYERS) };
  }
  return decision;
}

/**
 * A page path, in the one spelling everything downstream compares against.
 *
 * The model copies these out of a list we wrote, and it will still occasionally
 * hand back "menu", "/menu/" or "/Menu" — none of which is a different page, and
 * all of which would fail an equality check and send an ordinary edit up the
 * ladder to a lane that would try to ADD a page the site already has.
 */
export function normalizePagePath(raw) {
  let s = String(raw == null ? "" : raw).trim();
  if (!s) return "";
  s = s.split(/[?#]/)[0].trim();
  if (!s) return "";
  if (!s.startsWith("/")) s = "/" + s;
  if (s.length > 1) s = s.replace(/\/+$/, "") || "/";
  return s.toLowerCase().slice(0, 120);
}

// ── THE CUSTOMER'S OWN WORDS, FOUND IN THEIR OWN MESSAGE (2026-09-29) ───────
//
// Two readers need to know WHERE in a message a stretch of the customer's
// words sits: the edit and add-on routes, to take out a part the router held
// back (`heldBack`), and the lane picker, to hand each operation the words
// that ask for it and no others (`readScopes` in site-lanes.mjs). A model
// copies those words out of the message; this checks the copy.
//
// FOUND, NEVER GUESSED. The comparison forgives only what copying changes
// without changing the words: letter case, runs of spaces and line breaks,
// curly against straight quotes, and a full stop or comma at the very end of
// the copy. Anything else is not found, and each caller says what that means
// for it — no piece of text is ever attributed to an operation on a likeness.
//
// ON WORD BOUNDARIES, so "menu" is never found inside "menus", and a short
// copy cannot cut the middle out of an unrelated word.
const FOLD_QUOTES = Object.freeze({
  "\u2018": "'", "\u2019": "'", "\u201A": "'", "\u201B": "'", "\u2032": "'",
  "\u201C": '"', "\u201D": '"', "\u201E": '"', "\u201F": '"', "\u2033": '"',
});
const WORD_CHAR = /[\p{L}\p{N}]/u;

/** The text folded for comparison, and where each folded character came from. */
function foldForFind(raw) {
  const text = String(raw == null ? "" : raw);
  let norm = "";
  const at = [];
  let gap = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (/\s/.test(c)) { gap = norm.length > 0; continue; }
    if (gap) { norm += " "; at.push(i); gap = false; }
    const f = Object.hasOwn(FOLD_QUOTES, c) ? FOLD_QUOTES[c] : c.toLowerCase();
    for (const ch of f) { norm += ch; at.push(i); }
  }
  return { norm, at };
}

/**
 * Every place `words` occurs in `message`, as `[start, end)` offsets into the
 * message. A full stop or comma the copy ended with is not needed to find it,
 * and is kept when the message has the same one right there — so the text
 * handed on is the customer's own, to the last character.
 */
export function wordSpans(message, words) {
  // A NON-STRING IS NOTHING, NEVER COERCED: `String(["a"])` is "a".
  if (typeof message !== "string" || typeof words !== "string") return [];
  const text = message;
  const copy = words.trim();
  const trail = (/[.,;:!?]+$/u.exec(copy) || [""])[0];
  const want = foldForFind(copy.replace(/[\s.,;:!?]+$/u, "")).norm;
  if (!want) return [];
  // A BOUNDARY IS ASKED FOR ONLY WHERE THE COPY'S OWN EDGE IS A LETTER OR A
  // DIGIT: a copy that starts with a quote may sit right against a word.
  const openEdge = WORD_CHAR.test(want[0]);
  const shutEdge = WORD_CHAR.test(want[want.length - 1]);
  const hay = foldForFind(text);
  const spans = [];
  let from = 0;
  for (;;) {
    const k = hay.norm.indexOf(want, from);
    if (k < 0) break;
    const before = k > 0 ? hay.norm[k - 1] : "";
    const after = hay.norm[k + want.length] || "";
    if ((openEdge && WORD_CHAR.test(before)) || (shutEdge && WORD_CHAR.test(after))) { from = k + 1; continue; }
    const end = hay.at[k + want.length - 1] + 1;
    spans.push([hay.at[k], trail && text.startsWith(trail, end) ? end + trail.length : end]);
    from = k + want.length;
  }
  return spans;
}

/**
 * THE CUSTOMER'S OWN TEXT FOR `words`, exactly as it stands in `message`, or
 * `""` when those words are not in it. The first place they occur: the same
 * words twice are the same text.
 */
export function wordsIn(message, words) {
  const spans = wordSpans(message, words);
  return spans.length ? message.slice(spans[0][0], spans[0][1]) : "";
}

// NO NUMBER OF PARTS PUT OFF IS A LIMIT ANY MORE (2026-10-03). `MAX_HELD` (4)
// refused a hand-over carrying a fifth part, and with it the whole message.
// Every part is a passage of one message — each is found in it before anything
// runs (`heldParts`) — and what a request carries across a question is bounded
// by the size policy (`MAX_CARRIED_CHARS`), which is the constraint a count was
// standing in for; so the list is bounded by that, and by nothing else.

/**
 * THE PARTS PUT OFF, AS A LIST — what a hand-over's `alsoAsked` may be on the
 * wire (2026-10-02, the whole-router audit's batch 2). A string is one part, a
 * list is several; absent (`null` or missing), a blank string or an empty list
 * is none. `null` when the value cannot be read: a list with an entry that is
 * not text, a blank one, one longer than any message (`MAX_INPUT_CHARS`, the
 * size policy), parts more than one request carries together
 * (`MAX_CARRIED_CHARS`), or a value that is neither text nor a list. A
 * NON-STRING IS NEVER COERCED (`String(["a"])` is "a"), and a value that cannot
 * be read is never read as none: the caller refuses, because running the
 * message whole would run the parts meant for later.
 */
export function heldList(v) {
  if (v == null) return [];
  if (typeof v === "string") return v.trim() ? [v.trim()] : [];
  if (!Array.isArray(v)) return null;
  const out = [];
  let chars = 0;
  for (const p of v) {
    if (typeof p !== "string" || !p.trim() || p.length > MAX_INPUT_CHARS) return null;
    if (out.includes(p.trim())) continue;
    chars += p.trim().length;
    if (chars > MAX_CARRIED_CHARS) return null;
    out.push(p.trim());
  }
  return out;
}

/**
 * A MESSAGE WITH EVERY PART PUT OFF TAKEN OUT (2026-10-02, batch 2) — the
 * router's one part and any a step put off as its net, carried together by a
 * hand-over.
 *
 *   { ok: true,  run, held: [..] } — `run` is what this turn does; `held` is
 *                                   each part taken out, in the customer's own
 *                                   spelling, `[]` when nothing was put off.
 *   { ok: false, run, held: [] }   — a part is not in the message, the list
 *                                   cannot be read, or nothing would be left.
 *                                   The caller refuses rather than run the
 *                                   message whole.
 *
 * EVERY OCCURRENCE OF EVERY PART GOES, and parts that overlap are taken out
 * once, as one stretch of the message.
 */
/**
 * THE JOINS A TAKEN-OUT PART LEAVES BEHIND, TIDIED (2026-10-31, live: the
 * flat-white part of "Add a flat white…, add a Gallery page, and put our phone
 * number … in the header." ran on "…to the café menu, , and ."). Only the
 * separators and joining words at the gaps go — commas, semicolons and a
 * dangling "and"/"then"/"also" — never a word of the customer's own request.
 * A caller that finds the run again by position in the message (the request
 * planner) asks for it untidied (`{ tidy: false }`).
 */
export function tidyJoins(run) {
  return String(run || "")
    .replace(/\s+([,;.!?])/g, "$1")
    .replace(/([,;])(?:\s*[,;])+/g, "$1")
    .replace(/[,;]\s*([.!?]|$)/g, "$1")
    .replace(/[,;]?\s*\b(?:and|then|also|plus)\b\s*([.!?]|$)/gi, "$1")
    .replace(/([.!?])(?:\s*[.!?])+/g, "$1")
    .replace(/^(?:\s*(?:[,;.!?]|\b(?:and|then|also|plus)\b))+\s*/i, "")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function heldParts(message, later, { tidy = true } = {}) {
  const text = typeof message === "string" ? message : "";
  const parts = heldList(later);
  if (parts === null) return { ok: false, run: text, held: [] };
  if (!parts.length) return { ok: true, run: text, held: [] };
  const each = [];
  for (const p of parts) {
    const spans = wordSpans(text, p);
    if (!spans.length) return { ok: false, run: text, held: [] };
    each.push(spans);
  }
  const all = each.flat();
  // A PART INSIDE ANOTHER IS THAT PART, NOT A SECOND ONE: "a map" put off
  // beside "add a map" is named once, as the longer stretch it lies in. Taken
  // out either way; only the list the customer is read back is folded.
  const inside = (a, b) => b[0] <= a[0] && a[1] <= b[1] && b[1] - b[0] > a[1] - a[0];
  const held = [];
  each.forEach((spans, i) => {
    if (spans.every((sp) => each.some((other, j) => j !== i && other.some((o) => inside(sp, o))))) return;
    held.push(text.slice(spans[0][0], spans[0][1]));
  });
  all.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let run = "";
  let at = 0;
  for (const [s, e] of all) {
    if (e <= at) continue;
    run += text.slice(at, Math.max(s, at));
    at = e;
  }
  run = (run + text.slice(at)).replace(/[ \t]{2,}/g, " ").trim();
  if (tidy) run = tidyJoins(run);
  if (!WORD_CHAR.test(run)) return { ok: false, run: text, held: [] };
  return { ok: true, run, held: [...new Set(held)] };
}

/** Why a question a model asked cannot be shown whole (`readAsk`). */
export const ASK_UNUSABLE = Object.freeze(["too-long", "text-unreadable", "options-unreadable"]);

/**
 * A QUESTION FOR A SITE THAT EXISTS, or null when none was asked (2026-10-02)
 * — the router's and every step's (`builder/clarify.mjs`). Unlike a first
 * build's, its answers are optional: a typed answer is always taken, and the
 * model may offer answers to press.
 *
 * KEPT WHOLE: NEVER CUT, NO ANSWER DROPPED (2026-10-03, the owner's first
 * information-limits batch: *"Preserve the meaning of model-written questions
 * and answer options: do not cut questions mid-sentence, silently discard
 * choices, or submit a shortened option as the user's answer. Keep
 * concise-question guidance in the prompt, and handle an unusable model
 * response without guessing or losing the waiting request."*). The words were
 * clipped at 240 characters with "…" and each answer at 48 with no mark — and a
 * pressed answer was sent as the clipped words — a fifth answer was dropped and
 * a lone one too. Now:
 *
 *   * the words and every answer are kept as the model wrote them: spacing
 *     tidied, an answer said twice kept once, a blank one is no answer;
 *   * the question with its answers is ONE MESSAGE of the conversation, bounded
 *     as every message is (`MAX_INPUT_CHARS`, the size policy);
 *   * one that cannot be shown whole — past that bound, or with words or
 *     answers that are not text — is UNUSABLE, `{ unusable: true, why }`, and
 *     never a shorter question. Every reader takes it as a question it cannot
 *     ask: the router fails the call (nothing run or billed; a waiting request
 *     stays waiting), a step stops before anything it proposed beside it, and
 *     the route says so with what was left of the request back in the message
 *     box (`askReport`). It is never stored and never drawn. Read again, it
 *     stays what it is.
 *
 * How short a question should be is the tools' guidance (`QUESTION_FIELD`: one
 * or two short sentences, up to four short answers), never a cut. Nothing is
 * coerced: `String(["a","b"])` is "a,b".
 */
export function readAsk(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  if (raw.unusable === true) return { unusable: true, why: ASK_UNUSABLE.includes(raw.why) ? raw.why : "text-unreadable" };
  const unusable = (why) => ({ unusable: true, why });
  if (raw.text === undefined || raw.text === null) return null;
  if (typeof raw.text !== "string") return unusable("text-unreadable");
  const text = raw.text.trim().replace(/\s+/g, " ");
  if (!text) return null;
  if (raw.options !== undefined && raw.options !== null && !Array.isArray(raw.options)) return unusable("options-unreadable");
  const seen = new Set();
  const options = [];
  for (const o of Array.isArray(raw.options) ? raw.options : []) {
    if (typeof o !== "string") return unusable("options-unreadable");
    const label = o.trim().replace(/\s+/g, " ");
    if (!label || seen.has(label.toLowerCase())) continue;
    seen.add(label.toLowerCase());
    options.push(label);
  }
  if (text.length + options.reduce((n, o) => n + o.length, 0) > MAX_INPUT_CHARS) return unusable("too-long");
  return { text, options };
}

/** A question that can be asked: read, and not unusable. */
export function usableAsk(raw) {
  const q = readAsk(raw);
  return q && q.unusable !== true ? q : null;
}

// ── WHAT THEY ALREADY TOLD US, ON A SITE THAT EXISTS (2026-10-02) ───────
//
// The answers to a request's questions, kept beside it and never in it. Here,
// beside `readAsk`, because the router reads them as every step does — and
// `clarify.mjs`, which the steps import, re-exports them from here.

/**
 * THE TOTAL-ANSWER LIMIT: once a request carries this many answers, nothing is
 * sent to a model again on our own. NEVER PERMISSION TO ACT (2026-10-03, the
 * owner's third review: *"Never treat a question limit or repeated question as
 * permission to act. If a model still needs clarification, preserve the
 * pending request, relevant answers, unfinished operations, and attachments …
 * Stop automatic retry loops while keeping a user-driven way to clarify or
 * cancel"*). A request carrying this many is still offered its question, and
 * one a model asks is kept with everything the request needs. What stops at
 * the limit is our own re-asking — no model is sent the request again with an
 * answer it asked for (`clarifyTransport`, the router's re-ask) — so every
 * further round is the customer's: an answer, or Cancel.
 *
 * IT BOUNDS NO STORAGE (2026-10-03, the owner's fourth review: *"appendAnswer
 * must not discard an answer needed by unfinished work merely because 12
 * answers already exist. Separate the stored clarification history from any
 * bounded model-input window"*): every answer stays in the request's history
 * (`MAX_HISTORY`, `appendAnswer`); this number only says when our re-asking
 * stops.
 */
export const MAX_ASKED = 12;

/**
 * HOW MANY ANSWERS ONE REQUEST'S HISTORY HOLDS — a size bound on what is
 * stored and carried (the question record, the routing answer, the posts, a
 * queued job, a hand-over), never a window (2026-10-03, the owner's fourth
 * review). No answer still needed is ever let go to stay under it, and none is
 * chosen by its age (`appendAnswer`). What a model is shown is retrieved from
 * this history for its own operation — the answers the picker named for its
 * change, or, for the router and the pickers that decide that, every answer
 * still needed — never a slice of it (`shownContext`, the picker's `answers`).
 * The browser carries the list to the same bound (`CONTEXT_MAX` in
 * public/edit-poll.js), which is also its bound on a request's question count
 * (`ASKED_MAX`).
 */
export const MAX_HISTORY = 64;

/**
 * THE REPEATED-QUESTION THRESHOLD: how many times the customer answers one
 * question before a model asking it again is no longer sent the request again
 * on our own. Below it, a model that asks what was answered is sent its answer
 * back once (`withReuse`), to act on it or ask a more specific question. At
 * it, the model's question is put to the customer as it came, under a note
 * naming the answers that did not settle it (`againNote`), and nothing beside
 * it is done — never permission to act on a guess (2026-10-03, the owner's
 * third review). They answer once more, or cancel; the request waits.
 */
export const MAX_SAME_ASK = 2;

/**
 * THE LONGEST ANSWER KEPT BESIDE A REQUEST: one message, so the size policy's
 * (`MAX_INPUT_CHARS`, input-budget.mjs). It was 500 characters (2026-10-03, the
 * owner: *"remove the arbitrary … 500-character clarification-answer
 * restriction"*): an answer that quoted a heading or listed a week's hours was
 * refused for its length alone. What a request carries in all is bounded by
 * `MAX_CARRIED_CHARS`, checked where an answer joins it.
 */
export const MAX_ANSWER_CHARS = MAX_INPUT_CHARS;

/** The longest note a question asked once more is shown under (`againNote`). */
export const MAX_NOTE_CHARS = 300;

/**
 * WHAT THEY ALREADY TOLD US (2026-10-02, the owner's second review): each
 * question this request asked, with the answer given, in order — `{ q, a }`,
 * and `handled: true` on an answer about a part this request no longer holds
 * (made, refused or put off beside the question that came after it). Carried
 * BESIDE the request by every hop — the stored question, the routing answer,
 * the browser's posts, a queued job, a hand-over — and never folded into it.
 * `[]` for none; `null` for a value that is not such a list, which no caller
 * reads as none.
 */
export function readContext(v) {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v) || v.length > MAX_HISTORY) return null;
  const out = [];
  for (const p of v) {
    if (!p || typeof p !== "object" || Array.isArray(p) || typeof p.q !== "string" || typeof p.a !== "string") return null;
    if (p.handled !== undefined && p.handled !== true) return null;
    const q = p.q.trim();
    const a = p.a.trim();
    // EACH ONE MESSAGE (2026-10-03): a question as the builder asked it, whole,
    // and an answer as they gave it — the size policy's bound for both.
    if (!q || !a || q.length > MAX_INPUT_CHARS || a.length > MAX_ANSWER_CHARS) return null;
    // WHO ASKED IT, when one call inside a step did (`packAsk`'s `by`): read
    // strictly — anything else makes the list unread, never a shorter one.
    if (p.by !== undefined && (typeof p.by !== "string" || !/^[a-z]+:[a-z]{1,24}$/.test(p.by))) return null;
    const by = p.by === undefined ? {} : { by: p.by };
    out.push(p.handled === true ? { q, a, handled: true, ...by } : { q, a, ...by });
  }
  return out;
}

/** The answers a model is shown: every one about a part this request still holds. */
export function shownContext(context) {
  return (readContext(context) || []).filter((p) => p.handled !== true);
}

/** A question's words as they are compared: case, accents, spacing and punctuation set aside. */
function askKey(text) {
  return String(text || "").normalize("NFKD").replace(/\p{M}+/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

/**
 * HAS THIS REQUEST ALREADY ASKED THIS? Every answered pair — shown or handled
 * — whose question, set side by side with this one (`askKey`), is the same;
 * `[]` when none is. Such a question is never put to the customer as if it
 * were new: its answer exists, and the model is shown it (`clarifyTransport`).
 */
export function repeatOf(context, question) {
  const k = askKey(question && question.text);
  if (!k) return [];
  return (readContext(context) || []).filter((p) => askKey(p.q) === k);
}

/**
 * ONE MORE ANSWER IN THE REQUEST'S HISTORY, AND NONE LET GO THAT IS STILL
 * NEEDED (2026-10-03, the owner's fourth review: *"appendAnswer must not
 * discard an answer needed by unfinished work merely because 12 answers
 * already exist … Do not infer irrelevance from age or assume a later answer
 * to the same question replaces all earlier details."*). The answer joins the
 * end and every answer before it stays — however old, and whether or not its
 * question was answered again since: each answer can carry a detail of its
 * own. Past `MAX_ASKED` answers this only means our re-asking has stopped.
 *
 * Only at the history's own size bound (`MAX_HISTORY`) is room made, and only
 * by an answer no unfinished part needs: the first `handled` one, which the
 * picker named only for work that ran, failed or was withheld — never shown to
 * a model again, kept only to answer the same question if it comes back.
 * When every answer is still needed, none is let go: `null`, and the routing
 * route refuses the new answer with its question still waiting
 * (`answers-full`). `null` too when the list or the answer cannot be read (an
 * answer longer than `MAX_ANSWER_CHARS` included): a caller refuses it rather
 * than keeping less. The router reads the list through this as the route
 * stores it, so both see the same answers.
 */
export function appendAnswer(context, pair) {
  const told = readContext(context);
  const one = readContext([pair]);
  if (told === null || one === null || one.length !== 1 || one[0].handled === true) return null;
  const list = [...told, one[0]];
  if (list.length > MAX_HISTORY) {
    const at = list.findIndex((p) => p.handled === true);
    if (at < 0) return null;
    list.splice(at, 1);
  }
  return list;
}

/** The section the answers are shown under, by its first words. */
export const CONTEXT_HEADING = "WHAT THEY ALREADY TOLD YOU";

/**
 * THE ANSWERS, AS A MODEL IS SHOWN THEM: a numbered section of their own, after
 * everything else it is sent, labelled as what they are — details of the
 * request above, never a change of their own. The lane picker names these
 * numbers for each change it scopes (`answers` on a scope); "" when there are
 * none to show.
 */
export function contextBlock(context) {
  const list = shownContext(context);
  if (!list.length) return "";
  return CONTEXT_HEADING + " — their answers to questions asked about the request above. Use them to settle " +
    "its details. They are never a change of their own: do only what the request asks.\n" +
    list.map((p, i) => (i + 1) + ". Asked: “" + p.q + "”\n   They answered: “" + p.a + "”").join("\n");
}

/** The same model request with `text` after its last user message's own words. */
function afterLastUser(request, text) {
  if (!text || !request || typeof request !== "object" || !Array.isArray(request.messages)) return request;
  for (let i = request.messages.length - 1; i >= 0; i--) {
    const m = request.messages[i];
    if (!m || m.role !== "user") continue;
    let content;
    if (typeof m.content === "string") content = m.content + "\n\n" + text;
    else if (Array.isArray(m.content)) content = [...m.content, { type: "text", text }];
    else return request;
    const messages = request.messages.slice();
    messages[i] = { ...m, content };
    return { ...request, messages };
  }
  return request;
}

/** A model request with `text` after everything else it holds, for a caller's own note (`clarifyTransport`'s default note). */
export function withNote(request, text) {
  return afterLastUser(request, typeof text === "string" ? text : "");
}

/** A model request with the answers in their own section; the request itself when there are none to show. */
export function withContext(request, context) {
  return afterLastUser(request, contextBlock(context));
}

// ── ONE PART OF A LONGER REQUEST KEEPS WHAT ITS WORDS REFER TO (2026-10-03) ──
//
// Owner: *"preserve context so references like 'it' remain meaningful."* A
// part run on its own words loses their referent: in "add a gallery page and
// put it in the menu", the part "put it in the menu" does not say what "it"
// is. So every model call made for a part of a request is shown, after
// everything else it holds, the whole message the part came from and what the
// parts before it really did — for reference only. The part's own words stay
// the only thing it may act on, and no step's request builder changes: the
// router adds it (`askRequest`'s `part`), and every step's calls through the
// transport that adds the answers (`clarifyTransport`'s `part`).
export const PART_HEADING = "THE WHOLE REQUEST THIS PART CAME FROM";

/**
 * `{ original, done: [{ words, said }] }`, or `null` when there is nothing to
 * show or it cannot be read. Never coerced, never cut: a value past what one
 * request carries (`MAX_CARRIED_CHARS`) is not read at all.
 */
export function readPartOf(v) {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const original = typeof v.original === "string" ? v.original.trim() : "";
  if (!original || original.length > MAX_INPUT_CHARS) return null;
  const done = [];
  let chars = original.length;
  for (const d of Array.isArray(v.done) ? v.done : []) {
    if (!d || typeof d !== "object" || typeof d.words !== "string" || typeof d.said !== "string") return null;
    const words = d.words.trim();
    const said = d.said.trim();
    if (!words || !said) return null;
    chars += words.length + said.length;
    if (chars > MAX_CARRIED_CHARS) return null;
    done.push({ words, said });
  }
  // WHERE THE OTHER PARTS' WORDS STAND (`partOf`, 2026-10-12): a list that
  // does not read is none, so the part is shown as it was before.
  const others = readSpans(v.others, original, v.original);
  return { original, done, ...(others.length ? { others } : {}) };
}

/**
 * OFFSETS INTO A PART'S MESSAGE (`partOf`'s `others`): `[[start, end), …]`,
 * integers, each inside the message, in order and never overlapping — read
 * only against the message exactly as it was sent (`raw`), so an offset
 * never lands on other text. Anything else is no list (`[]`).
 */
export function readSpans(v, original, raw) {
  if (!Array.isArray(v) || !v.length || raw !== original) return [];
  let pos = 0;
  const out = [];
  for (const sp of v) {
    if (!Array.isArray(sp) || sp.length !== 2 || !Number.isInteger(sp[0]) || !Number.isInteger(sp[1])) return [];
    if (sp[0] < pos || sp[1] <= sp[0] || sp[1] > original.length) return [];
    out.push([sp[0], sp[1]]);
    pos = sp[1];
  }
  return out;
}

/**
 * THE WHOLE MESSAGE WITH EVERY OTHER PART'S WORDS MARKED (2026-10-12, run
 * 137): each place another part's words stand is wrapped as another part's, so
 * a step shown the whole message for its references can tell, word for word,
 * which of it is not its work. Nothing is cut: the message stays whole, so
 * "it" and "that page" still read.
 */
function markedOriginal(original, spans) {
  let out = "";
  let pos = 0;
  for (const [s, e] of spans) {
    out += original.slice(pos, s) + "⟦ANOTHER PART: " + original.slice(s, e) + "⟧";
    pos = e;
  }
  return out + original.slice(pos);
}

export function partBlock(part) {
  const p = readPartOf(part);
  if (!p) return "";
  const others = p.others || [];
  const isolate = others.length
    ? "\nTHE WORDS MARKED ⟦ANOTHER PART: …⟧ ARE OTHER PARTS OF THE REQUEST, each made by its own step. They are here " +
      "only so you can read what this part refers to. Never make any change they ask for: not on a page this step " +
      "writes, not inside what this part adds, not as a side effect — even when a page you are writing is the page " +
      "they name. Leave everything they would change exactly as it is."
    : "";
  return PART_HEADING + " — for what this part's words refer to (\"it\", \"that page\", \"there\") and nothing " +
    "else. Do only what this part asks; the rest of the request is handled on its own:\n“" + markedOriginal(p.original, others) + "”" + isolate +
    (p.done.length
      ? "\nWHAT THE PARTS BEFORE THIS ONE DID, in order:\n" + p.done.map((d, i) => (i + 1) + ". “" + d.words + "” — " + d.said).join("\n")
      : "");
}

/** A model request with the part's section after everything else; the request itself when there is none. */
export function withPart(request, part) {
  return afterLastUser(request, partBlock(part));
}

/**
 * THE NOTE A MODEL IS SENT AGAIN WITH, when it asked what was already
 * answered: every answer to that question, and the two things it may do with
 * them — act, or ask a more specific question naming what they left open.
 */
export function reuseNote(hit) {
  const list = readContext(hit) || [];
  return "YOU ASKED THEM THIS ALREADY, and they answered:\n" +
    list.map((p) => "Asked: “" + p.q + "” — they answered: “" + p.a + "”").join("\n") +
    "\nNever ask it again. If their answer settles it, act on it now. If it does not, ask them a MORE SPECIFIC " +
    "question that names exactly what their answer left open.";
}

/** A model request sent again with the note above, after everything else it holds. */
export function withReuse(request, hit) {
  return afterLastUser(request, reuseNote(hit));
}

/**
 * THE LINE A QUESTION ASKED ONCE MORE IS SHOWN UNDER: the answer that did not
 * settle it, in the customer's own words (cut to fit), so the same question is
 * never put to them as if it were new.
 *
 * AT THE REPEATED-QUESTION THRESHOLD (`MAX_SAME_ASK` answers to it), the line
 * names the last two answers and both ways on — answer once more, or cancel —
 * since nothing is sent to a model again on our own and nothing is done on a
 * guess (2026-10-03, the owner's third review). It never says nothing changed:
 * beside a step's question, other parts of the message may have been made.
 */
export function againNote(hit) {
  const list = readContext(hit) || [];
  const cut = (s, n) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);
  if (list.length >= MAX_SAME_ASK) {
    const head = "I’ve asked this before, and your answers — ";
    const tail = " — haven’t settled it. Answer once more, or cancel this request and nothing more will be done for it.";
    const last = list.slice(-MAX_SAME_ASK);
    const room = Math.floor((MAX_NOTE_CHARS - head.length - tail.length - ", then ".length * (last.length - 1)) / last.length) - 2;
    return head + last.map((p) => "“" + cut(p.a, room) + "”").join(", then ") + tail;
  }
  const last = list.length ? list[list.length - 1].a : "";
  const said = last.length > 160 ? last.slice(0, 157).trimEnd() + "…" : last;
  const note = said
    ? "Your answer — “" + said + "” — didn’t settle this, so I need to ask once more."
    : "Your answer didn’t settle this, so I need to ask once more.";
  return note.slice(0, MAX_NOTE_CHARS);
}


/**
 * The brief the build actually runs on, once the questions have been answered.
 *
 * THIS IS THE PART THAT WOULD SILENTLY LOSE THE BRIEF. The composer sends the
 * message the customer just typed, and after a clarify round that message is
 * "Book a time slot" — so building on it would produce a site about booking a
 * time slot, having thrown away "a barber shop in Leeds". The original has to be
 * carried through the whole round and put back in front.
 *
 * The answers are appended as plain question-and-answer lines rather than being
 * rewritten into prose: the designer reads this, and a model paraphrasing the
 * customer's own words before another model reads them is a place for the
 * meaning to shift with nothing to compare against.
 */
export function clarifiedBrief(brief, qa) {
  const base = String(brief || "").trim();
  const pairs = (Array.isArray(qa) ? qa : [])
    .filter((p) => p && typeof p === "object")
    .map((p) => ({ q: String(p.q || "").trim(), a: String(p.a || "").trim() }))
    // EVERY PAIR (2026-10-08): a designer's question can follow the router's
    // three, and an answer dropped here is a decision the build never saw.
    // Size is held by the request budget, not by a count.
    .filter((p) => p.q && p.a);
  if (!pairs.length) return base;
  return base + "\n\nThey were asked, and answered:\n" +
    pairs.map((p) => "- " + p.q + " " + p.a).join("\n");
}
export const ROUTE_ERROR_CLASSES = ["Error", "TypeError", "RangeError", "SyntaxError", "ReferenceError", "TimeoutError", "AbortError", "StreamError"];

// THE PROVIDER CODES A FAILURE MAY NAME: a finite table, by provider (the
// owner's review of Lane 1b, 2026-09-30). A shape check proved nothing:
// `private_token_probe` is as well formed as `overloaded_error`, so any
// snake_case word a provider's body carried was echoed into the reply, the log
// and the canary's line. Now a code is named only when the provider that
// answered documents it; anything else, unknown or not a string at all, is
// dropped, never echoed and never coerced. The provider, the status, the
// billing classification and the error's class still say who answered and how.
//   anthropic — its documented `error.type` values, 400 to 529.
//   xai       — xAI documents no codes in its error bodies. `insufficient_quota`
//               is the one the Worker itself classifies (an exhausted account).
export const PROVIDER_CODES = Object.freeze({
  anthropic: Object.freeze(["invalid_request_error", "authentication_error", "billing_error", "permission_error",
    "not_found_error", "request_too_large", "rate_limit_error", "api_error", "overloaded_error"]),
  xai: Object.freeze(["insufficient_quota"]),
});

/** `code` when `provider` documents it, else null. Nothing is coerced. */
export function providerCode(provider, code) {
  if (typeof provider !== "string" || typeof code !== "string" || !Object.hasOwn(PROVIDER_CODES, provider)) return null;
  return PROVIDER_CODES[provider].includes(code) ? code : null;
}

export function routeFailure(stage, e, { model, classify } = {}) {
  const name = e && typeof e.name === "string" && ROUTE_ERROR_CLASSES.includes(e.name) ? e.name : "Error";
  const out = { kind: "transport", provider: isXaiModel(model) ? "xai" : "anthropic", status: null, type: null, billing: false, error: name };
  if (stage === "request") return { ...out, kind: "request" };
  // THE CALL ANSWERED, AND ITS ANSWER COULD NOT BE USED (2026-10-02): no
  // provider status and no error to read — only that the answer was the fault.
  if (stage === "answer") return { ...out, kind: "answer" };
  // THE ANSWER WAS USABLE AND OUR OWN STORE WOULD NOT KEEP WHAT IT NEEDED (a
  // question the customer must be able to answer, 2026-10-02).
  if (stage === "store") return { ...out, kind: "store" };
  const status = e && Number.isInteger(e.status) && e.status >= 100 && e.status <= 599 ? e.status : null;
  if (status !== null) {
    let k = null;
    // THE READER MAY FAIL, AND MAY ANSWER JUNK; neither widens what is said.
    try { k = typeof classify === "function" ? classify(e) : null; } catch { k = null; }
    const type = k ? providerCode(out.provider, k.type) : null;
    // 401, 402 AND 403 ARE OUR KEY OR OUR ACCOUNT whatever the body says —
    // `upstreamKind`'s own rule, kept when no reader is handed in.
    const billing = (k && k.billing === true) || status === 401 || status === 402 || status === 403;
    return { ...out, kind: "provider", status, type, billing };
  }
  if (name === "TimeoutError" || name === "AbortError") return { ...out, kind: "timeout" };
  // A STREAMED PROVIDER ERROR HAS NO STATUS (2026-10-23, audit A23-3), only
  // the provider's envelope in `detail`: read it, so an exhausted account is
  // told as billing rather than as a transport failure.
  if (name === "StreamError" && e && typeof e.detail === "string" && e.detail) {
    let k = null;
    try { k = typeof classify === "function" ? classify(e) : null; } catch { k = null; }
    return { ...out, kind: "provider", type: k ? providerCode(out.provider, k.type) : null, billing: !!(k && k.billing === true) };
  }
  // OUR OWN SENTENCE, thrown by `callBuilderModel` before anything is sent, so
  // matching it reads nothing a provider or a customer wrote.
  if (e && typeof e.message === "string" && /^(?:XAI|ANTHROPIC)_API_KEY is not set$/.test(e.message)) return { ...out, kind: "config" };
  return out;
}

// Used by the parked router as well (parked/old-way/builder/).
export { WORD_CHAR };
