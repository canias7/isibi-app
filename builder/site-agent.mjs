// THE SITE AGENT (2026-10-28, the owner: "one big full agent", the Lovable /
// Claude Code style — one model with tools instead of the router and its rungs).
//
// One model works in rounds. Each round it is sent the whole conversation so
// far and answers with tool calls: read files, write a file, read a table,
// build, finish. This module is the loop and the tools; the caller hands in
// what touches the world (`send`, `build`, `readTable`) so every decision here
// is driven with literal values in the tests.
//
// THE THREE COST RULES THE OWNER CHOSE (2026-10-28):
//
//  1. A HEAD START. The first message carries the site map and the files the
//     change most likely needs (`headStart`), so the agent does not spend its
//     first rounds opening pages one by one.
//
//  3. THE DESK IS CLEARED. Every round re-sends the pile, so a file the agent
//     has finished with is swapped for a one-line note once the pile is big
//     (`compact`). Nothing is lost: its writes live in the WORKSPACE (the
//     files this job will save), and `read_files` hands back the current
//     version whenever it needs one again.
//
//  4. THE SAME OPENING EVERY ROUND. The rules and the tools are byte-for-byte
//     the same on every round and every site (`AGENT_SYSTEM`, `AGENT_TOOLS`),
//     and the per-site first message never changes during a job, so both are
//     read from the provider's cache at a quarter of the price. Nothing that
//     changes (a counter, the time, a remaining budget) is ever written there.
//     Clearing the desk rewrites older rounds, which costs one cache rebuild,
//     so it happens only when the pile passes `COMPACT_AT`, all at once.
//
// THE LIMITS ARE HARD: rounds, credits and time. Reaching one stops the loop
// with what the workspace holds; the caller saves only a workspace whose last
// build passed.
import { pageRulesFor, SITE_PAGES_TOOL } from "./page-gen.mjs";
import { siteSlice } from "./site-map.mjs";
import { checkServerPart, SERVER_PREFIX } from "./server-code.mjs";
import { pageCost } from "./publish-pages.mjs";
import { requiredFiles, partKey, overThreshold } from "./file-picker.mjs";
import { keyAsk } from "./key-card.mjs";
import { SERVER_TOOLS, readDocs, errorLines, errorsLimit, keyNames, schemaChange, callRequest, callAnswer } from "./agent-server-tools.mjs";
import { attachments as sortAttachments } from "./site-context.mjs";
import { readImportSite, importBriefBlock, IMPORT_LOGO_ID } from "./site-import.mjs";
import { noteProgress } from "./job-progress.mjs";
import { readSettingsInput, readLogoInput, readLanguagesInput, readRulesInput, readRenameInput, readAskInput, readQrInput } from "./agent-steps.mjs";
import { applySort, sortColumns, sortRefusal, SORT_DIRS } from "./site-order.mjs";

/**
 * NO ROUND LIMIT (the owner, 2026-10-30: "no limit" on how long a task runs).
 * A caller or a test may still pass `maxRounds`; a run that stops making
 * progress is ended by the job's no-progress watchdog (`NO_PROGRESS_MS` in
 * `job-clock.mjs`), never by a count.
 */
export const AGENT_MAX_ROUNDS = Infinity;
export const AGENT_MAX_TOKENS = 32000;
/** No spending limit (the owner, 2026-10-28: "no cap at all"); a caller may still pass one. */
export const AGENT_CREDIT_CAP = Infinity;
/** NO TIME LIMIT (the owner, 2026-10-30); a caller or a test may still pass `maxMs`. */
export const AGENT_MAX_MS = Infinity;
/** The pile, in characters, above which finished files become notes. */
export const COMPACT_AT = 60000;
/** The fewest characters a clearing must save to be worth rewriting older rounds. */
export const COMPACT_MIN_SAVE = 15000;
/** How many of the latest rounds are never compacted. */
export const KEEP_RECENT = 2;
const CREDIT_USD = 0.008;
const MAX_READ = 8;
const MAX_FILE_CHARS = 120000;
const MAX_SHOTS = 2;
/** Pages handed to helpers in one call, and the rounds each helper may take
 *  (no limit since 2026-10-30: helpers run in parallel on copies and write
 *  only their own page, so a count adds no safety the watchdog lacks). */
export const MAX_HELPERS = 6;
export const HELPER_ROUNDS = Infinity;
const PAGE_KEY = /^[a-z0-9][a-z0-9._$-]*(?:\/[a-z0-9._$-]+)*\.tsx$/i;
const PART_KEY = /^-parts\/[a-z0-9][a-z0-9-]{0,62}$/i;
const TABLE = /^[A-Za-z_][A-Za-z0-9_]{0,62}$/;
/** A table's key column, from its spec (`pk: true`), else the schema engine's own `id`. */
export function tableKey(t) {
  const c = t && Array.isArray(t.columns) ? t.columns.find((x) => x && typeof x === "object" && x.pk === true && typeof x.name === "string") : null;
  return c ? c.name : "id";
}
/** What the agent is told when the site's tables could not be read (never "no tables"). */
export const UNREADABLE_TABLES = "the site's tables could not be read just now, so nothing about them is known: do not assume there are none, and do not add, change or remove entries or tables this time. Say so in your finish summary";
/** How often (in rounds) the caller is asked whether the credits spent so far are covered. */
export const CREDIT_CHECK_EVERY = 5;
/** A site address as the alias store takes it. */
const ADDRESS = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
/** Rows `read_table` reads at most in one call (a pasted list of ~200 is updated from one read). */
export const MAX_TABLE_READ = 500;
/** Characters one attachment or import answer carries at most; the rest is read with `from`. */
export const MAX_TOOL_TEXT = 40000;

// ── THE TOOLS (frozen: rule 4) ───────────────────────────────────────────────
export const AGENT_TOOLS = Object.freeze([
  {
    name: "read_files",
    description: "Read files of this site, as they are in your workspace now (your own writes included). Keys exactly as listed: a page is its file name (\"about.tsx\"), a component or server function \"-parts/<name>\".",
    input_schema: { type: "object", properties: { files: { type: "array", items: { type: "string" }, maxItems: MAX_READ } }, required: ["files"] },
  },
  {
    name: "write_file",
    description: "Write one whole file: a page (\"about.tsx\", a new one adds a page), a component (\"-parts/<name>\"), server code (\"-parts/server-<name>\") or the site's stylesheet (\"styles.css\", the whole sheet). Always the COMPLETE source, never a fragment. It is saved in your workspace at once.",
    input_schema: { type: "object", properties: { file: { type: "string" }, source: { type: "string" } }, required: ["file", "source"] },
  },
  {
    name: "delete_file",
    description: "Remove a page (its address then sends visitors to the home page) or a component. Never the home page (\"index.tsx\") or the stylesheet. Take out every link to a removed page and every import of a removed component.",
    input_schema: { type: "object", properties: { file: { type: "string" } }, required: ["file"] },
  },
  {
    name: "change_rows",
    description: "Change the entries stored in one of the site's tables (a menu, a price list, classes…): add rows, update rows by their key, remove rows by their key (`id` here is the value of the table's key column, named in the table list). Read the table first to get the keys. Saved to the database when you finish, before the pages are saved, and taken back if the save fails.",
    input_schema: {
      type: "object",
      properties: {
        table: { type: "string" },
        add: { type: "array", items: { type: "object" } },
        update: { type: "array", items: { type: "object", properties: { id: {}, set: { type: "object" } }, required: ["id", "set"] } },
        remove: { type: "array", items: {} },
      },
      required: ["table"],
    },
  },
  {
    name: "read_table",
    description: "Read rows of one of the site's database tables, to see what it holds: 20 unless you ask for more (`limit`, up to " + MAX_TABLE_READ + ", e.g. before updating a long list). Reading only.",
    input_schema: { type: "object", properties: { table: { type: "string" }, limit: { type: "integer", minimum: 1, maximum: MAX_TABLE_READ } }, required: ["table"] },
  },
  {
    name: "build",
    description: "Compile the whole site as your workspace holds it, and test-run its server code. Answers ok, or the errors to fix.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "run",
    description: "Run one shell command in a copy of this site's project (Linux, Node 22), and read what it printed. The site's pages are in src/routes/, its components and server code in src/routes/-parts/, its stylesheet is src/styles.css; the template's packages are installed (read only: installing more is not possible here). E.g. grep -rn \"Opening\" src/routes, cat src/routes/index.tsx, npx tsc --noEmit, sed -i 's/old/new/' src/routes/about.tsx, node -e \"…\". Files a command changes come back into your workspace. No keys or secrets; 90 seconds a command; output cut at 30,000 characters.",
    input_schema: { type: "object", properties: { command: { type: "string" } }, required: ["command"] },
  },
  {
    name: "look",
    description: "Build the site as your workspace holds it and look at one page: screenshots at phone and desktop width. Use it to check how a change really looks before you finish.",
    input_schema: { type: "object", properties: { page: { type: "string", description: "The page's address, e.g. \"/\" or \"/about\"." } }, required: ["page"] },
  },
  {
    name: "helpers",
    description: "Hand pages to helper agents that write them AT THE SAME TIME as each other, then come back to you with what they wrote. For a new site, once the shared files every page uses are written (the header, the footer, shared components): give each helper ONE page file that it alone writes, and a brief of what that page holds and which shared components it uses. A helper reads any file but writes only its own page; it cannot build. You then build, look and fix. Up to " + MAX_HELPERS + " pages in one call.",
    input_schema: {
      type: "object",
      properties: { tasks: { type: "array", maxItems: MAX_HELPERS, items: { type: "object", properties: { file: { type: "string" }, brief: { type: "string" } }, required: ["file", "brief"] } } },
      required: ["tasks"],
    },
  },
  // THE SERVER TOOLS (2026-10-30, the owner): each offered only when wired.
  ...SERVER_TOOLS,
  {
    name: "read_attachment",
    description: "Read one file the owner attached to this message, by its id from the list in the first message. An image is shown to you; a PDF, a spreadsheet saved as CSV, or a text file comes back as text (long ones in pieces: pass `from` to read on). `place: true` on an image also stores it in the site's own files and answers its address, to use as an <img src> on a page.",
    input_schema: { type: "object", properties: { id: { type: "string" }, from: { type: "integer", minimum: 0 }, place: { type: "boolean" } }, required: ["id"] },
  },
  {
    name: "import_site",
    description: "Read the owner's existing website (an address they gave in their message): its pages' headings and text, contact details, opening hours, colours, fonts, links, logo and photographs. The pictures come back as addresses in this site's own files, ready for <img src>. Reading only; nothing on this site changes.",
    input_schema: { type: "object", properties: { url: { type: "string" } }, required: ["url"] },
  },
  // THE OLD STEPS' TOOLS (2026-10-30, `builder/agent-steps.mjs`): each offered
  // only where the Worker wires what saves it (`TOOL_NEEDS`), each queued and
  // saved when you finish, never before.
  {
    name: "set_site_settings",
    description: "Change the site's settings, saved when you finish: `name` (the business's name: the browser tab's title and the link preview's; `title` means the same), `description` (what search engines and link previews show, up to 300 characters, \"\" for none), `shareImage` (the link-preview picture) and `favicon` (the browser-tab icon), each one of the owner's uploads by its name or /u/ address, \"\" to go back to the default. Send only what changes.",
    input_schema: { type: "object", properties: { name: { type: "string" }, title: { type: "string" }, description: { type: "string" }, shareImage: { type: "string" }, favicon: { type: "string" } } },
  },
  {
    name: "set_logo",
    description: "Put the owner's uploaded logo in place, saved when you finish: `upload` is one of their uploads (its name or /u/ address); `target` \"logo\" (the header, every page, the default) or \"icon\" (the browser tab); `remove: true` takes it off. No page changes for it on a site whose header is the platform's; a header you wrote yourself shows `SITE_LOGO` where it puts it.",
    input_schema: { type: "object", properties: { upload: { type: "string" }, target: { type: "string", enum: ["logo", "icon"] }, remove: { type: "boolean" } } },
  },
  {
    name: "set_languages",
    description: "The site's languages, saved when you finish. `lang`: the language its pages are ALREADY written in, as a tag (\"es\", \"pt-BR\"); a declaration, never a translation. `langs`: the WHOLE list of extra languages the site is also offered in (the publish translates it), [] for none: send every one that stays.",
    input_schema: { type: "object", properties: { lang: { type: "string" }, langs: { type: "array", items: { type: "string" }, maxItems: 12 } } },
  },
  {
    name: "set_table_rules",
    description: "Change what one of the site's tables allows, saved to its database when you finish: `read` (who sees entries: public, members, own, none), `write` (who adds: anyone, members, own, none), `unique` (columns that together may not repeat), `oncePerUser` (columns one person may use once), `noOverlap` ({start, end, on?}: whole-number time columns), `maxRows` (a limit), `retired` (true closes it, keeping its entries). Letting more people see entries needs the owner's own words, quoted in `readWords`.",
    input_schema: { type: "object", properties: { table: { type: "string" }, read: { type: "string" }, readWords: { type: "string" }, write: { type: "string" }, unique: { type: "array", items: { type: "string" } }, oncePerUser: { type: "array", items: { type: "string" } }, noOverlap: { type: "object" }, maxRows: { type: "integer" }, retired: { type: "boolean" } }, required: ["table"] },
  },
  {
    name: "rename_page",
    description: "Move a page to a new address (\"/menu\" to \"/food\"): its file moves, every link to it in the pages and components is rewritten, and the old address sends visitors to the new one. Build afterwards.",
    input_schema: { type: "object", properties: { from: { type: "string" }, to: { type: "string" } }, required: ["from", "to"] },
  },
  {
    name: "make_qr",
    description: "A QR code for one of the site's pages (`page`: \"/menu\") or a web address (`url`): answers a picture address to put in an <img src> on a page.",
    input_schema: { type: "object", properties: { page: { type: "string" }, url: { type: "string" } } },
  },
  // THE ROUTER-ERA STEPS THE AGENT HAD LOST (2026-10-30, fix-all): a list's
  // order on every page that reads it (the order step's `applySort`), the
  // owner's own video and audio by their hosted address, and the site's address.
  {
    name: "sort_table",
    description: "Change the order one of the site's tables is listed in, on EVERY page and component that reads it (`by`: one of its columns; `direction`: \"asc\" or \"desc\"). Checked against the table's columns and applied in your workspace at once; build afterwards.",
    input_schema: { type: "object", properties: { table: { type: "string" }, by: { type: "string" }, direction: { type: "string", enum: ["asc", "desc"] } }, required: ["table", "by"] },
  },
  {
    name: "attach_media",
    description: "The hosted address of one of the owner's uploaded videos or recordings (`upload`: its name or /u/ address), to place with <video src controls> or <audio src controls> on a page. Answers the address, its kind and type.",
    input_schema: { type: "object", properties: { upload: { type: "string" } }, required: ["upload"] },
  },
  {
    name: "rename_site",
    description: "Move the whole site to a new web address (`to`: the new name, lowercase letters, digits and -). Checked as free now, made when you finish and the change saves; the old address keeps sending visitors to the new one until the owner asks to forget it.",
    input_schema: { type: "object", properties: { to: { type: "string" } }, required: ["to"] },
  },
  {
    name: "forget_old_address",
    description: "Make one of the site's OLD web addresses stop answering (`name`), so the name is free again. Never the current address. Made when you finish.",
    input_schema: { type: "object", properties: { name: { type: "string" } }, required: ["name"] },
  },
  {
    name: "request_key",
    description: "Ask the owner for a key (secret) the site needs, by NAME, e.g. STRIPE_SECRET_KEY. The chat shows the owner a secure box that saves the value straight into the site's keys: you never see, receive or handle the value, and you must never ask for it in words. Next time, list_keys shows the name as set.",
    input_schema: { type: "object", properties: { name: { type: "string" }, service: { type: "string", description: "Whose key it is, e.g. Stripe." }, why: { type: "string", description: "One short line: what it is for." } }, required: ["name"] },
  },
  {
    name: "ask_owner",
    description: "Ask the owner ONE question when the request cannot be done right without a detail only they know, with two to four short answers they tap. This ends your turn: nothing you queued or wrote is saved, and you continue from their answer. Never ask what you can find out by reading the site.",
    input_schema: { type: "object", properties: { question: { type: "string" }, options: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 4 } }, required: ["question", "options"] },
  },
  {
    name: "finish",
    description: "You are done. If you wrote or removed any file, only after a build that passed with nothing written since. `summary`: what you changed, as plain facts for the reply to the customer.",
    input_schema: { type: "object", properties: { summary: { type: "string" } }, required: ["summary"] },
  },
]);

