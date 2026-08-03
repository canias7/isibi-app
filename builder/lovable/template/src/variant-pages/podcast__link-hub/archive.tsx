// podcast/link-hub /archive — the family's archive is "everything ever
// published, dense and filterable". For a creator whose front page is eight
// doors, this is the page behind five of them at once: where I will be, the
// class, the letter, the starter, and six years of posts.
//
// Still one narrow column. A creator's archive that becomes a three-column grid
// on the page after a link hub reads as a different website, and half the
// people who reach it came from a bio link ten seconds ago.
import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { EmailCapture } from "@/components/ui/email-capture";
import { GroupedList } from "@/components/ui/grouped-list";
import { SearchInput } from "@/components/ui/search-input";
import { SectionHeader } from "@/components/ui/section-header";
import { SlotCapacity } from "@/components/ui/slot-capacity";
import { SpecList, SpecRow } from "@/components/ui/spec-row";
import { TagList } from "@/components/ui/tag-list";
export const Route = createFileRoute("/archive")({ component: P });
type Post = { id: number; date: string; title: string; kind: string; note: string };
const POSTS: Post[] = [
  { id: 61, date: "2026-07-28", kind: "Failure", title: "Four flat loaves and I know exactly why", note: "New flour, same hydration. It needed 8% less water and I found that out sixty loaves late." },
  { id: 60, date: "2026-07-21", kind: "Recipe", title: "The focaccia, written down properly", note: "People asked for two years. It is four ingredients and eighteen hours and almost all of it is waiting." },
  { id: 59, date: "2026-07-14", kind: "The round", title: "Why I will not go past Penylan hill", note: "35kg of bread on a bike front. The hill is 9% and the answer is not a better cyclist, it is physics." },
  { id: 58, date: "2026-07-07", kind: "Class", title: "What happens in a Saturday class", note: "Four hours, six people, two loaves home and a starter. Nobody has ever failed to produce bread." },
  { id: 57, date: "2026-06-30", kind: "Recipe", title: "Feeding a starter when you are away", note: "Fridge, 1:5:5, and stop worrying. Mine has survived a fortnight in a cold flat more than once." },
  { id: 56, date: "2026-06-23", kind: "Failure", title: "The week I over-proved everything", note: "Warm kitchen, same timings, forty loaves like pancakes. Timings are a proxy for temperature and I forgot." },
  { id: 55, date: "2026-06-16", kind: "The round", title: "Six years of Thursday market", note: "What I earn on a good one, what I earn on a wet one, and why I still do it." },
  { id: 54, date: "2026-06-09", kind: "Recipe", title: "Rye, and why it is not the same job", note: "No gluten network to speak of. Everything you know about kneading is wrong here." },
  { id: 53, date: "2026-06-02", kind: "Class", title: "Two places left, always", note: "It is six people because the kitchen has six spaces. There is no bigger version of this." },
  { id: 52, date: "2026-05-26", kind: "The round", title: "The maths of sixty loaves", note: "What it costs to make, what I sell it for, and what is left. It is less than people assume." },
];
function P() {
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const kinds = [...new Set(POSTS.map((p) => p.kind))].sort();
  const shown = useMemo(() => {
    const n = q.trim().toLowerCase();
    return POSTS
      .filter((p) => !kind || p.kind === kind)
      .filter((p) => !n || (p.title + " " + p.note).toLowerCase().includes(n));
  }, [q, kind]);
  return (
    <SiteChrome name="Bread by Bike" tagline="Sourdough out of a back kitchen in Splott. Delivered on two wheels."
      links={[{ label: "All the links", href: "#/" }, { label: "Order", href: "#/episode" }, { label: "About", href: "#/about" }]}
      action={{ label: "Order", href: "#/episode" }}>

      <div className="mx-auto max-w-md px-6 py-12">
        <a className="text-sm text-muted-foreground underline underline-offset-4" href="#/">← Everything else</a>

        {/* THE THREE DOORS THAT ARE NOT POSTS, first — this page sits behind
            five of the front page's eight links and four of them are things to
            do rather than things to read. */}
        <section className="mt-6 space-y-4">
          <div className="rounded-lg border border-border p-5">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">This week</p>
            <p className="mt-2 text-base font-medium">Where I will be</p>
            <div className="mt-3">
              <SpecList>
                <SpecRow label="Thursday" value="Splott market" note="8am–1pm, Railway Street end. Cash and card" highlight />
                <SpecRow label="Friday" value="The bike round" note="Before nine, Splott, Adamsdown, Roath and flat Penylan" highlight />
                <SpecRow label="Saturday" value="The Clifton yard" note="10am–noon. Whatever is left goes cheap at 11:30" />
                <SpecRow label="Sunday" value="Nothing" note="The oven is off and so am I" />
              </SpecList>
            </div>
          </div>

          <div className="rounded-lg border border-border p-5">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Saturday class</p>
            <p className="mt-2 text-base font-medium">Four hours, six people, £68</p>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              You go home with two loaves and a piece of the starter. It is six people because the
              kitchen has six spaces, and there is not going to be a bigger version.
            </p>
            <div className="mt-3">
              <SlotCapacity left={2} total={6} unit="places" />
            </div>
            <a className="mt-4 block rounded-md border border-border px-4 py-2.5 text-center text-sm font-medium" href="#/about">
              How to book one
            </a>
          </div>

          <div className="rounded-lg border border-border p-5">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Free, any Thursday</p>
            <p className="mt-2 text-base font-medium">A piece of the starter</p>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              It is about forty years old and it came from a woman in Dinas Powys who gave me mine
              the same way. Bring a jam jar to the market and just ask — there is no catch and I am
              not going to put you on a list.
            </p>
          </div>
        </section>

        <section className="mt-10 border-t border-border pt-8">
          <SectionHeader eyebrow="Six years of it" title="Everything I have posted"
            description="Including the failures, which are about a fifth of it and are the ones people actually write back about." />

          <div className="mt-6 space-y-4">
            <SearchInput value={q} onChange={setQ} placeholder="rye, starter, the hill…" />
            <TagList items={kinds} active={kind} onSelect={setKind} />
          </div>

          <div className="mt-6">
            {shown.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm leading-relaxed text-muted-foreground">
                Nothing matches that. Try "starter" — about a third of everything here is somebody
                asking about a starter.
              </p>
            ) : (
              <GroupedList
                items={shown}
                groupBy={(p) => p.kind}
                sortGroups={(a, b) => a.localeCompare(b)}
                renderItem={(p) => (
                  <article key={p.id} className="py-3">
                    <p className="text-sm font-medium">{p.title}</p>
                    <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
                      {new Date(p.date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{p.note}</p>
                  </article>
                )} />
            )}
          </div>
        </section>

        <section className="mt-10 border-t border-border pt-8">
          <div className="rounded-lg border border-foreground p-5">
            <p className="text-base font-semibold">The Wednesday letter</p>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              One recipe, whatever went wrong that week, and the order form before it goes on here.
              About four hundred people get it and I have never sent two in a week.
            </p>
            <div className="mt-4">
              <EmailCapture id="bread-letter" cta="Send it to me" done={done}
                doneMessage="Check your inbox — one confirmation and then Wednesdays."
                onSubmit={() => setDone(true)}
                note="Wednesdays only. One click to leave and it works immediately." />
            </div>
          </div>
        </section>
      </div>
    </SiteChrome>
  );
}
