// transactional — no marketing: form, state, confirmation. A permit renewal.
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { FormSection } from "@/components/ui/form-section";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Steps } from "@/components/ui/steps";
import { SuccessPanel } from "@/components/ui/success-panel";
export const Route = createFileRoute("/")({ component: P });
function P() {
  const [done, setDone] = useState(false);
  return (
    <div className="min-h-svh bg-background text-foreground">
      <header className="border-b border-border"><div className="mx-auto max-w-xl px-6 py-3 text-sm font-medium">Resident parking — renew permit</div></header>
      <main className="mx-auto max-w-xl px-6 py-10">
        {/* No hero, no pitch. The numbered sequence is the content. */}
        <Steps items={[
          { title: "Your permit", description: "The reference from the letter" },
          { title: "Check and pay", description: "£36 for twelve months" },
          { title: "Done", description: "Nothing to display — it's digital" }]} />
        {done ? (
          <SuccessPanel className="mt-10" title="Permit renewed to August 2027"
            description="Reference RP-88412. A receipt is in your inbox; enforcement sees it in about an hour."
            action={{ label: "Renew another", onClick: () => setDone(false) }} />
        ) : (
          <form className="mt-10 flex flex-col gap-6" onSubmit={(e) => { e.preventDefault(); setDone(true); }}>
            <FormSection title="Your permit" description="Both are on the renewal letter.">
              <div className="mt-4 grid gap-4">
                <div className="grid gap-1.5"><Label htmlFor="ref">Permit reference</Label><Input id="ref" placeholder="RP-00000" required /></div>
                <div className="grid gap-1.5"><Label htmlFor="reg">Vehicle registration</Label><Input id="reg" placeholder="YS22 ABC" required /></div>
              </div>
            </FormSection>
            <Button type="submit" className="w-fit">Continue to payment</Button>
          </form>
        )}
      </main>
    </div>
  );
}