const SERVER_HOW = (() => {
  try { return String(SITE_PAGES_TOOL.input_schema.properties.server.description || ""); } catch { return ""; }
})();

// ── WORKERS BEST PRACTICES, ADAPTED (2026-10-29, the owner: "lets use the
// workers best practices") ────────────────────────────────────────────────────
// From Cloudflare's `workers-best-practices` skill (github.com/cloudflare/skills,
// Apache License 2.0, © Cloudflare, Inc.), cut to what holds for a site's own
// server code here and rewritten for its rails (site.fetch/key/sql/verify). The
// deployment, configuration and logging parts are the platform's, not the
// agent's, and are left out.
const SERVER_PRACTICES = `

WRITING SERVER CODE THAT HOLDS UP (adapted from Cloudflare's Workers best practices):
- Await every outside call (site.fetch, site.sql) before you answer. There is no "later": work you do not await may never happen — an email unsent, a payment unrecorded.
- Keep nothing about a visitor in a variable outside the function: the same code serves the next visitor, who would see it. Everything about this request lives inside the call.
- Codes, tokens and references a visitor could guess come from crypto.randomUUID() or crypto.getRandomValues(), never Math.random().
- A message from an outside service (Stripe's "paid", a form service) is trusted only after site.verify("KEY_NAME", signedText, signature) answers true — it checks the sender's signature with the owner's key without the key reaching your code (Stripe signs "<t>.<raw body>" and sends v1 as hex). Never compare a secret or a signature with ===. Read the raw body once (await request.text()) and parse it after checking. Then refuse a timestamp more than 5 minutes old, and record each event's id (site.sql) and do nothing for one already recorded: senders retry, and a captured message can be replayed.
- Check the request body before using it: the fields you need, their types and sizes. Answer 400 with a short message when it is wrong.
- A function a page calls can be called by anyone, with any body. Never trust an id, role, price or "is owner" flag it sends: look up what this visitor may do with site.sql and check it on every request. Hiding a button protects nothing.
- Use only the tables and columns the site's schema declares; a name you made up fails on the live site.
- site.fetch can fail, time out or answer an error: check r.ok, catch the throw, and answer 502 with a short, clear message (e.g. "the payment service did not answer").
- Do not hold a large or unbounded answer in memory, and keep each request's work small: the server has strict time and memory limits.
- Catch what can fail and answer with a clear status and a short message; never send a visitor an error's details or anything from the owner's keys.
- Never record something as paid, booked or sent until the outside service has confirmed it.`;

/** The owner's five rules for server code (2026-10-30). */
export const SERVER_RULES = `

SERVER CODE: THE OWNER'S RULES (these come first):
1. SECURITY FIRST. Before a function writes or reveals anything, check who is calling: the signed-in visitor or the record they claim, looked up with site.sql, and answer 401 or 403 when they may not. Validate every input (each field's presence, type, size and allowed values) and answer 400 when it is wrong. Never put a key, token or secret in page code: only server code holds keys, through site.key. Every function is already limited per visitor per minute; a public endpoint that can be abused (a form, a sign-up, a booking) also limits itself: count recent requests from the caller's address (request.headers.get("cf-connecting-ip")) in a site table, and answer 429 past the limit.
2. KEYS. An outside service (payments, email, text messages, AI and the rest) always runs on the owner's own key from the site's secrets: site.hasKey("NAME") first, then site.key("NAME"). When it is missing, the function answers 503 with a clear "not set up yet", and finish names exactly which key the owner must add. Never build something that fails silently. When list_keys is offered, use it to see which keys are set. When the owner still has to add a key, call request_key with its name: the chat collects the value in a secure box you never see. Never ask the owner to type or paste a key into the chat.
3. WEBHOOKS. Verify the signature with site.verify before trusting anything in the message. The same event can arrive twice: store each event's id in a site table (a unique column) and do nothing for one already stored, so the work is never done twice.
4. DATABASE CHANGES ADD, NEVER DESTROY. Never drop, rename or change the type of a table or column, and never delete stored data to make a change fit. A change that could lose data is not made: say in finish what it would need.
5. ERRORS. Every server function answers a failure with a clear status and a short message, and records it in the site's error log, where the owner sees it: an error it does not catch is recorded for you; one it catches, it records itself with site.sql("INSERT INTO _errors (at, message, route, source) VALUES (to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), ?, ?, 'server')", [message, "fn/<name>"]), never with a key or a visitor's private details in the message.
When call_function is offered, try every server function you wrote or changed with a realistic sample request, and a wrong one, before you finish. When read_errors is offered and the owner reports something broken, read the log first. When read_docs is offered, read the provider's official page before writing code against an API you are not sure of.`;

const AGENT_RULES = `

━━━ YOU ARE THE SITE'S AGENT — THESE RULES WIN OVER ANYTHING ABOVE ━━━
You change an existing website for its owner, with tools. Work like an engineer:
- The site map and the files most likely needed are in the first message. Read any other file you need with read_files before changing it; never guess what a file holds.
- Make every change the owner asked for, and nothing else. Keep everything else on every page exactly as it is.
- NEVER INVENT ANYTHING. Every fact on the site comes from the owner's words, the site as it is, or its tables: opening hours, prices, dates, times, phone numbers, emails, addresses, names of people, staff, products or places, numbers and statistics, reviews, quotes and testimonials, awards, policies, links. You write the words that present what you were told; you never supply a fact of your own. When something the request needs is missing, put a clearly marked placeholder where it goes (for example "[Opening hours]") and say in finish exactly what is missing, so the owner can tell you.
- write_file takes a whole file. To change one line, write the file with that line changed and every other line as it was.
- You have a command line (run): use it like an engineer would — grep to find where something is written, cat to read, npx tsc --noEmit to check types, sed or a script for a mechanical change across files.
- Every command is a round, and every round costs the owner money: put everything you want to look at in ONE command (join them with ;), never one look per round.
- Plan first: work out every change, then write all the files, then build once. Fix what the build reports and build again.
- Every round costs the owner money, so do as much as you can in each one: call several tools in the same answer. Write every file you already know in ONE answer (several write_file calls side by side), read every file you need in one read_files call, and never spend a round on one small file when more are ready.
- When the helpers tool is offered (a new site): write the shared files first (header, footer, shared components) and the home page yourself, then hand every other page to helpers in ONE helpers call, so they are written at the same time. Then build, look and fix.
- When the look of a page changed, look at it once the build passes, and fix anything that looks wrong.
- When the build passes and every change is made, call finish with what you changed, as plain facts.
- If a change cannot be done, make the rest, and say in finish what was not done and why.

SERVER CODE is a component named "-parts/server-<name>":
` + SERVER_HOW + SERVER_PRACTICES + SERVER_RULES;

