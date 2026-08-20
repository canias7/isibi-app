// housing-association /tenancy — rent, arrears help, and complaining, on one
// page with equal weight.
//
// THE ARREARS SECTION LEADS WITH "RING US" AND NOT WITH A THREAT. Every
// eviction in social housing begins with somebody not opening a letter, and
// every letter that opens with "legal action may be taken" guarantees the next
// one is not opened either. The useful sentence is that an arrangement being
// kept to has never ended in a possession order here.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { ArrearsNote } from "@/components/ui/arrears-note";
import { ContactCard } from "@/components/ui/contact-card";
import { SectionHeader } from "@/components/ui/section-header";
import { Faq } from "@/components/ui/faq";

export const Route = createFileRoute("/tenancy")({ component: P });

const PAY = [
  { how: "Direct debit", detail: "Any date in the month, changed by a phone call. Nine in ten tenants use it and it is the only method where a mistake is ours to fix." },
  { how: "Standing order", detail: "You control it, which suits people whose income varies. Reference is your tenancy number — without it the payment sits unallocated." },
  { how: "Online card payment", detail: "Any hour, on the portal. No fee." },
  { how: "PayPoint or the Post Office", detail: "With your rent card. Free, and the only method that works with cash." },
  { how: "Housing Benefit or Universal Credit direct", detail: "Paid to us straight from the DWP. Ask us to set it up — it is called an APA and a lot of people do not know it exists." },
];

const COMPLAIN = [
  { n: "1", what: "Tell us, however you like", detail: "Phone, email, in person, or through a friend or a councillor. It does not have to say the word 'complaint' and we will treat it as one regardless." },
  { n: "2", what: "Stage one — ten working days", detail: "A named person who was not involved looks at it and writes to you with a decision and what we will do." },
  { n: "3", what: "Stage two — twenty working days", detail: "If you are not satisfied, a director reviews it. You do not have to justify escalating and we may not ask you to." },
  { n: "4", what: "The Housing Ombudsman", detail: "Free and independent. You can go to them at ANY point, including before speaking to us — the old eight-week wait was abolished and we will not pretend otherwise." },
];

function P() {
  return (
    <SiteChrome
      name="Loxley Valley Housing"
      tagline="Rent, arrears, tenancy changes, and how to complain."
      links={[
        { label: "Home", href: "/" },
        { label: "Repairs", href: "/repairs" },
      ]}
      action={{ label: "Out of hours: 0114 288 6199", href: "tel:01142886199" }}
    >
      <div className="mx-auto max-w-5xl px-6 py-14">
        <h1 className="text-4xl font-semibold tracking-tight text-balance">Rent and tenancy</h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          Rent is due weekly in advance, on a Monday. Five ways to pay it, real help if you cannot,
          and a complaints route that is not hidden at the bottom of a policy document.
        </p>

        <section className="mt-12">
          <SectionHeader eyebrow="Paying" title="Five ways" />
          <ul className="mt-6 divide-y divide-border border-y border-border">
            {PAY.map((p) => (
              <li key={p.how} className="grid gap-1 py-4 md:grid-cols-[minmax(0,16rem)_1fr] md:gap-8">
                <p className="font-medium">{p.how}</p>
                <p className="text-sm leading-relaxed text-muted-foreground">{p.detail}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-14">
          <div className="grid items-start gap-10 lg:grid-cols-[1fr_1fr]">
            <div>
              <SectionHeader
                eyebrow="If you are behind"
                title="Ring us. That sentence is the whole policy."
                description="Nobody at this association has ever been evicted for arrears while an arrangement was being kept to. It is not a promise we can make in a tenancy agreement, but it is what the record says."
              />
              <p className="mt-5 max-w-lg leading-relaxed text-muted-foreground">
                Our money advice team is free, is not a debt collector, and will check your benefits
                as the first thing they do. About a third of the households they see are entitled to
                something they were not claiming.
              </p>
              <p className="mt-4 max-w-lg text-sm leading-relaxed text-muted-foreground">
                A Discretionary Housing Payment from the council can cover a shortfall for months and
                is applied for in one form. We do it with you.
              </p>
            </div>
            <ArrearsNote
              amount={412.5}
              missedPayments={3}
              arrangement="£15 a week on top of the rent, agreed 12 July"
              arrangementKeptTo
              contact="0114 288 6140 — the money advice team, direct"
              helpNote="An arrangement being kept to stops all recovery action, full stop. If the amount stops being affordable, ring before missing one rather than after."
            />
          </div>
        </section>

        <section className="mt-14">
          <SectionHeader
            eyebrow="Complaining"
            title="Four steps, and you can skip to the fourth"
            description="Given the same weight as everything else on this site. A complaints process a tenant cannot find is the reason the Housing Ombudsman has a backlog."
          />
          <ol className="mt-6 divide-y divide-border border-y border-border">
            {COMPLAIN.map((c) => (
              <li key={c.n} className="flex gap-5 py-5">
                <span className="w-6 shrink-0 text-sm font-semibold tabular-nums text-muted-foreground">{c.n}</span>
                <div className="min-w-0">
                  <p className="font-medium">{c.what}</p>
                  <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">{c.detail}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-6 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            We publish every complaint outcome in the annual report, including the eleven the
            Ombudsman found against us last year and what changed as a result.
          </p>
        </section>

        <section className="mt-14">
          <div className="grid items-start gap-10 md:grid-cols-[1.2fr_1fr]">
            <div>
              <SectionHeader title="Tenancy questions" />
              <div className="mt-6">
                <Faq
                  items={[
                    {
                      question: "How do I end my tenancy?",
                      answer:
                        "Four weeks' written notice, ending on a Monday. The home must be cleared and clean, keys back by noon. We will do a pre-inspection first and tell you what would be charged for, so nothing is a surprise.",
                    },
                    {
                      question: "Can I add my partner to the tenancy?",
                      answer:
                        "After twelve months of them living there, usually yes. It matters a great deal for succession if something happens to you, and it is worth doing rather than leaving.",
                    },
                    {
                      question: "What happens to the tenancy if I die?",
                      answer:
                        "A spouse or partner living there has a statutory right to succeed once. Other family members may, depending on the tenancy type. It is worth asking us now rather than leaving your family to find out.",
                    },
                    {
                      question: "Can I sublet or take a lodger?",
                      answer:
                        "A lodger, with written permission, usually granted. Subletting the whole home is not permitted under any circumstances and is grounds for possession — it is the one absolute rule here.",
                    },
                    {
                      question: "My neighbour is causing problems.",
                      answer:
                        "Report it, including anonymously. Noise, harassment and drug activity are all taken seriously. Keep a diary of dates and times — it is what makes action possible and it is the thing people wish they had started sooner.",
                    },
                  ]}
                />
              </div>
            </div>
            <ContactCard
              address="Rivelin Works, Holme Lane, Sheffield S6 4JQ"
              phone="0114 288 6100"
              email="hello@loxleyvalleyhousing.org.uk"
            />
          </div>
        </section>

        <p className="mt-12 text-sm text-muted-foreground">
          <a className="underline underline-offset-4" href="/">The four doors</a>
          {" · "}
          <a className="underline underline-offset-4" href="/repairs">Repairs</a>
        </p>
      </div>
    </SiteChrome>
  );
}
