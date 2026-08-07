# Domain Connect template

`gofarther.dev.site.json` is the template a DNS provider applies when an owner
presses **Set it up at &lt;provider&gt;** in Cloud → Domains.

## Why it is one record

The template is deliberately the smallest thing that works: a single CNAME.

Everything else Cloudflare for SaaS needs to issue the certificate follows from
that CNAME being in place — once the hostname resolves to us, Cloudflare can
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

## `host` is `@`, and the apply URL supplies the rest

`hostRequired: false` with `host: "@"` means the template applies at whatever
the apply URL's `host` parameter names — the apex when it is absent, `www` when
it is `www`. That is why `applyUrl` in `site-domain-connect.mjs` OMITS an empty
host rather than sending it blank: blank, some providers reject the request and
others apply at the apex, which are the two worst outcomes to pick between
silently.

**A CNAME at a zone apex is not legal DNS**, and providers differ on what they do
with one — GoDaddy and IONOS flatten it, others refuse. An owner whose provider
refuses is not stuck: the panel still shows the copyable records and the note
telling them to use `www` and redirect the bare domain to it.

## `syncRedirectDomain` is a security control, not a convenience

It is the allow-list of hosts a provider will honour in `redirect_uri` when
sending the owner back. Without it — or with a wildcard — the apply URL becomes
an open redirect anybody can point anywhere, on the provider's domain, with our
template's name on it.

## Submitting it

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
- **`syncPubKeyDomain` is not needed here.** The repo README lists it as
  required "with limited exceptions"; the JSON Schema does not, and it is the
  domain hosting the public key that verifies SIGNED templates. The synchronous
  unsigned flow this uses needs no signature, which is the same property that
  means we hold no credential.

Two things the submission requires beyond the file:

1. **Test it in the online editor first** —
   <https://domainconnect.paulonet.eu/dc/free/templateedit> — and put the
   markdown link from the result into the PR. This is stated as mandatory.
2. **Use their PR template**, which GitHub loads automatically.

`providerId` is `gofarther.dev`, a domain we control. The repo's own example
uses a non-domain id, so this is not strictly enforced — but a reviewer has
nothing else tying a template to whoever submitted it, and ours should be
checkable.
