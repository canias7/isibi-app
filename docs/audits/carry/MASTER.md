# Carry-over check — the master list of gaps (2026-11-04)

The owner's rule: the site agent changed who decides, not what the builder does; every old protection and every owner rule must hold on the agent path. This file merges every NO and PARTLY row (and every settled UNKNOWN that came back NO or PARTLY) from all the readers' files into distinct gaps. Rows that are the same gap seen from different sides are one entry, and every source row is named in its entry. Read-only: nothing was run, charged or changed.

Severity: **critical** = loses customer data, money or security; **high** = a wrong charge or a wrong or lying reply on a common path; **medium** = rarer, or recoverable; **low** = cosmetic.

Not a gap, dropped: "a balance that cannot be read never stops the work" is the owner's own decision (2026-10-30). P4's half about it and slice-02 #6 are dropped; P4's "checked only every 5 rounds" half is kept as M-6.

## Counts

| Severity | NO | PARTLY | Total |
|---|---|---|---|
| critical | 5 | 2 | 7 |
| high | 17 | 9 | 26 |
| medium | 15 | 30 | 45 |
| low | 5 | 12 | 17 |
| **Total** | **42** | **53** | **95** |

Plus 2 FIXED (G1, G4) and 7 owner decisions (listed below; their gaps stay counted above).

## 1 Money (credits)

| Id | What the customer suffers | Old protection | What happens now | Sources | Verdict | Cost | Severity |
|---|---|---|---|---|---|---|---|
| M-1 | Pays for the agent's run when it only asks a question; files written before asking are thrown away and still billed | A held question waited uncharged; a question after a reserve gave the reserve back | `ag.ask` / clarify ending returns `cost: await charge()` | G2; slice-00 #3; slice-02 #3; slice-03 #5; slice-01 #15 (question cost) | NO | credits | high |
| M-2 | Pays when nothing was done: "already so", nothing to change, the agent gave up, a no-match row, a page the site lacks, a database it could not reach | All of these ended at cost 0 (satisfied, no-match, declined, page-unknown, unreachable DB) | Every ending calls `charge()` ("Nothing on the site was changed" is billed) | notes1 #1; notes4 #3; code/part1b #1; code/part2 C2-7; slice-04 #13; slice-01 #13, #14; P21; notes3 #1 (cost half), #9 | NO | credits | high |
| M-3 | Taking a page off, moving a page or changing the logo now costs credits, and a delete can cost a rewrite | Removal, move and logo were `exempt` (free) | Every agent run is billed on model usage, no exemption | notes4 #2 | NO | credits | high |
| M-4 | Pays for files the build had to put back (salvage) | The share of the writer charge for files that did not land was refunded | Whole usage charged; `out.salvaged` ignored | G7 (charge half); slice-04 #3 | NO | credits | medium |
| M-5 | Pays for entries the database then refuses (missing required field, bad value) | Each entry rehearsed (`sqlRehearse`) before charging; refused ones free | `change_rows` checks column names only; refusal comes at finish after rounds were billed | code/part1 #5; notes1 #3 | PARTLY | credits | medium |
| M-6 | A low balance can be overspent for several rounds, and parallel helpers can go past it | Balance checked before each paid step; below the floor no paid work filed | `affords` only every 5 rounds (`CREDIT_CHECK_EVERY`); helpers and parts between checks | P4 (rounds half only); slice-00 #8; slice-02 #7 | PARTLY | credits (ours) | medium |
| M-7 | A big rewrite or new feature is done and charged with no yes asked | The customer said yes before a start-over or expensive change | No confirmation; `AGENT_CREDIT_CAP = Infinity`; agent can rewrite every file (previous version stays saved) | P5; slice-03 #8 | PARTLY | credits, trust | high |
| M-8 | The agent picks a payment or service provider itself and builds on the guess (47 credits seen live) | Asked which provider before writing any code | Prompt rule only ("Never choose the provider yourself") | notes1 #4 | PARTLY | credits, trust | high |
| M-9 | An attachment that cannot be read does not stop the request; the run goes on and is charged | Refused whole before anything ran or was charged | `agentAttachments` lists it as `unread`; the agent carries on | P8; slice-00 #7 | PARTLY | credits, trust | medium |
| M-10 | The visual look-and-fix may run (and bill) for back-end-only work | Ran only when the files show a visible change | The agent decides when to call `look` | notes1 #6 | PARTLY | credits | low |
| M-11 | An empty first message sent by a direct caller reaches the model and is charged | Empty or over-long never reached the model | Over-long refused free; empty refused only by the page | unknowns #16; slice-04 #36 | PARTLY | credits (small) | low |
| M-12 | Rounds spent planning a `split_work` are billed | Split routing and a carved part's routing were free | `split_work` ending returns `cost: await charge()` | prefs #13 | PARTLY | credits (small) | low |

