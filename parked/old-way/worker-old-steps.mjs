// PARKED (2026-11-03, park-old-way; the owner: "Just put it in a parked file
// that we won't use."). The old way's code taken out of worker.js at 014a7cd31.
// NOTHING IMPORTS THIS FILE, and it is not meant to run: each route fragment is
// kept verbatim inside a function of its own name so the file still parses
// (`node --check`), and it reads the route's own local variables, which are not
// here. See parked/old-way/README.md.
// ── What these pieces imported from builder/ (kept as a list, not loaded) ──
/*
import { ACCESS_PRESETS } from "./site-access.mjs";
import { EDIT_FIELDS, hasValue } from "./builder/site-edit.mjs";
import { MARKS, MARK_UPLOAD, markRemove } from "./builder/site-mark.mjs";
import { accessShortfalls, accessHandTo } from "./builder/addon-existing.mjs";
import { addedByRoute, publishedTexts, componentEvidence } from "./builder/content-evidence.mjs";
import { applyStyle } from "./builder/site-style.mjs";
import { auditTier } from "./site-schema.mjs";
import { callFailure } from "./builder/build-call.mjs";
import { changedSelectors } from "./builder/site-freecss.mjs";
import { clarifyCall } from "./builder/clarify.mjs";
import { declaredDoes } from "./builder/page-keep.mjs";
import { designOnly as planDesignOnly, routeInScope } from "./builder/request-plan.mjs";
import { editPlanFacts, editPublishFacts, editAppliedFacts, editStepStartFacts, editStepFacts, editCorrectFacts, editRepublishFacts, addonPickedFacts, addonDesignedFacts, addonSchemaFacts, addonPagesFacts, addonPhotosFacts, addonPublishFacts } from "./builder/site-progress.mjs";
import { errorFacts } from "./builder/provider-retry.mjs";
import { exerciseTables } from "./builder/requirement-exercise.mjs";
import { frameTables } from "./builder/site-frame.mjs";
import { heldTouches } from "./site-draft.mjs";
import { holdRequirements, heldNote } from "./builder/site-requirements.mjs";
import { keepCheck, unsurePhrases } from "./builder/page-keep.mjs";
import { keepWithheldMsg, KEEP_UNCHECKED_MSG } from "./builder/page-keep.mjs";
import { landedBill, partKey, writtenPartKeys } from "./builder/change-salvage.mjs";
import { langTargetOf, overridesFromEdits, addOverrides, overrideNote } from "./builder/lang-override.mjs";
import { mapCall } from "./builder/site-map.mjs";
import { mergeAddonPages, mergeAddonSchema, unlinkedPages, keptPartsNote, unseenPartsNote, unseenPagesNote, orderingMoved, settleReverted, problemsShipped } from "./builder/site-addon.mjs";
import { newMigration, withApplied } from "./builder/site-migrations.mjs";
import { noteFor, pickAdds, designWaits, ADD_KINDS, mergePageBatches, runAdd, addRequest, runJudge, judgeItems, cleanAdd, foldAdds, addLayerIn, frameToMissing, addRefusal, alreadyReply, backendDesigned, pageless, APPLIED_KINDS, existingFacts, addRepairRound, addRepairNote, rewroteMsg, lostPhotosMsg, unionSpec, siteNote, shownSchema, appliedFacts, auditFrontend, missingPages, missingPagesNote, droppedNote, deadQrs, deadQrNote, routedSources, qrShownSources, qrDestinationCheck, missingPopulation, readTables, populationNote, seedSkipNote, refusedNote, warningReport, failureNote, requiredColumns, rowMarkerKey, duplicateRows, duplicateAsk, duplicateAnswer, readSavedRows, readRowMarker, rowBrief, rowWriteOutcome, rowUncertainBody, wordsLanded, photosLanded, notLandedMsg, noPhotoMsg, menuLinkAdds } from "./builder/site-add.mjs";
import { othersOpenIn } from "./builder/request.mjs";
import { ownerOf } from "./builder/site-requirements.mjs";
import { pageComponents, tableFacts, ownPhotos } from "./builder/site-add.mjs";
import { partPath, partNameOf, PART_DIR } from "./builder/site-files.mjs";
import { partsReached, partKeepCheck, partSaid, partsHeldMsg } from "./builder/part-keep.mjs";
import { patchQr, qrRefusal, qrUnplaced } from "./builder/site-qr-list.mjs";
import { photoInventory } from "./builder/site-images.mjs";
import { pickLanes, runLane, reaskLane, LOOK_DECLINED_REASON, laneLayer, laneUnbuilt, laneEscalate, OWN_LANES, themeNote, landmarkNote, verbLayer, takeOffLane, runTakeOff, takeOffRefusal, takeOffNote, mergePageSteps, pageStepDone, samePageOperation, doorLane, doorDispatch } from "./builder/site-lanes.mjs";
import { priorRefusalOf } from "./builder/prepared.mjs";
import { proposedSpec, SPEC_OF_KIND } from "./builder/site-add.mjs";
import { publishedForms, routeCode, renderedForms, renderedSubmits } from "./builder/requirement-verify.mjs";
import { readDeviceHint } from "./builder/device-scope.mjs";
import { readLabels } from "./builder/request.mjs";
import { rejectReply, valueDigest } from "./builder/prepared.mjs";
import { renameRequest, readRename, readForget } from "./builder/site-alias.mjs";
import { renderedTexts } from "./builder/content-evidence.mjs";
import { requirementReport, toldNote, propertyNote, requirementRecord, unresolvedRequirements, requirementCounts, requirementOutcomes, requirementBrief, groundRequirements, carrySuperseded, supersededNote, handoffsByStep, applyVerdicts, COVERAGE_STEPS, linkEvidence } from "./builder/site-requirements.mjs";
import { requirementRetryRound, judgedNeeds } from "./builder/requirement-retry.mjs";
import { resolveAccess } from "./site-access.mjs";
import { routeMessage, siteDigest, DOOR_LAYERS, wordsIn } from "./builder/site-ask.mjs";
import { rowUnmet, designedNothing, featureBrief } from "./builder/addon-existing.mjs";
import { runDataEdit, dataChanges, renamePages, renameRoute, MAX_DATA_ROWS, freshRecent, PUT_BACK_READ_MAX } from "./builder/site-apply.mjs";
import { runLogoEdit } from "./builder/site-logo.mjs";
import { runNavEdit, applyAdditions, menuLinksKept } from "./builder/site-nav.mjs";
import { runPictureEdit, newEmptySlots, newListFrames, codeFigureRemoval } from "./builder/site-picture.mjs";
import { runRulesEdit } from "./builder/site-rules.mjs";
import { runTweak, keptProse } from "./builder/site-tweak.mjs";
import { shownContext } from "./builder/clarify.mjs";
import { shownPhotos, keptImages, keepPhotos, photoUrls, newImageRefs, strayImages, dropStrayPhotos, imageNote, imageRefs, photosNotMade } from "./builder/site-images.mjs";
import { staleContactLinks } from "./builder/site-text.mjs";
import { stepMsg } from "./builder/edit-failure.mjs";
import { storeAttachedPhotos, attachedFirst } from "./builder/attached-photos.mjs";
import { themeCss } from "./builder/site-theme.mjs";
import { uploadKeyFor, hasPendingMark, frameParser } from "./builder/site-images.mjs";
import { upsertMigration } from "./builder/site-migrations.mjs";
import { validatePages, lintPages, mergeParts, partsSent, priorPagesSent, sceneOn } from "./builder/page-gen.mjs";
import { wideningFacts } from "./builder/site-reply.mjs";
import { wordsLess } from "./builder/site-ask.mjs";
import { writtenFrame, runFrameEdit, addFrameLinks, FRAME_PARTS } from "./builder/site-frame.mjs";
*/
// ── Module-level helpers only the old steps called ──

/** How many requirements one judgment call is given (round 13); more are judged in further calls, never dropped. */
const JUDGE_BATCH = 24;

/** At most this many later steps of one edit are prepared at once — within the job's own preparation budget. */
const STEP_AHEAD_MAX = 3;

/** The steps of one edit whose model work is prepared beside the steps before them: those that make model calls of their own. */
const STEP_AHEAD_LAYERS = new Set(["text", "picture", "nav", "page", "data", "rules"]);


/**
 * THE FIELDS A SITE CARRIES ONE OF, so the addon step refuses a second and
 * names the door that changes the first.
 *
 * `qr` CAME OFF THIS LIST ON 2026-09-03 (owner: "it should carry more"): a site
 * carries up to `MAX_QRS` named codes, so a second code is an addition, and
 * what is refused instead is a code with the same NAME or the same DESTINATION
 * as one it has — by `cleanAdd`, which reads the stored list. `ADD_ONLY_FIELDS`
 * above answers a different question (may the EDIT path create one?) and `qr`
 * stays on it: a code the site does not have is still the addon step's to make.
 */
const SINGLE_FIELDS = ["three"];


// THE SPINE UNDER ITS OWN NAME, so a caller that SHADOWS `recompileAndPublish`
// can still reach the real one. The edit route does exactly that: it binds a
// deferring wrapper of the same name so its eight layer branches keep their code
// unchanged, and calls this to publish once at the end. Taking the alias inside
// that block instead is a temporal-dead-zone throw — the shadow hides the
// original from its own initialiser.
const publishSpine = (...a) => recompileAndPublish(...a);

/**
 * The customer's sentence for a schema the engine refused to apply. Nothing
 * is activated and nothing charged once the consumer's refund lands: since
 * stage 8 the apply runs after the compile and before the publish gate, so
 * the live pages are what they were.
 *
 * ⚠ AND "YOUR SITE IS UNTOUCHED" WAS NOT TRUE OF THE DATABASE (2026-10-06).
 * `applySiteSchema` runs one statement at a time, outside a transaction, and
 * a refusal is a throw from whichever one failed — so the tables before it
 * may already stand. What went in is not known, and the sentence says so; a
 * second ask applies the rest without making anything twice, because every
 * statement the engine emits is additive or `IF NOT EXISTS`.
 */
const ADDON_SCHEMA_FAIL_MSG = "That change needed the site's database and it couldn't be applied — this is on us. Your live pages weren't changed, but some of the database change may already have gone in before it stopped; asking again won't make anything twice. Try again in a few minutes.";

const mappedCall = (env, slug, kind, call, opts = null) => mapCall(call, siteMapNote(env, slug, kind, opts));

/**
 * The same for a picture bought for a description. A REQUEST PART'S JOB buys
 * through its purchase guard (2026-10-09, round 3): a picture its preparation
 * bought is answered from the staged record, and any other is bought once as
 * that part's logical purchase, whoever began it.
 */
const jobImage = (job, generate) => {
  if (job && job.prepare === true && job.noBuy === true) return async () => { throw new Error("no purchase in a step's preparation"); };
  if (job && job.prepare === true && job.rec) return job.rec.image(generate);
  const once = job && job.purchase ? job.purchase.image(generate) : generate;
  return job && job.replay ? job.replay.image(once) : once;
};

/**
 * THE SAME FOR A TRANSPORT CALLED `(keys, req, budget)` — the page writer's
 * (2026-10-09): one request in, its answer out, recorded or replayed by the
 * request it sent, exactly as `jobSend` does for a plain send.
 */
const jobCall = (job, call) => (keys, req, budget) => jobSend(job, (r) => call(keys, r, budget))(req);


// ── Credits: 1 credit = $0.008 of fal cost, charged BEFORE fal is called ──
// The ledger lives in Postgres (public.credits + use_credits/get_credits,
// SECURITY DEFINER, RLS owner-only). The Worker calls it under the caller's
// own JWT, so the client can display but never mint credits.
const CREDIT_USD = 0.008;

// The pair a `display` table resolves to. Named once, from the presets, so the
// data layer's gate cannot drift from the vocabulary again — it was compared
// against "anyone", which is a WRITE level, and matched nothing on any site.
const DISPLAY_PAIR = ACCESS_PRESETS.display;


/** The ids of every purchase begun for one request part, read off its records' keys; an unreadable listing hides nothing. */
async function partPurchases(env, { slug, key, n }) {
  const out = new Set();
  try {
    const prefix = purchaseKey(slug, key, n, "").slice(0, -".json".length);
    let cursor;
    for (let i = 0; i < 10; i++) {
      const page = await env.SITES_BUCKET.list({ prefix, cursor });
      for (const o of (page && page.objects) || []) { const m = /-([0-9a-f]{24})\.json$/.exec(o.key); if (m) out.add(m[1]); }
      if (!page || !page.truncated || !page.cursor) break;
      cursor = page.cursor;
    }
  } catch { /* an unreadable listing hides nothing: the request may then differ, and is asked again */ }
  return out;
}


/**
 * A PART HELD ON A PURCHASE NOBODY CAN TELL: its job's answer — nothing
 * published, nothing charged — naming each purchase (`held`), which the
 * request records on the part (`uncertain`).
 */
function heldPurchase(unknown) {
  const held = unknown.map((u) => ({ id: u.id, d: String(u.d || "").slice(0, 300), why: u.why }));
  // MADE AND NOT STORED YET (round 4) is said apart from a purchase whose
  // outcome nobody knows: the picture exists and saving it is what is retried.
  const saving = held.length > 0 && held.every((h) => h.why === "store-pending");
  // A FRAME THAT COULD NOT BE READ JUST NOW (round 7): the purchase is not in
  // doubt, so the sentence does not say it is.
  const reading = held.length > 0 && held.every((h) => h.why === "frames-unreachable");
  return Response.json({
    ok: false, error: "purchase-unconfirmed", cost: 0, held,
    msg: reading
      ? "I couldn't check the empty frame" + (held.length === 1 ? "" : "s") + " on your page just now, so I'll try putting the photograph" + (held.length === 1 ? "" : "s") + " in again shortly — nothing was bought again and the page wasn't changed."
      : saving
      ? "The picture" + (held.length === 1 ? " was" : "s were") + " made but I couldn't save " + (held.length === 1 ? "it" : "them") + " yet, so I'll keep trying to save the same " + (held.length === 1 ? "one" : "ones") + " — I haven't bought another or changed the page."
      : "I started buying " + (held.length === 1 ? "a picture" : held.length + " pictures") + " for this and can't tell yet whether the purchase went through, so I haven't bought it again or changed the page.",
  }, { status: 409 });
}


/** An addition's marked frames to fill, read strictly from a job's body (round 5): `{ id, d, k }` each. */
function readPlace(v) {
  return (Array.isArray(v) ? v : []).filter((x) => x && typeof x === "object" && typeof x.id === "string" && /^[0-9a-f]{24}$/.test(x.id) && typeof x.d === "string" && Number.isInteger(x.k) && x.k >= 0)
    .slice(0, 12).map((x) => ({ id: x.id, d: x.d.slice(0, 300), k: x.k, located: x.located !== false }));
}

/**
 * WHAT THIS LATER STEP WAITS FOR: the earlier steps whose writes reach what it
 * reads (2026-10-11, round 10). Prepared before they apply, its turn would
 * only ask again — a call made for nothing; prepared after, it reads what they
 * left. (Its turn's exact-request check still decides reuse.) A withheld step
 * writes nothing and is never waited for.
 */
function stepNeeds(steps, i) {
  const reads = stepReach(steps[i]).reads;
  const out = [];
  for (let j = 0; j < i; j++) {
    if (steps[j].withheld) continue;
    if (stepReach(steps[j]).writes.some((w) => reads.some((r) => stepTouches(w, r)))) out.push(j);
  }
  return out;
}


/**
 * MAY A ROW OR A RULE BE WRITTEN NOW? (2026-10-23, audit S3-2) The data and
 * rules lanes publish nothing, so the edit route's pre-publish gate never ran
 * for them and a Stop was acknowledged and then applied and charged. Asked
 * after the reserve and before the first write: the lease is renewed once, so
 * a cancel set while the job was queued is read now rather than at the next
 * heartbeat, and the job's own gate answers. `null` means go (and on the
 * synchronous path, which has no job); otherwise the reason, for `editStopped`.
 */
async function applyStop(job) {
  if (!job || typeof job.gate !== "function") return null;
  if (typeof job.beat === "function") { try { await job.beat("apply"); } catch { /* a blink is not a cancel */ } }
  const g = job.gate("apply");
  return g && g.go === false ? String(g.why || "cancelled") : null;
}


/**
 * CLOSE OUT EDITS WHOSE CONSUMER DIED.
 *
 * `max_retries` is 0, so nothing redelivers a message whose isolate was stopped
 * — the job would otherwise sit `building` for ever with the customer's credits
 * held against work that ended. This is the only thing that can notice.
 *
 * THE DECISION IS POSTGRES'S, NOT THIS FUNCTION'S, and that is deliberate: a
 * job that died DURING the publish is not an ordinary loss. Its site Worker
 * upload may or may not have landed, and nobody outside can tell — so
 * `edit_sweep_lost` routes those to `needs_review` with the money untouched and
 * counts them separately, while every other stale job refunds atomically. Doing
 * that comparison here would put the rule two places.
 *
 * BOUNDED, and it shares a two-minute tick with five other jobs.
 */
/**
 * A QUEUED EDIT THAT STOPS WITHOUT PUBLISHING.
 *
 * ── THE OWNER'S RULE, IN ONE PLACE ────────────────────────────────────────
 *
 * "If a required phase cannot safely begin: publish nothing unless the current
 * build has already passed verification; retain the currently live site; persist
 * the terminal phase and reason; refund atomically when appropriate."
 *
 * Every caller reaches here BEFORE the spine writes anything, so "retain the
 * currently live site" is a property of where this is called from rather than
 * something it has to undo. Nothing here touches R2.
 *
 * "WHEN APPROPRIATE" IS DECIDED BY POSTGRES, NOT HERE, and that is the point of
 * routing it through `edit_refund`: it refuses a published job outright, and it
 * routes a job that had already begun publishing to `needs_review` with the
 * money untouched. This function cannot accidentally refund an edit that shipped
 * because it is not the thing that decides.
 *
 * ONE PLACE, because this repo's own rule is that a new failure mode is
 * classified once rather than remembered at each call site — the argument
 * `publish-pages.mjs` makes about `settle`, and the reason run 90's page was
 * lost across four separate failure branches.
 */
async function editStopped(env, { job, why, phase, trace, ctx, msg, kept = false, landed = [], extra = null }) {
  const r = await editRpc(env, "edit_refund", { p_id: job.id, p_state: why === "cancelled" ? "cancelled" : "failed", p_note: why + " at " + phase });
  try { if (trace) trace.mark("stopped", "fail", { why, phase, refunded: Number((r && r.refunded) || 0) }); } catch { /* never */ }
  const review = !!(r && r.error === "needs-review");
  // A CHANGE THE ROUTE COULD NOT PUT BACK IS SAID (2026-09-25). The caller
  // restores the design the edit wrote before it stopped (`restoreEditConfig`);
  // when that restore failed the change is still saved, unpublished, and the
  // next edit would ship it — which the customer is owed before that happens.
  const keptNote = kept && !review ? KEPT_CHANGE_NOTE : "";
  // WHAT ALREADY WENT THROUGH, AS A LIST AS WELL AS IN WORDS (2026-10-07), so
  // the request and the reply read it (`leftOf`) rather than parse a sentence.
  const landedList = (Array.isArray(landed) ? landed : []).filter((n) => typeof n === "string" && n);
  return Response.json({
    // AND THE CALLER'S OWN EVIDENCE OF WHAT STANDS (2026-10-07, `extra`): an
    // addition's outcome and requirement outcomes at its gates, read off the
    // same evidence its failures carry; never the fields below.
    ...(extra && typeof extra === "object" && !Array.isArray(extra) ? extra : {}),
    ...(landedList.length ? { landed: landedList } : {}),
    ok: false,
    error: why,
    phase,
    cost: 0,
    refunded: Number((r && r.refunded) || 0),
    review: review || undefined,
    msg: (msg || (why === "cancelled"
      ? "I stopped that edit before anything was published."
      // THE PROCESS WAS STOPPED (stage 5d): the container's build service
      // ended the job — past its deadline, or shut down under it — and the
      // job answered at its next gate. Nothing published, the reserve back.
      : why === "stopped"
        ? "That change was stopped before it could publish — the service running it was shut down or ran past its time limit. Send it again in a few minutes."
      // ITS TURN TO PUBLISH WAS LOST (2026-10-15): another change of the same
      // request took the site's turn after this one stopped renewing it, so
      // this one stopped rather than publish over it.
      : why === "turn-lost"
        ? "That change was stopped before it could publish — another change in the same request took its turn to publish, so nothing of this one was published. Send it again."
      // THE PUBLISH FLOOR (run 33, 2026-09-03): refused before the container,
      // so nothing ran and nothing was published. What anything cost is the
      // reader's to say, from the job's own row (`servedEditReply`).
      : why === "time"
        ? "That took longer than the time we allow for one change, so I stopped before publishing. Try again, or ask for it in two smaller steps."
      : review
        ? "That edit stopped while it was publishing and I can't tell yet whether it went live, so I've paused " +
          "edits on this site until that's settled."
        : "That edit ran out of time before it could publish safely, so nothing was published.")) + keptNote
      // AND WHAT ALREADY WENT THROUGH OUTSIDE THE PUBLISH (2026-09-25).
      + landedSaid(landed),
  }, { status: review ? 409 : 503 });
}


/**
 * THE ASK THE LOOK BRANCH GIVES THE PAGE RUNG TO PLACE THE QR CODES NO PAGE
 * SHOWS YET.
 *
 * Fixed words rather than the customer's, because the customer asked for a
 * code and this step is the page change that shows it. Names the bindings
 * exactly (`SITE_QRS.<name>`), the way `marksDirective` does, so the rung uses
 * the generated file rather than drawing a code of its own — and names the
 * COMPONENT, because `Figure` and `MediaCaption` are both captioned figures
 * and a page that guesses which one takes children does not compile (runs
 * 84/85). A function of the unplaced names since the list (2026-09-03): a
 * site with three codes and one already on the page is asked for the other
 * two by name, never for "the QR code".
 */
function qrPlaceAsk(names) {
  const list = (Array.isArray(names) ? names : []).filter((n) => typeof n === "string" && n);
  const n = list[0] || "qr";
  const one = list.length <= 1;
  return "Show " + (one ? "this site's QR code `" + n + "`" : "these QR codes of the site's: " + list.map((x) => "`" + x + "`").join(", ")) +
    " on the page: render <Figure caption={SITE_QRS." + n + ".label}><img src={SITE_QRS." + n + ".src} alt={SITE_QRS." + n + ".label} /></Figure>" +
    " (Figure from @/components/ui/figure, SITE_QRS from @/site-brand" + (one ? "" : "; one Figure per code, its name in place of `" + n + "`") + "), " +
    "guarded on its entry, at least 120px wide, in the contact or closing section where a visitor would look for it. " +
    "Change nothing else on the page.";
}


/**
 * WHAT ONE STEP CHANGED OUTSIDE THE ONE PUBLISH (2026-09-25), in the words the
 * failure reply adds. A new address, a forgotten one, a saved row and a table
 * rule are each live the moment their rung writes them, so a publish that
 * fails afterwards does not undo them — and the reply used to say "your site
 * is untouched" over them. Read off the step's own success body; a step that
 * changed nothing outside the publish answers "".
 */
function landedNote(bd) {
  if (!bd || bd.ok !== true) return "";
  if (typeof bd.renamed === "string" && bd.renamed) {
    return "your site is now at " + (siteHostFor(bd.renamed) || bd.renamed) + ", and the old address sends people there";
  }
  if (typeof bd.forgot === "string" && bd.forgot) return (siteHostFor(bd.forgot) || bd.forgot) + " no longer answers";
  const tables = (list) => [...new Set((Array.isArray(list) ? list : []).map((a) => a && String(a.table || "")).filter(Boolean))];
  if (bd.layer === "rules") {
    const t = tables(bd.applied);
    if (t.length) return "your change to the " + t.join(", ") + " table" + (t.length === 1 ? "" : "s") + " is in place";
  }
  if (bd.layer === "data") {
    const t = tables(bd.applied);
    if (t.length) return "the rows you changed in " + t.join(", ") + " are saved";
  }
  return "";
}


/**
 * THE PAGE PRESERVATION CHECK'S ANSWER AS A RESPONSE, or `null` to go on
 * (2026-09-24). See `builder/page-keep.mjs` for what is compared and what the
 * judge's quote does and does not prove.
 *
 * ONE WRITER FOR BOTH PAGE WRITERS — the cheap tweak and the rewrite refuse in
 * the same words, `withheldPhotosMsg`'s rule one protection over. The shape is
 * the photo refusal's (`error: "withheld"`, cost 0) so everything that already
 * reads that refusal reads this one unchanged: the merge counts the step as
 * having written nothing, the browser adds the whole-request note only on a
 * complete refusal, and the job path refunds what nothing reserved.
 *
 * TWO REFUSALS, TWO SENTENCES. `withheld` is a loss the message did not ask
 * for — 409, the customer's to authorise. `unchecked` is a judge that could
 * not answer — 503 and ours, because the loss may well have been asked for and
 * we could not tell; publishing it anyway would be deciding for them.
 *
 * THE ITEMS RIDE ON THE REFUSAL, each with the reason it was not accepted, so
 * a refusal can be audited from the stored reply alone. Link words and
 * destinations are the customer's own; a component is named by its file name
 * here because this list is for a reader of the record, not the screen. A
 * group the judge declared rides too (`group`), so a refusal for a group
 * stretched over the wrong kind of thing (`group-other-kind`) says which group
 * was claimed.
 */
function keepRefusal(k, slug, extra = {}) {
  if (!k || k.verdict === "kept" || k.verdict === "asked") return null;
  const brief = (it) => ({
    kind: it.kind, label: it.label || undefined, href: it.href || undefined, to: it.to || undefined,
    name: it.name || undefined, section: it.section || undefined, group: it.group || undefined,
    why: it.why || undefined,
  });
  if (k.verdict === "withheld") {
    return Response.json({
      ok: false, error: "withheld", cost: 0,
      msg: keepWithheldMsg(k.unasked),
      contentBlocked: k.unasked.slice(0, 6).map(brief),
      ...extra,
    }, { status: 409 });
  }
  console.error("page keep check could not be made:", slug, k.why, (k.error && k.error.message) || "");
  return Response.json({
    ok: false, error: "withheld", cost: 0, ours: true,
    msg: KEEP_UNCHECKED_MSG,
    contentUnchecked: (k.items || []).slice(0, 6).map(brief),
    ...extra,
  }, { status: 503 });
}


/**
 * A PHOTOGRAPH WE WOULD NOT LOSE — SAID WITHOUT CLAIMING THE WHOLE SITE.
 *
 * ⚠ THE WORDING IS SCOPED TO THIS RUNG, and that is the whole of the
 * 2026-09-21 correction (owner: *"Partial-success wording makes whole-site
 * claims"*). REPRODUCED: the picture rung takes the window photograph off as
 * asked, the page rung withholds an unrelated change it could not make
 * safely, and the screen read
 *
 *     ✅ Took the picture off “the window”. ⚠️ … so I left your site exactly
 *     as it was.
 *
 * Both halves true of their own rung and the second FALSE of the request — a
 * picture really had just come off. The site was right; the sentence was not.
 *
 * THE CAUSE IS THAT A RUNG CANNOT KNOW. It is one step of a message that may
 * run several, its neighbours run after it, and `editOutcomes` prints its
 * sentence VERBATIM beside whatever shipped. So a step composing a claim about
 * the whole site is composing a claim it has no way to check — the same shape
 * as every other *"answered, wrongly"* defect in this file, one layer up in
 * the prose.
 *
 * SO IT SAYS WHAT IT DID: *"so I didn't make it"*. True of this rung whether
 * it stood alone or beside six others, which is what makes one sentence safe
 * in both places. **"Nothing changed" and "you haven't been charged" are
 * statements about the REQUEST**, and they are added by the browser's
 * complete-refusal branch, which is the one reader that can see `ok: false`
 * for the whole reply and therefore the one place they are true.
 *
 * ONE WRITER FOR TWO RUNGS — the cheap tweak and the rewrite both refuse this
 * way, and a second copy is how the two sentences drift into disagreeing about
 * the same outcome.
 */
function withheldPhotosMsg(n) {
  return "I couldn't make that change without taking " +
    (n === 1 ? "a photograph" : n + " photographs") +
    " off your site, and I couldn't put " + (n === 1 ? "it" : "them") +
    " back safely — so I didn't make it. Say " +
    "“take " + (n === 1 ? "that photo" : "those photos") +
    " off” if you did want " + (n === 1 ? "it" : "them") + " gone.";
}


/**
 * WHAT THE CUSTOMER READS WHEN A REMOVAL NAMES SOMETHING THIS ROUTE WILL NOT
 * TAKE OFF (2026-09-06).
 *
 * ONE SENTENCE PER LANE, IN THE LANE'S OWN WORDS, and never a generic "I can't
 * do that": the whole point of refusing by name rather than dropping is that
 * the customer learns which door their ask belongs to. `NOT_REMOVABLE` holds
 * the halves and this only joins them, so there is one copy of each reason.
 *
 * The lead-in is deliberately not an apology. It says what did NOT happen —
 * nothing was published — because the failure this replaces is a reply that
 * claimed a removal it never made. What it cost is the reader's to say.
 */
function cannotRemoveMsg(refused) {
  const list = (Array.isArray(refused) ? refused : []).filter((r) => r && typeof r.why === "string");
  if (!list.length) return "I couldn't take that off. Nothing was changed.";
  const parts = list.map((r) => r.why);
  const said = parts.length === 1
    ? parts[0]
    : parts.slice(0, -1).join("; ") + "; and " + parts[parts.length - 1];
  return "I didn't change anything, because " + said + ". Everything else on your site is exactly as it was.";
}


// brief + schema → route files → `tsc --noEmit` + `vite build` in the container →
// the dist published to sites/<slug>/.
//
// The decisions — pay for a repair pass? was the repair an improvement? publish at
// all? — live in builder/publish-pages.mjs, which takes every side effect as an
// injected function so they can be driven against fakes in test/publish-pages.test.mjs.
// This is only the wiring that supplies the real ones.
/**
 * The picture a link preview shows: one of the owner's own uploads.
 *
 * "THE FIRST THING THE OWNER UPLOADED" IS WHAT THIS SAID, AND IT IS NOT TRUE.
 * `siteUploadList` does not sort and never projects R2's `uploaded` timestamp, so
 * the objects arrive in lexicographic KEY order — and a key is a SHA-256 of the
 * file's own bytes. The pick is therefore the smallest hash among the owner's
 * objects: stable for a given set of files, and otherwise arbitrary. The pool also
 * holds photographs the platform bought and the owner's logo, since neither put
 * stamps `customMetadata.visitor`.
 *
 * NOT REORDERED, DELIBERATELY (owner-triaged — the residue is that you cannot
 * CHOOSE which). Sorting by upload time would silently swap the social card of
 * every live site holding two or more eligible objects, which nobody asked for —
 * and it would be worse than arbitrary rather than better: a first build's bought
 * photographs and the logo are the EARLIEST objects, so they would win permanently
 * over any picture the owner uploads afterwards. Arbitrary-but-neutral beats
 * systematically-wrong. The real answer is letting the owner pick, which is a
 * feature and not an ordering.
 *
 * EXTRACTED BECAUSE THERE ARE TWO PUBLISH PATHS AND ONLY ONE HAD IT. A build
 * derived this inline; the free text edit — which recompiles and republishes the
 * same site — never did, so fixing a typo silently stripped the site's preview
 * image. The same divergence dropped its description. Two implementations of
 * "publish this site" is how the second one quietly lacks what the first has,
 * which is the whole argument for one spine.
 *
 * ON THE SITE'S OWN DOMAIN, not the platform's. This is what WhatsApp and Slack
 * show when a customer shares the shop, so pointing it at the tool the business
 * happens to have been built with is the most visible place that leak can
 * appear. `siteOrigin`, not `siteUrlFor` — uploads hang off the origin, and
 * appending them to a site's home-page URL is the shape that already 404'd every
 * image on the platform once.
 *
 * Best-effort in both directions: no bucket, no uploads or a failed list all
 * mean a smaller card, never a failed publish.
 */
/**
 * THE SHARED SPINE: take a site's page source, compile it, publish it.
 *
 * No model call, no designer, no schema — source in, published site out. This is
 * the half of a build that every path needs and the half an EDIT needs on its
 * own: compile-and-publish sat at the END of a line built for creating a site
 * from nothing, so the only way to reach it was to walk all of it, which is why
 * "make the background yellow" cost the same ~28 credits as "build me a site".
 *
 * EXTRACTED FROM THE FREE TEXT EDIT, WHICH WAS ALREADY THE SECOND COPY. The
 * build path has its own, and the two had silently diverged: this one titled the
 * site with its SLUG, dropped its og:description and dropped its preview image,
 * because `injectMeta` replaces its fenced block and a field not passed is a
 * field removed. Nothing caught it — both paths compiled, both published, and
 * only reading them side by side showed it. One spine is the answer to that, and
 * the reason to do it before the cheap edit path rather than after.
 *
 * THE LOOK IS READ HERE, NOT PASSED IN, on purpose. A recompile that is handed a
 * look can be handed the WRONG one, and the failure is silent — the site comes
 * back re-themed by a caller that meant nothing by it. Reading the stored value
 * means the only way to change a site's look is to change what is stored.
 *
 * A FAILED COMPILE LEAVES THE LIVE SITE ALONE, and that is the whole contract of
 * the failure path: publishing a broken bundle to fix a typo is the trade nobody
 * would make. Returns `{ok:false, error, detail}` and touches nothing.
 */
/**
 * What to tell the owner when a recompile failed.
 *
 * ONE SENTENCE, NOT FIVE. Every lane that publishes through `recompileAndPublish`
 * had its own wording, and all of them blamed the customer's change — which is
 * right for a type error and wrong for our container being drained mid-deploy.
 * Measured 2026-08-11: a colour change answered `tsc was killed by SIGTERM` and
 * the owner was told their look "didn't compile".
 *
 * `pub.ours` is set only when the container was KILLED twice, which is a signal
 * that the process never got to judge the code at all.
 */
/**
 * THE REPLY A RUNG GIVES WHEN THE LEDGER REFUSED ITS RESERVE (2026-09-05).
 *
 * Asked BEFORE the rung's first write — a row, a rule, a table — so the
 * refusal prevents the write and not only the publish; the spine's own
 * `unbilled` answer covers the rungs whose only write is the publish. The
 * consumer's not-shipped refund returns whatever did land. 402 for a short
 * balance, 503 for a ledger that did not answer; the sentence is
 * `compileMsg`'s, so the two roads read the same.
 */
function unbilledReply(charges) {
  const { body, status } = unbilledBody(charges);
  return Response.json(body, { status });
}

/**
 * MAY THIS JOB WRITE THE SITE NOW? A job not running beside others of its
 * request: yes, as before. One that is: only while it holds the site's turn,
 * read now — a turn it once held but no longer does is lost (`loseTurn`), and
 * a turn that cannot be read is a no for this write.
 */
/**
 * MAY ANOTHER PART OF THIS JOB'S REQUEST BE RUNNING BESIDE IT? (2026-10-16)
 * True while any other part has not ended — it may be running, or be filed
 * beside this one — unless it waits on this one, and when the request cannot
 * be read (the safe answer).
 */
async function othersOpen(env, slug, request) {
  if (!request || !request.key) return true;
  try {
    const { rec } = await loadRequest(env, slug, request.key);
    // A PART THAT CANNOT START BEFORE THIS ONE ENDS is not beside it
    // (2026-10-23, audit S2-3: `othersOpenIn`).
    return othersOpenIn(rec, request.part);
  } catch { return true; }
}

/** File a fresh `pending` record for this job — replacing an earlier record of the same job — and answer it. */
async function recordSiteMigration(env, slug, entry) {
  const list = upsertMigration(await readSiteMigrations(env, slug), entry);
  await writeSiteMigrations(env, slug, list);
  return entry;
}


/**
 * EVERY OLD NAME A SITE HAS HAD — the demoted rows. Read fresh, never cached:
 * it feeds the rename model (so a "forget the old one" can be checked against
 * something) and the answer is a lane's business, not a page load's. An empty
 * list on a failed read is honest: a forget is then refused as a stranger,
 * which is the safe way for that lookup to be wrong.
 */
async function formerNamesFor(env, slug) {
  const s = typeof slug === "string" ? slug.toLowerCase() : "";
  if (!s || !env.SUPABASE_SERVICE_KEY) return [];
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/site_aliases?slug=eq.${encodeURIComponent(s)}&current=is.false&select=alias&order=created_at.asc`,
      { headers: svcHeaders(env), signal: AbortSignal.timeout(5000) });
    if (!r.ok) return [];
    const rows = await r.json().catch(() => null);
    return Array.isArray(rows) ? rows.map((x) => x && typeof x.alias === "string" ? x.alias.toLowerCase() : "").filter(Boolean) : [];
  } catch { return []; }
}



/**
 * DOES `/u/<slug>/<file>` REALLY SERVE BYTES — `true`, `false`, or `null` for
 * cannot tell (2026-09-19).
 *
 * Owner: *"Establish asset existence from the site's upload storage when
 * validation is needed. An unreadable check must remain unknown."* This is the
 * one reader of that question, and the stray-image wall's only source of truth
 * about what the site owns: an upload the owner made and has not placed on a
 * page yet is the site's, and nothing about the PAGES can say so.
 *
 * A HEAD, NOT A GET — `assetsFor`'s own `exists` is the precedent two thousand
 * lines up, and the question is existence rather than bytes.
 *
 * THREE ANSWERS, AND EVERY WAY OF NOT KNOWING IS THE THIRD: no bucket binding,
 * no `head` on it, or a throw. `uploadKeyFor` answering `null` is NOT one of
 * them and is a real `false` — it means the SERVE route's own shape rule
 * refuses this url, so no object in any bucket could make it fetch.
 */
async function siteUploadExists(env, slug, url) {
  const key = uploadKeyFor(slug, url);
  if (key === null) return false;
  const b = env && env.SITES_BUCKET;
  if (!b || typeof b.head !== "function") return null;
  try { return !!(await b.head(key)); } catch { return null; }
}


/**
 * THE TABLES A FORM IN THE WRITTEN FRAME MAY STORE INTO (2026-10-25,
 * frame-parallel): the site's own schema, read the catalog-aware way, read
 * only. `[]` for a site with no database; `[]` too when it cannot be read, so
 * the frame call is told none and a sign-up is answered `cannot` rather than
 * wired to a table nobody checked. Never throws.
 */
async function frameTablesOf(env, slug) {
  try {
    let conn = await siteBackendBySlug(env, slug);
    if (!conn) { const d = await siteBackendDetail(env, slug); conn = d && d.conn ? d.conn : null; }
    if (!conn) return [];
    const r = await specForAddon(conn);
    return r && r.ok ? frameTables(r.spec) : [];
  } catch (e) {
    console.error("frame tables unreadable:", slug, e && e.name);
    return [];
  }
}

/** Two routing calls' usage, added: what a job that asked twice is billed for. */
function sumRouteUsage(a, b) {
  const out = { ...b };
  for (const k of ["in", "out", "cacheRead", "cacheWrite"]) {
    const x = Number(a && a[k]) || 0, y = Number(b && b[k]) || 0;
    if (Object.hasOwn(a || {}, k) || Object.hasOwn(b || {}, k)) out[k] = x + y;
  }
  return out;
}

/** Do two digests list the same pages (as paths, in any order)? An unreadable list is never the same. */
function samePages(a, b) {
  const paths = (d) => (d && Array.isArray(d.pages) ? d.pages.map((p) => (typeof p === "string" ? p : p && typeof p.path === "string" ? p.path : null)) : null);
  const x = paths(a), y = paths(b);
  if (!x || !y || x.some((p) => p === null) || y.some((p) => p === null)) return false;
  const sx = [...new Set(x)].sort(), sy = [...new Set(y)].sort();
  return sx.length === sy.length && sx.every((p, i) => p === sy[i]);
}

async function wideningQuestion(env, { ask, widening, request, answers, picker, slug }) {
  if (!ask || typeof ask.text !== "string" || !repliesOn(env)) return ask;
  const read = wideningFacts(widening, ask.options);
  if (read.skip) return ask;
  let out;
  try {
    out = await writeReply({ send: mappedSend(env, slug, "site", quickSend(env, "reply", replyBudget)) }, {
      facts: read.facts,
      context: replyContext({ request, answers, site: { slug } }) + "\n\nWRITE ONLY THE QUESTION: ONE OR TWO SHORT SENTENCES, UNDER 240 CHARACTERS IN ALL.",
      model: modelsFor(picker).quick,
      maxChars: WIDENING_QUESTION_CHARS,
    });
  } catch { out = { ok: false, why: "send", usage: [], attempts: 0 }; }
  try { console.log("reply: widening question", out.ok ? "written" : "fell back (" + out.why + ")", "attempts", out.attempts); } catch { /* never */ }
  return out.ok && typeof out.text === "string" && out.text.trim() ? { ...ask, text: out.text.trim() } : ask;
}


/**
 * WHAT A STEP'S QUESTION LEAVES TO DO: the request its answer resumes, and
 * what they already told us that goes with it — `{ request, context }`.
 *
 * Each asking step's own part — the fixed request a branch gave it (our own
 * words, holding none of the customer's), its own words, or the turn — with
 * EVERY OTHER STEP'S OWN WORDS TAKEN OUT BY POSITION (`wordsLess`), whether
 * that step ran, failed or was withheld. Taken out of the asking step's own
 * words too, not only out of the turn: two steps can be given overlapping
 * words, and a change made beside the question must never be in what the
 * answer resumes, where the resumed router, picker and steps would read it and
 * make it again.
 *
 * "" WHEN NOTHING OF THE ASKING PART CAN BE TOLD APART FROM WHAT RAN: another
 * step ran on the whole turn, so its change could be anywhere in it; or every
 * word of the asking part is another step's too. The question is then not
 * kept (`askReport`), and that part is said as left alone — never resumed with
 * work that ran.
 *
 * THE ANSWERS STILL FOR IT GO WITH IT (2026-10-02, the owner's second review:
 * *"Preserve the answers relevant to unfinished operations while excluding
 * completed operations from execution"*). Every answer a step still asking was
 * shown rides on, to be shown again: the picker named it for that step's
 * change, or named it for no change at all (`told` on a step, the indices of
 * what it was shown; absent, every answer). An answer it named only for steps
 * that ran, failed or were withheld is `handled`: never shown to a model
 * again, and kept only so a model that asks it once more is answered from it
 * (`clarifyTransport`). Which answer belongs to which change is the picker's
 * decision; nothing here reads the customer's words.
 */
function askRemainder(asking, done, run, context) {
  const others = done.filter((d) => !asking.includes(d));
  const marks = others.map((d) => stepWords(d && d.step));
  const cut = marks.flatMap((m) => m.words);
  const wholeRan = marks.some((m) => m.whole);
  const parts = [];
  for (const d of asking) {
    const s = d && d.step;
    const m = stepWords(s);
    if (m.fixed) { parts.push(s.instruction.trim()); continue; }
    if (wholeRan) return { request: "", context: readContext(context) || [] };
    for (const w of m.whole ? [String(run || "")] : m.words) {
      const left = wordsLess(run, w, cut);
      if (left) parts.push(left);
    }
  }
  const told = readContext(context) || [];
  const keep = new Set();
  for (const d of asking) {
    const idx = d && d.step && Array.isArray(d.step.told) ? d.step.told : null;
    told.forEach((p, j) => { if (!p.handled && (idx === null || idx.includes(j))) keep.add(j); });
  }
  return {
    request: [...new Set(parts)].join("\n"),
    context: told.map((p, j) => (p.handled || keep.has(j) ? p : { ...p, handled: true })),
  };
}

async function framesFor(env, slug) {
  const parse = await frameParser();
  if (parse) return localFrames(parse);
  if (!env || !env.SITE_BUILD_CONTAINER || !slug) return localFrames(null);
  const ask = async (body) => {
    try {
      const c = getContainer(env.SITE_BUILD_CONTAINER, laneName(slug));
      const deadline = Date.now() + FRAMES_CALL_MS;
      const { answer, room } = await withRoom(async () => {
        const r = await c.fetch(new Request("http://build/frames", {
          method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
          signal: AbortSignal.timeout(Math.max(1000, deadline - Date.now())),
        }));
        return { status: (r && r.status) || 0, text: await r.text().catch(() => "") };
      }, { deadline, floorMs: 0 });
      if (room || !answer || answer.status !== 200) return null;
      const a = JSON.parse(answer.text);
      return a && typeof a === "object" && a.ok === true ? a : null;
    } catch (e) { console.error("frames: the container could not read them for", slug, errorClassForLog(e)); return null; }
  };
  const list = (v) => Array.isArray(v) && v.every((x) => x && typeof x === "object" && typeof x.token === "string" && typeof x.id === "string" && typeof x.file === "string");
  return {
    where: "container",
    mark: async (pages, ids) => {
      const want = Array.isArray(pages) ? pages : [];
      if (!want.length || !(ids instanceof Map) || !ids.size) return markPending(want, ids, null);
      const a = await ask({ op: "mark", pages: want, ids: [...ids] });
      const ok = a && Array.isArray(a.pages) && a.pages.length === want.length && a.pages.every((p) => p && typeof p.source === "string") && list(a.marked) && list(a.unlocated);
      if (ok) return { pages: a.pages, marked: a.marked, unlocated: a.unlocated };
      const blind = markPending(want, ids, null);
      return { ...blind, unlocated: blind.unlocated.map((u) => ({ ...u, why: "parser-unreachable" })) };
    },
    fill: async (source, id, url) => {
      if (!hasPendingMark(source, id)) return fillPending(source, id, url, null);
      const a = await ask({ op: "fill", source, id, url });
      if (a && typeof a.source === "string" && Number.isInteger(a.filled) && Number.isInteger(a.changed)) return { source: a.source, filled: a.filled, changed: a.changed, ...(a.unverified === true ? { unverified: true } : {}) };
      return { ...fillPending(source, id, url, null), unreachable: true };
    },
  };
}

/** Does a step's write reach what another reads? `site` reaches everything; `pages` every page. */
function stepTouches(w, r) {
  if (w === "site" || r === "site" || w === r) return true;
  return (w === "pages" && r.startsWith("page:")) || (r === "pages" && w.startsWith("page:"));
}

/**
 * WHAT ONE STEP OF AN EDIT WRITES AND READS, from the code's own wiring of
 * each rung (2026-10-11, the generality round) — the request planner's rule,
 * one level down: a page step its page; a text step its page, or every page
 * when none is named; the picture step the pictures and the page whose frames
 * it lists (every page when none is named — frames live in page source); the
 * menu step the menu, which every page renders; the data and rules steps the
 * tables. The look's own values step (a name, a colour) is taken to write the
 * whole site: renaming the business rewrites its name on every page.
 */
function stepReach(step) {
  const page = typeof step.page === "string" && step.page ? "page:" + step.page : "";
  // THE PAGES ITS OWN OPS NAMED, when its rung's page is not one.
  const on = page ? [page] : Array.isArray(step.on) && step.on.length ? step.on.map((p) => "page:" + p) : ["pages"];
  const whole = step.remove === true || (typeof step.rename === "string" && step.rename);
  switch (step.layer) {
    case "page": return whole || !page ? { writes: ["site"], reads: ["pages"] } : { writes: [page], reads: [page] };
    case "text": return { writes: on, reads: on };
    case "picture": return { writes: ["images", ...on], reads: ["images", ...on] };
    case "nav": return { writes: ["menu", "pages"], reads: ["menu", "pages"] };
    case "data": case "rules": return { writes: ["data"], reads: ["data"] };
    default: return { writes: ["site"], reads: ["site"] };
  }
}

/** The clause for every such step of a message, or "" when there is none. */
function landedSaid(notes) {
  const list = (Array.isArray(notes) ? notes : []).filter((n) => typeof n === "string" && n);
  return list.length ? " Part of it did go through, though: " + list.join("; ") + "." : "";
}

/** `unbilledReply`'s answer and status, for a route that adds to the answer (the add-on's `aFail`, 2026-10-06). */
function unbilledBody(charges) {
  const why = (charges && typeof charges.refusals === "function" && charges.refusals()[0]) || "rpc";
  const pub = { ok: false, error: "unbilled", ours: why !== "insufficient", detail: why };
  return { body: { ok: false, error: "unbilled", cost: 0, detail: why, msg: compileMsg(pub, "") }, status: why === "insufficient" ? 402 : 503 };
}


/**
 * THE READ-WIDENING QUESTION, WRITTEN FROM ITS FACTS (decide-all, sec-3): the
 * rules step found a widening that rests on no words of theirs (`widening`:
 * each table, who sees it now, who would after). The same writer and budget
 * as `repeatNote`; the answers stay the step's structured choices. The
 * question code composed (`ask`) is kept only when none can be written.
 */
const WIDENING_QUESTION_CHARS = 240;


/**
 * The digest the router is sent: the browser's, with the site's own table names
 * in place of the browser's whenever they can be read (2026-10-05; before,
 * only when it named none) — for a site the caller says exists, under a
 * well-formed slug, within `ROUTE_TABLES_MS`. Otherwise exactly what arrived.
 */
// ── A STEP'S QUESTION, KEPT BY THE ROUTE'S ONE ENDING (2026-10-02) ─────────
//
// Owner: *"Let edit and add-on steps request clarification too when they
// discover missing details after routing … preserve the original request,
// attachments, scope, deferred parts, and completed work across the answer …
// Resume with the answer incorporated without repeating completed changes or
// charges."* A step whose model asked (`builder/clarify.mjs`) writes nothing
// and charges nothing for the edit; the route's one ending (`askReport`) keeps
// the question as the site's live question, with what the answer must still do
// (`askRemainder`), and names it by its id. Steps that ran beside it keep what
// they did: their change is published and charged as before, and never in the
// request the answer resumes — even where two steps were given overlapping
// words (the owner's review, 2026-10-02: *"Fix askRemainder so overlapping
// model scopes cannot put completed work back into the resumed request"*).

/** The customer's words a planned step runs on: its own, none (a fixed ask), or the whole turn. */
function stepWords(step) {
  const s = step && typeof step === "object" ? step : {};
  if (typeof s.instruction === "string" && s.instruction.trim()) return { fixed: true, words: [] };
  if (Array.isArray(s.words) && s.words.some((w) => typeof w === "string" && w.trim())) {
    return { words: s.words.filter((w) => typeof w === "string" && w.trim()) };
  }
  if (s.opWords && typeof s.opWords === "object") {
    const ws = Object.values(s.opWords).flat().filter((w) => typeof w === "string" && w.trim());
    if (ws.length) return { words: ws };
  }
  if (typeof s.ask === "string" && s.ask.trim()) return { words: [s.ask.trim()] };
  return { whole: true, words: [] };
}

const FRAMES_CALL_MS = 30000;


async function saveAddonAnswer(env, slug, answer) {
  if (!env.SITES_BUCKET) return false;
  try {
    await env.SITES_BUCKET.put(ADDON_ANSWER_KEY(slug), JSON.stringify({
      at: new Date().toISOString(), slug, ...(answer && typeof answer === "object" ? answer : {}),
    }), { httpMetadata: { contentType: "application/json" } });
    return true;
  } catch (e) { console.error("addon answer save failed:", slug, e && e.message); return false; }
}

// ── The route fragments (worker.js line numbers at 014a7cd31) ──

/**
 * THE ADD-ON ROUTE'S OLD STEPS: the requirement report, the designer, the backend writes, the row step, the add-on publish (after the agent block of `/api/site/<slug>/addon`).
 * worker.js lines 43767-48943 at 014a7cd31.
 */
export async function addonRouteOldSteps() {

            // ── AN ENTRY THIS REQUEST HAS ALREADY SAVED (2026-10-01) ───────
            //
            // ASKED BEFORE THE PICKER, AND THAT ORDER IS THE GUARD. A queued job
            // can run twice (its lease expires mid-run, or the container dies
            // between the write and the stored reply) and a resent POST repeats
            // its retry key; a run that finds this request's entries already
            // saved answers what was saved — no model call, no second charge,
            // and no second guess at which kind it was, since a picker answering
            // `table` this time would take another road over a write already
            // made. The write itself carries the same key (`rowsInsert`), so two
            // runs racing past this read still save the entries once.
            //
            // ONLY ON A SITE WITH A LIST AN ENTRY CAN GO IN, so every other
            // addition reads nothing it did not read before.
            const aRowLists = adb ? rowTables(aSpec) : new Map();
            // AND THE COLUMNS AN ENTRY MUST FILL (2026-10-24, addon-existing).
            // READ FROM THE LIVE TABLE FIRST (2026-10-25, run 6): the spec can
            // differ from the database; the spec only when the read fails.
            const aRowRequired = adb && aRowLists.size ? (await requiredColumns((q, p) => sqlQuery(adb, q, p), aSpec, aRowLists)).required : new Map();
            const aRowKey = aRowLists.size ? rowMarkerKey({ job: aJob && aJob.id, idem: ab && ab.idem }) : "";
            // WHAT THE CUSTOMER IS TOLD, FROM WHAT THE DATABASE SAVED — every
            // entry's table, its own id and the row as stored, never the
            // request's wording. `added: []` and no publish: the pages read the
            // list as it stands, so the entry is on them already.
            const aRowsReply = (saved, { repeat = false, cost = 0, skipped = [], draft = undefined } = {}) => Response.json({
              ok: true,
              kinds: ["row"],
              rows: saved,
              repeat: repeat || undefined,
              notAdded: skipped.length ? skipped : undefined,
              added: [], changed: [], removed: [], moved: [],
              cost,
              // SAVED TO THE DRAFT, NOT LIVE (draft-first): the entry is held.
              draft,
            });
            // ── AN OUTCOME THIS STEP CANNOT SEE (2026-10-01, the reviews of
            //    f6532d66 and 31741f6f) ──────────────────────────────────
            //
            // The first reviewer committed the entry and its key, then threw
            // where the answer should have been: this step said "nothing was
            // added", the consumer refunded, and the next message saved the
            // entry a second time. A write whose answer is lost or cannot be
            // read is not a failure, it is not knowing — and the key it carried
            // is the one thing that can say what happened.
            //
            // PROTECTION COMES FIRST, AND NO WRITE IS ISSUED WITHOUT IT. The
            // second reviewer found the hole the first fix left: the job was
            // put under review only AFTER a write it could not see, so a mark
            // the ledger refused fell through to a refund, nothing held the
            // site, and the next message saved the entry again. Now a queued
            // job is marked (`edit_publish_mark`, the request's key as what
            // the write will leave behind) BEFORE the statement is sent, and a
            // mark that is refused or unanswered means no statement is sent at
            // all — "nothing was added" is then true, and the consumer gives
            // the reserve back. Once the mark stands, every road the ledger
            // has treats the job as one whose write may have happened: the
            // consumer's refund parks it under review with the money where it
            // is, the lost-job sweep parks it the same way, the site takes no
            // new job (`edit_create`), and only the reconcile settles it — by
            // the key, closing it first when it is still empty
            // (`rowReviewVerdict`).
            //
            // A KEPT RESERVE FOLLOWS A RECORDED OUTCOME. `edit_committed` is
            // called only when this step has read the entries back — from the
            // answer or from the key — and only then can the consumer's
            // finalize keep the money. A write the key cannot confirm is said
            // as not knowing, never as "nothing was added", and no sentence
            // here invites a fresh attempt: until the key answers, that
            // attempt is the duplicate.
            //
            // INLINE THERE IS NO JOB TO MARK. The charge follows a write that
            // was read back; one that was not is never charged, and the
            // customer is told to look (the recorded limit: nothing pauses the
            // site, so a new message can add a second entry).
            const aRowMarker = async () => {
              if (!aRowKey) return { state: "no-key" };
              let back = null;
              try { back = await sqlQuery(adb, "SELECT v FROM _meta WHERE k = ?", [aRowKey]); }
              catch (e) { console.error("addon row marker read-back failed:", ownerSlug, e && e.message); return { state: "failed" }; }
              if (!back || !back.length) return { state: "absent" };
              const was = readRowMarker(back[0] && back[0].v, aRowLists);
              return was ? { state: "found", was } : { state: "unreadable" };
            };
            // THE GUARD: ELIGIBLE AND PROTECTED, DECIDED BY THE LEDGER IN ONE
            // STATEMENT (2026-10-01, the review of c3e310e6). The mark alone
            // was not a guard: the live `edit_publish_mark` matches only the
            // job and its holder, and a refund keeps the holder on the row, so
            // a consumer that stalled while the sweep refunded its job came
            // back to a mark that still said yes — and wrote an entry its job
            // had been refunded for. `edit_may_publish` is the publish spine's
            // own gate: one conditional update, granted only to the holder of
            // a live lease on a job not finished, not refunded, not cancelled,
            // not under review and billed (`reserved`, or `exempt` for a
            // founder), and it starts the write in the same statement — so a
            // refund that wins makes it refuse, and one that loses finds the
            // write begun and parks the job instead.
            //
            // THREE STEPS, IN THIS ORDER. The gate first, so a job no longer
            // ours is never touched. The mark, for the request's key, which is
            // how the reconcile knows a row job by its row. The gate again,
            // LAST: the mark matches no more than the holder, so only a gate
            // granted after it can say the job is still ours when the statement
            // is sent. Anything but three yeses sends no statement. Inline
            // there is no job to ask.
            const aRowGate = async (when) => {
              const g = await editRpc(env, "edit_may_publish", { p_id: aJob.id, p_owner: aJob.owner, p_ttl: PUBLISH_LEASE_S });
              if (g && g.granted === true) return true;
              console.error("addon row: job", aJob.id, "may not write", when, "—", String((g && g.error) || "rpc"));
              return false;
            };
            const aRowGuard = async () => {
              if (!aJob) return true;
              if (!aRowKey) return false;
              if (!(await aRowGate("before its key is recorded"))) return false;
              const m = await editRpc(env, "edit_publish_mark", {
                p_id: aJob.id, p_owner: aJob.owner, p_artifact_build: aRowKey,
                p_dist_etag: null, p_sidecar_etag: null, p_source_etag: null, p_worker_status: null,
              });
              if (!(m && m.ok === true)) {
                console.error("addon row: job", aJob.id, "could not record its key before its write —", String((m && m.error) || "rpc"));
                return false;
              }
              return aRowGate("once its key is recorded");
            };
            // THE OUTCOME, RECORDED: the entries were read back, so the job's
            // reserve may be kept. A record the ledger refuses leaves the job
            // to the review, which reads the same key and keeps it there.
            const aRowCommitted = async () => {
              if (!aJob) return;
              const c = await editRpc(env, "edit_committed", { p_id: aJob.id, p_owner: aJob.owner, p_build: aRowKey });
              if (!(c && c.ok === true)) console.error("addon row: job", aJob.id, "saved entries the ledger could not record —", String((c && c.error) || "rpc"));
            };
            // NOT KNOWING, SAID: a queued job reaching here began its write at
            // the gate before any statement of this request was sent — this
            // run, or (an unreadable key, below) the earlier run that left it —
            // so its consumer parks it and the site waits for the key.
            const aRowsUnknown = (why, skipped = []) => {
              const review = !!aJob;
              aMark("add:row", "fail", { uncertain: why, review: review ? 1 : 0 });
              return Response.json(rowUncertainBody({ why, review, notAdded: skipped }), { status: review ? 409 : 502 });
            };
            if (aRowKey) {
              let seen = null;
              try { seen = await sqlQuery(adb, "SELECT v FROM _meta WHERE k = ?", [aRowKey]); }
              catch (e) {
                // `_meta` NOT EXISTING IS "NOTHING SAVED" — a database made and
                // never applied to — and is the only failure read that way.
                if (!(e && e.code === "42P01")) {
                  console.error("addon row marker read failed:", ownerSlug, e && e.message);
                  return aFailure("no-meta");
                }
              }
              if (seen && seen.length) {
                // AN EARLIER RUN SAVED UNDER THIS KEY, AND WHAT IT SAVED CANNOT
                // BE READ: its entries may be on the site, so adding them again
                // is the one wrong answer — and refunding them is another.
                // Nothing is asked of the ledger here: that run sent its
                // statement only after the gate had begun the job's write
                // (`publish_started_at`, which nothing clears), so the refund
                // this answer leads to parks the job whatever this run does.
                const was = readRowMarker(seen[0] && seen[0].v, aRowLists);
                if (!was) return aRowsUnknown("unread");
                await aRowCommitted();
                aMark("add:row", "ok", { repeat: 1, rows: was.rows.length });
                return aRowsReply(was.rows, { repeat: true, cost: aJob ? (was.cost || 0) : 0 });
              }
            }

            // ── WHY THIS ASK CAME HERE, WHEN ANOTHER STEP SENT IT (2026-10-02, W24)
            //
            // The edit route's hand-over named the part of the site it could
            // not do and why, and the router's reader the page it named; this
            // step started again from the message alone. The hand-over is
            // checked against its fixed lists and the page against the site's
            // own pages (`readHandOver`), recorded, and shown to the picker as
            // one line from those lists — never the customer's words, which the
            // picker already has. The picker still decides what the addition is.
            const aHand = readHandOver(ab && ab.handOver, { pages: aSrc.map((p) => routeOf(p && p.path)).filter(Boolean) });
            if (aHand) aMark("handover", "ok", aHand);
            aMark("pick_adds", "start");
            const aPicked = await pickAdds(
              { send: aQuick("pick_adds") },
              // THE PICKER GETS THE SITE, NOT A DIGEST OF IT (owner,
              // 2026-09-13). `siteDigest` gave it routes and table NAMES; this
              // is the one call that decides whether the table designer runs at
              // all, and a name list cannot answer "does the site already store
              // this" — which is the question standing between an unnecessary
              // second table and a feature with nothing behind it. The same
              // note the designers read, so both halves of the step see one
              // description of the site rather than two that can disagree.
              // FILES THE CUSTOMER SAID THEY SENT AND THAT NEVER ARRIVED (round 8):
              // told to the picker, which may ask for them (its question field)
              // when what they asked for depends on them. An answer that brings
              // them joins the request's files.
              // THE PICKER IS SHOWN WHAT IT NAMES KINDS FROM (round 11): the pages,
              // what each calls itself and is built from, the tables — not the
              // photographs, which only the photograph designer chooses among.
              { message: aInstruction, current: siteNote(noteFor("pick", aSite)), model: aModels.quick, handOver: handOverLine(aHand), filesMissing: !!(aPart && ab && ab.filesMissing === true) },
            );
            aMark("pick_adds", aPicked.failed ? "fail" : "ok", { kinds: aPicked.kinds });
            // EVERY USAGE ON ONE BILL: the picker's and each add's, priced
            // together with the page call and the seed net below, one rounding.
            const aDesignUsage = aPicked.usage ? [aPicked.usage] : [];
            if (aPicked.failed) return aDown(aPicked.error, "The builder is busy — try again in a moment.");
            // ── THE PICKER ASKED (2026-10-02) ────────────────────────────────
            //
            // It could not tell what is to be added without a detail they left
            // out, and asked instead of naming "the single closest" kind on a
            // guess. Nothing is designed, written or charged for the addition;
            // the ending (`askReport`) keeps the question, and the answer
            // resumes this whole request.
            if (aPicked.ask) {
              aAskOut.request = aInstruction;
              aHold([], "pick");
              return Response.json({ ok: false, error: "clarify", layer: "addon", cost: 0, unchanged: true, ask: aPicked.ask, msg: aPicked.ask.text });
            }
            // ── NOTHING NEW, ON A PAGE THE SITE HAS (2026-10-24, addon-existing) ──
            //
            // Live at 7956740c4: parts about `/shop` and `/cafe` reached here,
            // the picker named nothing new, and the part ended with its routing
            // charged and nothing done. When the page this addition is about is
            // known — the hand-over's page (checked against the site's pages by
            // `readHandOver`) or the part's one scoped page — and the site has
            // it, the same words go to the page step on that page, at no cost
            // here (`addonFailure("existing")`). Without such a page the ending
            // is as it was.
            const aSitePaths = aSrc.map((p) => routeOf(p && p.path)).filter(Boolean);
            const aOnPage = (aHand && aHand.page && aSitePaths.includes(aHand.page)) ? aHand.page
              : (aScopeIn && aScopeIn.pages && aScopeIn.pages.length === 1 && aSitePaths.includes(aScopeIn.pages[0])) ? aScopeIn.pages[0] : "";
            const aToPage = (why) => { aMark("handover:page", "ok", { why, page: aOnPage }); return aFailure("existing", { layer: "page", page: aOnPage }); };
            // An empty or invalid picker answer establishes no broader request.
            // A FEATURE ON A PAGE THE SITE HAS (2026-10-25, feature-existing): the
            // router named something this change creates beside that page, so
            // it is never handed back to the page step (live, the Lessons
            // booking: the page step rewrote words and built nothing), and a
            // lone `row` is not the feature: it is the component on that page.
            const aFeature = !!(aHand && aHand.reason === "feature-on-page" && aOnPage);
            if (!aPicked.kinds.length) return (aOnPage && !aFeature) ? aToPage("no-add") : aFailure("no-add");
            if (aFeature && aPicked.kinds.length === 1 && aPicked.kinds[0] === "row") {
              aMark("add:row", "as-component", { feature: 1 });
              aPicked.kinds = ["component"];
            }
            // A CHANGE THE ROUTER READ AS WRITING A PAGE IS NOT ONE MORE ENTRY
            // (2026-10-24, addon-existing): live, "Add a bookable Lessons page…"
            // was picked as a lone `row` and wrote a partial entry. On a page the
            // site has, it goes to the page step; otherwise it is the page the
            // router named, made by this step's page designer.
            const aPageAsked = !!(aHand && aHand.reason === "page-asked" && aHand.field === "page");
            if (aPageAsked && aPicked.kinds.length === 1 && aPicked.kinds[0] === "row") {
              if (aOnPage) return aToPage("page-asked");
              aMark("add:row", "as-page", { pageAsked: 1 });
              aPicked.kinds = ["page"];
            }
            // ── ONE MORE ENTRY IN A LIST THE SITE ALREADY STORES (2026-10-01) ──
            //
            // A `row` asked for ALONE is written here and nothing else runs: no
            // page call, no compile, no publish — the pages read the list as it
            // stands, so the new entry appears on them by itself. Beside other
            // kinds it is set aside below and said by name.
            //
            // EVERY ENTRY IS CHECKED AGAINST THE SITE'S OWN SCHEMA (`cleanAdd`'s
            // `row` case: a display list, its declared columns), BILLED BEFORE
            // THE FIRST ROW IS WRITTEN under a job — the data step's rule, so a
            // refused reserve writes nothing — and written with the data step's
            // own parameterised INSERT, in one statement with this request's key
            // (`rowsInsert`). Inline, the charge follows a write that was read
            // back, as the pageless answer's does, and a failed write charges
            // nothing. Under a job the reserve comes back only for a write that
            // was never sent; once the job is protected, the key decides (below).
            if (aPicked.kinds.length === 1 && aPicked.kinds[0] === "row") {
              aMark("add:row", "start");
              const rowRan = await runAdd({ send: aQuick("add:row") }, { kind: "row", message: aInstruction, site: aSite, model: aModels.quick, brief: rowBrief(aRowLists, aRowRequired) });
              aMark("add:row", rowRan.failed ? "fail" : "ok", { answered: rowRan.value !== undefined });
              if (rowRan.usage) aDesignUsage.push(rowRan.usage);
              if (rowRan.failed) return aDown(rowRan.error, "The builder is busy — try again in a moment.");
              if (rowRan.value === undefined) {
                return aNone({ ok: false, error: "declined", kinds: ["row"], cost: 0, msg: addRefusal("nothing") }, 422);
              }
              const rowClean = cleanAdd("row", rowRan.value, { ...aSite, today: aToday, rowTables: aRowLists, rowRequired: aRowRequired });
              const rowSkipped = (Array.isArray(rowClean.skipped) ? rowClean.skipped : []).map((sk) => ({ kind: "row", ...sk, msg: addRefusal(sk.why, "row") }));
              if (!rowClean.ok) {
                return aNone({
                  ok: false, error: "add", kind: "row", reason: rowClean.why, cost: 0,
                  msg: addRefusal(rowClean.why, "row") + " Nothing was added.",
                  notAdded: rowSkipped.length > 1 ? rowSkipped : undefined,
                }, 422);
              }
              // WHAT THE ENTRIES DO NOT DO IS TOLD AND HANDED ON (2026-10-25,
              // `rowUnmet`): the row designer's requirements not `covered` —
              // live, "bookable" lessons whose bookings were never built — are
              // said beside the entries (`notAdded`, never read as done), and
              // their own words go on as a part of their own (`aHeldOut.parts`,
              // the answer's `deferred`) unless they are the whole message.
              // AN ENTRY THE LIST ALREADY HAS (2026-10-26, live test 11): asked
              // about before anything is charged or written — never added twice.
              if (adb) {
                let dups = [];
                try { dups = await duplicateRows((q, ps) => sqlReadOnly(adb, q, ps), rowClean.value); }
                catch (e) { console.error("add-on duplicate check unanswered:", ownerSlug, errorClassForLog(e)); dups = []; }
                for (const d of dups) {
                  const said = duplicateAnswer(aCtxAll || [], d);
                  if (said === "add") continue;
                  if (said === "leave" || said === "other") {
                    aMark("add:row", "ok", { duplicate: d.table, kept: true });
                    return aNone({ ok: false, error: "declined", kinds: ["row"], cost: 0, unchanged: true,
                      msg: "Nothing was added: “" + d.value + "” is already in " + d.table + "." + (said === "other" ? " To change the one already there, send that as a change." : "") }, 422);
                  }
                  const ask = duplicateAsk(d);
                  aMark("add:row", "ok", { duplicate: d.table, asked: true });
                  aAskOut.request = aInstruction;
                  return Response.json({ ok: false, error: "clarify", layer: "addon", kind: "row", by: "add:row", cost: 0, unchanged: true, ask, msg: ask.text });
                }
              }
              const rowUnmetOut = rowUnmet(rowRan.requirements, aInstruction, wordsIn);
              for (const w of rowUnmetOut.carry) if (!aHeldOut.parts.includes(w)) aHeldOut.parts.push(w);
              for (const u of rowUnmetOut.told) {
                rowSkipped.push({ kind: "row", why: "needs-more", need: u.need, status: u.status, step: u.step, msg: "Not done yet: " + u.need + (rowUnmetOut.carry.length ? " — that goes on as its own step." : " — adding an entry to a list can't do that, so ask for it on its own.") });
              }
              if (rowUnmetOut.told.length) aMark("add:row", "unmet", { told: rowUnmetOut.told.length, carried: rowUnmetOut.carry.length });
              const rowBill = pageCredits(...aDesignUsage);
              // PREPARED: the entry is chosen and checked; nothing is charged or saved.
              if (aPrep) return aPrepStop();
              if (aWriter.holding) {
                // EACH ENTRY TRIED BEFORE IT IS HELD (2026-10-18, audit
                // A09-2/A09-3), as the data step does: one the list refuses is
                // said now, before anything is reserved or marked, so it costs nothing.
                for (const r of rowClean.value) {
                  if (aDraftView && heldTouches(aDraftView.ops, r.table)) continue;
                  let tried = null;
                  try { const ins = insertStatement(String(r.table).replace(/"/g, ""), r.values); tried = await sqlRehearse(adb, ins.sql + " RETURNING id", ins.params); }
                  catch (e) { console.error("add-on entry rehearsal unanswered:", ownerSlug, r.table, errorClassForLog(e)); }
                  if (heldRefused(tried)) {
                    aMark("add:row", "fail", { refused: tried.code });
                    return Response.json({ ok: false, error: "row-refused", cost: 0, msg: "That entry couldn't be saved: " + heldRefusalSaid(tried) + ". Nothing was added and you won't be charged for it." }, { status: 422 });
                  }
                }
              }
              let rowCost = 0;
              if (aJob) {
                rowCost = await aCharge(rowBill);
                if (aCharges.refused() > 0) { const u = unbilledBody(aCharges); return aNone(u.body, u.status); }
              }
              // NO PROTECTION, NO WRITE (2026-10-01, the reviews of 31741f6f
              // and c3e310e6). Nothing was sent, so "nothing was added" is
              // true. A job the gate refused was never touched, and its
              // consumer gives the reserve back; one the gate granted and then
              // refused, or whose answer was lost, is parked and refunded by
              // the review — with its key closed first when it has one.
              if (!(await aRowGuard())) {
                aMark("add:row", "fail", { unprotected: 1 });
                return Response.json({
                  ok: false, error: "row-unprotected", cost: 0, ours: true,
                  msg: "I couldn't start saving that entry safely just now, so nothing was added and you won't be charged for it. Try again in a moment.",
                }, { status: 503 });
              }
              // HELD, NOT WRITTEN, on a published site under draft-first: the
              // entries are this task's revision of the draft; the live list
              // is unchanged until Publish.
              if (aWriter.holding) {
                for (const r of rowClean.value) aWriter.hold.add({ kind: "row", table: r.table, op: "insert", values: { ...r.values } });
                const sealed = await sealHeld(env, ownerSlug, aWriter, { job: aJob ? String(aJob.id) : null });
                if (!sealed.ok) {
                  return Response.json({ ok: false, error: "draft", cost: 0, ours: true, msg: "I couldn't save that entry to your draft just now, so nothing was added and you won't be charged for it. Try again in a moment." }, { status: 503 });
                }
                if (aJob) await aRowCommitted();
                else rowCost = await aCharge(rowBill);
                aMark("add:row", "ok", { rows: rowClean.value.length, held: sealed.revision });
                const labelOf = (v) => { for (const x of Object.values(v || {})) if (typeof x === "string" && x.trim()) return x.trim().slice(0, 80); return ""; };
                return aRowsReply(rowClean.value.map((r) => ({ table: r.table, id: null, label: labelOf(r.values), row: { ...r.values }, held: true })), { cost: rowCost, skipped: rowSkipped, draft: heldDraft(sealed.revision) });
              }
              const rowWrite = rowsInsert(rowClean.value, aRowKey ? { key: aRowKey, cost: aJob ? rowCost : null } : null);
              let rowSaved = null, rowLost = "";
              try {
                rowSaved = readSavedRows(await sqlQuery(adb, rowWrite.sql, rowWrite.params), aRowLists);
                // AN ANSWER THAT CANNOT BE READ BACK — or not all of it — is
                // an outcome this step cannot see, never one to call done.
                if (!rowSaved || rowSaved.length !== rowClean.value.length) { rowSaved = null; rowLost = "unread"; }
              } catch (e) {
                const thrown = rowWriteOutcome(e);
                // A UNIQUE KEY REFUSED THE WRITE, AND THE WHOLE STATEMENT WITH
                // IT. Ours (`_meta`'s key: another run of this request saved
                // first) is answered with what that run saved; the list's own
                // (an entry it does not allow twice) is the customer's to know.
                if (thrown.outcome === "duplicate") {
                  const back = await aRowMarker();
                  if (back.state === "found") {
                    await aRowCommitted();
                    aMark("add:row", "ok", { repeat: 1, rows: back.was.rows.length });
                    return aRowsReply(back.was.rows, { repeat: true, cost: aJob ? (back.was.cost || 0) : 0, skipped: rowSkipped });
                  }
                  // WITHOUT A KEY THE STATEMENT WROTE NONE, so the key refused
                  // can only be the list's own.
                  if (back.state !== "absent" && back.state !== "no-key") return aRowsUnknown("unread", rowSkipped);
                  return aNone({
                    ok: false, error: "row-duplicate", cost: 0,
                    msg: "That list doesn't allow two entries the same, and one like this is already there — so nothing was added.",
                  }, 422);
                }
                // THE DATABASE'S OWN REFUSAL ENDED THE STATEMENT before it
                // committed: nothing was saved, and saying so is true.
                if (thrown.outcome === "refused") {
                  console.error("addon row write failed:", ownerSlug, thrown.code);
                  return Response.json({
                    ok: false, error: "row-write", cost: 0, ours: true, detail: thrown.code,
                    // POSTGRES'S OWN COLUMN NAME (2026-10-25, run 6), when it gave one.
                    column: thrown.column || undefined,
                    msg: "I couldn't save that entry — the database didn't accept it, so nothing was added. Try again in a moment.",
                  }, { status: 502 });
                }
                console.error("addon row write's outcome unknown:", ownerSlug, thrown.code || (e && e.message));
                rowLost = "lost";
              }
              // THE KEY ANSWERS WHAT THE WRITE DID NOT — only the whole of what
              // was asked counts as saved.
              let rowRecovered = false;
              if (rowLost) {
                const back = await aRowMarker();
                if (!(back.state === "found" && back.was.rows.length === rowClean.value.length)) return aRowsUnknown(rowLost, rowSkipped);
                rowSaved = back.was.rows;
                rowRecovered = true;
              }
              if (aJob) await aRowCommitted();
              else rowCost = await aCharge(rowBill);
              aMark("add:row", "ok", { rows: rowSaved.length, recovered: rowRecovered ? rowLost : undefined });
              return aRowsReply(rowSaved, { cost: rowCost, skipped: rowSkipped });
            }
            // A ROW BESIDE OTHER KINDS IS SET ASIDE, SAID BY NAME: the step above
            // writes entries and nothing else, and a message that also adds a
            // page or a table is a different change that publishes. The rest of
            // the message runs exactly as it did before `row` existed.
            const aRowAside = aPicked.kinds.includes("row");
            const aKinds = aPicked.kinds.filter((k) => k !== "row");
            // ── A KIND SET ASIDE GOES ON IN THE CUSTOMER'S OWN WORDS (2026-10-03) ──
            //
            // The owner's review of the combined request flow: a menu link or a
            // list entry set aside beside other additions was named by its KIND
            // (`skipped: ["frame"]`, `notAdded: row-alone`), so it could not be
            // carried anywhere — a request marked the part done and ran what
            // depended on the missing link. The picker now names each kind's
            // own words (`scopes`, read only where they are the message's), and
            // a kind set aside with its words is left for later the way any
            // held part is: on the answer's `deferred` (`aHeldOut.parts`, which
            // the route's one ending adds), where the page says "say it next"
            // and a request makes it a part of its own. Without its words it is
            // set aside and named as before, and a request reads it as a part
            // of this one NOT done.
            const aScopes = aPicked.scopes && typeof aPicked.scopes === "object" && !Array.isArray(aPicked.scopes) ? aPicked.scopes : {};
            const aCarried = [];
            const aCarry = (kind) => {
              // THE CUSTOMER'S OWN WORDS, FOUND IN WHAT THIS STEP WAS GIVEN, in
              // their spelling — or the kind is set aside by its name.
              const w = Object.hasOwn(aScopes, kind) && typeof aScopes[kind] === "string" ? wordsIn(aInstruction, aScopes[kind]) : "";
              if (!w) return false;
              if (!aHeldOut.parts.includes(w)) aHeldOut.parts.push(w);
              aCarried.push({ kind, words: w });
              return true;
            };
            // A NEW ITEM IN THE FRAME, ALONE, IS THE MENU EDITOR'S (2026-10-02),
            // one step sideways: it writes the link, the button or the footer
            // detail on every page at once. Named with that layer so the
            // browser hops there with the same sentence, as an addition.
            // Beside other kinds it is set aside and named (`aSkipped`).
            //
            // A PHOTOGRAPH IS NO LONGER HANDED ANYWHERE (2026-10-02): the
            // picture rung fills a slot that exists, so it could not add one
            // beside the ones a page shows. The history below is why it was
            // ours beside a page first.
            //
            // ── BESIDE A PAGE OR A COMPONENT IT IS OURS (2026-09-17) ───────
            //
            // Owner: *"Placeholders and asking the customer to repeat the photo
            // request do not complete that capability."* It used to be set
            // aside in every message, which on *"add a gallery page with a
            // photograph of the workshop on it"* meant a published page of
            // empty frames and a customer told to ask again — and the rung it
            // was handed to fills a slot that EXISTS. This change is the one
            // writing the page, so the slot is ours to make and fill.
            //
            // `addLayerIn` IS THE ONE READER and all three asks below go
            // through it, because two of them disagreeing is a kind that is
            // designed and then reported as skipped, or set aside and never
            // designed. `addLayer` is still right for a caller asking about
            // the KIND rather than about this message.
            const aHop = aKinds.find((k) => addLayerIn(k, aKinds));
            // A ROW SET ASIDE BESIDE A KIND THAT HOPS TO AN EDIT RUNG: that answer
            // carries no list of what was left out, so the entry would vanish
            // unsaid. Refused instead, at no cost, with both halves named.
            if (aRowAside && aHop && aKinds.length === 1) {
              return aNone({ ok: false, error: "add", kind: "row", reason: "row-alone", cost: 0, msg: addRefusal("row-alone", "row") + " Nothing was changed." }, 422);
            }
            // A FRAME LINK TO A PAGE THE SITE DOES NOT HAVE (2026-10-23,
            // fix-edit-flow) is never handed to the menu editor, which only
            // points at pages that exist: refused at no cost, the page named.
            if (aHop === "frame" && aKinds.length === 1 && frameToMissing(aPicked.frameTo, aSrc.map((p) => routeOf(p && p.path)).filter(Boolean))) {
              return aNone({ ok: false, error: "add", kind: "frame", reason: "frame-no-page", page: aPicked.frameTo, cost: 0,
                msg: "The site has no " + aPicked.frameTo + " page yet, so there is nothing for that link to point at. Nothing was changed or charged." }, 422);
            }
            if (aHop && aKinds.length === 1) return aFailure("layer", { layer: addLayerIn(aHop, aKinds), kind: aHop });
            const aSkipped = aKinds.filter((k) => addLayerIn(k, aKinds));
            // WHAT IS SET ASIDE AND STILL SAID AS SET ASIDE: a kind carried on
            // in its own words is left for later instead (`deferred`, above).
            const aFrameCarried = aSkipped.includes("frame") && aCarry("frame");
            // THE FRAME IS HANDED ON, NEVER DROPPED (2026-10-24, live on
            // driftwood-and-daughters): set aside beside other kinds, its words
            // were carried as a later part, and where they were the whole
            // part's words no part could be carved, so it was set aside twice
            // and lost. The other kinds run here; the request then hands the
            // frame to the menu/frame editor as an addition (`frameFollowOn`),
            // with its own words or, when they cannot be told apart, the part's.
            const aFrameHop = aSkipped.includes("frame")
              ? { layer: addLayerIn("frame", aKinds), words: (aCarried.find((c) => c.kind === "frame") || {}).words || aInstruction }
              : null;
            const aSkippedSaid = aSkipped.filter((k) => !(k === "frame" && aFrameCarried));
            // THE SITE ALREADY HAS IT — the edit route's wall, mirrored, so the
            // two doors never bounce a customer between them: that door
            // refuses to CREATE a code or a scene the site lacks and sends the
            // message here; this one refuses to add a second of a thing a site
            // carries ONE of and names the door that changes the first.
            // `SINGLE_FIELDS`, not `ADD_ONLY_FIELDS`: a site carries several
            // QR codes (2026-09-03), so a second code goes through, and the
            // same-name / same-destination refusals live in `cleanAdd`.
            for (const f of SINGLE_FIELDS) {
              if (aKinds.includes(f) && aHas[f]) {
                return aNone({ ok: false, error: "already", kind: f, cost: 0, msg: alreadyReply(f) }, 422);
              }
            }
            // A TABLE ON A SITE WITH NO DATABASE IS NO LONGER REFUSED HERE
            // (owner, 2026-09-03: "if customer touches it then neon db is
            // created"): the first backend tier designed for such a site
            // makes its database, in the schema block below.
            // ONE SMALL CALL PER KIND, in the picker's order (a table before
            // the page that shows it). A kind that answers nothing declined;
            // an answer refused by the cleaner is a sentence, never a climb.
            const aAnswers = [];
            const aDeclined = [];
            // KINDS REFUSED BY THEIR OWN CLEANER AFTER ONE CORRECTION (2026-10-22).
            const aKindRefused = [];
            // AN ENTRY LEFT OUT OF A LIST IS SAID (owner: no low limits, so a
            // page, component or table answer is a list; one bad entry must
            // not throw the good ones away, and must not vanish either).
            const aRowCarried = aRowAside && aCarry("row");
            const aNotAdded = aRowAside && !aRowCarried ? [{ kind: "row", why: "row-alone", msg: addRefusal("row-alone", "row") }] : [];
            // EVERY DESIGNER'S RAW REPLY, KEPT (run 28, 2026-09-03) — answered
            // or not — and written to the site's own store the moment the
            // loop ends, before a decline can return. Three live declines had
            // left nothing to read but a boolean.
            const aKept = [];
            // ── WHAT THE CHANGE NEEDED, AND WHAT BECAME OF IT ───────────────
            //
            // Owner, 2026-09-13. Collected OUTSIDE the answer list on purpose:
            // the shape this exists for is a designer that answered no tables
            // because it could not express the ask, and `aAnswers` holds only
            // the ones that designed something. Read off the runner's result,
            // which carries both arrays on every return including its failures.
            const aReq = [];
            // WHAT WAS HELD FOR A STEP THAT DID NOT RUN THIS TIME (round 12):
            // carried as it is, so the judge hears it beside the rest.
            const aRestoreLeft = () => {
              const left = aHeldIn.list.filter((r) => !aHeldUsed.has(r.id));
              for (const r of left) aHeldUsed.add(r.id);
              if (left.length) for (const r of carrySuperseded(groundRequirements(left, aGrounding).list, aReq, aReq.map((x) => x.id), { keepIds: true })) aReq.push(r);
            };
            // …AND WHAT WAS HELD FOR A STEP THAT DID RUN, reconciled with its
            // answer and keeping its ids where nothing else has them.
            const aHeldCarry = (k, now) => {
              const mine = aHeldFor(k);
              for (const r of mine) aHeldUsed.add(r.id);
              return mine.length ? carrySuperseded(groundRequirements(mine, aGrounding).list, now, aReq.map((x) => x.id), { keepIds: true }) : [];
            };
            const aReqSkipped = [];
            // WHAT THEIR WORDS DO NOT HOLD UP, AND THE EXTRAS OFFERED INSTEAD
            // (2026-10-05, run 101): a declared requirement is kept only when
            // the words it says it comes from are in what they wrote — this
            // part's own words and every answer they gave about it — and a
            // designer's suggestions are kept apart, for them to ask for.
            const aAskedWords = [aInstruction, ...(aCtxShown || []).map((p) => p && p.a)];
            // `known` IS `aReq` ITSELF, filled as each designer's are kept, so a
            // later step's answer to an earlier one's hand-off is held to it.
            const aGrounding = { asked: aAskedWords, known: aReq };
            const aUngrounded = [];
            const aSuggested = [];
            // …AND ANY PAST A DESIGNER'S OWN LIMIT (2026-10-07): never offered, kept for the record.
            const aSuggestOver = [];
            // AND THE PROPERTIES THE MODEL WROTE THAT THE ENGINE CANNOT KEEP
            // (owner, 2026-09-13: "Validate model-authored properties before
            // applying changes"). Names only, and the customer never sees them.
            const aBadProps = new Set();
            // …AND THE ONES IT KEPT UNDER A DIFFERENT VALUE (2026-09-14):
            // `method: "PUT"` stored as `"GET"`, a schedule raised to the
            // floor. Neither reached-for nor refused — the declaration landed
            // and it landed as something else — and it is the one shape where
            // the customer is told the thing they asked for was done and it
            // quietly does another. Developer-facing, on the record and the
            // trace, because a property name is not something they can act on.
            const aChanged = new Set();
            // …AND THE ONES THE ENGINE WOULD HAVE USED AND THIS STEP COULD NOT
            // CARRY TO IT (2026-09-14, owner: *"Distinguish 'the engine does not
            // support this' from 'the addon cannot express or preserve this.'
            // `language` is the second case."*).
            //
            // `aBadProps` was answering both, and they are opposite findings:
            // `encryptAtRest` is dropped by the ENGINE, which has never heard of
            // it, and `language` is dropped by the addon's own CLEANER while
            // `normalizeSchema` reads it and the DDL says `LANGUAGE plpgsql`.
            // `auditTier` asks the engine directly — put the declared value onto
            // what was really sent and normalise again — so the two are
            // separated by measurement rather than by a hand-kept list.
            const aUnexpressed = new Set();
            // …AND THE KIT NAMES THE MODEL ASKED FOR THAT THE KIT HAS NOT GOT
            // (2026-09-14). Dropped by the cleaner against `COMPONENT_MENU` —
            // the catalog the tool itself offers — and named here, because the
            // tool's own description promises that naming a component which
            // does not exist is refused and costs nothing.
            const aUnknownKit = new Set();
            // …AND WHAT A DESIGNER DECLARED INSIDE AN ITEM THAT THIS STEP COULD
            // NOT USE (2026-09-20): a bare-string column it could not read, a
            // hand-written component missing what a page writer builds it from.
            // `clean.skipped` is one entry per ITEM refused and these are losses
            // inside items that were BUILT, so they had no channel at all — the
            // answer came back `ok` and the table was created short a column.
            // A Map keyed on what+name, so one drop is reported once however
            // many answers repeat it.
            const aDropped = new Map();
            // …AND THE PAGES THIS CHANGE SET OUT TO ADD AND DID NOT. Filled
            // after the publish, from the requested page files against what
            // really survived, so a planned file is never mistaken for a
            // delivered page.
            let aMissing = [];
            // …AND THE QR CODES THAT WOULD HAVE OPENED ONE OF THEM (2026-09-17).
            // Declared HERE, well above `aCoverage`'s first possible call,
            // because that closure reads it and this route has the temporal
            // dead zone recorded against it three times already: a `let` beside
            // the code it belongs to is four hundred lines below a refusal that
            // composes the coverage, and a refusal there throws `ReferenceError`
            // that no source scan and no `node --check` can see.
            let aDeadQr = { dropped: [], withheld: [], withheldParts: [] };
            // …AND THE PAGES THE PROMPT WINDOW COULD NOT CARRY (2026-09-17).
            // Declared here for the reason above it: `aCoverage` reads it, and
            // this route's first possible call to that closure is a refusal
            // four hundred lines ahead of the page call that fills this in.
            let aUnseenPages = [];
            // …THE SEED ROWS THAT WERE ASKED FOR AND NOT PUT IN (2026-09-15).
            // `seedSiteRows` has answered `{seeded, skipped}` all along and the
            // skip list went into the migration record and REACHED NOBODY:
            // `"repairs: only display tables are seeded"` is the single sentence
            // that can say why a brand-new table arrived empty, and run 47's
            // customer never saw it. Accurate by construction — the producer
            // only writes a skip for a table the design really asked to seed —
            // so nothing here can imply seeding was required where it was not.
            let aSeedSkips = [];
            // …AND EACH TABLE'S STARTER ROWS, ROW BY ROW (2026-10-07, the engine's `rows`).
            let aSeedRows = null;
            // …AND THE TABLES THIS CHANGE GAVE A READER AND NO WAY TO FILL.
            // A REPORT, NEVER A REFUSAL (owner, 2026-09-15: "No client write
            // grant does not mean no writer"). Filled after the apply, when the
            // proposal is settled and the readers are known.
            let aNoFill = [];
            // …AND THE ITEMS THE ENGINE WILL NOT BUILD AT ALL, per tier
            // (2026-09-14). A table that fails is nearly always a table with a
            // refused field; a FUNCTION whose body names an internal table, or
            // whose return type names a table nobody declared, and a JOB whose
            // function did not survive, are dropped WHOLE — no field to point
            // at, no trace anywhere, and the customer told the feature was
            // added. `{function: ["send_reminder"]}`.
            const aUnbuilt = {};
            // WHICH STEPS RAN AND DID NOT DELIVER. Separate from "did not run":
            // a step that ran and failed is POSITIVE evidence of a problem, and
            // a requirement it was handed is failed rather than merely
            // unconfirmable. Filled by the whole-item drop above and by the job
            // registration below, both of which used to be silent.
            const aFailedKinds = new Set();
            // ── ONE COMPOSER FOR EVERY EXIT (owner, 2026-09-13) ─────────────
            //
            // "Make unresolved requirements affect completion reporting."
            //
            // Declared ABOVE the loop because two of the exits that need it are
            // INSIDE the loop — a cleaner's refusal returns from there — and a
            // composer written after it could not be reached by them. Closures
            // read the arrays as they stand when called, so the early exits get
            // whatever had been collected by the time they fired, which is the
            // honest answer rather than an empty one.
            //
            // `ran` is the kinds that really produced something: a requirement
            // handed to a step that never ran is still outstanding, and saying
            // otherwise is the "doing less than was asked while reporting
            // success" failure this whole path exists to avoid.
            // ── WHAT THIS CHANGE REALLY APPLIED, AND WHAT IT GUARANTEES ─────
            //
            // Owner, 2026-09-14: *"'Delivered' still means a name matched …
            // Worse, `aMadeNames` comes from proposed designs before
            // application. Use actual results and evidence for the specific
            // requirement."*
            //
            // This was `aNewNames` — the names off the CLEANED DESIGNS, before
            // a statement had reached Postgres. MEASURED through this route: a
            // `CREATE OR REPLACE FUNCTION` answered with a syntax error, the
            // reply carrying `functionErrors`, and a requirement whose claim
            // named that function scored `delivered` with the customer told
            // nothing at all.
            //
            // So it is read off the APPLIED results — `aTables`/`aAltered` are
            // what the merge really added and changed, `aFunctions` the ones
            // the engine reports as CREATED (a failure is in `aFnErrors` and
            // never here) — and it is
            // EMPTY until `aApplyBackend` has run, which is the honest answer:
            // before the apply nothing is created, so nothing is evidence.
            //
            // DECLARED HERE, ABOVE `aMade`, AND THAT IS NOT TIDINESS. These
            // five sat just above the backend block, seventy lines below the
            // two `aCoverage()` exits inside the kinds loop — and a `let` is
            // in its temporal dead zone until its own line RUNS, so a refusal
            // composing the coverage would have thrown `ReferenceError` in a
            // place `node --check` cannot see and no source guard can either.
            // The recorded trap, met on the first draft of this change.
            let aTables = [], aAltered = [], aAccessDesigned = null, aFunctions = [], aFnErrors = [];
            // WHAT THE DATABASE REFUSED OF THE TABLES (2026-10-07, the engine's
            // `refusedRules`): a rule it could not put in place, a column it
            // could not add. Read off the apply, so empty until it ran.
            let aRefused = [];
            // …AND `aProvisioned` (2026-10-06): a failure's outcome says whether
            // a database was made for the site (`aFail`), and the first failure
            // that composes one is a refusal in the kinds loop — four hundred
            // lines above where the backend block used to declare it.
            let aProvisioned = false;
            // …AND WHAT THE SITE'S DATABASE REALLY HOLDS WHILE `aSpec` IS THE
            // UNION (2026-10-06). The page call reads the stored spec with this
            // change's design folded in (`unionSpec`, below) — and `aExisting`
            // read that same `aSpec`, so a failure before the apply called this
            // change's own unmade table "already there". Measured through the
            // route: a compile that failed before the seam told a sign-up
            // table nobody created as the site's own. Set when the union is
            // taken, cleared when the apply lands and `aSpec` is read back.
            let aSpecHad = null;
            // `holds` and `fails` are the closed vocabulary `claimEvidence`
            // checks a claim against, and `appliedFacts` owns both — LIFTED OUT
            // OF THIS ROUTE because a decision about the schema engine's own
            // vocabulary cannot be driven from a route that reaches it only
            // through a compile: a mutation of the `fails` list survived a
            // sweep for exactly that reason, and a survivor nobody can drive is
            // a wall nobody is guarding.
            // WHAT IS IN HAND WHEN THE QUESTION IS ASKED, and these two are why
            // `reportable` exists rather than a constant. `aApplied` is false
            // until the backend apply has really run and `aShipped` is null
            // until the merge has decided which routes were compiled, so a
            // coverage composed on a refusal path asks about kinds whose
            // results do not exist yet — and answers `unknown` for them rather
            // than `absent`. An empty list read as "nothing was made" is the
            // recorded cannot-tell trap, and here it would print "still to do"
            // over work that had not been attempted.
            //
            // …AND `aLookMade` IS THE THIRD (2026-09-19). A code and a scene
            // are decided by the look merge and the dead-QR drop, not by the
            // backend apply and not by the publish — so they are in hand
            // EARLIER than either, and gating them on `aApplied` would have
            // made every change with no database answer "nobody looked" about
            // a code it had just made. It holds the codes that survived the
            // drop, which is the list the container really bakes.
            // …AND `aPhotoMade` IS THE FOURTH (2026-09-19), on the publish's own
            // clock like `aShipped`: which ROUTES this change really put a
            // picture on, which is the identity a photograph has. Null until the
            // publish, so a claim about a picture reads "nobody looked" rather
            // than "there is none" while the answer does not exist yet.
            // …AND `aThreeOn` RIDES WITH IT, on the publish's clock for the same
            // reason: which ROUTES really carry the canvas. `aLookMade.three`
            // says the site is configured for a scene; this says a page really
            // draws one, and the two are decided by different model calls.
            // `aPhotoLost` RIDES HERE AND NOT BESIDE ITS OWN COMPUTATION, which
            // is this route's thrice-recorded temporal-dead-zone trap: it is
            // read from inside `aFailedItems()`, whose first possible call is a
            // refusal in the kinds loop hundreds of lines ABOVE where the
            // photographs are settled. Declare what a closure reads above its
            // first possible call, not above its obvious one.
            // …AND `aPhotoShots` IS WHICH REQUESTED PICTURE LANDED (2026-09-19),
            // by the name its own designer gave it. `aPhotoMade` above is the
            // identity of WHERE and cannot separate two pictures on one page —
            // the reproduced defect — so this is the identity of WHICH, carried
            // from the request through the purchase to the reconciliation. Its
            // declaration is here for exactly the reason the one above it is.
            // …AND `aThreeUnsure` IS THE THIRD ANSWER THE SCENE READER NEEDS
            // (2026-09-20). A canvas in a component a page IMPORTS and may not
            // render is neither on the page nor provably off it, and
            // `appliedFacts` has exactly two words for a scene (`onpage` in
            // `holds`, or in `fails`) — so without this a placement nobody could
            // establish would be recorded as a CONTRADICTION, which is the
            // strongest negative this vocabulary has.
            // …AND `aQrShown` IS WHERE EACH NEW CODE IS REALLY SHOWN (2026-10-03),
            // on the publish's clock like `aThreeOn`, for the reply: a code
            // stored is configuration, a page rendering its binding is placement.
            // …AND `aRendered` IS WHAT EACH ROUTE SHOWED AS IT FIRST LOADED, from
            // the last compile's render check, and `aContent` the component
            // evidence read from it and from the stored code once the pages
            // shipped (2026-10-13). Null until then: every component reads as
            // it always did, unknown.
            let aRendered = null, aContent = null;
            // …AND `aForms` THE FORMS EACH ROUTE DREW, `aVerifySite` the built site a
            // requirement is checked against before the reply (2026-10-25,
            // feature-verify: shipped code by route, those forms, the routes
            // drawn, the post-apply schema). Null until the pages shipped.
            let aForms = null, aVerifySite = null;
            // …AND `aReqRetry` THE ONE MORE ROUND FOR NEEDS THE CHECK FOUND
            // MISSING before publish (2026-10-25, `requirement-retry.mjs`):
            // its compile, when it mended anything, is what ships.
            let aReqRetry = null, aSubmits = null;
            // WHAT THE PUBLISHED MENUS SHOWED OF THE LINKS THIS CHANGE PUT IN
            // (2026-10-15, `linkEvidence`): read once the menu step ran; null
            // until then, when every link a requirement rests on is unknown.
            let aLinks = null;
            let aApplied = false, aShipped = null, aLookMade = null, aPhotoMade = null, aThreeOn = [], aThreeUnsure = false, aPhotoUnsure = false, aPhotoLost = [], aPhotoShots = [], aQrShown = null;
            // ⚠ ON A FAILURE (2026-10-06, `failed`, the exit's `failureOutcome`)
            // WHAT THE PUBLISH WOULD HAVE MADE IS NOTHING, and is known to be:
            // no page went out, a code or a scene is not live (a design that
            // could not be put back is saved, not shown — the outcome's
            // `saved`), and no photograph is on the site. And the database's
            // results count only where its apply went in — a design's
            // alterations are on `aAltered` before any statement runs.
            const aMade = (failed = null) => {
              const db = !failed || failed.database === "applied";
              return appliedFacts({
                spec: aSpec, tables: db ? aTables : [], altered: db ? aAltered : [],
                functions: db ? aFunctions : [], fnErrors: db ? aFnErrors : [],
                refused: db ? aRefused : [],
                pages: failed ? [] : aShipped || [],
                qrs: failed ? [] : (aLookMade && aLookMade.qrs) || [],
                three: failed ? false : !!(aLookMade && aLookMade.three),
                threeOn: failed ? [] : aThreeOn,
                threeUnsure: failed ? false : aThreeUnsure,
                photos: failed ? [] : aPhotoMade || [],
                shots: failed ? [] : aPhotoShots,
              });
            };
            // WHICH STEPS THIS CHANGE CAN ANSWER "IT MADE NOTHING" FOR, and the
            // first clause is the one that does most of the work: a kind this
            // change never ran made nothing, definitionally, with no apply and
            // no publish needed to know it. That is what lets a requirement
            // handed to `edit` — a step no add kind owns — read as real
            // outstanding work rather than as something unconfirmable, and a
            // function asked for by a change that ran no function step read as
            // absent rather than as unknown.
            //
            // A kind that DID run is only answerable once its results exist:
            // the backend four after the apply, `page` after the publish.
            // Before that the honest answer is "cannot tell", which falls to
            // `unverified` — never to "still to do" over work in flight.
            //
            // ⚠ AND "ITS RESULTS EXIST" IS PER KIND, NOT ONE FLAG (2026-09-19).
            // It was `aApplied` for everything but `page`, which is right for
            // the four schema tiers and wrong for the two look fields: a QR
            // code is settled by the merge and the dead-QR drop, long before
            // any apply, and on a change with no database `aApplied` is false
            // for ever — so a code this change really made would have read as
            // unseeable on every frontend-only addon there is. `ready` names
            // the kinds whose results arrive on their own clock and everything
            // else falls to the apply, so a kind added to `APPLIED_KINDS` next
            // month gets the conservative answer rather than a wrong one.
            // ⚠ AND THE `APPLIED_KINDS` LINE IS ABSORBED TODAY — MEASURED, and
            // kept with its pair rather than deleted. The only kinds that can
            // be in `ran` and are NOT in `APPLIED_KINDS` are `component` and
            // `photo`, and `seeable` (the one reader of this list) asks
            // `OPAQUE_KINDS` independently — which holds exactly those two — so
            // `false` and `true` here are indistinguishable through every
            // reachable path. The deadness is a property of that NEIGHBOUR and
            // not of this expression, so it stays: the day a non-opaque kind
            // leaves `APPLIED_KINDS`, this is the line that stops a claim about
            // it reading as "still to do" over something nothing can see. Its
            // sweep mutant moves the PAIR, because a mutant of this line alone
            // cannot die and would read as a guard gap for ever.
            const aReportable = (failed = null) => {
              const ran = new Set(aKinds || []);
              // `photo` IS ON THE PUBLISH'S CLOCK, like `page` (2026-09-19): a
              // picture's placement is not known until the merge has settled
              // and the purchase has run, so before that a claim about one must
              // read "nobody looked" rather than "there is none".
              //
              // ⚠ AND AN INVENTORY WITH AN UNESTABLISHED PLACEMENT IN IT IS NOT
              // AN INVENTORY (2026-09-20). `reportable` is what licenses the
              // word ABSENT — *"this layer enumerated that kind and the thing is
              // not among them"* — and a picture in a component the page might
              // reach through a value is precisely the case where the
              // enumeration is incomplete. MEASURED: without this the uncertain
              // arm read `missing` and told the customer a published, billed
              // photograph was *"Still to do"*, which is the reported defect
              // answered in the opposite direction. One unreadable placement
              // makes the whole kind unreportable, because which routes it
              // would have named is exactly what could not be established.
              // ⚠ AND ON A FAILURE (2026-10-06) THE ANSWER IS KNOWN FOR ALL OF
              // THEM BUT ONE: nothing was published, stored or placed, so the
              // publish's kinds made nothing (`aMade(failed)`); the database's
              // made what its apply landed, or nothing when it never ran. Only
              // an apply that stopped part-way (`unknown`) leaves its kinds
              // unanswerable — what went in before the error is not known.
              const ready = failed
                ? { page: true, qr: true, three: true, photo: true }
                : { page: !!aShipped, qr: !!aLookMade, three: !!aLookMade, photo: !!aPhotoMade && !aPhotoUnsure };
              return COVERAGE_STEPS.filter((k) => {
                if (!ran.has(k)) return true;
                if (!APPLIED_KINDS.includes(k)) return false;
                return Object.hasOwn(ready, k) ? ready[k] : failed ? failed.database !== "unknown" : aApplied;
              });
            };
            // ── WHAT THE SITE ALREADY HAD, beside what this change applied ──
            //
            // `aSpec` is the stored schema, and reaching this line at all means
            // it was READ rather than guessed: `specForAddon` recovers a table
            // the catalog has and the spec does not, or stops, and a `none`
            // site is `{tables: []}` against its own state. So it is the
            // trustworthy existing-site evidence item 2 asks for. `aSrc` is the
            // stored page source — the site's real routes.
            //
            // A change that REUSES a function it did not need to create leaves
            // nothing in `aMade()`, and without this the reconciliation read
            // that silence as "still to do" about something live.
            const aExisting = () => existingFacts({
              spec: aSpecHad || aSpec,
              pages: (aSrc || []).map((p) => routeOf(p && p.path)).filter(Boolean),
              // …AND THE LOOK, for the two kinds a site carries by name rather
              // than in its schema. `aLook` is the resolved config this step
              // merges into, so it is the same picture every designer was given.
              look: aLook,
              // …AND THE SOURCE ITSELF, for `photo` (2026-09-19). A photograph
              // is identified by the PAGE it sits on, and only a page's source
              // can say whether it has one — which `pages` above, a list of
              // routes, cannot. `aSrc` is what the route already holds; a read
              // that FAILED leaves it null, and `existingFacts` then does not
              // speak for `photo` at all, so "nobody looked" stays `unknown`.
              sources: aSrc,
              slug: ownerSlug,
            });
            // ── AND WHICH INDIVIDUAL THINGS FAILED, not which kinds ─────────
            //
            // `aFailedKinds` is per-KIND, so one refused function blocked every
            // requirement handed to the function step — including one naming a
            // function Postgres created without complaint. These are the names,
            // so a requirement that says what it depends on is judged on that.
            const aFailedItems = () => [
              ...aFnErrors.map((e) => ({ kind: "function", name: (e && e.name) || "" })),
              ...aMissing.map((r) => ({ kind: "page", name: r })),
              // ── AND A PHOTOGRAPH THAT WAS ASKED FOR AND IS NOT THERE ───────
              //
              // THIS IS THE WALL, AND IT IS THE ONLY ONE THAT BEATS BOTH
              // HAYSTACKS. `depBroke` is asked before the implementation
              // readers, so a route named here is `blocked` whether a picture
              // the site already owned is on it (`existingFacts`) or the page
              // reused one this change wrote (`appliedFacts`) — which is
              // exactly the owner's *"another photograph on the same route
              // must not satisfy the failed request"*. Suppressing the route
              // from the inventory instead would close only the second, and
              // would make the inventory lie about what the page shows.
              ...aPhotoLost.map((r) => ({ kind: "photo", name: r })),
              // …AND THE ITEMS THE ENGINE DROPPED WHOLE (2026-09-15). This was
              // the ONE writer of `aFailedKinds` with nothing on this list:
              // `aUnbuilt` NAMES them and the kind was failing wholesale off
              // them, so every requirement on that kind blocked and none could
              // be told from the one that really named the dropped thing.
              ...Object.entries(aUnbuilt).flatMap(([k, names]) =>
                (Array.isArray(names) ? names : []).map((n) => ({ kind: k, name: String(n || "") }))),
            ].filter((f) => f.name);
            // WHICH STEPS WERE REALLY HANDED AN OUTSTANDING REQUIREMENT. Filled
            // where the brief is composed, never where it is merely intended:
            // a hop that exists in this file and does not run is this
            // repository's most-repeated defect, and `requirementOutcomes`
            // reads this set rather than "did that step run".
            const aTold = new Set();
            // AND WHAT EACH ONE WAS SHOWN ABOUT THE DATABASE, per kind, in run
            // order — the instrumentation run 48 did without. Developer-facing
            // and schema-only; see `shownSchema`.
            const aShown = [];
            // ── WHAT EACH REQUIREMENT MEANS, JUDGED BY THE MODEL (2026-10-05) ──
            //
            // The owner: *"a matching quote proves the words came from the user,
            // not that the claimed requirement follows from them … Use the model
            // for judging meaning and necessary dependencies, and code for
            // checking provenance and actual execution evidence."* Grounding
            // (above) is the provenance; `runJudge` is the meaning; what ran is
            // read off the applied results by `requirementOutcomes`, which is
            // told judging is in force (`judged: true`) on every call below.
            //
            // A REQUIREMENT IS JUDGED BEFORE IT IS HANDED ON, and every one once
            // more after the last designer, with everything designed in view. An
            // `optional` one becomes a suggestion and an `unrelated` one is set
            // aside — both leave `aReq`, so neither is handed on, counted or
            // told. One with no verdict stays in `aReq` unjudged and is never
            // told. The calls are billed with the designers' (`aDesignUsage`).
            const aSetAside = [];
            const aVerdictsBad = [];
            // WHAT A JUDGMENT LEFT WITHOUT A VERDICT AND WAS ASKED FOR AGAIN,
            // and whether the second answer gave one — on the record, so a
            // judgment that did not finish says what it left out.
            const aVerdictsMissing = [];
            // HOW MANY ITEMS THE JUDGMENT'S LIST COULD NOT SHOW (2026-10-07):
            // a bound on its input, counted for the record.
            let aJudgeOver = 0;
            // ── A JUDGMENT THAT DID NOT FINISH STOPS THE ADDITION (2026-10-06) ──
            //
            // The owner: *"Require a valid verdict for every submitted
            // requirement before proceeding, both before handoffs and at the
            // final judgment … Do not ask the user to repeat an already-clear
            // request because an internal model answer was incomplete."*
            // `runJudge` asks once more for whatever its first answer left
            // without a verdict and then answers `incomplete`; the callers
            // below take the failure path every designer's failed call takes,
            // before anything is applied or charged, with this sentence — what
            // happened, whose it is, and nothing for them to repeat.
            const aUnfinished = "I couldn't finish checking that addition against what you asked, so I stopped before changing anything — this is on us, and nothing was charged.";
            const aJudge = async (entries, step = "") => {
              const final = !step;
              const aItemsShown = {};
              const items = final ? judgeItems({ answers: aAnswers, existing: aExisting(), spec: aSpec, refs: entries, report: aItemsShown }) : [];
              aJudgeOver += Number(aItemsShown.over) || 0;
              // IN BOUNDED BATCHES, EVERY ONE JUDGED (round 13): a request that held
              // many requirements across its questions is judged `JUDGE_BATCH` at a
              // time, so no single answer has to carry every verdict — and nothing
              // accepted is left out to make it fit. One batch that fails or asks
              // is the judgment's answer, as one call's was.
              const batches = [];
              for (let i = 0; i < entries.length; i += JUDGE_BATCH) batches.push(entries.slice(i, i + JUDGE_BATCH));
              if (!batches.length) batches.push([]);
              let j = null;
              for (const part of batches) {
                const one = await runJudge({ send: aQuick("judge:" + (step || "final")) }, { message: aInstruction, entries: part, items, step, model: aModels.quick });
                // ONE CALL BILLED PER BATCH: the first. A second call finishing the
                // model's own answer is ours, counted on a mark of its own.
                if (one.usage) aDesignUsage.push(one.usage);
                if (!j) j = { ...one, verdicts: new Map(one.verdicts || []), invalid: [...(one.invalid || [])], missing: [...(one.missing || [])], askedAgain: [...(one.askedAgain || [])], attempts: one.attempts || 0 };
                else {
                  for (const [k2, v2] of one.verdicts || []) j.verdicts.set(k2, v2);
                  j.invalid.push(...(one.invalid || [])); j.missing.push(...(one.missing || [])); j.askedAgain.push(...(one.askedAgain || []));
                  j.attempts += one.attempts || 0;
                  if (one.extraUsage) j.extraUsage = one.extraUsage;
                  if (one.failed) { j.failed = true; j.error = one.error; if (one.incomplete) j.incomplete = true; }
                  if (one.ask) j.ask = one.ask;
                }
                if (one.failed || one.ask) break;
              }
              aMark("judge:" + (step || "final"), j.failed ? "fail" : "ok", {
                entries: entries.length, items: items.length, verdicts: j.verdicts.size, invalid: j.invalid.length, asked: j.ask ? 1 : 0,
                attempts: j.attempts || 0, missing: (j.missing || []).length, over: Number(aItemsShown.over) || 0,
              });
              if (j.extraUsage) aMark("judge:" + (step || "final") + ":again", "ok", { in: j.extraUsage.in, out: j.extraUsage.out });
              for (const x of j.invalid) aVerdictsBad.push({ at: step || "final", ...x });
              for (const x of j.askedAgain || []) {
                const e = entries.find((r) => r && r.id === x.id);
                aVerdictsMissing.push({ at: step || "final", id: x.id, need: e ? e.need : "", why: x.why, finished: j.verdicts.has(x.id) });
              }
              if (j.failed || j.ask) return j;
              const out = applyVerdicts(entries, j.verdicts, { final });
              const by = new Map([...out.kept, ...out.optional, ...out.unrelated].map((e) => [e.id, e]));
              for (let i = aReq.length - 1; i >= 0; i--) {
                const e = by.get(aReq[i] && aReq[i].id);
                if (!e) continue;
                if (out.kept.includes(e)) { aReq[i] = e; continue; }
                aReq.splice(i, 1);
                if (out.optional.includes(e)) {
                  // OFFERED, NEVER BUILT — unless what it named already does
                  // it, when "nothing was made for it" would be the false half.
                  if (e.judged.carried !== "yes" && !aSuggested.some((x) => x.toLowerCase() === e.need.toLowerCase())) aSuggested.push(e.need);
                  aSetAside.push({ need: e.need, from: e.from || "", follows: "optional", reason: e.judged.reason, ...(e.judged.carried === "yes" ? { carriedBy: e.judged.by } : {}) });
                } else aSetAside.push({ need: e.need, from: e.from || "", follows: "unrelated", reason: e.judged.reason });
              }
              return j;
            };
            // `failed` (2026-10-06): the answer is a failure, and this is what
            // its own evidence says it left behind (`failureOutcome`, written
            // by `aFail`) — see the note's own half below. `said` is the
            // failure's own sentence, so the note never says a thing twice.
            const aCoverage = ({ failed = null, said = "" } = {}) => {
              // SOMETHING OF THIS CHANGE WAS BUILT: a success, or a failure
              // whose database changes went in.
              const built = !failed || failed.database === "applied";
              const open = unresolvedRequirements(aReq);
              const bad = [...aBadProps];
              // ── WHAT EACH REQUIREMENT CAME TO, WHOLE (2026-10-06) ──────────
              //
              // Codex: four requirements left undone, the note named three,
              // and the reply model, given only the note, never heard of the
              // fourth. The report is every requirement the customer hears
              // about (`requirementsTold`); the reply's facts are written from
              // it one by one, and the note from it whole.
              // …AND WHAT EACH STEP WROTE DOWN PAST WHAT IT KEEPS TRACK OF
              // (2026-10-07, `skipped`): told as not checked, never dropped.
              const aRep = requirementReport(aReq, { told: [...aTold], invalid: bad, failed: [...aFailedKinds], failedItems: aFailedItems(), made: aMade(failed), reportable: aReportable(failed), existing: aExisting(), unexpressed: [...aUnexpressed], judged: true, skipped: aReqSkipped, content: failed ? null : aContent, links: failed ? null : aLinks, site: failed ? null : aVerifySite });
              // …AND EVERYTHING ELSE THE NOTE SAYS, which is about this change
              // rather than about a requirement: the reply's facts carry it
              // beside the requirements (`coverOther`), never twice.
              // THE PROPERTY COUNTS: names the design used that the database
              // does not offer, or that this step could not carry.
              const aProps = propertyNote(aRep.invalid, aRep.unexpressed);
              // THE PARTIAL OUTCOME'S OWN SENTENCE, counted by kind (see the
              // list below for where it sits and why).
              const aPartly = droppedNote([...aDropped.values()]);
              const aOther = [
                aProps,
                // THE MISSING PAGES' OWN SENTENCE, joined rather than folded
                // into the requirements' sentences: those are about
                // REQUIREMENTS the designers declared, and a page that did not
                // survive the writer is a fact about this change whether or
                // not anybody wrote a requirement for it.
                missingPagesNote(aMissing),
                // …AND THE PARTIAL OUTCOME'S OWN SENTENCE, joined here for
                // exactly the reason the missing pages' is: a thing the
                // design asked for and this step could not build is a fact
                // about this change whether or not a requirement named it.
                // Without it a change that built one of two things read as
                // "✅ Done — updated /." and nothing else.
                aPartly,
                // …AND WHAT WENT WITH THEM. Beside the sentence above,
                // never instead of it: one says the page is not there, this
                // says a code that was going to open it was not added — or,
                // where a live page shows it, that it IS there and opens
                // nothing yet. A customer who hears only about the page
                // finds out about the code by scanning it.
                deadQrNote(aDeadQr),
                // THE SEED SKIPS, SAID (2026-09-15). Joined here for exactly
                // the reason the missing-page sentence is: it is a fact about
                // what this change did, not a claim the designers made. It
                // says the EFFECT — the table starts empty — rather than our
                // own rule about which tables get seeded, and it can never
                // fire for a table nobody asked to seed, because the engine
                // only records a skip against the design's own seed keys.
                seedSkipNote(aSeedSkips, aSeedRows),
                // WHAT THE DATABASE REFUSED OF THE TABLES (2026-10-07): every
                // column it could not add and every rule it could not put in.
                refusedNote(aRefused),
                // AND THE TABLE NOTHING CAN FILL. A report, never a refusal:
                // a read-only table filled by a function, a job, an import or
                // the owner is legitimate and stays silent. This fires only
                // where this change also gave the table a reader, which is
                // run 47's shape.
                populationNote(aNoFill),
              ].filter(Boolean);
              // ── EVERY MISSING PAGE, CODE, SEED SKIP AND EMPTY TABLE, ONE BY
              // ONE (2026-10-06) ─────────────────────────────────────────────
              //
              // The four sentences above named three and counted the rest, and
              // the reply model was given them as one fact. `warningsTold` is
              // each thing on its own, from the same selections; `coverOther`
              // keeps only the two COUNTED sentences, which name no items.
              const aWarned = warningReport({ missing: aMissing, deadQr: aDeadQr, seedSkips: aSeedSkips, seedRows: aSeedRows, noFill: aNoFill, refused: aRefused });
              const aCounted = [aProps, aPartly].filter(Boolean);
              // ⚠ A FAILURE'S NOTE (2026-10-06): the requirements and the
              // change's own items, and the two counted sentences only beside
              // database changes that went in — "so it's on the database's own
              // default" and "Part of that didn't get built" describe a change
              // that was built. Then what no exit's own sentence says it left
              // (`failureNote`). The browser prints this under the failure's
              // own sentence, so a sentence that sentence already says is left
              // out here (a code and the pages that went with it, said by the
              // QR refusal itself).
              const aNote = failed
                ? [toldNote(aRep.told), ...aOther.filter((x) => built || (x !== aProps && x !== aPartly)), failureNote(failed)]
                    .filter((x) => !(x && typeof said === "string" && said.includes(x)))
                : [toldNote(aRep.told), ...aOther];
              return {
                // THE CUSTOMER'S HALF: a sentence, or nothing at all. Never the
                // property names, never the counts, never the status tokens.
                // NAMED `coverNote`, NOT `note` — the reply already carries
                // `notes` (the salvage note, which is the model's own field and
                // has its own rule about never gluing a sentence onto it), and
                // two fields one character apart on one object is how a reader
                // ends up printing the wrong one.
                // `told`, `failed` and `made` are the corrections of 2026-09-14
                // (owner: "Something existing does not prove the requirement
                // works", then "Use actual results and evidence for the specific
                // requirement"). A step that RAN used to be read as proof its
                // requirement was met, and a name off the PROPOSED design as
                // proof the thing exists. `made` is what the apply really
                // landed and what each item really guarantees; `told` is which
                // steps were really handed an outstanding requirement.
                // THE BROWSER PRINTS IT VERBATIM when there is no model reply:
                // every requirement's sentence, then the rest, in that order.
                coverNote: aNote.filter(Boolean).join(" "),
                // THE REPLY'S HALF, one entry per requirement the customer
                // hears about, one per thing this change could not do, and the
                // counted sentences beside them (none on a refusal).
                requirementsTold: aRep.told.length ? aRep.told : undefined,
                warningsTold: aWarned.length ? aWarned : undefined,
                coverOther: built && aCounted.length ? aCounted.join(" ") : undefined,
                // THE WIRE'S HALF, for the browser to render and a test to read.
                // WHOLE, as every list below (2026-10-07): each was cut at twelve.
                requirements: open.length ? open : undefined,
                // THE DEVELOPER'S HALF, kept off the customer's sentence.
                coverage: requirementCounts(aReq, aReqSkipped),
                invalidProps: bad.length ? bad : undefined,
                changedProps: aChanged.size ? [...aChanged] : undefined,
                // SEPARATE FROM `invalidProps` ON THE WIRE TOO, not folded into
                // it with a flag: a reader that cannot tell the two apart is
                // back to one sentence for two findings, which is the defect.
                unexpressedProps: aUnexpressed.size ? [...aUnexpressed] : undefined,
                // THE KIT NAMES THAT ARE NOT KIT NAMES, developer-facing like
                // the two above. The customer's own clause is the missing-page
                // one below; a component name is not something they can act on.
                unknownComponents: aUnknownKit.size ? [...aUnknownKit] : undefined,
                // AND THE FIELDS BINNED INSIDE AN ITEM THAT WAS BUILT —
                // developer-facing for the same reason: a column name the
                // designer wrote is not something the customer chose.
                droppedFields: aDropped.size ? [...aDropped.values()] : undefined,
                // AND THE PAGES THAT WERE ASKED FOR AND ARE NOT THERE, NAMED —
                // a route is the one thing about a missing page a customer can
                // do something with.
                missingPages: aMissing.length ? aMissing : undefined,
                // …AND THE CODES THAT DEPENDED ON THEM, beside the pages that
                // went with them. Two fields rather than one flagged list: a
                // dropped CODE and a withheld PAGE are different things about
                // different objects, and folding them would be two findings in
                // one field — the shape this route has already had to unpick
                // twice.
                droppedQrs: aDeadQr.dropped.length ? aDeadQr.dropped : undefined,
                heldPages: aDeadQr.withheld.length ? aDeadQr.withheld.map((w) => w.path) : undefined,
                // …AND THE COMPONENTS, ON THEIR OWN FIELD FOR THE SAME REASON.
                // A component has no route, so folding it into `heldPages`
                // would put a name where every reader expects a path.
                heldParts: aDeadQr.withheldParts.length ? aDeadQr.withheldParts.map((w) => w.name) : undefined,
                // THE DEVELOPER'S COPY OF THE TWO NEW FINDINGS. `seedSkips`
                // carries the engine's own sentences, which name the rule the
                // customer's clause deliberately leaves out; `noPopulation` is
                // the bare table list.
                // …AND THE PAGES THE PROMPT WINDOW COULD NOT CARRY. The one
                // fact that explains a weak result on a large site, and until
                // this it was nowhere: a 17-page site answered `ok: true` with
                // an empty `problems` and an empty `coverNote`, exactly as a
                // one-page site does. Developer-facing, because a customer can
                // do nothing with it and the things they CAN act on already
                // have their own sentences.
                unseenPages: aUnseenPages.length ? aUnseenPages : undefined,
                // WHOLE (2026-10-06): both were cut at twelve, and a thirteenth
                // was on no list anybody read.
                seedSkips: aSeedSkips.length ? aSeedSkips : undefined,
                // AND EVERY STARTER ROW BY ITS PLACE (2026-10-07): what went in, was refused, named no column, or was not tried.
                seedRows: aSeedRows && Object.keys(aSeedRows).length ? aSeedRows : undefined,
                noPopulation: aNoFill.length ? aNoFill : undefined,
                // WHAT THE BACKEND LOOKUP REALLY ANSWERED, so a support read
                // never has to infer it: `ready`, `none` or `incomplete` (an
                // `unreadable` site never reaches here — it stops above).
                // `backendHealed` says the ownership row was repaired on the
                // way past, which is how the five affected sites close.
                backend: aBack.state,
                backendHealed: aHealedRef || undefined,
              };
            };
            // ── EVERY FAILURE AFTER THE DESIGN SAYS WHAT IT LEFT BEHIND (2026-10-06) ──
            //
            // The owner, on 08b9a657: *"Extend the shared outcome reporting
            // across the later Add-on failure exits using existing applied,
            // migration and publish evidence … ok:false alone must never
            // establish that nothing changed or that something already
            // existed."* One door for all of them: the exit's own answer, the
            // coverage composed against what its evidence says (`aCoverage`),
            // and that evidence as `outcome` (`failureOutcome`), which the
            // reply's facts, the browser and a stored answer all read.
            //
            // `database` is the exit's to say — `none` for every exit before
            // the publish's seam, the compile exit's own reading after it —
            // and the rest is read here, off the route's applied results.
            // The exit's own fields win over the coverage's (a QR refusal's
            // `missingPages`), and execution, charging and retries are the
            // exit's, untouched: this only says what happened.
            // THE REQUIREMENT RECORD READ UNDER A FAILURE, once it can be (`aRecord`, below).
            let aRecordFor = null;
            // A DATABASE BEING MADE BESIDE THE PAGE WRITER (2026-10-16): the
            // provision started, not yet awaited. Every exit settles it first
            // (`aProvSettle`), so what is said about the site is what stands.
            let aProvWait = null;
            // …OR WAITING FOR THE COMPILE (page path, 2026-10-23): run at the
            // seam, and its failure (`aProvLate`) answered as one.
            let aProvDeferred = null, aProvLate = null;
            const aProvSettle = async () => { if (!aProvWait) return null; const w = aProvWait; aProvWait = null; return w; };
            // THE PROVISION'S FAILURE, SAID AS BEFORE (moved here unchanged
            // when the provision began to run beside the page writer).
            // NOTHING CHANGED, NOTHING KEPT CHARGED: the reserve a job took
            // meanwhile is refunded with the rest of an answer that ships
            // nothing. The status and the stage are the diagnosis, the build
            // route's own rule — a dead key, a quota and Neon being down each
            // need a different fix and read alike without them. A PROJECT
            // STARTED BEFORE THE FAILURE (2026-10-07, the provisioner's
            // `recorded`) is kept against the site and reused, or written down
            // to be settled; AN EARLIER ATTEMPT THAT IS NOT SETTLED
            // (`reconcile`) blocks another until it is checked.
            const aProvFailed = (e) => {
              const aProjKept = e && e.recorded === true ? true : e && e.recorded === "unknown" ? "unknown" : false;
              const aEarlier = !!(e && e.reconcile === true);
              return aFail({
                ok: false, error: "provision", cost: 0, ours: true,
                msg: aProjKept === true
                  ? "That needed a database for your site and setting it up didn't finish — this is on us. Your site is unchanged; the database that was started is kept, so the next try picks it up. Try again in a few minutes."
                  : aProjKept === "unknown"
                    ? "That needed a database for your site and setting it up didn't finish — this is on us. Your site is unchanged; a database may have been started, and it's set aside to be checked before another is made, so trying again may not work until that's done."
                    : aEarlier
                      ? "That needed a database for your site, and one an earlier try started still has to be checked before another is made — this is on us. None was made this time and your site is unchanged; trying again may not work until that check is done."
                      : "That needed a database for your site and one couldn't be made right now — this is on us, and nothing was changed. Try again in a few minutes.",
                upstream: (e && e.status) || null, stage: (e && e.stage) || null,
                detail: scrubSecrets(String((e && (e.detail || e.message)) || "")).slice(0, 300),
              }, 502, { projectKept: aProjKept });
            };
            /** Settle the provision: null when it stands (or none ran), else the failure's answer. */
            const aProvCheck = async () => { const e = await aProvSettle(); return e ? aProvFailed(e) : null; };
            const aFail = async (body, status, { database = "none", saved = false, photos = 0, projectKept = false } = {}) => {
              await aProvSettle();
              const failed = failureOutcome({
                database,
                made: { tables: aTables, altered: aAltered.map((x) => x && x.table), functions: aFunctions },
                provisioned: aProvisioned, saved, photos, projectKept,
              });
              const told = aCoverage({ failed, said: body.msg });
              // THE DEVELOPER RECORD, RE-WRITTEN OVER THE FAILURE (2026-10-07):
              // it kept the reading composed before the publish (cannot-tell for
              // the page) while this answer said not done, and a failure before
              // the first save left the previous addition's record standing. It
              // now holds what this answer holds — the outcome, the error, the
              // requirement outcomes told under it. Never fatal.
              let coverage = null;
              try { coverage = aRecordFor ? aRecordFor(failed) : null; } catch (e) { coverage = null; }
              await aKeepAnswer(env, ownerSlug, {
                message: aInstruction, site: aSite, kinds: aKinds, replies: aKept, coverage,
                outcome: failed, error: typeof body.error === "string" ? body.error : "",
                requirementsTold: told.requirementsTold, warningsTold: told.warningsTold,
              });
              return Response.json({ ...told, ...body, outcome: failed }, { status });
            };
            // A STOP AT ONE OF THE JOB'S GATES (2026-10-07): before the publish
            // seam, so nothing of the apply ran — but a database may have been
            // made for the site — read off the same evidence `aFail` reads, so
            // the stop is never told as one that recorded nothing.
            const aStopEvidence = () => {
              const failed = failureOutcome({ database: "none", provisioned: aProvisioned });
              return { ...aCoverage({ failed }), outcome: failed };
            };
            // A DESIGNER THAT ASKED (2026-10-02): its kind and its question.
            let aStepAsk = null;
            // WHAT IS ABOUT TO BE DESIGNED, AS A MILESTONE (2026-10-06): the
            // kinds this loop designs — every kind the set-aside list did not
            // take, read off that list itself — in order.
            const aDesigning = aKinds.filter((k) => !aSkipped.includes(k));
            if (aJob && aJob.progress) aJob.progress.mark("picked", addonPickedFacts(aDesigning));
            // THIS ADDITION'S RECORD FROM ITS FIRST DESIGN ON (2026-10-07): the
            // one-per-site developer record said the previous addition's story
            // whenever this one ended before its first save (a designer's call
            // that failed, a designer that refused). It now says this one is
            // being designed, until a save or a failure says more.
            await aKeepAnswer(env, ownerSlug, { message: aInstruction, site: aSite, kinds: aKinds, replies: [], coverage: null, state: "designing" });
            // …AND HOW IT ENDED, WHERE IT ENDS WITHOUT A LATER SAVE (2026-10-07):
            // a design or judgment call that did not go through, and a question
            // back, are written onto this addition's record with what it holds
            // so far — so the record never says "designing" of an addition that
            // has ended, and the job's answer and the record tell one story.
            const aEnded = (state, coverage = null) => aKeepAnswer(env, ownerSlug, {
              message: aInstruction, site: aSite, kinds: aKinds, replies: aKept, coverage, state, ...(state === "failed" ? { error: "send" } : {}),
            });
            // ── DESIGNERS THAT NEED NOTHING FROM EACH OTHER RUN AT ONCE (2026-10-11) ──
            //
            // The owner: *"independent tasks … should actively run at the same
            // time. Only work that genuinely needs another task's result should
            // wait."* A designer is asked the site as the kinds before it left
            // it (`aSite`, rebuilt only by a SCHEMA kind or a `page`) and what an
            // earlier kind handed it (`aBrief`). So each kind is started as soon
            // as no earlier kind that can change the site facts is still to be
            // decided — a photograph and a component, say, together — and is
            // checked when its turn comes: its request is built again from the
            // site and brief as they then are, and an early answer is used only
            // when that request is EXACTLY the one it was asked. Otherwise (an
            // earlier kind handed it something) it is asked again, and the early
            // answer is set aside unbilled: only the answer used is counted.
            //
            // …AND EACH IS SHOWN ONLY WHAT IT USES (2026-10-11, Codex on
            // adbb7ad7: a table nothing shows held a static questions section
            // back, because every designer was shown every result decided
            // before it). `designWaits` says, from the picker's own answer
            // (what each kind uses, and the words it was asked in) and from
            // what a schema kind is written against, which earlier kinds each
            // designer is built on; it is shown the site with THOSE results
            // folded in (`aSiteFor`) and started the moment they are decided —
            // the rest at once. A kind the picker said nothing about waits for
            // every earlier kind that changes the site, as before.
            const aWaits = designWaits(aDesigning, { scopes: aScopes, uses: aPicked.uses || {} });
            aWaitsHeld = aWaits;
            const aDecided = new Set();
            const aDesignReq = (k, site, brief) => JSON.stringify(addRequest({ kind: k, message: aInstruction, site, model: aModels.quick, brief }));
            // THE SITE AS THIS DESIGNER USES IT: the whole of it when it waits
            // for every result folded so far (the same object, byte for byte),
            // otherwise the stored site with only its own results folded in.
            // The earlier kinds it is NOT shown are named on its note
            // (`unshown`, from `designWaits` alone, so the request is the same
            // bytes whenever it is built), and it may answer that it `needs`
            // one: then it is asked again with them (`aWiden`, below).
            const aChanges = (j) => !!SPEC_OF_KIND[j] || j === "page";
            const aUnshown = (k) => {
              const at = aDesigning.indexOf(k);
              const waits = Object.hasOwn(aWaits, k) ? aWaits[k] : null;
              if (at < 0 || !waits) return [];
              return aDesigning.slice(0, at).filter((j) => aChanges(j) && !waits.includes(j));
            };
            // ── A DESIGNER STARTS WHEN WHAT IT USES IS READY (2026-10-11, the
            //    scheduler round, after Codex's review of 44344896) ─────────────
            //
            // A designer used to be marked decided only when the loop below
            // reached it in kind order, so a component using a new page waited
            // for an unrelated table listed before the page. Now each early
            // answer is checked the moment it lands (`aLanded`): one that can
            // be used is cleaned against the site it was shown, and that result
            // is what its dependents are shown when they start — at once, while
            // anything unrelated is still out. Its official result comes later,
            // in order, and a dependent's early answer is still used only when
            // its request is byte for byte the one built from the official
            // results (`aTakeEarly`): a provisional result that differs from
            // the official one only costs a fresh call, never a wrong design.
            const aReady = new Map();
            // A DECIDED KIND'S OFFICIAL FOLDED RESULT, or undefined (it folded nothing).
            const aOfficial = (j) => { const f = aFolded.find((x) => x.kind === j); return f ? f.value : undefined; };
            // …OR, FOR ONE NOT DECIDED YET, ITS READY EARLY RESULT.
            const aProvisional = (j) => (aDecided.has(j) ? aOfficial(j) : (aReady.has(j) ? aReady.get(j) : undefined));
            // THE SITE AS DESIGNER `k` USES IT, from the results `valueOf`
            // gives for the kinds it waits for (in run order); the whole site,
            // the same object, when it waits for every earlier site-changer
            // and every one of them is decided.
            const aViewFor = (k, valueOf) => {
              const left = aUnshown(k);
              if (!left.length && valueOf === aOfficial) return aSite;
              const waits = aWaits[k] || [];
              const st = { spec: aBaseline, names: { tables: [], functions: [], jobFns: [], apis: [], jobs: [] }, pages: [] };
              for (const j of aDesigning) {
                if (!waits.includes(j)) continue;
                const v = valueOf(j);
                if (v !== undefined) aFoldInto(st, j, v);
              }
              const facts = siteFacts(st.spec, st.names, st.pages);
              return left.length ? { ...facts, unshown: left.map((j) => ({ kind: j, words: typeof aScopes[j] === "string" ? aScopes[j] : "" })) } : facts;
            };
            const aSiteFor = (k) => aViewFor(k, aOfficial);
            // IT SAID IT NEEDS WHAT IT WAS NOT SHOWN: from now on it waits for,
            // and is shown, every earlier kind — the old order, for this kind.
            const aWiden = (k) => { aWaits[k] = aDesigning.slice(0, Math.max(0, aDesigning.indexOf(k))).filter(aChanges); };
            const aEarly = new Map();
            // NOTHING IS STARTED ONCE THE LOOP HAS ENDED (an answer, a question,
            // a refusal): a late readiness never begins work nobody will take.
            let aLoopDone = false;
            // …EXCEPT WORK THE QUESTION DOES NOT REACH (2026-10-11, the
            // generality round): when the loop ends on a designer's question,
            // every designer that neither is that designer nor uses its result
            // keeps going — started as its inputs become ready, its answer kept
            // with the job — so the customer's answer resumes only the asker and
            // what uses it. Any other ending (a failure, a refusal) starts
            // nothing more.
            let aAskedBy = null;
            // A KIND WHOSE TURN HAS BEGUN is never started again early: its own
            // turn makes or takes its one call.
            const aTaken = new Set();
            // IS EVERY KIND THIS ONE USES READY — decided, or its early answer
            // checked and usable? A kind that asked, failed, or said it needs
            // more is never ready early: its turn decides it.
            // …AND NOTHING LANDED AND NOT YET DECIDED HAS HANDED IT A
            // REQUIREMENT (`aHandsTo`): that hand-off is judged at its giver's
            // turn and joins this designer's brief, so it starts after that.
            const aHandsTo = new Map();
            const aInputsReady = (j) => (aWaits[j] || []).every((w) => aDecided.has(w) || aReady.has(w))
              && ![...aHandsTo].some(([g, to]) => !aDecided.has(g) && to.includes(j));
            // EVERY DESIGNER WHOSE INPUTS ARE READY, started now, whatever is
            // still out before it in the list.
            const aStartReady = () => {
              if (aLoopDone && !aAskedBy) return;
              for (const j of aDesigning) {
                if (aEarly.has(j) || aDecided.has(j) || aTaken.has(j)) continue;
                if (aAskedBy && (j === aAskedBy || (aWaits[j] || []).includes(aAskedBy))) continue;
                if (!aInputsReady(j)) continue;
                const site = aViewFor(j, aProvisional);
                const brief = requirementBrief(aReq.filter((r) => r.judged), j) + aHeldShown(j) + featureBrief(aHand, j);
                aMark("add:" + j, "start", (aWaits[j] || []).length ? { after: aWaits[j] } : undefined);
                const p = runAdd({ send: aQuick("add:" + j, { refusals: true }) }, { kind: j, message: aInstruction, site, model: aModels.quick, brief })
                  .catch((e) => ({ failed: true, error: e }))
                  .then((ran) => { aLanded(j, site, ran); return ran; });
                aEarly.set(j, { site, req: aDesignReq(j, site, brief), p });
              }
            };
            // AN EARLY ANSWER LANDED: when it designed something usable, its
            // result — cleaned against the site it was shown — is ready for
            // the designers that use it, and they start now. Never thrown: a
            // check that cannot be made leaves the kind for its turn.
            const aLanded = (j, site, ran) => {
              try {
                if (aDecided.has(j) || aReady.has(j)) return;
                if (!ran || ran.failed || ran.ask) return;
                if (Array.isArray(ran.needs) && ran.needs.some((n) => aUnshown(j).includes(n))) return;
                const handed = Object.keys(handoffsByStep(Array.isArray(ran.requirements) ? ran.requirements : []));
                if (handed.length) aHandsTo.set(j, handed);
                if (ran.value === undefined) { aReady.set(j, undefined); aStartReady(); return; }
                const clean = cleanAdd(j, ran.value, { ...site, today: aToday });
                // REFUSED BY ITS OWN CLEANER: never ready, and never reused.
                if (!clean || !clean.ok) { if (!clean || clean.why !== "nothing") rejectReply(ran.raw, "add:" + ((clean && clean.why) || "unclean")); return; }
                aReady.set(j, aChanges(j) ? clean.value : undefined);
                aStartReady();
              } catch { /* its turn decides it */ }
            };
            // IT NEEDS A RESULT IT WAS NOT SHOWN (`needs`, 2026-10-11): asked
            // again, once, with the whole site as decided so far — every
            // earlier kind is decided by its turn. Both calls were real work,
            // so both are on the bill; the first answer is never used. An
            // answer that names nothing it was not shown is the answer.
            const aNeedsAgain = async (k, first, brief, feedback = "") => {
              const left = aUnshown(k);
              const needed = !first.failed && !first.ask && Array.isArray(first.needs) ? first.needs.filter((n) => left.includes(n)) : [];
              if (!needed.length) return first;
              if (first.usage) aDesignUsage.push(first.usage);
              aMark("add:" + k, "needs", { needs: needed });
              aWiden(k);
              // WHAT IT WAS REALLY SHOWN for the answer used: this call's.
              aShown[aShown.length - 1] = { kind: k, ...shownSchema(aSiteFor(k)) };
              aMark("add:" + k, "start", { again: true, needs: needed });
              return runAdd({ send: aQuick("add:" + k) }, { kind: k, message: aInstruction, site: aSiteFor(k), model: aModels.quick, brief, ...(feedback ? { feedback } : {}) });
            };
            // THIS KIND'S EARLY ANSWER, OR NULL: started as soon as what it uses
            // was decided (`aStartReady`), and used only when its request is
            // still byte for byte the one it would be asked now — the same site
            // facts and the same hand-off brief. Otherwise it is asked again.
            const aTakeEarly = (k, brief) => {
              aStartReady();
              aTaken.add(k);
              const e = aEarly.get(k);
              aEarly.delete(k);
              if (!e) return null;
              if (e.req === aDesignReq(k, aSiteFor(k), brief)) return e.p;
              // A SECOND START, MARKED AS ONE (the trace keeps start, ok and fail).
              aMark("add:" + k, "start", { again: true });
              return null;
            };
            // THE LOOP'S END, HOWEVER IT ENDS, stops new early starts (`aLoopDone`).
            try {
            for (const k of aKinds) {
              // THE SAME READER THE SET-ASIDE LIST USED, so a kind cannot be
              // skipped there and designed here (or the reverse).
              if (addLayerIn(k, aKinds)) continue;
              // ── WHAT AN EARLIER STEP HANDED TO THIS ONE (2026-09-14) ──────
              //
              // `requirementBrief` was general and had ONE caller, for the page
              // call, so five of the six kinds that answer requirements could
              // hand one onward and reach nobody. Composed from what has been
              // collected SO FAR — which is exactly "the receiving step is
              // still ahead", because the kinds run in `ADD_KINDS` order — and
              // `aTold` records that it was really sent, so a hand-off to a
              // step that has already run stays outstanding rather than being
              // read as satisfied by a call that never heard it.
              // …AND ONLY WHAT FOLLOWS FROM THEIR WORDS (2026-10-05): what is
              // about to be handed to this step is judged first, so an extra is
              // never handed on to be built. What has no verdict is not handed.
              const aHanding = (handoffsByStep(aReq)[k] || []).filter((r) => !r.judged);
              if (aHanding.length) {
                const jh = await aJudge(aHanding, k);
                if (jh.failed) { await aEnded("failed"); return aDown(jh.error, jh.incomplete ? aUnfinished : "The builder is busy — try again in a moment."); }
                if (jh.ask) { aStepAsk = { kind: k, ask: jh.ask }; break; }
              }
              const aBriefHanded = requirementBrief(aReq.filter((r) => r.judged), k);
              if (aBriefHanded) aTold.add(k);
              // THE DESIGNER WHOSE QUESTION WAS ANSWERED is shown what its step
              // already had (round 12), by id, so it can say which it restates.
              // A FEATURE ON A PAGE THE SITE HAS is told to its component
              // designer (2026-10-25, row-hedge: `featureBrief`).
              const aBrief = aBriefHanded + aHeldShown(k) + featureBrief(aHand, k);
              // ── WHAT THIS DESIGNER WAS REALLY SHOWN (2026-09-15) ──────────
              //
              // Owner, after run 48: *"Recover the actual designer input if it
              // was recorded."* It was not — the record stored ONE `site`,
              // written after the whole loop, so a step that ran first was
              // recorded against facts rebuilt over its own answer. `aShown`
              // is per kind, taken from `aSite` AT THE CALL and from the same
              // expression the call is handed, so "did the function step see
              // `bookings`?" is a stored fact rather than an inference.
              //
              // ABOVE THE CALL, NOT BELOW IT: `aSite` is a `let` that the loop
              // rebuilds from this kind's own answer, so a digest taken after
              // the await would record the OUTPUT wearing the input's name.
              aShown.push({ kind: k, ...shownSchema(aSiteFor(k)) });
              // THIS KIND AND EVERY KIND WHOSE INPUTS ARE DECIDED, started now;
              // this one's early answer used only when its request is exactly
              // the one it would be asked now.
              const aEarlyOne = aTakeEarly(k, aBrief);
              let ranFirst = aEarlyOne ? await aEarlyOne : await runAdd({ send: aQuick("add:" + k, { refusals: true }) }, { kind: k, message: aInstruction, site: aSiteFor(k), model: aModels.quick, brief: aBrief });
              // ── A PRIOR REFUSAL OF THIS EXACT REQUEST (2026-10-13, correction
              //    reuse, on the owner's word) ──────────────────────────────
              //
              // Its preparation (or an earlier paused job of the part) asked
              // this exact request, refused the answer with this cleaner, and
              // asked once more with the reason. The refused answer is not
              // here — only the refusal's facts. They are used only when the
              // cleaner would judge against exactly what it judged then
              // (`cleanIn`: the site it cleans against and today); then the
              // turn goes straight to the correction, which is answered only
              // by an exact match and validated below like any answer.
              // Otherwise the request is asked now, as before.
              let aPrior = null;
              {
                const pr = ranFirst && ranFirst.failed ? priorRefusalOf(ranFirst.error) : null;
                if (pr) {
                  let here = "";
                  try { here = await valueDigest({ site: aSite, today: aToday }); } catch { here = ""; }
                  const why = typeof pr.why === "string" && pr.why.startsWith("add:") ? pr.why.slice(4) : "";
                  if (here && here === pr.facts.cleanIn && why && why !== "nothing") aPrior = pr.take();
                  if (!aPrior) {
                    aMark("add:" + k, "start", { again: true, prior: "declined" });
                    ranFirst = await runAdd({ send: aQuick("add:" + k) }, { kind: k, message: aInstruction, site: aSiteFor(k), model: aModels.quick, brief: aBrief });
                  }
                }
              }
              // IT NEEDS A RESULT IT WAS NOT SHOWN: asked again with it (`aNeedsAgain`).
              let ran = aPrior ? ranFirst : await aNeedsAgain(k, ranFirst, aBrief);
              // ── A DESIGNER THAT RETURNED NOTHING, ASKED ONCE MORE WITH THAT FACT ──
              //
              // (Round 2 of the retry rule, owner 2026-10-24.) It was picked for
              // this kind because the request asks for one, and it answered no
              // design and no question — the addition's `declined` ending when
              // every designer does it. Asked again the way the cleaner's
              // correction is asked (`feedback`, the same model and effort), and
              // through `aNeedsAgain` like any answer. A second empty answer is
              // the decline it was; a failed retry call keeps the first. Its
              // usage is on the bill only when the retry designed something.
              // …AND AN EMPTY LIST IS NOTHING TOO WHEN THE ROUTER HANDED A
              // FEATURE ON A PAGE TO THIS COMPONENT STEP (2026-10-25,
              // row-hedge: `designedNothing`; live, the Lessons booking's empty
              // design). Elsewhere an empty list stays the model's own decline
              // (validation-reuse VA 4).
              const aEmptyFeature = aFeature && k === "component" && designedNothing(ran && ran.value);
              if (!aPrior && ran && !ran.failed && !ran.ask && (ran.value === undefined || aEmptyFeature)) {
                const aDeclineFeedback = "Your answer designed nothing and asked nothing, so this part of the request would be dropped. The customer's request asks for a " + k + ": read it again and answer with the design for it in the tool's shape. If one detail only they can decide is missing, ask your one question instead; if the request really asks for no " + k + ", answer with nothing again.";
                let again = null;
                try {
                  aMark("add:" + k, "start", { again: true, prior: "empty" });
                  again = await aNeedsAgain(k, await runAdd({ send: aQuick("add:" + k) }, { kind: k, message: aInstruction, site: aSiteFor(k), model: aModels.quick, brief: aBrief, feedback: aDeclineFeedback }), aBrief, aDeclineFeedback);
                } catch { again = null; }
                const aAgainOk = !!again && !again.failed && (again.ask || again.value !== undefined);
                aMark("retry_reason", aAgainOk ? "ok" : "fail", { step: "add:" + k, reason: "declined", ok: aAgainOk });
                if (aAgainOk) {
                  // THE FIRST CALL'S USAGE JOINS THE DESIGN BILL with the answer
                  // that worked (the retry's own is pushed below, as any answer's).
                  if (ran.usage) aDesignUsage.push(ran.usage);
                  ran = again;
                }
              }
              // DECIDED: what waits on it starts at the next kind's turn, once
              // its result below is folded in.
              aDecided.add(k);
              // ── VALIDATED FIRST, THEN PROCESSED ONCE (2026-10-11, round 10) ──
              //
              // Codex's review of 4074eb38: the cleaner's correction ran AFTER
              // this answer's requirements, suggestions, skipped entries, trace
              // mark and stored record had been taken — so a corrected answer
              // replaced `ran` with none of that done for it. Its explicitly
              // requested requirement never reached the judge, and the request
              // said done when the writer had built ordinary cards.
              //
              // Now the cleaner reads the answer first. A refused answer is
              // marked (never replayed), billed, kept in the record as
              // superseded, and the designer is asked ONCE more with the
              // reason — through `aNeedsAgain`, so a correction that says it
              // needs a result it was not shown is asked again with it. Then
              // ONE path below processes whichever answer is final: grounding
              // and hand-offs, suggestions, skipped entries, the question,
              // usage, the trace and the stored record. A requirement the
              // refused answer grounded in their words and the correction no
              // longer lists is carried (`carrySuperseded`), so nothing they
              // asked for is lost. A second refusal is the answer.
              const aCleanOf = (r) => (r.failed || r.ask || r.value === undefined ? null : cleanAdd(k, r.value, { ...aSite, today: aToday }));
              let clean = aPrior ? null : aCleanOf(ran);
              let aSupersededReq = null;
              if (aPrior || (clean && !clean.ok && clean.why !== "nothing")) {
                let aFeedback, aRetryWhy = "";
                if (aPrior) {
                  // THE RECORDED REFUSAL, TAKEN: no answer to bill or keep (the
                  // preparation paid for it, and its content never left that
                  // record); the same correction, from its own facts.
                  const why = aPrior.why.slice(4);
                  aRetryWhy = why;
                  aMark("add:" + k, "correct", { why, skipped: 1 });
                  aKept.push({ kind: k, answered: true, superseded: why, skipped: true, stop_reason: null, content: null });
                  aSupersededReq = aPrior.superseded;
                  aFeedback = aPrior.feedback;
                } else {
                  aSupersededReq = ran.requirements;
                  aRetryWhy = clean.why;
                  // THE REASON, AND WHAT IT SAID THEY ASKED FOR, BY ID (round 11):
                  // so the correction can say which requirement it restates.
                  aFeedback = addRefusal(clean.why, k) + " (" + clean.why + ")" + supersededNote(aSupersededReq);
                  // ITS FACTS RIDE WITH THE MARK (2026-10-13) — only for a refusal
                  // of the first request itself, the one a later job's first
                  // request can match.
                  let cleanIn = "";
                  if (ran === ranFirst) { try { cleanIn = await valueDigest({ site: aSite, today: aToday }); } catch { cleanIn = ""; } }
                  rejectReply(ran.raw, "add:" + clean.why, cleanIn ? { feedback: aFeedback, superseded: Array.isArray(aSupersededReq) ? aSupersededReq : [], cleanIn } : undefined);
                  aMark("add:" + k, "correct", { why: clean.why });
                  if (ran.usage) aDesignUsage.push(ran.usage);
                  aKept.push({ kind: k, answered: true, superseded: clean.why, stop_reason: (ran.raw && ran.raw.stop_reason) || null, content: (ran.raw && ran.raw.content) || null });
                }
                const fixFirst = await runAdd({ send: aQuick("add:" + k) }, { kind: k, message: aInstruction, site: aSiteFor(k), model: aModels.quick, brief: aBrief, feedback: aFeedback });
                ran = await aNeedsAgain(k, fixFirst, aBrief, aFeedback);
                clean = aCleanOf(ran);
                // RETRY_REASON {step, reason, ok} (2026-10-24): this step already
                // retried once with the cleaner's reason (`no-job-fn` among them),
                // same model and effort; the mark makes it read like every other.
                { const rWhy = aRetryWhy || "refused"; const rOk = !!(clean && clean.ok); aMark("retry_reason", rOk ? "ok" : "fail", { step: "add:" + k, reason: rWhy, ok: rOk }); }
                if (clean && !clean.ok && clean.why !== "nothing") rejectReply(ran.raw, "add:" + clean.why);
              }
              // HOP 3 OF EIGHT, AND IT IS ABOVE EVERY `continue` AND `return`
              // BELOW IT. A coverage list read after the decline check, after
              // the cleaner's refusal or after the truncation check is a list
              // that vanishes in exactly the three cases worth reading it in.
              // …AND ONLY WHAT THEIR WORDS HOLD UP (2026-10-05, run 101): a
              // requirement resting on words they never wrote is set aside —
              // not counted, not handed on, never reported to them as set up,
              // unconfirmed or missing — and the designer's extras kept apart.
              const aGround = groundRequirements(ran.requirements, aGrounding);
              // WHAT THIS STEP HAD BEFORE THE PAUSE (round 12), reconciled first
              // and keeping its ids; then what a refused answer had.
              for (const r of aHeldCarry(k, aGround.list)) aGround.list.push(r);
              for (const r of aSupersededReq ? carrySuperseded(groundRequirements(aSupersededReq, aGrounding).list, aGround.list, aReq.map((x) => x.id)) : []) aGround.list.push(r);
              for (const r of aGround.list) aReq.push(r);
              for (const r of aGround.ungrounded) aUngrounded.push(r);
              for (const t of Array.isArray(ran.suggestions) ? ran.suggestions : []) {
                if (typeof t === "string" && !aSuggested.some((x) => x.toLowerCase() === t.toLowerCase())) aSuggested.push(t);
              }
              for (const t of Array.isArray(ran.suggestionsOver) ? ran.suggestionsOver : []) if (typeof t === "string" && !aSuggestOver.includes(t)) aSuggestOver.push(t);
              for (const r of Array.isArray(ran.reqSkipped) ? ran.reqSkipped : []) aReqSkipped.push(r);
              aMark("add:" + k, ran.failed ? "fail" : "ok", { answered: ran.value !== undefined, needs: aGround.list.length, ungrounded: aGround.ungrounded.length, suggested: (ran.suggestions || []).length, asked: ran.ask ? 1 : 0 });
              if (ran.usage) aDesignUsage.push(ran.usage);
              if (ran.failed) { await aEnded("failed"); return aDown(ran.error, "The builder is busy — try again in a moment."); }
              aKept.push({ kind: k, answered: ran.value !== undefined, stop_reason: (ran.raw && ran.raw.stop_reason) || null, content: (ran.raw && ran.raw.content) || null });
              // ── A DESIGNER ASKED (2026-10-02) ────────────────────────────
              //
              // It could not design its kind without a detail they left out.
              // The loop stops here: every designer runs before anything of the
              // addition is applied, so nothing is applied or charged, and the
              // answer resumes the WHOLE addition — the designs made before it
              // were made without the answer, and are made again with it, once.
              if (ran.ask) { aStepAsk = { kind: k, ask: ran.ask }; break; }
              if (ran.value === undefined) { aDeclined.push(k); continue; }
              // `today` IS THE SITE'S OWN LOCAL DATE, not ours, and it is
              // stamped HERE rather than inside `siteFacts` for one reason:
              // `aSite` is rebuilt from the proposal after every kind, so a
              // field the rebuild does not know about would silently vanish
              // between the first designer and the last — which for a
              // past-date check means the wall stands down for every kind but
              // the first, exactly as if it were not there. One place, at the
              // one call that reads it. `cleanAdd` never writes to its site
              // argument (`ctx` is its own), so the spread costs nothing.
              // CLEANED ABOVE (`aCleanOf`), and corrected there at most once.
              if (!clean.ok) {
                // A REFUSAL CARRIES THE COVERAGE TOO. The model told us what
                // the change needed before we decided its design was unusable,
                // and throwing that away here is how the one case worth reading
                // — "it could not express this" — reaches a customer as a bare
                // refusal sentence. Nothing ran, so nothing is claimed covered.
                // JUDGED FIRST, SO WHAT IT TELLS FOLLOWS FROM THEIR WORDS
                // (2026-10-05): a judgment that fails, asks or does not finish
                // here leaves the requirements unjudged and untold — the
                // refusal is the answer, and it says nothing was added.
                // ONE KIND REFUSED NEVER SINKS THE REST (owner, 2026-10-22, the
                // big add-on test: a job naming a function the site did not
                // have threw away 22 other asks). The refused kind is left out
                // and named (`notAdded`, in its own sentence) and the loop goes
                // on; only when NOTHING designed does the refusal stand as the
                // answer (at `!aAnswers.length`, below).
                aNotAdded.push({ kind: k, why: clean.why, msg: addRefusal(clean.why, k) });
                aKindRefused.push({ kind: k, why: clean.why });
                continue;
              }
              // ── VALIDATED BEFORE ANYTHING IS APPLIED (owner, 2026-09-13) ──
              //
              // The MODEL'S OWN items, taken from `ran.value` — never the
              // folded spec and never the normaliser's output. That is the
              // difference between "the model asked for something the engine
              // cannot do" and "the engine derived a field", and only the first
              // is feedback anybody can act on.
              //
              // AND `ran.value`, NOT `clean.value` (owner, 2026-09-14:
              // *"Validation still happens after information is lost."*). For
              // three of the four tiers the cleaner builds a FRESH object out
              // of the keys it knows, so a property the tool never offered was
              // gone one hop before the observer looked. MEASURED through this
              // route: a function answer carrying `encryptAtRest: true,
              // retries: 3` gave `clean.skipped: []`, an audit of the cleaned
              // item of `reached: []`, and an audit of the DECLARED item of
              // `reached: ["encryptAtRest", "retries"]` — with the customer
              // told nothing either way. Only the TABLE tier escaped it, by an
              // accident of shape: its cleaner spreads, so unknown keys
              // survived to the engine. `sent` is what really goes in, keyed by
              // name, so a key the CLEANER removed reads exactly like one the
              // ENGINE removed — which is right, because both are a property
              // the customer asked for and did not get.
              //
              // `droppedFields` is the existing derived reader and it is used
              // rather than a third list: a property is reported only when
              // removing it changes NOTHING the engine keeps, so every
              // documented alias survives by construction — `softDelete` maps
              // onto `trash` and therefore changes the answer. A list of
              // accepted names here would be the second copy of the parser's
              // alias map, which is the drift this repository has a name for.
              //
              // ALL FOUR TIERS NOW, AND EACH VALIDATED WITH ITS DEPENDENCIES
              // PRESENT (2026-09-14). This was gated on `k === "table"`, and
              // the two readers themselves read only `spec.tables` — so
              // `droppedFields({functions: […]})` answered `[]` whatever it was
              // handed. Three of the four tiers the engine normalises had NO
              // reach report and NO refusal report: a negative assertion whose
              // observer was never alive, which reads exactly like a designer
              // that stayed inside the tool.
              //
              // `aProposed` is the context because a dependent item normalised
              // ALONE is dropped whole — a job without its function, a function
              // returning `setof bookings` without `bookings` — and reporting
              // that as the model's failure would be wrong three ways.
              //
              // `unbuilt` is the report that only exists above the table tier:
              // an item the engine dropped WHOLE, with no field to point at.
              const tier = SPEC_OF_KIND[k];
              if (tier) {
                const itemOf = (e) => (k === "table" ? (e && e.table) : e);
                // WHAT THE MODEL DECLARED, and what really goes into the engine
                // keyed by NAME — never by position, because a cleaner that
                // refuses one item shifts every index behind it.
                const mine = (Array.isArray(ran.value) ? ran.value : [ran.value])
                  .map(itemOf).filter((t) => t && typeof t === "object" && t.name);
                const sent = new Map((Array.isArray(clean.value) ? clean.value : [clean.value])
                  .map(itemOf).filter((t) => t && typeof t === "object" && t.name)
                  .map((t) => [String(t.name).toLowerCase(), t]));
                if (mine.length) {
                  // The proposal WITH this kind's items in it, so a sibling
                  // designed earlier in the same message counts as present.
                  const context = proposedSpec(aProposed, k, clean.value);
                  const audit = auditTier({ [tier]: mine }, k, context, { sent });
                  for (const n of audit.reached) aBadProps.add(n);
                  for (const n of audit.refused) aBadProps.add(n);
                  // THE OTHER PARTY. The engine had a use for it and this step
                  // could not carry it — a different sentence and a different
                  // thing to go and fix. Never added to `aBadProps` as well: a
                  // property in both lists is reported as the database refusing
                  // something it supports.
                  for (const n of audit.unexpressed) aUnexpressed.add(n);
                  // A DECLARED VALUE THE PIPELINE STORED DIFFERENTLY is neither
                  // reached-for nor refused: it reached something and the
                  // something is live, and it is not what was asked for.
                  for (const n of audit.changed) aChanged.add(n);
                  if (audit.unbuilt.length) {
                    aUnbuilt[k] = [...(aUnbuilt[k] || []), ...audit.unbuilt];
                    // AN ITEM THE ENGINE WILL NOT BUILD IS A FAILURE OF THIS
                    // STEP, and the requirement coverage has to hear it: a
                    // function that vanished cannot cover anything, however
                    // confidently the designer said it would.
                    aFailedKinds.add(k);
                  }
                }
              }
              // ── THE FRONTEND KINDS GET THEIR OWN AUDIT (2026-09-14) ───────
              //
              // Owner: *"Validate page and component declarations before
              // cleaning discards information."* `SPEC_OF_KIND` names the four
              // SCHEMA tiers, so the block above is skipped for `page` and
              // `component` entirely — and MEASURED, a page declaring
              // `seoTitle` and `cacheForever` cleaned to its eight known keys
              // with `skipped: []` and nothing anywhere said so.
              //
              // Their pipeline is the cleaner and the directive, not the schema
              // engine, so the validator is `auditFrontend`: the tool's own
              // item properties against what the cleaner kept. The three lists
              // pool into the SAME two customer clauses the schema tiers use —
              // a lost guarantee reads the same whichever layer lost it.
              {
                const fa = auditFrontend(k, Array.isArray(ran.value) ? ran.value : [ran.value],
                  Array.isArray(clean.value) ? clean.value : [clean.value]);
                for (const n of fa.reached) aBadProps.add(n);
                for (const n of fa.changed) aChanged.add(n);
                for (const n of fa.unexpressed) aUnexpressed.add(n);
              }
              // A KIT NAME THAT IS NOT IN THE KIT, dropped by the cleaner and
              // named here — the tool promises in as many words that naming a
              // component that does not exist is refused, and until today it
              // was written into the directive instead.
              for (const n of Array.isArray(clean.unknownKit) ? clean.unknownKit : []) aUnknownKit.add(n);
              for (const d of Array.isArray(clean.dropped) ? clean.dropped : []) {
                if (d && typeof d === "object") aDropped.set(String(d.what) + ":" + String(d.name), d);
              }
              for (const sk of Array.isArray(clean.skipped) ? clean.skipped : []) aNotAdded.push({ kind: k, ...sk, msg: addRefusal(sk.why, k) });
              aAnswers.push({ kind: k, value: clean.value, requirements: ran.requirements });
              // THE DESIGN, AS A MILESTONE: what this kind will be, from the
              // cleaned answer itself, and what is designed or built next.
              if (aJob && aJob.progress) aJob.progress.mark("designed", addonDesignedFacts(k, clean.value, aDesigning.slice(aDesigning.indexOf(k) + 1)));
              // WHAT EACH DESIGNER DECLARED IS TOLD TO THE DESIGNERS AFTER IT.
              //
              // This was two lists pushed to by hand — `functions` and
              // `jobFns`, because a job names its function BY NAME and without
              // them a message asking for a reminder designed the builder and
              // then refused the job that runs it. Every other fact stayed
              // behind: the connection designer could not see the table, and
              // the page designer was handed the STORED site.
              //
              // One accumulation now (2026-09-14), rebuilt from the proposal,
              // so every later designer sees everything decided so far and
              // `siteNote` marks each of them as being added by this change.
              //
              // ONE FOLD FOR BOTH HALVES (`aFoldInto`, 2026-10-11), kept in
              // order (`aFolded`) so a designer shown only the results it uses
              // is shown them folded exactly as here (`aSiteFor`).
              if (tier) {
                const st = { spec: aProposed, names: aNewNames, pages: aNewPages };
                aFoldInto(st, k, clean.value);
                aProposed = st.spec;
                aFolded.push({ kind: k, value: clean.value });
                aSite = siteFacts(aProposed);
              }
              // ── AND THE FRONTEND HALF (2026-09-17) ──────────────────────
              //
              // The same hand-off, for the one frontend kind that creates
              // something a later kind can point at. `page` runs before
              // `component`, `qr` and `three` in `ADD_KINDS`, so a message
              // asking for a gallery page and a code that opens it had the
              // page decided and the code refused in the same reply.
              //
              // `SPEC_OF_KIND` HAS NO `page` ENTRY AND MUST NOT GAIN ONE —
              // it names the four SCHEMA tiers and `proposedSpec` writes
              // into a spec list, which a page is not. This is its own
              // branch for that reason rather than by omission.
              if (k === "page") {
                aFoldInto({ spec: aProposed, names: aNewNames, pages: aNewPages }, k, clean.value);
                aFolded.push({ kind: k, value: clean.value });
                aSite = siteFacts(aProposed);
              }
            }
            } finally { aLoopDone = true; if (aStepAsk && ADD_KINDS.includes(aStepAsk.kind)) aAskedBy = aStepAsk.kind; }
            // HOP 7 OF EIGHT: the developer-facing record, beside the raw
            // replies run 28 is the reason for. Everything the customer is not
            // told — the counts, the unreadable entries, the invalid property
            // names, which step each requirement was handed to — lives here.
            //
            // WRITTEN TWICE, DELIBERATELY (owner, 2026-09-14: *"Update the
            // stored coverage after application too."*). This write is the only
            // one that survives a designer's refusal or a decline, and it
            // happens BEFORE the apply, so every verdict in it is decided
            // against an empty `made` — which is the honest answer at this
            // point and not the final one. `aRecordCoverage` re-writes it once
            // the apply has landed, so the stored record says what really
            // became of each requirement rather than what it looked like
            // before a single statement reached Postgres.
            const aRecord = (failed = null) => requirementRecord({
              list: aReq, skipped: aReqSkipped, invalid: [...aBadProps], altered: [...aChanged],
              ungrounded: aUngrounded, suggestions: aSuggested, suggestionsOver: aSuggestOver,
              refusedRules: aRefused, judgeItemsOver: aJudgeOver,
              judged: true, setAside: aSetAside, verdictsInvalid: aVerdictsBad, verdictsMissing: aVerdictsMissing,
              ran: aAnswers.map((a) => a.kind), told: [...aTold], shown: aShown,
              failed: [...aFailedKinds], failedItems: aFailedItems(),
              made: aMade(failed), reportable: aReportable(failed), existing: aExisting(),
              content: failed ? null : aContent,
              unbuilt: aUnbuilt, unexpressed: [...aUnexpressed],
              unknownKit: [...aUnknownKit], missingPages: aMissing,
              // AND THE FIELDS BINNED INSIDE AN ITEM THAT WAS BUILT, by name.
              // On the reply since they existed and never on the record until
              // 2026-09-20 — so the count the customer heard had nothing
              // behind it that anybody could come back to.
              dropped: [...aDropped.values()],
              // AND WHICH OF THE SITE'S PAGES THE PROMPT WINDOW COULD NOT
              // CARRY. On the STORED record as well as the reply, because the
              // reply is read once and the record is what anybody comes back
              // to — and this is the one fact that explains a weak result on a
              // large site. The record is re-written below the publish, so it
              // catches this whichever branch the change took.
              unseenPages: aUnseenPages,
            });
            const aSaveAnswer = async () => {
              try { await aKeepAnswer(env, ownerSlug, { message: aInstruction, site: aSite, kinds: aKinds, replies: aKept, coverage: aRecord() }); }
              catch (e) { console.error("addon answer save failed:", ownerSlug, e && e.message); }
            };
            aRecordFor = (failed) => aRecord(failed);
            // ── THE LAST JUDGMENT, WITH EVERYTHING DESIGNED IN VIEW (2026-10-05) ──
            //
            // Before anything is applied or charged, so a judgment that fails
            // stops here as a designer's failed call does, and one that asks is
            // the addition's question. Skipped when a step already asked: the
            // whole addition is designed again with the answer.
            if (!aStepAsk && !aAnswers.length && aKindRefused.length) {
              // EVERY KIND THAT DESIGNED WAS REFUSED: the first refusal is the
              // answer, as it was when one refusal ended the loop.
              aRestoreLeft();
              if (aReq.length) await aJudge(aReq.slice());
              const r0 = aKindRefused[0];
              return aFail({ ok: false, error: "add", kind: r0.kind, reason: r0.why, cost: 0, msg: addRefusal(r0.why, r0.kind) }, 422);
            }
            if (!aStepAsk) aRestoreLeft();
            const aFinalJudge = !aStepAsk && aReq.length ? await aJudge(aReq.slice()) : null;
            if (aFinalJudge && aFinalJudge.ask) aStepAsk = { kind: "requirements", ask: aFinalJudge.ask };
            await aSaveAnswer();
            if (aFinalJudge && aFinalJudge.failed) { await aEnded("failed", aRecord()); return aDown(aFinalJudge.error, aFinalJudge.incomplete ? aUnfinished : "The builder is busy — try again in a moment."); }
            // THE QUESTION IS THE ADDITION'S ANSWER: kept by the route's ending
            // (`askReport`), with this whole request as what its answer resumes.
            // Nothing was designed into the site, applied or charged for it —
            // and the designers' calls are ours, as on every way a step asks.
            if (aStepAsk) {
              // THE DESIGNERS ALREADY ASKED FINISH FIRST (2026-10-11): their
              // answers are kept with the job, so the answer to this question
              // resumes only the work it reaches (`stageKept`).
              // …AND READY WORK THE QUESTION DOES NOT REACH IS STARTED AND
              // FINISHED TOO, round after round, as each answer readies the next.
              aStartReady();
              for (let round = 0; round < ADD_KINDS.length + 1; round++) {
                const out = aEarly.size;
                await Promise.allSettled([...aEarly.values()].map((e) => e.p));
                aStartReady();
                if (aEarly.size === out) break;
              }
              aAskOut.request = aInstruction;
              aHold(aReq, aStepAsk.kind);
              await aEnded("asked", aRecord());
              return Response.json({ ok: false, error: "clarify", layer: "addon", kind: aStepAsk.kind, ...(ADD_KINDS.includes(aStepAsk.kind) ? { by: "add:" + aStepAsk.kind } : {}), cost: 0, unchanged: true, ask: aStepAsk.ask, msg: aStepAsk.ask.text });
            }
            if (!aAnswers.length) {
              // THE SHAPE THIS WAS BUILT FOR. Every designer declined, so there
              // is no design to read and, until now, nothing but a boolean to
              // say why — run 28's three blind declines. The coverage list
              // survives an answer that designed nothing, which is the whole
              // reason it rides beside `value` rather than inside it.
              return aFail({ ok: false, error: "declined", kinds: aDeclined, cost: 0, msg: addRefusal("nothing") }, 422);
            }
            // THE FOLD: what the look and the schema store, what the page call
            // is told, and the union of kit parts it is shown the props of.
            const aFold = foldAdds(aAnswers, aLook, aSite);
            const aDesigned = aFold.designed;
            // HOP 8 OF EIGHT: the trace. Counts only — a mark keeps finite
            // numbers and drops everything else (`tr.at`), and the needs
            // themselves are the customer's words, which belong in the stored
            // record and not in a telemetry row. `bad` is what the validator
            // found, so a run that quietly dropped a property is readable here
            // without opening the answer file.
            // THE THREE STATES ON THE MARK BESIDE THE THREE STATUSES. A status
            // is what the model SAID; a state is what really became of it, and
            // without both a run where every claim was unverifiable is
            // indistinguishable from one where every claim held.
            {
              const st = requirementOutcomes(aReq, { told: [...aTold], failed: [...aFailedKinds], failedItems: aFailedItems(), made: aMade(), reportable: aReportable(), existing: aExisting(), judged: true });
              aMark("coverage", "ok", {
                ...requirementCounts(aReq, aReqSkipped), bad: aBadProps.size, moved: aChanged.size,
                // BESIDE `bad`, NEVER SUMMED INTO IT: a run where the addon lost
                // a setting the database supports is a different finding from
                // one where the database refused it, and one number cannot say
                // which happened.
                lost: aUnexpressed.size,
              });
              // THE STATES ON A MARK OF THEIR OWN (2026-10-07): the trace keeps
              // eight keys a mark (`MAX_DETAIL_KEYS`) and this one carried
              // seventeen, so the nine after `lost` were dropped unread.
              aMark("coverage:states", "ok", {
                done: st.filter((r) => r.state === "delivered").length,
                // SIX STATES ON FIVE KEYS, and the grouping is the finding
                // rather than a shortening: `failed` and `blocked` are both
                // "did not work" to a reader scanning marks, `unverified` and
                // `configured` are both "there, unchecked", and `gone` is the
                // one this change separated out — work that is not there,
                // which used to be counted under `broke` for any hand-off
                // nobody delivered. `unsent` is that hand-off ledger, beside
                // the work rather than standing in for it.
                broke: st.filter((r) => r.state === "failed" || r.state === "blocked").length,
                unsure: st.filter((r) => r.state === "unverified" || r.state === "configured").length,
                gone: st.filter((r) => r.state === "missing").length,
                // NOBODY COULD SEE IT EITHER WAY — beside `unsure` rather than
                // in it: a run of these built nothing anybody can point at, and
                // summed together the two read as a productive run nobody
                // checked. It is also the number that says the existing-site
                // readers went quiet, which is a platform fact worth watching.
                unseen: st.filter((r) => r.state === "unknown" && !r.unjudged).length,
                // NO VERDICT ANYBODY MAY TRUST (2026-10-05): its own number,
                // never told and never in `unseen` — it is not a thing nobody
                // could see, it is a requirement nobody established.
                unjudged: st.filter((r) => r.unjudged).length,
                // AND WHAT THE JUDGMENT TOOK OUT OF THE LIST: offered as a
                // suggestion, or set aside as not following from their words.
                setAside: aSetAside.length,
                unsent: st.filter((r) => r.handoff === "undelivered").length,
              });
              aMark("coverage:unbuilt", "ok", {
                unbuilt: Object.values(aUnbuilt).reduce((n, v) => n + (Array.isArray(v) ? v.length : 0), 0),
              });
            }

            // ── THE BACKEND, ANY TIER OF IT, AND A DATABASE ON FIRST TOUCH ──
            //
            // Owner, 2026-09-03: "the build step doesnt have backend so its
            // gonna be on the addon step if needed … if customer touches it
            // then neon db is created". A first build sends none of the four
            // tiers, so a table, a function, an outside connection or a
            // scheduled job is added HERE — and the first of any of them on a
            // site with no database is what makes the database. This block
            // refused a designed table on such a site by name, twice (once
            // before the design, once here); now it provisions, through the
            // build route's own call — the slug's own Neon project, claimed
            // atomically, auth and the Data API enabled, idempotent on a
            // retry — and applies to what it made.
            //
            // Every statement the engine emits is additive or IF NOT EXISTS,
            // so applying a merged spec to a live database adds what is new
            // and leaves what is there; a function is CREATE OR REPLACE, so
            // one named again is replaced. Seeding is best-effort and skips a
            // table that already has rows, exactly as it does on a revise.
            const aBackend = backendDesigned(aDesigned);
            let aSeeded = null, aSeedUsage = null, aSeedTopUp = null;
            // `aProvisioned` IS DECLARED WITH THE OTHER APPLIED RESULTS, above the
            // kinds loop: a failure's outcome reads it.
            // What sequence #1 reserved ahead of the schema apply, and whether it
            // did — see the block before `aApplyBackend`.
            let aFirst = 0, aFirstPlaced = false;
            // ── THE APPLY IS DEFERRED (stage 8, 2026-09-05) ─────────────────
            //
            // The schema used to be applied HERE, before the page call and the
            // compile, so a publish that then failed kept the tables and said
            // "your site is untouched": run 33 left `waiting_list` on
            // fretwork-1 with no page showing it. Nothing in the page call, the
            // compile or the render check needs the schema applied — the page
            // call reads the SPEC (the union below), the render check answers
            // every `/api/` request with `[]` — so the apply moves to the last
            // moment before the publish gate: the spine's seam on the page
            // path (after the repair round and the reservation check, before
            // staging), and straight away on the pageless path, which has no
            // compile. Built inside the block below, where `merged` and the
            // seed are in scope; `null` when this addition designed no backend.
            // Under a record: `builder/site-migrations.mjs`.
            let aApplyBackend = null;
            let aMigration = null;
            const aMigJob = aJob ? String(aJob.id) : "sync:" + String((editTrace && editTrace.cid) || Date.now());
            // AN ADDITION NOT CLEARED TO CHANGE THE SCHEMA BESIDE OTHERS
            // (2026-10-16): its targets named no table, so it was filed beside
            // another part that may be changing the schema. It designed tables
            // after all: nothing is made, nothing charged, and the request runs
            // it again alone (`conflict` is the overlap code it re-runs on).
            if (aBackend.length && aJob && aJob.beside && aJob.beside.schema === false && await othersOpen(env, ownerSlug, aJob.beside.request)) {
              aMark("schema", "fail", { error: "not cleared beside others" });
              return aFail({ ok: false, error: "conflict", ours: true, cost: 0, msg: "That addition wasn't made — it needs to change your site's data, and another change in the same request could have been changing it at the same time. Nothing was changed." }, 409);
            }
            if (aBackend.length) {
              if (!adb) {
                // MAY THE DATABASE BE MADE? (async path) A cold provision is
                // tens of seconds of Neon calls; the cancel and the budget are
                // re-asked before it, as they are before the page call.
                // A PREPARATION NEVER MAKES A DATABASE: its designs are done.
                if (aPrep) return aPrepStop();
                const aGateProv = aJob ? aJob.gate("editing") : null;
                if (aGateProv && !aGateProv.go) return await editStopped(env, { job: aJob, why: aGateProv.why, phase: "editing", trace: editTrace, ctx, extra: aStopEvidence() });
                aMark("provision", "start", { tiers: aBackend });
                // STARTED BESIDE THE PAGE WRITER, NOT AWAITED HERE (2026-10-16):
                // nothing before the schema's apply needs the database — the
                // seed net, the first reserve and the page call read the spec —
                // so the provision's tens of seconds overlap the page writer's
                // minutes. It is settled after the page call (`aProvCheck`), at
                // the top of the pageless path, and before every exit; a failure
                // answers exactly as it did, and the reserve already taken is
                // refunded with the rest of a job that did not ship.
                const aProvRun = () => ensureSiteBackend(env, ownerSlug, ou.id, aInstruction, (n) => aMark("prov:" + n, "ok")).then((db) => {
                  adb = db;
                  aProvisioned = true;
                  aMark("provision", "ok");
                  return null;
                }, (e) => {
                  aMark("provision", "fail", { stage: (e && e.stage) || null });
                  console.error("addon provision failed:", ownerSlug, e && e.status, e && (e.detail || e.message));
                  return e || new Error("provision failed");
                });
                // ⚠ ON THE PAGE PATH, NOT UNTIL THE PAGES COMPILE (2026-10-23).
                // Started beside the page writer, a database was made for an
                // addition whose pages then failed to compile, and nothing undid
                // it (`saltmarsh-and-sparrow`: an orphan project). Undoing a
                // provision touches four stores (the project row, the backend
                // row, the route, Neon) on a live site, so it is not attempted;
                // the provision waits for the seam instead, after a successful
                // compile and right before the schema's apply. The pageless
                // path has no compile and starts it now, as before.
                if (pageless(aAnswers)) aProvWait = aProvRun();
                else aProvDeferred = aProvRun;
                // A DATABASE JUST MADE STORES NOTHING — the honest spec, the
                // one a site with no database was described by above.
                aSpec = { tables: [] };
              }
              // A TABLE THE SITE ALREADY HAS CAN NOW BE ALTERED, narrowly. The
              // concat this replaces fed `normalizeSchema`, whose dedup is
              // first-declaration-wins — so `payment` and `publicView` on an
              // existing table were dropped silently and a site built without a
              // price could never start taking money. `mergeAddonSchema` keeps
              // the columns-only behaviour that was right and adds those two;
              // `access` stays the site's own, because the tool COMPELS it.
              // THE WHOLE DESIGNED SPEC, not just its tables. Passing
              // `{tables}` alone dropped `functions`, `apis` and `jobs` before
              // `normalizeSchema` ever saw them — measured — which is the entire
              // "the model writes the backend" tier unreachable on any site
              // after its first build: no inbound webhook handler, no
              // confirmation computed by SQL, no third-party read.
              // THE WHOLE OVERLAY UNDER A DRAFT (2026-10-18, audit A04-1): the held
              // functions, apis and jobs of earlier add-ons are merged in by
              // name, so this add-on's held schema and jobs ops are whole. Off
              // a draft the table list alone, as before: a stored function has
              // no body to re-send.
              const folded = mergeAddonSchema(aDraftView ? aSpec : (aSpec.tables || []), aDesigned);
              aAltered = folded.altered;
              aAccessDesigned = aDesigned;
              const merged = normalizeSchema(folded.spec);
              // THE SEED NET, on the lane that ADDS display tables to LIVE
              // sites. The build path grew this on 2026-08-12 (the designer
              // omits its own required `seed` — measured twice) and this lane
              // was left one step short of the same promise: a customer asking
              // "add a specials menu" paid ~25 credits for a page over a
              // permanently-empty table, reported as success (2026-08-14
              // audit). NARROWED TO THE TABLES THIS ADDON ADDED — a
              // re-declared existing table is skipped by seedSiteRows when it
              // already has rows, so buying rows for one spends a Haiku call
              // on rows that are immediately discarded.
              let aSeed = aDesigned.seed;
              // ONLY WHEN A TABLE WAS ADDED: a function, a connection or a job
              // has no rows to buy, and the net is a model call.
              if (folded.added.length) {
                const aTop = await topUpSeed(
                  { send: aQuick("seed") },
                  { brief: aInstruction, spec: { ...aDesigned, tables: (aDesigned.tables || []).filter((t) => t && folded.added.includes(t.name)) }, seed: aSeed,
                    model: modelsFor(ab && ab.picker).quick },
                );
                if (aTop.gaps.length) {
                  // Same as the build lane: without `failed` a dead provider and a
                  // junk answer are one message. See the note there.
                  aSeedTopUp = { gaps: aTop.gaps, filled: Object.keys(aTop.rows), ...(aTop.failed === true ? { failed: true } : {}) };
                  console.log("addon seed top-up:", ownerSlug, JSON.stringify(aSeedTopUp));
                }
                if (Object.keys(aTop.rows).length) aSeed = mergeSeed(aSeed, aTop.rows);
                aSeedUsage = aTop.usage;
              }
              // ── THE RESERVE PRECEDES THE FIRST WRITE (2026-09-05, 1a-ii) ──
              //
              // Under a job the designers' and the seed net's spend is reserved
              // HERE, before the schema is applied, so a ledger that refuses
              // prevents the DDL and not only the publish — the pageless
              // outcome's whole bill, and the first half of the page path's
              // (its page call is reserved as sequence #4 once it has run).
              // Synchronously nothing moves: the collect stays after the work,
              // as it always did. The consumer refunds a landed #1 when the
              // rest does not ship.
              // PREPARED: designs and the seed net answered; the first reserve and
              // the first write are the job's.
              if (aPrep) return aPrepStop();
              if (aJob) {
                aFirst = await aCharge(pageCredits(...aDesignUsage, aSeedUsage));
                aFirstPlaced = true;
                if (aCharges.refused() > 0) { const u = unbilledBody(aCharges); return aFail(u.body, u.status); }
              }
              // ── THE SCHEMA IS APPLIED AFTER THE COMPILE (stage 8) ──────────
              //
              // THE PAGE CALL READS THE UNION, not the database: the stored
              // spec with this addition's tables, functions, connections and
              // jobs folded in by name — what `loadSiteSchema` would answer
              // AFTER the apply, without applying. The apply itself, the
              // report reads, the job registration and the seeding are the
              // closure below, run by the seam on the page path and directly
              // on the pageless path. `aNamed` reads the names THIS message
              // designed, so the reply says what the engine made of THEM — a
              // function that failed to CREATE is in `functionErrors`, never
              // in `functions`.
              aSpecHad = aSpec;
              aSpec = unionSpec(aSpec, merged);
              const aNamed = (k) => (Array.isArray(aDesigned[k]) ? aDesigned[k] : []).map((x) => x && String(x.name || "").toLowerCase()).filter(Boolean);
              aApplyBackend = async (version) => {
                // FILED `pending` BEFORE THE FIRST STATEMENT — a job that dies
                // between the record and the apply leaves a record a person
                // can read against the database, never a table with no
                // author. The version is the publish's, so the record and the
                // manifest name the same thing; the pageless path has none.
                aMigration = await recordSiteMigration(env, ownerSlug, newMigration({
                  job: aMigJob, slug: ownerSlug, version,
                  added: folded.added, altered: folded.altered.map((a) => a && a.table),
                  functions: aNamed("functions"),
                  provisioned: aProvisioned,
                }));
                aMark("schema", "start", { added: folded.added.length, altered: folded.altered.length, version: version || null });
                let aMade = null;
                try {
                  aMade = await applySiteSchema(adb, merged);
                  // WHAT WAS CREATED, not what was NAMED. This read every table
                  // the designer mentioned, which was harmless while an existing
                  // one could not be touched and became a lie the moment it could:
                  // "made a bookings table" for a booking table the site has had
                  // since it was built.
                  aTables = folded.added;
                  aSpec = aWriter.holding ? merged : (await loadSiteSchema(adb).catch(() => null)) || merged;
                  aSpecHad = null;
                } catch (e) {
                  // `failed`: nothing activated, the refund clean — the seam
                  // answers a refusal and the route says it is ours; the
                  // record keeps the error, so the next ask can read why.
                  const detail = scrubSecrets(String((e && (e.detail || e.message)) || "")).slice(0, 300);
                  aMark("schema", "fail", { error: detail.slice(0, 200) });
                  console.error("addon schema apply failed:", ownerSlug, detail);
                  aMigration = (await settleSiteMigration(env, ownerSlug, aMigJob, "failed", { error: detail.slice(0, 200) })) || aMigration;
                  return { ok: false, detail };
                }
                // WHAT THE ENGINE MADE, by the names THIS message designed — the
                // build response's own reading of `made.functions`, the
                // connections and the jobs the merge kept, and every `{{SECRET}}`
                // a new connection needs, so the reply can say what to paste.
                const aMadeFns = Array.isArray(aMade && aMade.functions) ? aMade.functions : [];
                // THE APPLY REALLY RAN, so from here an empty `aFunctions` means
                // the engine made none rather than that nobody has asked yet —
                // which is the whole difference between `missing` and
                // `unverified` for a requirement handed to a backend step.
                // Set AFTER the throwing statements above and before anything
                // reads it, so a refused apply never claims to have looked.
                aApplied = true;
                aFunctions = aNamed("functions").filter((n) => aMadeFns.includes(n));
                aFnErrors = Array.isArray(aMade && aMade.functionErrors) ? aMade.functionErrors.slice() : [];
                aRefused = Array.isArray(aMade && aMade.refusedRules) ? aMade.refusedRules.slice() : [];
                // A FUNCTION THAT FAILED TO CREATE IS THE SAME KIND OF FACT and
                // was already reported — it just never reached the coverage,
                // so a requirement handed to the `function` step still read as
                // delivered on a change where the function does not exist.
                if (aFnErrors.length) aFailedKinds.add("function");
                // THE REPORT IS KEPT, not discarded — `{seeded, skipped}` is the
                // only thing that can say why a new table arrived empty, and the
                // old bare `await` threw it away, so the failure could not name
                // itself here any more than it could on the build path.
                try { aSeeded = await seedSiteRows(adb, merged, aSeed); }
                catch (e) { console.error("addon seeding failed:", ownerSlug, e && e.message); }
                // AND THE SKIPS REACH THE CUSTOMER NOW, not only the record.
                // Read off the engine's own answer rather than re-derived, so
                // the sentence and the migration entry can never disagree about
                // which tables started empty.
                // EVERY ONE (2026-10-06): this kept the first twelve, so a
                // thirteenth table reached neither the note nor the reply.
                aSeedSkips = (aSeeded && Array.isArray(aSeeded.skipped)) ? aSeeded.skipped.slice() : [];
                aSeedRows = aSeeded && aSeeded.rows && typeof aSeeded.rows === "object" ? aSeeded.rows : null;
                // WHICH TABLES THIS CHANGE READS AND NOTHING CAN FILL. Asked of
                // `merged` — the spec the apply really ran — so a table the
                // cleaner refused is not reported, and asked AFTER the seed so a
                // table this change seeded is not reported either.
                //
                // THE READERS ARE THE SPEC'S OWN BODIES AND NOTHING ELSE HERE.
                // The page sources would be a second source of readers and they
                // do not exist yet: this closure runs at the apply, which is
                // BEFORE the merge that produces them. Passing `aMerge` from
                // here would be reading a variable that is empty at this point —
                // the "a hop nobody listed" shape — so the narrower question is
                // asked honestly instead. A function or job body reading the
                // table is the run-47 shape exactly, which is the one this has
                // to catch.
                // FROM WHAT THE ENGINE REALLY PUT IN (2026-10-07): the design's
                // own seed counted a table as filled whose every starter row
                // was refused, and nobody was told it starts empty.
                try { aNoFill = missingPopulation({ spec: merged, seed: aSeeded ? aSeeded.seeded : {}, readers: readTables({ spec: merged }) }); }
                catch (e) { aNoFill = []; }
                aMark("schema", "ok", { tables: aTables.length, functions: aFunctions.length });
                // WHAT THE DATABASE NOW HOLDS, AS A MILESTONE: the created
                // tables, the changed ones, the functions and the timers — and,
                // at the publish's seam (a version in hand), the publish still
                // under way; nothing is said to come next (2026-10-07).
                if (aJob && aJob.progress) aJob.progress.mark("schema", addonSchemaFacts({ tables: aTables, altered: aAltered, functions: aFunctions }, { publishing: version != null, held: aWriter.holding, heldJobs: aWriter.on, draft: aWriter.on }));
                // THE ENGINE'S OWN REPORT ON THE RECORD, still `pending`: what
                // stands in the database is known now; whether the page comes
                // is not, and the mark after the publish says which.
                aMigration = await recordSiteMigration(env, ownerSlug, withApplied(aMigration, aMade, { seeded: aSeeded }));
                return { ok: true };
              };
            }

            // ── THE BILL, AND WHEN IT IS TAKEN ────────────────────────────
            //
            // VARIADIC, NOT SEPARATE CALLS ADDED. `pageCredits` takes several
            // usages precisely so they land on one bill with ONE rounding and
            // ONE 1-credit floor — its own comment says adding
            // separately-rounded results "would charge twice for the
            // rounding". Measured against the real module: a typical
            // design + pages pair billed 20 summed against 19 priced
            // together, and two tiny calls billed 2 against 1. The picker's
            // call, one per kind, the page call and the seed net, spread onto
            // the same one bill.
            //
            // WHEN differs by path, and it has to. Synchronously the bill is
            // collected AFTER the work lands, on measured usage, so a compile
            // that fails costs nothing — the rule this route has always had.
            // Under a job it is RESERVED BEFORE the publish, because the gate
            // the spine asks (`edit_may_publish`) grants only a job that is
            // `reserved` or `exempt`: a job that reserved nothing would be
            // exempted as a free rung and ship for nothing. The consumer
            // refunds the reserve if the publish does not land, which is the
            // same outcome by the other road. ONE FUNCTION for both roads
            // (2026-09-03), because two answers now take money — the page
            // path below and the pageless one right here — and the reserve
            // is counted only on `ok`, the edit route's rule: a reserve that
            // did not land leaves the row at `none` and the gate reads it so,
            // and a ledger that will not answer must not fail the addition.
            // `seq` IS THE LEDGER'S SEQUENCE: the one bill is #1, and the
            // repair round's spend — known only after the first compile, so it
            // cannot ride #1 — is #2, the edit route's own shape of one
            // reserve per rung. The RPC is idempotent per sequence, so a
            // repeat of either lands once.
            // `aCharge` ITSELF IS DECLARED ABOVE THE BACKEND BLOCK (2026-09-05,
            // stage 1a-ii), where sequence #1 is placed ahead of the schema
            // apply — a `const` is in its dead zone until its line runs, and
            // the first draft of #1 called it from here, seventy lines early,
            // which `node --check` cannot see and no driven test reaches.

            // ── A CHANGE THAT TOUCHES NO PAGE ANSWERS HERE (2026-09-03) ──
            //
            // A scheduled job, or an internal function only the platform
            // calls, changes the database and not one page: there is nothing
            // for the page call to write and nothing for the container to
            // compile, so the route bills the small calls and answers, the
            // site's pages exactly as they were. The decision is `pageless`
            // in site-add.mjs, where it is driven; the shape of the answer is
            // the page path's, with nothing added, changed or moved, so one
            // reader (`addonAnswer`) reads both.
            if (pageless(aAnswers)) {
              { const pf = await aProvCheck(); if (pf) return pf; }
              // THE APPLY, DIRECTLY (stage 8): nothing to compile, so nothing
              // to wait for — the schema is applied here, under its record,
              // and the record is `applied` the moment it lands: there is no
              // page for it to wait on. Under a job the reserve (#1) is
              // already placed and a refusal already answered, above.
              if (aApplyBackend) {
                const ap = await aApplyBackend(null);
                // AN APPLY THAT STOPPED PART-WAY (2026-10-06): what went in
                // before the error is not known, and the answer says so.
                if (!ap.ok) return aFail({ ok: false, error: "schema", cost: 0, ours: true, msg: ADDON_SCHEMA_FAIL_MSG, detail: ap.detail, migration: migrationSummary(aMigration) }, 502, { database: "unknown" });
                aMigration = (await settleSiteMigration(env, ownerSlug, aMigJob, "applied", { publish: { ok: true, pageless: true } })) || aMigration;
                // A PAGELESS ADDITION'S HELD CHANGES are its own revision of the draft.
                if (aWriter.hold && !aWriter.hold.empty) {
                  const sealed = await sealHeld(env, ownerSlug, aWriter, { job: aJob ? String(aJob.id) : null });
                  if (!sealed.ok) return aFail({ ok: false, error: "draft", cost: 0, ours: true, msg: "I couldn't save that change to your draft just now, so nothing changed — try again in a moment." }, 503, { database: "unchanged" });
                  aPagelessRevision = sealed.revision;
                }
                // THE STORED COVERAGE, RE-WRITTEN OVER THE APPLIED RESULT
                // (owner, 2026-09-14). The write above the loop was decided
                // against an empty `made`; this one is decided against what
                // Postgres really has.
                await aSaveAnswer();
              }
              // Reserved ahead of the schema apply under a job (1a-ii); the
              // synchronous collect happens here, after the work, as before.
              const aCostNow = aFirstPlaced ? aFirst : await aCharge(pageCredits(...aDesignUsage, aSeedUsage));
              return Response.json({
                ok: true,
                kinds: aAnswers.map((a) => a.kind), skipped: aSkippedSaid,
                frameHop: aFrameHop || undefined,
                notAdded: aNotAdded.length ? aNotAdded : undefined,
                // EACH KIND SET ASIDE AND CARRIED ON IN ITS OWN WORDS (on `deferred`).
                setAside: aCarried.length ? aCarried.slice() : undefined,
                // A KIND WHOSE DESIGNER DECLINED, BESIDE THE ONES THAT DESIGNED
                // (2026-10-03, the mixed-work audit's MW6): read only when every
                // kind declined before, so a declined part vanished.
                declined: aDeclined.length ? aDeclined.slice() : undefined,
                // THE EXTRAS A DESIGNER OFFERED, never among the requirements (2026-10-05).
                suggestions: aSuggested.length ? aSuggested.slice() : undefined,
                // AN `ok: true` THAT STILL OWES SOMETHING SAYS SO. A job or an
                // internal function changes no page, so this reply is the whole
                // of what the customer hears — and a requirement handed to the
                // `page` step is outstanding here by construction, since no
                // page step ran. `ran` is the kinds that really produced work.
                ...aCoverage(),
                added: [], changed: [], removed: [], moved: [],
                functions: aFunctions,
                functionErrors: aFnErrors.length ? aFnErrors : undefined,
                // WHAT THE DATABASE REFUSED OF THE TABLES (2026-10-07), by
                // table, rule and column; its reason stays on the record.
                refusedRules: aRefused.length ? aRefused.map((r) => ({ table: r.table, feature: r.feature, rule: r.rule })) : undefined,
                provisioned: aProvisioned || undefined,
                migration: migrationSummary(aMigration),
                cost: aCostNow,
                draft: aPagelessRevision ? heldDraft(aPagelessRevision) : undefined,
              });
            }

            // ── THE DESIGNED LOOK IS KEPT — this is the step that ADDS ──────
            //
            // The designer answers on the frontend tool anchored on the stored
            // look, so "add a QR code" comes back as a `qr` the site did not
            // have, and until 2026-09-02 that answer was DROPPED: only `tables`
            // and the pages were read off it. Now it is merged the way the look
            // lane merges (absent means unchanged), shown to the page call as
            // the bindings it may use, and STORED just before the publish so the
            // container bakes the mark; a failed publish puts the old look back.
            // `css` follows the look lane's rule too: replaced when usable,
            // never merged, never stripped by an empty answer.
            const aMerged = mergeLook(aLook, aDesigned, {}, { instructed: true });
            const aCssAsk = readCss(aDesigned && aDesigned.css, { themed: !!resolveTheme(aMerged.theme || aLook.theme) });
            const aNextCss = aCssAsk.usable ? aCssAsk.css : aCss;
            // WHAT GETS STORED, AND WHAT THE REPLY CALLS MOVED — ASKED ONCE
            // AND READ TWICE (2026-09-17). Below the publish, `deadQrs` can
            // take a QR code back OFF `aMerged`: one this change added that
            // opens a page the writer then failed to write. Both answers have
            // to follow it — a patch storing a code that is not wanted, or a
            // reply still saying `moved: ["qr"]` about one that is not there,
            // is a second copy of this decision disagreeing with the first.
            // So the expression has one home and is re-asked rather than
            // written out again.
            let aLookMoved = [], aLookPatch = null;
            const aReadLook = () => {
              aLookMoved = movedFields(aLook, aMerged);
              aLookPatch = (aLookMoved.length || aNextCss !== aCss)
                ? (aNextCss !== aCss ? { look: aMerged, css: aNextCss } : { look: aMerged })
                : null;
            };
            aReadLook();

            // ONE PAGE CALL, in addon mode. `priorPages` is the whole site so
            // the model can edit a nav entry; `mode` is what makes it return
            // only what it touched.
            // MAY THE PAGE CALL BEGIN? (async path) Cancel and budget, re-asked
            // at the boundary the edit route asks at — a job told no here has
            // spent only the small calls, refunds through the database and
            // answers the customer honestly, with the site untouched.
            const aGateGen = aJob ? aJob.gate("editing") : null;
            if (aGateGen && !aGateGen.go) { const pf = await aProvCheck(); if (pf) return pf; }
            if (aGateGen && !aGateGen.go) return await editStopped(env, { job: aJob, why: aGateGen.why, phase: "editing", trace: editTrace, ctx, extra: aStopEvidence() });
            let aGen = null;
            // TIMED, because the repair round below reads it: what the page
            // call took on this model, per page it wrote, is the measure of
            // what a fix of one of those pages will take (run 36, 2026-09-04).
            let aPagesMs = 0, aPagesWrote = 0;
            // WHAT THE PAGE WRITER IS SHOWN, DECIDED ONCE, ABOVE THE CALL AND
            // ABOVE THE WALL THAT READS IT (2026-09-17).
            //
            // `aSentParts` is `partsSent`'s answer over the site's own stored
            // components: which sources fit in this request, which were too
            // large, and every name the site has a file for. `briefWithLayout`
            // is handed the SAME array and calls the same pure function, so
            // the block the writer reads and the wall below cannot disagree
            // about what it was shown — and the wall is the reason this is a
            // `const` here rather than a value computed inside the call.
            //
            // AND AN UNREADABLE STORE IS NOT AN EMPTY ONE. `unreadable` is the
            // third state `readSiteParts` answers, and it has to reach both
            // readers as itself: to the prompt it is a paragraph saying the
            // components exist and were not loaded, and to the wall below it
            // is a refusal of every returned component — because the names we
            // could not read are exactly the names we cannot check against.
            // THE PAGE WRITER'S SCOPE IS THE PLAN'S UNLESS A DESIGNER NAMED A
            // PAGE OUTSIDE IT (2026-10-11): then it is shown the whole site, as
            // before, and a prepared answer resting on that request is one the
            // job's exact-request check decides on. The destinations are the
            // cleaned designers' own, read the way `aAskedPages` reads them.
            const aDest = [];
            for (const ans of aAnswers) {
              for (const v of (Array.isArray(ans.value) ? ans.value : [ans.value])) {
                if (v && typeof v === "object" && typeof v.page === "string") aDest.push(pageId(v.page));
                if (v && typeof v === "object" && typeof v.path === "string") aDest.push(pageId(v.path));
              }
            }
            // `let`, AND SET IN ONE PLACE (`aWriterFor`): a scoped writer whose
            // answer reaches past its scope is asked again with the whole site
            // (below), and everything it is shown moves with it.
            let aWriterScoped = false, aWriterSrc = aSrc, aWriterParts = aStoredParts, aHiddenParts = [], aSentParts = null, aPlanComponents = [];
            const aWriterFor = (scoped) => {
              aWriterScoped = scoped;
              aWriterSrc = scoped ? aView : aSrc;
              aWriterParts = scoped ? aViewParts : aStoredParts;
              // THE STORED COMPONENTS A SCOPED WRITER WAS NOT SHOWN, by name: they
              // are protected as a withheld one is, without being listed.
              aHiddenParts = scoped && aStoredParts ? aStoredParts.filter((p) => p && !aViewParts.includes(p)).map((p) => String(p.name || "").toLowerCase()) : [];
              aSentParts = partsSent(aWriterParts, { unreadable: !aPartsRead.ok });
              aPlanComponents = [...aFold.components];
              for (const b of Object.values(pageComponents(aWriterSrc))) {
                for (const c of (b && Array.isArray(b.modules) ? b.modules : [])) if (!aPlanComponents.includes(c)) aPlanComponents.push(c);
              }
            };
            aWriterFor(!!aScope && aDest.every((r) => r && aScope.includes(r)));
            if (aScope && !aWriterScoped) aMark("scope", "widened", { outside: aDest.filter((r) => !r || !aScope.includes(r)).length });
            // THE KIT SIGNATURES THIS REQUEST NEEDS: what the addition
            // declares, plus what the pages being edited already import.
            // `modules`, NEVER `kit` — the first is `seat-map` and the second
            // is `SeatMap`, and `siteComponentApi`'s catalog is keyed on the
            // first. Measured: handing it the export names answers "" for
            // every one, which from outside reads as the site importing
            // nothing at all.
            // ── THE PHOTOGRAPHS THIS CHANGE WILL BUY (2026-09-17) ───────────
            //
            // `aFold.photos` is the `photo` designer's own `{page, describe}`
            // list — `imageDirective`'s list shape by construction, not a
            // second one beside it — and this is where it meets the money.
            //
            // THE BALANCE CUTS THE LIST BEFORE THE PAGE WRITER SEES IT, which
            // is the build path's own rule in as many words: *"printing all of
            // them would invite a page writer to spend money the account has
            // not got."* `imagesAffordable` is the same reader `buySitePhotos`
            // asks later, so the writer is never shown a token the spend path
            // will refuse — and a customer who can afford one of two gets one
            // real photograph and one placeholder rather than two placeholders.
            //
            // READ ONCE, HERE, because the page call is the last thing between
            // this point and the purchase: a balance read after generation is a
            // balance read ten minutes later, and this is the number the writer
            // was told about. `buySitePhotos` re-asks it at the moment of spend
            // against the clock and the library, which is the real gate; this
            // one only decides what to ASK for.
            // THE PURCHASE SWITCH CUTS IT TOO (A04-6, 2026-10-22): with
            // IMAGE_PURCHASES off every purchase is refused (`makeSitePhoto`),
            // so no shot is offered and a photograph-only addition with none
            // of the site's own is refused here, before the page call.
            const aBuyOn = imagePurchasesOn(env);
            let aBalance = 0;
            if (aFold.photos.length && aBuyOn) {
              aBalance = await (aJob ? readCreditsFor(env, aJob.uid) : readCredits(aAuth)).catch(() => 0);
            }
            const aShots = aBuyOn ? aFold.photos.slice(0, imagesAffordable(aFold.photos.length, { balance: aBalance, usd: SITE_PHOTO_USD })) : [];
            // ── A PHOTOGRAPH, ALONE, WITH NOTHING REAL TO SHOW (2026-10-02) ──
            //
            // When the photograph is the whole message and it is neither one
            // of the site's own (`aFold.reuse`) nor one the balance can buy,
            // the page call could only write an empty frame — a placeholder
            // published under a reply saying a photograph was added. Refused
            // BEFORE that call, at no cost. Beside a page or a component the
            // frame is part of a real change and is said as a placeholder, as
            // it always was; the buy below asks the same question once more,
            // for a purchase that fails after the page was written.
            const aPhotoOnly = aKinds.length === 1 && aKinds[0] === "photo";
            const aNoPhoto = () => aFail({
              ok: false, error: "no-photo", cost: 0,
              msg: noPhotoMsg({ purchasesOff: !aBuyOn }) + (aRowAside && !aRowCarried ? " " + addRefusal("row-alone", "row") : ""),
            }, 422);
            if (aPhotoOnly && !aFold.reuse.length && !aShots.length) {
              aMark("photos", "skip", { planned: aFold.photos.length, offered: 0, reuse: 0 });
              return aNoPhoto();
            }
            // ── WHICH PAGES TO SHOW FIRST ON A SITE TOO LARGE TO SHOW WHOLE ──
            //
            // `priorPagesSent` fits what it can and NAMES the rest; `keep` is
            // the order it tries. The pages this change is about come first —
            // every add kind carries the route it lands on, and the page a
            // section was designed for is exactly the one worth the budget —
            // then the HOME page, which is the nav anchor almost every addon
            // touches ("usually that is ONE new page, plus the page a visitor
            // would look on to find it"). Everything else keeps stored order.
            //
            // ⚠ BY ROUTE, and this line used to say "by file path, because that
            // is what `priorPages` really carries" and build each entry as
            // `"src/routes/" + fileOfRoute(r)`. MEASURED through the validator:
            // `cleanPath` strips that prefix, so every persisted path is BARE
            // and no entry could ever match — `keep` did nothing at all and the
            // selection was stored order on every real site. A route is the
            // identity the stored source, the selection, the generation and the
            // merge all really share; `priorPagesSent` resolves it through
            // `routeOf`, which tolerates either spelling.
            //
            // ⚠ AND `pageId` HERE IS A SECOND APPLICATION WHOSE EFFECT THE
            // MODULE ABSORBS — measured, and declared rather than left for the
            // next sweep to read as a gap. `priorPagesSent` maps `pageId` over
            // the keep list itself, so the spelling this line produces cannot
            // change which pages are selected: driven over four spellings
            // against three ~40k pages, the prefixed file, the bare file, a
            // mixed-case route and an exact route all select the same two. It
            // is kept because it says what this list HOLDS — page identities,
            // not raw model strings — which is what makes `includes` a real
            // de-duplication rather than a string comparison, and `aKeepPages`
            // has no other consumer that could tell the two apart (it reaches
            // `priorPagesSent` twice, once here and once through
            // `priorPagesBlock`, and nothing else). THE WALL IS THE MODULE'S
            // MAP, and it is guarded there — `test/page-gen.test.mjs`, "any
            // spelling". Do not read a surviving mutant of this line as a gap;
            // read the module's.
            //
            // ⚠ TWO LISTS OUT OF ONE WALK, AND THE DIFFERENCE IS THE `/`.
            // `aAskedPages` is the destinations the CLEANED designers really
            // named; `aKeepPages` is that plus the home page, which is a BUDGET
            // decision (the nav anchor almost every addon touches) and not a
            // claim that anybody asked for it. `mergeAddonPages` takes the first
            // as its permission list, so handing it the second would exempt `/`
            // from the preservation rule on EVERY addon — "remove protection
            // from unrelated pages", which is the thing the fix must not do.
            // One walk, two lists derived from it, so they cannot drift.
            const aAskedPages = [];
            const aKeepPages = [];
            const aWantPage = (r, keepOnly) => {
              const f = pageId(r);
              if (!f) return;
              if (!keepOnly && !aAskedPages.includes(f)) aAskedPages.push(f);
              if (!aKeepPages.includes(f)) aKeepPages.push(f);
            };
            for (const ans of aAnswers) {
              for (const v of (Array.isArray(ans.value) ? ans.value : [ans.value])) {
                if (v && typeof v === "object" && typeof v.page === "string") aWantPage(v.page);
                // ⚠ `v.path` IS MEASURED INERT ON BOTH LISTS TODAY AND IS KEPT,
                // because what makes it inert is a NEIGHBOUR'S rule rather than
                // this expression: only the `page` kind carries `path`, and
                // `cleanAdd` answers `page-exists` for a path the site already
                // has (measured; guarded four ways in `test/site-add.test.mjs`).
                // So a cleaned `path` always names a page the site has NOT got —
                // which can never be in `changed` (the revert loop's input) and
                // never in `aSrc` (the window's). The day a kind extends an
                // existing page, this line is what carries its destination, and
                // a sweep survivor here is this note rather than a gap.
                if (v && typeof v === "object" && typeof v.path === "string") aWantPage(v.path);
              }
            }
            aWantPage("/", true);
            // AND WHAT THE WINDOW COULD NOT CARRY IS RECORDED. `ok: true` with
            // nothing in `problems` and nothing in `coverNote` is exactly what
            // a 17-page site answered before this, so the one fact that would
            // have explained a poor result was nowhere. Asked ONCE, from the
            // same pure function the prompt is built from, so the mark and the
            // block cannot disagree about which pages the model saw.
            //
            // THE TRACE AND THE DEVELOPER RECORD, NOT THE CUSTOMER. "Eleven of
            // your pages were not shown" is not something they can act on, and
            // on a change that worked it is alarming about nothing; what they
            // CAN act on — a page that did not survive, a component that was
            // not replaced — already has its own sentence.
            // THE FILE PICKER (2026-10-23, idea #21): on a big site, and only
            // for the whole-site writer (a scoped writer is narrowed already),
            // one quick call picks the pages and components the writer is
            // shown; the pages this addition touches and what they import
            // always are. A file not picked is withheld — named, never
            // returnable — and a failed pick sends everything. Billed on this
            // addition's page bill.
            // THE REQUIRED PAGES BY THEIR STORED PATHS (2026-10-24): `aKeepPages`
            // holds route ids ("/about") and `requiredFiles` matches a page's
            // path ("about.tsx"), so handed the ids it kept none of them and the
            // pages this addition touches could be withheld.
            const aPickTargets = () => (aWriterSrc || []).filter((p) => p && typeof p.path === "string" && aKeepPages.includes(pageId(p.path))).map((p) => p.path);
            let aPick =!aWriterScoped && aPartsRead.ok ? await pickFiles({ send: aQuick("add:file-pick") },
              { request: aInstruction, pages: aWriterSrc, parts: aWriterParts, targets: aPickTargets(), model: aModels.quick }) : null;
            if (aPick) aMark("file_pick", aPick.mark.status, aPick.mark);
            const aPickOnly = () => (!aWriterScoped && aPick && aPick.only ? aPick.only : null);
            if (aPickOnly()) aSentParts = partsSent(aWriterParts, { unreadable: !aPartsRead.ok, only: aPickOnly().parts });
            let aPagesSent = priorPagesSent(aWriterSrc || [], { keep: aKeepPages, only: aPickOnly() ? aPickOnly().pages : null });
            if (aPagesSent.withheld.length) {
              // EVERY ONE (2026-10-07): twelve were kept for the record.
              aUnseenPages = aPagesSent.withheld.slice();
              aMark("pages", "window", { shown: aPagesSent.shown.length, withheld: aPagesSent.withheld.length, chars: aPagesSent.chars });
            }
            // ── THE PHOTOGRAPHS ARE BOUGHT WHILE THE PAGES ARE WRITTEN (2026-10-11) ──
            //
            // Each one needs only its own description (`aShots`, the photo
            // designer's), never the pages — the page writer is handed exactly
            // those words as its tokens. So they are bought beside the writer
            // (`startBuildPhotos`, the build path's own task), each through the
            // logical purchase the step below buys through, and that step joins
            // them: a photograph is attached only once its page exists and it
            // does. A preparation buys nothing (it has no purchase owner); an
            // addition with no durable record to buy through buys as before.
            const aBuyAs = aJob && aJob.purchase ? { ...aJob.purchase.part, owner: "job:" + aJob.id }
              : aJob && aJob.prepare !== true && typeof aJob.id === "string" && aJob.id ? { slug: ownerSlug, key: "job-" + aJob.id, n: 0, owner: "job:" + aJob.id }
              : !aJob && isRequestKey(ab && ab.idem) ? { slug: ownerSlug, key: "post-" + ab.idem, n: 0, owner: "post:" + ab.idem }
              : null;
            // ── WHOSE PURCHASE AN EARLY PHOTOGRAPH IS, AND WHETHER IT MAY BEGIN ──
            //
            // (2026-10-11, Codex on d7a00395.) A job's (`aBuyAs`), or — when
            // it runs beside another part's job (`beside`) — a preparation's
            // for the same request part (`aJob.rec.part`), which notes each
            // purchase on its attempt before making it: the image is made
            // while the other part's pages are written, and the part's own job
            // finds it bought. Begun only when every one of them
            // passes the image step's own gates first: the balance (`aShots`
            // is already cut by it), the job's clock, and room in the library,
            // counting only files that are not these same purchases.
            const aEarlyPart = aBuyAs ? { slug: aBuyAs.slug, key: aBuyAs.key, n: aBuyAs.n }
              : aPrep && aJob.beside === true && aJob.rec && aJob.rec.part && typeof aJob.rec.part.key === "string" ? aJob.rec.part : null;
            let aOwnIds = null;
            let aRoom = null;
            if (aShots.length && aEarlyPart) {
              const seenD = new Map();
              aOwnIds = new Set(await Promise.all(aShots.map((sh) => {
                const d = shotKey(sh.describe);
                const k = seenD.get(d) || 0;
                seenD.set(d, k + 1);
                return purchaseId(aEarlyPart.slug, aEarlyPart.key, aEarlyPart.n, d, k);
              })));
              try {
                const objs = await siteUploadList(env, ownerSlug);
                aRoom = Math.max(0, MAX_FILES_PER_SITE - stillUploads(objs).filter((o) => !aOwnIds.has(o.purchase)).length);
              } catch { aRoom = null; }
            }
            const aEarlyOk = !!aEarlyPart && aShots.length > 0 && aRoom !== null && aRoom >= aShots.length && photoWait(aJob && aJob.budget).buy;
            let aPhotoTask = null;
            if (aEarlyOk) {
              const aPrepBuy = aPrep ? jobImage(aJob, async (dd, meta) => (await makeSitePhoto(env, ownerSlug, dd, meta)).url) : null;
              aPhotoTask = startBuildPhotos(env, {
                slug: aEarlyPart.slug, brief: aShots, balance: aBalance, key: aEarlyPart.key, owner: aBuyAs ? aBuyAs.owner : aJob.owner, part: aEarlyPart.n, reserve: 0, room: aRoom,
                buyer: aPrepBuy ? async (d) => { const url = await aPrepBuy(d); return url ? { url } : { url: null }; } : null,
              });
              aEarlyPhotos.task = aPhotoTask;
              aMark("photos", "alongside", { started: aPhotoTask.started });
              // NOT HELD BY THE JOB'S END: one still in flight when the job ends
              // is what the image step's own wait already makes of a late call
              // — its claim is on its record, never bought again on a guess.
            }
            // ── A SCOPED WRITER'S OUTPUT BOUNDARY (2026-10-11, Codex on d7a00395) ─
            //
            // Its request holds only its scope, so a page it was not shown, a
            // page it would take away, or a stored component it was never shown
            // is not something it may write: matching a prepared request says
            // nothing about what the answer WRITES. Such an answer is never
            // applied. The writer is asked again with the whole site as it is
            // now (a request no preparation made, so a job asks a model), and
            // only that answer goes on to the merge and its existing walls.
            const aBreach = (input) => {
              const out = [];
              if (!aWriterScoped || !input || typeof input !== "object") return out;
              const was = new Map(aSrc.map((p) => [pageId(p && p.path), String((p && p.source) || "")]));
              for (const p of Array.isArray(input.pages) ? input.pages : []) {
                const id = p && typeof p.path === "string" ? pageId(p.path) : null;
                if (id && was.has(id) && !aScope.includes(id) && was.get(id) !== String((p && p.source) || "")) out.push("page:" + id);
              }
              for (const r of Array.isArray(input.remove) ? input.remove : []) {
                const id = typeof r === "string" ? pageId(r) : null;
                if (id && was.has(id) && !aScope.includes(id)) out.push("remove:" + id);
              }
              for (const p of Array.isArray(input.parts) ? input.parts : []) {
                const n = String((p && p.name) || "").toLowerCase();
                if (n && aHiddenParts.includes(n)) out.push("part:" + n);
              }
              return out;
            };
            // ── THE WRITER ASKED ONCE MORE WITH THE REASON (round 2 of the retry
            //    rule, owner 2026-10-24) ─────────────────────────────────────
            //
            // Two endings below refuse the WHOLE addition on the writer's own
            // answer: `rewrote` (a page it changed lost words it said before) and
            // `not-landed` (an addition of nothing but lines and photographs, one
            // of which never arrived). Both are checked here first, on the answer
            // as the merge would take it (`aWriterCheck`), and a failing answer
            // is asked once more: each batch's SAME request (same model, same
            // effort) with its own answer and the reason naming what was lost or
            // what did not land (`aRecs[i].again`). Then everything below runs on
            // the retry's answer as it would on the first — the database made
            // beside the first call, the tables and their charges are NOT made
            // again (provisioning settles once, below this loop). A second miss
            // is the existing refusal; both calls are on the page bill only when
            // the retry passed.
            const aRecs = [];
            let aWriterRetry = null, aWriterFirstUsage = null, aWriterRetried = false;
            const aCallFor = (i) => {
              const inner = clarifyCall(jobCall(aJob, mappedCall(env, ownerSlug, "site", pagesCall(env))), { shown: () => aCtxShown, all: () => aCtxAll || [], part: aPartShown, replayHas: aReplayHas, onDefault: (d) => { aDefaulted.push(...d); } });
              if (aWriterRetry && aRecs[i] && aRecs[i].last) return aRecs[i].again(aWriterRetry.text, inner);
              aRecs[i] = recordCall(inner);
              return aRecs[i].call;
            };
            const aWriterCheck = async (gen) => {
              if (!gen || !gen.input || gen.ask) return null;
              const v = validatePages(gen.input, { partial: true, knownRoutes: (aSrc || []).map((p) => routeOf(p && p.path)).filter(Boolean) });
              const unseen = new Set(aPagesSent.withheld.map(pageId).filter(Boolean));
              const pages = (v.pages || []).filter((p) => p && !unseen.has(pageId(p.path)));
              const aRemove = Array.isArray(gen.input.remove) ? gen.input.remove : [];
              const m = mergeAddonPages(aSrc, pages, aRemove, aAskedPages);
              // NOTHING USABLE CAME BACK (and no note of its own saying why): the whole
              // addition would end `nothing-returned`/`no-change` — asked again too.
              if (m && !m.ok && (m.reason === "no-change" || (m.reason === "nothing-returned" && !(typeof gen.input.notes === "string" && gen.input.notes.trim())))) {
                return { code: m.reason, text: "Nothing was added: your answer returned no page change for this addition. Answer again with every page the addition changes or adds, each whole, with the addition in it." };
              }
              if (!m || !m.ok) return null;
              const was = new Map((aSrc || []).filter((p) => p && typeof p.path === "string").map((p) => [p.path, String(p.source || "")]));
              const lost = [];
              for (const p of m.pages || []) {
                if (!p || !m.changed.includes(p.path) || !was.has(p.path)) continue;
                const kept = keptProse(was.get(p.path), p.source);
                if (!kept.ok) lost.push({ path: p.path, lost: kept.lost.slice(0, 3) });
              }
              if (lost.length) {
                return { code: "rewrote", text: "Nothing was added: your answer changed words the site already says, and an addition may only add. " +
                  lost.map((l) => l.path + " lost: " + l.lost.map((x) => "\u201c" + String(x).slice(0, 120) + "\u201d").join(", ")).join("; ").slice(0, 900) +
                  ". Answer again with every existing sentence, heading and label kept character for character, and the addition placed beside them." };
              }
              if (!aAnswers.every((a) => a && (a.kind === "words" || a.kind === "photo"))) return null;
              const kit = aFold.words.length ? await loadSiteKit(env, ownerSlug) : [];
              const partFiles = (list) => (Array.isArray(list) ? list : []).filter((x) => x && typeof x.name === "string" && typeof x.source === "string").map((x) => ({ path: partPath(x.name), source: x.source }));
              const after = new Map(partFiles(aStoredParts).map((f) => [f.path, f]));
              for (const f of partFiles(v.parts)) after.set(f.path, f);
              const w = wordsLanded(aSrc, m.pages, aFold.words, { filesBefore: [...partFiles(aStoredParts), ...kit], files: [...after.values(), ...kit] });
              const ph = photosLanded(aSrc, m.pages, aFold.reuse, ownerSlug);
              if (w.ok && ph.ok) return null;
              const said = [
                ...w.missing.map((x) => "the line \u201c" + String((x && x.words) || "").slice(0, 160) + "\u201d on " + ((x && x.page) || "its page")),
                ...ph.missing.map((x) => "the photograph " + String((x && x.src) || "").slice(0, 160) + " on " + ((x && x.page) || "its page")),
              ];
              return { code: "not-landed", text: "Nothing was added: " + said.join("; ").slice(0, 900) + " " + (said.length === 1 ? "is" : "are") + " not on the page you sent back. Answer again with " + (said.length === 1 ? "it" : "each of them") + " placed, word for word, on the page named." };
            };
            for (let aPass = 0; ; aPass++) {
            const aPagesT0 = Date.now();
            aMark("pages", "start", { kinds: aAnswers.map((a) => a.kind) });
            try {
              // `images: 0` IS AN INSTRUCTION AND ITS ABSENCE IS NOT. Neither
              // this lane nor the edit lane buys photographs — the rule a revise
              // already follows — and `site-images.mjs`'s own comment names
              // exactly what happens without a stated zero: "a model with no
              // instruction writes image tokens anyway". An unbought token
              // publishes as the literal text `@@IMG:a barber chair@@`: a broken
              // image AND a visible leak of how the site was made.
              // AND THE BINDINGS THE SITE HAS, the ones this addon just made
              // included — the page that places a code must know `SITE_QR`
              // exists, exactly as the build and the page rung are told.
              // THE DESIGNED ADDITION RIDES THE BRIEF, the way the build's
              // plan rides its brief: the directive says what is new, where
              // it goes and what it is built from, and the union of kit parts
              // goes through `plan.components` so the page call is shown their
              // exact props — the one thing the old designer's answer never
              // reached this call as.
              // AND THE SIGNATURES OF WHAT THE SITE'S PAGES ALREADY IMPORT
              // (2026-09-17). `plan.components` was the union of what THIS
              // change declares, so a writer editing a page built from
              // `<Accordion>` got `Accordion`'s props only if the addition
              // happened to name it too. It is editing that page — every kit
              // component on it is a component it may have to call correctly.
              // A UNION, in the addition's order first: `siteComponentApi`
              // drops what is already in the cached core, so the only cost is
              // the signatures of what this site really uses.
              // PREPARED DESIGN ONLY (round 11): an earlier part still changes a
              // page this writer copies its design from, so the writer is the
              // job's, against the pages as they then are. The picker's and
              // designers' answers are recorded; nothing is written.
              if (aPrep && aJob.designOnly === true) return aPrepStop();
              // THE WRITER SHOWN ONLY THE PART'S PAGES (not widened) is a scoped call too.
              if (aWriterScoped) noteSeen(aJob, "scope");
              // THE OWNER'S VIDEO AND AUDIO (2026-10-14), by address.
              const aMedia = (await withinMs(siteMediaFiles(env, ownerSlug), CONVERSE_READ_MS, "addon media:", ownerSlug)) || [];
              // MANY PAGES ARE WRITTEN IN PARALLEL BATCHES (owner, 2026-10-24:
              // "No addon limits"): the page writer runs once, or once
              // per `aFold.batchDirectives` entry at the same time, and
              // `mergePageBatches` makes the one answer read below.
              const aBatchDirs = Array.isArray(aFold.batchDirectives) && aFold.batchDirectives.length > 1 ? aFold.batchDirectives : [aFold.directive];
              const aBatchGot = await Promise.all(aBatchDirs.map(async (aDirective, aBi) => { let aGen = null;
              aGen = await generateSitePages(env, briefWithLayout({
                brief: aInstruction + (aDirective ? "\n\n" + aDirective : "") + (aDeviceNote ? "\n\n" + aDeviceNote : ""),
                media: aMedia,
                plan: aPlanComponents.length ? { components: aPlanComponents } : null,
                // ── THE BUDGET IS STILL ZERO; THE SENTENCE IS NO LONGER A
                // CLAIM ABOUT THE SITE (2026-09-17) ──────────────────────────
                //
                // This was a bare `0`, and `imageDirective` says a bare zero as
                // *"PHOTOGRAPHS: none on this site"* — false on every site that
                // has any, measured through this route on one showing two. The
                // budget is unchanged and must be: this step may never re-buy a
                // set the owner already has (`budgetFor`'s rule). What moves is
                // that the zero is now stated as OURS, and what the site really
                // shows is READ rather than assumed — three-state, so a source
                // we could not read claims nothing either way.
                //
                // AND `place` IS WHAT MAKES THE HAND-OFF KEEPABLE. A photograph
                // asked for beside another kind is set aside with "ask for it
                // on its own and I'll place it" — and the picture rung fills a
                // slot by rewriting a `src` attribute, so the `<SafeImage>`
                // with NO src the old sentence asked for is invisible to it.
                // `aSkipped` is that exact list, so the directive asks for an
                // empty src precisely when the next rung is the one being
                // promised.
                // ⚠ AND THE INVENTORY IS PAGES *AND* COMPONENTS (2026-09-17).
                // This was `shownPhotos(aSrc, …)` — pages only — and since the
                // band split a section IS a component, so a site whose hero
                // photograph lives in `-parts/` was described to every page
                // writer as having none. MEASURED through this route: 0
                // against 1 on the same site. `photoInventory` is the one
                // reader of "every file a photograph can be in", and it
                // answers `null` when the component store could not be read,
                // so an incomplete inventory claims nothing either way rather
                // than becoming "every picture on it is a placeholder".
                // ⚠ AND THE LIST FORM WHEN THIS CHANGE IS BUYING (2026-09-17).
                // `aShots` is `{page, describe}` — `imageDirective`'s own list
                // shape — so the writer is handed the exact `@@IMG:@@` tokens
                // to place, page by page, and `buySitePhotos` finds them in
                // what comes back. The object form below is unchanged and is
                // still every other addon's: a budget of OURS, said as ours,
                // beside what the site already shows.
                // ⚠ AND `place` IS "A PICTURE WAS ASKED FOR AND IS NOT BEING
                // BOUGHT", which is wider than the hand-off it used to be.
                // `aSkipped` is the set-aside list, and with a photograph
                // designed here that list is empty on exactly the asks this
                // clause was written for — so a picture the BALANCE refused, or
                // one its designer could not describe, would have published a
                // page with no slot at all while the customer was told the
                // pictures are placeholders. Found by an existing guard going
                // red, which is that guard being right.
                // ⚠ AND ONE SHAPE NOW, CARRYING THE INVENTORY WHETHER OR NOT
                // THIS CHANGE BUYS (2026-09-17). It used to send the bare list
                // when buying — `imageDirective`'s build-path door, which has
                // no inventory to state — so the paid directive told the writer
                // *"any other picture stays a <SafeImage> with no src"* on a
                // site showing two bought photographs, and the writer stripped
                // them. `{buy, shown, place}` is one object with one composer
                // behind it, so the protection clause reaches both forms and
                // cannot be corrected on one and missed on the other.
                images: {
                  buy: aShots.length ? aShots : null,
                  shown: shownPhotos(photoInventory(aWriterSrc, aWriterParts, aPartsRead.ok), ownerSlug),
                  // `place` IS UNREAD WHEN BUYING, and the two cannot both be
                  // true: a kind that is set aside designs nothing, so
                  // `aFold.photos` — and with it `aShots` — is empty on exactly
                  // the asks that fill this. When a picture IS bought, the
                  // token is the slot.
                  place: aSkipped.includes("photo") || aKinds.includes("photo"),
                },
                // THE SITE'S OWN COMPONENTS, WITH THEIR REAL SOURCE. Until
                // today the writer was shown `tsx` — the DECLARATIONS — under
                // a heading telling it to write them, so a page importing a
                // component this platform wrote months ago was edited by a
                // model that had never seen it, and any part it returned
                // replaced the real file by name. `aSentParts` is computed
                // ONCE and read twice: here, and by the wall below that
                // decides whether a returned part may replace a stored one.
                tsx: aWriterScoped ? aViewTsx(aMerged.tsx, (t) => !(Array.isArray(aLook.tsx) ? aLook.tsx : []).some((o) => o && aNameKey(o.name) === aNameKey(t.name))) : aMerged.tsx,
                parts: aWriterParts, partsUnreadable: !aPartsRead.ok, partsOnly: aPickOnly() ? aPickOnly().parts : undefined,
                gif: aMerged.gif, qr: aMerged.qr, three: aMerged.three,
                // AND THE LOOK IT IS WEARING. The stylesheet is sent as
                // ALREADY APPLIED, never as something to reproduce: it is
                // appended last at build time so it wins on source order, and
                // a model shown one with no such sentence restates its rules
                // inline, where editing the stylesheet can no longer reach
                // them.
                theme: aMerged.theme || aLook.theme, css: aNextCss,
              // THE JOB'S CLOCK RIDES THE PAGE CALL TOO — the one call on this
              // route that does not go through `aQuick`, and the longest.
              }), aSpec, aMerged.brand || aLook.brand || ownerSlug, [], aModels.pages, aWriterSrc, "addon", undefined, aJob && aJob.budget,
              // THE ANSWERS, through the transport every other call here uses.
              aCallFor(aBi), "", aKeepPages,
              // AN OWN-PARTS SITE'S ADDITION writes its own parts too (2026-10-23).
              { ownParts: ownPartsSite(aSrc, aStoredParts), only: aPickOnly() ? aPickOnly().pages : null });
              return aGen; }));
              aGen = mergePageBatches(aBatchGot);
              aPagesMs = Date.now() - aPagesT0;
              aPagesWrote = aGen && aGen.input && Array.isArray(aGen.input.pages) ? aGen.input.pages.length : 0;
              aMark("pages", "ok", { files: aPagesWrote, ms: aPagesMs, ...(aGen && aGen.batches ? { batches: aGen.batches } : {}) });
              // THE PAGES WRITTEN, NOT PUBLISHED, AS A MILESTONE.
            } catch (e) {
              // WHAT THE WIRE DID, NOT JUST THAT IT FAILED (2026-09-14). Run 45
              // recorded `"fetch failed"` and nothing else — undici's message
              // for every transport death there is — so the post-mortem came
              // down to a duration matching a comment. `callFailure` keeps the
              // four facts that tell our own abort from a connection closed for
              // being quiet from one capped by total lifetime, and `ms` is how
              // long the call had been running when it died: the number that
              // makes "always ~270s" falsifiable instead of anecdotal. Machine
              // fields and a bounded driver string; no header, body or URL.
              aMark("pages", "fail", { error: String((e && e.message) || e).slice(0, 200), ms: Date.now() - aPagesT0, ...callFailure(e) });
              console.error("addon generate failed:", ownerSlug, e && e.message, JSON.stringify(callFailure(e)));
              const aKind = upstreamKind(e && e.detail, e && e.status);
              return aFail({
                ok: false, error: "generate", cost: 0,
                msg: aKind.billing
                  ? "The site builder is temporarily unavailable — this is on us, not your change."
                  : "The builder is busy — try again in a moment.",
                upstream: (e && e.status) || null, upstreamType: aKind.type, billing: aKind.billing || undefined,
              }, 503);
            }
            // THE DATABASE MADE BESIDE THE PAGE CALL, SETTLED (2026-10-16):
            // everything after this may read it — the look's store, the apply,
            // the seed — and a provision that failed answers as it always did.
            { const pf = await aProvCheck(); if (pf) return pf; }
            // ── THE PAGE WRITER MAY ASK TOO (2026-10-11, the generality round) ──
            //
            // It was the one writer stage that could not: shown an addition it
            // could not place without a detail they left out, it had to guess
            // or return nothing. It asks now, as every designer does, in the
            // model's own words — before anything of the addition is applied
            // (the schema waits for the compile, the publish for both), so
            // nothing is written, and the first reserve is refunded as on any
            // answer that ships nothing. The question names its asker
            // (`add:pages`), so the answer is shown to the page writer and the
            // calls beside it, never to the picker or the designers: their
            // requests are the ones they made, and the part's next job replays
            // them (`stageKept`) — only the writer is asked again.
            if (aGen && aGen.ask) {
              aMark("pages", "ask");
              aAskOut.request = aInstruction;
              aHold(aReq, "pages");
              await aEnded("asked", aRecord());
              return Response.json({ ok: false, error: "clarify", layer: "addon", kind: "pages", by: "add:pages", cost: 0, unchanged: true, ask: aGen.ask, msg: aGen.ask.text });
            }
            const aOver = aPass === 0 ? aBreach(aGen && aGen.input) : [];
            if (!aOver.length) {
              if (aWriterRetried) {
                const still = await aWriterCheck(aGen);
                aMark("retry_reason", still ? "fail" : "ok", { step: "add:pages", reason: aWriterRetry.code, ok: !still });
                // PAY ONLY FOR WHAT WORKED: both calls only when the retry passed
                // (a refusal below takes nothing off the ledger either way).
                if (!still && aGen) aGen = { ...aGen, usage: addUsages(aWriterFirstUsage, aGen.usage || null) };
                break;
              }
              const why = await aWriterCheck(aGen);
              if (!why) break;
              aWriterRetry = why; aWriterRetried = true; aWriterFirstUsage = (aGen && aGen.usage) || null;
              aMark("retry_reason", "start", { step: "add:pages", reason: why.code });
              aPass--;
              continue;
            }
            aMark("scope", "breach", { reached: aOver.length });
            aWriterFor(false);
            // THE WIDENED WRITER IS PICKED FOR TOO (2026-10-24): it now sees the
            // whole site, so on a big one the picker runs here (once; a scoped
            // first pass never called it), billed on the same page bill.
            if (!aPick && aPartsRead.ok) {
              aPick = await pickFiles({ send: aQuick("add:file-pick") },
                { request: aInstruction, pages: aWriterSrc, parts: aWriterParts, targets: aPickTargets(), model: aModels.quick });
              if (aPick) aMark("file_pick", aPick.mark.status, aPick.mark);
            }
            if (aPickOnly()) aSentParts = partsSent(aWriterParts, { unreadable: !aPartsRead.ok, only: aPickOnly().parts });
            aPagesSent = priorPagesSent(aWriterSrc || [], { keep: aKeepPages, only: aPickOnly() ? aPickOnly().pages : null });
            if (aPagesSent.withheld.length) aUnseenPages = aPagesSent.withheld.slice();
            }

            // `knownRoutes` for the same reason as the page-edit lane: without
            // the stored site's routes, every unchanged page reads as
            // nonexistent and correct links into them are rewritten to "/".
            const aValid = validatePages(aGen && aGen.input, {
              partial: true,
              knownRoutes: (aSrc || []).map((p) => routeOf(p && p.path)).filter(Boolean),
            });
            // AND SWEPT ANYWAY, belt and braces. The directive is what SHOULD stop a
            // token being written; this is what stops one reaching a customer's site
            // if it is written regardless. The build path has both, and the one time
            // this repo relied on the model alone it shipped a broken image on the
            // first live site it made.
            // AND THE PARTS WITH THEM, because this step's whole subject is a
            // COMPONENT — `add_to_site`'s `component` kind lands in `parts`, so
            // the one file an addon most often writes was the one file nothing
            // swept. A token stored there publishes as a literal
            // `src="@@IMG:…@@"` and the page draws its alt text.
            //
            // ⚠ AND IT WAITS WHEN THIS CHANGE IS BUYING (2026-09-17). This ran
            // unconditionally, which was right for every addon before today —
            // the step bought no photographs, so a token could only ever be a
            // model writing one against the instruction not to. The LAYER BELOW
            // MOVED: a picture asked for beside a page is bought here now, and
            // this belt was stripping the very tokens the purchase is for, one
            // hop before `buySitePhotos` went looking for them. MEASURED
            // through the route: `plan.shots` came back 0 on a run whose
            // directive named the picture and whose writer wrote the token
            // exactly as asked. *A rule true because of a layer below it
            // expires when that layer moves*, and here we are the layer.
            //
            // THE PROPERTY IS UNCHANGED — no `@@IMG:@@` token reaches a
            // customer's site — and on this branch it is `buySitePhotos` that
            // keeps it: that function ALWAYS sweeps, including every path where
            // it buys nothing, and its own comment records the live broken
            // image that bought that guarantee. Nothing between here and it
            // publishes: every exit in between is a 422 or a 503 that leaves
            // the site exactly as it was, and the buy's own catch sweeps too.
            if (!aShots.length) {
              aValid.pages = applyImages(aValid.pages, {});
              aValid.parts = applyImages(aValid.parts, {});
            }
            // AND LINTED. `validatePages` checks the SHAPE — a path, a Route
            // export, no duplicates. `lintPages` is the one that catches the
            // class of page that typechecks, bundles and then 403s or renders
            // wrong: a table the schema never declared, a `collect` table being
            // listed, a component that does not exist, an invented prop, a `#/`
            // link, a demo chart full of a stranger's invented numbers — and the
            // literal colour that would make the look layer silently do nothing.
            //
            // It ran ONLY in the build path, so both lanes that generate pages
            // were publishing without any of it. It does not block publishing,
            // by design; what it does is report, and reporting nothing was the
            // bug.
            // AND REPAIRED BEFORE IT, for the reason on the page-edit lane: an
            // invented export name is a tsc failure that costs the whole change,
            // and the build path has fixed it deterministically since it shipped
            // while both generating lanes did not.
            const aPartsKnown = [...(aValid.parts || []), ...(Array.isArray(aStoredParts) ? aStoredParts : [])];
            const aRepair = repairImports(aValid.pages, { parts: aPartsKnown });
            aValid.pages = aRepair.pages;
            // AND THE PARTS, which compile in the same program — a bad import
            // in a hand-written component takes the build down exactly as one
            // in a page does.
            aValid.parts = repairImports(aValid.parts, { parts: aPartsKnown }).pages;
            const aProblems = aValid.problems.concat(lintPages(aValid.pages, aSpec));
            // `remove` IS OPTIONAL ON THE TOOL and the build prompt never mentions
            // it, so no build request changes shape. Only the addon prompt
            // explains it, and only this lane reads it.
            const aRemove = (aGen && aGen.input && Array.isArray(aGen.input.remove)) ? aGen.input.remove : [];

            // ── A PAGE NOBODY WAS SHOWN CANNOT BE REPLACED ────────────────
            //
            // Owner, 2026-09-17: *"Enforce preservation of withheld existing
            // pages at the merge boundary. Prompt wording and `keptProse` do
            // not establish that an unseen rewrite preserves behavior."* Both
            // halves of that are exact. The prompt names every withheld page
            // and says not to return one — wording, which a model reads past —
            // and `keptProse` asks only whether the WORDS survived, which a
            // rewrite that drops a form, a link or a hook satisfies perfectly.
            //
            // THIS IS `partsSent`'s WALL ONE LAYER OVER, and for the same
            // reason in the same words: the pages we could not SHOW are
            // exactly the pages we cannot CHECK, so a returned file for one of
            // them replaces source nobody saw. It is refused, the stored
            // version is kept, and the customer is told which — because a
            // withheld page silently dropped is indistinguishable from a page
            // the model never touched.
            //
            // BY THE SAME IDENTITY THE SELECTION USED. `aPagesSent.withheld`
            // carries stored paths and `aValid.pages` carries the validator's;
            // both go through `pageId`, so the wall cannot come apart from the
            // window that decided what to withhold.
            const aUnseen = new Set(aPagesSent.withheld.map(pageId).filter(Boolean));
            const aRewrote = aUnseen.size
              ? (aValid.pages || []).filter((p) => p && aUnseen.has(pageId(p.path))).map((p) => p.path)
              : [];
            if (aRewrote.length) {
              const aBlocked = new Set(aRewrote);
              aValid.pages = (aValid.pages || []).filter((p) => !aBlocked.has(p.path));
              aMark("pages", "unseen-rewrite", { refused: aRewrote.length, withheld: aPagesSent.withheld.length });
            }

            let aMerge = mergeAddonPages(aSrc, aValid.pages, aRemove, aAskedPages);
            // …AND A CHANGE THAT WAS ONLY THAT REWRITE IS A REFUSAL, NEVER A
            // CLIMB. Falling through would escalate `nothing-returned` to the
            // ~25-credit revise — rewriting a customer's whole site because we
            // refused the one file it returned — which is this route's own
            // recorded "a considered refusal does not climb the ladder", met
            // from the refusing side.
            if (!aMerge.ok && aRewrote.length) {
              return aFail({
                ok: false, error: "unseen-rewrite", cost: 0, keptPages: aRewrote.slice(),
                msg: unseenPagesNote(aRewrote),
              }, 422);
            }
            // A CONSIDERED REFUSAL DOES NOT CLIMB THE LADDER. Escalation is for
            // "this lane could not answer" — the rung above rewrites the whole
            // site, which is expensive and does work. "Remove the home page" has
            // an answer, and sending it up rebuilds a customer's site, for ~25
            // credits, in reply to a request that should have been one sentence.
            if (!aMerge.ok && aMerge.msg) {
              // …AND THE PAGES IT KEPT (2026-10-07): a refusal whose every
              // removal was refused said why and dropped which pages.
              return aFail({ ok: false, error: aMerge.reason, cost: 0, msg: aMerge.msg.trim(), ...(Array.isArray(aMerge.kept) && aMerge.kept.length ? { kept: aMerge.kept } : {}) }, 422);
            }
            // …AND NEITHER DOES A CONSIDERED REFUSAL FROM THE MODEL, which is the
            // same rule one branch up and did not cover the commonest case of it.
            //
            // MEASURED LIVE, TWICE, TWO DAYS APART: `edit smoke` asks for "a
            // gallery page showing photographs of our work" against a fixture
            // whose `/work` page IS that gallery and is already in the header.
            // The model correctly returns no files — and `nothing-returned`
            // escalated, so asking for something the site already has rewrote
            // every page of it for ~25 credits. Byte-identical failure on
            // 2026-08-16 and 2026-08-18, which is what rules out variance.
            //
            // THE MODEL'S OWN SENTENCE IS THE EVIDENCE. `notes` is a field this
            // call already pays for and the build path already renders; a model
            // that engaged with the task and declined writes one, and a call
            // that fell over does not. So a note is what separates "there is
            // nothing to do here" from "this lane could not answer", which is
            // the only question escalation exists to settle.
            //
            // THE ASYMMETRY DECIDES IT, and it points the other way from this
            // file's usual rule. Reporting when we should have escalated costs
            // one round trip and nothing on the meter — they rephrase.
            // Escalating when we should have reported rewrites a customer's
            // whole site in reply to a request that had a one-sentence answer.
            //
            // `cost: 0` matches its sibling above and is HONEST here rather than
            // conventional: `aCost` is collected after the publish, so a refusal
            // on this path really does take nothing off the ledger.
            const aNote = aGen && aGen.input && typeof aGen.input.notes === "string" ? aGen.input.notes.trim() : "";
            if (!aMerge.ok && aMerge.reason === "nothing-returned" && aNote) {
              return aFail({ ok: false, error: aMerge.reason, cost: 0, msg: aNote.slice(0, 500) }, 422);
            }
            // No usable/effective output is a stop, including unknown reasons.
            // The explanatory refusals and the model's own note above win.
            // EVERY PROBLEM (2026-10-07): four were sent.
            if (!aMerge.ok) return aFail(addonFailure(aMerge.reason, { problems: aProblems }), 200);

            // ── WHAT WAS THERE IS STILL THERE (owner, 2026-09-04: "add a second one") ──
            //
            // An addition may only ADD. Run 35 asked for a testimonials section
            // a site already had, and the page came back with the three quotes
            // it carried rewritten shorter under the same names — `changed`,
            // `ok`, and the customer's own words gone. The rule now says a
            // second one, on both hops; this is the wall behind the rule:
            // every page the addition CHANGED (an existing page — one it added
            // has no before) must still say everything it said, by the tweak
            // rung's own reading of what counts as words, calibrated at 0
            // false alarms over 1,640 real tweaks, as a SUBSET, since an
            // addition says more. A page that lost words is refused HERE,
            // before the gate and the bill: nothing published, nothing
            // charged, and the sentence names the page and what it would have
            // lost. A refusal, not a climb — the rung above would rewrite the
            // whole site in reply to a sentence.
            const aWas = new Map((aSrc || []).filter((p) => p && typeof p.path === "string").map((p) => [p.path, String(p.source || "")]));
            const aLost = [];
            for (const p of aMerge.pages || []) {
              if (!p || !aMerge.changed.includes(p.path) || !aWas.has(p.path)) continue;
              const kept = keptProse(aWas.get(p.path), p.source);
              if (!kept.ok) aLost.push({ path: p.path, lost: kept.lost.slice(0, 3) });
            }
            aMark("kept", aLost.length ? "fail" : "ok", { changed: aMerge.changed.length, lost: aLost.map((l) => l.path) });
            if (aLost.length) {
              return aFail({ ok: false, error: "rewrote", cost: 0, lost: aLost, msg: rewroteMsg(aLost) }, 422);
            }
            // ── MAY THIS STILL PUBLISH? (async path) ──────────────────────
            //
            // The edit route's `eGate`, one rung over: cancel and budget,
            // re-asked at the last boundary before anything is written. A job
            // told no here refunds through the database and the site is left
            // exactly as it was.
            const aGatePub = aJob ? aJob.gate("build") : null;
            if (aGatePub && !aGatePub.go) return await editStopped(env, { job: aJob, why: aGatePub.why, phase: "build", trace: editTrace, ctx, extra: aStopEvidence() });

            // ── WHICH REQUESTED PAGES ARE REALLY GOING OUT ────────────────
            //
            // Computed HERE rather than below the publish, which is where it
            // was, and the move is the whole of the second fix. `aMerge` is
            // settled — it is what will be compiled and shipped — so a page
            // the writer never returned, one salvage will replace and one the
            // merge refused all read as missing already, and the answer is the
            // same on both sides of the publish. What it buys is a check that
            // happens BEFORE anything of it is stored.
            //
            // ONE COMPUTATION, TWO READERS: `aMissing` below is this list, so
            // the dependency check and the customer's own sentence cannot
            // disagree about which pages made it.
            const aFilesOut = [...(aMerge.added || []), ...(aMerge.changed || [])];
            const aWanted = aAnswers.filter((a) => a.kind === "page").flatMap((a) => (Array.isArray(a.value) ? a.value : []));
            let aGone = missingPages(aWanted, aFilesOut);

            // ── AND NO NEW QR CODE OPENS A PAGE THAT IS NOT THERE ─────────
            //
            // Owner, 2026-09-17: *"One publish does not establish that both
            // requested items exist."* `cleanAdd` admits a code pointing at a
            // page this same change is adding — correct, and correct because
            // the two go out in ONE publish — but the publish is not proof the
            // page survived generation. Reproduced: plan `/gallery`, return
            // only the home page, and the code was stored, published, and the
            // missing page reported afterwards; the customer prints it.
            //
            // BEFORE THE BILL AND BEFORE THE STORE, so a dropped code costs
            // nothing and leaves nothing behind.
            //
            // ⚠ AND THE DEPENDENT PAGES GO WITH IT (owner, 2026-09-17: *"A
            // warning does not complete the dependency."*). The first cut KEPT
            // a code a shipped page renders, so as not to pull `SITE_QRS.<name>`
            // out from under it — and published a code that opens nothing
            // beside a sentence asking the customer not to print it. Now the
            // whole dependent set is withheld together: the code is dropped,
            // and every page THIS CHANGE WROTE that renders it goes out as its
            // PREVIOUS version (or not at all, if this change invented it).
            // Nothing breaks, because what ships is a version that already
            // shipped — the binding is never deleted from a live page, it is
            // never introduced.
            // ⚠ AND A COMPONENT IS A GENERATED FILE TOO (2026-09-17). This
            // passed pages only, and MEASURED through the route: a change
            // whose COMPONENT rendered the code published `ok: true` with
            // `SITE_QRS.gallery` in `parts.json` and the code gone from the
            // look — a binding to something that does not exist, in a file the
            // next compile includes. `aValid.parts` is what the writer
            // returned, and `aPartsRead.parts` is what the site already has,
            // which is the only thing that can say whether withholding one
            // means reverting it or never writing it.
            aDeadQr = deadQrs({
              qr: aMerged.qr, prior: aLook.qr, missing: aGone, url: aUrl,
              // THE PAGES THIS CHANGE WROTE, each carrying whether it is new,
              // because that decides what withholding it means — an added page
              // disappears and takes its route with it, a changed one reverts.
              wrote: (aMerge.pages || []).filter((p) => p && aFilesOut.includes(p.path))
                .map((p) => ({ path: p.path, source: p.source, added: (aMerge.added || []).includes(p.path) })),
              // …AND THE COMPONENTS, on the same rule. `added` is decided
              // against the snapshot the whole request was built from — never
              // a second read — so "this component already exists" means the
              // same thing here as it does at the wall below.
              wroteParts: (Array.isArray(aValid.parts) ? aValid.parts : []).map((p) => ({
                name: p && p.name, source: p && p.source,
                added: !(aPartsRead.ok && (aPartsRead.parts || []).some((s) => s && String(s.name).toLowerCase() === String(p && p.name).toLowerCase())),
              })),
            });
            if (aDeadQr.dropped.length) {
              aMark("qr", "dropped", { dropped: aDeadQr.dropped.length, withheld: aDeadQr.withheld.length, parts: aDeadQr.withheldParts.length, missing: aGone.length });
              aMerged.qr = aDeadQr.qr;
              // AND THE TWO ANSWERS FOLLOW IT. Re-asked rather than patched:
              // dropping the only field this change moved makes the whole
              // look store a no-op, and `moved` has to stop claiming it.
              aReadLook();
            }
            // AND A WITHHELD COMPONENT LEAVES THE RETURNED LIST HERE, above
            // everything that reads it. Filtering at the merge instead would
            // leave the wall, the reply and the trace each reading a different
            // idea of what this change wrote, which is how two lists of one
            // thing come apart — and this repository has that recorded.
            //
            // THE MERGE THEN DOES THE REST BY ITSELF: `mergeParts` replaces by
            // name and keeps everything else, so a component taken off this
            // list simply keeps the source the site is already serving, and
            // one this change invented is never written at all.
            if (aDeadQr.withheldParts.length) {
              // ⚠ AND THE MATCH NEEDS NO FOLDING — both sides are the SAME
              // `p.name`. `withheldParts` is built from `wroteParts`, which is
              // built from this very list, so a case difference cannot arise
              // here at all. A first cut lower-cased both sides; a sweep could
              // not kill it, MEASURED over seven shapes it changed no answer,
              // and the PAIR mutant could not kill it either. Dead by
              // construction, so it is gone and this sentence is what it said.
              // `String((p && p.name) || "")` STAYS: an entry with no name is a
              // real shape and the coercion is what stops it throwing.
              const aHoldParts = new Set(aDeadQr.withheldParts.map((w) => String(w.name)));
              aValid.parts = (Array.isArray(aValid.parts) ? aValid.parts : [])
                .filter((p) => !aHoldParts.has(String((p && p.name) || "")));
            }
            if (aDeadQr.withheld.length) {
              // RE-MERGED, NEVER PATCHED. Taking the withheld files out of what
              // the writer RETURNED and asking `mergeAddonPages` again is the
              // only way to get a merge that is internally consistent: that
              // function owns "a changed page keeps its change only if it
              // carries a link to a route this change added", and a hand-edited
              // `aMerge` would satisfy none of it. A changed page reverts to the
              // source the site is serving and an added one disappears, both as
              // a consequence rather than as two more branches here.
              //
              // ONE RE-RUN, NOT A LOOP: `deadQrs` already settled its own fixed
              // point over the codes and the pages, so the second merge cannot
              // produce a third.
              const aHold = new Set(aDeadQr.withheld.map((w) => w.path));
              // ⚠ AND A LINK TO A PAGE WE JUST WITHHELD IS A DEAD BUILD — this
              // repository's own most expensive measured class, reintroduced by
              // its own fix if this is not here. MEASURED before it was: a home
              // page carrying `<Link to="/posters">` for a withheld `/posters`
              // published with that link intact, which is `TS2322` on the
              // typecheck and a 404 for the visitor who clicks it.
              //
              // `validatePages` IS THE ONE OWNER OF THAT REPAIR and its own
              // comment records the history (a cap dropped `/account` and the
              // two pages linking to it took the build down). Asked again over
              // what SURVIVES, so a link into a withheld route is rewritten to
              // "/" and REPORTED — the same second chance the cap gets. It
              // cannot refuse anything new: every page here has already been
              // through it once.
              const aSurvive = (aValid.pages || []).filter((p) => p && !aHold.has(p.path));
              const aRepaired = validatePages({ pages: aSurvive }, {
                partial: true,
                knownRoutes: (aSrc || []).map((p) => routeOf(p && p.path)).filter(Boolean),
              });
              for (const q of aRepaired.problems) if (!aProblems.includes(q)) aProblems.push(q);
              const aHeld = mergeAddonPages(aSrc, aRepaired.pages, aRemove, aAskedPages);
              // NOTHING LEFT TO PUBLISH IS A REFUSAL, NOT AN EMPTY PUBLISH. A
              // compile and a version for a site byte-identical to itself costs
              // the customer a build and moves nothing — and `mergeAddonPages`
              // answering `no-change` or `nothing-returned` is exactly that,
              // asked by the one function that can tell.
              if (!aHeld.ok) {
                // THE PAGE THE CODES WERE GOING TO OPEN IS NAMED FIRST
                // (2026-10-06): the codes' own sentence says "that page", and
                // on this refusal nothing before it said which — the missing
                // page reached neither the screen nor the stored answer.
                return aFail({
                  ok: false, error: "qr-dependency", cost: 0,
                  missingPages: aGone.length ? aGone.slice() : undefined,
                  droppedQrs: aDeadQr.dropped.slice(),
                  heldPages: aDeadQr.withheld.map((w) => w.path),
                  heldParts: aDeadQr.withheldParts.length ? aDeadQr.withheldParts.map((w) => w.name) : undefined,
                  msg: [missingPagesNote(aGone), deadQrNote(aDeadQr)].filter(Boolean).join(" ").trim(),
                }, 422);
              }
              aMerge = aHeld;
              // AND WHAT IS STILL GOING OUT IS RE-ASKED, never patched — the
              // customer's own missing-page sentence is composed from it, and a
              // page withheld here really did not make it.
              aGone = missingPages(aWanted, [...aMerge.added, ...aMerge.changed]);
            }

            // ── WHAT THE LOOK REALLY ADDED, for the coverage (2026-09-19) ──
            //
            // Owner, after run 51: *"Check why the reply says it cannot
            // establish the QR implementation when this run created and
            // published it."* It said so because a code was in no applied list
            // at all — `appliedFacts` spoke for the four schema tiers and
            // `page`, and a code and a scene are applied results of this change
            // exactly as a page is. See `APPLIED_KINDS`.
            //
            // BELOW THE DROP, WHICH IS THE WHOLE REASON IT IS HERE AND NOT AT
            // THE MERGE. A code whose destination did not survive generation is
            // dropped a few lines up, and claiming it as an applied result
            // would tell a customer the very thing the drop exists to prevent.
            //
            // WHAT THIS CHANGE ADDED, NEVER WHAT THE SITE HOLDS. `aMerged` is
            // the merge of the stored look with this change's answers, so it
            // carries every code the site already had; those belong to
            // `existingFacts`, which reads `aLook`, and counting them here
            // would let a site's old code answer for a new one nobody made.
            // BY NAME, because that is the identifier the file and the binding
            // are built from (`qr-<name>.svg`, `SITE_QRS.<name>`) and the one a
            // `{kind, name}` reference resolves against.
            {
              const aHadQr = new Set(qrList(aLook.qr).map((c) => c.name));
              aLookMade = {
                qrs: qrList(aMerged.qr).filter((c) => c && !aHadQr.has(c.name)),
                // A SITE CARRIES AT MOST ONE SCENE (`SINGLE_FIELDS`), so "this
                // change added one" is the stored field arriving where there
                // was none — an edit to a scene the site already had is not an
                // addition and the `three` kind never runs for one.
                three: !!aMerged.three && !aLook.three,
              };
            }

            // ── AND WHAT WAS ASKED FOR IS THERE (2026-10-02) ───────────────
            //
            // `keptProse` says nothing was lost; this says the thing the
            // designer promised ARRIVED, on the page it named, before the
            // bill: a line of words read back with the text rung's own
            // reader, a photograph of the site's own found drawn on that page
            // once more than before. HERE, below the QR re-merge, because that
            // can still take a page back out. A page that came back without it
            // is refused — nothing published, nothing charged — never
            // published under a reply saying it was added.
            // THE SITE'S OWN FILES A PAGE MAY IMPORT (2026-10-15, after
            // Codex's third review): its components — as they stood, and as
            // this change returned them — and its stored kit, so a component
            // imported from one of them is read where it is rendered. One
            // imported from anywhere else renders nothing vouched for.
            const aKitFiles = aFold.words.length ? await loadSiteKit(env, ownerSlug) : [];
            const aPartFiles = (list) => (Array.isArray(list) ? list : []).filter((x) => x && typeof x.name === "string" && typeof x.source === "string").map((x) => ({ path: partPath(x.name), source: x.source }));
            const aPartsAfter = new Map(aPartFiles(aStoredParts).map((f) => [f.path, f]));
            for (const f of aPartFiles(aValid && aValid.parts)) aPartsAfter.set(f.path, f);
            const aWordsAt = wordsLanded(aSrc, aMerge.pages, aFold.words, {
              filesBefore: [...aPartFiles(aStoredParts), ...aKitFiles],
              files: [...aPartsAfter.values(), ...aKitFiles],
            });
            const aPhotosAt = photosLanded(aSrc, aMerge.pages, aFold.reuse, ownerSlug);
            aMark("landed", aWordsAt.ok && aPhotosAt.ok ? "ok" : "fail", { words: aFold.words.length, photos: aFold.reuse.length, missing: aWordsAt.missing.length + aPhotosAt.missing.length });
            // A LINE OR PHOTOGRAPH THAT DID NOT ARRIVE NEVER SINKS THE REST
            // (owner, 2026-10-22, the big add-on rerun: two home-page lines
            // not found threw away new pages, lists, jobs and a QR code). When
            // this addition carries other work, each missing one is left out
            // by name and the rest goes on; only an addition of nothing but
            // lines and photographs is still refused whole.
            const aOnlyPlaced = aAnswers.every((a) => a && (a.kind === "words" || a.kind === "photo"));
            if ((!aWordsAt.ok || !aPhotosAt.ok) && !aOnlyPlaced) {
              for (const w of aWordsAt.missing) aNotAdded.push({ kind: "words", name: String((w && w.words) || "").slice(0, 120), why: "not-landed", msg: "That line wasn't on " + ((w && w.page) || "the page") + " when the page came back, so it was left out." });
              for (const ph of aPhotosAt.missing) aNotAdded.push({ kind: "photo", name: String((ph && ph.src) || "").slice(0, 120), why: "not-landed", msg: "That photograph wasn't on " + ((ph && ph.page) || "the page") + " when the page came back, so it was left out." });
            } else if (!aWordsAt.ok || !aPhotosAt.ok) {
              return aFail({
                ok: false, error: "not-landed", cost: 0,
                missing: { words: aWordsAt.missing.slice(), photos: aPhotosAt.missing.slice() },
                msg: notLandedMsg({ words: aWordsAt.missing, photos: aPhotosAt.missing }, { changed: aProvisioned }),
              }, 422);
            }

            // EACH PAGE THE MENU-LINK STEP BELOW CHANGES, with its source after it (`settleReverted`).
            const aLinked = new Map();
            // WHAT THIS ADDITION'S OWN WORK LEFT ON THE PAGES before the code's
            // menu links (2026-10-07): the new pages and the existing ones the
            // merge kept changed — so a page whose one change is a link is told
            // apart from them in the pages milestone below.
            const aWorkAdded = [...(aMerge.added || [])], aWorkChanged = [...(aMerge.changed || [])];
            let aLinkOnly = [];
            // ── A NEW PAGE GOES INTO EVERY MENU, BY CODE (2026-10-04, run 95's F1) ──
            //
            // A page whose design puts it in the menu (`link.in`, the default)
            // is added to every page's own menu here — the menu step's own
            // per-list writer (`applyAdditions`), so a page that already lists
            // it keeps it where it is, a menu that differs by design keeps its
            // differences, the new page's own menu gains it too, and a page
            // with no menu is given none. The page writer was told not to edit
            // another page for it; a link it put on one anyway is already
            // there and stays. Only a page that made it is linked (`aGone`).
            // A placement on one page — a button, a band — was the page
            // writer's, and is left exactly as it wrote it.
            // ON A WRITTEN FRAME (2026-10-23, `build-ai-writes-all`) there is
            // no `SiteChrome` for `applyAdditions` to write: the new page's
            // link goes into the written header (and the footer's own link
            // list, when it has one) instead — `addFrameLinks`, a copy of the
            // list's last entry where the list is unambiguous, else one frame
            // edit as an addition — and rides the same publish as the page,
            // which compiles the parts with the pages. A `SiteChrome` site
            // never enters (`writtenFrame` answers null).
            // ITS ONE MODEL CALL IS BILLED WITH THE DESIGNERS' (`aDesignUsage`,
            // on the addition's one bill), so it is offered only while that
            // bill is still to come: once the designers were charged ahead of a
            // schema apply (`aFirstPlaced`), only the copy is made.
            let aFrameParts = null;
            {
              const aLinks = menuLinkAdds(aWanted, aGone);
              const aFrameBase = aPartsRead.ok ? mergeParts(aPartsRead.parts, Array.isArray(aValid && aValid.parts) ? aValid.parts : []) : null;
              if (aLinks.length && aFrameBase && writtenFrame(aMerge.pages, aFrameBase)) {
                const aFl = await addFrameLinks(aFirstPlaced ? {} : { send: aQuick("frame-links") }, {
                  pages: aMerge.pages, parts: aFrameBase, adds: aLinks,
                  routes: [...new Set(aMerge.pages.map((p) => routeOf(p.path)).filter(Boolean))],
                });
                if (aFl.usage) aDesignUsage.push(aFl.usage);
                if (aFl.ok) aFrameParts = aFl.parts.filter((p) => p && FRAME_PARTS.some((f) => f.file === String(p.name || "").toLowerCase()));
                aMark("menu-links", aFl.ok ? "ok" : "skip", { frame: true, how: aFl.how || aFl.reason, changed: aFl.ok ? aFl.changed.length : 0 });
              } else if (aLinks.length) {
                const aIn = applyAdditions(aMerge.pages, aLinks);
                if (aIn.changed.length) {
                  const aKnown = new Set([...(aMerge.added || []), ...(aMerge.changed || [])]);
                  aLinkOnly = aIn.changed.filter((pg) => !aKnown.has(pg));
                  aMerge = { ...aMerge, pages: aIn.pages, changed: [...(aMerge.changed || []), ...aLinkOnly] };
                  // WHAT THIS STEP DID TO EACH PAGE, KEPT FOR THE SETTLING BELOW
                  // (2026-10-05, run 101): its source right after the link went
                  // in, and the addresses it gained — so a page the merge put
                  // back is told apart from one whose only change is this link.
                  for (const pg of aIn.pages) {
                    if (!pg || !aIn.changed.includes(pg.path)) continue;
                    aLinked.set(pg.path, { source: pg.source, to: (aIn.report || []).filter((r) => r && Array.isArray(r.added) && r.added.includes(pg.path)).map((r) => r.add.item.href) });
                  }
                }
                aMark("menu-links", "ok", { pages: aLinks.length, menus: aIn.changed.length });
              }
            }
            // ── THE PAGES, AS A MILESTONE, ONCE THEY ARE SETTLED (2026-10-07) ──
            //
            // Recorded here, after the merge, the withheld pages and the code's
            // own menu links — not when the page writer returned, which named
            // every page it sent back, a page the merge then put back among
            // them, and none of the pages whose menus the code changed after.
            // Run 105's line said "the classes page" of exactly such a page.
            if (aJob && aJob.progress) {
              const aPagesSaid = addonPagesFacts({ added: aWorkAdded, changed: aWorkChanged, linked: aLinkOnly.map((path) => ({ path, to: (aLinked.get(path) || {}).to || [] })), photos: aFold.photos });
              if (aPagesSaid.length) aJob.progress.mark("pages", aPagesSaid);
            }

            // ── THE BILL ON THE PAGE PATH ─────────────────────────────────
            //
            // `aCharge` above says when and why. Every usage is known by this
            // line — the page call was the last model call — so it is the
            // same number either way: reserved here under a job, collected
            // after the publish otherwise.
            // ONE BILL AND ONE ROUNDING when nothing was reserved yet; when #1
            // went ahead of a schema apply (1a-ii) the page call's spend is its
            // own reserve, #4 — a second floor of 1, the translation charge's
            // own trade — and the reply carries the sum. A refusal here stops
            // BEFORE the look is stored.
            const aBill = aFirstPlaced ? pageCredits(aGen && aGen.usage, aPick && aPick.usage) : pageCredits(...aDesignUsage, aGen && aGen.usage, aSeedUsage, aPick && aPick.usage);
            // PREPARED: the pages are written and recorded; nothing is charged,
            // stored, bought or compiled here.
            if (aPrep) return aPrepStop();
            let aCost = 0;
            if (aJob) aCost = aFirstPlaced ? aFirst + await aCharge(aBill, 4) : await aCharge(aBill);
            // THE WRITER'S OWN RESERVE, by sequence (2026-10-24): a file it
            // wrote that ends kept or standing in is given back by that ref.
            const aWriterTook = aJob ? (aFirstPlaced ? aCost - aFirst : aCost) : 0;
            if (aJob && aCharges.refused() > 0) { const u = unbilledBody(aCharges); return aFail(u.body, u.status); }

            // THE COMPONENTS THE ADDON WROTE GO WITH THE PAGES, merged over the
            // stored list by name — the page rung's own fix, one rung up.
            //
            // ── AND NOTHING REPLACES WHAT THE WRITER WAS NEVER SHOWN ────────
            //
            // Owner, 2026-09-17: *"prevent replacement of an existing
            // component whose source the writer was never shown."*
            // `mergeParts` replaces by name and has no wall of its own, so a
            // returned `TideChart` overwrote the real `TideChart` whatever the
            // model had in front of it. The ordinary case is now that every
            // stored component's source IS in the prompt, and then this
            // refuses nothing at all — it is the honest answer to the bound in
            // `partsSent`, which withholds a component too large to carry.
            //
            // BY THE SAME `aSentParts` THE PROMPT WAS BUILT FROM, so "was this
            // shown?" has exactly one answer. Refused rather than merged: the
            // stored file keeps working and the page that imports it still
            // compiles, where accepting a rewrite composed from a one-line
            // description is a silent loss of the real implementation.
            //
            // NAMED, NEVER DROPPED IN SILENCE — `aKeptParts` rides the reply
            // and the trace, because a component the customer asked to change
            // and did not get changed is the one thing they must hear.
            // `withheld` IS THE WHOLE TEST, and the obvious second half was
            // DEAD BY CONSTRUCTION. The first draft also asked "…unless it was
            // shown", which reads as a belt and cannot ever fire: `partsSent`
            // sends each component down exactly one branch and dedupes names
            // first, so `shown` and `withheld` are disjoint — MEASURED over
            // five shapes, including a name given twice at both sizes and a
            // list that overruns the whole-request bound. A sweep mutant
            // cutting that line survived everything, which is what said so.
            //
            // …AND AN UNREADABLE STORE REFUSES EVERY ONE OF THEM, which is a
            // SEPARATE list because it is a separate sentence. `withheld`
            // names components we read and chose not to send; `unreadable`
            // means we never learned a single name, so there is nothing to
            // check a returned component against and no way to know what a
            // replacement would destroy. The two can never both fire —
            // `partsSent` answers empty lists when it cannot read — and that
            // is by construction rather than by care here.
            //
            // ⚠ THIS `return false` IS A DECLARED REDUNDANCY, AND IT IS
            // MEASURED RATHER THAN REASONED ABOUT. The merge below refuses to
            // write anything at all while `aPartsRead.ok` is false, so keeping
            // a returned component here changes no observable: driven through
            // the route with one read failing and with both failing, the reply
            // and the stored bytes are IDENTICAL either way. It stays because
            // the two say different things — this one is "which returned
            // components may be kept", that one is "may we write at all" — and
            // because `aUnseenParts` is filled on this line, which is what the
            // customer hears. The sweep mutates the PAIR, since neither half
            // can be killed alone; said here because a sweep cannot say it and
            // the next session deletes what nothing appears to need.
            const aKeptParts = [], aUnseenParts = [];
            const aFreshParts = (Array.isArray(aValid.parts) ? aValid.parts : []).filter((p) => {
              const n = String((p && p.name) || "").toLowerCase();
              if (aSentParts.unreadable) { aUnseenParts.push(p && p.name); return false; }
              if (!aSentParts.withheld.some((w) => w.toLowerCase() === n) && !aHiddenParts.includes(n)) return true;
              aKeptParts.push(p.name);
              return false;
            });
            if (aKeptParts.length || aUnseenParts.length) aMark("parts", "kept", { kept: aKeptParts.length, unseen: aUnseenParts.length, shown: aSentParts.shown.length, withheld: aSentParts.withheld.length });
            // AND THE MERGE READS THE SAME SNAPSHOT, NEVER A SECOND READ.
            // `mergeParts` replaces by name and keeps everything else — but
            // only what it is HANDED: `mergeParts(null, [one])` answers
            // `[one]`, so a second read that failed where the first succeeded
            // would delete every component this change never mentioned.
            // `aPartsRead.parts` is the list the prompt and the wall were both
            // built from, and while `ok` is false nothing is written at all:
            // `null` leaves the spine to re-send the store's own copy, which
            // is exactly what an addon that touched no component does.
            // A `let` BECAUSE THE PHOTOGRAPHS ARE SWEPT INTO IT BELOW — a
            // token in a component this change wrote is a real `src` after
            // `buySitePhotos`, and the list the publish sends has to be the
            // swept one. `null` still means "this change touched no component,
            // so the spine re-sends the store's own copy" and that stays true:
            // nothing below assigns over a `null`.
            let aParts = (aFreshParts.length && aPartsRead.ok)
              ? mergeParts(aPartsRead.parts, aFreshParts)
              : null;
            // THE WRITTEN FRAME'S NEW LINKS, merged last (`addFrameLinks` above).
            if (aFrameParts && aFrameParts.length && aPartsRead.ok) aParts = mergeParts(aParts || aPartsRead.parts, aFrameParts);
            // ── AND EVERY PHOTOGRAPH THE SITE SHOWED IS STILL SHOWN ─────────
            //
            // (2026-09-17, owner: *"Preserve existing photographs when buying
            // new ones… prevent an addon from accepting removal or replacement
            // of existing image references in pages and custom components."*)
            //
            // THE DIRECTIVE INVITED IT AND IS CORRECTED; THIS IS THE WALL.
            // `imageDirective`'s paid tail read *"any other picture stays a
            // <SafeImage> with no src… that is the intended look for the rest
            // of the site"* — true of a first build and an instruction to strip
            // on an addon. REPRODUCED through this route on a site showing two
            // bought photographs: both came back with empty `src`, the compiler
            // payload and `source/<slug>/pages.json` each ended with ZERO `/u/`
            // urls, the customer was told *"Made 1 photograph for the site."*,
            // and the two stripped pictures were counted as empty frames this
            // change had ADDED.
            //
            // `keptProse` ONE FIELD OVER, and the same refusal: nothing
            // published, nothing charged, `cost: 0` honest for the reason its
            // sibling above states. The photographs are money the owner already
            // spent, and an addition may only ADD.
            //
            // SITE-WIDE AND ACROSS BOTH LISTS, which is what makes it different
            // in shape from `keptProse`'s per-page loop: a writer that moves a
            // `<SafeImage>` off the home page into a new component has kept
            // every picture the site shows, and a per-file wall would refuse
            // that. `imageSources` is the one definition of the files a
            // photograph can be in, and this is the SAME PAIR `newEmptySlots`
            // is handed below — one idea of before-and-after, not two.
            //
            // BEFORE THE PURCHASE, so a change that would lose one does not
            // first spend $0.15 on the replacement.
            const aPicsBefore = imageSources(aSrc, aPartsRead.parts);
            const aPicsAfter = imageSources(aMerge.pages, aParts || aPartsRead.parts);
            const aKeptPics = keptImages(aPicsBefore, aPicsAfter, ownerSlug);
            aMark("pics", aKeptPics.ok ? "ok" : "fail", { lost: aKeptPics.lost.length });
            if (!aKeptPics.ok) {
              return aFail({
                ok: false, error: "lost-photos", cost: 0, lostPhotos: aKeptPics.lost.slice(),
                msg: lostPhotosMsg(aKeptPics.lost),
              }, 422);
            }
            // ── AND A `src` THIS SITE DOES NOT OWN NEVER SHIPS (2026-09-19) ──
            //
            // The wall behind the reuse permission the directive now grants.
            // `keptImages` above asks what went MISSING; this asks what
            // APPEARED that the site never had — both are additions as far as
            // the other is concerned, which is why one reader cannot answer
            // both. MEASURED before it existed: an invented `/u/<slug>/…` url
            // passed `keptImages`, came through `applyImages` byte-identical
            // and would have published as a broken image.
            //
            // SWEPT TO EMPTY RATHER THAN REFUSED — `applyImages`' own answer to
            // an unbought token, so the page ships, the frame becomes a slot
            // the picture rung can fill, and `newEmptySlots` below counts it
            // into the sentence the customer already gets. Refusing would cost
            // them a page and a QR code over one wrong attribute.
            //
            // HERE, BESIDE `keptImages` AND BEFORE THE PURCHASE, because after
            // it every photograph this change bought is a url the site did not
            // have and would read as invented.
            //
            // ⚠ AND "INVENTED" IS THE UPLOAD STORE'S ANSWER, NOT THE PAGES'
            // (corrected 2026-09-19). This block read `before` as the definition
            // of what the site owns, and MEASURED through this route, a valid
            // upload the owner had not placed on a page yet came back
            // `<SafeImage src="">` — the platform deleting a customer's own
            // photograph because nothing had drawn it before. `before` is a
            // FAST PATH now and nothing more: a url already on a live page is
            // one the site has been serving, and sweeping it would be this
            // change removing a picture `keptImages` refuses to let it remove
            // three lines up. Everything else is asked of `siteUploadExists`,
            // which answers `null` for cannot-tell — and an unknown is LEFT
            // STANDING, because an unknown swept is somebody's picture gone.
            const aNewPics = newImageRefs(aPicsBefore, aPicsAfter, ownerSlug);
            const aPicCheck = aNewPics.length
              ? await strayImages(aNewPics, (u) => siteUploadExists(env, ownerSlug, u))
              : { stray: [], unknown: [] };
            const aStray = aPicCheck.stray;
            if (aPicCheck.unknown.length) {
              // SAID, BECAUSE A SILENT UNKNOWN IS A WALL NOBODY CAN SEE STAND
              // DOWN: a run that swept nothing because the bucket was
              // unreadable and a run with nothing to sweep are the same log
              // line otherwise.
              //
              // ⚠ THE FACT IS IN THE DETAIL'S KEY, NOT IN THE STATUS.
              // `edit-trace.mjs` keeps a CLOSED status vocabulary — `ok`,
              // `fail`, `start`, and `?` for everything else — so the word
              // "unknown" would arrive as `?`, which is exactly what the
              // `stray` mark below already becomes. Two different facts wearing
              // one status, told apart only by which keys the detail happens to
              // carry, is a wrong number wearing a right one's name; `unknown`
              // as its own key is what separates them.
              aMark("pics", "unknown", { unknown: aPicCheck.unknown.length });
            }
            if (aStray.length) {
              // EACH LIST GETS ITS OWN FILES BACK, never the union sliced apart
              // by length — `applyImages` records why, and this is the same hop.
              const aSweptPages = dropStrayPhotos(aMerge.pages, aStray);
              aMerge = { ...aMerge, pages: aSweptPages.files };
              let aStrayIn = aSweptPages.dropped;
              if (aParts) {
                const aSweptParts = dropStrayPhotos(aParts, aStray);
                aParts = aSweptParts.files;
                aStrayIn = aStrayIn.concat(aSweptParts.dropped);
              }
              aMark("pics", "stray", { urls: aStray.length, files: aStrayIn.length });
            }

            // ── AND ONLY NOW IS THE DESIGN STORED ───────────────────────────
            //
            // STORED HERE, NOT EARLIER: every refusal above leaves the site
            // exactly as it was, and the publish below is the only thing that
            // needs the new look — the container bakes `/qr-<name>.svg` from
            // what is stored when it compiles. The one failure after this
            // point puts the old look back: `aStored` has exactly ONE reader,
            // the publish's own `if (!aPub.ok)` branch, and the only other
            // `return` between here and it is this write's own failure, which
            // stored nothing. Measured over that window, not reasoned about.
            //
            // ⚠ IT SAT ABOVE `keptImages` UNTIL 2026-09-17, and the sentence
            // it carried already claimed this invariant while being one block
            // too high to keep it. MEASURED: `lost-photos` is the ONLY refusal
            // that was ever below it — `rewrote` and `qr-dependency` were both
            // above the old position — so the defect is exactly one day old
            // and is this change's own sibling. *A rule true because of the
            // layer below it expires when that layer moves*, met from the
            // other direction: the rule stood still and a refusal was added
            // underneath it. Owner: *"A combined gallery + photo + QR request
            // that fails with lost-photos leaves the QR persisted, although
            // the gallery was never published."*
            // REPRODUCED through this route on exactly that ask: 422,
            // `cost: 0`, nothing compiled, nothing bought, `source/<slug>/
            // pages.json` untouched — and `look.qr` left holding
            // `{name:"gallery", points:"https://<slug>.gofarther.app/gallery"}`
            // for a route that will never exist. A QR is the one thing here
            // somebody PRINTS, so that is the artifact the `qr-dependency`
            // refusal one block up exists to prevent, arriving through the
            // refusal path instead.
            //
            // MOVED RATHER THAN COMPENSATED FOR, which was the other option
            // offered and is the weaker one: a restore-on-refusal is a second
            // repair path that can itself fail, and a failed restore leaves
            // the site wrong with nothing left to try. Moving the write below
            // every refusal that has no restore keeps ONE rule — *a refusal
            // changes nothing* — instead of a rule plus an exception.
            //
            // NOTHING BETWEEN THE OLD POSITION AND THIS ONE READS IT: the
            // parts wall and `keptImages` read `aSrc`, `aPartsRead`, `aMerge`
            // and `aParts`; `aStored` is read only below. Checked rather than
            // assumed — and the move makes the store-to-publish window
            // strictly SMALLER, so it cannot have introduced an unreverted
            // refusal of its own.
            let aStored = false;
            // A JOB THAT LOST THE SITE'S TURN STORES NO LOOK (2026-10-15): it
            // would be written over the config of the job that took it.
            // AN ADDITION CLEARED WITHOUT THE TURN TAKES IT HERE (2026-10-22,
            // audit A04-5): its targets named a page or a component, so it did
            // not hold the turn from its start, yet a QR code or a 3D scene is
            // stored in the look. It waits for the turn as a holder would, puts
            // the config level with the live site, and keeps it through its
            // publish (`holds`) — never refused `turn-lost` for a turn it was
            // never given.
            if (aLookPatch && aJob && aJob.beside && !aJob.beside.turn && !aJob.beside.lost && writesBeside(env) && env.SITES_BUCKET) {
              if (await takeTurn(env, ownerSlug, aJob)) {
                aJob.beside.holds = true;
                const st = await ensureEditableState(env, ownerSlug, { turnOwner: aJob.beside.turn.owner, fence: jobFence(env, aJob) });
                if (st && st.why === "turn-lost") loseTurn(aJob, ownerSlug, "found at the editable-state check");
                else if (!st || st.ok !== true) return aFail({ ok: false, error: "read", ours: true, cost: 0, msg: aProvisioned ? "That addition wasn't published — I couldn't check the site's saved state before storing its look. Its database was made, so it will be ready when you ask again." : "That addition wasn't published — I couldn't check the site's saved state before storing its look. Nothing was changed." }, 503);
              } else if (!aJob.beside.lost) {
                const stop = turnStop(aJob.beside);
                return aFail({ ok: false, error: aJob.beside.refused ? "turn-refused" : stop ? stop.error : "turn", ours: true, cost: 0, msg: "That addition wasn't published — another change in this request was still publishing, and this one couldn't get its turn to store its look. Send it again." }, 503);
              }
            }
            if (aLookPatch && !(await turnStillMine(env, ownerSlug, aJob))) {
              return aFail({ ok: false, error: "turn-lost", ours: true, cost: 0, msg: "That addition wasn't published — another change in the same request took its turn to publish. Send it again." }, 503);
            }
            if (aLookPatch) {
              const w = await patchSiteConfig(env, ownerSlug, adb, aLookPatch, jobFence(env, aJob));
              if (!w.ok) {
                console.error("addon look store failed:", ownerSlug, w.error);
                // "UNTOUCHED" ONLY WHEN IT IS (2026-10-06): a database made for
                // the site before this write is live, so it is said as what did
                // not happen.
                return aFail({ ok: false, error: "config", cost: 0, msg: aProvisioned
                  ? "That addition couldn't be saved, so it wasn't published — try again in a moment."
                  : "That addition couldn't be saved, so your site is untouched — try again in a moment." }, 503);
              }
              aStored = true;
            }
            // ── THE PHOTOGRAPHS ARE BOUGHT AND PLACED, IN THIS SAME REQUEST ──
            //
            // (2026-09-17, owner: *"completing page + photo in one request"*.)
            //
            // AFTER THE MERGE AND THE PARTS WALL, so what is swept is what will
            // really be published: a page the QR dependency withheld, one the
            // merge boundary refused and a component the writer was never shown
            // are all already gone by this line, and buying a photograph for a
            // file nobody will be served is money spent on nothing.
            //
            // BEFORE `newEmptySlots`, which is what makes the customer's
            // sentence honest: a slot this change FILLED is not an empty frame
            // to warn them about, and a token the balance could not buy is
            // swept to `src=""` and counted — which is exactly what they see.
            //
            // `buySitePhotos` IS THE BUILD PATH'S OWN, unchanged: it re-asks
            // the balance, the owner's upload library and the clock, plans from
            // the tokens really in the source, buys what all three allow, and
            // ALWAYS sweeps — so a run that can afford nothing leaves
            // placeholders rather than the broken images an unswept token
            // renders as. `reserve: 0` because the publish that follows is this
            // route's own and its clock is the job's, which `clock` carries.
            //
            // `aParts || []` FOR THE READ, NEVER `aPartsRead.parts`: a stored
            // component has already been through `applyImages` on its own
            // publish and holds no token, and handing the stored list in would
            // let a sweep write back over a file this change never touched.
            let aPhotos = null;
            let aPhotoCharged = 0;
            // FRAMES PUBLISHED MARKED, WAITING ON THEIR PURCHASE (round 5).
            let aPendingPhotos = [];
            // WHAT THE PICTURES COST, ONE EXPRESSION, TWO CONSUMERS: the job's
            // reserve below and the synchronous collect after the publish.
            // `made`, NEVER `planned` — a photograph that did not arrive costs
            // the customer nothing, which is the build path's own rule and the
            // picture rung's. Written once so the two roads cannot come to
            // disagree about the number, which is how one of them ends up
            // billing for a picture nobody got.
            let aPhotoBill = null;
            if (aShots.length) {
              try {
                // JOINED WITH THE PHOTOGRAPHS BOUGHT BESIDE THE PAGE WRITER
                // (2026-10-11): each one is joined by the buyer (`pending`, the
                // same logical purchase) — one in flight is waited for INSIDE
                // this step's own purchase wait, so a call still out when that
                // wait ends is kept as pending work as before; one bought is
                // used; one refused is told, never bought again.
                aPhotos = await buySitePhotos(env, {
                  slug: ownerSlug, pages: aMerge.pages, parts: aParts || [],
                  budget: aShots.length, balance: aBalance, reserve: 0, clock: aJob && aJob.budget,
                  // A REQUEST PART'S PHOTOGRAPHS (2026-10-09, round 3) are its
                  // logical purchases: a retry of this job reuses what an
                  // earlier try bought and never buys one whose outcome is unknown.
                  // AN ADDITION THAT STAYED A JOB OF ITS OWN (round 7: the flow off,
                  // or a post with pictures) buys through records too, keyed by its
                  // own job (or, on the synchronous path, by its post's key): a
                  // redelivery or a takeover of that job reuses what it bought and
                  // never buys one whose outcome is unknown. Nothing places its
                  // frames later — no request holds it — and its reply says so.
                  buy: aBuyAs ? purchaseBuyer(env, { ...aBuyAs, pending: aPhotoTask ? aPhotoTask.pending : null }) : null,
                  own: aOwnIds,
                  // A REQUEST PART'S FRAME WAITING ON A PURCHASE NOBODY CAN TELL
                  // (2026-10-09, round 5) is published marked, and the part is
                  // held on it: once the purchase is known, a placement step
                  // fills that frame — the addition is never made again.
                  pend: !!(aJob && aJob.purchase),
                  // THE PAGE'S OWN PARSER finds each frame (round 6), whatever
                  // valid TSX the writer used; without one, a frame is never
                  // guessed at and its purchase stays pending with no frame.
                  // IN THE WORKER'S ISOLATE (an `inline` job, round 7) the site's own
                  // container reads them, with the same code (`framesFor`).
                  frames: aJob && aJob.purchase ? await framesFor(env, ownerSlug) : null,
                });
                aPendingPhotos = Array.isArray(aPhotos.pending) ? aPhotos.pending : [];
                const aMarked = new Set(aPendingPhotos.map((x) => x.key));
                // ONE NOBODY CAN TELL AND COULD NOT BE MARKED is left as its frame and told, never bought again.
                for (const d of aPhotos.unconfirmed || []) if (!aMarked.has(d)) aNotAdded.push({ kind: "photo", name: String(d).slice(0, 120), why: "purchase-unconfirmed", msg: "A photograph for this was being bought and I can't tell whether that purchase went through, so I didn't buy it again; its frame is left empty." });
                aMerge = { ...aMerge, pages: aPhotos.pages };
                if (aParts) aParts = aPhotos.parts;
                // `planned` IS THE FULL REQUEST AND `offered` IS WHAT THE
                // BALANCE LEFT, because a trace that records the cut list as
                // the plan cannot tell a customer who asked for one from one
                // who asked for three and could pay for one.
                aMark("photos", "ok", { made: aPhotos.made || 0, planned: aFold.photos.length, offered: aShots.length });
                // EACH PHOTOGRAPH AS THE PURCHASE LEFT IT (2026-10-10): made, or
                // not made and kept missing in every later line.
                if (aJob && aJob.progress) aJob.progress.mark("photos", addonPhotosFacts({ planned: aFold.photos, bought: aPhotos.bought, pending: aPendingPhotos }));
              } catch (e) {
                // NAMED, NEVER FATAL — the site is the product and the pictures
                // are the decoration, which is the build path's own rule. The
                // tokens are then still in the source, so the ones this catch
                // leaves behind would render as broken images; `applyImages`
                // with an empty map is the sweep `buySitePhotos` would have
                // done, and it is what turns them back into placeholders.
                // `bought: []` IS PART OF THE SHAPE, not a tidiness thing: the
                // association reader below asks this field, and a throw here
                // means not one picture was minted — so the honest answer is
                // the empty list, where an absent field would read as a
                // `buySitePhotos` that predates the association and leave every
                // requested photograph unjudged.
                aPhotos = { made: 0, planned: aShots.length, budget: 0, overflow: 0, bought: [], error: String((e && e.message) || e).slice(0, 200) };
                aMerge = { ...aMerge, pages: applyImages(aMerge.pages, new Map()) };
                if (aParts) aParts = applyImages(aParts, new Map());
                aMark("photos", "fail", { planned: aFold.photos.length, offered: aShots.length });
                // A THROWN PURCHASE IS AN OUTCOME NOBODY CAN TELL (2026-10-10):
                // some may have been made before it threw, so each is said as
                // not confirmed and its frame left empty — never as not made.
                aPhotos.thrown = true;
                if (aJob && aJob.progress) aJob.progress.mark("photos", addonPhotosFacts({ planned: aFold.photos, unsure: aShots.map((x) => x.describe) }));
              }
              // ── AND THE PICTURES ARE BILLED ────────────────────────────────
              //
              // `made`, NEVER `planned`: a photograph that did not arrive costs
              // the customer nothing, which is the build path's own rule and the
              // picture rung's (*"the working balance moves on success and not on
              // the attempt"*). `pageCost` prices an image at `IMAGE_USD` flat —
              // one table, not a second copy of the rate here.
              //
              // UNDER A JOB IT IS RESERVED HERE, before the spine's publish gate,
              // because that is this route's rule for everything it spends: what
              // is charged is charged before the commit point. Its own sequence,
              // beside the design (#1), the repair round (#2), the translations
              // (#3) and the page call (#4) — the RPC is idempotent per sequence
              // and asks no order of them.
              //
              // SYNCHRONOUSLY IT JOINS THE ONE COLLECT AFTER THE PUBLISH, so a
              // route with no job still bills once and rounds once, which is the
              // whole reason that line is a single `pageCredits(...)`.
              aPhotoBill = aPhotos && aPhotos.made ? { images: aPhotos.made } : null;
              // THE SAME QUESTION AS BEFORE THE PAGE CALL, AFTER THE PURCHASE
              // (2026-10-02): a photograph-only addition whose one photograph
              // was not made has nothing real to publish, so it is refused and
              // nothing is charged — a job's reserves are refunded on any reply
              // that does not ship. `!aStored` because a photograph designs no
              // look, so nothing is stored on this path; were that ever to
              // change, the old behaviour (a placeholder, said) is kept rather
              // than a refusal over a half-written site.
              if (aPhotoOnly && !aFold.reuse.length && !aPhotoBill && !aStored) return aNoPhoto();
              if (aJob && aPhotoBill) {
                aPhotoCharged = Number(await aCharge(pageCredits(aPhotoBill), 5)) || 0;
              }
            } else if (aFold.photos.length && aJob && aJob.progress) {
              // NONE OFFERED (2026-10-10): the balance could pay for no photograph,
              // so every one the design asked for is not made, and said so.
              aJob.progress.mark("photos", addonPhotosFacts({ planned: aFold.photos }));
            }
            // EVERY PHOTOGRAPH THE DESIGN ASKED FOR AND THIS CHANGE DID NOT MAKE
            // IS NOT ADDED (2026-10-10, after the Add-on press): from the
            // purchase's own result, so the part is partial whether or not a
            // designer wrote a requirement about it — one a requirement names is
            // told by that requirement's outcome instead, once.
            // A THROWN PURCHASE'S PHOTOGRAPHS ARE NOT KNOWN NOT MADE: told as
            // unconfirmed, the purchase's own word for a cannot-tell.
            const aThrewOn = aPhotos && aPhotos.thrown ? aShots.map((x) => x.describe) : [];
            for (const x of photosNotMade({ planned: aFold.photos, bought: aPhotos ? aPhotos.bought : [], pending: aPendingPhotos, unconfirmed: aPhotos ? aPhotos.unconfirmed : [], requirements: aReq })) {
              if (aThrewOn.some((d) => shotKey(d) === x.describe)) aNotAdded.push({ kind: "photo", name: x.describe.slice(0, 120), why: "purchase-unconfirmed", msg: "A photograph for this was being bought and I can't tell whether that purchase went through, so its frame is left empty." });
              else aNotAdded.push({ kind: "photo", name: x.describe.slice(0, 120), why: "photo-not-made", msg: "The photograph \u201c" + x.describe.slice(0, 120) + "\u201d couldn't be made, so its frame on the page is left empty." });
            }
            // ── AND THE EMPTY FRAMES THIS CHANGE REALLY ADDED (2026-09-17) ──
            //
            // `countImageSlots` counts `@@IMG:` TOKENS, and this step's own
            // directive forbids tokens — so on the addon path it answered 0 on
            // every obedient run and `photoNote` never once fired. Its own
            // comment is the reason that matters: *"a NEW page that wants one
            // publishes with a placeholder and said nothing about it. The
            // customer is left looking at an empty frame with no way to know it
            // is theirs to fill."* Written for the build path, and the path
            // that ADDS pages is the one it never reached.
            //
            // ⚠ IT IS COMPUTED HERE, FROM WHAT SURVIVES, AND BOTH HALVES OF
            // THAT ARE CORRECTIONS (owner, 2026-09-17: *"Calculate newly added
            // frames from what actually survives the merge, matching files
            // consistently."*). It used to run above the sweep over
            // `aValid.pages` — what the writer RETURNED — with `aSrc` as the
            // before. Two things were wrong and each was measured:
            //
            //   · THE BEFORE WAS PAGES ONLY. `newEmptySlots` keys per file, so
            //     a component the site already has had no before at all and an
            //     UNCHANGED one carrying one empty frame was reported as one
            //     newly added frame. Measured: 1 against 0 on the same site.
            //   · THE AFTER WAS THE ANSWER, NOT THE PUBLICATION. A page the QR
            //     dependency withheld, or one the merge boundary refused, was
            //     still counted — frames on files nobody will be served.
            //
            // ONE READER NOW, NOT A SUM. After `applyImages` a token IS an
            // empty `src=""`, so the same reader counts a frame written as
            // asked and a token written against the ban; adding the old token
            // count here would report one frame twice. What it stops counting
            // is a token in an element with no `alt` — and that is right, not a
            // loss: the picture rung identifies a slot BY its alt text, so
            // promising one is the same mistake as the missing `src` this
            // round already fixed. `lintPages` reports that shape separately.
            //
            // AND AN UNREADABLE COMPONENT STORE TAKES COMPONENTS OFF BOTH
            // SIDES, never one. Nothing is written to `parts.json` while
            // `aPartsRead.ok` is false, so a symmetric omission is the exact
            // truth about what this change did; dropping them from the BEFORE
            // alone is the defect above, wearing the other hat.
            //
            // ⚠ AND THAT SYMMETRY NEEDS NO FLAG — `readSiteParts` answers
            // `parts: []` on EVERY `ok: false`, so both sides are already empty
            // when nobody could look. A first cut carried an `aPicParts` ternary
            // saying so; a sweep could not kill it, MEASURED through this route
            // over seven shapes it changed no answer, and the PAIR mutant could
            // not kill it either — there is no input on which it differs. Dead
            // by construction, so it is gone and this sentence is what it said.
            // `test/addon-route` drives the unreadable store and asserts 0.
            //
            // `|| aPartsRead.parts` IS NOT that, and stays: it is what makes the
            // AFTER *the whole site as this change leaves it* rather than *what
            // the model handed back*. It is numerically inert only because
            // `newEmptySlots` walks the AFTER alone — a property of another
            // module, asserted in `test/site-picture` for this line's sake — so
            // the day removals count, this stops being documentation and starts
            // being a wall.
            const aPicsWas = imageSources(aSrc, aPartsRead.parts);
            const aPicsNow = imageSources(aMerge.pages, aParts || aPartsRead.parts);
            const aSlots = newEmptySlots(aPicsWas, aPicsNow);
            // ── AND THE FRAMES THE PAGE DRAWS FROM A LIST (2026-09-19) ──────
            //
            // Owner, after run 51: *"Fix the mismatch between the gallery's
            // seven empty frames and the reply's 'one photo space.'"*
            //
            // MEASURED on the page that run published: `<SafeImage src="" …/>`
            // once and `<Gallery items={[…six…]}/>` once, so a visitor sees
            // SEVEN empty frames and `aSlots` answers ONE. `listFrames` reads
            // the six; `imageSlots` is right not to, and the note on that
            // function says why. **1 + 6 = 7**, driven against the real page.
            //
            // THE SAME PAIR, so one idea of before-and-after serves both
            // counters and a page the change did not touch contributes nothing
            // to either. Counted AFTER the sweep for `aSlots`' own reason: a
            // token is an empty `src=""` by then, and a frame this change
            // FILLED is not a space to warn anybody about.
            //
            // TWO NUMBERS, NEVER ONE. Summing them would fix the count and ship
            // a bigger claim than the one it replaced: `photoNote` offers to
            // FILL a slot, and nothing on this platform can fill one of these —
            // the picture rung addresses a `src` span and a list entry has
            // none. Each gets the sentence that is true of it.
            //
            // ⚠ AND IT ANSWERS A PAIR, NOT A NUMBER (2026-09-19). Owner:
            // *"don't treat runtime expressions as a positive lower bound. Use
            // wording without a number when the visible count cannot be
            // established."* `aListSlots` is the frames whose number is WRITTEN
            // DOWN; `aListMore` says there are also some a mapped array
            // decides, which may be six or none. Destructured here rather than
            // passed whole, because the reply carries two fields a browser
            // reads separately.
            const { n: aListSlots, more: aListMore } = newListFrames(aPicsWas, aPicsNow);
            // ── THE ADD STEP'S OWN REPAIR ROUND, handed to the spine's seam ──
            //
            // (owner, 2026-09-04: "try to fix it, if not fix, send as it is",
            // then "each path has a repair path"). The decision is
            // `addRepairRound` in site-add.mjs — the ADD step's own wording,
            // scoped to the pages THIS addition wrote — and the spine only
            // offers the seam. The clock is the job's own (`canRepair`), asked
            // before the model call; under a job the round's spend is reserve
            // #2, placed HERE, before the spine's publish gate, so everything
            // charged is charged before the commit point.
            let aRepairRound = null;
            const aTouched = [...(aMerge.added || []), ...(aMerge.changed || [])];
            // THE ROOM IS MEASURED, NOT ASSUMED (run 36, 2026-09-04). A fix
            // re-emits the file the page call just wrote, on the same model,
            // so what THAT call took — per page it wrote — is the measure of
            // what the fix will take. Run 36's fix ran to the 240 s quick-call
            // cap and was cut, the page shipping as it was at 747 s of 840
            // after four minutes the customer waited for nothing; asked this
            // way it is refused before a second is spent, by name, when the
            // room cannot hold it. Zero when nothing was measured, which is
            // the floor alone — a call is never refused for a number we do
            // not have.
            const aRepairNeedMs = aPagesWrote > 0 ? Math.round(aPagesMs / aPagesWrote) : 0;
            // AND THE VERSION THIS PUBLISH WILL ACTIVATE (stage 8), so the
            // migration record and the manifest name the same thing.
            const aAfterCompile = async ({ built, pages, langs, recompile, job, version }) => {
              const aClock = job && job.budget && typeof job.budget.canRepair === "function" ? job.budget : null;
              const room = !aClock || aClock.canRepair(aRepairNeedMs);
              aMark("repair", "start", {
                room, touched: aTouched.length, needMs: aRepairNeedMs,
                roomMs: aClock && typeof aClock.repairMs === "function" ? aClock.repairMs() : null,
              });
              // WHAT THE PUBLISHED BUILD SHOWED AS EACH ROUTE FIRST LOADED
              // (2026-10-13) is read after the repair round below: the
              // repaired build's own when it recompiled (`publishedTexts`).
              aRepairRound = await addRepairRound({
                report: built.render, pages, touched: aTouched, langs,
                // THE CALL IS CAPPED AT THAT ROOM, under the quick-call ceiling
                // `quickSend` keeps: `repairClock` holds back the second
                // compile as well as the two reserves, so a slow fix cannot
                // eat the recompile it exists to feed. Not `aQuick`, whose
                // clock holds back the reserves alone — right for every call
                // before the first compile, and what let run 36's fix run four
                // minutes into the room its own recompile needed.
                send: mappedSend(env, ownerSlug, "page", quickSend(env, "repair", repairClock(aClock))), model: aModels.quick, compile: recompile, room,
              });
              aMark("repair", aRepairRound.ran ? (aRepairRound.built ? "ok" : "fail") : "skip",
                { why: String(aRepairRound.why || aRepairRound.failed || ""), repaired: aRepairRound.repaired.length, refused: aRepairRound.refused.length });
              aRendered = publishedTexts(built, aRepairRound);
              aForms = publishedForms(built, aRepairRound);
              aSubmits = renderedSubmits(aRepairRound && aRepairRound.built ? aRepairRound.built.render : built.render);
              if (aJob && aRepairRound.usage.length) {
                try { aRepairRound.charged = Number(await aCharge(pageCredits(...aRepairRound.usage), 2)) || 0; }
                catch (e) { aRepairRound.charged = 0; console.error("addon repair charge failed:", ownerSlug, e && e.message); }
              }
              // ── ONE MORE ROUND FOR WHAT THE CHECK FOUND MISSING (2026-10-25) ──
              //
              // Each judged need is checked against the compiled pages; a page
              // and a table that never meet are handed back ONCE to the page
              // writer with the gap as the reason, recompiled and checked again
              // (`requirementRetryRound`). Never a second round. Its usage is
              // its own reserve (#7), placed once per job like every other.
              {
                const aCur = aRepairRound.ran && aRepairRound.built ? { built: aRepairRound.built, pages: aRepairRound.pages } : { built, pages };
                const aSiteOf = (pg, b) => ({
                  pages: routeCode(routedSources(pg || [], aParts || (aPartsRead.ok ? aPartsRead.parts : []) || [])),
                  forms: renderedForms(b && b.render), submits: renderedSubmits(b && b.render),
                  drawn: new Set(renderedTexts(b && b.render).keys()), spec: aSpec,
                });
                try {
                  aReqRetry = await requirementRetryRound({
                    needs: judgedNeeds(aReq), site: aSiteOf(aCur.pages, aCur.built), pages: aCur.pages, siteOf: aSiteOf,
                    send: mappedSend(env, ownerSlug, "page", quickSend(env, "repair", repairClock(aClock))), model: aModels.quick, compile: recompile,
                    room: !aClock || aClock.canRepair(aRepairNeedMs),
                  });
                } catch (e) { aReqRetry = null; console.error("addon requirement retry failed:", ownerSlug, e && e.message); }
                if (aReqRetry) {
                  aMark("retry", aReqRetry.ran ? (aReqRetry.built ? "ok" : "fail") : "skip", { why: String(aReqRetry.why || ""), retried: aReqRetry.retried.length, mended: aReqRetry.mended.length, still: aReqRetry.still.length });
                  if (aReqRetry.built) {
                    aRendered = renderedTexts(aReqRetry.built.render);
                    aForms = renderedForms(aReqRetry.built.render);
                    aSubmits = renderedSubmits(aReqRetry.built.render);
                  }
                  if (aJob && aReqRetry.usage.length) {
                    try { aReqRetry.charged = Number(await aCharge(pageCredits(...aReqRetry.usage), 7)) || 0; }
                    catch (e) { aReqRetry.charged = 0; console.error("addon requirement retry charge failed:", ownerSlug, e && e.message); }
                  }
                }
              }
              const aSwap = aReqRetry && aReqRetry.built ? { built: aReqRetry.built, pages: aReqRetry.pages }
                : aRepairRound.ran && aRepairRound.built ? { built: aRepairRound.built, pages: aRepairRound.pages } : null;
              // ── THE SCHEMA, LAST BEFORE THE GATE (stage 8, 2026-09-05) ────
              //
              // The compile has passed and the render check has spoken; the
              // repair round's reserve (#2) is placed. This is the last moment
              // before the spine's gate, and the FIRST at which a table is
              // worth making: everything that could refuse for the customer's
              // own reasons (a page that will not bundle, a ledger that said
              // no) has answered. A LEDGER THAT REFUSED SKIPS THE APPLY — the
              // spine's own third ask refuses the publish next, and a schema
              // applied for a publish that cannot ship is run 33 by another
              // road. A refused apply is answered as the seam's refusal: the
              // spine returns it before staging, nothing activated, the
              // record `failed`, the route says it is ours.
              if (aApplyBackend) {
                if (aCharges.refused() > 0) { aMark("schema", "skip", { why: "unbilled" }); return aSwap; }
                // THE DATABASE, MADE ONLY NOW THAT THE PAGES COMPILED (2026-10-23).
                if (aProvDeferred) {
                  const run = aProvDeferred;
                  aProvDeferred = null;
                  aMark("provision", "start", { after: "compile" });
                  const pe = await run();
                  if (pe) { aProvLate = pe; return { refuse: { error: "provision", detail: String((pe && (pe.detail || pe.message)) || ""), ours: true } }; }
                }
                const ap = await aApplyBackend(version);
                if (!ap.ok) return { refuse: { error: "schema", detail: ap.detail, ours: true } };
                // THE STORED COVERAGE, RE-WRITTEN OVER THE APPLIED RESULT — the
                // pageless path's twin, and the reason it is here rather than
                // beside the reply: this seam is the only place on the page
                // path where the apply has landed and the request is still in
                // hand. Never fatal; a record is never worth a publish.
                await aSaveAnswer();
              }
              return aSwap;
            };
            // ── A PAGE THAT DID NOT COMPILE GETS ONE REPAIR ROUND (2026-10-23) ──
            //
            // The seam above runs only after a successful compile, so a
            // misspelt import (`saltmarsh-and-sparrow`, vite) ended the add-on
            // with no repair. The spine offers the compiler's message here,
            // once; the writer fixes only the pages this addition wrote, the
            // same clock as the seam's round, and its spend is reserve #6.
            let aCompileRepair = null;
            const aOnCompileFail = async ({ error, pages, recompile, job }) => {
              const aClock = job && job.budget && typeof job.budget.canRepair === "function" ? job.budget : null;
              const room = !aClock || aClock.canRepair(aRepairNeedMs);
              aMark("compile-repair", "start", { room, touched: aTouched.length });
              aCompileRepair = await compileRepairRounds({
                error, pages, touched: aTouched, room: () => !aClock || aClock.canRepair(aRepairNeedMs),
                send: mappedSend(env, ownerSlug, "page", quickSend(env, "repair", repairClock(aClock))), model: aModels.quick, compile: recompile,
              });
              aMark("compile-repair", aCompileRepair.ran ? (aCompileRepair.built ? "ok" : "fail") : "skip",
                { why: String(aCompileRepair.why || aCompileRepair.failed || ""), repaired: aCompileRepair.repaired.length });
              // CHARGED ONLY WHEN IT FIXED THE BUILD: a failed addition costs nothing.
              if (aCompileRepair.built && aCompileRepair.usage.length) {
                try { aCompileRepair.charged = Number(await aCharge(pageCredits(...aCompileRepair.usage), 6)) || 0; }
                catch (e) { aCompileRepair.charged = 0; console.error("addon compile repair charge failed:", ownerSlug, e && e.message); }
              }
              return aCompileRepair.built ? { built: aCompileRepair.built, pages: aCompileRepair.pages } : null;
            };
            // ── THE TRANSLATION CALLS' SPEND, THE REPAIR ROUND'S SHAPE (run 39) ──
            // Under a job the spine hands the usage here the moment its
            // translations are in hand — before the compile and the gate, as the
            // round's own #2 is — and it is reserved as sequence #3; the RPC is
            // idempotent per sequence and asks no order of them. Synchronously
            // the usage joins the one collect below, so the sync bill still
            // rounds once. What landed rides `aCost` on the reply.
            const aLangUsage = [];
            let aLangCharged = 0;
            const aChargeLangs = async (usage) => {
              aLangUsage.push(...usage);
              if (!aJob) return 0;
              const got = Number(await aCharge(pageCredits(...usage), 3)) || 0;
              aLangCharged += got;
              return got;
            };
            aMark("publish:1", "start", { pages: aMerge.pages.length, parts: aParts ? aParts.length : 0 });
            if (aJob && aJob.progress) aJob.progress.mark("publish", addonPublishFacts(aPendingPhotos, { draft: draftFirst(env) }));
            const aPub = await recompileAndPublish(env, {
              slug: ownerSlug, pages: aMerge.pages,
              label: versionLabel({ revise: true, changeNote: aInstruction }),
              parts: aParts || undefined,
              // THE JOB AND THE TRACE, the edit route's own two. The job is
              // what the spine's publish gate reads — lease, cancel, billing
              // — and without it a queued addon would publish past every one
              // of them and finalize as if none existed; the trace is what
              // the spine's own marks land on.
              trace: editTrace, job: aJob,
              // AND THE ROUTE'S READER OF ITS REFUSALS, so the spine's three
              // asks read the same count the route does.
              charges: aCharges,
              // WHICH SCREEN SIZES THE ADDITION IS FOR (2026-10-24): the
              // spine's layout guard, as an edit's publish has it.
              devices: aDevices,
              // THE ADD STEP'S REPAIR ROUND, at the spine's seam — see above.
              afterCompile: aAfterCompile,
              // AND ITS ONE ROUND FOR A PAGE THAT DID NOT COMPILE, above.
              onCompileFail: aOnCompileFail,
              // THE PICKER'S MODELS, for the spine's translation call (run 38).
              models: aModels,
              // AND THE FUNNEL THAT CALL IS CHARGED THROUGH (run 39), above.
              charge: aChargeLangs,
              // THE HELD BACKEND CHANGES (draft-first): this revision's, with its pages.
              held: aWriter.hold,
            });
            aMark("publish:1", aPub && aPub.ok ? "ok" : "fail", { error: aPub && aPub.error, repair: aRepairRound ? (aRepairRound.why || aRepairRound.failed || aRepairRound.repaired.length) : undefined });
            // A FAILED COMPILE LEAVES THE LIVE SITE ALONE. Not escalated: the
            // rung above would rewrite pages the owner never asked about, to
            // recover from a page this one wrote.
            if (!aPub.ok) {
              // THE OLD LOOK GOES BACK, so a code or a scene nothing published
              // does not sit in the stored look waiting for the next publish.
              //
              // ⚠ AND A REVERT THAT FAILED IS SAID (2026-09-26). It was logged
              // and the reply went on to call the site untouched — the edit
              // route's own defect, one route over: the addition stays saved and
              // the next publish of any kind ships it. This route's own comment
              // above the store names the risk ("a restore … can itself fail").
              let aKept = false;
              // NOT PUT BACK BY A JOB THAT LOST THE SITE'S TURN (2026-10-15): the
              // job that took it may have written the config since; kept, said.
              if (aStored && !(await turnStillMine(env, ownerSlug, aJob))) { aKept = true; console.error("addon look revert skipped: the turn is no longer this job's", ownerSlug); }
              else if (aStored) {
                const back = await patchSiteConfig(env, ownerSlug, adb, { look: aLook, css: aCss }, jobFence(env, aJob));
                if (!back.ok) { aKept = true; console.error("addon look revert failed:", ownerSlug, back.error); }
              }
              // ── WHAT STANDS IN THE DATABASE IS SAID (stage 8) ──────────────
              //
              // Three shapes. The apply itself refused (`schema`): the seam
              // answered before staging, the record is `failed`, nothing
              // activated — ours, 502. The apply landed and the publish after
              // it did not (the gate, the staging, the activation): the record
              // goes `applied_without_page` and its sentence leads the reply,
              // because the tables are live and "your site is untouched" would
              // be a lie about the database — the site's PAGES are what they
              // were. No apply ran (the compile failed before the seam): no
              // record, the compile sentence alone, as before.
              // A DATABASE THAT COULD NOT BE MADE AT THE SEAM is said as the
              // provision's own failure, never as a compile.
              if (aPub.error === "provision" && aProvLate) return aProvFailed(aProvLate);
              const aSchemaFail = aPub.error === "schema";
              // HELD, NOT APPLIED (draft-first on a published site, 2026-10-16):
              // the schema went to the job's held journal, which a failed save
              // never references — nothing reached the database.
              const aHeldOnly = !!(aWriter && aWriter.holding);
              if (aMigration && !aSchemaFail && aMigration.status === "pending") {
                aMigration = (await settleSiteMigration(env, ownerSlug, aMigJob, aHeldOnly ? "discarded" : "applied_without_page", { publish: { ok: false, error: String(aPub.error || ""), detail: String(aPub.detail || "").slice(0, 200) } })) || aMigration;
              }
              // ── WHAT IT LEFT BEHIND, FROM ITS OWN EVIDENCE (2026-10-06) ─────
              //
              // Codex, on 08b9a657: a publish that failed after the apply was
              // told "Nothing was added", under the sentence saying the tables
              // were made. THE APPLY'S OWN FLAG, never the record's state alone:
              // a settle that could not be written leaves the record `pending`
              // with its tables live (`settleSiteMigration` answers null and the
              // pending entry stands). `aApplied` is set after the apply's last
              // throwing statement, so it is true exactly when it landed; a
              // record filed and never landed is an apply that threw part-way —
              // the engine runs one statement at a time, so what went in is not
              // known — and no record is no apply (the compile failed before the
              // seam, or the ledger refused it there).
              const aDb = aHeldOnly ? "none" : aApplied ? "applied" : aMigration ? "unknown" : "none";
              // SOMETHING OUTSIDE THE PUBLISH CHANGED — the database's changes,
              // or a database made for the site — so neither "nothing was
              // changed" nor "untouched" is said: each sentence says what did
              // not happen (`compileMsg`'s `landed`), and the outcome what did.
              const aLanded = aDb !== "none" || aProvisioned;
              return aFail({
                ok: false, error: aSchemaFail ? "schema" : lostOr(aPub, "compile"), cost: 0,
                ...(aSchemaFail ? { ours: true } : {}),
                msg: aSchemaFail
                  ? ADDON_SCHEMA_FAIL_MSG + (aKept ? KEPT_CHANGE_NOTE : "")
                  : [migrationNote(aMigration), compileMsg(aPub, aKept
                    ? "That addition didn't compile, so your live site wasn't changed — try describing it differently."
                    : aLanded
                      ? "That addition didn't compile, so it wasn't published — try describing it differently."
                      : "That addition didn't compile, so your site is untouched — try describing it differently.", aLanded, aKept)].filter(Boolean).join(" "),
                detail: aPub.detail,
                migration: migrationSummary(aMigration),
              }, aSchemaFail ? 502 : 422, { database: aDb, saved: aKept, photos: (aPhotos && aPhotos.made) || 0 });
            }
            // THE RECORD IS `applied` ONCE THE PAGE IS LIVE (stage 8), naming
            // the version that went live — the spine's own answer, the same
            // id the manifest carries.
            if (aMigration && aMigration.status === "pending") {
              aMigration = (await settleSiteMigration(env, ownerSlug, aMigJob, "applied", { version: aPub.version || aMigration.version || null, publish: { ok: true, files: aPub.files } })) || aMigration;
            }

            // THE SYNCHRONOUS CHARGE: after the publish, on measured usage,
            // from the one price table — the same one bill, taken now because
            // a compile that failed above cost nothing. A job reserved it
            // before the publish (see `aBill`) and is not charged twice.
            // THE REPAIR ROUND'S SPEND RIDES THE SAME BILL: synchronously it
            // joins this one collect (one rounding, `pageCredits` is variadic
            // for exactly this); under a job the hook already reserved it as
            // sequence #2 before the gate and recorded what landed.
            // ── WHICH REQUESTED PAGES ARE NOT ON THE SITE (2026-09-14) ────
            //
            // Owner: *"Compare the requested pages with what actually survives
            // generation, compilation, and publication … A planned file is the
            // expectation, not proof of delivery."*
            //
            // Computed HERE, below the publish, and that position is the whole
            // point: `aMerge.added`/`changed` is what was compiled and shipped,
            // so a page the writer never returned, one salvage replaced, and
            // one the merge refused all read as missing — where the planned
            // list said all three were coming. `aFold.files` has carried the
            // requested names since the fold was written and had ZERO readers
            // until this line; the comparison is by file name because that is
            // what both sides really hold.
            // THE ROUTES THAT WERE REALLY COMPILED AND SHIPPED, which is the
            // same list `missingPages` is decided against and is set here for
            // the same reason: below the publish, so it can never describe a
            // page that was planned. It is what makes `page` a kind the
            // reconcile can answer `absent` for — before this line `aShipped`
            // is null and a requirement handed to `page` reads `unverified`,
            // which is the honest answer while nothing has been published.
            //
            // …AND IT IS THE LIST `aGone`, COMPUTED ABOVE THE BILL (2026-09-17)
            // rather than a second call here. `aMerge` is settled before
            // either line, so the two can only ever be the same answer — and
            // the QR dependency check needs it before anything is stored,
            // where this needs it after the publish for `aShipped`. One
            // computation with two readers, never one computation each.
            aMissing = aGone;
            // ROUTES, NOT FILES, AND DERIVED FROM THE PUBLICATION — never from
            // the plan (run 53, 2026-09-20).
            //
            // THIS WAS `aWanted` LESS `aMissing`, and the argument for it was
            // that the two lists are complements by construction so they cannot
            // disagree about a page. True, and both of them are about what was
            // PLANNED: `aWanted` is the `page` KIND designer's own answer. When
            // that designer answers nothing — which is correct and ordinary, a
            // connection is not pageless so the PAGE CALL writes the page
            // instead — `aWanted` is empty, so this was empty, on a change that
            // really published `/rates`.
            //
            // WHAT THAT COST, measured on run 53: with no page in the applied
            // inventory, `implementationOf` fell past its "there is output but
            // no association, so answer `unknown`" branch to the one below it
            // and answered `absent` → `missing` → *"Still to do: A visitor can
            // see what one pound is worth…"*, about a page that was live and
            // rendering the real numbers. The most actionable line in the reply,
            // wrong, in the safe-looking direction.
            //
            // THE PUBLICATION IS `aFilesOut` — `aMerge.added` + `aMerge.changed`,
            // the files that were really compiled and shipped, which is already
            // the list `missingPages` is decided against on the line above. So
            // the two readers still cannot disagree; they now disagree about
            // nothing because they read the SAME artifact rather than because
            // one is defined as the other's complement.
            //
            // AND THE PLAN IS KEPT, SEPARATELY AND DELIBERATELY: `aWanted` is
            // still what `aGone`/`aMissing` is computed from, because a page
            // that was asked for and is not there can only be found by comparing
            // the plan with the publication. Existence comes from the
            // publication; absence comes from the plan. Two questions, two
            // sources, and collapsing them is what produced both halves of this
            // defect.
            //
            // EXISTENCE IS NOT VERIFICATION, and nothing here claims otherwise.
            // A route in this list means the file compiled and shipped. Whether
            // it does what a requirement asked is a different question, answered
            // by `implementationOf`, which requires the requirement to NAME its
            // page (`{kind:"page", name:"/rates"}`) — with no such association it
            // answers `unknown`, so publishing any page still satisfies no page
            // requirement. `checked` stays empty for `page` as for every other
            // kind.
            // A COMPONENT IS NOT A ROUTE, and `routeOf` cannot say so — it
            // answers `/-parts/photo-wall` for `-parts/photo-wall.tsx`, measured.
            // Without this filter a section this change wrote would arrive as a
            // page the site has, and `appliedFacts` would record an inventory a
            // visitor can never reach. `PART_DIR` is the one definition.
            //
            // ⚠ IT IS A BELT AND CANNOT FIRE TODAY, and the first version of
            // this comment claimed the opposite — that "the publication carries
            // both since the band split". A mutation sweep called it: cutting
            // the filter survived every guard, so it was MEASURED rather than
            // argued. `aFilesOut` is `aMerge.added` + `changed`, and `aMerge` is
            // `mergeAddonPages` over the PAGES alone — components are merged
            // separately into `aParts`. Driven through the real route, a change
            // that writes `tide-chart` answers `changed: ["index.tsx"]` with the
            // component in the container's own `parts` list, so no entry here
            // contains `-parts/` and the inventory is identical either way.
            //
            // KEPT DELIBERATELY, and the redundancy is said out loud because a
            // sweep cannot say it and the next session deletes what nothing
            // appears to need: the day components join this list — which is one
            // edit to `aFilesOut` — the defect comes straight back. The PAIR is
            // swept (parts added AND the filter cut) and DIES, so this line is
            // guarded rather than merely explained.
            aShipped = [...new Set(
              (Array.isArray(aFilesOut) ? aFilesOut : [])
                .map((f) => String((typeof f === "string" ? f : (f && f.path)) || ""))
                .filter((f) => f && !f.includes(PART_DIR))
                .map((f) => routeOf(f))
                .filter(Boolean),
            )];
            if (aMissing.length) {
              // A PAGE THAT DID NOT SURVIVE IS THE PAGE STEP FAILING, and the
              // coverage has to hear it: a requirement handed to `page` cannot
              // be covered by a page that is not there.
              aFailedKinds.add("page");
              aMark("pages", "missing", { n: aMissing.length });
            }
            // ── WHICH ROUTES THIS CHANGE REALLY PUT A PICTURE ON (2026-09-19) ─
            //
            // A photograph's identity is its PLACEMENT, so this is what a
            // `photo` requirement resolves against. Computed HERE because it is
            // the first moment both halves exist: `aMerge` is settled, so what
            // survived is known, and `buySitePhotos` has run, so a bought url
            // is really in the source.
            //
            // READ OFF THE PUBLICATION, never off the writer's answer — the
            // same correction `newEmptySlots` took. A page the QR dependency
            // withheld or the merge boundary refused is not a page anything
            // landed on, and counting it would claim a picture on a file no
            // visitor will ever see.
            //
            // BOUGHT AND REUSED ARE TOLD APART BY WHAT THE SITE ALREADY HAD,
            // because that is the only thing that can distinguish them: a url
            // the provider minted in this run cannot be in `aSrc`, and a url
            // the owner already paid for must be. `imageSources` is the ONE
            // reader of "the files a photograph can be in", so components count
            // exactly as pages do.
            {
              const had = new Set();
              for (const p of imageSources(aSrc || [], aPartsRead.parts || [])) {
                for (const u of imageRefs(p && p.source, ownerSlug)) had.add(u);
              }
              // ⚠ TWO DEFECTS IN ONE LINE, AND FIXING EITHER ALONE IS NOT A FIX
              // (2026-09-20).
              //
              // (1) `aMerge.parts` DOES NOT EXIST. `mergeAddonPages` answers
              // `{ok, pages, added, changed, removed, kept, reverted}` — read
              // its one success return — so this argument was `undefined` on
              // every run and the component half of the site was invisible to
              // everything below. Every OTHER reader on this path already used
              // `aParts || aPartsRead.parts`, which is what this uses now.
              //
              // (2) AND A COMPONENT'S FILE PATH IS NOT A ROUTE. `imageSources`
              // gives a component its real path so `lintPages` can name files;
              // run through `routeOf` that is `/-parts/photo-wall`, an address
              // no visitor can open and no requirement can name. MEASURED after
              // fixing (1) alone: the photograph was still reported missing,
              // now filed under a pseudo-route instead of nowhere.
              //
              // `routedSources` IS BOTH HALVES. A component's routes are the
              // routes of the pages that import it, transitively, so a picture
              // in a nested component is on the page that shows it and one in a
              // component nobody imports is on no route at all — which is what
              // stops a requirement about `/gallery` being answered by an image
              // sitting in a file the site never renders.
              const live = routedSources(aMerge.pages || [], aParts || aPartsRead.parts || []);
              const byRoute = new Map();
              for (const p of live) {
                for (const u of imageRefs(p && p.source, ownerSlug)) {
                  for (const r of (p && p.routes) || []) {
                    const at = byRoute.get(r) || { route: r, bought: false, reused: false };
                    if (had.has(u)) at.reused = true; else at.bought = true;
                    byRoute.set(r, at);
                  }
                }
              }
              // ⚠ ONLY THE ROUTES THIS CHANGE TOUCHED. A page it never wrote
              // shows whatever it always showed, and naming it here would let a
              // claim about a picture be answered by one the site has had for
              // months — which is `existingFacts`' job and not this one's.
              const touched = new Set([...(aMerge.added || []), ...(aMerge.changed || [])]
                .map((f) => routeOf(f)).filter(Boolean));
              aPhotoMade = [...byRoute.values()].filter((x) => touched.has(x.route));
              // ⚠ AND WHETHER THIS INVENTORY IS ONE. A component whose placement
              // could not be established carries its pictures to a route this
              // cannot name, so the enumeration above is short by an unknown
              // amount — which is what `aReportable` reads to stop `absent`
              // being said about a kind nobody finished counting.
              aPhotoUnsure = live.some((p) => ((p && p.maybeRoutes) || []).length
                && imageRefs(p && p.source, ownerSlug).size > 0);
              // ── AND WHICH REQUESTED PHOTOGRAPH IS REALLY THERE (2026-09-19) ─
              //
              // Owner: *"Preserve explicit request-to-result association
              // through generation and placement. Another photograph on the
              // same route must not satisfy the failed request."*
              //
              // REPRODUCED THROUGH THIS ROUTE BEFORE ANYTHING WAS TOUCHED:
              // generation failed, the page writer put a photograph the site
              // already owned on the new /gallery page, and the requirement
              // claiming *"a new photograph of the bakery is on the gallery
              // page"* resolved `found` → `unverified` → *"I've set that up"* —
              // in the same reply as `pictureNote` saying the photographs could
              // not be made. One picture, two opposite sentences.
              //
              // THE CAUSE IS THAT `aPhotoMade` IS AN INVENTORY AND A CLAIM IS
              // ABOUT A REQUEST. Both are honest and they answer different
              // questions: the list above says what the route really shows, and
              // a picture being there says nothing about whether it is the one
              // that was asked for. So the inventory is left exactly as it is —
              // what this adds is the second question.
              //
              // THE CHAIN IS request → token → url → file → route, and every
              // link already existed but the middle one was never carried out:
              // `imageDirective` writes the describe INTO the token,
              // `buySitePhotos` now reports which token got which url, and the
              // publication says which file holds it. `shotKey` is the ONE
              // normalisation, asked of both ends.
              //
              // EVERY REQUEST, NOT ONLY THE AFFORDABLE ONES. A shot the balance
              // cut before the writer ever saw it is still a picture the
              // customer asked for and has not got — the reply's own credits
              // clause says WHY, and this says THAT.
              //
              // THE LIMIT, STATED: the join is the token's own words, so a
              // writer that paraphrases one has bought a different picture and
              // its request reads lost. That is the conservative direction, and
              // it is what the directive already demands in as many words
              // (*"write each token VERBATIM — a word changed is a different
              // picture bought"*), so being wrong here costs a sentence
              // inviting the customer to look.
              const rid = (v) => pageId(v).toLowerCase();
              const boughtAt = new Map();
              for (const b of (aPhotos && Array.isArray(aPhotos.bought)) ? aPhotos.bought : []) {
                if (b && typeof b.key === "string" && typeof b.url === "string" && !boughtAt.has(b.key)) boughtAt.set(b.key, b.url);
              }
              // WHERE EACH URL REALLY IS, off the same `live` the inventory
              // reads — so "it was bought" and "it is on that page" are two
              // readings of one publication and cannot come apart.
              // AND THROUGH THE SAME ASSOCIATION, so a picture requested for
              // `/gallery` and written into a component `/gallery` renders
              // counts as landed, while the same picture in a component only
              // `/about` uses does not. Finding an image SOMEWHERE is never the
              // question this loop asks.
              // ⚠ AND A PLACEMENT NOBODY COULD ESTABLISH IS ITS OWN MAP
              // (2026-09-20). Owner: *"An unused import must not establish
              // placement. Where placement cannot be established, preserve
              // uncertainty."* `routes` is what a visitor on that page really
              // sees; `maybeRoutes` is a component the page imports and may
              // reach some way no reader of the source can follow. Folding the
              // second into the first is the reported defect; folding it into
              // NEITHER map would make it a definite absence, which is the same
              // overclaim pointing the other way.
              const urlsAt = new Map();
              const maybeAt = new Map();
              for (const p of live) {
                const urls = imageRefs(p && p.source, ownerSlug);
                for (const [key, into] of [["routes", urlsAt], ["maybeRoutes", maybeAt]]) {
                  for (const r0 of (p && p[key]) || []) {
                    const r = rid(r0);
                    if (!r) continue;
                    const set = into.get(r) || new Set();
                    for (const u of urls) set.add(u);
                    into.set(r, set);
                  }
                }
              }
              const lostAt = new Set();
              const landed = [];
              for (const s of (aFold && Array.isArray(aFold.photos)) ? aFold.photos : []) {
                const r = rid(s && s.page);
                if (!r) continue;
                const url = boughtAt.get(shotKey(s && s.describe));
                const at = urlsAt.get(r);
                // ⚠ EACH REQUEST ANSWERED ON ITS OWN, BY ITS OWN NAME
                // (corrected 2026-09-19). This loop already knew, per shot,
                // whether that shot's url is on that shot's page — and threw
                // the answer away for the ones that landed, keeping only the
                // ROUTES of the ones that did not. So two pictures on one page
                // shared one verdict: the bench generated, the oven refused,
                // and the requirement naming the bench blocked on the oven's
                // failure. The request identity is carried out now, and the
                // route half below is unchanged because it is what a COMBINED
                // requirement about both pictures is judged on.
                if (url && at && at.has(url)) { landed.push({ name: String(s.name || ""), route: r }); continue; }
                // ⚠ UNCERTAIN IS NEITHER LANDED NOR LOST, and it has to be its
                // own arm because the two below are both CLAIMS. Saying landed
                // would answer a request with a picture nobody can show is on
                // that page; saying lost would tell the customer a picture that
                // may well be there is missing. Falling through to neither
                // leaves the requirement `unknown` — *"nothing I can check says
                // either way"* — which is the true sentence.
                const maybe = maybeAt.get(r);
                if (url && maybe && maybe.has(url)) continue;
                // ⚠ THE WALL FIRES ONLY WHERE SOMETHING ELSE WOULD ANSWER FOR
                // IT, and that is the owner's sentence turned into a condition:
                // *"another photograph on the same route must not satisfy the
                // failed request"*. A page carrying no photograph at all is
                // already `absent` to the implementation reader, which earns
                // the better sentence — *"Still to do: the gallery page shows a
                // photograph"* — and naming it here would trade that for the
                // vaguer dependency clause on the commonest failure there is.
                //
                // OFF THE PUBLICATION, SO IT COVERS BOTH HAYSTACKS AT ONCE.
                // `live` is every file this site will serve, so a picture the
                // writer reused on a new page (`appliedFacts`) and one the site
                // has had on that page for months (`existingFacts`) are the
                // same reading — which is what makes this the one wall that
                // beats both.
                if (at && at.size) lostAt.add(r);
              }
              // A PHOTOGRAPH OF THE SITE'S OWN (2026-10-02) is answered the
              // same way, by its own address on its own page: nothing was
              // bought, so there is no token to join, and the address IS the
              // request. `photosLanded` already refused a page without it, so
              // this reads the publication rather than trusting that wall.
              for (const s of (aFold && Array.isArray(aFold.reuse)) ? aFold.reuse : []) {
                const r = rid(s && s.page);
                const at = r ? urlsAt.get(r) : null;
                if (at && typeof s.src === "string" && at.has(s.src)) landed.push({ name: String(s.name || ""), route: r });
              }
              aPhotoShots = landed;
              aPhotoLost = [...lostAt];
              if (aPhotoLost.length) {
                // THE KIND AS WELL AS THE ITEMS, and the two cover different
                // claims: `aFailedItems()` is what a requirement NAMING the
                // route is judged on, and the kind is the only thing available
                // about one that names nothing.
                aFailedKinds.add("photo");
                aMark("photos", "lost", { n: aPhotoLost.length, asked: aFold.photos.length });
              }
              // ── AND WHICH ROUTES REALLY DRAW THE SCENE ──────────────────
              //
              // The same reading one field over, and for the same reason: a
              // scene is a STORED LOOK FIELD decided by the design step and a
              // `<Canvas>` written by the PAGE step, so "configured for one"
              // and "showing one" are two facts that come apart.
              //
              // ⚠ OFF THE PUBLICATION AND ACROSS BOTH FILE LISTS — AND UNTIL
              // 2026-09-20 THIS COMMENT ASSERTED THE OPPOSITE OF ITS OWN CODE.
              // It read *"`live` is `imageSources(aMerge.pages, aMerge.parts)`
              // … so a canvas in a component counts exactly as one in a page"*,
              // and that was false twice: the parts argument did not exist, and
              // a component's path is not a route. MEASURED: a `<Canvas>`
              // written into a component published, and `appliedFacts` emitted
              // `three` with `fails: ["onpage"]` — a TRUE claim recorded as
              // contradicted. It is true now because `routedSources` makes it
              // true, which is the difference between a comment and a wall.
              //
              // NOT FILTERED BY `touched`, unlike a photograph: the scene is
              // site-wide (`SINGLE_FIELDS` allows one), so a page this change
              // did not write carrying the canvas is still the scene being on
              // the site — the question `three` answers is whether the artifact
              // exists anywhere, not which page it moved to.
              //
              // …AND A CANVAS WHOSE PLACEMENT COULD NOT BE ESTABLISHED SETS
              // `aThreeUnsure` INSTEAD (2026-09-20), so `appliedFacts` says
              // neither `onpage` nor `fails: ["onpage"]`. A component a page
              // imports and might reach through a value is not a scene on the
              // page and is not a contradiction of one either.
              const drawn = live.filter((p) => sceneOn(p && p.source));
              aThreeOn = [...new Set(drawn.flatMap((p) => (p && p.routes) || []))].filter(Boolean);
              aThreeUnsure = !aThreeOn.length
                && drawn.some((p) => ((p && p.maybeRoutes) || []).some(Boolean));
              // ── AND WHERE EACH NEW CODE IS REALLY SHOWN (2026-10-03) ─────
              //
              // Owner: *"Report QR codes, scenes and other additions as
              // delivered only when the actual result supports that claim;
              // distinguish configuration saved from placement verified."* A
              // code is a STORED LOOK ENTRY and its figure is written by the
              // PAGE step, so — exactly as for the scene — "the site has the
              // code" and "a page shows it" are two facts that come apart, and
              // the reply said neither (the mixed-work audit's MW5). Read off
              // the same publication, with the one reader of "does this source
              // show this code" (`qrUnplaced`), asked against the whole list so
              // its index-keyed legacy arm still means what it means.
              {
                const codesNow = qrList(aMerged.qr);
                aQrShown = ((aLookMade && aLookMade.qrs) || []).map((c) => {
                  const on = new Set(), maybe = new Set();
                  for (const p of live) {
                    if (qrUnplaced(codesNow, [p]).includes(c.name)) continue;
                    for (const r of (p && p.routes) || []) if (r) on.add(r);
                    for (const r of (p && p.maybeRoutes) || []) if (r) maybe.add(r);
                  }
                  return { name: c.name, on: [...on], unsure: !on.size && maybe.size > 0 };
                });
              }
            }
            // THE RECORD IS RE-WRITTEN HERE WHETHER OR NOT A PAGE WENT MISSING
            // (2026-09-15), and until a sweep survivor found it this write was
            // inside the branch above. Every copy stored before this line was
            // composed while `aShipped` was still null — so on the ORDINARY
            // path, where every page shipped, the stored coverage said no page
            // was applied and a requirement naming one read `unknown` for the
            // record's own reason. The reply was right and the record was not,
            // which is the worse way round: the reply is read once and the
            // record is what anybody comes back to. This is the last moment
            // anything knows better, on both branches.
            // ── WHAT EACH COMPONENT PUT ON ITS PAGE, AND WHAT THE PAGE SHOWED
            // (2026-10-13, after run 144). The stored code before this change
            // (`aSrc`, the stored parts) against what shipped (the repaired
            // pages when a repair recompiled), each file read by the parser,
            // and the published build's own first-load text. Read once, here,
            // where both halves are known; the record below and the reply
            // after it both hear it. No parser, a read that failed or a route
            // the render check did not reach is `unread`, never a guess.
            try {
              const aShippedPages = aReqRetry && aReqRetry.built ? aReqRetry.pages : aRepairRound && aRepairRound.built && Array.isArray(aRepairRound.pages) ? aRepairRound.pages : aMerge.pages;
              const aWasParts = aPartsRead.ok ? aPartsRead.parts : [];
              aContent = componentEvidence({
                answers: aAnswers,
                added: addedByRoute({
                  before: routedSources(aSrc || [], aWasParts || []),
                  after: routedSources(aShippedPages || [], aParts || aWasParts || []),
                  parse: await tweakParser(),
                }),
                rendered: aRendered || new Map(),
              });
            } catch (e) { aContent = null; console.error("addon content evidence failed:", ownerSlug, e && e.message); }
            // THE BUILT SITE, FOR CHECKING EACH REQUIREMENT (2026-10-25,
            // feature-verify): no model call, nothing sent. A read that fails
            // leaves it null, and every requirement keeps its sentence.
            try {
              const aShippedPages2 = aReqRetry && aReqRetry.built ? aReqRetry.pages : aRepairRound && aRepairRound.built && Array.isArray(aRepairRound.pages) ? aRepairRound.pages : aMerge.pages;
              aVerifySite = {
                pages: routeCode(routedSources(aShippedPages2 || [], aParts || (aPartsRead.ok ? aPartsRead.parts : []) || [])),
                forms: aForms || new Map(),
                drawn: new Set(aRendered instanceof Map ? aRendered.keys() : []),
                spec: aSpec,
                submits: aSubmits || new Map(),
                // THE RULES EXERCISED (2026-10-25, `requirement-exercise.mjs`):
                // each judged table's rules tried with writes that are always
                // rolled back (`sqlRehearse`), on the live database only once the
                // apply landed and nothing is held in a draft. Unreachable: the
                // declared facts stand.
                exercised: adb && !(aWriter && aWriter.holding)
                  ? await exerciseTables(aSpec, judgedNeeds(aReq).flatMap((n) => n.carriers).filter((c) => c.startsWith("table:")).map((c) => c.slice(6).split(/[.:]/)[0]), { rehearse: (sql, params) => sqlRehearse(adb, sql, params) })
                  : new Map(),
              };
            } catch (e) { aVerifySite = null; console.error("addon requirement check failed:", ownerSlug, e && e.message); }
            await aSaveAnswer();
            const aRepairUsage = (aRepairRound && Array.isArray(aRepairRound.usage)) ? aRepairRound.usage : [];
            // THE RETRY ROUND'S USAGE (2026-10-25, `requirement-retry.mjs`), on the one bill.
            const aRetryUsage = (aReqRetry && Array.isArray(aReqRetry.usage)) ? aReqRetry.usage : [];
            const aRetryCharged = Number(aReqRetry && aReqRetry.charged) || 0;
            // AND THE TRANSLATIONS' (run 39): the same two roads — one rounding
            // synchronously, the spine's own reserve (#3) under a job.
            // THE PHOTOGRAPHS JOIN THE SYNCHRONOUS BILL AND RODE THEIR OWN
            // RESERVE UNDER A JOB (2026-09-17) — `pageCost` prices `images` at
            // the flat `IMAGE_USD`, so a picture and the tokens that placed it
            // round together exactly once here. `aPhotoBill` is the SAME
            // expression the job's reserve used, computed once beside the
            // purchase: two copies of "what the pictures cost" is how one road
            // ends up billing for a picture nobody got.
            // AND THE FILE PICKER'S CALL (2026-10-24): the job's `aBill` carried
            // it since 2266; this synchronous bill left it out.
            const aPickUsage = aPick ? aPick.usage : null;
            if (!aJob) aCost = await aCharge(pageCredits(...aDesignUsage, aGen && aGen.usage, aSeedUsage, ...aRepairUsage, ...aLangUsage, ...aRetryUsage, aPhotoBill, aPickUsage));
            else aCost += (Number(aRepairRound && aRepairRound.charged) || 0) + aLangCharged + aPhotoCharged + aRetryCharged;
            // ── PAY ONLY FOR WHAT LANDED (owner, 2026-10-24) ────────────────
            // A page or part the writer wrote that ended kept as it was or
            // standing in (`aPub.salvaged`) is given back its share of the
            // writer's spend (`landedBill`, by count), bounded by what that
            // charge took. Under a job by the writer's own reserve ref
            // (`credit_reverse`, bounded by that row; a founder's reserve wrote
            // no row and took nothing); synchronously through `credit_back`,
            // which never credits a founder, in its chunks of 10.
            const aWritten = [...(aValid.pages || []).map((p) => p && p.path), ...aFreshParts.map((p) => p && partKey(p.name))];
            const aSalvageBill = aPub.salvaged ? landedBill({
              writer: [aGen && aGen.usage],
              others: aJob ? (aFirstPlaced ? [aPick && aPick.usage] : [...aDesignUsage, aSeedUsage, aPick && aPick.usage])
                : [...aDesignUsage, aSeedUsage, ...aRepairUsage, ...aLangUsage, aPhotoBill],
              written: aWritten, salvaged: aPub.salvaged,
            }) : null;
            let aSalvageRefund = null;
            const aGive = aSalvageBill ? Math.min(aSalvageBill.refund, aJob ? aWriterTook : aCost) : 0;
            if (aGive > 0 && aJob) {
              const back = await reverseCredits(env, ou.id, aJob.id + "#" + (aFirstPlaced ? 4 : 1), "salvage", aGive);
              if (back.ok && back.refunded > 0) { aCost = Math.max(0, aCost - back.refunded); aSalvageRefund = { credits: back.refunded, files: aSalvageBill.hit }; }
              else if (!back.ok) console.error("addon salvage refund could not be made:", ownerSlug, aJob.id);
            } else if (aGive > 0) {
              let left = aGive, gave = 0;
              for (let i = 0; i < 1000 && left > 0; i++) { const ch = Math.min(10, left); if (await creditBack(env, ou.id, ch)) gave += ch; left -= ch; }
              if (gave > 0) { aCost = Math.max(0, aCost - gave); aSalvageRefund = { credits: gave, files: aSalvageBill.hit }; }
            }
            // THE PARSER THE MENU READER READS THE PUBLISHED PAGES WITH (2026-10-08,
            // Codex's review of 7fc7056d): null in a runtime with none, where every
            // link put in is told as not known.
            const aMenuParse = await tweakParser();
            const aMenuKept = menuLinksKept({ pages: aMerge.pages, linked: aLinked, parse: aMenuParse });
            aLinks = linkEvidence(aMenuKept);
            // A LEVEL THE ADDITION NEEDED ON A TABLE IT CANNOT MOVE (2026-10-25,
            // run 6): each requirement left unmet because an existing table's
            // read or write level is too narrow — named by the requirement's own
            // account, or a level the designer put there — is handed to the rules
            // step as a part of its own, scoped to that table (`accessHandTo`,
            // the request's `handCarved`). Read once the requirements are final.
            {
              const ht = accessHandTo(accessShortfalls(aSpec, aAccessDesigned), aReq, aInstruction, wordsIn, aSpec);
              for (const h of ht.handTo) {
                if (!aHeldOut.parts.includes(h.words)) aHeldOut.parts.push(h.words);
                if (!aHeldOut.handTo.some((x) => x.words === h.words && x.table === h.table)) aHeldOut.handTo.push(h);
              }
              if (ht.handTo.length || ht.told.length) aMark("add:access", "handed", { handed: ht.handTo.length, told: ht.told.length });
            }
            return Response.json({
              ok: true,
              // WHAT THIS TURN HELD BACK, for the reply's last sentence.
              // What was added, by kind, and what was set aside for another
              // rung — so the reply can say "the photograph needs its own ask".
              kinds: aAnswers.map((a) => a.kind), skipped: aSkippedSaid,
                frameHop: aFrameHop || undefined,
              notAdded: aNotAdded.length ? aNotAdded : undefined,
              // FRAMES PUBLISHED MARKED, EACH WAITING ON A PURCHASE NOBODY CAN
              // TELL YET (2026-10-09, round 5): the request holds the part on
              // them and fills each frame once its purchase is known.
              pendingPhotos: aPendingPhotos.length ? aPendingPhotos.map((x) => ({
                id: x.id, d: String(x.d).slice(0, 300), k: x.k, file: x.file, why: x.why,
                files: Array.isArray(x.files) ? x.files.slice(0, 12) : [], located: x.located !== false,
                ...(Array.isArray(x.unlocated) && x.unlocated.length ? { unlocated: x.unlocated.slice(0, 12) } : {}),
              })) : undefined,
              // EACH KIND SET ASIDE AND CARRIED ON IN ITS OWN WORDS (on `deferred`).
              setAside: aCarried.length ? aCarried.slice() : undefined,
              // A KIND WHOSE DESIGNER DECLINED, BESIDE THE ONES THAT DESIGNED
              // (2026-10-03, the mixed-work audit's MW6). Each designer was
              // asked for its kind and answered nothing; read before only when
              // EVERY kind declined, so beside a kind that was added it
              // vanished — in no field and no sentence.
              declined: aDeclined.length ? aDeclined.slice() : undefined,
              // THE EXTRAS A DESIGNER OFFERED, never among the requirements (2026-10-05).
              suggestions: aSuggested.length ? aSuggested.slice() : undefined,
              // WHAT THE CHANGE STILL OWES, AFTER THE WHOLE OF IT RAN. A
              // requirement handed to the page step IS covered here, because
              // the page step really ran — which is why this is computed from
              // the kinds that produced work rather than from the list alone.
              ...aCoverage(),
              added: aMerge.added, changed: aMerge.changed, removed: aMerge.removed, kept: aMerge.kept,
              // WHAT WAS PUT BACK, SETTLED NOW THAT EVERY STEP HAS RUN (2026-10-05,
              // run 101): a page the merge put back and the menu-link step then
              // linked is `restored`, never "left as it was".
              ...(() => {
                const aSettled = settleReverted({ reverted: aMerge.reverted, stored: aSrc, pages: aMerge.pages, linked: aLinked });
                return { reverted: aSettled.reverted, ...(aSettled.restored.length ? { restored: aSettled.restored } : {}) };
              })(),
              // EVERY MENU LINK THE MENU-LINK STEP PUT IN AND THE PUBLISHED
              // MENUS STILL CARRY, read by the menu reader (2026-10-08, run 107):
              // its reply said a later part asking for that link was "not
              // tried", beside the link it had itself added to nine menus. A
              // page whose menu cannot be read is `linkedUnsure`, never told
              // either way. Each absent when there were none.
              ...(() => {
                const aKept = aMenuKept;
                return { ...(aKept.kept.length ? { linked: aKept.kept } : {}), ...(aKept.unsure.length ? { linkedUnsure: aKept.unsure } : {}) };
              })(),
              // THE NEW WORDS AND THE SITE'S OWN PHOTOGRAPHS PLACED (2026-10-02),
              // each one found on its page by `wordsLanded` / `photosLanded`
              // before the publish — so the reply can say what was added from
              // what the page really holds. Absent when there were none, so
              // every other addition's reply is byte-identical.
              words: aFold.words.length ? aFold.words.map((w) => ({ page: w.page, words: w.words })) : undefined,
              ownPhotos: aFold.reuse.length ? aFold.reuse.map((p) => ({ page: p.page })) : undefined,
              // The design fields this addon gave the site (a `qr`, a `three`),
              // in the look lane's own word for it, so a reader can tell "added
              // a page" from "added a code to a page".
              moved: aLookMoved,
              // ── EVERY CODE AND THE SCENE THIS CHANGE ADDED, AND WHERE THEY
              //    REALLY ARE (2026-10-03, the mixed-work audit's MW5) ────────
              //
              // A code or a scene that was added was told nowhere: the answer
              // carried no field for either. Each now carries what was saved
              // (its words, what it opens or shows), the page it was asked for,
              // and the routes the publication really shows it on (`on`, read
              // by `qrUnplaced` and `sceneOn`), or `unsure` when only a
              // component a page may render carries it. Saved and not shown is
              // a code with an empty `on` — configuration, not placement.
              qrs: aQrShown && aQrShown.length ? aQrShown.map((q) => {
                const c = qrList(aMerged.qr).find((x) => x && x.name === q.name) || {};
                const asked = aAnswers.filter((a) => a.kind === "qr").flatMap((a) => (Array.isArray(a.value) ? a.value : [a.value]))
                  .find((v) => v && v.name === q.name);
                return { name: q.name, label: c.label || undefined, opens: c.points || undefined,
                  page: asked && typeof asked.page === "string" && asked.page ? asked.page : undefined,
                  on: q.on, unsure: q.unsure || undefined };
              }) : undefined,
              scene: aLookMade && aLookMade.three ? (() => {
                const asked = aAnswers.filter((a) => a.kind === "three").flatMap((a) => (Array.isArray(a.value) ? a.value : [a.value])).find((v) => v && typeof v === "object");
                return { about: typeof aMerged.three === "string" ? aMerged.three : (asked && asked.scene) || undefined,
                  page: asked && typeof asked.page === "string" && asked.page ? asked.page : undefined,
                  on: aThreeOn.slice(), unsure: aThreeUnsure || undefined };
              })() : undefined,
              photos: aSlots,
              // ── AND THE ONES NOTHING CAN FILL (2026-09-19) ────────────────
              //
              // `photos` is the frames the picture rung can address; this is
              // the frames a page draws from a list in its own source, which it
              // cannot. Both are empty picture boxes a visitor sees, and only
              // the first is a "space for a photo" anybody can offer to fill —
              // so they are two fields with two sentences rather than one
              // number that would make the count right and the promise wrong.
              // ALWAYS A NUMBER, exactly as `photos` is, and 0 is a real
              // answer. Sending it only when non-zero would make "this change
              // added no list frames" and "the Worker that answered predates
              // this field" the same absence — and the second is the one a
              // reader of a stored reply has to be able to tell.
              listPhotos: aListSlots,
              // …AND WHETHER THERE ARE ALSO SOME NOBODY CAN COUNT (2026-09-19).
              // A frame inside a `.map` is one object in the source and however
              // many the array holds on the page — INCLUDING NONE — so it is
              // neither an exact count nor a floor, and it rides as its own
              // fact rather than as a number. ABSENT WHEN THERE ARE NONE, so a
              // reply that existed before today is byte-identical and a browser
              // that never sees this field says exactly what it said.
              listPhotosMore: aListMore || undefined,
              // ── THE PICTURES THIS CHANGE REALLY BOUGHT (2026-09-17) ────────
              //
              // `pictures`, NOT `photos`: that field has meant "empty frames
              // left over" since it was written and the browser's `photoNote`
              // reads it as one — two numbers under one name is the wrong
              // number wearing a right one's name, which this repository has
              // paid for before. Absent when this change bought none, so every
              // addon that existed before today answers byte-identically.
              pictures: aPhotos && aPhotos.made ? aPhotos.made : undefined,
              // …AND THE SENTENCE, composed HERE and printed verbatim, exactly
              // as `keptPartsNote` and `coverNote` are. `imageNote` is the
              // BUILD PATH'S OWN composer — four outcomes render the same blank
              // frame and only one of them is a bug, and it is the one thing
              // that can tell them apart — so the addon says it in the same
              // words rather than in a second copy of that reasoning.
              //
              // AND A LIST THE BALANCE CUT TO NOTHING STILL SPEAKS. When
              // `imagesAffordable` refuses every shot there is no purchase at
              // all, so `aPhotos` is null and silence would read as "no
              // photograph was ever asked for" — which is the one thing the
              // customer knows is false. `{planned, made: 0, budget: 0}` is
              // that state written down, and `imageNote` answers it with the
              // credits sentence.
              // ⚠ AND THE FULL REQUEST TRAVELS SEPARATELY FROM WHAT WAS
              // AFFORDABLE (2026-09-17, owner: *"Carry the full requested photo
              // list separately from the affordable purchase list. A two-photo
              // request with credits for one must explain that one was omitted
              // because of the balance."*).
              //
              // REPRODUCED: two designed, credits for one, one bought — and the
              // customer heard *"Made 1 photograph for the site."* with nothing
              // about the second and no reason. `buySitePhotos` is TOLD WHAT TO
              // BUY, so its own `planned` is the cut list by construction and
              // cannot be the full one; this route is the only place holding
              // both numbers, so it is the place that says so.
              //
              // `unaffordable` IS HOW THE FULL LIST TRAVELS, and it NAMES THE
              // REASON because this line is what knows it: the one thing that
              // cuts `aFold.photos` down to `aShots` is `imagesAffordable`
              // against the balance read above, and no other clamp touches that
              // slice. `imageNote` must not infer it from `planned - budget`,
              // which inside the purchase is a different clamp with a sentence
              // of its own.
              //
              // ⚠ AND `planned` IS DELIBERATELY NOT OVERRIDDEN HERE. A first
              // cut passed `aFold.photos.length` into it, which reads as the
              // obvious other half of "carry them separately" and is a value
              // NOTHING ON THIS PATH READS — measured over 810 shapes, the one
              // branch that reads `planned` is the silence guard, and
              // `unaffordable` is non-zero on every route shape that could
              // reach it. A value computed and forwarded to no reader is this
              // repository's own most-recorded defect, and shipping one inside
              // the round that is about exactly that would be the wrong way
              // round. The distinction is carried where it is read — by
              // `unaffordable` here and by the trace mark's `planned`/`offered`
              // above.
              //
              // `frames` IS THE OBSERVATION, not a claim: the empty picture
              // frames this change really left, after the merge, the withheld
              // pages and the sweep. It is what keeps the zero-budget sentence
              // from promising a placeholder that no writer wrote — *"Do not
              // imply a placeholder exists unless one actually survived
              // publication."*
              pictureNote: imageNote(aFold.photos.length
                ? {
                  ...(aPhotos || { made: 0, budget: 0 }),
                  unaffordable: Math.max(0, aFold.photos.length - aShots.length),
                  frames: aSlots,
                }
                : null) || undefined,
              tables: aTables, altered: aAltered,
              // THE OTHER THREE TIERS (2026-09-03), what the engine really
              // made of each, a function that could not be created by name,
              // and whether
              // this addition gave the site its database. Absent when the
              // addon declared none, so an ordinary page addon's response is
              // byte-identical to before.
              functions: aFunctions.length ? aFunctions : undefined,
              functionErrors: aFnErrors.length ? aFnErrors : undefined,
              refusedRules: aRefused.length ? aRefused.map((r) => ({ table: r.table, feature: r.feature, rule: r.rule })) : undefined,
              provisioned: aProvisioned || undefined,
              // THE MIGRATION RECORD (stage 8): which job made what, and that
              // the page it was made for is live. Absent when the addon
              // declared no backend tier.
              migration: migrationSummary(aMigration),
              // What the seeding DID, the build response's own three fields:
              // rows per table, why a table was passed over, and whether the
              // net had to buy rows the designer omitted. Absent when the
              // addon declared no tables, so an ordinary page addon's response
              // is byte-identical to before.
              seeded: aSeeded ? aSeeded.seeded : undefined,
              // EVERY SKIP (2026-10-07): six were sent.
              seedSkipped: (aSeeded && aSeeded.skipped && aSeeded.skipped.length) ? aSeeded.skipped.slice() : undefined,
              seedTopUp: aSeedTopUp || undefined,
              unlinked: unlinkedPages(aMerge.pages, aMerge.added),
              // A COMPONENT THE SITE ALREADY HAD AND THE WRITER WAS NOT SHOWN
              // (2026-09-17). It returned a rewrite of one and we kept the
              // real file: the page still compiles and still works, and the
              // change the customer may have asked for did not land. Named
              // rather than dropped in silence, and absent when nothing was
              // refused, so an ordinary addon's response is byte-identical.
              keptParts: aKeptParts.length ? aKeptParts : undefined,
              // …OR ONE WE COULD NOT READ THE STORE FOR AT ALL. A separate
              // field because it is a separate fact and a separate sentence:
              // above, one named component was too long to carry; here nothing
              // was read, so nothing may be replaced and we do not even know
              // what the site has. The two are disjoint by construction.
              unseenParts: aUnseenParts.length ? aUnseenParts : undefined,
              // …AND THE SAME WALL FOR A PAGE (2026-09-17). A returned file for
              // a page the window could not carry is refused and the stored
              // one kept — the pages we could not SHOW are the pages we cannot
              // CHECK. Its own field beside the component one, because a page
              // and a component are different objects with different advice.
              keptPages: aRewrote.length ? aRewrote : undefined,
              // …AND THE SENTENCE, composed here and printed VERBATIM by the
              // browser — `coverNote`'s rule, for `coverNote`'s reason: the
              // decision is entirely the server's, since it is the only thing
              // that knows which sources fitted in the request.
              keptPartsNote: [
                (keptPartsNote(aKeptParts) || unseenPartsNote(aUnseenParts)),
                unseenPagesNote(aRewrote),
              ].filter(Boolean).join(" ") || undefined,
              // EVERY PROBLEM ABOUT WHAT WENT OUT (2026-10-07): four were sent,
              // and one about a page that was then held back or put back was
              // said beside a site that does not have it (`problemsShipped`).
              problems: problemsShipped(aProblems, (aValid.pages || []).map((p) => p && p.path), [...(aMerge.added || []), ...(aMerge.changed || [])]),
              // THE RENDER SENTENCE IS THE FINAL BUILD'S — the repaired one
              // when the round held — and the round's own sentence rides
              // beside it: a fix there was no time for, or one that did not
              // hold, each ending "published as it is". A fix that held says
              // nothing, the add step's own rule.
              files: aPub.files, render: aPub.render,
              // A PAGE THE COMPILE REPAIR FIXED (2026-10-23), a fact for the reply.
              compileRepaired: aCompileRepair && aCompileRepair.built ? { pages: aCompileRepair.repaired.slice(), rounds: aCompileRepair.rounds } : undefined,
              // FILES KEPT AS THEY WERE AND NEW ONES STANDING IN (2026-10-24).
              salvaged: aPub.salvaged || undefined,
              // WHAT THOSE FILES WERE NOT CHARGED (2026-10-24), already off `cost`.
              salvageRefund: aSalvageRefund || undefined,
              // WHAT THE VISUAL REVIEW DID (2026-10-24); its cost rode `aChargeLangs` into `aCost`.
              visualReview: aPub.visualReview || undefined,
              renderNote: [aPub.renderNote, addRepairNote(aRepairRound)].filter(Boolean).join(" ") || undefined,
              checks: aPub.checks, draft: aPub.draft,
              // THE SCREEN SIZES IT WAS FOR AND WHICH MOVED (2026-10-24), for the reply.
              devices: aPub.devices || undefined,
              // WHAT THE ROUND DID, for a reader that judges rather than reads:
              // the harness, and the owner-build log. Absent when no round ran.
              repair: aRepairRound ? {
                ran: aRepairRound.ran, why: aRepairRound.why, failed: aRepairRound.failed,
                repaired: aRepairRound.repaired, refused: aRepairRound.refused, routes: aRepairRound.routes,
              } : undefined,
              cost: aCost,
            });
}

/**
 * THE EDIT ROUTE'S OLD STEPS: the seventeen lanes' picker, the ladder of layers (data, rules, rename, nav, picture, logo, text, look, page), the one publish per message, the merged reply (after the agent block of `/api/site/<slug>/edit`).
 * worker.js lines 37390-43003 at 014a7cd31.
 */
export async function editRouteOldSteps() {

            // ── THE SEVENTEEN LANES ARE THE FRONT DOOR ────────────────────
            //
            // Owner, 2026-08-29: *"i need all the 17 lanes acting"*.
            //
            // `pick_lanes` used to sit INSIDE the look lane, so it could only
            // ever choose among the eight fields that lane edits itself; the
            // other nine were named, priced at zero and sent up the ladder. That
            // was honest about this module and wrong about the customer, who
            // asked for a change and got a fall-through — and unnecessary, since
            // six of the nine already had cheap, shipping implementations one
            // lane over. Nothing was missing but the wire.
            //
            // SO IT RUNS HERE, above the dispatch, and what it names decides
            // WHICH LAYER RUNS. A message about a photograph is the `picture`
            // layer's work however it arrived; about the primary button, `nav`;
            // about what the site stores, `rules`; about where the sections sit,
            // `page`. Each at that layer's own price, not at a rewrite's.
            //
            // ONLY WHEN THE ROUTER SAID `look`. Every other layer is a decision
            // `/api/site/route` already made with the whole message in front of
            // it, and overruling it here would be a second opinion with less to
            // go on — the "two lists of the same thing" shape, applied to
            // routing. `look` is the one answer that means "somewhere in the
            // site's design", which is exactly the question these lanes answer.
            //
            // ── AND IT IS `eLooking`, NOT A SECOND `eLayer === "look"` ──────
            //
            // Four guards window the LOOK LANE by finding `if (eLayer ===
            // "look")` and slicing to the next branch. A second copy of that
            // exact condition up here silently moves all four windows to this
            // block, so each then spans the whole dispatch chain — and a
            // mutation in the wrong half passes. That is this repo's recorded
            // overlapping-window trap, and the version of it that bites is
            // always the one you introduce yourself. One boolean, and the
            // lane's own condition stays unique in the file.
            // ── EVERY LANE THEY NAMED RUNS. NONE IS DROPPED ────────────────
            //
            // Owner, 2026-08-29: *"if a customer wants CSS to be changed and
            // also wants another of the seventeen one being changed, it could do
            // it too… it could do two steps at the same time, or three or four,
            // depending on how many the user wants"* — and, standing over all of
            // it, *"only change whatever the customer wants, don't change what
            // customer hasn't asked for"*.
            //
            // THIS TOOK THE FIRST DISPATCHED LANE AND THREW THE REST AWAY:
            //
            //     const send = pickedFields.map(laneLayer).find(Boolean);
            //     if (send) eLayer = send;
            //
            // So "darker footer and swap the shop photo" repointed the whole
            // route at `picture` and the stylesheet ask VANISHED — silently,
            // with the customer told the change was made. The reasoning at the
            // time was that a dispatched lane is a whole rung with its own model
            // call and its own publish, so running two would charge twice; that
            // is true and it is the wrong trade. Doing LESS than they asked and
            // reporting success is the failure this whole file is written to
            // avoid, and it is worse than publishing twice.
            //
            // A PLAN, THEN — one step per rung, in `LANE_FIELDS` order:
            //   * the eight that act here batch into ONE `look` step, because
            //     they already run in turn on one publish;
            //   * each dispatched lane is its own step on its own rung;
            //   * a lane that is not built yet is REPORTED rather than allowed
            //     to sink the steps that can run.
            const steps = [];
            let notBuilt = [];
            let pickedFields = [];
            // WHICH OF THE PICKED LANES ARE REMOVALS. Declared beside the lanes
            // it subsets, and defaulted so every read below is safe on a path
            // that never reached the picker.
            let eRemoves = { remove: [], refused: [], pages: false };
            // `eLooking`, NOT A SECOND `eLayer === "look"`. Four guards window
            // the look LANE by finding that exact condition and slicing to the
            // next branch; a second copy up here moves all four windows onto
            // this block, so each spans the whole dispatch chain and a mutation
            // in the wrong half passes. The overlapping-window trap, and the
            // version that bites is always the one you add yourself — this is
            // the SECOND time in one session it has been added back here.
            // ONE NAME FOR THE PICKED SMALL-CALL MODEL. Ten call sites in this
            // block resolve it; ten copies of `modelsFor(eb && eb.picker).quick`
            // is ten things that can disagree about which picker they read.
            const eQuickModel = modelsFor(eb && eb.picker).quick;
            // ── AND A REMOVAL OPENS THIS DOOR FROM ANOTHER LAYER ────────────
            //
            // This condition is the ONLY way into the lane system: `pick_lanes`,
            // the removal verb, the refusal sentences, the dispatch steps and
            // `mergeLook`'s `clear` all sit inside it. Fifteen lanes can be
            // taken off and SEVEN of them were reachable — the look-layer
            // subjects — because the other eight are lanes that DISPATCH, and
            // the router names their destination directly. "Take the photo
            // off" answered `picture`, the door never opened, and the picture
            // rung (which swaps and reframes, and cannot remove) did its best
            // with the customer's words while the stored field stayed set.
            //
            // So a removal the router marked comes in here too. `page` and
            // `logo` are exempt because their own rungs ANSWER the flag — a
            // page deletion and a mark removal, both cheap and both measured —
            // and re-routing either would buy a picker call to reach the rung
            // it already reached. `DOOR_LAYERS` is what is left once they are
            // taken out, derived in `site-ask.mjs` beside the flag it belongs
            // to rather than spelled a second time here.
            //
            // AND IT IS THE POSITIVE LIST, NOT "EVERYTHING BUT THE TWO". This
            // route reads `remove` off the REQUEST BODY, never off the router's
            // own answer, so asking only "is this layer exempt?" opened the
            // door for `data` — whose rung deletes its own rows, and whose flag
            // `readEdit` strips precisely because nothing else should act on
            // it — on any hand-made POST that set the field. The lane picker
            // would find no lane there and climb to the revise. Found by the
            // guard below, not by reading this line.
            //
            // The four lanes that dispatch to `page` cannot use the flag at
            // all: `remove` on `page` means DELETE THE WHOLE PAGE, so widening
            // it there would answer "take the 3D scene off" by deleting the
            // page it sits on. They arrive by the LAYER answer instead — the
            // removal clause in the layer description — and if a model reads
            // past that clause the ask lands on the page rung and does its
            // best, which is exactly today's behaviour rather than a new
            // failure.
            //
            // A REMOVAL THAT ARRIVES WRONG COSTS ONE PICKER CALL, and since
            // 2026-09-28 that is true by construction rather than by hope. This
            // said a `remove` flag on a message that is not one "names nothing"
            // — and run 47's real picker named `behavior` for a menu removal,
            // which ran a look step INSTEAD of the menu rung. Now the router's
            // own step runs whatever the picker says (`doorDispatch`, where the
            // lanes become steps), and the picker on this door is told what was
            // routed and answers the rest explicitly (`routed` in the call just
            // below): only what it names as work asked BESIDE the routed change
            // runs beside it. Nothing is read from how many lanes it names.
            const eLooking = eLayer === "look" || (eRemove && DOOR_LAYERS.includes(eLayer));
            // WHETHER THIS ROUTE OPENED THE DOOR RATHER THAN THE ROUTER.
            // Read four times below: where the picker is told what the router
            // already routed (`routed`, run 47 and the owner's two holds), where
            // its two lists are recorded, where a picker with nothing to say
            // would otherwise stop the message, and where the lanes become
            // steps — the router's own step is put among them there
            // (`doorDispatch`), so it runs once, whatever the picker named.
            const eRemovalDoor = eLooking && eLayer !== "look";
            if (eLooking) {
              // ── A NAMED PAGE IS FOUND BEFORE ANYTHING RUNS (2026-09-23) ──
              //
              // The router can name the page a look change is about — "move
              // the market times up on the gallery page" — and every step below
              // reads it: a page-shaped lane lands on it (`fallbackPage`), a
              // page verb falls back to it, the QR is placed on it. So a page
              // the site does not have is answered HERE, with the real list,
              // before the picker is paid for or any lane runs: never left for
              // a site-wide lane to change the whole site, and never allowed
              // to become the home page. The page rung's own check, key and
              // sentence, asked one door earlier.
              if (ePage && !eRoutes().includes(ePage.trim().toLowerCase())) {
                return explain("page/no-page", { page: ePage.trim().toLowerCase(), verb: "", routes: eRoutes() });
              }
              editTrace.mark("pick_lanes", "start");
              // ROUND 2 OF THE RETRY RULE (2026-10-24): the picker's scope is
              // checked the way the door below checks it, before anything runs,
              // and an answer the door would refuse is asked once more with the
              // reason (`pickScopeReason`). Whether a field is an ADDITION is a
              // fact about this site — the wall below's own reading: the stored
              // look, or the thing's own mark in the page source. A look that
              // cannot be read answers "not an addition" (no retry), never a guess.
              let ePickLook;
              const ePickAddition = async (f) => {
                if (!ADD_ONLY_FIELDS.includes(f)) return false;
                if (ePickLook === undefined) {
                  try { const c = await readSiteConfig(env, ownerSlug, null); ePickLook = c.ok ? c.config.look : null; } catch { ePickLook = null; }
                }
                if (!ePickLook) return false;
                const onPage = ADD_EVIDENCE[f] && eSrc.some((p) => ADD_EVIDENCE[f].test(String((p && p.source) || "")));
                return !hasLookField(ePickLook, f) && !onPage;
              };
              const picked = await pickLanes(
                { send: eQuick("pick_lanes"), mark: traceRetryMark(editTrace), isAddition: ePickAddition },
                {
                  message: eInstruction,
                  // WHAT THE SITE IS, IN ONE LINE. Deliberately thin — this is
                  // the small call, and handing it the state an ACTING lane
                  // needs would make it the expensive one twice over.
                  current: siteDigest({ pages: eSrc.map((p) => routeOf(p.path)) }),
                  model: eQuickModel,
                  // ON THE ROUTER'S OWN REMOVAL DOOR, WHAT THE ROUTER ROUTED.
                  // The picker is told it in the router's own words and asked
                  // what ELSE the message wants, as a list of its own — so the
                  // route never has to guess which lanes are the removal it
                  // already has and which are work asked beside it. `null`
                  // everywhere else: the look door asks what it always asked.
                  routed: eRemovalDoor ? { layer: eLayer, remove: eRemove, page: ePage } : null,
                  // HOW MANY ANSWERS IT IS SHOWN, NUMBERED (2026-10-02): it names
                  // those each change needs (`answers` on a scope), checked here.
                  answers: eShown.length,
                },
              );
              editTrace.mark("pick_lanes", picked.failed ? "fail" : "ok",
                { fields: Array.isArray(picked.fields) ? picked.fields : [] });
              pickUsage = picked.usage;
              if (picked.failed) return modelDown(picked.error, "The editor is busy — try again in a moment.");
              // ── THE PICKER ASKED (2026-10-02) ────────────────────────────
              //
              // It could not tell which part of the site is meant without a
              // detail they left out. Asked before anything runs — no lane, and
              // on the removal door not the router's own step either — so the
              // answer resumes the whole of this turn and nothing is done twice.
              if (picked.ask) { eAskOut.request = eRun; return stepAsk("look", picked.ask); }
              // ── ON THE ROUTER'S OWN REMOVAL DOOR, THE PICKER ADDS; IT NEVER REPLACES ──
              //
              // Run 47 (2026-09-27): "Take Gallery out of the menu." was routed
              // `nav` with `remove`, which opens this door, and the picker named
              // `behavior` — the one lane whose hint mentions a menu, and not one
              // that edits a menu's items. A look step ran it INSTEAD of the menu
              // rung, answered nothing, and the route said `look/no-change`. The
              // door is here so a removal can reach the lane machinery; it was
              // never meant to let the picker overrule the router's layer.
              //
              // ⚠ THE OWNER HELD THE TWO CORRECTIONS THAT GUESSED (2026-09-28).
              // The first kept only lanes leading back to the router's rung, so
              // "take the photo off … and move the opening hours up" lost the
              // layout. The second read the answer by its COUNT — one lane was the
              // removal, two or more were extra work — which loses the layout
              // again when the picker names `shape` alone, and runs a misreading
              // whenever it names two. Now the picker is told what was routed
              // and answers what else was asked as a list of its own
              // (`pickLanes`'s `routed`, `doorPicked` in site-lanes.mjs), so
              // `picked.fields` here is ALREADY the work asked beside the
              // removal and nothing else: never the removal's own lane, never a
              // lane the picker tied to the removal. The router's step always
              // runs, once (`doorDispatch`, where the lanes become steps below),
              // and each lane of the work runs as its own step with its own verb
              // — never the router's. `look` never comes through this
              // condition, so its lanes, its refusals and its walls are
              // untouched. The picker call is still made and billed.
              //
              // BOTH LISTS ARE RECORDED, so a trace says what the picker tied to
              // the removal and what it asked beside it.
              if (eRemovalDoor) editTrace.mark("door:answer", "ok", { layer: eLayer, routed: picked.routed || [], additional: picked.fields });
              // A DOOR THIS ROUTE OPENED ITSELF NEVER ESCALATES FOR BEING WRONG.
              //
              // `no-lane` used to climb to the ~25-credit revise, read as the
              // right answer for a `look` ask nothing here could express. It is
              // EXPLAINED now (2026-09-23, owner: *"don't assume "no-lane" …
              // proves a rewrite can safely solve the request"*): a picker that
              // could not place the message on any part of the site is not
              // evidence that rewriting every part of it would, so the customer
              // is asked which part they mean, for nothing. And on a door the
              // ROUTER opened for `picture` or `nav` it never even explains: the
              // rung the router named was going to run, and our own picker
              // having nothing to say is no reason to stop it.
              //
              // So a removal-opened door falls THROUGH with no fields, which is
              // safe by construction: every step between here and the bottom of
              // this block walks `pickedFields`, so all of them are no-ops on an
              // empty list, and where the lanes become steps the router's own
              // step is put in (`doorDispatch`). `eRemovalDoor` is read there too.
              // ── NOTHING HERE, AND EVERY PART NAMED AS ANOTHER STEP'S (2026-10-03) ──
              //
              // The picker placed no lane and named every part of the message as
              // something no part here can make (`elsewhere`, each found in the
              // message). Not "I couldn't tell which part": it could, and each is
              // carried as left for later — said on the reply, never run.
              if (!picked.fields.length && !eRemovalDoor && Array.isArray(picked.elsewhere) && picked.elsewhere.length) {
                for (const w of picked.elsewhere) if (!eHeldOut.parts.includes(w)) eHeldOut.parts.push(w);
                editTrace.mark("handover:elsewhere", "ok", { parts: picked.elsewhere.length, unread: picked.elsewhereUnread || 0 });
                return explain("picker/elsewhere");
              }
              if (!picked.fields.length && !eRemovalDoor) return explain("picker/no-lane");
              pickedFields = picked.fields;

              // ── TAKING SOMETHING OFF ──────────────────────────────────────
              //
              // Owner, 2026-09-06: "delete should be in the edit path , they can
              // delete literally anything", scoped a moment later to "things in
              // the site , like a component etc etc etc , not database".
              //
              // READ ONCE, HERE, ABOVE EVERY WALL BELOW IT, because both walls
              // ask a question that inverts for a removal: the addon wall asks
              // "does the site not have this yet?" and answers by offering to
              // MAKE it, which is the opposite of what was asked.
              eRemoves = picked.removes || { remove: [], refused: [], pages: false };

              // A LANE THIS ROUTE WILL NOT TAKE OFF IS SAID, NEVER DROPPED.
              // Nothing has run and nothing is charged beyond the routing call
              // this message already paid for. A silent drop is how "delete the
              // bookings table" comes back "Done" having done nothing, which is
              // the failure the whole removal verb exists to avoid.
              if (eRemoves.refused.length) {
                editTrace.mark("remove:refused", "ok", { fields: eRemoves.refused.map((r) => r.field) });
                return eAnswer({
                  ok: false,
                  status: 422,
                  error: "not-removable",
                  msg: cannotRemoveMsg(eRemoves.refused),
                  cost: 0,
                });
              }

              // BOTH SPELLINGS OF ONE ACT. A picker that put "pages" under
              // `removes` instead of answering `pageVerb: "remove"` has been
              // perfectly clear; refusing the second-most-natural phrasing is a
              // wall in front of a customer who said what they meant. Folded
              // into the verb the page lane already reads, and never over a
              // verb the picker DID answer — `add` and `move` are that lane's
              // other two capabilities and neither is a removal.
              if (eRemoves.pages && !(picked.page && picked.page.verb)) {
                picked.page = { verb: "remove", layer: verbLayer("remove"), name: ePage || "", to: "" };
              }

              // ── ADDING IS THE ADDON STEP ──────────────────────────────────
              //
              // Owner, 2026-09-02: "add will always go in addon". A code or a
              // scene the site does not have yet is designed from nothing — a
              // design round, which is the addon step's job, not this path's.
              // Decided HERE, at the picker, and not inside the look step: a
              // dispatched lane (`three` → page) never runs the look step, so
              // a wall there would let "add a 3D scene" through. Named with
              // the addon's own layer so the client hops to that rung rather
              // than falling to the full revise. What exists is edited here: a
              // stored code's caption, a scene's motion, the page's own code.
              // The config is read without a connection — the look lives in
              // R2 — and a read that FAILS lets the lane run rather than
              // refusing: cannot-tell must never read as nothing-there, and
              // the lane says `no-meta` itself.
              // HOISTED ABOVE THE WALL because the QR place step below needs
              // the stored list too: which codes the page shows is a question
              // about the codes BY NAME, and the names are in the look.
              let wallLook = null;
              // ── AN ADDITION BESIDE OTHER WORK IS PUT OFF, NEVER SWAPPED FOR IT ──
              //
              // (2026-10-02, the whole-router audit's W15.) The walls below sent
              // the WHOLE message to the add-on step the moment the picker named
              // an addition — before any other lane ran — so "make the header
              // navy and add a QR code for our wifi" changed no colour: the
              // add-on step designed the code and had no lane for the rest.
              // Beside other work the addition is now put off exactly as the
              // router puts a part off (`alsoAsked`): its own words, from the
              // picker's scope for it, join the parts every ending reports and
              // every later step takes out; the rest runs. Alone, it is the
              // whole ask and is handed on as before, with its page.
              //
              // THE PICKER DECIDED IT IS AN ADDITION AND WHICH WORDS ASK FOR IT;
              // code only checks the site has none and the words are the
              // customer's own (`readScopes`). An addition with no readable
              // words of its own stays a lane and the scope check withholds it,
              // the convention for any scoped change it cannot place. An answer
              // with no scopes at all cannot separate the words, so nothing
              // runs and the customer is asked to send the addition alone.
              const addWhat = (f) => (f === "three" ? "a 3D scene" : f === "pages" ? "a new page" : "a QR code");
              // EVERY SCOPED ADDITION IN A LANE, NOT THE FIRST (2026-10-02, the
              // owner's review of batch 2: *"replace additionOp's first-match
              // handling so multiple scoped additions in the same lane are all
              // preserved"*). Two QR codes on two pages are two scopes in one
              // lane; `find` kept the first, and the second was neither put off
              // nor named — nor made. Every op that passed `readScopes`.
              const scopedOps = (f) => (picked.scoped && Array.isArray(picked.scopes)
                ? picked.scopes.filter((op) => op && op.part === f && !op.invalid && op.words) : []);
              // WHAT THE LOOK STEP ITSELF PUT OFF THIS TURN, for the cut at the
              // end of this door: every part here is taken out of every step's
              // own words and of `eRun` before any step runs.
              const lookHeld = [];
              let lookHeldWhat = "";
              const deferLane = (f) => {
                const ops = scopedOps(f);
                if (!ops.length) return false;
                if (!lookHeldWhat) lookHeldWhat = addWhat(f);
                for (const op of ops) {
                  if (!eHeldOut.parts.includes(op.words)) eHeldOut.parts.push(op.words);
                  if (!lookHeld.includes(op.words)) lookHeld.push(op.words);
                }
                editTrace.mark("handover:held", "ok", { field: f, parts: ops.length });
                return true;
              };
              // OTHER WORK IS A CHANGE WITH WORDS OF ITS OWN once the given parts
              // are out. A change whose every word lies inside an addition's is
              // that addition described, not a second change ("…a QR code in the
              // brand colours" is not also a colour change). A scoped lane with
              // no valid scope is withheld with its own sentence, so it counts;
              // on a legacy answer every lane runs on the whole message and
              // counts. The PICKER decided which words are whose; this compares
              // positions in the message it was shown.
              const ownWork = (f, without) => {
                if (!picked.scoped) return true;
                const mine = scopedOps(f);
                return !mine.length || mine.some((op) => wordsLess(eRun, op.words, without));
              };
              // ONE STEP, LESS EVERY PART PUT OFF: its own words with the parts
              // taken out (`wordsLess`), or null when none of its own are left —
              // its change WAS the part put off. A step with no words of its own
              // (a legacy step, the router's own step on the removal door) runs
              // on `eRun`, which is cut the same way; a step with a fixed ask
              // (the QR placement) carries no customer words at all.
              const cutStep = (s, parts) => {
                if (!s || !parts.length) return s;
                if (Array.isArray(s.words)) {
                  const ws = s.words.map((w) => wordsLess(eRun, w, parts)).filter(Boolean);
                  return ws.length ? { ...s, words: ws, ask: ws.join("\n") } : null;
                }
                if (s.opWords && typeof s.opWords === "object") {
                  const asks = {};
                  const opWords = {};
                  for (const f of s.fields) {
                    const ws = (Array.isArray(s.opWords[f]) ? s.opWords[f] : []).map((w) => wordsLess(eRun, w, parts)).filter(Boolean);
                    if (ws.length) { asks[f] = ws.join("\n"); opWords[f] = ws; }
                  }
                  const fields = s.fields.filter((f) => Object.hasOwn(asks, f));
                  return fields.length ? { ...s, fields, asks, opWords } : null;
                }
                return s;
              };
              if (pickedFields.some((f) => ADD_ONLY_FIELDS.includes(f))) {
                try {
                  const c = await readSiteConfig(env, ownerSlug, null);
                  if (c.ok) wallLook = c.config.look;
                } catch { wallLook = null; }
                if (wallLook) {
                  const additions = [];
                  for (const f of ADD_ONLY_FIELDS) {
                    // "EXISTS" IS A FACT ABOUT THE SITE, NOT ONLY ABOUT THE
                    // STORED LOOK. fretwork-1's 3D pick was drawn by the page
                    // rung in sweep five — `three` dispatches there and that
                    // rung stores no design field — so the look said "no
                    // scene" while the page had a canvas, and run 12 sent an
                    // edit of it to the addon step. Either record counts: the
                    // stored field, or the thing's own mark in the page source.
                    const onPage = ADD_EVIDENCE[f] && eSrc.some((p) => ADD_EVIDENCE[f].test(String((p && p.source) || "")));
                    // A REMOVAL NEVER ESCALATES TO THE STEP THAT MAKES ONE.
                    // This wall asks "does the site not have this yet?" and
                    // answers by offering to build it — the exact opposite of
                    // what was asked. "Take the 3D scene off" a site with no
                    // scene is not an addon: it is already true, and saying so
                    // costs nothing. Checked before the wall rather than after,
                    // because the wall RETURNS.
                    if (eRemoves.remove.includes(f)) {
                      if (!hasLookField(wallLook, f) && !onPage) {
                        editTrace.mark("remove:absent", "ok", { field: f });
                        // ⚠ IT ANSWERED `ok: true` WITH NO LAYER, and the
                        // browser's success composer ends '✅ Done.' — so this
                        // sentence never reached the screen (2026-09-23). A
                        // refusal now, which is the branch that shows `msg`.
                        return explain("picker/nothing-to-remove", { what: f === "three" ? "a 3D scene" : "a QR code" });
                      }
                      continue;
                    }
                    if (pickedFields.includes(f) && !hasLookField(wallLook, f) && !onPage) additions.push(f);
                  }
                  if (additions.length) {
                    const addOps = additions.flatMap(scopedOps);
                    const addWords = addOps.map((op) => op.words);
                    const others = pickedFields.filter((x) => !additions.includes(x) && ownWork(x, addWords));
                    // THE ADDITIONS ARE THE WHOLE ASK — every one the picker
                    // scoped, and nothing beside them with words of its own:
                    // handed on whole. The add-on step reads the whole message;
                    // the hand-over names the part of the site and the page only
                    // when every addition shares them, because one page named for
                    // additions on two would scope it to half of what was asked.
                    // On the router's removal door the router's own step is other
                    // work, always (`doorDispatch`), so the door never hands on.
                    if (!others.length && !eRemovalDoor) {
                      const onPages = [...new Set(addOps.map((op) => op.page || ""))];
                      return escalate("addon", {
                        ...(additions.length === 1 ? { field: additions[0] } : {}), layer: "addon",
                        ...(onPages.length === 1 && onPages[0] ? { page: onPages[0] } : {}),
                      });
                    }
                    if (!picked.scoped) return explain("picker/addition-mixed", { what: addWhat(additions[0]) });
                    pickedFields = pickedFields.filter((x) => !(additions.includes(x) && deferLane(x)));
                  }
                }
              }
              // ── AND EVERY PART THE PICKER SAID NO PART HERE CAN MAKE (2026-10-03) ──
              //
              // Owner: *"Let models identify intent, scope and unhandled parts
              // using clear instructions and structured outputs."* Before this, a
              // part no lane here makes (a new form, an entry in a stored list,
              // exact wording) beside work this door does was not run, not held
              // and not said unless the router happened to hold it — and the
              // router holds what it sees, not what the picker finds (the
              // mixed-work audit's MW3). Each part the picker named, found in the
              // message, is put off exactly as an addition is: taken out of every
              // step's words and of `eRun` by the cut below, before anything runs,
              // and named on every ending.
              for (const w of Array.isArray(picked.elsewhere) ? picked.elsewhere : []) {
                if (!eHeldOut.parts.includes(w)) eHeldOut.parts.push(w);
                if (!lookHeld.includes(w)) lookHeld.push(w);
              }
              if (Array.isArray(picked.elsewhere) && picked.elsewhere.length) {
                editTrace.mark("handover:elsewhere", "ok", { parts: picked.elsewhere.length, unread: picked.elsewhereUnread || 0 });
              }

              // ── THERE IS NO SHADOW WALL ANY MORE, AND THAT IS THE POINT ───
              //
              // For one morning (2026-09-07) a wall stood here refusing a
              // `wordmark` or `favicon` lane for free whenever the site carried
              // an uploaded picture, because the container's baker made the
              // upload win and the drawn answer could never be seen — run 41
              // paid 2 credits and 292 seconds to learn that. The wall was
              // honest and it was a symptom: three fields per mark with the
              // precedence between them a layer away.
              //
              // With ONE field per mark carrying a FORM, a lane's answer simply
              // REPLACES whatever form is there, so there is nothing to shadow
              // and nothing to refuse. What the wall was really protecting —
              // "a model must not outrank a person" — is `mergeLook`'s
              // `asked` rule now: a design step that VOLUNTEERS a mark leaves
              // an uploaded one alone, a lane the customer named does not.

              // A PAGE-SHAPED LANE NEEDS A PAGE. The one the router NAMED comes
              // first — it was checked against the site at the top of this door
              // — and only a message naming none falls back: to the site's only
              // page when it has one (most sites, since the PLAN caps a new
              // build at one), otherwise the home page, which is where a
              // request naming no page means. `routeOf` is the same function
              // the page layer resolves with, so there is no second opinion
              // about what a file is called.
              //
              // ⚠ UNTIL 2026-09-23 NOTHING COULD NAME ONE HERE. The router's
              // `page` field was for the `page` layer alone and `readEdit`
              // dropped it for `look`, so "…on the gallery page" was made on
              // the home page of every multi-page site and the reply said
              // "Updated /". The default below is unchanged; it is simply no
              // longer the answer to a page somebody named.
              const routes = eSrc.map((p) => routeOf(p.path)).filter(Boolean);
              const fallbackPage = ePage || (routes.length === 1 ? routes[0] : (routes.includes("/") ? "/" : routes[0] || ""));

              // ── EACH CHANGE'S OWN PAGE AND WORDS (2026-09-29) ──────────────
              //
              // Owner, after run 52: *"Make supported multi-change edits execute
              // each requested operation with its own scope. A site-wide
              // description and a change to one named page must retain their
              // separate scopes."* Every page lane went to `fallbackPage` — the
              // router's one page, or `/` — and every step read the whole
              // message, so run 52's Visit move was handed to the home page's
              // writer beside the description's words. The picker now names each
              // change's part, page and words (`scopes`, read in site-lanes.mjs
              // against the message it was shown): a page lane runs on each page
              // it was scoped to, with only that change's words, and an own lane
              // is handed only its own words. An answer with no scope metadata at
              // all runs exactly as before; a scope that fails its check is
              // withheld (below).
              //
              // ── ⚠ A SCOPE THAT FAILS ITS CHECK NEVER WIDENS (2026-09-29) ───
              //
              // Owner, after reproducing two ways round it: *"Distinguish absent
              // legacy scope from explicitly invalid scope. Once an operation
              // supplies scope metadata, failed validation must not widen its
              // instruction to the whole request or redirect it to the
              // homepage."* A malformed page (`["/visit"]`) read as "no page"
              // sent the Visit move to the home page's writer, and words the
              // message does not hold read as "no words" handed the Visit
              // writer the whole request, description change and all.
              //
              // LEGACY IS AN ANSWER WITH NO SCOPE METADATA AT ALL (`scoped`
              // false): every lane runs as it did before scopes existed. A
              // SCOPED answer runs only what its scopes place: each valid op on
              // its own page with its own words; an op that failed its check,
              // an op aimed at a page the site does not have, and a picked lane
              // the answer left without any scope are WITHHELD — no model call,
              // no charge, and a sentence in `partial` beside whatever else
              // ran (the existing partial-success contract). Withheld steps go
              // last, so they sit between no two page steps `mergePageSteps`
              // would join.
              const eScoped = picked.scoped === true;
              const eOps = eScoped && Array.isArray(picked.scopes) ? picked.scopes : [];
              const eKnown = eRoutes();
              // EACH WITHHELD STEP CARRIES ITS OWN ANSWER, built where its key
              // is spelled, so the classification census reads every one. One
              // per lane, doubt and page: a sentence said twice is noise.
              const withheld = [];
              // AND THE WORDS IT WAS FOR (2026-10-03, the mixed-work fixes), when
              // they passed every check — so the reply names the change withheld,
              // not only its lane. A scope whose words are unread carries none.
              const withhold = (f, why, page, answer, words = []) => {
                const had = withheld.find((w) => w.fields[0] === f && w.withheld.why === why && w.page === page);
                if (had) { if (words.length) had.words = [...new Set([...(had.words || []), ...words])]; return; }
                withheld.push({ layer: OWN_LANES.includes(f) ? "look" : (laneLayer(f) || "look"), page, fields: [f], ...(words.length ? { words: [...words] } : {}), withheld: { why, answer } });
              };
              // A PAGE THE SITE DOES NOT HAVE is the router's own check and
              // sentence, for that one change — the rest of the message runs.
              const strayPage = (op) => !!op.page && laneLayer(op.part) === "page" && !eKnown.includes(op.page);
              for (const op of eOps) {
                if (op.invalid) withhold(op.part, op.invalid, op.page, () => explain("picker/scope-unread", { why: op.invalid, page: op.page }));
                else if (strayPage(op)) withhold(op.part, "no-page", op.page, () => explain("page/no-page", { page: op.page, verb: "", routes: eKnown }), [op.words]);
              }
              // WHAT EACH LANE MAY RUN ON: its ops that passed every check.
              const eRunnable = eOps.filter((op) => !op.invalid && !strayPage(op));
              const opsOf = (f) => eRunnable.filter((op) => op.part === f);
              // ── AND THE ANSWERS EACH CHANGE NEEDS (2026-10-02, the owner's
              //    second review: *"with the model identifying its relevant
              //    scope rather than customer-keyword rules"*) ────────────────
              //
              // The picker named, for each change, the answers it needs
              // (`answers` on a scope: numbers into `eShown`, checked in
              // `readScopes`). Each step is handed those — and every answer no
              // change named, which could be anybody's — as `told`, the indices
              // into `eCtxAll` it is shown (`eCtxOf`). A change the picker gave
              // no reading for is shown every answer: never fewer than it may
              // need. When a step asks beside others, the answers only finished
              // changes needed go no further (`askRemainder`).
              const eNamed = new Set(eOps.flatMap((op) => (Array.isArray(op.answers) ? op.answers : [])));
              const eUnnamed = eShownIdx.filter((_, i) => !eNamed.has(i + 1));
              const toldOf = (ops) => (ops.length && ops.every((op) => Array.isArray(op.answers))
                ? [...new Set([...ops.flatMap((op) => op.answers.map((n) => eShownIdx[n - 1])), ...eUnnamed])].sort((a, b) => a - b)
                : null);
              const toldAll = (lists) => (lists.every(Array.isArray) ? [...new Set(lists.flat())].sort((a, b) => a - b) : null);
              // A PICKED LANE A SCOPED ANSWER NEVER MENTIONED is not legacy:
              // the answer said where each change goes, and said nothing of
              // this one. Withheld, never run on the whole message.
              const unscoped = (f) => !eOps.some((op) => op.part === f);
              const acting = pickedFields.filter((f) => OWN_LANES.includes(f));
              // THE OWN LANES THAT REALLY RUN — the QR placement below follows
              // its lane, never the pick.
              let lookRuns = acting;
              if (acting.length && !eScoped) steps.push({ layer: "look", page: ePage, fields: acting });
              else if (acting.length) {
                const asks = {};
                // EACH LANE'S OWN WORDS, AS A LIST, so the cut at the end of this
                // door can take out a part put off by position (`cutStep`).
                const opWords = {};
                // AND EACH LANE'S OWN ANSWERS (`toldBy`), and the step's, all of
                // them together (`told`) — what its question would keep.
                const laneTold = {};
                lookRuns = [];
                for (const f of acting) {
                  const mine = opsOf(f);
                  if (mine.length) { opWords[f] = mine.map((op) => op.words); asks[f] = opWords[f].join("\n"); laneTold[f] = toldOf(mine); lookRuns.push(f); }
                  else if (unscoped(f)) withhold(f, "unscoped", "", () => explain("picker/scope-unread", { why: "unscoped" }));
                }
                if (lookRuns.length) steps.push({ layer: "look", page: ePage, fields: lookRuns, asks, opWords, toldBy: laneTold, told: toldAll(lookRuns.map((f) => laneTold[f])) });
              }
              // ── ONE PAGE OPERATION PER PAGE, WHERE PAGE LANES SIT TOGETHER ──
              //
              // ⚠ ONE STEP PER LANE RAN THE PAGE RUNG TWICE (2026-09-23).
              // `components` and `shape` both dispatch to the page rung, and the
              // page rung reads the customer's sentence and none of the lane
              // names — so a message picking both was one operation run twice
              // on one page, the second shown the first's output. Reproduced
              // through this route with supplied answers: a swap was made and
              // then made BACK, the publication carried the original page, both
              // runs were billed, and the screen said "✅ Updated the look."
              // `mergePageSteps` joins neighbouring page steps on the same page
              // into one step carrying every field; a step with its own ask, a
              // `pages` verb, another page, or a step on another rung between
              // two page steps keeps them apart, and no step moves.
              //
              // ── AND ON THE ROUTER'S REMOVAL DOOR, ITS OWN STEP IS ONE OF THEM ──
              //
              // The router's rung runs whatever the picker named, and runs ONCE:
              // the picker's work never carries that rung's own lane (`action`,
              // `images` — `doorPicked` takes it out, since its rung reads the
              // whole sentence and a second step there would be one operation
              // twice), so the router's step goes where that lane would have run
              // — the very step the router's layer always got, with the ROUTER'S
              // verbs on it and nobody else's. Each lane of the work asked beside
              // it is its own step with no verb of the router's. So "take the
              // photo off and move the opening hours up" runs the layout step AND
              // the picture step whether the picker named one lane or two, and a
              // message with nothing else in it reaches the rung the router chose
              // and nothing more. The router's step names its lane only when the
              // picker did (`picked.routed`), so the reply never names a lane the
              // picker did not.
              const doorOwn = eRemovalDoor ? doorLane(eLayer) : null;
              const dispatched = [];
              for (const f of doorDispatch(pickedFields, doorOwn)) {
                const to = laneLayer(f);
                if (!to) continue;
                if (f === doorOwn) {
                  dispatched.push({ layer: eLayer, page: ePage, fields: (picked.routed || []).includes(f) ? [f] : [], remove: eRemove, rename: eRename });
                  continue;
                }
                if (!eScoped) {
                  dispatched.push({ layer: to, page: to === "page" ? fallbackPage : ePage, fields: [f] });
                  continue;
                }
                // A SCOPED LANE RUNS ONLY ON ITS VALID OPS: a page lane once
                // per page it was scoped to, in the order the picker named
                // them, with only the words for that page (an op with no page
                // goes where an unscoped lane would); any other lane once, with
                // its ops' words. No valid op, no step.
                const mine = opsOf(f);
                if (!mine.length) {
                  if (unscoped(f)) withhold(f, "unscoped", "", () => explain("picker/scope-unread", { why: "unscoped" }));
                  continue;
                }
                // `words` IS THE ASK AS A LIST — the same words, kept apart so a
                // part put off can be taken out of each by position (`cutStep`).
                if (to === "page") {
                  for (const pg of [...new Set(mine.map((op) => op.page || fallbackPage))]) {
                    const here = mine.filter((op) => (op.page || fallbackPage) === pg);
                    const words = here.map((op) => op.words);
                    dispatched.push({ layer: "page", page: pg, fields: [f], ask: words.join("\n"), words, told: toldOf(here) });
                  }
                  continue;
                }
                const words = mine.map((op) => op.words);
                // THE PAGES ITS OWN OPS NAME (`on`, 2026-10-11): what the step
                // reaches, for planning which later steps may be prepared beside
                // the ones before them (`stepReach`). Never the rung's `page`.
                const on = [...new Set(mine.map((op) => (typeof op.page === "string" ? op.page : "")).filter(Boolean))];
                dispatched.push({ layer: to, page: ePage, fields: [f], ask: words.join("\n"), words, told: toldOf(mine), ...(on.length ? { on } : {}) });
              }
              steps.push(...mergePageSteps(dispatched));
              // ── THE QR IS PLACED, NOT ONLY MADE ───────────────────────────
              //
              // The qr lane stores a destination and a caption and the container
              // draws the code's file from them — and on a site whose page was
              // written before there was a code, nothing shows it: the lane
              // sweep (2026-09-01) decoded a perfect code the page referenced
              // nowhere. So when a stored code is on no page, one page step
              // follows the look step with an ask of its own, and the page rung
              // — which now sees `marksDirective` from the stored look — puts
              // the figure on the page. Its ask is fixed text rather than the
              // customer's sentence, because the customer asked for a code, not
              // for a page rewrite, and a rewrite told "add a QR code" invents
              // one of its own instead of using the binding.
              //
              // BY NAME SINCE THE LIST (2026-09-03): `qrUnplaced` reads every
              // page for each code's own binding (`SITE_QRS.<name>`, or the old
              // `SITE_QR` for the first code) and the ask names exactly the ones
              // no page shows — so a site with two codes and one on the page is
              // asked for the other, not for "the QR code" it already has. The
              // names come off the look read for the wall above; a read that
              // failed places nothing, because a step that cannot name the code
              // would have the rung guess one.
              //
              // ⚠ AND NEVER ON A REMOVAL (2026-10-02, W2). The codes named here
              // are read from the look as it stood BEFORE this message, so a
              // code being taken off that no page showed yet was asked to be
              // PLACED by the step that followed — a figure reading a binding
              // the same publish takes away. A removal places nothing.
              if (lookRuns.includes("qr") && !eRemoves.remove.includes("qr") && fallbackPage) {
                // THE COMPONENTS TOO (2026-10-23, audit A31-6): a code shown
                // through one a page renders is placed. An unreadable store
                // reads the pages alone, as before.
                const qrParts0 = await editParts();
                const unplaced = qrUnplaced(qrList(wallLook && wallLook.qr), qrParts0.ok ? qrShownSources(eSrc, qrParts0.parts) : eSrc);
                if (unplaced.length) steps.push({ layer: "page", page: fallbackPage, fields: ["qr"], instruction: qrPlaceAsk(unplaced) });
              }

              // ── `pages`: THREE CAPABILITIES BEHIND ONE FIELD ─────────────
              //
              // Adding a page is the ADDON route, taking one away is the `page`
              // rung with `remove`, moving one is the `page` rung with a new
              // address. All three already worked; what was missing was a
              // second word saying WHICH, so the lane escalated under one name
              // for three different jobs.
              //
              // NO GUESS. A `pages` ask whose verb the router could not name
              // escalates — the one place in the edit path where the bias
              // inverts, because everywhere else a wrong action costs a change
              // the customer can see and undo, and here it can cost them a page.
              if (pickedFields.includes("pages")) {
                const pv = picked.page;
                if (!pv) return explain("pages/page-verb");
                // ADDING IS THE ADDON ROUTE, which this route cannot run — it
                // publishes a site that exists rather than adding to it. Named
                // rather than folded into a generic escalation, so the ladder
                // climbs to the rung that really does it.
                //
                // ⚠ AND BESIDE OTHER WORK IT IS PUT OFF, NOT SWAPPED FOR IT
                // (2026-10-02, the audit's W15): this returned before any of the
                // steps already built could run. The steps above are the other
                // work; a withheld one counts too, so its own sentence is said.
                if (pv.layer === "addon") {
                  // THE OTHER WORK IS WHAT KEEPS WORDS OF ITS OWN once every part
                  // put off is out, this page's included (2026-10-02, the review
                  // of batch 2): a step whose every word was the page addition's
                  // is that addition, not work beside it.
                  const pageWords = scopedOps("pages").map((op) => op.words);
                  const rest = steps.filter((st) => cutStep(st, [...lookHeld, ...pageWords]));
                  if (!rest.length && !withheld.length) return escalate("addon", { field: "pages", verb: pv.verb, layer: "addon" });
                  if (!picked.scoped) return explain("picker/addition-mixed", { what: addWhat("pages") });
                  if (!deferLane("pages")) withhold("pages", "unscoped", "", () => explain("picker/scope-unread", { why: "unscoped" }));
                } else {
                  // A PAGE THE SITE DOES NOT HAVE IS NOT AN EDIT OF IT. Checked
                  // against the real route list, the same way `readEdit` does one
                  // router up.
                  //
                  // ⚠ THIS SAID "a removal aimed at a page nobody has is an addon,
                  // correctly identified" AND ESCALATED WITH NO LAYER, which the
                  // browser reads as `up`: "take the menu page off" on a site with
                  // no menu page bought a rewrite of every page (reproduced
                  // 2026-09-23). Removal and move are the only verbs that reach
                  // here — adding went to the add-on route one line up — and for
                  // both the honest answer is a sentence: already true, or nothing
                  // to move.
                  const known = eSrc.map((pg) => routeOf(pg.path)).filter(Boolean);
                  if (pv.name && known.length && !known.includes(pv.name)) {
                    return explain("pages/no-page", { page: pv.name, verb: pv.verb, routes: known });
                  }
                  // THE VERB RIDES ON ITS OWN STEP, beside the page it names. It
                  // used to be written into the message-wide flags here, and every
                  // other page step of the message then took the removal or the
                  // move — see `eRemove` where it is declared.
                  steps.push({
                    layer: "page", page: pv.name || fallbackPage, fields: ["pages"],
                    remove: pv.verb === "remove", rename: pv.verb === "move" ? pv.to : "",
                  });
                }
              }

              // A RUNG ABOVE THIS ROUTE DOES IT. `kind` is a rebuild — shopfront
              // and tool are different sites — so it is escalated by the name of
              // the rung that can, not reported as missing. The capability
              // exists; it is simply not one an EDIT can run.
              const above = pickedFields.map((f) => [f, laneEscalate(f)]).find(([, r]) => r);
              //
              // BY NAME (2026-09-23). `laneEscalate` answers "build" for `kind`
              // and nothing else today (derived, not assumed); the literal is
              // what lets the classification census see this climb at all. A
              // lane that one day escalates somewhere new is SAID until its own
              // class is decided, never climbed by default.
              if (above && !steps.length) {
                if (above[1] === "build") return escalate("build", { field: above[0] });
                return explain("picker/unbuilt", {}, { field: above[0], needs: above[1] });
              }
              // NOT BUILT YET, AND IT SAYS WHICH — three different jobs that must
              // never share one word. `kind` is a rebuild by definition, `pages`
              // is three capabilities behind one field (add, remove, move),
              // `slug` is an address change.
              notBuilt = pickedFields.map((f) => [f, laneUnbuilt(f)]).filter(([, r]) => r);
              // ONLY WHEN NOTHING ELSE CAN RUN. An unbuilt lane beside a workable
              // one used to escalate the WHOLE message, so "make the footer
              // darker and change our web address" did neither — the same
              // dropped-ask failure wearing the other face.
              // A door the router opened never reaches this empty: its own step
              // was put in where the lanes became steps (`doorDispatch`).
              //
              // ── A PART THE LOOK STEP PUT OFF REACHES NO STEP THAT RUNS ─────
              //
              // (2026-10-02, the owner's review of batch 2: *"ensure newly
              // deferred instructions are excluded from every executing step's
              // model input, including overlapping scope words and removal-door
              // steps that fall back to eRun."*) `eRun` was cut before this door
              // put anything off, so the router's own step on the removal door —
              // which has no scope words and runs on `eRun` — was handed the
              // addition promised for later, and a step whose scope words ran on
              // into an addition's was handed those words with its own. Every
              // part put off here is now taken out of every step's own words and
              // of `eRun` itself before any step runs: the last moment a step's
              // input is decided, with every put-off known (the page addition is
              // decided just above). A step left with no words of its own was
              // the part put off and does not run; it is named with the parts.
              if (lookHeld.length) {
                for (let i = steps.length - 1; i >= 0; i--) {
                  const cut = cutStep(steps[i], lookHeld);
                  if (cut) steps[i] = cut;
                  else steps.splice(i, 1);
                }
                // `eRun` LESS THE SAME PARTS. Nothing of the message left to run
                // (the parts put off covered every word) cannot be told apart
                // from the parts, so nothing runs — and nothing is said to wait,
                // since nothing was done around it. On the removal door this is
                // a removal whose words the picker gave wholly to an addition:
                // the router's own step runs on `eRun`, and none of it is left.
                const left = heldParts(eRun, lookHeld);
                if (!left.ok) {
                  // NOTHING LEFT TO RUN. When the parts put off were all ones the
                  // picker named as no step's here (`elsewhere`), each is named
                  // as left for later; an addition's words that swallowed the
                  // rest keep their own sentence, as before.
                  if (!lookHeldWhat) return explain("picker/elsewhere");
                  // THE ADDITION'S OWN WORDS COME OFF THE LIST (its sentence asks
                  // for it alone); a part the picker named as no step's here
                  // stays named.
                  const named = Array.isArray(picked.elsewhere) ? picked.elsewhere : [];
                  eHeldOut.parts = eHeldOut.parts.filter((p) => !lookHeld.includes(p) || named.includes(p));
                  return explain("picker/addition-mixed", { what: lookHeldWhat });
                }
                eRun = left.run;
                eInstruction = eRun;
                editTrace.mark("handover:cut", "ok", { parts: lookHeld.length, steps: steps.length });
              }

              // A MESSAGE WHOSE EVERY SCOPED CHANGE WAS WITHHELD is not one
              // nobody could place (2026-09-29): each withheld step says its
              // own doubt, which "I couldn't tell which part of your site
              // that's about" would contradict.
              if (!steps.length && !withheld.length) {
                if (notBuilt.length) return explain("picker/unbuilt", {}, { field: notBuilt[0][0], needs: notBuilt[0][1] });
                return explain("picker/no-lane");
              }
              // LAST, after every step that runs (see `withhold`, above).
              for (const w of withheld) editTrace.mark("scope:withheld", "ok", { field: w.fields[0], why: w.withheld.why, page: w.page || undefined });
              steps.push(...withheld);
            } else {
              // EVERY OTHER LAYER IS THE ROUTER'S OWN DECISION, made with the
              // whole message in front of it. One step, exactly as before — and
              // the router's verbs ride on it, because it is the step they were
              // decided for.
              // A STEP PREPARED INSIDE A JOB IS SHOWN THE ANSWERS ITS TURN WILL BE
              // (`told`, 2026-10-11): the indices its own step was given, into
              // the same full list — so its requests are byte for byte its turn's.
              const eTold = Array.isArray(eb && eb.told) && eb.told.length <= 64 && eb.told.every((j) => Number.isInteger(j) && j >= 0) ? eb.told.slice() : null;
              steps.push({ layer: eLayer, page: ePage, fields: [], remove: eRemove, rename: eRename, ...(eTold ? { told: eTold } : {}) });
            }

            // ── THE PERMISSION IS THE STATE, NOT A FLAG (2026-09-20) ──────
            //
            // A boolean stood here: *does this message have a picture step at
            // all?* — and with it true the page rung's whole photograph
            // protection was a no-op. So *"remove only the window photograph;
            // keep the bench photograph"* picked the images lane, turned the
            // protection off for the entire message, and published BOTH
            // missing. The permission was scoped to the QUESTION rather than
            // to the operations that answered it.
            //
            // WHAT REPLACED IT IS NOT A NARROWER FLAG; IT IS `eSrc`. The
            // picture rung applies its own work and hands the pages to
            // `publishStep`, which advances `eSrc` — so by the time any later
            // rung reads it, a photograph that was really cleared is already
            // an empty slot and a photograph that was really replaced already
            // carries the new url. The page rung protects what the site still
            // shows, which is exactly "everything the matched picture
            // operations did not touch", recorded by the operations
            // themselves rather than inferred from the message.
            //
            // AND IT IS ORDER-FREE. `pickedFields` order decides whether the
            // picture step runs before or after a page step; either way the
            // last writer wins and the publication is the same. What it
            // cannot repair is a page rung that runs FIRST and is refused for
            // a loss the picture rung was about to authorise — that message
            // gets the removal and a `partial` naming the other half, which
            // is honest and is written down rather than papered over.

            // THE DISPATCH CHAIN, AS A CALLABLE. Its parameters are named
            // exactly as the variables the branches already read, so the eight
            // layers below are untouched by the change that lets several of them
            // run for one message.
            //
            // `eRemove` AND `eRename` ARE THE STEP'S OWN VERBS (2026-09-23),
            // shadowing the router's under the same two names, so the page
            // rung's removal and move branches can only ever act for the step
            // that was given the verb. A step given none — a layout lane, a look
            // step, the QR placement — carries `false` and `""`.
            const runLayer = async (eLayer, ePage, pickedFields, eRemove, eRename) => {
            if (eLayer === "data") {
              // ── THE CONTENT THE SITE STORES ─────────────────────────────
              //
              // The cheapest layer there is, and the one the audit was missing:
              // a generated site keeps its menu and its prices in a `display`
              // table and renders them with `useRows`, so those words are NOT in
              // the page source and no page-facing layer could ever reach them.
              // Before this, "change the price of a haircut to £25" fell through
              // edit, addon and build and came back ~25 credits later unchanged.
              //
              // NOTHING IS RECOMPILED AND NOTHING IS REPUBLISHED. The published
              // bundle reads these rows at runtime, so the change is live the
              // moment it commits.
              // ── WHICH DATABASE, ASKED THE WAY THE RULES AND PAGE RUNGS ASK ──
              //
              // ⚠ `siteBackendBySlug` ANSWERS ONE `null` FOR FOUR FACTS, and
              // this rung escalated on it with no layer — which the browser
              // reads as the full rewrite of every page. REPRODUCED through the
              // route (2026-09-23) on an `incomplete` site: the database real,
              // the reference blank, the container without the KV cache that
              // hides it in the Worker, and "change the haircut price to £25"
              // bought a rewrite that cannot change a row at all. The four-state
              // reader answers it now, and the fast one stays the first question
              // so every site it answers is handled exactly as before.
              //
              //   ready / incomplete → the proven connection. NOTHING IS
              //       WRITTEN: an incomplete reference is the backend repair's,
              //       not this rung's (the page rung's rule, 2026-09-22).
              //   none       → a HOP to the text rung. With no database the
              //       words the customer means are in the page source, and that
              //       is the rung that changes words, for ~1 credit.
              //   unreadable → said, at no cost. Ours, and nothing a rewrite of
              //       the pages touches.
              // DRAFT-FIRST (2026-10-15): on a published site the rows this
              // step changes are HELD in the draft — read back here by the next
              // task, shown in the preview, applied only by Publish. The draft
              // and its held changes are read first; a draft that cannot be
              // read stops the step rather than act on the live rows.
              const dWriter = await backendWriter(env, ownerSlug);
              let dView = null;
              if (dWriter.on) {
                try { dView = await draftView(env, ownerSlug); }
                catch (e) { console.error("data edit: draft unreadable", ownerSlug, errorClassForLog(e)); return explain("data/backend-unreadable", {}, { backend: "draft" }); }
              }
              const dTemp = new Map();
              // THE TABLES READ FROM THE LIVE DATABASE: only a change to one of these can
              // be rehearsed there (a table held new is not live yet).
              const dLive = new Set();
              let ddb = await siteRowConn(env, ownerSlug);
              let dResolved = false;
              if (!ddb) {
                const dBack = await siteBackendDetail(env, ownerSlug);
                if (dBack.state === "unreadable") {
                  console.error("data edit backend unreadable:", ownerSlug, dBack.why, dBack.detail || "");
                  return explain("data/backend-unreadable", {}, { backend: dBack.why });
                }
                if (!dBack.conn) return escalate("no-backend", { layer: "text" });
                ddb = dBack.conn;
                dResolved = true;
              }
              // THE SCHEMA, AND A MISSING ROW IS NOT AN EMPTY DATABASE. The
              // direct `_meta` read is still the first question on a ready site;
              // when it answers nothing — no row, or a read that threw — the
              // catalog-first reader the rules rung and the add-on use is asked,
              // READ-ONLY, before anything is concluded. A catalog that confirms
              // no tables means nothing here is stored content, so the words are
              // in the pages: the same hop as no database at all.
              let dSpec = null;
              if (!dResolved) {
                try {
                  const rows = await sqlQuery(ddb, "SELECT v FROM _meta WHERE k = 'schema'");
                  if (rows && rows[0] && rows[0].v) dSpec = JSON.parse(rows[0].v);
                } catch (e) { console.error("data edit schema read failed:", ownerSlug, e && e.message); }
                // …AND NEVER A COLUMN THE TABLE DOES NOT HAVE (2026-10-07,
                // `liveDeclared`): the data model is shown each list's columns
                // and may write any of them, so the declaration is cut to the
                // catalog's own; a catalog that cannot be read sends the step
                // to the catalog-first reader below, which stops rather than
                // guess.
                if (dSpec) {
                  try { dSpec = liveDeclared(dSpec, await sqlQuery(ddb, RECOVER_QUERIES.columns)).spec; }
                  catch (e) { console.error("data edit catalog read failed:", ownerSlug, errorClassForLog(e)); dSpec = null; }
                }
              }
              if (!dSpec) {
                const dRead = await specForAddon(ddb);
                if (!dRead.ok) {
                  console.error("data edit schema recovery failed:", ownerSlug, dRead.why);
                  return explain("data/spec-unreadable", {}, { backend: dRead.why });
                }
                const dKnown = dRead.spec && Array.isArray(dRead.spec.tables) ? dRead.spec.tables : [];
                if (!dKnown.length) return escalate("no-meta", { layer: "text" });
                dSpec = dRead.spec;
              }

              // `display` TABLES ONLY, and that is a boundary rather than a
              // shortcut. A `collect` table holds customers' bookings and
              // enquiries — the visitor's data, not the owner's content — and
              // "cancel John's booking" is not a sentence to hand a model. The
              // Data panel is where those are changed, with the row on screen.
              // THE SCHEMA AS THE DRAFT HAS IT: a held change to it is read here.
              if (dView) dSpec = specOverlay(dSpec, dView.ops);
              const dTables = [];
              for (const t of (dSpec.tables || [])) {
                if (!t || !t.name) continue;
                // `public`, NOT `anyone` — and getting that word wrong made the
                // whole layer dead. Measured live 2026-08-11: every data edit
                // answered `no-data`, because `READ_LEVELS` is
                // ["none","own","members","public"] and "anyone" is a WRITE
                // level. So the condition was false for every table on every
                // site, and the cheapest lane on the platform could never find a
                // single row to change.
                //
                // Asserted against `ACCESS_PRESETS.display` rather than spelled
                // out, so the two cannot disagree again: this IS the display
                // preset, and naming it is what makes that true by construction.
                const pair = resolveAccess(t);
                if (pair.read !== DISPLAY_PAIR.read || pair.write !== DISPLAY_PAIR.write) continue;
                const cols = (Array.isArray(t.columns) ? t.columns : [])
                  .map((c) => (typeof c === "string" ? c : c && c.name)).filter(Boolean);
                try {
                  let rows = await sqlQuery(ddb, "SELECT * FROM \"" + String(t.name).replace(/"/g, "") + "\" ORDER BY id LIMIT " + MAX_DATA_ROWS);
                  // THE ROWS AS THE DRAFT HAS THEM: held changes applied, a
                  // held new row by a negative id that leads back to it.
                  if (dView) { const ov = rowsOverlay(t.name, rows || [], dView.ops); rows = ov.rows; dTemp.set(t.name, ov.tempRefs); }
                  dTables.push({ name: t.name, columns: cols, rows: rows || [] });
                  dLive.add(t.name);
                } catch (e) {
                  // A TABLE HELD IN THE DRAFT AND NOT YET LIVE reads as its held rows.
                  if (dView && dView.ops.some((o) => (o.kind === "row" && o.table === t.name) || (o.kind === "seed" && o.seed && Array.isArray(o.seed[t.name])))) {
                    const ov = rowsOverlay(t.name, [], dView.ops, { tableExists: false });
                    dTemp.set(t.name, ov.tempRefs);
                    dTables.push({ name: t.name, columns: cols, rows: ov.rows });
                  } else console.error("data edit row read failed:", ownerSlug, t.name, e && e.message);
                }
              }

              // WHAT THE PAGE OFFERS TO PUT BACK, CHECKED AGAINST THE ROWS AS
              // THEY ARE NOW (2026-10-07, Codex's review, `freshRecent`): the
              // offer can be older than the table — another tab's "put that
              // back", the Data panel, another device — and a row already back
              // would be put back twice. A table that filled the read above is
              // read once more, longer, only when an offered row names it; one
              // longer still cannot show a row gone, and its rows are set aside.
              const dRecentIn = Array.isArray(eb && eb.recent) ? eb.recent : null;
              const dWider = {};
              for (const t of dTables) {
                if (!dRecentIn || t.rows.length < MAX_DATA_ROWS || !dRecentIn.some((r) => r && r.table === t.name)) continue;
                try { dWider[t.name] = (await sqlQuery(ddb, "SELECT * FROM \"" + String(t.name).replace(/"/g, "") + "\" ORDER BY id LIMIT " + PUT_BACK_READ_MAX)) || []; }
                catch (e) { console.error("data edit put-back read failed:", ownerSlug, t.name, errorClassForLog(e)); }
              }
              const dRecent = freshRecent(dRecentIn, dTables, dWider);
              if (dRecent.dropped.length) console.log("data edit: put-back rows set aside:", ownerSlug, dRecent.dropped.map((d) => d.table + ":" + d.why).join(", "));

              // BILLED BEFORE THE FIRST ROW IS WRITTEN (2026-09-05, 1a-ii).
              // The module calls `before` with the usage in hand and nothing
              // applied; the funnel reserves here, and a refusal answers
              // `unbilled` with no row touched. Recorded, so the replies below
              // report this charge rather than placing a second one.
              let dCost = 0, dBilled = false, dStop = null;
              const dRefused = [];
              const dHeldNow = new Set();
              const dOut = await runDataEdit({
                send: eQuick(),
                mark: traceRetryMark(editTrace),
                // WHAT THE STEP WAS SHOWN (2026-10-11): counted on the job.
                seen: (x) => noteSeen(eJob, x),
                // PREPARED: the change is chosen; no row is touched here.
                before: async (usage) => { if (isPrep) { eJob.reached = (Number(eJob.reached) || 0) + 1; return false; } dCost = await eCharge(usage); dBilled = true; if (eCharges.refused() > 0) return false; dStop = await applyStop(eJob); return !dStop; },
                // ONE STATEMENT PER CHANGE, parameterised, with the table name
                // taken from the DECLARED schema rather than from the model —
                // it is the only part that cannot be a bound parameter.
                // EACH WRITE HANDS ITS ROW BACK (2026-10-07, `RETURNING`): what
                // the database kept is the after side the reply names
                // (`dataChanges`), and a write that matched no row — the row
                // gone since it was read — is not counted as a change made.
                apply: async (c) => {
                  const name = String(c.table).replace(/"/g, "");
                  const row = (rows) => (Array.isArray(rows) && rows[0] && typeof rows[0] === "object" && !Array.isArray(rows[0]) ? rows[0] : null);
                  // HELD, NOT WRITTEN (draft-first, a published site): the
                  // change goes into the draft, and what it answers is the row
                  // as the draft now has it.
                  if (dWriter.holding) {
                    const shown = dTables.find((t) => t.name === c.table);
                    const was = shown ? shown.rows.find((r) => Number(r.id) === Number(c.id)) : null;
                    const ref = c.id !== undefined && Number(c.id) < 0 ? (dTemp.get(c.table) || new Map()).get(Number(c.id)) : null;
                    const target = ref ? { ref } : { id: c.id };
                    if (c.remove) { if (!was) return false; dWriter.hold.add({ kind: "row", table: c.table, op: "remove", ...target }); return true; }
                    // TRIED BEFORE IT IS HELD (2026-10-18, audit A09-3/A09-2):
                    // the statement the live path would send, rehearsed on the
                    // live database and rolled back, so a value the column
                    // cannot take or a name already on the list is refused now,
                    // with its reason, and never reaches Publish. A change to a
                    // held new row or table is not live to try; a database that
                    // does not answer holds it as before.
                    // ONLY A CHANGE THAT STANDS ALONE ON ITS LIST is judged here
                    // (2026-10-18, review): one beside other held changes to the
                    // same table — earlier revisions, or this answer's own — may
                    // need them, and is left to Publish.
                    const alone = !(dView && heldTouches(dView.ops, c.table)) && !dHeldNow.has(c.table);
                    dHeldNow.add(c.table);
                    if (alone && dLive.has(c.table) && !ref && (c.id === undefined || was)) {
                      let tried = null;
                      try {
                        if (c.id === undefined) { const ins = insertStatement(name, c.values); tried = await sqlRehearse(ddb, ins.sql + " RETURNING id", ins.params); }
                        else {
                          const ks = Object.keys(c.values);
                          tried = await sqlRehearse(ddb, "UPDATE \"" + name + "\" SET " + ks.map((k) => '"' + k.replace(/"/g, "") + '" = ?').join(", ") + " WHERE id = ? RETURNING id", [...ks.map((k) => c.values[k]), c.id]);
                        }
                      } catch (e) { console.error("data edit rehearsal unanswered:", ownerSlug, c.table, errorClassForLog(e)); }
                      if (heldRefused(tried)) { dRefused.push(heldRefusalSaid(tried)); return false; }
                    }
                    if (c.id === undefined) {
                      const op = dWriter.hold.add({ kind: "row", table: c.table, op: "insert", values: { ...c.values } });
                      return { ...c.values, id: null, held: op.ref };
                    }
                    if (!was) return false;
                    dWriter.hold.add({ kind: "row", table: c.table, op: "update", ...target, values: { ...c.values } });
                    return { ...was, ...c.values };
                  }
                  // A REMOVAL. The id has already been checked against the rows
                  // the model was shown, so it cannot name one it never saw.
                  if (c.remove) {
                    return !!row(await sqlQuery(ddb, "DELETE FROM \"" + name + "\" WHERE id = ? RETURNING id", [c.id]));
                  }
                  const cols = Object.keys(c.values);
                  // A NEW ROW: the one parameterised INSERT, shared with the
                  // add-on's `row` kind (2026-10-01) — the same statement,
                  // spelled in one place. A statement that did not throw put
                  // its row in, whatever came back.
                  if (c.id === undefined) {
                    const ins = insertStatement(name, c.values);
                    return row(await sqlQuery(ddb, ins.sql + " RETURNING *", ins.params)) || true;
                  }
                  const sets = cols.map((k) => '"' + k.replace(/"/g, "") + '" = ?').join(", ");
                  return row(await sqlQuery(ddb, "UPDATE \"" + name + "\" SET " + sets + " WHERE id = ? RETURNING *", [...cols.map((k) => c.values[k]), c.id])) || false;
                },
                // WHAT THE LAST EDIT DELETED, carried by the client because it
                // is the only party that still has it — the row is gone from the
                // table, so `dataDigest` cannot mention it and "put it back" had
                // no referent at all. Taken on trust and SHOWN to the model, never
                // written: whatever comes back still goes through
                // `readDataChanges`, which admits only declared tables, declared
                // columns and scalar values.
                // AND THE PAGES, because what ORDER a list comes out in is a
                // fact about the page source and not about the rows: the whole
                // answer is the `{ order, dir }` argument to `useRows`. Read on
                // the request the lane already pays for, so asking costs
                // nothing on a build that never mentions the order.
              }, { instruction: eInstruction, tables: dTables, recent: dRecent.kept.length ? dRecent.kept : null, pages: eSrc, scope: stepScopeOf(eb && eb.scope), model: eQuickModel });
              // A QUESTION BACK (2026-10-02): this step's model asked instead of acting.
              if (dStop) return await editStopped(env, { job: eJob, why: dStop, phase: "apply", trace: editTrace, ctx });
              if (dOut.ask) return stepAsk("data", dOut.ask);

              if (!dOut.ok) {
                // A model that read the rows and matched none does NOT escalate:
                // the rungs above cannot change a row either, so sending them up
                // spends ~25 credits to fail differently. Said plainly instead,
                // with the one thing the owner can actually do about it.
                if (!dOut.escalate) {
                  if (dOut.reason === "send") return modelDown(dOut.error, "I couldn't reach the model that makes that change — try again in a moment.");
                  // THE LEDGER REFUSED, before any row was written.
                  if (dOut.reason === "unbilled") return unbilledReply(eCharges);
                  return Response.json({
                    ok: false, error: dOut.reason, cost: dBilled ? dCost : await eCharge(dOut.usage), usage: dOut.usage,
                    // THE MODULE WRITES THE ORDERING SENTENCE, because it is the
                    // only thing that knows which pages work their own order out
                    // and could not be rewritten from outside.
                    msg: dOut.msg || (dOut.reason === "write" && dRefused.length ? "That change couldn't be saved: " + dRefused[0] + ". Nothing was changed." : null) || (dOut.reason === "no-match"
                      ? "I couldn't match that to anything the site stores — say which list it's in and I'll have another go."
                      : "That change couldn't be saved — try again."),
                  }, { status: 422 });
                }
                // `no-data` IS THE ONLY REASON `runDataEdit` ESCALATES WITH — no
                // table holds display content, so nothing the site stores is
                // what was asked about. A HOP to the words, never the rewrite
                // (2026-09-23): the rung above rewrites pages and cannot change
                // a row either, which is this block's own opening argument.
                return escalate("no-data", { layer: "text" });
              }
              // A REORDER IS THE ONE THING THIS LANE PUBLISHES. Rows are live
              // the moment they commit — the bundle reads them at runtime — but
              // an order lives in the page source, so it needs the container.
              // Skipped entirely when nothing was reordered, which is every
              // ordinary data edit.
              // THE HELD ROWS ARE THIS TASK'S REVISION OF THE DRAFT, saved
              // before anything is said of them. A save that failed is said:
              // the change is not in the draft.
              let dSealed = { ok: true, revision: 0 };
              if (dWriter.holding) {
                dSealed = await sealHeld(env, ownerSlug, dWriter, { job: eJob ? String(eJob.id) : null });
                if (!dSealed.ok) return Response.json({ ok: false, error: "draft", ours: true, cost: dBilled ? dCost : await eCharge(dOut.usage), usage: dOut.usage, msg: "I couldn't save that change to your draft just now, so nothing changed — try again in a moment." }, { status: 503 });
              }
              let dPub = null;
              if (dOut.sortPages) {
                dPub = await publishStep(env, {
                  slug: ownerSlug, pages: dOut.sortPages,
                  label: versionLabel({ revise: true, changeNote: eRun }),
                });
                if (!dPub.ok) {
                  // THE ROWS ARE ALREADY SAVED AND THE OWNER IS TOLD SO. They
                  // committed before this ran and cannot be taken back, so a
                  // failed recompile that reported "nothing happened" would send
                  // somebody looking for a change that really did land.
                  return Response.json({
                    ok: false, error: "compile", cost: dBilled ? dCost : await eCharge(dOut.usage, dPub), usage: dOut.usage,
                    // THE ROWS STAY SAID on a ledger refusal too: `compileMsg`
                    // answers its own sentence for `unbilled`, and the rows
                    // really did land before the reorder was refused.
                    msg: (dPub.error === "unbilled" && dOut.applied.length ? "Your rows are saved. " : "") + compileMsg(dPub, dOut.applied.length
                      ? "Your rows are saved, but the new order didn't compile — the site is untouched."
                      : "That ordering change didn't compile, so your site is untouched."),
                    detail: dPub.detail,
                  }, { status: 422 });
                }
              }
              return Response.json({
                ok: true, layer: "data",
                // WHAT ORDER THE LIST COMES OUT IN, when that is what changed.
                // Omitted otherwise, so an ordinary data edit's response is
                // byte-identical to what it has always been.
                sort: dOut.sort || undefined,
                sortMsg: dOut.sortMsg || undefined,
                sortChanged: dOut.sortChanged && dOut.sortChanged.length ? dOut.sortChanged : undefined,
                files: dPub ? dPub.files : undefined,
                render: dPub ? dPub.render : undefined,
                renderNote: dPub ? dPub.renderNote : undefined, checks: dPub ? dPub.checks : undefined,
                draft: dSealed.revision ? heldDraft(dSealed.revision) : undefined,
                // `was` RIDES BACK ON A REMOVAL, and it is the only undo a
                // deleted row has: pages are archived on every publish and can
                // be restored, rows are not. With the contents in the thread,
                // putting one back is one sentence.
                applied: dOut.applied.map((c) => (c.remove
                  ? { table: c.table, id: c.id, removed: true, was: c.was || null }
                  : { table: c.table, id: c.id, columns: Object.keys(c.values) })),
                // WHAT EACH CHANGE WAS, FROM AND TO (2026-10-07): the entry,
                // each field, its value before (as read) and after (as the
                // database handed it back) — for the reply to name the change
                // and not only the table. Beside `applied`, which stays as it was.
                changes: (() => { const ch = dataChanges(dOut.applied, dTables); return ch.length ? ch : undefined; })(),
                failed: dOut.failed,
                cost: dBilled ? dCost : await eCharge(dOut.usage, dPub), usage: dOut.usage,
              });
            }
            if (eLayer === "rules") {
              // ── WHAT THE SITE DOES WITH WHAT PEOPLE SUBMIT ──────────────
              //
              // The schema was WRITE-ONCE until this existed, and it was the
              // largest hole in the ladder. Measured through the real
              // normaliser: the addon lane merges with `normalizeSchema`, whose
              // rule is "first declaration wins, later ones contribute COLUMNS",
              // so a table on a live site could gain a column and nothing else —
              // `confirm DROPPED · payment DROPPED · noOverlap DROPPED`, and
              // dropped SILENTLY, which is worse than refused.
              //
              // So "email the customer when they book", "stop two people taking
              // one slot" and "let people browse without signing in" were all
              // impossible on any site that already existed, and the last of
              // those has already cost a whole build: a marketplace whose every
              // listing was private came out as the placeholder.
              //
              // NOTHING IS RECOMPILED AND NOTHING IS REPUBLISHED. Every rule
              // here is enforced in Postgres or read out of `_meta` on the
              // request path, so no page source changes and no visitor
              // re-downloads anything.
              // ── ⚠ FOUR STATES, NOT ONE `null` (2026-09-21, run 12) ───────
              //
              // This read `siteBackendBySlug` and escalated on a falsy answer,
              // which is the collapse `site-backend-state.mjs` exists to end —
              // met here a second time, on the rung the addon path had already
              // been fixed for. MEASURED: `fretwork-1`, whose database is real
              // and whose `site_backends.neon_db` is blank, answered
              // `escalate("no-backend")` for 2 credits with nothing published.
              //
              // AND THE TWO LAYERS DISAGREED SILENTLY, which is the half worth
              // stating: `siteBackendBySlug` checks `env.SITE_ROUTES` FIRST, so
              // in the Worker an `incomplete` site resolves out of the KV cache
              // and everything looks fine, while the container — where
              // `SITE_ROUTES` is absent — reads Supabase and meets the blank
              // column. One rung, two answers, depending on where it ran.
              // `siteBackendDetail` reads Supabase directly and never the
              // cache, so both sides now get the same four-way answer.
              //
              // IT RESOLVES AND THEN PROVES. For `incomplete` the name derives
              // and the project row carries the credential, so a connection is
              // BUILT and probed with one trivial query before it is used — a
              // name that derives is not a database that answers. Nothing here
              // provisions anything: `none` is the only state in which this
              // site genuinely has no database, and making one is the addon
              // step's job, never this rung's.
              const rBack = await siteBackendDetail(env, ownerSlug);
              const rdb = rBack.conn;
              // ⚠ CANNOT-TELL IS ITS OWN ANSWER AND IT DOES NOT ESCALATE.
              // Supabase down, an unreadable project row and a derived database
              // that will not answer are three things to fix and none of them
              // is "this site needs rewriting" — so this stops here, cost 0,
              // rather than handing the browser an escalate whose `fallback`
              // starts the ~25-credit rewrite of every page. A full-site
              // rewrite cannot repair a missing database reference.
              if (rBack.state === "unreadable") {
                console.error("rules edit backend unreadable:", ownerSlug, rBack.why, rBack.detail || "");
                return eAnswer({
                  status: 503, ok: false, error: "backend", cost: 0, ours: true, backend: rBack.why, unchanged: true,
                  // ⚠ "YOU HAVEN'T BEEN CHARGED" WAS FALSE AND IS SCOPED NOW
                  // (2026-09-21, owner). `cost: 0` is true of this EDIT; the
                  // routing call that chose this layer is a separate POST that
                  // was billed on its own — run 12 moved the balance by 2 on a
                  // message that published nothing. A zero edit cost does not
                  // establish a zero-cost request, so the sentence says what
                  // this route can actually see. No refund is claimed, because
                  // none happened: there was nothing to reverse.
                  //
                  // ⚠ AND THE SITE-WIDE HALF MOVED TO THE BROWSER (2026-09-23).
                  // This rung is also reached as one step of a message that ran
                  // several (`backend` dispatches here), and "nothing on your
                  // site changed" printed beside a step that shipped was false.
                  // `unchanged: true` says what THIS rung knows; the browser adds
                  // the whole-request sentence — the edit's cost and the routing
                  // call's, as two amounts — only when every step says it.
                  msg: "I couldn't reach your site's database just now, so I've stopped rather than guess at what's in it — this is on us. Try again in a few minutes.",
                });
              }
              // A SITE THAT REALLY HAS NO DATABASE ESCALATES TO THE STEP THAT
              // CAN MAKE ONE — BY NAME. `escalateAction` reads `e.layer`, and
              // with no layer on the reply it falls to `up`: the full rewrite,
              // which cannot provision a database either. Naming `addon` sends
              // it to the one step whose first backend kind DOES provision, so
              // the legitimate fallback is kept and the wrong one is closed.
              if (rBack.state === "none") {
                return escalate("no-backend", { layer: "addon", backend: rBack.why });
              }
              // A REFERENCE THAT WAS MISSING IS RECORDED ON THE WAY PAST, the
              // addon path's own shape. `siteBackendDetail` has already proved
              // this database answers, so what is written is a name known good
              // rather than one derived and hoped for. Best-effort: the rung
              // proceeds either way, because the connection in hand is the same
              // one whether or not the row learns its name.
              // A PREPARATION WRITES NO REFERENCE: a site whose database link
              // needs healing is not prepared; its own job heals and runs it.
              // A PREPARATION RECORDS NO REFERENCE (it writes nothing): the
              // connection in hand is the same either way; the job heals it.
              if (rBack.state === "incomplete" && !isPrep) {
                try { await healSiteBackendDb(env, ownerSlug, rBack.uid || ou.id, rBack.db); }
                catch (e) { console.error("rules edit reference heal failed:", ownerSlug, e && e.message); }
              }
              // ⚠ THE SCHEMA READ HAS THE SAME TWO OUTCOMES, ONE LINE DOWN —
              // found by the guard written for the resolution above, which got
              // past the fixed gate and straight into this one.
              //
              // `escalate("no-meta")` carries no layer either, so a schema read
              // that THREW bought the ~25-credit rewrite of every page for a
              // database that is up and simply could not be read this second. A
              // rewrite does not repair an unreadable `_meta` any more than it
              // repairs a missing reference. The two are split the way the four
              // backend states are: cannot-tell stops, genuinely-nothing-there
              // escalates to the step that can make something.
              // ⚠ AND ASKING `_meta` ALONE CANNOT TELL AT ALL — A MISSING ROW
              // IS NOT AN EMPTY DATABASE (2026-09-21, reproduced: `bookings`
              // exists, the schema row does not, and this rung escalated to a
              // PAID addon without ever looking at the table inventory). That
              // is an inference from the absence of ONE ROW to the absence of
              // every table, and it is run 47's own defect met on a third path.
              //
              // `specForAddon` IS THE READER, not a second one written here.
              // It asks `readSchemaState`, which asks the CATALOG FIRST, so its
              // four states are measured rather than inferred:
              //
              //   stored / empty            → `ok: true`, and `empty` means the
              //                               catalog CONFIRMED no tables
              //   tables-without-metadata   → recovered through the real
              //                               `policiesFor`/`grantsFor`, or
              //                               `ok: false` if any table cannot
              //                               be rebuilt without changing what
              //                               it does
              //   unreadable                → `ok: false`, named
              //
              // AND IT IS READ-ONLY. Nothing is written back to `_meta` here;
              // the reconciled spec is used for THIS message and the rung's own
              // apply writes the merged result if it gets that far. Recovering
              // somebody's stored schema as a side effect of reading it would
              // be a write nobody asked for, on the money path.
              const rRead = await specForAddon(rdb);
              // DRAFT-FIRST (2026-10-15): the rules as the draft has them, and
              // a rule on a published site held for Publish — a rule changes
              // what visitors' submissions do the moment it is applied.
              const rWriter = await backendWriter(env, ownerSlug);
              let rView = null;
              if (rWriter.on) {
                try { rView = await draftView(env, ownerSlug); }
                catch (e) { console.error("rules edit: draft unreadable", ownerSlug, errorClassForLog(e)); return Response.json({ status: 503, ok: false, error: "backend", cost: 0, ours: true, backend: "draft", unchanged: true, msg: "I couldn't read your draft just now, so nothing changed — try again in a moment." }, { status: 503 }); }
              }
              const rSpec = rView && rRead.ok ? specOverlay(rRead.spec, rView.ops) : rRead.spec;
              // THIS RULE'S SCHEMA WRITE GOES THROUGH ITS WRITER: the same name, the same arguments.
              const { applySiteSchema } = rWriter.calls;
              if (!rRead.ok) {
                console.error("rules edit schema read failed:", ownerSlug, rRead.why);
                return eAnswer({
                  status: 503, ok: false, error: "backend", cost: 0, ours: true, backend: rRead.why, unchanged: true,
                  msg: "I couldn't read what your site's database is set up to do just now, so I've stopped rather than guess — this is on us. Try again in a few minutes.",
                });
              }
              // NO TABLES AND A CATALOG THAT CONFIRMS IT is a real answer:
              // there is nothing here to make a rule about. The addon step is
              // where a table is made, so it is named — the same legitimate
              // fallback the `none` state keeps, and not the full rewrite.
              // Reached ONLY for `empty` now: `tables-without-metadata` either
              // recovered above, in which case `tables` is not empty, or
              // refused with `ok: false` and never arrives here at all.
              if (!rSpec || !Array.isArray(rSpec.tables) || !rSpec.tables.length) {
                return escalate("no-meta", { layer: "addon" });
              }
              // A RECOVERED TABLE IS SAID OUT LOUD, because the spec this rung
              // is about to design against is not the one the site has stored.
              if (Array.isArray(rRead.recovered) && rRead.recovered.length) {
                console.log("rules edit recovered undeclared tables:", ownerSlug, rRead.recovered.join(","));
              }

              // EVERY TABLE, unlike the data layer's `display`-only list. A rule
              // is about who may reach a table and what it refuses, and the
              // tables that most need one — a booking list, an enquiry form —
              // are exactly the `collect` ones the data layer will not touch.
              // Nothing here reads a ROW, so no customer's data is shown to a
              // model: the digest is names, columns, types and rules.
              // BILLED BEFORE THE SCHEMA IS TOUCHED (2026-09-05, 1a-ii) — the
              // data rung's shape: the module asks `before` with the usage in
              // hand and no DDL emitted.
              let rCost = 0, rBilled = false, rStop = null;
              const rOut = await runRulesEdit({
                send: eQuick(),
                mark: traceRetryMark(editTrace),
                seen: (x) => noteSeen(eJob, x),
                // PREPARED: the rules are chosen; nothing is granted here.
                before: async (usage) => { if (isPrep) { eJob.reached = (Number(eJob.reached) || 0) + 1; return false; } rCost = await eCharge(usage); rBilled = true; if (eCharges.refused() > 0) return false; rStop = await applyStop(eJob); return !rStop; },
                // ONE APPLY FOR THE MERGED SPEC. `applySiteSchema` re-emits
                // every table's REVOKEs, grants and policies in order, which is
                // what makes a pair change and a `retired` take effect on a
                // table that already exists — and it persists `_meta` itself, so
                // there is no second write that could disagree with the DDL.
                apply: async (spec) => { const made = await applySiteSchema(rdb, normalizeSchema(spec)); return { refusedRules: (made && Array.isArray(made.refusedRules)) ? made.refusedRules : [] }; },
              }, { instruction: eInstruction, tables: rSpec.tables, scope: stepScopeOf(eb && eb.scope), model: eQuickModel,
                // THE ANSWERS THIS STEP IS SHOWN, so a widening they confirmed is theirs (audit A29-9).
                answers: (readContext(eCtx) || []).map((p) => p.a) });
              // A QUESTION BACK (2026-10-02): this step's model asked instead of acting.
              if (rStop) return await editStopped(env, { job: eJob, why: rStop, phase: "apply", trace: editTrace, ctx });
              // THE WIDENING QUESTION, WORDED BY THE WRITER FROM ITS FACTS (decide-all, sec-3).
              if (rOut.ask) return stepAsk("rules", Array.isArray(rOut.widening) && rOut.widening.length ? await wideningQuestion(env, { ask: rOut.ask, widening: rOut.widening, request: eRun, answers: readContext(eCtx) || [], picker: eb && eb.picker, slug: ownerSlug }) : rOut.ask);

              // ALREADY SO (2026-10-25, run 6): every rule asked for is the one
              // the table has; nothing applied, so nothing is charged — the menu
              // editor's `satisfied`. The facts (`already`) go to the reply.
              // SPAM PROTECTION AS A FACT (2026-10-25): whether every visitor
              // form is checked (`spamCheckOn`), so a reply can say it is
              // already on from the platform's state, never from the wording.
              const rSpam = () => spamCheckOn(env, ownerSlug, rdb).then((v) => (typeof v === "boolean" ? v : undefined), () => undefined);
              if (rOut.ok && rOut.satisfied === true) {
                return Response.json({ ok: true, satisfied: true, layer: "rules", applied: [], already: rOut.already, refused: rOut.refused || [], cost: 0, usage: rOut.usage, spamCheck: await rSpam() });
              }
              if (!rOut.ok) {
                if (!rOut.escalate) {
                  if (rOut.reason === "send") return modelDown(rOut.error, "I couldn't reach the model that sets that rule — try again in a moment.");
                  // THE LEDGER REFUSED, before any DDL was emitted.
                  if (rOut.reason === "unbilled") return unbilledReply(eCharges);
                  return Response.json({
                    // A RULES EDIT THAT CHANGED NOTHING IS NEVER BILLED (2026-10-25,
                    // run 6): a no-match took the reading's price for nothing.
                    ok: false, error: rOut.reason, cost: rBilled ? rCost : (rOut.reason === "no-match" ? 0 : await eCharge(rOut.usage)), usage: rOut.usage,
                    spamCheck: rOut.reason === "no-match" ? await rSpam() : undefined,
                    // A REFUSAL IS SAID IN FULL. `rulesReply` is the one place
                    // that turns a refused rule into words, and a no-match that
                    // silently reads as "nothing happened" is how a booking
                    // table that still takes double bookings looks like success.
                    msg: rOut.reason === "no-match"
                      ? rOut.msg
                      : "That change couldn't be saved — try again.",
                  }, { status: 422 });
                }
                // `no-tables` IS THE ONLY REASON `runRulesEdit` ESCALATES WITH
                // (unreachable behind the `no-meta` check above, which answers
                // first). Named with the add-on's layer like its two siblings:
                // a rule needs a table, and making one is that step's.
                return escalate("no-tables", { layer: "addon" });
              }
              // THE HELD RULE IS THIS TASK'S REVISION OF THE DRAFT.
              let rSealed = { ok: true, revision: 0 };
              if (rWriter.holding) {
                rSealed = await sealHeld(env, ownerSlug, rWriter, { job: eJob ? String(eJob.id) : null });
                if (!rSealed.ok) return Response.json({ ok: false, error: "draft", ours: true, cost: rBilled ? rCost : await eCharge(rOut.usage), usage: rOut.usage, msg: "I couldn't save that change to your draft just now, so nothing changed — try again in a moment." }, { status: 503 });
              }
              return Response.json({
                ok: true, layer: "rules", applied: rOut.applied, refused: rOut.refused || [], already: Array.isArray(rOut.already) && rOut.already.length ? rOut.already : undefined,
                msg: rOut.msg, cost: rBilled ? rCost : await eCharge(rOut.usage), usage: rOut.usage, spamCheck: await rSpam(),
                draft: rSealed.revision ? heldDraft(rSealed.revision) : undefined,
              });
            }
            if (eLayer === "rename") {
              // ── THE SITE'S ADDRESS (2026-08-29, owner: "yeah do the alias one")
              //
              // NOTHING MOVES. The slug stays the key to every R2 prefix, every
              // table and the dispatch script; what changes is the NAME the site
              // answers to. See builder/site-alias.mjs for why a copy-and-delete
              // was rejected — briefly: R2 has no rename, so the copy is a loop
              // of PUTs with no transaction, and the alias record it would still
              // need is the entire feature on its own.
              // DRAFT-FIRST (2026-10-15): on a published site a change of address
              // asked in chat is HELD — the live address, its aliases, its
              // redirects and the sidecar's origin move only when the revision
              // carrying it is published. The address the draft has is the one
              // this message is about.
              const nWriter = await backendWriter(env, ownerSlug);
              let nView = null;
              if (nWriter.on) {
                try { nView = await draftView(env, ownerSlug); }
                catch (e) { console.error("rename: draft unreadable", ownerSlug, errorClassForLog(e)); return explain("rename/rename-store", {}, { detail: "draft" }); }
              }
              const liveName = await publicNameFor(env, ownerSlug);
              const current = nView ? addressOverlay(liveName, nView.ops) : liveName;
              const nSeal = async (op) => {
                nWriter.hold.add(op);
                return sealHeld(env, ownerSlug, nWriter, { job: eJob ? String(eJob.id) : null });
              };

              // NOTHING IS GUESSED. Every other lane biases toward acting,
              // because a wrong edit is visible and undoable. This one is
              // neither — the old address 301s forever after — so a message with
              // no name in it is a refusal, not an attempt. Second place on the
              // platform where the bias inverts, after the `pages` verb.
              let rq;
              try {
                // THE PICKED MODEL AND THE MATCHING PROVIDER — this sent
                // `LANE_MODEL` (now the picker table's DEFAULT, not the
                // customer's) to a hardcoded Anthropic endpoint, so a Sonnet
                // customer's rename was both priced and addressed wrong.
                rq = await eQuick()(renameRequest({
                  message: eInstruction, current, former: await formerNamesFor(env, ownerSlug), model: eQuickModel,
                }));
              } catch (e) {
                return modelDown(e, "The editor is busy — try again in a moment.");
              }
              const wanted = readRename(rq);
              const rUsage = laneUsage(rq, eQuickModel);

              // ── FORGETTING AN OLD ADDRESS (owner, 2026-09-02: "i want that") ──
              //
              // The other thing a customer says about their address after a
              // rename: make the old one stop working. It deletes the old
              // name's row, so the address stops answering and the name is
              // free for anyone; the storage name's row goes the same way and
              // the resolver reads the gap (see `resolveAlias`). ONE REQUEST
              // BOTH CHECKS AND DELETES: the row must carry this site's slug
              // and must not be current, and PostgREST hands back what it
              // removed — nothing removed is "not one of this site's old
              // addresses", said as such. The current name is refused first,
              // by name, because forgetting it would leave the site with no
              // address at all. A new address in the same answer wins over a
              // forget: the model was told to answer one or the other.
              const drop = wanted ? null : readForget(rq);
              if (drop) {
                if (drop === current) {
                  return Response.json({ ok: false, layer: "rename", cost: await eCharge(rUsage),
                    msg: aliasRefusal(drop, { live: true }) }, { status: 422 });
                }
                // THE SITE'S OWN QR CODES (audit A31-1, #189; owner, 2026-10-23:
                // refuse, naming them). A code made before a rename stores the
                // old host; forgetting it would leave every such code opening
                // nothing, or a stranger's site once the name is claimed. Read
                // before either path (held or immediate); an unreadable look
                // refuses rather than forget blind.
                {
                  const fHost = siteHostFor(drop);
                  let fLook = null;
                  try {
                    const c = await readSiteConfig(env, ownerSlug, null);
                    if (!c.ok) return explain("rename/rename-store", {}, { detail: "look read" });
                    fLook = c.config && c.config.look;
                  } catch { return explain("rename/rename-store", {}, { detail: "look read" }); }
                  const fCodes = qrCodesOnHost(fLook && fLook.qr, fHost);
                  if (fCodes.length) {
                    return Response.json({ ok: false, layer: "rename", qrBlocked: fCodes.map((c) => c.name), cost: await eCharge(rUsage),
                      refusal: { code: "qr-forget-blocked", host: fHost || drop, codes: fCodes.map((c) => c.name) },
                      msg: qrForgetRefusal(fHost || drop, fCodes) }, { status: 422 });
                  }
                }
                // HELD: the old address keeps answering until Publish. It must
                // be one of this site's old addresses now, or the draft's
                // own previous name.
                if (nWriter.holding) {
                  const row = await aliasRowFor(env, drop);
                  const ours = (row && row !== NO_ALIAS && row.slug === ownerSlug) || drop === liveName;
                  if (row === null) return explain("rename/rename-store", {}, { detail: "alias read" });
                  if (!ours) {
                    return Response.json({ ok: false, layer: "rename", cost: await eCharge(rUsage),
                      msg: aliasRefusal(drop, { stranger: true }) }, { status: 422 });
                  }
                  const sealed = await nSeal({ kind: "alias", action: "forget", name: drop });
                  if (!sealed.ok) return Response.json({ ok: false, layer: "rename", error: "draft", ours: true, cost: await eCharge(rUsage), msg: "I couldn't save that to your draft just now, so nothing changed — try again in a moment." }, { status: 503 });
                  const gone = siteHostFor(drop);
                  return Response.json({
                    ok: true, layer: "rename", forgotInDraft: drop, draft: heldDraft(sealed.revision), cost: await eCharge(rUsage),
                    msg: "When you publish, " + (gone || drop) + " will stop answering. Until then it still works.",
                  });
                }
                const d = await fetch(
                  `${SUPABASE_URL}/rest/v1/site_aliases?alias=eq.${encodeURIComponent(drop)}&slug=eq.${encodeURIComponent(ownerSlug)}&current=is.false`,
                  { method: "DELETE", headers: svcHeaders(env, { Prefer: "return=representation" }), signal: AbortSignal.timeout(15000) });
                // OUR STORE REFUSED — explained, never the rewrite, which does not
                // move an address at all (2026-09-23). Nothing was deleted.
                if (!d.ok) return explain("rename/rename-store", {}, { detail: (await d.text().catch(() => "")).slice(0, 200) });
                const removed = await d.json().catch(() => null);
                if (!Array.isArray(removed) || !removed.length) {
                  return Response.json({ ok: false, layer: "rename", cost: await eCharge(rUsage),
                    msg: aliasRefusal(drop, { stranger: true }) }, { status: 422 });
                }
                forgetAlias(ownerSlug, drop);
                const gone = siteHostFor(drop);
                return Response.json({
                  ok: true, layer: "rename", forgot: drop, cost: await eCharge(rUsage),
                  msg: "Done — " + (gone || drop) + " no longer answers."
                    // The storage name cannot be claimed by anybody else — it is
                    // still this site's key — so that half is only said of an alias.
                    + (drop === ownerSlug ? "" : " Anyone can claim that name now."),
                });
              }
              if (!wanted) {
                return Response.json({
                  ok: false, layer: "rename", cost: await eCharge(rUsage),
                  msg: "Tell me what you would like the address to be — for example \u201Ccall it sunset-shoes\u201D — and I will move it.",
                }, { status: 422 });
              }

              // ── IS IT FREE? THREE WAYS IT MIGHT NOT BE ────────────────────
              //
              // Checked before anything is written, and all three answer a
              // DIFFERENT sentence: a customer told "that name is taken" for a
              // name that is merely malformed goes looking for a conflict that
              // does not exist. `aliasRefusal` owns the wording so the lane and
              // the route cannot drift apart.
              if (wanted === current) {
                return Response.json({ ok: false, layer: "rename", cost: await eCharge(rUsage),
                  msg: aliasRefusal(wanted, { same: true }) }, { status: 422 });
              }
              // Reserved subdomains are refused by `siteHostFor` answering null,
              // which is the same check the build path trusts.
              if (!siteHostFor(wanted)) {
                return Response.json({ ok: false, layer: "rename", cost: await eCharge(rUsage),
                  msg: aliasRefusal(wanted, { reserved: true }) }, { status: 422 });
              }
              // TAKEN MEANS EITHER: a site built under that slug, or a name
              // another site has ever answered to. Both are real conflicts — the
              // second is the whole reason old names stay claimed.
              // A SITE MAY RETURN TO ITS OWN STORAGE NAME (run 18, 2026-09-02).
              // The storage slug is a site on the platform — this one — and
              // asking "is that name a site?" answered yes and refused the way
              // back as "taken by another site". It is taken by nobody else:
              // the alias row for it, written when the site left, carries this
              // site's own slug, which the alias check below already reads as
              // no conflict. Only the site check needed telling.
              const takenBySite = wanted === ownerSlug ? false : await siteNameTaken(env, wanted);
              const takenByAlias = await aliasRowFor(env, wanted, { fresh: true });
              const aliasConflict = takenByAlias && takenByAlias !== NO_ALIAS && takenByAlias.slug !== ownerSlug;
              // A LOOKUP WE COULD NOT MAKE IS NOT A FREE NAME. Both lookups
              // answer null when they could not ask, and handing out a name on
              // that basis is how two sites end up sharing an address.
              if (takenBySite !== false || aliasConflict || takenByAlias === null) {
                return Response.json({ ok: false, layer: "rename", cost: await eCharge(rUsage),
                  msg: aliasRefusal(wanted, { taken: true }) }, { status: 422 });
              }

              const rows = renameRows({ slug: ownerSlug, uid: ou.id, from: current, to: wanted });
              if (!rows) {
                return Response.json({ ok: false, layer: "rename", cost: await eCharge(rUsage),
                  msg: aliasRefusal(wanted, {}) || "That name will not work as a web address." }, { status: 422 });
              }
              // HELD: the live address, its aliases and the sidecar move at Publish.
              if (nWriter.holding) {
                const sealed = await nSeal({ kind: "alias", action: "rename", from: current, to: wanted });
                if (!sealed.ok) return Response.json({ ok: false, layer: "rename", error: "draft", ours: true, cost: await eCharge(rUsage), msg: "I couldn't save that to your draft just now, so nothing changed — try again in a moment." }, { status: 503 });
                const addrH = siteHostFor(wanted);
                return Response.json({
                  ok: true, layer: "rename", renamedInDraft: wanted, draft: heldDraft(sealed.revision), cost: await eCharge(rUsage),
                  msg: "When you publish, your site moves to " + (addrH || wanted) + " and " + (siteHostFor(liveName) || liveName) + " will send people there. Until then it stays at " + (siteHostFor(liveName) || liveName) + ".",
                });
              }
              // THE OLD NAME FIRST, THE NEW ONE SECOND, and the ORDER is the
              // recovery story rather than style — see `renameRows`. A failure
              // between them leaves the site exactly where it started.
              const putAlias = async (row) => {
                const w = await fetch(`${SUPABASE_URL}/rest/v1/site_aliases`, {
                  method: "POST",
                  headers: svcHeaders(env, { "content-type": "application/json", Prefer: "resolution=merge-duplicates" }),
                  body: JSON.stringify(row),
                  signal: AbortSignal.timeout(15000),
                });
                return w.ok ? null : (await w.text().catch(() => "")).slice(0, 200);
              };
              // ⚠ EXPLAINED, AND THE SECOND ONE DOES NOT SAY NOTHING CHANGED.
              // These escalated with no layer — the rewrite of every page, which
              // cannot move an address — over a failure of our own store. The
              // first write failing leaves the rows as they were; the SECOND
              // failing leaves the old name demoted and the new one unwritten,
              // which is a change, so that reply must not carry `unchanged`.
              const badOld = await putAlias(rows.demote);
              if (badOld) return explain("rename/rename-store", {}, { detail: badOld });
              const badNew = await putAlias(rows.promote);
              if (badNew) return explain("rename/rename-store", {}, { detail: badNew, unchanged: false });
              forgetAlias(ownerSlug, current, wanted);

              // ── AND THE HEAD FOLLOWS, WITHOUT A COMPILE ───────────────────
              //
              // The canonical link and `og:url` are read per request out of the
              // R2 sidecar's `origin`. Until 2026-09-02 this branch republished
              // to move them — and the spine wrote that field FROM THE STORAGE
              // SLUG at both publish sites, so the republish would have baked
              // the old address straight back. The first live rename (run 17,
              // fretwork-1 → crookes-guitar) then lost its publish to a consumer
              // that died in the compile, and the new address served a canonical
              // naming the old one: alias live, head stale, nothing to retry.
              //
              // Now the spine derives the origin through `publicUrlFor`, and
              // this patches that one key the moment the alias is current — the
              // share and verify routes' pattern: the site's own Worker reads
              // its head out of the sidecar, so patching the key IS the
              // deployment. No container, nothing to lose in a four-minute
              // compile, nothing a lost lease can leave half-done. A rename
              // beside a colour change in the same sentence still publishes
              // once, through the other rung's `publishStep`.
              //
              // BEST-EFFORT, AND IT SAYS SO: the alias is live either way, and
              // a failure here means the canonical follows at the next publish
              // — a delay rather than a loss — which the reply then names.
              let live = false;
              try {
                const cur = await env.SITES_BUCKET.get(siteMetaKey(ownerSlug));
                const side = sidecarOf(cur ? await cur.text() : null);
                side.origin = addressOf(wanted);
                rehostShareImage(side, wanted);
                await env.SITES_BUCKET.put(siteMetaKey(ownerSlug), JSON.stringify(side), { httpMetadata: { contentType: "application/json" } }); await ownBucketMarker(env, ownerSlug, "sync");
                live = true;
              } catch (e) { console.error("rename sidecar patch failed:", ownerSlug, e && e.message); }
              const addr = siteHostFor(wanted);
              return Response.json({
                ok: true, layer: "rename", renamed: wanted, url: addr ? "https://" + addr + "/" : null, live,
                cost: await eCharge(rUsage),
                msg: "Done — your site is now at " + (addr || wanted) + ". The old address still works and sends people to the new one."
                  + (live ? "" : " Search engines will pick up the new address with your next change."),
              });
            }
            if (eLayer === "nav") {
              // ── THE MENU, ON EVERY PAGE AT ONCE ─────────────────────────
              //
              // The nav is a `links` array passed to `SiteChrome` and there is a
              // SEPARATE COPY IN EVERY PAGE FILE. Measured over the 324 family
              // exemplars the generator learns from: 302 arrays across 93
              // families, and not one family where every page's list is the
              // same. So reordering, adding or removing one item meant a
              // structural edit on every page, and the only lane that touches
              // every page is the full revise — ~27 credits to move one word.
              //
              // ONE MODEL CALL AND A MECHANICAL REWRITE, so the price does not
              // grow with the number of pages, which is exactly what made this
              // expensive. The `text` layer can already RENAME an item and this
              // is deliberately not that: a string replacement at a recorded
              // offset cannot move, insert or delete an array element.
              //
              // THE ROUTES ARE THE ALLOW-LIST. A menu item pointing at a page
              // the site does not have is a 404 from every page at once, so the
              // real route list goes in and anything else is dropped and named.
              //
              // AND EVERY LINK WRITTEN INTO THE COPY, for the same reason and
              // at the same price. Measured over the 337 pages the generator
              // learns from and writes: 600 links in the chrome and 469 in the
              // page bodies, where the only lane that could touch one was
              // `page` — one page at a time, one model call, for a destination.
              // The `text` layer cannot help either: it refuses `href` and `to`
              // by name, which is the rule that stops it rewriting a route id.
              const navRoutes = [...new Set(eSrc.map((p) => routeOf(p.path)).filter(Boolean))];
              // ── AN ADDITION THE ADD-ON STEP HANDED HERE (2026-10-02) ──────
              //
              // A new menu link, footer link or header button is the add-on
              // step's (`frame`, `site-add.mjs`), whose work is this rung; the
              // browser posts that hop with `addition: true`. It only ever
              // NARROWS what the rung may do — nothing the frame has is
              // changed, replaced or taken away (`additionOnly`) — so a
              // client that sends it can only make an edit more careful.
              // ── A WRITTEN FRAME IS EDITED AS SOURCE (2026-10-23) ──────────
              //
              // A site built since `build-ai-writes-all` has no `SiteChrome`:
              // its header and footer are its own files under `-parts/`, so
              // the menu editor below would find no props to read and answer
              // `no-nav`. Such a site's menu, header button, footer contact,
              // hours and social links are changed by editing those two files
              // (`runFrameEdit`): one call, the files checked (routes, kit,
              // default export), then the publish compiles them. A site with
              // `SiteChrome` never enters here (`writtenFrame` answers null).
              {
                const fRead = await editParts();
                if (fRead.ok && writtenFrame(eSrc, fRead.parts)) {
                  const fOut = await runFrameEdit({ send: eQuick() }, {
                    instruction: eInstruction, pages: eSrc, parts: fRead.parts, routes: navRoutes,
                    model: eQuickModel, addition: eb.addition === true,
                    // THE TABLES A FORM HERE MAY STORE INTO (2026-10-25, frame-parallel).
                    tables: await frameTablesOf(env, ownerSlug),
                    // THE SITE MAP'S FRAME SLICE (2026-10-26): facts beside the live tables.
                    note: (() => { try { return mapFor("frame", buildSiteMap({ pages: eSrc, parts: fRead.parts })); } catch { return ""; } })(),
                  });
                  if (fOut.ask) return stepAsk("nav", fOut.ask);
                  if (!fOut.ok && fOut.reason === "send") return modelDown(fOut.error, "I couldn't reach the model that sets the menu — try again in a moment.");
                  if (!fOut.ok && fOut.reason === "unchanged") {
                    return Response.json({
                      ok: true, satisfied: true, layer: "nav", frame: true, changed: [], msg: fOut.msg,
                      cost: eJob ? 0 : await eCharge(fOut.usage), usage: fOut.usage,
                    });
                  }
                  if (!fOut.ok) {
                    return Response.json({
                      // A REFUSED FRAME EDIT IS NOT CHARGED (owner, 2026-10-25): nothing
                      // changed, after one retry with the check's reason (`runFrameEdit`).
                      ok: false, error: fOut.reason, frame: true, cost: 0, usage: fOut.usage, retried: fOut.retried || undefined,
                      problems: fOut.problems || undefined, msg: fOut.msg,
                    }, { status: 422 });
                  }
                  const fPub = await publishStep(env, {
                    slug: ownerSlug, pages: eSrc, parts: fOut.parts,
                    label: versionLabel({ revise: true, changeNote: eRun }),
                  });
                  if (!fPub.ok) {
                    return Response.json({
                      ok: false, error: lostOr(fPub, "compile"), cost: 0, frame: true,
                      msg: compileMsg(fPub, "That change to the header or footer didn't compile, so your site is untouched."),
                      detail: fPub.detail,
                    }, { status: 422 });
                  }
                  return Response.json({
                    ok: true, frame: true, layer: "nav", msg: fOut.msg, changed: fOut.changed,
                    files: fPub.files, render: fPub.render, renderNote: fPub.renderNote, checks: fPub.checks, draft: fPub.draft,
                    cost: await eCharge(fOut.usage, fPub), usage: fOut.usage,
                  });
                }
              }
              const nOut = await runNavEdit({
                send: eQuick(),
                mark: traceRetryMark(editTrace),
              }, { instruction: eInstruction, pages: eSrc, routes: navRoutes, model: eQuickModel, addition: eb.addition === true });
              // A QUESTION BACK (2026-10-02): this step's model asked instead of acting.
              if (nOut.ask) return stepAsk("nav", nOut.ask);

              // ── AN ADDITION ALREADY TRUE IS DONE (2026-10-04, run 95's F1) ──
              //
              // Every item it named was already in every list it was asked
              // for, so there is nothing to publish and nothing is. The work
              // was not done because it was not needed, so it is not charged
              // as work: a queued job takes no reserve for it — the same net
              // as the refund a queued refusal gets — and the synchronous
              // path keeps a refusal's rule (the reading taken, nothing given
              // back). What chose this route was charged where it ran and
              // stays. `ok`, so a request part that waited on it goes on.
              if (nOut.ok && nOut.satisfied === true) {
                return Response.json({
                  ok: true, satisfied: true, layer: "nav", changed: [], msg: nOut.msg,
                  already: nOut.already,
                  cost: eJob ? 0 : await eCharge(nOut.usage), usage: nOut.usage,
                });
              }
              if (!nOut.ok) {
                if (!nOut.escalate) {
                  if (nOut.reason === "send") return modelDown(nOut.error, "I couldn't reach the model that sets the menu — try again in a moment.");
                  return Response.json({
                    ok: false, error: nOut.reason, cost: await eCharge(nOut.usage), usage: nOut.usage,
                    // A STRUCTURED REFUSAL (decide-all), for the reply writer.
                    refusal: nOut.refusal || undefined,
                    // The module writes this — it is the only thing that knows
                    // which items were dropped and why.
                    msg: nOut.msg || "That change couldn't be made — try again.",
                  }, { status: 422 });
                }
                // `no-nav` IS THE ONLY REASON `runNavEdit` ESCALATES WITH: no
                // menu, header button or link on any page. Explained (2026-09-23)
                // — a rewrite of every page is not the answer to a menu the site
                // does not have.
                return explain("nav/no-nav");
              }
              const nPub = await publishStep(env, {
                slug: ownerSlug, pages: nOut.pages,
                label: versionLabel({ revise: true, changeNote: eRun }),
              });
              if (!nPub.ok) {
                return Response.json({
                  ok: false, error: lostOr(nPub, "compile"), cost: 0,
                  msg: compileMsg(nPub, "That menu change didn't compile, so your site is untouched."),
                  detail: nPub.detail,
                }, { status: 422 });
              }
              return Response.json({
                ok: true, layer: "nav", msg: nOut.msg,
                changed: nOut.changed, files: nPub.files, render: nPub.render, renderNote: nPub.renderNote, checks: nPub.checks, draft: nPub.draft,
                links: nOut.links,
                // AN ADDITION'S ITEMS THAT WERE THERE ALREADY (2026-10-04), by
                // list — omitted on every other menu change.
                already: nOut.already || undefined,
                // EVERY ENTRY LEFT OUT, BY NAME AND REASON (2026-10-03), where a
                // count stood: a menu item, a footer entry or a button the
                // answer named and the step could not use. The step's sentence
                // (`msg`) already said each; the answer now carries each too.
                // A phone number's digits stay out of it, the `contact` rule.
                dropped: Array.isArray(nOut.dropped) && nOut.dropped.length
                  ? nOut.dropped.map((d) => ({
                    label: d.label || undefined,
                    href: d.href && !/^tel:/i.test(d.href) ? d.href : undefined,
                    why: d.why, list: d.list || undefined, button: d.button || undefined, second: d.second || undefined,
                  }))
                  : undefined,
                // AND THE BUTTON, when this change touched it. Omitted when it
                // did not, so a menu-only change's response is unchanged.
                action: nOut.action || undefined, removedAction: nOut.removedAction || undefined,
                // AND THE SECOND BUTTON, the same way.
                secondAction: nOut.secondAction || undefined, removedSecondAction: nOut.removedSecondAction || undefined,
                // AND THE LINKS IN THE COPY. `movedLinks` counts what really
                // changed and `refusedLinks` carries the ones that could not —
                // a link the model named and we would not repoint is a change
                // the customer believes happened, which is the one shape this
                // response must not have.
                movedLinks: nOut.movedLinks || undefined,
                // EACH, BY ITS WORDS AND REASON (2026-10-03), where a count stood.
                refusedLinks: nOut.refusedLinks && nOut.refusedLinks.length
                  ? nOut.refusedLinks.map((x) => ({ label: x.label || undefined, from: x.from || undefined, to: x.to || undefined, why: x.why }))
                  : undefined,
                // AND THE FOOTER'S CONTACT DETAILS. Names WHICH fields moved and
                // never their values — a response is logged, and an address and
                // a phone number are the customer's own. Omitted when the change
                // did not touch them, so every existing menu edit's response is
                // byte-identical.
                contact: nOut.contact ? Object.keys(nOut.contact) : undefined,
                // AND THE TWO FOOTER LISTS, as counts. Same rule as `contact`:
                // which lists moved and how many entries each ended with, never
                // the addresses themselves.
                lists: nOut.lists
                  ? Object.fromEntries(Object.entries(nOut.lists).map(([k, v]) => [k, v.length]))
                  : undefined,
                // AND THE FRAME'S ARRANGEMENT. Values, not just names — unlike
                // the two above, these are OUR enum ("centre", "full", false),
                // never anything the customer typed, so there is nothing of
                // theirs to keep out of a log.
                layout: nOut.layout || undefined,
                cost: await eCharge(nOut.usage, nPub), usage: nOut.usage,
              });
            }
            if (eLayer === "picture" && eJob && eJob.purchase && Array.isArray(eb && eb.place) && eb.place.length) {
              // ── AN ADDITION'S MARKED FRAMES, FILLED (2026-10-09, round 5) ──
              //
              // The addition published with frames whose purchase nobody could
              // tell, each marked with that purchase (`markPending`). Now that
              // every one is known, each frame is filled with its own purchase's
              // photograph — reused when it landed, bought once when the
              // customer released it — and nothing else on the site is touched.
              // No model call: the frame, the description and the purchase are
              // all already decided. Still unknown: held again, nothing published.
              const place = readPlace(eb.place);
              const plParts = await editParts();
              let plFiles = (plParts.ok ? editableFiles(eSrc, plParts.parts) : eSrc).map((f) => ({ ...f }));
              let plBalance = await readCreditsFor(env, eJob.uid).catch(() => 0);
              // THE PAGE'S OWN PARSER (round 6): a frame is filled only where the
              // tree shows its mark still right after the empty literal the
              // addition left — never by a guess at where it went.
              // IN THE WORKER'S ISOLATE (an `inline` job, round 7) the site's own
              // container reads them, with the same code (`framesFor`).
              const plFrames = await framesFor(env, ownerSlug);
              const plHeld = [], plPlaced = [], plNot = [];
              const plPurchase = (pp, buyIt) => purchaseOnce(env, {
                slug: ownerSlug, key: eJob.purchase.part.key, n: eJob.purchase.part.n, d: pp.d, k: pp.k, owner: "job:" + eJob.id,
                // WHERE THERE IS NO FRAME TO FILL, the purchase is only READ: one
                // that landed is reported saved, and nothing is ever begun.
                mayBuy: async () => buyIt,
                generate: async (dd, meta) => {
                  if (!imagesAffordable(1, { balance: plBalance, usd: SITE_PHOTO_USD })) return null;
                  const { url: plUrl } = await makeSitePhoto(env, ownerSlug, dd, meta);
                  if (plUrl) plBalance -= SITE_PHOTO_USD / CREDIT_USD;
                  return plUrl;
                },
              });
              /** A purchase with no frame to fill: read, never bought; told as saved when it landed. */
              const plNoFrame = async (pp, why) => {
                const out = await plPurchase(pp, false);
                if (out.state === "unknown") { plHeld.push({ id: out.id, d: pp.d, why: out.why }); return; }
                plNot.push({ d: pp.d, why, ...(out.state === "bought" ? { saved: true } : {}) });
              };
              for (const pp of place) {
                // NO FRAME COULD BE SAFELY FOUND WHEN THE ADDITION PUBLISHED.
                if (pp.located === false) { await plNoFrame(pp, "no-frame"); continue; }
                const where = plFiles.map((f, i) => (hasPendingMark(f.source, pp.id) ? i : -1)).filter((i) => i >= 0);
                // THE FRAME IS GONE (a later edit took it): nothing is bought for it.
                if (!where.length) { await plNoFrame(pp, "frame-gone"); continue; }
                // CHECKED BEFORE ANY PURCHASE: a frame changed after the addition
                // (the customer's own picture in it, say) is left exactly as it is.
                const dry = [];
                for (const i of where) dry.push(await plFrames.fill(plFiles[i].source, pp.id, "/u/check.jpg"));
                // THE FRAMES COULD NOT BE READ JUST NOW (the container did not
                // answer): held and asked again, never filled on a guess.
                if (dry.some((r) => r.unreachable)) { plHeld.push({ id: pp.id, d: pp.d, why: "frames-unreachable" }); continue; }
                if (dry.some((r) => r.unverified)) { await plNoFrame(pp, "unverified"); continue; }
                if (!dry.some((r) => r.filled > 0)) { await plNoFrame(pp, "frame-changed"); continue; }
                const out = await plPurchase(pp, true);
                if (out.state === "unknown") { plHeld.push({ id: out.id, d: pp.d, why: out.why }); continue; }
                if (out.state !== "bought") { plNot.push({ d: pp.d, why: "not-bought" }); continue; }
                const into = [];
                let lost = false;
                for (const i of where) {
                  const r = await plFrames.fill(plFiles[i].source, pp.id, out.url);
                  if (r.unreachable) { lost = true; break; }
                  if (r.filled > 0) { plFiles[i] = { ...plFiles[i], source: r.source }; into.push(plFiles[i].path); }
                }
                // BOUGHT, AND ITS FRAMES NOT READABLE THIS MOMENT: held on that
                // purchase, which the next look reuses — nothing bought again.
                if (lost) { plHeld.push({ id: pp.id, d: pp.d, why: "frames-unreachable" }); continue; }
                plPlaced.push({ d: pp.d, file: into[0], files: into });
              }
              if (plHeld.length) return heldPurchase(plHeld);
              if (!plPlaced.length) {
                return Response.json({ ok: true, layer: "picture", placed: 0, changed: 0, made: 0, notPlaced: plNot, cost: 0,
                  msg: "I couldn't fill the empty photo frame" + (plNot.length === 1 ? "" : "s") + " from the addition, so nothing changed." });
              }
              const plSplit = plParts.ok ? splitEditable(plFiles) : { pages: plFiles };
              const plPub = await publishStep(env, {
                slug: ownerSlug, pages: plSplit.pages,
                ...(plParts.ok ? { parts: plSplit.parts } : {}),
                label: versionLabel({ revise: true, changeNote: "photographs placed" }),
              });
              if (!plPub.ok) {
                return Response.json({ ok: false, error: lostOr(plPub, "compile"), cost: 0, msg: compileMsg(plPub, "Those photographs couldn't be placed, so your site is untouched."), detail: plPub.detail }, { status: 422 });
              }
              // EVERY PHOTOGRAPH PLACED IS CHARGED HERE, ONCE: the addition
              // charged only the photographs it placed itself (`made`), never
              // one whose purchase it could not tell.
              return Response.json({
                ok: true, layer: "picture", placed: plPlaced.length, made: plPlaced.length, changed: plPlaced.length,
                files: plPub.files, render: plPub.render, renderNote: plPub.renderNote, checks: plPub.checks, draft: plPub.draft,
                notPlaced: plNot.length ? plNot : undefined,
                msg: "I put " + (plPlaced.length === 1 ? "the photograph" : plPlaced.length + " photographs") + " into the frame" + (plPlaced.length === 1 ? "" : "s") + " the addition left waiting.",
                cost: await eCharge([], { images: plPlaced.length }, plPub),
              });
            }
            if (eLayer === "picture") {
              // ── A PHOTOGRAPH ON A PAGE THAT ALREADY EXISTS ──────────────
              //
              // Pictures were bought at BUILD time and after that nothing could
              // touch them: a revise buys none (it re-derives the same budget
              // against fresh descriptions, so ~94 credits of NEW photographs
              // for ones the owner already had) and no lane could swap one. So
              // "use a photo of MY shop instead" had no path at all.
              //
              // THE FREE HALF IS THE USEFUL HALF TODAY. Every `SafeImage` on
              // every published site is drawing its placeholder, because the
              // image balance has never been funded — so the owner's OWN
              // photographs, which need no image model, are what actually fills
              // them, and are better than a made-up one for a business that has
              // them.
              // A WORKING BALANCE, DECREMENTED AS PHOTOGRAPHS ARE BOUGHT.
              //
              // This was read once and never moved, so the per-picture
              // affordability check below could not bind across a batch: an
              // account with 20 credits passed the same check three times and
              // bought three photographs it could afford one of. The comment on
              // that check already said a batch that can afford two of three
              // must buy the two; nothing implemented it.
              // BY UID ON THE QUEUED PATH, by token on the synchronous one. A
              // replay has no bearer token to present and reading zero would
              // decline photographs the customer can afford.
              let balance = await (eJob ? readCreditsFor(env, eJob.uid) : readCredits(eAuth)).catch(() => 0);
              // ── AND THE PHOTOGRAPHS IN THE SITE'S OWN COMPONENTS (2026-09-23) ──
              //
              // ⚠ THIS RUNG READ THE PAGES ALONE, and since the band split a
              // section — its photograph included — lives in its own file under
              // `-parts/`. REPRODUCED through the route: a site whose only
              // photograph sat in `photo-wall.tsx` answered `no-slots`, which
              // escalated with no layer — the rewrite of every page, to swap one
              // picture. The text rung met the same wall on 2026-09-11 and this
              // is its fix, one rung over: `editableFiles` presents each
              // component with a path, which is all `imageSlots` and
              // `applyPictures` look at, and `splitEditable` puts them back
              // before anything publishes.
              //
              // ⚠ AND A STORE THAT COULD NOT BE READ MUST NOT PUBLISH AS EMPTY.
              // That is the text rung's recorded defect: a failed read presented
              // as no components, handed to the spine as `parts: []`, deleted
              // every component on the site. So the components are handed over
              // only when they were READ; otherwise this runs on the pages as it
              // always did and the spine re-sends the store's own copy — and a
              // photograph it then cannot find is said to be unfindable because
              // of the store, not because the site has none.
              const picParts = await editParts();
              const picFiles = picParts.ok ? editableFiles(eSrc, picParts.parts) : eSrc;
              // THE PHOTO ATTACHED TO THIS MESSAGE (audit A25-1, #162; owner,
              // 2026-10-23): stored as the owner's upload and offered first, so
              // "use this photo" places it instead of buying one.
              const picAttached = Array.isArray(eb && eb.images) && eb.images.length
                ? await storeAttachedPhotos(eb.images.slice(0, MAX_ATTACHMENTS), attachments(eb.images.slice(0, MAX_ATTACHMENTS)).named, (name, bytes) => storeOwnPhoto(env, ownerSlug, name, bytes))
                : { files: [], missing: [] };
              const pOut = await runPictureEdit({
                send: eQuick(),
                mark: traceRetryMark(editTrace),
                // The owner's upload library, named the way they see it.
                library: async () => {
                  // A PICTURE BOUGHT FOR THIS VERY PART (2026-10-09, round 3), by
                  // any of its attempts or jobs, is not yet the owner's library:
                  // this part places it. Hidden from its own listing, so the
                  // listing is the one its first attempt was asked with.
                  const ownPart = eJob && eJob.purchase && eJob.purchase.part ? eJob.purchase.part : eJob && eJob.prepare === true && eJob.rec && eJob.rec.part ? eJob.rec.part : null;
                  const mine = ownPart ? await partPurchases(env, ownPart) : new Set();
                  // PICTURES ONLY (2026-10-14): a video, a recording or a
                  // document is never offered as a picture to place.
                  // NEVER A VISITOR'S UPLOAD (2026-10-18, audit A03-2): a
                  // stranger's file sent through the site's form is not the
                  // owner's photograph, and was offered as one to place.
                  return attachedFirst(picAttached.files, (await siteUploadList(env, ownerSlug))
                    .filter((o) => o && !o.visitor && uploadIsImage(uploadFileName(o.key)))
                    .map((o) => ({ name: uploadFileName(o.key), url: uploadUrl(ownerSlug, uploadFileName(o.key)), purchase: o.purchase }))
                    // A PICTURE THIS PART'S PREPARATION BOUGHT is not yet the
                    // owner's library (2026-10-08): it is placed by this job.
                    .filter((f) => f.name && !(f.purchase && mine.has(f.purchase)) && !(eJob && ((eJob.replay && eJob.replay.hides(f.url)) || (eJob.prepare === true && eJob.rec && typeof eJob.rec.hides === "function" && eJob.rec.hides(f.url)))))
                    .map(({ name, url }) => ({ name, url })));
                },
                // WHY THE LAST ONE WAS NOT MADE (audit A25-3, 2026-10-23):
                // the switch off or the balance short, so the reply says so
                // instead of "just now". Read right after a null, from the
                // same two walls `generate` and `makeSitePhoto` stop at.
                unmadeWhy: () => (!imagePurchasesOn(env) ? "off" : !imagesAffordable(1, { balance, usd: SITE_PHOTO_USD }) ? "short" : ""),
                // ONE PHOTOGRAPH AT A TIME, priced against the real balance
                // before each. Checked per picture rather than once up front
                // because each one is ~19 credits: a batch that can afford two
                // of three must buy the two, and the third is reported.
                generate: jobImage(eJob, async (describe, meta) => {
                  if (!imagesAffordable(1, { balance, usd: SITE_PHOTO_USD })) return null;
                  const { url: made } = await makeSitePhoto(env, ownerSlug, describe, meta);
                  // Only a photograph that really landed costs anything, so the
                  // working balance moves on success and not on the attempt —
                  // the same rule the build path's `made` count follows.
                  if (made) balance -= SITE_PHOTO_USD / CREDIT_USD;
                  return made;
                }),
                // THE PAGE READER A REMOVAL IS CHECKED WITH, injected and asked
                // for only when an answer takes a photograph off. The container
                // resolves it; a Worker bundle does not, and there a removal is
                // refused as `unchecked` rather than cut on a guess.
                parser: tweakParser,
              }, { instruction: eInstruction, pages: picFiles, model: eQuickModel });
              // A PURCHASE WHOSE OUTCOME NOBODY CAN TELL (2026-10-09, round 3,
              // Codex's second reproduction): begun by this part's preparation,
              // or an earlier try, and never known to have landed or not. It is
              // not bought again on a guess: nothing is published and nothing
              // charged, and the part is held, recoverable — moved on when that
              // purchase is found to have landed, or when the customer says to
              // buy it again knowing it may cost.
              if (eJob && eJob.purchase && eJob.purchase.unknown.length) return heldPurchase(eJob.purchase.unknown);
              // A QUESTION BACK (2026-10-02): this step's model asked instead of acting.
              if (pOut.ask) return stepAsk("picture", pOut.ask);

              if (!pOut.ok) {
                if (!pOut.escalate) {
                  if (pOut.reason === "send") return modelDown(pOut.error, "I couldn't reach the model that picks the picture — try again in a moment.");
                  return Response.json({
                    ok: false, error: pOut.reason, cost: await eCharge(pOut.usage), usage: pOut.usage,
                    // The module writes this — it is the only thing that knows
                    // which slot could not be filled and why.
                    msg: pOut.msg || "That change couldn't be made — try again.",
                  }, { status: 422 });
                }
                // A HANDOFF IS AN ESCALATION THAT NAMES A CHEAPER LANE. The
                // picture layer cannot insert a `<SafeImage>` and the `page`
                // layer can, so "add a photo to the about page" goes there —
                // one page, one model call — rather than up to the revise, which
                // rewrites every page of the site to add one picture. Carried on
                // the escalate the client already reads; a lane that names no
                // layer behaves exactly as it did.
                //
                // THE MODULE ESCALATES FOR TWO REASONS AND THEY ARE TWO CLASSES
                // (2026-09-23). `needs-place` names the page rung — a cheaper
                // lane that inserts a frame on one page — and stays a hop.
                // `no-slots` named nothing and fell to the rewrite of every page:
                // it is a sentence now, saying how to ask for one to be added.
                if (pOut.reason === "needs-place" && pOut.layer) return escalate("needs-place", { layer: pOut.layer, page: pOut.page });
                if (!picParts.ok) return explain("picture/parts-unreadable");
                return explain("picture/no-slots");
              }
              // BOTH HALVES GO TO THE PUBLISH WHEN BOTH WERE READ — the pages
              // and every component, changed or not, because a list handed in
              // is the list stored (the text rung's rule). When the components
              // were NOT read, the pages go alone and the spine re-sends the
              // store's own copy, exactly as before this rung saw components.
              const picSplit = picParts.ok ? splitEditable(pOut.pages) : { pages: pOut.pages };
              const pPub = await publishStep(env, {
                slug: ownerSlug, pages: picSplit.pages,
                ...(picParts.ok ? { parts: picSplit.parts } : {}),
                label: versionLabel({ revise: true, changeNote: eRun }),
              });
              if (!pPub.ok) {
                return Response.json({
                  ok: false, error: lostOr(pPub, "compile"), cost: 0,
                  msg: compileMsg(pPub, "That picture change didn't compile, so your site is untouched."),
                  detail: pPub.detail,
                }, { status: 422 });
              }
              // THE PHOTOGRAPHS ARE BILLED, WHICH THEY WERE NOT.
              //
              // This charged `pageCredits(usage)` over model tokens only, so a
              // generated photograph — $0.15 of real fal spend, ~19 credits, and
              // the exact charge the BUILD path applies for the identical
              // picture — cost the customer nothing. "Add three photos of the
              // shop" was about $0.45 to us and roughly one credit to them.
              // Latent only while the image balance is empty and `generate`
              // returns null; the day it is funded it is live money.
              //
              // Counted from `made`, not from what was asked for: a photograph
              // that failed or was never affordable was never bought. Priced
              // through the SAME variadic call as the tokens so the two land on
              // one bill with one rounding.
              const pImages = pOut.made.length ? { images: pOut.made.length } : null;
              return Response.json({
                ok: true, layer: "picture", msg: pOut.msg,
                changed: pOut.changed, files: pPub.files, render: pPub.render, renderNote: pPub.renderNote, checks: pPub.checks, draft: pPub.draft,
                used: pOut.used.length, made: pOut.made.length, failed: pOut.failed,
                // THE REMOVALS THIS STEP MADE, counted where they were made —
                // photographs taken off WITH their space. The browser's undo
                // hint reads this, never a guess from the publication's diff.
                photosTakenOff: pOut.removed && pOut.removed.length ? pOut.removed.length : undefined,
                cost: await eCharge(pOut.usage, pImages, pPub), usage: pOut.usage,
              });
            }
            if (eLayer === "logo") {
              // ── THE BUSINESS'S OWN ARTWORK IN ITS OWN HEADER ────────────
              //
              // Until now `SiteHeader` took `brand: string` and there was no
              // image slot anywhere in the frame, so a business with a logo
              // could not use it on the site we built them.
              //
              // NO MODEL CALL AT ALL, on either path. The attachment IS the
              // choice — nothing has to be matched against anything — so this
              // costs only the routing call that already happened plus a
              // container run, and it rewrites no page: the URL is read at
              // COMPILE time out of `_meta`, so every page gets the logo
              // without a line of page source changing.
              // AND A NULL ONE IS ORDINARY HERE TOO (2026-08-28), for the same
              // reason as the look lane and with a sharper cost. This is the
              // ZERO-credit rung — the attachment IS the instruction and no
              // model writes a line — so refusing it to a frontend-only site
              // turned a free operation into a ~17-credit page rewrite. The
              // connection is passed to `patchSiteConfig` and nowhere else in
              // this branch; `configDeps` guards it with `if (db)` and reads the
              // logo out of R2 regardless. There is no query here to need it.
              const ldb = await siteRowConn(env, ownerSlug);
              // UP TO 3 ARRIVE (more were refused above), AND ONE IS A LOGO — a
              // business has one. This used to take the first and say nothing;
              // since 2026-10-03 the step refuses more than one, with the
              // number, before anything is stored (`runLogoEdit`), because the
              // first of a request's file and an answer's is not a choice
              // anybody made.
              const eImages = Array.isArray(eb && eb.images) ? eb.images.slice(0, MAX_ATTACHMENTS) : [];
              let lFrameUsage = null, lFrameChanged = null;
              const lOut = await runLogoEdit({
                sniff: sniffImage,
                // The same content-hashed library every other upload lands in,
                // so it obeys the owner's own file allowance and goes when the
                // site goes.
                store: async ({ bytes, kind }) => {
                  if (!env.SITES_BUCKET) return null;
                  const digest = await crypto.subtle.digest("SHA-256", bytes);
                  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
                  const name = uploadName(hex, kind.ext);
                  if (!name) return null;
                  await env.SITES_BUCKET.put(uploadKey(ownerSlug, name), bytes, { httpMetadata: { contentType: kind.mime } });
                  return uploadUrl(ownerSlug, name);
                },
                // A FORM ON THE LOOK, WHICH IS THE WHOLE OF THE CHANGE (2026-09-07).
                //
                // This wrote `config.logo` / `config.icon` — their own fields
                // BESIDE `look`, because `mergeLook` rebuilt that object from
                // `EDIT_FIELDS` alone and anything else stored there was dropped
                // by the next colour change. That reason is gone: a mark IS an
                // edit field now, so an upload is stored where the drawn one is
                // stored, in the same shape, and one form replaces the other.
                //
                // TWO MARKS, ONE PER SLOT, and the module still names which. The
                // header logo and the tab icon are different pieces of artwork —
                // a wordmark is legible at a few hundred pixels and a smear at 16
                // — so a site can have both, and setting one must not clear the
                // other. That is `withConfig`'s absent-means-unchanged rule plus
                // this patch naming exactly one look key.
                //
                // A REMOVAL IS `markRemove`, not an empty string. The old door
                // cleared its own key and let the ladder fall through to whatever
                // was under it; with one field there is no ladder, so what the
                // removal falls to is COMPUTED — the drawn mark a site still on
                // the old pair had hidden beneath the upload, otherwise the
                // floor — and written as a form, so the reveal happens once.
                //
                // THE LOOK IS READ AND MERGED, NEVER PATCHED FIELD-BY-FIELD.
                // `withConfig` replaces a named config field WHOLE, so writing
                // `{ look: { wordmark } }` would take the theme, the brand, the
                // description and every language off the site. The read is
                // therefore not optional and a read that FAILS refuses rather
                // than writing: the lane's catch says the artwork could not be
                // saved and the site is unchanged, which is true, where a write
                // over an unread look is a stripped site reported as success.
                save: async (patch) => {
                  const field = Object.prototype.hasOwnProperty.call(patch, "icon") ? "favicon" : "wordmark";
                  const url = String(patch[MARK_UPLOAD[field]] || "");
                  const c = await readSiteConfig(env, ownerSlug, ldb);
                  if (!c.ok) throw new Error(c.why + ": " + c.error);
                  const look = c.config.look && typeof c.config.look === "object" ? c.config.look : {};
                  const next = url ? { form: "image", url } : markRemove(c.config, field);
                  await mayWriteConfig(env, ownerSlug, eJob);
                  const w = await patchSiteConfig(env, ownerSlug, ldb, { look: { ...look, [field]: next } }, jobFence(env, eJob));
                  // A DISCARDED FAILURE HERE IS A CUSTOMER TOLD THEIR LOGO
                  // LANDED while the next publish serves the site without it.
                  // The lane's own catch turns this into its refusal.
                  if (!w.ok) throw new Error(w.error);
                  eConfigWritten = true;
                  // THE FORM THAT LANDED, so a removal's sentence names what the
                  // mark fell back to rather than assuming the floor.
                  return next;
                },
                // A WRITTEN FRAME PLACES THE LOGO ITSELF (2026-10-23). On a site
                // with `SiteChrome` the stored mark reaches the header at compile
                // time and no file changes. A site whose header is its own file
                // (`-parts/site-header.tsx`) shows `SITE_LOGO` only where that
                // file puts it, so an added header logo also runs the frame edit
                // with the customer's words ("next to the name"), told the logo
                // is now set; its files go to this same publish. A frame edit that
                // fails or changes nothing leaves the publish as it was.
                publish: async () => {
                  let lParts = null;
                  if (!eRemove && !(!eHanded && eb && eb.tab === true)) {
                    const lRead = await editParts();
                    if (lRead.ok && writtenFrame(eSrc, lRead.parts)) {
                      const lf = await runFrameEdit({ send: eQuick() }, {
                        instruction: eInstruction, pages: eSrc, parts: lRead.parts,
                        routes: [...new Set(eSrc.map((p) => routeOf(p.path)).filter(Boolean))], model: eQuickModel,
                        note: "THE LOGO IS NOW SET: `SITE_LOGO` holds its address. Show it in the header where the customer asked (beside or in place of the name), with alt text the business's name.",
                      });
                      lFrameUsage = lf.usage || null;
                      if (lf.ok) { lParts = lf.parts; lFrameChanged = lf.changed; }
                    }
                  }
                  return publishStep(env, {
                    slug: ownerSlug, pages: eSrc, ...(lParts ? { parts: lParts } : {}),
                    label: versionLabel({ revise: true, changeNote: eRun }),
                  });
                },
              // `eRemove`, THE STEP'S — not the body's. The logo rung is only ever
              // the router's own step (no lane dispatches here), so the two are
              // equal on every path that reaches this line today; the step's is
              // the one that stays right if a lane ever does.
              }, { images: eImages, remove: eRemove, tab: !eHanded && !!(eb && eb.tab === true) });

              if (!lOut.ok) {
                // NEVER ESCALATED. The rung above is a full revise, which cannot
                // put a logo in a header either — it would spend ~27 credits
                // rewriting pages and end with the same missing logo, which
                // reads as the builder ignoring what was asked. A refusal here
                // is the honest answer and it says what to do instead.
                return Response.json({
                  ok: false, error: lOut.reason, cost: lFrameUsage ? await eCharge(lFrameUsage) : 0, msg: lOut.msg,
                }, { status: 422 });
              }
              return Response.json({
                ok: true, layer: "logo", msg: lOut.msg,
                frame: lFrameChanged ? lFrameChanged : undefined,
                // WHICH SLOT IT LANDED IN, from the module rather than re-read
                // off the request: the module is what chose, and a second
                // reading here is a second thing that can disagree about where
                // a customer's artwork went.
                target: lOut.target || "logo",
                removed: !!lOut.removed, url: lOut.url || "", files: lOut.files,
                cost: lFrameUsage ? await eCharge(lFrameUsage) : 0, usage: lFrameUsage,
              });
            }
            if (eLayer === "text") {
              // THE WORDS ARE NOT ALL IN THE PAGES ANY MORE (2026-09-11). Since
              // the band split began writing each section to its own file under
              // `-parts/`, a lane reading `eSrc` alone looks at a shell of
              // imports and a `<SiteChrome>` composition — none of the prose a
              // customer is asking to change. It would answer `no-match` and
              // escalate every wording edit on a split site to the page rewrite:
              // ~1 credit becoming ~3, and the copy reworded on the way past.
              //
              // `editableFiles` presents the parts with a path, which is all
              // `textItems` and `applyEdits` ever look at — neither interprets
              // one — so the rung is unchanged and the mapping lives in one
              // place. `splitEditable` puts them back before anything publishes,
              // because a component that came back as a page would be counted
              // against the page cap and published in `sitemap.xml`.
              // ── AND AN UNREADABLE STORE REFUSES BEFORE IT SPENDS ─────────
              //
              // ⚠ THIS RUNG'S VERSION OF THE COLLAPSE IS THE WORSE ONE, and
              // it is measured rather than reasoned about: driven through this
              // route with the components key throwing, the reply was
              // `{ok: true, applied: 1}`, the compiler payload carried
              // `parts: []`, and `source/<slug>/parts.json` was REWRITTEN TO
              // `[]` — every component on the site deleted by a one-word
              // wording change.
              //
              // The mechanism is the empty list being REAL rather than absent:
              // `loadSiteParts` answers `null` for a failed read,
              // `editableFiles(eSrc, null)` presents the pages alone,
              // `splitEditable` then answers `parts: []`, and both the spine's
              // preference (`Array.isArray(parts) ? parts : <the store's own
              // copy>`) and its save (`if (Array.isArray(parts))`) take an
              // empty array at face value. The page rung at least handed over
              // `null`.
              //
              // REFUSED HERE RATHER THAN REPAIRED FURTHER DOWN, for two
              // reasons. It costs NOTHING — above the model call, so a
              // customer who retries in a minute has paid for neither attempt;
              // and the alternative (hand over nothing and let the spine
              // re-read) spends a call and a compile to reach a `vite` failure,
              // because a page importing a component the payload lacks does
              // not build. A refusal that changes nothing beats a refusal that
              // charges for itself.
              //
              // `ok: false` ONLY. A site that genuinely has no components
              // answers `{ok: true, parts: []}` and passes straight through,
              // which is every frontend-only site on the platform.
              const eTextParts = await editParts();
              if (!eTextParts.ok) {
                return Response.json({
                  ok: false, error: "parts-unreadable", cost: 0,
                  msg: "I couldn't read this site's sections just now, and changing the words without them could take one off. Nothing was changed — try again in a moment.",
                }, { status: 503 });
              }
              const eParts = eTextParts.parts;
              const eFiles = editableFiles(eSrc, eParts);
              // ── A TRANSLATED PAGE IS EDITED AS ITS OWN LANGUAGE (#196, audit
              // A32-3; the owner's choice 2026-10-23) ─────────────────────────
              //
              // `/es/book` is produced on every publish from the primary page
              // and the translation cache, so its wording cannot be changed in
              // the stored pages. The text step is run on the TRANSLATED pages
              // as they are served now; each change is read back to the primary
              // string it came from and stored as that language's own override
              // (`config.langOverrides`, `builder/lang-override.mjs`), which the
              // spine lays over the cache on every publish. Reached when the
              // router names a page under a language's prefix, or when the
              // primary wording matched nothing and the request quotes a
              // language's current wording (`eLangByWords`).
              const eLangRead = async () => {
                const db = await siteRowConn(env, ownerSlug);
                const c = await readSiteConfig(env, ownerSlug, db);
                if (!c.ok) return null;
                const look = c.config.look && typeof c.config.look === "object" ? c.config.look : {};
                const routes = eSrc.map((p) => routeOf(p && p.path)).filter(Boolean);
                const langs = resolveLangs(look.lang || "en", Array.isArray(look.langs) ? look.langs : [], { routes }).langs;
                if (!langs.some((l) => !l.primary)) return null;
                const { strings } = collectStrings(eFiles);
                const ovr = readOverrides(c.config.langOverrides);
                const cache = c.config.langStrings && typeof c.config.langStrings === "object" ? c.config.langStrings : {};
                return {
                  db, langs, routes, strings, ovr,
                  currentOf: (tag) => {
                    const shown = applyOverrides(cache[tag] && typeof cache[tag] === "object" ? cache[tag] : {}, ovr[tag], strings).merged;
                    return Object.fromEntries(strings.map((sTxt) => [sTxt, shown[sTxt] == null ? sTxt : shown[sTxt]]));
                  },
                };
              };
              const eLangByWords = (lr) => {
                const said = eInstruction.toLowerCase();
                let best = null, bestN = 0;
                for (const l of lr.langs) {
                  if (l.primary) continue;
                  const cur = lr.currentOf(l.tag);
                  const n = Object.entries(cur).filter(([en, tr]) => tr !== en && tr.length >= 3 && said.includes(tr.toLowerCase())).length;
                  if (n > bestN) { best = l; bestN = n; }
                }
                return best ? { tag: best.tag, prefix: best.prefix, route: "/" } : null;
              };
              const eLangEdit = async (lr, lt) => {
                const current = lr.currentOf(lt.tag);
                const tPages = translatePages(eFiles, lt.prefix, lr.strings, lr.strings.map((sTxt) => current[sTxt]), { routes: lr.routes }).pages;
                const lOut = await runTextEdit({ send: eQuick(), seen: (x) => noteSeen(eJob, x) },
                  { instruction: eInstruction, pages: tPages, scope: null, model: eQuickModel });
                if (lOut.ask) return stepAsk("text", lOut.ask);
                if (!lOut.ok) {
                  if (lOut.reason === "send") return modelDown(lOut.error, "I couldn't reach the model that picks the wording — try again in a moment.");
                  if (lOut.reason === "no-text") return explain("text/no-text");
                  return explain("text/no-match");
                }
                const got = overridesFromEdits(lOut.edits, current);
                if (!got.found.length) return explain("text/no-match");
                await mayWriteConfig(env, ownerSlug, eJob);
                const w = await patchSiteConfig(env, ownerSlug, lr.db, { langOverrides: addOverrides(lr.ovr, lt.tag, got.found) }, jobFence(env, eJob));
                if (!w.ok) {
                  return Response.json({
                    ok: false, error: "store", cost: 0,
                    msg: "I couldn't save that " + lt.tag + " wording just now, so nothing was changed — try again in a moment.",
                  }, { status: 503 });
                }
                eConfigWritten = true;
                const lPub = await publishStep(env, {
                  slug: ownerSlug, pages: eSrc,
                  label: versionLabel({ revise: true, changeNote: eRun }),
                });
                if (!lPub.ok) {
                  return Response.json({
                    ok: false, error: lostOr(lPub, "compile"), cost: 0,
                    msg: compileMsg(lPub, "That wording didn't compile, so your site is untouched — try shorter wording."),
                    detail: lPub.detail,
                  }, { status: 422 });
                }
                return Response.json({
                  ok: true, layer: "text", applied: got.found.length, files: lPub.files, render: lPub.render,
                  renderNote: lPub.renderNote,
                  // CARRIED PAST THE DEFERRED PUBLISH, whose note replaces a step's.
                  langNote: overrideNote(lt.tag, got.found),
                  checks: lPub.checks, draft: lPub.draft,
                  changed: got.found.map((f) => f.said).slice(0, 8),
                  langOverride: { tag: lt.tag, changed: got.found.slice(0, 8).map((f) => ({ from: f.from, said: f.said })) },
                  cost: await eCharge(lOut.usage, lPub), usage: lOut.usage,
                });
              };
              if (ePage && !eRoutes().includes(ePage.trim().toLowerCase())) {
                const lr = await eLangRead();
                const lt = lr ? langTargetOf(ePage.trim(), lr.langs) : null;
                if (lt) return eLangEdit(lr, lt);
              }
              // A REQUEST PART'S DECLARED SCOPE (2026-10-11): shown only its
              // pages first, as its preparation was (`scopedText`).
              const out = await runTextEdit({ send: eQuick(), seen: (x) => noteSeen(eJob, x) },
                { instruction: eInstruction, pages: eFiles, scope: stepScopeOf(eb && eb.scope), model: eQuickModel });
              // A QUESTION BACK (2026-10-02): this step's model asked instead of acting.
              if (out.ask) return stepAsk("text", out.ask);
              // `escalate` false with `ok` false is the one case that is NOT a
              // rung problem: the stored source moved under us, and the lane
              // above would be working from the same copy. Retrying fixes it.
              if (!out.ok) {
                if (!out.escalate) {
                  // A MODEL OUTAGE IS NOT A STALE EDIT. The 409 below says the
                  // site moved under the offsets and to send it again, which is
                  // exactly wrong advice when the provider is down or unpaid —
                  // and would be the message on every text edit for the whole
                  // outage.
                  if (out.reason === "send") return modelDown(out.error, "I couldn't reach the model that picks the wording — try again in a moment.");
                  return Response.json({
                    ok: false, error: out.reason, cost: 0,
                    msg: "Your site changed while that was being edited — send it again.",
                  }, { status: 409 });
                }
                // THREE ESCALATIONS AND TWO CLASSES (2026-09-23). Too much
                // wording for one-at-a-time edits is the rung establishing the
                // change is beyond it — the designed climb, kept. No wording at
                // all, or wording that matched nothing the model read, is NOT: a
                // rewrite would reword the whole site to hunt for words nobody
                // could find, and asking for the exact words costs nothing.
                if (out.reason === "too-much-text") return escalate("too-much-text");
                if (out.reason === "no-text") return explain("text/no-text");
                // THE WORDING MAY BE A TRANSLATION'S (#196): asked again on that
                // language's pages only when the request quotes its wording.
                if (out.reason === "no-match") {
                  const lr = await eLangRead();
                  const lt = lr ? eLangByWords(lr) : null;
                  if (lt) return eLangEdit(lr, lt);
                }
                return explain("text/no-match");
              }
              // BOTH HALVES GO TO THE PUBLISH, and the parts go EVERY time
              // rather than only when one changed. `recompileAndPublish` reads
              // `Array.isArray(parts) ? parts : await loadSiteParts(...)`, so a
              // list handed in is the list stored — and handing in only the
              // changed ones would store only those, taking every untouched
              // component off the site on a one-word edit.
              // AN EMAIL ADDRESS IS CARRIED TO EVERY EXACT COPY (run 6): its
              // `mailto:` links and its other copies in pages and parts, which
              // the wording step never reads. Exact, so rewritten, not reported.
              const eMail = carryEmailChange(out.pages, out.edits, { keepLinks: out.keepLinks === true });
              const eSplit = splitEditable(eMail.pages);
              const pub = await publishStep(env, {
                slug: ownerSlug, pages: eSplit.pages, parts: eSplit.parts,
                label: versionLabel({ revise: true, changeNote: eRun }),
              });
              // A FAILED COMPILE LEAVES THE LIVE SITE ALONE, and is not
              // escalated: the rung above would rewrite pages the owner never
              // asked to have rewritten, to fix a typo.
              if (!pub.ok) {
                return Response.json({
                  ok: false, error: lostOr(pub, "compile"), cost: 0,
                  msg: compileMsg(pub, "That wording didn't compile, so your site is untouched — try shorter wording."),
                  detail: pub.detail,
                }, { status: 422 });
              }
              // ── A PHONE NUMBER CHANGED IN THE WORDS AND NOT IN THE LINK ──
              //
              // A number is one fact in two encodings and only the words are
              // text, so this lane changes what a visitor READS and leaves the
              // Call button dialling the old number. Reported rather than
              // rewritten: pairing `0113 200 0000` with `tel:+441132000000`
              // needs a heuristic, and a heuristic that fires wrongly sends a
              // customer's calls somewhere nobody asked for.
              // A link kept on purpose is reported as kept, not as stale.
              const staleTel = staleContactLinks(eMail.pages, out.edits).filter((l) => !(eMail.kept.length && /^mailto:/.test(l.href)));
              return Response.json({
                ok: true, layer: "text", applied: out.applied, files: pub.files, render: pub.render, renderNote: pub.renderNote, checks: pub.checks, draft: pub.draft,
                changed: out.edits.map((e) => e.to).slice(0, 8),
                // WHAT IT WAS ASKED AND DID NOT MAKE (2026-10-23, fix-edit-flow),
                // from the step's own plan; omitted when empty.
                notDone: Array.isArray(out.notDone) && out.notDone.length ? out.notDone : undefined,
                // Omitted when empty, so an ordinary wording change's response
                // is byte-identical and the field's PRESENCE is the signal.
                staleTel: staleTel.length ? staleTel.slice(0, 4) : undefined,
                // The links and other copies the email change was carried to.
                links: eMail.links.length ? eMail.links.slice(0, 12) : undefined,
                alsoChanged: eMail.texts.length ? eMail.texts.slice(0, 12) : undefined,
                keptLinks: eMail.kept.length ? eMail.kept.slice(0, 12) : undefined,
                cost: await eCharge(out.usage, pub), usage: out.usage,
              });
            }

            if (eLayer === "look") {
              // The connection STRING, used directly — see recompileAndPublish,
              // where reading a `.conn` off it silently disabled the whole look.
              //
              // ── AND NOT HAVING ONE IS ORDINARY, NOT A REFUSAL (2026-08-28) ──
              //
              // This read was followed by `if (!edb) return escalate("no-backend")`,
              // which refused the entire cheap lane to every FRONTEND-ONLY site.
              // That is the DEFAULT since a first build stopped provisioning a
              // database, so it was most of the sites on the platform: every
              // colour change on one went up the ladder to the full page rewrite
              // and cost ~17 credits where this lane costs well under one.
              // Measured on `shoeroom-1` — "make the footer black" spent 17.
              //
              // THE LANE NEVER NEEDED THE DATABASE. The stylesheet it edits
              // lives in R2: `configDeps` reads the look and the css out of
              // `SITES_BUCKET` and reaches for the connection only to fill a
              // LEGACY `_meta` fallback, which it already guards with `if (db)`.
              // `text`, `picture` and `nav` republish through the same spine and
              // none of them asks for a backend at all — this lane was alone.
              //
              // AND THE GATE MADE ITS OWN FIX UNREACHABLE. `!priorLook &&
              // !priorCss` below exists precisely so a site with a thin look and
              // a real stylesheet is NOT escalated; no frontend-only site ever
              // reached that line to be saved by it. A guard watching the layer
              // below the break, which is this repo's own recorded trap.
              const edb = await siteRowConn(env, ownerSlug);
              let priorLook = null;
              // The stored config itself, for `markRemove` below (audit A26-2).
              let priorConfig = null;
              // THE WHOLE DESIGN, since 2026-08-23. This lane is the cheap rung a
              // colour change lands on, and with `tokens`/`style`/`seeds` off the
              // tool there is nothing else for it to move.
              let priorCss = "";
              try {
                // ONE READ, AND IT IS R2. The look and the stylesheet are config
                // for the compiled output and live in the bucket beside it.
                //
                // ── AND THE SCHEMA READ WENT ON 2026-08-29 ──────────────────
                //
                // A `SELECT v FROM _meta WHERE k = 'schema'` sat here, guarded
                // by `if (edb)`, to hand the DESIGNER a `tables:` list. With the
                // edit path split off the build path there is no designer on
                // this lane: `pickLanes` names the part of the site, the acting
                // lane is shown that part's own value, and no lane here has ever
                // had a use for a table name. So it was a Postgres round-trip on
                // every look edit, feeding a parameter that no longer exists.
                //
                // WHAT THAT SETTLES: this lane is now databaseless in fact and
                // not merely by permission. The `if (!edb) return
                // escalate("no-backend")` removed on 2026-08-28 was refusing
                // most of the platform over a dependency the lane barely had;
                // it now has none at all, and `edb` survives only to be passed
                // to `readSiteConfig`/`patchSiteConfig`, both of which guard it
                // themselves for a legacy `_meta` fallback.
                const cfg = await readSiteConfig(env, ownerSlug, edb);
                if (!cfg.ok) throw new Error(cfg.why + ": " + cfg.error);
                // ONE MARK, SEVERAL FORMS (2026-09-07): both marks resolved to
                // a form before anything merges, so `wordmark` and `favicon`
                // are ordinary look fields here and the lane that answers one
                // is answering the same thing the site is actually wearing —
                // an uploaded picture included, which the old pair kept in a
                // key this path could not see.
                priorLook = lookWithMarks(cfg.config);
                priorConfig = cfg.config;
                priorCss = cfg.config.css;
              } catch (e) {
                // OURS, AND SAID (2026-09-23). A config read that failed escalated
                // as `no-meta` with no layer — the rewrite of every page, which
                // anchors on this very record — over a store that blinked.
                console.error("edit look read failed:", ownerSlug, e && e.message);
                return explain("look/config-unreadable");
              }
              // ── A SITE MAY HAVE A STYLESHEET AND A THIN LOOK ───────────────
              //
              // `!priorLook` alone was the gate, which was right while `site_look`
              // held the palette, the fonts and the axes. Since the five look
              // fields became one `css` string a site built from a bare brief can
              // store very little there while `site_css` carries the entire
              // design — and gated on the look alone, EVERY colour change on such
              // a site would escalate to a ~27-credit page rewrite that recompiles
              // from the same stylesheet and changes nothing.
              if (!priorLook && !priorCss) return escalate("no-look");

              // ── WHAT THE SITE IS ACTUALLY WEARING (owner's call, 2026-08-31) ──
              //
              // "you need to show the whole css of the site… the css step in the
              // edit css path need to be able to edit everything possible that
              // contains css, and im pretty sure that the theme code has css
              // inside, otherwise it wouldnt be a theme."
              //
              // IT DOES, AND THE LANE HAD NEVER SEEN IT. `runLane` was handed
              // `priorCss` — the free-CSS layer alone — so a site whose build
              // never wrote one was described to the model as "(not set — this
              // site has never had one)" while wearing a full theme. Measured on
              // `fretwork-1` after run 96: 208 custom properties in the served
              // stylesheet, `--primary` declared four times, and the lane was
              // told the site had no CSS at all.
              //
              // So the model had nothing to change a colour BY. It could not
              // reach for `--primary` because it did not know one existed; it
              // guessed at markup instead and wrote `header button`, which
              // matches no element on a page whose header control is an `<a>`.
              //
              // CONTEXT, NOT VALUE, AND THE DISTINCTION IS LOAD-BEARING. The
              // lane's answer REPLACES `priorCss`. Show the theme as the current
              // value and the obvious thing for a model to return is that value
              // with one line changed — which would freeze a copy of the theme
              // into the free layer, where it stops following the theme and
              // silently outranks it (the free layer is written last). So the
              // theme rides in `note`, which `editRequest` prints after the
              // value and never asks the model to reproduce.
              //
              // THE KIT'S BASE SHEET IS DELIBERATELY NOT HERE. It is ~200KB of
              // Tailwind utilities, byte-identical on every site on the
              // platform, and it is not "this site's CSS" in any sense a
              // customer means. The theme is 4-11KB (median 7KB, measured across
              // all 500), which is what makes showing the whole of it possible
              // at all.
              //
              // BEST-EFFORT: a theme that will not render leaves the note empty
              // and the lane behaves exactly as it did before this existed. A
              // stylesheet edit must not fail over the CONTEXT for it.
              let themeSheet = "";
              try {
                const t = resolveTheme(priorLook && priorLook.theme);
                if (t) themeSheet = themeCss(applyStyle(t, (priorLook && priorLook.style) || null));
              } catch (e) { console.error("edit look theme render failed:", ownerSlug, e && e.message); }

              // AND WHAT IS ON THE PAGE, which is the half the theme cannot
              // supply. The theme says which colours exist; this says which
              // elements do, and which selector reaches each one. Stored by the
              // last publish — see `saveLandmarks` — so a site that has not been
              // published since this shipped simply has no map and the lane
              // behaves exactly as it did before.
              const eMarks = await loadLandmarks(env, ownerSlug);

              // ── THE EDIT PATH, WHICH IS NOT THE BUILD PATH ────────────────
              //
              // Owner, 2026-08-29: "it should be 2 separated path tho, idk why
              // you are mixing the build with the edit path" — and on what this
              // path IS: "customer says edit this, and booom you go edit it".
              //
              // THIS CALLED `designSiteSchema` UNTIL TODAY: the build's
              // function, the build's tool, the build's system text. Changing
              // one colour on a live site ran the site DESIGNER — 84.8k of
              // instructions for inventing a business from nothing, eleven
              // sentences about which access level a table should have, and
              // nineteen properties of which eighteen were doors this change had
              // no business opening. `EDIT_REQUIRED` and `EDIT_RULE` stopped the
              // other eighteen being ANSWERED; they were on the wire regardless.
              //
              // And the two framings then fought, which is the half that cost
              // real money: the build's `css` description opens "ONLY WHEN
              // ASKED … OMIT this field entirely unless", which a customer's
              // edit reads as "do not touch the stylesheet", so `EDIT_RULE` had
              // to name that clause and overrule it in prose. Two paths means
              // the edit path never sends the sentence it then argues with.
              //
              // TWO CALLS NOW, AND BOTH ARE SMALLER THAN THE ONE THEY REPLACE.
              // `pickLanes` (Haiku, ~2.8k) says which part of the site the
              // message is about; each acting lane (~1.2k for css) is handed
              // that part's CURRENT VALUE and the customer's sentence, and has
              // one property to answer with. Measured: 4.0k of tool against
              // 84.8k, and `pageCredits` is variadic and rounds ONCE with a
              // floor of 1, so the second call adds no credit — a one-lane edit
              // bills exactly what it billed before.
              let designed = null;
              // EVERY USAGE, IN ONE BILL. `eCharge` unwraps `langUsage` into
              // `pageCredits`' variadic parts, so this rides the existing shape
              // rather than adding a second place a lane's spend is priced —
              // and rounds once, where summing two calls rounds twice. That is
              // the bug the addon lane had.
              // THE ACTING CALLS ONLY. The router's call is added by `billParts`
              // for EVERY layer — including the ones this lane dispatches to,
              // which have no `dUsage` of their own — so seeding it here as well
              // billed it twice on every look edit. The reply reports
              // `billParts(dUsage)`, which is the same list `eCharge` prices, so
              // the `usage` and the `cost` beside it cannot disagree.
              const laneUsages = [];
              const dUsage = { langUsage: laneUsages };
              // THE RE-ASKED LANES' USAGE (round 2): billed only when the step then changes something.
              const eReaskUsages = [];
              // WHICH PARTS OF THE SITE THIS TOUCHED, carried out to the reply.
              // A lane that cannot say what it did is this file's single
              // most-repeated failure — `moved` names look FIELDS and a css edit
              // moves none of them, so without this a two-lane edit and a
              // one-lane edit are the same response.
              let ranLanes = [];
              // A REMOVAL FROM A LIST (W2): the lane names the entries that go
              // and the route checks each against the stored list. When every
              // entry was named the field is emptied by name, in the merge's
              // `clear` below; otherwise what stays is the answer stored. The
              // names a removal gave that the list does not hold are said.
              const takeOffAll = new Set();
              const takeOffMissed = [];
              {
                // THE LANES WERE PICKED AT THE DOOR, not here. `pick_lanes` runs
                // above the layer dispatch so that what it names can decide
                // WHICH LAYER runs — a photograph is `picture`'s work, the
                // primary button is `nav`'s — and reaching this branch at all
                // means every field it named is one this lane edits itself.
                //
                // AND THAT IS A PROOF, NOT A HOPE, which is why there is no
                // check here. Getting this far requires no field to dispatch
                // (or `eLayer` would have moved) and none to be unbuilt (or the
                // door escalated), and the three groups are a total, disjoint
                // partition of the seventeen — asserted in
                // `test/edit-lanes.test.mjs`, derived from the same table this
                // reads. So the survivors are exactly `OWN_LANES`.
                //
                // A `stray` guard stood here until a sweep proved it could
                // never fire: every field that can reach this line is already an
                // acting one, so it was a check watching nothing. Removed on the
                // owner's standing rule — if we are not using it, it does not
                // live in the code — and the partition test is what would
                // actually catch the drift it was written for.
                ranLanes = pickedFields;

                // ONE CALL PER LANE, IN TURN (owner's call, asked which way a
                // two-part message should go: "run both lanes in turn"). They
                // do not depend on each other — each is shown its OWN stored
                // value and answers only its own field — so this is a loop
                // rather than a pipeline, and one publish covers all of them.
                const answers = {};
                // EACH LANE IS SHOWN THE ANSWERS ITS OWN CHANGE NEEDS (2026-10-02,
                // `toldBy`), the step's own between lanes and after the last.
                const eLookCtx = eCtx;
                // ── AND EVERY ACTING LANE IS ASKED AT ONCE (2026-10-11) ──────
                //
                // The parallel-work goal: *"independent tasks … should actively
                // run at the same time."* No lane reads another's answer — each
                // is shown its own words, its own field's stored value and (the
                // stylesheet lane) the site's styling — so their calls start
                // together here, each with its own answers fixed (`eQuick`'s
                // `ctx`), and the loop below takes them in the picked order,
                // with every exit exactly as before: a failure or a question
                // from any lane sets the whole step aside, the answers of the
                // others unused and uncharged. A removal is not a call (or is
                // the take-off call, made in its turn).
                const eLaneArgs = (field) => ({
                  field,
                  // ITS OWN WORDS WHEN THE PICKER SCOPED THEM, never another
                  // change's: run 52's description lane was handed the Visit
                  // move beside its own sentence.
                  message: (eAsks && typeof eAsks[field] === "string" && eAsks[field]) || eInstruction,
                  // WHERE THE FIELD LIVES, IN ONE EXPRESSION. `css` is the
                  // stylesheet in R2; every other acting lane is a key on
                  // the stored look — and every one of those is on
                  // `EDIT_FIELDS`, which is what `mergeLook` reads below, so
                  // what is read here and what is written there cannot
                  // disagree about where a field lives.
                  //
                  // COUNTED IN PROSE UNTIL 2026-08-29 ("all seven of those"),
                  // which went stale the moment `behavior` began acting and
                  // said nothing about it. A count of a derived set is a
                  // second copy of that set; the property is that they are
                  // ALL on `EDIT_FIELDS`, and that is what is written now.
                  value: field === "css" ? priorCss : (priorLook || {})[field],
                  // THE SITE'S OWN STYLING, ON THE ONE LANE THAT STYLES.
                  // Every other acting lane edits a short string or a list
                  // and a stylesheet would be noise in front of it.
                  // THE MAP FIRST, THE THEME SECOND, and the order is the
                  // job: the lane's first decision is WHICH element, and
                  // only then WHAT COLOUR. Both are context and neither is
                  // the value being edited.
                  note: field === "css"
                    ? [landmarkNote(eMarks), themeNote(themeSheet), eDeviceNote].filter(Boolean).join("\n\n")
                    : "",
                  model: modelsFor(eb && eb.picker).design,
                });
                const eLaneCalls = new Map();
                // A QUESTION FROM ONE LANE WAITS FOR THE OTHERS ALREADY ASKED
                // (2026-10-11, the continuation round): their answers are kept
                // with the job (`keep`), so when the question is answered the
                // lanes it did not reach are replayed, never asked again.
                const eSettleLanes = () => Promise.allSettled([...eLaneCalls.values()]);
                for (const field of pickedFields) {
                  if (eRemoves.remove.includes(field)) continue;
                  const ctx = eToldBy && Object.hasOwn(eToldBy, field) ? eCtxOf(eToldBy[field]) : eLookCtx;
                  editTrace.mark("lane:" + field, "start");
                  eLaneCalls.set(field, runLane({ send: eQuick("lane", ctx) }, eLaneArgs(field)).catch((e) => ({ field, value: undefined, usage: null, failed: true, error: e })));
                }
                for (const field of pickedFields) {
                  eCtx = eToldBy && Object.hasOwn(eToldBy, field) ? eCtxOf(eToldBy[field]) : eLookCtx;
                  // ── A REMOVAL FROM A LIST NAMES WHAT GOES (2026-10-02, W2) ──
                  //
                  // Emptied by name, "stop offering Spanish" took French away
                  // too, and "take the prices code off, keep the other" took
                  // both. Batch 1 asked the lane only when the list held more
                  // than one entry — and the owner's review: "list length does
                  // not establish which item the customer meant, so a request
                  // for an absent language or code must preserve the existing
                  // item." So every removal on a list is one small call
                  // (`runTakeOff`): the model names the entries the customer
                  // asked to take off, the route checks each against the
                  // stored list, and only names on the list come off. A
                  // removal that named nothing on the list changes nothing and
                  // is told, at no cost for the edit.
                  if (eRemoves.remove.includes(field) && takeOffLane(field)) {
                    editTrace.mark("lane:" + field, "take-off");
                    const stored = (priorLook || {})[field];
                    const off = await runTakeOff(
                      { send: eQuick("lane") },
                      {
                        field,
                        message: (eAsks && typeof eAsks[field] === "string" && eAsks[field]) || eInstruction,
                        value: stored,
                        model: modelsFor(eb && eb.picker).design,
                      },
                    );
                    if (off.usage) laneUsages.push(off.usage);
                    if (off.failed) return modelDown(off.error, "The editor is busy — try again in a moment.");
                    // A QUESTION BACK (2026-10-02): what they named could be more
                    // than one entry. The whole look step asks and changes nothing
                    // — every lane it already ran is set aside with it, as for a
                    // model that is down: half a look change is worse than none.
                    if (off.ask) { await eSettleLanes(); return stepAsk("look", off.ask); }
                    if (!off.ok || !off.matched.length) {
                      editTrace.mark("lane:" + field, "take-off-none", { named: off.targets.length });
                      return Response.json({
                        ok: false, error: "take-off", field, reason: off.ok ? "not-found" : "unread",
                        named: off.ok ? off.unknown : [], cost: 0, unchanged: true,
                        msg: takeOffRefusal(field, off, stored),
                      }, { status: 422 });
                    }
                    editTrace.mark("lane:" + field, "taken-off", { matched: off.matched.length, unknown: off.unknown.length, all: off.all });
                    if (off.unknown.length) takeOffMissed.push({ field, unknown: off.unknown });
                    if (off.all) takeOffAll.add(field);
                    else answers[field] = off.kept;
                    continue;
                  }
                  // TAKING A FIELD THAT IS ONE THING OFF IS NOT A CALL
                  // (2026-09-06). There is nothing for a model to write: the
                  // answer is "nothing", and `mergeLook` is told the name below.
                  // So such a removal costs no tokens, no seconds and no credits
                  // — it is the `logo` lane's shape, which is why `edit_exempt`
                  // already exists for a rung that publishes without reserving.
                  if (eRemoves.remove.includes(field)) {
                    editTrace.mark("lane:" + field, "removed");
                    continue;
                  }
                  // STARTED ABOVE WITH THE OTHER LANES; taken here, in order.
                  const ran = await eLaneCalls.get(field);
                  editTrace.mark("lane:" + field, ran.failed ? "fail" : "ok",
                    { chars: typeof ran.value === "string" ? ran.value.length : 0,
                      answered: ran.value !== undefined });
                  if (ran.usage) laneUsages.push(ran.usage);
                  // THE MODEL IS DOWN OR UNPAID. Our fault, our cost — and the
                  // rung above calls the same provider and would fail the same
                  // way, so this is reported rather than escalated into a
                  // second bill for the same outage. A lane that already
                  // answered is discarded with it: half a change published is
                  // worse than none, because nothing says which half.
                  if (ran.failed) return modelDown(ran.error, "The editor is busy — try again in a moment.");
                  // A QUESTION BACK (2026-10-02): this lane could not make its
                  // change without a detail they left out. The look step asks
                  // and changes nothing, on the same rule — the lanes it already
                  // ran are set aside, and the answer resumes the step whole.
                  if (ran.ask) { await eSettleLanes(); return stepAsk("look", ran.ask); }
                  if (ran.value === undefined) continue;
                  // ── ONE CODE OF SEVERAL (2026-09-03) ──────────────────────
                  //
                  // The qr lane answers a PATCH to one code — which one, and
                  // the half that changes — never the list, because a model
                  // handing back a whole list is a model that can drop an
                  // entry, and a dropped code is a printed card that stops
                  // working. `patchQr` folds it over the stored list: the
                  // named code (or the only one) with its other half kept
                  // character for character, every other code untouched. A
                  // patch that names no code on a site with several, names a
                  // code the site lacks, or re-points one somewhere a QR may
                  // not go is a SENTENCE, never a guess — this field is the
                  // one place the edit path's bias inverts, because a code
                  // pointing at an invented address is the one failure a
                  // visitor cannot see coming. A patch that changes nothing
                  // stores the list as it was, which the no-change reply
                  // below reads as "already like that".
                  if (field === "qr") {
                    // THE ADD-ON'S DESTINATION RULE (audit A31-4): the site's
                    // address and its pages, so `/booking` is resolved and a page
                    // the site lacks is refused. An address that cannot be read
                    // refuses a bare route, as the add-on does.
                    let qrBase = "";
                    try { qrBase = await publicUrlFor(env, ownerSlug); } catch { qrBase = ""; }
                    const patched = patchQr((priorLook || {}).qr, ran.value, { check: qrDestinationCheck({ base: qrBase, routes: eRoutes() }) });
                    if (!patched.ok) {
                      return Response.json({
                        ok: false, error: "qr", reason: patched.why, codes: patched.names, cost: 0,
                        msg: qrRefusal(patched.why, patched.names, patched.said),
                      }, { status: 422 });
                    }
                    answers.qr = patched.moved ? patched.list : (priorLook || {}).qr;
                    continue;
                  }
                  answers[field] = ran.value;
                }
                // ── EVERY PART DECLINED: EACH ASKED ONCE MORE WITH THAT FACT ──
                //
                // (Round 2 of the retry rule, owner 2026-10-24: "a task must
                // never fail completely without at least one retry".) Each lane
                // may decline on its own, legitimately; ALL of them declining,
                // with nothing taken off, is `look/no-change` — the whole step
                // doing nothing. So each lane that ran is asked once more, the
                // SAME request (same model, same effort) with its own answer and
                // the fact (`reaskLane`, `LOOK_DECLINED_REASON`), and its answer
                // is read exactly as the first was. A second decline everywhere
                // is today's sentence. The QR lane is left out: its answer is a
                // patch read against the stored list above, not a value.
                // Their usage is billed only if the step then changes something
                // (taken back out in the no-change branch below).
                const eReaskable = pickedFields.filter((f) => !eRemoves.remove.includes(f) && f !== "qr" && eLaneCalls.has(f));
                if (!Object.keys(answers).length && !takeOffAll.size && !pickedFields.some((f) => eRemoves.remove.includes(f)) && eReaskable.length) {
                  editTrace.mark("look:reask", "start", { lanes: eReaskable.length });
                  let eReaskOk = false;
                  for (const field of eReaskable) {
                    const first = await eLaneCalls.get(field);
                    if (!first || first.failed || first.ask) continue;
                    const ctx = eToldBy && Object.hasOwn(eToldBy, field) ? eCtxOf(eToldBy[field]) : eLookCtx;
                    const again = await reaskLane({ send: eQuick("lane", ctx) }, eLaneArgs(field), first, LOOK_DECLINED_REASON);
                    if (again.usage) { laneUsages.push(again.usage); eReaskUsages.push(again.usage); }
                    if (again.failed) continue;
                    if (again.ask) { await eSettleLanes(); return stepAsk("look", again.ask); }
                    if (again.value === undefined) continue;
                    answers[field] = again.value;
                    eReaskOk = true;
                  }
                  editTrace.mark("retry_reason", eReaskOk ? "ok" : "fail", { step: "look", reason: "no-change", ok: eReaskOk });
                }
                eCtx = eLookCtx;
                // NULL WHEN NOTHING ANSWERED, not `{}` — `hasValue` below reads
                // an empty object as "the model named nothing", which is the
                // `no-change` escalation, and that is exactly what happened.
                designed = Object.keys(answers).length ? answers : null;
              }

              // ── WHOSE LOOK IS THIS? ─────────────────────────────────────
              //
              // ABSENT MEANS THE WHOLE SITE, which is what every look change
              // ever made relies on — so a named page is the narrow case and
              // the default is untouched. A path the site does not have is
              // IGNORED rather than stored: a selector for a page nobody can
              // reach is a change reported as applied that no visitor sees, and
              // the customer's colours would sit in `_meta` forever.
              //
              // `asked: true` — EVERY FIELD HERE WAS NAMED BY THE CUSTOMER.
              // `pickLanes` runs one lane per thing the message asked about, so
              // an answer on this path is never volunteered and always replaces:
              // asking for a new wordmark is asking for a new wordmark, even
              // over a picture somebody uploaded. The design step's own merge
              // omits the flag and leaves an uploaded mark alone — see
              // `mergeLook`, where that rule lives now.
              //
              // THE REMOVALS ARE NAMED, NOT ANSWERED. `designed` carries what
              // the lanes that ran wrote; `clear` carries the ones that did not
              // run because there was nothing to write. `movedFields` then sees
              // a cleared field as moved exactly as it sees a changed one, so
              // the reply and the publish gate need no special case.
              //
              // THE TWO ARE INDEPENDENT AND BOTH ARE FACTS ABOUT THIS CALL
              // (2026-09-08, merging the removal verb onto the one-mark work).
              // `asked` says the customer named these fields, so a lane's answer
              // replaces an uploaded mark; `clear` says which of the named lanes
              // are removals rather than changes. Both reach one field when
              // somebody says "take the logo off", and the removal wins.
              //
              // WHAT MAKES IT WIN IS `asked`, NOT THE ORDER INSIDE THE MERGE —
              // corrected here after the merge's own sweep, because the first
              // draft of this comment said the opposite and a mutant swapping
              // the two rules survived. `asked: true` disables the upload guard
              // outright, so on this path the two never compete; the wipe does
              // come first, and that only matters to a caller that clears
              // WITHOUT asking, which nothing here does today. Said rather than
              // left, since the next reader would otherwise inherit the wrong
              // reason for a behaviour that is right. `markRemove` is what the
              // removal leaves behind.
              const merged = mergeLook(priorLook, designed, {}, { instructed: true, asked: true, clear: eRemoves.remove.filter((f) => !takeOffLane(f)).concat([...takeOffAll]) });
              // A MARK TAKEN OFF IS STORED AS A FORM (audit A26-2). The merge's
              // wipe writes null, and `markOf` reads a stored null as "no form"
              // and falls back to the legacy upload key, so a site still on the
              // old pair kept showing the uploaded picture while the reply said
              // it was gone. `markRemove` is what the logo rung stores.
              for (const f of MARKS) {
                if (eRemoves.remove.includes(f) && !takeOffLane(f) && merged[f] === null) merged[f] = markRemove(priorConfig, f);
              }
              const moved = movedFields(priorLook, merged);
              // ── A CODE THAT COMES OFF TAKES ITS FIGURE WITH IT (2026-10-02, W2) ──
              //
              // The pages show a code through its binding (`SITE_QRS.<name>`,
              // and the first code also `SITE_QR`), which the publish writes
              // from the stored list. A code taken off the list with its figure
              // left on a page leaves that page reading a binding that is no
              // longer there, and it throws as it renders. So every code this
              // step takes off — one of several, or the only one — has its
              // figure taken off every page and component that shows it, found
              // in the page's own syntax tree (`codeFigureRemoval`). A figure
              // that cannot come off safely, or a store that cannot be read to
              // look, stops the change here: nothing is written and nothing is
              // charged, and the code stays where it is.
              let qrCut = null;
              {
                const before = qrList(priorLook && priorLook.qr);
                const after = new Set(qrList(merged.qr).map((c) => c.name));
                const goneNames = before.map((c) => c.name).filter((n) => !after.has(n));
                if (goneNames.length) {
                  const gone = { names: goneNames, first: goneNames.includes(before[0].name) };
                  const refuse = (why) => {
                    editTrace.mark("qr:figure", "refused", { why, codes: goneNames.length });
                    return Response.json({
                      ok: false, error: "qr", reason: why, codes: before.map((c) => c.name), cost: 0, unchanged: true,
                      msg: qrRefusal(why, before.map((c) => c.name), goneNames),
                    }, { status: 422 });
                  };
                  const qrParts = await editParts();
                  if (!qrParts.ok) return refuse("figure-unchecked");
                  const parse = await tweakParser();
                  const files = editableFiles(eSrc, qrParts.parts);
                  const out = [];
                  const changed = [];
                  for (const f of files) {
                    const fr = codeFigureRemoval(f.source, gone, parse);
                    if (!fr.ok) return refuse(fr.reason === "part" ? "figure-part" : "figure-unchecked");
                    let src = f.source;
                    for (const c of [...fr.cuts].reverse()) src = src.slice(0, c.from) + src.slice(c.to);
                    if (src !== f.source) changed.push(f.path);
                    out.push({ path: f.path, source: src });
                  }
                  qrCut = { ...splitEditable(out), changed, names: goneNames };
                  editTrace.mark("qr:figure", "ok", { codes: goneNames.length, files: changed.length });
                }
              }

              // THE LOOK IS THE STYLESHEET, so there is nothing else to merge.
              //
              // The site's token patch, one page's colours and one page's
              // typeface were accumulated here until 2026-08-24, the way the
              // build path accumulated them. All three came off `design_schema`
              // on 2026-08-23, so `designed` could not carry one and every
              // merge handed back exactly what was stored. See the build path's
              // copy of this note for the measurement that made the cut safe.
              // ── THE STYLESHEET ────────────────────────────────────────────
              //
              // REPLACED, NEVER MERGED — see the build route's copy for why a
              // stylesheet is not a set of named slots and what carries the
              // anti-re-roll guarantee instead. An unusable answer keeps what is
              // stored: `readCss` refuses a non-string and an empty string, and
              // neither is an instruction to strip a customer's site bare.
              const cssAsk = readCss(designed && designed.css, { themed: !!resolveTheme(merged.theme) });
              const nextCss = cssAsk.usable ? cssAsk.css : priorCss;
              const cssMoved = nextCss !== priorCss;

              // WHAT THIS LANE CAN HONESTLY MOVE, AND WHAT IT ONLY APPEARS TO.
              //
              // The container is handed `theme` (2026-08-27, with the font pair
              // it recommends riding beside it) and `css`, so both really do
              // change a site that is merely recompiled — "switch it to noir"
              // is one cheap call and one recompile on this lane. The AUTHORED
              // PLAN is not: its six fields are inputs to page GENERATION —
              // what leads, the section order, the primary verb, the page set,
              // the component manifest — and the container never sees any of
              // them. Storing a new one here would change nothing a visitor
              // could see while reporting success, and would leave the stored
              // look disagreeing with the pages it describes. "Make it look like
              // a newspaper" is a real request and it belongs one rung up, where
              // pages are rewritten.
              //
              // DERIVED FROM `PLAN_KEYS`, not the two names this used to list.
              // It read `k === "family" || k === "structure"` — correct while
              // those were the only layout fields there were. The plan replaced
              // the family on 2026-08-20 and brought five more (`purpose`,
              // `shape`, `pages`, `action`, `components`), every one of them a
              // page-generation input and every one of them on `EDIT_FIELDS`,
              // so a look edit moving one would have been stored and silently
              // never drawn. `family` is kept beside them: nothing sets it any
              // more, but a site built before that day still has one recorded.
              const needsPages = moved.filter((k) => k === "family" || PLAN_KEYS.includes(k));
              if (needsPages.length) return escalate("needs-pages", { moved: needsPages });
              // COUNTED AS A CHANGE, or "square buttons" escalates to a ~27-credit
              // page rewrite that cannot put square buttons on anything either —
              // the rung above recompiles from the same stored look. The whole
              // point of this lane is that a look change costs one cheap call.
              if (!moved.length && !cssMoved) {
                // NOTHING MOVED HAS TWO CAUSES, which is what this used to miss.
                // An ask that is ALREADY SATISFIED — a customer repeating an
                // instruction after a stale preview, the ordinary trigger —
                // escalated and bought a ~21-27-credit rebuild that regenerated
                // every page and published a byte-identical site. The cheap
                // lane is holding the answer.
                //
                // The discriminator is whether the model NAMED anything. Fields
                // that all equal what is stored is "you already have that";
                // naming nothing at all is "I could not express this" — which
                // escalated too, until 2026-09-23, and is a sentence now: the
                // rewrite recompiles from the same stored look, so it cannot
                // express it either.
                //
                // THREE TERMS WENT ON 2026-08-24 AND THEY HAD BEEN INERT SINCE
                // THE DAY BEFORE. They read `designed.tokens`, `designed.style`
                // and `designed.tokensPage` — fields `design_schema` has not
                // offered since the five look fields became `css`, so all three
                // were `hasValue(undefined)` on every look edit there has been.
                // Kept, they read as a check considering five things while two
                // decide it, which is the guard-that-cannot-fire shape this repo
                // keeps recording; the `site_*` key guard in
                // `site-freecss.test.mjs` is what stops them coming back.
                const named = EDIT_FIELDS.some((k) => designed && hasValue(designed[k]))
                  // A STYLESHEET THAT CAME BACK IDENTICAL IS SOMETHING NAMED, and
                  // it is the ordinary case now: "make it warmer" on a site that
                  // already is. Without this the lane reads it as "I could not
                  // express this" and buys a rebuild that recompiles from the
                  // very same sheet.
                  || cssAsk.usable;
                // ⚠ AND "I COULD NOT EXPRESS THIS" IS SAID, NOT CLIMBED (2026-09-23).
                // It escalated to the rewrite, which this block's own opening
                // argument says recompiles from the same stored look and so
                // cannot express it either. Asked which part and how, for nothing.
                if (!named) return explain("look/no-change");
                // PAY ONLY FOR WHAT WORKED (round 2): a re-ask that changed nothing is not billed.
                for (const u of eReaskUsages) { const i = laneUsages.indexOf(u); if (i >= 0) laneUsages.splice(i, 1); }
                return Response.json({
                  ok: true, layer: "look", moved: [], renamed: 0,
                  // Its own field, not `moved`: the client's sentence is built
                  // from the lists, and an empty list plus this note reads as
                  // "nothing to do" rather than as a change that failed.
                  lookNote: "Your site already looks like that — nothing to change.",
                  lanes: ranLanes, cost: await eCharge(dUsage), usage: { langUsage: billParts(dUsage) },
                });
              }

              // PREPARED: every lane has answered; the look is never written here.
              if (isPrep) return prepStop();
              // A RENAME READS THE SITE'S OWN COMPONENTS FIRST (A03-6,
              // 2026-10-22). On a site split into bands the visible copy lives
              // in `-parts/`, so a rename over the pages alone left the hero and
              // the footer on the old name. Read before the look is written: a
              // store that cannot be read refuses here, nothing stored, nothing
              // charged — the text rung's rule. A removed code's figure already
              // read both halves (`qrCut`), and the rename reads those.
              const eRenaming = moved.includes("brand") && priorLook && priorLook.brand && merged.brand;
              let eRenameParts = null;
              if (eRenaming && !qrCut) {
                const rp = await editParts();
                if (!rp.ok) {
                  return Response.json({
                    ok: false, error: "parts-unreadable", cost: 0,
                    msg: "I couldn't read this site's sections just now, and renaming the business without them would leave the old name on them. Nothing was changed — try again in a moment.",
                  }, { status: 503 });
                }
                eRenameParts = rp.parts;
              }
              try {
                // ONE WRITE FOR BOTH. `cssMoved` is what decides whether the
                // sheet is named at all: `nextCss` equals `priorCss` unless a
                // usable one came back, and `withConfig`'s absent-means-unchanged
                // rule is what keeps a look-only edit off the stylesheet.
                await mayWriteConfig(env, ownerSlug, eJob);
                const w = await patchSiteConfig(env, ownerSlug, edb,
                  cssMoved ? { look: merged, css: nextCss } : { look: merged }, jobFence(env, eJob));
                if (!w.ok) throw new Error(w.error);
                eConfigWritten = true;
                // THE HAND-OVER THAT LETS THE PUBLISH BELOW VERIFY AND CORRECT A
                // STYLESHEET — see `cssCtx` where it is declared — MADE ONLY ONCE
                // A CHANGED SHEET IS STORED (2026-09-26). It was made when the
                // css lane was PICKED, before it answered, so a lane that answered
                // the sheet as it stood (the "already like that" case, which
                // stores nothing) still armed the check — and the check read the
                // whole stored sheet, so an old rule matching nothing held a menu
                // change in the same message and the correction rewrote the
                // stylesheet unasked. `before` is the sheet the lane was shown and
                // `after` what it stored: the rules between the two are the ones
                // this request wrote (`changedSelectors`), and the only ones the
                // publish may be held for.
                //
                // TWO WALLS, DELIBERATELY, AND A SWEEP CANNOT KILL THEM ONE AT A
                // TIME: an unmoved sheet also names no rule (`before` equals
                // `after`), so without `cssMoved` the list would be empty and
                // nothing held. MEASURED: cutting this condition alone survives;
                // cutting it beside the list — holding for the whole new sheet —
                // is the defect back and fails the menu-edit cases. Kept because
                // `null` is this variable's stated meaning of "no sheet written".
                if (cssMoved) cssCtx = { edb, sheet: themeSheet, before: priorCss, after: nextCss };
              } catch (e) {
                // Nothing has been published yet, so the site is exactly as it
                // was. Reported rather than escalated: a write that failed once
                // will fail for the bigger lane too.
                console.error("edit look write failed:", ownerSlug, e && e.message);
                // A TURN THIS JOB DOES NOT HOLD (2026-10-22, audit A03-4) is
                // another change of the request publishing, not a failed
                // store: answered as the overlap it is, so the request runs
                // this part again alone, never "try again". Only the turn check's
                // own refusal (`mayWriteConfig`): a write the store fenced off
                // mid-flight (`TURN_FENCED`) keeps its answer
                // (test/turn-fence.test.mjs TF2, TF3).
                if (e && e.message === TURN_LOST_WRITE) {
                  return Response.json({ ok: false, error: "turn-lost", ours: true, cost: 0, msg: "Another change in the same request took its turn to publish, so this one wasn't saved. Nothing of it was published." }, { status: 503 });
                }
                return Response.json({ ok: false, error: "store", cost: 0, msg: "That change couldn't be saved — try again." }, { status: 503 });
              }

              // A RENAME IS THE ONE THING HERE THAT IS ALSO ON THE PAGES. Every
              // other field in `EDIT_FIELDS` is read from `_meta` at compile
              // time; the brand is ALSO a literal in every page's source
              // (`<SiteChrome name="…">`, headings, copy), so storing it alone
              // changed the browser tab and the link preview and left every
              // visible heading saying the old name — reported as done. No model
              // call: `renamePages` reuses the free text editor's own extractor,
              // so it rewrites prose a visitor reads and never an import path,
              // a route id or a URL.
              // THE PAGES A REMOVED CODE'S FIGURE CAME OFF, when one did — the
              // rename below then reads those.
              let eSrcOut = qrCut ? qrCut.pages : eSrc, ePartsOut = qrCut ? qrCut.parts : null, renamed = 0;
              if (eRenaming) {
                // THE PAGES AND THE COMPONENTS AS ONE LIST, back into both
                // halves after; `renamed` counts files whose prose changed.
                const rn = renamePages(editableFiles(eSrcOut, qrCut ? qrCut.parts : eRenameParts), priorLook.brand, merged.brand);
                const rs = splitEditable(rn.pages);
                eSrcOut = rs.pages; ePartsOut = rs.parts; renamed = rn.applied;
              }
              // THE PAGES OTHERWISE GO BACK UNTOUCHED. `recompileAndPublish`
              // reads the look it was just handed out of `_meta` rather than
              // taking it as an argument, which is what makes "store, then
              // recompile" the whole of this layer.
              // Labelled by the CHANGE, in the customer's own words — the one
              // question the versions panel is opened to answer. `versionLabel`
              // already does exactly this for a revise; a second labeller here
              // would be a second thing that can disagree about what to call a
              // build.
              // AND THE COMPONENTS, WHEN A FIGURE WAS LOOKED FOR IN THEM: both
              // halves were read, so both go — the picture rung's rule.
              const pub = await publishStep(env, {
                slug: ownerSlug, pages: eSrcOut,
                ...(ePartsOut ? { parts: ePartsOut } : {}),
                label: versionLabel({ revise: true, changeNote: eRun }),
              });
              if (!pub.ok) {
                // "YOUR SITE IS UNTOUCHED" WAS TRUE OF THE PUBLISHED SITE AND
                // FALSE OF THE STORED STATE. The look is written to `_meta`
                // above because `recompileAndPublish` reads it from there — and
                // EVERY publish path reads it from there, so a failed compile
                // left the change sitting in storage waiting for the customer's
                // next unrelated edit to apply it silently, under a version
                // label naming only the typo they were fixing.
                //
                // The worst shape is a rename: the pages keep the old name (the
                // rewritten source was discarded with the failed build) while
                // the stored brand is new, so the next publish gives the tab and
                // the link preview one name and every heading another — the
                // exact tab-versus-page disagreement `renamePages` exists to
                // prevent, arriving through the failure path.
                //
                // Put back to exactly what was read, key by key. `null` where
                // there was no row, so a site that had no tokens does not gain
                // an empty object that later reads as "a patch exists".
                let restored = true;
                try {
                  // GATED ON HAVING MOVED, so a failed compile on a lane that
                  // touched no CSS writes nothing back for it — the stylesheet is
                  // the only look field left to restore beside the look itself
                  // (`site_tokens`, `site_page_tokens`, `site_page_fonts` and
                  // `site_style` were rolled back here until 2026-08-24). The
                  // config store keeps each field in its own type, so there is no
                  // longer a way to put the sheet back through `JSON.stringify`
                  // and store a quoted, escaped copy the container would hand to
                  // the browser as one string literal.
                  await mayWriteConfig(env, ownerSlug, eJob);
                  const w = await patchSiteConfig(env, ownerSlug, edb,
                    cssMoved ? { look: priorLook, css: priorCss } : { look: priorLook }, jobFence(env, eJob));
                  if (!w.ok) throw new Error(w.error);
                } catch (e) {
                  // SAID OUT LOUD RATHER THAN CLAIMED. A restore that failed
                  // leaves the state exactly where the bug used to leave it, and
                  // repeating "your site is untouched" is the one answer that
                  // makes it undiagnosable when it lands on the next edit.
                  restored = false;
                  console.error("look rollback failed:", ownerSlug, e && e.message);
                }
                return Response.json({
                  ok: false, error: lostOr(pub, "compile"), cost: 0,
                  msg: compileMsg(pub, restored
                    ? "That look didn't compile, so your site is untouched."
                    : "That look didn't compile. Your site is still live and unchanged, but the new look is saved — ask for it again and I'll try to apply it."),
                  // WHAT WAS ATTEMPTED, on the failure path too. A change that
                  // can name itself only when it works is one nobody can
                  // diagnose when it does not — and this is the branch where
                  // knowing whether one lane or three were in flight decides
                  // whether the rollback above put everything back.
                  lanes: ranLanes,
                  detail: pub.detail,
                }, { status: 422 });
              }
              return Response.json({
                ok: true, layer: "look", moved,
                // ── THE STYLESHEET, AND WHY IT NEEDS ITS OWN NAME IN THE REPLY ──
                //
                // `moved`, `tokens` and `style` are all lists of NAMED THINGS,
                // and a css change moves none of them — so without this the reply
                // is "✅ Updated the look." with nothing after it on the one lane
                // every colour change is now routed to. That is the
                // works-but-cannot-say-so shape this file has recorded a dozen
                // times, and it reads to a customer as a change that silently
                // failed.
                //
                // ONE WORD RATHER THAN A DIFF. What actually moved is a
                // stylesheet, and diffing two of them into a customer-facing
                // sentence is a feature nobody asked for; the site is in front of
                // them and it is what says what changed.
                css: cssMoved || undefined,
                // AND WHAT THE SHEET ITSELF COSTS THE SITE — a typeface we cannot
                // host, a remote url() the CSP will refuse, a sheet longer than
                // we store. Every one of those is invisible from the page: the
                // browser falls back or drops the rule and nothing says why.
                cssNote: cssNote(cssAsk) || undefined,
                // WHICH PARTS OF THE SITE WERE EDITED, by name. `moved` lists
                // the look FIELDS that changed value and a css edit moves none
                // of them, so on the commonest edit there is it is empty — and
                // an edit that ran two lanes was, until now, indistinguishable
                // from one that ran one.
                lanes: ranLanes,
                // THE CODES TAKEN OFF, AND WHERE THEIR FIGURES CAME OFF (W2), by
                // name and file — never a destination or a caption.
                qrRemoved: qrCut ? qrCut.names : undefined,
                qrPages: qrCut && qrCut.changed.length ? qrCut.changed : undefined,
                // WHAT A REMOVAL NAMED THAT THE LIST DID NOT HOLD (W2): the rest
                // came off, and this says which names took nothing off.
                takeOffNote: takeOffMissed.length ? takeOffMissed.map((m) => takeOffNote(m.field, m.unknown)).join(" ") : undefined,
                renamed, files: pub.files, render: pub.render, renderNote: pub.renderNote, checks: pub.checks, draft: pub.draft, cost: await eCharge(dUsage), usage: { langUsage: billParts(dUsage) },
              });
            }

            if (eLayer === "page") {
              // ── ONE PAGE, ONE MODEL CALL ────────────────────────────────
              //
              // The cheapest generation there is: only this page's source goes
              // into the prompt and only this page comes back, where a revise
              // pays to re-emit every page of the site to move one section.
              //
              // THE FILE IS FOUND THROUGH `routeOf`, the same function the addon
              // lane uses to name a route — rather than a second path-to-route
              // mapping here, which is two things that can disagree about what
              // `src/routes/shop/index.tsx` is called.
              // `ePage`, NOT `eb.page` — one name, so a lane dispatched here by
              // the front door can supply the page a shape or component change
              // lands on. Read straight off the body, this branch found nothing
              // to edit for every such message and escalated.
              const wantRoute = ePage.trim().toLowerCase();
              const target = eSrc.find((p) => p && routeOf(p.path) === wantRoute);
              // The router checks this against the digest already; it can still
              // be wrong about a site whose digest carried no pages.
              //
              // ⚠ THIS SAID "a page we cannot find is an ADDON … which is exactly
              // what the rung above does" AND ESCALATED WITH NO LAYER — which the
              // browser reads as the rewrite of every page, not the add-on step.
              // So "take the /menu page off" on a site with no /menu bought a
              // rewrite, and so did an edit aimed at a page the router named from
              // the sentence rather than the site (run 23, `/book`). Explained
              // now (2026-09-23): removal is already true, a move has nothing to
              // move, and for an edit the real pages are listed and the customer
              // says which — which page gets targeted is its own task.
              if (!target) {
                return explain("page/no-page", { page: wantRoute, verb: eRemove ? "remove" : (eRename ? "move" : ""), routes: eRoutes() });
              }

              // ── TAKING THE PAGE AWAY, WITH NO MODEL CALL AT ALL ───────────
              //
              // THREE ATTEMPTS AT PERSUASION FAILED, and the measurements are why
              // this is here rather than in a prompt. Asked to delete a page, the
              // pages model rewrites the site and never sets the field that
              // deletes one — with the instruction directly under the header, the
              // tool description leading on it, and the schema constraint that
              // once made the honest answer impossible removed. Ruled out on the
              // way: the block is not being truncated, since every one of the 100
              // family exemplars fits under `MAX_PRIOR_CHARS` (max 50,646 against
              // 90,000). It is seeing the words.
              //
              // So the decision moves to the ROUTER, which is already equipped
              // for it: it has just resolved this page against the site's real
              // list. Deleting is then a MERGE, not a generation — ~0.3 credits
              // and a recompile, against the ~28 a rewrite costs, on the one
              // operation that should be the cheapest thing the platform does.
              //
              // `mergeAddonPages` does the deciding, unchanged, so the guards are
              // the ones already tested: never the home page, and never a page
              // another page still links to. That second refusal is the whole
              // reason a model is still sometimes needed — and when it fires this
              // escalates to the addon lane, which can rewrite the linkers.
              if (eRemove) {
                const cut = mergeAddonPages(eSrc, [], [target.path]);
                if (!cut.ok) {
                  // A page something still links to needs the links taken out
                  // first, and that DOES need a model. Up the ladder, with the
                  // sentence the merge already composed.
                  if (cut.msg) return Response.json({ ok: false, error: cut.reason, cost: 0, unchanged: true, msg: cut.msg.trim() }, { status: 422 });
                  // UNREACHABLE — a page that exists is either kept, with the
                  // sentence above, or removed — and explained anyway (2026-09-23)
                  // rather than climbing to a rewrite nobody could justify.
                  return explain("page/removal-no-change", { page: wantRoute });
                }
                const cutPub = await publishStep(env, {
                  slug: ownerSlug, pages: cut.pages,
                  label: versionLabel({ revise: true, changeNote: eRun }),
                });
                if (!cutPub.ok) {
                  return Response.json({
                    ok: false, error: lostOr(cutPub, "compile"), cost: 0,
                    msg: compileMsg(cutPub, "Taking that page out left the site not compiling, so nothing changed."),
                    detail: cutPub.detail,
                  }, { status: 422 });
                }
                // NO `cost`, because nothing was generated. The routing call that
                // decided this was already charged where every routing call is.
                return Response.json({
                  ok: true, layer: "page", page: wantRoute, removed: cut.removed,
                  files: cutPub.files, render: cutPub.render, renderNote: cutPub.renderNote, checks: cutPub.checks, draft: cutPub.draft, cost: 0,
                });
              }

              // ── MOVING THE PAGE, ALSO WITH NO MODEL CALL ─────────────────
              //
              // Same shape and same argument as the deletion above: the router
              // has already resolved which page they mean, and where it is going
              // is a path rather than prose — so there is nothing for a model to
              // work out. `renameRoute` rewrites the route declaration on this
              // page and every `<Link>` to it on every other, which is what makes
              // it a rename rather than a break: those links are typed against
              // the tree `tsr generate` emits, so leaving one behind is a compile
              // error that costs the whole build.
              //
              // ITS REFUSALS ARE ANSWERS, NOT ESCALATIONS. "There is already a
              // page at /work" and "the home page has no address to move" are
              // things the customer can act on, and the rung above cannot move a
              // page either — sending it up would spend ~25 credits to fail
              // differently. The deletion branch's own `cut.msg` case makes the
              // same call.
              const wantRename = eRename;
              if (wantRename) {
                const rn = renameRoute(eSrc, wantRoute, wantRename, routeOf);
                if (!rn.ok) {
                  // `unchanged: true` (2026-09-25): `renameRoute` is pure, so a
                  // refused move wrote nothing — and without it the screen had
                  // no whole-request note, where a refused removal had one.
                  return Response.json({ ok: false, error: "rename", cost: 0, unchanged: true, msg: "I couldn't move that page — " + rn.reason + "." }, { status: 422 });
                }
                // `renamed` IS THE POINT OF DOING IT THIS WAY. Without the
                // explicit pair the publish sees a delete plus an add and 301s
                // the old address to the HOME page, so every indexed link and
                // every share lands on the wrong page rather than the moved one.
                const mvPub = await publishStep(env, {
                  slug: ownerSlug, pages: rn.pages, renamed: rn.redirect,
                  label: versionLabel({ revise: true, changeNote: eRun }),
                });
                if (!mvPub.ok) {
                  return Response.json({
                    ok: false, error: lostOr(mvPub, "compile"), cost: 0,
                    msg: compileMsg(mvPub, "Moving that page left the site not compiling, so nothing changed."),
                    detail: mvPub.detail,
                  }, { status: 422 });
                }
                // NO `cost`, for the reason the deletion states: nothing was
                // generated, and the routing call that decided this was charged
                // where every routing call is.
                return Response.json({
                  ok: true, layer: "page", page: wantRoute, renamedTo: rn.redirect.to, changed: rn.changed,
                  files: mvPub.files, render: mvPub.render, renderNote: mvPub.renderNote, checks: mvPub.checks, draft: mvPub.draft, cost: 0,
                });
              }

              // ── THE CHEAP RUNG, TRIED FIRST ─────────────────────────────
              //
              // "Make that heading bigger", "too much space above the prices",
              // "show the gallery four across", "move the opening hours up".
              // Every one of those regenerated the WHOLE page below — measured
              // on a real 12,044-character page, 10 credits against 3 — and a
              // regeneration rewords the copy on the way past, which nobody
              // asked for.
              //
              // UNCONDITIONAL, WITH NO NEW ROUTING DECISION, because a refusal
              // is nearly free: the model answers `cannot` in a few words, so
              // the miss costs ~1 credit on top of the rewrite that was going to
              // happen anyway. There is no case where asking first is the
              // expensive move, which is exactly why it is not a question the
              // router has to get right.
              //
              // AND THE PROMISE IS CHECKED, NOT ASKED FOR: `readTweak` throws
              // the answer away if the prose moved. Calibrated over the corpus —
              // 1,657 real tweaks across 329 pages moved the words 0 times, and
              // a deliberate rewording was caught on 329 of 329.
              // ⚠ `inPart` IS THE ONE THING THE RUNG CANNOT DERIVE FOR ITSELF,
              // and it decides which specifiers name one of this site's own
              // components: from a PAGE that is the `-parts/` form, and from
              // inside `-parts/` a bare `./x` is a sibling too. `partContract`
              // needs it to see what this file passes into a component whose
              // wording it cannot read — run 17, 2026-09-22.
              //
              // AND IT IS ALWAYS FALSE TODAY — MEASURED, NOT ASSUMED, and said
              // out loud because this repository has been bitten by a comment
              // claiming a wall fires when it cannot. `target` is found in
              // `eSrc`, which is `loadSiteSourceForEdit` → the PAGES store, and
              // a component lives in `parts.json` under a `name` rather than a
              // path — so no `target.path` reachable from here is a `-parts/`
              // file. It is DERIVED rather than written as `false` deliberately:
              // a literal would be a latent wrong answer the day a component
              // becomes a tweak target, and the derivation is correct by
              // construction whether or not it can fire. The FORWARDING hop is
              // what a guard can drive, and it is driven at the module.
              const tw = await runTweak({
                instruction: eAskOf(eInstruction), path: target.path, source: target.source,
                model: eQuickModel,
                inPart: !!partNameOf(target.path),
                send: eQuick(),
                // RETRY_REASON {step, reason, ok} on the edit's trace (2026-10-24).
                mark: traceRetryMark(editTrace),
              });
              // A QUESTION BACK (2026-10-02): this step's model asked instead of acting.
              if (tw.ask) return stepAsk("page", tw.ask);
              // A PREPARATION WITH NO PARSER STOPS AT THE TWEAK (2026-10-23,
              // audit A24-3): preparations run in the Worker, which cannot read
              // a page that renders the site's own components (`no-parser`),
              // while the part's job runs where the parser loads and replays
              // this same tweak call. The rewrite is left to that job, if it
              // needs it — never paid for here and then thrown away.
              if (isPrep && tw.reason === "needs-parts" && tw.why === "no-parser") return prepStop();
              // A TWEAK WHOSE FILE DOES NOT PARSE FALLS BACK TO THE REWRITE
              // (2026-10-22, audit A03-5, the owner's choice): `readTweak`
              // refuses it as `syntax`, so the branch below is skipped and the
              // full writer has the same request, once. Marked, so the job's
              // trace says why the dearer writer ran; the tweak's tokens ride
              // on the rewrite's bill through `twSpent`, as every refused
              // tweak's do. Unparsed on a Worker isolate (no parser): the
              // tweak goes on and the spine's compile stays the wall.
              const twFallback = tw.reason === "syntax" ? "syntax" : "";
              if (twFallback) {
                try { if (editTrace) editTrace.mark("tweak:fallback", "ok", { reason: twFallback, path: target.path, problems: (tw.problems || []).length }); } catch { /* the record never costs the edit */ }
                console.error("tweak did not parse, falling back to the rewrite:", ownerSlug, target.path, (tw.problems || [])[0] || "");
              }
              // THE PRESERVATION CHECK ON THE TWEAK'S ANSWER, when it ran.
              // Kept outside the block so a tweak whose compile then fails
              // hands its judge call's tokens on to the rewrite's bill, exactly
              // as `twSpent` hands on the tweak's own.
              let twJudge = null;
              if (tw.ok) {
                // ── ⚠ THE PRESERVATION CONTRACT APPLIES TO A TWEAK THAT WORKED
                //    (2026-09-21, owner: *"Successful tweaks bypass
                //    protection"*) ───────────────────────────────────────────
                //
                // REPRODUCED THROUGH THE ROUTE: *"make the heading bigger and
                // keep both photographs"* — `write_tweak` answers with the
                // larger heading AND one emptied `src`, `tw.ok` is true, and
                // this branch published the missing photograph and returned.
                // The rewrite below never ran, so the guard that was built for
                // exactly this was three hundred lines past the only path the
                // request ever took.
                //
                // THE SHAPE OF THE MISS IS THE REUSABLE PART: the protection
                // was put on the EXPENSIVE rung, and the cheap rung in front
                // of it is the one that answers most messages. A guard on the
                // fallback is a guard on the case that does not usually
                // happen — and a test that forces `write_tweak` to DECLINE
                // sees the fallback's protection working and proves nothing
                // about the path a customer takes.
                //
                // ⚠ AND IT IS ASKED BEFORE `publishStep`, not after it. The
                // previous behaviour reported the loss below the loop, on a
                // publication that already carried it, which is the exact
                // thing the last two rounds closed on the rewrite path:
                // *reporting a photograph off a page is not keeping it on*.
                //
                // THE COMPONENTS ARE THE SAME LIST ON BOTH SIDES, and that is
                // a fact about this rung rather than a shortcut: `runTweak`
                // takes ONE page's source and answers one page's source, so
                // nothing it can return reaches a component. They are still
                // passed, because `keepPhotos` is SITE-WIDE — a photograph
                // this page drops that a component still shows must not be
                // put back, and the `shows` set can only know that if it is
                // given both lists.
                const twParts = await editParts();
                const twStored = twParts.ok ? twParts.parts : [];
                const twWrote = eSrc.map((p) => (p.path === target.path ? { path: p.path, source: tw.source } : p));
                const twGuard = keepPhotos(
                  { pages: eSrc, parts: twStored },
                  { pages: twWrote, parts: twStored },
                  ownerSlug,
                );
                // A LOSS THE RESTORATION COULD NOT REACH REFUSES, and it does
                // NOT fall through to the rewrite. Owner, the round before
                // this one: *"Do not publish the loss merely because matching
                // failed, or trigger a full rewrite."* Falling through here
                // would be that second clause exactly — the customer asked
                // for a heading and would buy a whole-page regeneration
                // because our cheap rung mangled a picture.
                if (twGuard.lost.length) {
                  const n = twGuard.lost.length;
                  return Response.json({
                    ok: false, error: "withheld", cost: 0,
                    msg: withheldPhotosMsg(n),
                    photosBlocked: n,
                  }, { status: 409 });
                }
                const twPages = twGuard.pages;
                const twKept = twPages.find((p) => p.path === target.path);
                // ⚠ AND A TWEAK THAT IS A NO-OP ONCE THE PICTURE IS BACK FALLS
                // THROUGH, rather than refusing. This is NOT the page rung's
                // "the only thing that change would have done is take a
                // photograph off" branch, and the difference is which rung is
                // speaking: there, the expensive writer has had its go and
                // there is nothing left to try; here, the CHEAP attempt
                // produced nothing but a removal we undid, which is precisely
                // what the fall-through exists for. The rewrite is a real
                // second attempt at the same sentence, its own protection is
                // intact, and `twSpent` carries this call's tokens into its
                // bill so the customer is not charged twice for one ask.
                if (twKept && twKept.source !== target.source) {
                  // ── AND WHAT THE TWEAK TOOK OFF THE PAGE IS ASKED ABOUT,
                  //    BEFORE THE PUBLISH (2026-09-24) ─────────────────────
                  //
                  // The same contract as the rewrite below, on the rung that
                  // answers first — the lesson of the photograph round, where
                  // a protection built on the fallback missed the path most
                  // messages take. `sameProse` already refuses a tweak that
                  // moved words and `partEligible` one that moved a component,
                  // so what can reach this check here is a wordless link lost
                  // or a link pointed somewhere else.
                  //
                  // ⚠ A REFUSAL DOES NOT FALL THROUGH TO THE REWRITE (owner:
                  // *"A refused tweak must not trigger an expensive rewrite"*).
                  // The customer asked for one thing and would otherwise buy a
                  // whole-page regeneration because the cheap rung went wide.
                  twJudge = await keepCheck({
                    message: eInstruction, before: target.source, after: twKept.source,
                    inPart: !!partNameOf(target.path),
                    send: eQuick("keep_check"), model: eQuickModel,
                  });
                  const twStop = keepRefusal(twJudge, ownerSlug);
                  if (twStop) return twStop;
                  // RECORDED ACROSS THE MESSAGE, exactly as the rewrite rung
                  // records it, and read once below the loop against what
                  // really ships — never summed per rung.
                  for (const u of twGuard.restored) ePhotosHeld.add(u);
                  const twPub = await publishStep(env, {
                    slug: ownerSlug, pages: twPages,
                    label: versionLabel({ revise: true, changeNote: eRun }),
                  });
                  // PREPARED: the tweak is done; never the rewrite fallback below.
                  if (isPrep) return prepAnswer();
                  // ⚠ NO COMPILE HAPPENS HERE: under the deferred spine
                  // `publishStep` only records the pages and answers ok, so the
                  // log line below this block cannot run. The check that keeps a
                  // broken tweak off this path is BEFORE it (2026-10-22, A03-5):
                  // `readTweak` refuses a file that does not parse as `syntax`
                  // and the rewrite below takes the request (`twFallback`). A
                  // bundling error the parser cannot see (an import that does
                  // not resolve) still fails once, in `publishSpine`.
                  if (twPub.ok) {
                    return Response.json({
                      ok: true, layer: "page", page: wantRoute, tweak: true,
                      files: twPub.files, render: twPub.render, renderNote: twPub.renderNote, checks: twPub.checks, draft: twPub.draft,
                      // THE JUDGE'S TOKENS ARE BILLED WITH THE EDIT, in the one
                      // rounding — only here, on a publish. A refusal above
                      // returned at cost 0 and charged nothing.
                      cost: await eCharge(tw.usage, twJudge.usage, twPub), usage: tw.usage,
                      keepUsage: twJudge.usage || undefined,
                      // AN UNCERTAIN COMPONENT IS NAMED, never counted as kept.
                      // ⚠ A BELT THAT CANNOT FIRE TODAY, said so: a tweak that
                      // re-binds one of the site's own components changes the
                      // identity `partEligible` compares, so it never reaches
                      // here. Kept for the day that gate moves.
                      partsUnsure: twJudge.unsure.length ? unsurePhrases(twJudge.unsure) : undefined,
                    });
                  }
                  console.error("tweak compile failed, falling through:", ownerSlug, target.path);
                } else if (twGuard.restored.length) {
                  console.error("tweak was a photo removal only, falling through:", ownerSlug, target.path);
                }
              }
              // WHAT THE CHEAP ATTEMPT COST IS CARRIED FORWARD, never dropped.
              // The call really happened, so its tokens are billed with the
              // rewrite's below — the rule the whole charging tier rests on.
              // `send` is the one exception: the provider was unreachable, so
              // there is nothing to bill and the rewrite is about to fail the
              // same way and say so properly.
              const twSpent = tw.reason === "send" ? null : tw.usage;
              const twJudged = twJudge ? twJudge.usage : null;

              // ⚠ A `null` FROM `siteBackendBySlug` IS FOUR FACTS, AND ON THIS
              //    RUNG ONE OF THEM COST THE WRITER ITS RULES (run 21,
              //    2026-09-22). `fretwork-1`'s database is real and its
              //    `site_backends.neon_db` is blank — `incomplete` — and in the
              //    container, which has no `SITE_ROUTES`, that reader answers
              //    `null`. `eSpec` then became `{ tables: [] }`, `pageRulesFor`
              //    handed the rewrite the FRONTEND rules ("THIS SITE HAS NO
              //    DATABASE … no useRpc", rule 11 dropped), and the writer
              //    rewrote a page and component that read the database while
              //    being told there was none — so no rule about a function's
              //    answer could ever reach it. Run 21's four wire problems are
              //    byte-identical to `lintPages` over `{ tables: [] }`.
              //
              //    THE FAST READER STAYS THE FIRST QUESTION, so every site it
              //    answers is handled exactly as before. Only its `null` — the
              //    one answer that collapses four facts — is asked again, of the
              //    four-state reader the rules rung and the addon already use:
              //      incomplete / ready → the proven connection, and the spec
              //                           read the catalog-aware way below
              //      none               → no database: `{ tables: [] }`, as before
              //      unreadable         → stop, cost 0: never rewrite a page as if
              //                           its database did not exist
              //    `ready` REACHES HERE ONLY IN A RACE: the fast read saw a blank
              //    reference and this one, a moment later, a recorded one — a
              //    backend repair landing mid-message (the per-site claim keeps
              //    two JOBS off one site; the repair script runs outside it).
              //    ⚠ NOT THROUGH A CACHE, which the first cut of this comment
              //    claimed and a sweep survivor disproved: `makeCache` refuses
              //    to store a `null` ("never cache absence"), so the fast reader
              //    re-asks every message and finds a new database itself. A
              //    `ready` row whose connection cannot be built at all falls
              //    through exactly as before — the fast reader answered `null`
              //    for it too, and changing that is a different decision.
              //    NOTHING IS WRITTEN HERE: this rung needs the connection for one
              //    message and no more. Recording the reference is not its job —
              //    the provision that made the database records it
              //    (`healSiteBackendDb`, admitted by the job gateway since
              //    2026-10-18, audit A04-2/A09-1).
              let eDb = await siteRowConn(env, ownerSlug);
              let eResolved = false;
              if (!eDb) {
                const eBack = await siteBackendDetail(env, ownerSlug);
                if (eBack.state === "unreadable") {
                  console.error("page edit backend unreadable:", ownerSlug, eBack.why, eBack.detail || "");
                  return eAnswer({
                    status: 503, ok: false, error: "backend", cost: 0, ours: true, backend: eBack.why, unchanged: true,
                    // RUNG-SCOPED (2026-09-23): "nothing on your site changed"
                    // is the browser's to add, on a reply whose every step
                    // says so — printed beside a step that shipped, it lied.
                    msg: "I couldn't reach your site's database just now, so I've stopped rather than rewrite your page as if it had none — this is on us. Try again in a few minutes.",
                  });
                }
                // A CONNECTION IS THE ANSWER. `siteBackendDetail` hands one back
                // for `incomplete` and `ready` and never for `none` or
                // `unreadable`, so re-asking the state here would be a second
                // copy of that rule — and a sweep showed the copy could not be
                // driven: its `ready` arm is only reachable in the race above.
                if (eBack.conn) {
                  eDb = eBack.conn;
                  eResolved = true;
                }
              }
              let eSpec = null, eLook2 = null, eCss2 = "", eSpecStop = "";
              // WHETHER THE CONFIG WAS READ, apart from what it held: a read
              // that failed is ours and is said, while a config that answered
              // with no look at all is a site from before designs were stored,
              // which only the rewrite can regenerate (2026-09-23). They were
              // one `no-meta`.
              let eCfgRead = false;
              try {
                const cfg = await readSiteConfig(env, ownerSlug, eDb);
                if (!cfg.ok) throw new Error(cfg.why + ": " + cfg.error);
                eCfgRead = true;
                eLook2 = cfg.config.look;
                // AND THE STYLESHEET THE SITE IS WEARING. Read from the same
                // config as the look, in the same read — a second read would
                // be a second answer to one question and the two can disagree.
                eCss2 = typeof cfg.config.css === "string" ? cfg.config.css : "";
                // ── A SITE WITH NO DATABASE HAS NO TABLES, WHICH IS AN ANSWER
                //    AND NOT A FAILURE (2026-08-29) ────────────────────────────
                //
                // This read was unguarded, so on a frontend-only site
                // `sqlQuery(null, …)` threw, the catch below logged it, `eSpec`
                // stayed null and the lane escalated `no-meta` — for EVERY such
                // site, which is the DEFAULT since a first build stopped
                // provisioning a database. The cheap `tweak` above still ran, so
                // the lane was not wholly dead; what was dead is the rewrite it
                // falls back to, on the majority of the platform.
                //
                // The same shape as the `look` and `logo` gates removed on
                // 2026-08-28, one rung up and missed then: a requirement the
                // code has outgrown, refusing the case it was never about. It
                // surfaced because `shape`, `components` and `purpose` now
                // DISPATCH here, so a lane that refuses most sites is a lane
                // that does not act.
                //
                // `{ tables: [] }` IS THE TRUTH about a frontend-only site, and
                // it is what the page generator wants — the same value the build
                // path hands it. NULL IS KEPT FOR A SITE THAT HAS A DATABASE and
                // whose `_meta` could not be read, because cannot-tell must
                // never read as nothing-there: rewriting those pages against an
                // empty schema would silently drop every control that reads a
                // row. Same reasoning as `loadConfig`, one layer down.
                if (eDb && eResolved) {
                  // A SITE RESOLVED ABOVE IS READ THE CATALOG-AWARE WAY — the
                  // reader the rules rung and the addon use for this very
                  // state. Its `_meta` is the one most likely to disagree with
                  // its database, and a missing schema row is not an empty
                  // database. Read-only: nothing is written back.
                  try {
                    const eRead = await specForAddon(eDb);
                    if (eRead.ok) eSpec = eRead.spec;
                    else eSpecStop = String(eRead.why || "spec-unreadable");
                  } catch (e) { eSpecStop = "spec-read-threw"; }
                } else if (eDb) {
                  const rows = await sqlQuery(eDb, "SELECT v FROM _meta WHERE k = 'schema'");
                  const row = (rows || [])[0];
                  if (row && row.v) eSpec = JSON.parse(row.v);
                } else {
                  eSpec = { tables: [] };
                }
              } catch (e) { console.error("page edit meta read failed:", ownerSlug, e && e.message); }
              // ── A READY SITE WHOSE `_meta` GAVE NOTHING (2026-09-23) ──────────
              //
              // No row, or a read that threw, left `eSpec` null and escalated
              // `no-meta` with no layer — the rewrite of every page, which
              // cannot repair a schema either. A missing row is not an empty
              // database, so the catalog-first reader the resolved branch
              // above already uses is asked here too, READ-ONLY, before
              // anything is concluded.
              if (eCfgRead && !eSpec && eDb && !eSpecStop) {
                try {
                  const eRead = await specForAddon(eDb);
                  if (eRead.ok) eSpec = eRead.spec;
                  else eSpecStop = String(eRead.why || "spec-unreadable");
                } catch (e) { eSpecStop = "spec-read-threw"; }
              }
              // CANNOT-TELL STOPS HERE TOO, and does not escalate: `no-meta`
              // carries no layer, so the browser would answer it with the
              // ~25-credit rewrite of every page — which cannot repair a schema
              // this rung could not read.
              if (eSpecStop) {
                console.error("page edit schema read failed:", ownerSlug, eSpecStop);
                return explain("page/spec-unreadable", {}, { backend: eSpecStop });
              }
              if (!eCfgRead) return explain("page/config-unreadable", { page: wantRoute });
              // A STYLESHEET WITH NO STORED LOOK IS EXISTING DESIGN (audit
              // A37-5): the look rung edits it and the add-on explains rather
              // than rewrite it, so this rung says so at no cost too; only a
              // site with neither climbs to the rewrite.
              if (!eLook2 && eCss2.trim()) return explain("page/css-only", { page: wantRoute });
              if (!eLook2) return escalate("no-look");
              // UNREACHABLE once the config was read: every branch above either
              // sets a schema or sets a stop. Said rather than climbed if it ever
              // is not.
              if (!eSpec) return explain("page/spec-unreadable", {}, { backend: "spec-missing" });
              // THE DRAFT'S HELD TABLES, AS IF MADE (audit A06-5, 2026-10-22):
              // the writer and the lint are shown the schema the draft's next
              // Publish will make, so a page reading a held table keeps its
              // hook. A draft that cannot be read stops, as the data step does.
              if (draftFirst(env)) {
                let eView = null;
                try { eView = await draftView(env, ownerSlug); }
                catch (e) { console.error("page edit: draft unreadable", ownerSlug, errorClassForLog(e)); return explain("page/spec-unreadable", {}, { backend: "draft" }); }
                if (eView) eSpec = specOverlay(eSpec, eView.ops);
              }

              const eModels = modelsFor(eb && eb.picker);

              // ── WHAT THE PAGE WRITER IS SHOWN ────────────────────────────
              //
              // `briefWithLayout` has taken `parts`, `partsUnreadable`,
              // `theme`, `css` and `plan` since 2026-09-17 and this rung
              // passed none of them, so the one call on the edit path that
              // rewrites a whole page was the blindest caller of it there is.
              //
              // READ BEFORE THE CALL AND AGAIN AFTER IT, from ONE snapshot —
              // the addon's rule, and its reason: the route read the store
              // twice, minutes apart, and the two could disagree, so the
              // prompt and the wall that checks the answer were built from
              // different beliefs about the site.
              const pPartsRead = await editParts();
              // ⚠ `.ok`, AND THE OBVIOUS `.parts.length` IS MEASURED EQUIVALENT
              // TODAY RATHER THAN WRONG. They differ on exactly one input — a
              // readable store with NO components, where this answers `[]` and
              // that answers `null` — and both flow only into `partsSent`,
              // which normalises them to the same three empty lists. Driven
              // through the route over four scenarios (readable, failed read,
              // empty store, withheld component): byte-identical status, reply,
              // compiler payload, stored inventory and prompt.
              //
              // IT STAYS `.ok` BECAUSE IT STATES THE QUESTION. "Could we read
              // it" is what every line below is really asking; "does it have
              // any" is a different question that happens to agree, and the day
              // a reader distinguishes `[]` from `null` the agreement ends
              // silently. Said here because a sweep reports this as a survivor
              // and cannot say why.
              const pStoredParts = pPartsRead.ok ? pPartsRead.parts : null;
              // THE COMPONENTS THIS PAGE IMPORTS GO IN FIRST (audit A21-4), or
              // other pages' parts stored earlier fill the budget and the one
              // the customer is asking about is withheld as "too long".
              const pOwnParts = [...String((target && target.source) || "").matchAll(/["'](?:@\/routes\/|\.\/)-parts\/([^"'/]+?)(?:\.tsx)?["']/g)].map((m) => m[1]);
              // THE FILE PICKER (2026-10-23, idea #21): on a big site one quick
              // call picks which components the writer is shown; the page and
              // every part it imports always are. `null` below the threshold,
              // `only: null` when it failed — both send what was sent before.
              // Its usage rides this rung's one bill. The wall below reads the same
              // `only`; measured equivalent today (a returned part the page does
              // not import is already held, `partsHeld`), kept so the prompt and
              // the wall cannot disagree.
              const ePick = pPartsRead.ok ? await pickFiles({ send: jobSend(eJob, mappedSend(env, ownerSlug, "page", quickSend(env, "file-pick"))) },
                { request: eInstruction, pages: eSrc, parts: pStoredParts, targets: [target.path], model: eModels.quick }) : null;
              const pPartsOnly = ePick && ePick.only ? ePick.only.parts : undefined;
              if (ePick) { try { if (editTrace) editTrace.mark("file_pick", ePick.mark.status, ePick.mark); } catch { /* never */ } }
              const pSentParts = partsSent(pStoredParts, { unreadable: !pPartsRead.ok, first: pOwnParts, only: pPartsOnly });
              // AND THE KIT SIGNATURES FOR THE PAGE BEING EDITED. `plan` is
              // how `siteComponentApi` is reached, and without it the writer
              // was rewriting a page built from `<Accordion>` with no idea of
              // that component's props.
              //
              // ⚠ THE SCOPING IS THE `[wantRoute]` INDEX, NOT THE ARGUMENT,
              // and a first draft of this comment claimed otherwise. A sweep
              // mutant passing `eSrc` here SURVIVED, and the measurement says
              // why: `pageComponents` answers a map KEYED BY ROUTE, so
              // selecting `wantRoute` out of the whole site and out of the one
              // page give the same entry — driven over four scenarios,
              // byte-identical throughout. What `[target]` really buys is not
              // walking every page's imports to throw all but one away. Said
              // out loud because *the argument does the scoping* is the kind of
              // claim that survives until somebody relies on it.
              //
              // `modules`, NEVER `kit`. `pageComponents` answers both and they
              // are different vocabularies — `siteComponentApi` is keyed on
              // the MODULE name (`seat-map`), and handing it the EXPORT names
              // answers "" for every one, which from outside is
              // indistinguishable from a page importing nothing. That one is
              // NOT equivalent and the sweep kills it.
              const pPageApi = pageComponents([target])[wantRoute];
              const pPlanComponents = (pPageApi && Array.isArray(pPageApi.modules)) ? pPageApi.modules : [];

              let eGen = null;
              // THE PAGE WRITER, KEPT CALLABLE (round 2 of the retry rule): its last
              // request and answer are recorded (`pRec`) so an answer that failed the
              // checks below can be asked once more with the reason (`pWrite`).
              const pInner = clarifyCall(jobCall(eJob, mappedCall(env, ownerSlug, "site", pagesCall(env))), { shown: () => eCtx, all: () => eCtxAll || [], part: ePartShown, replayHas: eReplayHas, onDefault: (d) => { eDefaulted.push(...d); } });
              const pRec = recordCall(pInner);
              let pWrite = null;
              try {
                // Same as the addon lane: a stated zero, because the absence of
                // one is not an instruction and the model writes tokens anyway.
                // WHAT THE SITE ALREADY HAS, SAID TO THE MODEL. The build's
                // directives for the hand-written components, the marks and the
                // 3D scene were never passed on this rung, so a page edit did
                // not know a component's import path, that `SITE_QR` exists, or
                // that the canvas is deliberate. Read from the stored look, the
                // same fields the build read from the design.
                // THE OWNER'S VIDEO AND AUDIO (2026-10-14), by address — read
                // for this site, and none when the library cannot be read.
                const eMedia = (await withinMs(siteMediaFiles(env, ownerSlug), CONVERSE_READ_MS, "edit media:", ownerSlug)) || [];
                pWrite = (pCall) => generateSitePages(env, briefWithLayout({
                  brief: eAskOf(eInstruction),
                  media: eMedia,
                  // ── THE BUDGET IS STILL ZERO; THE SENTENCE IS NO LONGER A
                  //    CLAIM ABOUT THE SITE ────────────────────────────────
                  //
                  // This was a bare `0`, and `imageDirective` says a bare zero
                  // as *"PHOTOGRAPHS: none on this site … Every picture is
                  // <SafeImage> with no src … that is the intended look
                  // here."* On a site that HAS photographs every clause is
                  // false and the last two are an instruction to STRIP them —
                  // reproduced through this route on a site showing two, on a
                  // request that asked in as many words to keep them: both
                  // `src` attributes came back empty, the publish carried the
                  // stripped page, the store kept it, and the reply said
                  // `photos: 0`.
                  //
                  // THE BUDGET IS UNCHANGED AND MUST BE. This rung buys
                  // nothing; what moves is that the zero is stated as OURS and
                  // what the site really shows is READ. The addon path made
                  // exactly this correction on 2026-09-17 and says why in
                  // `imageDirective`'s own comment; this is the caller that
                  // never moved.
                  //
                  // THREE-STATE, THROUGH `photoInventory`. A component store
                  // we could not read answers `null`, which reaches
                  // `shownPhotos` as `known: false` and the directive then
                  // says *"Leave every picture already on this site exactly as
                  // it is"* rather than claiming a count — cannot-tell must
                  // never read as a value, in the one input that decides what
                  // a model believes about the site it is editing.
                  //
                  // `place` IS FALSE HERE, deliberately. It is the addon's
                  // "a picture was asked for and is not being bought" clause,
                  // which promises the picture rung will fill the slot; this
                  // rung has no photograph request to hand on.
                  images: {
                    shown: shownPhotos(photoInventory(eSrc, pStoredParts, pPartsRead.ok), ownerSlug),
                    place: false,
                  },
                  plan: pPlanComponents.length ? { components: pPlanComponents } : null,
                  // THE DECLARATIONS **AND** THE REAL SOURCE. Sent alone,
                  // `tsx` reaches `tsxDirective` with an empty filter, so every
                  // component the site ALREADY HAS arrived under a heading
                  // telling the writer to build it — and anything it returned
                  // replaced the real file by name. `partsSent` splits the two
                  // lists from one input, so no component can be in both and
                  // none can be missing from both.
                  tsx: eLook2.tsx, parts: pStoredParts, partsUnreadable: !pPartsRead.ok, partsFirst: pOwnParts, partsOnly: pPartsOnly,
                  gif: eLook2.gif, qr: eLook2.qr, three: eLook2.three,
                  // AND THE LOOK IT IS WEARING, sent as ALREADY APPLIED. The
                  // stylesheet is appended last at build time so it wins on
                  // source order; a model shown one with no such sentence
                  // restates its rules inline, where editing the stylesheet
                  // can no longer reach them.
                  theme: eLook2.theme, css: eCss2,
                }), eSpec, eLook2.brand || ownerSlug, [], eModels.pages, eSrc, "page", target.path,
                // NO CLOCK OF ITS OWN, exactly as before; AND THE ANSWERS this
                // step was given (2026-10-02), through the same transport every
                // other call on this route goes through (`clarifyTransport`).
                null, pCall,
                // A SITE THAT WRITES ITS OWN PARTS (2026-10-23) is edited by a
                // writer told the same: the own-parts block, never the kit's.
                // AND THE PICKED PAGES (2026-10-24): the rewrite fallback (a
                // target too large to show alone) shows only the picked pages.
                "", [], { ownParts: ownPartsSite(eSrc, pStoredParts), only: ePick && ePick.only ? ePick.only.pages : null });
                eGen = await pWrite(pRec.call);
              } catch (e) {
                console.error("page edit generate failed:", ownerSlug, e && e.message);
                const pKind = upstreamKind(e && e.detail, e && e.status);
                return Response.json({
                  ok: false, error: "generate", cost: 0,
                  msg: pKind.billing
                    ? "The site builder is temporarily unavailable — this is on us, not your change."
                    : "The builder is busy — try again in a moment.",
                  upstream: (e && e.status) || null, upstreamType: pKind.type, billing: pKind.billing || undefined,
                }, { status: 503 });
              }
              // A QUESTION BACK (2026-10-02): the page writer, shown the page,
              // could not tell which part of it was meant. This step changes
              // nothing and charges nothing for the edit — the quick writer's
              // call before it included, as on every other way a step asks.
              if (eGen && eGen.ask) return stepAsk("page", eGen.ask);

              // `knownRoutes`: the site's own stored pages, so the dangling-link
              // rewrite stops treating every UNCHANGED page as nonexistent — a
              // one-page edit used to have its correct <Link to="/book"> pointed
              // at "/" and the customer told their live page did not exist
              // (2026-08-13 audit, reproduced with the real module).
              // THE WRITER'S ANSWER, READ (round 2: a function, so a retried answer is
              // read exactly as the first).
              const pRead = (gen) => {
                const pValid = validatePages(gen && gen.input, {
                  partial: true,
                  knownRoutes: (eSrc || []).map((p) => routeOf(p && p.path)).filter(Boolean),
                });
                // THE PARTS ARE COUNTED AND SWEPT BESIDE THE PAGES. This rung buys
                // nothing (`images: 0`) and the sweep is the whole of what it does
                // with a token — so a model that answered a photograph inside a
                // COMPONENT had that token stored and published as a literal
                // `src="@@IMG:…@@"`, which the browser cannot fetch. The build path
                // shipped exactly that live on `hebden-bike-repair` (2026-09-12);
                // `builder/site-images.mjs`'s `imageSources` has the account.
                // ⚠ AND IT PRODUCES NO NUMBER ANY MORE. `countImageSlots` counts
                // `@@IMG:` TOKENS, and this rung's directive forbids them, so on
                // every obedient answer it was zero — and where a token WAS
                // written the sweep one line down turns it into `src=""`, which
                // is an empty frame the message-wide reader below the loop sees
                // on the after side. Two readers of one fact, one of which is
                // silent in the ordinary case; the sweep is the part that was
                // ever load-bearing and it is what stays.
                pValid.pages = applyImages(pValid.pages, {});
                pValid.parts = applyImages(pValid.parts, {});
                // AND THE INVENTED EXPORT NAME IS REPAIRED, on this lane too. It
                // was wired into the build path alone, and these two lanes
                // generate whole pages exactly as that path does — so a model
                // reaching for `FaqAccordion` on a module that exports `Faq` cost
                // the customer their whole change here while the build path
                // silently fixed it. Deterministic and single-answer-only: no
                // model call, and a module with more than one candidate is left
                // for tsc rather than guessed at.
                //
                // BEFORE THE LINT, or the lint reports an import the repair has
                // already fixed and the customer is told about a problem that no
                // longer exists.
                const pRepair = repairImports(pValid.pages, { parts: pValid.parts });
                pValid.pages = pRepair.pages;
                // AND THE PARTS, which compile in the same program — a bad import
                // in a hand-written component takes the build down exactly as one
                // in a page does.
                pValid.parts = repairImports(pValid.parts, { parts: pValid.parts }).pages;
                const pProblems = pValid.problems.concat(lintPages(pValid.pages, eSpec));
                return { pValid, pProblems };
              };
              const pFirstRead = pRead(eGen);
              let pValid = pFirstRead.pValid;
              let pProblems = pFirstRead.pProblems;
              // ONLY THE PAGE THAT WAS ASKED FOR. A page edit that returns a
              // different file is not a page edit, and taking it would let one
              // instruction rewrite a page the customer never named. The prompt
              // says so too; this is the half that cannot be talked out of it.
              // ⚠ `let`, BECAUSE THE PROTECTION BELOW REWRITES IT. The page
              // that ships is the model's answer with any photograph it emptied
              // put back, and every reader under this line — the no-change test,
              // `orderingMoved`, the publication — must see that one and not the
              // answer it replaced.
              let wrote = (pValid.pages || []).find((p) => p.path === target.path);
              // ── NO PAGE BACK, OR THE PAGE BACK UNCHANGED: ASKED ONCE MORE ─────
              //
              // (Round 2 of the retry rule, owner 2026-10-24: "a task must never
              // fail completely without at least one retry".) The two endings
              // below — `page/no-page-back` (the writer sent no file for the page
              // asked about) and `page/no-change` (it sent the page back exactly
              // as it was, and no component either) — are checks on the writer's
              // own answer, so the SAME request (same model, same effort) is sent
              // once more with that answer and the reason (`pRec.again`), and the
              // retry's answer is read exactly as the first (`pRead`). A second
              // miss is today's sentence, at no cost for the edit; a retry that
              // asks is the step's question. Both calls ride the step's usage only
              // when the retry wrote the change.
              {
                const pStoredByName = new Map((Array.isArray(pStoredParts) ? pStoredParts : []).filter((x) => x && typeof x.name === "string").map((x) => [x.name, x.source]));
                const pPartChanged = (v) => (v.parts || []).some((pt) => pt && (!pStoredByName.has(pt.name) || pStoredByName.get(pt.name) !== pt.source));
                const pMissWhy = (v, w) => !w ? "no-page-back" : (w.source === target.source && !pPartChanged(v)) ? "no-change" : null;
                const pWhy0 = eGen && !eGen.ask && !eGen.truncated && pRec.last && typeof pWrite === "function" ? pMissWhy(pValid, wrote) : null;
                // NOT RETRIED FOR WHAT THE SITE ALREADY HAS (`eExisting`, above).
                const pWhy = pWhy0 === "no-change" && eExisting ? null : pWhy0;
                if (pWhy) {
                  const pReason = pWhy === "no-page-back"
                    ? "Nothing was changed: your answer did not include the page " + target.path + " (the one file this change is about), so it could not be applied. Answer again with that page, whole, with the change the request asks for made in it."
                    : "Nothing was changed: the page " + target.path + " came back exactly as it was, and no component changed either, so the request was not carried out. Read the request again and answer with the page, whole, with that change made" + (pProblems.length ? " (problems found: " + pProblems.join("; ").slice(0, 300) + ")" : "") + ". If the page really already does what is asked, send it back unchanged again.";
                  let pGen2 = null;
                  try { pGen2 = await pWrite(pRec.again(pReason, pInner)); } catch { pGen2 = null; }
                  if (pGen2 && pGen2.ask) { editTrace.mark("retry_reason", "fail", { step: "page", reason: pWhy, ok: false }); return stepAsk("page", pGen2.ask); }
                  const pRead2 = pGen2 && pGen2.input ? pRead(pGen2) : null;
                  const wrote2 = pRead2 ? (pRead2.pValid.pages || []).find((p) => p.path === target.path) : null;
                  const pOk2 = !!pRead2 && !pMissWhy(pRead2.pValid, wrote2);
                  editTrace.mark("retry_reason", pOk2 ? "ok" : "fail", { step: "page", reason: pWhy, ok: pOk2 });
                  if (pOk2) {
                    eGen = { ...pGen2, usage: addUsages(eGen.usage || null, pGen2.usage || null) };
                    pValid = pRead2.pValid; pProblems = pRead2.pProblems; wrote = wrote2;
                  }
                }
              }
              // A CHANGED COMPONENT IS A CHANGE. Run 12's tsx lane (2026-09-02)
              // asked for a word inside the chord-diagram component; the model
              // rewrote the PART and handed the page back as it was, and this
              // read the unchanged page as "no change" — the honest answer to
              // "the site already does that", given for an edit that was
              // sitting in `parts`. A part that is new, or differs from the
              // stored one, is a change even when the page is byte-identical.
              //
              // ── AND NOTHING REPLACES WHAT THE WRITER WAS NEVER SHOWN ─────
              //
              // The addon route's wall, on the rung that needed it just as
              // much: `mergeParts` replaces by name and has no wall of its
              // own, so a returned `CardA` overwrote the real `CardA`
              // whatever the model had in front of it. The ordinary case is
              // now that every stored component's source IS in the prompt, and
              // then this refuses nothing at all — it is the honest answer to
              // `partsSent`'s size bound, which withholds a component too
              // large to carry.
              //
              // BY THE SAME `pSentParts` THE PROMPT WAS BUILT FROM, so "was
              // this shown?" has exactly one answer.
              //
              // ⚠ AN UNREADABLE STORE REFUSES EVERY ONE, and that is a
              // SEPARATE list because it is a separate sentence. `withheld`
              // names components we read and chose not to send; `unreadable`
              // means we never learned a single name, so there is nothing to
              // check a returned component against and no way to know what a
              // replacement would destroy. The two can never both fire —
              // `partsSent` answers empty lists when it cannot read.
              //
              // ⚠ AND THAT `return false` IS A DECLARED REDUNDANCY, MEASURED
              // RATHER THAN REASONED ABOUT — the addon route's own wall carries
              // the same note for the same line. The merge below refuses to
              // write anything at all while `pPartsRead.ok` is false, so
              // KEEPING a returned component here changes no observable:
              // driven through the route with the store throwing, the status,
              // the reply, the compiler payload and the stored inventory are
              // byte-identical either way, and the sweep reports it as a
              // survivor.
              //
              // IT STAYS BECAUSE THE TWO SAY DIFFERENT THINGS — this one is
              // "which returned components may be kept", that one is "may we
              // write at all" — and because `pUnseenParts` is filled on this
              // line, which is what the customer hears. The sweep mutates the
              // PAIR, since neither half can be killed alone; said here because
              // a sweep cannot say it and the next session deletes what nothing
              // appears to need.
              const pKeptParts = [], pUnseenParts = [];
              let pFreshParts = (Array.isArray(pValid.parts) ? pValid.parts : []).filter((p) => {
                const n = String((p && p.name) || "").toLowerCase();
                if (pSentParts.unreadable) { pUnseenParts.push(p && p.name); return false; }
                if (!pSentParts.withheld.some((w) => w.toLowerCase() === n)) return true;
                pKeptParts.push(p.name);
                return false;
              });
              // ⚠ MEASURED AGAINST THE COMPONENTS WE ACCEPTED, over the
              // snapshot the prompt and the wall were both built from — never
              // a second read. `!!pStored` used to stand where `pPartsRead.ok`
              // does, and it was wrong in both directions: a site with NO
              // stored components read as "cannot tell" (so a brand-new
              // component was not a change, and a part-only edit escalated
              // `no-change`), while a store that THREW read as "no components"
              // (so anything counted as a change and the merge below deleted
              // the rest).
              // ── AND NOW THE PHOTOGRAPHS NOBODY ASKED ABOUT GO BACK ───────
              //
              // Owner: *"Photo preservation is not fixed by publishing the
              // loss and reporting it afterward."* It was not: the rung read
              // the loss off the publication, shipped it, and named it in the
              // reply. A customer whose sentence said *"keep the window
              // photograph"* got an empty frame and a note about it.
              //
              // ⚠ HERE, AND NOT ABOVE THE PARTS WALL, and the position is the
              // second of this round's corrections. *"Evaluate the accepted
              // publication across pages and components TOGETHER, after
              // discarded outputs are excluded"* — so the guard is asked of
              // exactly what will ship: the target page folded into the
              // site's own list, and the components the wall ACCEPTED.
              // Anything the wall refused, and every page the model returned
              // that was not asked for, is gone by now. A guard that ran
              // before them would protect a file nobody publishes and count a
              // picture in one as still shown.
              //
              // ⚠ AND THE TWO LISTS GO IN ONE CALL. Two calls, one per list,
              // each had a site-wide rule that was only half site-wide: a
              // writer moving a photograph out of the page and into a
              // component left the page's slot empty, the pages call could
              // not see where it had gone, and restored it — the same picture
              // published TWICE.
              //
              // AFTER THE SWEEP TOO. `applyImages` is what turns an unbought
              // `@@IMG:` token into `src=""`, so a restoration above it would
              // meet a token and one below it meets the empty attribute the
              // customer would really have seen.
              //
              // ── WHERE THE PERMISSION COMES FROM, AND IT IS NOT A FLAG ────
              //
              // The BEFORE is `eSrc` and the stored components — the site as
              // it stands at the moment this rung starts, which is not the
              // site the message arrived to. `publishStep` advances `eSrc`,
              // so a picture rung that really cleared or replaced a
              // photograph has ALREADY written that into it: the slot is
              // empty, there is nothing to put back, and the removal ships.
              // One that did not run, or ran and matched nothing, leaves the
              // photograph standing and this protects it.
              //
              // THAT IS THE SCOPE, AND A BOOLEAN WAS NOT. The first cut asked
              // whether the MESSAGE had a picture step at all and turned the
              // whole protection off when it did — so *"remove only the
              // window photograph; keep the bench photograph"* published both
              // missing. Permission belongs to the picture operations that
              // really matched, and the state is where those are recorded.
              // ── A COMPONENT THIS PAGE DOES NOT DRAW, OR ONE THAT LOST WHAT
              //    NOBODY ASKED ABOUT, STAYS AS IT WAS (audit A21-2, 2026-10-22)
              //
              // The checks below compare the PAGE; a rewritten component used
              // to ship unread, so "change the sourdough price on the menu
              // card" could publish the card with two loaves gone, and a
              // reworded component only /visit draws, under "Updated /menu.".
              // `part-keep.mjs` holds both rules. A component held here is
              // dropped from what this rung accepted, so the stored copy is
              // what the merge keeps and what ships; the reply names it.
              // HERE, ABOVE THE PHOTOGRAPH GUARD, so that guard is asked of
              // exactly what will ship. The judge reads the writer's copy:
              // a photograph's `src` is neither words nor a link.
              const pPartsHeld = [], pPartsLossHeld = [], pPartUsage = [];
              if (pFreshParts.length && pPartsRead.ok) {
                const reached = partsReached([target.source, wrote ? wrote.source : ""], target.path, pPartsRead.parts);
                const said = declaredDoes(eLook2 && eLook2.tsx);
                const back = new Set();
                for (const pt of pFreshParts) {
                  const s = pPartsRead.parts.find((x) => x && x.name === pt.name);
                  if (!s || s.source === pt.source) continue;
                  if (!reached.has(pt.name)) { back.add(pt.name); pPartsHeld.push(partSaid(pt.name, said)); continue; }
                  const v = await partKeepCheck({
                    message: eInstruction, before: s.source, after: pt.source, does: said,
                    send: eQuick("keep_check"), model: eQuickModel,
                  });
                  if (v.usage) pPartUsage.push(v.usage);
                  if (v.verdict === "kept" || v.verdict === "asked") continue;
                  back.add(pt.name); pPartsLossHeld.push(partSaid(pt.name, said));
                }
                if (back.size) pFreshParts = pFreshParts.filter((pt) => !back.has(pt.name));
              }
              const pAccepted = (pFreshParts.length && pPartsRead.ok)
                ? mergeParts(pPartsRead.parts, pFreshParts)
                : (pPartsRead.ok ? pPartsRead.parts : []);
              const pShip = wrote
                ? eSrc.map((p) => (p.path === target.path ? { path: p.path, source: wrote.source } : p))
                : eSrc;
              const pGuard = keepPhotos(
                // ⚠ THE COMPONENT SIDE IS EMPTY ON AN UNREADABLE STORE on
                // BOTH sides, never the store's own copy: `ok` false means we
                // never learned a name, and pairing against a list we could
                // not read is pairing against nothing. Empty against empty is
                // the reading that says *nothing about the components moved*,
                // which is true — the merge publishes none of them.
                { pages: eSrc, parts: pPartsRead.ok ? pPartsRead.parts : [] },
                { pages: pShip, parts: pAccepted },
                ownerSlug,
              );
              const pRestored = pGuard.restored;
              // RECORDED ACROSS THE MESSAGE, NOT ANSWERED HERE. Read once
              // below the loop against the publication — see `ePhotosHeld`.
              for (const u of pRestored) ePhotosHeld.add(u);
              const pGuarded = wrote ? pGuard.pages.find((p) => p.path === target.path) : null;
              if (pGuarded) wrote = { ...wrote, source: pGuarded.source };
              const partMoved = pPartsRead.ok && pFreshParts.some((pt) => {
                const s = pPartsRead.parts.find((x) => x && x.name === pt.name);
                const g = pGuard.parts.find((x) => x && x.name === pt.name);
                return !s || s.source !== ((g && g.source) || pt.source);
              });
              if (!wrote || (wrote.source === target.source && !partMoved)) {
                // ── A CHANGE A PROTECTION WITHHELD IS NOT A NO-CHANGE ──────
                //
                // Owner: *"A component-only refusal falls into the full-rewrite
                // fallback … the browser initiates a full rewrite with no
                // refusal explanation."* REPRODUCED: an oversized stored
                // component, an unchanged page back, and a replacement for the
                // component the wall had withheld — the wall refuses it (which
                // is the point of the wall), nothing is left that differs, and
                // this line then reported the site as already that way.
                //
                // `escalate` IS WHAT THE BROWSER ACTS ON, not a word in a log.
                // `escalatedEdit` reads it and runs the ~25-credit rewrite of
                // every page — so a guard that exists to avoid rewriting ONE
                // component unseen bought a rewrite of the whole site, and the
                // sentence explaining why never reached the screen at all.
                //
                // THE DISCRIMINATOR IS WHETHER A PROTECTION REALLY ACTED, and
                // all three are the same kind of fact: a component too large
                // to show, a store we could not read, and a photograph put
                // back. Each is US declining to write something, which is the
                // one reason "nothing changed" is not a statement about the
                // customer's request.
                //
                // ⚠ A GENUINE NO-CHANGE STILL ESCALATES, and that is the half
                // worth saying out loud: a model that hands back the page it
                // was given, with nothing withheld anywhere, is answering
                // *"the site already does that"* — and the ladder is right to
                // climb. The condition is a positive test on this route's own
                // three lists, never a blanket refusal to escalate.
                //
                // NOT AN `escalate`, NOT A 422 COMPILE FAILURE, AND COST 0.
                // Its own error name, its own sentence, and the browser's
                // refusal branch — which starts nothing, which is the whole
                // fix. `keptParts`/`unseenParts` ride along so the screen can
                // name the component rather than describing a category.
                if (wrote && (pKeptParts.length || pUnseenParts.length || pRestored.length || pPartsHeld.length || pPartsLossHeld.length)) {
                  return Response.json({
                    ok: false, error: "withheld", cost: 0,
                    // ⚠ SCOPED TO THIS RUNG — see `withheldPhotosMsg`. Each of
                    // these says what THIS change did not do and stops there;
                    // "nothing changed" and "you haven't been charged" are
                    // claims about the whole request, and the browser adds
                    // them on the branch that can see the whole request
                    // refused. A rung that ran beside a picture step which
                    // really took a photograph off must not tell the customer
                    // their site is untouched.
                    msg: pKeptParts.length
                      ? "I couldn't make that change without rewriting " + pKeptParts.join(" and ") +
                        " unseen — " + (pKeptParts.length === 1 ? "it is" : "they are") +
                        " too long to show the builder in one go, so I didn't make it. " +
                        "Ask for a smaller part of it and I'll do that."
                      : pUnseenParts.length
                        ? "I couldn't read this site's sections just now, so I didn't make that change — " +
                          "changing a page without them could take one off. Try again in a moment."
                        : (pPartsHeld.length || pPartsLossHeld.length)
                          ? partsHeldMsg(pPartsHeld, pPartsLossHeld)
                        : "The only thing that change would have done is take a photograph off your page, " +
                          "so I didn't make it. Say “take the photo off” if that is what you wanted.",
                    keptParts: pKeptParts.length ? pKeptParts : undefined,
                    unseenParts: pUnseenParts.length ? pUnseenParts : undefined,
                    partsHeld: pPartsHeld.length ? pPartsHeld : undefined,
                    partsLossHeld: pPartsLossHeld.length ? pPartsLossHeld : undefined,
                    problems: pProblems,
                  }, { status: 409 });
                }
                // ⚠ EXPLAINED, NOT CLIMBED (2026-09-23) — and this reverses the
                // 2026-09-20 control that kept a genuine no-change escalating.
                // The page's own writer saw the page and the request and changed
                // nothing; a rewrite of EVERY page is no evidence it would do
                // better, and it risks the pages nobody asked about. A writer
                // that sent no page back is a model failure, ours. Both are a
                // sentence at no cost for the edit.
                if (!wrote) return explain("page/no-page-back", { page: wantRoute }, { problems: pProblems });
                // ALREADY ON THE SITE (2026-10-25, frame-parallel): an add-on about
                // a page the site has, answered unchanged by that page's writer, is
                // done as it stands — nothing published, nothing charged for it.
                if (eExisting) {
                  return Response.json({
                    ok: true, satisfied: true, existing: true, layer: "page", changed: [], pageOps: [],
                    msg: "The " + wantRoute + " page already has what you asked for, so I left it as it was.",
                    cost: 0,
                  });
                }
                return explain("page/no-change", { page: wantRoute }, { problems: pProblems });
              }
              // ── AND A LOSS THE PROTECTION COULD NOT REACH IS WITHHELD ────
              //
              // Owner: *"If an unrelated edit loses a protected image and safe
              // restoration is uncertain, withhold the unsafe change with an
              // explanation. Do not publish the loss merely because matching
              // failed, or trigger a full rewrite."*
              //
              // ⚠ RESTORATION IS NOT COVERAGE, AND THE FIRST CUT TREATED IT AS
              // IF IT WERE. Everything `keepPhotos` does needs a slot to write
              // into and a description to match on, so a writer that DELETES
              // the element, RENAMES its description or SUBSTITUTES another
              // url walks straight past it — and the picture was then
              // published missing, exactly as before the protection existed.
              // A match that never happened is indistinguishable, from
              // outside, from a file that had nothing to protect.
              //
              // SO `lost` IS ASKED, over the same accepted publication, and a
              // loss left standing REFUSES THIS RUNG. Nothing compiles,
              // nothing is written, cost 0 — and it is NOT an `escalate`, for
              // the reason one branch up: that word buys the ~25-credit
              // rewrite of every page, which is the opposite of protecting
              // one photograph.
              //
              // IT CANNOT FIRE ON AN AUTHORISED REMOVAL, by construction
              // rather than by a flag: the BEFORE is `eSrc`, which already
              // carries whatever the picture rung did, so a photograph it
              // cleared is not in the before and cannot be lost from it.
              if (pGuard.lost.length) {
                const n = pGuard.lost.length;
                return Response.json({
                  ok: false, error: "withheld", cost: 0,
                  // ⚠ THE SAME COMPOSER THE CHEAP TWEAK RUNG USES. One outcome
                  // reached by two paths is one sentence: a second copy here
                  // is how the two drift into describing the same refusal
                  // differently, and this is now the refusal a customer is
                  // most likely to meet — the tweak answers first.
                  msg: withheldPhotosMsg(n),
                  // THE COUNT, NEVER THE URLS — `lostPhotosMsg`'s own rule, one
                  // path over: a storage key tells a customer nothing.
                  photosBlocked: n,
                  problems: pProblems,
                }, { status: 409 });
              }
              // ── AND WHAT THE REWRITE TOOK OFF THE PAGE IS ASKED ABOUT ─────
              //
              // (2026-09-24.) Owner, reproducing it through this route: *"a
              // narrow edit whose answer also drops an unrelated section …
              // publishes, and says Updated /"*. Nothing compared what the page
              // had with what it was about to have. `keepCheck` does, over the
              // page that would really ship — after the photograph guard, so
              // the before is `target.source` as this rung found it (an earlier
              // step's work already in it) and the after is the guarded answer.
              //
              // THE PERMISSION IS THE CUSTOMER'S MESSAGE, ASKED ITEM BY ITEM,
              // and it is the same on this route and through the look door,
              // because the message is the one thing both carry. The picker's
              // `removes` is not consulted: it names lanes, never a target.
              //
              // Links/components retain their existing check. The parsed prose
              // check below separately refuses unconfirmed text changes; a
              // model verdict about a link cannot authorize neighboring prose.
              const pKeep = await keepCheck({
                message: eInstruction, before: target.source, after: wrote.source,
                does: eLook2.tsx, inPart: !!partNameOf(target.path),
                send: eQuick("keep_check"), model: eQuickModel,
              });
              const pStop = keepRefusal(pKeep, ownerSlug, { problems: pProblems });
              if (pStop) return pStop;
              // THE PAGE THIS EDIT CHANGES, so a request that names a page is
              // held to it: "…from the home page" grants nothing on /prices.
              // AND THE SITE'S PAGES, whose own names a request may use: "on the
              // menu" is /menu wherever this site has one, never this page.
              const pProse = await preservePageProse({ before: target.source, after: wrote.source, message: eInstruction, page: routeOf(target.path), pages: eSrc });
              if (!pProse.ok) return Response.json({
                // The legacy "withheld" browser note promises nothing changed;
                // recovery may already have run, so do not claim that here.
                // AND IT NAMES WHAT WOULD HAVE BEEN LOST (2026-10-22, audit
                // A21-1): a menu entry or a button's words gone from a
                // rewrite is something the customer can recognise and answer.
                ok: false, error: "prose-preservation", cost: 0, unchanged: false, msg: proseWithheldMsg(pProse.blocked),
                proseBlocked: pProse.why,
              }, { status: 409 });
              const pPages = pGuard.pages;
              // THE COMPONENTS THE EDIT WROTE GO WITH THE PAGE. `validatePages`
              // reads them out of `parts`, as the build does; this rung dropped
              // them, so a page importing `@/routes/-parts/string-names` was
              // sent to a container that never received the file — the lane
              // sweep's `tsx` failure. Merged over what is stored, by name, and
              // handed to the spine, which sends and then stores them.
              //
              // ⚠ AND THE MERGE READS THE SAME SNAPSHOT, NEVER A SECOND READ.
              // `mergeParts` replaces by name and keeps everything else — but
              // only what it is HANDED: `mergeParts(null, [one])` answers
              // `[one]`, so a read that failed where the prompt's succeeded
              // would delete every component this change never mentioned. While
              // `ok` is false nothing is written at all: `null` leaves the
              // spine to re-send the store's own copy, which is exactly what a
              // page edit that touched no component does.
              //
              // ⚠ AND IT IS THE GUARD'S COPY, because the protection may have
              // written a `src` back into a COMPONENT. `pGuard.parts` is
              // `pAccepted` with those restorations applied; handing the
              // unprotected merge over would publish the component the model
              // wrote and quietly drop what was put back into it.
              const pParts = (pFreshParts.length && pPartsRead.ok) ? pGuard.parts : null;

              // ── WHAT THIS CHANGE DID TO THE SITE'S PICTURES ──────────────
              //
              // ⚠ NOT ANSWERED HERE ANY MORE, AND THAT IS THE FIX. It was:
              // this rung compared `eSrc` with its own output and put the
              // answer on its own reply. `components` and `tsx` both dispatch
              // to this rung, so one sentence runs it TWICE — and rung 2's
              // "before" is rung 1's output, because `publishStep` advances
              // `eSrc`. A photograph rung 1 moved and rung 2 put back was
              // reported LOST on a publication that shows it, and the merge's
              // first-writer-wins rule then carried exactly that number to
              // the customer.
              //
              // THE COMPARISON THAT IS REALLY AVAILABLE is between what the
              // message arrived to and what the ONE publish ships, and both
              // of those exist only below the loop. `eSrcAt0`/`ePartsAt0`
              // and `pendingPublish` are the two ends; the merge asks it once.
              //
              // NOTHING IS LOST BY MOVING IT: the same two readers
              // (`keptImages`, `newEmptySlots`) over the same union
              // (`imageSources`), read off the PUBLICATION rather than the
              // writer's answer exactly as the addon's rule requires, so a
              // component the wall refused is still not counted.
              const pPub = await publishStep(env, {
                slug: ownerSlug, pages: pPages,
                parts: pParts || undefined,
                label: versionLabel({ revise: true, changeNote: eRun }),
              });
              if (isPrep) return prepAnswer();
              if (!pPub.ok) {
                return Response.json({
                  ok: false, error: lostOr(pPub, "compile"), cost: 0,
                  msg: compileMsg(pPub, "That change didn't compile, so your site is untouched — try describing it differently."),
                  detail: pPub.detail,
                }, { status: 422 });
              }
              // ── A LIST THIS EDIT REORDERED THAT OTHER PAGES ALSO SHOW ────
              //
              // This layer edits exactly ONE file by design, and its own
              // description says so — but "order the menu by price" does not
              // read as a multi-page change to anybody. Measured over the
              // generated samples and the reference pages, 2 of 11 listed tables
              // appear on more than one page, `services` on BOTH reference pages
              // among them, so for those the ordinary outcome is a site that now
              // disagrees with itself and a reply saying it worked.
              //
              // REPORTED, NEVER REWRITTEN. Touching the other pages is the exact
              // thing this layer refuses to do; the fix costs the owner one more
              // sentence, which they can only say if they are told.
              const alsoOn = orderingMoved(target.source, wrote.source, eSrc, target.path);
              return Response.json({
                ok: true, layer: "page", page: wantRoute,
                // ⚠ `photos` AND `photosRemoved` ARE THE MERGE'S, NOT THIS
                // RUNG'S — see the note above `publishStep`. Both are
                // comparisons against the one publication and a rung cannot
                // see it, so answering them here answered about an
                // intermediate state a later rung may reverse.
                //
                // ⚠ AND `photosKept` IS THE MERGE'S TOO, for the same reason
                // one sentence later than the other two. What this rung DID
                // is a fact about the rung — the writer emptied a `src`
                // nobody asked about and the attribute was put back — but
                // what the customer is told, *"it is still there"*, is a
                // claim about the PUBLICATION, and a later authorised picture
                // rung can take the same photograph off. The urls go into
                // `ePhotosHeld` above and are intersected with what ships.
                // EVERY PAGE IT LEFT ALONE, every page reordered (2026-10-07): four were named.
                ignored: (pValid.pages || []).filter((p) => p.path !== target.path).map((p) => p.path),
                problems: pProblems,
                // OMITTED WHEN EMPTY, so an ordinary page edit's response is
                // byte-identical and the field's PRESENCE is the signal.
                reordered: alsoOn.length ? alsoOn : undefined,
                // ── AND A COMPONENT WE REFUSED TO REPLACE IS NAMED ──────────
                //
                // NAMED, NEVER DROPPED IN SILENCE — the addon's rule, for the
                // same reason: a component the customer asked to change and
                // did not get changed is the one thing they must hear. Two
                // fields because they are two sentences: `keptParts` is "too
                // large to show you, so I would not rewrite it blind",
                // `unseenParts` is "I could not read this site's components at
                // all". Omitted when empty, so an ordinary page edit's reply is
                // byte-identical to what it was.
                keptParts: pKeptParts.length ? pKeptParts : undefined,
                unseenParts: pUnseenParts.length ? pUnseenParts : undefined,
                // Put back as they were (A21-2).
                partsHeld: pPartsHeld.length ? pPartsHeld : undefined,
                partsLossHeld: pPartsLossHeld.length ? pPartsLossHeld : undefined,
                // ONE BILL, ONE ROUNDING, for both calls. `eCharge` is variadic
                // precisely so two calls on one path do not each round up — the
                // lesson `pageCredits` already carries. `twSpent` is null when
                // the cheap rung never reached the provider.
                files: pPub.files, render: pPub.render, renderNote: pPub.renderNote, checks: pPub.checks, draft: pPub.draft,
                cost: await eCharge(eGen && eGen.usage, twSpent, twJudged, pKeep.usage, ...pPartUsage, ePick && ePick.usage)
                  .then((t) => eNoteWriter(t, [eGen && eGen.usage], [target.path, ...writtenPartKeys(pParts, ePartsAt0)])), usage: eGen && eGen.usage, tweakUsage: twSpent || undefined,
                // THE CHEAP WRITER'S FILE DID NOT PARSE, SO THIS ONE RAN
                // (A03-5). Omitted otherwise, so an ordinary reply is unchanged.
                tweakFallback: twFallback || undefined,
                keepUsage: pKeep.usage || undefined,
                // AN UNCERTAIN COMPONENT IS NAMED, never counted as kept and
                // never refused: the check could not see it either way.
                partsUnsure: pKeep.unsure.length ? unsurePhrases(pKeep.unsure) : undefined,
              });
            }

            // A LAYER NOBODY IMPLEMENTS is a mismatch of OURS between the router
            // and this route — every layer the router can name has a branch
            // above. It used to escalate to the rewrite "so the change still
            // happens"; a defect of ours is not a reason to spend a customer's
            // credits on every page (2026-09-23). Said, at no cost.
            return explain("route/layer");
            };

            // ── RUN EVERY STEP IN TURN, AND ANSWER ONCE ───────────────────
            //
            // Owner: *"it could do two steps at the same time, or three or four,
            // depending on how many the user wants"*. In turn rather than at
            // once, because each rung reads the site's stored state and writes
            // it back — two running concurrently would race over the same
            // config and the same page source.
            //
            // THE ORDER IS `LANE_FIELDS`, which puts the eight that act here
            // first. That is deliberate and not cosmetic: they change stored
            // VALUES (a colour, a name, a tab icon), while the dispatched rungs
            // rewrite page SOURCE. Doing the values first means the page rungs
            // recompile from the design the customer just asked for, rather than
            // from the one it is replacing.
            const done = [];
            // ── EVERY STEP OF A RESUMED REQUEST IS SHOWN ITS ANSWERS ─────────
            //
            // 2026-10-02, the owner's reviews: *"verify actual resumed model
            // inputs"*, then *"keep clarification context separate from
            // executable instructions"*. A step runs on its own words alone;
            // the answers it was given (`told`) ride beside them, shown to every
            // model call it makes in a section of their own (`eCtx`, which the
            // transport reads). A step the picker did not scope is shown every
            // answer, as a step on the whole turn always was. No answer is ever
            // in a step's words, so no cut (`wordsLess`, `askRemainder`) and no
            // check that reads them can mistake one for a change asked for.
            // THE PLAN, AS A MILESTONE (2026-10-06): the steps about to run, as
            // the builder names them — what was worked out, and that it is next.
            if (eJob && eJob.progress) eJob.progress.mark("plan", editPlanFacts(steps));
            // ── A LATER STEP'S MODEL WORK, PREPARED BESIDE THE EARLIER ONES
            //    (2026-10-11, the generality round) ─────────────────────────
            //
            // The steps still WRITE in turn, in this order — each reads the
            // stored site and writes it back, and the order is load-bearing.
            // Their MODEL WORK need not wait: each later step that makes model
            // calls is prepared now, beside the steps before it, through the
            // very route a request part's preparation uses (`replayPrepared`):
            // its own layer, page, words and answers, every call recorded,
            // nothing written, nothing charged, no picture bought. When its turn
            // comes, what it recorded is handed to this job's replayer, and each
            // call whose request is byte for byte the one recorded is answered
            // from it — billed once, by this job — and any other (an earlier
            // step changed what it reads) is made now. A preparation that fails
            // or does not finish hands over nothing: the step makes its calls.
            //
            // A BOUNDED POOL, REFILLED (2026-10-11, the validation round). At
            // most `STEP_AHEAD_MAX` preparations run AT ONCE — the bound is on
            // simultaneous work, never on how many steps may be prepared: as
            // one finishes, the next ready step whose turn has not come starts
            // in its place. A step whose turn comes before its preparation
            // started is taken off the queue and makes its own calls, so no
            // call is ever asked twice for one step.
            const eAhead = new Map();
            let eStepAt = -1;
            // ── READY WHEN WHAT IT READS HAS BEEN WRITTEN (2026-10-11, round 10) ──
            //
            // Codex's review of 4074eb38: a step that read what an earlier step
            // writes was left off the queue for good — checked once, when the
            // queue was made — so a picture for the Visit page waited for the
            // unrelated Home step after the Visit step it needed had finished.
            // Now each queued step carries its prerequisites (`stepNeeds`: the
            // earlier steps whose writes reach what it reads) and is started
            // only once every one of them has applied. At the top of every turn
            // every earlier turn has applied — each rung stores what it changed
            // as it goes, only the publish waits — so the pool is refilled
            // there, BEFORE the turn waits on anything, and newly ready work is
            // prepared against the site as those steps left it.
            let eFill = () => {};
            if (eJob && !isPrep && steps.length > 1) {
              if (!eJob.replay) eJob.replay = replayer(null);
              const queue = [];
              steps.forEach((step, i) => {
                if (i === 0 || step.withheld || step.remove === true || (typeof step.rename === "string" && step.rename) || !STEP_AHEAD_LAYERS.has(step.layer)) return;
                queue.push({ i, needs: stepNeeds(steps, i) });
              });
              let running = 0;
              const fill = () => {
                for (let q = 0; q < queue.length && running < STEP_AHEAD_MAX;) {
                  const { i, needs } = queue[q];
                  // ITS TURN HAS BEGUN: it makes its own calls, never prepared too.
                  if (i <= eStepAt) { queue.splice(q, 1); continue; }
                  // A PREREQUISITE NOT YET APPLIED: it waits, and keeps its place.
                  if (needs.some((j) => j >= eStepAt)) { q++; continue; }
                  queue.splice(q, 1);
                  const step = steps[i];
                  running++;
                  const prec = recorder();
                  const body = {
                    layer: step.layer, page: step.page || "", instruction: step.instruction || step.ask || eRun,
                    context: eb && eb.context, ...(Array.isArray(step.told) ? { told: step.told } : {}), picker: eb && eb.picker, ...(eb && eb.request ? { request: eb.request } : {}),
                  };
                  eAhead.set(i, replayPrepared(env, ctx, { uid: ou.id, slug: ownerSlug }, "/api/site/" + encodeURIComponent(ownerSlug) + "/edit", body, prec, { buy: false, pages: eSrc })
                    .then(() => prec.calls, () => prec.calls)
                    .finally(() => { running--; fill(); }));
                }
              };
              eFill = fill;
            }
            for (const step of steps) {
              eStepAt++;
              // EVERY EARLIER TURN HAS APPLIED: what waited on them may start now.
              eFill();
              // ITS PREPARED CALLS, HANDED OVER BEFORE ITS TURN.
              if (eAhead.has(eStepAt)) { try { eJob.replay.add(await eAhead.get(eStepAt)); } catch { /* it makes its calls */ } }
              // EACH PART, SAID AS IT STARTS (2026-10-19), when there are several.
              if (steps.length > 1 && eJob && eJob.progress && eJob.progress.talk) { try { eJob.progress.mark("part", editStepStartFacts(step, steps.indexOf(step), steps.length)); } catch { /* the record never costs the edit */ } }
              // ── A PAGE OPERATION THAT ALREADY SUCCEEDED IS NOT RUN AGAIN ──
              //
              // ⚠ REPRODUCED THROUGH THIS ROUTE (2026-09-23): `components`,
              // `images` and `tsx` give two page steps with the picture step
              // between them, and the page rung reads the SENTENCE, not the
              // lane names — so the second step applied the whole request
              // again to what the first had published, swapped the customer's
              // two sections straight back, billed a second page operation
              // and said "✅ Updated the look.", whether the picture step
              // failed or succeeded. Neighbours are joined above
              // (`mergePageSteps`); these two are kept apart because the
              // order is load-bearing, and it still is.
              //
              // SKIPPED ONLY AFTER A SUCCESS. An earlier page step that was
              // withheld or failed leaves the request undone, and the later
              // step is the one that does it — on the state the picture rung
              // left, which is the dependency the order exists for. Its lanes
              // are folded onto the step that did the work, so the reply still
              // names every lane the customer's message touched.
              const already = pageStepDone(step, done);
              if (already >= 0) {
                const did = done[already];
                did.step = { ...did.step, fields: [...did.step.fields, ...step.fields.filter((f) => !did.step.fields.includes(f))] };
                continue;
              }
              // A STEP THE BRANCH ADDED CARRIES ITS OWN ASK; a step the picker
              // scoped runs on that change's own words (`ask`, and `asks` for the
              // look step's lanes), shown the answers it was given (`told`, and
              // `toldBy` for the lanes); every other step runs on what this turn
              // does, `eRun`, shown every answer. Restored below.
              eInstruction = step.instruction || step.ask || eRun;
              eAsks = step.asks || null;
              eToldBy = step.toldBy || null;
              eCtx = eCtxOf(step.told);
              // A WITHHELD STEP RUNS NOTHING (2026-09-29): its answer is its own
              // sentence, at no cost, and it reaches the reply through `partial`
              // exactly as a rung's refusal does.
              const res = step.withheld
                ? step.withheld.answer()
                : await runLayer(step.layer, step.page, step.fields, step.remove === true, typeof step.rename === "string" ? step.rename : "");
              eInstruction = eRun;
              eAsks = null;
              eToldBy = null;
              eCtx = eShown;
              const body = await res.clone().json().catch(() => null);
              const failed = !body || body.ok !== true;
              // AND WHEN THAT LATER STEP DID IT, THE EARLIER REFUSAL IS OVER.
              // The operation happened, so the first attempt's sentence —
              // *"…so I didn't make it"* — would be false on the screen beside
              // it. Kept in `done` (its lanes and its cost stay on the reply);
              // only `failures` stops reporting it.
              if (!failed) for (const d of done) if (d.failed && samePageOperation(d.step, step)) d.superseded = true;
              done.push({ step, res, body, failed });
              // …AND ITS OWN OUTCOME AS SOON AS IT HAS ONE (2026-10-19).
              if (steps.length > 1 && eJob && eJob.progress && eJob.progress.talk) { try { eJob.progress.mark("part-done", editStepFacts(done[done.length - 1], steps.indexOf(step), steps.length)); } catch { /* the record never costs the edit */ } }
              // NO `break`. A RUNG THAT FAILED DOES NOT CANCEL THE OTHERS.
              //
              // It did, and that was the same dropped-ask bug one level up:
              // "darker footer and swap the shop photo" would run the footer,
              // fail to compile, and the photograph — a separate, independent
              // piece of work on a different rung — was abandoned without the
              // customer being told it had ever been understood.
              //
              // ⚠ A FAILED STEP IS NOT ALWAYS FREE, and this said it was
              // (`cost: 0` on every failure path) until 2026-09-25. A rung
              // that refuses AFTER its model call answered bills that call:
              // the menu, the picture, the address, the data and the rules
              // rungs each put `cost: await eCharge(...)` on their refusal.
              // Measured through the route: a css change beside a menu change
              // the menu rung could not read debited 2 and then 1. When the
              // message ships nothing the job path refunds all of it; beside
              // a change that shipped it stands, and the reply says so
              // (`partial[].cost`, below). Carrying on after a failure is
              // still right: the other steps are independent work.
            }

            // ── A STEP THAT ASKED: WHAT ITS ANSWER MUST STILL DO (2026-10-02) ──
            //
            // Its own words, or the turn less every other step's own words — so
            // a change that ran beside it is never in the request the answer
            // resumes (`askRemainder`). The other steps carry on to the publish
            // below exactly as they would beside any step that wrote nothing.
            // AND THE ANSWERS STILL FOR IT GO WITH IT: those the asking step was
            // shown stay shown; those only finished steps needed are `handled`.
            const eAsking = done.filter((d) => d.body && d.body.ok !== true && readAsk(d.body.ask));
            if (eAsking.length) {
              const left = askRemainder(eAsking, done, eRun, eCtxAll);
              eAskOut.request = left.request;
              eAskOut.context = left.context;
            }

            // ── AND NOW THE ONE PUBLISH ───────────────────────────────────
            //
            // Every rung that wanted to publish handed its pages to the
            // shadowed spine above; this is where they actually ship, once, with
            // the source every step contributed to.
            //
            // ONLY WHEN SOMETHING SUCCEEDED. A message whose every rung failed
            // has nothing to publish, and compiling anyway would spend a build
            // on a site that is not changing.
            let finalPub = null;
            let cssFixed = null;
            // A CHANGE WITH NOTHING TO PUBLISH (a row, a rule) RECORDS WHAT IT
            // APPLIED, as a publish records its steps (2026-10-15).
            if (!pendingPublish && done.length && eJob && eJob.progress) eJob.progress.mark("applied", editAppliedFacts(done));
            if (pendingPublish && done.some((d) => !d.failed)) {
              // ── VERIFY THE SELECTORS THIS MESSAGE INTRODUCED ─────────────
              //
              // Only when the `css` lane actually ran: it is the one rung that
              // writes selectors, and asking the question on a text fix would
              // buy a second build to check a stylesheet nobody touched.
              // ── THE BUDGET IS RECHECKED AT EVERY BOUNDARY ────────────────
              //
              // Nothing has been published at this point — the spine returns
              // before writing to R2 — so a refusal here leaves the live site
              // exactly as it was, which is what makes stopping safe.
              //
              // `null` ON THE SYNCHRONOUS PATH, and every branch below is
              // written so that `eGate` being absent means "carry on". With the
              // flag off this whole mechanism is a few `if`s that do not fire.
              const eGate = eJob ? eJob.gate("build") : null;
              if (eGate && !eGate.go) {
                const kept = !(await restoreEditConfig());
                return await editStopped(env, { job: eJob, why: eGate.why, phase: "build", trace: editTrace, ctx, kept,
                  landed: done.filter((d) => !d.failed).map((d) => landedNote(d.body)) });
              }
              // THE RULES THIS REQUEST WROTE, and the publish is held for those
              // alone — an old rule that matched nothing before this message is
              // not its to correct. `null` when no stylesheet was written.
              const cssVerify = cssCtx ? changedSelectors(cssCtx.before, cssCtx.after) : null;
              editTrace.mark("publish:1", "start", { verifyCss: cssVerify ? cssVerify.length : 0 });
              // EACH STEP'S OUTCOME AND THE PUBLISH STARTING, AS A MILESTONE.
              if (eJob && eJob.progress) eJob.progress.mark("publish", editPublishFacts(done, { draft: draftFirst(env) }));
              finalPub = await publishSpine(env, { ...pendingPublish, verifyCss: cssVerify, trace: editTrace, job: eJob });
              editTrace.mark("publish:1", finalPub && finalPub.ok ? "ok" : "fail",
                { err: String((finalPub && finalPub.error) || ""), dead: Array.isArray(finalPub && finalPub.dead) ? finalPub.dead.length : 0 });

              // ONE CORRECTION ROUND, AND EXACTLY ONE (owner: "give the model
              // the actual landmark map and ask it to correct the selector…
              // rebuild and verify"). Nothing has been published at this point —
              // the spine returns before writing to R2 — so the live site is
              // still untouched while this runs.
              //
              // THE SECOND PUBLISH RUNS WITH `verifyCss` OFF, which is what
              // makes this bounded rather than a loop. If the correction is also
              // dead the site ships anyway: a rule that selects nothing is
              // inert, and refusing outright would throw away every OTHER lane's
              // work in the same message to punish one selector. The outcome is
              // reported either way rather than quietly assumed.
              // `cssCtx` IS PART OF THE CONDITION, not just of the request.
              // The spine is asked to verify only when a stylesheet was written,
              // so in principle a `dead-css` answer implies one — but "in
              // principle" is how a null dereference ships: a sweep making the
              // gate unconditional turned every text edit into `cssCtx.edb` on
              // null, and the guard watching it counted builds and saw nothing
              // wrong. The correction needs the context, so it asks for it.
              // AND THIS ROUND REPORTS ITS OWN FAULTS (run 101). That run
              // answered 500 after 273.2s carrying `kind: "Error"` and nothing
              // else, because an exception escaping this handler lands in the
              // OWNER-ROUTE catch far below — a deliberately opaque reply keeping
              // only the error's class, since a provider message on these routes
              // can quote the service key. Right for secrecy, useless for
              // diagnosis: from outside, a fault in the newest code on this path
              // is indistinguishable from one in any of the eight rungs above it.
              // Nothing has published when this runs, so the site is untouched
              // whichever way it goes.
              // ── THE CORRECTION ADMISSION GATE (async path only) ──────────
              //
              // A round begun with too little budget left spends the model call
              // AND the container run and then fails anyway — the customer is
              // refunded either way, so the only difference is whether we spent
              // their credits to arrive at the same place.
              //
              // AND THE OTHER HALF OF THE OWNER'S RULE: "publish nothing unless
              // the current build has already passed verification". Build 1 has
              // NOT passed — that is why we are here — so refusing the round
              // means publishing nothing and refunding, rather than shipping a
              // stylesheet we already know points at no element.
              //
              // THE FLOOR IS PROVISIONAL AND SAID SO. `CORRECT_FLOOR_MS` is a
              // conservative starting figure; `phase_ms` records what every real
              // async edit actually took and `edit_phase_stats` reads the p90/p95
              // back, so the number becomes evidence rather than staying a guess.
              const eCanFix = !eJob || eJob.budget.canCorrect();
              if (!finalPub.ok && finalPub.error === "dead-css" && cssCtx && eJob && !eCanFix) {
                editTrace.mark("correct:skipped", "fail", { leftMs: eJob.budget.remaining() });
                const kept = !(await restoreEditConfig());
                return await editStopped(env, { job: eJob, why: "budget", phase: "correct", trace: editTrace, ctx, kept,
                  landed: done.filter((d) => !d.failed).map((d) => landedNote(d.body)),
                  msg: "I found that my change wouldn't have shown up on your page, and there wasn't enough time " +
                    "left to put it right safely, so nothing was published." });
              }
              if (!finalPub.ok && finalPub.error === "dead-css" && cssCtx) {
                try {
                editTrace.mark("lane:correct", "start", { dead: finalPub.dead.slice(0, 3) });
                if (eJob && eJob.progress) eJob.progress.mark("correct", editCorrectFacts());
                const fix = await runLane(
                  { send: eQuick("lane-correction") },
                  {
                    field: "css",
                    message: eInstruction,
                    value: (await readSiteConfig(env, ownerSlug, cssCtx.edb).catch(() => null))?.config?.css || "",
                    note: [
                      "YOUR LAST ANSWER DID NOT REACH THE PAGE. These selectors matched NO element when the " +
                      "site was built and opened in a browser:\n" + finalPub.dead.map((d) => "  " + d).join("\n") +
                      "\n\nThey are not typos — they name something this page does not contain. Find the row " +
                      "below that the customer actually meant and use ITS selector, then send the whole " +
                      "stylesheet back with only that fixed. Change nothing else.",
                      landmarkNote(finalPub.landmarks),
                      themeNote(cssCtx.sheet),
                    ].filter(Boolean).join("\n\n"),
                    model: modelsFor(eb && eb.picker).design,
                    // NOT THE CUSTOMER'S REQUEST, so nobody to ask: a re-aim of
                    // selectors the change already made (`editTool`'s `ask`).
                    ask: false,
                  },
                );
                // THE CORRECTION IS NOT BILLED, and that is a decision rather
                // than an oversight. `laneUsages` belongs to the look block and
                // is out of scope here — but the fix is not to reach it: this
                // round exists because OUR first answer pointed at nothing, and
                // `ourFault` is the rule this platform already bills by. The
                // customer asked once and pays once.
                editTrace.mark("lane:correct", fix.failed ? "fail" : "ok",
                  { chars: typeof fix.value === "string" ? fix.value.length : 0 });
                if (!fix.failed && typeof fix.value === "string" && fix.value.trim()) {
                  const put = (await turnStillMine(env, ownerSlug, eJob)) ? await patchSiteConfig(env, ownerSlug, cssCtx.edb, { css: fix.value }, jobFence(env, eJob)) : { ok: false, error: TURN_LOST_WRITE };
                  // EVERY WRITE SETS THE FLAG AT ITS OWN LINE, this one included,
                  // though today it is already set: the hand-over this round
                  // needs is made only after the look step's own write
                  // (2026-09-26), so a correction always follows one. Kept as the
                  // local rule rather than argued from a line a thousand away —
                  // the day a correction can run without that write, this is what
                  // still puts the sheet back.
                  if (put.ok) { cssFixed = { dead: finalPub.dead }; eConfigWritten = true; cssCtx.after = fix.value; }
                }
                // ── REBUILD AND SEE, AND THE TWO PATHS DIFFER HERE ───────────
                //
                // SYNCHRONOUS: verification off, so this is the last attempt and
                // the site ships whatever the second stylesheet selects. A rule
                // that matches nothing is inert, and refusing outright would
                // throw away every OTHER lane's work in the same message to
                // punish one selector.
                //
                // ASYNC: verification ON, because the owner's rule for the
                // queued path is explicit — publish nothing unless the current
                // build has passed verification, and refund otherwise. The two
                // are allowed to differ precisely because the flag decides which
                // runs, and the synchronous path must stay byte-identical to
                // what it was while the flag is off.
                //
                // IT IS STILL BOUNDED AT ONE ROUND either way: the second
                // verification decides whether to PUBLISH, never whether to
                // correct again.
                // THE JOB VERIFIES THE RULES THE MESSAGE WROTE, AGAIN: the sheet
                // the lane was shown against the one now stored — the
                // correction's when it landed, the lane's when it did not.
                const cssVerify2 = eJob ? changedSelectors(cssCtx.before, cssCtx.after) : null;
                editTrace.mark("publish:2", "start", { verify: cssVerify2 ? cssVerify2.length : 0 });
                if (eJob && eJob.progress) eJob.progress.mark("publish", editRepublishFacts());
                finalPub = await publishSpine(env, { ...pendingPublish, verifyCss: cssVerify2, trace: editTrace, job: eJob });
                editTrace.mark("publish:2", finalPub && finalPub.ok ? "ok" : "fail",
                  { err: String((finalPub && finalPub.error) || "") });
                if (eJob && !finalPub.ok && finalPub.error === "dead-css") {
                  const kept = !(await restoreEditConfig());
                  return await editStopped(env, { job: eJob, why: "unverified", phase: "verify", trace: editTrace, ctx, kept,
                    landed: done.filter((d) => !d.failed).map((d) => landedNote(d.body)),
                    msg: "My correction still wouldn't have shown up on your page, so nothing was published." });
                }
                } catch (e) {
                  console.error("css verify round failed:", ownerSlug, (e && (e.stack || e.message)) || e);
                  // NOTHING HAS PUBLISHED unless the second publish answered ok
                  // before the throw — and then the stored design is the live
                  // one, which must not be wound back under it.
                  const kept = finalPub && finalPub.ok ? false : !(await restoreEditConfig());
                  // THE CLASS, NEVER THE MESSAGE, matching the owner-route catch
                  // below and for its reason: a name is a class and cannot be a
                  // secret, a message can quote the request. `phase` is one of OUR
                  // own step names, so it is safe to send and it is the whole point.
                  const vLanded = done.filter((d) => !d.failed).map((d) => landedNote(d.body)).filter(Boolean);
                  return Response.json({
                    ...(vLanded.length ? { landed: vLanded } : {}),
                    // WHAT THIS REQUEST'S LEDGER HOLDS: the synchronous path
                    // collected at each rung and nothing gives it back here; a
                    // job's reserves are the consumer's to refund, and the poll
                    // route reports what its row then records.
                    ok: false, error: "verify", cost: eJob ? 0 : syncLedger.taken,
                    msg: "I found that my change wouldn't have shown up on your page, and hit a problem putting " +
                      "it right, so nothing was published." +
                      (kept ? KEPT_CHANGE_NOTE : "") +
                      landedSaid(vLanded),
                    kind: String((e && e.name) || "Error").slice(0, 40),
                    phase: cssFixed ? "republish" : "correct",
                    dead: Array.isArray(finalPub && finalPub.dead) ? finalPub.dead.slice(0, 4) : undefined,
                  }, { status: 503 });
                }
              } else if (!finalPub.ok && finalPub.error === "dead-css") {
                // ASKED TO VERIFY WITH NOTHING TO CORRECT WITH. Not reachable
                // today — `verifyCss` is null without `cssCtx` — and it is handled anyway
                // because the alternative is the customer's edit vanishing over
                // a rule that is merely inert. Publish what they asked for.
                finalPub = await publishSpine(env, { ...pendingPublish, verifyCss: null, job: eJob });
              }
              if (!finalPub.ok) {
                // THE LEDGER'S REFUSAL GIVES BACK WHAT THE ROUTE COLLECTED
                // (2026-09-05, 1a-iii). The flag-off path collects at each rung,
                // so a later refusal leaves the earlier collects taken for work
                // that never shipped; under a job the consumer's refund is this.
                // AND WHAT THE SYNCHRONOUS PATH STILL HOLDS IS THE REPLY'S
                // COST (2026-09-25). It said 0 whatever the rungs had
                // collected, and only the ledger's refusal gave anything back:
                // measured through the route, a build that failed after a css
                // lane collected 2 answered `cost: 0`. A job's reserves are
                // the consumer's to refund, and the poll route reports the
                // row's own record of that (`servedEditReply`).
                let syncKept = syncLedger.taken;
                if (finalPub.error === "unbilled" && !eJob && syncLedger.taken > 0) {
                  if (await refundCredits(env, ou.id, syncLedger.taken)) syncKept = 0;
                  else console.error("edit unbilled refund short:", ownerSlug, syncLedger.taken);
                }
                // THE SITE IS UNTOUCHED — nothing was published — but the STORED
                // state is not: each rung wrote its change before handing over
                // the pages. Left there it applies silently on the customer's
                // next unrelated edit, under a version label naming only that
                // one. The look lane has carried that exact note for weeks; with
                // several rungs it is several changes, so the config is put back
                // to the snapshot taken before any of them ran.
                //
                // ⚠ AND A RESTORE THAT FAILED IS SAID ON EVERY ARM (2026-09-26).
                // Only the compile's own sentence carried it: a failure of ours —
                // a store that refused the publish, a container with no room, a
                // clock — and the ledger's refusal each answered their own
                // sentence and dropped the one that said the change was still
                // saved. REPRODUCED on both money paths: the store refused the
                // publish, the restore was refused too, the reply said only that
                // the build service was restarting, and the next edit shipped
                // the change. `compileMsg` now carries `kept` to every arm.
                const kept = !(await restoreEditConfig());
                // AND WHAT ALREADY WENT THROUGH IS SAID, not called untouched
                // (2026-09-25; see `landedNote`).
                const landed = done.filter((d) => !d.failed).map((d) => landedNote(d.body)).filter(Boolean);
                return Response.json({
                  ...(landed.length ? { landed } : {}),
                  ok: false, error: finalPub.error === "unbilled" ? "unbilled" : lostOr(finalPub, "compile"), cost: eJob ? 0 : syncKept,
                  msg: compileMsg(finalPub, landed.length
                    ? "That didn't compile, so the rest of it wasn't published."
                    : kept ? "That didn't compile, so your live site wasn't changed." : "That didn't compile, so your site is untouched.",
                    landed.length > 0, kept) + landedSaid(landed),
                  lanes: done.flatMap((d) => d.step.fields),
                  // WHAT WE COULD NOT DO SURVIVES THE FAILURE PATH TOO. Dropped
                  // here, an unbuilt ask is invisible whenever the publish also
                  // fails — the same dropped-ask bug this whole change is about,
                  // arriving through the one branch nobody looks at.
                  notBuilt: notBuilt.length ? notBuilt.map(([f, needs]) => ({ field: f, needs })) : undefined,
                  detail: finalPub.detail,
                  devices: finalPub.error === "device-scope" ? finalPub.devices : undefined,
                }, { status: 422 });
              }
            }

            const ranOk = done.filter((d) => !d.failed);
            // A REFUSED PAGE ATTEMPT THAT A LATER ONE COMPLETED IS NOT A FAILURE
            // OF THE MESSAGE (`superseded`, set in the loop above).
            const failures = done.filter((d) => d.failed && !d.superseded);
            // ONE STEP, AND IT FAILED — hand back that rung's own answer, whole.
            // Its status, its reason, its `detail`: a merged "ok: false" with a
            // sentence assembled here would be the failure-that-cannot-name-
            // itself shape, and this file has paid for that seven times.
            //
            // ONLY WHEN THERE WAS ONE. With several steps this shortcut returned
            // the FIRST failure and silently discarded the rest — so a message
            // whose two asks both failed reported one of them, and the other was
            // indistinguishable from never having been understood. That is the
            // dropped-ask bug again, arriving through the failure path. Several
            // steps go through the merge below, where `partial` names every one.
            if (done.length === 1 && failures.length && !notBuilt.length) return failures[0].res;

            // ── EVERY STEP REFUSED: EACH SAYS WHY, AND NOTHING IS BOUGHT ──────
            //
            // ⚠ REPRODUCED THROUGH THE ROUTE AND THE BROWSER'S OWN HANDLER
            // (2026-09-23): a message whose two page steps were both withheld
            // came back as `{ok: false, layer: "look", partial: [...]}` with no
            // `msg` — and the browser's refusal branch, finding no sentence,
            // started the full rewrite of every page. Each step's own sentence
            // was on the wire the whole time, in `partial[].msg`, and nothing
            // read it.
            //
            // UNANIMOUS ESCALATIONS ARE THE ONE EXCEPTION, and they are acted on
            // exactly as a single step would be: when every step climbed to the
            // SAME place (say, a site from before designs were stored, where
            // every step needs the rewrite), the message as a whole needs it,
            // and the first step's own escalate is the answer. Anything mixed is
            // said step by step — acting on one step's climb would do part of a
            // message at a price nobody saw.
            if (!ranOk.length && failures.length && !notBuilt.length) {
              const climbs = failures.map((d) => d.body).filter((bd) => bd && bd.escalate === true);
              const whereTo = (bd) => (typeof bd.layer === "string" ? bd.layer : "") + "|" + (typeof bd.page === "string" ? bd.page : "");
              if (climbs.length === failures.length && climbs.every((bd) => whereTo(bd) === whereTo(climbs[0]))) return failures[0].res;
            }

            const flat = (k) => ranOk.flatMap((d) => (Array.isArray(d.body[k]) ? d.body[k] : []));
            const last = ranOk[ranOk.length - 1];
            // ── WHAT EACH PAGE STEP THAT SUCCEEDED DID, IN THE ORDER IT RAN ──
            //
            // ⚠ THE CATCH-ALL BELOW CANNOT CARRY THIS (2026-09-23, owner:
            // *"Layout + move must identify the edited page and the move's old
            // and new addresses"*). Every page step answers `page`, and the
            // catch-all keeps the FIRST — so "lay out /prices and move the
            // gallery to /photos" replied `page: "/prices"` beside `renamedTo:
            // "/photos"`, the move's own starting address was on no field at
            // all, and the screen said "✅ Updated the look." about both.
            //
            // FROM THE RUNGS' OWN SUCCESSFUL REPLIES, NEVER FROM THE REQUEST.
            // `removed` is the list of files the merge really took away and
            // `renamedTo` is the address `renameRoute` really published, which
            // is not always the one asked for (it normalises the slashes). A
            // step that refused is not in `ranOk`, so a removal the home page's
            // protection stopped can never be listed here as done — it reaches
            // the screen through `partial`, in its own words.
            const pageOps = ranOk.filter((d) => d.body && d.body.layer === "page").map((d) => ({
              page: typeof d.body.page === "string" && d.body.page ? d.body.page : undefined,
              removed: Array.isArray(d.body.removed) && d.body.removed.length ? d.body.removed : undefined,
              renamedTo: typeof d.body.renamedTo === "string" && d.body.renamedTo ? d.body.renamedTo : undefined,
            }));
            // ── EVERY STEP'S OWN ACCOUNT, WITH WHAT IT WAS ASKED (2026-10-03) ──
            //
            // Owner: *"preserve each executed operation's authoritative result
            // through merging, queued storage and reply generation; report every
            // completed, failed, declined and pending operation with its target."*
            // The fields around this flatten the steps: `layers` lists them, but
            // one `msg` survived the catch-all below — the first step's — so a
            // menu or a photograph changed beside a look or page change was made
            // and told nowhere (the mixed-work audit's MW1, reproduced sync and
            // queued). `steps` keeps one entry per step, in the order it ran,
            // read off that step's own answer: its target (the page it was on
            // and its own words, from the picker's scope), what became of it,
            // and its own sentence — never composed here, because only the step
            // knows which picture, which links, which address. A queued job
            // stores this answer whole, so the poll's reply reads the same list.
            //
            // ONLY WHEN SEVERAL STEPS RAN: one step's answer already IS its own
            // account, and stays byte-identical.
            const wordsOf = (s) => {
              if (Array.isArray(s.words) && s.words.length) return s.words.filter((w) => typeof w === "string" && w);
              if (s.opWords && typeof s.opWords === "object") return (s.fields || []).flatMap((f) => (Array.isArray(s.opWords[f]) ? s.opWords[f] : [])).filter((w) => typeof w === "string" && w);
              return [];
            };
            // A PAGE IS A STEP'S TARGET ONLY ON THE PAGE RUNG, which works on that
            // one page. Every other rung works across the site — a photograph is
            // found on whichever page holds it, the menu is on every page — and
            // the page it was dispatched with is the message's, not its own.
            const targetOf = (d) => {
              const bd = d.body || {};
              const own = d.step.layer === "page";
              const page = !own ? "" : typeof bd.page === "string" && bd.page ? bd.page : (typeof d.step.page === "string" && d.step.page ? d.step.page : "");
              const words = wordsOf(d.step);
              return { page: page || undefined, words: words.length ? words : undefined };
            };
            const stepsOut = done.length > 1 ? done.map((d) => {
              const bd = d.body || {};
              const own = typeof bd.msg === "string" && bd.msg.trim() ? bd.msg.trim() : "";
              return {
                layer: d.step.layer, lanes: d.step.fields,
                status: !d.failed ? "done" : d.superseded ? "superseded" : readAsk(bd.ask) ? "asked" : "failed",
                ...targetOf(d),
                msg: own || undefined,
                removed: Array.isArray(bd.removed) && bd.removed.length ? bd.removed : undefined,
                renamedTo: typeof bd.renamedTo === "string" && bd.renamedTo ? bd.renamedTo : undefined,
                cost: Number(bd.cost) > 0 ? Number(bd.cost) : undefined,
              };
            }) : undefined;
            // ── WHAT THE MESSAGE DID TO THE SITE'S PICTURES, ASKED ONCE ────
            //
            // Owner: *"avoid reporting intermediate changes that the final
            // publication reverses."* Every rung used to answer this about
            // its own output, and two page rungs run for one sentence — so
            // the number that reached the customer was rung 1's opinion of a
            // version rung 2 had already replaced.
            //
            // THE TWO ENDS ARE THE ONLY COMPARABLE PAIR: what the message
            // arrived to, and what the ONE publish is about to ship.
            // `pendingPublish` IS that publication — `publishStep` keeps
            // `pages` as `eSrc` and carries an earlier rung's components
            // forward — so this is the site as it will really stand.
            //
            // ONLY WHEN SOMETHING REALLY PUBLISHED. With no `finalPub` the
            // live site is untouched, so there is no change to report and
            // both fields stay absent rather than answering 0 about work
            // that did not happen.
            //
            // ⚠ `ePartsAt0` FALLS BACK TO `[]` AND NOT TO THE STORE. A rung
            // that handed no components over means they did not move, so the
            // honest after side is whatever the before side was; a rung that
            // never read them at all leaves both sides empty, which says the
            // same thing. Reading the store here would be a THIRD read of it
            // in one message, against the rule the snapshot exists for.
            // ── PAY ONLY FOR WHAT LANDED (owner, 2026-10-24) ────────────────
            // A file a writer produced that the one publish kept as it was or
            // stood in (`finalPub.salvaged`) is given back its share of that
            // writer's charge (`landedBill`: by count of the files it wrote).
            // ONLY AFTER THE PUBLISH WENT OUT, so a refusal's own refund never
            // meets this one. Under a job by the reserve's own ref
            // (`credit_reverse`, bounded by what that row took; a founder's
            // reserve wrote no row, took nothing, and is never recorded here);
            // synchronously through `credit_back`, which never credits a founder.
            let eSalvageRefund = null;
            if (finalPub && finalPub.ok && finalPub.salvaged && eWriterBills.length) {
              let back = 0;
              const files = [];
              for (const wb of eWriterBills) {
                const bill = landedBill({ writer: wb.writer, others: wb.others, written: wb.written, salvaged: finalPub.salvaged });
                const give = Math.min(bill.refund, wb.took);
                if (!(give > 0)) continue;
                if (eJob) {
                  if (!wb.ref) continue;
                  const r = await reverseCredits(env, ou.id, wb.ref, "salvage", give);
                  if (r.ok && r.refunded > 0) { back += r.refunded; files.push(...bill.hit); }
                  else if (!r.ok) console.error("edit salvage refund could not be made:", ownerSlug, wb.ref);
                } else {
                  // IN THE RPC'S OWN CHUNKS OF 10, every chunk counted (`refundCredits`
                  // stops at 50); bounded by `give`, itself never above what was taken.
                  let left = give, gave = 0;
                  for (let i = 0; i < 1000 && left > 0; i++) { const ch = Math.min(10, left); if (await creditBack(env, ou.id, ch)) gave += ch; left -= ch; }
                  if (gave > 0) { back += gave; syncLedger.taken = Math.max(0, syncLedger.taken - gave); files.push(...bill.hit); }
                }
              }
              if (back > 0) eSalvageRefund = { credits: back, files: [...new Set(files)] };
            }
            let picsRemoved, picsFrames, picsKept, picsTakenOff;
            if (finalPub && finalPub.ok && pendingPublish) {
              // WHAT THE PICTURE STEPS SAID THEY TOOK OFF, WITH THEIR SPACE —
              // their own explicit count, summed over the steps that ran, and
              // reported only when the publication carrying them went out.
              picsTakenOff = ranOk.reduce((n, d) => n + (d.body && d.body.layer === "picture" &&
                Number.isInteger(d.body.photosTakenOff) && d.body.photosTakenOff > 0 ? d.body.photosTakenOff : 0), 0) || undefined;
              const at0 = ePartsAt0 || [];
              const was = imageSources(eSrcAt0, at0);
              const now = imageSources(pendingPublish.pages, pendingPublish.parts || at0);
              const kept = keptImages(was, now, ownerSlug);
              picsRemoved = kept.ok ? undefined : kept.lost.length;
              picsFrames = newEmptySlots(was, now);
              // ⚠ AND A RESTORATION A LATER RUNG UNDID IS NOT A KEPT
              // PHOTOGRAPH. The page rung puts back a picture nobody named;
              // an AUTHORISED picture rung further down the same sentence
              // takes that same picture off — and a sum of the rungs' own
              // counts then prints *"the 2 photographs are still there"*
              // beside *"one photograph is no longer on the site"*. Two
              // sentences about one publication, disagreeing.
              //
              // INTERSECTED WITH WHAT SHIPS, which is why `ePhotosHeld` holds
              // urls: a count cannot say WHICH of them survived. Same
              // publication both fields read, so they cannot disagree.
              const shows = new Set();
              for (const f of now) for (const u of photoUrls(f && f.source, ownerSlug)) shows.add(u);
              picsKept = [...ePhotosHeld].filter((u) => shows.has(u)).length || undefined;
            }
            const merged = {
              ok: ranOk.length > 0,
              // THE LAYER THAT DID THE WORK, for a client that still reads one.
              // `layers` beside it is the truth when several ran.
              layer: ranOk.length === 1 ? ranOk[0].body.layer : "look",
              layers: ranOk.map((d) => d.body.layer),
              // WHICH OF THE SEVENTEEN THIS MESSAGE TOUCHED — including the ones
              // that failed, because "we tried and it did not compile" and "we
              // never understood you" are different things and must read
              // differently.
              lanes: [...new Set([...flat("lanes"), ...done.flatMap((d) => d.step.fields)])],
              moved: flat("moved"),
              changed: flat("changed"),
              pageOps: pageOps.length ? pageOps : undefined,
              steps: stepsOut,
              // WHAT THIS TURN HELD BACK is added by the route's one ending
              // (`heldReport`, 2026-10-02), with any part a step put off itself
              // — every reply carries it now, not this one alone.
              css: ranOk.some((d) => d.body.css) || undefined,
              renamed: ranOk.reduce((n, d) => n + (Number(d.body.renamed) || 0), 0) || undefined,
              // THE LAST PUBLISH'S FILES AND RENDER, because each step publishes
              // the whole site — so the last one is the site as it now stands,
              // and an earlier one's numbers describe a version already replaced.
              // FROM THE ONE PUBLISH, not from a step. A deferred publish
              // answers before any of these exist, so reading them off a step's
              // body would report `undefined` on every multi-rung message —
              // the works-but-cannot-say-so shape, arriving through the fix.
              files: finalPub ? finalPub.files : (last && last.body.files),
              // A PAGE THE SEAM'S COMPILE REPAIR FIXED (2026-10-23), a fact for the reply.
              compileRepaired: finalPub && finalPub.compileRepaired ? finalPub.compileRepaired : undefined,
              // FILES KEPT AS THEY WERE AND NEW ONES STANDING IN (2026-10-24).
              salvaged: finalPub && finalPub.salvaged ? finalPub.salvaged : undefined,
              // WHAT THOSE FILES WERE GIVEN BACK (2026-10-24), already off `cost`.
              salvageRefund: eSalvageRefund || undefined,
              // AND WHAT THE VISUAL REVIEW DID (2026-10-24), a fact for the reply.
              visualReview: finalPub && finalPub.visualReview ? finalPub.visualReview : undefined,
              render: finalPub ? finalPub.render : (last && last.body.render),
              // A TRANSLATED WORDING STORED AS THE OWNER'S OWN (#196) is said beside it.
              renderNote: [...ranOk.map((d) => d.body.langNote), finalPub ? finalPub.renderNote : (last && last.body.renderNote)].filter((x) => typeof x === "string" && x).join(" ") || undefined,
              checks: finalPub ? finalPub.checks : (last && last.body.checks),
              // SAVED AS WHICH DRAFT, from the same publish (2026-10-16): the
              // text edit's answer carried no `draft` facts at all.
              draft: finalPub ? finalPub.draft : (last && last.body.draft),
              // WHICH DEVICES A SCOPED CHANGE WAS FOR AND CHANGED (2026-10-24), as
              // the publish measured them: the reply's fact and the preview's switch.
              devices: finalPub && finalPub.devices ? finalPub.devices : undefined,
              // WHAT HAPPENED TO EACH LANGUAGE, from the one publish (run 38,
              // 2026-09-04): the spine's account rode its result, the deferred
              // publish's stub answered the look branch first, and the reply
              // said "none" — the "dropped field has a twin one hop over"
              // shape, on the field written to end the guessing.
              langs: finalPub ? finalPub.langs : (last && last.body.langs),
              langsRefused: finalPub ? finalPub.langsRefused : (last && last.body.langsRefused),
              // …PLUS WHAT THE ONE PUBLISH CHARGED FOR ITS TRANSLATIONS (run 39):
              // placed inside the spine after every step had billed, so no
              // step's `cost` can carry it and the sum alone under-reports.
              cost: done.reduce((n, d) => n + (Number(d.body && d.body.cost) || 0), 0) + (finalPub ? Number(finalPub.langCharged) || 0 : 0)
                // AND WHAT THE SEAM'S COMPILE REPAIR CHARGED (2026-10-23), only when it fixed the build.
                + (finalPub && finalPub.compileRepaired ? Number(finalPub.compileRepaired.charged) || 0 : 0)
                // AND WHAT THE VISUAL REVIEW CHARGED (2026-10-24), through the same funnel.
                + (finalPub && finalPub.visualReview ? Number(finalPub.visualReview.charged) || 0 : 0),
              // WHAT WAS BILLED, from the one list `eCharge` appends to — so the
              // receipt is assembled from what was charged rather than rebuilt
              // beside it. Two lists of the same thing drift, and the drift here
              // would be somebody's money.
              usage: { langUsage: billedAll },
              // A LANE THAT FOUND NOTHING TO DO SAYS SO IN ITS OWN WORDS, and
              // that has to survive the merge — an empty `moved` with no note
              // reads as a change that silently failed.
              //
              // ⚠ BUT THOSE WORDS SPEAK FOR THE WHOLE MESSAGE, which is false
              // once another operation shipped (2026-09-24, owner: *"Scope the
              // no-change statement to the design operation that did nothing
              // … Do not describe the whole request as having nothing to
              // change when another operation shipped"*). "Make the footer
              // green and remove the gallery", on a site whose footer already
              // was, answered "Your site already looks like that — nothing to
              // change. Took /gallery off the site."
              //
              // DECIDED FROM THE STEPS' OWN RESULTS, never from the request: a
              // step that succeeded without this note is an operation that
              // shipped, and then the note speaks for the styling alone. A
              // REFUSED step shipped nothing, so beside a refusal the look's
              // own sentence stands and the refusal follows it as a warning.
              lookNote: ranOk.some((d) => d.body.lookNote) && ranOk.some((d) => !d.body.lookNote)
                ? "The requested styling was already in place."
                : ranOk.map((d) => d.body.lookNote).filter(Boolean).join(" ") || undefined,
              cssNote: ranOk.map((d) => d.body.cssNote).filter(Boolean).join(" ") || undefined,
              // ── WHAT WE DID NOT DO, SAID OUT LOUD ────────────────────────
              //
              // The whole point of this change: an ask that could not run is
              // REPORTED, never dropped. `notBuilt` is a lane with no
              // implementation yet; `partial` is a rung that tried and failed.
              // Both name the LANE, in the customer's own terms, so they can see
              // which half of their message is still outstanding.
              notBuilt: notBuilt.length ? notBuilt.map(([f, needs]) => ({ field: f, needs })) : undefined,
              // ⚠ EVERY ENTRY CARRIES A SENTENCE NOW (2026-09-23). A step that
              // ESCALATED has no `msg` of its own — it expected the browser to
              // act on it — so beside other steps it arrived as a bare count.
              // `stepMsg` says what that step needs, and `unchanged` records
              // that the step wrote nothing, which is what lets the browser say
              // "nothing on your site changed" of the whole message, and ONLY
              // when every step says it.
              partial: failures.length
                ? failures.map((d) => {
                  const bd = d.body || {};
                  const own = typeof bd.msg === "string" && bd.msg.trim() ? bd.msg : "";
                  return {
                    layer: d.step.layer, lanes: d.step.fields, error: bd.error,
                    // WHAT IT WAS ASKED (2026-10-03): its page and its own words,
                    // so a part that did not go through is named by its target
                    // and never folded into a count.
                    ...targetOf(d),
                    reason: bd.escalate === true ? bd.reason : undefined,
                    msg: own || (bd.escalate === true ? stepMsg(bd) : undefined),
                    unchanged: stepWroteNothing(bd) || undefined,
                    // WHAT THIS STEP WAS CHARGED THOUGH IT DID NOT GO THROUGH
                    // (2026-09-25): its own `cost`, which is what the ledger
                    // answered for its charge. Beside a change that shipped,
                    // nothing refunds it, so the customer is told.
                    cost: Number(bd.cost) > 0 ? Number(bd.cost) : undefined,
                    // ITS ANSWER WAS CUT OFF AT ITS CEILING (2026-10-03), so
                    // none of it was used — the one bound a step's list has.
                    truncated: bd.truncated === true || undefined,
                    // A QUESTION BACK (2026-10-02): this step's model asked the
                    // customer one thing instead of acting. `askReport` lifts it
                    // off this entry, keeps it as the site's live question and
                    // puts it on the reply as `clarify`.
                    ask: readAsk(bd.ask) || undefined,
                  };
                })
                : undefined,
              // ── AND EVERY OUTCOME A RUNG REPORTS THAT THE CUSTOMER NEEDS ──
              //
              // ⚠ THE CATCH-ALL BELOW IS NOT ENOUGH FOR THESE, and that is
              // the defect this closes. It copies a key from the FIRST rung
              // that has one and skips every later rung (`Object.hasOwn`), so
              // a second page rung's withheld component was silently dropped
              // — and the fields it does copy then land on a reply whose
              // `layer` is `"look"`, which the browser's `page` branch never
              // reads. Named here so the aggregation is a UNION and the
              // composer can find them wherever the work happened.
              //
              // DE-DUPLICATED, because `components` and `tsx` both dispatch
              // to the page rung and both meet the same oversized component:
              // one sentence naming it twice reads as two problems.
              // EVERY ONE (2026-10-03): each is a change asked for and not made,
              // so none is dropped past a count.
              keptParts: flat("keptParts").length ? [...new Set(flat("keptParts"))] : undefined,
              // …AND EVERY STEP'S PROBLEMS (2026-10-07): the catch-all took the
              // first step's and dropped a second page step's findings.
              problems: flat("problems").length ? [...new Set(flat("problems"))] : undefined,
              unseenParts: flat("unseenParts").length ? [...new Set(flat("unseenParts"))] : undefined,
              partsHeld: flat("partsHeld").length ? [...new Set(flat("partsHeld"))] : undefined,
              partsLossHeld: flat("partsLossHeld").length ? [...new Set(flat("partsLossHeld"))] : undefined,
              // NOT A SUM OF THE RUNGS — see the intersection above. What the
              // protection held AND the publication still shows.
              photosKept: picsKept,
              // AND THE TWO COMPARISONS, from the ONE publication above.
              // Declared here rather than left to the catch-all so no rung's
              // own idea of either can overwrite them: `Object.hasOwn` is
              // true of a key whose value is `undefined`, which is exactly
              // what "the message-wide reader says there was no loss" means.
              photosRemoved: picsRemoved,
              photos: picsFrames,
              photosTakenOff: picsTakenOff,
            };
            // WHAT THE SALVAGED FILES WERE GIVEN BACK IS OFF THE STATED COST (2026-10-24).
            if (eSalvageRefund) merged.cost = Math.max(0, merged.cost - eSalvageRefund.credits);
            // ── AND ANYTHING A RUNG REPORTS THAT THIS MERGE DOES NOT MODEL ──
            //
            // Eight rungs answer here and each has diagnostics of its own — a
            // stale phone number the text lane spotted, a typeface the
            // stylesheet cannot host. Naming them one by one means editing this
            // merge every time a rung learns to say something new, and the
            // failure is silent: the field is simply gone from the reply.
            //
            // AFTER the literal rather than spread inside it, because reading
            // `merged` in its own initialiser is a temporal-dead-zone throw —
            // and `Object.hasOwn` is what makes "only where the merge has not
            // already decided" true, so nothing above can be overwritten by a
            // rung's own idea of the same key.
            for (const d of ranOk) {
              for (const [k, v] of Object.entries(d.body || {})) {
                if (v === undefined || Object.hasOwn(merged, k)) continue;
                merged[k] = v;
              }
            }
            // ── NOTHING RAN: WHAT THE EDIT COST, AND WHETHER THE SITE MOVED ──
            //
            // THE COST IS THE LEDGER'S, NOT A SUM OF THE STEPS' OWN FIGURES. On
            // the job path the consumer hands back everything this job reserved
            // the moment the reply says `ok: false` (`edit_refund`), so the edit
            // cost nothing whatever a step reported; on the synchronous path
            // nothing gives back what a refused step collected, and
            // `syncLedger.taken` is exactly that. The routing call that chose
            // this route is a separate charge the browser states separately.
            //
            // `unchanged` ONLY WHEN EVERY STEP SAYS IT — a data step that saved
            // rows and then failed its reorder did change the site, and a reply
            // claiming otherwise would be the one wrong sentence here.
            if (!ranOk.length) {
              merged.cost = eJob ? 0 : syncLedger.taken;
              merged.unchanged = failures.every((d) => stepWroteNothing(d.body)) || undefined;
              return Response.json(merged, { status: 422 });
            }
            return Response.json(merged);
}

/**
 * THE SCOPED ROUTE ASKED AGAIN when its answer reached outside its scope (`/api/site/route`).
 * worker.js lines 34595-34606 at 014a7cd31.
 */
export async function routeScopeReask() {
      if (!agentTakes() && rScope && routed.failed !== true && !routeInScope(rScope, routed)) {
        const whole = await routeDigest(env, ru, rb, { words: !rPart });
        if (samePages(rDigest.site, whole.site)) rJob.routeScope = "current";
        else {
          const first = routed.usage;
          rDigest = whole;
          routed = await rRoute(rDigest);
          if (first && routed.usage) routed = { ...routed, usage: sumRouteUsage(first, routed.usage) };
          else if (first && !routed.usage) routed = { ...routed, usage: first };
          rJob.routeScope = "widened";
        }
      } else if (rScope) rJob.routeScope = "kept";
}

/**
 * THE ROUTER CALL (`routeMessage`) inside `/api/site/route`.
 * worker.js lines 34480-34579 at 014a7cd31.
 */
export async function rRouteRouterCall() {
      const rRoute = async (rDigest) => await routeMessage(
        // `classify` IS THE BUILD PATH'S OWN READER of a provider's error body
        // (`upstreamKind`), so a failed route names the provider's token and
        // whether our account was refused the same way a failed build does —
        // one reader of provider errors, not two (Lane 1b).
        { send: jobSend(rJob, quickSend(env)), classify: (e) => upstreamKind(e && e.detail, e && e.status),
          // RETRY_REASON {step, reason, ok} (2026-10-24): the routing route keeps no trace row, so it is logged.
          mark: logRetryMark },
        {
          message: rb.message,
          // DRAFT-FIRST, FROM THE WORKER'S OWN SWITCH (audit #216): the router
          // is told changes are drafts until Publish. Never the body's word.
          site: rDigest.site && typeof rDigest.site === "object" ? { ...rDigest.site, draftFirst: draftFirst(env) } : rDigest.site,
          // THE PICKED MODEL. This call was the reason the whole cheap ladder
          // sat behind one provider: it runs before anything else on an edit, so
          // when Anthropic refused on billing (run 93) nothing downstream got a
          // chance to be right. `rb.picker` is the same field the build reads.
          model: modelsFor(rb && rb.picker).quick,
          // THE CLARIFY GATE, and it is deliberately the SERVER's and not the
          // client's. `firstBuild` says a project has no pages yet; `qa` is what
          // has already been asked and answered this round. Both arrive in the
          // body, so both are caller-controlled — which is exactly why
          // `routeMessage` spends the budget in arithmetic rather than believing
          // anybody. A caller that lies about `qa` gets fewer questions, never
          // more.
          firstBuild: rb.firstBuild === true,
          brief: rb.brief,
          qa: rb.qa,
          // THE MESSAGE IS AN ANSWER TO OUR OWN QUESTION — a clicked option, or
          // a typed reply while one is live. It closes "ask" off as an outcome,
          // because answering somebody's third button press with "tell me about
          // your business" is a dead end, and it shipped as one. Strictly
          // `=== true`, like `firstBuild` beside it: nothing merely truthy off a
          // public body changes how a paid call is read.
          answering: rb.answering === true,
          // …AND WHETHER IT WAS PRESSED (2026-10-14): only an answer picked from
          // our own options closes "ask" off now. A typed reply may be a side
          // question, and a file with a message may be talk about the file
          // (the owner: *"don't turn them into work merely because attached or
          // answering is true"*), so `attached` is no longer handed to the router.
          picked: rb.picked === true,
          // THE PREVIEW'S DEVICE (2026-10-24, per-device edits): a hint the
          // router is told; the customer's words decide. One of three names or none.
          device: readDeviceHint(rb && rb.device),
          // TOO BIG FOR ONE STEP, ROUTED AGAIN TO SPLIT ITSELF (owner,
          // 2026-10-24): a part's own ask (`partOf`'s `split`, set by the
          // request), or a standalone edit's from its page after its step
          // climbed — read strictly either way (`readSplit`).
          split: rPart ? (rPart.split || null) : readSplit(rb && rb.split),
          // THE CONVERSATION SO FAR (2026-10-14): the page's own copy of this
          // project's thread, read and windowed by `readHistory` there.
          history: rb.history,
          kept: rKept,
          // DOES THIS PROJECT ALREADY HAVE A SITE — the flag that opens `edit`
          // and `addon` at all, and the one that stops a colour change on a live
          // site costing a full rewrite of every page.
          //
          // TAKEN ON TRUST HERE, DELIBERATELY, because a routing answer is not a
          // permission. Neither direction of a lie is worth a round trip: claim
          // a site that is not yours and the edit route's `assertOwner` answers
          // 404 and the client falls back to the build it would have run anyway;
          // claim you have none and you rebuild your own site with your own
          // credits, which is exactly what happened before these rungs existed.
          //
          // ONE OWNERSHIP MECHANISM, NOT TWO THAT CAN DISAGREE — the rule this
          // file already follows for analytics. A first draft verified it here
          // as well and was WRONG in a way nothing would have caught:
          // `siteBackendBySlug` returns the connection STRING, so reading a
          // `.uid` off it is always undefined and the two new rungs would have
          // been silently unreachable for every customer.
          hasSite: rb.hasSite === true,
          // WHETHER THE NAMES THE ROUTER IS SHOWN WERE FILLED IN HERE: named in
          // the decision (`tables-filled`), never a change to what it is shown.
          tablesFilled: !!(rDigest.filled && rDigest.filled.length),
          // AND WHETHER THE SITE WAS READ TO HAVE NONE (2026-10-05): the router
          // is told so in words, and the decision names it (`tables-none`).
          tablesNone: !!(rDigest.filled && !rDigest.filled.length),
          // AND THE PAGES (2026-10-03): read from the site itself when the route
          // could, and whether that list is the whole of them — a page missing
          // from a list that may be partial is never read as one it lacks.
          pagesFilled: rDigest.pagesFilled === true,
          pagesComplete: rDigest.pagesComplete === true,
          // WHETHER A QUESTION CAN BE KEPT, WHAT THEY ALREADY TOLD US about
          // the waiting request, and the question this message may answer
          // (2026-10-02). Where no question can be kept, none may be asked.
          // A PART MAY ASK TOO (owner, 2026-10-26, replacing router-b1's
          // "never on a part"): its question pauses that part only, and is kept
          // in the site's slot when free (`storeAskIfFree`) or offered in turn.
          canAsk: rLive,
          // WHAT THE SITE HAS (router-b1, `routeInventory`), and a per-site
          // cache pin so every routing call about this site reads one cache.
          inventory: typeof rDigest.inventory === "string" ? rDigest.inventory : "",
          cacheKey: typeof rb.slug === "string" && /^[a-z0-9][a-z0-9-]{0,80}$/.test(rb.slug) ? "route-" + rb.slug : "",
          // A PART OF A LONGER REQUEST (2026-10-03) is shown that request's
          // answers, the message it came from and what the parts before it did.
          context: rWaiting ? rWaiting.context : rPart ? rPart.context : [],
          pending: rWaiting ? { request: rWaiting.request, question: rWaiting.question, chosen: rWaiting.chosen, by: rWaiting.by } : null,
          part: rPart ? { original: rPart.original, done: rPart.done, others: rPart.others } : null,
        },
      );
}

/**
 * A PART'S STEP PREPARED AHEAD of its job (the request preparation's run phase).
 * worker.js lines 25087-25109 at 014a7cd31.
 */
export async function prepRunStep() {
      if (outcome === "run") {
        const { url, body } = jobBody(work, n, "run", key + "-prep" + seq);
        const runPhase = A.phase("run");
        // THE STEP'S OWN INTERVAL (2026-10-09, the readiness correction): kept
        // on the part with the outcome, so a reader can tell the step's work
        // from the routing's and lay it beside another part's job.
        stepAt = Date.now();
        const beside = (work.parts || []).some((q) => q && q.n !== n && (q.status === "queued" || q.status === "started"));
        // DESIGN ONLY while an earlier part still changes a page its writer reads.
        const designFirst = planDesignOnly(work.parts || [], n, (q) => REQ_PART_TERMINAL.includes(q.status));
        const r = await replayPrepared(env, ctx, rec, url, body, runPhase, { beside, designOnly: designFirst });
        stepEnd = Date.now();
        // WHAT EACH OF THE STEP'S CALLS WAS SHOWN OF THE OTHER PARTS (2026-10-13): numbers only.
        stepMarks = runPhase.marks.slice();
        // EVERY PICTURE THIS ATTEMPT HAS, bought now or reused from the one before.
        A.live.run.images = runPhase.images.slice();
        const b = r.body || {};
        // A PURCHASE BEGUN BY SOMEONE AND NOT KNOWN TO HAVE ENDED: uncertain,
        // whatever the step made of the picture it did not get.
        outcome = A.unknown.length ? "uncertain" : r.prep.reached > 0 ? "ready"
          : (b.error === "clarify" || (b.ask && typeof b.ask === "object")) ? "ask"
          : r.status >= 500 ? "error" : "stopped";
      }
}

/**
 * THE ROUTES' OWN LOCALS THE OLD STEPS READ, taken out of the live edit and
 * add-on routes once nothing live read them. Each in a block of its own.
 */
export async function routeLocalsOldSteps() {
  {

            // OUR MODEL CALL DIED — one answer for the picker and every add,
            // the edit route's `modelDown` shape: a billing refusal is on us
            // and never "try again"; our own timeout is named as ours.
            const aDown = (e, what) => {
              console.error("addon model call failed:", ownerSlug, e && (e.call || ""), e && e.message);
              const k = upstreamKind(e && e.detail, e && e.status);
              const timedOut = isCallTimeout(e);
              return Response.json({
                ok: false, error: "send", cost: 0,
                msg: k.billing
                  ? "The site builder is temporarily unavailable — this is on us, not your change."
                  : timedOut
                    ? "That took longer than we allow ourselves to wait, so I stopped this addition."
                    : (what || "The builder is busy — try again in a moment."),
                upstream: (e && e.status) || null, upstreamType: k.type, billing: k.billing || undefined,
                timeout: timedOut || undefined,
                // THE PROVIDER'S OWN ERROR, KEPT (owner, 2026-10-24): its parsed
                // type and capped words, not only the log line; and the notice
                // when the call parked waiting for it.
                providerError: ((pe) => (pe.type || pe.message ? pe : undefined))(errorFacts(e)),
                wait: e && e.parked === true && e.providerWait ? e.providerWait.notice : undefined,
                // A JUDGMENT THAT DID NOT FINISH (2026-10-06): named for whoever
                // reads the answer back; the customer's sentence is the caller's.
                incomplete: (e && e.incomplete === true) || undefined,
                // NOTHING CHANGED, BY WHERE EVERY CALLER STANDS (2026-10-06):
                // the picker, the row step's designer, the designers and both
                // judgments, all above the backend block — so this run has
                // made, stored, applied, bought and published nothing yet. No
                // requirement is told: none was settled (a test holds every
                // caller above that block).
                outcome: failureOutcome(),
              }, { status: 503 });
            };
  }
  {

            // WHAT `cleanAdd` AND `siteNote` ARE HANDED IS ONE OBJECT, so the
            // destination a designer was offered and the destination the
            // cleaner will accept are the same list by construction. A second
            // reader assembling its own view of the planned pages is the
            // two-copies drift this repository has a name for.
            let aSite = siteFacts(aBaseline);
  }
  {

            const aFoldInto = (st, k, value) => {
              const tier = SPEC_OF_KIND[k];
              if (tier) {
                st.spec = proposedSpec(st.spec, k, value);
                for (const item of Array.isArray(value) ? value : []) {
                  const one = k === "table" ? (item && item.table) : item;
                  if (!one || !one.name) continue;
                  // ONLY A NAME THE SITE DID NOT ALREADY HAVE (2026-09-14). The
                  // cleaner answers `exists` for a table, function, connection
                  // or job this message names again, and `siteNote` prints
                  // "being added by this same change" against every proposed
                  // name — so an EXTENSION of a stored table was described to
                  // the next designer as a table the site has never had.
                  if (item && item.exists === true) continue;
                  if (!st.names[tier].includes(one.name)) st.names[tier].push(one.name);
                  if (k === "function" && one.internal === true && !st.names.jobFns.includes(one.name)) st.names.jobFns.push(one.name);
                }
              }
              if (k === "page") {
                for (const item of Array.isArray(value) ? value : []) {
                  if (!item || typeof item.path !== "string" || !item.path) continue;
                  if (st.pages.some((p) => p.path === item.path)) continue;
                  st.pages.push({ path: item.path, name: typeof item.name === "string" ? item.name : "" });
                }
              }
            };
  }
  {

            // ONE FOLD OF A DECIDED KIND INTO WHAT LATER DESIGNERS ARE SHOWN
            // (2026-10-11): a schema kind into the proposal and its new names,
            // a `page` into the planned pages. `st` is `{spec, names, pages}`;
            // the loop folds into the whole site, `aSiteFor` into a designer's
            // own view of it, in the same order (`aFolded`).
            const aFolded = [];
  }
  {


            const aModels = modelsFor(ab && ab.picker);
  }
  {

            let aPagelessRevision = 0;
  }
  {

            // THE SAME FOR A STOP WITH ITS OWN ANSWER BEFORE ANY WRITE: the row
            // step's refusals before its one statement, an addition already
            // true. A failure after the design goes through `aFail`, below.
            const aNone = (body, status) => Response.json({ ...body, outcome: failureOutcome() }, { status });
  }
  {

            const aDeviceNote = deviceNote(aDevices);
  }
  {

            // EVERY ADD-ON CALL SEES THE SITE (2026-10-26): designers, writers,
            // the judge, verification and retries, through this one transport.
            const aQuick = (what = "", opts) => clarifyTransport(aCounted(jobSend(aJob, mappedSend(env, ownerSlug, "site", quickSend(env, what, aJob && aJob.budget)), opts)), {
              shown: () => aShownTo(what),
              all: () => aCtxAll || [],
              part: aPartShown, replayHas: aReplayHas, onDefault: (d) => { aDefaulted.push(...d); },
              onReuse: (hit) => { try { if (editTrace) editTrace.mark("clarify:reuse", "ok", { what, answers: hit.length }); } catch { /* the record never costs the job */ } },
            });
  }
  {

            const aHold = (live, asked) => {
              if (!aJob) return;
              aJob.held = { requirements: holdRequirements([...(Array.isArray(live) ? live : []), ...aHeldIn.list.filter((r) => !aHeldUsed.has(r.id))]), asked: typeof asked === "string" ? asked : "" };
            };
  }
  {

            // Shown only to the designer whose question was answered: its request
            // changed with the answer anyway, and every other designer's stays
            // the one it made before, so its kept answer is replayed.
            const aHeldShown = (k) => (aHeldIn.asked === k ? heldNote(aHeldFor(k)) : "");
  }
  {

            const aKeepAnswer = (...a) => (aPrep ? Promise.resolve() : saveAddonAnswer(...a));
  }
  {

            const aPrepStop = () => { aJob.reached = (Number(aJob.reached) || 0) + 1; return Response.json({ ok: false, error: "prepared", ours: true }); };
  }
  {


            // OUR MODEL CALL DIED — ONE ANSWER, FOR ALL FOUR LANES.
            //
            // Every lane carries the thrown error back as `reason: "send"`, and
            // each of them used to fold it into a flat 422 "that change couldn't
            // be saved — try again", which is wrong twice: the status says the
            // customer's request was at fault when it was ours, and a BILLING
            // outage is the one failure nothing retries past, so "try again in a
            // moment" spends somebody's evening on it.
            //
            // Same shape the look layer and the build route already answer with,
            // so a lane that goes down reports identically wherever it sits on
            // the ladder. 503, never escalated: the rung above calls the same
            // provider and would fail the same way, at ~25 credits.
            const modelDown = (e, what) => {
              console.error("edit model call failed:", ownerSlug, eLayer, e && e.message);
              const k = upstreamKind(e && e.detail, e && e.status);
              // OUR CEILING IS NOT THE MODEL BEING BUSY, and the build path has
              // asked this since `isCallTimeout` was written — see its own note:
              // a timeout carries no HTTP response, so `upstreamKind` has
              // nothing to read and the throw falls through to whichever "busy,
              // try again" sentence the caller passed. That sentence blames the
              // provider for a bound of OURS and sends the customer back into
              // the identical wait. Run 95 is the measured instance: 27.7s, a
              // Haiku-sized window around a Grok call, reported as a busy model.
              const timedOut = isCallTimeout(e);
              // AN ANSWER CUT OFF AT ITS CEILING (2026-10-03) is a bound of
              // ours too: the step refused it whole rather than act on part of
              // a list, and the sentence says so instead of "busy".
              const cut = !!(e && e.truncated);
              return Response.json({
                ok: false, error: "send", cost: 0,
                msg: k.billing
                  ? "The site builder is temporarily unavailable — this is on us, not your change."
                  : timedOut
                    ? "That took longer than we allow ourselves to wait — this is on us."
                    : cut
                      ? "The builder's answer for that part was cut off before it finished, so none of it was used and nothing there changed — this is on us."
                      : (what || "That didn't go through — try again in a moment."),
                truncated: cut || undefined,
                upstream: (e && e.status) || null,
                upstreamType: k.type,
                billing: k.billing || undefined,
                // THE BOUND, NAMED, so a ceiling of ours can never again be read
                // off the wire as a provider's answer. `kind` already carried
                // `TimeoutError` and no reader printed it; this one says which
                // side the failure came from in a word.
                timeout: timedOut || undefined,
                waitedMs: timedOut ? QUICK_CALL_MS : undefined,
                call: (e && e.call) || undefined,
                kind: String((e && e.name) || "Error").slice(0, 40),
              }, { status: 503 });
            };
  }
  {

            // A WRITER'S BILL AND ITS FILES (the page rung's), only when it took something.
            const eNoteWriter = (took, writer, written) => {
              const w = writer.filter(Boolean);
              if (eLast && took > 0) eWriterBills.push({ took, ref: eLast.ref, writer: w, others: eLast.parts.filter((x) => !w.includes(x)), written });
              return took;
            };
  }
  {

            const publishStep = async (e, args) => {
              // A PREPARATION STOPS HERE (2026-10-08): the step's work is done
              // and recorded; nothing is compiled, staged or published, and the
              // part's own job — under the site's lock — makes the write.
              if (eJob && eJob.prepare === true) { eJob.reached = (Number(eJob.reached) || 0) + 1; return { ok: false, error: "prepared", ours: true, detail: "prepared" }; }
              if (Array.isArray(args && args.pages) && args.pages.length) eSrc = args.pages;
              // `renamed` ACCUMULATES rather than replaces: two rungs can each
              // rename something, and the spine takes one map. A later key wins,
              // which is the same rule the merge below uses for everything else.
              const renamed = { ...((pendingPublish && pendingPublish.renamed) || {}), ...((args && args.renamed) || {}) };
              // AND SO DO THE PARTS an earlier rung handed over. The page rung
              // carries the components the edit wrote; a later rung in the same
              // message (a nav change beside a new component) calls this with
              // none, and `{ ...args }` alone would drop them — the spine would
              // then send the stored list and the page's import would not
              // compile. A later list wins; absent means "no change to them".
              const parts = Array.isArray(args && args.parts) ? args.parts : ((pendingPublish && pendingPublish.parts) || null);
              // ── AND THE NEXT RUNG SEES THEM, exactly as it sees `eSrc` ────
              //
              // Handing the list over is not enough on its own: the next page
              // rung computes its own merge, and until today it computed it
              // from the STORE — which still holds what the message arrived
              // with. So the two rungs' answers could not both survive, and
              // "a later list wins" one line up decided which was thrown away.
              //
              // ONLY WHEN A RUNG REALLY HANDED COMPONENTS OVER, and only over
              // a state we could READ. A rung produces `args.parts` solely on
              // the path where the read succeeded and the merge ran, so this
              // can never manufacture an `ok` out of a failure — and the
              // explicit `ePartsRead.ok` keeps that true if a later caller
              // forgets.
              if (Array.isArray(args && args.parts) && ePartsRead && ePartsRead.ok) {
                ePartsRead = { ok: true, parts: args.parts };
              }
              // AND THE PICKER'S MODELS, so the spine's translation call runs
              // on the model this edit was picked for (run 38, 2026-09-04).
              // AND THE FUNNEL THE SPINE CHARGES ITS TRANSLATION CALLS THROUGH
              // (run 39): `eCharge` itself — a sequenced reserve under a job, a
              // collect otherwise — so the receipt (`billedAll`) and the bill
              // stay one list. Resolved when the publish runs, well after
              // `eCharge` below is initialised; the spine calls it once, with
              // every translation of the publish, before the compile and the
              // gate. A rung that stored nothing new to translate costs nothing
              // more.
              pendingPublish = { ...args, pages: eSrc, renamed: Object.keys(renamed).length ? renamed : null, parts, models: modelsFor(eb && eb.picker), charge: (usage) => eCharge({ langUsage: usage }), devices: eDevices, charges: eCharges };
              // THE PAGES THIS MESSAGE WROTE, for the seam's compile repair (2026-10-23):
              // only these may be repaired; its spend goes on the edit's own bill.
              pendingPublish.touched = writtenPaths(eSrcAt0, eSrc); pendingPublish.chargeRepair = (usage) => eCharge(...usage);
              // A DEFERRED PUBLISH REPORTS SUCCESS, because from the branch's
              // point of view its work IS done — it has stored what it changed
              // and handed over the pages. `files` and `render` are absent until
              // the real publish happens; the merged reply fills them in from
              // it, which is the only place they can honestly come from.
              return { ok: true, deferred: true };
            };
  }
  {

            const prepStop = () => { eJob.reached = (Number(eJob.reached) || 0) + 1; return prepAnswer(); };
  }
  {

            // WHAT THE CORRECTION ROUND NEEDS, CARRIED ACROSS THE SCOPE BOUNDARY.
            //
            // `edb`, `themeSheet` and the lane list are all `const`s inside the
            // `look` branch; the one publish runs BELOW that branch and cannot
            // see them. Reading them there anyway is a ReferenceError that
            // `node --check` passes and esbuild bundles happily — the `vidRefN`
            // class, which this repo has shipped to production once and which
            // `test/wiring.test.mjs` now catches. It caught this.
            //
            // So the look branch hands over exactly what the retry needs, and
            // `null` means no stylesheet was written this message — which is
            // also the gate on verifying selectors at all. `before` and `after`
            // are the sheet the css lane was shown and the one stored, so the
            // publish is verified for the rules between them and no others
            // (2026-09-26, `changedSelectors`); a correction that lands moves
            // `after` to the sheet it stored.
            //
            // ITS KEY IS `sheet` AND NOT `themeSheet`, deliberately. The guard
            // above matches a bare `\bname\b`, so `cssCtx.themeSheet` reads to
            // it as the out-of-scope variable it is named after — a false alarm
            // on correct code. Teaching that scanner about property positions
            // would buy a blind spot in a check that caught two real bugs in
            // this change alone; renaming one property costs nothing.
            let cssCtx = null;
  }
  {

            // ⚠ AND THE PROTECTION'S OWN RECEIPT IS A SET OF URLS, NOT A SUM.
            //
            // Every photograph a rung put back, collected across the message
            // and read ONCE below the loop against what really ships. A sum of
            // per-rung counts is the intermediate-state shape one field over:
            // the page rung restores a picture nobody named, an AUTHORISED
            // picture rung then takes it off, and *"the 2 photographs are
            // still there"* is printed beside *"one photograph is no longer on
            // the site"* — two sentences about one publication, contradicting
            // each other. Urls because only an identity can be intersected; a
            // count cannot say WHICH of them survived.
            //
            // IT NEVER REACHES THE WIRE. The merge turns it into a number, for
            // the reason `lostPhotosMsg` gives one path over: a storage key
            // tells a customer nothing.
            const ePhotosHeld = new Set();
  }
  {

            let ePartsAt0 = null;
  }
  {

            // ── A STEP THAT ASKS INSTEAD OF ACTING (2026-10-02) ────────────
            //
            // Its model could not tell which thing is meant without a detail
            // they left out, and asked (`builder/clarify.mjs`). Nothing is
            // written and nothing charged for the edit (`unchanged`, `cost: 0`;
            // the job path refunds a reply that is not ok). The ending
            // (`askReport`) keeps the question and names it; `msg` is the
            // question itself, for a reader that knows nothing of `clarify`.
            const stepAsk = (layer, ask) => Response.json({
              ok: false, error: "clarify", layer, cost: 0, unchanged: true, ask, msg: ask.text,
            });
  }
  {

            // A STEP THAT WROTE NOTHING, read off its own reply: it said so
            // (`unchanged`), it was withheld (which publishes nothing by
            // construction), or it escalated (every escalation returns before
            // its rung writes). Anything else — a compile failure after rows
            // were saved, a reply we could not read — is not known to be
            // nothing, and cannot-tell must never read as nothing-happened.
            const stepWroteNothing = (bd) => !!bd && (bd.unchanged === true || bd.error === "withheld" || bd.escalate === true);
  }
  {

            // ONE SHAPE FOR AN ANSWER THIS ROUTE DECIDES ON ITS OWN — a removal
            // it will not take (422) and a removal there was nothing to do
            // (200). `status` rides on the object because both shapes carry
            // one, and it is taken OFF the body: `ok` and `msg` are what the
            // browser reads, and a stray `status` in the JSON would be a second
            // copy of the HTTP one that can disagree with it.
            //
            // IT REPLACED TWO CALLS TO `editAnswer`, WHICH IS A chat.js
            // FUNCTION AND HAS NEVER EXISTED HERE (found 2026-09-12 by pointing
            // the free-identifier walker at worker.js for the first time). Both
            // sat in the removal verb's own branches: a picker that refused a
            // lane, and "your site doesn't have a 3D scene to take off". Both
            // would have thrown `ReferenceError` — `node --input-type=module
            // --check` passes on a free name, every source guard found its
            // landmarks, and the removal verb has not run live, which is the
            // only reason no customer met it. The browser's `editAnswer` takes
            // `(httpOk, e, o)` and returns nothing; this takes an object and
            // returns a Response, so the two were never the same function.
            const eAnswer = ({ status = 200, ...body }) => Response.json(body, { status });
  }
  {

            // AND EACH OWN LANE'S ANSWERS (`toldBy`, 2026-10-02), set beside it.
            let eToldBy = null;
  }
  {

            // EACH OWN LANE'S WORDS, for the one look step that runs them all —
            // set by the step loop from the step, like `eInstruction`.
            let eAsks = null;
  }
  {

            const eAskOf = (words) => (eDeviceNote ? words + "\n\n" + eDeviceNote : words);
  }
  {

            // The answers a step or lane is shown, by the indices it was given.
            const eCtxOf = (told) => (Array.isArray(told) ? eShownIdx.filter((j) => told.includes(j)).map((j) => eCtxAll[j]) : eShown);
  }
  {

      // THE ROUTER READS THE KEPT CHAT TOO (2026-10-20): its summary and recent
      // messages, never compacted here (the reply's call does that), and never
      // for a part's routing job, which carries its own request.
      let rKept = null;
  }
  {

            const siteFacts = (spec, names = aNewNames, pages = aNewPages) => ({
              name: aLook.brand || ownerSlug,
              url: aUrl,
              kind: aLook.kind === "tool" ? "tool" : "shopfront",
              pages: (aSrc || []).map((p) => routeOf(p && p.path)).filter(Boolean),
              // THE PAGES THIS SAME CHANGE IS ADDING, KEPT APART FROM THEM.
              // `pages` is read off the site's real source and is the current
              // implementation; this is the plan, one call old. Folding the
              // two would make a section land on a page with no source and
              // tell the designer to go and copy it.
              planned: pages.map((p) => ({ ...p })),
              // WHAT EACH PAGE CALLS ITSELF (run 28): its headline out of the
              // stored source, or its plan name — so "the booking page" is
              // findable among routes that never say the word.
              // …AS THE REQUEST WAS UNDERSTOOD (round 11): a request part's job
              // carries each page's label from when the message was read, and
              // those win for the pages the site still has — another part's
              // headline change never changes this addition's request.
              labels: { ...pageLabels(aView, aLook.pages), ...aLabelsAt },
              // WHAT EACH PAGE IS BUILT FROM (owner, 2026-09-04: a second one
              // copies the first's design): the kit components and the site's
              // own parts each page imports, so the component designer can
              // name the one a like section already uses.
              builtFrom: pageComponents(aView),
              // THE SITE MAP'S KEY FACTS (2026-10-26): contact details, hours,
              // prices and addresses with where each is written, from the
              // pages and parts this addition is shown.
              keyFacts: (() => { try { return mapFor("addon", buildSiteMap({ pages: aView, parts: Array.isArray(aViewParts) ? aViewParts : [] })); } catch { return ""; } })(),
              // AND THE ROW DESIGNER'S TABLE CONTEXT FROM THE MAP (2026-10-26);
              // the live required-columns read (`aRowRequired`) stays the truth.
              rowNote: (() => { try { return mapFor("rowNote", buildSiteMap({ spec, label: accessLabel })); } catch { return ""; } })(),
              tables: ((spec && spec.tables) || []).map((t) => t && t.name).filter(Boolean),
              // EACH TABLE'S COLUMNS, "name type" (2026-09-03), for the
              // function designer: a `sql` body is parsed at CREATE, so a
              // guessed column is a function that does not exist.
              columns: Object.fromEntries(((spec && spec.tables) || []).filter((t) => t && t.name).map((t) => [t.name,
                (Array.isArray(t.columns) ? t.columns : []).map((c) => (typeof c === "string" ? c : (c && c.name ? c.name + (c.type ? " " + c.type : "") : ""))).filter(Boolean)])),
              // AND EACH TABLE'S PERMISSIONS, RELATIONSHIPS AND GUARANTEES
              // (owner, 2026-09-13). The columns alone cannot stop a designer
              // writing a second table to hold rows one already holds
              // privately, or inventing a parent one already points at, or
              // re-declaring a unique slot that is already enforced. Worded in
              // `tableFacts` so the sentence has one home and a test can drive
              // it against a real stored spec.
              tableInfo: tableFacts(spec),
              // THE OTHER THREE TIERS BY NAME (2026-09-03): a designer adding
              // one names a new one, and a job names a function the site has
              // — an INTERNAL one, `jobFns`, which is the only kind the engine
              // lets a job run. The `function` designer's own answers join
              // both lists as they are cleaned, one kind further down.
              functions: ((spec && spec.functions) || []).map((f) => f && f.name).filter(Boolean),
              // AND WHICH OF THEM IS NOT AN ORDINARY SQL FUNCTION (2026-09-19),
              // keyed beside the names the way `columns` is keyed beside
              // `tables`. The hazard it closes is narrow and real: a function
              // is re-declared BY NAME (`CREATE OR REPLACE`), and a designer
              // that re-declares an existing plpgsql function without saying
              // so gets `LANGUAGE sql` — a body with `DECLARE`, `IF` or a loop
              // in it, created as SQL, which fails at CREATE. The stored
              // declaration is the only record anywhere of what a live
              // function IS, so this is the only place that answer can come
              // from. NON-DEFAULT ONLY, so a site with no plpgsql function
              // reads byte for byte as it did.
              fnLangs: Object.fromEntries(((spec && spec.functions) || [])
                .filter((f) => f && f.name && f.language && f.language !== "sql")
                .map((f) => [f.name, String(f.language)])),
              jobFns: ((spec && spec.functions) || []).filter((f) => f && f.name && f.internal).map((f) => f.name),
              apis: ((spec && spec.apis) || []).map((a) => a && a.name).filter(Boolean),
              jobs: ((spec && spec.jobs) || []).map((j) => j && j.name).filter(Boolean),
              hasDatabase: !!adb,
              // THE CODES BY NAME, the whole list — the designer that adds
              // one is shown what the site has so it names a new one, and
              // `cleanAdd` refuses a same-name or same-destination code
              // against this same list (2026-09-03).
              qr: qrList(aLook.qr),
              // THE PHOTOGRAPHS IT ALREADY SHOWS, by exact address (2026-10-02),
              // so a photograph to add can be one of the owner's own: the
              // `photo` designer copies a `src` from here, and `cleanAdd`
              // refuses one that is not on this same list. Pages and
              // components, through the one inventory reader; pages alone
              // when the components could not be read.
              photos: ownPhotos(photoInventory(aView, aViewParts, aPartsRead.ok) || aView || [], ownerSlug),
              three: aHas.three ? (typeof aLook.three === "string" && aLook.three ? aLook.three : "one on the page") : null,
              tsx: aViewTsx(Array.isArray(aLook.tsx) ? aLook.tsx : []),
              // THE COMPONENTS THE SITE REALLY HAS, beside the declarations
              // above. `tsx` is `look.tsx` — cumulative, a plan, and true of
              // a component nobody ever wrote; `parts` is what has a file.
              // `null` when the read failed, which `siteNote` prints as the
              // old sentence rather than as "it has none".
              parts: aViewParts ? aViewParts.map((p) => ({ name: p && p.name })) : null,
              // AND THE LOOK IT IS WEARING (owner, 2026-09-17). Every add
              // rule tells the designer to keep the site's design system;
              // until today nothing in its inputs said what that system is.
              // Names only — the stylesheet's BYTES go to the page writer,
              // which is the step that emits markup it has to match.
              theme: typeof aLook.theme === "string" ? aLook.theme : "",
              css: !!(aCss && aCss.trim()),
              // WHICH OF THE NAMES ABOVE THIS MESSAGE IS STILL BUILDING.
              // `siteNote` marks each one, so a designer can rely on it and
              // still know it is not there yet.
              proposed: { ...names },
            });
  }
  {

            // `opts.refusals`: this call handles a prior refusal — only the
            // add-on designer's first request does (`aPriorOf`).
            // ANY STEP MAY ASK, AT ANY STAGE (owner, 2026-10-26): no `charged`
            // gate, so the add-on's calls are offered their question after a
            // reserve too; the job that ends in a question is refunded.
            const aReplayHas = (r) => (aJob && aJob.prepare !== true && aJob.replay && typeof aJob.replay.has === "function" ? aJob.replay.has(r) : false);
  }
  {

            // EVERY MODEL CALL ON THIS ROUTE GOES THROUGH ONE WRAPPER, so the
            // job's clock reaches all of them — the picker, one designer per
            // kind, the seed net — without one chance per call to forget it.
            // `aJob` is null on the synchronous path and `quickSend` keeps its
            // flat ceiling, exactly as before. AND SO DO THE ANSWERS
            // (`clarifyTransport`), as on the edit route.
            // AN ANSWER TO ONE DESIGNER'S QUESTION (`by: "add:component"`,
            // 2026-10-11, the continuation round) is shown to that designer,
            // to the designers that use its result, and to every call that is
            // not a designer or the picker (the judge, the page writer); never
            // to the picker or a designer it does not reach — so their requests
            // are the ones they made before the question, and the part's next
            // job replays them (`stageKept`) instead of asking again.
            const aShownTo = (what) => {
              const kind = typeof what === "string" && what.startsWith("add:") ? what.slice(4) : null;
              const reach = what === "pick_adds" ? [] : kind ? ["add:" + kind, ...((aWaitsLive()[kind]) || []).map((w) => "add:" + w)] : null;
              return reach === null ? aCtxShown : aCtxShown.filter((p) => !p.by || reach.includes(p.by));
            };
  }
  {

            const aHeldFor = (k) => aHeldIn.list.filter((r) => !aHeldUsed.has(r.id) && ownerOf(r) === k);
  }
  {

            const aPartShown = () => (aPart ? { original: aPart.original, done: aPart.done, others: aPart.others } : null);
  }
  {

            const eWriterBills = [];
  }
  {

            // A PREPARATION'S STOP (2026-10-09): the step reached the write a
            // preparation never makes — its model work is done and recorded —
            // and it answers at once, so no failure path after it (a compile
            // fallback, a rollback) runs. `prepStop` counts the stop; a
            // publish that already counted it is answered with `prepAnswer`.
            const prepAnswer = () => Response.json({ ok: false, error: "prepared", ours: true });
  }
  {


            let pendingPublish = null;
  }
  {

            const eDeviceNote = deviceNote(eDevices);
  }
  {

            // A DECLARATION LIST SHOWN UNDER A SCOPE: the components its pages
            // import, and whatever this change itself declares (`own`).
            const aViewTsx = (tsx, own) => (!aScope ? tsx : (Array.isArray(tsx) ? tsx : []).filter((t) => t && (aViewUses.includes(aNameKey(t.name)) || (own && own(t)))));
  }
  {

            // ── AND THE FRONTEND HALF OF THE SAME FACT (2026-09-17) ───────
            //
            // Owner: *"Pass newly planned frontend items to subsequent
            // designers, as we already do for backend declarations."* The
            // backend tiers have crossed between kinds since 2026-09-14; a
            // page decided by the `page` designer reached nobody, and the
            // `component`, `qr` and `three` designers all run AFTER it. The
            // two reproductions are in `cleanAdd`'s own comment.
            //
            // `{path, name}` rather than a bare route, because the note names
            // each planned page the way it names a live one — a designer that
            // cannot tell which new page is "the gallery" cannot place a
            // section on it any better than one that never heard of it.
            const aNewPages = [];
  }
  {

            // THE SITE'S OWN ADDRESS (run 26, 2026-09-03): the QR designer is
            // forbidden to invent a destination, and "a code that opens the
            // booking page" has none unless it is told where the site lives —
            // it answered nothing, honestly, for the site's own home page.
            // `publicUrlFor` is the one reader of the public address (the
            // spine, the build, the resume reply); a read
            // that fails leaves it blank, and the note says so, rather than
            // refusing every other kind over an address.
            let aUrl = "";
  }
  {

            const aWaitsLive = () => aWaitsHeld;
  }
  {

            const aHeldUsed = new Set();
  }
  {

            // The names THIS message added, per list, so the note can mark them
            // as being built rather than presenting them as already there.
            const aNewNames = { tables: [], functions: [], jobFns: [], apis: [], jobs: [] };
  }
  {

            let aProposed = aBaseline;
  }
  {

            // A FIRST REQUEST ANSWERED BY A PRIOR REFUSAL (2026-10-13) asked no
            // model and is not counted; a caller that declines it asks again,
            // and that call is.
            const aCounted = (send) => async (req) => {
              try { const r = await send(req); if (aScoped) noteSeen(aJob, "scope"); return r; }
              catch (e) { if (aScoped && !priorRefusalOf(e)) noteSeen(aJob, "scope"); throw e; }
            };
  }
  {

            // WHAT EACH DESIGNER WAITS FOR, once the picker has answered (`aWaits`, below).
            let aWaitsHeld = {};
  }
  {

            // ── AND WHAT THE SITE HELD BEFORE ANY RUNG RAN ────────────────
            //
            // The pages one is free: `eSrc` is reassigned by `publishStep`, so
            // holding the array it arrived with costs a reference. The
            // components one is taken at the FIRST read, because the read
            // itself is lazy and `publishStep` advances `ePartsRead` exactly
            // as it advances `eSrc`.
            //
            // WHY A MESSAGE-WIDE PAIR EXISTS AT ALL: every outcome this route
            // reports about the site's PICTURES is a comparison, and a
            // comparison taken per rung answers about a version that may
            // never ship. Two page rungs run for one sentence
            // (`components` and `tsx` both dispatch here), so rung 2's
            // "before" was rung 1's output — and a photograph rung 1 took off
            // and rung 2 put back was REPORTED LOST on a publication that
            // shows it. The customer hears about the intermediate state.
            //
            // So the question is asked ONCE, below the loop, of the two things
            // that are really comparable: what the message arrived to, and
            // what the one publish is about to ship.
            const eSrcAt0 = eSrc;
  }
  {

            const restoreEditConfig = async () => {
              if (!eConfigWritten) return true;
              try {
                if (!preEditConfig) throw new Error("no snapshot to restore from");
                await mayWriteConfig(env, ownerSlug, eJob);
                const back = await patchSiteConfig(env, ownerSlug, await siteRowConn(env, ownerSlug), preEditConfig, jobFence(env, eJob));
                if (!back.ok) throw new Error(back.error);
                return true;
              } catch (e) {
                console.error("edit rollback failed:", ownerSlug, e && e.message);
                return false;
              }
            };
  }
  {

            // ── THE BASELINE AND THE PROPOSAL (2026-09-14) ────────────────
            //
            // `aBaseline` is the STORED spec and is never written to: it is
            // what `added` versus `altered` is decided against, what the reply
            // reports, and what a refused addition leaves the site as.
            //
            // `aProposed` is that plus everything this message has designed so
            // far, rebuilt after each kind. It exists because each kind is its
            // OWN model call and, until now, exactly two facts crossed between
            // them — `functions` and `jobFns`, pushed in the loop so a job
            // could name a function designed a call earlier. Everything else
            // the designers told each other was nothing: the `api` step could
            // not see the table just designed, and the `page` step was handed a
            // description built from the stored spec alone, describing a site
            // that no longer matched what this same message had decided.
            //
            // IT IS ALSO WHAT THE VALIDATION NORMALISES INSIDE. A job alone
            // normalises to nothing (its function is absent); in the proposal
            // its function is there and it survives. Validating against the
            // baseline would report every dependent item as dropped whole.
            const aBaseline = aSpec;
  }
  {

            // A CALL MADE UNDER THE PART'S PAGE SCOPE, COUNTED ON ITS JOB
            // (2026-10-12, run 141): the edit steps' `noteSeen`, so an Add-on
            // shown only its pages reports `scoped` as they do — it said 0 for
            // every Add-on, scoped or not. Set where the scope is read.
            let aScoped = false;
  }
  {

            // ── AND IT GOES BACK ON EVERY WAY OUT THAT PUBLISHES NOTHING ────
            // (2026-09-25). A rung writes its look or stylesheet into the
            // stored config BEFORE the one publish, so an edit that stops
            // after that write and before a publish leaves the change saved
            // and unpublished — and the next, unrelated edit compiles from the
            // stored config and ships it. Only the compile failure put the
            // snapshot back; an edit cancelled or stopped at the publish gate,
            // refused by the correction round for time or for a correction
            // that still missed, or whose correction round threw, did not.
            // MEASURED through the route and the real queue consumer: a job
            // cancelled after its css lane wrote "#014421" answered "your site
            // is untouched", and the NEXT message — a name change — compiled
            // with "#014421" in it.
            //
            // `eConfigWritten` IS SET AT EACH RUNG'S OWN SUCCESSFUL WRITE, so a
            // message that wrote nothing has nothing to put back and answers
            // true without a write — and a snapshot that could not be read is
            // only a problem when something was written over it.
            let eConfigWritten = false;
  }
  {


            // ── ONE PUBLISH PER MESSAGE ───────────────────────────────────
            //
            // Owner, 2026-08-29: *"for the publish is per act — if the act was 2
            // things then 1 publish; if the act was 2 things but one thing first
            // then the other, then is 2 publish"*. One message is one act.
            //
            // Several rungs can run for one message now, and each of them ends
            // by calling the publish spine — so a two-part ask compiled twice,
            // wrote two version entries, archived two builds, and the customer
            // watched their site change twice for one sentence.
            //
            // ONE NAME THE BRANCHES CALL, `publishStep`, and it does not
            // publish. Each of the eight layer branches ends by handing its
            // pages over; this collects them and the real spine runs once below
            // the loop.
            //
            // NAMED RATHER THAN SHADOWING `recompileAndPublish`, which is what
            // this was first: a block-scoped const of the same name let every
            // branch keep its code untouched, and cost two real problems. The
            // alias had to be taken at module scope or the shadow hid the
            // original from its own initialiser (a temporal-dead-zone throw),
            // and the out-of-scope lint then reported the module-level spine's
            // own callers as ReferenceErrors — a false alarm, which this repo
            // holds to be worse than a miss. A distinct name costs ten call
            // sites once and nothing afterwards.
            //
            // AND THE SOURCE CARRIES FORWARD. Each branch computes its pages
            // from `eSrc` and hands them here; storing them back into `eSrc` is
            // what makes the SECOND rung start from what the first one wrote
            // rather than from the original — without it, one publish would ship
            // whichever step happened to run last and silently drop the others.
            // That is why `eSrc` is a `let`.
            // WHAT THE SITE'S CONFIG WAS BEFORE ANY RUNG TOUCHED IT, so a
            // failed publish can put it back. Read once, cheaply, and only used
            // on the failure path — several rungs each write their own field, so
            // the alternative is N snapshots and an unwind order.
            //
            // A READ THAT FAILS IS `null`, WHICH IS NOT A SNAPSHOT. Restoring
            // from it would blank the look and the stylesheet on a site whose
            // config we merely could not read — cannot-tell must never read as
            // nothing-there, which is the rule `loadConfig` already keeps.
            let preEditConfig = null;
  }
  {

            // THE NAMES AND PAGES ARE ARGUMENTS (2026-10-11), so a designer can be
            // shown the site with only the results it uses (`aSiteFor`, below).
            const aLabelsAt = (() => {
              const at = aPart ? readLabels(ab && ab.labels) : null;
              if (!at) return {};
              // Only the pages this part is shown: a scoped part never hears another page's label.
              const have = new Set((aView || []).map((p) => routeOf(p && p.path)).filter(Boolean));
              return Object.fromEntries(Object.entries(at).filter(([r]) => have.has(r)));
            })();
  }
  {

            // ── TODAY, IN THE SITE'S OWN ZONE (2026-09-19) ─────────────────
            //
            // For a cleaner's past-date check. `en-CA` is not a locale choice, it is the one
            // that formats a date as `YYYY-MM-DD`; asking for the parts and
            // joining them by hand would be a second date formatter.
            //
            // NULL WHEN THE BROWSER SENT NO ZONE, and the cleaner then stands
            // down rather than comparing a local date against UTC — which
            // would refuse a perfectly good "today" for everybody west of
            // Greenwich for most of their working day.
            const aToday = aTz
              ? (() => { try { return new Intl.DateTimeFormat("en-CA", { timeZone: aTz }).format(new Date()); } catch { return null; } })()
              : null;
  }
  {

            const aCtxShown = shownContext(aCtxAll || []);
  }
  {

            const aHeldIn = aJob && aJob.heldIn && Array.isArray(aJob.heldIn.list) ? aJob.heldIn : { list: [], asked: "" };
  }
  {

            const isPrep = !!(eJob && eJob.prepare === true);
  }
  {

            const eRename = !eHanded && typeof (eb && eb.rename) === "string" ? eb.rename.trim().toLowerCase() : "";
  }
  {

            const eRemove = !eHanded && !!(eb && eb.remove === true);
  }
  {

            const eExisting = !!(eExistingHand && eExistingHand.reason === "existing");
  }
  {

            // THE OWNER'S ZONE (2026-09-03): asked of Intl, so an unknown name
            // is nothing rather than a throw.
            const aTz = (() => {
              const z = ab && typeof ab.tz === "string" ? ab.tz.trim() : "";
              if (!z || z.length > 64) return null;
              try { new Intl.DateTimeFormat("en-US", { timeZone: z }); return z; } catch { return null; }
            })();
  }
  {

            // AN ADD-ON ABOUT WHAT THE SITE ALREADY HAS (2026-10-25,
            // frame-parallel): the router (`routeOnExisting`) or the add-on step
            // (`existing`) sent "Add a Cafe page…" here because the site already
            // has that page and its lists. Live on driftwood-and-daughters-5 the
            // page writer answered the page unchanged — it already did what was
            // asked — and the no-change retry pushed it into a whole-page rewrite
            // anyway (12–17 credits each, four at once). For such a part an
            // unchanged page is the answer: said, not retried, nothing charged
            // for the edit. Read whether or not `handedOff` (it only narrows).
            const eExistingHand = readHandOver(eb && eb.handOver);
  }
  // And the writes of the locals above that were kept only for the old steps:
  {
      if (!rJob && ru && ru.id) {
        try { rKept = await chatRouterWindow(env, ru.id, rb.chat, rb.message); } catch (e) { console.error("chat window:", errorClassForLog(e)); rKept = null; }
      }
      try {
        const snap = await readSiteConfig(env, ownerSlug, await siteRowConn(env, ownerSlug));
        if (snap.ok) preEditConfig = { look: snap.config.look, css: snap.config.css };
      } catch { preEditConfig = null; }
      ePartsAt0 = ePartsRead.ok ? ePartsRead.parts : [];
      try { aUrl = await publicUrlFor(env, ownerSlug); } catch { aUrl = ""; }
      aScoped = !!aScope;
      // THIS TASK'S BACKEND WRITES GO THROUGH ITS WRITER: the names below
      // are the writer's, with the same arguments.
      const { applySiteSchema, seedSiteRows } = aWriter.calls;
  }
}

/**
 * THE PER-PART REQUEST REPLY (`requestReply` in worker.js), written by the model from the
 * request facts. The message's one reply took its place on 2026-11-01; it ran only under
 * the suite's GF_OLD_LANES=1. The body after its `if (oneReplyOn()) return null;` line.
 */
export async function requestReplyPerPart(env, rec) {
  if (!repliesOn(env) || !env.SITES_BUCKET) return null;
  const place = requestReplyPlace(rec);
  if (!place) return null;
  const now = Date.now();
  const at = await replyRecordAt(env, place.k);
  if (!at.read) return { state: "pending", for: place.forKey };
  const next = replyNext(at.rec, now);
  if (next === "serve") return { text: at.rec.text, for: place.forKey, ...(at.rec.suggested ? { suggested: at.rec.suggested } : {}) };
  if (next === "failed") return { state: "failed", for: place.forKey };
  if (next === "none") return null;
  if (next === "wait") return { state: "pending", for: place.forKey };
  if (next === "ask") {
    const read = requestReplyFacts(requestView(rec));
    if (read.skip || !read.facts.length) {
      await putReplyRecord(env, place.k, { state: "none", attempts: 0, asked: now, at: now, why: String(read.skip || "no-facts").slice(0, 40) }, at.etag);
      return null;
    }
  }
  const state = await askReply(env, place.k, { slug: rec.slug, key: rec.key, for: place.forKey }, now);
  return { state: state === "failed" ? "failed" : "pending", for: place.forKey };
}
