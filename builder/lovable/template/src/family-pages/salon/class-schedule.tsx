// salon/class-schedule — A PILATES AND YOGA STUDIO. The base family's hero is
// the slot picker: which of today's free half-hours do you want.
//
// A class studio's answer to "when can I come" is not a set of gaps, it is a
// FIXED WEEKLY SHAPE that barely changes from month to month. Somebody deciding
// whether to join is asking whether there is a 6:30 on a Tuesday they can
// actually get to after work — a question about the whole week at once, which a
// day-at-a-time slot picker physically cannot show. So the timetable is the
// hero, seven days across, and the booking action lives on each class rather
// than at the top of the page.
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { AvatarName } from "@/components/ui/avatar-name";
import { Faq } from "@/components/ui/faq";
import { PriceList } from "@/components/ui/price-list";
import { SafeImage } from "@/components/ui/safe-image";
import { SectionHeader } from "@/components/ui/section-header";
import { SlotCapacity } from "@/components/ui/slot-capacity";
import { StatsBand } from "@/components/ui/stats-band";
import { Testimonial } from "@/components/ui/testimonial";
import { TimeLaneGrid, type LaneBlock } from "@/components/ui/time-lane-grid";
import { TrustStrip } from "@/components/ui/trust-strip";
export const Route = createFileRoute("/class-schedule")({ component: P });
export const DAYS = [
  { key: "mon", label: "Monday" }, { key: "tue", label: "Tuesday" },
  { key: "wed", label: "Wednesday" }, { key: "thu", label: "Thursday" },
  { key: "fri", label: "Friday" }, { key: "sat", label: "Saturday" },
  { key: "sun", label: "Sunday" },
];
export type Klass = {
  id: string; lane: string; start: number; end: number;
  name: string; teacher: string; level: string; left: number; cap: number;
};
export const CLASSES: Klass[] = [
  { id: "m1", lane: "mon", start: 7, end: 7.75, name: "Mat pilates", teacher: "Ruth", level: "All", left: 4, cap: 14 },
  { id: "m2", lane: "mon", start: 9.5, end: 10.5, name: "Slow flow", teacher: "Ekow", level: "Beginners welcome", left: 9, cap: 16 },
  { id: "m3", lane: "mon", start: 18.5, end: 19.5, name: "Reformer", teacher: "Ruth", level: "Improvers", left: 0, cap: 8 },
  { id: "m4", lane: "mon", start: 19.75, end: 20.75, name: "Yin", teacher: "Nadia", level: "All", left: 6, cap: 16 },
  { id: "t1", lane: "tue", start: 6.5, end: 7.25, name: "Reformer", teacher: "Ruth", level: "All", left: 2, cap: 8 },
  { id: "t2", lane: "tue", start: 10, end: 11, name: "Pregnancy yoga", teacher: "Nadia", level: "From 14 weeks", left: 5, cap: 10 },
  { id: "t3", lane: "tue", start: 12.25, end: 12.9, name: "Lunch express", teacher: "Ekow", level: "All", left: 11, cap: 16 },
  { id: "t4", lane: "tue", start: 18.5, end: 19.5, name: "Vinyasa", teacher: "Ekow", level: "Improvers", left: 1, cap: 18 },
  { id: "w1", lane: "wed", start: 7, end: 7.75, name: "Mat pilates", teacher: "Ruth", level: "All", left: 6, cap: 14 },
  { id: "w2", lane: "wed", start: 11, end: 12, name: "Gentle, over 60s", teacher: "Nadia", level: "Chairs available", left: 8, cap: 14 },
  { id: "w3", lane: "wed", start: 18.5, end: 19.5, name: "Reformer", teacher: "Ruth", level: "Beginners", left: 3, cap: 8 },
  { id: "w4", lane: "wed", start: 19.75, end: 20.75, name: "Vinyasa", teacher: "Ekow", level: "All", left: 7, cap: 18 },
  { id: "h1", lane: "thu", start: 6.5, end: 7.25, name: "Reformer", teacher: "Ruth", level: "Improvers", left: 0, cap: 8 },
  { id: "h2", lane: "thu", start: 9.5, end: 10.5, name: "Slow flow", teacher: "Nadia", level: "Beginners welcome", left: 10, cap: 16 },
  { id: "h3", lane: "thu", start: 18.5, end: 19.5, name: "Mat pilates", teacher: "Ruth", level: "All", left: 5, cap: 14 },
  { id: "h4", lane: "thu", start: 19.75, end: 21, name: "Restorative", teacher: "Nadia", level: "All", left: 12, cap: 16 },
  { id: "f1", lane: "fri", start: 7, end: 7.75, name: "Mat pilates", teacher: "Ekow", level: "All", left: 7, cap: 14 },
  { id: "f2", lane: "fri", start: 12.25, end: 12.9, name: "Lunch express", teacher: "Ruth", level: "All", left: 9, cap: 16 },
  { id: "f3", lane: "fri", start: 17.5, end: 18.5, name: "Friday unwind", teacher: "Nadia", level: "All", left: 2, cap: 18 },
  { id: "s1", lane: "sat", start: 8.5, end: 9.75, name: "Long flow", teacher: "Ekow", level: "Improvers", left: 4, cap: 18 },
  { id: "s2", lane: "sat", start: 10, end: 11, name: "Reformer", teacher: "Ruth", level: "All", left: 1, cap: 8 },
  { id: "s3", lane: "sat", start: 11.25, end: 12.25, name: "Family class", teacher: "Nadia", level: "Ages 6 up", left: 6, cap: 12 },
  { id: "u1", lane: "sun", start: 9.5, end: 10.75, name: "Slow Sunday", teacher: "Nadia", level: "All", left: 8, cap: 18 },
  { id: "u2", lane: "sun", start: 17, end: 18, name: "Reset", teacher: "Ekow", level: "All", left: 5, cap: 18 },
];
export const hhmm = (n: number) =>
  `${String(Math.floor(n)).padStart(2, "0")}:${String(Math.round((n % 1) * 60)).padStart(2, "0")}`;
