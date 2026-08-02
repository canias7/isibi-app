// nursery /day — what a day actually looks like. The page that answers the
// question a parent cannot ask on a tour without feeling rude: what is my child
// doing between nine and six, and who is with them.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { Faq } from "@/components/ui/faq";
import { Gallery } from "@/components/ui/gallery";
import { SafeImage } from "@/components/ui/safe-image";
import { SectionHeader } from "@/components/ui/section-header";
import { TeamGrid } from "@/components/ui/team-grid";
export const Route = createFileRoute("/day")({ component: P });
const TIMELINE = [
  { time: "08:00", what: "Doors open", detail: "Breakfast until nine for anybody who wants it. Toast, cereal, fruit. Nobody is made to eat." },
  { time: "09:15", what: "Registration and singing", detail: "Ten minutes, all rooms. This is where the day's plan gets explained to the children rather than to us." },
  { time: "09:30", what: "Free play, indoors and out", detail: "The garden door is open whatever the weather. Waterproofs and wellies are here, so nothing needs bringing." },
  { time: "11:30", what: "Lunch", detail: "Cooked on site by Lorraine. One menu, adapted for allergies and for what a family does not eat. Children serve themselves." },
  { time: "12:30", what: "Sleep or quiet", detail: "Under-2s sleep on their own rhythm, not on a timetable. Older children get books and a dark corner and are not made to lie down." },
  { time: "14:00", what: "Adult-led activity", detail: "Cooking, painting, the music teacher on a Wednesday. Twenty minutes, and joining in is optional." },
  { time: "15:00", what: "Snack, then out again", detail: "Fruit and milk. The garden until it goes dark, and then the big room." },
  { time: "16:30", what: "Wind-down", detail: "Stories, puzzles, the sand tray. This is when most pick-ups happen and a calm room makes that easier." },
  { time: "18:00", what: "Doors close", detail: "We ring at ten past if nobody has arrived. It happens and nobody is made to feel bad about it." },
];
function P() {
  return (
    <SiteChrome name="Bole Hills Nursery" tagline="A 42-place nursery and pre-school in Walkley, Sheffield."
      links={[{ label: "Home", href: "#/" }, { label: "Come and look", href: "#/visit" }]}
      action={{ label: "Book a visit", href: "#/visit" }}>

      <div className="mx-auto max-w-6xl px-6 py-14">
        <SectionHeader eyebrow="A day here" title="Eight till six, hour by hour"
          description="This is a real Tuesday rather than a policy document. The times move about — a good morning outside is not interrupted because the plan said painting." />

        <div className="mt-10 grid gap-12 lg:grid-cols-[1.15fr_1fr]">
          <ol className="border-t border-border">
            {TIMELINE.map((t) => (
              <li key={t.time} className="grid grid-cols-[4.5rem_1fr] gap-4 border-b border-border py-5">
                <span className="text-sm tabular-nums text-muted-foreground">{t.time}</span>
                <span>
                  <span className="block font-medium">{t.what}</span>
                  <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">{t.detail}</span>
                </span>
              </li>
            ))}
          </ol>
          <div className="space-y-4">
            <SafeImage src={null} alt="Breakfast, about half eight" ratio="4/3" />
            <SafeImage src={null} alt="The garden in November" ratio="4/3" />
            <SafeImage src={null} alt="Lunch, served by the children" ratio="4/3" />
          </div>
        </div>

        <section className="mt-14 border-t border-border pt-10">
          <SectionHeader eyebrow="The food" title="Cooked here, and the menu is on the wall"
            description="Four weeks on rotation, published in advance, and the same meal for everybody with the substitutions written next to it rather than made quietly at the side." />
          <div className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { d: "Monday", m: "Shepherd's pie, greens, apple crumble" },
              { d: "Tuesday", m: "Chickpea curry, rice, yoghurt and fruit" },
              { d: "Wednesday", m: "Fish pie, peas, rice pudding" },
              { d: "Thursday", m: "Pasta bake, salad, banana bread" },
            ].map((x) => (
              <div key={x.d} className="border-t border-border pt-4">
                <p className="text-sm font-medium">{x.d}</p>
                <p className="mt-1 text-sm text-muted-foreground">{x.m}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <SectionHeader eyebrow="Who is with them" title="The people in the rooms"
            description="Every room has at least one person with a level 3 qualification and one paediatric first-aider on site at all times. Staff turnover last year was one person, who moved to Leeds." />
          <TeamGrid className="mt-8" items={[
            { name: "Steph Bower", role: "Manager, EYPS" },
            { name: "Josie Kerrigan", role: "Under-2s room lead" },
            { name: "Adaeze Nwosu", role: "2s room lead" },
            { name: "Ryan Timms", role: "Pre-school lead" },
            { name: "Lorraine Peck", role: "Cook, twelve years" },
            { name: "Bea Sutcliffe", role: "SENCO" },
            { name: "Halima Yusuf", role: "Early years practitioner" },
            { name: "Connor Wade", role: "Apprentice" },
          ]} />
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <SectionHeader eyebrow="The place" title="Two rooms, a garden and the hill behind it" />
          <Gallery className="mt-8" columns={4} items={[
            { src: null, alt: "The under-2s room" },
            { src: null, alt: "The pre-school room" },
            { src: null, alt: "The garden, from the gate" },
            { src: null, alt: "The mud kitchen" },
            { src: null, alt: "The book corner" },
            { src: null, alt: "The sleep room" },
            { src: null, alt: "Bole Hills, five minutes up the road" },
            { src: null, alt: "The entrance on Cundy Street" },
          ]} />
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <div className="max-w-3xl">
            <SectionHeader eyebrow="Asked often" title="About the day itself" />
            <Faq className="mt-6" items={[
              { question: "What if my child will not sleep?", answer: "Then they do not sleep. Under-2s follow their own rhythm and older children are never made to lie down — they get books and a quiet corner instead." },
              { question: "How much time is spent outside?", answer: "Most of it, most days. The garden door is open from half nine and the waterproofs are ours, so nothing needs sending in." },
              { question: "Will I hear how the day went?", answer: "Yes, in person at pick-up, and on the app the same evening with photographs. If something went badly you hear that too — that is the point of it." },
              { question: "What about screens?", answer: "None, except the interactive whiteboard for the music session on a Wednesday. Not a moral position, just what the room is for." },
              { question: "Can I drop in during the day?", answer: "Yes. Ring the bell. We have never turned a parent away and we would rather you saw an ordinary hour than a tidied one." },
            ]} />
          </div>
        </section>
      </div>
    </SiteChrome>
  );
}
