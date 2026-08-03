// crm/board — one record, opened from a card. Same record page, and the change
// is the stage strip at the top: on a board the question a card raises is
// "where is it and how long has it been there", so the record answers that
// before it answers anything else, and moving stage happens HERE too.
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
import { cn } from "@/lib/utils";
export const Route = createFileRoute("/record")({ component: P });
const PEOPLE = [
  { id: "rosa", name: "Rosa Ferreira" },
  { id: "sam", name: "Sam Whitfield" },
  { id: "ade", name: "Ade Okafor" },
];
const STAGES = [
  { key: "enquiry", label: "Enquiry", on: "23 Jul" },
  { key: "survey", label: "Survey booked", on: "24 Jul" },
  { key: "quoted", label: "Quoted", on: "25 Jul" },
  { key: "won", label: "Won", on: null },
];
function P() {
  const [owner, setOwner] = useState<string | null>("rosa");
  const [stage, setStage] = useState("quoted");
  const at = STAGES.findIndex((s) => s.key === stage);
  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <div className="flex items-baseline gap-3">
          <p className="text-lg font-semibold tracking-tight">Brindle</p>
          <a className="text-sm text-muted-foreground hover:text-foreground" href="#/records">← Back to the board</a>
        </div>
        <a className="text-sm text-muted-foreground hover:text-foreground" href="#/">Sign out</a>
      </header>

      <div className="mt-6">
        <RecordHeader title="Shop refit, full joinery" subtitle="Fern & Co · came in by phone, 23 Jul"
          status={<span className="inline-flex items-center gap-2"><StatusBadge state="warning">quoted</StatusBadge><PriorityBadge level="high" /></span>}
          actions={<span className="inline-flex gap-2"><Button size="sm">Mark won</Button><Button size="sm" variant="outline">Revise quote</Button></span>} />
      </div>

      {/* THE STAGE STRIP. A card raises one question — where is it and how long
          has it been there — so the record answers that before anything else,
          and the move happens here rather than only by dragging. */}
      <section className="mt-6 rounded-xl border border-border p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">Where it is</h2>
          <p className="text-sm">
            <span className="font-semibold">11 days</span>
            <span className="text-muted-foreground"> in Quoted — the studio's average is four</span>
          </p>
        </div>
        <ol className="mt-4 grid gap-2 sm:grid-cols-4">
          {STAGES.map((s, i) => (
            <li key={s.key}>
              <button type="button" onClick={() => setStage(s.key)} aria-current={s.key === stage ? "step" : undefined}
                className={cn("w-full cursor-pointer rounded-md border px-3 py-2.5 text-left",
                  s.key === stage ? "border-foreground bg-muted" : i < at ? "border-border" : "border-dashed border-border")}>
                <span className={cn("block text-sm", s.key === stage ? "font-semibold" : i < at ? "font-medium" : "text-muted-foreground")}>
                  {s.label}
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {s.on ? `Reached ${s.on}` : i < at ? "Done" : "Not yet"}
                </span>
              </button>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Solid is done, dashed is ahead. Clicking one moves the card, which is the same action as
          dragging it on the board — there is no separate "change stage" dialogue to lose.
        </p>
      </section>

      <div className="mt-8 grid gap-10 md:grid-cols-[3fr_2fr]">
        <div>
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
              { who: "Sam Whitfield", what: "moved to survey booked", at: "2026-07-24T08:15:00" },
              { who: "Ade Okafor", what: "logged the enquiry from the phone call", at: "2026-07-23T14:30:00" },
            ]} />
          </div>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            Every stage move is in the trail with a name against it, which is what stops "who moved
            this to won" being a conversation nobody can settle.
          </p>
        </aside>
      </div>
    </main>
  );
}
