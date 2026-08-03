// accountant/booking-hybrid /contact — the family's contact page is a
// consultation form with who answers it and how fast. A vet's needs a triage
// step in front of it, because the three things somebody might be doing on this
// page have completely different right answers: an emergency should not be
// filling in a form at all, an urgent-today needs the phone, and a routine
// booking is the only one the form is actually for.
//
// So the page asks which of the three it is, first, and takes two of them off
// the form entirely.
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { AvailabilityGrid } from "@/components/ui/availability-grid";
import { BusyButton } from "@/components/ui/busy-button";
import { ContactCard } from "@/components/ui/contact-card";
import { FormRow } from "@/components/ui/form-row";
import { Input } from "@/components/ui/input";
import { OpeningHours, type DayHours } from "@/components/ui/opening-hours";
import { RadioCards } from "@/components/ui/radio-cards";
import { SectionHeader } from "@/components/ui/section-header";
import { SuccessPanel } from "@/components/ui/success-panel";
import { Textarea } from "@/components/ui/textarea";
import { WeekStrip } from "@/components/ui/week-strip";
export const Route = createFileRoute("/contact")({ component: P });
const DAYS: DayHours[] = [
  { day: 1, label: "Monday", open: "08:30", close: "18:30" },
  { day: 2, label: "Tuesday", open: "08:30", close: "18:30" },
  { day: 3, label: "Wednesday", open: "08:30", close: "18:30" },
  { day: 4, label: "Thursday", open: "08:30", close: "19:30" },
  { day: 5, label: "Friday", open: "08:30", close: "18:30" },
  { day: 6, label: "Saturday", open: "09:00", close: "13:00" },
  { day: 0, label: "Sunday", open: null, close: null },
];
function P() {
  const [urgency, setUrgency] = useState("routine");
  const [day, setDay] = useState<string | null>("2026-08-06");
  const [slot, setSlot] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  return (
    <SiteChrome name="Marsh Lane Veterinary" tagline="Independent, RCVS accredited, and owned by the two vets who work here. Louth, Lincolnshire."
      links={[{ label: "Home", href: "#/" }, { label: "What we do and what it costs", href: "#/services" }, { label: "The practice", href: "#/about" }]}
      action={{ label: "Ring 01507 602 118", href: "tel:01507602118" }}>

      <div className="mx-auto max-w-5xl px-6 py-12">
        <SectionHeader eyebrow="Get in touch" title="First: which of these three is it?"
          description="Two of the three are a phone call and not a form, and sending somebody down a booking flow when their cat has stopped eating would be this page failing at the only job it has." />

        <div className="mt-8 max-w-2xl">
          <RadioCards value={urgency} onChange={setUrgency} columns={1} options={[
            { value: "emergency", label: "It is an emergency", description: "Collapse, breathing, a road accident, bloat, poisoning, a seizure that will not stop, a cat that cannot pass urine" },
            { value: "today", label: "It needs looking at today", description: "Off their food, limping badly, an eye, a wound, something that started this morning and is getting worse" },
            { value: "routine", label: "It is routine", description: "Vaccination, a check-up, neutering, a repeat prescription, or something that has been going on a while and is not worsening" },
          ]} />
        </div>

        {/* AN EMERGENCY GETS NO FORM AT ALL. Not a form with a warning above
            it — the form is gone, because a form is a thing that takes minutes
            and produces a reply later. */}
        {urgency === "emergency" && (
          <section className="mt-8 rounded-lg border-2 border-foreground p-6">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Do not use this page</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">Ring now, and start driving</h2>
            <a href="tel:01507602118" className="mt-5 block rounded-lg bg-primary px-6 py-5 text-center text-primary-foreground">
              <span className="block text-4xl font-semibold tracking-tight tabular-nums">01507 602 118</span>
              <span className="mt-1 block text-sm opacity-80">Any hour, any day. It goes to one of the two vets, not to a service.</span>
            </a>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-md border border-border p-4">
                <p className="text-sm font-medium">Ring while somebody else drives</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  So we can be ready and, if it is poisoning, so we can be looking it up before you arrive.
                </p>
              </div>
              <div className="rounded-md border border-border p-4">
                <p className="text-sm font-medium">Bring the packet</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  Whatever they ate, or a photograph of it. The dose matters more than the substance
                  in most cases.
                </p>
              </div>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              Marsh Lane, Louth LN11 0HP. Twenty-four hours, and one of us lives four minutes away.
            </p>
          </section>
        )}

        {urgency === "today" && (
          <section className="mt-8 rounded-lg border border-foreground p-6">
            <h2 className="text-2xl font-semibold tracking-tight">Ring rather than book</h2>
            <p className="mt-2 max-w-2xl text-base leading-relaxed text-muted-foreground">
              We keep four appointments a day back for exactly this and they are deliberately not on
              the grid, because a grid cannot tell how worried you are and the person answering the
              phone can. Ringing at half past eight almost always gets you seen that morning.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <a className="rounded-md bg-primary px-6 py-3 text-lg font-semibold tabular-nums text-primary-foreground" href="tel:01507602118">01507 602 118</a>
              <button type="button" onClick={() => setUrgency("routine")}
                className="rounded-md border border-border px-5 py-3 text-sm font-medium">
                Actually, it can wait — book routinely
              </button>
            </div>
          </section>
        )}

        {urgency === "routine" && (
          done ? (
            <div className="mt-8">
              <SuccessPanel title={`Booked — Thursday 6 August, ${slot ?? "10:20"}`}
                description="You will get a text confirmation within the hour and a reminder the day before. Nothing is taken now; you pay after the appointment."
                action={{ label: "What it will cost", href: "#/services" }} />
              <p className="mt-6 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                If it gets worse before Thursday, ring rather than waiting for the appointment — we
                would much rather see them on Tuesday and cancel the Thursday.
              </p>
            </div>
          ) : (
            <div className="mt-8 grid gap-10 lg:grid-cols-[1.1fr_1fr]">
              <div>
                <SectionHeader eyebrow="Routine" title="Pick a day and a time" />
                <div className="mt-6">
                  <WeekStrip start={new Date(2026, 7, 3)} value={day} onSelect={setDay} disabled={["2026-08-09"]} />
                </div>
                <div className="mt-6">
                  <AvailabilityGrid
                    slots={["09:00", "09:20", "09:40", "10:00", "10:20", "10:40", "11:00", "11:20",
                      "14:00", "14:20", "14:40", "15:00", "15:20", "15:40", "16:00", "16:20",
                      "16:40", "17:00", "17:20", "17:40", "18:00", "18:20", "18:40", "19:00"]}
                    taken={["09:00", "09:20", "10:00", "10:40", "11:00", "14:20", "15:00", "15:20",
                      "16:00", "16:40", "17:00", "17:20", "18:20"]}
                    value={slot} onSelect={setSlot} />
                </div>
                <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                  Twenty minutes each, which is longer than most practices and is on purpose. The
                  Thursday evening slots go about a week ahead; the Saturday morning ones go faster.
                </p>
              </div>

              <div>
                <form className="rounded-lg border border-border p-5" onSubmit={(e) => {
                  e.preventDefault(); setBusy(true);
                  setTimeout(() => { setBusy(false); setDone(true); }, 500);
                }}>
                  <p className="text-base font-medium">
                    {slot ? `Thursday 6 August, ${slot}` : "Pick a time on the left"}
                  </p>
                  <div className="mt-5 space-y-5">
                    <FormRow label="Your name" htmlFor="name" required>
                      <Input id="name" name="name" autoComplete="name" required />
                    </FormRow>
                    <FormRow label="Phone" htmlFor="tel" required hint="We text a confirmation and a reminder. Nothing else.">
                      <Input id="tel" name="tel" type="tel" inputMode="tel" autoComplete="tel" required />
                    </FormRow>
                    <FormRow label="Their name and what they are" htmlFor="pet" required>
                      <Input id="pet" name="pet" placeholder="Bramble, cat, 11" required />
                    </FormRow>
                    <FormRow label="What it is for" htmlFor="why" required
                      hint="A sentence is plenty. It decides who you see and how long we allow.">
                      <Textarea id="why" name="why" rows={3}
                        placeholder="Annual booster, and she has been drinking more than usual" />
                    </FormRow>
                  </div>
                  <div className="mt-6">
                    <BusyButton busy={busy} type="submit" className="w-full" disabled={!slot}>
                      {slot ? "Book it" : "Pick a time first"}
                    </BusyButton>
                  </div>
                  <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                    Nothing is taken now. Free to change or cancel any time — ring, and there is no
                    fee for a missed appointment because charging for one has never once made
                    somebody remember.
                  </p>
                </form>

                <div className="mt-6">
                  <ContactCard phone="01507 602 118" email="reception@marshlanevets.co.uk"
                    address="Marsh Lane Veterinary, Marsh Lane, Louth, Lincolnshire LN11 0HP" />
                </div>
                <div className="mt-6">
                  <OpeningHours days={DAYS} />
                </div>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  Closed Sundays for routine appointments. The emergency line is answered on a
                  Sunday exactly as it is on a Tuesday night — by one of the two of us.
                </p>
              </div>
            </div>
          )
        )}
      </div>
    </SiteChrome>
  );
}
