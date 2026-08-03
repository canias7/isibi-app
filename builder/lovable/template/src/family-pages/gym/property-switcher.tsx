// gym/property-switcher — HOTEL GROUP. The location-first family answers
// "which is nearest"; a group of four hotels answers a different question —
// somebody is choosing WHICH, not finding the closest, and distance is
// irrelevant when three of them are two hundred miles apart. So the locator
// becomes a switcher: pick one and the whole right side changes to it.
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { Gallery } from "@/components/ui/gallery";
import { LocationCard } from "@/components/ui/location-card";
import { RoomCard } from "@/components/ui/room-card";
import { SafeImage } from "@/components/ui/safe-image";
import { SectionHeader } from "@/components/ui/section-header";
import { StatsBand } from "@/components/ui/stats-band";
import { Testimonial } from "@/components/ui/testimonial";
import { cn } from "@/lib/utils";
export const Route = createFileRoute("/property-switcher")({ component: P });
export type House = {
  key: string; name: string; where: string; rooms: number; from: number;
  line: string; blurb: string; address: string; travel: string;
  best: string; not: string;
  suites: { name: string; price: string; sleeps: number; size: string; about: string; has: string[] }[];
  quote: { quote: string; name: string; role: string };
};
export const HOUSES: House[] = [
  {
    key: "wharfe", name: "The Wharfe", where: "Wharfedale, North Yorkshire", rooms: 18, from: 165,
    line: "A dales inn with eighteen rooms and a fire that is lit from September.",
    blurb: "The oldest of the four and the one people come back to. Seventeenth-century, low ceilings, and a bar that locals still drink in — which is the whole reason it works and the reason two of the rooms are above it.",
    address: "Kettlewell, Skipton, North Yorkshire, BD23 5RD",
    travel: "Skipton station 40 min by taxi. Parking free, 22 spaces.",
    best: "Walking, and the two weeks either side of Christmas.",
    not: "Light sleepers in rooms 3 and 4 — the bar is underneath and it is a proper bar until eleven.",
    suites: [
      { name: "Fell room", price: "From £165", sleeps: 2, size: "Second floor · 4.1m × 3.6m", about: "Looks up the dale. Low beam over the bed and anybody over six foot will find it.", has: ["Roll-top bath", "King bed", "Fire in winter", "14 stairs"] },
      { name: "Beck room", price: "From £185", sleeps: 2, size: "First floor · 4.4m × 3.8m", about: "Over the water, which you hear all night and either love or do not.", has: ["Walk-in shower", "King bed", "River view"] },
      { name: "The Barn", price: "From £245", sleeps: 4, size: "Detached · two bedrooms", about: "Across the yard, its own door, and dogs are welcome in it.", has: ["Two bedrooms", "Kitchenette", "Dogs welcome", "No stairs"] },
    ],
    quote: { quote: "Fourth year running. The fire is real, the bar is not a hotel bar, and nobody has ever tried to sell me a spa treatment.", name: "Hilary Nutbrown", role: "Four stays" },
  },
  {
    key: "quay", name: "The Quay", where: "Whitby, North Yorkshire", rooms: 24, from: 145,
    line: "Twenty-four rooms on the harbour, half of them facing it.",
    blurb: "Built as a sail loft and it still looks like one. The harbour-facing rooms are worth the difference and we will tell you which twelve they are rather than making you guess from a floor plan.",
    address: "Church Street, Whitby, North Yorkshire, YO22 4DE",
    travel: "Whitby station 6 min walk. No parking — the town car park is 4 min and £9 a day.",
    best: "Out of season. February on the harbour is the best thing this group has.",
    not: "Parking, genuinely. If you need to park at the door, take The Wharfe instead.",
    suites: [
      { name: "Harbour double", price: "From £165", sleeps: 2, size: "Second floor · 3.8m × 3.4m", about: "Twelve of these and they all face the water. Gulls from about five in summer.", has: ["Harbour view", "King bed", "Walk-in shower"] },
      { name: "Town double", price: "From £145", sleeps: 2, size: "First or second floor · 3.6m × 3.2m", about: "Faces the church steps. Quieter, cheaper, and the view is not nothing.", has: ["King bed", "Bath with shower over"] },
      { name: "The Loft", price: "From £220", sleeps: 3, size: "Top floor · open plan", about: "The old sail loft, whole. Thirty-one stairs and no lift, said plainly.", has: ["Harbour view", "Sofa bed", "31 stairs", "Best view in the group"] },
    ],
    quote: { quote: "Asked for a harbour room and got told which three were the best of the twelve. That is not something a chain does.", name: "Owen Pryce", role: "Two stays" },
  },
  {
    key: "mill", name: "The Mill", where: "Hebden Bridge, West Yorkshire", rooms: 31, from: 125,
    line: "A converted mill, thirty-one rooms, and the only one of the four with a lift.",
    blurb: "The newest and the most practical. Level access throughout, a lift to every floor, and the only one that takes a group of more than eight. It is also the least characterful and we would rather say so than pretend otherwise.",
    address: "Victoria Road, Hebden Bridge, West Yorkshire, HX7 8LN",
    travel: "Hebden Bridge station 8 min walk. Underground parking, £8 a night, 40 spaces.",
    best: "Anybody who needs step-free, and anybody arriving by train.",
    not: "Somebody wanting beams and a fire. It is a mill and it looks like a mill.",
    suites: [
      { name: "Mill double", price: "From £125", sleeps: 2, size: "Any floor · 4.0m × 3.6m", about: "All twenty-two are identical, which sounds like a criticism and is a promise — you get what you saw.", has: ["Lift to every floor", "King bed", "Walk-in shower", "Level access"] },
      { name: "Accessible double", price: "From £125", sleeps: 2, size: "Ground floor · 4.6m × 4.0m", about: "Wet room, grab rails, and a 900mm door. Two of them, and they are the same price as everything else.", has: ["Wet room", "Level access", "Wider doors", "Emergency cord"] },
      { name: "Canal-side suite", price: "From £195", sleeps: 4, size: "Ground floor · two rooms", about: "Doors onto the towpath. The only room in the group a wheelchair can get in and out of unaided.", has: ["Two rooms", "Level access", "Towpath doors", "Dogs welcome"] },
    ],
    quote: { quote: "The only hotel I have booked in ten years where the accessible room was not the worst room and was not more expensive.", name: "Jan Farthing", role: "Six stays" },
  },
  {
    key: "kelham", name: "The Works", where: "Kelham Island, Sheffield", rooms: 40, from: 110,
    line: "Forty rooms in a cutlery works, and the only city one.",
    blurb: "The city hotel of the four, in a Victorian cutlery works with the crucible furnace still in the lobby. It is the loudest, the cheapest and the best connected — and the one people book for a wedding at the town hall.",
    address: "Alma Street, Sheffield, S3 8SA",
    travel: "Sheffield station 12 min by tram. Parking £12 a night, 30 spaces, booked ahead.",
    best: "A night in the city, a wedding, or anybody who wants a bar until one.",
    not: "Quiet. It is Kelham Island on a Saturday and the windows are original.",
    suites: [
      { name: "Works double", price: "From £110", sleeps: 2, size: "Any floor · 3.8m × 3.4m", about: "Exposed brick, original windows, and those windows are single glazed. Earplugs in every drawer, not as a joke.", has: ["Lift", "King bed", "Walk-in shower"] },
      { name: "Courtyard double", price: "From £130", sleeps: 2, size: "First floor · 3.8m × 3.4m", about: "Faces in rather than onto Alma Street. Ask for these if you are a light sleeper.", has: ["Lift", "King bed", "Quietest rooms"] },
      { name: "The Crucible", price: "From £210", sleeps: 2, size: "Top floor · 6.2m × 4.4m", about: "The old manager's office, with the furnace chimney running through it. One of them.", has: ["Freestanding bath", "Lift", "Chimney through the room"] },
    ],
    quote: { quote: "They told me on the phone the front rooms are noisy and moved me to a courtyard one for the same money. Everywhere else waits for the complaint.", name: "Marcus Ojo", role: "Three stays" },
  },
];
function P() {
  const [key, setKey] = useState(HOUSES[0].key);
  const h = HOUSES.find((x) => x.key === key) ?? HOUSES[0];
  return (
    <SiteChrome name="Four Houses" tagline="Four hotels in Yorkshire. One booking, one card, four completely different places."
      links={[{ label: "One house", href: "#/location" }, { label: "Rates", href: "#/memberships" }]}
      action={{ label: "Book direct", href: "#/memberships" }}>

      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-10 md:grid-cols-[340px_1fr]">
        {/* THE SWITCHER, PINNED. The base family pins a locator because
            "which is nearest" is its question; three of these are two hundred
            miles apart, so nearest is meaningless and CHOOSING is the task. */}
        <div className="self-start md:sticky md:top-20">
          <h1 className="text-3xl font-semibold tracking-tight">Which one?</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Not which is nearest — they are two hundred miles apart at the ends. These are four
            different places that happen to share an owner, and the differences are the point.
          </p>
          <ul className="mt-5 divide-y divide-border rounded-xl border border-border">
            {HOUSES.map((x) => (
              <li key={x.key}>
                <button type="button" onClick={() => setKey(x.key)} aria-current={x.key === key ? "true" : undefined}
                  className={cn("w-full cursor-pointer px-4 py-3.5 text-left", x.key === key ? "bg-muted" : "hover:bg-muted/50")}>
                  <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <span className={cn("text-base", x.key === key ? "font-semibold" : "font-medium")}>{x.name}</span>
                    <span className="text-sm tabular-nums text-muted-foreground">from £{x.from}</span>
                  </span>
                  <span className="mt-0.5 block text-sm text-muted-foreground">{x.where} · {x.rooms} rooms</span>
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            One booking system, one loyalty card and one phone number. Nothing else is shared —
            there is no group breakfast, no group decor and no group playlist.
          </p>
        </div>

        {/* EVERYTHING ON THE RIGHT IS THE CHOSEN HOUSE. Switching changes the
            whole side rather than scrolling to an anchor, because a group's
            visitor compares by flicking between two and back. */}
        <div className="grid gap-10">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">{h.where} · {h.rooms} rooms · from £{h.from}</p>
            <h2 className="mt-2 text-4xl font-semibold tracking-tight text-balance">{h.name}</h2>
            <p className="mt-3 max-w-xl text-lg leading-relaxed text-muted-foreground">{h.line}</p>
            <div className="mt-6 grid grid-cols-2 gap-4">
              <SafeImage src={null} alt={`${h.name} from outside`} ratio="4/3" className="col-span-2" />
              <SafeImage src={null} alt={`A room at ${h.name}`} ratio="1/1" />
              <SafeImage src={null} alt={`The bar at ${h.name}`} ratio="1/1" />
            </div>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground">{h.blurb}</p>
          </div>

          {/* BEST FOR / NOT FOR, per house. A group site that says every
              property is perfect for everybody is a group site that sends
              somebody to the wrong one and loses them from all four. */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-border p-5">
              <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Best for</p>
              <p className="mt-1.5 text-base leading-relaxed">{h.best}</p>
            </div>
            <div className="rounded-lg border border-border bg-muted/50 p-5">
              <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Not for</p>
              <p className="mt-1.5 text-base leading-relaxed">{h.not}</p>
            </div>
          </div>

          <div>
            <SectionHeader eyebrow="Rooms" title={`Three of the ${h.rooms}`} />
            <div className="mt-5 grid gap-4">
              {h.suites.map((s) => (
                <RoomCard key={s.name} name={s.name} price={s.price} per="night" sleeps={s.sleeps}
                  size={s.size} image={null} amenities={s.has} description={s.about} />
              ))}
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <LocationCard name={h.name} address={h.address} note={h.travel} />
            <Testimonial item={h.quote} />
          </div>

          <StatsBand items={[
            { value: `£${h.from}`, label: `Cheapest room at ${h.name}` },
            { value: String(h.rooms), label: "Rooms" },
            { value: "4", label: "Houses, one card" },
            { value: "15%", label: "Direct saving against the platforms" },
          ]} />

          <div>
            <SectionHeader eyebrow="The other three" title="Because you are choosing, not searching" />
            <Gallery className="mt-5" columns={3} items={HOUSES.filter((x) => x.key !== h.key).map((x) => ({
              alt: `${x.name}, ${x.where}`, caption: `${x.name} — from £${x.from}`,
            }))} />
          </div>
        </div>
      </div>
    </SiteChrome>
  );
}
