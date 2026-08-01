// transactional /done — the confirmation as a designed page: the reference
// where it can be copied, the receipt, what happens next. The taxonomy calls
// terminal states "pages, not afterthoughts"; this is that page.
import { createFileRoute } from "@tanstack/react-router";
import { CopyButton } from "@/components/ui/copy-button";
import { Receipt } from "@/components/ui/receipt";
import { Steps } from "@/components/ui/steps";
import { SuccessPanel } from "@/components/ui/success-panel";
export const Route = createFileRoute("/done")({ component: P });
function P() {
  return (
    <div className="min-h-svh bg-background text-foreground">
      <header><div className="mx-auto max-w-xl px-6 py-3 text-sm font-medium">Resident parking — renewed</div></header>
      <main className="mx-auto max-w-xl px-6 py-10">
        <SuccessPanel title="Permit renewed to August 2027" description="Nothing to display in the windscreen — enforcement reads the plate." />
        <div className="mt-6 flex items-center justify-between rounded-lg border p-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Your reference</p>
            <p className="mt-0.5 font-mono text-lg font-medium">RP-88412</p>
          </div>
          <CopyButton value="RP-88412" />
        </div>
        <Receipt className="mt-8" number="RP-88412" business="Sheffield City Council — Parking" paidAt="2026-08-01T11:24:00" total={36} method="Card" last4="4417" items={[{ label: "Resident permit, 12 months", amount: 36 }]} />
        <section className="mt-8">
          <h2 className="text-sm font-medium text-muted-foreground">What happens now</h2>
          <Steps className="mt-3" items={[
            { title: "Within the hour", description: "Enforcement systems see the new expiry." },
            { title: "Today", description: "The receipt above lands in your inbox too." },
            { title: "Next July", description: "The renewal letter goes out four weeks before expiry." },
          ]} />
        </section>
        <p className="mt-8 text-sm text-muted-foreground">Check on it any time at <a className="font-medium underline underline-offset-4" href="#/status">application status</a>.</p>
      </main>
    </div>
  );
}
