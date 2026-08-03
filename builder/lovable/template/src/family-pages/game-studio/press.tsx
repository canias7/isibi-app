// game-studio /press — the kit, and a policy on coverage stated rather than
// implied.
//
// A PRESS PAGE THAT SAYS "CONTACT US FOR ASSETS" IS A PRESS PAGE THAT GETS NO
// COVERAGE. A writer on a deadline needs screenshots at full resolution, a
// logo on transparency, a fact sheet and a key, all reachable in one click and
// without an email. Making somebody ask is how a piece gets dropped.
//
// AND SAYING THERE ARE NO EMBARGO STRINGS. Small studios routinely attach
// conditions to review keys; saying plainly that there are none is worth more
// than any amount of enthusiasm.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { Gallery } from "@/components/ui/gallery";
import { PressQuote } from "@/components/ui/press-quote";
import { VideoEmbed } from "@/components/ui/video-embed";
import { SectionHeader } from "@/components/ui/section-header";
import { Faq } from "@/components/ui/faq";

export const Route = createFileRoute("/press")({ component: P });

const FACTS = [
  { k: "Title", v: "Six Weirs" },
  { k: "Developer", v: "Two people, trading as Wire the North Ltd, Sheffield" },
  { k: "Publisher", v: "Self-published" },
  { k: "Release", v: "12 March 2027" },
  { k: "Platforms at launch", v: "PC (Steam, GOG), Mac, Linux, Steam Deck" },
  { k: "Later", v: "Nintendo Switch 2, signed, no date" },
  { k: "Price", v: "£16 / $19 / €18" },
  { k: "Length", v: "About 8 hours" },
  { k: "Engine", v: "Godot 4" },
  { k: "Languages", v: "English, with full subtitles. French, German and Spanish at launch" },
  { k: "Rating", v: "PEGI 3 expected. No violence, no language, no themes requiring one" },
  { k: "Demo", v: "Free, the first weir, six weeks before release" },
];

function P() {
  return (
    <SiteChrome
      name="Six Weirs"
      tagline="Press kit — everything downloadable, nothing behind an email."
      links={[
        { label: "Home", href: "#/" },
        { label: "About the game", href: "#/about" },
      ]}
      action={{ label: "Ask for a key", href: "#contact" }}
    >
      <div className="mx-auto max-w-5xl px-6 py-14">
        <h1 className="text-4xl font-semibold tracking-tight text-balance">Press kit</h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          Everything here is downloadable without asking us. A page that says "contact us for
          assets" is a page whose game does not get written about, because the piece was due
          yesterday.
        </p>

        <section className="mt-12">
          <SectionHeader eyebrow="Screenshots" title="Twelve, at 3840×2160, no watermark" />
          <div className="mt-8">
            <Gallery
              columns={3}
              items={[
                { src: null, alt: "The first weir at dawn", caption: "01 — Kelham Island, dawn" },
                { src: null, alt: "A ruined grinding hull", caption: "02 — the grinding hull at Malin Bridge" },
                { src: null, alt: "The river under trees", caption: "03 — Rivelin, mid-morning" },
                { src: null, alt: "A flood plaque on a wall", caption: "04 — the 1864 flood marker" },
                { src: null, alt: "The fourth weir in rain", caption: "05 — Loxley in rain" },
                { src: null, alt: "A dam wall from below", caption: "06 — the dam wall" },
                { src: null, alt: "Late light on still water", caption: "07 — the goit, late light" },
                { src: null, alt: "The sixth weir at dusk", caption: "08 — the last weir" },
                { src: null, alt: "A notice board with tenancy notices", caption: "09 — readable, and all of it real" },
              ]}
            />
          </div>
          <p className="mt-5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Also a logo on transparency in SVG and PNG, the key art at three crops, and a 60-second
            b-roll clip with no music for anybody cutting their own.
          </p>
        </section>

        <section className="mt-14">
          <div className="grid gap-12 lg:grid-cols-[1fr_1fr]">
            <div>
              <SectionHeader eyebrow="Fact sheet" title="Everything a piece needs" />
              <ul className="mt-6 divide-y divide-border border-y border-border text-sm">
                {FACTS.map((f) => (
                  <li key={f.k} className="grid gap-1 py-3 sm:grid-cols-[minmax(0,10rem)_1fr] sm:gap-4">
                    <span className="text-muted-foreground">{f.k}</span>
                    <span>{f.v}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <SectionHeader eyebrow="Trailer" title="Embeddable, and downloadable at source" />
              <div className="mt-6">
                <VideoEmbed
                  url="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"
                  title="Six Weirs — announcement trailer"
                />
              </div>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                A ProRes master is in the kit for anybody who needs it. The music is ours and
                cleared for use in any coverage.
              </p>
              <div className="mt-6 space-y-5">
                <PressQuote quote="I have not been this quiet playing anything in years." source="Rock Paper Shotgun" />
                <PressQuote quote="A walking game with somewhere real to walk." source="Edge" />
              </div>
            </div>
          </div>
        </section>

        <section className="mt-14" id="contact">
          <SectionHeader
            eyebrow="Keys and coverage"
            title="No conditions, and we mean it"
            description="Small studios routinely attach strings to review keys. Here is our whole policy, which is shorter than most disclaimers."
          />
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <div className="rounded-xl border border-border p-6">
              <p className="font-medium">Keys go to anybody who asks</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Outlet, YouTube channel, blog, podcast, ten followers or a hundred thousand. Email
                press@sixweirs.com with where it will go. Usually answered the same day.
              </p>
            </div>
            <div className="rounded-xl border border-border p-6">
              <p className="font-medium">No embargo on opinion</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                There is a date embargo on release-day pieces and that is all. Say whatever you
                like about it, whenever, including that you did not enjoy it.
              </p>
            </div>
            <div className="rounded-xl border border-border p-6">
              <p className="font-medium">Monetise the video</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                All of it, including a full playthrough. No content ID, no claims, and no request to
                stop at a particular point.
              </p>
            </div>
            <div className="rounded-xl border border-border p-6">
              <p className="font-medium">We will not ask to see it first</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Ever. We would like to read it and we will find it ourselves rather than making
                that a condition of the key.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-14">
          <SectionHeader title="Press questions" />
          <div className="mt-6">
            <Faq
              items={[
                {
                  question: "Can we interview you?",
                  answer: "Yes, both of us, video or written, and we will answer awkward questions about funding and money honestly. Email and suggest a time.",
                },
                {
                  question: "Is there a playable build now?",
                  answer: "A press build of the first two weirs, about ninety minutes, available today. The public demo is six weeks before release.",
                },
                {
                  question: "Can we use the screenshots after release?",
                  answer: "Forever, for anything editorial, without asking again. The kit is CC-BY as far as we are able to make it.",
                },
              ]}
            />
          </div>
          <p className="mt-8 text-sm text-muted-foreground">
            <a className="underline underline-offset-4" href="#/">The trailer</a>
            {" · "}
            <a className="underline underline-offset-4" href="#/about">What the game is</a>
          </p>
        </section>
      </div>
    </SiteChrome>
  );
}