// ── WHAT THE OWNER BRINGS IN (2026-10-30, the owner: attached files, their old
// website, a pasted list) ─────────────────────────────────────────────────────
const INPUT_RULES = `

FILES, OLD SITES AND LISTS THE OWNER GIVES YOU:
- Files attached to the message are listed in the first message with their ids. Read the ones the request is about with read_attachment before you use them; never guess what a file says.
- An attached photo the owner wants on the site: read_attachment it with place: true and use the address it answers as the <img src>. Never stand a different picture in for it.
- When the owner names their existing website and wants it rebuilt or refreshed, read it with import_site: keep their words, facts and pictures, and lay the pages out better.
- A LIST THE OWNER PASTES OR ATTACHES (products, a menu, prices, classes): read it, read the table it belongs in with read_table first (its columns, and its rows when some already exist), then map each line onto the table's columns and add or update the rows in ONE change_rows call. Never invent a value the list does not give: leave that column empty, and say in finish which values are missing and for which rows.`;

/** The rules every round opens with, the same for every site of a kind (rule 4). */
export function agentSystem(spec = null, kind = "", { ownParts = false } = {}) {
  return pageRulesFor(spec, kind, { ownParts }) + AGENT_RULES + INPUT_RULES;
}

/** A CSV (or TSV) as numbered rows of column=value, for reading a pasted or attached list. */
export function csvText(raw, sep = ",") {
  const src = String(raw || "");
  const rows = [];
  let row = [], cell = "", q = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (q) {
      if (c === '"') { if (src[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += c;
    } else if (c === '"' && !cell) q = true;
    else if (c === sep) { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && src[i + 1] === "\n") i++; row.push(cell); cell = ""; if (row.some((x) => x.trim())) rows.push(row); row = []; }
    else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim())) rows.push(row);
  if (!rows.length) return "(no rows)";
  const head = rows[0].map((h, i) => h.trim() || "column " + (i + 1));
  const body = rows.slice(1);
  return rows.length + " lines: a header and " + body.length + " rows. Columns: " + head.join(", ") + "\n" +
    body.map((r, n) => "row " + (n + 1) + ": " + head.map((h, i) => h + "=" + (r[i] === undefined ? "" : r[i].trim())).join("; ")).join("\n");
}

const textKind = (name) => (/\.csv$/i.test(name) ? "csv" : /\.tsv$/i.test(name) ? "tsv" : "text");
/**
 * THE FILES ON ONE MESSAGE, AS THE AGENT IS GIVEN THEM: the composer's list
 * (`body.images`) sorted by the same rule every other step uses
 * (`attachments` in site-context.mjs: its caps, its ids `attachment-<n>`),
 * then `{ id, name, kind, size, media_type?, data?, text? }`. What could not
 * be read is listed with why, so the agent can say so.
 */
export function agentAttachments(list) {
  const items = Array.isArray(list) ? list : [];
  const sorted = sortAttachments(items);
  const files = [];
  let b = 0, t = 0;
  for (const n of sorted.named) {
    if (n.kind === "text") {
      const one = sorted.texts[t++];
      files.push({ id: n.id, name: n.name, kind: textKind(n.name), size: one ? one.text.length : 0, text: one ? one.text : "" });
    } else {
      const blk = sorted.blocks[b++];
      if (!blk || !blk.source) continue;
      files.push({ id: n.id, name: n.name, kind: n.kind === "image" ? "image" : "pdf", size: Math.floor(blk.source.data.length * 3 / 4), media_type: blk.source.media_type, data: blk.source.data });
    }
  }
  return { files, skipped: sorted.skipped };
}
/** The same from a build's held blocks and their ids (text files are already in its brief). */
export function agentAttachmentsFromBlocks(blocks, named) {
  const bl = Array.isArray(blocks) ? blocks : [];
  const ids = (Array.isArray(named) ? named : []).filter((n) => n && n.kind !== "text");
  return bl.map((blk, i) => {
    if (!blk || !blk.source || typeof blk.source.data !== "string") return null;
    const n = ids[i] || {};
    const image = blk.type === "image";
    return { id: typeof n.id === "string" ? n.id : "attachment-" + (i + 1), name: typeof n.name === "string" && n.name ? n.name : (image ? "image " : "document ") + (i + 1), kind: image ? "image" : "pdf", size: Math.floor(blk.source.data.length * 3 / 4), media_type: blk.source.media_type, data: blk.source.data };
  }).filter(Boolean);
}

// ── THE WORKSPACE ────────────────────────────────────────────────────────────
const isPage = (p) => p && typeof p.path === "string" && typeof p.source === "string";
const isPart = (p) => p && typeof p.name === "string" && typeof p.source === "string";

export const CSS_KEY = "styles.css";
const isPageKey = (k) => k !== CSS_KEY && !k.startsWith("-parts/");

/** The files the agent works on; `css` is the stored stylesheet, or null when it could not be read (then not offered). */
export function makeWorkspace(pages = [], parts = [], css = null) {
  const files = new Map();
  for (const p of Array.isArray(pages) ? pages : []) if (isPage(p)) files.set(p.path, p.source);
  for (const p of Array.isArray(parts) ? parts : []) if (isPart(p)) files.set(partKey(p.name), p.source);
  if (typeof css === "string") files.set(CSS_KEY, css);
  const original = new Map(files);
  return {
    files,
    // A NEW SITE (nothing handed in): it has no stylesheet to write, because
    // the build makes it from the design (pretest-fixes, 2026-10-30).
    fresh: original.size === 0,
    has: (k) => files.has(k),
    get: (k) => files.get(k),
    set: (k, v) => files.set(k, v),
    delete: (k) => files.delete(k),
    keys: () => [...files.keys()],
    changed: () => [...new Set([...original.keys(), ...files.keys()])].filter((k) => original.get(k) !== files.get(k)),
    removed: () => [...original.keys()].filter((k) => !files.has(k)),
    pages: () => [...files].filter(([k]) => isPageKey(k)).map(([path, source]) => ({ path, source })),
    parts: () => [...files].filter(([k]) => k.startsWith("-parts/")).map(([k, source]) => ({ name: k.slice(7), source })),
    css: () => (files.has(CSS_KEY) ? files.get(CSS_KEY) : null),
    cssChanged: () => original.has(CSS_KEY) && original.get(CSS_KEY) !== files.get(CSS_KEY),
  };
}

/** Why a new site's agent cannot write styles.css (the build makes it from the design). */
export const NEW_SITE_CSS = "a new site has no stylesheet to write: the build makes it from the site's design (its colours and fonts). Style pages and components with classes instead";

/** A key the agent may write, or why not. */
export function writableKey(key, ws = null) {
  const k = typeof key === "string" ? key.trim() : "";
  if (k === CSS_KEY) {
    if (!ws || ws.has(CSS_KEY)) return { ok: true, key: k };
    return { ok: false, why: ws.fresh === true ? NEW_SITE_CSS : "the stylesheet could not be read, so it cannot be written this time" };
  }
  if (PAGE_KEY.test(k) && !k.startsWith("-parts/")) return { ok: true, key: k };
  if (PART_KEY.test(k)) return { ok: true, key: k };
  return { ok: false, why: "a file key is a page (\"about.tsx\") or a component (\"-parts/<name>\")" };
}

// ── RULE 1: THE HEAD START ───────────────────────────────────────────────────
/**
 * The files the first message carries: every file on a small site; on a big
 * one the required files (the targets, what they import, the header and
 * footer) and whatever the picker chose (`picked`, keys).
 */
export function headStart({ pages = [], parts = [], targets = [], picked = null } = {}) {
  const ws = makeWorkspace(pages, parts);
  if (!overThreshold(pages, parts)) return ws.keys();
  const want = new Set(requiredFiles(pages, parts, targets));
  for (const k of Array.isArray(picked) ? picked : []) if (ws.has(k)) want.add(k);
  return ws.keys().filter((k) => want.has(k));
}

const fileBlock = (k, src) => "=== " + k + " ===\n" + src;

/** The first message: the request, the map, the index of every file, the head-start files. */
/**
 * THE MAP AT THE DOOR (2026-10-29): what a new site's agent spent ten rounds
 * finding out with one command each (the third live build): where files go,
 * the site's tables and their columns, and that the rules already say how a
 * page reads them. Only for a site with no files yet.
 */
export function projectOverview(tables = [], { ownParts = false, unreadable = false } = {}) {
  const t = (Array.isArray(tables) ? tables : []).filter((x) => x && typeof x.name === "string");
  return [
    "THE PROJECT (you do not need to look around to learn this)",
    "- Pages: one file per page, by its address: \"index.tsx\" is /, \"classes.tsx\" is /classes. Write them with write_file.",
    "- Shared parts (header, footer, a form…): \"-parts/<name>\", imported by a page as './-parts/<name>'.",
    ownParts
      ? "- This site writes its own parts: there is no kit to use, so there is nothing under @/components to look through."
      : "- The ready-made kit lives under @/components (ui, charts): use it as the rules above say; do not list or read its files.",
    "- There is no stylesheet to write: the build makes it from the site's design (its colours and fonts). Style with classes. Data is read and written with useRows / useCreateRow from \"@/lib/rows\", as the rules above say; do not open @/lib.",
    unreadable ? "- The site's tables could not be read just now: whether it has any is not known." : t.length ? "- The site's tables, already created: " + t.map((x) => x.name + " (" + (x.columns || []).join(", ") + ")").join("; ") + "." : "- The site has no tables.",
    "Start writing. Use commands only for what this does not tell you.",
  ].join("\n");
}
export function firstMessage({ request, map = null, ws, shown = [], history = "", tables = null, ownParts = false, attached = [], unread = [], unreadable = false }) {
  const index = !ws.keys().length ? "(none yet — this is a new site; write every page and the site's header and footer)" : ws.keys().map((k) => "- " + k + " (" + ws.get(k).length + " chars)" + (shown.includes(k) ? " [below]" : "")).join("\n");
  const mapText = map ? siteSlice(map, "site", { budget: 8000 }) : "";
  return [
    history ? "THE CONVERSATION SO FAR (for what the request refers to)\n" + history : "",
    "THE OWNER'S REQUEST\n" + String(request || ""),
    attachedList(attached, unread),
    mapText,
    "EVERY FILE OF THE SITE\n" + index,
    !ws.keys().length ? projectOverview(tables || [], { ownParts, unreadable }) : "",
    // CAN'T TELL (fix-all): said on every change, not only a first build.
    unreadable && ws.keys().length ? "THE SITE'S TABLES\nThey could not be read just now: whether the site has any, and what they hold, is not known. Do not assume there are none." : "",
    // THE TABLES' KEYS (fix-all): change_rows names a row by its table's key.
    (tables || []).some((t) => t && t.pk && t.pk !== "id") ? "TABLE KEYS (change_rows' `id` is this column's value): " + tables.map((t) => t.name + ": " + (t.pk || "id")).join("; ") : "",
    shown.length ? "THE FILES MOST LIKELY NEEDED, AS THEY ARE NOW\n" + shown.map((k) => fileBlock(k, ws.get(k))).join("\n\n") : "",
  ].filter(Boolean).join("\n\n");
}

