// salon/class-schedule /manage — the family's manage page is ONE appointment
// reached from a claim link. A class member has a standing arrangement instead:
// several bookings, a recurring one, a waiting-list place, and a pack that runs
// down. So this is a list rather than a record, and the two things it has to
// answer are "what have I got booked" and "am I actually going".
//
// The second is the interesting one. A studio's real problem is not
// cancellations, it is people who stop coming and keep paying — so this page
// says how many classes somebody has used, plainly, including when the answer
// is embarrassing for us.
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { BookingCredits } from "@/components/ui/booking-credits";
import { CancelPolicy } from "@/components/ui/cancel-policy";
import { IcsButton } from "@/components/ui/ics-button";
import { NextOccurrence } from "@/components/ui/next-occurrence";
import { SectionHeader } from "@/components/ui/section-header";
import { SpecList, SpecRow } from "@/components/ui/spec-row";
import { StatsBand } from "@/components/ui/stats-band";
export const Route = createFileRoute("/manage")({ component: P });
type Booked = { id: string; when: string; iso: string; name: string; teacher: string; kind: "one" | "weekly" | "waiting" };
const BOOKED: Booked[] = [
  { id: "b1", when: "Tuesday 4 August, 18:30", iso: "2026-08-04T18:30:00", name: "Vinyasa", teacher: "Ekow", kind: "weekly" },
  { id: "b2", when: "Thursday 6 August, 18:30", iso: "2026-08-06T18:30:00", name: "Mat pilates", teacher: "Ruth", kind: "one" },
  { id: "b3", when: "Saturday 8 August, 10:00", iso: "2026-08-08T10:00:00", name: "Reformer", teacher: "Ruth", kind: "waiting" },
  { id: "b4", when: "Tuesday 11 August, 18:30", iso: "2026-08-11T18:30:00", name: "Vinyasa", teacher: "Ekow", kind: "weekly" },
];
function P() {
  const [dropped, setDropped] = useState<string[]>([]);
  const [weekly, setWeekly] = useState(true);
  const live = BOOKED.filter((b) => !dropped.includes(b.id));
  return (
    <SiteChrome name="Wharf Studio" tagline="Pilates, reformer and yoga in a converted grain store. Ipswich waterfront."
      links={[{ label: "The timetable", href: "#/" }, { label: "Book a class", href: "#/book" }, { label: "What a class is like", href: "#/work" }]}
      action={{ label: "Book a class", href: "#/book" }}>

      <div className="mx-auto max-w-6xl px-6 py-12">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Órlaith Byrne · member since March 2024</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Your classes</h1>

        <StatsBand className="mt-8" items={[
          { value: "6", label: "Classes left on your pack" },
          { value: "4", label: "Booked, including two recurring" },
          { value: "3", label: "Classes in the last month" },
          { value: "£11.50", label: "What each one is costing you" },
        ]} />

        <div className="mt-10 grid gap-10 lg:grid-cols-[1.3fr_1fr]">
          <div>
            <SectionHeader eyebrow="Booked" title="Four, and one of them is a waiting-list place" />
            <div className="mt-6 space-y-3">
              {live.map((b) => (
                <div key={b.id} className="rounded-lg border border-border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-base font-medium">{b.name} · {b.teacher}</p>
                      <p className="mt-0.5 text-sm tabular-nums text-muted-foreground">{b.when}</p>
                      <p className="mt-1.5 text-sm">
                        {b.kind === "weekly" && <span className="font-medium">Part of your weekly booking</span>}
                        {b.kind === "one" && <span className="text-muted-foreground">One-off, one class off your pack</span>}
                        {b.kind === "waiting" && (
                          <span className="text-muted-foreground">
                            <span className="font-medium text-foreground">Waiting list, third in line.</span>{" "}
                            Nothing comes off your pack unless a mat frees up. We text the evening before.
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      {b.kind !== "waiting" && (
                        <IcsButton title={`${b.name} — Wharf Studio`} start={b.iso} location="Wharf Studio, Ipswich" />
                      )}
                      <button type="button" onClick={() => setDropped((s) => [...s, b.id])}
                        className="rounded-md border border-border px-3 py-2 text-sm font-medium">
                        {b.kind === "waiting" ? "Leave the list" : "Cancel this one"}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {live.length === 0 && (
                <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                  Nothing booked. The timetable is <a className="font-medium text-foreground underline underline-offset-4" href="#/">here</a> and
                  your six classes have no expiry, so there is no hurry.
                </p>
              )}
            </div>

            <div className="mt-8 rounded-lg border border-border p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="max-w-lg">
                  <p className="text-base font-medium">Your weekly class</p>
                  <div className="mt-2">
                    <NextOccurrence at="2026-08-04T18:30:00" rule="Every Tuesday, 18:30 — Vinyasa with Ekow"
                      paused={!weekly} pausedNote="Paused. Nothing is being booked and nothing is coming off your pack." />
                  </div>
                </div>
                <button type="button" onClick={() => setWeekly((v) => !v)}
                  className="shrink-0 rounded-md border border-border px-4 py-2 text-sm font-medium">
                  {weekly ? "Pause it" : "Start it again"}
                </button>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                A weekly booking takes one class off your pack the evening before, not a month
                ahead — so pausing it never leaves you having paid for classes you did not go to.
              </p>
            </div>
          </div>

          <div>
            <div className="rounded-lg border border-border p-5">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Your pack</p>
              <div className="mt-3">
                <BookingCredits balance={6} rollsOver unit="class"
                  rates={[
                    { id: "mat", what: "Any mat class", costs: 1 },
                    { id: "ref", what: "Reformer", costs: 1 },
                    { id: "fam", what: "Family class, two people", costs: 2 },
                  ]} />
              </div>
            </div>

            {/* THE THING A STUDIO IS SUPPOSED NOT TO SAY. A monthly member who
                came three times is paying £26 a class for something that costs
                £11.50 on a pack, and the only party who can see that is us. */}
            <div className="mt-6 rounded-lg border border-foreground p-5">
              <p className="text-base font-semibold">You are on the ten-pack, and that is right for you</p>
              <div className="mt-3">
                <SpecList>
                  <SpecRow label="Classes last month" value="3" note="February to July averages 3.4 a month" highlight />
                  <SpecRow label="On the pack" value="£34.50" note="Three classes at £11.50" highlight />
                  <SpecRow label="On the monthly" value="£78" note="Which would be £26 a class at your rate" />
                  <SpecRow label="So" value="Stay as you are" note="We check this twice a year and email whoever is on the wrong one. It costs us money and it is the correct thing to do" />
                </SpecList>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                If you get above six a month the monthly wins and we will tell you that too. The
                whole calculation is on this page rather than in an email you have to trust.
              </p>
            </div>

            <div className="mt-6">
              <SectionHeader eyebrow="Cancelling" title="Four hours, and then it is used" />
              <div className="mt-4">
                <CancelPolicy hours={4} />
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Not a penalty. Past four hours nobody on the waiting list can rearrange an evening
                around a mat that has just come free, so the class is gone whether you are in it or
                not. Illness is a text and we put it back — every time, no proof, and we have never
                once regretted that.
              </p>
            </div>
          </div>
        </div>
      </div>
    </SiteChrome>
  );
}
