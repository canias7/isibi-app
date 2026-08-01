// immersive — full-bleed media, minimal chrome, sparse type, scroll as
// choreography. A Lakeland hotel: the video takes the first screen, then
// long image passages with a sentence between each. Nothing here is dense —
// richness in this family is DEPTH of sequence, not weight of furniture.
import { createFileRoute } from "@tanstack/react-router";
import { Marquee } from "@/components/ui/marquee";
import { Parallax } from "@/components/ui/parallax";
import { Reveal } from "@/components/ui/reveal";
import { SafeImage } from "@/components/ui/safe-image";
import { VideoHero } from "@/components/ui/video-hero";
export const Route = createFileRoute("/")({ component: P });
function P() {
  return (
    <div className="min-h-svh bg-background text-foreground">
      <VideoHero
        title="Fell & Water"
        subtitle="Nine rooms above a Lakeland ghyll. Nothing else for six miles."
        src={null} poster={null} overlay={60}
        primary={{ label: "Explore the rooms", href: "#/rooms" }}
        secondary={{ label: "The table", href: "#/dining" }} />
      <Marquee className="border-y border-border py-3 text-sm text-muted-foreground"
        items={["Ghyll water in the taps", "Peat fires from October", "No televisions", "Dogs before people", "One sitting at eight"]} />

      <Reveal>
        <section className="mx-auto max-w-xl px-6 py-20 text-center">
          <p className="text-lg leading-relaxed">The house was built for a wool merchant who wanted to hear water from every room. A hundred and sixty years later, that is still the entire idea.</p>
        </section>
      </Reveal>

      <Parallax speed={0.15}>
        <SafeImage src={null} alt="Room one — the gable window at dusk" ratio="16/7" className="rounded-none" />
      </Parallax>
      <Reveal>
        <section className="mx-auto max-w-xl px-6 py-16 text-center">
          <p className="text-sm uppercase tracking-widest text-muted-foreground">The rooms</p>
          <p className="mt-4 text-lg leading-relaxed">Nine, no two alike, none with a number on the door. You'll know yours by the sound of its water.</p>
          <a href="#/rooms" className="mt-6 inline-block border-b border-foreground pb-0.5 text-sm font-medium">One by one</a>
        </section>
      </Reveal>

      <Parallax speed={-0.15}>
        <SafeImage src={null} alt="The long table, laid for nine rooms" ratio="16/7" className="rounded-none" />
      </Parallax>
      <Reveal>
        <section className="mx-auto max-w-xl px-6 py-16 text-center">
          <p className="text-sm uppercase tracking-widest text-muted-foreground">The table</p>
          <p className="mt-4 text-lg leading-relaxed">Dinner is at eight, once, for everyone — five courses decided that morning by what the valley had.</p>
          <a href="#/dining" className="mt-6 inline-block border-b border-foreground pb-0.5 text-sm font-medium">One sitting</a>
        </section>
      </Reveal>

      <Parallax speed={0.12}>
        <SafeImage src={null} alt="The tarn a mile up, first light" ratio="16/7" className="rounded-none" />
      </Parallax>
      <footer className="border-t border-border py-16 text-center">
        <p className="text-lg">Six miles from the nearest anything.</p>
        <p className="mt-1 text-sm text-muted-foreground">Deliberately.</p>
        <a href="#/rooms" className="mt-5 inline-block border-b border-foreground pb-0.5 text-sm font-medium">Begin with the rooms</a>
      </footer>
    </div>
  );
}
