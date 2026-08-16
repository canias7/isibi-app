# Applied migrations

The SQL that has been run against the live Supabase project, kept here so it is
reviewable in a diff and re-appliable by hand.

**This is deliberately NOT `supabase/migrations/`.** Migrations on this project
have always been applied out of band, and the remote history holds ~84 of them
that were never committed anywhere. A `migrations/` folder containing a handful
of files would be a folder the Supabase CLI believes is the whole history — so
`db push` and `db reset` would be reading from something that is missing most of
it. A folder the CLI does not look at cannot mislead it.

So: applying a file here is a manual step, and the file is the record rather than
the mechanism. Name them `<remote version>_<name>.sql` to match the entry in the
remote history, so the two can be lined up.
