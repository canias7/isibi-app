# Run 117's concurrency failure, diagnosed (2026-10-09)

Codex reviewed `09c4bdfc` and passed all 16 `canary-parallel` and
`parallel-intervals` tests. On the owner's word, this round diagnoses why run
117's preparation did not overlap another job, before any further paid run.

Run 117's successful live results stand and are not repeated:
- browser closure and fresh-session recovery;
- model-written progress;
- the clarification;
- the completed changes;
- 16 credits reconciled.

Everything here was read-only. No merge, deployment, container build, paid
run, balance change or live database write was made.

## The evidence, and where it came from

- **The run's evidence artifact** (`canary-evidence`, 11649259867, 41 files).
  The GitHub API answered the download with a signed storage link, fetched
  with `curl`. It holds the canary's saved request views (`ui.json`), each
  carrying the served intervals: `prepRun` (the attempt's start and end, its
  step, and that step's model calls) and `runs` (each run job's execution).
- **`public.edit_jobs`** (select only): each job's `created_at`, lease and
  heartbeat (a container's claim), deferrals (0 for every job), `phase_ms`.
- **`public.edit_traces`**, by slug and time window, a candidate match:
  - each job's trace, with its `where` (`container` for every job);
  - its `deadlineAt`, which is set when the queue consumer took the message
    (50 minutes ahead).
- **The routing answer**, in the saved network log. At acceptance part 0 was
  `queued`, and parts 1 and 2 were both `preparing`, so both were claimed in
  the same write that filed part 0's job.

## The timeline

Times are from the request's acceptance, 23:07:35.207 UTC.

| When | What |
|---|---|
| +0.0 s | Accepted. Part 0's job (the price, `data`) filed (row created 23:07:38.0). Parts 1 (the LinkedIn footer link) and 2 (the heading) claimed for preparation. All three queue messages sent. |
| +5.0 s | **Part 1's preparation taken** by a consumer. Its routing ran first. |
| +19.7 → +31.8 s | Part 1's **step**: the add-on picker, 1 model call. |
| +33.0 s | Part 1's preparation answered, `stopped` (the add-on hands the link to the menu step). |
| +36.2 s | **Part 2's preparation taken**, 3.2 s after part 1's ended. |
| +49.2 s | Part 2's preparation answered, `routed`: routing only, no step. |
| +53.2 s | **Part 0's job message taken** by a consumer (its trace's deadline), 4.0 s after part 2's ended and 50 s after the job was filed. |
| +55.3 s | Its container claimed the job (lease heartbeat 23:08:30.5). |
| +57.5 → +82.5 s | **Part 0's job executed** in the container (progress record opened and closed). |
| +99.7 s onward | Part 1's routing job, hand-over and question; part 2's routing and heading jobs; then, after the answer, part 1's menu job. All one after another, the site's writes held by its lock. |

## Why the preparation did not overlap a job

**Queue delivery, in dispatch order.**
- The three messages sent at acceptance were processed strictly one after
  another. Each started 3–5 s after the one before had ended: part 1's
  preparation, part 2's, then the job.
- The queue consumer allows one message per invocation and up to 250 at once
  (`wrangler.jsonc`), so this was not batching. At that moment the platform
  ran the three consumer invocations one at a time. The evidence shows that
  it did; it cannot show the platform's reason.
- **The driver sent the preparations before it filed the job**
  (`advanceRequest`: `sendRequestPreps`, then `fileRequestJob`). In that
  order, the job waited behind every preparation and began executing only
  after both had ended.

**What it was not:**
- **Container startup.** The consumer took the job at +53.2 s, the container
  claimed it at +55.3 s, and it ran from +57.5 s: about 4 s in all.
- **A dependency.** Part 0 needed nothing, and parts 1 and 2 needed
  nothing of part 0. The routing named no dependencies (`dependsOn: null`).
- **A deferral or a busy site.** Every job's `deferrals` is 0, and the
  50-second gap came before the first claim.
- **Overwritten evidence.** Each part had one attempt (`seq` 1), so nothing
  was replaced. The kept record was complete for this run, but a retried
  preparation would have lost its earlier attempt's timings (fixed below).
- **The claim time** (when each preparation was sent) was not served. It is
  known here only from the routing answer's `preparing` reading at +0 s
  (fixed below).

