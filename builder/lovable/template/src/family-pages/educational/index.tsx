// educational — the curriculum is the spine, progress visible on it. A bread
// school: the outcome first, the six-week path with your place marked, the
// numbers where claimed, a graduate's word, and one enroll action repeated.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { CtaBand } from "@/components/ui/cta-band";
import { CurriculumPath } from "@/components/ui/curriculum-path";
import { Faq } from "@/components/ui/faq";
import { ProgressRing } from "@/components/ui/progress-ring";
import { SectionHeader } from "@/components/ui/section-header";
import { StatsBand } from "@/components/ui/stats-band";
import { Testimonial } from "@/components/ui/testimonial";
export const Route = createFileRoute("/")({ component: P });
function P() {
  return (
    <SiteChrome name="The Proving Room" tagline="Sourdough, taught slowly, online."
      links={[{ label: "The course", href: "#path" }, { label: "This week's lesson", href: "#/lesson" }, { label: "Questions", href: "#faq" }]}
      action={{ label: "Enroll — £79", href: "#/enroll" }}>

      <section className="border-b border-border bg-muted/40">
        <div className="mx-auto max-w-3xl px-6 py-14">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div>
              <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Online · six weeks · £79 once</p>
              <h1 className="mt-2 max-w-lg text-4xl font-semibold tracking-tight text-balance">Six weeks to a loaf you'd photograph</h1>
              <p className="mt-3 max-w-md text-lg text-muted-foreground">One module a week, a real baker on your photos, and a starter that won't die on you. Your starter leads; the schedule follows.</p>
            </div>
            <div className="text-center">
              <ProgressRing value={33} label="course" />
              <p className="mt-2 text-xs text-muted-foreground">A member, mid-week-three</p>
            </div>
          </div>
        </div>
      </section>

      {/* The ordered spine IS the page — outcome first, then the path to it. */}
      <section id="path" className="mx-auto max-w-2xl px-6 py-14">
        <SectionHeader eyebrow="The path" title="Week by week, in order" description="Locked weeks unlock as your starter is ready, not as a calendar says." />
        <CurriculumPath className="mt-6" onOpen={() => {}} modules={[
          { key: "starter", title: "Week 1 — A starter that lives", meta: "5 lessons · 40 min", state: "done" },
          { key: "flour", title: "Week 2 — Flour, water, salt", meta: "4 lessons · 35 min", state: "done" },
          { key: "fold", title: "Week 3 — Folding and time", meta: "6 lessons · 50 min — continue on the lesson page", state: "current" },
          { key: "shape", title: "Week 4 — Shaping without fear", meta: "5 lessons · 45 min", state: "todo" },
          { key: "bake", title: "Week 5 — Heat and steam", meta: "4 lessons · 40 min", state: "locked" },
          { key: "beyond", title: "Week 6 — Rye, spelt, and what's next", meta: "5 lessons · 45 min", state: "locked" }]} />
        <p className="mt-4 text-sm"><a className="font-medium underline underline-offset-4" href="#/lesson">See a lesson exactly as members do →</a></p>
      </section>

      <section className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-3xl px-6 py-12">
          <StatsBand items={[
            { value: "2,140", label: "Bakers through" }, { value: "94%", label: "Finish the six weeks" },
            { value: "4.9", label: "Course rating" }, { value: "1 day", label: "Tutor reply, usually" }]} />
          <Testimonial className="mt-8" item={{ quote: "Week one kept the starter alive. Week four fixed the flat loaves. Week six I was giving bread away to be liked.", name: "Marta O", role: "September cohort" }} />
        </div>
      </section>

      <section id="faq" className="mx-auto max-w-2xl px-6 py-12">
        <SectionHeader eyebrow="Before you ask" title="The two everyone asks" />
        <Faq className="mt-6" items={[
          { question: "What if my starter dies?", answer: "It won't — week one exists to make it unkillable. If it somehow does, we post you ours and the refund is automatic." },
          { question: "How much time per week?", answer: "About three hours, folded around real life. Bread waits better than people think." }]} />
      </section>

      <section className="mx-auto max-w-3xl px-6 pb-16">
        <CtaBand title="The September cohort is filling" description="£79 once — no subscription, yours forever, refund automatic if week one fails you." action={{ label: "Enroll", href: "#/enroll" }} />
      </section>
    </SiteChrome>
  );
}
