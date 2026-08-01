// booking-first /book — the booking form itself. Day, time, finish, details,
// then a summary that restates the choice BEFORE the button: the wrong-day
// booking that costs a no-show is cheapest to stop here.
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { AvailabilityGrid } from "@/components/ui/availability-grid";
import { BookingSummary } from "@/components/ui/booking-summary";
import { BusyButton } from "@/components/ui/busy-button";
import { FormRow } from "@/components/ui/form-row";
import { Input } from "@/components/ui/input";
import { RadioCards } from "@/components/ui/radio-cards";
import { SuccessPanel } from "@/components/ui/success-panel";
import { WeekStrip } from "@/components/ui/week-strip";
export const Route = createFileRoute("/book")({ component: P });
const CHROME = {
  name: "Tenfold Nails", tagline: "Ten chairs on Ecclesall Road.",
  links: [{ label: "Home", href: "#/" }, { label: "Book", href: "#/book" }],
  action: { label: "Book now", href: "#/book" },
};
function P() {
  const [day, setDay] = useState<string | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [finish, setFinish] = useState("gel");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [done, setDone] = useState(false);
  const price = { shape: 22, gel: 34, biab: 38 }[finish] ?? 0;
  if (done) {
    return (
      <SiteChrome {...CHROME}>
        <div className="mx-auto max-w-md px-6 py-20">
          <SuccessPanel title="You're booked" description="Keep the link we text you — it's the way back to move or cancel this appointment." action={{ label: "See your appointment", href: "#/manage" }} />
        </div>
      </SiteChrome>
    );
  }
  return (
    <SiteChrome {...CHROME}>
      <div className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-tight">Book a chair</h1>
        <p className="mt-2 text-muted-foreground">Pick a day and a time; we confirm by text within the hour.</p>
        <section className="mt-8">
          <h2 className="text-sm font-medium text-muted-foreground">This week</h2>
          <WeekStrip className="mt-2" start={new Date()} value={day} onSelect={(d) => { setDay(d); setSlot(null); }} />
        </section>
        {day && (
          <section className="mt-6">
            <h2 className="text-sm font-medium text-muted-foreground">Times</h2>
            <AvailabilityGrid className="mt-2" slots={["10:00", "10:45", "11:30", "12:15", "14:00", "14:45", "15:30", "16:15"]} taken={["11:30", "14:45"]} value={slot} onSelect={setSlot} />
          </section>
        )}
        <section className="mt-6">
          <h2 className="text-sm font-medium text-muted-foreground">The finish</h2>
          <RadioCards className="mt-2" columns={3} value={finish} onChange={setFinish}
            options={[
              { value: "shape", label: "Shape and paint", description: "£22 · 30 min" },
              { value: "gel", label: "Gel, full set", description: "£34 · 50 min" },
              { value: "biab", label: "BIAB overlay", description: "£38 · 60 min" },
            ]} />
        </section>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <FormRow label="Your name" htmlFor="bk-name" required>
            <Input id="bk-name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
          </FormRow>
          <FormRow label="Mobile" htmlFor="bk-phone" hint="For the confirmation text only." required>
            <Input id="bk-phone" type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </FormRow>
        </div>
        {day && slot && (
          <BookingSummary className="mt-8" total={price}
            items={[
              { label: "Day", value: day },
              { label: "Time", value: slot },
              { label: "Finish", value: { shape: "Shape and paint", gel: "Gel, full set", biab: "BIAB overlay" }[finish] },
            ]}
            footer={<BusyButton className="w-full" disabled={!name || !phone} onClick={() => setDone(true)}>Confirm booking</BusyButton>} />
        )}
      </div>
    </SiteChrome>
  );
}
