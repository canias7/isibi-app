// game-studio /about — what the game is, how long it takes, and WHAT IT IS NOT.
//
// The negative list is the useful half. A game with no combat, no map and no
// failure state disappoints exactly the people who assumed otherwise, and a
// page that only lists features guarantees that assumption. Naming the absences
// is how the right people find it.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { MediaObject } from "@/components/ui/media-object";
import { SafeImage } from "@/components/ui/safe-image";
import { PressQuote } from "@/components/ui/press-quote";
import { SectionHeader } from "@/components/ui/section-header";
import { Faq } from "@/components/ui/faq";

export const Route = createFileRoute("/about")({ component: P });

const IS = [
  "A walk upstream along six weirs on the Don and the Loxley, in order.",
  "About eight hours, in one direction, at whatever pace you like.",
  "Full of things to read — plaques, notes, an 1868 flood report — none of it required.",
  "Photographed on the real river. Every weir is a place you can go and stand.",
];

const IS_NOT = [
  { what: "There is no combat", why: "Nothing can hurt you and nothing can be killed. If a game without threat sounds empty, this will be." },
  { what: "There is no map and no objective marker", why: "You follow the river. It is not possible to get lost because there is one direction." },
  { what: "There is no inventory and no crafting", why: "You carry nothing and you build nothing. There is no resource in the game at all." },
  { what: "There is no failure state", why: "You cannot die, lose or get it wrong. Some people find that pointless and they are entitled to." },
  { what: "There is no multiplayer and there will not be", why: "Not a roadmap item, not a stretch goal. It is a game about being alone somewhere." },
  { what: "There are no choices that change the ending", why: "One river, one ending. The variation is what you notice, not what you decide." },
];

function P() {
  return (
    <SiteChrome
      name="Six Weirs"
      tagline="What the game is, and the six things it is not."
      links={[
        { label: "Home", href: "#/" },
        { label: "Press kit", href: "#/press" },
      ]}
      action={{ label: "Wishlist on Steam", href: "#/" }}
    >
      <div className="mx-auto max-w-5xl px-6 py-14">
        <h1 className="text-4xl font-semibold tracking-tight text-balance">About the game</h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          Two lists. The first is what it is and the second is what it is not, and the second is
          the more useful one — a page that only lists features guarantees somebody arrives
          expecting a thing that was never there.
        </p>

        <section className="mt-12">
          <div className="grid gap-12 lg:grid-cols-2">
            <div>
              <SectionHeader eyebrow="What it is" title="Four sentences" />
              <ul className="mt-6 space-y-3 text-sm leading-relaxed text-muted-foreground">
                {IS.map((i) => (
                  <li key={i} className="flex gap-2">
                    <span aria-hidden className="mt-2 size-1 shrink-0 rounded-full bg-foreground" />
                    <span>{i}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <SectionHeader eyebrow="What it is not" title="Six things, said plainly" />
              <ul className="mt-6 divide-y divide-border border-y border-border">
                {IS_NOT.map((n) => (
                  <li key={n.what} className="py-3.5">
                    <p className="text-sm font-medium">{n.what}</p>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{n.why}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="mt-14">
          <MediaObject
            reverse
            media={<SafeImage src={null} alt="The Loxley at Malin Bridge, water over a broken weir" ratio="4/3" fallbackSeed="loxley" />}
          >
            <SectionHeader
              eyebrow="The river"
              title="Ninety works, and now trees"
              description="The Don and the Loxley powered about ninety water-driven works — grinding hulls, forges, wire mills. Almost all of them are gone and the weirs that fed them are still there, holding back water for nothing."
            />
            <p className="mt-5 max-w-xl text-sm leading-relaxed text-muted-foreground">
              That gap is the whole game. Everything you can read in it is real: the flood report,
              the tenancy notices, the list of names from the 1864 dam burst. We changed none of it
              and invented none of it.
            </p>
          </MediaObject>
        </section>

        <section className="mt-14">
          <SectionHeader
            eyebrow="Accessibility"
            title="What is adjustable, and what cannot be"
            description="Stated before purchase rather than discovered in a settings menu after it."
          />
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            <div className="rounded-xl border border-border p-6">
              <p className="font-medium">Fully adjustable</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Text size to 200%, full subtitles with speaker names, walk speed, head-bob off,
                field of view, and every control remappable including one-handed layouts.
              </p>
            </div>
            <div className="rounded-xl border border-border p-6">
              <p className="font-medium">No timing, ever</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Nothing in the game requires a reaction, a button held, or a sequence performed.
                There is no quick-time event of any kind.
              </p>
            </div>
            <div className="rounded-xl border border-border p-6">
              <p className="font-medium">What we cannot fix</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                It is a first-person game with real water and some people will find that
                uncomfortable however low the motion settings go. Try the demo before buying.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-14">
          <div className="grid items-start gap-10 lg:grid-cols-[1.2fr_1fr]">
            <div>
              <SectionHeader title="Questions we get" />
              <div className="mt-6">
                <Faq
                  items={[
                    {
                      question: "Is it a horror game?",
                      answer: "No, and nothing in it is trying to frighten you. There is no jump scare, nothing follows you, and the river at night is simply dark rather than threatening.",
                    },
                    {
                      question: "Is it sad?",
                      answer:
                        "It is about a place that used to be busy and is not. Some people find that melancholy and some find it restful. It is not about a bereavement, which is the assumption people make.",
                    },
                    {
                      question: "Do I need to know Sheffield?",
                      answer: "Not at all. Knowing it adds a layer and it is not the game. Most of the people who played the demo had never been.",
                    },
                    {
                      question: "Will there be a sequel or DLC?",
                      answer: "No. It is eight hours and then it is finished, and we would rather make something else next.",
                    },
                  ]}
                />
              </div>
            </div>
            <div className="space-y-5">
              <PressQuote quote="A walking game with somewhere real to walk. The industrial archaeology is the story." source="Edge" />
              <PressQuote quote="Eight hours of almost nothing happening, and I will play it again." source="Eurogamer" />
            </div>
          </div>
          <p className="mt-8 text-sm text-muted-foreground">
            <a className="underline underline-offset-4" href="#/">The trailer and platforms</a>
            {" · "}
            <a className="underline underline-offset-4" href="#/press">Press kit</a>
          </p>
        </section>
      </div>
    </SiteChrome>
  );
}
