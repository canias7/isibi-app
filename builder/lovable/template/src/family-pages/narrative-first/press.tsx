// narrative-first /press — the press kit: a bio at three lengths, photos
// cleared for print, quotes ready to lift. The page a venue's marketing
// person needs at 5pm on a deadline; everything is copyable, nothing needs
// an email to ask for.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { CopyButton } from "@/components/ui/copy-button";
import { DownloadCard } from "@/components/ui/download-card";
import { Gallery } from "@/components/ui/gallery";
import { PressQuote } from "@/components/ui/press-quote";
export const Route = createFileRoute("/press")({ component: P });
const CHROME = {
  name: "Elsie Marrow", tagline: "Songs about rivers and shift work.",
  links: [{ label: "Home", href: "#/" }, { label: "Press kit", href: "#/press" }],
  action: { label: "Book me", href: "#/" },
};
const SHORT = "Elsie Marrow writes folk songs about the Don valley — five strings, one loop pedal, true stories only. Debut album \"Marrow\" is out in October.";
const MEDIUM = SHORT + " First played on Radio 6 in 2024, she has sold out the Greystones four times and tours the north this autumn.";
function P() {
  return (
    <SiteChrome {...CHROME}>
      <div className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-tight">Press kit</h1>
        <p className="mt-2 text-muted-foreground">Everything here is cleared for use — copy it, print it, no need to ask.</p>
        <section className="mt-8">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">One-liner</h2>
            <CopyButton value="Folk from the Don valley — five strings, one loop pedal, true stories only." />
          </div>
          <p className="mt-2 rounded-lg border bg-muted/40 p-4 text-sm">Folk from the Don valley — five strings, one loop pedal, true stories only.</p>
        </section>
        <section className="mt-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">Short bio · 40 words</h2>
            <CopyButton value={SHORT} />
          </div>
          <p className="mt-2 rounded-lg border bg-muted/40 p-4 text-sm">{SHORT}</p>
        </section>
        <section className="mt-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">Longer bio · 70 words</h2>
            <CopyButton value={MEDIUM} />
          </div>
          <p className="mt-2 rounded-lg border bg-muted/40 p-4 text-sm">{MEDIUM}</p>
        </section>
        <section className="mt-10">
          <h2 className="text-lg font-medium">Photos — credit Marta Ilic</h2>
          <Gallery className="mt-3" columns={3} items={[
            { src: null, alt: "Portrait, colour, 300dpi" },
            { src: null, alt: "Live at the Greystones, landscape" },
            { src: null, alt: "Portrait, black and white" },
          ]} />
          <div className="mt-4 grid gap-2">
            <DownloadCard name="elsie-marrow-photos.zip" description="All three, print resolution" size={48234496} href="#/press" />
            <DownloadCard name="marrow-album-art.png" description="3000×3000, for listings" size={8912896} href="#/press" />
          </div>
        </section>
        <section className="mt-10 grid gap-6">
          <PressQuote quote="The best songwriter this city has produced since the arena was a car park." source="Now Then Magazine" />
          <PressQuote quote="Shift-work ballads that land like standards." source="The Guardian, ones to watch" />
        </section>
        <p className="mt-10 border-t pt-6 text-sm text-muted-foreground">Bookings and anything not covered here: <a className="font-medium underline underline-offset-4" href="#/">management, via the home page</a>.</p>
      </div>
    </SiteChrome>
  );
}
