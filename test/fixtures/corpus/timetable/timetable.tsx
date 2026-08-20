// timetable /timetable — the full printed timetable, both directions, with the
// school-day variations shown rather than footnoted.
//
// A FOOTNOTE MARKED "S" IS WHY SOMEBODY MISSES A BUS. Timetables have used
// superscript letters for a century and they are read wrong constantly. The
// school-day departures are in their own labelled block instead.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { ServiceTimes } from "@/components/ui/service-times";
import { SectionHeader } from "@/components/ui/section-header";
import { Faq } from "@/components/ui/faq";

export const Route = createFileRoute("/timetable")({ component: P });

const OUT = ["06:15", "06:45", "07:15", "07:45", "08:15", "08:45", "09:15", "09:45", "10:15", "10:45", "11:15", "11:45", "12:15", "12:45", "13:15", "13:45", "14:15", "14:45", "15:15", "15:45", "16:15", "16:45", "17:15", "17:45", "18:15", "18:45", "19:15", "19:45"];
const BACK = ["06:50", "07:20", "07:50", "08:20", "08:50", "09:20", "09:50", "10:20", "10:50", "11:20", "11:50", "12:20", "12:50", "13:20", "13:50", "14:20", "14:50", "15:20", "15:50", "16:20", "16:50", "17:20", "17:50", "18:20", "18:50", "19:20", "19:50", "20:20"];

function Column({ title, note, times }: { title: string; note: string; times: string[] }) {
  return (
    <div>
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{note}</p>
      <ul className="mt-4 grid grid-cols-3 gap-x-4 gap-y-1 font-mono text-sm tabular-nums sm:grid-cols-4">
        {times.map((t) => <li key={t}>{t}</li>)}
      </ul>
    </div>
  );
}

function P() {
  return (
    <SiteChrome
      name="Upper Don Community Transport"
      tagline="The full timetable, both directions, with the school-day extras in their own block."
      links={[
        { label: "Next departures", href: "/" },
        { label: "Fares", href: "/fares" },
      ]}
      action={{ label: "Next departures", href: "/" }}
    >
      <div className="mx-auto max-w-4xl px-6 py-12">
        <h1 className="text-4xl font-semibold tracking-tight">Timetable</h1>
        <p className="mt-4 max-w-2xl leading-relaxed text-muted-foreground">
          From 1 September 2026. No superscript letters and no footnotes — the school-day
          departures are a separate labelled block, because a small "S" beside a time is why people
          miss buses.
        </p>

        <section className="mt-10">
          <SectionHeader eyebrow="Service 57" title="Sheffield — Stocksbridge, Monday to Saturday" />
          <div className="mt-6 grid gap-10 md:grid-cols-2">
            <Column
              title="From Sheffield Interchange, stand C2"
              note="Via Hillsborough, Oughtibridge, Wharncliffe Side. About 38 minutes."
              times={OUT}
            />
            <Column
              title="From Stocksbridge, Manchester Road"
              note="Same route in reverse. About 40 minutes in the evening peak."
              times={BACK}
            />
          </div>
        </section>

        <section className="mt-12">
          <SectionHeader
            eyebrow="Service 57 — school days only"
            title="Three extra journeys, in their own block"
            description="Term time only, roughly September to mid-July, following Sheffield's term dates. Anybody may use them; they are ordinary buses that exist because of the schools."
          />
          <div className="mt-6 rounded-xl border-2 border-foreground p-6">
            <ul className="space-y-3 text-sm">
              <li className="flex flex-wrap gap-x-3">
                <span className="font-mono tabular-nums">07:35</span>
                <span>Sheffield to Stocksbridge, non-stop from Hillsborough</span>
              </li>
              <li className="flex flex-wrap gap-x-3">
                <span className="font-mono tabular-nums">08:05</span>
                <span>Stocksbridge to Sheffield, extra journey ahead of the 08:20</span>
              </li>
              <li className="flex flex-wrap gap-x-3">
                <span className="font-mono tabular-nums">15:25</span>
                <span>Sheffield to Stocksbridge, ahead of the 15:45. Busy, and standing is likely</span>
              </li>
            </ul>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              These do not run in the school holidays, on INSET days or on the days between terms.
              The dates follow Sheffield City Council's calendar rather than any one school's.
            </p>
          </div>
        </section>

        <section className="mt-12">
          <SectionHeader
            eyebrow="Services 61 and 62"
            title="Hourly, and four a day"
            description="Both far quieter than the 57. The 62 exists so Bolsterstone is not cut off rather than because it pays for itself."
          />
          <div className="mt-6">
            <ServiceTimes
              heading="This week"
              meetings={[
                { day: "Monday to Friday", time: "07:30 – 18:30", what: "Service 61 — Sheffield to Low Bradfield, hourly", where: "Stand C1", note: "The 12:30 does not run on Wednesdays — driver training." },
                { day: "Saturday", time: "08:30 – 18:30", what: "Service 61 — hourly", where: "Stand C1" },
                { day: "Sunday", time: "10:30 – 16:30", what: "Service 61 — two-hourly", where: "Stand C1", note: "April to October only.", cancelled: true },
                { day: "Monday to Saturday", time: "07:45, 10:45, 14:45, 17:45", what: "Service 62 — Sheffield to Bolsterstone", where: "Stand C1" },
                { day: "Sunday", time: "—", what: "Service 62 — no Sunday service", where: "—", cancelled: true },
              ]}
            />
          </div>
        </section>

        <section className="mt-12">
          <SectionHeader title="Timetable questions" />
          <div className="mt-6">
            <Faq
              items={[
                {
                  question: "How long does the journey take?",
                  answer:
                    "38 minutes Sheffield to Stocksbridge off-peak, up to 55 between four and six. The 61 is 34 minutes to Low Bradfield. All three are on the same roads as everybody else and traffic is traffic.",
                },
                {
                  question: "Do the buses connect with the trains?",
                  answer:
                    "The 57 is timed to meet the Manchester service at the Interchange in the morning peak, both directions. Elsewhere it is coincidence and we would not rely on it for a connection under fifteen minutes.",
                },
                {
                  question: "Is there a printable version?",
                  answer:
                    "This page prints on two sides of A4 in black and white and that is deliberate — a good proportion of our passengers want paper, and a printed sheet in a shelter is worth more than an app.",
                },
                {
                  question: "When does the timetable change?",
                  answer:
                    "Twice a year, in September and April, and we post the new one six weeks ahead. Nothing changes without notice except for roadworks, which go on the departures board.",
                },
              ]}
            />
          </div>
          <p className="mt-8 text-sm text-muted-foreground">
            <a className="underline underline-offset-4" href="/">Live departures</a>
            {" · "}
            <a className="underline underline-offset-4" href="/fares">Fares</a>
          </p>
        </section>
      </div>
    </SiteChrome>
  );
}