## 2 Customer data and security

| Id | What the customer suffers | Old protection | What happens now | Sources | Verdict | Cost | Severity |
|---|---|---|---|---|---|---|---|
| M-13 | Entries, rows and table rules go live on the real site before Publish; visitors see or are refused by them at once | Under draft-first, rows and rules were held in the draft (rehearsed) until Publish | `writeAgentRows(ownerRowConn…)` writes straight to the live database; rules applied at once | code/part1 #1; code/part2 C2-2; notes1ba #1 | NO | data, trust | critical |
| M-14 | A failed change leaves new tables and columns behind, and the reply says "nothing was saved" / "untouched" | No database made or changed before the pages compiled; four honest failure states | `applyAgentSchema` runs before save and stays on failure; a container death after rows is not undone or named | G8; P19; slice-00 #2; slice-03 #3; notes2a #1; unknowns #19 (slice-02 #12) | NO | data, trust | critical |
| M-15 | The agent can change or delete rows in tables visitors write (orders, bookings, messages) | Row edits reached only display tables | Every table is offered to `change_rows` | code/part2 C2-1 | NO | data | critical |
| M-16 | Visitors' private rows (orders, enquiries) are sent to the model | The router saw table names only | `read_table` does `select *` on any table | code/part4 #7 | PARTLY | data (visitor privacy), security | critical |
| M-17 | A shell command can delete or change files outside the edit's scope, including the home page | Shell obeyed the same write limits as the write tool | `run` → `syncFromRun` never calls `outOfScope` or the home-page check | G10; slice-02 #1; slice-04 #7 | NO | data | critical |
| M-18 | Pages can write to a retired or read-only table or never wire a form, so visitor enquiries or bookings are lost while the page looks fine | `lintPages` data-access lint; `verifyNeed` mechanical check with one repair pass | Neither is called on the agent path | code/part3 #3; code/part4 #4 | NO | data (lost enquiries), trust | critical |
| M-19 | A public server function the agent writes reaches the database with the owner's view of every row; visitor walls can be bypassed, a price can come from the browser | Visitor walls held (write-only tables, granted columns, no public INSERT on payables, price from rows) | Server code runs on `APP_CONN` (row login); nothing checks the walls | docs D4 | PARTLY | data, money, security | critical |
| M-20 | The agent edits from a list it never fully saw (a long table is cut at 12,000 chars into broken JSON), and other reads are cut silently | No silent losses: anything past a limit was told | `read_table` `.slice(0, 12000)` with no notice; build/look/helper errors cut | notes2 #3 | NO | data, credits | high |
| M-21 | A database change held for Publish is not tried on a copy first, so a refused table blocks Publish later | `ADDON_DRY_RUN`: draft schema tried on a temporary copy; refused parts dropped by name | No dry run in `applyAgentSchema` | notes1ba #2 | NO | trust, Publish blocked | high |
| M-22 | The same entry is added twice | A duplicate was asked about, free, before anything was written | No duplicate check in `change_rows` (prompt only) | code/part1 #4; notes1 #2 | NO | data, trust | high |
| M-23 | Pasted third-party HTML/script can be put into a page's head | The builder never offered "paste anything into your head" | Root document not writable, but `head()` scripts or `dangerouslySetInnerHTML` unchecked | prefs #3 | PARTLY | security | high |
| M-24 | The site's address is renamed, or an old one freed, without the owner's own words (redirects are permanent) | Never guessed: no name given → ask; old address stays taken | `rename_site` / `forget_old_address` check format and availability only | notes4 #5 | PARTLY | trust, data | high |
| M-25 | A redelivered job's re-run model answer can write different rows | Redelivery wrote the same entries once and charged once | Row journal keyed by position (`rowOpKey`) | P18; slice-00 #9 | PARTLY | data, credits | medium |
| M-26 | A row write whose answer was lost is not told as "not knowing" and not parked for review | Mark before write, read-back, park for review | Journal keys only | code/part1 #6 | PARTLY | data, trust | medium |
| M-27 | A row the agent removed is never offered back (undo) | Undo offer from `applied[].removed/was` | Agent body puts only `{table}` into `applied`; no undo offer | unknowns #4 (notes2 #12) | NO | data | medium |
| M-28 | An existing file can be overwritten without being read | A file the writer was not shown could not be replaced | Prompt only; `write_file` does not check it was read | P17; slice-02 #9 | PARTLY | data | medium |
| M-29 | An upload is accepted by its file name only (an SVG called .png, any size) | Checked by bytes and by size | `checkUpload` checks extension and ownership only | P10; slice-04 #10 | PARTLY | security | medium |
| M-30 | Provider or error text (possibly a secret or the word "fal") can reach the customer through the agent's summary | Failure reasons only from allow-lists; "fal" never shown | Tool errors pass raw `e.message` to the model; `finish` summary unscrubbed | unknowns #5; slice-04 #5; code/part4 #12; notes3 #10 | PARTLY | trust, possible secret echo | medium |
| M-31 | Two parts of one request can change the schema at once and conflict | A part designing tables while another may change the schema ran alone | Scheduler only uses predictions; `runAgentChange` never reads `beside.schema` | unknowns #12; code/part1 #8 | PARTLY | data | medium |
| M-32 | On a blank-link site, a rules change leaves the link blank (Data panel stays dark) | `healSiteBackendDb` before rules | Correct database reached, link never healed | unknowns #11; code/part2 C2-8 | PARTLY | data | medium |
| M-33 | Events or bookings can be entered with dates already past, or in the wrong zone | "Today" in the owner's zone given to the cleaner, which refused past dates | No date or zone given to the agent | code/part3 #4 | NO | data | medium |
| M-34 | The page writer is not shown tables the draft will create, so pages may be written against a different schema | Draft tables shown "as if made"; unreadable draft stopped | `specForAddon(conn)` has no draft overlay | code/part3 #8 | PARTLY | credits, broken pages | medium |
| M-35 | A new table gets no starter rows, so a page ships over an empty list; the agent may seed non-display tables | Seed net topped up new tables; seeding only display tables | Rows only if the agent calls `change_rows`, which has no display-only rule | code/part1 #7; unknowns #6 (agent half); notes2a #3 | PARTLY | data, trust | medium |
| M-36 | Server-set columns (`created_at`) and non-display tables can be written | Only real display columns, never `id`/`created_at` | `change_rows` refuses non-columns and the key only | notes2 #8 | PARTLY | data | low |
| M-37 | When putting settings or the stylesheet back after a failed publish itself fails, the customer is not told the change will ship with the next edit | `restoreEditConfig` + `KEPT_CHANGE_NOTE` | `putBack` and css restore `catch {}` silently | code/part3 #5 | NO | trust | medium |

