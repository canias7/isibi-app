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
