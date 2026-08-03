// food-truck — WHERE-TODAY-FIRST: the pitch and its hours, large, above
// everything else.
//
// A van has exactly one perishable fact and it is where it is right now.
// Every street-food site puts a photograph of a burger at the top and the
// week's pitches somewhere below the fold, which answers the question nobody
// arrived with. Today is the hero and the rest of the week is directly under
// it.
//
// FULL-BLEED-HERO, because the pitch IS the headline and it wants the whole
// width — not a photograph doing the same job less usefully.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { TradingDiary } from "@/components/ui/trading-diary";
import { MenuSection } from "@/components/ui/menu-section";
import { LocationCard } from "@/components/ui/location-card";
import { OpenNow } from "@/components/ui/open-now";
import { SectionHeader } from "@/components/ui/section-header";
import { Faq } from "@/components/ui/faq";

export const Route = createFileRoute("/")({ component: P });

const WEEK = [
  { day: "Monday 3 August", place: "Not out", hours: null, note: "Prep and the cash-and-carry. Nothing personal." },
  { day: "Tuesday 4 August", place: "Kelham Island, Alma Street", hours: "11:30 – 14:30", note: "Outside the Fat Cat. Queue is worst at 12:15 and gone by 13:00." },
  {
    day: "Wednesday 5 August", place: "Sheffield Hallam, Owen Building", hours: "11:30 – 15:00",
    note: "Term time only, so we are back here from late September.", cancelled: true,
  },
  { day: "Thursday 6 August", place: "Peddler Market, 92 Burton Road", hours: "17:00 – 22:00", note: "Ticketed after 19:00. Get in before then if you would rather not." },
  { day: "Friday 7 August", place: "Peddler Market, 92 Burton Road", hours: "17:00 – 23:00" },
  { day: "Saturday 8 August", place: "Ecclesall Road farmers' market", hours: "09:00 – 14:00", note: "The only day we do the breakfast bun, and it sells out by half ten." },
  { day: "Sunday 9 August", place: "Not out", hours: null },
];

const MENU = [
  {
    name: "The whole menu",
    note: "Six things. A van that does twenty does none of them well.",
    items: [
      { name: "Short rib bun, pickled red cabbage", description: "Twelve hours in the oven the night before", price: 9.5 },
      { name: "Buttermilk chicken, hot honey", description: "Brined 24 hours", price: 9 },
      { name: "Halloumi and harissa flatbread", description: "The vegetarian one, and it is not an apology", price: 8.5 },
      { name: "Loaded fries", description: "Whatever is on the buns, on chips", price: 7 },
      { name: "Breakfast bun — Saturdays only", description: "Sausage, bacon, fried onion, brown sauce", price: 6 },
      { name: "Chips", price: 4 },
    ],
  },
];

const HOURS = [
  { day: 2, open: "11:30", close: "14:30" },
  { day: 3, open: "11:30", close: "15:00" },
  { day: 4, open: "17:00", close: "22:00" },
  { day: 5, open: "17:00", close: "23:00" },
  { day: 6, open: "09:00", close: "14:00" },
];

function P() {
  return (
    <SiteChrome
      name="Ewden Smokehouse"
      tagline="A converted horsebox and a barbecue. Sheffield, most days."
      links={[
        { label: "The diary", href: "#/diary" },
        { label: "Hire the van", href: "#/hire" },
        { label: "Questions", href: "#questions" },
      ]}
      action={{ label: "Where we are today", href: "#today" }}
    >
      {/* TODAY, FULL WIDTH, ABOVE EVERYTHING. */}
      <section className="border-b border-border bg-muted/30" id="today">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Today · Tuesday 4 August
          </p>
          <h1 className="mt-4 text-6xl font-semibold tracking-tight text-balance">
            Kelham Island, Alma Street
          </h1>
          <p className="mt-4 text-2xl tabular-nums text-muted-foreground">11:30 – 14:30</p>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            Outside the Fat Cat, same spot as always. The queue is at its worst about a quarter
            past twelve and gone by one — worth knowing if you have half an hour rather than an
            hour.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <OpenNow hours={HOURS} />
            <a className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground" href="#/diary">
              The rest of the month
            </a>
          </div>
        </div>
      </section>

      <section className="border-b border-border">
        <div className="mx-auto max-w-5xl px-6 py-14">
          <SectionHeader
            eyebrow="This week"
            title="Where else we will be"
            description="A pitch we have had to drop stays on this list marked so, because a regular otherwise finds out by driving there."
          />
          <div className="mt-8">
            <TradingDiary pitches={WEEK} todayIndex={1} />
          </div>
        </div>
      </section>

      <section className="border-b border-border">
        <div className="mx-auto max-w-5xl px-6 py-14">
          <SectionHeader
            eyebrow="On the van"
            title="Six things"
            description="It is the same six wherever we are, except the breakfast bun, which is Saturdays and gone by half ten."
          />
          <div className="mt-8">
            <MenuSection groups={MENU} />
          </div>
          <p className="mt-6 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Card and cash. Gluten-free buns if you ask when you order rather than when you collect
            — they live in a separate box in the cab.
          </p>
        </div>
      </section>

      <section className="border-b border-border">
        <div className="mx-auto max-w-5xl px-6 py-14">
          <div className="grid items-start gap-10 md:grid-cols-2">
            <div>
              <SectionHeader eyebrow="Private hire" title="We will come to you" />
              <p className="mt-5 max-w-lg leading-relaxed text-muted-foreground">
                Weddings, birthdays, works dos and a surprising number of funerals. Minimum forty
                covers, we bring our own power, and we need to know about the ground before we
                agree to anything.
              </p>
              <a className="mt-6 inline-block rounded-md border border-border px-5 py-2.5 text-sm font-medium" href="#/hire">
                What it costs
              </a>
            </div>
            <LocationCard
              name="Where to find us most weeks"
              address="Peddler Market, 92 Burton Road, Sheffield S3 8DA"
              note="Thursday and Friday evenings, all year. It is indoors, which matters in February."
            />
          </div>
        </div>
      </section>

      <section id="questions">
        <div className="mx-auto max-w-3xl px-6 py-14">
          <SectionHeader title="What people ask at the hatch" />
          <div className="mt-6">
            <Faq
              items={[
                {
                  question: "Do you take card?",
                  answer: "Yes, and contactless. The signal at Kelham is poor so if it fails there is a cash tin — but card works ninety-nine times in a hundred.",
                },
                {
                  question: "Why are you not out on Mondays?",
                  answer: "The rib goes in the oven overnight on Monday and somebody has to be at the cash-and-carry. It is a two-person business and Monday is the day it is a kitchen rather than a van.",
                },
                {
                  question: "Is the diary reliable?",
                  answer:
                    "It is updated the night before, every night. If the van breaks down or the weather makes a pitch impossible we mark it cancelled here rather than quietly deleting it.",
                },
                {
                  question: "Can I pre-order?",
                  answer: "Not at a pitch — it slows the queue for everybody. For private hire, the whole thing is pre-ordered, which is the point.",
                },
              ]}
            />
          </div>
        </div>
      </section>
    </SiteChrome>
  );
}
