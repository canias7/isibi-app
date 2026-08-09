// charity — DONATE-FIRST: the ask is the page and everything else is evidence
// that the money works. Regular giving is offered at the same weight as one-off,
// because that is what actually funds a charity.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { CtaBand } from "@/components/ui/cta-band";
import { DonationTiers } from "@/components/ui/donation-tiers";
import { Faq } from "@/components/ui/faq";
import { ImpactStats } from "@/components/ui/impact-stat";
import { SafeImage } from "@/components/ui/safe-image";
import { SectionHeader } from "@/components/ui/section-header";
import { Testimonial } from "@/components/ui/testimonial";
export const Route = createFileRoute("/")({ component: P });
function P() {
  return (
    <SiteChrome name="The Loxley Larder" tagline="A food bank and community kitchen in Walkley."
      links={[{ label: "Where it goes", href: "/impact" }, { label: "Give", href: "/donate" }, { label: "Volunteer", href: "#volunteer" }]}
      action={{ label: "Donate", href: "/donate" }}>

      <section className="border-b border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid items-start gap-12 lg:grid-cols-[1.05fr_1fr]">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Registered charity 1194732 · Walkley, Sheffield</p>
              <h1 className="mt-3 text-5xl font-semibold tracking-tight text-balance">£12 feeds a household for a week</h1>
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted-foreground">
                We are open four days a week and we have not turned anybody away since 2019. Referral is not
                required and never has been — if you are hungry you are eligible.
              </p>
              <div className="mt-8 grid grid-cols-2 gap-4">
                <SafeImage src={null} alt="Tuesday morning, before the doors open" ratio="4/3" />
                <SafeImage src={null} alt="The kitchen at the back" ratio="4/3" />
              </div>
            </div>
            <div className="rounded-xl border border-border bg-background p-6 shadow-sm">
              <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground">Give</p>
              <DonationTiers className="mt-4" defaultCadence="monthly"
                monthly={[
                  { amount: 5, buys: "A hot meal a week, every week" },
                  { amount: 12, buys: "A household fed weekly", suggested: true },
                  { amount: 25, buys: "Two households, and the fuel to deliver" },
                  { amount: 50, buys: "A week of the whole Tuesday session" },
                ]}
                oneOff={[
                  { amount: 12, buys: "One household, one week" },
                  { amount: 30, buys: "A delivery round to the flats" },
                  { amount: 75, buys: "A full Tuesday session", suggested: true },
                  { amount: 150, buys: "A month of the community kitchen" },
                ]} />
              <p className="mt-4 text-sm text-muted-foreground">
                No card details are stored by us. Gift Aid adds 25p to every pound if you pay UK tax.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <SectionHeader eyebrow="Last year" title="What the money did"
          description="Audited figures, published every January, and the full accounts are on the Commission's register." />
        <ImpactStats className="mt-10" items={[
          { value: "14,200", meaning: "Hot meals served, which is every weekday since March.", period: "2025", source: "Kitchen log" },
          { value: "3,180", meaning: "Food parcels, to 620 different households.", period: "2025", source: "Referral records" },
          { value: "£1.9m", meaning: "Of food redistributed that would otherwise have been thrown away.", period: "2025", source: "FareShare returns" },
          { value: "89p", meaning: "Of every pound goes on food, fuel and the building.", period: "2025", source: "Audited accounts" },
          { value: "1 in 4", meaning: "Households using us have someone in full-time work.", period: "2025", source: "Anonymous survey, n=214" },
          { value: "41", meaning: "Volunteers, of whom eleven first came as visitors.", period: "2025", source: "Rota" },
        ]} />
        <a className="mt-10 inline-block text-sm font-medium underline underline-offset-4" href="/impact">The whole picture, including what went wrong →</a>
      </section>

      <section className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <SectionHeader eyebrow="What we run" title="Four days a week" />
          <div className="mt-10 grid gap-8 md:grid-cols-3">
            {[
              ["The Tuesday parcel", "10–2, no referral, no questions. Around 90 households most weeks and more in the last week of the month."],
              ["The community kitchen", "Wednesday and Friday, 12–2. A cooked meal, eaten at a table with other people, which is half the point."],
              ["Deliveries", "Thursday, to the flats and to anybody who cannot get here. Eleven rounds, all volunteer-driven."],
            ].map(([t, d]) => (
              <div key={t} className="border-t border-border pt-6">
                <h3 className="text-lg font-medium">{t}</h3>
                <p className="mt-2 text-base leading-relaxed text-muted-foreground">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="volunteer" className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-12 lg:grid-cols-2">
          <div>
            <SectionHeader eyebrow="Other ways" title="Money is not the only thing" />
            <div className="mt-6 space-y-4 text-base leading-relaxed text-muted-foreground">
              <p>
                <strong className="font-medium text-foreground">Time.</strong> Two hours on a Tuesday is the
                single most useful thing anybody gives us. No experience, no interview, turn up at ten.
              </p>
              <p>
                <strong className="font-medium text-foreground">Food.</strong> Tinned fish, UHT milk and
                nappies are what we run out of. Please not baked beans — we have four pallets.
              </p>
              <p>
                <strong className="font-medium text-foreground">A van.</strong> Thursday mornings, three
                hours. If you have one and a spare morning, that is a whole delivery round.
              </p>
            </div>
          </div>
          <div className="space-y-6">
            <Testimonial item={{ quote: "I came for a parcel in the January after I lost the job. I have run the Tuesday rota for two years now.", name: "Denise", role: "Volunteer, and before that not" }} />
            <Faq items={[
              { question: "Do I need a referral?", answer: "No. Some food banks require one and we have never done it. Turn up on a Tuesday between 10 and 2." },
              { question: "How much of my money reaches the food?", answer: "89p in the pound. The rest is the van, the gas bill and the insurance. There are no salaries." },
              { question: "Can I give food instead?", answer: "Yes, and the shortage list above is honest — it changes and we update it." },
            ]} />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <CtaBand title="£12 a month, and a household eats every week"
          description="Standing orders are what let us plan. One-off gifts are what get us through a bad January. Both help."
          action={{ label: "Set up a monthly gift", href: "/donate" }} />
      </section>
    </SiteChrome>
  );
}
