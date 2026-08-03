// crm/queue — one ticket, opened on its own. The record page of a help desk is
// a CONVERSATION, so the thread runs down the middle with the reply box at the
// bottom of it, and the fields a table would show sit in a rail. The one thing
// added over the family's record page: what the customer was told LAST time,
// which is the thing an agent picking this up cold has no way to know.
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ActivityFeed } from "@/components/ui/activity-feed";
import { AssigneePicker } from "@/components/ui/assignee-picker";
import { Button } from "@/components/ui/button";
import { CannedReply } from "@/components/ui/canned-reply";
import { PriorityBadge } from "@/components/ui/priority-badge";
import { RecordHeader } from "@/components/ui/record-header";
import { ReplyBox } from "@/components/ui/reply-box";
import { SlaClock } from "@/components/ui/sla-clock";
import { StatusBadge } from "@/components/ui/status-badge";
export const Route = createFileRoute("/record")({ component: P });
const PEOPLE = [
  { id: "rosa", name: "Rosa Ferreira" },
  { id: "sam", name: "Sam Whitfield" },
  { id: "ade", name: "Ade Okafor" },
];
const REPLIES = [
  { label: "Apologise for a missed slot", body: "I am sorry — that should not have happened and I can see nobody rang you, which makes it worse. Here is what I am doing about it: " },
  { label: "A real date, not 'soon'", body: "I would rather give you a date than a 'soon', so: " },
  { label: "Escalate to Rosa", body: "I am passing this to Rosa, who runs the workshop, and she will ring you before the end of today." },
];
const THREAD = [
  { id: "m1", from: "Marion Cadwallader", ours: false, at: "2026-07-30T09:12:00", when: "Thu 30 Jul, 09:12",
    body: "You said between eight and twelve and I took the morning off. Nobody came and nobody rang." },
  { id: "m2", from: "Marion Cadwallader", ours: false, at: "2026-07-30T14:41:00", when: "Thu 30 Jul, 14:41",
    body: "Tried the office twice, answerphone both times. I have a shop that cannot open without a counter." },
  { id: "m3", from: "Ade Okafor", ours: true, at: "2026-07-30T16:02:00", when: "Thu 30 Jul, 16:02",
    body: "Marion — I am so sorry. Checking with the workshop now and I will come back within the hour." },
  { id: "m4", from: "Marion Cadwallader", ours: false, at: "2026-07-31T08:30:00", when: "Fri 31 Jul, 08:30",
    body: "That was eighteen hours ago." },
];
function P() {
  const [owner, setOwner] = useState<string | null>("sam");
  const [draft, setDraft] = useState("");
  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <div className="flex items-baseline gap-3">
          <p className="text-lg font-semibold tracking-tight">Brindle Desk</p>
          <a className="text-sm text-muted-foreground hover:text-foreground" href="#/records">← Back to the queue</a>
        </div>
        <a className="text-sm text-muted-foreground hover:text-foreground" href="#/">Sign out</a>
      </header>

      <div className="mt-6">
        <RecordHeader title="Counter delivery — nobody came Tuesday" subtitle="Marion Cadwallader · Fern & Co · opened 30 Jul"
          status={<span className="inline-flex items-center gap-2"><StatusBadge state="warning">open</StatusBadge><PriorityBadge level="high" /></span>}
          actions={<span className="inline-flex gap-2"><Button size="sm">Resolve</Button><Button size="sm" variant="outline">Snooze</Button></span>} />
      </div>

      <div className="mt-6">
        <SlaClock breached="47 hours" target="first reply within 4 working hours" />
      </div>

      <div className="mt-8 grid gap-10 md:grid-cols-[3fr_2fr]">
        <div>
          {/* THE CONVERSATION IS THE RECORD — a table row's worth of fields
              is in the rail; what an agent needs is what has already been said.
              AND A PLAIN THREAD, NOT BUBBLES. This arrived by email and a chat
              bubble misrepresents it — the sender and the time are the two
              things an agent scans for, and alternating alignment makes both
              harder to find. `chat-thread` is the scroll container for an
              actual chat and it is the wrong component here. */}
          <ol className="divide-y divide-border border-y border-border">
            {THREAD.map((m) => (
              <li key={m.id} className="py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <span className={m.ours ? "text-sm text-muted-foreground" : "text-sm font-medium"}>
                    {m.from}{m.ours ? " · us" : ""}
                  </span>
                  <time className="text-xs tabular-nums text-muted-foreground" dateTime={m.at}>{m.when}</time>
                </div>
                <p className={m.ours ? "mt-1.5 text-base leading-relaxed text-muted-foreground" : "mt-1.5 text-base leading-relaxed"}>
                  {m.body}
                </p>
              </li>
            ))}
          </ol>

          <div className="mt-6 border-t border-border pt-5">
            <p className="text-sm font-medium">Reply</p>
            <CannedReply className="mt-2" replies={REPLIES} onInsert={setDraft} />
            {draft && (
              <p className="mt-2 rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground">
                Inserted: {draft}
              </p>
            )}
            <ReplyBox className="mt-3" placeholder="Write it here — the thread stays above while you type." onSubmit={() => setDraft("")} />
          </div>
        </div>

        <aside className="space-y-8">
          {/* THE THING AN AGENT PICKING THIS UP COLD CANNOT KNOW: what she was
              already promised. Without it the second apology repeats the
              first, which is how a complaint becomes a lost customer. */}
          <div className="rounded-lg border border-border bg-muted/50 p-5">
            <p className="text-sm font-medium">What she has already been told</p>
            <ul className="mt-2 space-y-2 text-sm leading-relaxed text-muted-foreground">
              <li><span className="font-medium text-foreground">Tue 28:</span> delivery slot 08:00–12:00, confirmed by text</li>
              <li><span className="font-medium text-foreground">Wed 30, 16:02:</span> Ade promised a reply "within the hour"</li>
              <li><span className="font-medium text-foreground">Nothing since.</span> Do not open with an apology she has already had — open with a date.</li>
            </ul>
          </div>

          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 rounded-xl border bg-card p-5 text-sm">
            <div><dt className="text-muted-foreground">Waiting</dt><dd className="mt-0.5 font-medium tabular-nums">2 days 3 hrs</dd></div>
            <div><dt className="text-muted-foreground">Replies from us</dt><dd className="mt-0.5 font-medium tabular-nums">1</dd></div>
            <div><dt className="text-muted-foreground">Linked job</dt><dd className="mt-0.5 font-medium">Café counter rebuild</dd></div>
            <div><dt className="text-muted-foreground">Channel</dt><dd className="mt-0.5 font-medium">Email</dd></div>
            <div className="col-span-2">
              <dt className="text-muted-foreground">Assigned to</dt>
              <dd className="mt-1"><AssigneePicker people={PEOPLE} value={owner} onChange={setOwner} /></dd>
            </div>
          </dl>

          <div>
            <h2 className="text-sm font-medium">What happened internally</h2>
            <div className="mt-3">
              <ActivityFeed items={[
                { who: "Sam Whitfield", what: "took it over from Ade", at: "2026-07-31T09:05:00" },
                { who: "Rosa Ferreira", what: "confirmed the counter is finished and was never loaded", at: "2026-07-30T17:20:00" },
                { who: "Ade Okafor", what: "replied, promising an update within the hour", at: "2026-07-30T16:02:00" },
                { who: "System", what: "SLA breached — 4 working hours passed with no reply", at: "2026-07-30T13:12:00" },
                { who: "System", what: "opened from marion@fernandco.co.uk", at: "2026-07-30T09:12:00" },
              ]} />
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
