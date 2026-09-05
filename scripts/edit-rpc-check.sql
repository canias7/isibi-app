-- THE ASYNC EDIT PATH'S MONEY AND STATE, DRIVEN AGAINST THE REAL DATABASE.
--
-- ── HOW TO RUN IT ──────────────────────────────────────────────────────────
--
-- Paste the whole file into a SQL console on the live project (or hand it to
-- the Supabase MCP `execute_sql`). It ends with `raise exception`, so the
-- WHOLE THING ROLLS BACK — that is not tidiness, it is the only reason it is
-- safe to run against production: no job row, no ledger row and no balance
-- change survives it, and the log of every check comes back as the exception's
-- message.
--
-- ── WHY IT EXISTS ──────────────────────────────────────────────────────────
--
-- These are the properties the flag cannot be turned on without. Every one of
-- them is about money or about somebody's live site, and NOT ONE can be proved
-- by reading the SQL: `on conflict do nothing`, a conditional UPDATE and a row
-- lock all look correct at rest and only differ under a second caller. So the
-- functions are DRIVEN, in sequence, with the balance read between every step.
--
-- ── THE MINT KEY ───────────────────────────────────────────────────────────
--
-- Every RPC is gated on it and it cannot be recovered from its hash, so the
-- block swaps in one of its own. `private.mint` is a SINGLE-ROW table, so this
-- is an UPDATE rather than an insert; the real hash is captured first and put
-- back explicitly, on top of the rollback that the unconditional raise already
-- guarantees. Two independent reasons the production key cannot be lost is the
-- right number for the credential the Stripe webhook mints with.
DO $verify$
declare
  k text := 'verify-only-key-' || gen_random_uuid()::text;
  keep text;
  u uuid;
  slug text := 'zz-verify-' || substr(md5(random()::text),1,8);
  j1 text := 'e_'||substr(md5(random()::text),1,20);
  j2 text := 'e_'||substr(md5(random()::text),1,20);
  j3 text := 'e_'||substr(md5(random()::text),1,20);
  j4 text := 'e_'||substr(md5(random()::text),1,20);
  j5 text := 'e_'||substr(md5(random()::text),1,20);
  j6 text := 'e_'||substr(md5(random()::text),1,20);
  j7 text := 'e_'||substr(md5(random()::text),1,20);
  j8 text := 'e_'||substr(md5(random()::text),1,20);
  j9 text := 'e_'||substr(md5(random()::text),1,20);
  -- Section 18's three rows (stage 2a), one slug each so a parked one cannot
  -- block the next one's create.
  j10 text := 'e_'||substr(md5(random()::text),1,20);
  j11 text := 'e_'||substr(md5(random()::text),1,20);
  j12 text := 'e_'||substr(md5(random()::text),1,20);
  -- Section 19's three rows (stage 2c): two builds and one edit as the control.
  j13 text := 'e_'||substr(md5(random()::text),1,20);
  j14 text := 'e_'||substr(md5(random()::text),1,20);
  j15 text := 'e_'||substr(md5(random()::text),1,20);
  st text; bl text; nr boolean; note text; tr int; rs jsonb; own text; ts timestamptz;
  -- A gen_charges request id for sections 14b and 16b (the media side's charge
  -- record), rolled back with everything else.
  req text := 'zz-verify-' || substr(md5(random()::text),1,12);
  r jsonb; b0 numeric; b1 numeric; n int; log text := '';
  ok_count int := 0;
