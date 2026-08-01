// recruiting-first — the roles above any culture copy; the proof beside the
// list, not instead of it. A design studio: three open chairs up top, the
// numbers that make the claims checkable, how hiring works, and the people.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { CtaBand } from "@/components/ui/cta-band";
import { FilterBar } from "@/components/ui/filter-bar";
import { JobCard } from "@/components/ui/job-card";
import { SectionHeader } from "@/components/ui/section-header";
import { StatsBand } from "@/components/ui/stats-band";
import { Steps } from "@/components/ui/steps";
import { TeamGrid } from "@/components/ui/team-grid";
import { Testimonial } from "@/components/ui/testimonial";
export const Route = createFileRoute("/")({ component: P });
function P() {
  return (
    <SiteChrome name="Kelham Works" tagline="A 14-person product studio by the river."
      links={[{ label: "Open roles", href: "#roles" }, { label: "Working here", href: "#/life" }, { label: "How we hire", href: "#how" }]}>

      <section className="border-b border-border bg-muted/40">
        <div className="mx-auto max-w-3xl px-6 py-14">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Kelham Island · 14 people · hiring 3</p>
          <h1 className="mt-2 max-w-xl text-4xl font-semibold tracking-tight text-balance">Three open chairs by the river</h1>
          <p className="mt-3 max-w-lg text-lg text-muted-foreground">Salary bands published, a paid task instead of interview theatre, and an answer inside a week — including the noes.</p>
        </div>
      </section>

      {/* Roles first. The culture section EARNS its place below the list. */}
      <section id="roles" className="mx-auto max-w-3xl px-6 py-12">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionHeader eyebrow="Open now" title="The roles" />
          <FilterBar filters={[{ key: "loc", label: "Sheffield or remote" }]} onRemove={() => {}} />
        </div>
        <div className="mt-6 grid gap-4">
          <JobCard title="Senior product designer" team="Design" location="Kelham Island · hybrid" type="Full time" salary="£55–65k" postedAt="2026-07-24" href="#/role" tags={["Figma", "Design systems"]} />
          <JobCard title="TypeScript engineer" team="Build" location="Remote UK" type="Full time" salary="£60–72k" postedAt="2026-07-28" href="#/role" tags={["React", "Node"]} />
          <JobCard title="Studio coordinator" team="Ops" location="Kelham Island" type="4 days" salary="£28–32k pro rata" postedAt="2026-07-30" href="#/role" />
        </div>
      </section>

      <section className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-3xl px-6 py-12">
          <SectionHeader eyebrow="Checkable claims only" title="The numbers behind the pitch" />
          <StatsBand className="mt-6" items={[
            { value: "14", label: "People" }, { value: "4.6 yrs", label: "Median tenure" },
            { value: "32 hrs", label: "The week, in summer" }, { value: "100%", label: "Salary bands on the wiki" }]} />
          <Testimonial className="mt-8" item={{ quote: "I took the pay cut to come here and un-took it within a year. The 32-hour summer is real — my allotment can confirm.", name: "Priya Chandra", role: "Engineer, year two" }} />
          <p className="mt-4 text-sm"><a className="font-medium underline underline-offset-4" href="#/life">A real week, the room, the benefits as facts →</a></p>
        </div>
      </section>

      <section id="how" className="mx-auto max-w-3xl px-6 py-14">
        <SectionHeader eyebrow="How we hire" title="Three steps, no theatre" />
        <Steps className="mt-6" items={[
          { title: "A call", description: "45 minutes, both ways — you're interviewing us too" },
          { title: "Paid task", description: "Half a day at your day rate, on something real" },
          { title: "Meet the room", description: "An afternoon with the team you'd join" }]} />
      </section>

      <section className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-5xl px-6 py-14">
          <SectionHeader eyebrow="Who's here" title="The room you'd join" />
          <TeamGrid className="mt-8" items={[
            { name: "Rosa Vane", role: "Founder" }, { name: "Theo Marsh", role: "Design lead" },
            { name: "Ana Silva", role: "Engineering lead" }, { name: "You, possibly", role: "See above" }]} />
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 py-14">
        <CtaBand title="The senior design chair is the urgent one" description="Full description, the actual week, and the apply form — ten minutes, no portal." action={{ label: "Read the role", href: "#/role" }} />
      </section>
    </SiteChrome>
  );
}
