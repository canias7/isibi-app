// crm/queue — HELP DESK. The door, showing the surface this variant leads with:
// an inbox rather than a table. Same one-screen sign-in as the family, and the
// pitch is the one thing a support tool is bought on — how long people wait.
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SafeImage } from "@/components/ui/safe-image";
import { StatusBadge } from "@/components/ui/status-badge";
export const Route = createFileRoute("/queue")({ component: P });
function P() {
  return (
    <main className="grid min-h-screen md:grid-cols-2">
      <section className="flex flex-col justify-between border-b border-border bg-muted/40 p-10 md:border-b-0 md:border-e">
        <p className="text-lg font-semibold tracking-tight">Brindle Desk</p>
        <div className="max-w-md py-12">
          <h1 className="text-3xl font-semibold tracking-tight text-balance">
            One inbox, oldest unanswered first, and you reply where you read
          </h1>
          <p className="mt-4 text-muted-foreground">
            Brindle Desk is support for small teams. Everything arrives in one queue ordered by how
            long somebody has been waiting — not by who shouted, not by a status field, and never
            newest-first, which is how the oldest ticket becomes a fortnight old.
          </p>
          {/* THE QUEUE, not a table. Somebody signing in to a support tool
              wants to see the inbox they will spend the day in. */}
          <SafeImage className="mt-8" src={null} alt="The queue, oldest unanswered first" ratio="16/10" />
          <ul className="mt-8 space-y-4 text-sm">
            <li className="flex items-start gap-3"><StatusBadge state="success">live</StatusBadge><span>Reply in the same pane you read in — no separate compose window</span></li>
            <li className="flex items-start gap-3"><StatusBadge state="success">live</StatusBadge><span>Waiting time on every row, and the oldest is always at the top</span></li>
            <li className="flex items-start gap-3"><StatusBadge state="neutral">soon</StatusBadge><span>Saved replies shared across the team rather than per-person</span></li>
          </ul>
        </div>
        <p className="text-xs text-muted-foreground">Your data stays yours — export every thread to CSV or mbox any day, no lock-in theatre.</p>
      </section>

      <section className="flex items-center justify-center p-10">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Sign in</CardTitle>
            <CardDescription>Straight into the queue, wherever you left it.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="q-email">Work email</Label>
              <Input id="q-email" type="email" autoComplete="email" placeholder="you@studio.co" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="q-pass">Password</Label>
              <Input id="q-pass" type="password" autoComplete="current-password" />
            </div>
            <Button className="w-full" asChild><a href="/records">Sign in</a></Button>
            <p className="text-center text-sm text-muted-foreground">
              <a className="underline underline-offset-4" href="/records">Forgotten it?</a>
            </p>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
