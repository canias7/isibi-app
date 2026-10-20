# What the app keeps in the browser (2026-10-20)

Owner: "nothing can be local, it needs to be seen from every device, so server side stuff."
Audit of every `localStorage`, `sessionStorage` and IndexedDB use in `public/*.js`.

## Must move to the server (another device sees none of it today)

| Key / store | File | What it holds |
|---|---|---|
| `zephyr_sites_v1` (`SITES_KEY`) | chat.js | Per site: **the whole chat** (`msgs`, last 40), the builder's questions and answers (`clarify`), job cards, page names and cached markup (first 6), version-history labels, held replies. The site list itself is merged with the server's (`site-list.js`), but everything inside a site's chat is local only. |
| `gf.edit.watch.v1` | edit-poll.js | Which running edit jobs this page is following (job id, layer, page), used to pick a job back up after a reload. |
| `gf-ask-files` (IndexedDB) | chat.js | Files attached to a message waiting on the builder's question, kept 24 h so the answer can resend them. |
| `gf-media-uploads` | chat.js | Records of hosted video/audio uploads in progress, used to resume or clean them up. |
| `zephyr_agents_v1` | chat.js | The agent builder's agents (a separate product; listed for completeness). |

## Account/plan values that the server already owns (the local copy is a cache or a guess)

| Key | What it holds |
|---|---|
| `zephyr_cred_max_v1` | The highest balance this browser has seen, used to draw the credit gauge's "full" mark. |
| `zephyr_offer_end_v1` | When a promotional offer countdown ends. |
| `zephyr_welcome_v1` | Whether the free-credits welcome was shown. |

## Preferences (per-device by nature, but should follow the account)

| Key | What it holds |
|---|---|
| `zephyr_build_picker_v1` | Builder model choice. |
| `zephyr_build_effort_v2` | Effort choice. |
| `zephyr_view_v1` | Which screen was open (start, site, …). |
| `zephyr_side_v1` | Sidebar open or closed. |

## Must stay in the browser

| Key | Why |
|---|---|
| `zephyr_session_v1` (`SESSION_KEY`, auth.js, confirm.js) | The sign-in session itself; every app keeps this on the device. |
| `zephyr_owner_v1` | Which account this browser's local copy belongs to, so one person's cached data is never shown to the next person who signs in. Goes away once nothing account-specific is cached locally. |

## Already on the server

The sites themselves (pages, code, design, published versions, database), each job's progress record and final reply (per job, kept for a limited time), build results, credits and the ledger, the "a build is running in this chat" marker.
