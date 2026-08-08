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

/** Long enough to be a real answer, short enough to sit on a button. */
export const MAX_OPTION_CHARS = 48;

export const ASK_TOOL = {
  name: "route_message",
  description: "Say whether this message is asking for a change to the site or asking a question, answer it if it is a question, and ask for the one thing you most need to know if this is a first build and the brief leaves it open.",
  input_schema: {
    type: "object",
    properties: {
      intent: {
        type: "string",
        enum: ["build", "ask", "clarify"],
        description:
          "\"build\" if the message is asking for the site to be created or changed in any way — new pages, different wording, " +
          "another colour, add a form, remove a section. \"ask\" if it is a question, a greeting, a thank-you, or anything else " +
          "that does not describe a change. When it is genuinely both — a question AND a change — answer \"build\", because the " +
          "build reply says what was done anyway and the customer would rather have the work than the explanation.\n\n" +
          "\"clarify\" when you are told below that this is a first build with questions remaining AND the message describes a " +
          "site to build. On a first build that is the NORMAL answer, not a last resort: ask the one thing you most need to " +
          "know, and \"build\" is for when the questions have run out or you are told they are closed. Never on a change to a " +
          "site that already exists.",
      },
      answer: {
        type: "string",
        description:
          "Only when intent is \"ask\". The reply to show them, two to four sentences, plain, no markdown. Write to them, not " +
          "about them. If it is a question about their own site, answer from the pages and tables described below. If you do not " +
          "know, say so plainly and say what would tell them — never invent a fact about their site.",
      },
      question: {
        type: "object",
        description:
          "Only when intent is \"clarify\". ONE question — the single most useful thing you do not know — with the answers as " +
          "options they can click. Ask about what changes the SITE: whether visitors book, order, or just get in touch; whether " +
          "customers need their own accounts; what the place should feel like. Do not ask for facts that can simply be typed in " +
          "later, like an address or opening hours, and never ask something the brief already told you.",
        properties: {
          text: {
            type: "string",
            description:
              "The question, one plain sentence, addressed to them. No preamble and no apology — the interface already says " +
              "this comes before the build.",
          },
          options: {
            type: "array",
            minItems: MIN_OPTIONS,
            maxItems: MAX_OPTIONS,
            items: { type: "string" },
            description:
              "Two to four answers, each a few words that read as a complete answer on a button — \"Book a time slot\", " +
              "\"Send an enquiry\", \"Just phone and address\". They are shown as written and become part of the brief, so " +
              "write them as the customer's own answer rather than as a label. Cover the likely answers; they can always " +
              "skip past all of them.",
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
  "ON A FIRST BUILD YOU ASK THEM SOMETHING BEFORE IT STARTS. Not \"if you need to\" — a first build begins with a " +
  "question, every time, while you still have questions left. A build takes about a minute and doing it again costs " +
  "them again, so the cheapest moment to learn something is before it runs. Ask about what people DO on the site and " +
  "how it should feel, never about details the owner can fill in afterwards, and never about something the brief has " +
  "already told you.\n\n" +
  "The exception is a message that is not a description of a site at all — \"hi\", \"hey\", \"wassup\", \"yo\", \"thanks\", " +
  "\"what can you do?\". There is nothing to build there and so nothing to clarify: answer it.";

/**
 * The one definition of the routing call.
 *
 * Extracted the way `pagesRequest` was, and for the same reason: the moment two
 * places construct this request, a test tunes something production does not run.
 */
export function askRequest({ message, site, canClarify = false, brief = "", qa = [] } = {}) {
  const text = String(message || "").trim().slice(0, MAX_MESSAGE);
  const asked = (Array.isArray(qa) ? qa : []).filter((p) => p && p.q && p.a).slice(0, MAX_CLARIFY);
  const left = MAX_CLARIFY - asked.length;
  // WHAT THE ROUND SO FAR WAS, so the next question is not the last one again.
  // Only present on a first build; a revise sends none of this and is told
  // plainly that questions are closed, rather than being left to infer it from
  // an absent section.
  const round = canClarify
    ? "\n\nBEFORE THE BUILD\nThis is their FIRST build — nothing exists yet — so if their message describes a site, ask " +
      "ONE question about it rather than building. You have " + left + " question" + (left === 1 ? "" : "s") +
      " left, and the build starts on its own once they are used up.\n" +
      (asked.length
        ? "WHAT YOU HAVE ALREADY ASKED — do not ask any of these again, or anything close to them:\n" +
          asked.map((p) => "- " + String(p.q).trim() + " -> " + String(p.a).trim()).join("\n") + "\n"
        : "") +
      "THE BRIEF THEY STARTED WITH\n" + String(brief || "").trim().slice(0, MAX_MESSAGE)
    : "\n\nBEFORE THE BUILD\nQuestions are closed for this message — answer \"build\" or \"ask\" only, never \"clarify\".";
  return {
    model: ASK_MODEL,
    max_tokens: ASK_MAX_TOKENS,
    tools: [ASK_TOOL],
    // FORCED, like both of the other calls. Without it Haiku will happily answer
    // in prose, and the caller has no field to branch on — the whole point here
    // is a decision the code can read, not a reply a human has to interpret.
    tool_choice: { type: "tool", name: "route_message" },
    system: [{ type: "text", text: SYSTEM }],
    messages: [{ role: "user", content: "THEIR SITE\n" + siteDigest(site) + round + "\n\nTHEIR MESSAGE\n" + text }],
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
export function readRouting(reply, { canClarify = false } = {}) {
  const blocks = reply && Array.isArray(reply.content) ? reply.content : [];
  const use = blocks.find((b) => b && b.type === "tool_use");
  const input = (use && use.input) || {};
  const answer = String(input.answer || "").trim();

  // CLARIFY IS GATED BY THE CALLER, NOT BY THE MODEL. `canClarify` is false on
  // every revise and the moment the question budget is spent, and a model that
  // answers "clarify" anyway is simply overruled into a build. The alternative —
  // trusting the enum to be honoured — is how a revise ends up being interviewed
  // about its own colour scheme.
  if (input.intent === "clarify" && canClarify) {
    const q = readQuestion(input.question);
    // A CLARIFY WITH NO USABLE QUESTION IS A BUILD, for exactly the reason an
    // answerless "ask" is: honouring it shows the customer an empty prompt and
    // builds nothing, which is indistinguishable from the builder being broken.
    if (q) return { intent: "clarify", answer: "", question: q };
    return { intent: "build", answer: "" };
  }

  const intent = input.intent === "ask" ? "ask" : "build";
  // AN "ask" WITH NOTHING TO SAY IS A BUILD. The model chose the cheap branch and
  // then wrote no reply, so honouring it would show the customer an empty message
  // and do nothing — the one outcome worse than an unnecessary build.
  if (intent === "ask" && !answer) return { intent: "build", answer: "" };
  return { intent, answer: intent === "ask" ? answer : "" };
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
export function readQuestion(raw) {
  const q = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : null;
  if (!q) return null;
  const text = String(q.text || "").trim().slice(0, 240);
  if (!text) return null;
  const seen = new Set();
  const options = [];
  for (const o of Array.isArray(q.options) ? q.options : []) {
    // A STRING, not anything stringifiable: `String(["a","b"])` is "a,b", which
    // renders as one button offering two answers.
    if (typeof o !== "string") continue;
    const label = o.trim().replace(/\s+/g, " ").slice(0, MAX_OPTION_CHARS);
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
export async function routeMessage(deps, { message, site, firstBuild = false, brief = "", qa = [] } = {}) {
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
  let reply;
  try {
    reply = await deps.send(askRequest({ message: text, site, canClarify, brief, qa: asked }));
  } catch {
    return { intent: "build", answer: "", usage: null, failed: true };
  }
  const routed = readRouting(reply, { canClarify });
  return { ...routed, usage: askUsage(reply) };
}
