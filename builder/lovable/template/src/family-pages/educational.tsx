// educational — the curriculum is the spine, progress visible on it.
// A bread school's flagship course.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { CurriculumPath } from "@/components/ui/curriculum-path";
import { Faq } from "@/components/ui/faq";
import { ProgressRing } from "@/components/ui/progress-ring";
import { StatsBand } from "@/components/ui/stats-band";
export const Route = createFileRoute("/")({ component: P });
function P() {
  return (
    <SiteChrome name="The Proving Room" tagline="Sourdough, taught slowly, online."
      links={[{ label: "The course", href: "#path" }, { label: "Questions", href: "#faq" }]}
      action={{ label: "Enroll — £79", href: "#path" }}>
      <div className="mx-auto max-w-2xl px-6 py-12">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Six weeks to a real loaf</h1>
            <p className="mt-2 text-muted-foreground">One module a week. Your starter leads, the schedule follows.</p>
          </div>
          <ProgressRing value={33} label="course" />
        </div>
        {/* The ordered spine IS the page — outcome first, then the path to it. */}
        <section id="path" className="mt-8">
          <CurriculumPath onOpen={() => {}} modules={[
            { key: "starter", title: "Week 1 — A starter that lives", meta: "5 lessons · 40 min", state: "done" },
            { key: "flour", title: "Week 2 — Flour, water, salt", meta: "4 lessons · 35 min", state: "done" },
            { key: "fold", title: "Week 3 — Folding and time", meta: "6 lessons · 50 min", state: "current" },
            { key: "shape", title: "Week 4 — Shaping without fear", meta: "5 lessons · 45 min", state: "todo" },
            { key: "bake", title: "Week 5 — Heat and steam", meta: "4 lessons · 40 min", state: "locked" },
            { key: "beyond", title: "Week 6 — Rye, spelt, and what's next", meta: "5 lessons · 45 min", state: "locked" }]} />
        </section>
        <div className="mt-10"><StatsBand items={[
          { value: "2,140", label: "Bakers through" }, { value: "94%", label: "Finish the six weeks" },
          { value: "4.9", label: "Course rating" }]} /></div>
        <section id="faq" className="mt-10"><Faq items={[
          { question: "What if my starter dies?", answer: "It won't — week one exists to make it unkillable. If it does, we post you ours." },
          { question: "How much time per week?", answer: "About three hours, folded around real life. Bread waits better than people think." }]} /></section>
      </div>
    </SiteChrome>
  );
}
