// printer /quote — sending artwork, with BLEED AND RESOLUTION EXPLAINED rather
// than demanded.
//
// A REJECTED FILE IS WHAT DELAYS EVERY PRINT JOB, and every print shop's
// artwork page is a list of requirements written for designers — "3mm bleed,
// 300dpi, CMYK, outlined fonts" — read by a plumber who made a card in Word.
// So each requirement says what it IS, what goes wrong without it, and whether
// we will simply fix it, which for most of them we will.
//
// AND WHAT WE FIX FREE IS PUBLISHED AS A LIST. "Artwork charges may apply" is
// the sentence that makes people not send anything at all.
import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { useChunkedUpload, ChunkedUploadBar } from "@/components/ui/chunked-upload";
import { TurnaroundNote } from "@/components/ui/turnaround-note";
import { SpecList, SpecRow } from "@/components/ui/spec-row";
import { SectionHeader } from "@/components/ui/section-header";
import { Faq } from "@/components/ui/faq";

export const Route = createFileRoute("/quote")({ component: P });

const REQUIREMENTS = [
  {
    what: "3mm bleed",
    plainly: "Run the background 3mm past every edge of the artwork.",
    without: "The guillotine cuts within about half a millimetre of where it should, so a background stopping exactly at the edge leaves a white hairline down one side of the batch.",
    weFix: true,
  },
  {
    what: "5mm safe margin",
    plainly: "Keep text and logos 5mm in from the edge.",
    without: "The same drift the other way. Text 1mm from the edge on the file is text touching the edge on a third of the run.",
    weFix: false,
  },
  {
    what: "300dpi at final size",
    plainly: "Images need to be four times the pixels you would use on a screen.",
    without: "It prints soft and blocky. A logo pulled off a website is the single commonest cause and it cannot be repaired by anybody — the detail is not in the file.",
    weFix: false,
  },
  {
    what: "CMYK, not RGB",
    plainly: "Print mixes four inks; a screen mixes three lights.",
    without: "Bright screen colours — vivid greens, electric blues, pure orange — come out flat. We convert it, and we will warn you if your particular colour is one that shifts visibly.",
    weFix: true,
  },
  {
    what: "Fonts outlined or embedded",
    plainly: "Turn the type into shapes, or send the font with the file.",
    without: "Our machine substitutes something else and the layout reflows. Usually obvious, occasionally not, which is worse.",
    weFix: true,
  },
  {
    what: "Rich black for large areas",
    plainly: "Big black areas want a mix, not just the black ink.",
    without: "Plain 100% black over a whole A2 looks grey and patchy. Trivial for us to change and nobody outside the trade knows it.",
    weFix: true,
  },
];