-- LAST RUN 2026-09-05 (stage 2c): ALL 113 CHECKS PASSED, rolled back, driving
-- as a funded non-founder account (balance 500). Section 19 was added that
-- evening for the build's row and its lease chain; on its own it went RED
-- against the OLD edit_create at FAIL 70 ("a build row is not billed
-- external, or not queued": `queued none`, taken back by the rollback), the
-- migration 20260905190147_build_rows_lease_chain was applied against that
-- baseline, and the section then passed 21 of 21 before the whole script ran
-- green. Its first green run tripped on plpgsql's own ambiguity - the block
-- declares `slug` and section 19 read the column by that bare name - fixed
-- by qualifying the column; nothing about the product.
--
-- EARLIER THAT DAY (stage 2a): ALL 92 CHECKS PASSED, rolled back, driving
-- as a funded non-founder account (balance 500). Section 18 was added that
-- evening for the sweep's recovery; on its own it went RED against the OLD
-- sweep at FAIL 65 ("the sweep re-picked a committed job instead of
-- finalizing it" - the live sweep answering {lost: 1, refunded: 0} for a
-- committed row, taken back by the rollback), the migration
-- 20260905175752_sweep_finalizes_committed was applied against that baseline,
-- and the section then passed 14 of 14 before the whole script ran green.
--
-- EARLIER THAT DAY (stage 1c): ALL 78 CHECKS PASSED, rolled back, driving
-- as a funded non-founder account (balance 500). Sections 14c and 17 were
-- added that day for credit_debit and credit_reverse, minutes after the
-- migration that made them; both went green on the first run.
--
-- EARLIER THAT DAY (stage 1b): ALL 65 CHECKS PASSED, rolled back. Sections 14b
-- and 16b were added then; the same script against the OLD credit_back stopped
-- at FAIL 48 ("credit_back paid a founder", 494 -> 496, taken back by the
-- rollback) - the red baseline the migration was then applied against, and
-- the second run went green the same hour.
--
-- RUN 2026-09-01 (late): ALL 48 CHECKS PASSED, rolled back. Section 15 was
-- added that evening and its first run caught FAIL 9b - a regression in my own
-- finalize migration, which had been rewritten from the applied folder's text
-- rather than the live definition. See the live snapshot beside the migrations.
--
-- EARLIER THAT DAY: ALL 32 CHECKS PASSED, rolled back, and it caught a real
-- defect on its first end-to-end run — `edit_reserve` declared a local named
-- `ref` and disambiguated it as `edit_reserve.ref`, which Postgres parses as a
-- TABLE reference:
--
--   ERROR 42P01: missing FROM-clause entry for table "edit_reserve"
--
-- Every call to it had raised since the sequenced version shipped. Nothing
-- caught it: the earlier driven checks ran against the previous signature and
-- no test since had called it. The alternative discovery route was the first
-- async edit, after a customer pressed the button.
begin
  select key_hash into keep from private.mint limit 1;
  update private.mint set key_hash = encode(extensions.digest(k,'sha256'),'hex');

  -- A REAL USER WITH A REAL BALANCE, chosen by having one rather than named:
  -- a hardcoded uuid is a second copy of a fact that lives in the database.
  select user_id into u from public.credits where balance >= 20
    and not exists (select 1 from private.founders f where f.user_id = credits.user_id)
    order by balance desc limit 1;
  if u is null then raise exception 'no funded non-founder account to drive the checks against'; end if;
  select balance into b0 from public.credits where user_id = u;
  log := log || format('driving as %s, balance %s%s', u, b0, chr(10));

  -- ── 1. DUPLICATE POST RETURNS THE ORIGINAL JOB ──────────────────────────
  r := public.edit_create(j1, u, slug, 'edit', 'idem-aaaaaaaaaaaaaaaa', k);
  if (r->>'ok') <> 'true' or (r->>'duplicate') <> 'false' then raise exception 'FAIL 1: %', r; end if;
  r := public.edit_create(j2, u, slug, 'edit', 'idem-aaaaaaaaaaaaaaaa', k);
  if (r->>'job') <> j1 or (r->>'duplicate') <> 'true' then raise exception 'FAIL 2 (a duplicate POST made a second job): %', r; end if;
  ok_count := ok_count + 2;
  log := log || format(' 1  duplicate POST      -> %s%s', r, chr(10));

  -- ── 2. A MALFORMED KEY IS REFUSED, NEVER GENERATED ──────────────────────
  r := public.edit_create(j2, u, slug||'-x', 'edit', 'short', k);
  if (r->>'error') <> 'bad-idem' then raise exception 'FAIL 3: %', r; end if;
  ok_count := ok_count + 1;

  -- ── 3. DUPLICATE QUEUE DELIVERY: ONE CLAIM WINS ─────────────────────────
  r := public.edit_claim(j1, 'ownerAAAA', 90, k);
  if (r->>'claimed') <> 'true' then raise exception 'FAIL 4 (first claim refused): %', r; end if;
  if (r->>'uid') <> u::text or (r->>'slug') <> slug then raise exception 'FAIL 4b (claim did not return identity): %', r; end if;
  r := public.edit_claim(j1, 'ownerBBBB', 90, k);
  if (r->>'claimed') <> 'false' or (r->>'error') <> 'leased' then raise exception 'FAIL 5 (a second delivery claimed a leased job): %', r; end if;
  ok_count := ok_count + 3;
  log := log || format(' 3  second delivery     -> %s%s', r, chr(10));

  -- ── 4. RESERVE IS SEQUENCED, IDEMPOTENT PER CHARGE, AND ACCUMULATES ─────
  r := public.edit_reserve(j1, 1, 3, k);
  select balance into b1 from public.credits where user_id = u;
  if (r->>'billing') <> 'reserved' or b1 <> b0 - 3 then raise exception 'FAIL 6: % bal %', r, b1; end if;
  r := public.edit_reserve(j1, 1, 3, k);
  select balance into b1 from public.credits where user_id = u;
  if (r->>'repeat') <> 'true' or b1 <> b0 - 3 then raise exception 'FAIL 7 (a replayed charge debited twice): % bal %', r, b1; end if;
  -- A SECOND RUNG IS A SECOND CHARGE, not a repeat. A single-shot reserve would
  -- silently under-charge every multi-lane edit.
  r := public.edit_reserve(j1, 2, 2, k);
  select balance into b1 from public.credits where user_id = u;
  if (r->>'cost')::numeric <> 5 or b1 <> b0 - 5 then raise exception 'FAIL 8 (a second rung did not charge): % bal %', r, b1; end if;
  select count(*) into n from public.credit_events where ref like j1 || '#%' and reason = 'reserve';
  if n <> 2 then raise exception 'FAIL 8b: % reserve ledger rows, expected 2', n; end if;
  ok_count := ok_count + 4;
  log := log || format(' 4  two rungs charged   -> %s  balance %s%s', r, b1, chr(10));

  -- ── 5. FINALIZE IS INTERLOCKED AGAINST PUBLICATION ──────────────────────
  r := public.edit_finalize(j1, '{"status":200}'::jsonb, k);
  if (r->>'error') <> 'not-published' then raise exception 'FAIL 9 (finalized an unpublished job): %', r; end if;
  -- AND THE REPLY IS STORED ANYWAY, so a customer polling a failed edit is told
  -- what happened instead of a bare status.
  if (select result from public.edit_jobs where id = j1) is null then
    raise exception 'FAIL 9b: finalize discarded the reply of an unpublished job';
  end if;
  ok_count := ok_count + 2;

  -- ── 6. A STALE CONSUMER CANNOT PUBLISH ──────────────────────────────────
  r := public.edit_may_publish(j1, 'ownerZZZZ', 300, k);
  if (r->>'granted') <> 'false' or (r->>'error') <> 'lease-lost' then raise exception 'FAIL 10: %', r; end if;
  -- AND NEITHER CAN ONE WHOSE LEASE SIMPLY EXPIRED.
  update public.edit_jobs set lease_expires_at = now() - interval '5 minutes' where id = j1;
  r := public.edit_may_publish(j1, 'ownerAAAA', 300, k);
  if (r->>'granted') <> 'false' or (r->>'error') <> 'lease-expired' then raise exception 'FAIL 11: %', r; end if;
  ok_count := ok_count + 2;
  log := log || format(' 6  stale publish       -> %s%s', r, chr(10));

  -- ── 7. THE HEARTBEAT RENEWS, AND DELIVERS A CANCEL ──────────────────────
  -- The expiry is put back first, because check 6 above deliberately aged it
  -- out — without this the heartbeat is being asked about a lease that is
  -- already gone, and its answer would say nothing about renewal.
  update public.edit_jobs set lease_expires_at = now() + interval '90 seconds' where id = j1;
  r := public.edit_beat(j1, 'ownerAAAA', 90, 'building', k);
  if (r->>'alive') <> 'true' or (r->>'cancel') <> 'false' then raise exception 'FAIL 12: %', r; end if;
  r := public.edit_beat(j1, 'ownerWRONG', 90, 'building', k);
  if (r->>'alive') <> 'false' then raise exception 'FAIL 13 (a stranger renewed the lease): %', r; end if;
  r := public.edit_cancel(j1, u, k);
  if (r->>'cancel') <> 'true' then raise exception 'FAIL 14: %', r; end if;
  r := public.edit_beat(j1, 'ownerAAAA', 90, 'building', k);
  if (r->>'cancel') <> 'true' then raise exception 'FAIL 15 (the heartbeat did not carry the cancel): %', r; end if;
  -- A CANCELLED JOB LOSES THE PUBLISH GATE.
  r := public.edit_may_publish(j1, 'ownerAAAA', 300, k);
  if (r->>'granted') <> 'false' or (r->>'error') <> 'cancelled' then raise exception 'FAIL 16: %', r; end if;
  ok_count := ok_count + 5;
  log := log || format(' 7  cancel via beat     -> %s%s', r, chr(10));

  -- ── 8. REFUND RETURNS EVERYTHING, EXACTLY ONCE ──────────────────────────
  r := public.edit_refund(j1, 'cancelled', 'verify', k);
  select balance into b1 from public.credits where user_id = u;
  if (r->>'refunded')::numeric <> 5 or b1 <> b0 then raise exception 'FAIL 17: % bal %', r, b1; end if;
  r := public.edit_refund(j1, 'cancelled', 'verify', k);
  select balance into b1 from public.credits where user_id = u;
  if b1 <> b0 then raise exception 'FAIL 18 (double refund): bal %', b1; end if;
  select count(*) into n from public.credit_events where ref = j1 and reason = 'refund';
  if n <> 1 then raise exception 'FAIL 18b: % refund rows', n; end if;
  ok_count := ok_count + 3;
  log := log || format(' 8  refund once         -> balance %s%s', b1, chr(10));

  -- ── 9. A JOB THAT DIED MID-PUBLISH IS NOT REFUNDED ──────────────────────
  r := public.edit_create(j3, u, slug, 'edit', 'idem-bbbbbbbbbbbbbbbb', k);
  r := public.edit_reserve(j3, 1, 2, k);
  r := public.edit_claim(j3, 'ownerCCCC', 90, k);
  r := public.edit_publish_mark(j3, 'ownerCCCC', 'build-xyz', null, null, null, null, k);
  r := public.edit_refund(j3, 'lost', 'lease expired', k);
  select balance into b1 from public.credits where user_id = u;
  if (r->>'error') <> 'needs-review' or b1 <> b0 - 2 then raise exception 'FAIL 19 (auto-refunded a mid-publish job): % bal %', r, b1; end if;
  ok_count := ok_count + 1;
  log := log || format(' 9  mid-publish loss    -> %s  balance %s%s', r, b1, chr(10));

  -- ── 10. THE SWEEP AGREES, AND COUNTS IT SEPARATELY ──────────────────────
  update public.edit_jobs set needs_review = false, state = 'publishing',
         lease_expires_at = now() - interval '10 minutes' where id = j3;
  r := public.edit_sweep_lost(20, 60, k);
  select balance into b1 from public.credits where user_id = u;
  if (r->>'review')::int < 1 or b1 <> b0 - 2 then raise exception 'FAIL 20 (the sweep refunded a publishing job): % bal %', r, b1; end if;
  ok_count := ok_count + 1;
  log := log || format('10  sweep              -> %s%s', r, chr(10));

  -- ── 11. A SITE UNDER REVIEW TAKES NO NEW EDITS ──────────────────────────
  r := public.edit_create(j4, u, slug, 'edit', 'idem-cccccccccccccccc', k);
  if (r->>'error') <> 'needs-review' then raise exception 'FAIL 21 (a site under review accepted an edit): %', r; end if;
  -- AND A CONSUMER CANNOT CLAIM ONE EITHER.
  r := public.edit_claim(j3, 'ownerDDDD', 90, k);
  if (r->>'claimed') <> 'false' then raise exception 'FAIL 22 (a job under review was claimed): %', r; end if;
  ok_count := ok_count + 2;

  -- ── 12. RECONCILIATION IS THE ONLY WAY OUT, AND TAKES A VERDICT ─────────
  r := public.edit_reconcile(j3, true, 'x-site-build matched', k);
  select balance into b1 from public.credits where user_id = u;
  if (r->>'outcome') <> 'kept' or b1 <> b0 - 2 then raise exception 'FAIL 23 (a committed edit was refunded): % bal %', r, b1; end if;
  -- Not in review any more, so the site takes edits again.
  r := public.edit_create(j4, u, slug, 'edit', 'idem-cccccccccccccccc', k);
  if (r->>'ok') <> 'true' then raise exception 'FAIL 24 (reconciliation did not unblock the site): %', r; end if;
  ok_count := ok_count + 2;
  log := log || format('12  reconcile(kept)    -> balance %s%s', b1, chr(10));

  -- ── 13. A PUBLISHED JOB CAN NEVER BE REFUNDED ───────────────────────────
  r := public.edit_refund(j3, 'failed', 'verify', k);
  if (r->>'error') <> 'published' then raise exception 'FAIL 25 (refunded a published edit): %', r; end if;
  ok_count := ok_count + 1;

  -- ── 13b. THE COMMIT POINT MAKES FINALIZE POSSIBLE AND REFUND IMPOSSIBLE ─
  --
  -- The pair of interlocks, driven rather than read. `published_at` is set by
  -- `edit_committed` and nowhere else, and it is what `edit_finalize` requires
  -- and `edit_refund` forbids — so these two calls are the whole reason a
  -- shipped edit can be charged for and a lost one cannot be charged twice.
  r := public.edit_reserve(j4, 1, 4, k);
  r := public.edit_claim(j4, 'ownerEEEE', 90, k);
  if (r->>'claimed') <> 'true' then raise exception 'FAIL 28 (could not claim j4): %', r; end if;
  r := public.edit_may_publish(j4, 'ownerEEEE', 300, k);
  if (r->>'granted') <> 'true' then raise exception 'FAIL 29 (publish gate refused a healthy job): %', r; end if;
  r := public.edit_committed(j4, 'ownerEEEE', 'build-abc', k);
  if (r->>'ok') <> 'true' then raise exception 'FAIL 30 (the commit point did not record): %', r; end if;
  -- A STRANGER CANNOT RECORD A COMMIT on somebody else's lease.
  r := public.edit_committed(j4, 'ownerWRONG', 'build-evil', k);
  if (r->>'ok') <> 'false' then raise exception 'FAIL 31 (a stranger recorded a commit): %', r; end if;
  r := public.edit_finalize(j4, '{"status":200}'::jsonb, k);
  if (r->>'ok') <> 'true' or (r->>'billing') <> 'finalized' then raise exception 'FAIL 32 (a published edit did not finalize): %', r; end if;
  r := public.edit_refund(j4, 'failed', 'verify', k);
  select balance into b1 from public.credits where user_id = u;
  if (r->>'error') <> 'published' then raise exception 'FAIL 33 (refunded a finalized edit): %', r; end if;
  ok_count := ok_count + 6;
  log := log || format('13b commit + finalize  -> balance %s%s', b1, chr(10));

  -- ── 13c. THE POLL READ IS OWNED, AND CARRIES NOTHING INTERNAL ───────────
  r := public.edit_get(j4, u, k);
  if (r->>'ok') <> 'true' or (r->>'state') <> 'done' then raise exception 'FAIL 34 (the owner could not read their own job): %', r; end if;
  -- NOT FOUND AND NOT YOURS ARE ONE ANSWER, so a job id cannot be probed.
  r := public.edit_get(j4, '00000000-0000-0000-0000-000000000000'::uuid, k);
  if (r->>'ok') <> 'false' or (r->>'error') <> 'no-job' then raise exception 'FAIL 35 (another user read a job): %', r; end if;
  -- AND THE ALLOW-LIST IS THE COLUMN SET. Anything internal appearing here is a
  -- leak on the one route a browser polls.
  r := public.edit_get(j4, u, k);
  for n in select 1 from jsonb_object_keys(r) key
    where key in ('uid','lease_owner','lease_expires_at','idem_key','secret','review_note','artifact_build')
  loop
    raise exception 'FAIL 36 (the poll read carries internal fields): %', r;
  end loop;
  ok_count := ok_count + 3;
  log := log || format('13c poll read          -> %s keys, owned%s', (select count(*) from jsonb_object_keys(r)), chr(10));

  -- ── 14. FOUNDER: NO DEBIT, AND A REFUND MINTS NOTHING ───────────────────
  insert into private.founders (user_id) values (u) on conflict do nothing;
  select balance into b0 from public.credits where user_id = u;
  r := public.edit_create(j5, u, slug||'-f', 'edit', 'idem-eeeeeeeeeeeeeeee', k);
  r := public.edit_reserve(j5, 1, 5, k);
  select balance into b1 from public.credits where user_id = u;
  if (r->>'billing') <> 'exempt' or b1 <> b0 then raise exception 'FAIL 26: % bal %', r, b1; end if;
  r := public.edit_refund(j5, 'failed', 'verify', k);
  select balance into b1 from public.credits where user_id = u;
  if (r->>'refunded')::numeric <> 0 or b1 <> b0 then raise exception 'FAIL 27 (MINTED CREDITS): % bal %', r, b1; end if;
  select count(*) into n from public.credit_events where ref like j5 || '%';
  if n <> 0 then raise exception 'FAIL 27b: a founder wrote % ledger rows', n; end if;
  ok_count := ok_count + 3;
  log := log || format('14  founder round trip -> balance %s, %s ledger rows%s', b1, n, chr(10));

  -- ── 14b. FOUNDER: THE TWO REFUND RPCS PAY NOTHING BACK (stage 1b, 2026-09-05) ─
  --
  -- use_credits answers the founder sentinel before any debit, and until stage
  -- 1b credit_back and refund_charge credited a founder like anyone else:
  -- credits created from nothing, unreachable only because the one founder
  -- had no credits row. The test user is STILL A FOUNDER here (section 14 made
  -- it one) and HAS a credits row, which is exactly the state that would have
  -- minted. Driven AS the founder: auth.uid() reads the request's jwt claims
  -- off a setting, so the block impersonates u for the rest of the
  -- transaction (both spellings, the old claim.sub and the claims json).
  perform set_config('request.jwt.claim.sub', u::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  select balance into b0 from public.credits where user_id = u;
  if public.use_credits(2) <> 1000000 then raise exception 'FAIL 47 (a founder was debited, or was not read as one)'; end if;
  select balance into b1 from public.credits where user_id = u;
  if b1 <> b0 then raise exception 'FAIL 47b (use_credits moved a founder''s balance): % -> %', b0, b1; end if;
  perform public.credit_back(u, 2);
  select balance into b1 from public.credits where user_id = u;
  if b1 <> b0 then raise exception 'FAIL 48 (credit_back paid a founder - MINTED CREDITS): % -> %', b0, b1; end if;
  insert into public.gen_charges (request_id, user_id, cost) values (req, u, 3);
  n := public.refund_charge(req, u);
  select balance into b1 from public.credits where user_id = u;
  if n <> 0 or b1 <> b0 then raise exception 'FAIL 49 (refund_charge paid a founder - MINTED CREDITS): returned % bal % -> %', n, b0, b1; end if;
  if (select refunded from public.gen_charges where request_id = req) then
    raise exception 'FAIL 49b (a founder''s charge row was marked refunded with nothing paid)';
  end if;
  ok_count := ok_count + 5;
  log := log || format('14b founder refunds    -> use_credits sentinel, credit_back and refund_charge paid 0, balance %s%s', b1, chr(10));

  -- ── 14c. FOUNDER: THE EXPLICIT DEBIT SAYS EXEMPT AND WRITES NOTHING (stage 1c) ─
  --
  -- credit_debit answers `exempt` for a founder with no debit and no row, and
  -- credit_reverse — which reads the debit row and never the account — finds
  -- nothing to give back. Still impersonating u, still a founder.
  r := public.credit_debit(3, req || ':f', 'debit', false);
  select balance into b1 from public.credits where user_id = u;
  if (r->>'exempt') <> 'true' or (r->>'taken')::numeric <> 0 or b1 <> b0 then
    raise exception 'FAIL 54 (credit_debit debited a founder, or did not say exempt): % bal % -> %', r, b0, b1;
  end if;
  if (select count(*) from public.credit_events where ref = req || ':f') <> 0 then
    raise exception 'FAIL 54b (a founder''s exempt debit wrote a ledger row)';
  end if;
  r := public.credit_reverse(u, req || ':f', 'refund', 3);
  select balance into b1 from public.credits where user_id = u;
  if (r->>'refunded')::numeric <> 0 or b1 <> b0 then
    raise exception 'FAIL 55 (credit_reverse paid a founder with no debit row - MINTED CREDITS): % bal % -> %', r, b0, b1;
  end if;
  ok_count := ok_count + 3;
  log := log || format('14c founder debit      -> exempt, no row, reverse 0, balance %s%s', b1, chr(10));

  -- ── 15. AN OK ANSWER THAT NEVER BEGAN PUBLISHING IS DONE, NOT LOST ─────
  --
  -- Found live 2026-09-01: "Your site already looks like that" answered ok with
  -- nothing to ship, finalize refused it, and the job fell to the lost sweeper
  -- and a refund ~150s later. The four-argument finalize takes the caller's
  -- word that the reply was an answer, and only when publishing never began.
  --
  -- SECTION 14 MADE THE TEST USER A FOUNDER; a founder's reserve is exempt and
  -- would make this section pass for the wrong reason. Undone here - the row was
  -- inserted by this transaction and rolls back with everything else.
  delete from private.founders where user_id = u;
  r := public.edit_create(j6, u, slug, 'edit', 'idem-dddddddddddddddd', k);
  r := public.edit_reserve(j6, 1, 2, k);
  select balance into b0 from public.credits where user_id = u;
  r := public.edit_finalize(j6, '{"status":200,"body":"{\"ok\":true,\"lookNote\":\"already\"}"}'::jsonb, true, k);
  select balance into b1 from public.credits where user_id = u;
  if (r->>'ok') <> 'true' or (r->>'billing') <> 'finalized' or (r->>'published') <> 'false'
    then raise exception 'FAIL 38 (an ok answer with nothing to publish did not finalize): %', r; end if;
  if b1 <> b0 then raise exception 'FAIL 38b (finalize moved money): % -> %', b0, b1; end if;
  if (select state from public.edit_jobs where id = j6) <> 'done' then raise exception 'FAIL 38c (not done)'; end if;
  -- AND IT IS TERMINAL FOR THE REFUND PATH TOO. `done` used to imply published;
  -- now it may not, and a refund that moved it to `failed` would contradict the
  -- stored reply on the same row.
  r := public.edit_refund(j6, 'failed', 'late', k);
  select balance into b1 from public.credits where user_id = u;
  if (r->>'error') <> 'terminal' or b1 <> b0 then raise exception 'FAIL 39 (refunded or moved a done job): % bal %', r, b1; end if;
  if (select state from public.edit_jobs where id = j6) <> 'done' then raise exception 'FAIL 39b (refund moved a done job off done)'; end if;
  -- THE WRAPPER IS THE OLD RULE. Three arguments means p_ok := false, and an
  -- unpublished job is still refused - FAIL 9 proves the same on j1.
  -- AND THE AMBIGUOUS CASE STAYS AMBIGUOUS: publishing began, did not finish,
  -- and the caller claims ok. Refused, then routed to review, money untouched.
  r := public.edit_create(j7, u, slug, 'edit', 'idem-eeeeeeeeeeeeeeee', k);
  r := public.edit_reserve(j7, 1, 2, k);
  r := public.edit_claim(j7, 'ownerGGGG', 90, k);
  r := public.edit_publish_mark(j7, 'ownerGGGG', 'build-7', null, null, null, null, k);
  select balance into b0 from public.credits where user_id = u;
  r := public.edit_finalize(j7, '{"status":200}'::jsonb, true, k);
  if (r->>'error') <> 'not-published' then raise exception 'FAIL 40 (finalized a job that began publishing and did not finish): %', r; end if;
  r := public.edit_refund(j7, 'failed', 'answered ok but publishing did not complete', k);
  select balance into b1 from public.credits where user_id = u;
  if (r->>'error') <> 'needs-review' or b1 <> b0 then raise exception 'FAIL 41 (a mid-publish ok answer was not sent to review): % bal %', r, b1; end if;
  ok_count := ok_count + 7;
  log := log || format('15  unpublished ok      -> done/finalized, refund refused, mid-publish -> review%s', chr(10));

  -- 16. A FREE RUNG IS EXEMPTED BEFORE THE GATE.
  --
  -- Found live 2026-09-02 (gap sweep run 10, the logo lane): a rung that makes
  -- no model call reserves nothing, so the job's billing stayed `none`, the gate
  -- answered `unbilled`, and a site the container had just built was refused.
  -- The consumer that holds the lease marks such a job exempt; a stranger
  -- cannot, and a job that has in fact reserved cannot be made free.
  -- ON ITS OWN SITE: section 15 leaves j7 under review, and a site under
  -- review takes no new edits (section 11) - so j8 on the same slug would
  -- never exist and every check after it would read `no-job`.
  r := public.edit_create(j8, u, slug||'-g', 'edit', 'idem-ffffffffffffffff', k);
  if (r->>'ok') <> 'true' then raise exception 'FAIL 42a (could not file the free job): %', r; end if;
  r := public.edit_claim(j8, 'ownerHHHH', 90, k);
  r := public.edit_may_publish(j8, 'ownerHHHH', 90, k);
  if (r->>'granted') <> 'false' or (r->>'error') <> 'unbilled' then raise exception 'FAIL 42 (an unbilled job was granted a publish): %', r; end if;
  r := public.edit_exempt(j8, 'ownerXXXX', k);
  if (r->>'error') <> 'lease-lost' then raise exception 'FAIL 43 (a stranger exempted the job): %', r; end if;
  select balance into b0 from public.credits where user_id = u;
  r := public.edit_exempt(j8, 'ownerHHHH', k);
  select balance into b1 from public.credits where user_id = u;
  if (r->>'ok') <> 'true' or (r->>'billing') <> 'exempt' or b1 <> b0 then raise exception 'FAIL 44 (exempt refused or moved money): % bal % -> %', r, b0, b1; end if;
  if (select count(*) from public.credit_events where ref like j8 || '%') <> 0 then raise exception 'FAIL 44b (exempt wrote a ledger row)'; end if;
  r := public.edit_may_publish(j8, 'ownerHHHH', 90, k);
  if (r->>'granted') <> 'true' then raise exception 'FAIL 45 (an exempt job was not granted a publish): %', r; end if;
  -- AND A BILLED JOB CANNOT BE EXEMPTED: money that moved is not free.
  r := public.edit_create(j9, u, slug||'-g', 'edit', 'idem-gggggggggggggggg', k);
  r := public.edit_reserve(j9, 1, 2, k);
  r := public.edit_claim(j9, 'ownerIIII', 90, k);
  r := public.edit_exempt(j9, 'ownerIIII', k);
  if (r->>'error') <> 'billed' then raise exception 'FAIL 46 (a reserved job was exempted): %', r; end if;
  if (select billing from public.edit_jobs where id = j9) <> 'reserved' then raise exception 'FAIL 46b (billing moved off reserved)'; end if;
  ok_count := ok_count + 7;
  log := log || format('16  free rung exempt    -> unbilled refused, stranger refused, exempt granted, billed refused%s', chr(10));

  -- ── 16b. THE SAME TWO RPCS STILL PAY A CUSTOMER BACK (the control for 14b) ─
  --
  -- Section 15 took u off the founders table, so this is the ordinary account:
  -- the guard refuses founders and nobody else, and a repeat refund of one
  -- charge is refused by the row's own flag. Without this half a guard that
  -- refused EVERYONE would pass 14b.
  perform set_config('request.jwt.claim.sub', u::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  select balance into b0 from public.credits where user_id = u;
  if public.use_credits(2) <> b0 - 2 then raise exception 'FAIL 50 (use_credits did not debit a customer, or read one as a founder)'; end if;
  perform public.credit_back(u, 2);
  select balance into b1 from public.credits where user_id = u;
  if b1 <> b0 then raise exception 'FAIL 51 (credit_back no longer pays a customer back): % -> %', b0, b1; end if;
  insert into public.gen_charges (request_id, user_id, cost) values (req || '-c', u, 3);
  n := public.refund_charge(req || '-c', u);
  select balance into b1 from public.credits where user_id = u;
  if n <> 3 or b1 <> b0 + 3 then raise exception 'FAIL 52 (refund_charge no longer pays a customer back): returned % bal % -> %', n, b0, b1; end if;
  if not (select refunded from public.gen_charges where request_id = req || '-c') then
    raise exception 'FAIL 52b (a paid refund did not mark its charge row)';
  end if;
  n := public.refund_charge(req || '-c', u);
  select balance into b1 from public.credits where user_id = u;
  if n <> 0 or b1 <> b0 + 3 then raise exception 'FAIL 53 (a charge was refunded twice): returned % bal %', n, b1; end if;
  ok_count := ok_count + 5;
  log := log || format('16b customer refunds   -> use_credits debited, credit_back and refund_charge paid, repeat refused%s', chr(10));

  -- ── 17. THE EXPLICIT DEBIT AND ITS REVERSAL, AS A CUSTOMER (stage 1c) ─────
  --
  -- The build route's new money path, driven end to end on one account: a
  -- debit that writes its row and says what it took; the same debit again
  -- answering `repeat` with `prior` and taking nothing; a bill the balance
  -- cannot cover refused whole, or taken in part when asked and said `short`;
  -- a reversal bounded by the debit less what was already given back; the
  -- same reversal again refused; another account's reversal of the ref
  -- answering 0. Still impersonating u, no longer a founder.
  select balance into b0 from public.credits where user_id = u;
  r := public.credit_debit(3, req || ':d', 'debit', false);
  select balance into b1 from public.credits where user_id = u;
  if (r->>'ok') <> 'true' or (r->>'taken')::numeric <> 3 or (r->>'exempt') <> 'false' or b1 <> b0 - 3 then
    raise exception 'FAIL 56 (credit_debit did not take the bill, or read a customer as exempt): % bal % -> %', r, b0, b1;
  end if;
  select count(*) into n from public.credit_events where ref = req || ':d' and reason = 'debit' and kind = 'build' and delta = -3;
  if n <> 1 then raise exception 'FAIL 56b (the debit did not write its row): % rows', n; end if;
  r := public.credit_debit(3, req || ':d', 'debit', false);
  select balance into b1 from public.credits where user_id = u;
  if (r->>'repeat') <> 'true' or (r->>'taken')::numeric <> 0 or (r->>'prior')::numeric <> 3 or b1 <> b0 - 3 then
    raise exception 'FAIL 57 (a retried debit charged again, or did not say what the first took): % bal %', r, b1;
  end if;
  r := public.credit_debit(b1 + 1000, req || ':big', 'debit', false);
  select balance into b1 from public.credits where user_id = u;
  if (r->>'ok') <> 'false' or (r->>'error') <> 'insufficient' or (r->>'taken')::numeric <> 0 or b1 <> b0 - 3 then
    raise exception 'FAIL 58 (a bill above the balance was not refused whole): % bal %', r, b1;
  end if;
  r := public.credit_debit(b1 + 1000, req || ':part', 'debit', true);
  select balance into b1 from public.credits where user_id = u;
  if (r->>'ok') <> 'true' or (r->>'short') <> 'true' or (r->>'taken')::numeric <> b0 - 3 or b1 <> 0 then
    raise exception 'FAIL 59 (a partial debit did not take what was there, or did not say short): % bal %', r, b1;
  end if;
  -- Put the partial back through its own reversal, which is also the proof
  -- that a reversal gives back exactly the debit and no more.
  r := public.credit_reverse(u, req || ':part', 'undo', 100000);
  select balance into b1 from public.credits where user_id = u;
  if (r->>'refunded')::numeric <> b0 - 3 or b1 <> b0 - 3 then
    raise exception 'FAIL 60 (a reversal was not bounded by the debit): % bal %', r, b1;
  end if;
  r := public.credit_reverse(u, req || ':d', 'settle', 1);
  select balance into b1 from public.credits where user_id = u;
  if (r->>'refunded')::numeric <> 1 or b1 <> b0 - 2 then raise exception 'FAIL 61 (a partial reversal did not give back 1): % bal %', r, b1; end if;
  r := public.credit_reverse(u, req || ':d', 'refund', 5);
  select balance into b1 from public.credits where user_id = u;
  if (r->>'refunded')::numeric <> 2 or b1 <> b0 then raise exception 'FAIL 62 (the second reversal was not bounded by the debit less the first): % bal %', r, b1; end if;
  r := public.credit_reverse(u, req || ':d', 'refund', 5);
  select balance into b1 from public.credits where user_id = u;
  if (r->>'repeat') <> 'true' or (r->>'refunded')::numeric <> 0 or b1 <> b0 then raise exception 'FAIL 63 (a retried reversal paid twice): % bal %', r, b1; end if;
  r := public.credit_reverse('00000000-0000-0000-0000-000000000000'::uuid, req || ':d', 'refund', 5);
  if (r->>'refunded')::numeric <> 0 or (r->>'debited')::numeric <> 0 then raise exception 'FAIL 64 (another account reversed a ref that is not its own): %', r; end if;
  select count(*) into n from public.credit_events where ref = req || ':d';
  if n <> 3 then raise exception 'FAIL 64b (expected the debit and its two reversals on the ledger, found %)', n; end if;
  ok_count := ok_count + 10;
  log := log || format('17  explicit debit      -> taken 3, repeat prior 3, refused, partial short, reversals 1+2 bounded, repeat 0, stranger 0, balance %s%s', b1, chr(10));

  -- ── 18. THE SWEEP SETTLES A COMMITTED JOB, AND PARKS ONE IT CANNOT (stage 2a) ─
  --
  -- A job that died after its commit point and before its finalize sat
  -- `publishing` with `published_at` set: the sweep's refund answered
  -- `published`, the sweep counted that as lost, changed nothing, and picked
  -- the row again every tick — one of twenty slots held for ever, and a
  -- browser polling a 202 with no bound. Now the sweep finalizes it with a
  -- reply the poll route can serve, counts every attempt, and parks a row it
  -- has tried five times in review, where a person settles it. One slug per
  -- row, because a parked row blocks new edits on its site (section 11).
  r := public.edit_create(j10, u, slug||'-s1', 'edit', 'idem-hhhhhhhhhhhhhhhh', k);
  if (r->>'ok') <> 'true' then raise exception 'FAIL 65a (could not file the committed job): %', r; end if;
  r := public.edit_reserve(j10, 1, 2, k);
  r := public.edit_claim(j10, 'ownerJJJJ', 90, k);
  r := public.edit_may_publish(j10, 'ownerJJJJ', 300, k);
  r := public.edit_committed(j10, 'ownerJJJJ', 'build-s1', k);
  if (r->>'ok') <> 'true' then raise exception 'FAIL 65b (the commit point did not record on j10): %', r; end if;
  -- The consumer dies here: no finalize, the lease runs out, the row is still
  -- `publishing`. A day past, so it sorts ahead of anything real in the batch.
  update public.edit_jobs set lease_expires_at = now() - interval '1 day' where id = j10;
  select balance into b0 from public.credits where user_id = u;
  r := public.edit_sweep_lost(20, 60, k);
  select balance into b1 from public.credits where user_id = u;
  if coalesce((r->>'recovered')::int, 0) < 1 then raise exception 'FAIL 65 (the sweep re-picked a committed job instead of finalizing it): %', r; end if;
  if b1 <> b0 then raise exception 'FAIL 65c (the sweep moved money on a published job): % -> %', b0, b1; end if;
  select state, billing, sweep_tries, result into st, bl, tr, rs from public.edit_jobs where id = j10;
  if st <> 'done' or bl <> 'finalized' then raise exception 'FAIL 65d (the recovered job is not done and finalized): % %', st, bl; end if;
  if tr <> 1 then raise exception 'FAIL 65e (the attempt was not counted once): %', tr; end if;
  -- THE REPLY IS ONE THE POLL ROUTE CAN SERVE: the consumer's own stored shape,
  -- {status, type, body} with the body as TEXT, saying the change went live
  -- and the details of what it did were lost.
  if coalesce((rs->>'status')::int, 0) <> 200 or (rs->>'body') is null
     or ((rs->>'body')::jsonb->>'ok') is distinct from 'true'
     or ((rs->>'body')::jsonb->>'recovered') is distinct from 'true'
  then raise exception 'FAIL 65f (the recovered reply is not one the poll route can serve): %', rs; end if;
  -- AND IT IS NOT PICKED AGAIN.
  r := public.edit_sweep_lost(20, 60, k);
  select sweep_tries into tr from public.edit_jobs where id = j10;
  if tr <> 1 then raise exception 'FAIL 66 (a finalized job was swept again): %', tr; end if;
  -- A ROW THE SWEEP HAS TRIED FIVE TIMES AND COULD NOT SETTLE IS PARKED. No
  -- answer the RPCs give today leaves a row in the batch after one tick, so
  -- the count is set by hand: five ticks have been at it. The money stays.
  r := public.edit_create(j11, u, slug||'-s2', 'edit', 'idem-iiiiiiiiiiiiiiii', k);
  r := public.edit_reserve(j11, 1, 2, k);
  r := public.edit_claim(j11, 'ownerKKKK', 90, k);
  update public.edit_jobs set sweep_tries = 5, state = 'editing', lease_expires_at = now() - interval '1 day' where id = j11;
  select balance into b0 from public.credits where user_id = u;
  r := public.edit_sweep_lost(20, 60, k);
  select balance into b1 from public.credits where user_id = u;
  if coalesce((r->>'exhausted')::int, 0) < 1 then raise exception 'FAIL 67 (a stuck row was not parked in review after five tries): %', r; end if;
  select needs_review, review_note, billing, sweep_tries into nr, note, bl, tr from public.edit_jobs where id = j11;
  if not nr or note is distinct from 'sweep exhausted' then raise exception 'FAIL 67b (the parked row is not in review with its note): % %', nr, note; end if;
  if b1 <> b0 or bl <> 'reserved' then raise exception 'FAIL 67c (parking moved money): % -> % billing %', b0, b1, bl; end if;
  -- PARKED MEANS OUT OF THE BATCH: another tick leaves it alone.
  r := public.edit_sweep_lost(20, 60, k);
  select sweep_tries into tr from public.edit_jobs where id = j11;
  if tr <> 5 then raise exception 'FAIL 67d (a parked row was swept again): %', tr; end if;
  -- AND A PERSON CAN STILL SETTLE IT, through the door every review row has.
  r := public.edit_reconcile(j11, false, 'never shipped', k);
  select balance into b1 from public.credits where user_id = u;
  if (r->>'outcome') <> 'refunded' or b1 <> b0 + 2 then raise exception 'FAIL 68 (a parked row could not be reconciled): % bal % -> %', r, b0, b1; end if;
  -- A ROW UNDER THE CEILING IS SETTLED, NOT PARKED: four tries, an expired
  -- lease, nothing published — lost and refunded as always, the fifth counted.
  r := public.edit_create(j12, u, slug||'-s3', 'edit', 'idem-jjjjjjjjjjjjjjjj', k);
  r := public.edit_reserve(j12, 1, 2, k);
  r := public.edit_claim(j12, 'ownerLLLL', 90, k);
  update public.edit_jobs set sweep_tries = 4, lease_expires_at = now() - interval '1 day' where id = j12;
  select balance into b0 from public.credits where user_id = u;
  r := public.edit_sweep_lost(20, 60, k);
  select balance into b1 from public.credits where user_id = u;
  select state, sweep_tries, needs_review into st, tr, nr from public.edit_jobs where id = j12;
  if st <> 'lost' or nr or tr <> 5 or b1 <> b0 + 2 then
    raise exception 'FAIL 69 (a row under the ceiling was parked instead of settled): % tries % review % bal % -> %', st, tr, nr, b0, b1;
  end if;
  ok_count := ok_count + 14;
  log := log || format('18  sweep recovery      -> committed job finalized (recovered), reply servable, not re-swept; stuck row parked after five, reconciled; under the ceiling settled%s', chr(10));

  -- ── 19. A BUILD'S ROW: ONE LEASE ALONG THE CHAIN (stage 2c) ─────────────────
  --
  -- A build files a row under op `build`, billed `external` because its money
  -- moves through the build's own ledger (credit_debit, stage 1c) and never a
  -- reserve here. The consumer claims it and beats; at fire time the lease is
  -- HANDED to the container that generates, for the generation bound; the
  -- container beats as its own name and its report RELEASES the lease (a
  -- short expiry, the owner kept); the collector takes it over by name; and
  -- the sweep leaves a live chain alone and ends a broken one with nothing
  -- moved. The placeholder slug is what a first build files under before the
  -- designer has named the site; the handoff sets the real one.
  r := public.edit_create(j13, u, 'build:'||j13, 'build', 'idem-kkkkkkkkkkkkkkkk', k);
  if (r->>'ok') <> 'true' then raise exception 'FAIL 70a (could not file the build row): %', r; end if;
  select state, billing into st, bl from public.edit_jobs where id = j13;
  if st <> 'queued' or bl <> 'external' then raise exception 'FAIL 70 (a build row is not billed external, or not queued): % %', st, bl; end if;
  -- THE CONTROL: an edit's row is still billed none, decided from its op.
  r := public.edit_create(j14, u, slug||'-s4', 'edit', 'idem-llllllllllllllll', k);
  select billing into bl from public.edit_jobs where id = j14;
  if bl <> 'none' then raise exception 'FAIL 70b (an edit row is no longer billed none): %', bl; end if;
  -- THE CONSUMER CLAIMS AND BEATS, exactly as it does for an edit.
  r := public.edit_claim(j13, 'consumerMMMM', 90, k);
  if (r->>'claimed') <> 'true' or (r->>'billing') <> 'external' then raise exception 'FAIL 71 (the consumer could not claim the build row): %', r; end if;
  r := public.edit_beat(j13, 'consumerMMMM', 90, 'design', k);
  if (r->>'alive') <> 'true' then raise exception 'FAIL 71b (the consumer''s beat on a build row is dead): %', r; end if;
  -- THE HANDOFF: to the container, for the generation bound, naming the slug.
  r := public.edit_handoff(j13, 'consumerMMMM', 'container:gen-1', 1800, 'generating', slug||'-b1', k);
  if (r->>'ok') <> 'true' then raise exception 'FAIL 72 (the handoff to the container was refused): %', r; end if;
  select state, lease_owner, lease_expires_at, edit_jobs.slug into st, own, ts, note from public.edit_jobs where id = j13;
  if st <> 'generating' or own <> 'container:gen-1' or note <> slug||'-b1' then raise exception 'FAIL 72b (the handoff did not move the lease, the state and the slug): % % %', st, own, note; end if;
  if ts < now() + interval '29 minutes' or ts > now() + interval '31 minutes' then raise exception 'FAIL 72c (the handoff expiry is not the generation bound): %', ts; end if;
  -- A STRANGER CANNOT MOVE IT, and the old holder's beat is dead.
  r := public.edit_handoff(j13, 'strangerNNNN', 'container:gen-9', 1800, 'generating', null, k);
  if (r->>'ok') <> 'false' or (r->>'error') <> 'not-holder' then raise exception 'FAIL 72d (a stranger moved the lease): %', r; end if;
  select lease_owner into own from public.edit_jobs where id = j13;
  if own <> 'container:gen-1' then raise exception 'FAIL 72d (a stranger moved the lease): owner %', own; end if;
  r := public.edit_beat(j13, 'consumerMMMM', 90, null, k);
  if (r->>'alive') <> 'false' then raise exception 'FAIL 72e (the old holder still renews a handed-off lease): %', r; end if;
  -- THE CONTAINER BEATS AS ITS OWN NAME, shortening the bound to its own TTL.
  r := public.edit_beat(j13, 'container:gen-1', 600, null, k);
  if (r->>'alive') <> 'true' or (r->>'state') <> 'generating' then raise exception 'FAIL 73 (the container''s beat is dead): %', r; end if;
  -- THE RELEASE: the report landed. The owner is kept, the expiry shortened,
  -- the state untouched.
  r := public.edit_handoff(j13, 'container:gen-1', null, 300, null, null, k);
  if (r->>'ok') <> 'true' then raise exception 'FAIL 74 (the release was refused): %', r; end if;
  select state, lease_owner, lease_expires_at into st, own, ts from public.edit_jobs where id = j13;
  if st <> 'generating' or own <> 'container:gen-1' or ts > now() + interval '6 minutes' or ts < now() + interval '4 minutes' then raise exception 'FAIL 74b (the release did not keep the owner and shorten the lease): % % %', st, own, ts; end if;
  -- THE COLLECTOR TAKES IT OVER BY NAME. A released lease is not yet expired,
  -- so a plain claim is refused as leased - the takeover is the mechanism.
  r := public.edit_claim(j13, 'resumeOOOO', 90, k);
  if (r->>'claimed') <> 'false' or (r->>'error') <> 'leased' then raise exception 'FAIL 75a (a released lease was claimed before it expired, or refused for another reason): %', r; end if;
  r := public.edit_handoff(j13, 'container:gen-1', 'resumeOOOO', 90, null, null, k);
  if (r->>'ok') <> 'true' then raise exception 'FAIL 75 (the collector could not take the lease over from the container): %', r; end if;
  -- THE SWEEP LEAVES A LIVE CHAIN ALONE.
  select balance into b0 from public.credits where user_id = u;
  r := public.edit_sweep_lost(20, 60, k);
  select state into st from public.edit_jobs where id = j13;
  if st <> 'generating' then raise exception 'FAIL 76 (the sweep took a build whose lease is live): % %', st, r; end if;
  -- AND ENDS A BROKEN ONE WITH NOTHING MOVED: the collector never came back.
  update public.edit_jobs set lease_expires_at = now() - interval '1 day' where id = j13;
  r := public.edit_sweep_lost(20, 60, k);
  select balance into b1 from public.credits where user_id = u;
  select state, billing into st, bl from public.edit_jobs where id = j13;
  if st <> 'lost' or bl <> 'external' or b1 <> b0 or coalesce((r->>'refunded')::numeric, 0) <> 0 then raise exception 'FAIL 77 (a lost build moved money, or was not marked lost): % % % -> % %', st, bl, b0, b1, r; end if;
  -- A LOST ROW STAYS LOST: a late finalize is refused.
  r := public.edit_finalize(j13, null, true, k);
  if (r->>'ok') <> 'false' then raise exception 'FAIL 77b (a lost build was finalized afterwards): %', r; end if;
  -- THE HAPPY CHAIN ENDS DONE, still billed external, money untouched.
  r := public.edit_create(j15, u, 'build:'||j15, 'build', 'idem-mmmmmmmmmmmmmmmm', k);
  r := public.edit_claim(j15, 'consumerPPPP', 90, k);
  r := public.edit_handoff(j15, 'consumerPPPP', 'container:gen-2', 1800, 'generating', slug||'-b2', k);
  r := public.edit_handoff(j15, 'container:gen-2', null, 300, null, null, k);
  r := public.edit_handoff(j15, 'container:gen-2', 'resumeQQQQ', 90, null, null, k);
  r := public.edit_finalize(j15, null, true, k);
  select balance into b1 from public.credits where user_id = u;
  select state, billing into st, bl from public.edit_jobs where id = j15;
  if (r->>'ok') <> 'true' or st <> 'done' or bl <> 'external' or b1 <> b0 then raise exception 'FAIL 78 (a finished build is not done and external with money untouched): % % % % -> %', r, st, bl, b0, b1; end if;
  -- THE TWO CONSTRAINTS ADMIT THE TWO NEW VALUES - asked of the catalogue,
  -- not inferred from the updates above having landed.
  select pg_get_constraintdef(oid) into note from pg_constraint where conrelid = 'public.edit_jobs'::regclass and conname = 'edit_jobs_state_ck';
  if note not like '%generating%' then raise exception 'FAIL 79 (the state constraint does not admit generating): %', note; end if;
  select pg_get_constraintdef(oid) into note from pg_constraint where conrelid = 'public.edit_jobs'::regclass and conname = 'edit_jobs_billing_ck';
  if note not like '%external%' then raise exception 'FAIL 79b (the billing constraint does not admit external): %', note; end if;
  ok_count := ok_count + 21;
  log := log || format('19  build lease chain   -> filed external, claimed, handed to the container for the bound, stranger refused, container beat, released, taken over by name, live chain kept, broken chain lost with nothing moved, happy chain done%s', chr(10));

  update private.mint set key_hash = keep;
  raise exception E'ALL % CHECKS PASSED (transaction rolled back)\n%', ok_count, log;
end
$verify$;
