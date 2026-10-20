# Asking each DNS provider to switch the template on (2026-10-20)

**Where it stands.** The template is merged in the community repository
(Domain-Connect/Templates#1543, 2026-08-09), byte for byte the same as
`gofarther.dev.site.json`. The public key at `_dck1.gofarther.dev` matches
`dck1.pub`. But on 2026-10-20, ten weeks after the merge, GoDaddy and IONOS
still answered 404 for `providers/gofarther.dev/services/site` (both answered
200 for the long-standing example template, so their endpoints work). A merge
is not an activation: each provider switches templates on under its own policy,
and asks to be contacted. So the one-click button still leads nowhere for every
owner.

**Check again** (no sign-in, free):

```sh
for u in https://domainconnect.api.godaddy.com https://api.domainconnect.ionos.com; do
  curl -s -o /dev/null -w "%{http_code} $u\n" "$u/v2/domainTemplates/providers/gofarther.dev/services/site"; done
```

Cloudflare's endpoint answers 404 even for the example template, so this check
says nothing about Cloudflare; ask them instead.

## The emails (to send from the owner's address; nothing here is sent by the app)

| Provider | Where | Note |
|---|---|---|
| Cloudflare | Domain Connect onboarding: see developers.cloudflare.com/dns/reference/domain-connect | One developer reported approval within minutes of contacting them. |
| IONOS | domain_connect_admin@domain.ionos.com | No published turnaround. |
| GoDaddy | domainconnect@godaddy.com | Reported elsewhere to onboard only through Entri (a paid broker); ask anyway. |

**Subject:** Domain Connect onboarding: gofarther.dev / site

> Hello,
>
> We'd like to ask you to enable our Domain Connect template for your
> customers. It was merged into the community repository on 9 August 2026
> (Domain-Connect/Templates pull request #1543):
>
> - providerId: `gofarther.dev`, serviceId: `site` (file `gofarther.dev.site.json`)
> - Synchronous flow, signed: `syncPubKeyDomain` is `gofarther.dev`, public key at `_dck1.gofarther.dev`
> - `syncRedirectDomain`: `gofarther.dev, www.gofarther.dev`
> - Two groups, one applied per request: `apex` (APEXCNAME to `%target%`) and `www` (CNAME `www` to `%target%`)
>
> Go Farther (https://gofarther.dev) is a website builder. The template points
> a customer's domain at the hostname their site is served from (through
> Cloudflare for SaaS), so they can connect it without editing DNS by hand.
>
> Is there anything else you need from us to switch it on?
>
> Thank you,
> Go Farther