## 3 The site itself (pages, links, pictures, QR, look)

| Id | What the customer suffers | Old protection | What happens now | Sources | Verdict | Cost | Severity |
|---|---|---|---|---|---|---|---|
| M-38 | A printed QR code opens a 404: it can point at a page that does not exist, or one this change removes | Checked before anything stored; withheld with the page that carries it | `readQrInput` checks only that it looks like a path or an http(s) URL | code/part2 C2-6; notes3 #2; notes4 #1 | NO | trust (printed codes) | high |
| M-39 | A QR code is pasted by the model as a long base64 copy; one wrong character makes a code that scans wrong | We drew QR codes from the stored address; the model never copied one | `make_qr` hands the model a data URL to paste into `<img src>` | docs D1 | NO | trust (printed codes) | high |
| M-40 | A QR code duplicating an existing one's name or destination, or beyond the cap, is made | `cleanAdd`, `MAX_QRS` | No stored list, no duplicate check, no cap | code/part1 #3 | NO | trust (minor) | low |
| M-41 | Made-up picture addresses (`/u/…` with no file) publish as broken images | Only the site's own uploads or bought pictures; strays dropped into a fillable frame | `strayImages`/`dropStrayPhotos`/`siteUploadExists` no longer called | code/part1 #2; code/part2 C2-3; notes4 #4; notes3 #7 | NO | trust (broken images) | high |
| M-42 | Unasked removals (text, links, sections, components, photos, header/footer wording) publish after the agent's second finish | Refused before the gate and the bill; photos withheld; "cannot tell" never "kept" | `changeReport` shown to the agent once; second finish publishes; photos reported only after publishing; unparseable diff gives no facts | P3; slice-00 #4; slice-01 #6, #7; slice-02 #8; code/part4 #8, #9; notes2 #7 | PARTLY | data, trust | high |
| M-43 | An edit of one page (or one button) can change other pages, the stylesheet site-wide, or every page via a site-wide sort | Page edit took only its page; sort only site-wide when asked; change reached only as far as asked | `scopeGuard` only for split parts naming routes; whole message unscoped; `sort_table` rewrites every page | P2; slice-04 #6; prefs #2; notes2 #6 | PARTLY | data, trust | high |
| M-44 | "Phones only" changes can move the desktop layout; the preview does not switch device | Device-scoped check after the build, refused and refunded if other sizes moved | `devices` never set by `agentRouted`; no agent tool sets it | G5; slice-01 #3; prefs #1 | NO | trust, data | high |
| M-45 | Links to pages that do not exist ship; removing a page others link to leaves dead links | Dead links refused; a linked page not removed or its links go with it | No dead-link check; prompt only | P9; slice-01 #12; slice-04 #9 | PARTLY | trust (broken links) | high |
| M-46 | Scheduled work and one-time reminders: a "remind me on the 3rd" can repeat every year; jobs registered with no check | Job registered only when its function exists; one-time fires once; owner's wording | No job tool; cron has no "once"; nothing on the agent path | notes3 #3; notes4 #8 | NO | trust (repeat messages to real recipients) | high |
| M-47 | A changed phone number keeps its old `tel:` link, so Call dials the old number | `staleContactLinks` reported it | Not called on the agent path | code/part3 #2 | NO | trust | medium |
| M-48 | A new page is not linked from the menu and nobody is told | `menuLinkAdds`/`addFrameLinks`; `unlinked` reported | Nothing checks | code/part2 C2-5 | NO | trust | medium |
| M-49 | A style rule that matches nothing ships and is charged (a change that silently did nothing) | Held, fixed once or refused with the sheet put back | `verifyCss` not passed by the agent's save | G6; slice-01 #4 | NO | trust, credits | medium |
| M-50 | Wording changed on a translated page is translated back at the next publish | Stored as the language's own override | Old overrides apply; the agent cannot make new ones | code/part3 #1; unknowns #8 (notes1 #12) | NO | trust, credits | medium |
| M-51 | Several pictures sent as "my logo": the agent picks one | Refused ("a site has one logo") | `set_logo` takes whichever one the agent names | code/part4 #5 | NO | trust | medium |
| M-52 | A table nothing can ever write to is created and the customer is not told (a page that reads 0 forever) | Reported to the customer | `change_schema` creates it, no report | notes3 #4 | NO | trust | medium |
| M-53 | A logo is stored, charged and reported done though the agent-written header never shows it | Not stored or charged when no visitor can see it | No check that the header uses `SITE_LOGO` | notes4 #6 | PARTLY | credits, trust | medium |
| M-54 | Changing the email leaves old `mailto:` links and copies | Carried site-wide; reply named links changed and kept | Cheap text try carries it but reply does not name them; agent path depends on grepping | code/part3 #7; notes1 #7 | PARTLY | trust | medium |
| M-55 | Renaming the business leaves the old name in the header or sections | Name moved tab, header, share card and every section together | `set_site_settings.name` changes title/preview only; rest left to the model | notes1 #8; notes3 #8 | PARTLY | trust | medium |
| M-56 | Removing one language replaces the whole list; a named item not there is not reported | Only that one removed; "not there" said | `set_languages` replaces the whole list | slice-03 #7; P13 | PARTLY | trust | medium |
| M-57 | "Take the photo off" vs "keep the space", and two photos with one description, are guessed | Element vs frame; ambiguous match refused | Up to the agent | notes2 #10 | PARTLY | trust | medium |
| M-58 | A footer/contact addition copies one page's details over another page's own | Filled only what each footer lacked | No rule or check | notes2b #1 | PARTLY | trust, data (wrong phone) | medium |
| M-59 | Additions may not follow the site's design system; a second one may change the first | `ADD_DESIGN_RULE` | Not in `agentSystem` | docs D3 | PARTLY | trust | medium |
| M-60 | Parts of a site (theme choice, stored QR codes, …) can no longer be changed by any tool | Every built field had a lane | No tool for the stored theme or QR list | docs D2 | PARTLY | trust | medium |
| M-61 | Dependent changes in one message can run out of order | Ran in order; "waiting for /x" | `split_work` assumes independence | P12; slice-03 #6 | PARTLY | trust, broken links | medium |
| M-62 | The render check lets a page that does not show be published after one hold | Held publishing until the page showed | Holds `finish` once, then lets go | P16; slice-02 #11 (render half) | PARTLY | trust | medium |
| M-63 | A section with no stated page is put on the home page and reported done | Never silently substitute a destination; ask | Prompt line only | notes3 #5 | PARTLY | trust | medium |
| M-64 | A change aimed at a page the site lacks may design that page or edit the home page instead of naming the real pages | Answered with the real pages; a missing page never designed; free | Prompt only (charge is M-2) | code/part4 #10; notes3 #1; slice-01 #13 | PARTLY | trust | medium |
| M-65 | One message can make several publishes and versions | One message, one publish | Each `split_work` part saves on its own | notes4 #7 | PARTLY | trust | low |

