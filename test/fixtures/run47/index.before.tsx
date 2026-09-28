import { createFileRoute } from "@tanstack/react-router";

import { CtaBand } from "@/components/ui/cta-band";
import { Hero } from "@/components/ui/hero";
import { SafeImage } from "@/components/ui/safe-image";
import { SiteChrome } from "@/components/ui/site-chrome";
import { StoryLead } from "@/components/ui/story-lead";

export const Route = createFileRoute("/")({ component: Home });

const CHROME = {
  name: "Harbour Loaf",
  tagline: "A neighbourhood sourdough bakery in Bristol.",
  links: [
    { label: "Today's bake", href: "/" },
    { label: "The starter", href: "/starter" },
    { label: "Visit", href: "/visit" },
    { label: "Gallery", href: "/gallery" },
  ],
  action: { label: "Order a loaf", href: "/order" },
  contact: {
    address: "Bristol",
    hours: "Wed–Sat 8–2, Sun 9–1",
  },
};

function Home() {
  return (
    <SiteChrome {...CHROME}>
      <Hero
        title="Harbour Loaf"
        subtitle="Overnight sourdough on a Bristol side street. See today's bake, then order a loaf and collect it from the counter."
        primary={{ label: "Order a loaf", href: "/order" }}
        secondary={{ label: "How to find us", href: "/visit" }}
      />

      <section className="mx-auto max-w-5xl px-6">
        <SafeImage
          src="/u/fold-lane-bakery/64eee06cebae214308ea0142e5163286.jpg"
          alt="Harbour Loaf on a Bristol side street in the early morning"
          ratio="16/9"
          fallbackSeed="harbour-front"
        />
      </section>

      <section className="mx-auto max-w-3xl px-6 py-20 motion-reveal">
        <StoryLead
          kicker="The starter"
          headline="Fed every morning since we opened"
          standfirst="A Bristol crock, stoneground flour, and a long cool prove. That is why a loaf here takes the time it takes."
          href="/starter"
        />
        <SafeImage focus="top"
          className="mt-8"
          src="/u/fold-lane-bakery/8e6bd4818b036cfcd639d1bb5ec6156c.jpg"
          alt="A sourdough boule cooling after the morning bake"
          ratio="4/3"
          fallbackSeed="cooling-boule"
        />
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-20 motion-reveal">
        <CtaBand
          title="Order a loaf for collection"
          description="Pick a time. We will hold it at the counter."
          action={{ label: "Order a loaf", href: "/order" }}
        />
      </section>
    </SiteChrome>
  );
}
