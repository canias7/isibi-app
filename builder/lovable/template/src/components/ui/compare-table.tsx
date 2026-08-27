import * as React from "react";
import { ArrowRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * Before and after, one line per field — what a revision, an import preview or
 * an "are you sure?" screen actually needs.
 *
 * UNCHANGED lines are collapsed by default and counted. The reason to open a
 * diff is to see what moved, and burying four changes among forty identical
 * lines is how a wrong one gets approved.
 *
 * A change is never shown by colour alone: the old value is struck through, the
 * new one is in medium weight, and an arrow sits between them. Red-to-green is
 * the usual treatment and it says nothing in greyscale, in print, or to the
 * ~8% of men who cannot separate those two hues.
 *
 * An empty side prints "not set" rather than a blank, because a blank cell in a
 * diff is ambiguous between "cleared" and "we did not look".
 */
export function CompareTable({
  fields, beforeLabel = "Before", afterLabel = "After", showUnchanged, className,
}: {
  fields: { key: string; label: React.ReactNode; before?: React.ReactNode; after?: React.ReactNode }[];
  beforeLabel?: React.ReactNode;
  afterLabel?: React.ReactNode;
  showUnchanged?: boolean;
  className?: string;
}) {
  const [all, setAll] = React.useState(!!showUnchanged);
  /**
   * TWO REACT NODES ARE NOT COMPARED WITH `String()`, AND THIS TABLE IS THE
   * WORST PLACE TO GET THAT WRONG. Both sides are typed `React.ReactNode` — a
   * price rendered as `<Money/>`, a status as a `<Badge/>` — and every element
   * stringifies to "[object Object]", so `String(a) !== String(b)` answered
   * FALSE for two values that are completely different. Three things followed,
   * all silent: the row was filtered out of the default view, it was counted in
   * "N unchanged fields", and a table where every field is an element rendered
   * "Nothing changed." This component's own doc calls it an "are you sure?"
   * screen — so somebody approves a change they were shown as not being one.
   *
   * IT FAILS TOWARD "CHANGED", deliberately. Text is compared as text; anything
   * else falls back to identity, so the same node handed to both sides is still
   * correctly unchanged, and two separately-built but identical elements are
   * reported as a change. That costs one extra visible row. Being wrong the
   * other way costs an approval.
   */
  // A TYPE PREDICATE, not a plain boolean: after `isText(a)` TypeScript knows
  // `a` is `string | number`, so the comparison below is over text rather than
  // over a node that merely happens to be one.
  const isText = (v: React.ReactNode): v is string | number =>
    typeof v === "string" || typeof v === "number";
  const changed = (f: (typeof fields)[number]) => {
    const a = f.before ?? "", b = f.after ?? "";
    return isText(a) && isText(b) ? String(a) !== String(b) : !Object.is(a, b);
  };
  const shown = all ? fields : fields.filter(changed);
  const same = fields.length - fields.filter(changed).length;
  const blank = <span className="text-muted-foreground italic">not set</span>;

  return (
    <div data-slot="compare-table" className={cn("rounded-md border border-border", className)}>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50 text-xs text-muted-foreground">
            <th scope="col" className="px-3 py-1.5 text-start font-medium">Field</th>
            <th scope="col" className="px-3 py-1.5 text-start font-medium">{beforeLabel}</th>
            <th scope="col" className="w-6 px-0 py-1.5" />
            <th scope="col" className="px-3 py-1.5 text-start font-medium">{afterLabel}</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((f) => {
            const diff = changed(f);
            return (
              <tr key={f.key} className="border-b border-border last:border-0 align-top">
                <th scope="row" className="px-3 py-2 text-start font-normal text-muted-foreground whitespace-nowrap">{f.label}</th>
                <td className={cn("px-3 py-2", diff && "text-muted-foreground line-through")}>
                  {f.before == null || f.before === "" ? blank : f.before}
                </td>
                <td className="px-0 py-2 text-center text-muted-foreground">
                  {diff
                    ? <ArrowRight aria-label="changed to" className="inline size-3.5" />
                    : <Minus aria-label="unchanged" className="inline size-3.5 opacity-40" />}
                </td>
                <td className={cn("px-3 py-2", diff && "font-medium")}>
                  {f.after == null || f.after === "" ? blank : f.after}
                </td>
              </tr>
            );
          })}
          {shown.length === 0 ? (
            <tr><td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">Nothing changed.</td></tr>
          ) : null}
        </tbody>
      </table>
      {same > 0 ? (
        <div className="border-t border-border px-3 py-2">
          <button type="button" onClick={() => setAll((v) => !v)}
            className="cursor-pointer text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">
            {all ? `Hide ${same} unchanged ${same === 1 ? "field" : "fields"}` : `Show ${same} unchanged ${same === 1 ? "field" : "fields"}`}
          </button>
        </div>
      ) : null}
    </div>
  );
}
