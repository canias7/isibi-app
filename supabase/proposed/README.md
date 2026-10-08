# Proposed SQL — NOT APPLIED

Functions written on the branch and **not yet run against the live Supabase
project**. Applying one is a manual step that needs the owner's word, the
same way every file in `../applied/` was applied by hand. Once applied, the
file moves to `../applied/` under its remote version name, with the
pg_get_functiondef read-back beside it, as the rule there says.

The Worker code that calls a function here is written to **fall back to the
behaviour that ran before** while the function is absent: PostgREST answers
404 for a function it does not know, and that answer, and only that one, is
read as "not applied yet". Every other failure is a failure. A release that
carries the calling code before the SQL is applied therefore keeps the old
path, with its known gap, rather than breaking.

| File | What it adds | Why |
|---|---|---|
| `build_debit.sql` | `build_debit(p_id, p_uid, p_ref, p_amount, p_reason, p_partial, p_mint)` | A build's later debits (settle, pages) bill the build row's own account through the service role and the mint key, never the customer's access token, which can expire mid-build (the first-Build audit's H2) |

**`build_debit` at the job gateway** (2026-10-08, Codex's review of
`b4300a07`): a container-run build reaches `build_debit` through the job
gateway, which admits it only bound three ways — `p_id` is the job token's
own id, `p_uid` the token's own account, and `p_ref` exactly one of
`build:<id>:deposit`, `build:<id>:settle` or `build:<id>:pages` (never a
prefix). The gateway supplies the mint proof. The function's own row check
still applies once the SQL is in. **The SQL stays unapplied** until the
owner's word; until then the gateway forwards to a function PostgREST
answers 404 for, and the caller keeps the bearer's refusal as before.
