// sports-club — FIXTURES-FIRST: the next fixture and the last result are the
// news. Results are a table, not prose, because supporters scan them.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { CtaBand } from "@/components/ui/cta-band";
import { FixtureList } from "@/components/ui/fixture-list";
import { LeagueTable } from "@/components/ui/league-table";
import { LocationCard } from "@/components/ui/location-card";
import { SafeImage } from "@/components/ui/safe-image";
import { SectionHeader } from "@/components/ui/section-header";
import { StatsBand } from "@/components/ui/stats-band";
import { Testimonial } from "@/components/ui/testimonial";
export const Route = createFileRoute("/")({ component: P });
function P() {
  return (
    <SiteChrome name="Walkley Wanderers" tagline="Four teams, one pitch, Sheffield & Hallamshire League."
      links={[{ label: "Teams", href: "/teams" }, { label: "Join", href: "/join" }, { label: "The ground", href: "#ground" }]}
      action={{ label: "Join the club", href: "/join" }}>

      <section className="border-b border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="grid items-start gap-10 lg:grid-cols-[1fr_1fr]">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Founded 1946 · Sheffield &amp; Hallamshire County Senior League</p>
              <h1 className="mt-3 text-5xl font-semibold tracking-tight text-balance">Walkley Wanderers</h1>
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted-foreground">
                First team, reserves, under-18s and a women's side. Everybody trains at Rowel Bridge on a
                Tuesday and the bar is open whether we won or not.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <a className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground" href="/join">Trials and subs</a>
                <a className="rounded-md border border-border px-5 py-2.5 text-sm font-medium" href="#ground">Find the ground</a>
              </div>
              <div className="mt-10 grid grid-cols-2 gap-4">
                <SafeImage src={null} alt="Saturday at Rowel Bridge" ratio="4/3" />
                <SafeImage src={null} alt="The clubhouse and the bar" ratio="4/3" />
              </div>
            </div>
            <div className="space-y-8">
              <FixtureList heading="Next up" teamName="Wanderers" fixtures={[
                { opponent: "Handsworth Parramore", when: "Sat 9 Aug, 15:00", home: true, competition: "League", venue: "Rowel Bridge" },
                { opponent: "Stocksbridge Reserves", when: "Sat 16 Aug, 15:00", home: false, competition: "League" },
                { opponent: "Hallam FC", when: "Tue 19 Aug, 19:45", home: true, competition: "County Cup R1", venue: "Rowel Bridge" },
              ]} />
              <FixtureList heading="Last three" teamName="Wanderers" fixtures={[
                { opponent: "Penistone Church", when: "Sat 2 Aug", home: true, score: { us: 3, them: 1 }, competition: "League" },
                { opponent: "Dronfield Town", when: "Sat 26 Jul", home: false, score: { us: 1, them: 1 }, competition: "League" },
                { opponent: "Worsbrough Bridge", when: "Sat 19 Jul", home: false, postponed: true, competition: "League" },
              ]} />
            </div>
          </div>
          <div className="mt-12 border-t border-border pt-10">
            <StatsBand items={[
              { value: "4", label: "Teams, from under-18s to the firsts" },
              { value: "1946", label: "Founded, same pitch since" },
              { value: "£4", label: "On the gate, under-16s free" },
              { value: "£90", label: "A season's subs, payable monthly" },
            ]} />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <SectionHeader eyebrow="The table" title="Where we are"
            description="County Senior League, Division One. Eleven played, and it is tighter than it looks." />
          <a className="text-sm font-medium underline underline-offset-4" href="/teams">All four teams →</a>
        </div>
        <LeagueTable className="mt-8" caption="County Senior League, Division One" rows={[
          { team: "Handsworth Parramore", played: 11, won: 8, drawn: 2, lost: 1, for: 24, against: 9 },
          { team: "Hallam FC", played: 11, won: 7, drawn: 3, lost: 1, for: 21, against: 11 },
          { team: "Walkley Wanderers", played: 11, won: 7, drawn: 1, lost: 3, for: 22, against: 14, us: true },
          { team: "Penistone Church", played: 11, won: 6, drawn: 2, lost: 3, for: 18, against: 13 },
          { team: "Stocksbridge Reserves", played: 11, won: 4, drawn: 4, lost: 3, for: 15, against: 15 },
          { team: "Dronfield Town", played: 11, won: 3, drawn: 3, lost: 5, for: 12, against: 18 },
          { team: "Worsbrough Bridge", played: 10, won: 2, drawn: 2, lost: 6, for: 9, against: 21, zone: "Relegation" },
          { team: "Ecclesfield Red Rose", played: 11, won: 1, drawn: 1, lost: 9, for: 7, against: 27 },
        ]} />
      </section>

      <section className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <SectionHeader eyebrow="The club" title="What being in it is like" />
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            <Testimonial item={{ quote: "Came for a trial at nineteen, still here at forty-one, now I do the nets on a Tuesday.", name: "Baz Whitworth", role: "Reserves, then coach" }} />
            <Testimonial item={{ quote: "The women's side started with seven of us and a borrowed kit. Two seasons later we have a bench.", name: "Kirsty Lam", role: "Captain, women's first team" }} />
            <Testimonial item={{ quote: "Under-18s get the same pitch and the same kit as the firsts. That was not true at my last club.", name: "Ade Osei", role: "Parent" }} />
          </div>
        </div>
      </section>

      <section id="ground" className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr]">
          <div>
            <SectionHeader eyebrow="The ground" title="Rowel Bridge" />
            <LocationCard className="mt-6" name="Rowel Bridge, Walkley Wanderers FC" address="Rowel Bridge Lane, Walkley, Sheffield, S6 5AN"
              note="The 95 stops at the top of the lane. Parking on the road, not the field — the field is the field." />
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              One stand, 120 seats, a covered terrace behind the far goal and a bar that opens at two and
              shuts when the last person leaves.
            </p>
          </div>
          <SafeImage src={null} alt="The stand at Rowel Bridge" ratio="16/9" />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <CtaBand title="Trials are open, all four teams"
          description="Tuesdays at seven, Rowel Bridge. Turn up in boots — there is nothing to fill in beforehand."
          action={{ label: "How to join", href: "/join" }} />
      </section>
    </SiteChrome>
  );
}
