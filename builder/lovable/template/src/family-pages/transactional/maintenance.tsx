// transactional /maintenance — the down-for-works page, designed on purpose.
// The taxonomy's own words: 404 and maintenance are "micro-layouts worth
// designing". This one answers the three questions a blocked resident has —
// when is it back, what still works, who do I ring — and nothing else.
import { createFileRoute } from "@tanstack/react-router";
import { MaintenancePage } from "@/components/ui/maintenance-page";
import { NotFound } from "@/components/ui/not-found";
export const Route = createFileRoute("/maintenance")({ component: P });
function P() {
  return (
    <div className="min-h-svh bg-background text-foreground">
      <header className="border-b border-border"><div className="mx-auto max-w-xl px-6 py-3 text-sm font-medium">Resident parking</div></header>
      <main className="mx-auto max-w-xl px-6">
        <MaintenancePage
          backAt="2026-08-02T06:00:00"
          body="Renewals and new applications are paused while the permit database moves. Nothing is lost; nothing needs re-entering."
          contact={{ label: "Urgent? Ring the parking desk — 0114 273 4567", href: "tel:+441142734567" }}
        />
        <section className="rounded-lg border bg-muted/40 p-4 text-sm">
          <p className="font-medium">While this is down</p>
          <ul className="mt-2 grid gap-1.5 text-muted-foreground">
            <li>Your current permit stays valid — enforcement knows about the works.</li>
            <li>A permit expiring tonight gets an automatic 48-hour grace.</li>
            <li>Applications already submitted keep their place in the queue.</li>
          </ul>
        </section>
        {/* The other micro-layout, shown for what it is: what a wrong link gets
            on this site — a way home and a way to a human, never a dead end. */}
        <section className="mt-12 border-t pt-8">
          <p className="mb-2 text-center text-xs uppercase tracking-widest text-muted-foreground">And a wrong link lands here</p>
          <div className="rounded-lg border">
            <NotFound homeHref="#/" body="The link may be from an old letter — renewals moved here in June." />
          </div>
        </section>
        <p className="py-8 text-center text-sm text-muted-foreground"><a className="font-medium underline underline-offset-4" href="#/">Back to the renewal form</a></p>
      </main>
    </div>
  );
}
