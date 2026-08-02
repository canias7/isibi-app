// paid-newsletter /account — the membership itself: what you're on, when it
// renews, how to leave. Cancelling is a visible button that says what
// actually happens, because a membership site that hides the exit is the
// pattern regulators and ex-members both remember.
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { Button } from "@/components/ui/button";
import { MembershipCard } from "@/components/ui/membership-card";
import { PlanCard } from "@/components/ui/plan-card";
import { SuccessPanel } from "@/components/ui/success-panel";
export const Route = createFileRoute("/account")({ component: P });
const CHROME = {
  name: "The Crucible Letter", tagline: "Sheffield theatre, reviewed weekly.",
  links: [{ label: "This week", href: "#/letters" }, { label: "Your membership", href: "#/account" }],
};
function P() {
  const [asking, setAsking] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  return (
    <SiteChrome {...CHROME}>
      <div className="mx-auto max-w-md px-6 py-14">
        <h1 className="text-2xl font-semibold tracking-tight">Your membership</h1>
        <MembershipCard className="mt-6" name="Priya Shah" tier="Annual" number="CL-01427" since="2025-10-04" expires="2026-10-04" />
        {cancelled ? (
          <SuccessPanel className="mt-6" title="Auto-renew is off" description="You keep every letter until 4 October 2026. Nothing is charged after that, and rejoining later picks the archive back up." action={{ label: "Back to this week's letter", href: "#/letters" }} />
        ) : (
          <>
            <PlanCard className="mt-6" name="Annual" price="£36" period="year" renewsOn="4 October 2026" current
              action={{ label: "Switch to monthly", onClick: () => {} }} />
            <div className="mt-6 grid gap-2">
              <Button variant="outline" asChild><a href="#/letters">Back to the letters</a></Button>
              {asking ? (
                <div className="rounded-lg border p-3 text-sm">
                  <p>Turn off auto-renew? You keep access until 4 October 2026 — nothing disappears today.</p>
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" variant="destructive" onClick={() => setCancelled(true)}>Turn it off</Button>
                    <Button size="sm" variant="ghost" onClick={() => setAsking(false)}>Keep renewing</Button>
                  </div>
                </div>
              ) : (
                <Button variant="ghost" className="text-muted-foreground" onClick={() => setAsking(true)}>Cancel membership</Button>
              )}
            </div>
          </>
        )}
        <p className="mt-8 text-xs text-muted-foreground">Receipts go to priya@…co.uk after each renewal. Change the address by replying to any letter — a person reads them.</p>
      </div>
    </SiteChrome>
  );
}
