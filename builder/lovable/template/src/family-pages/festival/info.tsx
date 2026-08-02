// festival /info — travel, camping, access and the rules. At this scale a
// practical page is not optional; it is what stops the phone ringing.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { Faq } from "@/components/ui/faq";
import { LocationCard } from "@/components/ui/location-card";
import { SafeImage } from "@/components/ui/safe-image";
import { SectionHeader } from "@/components/ui/section-header";
import { TrustStrip } from "@/components/ui/trust-strip";
export const Route = createFileRoute("/info")({ component: P });
function P() {
  return (
    <SiteChrome name="Loxley Weekender" tagline="Three days in a valley, first weekend of September."
      links={[{ label: "Home", href: "#/" }, { label: "Lineup", href: "#/lineup" }]}
      action={{ label: "Buy tickets", href: "#/" }}>
      <div className="mx-auto max-w-5xl px-6 py-14">
        <SectionHeader eyebrow="Getting there" title="Everything practical, in one place" />
        <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_1fr]">
          <div className="space-y-8">
            <div>
              <h2 className="text-lg font-medium">By bus</h2>
              <p className="mt-2 text-base leading-relaxed text-muted-foreground">
                The 61 and 62 from Hillsborough interchange stop at Loxley Chapel, an eight-minute walk.
                Last one back is 23:10 on Friday and Saturday, which is before the late tent finishes —
                plan for that or camp.
              </p>
            </div>
            <div>
              <h2 className="text-lg font-medium">By car</h2>
              <p className="mt-2 text-base leading-relaxed text-muted-foreground">
                Parking is £12 for the weekend, in a field, and it becomes a mud bath if it rains. Drop-off
                is free at the top gate. There is no overnight parking for campervans and we cannot make an
                exception, however early you ask.
              </p>
            </div>
            <div>
              <h2 className="text-lg font-medium">Camping</h2>
              <p className="mt-2 text-base leading-relaxed text-muted-foreground">
                Included with every weekend ticket. Pitches are not allocated — the tree line goes first and
                the far corner is quieter. Showers are cold and there are twelve of them; the toilets are
                serviced twice a day.
              </p>
            </div>
          </div>
          <div className="space-y-8">
            <SafeImage src={null} alt="The walk down from Loxley Chapel" ratio="4/3" />
            <LocationCard name="Loxley Weekender" address="Rowel Bridge Field, Loxley Road, Sheffield, S6 6RR"
              note="What3words on the ticket. The postcode drops you 400m short — follow the signs, not the satnav." />
          </div>
        </div>
        <section className="mt-14 border-t border-border pt-10">
          <SectionHeader eyebrow="Access" title="What we can and cannot do" />
          <div className="mt-6">
            <TrustStrip items={[
              { title: "PA tickets free", description: "Email us, no proof of anything required" },
              { title: "Viewing platform", description: "Main stage, step-free, first come" },
              { title: "Accessible camping", description: "Level pitches near the gate, book ahead" },
            ]} />
          </div>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground">
            Honestly: the barn is up a slope and the path is bound gravel rather than tarmac, and in heavy
            rain the main field gets soft. We would rather tell you that now than have you find out on the
            Saturday.
          </p>
        </section>
        <section className="mt-14 border-t border-border pt-10">
          <SectionHeader eyebrow="The rules" title="Short list, and we mean them" />
          <Faq className="mt-6" items={[
            { question: "Glass", answer: "None on site at all, campsite included. There is a bottle amnesty bin at the gate and nobody gets in trouble for using it." },
            { question: "Your own drink", answer: "Campsite yes, in plastic, sensible amounts. Arena no — the bar is what keeps the ticket at £68." },
            { question: "Fires and stoves", answer: "No open fires. Gas stoves on the ground, away from tents, and there is a fire point every fifty metres." },
            { question: "Leaving and coming back", answer: "As often as you like with a wristband. The gate is staffed until 2am and from 8am." },
            { question: "What happens to the field afterwards", answer: "It is a working farm and we get it back to grass in three weeks. Take your tent home — 400 were left last year and that is the one thing that genuinely upsets us." },
          ]} />
        </section>
      </div>
    </SiteChrome>
  );
}
