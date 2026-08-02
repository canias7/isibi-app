// removals /moving-day — what happens on the day, hour by hour. Nobody moves
// often enough to know, and the anxiety on the day is almost entirely about not
// knowing what is meant to happen next.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { CtaBand } from "@/components/ui/cta-band";
import { Faq } from "@/components/ui/faq";
import { SafeImage } from "@/components/ui/safe-image";
import { SectionHeader } from "@/components/ui/section-header";
import { Testimonial } from "@/components/ui/testimonial";
export const Route = createFileRoute("/moving-day")({ component: P });
const DAY = [
  { time: "07:30", what: "We arrive", detail: "Two or three of us, and the van. We walk round with you, agree what is coming and what is staying, and put down floor protection and door guards." },
  { time: "08:00", what: "Big furniture first", detail: "Wardrobes, beds and sofas come apart and go in first, because they set the shape of the load. Screws go in a labelled bag that travels in the cab, not in the van." },
  { time: "10:30", what: "Boxes, room by room", detail: "Labelled by room, loaded so the ones for upstairs come off last. This is the bit that goes faster than people expect." },
  { time: "12:00", what: "Last sweep", detail: "Loft, shed, garage, under the beds, back of the airing cupboard. Then you walk round with us and lock up." },
  { time: "12:30", what: "The wait", detail: "This is the hard part and it is nobody's fault. Keys move when the money moves, and the money moves when the slowest solicitor in the chain says so. First hour of waiting is free." },
  { time: "14:00", what: "Keys, and we go", detail: "As soon as you have them we set off. Take the kettle, the mugs and the tea in your own car — it is the single most useful thing anybody does on a moving day." },
  { time: "14:30", what: "Unloading", detail: "You stand at the door and say which room. We carry; you point. Nobody expects you to lift anything and it is faster if you do not." },
  { time: "16:00", what: "Putting it back together", detail: "Beds rebuilt and made up if the bedding is to hand, wardrobes back together, white goods plumbed in if the fittings match." },
  { time: "17:30", what: "Done", detail: "We take away the empty boxes if you are ready, or come back for them in a fortnight. Settle up by card or transfer, and that is it." },
];
function P() {
  return (
    <SiteChrome name="Bramall & Sons Removals" tagline="A family removals firm in Sheffield since 1978."
      links={[{ label: "Home", href: "#/" }, { label: "Full quote", href: "#/quote" }]}
      action={{ label: "Get a price", href: "#/quote" }}>

      <div className="mx-auto max-w-6xl px-6 py-14">
        <SectionHeader eyebrow="Moving day" title="What actually happens, hour by hour"
          description="Nobody moves often enough to know, and most of the stress on the day is not knowing what is meant to happen next. This is an ordinary three-bed move across the city." />

        <div className="mt-10 grid gap-12 lg:grid-cols-[1.15fr_1fr]">
          <ol className="border-t border-border">
            {DAY.map((d) => (
              <li key={d.time} className="grid grid-cols-[4.5rem_1fr] gap-4 border-b border-border py-5">
                <span className="text-sm tabular-nums text-muted-foreground">{d.time}</span>
                <span>
                  <span className="block font-medium">{d.what}</span>
                  <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">{d.detail}</span>
                </span>
              </li>
            ))}
          </ol>
          <div className="space-y-4">
            <SafeImage src={null} alt="Loading, about nine in the morning" ratio="4/3" />
            <SafeImage src={null} alt="The van, part loaded" ratio="4/3" />
            <SafeImage src={null} alt="Rebuilding a bed at the other end" ratio="4/3" />
          </div>
        </div>

        <section className="mt-14 border-t border-border pt-10">
          <SectionHeader eyebrow="The week before" title="Five things that make the day easier"
            description="None of them are about packing faster." />
          <div className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["Label by ROOM, not by contents", "Write the destination room on the top and one side. 'Kitchen' gets a box to the right place; 'pans, tea towels' does not."],
              ["Pack an overnight bag each", "Kettle, mugs, tea, chargers, toothbrush, a change of clothes and any medication. It goes in your car, not in our van."],
              ["Sort the parking", "Both ends. We will apply for a suspension if you tell us a fortnight ahead, and it costs whatever the council charges."],
              ["Empty the freezer", "It has to be defrosted and dry, and it takes a day. Everybody forgets this and it is the most common reason something gets left behind."],
              ["Tell the school and the vet", "The list nobody writes down: school, GP, vet, insurers, the council, the DVLA, and the people who deliver your bins."],
              ["Decide about the tip run", "Look at what you are actually keeping. Moving something you will throw away in March costs the same as moving something you want."],
            ].map(([k, v]) => (
              <div key={k} className="border-t border-border pt-4">
                <p className="font-medium">{k}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{v}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <div className="grid gap-12 lg:grid-cols-[1.1fr_1fr]">
            <div>
              <SectionHeader eyebrow="Asked often" title="About the day itself" />
              <Faq className="mt-6" items={[
                { question: "What if the keys never come?", answer: "It happens a few times a year. Your things stay in our van overnight, insured and locked in our yard, and we come back the next morning at no extra charge." },
                { question: "Do I need to be there?", answer: "At one end at least, to say which room things go in. Plenty of people send a relative to the new house and stay at the old one." },
                { question: "Can I help carry?", answer: "You can, but it genuinely slows us down and it is where people get hurt. Make tea and point at rooms." },
                { question: "What about the cat?", answer: "Shut it in a room we have already emptied, with a sign on the door, and move it in your own car last. Same for anything in a tank." },
                { question: "When do I pay?", answer: "On the day, when it is done. Card or bank transfer, and there is nothing to pay before." },
              ]} />
            </div>
            <div className="space-y-4 self-start">
              <Testimonial item={{ quote: "The timeline on their site was almost exactly what happened, including the two hours sat waiting for keys. Knowing that was coming made it much less awful.", name: "Rachel", role: "Nether Edge to Totley" }} />
              <Testimonial item={{ quote: "They labelled the screws for every bed and every wardrobe. It sounds like nothing until you have moved with somebody who didn't.", name: "Chris", role: "Woodseats to Dronfield" }} />
            </div>
          </div>
        </section>

        <section className="mt-14">
          <CtaBand title="Get the range now, fix the price later"
            description="The calculator takes about thirty seconds and asks for nothing about you."
            action={{ label: "Get a price", href: "#/" }} />
        </section>
      </div>
    </SiteChrome>
  );
}
