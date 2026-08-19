import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
/**
 * One record that changed on both sides — with both versions, side by side.
 *
 * IT SHOWS BOTH VALUES AND MAKES A PERSON CHOOSE. Automatic resolution is
 * last-write-wins, which silently discards a colleague's correction because
 * their clock or their save order differed. For the records where that matters,
 * a queue somebody clears is the only honest answer.
 *
 * ONLY THE FIELDS THAT DIFFER ARE SHOWN. A conflict screen listing all forty
 * fields of a record buries the one that clashed, and the reader ends up
 * comparing by eye — which is exactly the error the screen exists to prevent.
 *
 * "KEEP BOTH" IS OFFERED WHERE IT MAKES SENSE, because for notes and addresses
 * the right answer is often neither side alone. Where it does not, the caller
 * simply omits it rather than the component pretending.
 *
 * THE TIMESTAMPS ARE SHOWN, since "who changed it more recently" is genuinely
 * useful information for a human deciding — it just should not decide by itself.
 */
export type ConflictField = { field: string; here: string; there: string };

export function MappingConflict({ record, here, there, fields, hereAt, thereAt, onKeepHere, onKeepThere, onKeepBoth, busy, className }: {
  /** Which record — "Ada Vance". */
  record: string;
  /** Our side's name. */
  here: string;
  /** Their side's name. */
  there: string;
  fields: ConflictField[];
  /** Free text. */
  hereAt?: string;
  thereAt?: string;
  onKeepHere: () => void;
  onKeepThere: () => void;
  onKeepBoth?: () => void;
  busy?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2 rounded-md border border-border p-3", className)}>
      <p className="text-sm">
        <span className="font-medium">{record}</span>
        <span className="text-muted-foreground">
          {" "}changed in both places · {fields.length} {fields.length === 1 ? "field" : "fields"} differ
        </span>
      </p>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-muted-foreground">
            <th scope="col" className="px-2 py-1 text-start font-normal">Field</th>
            <th scope="col" className="px-2 py-1 text-start font-normal">
              {here}{hereAt && <span className="block">{hereAt}</span>}
            </th>
            <th scope="col" className="px-2 py-1 text-start font-normal">
              {there}{thereAt && <span className="block">{thereAt}</span>}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {fields.map((f) => (
            <tr key={f.field}>
              <th scope="row" className="px-2 py-1.5 text-start font-normal text-muted-foreground">{f.field}</th>
              <td className="px-2 py-1.5">{f.here}</td>
              <td className="px-2 py-1.5">{f.there}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={onKeepHere} disabled={busy}>Keep {here}</Button>
        <Button type="button" size="sm" variant="outline" onClick={onKeepThere} disabled={busy}>Keep {there}</Button>
        {onKeepBoth && <Button type="button" size="sm" variant="outline" onClick={onKeepBoth} disabled={busy}>Keep both</Button>}
      </div>
    </div>
  );
}
