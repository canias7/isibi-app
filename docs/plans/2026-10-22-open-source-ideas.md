# Ideas from open-source builders (2026-10-22, for the owner to choose)

Research only; nothing built. Sources and licenses: Anthropic skills (Apache 2.0, except docx/pdf/pptx/xlsx: restricted), bolt.diy (MIT), open-lovable (MIT), Onlook (Apache 2.0), dyad (Apache 2.0; `src/pro/` is FSL, ideas only), gpt-engineer (MIT), llama-coder (MIT), screenshot-to-code (MIT). Clones were in the session scratchpad.

## Design (how sites look)
1. "Don't look AI-made" rules (Anthropic frontend-design).
2. Less animation: one moment on load (Anthropic).
3. Hero grounded in the business (Anthropic).
4. Typography craft: line length, scale, two distinct fonts, not Inter by habit (Anthropic).
5. Decoration only where it means something; cards vary by importance (Anthropic).
6. Copy voice: sentence case, buttons say what they do, no filler (Anthropic).
7. Plan then self-critique in the design step (Anthropic).
8. Bold in one place only (Anthropic).
9. Theme "best used for" trade hints (Anthropic theme-factory).

## Checking and fixing builds
10. AI looks at phone/desktop screenshots and fixes what looks wrong, once (screenshot-to-code).
11. One automatic repair try on compile errors (bolt.diy, Onlook, dyad).
12. Catch browser errors per page in the render check, to feed 11 (bolt.diy).
13. Smarter repair: name the real cause, never retry the same error (llama-coder).
14. Build checklist checked against the finished site (bolt.diy).
15. Fixed test briefs run before every prompt change, results side by side (screenshot-to-code).

## Editing
16. Click to edit on the preview, hidden element ids (Onlook).
17. Simple visual edits done by a program, no AI cost (Onlook).
18. Exact search-and-replace that refuses when not unique (Onlook).
19. Search plan before an edit: AI names exact words, code finds the line (open-lovable).
20. Fast-apply merge model, cheaper than a page rewrite (Morph/Relace, via open-lovable and Onlook).
21. Cheap step picking which files the AI sees on big sites (bolt.diy).
22. Protect changes the customer made by hand (bolt.diy).

## Chat
23. Summary of long chats (bolt.diy, dyad).
24. Suggested next requests after each reply (dyad).

## New features
25. "Make my site like my old one" from a link (open-lovable).
26. Pull the real logo and photos from an old site or screenshot (screenshot-to-code).
27. Several versions of a first build, customer picks one (screenshot-to-code).

Already built or ours already: security review with severity (our security scan), clarify question before building, compile + render gate, targeted edits.
Not worth it: whole-file rewrites, live in-browser preview, many AI providers.

## Owner's decision on the rest (2026-10-22)

Do: 11, 12, 13 (being built, behind a switch). Explain: 15. Check: 18.
Discarded by the owner: 7, 9, 16, 17, 19, 20, 21, 22, 24, 27.
Done earlier: 1–6, 8, 10, 14, 25, 26 (23 already existed).

Later (owner, 2026-10-22): 15 discarded. 18 noted "for one day": switch the
tweak rung (builder/site-tweak.mjs) from whole-file rewrites to exact old→new
edits refused when missing or not unique (the visual review's apply loop,
shared). The text lane and visual review already work this way. ~1 day + a
small paid test.

**18 done (2026-10-23, branch `tweak-exact-edits`, not merged, not deployed):**
the tweak rung's tool answers with exact `{old, new}` edits, applied through
the one helper the visual review now shares (`builder/exact-edits.mjs`); a
missing or repeated `old` is refused and told back for one retry turn; the
existing guards read the applied file. The small paid test is still owed.
Record: `docs/history/2026-10-23-tweak-exact-edits.md`.
