// pet-boarding /stay — where they actually sleep, what a day is, and who is on
// site. The one thing an owner wants and never gets: the layout of the day,
// hour by hour, rather than "lots of love and cuddles".
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { Faq } from "@/components/ui/faq";
import { Gallery } from "@/components/ui/gallery";
import { SafeImage } from "@/components/ui/safe-image";
import { SectionHeader } from "@/components/ui/section-header";
import { ServiceTimes } from "@/components/ui/service-times";
import { TeamGrid } from "@/components/ui/team-grid";
export const Route = createFileRoute("/stay")({ component: P });
const DAY = [
  { day: "Every day", time: "07:00", what: "Staff on, kennels checked, anybody unwell seen first", where: "All blocks" },
  { day: "Every day", time: "07:30", what: "First turnout — paddocks, in twos and threes", where: "Paddocks" },
  { day: "Every day", time: "08:30", what: "Breakfast, your own food, in the kennel", where: "Kennels", note: "Twice-a-day feeders get half now and half at four" },
  { day: "Every day", time: "09:30", what: "Kennels cleaned while they are out", where: "All blocks" },
  { day: "Every day", time: "11:00", what: "Second turnout, the longer one", where: "Paddocks and the field" },
  { day: "Every day", time: "13:00", what: "Quiet hour — everybody in, lights down, no visitors", where: "All blocks", note: "This is why we do not take drop-offs at lunchtime" },
  { day: "Every day", time: "14:30", what: "Third turnout, plus one-to-one time for the ones who want it", where: "Paddocks" },
  { day: "Every day", time: "16:00", what: "Tea", where: "Kennels" },
  { day: "Every day", time: "17:30", what: "Last turnout, short", where: "Paddocks" },
  { day: "Every day", time: "20:30", what: "Final check, radio on low in the dog block", where: "All blocks" },
  { day: "Every day", time: "22:00", what: "Somebody sleeps on site, every night without exception", where: "The flat" },
];
function P() {
  return (
    <SiteChrome name="Ewden Lane Kennels & Cattery" tagline="Licensed boarding for 24 dogs and 18 cats, in the Don valley."
      links={[{ label: "Home", href: "#/" }, { label: "Book", href: "#/book" }]}
      action={{ label: "Check dates", href: "#/book" }}>

      <div className="mx-auto max-w-6xl px-6 py-14">
        <SectionHeader eyebrow="Where they stay" title="The day, hour by hour"
          description="Rather than 'lots of love and cuddles', which is what every kennel's website says and which tells you nothing about what happens between eight in the morning and eight at night." />

        <section className="mt-10">
          <SafeImage src={null} alt="The dog block from the yard" ratio="21/9" />
        </section>

        <section className="mt-12 grid gap-12 lg:grid-cols-[1fr_1fr]">
          <div>
            {/* THE TIMETABLE IS THE PAGE. An owner leaving a dog for a fortnight
                is buying a routine, and nobody publishes theirs. */}
            <ServiceTimes meetings={DAY} heading="A day here" />
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              Four turnouts a day, not one, and never all together — dogs go out in twos and threes
              with dogs they get on with, or on their own if that is better for them. We work that
              out in the first day and it does not change for the rest of the stay.
            </p>
          </div>
          <div>
            <h2 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">The kennels themselves</h2>
            <ul className="mt-3 divide-y divide-border border-y border-border text-base">
              <li className="py-3.5">
                <span className="font-medium">2m × 3m inside, 2m × 4m covered run</span>
                <span className="block text-sm text-muted-foreground">
                  Twice the licence minimum. They can move between the two whenever they like
                  through the day — no dog is shut in a box waiting for somebody to open a door.
                </span>
              </li>
              <li className="py-3.5">
                <span className="font-medium">Heated to 18° in the dog block, 20° in the cattery</span>
                <span className="block text-sm text-muted-foreground">
                  Underfloor, thermostatic, on a monitored alarm. In summer the block is through-
                  ventilated and the runs are shaded from noon.
                </span>
              </li>
              <li className="py-3.5">
                <span className="font-medium">The cattery is a separate building</span>
                <span className="block text-sm text-muted-foreground">
                  Fifty yards away and out of sight and earshot of the dogs. A cattery inside a
                  kennel block is a fortnight of stress for a cat, whatever anybody tells you.
                </span>
              </li>
              <li className="py-3.5">
                <span className="font-medium">Bring their own bed and a jumper of yours</span>
                <span className="block text-sm text-muted-foreground">
                  It makes a real difference in the first two nights. We wash nothing of yours
                  unless it needs it, because the smell is the point.
                </span>
              </li>
              <li className="py-3.5">
                <span className="font-medium">Quiet block for the ones who need it</span>
                <span className="block text-sm text-muted-foreground">
                  Six kennels at the far end for nervous dogs, old dogs and entire dogs. No extra
                  charge and we will suggest it rather than wait to be asked.
                </span>
              </li>
            </ul>
          </div>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <SectionHeader eyebrow="The place" title="All of it, including the bits nobody photographs" />
          <Gallery className="mt-8" columns={4} items={[
            { src: null, alt: "A dog kennel with the run door open" },
            { src: null, alt: "The covered runs from outside" },
            { src: null, alt: "The main paddock" },
            { src: null, alt: "The field, four acres" },
            { src: null, alt: "A cattery pen with the shelf and the window" },
            { src: null, alt: "The cattery corridor" },
            { src: null, alt: "The food prep room" },
            { src: null, alt: "The yard and the turning space" },
          ]} />
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <SectionHeader eyebrow="Who" title="Four of us, and somebody sleeps here every night"
            description="Not a rota of agency staff. The same faces, which matters to a dog far more than the size of the kennel." />
          <TeamGrid className="mt-8" items={[
            { name: "Marie Ackroyd", role: "Licence holder — here since 2004", photo: null },
            { name: "Tom Ackroyd", role: "Kennels, and the one who does the introductions", photo: null },
            { name: "Priya Raval", role: "Cattery, and a veterinary nurse", photo: null },
            { name: "Callum Reid", role: "Mornings, turnouts and the paddock rota", photo: null },
          ]} />
          <p className="mt-6 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Between us there is somebody on site twenty-four hours, every day of the year. The night
            person is in the flat above the food room, thirty feet from the dog block, and the
            alarms are wired into it.
          </p>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <div className="max-w-3xl">
            <SectionHeader eyebrow="Asked often" title="About the stay" />
            <Faq className="mt-6" items={[
              { question: "Will my dog be on its own all day?", answer: "No. Four turnouts, plus one-to-one time for dogs who would rather be with a person than with other dogs. About four hours out of the kennel a day, more for the ones who need it." },
              { question: "Do dogs mix?", answer: "Only with dogs they get on with, in twos and threes, after we have watched an introduction over a fence. Any dog that would rather not, does not, and nobody is made to." },
              { question: "What if mine is nervous?", answer: "Quiet block, no charge, and a slower first two days. Tell us at booking rather than at the gate — it changes where we put them, and once the block is full it is full." },
              { question: "What do you feed?", answer: "Whatever you send, measured as you tell us. Changing a dog's food on the day it arrives somewhere strange is how you get an upset stomach on day two, so we never do." },
              { question: "Can cats and dogs from one house stay together?", answer: "No — different buildings, and it is the right answer for the cat. They can be collected together and that is the only bit that overlaps." },
              { question: "What happens if a dog is ill?", answer: "Our vet is four miles away and sees us the same hour. We ring you first unless there is no time, and we ring you afterwards either way. The bill is yours; the transport and the waiting are ours." },
            ]} />
          </div>
        </section>
      </div>
    </SiteChrome>
  );
}
