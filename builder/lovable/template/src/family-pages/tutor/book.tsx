// tutor /book — pick a slot for the trial. The rates repeat here because
// "which level" and "which slot" are the same booking, and a form that asks for
// a level without showing what it costs is asking somebody to commit blind.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { AvailabilityGrid } from "@/components/ui/availability-grid";
import { ContactForm } from "@/components/ui/contact-form";
import { Faq } from "@/components/ui/faq";
import { SectionHeader } from "@/components/ui/section-header";
import { SubjectList } from "@/components/ui/subject-list";
import { SUBJECTS } from "./index";
export const Route = createFileRoute("/book")({ component: P });
function P() {
  return (
    <SiteChrome name="Cathy Bramwell" tagline="Maths and physics tutor, Sheffield. Fourteen years, eleven of them teaching."
      links={[{ label: "Home", href: "#/" }, { label: "About me", href: "#/about" }]}
      action={{ label: "Free trial lesson", href: "#form" }}>

      <div className="mx-auto max-w-6xl px-6 py-14">
        <SectionHeader eyebrow="Book" title="The first one is free, and it is a real lesson"
          description="Forty-five minutes, not a sales call. We do actual work, and at the end I will tell you honestly whether I think I am the right person — which about one in six times I am not." />

        <div className="mt-10 grid gap-12 lg:grid-cols-[1fr_1fr]">
          <div>
            <h2 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">Free slots this week</h2>
            <p className="mt-2 text-base text-muted-foreground">
              Struck through is taken. A trial can go in any free slot; once you start, the slot is
              yours every week for the term.
            </p>
            <AvailabilityGrid className="mt-4"
              slots={["Mon 16:30", "Mon 17:45", "Mon 19:00", "Tue 16:30", "Tue 17:45", "Tue 19:00", "Wed 16:30", "Wed 17:45", "Thu 16:30", "Thu 17:45", "Thu 19:00", "Sat 09:00", "Sat 10:30", "Sat 12:00"]}
              taken={["Mon 16:30", "Mon 17:45", "Tue 17:45", "Wed 16:30", "Thu 16:30", "Thu 17:45", "Sat 09:00", "Sat 10:30"]} />

            <h2 className="mt-10 text-sm font-medium uppercase tracking-widest text-muted-foreground">Where</h2>
            <ul className="mt-3 divide-y divide-border border-y border-border text-base">
              <li className="py-3"><span className="font-medium">At mine, S7</span> — a room off the hall with a door left open. Parking on the street outside.</li>
              <li className="py-3"><span className="font-medium">At yours, S7 or S11 only</span> — same rate. Anywhere further and the travel eats the next slot.</li>
              <li className="py-3"><span className="font-medium">Online</span> — same rate, shared whiteboard, and I send the page after. Genuinely as good for maths.</li>
            </ul>

            <h2 className="mt-10 text-sm font-medium uppercase tracking-widest text-muted-foreground">Bring, if you have it</h2>
            <ul className="mt-3 divide-y divide-border border-y border-border text-base">
              <li className="py-3">The last report or mock paper, including the mark scheme if you got one</li>
              <li className="py-3">Which exam board — it is on the front of the textbook</li>
              <li className="py-3">The specific topic that is going wrong, if you know it</li>
              <li className="py-3">A calculator, if the level uses one</li>
            </ul>
          </div>

          <div id="form">
            <SectionHeader eyebrow="Ask for a slot" title="Say the subject, the level and two times that work"
              description="I answer these myself, usually the same evening. There is no booking system and there is nobody else here." />
            <ContactForm className="mt-6" askPhone onSubmit={() => {}} />

            <h2 className="mt-10 text-sm font-medium uppercase tracking-widest text-muted-foreground">After the trial</h2>
            <ol className="mt-3 divide-y divide-border border-y border-border text-base">
              <li className="py-3"><span className="font-medium">I email you that evening</span> — what I think the gap is, and whether I can help.</li>
              <li className="py-3"><span className="font-medium">You decide, not on the day</span> — nobody is asked to commit at the end of a free lesson.</li>
              <li className="py-3"><span className="font-medium">The slot becomes yours</span> — same time every week for the term.</li>
              <li className="py-3"><span className="font-medium">Pay after each lesson</span> — bank transfer, or ten up front for five percent off if you would rather.</li>
            </ol>
          </div>
        </div>

        <section className="mt-14 border-t border-border pt-10">
          <SectionHeader eyebrow="Rates" title="So you know before you book"
            description="The same table as the home page. A form that asks for a level without showing what that level costs is asking somebody to commit blind." />
          <div className="mt-8 grid gap-x-14 gap-y-12 lg:grid-cols-2">
            <SubjectList subjects={[SUBJECTS[0]]} />
            <SubjectList subjects={[SUBJECTS[1]]} />
          </div>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <div className="max-w-3xl">
            <SectionHeader eyebrow="Asked often" title="About booking" />
            <Faq className="mt-6" items={[
              { question: "How far ahead do slots go?", answer: "September fills in July and stays full until Christmas. January and the Easter term are easier, and there is almost always something in the summer." },
              { question: "Can we do two lessons a week before the exam?", answer: "In the last six weeks, yes, if I have the slot. Any earlier and it does not help — the limit is practice between lessons, not explanation inside them." },
              { question: "What if we need to cancel?", answer: "24 hours and there is no charge. Less than that and it is half, because the slot cannot be filled. That is the only rule I am strict about and I will say so at the trial." },
              { question: "Do you teach over the holidays?", answer: "A few slots at Easter and in October half term, aimed at people with an exam coming. Not over the summer unless it is a resit." },
              { question: "Can I book for two children?", answer: "Separate slots, and usually back to back so it is one trip. I will not teach two at once at different levels — it sounds efficient and it is worse for both." },
            ]} />
          </div>
        </section>
      </div>
    </SiteChrome>
  );
}
