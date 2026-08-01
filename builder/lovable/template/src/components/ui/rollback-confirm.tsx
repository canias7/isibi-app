import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
/**
 * The last gate before something irreversible.
 *
 * IT STATES WHAT WILL BE LOST, in a sentence, before it asks. "Are you sure?"
 * is not a question anybody can answer — sure about what, costing what? The
 * `willLose` prop is required precisely so a caller cannot skip the only part
 * that makes this a decision rather than a speed bump.
 *
 * `confirmWord` adds a type-to-confirm field for the genuinely destructive
 * cases. It is deliberately OPT-IN: applied to everything it becomes a reflex
 * people type through without reading, which is worse than no gate at all
 * because it looks like one. Reserve it for the actions with no recovery.
 *
 * The confirm button stays disabled until the word matches, compared after
 * trimming — a trailing space from a paste should not read as a wrong answer.
 * The comparison is case-SENSITIVE, since the word is usually a record name and
 * matching loosely defeats the deliberate friction.
 *
 * Cancel is first in the DOM, so a keyboard user tabs onto the safe answer.
 */
export function RollbackConfirm({
  what, willLose, confirmWord, onConfirm, onCancel, busy, className,
}: {
  /** What is being rolled back. */
  what: string;
  /** What it costs. Required — an unpriced confirmation is not a decision. */
  willLose: string;
  /** Demand this word typed. Reserve for the genuinely irreversible. */
  confirmWord?: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
  className?: string;
}) {
  const [typed, setTyped] = React.useState("");
  const id = React.useId();
  const ready = !confirmWord || typed.trim() === confirmWord;

  return (
    <section role="alertdialog" aria-label={`Roll back ${what}`}
      className={cn("flex flex-col gap-3 rounded-md border border-border p-4", className)}>
      <div>
        <p className="text-sm font-medium">Roll back {what}?</p>
        <p className="text-sm text-muted-foreground">This will lose {willLose}. It cannot be undone.</p>
      </div>
      {confirmWord && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={id}>Type <span className="font-mono">{confirmWord}</span> to confirm</Label>
          <Input id={id} value={typed} onChange={(e) => setTyped(e.target.value)}
            autoComplete="off" spellCheck={false} />
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button size="sm" disabled={!ready || busy} onClick={onConfirm}>
          {busy ? "Rolling back…" : "Roll back"}
        </Button>
      </div>
    </section>
  );
}
