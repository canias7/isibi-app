import * as React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
/**
 * Find and replace over a string.
 *
 * THE QUERY IS ESCAPED before it becomes a regex. Unescaped, typing `(` into
 * a find box throws, and `.*` silently matches the whole document — the same
 * crash `highlight-match` guards against, in a box where people are far more
 * likely to type a bracket.
 *
 * "Replace all" reports how many it changed rather than doing it silently.
 * The count is the only way somebody notices they matched 400 things when
 * they meant 4, and it is shown BEFORE they commit.
 */
export function FindReplace({ value, onChange, className }: {
  value: string; onChange: (v: string) => void; className?: string;
}) {
  const [find, setFind] = React.useState("");
  const [replace, setReplace] = React.useState("");
  const [matchCase, setMatchCase] = React.useState(false);
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = find ? new RegExp(esc(find), matchCase ? "g" : "gi") : null;
  const count = re ? (value.match(re) ?? []).length : 0;
  return (
    <div className={cn("space-y-2 rounded-md border border-border p-3", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <Input value={find} placeholder="Find" aria-label="Find" className="h-8 flex-1"
          onChange={(e) => setFind(e.target.value)} />
        <Input value={replace} placeholder="Replace with" aria-label="Replace with" className="h-8 flex-1"
          onChange={(e) => setReplace(e.target.value)} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Checkbox id="fr-case" checked={matchCase} onCheckedChange={(v) => setMatchCase(v === true)} />
          <Label htmlFor="fr-case" className="text-xs font-normal">Match case</Label>
        </div>
        <p className="text-xs tabular-nums text-muted-foreground" aria-live="polite">
          {find ? `${count} ${count === 1 ? "match" : "matches"}` : ""}
        </p>
        <Button type="button" size="sm" variant="outline" disabled={!count}
          onClick={() => re && onChange(value.replace(re, replace))}>
          Replace {count > 0 ? `all ${count}` : "all"}
        </Button>
      </div>
    </div>
  );
}
