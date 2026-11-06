# Go Farther for iPhone and Android

The phone app (owner, 2026-11-06). Like the desktop app, it is gofarther.dev in
its own app (Capacitor), so every feature built on the site is in the app at
once. The page knows it is in the app (its browser name ends in
`GoFartherApp/…`): it hides the "Download for Mac / Windows" buttons, opens
links to other sites in the app's own browser sheet (Safari / Chrome on top),
and keeps GitHub's sign-in pages inside so Connect GitHub comes back to the app.
It keeps clear of the status bar and the home bar.

| Path | What it is |
|---|---|
| `capacitor.config.json` | The app: its name and ID (`dev.gofarther.app`), the site it opens, GitHub's sign-in allowed inside, the offline page |
| `www/` | The offline page ("Can't reach Go Farther") |
| `android/`, `ios/` | The Android and iPhone projects (GF icons, splash screens) |
| `test/` | `npm test` |

After changing `capacitor.config.json` or the plugins: `npm install`, then
`npx cap sync`.

Build it: the **build phone apps** button in GitHub Actions (free: the
repository is public). Android: `GoFarther-android.apk`, which installs on an
Android phone directly. iPhone: built for the simulator to check it compiles;
a real iPhone (TestFlight) needs the owner's Apple certificates as GitHub
secrets.
