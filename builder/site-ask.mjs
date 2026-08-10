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
/** Two short sentences. A hard bound, since a cap the model is told about is not one. */
export const MAX_QUESTION_CHARS = 240;

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
  "something to build: \"clarify\". A first build begins with a question, every time, while questions remain — a build " +
  "takes about a minute and doing it again costs them again, so the cheapest moment to learn something is before it " +
  "runs. Ask about what people DO on the site and how it should feel, never about details the owner can fill in " +
  "afterwards, and never about something they have already told you.\n" +
  "3. Otherwise: \"build\".";

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
export function readRouting(reply, { canClarify = false, answering = false, attached = false } = {}) {
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
  if (intent === "ask" && (answering || attached)) return { intent: "build", answer: "" };
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
export async function routeMessage(deps, { message, site, firstBuild = false, brief = "", qa = [], answering = false, attached = false } = {}) {
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
  const routed = readRouting(reply, { canClarify, answering: !!answering, attached: !!attached });
  return { ...routed, usage: askUsage(reply) };
}
