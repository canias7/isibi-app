import * as React from "react";
import { Eye, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * What an app is asking to be allowed to do — the consent screen's list.
 *
 * WRITE and DELETE are separated from READ and shown FIRST, with the icon
 * carrying it as well as the words. A flat alphabetical list of twelve scopes
 * hides "delete your bookings" among eleven harmless reads, and the whole
 * decision being made is about the dangerous ones.
 *
 * Each line is one plain sentence starting with a verb: "Read your booking
 * history", not "bookings.read". The identifier is what the API calls it and
 * belongs in a `<code>` under the sentence at most, never instead of it.
 *
 * `optional` scopes can be refused individually. An all-or-nothing consent
 * screen makes every permission a hostage to the one the app actually needs,
 * and people learn to accept everything — which is the outcome the screen
 * exists to prevent.
 */
export function ScopeList({ scopes, granted, onToggle, className }: {
  scopes: { key: string; label: React.ReactNode; detail?: React.ReactNode; kind?: "read" | "write" | "delete"; optional?: boolean }[];
  granted?: string[];
  onToggle?: (key: string) => void;
  className?: string;
}) {
  const rank = { delete: 0, write: 1, read: 2 } as const;
  const ordered = [...scopes].sort((a, b) => rank[a.kind ?? "read"] - rank[b.kind ?? "read"]);
  const Icon = (k?: string) => (k === "delete" ? Trash2 : k === "write" ? Pencil : Eye);

  return (
    <ul data-slot="scope-list" className={cn("flex flex-col divide-y divide-border rounded-md border border-border", className)}>
      {ordered.map((s) => {
        const I = Icon(s.kind);
        const on = !granted || granted.includes(s.key);
        return (
          <li key={s.key} className="flex items-start gap-3 p-3">
            <I aria-hidden className={cn("mt-0.5 size-4 shrink-0",
              s.kind === "read" ? "text-muted-foreground" : "")} />
            <div className="min-w-0 flex-1">
              <p className={cn("text-sm", s.kind !== "read" && "font-medium")}>
                {s.label}
                <span className="sr-only">
                  {" "}({s.kind === "delete" ? "can delete" : s.kind === "write" ? "can change things" : "read only"})
                </span>
              </p>
              {s.detail ? <p className="mt-0.5 text-xs text-muted-foreground">{s.detail}</p> : null}
            </div>
            {s.optional && onToggle ? (
              <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
                <input type="checkbox" checked={on} onChange={() => onToggle(s.key)}
                  className="size-3.5 cursor-pointer accent-foreground" />
                Allow
              </label>
            ) : s.optional ? null : (
              <span className="shrink-0 text-xs text-muted-foreground">Required</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
