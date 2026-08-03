// crm/board — the door, unchanged in shape and changed in what it shows. A
// tool sold on a BOARD has to show the board on the page that asks for a
// password: somebody deciding whether to sign in wants to see the surface they
// are signing in to, and a table screenshot sells a different product.
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SafeImage } from "@/components/ui/safe-image";
import { StatusBadge } from "@/components/ui/status-badge";
export const Route = createFileRoute("/board")({ component: P });
function P() {
  return (
    <main className="grid min-h-screen md:grid-cols-2">
      <section className="flex flex-col justify-between border-b border-border bg-muted/40 p-10 md:border-b-0 md:border-r">
        <p className="text-lg font-semibold tracking-tight">Brindle</p>
        <div className="max-w-md py-12">
          <h1 className="text-3xl font-semibold tracking-tight text-balance">
            Every job on one board, and the column it is stuck in is the whole report
          </h1>
          <p className="mt-4 text-muted-foreground">
            Brindle is the CRM for five-person firms that work in stages. Enquiries land in the
            first column and somebody drags them along — and the column with fourteen cards in it
            is a problem you can see from the doorway.
          </p>
          {/* THE BOARD, not the table. Same product, and the screenshot on the
              sign-in page has to be the surface this variant leads with. */}
          <SafeImage className="mt-8" src={null} alt="The pipeline, as a board" ratio="16/10" />
          <ul className="mt-8 space-y-4 text-sm">
            <li className="flex items-start gap-3"><StatusBadge state="success">live</StatusBadge><span>Drag between stages, and a column that is over its limit says so</span></li>
            <li className="flex items-start gap-3"><StatusBadge state="success">live</StatusBadge><span>The same records as a table whenever you want the numbers</span></li>
            <li className="flex items-start gap-3"><StatusBadge state="neutral">soon</StatusBadge><span>Quotes rendered to PDF from the card itself</span></li>
          </ul>
        </div>
        <p className="text-xs text-muted-foreground">Your data stays yours — export everything to CSV any day, no lock-in theatre.</p>
      </section>

      <section className="flex items-center justify-center p-10">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Sign in</CardTitle>
            <CardDescription>Back to the board in one field and a click.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="ws-email">Work email</Label>
              <Input id="ws-email" type="email" autoComplete="email" placeholder="you@studio.co" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ws-pass">Password</Label>
              <Input id="ws-pass" type="password" autoComplete="current-password" />
            </div>
            <Button className="w-full" asChild><a href="#/records">Sign in</a></Button>
            <p className="text-center text-sm text-muted-foreground">
              <a className="underline underline-offset-4" href="#/records">Forgotten it?</a>
            </p>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
