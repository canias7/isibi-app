// gym/property-switcher /location — one house in full. Same role as the base
// family's branch page, and the switcher change is that it carries a way BACK
// to the other three at the top: somebody comparing hotels lands on one from
// search and needs to know there are three more, which a branch page for a gym
// chain does not have to say.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { Faq } from "@/components/ui/faq";
import { Gallery } from "@/components/ui/gallery";
import { LocationCard } from "@/components/ui/location-card";
import { OpeningHours, type DayHours } from "@/components/ui/opening-hours";
import { RoomCard } from "@/components/ui/room-card";
import { SafeImage } from "@/components/ui/safe-image";
import { SectionHeader } from "@/components/ui/section-header";
import { HOUSES } from "./index";
export const Route = createFileRoute("/location")({ component: P });
const CHROME = {
  name: "Four Houses",
  tagline: "Four hotels in Yorkshire. One booking, one card, four completely different places.",
  links: [{ label: "All four", href: "#/" }, { label: "Rates", href: "#/memberships" }],
  action: { label: "Book direct", href: "#/memberships" },
};
const HOURS: DayHours[] = [
  { day: 1, label: "Monday", open: "07:00", close: "23:00" },
  { day: 2, label: "Tuesday", open: "07:00", close: "23:00" },
  { day: 3, label: "Wednesday", open: "07:00", close: "23:00" },
  { day: 4, label: "Thursday", open: "07:00", close: "23:00" },
  { day: 5, label: "Friday", open: "07:00", close: "00:00" },
  { day: 6, label: "Saturday", open: "07:00", close: "00:00" },
  { day: 0, label: "Sunday", open: "08:00", close: "22:30" },
];
function P() {
  const h = HOUSES[1];
  const others = HOUSES.filter((x) => x.key !== h.key);
  return (
    <SiteChrome {...CHROME}>
      <div className="mx-auto max-w-6xl px-6 py-10">
        {/* THE WAY BACK TO THE OTHER THREE, at the top. Somebody comparing
            hotels lands here from a search and has no idea there are three
            more — a gym chain's branch page never has to say this because
            nobody compares gyms two hundred miles apart. */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <a className="text-muted-foreground underline underline-offset-4" href="#/">← All four houses</a>
          <span className="text-muted-foreground">Or switch to:</span>
          {others.map((x) => (
            <a key={x.key} className="rounded-full border border-border px-3 py-1 font-medium" href="#/">
              {x.name} <span className="font-normal text-muted-foreground">· from £{x.from}</span>
            </a>
          ))}
        </div>

        <div className="mt-8 grid items-start gap-10 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">{h.where} · {h.rooms} rooms · from £{h.from}</p>
            <h1 className="mt-2 text-5xl font-semibold tracking-tight text-balance">{h.name}</h1>
            <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted-foreground">{h.line}</p>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground">{h.blurb}</p>
            <div className="mt-7 grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-border p-5">
                <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Best for</p>
                <p className="mt-1.5 text-base leading-relaxed">{h.best}</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/50 p-5">
                <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Not for</p>
                <p className="mt-1.5 text-base leading-relaxed">{h.not}</p>
              </div>
            </div>
          </div>
          <SafeImage src={null} alt={`${h.name} from the harbour`} ratio="4/3" />
        </div>

        <section className="mt-14 border-t border-border pt-10">
          <SectionHeader eyebrow="Rooms" title={`All ${h.rooms}, in three shapes`}
            description="And which twelve face the water, which is the only question anybody asks about this one." />
          <div className="mt-6 grid gap-4">
            {h.suites.map((s) => (
              <RoomCard key={s.name} name={s.name} price={s.price} per="night" sleeps={s.sleeps}
                size={s.size} image={null} amenities={s.has} description={s.about} />
            ))}
          </div>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <div className="grid gap-10 lg:grid-cols-[1fr_1fr]">
            <div>
              <SectionHeader eyebrow="Where" title="Church Street, on the harbour" />
              <LocationCard className="mt-6" name={h.name} address={h.address} note={h.travel} />
              <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
                Parking is the thing to sort before you set off. There is none at the hotel and there
                never has been — the town car park is four minutes away and £9 a day, and in August
                it is full by ten in the morning.
              </p>
            </div>
            <div>
              <SectionHeader eyebrow="The bar and kitchen" title="07:00 to eleven, seven days" />
              <OpeningHours className="mt-6" days={HOURS} />
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                Breakfast 07:00–10:00, kitchen 12:00–21:00, bar until eleven and midnight at
                weekends. Non-residents welcome at all of it, which is why it is a proper bar.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <SectionHeader eyebrow="The building" title="A sail loft, and it still looks like one" />
          <Gallery className="mt-8" columns={4} items={[
            { alt: "The frontage on Church Street", caption: "Church Street" },
            { alt: "A harbour room", caption: "One of the twelve that face the water" },
            { alt: "The Loft, top floor", caption: "The Loft — 31 stairs" },
            { alt: "The bar at six", caption: "The bar, about six" },
            { alt: "Breakfast in the front room", caption: "Breakfast, 07:00–10:00" },
            { alt: "The 199 steps from the top", caption: "The abbey steps, four minutes away" },
            { alt: "The harbour in February", caption: "February, which is the best time" },
            { alt: "The stairs and the original beams", caption: "No lift, and there cannot be one" },
          ]} />
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <div className="max-w-3xl">
            <SectionHeader eyebrow="Asked often" title={`About ${h.name} specifically`} />
            <Faq className="mt-6" items={[
              { question: "Which rooms face the harbour?", answer: "Twelve of the twenty-four, and they are on the second and third floors. Ring and we will tell you which three of the twelve are the best rather than letting you pick from a floor plan." },
              { question: "Is there a lift?", answer: "No, and there cannot be — it is a Grade II sail loft. If stairs are a problem, The Mill at Hebden Bridge has a lift to every floor and two ground-floor accessible rooms at the same rate." },
              { question: "Where do we park?", answer: "The town car park, four minutes on foot, £9 a day. There is no hotel parking and no permit scheme. In August it is full by ten and we will say so on the phone." },
              { question: "Are dogs allowed?", answer: "In four rooms, £15 a stay, and in the whole bar. Not in the breakfast room, which is a food hygiene rule. The Wharfe's Barn is better if you have two." },
              { question: "How noisy is it?", answer: "Gulls from about five in summer, and the harbour is working — a boat leaves at half four some mornings. Town-facing rooms are noticeably quieter and £20 less." },
              { question: "Can we get a table if we are not staying?", answer: "Yes, always, and about half the kitchen's covers are locals. Book at weekends between June and September; walk in the rest of the year." },
            ]} />
          </div>
        </section>
      </div>
    </SiteChrome>
  );
}