## 4 What the customer is told

| Id | What the customer suffers | Old protection | What happens now | Sources | Verdict | Cost | Severity |
|---|---|---|---|---|---|---|---|
| M-66 | The reply can claim work, checks or behaviour that did not happen (failed rows, rules, address; "I checked"; "each customer sees only their own") | The reply stated only what operations really did; checks told only as far as they went; configuration never proof | A one-part reply is the agent's own `finish` summary; failures append "In the agent's own words" unchecked | G11; slice-00 #5; slice-01 #10; slice-02 #2; slice-04 #12; notes2a #2; notes3 #6; notes1bb #4; notes1bc #1 | NO | trust | high |
| M-67 | Words, photos or requirements asked for may be missing and nobody says so | Each requirement checked; words and photos checked on the named page; anything not done named; hidden content named as hidden | No per-requirement or landing check; relies on the agent's summary | P15; slice-02 #11 (requirement half); slice-03 #10; code/part2 C2-4; code/part4 #3; notes1bc #2; notes2 #2 | NO | trust, credits | high |
| M-68 | The reply says database columns were added when the database refused them; pages may use a missing column | Refused columns named, never reported added | `applyAgentSchema` discards the result and returns what was asked | G9; slice-03 #2 | NO | trust, broken pages | high |
| M-69 | The agent invents facts (names, prices, addresses) or builds extras nobody asked for | Grounding check and judgment pass in code; extras only offered | Prompt only | P7; slice-00 #6; notes2 #5 | PARTLY | trust, data, credits | high |
| M-70 | The customer is not told changes are drafts until Publish; "publish my changes" in chat does not point to the button | Drafts told; "publish" pointed to the Publish button | No draft or publish rule in the agent prompt; no slash command | code/part4 #1; notes1 #5; unknowns #15 (slice-01 #38) | NO | trust, credits | high |
| M-71 | Files the build put back are reported as "Saved changes to X" | Salvaged or stood-in files named as such | `outcomeFacts` ignores `out.salvaged` | G7 (reply half); slice-04 #2 | NO | trust | medium |
| M-72 | "Scan my site for security problems" becomes a paid agent turn that may "fix" code instead of the scan | Started the security scan, no site step | `agentRouted` never answers `security`; no scan tool | code/part4 #2; prefs #4 | NO | credits, trust | medium |
| M-73 | Every model failure reads "the AI model could not be reached"; our own timeout and a billing refusal are not named | Named by cause ("on us", "ours", "none of it was used") | All sends become `stopped = "send"`; `time` unattributed | unknowns #10; code/part3 #9; slice-01 #16 | NO | trust | medium |
| M-74 | When the provider fails mid-edit, the customer must resend | Part waited with a notice and resumed by itself | Retried once, then `agent-stopped` (verify whether the G1 fix covers this) | slice-03 #4; slice-04 #4 | PARTLY | trust | medium |
| M-75 | The reply may claim the builder watched or listened to the owner's video or audio | Writers told "Nobody has watched or listened" | Sentence not in the agent's rules | notes1bb #1 | NO | trust | medium |
| M-76 | The reply writer gets facts and the customer's words cut short (4,000 / 300 / 160 chars, 600 tokens) | Every fact passed whole | `oneReplyRequest` and `requestFacts` cut | notes2 #1 | NO | trust | medium |
| M-77 | A picture that cannot be made is silently skipped rather than said | Said in the reply, never stood in for | No picture tool; depends on the model | P14; slice-03 #9 | PARTLY | trust | medium |
| M-78 | Progress lines say "Wrote …" / "Removed the /x page" before the save, which may then fail | Never claimed a step before it happened; first-person lines from real results | `roundFacts` marks workspace writes `applied`; fixed prefixes | unknowns #13 (slice-03 #11); notes2 #13 | PARTLY | trust | medium |
| M-79 | Emoji and checkmarks in customer replies | No emoji unless asked | No emoji rule in agent or reply-writer prompts | G12; slice-02 #4 | NO | trust | low |
| M-80 | Data replies give counts only, not before and after values | Row, field, before and after named | `rowFacts` counts only | P20; slice-01 #11 | PARTLY | trust | low |
| M-81 | The version id is shown to the customer | Never said | `undoSentence` puts the id in the facts | notes1bb #3 | PARTLY | trust | low |
| M-82 | Conversation replies lost the agreed style (length, facts vs suggestions vs unknowns, ranked, numbered) | Style instructions in the converse prompt | Not in the agent's or reply writer's prompt | notes1bb #2 | NO | trust | low |
| M-83 | A reply that fails is not retried; failure endings are fixed text | Three spaced retries; model-written, fixed text only as fallback | One call then fallback; every failure ending fixed text | notes2b #2; notes1 #10 | PARTLY | trust | low |
| M-84 | Repeated or several next-step suggestions | At most one, never one already suggested | No list of past suggestions, no rule | notes1 #9 | PARTLY | trust (nagging) | low |
| M-85 | Made-up file and component names are told to the customer | Counts and kinds, not names | `outcomeFacts` names components | notes4 #9 | PARTLY | trust | low |
| M-86 | Stylesheet costs (unhostable font, CSP-refused url, cut sheet) and seeded rows are not told; a failed database creation is told one way only | `cssNote`; seed sentence; three honest database states | `readCss` runs but nothing tells; `seeded` unread by the page; one sentence | code/part3 #6; unknowns #6 (told half); code/part1b #3 | PARTLY | trust | low |

