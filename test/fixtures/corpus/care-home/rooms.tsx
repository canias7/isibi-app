// care-home /rooms — every room type, honestly, including the ones nobody
// wants. A family choosing a room is choosing where somebody will spend most of
// the rest of their life, and "spacious and comfortable" tells them nothing.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { Faq } from "@/components/ui/faq";
import { InspectionRating } from "@/components/ui/inspection-rating";
import { PriceList } from "@/components/ui/price-list";
import { SafeImage } from "@/components/ui/safe-image";
import { SectionHeader } from "@/components/ui/section-header";
import { RATING } from "./index";
export const Route = createFileRoute("/rooms")({ component: P });
const ROOMS = [
  {
    name: "Garden room", price: "£1,450 a week", count: "6 of these",
    blurb: "Ground floor at the back, with a French door straight onto the lawn. The biggest rooms in the house and the ones with a waiting list.",
    has: ["18m², the largest", "Own door to the garden", "En-suite wet room with a level shower", "Room for your own bed and chair", "Profiling bed available"],
    not: "They face north-east, so the sun is on them in the morning and gone by two.",
  },
  {
    name: "Front room, first floor", price: "£1,380 a week", count: "9 of these",
    blurb: "The view down the Rivelin valley, which on a clear day is the best thing in the building. Lift and stairs to the floor.",
    has: ["15m²", "Bay window, valley view", "En-suite with a shower", "Fitted wardrobe and basin", "Nurse call and a ceiling track if needed"],
    not: "First floor, so if somebody is likely to become immobile the ground floor is the better bet from the start.",
  },
  {
    name: "Standard single", price: "£1,240 a week", count: "12 of these",
    blurb: "The ordinary room and the one most people are in. Comfortable, unremarkable, and about the size of a small bedroom at home.",
    has: ["12m²", "En-suite with a shower", "Wardrobe, drawers, chair", "Window onto the side garden or the drive"],
    not: "12m² is not big. A profiling bed and a wheelchair in one at the same time is tight, and we will say so rather than let you find out.",
  },
  {
    name: "Dementia floor room", price: "£1,395 a week", count: "12 of these",
    blurb: "The second floor is its own unit with its own lounge, kitchen and staff. Doors are memory-boxed and the corridor is a loop rather than a dead end.",
    has: ["13m²", "En-suite wet room", "Memory box beside the door", "Own lounge and kitchen on the floor", "Higher staffing ratio, 1:4 by day"],
    not: "The floor is secured, which is the point of it and is also a thing families need to have thought about.",
  },
  {
    name: "Shared room", price: "£1,180 a week", count: "2 of these",
    blurb: "Two beds with a curtain and a shared en-suite. We keep them because for some couples and some council placements they are the right answer, and because £270 a week is £270 a week.",
    has: ["20m² between two", "Shared en-suite", "Own wardrobe and drawers each", "Curtain, not a partition"],
    not: "It is a shared room. Most people do not want one and we will not talk anybody into it.",
  },
];
function P() {
  return (
    <SiteChrome name="Rivelin Lodge" tagline="A 34-bed residential and dementia care home in Walkley, Sheffield."
      links={[{ label: "Home", href: "/" }, { label: "Fees", href: "/fees" }]}
      action={{ label: "Arrange a visit", href: "/" }}>

      <div className="mx-auto max-w-6xl px-6 py-14">
        <SectionHeader eyebrow="The rooms" title="Five kinds, and what is wrong with each"
          description="Including the shared room and the 12m² single. Somebody may live in one of these for years, and 'spacious and comfortable' is not a description anybody can decide on." />

        <div className="mt-12 space-y-14">
          {ROOMS.map((r, i) => (
            <section key={r.name} className="border-t border-border pt-10">
              <div className={`grid gap-10 lg:grid-cols-2 ${i % 2 ? "lg:[&>*:first-child]:order-2" : ""}`}>
                <div>
                  <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <h2 className="text-3xl font-semibold tracking-tight">{r.name}</h2>
                    <p className="text-lg font-medium tabular-nums">{r.price}</p>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{r.count}</p>
                  <p className="mt-4 max-w-prose text-base leading-relaxed text-muted-foreground">{r.blurb}</p>
                  <ul className="mt-6 divide-y divide-border border-y border-border text-base">
                    {r.has.map((h) => <li key={h} className="py-2.5">{h}</li>)}
                  </ul>
                  {/* At the same weight as the good half. A caveat in grey small
                      print is a caveat written to be missed. */}
                  <p className="mt-4 text-base leading-relaxed">
                    <span className="font-medium">Worth knowing. </span>
                    <span className="text-muted-foreground">{r.not}</span>
                  </p>
                </div>
                <SafeImage src={null} alt={r.name} ratio="4/3" fallbackSeed={r.name} />
              </div>
            </section>
          ))}
        </div>

        <section className="mt-14 border-t border-border pt-10">
          <div className="grid gap-12 lg:grid-cols-[1.15fr_1fr]">
            <div>
              <SectionHeader eyebrow="In every room" title="What comes as standard"
                description="Nothing on this list is an upgrade and nothing on it is charged for." />
              <PriceList className="mt-6" items={[
                { name: "Nurse call", price: 0, meta: "Every room", description: "Pendant as well as the cord, because a cord by the bed is no use on the floor." },
                { name: "All meals and drinks", price: 0, meta: "Included", description: "Three cooked meals, snacks, and a kitchen open all night." },
                { name: "Laundry", price: 0, meta: "Included", description: "Personal laundry done here, named and ironed. Dry cleaning is at cost." },
                { name: "GP, district nurse, dentist", price: 0, meta: "Included", description: "The practice visits weekly. Chiropody and optician come in; both are charged, see the fees page." },
                { name: "Wifi and a TV point", price: 0, meta: "Included", description: "Your own TV, or ours. Licence is covered by the home's." },
                { name: "Own furniture", price: 0, meta: "Encouraged", description: "Chair, pictures, bedding, and your own bed if you would rather. We will help move it in." },
              ]} />
            </div>
            <div>
              <InspectionRating {...RATING} />
              <Faq className="mt-8" items={[
                { question: "Can we choose the room?", answer: "You choose from what is free, and there is rarely a choice of more than two. Garden rooms have a waiting list of about eight months." },
                { question: "Can somebody move rooms later?", answer: "Yes, and it happens — usually from the first floor to the ground floor as mobility changes. The fee changes to the new room's fee, up or down." },
                { question: "Are the doors locked?", answer: "Only on the dementia floor, which is a secure unit. Everywhere else people come and go, and several residents walk into Walkley on their own." },
                { question: "What about a couple?", answer: "Two singles next door to each other, or the shared room. We have done both and would talk it through rather than assume." },
              ]} />
            </div>
          </div>
        </section>
      </div>
    </SiteChrome>
  );
}
