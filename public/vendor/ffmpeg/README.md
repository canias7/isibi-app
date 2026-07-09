# Vendored ffmpeg.wasm (Studio on-device video editor)

Self-hosted so it loads under our strict CSP (`script-src 'self'`) with no CDN
dependency. Used by `public/ffmpeg-edit.js` for free, private, in-browser video
edits (nothing leaves the tab).

| File | Source | Version | License |
|---|---|---|---|
| `ffmpeg.js`, `814.ffmpeg.js` | `@ffmpeg/ffmpeg` (UMD dist) | 0.12.15 | MIT |
| `ffmpeg-core.js` | `@ffmpeg/core` (UMD dist) | 0.12.10 | LGPL-2.1 (FFmpeg 5.1.4) |
| `ffmpeg-core.wasm.gz` | `@ffmpeg/core` core wasm, gzip -9 | 0.12.10 | LGPL-2.1 (FFmpeg 5.1.4) |

The wasm is shipped gzipped (9.75 MiB) because the raw 32 MB file exceeds
Cloudflare Workers' 25 MiB per-asset limit; the browser decompresses it via
`DecompressionStream('gzip')` into a blob URL at load time. Single-threaded core
(no SharedArrayBuffer / COOP-COEP needed).

To update: reinstall the pinned versions, copy the UMD dist files here, and
`gzip -9 ffmpeg-core.wasm`.
