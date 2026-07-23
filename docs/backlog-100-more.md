# Next 100 (round 2) — more concrete backend primitives to build

Second candidate list for the per-site Data API, following the same house rules as
`backlog-100-next.md` (now 100/100 done). Each is **route-regex/table-name-verified before building**;
anything that already exists is skipped (and noted). Built in batches of ~3 → one merged PR each:
single-statement atomic guards, parameterized SQL, owner/admin scoping, GDPR-erase wiring, a
`BACKEND_RULES` doc entry, and a green regression before merge.

## Commerce & payments (deeper)
1. Tiered / customer-group price lists
2. Volume-break (quantity) pricing tiers
3. Tax-exemption certificate registry
4. Dunning schedule (failed-payment retry states)
5. Subscription proration calculator (stateless)
6. Discount-stacking rule evaluator
7. Cart-abandonment capture + recovery flag
8. Product comparison sets
9. Purchase-order approval workflow
10. Per-customer credit-limit tracking

## Scheduling & operations (deeper)
11. Appointment deposit holds
12. Business-holiday / availability-exception calendar
13. Buffer / turnaround time between slots
14. No-show tracking + strike count
15. Multi-resource booking bundle
16. Shift-swap request marketplace
17. On-call rotation schedule
18. Equipment checkout / return log
19. Recurring maintenance due-date schedule
20. Capacity vs demand forecast

## CRM & sales (deeper)
21. Lead first-touch SLA timer
22. Account hierarchy (parent / child companies)
23. Opportunity forecast categories (commit / best-case)
24. Sales quota tracking per rep
25. Contact enrichment field store
26. Email-sequence step conditions
27. Deal-stage duration analytics
28. Renewal / contract-end tracking
29. Commission calculation
30. Territory rules (assignBy exists — verify)

## Content & CMS (deeper)
31. Content approval workflow (draft → review → publish)
32. Scheduled unpublish / expiry
33. Content version diff
34. Content localization completeness report
35. Broken-link registry + recheck
36. Reading-time estimator (stateless)
37. Content tag taxonomy tree
38. Featured-content rotation schedule
39. Word / character count + readability (stateless)
40. Excerpt / summary auto-truncate (stateless)

## Community & gamification (deeper)
41. Reputation decay over time
42. Badge prerequisites (badge chains)
43. Seasonal leaderboard reset / archive
44. Kudos / peer-recognition ledger
45. Quest chains (multi-step goals)
46. Action cooldown timers
47. Weighted-ballot voting
48. User titles / ranks by threshold
49. Daily/weekly streak-freeze tokens (extends /streak — verify)
50. Team / guild membership + scores

## Analytics (deeper)
51. Session tracking (start / heartbeat / end)
52. Path / sequence analysis
53. Attribution model (first / last touch)
54. Conversion-window config
55. Percentile calculator (stateless)
56. Moving average over a series (stateless)
57. Bucketed histogram (stateless)
58. Anomaly flag (z-score on a value, stateless)
59. Metric alert thresholds + breach log
60. Rolling uniques (approx distinct)

## Trust, safety & compliance (deeper)
61. Per-table data-retention policy + prune
62. Consent version tracking + re-consent
63. Right-to-be-forgotten request queue
64. Access-view log (who viewed what)
65. Content-hash fingerprint / dedup store
66. Temporary ban list (rate-limit bans)
67. CAPTCHA-style challenge issue / verify
68. New-device / new-geo login flag
69. Large-export throttle quota
70. Suspicious-activity score log

## Communication
71. Notification digest batching schedule
72. Email-template variable validation (stateless)
73. Unsubscribe-token management
74. Double opt-in confirmation tokens
75. Device registry for push
76. Broadcast fan-out log
77. Message read-receipts
78. Per-channel per-type notification prefs (notify_prefs exists — verify)
79. Announcement scheduling (announcements exist — verify)
80. Contact-frequency cap (max messages / window)

## Platform & devex (deeper)
81. Job queue with retry / backoff
82. Cron schedule registry (declare + last-run)
83. Environment config promotion (staging → prod)
84. Secret-rotation reminder
85. Health-check registry + status roll-up
86. Release log + rollback marker
87. Cumulative API usage metering per key
88. Replay-protection nonce store
89. Saved query snapshots (reports exist — verify)
90. Webhook payload replay (stores bodies; extends dead-letter)

## Utility generators (stateless, like csv / ical / vcard)
91. QR-code data payload builder (url / wifi / vcard / geo)
92. Slug generator with collision suffix
93. Markdown → sanitized HTML
94. Mustache-lite template render
95. Phone-number normalizer (E.164)
96. Postal-address formatter by country
97. Color contrast / palette checker (WCAG)
98. Password strength meter
99. Two-text diff
100. Unit converter (length / weight / temperature / data)
