// Audit 2 (2026-11-04): every line of the builder has exactly one owner.
//   node scripts/audit-coverage.mjs build   writes docs/audits/2026-11-04-coverage.json
//   node scripts/audit-coverage.mjs check   fails if a line of an in-scope file is
//                                           unassigned, or the map is stale
// Scope: builder/*.mjs, the root *.mjs modules, public/{chat,edit-poll,chat-talk,key-card,site-list,site-media,site-zip}.js,
// worker.js, builder/lovable/template/src (its non-kit files and the 43 kit files left).
// Files are cut into units (top-level functions; worker.js's handleRequest further into
// its routes), and each unit gets an area from RULES by its file and name, or an
// explicit "out" with the reason (outside the builder, by the owner's scope).
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

const OUT = "docs/audits/2026-11-04-coverage.json";
const tracked = execSync("git ls-files", { encoding: "utf8" }).split("\n").filter(Boolean);
const T = "builder/lovable/template/src/";
const inScope = (f) =>
  (/^builder\/[^/]+\.mjs$/.test(f)) || (/^[^/]+\.mjs$/.test(f)) || f === "worker.js" ||
  /^public\/(chat|edit-poll|chat-talk|key-card|site-list|site-media|site-zip)\.js$/.test(f) ||
  (f.startsWith(T) && /\.(tsx?|css)$/.test(f));

