// recruiting-first — the roles above any culture copy; proof beside the list.
// A design studio's careers page.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { FilterBar } from "@/components/ui/filter-bar";
import { JobCard } from "@/components/ui/job-card";
import { StatsBand } from "@/components/ui/stats-band";
import { Steps } from "@/components/ui/steps";
import { TeamGrid } from "@/components/ui/team-grid";
export const Route = createFileRoute("/")({ component: P });
function P() {
  return (
    <SiteChrome name="Kelham Works" tagline="A 14-person product studio by the river."
      links={[{ label: "Open roles", href: "#roles" }, { label: "How we hire", href: "#how" }]}>
      <div className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-tight">Three open chairs</h1>
        {/* Roles first. The culture section EARNS its place below the list. */}
        <div className="mt-4"><FilterBar filters={[{ key: "loc", label: "Sheffield or remote" }]} onRemove={() => {}} /></div>
        <div id="roles" className="mt-4 grid gap-4">
          <JobCard title="Senior product designer" team="Design" location="Kelham Island · hybrid" type="Full time" salary="£55–65k" postedAt="2026-07-24" href="#/role" tags={["Figma", "Design systems"]} />
          <JobCard title="TypeScript engineer" team="Build" location="Remote UK" type="Full time" salary="£60–72k" postedAt="2026-07-28" href="#/role" tags={["React", "Node"]} />
          <JobCard title="Studio coordinator" team="Ops" location="Kelham Island" type="4 days" salary="£28–32k pro rata" postedAt="2026-07-30" href="#/role" />
        </div>
        <div className="mt-10"><StatsBand items={[
          { value: "14", label: "People" }, { value: "4.6 yrs", label: "Median tenure" },
          { value: "32 hrs", label: "The week, in summer" }, { value: "0", label: "Open-plan phone booths" }]} /></div>
        <section id="how" className="mt-10">
          <h2 className="text-lg font-medium">How we hire</h2>
          <Steps className="mt-4" items={[
            { title: "A call", description: "45 minutes, both ways" },
            { title: "Paid task", description: "Half a day at day rate" },
            { title: "Meet the room", description: "An afternoon with the team" }]} />
        </section>
        <section className="mt-10"><TeamGrid items={[
          { name: "Rosa Vane", role: "Founder" }, { name: "Theo Marsh", role: "Design lead" },
          { name: "Ana Silva", role: "Engineering lead" }, { name: "You, possibly", role: "See above" }]} /></section>
      </div>
    </SiteChrome>
  );
}
