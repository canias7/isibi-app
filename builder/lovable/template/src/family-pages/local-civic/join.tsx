// local-civic /join — getting a card: who can, what it needs, what it
// unlocks. The library's one form, kept honest to the family's register —
// utility over polish, and nobody is turned away over paperwork.
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { BusyButton } from "@/components/ui/busy-button";
import { DescriptionList } from "@/components/ui/description-list";
import { FormRow } from "@/components/ui/form-row";
import { Input } from "@/components/ui/input";
import { SuccessPanel } from "@/components/ui/success-panel";
export const Route = createFileRoute("/join")({ component: P });
const CHROME = {
  name: "Walkley Library", tagline: "Volunteer-run since 2014. Everyone welcome, no card needed to sit.",
  links: [{ label: "Hours & papers", href: "#/" }, { label: "What's on", href: "#/events" }, { label: "Join", href: "#/join" }],
};
function P() {
  const [name, setName] = useState("");
  const [postcode, setPostcode] = useState("");
  const [sent, setSent] = useState(false);
  return (
    <SiteChrome {...CHROME}>
      <div className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="text-3xl font-semibold tracking-tight">Get a card</h1>
        <p className="mt-2 text-muted-foreground">Free, five minutes, and you don't need one just to be here — the card is for taking things home.</p>
        <section className="mt-6">
          <DescriptionList items={[
            { label: "Who can join", value: "Anyone. No minimum age — babies have cards here — and no S6 requirement." },
            { label: "What it needs", value: "Your name and something with your address on it. No post in your name? Join anyway; talk to the desk." },
            { label: "What it unlocks", value: "Six books at a time (three weeks, renewable), the seed library, printer credit at cost, and the toy library on Saturdays" },
            { label: "Fines", value: "None since 2022. Bring it back when you're done; if it's very late we'll assume you loved it." },
          ]} />
        </section>
        <section className="mt-8 rounded-xl border bg-muted/40 p-5">
          <h2 className="text-lg font-medium">Start it here, finish at the desk</h2>
          {sent ? (
            <SuccessPanel className="mt-4" title="You're nearly a member" description="Show anything with your address at the desk and the card is printed while you wait. It works the same minute." action={{ label: "See what's on this month", href: "#/events" }} />
          ) : (
            <div className="mt-4 grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormRow label="Your name" htmlFor="jn-name" required>
                  <Input id="jn-name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
                </FormRow>
                <FormRow label="Postcode" htmlFor="jn-pc" required>
                  <Input id="jn-pc" autoComplete="postal-code" value={postcode} onChange={(e) => setPostcode(e.target.value)} />
                </FormRow>
              </div>
              <BusyButton className="w-fit" disabled={!name || !postcode} onClick={() => setSent(true)}>Start my card</BusyButton>
              <p className="text-xs text-muted-foreground">Rather do the whole thing in person? Just come in — <a className="font-medium underline underline-offset-4" href="#/">the hours are on the front page</a>.</p>
            </div>
          )}
        </section>
      </div>
    </SiteChrome>
  );
}