// AREAS (docs/audits/2026-11-04-audit-plan.md). Rules: [area, file regex, unit-name regex].
// First match wins; order matters (specific before general).
const OUTR = (why) => "out: " + why;
const RULES = [
  // ── outside the builder (owner, 2026-11-04) ─────────────────────────────
  [OUTR("generator / dev tool, not run by the product"), /builder\/gen-/, /./],
  [OUTR("dead: nothing reaches it (scripts/audit-reach.mjs)"), /builder\/(page-prose|components-next|components-planned|kit-headings)\.mjs/, /./],
  // Generic "out" rules read only the two big files' own names, tightly
  // (session 0's first pass sent `authored`, `designInGraph`, `prepUseOf` and the
  // render check's probes out by loose keywords).
  [OUTR("accounts and sign-in"), /^(worker\.js|public\/chat\.js)$/, /^(show|hide|init)AuthGate$|^auth(Entry|El|Mode|Step|Ask)$|^(open)?AuthFrom$|^openAuthFrom$|^finishAuth$|^showAuthError$|^friendlyAuthErr$|^AUTH_|^authSubmitLabel$|^renderAuthStep$|^setAuthMode$|^onAuthBack$|^submitAuth$|^resendAuthCode$|^authUser$|\/api\/auth|magic|password/],
  [OUTR("domains and DNS"), /site-(dns|domain-connect|registrar)\.mjs/, /./],
  [OUTR("domains and DNS"), /^(worker\.js|public\/chat\.js)$/, /[dD]omain|[rR]egistrar|dnsInstructions|DnsCheck|\/dns$/],
  [OUTR("platform billing (plans, top-ups), not credits while building"), /billing\.mjs|stripe-webhook\.mjs/, /./],
  [OUTR("platform billing"), /worker\.js/, /\/api\/(checkout|billing|stripe\/webhook|fal-balance)|subscription|topup|plan(Of|For)?Price/i],
  [OUTR("owner tools: inbox, SEO, QR, data panel, export, backup"), /site-(seo|head-edit|export|backup|csv|teardown|qr-list)\.mjs/, /./],
  [OUTR("owner tools"), /^(worker\.js|public\/chat\.js)$/, /siteInbox|[iI]nbox|siteBackups|[bB]ackup|^siteDatabase$|Seo\b|^ST_SEO|^stSeo|^moreSeo|^loadSiteSeo$|qrPayload|analytics|[tT]eardown|^deleteSite|delete-all|recordSiteHit|readOwnHits|^_metBuf$|\/seo$|\/export$/],
  [OUTR("phone-app builder"), /builder\/app-gen\.mjs/, /./],
  [OUTR("phone-app builder"), /^(worker\.js|public\/chat\.js)$/, /\bapp(Os|Surface|Build|Gen)|expo|codemagic/i],
  [OUTR("landing, welcome, pricing, account menus"), /public\/chat\.js/, /welcome|landing|pricing|acct|account|avatar|profile|sidebar|renderHome|homeView/i],
  [OUTR("ops probes and diagnostics"), /worker\.js/, /^route \/api\/_|\/api\/site\/(job-probe|genprobe|build-health)|flushSiteMetrics|^_falBal$/],
  ["6 draft and publish", /site-domains\.mjs/, /./],
  // ── 1 agent ──────────────────────────────────────────────────────────────
  ["1 agent", /builder\/(site-agent|agent-[a-z-]+|one-reply|site-converse|clarify|chat-context|site-context|file-picker|input-budget|model-xai|model-fanout|provider-retry|retry-reason|build-models|exact-edits|hand-over|context-report)\.mjs/, /./],
  ["1 agent", /./, /runAgent|agentChange|siteAgent|AgentChange|newProjectMessage|historyText|askOwner|ask_owner|converse|clarify/i],
  // ── 2 requests ──────────────────────────────────────────────────────────
  ["2 requests", /builder\/(request|request-plan|site-dispatch|run-step|job-progress|site-chat)\.mjs|request-limits\.mjs|rate-limit\.mjs/, /./],
  ["2 requests", /./, /siteReq|request(Show|Follow|Stop|View|Card|Put|Say)|\/api\/site\/request|queue|siteQueue|chatQueue|split/i],
  // ── 3 first build ───────────────────────────────────────────────────────
  ["3 first build", /builder\/(page-gen|site-plan|design-[a-z]+|build-[a-z]+|first-build-db|prepared|site-seeds?|seed-rows|site-identity|site-import|foundation-files|project-files|kit-closure|site-frame)\.mjs/, /./],
  ["3 first build", /./, /runSiteBuild|buildAndPublish|react-build|reactBuild|siteBuild(?!Server)|firstBuild|newProject|startBuild|brief/i],
  // ── 4 edits and additions ───────────────────────────────────────────────
  ["4 edits", /builder\/(site-apply|edit-[a-z]+|site-edit|site-render|render-[a-z-]+|compile-repair|site-repair|diagnose|change-salvage|site-add|site-addon|addon-[a-z]+|requirement-[a-z]+|site-requirements|site-lanes|site-tweak|page-keep|page-bands|site-text|site-authored|site-rules|site-order|site-table|site-rows|check-evidence|visual-review|device-scope|security-scan|security-say|site-verify|route-shared|route-inventory|site-reconcile|edit-failure|exit-reason|site-card)\.mjs/, /./],
  ["4 edits", /./, /edit|addon|add-on|recompile|compile|repair|render|salvage|tweak|lane/i],
  // ── 5 where the work runs ───────────────────────────────────────────────
  ["5 containers", /builder\/(build-server|container-[a-z]+|job-[a-z]+|containers-shim|cloudflare-shim|worker-[a-z]+|server-[a-z-]+|long-post|pending-frames|trace|edit-trace)\.mjs/, /./],
  ["5 containers", /./, /container|lease|job|sweep|recover|deadline|heartbeat|gateway/i],
  // ── 6 draft and publish ─────────────────────────────────────────────────
  ["6 draft and publish", /builder\/(publish-[a-z]+|site-bucket|site-ssr|site-offline)\.mjs|site-(draft|versions|live|builds|rebuild|meta|routing|headers|errors|idem|sweep)\.mjs/, /./],
  ["6 draft and publish", /./, /publish|draft|preview|version|restore|rollback|live|current\//i],
  // ── 7 what a site can do ────────────────────────────────────────────────
  ["7 site features", /builder\/(server-code|site-migrations|security|build-keys|key-card)\.mjs|site-(db|schema|schema-recover|rls|access|secrets|security|provision|backend-state|config|owner|uploads|media|ssrf|turnstile|cookie|app-login)\.mjs/, /./],
  ["7 site features", /./, /\/api\/db|secret|keys?Card|siteKey|neon|schema|rls|grant|provision|backend|fn\/|server.?fn|webhook|mail|payment|turnstile|ssrf|upload|media/i],
  // ── 8 credits while building ────────────────────────────────────────────
  ["8 credits", /./, /credit|charge|refund|reserve|ledger|balance|debit|bill|cost|afford/i],
  // ── 9–11 the page ───────────────────────────────────────────────────────
  ["10 message box", /public\/(key-card)\.js/, /./],
  ["10 message box", /public\/chat\.js/, /composer|send|stop|attach|picker|effort|slash|keyCard|KeyNames|draft(?!.*publish)|unsent|hold/i],
  ["11 workspace and sync", /public\/(site-list|site-zip|site-media)\.js/, /./],
  ["11 workspace and sync", /public\/chat\.js/, /workspace|frame|preview|code|device|history|share|chat(Push|Pull|Adopt|Sig|Store|Key)|sites(Save|Load|Merge|Kept|Cache)|sync|storage|wsPref|siteById|sitesList/i],
  ["9 chat", /public\/(chat-talk|edit-poll)\.js/, /./],
  ["9 chat", /public\/chat\.js/, /./],
  // ── 12 progress and replies ─────────────────────────────────────────────
  ["12 progress and replies", /builder\/(site-progress|site-reply|build-live)\.mjs/, /./],
  ["12 progress and replies", /./, /progress|narrat|reply|say|talk/i],
  // ── 13 look and pictures ────────────────────────────────────────────────
  ["13 look and pictures", /builder\/(site-nav|site-theme|site-theme-registry|site-tokens|site-style|site-freecss|site-css|site-fonts|site-favicon|site-mark|site-picture|site-images|attached-photos|rendered-[a-z]+|site-3d|model3d-route|site-langs|site-translate|lang-override|site-alias|site-map|site-files|pdf-text|ui-components|component-api|chart-api|chart-usage)\.mjs/, /./],
  ["13 look and pictures", /./, /theme|nav|menu|font|picture|image|photo|logo|favicon|style|css|translat|lang/i],
  // ── 15 the site it makes ────────────────────────────────────────────────
  ["15 the site it makes", new RegExp("^" + T.replace(/\//g, "\\/")), /./],
  // ── worker.js leftovers, placed by hand from their names (session 0) ──────
  [OUTR("accounts and sign-in"), /worker\.js/, /^acct|^ACCT_|account-state|^OPERATOR_|^operator|members/],
  [OUTR("phone-app builder"), /worker\.js/, /^app[A-Z]|^APP_|PhoneApp|siteAppFiles|AppConn|APP_CONN|\/app[/(*]/],
  [OUTR("domains and DNS"), /worker\.js/, /^CF_API$|^DC_|saasTarget/],
  [OUTR("owner tools"), /worker\.js/, /analytics|delete-all|^_metBuf|recordSiteHit|readOwnHits/],
  [OUTR("ops probes and diagnostics"), /worker\.js/, /build-health|^_falBal/],
  ["1 agent", /worker\.js/, /^agent|^KEYS_ASKED|keysAsked|rememberKeyAsked|throttledStop|customerEffortApi|^with(Customer|Build|Kept)Effort|withEffortAll|^model(Send|Opts)|callBuilderModel|callJournal|providerSink|providerWaitOpts|^journaled|readNotice|withPartWaits|readParkFor|withStoppedLine|runProviderWaits|isCallTimeout|modelKeyMissing|^quick|^QUICK|tokensReport|CONTEXT_TEST_UIDS|TEST_WINDOW|testWindowFor|chatWindowFor|chatRouterWindow|siteWebResearch|siteReadUrl|importFetch|SITE_LINK_BYTES|\/api\/site\/route$|routeAnswer|ROUTE_ANSWER|RouteAnswer|routeTable|ROUTE_TABLE|routeDeps|routeScopeOf|routeDigest|sitePageRoutes|ROUTE_PAGES_MS|withinMs|askReport|storeAsk|recentSuggestedFor|ownWords|KeptContext|keptContext|ASK_ID_RE|answerClaim|staleAnswer|\/answer$|\/question$|\/context$|mappedSend|^MAP_|scrubProvider|upstreamKind|\/reach$/],
  ["2 requests", /worker\.js/, /Request|request|^prep|^PREP_|^stage|[hH]eld|^HELD_|^NEWER_|newerWorkSince|repeatNote|TaskLines|RequestTasks|requestTasksId|saidForRequest|runsForRequest|ttachment|STD_BASE64|newAttempt|offerRequestQuestions|replayPrepared|PURCHASE_READS|readJsonTried|finishGenerated|[pP]urchase|stepScopeOf|noteSeen|prepUse|lostOr|LOST_TO_OVERLAP|KEPT_CHANGE_NOTE|ADD_ONLY_FIELDS|ADD_EVIDENCE|hasLookField|[aA]skFiles|ASK_FILES|ask-files|actionRoom|[rR]oom|startNextInLine|partChecksFor|awaitingApproval|approveRequestPart/],
  ["3 first build", /worker\.js/, /BuildRow|buildRow|genBindingFor|writeBuildRecord|^BUILD_|BuildRun|RUN_WAIT_MAX|buildFireIdentity|recordRefire|deployGate|^defer|resendMessage|claimArgs|makePrepCtx|Answer$|ANSWER_INLINE_MAX|svcHeaders|PLACEHOLDER|[pP]laceholder|readGenResult|reportToken|frameFactsApi|chromeFor|planRoutes|pagesHopApi|GEN_CODE|MAX_GEN_REPORT|MODEL_HOP|FIRE_HOP|pagesCall|generateSitePages|^design|SITE_IMG_MODEL|genresult|genbeat|gencode|build-stop|\/builds$|\/build\/|\/import$|siteForChat|claimSiteSlug|MAX_SLUG_TRIES|freeSlugFor|siteNameTaken|userSiteProject|rememberSiteTitle|BuildMark|buildMark|diagnose|STILL_|BUILD_STAGE|watchBuildStage|^diag$|writeLateLine|buildChecks|inlineFailure|\/diagnoses$|localFrames/],
  ["5 containers", /worker\.js/, /[tT]urn|TURN_|[fF]ence|FENCE|unfence|sinceRead|mayWriteConfig|scriptStillOurs|SCRIPT_|RetiredNote|ScriptNote|retireOwnNotes|putSiteWorker|followPointer|noteBase|dispatchCreds|confirmFields|SITE_CPU_MS|SITE_SUBREQUESTS|siteLimits|[wW]riteBeside|WRITE_BESIDE|buildDeps|runningForSite|requestsMakingFor|REHEARSE_DEPS|SiteTicks|siteTickSlice|SITE_TICK|RESYNC|[rR]esync|dropSiteWorker|sealedBucketFor|ownBucket|siteAnswers|siteReadVars|forgetLegacyKeys|\/runtime$|LOST_BUILD_WINDOW_MS|readSchedule|pendingKey|reconcileLostBuilds|storeBuildResult|putSettlementMark|[rR]econcile|RECONCILE|rowReview|REVIEW_/],
  ["6 draft and publish", /worker\.js/, /[pP]ublication|siteDbFor|newTablesOf|withPanelFields|completeActivation|dropReplacingRecords|addressTaken|AliasRow|HeldAlias|standInFor|sealHeld|heldDeleteOr|[aA]lias|publicNameFor|addressOf|publicUrlFor|shareOriginFor|withShareHost|routeForHost|hostRoutes|_pointerCache|sitePointer|SOURCE_KEY|SiteSource|siteAssetFiles|_KEY$|Layout|[lL]andmark|GenAnswer|SiteParts|SiteKit|FOUNDATION_PATH_SET|foundationPaths|kitList|[pP]roject(Mirror|Blocked|Suspects|FileReader|Folder)|codeMirrorApi|pagesJson|partsJson|stateConfigText|sidecarOf|\/s\/|\/a\/|__gf\/route|\/source$|\/routes$|\/share$|[uU]nrecorded|UNRECORDED|configDeps|SiteConfig|patchConfigFenced|[oO]ffline|OFFLINE|runSiteRebuild|\/rebuild$|SITE_IDEM|storeOwnFile|R2_MIME/],
  ["7 site features", /worker\.js/, /siteDbConfigured|siteQuery|[cC]onn$|_connCache|SITE_CONN_TTL_MS|_dataLimiter|_PER_MIN$|[aA]nonToken|siteServiceBase|proxySiteService|[mM]igration|MIGRATION|endedEvidence|\/rows|\/notify$|\/verify$|\/security$|\/errors$|spamCheckOn|safeFetch|CHROME_UA|tooLargeBody|readCapped|^harden$|^CSP$|model3d|heldRefus|meteredBucket|siteOwnerBySlug|_ownerCache/],
  ["11 workspace and sync", /worker\.js/, /[cC]hatStore|CHAT_|keyNamesOnly|readChatPut|chatListMeta|chatProjectsOf|projectRows|chatSharedElsewhere|\/chat\/|\/list$|MAX_SITE_LIST/],
  ["8 credits", /worker\.js/, /useQuota|REVERSE_WHOLE|SITE_BUILD_FEE/],
  ["4 edits", /worker\.js/, /\/text$/],
  ["shared helpers", /worker\.js|builder\/site-worker\.mjs/, /\(file head\)|scriptNameFor|sha256hex|SUPABASE_|LOGGED_ERROR_CLASSES|errorClassForLog|handleRequest \(head\)|^route \/api\/$|^route \/api\/site\/$|readSiteMigrations|^PROJECT_PATH$|^HOME_PATH$|^SITE_LINK/],
  ["5 containers", /builder\/site-worker\.mjs/, /./],
  ["13 look and pictures", /builder\/site-qr\.mjs/, /./],
  [OUTR("accounts and sign-in"), /worker\.js/, /runAppLoginBackfill|siteAuthBase|_siteAuthBase|^UNAUTHED$|^authDown$/],
  [OUTR("domains and DNS"), /worker\.js/, /cfZoneId|cfHostname|zoneIds/],
  ["1 agent", /worker\.js/, /[sS]iteMap|closeOrphanQuestion/],
  ["6 draft and publish", /worker\.js/, /siteForHostname/],
  ["7 site features", /worker\.js/, /siteDataBase|_siteDataBase/],
  ["2 requests", /worker\.js/, /PARK_HOLD_S/],
  [OUTR("accounts and sign-in"), /worker\.js/, /AcctState|AcctPut/],
  [OUTR("phone-app builder"), /worker\.js/, /^appsOpen$|_appConnCache|bytesB64/],
  ["3 first build", /worker\.js/, /StoredSpec|REVISE_(DB|LOOK)_UNREADABLE_MSG|markSaved|rowLearnsSlug|keepBuildDone|withBuildLines/],
  ["2 requests", /worker\.js/, /keepPrepUse|readPrepTask|ROOM_KEEP_MS/],
  ["5 containers", /worker\.js/, /writesBeside|scriptPendingKey/],
  ["6 draft and publish", /worker\.js/, /^NO_ALIAS$/],
  ["7 site features", /worker\.js/, /ownDataRead/],
  // ── helpers with no feature of their own ────────────────────────────────
  ["shared helpers", /ttl-cache\.mjs|app-asset-cache\.mjs/, /./],
];

function units(file) {
  const L = readFileSync(file, "utf8").split("\n");
  const starts = [];
  L.forEach((l, i) => { if (/^(export )?(default )?(async )?function\*? ?[\w$]*\s*\(|^(export )?(const|let|var|class) [\w$]+/.test(l)) starts.push(i); });
  const out = [];
  const name = (l) => (/(?:function\*? ?|const |let |var |class )([\w$]+)/.exec(l) || [, "(top)"])[1];
  if (!starts.length || starts[0] > 0) out.push({ name: "(file head)", from: 1, to: (starts[0] || L.length) });
  starts.forEach((s, k) => out.push({ name: name(L[s]), from: s + 1, to: k + 1 < starts.length ? starts[k + 1] : L.length }));
  // worker.js's handleRequest: one unit per route it tests.
  if (file === "worker.js") {
    const i = out.findIndex((u) => u.name === "handleRequest");
    const h = out[i];
    const sub = [];
    // The owner block dispatches on short names (`if (ed) {`) matched earlier
    // (`const ed = url.pathname.match(/^\/api\/site\/…\/edit$/)`): map each back.
    const label = (re) => re.replace(/^\/\^/, "").replace(/\$?\/[a-z]*$/, "").replace(/\\\//g, "/").replace(/\((?:\?:)?[^()]*\)\??/g, "*").replace(/\[[^\]]*\]\{[^}]*\}/g, "*");
    const vars = {};
    for (let n = h.from; n < h.to; n++) { const v = /^\s+const (\w{1,8}) = url\.pathname\.match\((\/\^.*?\$?\/[a-z]*)\)/.exec(L[n]); if (v) vars[v[1]] = label(v[2]); }
    let cur = { name: "handleRequest (head)", from: h.from };
    for (let n = h.from; n < h.to; n++) {
      const lit = /^\s{4,14}(?:if|else if) \(.*?(?:url\.pathname|path)\s*(?:===|\.startsWith\()\s*["']([^"']{1,80})["']/.exec(L[n]);
      const rx = /^\s{4,14}(?:(?:if|else if) \(|const \w+ = ).*?(?:url\.pathname|path)\.match\((\/\^.*?\$?\/[a-z]*|[A-Z_]+)\)/.exec(L[n]);
      const dv = !lit && !rx ? /^\s{8,14}(?:if|else if) \((\w{1,8})(?: && [^)]*)?\) \{/.exec(L[n]) : null;
      const lab = lit ? lit[1] : rx ? label(rx[1]) : dv && vars[dv[1]] ? vars[dv[1]] : null;
      if (lab) { cur.to = n; sub.push(cur); cur = { name: "route " + lab, from: n + 1 }; }
    }
    cur.to = h.to; sub.push(cur);
    out.splice(i, 1, ...sub);
  }
  return out.filter((u) => u.to >= u.from);
}

function areaOf(file, unit) {
  for (const [area, fr, nr] of RULES) if (fr.test(file) && nr.test(unit)) return area;
  return null;
}

const mode = process.argv[2] || "check";
const LIST = process.argv[3] === "list";
const files = tracked.filter(inScope);
const map = { generated: "scripts/audit-coverage.mjs", files: {} };
let total = 0, un = 0;
const byArea = {};
for (const f of files) {
  const us = units(f).map((u) => ({ ...u, area: areaOf(f, u.name) }));
  map.files[f] = us;
  for (const u of us) {
    const n = u.to - u.from + 1;
    total += n;
    if (!u.area) un += n;
    (byArea[u.area || "UNASSIGNED"] ||= { units: 0, lines: 0 });
    byArea[u.area || "UNASSIGNED"].units++; byArea[u.area || "UNASSIGNED"].lines += n;
  }
}
console.log("files", files.length, "lines", total);
if (LIST) for (const [f, us] of Object.entries(map.files)) for (const u of us) if (!u.area) console.log("U", u.to - u.from + 1, f, u.name);
for (const [a, v] of Object.entries(byArea).sort()) console.log(String(v.lines).padStart(7), String(v.units).padStart(5), " ", a);
if (mode === "build") { writeFileSync(OUT, JSON.stringify(map, null, 0)); console.log("wrote", OUT); }
if (mode === "check") {
  if (un) { console.error("UNASSIGNED lines:", un); process.exit(1); }
  let stored = null; try { stored = readFileSync(OUT, "utf8"); } catch {}
  if (stored !== JSON.stringify(map, null, 0)) { console.error("the coverage map is stale: run build"); process.exit(1); }
  console.log("every line has one owner");
}
