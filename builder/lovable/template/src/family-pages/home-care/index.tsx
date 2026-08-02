// home-care — VISITS-AND-RATES-FIRST: the hourly rate and the inspection
// rating, together, above anything about the company. A family arranging care
// is comparing an hourly figure and a CQC word, and neither is ever on the
// homepage.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { Faq } from "@/components/ui/faq";
import { InspectionRating } from "@/components/ui/inspection-rating";
import { RateCard } from "@/components/ui/rate-card";
import { SectionHeader } from "@/components/ui/section-header";
import { ServiceArea } from "@/components/ui/service-area";
import { TeamGrid } from "@/components/ui/team-grid";
import { Testimonial } from "@/components/ui/testimonial";
import { TrustStrip } from "@/components/ui/trust-strip";
export const Route = createFileRoute("/")({ component: P });
export const RATING = {
  body: "CQC",
  rating: "Good",
  when: "November 2024",
  reportUrl: "#",
  domains: [
    { name: "Safe", rating: "Good" },
    { name: "Effective", rating: "Good" },
    { name: "Caring", rating: "Outstanding" },
    { name: "Responsive", rating: "Good" },
    { name: "Well-led", rating: "Good" },
  ],
};
export const RATES = [
  { period: "30 minutes", units: 0.5, price: 16.5, more: [18.5, 24] },
  { period: "45 minutes", units: 0.75, price: 23, more: [26, 33] },
  { period: "An hour", units: 1, price: 29, more: [32.5, 42] },
  { period: "Two hours", units: 2, price: 56, more: [63, 82], note: "Cheaper per hour, and the visit people get the most out of" },
  { period: "A waking night, 10 hours", units: 10, price: 245, more: [265, 340] },
  { period: "Live-in, per week", units: 168, price: 1290, more: [1290, 1290], note: "One carer, resident. Priced per week, not per hour" },
];
function P() {
  return (
    <SiteChrome name="Loxley Home Care" tagline="Care at home in west Sheffield. Employed carers, CQC Good."
      links={[{ label: "What we do", href: "#/services" }, { label: "Arrange", href: "#/arrange" }, { label: "Rates", href: "#rates" }]}
      action={{ label: "Arrange an assessment", href: "#/arrange" }}>

      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">S6, S10, S11 · since 2009 · 61 carers, all employed</p>
          <h1 className="mt-3 max-w-3xl text-5xl font-semibold tracking-tight text-balance">
            £29 an hour, and CQC Good since 2016
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            The two things anybody arranging care is actually comparing, on the homepage, where they
            belong. Our carers are employed on £13.80 an hour with paid travel time — which is why
            you get the same two people rather than whoever the agency could find.
          </p>
          <div className="mt-10 grid items-start gap-10 lg:grid-cols-[1.2fr_1fr]">
            <div id="rates">
              <RateCard label="Visit length" unit="hour" bands={["Weekday", "Weekend", "Bank holiday"]} rates={RATES}
                caption="What a visit costs"
                note="No call-out charge, no minimum contract, and no charge for the assessment. A 30-minute visit is a real visit — it is enough for medication and a check, and not enough for personal care, which we will say rather than sell you one." />
            </div>
            <InspectionRating {...RATING} />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-14">
        <TrustStrip items={[
          { title: "Employed, not agency", description: "£13.80 an hour and paid travel time" },
          { title: "The same two carers", description: "Named, and you meet them first" },
          { title: "No minimum contract", description: "A week's notice, cancel by phone" },
        ]} />
      </section>

      <section className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <SectionHeader eyebrow="What a visit is" title="Down to the detail, because 'personal care' means nothing"
            description="This is the list a carer works from and it is agreed with you, not with us. Anything not on it goes on yours." />
          <div className="mt-8 grid gap-x-12 gap-y-8 md:grid-cols-2 lg:grid-cols-3">
            {[
              ["A morning call", ["Getting up and dressed", "Washing, shaving, hair", "Continence care", "Breakfast, made and sat with", "Medication, prompted or administered", "Curtains, kettle, post"]],
              ["A lunch call", ["A hot meal cooked, not reheated", "Sat with while it is eaten", "Washing up", "Medication", "A look at the fridge and what needs ordering"]],
              ["A teatime call", ["Tea made", "Medication", "Pad change or a trip to the loo", "Twenty minutes of company, which is the point of it"]],
              ["A bedtime call", ["Undressing and washing", "Night medication", "Settling, curtains, lights", "Making sure the phone is by the bed"]],
              ["A sitting service", ["Two to four hours", "Company, a walk, a game of cards", "So a family carer can go out", "Not a task list — that is the point"]],
              ["A waking night", ["Ten hours, awake throughout", "Repositioning, the loo, medication", "For somebody who cannot be left", "One carer, the same one where we can"]],
            ].map(([k, list]) => (
              <div key={k as string} className="border-t border-border pt-5">
                <h3 className="font-medium">{k as string}</h3>
                <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
                  {(list as string[]).map((l) => <li key={l}>{l}</li>)}
                </ul>
              </div>
            ))}
          </div>
          <a className="mt-8 inline-block text-sm font-medium underline underline-offset-4" href="#/services">Every kind of care, in full →</a>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid gap-12 lg:grid-cols-[1fr_1fr]">
          <div>
            <SectionHeader eyebrow="Where we go" title="Fifteen minutes across, on purpose"
              description="A carer spending forty minutes driving is a carer doing five visits a day instead of eight, and that comes out of somebody's wage and somebody else's call time." />
            <ServiceArea className="mt-6" placeholder="Your postcode"
              areas={["S6", "S10", "S11", "S3"]}
              note="Just outside? Ring. If it is between two people we already visit, the answer is usually yes." />
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <Testimonial item={{ quote: "The rates were on the site. Four agencies made me ring for a brochure and one of them still has not sent it.", name: "Bernard", role: "Arranging care for his wife" }} />
              <Testimonial item={{ quote: "Same two carers for three years. Mum calls them by name and they know where everything lives.", name: "Ceri", role: "Daughter, twice-daily calls" }} />
            </div>
          </div>
          <div>
            <SectionHeader eyebrow="Who comes" title="Sixty-one carers, all employed by us"
              description="Average time with us is four years. Sector turnover is around 28% a year; ours was 11% last year, and it is the number that decides whether you get the same face." />
            <TeamGrid className="mt-6" items={[
              { name: "Angela Dyson", role: "Registered manager, since 2009" },
              { name: "Foday Kamara", role: "Care coordinator" },
              { name: "Sinead Whelan", role: "Senior carer, 9 years" },
              { name: "Reena Patel", role: "Senior carer, dementia lead" },
            ]} />
            <Faq className="mt-8" items={[
              { question: "Will it be the same carer every time?", answer: "The same two, named, and you meet them before the first visit. On holidays and sickness it is a third you have also met — never somebody who turns up unannounced." },
              { question: "What about a 15-minute call?", answer: "We do not do them. You cannot wash and dress somebody in fifteen minutes and any agency selling one is selling you a visit that fails." },
              { question: "Can you do medication?", answer: "Prompting, administering from a blister pack, and applying creams. Insulin and anything invasive needs a district nurse and we will arrange the referral." },
              { question: "How quickly can you start?", answer: "Usually within a week, same day in a hospital discharge. The assessment is free and happens first, always." },
            ]} />
          </div>
        </div>
      </section>
    </SiteChrome>
  );
}
