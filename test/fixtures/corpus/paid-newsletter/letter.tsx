// paid-newsletter /letter — one letter, read in full. This is the surface
// the £36 actually buys: no wall, no fade, no upsell mid-paragraph. The only
// membership furniture is the byline strip and the quiet nav back out.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { AuthorByline } from "@/components/ui/author-byline";
import { PostMeta } from "@/components/ui/post-meta";
import { PrevNext } from "@/components/ui/prev-next";
export const Route = createFileRoute("/letter")({ component: P });
const CHROME = {
  name: "The Crucible Letter", tagline: "Sheffield theatre, reviewed weekly.",
  links: [{ label: "This week", href: "/letters" }, { label: "Your membership", href: "/account" }],
};
function P() {
  return (
    <SiteChrome {...CHROME}>
      <article className="mx-auto max-w-2xl px-6 py-12">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Review · 1 August 2026 · Crucible</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance">A Streetcar with the brakes off</h1>
        <div className="mt-3"><AuthorByline name="R. Okafor" role="Editor — in the stalls, row F" /></div>
        <PostMeta className="mt-2" date="2026-08-01" readingTime="9 min" />
        <div className="prose prose-sm mt-8 max-w-none text-foreground">
          <p>The first thing you notice is the heat. Chen's production opens with every window of the Kowalski flat nailed shut, and for two hours nobody on stage pretends otherwise.</p>
          <p>Blanche arrives not as a moth but as a magistrate — Adeyemi plays the first act as if she owns the deed to the place, which makes the unravelling something closer to a foreclosure. It is a colder reading than the text usually gets, and the Crucible's thrust stage makes conspirators of us all: there is nowhere for her to perform TO, only people to be seen BY.</p>
          <p>Stanley is the production's one argument with itself. Kowalczyk has the menace but rations it so carefully that the poker night lands as comedy for a beat too long — the laugh dies in the room when the radio goes through the window, and the silence after is the best thing in the show.</p>
          <p>The design deserves its own paragraph: a flat that visibly shrinks. Flats slide in by centimetres between scenes — nobody in the audience catches it happening, everybody feels it. By the final scene the walls are close enough to touch and the heat has somewhere to live.</p>
          <p>Book the Tuesday. The house is thinner, the heat reads better, and you will want the quiet train home.</p>
        </div>
        <p className="mt-8 rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">★★★★ — until 11 October. Members' comments open below every letter; be the person you'd sit next to.</p>
        <PrevNext className="mt-10" prev={{ label: "Standing at the Lyceum", href: "/letters" }} next={{ label: "Back to this week", href: "/letters" }} />
      </article>
    </SiteChrome>
  );
}
