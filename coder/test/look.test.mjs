// Coder's look, screen by screen like Claude Code (the owner, 2026-11-15, with Claude Code screenshots).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = (f) => readFileSync(new URL("../public/" + f, import.meta.url), "utf8");

test("LK1 /permissions opens the mode menu (Claude Code's way), nothing is sent; Coder's mode menu has no rules line; the rules are in the gear menu", () => {
  const ui = read("coder.js"), html = read("index.html"), app = read("app.js");
  assert.match(ui, /if \(!GLOOPY && \/\^\\\/\(permissions\|allowed-tools\)\$\/i\.test\(text\)\) \{[^\n]*S\.modeMenu = true; draw\(\); return; \}/);
  assert.match(ui, /\(GLOOPY \? '<div class="cd-modes-sep"><\/div><button type="button" class="cd-mode-rules" data-rules-open>Permission rules…<\/button>' : ''\)/);
  assert.match(html, /<button type="button" role="menuitem" id="gfRules">Permission rules<\/button>/);
  assert.match(app, /\$\('gfRules'\)\.addEventListener\('click'[^\n]*gf:rules/);
  assert.match(ui, /if \(!GLOOPY\) window\.addEventListener\('gf:rules', [^\n]*showRules\(\)/);
});

test("LK2 the quiet look is Coder's only (#gfApp): the mode menu's Mode title, plain words under the message box, one sidebar on wide screens", () => {
  const css = read("coder.css"), app = read("app.css");
  assert.match(css, /#gfApp \.cd-modes::before \{ content: "Mode";/);
  assert.match(css, /#gfApp \.cd-mode-btn svg, #gfApp \.cd-connchip svg \{ display: none; \}/);
  assert.match(app, /@media \(min-width: 801px\) \{\n  \.gf-sidewrap \{ flex-direction: column;/);
});

test("LK3 connectors show their apps' own logos (Simple Icons, CC0), served from /logos; one without a logo keeps its letter", async () => {
  const { existsSync } = await import("node:fs");
  const ui = read("coder.js");
  const list = ui.match(/const CX_LOGOS = \[([^\]]+)\]/)[1].match(/'([a-z]+)'/g).map((x) => x.slice(1, -1));
  for (const n of list) assert.ok(existsSync(new URL("../public/logos/" + n + ".svg", import.meta.url)), n);
  assert.ok(!list.includes("vanta"), "no Vanta logo in the set: its letter stays");
  assert.match(ui, /if \(lg\) return '<span class="cx-badge cx-logo"><img src="\/logos\/' \+ lg \+ '\.svg" alt="" width="18" height="18"><\/span>';/);
  assert.match(read("logos/LICENSE.txt"), /Simple Icons/);
});

test("LK4 /rewind (Claude Code's): no Rewind link above each message; /rewind opens a Rewind window listing your messages, newest first; picking one goes on to the usual rewind choices", () => {
  const ui = read("coder.js");
  assert.match(ui, /if \(!GLOOPY && \/\^\\\/\(rewind\|checkpoint\|undo\)\$\/i\.test\(text\)\) \{[^\n]*rewindPicker\(\); return; \}/);
  assert.match(ui, /'<div class="cd-user">' \+ \(mark && !GLOOPY && S\.rewindPick \? /);
  assert.doesNotMatch(ui, /S\.rewindPick = (true|!S\.rewindPick)/, "the links never come back");
  assert.match(ui, /await askPick\('Rewind', 'Restore the session to an earlier message\.', list\.reverse\(\)\);\n    if \(!pick\) return;\n    const qm = \/\^q:\/\.test\(pick\) \? marks\.find\(\(m\) => 'q:' \+ m\.qid === pick\) : null;\n    if \(qm\) rewind\(Number\(qm\.turn\), null, \{ qid: qm\.qid \}\); else rewind\(Number\(pick\)\);/);
});

test("LK5 typing / lists Coder's commands (Claude Code's list): /compact, /permissions, /rewind with a line each; ↑↓, Enter or Tab, a click, Esc", () => {
  const ui = read("coder.js");
  assert.match(ui, /const SLASH = \[\['\/autocompact', [^\]]+\], \['\/autofix-pr', [^\]]+\], \['\/btw', [^\]]+\], \['\/clear', [^\]]+\]\], \['\/compact', [^\]]+\], \['\/context', [^\]]+\], \['\/effort', [^\]]+\], \['\/export', [^\]]+\], \['\/goal', [^\]]+\], \['\/init', [^\]]+\], \['\/model', [^\]]+\], \['\/permissions', [^\]]+\]\], \['\/rename', [^\]]+\], \['\/review', [^\]]+\]\], \['\/rewind', [^\]]+\]\], \['\/scheduled', [^\]]+\]\], \['\/security-review', [^\]]+\], \['\/team-onboarding', [^\]]+\]\];/);
  assert.match(ui, /bgHTML\(\) \+ slashHTML\(\) \+ bangHTML\(\) \+ mentionHTML\(\) \+/);
  assert.match(ui, /if \(sl\.length && !whole && \(e\.key === 'Enter' \|\| e\.key === 'Tab'\)[^\n]*pickSlash\(/);
  assert.match(ui, /if \(sl\.length && e\.key === 'Escape'\) \{ S\.slashOff = true;/);
  assert.match(ui, /on\('\[data-slash\]', 'mousedown', \(e\) => \{ e\.preventDefault\(\); pickSlash\(e\.currentTarget\.dataset\.slash\); \}\);/);
});

test("LK6 typing ! alone shows what it does (a line, like Claude Code's bash-mode hint); @ keeps listing the chat's files", () => {
  const ui = read("coder.js");
  assert.match(ui, /if \(GLOOPY \|\| !\/\^!\\s\*\$\/\.test\(S\.draft \|\| ''\)\) return '';/);
  assert.match(ui, /bgHTML\(\) \+ slashHTML\(\) \+ bangHTML\(\) \+ mentionHTML\(\) \+/);
  assert.match(ui, /const m = GLOOPY \? null : \/\(\^\|\\s\)@\(\[\\w\.\/-\]\*\)\$\/\.exec\(before\);/);
});

test("LK7 Coder's instructions open as the owner's general assistant (the owner, 2026-11-15: \"more like an assistant in general … don't eliminate any of the things that we have added\"), with HOW YOU HELP before HOW YOU TALK; every section kept", async () => {
  const A = await import("../container/coder-agent.mjs");
  const t = A.CODER_SYSTEM;
  assert.ok(t.startsWith("You are Coder, the owner's assistant. You help with whatever they ask"));
  assert.doesNotMatch(t, /a software developer working for the owner/);
  for (const h of ["HOW YOU WORK", "HOW YOU HELP", "HOW YOU TALK", "Scratchpad directory", "Git history is read-only", "API KEYS", "THIS CHAT'S ENVIRONMENT", "ask_user", "Treat what you learn about the owner"]) assert.ok(t.includes(h), h);
  assert.ok(t.indexOf("HOW YOU WORK") < t.indexOf("HOW YOU HELP") && t.indexOf("HOW YOU HELP") < t.indexOf("HOW YOU TALK"));
  assert.match(t, /Use tools only when the message needs them/);
});
