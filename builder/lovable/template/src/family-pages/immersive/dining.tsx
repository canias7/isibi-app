// immersive /dining — the table, with the same restraint as the rooms: one
// sitting, one menu, full-bleed imagery, words rationed. The menu is prose,
// not a price grid — this family whispers.
import { createFileRoute } from "@tanstack/react-router";
import { Parallax } from "@/components/ui/parallax";
import { Reveal } from "@/components/ui/reveal";
import { SafeImage } from "@/components/ui/safe-image";
export const Route = createFileRoute("/dining")({ component: P });
function P() {
  return (
    <div className="min-h-svh bg-background text-foreground">
      <header className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-6 py-4 text-sm">
        <a href="#/" className="font-semibold tracking-tight">Fell &amp; Water</a>
        <nav className="flex gap-4">
          <a href="#/rooms" className="underline-offset-4 hover:underline">Rooms</a>
          <a href="#/" className="underline underline-offset-4">Back</a>
        </nav>
      </header>
      <div className="relative">
        <SafeImage src={null} alt="The long table, laid for nine rooms" ratio="21/9" />
        <div className="absolute inset-0 grid place-items-end bg-gradient-to-t from-background/80 to-transparent p-8">
          <h1 className="text-4xl font-semibold tracking-tight">One table</h1>
        </div>
      </div>
      <Reveal>
        <section className="mx-auto max-w-xl px-6 py-16 text-center">
          <p className="text-lg leading-relaxed">Dinner is at eight, once, for everyone. Five courses decided that morning by what the valley had. There is no menu to choose from — tell us what you cannot eat and forget the rest.</p>
        </section>
      </Reveal>
      <Parallax speed={0.15}>
        <SafeImage src={null} alt="The kitchen at six, ghyll trout on slate" ratio="16/7" />
      </Parallax>
      <Reveal>
        <section className="mx-auto max-w-xl px-6 py-16 text-center">
          <p className="text-sm uppercase tracking-widest text-muted-foreground">A recent evening</p>
          <div className="mt-6 grid gap-4 text-lg">
            <p>Sourdough, cultured butter, smoked salt</p>
            <p>Ghyll trout, sorrel, brown butter</p>
            <p>Herdwick hogget, its own fat, June greens</p>
            <p>Damson leather, sheep's yogurt</p>
            <p>Coffee by the fire, or the terrace if it's kind</p>
          </div>
          <p className="mt-8 text-sm text-muted-foreground">Sixty-five pounds. Residents first; the four spare seats go by telephone.</p>
        </section>
      </Reveal>
      <Parallax speed={-0.15}>
        <SafeImage src={null} alt="Candlelight, the last course" ratio="16/7" />
      </Parallax>
      <footer className="border-t border-border py-16 text-center">
        <p className="text-lg">Stay the night; the walk upstairs is the digestif.</p>
        <a href="#/rooms" className="mt-4 inline-block border-b border-foreground pb-0.5 text-sm font-medium">The nine rooms</a>
      </footer>
    </div>
  );
}
