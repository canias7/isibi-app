// crm — one record opened fully. The header carries the status and the
// actions; the fields sit where they can be read; the activity trail says who
// did what and when. Edits happen HERE, where the record is read — there is no
// separate edit mode to get lost in.
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ActivityFeed } from "@/components/ui/activity-feed";
import { AssigneePicker } from "@/components/ui/assignee-picker";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/money";
import { PriorityBadge } from "@/components/ui/priority-badge";
import { RecordHeader } from "@/components/ui/record-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { Textarea } from "@/components/ui/textarea";
export const Route = createFileRoute("/record")({ component: P });

const PEOPLE = [
  { id: "rosa", name: "Rosa Ferreira" },
  { id: "sam", name: "Sam Whitfield" },
  { id: "ade", name: "Ade Okafor" },
];

function P() {
  const [owner, setOwner] = useState<string | null>("rosa");
  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <div className="flex items-baseline gap-3">
          <p className="text-lg font-semibold tracking-tight">Brindle</p>
          <a className="text-sm text-muted-foreground hover:text-foreground" href="/records">← All records</a>
        </div>
        <a className="text-sm text-muted-foreground hover:text-foreground" href="/">Sign out</a>
      </header>

      <div className="mt-6">
        <RecordHeader title="Shop refit, full joinery" subtitle="Fern & Co · came in by phone, 23 Jul"
          status={<span className="inline-flex items-center gap-2"><StatusBadge state="warning">quoted</StatusBadge><PriorityBadge level="high" /></span>}
          actions={<span className="inline-flex gap-2"><Button size="sm">Mark won</Button><Button size="sm" variant="outline">Revise quote</Button></span>} />
      </div>

      <div className="mt-8 grid gap-10 md:grid-cols-[3fr_2fr]">
        <div>
          {/* The fields, readable first — a definition list, not a form maze. */}
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 rounded-xl border bg-card p-5 text-sm">
            <div><dt className="text-muted-foreground">Value</dt><dd className="mt-0.5 font-medium"><Money amount={24800} /></dd></div>
            <div><dt className="text-muted-foreground">Margin at quote</dt><dd className="mt-0.5 font-medium">31%</dd></div>
            <div><dt className="text-muted-foreground">Quote sent</dt><dd className="mt-0.5 font-medium">25 Jul — QUO-118</dd></div>
            <div><dt className="text-muted-foreground">Decision expected</dt><dd className="mt-0.5 font-medium">this Friday</dd></div>
            <div><dt className="text-muted-foreground">Site</dt><dd className="mt-0.5 font-medium">44 Cockburn Street</dd></div>
            <div>
              <dt className="text-muted-foreground">Owner</dt>
              <dd className="mt-1"><AssigneePicker people={PEOPLE} value={owner} onChange={setOwner} /></dd>
            </div>
          </dl>

          <div className="mt-6">
            <p className="text-sm font-medium">Add a note</p>
            <Textarea className="mt-2" rows={3} placeholder="Rang Fern — they want the counter in oak after all…" />
            <Button size="sm" className="mt-2" variant="outline">Note it</Button>
          </div>
        </div>

        <aside>
          <h2 className="text-sm font-medium">Activity</h2>
          <div className="mt-3">
            <ActivityFeed items={[
              { who: "Rosa Ferreira", what: "revised the quote to £24,800 — oak counter swapped in", at: "2026-07-30T16:20:00" },
              { who: "Sam Whitfield", what: "site visit done; measured the back room properly this time", at: "2026-07-26T11:05:00" },
              { who: "Rosa Ferreira", what: "moved to quoted and sent QUO-118", at: "2026-07-25T09:40:00" },
              { who: "Ade Okafor", what: "logged the enquiry from the phone call", at: "2026-07-23T14:30:00" },
            ]} />
          </div>
        </aside>
      </div>
    </main>
  );
}
