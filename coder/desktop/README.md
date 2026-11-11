# Go Farther for Mac and Windows

The desktop app (owner, 2026-11-06). Like Claude's desktop app, it is
gofarther.dev in its own window, so every feature built on the site is in the
app at once. On top: its own icon and window, a menu with the usual shortcuts
(copy and paste on a Mac need it), one window only, links to other sites open in
the browser, GitHub's sign-in pages stay inside (Connect GitHub must come back
to the app), a small "Can't reach Go Farther" page when offline. The page hides
its "Download for Mac / Windows" buttons inside the app.

| File | What it is |
|---|---|
| `main.js` | The app: window, menu, link rules, permissions (only notifications and copying) |
| `links.js` | Which addresses stay in the app; which may open in the browser |
| `offline.html` | The page shown when there is no internet |
| `route.js` | Gloopy's browser through this computer (2026-11-11): the link to Gloopy's computer, each connection opened from here, never to a private or VPN address |
| `preload.js` | What the page may ask of the app: only the link's start, stop, nudge and status (for gofarther.dev's own pages) |
| `build/icon.png` | The GF icon (the Mac and Windows icons are made from it) |
| `test/` | `npm test` |

Run it here: `npm install`, then `npm start`. To try it against the test copy:
`GOFARTHER_HOME=https://test.gofarther.dev/ npm start` (only a gofarther.dev address is taken).

Build it: the **build desktop apps** button in GitHub Actions makes
`GoFarther-mac.dmg` and `GoFarther-windows.exe` on GitHub's Mac and Windows
machines (free: the repository is public). Tick "publish" to put them in a
public release for the front page's Download buttons.

Not signed yet: that needs the Apple Developer Program ($99 a year) and,
optionally, a Windows code-signing certificate. Until then the Mac asks once in
System Settings → Privacy & Security → "Open Anyway", and Windows shows
"Windows protected your PC" → More info → Run anyway.
