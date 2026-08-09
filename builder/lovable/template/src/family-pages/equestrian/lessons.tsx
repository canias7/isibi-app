// equestrian /lessons — by level, with places left, and what a first lesson is
// actually like. An adult beginner's real question is whether they will be the
// only adult beginner, and no riding school's website answers it.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { Faq } from "@/components/ui/faq";
import { RateCard } from "@/components/ui/rate-card";
import { SafeImage } from "@/components/ui/safe-image";
import { SectionHeader } from "@/components/ui/section-header";
import { SessionTable } from "@/components/ui/session-table";
import { TestimonialGrid } from "@/components/ui/testimonial";
import { QUOTES } from "./index";
export const Route = createFileRoute("/lessons")({ component: P });
function P() {
  return (
    <SiteChrome name="Hollin Busk Livery" tagline="Twenty-two stables, forty acres, and an arena that drains. Above Deepcar."
      links={[{ label: "Home", href: "/" }, { label: "The yard", href: "/yard" }]}
      action={{ label: "Ring 0114 288 9940", href: "tel:01142889940" }}>

      <div className="mx-auto max-w-6xl px-6 py-14">
        <SectionHeader eyebrow="Lessons" title="Six school horses, and adults are half of them"
          description="Which is the thing an adult beginner actually wants to know and which no riding school's website says. You will not be the only person over thirty in the arena; on a Wednesday evening you will not be the only one over fifty." />

        <section className="mt-10 grid gap-12 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <SessionTable fundedLabel="Beginners welcome in this one"
              days={[
                { day: "Tuesday", sessions: [
                  { name: "Adult beginners", from: "18:00", to: "19:00", placesLeft: 2, funded: true, note: "Group of four. Half of them have never sat on a horse" },
                  { name: "Adult improvers", from: "19:15", to: "20:15", placesLeft: 0, note: "Full since March, and there is a list of two" },
                ] },
                { day: "Wednesday", sessions: [
                  { name: "Private, any level", from: "10:00", to: "17:00", note: "Booked by the hour. Ring for what is free this week" },
                  { name: "Adults 50+", from: "18:00", to: "19:00", placesLeft: 3, funded: true, note: "Started as a joke in 2021 and it is now the busiest thing we run" },
                ] },
                { day: "Thursday", sessions: [
                  { name: "Children, 8–12, beginners", from: "17:00", to: "18:00", placesLeft: 1, funded: true },
                  { name: "Children, 8–16, jumping", from: "18:15", to: "19:15", placesLeft: 2 },
                ] },
                { day: "Saturday", sessions: [
                  { name: "Children, 6–8, first lessons", from: "09:00", to: "09:45", placesLeft: 0, funded: true, note: "Full, with five waiting. We add a second class when it reaches eight" },
                  { name: "Children, 8–12", from: "10:00", to: "11:00", placesLeft: 2, funded: true },
                  { name: "Adult beginners", from: "11:15", to: "12:15", placesLeft: 4, funded: true },
                  { name: "Hack, all levels", from: "13:00", to: "15:00", placesLeft: 3, note: "Two hours on the moor. You need to be able to trot and stop" },
                ] },
                { day: "Sunday", sessions: [
                  { name: "Private and semi-private", from: "09:00", to: "13:00", note: "Booked by the hour" },
                  { name: "Hack, all levels", from: "13:00", to: "15:00", placesLeft: 1 },
                ] },
              ]} />
            <p className="mt-6 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              A blank places figure means we have not counted this week, not that it is full — ring
              and ask. Everything marked beginner genuinely means it: a first lesson here is
              twenty minutes of leading, twenty of walking, and about ten of trying to trot, and
              nobody has ever been embarrassed in this arena.
            </p>
          </div>
          <div>
            <SafeImage src={null} alt="An adult beginners' class on a Tuesday evening" ratio="4/3" />
            <h2 className="mt-8 text-sm font-medium uppercase tracking-widest text-muted-foreground">What it costs</h2>
            <RateCard className="mt-3" label="Lesson" unit="lesson" rates={[
              { period: "Group, one hour", units: 1, price: 34, note: "Four riders, one instructor" },
              { period: "Semi-private, one hour", units: 1, price: 46, note: "Two riders" },
              { period: "Private, one hour", units: 1, price: 62 },
              { period: "Private, 30 minutes", units: 1, price: 38, note: "What most children under eight should have" },
              { period: "Two-hour hack", units: 1, price: 58 },
              { period: "Block of ten group lessons", units: 10, price: 306, note: "Bought up front, used within six months. Saves £34" },
            ]} note="Hat and boots are lent free — you do not need to buy anything to try it. Body protectors for jumping are ours too. All instructors are BHS qualified and the school is BHS approved, which is inspected annually rather than bought." />
            <div className="mt-6 rounded-lg border border-border bg-muted/50 p-5">
              <p className="text-base font-medium">A first lesson, honestly</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                Forty-five minutes, on the ground first, and you will not be asked to do anything
                you are not ready for. You will ache the next day in places you did not expect —
                everybody does, it lasts two days, and it stops after about the fourth lesson.
                Wear leggings or jodhpurs rather than jeans, which chafe.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <SectionHeader eyebrow="From the yard" title="What people say about it" />
          <TestimonialGrid className="mt-8" columns={3} items={QUOTES} />
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <div className="max-w-3xl">
            <SectionHeader eyebrow="Asked often" title="About learning to ride" />
            <Faq className="mt-6" items={[
              { question: "Am I too old?", answer: "No. The 50+ class is the busiest thing we run and the oldest person who started here from scratch was 71. Fitness matters more than age and less than most people expect." },
              { question: "Is there a weight limit?", answer: "Nineteen stone, and it is about the horse rather than about you. Ring and we will tell you which of the six can carry what — it is a straightforward conversation and we would rather have it on the phone than at the mounting block." },
              { question: "What should I wear?", answer: "Leggings or jodhpurs, not jeans — the seams chafe badly. Boots with a small heel if you have them; if not, we lend. Hat is always ours and always free." },
              { question: "How many lessons until I can hack out?", answer: "About ten for most adults, sometimes six. You need to trot confidently and stop reliably, and we will tell you when rather than making you ask." },
              { question: "Can I book one lesson to try?", answer: "Yes, and most people should. No block, no membership, no direct debit. If you hate it you have spent £34 and an afternoon." },
              { question: "What if I am frightened of horses?", answer: "Quite a lot of people who start here are, including two who now have their own. Say so when you book and the first lesson becomes a ground-work one — no riding at all, and no charge if you decide against it." },
            ]} />
          </div>
        </section>
      </div>
    </SiteChrome>
  );
}
