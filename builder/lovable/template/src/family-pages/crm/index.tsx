// crm — signed-in software rather than a website, so the front door is
// ONE screen: what the tool is, the proof it works, and the sign-in itself.
// No marketing site attached — the product is behind the door, and the door
// opens straight onto the records.
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/ui/status-badge";
import { SafeImage } from "@/components/ui/safe-image";
export const Route = createFileRoute("/")({ component: P });

function P() {
  const navigate = useNavigate();
  return (
    <main className="grid min-h-screen md:grid-cols-2">
      {/* The pitch half — three sentences and the product, not a site. */}
      <section className="flex flex-col justify-between border-b border-border bg-muted/40 p-10 md:border-b-0 md:border-r">
        <p className="text-lg font-semibold tracking-tight">Brindle</p>
        <div className="max-w-md py-12">
          <h1 className="text-3xl font-semibold tracking-tight text-balance">Every enquiry, quote and job — one table your whole studio reads</h1>
          <p className="mt-4 text-muted-foreground">Brindle is the CRM for five-person firms: enquiries land as records, quotes move through stages, and nothing lives in anyone's inbox.</p>
          {/* The product, on the page that asks for a password. Added
              2026-08-02: the pitch half was three sentences and a feature list,
              which is the one thing a tool cannot be sold on — somebody
              deciding whether to sign in wants to see the table they are
              signing in to. */}
          <SafeImage className="mt-8" src={null} alt="The pipeline, as a table" ratio="16/10" />
          <ul className="mt-8 space-y-4 text-sm">
            <li className="flex items-start gap-3"><StatusBadge state="success">live</StatusBadge><span>The pipeline, as a table or a board — same records either way</span></li>
            <li className="flex items-start gap-3"><StatusBadge state="success">live</StatusBadge><span>Every record carries its own activity trail — who said what, when</span></li>
            <li className="flex items-start gap-3"><StatusBadge state="neutral">soon</StatusBadge><span>Quotes rendered to PDF from the record itself</span></li>
          </ul>
        </div>
        <p className="text-xs text-muted-foreground">Your data stays yours — export everything to CSV any day, no lock-in theatre.</p>
      </section>

      {/* The door itself. In the product this is the real sign-in. */}
      <section className="flex items-center justify-center p-10">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Sign in</CardTitle>
            <CardDescription>Back to the pipeline in one field and a click.</CardDescription>
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
            <Button onClick={() => { navigate({ to: "/records" }); }}>Sign in</Button>
            <p className="text-center text-xs text-muted-foreground">One error message for the whole form, on purpose — <a className="underline underline-offset-4" href="/records">or just look around the demo</a>.</p>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
