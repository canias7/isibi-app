// Coder's look, screen by screen like Claude Code (the owner, 2026-11-15, with Claude Code screenshots).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = (f) => readFileSync(new URL("../public/" + f, import.meta.url), "utf8");

test("LK1 /permissions opens the mode menu (Claude Code's way), nothing is sent; Coder's mode menu has no rules line; the rules are in the gear menu", () => {
  const ui = read("coder.js"), html = read("index.html"), app = read("app.js");
  assert.match(ui, /if \(!GLOOPY && \/\^\\\/permissions\$\/i\.test\(text\)\) \{[^\n]*S\.modeMenu = true; draw\(\); return; \}/);
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
  assert.match(ui, /if \(!GLOOPY && \/\^\\\/rewind\$\/i\.test\(text\)\) \{[^\n]*rewindPicker\(\); return; \}/);
  assert.match(ui, /'<div class="cd-user">' \+ \(mark && !GLOOPY && S\.rewindPick \? /);
  assert.doesNotMatch(ui, /S\.rewindPick = (true|!S\.rewindPick)/, "the links never come back");
  assert.match(ui, /await askPick\('Rewind', 'Restore the session to an earlier message\.', list\.reverse\(\)\);\n    if \(pick\) rewind\(Number\(pick\)\);/);
});

test("LK5 typing / lists Coder's commands (Claude Code's list): /compact, /permissions, /rewind with a line each; ↑↓, Enter or Tab, a click, Esc", () => {
  const ui = read("coder.js");
  assert.match(ui, /const SLASH = \[\['\/compact', [^\]]+\], \['\/permissions', [^\]]+\], \['\/rewind', [^\]]+\]\];/);
  assert.match(ui, /bgHTML\(\) \+ slashHTML\(\) \+ mentionHTML\(\) \+/);
  assert.match(ui, /if \(sl\.length && \(e\.key === 'Enter' \|\| e\.key === 'Tab'\)[^\n]*pickSlash\(/);
  assert.match(ui, /if \(sl\.length && e\.key === 'Escape'\) \{ S\.slashOff = true;/);
  assert.match(ui, /on\('\[data-slash\]', 'mousedown', \(e\) => \{ e\.preventDefault\(\); pickSlash\(e\.currentTarget\.dataset\.slash\); \}\);/);
});
