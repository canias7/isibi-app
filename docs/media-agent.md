# Media Agent — tool permissions, rate limits & engine caps

Reference for the Instagram/YouTube Media Agent (Composio integration). When the
user asks "what's allowed / what are the rate limits / how does the auto-reply
throttle," pull the answer from here. Figures dated 2026-07-11.

## YouTube tools — verified working (live sweep 2026-07-11)

Read tools tested live against a connected channel ("Cristian Anias", 11 subs /
20 videos / 7,029 views). **All 6 reads PASS** — no permission walls:

| Composio action | Args | Status | Returns |
|---|---|---|---|
| `YOUTUBE_LIST_CHANNELS` | `{mine:true}` | ✅ | channel id, `@handle`, title, thumbnails, `contentDetails.relatedPlaylists.uploads` |
| `YOUTUBE_GET_CHANNEL_STATISTICS` | `{mine:true}` | ✅ | `subscriberCount`, `videoCount`, `viewCount` (under `channels[0].statistics` / `items[0].statistics`) |
| `YOUTUBE_LIST_CHANNEL_VIDEOS` | `{mine:true, maxResults:N}` | ✅ | `items[]` = playlistItems; `snippet` has title/thumbnails/publishedAt/channelTitle; videoId is in `snippet.resourceId.videoId` |
| `YOUTUBE_LIST_USER_PLAYLISTS` | `{}` | ✅ | `items[]` playlists with `snippet` |
| `YOUTUBE_LIST_USER_SUBSCRIPTIONS` | `{mine:true, maxResults:N}` | ✅ | `items[]` subs with `snippet` + `contentDetails` |
| `YOUTUBE_SEARCH_YOU_TUBE` | `{q, maxResults:N}` | ✅ | `items[]` with `id.videoId`, `snippet` |

Write tools — **verified live 2026-07-11** (private test upload, then deleted):
| Action | Args | Status |
|---|---|---|
| `YOUTUBE_UPLOAD_VIDEO` | via `socialPublish`: `composioUploadFile` → `{title, description, tags, categoryId, privacyStatus, videoFilePath}` | ✅ **works** (powers the Videos-tab "+" publish) |
| `YOUTUBE_DELETE_VIDEO` | `{videoId, confirmDelete:true}` | ✅ works |
| `YOUTUBE_GET_VIDEO_DETAILS_BATCH` | `{id:"id1,id2"}` | ❌ returns empty for valid owned video ids — **NOT an arg issue** (probed single/array/comma/`+part`; `id` is the correct param, `ids`/`video_id` 400). Composio-side limitation. **Videos tab falls back to upload dates instead of view counts.** Would need a different stats source to enable per-video views. |

Comment write tools (tested only in the earlier session `01P5kAxfLkGCXosjH3No4CBN`,
PRs #274/#275 — not re-verified, no UI uses them yet): `YOUTUBE_POST_COMMENT`
(`{videoId, channelId, textOriginal}`), `YOUTUBE_CREATE_COMMENT_REPLY`
(`{parentId, textOriginal}`), `YOUTUBE_UPDATE_COMMENT`, `YOUTUBE_DELETE_COMMENT`,
`YOUTUBE_LIST_PLAYLIST_IMAGES` (arg is `parent`, NOT `playlistId`).

No YouTube frontend built yet — the YouTube tile shows a "coming soon" placeholder.
Reads above are the basis for a future Analytics / Videos / Playlists workspace.

## What the connected Instagram tool is ALLOWED to do

Verified live on the test account (`el_torturador999`):

| Capability | Composio action | Status |
|---|---|---|
| Read profile / followers | `INSTAGRAM_GET_USER_INFO` | ✅ works |
| Read analytics / insights | `INSTAGRAM_GET_USER_INSIGHTS` | ✅ works |
| List posts | `INSTAGRAM_GET_IG_USER_MEDIA` | ✅ works |
| Read comments | `INSTAGRAM_GET_IG_MEDIA_COMMENTS` | ✅ works |
| **Reply to comments** | `INSTAGRAM_POST_IG_COMMENT_REPLIES` | ✅ works (verified) |
| Read DM threads/messages | `INSTAGRAM_LIST_ALL_CONVERSATIONS` / `..._MESSAGES` | ✅ read works |
| **Send a DM** | `INSTAGRAM_SEND_TEXT_MESSAGE` | ❌ **blocked** — 403 "outside allowed window" (subcode 2534022) |

Permission scopes the connected (Composio) Meta app holds:
- ✅ `instagram_basic` — profile/media reads
- ✅ `instagram_manage_insights` — analytics
- ✅ `instagram_manage_comments` — read + reply to comments (why comment auto-reply works)
- ⛔ `instagram_manage_messages` — DM send; needs Meta **App Review / Advanced Access**, not granted. Not fixable in code.

Untested writes (don't claim they work): `INSTAGRAM_POST_IG_MEDIA_COMMENTS`
(comment on a post — likely OK, same scope), publishing posts
(`instagram_content_publish` — separate scope, probably needs App Review).

## Instagram Graph API rate limits (2026)

| Limit | Value | Applies to |
|---|---|---|
| Base platform | **200 calls / hour / account** | every call (reads + writes), failed calls count |
| Business Use Case (BUC) | **4,800 × impressions (last 24h)** per 24h | scales w/ reach — 1k impressions → 4.8M calls; 10 → 48 |
| DM sending | 200 automated DMs / hour / account | (moot — sending blocked) |
| **Comment replies** | **~750 / hour / account** | our comment auto-reply |
| Publishing posts | 25 / 24h / account | reels + stories count too |

- Window is **rolling hourly**; resets hourly.
- Monitor headers: `X-App-Usage`, `X-Business-Use-Case-Usage`.
- Composio (middleware) has its own plan-based execution limits — the ceiling to
  watch if this scales to many users.

## Our engine's self-imposed caps (in worker.js)

- Cron: **every 2 minutes** (`wrangler.jsonc` → `*/2 * * * *`).
- **5 replies per run, per account, per channel** (`budget = 5` in
  `runAutoReplyDm` / `runAutoReplyComment`).
- Scans **8 most recent posts**; DM path scans up to 10 conversations.
- Freshness window: comments **2 days**, DMs **24h** (`autoreplyWithinDays`).
- Each comment/message replied to **once ever** — dedup via `autoreply_log`.
- Allowlist-scoped while testing (`AUTOREPLY_ALLOW`) — empty it to open to all users.

## Cost

- One Haiku (`claude-haiku-4-5`) draft per reply, ≤300 output tokens ≈ **$0.002/reply**.
- **$0 when idle** — event-driven; nothing runs with no new comments.

## ⚠️ Scaling concern (call volume)

The 2-min cron is read-heavy. Per cycle: comments path ≈ 15 calls (1 profile + 1
media + up to 8 comment-fetches + up to 5 replies); DM path ≈ 12 calls. Combined
≈ 27 calls/cycle × 30 cycles/hr ≈ **~800 calls/hour** — over the **200/hr base
limit**. Fine on a professional account (BUC ceiling scales with impressions) and
we fail-open, but it **will bite on a low-impression account or if opened to all
users**. Before flipping `AUTOREPLY_ALLOW` off: poll less often, cache the media
list, and/or only re-scan posts with recent activity.

Note: DM auto-reply left ON just burns ~12 read calls/cycle for sends it can never
make — turn `dm_enabled` off per account until messaging permission is sorted.
