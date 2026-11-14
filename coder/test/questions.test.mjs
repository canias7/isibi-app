// UP TO 4 QUESTIONS IN ONE CARD (owner pick 4, 2026-11-08: "finish , 1 , 4"), like Claude Code's
// AskUserQuestion (its tools reference; its own rules: 1 to 4 questions, each with a short header shown as
// a chip (at most 12 characters), 2 to 4 options with a label and a description, multi-select, the
// recommended option first with "(Recommended)", and "Other" always there).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const HERE = (p) => new URL("../" + p, import.meta.url);
const call = (name, args, id = "c1") => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });

/** One job with a scripted Grok: its events, and what Grok was sent. */
async function job(steps) {
  const { runCoder } = await import("../container/coder-agent.mjs");
  const seen = [], events = [];
  const out = await runCoder({ send: async (req) => { seen.push(req); return steps[Math.min(seen.length - 1, steps.length - 1)]; }, emit: (e) => events.push(e), exec: async () => ({ code: 0, output: "" }) }, { text: "Build the sign-up page" });
  return { out, seen, events };
}
const Q3 = [
  { question: "Which database should the sign-up page save to?", header: "Database", options: [{ label: "Postgres (Recommended)", description: "Already in the project." }, { label: "SQLite", description: "A single file." }] },
  { question: "Which ways to sign in should it offer?", header: "Sign-in", multiSelect: true, options: [{ label: "Email and password", description: "A form." }, { label: "Google", description: "One button." }, { label: "GitHub", description: "One button." }] },
  { question: "Where should it run?", header: "Hosting", options: [{ label: "Vercel", description: "Matches the other pages." }, { label: "Netlify", description: "A new account." }] },
];

