// gallery — EXHIBITION-FIRST: what is on right now, at the size the work
// deserves. The institution is a footnote to the work, so the current show gets
// the top of the page and the opening hours get the bottom of it.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { ExhibitionCard } from "@/components/ui/exhibition-card";
import { Figure } from "@/components/ui/figure";
import { Masonry } from "@/components/ui/masonry";
import { OpeningHours } from "@/components/ui/opening-hours";
import { SafeImage } from "@/components/ui/safe-image";
import { SectionHeader } from "@/components/ui/section-header";
export const Route = createFileRoute("/")({ component: P });
const NOW = new Date(2026, 7, 2);
function P() {
  return (
    <SiteChrome name="The Grinding Shop" tagline="A contemporary art gallery in a former cutlery works, Kelham Island, Sheffield."
      links={[{ label: "What's on", href: "#whats-on" }, { label: "Visit", href: "#/visit" }, { label: "This show", href: "#/exhibition" }]}
      action={{ label: "Plan your visit", href: "#/visit" }}>

      <section>
        <SafeImage src={null} alt="Installation view, Ways of Making Do" ratio="21/9" />
      </section>

      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="grid gap-12 lg:grid-cols-[1.2fr_1fr]">
            <div>
              <p className="text-xs font-medium uppercase tracking-widest">On now · The Long Room</p>
              <h1 className="mt-3 text-5xl font-semibold tracking-tight text-balance sm:text-6xl">Ways of Making Do</h1>
              <p className="mt-3 text-xl text-muted-foreground">Adaeze Mbanefo, Ruaridh Fenn and Tomoko Ise</p>
              <p className="mt-2 text-base text-muted-foreground">
                <time dateTime="2026-06-06">6 Jun</time> — <time dateTime="2026-08-30">30 Aug 2026</time> · Free
              </p>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
                Three artists working with what was already to hand — offcuts from the works next
                door, a decade of a grandmother's sewing box, the silt out of the Don. Nothing here
                was bought new, which turns out to be a position rather than a constraint.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <a className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground" href="#/exhibition">The show in full</a>
                <a className="rounded-md border border-border px-5 py-2.5 text-sm font-medium" href="#/visit">Plan a visit</a>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <SafeImage src={null} alt="Mbanefo, Offcut Wall (2026)" ratio="3/4" />
              <SafeImage src={null} alt="Ise, Silt Drawings I–IX" ratio="3/4" className="mt-10" />
            </div>
          </div>
        </div>
      </section>

      <section id="whats-on" className="mx-auto max-w-6xl px-6 py-14">
        <SectionHeader eyebrow="What's on" title="Now, next, and what has been"
          description="A show that has closed stays on the page. An empty gallery site between hangs tells you nothing about the gallery, and the archive is half of what anybody is here for." />
        <div className="mt-10 grid gap-x-10 gap-y-14 md:grid-cols-2 lg:grid-cols-3">
          <ExhibitionCard now={NOW} href="#/exhibition"
            title="Ways of Making Do" artist="Mbanefo, Fenn, Ise"
            from="2026-06-06" to="2026-08-30" room="The Long Room" admission="Free"
            blurb="Three artists working only with what was already to hand." />
          <ExhibitionCard now={NOW} href="#/exhibition"
            title="Bessemer, After" artist="Kit Aspinall"
            from="2026-07-18" to="2026-08-09" room="Gallery 2" admission="Free"
            blurb="Large-format photographs of the last four working forges in the city." />
          <ExhibitionCard now={NOW} href="#/exhibition"
            title="Hand, Held" artist="Sheffield Hallam graduates"
            from="2026-09-12" to="2026-11-01" room="The Long Room" admission="Free"
            blurb="Fourteen makers from this year's cohort, selected by Adaeze Mbanefo." />
          <ExhibitionCard now={NOW} href="#/exhibition"
            title="A Quiet Trade" artist="Norah Whitlock (1911–1998)"
            from="2026-11-14" to="2027-02-07" room="Gallery 2" admission="£6 / £4"
            blurb="The first retrospective of a buffer girl who drew every day for sixty years." />
          <ExhibitionCard now={NOW} href="#/exhibition"
            title="Groundwater" artist="Priya Sandhu"
            from="2026-03-07" to="2026-05-24" room="The Long Room" admission="Free"
            blurb="Cyanotypes made with water taken from every borehole in the Don catchment." />
          <ExhibitionCard now={NOW} href="#/exhibition"
            title="Cut, Fold, Rivet" artist="Group show"
            from="2025-11-08" to="2026-02-15" room="Gallery 2" admission="Free"
            blurb="Sixteen makers on what the city's steel trades left behind in the way people work." />
        </div>
      </section>

      <section className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <SectionHeader eyebrow="The collection" title="Four hundred works, mostly made within a mile"
            description="Acquired since 1974, almost entirely from artists living and working in the city. It is on show in rotation and the whole catalogue is online." />
          <Masonry className="mt-8" columns={3}>
            <Figure src={null} ratio="3/4" alt="Whitlock, Buffer Girl at Rest (1953)" caption="Norah Whitlock, Buffer Girl at Rest, 1953" credit="Pencil on envelope" />
            <Figure src={null} ratio="4/3" alt="Aspinall, Forge No. 4 (2024)" caption="Kit Aspinall, Forge No. 4, 2024" credit="Silver gelatin print" />
            <Figure src={null} ratio="1/1" alt="Ise, Silt Drawing III (2026)" caption="Tomoko Ise, Silt Drawing III, 2026" credit="River silt on paper" />
            <Figure src={null} ratio="4/5" alt="Fenn, Handle (2025)" caption="Ruaridh Fenn, Handle, 2025" credit="Reclaimed boxwood and steel" />
            <Figure src={null} ratio="16/9" alt="Sandhu, Groundwater XI (2026)" caption="Priya Sandhu, Groundwater XI, 2026" credit="Cyanotype" />
            <Figure src={null} ratio="3/4" alt="Unknown, Grinders' Hull (c.1890)" caption="Unknown, Grinders' Hull, c.1890" credit="Albumen print" />
          </Masonry>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid gap-12 lg:grid-cols-[1fr_1fr]">
          <div>
            <SectionHeader eyebrow="Visiting" title="Open five days, free four of them"
              description="Free except for the ticketed winter show. Nobody is asked for a donation at the door and there is no membership desk to walk past." />
            <div className="mt-6 space-y-3 text-base leading-relaxed text-muted-foreground">
              <p>
                Step-free throughout, including the mezzanine, which took eleven years and a lift
                shaft through a Grade II wall.
              </p>
              <p>
                Relaxed openings on the first Sunday of every month: lights up, sound off, and
                nobody minds noise.
              </p>
              <p>
                Large-print and braille guides for every show, at the desk, without asking.
              </p>
            </div>
            <a className="mt-6 inline-block text-sm font-medium underline underline-offset-4" href="#/visit">Everything about visiting →</a>
          </div>
          <OpeningHours days={[
            { day: 0, label: "Sunday", open: "11:00", close: "16:00" },
            { day: 1, label: "Monday" },
            { day: 2, label: "Tuesday" },
            { day: 3, label: "Wednesday", open: "10:00", close: "17:00" },
            { day: 4, label: "Thursday", open: "10:00", close: "20:00" },
            { day: 5, label: "Friday", open: "10:00", close: "17:00" },
            { day: 6, label: "Saturday", open: "10:00", close: "17:00" },
          ]} />
        </div>
      </section>
    </SiteChrome>
  );
}
