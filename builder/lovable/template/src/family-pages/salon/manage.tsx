// salon /manage — an existing appointment, reached from the claim link
// in the confirmation text. View it, move it, cancel it; cancelling asks
// once and then says so plainly. No account anywhere — the link IS the key.
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { BookingSummary } from "@/components/ui/booking-summary";
import { Button } from "@/components/ui/button";
import { StatusDot } from "@/components/ui/status-dot";
import { SuccessPanel } from "@/components/ui/success-panel";
export const Route = createFileRoute("/manage")({ component: P });
const CHROME = {
  name: "Tenfold Nails", tagline: "Ten chairs on Ecclesall Road.",
  links: [{ label: "Home", href: "/" }, { label: "Book", href: "/book" }],
  action: { label: "Book now", href: "/book" },
};
function P() {
  const [cancelled, setCancelled] = useState(false);
  const [asking, setAsking] = useState(false);
  if (cancelled) {
    return (
      <SiteChrome {...CHROME}>
        <div className="mx-auto max-w-md px-6 py-20">
          <SuccessPanel title="Appointment cancelled" description="The chair is released. Book again whenever suits — no fee either way." action={{ label: "Book another time", href: "/book" }} />
        </div>
      </SiteChrome>
    );
  }
  return (
    <SiteChrome {...CHROME}>
      <div className="mx-auto max-w-md px-6 py-14">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">Your appointment</h1>
          <StatusDot state="on" label="Confirmed" />
        </div>
        <BookingSummary className="mt-6" total={34}
          items={[
            { label: "When", value: "Thursday 6 August, 14:45" },
            { label: "Finish", value: "Gel, full set" },
            { label: "With", value: "Sofia Petrov" },
            { label: "Where", value: "312 Ecclesall Road" },
          ]} />
        <div className="mt-6 grid gap-2">
          <Button variant="outline" asChild><a href="/book">Move to another time</a></Button>
          {asking ? (
            <div className="rounded-lg border p-3 text-sm">
              <p>Cancel Thursday's appointment? The slot goes back up straight away.</p>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="destructive" onClick={() => setCancelled(true)}>Yes, cancel it</Button>
                <Button size="sm" variant="ghost" onClick={() => setAsking(false)}>Keep it</Button>
              </div>
            </div>
          ) : (
            <Button variant="ghost" className="text-muted-foreground" onClick={() => setAsking(true)}>Cancel this appointment</Button>
          )}
        </div>
        <p className="mt-8 text-xs text-muted-foreground">This page is yours through the link in your confirmation text — anyone with the link can change the booking, so don't pass it on.</p>
      </div>
    </SiteChrome>
  );
}
