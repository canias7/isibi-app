// careers — BENTO structure: the roles are the biggest tile because
// they are the point, and every culture claim gets exactly the cell its
// evidence deserves. A wall you scan, not a pitch you scroll.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { BentoGrid } from "@/components/ui/bento-grid";
import { FilterBar } from "@/components/ui/filter-bar";
import { JobCard } from "@/components/ui/job-card";
import { SafeImage } from "@/components/ui/safe-image";
import { Steps } from "@/components/ui/steps";
import { TeamGrid } from "@/components/ui/team-grid";
export const Route = createFileRoute("/")({ component: P });
function P() {
  return (
    <SiteChrome name="Kelham Works" tagline="A 14-person product studio by the river."
      links={[{ label: "Working here", href: "/life" }, { label: "The role", href: "/role" }]}>

      <div className="mx-auto max-w-6xl px-6 py-10">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Kelham Island · 14 people · hiring 3</p>
        <h1 className="mt-2 max-w-xl text-4xl font-semibold tracking-tight">Three open chairs by the river</h1>

        <BentoGrid className="mt-8" items={[
          { span: 2, tall: true, content: (
            <div className="flex h-full flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">Open now</p>
                <FilterBar filters={[{ key: "loc", label: "Sheffield or remote" }]} onRemove={() => {}} />
              </div>
              <JobCard title="Senior product designer" team="Design" location="Kelham Island · hybrid" type="Full time" salary="£55–65k" postedAt="2026-07-24" href="/role" tags={["Figma", "Design systems"]} />
              <JobCard title="TypeScript engineer" team="Build" location="Remote UK" type="Full time" salary="£60–72k" postedAt="2026-07-28" href="/role" tags={["React", "Node"]} />
              <JobCard title="Studio coordinator" team="Ops" location="Kelham Island" type="4 days" salary="£28–32k pro rata" postedAt="2026-07-30" href="/role" />
              <p className="mt-auto text-xs text-muted-foreground">Answer inside a week, including the noes — studio rule.</p>
            </div>
          ) },
          { content: <div><p className="text-3xl font-semibold tabular-nums">4.6 yrs</p><p className="mt-1 text-sm text-muted-foreground">median tenure, 14 people</p></div> },
          { content: <div><p className="text-3xl font-semibold tabular-nums">32 hrs</p><p className="mt-1 text-sm text-muted-foreground">the week, June to August, same pay</p></div> },
          { tall: true, content: (
            <div className="flex h-full flex-col">
              <SafeImage src={null} alt="The long bench, morning" ratio="4/5" />
              <p className="mt-3 text-sm text-muted-foreground">The room — one bench, no booths. <a className="font-medium underline underline-offset-4" href="/life">See a real week →</a></p>
            </div>
          ) },
          { content: <div><p className="font-medium">Bands on the wiki</p><p className="mt-1 text-sm text-muted-foreground">Every salary band public internally. Where you land is set by the paid task, not negotiation stamina.</p></div> },
          { content: <div><p className="text-3xl font-semibold tabular-nums">6 mo</p><p className="mt-1 text-sm text-muted-foreground">parental leave at full pay, either parent, day one</p></div> },
          { span: 2, content: (
            <div>
              <p className="font-medium">The room you'd join</p>
              <TeamGrid className="mt-3" items={[
                { name: "Rosa Vane", role: "Founder" }, { name: "Theo Marsh", role: "Design lead" },
                { name: "Ana Silva", role: "Engineering lead" }, { name: "You, possibly", role: "See above" }]} />
            </div>
          ) },
          { span: 2, content: (
            <div>
              <p className="font-medium">How hiring works</p>
              <Steps className="mt-3" items={[
                { title: "A call", description: "45 minutes, both ways" },
                { title: "Paid task", description: "Half a day at your day rate" },
                { title: "Meet the room", description: "An afternoon with the team" }]} />
            </div>
          ) },
        ]} />

        <p className="mt-8 rounded-lg border bg-muted/40 p-4 text-sm">The senior design chair is the urgent one — <a className="font-medium underline underline-offset-4" href="/role">the full description and the ten-minute apply form →</a></p>
      </div>
    </SiteChrome>
  );
}
