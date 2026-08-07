# Domain Connect template

`gofarther.dev.site.json` is the template a DNS provider applies when an owner
presses **Set it up at &lt;provider&gt;** in Cloud → Domains.

## Validate it before touching anything else

`template.schema` is the upstream JSON Schema, vendored verbatim, and
`test/domain-connect-template.test.mjs` runs the template through it on every
`npm test`. **Do not edit the template without running that.** It is the only
thing here that catches a mistake before a third-party reviewer does, and it
already caught one that reasoning had missed — see the next section.

## Why it is two records, and why the apex one is not a CNAME

The template is the smallest thing that works, which is two records:

| group  | record      | host  | points to   |
| ------ | ----------- | ----- | ----------- |
| `apex` | `APEXCNAME` | —     | `%target%`  |
| `www`  | `CNAME`     | `www` | `%target%`  |

One apply touches ONE group; the Worker picks it from the hostname the owner
claimed. Both cannot be applied together, because a custom hostname has to be
registered with Cloudflare for SaaS before it will serve — pointing the other
name at us as a bonus would give the owner a certificate error on a domain they
never asked us to host.

**The first draft was a single CNAME at `@`, and it was invalid.** The reasoning
was that `hostRequired: false` plus `host: "@"` lets one record serve the apex
and `www` alike, with the apply URL's `host` parameter deciding. That reads
well and the schema refuses it: a template whose CNAME or NS sits at `@` (or
`""`) **must** declare `hostRequired: true` — which would have made a host
mandatory and put the bare domain permanently out of reach. The apex is the
case a small business asks for by name.

The standard's own answer is the `APEXCNAME` type: a record with no `host` at
all, which a provider implements with whatever its platform offers — ALIAS,
ANAME or CNAME flattening. That is precisely the thing an owner cannot easily
do by hand, so it is where one-click is worth the most.

**A subdomain that is neither the apex nor `www` gets no button.** Serving it
would need a CNAME at `@` again, which is the invalid shape. The panel says so
and shows the copyable record instead.

Everything else Cloudflare for SaaS needs to issue the certificate follows from
that record being in place — once the hostname resolves to us, Cloudflare can
complete domain-control validation over HTTP without the owner touching DNS
again. A template that also carried the ownership and ACME TXT records would
need their values as variables, would be re-reviewed by every provider whenever
Cloudflare changed a record name, and would show the owner three changes to
approve instead of one.

**One thing here is NOT yet measured against a live registration**, and it is the
sentence above: that Cloudflare falls back to HTTP validation once the CNAME
lands. The Worker currently asks for `ssl.method: "txt"` (chosen so a certificate
can be issued *before* DNS moves, which matters for a site migrating off an
existing host). If a real end-to-end run shows the TXT is still required after
the CNAME is applied, the fix is one of:

- switch the registration to `ssl.method: "http"`, which needs no TXT at all and
  costs the pre-migration certificate; or
- add the TXT records to this template as variables and re-submit it.

Do not assume which. Run one real domain through and look.

## The apply URL sends `groupId`, and no `host`

`applyUrl` in `site-domain-connect.mjs` names the group and omits `host`
entirely. Both halves matter. A blank `host` is a template variable with no
value — some providers reject the request and others apply at the apex, which
are the two worst outcomes to pick between silently. And `groupId` rides
INSIDE the signed query, so a link we signed cannot have its group swapped on
the way to the owner.

## `syncRedirectDomain` is a security control, not a convenience

It is the allow-list of hosts a provider will honour in `redirect_uri` when
sending the owner back. Without it — or with a wildcard — the apply URL becomes
an open redirect anybody can point anywhere, on the provider's domain, with our
template's name on it.

## The signing key

The template declares `syncPubKeyDomain: gofarther.dev`, so providers verify
every apply URL against a public key published in our own DNS. Two things have
to exist for the button to appear at all, and if either is missing the panel
falls back to the copyable records rather than offering a link that will be
refused:

1. **`DOMAIN_CONNECT_KEY`** in GitHub Actions secrets — the RSA private key,
   PKCS#8, base64, uploaded to the Worker on deploy. Nothing signs without it.
2. **A TXT record at `_dck1.gofarther.dev`** holding the PUBLIC half, in the
   form `p=<base64 DER>`. That label is `DC_KEY_ID` in `worker.js`.

