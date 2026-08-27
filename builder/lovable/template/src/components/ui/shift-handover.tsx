import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
/**
 * Writing the handover — three boxes, and one of them is compulsory.
 *
 * "OUTSTANDING" IS REQUIRED, EVEN IF THE ANSWER IS "NOTHING", and there is a
 * button for that. A blank field cannot be told from an unfinished one, so
 * making somebody actively say nothing-outstanding is the difference between a
 * handover that can be trusted and one that has to be double-checked by phone.
 *
 * THE THREE BOXES MATCH `handoff-summary` EXACTLY, so what is written is what
 * the next person reads — a composer whose shape differs from the display is
 * how a section quietly goes unread for months.
 *
 * IT NAMES WHO IT GOES TO. A handover addressed to nobody is one everybody
 * assumes somebody else has read, which is the failure mode of a shared
 * noticeboard.
 *
 * ONE ITEM PER LINE, split on newlines, so the summary can render a real list.
 * Asking for commas produces items containing commas and a list that splits in
 * the wrong places.
 */
export function ShiftHandover({ onSubmit, to, busy, className }: {
  onSubmit: (v: { outstanding: string[]; watch: string[]; done: string[] }) => void;
  /** Who is taking over. */
  to?: string;
  busy?: boolean;
  className?: string;
}) {
  const [outstanding, setOutstanding] = useState("");
  const [watch, setWatch] = useState("");
  const [done, setDone] = useState("");
  const [none, setNone] = useState(false);
  const lines = (s: string) => s.split("\n").map((l) => l.trim()).filter(Boolean);
  const ready = none || lines(outstanding).length > 0;
  const box = (id: string, label: string, value: string, set: (v: string) => void, hint?: string) => (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium">{label}</label>
      <textarea id={id} rows={3} value={value} onChange={(e) => set(e.target.value)}
        aria-describedby={hint ? `${id}-h` : undefined}
        className="w-full rounded-md border border-input bg-transparent px-2 py-1.5 text-sm" />
      {hint && <p id={`${id}-h`} className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
  return (
    <form data-slot="shift-handover" className={cn("space-y-3", className)}
      onSubmit={(e) => {
        e.preventDefault();
        if (!ready) return;
        onSubmit({ outstanding: none ? [] : lines(outstanding), watch: lines(watch), done: lines(done) });
      }}>
      {to && <p className="text-sm text-muted-foreground">Handing over to <span className="text-foreground">{to}</span></p>}
      {box("ho-out", "Outstanding", outstanding, (v) => { setOutstanding(v); if (v) setNone(false); }, "One per line.")}
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={none} className="size-4 accent-foreground"
          onChange={(e) => { setNone(e.target.checked); if (e.target.checked) setOutstanding(""); }} />
        Nothing outstanding
      </label>
      {box("ho-watch", "Keep an eye on", watch, setWatch)}
      {box("ho-done", "Done this shift", done, setDone)}
      <Button type="submit" disabled={!ready || busy}>
        {busy ? "Handing over…" : "Hand over"}
      </Button>
      {!ready && (
        <p className="text-xs text-muted-foreground">
          Say what is outstanding, or tick “nothing outstanding”.
        </p>
      )}
    </form>
  );
}
