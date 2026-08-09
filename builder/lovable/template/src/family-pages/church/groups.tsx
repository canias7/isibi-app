// church /groups — what runs in the week. Most of it has nothing to do with
// believing anything, and the page says so rather than implying it.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { EventCard } from "@/components/ui/event-card";
import { SafeImage } from "@/components/ui/safe-image";
import { SectionHeader } from "@/components/ui/section-header";
import { Testimonial } from "@/components/ui/testimonial";
export const Route = createFileRoute("/groups")({ component: P });
const RUNS = [
  { name: "Warm space & soup", when: "Tuesdays, 11–2", who: "Anyone at all", cost: "Free", note: "Soup, bread, a warm room and no questions. Forty-odd people most weeks." },
  { name: "Toddler group", when: "Wednesdays, 9:30–11", who: "Under-fives and whoever brings them", cost: "£1", note: "Includes toast and a cup of tea for the grown-up, which is the actual point." },
  { name: "Bell ringing", when: "Thursdays, 7:30", who: "Beginners very welcome", cost: "Free", note: "Six bells. It takes about six weeks to be useful and nobody minds the noise." },
  { name: "Repair café", when: "First Saturday, 10–1", who: "Anything with a plug or a hem", cost: "Donation", note: "Run with the library. Bring the thing and somebody will have a go." },
  { name: "Choir", when: "Thursdays, 7:30", who: "Can you hold a tune roughly?", cost: "Free", note: "Currently paused while the organ is out. Back in September." },
  { name: "Community lunch", when: "Last Sunday, 12:30", who: "Everyone, especially if you eat alone", cost: "Pay what you can", note: "Two courses, one long table, and a lift home if you need one." },
];
function P() {
  return (
    <SiteChrome name="St Chad's, Walkley" tagline="A parish church on South Road since 1868."
      links={[{ label: "Home", href: "/" }, { label: "First visit", href: "/visit" }]}
      action={{ label: "Plan a visit", href: "/visit" }}>
      <div className="mx-auto max-w-6xl px-6 py-14">
        <SectionHeader eyebrow="In the week" title="What runs, and who it is for"
          description="Most of this is not a church service. You do not have to believe anything to sit down." />
        <div className="mt-10 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
          <ul className="divide-y divide-border border-y border-border">
            {RUNS.map((r) => (
              <li key={r.name} className="py-5">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <h2 className="text-lg font-medium">{r.name}</h2>
                  <p className="text-sm tabular-nums text-muted-foreground">{r.when}</p>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{r.who} · {r.cost}</p>
                <p className="mt-2 text-base leading-relaxed text-muted-foreground">{r.note}</p>
              </li>
            ))}
          </ul>
          <aside className="space-y-8">
            <SafeImage src={null} alt="The parish hall, mid-week" ratio="4/3" />
            <div>
              <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Next few</p>
              <div className="mt-3 space-y-4">
                <EventCard title="Warm space & soup" start="2026-08-04T11:00:00" venue="Parish hall" />
                <EventCard title="Toddler group" start="2026-08-05T09:30:00" venue="Parish hall" />
              </div>
            </div>
            <Testimonial item={{ quote: "I came for the soup. Three winters later I run the soup.", name: "Marjorie", role: "Tuesdays" }} />
          </aside>
        </div>
      </div>
    </SiteChrome>
  );
}
