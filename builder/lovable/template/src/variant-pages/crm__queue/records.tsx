// crm/queue — THE INBOX IS THE WORK SURFACE, and it is ordered by how long
// somebody has been waiting. The records-first family sorts by whatever column
// you click; a support queue has exactly one correct default, and it is oldest
// unanswered first — newest-first is how a ticket quietly becomes a fortnight
// old. You reply in the pane you read in, because a separate compose window is
// where context goes to be retyped.
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CannedReply } from "@/components/ui/canned-reply";
import { FilterBar } from "@/components/ui/filter-bar";
import { InboxList } from "@/components/ui/inbox-list";
import { PriorityBadge } from "@/components/ui/priority-badge";
import { ReplyBox } from "@/components/ui/reply-box";
import { SlaClock } from "@/components/ui/sla-clock";
import { StatusBadge } from "@/components/ui/status-badge";
import { TableSearch } from "@/components/ui/table-search";
export const Route = createFileRoute("/records")({ component: P });
type Ticket = {
  id: string; from: string; company: string; subject: string; preview: string;
  waitingHours: number; priority: "high" | "medium" | "low"; state: "new" | "open" | "waiting";
  unread: boolean; body: string[];
};
const TICKETS: Ticket[] = [
  { id: "t1", from: "Marion Cadwallader", company: "Fern & Co", subject: "Counter delivery — nobody came Tuesday",
    preview: "You said between eight and twelve and I took the morning off…", waitingHours: 51, priority: "high", state: "open", unread: true,
    body: ["You said between eight and twelve and I took the morning off. Nobody came and nobody rang.",
           "I have tried the office number twice since and got the answerphone both times. I need to know whether this is happening this week or not, because I have a shop that cannot open without a counter."] },
  { id: "t2", from: "Dev Raval", company: "Corner Room", subject: "Invoice QUO-118 — VAT looks wrong",
    preview: "The total says £24,800 but the VAT line is 19%…", waitingHours: 27, priority: "medium", state: "open", unread: true,
    body: ["The total says £24,800 but the VAT line on it is 19% rather than 20%. Could you re-issue it? Our accountant will not take it as it stands."] },
  { id: "t3", from: "Yvonne Best", company: "Hillcrest House", subject: "Can we change the wardrobe handles?",
    preview: "We picked the brass ones and my husband has gone off them…", waitingHours: 19, priority: "low", state: "open", unread: false,
    body: ["We picked the brass ones and my husband has gone off them. Is it too late to change to the black? Happy to pay the difference if there is one."] },
  { id: "t4", from: "Alan Shirtcliffe", company: "Walkley Library", subject: "Shelving — the 14m quote",
    preview: "Chasing this one, we have a committee on Thursday…", waitingHours: 8, priority: "high", state: "new", unread: true,
    body: ["Chasing this one — we have a committee on Thursday and I need a number to put in front of them, even a rough one."] },
  { id: "t5", from: "Priya Sanghera", company: "The Wire Mill", subject: "Elm for the bar front",
    preview: "You mentioned reclaimed elm. Where is it from?", waitingHours: 4, priority: "low", state: "open", unread: false,
    body: ["You mentioned reclaimed elm when you came round. Where is it actually from? We would like to put a line about it on the menu if it has a story."] },
  { id: "t6", from: "Tom Bramley", company: "Hollin House", subject: "Kitchen island — waiting on your measurements",
    preview: "Sent the drawings on the 28th, no rush from our end", waitingHours: 62, priority: "low", state: "waiting", unread: false,
    body: ["Sent the drawings on the 28th. No rush from our end — we are not moving in until October, so whenever suits."] },
];
const REPLIES = [
  { label: "Apologise for a missed slot", body: "I am sorry — that should not have happened and I can see nobody rang you, which makes it worse. Here is what I am doing about it: " },
  { label: "Re-issue an invoice", body: "You are right, and thank you for spotting it. A corrected invoice is on its way and the old one is cancelled — nothing to do at your end." },
  { label: "Yes, and no charge", body: "Yes, that is fine and there is no charge for the change. I have made a note on the job." },
  { label: "A real date, not 'soon'", body: "I would rather give you a date than a 'soon', so: " },
];
function P() {
  const [q, setQ] = useState("");
  const [id, setId] = useState<string | null>("t1");
  const [draft, setDraft] = useState("");
  // OLDEST UNANSWERED FIRST — and UNANSWERED is the load-bearing word. Sorting
  // on the raw wait put a ticket we are waiting on the CUSTOMER for at the top,
  // above a 47-hour breach, because it had sat longer. Its clock is paused; it
  // is not unanswered, it is answered and waiting. Found by rendering the page
  // and reading its own first row against its own headline.
  const sorted = [...TICKETS].sort((a, b) => {
    const paused = (t: Ticket) => (t.state === "waiting" ? 1 : 0);
    return paused(a) - paused(b) || b.waitingHours - a.waitingHours;
  });
  const oldestLive = sorted.find((t) => t.state !== "waiting") ?? sorted[0];
  const shown = sorted.filter((t) => (t.from + t.company + t.subject).toLowerCase().includes(q.toLowerCase()));
  const open = shown.find((t) => t.id === id) ?? shown[0] ?? null;
  const hours = (n: number) => (n >= 48 ? `${Math.floor(n / 24)} days` : n >= 24 ? "a day" : `${n} hours`);
  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <div className="flex items-baseline gap-3">
          <p className="text-lg font-semibold tracking-tight">Brindle Desk</p>
          <span className="text-sm text-muted-foreground">Queue</span>
        </div>
        <nav className="flex items-center gap-4 text-sm">
          <a className="font-medium" href="#/records" aria-current="page">Queue</a>
          <a className="text-muted-foreground hover:text-foreground" href="#/record">Open ticket</a>
          <a className="text-muted-foreground hover:text-foreground" href="#/">Sign out</a>
        </nav>
      </header>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <TableSearch value={q} onChange={setQ} placeholder="Search people, companies, subjects" count={shown.length} total={TICKETS.length} />
        <FilterBar filters={[{ key: "unresolved", label: "Unresolved" }, { key: "mine", label: "Mine and unassigned" }]} onRemove={() => {}} onClear={() => {}} />
      </div>

      {/* THE ORDER IS THE FEATURE, so it is stated rather than left to be
          inferred from a sort arrow nobody notices. */}
      <p className="mt-3 text-sm text-muted-foreground">
        Oldest unanswered first — <span className="font-medium text-foreground">{hours(oldestLive.waitingHours)}</span> at
        the top. Anything we are waiting on the customer for drops to the bottom with its clock
        paused, because it is answered rather than old. Sorting by anything else is how the oldest
        one becomes a fortnight old.
      </p>

      <div className="mt-4 grid gap-6 lg:grid-cols-[380px_1fr]">
        <div className="rounded-lg border border-border">
          <InboxList selected={open?.id ?? null} onSelect={setId} empty="Nothing in the queue — genuinely, not a filter."
            items={shown.map((t) => ({
              id: t.id,
              title: `${t.from} · ${t.company}`,
              preview: `${t.subject} — waiting ${hours(t.waitingHours)}`,
              at: t.waitingHours >= 24 ? `${Math.floor(t.waitingHours / 24)}d` : `${t.waitingHours}h`,
              unread: t.unread,
            }))} />
        </div>

        {/* REPLY WHERE YOU READ. The whole variant: a separate compose window
            is where the context somebody just read gets retyped from memory. */}
        {open ? (
          <section className="rounded-lg border border-border p-6">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-4">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold tracking-tight">{open.subject}</h2>
                <p className="mt-0.5 text-sm text-muted-foreground">{open.from} · {open.company}</p>
              </div>
              <span className="inline-flex flex-wrap items-center gap-2">
                <StatusBadge state={open.state === "new" ? "neutral" : open.state === "waiting" ? "neutral" : "warning"}>{open.state}</StatusBadge>
                <PriorityBadge level={open.priority} />
              </span>
            </div>

            <div className="mt-4">
              {open.state === "waiting" ? (
                <SlaClock paused pausedReason="waiting on the customer — the clock is stopped and that is why this is not at the top"
                  target="first reply within 4 working hours" />
              ) : open.waitingHours > 4 ? (
                <SlaClock breached={`${open.waitingHours - 4} hours`} target="first reply within 4 working hours" />
              ) : (
                <SlaClock remaining={`${4 - open.waitingHours} hours`} target="first reply within 4 working hours" />
              )}
            </div>

            <div className="mt-5 space-y-3 text-base leading-relaxed">
              {open.body.map((p) => <p key={p}>{p}</p>)}
            </div>

            <div className="mt-6 border-t border-border pt-5">
              <p className="text-sm font-medium">Reply</p>
              <CannedReply className="mt-2" replies={REPLIES} onInsert={setDraft} />
              {draft && (
                <p className="mt-2 rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground">
                  Inserted: {draft}
                </p>
              )}
              <ReplyBox className="mt-3" placeholder="Write it here — the thread is above and stays above." onSubmit={() => setDraft("")} />
              <p className="mt-2 text-xs text-muted-foreground">
                ⌘↵ sends. Saved replies fill the box rather than sending on their own, because
                nobody has ever wanted a canned reply to leave without being read.
              </p>
            </div>
          </section>
        ) : (
          <section className="rounded-lg border border-dashed border-border p-10 text-center">
            <p className="text-base font-medium">Nothing matches that search</p>
            <p className="mt-1 text-sm text-muted-foreground">The queue itself is not empty — clear the box above.</p>
          </section>
        )}
      </div>
    </main>
  );
}
