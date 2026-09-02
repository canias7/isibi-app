// THE ONE SHAPE OF A TABLE, shared by the two paths that may ask for one.
//
// This literal is `design_schema`'s `backend.tables.items`, lifted out of
// worker.js on 2026-09-02 for the ADD step, which needs to ask for a table
// without calling the build's designer (docs/architecture.md: the steps must
// not share the designer). What the two callers share is the SHAPE — what a
// table IS: its columns, who may read and write it, the guarantees the
// database keeps — and that is the same object whether a site is being invented
// or added to. What they do NOT share is the FRAMING around it: the build's
// `tables` array says "the things this site has to REMEMBER — usually one to
// four", and the ADD step's tool says "the one table this change needs"; each
// keeps its own wording and wraps this.
//
// THE `BEHAVIOR_ITEM` PRECEDENT, exactly. Two readers forbidden to see each
// other (`builder/site-add.mjs` may not import from worker.js), one shape, so
// it lives in a module both may read rather than as two copies that drift in
// silence — this repo's "two lists of the same thing" trap, and the table
// shape is twenty-seven properties of it.
//
// BYTE-IDENTICAL TO WHAT SHIPPED. `test/integration/schema-tool.mjs` evaluates
// the real tool with this bound, and `test/dropped-fields.test.mjs` reads the
// property names off THIS file and asserts them against `TOOL_TABLE_FIELDS`
// in both directions, as it did against worker.js before the move.
//
// EVERY COMMENT BELOW IS THE BUILD TOOL'S OWN, moved with the text it explains.

