// timetable — DEPARTURES-FIRST. A bus service's website is a timetable and
// everything else is supporting material.
//
// TERMINAL structure, and it is the right one: this page is read on a phone in
// a shelter, in daylight, sometimes printed and taped to a noticeboard.
// Monospace, hairline rules, no photography of a smiling passenger.
//
// AN EXPECTED TIME BEATS "DELAYED". One lets somebody go and buy a coffee; the
// other makes them stand there. And a cancelled service stays on the board,
// because deleting it is how a person waits for a bus that was never coming.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { DepartureBoard } from "@/components/ui/departure-board";
import { LocationCard } from "@/components/ui/location-card";
import { SectionHeader } from "@/components/ui/section-header";
import { Faq } from "@/components/ui/faq";

export const Route = createFileRoute("/")({ component: P });

const NOW = [
  { time: "14:15", destination: "Stocksbridge", via: "via Oughtibridge, Wharncliffe Side", stand: "C2", status: "on-time" as const },
  { time: "14:30", destination: "Bradfield", via: "via Loxley, Damflask", stand: "C1", status: "expected" as const, expected: "14:38", note: "Held at Malin Bridge — roadworks on Holme Lane." },
  { time: "14:45", destination: "Stocksbridge", via: "via Deepcar", stand: "C2", status: "on-time" as const },
  { time: "15:00", destination: "Bolsterstone", via: "via Ewden", stand: "C1", status: "cancelled" as const, note: "Driver shortage. The 16:00 will run and has extra capacity." },
  { time: "15:15", destination: "Stocksbridge", via: "via Oughtibridge, Wharncliffe Side", stand: "C2", status: "on-time" as const },
  { time: "15:30", destination: "Bradfield", via: "via Loxley, Damflask", stand: "C1", status: "on-time" as const, note: "Wheelchair space already booked." },
  { time: "15:45", destination: "Stocksbridge", via: "via Deepcar", stand: "C2", status: "expected" as const, expected: "15:52" },
];

function P() {
  return (
    <SiteChrome
      name="Upper Don Community Transport"
      tagline="Three routes the commercial operators dropped. A charity, run by 31 volunteer drivers."
      links={[
        { label: "Timetable", href: "/timetable" },
        { label: "Fares", href: "/fares" },
        { label: "Questions", href: "#questions" },
      ]}
      action={{ label: "Full timetable", href: "/timetable" }}
    >
      <section className="border-b border-border">
        <div className="mx-auto max-w-4xl px-6 py-12">
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">
            Live · Sheffield Interchange
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight">Next departures</h1>
          <p className="mt-4 max-w-2xl leading-relaxed text-muted-foreground">
            A late bus shows the time it is actually expected rather than the word "delayed". One
            lets you go and get a coffee; the other keeps you standing there.
          </p>

          <div className="mt-8">
            <DepartureBoard departures={NOW} from="Sheffield Interchange, stands C1 and C2" updatedAt="14:02" />
          </div>

          <p className="mt-6 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            The 15:00 to Bolsterstone stays on the board marked cancelled. Taking it off would mean
            somebody standing at Ewden at ten past three for a bus that was never coming, which has
            happened and is why we do it this way.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <a className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground" href="/timetable">
              The full timetable
            </a>
            <a className="rounded-md border border-border px-5 py-2.5 text-sm font-medium" href="/fares">
              Fares and free travel
            </a>
          </div>
        </div>
      </section>

      <section className="border-b border-border">
        <div className="mx-auto max-w-4xl px-6 py-12">
          <SectionHeader
            eyebrow="Three routes"
            title="All of them dropped by somebody else"
            description="Each ran commercially until it did not. We took them on because the alternative was nothing at all up those valleys."
          />
          <ul className="mt-8 divide-y divide-border border-y border-border font-mono text-sm">
            <li className="grid gap-1 py-4 sm:grid-cols-[minmax(0,4rem)_1fr] sm:gap-4">
              <span className="font-semibold">57</span>
              <div className="font-sans">
                <p className="font-medium">Sheffield — Oughtibridge — Wharncliffe Side — Stocksbridge</p>
                <p className="mt-1 text-muted-foreground">Every 30 minutes, 06:15 to 19:45. Hourly on Sundays. The busy one.</p>
              </div>
            </li>
            <li className="grid gap-1 py-4 sm:grid-cols-[minmax(0,4rem)_1fr] sm:gap-4">
              <span className="font-semibold">61</span>
              <div className="font-sans">
                <p className="font-medium">Sheffield — Loxley — Damflask — Low Bradfield</p>
                <p className="mt-1 text-muted-foreground">Every hour, 07:30 to 18:30. No Sunday service between November and March.</p>
              </div>
            </li>
            <li className="grid gap-1 py-4 sm:grid-cols-[minmax(0,4rem)_1fr] sm:gap-4">
              <span className="font-semibold">62</span>
              <div className="font-sans">
                <p className="font-medium">Sheffield — Deepcar — Ewden — Bolsterstone</p>
                <p className="mt-1 text-muted-foreground">Four a day. It exists so the village is not cut off, not because it pays.</p>
              </div>
            </li>
          </ul>
        </div>
      </section>

      <section className="border-b border-border">
        <div className="mx-auto max-w-4xl px-6 py-12">
          <div className="grid items-start gap-10 md:grid-cols-2">
            <div>
              <SectionHeader
                eyebrow="When it cannot run"
                title="Said plainly, and early"
                description="We are 31 volunteer drivers and two paid staff. Sometimes a service cannot run, and the useful thing is to say so at six in the morning rather than at the stop."
              />
              <ul className="mt-6 space-y-3 text-sm leading-relaxed text-muted-foreground">
                <li>Cancellations go on this board and to the text list by 06:30 where we know.</li>
                <li>Snow above Bolsterstone stops the 62 several times most winters. It is a moor road.</li>
                <li>If you are stranded by a cancellation, ring 0114 288 7220 and we will get you home somehow.</li>
              </ul>
            </div>
            <LocationCard
              name="Sheffield Interchange"
              address="Pond Street, Sheffield S1 2BP"
              note="Stands C1 and C2, at the north end past the travel office. Both are step-free with a shelter and a real-time screen."
            />
          </div>
        </div>
      </section>

      <section id="questions">
        <div className="mx-auto max-w-3xl px-6 py-12">
          <SectionHeader title="What passengers ask" />
          <div className="mt-6">
            <Faq
              items={[
                {
                  question: "Are the buses accessible?",
                  answer:
                    "All three are low-floor with a ramp and one wheelchair space. The space cannot be booked on the 57 and can be on the 61 and 62 — ring the day before and it is held.",
                },
                {
                  question: "Do you take bus passes?",
                  answer:
                    "English National Concessionary passes after 09:30 and all day at weekends, and Sheffield's under-18 pass at any time. Both are the statutory scheme and we are reimbursed for them.",
                },
                {
                  question: "Can I take a dog or a bike?",
                  answer:
                    "Dogs on a lead, always, free, at the driver's discretion about space. Bikes only on the 62, on the rear rack, two at a time and first come.",
                },
                {
                  question: "Why is there no evening service?",
                  answer:
                    "There is no funding for one and the drivers are volunteers with day jobs. It is the single most requested thing and we would need about £40,000 a year — the council knows and has said no twice.",
                },
              ]}
            />
          </div>
        </div>
      </section>
    </SiteChrome>
  );
}
