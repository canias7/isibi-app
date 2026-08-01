// membership-gated /letters — logged in. The taxonomy's line is "two
// different sites", and this is the second one: the product with no marketing
// left anywhere. No pitch, no plans, no paywall — the member already paid;
// showing them a subscribe button is the tell of a site that forgot who's in.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { ArticleCard } from "@/components/ui/article-card";
import { TagList } from "@/components/ui/tag-list";
import { UpgradeBadge } from "@/components/ui/upgrade-badge";
export const Route = createFileRoute("/letters")({ component: P });
const CHROME = {
  name: "The Crucible Letter", tagline: "Sheffield theatre, reviewed weekly.",
  links: [{ label: "This week", href: "#/letters" }, { label: "Your membership", href: "#/account" }],
};
function P() {
  return (
    <SiteChrome {...CHROME}>
      <div className="mx-auto max-w-2xl px-6 py-12">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">Good evening, Priya</h1>
          <UpgradeBadge tier="Annual" />
        </div>
        <p className="mt-2 text-muted-foreground">The Streetcar review you started is 4 minutes from the end.</p>
        <a href="#/letters" className="mt-4 block rounded-xl border bg-muted/40 p-5 hover:bg-muted/60">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Continue reading</p>
          <p className="mt-1 font-medium">A Streetcar with the brakes off</p>
          <p className="mt-1 text-sm text-muted-foreground">…Adeyemi plays the first act as if she owns the deed to the place, which makes the unravelling —</p>
        </a>
        <section className="mt-10">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">The archive</h2>
            <TagList items={["Crucible", "Lyceum", "Studio", "Fringe"]} active={null} onSelect={() => {}} />
          </div>
          <div className="mt-4 grid gap-4">
            <ArticleCard title="Standing at the Lyceum: the £12 seats that shouldn't work" excerpt="Row A of the gods, and why the sound is better than the stalls." meta="25 July · 7 min" href="#/letters" />
            <ArticleCard title="The Studio's new commissioning round, read closely" excerpt="Four writers, three of them local, one of them nineteen." meta="18 July · 11 min" href="#/letters" />
            <ArticleCard title="Interview: the fight director nobody credits" excerpt="Every fall you believed this year was hers." meta="11 July · 9 min" href="#/letters" />
          </div>
        </section>
        <p className="mt-10 border-t pt-6 text-sm text-muted-foreground">Comments open on every letter — your name appears as it does on <a className="font-medium underline underline-offset-4" href="#/account">your membership</a>.</p>
      </div>
    </SiteChrome>
  );
}
