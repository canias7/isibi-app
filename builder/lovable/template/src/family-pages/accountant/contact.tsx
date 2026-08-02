// accountant /contact — the consultation form, with who answers it and how
// fast. A firm selling trust answers the "then what happens" question before
// being asked; the office details sit beside the form, not behind a link.
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { ContactForm } from "@/components/ui/contact-form";
import { LocationCard } from "@/components/ui/location-card";
import { OpeningHours, type DayHours } from "@/components/ui/opening-hours";
import { ProfileCard } from "@/components/ui/profile-card";
export const Route = createFileRoute("/contact")({ component: P });
const CHROME = {
  name: "Hartley & Voss", tagline: "Chartered accountants, est. 1987.",
  links: [{ label: "Home", href: "#/" }, { label: "What we do", href: "#/services" }, { label: "Contact", href: "#/contact" }],
  action: { label: "Free consultation", href: "#/contact" },
};
const HOURS: DayHours[] = [
  { day: 1, label: "Monday", open: "09:00", close: "17:00" },
  { day: 2, label: "Tuesday", open: "09:00", close: "17:00" },
  { day: 3, label: "Wednesday", open: "09:00", close: "17:00" },
  { day: 4, label: "Thursday", open: "09:00", close: "17:00" },
  { day: 5, label: "Friday", open: "09:00", close: "16:00" },
  { day: 6, label: "Saturday", open: null, close: null },
  { day: 0, label: "Sunday", open: null, close: null },
];
function P() {
  const [sent, setSent] = useState(false);
  return (
    <SiteChrome {...CHROME}>
      <div className="mx-auto max-w-4xl px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-tight">Ask for the hour</h1>
        <p className="mt-2 max-w-xl text-muted-foreground">Sent before noon, you'll hear back the same working day — from a partner, because there isn't anyone else.</p>
        <div className="mt-8 grid gap-10 sm:grid-cols-2">
          <div>
            <ContactForm askPhone sent={sent} onSubmit={() => setSent(true)} />
            <div className="mt-6 grid gap-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Who reads this</p>
              <ProfileCard name="Eleanor Hartley FCA" meta="Answers business enquiries" avatar={null} />
              <ProfileCard name="Jakob Voss CTA" meta="Answers personal tax enquiries" avatar={null} />
            </div>
          </div>
          <div className="grid gap-6 self-start">
            <LocationCard name="Hartley & Voss" address="4 Paradise Square, Sheffield S1 2DE" note="The Georgian square behind the cathedral. Ring the middle bell." />
            <div className="max-w-sm"><OpeningHours days={HOURS} /></div>
            <p className="text-sm text-muted-foreground">Prefer the phone? <a className="font-medium underline underline-offset-4" href="tel:+441142751987">0114 275 1987</a> — it rings on both desks.</p>
          </div>
        </div>
      </div>
    </SiteChrome>
  );
}
