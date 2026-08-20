// licensed-trade /tastings — the events, gated like the shelf. Compliance shapes
// this page too: the age gate wraps the bookable content, the licence terms
// for consumption on the premises are stated in the open, and "bring a
// friend" has an ID rule attached.
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { AgeGate } from "@/components/ui/age-gate";
import { EventCard } from "@/components/ui/event-card";
import { TermsBlock } from "@/components/ui/terms-block";
import { WaitlistForm } from "@/components/ui/waitlist-form";
export const Route = createFileRoute("/tastings")({ component: P });
const CHROME = {
  name: "The Dram Room", tagline: "Independent whisky, Abbeydale Road.",
  links: [{ label: "The shelf", href: "/" }, { label: "Tastings", href: "/tastings" }, { label: "Terms", href: "/terms" }],
};
function P() {
  const [joined, setJoined] = useState(false);
  return (
    <SiteChrome {...CHROME}>
      <div className="mx-auto max-w-2xl px-6 py-12">
        <AgeGate minAge={18} what="Tastings" storageKey="dram-room-age">
          <h1 className="text-2xl font-semibold tracking-tight">Tastings — six seats, twice a month</h1>
          <p className="mt-2 text-muted-foreground">Around the back table, two hours, five drams, water and bread on the house. Book at the counter or by phone; we hold nothing without a name.</p>
          <div className="mt-6 grid gap-4">
            <EventCard title="Islay, gently — an introduction to peat" start="2026-08-14T19:00:00" venue="The back table" price="£35" />
            <EventCard title="Yorkshire's new distilleries, blind" start="2026-08-28T19:00:00" venue="The back table" price="£40" soldOut />
            <EventCard title="Cask strength: water is not cheating" start="2026-09-11T19:00:00" venue="The back table" price="£45" />
          </div>
          <div className="mt-6 rounded-xl border bg-muted/40 p-5">
            {joined ? (
              <p className="text-sm">You're on the list — if a seat frees for the 28th, the email goes out the same hour, first come first back.</p>
            ) : (
              <WaitlistForm note="For the sold-out 28th — one email if a seat frees, nothing else ever." onSubmit={() => setJoined(true)} />
            )}
          </div>
        </AgeGate>
        <TermsBlock className="mt-12" title="Tastings and the licence" clauses={[
          "Tastings are consumption on the premises under licence 22/03412 — Challenge 25 applies at the door, every session, regulars included.",
          "A guest you bring is a guest we ID. Nobody under 18 may attend, participating or not.",
          "Drams are 10ml pours. Drivers: say so and your drams go home with you in miniatures instead.",
          "Drinkaware: for advice about alcohol, visit drinkaware.co.uk.",
        ]} />
      </div>
    </SiteChrome>
  );
}
