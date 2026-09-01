-- Applied 2026-09-01 as remote version 20260901110738.
--
-- Async edit jobs: state, lease, billing, and the deployment identity needed to
-- reconcile a job that died mid-publish.
--
-- SERVICE-ROLE ONLY. RLS on with NO policies, the posture edit_traces and
-- user_site_project already have: nothing reaches these rows except through the
-- SECURITY DEFINER functions in 20260901110952.
create table if not exists public.edit_jobs (
  id                  text primary key,
  uid                 uuid not null,
  slug                text not null,
  op                  text not null default 'edit',
  idem_key            text not null,

  state               text not null default 'queued',
  phase               text,
  billing             text not null default 'none',
  cost                numeric not null default 0,

  -- The lease. It governs WHO may act, never how long the consumer lives.
  lease_owner         text,
  lease_expires_at    timestamptz,
  heartbeat_at        timestamptz,

  -- publish_started_at is set the moment the FIRST publish operation begins and
  -- published_at only once the site Worker upload is confirmed. Everything
  -- between them is the window where nobody outside can tell whether the edit
  -- shipped, which is why it is never refunded automatically.
  publish_started_at  timestamptz,
  published_at        timestamptz,
  needs_review        boolean not null default false,
  review_note         text,

  -- DEPLOYMENT IDENTITY, so reconciliation is a comparison rather than a guess.
  -- artifact_build is the id baked into the site Worker script; the live site
  -- reports it back on every response as x-site-build, so "did the Worker commit
  -- occur" is answerable from outside.
  artifact_build      text,
  dist_etag           text,
  sidecar_etag        text,
  source_etag         text,
  worker_status       int,

  cancel_requested_at timestamptz,
  -- The customer-facing reply, exactly as the synchronous path returns it.
  result              jsonb,
  -- { kind, phase } and nothing else. There is deliberately nowhere here to put
  -- a provider message, a stack or a detail: the sanitization is the column set,
  -- not a habit at the call site. The diagnostic half goes to edit_traces.
  error               jsonb,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint edit_jobs_idem unique (uid, slug, op, idem_key),
  constraint edit_jobs_state_ck check (state in (
    'queued','claimed','routing','editing','building','verifying',
    'correcting','rebuilding','publishing','done','failed','cancelled','lost')),
  constraint edit_jobs_billing_ck check (billing in (
    'none','reserved','finalized','refunded','exempt'))
);

alter table public.edit_jobs enable row level security;

-- The stale sweep's own lookup.
create index if not exists edit_jobs_stale on public.edit_jobs (state, lease_expires_at);
-- A site under review blocks new edits, so this is read on every create.
create index if not exists edit_jobs_review on public.edit_jobs (slug) where needs_review;
create index if not exists edit_jobs_owner on public.edit_jobs (uid, created_at desc);

-- The spend ledger, which did not exist. public.credits is a balance with no
-- history; usage_log carries no amount; gen_charges is the media side. Until
-- now a debit left no row anywhere.
--
-- unique (ref, reason) IS THE IDEMPOTENCY KEY, and it is add_credits's own
-- proven pattern -- the clause that already stops a Stripe retry double-crediting.
create table if not exists public.credit_events (
  id            bigint generated always as identity primary key,
  uid           uuid not null,
  kind          text not null,
  ref           text not null,
  reason        text not null,
  delta         numeric not null,
  balance_after numeric not null,
  at            timestamptz not null default now(),
  constraint credit_events_once unique (ref, reason)
);

alter table public.credit_events enable row level security;
create index if not exists credit_events_owner on public.credit_events (uid, at desc);
