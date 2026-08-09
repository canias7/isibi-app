// food-truck /hire — the other half of the business, and the one with a
// minimum spend.
//
// THE THINGS THAT MAKE A BOOKING IMPOSSIBLE COME FIRST. A van needs hard
// standing, 3.4m of headroom and somewhere to park a horsebox; a marquee field
// in November is a refusal. Every mobile caterer discovers this at the site
// visit and every one of them could have asked on the web page. Leading with
// the constraints loses a few enquiries and saves both sides an afternoon.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { DateEnquiry } from "@/components/ui/date-enquiry";
import { MenuSection } from "@/components/ui/menu-section";
import { LocationCard } from "@/components/ui/location-card";
import { SectionHeader } from "@/components/ui/section-header";
import { Faq } from "@/components/ui/faq";

export const Route = createFileRoute("/hire")({ component: P });

const NEEDS = [
  { what: "Hard standing, 6m by 3m", detail: "Tarmac, concrete or firm gravel. Not a field after rain — a two-tonne horsebox on soft ground is a recovery vehicle and a ruined lawn." },
  { what: "3.4m of clearance getting in", detail: "Low branches and archways are the usual problem. Measure the tightest point on the approach, not the parking spot." },
  { what: "Somewhere within 20m to serve", detail: "People queue at the hatch. If the van has to sit round the back of the building it does not work." },
  { what: "Nothing else, really", detail: "We bring our own power, water and waste. No hook-up needed and nothing goes down your drains." },
];

const PACKAGES = [
  {
    name: "What it costs",
    note: "Minimum 40 covers. Below that the day does not pay for itself and we would be doing you a favour badly.",
    items: [
      { name: "40 to 60 people", description: "One choice of bun, chips, and the vegetarian option", price: 14, meta: "per head" },
      { name: "60 to 120 people", description: "Two choices plus the vegetarian option", price: 13, meta: "per head" },
      { name: "Over 120", description: "Two choices, second server, longer service window", price: 12, meta: "per head" },
      { name: "Travel beyond 20 miles", description: "Sheffield and 20 miles out is included", price: 1.2, meta: "per mile" },
      { name: "Late finish past 23:00", description: "Councils vary and some will not allow it at all", price: 90, meta: "flat" },
    ],
  },
];

function P() {
  return (
    <SiteChrome
      name="Ewden Smokehouse"
      tagline="Hiring the van — what it needs, and what it costs."
      links={[
        { label: "Today", href: "/" },
        { label: "The diary", href: "/diary" },
      ]}
      action={{ label: "Check a date", href: "#date" }}
    >
      <div className="mx-auto max-w-5xl px-6 py-14">
        <h1 className="text-4xl font-semibold tracking-tight text-balance">Hire the van</h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          Weddings, birthdays, works dos and a surprising number of funerals. Before anything else:
          four things your venue has to have, because two of them are the reason most enquiries end
          at the site visit rather than at the quote.
        </p>

        {/* THE REFUSALS, FIRST. */}
        <section className="mt-12">
          <SectionHeader eyebrow="Before you ask" title="What the site has to have" />
          <ul className="mt-6 divide-y divide-border border-y border-border">
            {NEEDS.map((n) => (
              <li key={n.what} className="grid gap-2 py-5 md:grid-cols-[minmax(0,16rem)_1fr] md:gap-8">
                <p className="font-medium">{n.what}</p>
                <p className="text-sm leading-relaxed text-muted-foreground">{n.detail}</p>
              </li>
            ))}
          </ul>
          <p className="mt-5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Not sure? Send a photograph of the approach and where you imagine us parking. We will
            tell you in an hour and it costs nothing to ask.
          </p>
        </section>

        <section className="mt-14">
          <SectionHeader
            eyebrow="Per head"
            title="Priced by numbers, not by occasion"
            description="A wedding and a works do cost the same here. There is no wedding surcharge and we would rather not explain why other people have one."
          />
          <div className="mt-8">
            <MenuSection groups={PACKAGES} />
          </div>
          <p className="mt-6 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Everything is included in the per-head figure — staff, gas, disposables, the lot. The
            only extras are the two lines at the bottom, and both are stated before you book rather
            than added afterwards.
          </p>
        </section>

        <section className="mt-14" id="date">
          <div className="grid items-start gap-10 lg:grid-cols-[1fr_1fr]">
            <div>
              <SectionHeader eyebrow="The date" title="Is it free?" />
              <p className="mt-5 max-w-lg text-sm leading-relaxed text-muted-foreground">
                Saturdays in June, July and September go about ten months out. Everything else is
                usually available at a few weeks' notice, and we hold a date for seven days without
                a deposit while you decide.
              </p>
              <p className="mt-4 max-w-lg text-sm leading-relaxed text-muted-foreground">
                A booking is confirmed by a £200 deposit, refundable up to a month before. After
                that it is not, because the day is gone.
              </p>
            </div>
            <DateEnquiry
              heading="Is your date free?"
              defaultDate="2026-09-12"
              defaultGuests={80}
              minGuests={40}
              maxGuests={300}
              alternatives={["Friday 11 September", "Sunday 13 September", "Saturday 19 September"]}
            />
          </div>
        </section>

        <section className="mt-14">
          <div className="grid items-start gap-10 md:grid-cols-2">
            <div>
              <SectionHeader eyebrow="Come and try it" title="Before you book a wedding on it" />
              <p className="mt-5 max-w-lg text-sm leading-relaxed text-muted-foreground">
                Nobody should commit to feeding a hundred people food they have never eaten. Find
                us at a pitch first — Thursday or Friday evening at Peddler is the easiest — and
                say you are thinking about a booking.
              </p>
              <a className="mt-6 inline-block text-sm underline underline-offset-4" href="/diary">
                Where we will be
              </a>
            </div>
            <LocationCard
              name="Peddler Market"
              address="92 Burton Road, Sheffield S3 8DA"
              note="Thursday and Friday evenings, all year, indoors. The easiest place to find us and talk properly."
            />
          </div>
        </section>

        <section className="mt-14">
          <SectionHeader title="Hire questions" />
          <div className="mt-6">
            <Faq
              items={[
                {
                  question: "Can you do a sit-down meal?",
                  answer:
                    "No. We serve from a hatch and people eat standing or at whatever seating you have. Anybody telling you a horsebox can do table service has not tried it.",
                },
                {
                  question: "What about dietary requirements?",
                  answer:
                    "The vegetarian option comes as standard and vegan is straightforward with notice. Gluten-free buns are fine. Severe allergies we will discuss honestly — a small van is not a segregated kitchen.",
                },
                {
                  question: "Do you have public liability insurance?",
                  answer: "£5m, and a level 5 food hygiene rating from Sheffield City Council. Certificates go over with the quote, unasked.",
                },
                {
                  question: "How long do you serve for?",
                  answer:
                    "Two hours is included, which comfortably feeds 120. Longer is possible and costs nothing extra in food terms — it is the staffing, so we price it per hour.",
                },
              ]}
            />
          </div>
          <p className="mt-8 text-sm text-muted-foreground">
            <a className="underline underline-offset-4" href="/">Where we are today</a>
            {" · "}
            <a className="underline underline-offset-4" href="/diary">The full diary</a>
          </p>
        </section>
      </div>
    </SiteChrome>
  );
}
