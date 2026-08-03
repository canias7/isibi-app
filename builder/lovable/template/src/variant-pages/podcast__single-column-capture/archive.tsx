// podcast/single-column-capture /archive — everything ever published, dense and
// filterable, exactly as the family says. The one divergence: it is grouped by
// TOPIC rather than by date.
//
// A blog archive is chronological because a reader wants the newest. Nobody
// comes to a newsletter archive for the newest — that arrived on Thursday. They
// come because somebody said "there was a Kerbside about section 106" and they
// are looking for a subject, six months back, whose date they do not know.
import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { EmailCapture } from "@/components/ui/email-capture";
import { GroupedList } from "@/components/ui/grouped-list";
import { ReadingTime } from "@/components/ui/reading-time";
import { ResultCount } from "@/components/ui/result-count";
import { SearchInput } from "@/components/ui/search-input";
import { SectionHeader } from "@/components/ui/section-header";
import { SortSelect } from "@/components/ui/sort-select";
import { TagList } from "@/components/ui/tag-list";
import { ISSUES, type Issue } from "./index";
export const Route = createFileRoute("/archive")({ component: P });
const MORE: Issue[] = [
  { no: 142, date: "2026-06-18", title: "Councils that own shopping centres", topic: "Property", words: 1610, excerpt: "Twenty-two English authorities bought retail property with PWLB money before 2020. Here is what those assets are worth now, and what the debt costs." },
  { no: 141, date: "2026-06-11", title: "The bin round that goes past your house twice", topic: "Waste", words: 890, excerpt: "Route optimisation is a solved problem and about a third of collection rounds do not use it, for a reason that turns out to be industrial relations rather than software." },
  { no: 140, date: "2026-06-04", title: "How a licensing objection actually works", topic: "Licensing", words: 1470, excerpt: "Four licensing objectives, and only representations that engage one of them count. Almost every objection letter engages none, which is why almost every one fails." },
  { no: 139, date: "2026-05-28", title: "Twenty-two years of a level crossing", topic: "Transport", words: 1320, excerpt: "One crossing in Cambridgeshire, four consultations, three funding bids and no bridge. The paper trail is complete and it is a very ordinary story." },
  { no: 138, date: "2026-05-21", title: "What your council actually spends on planning", topic: "Planning", words: 1180, excerpt: "Planning fees are set nationally and cover about 60% of the cost of determining an application. The rest is council tax, which nobody has ever been told." },
  { no: 137, date: "2026-05-14", title: "Empty homes, and the premium that does not work", topic: "Property", words: 1390, excerpt: "The council tax premium on long-term empties doubled and the number of empties barely moved. Four councils explain why, and one of them is convincing." },
  { no: 136, date: "2026-05-07", title: "The consultation nobody answered", topic: "Planning", words: 1050, excerpt: "A local plan consultation with 11 responses in an authority of 140,000 people. I asked what was done to publicise it and the answer took three requests." },
  { no: 135, date: "2026-04-30", title: "Who decides where a bus stop goes", topic: "Transport", words: 1240, excerpt: "Not the bus company, and usually not the council either. The answer involves a 1984 Act and a committee that meets four times a year." },
];
const ALL = [...ISSUES, ...MORE];
function P() {
  const [q, setQ] = useState("");
  const [topic, setTopic] = useState<string | null>(null);
  const [sort, setSort] = useState("topic");
  const [done, setDone] = useState(false);
  const topics = [...new Set(ALL.map((i) => i.topic))].sort();
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return ALL
      .filter((i) => !topic || i.topic === topic)
      .filter((i) => !needle || (i.title + " " + i.excerpt + " " + i.topic).toLowerCase().includes(needle))
      .sort((a, b) => (sort === "old" ? a.no - b.no : b.no - a.no));
  }, [q, topic, sort]);
  const byTopic = sort === "topic";
  return (
    <SiteChrome name="Kerbside" tagline="A weekly letter about how British towns actually work."
      links={[{ label: "Subscribe", href: "#/" }, { label: "One issue", href: "#/episode" }, { label: "Who writes it", href: "#/about" }]}
      action={{ label: "Subscribe", href: "#subscribe" }}>

      <div className="mx-auto max-w-3xl px-6 py-12">
        <SectionHeader eyebrow="Archive" title="All 148, and none of them behind anything"
          description="Grouped by subject rather than by date, because nobody arrives here looking for the newest one — that came on Thursday. They arrive because somebody said there was a Kerbside about section 106." />

        <div className="mt-8 space-y-4">
          <SearchInput value={q} onChange={setQ} placeholder="section 106, bus lane, bins, Leicester…" />
          <TagList items={topics} active={topic} onSelect={setTopic} />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <ResultCount total={shown.length} noun="issue" filtered={shown.length !== ALL.length} />
            <SortSelect value={sort} onChange={setSort} options={[
              { value: "topic", label: "By subject" },
              { value: "new", label: "Newest first" },
              { value: "old", label: "Oldest first" },
            ]} />
          </div>
        </div>

        <div className="mt-8">
          {shown.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-10 text-center text-sm leading-relaxed text-muted-foreground">
              Nothing matches that. The search covers titles and summaries rather than the full
              text — if you remember a sentence rather than a subject, reply to any issue and I
              will find it, which happens about twice a month.
            </p>
          ) : byTopic ? (
            <GroupedList
              items={shown}
              groupBy={(i) => i.topic}
              renderItem={(i) => <Row key={i.no} issue={i} />}
              sortGroups={(a, b) => a.localeCompare(b)}
            />
          ) : (
            <div className="divide-y divide-border">
              {shown.map((i) => <Row key={i.no} issue={i} />)}
            </div>
          )}
        </div>

        <section id="subscribe" className="mt-14 rounded-lg border border-foreground p-6">
          <p className="text-lg font-semibold">148 of these, and the next one is Thursday</p>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            Free, weekly, no paid tier and no sponsor. If you have been reading the archive, that
            is the whole of what subscribing gets you — the same thing, before everyone else.
          </p>
          <div className="mt-5">
            <EmailCapture id="subscribe-archive" cta="Subscribe" done={done}
              doneMessage="Check your inbox for the confirmation link."
              onSubmit={() => setDone(true)}
              note="One click to leave, in every email, and it works immediately." />
          </div>
        </section>
      </div>
    </SiteChrome>
  );
}
function Row({ issue }: { issue: Issue }) {
  return (
    <article className="py-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <a className="text-base font-medium hover:underline" href="#/episode">
          <span className="tabular-nums text-muted-foreground">№{issue.no}</span> {issue.title}
        </a>
        <span className="text-xs tabular-nums text-muted-foreground">
          {new Date(issue.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
        </span>
        <ReadingTime words={issue.words} showIcon={false} />
      </div>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{issue.excerpt}</p>
    </article>
  );
}
