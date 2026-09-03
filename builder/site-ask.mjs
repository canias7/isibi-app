
import { modelsFor } from "./build-models.mjs";// Telling a question from an instruction — and answering the question.
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

/** How much of the message we will even consider. A brief is capped at 2000 client-side. */
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

/** Two to four. One option is not a choice; five is a form. */
export const MIN_OPTIONS = 2;
export const MAX_OPTIONS = 4;
/** Two short sentences. A hard bound, since a cap the model is told about is not one. */
export const MAX_QUESTION_CHARS = 240;

/** Long enough to be a real answer, short enough to sit on a button. */
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
export const REMOVABLE_LAYERS = ["page", "logo"];

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
          "something it has no table for, or a section, a QR code, a 3D scene, a form, a map or a photograph on a page " +
          "that does not have one. The page existing does not make it an edit: \"Add a testimonials section to the home " +
          "page\" is an addon, because the section does not exist yet.\n" +
          // THE BACKEND IS THE ADDON'S TOO (owner, 2026-09-03): a first build
          // sends none of it, so every function, outside connection and
          // scheduled job a site gets is added after the build — and the
          // first of any of them on a site with no database makes one.
          "SO IS ANYTHING THE SITE'S DATABASE HAS TO DO THAT IT DOES NOT DO YET: a lookup or a cancel a page needs " +
          "(a database function), something read live from an outside service — an exchange rate, a courier's " +
          "slots, the weather — or something that happens ON A TIMER with nobody there: a reminder the day before, " +
          "a weekly digest. A site with no database gets one the first time any of these is added.\n" +
          "\"edit\" is for what the site ALREADY HAS, changed: its words, colours, stylesheet, button, menu, pictures, " +
          "languages, what a control does — and its own code. Changing a component is an edit, because the page's code " +
          "always exists.\n\n" +
          "THE QUESTION THAT SEPARATES EDIT FROM ADDON: does the thing they name exist on the site now? It does — " +
          "\"edit\". It does not — \"addon\". A page the site does not have, or a table it does not have, is always " +
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
      alsoAsked: {
        type: "string",
        description:
          "THE SECOND, SEPARATE THING THEY ASKED FOR AND THIS TURN IS NOT DOING — in their own words, copied from " +
          "their message so they can send it straight back. One change happens per turn, so \"make the background " +
          "yellow and add a booking form\" does the colour and this field holds \"add a booking form\". Without it " +
          "the second half is dropped in silence and they are told the first one worked.\n" +
          "ALMOST ALWAYS LEAVE THIS OUT. Two things said about ONE change is still one change: \"make the background " +
          "yellow and the corners rounder\" is a single look edit, \"put Book first and drop Prices\" is a single " +
          "menu edit, and \"change the phone number in the header and the footer\" is one wording edit in two places. " +
          "It belongs here ONLY when the leftover would go to a DIFFERENT part of the site than the one you just " +
          "named in `layer` — and never for a detail, a reason or a restatement of the change you are doing.\n" +
          "Being wrong here costs them a sentence about something they did not ask for, which is worse than useless: " +
          "it reads as the builder misunderstanding them. When in doubt, say nothing.",
      },
      layer: {
        type: "string",
        enum: EDIT_LAYERS,
        description:
          "Only when intent is \"edit\", and required for one. Which part of the site the change lives in.\n" +
          "\"data\" — the content the site STORES and shows in a list: a price, a menu item, a service, an opening " +
          "time, a team member. ASK YOURSELF WHETHER IT IS ONE OF MANY — a price sits in a price list, a dish sits on " +
          "a menu, and those live in the site's database rather than being written into the page. This is the " +
          "cheapest and fastest thing the builder can do, so prefer it whenever the thing being changed is one row " +
          "of something the site lists. The tables it has are named above.\n" +
          "\"text\" — ONLY the words change and nothing else: a heading, a sentence, a button label, a phone number, an " +
          "address, a price written on the page. Nothing moves and nothing changes colour. This is the cheapest thing the " +
          "builder can do, so prefer it whenever it is honestly true.\n" +
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
          "\"rules\" — WHAT THE SITE DOES WITH WHAT PEOPLE SUBMIT, rather than anything on a page. Who may see an " +
          "entry and who may add one (\"let people browse the listings without signing in\", \"close the booking " +
          "form\"), whether the customer gets an email or a text when they submit, and what the site refuses (\"don't " +
          "let two people book the same slot\", \"only twenty places\", \"one review per customer\"). NOTHING A " +
          "VISITOR CAN SEE CHANGES, which is why it is nearly free — so prefer it whenever the change is honestly " +
          "about behaviour rather than appearance. If the ask ALSO needs something new on a page — a button, a form " +
          "field — that is \"addon\", not this.\n" +
          "\"picture\" — A PHOTOGRAPH ON A PAGE: swapping one for another, putting one in a space that has none, " +
          "taking one off, or CHANGING WHICH PART OF IT YOU SEE. \"Use my own photo of the shop instead\", \"the " +
          "picture of the chairs is wrong\", \"add a photo to the about page\". This is about the IMAGE ITSELF and " +
          "never about the words beside it or where it sits on the page.\n" +
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
          "scrolls to the bottom for. \"Put our number in the footer\", \"the address is wrong, we've moved\", " +
          "\"add our opening hours at the bottom\", \"show our email\", \"take the opening times off\". It is the " +
          "same block on every page, so it changes everywhere at once and costs almost nothing.\n" +
          "A FULL DAY-BY-DAY TIMETABLE IS NOT THIS — that is rows the site stores, so it is \"data\". This is the " +
          "one line at the bottom (\"Tue–Sun 12–10\").\n" +
          "THE SOCIAL ICONS AND THE SMALL PRINT are here too — \"add our Instagram\", \"put a link to our Facebook " +
          "at the bottom\", \"add a Privacy link in the small print\", \"take the Twitter icon off\". Same block, " +
          "same page-wide change, same near-zero cost.\n" +
          "AND HOW THE FRAME ITSELF SITS — \"centre our logo\", \"put the name in the middle\", \"run the header " +
          "right across the screen\", \"the top bar shouldn't follow me as I scroll\". That is WHERE the bar's " +
          "parts go and how wide it runs; its COLOURS, corners and typefaces are \"look\", not this.\n" +
          "THE MENU — which items are in it, what order they come in, taking one out. \"Put Book first\", \"add " +
          "Contact to the menu\", \"take Pricing out of the nav\", \"the menu should be Home, Services, Contact\".\n" +
          "THE BUTTON — what it says AND where it goes. \"Change the Book button to Get a quote\", \"make the button " +
          "call us instead\", \"point the button at the contact page\", \"add a Call now button at the top\", \"drop " +
          "the button\". A phone number belongs here: for a trade whose customers ring rather than book, that button " +
          "IS the site's whole purpose.\n" +
          "LINKS WRITTEN INTO THE PAGES belong here too — \"the Send an enquiry link should go to the contact " +
          "page\", \"make Read more point at the blog\". Every link on the site with those words moves at once, on " +
          "every page carrying one, which is the part no other lane can do.\n" +
          "The menu and the button are the same on every page, so this changes all of them at once and is nearly " +
          "free.\n" +
          "IT ONLY EVER POINTS AT PAGES THE SITE ALREADY HAS. \"Add a gallery to the menu\" when there is no gallery " +
          "page is an \"addon\" — the page has to exist before anything can link to it. The pages it has are listed " +
          "above.\n" +
          "\"page\" — the arrangement of ONE existing page: move a section, take one out, lay a list out differently, " +
          "add a block built from parts the page already has. Name it in `page`.\n" +
          "THIS IS ALSO WHERE A PAGE IS DELETED. \"Remove the gallery page\" is this layer, that page in `page`, and " +
          "`remove` true — not a rewrite of the site and not a question back. Deleting costs almost nothing precisely " +
          "because it comes here.\n" +
          "ONE PAGE, AND ONLY ONE. If the change is meant to land on several — \"put the phone number in the footer " +
          "of every page\" — this is NOT the layer for it: it edits the single page you name and leaves the rest " +
          "exactly as they are, so the site would end up disagreeing with itself. Answer \"addon\" for those; it can " +
          "touch the pages a visitor would look on.\n" +
          // THIS CLAUSE USED TO SEND EVERY MENU CHANGE TO THE ADDON LANE, by
          // name: "add the gallery to the menu everywhere" was its own worked
          // example of something to answer "addon" for. That was correct while
          // nothing could edit a menu — the nav is a separate copy in every page
          // file, so it really did need a lane that touches them all. With the
          // `nav` layer there it is a ~27-credit page-generation call to move one
          // word, and the example has to point at the cheap lane or the layer is
          // reachable by nothing.
          "A MENU CHANGE IS \"nav\", NOT THIS AND NOT \"addon\". It lands on every page and costs almost nothing.\n" +
          "\"rename\" — THE SITE'S WEB ADDRESS, and nothing else: the word in <name>.gofarther.app. Pick it when " +
          "they ask to rename the site, move it, or have it at a different address. NOT for changing the business's " +
          "NAME as it reads in the header — that is the name on the page and it is a look change; a site can be " +
          "called \"Sunset Shoes\" and live at shoeroom-1, and plenty do. The old address keeps working and sends " +
          "people to the new one, so this is safe to pick when they plainly asked for it — and only then. ALSO " +
          "\"rename\" when they want an OLD address to stop working after a rename (\"forget the old address\", " +
          "\"drop crookes-guitar\", \"stop the old name working\").",
      },
      page: {
        type: "string",
        description:
          "Only when layer is \"page\". The route path of the page being changed, copied EXACTLY from the list of pages " +
          "above — \"/\" for the home page, \"/menu\", \"/book\". If the change is about a page that is not in that list, the " +
          "site does not have it yet and the intent is \"addon\", not \"edit\".",
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
          "a picture is never a removal.",
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
  const pages = Array.isArray(s.pages) ? s.pages.filter((p) => typeof p === "string" && p.trim()).slice(0, 24) : [];
  if (pages.length) bits.push("Its pages are: " + pages.join(", ") + ".");
  const tables = Array.isArray(s.tables) ? s.tables.filter((t) => typeof t === "string" && t.trim()).slice(0, 24) : [];
  if (tables.length) bits.push("Its database tables are: " + tables.join(", ") + ".");
  if (!bits.length) return "They have not built anything yet — this is a brand new, empty project.";
  return bits.join(" ");
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
  "shade of blue must never be given a new site.\n\n" +
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
export function askRequest({ message, site, canClarify = false, brief = "", qa = [], hasSite = false, model = ASK_MODEL } = {}) {
  const text = String(message || "").trim().slice(0, MAX_MESSAGE);
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
  const asked = (Array.isArray(qa) ? qa : []).filter((p) => p && p.q && p.a).slice(0, MAX_CLARIFY);
  const left = MAX_CLARIFY - asked.length;
  // WHAT THE ROUND SO FAR WAS, so the next question is not the last one again.
  // Only present on a first build; a revise sends none of this and is told
  // plainly that questions are closed, rather than being left to infer it from
  // an absent section.
  const round = canClarify
    ? "\n\nBEFORE THE BUILD\nThis is their FIRST build — nothing exists yet, so you MAY ask one question before " +
      "building. You have " + left + " question" + (left === 1 ? "" : "s") + " left, and the build starts on its own " +
      "once they are used up — but a question is worth asking only if its answer changes what you would build. If " +
      "you already know what the business is and what people do on the site, build now.\n" +
      (asked.length
        ? "WHAT YOU HAVE ALREADY ASKED — do not ask any of these again, or anything close to them:\n" +
          asked.map((p) => "- " + String(p.q).trim() + " -> " + String(p.a).trim()).join("\n") + "\n"
        : "") +
      "THE BRIEF THEY STARTED WITH\n" + String(brief || "").trim().slice(0, MAX_MESSAGE)
    // NO WORK-INTENT ENUMERATION HERE, deliberately. This sentence read
    // `answer "build" or "ask" only` until 2026-08-14 — written when those were
    // the only intents, never updated for the escalation ladder — so every
    // message about a LIVE site carried two contradictory instructions: the
    // state block saying "edit or addon, never build" and this one pointing at
    // the ~25-credit rebuild. The state block is the ONE place legal answers
    // are named; this block owns exactly one fact, that clarify is over.
    : "\n\nQUESTIONS\nQuestions are closed for this message — never answer \"clarify\".";
  return {
    model,
    max_tokens: ASK_MAX_TOKENS,
    tools: [ASK_TOOL],
    // FORCED, like both of the other calls. Without it Haiku will happily answer
    // in prose, and the caller has no field to branch on — the whole point here
    // is a decision the code can read, not a reply a human has to interpret.
    tool_choice: { type: "tool", name: "route_message" },
    system: [{ type: "text", text: SYSTEM }],
    messages: [{ role: "user", content: "THEIR SITE\n" + siteDigest(site) + state + round + "\n\nTHEIR MESSAGE\n" + text }],
  };
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
export function readRouting(reply, { canClarify = false, answering = false, attached = false, hasSite = false, pages = [] } = {}) {
  const blocks = reply && Array.isArray(reply.content) ? reply.content : [];
  const use = blocks.find((b) => b && b.type === "tool_use");
  const input = (use && use.input) || {};
  const answer = String(input.answer || "").trim();
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
    if (q) return { intent: "clarify", answer: "", question: q };
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
  const also = readAlso(input);
  if (hasSite && input.intent === "addon") return { ...work("addon"), ...also };
  if (hasSite && input.intent === "edit") return { ...readEdit(input, pages), ...also };
  // "build" IS STILL HONOURED ON AN EXISTING SITE, deliberately and narrowly:
  // it is the only way to say "scrap this and make me a different site", which is
  // a thing people really do ask for. The tool description is what keeps it rare.
  if (input.intent === "build") return work("build");

  const intent = input.intent === "ask" ? "ask" : fallback;
  // AN "ask" WITH NOTHING TO SAY IS A BUILD. The model chose the cheap branch and
  // then wrote no reply, so honouring it would show the customer an empty message
  // and do nothing — the one outcome worse than an unnecessary build.
  if (intent === "ask" && !answer) return work(fallback);
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
  if (intent === "ask" && (answering || attached)) return work(fallback);
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
 * A NOTE AND NEVER AN ACTION. Nothing downstream branches on it — it is one
 * sentence appended to the reply — so a model that over-reports costs the
 * customer a line about something they did not ask for, and one that
 * under-reports leaves today's behaviour exactly as it is. That asymmetry is why
 * the schema description tells it to stay silent when unsure, and why this
 * reader is strict rather than generous.
 *
 * A NON-STRING IS REFUSED RATHER THAN COERCED: `String(["a","b"])` is "a,b",
 * which would be shown to the customer as their own words. The same coercion bug
 * this repo has recorded on `normalizeRole` and on a table's `access`.
 *
 * ABSENT MEANS ABSENT — an empty object, so a response that has no leftover is
 * byte-identical to what it was before this existed.
 */
export function readAlso(input) {
  const raw = input && typeof input.alsoAsked === "string" ? input.alsoAsked.trim() : "";
  if (!raw) return {};
  // Long enough for a real second ask and short enough that it cannot become a
  // paragraph glued onto every reply.
  return { alsoAsked: raw.slice(0, MAX_ALSO_CHARS) };
}

/** One more sentence, not a second brief. */
export const MAX_ALSO_CHARS = 200;

export function readEdit(input, pages) {
  const layer = EDIT_LAYERS.includes(input && input.layer) ? input.layer : null;
  if (!layer) return { intent: FALLBACK_WITH_SITE, answer: "" };
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
  // WHICH SLOT THE ARTWORK GOES IN, read only for the layer that has two.
  // Scoped the way `remove` is, and for the same reason: a flag carried by a
  // layer that cannot act on it is one nothing reads, which is how this repo's
  // dead features start. Combines with `remove` — "take the favicon off" is
  // both, and the pair is what makes that removal hit the right slot.
  const tab = layer === "logo" && input && input.tab === true ? { tab: true } : {};
  if (layer !== "page") return { intent: "edit", answer: "", layer, ...tab, ...(REMOVABLE_LAYERS.includes(layer) ? removal : {}) };
  const want = normalizePagePath(input.page);
  if (!want) return { intent: FALLBACK_WITH_SITE, answer: "" };
  const known = (Array.isArray(pages) ? pages : []).map(normalizePagePath).filter(Boolean);
  if (known.length && !known.includes(want)) return { intent: FALLBACK_WITH_SITE, answer: "" };
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
  const raw = !remove && typeof input.rename === "string" ? input.rename.trim() : "";
  const rename = raw.startsWith("/") ? normalizePagePath(raw) : null;
  const moving = rename && rename !== want ? { rename } : {};
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

/**
 * Route one message.
 *
 * `deps.send(request)` → the raw Messages API response. Injected so the whole
 * decision runs in tests with no network.
 *
 * A THROW IS A BUILD, not an error the caller has to handle. See `readRouting`:
 * this sits in front of a path that works, and the worst thing it can do is stop
 * that path running. `usage` comes back null on that route, so nothing is billed
 * for a call that failed — the same our-fault rule the build path follows.
 */
export async function routeMessage(deps, { message, site, firstBuild = false, brief = "", qa = [], answering = false, attached = false, hasSite = false, model = ASK_MODEL } = {}) {
  const text = String(message || "").trim();
  // AN EMPTY MESSAGE NEVER REACHES THE MODEL. The composer will not send one, but
  // this is a paid call behind a public route and "the client wouldn't do that"
  // is not a gate.
  if (!text) return { intent: "build", answer: "", usage: null };
  // THE BUDGET IS SPENT HERE, in arithmetic, before the model is asked. Owner's
  // call is one question at a time on a first build; `MAX_CLARIFY` is what stops
  // "one at a time" becoming "one after another after another", and a cap the
  // model is merely told about is not a cap.
  const asked = (Array.isArray(qa) ? qa : []).filter((p) => p && p.q && p.a);
  const canClarify = !!firstBuild && asked.length < MAX_CLARIFY;
  // `hasSite` IS NOT `!firstBuild`, and collapsing them is the tempting mistake.
  // `firstBuild` is the composer's belief about a project in localStorage;
  // `hasSite` is the server's knowledge that this slug has a published site it
  // owns. They agree almost always, and the case where they do not — a project
  // whose build failed, a stale tab — is exactly the case where routing an edit
  // at a site that does not exist costs a lane with no input. Passed in, and
  // defaulting to false so any caller that has not been taught about it behaves
  // exactly as it did before these two rungs existed.
  const pages = (site && Array.isArray(site.pages)) ? site.pages : [];
  let reply;
  try {
    reply = await deps.send(askRequest({ message: text, site, canClarify, brief, qa: asked, hasSite: !!hasSite, model }));
  } catch {
    // A THROW IS THE BOTTOM OF THE LADDER FOR THIS STATE, not unconditionally a
    // build. On an existing site an unreachable router used to mean the customer
    // paid ~25 credits and had every page rewritten because a Haiku call timed
    // out. `addon` is recoverable in a way that is not.
    return { intent: !!hasSite ? FALLBACK_WITH_SITE : FALLBACK_NO_SITE, answer: "", usage: null, failed: true };
  }
  const routed = readRouting(reply, {
    canClarify, answering: !!answering, attached: !!attached, hasSite: !!hasSite, pages,
  });
  return { ...routed, usage: askUsage(reply, model) };
}
