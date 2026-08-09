// festival — FULL-BLEED-HERO: dates, place and the headline names, and nothing
// above the lineup. Tickets and travel are what the grid funnels into.
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { Countdown } from "@/components/ui/countdown";
import { CtaBand } from "@/components/ui/cta-band";
import { Faq } from "@/components/ui/faq";
import { Gallery } from "@/components/ui/gallery";
import { PriceList } from "@/components/ui/price-list";
import { SafeImage } from "@/components/ui/safe-image";
import { SectionHeader } from "@/components/ui/section-header";
import { StatsBand } from "@/components/ui/stats-band";
export const Route = createFileRoute("/")({ component: P });
function P() {
  const navigate = useNavigate();
  return (
    <SiteChrome name="Loxley Weekender" tagline="Three days in a valley, first weekend of September."
      links={[{ label: "Lineup", href: "/lineup" }, { label: "Getting there", href: "/info" }, { label: "Tickets", href: "#tickets" }]}
      action={{ label: "Buy tickets", href: "#tickets" }}>

      <section className="border-b border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid items-center gap-12 lg:grid-cols-[1.15fr_1fr]">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">4–6 September 2026 · Loxley Valley · capacity 3,000</p>
              <h1 className="mt-3 text-5xl font-semibold tracking-tight text-balance">Loxley Weekender</h1>
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted-foreground">
                Three stages, one field, and a river you are allowed to swim in. Forty-one acts, most of
                them from within an hour of the gate.
              </p>
              <p className="mt-6 text-sm font-medium uppercase tracking-widest text-muted-foreground">Headlining</p>
              <p className="mt-2 text-2xl font-semibold tracking-tight">Elsie Marrow · Attercliffe Sound · The Wire</p>
              <div className="mt-7 flex flex-wrap items-center gap-4">
                <a className="rounded-md bg-primary px-6 py-3 text-base font-semibold text-primary-foreground" href="#tickets">Tickets from £68</a>
                <a className="rounded-md border border-border px-5 py-2.5 text-sm font-medium" href="/lineup">The full lineup</a>
              </div>
              <div className="mt-8">
                <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Gates open in</p>
                <div className="mt-2"><Countdown to="2026-09-04T12:00:00" /></div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <SafeImage src={null} alt="The main stage at dusk" ratio="3/4" />
              <div className="flex flex-col gap-4">
                <SafeImage src={null} alt="The river field" ratio="1/1" />
                <SafeImage src={null} alt="The barn stage, late" ratio="1/1" />
              </div>
            </div>
          </div>
          <div className="mt-14 border-t border-border pt-10">
            <StatsBand items={[
              { value: "41", label: "Acts across three stages" },
              { value: "3,000", label: "Capacity, and it sells out" },
              { value: "£68", label: "Weekend, camping included" },
              { value: "26", label: "Acts from within an hour" },
            ]} />
          </div>
        </div>
      </section>

      <section id="tickets" className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-12 lg:grid-cols-[1.3fr_1fr]">
          <div>
            <SectionHeader eyebrow="Tickets" title="Four ways in"
              description="Camping is included in every weekend ticket. Under-12s are free and always have been." />
            <PriceList className="mt-8" items={[
              { name: "Weekend + camping", description: "Friday noon to Sunday night, pitch included", price: 68, meta: "620 left" },
              { name: "Weekend, no camping", description: "For the ones walking home to Malin Bridge", price: 54, meta: "plenty" },
              { name: "Saturday only", description: "Gates 11am, off site by midnight", price: 32, meta: "180 left" },
              { name: "Under 12", description: "With an adult — no ticket needed, just turn up", price: 0, meta: "free" },
            ]} action={{ label: "Buy", onSelect: () => { navigate({ to: "/info" }); } }} />
            <p className="mt-4 text-sm text-muted-foreground">
              Tickets are non-refundable but fully transferable — name changes are free up to the Thursday.
            </p>
          </div>
          <div className="space-y-6">
            <SafeImage src={null} alt="The campsite on the Friday afternoon" ratio="4/3" />
            <div className="rounded-lg border border-border bg-muted/40 p-5 text-sm leading-relaxed text-muted-foreground">
              <p className="font-medium text-foreground">Payment plan</p>
              <p className="mt-2">
                £20 now and the rest in three goes, interest-free and run by us rather than a lender.
                Miss one and we email you, not a debt collector.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <SectionHeader eyebrow="Last year" title="What it actually looks like" />
            <a className="text-sm font-medium underline underline-offset-4" href="/info">Travel, camping and access →</a>
          </div>
          <Gallery className="mt-8" columns={4} items={[
            { alt: "Main stage, Saturday night", caption: "Saturday, about nine" },
            { alt: "The river field in the afternoon", caption: "The river is swimmable" },
            { alt: "Camping under the trees", caption: "Camping, in the trees" },
            { alt: "The barn stage at one in the morning", caption: "The barn, late" },
          ]} />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <SectionHeader eyebrow="Before you ask" title="The practical questions" />
        <Faq className="mt-8" items={[
          { question: "Can I bring my own drink?", answer: "To the campsite yes, in plastic. Not into the arena — there is a bar and it is what keeps the ticket at £68." },
          { question: "Is it accessible?", answer: "The main field is flat and firm with a viewing platform at the main stage. The barn is up a slope with a bound-gravel path. A PA comes free — email us." },
          { question: "What if it rains?", answer: "It goes ahead. Bring boots. The barn holds 400 and the beer tent another 300, so there is indoor space for a quarter of the site at once." },
          { question: "Dogs?", answer: "On the campsite, on a lead. Not in the arena — three thousand people and a PA system is not fair on a dog." },
        ]} />
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <CtaBand title="It has sold out three years running"
          description="Not a scarcity tactic — the field holds three thousand and the council will not let us have more."
          action={{ label: "Tickets from £68", href: "#tickets" }} />
      </section>
    </SiteChrome>
  );
}
