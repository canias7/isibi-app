// salon/call-now /work — the family's fourth page is "the work itself, because
// nails are a visual trade". A gallery of finished sets sells a nail studio and
// it is the wrong page here, because nobody rings a mobile hairdresser having
// seen a photograph. They ring having wondered whether the thing they want is
// possible in their kitchen.
//
// So this is the work itself answered as a CAPABILITY question: what can be
// done at a kitchen table, what needs a sink, and — the half no salon page ever
// prints — what genuinely cannot be done at home. A trade that only lists what
// it can do makes somebody ring to be disappointed.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { Faq } from "@/components/ui/faq";
import { Gallery } from "@/components/ui/gallery";
import { KeyPoints } from "@/components/ui/key-points";
import { SectionHeader } from "@/components/ui/section-header";
import { SpecList, SpecRow } from "@/components/ui/spec-row";
import { Testimonial } from "@/components/ui/testimonial";
export const Route = createFileRoute("/work")({ component: P });
const CAN = [
  ["Any cut, any length", "A kitchen chair and a square metre of floor. This is most of what I do and there is nothing a salon chair adds to it"],
  ["Cut and blow dry", "Needs a sink you can lean back over. A kitchen sink is usually better than a bathroom one"],
  ["Roots and full head colour", "With a patch test 48 hours before, which I come out and do for nothing"],
  ["Perms", "Still ask for it, still do it, still good at it. Two and a half hours and a lot of tea"],
  ["Beard and clipper work", "Including in a chair or in bed, which is a third of my week"],
  ["Fringe trims between appointments", "Five minutes, £6, and I will often do it free if I am in your street anyway"],
];
const CANNOT = [
  ["Bleach from dark to blonde in one visit", "Not a home job and honestly not a one-visit job anywhere. I will tell you who does it well in Hull and I do not take a fee for that"],
  ["Keratin and chemical straightening", "The fumes need extraction. Doing it in somebody's kitchen would be a genuinely bad idea"],
  ["Anything needing a backwash for forty minutes", "A bathroom sink is fine for six minutes and painful for forty. This is the real limit and it is a neck, not a technique"],
  ["Colour correction after a home kit has gone wrong", "I can sometimes rescue it and I will not promise so on a website. Ring, describe it, send me a photograph"],
];
function P() {
  return (
    <SiteChrome name="Hair at Home" tagline="Wendy Frayne. Cutting in kitchens across the East Riding since 2004."
      links={[{ label: "Home", href: "#/" }, { label: "Or use the form", href: "#/book" }, { label: "Your appointment", href: "#/manage" }]}
      action={{ label: "Ring 07700 900 812", href: "tel:07700900812" }}>

      <div className="mx-auto max-w-6xl px-6 py-12">
        <SectionHeader eyebrow="The work" title="What is actually possible at a kitchen table"
          description="A salon puts up a gallery, because you choose a salon by looking at it. Nobody chooses a mobile hairdresser that way — they wonder whether the thing they want can be done at home at all, and then they ring to find out. This page is that phone call." />

        <section className="mt-10 grid gap-10 lg:grid-cols-[1fr_1fr]">
          <div>
            <SectionHeader eyebrow="Yes" title="Six things, and the first one is most of the job" />
            <div className="mt-6">
              <SpecList>
                {CAN.map(([what, note]) => (
                  <SpecRow key={what} label={what} note={note} highlight />
                ))}
              </SpecList>
            </div>
          </div>
          {/* THE HALF NOBODY PRINTS. A capability page that only lists what is
              possible makes somebody ring in order to be told no, which costs
              them a phone call and me an awkward two minutes. */}
          <div>
            <SectionHeader eyebrow="No, and why" title="Four things I will not do in your house" />
            <div className="mt-6">
              <SpecList>
                {CANNOT.map(([what, note]) => (
                  <SpecRow key={what} label={what} note={note} />
                ))}
              </SpecList>
            </div>
            <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
              Three of those four I would happily do if I had a backwash and extraction, and one of
              them I would not do anywhere. If what you want is on this list, ring anyway — half the
              time there is a version of it that works and the other half I will tell you who to go
              to instead.
            </p>
          </div>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <SectionHeader eyebrow="What a kitchen appointment looks like" title="Because it is not what people picture"
            description="The usual worry is mess, and it is a fair one. I bring a mat, I sweep, and the whole thing leaves a kitchen in the state it was in — this is the part of the job I am most particular about and the reason most of these are repeat customers." />
          <Gallery className="mt-8" columns={4} items={[
            { alt: "A kitchen chair, a mat and the bag, set up before a cut", caption: "The whole setup, four minutes" },
            { alt: "Cutting at a kitchen table in Anlaby", caption: "A kitchen table in Anlaby" },
            { alt: "A wash at a kitchen sink", caption: "A kitchen sink beats a bathroom one" },
            { alt: "Clipper work in a wing-back chair", caption: "In the chair, not the kitchen" },
            { alt: "A day room in a care home set up for four residents", caption: "A care home day room" },
            { alt: "Colour mixed on a worktop with a towel down", caption: "Colour, with the worktop covered" },
            { alt: "The mat rolled up and the floor swept", caption: "And then it is as it was" },
            { alt: "The bag packed, back in the car", caption: "Twenty minutes to the next one" },
          ]} />
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <div className="grid gap-10 lg:grid-cols-[1fr_1fr]">
            <div>
              <SectionHeader eyebrow="Care homes" title="A third of the week, and it works differently" />
              <div className="mt-6">
                <KeyPoints title="How a home visit runs" points={[
                  "Four residents or more on one visit, £16 each, invoiced to the home monthly.",
                  "A day room or a hairdressing room if there is one — most homes built since 2000 have one and it is usually full of laundry.",
                  "I do bed and chair cuts, and I would rather do those than have somebody moved.",
                  "Families can ask for a specific resident directly and it does not go through the home.",
                  "I allow longer than a salon would for dementia, and there is no charge for that time.",
                ]} />
              </div>
              <div className="mt-6">
                <Testimonial item={{
                  quote: "She does eight of ours on a Tuesday morning and she knows all eight by name and which one likes to be told what she is doing before she does it. That last part is not on any invoice and it is the whole reason we keep her.",
                  name: "Priya Ramanathan", role: "Manager, Swanland Court",
                }} />
              </div>
            </div>
            <div>
              <SectionHeader eyebrow="Asked often" title="About the work rather than the booking" />
              <Faq className="mt-6" items={[
                { question: "Is a home cut as good as a salon one?", answer: "For a cut, yes, and I would say that having done both — the chair does nothing the scissors cannot. For a wash it is slightly worse, because a kitchen sink is not a backwash and forty minutes over one is uncomfortable. That is the honest difference and it is the only one." },
                { question: "Will it make a mess?", answer: "A mat goes down, hair goes on the mat, the mat gets rolled up and taken away, and I sweep after it anyway. Twenty-two years and I have never left a kitchen worse than I found it — this is the thing I am most particular about." },
                { question: "Can I have the same as the picture?", answer: "Send it to me before the appointment rather than showing me on the day. Half the time the answer is yes as it stands, and the other half there is a version of it that will actually suit you and we can have that conversation before I am stood there with scissors." },
                { question: "Do you do children?", answer: "Yes, and the house is much the better place for a first haircut than a salon — no mirror wall, no strangers, and their own floor to sit on if that is what it takes. £14 up to eleven." },
                { question: "What if it goes wrong?", answer: "I come back and fix it, free, and I do not need to be persuaded. It happens perhaps twice a year, usually because a colour has behaved differently on hair somebody has been dyeing at home." },
                { question: "Do you sell products?", answer: "I carry a few and I mark them up by nothing worth mentioning. I am not going to sell you a £28 shampoo — most of what people need is in Boots and I will tell you which one." },
              ]} />
            </div>
          </div>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <div className="rounded-lg border border-border bg-muted/50 p-6">
            <div className="flex flex-wrap items-center justify-between gap-6">
              <div className="max-w-2xl">
                <p className="text-lg font-semibold">Not sure whether yours is on the yes list?</p>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  That is exactly the phone call. Describe it in a sentence and I will tell you in
                  another one, including if the answer is somebody else.
                </p>
              </div>
              <a className="rounded-md bg-primary px-6 py-3 text-base font-semibold tabular-nums text-primary-foreground" href="tel:07700900812">07700 900 812</a>
            </div>
          </div>
        </section>
      </div>
    </SiteChrome>
  );
}