test("CD197 ask_user takes 1 to 4 questions in one card, Claude Code's AskUserQuestion (2026-11-14: its description and inputs; before, owner pick 4): each with its header chip, 2 to 4 options with explanations, multiSelect; with no way to ask while Coder works (a job from GitHub) the turn ends there; the first question stays where older readers look; more than 4, or a question without 2 options, is refused in Claude Code's words", async () => {
  const { CODER_TOOLS, CODER_SYSTEM } = await import("../container/coder-agent.mjs");
  const { ASK_USER_DESCRIPTION } = await import("../container/coder-askuser.mjs");
  const tool = CODER_TOOLS.find((t) => t.function.name === "ask_user").function;
  assert.equal(tool.description, ASK_USER_DESCRIPTION);
  assert.match(tool.description, /^Use this tool only when you are blocked on a decision that is genuinely the owner's to make/);
  assert.deepEqual(tool.parameters.required, ["questions"]);
  assert.deepEqual(Object.keys(tool.parameters.properties.questions.items.properties), ["question", "header", "options", "multiSelect"]);
  assert.match(CODER_SYSTEM, /use ask_user: 1 to 4 questions in one card, each with 2 to 4 options/);

  // THREE QUESTIONS: one card; Grok is told the answers come next; nothing after it runs (no way to ask while it works).
  const { out, seen, events } = await job([say("Before I start, three choices only you can make.", [call("ask_user", { questions: Q3 }, "q1"), call("bash", { command: "echo never" }, "b1")])]);
  assert.equal(out.status, "done");
  assert.equal(seen.length, 1);
  const q = events.find((e) => e.type === "question");
  const want = [
    { text: Q3[0].question, header: "Database", options: Q3[0].options },
    { text: Q3[1].question, header: "Sign-in", options: Q3[1].options, multi: true },
    { text: Q3[2].question, header: "Hosting", options: Q3[2].options },
  ];
  assert.deepEqual({ ...q, at: 0 }, { at: 0, type: "question", ...want[0], questions: want });
  assert.deepEqual(out.messages.filter((m) => m.role === "tool").map((m) => m.content), ["asked the owner; their answers come as the next message", "not run: you asked the owner a question first"]);

  // ONE QUESTION, as before (no list); a header too long for a chip is cut on the card (Claude Code says 12 and checks none).
  const one = await job([say("", [call("ask_user", { questions: [{ question: "Which name?", header: "A very long header here", options: [{ label: "one.txt", description: "" }, { label: "two.txt", description: "" }] }] })])]);
  assert.deepEqual({ ...one.events.find((e) => e.type === "question"), at: 0 }, { at: 0, type: "question", text: "Which name?", header: "A very long header h", options: [{ label: "one.txt", description: "" }, { label: "two.txt", description: "" }] });

  // REFUSED, in Claude Code's words, before any card: five questions; a question with one option (its steer first); none;
  // the single question of before (not Claude Code's input).
  const bad = [
    [{ questions: [...Q3, Q3[0], Q3[1]] }, "five", /^error: InputValidationError: \[\n  \{\n    "origin": "array",\n    "code": "too_big",\n    "maximum": 4,/],
    [{ questions: [Q3[0], { question: "Only one?", header: "One", options: [{ label: "yes", description: "y" }] }] }, "one option", /^error: InputValidationError: This call included a question with fewer than 2 options, so it was rejected and the person never saw it\./],
    [{ questions: [] }, "none", /"code": "too_small",\n    "minimum": 1,/],
    [{ question: "Which name?", options: ["one.txt", "two.txt"], multi_select: true }, "the old single question", /^error: InputValidationError: AskUserQuestion failed due to the following issues:\nThe required parameter `questions` is missing\nAn unexpected parameter `question` was provided/],
  ];
  for (const [args, why, said] of bad) {
    const r = await job([say("", [call("ask_user", args)]), say("I'll decide myself.", [])]);
    assert.equal(r.events.filter((e) => e.type === "question").length, 0, why);
    assert.ok(r.seen[1].messages.some((m) => m.role === "tool" && said.test(m.content)), why);
  }
});

test("CD198 the card: each question with its header chip and its choices (the recommended first and already chosen), Other with a box, one Skip and one Submit; its answer is each question's choices on their own line after its header (none: \"(no answer)\"; Other: what you typed; no \"(Recommended)\"); one question sends just the choice, as before; older cards still show; the notification, the desktop app and GitHub say how many", async () => {
  const ui = readFileSync(HERE("public/coder.js"), "utf8");
  // THE PAGE'S OWN HELPERS, run as they are.
  const start = ui.indexOf("  const askQuestions = ");
  const end = ui.indexOf("  };", ui.indexOf("  const askReply = ")) + 4;
  const { askQuestions, askReply } = new Function(ui.slice(start, end) + "\nreturn { askQuestions, askReply };")();
  const card = { type: "question", text: "Which database?", header: "Database", options: [{ label: "Postgres (Recommended)", description: "x" }, { label: "SQLite" }], questions: [
    { text: "Which database?", header: "Database", options: [{ label: "Postgres (Recommended)", description: "x" }, { label: "SQLite" }] },
    { text: "Which ways to sign in?", header: "Sign-in", multi: true, options: [{ label: "Email" }, { label: "Google" }] },
    { text: "Where should it run?", options: ["Vercel", "Netlify"] },
  ] };
  const qs = askQuestions(card);
  assert.deepEqual(qs.map((q) => [q.header, q.multi, q.options.map((o) => o.label)]), [["Database", false, ["Postgres (Recommended)", "SQLite"]], ["Sign-in", true, ["Email", "Google"]], ["", false, ["Vercel", "Netlify"]]]);
  assert.deepEqual(askQuestions({ type: "question", text: "Which name?", options: ["one.txt", { label: "two.txt", description: "d" }], multi: true }), [{ text: "Which name?", header: "", multi: true, options: [{ label: "one.txt", description: "" }, { label: "two.txt", description: "d" }] }], "a card from before");
  const a = { qs, answers: [{ picked: ["Postgres (Recommended)"], other: "" }, { picked: ["Email", "__other"], other: " Apple " }, { picked: [], other: "" }] };
  assert.equal(askReply(a), "Database: Postgres\nSign-in: Email, Apple\nWhere should it run?: (no answer)", "the header, or the question when there is none");
  assert.equal(askReply({ qs, answers: [{ picked: [], other: "" }, { picked: [], other: "" }, { picked: ["__other"], other: "  " }] }), "", "nothing chosen: nothing sent");
  assert.equal(askReply({ qs: [qs[0]], answers: [{ picked: ["SQLite"], other: "" }] }), "SQLite", "one question: just the choice, as before");
  // THE CARD'S PARTS.
  assert.match(ui, /'<div class="cd-ask-one" data-q="' \+ k \+ '"><div class="cd-ask-q">' \+ \(q\.header \? '<span class="cd-ask-h">' \+ esc\(q\.header\) \+ '<\/span>' : ''\)/);
  assert.match(ui, /\(q\.multi \? '<span class="cd-ask-multi">Choose any<\/span>' : ''\)/);
  assert.match(ui, /const kind = q\.multi \? 'checkbox' : 'radio', name = 'cdq' \+ i \+ '-' \+ k;/, "each question its own group of choices");
  assert.match(ui, /send\(many \? 'I skipped your questions\. Decide for yourself and go on\.' : 'I skipped your question\. Decide for yourself and go on\.'\)/);
  assert.match(ui, /const askOf = \(el\) => \{ const one = el\.closest\('\.cd-ask-one'\); return S\.ask && one \? S\.ask\.answers\[Number\(one\.dataset\.q\)\] : null; \};/);
  const css = readFileSync(HERE("public/coder.css"), "utf8");
  for (const c of [".cd-ask-h{", ".cd-ask-multi{", ".cd-ask-one+.cd-ask-one .cd-ask-q{", ".cd-ask.is-many{"]) assert.ok(css.includes(c), c);
  // THE NOTIFICATION (phone or computer) and the desktop app: the first question, and how many more.
  const { pushesFor } = await import("../src/coder-push.mjs");
  const pushed = pushesFor([card], { title: "Sign-up page" });
  assert.deepEqual(pushed.map((p) => [p.title, p.body]), [["Coder needs your answer · Sign-up page", "Which database? (and 2 more)"]]);
  assert.deepEqual(pushesFor([{ type: "question", text: "Which name?", options: [] }], { title: "x" }).map((p) => p.body), ["Which name?"], "one question, as before");
  assert.match(ui, /e\.text \+ \(Array\.isArray\(e\.questions\) && e\.questions\.length > 1 \? ' \(and ' \+ \(e\.questions\.length - 1\) \+ ' more\)' : ''\)/);
  // GITHUB (@coder): numbered, each with its header and choices, answered in one comment.
  const { finalText } = await import("../src/coder-mentions.mjs");
  const text = finalText({ login: "ana", repo: "ana/shop" }, { branch: "coder/x", base: "main" }, [{ type: "user", text: "go" }, { type: "text", text: "Three choices first." }, card]);
  assert.match(text, /^@ana Coder has 3 questions:\n/);
  assert.match(text, /\*\*1\. Database: Which database\?\*\*\n- Postgres \(Recommended\) \(x\)\n- SQLite\n\n\*\*2\. Sign-in: Which ways to sign in\?\*\* \(choose one or more\)\n- Email\n- Google\n\n\*\*3\. Where should it run\?\*\*\n- Vercel\n- Netlify\n\nAnswer them in one comment, by number, e\.g\. `@coder 1\. Postgres \(Recommended\) 2\. \.\.\.`\./);
  const single = finalText({ login: "ana", repo: "ana/shop" }, { branch: "coder/x" }, [{ type: "user", text: "go" }, { type: "question", text: "Which name?", options: ["one.txt", "two.txt"] }]);
  assert.match(single, /^@ana Coder has a question:\n\n\*\*Which name\?\*\*\n- one\.txt\n- two\.txt\n\nAnswer with `@coder <your choice>`\./, "one question, as before");
});
