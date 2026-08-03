// podcast/link-hub — A BAKER WHO SELLS THROUGH INSTAGRAM. The base family is a
// feed: a column of entries with bylines and reading times, newest on top.
//
// A link hub is the same single column and the opposite content. Every visitor
// arrived from one place — the link in a bio — and every one of them is going
// somewhere else. Nothing here is meant to be read; it is a set of doors, in the
// order the owner wants them tried, and the whole design question is which door
// is first this week. So: no feed, no excerpts, no dates, and a column narrow
// enough that the answer is always one tap away.
//
// The narrow column is not a mobile concession — it is the shape. A link hub
// rendered wide puts five doors side by side and makes the reader choose,
// which is the one thing the format exists to avoid.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { LinkCard } from "@/components/ui/link-card";
import { SafeImage } from "@/components/ui/safe-image";
import { SlotCapacity } from "@/components/ui/slot-capacity";
import { SocialLinks } from "@/components/ui/social-links";
export const Route = createFileRoute("/")({ component: P });
export const LINKS = [
  {
    title: "This week's order form — closes Wednesday 9pm",
    description: "Sourdough, focaccia and the Friday cinnamon buns. 41 of 60 loaves gone.",
    href: "#/episode", lead: true,
  },
  { title: "Where I will be this week", description: "Thursday market, Friday doorstep round, Saturday at the pub yard.", href: "#/archive" },
  { title: "Saturday bread class — two places left", description: "Four hours, six people, you go home with two loaves and a starter.", href: "#/archive" },
  { title: "The Wednesday letter", description: "One recipe, what went wrong that week, and the order form before anyone else.", href: "#/archive" },
  { title: "Starter, free, collect any Thursday", description: "It is forty years old and it came from a woman in Dinas Powys. Just ask.", href: "#/archive" },
  { title: "Wholesale — three cafés, room for one more", description: "Standing order, delivered by bike before seven.", href: "#/about" },
  { title: "Everything I have ever posted", description: "Six years of it, searchable, including the failures.", href: "#/archive" },
  { title: "Who I am and why the bike", description: "The short version: no van, no unit, and a very specific hill.", href: "#/about" },
];
function P() {
  return (
    <SiteChrome name="Bread by Bike" tagline="Sourdough out of a back kitchen in Splott. Delivered on two wheels."
      links={[{ label: "Order", href: "#/episode" }, { label: "Everything", href: "#/archive" }, { label: "About", href: "#/about" }]}
      action={{ label: "Order", href: "#/episode" }}>

      {/* ONE NARROW COLUMN. Wide, these eight become a grid and the reader has
          to choose between them — which is exactly what the format exists to
          prevent. The order is the whole design. */}
      <div className="mx-auto max-w-md px-6 py-12">
        <div className="text-center">
          <div className="mx-auto w-28">
            <SafeImage src={null} alt="Nerys, and the bike" ratio="1/1" className="rounded-full" />
          </div>
          <h1 className="mt-5 text-2xl font-semibold tracking-tight">Bread by Bike</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Nerys Vaughan · Splott, Cardiff · sixty loaves a week and not one more
          </p>
          <div className="mt-4 flex justify-center">
            <SocialLinks links={[
              { network: "Instagram", href: "#" },
              { network: "Email", href: "#" },
              { network: "Website", href: "#/about" },
            ]} />
          </div>
        </div>

        {/* THE FIRST DOOR IS THE WEEK'S DOOR, and it is visibly different from
            the seven below it. A link hub where every card looks the same is a
            menu; the owner's actual job is to say what matters this week. */}
        <div className="mt-9 rounded-lg border-2 border-foreground p-5">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Open now · closes Wednesday 9pm</p>
          <a href="#/episode" className="mt-2 block text-lg font-semibold leading-snug hover:underline">
            This week's order form
          </a>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            Sourdough, focaccia and the Friday cinnamon buns. Collection Thursday from the market
            or delivered by bike Friday morning if you are inside the hill.
          </p>
          <div className="mt-3">
            <SlotCapacity left={19} total={60} warnAt={20} unit="loaves" />
          </div>
          <a href="#/episode" className="mt-4 block rounded-md bg-primary px-4 py-3 text-center text-base font-medium text-primary-foreground">
            Order for this week
          </a>
        </div>

        <div className="mt-4 space-y-3">
          {LINKS.filter((l) => !l.lead).map((l) => (
            <LinkCard key={l.title} title={l.title} description={l.description} href={l.href} />
          ))}
        </div>

        <div className="mt-8 rounded-lg border border-border bg-muted/50 p-5 text-sm leading-relaxed text-muted-foreground">
          <p className="text-base font-medium text-foreground">Sixty loaves, and that is the whole business</p>
          <p className="mt-1.5">
            One oven, one person, and a bike with a box on the front. When it says nineteen left it
            means nineteen — I have never baked a sixty-first loaf and I am not going to start,
            because the reason this is any good is that it is small.
          </p>
        </div>

        <p className="mt-6 text-center text-xs leading-relaxed text-muted-foreground">
          Registered with Cardiff Council · food hygiene rating 5 · allergens on every order form
        </p>
      </div>
    </SiteChrome>
  );
}