/** The attached files, by id, name, kind and size — what read_attachment takes. */
export function attachedList(attached = [], unread = []) {
  const a = Array.isArray(attached) ? attached : [];
  const u = Array.isArray(unread) ? unread : [];
  if (!a.length && !u.length) return "";
  const kb = (n) => (n >= 1024 * 1024 ? (Math.round(n / 104857.6) / 10) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB");
  return ["FILES THE OWNER ATTACHED TO THIS MESSAGE (read one with read_attachment and its id)",
    ...a.map((f) => "- " + f.id + ": " + String(f.name).slice(0, 120) + " (" + f.kind + ", " + kb(Number(f.size) || 0) + ")"),
    ...u.slice(0, 6).map((f) => "- not readable: " + String((f && f.name) || "a file").slice(0, 80) + " (" + String((f && f.reason) || "it could not be used").slice(0, 120) + ")"),
  ].join("\n");
}

// ── RULE 3: CLEARING THE DESK ────────────────────────────────────────────────
const NOTE = "[cleared from this conversation to save space; the workspace keeps the current version — read_files it again if you need it]";
// A SCREENSHOT DOES NOT COUNT TOWARDS THE PILE (2026-10-29): one is ~100,000
// characters of base64, so every look pushed the pile over COMPACT_AT and the
// next round rewrote older rounds (kiln-lane-4: seven clearings, each read again
// at full price). Screenshots leave on their own, after the round that saw them.
export const pileSize = (messages) => messages.reduce((n, m) => n + JSON.stringify(Array.isArray(m.content) ? m.content.filter((b) => !(b && b.type === "image")) : m.content).length, 0);
const SHOT_SEEN = "[a screenshot you have seen; it was taken out to save space — look again if you need it]";
/**
 * THE SCREENSHOTS LEAVE AFTER ONE ROUND: every image in a message older than
 * the newest becomes a one-line note. Only the message just before the newest
 * can still hold one, so the rewrite sits at the tail and everything before it
 * is still read from the cache (rule 4). Pure; answers new messages and a count.
 */
export function dropSeenShots(messages) {
  let dropped = 0;
  const out = messages.map((m, i) => {
    if (i === messages.length - 1 || !Array.isArray(m.content) || !m.content.some((b) => b && b.type === "image")) return m;
    return { ...m, content: m.content.map((b) => (b && b.type === "image" ? (dropped++, { type: "text", text: SHOT_SEEN }) : b)) };
  });
  return { messages: out, dropped };
}

/**
 * Older rounds' file bodies become one-line notes: the answers of
 * `read_files` and the sources given to `write_file`. The first message and
 * the latest `keep` rounds are never touched. Pure; answers new messages.
 */
export function compact(messages, { keep = KEEP_RECENT } = {}) {
  const out = messages.map((m) => ({ ...m }));
  // A round is one assistant message and the user message answering it.
  const assistants = out.map((m, i) => (m.role === "assistant" ? i : -1)).filter((i) => i >= 0);
  const cut = assistants.length > keep ? assistants[assistants.length - keep] : 1;
  let cleared = 0;
  for (let i = 1; i < cut; i++) {
    const m = out[i];
    if (!Array.isArray(m.content)) continue;
    m.content = m.content.map((b) => {
      if (b && b.type === "tool_use" && b.name === "write_file" && b.input && typeof b.input.source === "string" && b.input.source !== NOTE) {
        cleared++;
        return { ...b, input: { file: b.input.file, source: "[written: " + b.input.source.length + " chars] " + NOTE } };
      }
      if (b && b.type === "image") {
        cleared++;
        return { type: "text", text: "[a screenshot, cleared from this conversation to save space; look again if you need it]" };
      }
      if (b && b.type === "tool_result" && b.reads && typeof b.content === "string" && b.content !== NOTE) {
        cleared++;
        return { ...b, content: "[read: " + b.reads.join(", ") + "] " + NOTE };
      }
      return b;
    });
  }
  return { messages: out, cleared };
}

// ── THE TOOLS A CALLER HAS WIRED ────────────────────────────────────────────
/** Which tool needs which dependency; a tool whose dependency is missing is never offered. */
export const TOOL_NEEDS = Object.freeze({ look: "look", run: "run", read_table: "readTable", helpers: "helpers", call_function: "callFunction", read_errors: "readErrors", list_keys: "listKeys", change_schema: "applySchema", read_docs: "fetchDocs", read_attachment: "attachment", import_site: "importSite", set_site_settings: "saveSettings", set_logo: "checkUpload", set_languages: "saveSettings", set_table_rules: "saveRules", rename_page: "saveRedirects", make_qr: "siteUrl", ask_owner: "canAsk", sort_table: "sortTables", attach_media: "media", rename_site: "address", forget_old_address: "address" });
export function toolsFor(deps) {
  const d = deps || {};
  return AGENT_TOOLS.filter((t) => !Object.hasOwn(TOOL_NEEDS, t.name) || typeof d[TOOL_NEEDS[t.name]] === "function");
}

// ── WHAT THE CHECKS FOUND, IN WORDS ──────────────────────────────────────────
// The browser check and the type checker run on every build and look, and
// their findings used to stop at the caller: the agent saw "The build passed."
// and a screenshot while the check had flagged text nobody could read (live,
// 2026-10-29). Now each finding reaches it, by page and width, in words.
const FINDING_WORDS = Object.freeze({
  threw: "the page stops with an error", logged: "an error is written while the page loads", blank: "the page shows nothing",
  slow: "the page took longer to open than the check waits", image: "an image did not load", overflow: "the page scrolls sideways",
  contrast: "text that is nearly invisible against its background", seethrough: "a menu or dialog is see-through",
});
/** The kinds that must be fixed before finishing. */
export const MUST_FIX = Object.freeze(["threw", "blank", "contrast", "overflow", "seethrough"]);
const MAX_FINDING_LINES = 12;
export function checkNotes(r) {
  const lines = [];
  const render = r && r.render && typeof r.render === "object" ? r.render : null;
  const findings = render && Array.isArray(render.findings) ? render.findings : [];
  for (const f of findings.slice(0, MAX_FINDING_LINES)) {
    if (!f || typeof f.kind !== "string" || !Object.hasOwn(FINDING_WORDS, f.kind)) continue;
    const detail = typeof f.detail === "string" && f.detail ? " (" + f.detail.slice(0, 200) + ")" : "";
    lines.push("- " + String(f.route || "/") + " at " + String(f.viewport || "?") + " width: " + FINDING_WORDS[f.kind] + detail + (MUST_FIX.includes(f.kind) ? " — FIX THIS before finishing" : ""));
  }
  if (findings.length > MAX_FINDING_LINES) lines.push("- and " + (findings.length - MAX_FINDING_LINES) + " more of the same kinds");
  if (render && render.partial === true) lines.push("- the browser check did not reach every page");
  const tsc = r && typeof r.typeErrors === "string" ? r.typeErrors.split("\n").filter((l) => /error TS\d+/.test(l)).slice(0, 8) : [];
  if (tsc.length) lines.push("Type errors that did not stop the build (fix them):", ...tsc.map((l) => "- " + l.slice(0, 300)));
  return lines.length ? "\nThe checks found:\n" + lines.join("\n") : "";
}
const mustFix = (r) => !!(r && r.render && Array.isArray(r.render.findings) && r.render.findings.some((f) => f && MUST_FIX.includes(f.kind)));
/** The must-fix findings of a check, counted by kind, for the record (numbers only, never text). */
export function mustFixKinds(r) {
  const out = {};
  for (const f of r && r.render && Array.isArray(r.render.findings) ? r.render.findings : []) if (f && MUST_FIX.includes(f.kind)) out[f.kind] = (out[f.kind] || 0) + 1;
  return out;
}

// ── WHY A BUILD FAILED, AS A KIND ───────────────────────────────────────────
/** One of a fixed set of kinds for a failed build, read from what it answered; never its text. */
export const BUILD_FAIL_KINDS = Object.freeze(["timeout", "types", "missing", "serverTest", "crash", "other"]);
export function buildFailKind(r) {
  const e = String((r && r.error) || "");
  if (r && r.timedOut === true || /timed out|time limit|deadline/i.test(e)) return "timeout";
  if (/error TS\d+/.test(e)) return "types";
  if (/Could not resolve|Cannot find module|failed to resolve import|ENOENT|not found/i.test(e)) return "missing";
  if (/server (code|test)|failed its test/i.test(e)) return "serverTest";
  if (/SyntaxError|Unexpected token|Transform failed|Parse error|ReferenceError|TypeError/i.test(e)) return "crash";
  return "other";
}

// ── WHAT A ROUND DID, AS NUMBERS ─────────────────────────────────────────────
/** Each tool's uses in one round, as counts: the build trace keeps numbers only. */
const TOOL_COUNT_KEYS = { write_file: "writes", read_files: "reads", delete_file: "deletes", change_rows: "rowChanges", read_table: "tableReads", run: "commands", look: "looks", build: "builds", finish: "finish", call_function: "fnCalls", read_errors: "errorReads", list_keys: "keyLists", change_schema: "schemaChanges", read_docs: "docReads", set_site_settings: "settings", set_logo: "logos", set_languages: "languages", set_table_rules: "ruleChanges", rename_page: "pageRenames", make_qr: "qrCodes", ask_owner: "asks", request_key: "keyAsks" };
export function toolCounts(uses) {
  const out = {};
  for (const b of Array.isArray(uses) ? uses : []) {
    const k = b && Object.hasOwn(TOOL_COUNT_KEYS, b.name) ? TOOL_COUNT_KEYS[b.name] : "other";
    out[k] = (out[k] || 0) + 1;
    if (b && b.name === "run") for (const kind of commandKinds(b.input && b.input.command)) out[kind] = (out[kind] || 0) + 1;
  }
  return out;
}
/** What a command line did, as kinds (one per part joined by ; && | ||): its text is never kept. */
const COMMAND_KINDS = [["cmdList", /^(ls|find|tree|du)\b/], ["cmdRead", /^(cat|head|tail|less|wc|sed\s+-n)\b/], ["cmdSearch", /^(grep|rg|egrep|ag)\b/], ["cmdCheck", /^(npx\s+tsc|tsc|node|npm\s+(run|test))\b/], ["cmdEdit", /^(sed\s+-i|perl|mv|cp|rm|mkdir|touch|echo|printf|tee)\b/]];
export function commandKinds(command) {
  if (typeof command !== "string") return [];
  return command.split(/;|&&|\|\||\|/).map((p) => p.trim()).filter(Boolean).map((p) => (COMMAND_KINDS.find(([, re]) => re.test(p)) || ["cmdOther"])[0]);
}

// ── WHAT A COMMAND CHANGED COMES BACK ────────────────────────────────────────
/**
 * The site's files as a command left them, folded into the workspace: a page or
 * component changed, added or removed, and the stylesheet when the workspace
 * holds one. Answers the keys that moved; marks the workspace unbuilt when any did.
 */
export function syncFromRun(st, files) {
  if (!files || !Array.isArray(files.pages) || !Array.isArray(files.parts)) return [];
  const ws = st.ws, moved = [];
  const now = new Map();
  for (const p of files.pages) if (p && typeof p.path === "string" && typeof p.source === "string" && writableKey(p.path).ok) now.set(p.path, p.source);
  for (const p of files.parts) if (p && typeof p.name === "string" && typeof p.source === "string" && writableKey(partKey(p.name)).ok) now.set(partKey(p.name), p.source);
  for (const [k, v] of now) if (ws.get(k) !== v) { ws.set(k, v); moved.push(k); }
  for (const k of ws.keys()) if (k !== CSS_KEY && !now.has(k)) { ws.delete(k); moved.push(k); }
  if (ws.has(CSS_KEY) && typeof files.css === "string" && files.css !== ws.get(CSS_KEY)) { ws.set(CSS_KEY, files.css); moved.push(CSS_KEY); }
  if (moved.length) { st.dirty = true; for (const k of moved) st.written.add(k); }
  return moved;
}

/** ONLY THE PART ASKED FOR (2026-10-30): the caller's scope check (`deps.mayWrite`, `agent-guard.mjs`), or "" when there is none. */
function outOfScope(deps, key) {
  if (!deps || typeof deps.mayWrite !== "function") return "";
  try { return String(deps.mayWrite(key) || ""); } catch { return ""; }
}

// ── THE TOOLS, RUN ───────────────────────────────────────────────────────────
async function runTool(use, st, deps) {
  const input = use.input && typeof use.input === "object" ? use.input : {};
  switch (use.name) {
    case "read_files": {
      const want = (Array.isArray(input.files) ? input.files : []).filter((f) => typeof f === "string").slice(0, MAX_READ);
      if (!want.length) return { error: "name at least one file" };
      const found = want.filter((k) => st.ws.has(k));
      const missing = want.filter((k) => !st.ws.has(k));
      const text = found.map((k) => fileBlock(k, st.ws.get(k))).join("\n\n") + (missing.length ? "\n\nNo such file: " + missing.join(", ") : "");
      return { text, reads: found };
    }
    case "write_file": {
      const w = writableKey(input.file, st.ws);
      if (!w.ok) return { error: w.why };
      if (st.onlyWrite && w.key !== st.onlyWrite) return { error: "a helper writes only its own page, " + st.onlyWrite };
      { const why = outOfScope(deps, w.key); if (why) return { error: why }; }
      const src = typeof input.source === "string" ? input.source : "";
      if (!src.trim()) return { error: "the source is empty" };
      if (src.length > MAX_FILE_CHARS) return { error: "the file is over " + MAX_FILE_CHARS + " characters" };
      const name = w.key.startsWith("-parts/") ? w.key.slice(7) : "";
      st.ws.set(w.key, src);
      st.dirty = true;
      st.written.add(w.key);
      if (name.startsWith(SERVER_PREFIX)) {
        const c = checkServerPart({ name, source: src });
        const why = c && Array.isArray(c.reasons) ? c.reasons : [];
        if (why.length) return { text: "Saved, but this server code will be refused at publish: " + why.join("; ") + ". Fix it." };
      }
      return { text: "Saved " + w.key + " (" + src.length + " chars)." };
    }
    case "delete_file": {
      if (st.onlyWrite) return { error: "a helper writes only its own page, " + st.onlyWrite };
      const w = writableKey(input.file);
      if (!w.ok || w.key === CSS_KEY) return { error: "only a page or a component can be removed" };
      if (w.key === "index.tsx") return { error: "the home page cannot be removed" };
      if (!st.ws.has(w.key)) return { error: "no such file: " + w.key };
      { const why = outOfScope(deps, w.key); if (why) return { error: why }; }
      st.ws.delete(w.key);
      st.dirty = true;
      st.written.add(w.key);
      return { text: "Removed " + w.key + " from your workspace." };
    }
    case "change_rows": {
      if (st.onlyWrite) return { error: "a helper writes only its own page, " + st.onlyWrite };
      const t = typeof input.table === "string" ? input.table.trim() : "";
      // CAN'T TELL IS NOT "NO TABLES" (2026-10-30, fix-all): when the tables
      // could not be read, nothing is assumed about them.
      if (st.unreadable) return { error: UNREADABLE_TABLES };
      const table = (st.tables || []).find((x) => x.name === t);
      if (!table) return { error: st.tables && st.tables.length ? "no such table; the site's tables are " + st.tables.map((x) => x.name).join(", ") : "this site has no tables" };
      const cols = new Set(table.columns);
      // THE TABLE'S OWN KEY (fix-all): never an assumed `id` column.
      const pk = table.pk || "id";
      const bad = (o) => (o && typeof o === "object" && !Array.isArray(o) ? Object.keys(o).filter((k) => !cols.has(k) || k === pk) : ["(not an object)"]);
      const add = Array.isArray(input.add) ? input.add : [];
      const update = Array.isArray(input.update) ? input.update : [];
      const remove = Array.isArray(input.remove) ? input.remove : [];
      const okId = (v) => (typeof v === "number" && Number.isInteger(v)) || (typeof v === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(v));
      const wrong = [
        ...add.flatMap((o) => bad(o).map((k) => "add: " + k)),
        ...update.flatMap((u) => (!u || !okId(u.id) ? ["update: a row id"] : bad(u.set).map((k) => "update: " + k))),
        ...remove.filter((v) => !okId(v)).map(() => "remove: a row id"),
      ];
      if (wrong.length) return { error: "not columns of " + t + " (" + [...cols].join(", ") + "): " + [...new Set(wrong)].slice(0, 8).join("; ") };
      if (!add.length && !update.length && !remove.length) return { error: "nothing to change" };
      st.rows.push({ table: t, pk, add, update: update.map((u) => ({ id: u.id, set: u.set })), remove });
      return { text: "Queued for " + t + ": " + [add.length && add.length + " to add", update.length && update.length + " to update", remove.length && remove.length + " to remove"].filter(Boolean).join(", ") + ". Saved when you finish." };
    }
    case "read_table": {
      const t = typeof input.table === "string" ? input.table.trim() : "";
      if (!TABLE.test(t)) return { error: "not a table name" };
      if (typeof deps.readTable !== "function") return { error: "this site's tables cannot be read here" };
      try {
        const n = Number.isInteger(input.limit) && input.limit > 0 ? Math.min(input.limit, MAX_TABLE_READ) : 20;
        const rows = await deps.readTable(t, n);
        return { text: JSON.stringify(rows).slice(0, n > 20 ? MAX_TOOL_TEXT : 12000) };
      } catch (e) { return { error: "could not read " + t + ": " + String((e && e.message) || e).slice(0, 200) }; }
    }
    case "build": {
      st.builds++;
      let r;
      try { r = await deps.build({ pages: st.ws.pages(), parts: st.ws.parts(), css: st.ws.css() }); }
      catch (e) { r = { ok: false, error: String((e && e.message) || e) }; }
      st.lastBuild = r && r.ok === true ? "ok" : "fail";
      if (r && r.ok === true) { st.dirty = false; st.built = true; st.mustFix = mustFix(r); st.mustFixKinds = mustFixKinds(r); }
      const tests = r && Array.isArray(r.serverTests) ? r.serverTests.filter((t) => t && t.ok === false && t.kind === "code") : [];
      const notes = r && r.ok === true ? checkNotes(r) : "";
      if (r && r.ok === true && !tests.length) return { text: "The build passed." + notes };
      if (r && r.ok === true) return { text: "The build passed, but server code failed its test run: " + tests.map((t) => t.name + ": " + t.error).join("; ") + notes };
      // WHY IT FAILED, AS A KIND (2026-10-29): the trace keeps numbers only,
      // so the reason is kept as which kind it was, never its text.
      try { st.log({ event: "build-fail", [buildFailKind(r)]: 1 }); } catch { /* the record never costs the build */ }
      return { text: "The build failed:\n" + String((r && r.error) || "no reason given").slice(0, 6000) };
    }
    case "run": {
      const cmd = typeof input.command === "string" ? input.command.trim() : "";
      if (!cmd) return { error: "name a command" };
      if (cmd.length > 4000) return { error: "the command is over 4,000 characters" };
      if (typeof deps.run !== "function") return { error: "commands cannot be run here" };
      let r;
      try { r = await deps.run({ pages: st.ws.pages(), parts: st.ws.parts(), css: st.ws.css() }, cmd); }
      catch (e) { r = { ok: false, error: String((e && e.message) || e) }; }
      if (!r || r.ok !== true) return { error: "the command could not be run: " + String((r && r.error) || "no answer").slice(0, 300) };
      const moved = syncFromRun(st, r.files);
      const head = (r.timedOut ? "stopped at the time limit" : "exit code " + r.code) + (moved.length ? "; files changed: " + moved.join(", ") : "");
      return { text: head + "\n" + String(r.output || "(no output)") };
    }
    case "look": {
      const route = typeof input.page === "string" ? input.page.trim() : "";
      if (!/^\/[a-z0-9/_-]*$/i.test(route)) return { error: "a page address starts with / (\"/\", \"/about\")" };
      if (typeof deps.look !== "function") return { error: "pages cannot be looked at here" };
      let r;
      try { r = await deps.look({ pages: st.ws.pages(), parts: st.ws.parts(), css: st.ws.css() }, route); }
      catch (e) { r = { ok: false, error: String((e && e.message) || e) }; }
      if (!r || r.ok !== true) return { error: "the site did not build, so there is nothing to look at:\n" + String((r && r.error) || "no reason given").slice(0, 4000) };
      const shots = (Array.isArray(r.shots) ? r.shots : []).filter((x) => x && x.route === route && typeof x.png === "string" && x.png).slice(0, MAX_SHOTS);
      if (!shots.length) return { error: "no screenshot of " + route + " came back (is that a page of this site?)" };
      st.mustFix = mustFix(r);
      st.mustFixKinds = mustFixKinds(r);
      st.looked.add(route);
      return { text: "Screenshots of " + route + " follow: " + shots.map((x) => x.viewport + " width").join(", ") + "." + checkNotes(r), images: shots.map((x) => ({ label: route + " at " + x.viewport + " width", png: x.png })) };
    }
    case "helpers": {
      if (typeof deps.helpers !== "function") return { error: "helpers cannot be used here" };
      const raw = Array.isArray(input.tasks) ? input.tasks : [];
      if (!raw.length) return { error: "name at least one page for a helper" };
      if (raw.length > MAX_HELPERS) return { error: "at most " + MAX_HELPERS + " pages in one call" };
      const tasks = [];
      const seen = new Set();
      for (const t of raw) {
        const w = writableKey(t && t.file, st.ws);
        const brief = t && typeof t.brief === "string" ? t.brief.trim() : "";
        if (!w.ok || w.key === CSS_KEY || w.key.startsWith("-parts/")) return { error: "a helper writes one page (\"about.tsx\"), never a component or the stylesheet: " + String(t && t.file).slice(0, 60) };
        if (seen.has(w.key)) return { error: "two helpers cannot write the same page: " + w.key };
        if (!brief) return { error: "give the helper for " + w.key + " a brief" };
        seen.add(w.key);
        tasks.push({ file: w.key, brief: brief.slice(0, 4000) });
      }
      const done = await deps.helpers(tasks, st.ws);
      const lines = [];
      for (const d of done) {
        if (d.source) {
          st.ws.set(d.file, d.source);
          st.dirty = true;
          st.written.add(d.file);
          lines.push(d.file + ": written (" + d.source.length + " chars)" + (d.summary ? ". " + d.summary.slice(0, 600) : ""));
        } else lines.push(d.file + ": NOT written (" + (d.why || "no answer") + ") — write it yourself");
      }
      return { text: "The helpers are back:\n" + lines.join("\n") + "\nBuild next, then look and fix." };
    }
    case "call_function": {
      if (typeof deps.callFunction !== "function") return { error: "server functions cannot be tried here" };
      const q = callRequest(input, st.ws.parts().map((p) => p.name));
      if (!q.ok) return { error: q.why };
      let r;
      try { r = await deps.callFunction(st.ws.parts().filter((p) => p.name.startsWith(SERVER_PREFIX)), q.call); }
      catch (e) { r = { ran: false, why: String((e && e.message) || e) }; }
      if (r && r.ok === false) return { error: "the function could not be tried: " + String(r.error || "no answer").slice(0, 200) };
      return callAnswer(r);
    }
    case "read_errors": {
      if (typeof deps.readErrors !== "function") return { error: "the error log cannot be read here" };
      const n = errorsLimit(input.limit);
      try { return { text: errorLines(await deps.readErrors(n), n) }; }
      catch (e) { return { error: "the error log could not be read: " + String((e && e.message) || e).slice(0, 160) }; }
    }
    case "list_keys": {
      if (typeof deps.listKeys !== "function") return { error: "the site's keys cannot be listed here" };
      try {
        const names = keyNames(await deps.listKeys());
        return { text: names.length ? "The owner has set these keys (names only): " + names.join(", ") + "." : "The owner has set no keys for this site yet." };
      } catch (e) { return { error: "the keys could not be listed: " + String((e && e.message) || e).slice(0, 160) }; }
    }
    case "request_key": {
      // A NAME ONLY (2026-10-30, the key card): it lands in the reply's
      // `needKeys`, and the owner's browser sends the value to the site's keys.
      const k = keyAsk(input);
      if (!k.ok) return { error: k.why };
      if (!st.keysAsked.some((x) => x.name === k.key.name)) st.keysAsked.push(k.key);
      return { text: "The owner will be shown a secure box for " + k.key.name + " in the chat. You will not see its value. Make the code read it with site.hasKey/site.key, and carry on." };
    }
    case "change_schema": {
      if (st.onlyWrite) return { error: "a helper writes only its own page, " + st.onlyWrite };
      if (typeof deps.applySchema !== "function") return { error: "the database cannot be changed here" };
      if (st.unreadable) return { error: UNREADABLE_TABLES };
      const c = schemaChange(input, st.tables);
      if (!c.ok) return { error: c.why };
      st.schema.push(c.op);
      // What change_rows and the next change_schema see: the table as it will be.
      if (c.op.create) st.tables.push({ name: c.op.table, pk: "id", columns: ["id", ...c.op.create.columns.map((x) => x.name)] });
      else { const t = st.tables.find((x) => x.name === c.op.table); if (t) t.columns = [...t.columns, ...c.op.add.map((x) => x.name)]; }
      return { text: (c.op.create ? "Queued: a new table " + c.op.table + " (" + c.op.create.columns.map((x) => x.name + " " + x.type).join(", ") + ")" : "Queued: new columns on " + c.op.table + " (" + c.op.add.map((x) => x.name + " " + x.type).join(", ") + ")") + ". Added to the database when you finish, before the table entries." };
    }
    case "read_docs": {
      if (typeof deps.fetchDocs !== "function") return { error: "documentation cannot be read here" };
      return readDocs(deps.fetchDocs, input.url);
    }
    case "read_attachment": {
      if (typeof deps.attachment !== "function") return { error: "no files were attached to this message" };
      const id = typeof input.id === "string" ? input.id.trim() : "";
      const f = deps.attachment(id);
      if (!f) return { error: "no attached file has the id " + JSON.stringify(id.slice(0, 40)) + "; the ids are listed in the first message" };
      if (f.kind === "image") {
        let placed = "";
        if (input.place === true) {
          if (typeof deps.storeAttachment !== "function") placed = " It could not be stored in the site's files here.";
          else {
            let r;
            try { r = await deps.storeAttachment(f); } catch (e) { r = { error: String((e && e.message) || e).slice(0, 120) }; }
            placed = r && typeof r.url === "string" && r.url ? " Stored in the site's files: use src=\"" + r.url + "\"." : " It could not be stored: " + String((r && r.error) || "no answer").slice(0, 120) + ".";
          }
        }
        return { text: "The image " + f.name + " follows." + placed, images: [{ label: "the attached " + f.name, png: f.data, media_type: f.media_type }] };
      }
      let text = "";
      if (f.kind === "pdf") {
        if (typeof deps.pdfText !== "function") return { error: "PDFs cannot be read here" };
        try { text = String((await deps.pdfText(f.data)) || ""); } catch { text = ""; }
        if (!text.trim()) return { error: "no readable text in " + f.name + " (it may be a scan, or use a font whose letters cannot be read); ask the owner to paste the words or attach a text or CSV version" };
      } else if (f.kind === "csv" || f.kind === "tsv") text = csvText(f.text, f.kind === "tsv" ? "\t" : ",");
      else if (f.kind === "text") text = String(f.text || "");
      else return { error: f.name + " is a kind of file that cannot be read here (images, PDFs, CSV and text files can)" };
      const from = Number.isInteger(input.from) && input.from > 0 ? input.from : 0;
      const piece = text.slice(from, from + MAX_TOOL_TEXT);
      const more = from + piece.length < text.length;
      return { text: f.name + " (" + text.length + " characters" + (from ? ", from " + from : "") + "):\n" + piece + (more ? "\n[…cut at " + (from + piece.length) + " of " + text.length + " characters: read_attachment again with from=" + (from + piece.length) + "]" : "") };
    }
    case "import_site": {
      if (typeof deps.importSite !== "function") return { error: "websites cannot be read here" };
      const href = readImportSite(typeof input.url === "string" ? input.url : "", st.request);
      if (!href) return { error: "only a public web address the owner wrote in their message can be read" };
      let r;
      try { r = await deps.importSite(href); } catch (e) { r = { ok: false, reason: "we couldn't reach it" }; }
      if (!r || r.ok !== true || !r.extract) return { error: "the site could not be read: " + String((r && r.reason) || "no answer").slice(0, 200) };
      const x = r.extract;
      const block = importBriefBlock({ ...x, logo: null, photos: [] }).trim();
      const links = [...new Set((x.pages || []).map((p) => p && p.url).filter((u) => typeof u === "string"))];
      const pics = (Array.isArray(r.pictures) ? r.pictures : []).map((p) => "- " + (p.id === IMPORT_LOGO_ID ? "their logo" : "a photograph") + (p.alt ? " (\"" + String(p.alt).replace(/"/g, "'").slice(0, 120) + "\")" : "") + ": " + (p.url ? "src=\"" + p.url + "\"" : "not usable (" + String(p.why || "it could not be copied").slice(0, 80) + ")"));
      const text = [block, links.length ? "PAGES READ: " + links.join(", ") : "", pics.length ? "THEIR PICTURES, copied into this site's files:\n" + pics.join("\n") : "No pictures could be copied."].filter(Boolean).join("\n\n");
      return { text: text.slice(0, MAX_TOOL_TEXT) + (text.length > MAX_TOOL_TEXT ? "\n[…cut]" : "") };
    }
    case "set_site_settings":
    case "set_logo":
    case "set_languages": {
      if (st.onlyWrite) return { error: "a helper writes only its own page, " + st.onlyWrite };
      const r = use.name === "set_languages" ? readLanguagesInput(input) : await (use.name === "set_logo" ? readLogoInput : readSettingsInput)(input, { checkUpload: deps.checkUpload });
      if (r.error) return { error: r.error };
      Object.assign(st.settings, r.settings);
      return { text: "Queued: " + Object.keys(r.settings).join(", ") + ". Saved when you finish.", settings: Object.keys(r.settings) };
    }
    case "set_table_rules": {
      if (st.onlyWrite) return { error: "a helper writes only its own page, " + st.onlyWrite };
      const r = readRulesInput(input, st.ruleTables, [st.request]);
      if (r.error) return { error: r.error };
      if (!r.changes.length) return { text: "Already so: nothing to change." };
      st.rules.push(...r.changes);
      return { text: "Queued for " + r.changes.map((c) => c.table).join(", ") + ": " + r.changes.flatMap((c) => Object.keys(c).filter((k) => k !== "table" && k !== "readWords")).join(", ") + ". Saved when you finish." };
    }
    case "rename_page": {
      if (st.onlyWrite) return { error: "a helper writes only its own page, " + st.onlyWrite };
      const files = [...st.ws.pages(), ...st.ws.parts().map((p) => ({ path: partKey(p.name), source: p.source }))];
      const r = readRenameInput(input, files);
      if (r.error) return { error: r.error };
      const before = new Map(files.map((f) => [f.path, f.source]));
      const moved = r.files.find((f) => !before.has(f.path));
      // ONLY THE PART ASKED FOR (combined 2026-10-30): every file the move
      // touches passes the same scope check a write does, before anything moves.
      for (const k of [...files.filter((f) => !r.files.some((g) => g.path === f.path)).map((f) => f.path), ...r.files.filter((f) => before.get(f.path) !== f.source).map((f) => f.path)]) {
        const why = outOfScope(deps, k); if (why) return { error: why };
      }
      for (const f of files) if (!r.files.some((g) => g.path === f.path)) { st.ws.delete(f.path); st.written.add(f.path); }
      for (const f of r.files) if (before.get(f.path) !== f.source) { st.ws.set(f.path, f.source); st.written.add(f.path); }
      st.dirty = true;
      st.redirects[r.redirect.from] = r.redirect.to;
      return { text: "Moved " + r.redirect.from + " to " + r.redirect.to + (moved ? " (" + moved.path + ")" : "") + "; links rewritten in " + r.changed.length + " file" + (r.changed.length === 1 ? "" : "s") + "; the old address will send visitors to the new one. Build next." };
    }
    case "make_qr": {
      let url = "";
      try { url = await deps.siteUrl(); } catch { url = ""; }
      const r = readQrInput(input, url);
      if (r.error) return { error: r.error };
      st.qrs++;
      return { text: "The QR code for " + r.text + " is this picture address; put it in an <img src> (with alt text saying where it leads):\n" + r.src };
    }
    case "sort_table": {
      if (st.onlyWrite) return { error: "a helper writes only its own page, " + st.onlyWrite };
      if (st.unreadable) return { error: UNREADABLE_TABLES };
      const t = typeof input.table === "string" ? input.table.trim() : "";
      const by = typeof input.by === "string" ? input.by.trim() : "";
      const dir = typeof input.direction === "string" && SORT_DIRS.includes(input.direction.trim()) ? input.direction.trim() : "asc";
      const cols = sortColumns(st.tables, t);
      if (!cols) return { error: st.tables.length ? "no such table; the site's tables are " + st.tables.map((x) => x.name).join(", ") : "this site has no tables" };
      if (!cols.includes(by)) return { error: sortRefusal({ table: t, column: by, columns: cols }) };
      // EVERY PAGE AND COMPONENT THAT READS THE TABLE, as the order step did.
      const files = st.ws.keys().filter((k) => k !== CSS_KEY).map((k) => ({ path: k, source: st.ws.get(k) }));
      const r = applySort(files, t, by, dir);
      for (const k of r.changed) { const why = outOfScope(deps, k); if (why) return { error: why }; }
      for (const f of r.pages) if (r.changed.includes(f.path)) { st.ws.set(f.path, f.source); st.written.add(f.path); }
      if (r.changed.length) st.dirty = true;
      st.sorts.push({ table: t, by, direction: dir, files: r.changed.slice(), refused: r.refused.length });
      if (!r.changed.length && !r.refused.length) return { text: "No page or component reads " + t + " in another order: nothing changed (it may already be in that order, or nothing lists it yet)." };
      return { text: "Ordered " + t + " by " + by + " (" + dir + ") in " + (r.changed.length ? r.changed.join(", ") : "no file") + (r.refused.length ? "; " + r.refused.length + " place(s) build their options in code and were left as they are: change those by hand" : "") + ". Build afterwards." };
    }
    case "attach_media": {
      if (typeof deps.media !== "function") return { error: "the owner's videos and recordings cannot be reached here" };
      const name = String(input.upload || "").split("?")[0].split("/").pop().trim();
      if (!name) return { error: "name one of the owner's uploaded videos or recordings" };
      let r;
      try { r = await deps.media(name); } catch { r = { ok: false, why: "the owner's uploads could not be read just now" }; }
      if (!r || r.ok !== true) return { error: String((r && r.why) || "that is not one of the owner's videos or recordings") };
      st.media.push({ name: r.name || name, url: r.url, kind: r.kind });
      return { text: "The " + r.kind + " " + (r.name || name) + " is hosted at " + r.url + (r.mime ? " (" + r.mime + ")" : "") + ". Place it with <" + (r.kind === "audio" ? "audio" : "video") + " src=\"" + r.url + "\" controls" + (r.kind === "audio" ? "" : " playsInline") + " />." };
    }
    case "rename_site":
    case "forget_old_address": {
      if (st.onlyWrite) return { error: "a helper writes only its own page, " + st.onlyWrite };
      if (typeof deps.address !== "function") return { error: "the site's address cannot be changed here" };
      const name = String(use.name === "rename_site" ? input.to : input.name || "").trim().toLowerCase().replace(/^https?:\/\//, "").split(".")[0];
      if (!ADDRESS.test(name)) return { error: "an address is lowercase letters, digits and -, e.g. sunset-shoes" };
      const action = use.name === "rename_site" ? "rename" : "forget";
      let r;
      try { r = await deps.address({ action, name, check: true }); } catch { r = { ok: false, why: "the address could not be checked just now" }; }
      if (!r || r.ok !== true) return { error: String((r && r.why) || "that address cannot be used") };
      if (action === "rename") st.address = { action, name, from: r.from || "" };
      else if (!st.forget.includes(name)) st.forget.push(name);
      return { text: action === "rename" ? "Queued: the site moves to " + name + " when you finish and the change saves; the old address will send visitors there." : "Queued: " + name + " stops answering when you finish and the change saves." };
    }
    case "ask_owner": {
      if (st.onlyWrite) return { error: "a helper cannot ask the owner" };
      const r = readAskInput(input);
      if (r.error) return { error: r.error };
      st.ask = r.ask;
      st.done = true;
      return { text: "Asked. Your turn ends here." };
    }
    case "finish": {
      if (st.dirty && !st.onlyWrite) return { error: "build first: files were written since the last build that passed" };
      // A FINDING THAT MUST BE FIXED HOLDS THE FINISH ONCE: the agent is sent
      // back to fix it; if it finishes again it is let go (it may not be able to),
      // and the final reply says what the check still found.
      // WHY IT WAS SENT BACK, for the record (2026-10-29): which kinds of
      // finding, as counts; a label for us, never a message to the customer.
      if (st.mustFix && !st.heldOnce) { st.heldOnce = true; try { st.log({ event: "held", ...(st.mustFixKinds || {}) }); } catch { /* the record never costs the change */ } return { error: "the last check still found something marked FIX THIS: fix it, build, and finish again" }; }
      // NOTHING ELSE CHANGED (2026-10-30, `agent-guard.mjs`): the caller's
      // check of what this change took away that the request did not name,
      // asked ONCE; finishing again is the agent's answer.
      if (typeof deps.review === "function" && !st.reviewed) {
        st.reviewed = true;
        let note = "";
        try { note = String(deps.review({ pages: st.ws.pages(), parts: st.ws.parts(), css: st.ws.css() }) || ""); } catch { note = ""; }
        if (note) { try { st.log({ event: "review" }); } catch { /* never */ } return { error: note }; }
      }
      st.done = true;
      st.summary = typeof input.summary === "string" ? input.summary.slice(0, 4000) : "";
      return { text: "Done." };
    }
    default: return { error: "no such tool: " + String(use.name).slice(0, 40) };
  }
}

const usageOf = (j, model) => {
  const u = (j && j.usage) || {};
  return { in: u.input_tokens || 0, out: u.output_tokens || 0, cacheRead: u.cache_read_input_tokens || 0, cacheWrite: u.cache_creation_input_tokens || 0, model };
};

// ── WHAT EACH ROUND DID, FOR THE LIVE PROGRESS LINES ─────────────────────────
// Facts from the tools' own outcomes (never the model's words); the progress
// writer turns them into the customer's live updates.
const routeFile = (r) => (r === "/" ? "index.tsx" : r.replace(/^\//, "").replace(/\/$/, "") + ".tsx");
export function fileName(k) {
  if (k === CSS_KEY) return "the stylesheet";
  if (k.startsWith("-parts/" + SERVER_PREFIX)) return "the server function \"" + k.slice(7 + SERVER_PREFIX.length) + "\"";
  if (k.startsWith("-parts/")) return "the \"" + k.slice(7) + "\" component";
  const r = k.replace(/\.tsx$/, "").replace(/(^|\/)index$/, "");
  return r ? "the /" + r + " page" : "the home page";
}
const fact = (state, text) => ({ state, text });
const listed = (xs) => (xs.length <= 1 ? xs.join("") : xs.slice(0, -1).join(", ") + " and " + xs[xs.length - 1]);
const SETTING_SAID = { name: "the site's name", description: "the site's description", share: "the link-preview picture", favicon: "the browser-tab icon", wordmark: "the header logo", lang: "the site's language", langs: "the site's extra languages" };
export function roundFacts(outcomes) {
  const out = [];
  const reads = [], wrote = [], gone = [], looked = [], queued = [], ran = [], tried = [];
  for (const { use, r } of Array.isArray(outcomes) ? outcomes : []) {
    if (!use || !r || r.error) continue;
    const i = use.input || {};
    if (use.name === "read_files") reads.push(...(r.reads || []).map(fileName));
    else if (use.name === "write_file") wrote.push(fileName(String(i.file).trim()));
    else if (use.name === "delete_file") gone.push(fileName(String(i.file).trim()));
    else if (use.name === "read_table") looked.push("the " + i.table + " table");
    else if (use.name === "run") ran.push("`" + String(i.command || "").trim().slice(0, 80) + "`");
    else if (use.name === "look") looked.push(fileName(routeFile(String(i.page || "/"))) + " in a browser");
    else if (use.name === "change_rows") queued.push("the " + i.table + " entries");
    else if (use.name === "change_schema") queued.push("the " + i.table + " table's columns");
    else if (use.name === "call_function") tried.push("the server function \"" + String(i.name || "").replace(/^-parts\//, "").replace(/^server-/, "").slice(0, 60) + "\"");
    else if (use.name === "read_errors") looked.push("the site's error log");
    else if (use.name === "list_keys") looked.push("which keys the owner has set");
    else if (use.name === "read_docs" && r.host) looked.push("documentation on " + r.host);
    else if (use.name === "set_table_rules") queued.push("what the " + i.table + " table allows");
    else if (use.name === "set_site_settings" || use.name === "set_logo" || use.name === "set_languages") queued.push(...(r.settings || []).map((k) => SETTING_SAID[k] || "the site's settings"));
    else if (use.name === "rename_page") wrote.push("the page address " + String(i.from).trim() + " (now " + String(i.to).trim() + ")");
    else if (use.name === "make_qr") out.push(fact("prepared", "Made a QR code."));
    else if (use.name === "sort_table") wrote.push("the order of the " + i.table + " list (by " + i.by + ")");
    else if (use.name === "attach_media") looked.push("the owner's file " + String(i.upload || "").split("/").pop().slice(0, 60));
    else if (use.name === "rename_site") queued.push("the site's address (to " + String(i.to || "").trim().slice(0, 63) + ")");
    else if (use.name === "forget_old_address") queued.push("the old address " + String(i.name || "").trim().slice(0, 63));
    else if (use.name === "build") out.push(/^The build passed\.$/.test(r.text) ? fact("applied", "Built the site; it compiled cleanly.") : /^The build passed/.test(r.text) ? fact("doing", "Built the site; its server code failed a test run, fixing it.") : fact("doing", "Built the site; the compiler found errors, fixing them."));
  }
  if (reads.length) out.unshift(fact("prepared", "Read " + listed([...new Set(reads)]) + "."));
  if (looked.length) out.unshift(fact("prepared", "Looked at " + listed([...new Set(looked)]) + "."));
  if (ran.length) out.push(fact("doing", "Ran " + listed(ran) + " in the site's project."));
  if (tried.length) out.push(fact("doing", "Tried " + listed([...new Set(tried)]) + " with a sample request, in a test sandbox."));
  if (wrote.length) out.push(fact("applied", "Wrote " + listed([...new Set(wrote)]) + "."));
  if (gone.length) out.push(fact("applied", "Removed " + listed([...new Set(gone)]) + "."));
  if (queued.length) out.push(fact("prepared", "Lined up changes to " + listed([...new Set(queued)]) + ", saved at the end."));
  return out;
}

/**
 * Run the agent. `deps`: `send(req)` (an Anthropic-shaped answer), `build({
 * pages, parts })` → `{ ok, error, serverTests }`, optional `readTable(name,
 * n)`, `now()`, `log(event)`. Never throws; answers
 * `{ ok, stopped, pages, parts, changed, summary, usage, credits, rounds, builds }`.
 * `ok` is true only when the agent finished on a passing build.
 */
export async function runSiteAgent(deps, { request, pages, parts, css = null, history = "", map = null, spec = null, kind = "", ownParts = false, targets = [], picked = null, attached = [], unread = [], model, maxRounds = AGENT_MAX_ROUNDS, creditCap = AGENT_CREDIT_CAP, maxMs = AGENT_MAX_MS, helpers = false, onlyWrite = "", unreadable = false } = {}) {
  const now = typeof deps.now === "function" ? deps.now : () => Date.now();
  const log = typeof deps.log === "function" ? deps.log : () => {};
  const progress = typeof deps.progress === "function" ? deps.progress : () => {};
  // EVERY ROUND AND EVERY TOOL RESULT IS PROGRESS (2026-10-30): the job's
  // watchdog stops a job only after NO_PROGRESS_MS without any.
  const alive = (what) => { try { noteProgress(what); if (typeof deps.alive === "function") deps.alive(what); } catch { /* never costs the run */ } };
  const started = now();
  const ws = makeWorkspace(pages, parts, css);
  const tables = spec && Array.isArray(spec.tables)
    ? spec.tables.filter((t) => t && typeof t.name === "string" && Array.isArray(t.columns))
      .map((t) => ({ name: t.name, pk: tableKey(t), columns: t.columns.map((c) => (c && typeof c.name === "string" ? c.name : typeof c === "string" ? c : "")).filter(Boolean) }))
    : [];
  const files = (Array.isArray(attached) ? attached : []).filter((f) => f && typeof f.id === "string");
  if (files.length && !onlyWrite) deps = { ...deps, attachment: (id) => files.find((f) => f.id === id) || null };
  const st = { ws, tables, onlyWrite, rows: [], schema: [], dirty: false, built: false, builds: 0, written: new Set(), done: false, summary: "", lastBuild: "", looked: new Set(), log, settings: {}, rules: [], redirects: {}, qrs: 0, ask: null, sorts: [], media: [], address: null, forget: [], keysAsked: [], unreadable: unreadable === true, request: String(request || ""),
    ruleTables: spec && Array.isArray(spec.tables) ? spec.tables.filter((t) => t && typeof t.name === "string") : [] };
  const shown = headStart({ pages, parts, targets, picked });
  const system = [{ type: "text", text: agentSystem(spec, kind, { ownParts }), cache_control: { type: "ephemeral" } }];
  // THE TOOLS OFFERED ARE THE TOOLS WIRED (2026-10-29, the second live build:
  // a first build was offered `look` with nothing behind it, tried it, was told
  // "pages cannot be looked at here", and finished without ever seeing a page).
  // Fixed per caller, so the opening is still the same every round (rule 4).
  const usage = [];
  // HELPERS (2026-10-30, the owner: "run agents in parallel"): offered only
  // when the caller asks (first builds), never to a helper itself. Each helper
  // is this same agent on a copy of the workspace, allowed to write one page;
  // they run at the same time, and their cost joins this run's.
  if (helpers && !onlyWrite) {
    deps = { ...deps, helpers: (tasks, cur) => Promise.all(tasks.map(async (t) => {
      try {
        const left = Math.max(60000, maxMs - (now() - started));
        const r = await runSiteAgent({ send: deps.send, now: deps.now, readTable: deps.readTable, stopped: deps.stopped, alive: deps.alive, affords: deps.affords, beat: deps.beat, log: (e) => log({ ...e, helper: 1 }) }, {
          request: "YOU ARE A HELPER. Another agent is building this site and has handed you ONE page to write: " + t.file + ". Write that page, complete, with write_file, and nothing else (you cannot build; the other agent builds after you). Read the shared files you use first. Then finish with one line on what the page holds.\n\nYOUR PAGE'S BRIEF\n" + t.brief + "\n\nTHE OWNER'S REQUEST FOR THE WHOLE SITE\n" + String(request || ""),
          pages: cur.pages(), parts: cur.parts(), css: cur.css(), map, spec, kind, ownParts, model, maxRounds: HELPER_ROUNDS, maxMs: left, onlyWrite: t.file,
        });
        for (const u of r.usage) usage.push(u);
        const page = r.pages.find((p) => p.path === t.file);
        const wrote = r.changed.includes(t.file) && page ? page.source : "";
        return { file: t.file, source: wrote, summary: r.summary, why: wrote ? "" : r.stopped ? "the helper stopped: " + r.stopped : "the helper wrote nothing" };
      } catch (e) { return { file: t.file, source: "", why: "the helper failed: " + String((e && e.message) || e).slice(0, 120) }; }
    })) };
  }
  const tools = onlyWrite ? toolsFor(deps).filter((t) => t.name !== "build") : toolsFor(deps);
  let messages = [{ role: "user", content: [{ type: "text", text: firstMessage({ request, map, ws, shown, history, tables, ownParts, attached: onlyWrite ? [] : files, unread: onlyWrite ? [] : unread, unreadable: st.unreadable }), cache_control: { type: "ephemeral" } }] }];
  const spent = () => usage.reduce((n, u) => n + pageCost(u), 0) / CREDIT_USD;
  let stopped = "";
  let rounds = 0;
  let lastCost = 0;
  // STOP (2026-10-30, fix-all): the owner's Stop is read at the top of every
  // round and before every batch of tools, and a model call in flight is
  // abandoned (its transport aborted where it takes a signal).
  const halted = async () => {
    if (typeof deps.beat === "function") { try { await deps.beat(); } catch { /* a blink is not a stop */ } }
    try { return typeof deps.stopped === "function" && (await deps.stopped()) === true; } catch { return false; }
  };
  // CREDITS (fix-all): asked before the first round and every
  // CREDIT_CHECK_EVERY rounds whether what this run has spent is covered.
  const covered = async (credits) => {
    if (typeof deps.affords !== "function") return true;
    try { return (await deps.affords(credits)) !== false; } catch { return true; }
  };
  while (!st.done) {
    if (await halted()) { stopped = "cancelled"; break; }
    if (rounds % CREDIT_CHECK_EVERY === 0 && !(await covered(Math.ceil(spent() + lastCost)))) { stopped = "no-credits"; st.paused = true; break; }
    if (rounds >= maxRounds) { stopped = "rounds"; break; }
    if (now() - started > maxMs) { stopped = "time"; break; }
    if (spent() + lastCost > creditCap) { stopped = "credits"; break; }
    { const d = dropSeenShots(messages); if (d.dropped) { messages = d.messages; log({ event: "shots-out", dropped: d.dropped }); } }
    if (pileSize(messages) > COMPACT_AT) {
      // ONLY A SWEEP WORTH ITS REWRITE IS MADE. Clearing rewrites an older
      // round, and every byte after the first rewritten one is read at full
      // price again; clearing a little every round (live, 2026-10-29: rounds
      // 24-26 each cleared 6-8 items) kept the cache from ever holding. So the
      // pile is rewritten only when that saves COMPACT_MIN_SAVE characters, and
      // left byte-for-byte as it was otherwise (tried again next round).
      const before = pileSize(messages);
      const c = compact(messages);
      if (c.cleared && before - pileSize(c.messages) >= COMPACT_MIN_SAVE) {
        messages = c.messages;
        log({ event: "compact", cleared: c.cleared });
      }
    }
    rounds++;
    let j;
    try {
      j = await sendStoppable(deps, { model, max_tokens: AGENT_MAX_TOKENS, system, tools, cacheKey: "site-agent", messages });
    } catch (e) {
      if (e && e.name === "AgentStopped") { stopped = "cancelled"; break; }
      stopped = "send"; log({ event: "send-failed", why: String((e && e.message) || e).slice(0, 200) }); break;
    }
    alive("round");
    const u = usageOf(j, model);
    usage.push(u);
    lastCost = pageCost(u) / CREDIT_USD;
    const content = Array.isArray(j && j.content) ? j.content : [];
    const uses = content.filter((b) => b && b.type === "tool_use");
    log({ event: "round", round: rounds, tools: uses.map((b) => b.name), ...toolCounts(uses), inTok: u.in, cached: u.cacheRead, outTok: u.out, credits: Math.round(spent() * 10) / 10 });
    // AN ANSWER IN PLAIN WORDS IS AN ANSWER (2026-10-29): a question ("What
    // pages does my site have?") was answered in text, without `finish`, and
    // the answer was thrown away as "no-tool". When nothing has been written or
    // changed, the text is the agent's answer; otherwise it stopped mid-work.
    if (!uses.length) {
      const said = content.filter((b) => b && b.type === "text" && typeof b.text === "string").map((b) => b.text.trim()).filter(Boolean).join("\n\n");
      if (said && j && j.stop_reason !== "max_tokens" && !st.written.size && !st.dirty && !st.rows.length && !st.schema.length && !st.rules.length && !st.address && !st.forget.length && !Object.keys(st.settings).length) { st.done = true; st.summary = said.slice(0, 4000); break; }
      stopped = j && j.stop_reason === "max_tokens" ? "too-long" : "no-tool"; break;
    }
    const ids = uses.map((b, i) => (typeof b.id === "string" && b.id ? b.id : "t" + rounds + "_" + i));
    messages.push({ role: "assistant", content: content.map((b) => (b && b.type === "tool_use" ? { ...b, id: ids[uses.indexOf(b)] } : b)) });
    // A STOP WHILE THE MODEL ANSWERED: its tools are not run.
    if (await halted()) { stopped = "cancelled"; break; }
    const results = [];
    const outcomes = [];
    const images = [];
    for (let i = 0; i < uses.length; i++) {
      const r = await runTool(uses[i], st, deps);
      alive("tool");
      const block = { type: "tool_result", tool_use_id: ids[i], content: r.error ? r.error : r.text };
      if (r.error) block.is_error = true;
      if (r.reads) Object.defineProperty(block, "reads", { value: r.reads, enumerable: false });
      results.push(block);
      outcomes.push({ use: uses[i], r });
      for (const im of Array.isArray(r.images) ? r.images : []) {
        images.push({ type: "text", text: "SCREENSHOT: " + im.label });
        images.push({ type: "image", source: { type: "base64", media_type: im.media_type || "image/png", data: im.png } });
      }
    }
    messages.push({ role: "user", content: [...results, ...images] });
    try { const f = roundFacts(outcomes.splice(0)); if (f.length) progress("agent", f); } catch { /* the record never costs the change */ }
  }

  const credits = usage.length ? Math.max(1, Math.ceil(spent())) : 0;
  return {
    ok: st.done && (onlyWrite || !!st.ask ? true : !st.dirty && (st.built || !st.written.size)),
    stopped: st.done ? "" : stopped,
    pages: ws.pages(), parts: ws.parts(),
    css: ws.css(), cssChanged: ws.cssChanged(),
    changed: ws.changed(), removed: ws.removed(),
    rows: st.rows,
    schema: st.schema,
    // THE OLD STEPS' QUEUED SAVES (2026-10-30): saved by the caller with the files.
    settings: st.ask ? {} : { ...st.settings }, rules: st.ask ? [] : st.rules.slice(), redirects: st.ask ? {} : { ...st.redirects },
    ask: st.ask,
    // THE ROUTER-ERA STEPS (fix-all): orders applied, media placed, the address.
    sorts: st.sorts.slice(), media: st.media.slice(), address: st.ask ? null : st.address, forget: st.ask ? [] : st.forget.slice(),
    keysAsked: st.keysAsked.slice(),
    paused: st.paused === true,
    looked: [...st.looked],
    summary: st.summary,
    lastBuild: st.lastBuild,
    usage, credits, rounds, builds: st.builds,
  };
}

/**
 * ONE MODEL CALL THAT A STOP CAN END (2026-10-30, fix-all). The transport is
 * handed an AbortSignal as its second argument (one that takes it aborts the
 * request); whichever transport, the call is abandoned when `deps.stopped()`
 * turns true, read every `STOP_POLL_MS`. Throws `AgentStopped` then.
 */
export const STOP_POLL_MS = 1000;
export function sendStoppable(deps, req) {
  if (typeof deps.stopped !== "function") return deps.send(req);
  const ac = typeof AbortController === "function" ? new AbortController() : null;
  let timer = null;
  const stop = new Promise((_, reject) => {
    timer = setInterval(() => {
      Promise.resolve().then(() => deps.stopped()).then((s) => {
        if (s !== true) return;
        try { if (ac) ac.abort(); } catch { /* never */ }
        const e = new Error("stopped by the owner"); e.name = "AgentStopped"; reject(e);
      }).catch(() => { /* a read that fails is not a stop */ });
    }, STOP_POLL_MS);
  });
  return Promise.race([Promise.resolve().then(() => deps.send(req, ac ? { signal: ac.signal } : undefined)), stop]).finally(() => clearInterval(timer));
}

/** The agent takes every site's edit and addition whole (2026-10-28, the owner: no switch). */
export const AGENT_TAKES_ALL = true;

/**
 * Whether it takes this request: always, except under the unit suite's
 * `GF_OLD_LANES=1` (package.json's test script), which keeps the older
 * steps' tests running against the save, draft and publish code they share
 * with the agent. Never a deploy setting: a Worker has no such variable.
 */
export function agentTakes() {
  const p = globalThis.process;
  return !(AGENT_TAKES_ALL !== true || (p && p.env && p.env.GF_OLD_LANES === "1"));
}


/** What the reply writer is told when the agent stopped short: facts, never a sentence for the customer. */
export function stoppedFacts(r) {
  const why = {
    rounds: "it reached its limit of steps before finishing",
    credits: "it reached its spending limit before finishing",
    "no-credits": "the account ran out of credits before it finished",
    time: "it ran out of time before finishing",
    send: "the AI model could not be reached",
    "no-tool": "the model stopped answering with actions",
    "too-long": "the model's answer was cut off for length",
    cancelled: "the owner stopped it",
  }[r && r.stopped] || "it did not finish";
  return "The site agent stopped: " + why + ". Nothing on the site was changed" +
    (r && r.lastBuild === "fail" ? "; its last build had errors" : "") + ".";
}

/** The conversation's recent messages, as the agent's first message carries them. */
export function historyText(msgs, { max = 12, chars = 600 } = {}) {
  const list = (Array.isArray(msgs) ? msgs : []).filter((m) => m && (m.r === "u" || m.r === "a") && typeof m.t === "string" && m.t.trim());
  return list.slice(-max).map((m) => (m.r === "u" ? "Owner: " : "You: ") + (m.t.length > chars ? m.t.slice(0, chars - 1) + "…" : m.t).replace(/\s+/g, " ").trim()).join("\n");
}

/** Several rounds on one model as ONE usage object (one bill, one rounding). */
export function sumUsage(usage, model) {
  const u = { in: 0, out: 0, cacheRead: 0, cacheWrite: 0, model };
  for (const x of Array.isArray(usage) ? usage : []) { u.in += x.in || 0; u.out += x.out || 0; u.cacheRead += x.cacheRead || 0; u.cacheWrite += x.cacheWrite || 0; }
  return u;
}

/**
 * A FIRST BUILD (or a rebuild) BY THE AGENT, in the page writer's place
 * (2026-10-28): the agent's finished workspace as the writer's tool answer
 * (`write_pages`: pages under src/routes/, parts, server code, notes), so the
 * build's own validation, compile, salvage, photographs, publish and bill
 * run on it unchanged. A stop is no answer: the build's own no-pages path.
 */
export function asWriterAnswer(r, model) {
  const usage = sumUsage(r && r.usage, model);
  if (!r || r.ok !== true || !r.pages.length) return { input: null, usage, agent: r ? { stopped: r.stopped, rounds: r.rounds } : null };
  const server = r.parts.filter((p) => p.name.startsWith(SERVER_PREFIX)).map((p) => ({ name: p.name.slice(SERVER_PREFIX.length), source: p.source }));
  const parts = r.parts.filter((p) => !p.name.startsWith(SERVER_PREFIX));
  return {
    input: {
      pages: r.pages.map((p) => ({ path: "src/routes/" + p.path, source: p.source })),
      ...(parts.length ? { parts } : {}),
      ...(server.length ? { server } : {}),
      notes: r.summary || "",
    },
    usage,
    agent: { rounds: r.rounds, builds: r.builds, looked: Array.isArray(r.looked) ? r.looked : [], keysAsked: Array.isArray(r.keysAsked) ? r.keysAsked : [] },
  };
}
