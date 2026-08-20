// agency — EDITORIAL structure: magazine spreads, alternating
// offsets, generous whitespace, nothing centered by default. Each spread is
// one photograph given room, with its caption set beside it like a plate in
// a monograph. No bands, no eyebrow-title units — folios and rules.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { PressQuote } from "@/components/ui/press-quote";
import { SafeImage } from "@/components/ui/safe-image";
import { Testimonial } from "@/components/ui/testimonial";
export const Route = createFileRoute("/")({ component: P });
const SPREADS = [
  { no: "I", alt: "The dress, hung in the window light", note: "Eight in the morning, nobody posed. The day starts before anyone decides it has." },
  { no: "II", alt: "Confetti on Fargate", note: "We walk ahead of the couple, backwards, and trust the crowd." },
  { no: "III", alt: "Speeches — the groom's father", note: "The picture is never the speaker. It is the third row." },
  { no: "IV", alt: "Rain, umbrellas, laughing anyway", note: "This is Yorkshire. Some of our best work is umbrellas." },
];
function P() {
  return (
    <SiteChrome name="Hale & Frost" tagline="Weddings photographed like they felt."
      links={[{ label: "A recent day", href: "/project" }, { label: "Pricing", href: "/pricing" }]}
      action={{ label: "Start a project", href: "/contact" }}>

      {/* The opening spread. It used to be one 21/9 band above the thesis, and
          for a PHOTOGRAPHER that was the worst version of the empty-slot
          problem in the whole set: the first screen of the site was a single
          picture-shaped hole. Three plates instead — a portrait leading, two
          stacked beside it — so the opener says "these people take a lot of
          photographs" whether or not any have been uploaded yet. */}
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid items-end gap-8 py-16 md:grid-cols-12">
          <div className="md:col-span-6">
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Documentary wedding photography · est. 2015</p>
            <h1 className="mt-3 text-5xl font-semibold tracking-tight text-balance">Two photographers, one day, no shot list</h1>
            <p className="mt-6 max-w-md text-base leading-relaxed text-muted-foreground">
              214 weddings told. Twenty a year, never two in one weekend, first preview inside 48 hours.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground" href="/contact">Start a project</a>
              <a className="rounded-md border border-border px-5 py-2.5 text-sm font-medium" href="/project">A recent day</a>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 md:col-span-6">
            <SafeImage src={null} alt="Nadia and Tom, first dance, Cressbrook Mill" ratio="3/4" />
            <div className="flex flex-col gap-4">
              <SafeImage src={null} alt="Confetti on Fargate" ratio="1/1" />
              <SafeImage src={null} alt="The third row, mid-speech" ratio="1/1" />
            </div>
          </div>
        </div>

        {/* The contact sheet. A photographer is judged on VOLUME as much as on
            any one frame — twelve small ones says the thing four large ones
            cannot. */}
        <div className="border-t border-border py-14">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="text-2xl font-semibold tracking-tight">From the last eleven weddings</h2>
            <a className="text-sm font-medium underline underline-offset-4" href="/project">One whole day, start to finish →</a>
          </div>
          <div className="mt-8 grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {["Getting ready, Cressbrook", "The walk up", "Rings", "Her father, waiting", "The vows", "Confetti",
              "The long table", "Speeches", "Rain, umbrellas", "First dance", "Sparklers, eleven o'clock", "The last car"]
              .map((a) => <SafeImage key={a} src={null} alt={a} ratio="1/1" />)}
          </div>
        </div>

        {/* Plates: alternating offsets — wide left / narrow right, then flipped. */}
        {SPREADS.map((s, i) => (
          <figure key={s.no} className="grid items-end gap-6 border-t border-border py-14 md:grid-cols-12">
            <div className={i % 2 ? "md:order-2 md:col-span-7 md:col-start-6" : "md:col-span-7"}>
              <SafeImage src={null} alt={s.alt} ratio={i % 2 ? "4/3" : "3/2"} className="rounded-none" />
            </div>
            <figcaption className={i % 2 ? "md:order-1 md:col-span-4" : "md:col-span-4 md:col-start-9"}>
              <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Plate {s.no}</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.note}</p>
            </figcaption>
          </figure>
        ))}

        <div className="grid gap-10 border-t border-border py-16 md:grid-cols-12">
          <div className="md:col-span-5">
            <PressQuote quote="Documentary wedding photography at its most unsentimental and moving." source="Wed Magazine" />
          </div>
          <div className="md:col-span-5 md:col-start-8">
            <Testimonial item={{ quote: "We forgot they were there. Then the photos arrived and we cried.", name: "Nadia El-Amin", role: "Married, June" }} />
          </div>
        </div>

        <div className="grid gap-6 border-t border-border py-16 md:grid-cols-12">
          <div className="md:col-span-6">
            <h2 className="text-3xl font-semibold tracking-tight">2027 has nine weekends left</h2>
          </div>
          <div className="md:col-span-4 md:col-start-9">
            <p className="text-sm leading-relaxed text-muted-foreground">Tell us the date and the place. We answer within a day — a yes, or a name we trust.</p>
            <div className="mt-4 flex gap-4">
              <a className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground" href="/contact">Start a project</a>
              <a className="px-1 py-2.5 text-sm font-medium underline underline-offset-4" href="/pricing">Pricing</a>
            </div>
          </div>
        </div>
      </div>
    </SiteChrome>
  );
}
