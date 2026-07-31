import * as React from "react";
import { Users } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * "Grace changed this while you were editing" — the warning before a save that
 * would overwrite.
 *
 * IT APPEARS BEFORE THE SAVE, not after. A message telling somebody their work
 * has been overwritten is an apology; the same message before the button is a
 * decision they can make. That is the whole placement argument.
 *
 * IT NAMES THE FIELDS THAT DIFFER, not just the document. "Grace changed this
 * page" gives no way to judge whether it matters; "Grace changed the price and
 * the notes" tells you immediately whether your edit collides.
 *
 * THREE ACTIONS, and none is a default. Keep yours, take theirs, or look at
 * both — a two-button "overwrite / cancel" forces a guess, and cancel loses the
 * work as surely as overwriting does.
 *
 * `role="alert"`, because this arrives while somebody is about to press save
 * and is precisely the interruption that is warranted.
 */
export function CoEditNote({ by, at, fields, onKeepMine, onTakeTheirs, onCompare, className }: {
  by: React.ReactNode;
  at?: React.ReactNode;
  fields?: string[];
  onKeepMine?: () => void;
  onTakeTheirs?: () => void;
  onCompare?: () => void;
  className?: string;
}) {
  return (
    <div role="alert" className={cn("flex flex-col gap-2 rounded-lg border-2 border-foreground p-3", className)}>
      <div className="flex items-start gap-2.5">
        <Users aria-hidden className="mt-0.5 size-4 shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-medium">
            <strong>{by}</strong> changed this while you were editing
            {at ? <span className="font-normal text-muted-foreground"> · {at}</span> : null}
          </p>
          {fields?.length ? (
            <p className="mt-0.5 text-xs text-muted-foreground">
              Different in: {fields.map((f, i) => (
                <React.Fragment key={f}>
                  {i > 0 ? ", " : ""}
                  <span className="text-foreground">{f}</span>
                </React.Fragment>
              ))}
            </p>
          ) : null}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-xs">
        {onCompare ? (
          <button type="button" onClick={onCompare}
            className="cursor-pointer rounded-md border border-border px-2.5 py-1.5 font-medium hover:bg-muted">
            Look at both
          </button>
        ) : null}
        {onKeepMine ? (
          <button type="button" onClick={onKeepMine}
            className="cursor-pointer underline underline-offset-2">Keep my version</button>
        ) : null}
        {onTakeTheirs ? (
          <button type="button" onClick={onTakeTheirs}
            className="cursor-pointer text-muted-foreground underline underline-offset-2 hover:text-foreground">
            Take theirs
          </button>
        ) : null}
      </div>
    </div>
  );
}
