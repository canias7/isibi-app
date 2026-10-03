
import { modelsFor } from "./build-models.mjs";
import { isXaiModel } from "./model-xai.mjs";
import { MAX_INPUT_CHARS, echoTokens } from "./input-budget.mjs";// Telling a question from an instruction — and answering the question.
//
// THE BUILDER COULD NOT BE ASKED ANYTHING. `siteSend` had exactly one decision
// in it — `isBuild = !sitePages(site).length` — so the FIRST message on a project
// built a site and EVERY LATER MESSAGE ran a full revise: designer, page
// generation, container compile, republish. There was no third answer.
//
// That is not a missing feature, it is a live bug, and an expensive one in both
// directions. Type "can you read a URL?" at an existing site and it costs ~21
// credits AND rewrites the customer's pages to whatever the model makes of the
// question. Type "hi" at a new project and it builds a site out of "hi". The
// cheapest possible interaction was routed down the most expensive path there
// is.
//
// ONE MODEL CALL, and that is the whole design constraint. Classifying and then
// answering as two calls makes the cheap path cost double, which defeats the
// point — so the tool returns both: what kind of message this is, and, when it
// is a question, the answer to it. A build request comes back with `intent`
// alone and the caller proceeds exactly as it always did.
//
// THE THIRD INTENT — the builder asking THEM (owner's call, 2026-08-08). On a
// first build it may ask one question before spending ~28 credits on a site
// built from a guess, with the answers as buttons rather than a typed reply, so
// the choice is a choice and not an essay. It rides on this same call, so the
// question costs nothing beyond the routing that was already happening.
//
// Three rules keep it from becoming an interview, and all three are in code
// rather than in the schema description: it is offered only on a FIRST build
// (never a revise), the budget is `MAX_CLARIFY` and is spent by arithmetic
// before the model is asked, and a malformed question is a build. The customer
// can also skip past the whole thing at any point — that is the composer's half.
//
// Plain module with its side effects injected, like `site-context.mjs` and
// `publish-pages.mjs`, so all of it is tested with no network and no Worker.

/** A small call: a routing decision and a short answer, not a design task. */
/**
 * THE PICKED MODEL, NOT A HARDCODED ONE (owner, 2026-08-31).
 *
 * Every small call on this platform was pinned to `claude-haiku-4-5`, so a
 * customer who had picked Grok still had Anthropic in their path — and when
 * Anthropic refused on billing, the whole cheap ladder went down with it while
 * builds carried on fine. Run 93 measured that: a `css` edit answered 503 in
 * 5.3s having spent nothing, and the lane it was testing never ran.
 *
 * DERIVED FROM THE TABLE rather than restated, so it cannot drift from the
 * picker, and it resolves to DEFAULT_PICKER — which is what a caller that
 * forgets to thread the picker gets. That is deliberately the platform default
 * and never Haiku: a forgotten hop should land on the model everything else
 * uses, not quietly back on the provider this change exists to leave.
 */
export const ASK_MODEL = modelsFor().quick;

/**
 * Enough for a real answer and not enough for an essay.
 *
 * Output is billed at 5x input, so this is the one number here that moves the
 * bill. A question in a builder is "what did you build", "can you read a link",
 * "how do I add a photo" — three or four sentences each. Capped in the SCHEMA
 * description as well, because `max_tokens` truncates mid-word while a
 * description shortens.
 */
export const ASK_MAX_TOKENS = 700;

/**
 * HOW MUCH OF A FIRST BUILD'S MESSAGE AND BRIEF THE ROUTER CONSIDERS — the
 * build's own bound, unchanged. A site that exists is not bounded by this
 * (2026-10-03): its messages, answers and held-back parts are kept whole up to
 * the size policy (`MAX_INPUT_CHARS` in input-budget.mjs), refused beyond it
 * and never cut.
 */
export const MAX_MESSAGE = 2000;

/**
 * HOW MANY QUESTIONS A FIRST BUILD MAY ASK, ENFORCED IN CODE.
 *
 * Owner's call: ask one at a time, on every new project, never on a revise. One
 * at a time is the good version of this — each question can be chosen knowing
 * the last answer — and it is also the version that turns into an interrogation
 * if nothing stops it, because "have you got another question?" is a prompt a
 * model will nearly always say yes to.
 *
 * So the ceiling is arithmetic here, not a polite instruction in a schema
 * description. Three is a round of questions somebody will sit through before
 * seeing anything; the fourth is where they start wondering whether it can
 * actually build a site.
 */
export const MAX_CLARIFY = 3;

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
/** A first build's question: two short sentences, clipped at a word if longer (`clipQuestion`). */
export const MAX_QUESTION_CHARS = 240;

/** A first build's answer button (`clipOption`). */
export const MAX_OPTION_CHARS = 48;

/**
 * THE ESCALATION LADDER — edit → addon → build, cheapest rung first.
 *
 * Until this existed the router had two work answers, `build` and nothing else,
 * and on a site that already existed `build` meant a full revise: designer, all
 * pages regenerated, container, republish, ~25 credits. So "change the phone
 * number" and "build me a barber shop" ran the identical ten steps.
 *
 * Three rungs now, and the ONLY reason it is safe to default to a cheap one is
 * that each rung can hand off upward when it finds it cannot do the job. An
 * `edit` that locates no target becomes an `addon`; an `addon` that cannot
 * express the change becomes a `build`. So being wrong downward costs one cheap
 * step and then does the right thing, while being wrong upward costs the
 * customer real money for work nobody asked for.
 *
 * That inverts the old rule ON AN EXISTING SITE and leaves it intact everywhere
 * else. `readRouting`'s doctrine — every unclear case resolves to work, never to
 * a chatty paragraph — is unchanged and is what `FALLBACK_*` encode; what
 * changes is WHICH work, and only because the ladder makes the cheap answer
 * recoverable. With no site there is nothing to edit and nothing to add to, so
 * the fallback is still `build`.
 */
