// food-truck /diary — the full trading diary, including the winter gaps.
//
// THE GAPS ARE PUBLISHED. A van that trades outdoors does not trade every week
// of the year, and a diary that quietly omits January reads as a business that
// has stopped. Saying "we are not out for three weeks and here is why" is the
// difference between a seasonal closure and a customer assuming you folded.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { TradingDiary } from "@/components/ui/trading-diary";
import { LocationCard } from "@/components/ui/location-card";
import { SectionHeader } from "@/components/ui/section-header";
import { Faq } from "@/components/ui/faq";

export const Route = createFileRoute("/diary")({ component: P });

const AUGUST = [
  { day: "Tue 4 Aug", place: "Kelham Island, Alma Street", hours: "11:30 – 14:30" },
  { day: "Wed 5 Aug", place: "Sheffield Hallam, Owen Building", hours: "11:30 – 15:00", note: "Term time only — back from 22 September.", cancelled: true },
  { day: "Thu 6 Aug", place: "Peddler Market, Burton Road", hours: "17:00 – 22:00" },
  { day: "Fri 7 Aug", place: "Peddler Market, Burton Road", hours: "17:00 – 23:00" },
  { day: "Sat 8 Aug", place: "Ecclesall Road farmers' market", hours: "09:00 – 14:00" },
  { day: "Tue 11 Aug", place: "Kelham Island, Alma Street", hours: "11:30 – 14:30" },
  { day: "Thu 13 Aug", place: "Private booking", hours: null, note: "A wedding at Whirlow. Not open to the public, sorry." },
  { day: "Fri 14 Aug", place: "Peddler Market, Burton Road", hours: "17:00 – 23:00" },
  { day: "Sat 15 Aug", place: "Ecclesall Road farmers' market", hours: "09:00 – 14:00" },
  { day: "Sat 22 Aug", place: "Tramlines, Hillsborough Park", hours: "11:00 – 22:00", note: "All weekend. Festival prices are the festival's, not ours, and they are higher." },
];

const REGULARS = [
  { what: "Kelham Island, Alma Street", when: "Tuesdays, 11:30 – 14:30", note: "All year, weather permitting. The one pitch we have never missed." },
  { what: "Peddler Market, Burton Road", when: "Thursday and Friday evenings", note: "Indoors, so it runs through the winter. Ticketed after 19:00 on Thursdays." },
  { what: "Ecclesall Road farmers' market", when: "Saturdays, 09:00 – 14:00", note: "March to November. The breakfast bun day." },
  { what: "Sheffield Hallam, Owen Building", when: "Wednesdays in term time", note: "Roughly late September to early June, with the university's holidays out." },
];

function P() {
  return (
    <SiteChrome
      name="Ewden Smokehouse"
      tagline="Every pitch for the next month, and the weeks we are not out."
      links={[
        { label: "Today", href: "#/" },
        { label: "Hire the van", href: "#/hire" },
      ]}
      action={{ label: "Where we are today", href: "#/" }}
    >
      <div className="mx-auto max-w-5xl px-6 py-14">
        <h1 className="text-4xl font-semibold tracking-tight text-balance">The diary</h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          Updated the night before, every night. A pitch we have had to drop stays here marked
          cancelled rather than disappearing, because that is how somebody ends up standing in a
          car park in the rain.
        </p>

        <section className="mt-12">
          <SectionHeader eyebrow="August" title="Where we will be" />
          <div className="mt-6">
            <TradingDiary pitches={AUGUST} todayIndex={0} />
          </div>
        </section>

        <section className="mt-14">
          <SectionHeader
            eyebrow="The regular pitches"
            title="What the ordinary week looks like"
            description="Four of them, and only one runs all year. The rest are seasonal and this is roughly when."
          />
          <ul className="mt-6 divide-y divide-border border-y border-border">
            {REGULARS.map((r) => (
              <li key={r.what} className="py-4">
                <div className="flex flex-wrap items-baseline gap-x-3">
                  <p className="font-medium">{r.what}</p>
                  <p className="text-sm tabular-nums text-muted-foreground">{r.when}</p>
                </div>
                <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">{r.note}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-14">
          <SectionHeader
            eyebrow="The gaps"
            title="We are not out in January"
            description="Published rather than left blank, because a diary that skips a month reads as a business that has stopped."
          />
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <div className="rounded-xl border border-border p-6">
              <p className="font-medium">2 to 22 January</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Closed entirely. Nobody buys barbecue from a horsebox in a Sheffield January and we
                use the three weeks to rebuild the smoker and take a holiday.
              </p>
            </div>
            <div className="rounded-xl border border-border p-6">
              <p className="font-medium">Peddler runs through it</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                We are back at Burton Road from the last Thursday of January, indoors. Everything
                else restarts in March when the farmers' market does.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-14">
          <div className="grid items-start gap-10 md:grid-cols-2">
            <div>
              <SectionHeader eyebrow="Festivals" title="Where else you might find us" />
              <p className="mt-5 max-w-lg text-sm leading-relaxed text-muted-foreground">
                Tramlines in August, the Peace in the Park weekend in June, and one or two food
                festivals we get asked to late. They go in this diary as soon as they are confirmed
                and never before.
              </p>
            </div>
            <LocationCard
              name="Tramlines, Hillsborough Park"
              address="Middlewood Road, Sheffield S6 4HD"
              note="22 to 24 August, in the street-food field near the south gate. Festival prices apply and they are set by the event."
            />
          </div>
        </section>

        <section className="mt-14">
          <SectionHeader title="Diary questions" />
          <div className="mt-6">
            <Faq
              items={[
                {
                  question: "How last-minute do cancellations go up?",
                  answer:
                    "Within an hour of us knowing. High wind is the usual reason — the canopy is not safe above about 35mph — and it is usually decided the night before.",
                },
                {
                  question: "Can I book you for a pitch in my village?",
                  answer:
                    "Ask. We need a hard standing, room for a 5m box and permission from whoever owns the ground. Anywhere within about forty minutes of Sheffield is workable.",
                },
                {
                  question: "Do you follow the football?",
                  answer: "No, and we are asked constantly. The licensing round a ground is its own world and we are not in it.",
                },
              ]}
            />
          </div>
          <p className="mt-8 text-sm text-muted-foreground">
            <a className="underline underline-offset-4" href="#/">Where we are today</a>
            {" · "}
            <a className="underline underline-offset-4" href="#/hire">Hiring the van</a>
          </p>
        </section>
      </div>
    </SiteChrome>
  );
}
