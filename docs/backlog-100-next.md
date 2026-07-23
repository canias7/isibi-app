# Next 100 — concrete backend primitives to build

Candidate list for the per-site Data API. Each is **route-regex-verified before building**;
anything that already exists is skipped (and noted). Built in batches of ~3 → one merged PR each,
following the house pattern: single-statement atomic guards, parameterized SQL, owner/admin scoping,
GDPR-erase wiring, a `BACKEND_RULES` doc entry, and a green regression before merge.

## Commerce & storefront
1. Shipping-rate calculator (zones × weight/price tiers)
2. Return / RMA request flow (request → approve → refund states)
3. Order status timeline (per-order event log + public tracker)
4. Product bundles / kits (component pricing rollup)
5. Recurring-order schedule (subscription cadence, next-run)
6. Backorder / preorder capacity holds
7. Gift messages + order notes
8. Store-credit issuance ledger (distinct scope from wallet)
9. Price-drop / back-in-stock notify subscriptions
10. Loyalty tiers (spend → tier, benefits lookup)

## Scheduling & operations
11. Appointment reminders (pre-appointment nudges off /bookings)
12. Staff shift scheduling + coverage check
13. Time-off requests approval (distinct from /leave ledger)
14. Resource/room double-book calendar (extends bookings)
15. Recurring events (RRULE-lite expansion)
16. Queue/ticket-number dispenser (deli counter)
17. Capacity per time-slot (class sizes)
18. Waitlist auto-promote on cancel (generalized)
19. Service catalog (services × durations × prices)
20. Availability windows per staff member

## CRM & sales
21. Lead capture + scoring
22. Deal pipeline stages (kanban)
23. Contact merge / dedupe
24. Activity/notes timeline per contact
25. Task assignments + due dates
26. Quote / estimate builder (line items → total)
27. Email-open / link-click tracking pixels
28. Territory / round-robin assignment (roundRobin flag exists — verify)
29. Follow-up sequences (drip steps)
30. Win/loss reasons analytics

## Marketing
31. Newsletter signup + double opt-in
32. Campaign UTM link tracking
33. Referral rewards ledger (extends /referrals)
34. Landing-page variant test (uses /experiments)
35. Popup / banner scheduling (extends /announcements)
36. Segment builder over any table (segments exist — verify)
37. Drip email schedule
38. Social share counters
39. Countdown / launch timers
40. Giveaway / sweepstakes entries (random draw)

## Support & success
41. Support ticket system (create → assign → resolve)
42. Canned responses library
43. SLA timers per ticket (sla flag exists — verify)
44. CSAT after ticket close (uses /surveys)
45. Help-article votes (was this helpful?)
46. Escalation rules
47. Ticket merge / link
48. Knowledge-base search ranking (extends /faq)
49. Status-page incidents + subscribers
50. Feedback board + upvotes (uses /reactions)

## Content & CMS
51. Redirects manager (301/302 + hit counts)
52. Navigation/menu builder (nested)
53. SEO metadata per record (title/description/og)
54. Sitemap feed
55. RSS/Atom feed generation
56. Reusable content blocks / snippets
57. Media library metadata (alt text, captions)
58. Publish scheduling calendar view
59. Related-content suggestions
60. Table-of-contents / anchor index

## Community & gamification
61. Achievements / badges (award + list)
62. Points / karma ledger (generic)
63. Leaderboards (generic, any metric)
64. Streaks freeze/repair (extends /streak)
65. Daily-reward claim
66. Level / XP progression
67. Challenges (goals with deadlines)
68. Invitations with tokens (invite → accept)
69. Groups / circles membership
70. Content report + moderation queue (reports exist — verify)

## Analytics & reporting
71. Named counters / metrics increment store
72. Funnel step tracking
73. Cohort retention buckets
74. Saved report definitions + run
75. Scheduled digest of a query
76. Goal / conversion tracking
77. Event stream tap (extends audit/events)
78. Top-N / trending over a window
79. A/B results significance helper
80. Dashboard tiles config (per-user)

## Trust, safety & compliance
81. Consent log (GDPR/cookie) — consent exists; verify scope
82. Data-export request (per-user bundle)
83. Rate-limit policy config per endpoint
84. IP allow/deny list
85. Profanity / bad-word filter
86. Spam honeypot + score
87. Audit-log retention policy
88. Terms-acceptance tracking (version → accepted)
89. Age-gate / date-of-birth check
90. Two-person approval for sensitive ops (approval flag exists — verify)

## Platform & devex
91. Webhooks retry + dead-letter (webhooks exist — extend)
92. API key scopes/permissions (apikeys exist — extend)
93. Idempotent job runner (extends /idempotency)
94. Feature-flag audiences by attribute (extends /flags)
95. Localized content per locale (i18n exists — verify)
96. Currency conversion snapshot (currency flag exists — verify)
97. Slug/uniqueness reservation
98. Soft-delete recycle bin view (trash flag exists — extend)
99. Bulk import validation preview
100. Config schema validation for /config
