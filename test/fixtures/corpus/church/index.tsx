// church — TIMES-FIRST: when we meet and what happens if you have never been,
// before anything else. Nothing on this page assumes the reader already
// belongs, which is the whole discipline of the family.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { CtaBand } from "@/components/ui/cta-band";
import { EventCard } from "@/components/ui/event-card";
import { Faq } from "@/components/ui/faq";
import { LocationCard } from "@/components/ui/location-card";
import { SafeImage } from "@/components/ui/safe-image";
import { SectionHeader } from "@/components/ui/section-header";
import { ServiceTimes } from "@/components/ui/service-times";
import { Testimonial } from "@/components/ui/testimonial";
export const Route = createFileRoute("/")({ component: P });
function P() {
  return (
    <SiteChrome name="St Chad's, Walkley" tagline="A parish church on South Road since 1868."
      links={[{ label: "First visit", href: "/visit" }, { label: "In the week", href: "/groups" }, { label: "Find us", href: "#find-us" }]}
      action={{ label: "Plan a visit", href: "/visit" }}>

      <section className="border-b border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid items-start gap-12 lg:grid-cols-[1fr_1fr]">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">South Road, Walkley · everyone welcome, no exceptions</p>
              <h1 className="mt-3 text-5xl font-semibold tracking-tight text-balance">St Chad's</h1>
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted-foreground">
                An ordinary parish church. Come as you are, sit at the back if you would rather, and nobody
                will ask you to stand up and introduce yourself.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <a className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground" href="/visit">If it's your first time</a>
                <a className="rounded-md border border-border px-5 py-2.5 text-sm font-medium" href="#find-us">Find us</a>
              </div>
            </div>
            <ServiceTimes meetings={[
              { day: "Sunday", time: "08:30", what: "Said communion", where: "Lady chapel" },
              { day: "Sunday", time: "10:30", what: "Parish communion", where: "Main church", note: "Sunday 14th: one joint service at 10:30, no 08:30" },
              { day: "Sunday", time: "18:00", what: "Evening prayer", where: "Lady chapel" },
              { day: "Wednesday", time: "10:00", what: "Midweek communion", where: "Lady chapel" },
              { day: "Thursday", time: "19:30", what: "Choir practice", where: "Main church", cancelled: true },
            ]} />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-12 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <SectionHeader eyebrow="Never been?" title="What actually happens"
              description="Written for somebody who has not been inside a church since a wedding." />
            <div className="mt-6 space-y-4 text-base leading-relaxed text-muted-foreground">
              <p>
                It lasts about an hour. There is singing, some of which you will not know, and nobody minds
                whether you join in. Someone talks for ten minutes or so.
              </p>
              <p>
                You will be offered communion. You do not have to take it — plenty of people come up for a
                blessing instead, or stay in their seat, and nobody counts.
              </p>
              <p>
                Children are not expected to be quiet. There is coffee afterwards and you may leave before it.
              </p>
            </div>
            <a className="mt-6 inline-block text-sm font-medium underline underline-offset-4" href="/visit">The first visit, in more detail →</a>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <SafeImage src={null} alt="The nave on an ordinary Sunday" ratio="3/4" />
            <SafeImage src={null} alt="Coffee afterwards, in the hall" ratio="3/4" className="mt-8" />
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <SectionHeader eyebrow="In the week" title="Not just Sundays"
              description="Most of these have nothing to do with believing anything." />
            <a className="text-sm font-medium underline underline-offset-4" href="/groups">Everything that runs →</a>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <EventCard title="Warm space & soup" start="2026-08-04T11:00:00" venue="Parish hall — free, no questions" />
            <EventCard title="Toddler group" start="2026-08-05T09:30:00" venue="Parish hall — £1, includes toast" />
            <EventCard title="Bell ringing practice" start="2026-08-06T19:30:00" venue="Tower — beginners on Thursdays" />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-12 lg:grid-cols-2">
          <div>
            <SectionHeader eyebrow="Asked often" title="The questions people email us" />
            <Faq className="mt-6" items={[
              { question: "Do I have to believe anything to come?", answer: "No. A good number of people here are working that out, and some have been working it out for years." },
              { question: "What do people wear?", answer: "Whatever they came in. There is no dress code and there never has been." },
              { question: "Is there a collection?", answer: "A plate goes round and you are under no obligation. Most regulars give by standing order, so it is not aimed at visitors." },
              { question: "Is the building accessible?", answer: "Step-free from the South Road gate, a hearing loop throughout, and large-print orders of service at the back." },
            ]} />
          </div>
          <Testimonial className="self-start" item={{ quote: "I sat at the back for about a year before I spoke to anybody. Nobody rushed me and nobody pretended not to notice either.", name: "Ade", role: "Comes most weeks" }} />
        </div>
      </section>

      <section id="find-us" className="border-t border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr]">
            <div>
              <SectionHeader eyebrow="Find us" title="South Road" />
              <LocationCard className="mt-6" name="St Chad's, Walkley" address="South Road, Walkley, Sheffield, S6 3TD"
                note="Step-free from the South Road gate. The 95 stops outside. Parking on Fir Street after 10." />
            </div>
            <SafeImage src={null} alt="The tower from South Road" ratio="16/9" />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <CtaBand title="Come to anything, or come to nothing"
          description="The warm space and the toddler group ask nothing of you at all. Sunday is there if you want it."
          action={{ label: "What a first visit is like", href: "/visit" }} />
      </section>
    </SiteChrome>
  );
}
