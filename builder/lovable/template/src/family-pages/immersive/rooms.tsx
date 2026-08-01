// immersive /rooms — the rooms as full-bleed passages, one each, sparse type
// between. The chrome stays nearly gone; the pictures do the selling and the
// words stay under twenty a room.
import { createFileRoute } from "@tanstack/react-router";
import { Parallax } from "@/components/ui/parallax";
import { Reveal } from "@/components/ui/reveal";
import { SafeImage } from "@/components/ui/safe-image";
export const Route = createFileRoute("/rooms")({ component: P });
const ROOMS = [
  { name: "One — the gable", line: "The window seat outlasts every plan made for the afternoon.", price: "£240" },
  { name: "Four — over the water", line: "You hear the ghyll all night. Guests ask for it by sound.", price: "£265" },
  { name: "Seven — the long room", line: "Two chairs, one fire, forty feet of fell out the glass.", price: "£290" },
];
function P() {
  return (
    <div className="min-h-svh bg-background text-foreground">
      <header className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-6 py-4 text-sm">
        <a href="#/" className="font-semibold tracking-tight">Fell &amp; Water</a>
        <a href="#/dining" className="underline-offset-4 hover:underline">Dining</a> <a href="#/" className="underline underline-offset-4">Back</a>
      </header>
      <div className="relative">
        <SafeImage src={null} alt="The nine windows at night, lit from inside" ratio="21/9" />
        <div className="absolute inset-0 grid place-items-end bg-gradient-to-t from-background/80 to-transparent p-8">
          <h1 className="text-4xl font-semibold tracking-tight">The nine rooms</h1>
        </div>
      </div>
      {ROOMS.map((r, i) => (
        <section key={r.name} className="py-10">
          <Parallax speed={i % 2 ? -0.15 : 0.15}>
            <SafeImage src={null} alt={r.name} ratio="16/7" />
          </Parallax>
          <Reveal>
            <div className="mx-auto flex max-w-3xl flex-wrap items-baseline justify-between gap-3 px-6 pt-6">
              <div>
                <h2 className="text-2xl font-medium tracking-tight">{r.name}</h2>
                <p className="mt-1 text-muted-foreground">{r.line}</p>
              </div>
              <p className="text-sm tabular-nums text-muted-foreground">from {r.price} a night</p>
            </div>
          </Reveal>
        </section>
      ))}
      <footer className="border-t border-border py-16 text-center">
        <p className="text-lg">Six other rooms prefer to be met in person.</p>
        <a href="#/" className="mt-4 inline-block border-b border-foreground pb-0.5 text-sm font-medium">Enquire from the front page</a>
      </footer>
    </div>
  );
}