function P() {
  const [only, setOnly] = useState<string | null>(null);
  const shown = only ? CLASSES.filter((c) => c.name === only) : CLASSES;
  const names = [...new Set(CLASSES.map((c) => c.name))];
  const blocks: LaneBlock[] = shown.map((c) => ({
    id: c.id, lane: c.lane, start: c.start, end: c.end,
    label: (
      <span className="block leading-tight">
        <span className="block font-medium">{c.name}</span>
        <span className="block text-[0.7rem] opacity-80">{hhmm(c.start)} · {c.teacher}</span>
        <span className="block text-[0.7rem] opacity-80">{c.left === 0 ? "Full" : `${c.left} left`}</span>
      </span>
    ),
  }));
  return (
    <SiteChrome name="Wharf Studio" tagline="Pilates, reformer and yoga in a converted grain store. Ipswich waterfront."
      links={[{ label: "Book a class", href: "/book" }, { label: "Your classes", href: "/manage" }, { label: "What a class is like", href: "/work" }]}
      action={{ label: "Book a class", href: "/book" }}>

      {/* THE WHOLE WEEK, AT ONCE. A slot picker answers "when is Tuesday
          free"; the question somebody joining actually has is "is there a 6:30
          I can get to after work", and that is a shape rather than a slot. */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-7xl px-6 py-10">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                24 classes a week · every one of them today's timetable, not a sample
              </p>
              <h1 className="mt-2 text-4xl font-semibold tracking-tight text-balance">The week, so you can see whether it fits yours</h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => setOnly(null)}
                className={`rounded-md border px-3 py-1.5 text-sm ${only === null ? "border-foreground bg-primary text-primary-foreground" : "border-border"}`}>
                Everything
              </button>
              {names.map((n) => (
                <button key={n} type="button" onClick={() => setOnly(n === only ? null : n)}
                  className={`rounded-md border px-3 py-1.5 text-sm ${only === n ? "border-foreground bg-primary text-primary-foreground" : "border-border"}`}>
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 overflow-x-auto">
            {/* laneHeight: these labels are three lines and go to four once a
                block is narrow enough to wrap the class name. */}
            <TimeLaneGrid lanes={DAYS} blocks={blocks} from={6} to={21} laneHeight={72} />
          </div>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            Everything on that grid runs every week — the same class, the same teacher, the same
            time. It changes twice a year and we announce it a month before, because the whole
            point of a timetable is that you can build a Tuesday around it.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-6 py-12">
        <StatsBand items={[
          { value: "24", label: "Classes a week" },
          { value: "8", label: "On a reformer, which is the cap and always will be" },
          { value: "£14", label: "One class, no membership needed" },
          { value: "2×", label: "Timetable changes a year, announced a month ahead" },
        ]} />

        <section className="mt-14 grid gap-12 lg:grid-cols-[1.15fr_1fr]">
          <div>
            <SectionHeader eyebrow="The four that go first" title="And how full they actually are"
              description="These are live numbers, not scarcity theatre — a Tuesday 18:30 vinyasa genuinely does go, and a Thursday 19:45 restorative genuinely does not." />
            <div className="mt-6 space-y-4">
              {[
                CLASSES.find((c) => c.id === "t4")!,
                CLASSES.find((c) => c.id === "s2")!,
                CLASSES.find((c) => c.id === "t1")!,
                CLASSES.find((c) => c.id === "m3")!,
              ].map((c) => (
                <div key={c.id} className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border p-4">
                  <div>
                    <p className="text-base font-medium">{c.name} · {DAYS.find((d) => d.key === c.lane)!.label} {hhmm(c.start)}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{c.teacher} · {c.level} · {c.cap} mats</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <SlotCapacity left={c.left} total={c.cap} unit="mats" />
                    <a className="rounded-md border border-border px-4 py-2 text-sm font-medium" href="/book">
                      {c.left === 0 ? "Waiting list" : "Book"}
                    </a>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              A full class is shown as full with a waiting list rather than hidden. About one in
              three waiting-list places comes up, usually the evening before, and you are not
              charged unless it does.
            </p>

            <div className="mt-10">
              <SectionHeader eyebrow="Prices" title="No joining fee, no contract, and the drop-in is not a punishment"
                description="A single class is £14 and a class on the ten-pack is £11.50. That is the whole difference — we are not going to charge somebody £22 for turning up once." />
              <div className="mt-6">
                <PriceList items={[
                  { name: "One class", price: 14, meta: "any class", description: "Reformer included, which most studios charge double for" },
                  { name: "Ten classes", price: 115, meta: "£11.50 each", description: "No expiry. Ten classes is ten classes whether it takes you two months or two years" },
                  { name: "Monthly, unlimited", price: 78, meta: "a month", description: "Worth it above six classes a month. We will tell you if it is not" },
                  { name: "First class", price: 0, meta: "genuinely free", description: "Any class on the grid including reformer. No card, no sign-up, just come" },
                  { name: "Over 60s and students", price: 9, meta: "a class", description: "Any class, any time, no separate timetable and no back room" },
                  { name: "Pregnancy yoga block", price: 60, meta: "6 weeks", description: "Runs as a block so the same people are in the room each week" },
                ]} />
              </div>
            </div>
          </div>

          <div>
            <SafeImage src={null} alt="The studio in the converted grain store, mats laid out" ratio="4/3" />
            <div className="mt-6">
              <SectionHeader eyebrow="Who teaches" title="Three of us, and you will have all three" />
              <div className="mt-5">
                {/* NOT TeamGrid. Rendered at columns={1} in this rail it
                    stacked three full-width 1/1 portraits — 1,300px of
                    photograph for three sentences. TeamGrid's card is
                    image-ABOVE-text and a rail wants image-BESIDE-text, which
                    is a different component rather than a narrower one. */}
                <div className="space-y-5">
                  {[
                    ["Ruth Sandaal", "Pilates and reformer", "Physio for eleven years before this, which is why a reformer class is eight people and not sixteen."],
                    ["Ekow Mensah", "Vinyasa and slow flow", "Teaches the fast ones and the slow ones and is better at the slow ones, whatever he says."],
                    ["Nadia Beck", "Yin, restorative, pregnancy, over-60s", "Does the classes people are most nervous about walking into, which is not an accident."],
                  ].map(([name, role, note]) => (
                    <div key={name}>
                      <AvatarName name={name} subtitle={role} size="lg" />
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{note}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-8">
              <TrustStrip columns={1} items={[
                { title: "Every teacher is insured and qualified", description: "Level 3 minimum, and Nadia's pregnancy qualification is the separate one that actually covers it" },
                { title: "Eight on a reformer, never nine", description: "A machine class where the teacher cannot see everybody is not a class, it is a room with machines in it" },
                { title: "Step-free from the quay", description: "Lift to the studio floor, accessible toilet, and chairs for the Wednesday gentle class" },
              ]} />
            </div>
            <div className="mt-8">
              <Testimonial item={{
                quote: "I picked it off the timetable — there was a 6:30 on a Tuesday and I could get there from work. Two years later that is still the class I go to and I have never once looked at another page of this website.",
                name: "Órlaith Byrne", role: "Two years, Tuesday 18:30",
              }} />
            </div>
          </div>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <div className="max-w-3xl">
            <SectionHeader eyebrow="Asked often" title="Mostly by people who have not been yet" />
            <Faq className="mt-6" items={[
              { question: "I have never done any of this. Where do I start?", answer: "Wednesday 18:30 beginners reformer or Thursday 09:30 slow flow, and the first one is free. Both are taught knowing the room contains somebody who has never done it, which is a different thing from a class that merely allows it." },
              { question: "Do I need to be flexible?", answer: "No, and this is the single most common reason people do not come. Flexibility is an outcome and not an entry requirement, and a room full of people who can already touch their toes would be a room that does not need teaching." },
              { question: "What if the class is full?", answer: "Join the waiting list and you are not charged unless a place comes up. About a third do, usually the evening before, and you get a text with two hours to say yes." },
              { question: "Can I cancel a booking?", answer: "Up to four hours before, free, and the class goes back on your pack. Inside four hours it is used — not as a penalty but because at that point nobody on the waiting list can rearrange their evening." },
              { question: "Is the reformer harder?", answer: "Different rather than harder. The machine takes weight rather than adding it, which is why physios use them and why our beginners reformer has people in it who cannot get down to a mat." },
              { question: "Do you do memberships that lock me in?", answer: "No. The monthly is a rolling month, cancel any time, and we will tell you if you would be better on the ten-pack — we look at this twice a year and email the people who are overpaying." },
            ]} />
          </div>
        </section>
      </div>
    </SiteChrome>
  );
}
