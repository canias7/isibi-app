// evidence-first — "the work speaks". Directive components only.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { SafeImage } from "@/components/ui/safe-image";
import { Gallery } from "@/components/ui/gallery";
import { SectionHeader } from "@/components/ui/section-header";
import { PressQuote } from "@/components/ui/press-quote";
import { Testimonial } from "@/components/ui/testimonial";
import { CtaBand } from "@/components/ui/cta-band";
export const Route = createFileRoute("/")({ component: P });
function P() {
  return (
    <SiteChrome name="Hale & Frost" tagline="Weddings photographed like they felt."
      links={[{ label: "The work", href: "#work" }, { label: "Kind words", href: "#words" }]}
      action={{ label: "Start a project", href: "#enquire" }}>
      <SafeImage src={null} alt="Nadia and Tom, first dance, Cressbrook Mill" ratio="21/9" />
      <div className="mx-auto max-w-5xl px-6 pb-16">
        <p className="mx-auto mt-10 max-w-xl text-center text-lg text-muted-foreground">
          Two photographers, one day, no shot list. The pictures above are the argument.
        </p>
        <div id="work" className="mt-12">
          <Gallery columns={3} items={[
            { src: null, alt: "The dress, hung in the window light" },
            { src: null, alt: "Confetti on Fargate" },
            { src: null, alt: "Speeches — the groom's father" },
            { src: null, alt: "First dance, lit by the band" },
            { src: null, alt: "The quiet five minutes after" },
            { src: null, alt: "Rain, umbrellas, laughing anyway" }]} />
        </div>
        <div id="words" className="mt-16 grid items-start gap-6 sm:grid-cols-2">
          <PressQuote quote="Documentary wedding photography at its most unsentimental and moving." source="Wed Magazine" />
          <Testimonial item={{ quote: "We forgot they were there. Then the photos arrived and we cried.", name: "Nadia El-Amin", role: "Married, June" }} />
        </div>
        <div id="enquire" className="mt-16">
          <CtaBand title="2027 has nine weekends left" description="Tell us the date and the place. We answer within a day." action={{ label: "Start a project", href: "#enquire" }} />
        </div>
      </div>
    </SiteChrome>
  );
}
