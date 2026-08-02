// wedding /registry — the gifts, put the intimate way: a few real things, a
// honeymoon pot, and genuine permission to bring nothing. The register stays
// wedding — no shop chrome, no progress bars against a target.
import { createFileRoute } from "@tanstack/react-router";
import { LinkCard } from "@/components/ui/link-card";
import { Quote } from "@/components/ui/quote";
export const Route = createFileRoute("/registry")({ component: P });
function P() {
  return (
    <div className="min-h-svh bg-background text-foreground">
      <main className="mx-auto max-w-xl px-6 py-16">
        <p className="text-center text-xs uppercase tracking-widest text-muted-foreground">12 September 2026 · Wortley Hall</p>
        <h1 className="mt-3 text-center text-4xl font-semibold tracking-tight">Gifts</h1>
        <p className="mt-3 text-center text-sm text-muted-foreground"><a className="underline underline-offset-4" href="#/">← Back to the main page</a> · <a className="underline underline-offset-4" href="#/travel">getting there</a></p>
        <Quote className="mt-10">Your being there is the present. We mean it — half of you are crossing the country. But since some of you will ignore that sentence:</Quote>
        <section className="mt-8 grid gap-3">
          <LinkCard title="The honeymoon pot" description="Three weeks in Japan next spring. Any amount buys us a train, a meal, or one night we'll tell you about forever." href="#/registry" />
          <LinkCard title="A tree for the allotment" description="£15 with the orchard project — we plant it in October and it outlives us all." href="#/registry" external />
          <LinkCard title="The actual list" description="Eleven real things for the house, £10–£60, at the shop on Sharrow Vale. Tell Dot you're ours and she'll cross it off." href="#/registry" external />
        </section>
        <section className="mt-10 rounded-xl border bg-muted/40 p-5 text-center text-sm text-muted-foreground">
          <p>Please, no boxed gifts on the day — we're leaving the hall by taxi and June is not holding a toaster in her dress.</p>
          <p className="mt-2">And if money is tight this year: come, dance, write us something in the book. That's the one everyone keeps.</p>
        </section>
      </main>
    </div>
  );
}
