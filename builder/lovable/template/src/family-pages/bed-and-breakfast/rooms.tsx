// bed-and-breakfast /rooms — each room in full: the bed, the bathroom, the
// stairs to it and what you can see out of the window. Four rooms is few enough
// to describe honestly, and honesty is the whole advantage over a platform
// listing that has to flatten everything into "Double Room".
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { Faq } from "@/components/ui/faq";
import { Gallery } from "@/components/ui/gallery";
import { RateCard } from "@/components/ui/rate-card";
import { RoomCard } from "@/components/ui/room-card";
import { SectionHeader } from "@/components/ui/section-header";
import { TARIFF } from "./index";
export const Route = createFileRoute("/rooms")({ component: P });
function P() {
  return (
    <SiteChrome name="Thurgoland House" tagline="Four rooms above the Don valley. Breakfast until nine, and later if you ask."
      links={[{ label: "Home", href: "#/" }, { label: "Staying", href: "#/stay" }]}
      action={{ label: "Book direct", href: "#/stay" }}>

      <div className="mx-auto max-w-6xl px-6 py-14">
        <SectionHeader eyebrow="The rooms" title="Four, described properly"
          description="Including the stairs, which a platform listing cannot tell you and which decide the booking for a lot of people." />

        <section className="mt-10 grid gap-6 lg:grid-cols-2">
          <RoomCard name="The Garden Room" price="£85 single · £110 double" per="night" sleeps={2}
            size="Ground floor · 4.2m × 3.6m" image={null}
            amenities={["Walk-in shower, no step", "Doors onto the terrace", "King bed", "Dog-friendly"]}
            description="No stairs at all, from the parking to the bed. The shower is level-access and there is a grab rail. The one to ask for if stairs are a problem, and the one that goes first." />
          <RoomCard name="The Blue Room" price="£78 single · £98 double" per="night" sleeps={2}
            size="First floor · 4.0m × 3.4m" image={null}
            amenities={["Bath with shower over", "Looks up the valley", "King bed", "13 stairs"]}
            description="The view is the reason. Thirteen stairs from the hall, straight, with a rail on both sides. The bath is a proper one and the shower over it is fine rather than powerful." />
          <RoomCard name="The Back Room" price="£70 single · £88 double" per="night" sleeps={2}
            size="First floor · 3.4m × 3.0m" image={null}
            amenities={["Shower only", "Looks over the garden", "Double bed", "13 stairs"]}
            description="Smallest and quietest — it faces away from the road entirely, and people who sleep badly ask for it twice. A double rather than a king, which is the only reason it is cheaper." />
          <RoomCard name="The Attic" price="£78 single · £98 double · £128 for four" per="night" sleeps={4}
            size="Top floor · two rooms" image={null}
            amenities={["Double and a twin", "One bathroom between them", "Sloping ceilings", "26 stairs"]}
            description="Two rooms let together, so a family has the floor to itself. The ceilings slope and anybody over about six foot will meet one. Twenty-six stairs and the last flight is steep." />
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <SectionHeader eyebrow="What each costs" title="By how many of you there are"
            description="The same table as the front page, because going back for a number is a reason to close the tab." />
          <div className="mt-8 max-w-3xl">
            <RateCard label="Room" unit="night" bands={["One person", "Two people", "Three or four"]}
              caption="Per night, breakfast included" rates={TARIFF}
              note="Every rate includes breakfast, parking and VAT. A cot is free. The Attic is the only room that takes more than two, and £128 is for all four of you." />
          </div>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <SectionHeader eyebrow="In every room" title="The things worth knowing are there"
            description="Rather than a list of forty amenities where twelve of them are 'towels'." />
          <div className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["A proper bed", "Hypnos mattresses, replaced in 2024, and duvets in two weights — ask for the lighter one in summer and it will be on before you get back."],
              ["Tea, and real milk", "In a fridge, not those pots. Fresh milk brought up every morning and a tin of something home-made."],
              ["Wifi that works upstairs", "Two access points because one did not reach the attic. 70Mb, and it holds a video call."],
              ["No television", "In three of the four. Nobody has ever complained and two people a year say thank you. The Attic has one for children."],
            ].map(([k, v]) => (
              <div key={k} className="border-t border-border pt-4">
                <p className="font-medium">{k}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{v}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <SectionHeader eyebrow="The house" title="All of it, unstaged" />
          <Gallery className="mt-8" columns={4} items={[
            { src: null, alt: "The Garden Room" },
            { src: null, alt: "The Garden Room shower" },
            { src: null, alt: "The Blue Room" },
            { src: null, alt: "The view up the valley from the Blue Room" },
            { src: null, alt: "The Back Room" },
            { src: null, alt: "The Attic, the twin side" },
            { src: null, alt: "The breakfast room" },
            { src: null, alt: "The sitting room and the wood burner" },
          ]} />
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <div className="max-w-3xl">
            <SectionHeader eyebrow="Asked often" title="About the rooms" />
            <Faq className="mt-6" items={[
              { question: "Which room has no stairs?", answer: "The Garden Room, and only that one. It is level from the car to the bed and the shower has no lip. There is no lift and the house is 1870s, so the other three cannot be made step-free." },
              { question: "Can we have a family room?", answer: "The Attic is two rooms taken together with one bathroom between them — a double and a twin. £128 for four. It is the only arrangement that works and it works well." },
              { question: "Is there a bath?", answer: "In the Blue Room. The others are showers. If a bath matters, say so when you book rather than hoping." },
              { question: "How quiet is it?", answer: "The Back Room and the Attic face away from the road entirely. The Blue Room hears the A629 faintly with the window open in summer — quieter than most and not silent." },
              { question: "Do you have a single room?", answer: "No, four doubles. But the single rate is a real rate, on the tariff, and it is what you pay — not the double price with an apology." },
              { question: "Can we see the room first?", answer: "Yes, any afternoon. Knock. If somebody is staying we will show you a different one and say so rather than pretending." },
            ]} />
          </div>
        </section>
      </div>
    </SiteChrome>
  );
}
