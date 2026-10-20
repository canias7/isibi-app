# The emails to the DNS providers (2026-10-20)

One email for each provider that supports Domain Connect, from the list at https://www.domainconnect.org/dns-providers/ (read 2026-10-20). **The addresses were decoded from that page's protected markup; check each against the page before sending.** Fill in the bracketed parts, send from your own address, and tell me when one answers. Domain Chief lists no email: use its documentation page (https://aka.chief.app/domainconnect) or its site (https://domain.chief.app), and the IONOS email below works as a model.

Order: Cloudflare first (reportedly fast, and many small businesses use it), then IONOS, GoDaddy, NameSilo, Vercel, WordPress.com, Plesk, Glauca Digital.

---

## 1. Cloudflare

_Their docs ask for exactly the items in the list; reportedly fast._

**To:** domain-connect@cloudflare.com
**Subject:** Domain Connect onboarding: gofarther.dev / site

Hello Cloudflare team,

We'd like to ask you to enable our Domain Connect template for your customers.

Go Farther (https://gofarther.dev) is a website builder: a small business describes what it does, and we build and host its website. The template lets our customers point their own domain at the site we host for them in one step, instead of editing DNS records by hand.

The details:

- Template: providerId `gofarther.dev`, serviceId `site`
  https://github.com/Domain-Connect/Templates/blob/master/gofarther.dev.site.json
  (merged on 9 August 2026 in pull request #1543: https://github.com/Domain-Connect/Templates/pull/1543)
- Synchronous flow, signed: `syncPubKeyDomain` is `gofarther.dev`; the public key is the TXT record at `_dck1.gofarther.dev`
- Allowed redirect hosts (`syncRedirectDomain`): `gofarther.dev`, `www.gofarther.dev`
- Two groups, one applied per request:
  - `apex`: APEXCNAME at the bare domain, pointing to `%target%`
  - `www`: CNAME `www`, pointing to `%target%`
- `%target%` is our own serving hostname (`saas.gofarther.dev`, Cloudflare for SaaS); the customer never types it
- Logo: https://gofarther.dev/logo.svg (PNG: https://gofarther.dev/logo.png)

What your onboarding page asks for:

- Templates to onboard: the GitHub link above
- The record to query for `syncPubKeyDomain`: `_dck1.gofarther.dev` (TXT)
- Logo (SVG): https://gofarther.dev/logo.svg
- Default proxy status: **DNS only (not proxied)** for the CNAME and the apex record. They point at our Cloudflare for SaaS hostname, which handles the traffic and the certificate; proxying them on the customer's zone would get in its way.
- Test first: we'd be glad if you limited it to one account first. [Your Cloudflare account ID, or delete this line]

Is there anything else you need from us to switch it on?

Thank you,

[Your name]
Go Farther
[Your email]

---

## 2. IONOS

**To:** domain_connect_admin@domain.ionos.com
**Subject:** Domain Connect onboarding: gofarther.dev / site

Hello IONOS team,

We'd like to ask you to enable our Domain Connect template for your customers.

Go Farther (https://gofarther.dev) is a website builder: a small business describes what it does, and we build and host its website. The template lets our customers point their own domain at the site we host for them in one step, instead of editing DNS records by hand.

The details:

- Template: providerId `gofarther.dev`, serviceId `site`
  https://github.com/Domain-Connect/Templates/blob/master/gofarther.dev.site.json
  (merged on 9 August 2026 in pull request #1543: https://github.com/Domain-Connect/Templates/pull/1543)
- Synchronous flow, signed: `syncPubKeyDomain` is `gofarther.dev`; the public key is the TXT record at `_dck1.gofarther.dev`
- Allowed redirect hosts (`syncRedirectDomain`): `gofarther.dev`, `www.gofarther.dev`
- Two groups, one applied per request:
  - `apex`: APEXCNAME at the bare domain, pointing to `%target%`
  - `www`: CNAME `www`, pointing to `%target%`
- `%target%` is our own serving hostname (`saas.gofarther.dev`, Cloudflare for SaaS); the customer never types it
- Logo: https://gofarther.dev/logo.svg (PNG: https://gofarther.dev/logo.png)

Is there anything else you need from us to switch it on?

Thank you,

[Your name]
Go Farther
[Your email]

---

## 3. GoDaddy

_Reportedly onboards only through Entri; the email asks._

**To:** domainconnect@godaddy.com
**Subject:** Domain Connect onboarding: gofarther.dev / site

Hello GoDaddy team,

We'd like to ask you to enable our Domain Connect template for your customers.

Go Farther (https://gofarther.dev) is a website builder: a small business describes what it does, and we build and host its website. The template lets our customers point their own domain at the site we host for them in one step, instead of editing DNS records by hand.

The details:

- Template: providerId `gofarther.dev`, serviceId `site`
  https://github.com/Domain-Connect/Templates/blob/master/gofarther.dev.site.json
  (merged on 9 August 2026 in pull request #1543: https://github.com/Domain-Connect/Templates/pull/1543)
- Synchronous flow, signed: `syncPubKeyDomain` is `gofarther.dev`; the public key is the TXT record at `_dck1.gofarther.dev`
- Allowed redirect hosts (`syncRedirectDomain`): `gofarther.dev`, `www.gofarther.dev`
- Two groups, one applied per request:
  - `apex`: APEXCNAME at the bare domain, pointing to `%target%`
  - `www`: CNAME `www`, pointing to `%target%`
- `%target%` is our own serving hostname (`saas.gofarther.dev`, Cloudflare for SaaS); the customer never types it
- Logo: https://gofarther.dev/logo.svg (PNG: https://gofarther.dev/logo.png)

We understand some service providers are onboarded through partners. If that's your only route, could you tell us so? We'd rather work with you directly if possible.

Is there anything else you need from us to switch it on?

Thank you,

[Your name]
Go Farther
[Your email]

---

## 4. NameSilo

**To:** domainconnect@namesilo.com
**Subject:** Domain Connect onboarding: gofarther.dev / site

Hello NameSilo team,

We'd like to ask you to enable our Domain Connect template for your customers.

Go Farther (https://gofarther.dev) is a website builder: a small business describes what it does, and we build and host its website. The template lets our customers point their own domain at the site we host for them in one step, instead of editing DNS records by hand.

The details:

- Template: providerId `gofarther.dev`, serviceId `site`
  https://github.com/Domain-Connect/Templates/blob/master/gofarther.dev.site.json
  (merged on 9 August 2026 in pull request #1543: https://github.com/Domain-Connect/Templates/pull/1543)
- Synchronous flow, signed: `syncPubKeyDomain` is `gofarther.dev`; the public key is the TXT record at `_dck1.gofarther.dev`
- Allowed redirect hosts (`syncRedirectDomain`): `gofarther.dev`, `www.gofarther.dev`
- Two groups, one applied per request:
  - `apex`: APEXCNAME at the bare domain, pointing to `%target%`
  - `www`: CNAME `www`, pointing to `%target%`
- `%target%` is our own serving hostname (`saas.gofarther.dev`, Cloudflare for SaaS); the customer never types it
- Logo: https://gofarther.dev/logo.svg (PNG: https://gofarther.dev/logo.png)

Is there anything else you need from us to switch it on?

Thank you,

[Your name]
Go Farther
[Your email]

---

## 5. Vercel

_Docs: https://vercel.com/docs/domains/domain-connect_

**To:** domainconnect@vercel.com
**Subject:** Domain Connect onboarding: gofarther.dev / site

Hello Vercel team,

We'd like to ask you to enable our Domain Connect template for your customers.

Go Farther (https://gofarther.dev) is a website builder: a small business describes what it does, and we build and host its website. The template lets our customers point their own domain at the site we host for them in one step, instead of editing DNS records by hand.

The details:

- Template: providerId `gofarther.dev`, serviceId `site`
  https://github.com/Domain-Connect/Templates/blob/master/gofarther.dev.site.json
  (merged on 9 August 2026 in pull request #1543: https://github.com/Domain-Connect/Templates/pull/1543)
- Synchronous flow, signed: `syncPubKeyDomain` is `gofarther.dev`; the public key is the TXT record at `_dck1.gofarther.dev`
- Allowed redirect hosts (`syncRedirectDomain`): `gofarther.dev`, `www.gofarther.dev`
- Two groups, one applied per request:
  - `apex`: APEXCNAME at the bare domain, pointing to `%target%`
  - `www`: CNAME `www`, pointing to `%target%`
- `%target%` is our own serving hostname (`saas.gofarther.dev`, Cloudflare for SaaS); the customer never types it
- Logo: https://gofarther.dev/logo.svg (PNG: https://gofarther.dev/logo.png)

Is there anything else you need from us to switch it on?

Thank you,

[Your name]
Go Farther
[Your email]

---

## 6. WordPress.com

**To:** registrar@automattic.com
**Subject:** Domain Connect onboarding: gofarther.dev / site

Hello WordPress.com team,

We'd like to ask you to enable our Domain Connect template for your customers.

Go Farther (https://gofarther.dev) is a website builder: a small business describes what it does, and we build and host its website. The template lets our customers point their own domain at the site we host for them in one step, instead of editing DNS records by hand.

The details:

- Template: providerId `gofarther.dev`, serviceId `site`
  https://github.com/Domain-Connect/Templates/blob/master/gofarther.dev.site.json
  (merged on 9 August 2026 in pull request #1543: https://github.com/Domain-Connect/Templates/pull/1543)
- Synchronous flow, signed: `syncPubKeyDomain` is `gofarther.dev`; the public key is the TXT record at `_dck1.gofarther.dev`
- Allowed redirect hosts (`syncRedirectDomain`): `gofarther.dev`, `www.gofarther.dev`
- Two groups, one applied per request:
  - `apex`: APEXCNAME at the bare domain, pointing to `%target%`
  - `www`: CNAME `www`, pointing to `%target%`
- `%target%` is our own serving hostname (`saas.gofarther.dev`, Cloudflare for SaaS); the customer never types it
- Logo: https://gofarther.dev/logo.svg (PNG: https://gofarther.dev/logo.png)

Is there anything else you need from us to switch it on?

Thank you,

[Your name]
Go Farther
[Your email]

---

## 7. Plesk

_Plesk is hosting software, so this reaches the hosts that run it._

**To:** domainconnect@plesk.com
**Subject:** Domain Connect onboarding: gofarther.dev / site

Hello Plesk team,

We'd like to ask you to enable our Domain Connect template for your customers.

Go Farther (https://gofarther.dev) is a website builder: a small business describes what it does, and we build and host its website. The template lets our customers point their own domain at the site we host for them in one step, instead of editing DNS records by hand.

The details:

- Template: providerId `gofarther.dev`, serviceId `site`
  https://github.com/Domain-Connect/Templates/blob/master/gofarther.dev.site.json
  (merged on 9 August 2026 in pull request #1543: https://github.com/Domain-Connect/Templates/pull/1543)
- Synchronous flow, signed: `syncPubKeyDomain` is `gofarther.dev`; the public key is the TXT record at `_dck1.gofarther.dev`
- Allowed redirect hosts (`syncRedirectDomain`): `gofarther.dev`, `www.gofarther.dev`
- Two groups, one applied per request:
  - `apex`: APEXCNAME at the bare domain, pointing to `%target%`
  - `www`: CNAME `www`, pointing to `%target%`
- `%target%` is our own serving hostname (`saas.gofarther.dev`, Cloudflare for SaaS); the customer never types it
- Logo: https://gofarther.dev/logo.svg (PNG: https://gofarther.dev/logo.png)

Is there anything else you need from us to switch it on?

Thank you,

[Your name]
Go Farther
[Your email]

---

## 8. Glauca Digital

_A general inbox: worth saying Domain Connect in the first line (the subject does)._

**To:** hello@glauca.digital
**Subject:** Domain Connect onboarding: gofarther.dev / site

Hello Glauca Digital team,

We'd like to ask you to enable our Domain Connect template for your customers.

Go Farther (https://gofarther.dev) is a website builder: a small business describes what it does, and we build and host its website. The template lets our customers point their own domain at the site we host for them in one step, instead of editing DNS records by hand.

The details:

- Template: providerId `gofarther.dev`, serviceId `site`
  https://github.com/Domain-Connect/Templates/blob/master/gofarther.dev.site.json
  (merged on 9 August 2026 in pull request #1543: https://github.com/Domain-Connect/Templates/pull/1543)
- Synchronous flow, signed: `syncPubKeyDomain` is `gofarther.dev`; the public key is the TXT record at `_dck1.gofarther.dev`
- Allowed redirect hosts (`syncRedirectDomain`): `gofarther.dev`, `www.gofarther.dev`
- Two groups, one applied per request:
  - `apex`: APEXCNAME at the bare domain, pointing to `%target%`
  - `www`: CNAME `www`, pointing to `%target%`
- `%target%` is our own serving hostname (`saas.gofarther.dev`, Cloudflare for SaaS); the customer never types it
- Logo: https://gofarther.dev/logo.svg (PNG: https://gofarther.dev/logo.png)

Is there anything else you need from us to switch it on?

Thank you,

[Your name]
Go Farther
[Your email]
