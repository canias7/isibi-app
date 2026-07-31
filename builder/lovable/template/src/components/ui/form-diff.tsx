import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * "You have changed 3 things" — the summary before saving, and the list of what.
 *
 * It compares against the values the form OPENED with, so it answers the
 * question people actually have when a save is about to touch a live record.
 * A "you have unsaved changes" flag alone says something changed and not what,
 * which on a long form means scrolling the whole thing to find out.
 *
 * Fields NOT listed are unchanged, and it says so — a diff that only shows the
 * changed rows is ambiguous about whether the rest were checked.
 *
 * Values are compared as strings, deliberately. A form control's value is a
 * string, so `28` typed into a number field and `28` loaded from the database
 * are the same edit, and comparing them by identity marks every numeric field
 * dirty the moment it is focused.
 *
 * An empty value prints "not set" on both sides rather than a blank, for the
 * same reason `compare-table` does: a blank is ambiguous between cleared and
 * not looked at.
 */
export function diffValues<T extends Record<string, unknown>>(before: T, after: T, keys?: (keyof T)[]) {
  const ks = (keys ?? (Object.keys({ ...before, ...after }) as (keyof T)[]));
  return ks
    .filter((k) => String(before[k] ?? "") !== String(after[k] ?? ""))
    .map((k) => ({ key: String(k), before: before[k], after: after[k] }));
}

export function FormDiff({ changes, labels, unchangedCount, className }: {
  changes: { key: string; before?: unknown; after?: unknown }[];
  labels?: Record<string, React.ReactNode>;
  unchangedCount?: number;
  className?: string;
}) {
  const blank = <span className="text-muted-foreground italic">not set</span>;
  if (changes.length === 0) {
    return (
      <p className={cn("text-xs text-muted-foreground", className)}>
        Nothing has changed.
      </p>
    );
  }
  return (
    <div className={cn("flex flex-col gap-2 rounded-md border border-border p-3", className)}>
      <p className="text-sm font-medium">
        {changes.length} {changes.length === 1 ? "change" : "changes"}
        {unchangedCount ? (
          <span className="font-normal text-muted-foreground"> · {unchangedCount} unchanged</span>
        ) : null}
      </p>
      <dl className="flex flex-col gap-1.5 text-xs">
        {changes.map((c) => (
          <div key={c.key} className="flex flex-wrap items-baseline gap-x-2">
            <dt className="text-muted-foreground">{labels?.[c.key] ?? c.key}</dt>
            <dd className="flex flex-wrap items-baseline gap-1.5">
              <span className="text-muted-foreground line-through">
                {c.before == null || c.before === "" ? blank : String(c.before)}
              </span>
              <span aria-hidden className="text-muted-foreground">&rarr;</span>
              <span className="sr-only">changed to</span>
              <span className="font-medium">
                {c.after == null || c.after === "" ? blank : String(c.after)}
              </span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