Generate the pair with:

```sh
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out dc.pem
# the secret — paste this into GitHub Actions as DOMAIN_CONNECT_KEY
openssl pkcs8 -topk8 -nocrypt -in dc.pem -outform DER | base64 -w0
# the public half — publish as the TXT value, prefixed with `p=`
openssl rsa -in dc.pem -pubout -outform DER | base64 -w0
```

**Rotating means publishing a SECOND label** — `_dck2` and so on — and changing
`DC_KEY_ID`, never editing the existing record in place. Every link already in
somebody's browser was signed under the old key and stops verifying the moment
that record changes.

## Submitting it

**The PR itself cannot be opened from a Claude Code session here** — the GitHub
integration is scoped to `canias7/isibi-app`, so `fork_repository` answers
"repository not configured for this session" and `add_repo` for
`Domain-Connect/Templates` answers "requires approval". It has to be a human
action. To make it a short one, generate a prefilled new-file link:

```sh
python3 -c 'import urllib.parse;c=open("domain-connect/gofarther.dev.site.json").read();\
print("https://github.com/Domain-Connect/Templates/new/master?filename=gofarther.dev.site.json&value="+urllib.parse.quote(c))'
```

Opening that on GitHub creates the file at the repository root, forking
automatically for anyone without write access; "Propose new file" then opens the
PR with their template, which `PR.md` is written to be pasted into. Their default
branch is `master` — checked, not assumed, since `main` 404s.

Providers do not read this file from here. They ingest the community repository
at <https://github.com/Domain-Connect/Templates>, so it has to be merged there
before any provider will recognise `providers/gofarther.dev/services/site`.
Until then the apply URL is a 404 at their end — which is why the panel only
shows the button when discovery succeeds, so an owner never sees it point at
nothing.

Checked against that repository rather than remembered, and it corrected two
things:

- **The file goes in the repository ROOT**, named `providerId.serviceId.json` —
  so `gofarther.dev.site.json`, not under a `templates/` directory.
- **`syncPubKeyDomain` IS needed, and I had this backwards.** The JSON Schema
  does not require it, so the first draft left it out and set `warnPhishing`
  instead. Their PR checklist is explicit: it is *mandatory*, omitting it needs
  written justification or the PR is rejected, and `warnPhishing` must not
  appear alongside it. The two are the standard's two answers to the same
  problem and they are mutually exclusive.

  **The problem is real, which is the part worth understanding.** An apply URL
  is a plain GET. Unsigned, a stranger can build
  `…/providers/gofarther.dev/services/site/apply?domain=victim.com&target=evil.example`,
  send it to a GoDaddy customer, and the provider will offer to apply it —
  under our provider name, on their real domain. `warnPhishing` answers that by
  showing an interstitial on *every* apply, ours included, which makes our own
  legitimate flow look dangerous and still lets a determined click through. A
  signature answers it properly: a forged link does not verify and never
  reaches a consent screen.

Two things the submission requires beyond the file, and both are **done** —
`PR.md` in this directory is their template, filled in, ready to paste:

1. **Test it in the online editor** —
   <https://domainconnect.paulonet.eu/dc/free/templateedit> — and put the
   markdown link from the result into the PR. Mandatory, one apex run and one
   subdomain run. Both were run and both links are in `PR.md`; each was replayed
   afterwards to check it still renders the right records, because a link that
   has expired by the time a reviewer opens it is the same as no link.
   - `apex` → `sharpfadebarbers.com` `APEXCNAME` `saas.gofarther.dev` ttl 1800
   - `www` → `www.sharpfadebarbers.com` `CNAME` `saas.gofarther.dev` ttl 1800
2. **Use their PR template**, which GitHub loads automatically — `PR.md` follows
   it heading for heading, with the checklist points that need explaining rather
   than ticking written out underneath.

The editor is driven over plain HTTP (fetch the page for a `_csrf_token`, POST
the form back with `_template`, `_test_template=true`, `domain`, `group` and the
variables). Worth knowing, because a headless browser cannot reach it from a
container with no outbound browser egress and the form can.

`providerId` is `gofarther.dev`, a domain we control. The repo's own example
uses a non-domain id, so this is not strictly enforced — but a reviewer has
nothing else tying a template to whoever submitted it, and ours should be
checkable.
