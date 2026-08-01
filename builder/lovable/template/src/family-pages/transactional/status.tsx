// transactional /status — an existing application, looked up and answered
// plainly. The state machine is the content: where it is, what happens next,
// and the one thing the resident can still do about it.
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { FormProgress } from "@/components/ui/form-progress";
import { FormRow } from "@/components/ui/form-row";
import { Input } from "@/components/ui/input";
import { StatusDot } from "@/components/ui/status-dot";
export const Route = createFileRoute("/status")({ component: P });
function P() {
  const [ref, setRef] = useState("");
  const [found, setFound] = useState(false);
  return (
    <div className="min-h-svh bg-background text-foreground">
      <header><div className="mx-auto flex max-w-xl items-center justify-between px-6 py-3 text-sm"><span className="font-medium">Resident parking — application status</span><a className="text-muted-foreground underline underline-offset-4" href="#/">Renew instead</a></div></header>
      <main className="mx-auto max-w-xl px-6 py-10">
        {found ? (
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h1 className="text-xl font-semibold tracking-tight">RP-88412</h1>
              <StatusDot state="pending" label="Being checked" />
            </div>
            <FormProgress className="mt-6" current={1} steps={["Received — 29 July", "Checks — vehicle and address", "Decision — posted and emailed"]} />
            <div className="mt-8 rounded-lg border bg-muted/40 p-4 text-sm">
              <p className="font-medium">What "checks" means</p>
              <p className="mt-1 text-muted-foreground">We confirm the vehicle is registered at the address. It takes two working days; most of that is the DVLA's.</p>
            </div>
            <p className="mt-6 text-sm text-muted-foreground">Wrong registration on the application? <a className="font-medium underline underline-offset-4" href="#/">Start a fresh renewal</a> — it replaces this one automatically.</p>
            <Button variant="ghost" className="mt-6 text-muted-foreground" onClick={() => setFound(false)}>Check a different reference</Button>
          </div>
        ) : (
          <div>
            <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); setFound(true); }}>
              <h1 className="text-xl font-semibold tracking-tight">Where is my application?</h1>
              <FormRow label="Application reference" htmlFor="st-ref" hint="On the confirmation email — starts RP-." required>
                <Input id="st-ref" placeholder="RP-00000" value={ref} onChange={(e) => setRef(e.target.value)} />
              </FormRow>
              <Button type="submit" className="w-fit" disabled={!ref}>Look it up</Button>
            </form>
            {/* The three states, explained before anyone has to ask. */}
            <dl className="mt-10 grid gap-3 border-t pt-6 text-sm">
              <div><dt className="font-medium">Received</dt><dd className="text-muted-foreground">It's in the queue. Nothing is needed from you.</dd></div>
              <div><dt className="font-medium">Being checked</dt><dd className="text-muted-foreground">Vehicle and address are being confirmed — two working days, most of it the DVLA's.</dd></div>
              <div><dt className="font-medium">Decided</dt><dd className="text-muted-foreground">The result is in your inbox and the post. A refusal says exactly why, and how to appeal.</dd></div>
            </dl>
          </div>
        )}
      </main>
    </div>
  );
}
