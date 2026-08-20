// game-studio — TRAILER-FIRST, and the platform list distinguishing CONFIRMED
// from hoped-for.
//
// "COMING TO PC AND CONSOLES" IS HOW REFUNDS HAPPEN. Somebody reads it, assumes
// their machine is on the list, and finds out at launch that it is not. A studio
// always knows which platforms are signed and which are aspirations; saying so
// costs a few wishlists and prevents the review that says "false advertising".
//
// AND WHAT THE GAME IS NOT. Three sentences of honest scoping — no multiplayer,
// eight hours, no combat — filters out exactly the people who would have refunded
// it, and reassures the ones who wanted precisely that.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { VideoEmbed } from "@/components/ui/video-embed";
import { WishlistButton } from "@/components/ui/wishlist-button";
import { PressQuote } from "@/components/ui/press-quote";
import { MediaObject } from "@/components/ui/media-object";
import { SafeImage } from "@/components/ui/safe-image";
import { SectionHeader } from "@/components/ui/section-header";
import { Faq } from "@/components/ui/faq";

export const Route = createFileRoute("/")({ component: P });

const PLATFORMS = [
  { what: "PC — Steam and GOG", when: "12 March 2027", state: "Confirmed and dated" },
  { what: "Mac — Apple silicon", when: "12 March 2027", state: "Confirmed and dated" },
  { what: "Steam Deck", when: "12 March 2027", state: "Confirmed — verified, and we have tested it for months" },
  { what: "Nintendo Switch 2", when: "Later in 2027", state: "Signed, no date. It will not be launch day." },
  { what: "PlayStation 5", when: "Unknown", state: "We want to and there is no agreement. Do not buy a machine for this." },
  { what: "Xbox", when: "Unknown", state: "Same. Genuinely undecided rather than secretly imminent." },
  { what: "Linux", when: "12 March 2027", state: "Native build, because the Deck one exists anyway" },
  { what: "Mobile", when: "Never", state: "It does not work with a touchscreen and we are not going to pretend otherwise." },
];

function P() {
  return (
    <SiteChrome
      name="Six Weirs"
      tagline="A game about walking a river valley. From a two-person studio in Sheffield."
      links={[
        { label: "About the game", href: "/about" },
        { label: "Press kit", href: "/press" },
        { label: "Questions", href: "#questions" },
      ]}
      action={{ label: "Wishlist on Steam", href: "#platforms" }}
    >
      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            12 March 2027 · PC, Mac, Steam Deck
          </p>
          <h1 className="mt-4 max-w-3xl text-6xl font-semibold leading-[1.02] tracking-tight text-balance">
            Six Weirs
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            You walk upstream. There is no combat, no inventory and no map, and it takes about eight
            hours. If that sounds like nothing at all it is probably not for you, and we would
            rather say so here than in a refund window.
          </p>

          <div className="mt-10">
            <VideoEmbed
              url="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"
              title="Six Weirs — announcement trailer"
              ratio="16/9"
            />
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <WishlistButton saved={false} onToggle={() => {}} label="Wishlist on Steam" />
            <a className="rounded-md border border-border px-5 py-2.5 text-sm font-medium" href="/about">
              What it actually is
            </a>
          </div>
        </div>
      </section>

      {/* THE PLATFORM LIST, with confirmed and hoped-for distinguished. */}
      <section className="border-b border-border" id="platforms">
        <div className="mx-auto max-w-5xl px-6 py-14">
          <SectionHeader
            eyebrow="Platforms"
            title="Which are signed, and which are wishes"
            description="'Coming to PC and consoles' is how somebody buys a machine for a game that never arrives on it. Every line below says which kind of statement it is."
          />
          <ul className="mt-8 divide-y divide-border border-y border-border">
            {PLATFORMS.map((p) => (
              <li key={p.what} className="grid gap-1 py-4 md:grid-cols-[minmax(0,15rem)_minmax(0,11rem)_1fr] md:gap-6">
                <p className="font-medium">{p.what}</p>
                <p className="text-sm tabular-nums text-muted-foreground">{p.when}</p>
                <p className="text-sm text-muted-foreground">{p.state}</p>
              </li>
            ))}
          </ul>
          <p className="mt-6 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            If a platform moves from a wish to a signing we will say so on this page and on the
            Steam news feed the same day. Nothing here will quietly become vaguer.
          </p>
        </div>
      </section>

      <section className="border-b border-border">
        <div className="mx-auto max-w-5xl px-6 py-14">
          <MediaObject
            align="start"
            media={<SafeImage src={null} alt="A screenshot: the river at dusk, weir in the middle distance" ratio="16/10" fallbackSeed="weir" />}
          >
            <SectionHeader
              eyebrow="Made by two people"
              title="In Sheffield, over four years, on the actual river"
              description="The valley in the game is the Don and the Loxley, walked and photographed rather than invented. Six real weirs, in the order you meet them going up."
            />
            <p className="mt-5 max-w-xl text-sm leading-relaxed text-muted-foreground">
              Not a metaphor for anything and not about grief. It is about a river that had ninety
              water-powered works on it and now has trees, and what it is like to walk through the
              gap between those two facts.
            </p>
          </MediaObject>
        </div>
      </section>

      <section className="border-b border-border">
        <div className="mx-auto max-w-5xl px-6 py-14">
          <SectionHeader eyebrow="Press" title="From the demo build" />
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            <PressQuote quote="I have not been this quiet playing anything in years." source="Rock Paper Shotgun" />
            <PressQuote quote="A walking game with somewhere real to walk. The industrial archaeology is the story." source="Edge" />
            <PressQuote quote="Eight hours of almost nothing happening, and I will play it again." source="Eurogamer" />
          </div>
          <p className="mt-6 text-sm text-muted-foreground">
            <a className="underline underline-offset-4" href="/press">The full kit — screenshots, logos and the fact sheet.</a>
          </p>
        </div>
      </section>

      <section id="questions">
        <div className="mx-auto max-w-3xl px-6 py-14">
          <SectionHeader title="Before you wishlist it" />
          <div className="mt-6">
            <Faq
              items={[
                {
                  question: "Is there any combat?",
                  answer: "None. Nothing in the game can hurt you and nothing can be killed. There is no failure state at all — you cannot get it wrong.",
                },
                {
                  question: "How long is it?",
                  answer:
                    "About eight hours walking at a normal pace, twelve if you stop and read everything. There is no new-game-plus and no reason to replay it except wanting to.",
                },
                {
                  question: "Will it run on my machine?",
                  answer:
                    "Almost certainly. A 2016 laptop with integrated graphics manages 60fps at 1080p. There will be a free demo of the first weir six weeks before release so you can check rather than guess.",
                },
                {
                  question: "What will it cost?",
                  answer:
                    "£16, with no pre-order and no deluxe edition. It will be in a sale eventually and we will not pretend otherwise — if £16 is too much, wait, and we will not think less of you.",
                },
              ]}
            />
          </div>
        </div>
      </section>
    </SiteChrome>
  );
}
