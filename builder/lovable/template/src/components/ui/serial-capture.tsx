import { useId, useState } from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
/**
 * Scanning serial numbers one at a time, against a known count.
 *
 * THE INPUT DOES NOT CLEAR UNTIL THE VALUE IS ACCEPTED, and this is the whole
 * behaviour. A scanner types fast and presses Enter; clearing optimistically
 * loses a rejected scan silently, and the operator carries on believing it was
 * captured.
 *
 * A DUPLICATE IS REFUSED AND SAID SO, not skipped. The commonest scanning error
 * is reading the same label twice — a silent drop leaves the count one short
 * and no way to see which unit is missing.
 *
 * THE REMAINING COUNT IS THE PROGRESS INDICATOR, because the operator's actual
 * question is "how many more boxes do I open".
 *
 * CAPTURED SERIALS STAY VISIBLE AND REMOVABLE. A mis-scan has to be undoable
 * without starting again, and a list that only grows makes the twelfth of
 * fifteen scans a restart.
 */
export function SerialCapture({ label = "Scan serial", expected, serials, onChange, className }: {
  label?: string;
  /** How many are expected. */
  expected: number;
  serials: string[];
  onChange: (next: string[]) => void;
  className?: string;
}) {
  const id = useId();
  const [value, setValue] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const left = expected - serials.length;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const v = value.trim();
    if (!v) return;
    if (serials.includes(v)) {
      setProblem("Already scanned — this is the same label twice.");
      return;
    }
    if (left <= 0) {
      setProblem("That is more than expected. Check the quantity before scanning on.");
      return;
    }
    setProblem(null);
    setValue("");
    onChange([...serials, v]);
  }

  return (
    <div data-slot="serial-capture" className={cn("space-y-1.5", className)}>
      <form onSubmit={submit} className="space-y-1">
        <label htmlFor={id} className="block text-sm font-medium">{label}</label>
        <Input
          id={id}
          value={value}
          autoComplete="off"
          onChange={(e) => { setValue(e.target.value); setProblem(null); }}
          aria-describedby={`${id}-count`}
          aria-invalid={problem ? true : undefined}
        />
        <p id={`${id}-count`} className="text-xs tabular-nums text-muted-foreground">
          {serials.length} of {expected} scanned{left > 0 ? ` · ${left} to go` : " · complete"}
        </p>
        {problem && <p className="text-xs font-medium">{problem}</p>}
      </form>
      {serials.length > 0 && (
        <ul className="divide-y divide-border rounded-md border border-border text-sm">
          {serials.map((s) => (
            <li key={s} className="flex items-center gap-3 px-3 py-1.5">
              <span className="min-w-0 flex-1 font-mono text-xs">{s}</span>
              <button
                type="button"
                className="shrink-0 text-xs underline underline-offset-2"
                onClick={() => onChange(serials.filter((x) => x !== s))}
              >
                Remove<span className="sr-only"> {s}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
