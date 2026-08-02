// holiday-let /area — what is worth doing within a walk or a drive. Written by
// somebody who lives here rather than lifted off a tourist board, which is the
// only reason anybody reads one of these pages.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { AvailabilityCalendar, type Night } from "@/components/ui/availability-calendar";
import { Gallery } from "@/components/ui/gallery";
import { SafeImage } from "@/components/ui/safe-image";
import { SectionHeader } from "@/components/ui/section-header";
export const Route = createFileRoute("/area")({ component: P });
const SEPTEMBER: Night[] = Array.from({ length: 30 }, (_, i) => {
  const day = i + 1;
  const dow = new Date(2026, 8, day).getDay();
  const weekend = dow === 5 || dow === 6;
  return {
    date: `2026-09-${String(day).padStart(2, "0")}`,
    taken: [4, 5, 6, 18, 19].includes(day),
    rate: weekend ? 155 : 125,
    minNights: weekend ? 2 : 2,
  };
});
const WALKS = [
  { name: "Stanage Edge", how: "40 minutes uphill from the door", what: "Four miles of gritstone edge and the best-known climbing in the country. Go at seven in the evening in summer and you will have most of it." },
  { name: "Padley Gorge", how: "15 minutes by car, or the train to Grindleford", what: "Oak woodland and a stream full of boulders. The one walk here that works with small children and in the rain." },
  { name: "Higger Tor and Carl Wark", how: "An hour on foot, mostly up", what: "An iron age fort with a rampart you can still walk along. Almost nobody goes to Carl Wark and it is fifteen minutes off the path." },
  { name: "The Longshaw estate", how: "20 minutes on foot to the boundary", what: "National Trust, so a car park and a decent café. The best of it is the bit past the pond that people do not walk to." },
  { name: "Bamford Edge", how: "12 minutes by car", what: "The view over Ladybower that ends up on postcards. Park on New Road and it is twenty minutes up." },
  { name: "Hathersage to Grindleford, by the river", how: "Flat, an hour each way", what: "The one to do when the weather has come in. Ends at the Grindleford station café, which is an institution and not a gastropub." },
];
const EATING = [
  { name: "The Scotsman's Pack", how: "15 minutes down the lane", what: "The nearest pub and the one we go to. Book on a Friday. The pie is the thing." },
  { name: "Cintra's Tea Rooms", how: "In the village", what: "Breakfast until half eleven, and the only place open at nine on a Sunday." },
  { name: "Coleman's Deli", how: "In the village", what: "Where to get the bread, cheese and something for the walk. Shuts at four and does not open Sunday." },
  { name: "The Plough, Leadmill", how: "10 minutes by car", what: "Proper dinner, worth the taxi. Book two weeks out for a Saturday." },
  { name: "Grindleford Station Café", how: "10 minutes by car", what: "Enormous portions, cash preferred, a sign about mobile phones. Do not be late for last orders." },
  { name: "The Anglers Rest, Bamford", how: "12 minutes by car", what: "Community-owned — the village bought it. Post office in one room and a pub in the other." },
];
function P() {
  return (
    <SiteChrome name="Wren Cottage" tagline="A two-bedroom stone cottage above Hathersage, in the Peak District."
      links={[{ label: "Home", href: "#/" }, { label: "The rooms", href: "#/rooms" }]}
      action={{ label: "Check availability", href: "#dates" }}>

      <section className="relative">
        <SafeImage src={null} alt="Stanage Edge from the path above the cottage" ratio="21/9" />
      </section>

      <div className="mx-auto max-w-6xl px-6 py-14">
        <SectionHeader eyebrow="Round about" title="What is actually worth doing"
          description="Written by us, and we live here. None of it is on this page because somebody paid to be, and the walks are ordered by how far you have to go rather than by how famous they are." />

        <section className="mt-12">
          <h2 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">Walks, nearest first</h2>
          <div className="mt-6 grid gap-x-10 gap-y-8 md:grid-cols-2">
            {WALKS.map((w) => (
              <article key={w.name} className="border-t border-border pt-5">
                <h3 className="text-xl font-medium tracking-tight">{w.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{w.how}</p>
                <p className="mt-2 text-base leading-relaxed text-muted-foreground">{w.what}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <h2 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">Eating and the shop</h2>
          <div className="mt-6 grid gap-x-10 gap-y-8 md:grid-cols-2">
            {EATING.map((e) => (
              <article key={e.name} className="border-t border-border pt-5">
                <h3 className="text-xl font-medium tracking-tight">{e.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{e.how}</p>
                <p className="mt-2 text-base leading-relaxed text-muted-foreground">{e.what}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <SectionHeader eyebrow="Getting here" title="It works without a car, which is unusual round here"
            description="Hathersage is on the Sheffield to Manchester line, two trains an hour, and the cottage is twelve minutes' walk up from the station. Everything on this page except Bamford Edge is reachable on foot or on that train." />
          <div className="mt-8 grid gap-8 sm:grid-cols-3">
            {[
              ["By train", "Sheffield 20 min, Manchester 55 min. Two an hour, one on Sundays. Twelve minutes' walk up from the station and it is steep with a suitcase."],
              ["By car", "Ninety minutes from Leeds, two hours from Birmingham. One parking space outside, another on the lane."],
              ["Getting about", "The 272 runs to Castleton and Bakewell hourly. Taxis exist but need booking the day before, not the hour before."],
            ].map(([k, v]) => (
              <div key={k} className="border-t border-border pt-4">
                <p className="font-medium">{k}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{v}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <SectionHeader eyebrow="Round here" title="The valley, in eight photographs" />
          <Gallery className="mt-8" columns={4} items={[
            { src: null, alt: "Stanage in the morning" },
            { src: null, alt: "Padley Gorge in autumn" },
            { src: null, alt: "Higger Tor" },
            { src: null, alt: "Hathersage from the path" },
            { src: null, alt: "The Scotsman's Pack" },
            { src: null, alt: "Ladybower from Bamford Edge" },
            { src: null, alt: "The river walk to Grindleford" },
            { src: null, alt: "Coggers Lane in snow" },
          ]} />
        </section>

        <section id="dates" className="mt-14 border-t border-border pt-10">
          <SectionHeader eyebrow="September" title="Quieter, and cheaper"
            description="The edges are empty after the schools go back and the weather is usually better than August. Prices drop about twenty percent." />
          <div className="mt-8 max-w-3xl">
            <AvailabilityCalendar nights={SEPTEMBER} month="2026-09" now={new Date(2026, 7, 2)} />
          </div>
        </section>
      </div>
    </SiteChrome>
  );
}
