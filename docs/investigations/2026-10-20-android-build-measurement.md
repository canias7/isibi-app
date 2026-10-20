# Can our containers build Android apps? Measured (2026-10-20)

Owner: "for Android, can we use the containers that we have?" Measured in this session's Linux machine (4 CPUs, 15 GB), not in a Cloudflare container. No credits spent.

**What was built:** the live site `fold-lane-bakery` (home, `/visit` and `/order`, 5.9 MB downloaded from its address), wrapped with Capacitor 8.5 into an Android debug app. Package `com.gofarther.foldlanebakery`, label "Fold Lane Bakery", min SDK 24, target SDK 36. **Result: `app-debug.apk`, 9.7 MB**, with the site's pages inside (`assets/public/index.html`).

| Measure | Value |
|---|---|
| Android SDK (platform-tools, platform 36, build-tools 36) | 13 s to install, 594 MB |
| Gradle caches after the first build (Gradle 8.14.3 and the libraries) | 1.1 GB |
| The project (site, Capacitor packages, Android project, build output) | 85 MB |
| Java on the image already (OpenJDK 21) | about 300 MB in a slim image (estimate) |
| **Peak memory of the build** (all Java processes, sampled each second) | **1.1–1.3 GB** (Gradle capped at 1.5 GB by Capacitor's default) |
| First build, cold (every library downloaded) | about 2.5 min of downloading; finished after retries, see below |
| Full rebuild with libraries already downloaded, 4 CPUs | **25 s** |
| Same, limited to **1 CPU** | **62 s** |

**The cold build hit HTTP 429 from Maven Central** several times. That is this session's shared proxy being rate-limited, and it finished on a later retry. A container would download from its own address, but the right design keeps the libraries in the image so a build downloads nothing.

**What it means for our containers:**
- **Memory fits.** 1.3 GB peak against `standard-1`'s 4 GB (Cloudflare's figure, from memory).
- **CPU:** `standard-1` is half a CPU. At 62 s on one CPU, expect roughly 2 minutes a build; slower, but inside the 50-minute job deadline.
- **Disk is the tight part.** The tools and caches add about 2 GB to the image (SDK 0.6 GB, Gradle caches 1.1 GB, Java about 0.3 GB), on top of today's image.

**Recommendation:** a separate `AppBuildContainer` class with its own image that carries Java, the SDK and a pre-warmed Gradle cache, so builds are offline and about 1–2 minutes. `standard-1` is enough by memory; a bigger size only buys speed. The website container stays untouched.

**Not covered yet:**
- A signed release build (the AAB file the Play Store takes; it needs a signing key per app).
- Running the app on a device or emulator.
- Native features (notifications, camera).
- Whether the site's links and its data calls behave inside the app's web view.