export const TABLE_ITEM = {
  type: "object",
  properties: {
    name: { type: "string", description: "snake_case table name." },
    // REMOVING A FEATURE, without destroying what it collected.
          retired: {
type: "boolean",
description:
  "Set TRUE only when the message asks to REMOVE this table's feature from the site (\"drop the gallery\", " +
  "\"we don't take enquiries any more\"). The table and every row in it are KEPT — the owner can still read " +
  "and export them — but nothing on the site can reach it any more. Set FALSE to put a removed feature " +
  "back. LEAVE IT OUT ENTIRELY otherwise — omitting it keeps whatever the table already was, and saying " +
  "false on a table nobody asked about would restore something the owner removed.",
          },
          access: {
      type: "string",
      enum: ["collect", "display", "user", "feed", "admin"],
      description:
        "'display' = anyone reads it, nobody writes (menus, services, opening hours). " +
        "'collect' = anyone submits, nobody reads it back (bookings, orders, enquiries). " +
        "'user' = PRIVATE PER MEMBER: a signed-in visitor reads and writes only their own rows (saved recipes, my orders, a personal journal). " +
        "'feed' = SHARED, MEMBER-AUTHORED: every signed-in member reads all rows and writes their own (reviews, comments, a community board). " +
        "'admin' = SHARED, READ-ONLY FROM THE SITE: signed-in members read it and NOBODY writes it from a published page — the business maintains those rows from its Go Farther dashboard (announcements, staff notices). Pick it only when members should SEE something they never edit. " +
        "The last three require the visitor to have an account on the site — use them ONLY when the brief actually asks for members, sign-in, or 'their own' anything. A shop that just needs a menu and a booking form must not have them. " +
        "THESE FIVE ARE SHORTHANDS FOR A read/write PAIR. When none of them is the shape you need, set `read` and `write` instead and leave this out.",
    },
    // READ AND WRITE, SEPARATELY — the five names above cover 5 of the 16
    // combinations, and the missing ones are ordinary. A marketplace built
    // 2026-08-10 had no browsable page because "members post it, the public
    // reads it" is not one of the five: the designer correctly followed
    // "anything a visitor keeps as theirs" to `user`, and produced a site
    // whose every listing was invisible to the visitors it existed for.
    read: {
      type: "string",
      enum: ["none", "own", "members", "public"],
      description:
        "Who may READ this table, when the five shorthands do not fit. " +
        "'public' = anyone, signed in or not. 'members' = any signed-in member sees every row. " +
        "'own' = a signed-in member sees only their own rows. 'none' = nobody reads it from a page. " +
        "USE 'public' WITH write 'own' FOR ANYTHING VISITORS POST AND OTHER VISITORS BROWSE — a marketplace, classifieds, a directory, a job board, public reviews, a community wall. " +
        "That combination has no shorthand and is the one most often needed: without it the listings are invisible and the site has no page worth opening.",
    },
    write: {
      type: "string",
      enum: ["none", "own", "members", "anyone"],
      description:
        "Who may WRITE to this table, when the five shorthands do not fit. " +
        "'anyone' = any visitor with no account (a booking form). 'own' = a signed-in member writes rows that become theirs and edits only those. " +
        "'members' = any signed-in member may edit any row. 'none' = nothing on the published site writes to it; the business maintains it from its dashboard. " +
        "Note 'anyone' can never be combined with read 'own' — an anonymous visitor has no identity for a row to be 'theirs', so it resolves to read 'none'.",
    },
    // FOUR OF OUR OWN FEATURES THAT NOTHING COULD ASK FOR. Every one is
    // SQL this engine already writes — a unique index, a trigger, a
    // policy clause — and none had a slot on this form, so no site the
    // builder has ever made could have them. Audited before exposing:
    // `sequence`, `checks`, `audit`, `history` and `version` were left
    // out because they are NOT reachable end to end (a column nothing
    // stamps, a table nothing reads, a lock the client never sends), and
    // offering those would be the same dead-feature trap one layer up.
    oncePerUser: {
      type: "array",
      items: { type: "string" },
      description:
        "Columns that may hold only ONE row per signed-in member — usually just [] with no columns, meaning one row per member full stop. " +
        "ONE REVIEW PER CUSTOMER, one application per job, one vote per person, one booking per member per class. " +
        "A second attempt is refused by the database with a duplicate error the page turns into a sentence. Only on a table members write.",
    },
    enforceRefs: {
      type: "boolean",
      description:
        "Refuse a row whose `ref` column names a parent that does not exist. A booking for an event that was deleted, an order line for a product that is gone. " +
        "Turn it on for any table whose rows point at another table's rows — it is what stops the site filling with orphans nobody can explain.",
    },
    expires: {
      type: "boolean",
      description:
        "Give the table an `expires_at` column, and HIDE every row past it from every read, automatically. " +
        "A limited offer, a job advert that closes, an event listing that should stop showing the day after. " +
        "The owner sets the date from their dashboard; no page has to remember to filter, and one left unset never expires.",
    },
    scheduled: {
      type: "boolean",
      description:
        "Give the table a `publish_at` column, and HIDE every row until that time. " +
        "A post that goes live on Tuesday, a menu that changes at the weekend, a price list that starts next month. " +
        "The owner sets it from their dashboard; a row with none is live immediately.",
    },
    columns: {
      type: "array",
      // A picture is a `text` column holding a URL, and its NAME is what
      // decides whether the platform will accept a file for it — a
      // visitor may only upload to a table that declares one. Measured
      // 2026-07-28: across seven generated sites the designer put image
      // columns on `display` tables every time and on a `collect` table
      // never, so the upload path could not fire on a single one of them.
      description:
        "A picture is a 'text' column whose value is a URL — name it photo, image_url, avatar, logo, cover or hero_image. " +
        "Put one on a 'display' table when the site shows pictures it owns (a menu item, a product, a team member); the owner fills these in after the build. " +
        "Put one on a 'collect' or member table ONLY when the brief says the VISITOR sends a picture (a photo with their review, a reference image with their enquiry) — that is what lets the form accept a file at all.",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          type: { type: "string", enum: ["text", "integer", "real", "boolean", "json"] },
          required: { type: "boolean" },
          ref: { type: "string", description: "Name of a table this column points at." },
        },
        required: ["name", "type"],
      },
    },
    timestamps: { type: "boolean" },
    fts: { type: "boolean", description: "Enable full-text search over this table's text columns." },
    searchWeights: {
      type: "object",
      additionalProperties: { type: "integer" },
      description:
        "Only with `fts`. Which columns matter most in search, as column -> importance (bigger is more important). " +
        "A title is usually worth more than a body, and without this every column ranks the same — so searching a menu " +
        "for \"halloumi\" ranks a dish that merely MENTIONS it level with the one called it. Postgres has four tiers, " +
        "so these are an ordering rather than a scale. Omit it if every column is equally worth matching.",
    },
    defaultSort: {
      type: "string",
      description:
        "The column a list of these rows should normally be ordered by, `-` first for descending: \"-created_at\", \"name\", \"price\". " +
        "Newest-first for anything posted, alphabetical for a directory, soonest-first for anything booked. " +
        "This is what the PAGES are told to sort by; it is not enforced, so a page with a reason of its own may still differ.",
    },
    // THE CONSTRAINT TIER. Every one of these is kept by the DATABASE —
    // a CHECK, a generated column, a trigger — so what a table declares
    // here is true of the rows however they arrive. All three were
    // parsed, stored and enforced by nothing until 2026-08-16.
    checks: {
      type: "array",
      items: { type: "array", items: { type: "string" } },
      description:
        "Rules the database refuses to break, each `[column, operator, column-or-number]` with operator one of " +
        "gt, gte, lt, lte, eq, ne. `[\"end_time\", \"gt\", \"start_time\"]` makes a backwards booking impossible; " +
        "`[\"quantity\", \"gte\", \"1\"]` makes an order for zero impossible. A row with either side empty passes — " +
        "these compare values, they do not make a column required. Use them where a wrong row costs the owner money or time.",
    },
    computed: {
      type: "object",
      additionalProperties: { type: "array", items: { type: "string" } },
      description:
        "Columns the database fills in from other columns, as new-name -> list of parts. A part that names one of this " +
        "table's columns is that column's value; anything else is literal text. " +
        "`{\"full_name\": [\"first_name\", \" \", \"last_name\"]}` gives every row a `full_name` that can never disagree with its parts. " +
        "The name must be NEW — naming an existing column is refused, because these are rebuilt on every revise. " +
        "Text only, and read-only: nothing can write to one.",
    },
    transitions: {
      type: "object",
      description:
        "Which status changes are allowed, as column -> {from: [permitted next values]}. " +
        "`{\"status\": {\"pending\": [\"confirmed\", \"cancelled\"], \"cancelled\": []}}` means a cancelled booking can never " +
        "become confirmed again — the kind of rule a form can be talked past and a database cannot. " +
        "A value you do not list as a `from` is unconstrained, so declare only the states that matter. " +
        "Use it for bookings, orders and applications; skip it where any status may follow any other.",
    },
    // These are enforced by real Postgres constraints and have been since
    // the schema engine was written — and until 2026-07-28 the designer
    // could not emit ANY of them, so no generated site had one. Measured
    // live that day: two customers booked the same 14:00 slot on a
    // generated barber shop and both were accepted.
    unique: {
      type: "array",
      description:
        "Groups of columns that must be unique together, enforced by a real index (a violation is a 409, not a duplicate row). " +
        "USE THIS ON ANY BOOKING OR RESERVATION TABLE — without it two customers can take the same slot, which is the single most damaging bug a booking site can have. " +
        "A group is an array of column names: [[\"appointment_date\",\"appointment_time\"]] means nobody can book that date+time twice. " +
        "A group may instead be {\"columns\":[...], \"where\":\"status:eq:confirmed\"} so only rows in that state hold the slot — otherwise a CANCELLED booking occupies it forever.",
      // One consistent object shape. This was `items: {}` — an empty
      // schema, meant to allow both [["a","b"]] and [{columns,where}] —
      // and the API REJECTED the whole tool for it, so every build with
      // a brief answered "the designer is busy". Live for three merges.
      // The parser accepts the object form, so one shape is enough.
      items: {
        type: "object",
        properties: {
          columns: { type: "array", items: { type: "string" }, description: "The columns that must be unique together." },
          where: { type: "string", description: "Optional, as \"column:eq:value\" — only rows matching it hold the slot." },
        },
        required: ["columns"],
      },
    },
    uniqueCI: {
      type: "array",
      description: "Columns unique ignoring case — use for an email column, so Ada@x.com and ada@x.com cannot both sign up. Array of column names.",
      items: { type: "string" },
    },
    maxRows: {
      type: "integer",
      description: "Cap how many rows this table may ever hold. Worth setting on a public form (a giveaway with 500 places, a class with 20 seats); a full table answers 409 rather than growing forever.",
    },
    // `mask` USED TO BE HERE and was removed 2026-08-04, deliberately —
    // it is not a gap to fill back in.
    //
    // It promised field-level redaction: a phone shown as "••••1234" to
    // a reader who may not see it in full. `maskFields()` enforced that
    // on the read path in `site-data.mjs`, and that file was DELETED on
    // 2026-07-30 when reads moved to Neon's Data API. So the Worker is
    // no longer on the read path and has nothing to redact on the way
    // out; the function survived with zero callers, and the tool went on
    // offering the guarantee. A table declaring it served the raw value
    // to every reader, silently.
    //
    // It cannot move into the database as specified either: `mask` names
    // OUR application roles ("staff"), and Postgres knows `anonymous`
    // and `authenticated`. Column-level GRANTs express that coarser
    // split, but they make `select=*` fail outright — and `select=*` is
    // what every read this platform makes sends.
    //
    // So: a feature that lies, or no feature. Same call, for the same
    // reason, that pulled `teamRead` and `teamScope` out of this tool
    // when their enforcement went. Restoring it means building the
    // enforcement FIRST — test/declarable-enforced.test.mjs fails if it
    // comes back without one.
    // A team is a Neon Auth ORGANIZATION now, so the owner sets teams up
    // through Better Auth rather than through any route of ours. Offered
    // here again because a flag the designer cannot declare is a feature
    // that does nothing — which this one was, at five separate layers.
    teamScope: {
      type: "boolean",
      description:
        "Share this table across a TEAM: everyone in the same team reads and edits the same rows, and a write records who made it. " +
        "USE THIS FOR AN INTERNAL TOOL where colleagues work the same records — a CRM's deals, a shared job list, a client roster. " +
        "Only meaningful with access 'user'. Do NOT use it for a customer-facing members area, where one customer must never see another's rows. " +
        "A member who is not in a team sees only their own rows, so a site is safe before any team exists.",
    },
    publicView: {
      type: "object",
      description:
        "A named, PII-filtered projection of this table that ANYONE may read, even though the table itself is not readable. " +
        // THE CASE THAT DECIDES WHETHER THE SITE CAN EXIST, and it was
        // missing. This description named only the booking slot — an
        // optional enhancement — so a marketplace brief ("people post
        // their own events to sell") produced `events` as a `user` table
        // with no publicView, which is 401 signed out and own-rows-only
        // signed in. Measured live 2026-08-10: nobody could browse a
        // single listing, page generation had no home page it could
        // honestly write, and the build came back with no pages at all.
        "REQUIRED WHEN VISITORS POST ROWS THAT OTHER VISITORS MUST BROWSE — a marketplace, classifieds, a directory, a listings site. " +
        "Without it there is NO browsable page: a \"user\" table is 401 to a signed-out visitor and own-rows-only to a signed-in one, so nobody can ever see a listing. " +
        "Publish what a buyer needs (title, price, date, location, category) and leave out the rest. " +
        "ALSO USE IT WITH A BOOKING TABLE so the page can grey out slots that are already taken: publicView {\"columns\":[\"appointment_date\",\"appointment_time\"]} publishes WHEN people have booked and nothing about WHO. " +
        "Name only the columns a stranger may see — never a name, email, phone or note. `id` and `owner_id` are refused outright. " +
        "Add \"where\":[\"status:eq:confirmed\"] when the table has a status, so a cancelled row stops occupying the slot.",
      properties: {
        columns: { type: "array", items: { type: "string" }, description: "The only columns published. No wildcard." },
        where: { type: "array", items: { type: "string" }, description: "Filters as \"column:eq:value\" or \"column:ne:value\"." },
        limit: { type: "integer", description: "Most rows returned at once (default 500, max 2000)." },
      },
    },
    noOverlap: {
      type: "object",
      description:
        "Prevents overlapping INTERVALS, for bookings whose length varies (a 60-minute colour at 10:00 must block a 30-minute trim at 10:30 — `unique` would let both in, because they are different times). " +
        "REQUIRES start and end to be INTEGER columns, e.g. minutes from midnight: declare start_min/end_min as integers alongside whatever text time you display. " +
        "If either is not an integer column the constraint is SILENTLY SKIPPED, so use plain `unique` unless you have actually declared the integers.",
      properties: {
        start: { type: "string", description: "Integer column where the interval starts." },
        end: { type: "string", description: "Integer column where it ends." },
        on: { type: "array", items: { type: "string" }, description: "Columns that scope it — e.g. [\"appointment_date\"] or [\"room\"]." },
      },
    },
    confirm: {
      type: "object",
      description:
        "EMAIL THE PERSON WHO SUBMITTED, as soon as they submit — a booking confirmation, an order receipt, an enquiry acknowledgement. " +
        "Declare it on a `collect` table whose form asks for an email address, which is nearly every booking or enquiry form. " +
        "`to` must be one of THIS table's own columns, the one holding the visitor's address. " +
        "`subject` and `body` may use {column} to insert any value from the row they just submitted — e.g. \"Booked, {customer_name}\". " +
        "`body` is HTML; keep it short and plain, and never ask them to reply with card details or a password. " +
        "The site owner pastes their own email provider key (Resend, SendGrid or Postmark) in Settings — until they do, nothing is sent and the form still works normally. " +
        "Do NOT declare this to notify the OWNER: they are told about every submission already.",
      properties: {
        fn: { type: "string", description:
          "OPTIONAL, and the more capable form. Instead of to/subject/body, name a function you ALSO declare in `functions` with `internal: true`, " +
          "taking one bigint argument (the new row's id) and returning `json` shaped {to, subject, body}. " +
          "Use it whenever the message depends on anything beyond the row itself — join the stylist's name, count the customer's previous bookings to greet a regular, " +
          "say something different for a Saturday. `internal: true` matters: without it the function is callable by any visitor, who could then read anyone's confirmation by guessing an id." },
        to: { type: "string", description: "The column on this table holding the visitor's email address — e.g. \"customer_email\". Omit when using `fn`." },
        subject: { type: "string", description: "Subject line. {column} is replaced from the submitted row." },
        body: { type: "string", description: "Short HTML body. {column} is replaced from the submitted row." },
      },
      // Nothing is required: `fn` and the to/subject/body trio are
      // alternatives, and a schema tool cannot express "one or the
      // other". Which arrived is decided by normalizeConfirm, and a
      // half-declaration of either is refused there rather than
      // half-applied.
    },
    sms: {
      type: "object",
      description:
        "TEXT THE PERSON WHO SUBMITTED. The same idea as `confirm` and a separate declaration, so a table may have either or both — " +
        "an emailed receipt AND a texted reminder. Declare it on a `collect` table whose form asks for a PHONE NUMBER. " +
        "Worth it where a text is read and an email is not: a booking confirmation for a barber, a garage or a restaurant, " +
        "an appointment reminder, an order-is-ready message. " +
        "`to` must be one of THIS table's own columns. `body` is PLAIN TEXT — no HTML, no links unless they matter — and " +
        "{column} inserts a value from the submitted row. Keep it under 160 characters: a text is billed per 160-character segment. " +
        "The site owner pastes their own Twilio, MessageBird or Vonage credentials in Settings, plus the number or sender name to send from; " +
        "until they do, nothing is sent and the form still works normally. " +
        "The visitor's number must be given in full international form (+44…, +1…) — ask for it that way on the form, because a local number cannot be sent to. " +
        "Do NOT declare this for a plain contact form, and do not declare it for marketing: every message costs the owner money and unsolicited texts are regulated.",
      properties: {
        fn: { type: "string", description:
          "OPTIONAL, and the more capable form. Instead of to/body, name a function you ALSO declare in `functions` with `internal: true`, " +
          "taking one bigint argument (the new row's id) and returning `json` shaped {to, body}. Use it when the message depends on anything " +
          "beyond the row — the stylist's name, the slot time formatted properly, a different message for a first-time customer. " +
          "`internal: true` matters: without it any visitor could call it and read anyone's phone number by guessing an id." },
        to: { type: "string", description: "The column on this table holding the visitor's phone number — e.g. \"mobile\". Omit when using `fn`." },
        body: { type: "string", description: "Short plain-text message. {column} is replaced from the submitted row." },
      },
    },
    // OUTBOUND WEBHOOKS, DECLARABLE AT LAST. Every layer below this one
    // has been complete since the feature shipped — `coerceTable` parses
    // it, `firesFor` reads it, `emitWebhook` fires on the write path with
    // HMAC signing, SSRF checks and a rate cap — and no tool anywhere
    // offered the field, so no model on any path could ever ask for it.
    // The declared-and-dead shape this file records over and over,
    // sitting on a finished feature.
    //
    // AN ARRAY, NOT `true`-OR-ARRAY. `coerceTable` accepts a boolean and
    // still does, so anything sending one keeps working — but this tool
    // has ZERO uses of `anyOf`/`oneOf`, and a union here would be an
    // untested JSON Schema construct in the one tool whose rejection
    // 400s every build on the platform. Listing all three events is what
    // `true` means, so nothing is lost but a spelling.
    webhooks: {
      type: "array",
      items: { type: "string", enum: ["created", "updated", "deleted"] },
      description:
        "OPTIONAL, and OFF unless the brief asks for it. Tell another system when a row here changes — a booking into a CRM, an order into a warehouse, an enquiry into Slack. " +
        "List the events that should fire: [\"created\"] for new rows only, or all three for everything. Most sites declare this on nothing at all. " +
        "Declare it ONLY when the brief names another system that should hear about this data; a site that just emails the owner does NOT need it — that already happens. " +
        "The site owner pastes the destination into Secrets as WEBHOOK_URL (or WEBHOOK_URL_<TABLE> to send one table somewhere of its own), and until they do nothing is sent and the form works normally. " +
        "The platform signs each delivery and never sends owner_id or any claim token.",
    },
    payment: {
      type: "object",
      description:
        "The visitor PAYS BY CARD when they submit this table. Declare it ONLY when the brief says money changes hands online — an online shop, paid tickets, a deposit. " +
        "A shop that takes orders and invoices later, or a barber shop that is paid in the chair, does NOT declare this. " +
        "The table stays `collect`; it gains payment_status / payment_ref / amount_total / currency / paid_at, all set by the platform — never declare those columns yourself and never put them on a form. " +
        "`from` must name a `display` table on this same site whose rows carry the prices, because the total is computed from THOSE rows on the server: the browser only ever says which row and how many. " +
        "The site owner pastes their own Stripe key in Settings; until they do, the checkout answers politely that payments are not set up yet.",
      properties: {
        from: { type: "string", description: "The `display` table holding the priced items, e.g. \"products\" or \"tickets\"." },
        price: { type: "string", description: "The column on that table holding the price, as a plain decimal like \"12.50\". Default \"price\"." },
        name: { type: "string", description: "The column holding the item name shown on the Stripe page. Default \"name\"." },
        currency: { type: "string", description: "Three-letter ISO code, lowercase — \"gbp\", \"eur\", \"usd\". Pick the one the business actually trades in." },
      },
      required: ["from"],
    },
  },
  // `access` IS NOT REQUIRED, AND IT USED TO BE — the tool contradicted
  // itself. Its own description ends "when none of them is the shape you
  // need, set `read` and `write` instead and LEAVE THIS OUT", so a model
  // doing exactly what it is told produced an invalid tool call, and one
  // satisfying the schema had to name a preset it had just been told did
  // not fit. It resolves that by picking the nearest preset — which is
  // how a marketplace ends up with private listings, the failure the
  // read/write pair was added to prevent.
  //
  // THE COST, STATED: a table declaring neither `access` nor a pair is
  // now possible, and it RESOLVES to the collect shape — write only,
  // readable by nobody. (`coerceTable` used to stamp the word `collect`
  // on it; it leaves the silence alone since 2026-08-21 so a revise can
  // tell it from an answer, and `resolveAccess` supplies the same
  // fallback.) That is the fail-safe direction and the
  // reason this is safe to relax: the wrong answer is an invisible menu,
  // which the owner sees at once and a revise fixes, rather than a
  // `collect` table of customer phone numbers served to the public.
  required: ["name", "columns"],
};
