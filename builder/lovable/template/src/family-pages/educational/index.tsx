// educational — SIDEBAR structure: the curriculum is a persistent left rail,
// the way every LMS a student has ever used works. Progress stays visible
// at every scroll position because the rail never leaves; the content well
// sells the course to whoever hasn't enrolled yet.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { CurriculumPath } from "@/components/ui/curriculum-path";
import { Faq } from "@/components/ui/faq";
import { ProgressRing } from "@/components/ui/progress-ring";
import { SidebarLayout } from "@/components/ui/sidebar-layout";
import { StatsBand } from "@/components/ui/stats-band";
import { Testimonial } from "@/components/ui/testimonial";
export const Route = createFileRoute("/")({ component: P });
function P() {
  return (
    <SiteChrome name="The Proving Room" tagline="Sourdough, taught slowly, online."
      links={[{ label: "This week's lesson", href: "#/lesson" }, { label: "Enroll", href: "#/enroll" }]}
      action={{ label: "Enroll — £79", href: "#/enroll" }}>

      <div className="mx-auto max-w-6xl px-6 py-10">
        <SidebarLayout width="17rem" aside={
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium">Your path</p>
              <ProgressRing value={33} label="course" />
            </div>
            <CurriculumPath className="mt-4" onOpen={() => {}} modules={[
              { key: "starter", title: "Wk 1 — A starter that lives", state: "done" },
              { key: "flour", title: "Wk 2 — Flour, water, salt", state: "done" },
              { key: "fold", title: "Wk 3 — Folding and time", meta: "continue →", state: "current" },
              { key: "shape", title: "Wk 4 — Shaping without fear", state: "todo" },
              { key: "bake", title: "Wk 5 — Heat and steam", state: "locked" },
              { key: "beyond", title: "Wk 6 — Rye and what's next", state: "locked" }]} />
            <a className="mt-4 block rounded-md bg-primary px-4 py-2 text-center text-sm font-medium text-primary-foreground" href="#/lesson">Continue week 3</a>
          </div>
        }>
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Online · six weeks · £79 once</p>
          <h1 className="mt-2 max-w-lg text-4xl font-semibold tracking-tight text-balance">Six weeks to a loaf you'd photograph</h1>
          <p className="mt-3 max-w-lg text-lg text-muted-foreground">One module a week, a real baker on your photos, and a starter that won't die on you. Your starter leads; the schedule follows.</p>

          <StatsBand className="mt-8" items={[
            { value: "2,140", label: "Bakers through" }, { value: "94%", label: "Finish the six weeks" },
            { value: "1 day", label: "Tutor reply, usually" }]} />

          <div className="mt-8 rounded-xl border bg-muted/40 p-5">
            <p className="text-sm font-medium">How a week works</p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Lessons land Monday. You bake once, midweek, photographing the one moment the lesson names — the fold that holds, the corner that stands. Your tutor comments on THAT photo, usually within a day. The next week unlocks when your starter is ready, not when a calendar says.</p>
          </div>

          <Testimonial className="mt-8" item={{ quote: "Week one kept the starter alive. Week four fixed the flat loaves. Week six I was giving bread away to be liked.", name: "Marta O", role: "September cohort" }} />

          <Faq className="mt-8" items={[
            { question: "What if my starter dies?", answer: "It won't — week one exists to make it unkillable. If it somehow does, we post you ours and the refund is automatic." },
            { question: "How much time per week?", answer: "About three hours, folded around real life. Bread waits better than people think." }]} />

          <p className="mt-8 rounded-lg border bg-muted/40 p-4 text-sm">September cohort is filling — <a className="font-medium underline underline-offset-4" href="#/enroll">what the £79 buys, and the one form →</a></p>
        </SidebarLayout>
      </div>
    </SiteChrome>
  );
}
