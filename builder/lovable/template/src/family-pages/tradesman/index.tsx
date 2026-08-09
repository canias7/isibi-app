// tradesman — CALL-FIRST: the number is the hero and the proof is photographs
// of finished work. A plumber is not chosen on copy; they are chosen because
// somebody can see the last bathroom and the phone gets answered.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { BeforeAfter } from "@/components/ui/before-after";
import { CtaBand } from "@/components/ui/cta-band";
import { Gallery } from "@/components/ui/gallery";
import { SafeImage } from "@/components/ui/safe-image";
import { SectionHeader } from "@/components/ui/section-header";
import { ServiceArea } from "@/components/ui/service-area";
import { StatsBand } from "@/components/ui/stats-band";
import { Testimonial } from "@/components/ui/testimonial";
import { TrustStrip } from "@/components/ui/trust-strip";
export const Route = createFileRoute("/")({ component: P });
function P() {
  return (
    <SiteChrome name="Barlow & Son" tagline="Plumbing and heating, Sheffield S6 and S10."
      links={[{ label: "The work", href: "/work" }, { label: "Areas", href: "#areas" }, { label: "Quote", href: "/quote" }]}
      action={{ label: "0114 266 1180", href: "tel:+441142661180" }}>

      {/* The number, before anything. A form is the fallback for people who
          cannot ring — never the other way round in this trade. */}
      <section className="border-b border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_1fr]">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Gas Safe 512204 · father and son · since 1998</p>
              <h1 className="mt-3 text-5xl font-semibold tracking-tight text-balance">Plumbing and heating, answered by the man who does it</h1>
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted-foreground">
                Two of us, one van each, no call centre. If it is water coming through a ceiling, ring —
                we will tell you how to stop it before we set off.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <a className="rounded-md bg-primary px-6 py-3 text-base font-semibold text-primary-foreground" href="tel:+441142661180">Ring 0114 266 1180</a>
                <a className="rounded-md border border-border px-5 py-2.5 text-sm font-medium" href="/quote">Send photos instead</a>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">Answered 7am–8pm. Out of hours goes to Dave's mobile.</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <SafeImage src={null} alt="Bathroom, Crookes — finished" ratio="1/1" />
              <SafeImage src={null} alt="Boiler swap, Walkley" ratio="1/1" />
              <SafeImage src={null} alt="Under a floor at Hillsborough" ratio="1/1" />
              <SafeImage src={null} alt="The van, which is the office" ratio="1/1" />
            </div>
          </div>
          <div className="mt-14 border-t border-border pt-10">
            <StatsBand items={[
              { value: "27 yrs", label: "Same two postcodes" },
              { value: "2 hrs", label: "Median callout, emergencies" },
              { value: "£0", label: "To come and look" },
              { value: "4.9", label: "Checkatrade, 480 reviews" },
            ]} />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-10">
        <TrustStrip items={[
          { title: "Gas Safe registered", description: "512204 — check us on the register before we come" },
          { title: "Fixed price before we start", description: "Written on the day, not after the work" },
          { title: "We clear up", description: "Dust sheets, and the old parts leave with us" },
        ]} />
      </section>

      {/* Evidence, at the size evidence needs. */}
      <section className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <SectionHeader eyebrow="The work" title="Before, and after"
              description="Every one of these is ours, in a house within four miles of here." />
            <a className="text-sm font-medium underline underline-offset-4" href="/work">Every job →</a>
          </div>
          <div className="mt-8 grid gap-8 lg:grid-cols-2">
            <BeforeAfter beforeLabel="The old bathroom at Crookes" afterLabel="The same bathroom, finished" />
            <BeforeAfter beforeLabel="A thirty-year-old back boiler" afterLabel="The combi that replaced it" />
          </div>
          <Gallery className="mt-8" columns={4} items={[
            { alt: "Tiling at Nether Edge", caption: "Nether Edge" },
            { alt: "A rad swap on a cold morning", caption: "Radiator swap" },
            { alt: "Copper, soldered properly", caption: "Soldered, not pushed" },
            { alt: "Wet room at Fulwood", caption: "Wet room, Fulwood" },
          ]} />
        </div>
      </section>

      <section id="areas" className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.1fr]">
          <div>
            <SectionHeader eyebrow="Where we go" title="Four miles, and that is deliberate" />
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              Staying local is why we can be there in two hours. If you are outside it we will say so on the
              phone and give you a name we trust rather than string you along.
            </p>
          </div>
          <ServiceArea className="self-start"
            areas={["Walkley", "Crookes", "Hillsborough", "Nether Edge", "Fulwood", "Broomhill", "Stannington", "S6", "S10", "S11"]}
            note="Just outside? Ring anyway — we will tell you straight." />
        </div>
      </section>

      <section className="border-t border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <SectionHeader eyebrow="What people say" title="With the street on it" />
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            <Testimonial item={{ quote: "Rang at half seven with water coming through the kitchen light. Dave talked me through the stopcock on the phone and was here by nine.", name: "Priya N", role: "Crookes" }} />
            <Testimonial item={{ quote: "Quoted £2,400, charged £2,400. I have had three quotes in my life that did that and two were his.", name: "Malc T", role: "Walkley" }} />
            <Testimonial item={{ quote: "Took the old boiler away, hoovered up, and would not take a tea until he had washed his hands.", name: "Eileen B", role: "Hillsborough" }} />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <CtaBand title="Ring, or send us a photograph"
          description="A picture of the problem gets you a real number instead of a range. Either way you speak to one of us."
          action={{ label: "Send the job", href: "/quote" }} />
      </section>
    </SiteChrome>
  );
}