## 5 Questions and conversation

| Id | What the customer suffers | Old protection | What happens now | Sources | Verdict | Cost | Severity |
|---|---|---|---|---|---|---|---|
| M-87 | A side question sent while a question waits is taken as the answer and the waiting work resumes on it | The waiting question stayed waiting | `agentRouted({waiting})` marks every message `answered: true` | G3; slice-01 #1 | NO | trust, credits | high |
| M-88 | Answering an expired or closed first-build question starts a paid build; the question can be asked again | First-build question asked once; expired answers refused | `firstBuild: true` → `intent: "build"` before `staleAnswer`; `canAsk: () => true` | unknowns #1 (slice-00 #10) | NO | credits, trust | high |
| M-89 | A question or casual message can change and charge the site | A question never changed anything | Prompt rule only; any write is saved and charged | P1; slice-01 #8; slice-02 #5; slice-04 #8 | PARTLY | data, credits | high |
| M-90 | An ambiguous request is guessed rather than asked; helpers that cannot ask go ahead on a guess | Asked, naming exactly what is unclear; a limit never permission to act | No rule to ask when unsure; helpers (`onlyWrite`) cannot ask | P6; slice-01 #9; notes2 #9 | PARTLY | trust, credits | medium |
| M-91 | A long multi-item message, or a shortened brief, can lose items silently | Bounded part now, rest kept and said; never run a shortened request | No holding; `start_build` brief cut at 2,000; split part over 4,000 refused to the agent only | slice-04 #11; notes2 #4 | PARTLY | trust, credits | medium |
| M-92 | A first build may not ask what the business is, or may ask for details typed later | Must ask what the business is; never for later details | `newProjectMessage` asks only when one detail blocks the start | code/part4 #6 | PARTLY | credits, trust | medium |
| M-93 | The same question can be asked again; no limit on repeats or total answers; add-ons get no earlier answers | Repeat and total-answer limits | Answers reach the agent, but no limit enforced | P11; slice-02 #10 | PARTLY | credits, trust | low |

