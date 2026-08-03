// tradesman/emergency /work — the same proof page, ordered by the emergency
// question. The ordinary version leads with finished bathrooms; somebody
// deciding whether to trust a 24-hour number at midnight wants to see a NIGHT
// job — a ceiling down at 2am and what it looked like a fortnight later.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { BeforeAfter } from "@/components/ui/before-after";
import { Gallery } from "@/components/ui/gallery";
import { SectionHeader } from "@/components/ui/section-header";
import { Testimonial } from "@/components/ui/testimonial";
export const Route = createFileRoute("/work")({ component: P });
const NIGHT = [
  { where: "Hillsborough", what: "Burst under a bedroom floor", when: "Called 02:10, there 02:44",
    how: "Ceiling already down in the hall. Isolated and capped by half three, boards up and heating back on the same night. Came back on the Thursday to do it properly and to argue with the insurer, which took longer than the repair." },
  { where: "Walkley", what: "Frozen and split rising main", when: "Called 06:20, there 06:55",
    how: "First morning of the thaw, which is our busiest day of the year by a distance. Thawed, cut out the split, new section in copper. Ninety minutes, and the neighbour two doors down got done the same morning." },
  { where: "Nether Edge", what: "Soil stack blocked, three flats", when: "Called 23:40, there 00:20",
    how: "Not a nice one. Rodded from the inspection chamber, cleared by one, and the landlord got photographs of what caused it because two of the three tenants were being blamed for something that was the third's." },
  { where: "Crookes", what: "Boiler locked out, house with a newborn", when: "Called 01:05, there 01:38",
    how: "Fault code read to us on the phone, so the part was on the van before setting off. Diverter valve, running by half two. That is the whole reason we ask for the code first." },
];
function P() {
  return (
    <SiteChrome name="Barlow & Son" tagline="Plumbing and heating, Sheffield. Somebody answers at three in the morning."
      links={[{ label: "Home", href: "#/" }, { label: "Quote", href: "#/quote" }]}
      action={{ label: "24hr: 07700 900 411", href: "tel:+447700900411" }}>
      <div className="mx-auto max-w-6xl px-6 py-14">
        <SectionHeader eyebrow="Nights" title="Four call-outs, with the times on them"
          description="The times are the point. Anybody can photograph a finished bathroom; what somebody deciding whether to ring a mobile at two in the morning wants to see is what happened the last four times." />
        <div className="mt-10 space-y-14">
          {NIGHT.map((j) => (
            <article key={j.where} className="border-t border-border pt-10">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h2 className="text-2xl font-semibold tracking-tight">{j.what}</h2>
                <p className="text-sm uppercase tracking-widest text-muted-foreground">{j.where} · {j.when}</p>
              </div>
              <p className="mt-2 max-w-2xl text-base leading-relaxed text-muted-foreground">{j.how}</p>
              <BeforeAfter className="mt-6" beforeLabel={`${j.what} at ${j.where}, on arrival`} afterLabel={`${j.what} at ${j.where}, put right`} />
            </article>
          ))}
        </div>

        <div className="mt-14 border-t border-border pt-10">
          <SectionHeader eyebrow="Daytime" title="Which is still most of what we do"
            description="Bathrooms, boiler swaps and radiators. The night work pays for the van; this is the actual trade." />
          <Gallery className="mt-8" columns={4} items={[
            { alt: "Full bathroom, Crookes", caption: "Bathroom, Crookes — five days" },
            { alt: "Back boiler to combi, Walkley", caption: "Back boiler out, Walkley" },
            { alt: "Level-access wet room, Fulwood", caption: "Wet room, Fulwood" },
            { alt: "Eleven radiators, Nether Edge", caption: "Whole-house rads, Nether Edge" },
          ]} />
        </div>

        <div className="mt-14 border-t border-border pt-10">
          <SectionHeader eyebrow="Odds and ends" title="The bits nobody photographs" />
          <Gallery className="mt-6" columns={4} items={[
            { alt: "Copper soldered at a joint", caption: "Soldered, not pushed" },
            { alt: "A stopcock finally labelled", caption: "Labelled, at last" },
            { alt: "Dust sheets down at two in the morning", caption: "Sheets first, even at 2am" },
            { alt: "The old suite going in the van", caption: "It leaves with us" },
          ]} />
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-2">
          <Testimonial item={{ quote: "He sent me a photo of the joint before he boarded it back up. Nobody has ever done that.", name: "Rob D", role: "Stannington" }} />
          <Testimonial item={{ quote: "Two in the morning, ceiling on the hall floor, and the man who answered the phone was the man who turned up. I did not think that still existed.", name: "Kath Ellery", role: "Walkley, February" }} />
        </div>
      </div>
    </SiteChrome>
  );
}