**Part 2's step was held back, rightly.** Part 2 is the heading, on
`page:/order`. Part 1's routing named its target `footer`. A footer is
written into every page file, and `clearToPrepare` treats a `footer` write
as feeding every `page:` input (`request-plan.mjs` `feeds`). Part 1 comes
before part 2 in apply order, so part 2's text step would have been prepared
against `order.tsx` before part 1 changed it, and its job would only have
asked again. Its routing was prepared; its step was not. That is a necessary
conflict, not a defect.

**Preparation beside preparation:** none. Part 2's preparation began 3.2 s
after part 1's ended. Part 2 also made no step, so even at once it would have
been routing beside a step, not two pieces of work.

## The correction

1. **The job before its preparations** (`worker.js`, `advanceRequest`). The
   step's job is filed, and its message sent, first; the preparations
   claimed in the same step are sent after it, in a `finally`, so a filing
   that throws still sends them. A consumer that fires a job into the site's
   container returns in seconds, so a queue that delivers one message at a
   time now runs the job first and the preparations beside it.
   - Nothing waits that did not wait before.
   - Dependencies, the site's write lock, the stale-result check (a job
     reuses a prepared answer only when its request is byte for byte the
     same) and single charging are untouched.
   - No routing or scenario-specific rule is added.
2. **Every attempt kept** (`builder/request.mjs`). A preparation claimed
   again keeps the attempt it replaces in `prepPast`, the last 6
   (`PREP_PAST_KEPT`), with its timings. The view serves them all as
   `prepRuns` when there is more than one.
3. **The claim's time served**: `prepRun.sent` is when the preparation was
   claimed and its message sent.
4. **The check widened, never loosened** (`overlapVerdict`). It reads every
   attempt, and it also passes when **two parts' substantive prepared steps
   ran at once**: each step made a model call, of different parts, by their
   recorded intervals. The owner's goal is concurrency of the work, even
   while publishing stays one at a time. These still fail: routing beside a
   step, one part's two attempts, queued or prepared labels, and missing
   records.
5. **The timeline, readable** (`requestTimeline`). The canary prints every
   preparation attempt (claimed, taken, step and calls, answered, outcome)
   and every job's execution, in clock order from acceptance, right after its
   checks. A run's diagnosis no longer depends on the artifact. Over run
   117's saved views it prints the table above.

## Tests

- **`test/parallel-dispatch.test.mjs`**, through the real Worker, routing
  route and queue consumer:
  - at acceptance the job is queued before the preparations;
  - on a queue that delivers in order, one at a time, with a fired job
    running beside the next delivery (run 117's behaviour), the prepared
    picture step runs while the text job executes, by the view's intervals;
  - a re-claimed preparation keeps the earlier attempt, and both are served;
  - the kept attempts are bounded.
- **Red check**: the two dispatch cases fail on the code before the
  correction. The queue read `["request-prep", "site-edit", "edit-progress"]`,
  and no overlap was found.
- **`test/canary-parallel.test.mjs`**: two preparations together pass;
  routing beside a step, run 117's serial shape and one part's two attempts
  do not; an earlier attempt's overlap is read; the timeline's lines and
  order; the timeline reaches the press, and the press prints it.
- **Sweep**: 16 mutants over the dispatch order, the kept attempts, the
  served fields, the verdict and the timeline, all killed, and the
  comment-only control survived. The one survivor of the first pass (the
  timeline not handed to the press) was killed by the assertion added for
  it.

**Suite and CI**:
- full suite `10295 / 10295 / 0 / 0`;
- on `ac3e5eca`, unit tests green (run 38006507027, `10295 / 10254 / 0 /
  41`) and site build green (run 38006507026);
- predicted image `8d6dbcea93252fbb` (204 inputs).

## The follow-up press (fresh targets, not pressed)

`lv-parallel` is re-pointed. Read live (free GETs) before the change:
- every footer links to Facebook, Instagram, LinkedIn, TikTok and YouTube,
  none to X;
- `/order` reads *"Choose a loaf and a time to collect it"*;
- the focaccia is 4.6 (run 117 kept it).

The message puts the heading first, the price second and the footer link
last. In apply order the footer then holds back no earlier part's step, and
the price's data step (tables only) is clear to be prepared beside whichever
job runs first:

> Change the Order page heading 'Choose a loaf and a time to collect it' to 'Pick a loaf and a time to collect it', change the Sea Salt Focaccia's price to £4.70, and add a link to our X account in the footer.

> It's x.com/harbourloaf

The row is the focaccia 4.6 → 4.7, kept. The baseline record is the table
run 117 left (`LOAVES_R3`). The correction is product code (`worker.js`,
`builder/request.mjs`), so the press reads it only after a deploy.