## 6 Other

| Id | What the customer suffers | Old protection | What happens now | Sources | Verdict | Cost | Severity |
|---|---|---|---|---|---|---|---|
| M-94 | A disputed or bad run cannot be investigated: no record of the model's answers is kept | Every model reply kept in the site's store with the fate of each requirement | Only counts and time marks | code/part1b #2 | NO | owner's time | low |
| M-95 | Two repository checks (no `node_modules` tracked; model ceilings named) were parked with the old tests and no longer run | They ran in `test/` | Parked | SUMMARY "Also found" | NO | none directly | low |

## OWNER DECISIONS NEEDED

| Decision | Gaps it governs |
|---|---|
| Is asking the owner a question free (and is the run before it charged)? "No questions after a charge" was replaced by ask-anywhere (2026-10-26); the charge itself was never decided | M-1 |
| Is splitting work (`split_work` planning) charged or free, and may one message make several publishes? | M-12, M-65 |
| Price-first: must the customer say yes before an expensive change or new feature (rewrite, provider build)? | M-7, M-8 |
| Do removals, moves and logo changes stay free on the agent path (they were `exempt`)? Are "nothing done" endings free? | M-2, M-3 |
| Question expiry (the 24-hour window): may an expired or closed first-build question's answer start a build? | M-88 |
| Healing blank database links (Lane 2, still open) | M-32 |
| Every customer message model-written vs fixed-text failure endings | M-83 |

