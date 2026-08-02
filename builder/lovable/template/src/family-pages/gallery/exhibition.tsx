// gallery /exhibition — one show in full: the work, the dates, the room. The
// work is set as large as the column allows and the wall text is set as prose,
// because a gallery page that lays an essay out in three columns of 14px is
// doing the opposite of what a gallery does.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { EventCard } from "@/components/ui/event-card";
import { ExhibitionCard } from "@/components/ui/exhibition-card";
import { Figure } from "@/components/ui/figure";
import { SafeImage } from "@/components/ui/safe-image";
import { SectionHeader } from "@/components/ui/section-header";
export const Route = createFileRoute("/exhibition")({ component: P });
const NOW = new Date(2026, 7, 2);
function P() {
  return (
    <SiteChrome name="The Grinding Shop" tagline="A contemporary art gallery in a former cutlery works, Kelham Island, Sheffield."
      links={[{ label: "Home", href: "#/" }, { label: "Visit", href: "#/visit" }]}
      action={{ label: "Plan your visit", href: "#/visit" }}>

      <section>
        <SafeImage src={null} alt="Installation view, Ways of Making Do, The Long Room" ratio="21/9" />
      </section>

      <div className="mx-auto max-w-6xl px-6 py-14">
        <header className="max-w-3xl">
          <p className="text-xs font-medium uppercase tracking-widest">On now · The Long Room · Free</p>
          <h1 className="mt-3 text-5xl font-semibold tracking-tight text-balance">Ways of Making Do</h1>
          <p className="mt-3 text-xl text-muted-foreground">Adaeze Mbanefo, Ruaridh Fenn and Tomoko Ise</p>
          <p className="mt-2 text-base text-muted-foreground">
            <time dateTime="2026-06-06">6 June</time> — <time dateTime="2026-08-30">30 August 2026</time>
          </p>
          <p className="mt-1 text-base font-medium">Four weeks left</p>
        </header>

        <div className="mt-12 grid gap-14 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          <div>
            {/* Wall text as prose, one column, at reading size. */}
            <div className="max-w-prose space-y-5 text-lg leading-relaxed">
              <p>
                Everything in this room was made from something that already existed. Not as a
                gesture towards sustainability — none of the three would put it that way — but
                because that is how the work started and it never stopped being the interesting part.
              </p>
              <p>
                Adaeze Mbanefo has spent two years collecting the offcuts from Stanley Works, the
                blade factory forty metres from this wall. What comes off a knife blank is a shape
                nobody designed, and she has assembled eleven thousand of them into a wall that
                reads from a distance as a single sheet of steel.
              </p>
              <p>
                Ruaridh Fenn works with boxwood pulled out of skips on Rockingham Street, mostly
                the handles of tools nobody could sell. Each of the eight pieces here is a handle
                for something that does not exist, finished to the standard the trade would have
                expected and then given nothing to hold on to.
              </p>
              <p>
                Tomoko Ise's nine drawings are made with silt taken from the Don at nine points
                between Oughtibridge and Attercliffe. The colour is the river's, not hers; the
                difference between the first drawing and the ninth is four hundred years of what
                the city put in the water.
              </p>
              <p className="text-base text-muted-foreground">
                Curated by Ellery Sandoe. Supported by Arts Council England and the Freshgate Trust.
              </p>
            </div>

            <section className="mt-12 border-t border-border pt-8">
              <h2 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">Works</h2>
              <div className="mt-6 grid gap-8 sm:grid-cols-2">
                <Figure src={null} ratio="3/4" alt="Offcut Wall" caption="Adaeze Mbanefo, Offcut Wall, 2026" credit="11,000 blade offcuts, steel armature" />
                <Figure src={null} ratio="3/4" alt="Handle (i)" caption="Ruaridh Fenn, Handle (i), 2025" credit="Reclaimed boxwood, brass" />
                <Figure src={null} ratio="1/1" alt="Silt Drawing III" caption="Tomoko Ise, Silt Drawing III, 2026" credit="River silt on Somerset paper" />
                <Figure src={null} ratio="1/1" alt="Silt Drawing IX" caption="Tomoko Ise, Silt Drawing IX, 2026" credit="River silt on Somerset paper" />
              </div>
            </section>
          </div>

          <aside className="space-y-10">
            <section>
              <h2 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">Practical</h2>
              <dl className="mt-3 divide-y divide-border border-y border-border text-sm">
                {[
                  ["Room", "The Long Room, ground floor"],
                  ["Admission", "Free, no ticket needed"],
                  ["Access", "Step-free. Seating in the room"],
                  ["Photography", "Yes, without flash"],
                  ["Time to allow", "About forty minutes"],
                  ["Suitable for", "All ages. Nothing distressing"],
                ].map(([k, v]) => (
                  <div key={k} className="grid grid-cols-[7.5rem_1fr] gap-4 py-3">
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <section>
              <h2 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">Alongside it</h2>
              <div className="mt-4 space-y-3">
                <EventCard title="Artists in conversation" start="2026-08-13T18:30:00" venue="The Long Room — free, book ahead" />
                <EventCard title="Silt drawing workshop" start="2026-08-16T11:00:00" venue="Studio 2 — £12, materials included" />
                <EventCard title="Relaxed opening" start="2026-08-02T11:00:00" venue="Whole gallery — lights up, sound off" />
                <EventCard title="Closing walkthrough with the curator" start="2026-08-29T14:00:00" venue="The Long Room — free" soldOut />
              </div>
            </section>
          </aside>
        </div>

        <section className="mt-16 border-t border-border pt-10">
          <SectionHeader eyebrow="Next" title="What follows it"
            description="Both in the same rooms, both free. The winter show is the one that is ticketed." />
          <div className="mt-8 grid gap-x-10 gap-y-14 md:grid-cols-2 lg:grid-cols-3">
            <ExhibitionCard now={NOW}
              title="Hand, Held" artist="Sheffield Hallam graduates"
              from="2026-09-12" to="2026-11-01" room="The Long Room" admission="Free"
              blurb="Fourteen makers from this year's cohort, selected by Adaeze Mbanefo." />
            <ExhibitionCard now={NOW}
              title="A Quiet Trade" artist="Norah Whitlock (1911–1998)"
              from="2026-11-14" to="2027-02-07" room="Gallery 2" admission="£6 / £4 concessions"
              blurb="The first retrospective of a buffer girl who drew every day for sixty years." />
            <ExhibitionCard now={NOW}
              title="Bessemer, After" artist="Kit Aspinall"
              from="2026-07-18" to="2026-08-09" room="Gallery 2" admission="Free"
              blurb="Large-format photographs of the last four working forges in the city." />
          </div>
        </section>
      </div>
    </SiteChrome>
  );
}
