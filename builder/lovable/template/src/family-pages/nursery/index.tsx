// nursery — SESSIONS-FIRST: ages, hours, fees and whether there is a place,
// before a single word about the setting's philosophy. A parent looking at
// nursery websites is doing arithmetic, and every one of these sites makes them
// do it themselves. The fee table does it for them.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { CtaBand } from "@/components/ui/cta-band";
import { Faq } from "@/components/ui/faq";
import { FeeTable } from "@/components/ui/fee-table";
import { SafeImage } from "@/components/ui/safe-image";
import { SectionHeader } from "@/components/ui/section-header";
import { SessionTable } from "@/components/ui/session-table";
import { Testimonial } from "@/components/ui/testimonial";
export const Route = createFileRoute("/")({ component: P });
const DAYS = [
  {
    day: "Monday",
    sessions: [
      { name: "Morning", from: "08:00", to: "13:00", placesLeft: 2, funded: true },
      { name: "Afternoon", from: "13:00", to: "18:00", placesLeft: 6, funded: true },
    ],
  },
  {
    day: "Tuesday",
    sessions: [
      { name: "Morning", from: "08:00", to: "13:00", placesLeft: 0, funded: true },
      { name: "Afternoon", from: "13:00", to: "18:00", placesLeft: 4, funded: true },
    ],
  },
  {
    day: "Wednesday",
    sessions: [
      { name: "Morning", from: "08:00", to: "13:00", placesLeft: 1, funded: true },
      { name: "Afternoon", from: "13:00", to: "18:00", placesLeft: 5, funded: true },
    ],
  },
  {
    day: "Thursday",
    sessions: [
      { name: "Morning", from: "08:00", to: "13:00", placesLeft: 0, funded: true },
      { name: "Afternoon", from: "13:00", to: "18:00", placesLeft: 3, funded: true },
      { name: "Forest school", from: "09:30", to: "15:00", placesLeft: 4, note: "Over-3s, at Bole Hills. Waterproofs provided." },
    ],
  },
  {
    day: "Friday",
    sessions: [
      { name: "Morning", from: "08:00", to: "13:00", placesLeft: 5, funded: true },
      { name: "Afternoon", from: "13:00", to: "18:00", funded: true, note: "Numbers change weekly — ring on the day." },
    ],
  },
];
function P() {
  return (
    <SiteChrome name="Bole Hills Nursery" tagline="A 42-place nursery and pre-school in Walkley, Sheffield."
      links={[{ label: "A day here", href: "#/day" }, { label: "Come and look", href: "#/visit" }, { label: "Fees", href: "#fees" }]}
      action={{ label: "Book a visit", href: "#/visit" }}>

      <section className="border-b border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="grid items-start gap-12 lg:grid-cols-[1fr_1fr]">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Six months to five years · Ofsted Good, March 2025</p>
              <h1 className="mt-3 text-5xl font-semibold tracking-tight text-balance">Bole Hills Nursery</h1>
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted-foreground">
                Open 8 till 6, fifty weeks a year. There are places in most sessions from
                September and two of them are already gone, which is why the numbers below are
                on the page rather than in an email.
              </p>
              <dl className="mt-7 grid grid-cols-2 gap-x-8 gap-y-4 text-sm sm:grid-cols-4">
                <div><dt className="text-muted-foreground">Ages</dt><dd className="mt-1 text-lg font-semibold">6mth–5yr</dd></div>
                <div><dt className="text-muted-foreground">Places</dt><dd className="mt-1 text-lg font-semibold">42</dd></div>
                <div><dt className="text-muted-foreground">Open</dt><dd className="mt-1 text-lg font-semibold">50 weeks</dd></div>
                <div><dt className="text-muted-foreground">Ratio, under 2</dt><dd className="mt-1 text-lg font-semibold">1:3</dd></div>
              </dl>
              <div className="mt-7 flex flex-wrap gap-3">
                <a className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground" href="#/visit">Book a look round</a>
                <a className="rounded-md border border-border px-5 py-2.5 text-sm font-medium" href="#fees">What it costs</a>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <SafeImage src={null} alt="The garden, which is most of the day in summer" ratio="3/4" />
              <SafeImage src={null} alt="The under-2s room" ratio="3/4" className="mt-10" />
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-14">
        <SectionHeader eyebrow="Sessions" title="What runs, and where there is room"
          description="Updated every Monday. A session marked full is genuinely full — we do not keep a hidden place back." />
        <SessionTable className="mt-8" days={DAYS} fundedLabel="15 & 30 funded hours cover this" />
        <p className="mt-6 text-sm text-muted-foreground">
          Forest school is not funded, because it runs off-site and the entitlement does not follow
          the child off the premises. That is a national rule, not ours.
        </p>
      </section>

      <section id="fees" className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <SectionHeader eyebrow="Fees" title="What you would actually pay"
            description="The right-hand column is the real number, with your funded hours already taken off. Nobody should have to work this out with a calculator and a policy PDF." />
          <FeeTable className="mt-8"
            caption="From September 2026"
            rows={[
              { band: "Under 2", pattern: "Five mornings", hoursPerWeek: 25, pricePerWeek: 212.5 },
              { band: "Under 2", pattern: "Five full days", hoursPerWeek: 50, pricePerWeek: 425 },
              { band: "2 years", pattern: "Five mornings", hoursPerWeek: 25, pricePerWeek: 200 },
              { band: "2 years", pattern: "Five full days", hoursPerWeek: 50, pricePerWeek: 400 },
              { band: "3–4 years", pattern: "Three mornings", hoursPerWeek: 15, pricePerWeek: 112.5 },
              { band: "3–4 years", pattern: "Five mornings", hoursPerWeek: 25, pricePerWeek: 187.5 },
              { band: "3–4 years", pattern: "Five full days", hoursPerWeek: 50, pricePerWeek: 375 },
            ]}
            funding={{
              label: "With 30 funded hours",
              hoursPerWeek: 30,
              bands: ["2 years", "3–4 years"],
              extraPerWeek: 27.5,
              extraFor: "meals, nappies and the trip fund",
            }}
            note="Term-time-only places stretch the same entitlement over 38 weeks instead of 50, which makes the weekly figure lower and the yearly one identical. Ask and we will do the sum with you."
          />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid gap-12 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <SectionHeader eyebrow="Asked often" title="What parents ring up about" />
            <Faq className="mt-6" items={[
              { question: "When can I apply for funded hours?", answer: "The term after your child turns two or three, depending on the scheme. You get a code from the government site and bring it to us — we cannot get it for you, and we cannot backdate it." },
              { question: "Is there a waiting list?", answer: "For the under-2s room, yes, usually about four months. Everywhere else it depends on the session. The numbers on this page are the honest ones." },
              { question: "What happens if my child is ill?", answer: "Keep them at home for 48 hours after sickness or diarrhoea. The fee is still due — we have staffed the session either way, and that is how every setting in the city works." },
              { question: "Can I change sessions later?", answer: "With a month's notice, and subject to a place. Going down is usually easy and going up depends on the day you want." },
              { question: "Do you take nappies and meals as extra?", answer: "They are in the £27.50 a week on the fee table rather than billed separately, so nothing arrives as a surprise." },
            ]} />
          </div>
          <div className="space-y-4 self-start">
            <Testimonial item={{ quote: "The fees page was the reason we came for a look. It was the only one that told us what we would actually pay instead of making us ring up and ask.", name: "Hannah", role: "Two children here since 2023" }} />
            <Testimonial item={{ quote: "They told us the Tuesday morning was full rather than putting us on a list and hoping. We took the Wednesday and it has been fine.", name: "Marcus", role: "Parent, pre-school room" }} />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-16">
        <CtaBand title="Come and see it on an ordinary day"
          description="No appointment slots at nine on a Saturday. We would rather you came at half past ten on a Tuesday when it is loud."
          action={{ label: "Book a look round", href: "#/visit" }} />
      </section>
    </SiteChrome>
  );
}
