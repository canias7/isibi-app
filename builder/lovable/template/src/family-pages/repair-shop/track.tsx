// repair-shop /track — where my repair is, from its ticket. This page exists to
// stop the phone ringing, which is the honest business case: every "is it ready
// yet" call interrupts a bench, and the answer is four words.
import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { Faq } from "@/components/ui/faq";
import { LocationCard } from "@/components/ui/location-card";
import { OpeningHours } from "@/components/ui/opening-hours";
import { RepairStatus, type RepairStage } from "@/components/ui/repair-status";
import { SectionHeader } from "@/components/ui/section-header";
export const Route = createFileRoute("/track")({ component: P });
// A real site reads this from its own table. Four tickets so all the
// interesting states can be seen, including the one that matters.
const BOARD: Record<string, {
  ticket: string; device: string; job: string; stage: RepairStage;
  part?: string | null; expected?: string | null; note?: string | null; price?: string | null;
}> = {
  "RS-4821": {
    ticket: "RS-4821", device: "iPhone 14 Pro", job: "Rear glass",
    stage: "waiting_part", part: "Rear housing, ordered Tuesday, due Thursday morning",
    expected: "Friday", price: "£95 as quoted",
    note: "Nothing wrong — this is just the courier. We will text the moment it lands.",
  },
  "RS-4796": {
    ticket: "RS-4796", device: "Samsung S24", job: "Screen, genuine service pack",
    stage: "in_repair", expected: "Today, before 5", price: "£189 as quoted",
  },
  "RS-4802": {
    ticket: "RS-4802", device: 'MacBook Pro 14"', job: "Liquid damage",
    stage: "diagnosed", expected: "We will ring you first", price: "£60 diagnostic paid · repair quoted at £240",
    note: "Two rails shorted on the logic board. Repairable, but it is £240 and we will not start until you say.",
  },
  "RS-4770": {
    ticket: "RS-4770", device: "PS5", job: "HDMI port",
    stage: "ready", expected: "Ready now", price: "£85 to pay on collection",
    note: "Tested on two TVs and a monitor. Open till 5:30 today and 7 on Thursday.",
  },
};
function P() {
  const [repair, setRepair] = React.useState<(typeof BOARD)[string] | null>(null);
  const [missing, setMissing] = React.useState(false);
  const look = (t: string) => {
    const found = BOARD[t] ?? null;
    setRepair(found);
    setMissing(!found);
  };
  return (
    <SiteChrome name="Neepsend Repair Co." tagline="Phone, tablet, laptop and console repairs in Kelham Island, Sheffield."
      links={[{ label: "Home", href: "#/" }, { label: "All prices", href: "#/prices" }]}
      action={{ label: "Find us", href: "#find-us" }}>

      <div className="mx-auto max-w-5xl px-6 py-14">
        <SectionHeader eyebrow="Track" title="Where is it, right now"
          description="Your ticket number is on the slip and in the text we sent when you dropped it off. This is more accurate than ringing, because it is the same board we would be looking at." />

        <div className="mt-10">
          <RepairStatus repair={repair} notFound={missing} onLookup={look} />
        </div>

        <p className="mt-4 text-sm text-muted-foreground">
          Try <span className="font-medium">RS-4821</span> (waiting on a part),{" "}
          <span className="font-medium">RS-4796</span> (on the bench),{" "}
          <span className="font-medium">RS-4802</span> (needs your say-so) or{" "}
          <span className="font-medium">RS-4770</span> (ready).
        </p>

        <section className="mt-14 border-t border-border pt-10">
          <SectionHeader eyebrow="The stages" title="What each one actually means"
            description="Particularly the third, which is where most of the waiting happens and where most shops go quiet." />
          <ol className="mt-6 divide-y divide-border border-y border-border text-base">
            <li className="py-4"><span className="font-medium">Booked in</span> — it is on the shelf with your ticket on it. Usually a few hours, or overnight if you came in late.</li>
            <li className="py-4"><span className="font-medium">Looked at</span> — somebody has opened it and knows what is wrong. If the price has changed from the quote, this is when we ring you, and nothing happens until you answer.</li>
            <li className="py-4"><span className="font-medium">Waiting on a part</span> — the one that takes the time, and the one nobody explains. The tracker names the part and the day it is due. Nothing is happening and that is not a problem, it is a courier.</li>
            <li className="py-4"><span className="font-medium">On the bench</span> — actively being worked on. Usually the shortest stage of the lot.</li>
            <li className="py-4"><span className="font-medium">Ready to collect</span> — tested and back together. We text as well, and it will sit here safely for as long as you need.</li>
          </ol>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <div className="grid gap-12 lg:grid-cols-[1.1fr_1fr]">
            <div>
              <SectionHeader eyebrow="Asked often" title="About tracking" />
              <Faq className="mt-6" items={[
                { question: "I have lost the ticket number", answer: "Ring or come in with some ID and we will find it on the board. We do not put it in the tracker by name, because then anybody who knew your name could look up your repair." },
                { question: "It says waiting on a part and the date has passed", answer: "Then the courier is late, which happens. Ring us — that is the one thing worth a phone call, because we will chase it while you are on the line." },
                { question: "Can somebody else collect it?", answer: "Yes, with the ticket. No ticket, no collection, whoever they say they are." },
                { question: "How long will you keep it?", answer: "As long as you like, and we will not charge storage. After ninety days we will start ringing you, and after a year the law lets us sell it — we have never once done that." },
                { question: "Why does it say 'needs your say-so'?", answer: "Because the price changed after we opened it. We do not do work you have not agreed to, so it sits there until you answer rather than arriving as a surprise bill." },
              ]} />
            </div>
            <div id="find-us">
              <SectionHeader eyebrow="Collecting" title="When we are open" />
              <OpeningHours className="mt-6" days={[
                { day: 1, label: "Monday", open: "09:30", close: "17:30" },
                { day: 2, label: "Tuesday", open: "09:30", close: "17:30" },
                { day: 3, label: "Wednesday", open: "09:30", close: "17:30" },
                { day: 4, label: "Thursday", open: "09:30", close: "19:00" },
                { day: 5, label: "Friday", open: "09:30", close: "17:30" },
                { day: 6, label: "Saturday", open: "10:00", close: "16:00" },
                { day: 0, label: "Sunday" },
              ]} />
              <LocationCard className="mt-6" name="Neepsend Repair Co."
                address="Unit 2, Alma Street, Kelham Island, Sheffield, S3 8SA"
                note="Thursday is the late one, till seven, and it is the easiest evening to collect. Two hours free parking on Russell Street." />
            </div>
          </div>
        </section>
      </div>
    </SiteChrome>
  );
}
