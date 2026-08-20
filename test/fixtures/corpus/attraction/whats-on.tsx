// attraction /whats-on — the daily timetable first, then the dated events, then
// the seasonal shape. Most of what "what's on" means at an attraction is the
// thing that happens every single day at half past ten, not the Halloween week.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { EventCard } from "@/components/ui/event-card";
import { Faq } from "@/components/ui/faq";
import { SafeImage } from "@/components/ui/safe-image";
import { SectionHeader } from "@/components/ui/section-header";
import { ServiceTimes } from "@/components/ui/service-times";
import { TIMETABLE } from "./index";
export const Route = createFileRoute("/whats-on")({ component: P });
function P() {
  return (
    <SiteChrome name="Wharncliffe Farm & Wildlife Park" tagline="Ninety acres, a steam railway and forty species, north of Sheffield."
      links={[{ label: "Home", href: "/" }, { label: "Plan your visit", href: "/visit" }]}
      action={{ label: "Book tickets", href: "/#prices" }}>

      <div className="mx-auto max-w-6xl px-6 py-14">
        <SectionHeader eyebrow="What's on" title="Most of it happens every day"
          description="The talks, the feeds and the trains run whatever the date, and they are what a visit is actually built around. The dated events are further down." />

        <section className="mt-10 grid gap-12 lg:grid-cols-[1fr_1fr]">
          <div>
            {/* THE DAILY TIMETABLE FIRST. A "what's on" page that leads with
                Halloween in August tells a family visiting on Tuesday nothing. */}
            <ServiceTimes meetings={TIMETABLE} heading="Every day" />
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              Times are the same seven days a week. The falconry does not fly in high wind or heavy
              rain — that is the bird's welfare and it is not negotiable — and when it is off, the
              keeper does a talk on the lawn instead.
            </p>
          </div>
          <div>
            <h2 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">Building a day around it</h2>
            <ol className="mt-3 divide-y divide-border border-y border-border text-base">
              <li className="py-3.5">
                <span className="font-medium">Arrive at ten</span>
                <span className="block text-sm text-muted-foreground">Farm first while it is quiet, and you catch the otters at half past.</span>
              </li>
              <li className="py-3.5">
                <span className="font-medium">Train at quarter past eleven</span>
                <span className="block text-sm text-muted-foreground">It drops you at the wood end, which is the right way round to walk it.</span>
              </li>
              <li className="py-3.5">
                <span className="font-medium">Eat at quarter to twelve or at two</span>
                <span className="block text-sm text-muted-foreground">Not at one. The tea room queue at one o'clock is twenty minutes.</span>
              </li>
              <li className="py-3.5">
                <span className="font-medium">Feeding at half one, keeper talk at two</span>
                <span className="block text-sm text-muted-foreground">Both in the same corner of the park, ten minutes apart.</span>
              </li>
              <li className="py-3.5">
                <span className="font-medium">Falconry at three, then the play barn</span>
                <span className="block text-sm text-muted-foreground">Children will not leave the barn, so put it last on purpose.</span>
              </li>
            </ol>
          </div>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <SectionHeader eyebrow="Dated" title="The things that only happen once"
            description="Included in normal admission unless the card says otherwise. Nothing here needs a separate ticket except the two evening events." />
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <EventCard title="Lambing fortnight" start="2026-03-28T10:00:00" venue="The barn" price="Included"
              image={null} href="/visit" />
            <EventCard title="Shearing day" start="2026-06-06T11:00:00" venue="Paddock" price="Included"
              image={null} href="/visit" />
            <EventCard title="Summer late openings" start="2026-07-24T10:00:00" venue="Whole park" price="Included"
              image={null} href="/visit" />
            <EventCard title="Owl evening" start="2026-09-12T19:00:00" venue="Raptor lawn" price="£14, over-8s"
              image={null} href="/visit" />
            <EventCard title="Halloween trail" start="2026-10-24T10:00:00" venue="The wood" price="Included"
              image={null} href="/visit" />
            <EventCard title="Christmas by lamplight" start="2026-12-05T16:30:00" venue="Whole park" price="£18, booking only"
              soldOut image={null} href="/visit" />
          </div>
          <p className="mt-6 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Christmas by lamplight sells out in about a week every November and we do not release
            more. It says sold out here rather than letting you get as far as the payment page,
            which is where most places tell you.
          </p>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <SectionHeader eyebrow="The year" title="It is a different place in February"
            description="Worth knowing which one you are coming to. Nothing here is a complaint about winter — some of it is better." />
          <div className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Spring", "Lambing, and the best two weeks we have. Busy at weekends and empty midweek.", "March to May"],
              ["Summer", "Everything open, the train every 45 minutes, and the play barn full. Late opening in the school holidays.", "June to August"],
              ["Autumn", "The wood is worth the visit on its own. Quiet, and the animals are far more active in the cool.", "September to October"],
              ["Winter", "Shorter days, no train, cheaper gate. The lynx and the otters are at their best and almost nobody is here.", "November to February"],
            ].map(([k, v, when]) => (
              <div key={k} className="border-t border-border pt-4">
                <p className="font-medium">{k}</p>
                <p className="mt-0.5 text-xs uppercase tracking-widest text-muted-foreground">{when}</p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{v}</p>
              </div>
            ))}
          </div>
          <div className="mt-10">
            <SafeImage src={null} alt="The wood in late October" ratio="21/9" />
          </div>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <div className="max-w-3xl">
            <SectionHeader eyebrow="Asked often" title="About the events" />
            <Faq className="mt-6" items={[
              { question: "Do the daily talks need booking?", answer: "No, none of them. Turn up at the place at the time. The falconry lawn seats about eighty and on a busy Saturday it is worth being there five minutes early." },
              { question: "Are the dated events extra?", answer: "Only the two evening ones, which are outside normal opening and are separately staffed. Everything in daylight is in the admission price." },
              { question: "What happens if an event is cancelled?", answer: "We put it on the front page by nine that morning and refund a ticketed event in full, without being asked." },
              { question: "Can we book Christmas now?", answer: "Tickets go on sale on the first of November and it is gone by about the eighth. There is a mailing list and it is the only thing we ever use it for." },
              { question: "Is the Halloween trail frightening?", answer: "For a four-year-old, mildly, in the last section. There is a signed way round that bit and the staff will point at it rather than making you ask." },
            ]} />
          </div>
        </section>
      </div>
    </SiteChrome>
  );
}
