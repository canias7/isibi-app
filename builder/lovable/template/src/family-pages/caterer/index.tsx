// caterer — HEADCOUNT-FIRST: the number of people is the first question and
// every figure on the page moves with it.
//
// THE MINIMUM SPEND IS IN THE HERO. It is the fact that ends half of these
// enquiries, and burying it means both sides spend a week on an exchange that
// was never going to work. A caterer who states it up front loses the enquiries
// they were going to lose anyway, three emails earlier.
//
// EDITORIAL structure: this is a business sold on the food looking like
// somebody's, not on a grid of packages. Alternating measures, generous space,
// nothing centred.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { PriceList } from "@/components/ui/price-list";
import { DateEnquiry } from "@/components/ui/date-enquiry";
import { SectionHeader } from "@/components/ui/section-header";
import { Faq } from "@/components/ui/faq";

export const Route = createFileRoute("/")({ component: P });

const BANDS = [
  { name: "40 to 60", description: "One server, one menu, service over 90 minutes", price: 34, meta: "per head" },
  { name: "60 to 120", description: "Two servers, a choice of two mains, 2 hours", price: 31, meta: "per head" },
  { name: "120 to 200", description: "Three servers plus a kitchen porter, 2.5 hours", price: 29, meta: "per head" },
  { name: "Over 200", description: "Quoted properly — at this size the venue's kitchen decides more than we do", price: null, meta: "ask" },
];

const INCLUDED = [
  { name: "Staff", description: "Chefs, servers and the kitchen porter, from set-up to clear-down", price: 0, meta: "included" },
  { name: "Crockery, cutlery and glassware", description: "Hired in, delivered and collected by us", price: 0, meta: "included" },
  { name: "Travel within 25 miles", description: "Sheffield, most of the Peak, Chesterfield, Barnsley", price: 0, meta: "included" },
  { name: "Travel beyond that", description: "Fuel and time for two vans", price: 1.4, meta: "per mile" },
  { name: "Linen", description: "Only if the venue does not provide it, which most do", price: 3.5, meta: "per table" },
  { name: "VAT", description: "Every figure on this page is shown before VAT, which is added at 20%", price: 0, meta: "on top" },
];

function P() {
  return (
    <SiteChrome
      name="Whirlow & Vane"
      tagline="Event catering from a kitchen on Abbeydale Road. Forty covers upwards."
      links={[
        { label: "The menus", href: "#/menus" },
        { label: "Get a quote", href: "#/quote" },
        { label: "Questions", href: "#questions" },
      ]}
      action={{ label: "Get a quote", href: "#/quote" }}
    >
      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="grid gap-16 lg:grid-cols-[1.15fr_1fr]">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                Weddings · Wakes · Parties · Works dos
              </p>
              <h1 className="mt-4 text-6xl font-semibold leading-[1.02] tracking-tight text-balance">
                How many people
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
                It is the only question that has to be answered before anything else can be. Every
                figure on this site is per head, and the bands below are the whole price list.
              </p>
              {/* THE MINIMUM, IN THE HERO. */}
              <p className="mt-6 max-w-xl border-l-2 border-foreground pl-5 text-lg leading-relaxed">
                <span className="font-semibold">We do not take a booking under forty people.</span>{" "}
                Below that a day out of the kitchen with two vans and four staff costs more than the
                food, and we would be doing you a favour badly. It is worth knowing now rather than
                after a week of emails.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground" href="#/quote">
                  Send us a date and a number
                </a>
                <a className="rounded-md border border-border px-5 py-2.5 text-sm font-medium" href="#/menus">
                  Read the menus
                </a>
              </div>
            </div>

            <div className="lg:pt-24">
              <p className="text-sm font-medium">Per head, by size</p>
              <div className="mt-5">
                <PriceList items={BANDS} />
              </div>
              <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">
                It falls as the number rises because the staffing does not double when the guests
                do. Nothing else is charged on top except the six lines below.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid gap-16 lg:grid-cols-[1fr_1.15fr]">
            <div className="lg:pt-8">
              <SectionHeader
                eyebrow="What the per-head figure covers"
                title="Almost everything, and the exceptions are listed"
                description="A quote from us has six lines on it. Anybody quoting a per-head price with staffing, hire and travel to be confirmed is quoting you about a third of the eventual bill."
              />
            </div>
            <div>
              <PriceList items={INCLUDED} />
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid gap-16 lg:grid-cols-[1.1fr_1fr]">
            <div>
              <SectionHeader
                eyebrow="Is the date free"
                title="Saturdays go about fourteen months out"
                description="May to September especially. Midweek and winter are usually available at a few weeks' notice, and a Friday costs the same as a Tuesday."
              />
              <p className="mt-6 max-w-xl leading-relaxed text-muted-foreground">
                We hold a date for ten days while you decide, without a deposit and without ringing
                you about it. If somebody else asks for the same day in that window we will tell
                you and give you first refusal.
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
        </div>
      </section>

      <section id="questions">
        <div className="mx-auto max-w-3xl px-6 py-16">
          <SectionHeader title="Before you enquire" />
          <div className="mt-6">
            <Faq
              items={[
                {
                  question: "Why is there a minimum at all?",
                  answer:
                    "Because the cost of a catered day is mostly people and vans, and those do not scale down. Thirty covers costs us within £200 of forty, and charging you the difference would be the same money on fewer plates.",
                },
                {
                  question: "Can we use your kitchen, or do you need one?",
                  answer:
                    "We bring everything and we can work from a marquee with a hard floor and a water supply. What we cannot do is a field with no water — that needs a hired kitchen unit and it changes the figure substantially.",
                },
                {
                  question: "Do you do the drinks as well?",
                  answer:
                    "No, deliberately. Most venues want their own bar and the margin on drinks is theirs. We will pour something you supply for a corkage-style charge per head.",
                },
                {
                  question: "What about allergies?",
                  answer:
                    "A full matrix per dish is on the menus page — all fourteen, including may-contain. For a severe allergy we will speak to you directly rather than tick a box on a form.",
                },
              ]}
            />
          </div>
        </div>
      </section>
    </SiteChrome>
  );
}
