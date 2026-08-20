// energy /meter — sending a reading, and what the digits mean on each meter
// type. The reading form is the most-used page on any supplier's site and is
// almost always three clicks from the home page.
//
// WHICH DIGITS TO IGNORE is the whole content. Every wrong reading in the
// country is somebody typing the red decimal digit on a dial meter, or the
// "rate 2" register on a meter with one. Telling them costs four sentences and
// prevents a bill for eleven thousand pounds.
import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { MeterReading } from "@/components/ui/meter-reading";
import { SmartMeterNote } from "@/components/ui/smart-meter-note";
import { MediaGrid } from "@/components/ui/media-grid";
import { SectionHeader } from "@/components/ui/section-header";
import { Faq } from "@/components/ui/faq";

export const Route = createFileRoute("/meter")({ component: P });

const TYPES = [
  {
    what: "Digital, one row of numbers",
    read: "Read every digit left to right, including leading zeros. Ignore anything after a decimal point and ignore digits on a red background.",
  },
  {
    what: "Digital, cycling display",
    read: "Press the button until you see IMP R01 or RATE 1. That is the one we want. R02 is the off-peak register and only applies if you are on the off-peak tariff — send both if you are.",
  },
  {
    what: "Dial meter, five clock faces",
    read: "Left to right. If a pointer sits between two numbers take the lower one; if it is exactly on a number, look at the dial to its right — if that reads 8 or 9, drop your number by one.",
  },
  {
    what: "Prepayment meter",
    read: "You do not need to send anything. The meter reports itself. Press A until you see the credit remaining if you want to check the balance.",
  },
];

function P() {
  const [electric, setElectric] = React.useState("48213");
  const [gas, setGas] = React.useState("07742");
  return (
    <SiteChrome
      name="Loxley Community Energy"
      tagline="Send a reading. It takes about a minute and it stops estimated bills."
      links={[
        { label: "Home", href: "/" },
        { label: "All tariffs", href: "/tariffs" },
      ]}
      action={{ label: "All tariffs", href: "/tariffs" }}
    >
      <section className="border-b border-border">
        <div className="mx-auto max-w-5xl px-6 py-14">
          <div className="grid items-start gap-12 lg:grid-cols-[1fr_1fr]">
            <div>
              <h1 className="text-4xl font-semibold tracking-tight text-balance">
                Send a reading
              </h1>
              <p className="mt-5 max-w-lg leading-relaxed text-muted-foreground">
                Once a month is plenty. An account with real readings gets a real bill; an account
                without them gets an estimate that is wrong in one direction and then corrected
                painfully in the other.
              </p>
              <p className="mt-4 max-w-lg leading-relaxed text-muted-foreground">
                If a figure looks wrong to us we will query it before billing you rather than after
                — a reading typed with an extra digit is a common mistake and not one you should
                pay for.
              </p>
            </div>
            <div className="grid gap-6">
              <MeterReading
                label="Electricity"
                digits={5}
                previous={47_890}
                previousOn="2026-07-04"
                typicalDailyUse={9}
                value={electric}
                onChange={setElectric}
              />
              <MeterReading
                label="Gas"
                digits={5}
                previous={7_601}
                previousOn="2026-07-04"
                typicalDailyUse={4}
                value={gas}
                onChange={setGas}
              />
              <button type="button" className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground">
                Send both readings
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-border">
        <div className="mx-auto max-w-5xl px-6 py-14">
          <SectionHeader
            eyebrow="Which digits"
            title="Four kinds of meter, and what to ignore on each"
            description="Nearly every wrong reading is a red decimal digit or the second register on a meter that has one."
          />
          {/* THIS IS THE ONE PAGE ON AN ENERGY SITE WHERE A PICTURE IS THE
              ANSWER AND PROSE IS NOT. "Ignore the red digits" is a sentence
              somebody reads standing in a cellar with a torch, holding a phone,
              looking at a dial they have never looked at before. A photograph
              of each meter with the digits to read circled ends the question in
              one second, and it is why nearly every wrong reading is the same
              two mistakes. */}
          <div className="mt-8">
            <MediaGrid
              columns={4}
              ratio="4/3"
              items={[
                { src: null, alt: "A digital meter close up, five black digits, one red digit after them", caption: "Digital. Five black digits. The red one is tenths — leave it out." },
                { src: null, alt: "A dial meter, six clock faces, alternate ones running backwards", caption: "Dials. Left to right, take the lower number, and alternate dials run backwards." },
                { src: null, alt: "An Economy 7 meter showing two registers labelled low and normal", caption: "Economy 7. Two registers, and we need both — this is the commonest miss." },
                { src: null, alt: "A smart meter in-home display showing today's usage in pounds", caption: "Smart. If you have this, you never need to read anything." },
              ]}
            />
          </div>
          <ul className="mt-8 divide-y divide-border border-y border-border">
            {TYPES.map((t) => (
              <li key={t.what} className="grid gap-2 py-5 md:grid-cols-[minmax(0,15rem)_1fr] md:gap-8">
                <p className="font-medium">{t.what}</p>
                <p className="text-sm leading-relaxed text-muted-foreground">{t.read}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="border-b border-border">
        <div className="mx-auto max-w-3xl px-6 py-14">
          <SectionHeader
            eyebrow="Smart meters"
            title="If you have one, you can stop reading this page"
            description="It sends its own readings. What you can change is how often, and that is genuinely your call."
          />
          <div className="mt-8">
            <SmartMeterNote
              sending
              frequency="daily"
              lastReadingAt="2026-08-02"
              displayWorking
              canChangeFrequency
            />
          </div>
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-3xl px-6 py-14">
          <SectionHeader title="Reading questions" />
          <div className="mt-6">
            <Faq
              items={[
                {
                  question: "My reading is lower than last month's. Have I done something wrong?",
                  answer:
                    "Probably a digit missed off the front, or the meter has rolled past 99999 back to zero — both happen. Send it anyway with a note and we will work it out rather than bill you for it.",
                },
                {
                  question: "How often should I send one?",
                  answer:
                    "Monthly is ideal, quarterly is fine. The only readings that really matter are the one when you move in and the one when you move out, and both of those are worth photographing.",
                },
                {
                  question: "Can I send a photo instead of typing it?",
                  answer:
                    "Yes — email it to readings@loxleyenergy.coop with your account number. Somebody reads it the same working day. A photograph is also the best evidence if a reading is ever disputed.",
                },
              ]}
            />
          </div>
          <p className="mt-8 text-sm text-muted-foreground">
            <a className="underline underline-offset-4" href="/">Back to the tariffs</a>
            {" · "}
            <a className="underline underline-offset-4" href="/tariffs">Every tariff in full</a>
          </p>
        </div>
      </section>
    </SiteChrome>
  );
}
