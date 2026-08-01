// evidence-first — "the work speaks". The strongest piece takes the first
// screen whole; everything after alternates in bands: the portfolio, the
// numbers that back it, who vouches, what it costs, then the enquiry. Copy
// stays short everywhere — the pictures carry the argument.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { CtaBand } from "@/components/ui/cta-band";
import { Gallery } from "@/components/ui/gallery";
import { PressQuote } from "@/components/ui/press-quote";
import { SafeImage } from "@/components/ui/safe-image";
import { SectionHeader } from "@/components/ui/section-header";
import { StatsBand } from "@/components/ui/stats-band";
import { Testimonial } from "@/components/ui/testimonial";
export const Route = createFileRoute("/")({ component: P });
function P() {
  return (
    <SiteChrome name="Hale & Frost" tagline="Weddings photographed like they felt."
      links={[{ label: "The work", href: "#work" }, { label: "A recent day", href: "#/project" }, { label: "Pricing", href: "#/pricing" }, { label: "Kind words", href: "#words" }]}
      action={{ label: "Start a project", href: "#/contact" }}>

      {/* The strongest single piece, uncrowded, with the name over it. */}
      <div className="relative">
        <SafeImage src={null} alt="Nadia and Tom, first dance, Cressbrook Mill" ratio="21/9" className="rounded-none" />
        <div className="absolute inset-0 flex items-end bg-gradient-to-t from-background/85 via-transparent to-transparent">
          <div className="mx-auto w-full max-w-5xl px-6 pb-10">
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Documentary wedding photography · Yorkshire and anywhere</p>
            <h1 className="mt-2 max-w-2xl text-4xl font-semibold tracking-tight text-balance">Two photographers, one day, no shot list</h1>
          </div>
        </div>
      </div>

      <section className="mx-auto max-w-5xl px-6 py-12">
        <StatsBand items={[
          { value: "214", label: "Weddings told" },
          { value: "11", label: "Years, two of us" },
          { value: "48 hrs", label: "To your first preview" },
          { value: "20", label: "A year — never two in one weekend" },
        ]} />
      </section>

      <section id="work" className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <SectionHeader eyebrow="The work" title="Pictures that were really happening" />
            <a className="text-sm font-medium underline underline-offset-4" href="#/project">One whole day, told properly →</a>
          </div>
          <Gallery className="mt-8" columns={3} items={[
            { src: null, alt: "The dress, hung in the window light" },
            { src: null, alt: "Confetti on Fargate" },
            { src: null, alt: "Speeches — the groom's father" },
            { src: null, alt: "First dance, lit by the band" },
            { src: null, alt: "The quiet five minutes after" },
            { src: null, alt: "Rain, umbrellas, laughing anyway" },
          ]} />
        </div>
      </section>

      <section id="words" className="mx-auto max-w-5xl px-6 py-16">
        <PressQuote quote="Documentary wedding photography at its most unsentimental and moving." source="Wed Magazine" />
        <div className="mt-10 grid items-start gap-5 sm:grid-cols-2">
          <Testimonial item={{ quote: "We forgot they were there. Then the photos arrived and we cried.", name: "Nadia El-Amin", role: "Married, June" }} />
          <Testimonial item={{ quote: "Dad framed the one of him and the mirror. He tells people a friend took it.", name: "Tom Hale-Whittle", role: "The same June" }} />
        </div>
      </section>

      <section className="border-y border-border bg-muted/40">
        <div className="mx-auto grid max-w-5xl items-center gap-8 px-6 py-14 sm:grid-cols-[1fr_auto]">
          <SectionHeader eyebrow="What it costs" title="Priced in the open" description="Three shapes, no hidden extras, travel inside Yorkshire included. Most people want the middle one." />
          <a className="rounded-md border px-5 py-2.5 text-sm font-medium" href="#/pricing">See the packages →</a>
        </div>
      </section>

      <section id="enquire" className="mx-auto max-w-5xl px-6 py-16">
        <CtaBand title="2027 has nine weekends left" description="Tell us the date and the place. We answer within a day, with a yes or a name we trust." action={{ label: "Start a project", href: "#/contact" }} />
      </section>
    </SiteChrome>
  );
}
