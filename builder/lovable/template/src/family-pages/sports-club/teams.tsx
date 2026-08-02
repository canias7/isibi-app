// sports-club /teams — every side, training nights, and who runs it. A club is
// four teams and the person who does the nets, and both belong here.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { FixtureList } from "@/components/ui/fixture-list";
import { SafeImage } from "@/components/ui/safe-image";
import { SectionHeader } from "@/components/ui/section-header";
import { TeamGrid } from "@/components/ui/team-grid";
export const Route = createFileRoute("/teams")({ component: P });
// Each side carries its OWN next two. Four teams sharing one hard-coded pair
// renders as four identical fixture lists, which reads as a broken page and
// teaches exactly the wrong habit — the fixtures are per-team data, so they
// live on the team.
const SIDES = [
  {
    name: "First team", league: "County Senior League, Division One",
    trains: "Tuesday & Thursday, 19:00", who: "Managed by Dean Ashworth",
    next: [
      { opponent: "Handsworth Parramore", when: "Sat 9 Aug, 15:00", home: true, competition: "League" },
      { opponent: "Stocksbridge Reserves", when: "Sat 16 Aug, 15:00", home: false, competition: "League" },
    ],
  },
  {
    name: "Reserves", league: "County Senior League, Reserve Division",
    trains: "Tuesday, 19:00", who: "Managed by Baz Whitworth",
    next: [
      { opponent: "Ecclesfield Red Rose", when: "Sat 9 Aug, 13:00", home: false, competition: "Reserve Division" },
      { opponent: "Hallam FC Reserves", when: "Sat 16 Aug, 13:00", home: true, competition: "Reserve Division" },
    ],
  },
  {
    name: "Women's first team", league: "Sheffield & Hallamshire Women's League",
    trains: "Wednesday, 19:00", who: "Managed by Kirsty Lam",
    next: [
      { opponent: "Dronfield Town Women", when: "Sun 10 Aug, 14:00", home: true, competition: "League" },
      { opponent: "Rotherham United Women", when: "Sun 17 Aug, 14:00", home: false, competition: "League Cup R1" },
    ],
  },
  {
    name: "Under-18s", league: "Youth Alliance",
    trains: "Monday, 18:00", who: "Managed by Sara Coombes, FA Level 2",
    next: [
      { opponent: "Penistone Church U18", when: "Sun 10 Aug, 11:00", home: true, competition: "Youth Alliance" },
      { opponent: "Worsbrough Bridge U18", when: "Sun 17 Aug, 11:00", home: false, competition: "Youth Alliance" },
    ],
  },
];
function P() {
  return (
    <SiteChrome name="Walkley Wanderers" tagline="Four teams, one pitch, Sheffield & Hallamshire League."
      links={[{ label: "Home", href: "#/" }, { label: "Join", href: "#/join" }]}
      action={{ label: "Join the club", href: "#/join" }}>
      <div className="mx-auto max-w-6xl px-6 py-14">
        <SectionHeader eyebrow="The teams" title="Four sides, one pitch"
          description="Everybody trains at Rowel Bridge and everybody gets the same kit. That is a decision, not an accident." />
        <div className="mt-10 space-y-12">
          {SIDES.map((s) => (
            <article key={s.name} className="border-t border-border pt-8">
              <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr]">
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight">{s.name}</h2>
                  <p className="mt-2 text-base text-muted-foreground">{s.league}</p>
                  <dl className="mt-4 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
                    <div><dt className="text-muted-foreground">Trains</dt><dd className="font-medium">{s.trains}</dd></div>
                    <div><dt className="text-muted-foreground">Run by</dt><dd className="font-medium">{s.who}</dd></div>
                  </dl>
                  <FixtureList className="mt-6" heading="Next two" teamName={s.name} fixtures={s.next} />
                </div>
                <SafeImage src={null} alt={`${s.name}, Rowel Bridge`} ratio="4/3" />
              </div>
            </article>
          ))}
        </div>
        <section className="mt-14 border-t border-border pt-10">
          <SectionHeader eyebrow="Behind it" title="The people who make it happen"
            description="Nobody here is paid. Two of them have been doing it since the eighties." />
          <TeamGrid className="mt-8" items={[
            { name: "Dean Ashworth", role: "First team manager" },
            { name: "Kirsty Lam", role: "Women's first team" },
            { name: "Sara Coombes", role: "Under-18s, FA Level 2" },
            { name: "Baz Whitworth", role: "Reserves, and the nets" },
            { name: "Eileen Prior", role: "Secretary since 1989" },
            { name: "Malc Tunnicliffe", role: "Groundsman, and the bar" },
          ]} />
        </section>
      </div>
    </SiteChrome>
  );
}
