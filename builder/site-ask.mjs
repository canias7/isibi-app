// Telling a question from an instruction — and answering the question.
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
// Plain module with its side effects injected, like `site-context.mjs` and
// `publish-pages.mjs`, so all of it is tested with no network and no Worker.

/** Haiku. This is a routing decision and a short answer, not a design task. */
export const ASK_MODEL = "claude-haiku-4-5";

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

export const ASK_TOOL = {
  name: "route_message",
  description: "Say whether this message is asking for a change to the site or asking a question, and answer it if it is a question.",
  input_schema: {
    type: "object",
    properties: {
      intent: {
        type: "string",
        enum: ["build", "ask"],
        description:
          "\"build\" if the message is asking for the site to be created or changed in any way — new pages, different wording, " +
          "another colour, add a form, remove a section. \"ask\" if it is a question, a greeting, a thank-you, or anything else " +
          "that does not describe a change. When it is genuinely both — a question AND a change — answer \"build\", because the " +
          "build reply says what was done anyway and the customer would rather have the work than the explanation.",
      },
      answer: {
        type: "string",
        description:
          "Only when intent is \"ask\". The reply to show them, two to four sentences, plain, no markdown. Write to them, not " +
          "about them. If it is a question about their own site, answer from the pages and tables described below. If you do not " +
          "know, say so plainly and say what would tell them — never invent a fact about their site.",
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
  "Never claim the site has a page, a table, or a feature that is not named below.";

/**
 * The one definition of the routing call.
 *
 * Extracted the way `pagesRequest` was, and for the same reason: the moment two
 * places construct this request, a test tunes something production does not run.
 */
export function askRequest({ message, site } = {}) {
  const text = String(message || "").trim().slice(0, MAX_MESSAGE);
  return {
    model: ASK_MODEL,
    max_tokens: ASK_MAX_TOKENS,
    tools: [ASK_TOOL],
    // FORCED, like both of the other calls. Without it Haiku will happily answer
    // in prose, and the caller has no field to branch on — the whole point here
    // is a decision the code can read, not a reply a human has to interpret.
    tool_choice: { type: "tool", name: "route_message" },
    system: [{ type: "text", text: SYSTEM }],
    messages: [{ role: "user", content: "THEIR SITE\n" + siteDigest(site) + "\n\nTHEIR MESSAGE\n" + text }],
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
export function readRouting(reply) {
  const blocks = reply && Array.isArray(reply.content) ? reply.content : [];
  const use = blocks.find((b) => b && b.type === "tool_use");
  const input = (use && use.input) || {};
  const intent = input.intent === "ask" ? "ask" : "build";
  const answer = String(input.answer || "").trim();
  // AN "ask" WITH NOTHING TO SAY IS A BUILD. The model chose the cheap branch and
  // then wrote no reply, so honouring it would show the customer an empty message
  // and do nothing — the one outcome worse than an unnecessary build.
  if (intent === "ask" && !answer) return { intent: "build", answer: "" };
  return { intent, answer: intent === "ask" ? answer : "" };
}

/**
 * The four token kinds, in the shape `pageCredits` prices.
 *
 * Same shape as the schema and pages calls so there is one price table for all
 * three — this call is cheap, but "cheap" is not a billing rule, and a model
 * whose price changes should not need a second place edited.
 */
export function askUsage(reply) {
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
    model: ASK_MODEL,
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
export async function routeMessage(deps, { message, site } = {}) {
  const text = String(message || "").trim();
  // AN EMPTY MESSAGE NEVER REACHES THE MODEL. The composer will not send one, but
  // this is a paid call behind a public route and "the client wouldn't do that"
  // is not a gate.
  if (!text) return { intent: "build", answer: "", usage: null };
  let reply;
  try {
    reply = await deps.send(askRequest({ message: text, site }));
  } catch {
    return { intent: "build", answer: "", usage: null, failed: true };
  }
  const routed = readRouting(reply);
  return { ...routed, usage: askUsage(reply) };
}