function P() {
  // The upload is injected with a stub sender here — the component owns
  // slicing, sequencing and the ledger; where the bytes go is the caller's.
  const sendChunk = React.useCallback(async () => true, []);
  const upload = useChunkedUpload(sendChunk);

  return (
    <SiteChrome
      name="Neepsend Print & Sign"
      tagline="Send the file. We will tell you within the hour whether it will print."
      links={[
        { label: "Prices", href: "#/" },
        { label: "Products", href: "#/products" },
      ]}
      action={{ label: "Prices", href: "#/" }}
    >
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-12 lg:grid-cols-[15rem_1fr]">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Getting a price</p>
          <ol className="mt-4 space-y-4 border-y border-border py-4">
            <li className="text-sm">
              <span className="font-medium">1 · Send the file</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                Anything up to 500MB, straight from this page.
              </span>
            </li>
            <li className="text-sm">
              <span className="font-medium">2 · We check it</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                Within the hour in working time, by a person, not a script.
              </span>
            </li>
            <li className="text-sm">
              <span className="font-medium">3 · A proof and a price</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                PDF proof by email. Nothing goes on a press until you say yes.
              </span>
            </li>
          </ol>
          <div className="mt-5">
            <TurnaroundNote from={3} to={5} busyNote="Correx at 7–8 days until mid-September" />
          </div>
          <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
            Or email it to studio@neepsendprint.co.uk, or bring a memory stick to the unit on
            Rutland Road. All three end up in the same place.
          </p>
        </aside>

        <div className="min-w-0">
          <h1 className="text-4xl font-semibold tracking-tight text-balance">Send artwork</h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            Send whatever you have. A PDF is best, a Word file is fine, a photograph of a business
            card is a real starting point and we have worked from worse. We will tell you honestly
            whether it will print well before anybody spends any money.
          </p>

          <section className="mt-10 rounded-xl border border-border p-6">
            <p className="text-sm font-medium">Upload</p>
            <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-muted-foreground">
              Up to 500MB. It goes in pieces, so a dropped connection resumes where it stopped
              rather than starting again — which matters on a 300MB wrap file over a phone.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-4">
              <input
                type="file"
                aria-label="Artwork file"
                className="text-sm"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) upload.start(f);
                }}
              />
              <span className="text-xs text-muted-foreground">PDF, AI, EPS, PSD, JPG, PNG, DOCX</span>
            </div>
            <div className="mt-4 max-w-md">
              <ChunkedUploadBar state={upload.state} onPause={upload.pause} onResume={upload.resume} />
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="font-medium">What is it for</span>
                <input
                  className="mt-1.5 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  placeholder="500 business cards, 400gsm matt"
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium">When do you need it</span>
                <input
                  className="mt-1.5 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  placeholder="Friday would be ideal, no rush"
                />
              </label>
            </div>
            <label className="mt-4 block text-sm">
              <span className="font-medium">Email or phone</span>
              <input
                className="mt-1.5 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                placeholder="So we can send the proof back"
                autoComplete="email"
              />
            </label>
            <button type="button" className="mt-5 cursor-pointer rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground">
              Send it over
            </button>
          </section>

          {/* THE REQUIREMENTS, EXPLAINED AND MARKED FIX-OR-NOT. */}
          <section className="mt-14">
            <SectionHeader
              eyebrow="File requirements"
              title="Six things, and we fix four of them free"
              description="Every printer publishes this list written for designers. Here is what each one actually means, what goes wrong without it, and whether it is your problem or ours."
            />
            <ul className="mt-8 divide-y divide-border border-y border-border">
              {REQUIREMENTS.map((r) => (
                <li key={r.what} className="py-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <p className="font-medium">{r.what}</p>
                    <p className={"text-sm " + (r.weFix ? "font-medium" : "text-muted-foreground")}>
                      {r.weFix ? "We fix this free" : "We cannot fix this for you"}
                    </p>
                  </div>
                  <p className="mt-2 max-w-2xl text-sm">{r.plainly}</p>
                  <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">{r.without}</p>
                </li>
              ))}
            </ul>
            <p className="mt-6 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              The two we cannot fix are both about information that is not in the file. A 400-pixel
              logo does not contain the detail a poster needs, and no amount of upscaling invents
              it. Send us the original, or the vector, or tell us who made it — we will ring them.
            </p>
          </section>

          <section className="mt-14">
            <div className="grid items-start gap-10 lg:grid-cols-[1fr_1fr]">
              <div>
                <SectionHeader
                  eyebrow="Artwork charges"
                  title="£22 a half hour, and it is rarely charged"
                  description="About one job in fifteen. We tell you the figure before doing any of it, never afterwards on the invoice."
                />
                <p className="mt-5 max-w-lg text-sm leading-relaxed text-muted-foreground">
                  "Artwork charges may apply" is the sentence that stops people sending anything at
                  all, so here is where the line is. Adding bleed, converting colour, outlining
                  fonts and fixing a rich black are free and take us two minutes. Redrawing a logo
                  from a photograph, retyping a menu, or designing something from scratch is real
                  work and is charged.
                </p>
              </div>
              <SpecList>
                <SpecRow label="Adding bleed" value="Free" />
                <SpecRow label="RGB to CMYK" value="Free" />
                <SpecRow label="Outlining fonts" value="Free" />
                <SpecRow label="Rich black fix" value="Free" />
                <SpecRow label="Resizing to a different format" value="Free" note="A4 poster to A2, or a card to a compliment slip." />
                <SpecRow label="Redrawing a logo as vector" value="£45" highlight note="One-off. After that it is on file forever and every future job is free." />
                <SpecRow label="Typesetting from a Word file" value="£22" unit="per half hour" note="Usually one half hour for a menu." />
                <SpecRow label="Design from nothing" value="£38" unit="per hour" note="Two hours for a card, about six for a leaflet. We will quote a fixed price first." />
              </SpecList>
            </div>
          </section>

          <section className="mt-14">
            <SectionHeader title="Artwork questions" />
            <div className="mt-6">
              <Faq
                items={[
                  {
                    question: "I made it in Canva. Is that a problem?",
                    answer:
                      "No, and about half of what we receive is Canva now. Export as PDF Print with crop marks and bleed ticked — that one checkbox is the difference between a free fix and a perfect file. If you cannot find it, send it anyway.",
                  },
                  {
                    question: "I only have a JPEG of my logo.",
                    answer:
                      "Fine on anything up to A3 if it is a decent size. On a banner or a van it will look soft. Redrawing it as vector is £45 once and then it is on file forever — worth it the first time you order signage.",
                  },
                  {
                    question: "Will the printed colour match my screen?",
                    answer:
                      "Close, not identical, and nobody in the trade can promise otherwise — your screen is backlit and paper is not. For a brand colour, ask for a printed proof at £12 and it comes off the invoice.",
                  },
                  {
                    question: "Do you keep my files?",
                    answer:
                      "Yes, indefinitely, so a reprint is one phone call. Ask us to delete them and we will, same day. We do not use anybody's work as an example without asking first.",
                  },
                ]}
              />
            </div>
            <p className="mt-8 text-sm text-muted-foreground">
              <a className="underline underline-offset-4" href="#/">Quantity breaks and prices</a>
              {" · "}
              <a className="underline underline-offset-4" href="#/products">Stocks, finishes and sizes</a>
            </p>
          </section>
        </div>
      </div>
    </SiteChrome>
  );
}
