// band /listen — the records, where to hear them, and the set as it is
// currently played.
//
// THE SETLIST IS PUBLISHED, WHICH BANDS ARE ODDLY PRECIOUS ABOUT. Somebody
// deciding whether to spend £14 and a Saturday night on an unfamiliar band is
// asking "will they play the one I know", and the answer costs nothing. It also
// tells you the show is about seventy minutes, which is the other thing people
// want and never get.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { AudioPlayer } from "@/components/ui/audio-player";
import { SetlistRow } from "@/components/ui/setlist-row";
import { PressQuote } from "@/components/ui/press-quote";
import { SectionHeader } from "@/components/ui/section-header";
import { Faq } from "@/components/ui/faq";

export const Route = createFileRoute("/listen")({ component: P });

const SET = [
  { position: 1, title: "Attercliffe Road", seconds: 214, musicalKey: "D", note: "Opener since March. Starts before anybody is ready, on purpose." },
  { position: 2, title: "Holme Lane", seconds: 208, gapSeconds: 8, musicalKey: "G" },
  { position: 3, title: "The Long Room", seconds: 251, gapSeconds: 12, musicalKey: "G" },
  { position: 4, title: "Winter Street", seconds: 196, gapSeconds: 30, musicalKey: "A", note: "Where the talking happens, if any is going to." },
  { position: 5, title: "Six Weirs", seconds: 302, gapSeconds: 10, musicalKey: "Em", tuning: "DADGAD" },
  { position: 6, title: "Rivelin", seconds: 178, gapSeconds: 25, musicalKey: "Em", tuning: "DADGAD" },
  { position: 7, title: "Neepsend", seconds: 233, gapSeconds: 10, musicalKey: "C" },
  { position: 8, title: "Loxley Common", seconds: 264, gapSeconds: 15, musicalKey: "C", cut: true, note: "Cut on shorter sets. First thing to go when a curfew is tight." },
  { position: 9, title: "The Ship", seconds: 341, gapSeconds: 20, musicalKey: "D", note: "Closer. Long ending, and it gets longer." },
];

function P() {
  return (
    <SiteChrome
      name="The Long Room"
      tagline="Two records, and the set as it is played this autumn."
      links={[
        { label: "Home", href: "/" },
        { label: "Tour", href: "/tour" },
      ]}
      action={{ label: "Get tickets", href: "/tour" }}
    >
      <div className="mx-auto max-w-5xl px-6 py-14">
        <h1 className="text-4xl font-semibold tracking-tight text-balance">Listen</h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          Two whole songs rather than two clips. If three and a half minutes is not worth your time
          then neither is £14 and a Saturday, and we would rather you found that out here.
        </p>

        <section className="mt-12">
          <div className="grid gap-8 md:grid-cols-2">
            <div>
              <AudioPlayer src="/audio/the-long-room-holme-lane.mp3" title="Holme Lane — from the second record" />
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Live in one room at Yellow Arch, Neepsend. Three takes, the second one used, no
                overdubs except the second guitar in the last minute.
              </p>
            </div>
            <div>
              <AudioPlayer src="/audio/the-long-room-six-weirs.mp3" title="Six Weirs — from the first record" />
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                The one people know, from 2024. Five minutes and it is a slow start — the argument
                for it happens at about ninety seconds.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-14">
          <SectionHeader
            eyebrow="The set"
            title="What we are actually playing this autumn"
            description="Bands are strangely private about this. Somebody deciding whether to come is asking whether we play the one they know, and it costs nothing to answer."
          />
          <ul className="mt-8 max-w-3xl divide-y divide-border border-y border-border">
            {SET.map((s) => (
              <SetlistRow key={s.title} {...s} slotSeconds={4200} />
            ))}
          </ul>
          <p className="mt-5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            About seventy minutes with the gaps, which is the other thing nobody publishes. Loxley
            Common goes first when a curfew is tight, and there is usually one more after The Ship
            if the room wants it.
          </p>
        </section>

        <section className="mt-14">
          <div className="grid items-start gap-10 lg:grid-cols-[1.15fr_1fr]">
            <div>
              <SectionHeader
                eyebrow="Where to hear it"
                title="Everywhere, and one place that pays us"
                description="It is all on the streaming services and we are not going to be sniffy about it — that is how most people find anything. But the arithmetic is worth knowing."
              />
              <ul className="mt-6 divide-y divide-border border-y border-border text-sm">
                <li className="flex flex-wrap justify-between gap-4 py-3">
                  <span>Streaming, any service</span>
                  <span className="tabular-nums text-muted-foreground">about £0.003 a play</span>
                </li>
                <li className="flex flex-wrap justify-between gap-4 py-3">
                  <span>Bandcamp, £8 download</span>
                  <span className="tabular-nums text-muted-foreground">about £6.50 to us</span>
                </li>
                <li className="flex flex-wrap justify-between gap-4 py-3">
                  <span>Vinyl, £22, from us at a show</span>
                  <span className="tabular-nums text-muted-foreground">about £9 to us</span>
                </li>
                <li className="flex flex-wrap justify-between gap-4 py-3">
                  <span>Vinyl, £24, from a record shop</span>
                  <span className="tabular-nums text-muted-foreground">about £5 to us</span>
                </li>
              </ul>
              <p className="mt-5 max-w-lg text-sm leading-relaxed text-muted-foreground">
                Buy it from a record shop anyway if there is one near you. We would rather Bear Tree
                on Chapel Walk stayed open than have the extra four pounds.
              </p>
            </div>
            <div className="space-y-5">
              <PressQuote
                quote="Four people playing in a room, recorded like it. The most convincing British guitar record of the year so far."
                source="Uncut"
              />
              <PressQuote
                quote="Nothing here is trying to be bigger than it is, which is exactly why it works."
                source="The Quietus"
              />
            </div>
          </div>
        </section>

        <section className="mt-14">
          <SectionHeader title="About the records" />
          <div className="mt-6">
            <Faq
              items={[
                {
                  question: "Is there vinyl of the first record?",
                  answer:
                    "Sold out and we are not repressing it — 300 copies and that was the point. It is on Bandcamp as a download and the second record includes two songs from it re-recorded.",
                },
                {
                  question: "Can I use your music in something?",
                  answer:
                    "Almost certainly yes and almost certainly for nothing, if it is a student film, a podcast or anything not selling something. Email and ask. Advertising is a different conversation and the answer is usually no.",
                },
                {
                  question: "Will you play a request?",
                  answer:
                    "Sometimes, badly. Anything from either record we can do; anything we have not played since 2023 will be an approximation and you will be able to tell.",
                },
                {
                  question: "What is DADGAD?",
                  answer:
                    "An alternative guitar tuning, and the reason two songs sit together in the set — retuning takes about forty seconds and doing it twice would be forty seconds of silence too many.",
                },
              ]}
            />
          </div>
          <p className="mt-8 text-sm text-muted-foreground">
            <a className="underline underline-offset-4" href="/">The next date</a>
            {" · "}
            <a className="underline underline-offset-4" href="/tour">Every date</a>
          </p>
        </section>
      </div>
    </SiteChrome>
  );
}
