# 2026-10-23 — Slash commands in the site builder's chat (`slash-commands`, not merged, not deployed)

The owner asked for a "/" menu in the project chat like Claude's, with one
registry so more commands can be added, and **/sentinel** as the first: the
existing deep security scan, with its price shown before anything is spent.

## What changed

- `public/chat.js`, one block between `// ── SLASH COMMANDS BEGIN` and
  `// ── SLASH COMMANDS END ──`, placed above `wireSiteComposer`:
  - **`SLASH_COMMANDS`**: the registry, one array of `{ name, desc, run(site) }`.
    A new command is a new entry.
  - The menu (`#stSlash`, above `#stRevise` inside `.st-comp`) opens only when
    the box's text starts with "/" and has no space yet (`slashQuery`); typing
    filters by prefix; ArrowUp/ArrowDown move (wrapping), Enter or Tab pick, a
    click picks (mousedown, so the box keeps focus), Esc closes and the menu
    stays shut until the text changes.
  - **A message starting with "/word" is never sent as an edit**
    (`slashSend`, asked by the Send button before `siteSend`): a known command
    runs; an unknown one stays in the box and the menu opens saying
    "No command matches /word". Enter on no match sends nothing.
  - **/sentinel** (`siteSentinel`): reads the panel's own free price
    (`GET …/security?estimate=1&picker=…`, the same expression as
    `loadSiteSecurity`), then shows a card whose button carries the panel
    button's own label ("Scan · about N credits") and "Not now". **Nothing is
    spent until the button is pressed.** The press (`siteSentinelGo`) calls
    **`siteSecurityDeep`**, the same handler the More → Security "Run deep
    scan" button and the router's `security` answer call; a second or
    simultaneous press does not scan again; "Not now" spends nothing.
  - The report sentence the router's `security` path said is now one function,
    `siteSecuritySay(rep)`, used by both that path and /sentinel (no drift).
- `public/styles.css`: `.st-comp` is `position: relative`; `.st-slash*` rules
  for the menu (theme tokens only).
- The quick check, the panel's buttons and the router's `security` intent are
  unchanged in behaviour.

## Tests

`test/slash-commands.test.mjs`, 10 cases: the block runs in a `vm` against
stubs (no network, no model); the wiring is read from source.
Registry shape; "/" only at the very start; filtering and the no-match line;
arrows, Enter, Esc (and Esc stays shut until the text changes); Enter on no
match and an unknown command are held, never sent; the composer asks
`slashSend` before `siteSend`; /sentinel reads only the free price and never
calls the scan before the press; "Not now" and a declined card cannot spend;
the press calls the handler once (also on two simultaneous presses) and says
`siteSecuritySay`'s report; a failed price read offers nothing to press; the
drift guard (the panel button, the router and /sentinel share
`siteSecurityDeep`, `siteSecuritySay` and the price read; the block never
posts a scan of its own).

- **Red on old code**: on `origin/main`'s `chat.js` the file fails.
- **Sweep**: 11 mutants, 11 killed; the comment-only control survived
  (menu anywhere, no filter, Esc kept open, arrows stuck, unknown sent, Enter
  no-match falling through, scan before confirm, another spending path, double
  press, composer skipping `slashSend`, router report drift). Restored from a
  saved copy, byte-compared.
- `test/site-security.test.mjs` still passes.

## Screenshots (stub price of 4 credits; real `styles.css`, real menu code)

`1-menu-open.png`, `2-filtered-sen.png`, `3-confirm.png` in the session's
scratchpad `shots-slash/`.

## Open, kept separate

- **Fixed sentences** (the owner's model-written rule): /sentinel's three short
  lines ("no site to scan yet", "couldn't get the price", "no scan, nothing
  charged") and the existing report sentence in `siteSecuritySay` are fixed
  text. The client has no general writer route to call; writing them by model
  needs a server route, outside this change.
- **The router's `security` intent still starts the paid scan with no price
  step** (pre-existing, phase D). /sentinel shows the price first; the router
  path was left as it was.

## Verification after the hand-over (second helper, same day)

- The first helper's uncommitted work was carried over unchanged and re-checked.
- Red on old code: `origin/main`'s `chat.js` gives `test/slash-commands.test.mjs` 10 of 10 failing.
- Re-sweep (4 mutants: menu anywhere, unknown sent, Esc kept open, double
  press): 4 of 4 killed; the comment-only control survived; restored from a
  saved copy, byte-compared.
- Affected files (`slash-commands`, `site-security`, `site-entry-inventory`): 87 / 87 / 0.
- Full suite: `12314` tests, `12309` pass, `2` fail, `3` skipped. The fails are
  the known no-generated-deps symlink case (`a node_modules of any form is
  ignored`) and `media-verify`'s browser-mode case, which reads neither
  `chat.js` nor `styles.css` and also fails alone in this worktree
  (environmental: the real Chromium media run), so it is not this change.
