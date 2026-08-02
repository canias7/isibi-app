// podcast /archive — everything ever published, dense, filterable by tag.
// The feed shows three; this is where the other thirty-eight live. Rows over
// cards: forty entries as cards is a wall, as rows it is a list you can scan.
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { EpisodeRow } from "@/components/ui/episode-row";
import { ResultCount } from "@/components/ui/result-count";
import { TagList } from "@/components/ui/tag-list";
export const Route = createFileRoute("/archive")({ component: P });
const CHROME = {
  name: "Made in Sheffield", tagline: "A podcast about this city, fortnightly.",
  links: [{ label: "Latest", href: "#/" }, { label: "All episodes", href: "#/archive" }],
};
const EPS = [
  { number: 41, title: "The last crucible steelworks", seconds: 2860, publishedAt: "2026-07-28", tag: "Steel" },
  { number: 40, title: "Park Hill, flat by flat", seconds: 3140, publishedAt: "2026-07-14", tag: "Housing" },
  { number: 39, title: "The Full Monty at thirty", seconds: 2410, publishedAt: "2026-06-30", tag: "Film" },
  { number: 38, title: "Warp, and the bleep years", seconds: 3020, publishedAt: "2026-06-16", tag: "Music" },
  { number: 37, title: "Bramall Lane in ninety minutes", seconds: 2760, publishedAt: "2026-06-02", tag: "Football" },
  { number: 36, title: "The five weirs walk", seconds: 2180, publishedAt: "2026-05-19", tag: "Rivers" },
  { number: 35, title: "Henderson's, a relish dynasty", seconds: 2540, publishedAt: "2026-05-05", tag: "Food" },
  { number: 34, title: "The ski village that burned eight times", seconds: 2890, publishedAt: "2026-04-21", tag: "Housing" },
];
function P() {
  const [tag, setTag] = useState<string | null>(null);
  const shown = tag ? EPS.filter((e) => e.tag === tag) : EPS;
  return (
    <SiteChrome {...CHROME}>
      <div className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-tight">Every episode</h1>
        <p className="mt-2 text-muted-foreground">Forty-one so far, fortnightly since 2025. Filter by what the city makes.</p>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <TagList items={["Steel", "Housing", "Music", "Football", "Food"]} active={tag} onSelect={setTag} />
          <ResultCount total={shown.length} noun="episode" filtered={!!tag} />
        </div>
        <div className="mt-4 flex flex-col divide-y divide-border">
          {shown.map((e) => <EpisodeRow key={e.number} number={e.number} title={e.title} seconds={e.seconds} publishedAt={e.publishedAt} href="#/episode" />)}
        </div>
        {shown.length === 0 && <p className="mt-8 text-sm text-muted-foreground">Nothing under that tag yet — it's a young archive.</p>}
        <nav className="mt-8 flex justify-between border-t pt-5 text-sm text-muted-foreground">
          <span>Episodes 34–41</span>
          <a className="underline underline-offset-4" href="#/archive">Older →</a>
        </nav>
      </div>
    </SiteChrome>
  );
}