export const FALLBACK_WITH_SITE = "addon";
export const FALLBACK_NO_SITE = "build";

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
          "\"ask\" if the message is a question, a greeting, a thank-you, or anything else that does not describe a change. " +
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
          "section does not exist yet.\n" +
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
          "the BOTTOM of every page.\n" +
          "THE FOOTER'S DETAILS — the phone number, email address, postal address and opening line a visitor " +
          "scrolls to the bottom for. \"Our number at the bottom is wrong\", \"the address is wrong, we've moved\", " +
          "\"the opening hours have changed\", \"take the opening times off\". It is the same block on every page, so " +
          "it changes everywhere at once and costs almost nothing.\n" +
          "A FULL DAY-BY-DAY TIMETABLE IS NOT THIS — that is rows the site stores, so it is \"data\". This is the " +
          "one line at the bottom (\"Tue–Sun 12–10\").\n" +
          "THE SOCIAL ICONS AND THE SMALL PRINT are here too — \"our Instagram link goes to the old account\", \"the " +
          "Privacy link in the small print is broken\", \"take the Twitter icon off\". Same block, same page-wide " +
          "change, same near-zero cost.\n" +
          "AND HOW THE FRAME ITSELF SITS — \"centre our logo\", \"put the name in the middle\", \"run the header " +
          "right across the screen\", \"the top bar shouldn't follow me as I scroll\". That is WHERE the bar's " +
          "parts go and how wide it runs; its COLOURS, corners and typefaces are \"look\", not this.\n" +
          "THE MENU — which items are in it, what order they come in, taking one out. \"Put Book first\", \"rename " +
          "Pricing to Prices in the menu\", \"take Pricing out of the nav\", \"the menu should be Home, Services, " +
          "Contact\".\n" +
          "THE BUTTON — what it says AND where it goes. \"Change the Book button to Get a quote\", \"make the button " +
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
      answer: {
        type: "string",
        description:
          "Only when intent is \"ask\". The reply to show them, one to three sentences, plain, no markdown. Write to them, not " +
          "about them, and sound like a person rather than a help page.\n" +
          "ANSWER WHAT THEY ACTUALLY SAID. A greeting gets a greeting back and an invitation to describe the site; a " +
          "thank-you gets a short you're-welcome and nothing else; a question about what you can do gets that answered. These " +
          "are three different replies and using one for another is worse than saying nothing — do not reach for a stock " +
          "opening line. If it is a question about their own site, answer from the pages and tables described below. If you " +
          "do not know, say so plainly and say what would tell them — never invent a fact about their site.",
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
// DERIVED, NEVER WRITTEN TWICE: every other clause is `ASK_TOOL`'s own text,
// and the clause swapped out is found exactly once or the module fails to load.
const FIRST_BUILD_CLARIFY_AT = "\"clarify\" when you are told below that this is a first build";
const FIRST_BUILD_CLARIFY_END = "to a site that already exists.\n\n";
const LIVE_CLARIFY =
  "\"clarify\" — ONE QUESTION BACK INSTEAD OF WORK, only when you are told below that a question may be asked, and " +
  "only when a detail they left out decides your answer here: whether it is a change or an addition, which page or " +
  "which part of the site, or what should happen to it — and neither their message nor the site described above " +
  "settles it. Ask about what decides YOUR answer; a detail inside a page is for the step that does the work, which " +
  "sees the page and asks for itself if it must. Never to check that they meant it, never for something you can see " +
  "above, never for a choice the work can make sensibly on its own. When the message is clear, answer with the work.\n\n";

// ── AND THE TIE-BREAK, WHERE A QUESTION MAY BE ASKED (2026-10-02, the owner's
//    review: *"Reconcile contradictory prompts"*) ─────────────────────────────
//
// The shared tie-break says "WHEN YOU CANNOT TELL, ANSWER addon", and on a site
// that exists the live clause says to ask when a detail decides whether it is a
// change or an addition: two instructions for one case. Here the tie-break is
// for where questions are closed, and where one may be asked, not being able to
// tell is what the question is for. The first build's tool keeps its own words.
const SHARED_TIE_BREAK = "WHEN YOU CANNOT TELL, ANSWER \"addon\" — it can do everything an edit can EXCEPT take something away.\n";
const LIVE_TIE_BREAK =
  "WHEN YOU CANNOT TELL WHETHER IT IS A CHANGE OR AN ADDITION, ASK THEM (\"clarify\") where a question may be asked " +
  "(said below); only where questions are closed, answer \"addon\" — it can do everything an edit can EXCEPT take " +
  "something away.\n";

function liveIntentDescription() {
  const d = ASK_TOOL.input_schema.properties.intent.description;
  const at = d.indexOf(FIRST_BUILD_CLARIFY_AT);
  const end = d.indexOf(FIRST_BUILD_CLARIFY_END, at);
  if (at < 0 || end < 0 || d.indexOf(FIRST_BUILD_CLARIFY_AT, at + 1) >= 0) {
    throw new Error("site-ask: the first build's clarify clause was not found exactly once");
  }
  const live = d.slice(0, at) + LIVE_CLARIFY + d.slice(end + FIRST_BUILD_CLARIFY_END.length);
  const tie = live.indexOf(SHARED_TIE_BREAK);
  if (tie < 0 || live.indexOf(SHARED_TIE_BREAK, tie + 1) >= 0) throw new Error("site-ask: the tie-break was not found exactly once");
  return live.slice(0, tie) + LIVE_TIE_BREAK + live.slice(tie + SHARED_TIE_BREAK.length);
}

export const LIVE_ASK_TOOL = {
  name: ASK_TOOL.name,
  description: "Say whether this message is asking for a change to the site or asking a question, answer it if it is a question, and ask for the one detail you need when what they want cannot be decided without it.",
  input_schema: {
    ...ASK_TOOL.input_schema,
    properties: {
      ...ASK_TOOL.input_schema.properties,
      intent: { ...ASK_TOOL.input_schema.properties.intent, description: liveIntentDescription() },
      question: {
        type: "object",
        description: "Only when intent is \"clarify\". ONE short question, written to them, naming the one detail you need.",
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
          "answers the question they were asked; false when it asks for something else instead. Everything else you " +
          "decide is for what you are answering: with true, their last request with the answer taken into account; " +
          "with false, the new message alone.",
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
  const desc = String(ASK_TOOL.input_schema.properties.layer.description || "");
  const open = "\"" + layer + "\" — ";
  const lines = desc.split("\n").filter((l) => l.startsWith(open));
  return lines.length === 1 ? lines[0].slice(open.length).trim() : "";
}

/**
 * WHAT THE ANSWER IS ALLOWED TO KNOW.
 *
 * A question about the customer's own site ("what pages do I have?", "where do
 * the bookings go?") is answerable only from this, and the alternative to
 * supplying it is a model that invents a plausible site. Deliberately small —
 * names, not contents — because it rides on every builder message and the rows
 * of a `collect` table are customer data that has no business in a routing call.
 */
export function siteDigest(site) {
  const s = site || {};
  const bits = [];
  const name = String(s.name || "").trim();
  if (name) bits.push("The site is called " + name + ".");
  const url = String(s.url || "").trim();
  if (url) bits.push("It is published at " + url + ".");
  const { pages, tables } = digestLists(s);
  if (pages.length) bits.push("Its pages are: " + pages.join(", ") + ".");
  if (tables.length) bits.push("Its database tables are: " + tables.join(", ") + ".");
  if (!bits.length) return "They have not built anything yet — this is a brand new, empty project.";
  return bits.join(" ");
}

/**
 * The page addresses and table names the router is shown, and whether the
 * table names are fewer than were sent. ONE READER for both: the digest shows
 * these, and the decision report (`ROUTE_REASONS`, `tables-cut`) says when the
 * names were cut, so the two cannot disagree about what the model saw.
 *
 * EVERY PAGE (2026-10-03, the owner's first information-limits batch: *"route
 * decisions use complete, authoritative page identities rather than a partial
 * browser cache"*). The addresses were cut at 24, so the router could not name
 * a site's 25th page, and the lane picker — shown the site's real pages through
 * this same reader — could not either. A page address is a few dozen
 * characters, and a site has as many as it has published: the list is the
 * site's own, not a window of it.
 */
export function digestLists(site) {
  const s = site || {};
  const sentPages = Array.isArray(s.pages) ? s.pages : [];
  const sentTables = Array.isArray(s.tables) ? s.tables : [];
  const pages = sentPages.filter((p) => typeof p === "string" && p.trim());
  const tables = sentTables.filter((t) => typeof t === "string" && t.trim()).slice(0, 24);
  return { pages, tables, tablesCut: tables.length < sentTables.length };
}

const SYSTEM =
  "You are the assistant inside a website builder for small businesses. The person you are talking to owns the site. " +
  "Every message they send is either an instruction to build or change their site, or something else — a question, a " +
  "greeting, a thank-you. Your job is to say which, and to answer the ones that are not instructions.\n\n" +
  "WHAT THE BUILDER CAN DO, so you answer questions about it accurately: it builds a complete React site from a " +
  "description, with its own Postgres database, and publishes it; it revises that site when asked; it can read a link " +
  "the customer pastes into their message and use the page behind it; it can search the web when a brief needs a " +
  "current fact; it accepts attached images and PDFs as reference. It gives the site sign-in for the site's own " +
  "members, file uploads, spam protection, custom domains, and payments through the owner's own Stripe key. " +
  "It cannot do anything else, and if you are asked about something not on that list, say plainly that it is not " +
  "something the builder does rather than guessing that it might be.\n\n" +
  "Do not describe what you are about to do when the answer is \"build\" — the build reports itself. " +
  "Never claim the site has a page, a table, or a feature that is not named below.\n\n" +
  "TALK LIKE A PERSON. This is a conversation, not a form. Short, warm, plain English; contractions are fine. No " +
  "headings, no bullet points, no \"Certainly!\" or \"Great question!\". Say the thing.\n\n" +
  "DECIDE IN THIS ORDER, and stop at the first one that fits.\n" +
  "1. Is the message a greeting, a thank-you, or a question about you — \"hi\", \"hey\", \"wassup\", \"yo\", \"thanks\", " +
  "\"what can you do?\", \"can you read a link?\" — rather than a description of a site? Then \"ask\", and answer it. " +
  "NEVER open with a question of your own here: somebody who typed \"hey\" has not told you anything yet, so there is " +
  "nothing to ask them ABOUT. Say hello back and invite them to tell you what they want, in one or two sentences.\n" +
  "2. Otherwise, if you are told below that this is a first build with questions remaining, and they HAVE described " +
  "something to build: \"clarify\" — BUT ONLY IF THE ANSWER WOULD CHANGE WHAT YOU BUILD. Two things do, and almost " +
  "nothing else does: what the business actually IS, and what visitors DO on the site (book a time, order something, " +
  "send an enquiry, or just read it). Either one changes the pages, the words and what the site stores, and a build " +
  "takes about a minute and costs them again to redo, so the cheapest moment to learn them is before it runs.\n" +
  "   IF THE BRIEF DOES NOT SAY WHAT THE BUSINESS ACTUALLY IS, YOU MUST ASK. That one is never a judgement call: " +
  "\"a website for my business\" and \"book classes\" name no trade, and a gym, a pottery studio and a driving school " +
  "are three different sites. Everything else hangs off it.\n" +
  "   OTHERWISE, IF THE BRIEF ALREADY ANSWERS BOTH, BUILD — do not spend a question just because you have one left. " +
  "A question whose answer changes nothing is a minute of somebody's time, and they came to see a site, not to fill " +
  "in a form. Never ask for things the owner types in afterwards — address, opening hours, prices, phone number, " +
  "staff names — and never ask something they have already told you.\n" +
  "3. Otherwise it is WORK, and which of the three depends on whether a site already exists. You are told below which " +
  "case you are in, and the answers are not interchangeable:\n" +
  "   NO SITE YET — \"build\", always. There is nothing to edit and nothing to add to.\n" +
  "   A SITE EXISTS — \"edit\" or \"addon\", and \"build\" only to throw the whole site away and start again. Pick the " +
  "cheapest one that can honestly do the job: an edit is seconds and costs almost nothing, an addon costs a few " +
  "credits, a rebuild costs about twenty-five and replaces every page they have. Somebody who asked for a different " +
  "shade of blue must never be given a new site. COST NEVER MAKES A NEW ENTRY AN EDIT: a new product, service or " +
  "team member in one of their lists is an \"addon\" even though the list already exists, because for a list an " +
  "edit only changes or takes away the entries that are already there. Nor does it make the other additions edits: " +
  "a new menu link, footer link or button, a new line of words or a new photograph on a page is an \"addon\" even " +
  "though the menu, the footer and the page already exist.\n\n" +
  "WHAT THE THREE COST, because it is the whole reason they are separate. Changing words: no model writes anything, " +
  "the words are lifted out of the page and put back. Changing the look: the design is adjusted and the site is " +
  "recompiled, and not one page is rewritten. Adding a page: one page is written. Rebuilding: every page is written " +
  "again from nothing, and whatever the owner had is gone.";

/**
 * The one definition of the routing call.
 *
 * Extracted the way `pagesRequest` was, and for the same reason: the moment two
 * places construct this request, a test tunes something production does not run.
 */
// ── WHAT A SITE THAT EXISTS IS TOLD ABOUT QUESTIONS (2026-10-02) ───────────
//
// Two facts, each said outright rather than left to be inferred: whether a
// question may be asked for this request (wherever one can be kept, however
// many answers it already carries — 2026-10-03); and, when the message may be the
// answer to one already asked, the request that is waiting, what they already
// told us about it (`contextBlock`: its earlier answers, as details of that
// request and never a change of their own), the question and the answers
// offered. The router then says whether the message answers it (`answered`);
// nothing in code reads the customer's words to decide that.
function liveBlock({ canAsk = false, pending = null, context = [] } = {}) {
  const p = pending && typeof pending === "object" ? pending : null;
  const q = p && p.question && typeof p.question === "object" ? p.question : null;
  const opts = q && Array.isArray(q.options) ? q.options.filter((o) => typeof o === "string" && o) : [];
  const waiting = p && q && typeof q.text === "string" && typeof p.request === "string"
    // WHOLE (2026-10-03): the request, the question and every answer offered
    // were each kept to the size policy when they were stored, so nothing here
    // is cut again — a router shown half a request decides for half of it.
    ? "\n\nTHEIR LAST REQUEST IS WAITING ON AN ANSWER\nThey asked: " + p.request.trim() +
      "\nThey were asked: " + q.text.trim() +
      (opts.length ? "\nThe answers they were offered: " + opts.join(" / ") : "") +
      (p.chosen === true ? "\nThey picked one of those answers: it is their message below." : "") +
      "\nTheir message below answers that question, or asks for something else instead: say which in `answered`. " +
      "With true, decide everything for their last request with the answer taken into account — when it does not " +
      "settle what you asked, ask them a more specific question that names exactly what it left open — and copy any " +
      "part you hold back from their last request. With false, decide everything for the new message alone."
    : "";
  // WHAT THEY ALREADY TOLD US ABOUT THE WAITING REQUEST, in its own section
  // under it: the details of that request, never asked again. Only beside a
  // waiting request — a new message carries no answers of its own.
  const told = waiting ? contextBlock(context) : "";
  const asking = canAsk
    ? "\n\nA QUESTION MAY BE ASKED\nBefore answering with work you may ask them one question instead (\"clarify\"), when " +
      "a detail they left out decides your answer — whether it is a change or an addition, which page or part of the " +
      "site, or what should happen — and neither their message nor the site above settles it. When the message is " +
      "clear, answer with the work." +
      (told ? " Never ask what they already answered under " + CONTEXT_HEADING + "." : "")
    : "\n\nQUESTIONS\nQuestions are closed for this message — never answer \"clarify\".";
  return waiting + (told ? "\n" + told : "") + asking;
}

export function askRequest({ message, site, canClarify = false, brief = "", qa = [], hasSite = false, model = ASK_MODEL, live = false, canAsk = false, pending = null, context = [] } = {}) {
  // A FIRST BUILD'S MESSAGE IS CUT TO ITS OWN BOUND, AS IT ALWAYS WAS; a site
  // that exists sends it whole (2026-10-03, the size policy): the route has
  // already refused one past `MAX_INPUT_CHARS`, so nothing here shortens what
  // the router decides on.
  const text = live ? String(message || "").trim() : String(message || "").trim().slice(0, MAX_MESSAGE);
  // WHICH ANSWERS ARE EVEN AVAILABLE, said outright rather than left to be
  // inferred from whether the digest happens to list any pages. The digest is a
  // description of the site; this is an instruction about the decision, and a
  // model asked to derive the second from the first will occasionally derive it
  // wrongly — on the one call where being wrong means a customer's site is
  // rebuilt over a colour change.
  const state = hasSite
    ? "\n\nWHICH CASE YOU ARE IN\nTHE SITE ALREADY EXISTS. Answer \"edit\" or \"addon\" for work — never \"build\", unless " +
      "they are explicitly asking to scrap this site and make a different one. Rebuilding replaces every page they have."
    : "\n\nWHICH CASE YOU ARE IN\nTHERE IS NO SITE YET. Answer \"build\" for work — never \"edit\" or \"addon\", because " +
      "there is nothing yet to change or to add to.";
  const qaDone = (Array.isArray(qa) ? qa : []).filter((p) => p && p.q && p.a).slice(0, MAX_CLARIFY);
  const left = MAX_CLARIFY - qaDone.length;
  // WHAT THE ROUND SO FAR WAS, so the next question is not the last one again.
  // Only present on a first build; a revise sends none of this and is told
  // plainly that questions are closed, rather than being left to infer it from
  // an absent section.
  const round = canClarify
    ? "\n\nBEFORE THE BUILD\nThis is their FIRST build — nothing exists yet, so you MAY ask one question before " +
      "building. You have " + left + " question" + (left === 1 ? "" : "s") + " left, and the build starts on its own " +
      "once they are used up — but a question is worth asking only if its answer changes what you would build. If " +
      "you already know what the business is and what people do on the site, build now.\n" +
      (qaDone.length
        ? "WHAT YOU HAVE ALREADY ASKED — do not ask any of these again, or anything close to them:\n" +
          qaDone.map((p) => "- " + String(p.q).trim() + " -> " + String(p.a).trim()).join("\n") + "\n"
        : "") +
      "THE BRIEF THEY STARTED WITH\n" + String(brief || "").trim().slice(0, MAX_MESSAGE)
    // NO WORK-INTENT ENUMERATION HERE, deliberately. This sentence read
    // `answer "build" or "ask" only` until 2026-08-14 — written when those were
    // the only intents, never updated for the escalation ladder — so every
    // message about a LIVE site carried two contradictory instructions: the
    // state block saying "edit or addon, never build" and this one pointing at
    // the ~25-credit rebuild. The state block is the ONE place legal answers
    // are named; this block owns exactly one fact, that clarify is over.
    // A SITE THAT EXISTS (2026-10-02) is told its own two facts instead
    // (`liveBlock`); everything else in this request is what it was.
    : live
      ? liveBlock({ canAsk, pending, context })
      : "\n\nQUESTIONS\nQuestions are closed for this message — never answer \"clarify\".";
  return {
    model,
    // ROOM TO COPY A HELD-BACK PART BACK, on a site that exists (2026-10-03):
    // `alsoAsked` is the customer's own words, copied, from this message or the
    // request waiting on an answer, so the ceiling grows by what may be copied
    // (`echoTokens`). A ceiling, not a charge. A first build's is unchanged.
    max_tokens: live ? ASK_MAX_TOKENS + echoTokens(text, pending && typeof pending.request === "string" ? pending.request : "") : ASK_MAX_TOKENS,
    // A SITE THAT EXISTS IS SENT ITS OWN TOOL (2026-10-02, `LIVE_ASK_TOOL`); a
    // first build, and anything else, the tool it was always sent.
    tools: [live ? LIVE_ASK_TOOL : ASK_TOOL],
    // FORCED, like both of the other calls. Without it Haiku will happily answer
    // in prose, and the caller has no field to branch on — the whole point here
    // is a decision the code can read, not a reply a human has to interpret.
    tool_choice: { type: "tool", name: "route_message" },
    system: [{ type: "text", text: SYSTEM }],
    messages: [{ role: "user", content: "THEIR SITE\n" + siteDigest(site) + state + round + "\n\nTHEIR MESSAGE\n" + text }],
  };
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
  "request-failed": Object.freeze({ kind: "fallback", what: "the routing request could not be built" }),
  "send-failed": Object.freeze({ kind: "fallback", what: "the routing call failed" }),
  "no-tool-call": Object.freeze({ kind: "fallback", what: "the model's reply held no routing answer" }),
  "intent-unknown": Object.freeze({ kind: "fallback", what: "the answer named no intent, or one that is not among the five" }),
  "clarify-closed": Object.freeze({ kind: "fallback", what: "a question back, when no question may be asked" }),
  "clarify-unreadable": Object.freeze({ kind: "fallback", what: "a question back with no usable question" }),
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
  "clarify-reused": Object.freeze({ kind: "context", what: "a question back the request had already asked, so the model was asked again with that answer in front of it" }),
  "clarify-again": Object.freeze({ kind: "changed", what: "the model asked again what it had been answered, shown the answer: kept with a note naming the answer that did not settle it, and never sent again on our own at the repeated-question threshold or past the total-answer limit" }),
  "answered-unread": Object.freeze({ kind: "fallback", what: "a reply to a waiting question that did not say whether it answers it" }),
  "answered-ignored": Object.freeze({ kind: "changed", what: "an answer flag on a message with no question waiting, left out" }),
  "work-without-site": Object.freeze({ kind: "fallback", what: "an edit or an add-on, with no site to change" }),
  "ask-empty": Object.freeze({ kind: "fallback", what: "a reply with nothing to say" }),
  "ask-while-answering": Object.freeze({ kind: "fallback", what: "a reply to a message that answers our own question" }),
  "ask-with-attachment": Object.freeze({ kind: "fallback", what: "a reply to a message that came with a file" }),
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
});

/** Where a routing answer came from; `routeDecision` derives it from the codes. */
export const ROUTE_SOURCES = Object.freeze(["model", "fallback", "rule"]);

/** The router's intents, read from its own tool so the two cannot drift. */
const ROUTE_INTENTS = ASK_TOOL.input_schema.properties.intent.enum;

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

/** Records into a caller's trace; a no-op without one, so a reader's result never depends on it. */
function noteTo(trace) {
  return trace && Array.isArray(trace.reasons) ? (code) => { trace.reasons.push(code); } : () => {};
}

/** A field the model filled in: not absent, not null, not blank, not `false`. */
function given(v) {
  if (v === undefined || v === null || v === false) return false;
  return !(typeof v === "string" && !v.trim());
}

/** The edit's own fields, which an answer that is not an edit carries none of. */
const EDIT_FIELDS = ["layer", "page", "remove", "rename", "tab"];

/**
 * The parts of the model's answer that the kept answer does not carry, each
 * named. `keeps` is what this answer carries: "answer", "question", "also",
 * "edit". Only for an answer the model's own intent decided: a fallback
 * replaces the whole answer, and its own code says so.
 */
function markLeftOut(input, keeps, mark) {
  if (!keeps.includes("answer") && String(input.answer || "").trim()) mark("answer-ignored");
  if (!keeps.includes("question") && given(input.question)) mark("question-ignored");
  if (!keeps.includes("also") && given(input.alsoAsked)) mark("also-ignored");
  if (!keeps.includes("edit") && EDIT_FIELDS.some((k) => given(input[k]))) mark("edit-fields-ignored");
}

/**
 * Whether `readQuestion` shortened the question or changed its options,
 * compared on the spelling it reads. Called only after `readQuestion` has
 * read the same values, so the text's `String` cannot throw here when it did
 * not there; an option is compared only as the string `readQuestion` keeps,
 * and anything else counts as changed.
 */
function markQuestion(raw, q, mark) {
  const flat = (v) => String(v == null ? "" : v).trim().replace(/\s+/g, " ");
  if (q.text !== flat(raw && raw.text)) mark("question-clipped");
  const options = raw && Array.isArray(raw.options) ? raw.options : [];
  const same = (o, i) => typeof options[i] === "string" && o === flat(options[i]);
  if (options.length !== q.options.length || !q.options.every(same)) mark("options-changed");
}

/**
 * WHEN THE ROUTER CANNOT DECIDE, BUILD.
 *
 * Every unclear case resolves to "build", and it is a deliberate asymmetry
 * rather than laziness. Getting it wrong that way costs a build the customer
 * did not quite ask for, which they can see and undo by saying so; getting it
 * wrong the other way answers "add a booking form" with a chatty paragraph and
 * silently does not build the thing they asked for — a failure they cannot
 * distinguish from the builder being broken.
 *
 * So: an unreadable response, an unknown intent, a model error, a missing tool
 * call — all of them are `build`. The router is an optimisation on top of a
 * pipeline that already works, and it must never be the reason a build does not
 * happen.
 */
// ── A SITE THAT EXISTS: A QUESTION BACK, AND WHETHER A MESSAGE ANSWERS ONE (2026-10-02) ──
//
// Owner: *"Let the router ask a targeted question … instead of converting
// clarification into add-on work"*. Until this, `clarify` on a site that
// exists was closed (`canClarify` is a first build's), so a model that needed
// to ask was overruled into `FALLBACK_WITH_SITE` — a paid add-on it had not
// chosen. Now, on a site that exists (`live`):
//
//   * a readable question is the answer wherever a question can be kept
//     (`canAsk`); where none can, it fails the call (`clarify-unkeepable`) —
//     never shown with nothing waiting for an answer, never turned into work;
//   * a question that cannot be shown is a failure of the answer (`unusable`),
//     which the route answers as the routing call failing — never as work;
//   * when a question is waiting (`pending`), the model says whether the
//     message answers it (`answered`), or a clicked answer says so (`chosen`);
//     a reply that does not say is the same failure of the answer.
//
// EVERYTHING ELSE IS `readDecision`, unchanged, and a first build never comes
// through here at all: `live` is false for it, so it is read exactly as before.
export function readRouting(reply, opts = {}) {
  const o = opts && typeof opts === "object" ? opts : {};
  if (o.live !== true) return readDecision(reply, o);
  const blocks = reply && Array.isArray(reply.content) ? reply.content : [];
  const use = blocks.find((b) => b && b.type === "tool_use");
  const input = (use && use.input) || {};
  const mark = noteTo(o.trace);
  const fallback = FALLBACK_WITH_SITE;
  let answered;
  if (o.pending === true) {
    answered = o.chosen === true ? true : input.answered;
    if (typeof answered !== "boolean") {
      if (o.trace) o.trace.input = input;
      if (!use) mark("no-tool-call");
      mark("answered-unread");
      return { intent: fallback, answer: "", unusable: true };
    }
  } else if (input.answered !== undefined) mark("answered-ignored");
  const withAnswered = (out) => (answered === undefined ? out : { ...out, answered });
  if (input.intent === "clarify") {
    if (o.trace) o.trace.input = input;
    // A QUESTION THAT CANNOT BE SHOWN WHOLE IS NO QUESTION (2026-10-03):
    // `readAsk` never shortens one, so the call fails as for an unreadable
    // one — nothing run or billed, a waiting request left waiting.
    const q = usableAsk(input.question);
    if (!q) {
      mark("clarify-unreadable");
      return { intent: fallback, answer: "", unusable: true };
    }
    markQuestion(input.question, q, mark);
    markLeftOut(input, ["question"], mark);
    if (o.canAsk !== true) {
      mark("clarify-unkeepable");
      return { intent: fallback, answer: "", unusable: true };
    }
    return withAnswered({ intent: "clarify", answer: "", question: q });
  }
  return withAnswered(readDecision(reply, { ...o, canClarify: false }));
}

function readDecision(reply, { canClarify = false, answering = false, attached = false, hasSite = false, pages = [], pagesComplete = true, trace = null } = {}) {
  const blocks = reply && Array.isArray(reply.content) ? reply.content : [];
  const use = blocks.find((b) => b && b.type === "tool_use");
  const input = (use && use.input) || {};
  const answer = String(input.answer || "").trim();
  // THE DECISION REPORT (`ROUTE_REASONS`): every branch below names itself into
  // the caller's trace, when there is one, and returns exactly what it did.
  const mark = noteTo(trace);
  if (trace) trace.input = input;
  if (!use) mark("no-tool-call");
  // The bottom of the ladder for this state. See FALLBACK_WITH_SITE: unclear
  // still resolves to WORK and never to a paragraph — what the site's existence
  // changes is which work, because on an existing site "build" is a ~25-credit
  // rewrite of every page rather than the harmless default it is on an empty one.
  const fallback = hasSite ? FALLBACK_WITH_SITE : FALLBACK_NO_SITE;
  const work = (intent) => ({ intent, answer: "" });

  // CLARIFY IS GATED BY THE CALLER, NOT BY THE MODEL. `canClarify` is false on
  // every revise and the moment the question budget is spent, and a model that
  // answers "clarify" anyway is overruled into WORK — falling through to the
  // ladder below and out to `fallback`. The alternative — trusting the enum to
  // be honoured — is how a revise ends up being interviewed about its own
  // colour scheme.
  //
  // "Overruled into a BUILD" is what this said, and that stopped being true when
  // the ladder landed: `FALLBACK_WITH_SITE` is `addon`, so on an existing site —
  // which is every revise, i.e. exactly where the gate is closed — the answer is
  // an addon and not a build. Right either way (both are work, never a
  // paragraph), and the sentence named the one it is not.
  if (input.intent === "clarify" && canClarify) {
    const q = readQuestion(input.question);
    // A CLARIFY WITH NO USABLE QUESTION IS A BUILD, for exactly the reason an
    // answerless "ask" is: honouring it shows the customer an empty prompt and
    // builds nothing, which is indistinguishable from the builder being broken.
    if (q) {
      markQuestion(input.question, q, mark);
      markLeftOut(input, ["question"], mark);
      return { intent: "clarify", answer: "", question: q };
    }
    mark("clarify-unreadable");
    return work(fallback);
  }

  // THE TWO NEW RUNGS, AND BOTH ARE GATED ON THE SITE EXISTING. An "edit" with
  // nothing to edit is not a cheaper build, it is a lane with no input — so on an
  // empty project both fall through to the bottom of this function and build,
  // which is what every caller did before these existed.
  //
  // AND THE SECOND THING THEY ASKED FOR, ON THE TWO WORK RUNGS ONLY. `layer` is
  // one value and always has been, so a message naming two different parts of
  // the site has half of it dropped — and the customer is then told the half
  // that ran worked, which reads as the builder ignoring them rather than as one
  // change per turn. This does not change what gets DONE: it is a note, so the
  // worst case is a sentence about something they did not ask for.
  //
  // NOT ON `build`, which rewrites everything and folds a second ask in by
  // construction, and not on `ask` or `clarify`, where no work happened for a
  // leftover to sit beside.
  // READ ON THE TWO WORK RUNGS ONLY, where it is kept: on any other answer a
  // held-back part is left out, and the report says so (`also-ignored`).
  if (hasSite && input.intent === "addon") {
    const out = { ...work("addon"), ...readAlso(input, trace) };
    markLeftOut(input, ["also"], mark);
    return out;
  }
  if (hasSite && input.intent === "edit") {
    const { converted, ...edit } = readEdit(input, pages, trace, pagesComplete);
    // ── A CONVERTED EDIT IS A HAND-OVER, AND SAYS WHY (2026-10-02, W5) ───────
    //
    // The held-back part belongs to the decision it was made with. An edit of a
    // page the site lacks is still that decision — the change, made as an
    // addition on that page — so the part stays held back, and the add-on step
    // is told the page and why it has the change. An answer the model did not
    // decide (no step, an unknown one, a page edit naming no page) is not, and
    // its held-back part goes with it: the step it falls to gets the whole
    // message, told why, rather than the half the model meant for another step.
    if (converted) {
      const keeps = converted.reason === "page-unknown";
      if (!keeps && given(input.alsoAsked)) mark("also-dropped");
      const out = { ...edit, ...(keeps ? readAlso(input, trace) : {}), handOver: { from: "route", ...converted } };
      markLeftOut(input, ["also", "edit"], mark);
      return out;
    }
    const out = { ...edit, ...readAlso(input, trace) };
    markLeftOut(input, ["also", "edit"], mark);
    return out;
  }
  // "build" IS STILL HONOURED ON AN EXISTING SITE, deliberately and narrowly:
  // it is the only way to say "scrap this and make me a different site", which is
  // a thing people really do ask for. The tool description is what keeps it rare.
  if (input.intent === "build") {
    markLeftOut(input, [], mark);
    return work("build");
  }

  const intent = input.intent === "ask" ? "ask" : fallback;
  // WHY THE MODEL'S OWN INTENT WAS NOT USED, when it was not: a question back
  // where none may be asked, work with no site to do it on, or an intent that
  // is not one of the five (a reply with no answer at all was named above).
  if (intent !== "ask") {
    if (input.intent === "clarify") mark("clarify-closed");
    else if (input.intent === "edit" || input.intent === "addon") mark("work-without-site");
    else if (use) mark("intent-unknown");
  }
  // AN "ask" WITH NOTHING TO SAY IS A BUILD. The model chose the cheap branch and
  // then wrote no reply, so honouring it would show the customer an empty message
  // and do nothing — the one outcome worse than an unnecessary build.
  if (intent === "ask" && !answer) {
    mark("ask-empty");
    return work(fallback);
  }
  // AN "ask" IN REPLY TO OUR OWN QUESTION IS A DEAD END, and it shipped as one.
  //
  // Measured live 2026-08-09: brief "Book classes", two questions answered, and
  // the third press of a button came back *"I'm not sure what you'd like me to
  // build. Tell me about your business."* — to somebody who had just told us,
  // three times, using buttons we wrote. Nothing was built and nothing cleared
  // the round, so the interface sat on an answered question.
  //
  // `answering` means the message IS an answer: a clicked option, or a typed
  // reply while a question is live. The only honest outcomes there are another
  // question or the build. This is the same asymmetry the rest of this file is
  // built on — a wrong "build" costs a build they can see and undo, a wrong
  // "ask" is indistinguishable from the product being broken — applied to the
  // one path that was missing it.
  //
  // The cost, stated: somebody who interrupts mid-round with a real question
  // ("wait, can you read a URL?") gets a site instead of an answer. That is the
  // cheaper mistake, and they still have the site.
  //
  // `attached` IS THE SECOND REASON, and it is a separate flag rather than a
  // second meaning on `answering`. They are different facts about the message —
  // one is "this answers our question", the other is "a file came with it" — and
  // this file already records what happens when two meanings share one flag.
  // What they have in common is all that matters here: the CALLER knows the
  // message is an instruction, so "ask" is not an honest outcome for it.
  //
  // Both bound `ask` and NEITHER bounds `clarify`, which is the whole point of
  // the change that added `attached`: an attachment used to skip this call
  // entirely, so a first build with a logo attached was never asked anything.
  if (intent === "ask" && (answering || attached)) {
    if (answering) mark("ask-while-answering");
    if (attached) mark("ask-with-attachment");
    return work(fallback);
  }
  if (intent === "ask") markLeftOut(input, ["answer"], mark);
  return { intent, answer: intent === "ask" ? answer : "" };
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

/**
 * An edit, or the rung above it.
 *
 * EVERY FAILURE HERE GOES UP, never sideways and never to a refusal. A missing
 * layer, a layer nobody recognises, a page-shaped edit that names no page: each
 * of them means the router did not actually decide, and the cost of guessing
 * "edit" anyway is a lane that finds nothing to change and reports success
 * having done nothing — which is the failure this whole file is written to
 * avoid, one rung down.
 *
 * THE PAGE CHECK IS THE USEFUL ONE, and it falls out of the ladder for free:
 * "change the gallery page" on a site with no gallery is not a broken edit, it
 * is an ADDON, correctly identified without anyone having to ask a model twice.
 *
 * NOT KNOWING BUYS NOTHING, though. With no page list to check against — an
 * older caller, a site whose digest carried none — the edit passes through with
 * the path as given, and the apply step escalates later with a real reason. The
 * alternative is inventing a refusal out of evidence we do not have, and sending
 * every page edit on those sites to a lane that would try to add a duplicate.
 */
/**
 * The second thing they asked for, which this turn is not doing.
 *
 * HELD BACK, NOT ONLY SAID (2026-09-29). It was a note nothing branched on, and
 * run 52 showed what that costs: the edit route ran the whole message anyway,
 * so the part named here was both attempted (on the wrong page) and promised
 * for next time. The browser now posts it with the message and the edit and
 * add-on routes take it out before anything runs (`heldBack`), and the reply's
 * last sentence is composed from what the route really held back. A model
 * that over-reports holds back work they asked for; one that under-reports
 * leaves the work in the turn. The schema description tells it to stay silent
 * when unsure, and this reader stays strict rather than generous.
 *
 * A NON-STRING IS REFUSED RATHER THAN COERCED: `String(["a","b"])` is "a,b",
 * which would be shown to the customer as their own words. The same coercion bug
 * this repo has recorded on `normalizeRole` and on a table's `access`.
 *
 * ABSENT MEANS ABSENT — an empty object, so a response that has no leftover is
 * byte-identical to what it was before this existed.
 */
export function readAlso(input, trace = null) {
  const mark = noteTo(trace);
  if (input && given(input.alsoAsked) && typeof input.alsoAsked !== "string") mark("also-not-text");
  const raw = input && typeof input.alsoAsked === "string" ? input.alsoAsked.trim() : "";
  if (!raw) return {};
  // ⚠ NEVER CUT (2026-09-29). This was `raw.slice(0, MAX_ALSO_CHARS)`, harmless
  // while the field was only a sentence on the reply. It is now also WHAT THE
  // ROUTES HOLD BACK, and a copy cut between two words is still found in the
  // message — so only its first 200 characters would be held back, and the rest
  // of the part promised for later would run this turn. A site's message is at
  // most `MAX_INPUT_CHARS` characters (the size policy, 2026-10-03), so a longer
  // copy is not a copy of anything they said: it is dropped, not cut, and
  // nothing is held back.
  if (raw.length > MAX_INPUT_CHARS) {
    mark("also-too-long");
    return {};
  }
  return { alsoAsked: raw };
}

/**
 * One more sentence, not a second brief: the most of the held-back words the
 * reply's last sentence shows (`alsoTail` in public/chat.js). A display bound
 * only — what is held back is never cut.
 */
export const MAX_ALSO_CHARS = 200;

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
function wordSpans(message, words) {
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

/**
 * A MESSAGE WITH THE PART THE ROUTER HELD BACK TAKEN OUT (2026-09-29).
 *
 *   { ok: true,  run, held }  — `run` is what this turn does; `held` is the part
 *                               taken out, in the customer's own spelling, or
 *                               `""` when nothing was held back.
 *   { ok: false, run, held: "" } — the part could not be found in the message,
 *                               or it was the whole message. The caller must not
 *                               guess: running the message whole would also run
 *                               the part that was promised for later.
 *
 * EVERY OCCURRENCE GOES, so a clause said twice cannot survive once and run.
 * `later` that is not a non-empty string means nothing was held back — the
 * ordinary case, and `run` is then the message itself, untouched.
 */
export function heldBack(message, later) {
  const text = typeof message === "string" ? message : "";
  if (typeof later !== "string" || !later.trim()) return { ok: true, run: text, held: "" };
  const r = heldParts(text, later);
  return { ok: r.ok, run: r.run, held: r.ok ? r.held[0] : "" };
}

/**
 * The most parts one message may have put off. The router puts off at most
 * one; a step acting as its net puts off what it cannot do beside the rest
 * (`heldParts`), and a message asking for more than this many separate things
 * is not one a hand-over can carry honestly.
 */
export const MAX_HELD = 4;

/**
 * THE PARTS PUT OFF, AS A LIST — what a hand-over's `alsoAsked` may be on the
 * wire (2026-10-02, the whole-router audit's batch 2). A string is one part, a
 * list is several; absent (`null` or missing), a blank string or an empty list
 * is none. `null` when the value cannot be read: a list with an entry that is
 * not text, a blank one, one longer than any message (`MAX_INPUT_CHARS`, the
 * size policy), or more entries than `MAX_HELD` — or a value that is neither
 * text nor a list. A NON-STRING IS
 * NEVER COERCED (`String(["a"])` is "a"), and a value that cannot be read is
 * never read as none: the caller refuses, because running the message whole
 * would run the parts meant for later.
 */
export function heldList(v) {
  if (v == null) return [];
  if (typeof v === "string") return v.trim() ? [v.trim()] : [];
  if (!Array.isArray(v) || v.length > MAX_HELD) return null;
  const out = [];
  for (const p of v) {
    if (typeof p !== "string" || !p.trim() || p.length > MAX_INPUT_CHARS) return null;
    if (!out.includes(p.trim())) out.push(p.trim());
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
export function heldParts(message, later) {
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
  if (!WORD_CHAR.test(run)) return { ok: false, run: text, held: [] };
  return { ok: true, run, held: [...new Set(held)] };
}

/**
 * ONE CHANGE'S OWN WORDS, LESS EVERY PART PUT OFF (2026-10-02, the owner's
 * review of batch 2: *"ensure newly deferred instructions are excluded from
 * every executing step's model input, including overlapping scope words"*).
 *
 * `words` is one change's text as it stands in `message` — a picker's scope for
 * it, which `readScopes` has already found there — and `later` the parts put
 * off this turn (one string or a list, as `heldParts` reads them), each also
 * found in `message`. Every stretch of the change's
 * text that lies inside a part put off is taken out: a part wholly inside its
 * words, and a part that only overlaps their edge ("…and add a page" running
 * into "add a page for our cake orders"). Positions are the message's own, so
 * the words a change shares with a part put off are the part's, wherever in the
 * message each was copied from.
 *
 *   — the change's own text, untouched, when no part put off reaches it;
 *   — what is left of it, when one does;
 *   — `""` when no word of its own is left (the change WAS the part put off),
 *     and when `words` is not in the message at all.
 *
 * WHAT A CHANGE IS, AND WHICH WORDS ASK FOR IT, IS THE PICKER'S DECISION. This
 * only takes out, by position, words a model already said belong to a part put
 * off. A non-string is nothing, never coerced.
 */
export function wordsLess(message, words, later) {
  const text = typeof message === "string" ? message : "";
  const own = wordSpans(text, words)[0];
  if (!own) return "";
  const parts = (Array.isArray(later) ? later : typeof later === "string" ? [later] : []).filter((p) => typeof p === "string" && p.trim());
  const cuts = parts.flatMap((p) => wordSpans(text, p))
    .filter(([s, e]) => s < own[1] && e > own[0])
    .map(([s, e]) => [Math.max(s, own[0]), Math.min(e, own[1])])
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (!cuts.length) return text.slice(own[0], own[1]);
  let out = "";
  let at = own[0];
  for (const [s, e] of cuts) {
    if (e <= at) continue;
    out += text.slice(at, Math.max(s, at));
    at = e;
  }
  out = (out + text.slice(at, own[1])).replace(/[ \t]{2,}/g, " ").trim();
  return WORD_CHAR.test(out) ? out : "";
}

// ── A CONVERTED ANSWER SAYS WHY (2026-10-02, the whole-router audit's W5) ───
//
// Every way out of `readEdit` that does not use the model's edit answer carries
// `converted`: `{ reason, page? }`, where `reason` is one of the hand-over's own
// codes (`builder/hand-over.mjs`). `readRouting` turns it into the hand-over the
// add-on step receives and decides what becomes of the held-back part — it is
// taken off before anything is returned, so no caller ever sees the field.
//
//   page-unknown      a page edit naming a page the site was not said to have:
//                     an addition, made by the add-on step, on that page
//   route-unreadable  an edit naming no step, or one that is not among them, or
//                     a page edit naming no page: the model did not decide
const unreadEdit = () => ({ intent: FALLBACK_WITH_SITE, answer: "", converted: { reason: "route-unreadable" } });

export function readEdit(input, pages, trace = null, pagesComplete = true) {
  const mark = noteTo(trace);
  const layer = EDIT_LAYERS.includes(input && input.layer) ? input.layer : null;
  if (!layer) {
    mark(input && given(input.layer) ? "layer-unknown" : "layer-missing");
    return unreadEdit();
  }
  // `remove` IS READ FOR EVERY LAYER THAT HAS ONE, above the page branch.
  //
  // It used to be read only inside the page branch, below the early return —
  // so when the logo layer landed and its tool description asked for the SAME
  // field ("true when they want the logo TAKEN OFF"), the flag was stripped
  // here before the route ever saw it. Everything downstream was correct and
  // starved: the route's gate, the client's `d.remove === true`, the worker's
  // logo branch, `runLogoEdit`'s removal path. "Drop the logo, just the name is
  // fine" fell through to the attach path with no image and answered
  // "Attach the logo with the 📎 button" — the exact inversion the flag exists
  // to prevent, and not escalated, so there was no working removal at all.
  //
  // `=== true` and nothing merely truthy, for the reason the page branch below
  // states at length: this is the one verb where guessing wrong takes something
  // away rather than adding something visible and undoable.
  const remove = input && input.remove === true;
  const removal = remove ? { remove: true } : {};
  // THE TWO FLAGS' OWN REPORTS: a value that is not exactly `true` is left out
  // wherever it is, and a `true` on a step that does not take it is left out
  // too. Recorded, never acted on: what is returned below is unchanged.
  if (given(input.remove) && input.remove !== true) mark("remove-not-true");
  else if (remove && !REMOVABLE_LAYERS.includes(layer)) mark("remove-ignored");
  if (given(input.tab) && layer !== "logo") mark("tab-ignored");
  else if (given(input.tab) && input.tab !== true) mark("tab-not-true");
  // WHICH SLOT THE ARTWORK GOES IN, read only for the layer that has two.
  // Scoped the way `remove` is, and for the same reason: a flag carried by a
  // layer that cannot act on it is one nothing reads, which is how this repo's
  // dead features start. Combines with `remove` — "take the favicon off" is
  // both, and the pair is what makes that removal hit the right slot.
  const tab = layer === "logo" && input && input.tab === true ? { tab: true } : {};
  // ── A LOOK CHANGE CARRIES THE PAGE IT NAMED (2026-09-23) ──────────────────
  //
  // THIS RETURNED BEFORE THE PAGE WAS READ, for every layer but `page` — and
  // `look` is the door whose lanes dispatch a section, a band or a scene to the
  // page rung. So "move the market times up on the gallery page" arrived with
  // no page, and the edit route's fallback made it on the home page: the
  // routing reply, the browser and the dispatcher all forward a page, and this
  // was the one hop that dropped it.
  //
  // ABSENT STAYS ABSENT — no key at all — so a change to the whole site is
  // byte-identical to what it was. The spelling is `normalizePagePath`'s, the
  // same one the page layer resolves with.
  //
  // A PAGE THE SITE DOES NOT HAVE IS KEPT, NOT TURNED INTO AN ADD-ON as the page
  // layer's is below. A colour or a section aimed at a missing page is not an
  // addition — "take the 3D thing off the menu page" must not design a menu
  // page — so the edit route answers it with the site's real pages, at no cost
  // for the edit, before any lane runs. A layer with no use for a page (every
  // other one) still carries none, which is the scoping `remove` and `tab`
  // already have for the same reason: a field nothing can act on is one
  // nothing reads.
  if (layer === "look") {
    const named = normalizePagePath(input && input.page);
    if (given(input.page) && !named) mark("page-unreadable");
    else if (named && named !== input.page) mark("page-normalized");
    if (given(input.rename)) mark("rename-ignored");
    return { intent: "edit", answer: "", layer, ...(named ? { page: named } : {}) };
  }
  if (layer !== "page") {
    if (given(input.page)) mark("page-ignored");
    if (given(input.rename)) mark("rename-ignored");
    return { intent: "edit", answer: "", layer, ...tab, ...(REMOVABLE_LAYERS.includes(layer) ? removal : {}) };
  }
  const want = normalizePagePath(input.page);
  if (!want) {
    mark("page-missing");
    return unreadEdit();
  }
  const known = (Array.isArray(pages) ? pages : []).map(normalizePagePath).filter(Boolean);
  // WHERE THE PAGE IS MOVING TO, read here because it decides the branch below;
  // its own reasons are marked further down, where they always were.
  const rawMove = !remove && typeof input.rename === "string" ? input.rename.trim() : "";
  const movePath = rawMove.startsWith("/") ? normalizePagePath(rawMove) : null;
  // ⚠ A REMOVAL OR A MOVE OF A PAGE THE SITE DOES NOT HAVE IS NOT AN ADDITION
  // (2026-10-02, the whole-router audit's W5). It was turned into one with
  // everything else that named an unknown page, and the part the router held
  // back stayed held back — so "take the Events page off and add a page for
  // our cake orders", on a site with no Events page, sent the add-on step "take
  // the Events page off the site and ." and put the cake page off: the half it
  // could not do run, the half it could held back. The model's own fields say
  // what the change is: taking a page away or moving it, which no addition
  // makes. So the answer stays an edit, and the page step answers it with the
  // site's real pages at no cost for the edit (`page/no-page`), the held-back
  // part named beside it. An edit of a page the site lacks is still an
  // addition, on that page.
  // ⚠ AND ONLY AGAINST THE SITE'S WHOLE LIST (2026-10-03). A page missing from
  // a list that may be partial — the browser's own, when the route could not
  // read the site's (`pagesComplete` false) — is not a page the site lacks: the
  // browser kept six pages across a reload, so an edit of the seventh became an
  // addition. It stays an edit, and the edit step checks it against the site's
  // real pages (`page/no-page` at no cost for the edit when it truly is not
  // there).
  if (known.length && !known.includes(want) && !remove && !(movePath && movePath !== want)) {
    if (pagesComplete === false) {
      mark("page-unverified");
    } else {
      mark("page-unknown");
      return { intent: FALLBACK_WITH_SITE, answer: "", converted: { reason: "page-unknown", page: want } };
    }
  }
  if (!known.length) mark("page-unchecked");
  if (want !== input.page) mark("page-normalized");
  // ── TAKING THE PAGE AWAY, DECIDED HERE AND NOWHERE ELSE ───────────────────
  //
  // MEASURED THREE TIMES: asked to delete a page, the page model rewrites the
  // site and never sets the field that deletes one. The words were made
  // unmissable, the schema constraint that forbade the honest answer was removed,
  // and it still did not happen. So this stops being something a model
  // volunteers and becomes something the ROUTER decides — which it is already
  // equipped for, because it has just resolved the page against the site's real
  // list. A deletion then needs NO page generation at all: ~0.3 credits and a
  // recompile, against the ~28 a rewrite costs.
  //
  // THE BIAS IS INVERTED HERE, AND DELIBERATELY. Everywhere else in this file an
  // unclear answer resolves to WORK, because a wrong refusal is worse than a
  // wrong action. Removal is the one verb where that is false: a wrong "edit"
  // costs a page the customer can see and undo, and a wrong "remove" takes their
  // page away. So it is `=== true` and nothing merely truthy, it only applies to
  // a page that really exists, and everything else is an ordinary page edit.
  //
  // It is safe to be this direct because the merge still refuses the dangerous
  // cases — never the home page, never one another page still links to — and a
  // publish is archived, so a page deleted by mistake is one restore away.
  // ── MOVING THE PAGE, WHICH IS THE OTHER THING ONLY THIS LAYER CAN DO ──────
  //
  // A NEW ADDRESS AND A REMOVAL ARE MUTUALLY EXCLUSIVE, and the removal wins.
  // A model answering both has contradicted itself, and of the two readings
  // "delete it" is the one they plainly asked for if they asked for it at all;
  // moving a page that is on its way out is work nobody wanted.
  //
  // NOT VALIDATED HERE BEYOND ITS SHAPE. `renameRoute` owns every refusal that
  // matters — the home page has no address to move, the target must not already
  // exist, the source must — and it owns them because it is the thing that can
  // SEE the pages. A second opinion here would be a second place for the rules
  // to drift, and this repo has that failure written down several times over.
  // What this does is refuse anything that is not a path at all, so a heading
  // ("Services") cannot reach the renamer as an address.
  //
  // THE LEADING SLASH IS REQUIRED HERE AND NOT ABOVE, and the asymmetry is the
  // whole guard. `normalizePagePath` ADDS one — right for `page`, where a model
  // naming which page it means may reasonably answer `book` or `/book`, and
  // wrong for this field, where the slash is the only thing separating "move it
  // to /services" from "call it Services". Without this, a heading normalises
  // into an address and the page silently moves; caught by its own test rather
  // than reasoned about, because the lenient helper looked safe to reuse.
  const raw = rawMove;
  const rename = movePath;
  const moving = rename && rename !== want ? { rename } : {};
  if (given(input.rename)) {
    if (remove) mark("rename-with-remove");
    else if (!rename) mark("rename-not-path");
    else if (rename === want) mark("rename-same-page");
    else if (rename !== raw) mark("rename-normalized");
  }
  // `remove` is read once, at the top, so the logo layer gets the same field
  // this branch does — it was declared here and the early return above stripped
  // it from every other layer.
  return { intent: "edit", answer: "", layer, page: want, ...removal, ...moving };
}

/**
 * A question the interface can actually render, or null.
 *
 * Null is not an error path — it is the ordinary answer for anything malformed,
 * and the caller turns it into a build. Everything here is a shape the model can
 * plausibly produce: one option, six options, the same answer twice, an empty
 * string among them, a whole paragraph as an option.
 *
 * Deduped CASE-INSENSITIVELY and after trimming, because "Book online" and
 * "book online " are one choice wearing two buttons — and dropping duplicates is
 * what can take a four-option question below the minimum, so the count is
 * checked AFTER the cleaning rather than before it.
 */
/**
 * One option, cut to fit a button.
 *
 * AT A WORD BOUNDARY, never mid-word. Measured live: the model returned "Tell me
 * what you do and I'll ask what people should be able to do", which the old
 * blunt slice rendered as "…and I'll ask what people sho" — a button ending in a
 * fragment, which reads as the interface being broken rather than as the model
 * having written the wrong thing.
 *
 * The clip is a backstop and not the fix; an option that needs clipping at all
 * is a sentence rather than an answer, which is what the tool description now
 * says. This just makes the failure legible when it happens anyway.
 */
export function clipOption(raw) {
  const s = String(raw == null ? "" : raw).trim().replace(/\s+/g, " ");
  if (s.length <= MAX_OPTION_CHARS) return s;
  const cut = s.slice(0, MAX_OPTION_CHARS);
  const sp = cut.lastIndexOf(" ");
  // Only honour the boundary if it leaves most of the button used — a very
  // early space would throw away nearly all of a long single-word answer.
  return (sp >= MAX_OPTION_CHARS * 0.5 ? cut.slice(0, sp) : cut).trim();
}

/**
 * The question text, bounded WITHOUT being mutilated.
 *
 * It was `.slice(0, 240)`, and a live round on 2026-08-09 shipped the customer
 * *"…welcoming and community-focused, or hardcore and inte"* — cut mid-word, on
 * screen, in the one message whose whole job is to read like a person talking.
 *
 * `clipOption` two functions down had already solved this properly for the
 * buttons; the text was written with a bare slice and nobody noticed the
 * asymmetry. Same rule here: fall back to the last word boundary, and only
 * honour it if it leaves most of the allowance used, so a long unbroken run is
 * not thrown away entirely.
 *
 * The ellipsis is deliberate — a sentence that simply stops reads as a bug,
 * where one that trails off reads as brevity. Nothing is actually lost when it
 * fires: the model's habit is to list the options in prose and the buttons
 * below already carry them.
 */
export function clipQuestion(raw) {
  const s = String(raw == null ? "" : raw).trim().replace(/\s+/g, " ");
  if (s.length <= MAX_QUESTION_CHARS) return s;
  const cut = s.slice(0, MAX_QUESTION_CHARS - 1);
  const sp = cut.lastIndexOf(" ");
  return ((sp >= MAX_QUESTION_CHARS * 0.6 ? cut.slice(0, sp) : cut).trim() + "…");
}

export function readQuestion(raw) {
  const q = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : null;
  if (!q) return null;
  const text = clipQuestion(q.text);
  if (!text) return null;
  const seen = new Set();
  const options = [];
  for (const o of Array.isArray(q.options) ? q.options : []) {
    // A STRING, not anything stringifiable: `String(["a","b"])` is "a,b", which
    // renders as one button offering two answers.
    if (typeof o !== "string") continue;
    const label = clipOption(o);
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    options.push(label);
    if (options.length >= MAX_OPTIONS) break;
  }
  if (options.length < MIN_OPTIONS) return null;
  return { text, options };
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
    out.push(p.handled === true ? { q, a, handled: true } : { q, a });
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

/** A model request with the answers in their own section; the request itself when there are none to show. */
export function withContext(request, context) {
  return afterLastUser(request, contextBlock(context));
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
    .filter((p) => p.q && p.a)
    .slice(0, MAX_CLARIFY);
  if (!pairs.length) return base;
  return base + "\n\nThey were asked, and answered:\n" +
    pairs.map((p) => "- " + p.q + " " + p.a).join("\n");
}

/**
 * The four token kinds, in the shape `pageCredits` prices.
 *
 * Same shape as the schema and pages calls so there is one price table for all
 * three — this call is cheap, but "cheap" is not a billing rule, and a model
 * whose price changes should not need a second place edited.
 */
export function askUsage(reply, model = ASK_MODEL) {
  const u = (reply && reply.usage) || {};
  return {
    in: Number(u.input_tokens) || 0,
    out: Number(u.output_tokens) || 0,
    cacheRead: Number(u.cache_read_input_tokens) || 0,
    cacheWrite: Number(u.cache_creation_input_tokens) || 0,
    // The rate column. `askRequest` sends this same constant, so the call and
    // its price cannot disagree — and without it the router was billed at Sonnet
    // rates for a Haiku call, three times over. Invisible today, because a
    // routing call rounds up to the one-credit floor either way; it stops being
    // invisible the moment anything on this path gets bigger.
    model,
  };
}

// ── WHY A ROUTING CALL FAILED, IN WORDS THAT CANNOT CARRY A SECRET ─────────
//
// (Lane 1b, 2026-09-30.) One bare `catch` covered building the request and
// sending it, and the answer kept only `failed: true`. Run 70 (Batch 1) answered
// `addon` + `failed` in 0.4 s and nothing could say why — the xAI account's
// balance was empty, which the owner found by looking. So the failure is named
// now: WHICH STEP threw, and what the evidence allows about why.
//
//   request    — the request could not be built. Nothing was sent.
//   config     — a provider key is not set. Nothing was sent.
//   provider   — the provider answered with an error status.
//   timeout    — our own clock ran out before an answer arrived.
//   transport  — the send threw with no status: the connection failed, or an
//                answer came back that could not be read. `error` says which
//                class, where it can.
//
// EVERY FIELD IS AN ALLOW-LIST, NEVER TEXT. A provider's message can quote the
// request, which holds the customer's words, and an error can carry a header or
// a connection string; none of that is ever read into this object. The status
// is an HTTP status or nothing, the provider's code is one from its own finite
// table (`PROVIDER_CODES`, below) or nothing, and the error is named by a class
// from a fixed list. The Worker hands in its own `upstreamKind` as `classify`,
// so provider errors have one reader, not two.
export const ROUTE_FAILURE_KINDS = ["request", "config", "provider", "timeout", "transport"];
export const ROUTE_ERROR_CLASSES = ["Error", "TypeError", "RangeError", "SyntaxError", "ReferenceError", "TimeoutError", "AbortError"];

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
  // OUR OWN SENTENCE, thrown by `callBuilderModel` before anything is sent, so
  // matching it reads nothing a provider or a customer wrote.
  if (e && typeof e.message === "string" && /^(?:XAI|ANTHROPIC)_API_KEY is not set$/.test(e.message)) return { ...out, kind: "config" };
  return out;
}

/**
 * Route one message.
 *
 * `deps.send(request)` → the raw Messages API response. Injected so the whole
 * decision runs in tests with no network. `deps.classify(error)`, optional, is
 * the caller's reader of a provider's error body (`upstreamKind` in the Worker).
 *
 * A THROW IS A BUILD, not an error the caller has to handle. See `readRouting`:
 * this sits in front of a path that works, and the worst thing it can do is stop
 * that path running. `usage` comes back null on that route, so nothing is billed
 * for a call that failed — the same our-fault rule the build path follows. And
 * it says why, as `failure` (`routeFailure` above).
 */
export async function routeMessage(deps, { message, site, firstBuild = false, brief = "", qa = [], answering = false, attached = false, hasSite = false, model = ASK_MODEL, tablesFilled = false, pagesFilled = false, pagesComplete = true, canAsk: askable = false, context = [], pending = null } = {}) {
  const text = String(message || "").trim();
  // AN EMPTY MESSAGE NEVER REACHES THE MODEL. The composer will not send one, but
  // this is a paid call behind a public route and "the client wouldn't do that"
  // is not a gate.
  if (!text) return { intent: "build", answer: "", usage: null, decision: routeDecision(["no-message"]) };
  // THE BUDGET IS SPENT HERE, in arithmetic, before the model is asked. Owner's
  // call is one question at a time on a first build; `MAX_CLARIFY` is what stops
  // "one at a time" becoming "one after another after another", and a cap the
  // model is merely told about is not a cap.
  const questions = (Array.isArray(qa) ? qa : []).filter((p) => p && p.q && p.a);
  const canClarify = !!firstBuild && questions.length < MAX_CLARIFY;
  // A SITE THAT EXISTS ASKS WHEREVER A QUESTION CAN BE KEPT (2026-10-02):
  // `canAsk` is the route's word that it can keep one. `context` is what they
  // already told us about the waiting request (its earlier answers, read with
  // the steps' own reader), shown beside it and never asked again. HOWEVER
  // MANY ANSWERS IT CARRIES, a question is still offered (2026-10-03, the
  // owner's third review): the total-answer limit is never a reason to act on
  // a guess. A caller that lies about either gets fewer questions or more of
  // its own routing calls, never anybody else's.
  const live = !!hasSite && !firstBuild;
  const waiting = live && pending && typeof pending === "object" ? pending : null;
  const told = waiting ? (readContext(context) || []) : [];
  const canAsk = live && askable === true;
  // `hasSite` IS NOT `!firstBuild`, and collapsing them is the tempting mistake.
  // `firstBuild` is the composer's belief about a project in localStorage;
  // `hasSite` is the server's knowledge that this slug has a published site it
  // owns. They agree almost always, and the case where they do not — a project
  // whose build failed, a stale tab — is exactly the case where routing an edit
  // at a site that does not exist costs a lane with no input. Passed in, and
  // defaulting to false so any caller that has not been taught about it behaves
  // exactly as it did before these two rungs existed.
  const pages = (site && Array.isArray(site.pages)) ? site.pages : [];
  // WHAT THE MODEL IS SHOWN, CUT OR FILLED IN: the decision's `context` codes
  // (`ROUTE_REASONS`), which leave its source alone. Collected INSIDE the
  // request's own catch below, because they read the same caller-supplied
  // values the request does: a brief whose `toString` throws must still end as
  // `request-failed`, exactly as it did before these were named.
  const shown = [];
  // A THROW IS THE BOTTOM OF THE LADDER FOR THIS STATE, not unconditionally a
  // build. On an existing site an unreachable router used to mean the customer
  // paid ~25 credits and had every page rewritten because a Haiku call timed
  // out. `addon` is recoverable in a way that is not.
  //
  // TWO STEPS, TWO CATCHES, ONE FALLBACK: building the request and sending it
  // fail for different reasons, and only telling them apart lets the answer say
  // which (`failure`). What the customer's message leads to is unchanged.
  const fail = (stage, e) => ({
    intent: !!hasSite ? FALLBACK_WITH_SITE : FALLBACK_NO_SITE, answer: "", usage: null, failed: true,
    failure: routeFailure(stage, e, { model, classify: deps && deps.classify }),
    decision: routeDecision([...shown, stage === "request" ? "request-failed" : "send-failed"]),
  });
  let request;
  try {
    // A FIRST BUILD'S MESSAGE IS CUT TO ITS OWN BOUND (`askRequest`); a site
    // that exists is sent its message whole (2026-10-03).
    if (!live && text.length > MAX_MESSAGE) shown.push("message-cut");
    if (canClarify && String(brief || "").trim().length > MAX_MESSAGE) shown.push("brief-cut");
    const lists = digestLists(site);
    if (lists.tablesCut) shown.push("tables-cut");
    // The route's own word that it filled the table names in (Lane 1d), and the
    // page addresses (2026-10-03).
    if (tablesFilled === true) shown.push("tables-filled");
    if (pagesFilled === true) shown.push("pages-filled");
    request = askRequest({ message: text, site, canClarify, brief, qa: questions, hasSite: !!hasSite, model, live, canAsk, pending: waiting, context: told });
  } catch (e) {
    return fail("request", e);
  }
  let reply;
  try {
    reply = await deps.send(request);
  } catch (e) {
    return fail("send", e);
  }
  // AN ANSWER CUT OFF AT ITS CEILING, ON A SITE THAT EXISTS, IS NO ANSWER
  // (2026-10-03): its held-back part or page may stop mid-word, and nothing is
  // ever run on half of one. A failure of the call, unbilled — our ceiling. A
  // first build reads its answer exactly as before.
  const cutOff = (r, reasons) => (live && r && r.stop_reason === "max_tokens"
    ? { intent: FALLBACK_WITH_SITE, answer: "", usage: null, failed: true, failure: routeFailure("answer", null, { model }), decision: routeDecision([...reasons, "answer-cut"]) }
    : null);
  { const c = cutOff(reply, shown); if (c) return c; }
  // WHETHER THE PAGE LIST IS THE SITE'S WHOLE LIST (2026-10-03): a page missing
  // from a list that may be partial is never read as a page the site lacks.
  const readAs = (r, open, tr) => readRouting(r, {
    canClarify, answering: !!answering, attached: !!attached, hasSite: !!hasSite, pages, pagesComplete: pagesComplete !== false, trace: tr,
    live, canAsk: open, pending: !!waiting, chosen: !!(waiting && waiting.chosen === true),
  });
  let trace = { reasons: shown.slice(), input: undefined };
  let routed = readAs(reply, canAsk, trace);
  // ── A QUESTION IT WAS ALREADY ANSWERED (2026-10-02, the owner's second review:
  //    *"when an answer did not resolve the ambiguity, retain the pending
  //    request and let the model ask a more specific follow-up; when the
  //    answer already exists, reuse it instead of asking again"*) ──────────
  //
  // Only for a reply that answers the waiting question: every answer the
  // request now carries is this one and those before it, read as the route
  // will store them (`appendAnswer`). A question back that is one of theirs
  // again (`repeatOf`) is never put to the customer as if new: the router is
  // sent the same request once more with those answers in front of it
  // (`withReuse`), to act on them or ask a more specific question
  // (`clarify-reused`); a router that still asks it is kept with a note naming
  // the answer that did not settle it (`clarify-again`, `againNote`). Only the
  // reply that is used is billed: the call asked again is ours.
  //
  // AT THE REPEATED-QUESTION THRESHOLD OR PAST THE TOTAL-ANSWER LIMIT, IT IS
  // NEVER SENT AGAIN (2026-10-03, the owner's third review: *"Never treat a
  // question limit or repeated question as permission to act … Stop automatic
  // retry loops while keeping a user-driven way to clarify or cancel"*). It
  // was sent with questions closed, to act on a guess. Now its question is
  // kept as it came, under the note (`clarify-again` with no `clarify-reused`
  // before it), and the waiting request stays as it is for the customer's
  // next answer or their Cancel.
  if (waiting && routed.unusable !== true && routed.intent === "clarify" && routed.answered === true) {
    // THE ANSWER WHOLE, as the route stores it (2026-10-03): one past the size
    // policy never reaches here — the route refuses it first.
    const all = appendAnswer(told, { q: String(waiting.question && waiting.question.text || "").trim(), a: text }) || [];
    const hit = repeatOf(all, routed.question);
    if (hit.length && (hit.length >= MAX_SAME_ASK || all.length >= MAX_ASKED)) {
      trace.reasons.push("clarify-again");
      // `repeat` IS WHAT THE NOTE IS MADE OF (2026-10-03): the answers that did
      // not settle the question and whether our own re-asking has stopped, so
      // the route can have the note written from them (`repeatNoteFacts`) and
      // keep `againNote` as its fallback.
      routed = { ...routed, again: true, note: againNote(hit), repeat: { answers: hit, atLimit: true } };
    } else if (hit.length) {
      let again;
      try {
        again = withReuse(askRequest({ message: text, site, canClarify, brief, qa: questions, hasSite: !!hasSite, model, live, canAsk, pending: waiting, context: told }), hit);
      } catch (e) {
        return fail("request", e);
      }
      try {
        reply = await deps.send(again);
      } catch (e) {
        return fail("send", e);
      }
      { const c = cutOff(reply, [...shown, "clarify-reused"]); if (c) return c; }
      trace = { reasons: [...shown, "clarify-reused"], input: undefined };
      routed = readAs(reply, canAsk, trace);
      const still = routed.unusable !== true && routed.intent === "clarify" ? repeatOf(all, routed.question) : [];
      if (still.length) {
        trace.reasons.push("clarify-again");
        routed = { ...routed, again: true, note: againNote(still), repeat: { answers: still, atLimit: still.length >= MAX_SAME_ASK || all.length >= MAX_ASKED } };
      }
    }
  }
  // AN ANSWER THAT CANNOT BE USED, ON A SITE THAT EXISTS, IS A FAILURE OF THE
  // CALL (2026-10-02): a question that cannot be shown, or a reply to a waiting
  // question that does not say whether it answers it. Never work in its place,
  // and nothing billed for it — our model, our fault, the build path's rule.
  if (routed.unusable === true) {
    return {
      intent: FALLBACK_WITH_SITE, answer: "", usage: null, failed: true,
      failure: routeFailure("answer", null, { model }),
      decision: routeDecision(trace.reasons, trace.input),
    };
  }
  return { ...routed, usage: askUsage(reply, model), decision: routeDecision(trace.reasons, trace.input) };
}
