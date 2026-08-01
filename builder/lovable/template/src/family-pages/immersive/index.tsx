// immersive — "full-bleed media, minimal chrome". The landed video-hero leads.
import { createFileRoute } from "@tanstack/react-router";
import { VideoHero } from "@/components/ui/video-hero";
import { Gallery } from "@/components/ui/gallery";
import { Marquee } from "@/components/ui/marquee";
export const Route = createFileRoute("/")({ component: P });
function P() {
  return (
    <div className="min-h-svh bg-background text-foreground">
      <VideoHero
        title="Fell & Water"
        subtitle="Nine rooms above a Lakeland ghyll. Nothing else for six miles."
        src={null} poster={null} overlay={60}
        primary={{ label: "Explore the rooms", href: "#/rooms" }}
        secondary={{ label: "The table", href: "#rooms" }} />
      <Marquee className="border-y border-border py-3 text-sm text-muted-foreground"
        items={["Ghyll water in the taps", "Peat fires from October", "No televisions", "Dogs before people"]} />
      <section id="rooms" className="mx-auto max-w-6xl px-6 py-20">
        <Gallery columns={2} items={[
          { src: null, alt: "Room one — the gable window at dusk" },
          { src: null, alt: "The ghyll from the terrace" },
          { src: null, alt: "Breakfast, one long table" },
          { src: null, alt: "The tarn a mile up" }]} />
        <p className="mt-8 text-center"><a className="border-b border-foreground pb-0.5 text-sm font-medium" href="#/rooms">The nine rooms, one by one</a></p>
      </section>
    </div>
  );
}