Already decided, so dropped: a balance that cannot be read never stops the work (owner, 2026-10-30).

## FIXED on this branch

| Id | What | Status |
|---|---|---|
| G1 | Provider outage on a new project started a paid build; edits ended "agent-stopped" | FIXED: an outage never builds (the edit-resend half is kept as M-74 to verify) |
| G4 | History cut to 12 × 600 chars silently; no history on the request path | FIXED: history on every path |

## Source files read

- SUMMARY.md — read (G1–G12, P1–P21, Also found)
- slice-00-findings.md — read
- slice-01-findings.md — read
- slice-02-findings.md — read
- slice-03-findings.md — read
- slice-04-findings.md — read
- code/part1-findings.md — read
- code/part1b-findings.md — read
- code/part2-findings.md — read
- code/part3-findings.md — read
- code/part4-findings.md — read
- notes/notes1-findings.md — read
- notes/notes1ba-findings.md — read
- notes/notes1bb-findings.md — read
- notes/notes1bc-findings.md — read
- notes/notes2-findings.md — read
- notes/notes2a-findings.md — read
- notes/notes2b-findings.md — read
- notes/notes2c-findings.md — read (no NO or PARTLY rows)
- notes/notes3-findings.md — read
- notes/notes4-findings.md — read
- notes/prefs-findings.md — read
- unknowns-traced.md — read (NO: #1, #4, #10, #15; PARTLY: #5, #6, #8, #11, #12, #13, #16, #19 — all merged above)


## Re-checked by me against the code (2026-11-04)
All seven critical gaps confirmed:
- M-13: `runAgentChange` writes `ag.rows` through `ownerRowConn` → `writeAgentRows` before the save, with no draft hold.
- M-14: schema ops run during the rounds (`applySchema` → `applyAgentSchema`) and before `save()`; a compile failure replies "the site is untouched".
- M-15: `change_rows` (site-agent.mjs ~882) checks only that the table and columns exist; no access check.
- M-16: `read_table` (~908) reads any table name and returns its rows to the model.
- M-17: `syncFromRun` (~656) never calls `outOfScope`.
- M-18: `lintPages` runs only in `publishPages` (first builds, publish-pages.mjs:1578); agent edits go through `recompileAndPublish`, which never calls it.
- M-19: `site.sql` in server code runs on `APP_CONN` (template/src/lib/site-functions.ts:152).


## Owner decisions taken (2026-11-04)
- **Charge every token** (asking, nothing done, removals, moves, logo, splits): M-1, M-2, M-3 and M-12's charging half are **not gaps** — closed by decision. The reply must still say truthfully what was and wasn't done.
- **Price first for new features and full rewrites**: M-7 and M-8 are to be built (the agent shows plan + estimate and waits for a yes).
- Still open: the 24-hour question expiry (M-88), healing blank database links (M-32), fixed-text vs model-written failure endings (M-83), and whether one message may publish several times (M-65).
