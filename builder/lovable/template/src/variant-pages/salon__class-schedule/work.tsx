// salon/class-schedule /work — the family's fourth page is a gallery, because
// nails are a visual trade and you choose a nail studio by looking at the work.
//
// Nobody chooses a yoga class by looking at a photograph of one. What stops
// people is not doubt about the quality, it is not knowing what happens: what
// to wear, whether everyone will look at them, what a reformer even is, and
// what happens in the first four minutes. So "the work itself" here is the
// inside of a class, minute by minute — which is the single most useful page a
// studio can publish and almost none of them do.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { Faq } from "@/components/ui/faq";
import { Gallery } from "@/components/ui/gallery";
import { KeyPoints } from "@/components/ui/key-points";
import { SectionHeader } from "@/components/ui/section-header";
import { SpecList, SpecRow } from "@/components/ui/spec-row";
import { Testimonial } from "@/components/ui/testimonial";
import { Timeline } from "@/components/ui/timeline";
export const Route = createFileRoute("/work")({ component: P });
function P() {
  return (
    <SiteChrome name="Wharf Studio" tagline="Pilates, reformer and yoga in a converted grain store. Ipswich waterfront."
      links={[{ label: "The timetable", href: "#/" }, { label: "Book a class", href: "#/book" }, { label: "Your classes", href: "#/manage" }]}
      action={{ label: "Book a class", href: "#/book" }}>

      <div className="mx-auto max-w-6xl px-6 py-12">
        <SectionHeader eyebrow="Your first class" title="What actually happens, minute by minute"
          description="Nobody has ever not come because they doubted the teaching. They do not come because they do not know what happens — where to stand, what to wear, whether anyone will look at them. So here is the whole thing, in order, with nothing left out." />

        <section className="mt-10 grid gap-12 lg:grid-cols-[1.15fr_1fr]">
          <div>
            <Timeline items={[
              { when: "Ten minutes before", title: "You arrive and nobody makes anything of it", description: "Door on the quay side, lift or stairs to the first floor. Somebody will say hello and ask if it is your first one, and that is the entire greeting — you are not introduced to the room." },
              { when: "Eight minutes before", title: "Shoes and bag", description: "Shoes off in the rack by the door, bag on the shelf. Nothing is locked and nothing has ever gone missing, and there is a drawer for a phone if you would rather." },
              { when: "Five minutes before", title: "You pick a spot", description: "Take one at the back. Everyone says take one at the back on their first time and they are right. The teacher will not move you to the front." },
              { when: "The first four minutes", title: "Lying down, doing nothing much", description: "Every class starts on your back or sitting, breathing, for about four minutes. This is when people relax, and it is deliberately the least demanding thing in the hour." },
              { when: "Minutes five to fifty", title: "The class", description: "The teacher demonstrates every movement and then walks the room. You will be offered an easier version of at least three things and taking it is normal — half the room does." },
              { when: "The last five minutes", title: "Flat on the floor, lights down", description: "Every class ends this way and it is not optional in the sense that everybody does it. Some people fall asleep. Nobody minds." },
              { when: "Afterwards", title: "You can leave immediately", description: "Roll the mat, put it back, go. Nobody will try to sell you a membership on the way out and nobody will ask how you found it — if you want to talk, Ruth is by the door." },
            ]} />

            <div className="mt-10">
              <SectionHeader eyebrow="What to wear" title="Anything you can move in" />
              <div className="mt-5">
                <KeyPoints title="And four things that are actually true" points={[
                  "Bare feet for everything. Socks slip on a mat and grip socks are a purchase you do not need to make.",
                  "Leggings or shorts and a top that stays put when you bend over. That is the whole rule.",
                  "Nothing is provided that you would want your own of, and everything else is provided.",
                  "You will sweat in the vinyasa and not in the yin, and both are on the timetable at 18:30 on different days.",
                ]} />
              </div>
            </div>
          </div>

          <div>
            <SectionHeader eyebrow="Reformer" title="The thing people most want explained" />
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              A reformer is a sliding carriage on springs. You lie, sit or stand on it and the
              springs take some of your weight rather than adding to it — which is why physios use
              them, and why our beginners reformer has people in it who cannot get down onto a mat.
            </p>
            <div className="mt-6">
              <SpecList>
                <SpecRow label="How many in a class" value="8" note="Never nine. A machine class where the teacher cannot see everyone is a room with machines in it" highlight />
                <SpecRow label="Is it harder than mat" value="No, different" note="The machine helps as often as it resists. Plenty of people find mat harder" highlight />
                <SpecRow label="Do I need to be strong" value="No" note="Springs are set per person and per exercise. Yours will not be the same as your neighbour's" />
                <SpecRow label="Does it cost more" value="Same as any class" note="£14 drop-in, £11.50 on a pack. Most studios charge double for this and we never have" />
                <SpecRow label="Which one first" value="Wednesday 18:30" note="Beginners reformer, Ruth. Taught knowing the room contains somebody who has never seen one" />
                <SpecRow label="If I have an injury" value="Tell the teacher" note="Before, not during. It changes the springs and it changes what you are asked to do" />
              </SpecList>
            </div>

            <div className="mt-8">
              <Testimonial item={{
                quote: "I read this page four times before I booked anything. The bit that got me through the door was 'take one at the back' — somebody had thought about the actual thing I was frightened of instead of telling me the class was welcoming.",
                name: "Marc Delahaye", role: "First class in January",
              }} />
            </div>

            <div className="mt-8 rounded-lg border border-border bg-muted/50 p-5">
              <p className="text-base font-medium">Your first class is free and there is no catch in it</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                Any class on the timetable, reformer included. No card, no sign-up, nothing taken.
                Turn up ten minutes early and say it is your first — that is the whole process.
              </p>
              <a className="mt-4 inline-block rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground" href="#/book">
                Pick one from the timetable
              </a>
            </div>
          </div>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <SectionHeader eyebrow="The room" title="A grain store with the beams left in"
            description="Sprung floor, eight reformers along one wall, and windows the length of the quay side. It is warm in the yin classes and it is not a hot studio in any of the others." />
          <Gallery className="mt-8" columns={4} items={[
            { alt: "The main studio with mats laid out", caption: "Eighteen mats, laid out before a flow" },
            { alt: "The eight reformers along the wall", caption: "Eight reformers, and eight is the cap" },
            { alt: "The quay-side windows", caption: "The windows, and the reason nobody sits at the back for long" },
            { alt: "The shoe rack and shelves by the door", caption: "Shoes off here, bag on the shelf" },
            { alt: "Props — blocks, straps and bolsters", caption: "Everything is provided except the leggings" },
            { alt: "The changing room and showers", caption: "Two showers, and nobody uses them" },
            { alt: "The lift from the quay", caption: "Step-free from the quay, lift to the floor" },
            { alt: "Chairs set out for the Wednesday gentle class", caption: "Wednesday's chairs, for the gentle class" },
          ]} />
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <div className="max-w-3xl">
            <SectionHeader eyebrow="Asked often" title="The ones people are slightly embarrassed to ask" />
            <Faq className="mt-6" items={[
              { question: "Will everybody look at me?", answer: "No, and not out of politeness — they are all looking at the ceiling or at their own feet. The only person who will look at you is the teacher, which is what you are paying for." },
              { question: "What if I cannot do something?", answer: "You stop and lie down, and that is a completely normal thing that happens in every class. The teacher will offer an easier version of at least three things in an hour and roughly half the room takes it." },
              { question: "I am not flexible at all.", answer: "Nor is most of the room, and flexibility is an outcome rather than an entry requirement. If everyone could already touch their toes there would be nothing to teach." },
              { question: "Am I too old?", answer: "The Wednesday 11:00 gentle class has people in their eighties in it and chairs for anybody who wants one. It is on the same timetable as everything else, at the same price, and it is not a back room." },
              { question: "Am I too big?", answer: "No. Reformers take up to 160kg by design and the mat classes have no equipment at all. If you would like to know what the room is like before committing, come to a Thursday 19:45 restorative — it is the quietest and the least demanding hour we run." },
              { question: "Do I have to talk to anyone?", answer: "Not once. Come in, do the class, leave. Plenty of people have done exactly that for years and we are not going to interrupt it." },
              { question: "What if I am late?", answer: "Come in anyway, quietly, and take a mat at the back. A class you missed the first five minutes of is far better than a class you did not come to." },
            ]} />
          </div>
        </section>
      </div>
    </SiteChrome>
  );
}
