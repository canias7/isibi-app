// entertainer /book — the date, the venue, and the details that decide whether
// it can happen at all. Space, power and a sound limiter are the three things
// that kill a booking, and asking them here beats finding out in the car park.
import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { BusyButton } from "@/components/ui/busy-button";
import { DateEnquiry } from "@/components/ui/date-enquiry";
import { Faq } from "@/components/ui/faq";
import { FormRow } from "@/components/ui/form-row";
import { Input } from "@/components/ui/input";
import { SectionHeader } from "@/components/ui/section-header";
import { SuccessPanel } from "@/components/ui/success-panel";
import { Testimonial } from "@/components/ui/testimonial";
import { Textarea } from "@/components/ui/textarea";
import { QUOTES } from "./index";
export const Route = createFileRoute("/book")({ component: P });
function P() {
  const [date, setDate] = React.useState("2026-10-17");
  const [status, setStatus] = React.useState<"free" | "taken" | "ask" | null>(null);
  const [venue, setVenue] = React.useState("");
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [detail, setDetail] = React.useState("");
  const [sent, setSent] = React.useState(false);
  return (
    <SiteChrome name="The Larkin Set" tagline="Six-piece function band. Sheffield, Leeds, Manchester and anywhere within two hours."
      links={[{ label: "Home", href: "#/" }, { label: "Packages", href: "#/packages" }]}
      action={{ label: "Ring 07700 900 118", href: "tel:07700900118" }}>

      <div className="mx-auto max-w-6xl px-6 py-14">
        <SectionHeader eyebrow="Check a date" title="Then the three things that decide it"
          description="Space, power and whether the venue has a sound limiter. Those are what stop a booking happening, and asking now beats a six-piece band finding out in your car park at half five." />

        <section className="mt-10 grid gap-12 lg:grid-cols-[1fr_1.15fr]">
          <div>
            <DateEnquiry status={status} defaultDate={date} defaultGuests={110}
              minGuests={20} maxGuests={400} now={new Date(2026, 7, 2)}
              alternatives={["2026-10-24", "2026-10-31", "2026-11-07"]}
              onCheck={(v) => { setDate(v.date); setStatus(v.date === "2026-10-17" ? "taken" : "free"); }}
              onEnquire={() => setStatus("free")} />
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              This reads the real diary. A date that comes back taken is taken — we do not hold
              provisional bookings and we will not ring you in three months to say it fell through,
              because it will already be gone.
            </p>

            <div className="mt-8">
              <Testimonial item={QUOTES[2]} />
            </div>
          </div>

          <div>
            {sent ? (
              <SuccessPanel title="Got it — you'll hear back today"
                description="Usually within a couple of hours, and always the same day. Nothing is held until we've replied and you've said yes to the number." />
            ) : (
              <div className="space-y-4">
                <h2 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">And the venue</h2>
                <FormRow label="Where it is" htmlFor="e-venue" required
                  hint="If we have played there we will already know the room, the limiter and where the van goes.">
                  <Input id="e-venue" placeholder="Wortley Hall, Sheffield" value={venue} onChange={(e) => setVenue(e.target.value)} />
                </FormRow>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormRow label="Your name" htmlFor="e-name" required>
                    <Input id="e-name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
                  </FormRow>
                  <FormRow label="Email" htmlFor="e-email" required>
                    <Input id="e-email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                  </FormRow>
                </div>
                <FormRow label="Anything you already know" htmlFor="e-detail"
                  hint="Especially: the size of the room, whether there is a sound limiter and what it is set to, and what time you want us playing.">
                  <Textarea id="e-detail" rows={6}
                    placeholder={"Barn, about 6m x 8m.\nThey said there is a limiter, I think 94dB.\nFirst dance around half eight, finish at midnight."}
                    value={detail} onChange={(e) => setDetail(e.target.value)} />
                </FormRow>
                <BusyButton disabled={!venue || !name || !email} onClick={() => setSent(true)}>
                  Send it over
                </BusyButton>
                <p className="text-sm text-muted-foreground">
                  No deposit is taken here and no card is asked for. This is an email that a person
                  reads.
                </p>
              </div>
            )}
          </div>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <SectionHeader eyebrow="The three that decide it" title="What we will ask if you have not said"
            description="Not to be difficult — every one of these has stopped a gig happening for somebody at some point, and all three are answerable by one email to your venue." />
          <div className="mt-8 grid gap-8 lg:grid-cols-3">
            <div className="border-t border-border pt-4">
              <p className="text-lg font-medium">Space</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                5m × 3m for six of us with the horns. 4m × 2.5m works with them standing forward.
                Under that it is the four-piece, which is £300 less and honestly still very good —
                what it is not is the same band made smaller.
              </p>
            </div>
            <div className="border-t border-border pt-4">
              <p className="text-lg font-medium">Power</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Two 13A sockets on separate circuits within 15m. Marquees need at least 10kVA and it
                needs to be a silent generator — a diesel forty feet from the tent is audible under
                every speech, and nobody remembers to ask until it is running.
              </p>
            </div>
            <div className="border-t border-border pt-4">
              <p className="text-lg font-medium">The limiter</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Ask your venue for the number, not whether they have one. Above 96dB nothing
                changes. 90–96dB we bring the electronic kit and it works. Below 85dB no live band
                should take your money, and we will tell you that rather than take it.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <div className="max-w-3xl">
            <SectionHeader eyebrow="Asked often" title="About the booking itself" />
            <Faq className="mt-6" items={[
              { question: "How quickly will you reply?", answer: "Same day, and usually within a couple of hours between nine and nine. If a date is free we will hold it informally for 72 hours while you decide, which is as long as is fair on anyone else asking." },
              { question: "Can we come and see you play?", answer: "Weddings are private and we will not sneak you into somebody else's. We do two or three public gigs a year and we will tell you when the next one is — otherwise the video on the front page is one take and unedited, on purpose." },
              { question: "Do you need feeding?", answer: "Six of us, and yes please — anything hot, at any point. Most venues have a crew rate. It is genuinely not a demand: if there is nothing, we will bring sandwiches and never mention it." },
              { question: "What paperwork does our venue need?", answer: "PLI certificate to £10m and PAT certificates for everything we plug in. We send both to the venue directly as soon as you book, without being asked and without you having to be the middleman." },
              { question: "What time do you finish?", answer: "Midnight as standard, 1am if the venue licence allows and you have added the hour. We are loaded out forty minutes later and out of the car park quietly." },
              { question: "Do you play outside?", answer: "Yes, under cover. Not under an open sky — one shower ends a gig and ruins about £9,000 of equipment, so it is the one thing we will not be talked into." },
            ]} />
          </div>
        </section>
      </div>
    </SiteChrome>
  );
}
