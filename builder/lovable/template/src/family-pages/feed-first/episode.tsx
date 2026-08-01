// feed-first /episode — one entry in full: the player at the top (it is what
// the page is FOR), then the notes, then who was in it. Prev/next at the
// bottom because a listener who liked this one wants the adjacent ones.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { AudioPlayer } from "@/components/ui/audio-player";
import { AuthorByline } from "@/components/ui/author-byline";
import { PostMeta } from "@/components/ui/post-meta";
import { TagList } from "@/components/ui/tag-list";
export const Route = createFileRoute("/episode")({ component: P });
const CHROME = {
  name: "Made in Sheffield", tagline: "A podcast about this city, fortnightly.",
  links: [{ label: "Latest", href: "#/" }, { label: "All episodes", href: "#/archive" }],
};
function P() {
  return (
    <SiteChrome {...CHROME}>
      <div className="mx-auto max-w-2xl px-6 py-12">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Episode 41</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-balance">The last crucible steelworks</h1>
        <PostMeta className="mt-2" date="2026-07-28" category="Steel" readingTime="48 min" />
        <AudioPlayer className="mt-6" src="/audio/ep41.mp3" title="Play episode 41" />
        <div className="prose prose-sm mt-8 max-w-none text-foreground">
          <p>
            Forgemasters is the last place in Britain that can pour a 570-ton ingot, and
            almost nobody in the city has been inside. We spent a day on the melt floor
            with two men who have worked it for a combined seventy years.
          </p>
          <p>
            What a 10,000-ton press actually does, why the Navy owns the order book now,
            and the apprentice class that is suddenly forty strong.
          </p>
        </div>
        <section className="mt-8">
          <h2 className="text-sm font-medium text-muted-foreground">In this one</h2>
          <div className="mt-3 grid gap-3">
            <AuthorByline name="Ray Hollis" role="Melter, 39 years on the floor" />
            <AuthorByline name="Dawn Okafor" role="Head of the apprentice school" />
          </div>
        </section>
        <TagList className="mt-8" items={["Steel", "Work", "East End"]} active={null} onSelect={() => {}} />
        <nav className="mt-10 flex items-center justify-between border-t pt-6 text-sm">
          <a className="underline underline-offset-4" href="#/archive">← Ep 40: Park Hill, flat by flat</a>
          <span className="text-muted-foreground">Newest episode</span>
        </nav>
      </div>
    </SiteChrome>
  );
}
