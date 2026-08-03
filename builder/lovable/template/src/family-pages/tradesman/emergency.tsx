// tradesman/emergency — 24-HOUR TRADES. Same call-first family, and the change
// is which number leads. Somebody reading this at two in the morning has water
// coming through a ceiling; the out-of-hours line is the hero, the daytime one
// is secondary, and the first thing on the page after the number is how to stop
// the water — because that is worth more to them than we are for ten minutes.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { CtaBand } from "@/components/ui/cta-band";
import { Gallery } from "@/components/ui/gallery";
import { RateCard } from "@/components/ui/rate-card";
import { SafeImage } from "@/components/ui/safe-image";
import { SectionHeader } from "@/components/ui/section-header";
import { ServiceArea } from "@/components/ui/service-area";
import { StatsBand } from "@/components/ui/stats-band";
import { Testimonial } from "@/components/ui/testimonial";
import { TrustStrip } from "@/components/ui/trust-strip";
export const Route = createFileRoute("/emergency")({ component: P });
export const AREAS = ["S1", "S2", "S3", "S6", "S7", "S8", "S10", "S11", "S17", "S35", "S36", "Hillsborough", "Walkley", "Crookes", "Nether Edge", "Stocksbridge"];
function P() {
  return (
    <SiteChrome name="Barlow & Son" tagline="Plumbing and heating, Sheffield. Somebody answers at three in the morning."
      links={[{ label: "The work", href: "#/work" }, { label: "Quote", href: "#/quote" }, { label: "Areas", href: "#areas" }]}
      action={{ label: "24hr: 07700 900 411", href: "tel:+447700900411" }}>

      {/* THE OUT-OF-HOURS NUMBER IS THE HERO. The ordinary version of this
          family leads with the office line; at two in the morning that number
          is the wrong one and finding it out costs the twenty minutes the
          ceiling has left. */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <div className="grid items-start gap-10 lg:grid-cols-[1.15fr_1fr]">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Gas Safe 512204 · father and son · answered 24 hours</p>
              <h1 className="mt-3 text-5xl font-semibold tracking-tight text-balance">
                Water coming through a ceiling?
              </h1>
              <a className="mt-6 block rounded-lg bg-primary px-6 py-6 text-center text-primary-foreground" href="tel:+447700900411">
                <span className="block text-xs font-medium uppercase tracking-[0.18em] opacity-80">Ring now, any hour</span>
                <span className="mt-1 block text-4xl font-semibold tracking-tight tabular-nums">07700 900 411</span>
                <span className="mt-1 block text-sm opacity-80">Dave's mobile. It is on his bedside table and it is never off</span>
              </a>
              <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                <span className="text-muted-foreground">
                  Office, 07:00–18:00: <a className="font-medium text-foreground underline underline-offset-4" href="tel:+441142661180">0114 266 1180</a>
                </span>
                <a className="underline underline-offset-4" href="#/quote">Not urgent? Send photographs instead</a>
              </div>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground">
                Two of us, one van each, no call centre and no agency. Out of hours you get Dave, who
                will tell you what to turn off before he sets off — and if it is something you can
                fix yourself in five minutes, he will say that instead of driving over.
              </p>
            </div>

            {/* WHAT TO DO IN THE NEXT TWO MINUTES, before anything about us.
                It is worth more to them than we are, and a trade that leads
                with its own credentials at 2am has misread the room. */}
            <div className="rounded-lg border border-border bg-muted/40 p-6">
              <h2 className="text-lg font-semibold tracking-tight">First, before you ring</h2>
              <ol className="mt-4 divide-y divide-border border-y border-border text-base">
                <li className="py-3.5">
                  <span className="font-medium">Turn the water off at the stopcock</span>
                  <span className="block text-sm text-muted-foreground">
                    Under the kitchen sink in nine houses out of ten. Clockwise. If it will not
                    budge, the outside one is under a small metal lid by the pavement.
                  </span>
                </li>
                <li className="py-3.5">
                  <span className="font-medium">Then open every cold tap in the house</span>
                  <span className="block text-sm text-muted-foreground">
                    It drains the pipes above the leak, which is most of what is still coming
                    through. This is the step people skip and it makes the biggest difference.
                  </span>
                </li>
                <li className="py-3.5">
                  <span className="font-medium">If it is near a light or a socket, turn that circuit off</span>
                  <span className="block text-sm text-muted-foreground">
                    At the consumer unit, not at the switch. Do not stand in water to reach it.
                  </span>
                </li>
                <li className="py-3.5">
                  <span className="font-medium">Smell gas instead? Do not ring us</span>
                  <span className="block text-sm text-muted-foreground">
                    Ring the National Gas Emergency Service on 0800 111 999, open the windows, and
                    do not touch a switch. They come free and they come first.
                  </span>
                </li>
              </ol>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                Then ring. Half the calls Dave takes after midnight end with him talking somebody
                through the stopcock and going back to bed, and neither of us minds that at all.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-12">
        <StatsBand items={[
          { value: "38 min", label: "Median, call to doorstep, at night" },
          { value: "24/7", label: "Answered by a person, never a service" },
          { value: "£95", label: "Call-out after midnight, first hour in" },
          { value: "1998", label: "Same two people, same two vans" },
        ]} />
      </section>

      <section className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <SectionHeader eyebrow="What it costs at 3am" title="Published, because that is when nobody can shop around"
            description="An emergency call-out is the one job where a customer has no bargaining position at all, which is exactly why the number should be on the page rather than decided at the door." />
          <div className="mt-8 grid gap-10 lg:grid-cols-[1.2fr_1fr]">
            <RateCard label="When you ring" unit="hour" rates={[
              { period: "07:00–18:00, weekdays", units: 1, price: 55, note: "Ordinary rate. First hour, then £45 an hour after" },
              { period: "18:00–22:00, and Saturdays", units: 1, price: 75, note: "Then £55 an hour" },
              { period: "22:00–07:00, and Sundays", units: 1, price: 95, note: "Then £70 an hour" },
              { period: "Bank holidays, any hour", units: 1, price: 95, note: "Same as nights. We do not have a triple rate" },
            ]} note="Parts at cost plus 10%, itemised on the invoice. No call-out fee on top of the hourly rate and no minimum beyond the first hour. If Dave talks you through it on the phone and does not come out, there is no charge at all — that happens about twice a week." />
            <div>
              <TrustStrip columns={1} items={[
                { title: "Gas Safe 512204", description: "Checkable on the register. Ask any engineer for their number and check it — it takes forty seconds" },
                { title: "£5m public liability", description: "Certificate emailed before we start, without being asked" },
                { title: "No subcontractors", description: "It is Dave or it is Michael. Nobody else has ever been in our van" },
              ]} />
              <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
                We will not quote a fixed price for an emergency over the phone and neither should
                anybody else — until somebody has lifted the floor, a number is a guess. What we
                will do is tell you the hourly rate, which is above, and ring you before doing
                anything that takes it past two hours.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="areas" className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid gap-12 lg:grid-cols-[1fr_1fr]">
          <div>
            <SectionHeader eyebrow="Where" title="Sheffield, and about twenty minutes out of it"
              description="At night the honest radius is smaller than the daytime one — check before you plan around us." />
            <ServiceArea className="mt-6" areas={AREAS}
              note="Inside those, day or night. Outside them we will still answer the phone and tell you who to ring instead, which is usually more use than a maybe." />
          </div>
          <div>
            <SectionHeader eyebrow="What we actually get called out for" title="At night, it is four things" />
            <ul className="mt-6 divide-y divide-border border-y border-border text-base">
              <li className="py-3.5">
                <span className="font-medium">A burst or a leak under a floor</span>
                <span className="block text-sm text-muted-foreground">About half of them. Worst in the first frost and the first thaw, and we are busiest on the thaw.</span>
              </li>
              <li className="py-3.5">
                <span className="font-medium">No heating and no hot water, with a baby or somebody elderly in the house</span>
                <span className="block text-sm text-muted-foreground">Say so when you ring. It moves you up the list and nobody will check.</span>
              </li>
              <li className="py-3.5">
                <span className="font-medium">A blocked soil stack</span>
                <span className="block text-sm text-muted-foreground">Unpleasant, quick, and the one where the phone advice almost never works.</span>
              </li>
              <li className="py-3.5">
                <span className="font-medium">A boiler locked out with a fault code</span>
                <span className="block text-sm text-muted-foreground">Read us the code before we set off. Four of them we can talk you through resetting, and one of them means turn it off and open a window.</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <SectionHeader eyebrow="The work" title="The daytime half, which is most of it" />
          <Gallery className="mt-8" columns={4} items={[
            { alt: "Bathroom, Crookes — finished", caption: "Bathroom, Crookes" },
            { alt: "Boiler swap, Walkley", caption: "Boiler swap, Walkley" },
            { alt: "Under a floor at Hillsborough", caption: "The burst at Hillsborough, 2am" },
            { alt: "A rebuilt airing cupboard", caption: "Cylinder, Nether Edge" },
          ]} />
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            <Testimonial item={{ quote: "Rang at ten past two. He answered, told me where the stopcock was, and was here in half an hour. The bill was £140 and I would have paid four times it that night.", name: "Kath Ellery", role: "Walkley, February" }} />
            <Testimonial item={{ quote: "Talked me through resetting the boiler on the phone at eleven at night and would not take anything for it. Used them for the bathroom three months later.", name: "Sam Okoro", role: "Crookes" }} />
            <Testimonial item={{ quote: "The only 24-hour number in Sheffield that is an actual person rather than a call centre in Manchester taking a booking fee.", name: "Rebecca Naismith", role: "Nether Edge" }} />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_1fr]">
          <CtaBand title="It is Dave's mobile, not a switchboard"
            description="If it rings out he is under somebody's floor. Leave it thirty seconds and ring again — he will pick up, and he would rather you did than gave up."
            action={{ label: "Ring 07700 900 411", href: "tel:+447700900411" }} />
          <SafeImage src={null} alt="The van at four in the morning" ratio="16/9" />
        </div>
      </section>
    </SiteChrome>
  );
}
