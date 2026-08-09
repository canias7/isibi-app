// caterer /quote — the enquiry, and specifically the things about the VENUE we
// have to know before a number means anything.
//
// A caterer's quote turns on the kitchen at the other end, and no customer
// thinks to mention it. Water, power, a hard floor and where the vans park are
// what separate a £29 head from a £40 one, and asking on the form saves a site
// visit that would have found the same thing out a fortnight later.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { CapacityTable } from "@/components/ui/capacity-table";
import { DateEnquiry } from "@/components/ui/date-enquiry";
import { PriceList } from "@/components/ui/price-list";
import { SectionHeader } from "@/components/ui/section-header";
import { Faq } from "@/components/ui/faq";

export const Route = createFileRoute("/quote")({ component: P });

const VENUE = [
  { what: "Running water within 30m", why: "Without it we hire a water bowser, which is about £180 and needs booking a month out." },
  { what: "Power — a 32A supply, or two 13A rings", why: "A marquee on a domestic extension lead will trip the moment the hot cabinets go on. It is the single most common problem." },
  { what: "A hard, level floor for the kitchen area", why: "6m by 4m. Grass is workable with boards; a slope is not workable at all." },
  { what: "Somewhere to park two vans within 50m", why: "There is about 400kg of equipment and it is carried by hand from wherever we stop." },
  { what: "Whether there is a curfew", why: "Most rural venues have one. It decides service timings far more than the guest count does." },
];

const EXTRAS = [
  { name: "Water bowser", description: "Where the venue has no supply", price: 180, meta: "flat" },
  { name: "Generator, 20kVA", description: "Silenced. Needed for any field site", price: 340, meta: "flat" },
  { name: "Kitchen tent, 6m × 4m", description: "Where there is no back-of-house at all", price: 420, meta: "flat" },
  { name: "Linen", description: "Only where the venue does not supply it", price: 3.5, meta: "per table" },
  { name: "Late finish past 23:30", description: "Staff overtime, not a penalty", price: 140, meta: "flat" },
  { name: "Travel beyond 25 miles", description: "Two vans, fuel and time", price: 1.4, meta: "per mile" },
];

function P() {
  return (
    <SiteChrome
      name="Whirlow & Vane"
      tagline="What we need to know about the venue, before a number means anything."
      links={[
        { label: "Prices", href: "/" },
        { label: "The menus", href: "/menus" },
      ]}
      action={{ label: "The menus", href: "/menus" }}
    >
      <div className="mx-auto max-w-5xl px-6 py-16">
        <h1 className="text-5xl font-semibold tracking-tight text-balance">Send an enquiry</h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          A per-head figure means nothing until we know what is at the other end. Five questions
          about the venue, and they are the difference between £29 a head and £40.
        </p>

        <section className="mt-14">
          <SectionHeader eyebrow="About the venue" title="Five things, and why each matters" />
          <ul className="mt-6 divide-y divide-border border-y border-border">
            {VENUE.map((v) => (
              <li key={v.what} className="grid gap-2 py-5 md:grid-cols-[minmax(0,19rem)_1fr] md:gap-8">
                <p className="font-medium">{v.what}</p>
                <p className="text-sm leading-relaxed text-muted-foreground">{v.why}</p>
              </li>
            ))}
          </ul>
          <p className="mt-5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Not sure about any of them? Most venues have a catering pack — send that and we will
            read it. If it is a field and a marquee, say so plainly and we will price it as one.
          </p>
        </section>

        <section className="mt-16">
          <SectionHeader
            eyebrow="What a difficult site costs"
            title="Six extras, all of them avoidable at a venue with a kitchen"
            description="These are at cost plus our time. None of them appears on a quote unless we have told you it will."
          />
          <div className="mt-8 max-w-2xl">
            <PriceList items={EXTRAS} />
          </div>
        </section>

        <section className="mt-16">
          <SectionHeader
            eyebrow="How many fit"
            title="The rooms we work in most often"
            description="Useful before you commit to a venue — a room that seats 90 at rounds does not seat 90 with a dance floor in it."
          />
          <div className="mt-8">
            <CapacityTable
              caption="Seated figures include room for service. A blank means the layout does not work in that room."
              rooms={[
                { name: "Whirlow Brook Hall", capacities: { "Seated at rounds": 96, Standing: 150, "With a dance floor": 74 }, size: "18m × 11m", note: "Our own kitchen access. Curfew 23:30." },
                { name: "Kelham Island Museum", capacities: { "Seated at rounds": 180, Standing: 400, "With a dance floor": 150 }, size: "31m × 14m", note: "No kitchen at all — generator and kitchen tent needed." },
                { name: "Thrybergh Barn", capacities: { "Seated at rounds": 120, Standing: 200 }, size: "22m × 10m", note: "Water and 32A on site. No dance-floor layout — the beams are too low at the far end." },
                { name: "A marquee, typical", capacities: { "Seated at rounds": 140, Standing: 220, "With a dance floor": 110 }, size: "12m × 24m", note: "Assume no water, no power and a soft floor unless told otherwise." },
              ]}
            />
          </div>
        </section>

        <section className="mt-16">
          <div className="grid items-start gap-12 lg:grid-cols-[1fr_1fr]">
            <div>
              <SectionHeader eyebrow="The date" title="Check it first" />
              <p className="mt-5 max-w-lg leading-relaxed text-muted-foreground">
                Held for ten days with no deposit. Confirming is 20%, the balance fourteen days
                before with the final numbers, and cancelling more than 90 days out returns the
                deposit in full.
              </p>
              <p className="mt-4 max-w-lg text-sm leading-relaxed text-muted-foreground">
                We take one event a day. That is why a Saturday in June goes fourteen months out and
                why we will never double-book you against something larger.
              </p>
            </div>
            <DateEnquiry
              heading="Is your date free?"
              defaultDate="2027-06-19"
              defaultGuests={110}
              minGuests={40}
              maxGuests={260}
              alternatives={["Friday 18 June 2027", "Sunday 20 June 2027", "Saturday 26 June 2027"]}
            />
          </div>
        </section>

        <section className="mt-16">
          <SectionHeader title="Enquiry questions" />
          <div className="mt-6">
            <Faq
              items={[
                {
                  question: "How quickly will I hear back?",
                  answer: "Two working days with a real figure, not a brochure. If the date has gone we will say so in the first line rather than the last.",
                },
                {
                  question: "Do you visit the venue?",
                  answer:
                    "For anything over 80, yes, and it is free. For a venue we already work at regularly there is no need — the list above tells us most of it.",
                },
                {
                  question: "Can we get a quote without a firm date?",
                  answer:
                    "Yes. Give us a month and a rough number and we will price it properly. Nothing is held without a date, but the figure will be right.",
                },
                {
                  question: "What happens if fewer people come than we paid for?",
                  answer:
                    "Numbers are locked fourteen days out because the food is bought then. Under that we can add two or three; we cannot refund for people who do not turn up, and no caterer can.",
                },
              ]}
            />
          </div>
          <p className="mt-8 text-sm text-muted-foreground">
            <a className="underline underline-offset-4" href="/">Prices by headcount</a>
            {" · "}
            <a className="underline underline-offset-4" href="/menus">The menus and allergens</a>
          </p>
        </section>
      </div>
    </SiteChrome>
  );
}
