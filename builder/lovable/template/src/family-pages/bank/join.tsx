// bank /join — the eligibility check and the documents, BEFORE any form.
//
// The common-bond rule means a credit union must refuse people who do not
// qualify, and an application form that collects a name and address before
// establishing that is a form designed to waste somebody's afternoon. So the
// check comes first, and the page names a better place to go when the answer
// is no — a referral costs us nothing and is the whole point of a movement.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { EligibilityCheck } from "@/components/ui/eligibility-check";
import { ChecklistDot } from "@/components/ui/checklist-dot";
import { ContactCard } from "@/components/ui/contact-card";
import { SectionHeader } from "@/components/ui/section-header";
import { Faq } from "@/components/ui/faq";

export const Route = createFileRoute("/join")({ component: P });

const ID = [
  { what: "Photo ID", detail: "Passport, driving licence, or a bus pass with a photograph. A provisional licence is fine." },
  { what: "Proof of address, last three months", detail: "A utility bill, council tax letter, bank statement or benefit letter. A mobile phone bill does not count and that catches people out." },
  { what: "National Insurance number", detail: "The card, a payslip or an HMRC letter. If you cannot find it, come anyway and we will work around it." },
  { what: "£5", detail: "Cash or card. This buys your share and makes you a member — it is not a fee and you get it back if you leave." },
];

function P() {
  return (
    <SiteChrome
      name="Sheffield Steel Credit Union"
      tagline="Whether you can join, and what to bring. Ten minutes at the counter."
      links={[
        { label: "Rates", href: "/" },
        { label: "Borrow", href: "/borrow" },
        { label: "Save", href: "/save" },
      ]}
      action={{ label: "Rates", href: "/" }}
    >
      <div className="mx-auto max-w-5xl px-6 py-14">
        <h1 className="text-4xl font-semibold tracking-tight text-balance">Joining</h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          Check this first. We are bound by a common-bond rule and must refuse anybody outside it,
          so a form that took your details before establishing this would be wasting your time on
          purpose.
        </p>

        <section className="mt-12">
          <div className="max-w-2xl">
            <EligibilityCheck
              criteria={[
                {
                  id: "where", label: "You live or work in a Sheffield postcode", met: true,
                  detail: "S1 to S36. That includes Stocksbridge, Chapeltown, Mosborough and Hillsborough. Working here counts even if you live in Rotherham or Barnsley.",
                },
                { id: "age", label: "You are 16 or over", met: true, detail: "Under 16s can hold a Junior Saver through an adult member." },
                {
                  id: "pay", label: "You can pay in at least £5 a month", met: true,
                  detail: "Standing order, payroll deduction with a participating employer, or cash at the counter. Missing a month is not a problem.",
                },
                { id: "id", label: "You have the documents below" },
              ]}
              indicative={false}
              alternative="Outside Sheffield? findyourcreditunion.co.uk will show your nearest one. We would much rather send you there than take an application we have to refuse."
              applyNote="There is no credit check to become a member, and joining does not appear on your credit file."
            />
          </div>
        </section>

        <section className="mt-14">
          <div className="grid items-start gap-10 lg:grid-cols-[1.15fr_1fr]">
            <div>
              <SectionHeader eyebrow="What to bring" title="Four things" />
              <ul className="mt-6 divide-y divide-border border-y border-border">
                {ID.map((d) => (
                  <li key={d.what} className="py-4">
                    <p className="font-medium">{d.what}</p>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{d.detail}</p>
                  </li>
                ))}
              </ul>
              <p className="mt-5 max-w-lg text-sm leading-relaxed text-muted-foreground">
                No photo ID at all is a common situation and not a refusal. Ring first and we will
                tell you what else works — a letter from a housing officer, a probation officer or
                a support worker is usually enough.
              </p>
            </div>
            <div className="space-y-6">
              <div className="rounded-xl border border-border p-6">
                <p className="text-sm font-medium">Where you are up to</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Most people arrive having done the first two of these without realising.
                </p>
                <div className="mt-4">
                  <ChecklistDot done={2} total={4} />
                </div>
              </div>
              <ContactCard
                address="41 Division Street, Sheffield S1 4GF"
                phone="0114 276 0104"
                email="hello@steelcu.coop"
                mapUrl="https://www.openstreetmap.org/search?query=Division%20Street%20Sheffield"
              />
              <p className="text-sm leading-relaxed text-muted-foreground">
                Counter open Monday to Friday 09:30–16:00, Saturday to 12:30. No appointment.
                There is a step at the door and a ramp round the side on Rockingham Lane.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-14">
          <SectionHeader title="Joining questions" />
          <div className="mt-6">
            <Faq
              items={[
                {
                  question: "Can I join online?",
                  answer:
                    "Not yet, and we would rather say so than run a form that ends in 'now visit a branch'. The counter takes about ten minutes and nobody has to book.",
                },
                {
                  question: "Does joining commit me to anything?",
                  answer:
                    "No. The £5 buys a share, the share can be withdrawn, and there is no monthly fee. Plenty of members hold five pounds and nothing else for years.",
                },
                {
                  question: "I have been bankrupt. Can I still join?",
                  answer:
                    "Yes. Membership is not credit and bankruptcy does not affect it. It may affect borrowing while an order is live, and we will talk that through with you properly.",
                },
                {
                  question: "What if I move out of Sheffield later?",
                  answer:
                    "You keep everything. The common bond applies when you join, not forever — members who moved to Chesterfield twenty years ago still save here.",
                },
              ]}
            />
          </div>
          <p className="mt-8 text-sm text-muted-foreground">
            <a className="underline underline-offset-4" href="/">All rates</a>
            {" · "}
            <a className="underline underline-offset-4" href="/save">Savings accounts</a>
            {" · "}
            <a className="underline underline-offset-4" href="/borrow">Borrowing</a>
          </p>
        </section>
      </div>
    </SiteChrome>
  );
}
